import { EventEmitter } from 'events';
import prisma from '../config/prisma.js';
import { RAGService, ChatMode, Citation } from '../services/rag.service.js';
import { LLMService, LLMProviderType } from '../services/llm.service.js';
import { TaskType } from '../ai/types.js';
import { config } from '../config/env.js';

export type ChatJobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface ChatTask {
  jobId: string;
  sessionId: string;
  repositoryId: string;
  chatSessionId: string;
  userMessageId: string;
  assistantMessageId: string;
  query: string;
  mode: ChatMode;
  selectedFilePath?: string | null;
  provider?: LLMProviderType;
}

export type ChatStreamEvent =
  | { type: 'status'; data: { status: ChatJobStatus; progress: number; currentStage: string } }
  | { type: 'citations'; data: { citations: Citation[] } }
  | { type: 'token'; data: { token: string } }
  | { type: 'done'; data: { complete: boolean; assistantMessageId: string; chatSessionId: string } }
  | { type: 'error'; data: { message: string } };

/**
 * ChatQueueService — Robust, persistent background worker for AI chat requests.
 *
 * Key Architectural Guarantees:
 * 1. The lifetime of a ChatJob is completely independent of the browser / SSE connection.
 * 2. Navigation, component unmount, or page refresh NEVER cancels or loses the response.
 * 3. Bounded concurrency protects ChromaDB singleton from process congestion.
 * 4. Automatic recovery cleans up zombie RUNNING jobs on server startup.
 * 5. Full response & citations are atomically persisted to PostgreSQL.
 */
export class ChatQueueService {
  private static readonly MAX_CONCURRENT_JOBS = 2;
  private static runningJobs = new Map<string, AbortController>();
  private static queue: ChatTask[] = [];
  private static activeWorkers = 0;
  private static eventEmitter = new EventEmitter();
  private static initialized = false;

  static {
    this.eventEmitter.setMaxListeners(200);
  }

  /**
   * Initializes queue on backend boot, cleaning up any zombie RUNNING/QUEUED jobs.
   */
  public static async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    try {
      // Mark any stale RUNNING or QUEUED jobs from previous server crash as FAILED
      const stale = await (prisma as any).chatJob.updateMany({
        where: {
          status: { in: ['RUNNING', 'QUEUED'] },
        },
        data: {
          status: 'FAILED',
          error: 'Chat generation was interrupted by a server restart. Please click Retry.',
          currentStage: 'Interrupted by server restart',
          completedAt: new Date(),
        },
      });

      if (stale.count > 0) {
        console.log(`[ChatQueue] Cleaned up ${stale.count} stale chat jobs from prior runtime.`);
      }
    } catch (err: any) {
      console.warn('[ChatQueue] Stale job cleanup warning:', err.message);
    }
  }

  /**
   * Enqueues a chat task for background processing.
   */
  public static enqueue(task: ChatTask): void {
    // Prevent duplicate entries
    const isAlreadyQueued = this.queue.some((t) => t.jobId === task.jobId);
    const isAlreadyRunning = this.runningJobs.has(task.jobId);

    if (isAlreadyQueued || isAlreadyRunning) {
      console.warn(`[ChatQueue] Duplicate enqueue rejected for job ${task.jobId}`);
      return;
    }

    this.queue.push(task);
    console.log(`[ChatQueue] Enqueued chat job ${task.jobId} for repo ${task.repositoryId}. Queue size: ${this.queue.length}`);
    this.processQueue();
  }

  /**
   * Subscribes a listener (e.g. SSE stream) to live events from a specific ChatJob.
   */
  public static subscribe(jobId: string, listener: (event: ChatStreamEvent) => void): () => void {
    const eventName = `chat-job:${jobId}`;
    this.eventEmitter.on(eventName, listener);
    return () => {
      this.eventEmitter.off(eventName, listener);
    };
  }

  /**
   * Emits an event for a specific ChatJob.
   */
  private static emitEvent(jobId: string, event: ChatStreamEvent): void {
    this.eventEmitter.emit(`chat-job:${jobId}`, event);
  }

  /**
   * Processes the in-memory queue with bounded concurrency.
   */
  private static processQueue(): void {
    if (this.activeWorkers >= this.MAX_CONCURRENT_JOBS || this.queue.length === 0) {
      return;
    }

    const task = this.queue.shift();
    if (!task) return;

    this.activeWorkers++;
    const abortCtrl = new AbortController();
    this.runningJobs.set(task.jobId, abortCtrl);

    this.executeTask(task, abortCtrl.signal)
      .catch((err) => {
        console.error(`[ChatQueue] Unexpected unhandled error for job ${task.jobId}:`, err);
      })
      .finally(() => {
        this.runningJobs.delete(task.jobId);
        this.activeWorkers--;
        this.processQueue();
      });
  }

  /**
   * Executes a single chat task in the background.
   */
  private static async executeTask(task: ChatTask, signal: AbortSignal): Promise<void> {
    const { jobId, repositoryId, chatSessionId, assistantMessageId, query, mode, selectedFilePath, provider } = task;
    console.log(`[ChatQueue] 🚀 Starting background execution for job ${jobId}`);

    try {
      // 1. Mark ChatJob as RUNNING in DB
      await this.updateJobState(jobId, 'RUNNING', 10, 'Retrieving repository context...');
      this.emitEvent(jobId, {
        type: 'status',
        data: { status: 'RUNNING', progress: 10, currentStage: 'Retrieving repository context...' },
      });

      // Update assistant message status to STREAMING
      await prisma.message.update({
        where: { id: assistantMessageId },
        data: { status: 'STREAMING' },
      }).catch((err) => console.warn('[ChatQueue] Could not update assistant message status:', err.message));

      if (signal.aborted) return;

      // 2. Fetch repository
      const repo = await prisma.repository.findUnique({ where: { id: repositoryId } });
      if (!repo) {
        throw new Error('Repository not found.');
      }

      // 3. RAG Vector & Keyword Context Retrieval
      const { citations, contextText, error: retrievalError } = await RAGService.retrieveContext(
        query,
        repositoryId,
        config.topKResults,
        selectedFilePath || undefined
      );

      if (retrievalError) {
        console.warn(`[ChatQueue] RAG context retrieval notice: ${retrievalError}`);
      }

      // Emit citations to listeners if available
      if (citations && citations.length > 0) {
        this.emitEvent(jobId, { type: 'citations', data: { citations } });
      }

      await this.updateJobState(jobId, 'RUNNING', 40, 'Generating response with AI model...');
      this.emitEvent(jobId, {
        type: 'status',
        data: { status: 'RUNNING', progress: 40, currentStage: 'Generating response with AI model...' },
      });

      if (signal.aborted) return;

      // 4. Build System Prompt & Map Mode to TaskType
      const systemPrompt = RAGService.buildSystemPrompt(repo, mode, contextText, selectedFilePath || undefined);

      const modeToTaskMap: Record<string, TaskType> = {
        explain: 'coding',
        refactor: 'coding',
        generate_tests: 'testing',
        architecture: 'architecture',
        debug: 'debugging',
        bugs: 'debugging',
        security: 'security',
        commits: 'chat',
        repo: 'chat',
        file: 'chat',
      };
      const taskType: TaskType = modeToTaskMap[mode] || 'chat';

      // Load conversation history for context
      const history = await RAGService.getConversationHistory(chatSessionId);
      const historyForContext = history.slice(0, -1);

      // 5. Stream / Generate LLM Response
      let fullAnswer = '';
      const activeProvider = provider || (config.llmProvider as LLMProviderType) || 'openrouter';

      try {
        for await (const token of LLMService.streamChat({
          systemPrompt,
          userMessage: query,
          conversationHistory: historyForContext,
          provider: activeProvider,
          rawContextText: contextText,
          taskType,
          onEvent: (ev) => {
            if (ev.type === 'provider_fallback' || ev.type === 'provider_attempt') {
              const stageMsg = ev.type === 'provider_fallback'
                ? `Switching to ${ev.provider} (${ev.model})...`
                : `Connecting to ${ev.provider}...`;
              this.updateJobState(jobId, 'RUNNING', 50, stageMsg).catch(() => {});
              this.emitEvent(jobId, {
                type: 'status',
                data: { status: 'RUNNING', progress: 50, currentStage: stageMsg },
              });
            }
          },
        })) {
          if (signal.aborted) break;
          fullAnswer += token;
          this.emitEvent(jobId, { type: 'token', data: { token } });
        }
      } catch (genErr: any) {
        console.error(`[ChatQueue] Generation stream error: ${genErr.message}`);
        fullAnswer += `\n\n*[Error during response generation: ${genErr.message}]*`;
      }

      if (signal.aborted) return;

      // 6. Atomically persist completed answer and citations to DB
      await prisma.message.update({
        where: { id: assistantMessageId },
        data: {
          content: fullAnswer,
          status: 'COMPLETED',
          citations: JSON.stringify(citations || []),
        },
      });

      await prisma.chatSession.update({
        where: { id: chatSessionId },
        data: { updatedAt: new Date() },
      });

      // 7. Mark ChatJob as COMPLETED in DB
      await this.updateJobState(jobId, 'COMPLETED', 100, 'Completed');
      this.emitEvent(jobId, {
        type: 'done',
        data: { complete: true, assistantMessageId, chatSessionId },
      });

      console.log(`[ChatQueue] ✅ Chat job ${jobId} successfully completed and persisted.`);
    } catch (err: any) {
      console.error(`[ChatQueue] ❌ Chat job ${jobId} failed:`, err.message);

      // Persist failure state safely
      await prisma.message.update({
        where: { id: assistantMessageId },
        data: {
          content: `⚠️ Unable to generate response: ${err.message || 'Unknown error'}`,
          status: 'FAILED',
        },
      }).catch(() => {});

      await this.updateJobState(jobId, 'FAILED', 100, 'Failed', err.message);

      this.emitEvent(jobId, {
        type: 'error',
        data: { message: err.message || 'Failed to generate response' },
      });
    }
  }

  /**
   * Helper to update ChatJob state in database safely.
   */
  private static async updateJobState(
    jobId: string,
    status: ChatJobStatus,
    progress: number,
    currentStage: string,
    error?: string
  ): Promise<void> {
    try {
      await (prisma as any).chatJob.update({
        where: { id: jobId },
        data: {
          status,
          progress,
          currentStage,
          error: error || null,
          ...(status === 'RUNNING' && progress <= 10 ? { startedAt: new Date() } : {}),
          ...(status === 'COMPLETED' || status === 'FAILED' ? { completedAt: new Date() } : {}),
        },
      });
    } catch (dbErr: any) {
      console.warn(`[ChatQueue] Failed to update job ${jobId} in DB:`, dbErr.message);
    }
  }
}

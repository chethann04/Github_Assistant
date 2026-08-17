import { EventEmitter } from 'events';
import prisma from '../config/prisma.js';
import {
  AnalysisJobRegistry,
  normalizeAnalysisType,
  SupportedAnalysisType,
} from './analysis-registry.js';

export interface AnalysisTask {
  jobId: string;
  repositoryId: string;
  sessionId: string;
  type: string;
  targetParam?: string | null;
  params?: any;
  commitSha?: string;
}

export interface AnalysisJobEvent {
  type: 'status' | 'progress' | 'completed' | 'failed' | 'cancelled';
  data: {
    jobId: string;
    status: string;
    progress: number;
    currentStage?: string | null;
    result?: any;
    error?: string | null;
  };
}

/**
 * AnalysisQueueService — Universal persistent background worker for all AI & analysis features.
 *
 * Bounded Concurrency: MAX_CONCURRENT_ANALYSIS_JOBS = 2
 * Singleton Chroma Worker remains untouched.
 * Real stage tracking, DB persistence, and SSE event streaming.
 */
export class AnalysisQueueService {
  private static readonly MAX_CONCURRENT_JOBS = 2;
  private static runningJobs = new Map<string, AbortController>();
  private static queue: AnalysisTask[] = [];
  private static isProcessing = false;
  private static initialized = false;
  private static eventEmitter = new EventEmitter();

  /**
   * Initializes queue on backend boot, cleaning up any zombie RUNNING/QUEUED jobs.
   */
  public static async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    try {
      // Mark any stale RUNNING or QUEUED jobs from previous server crash as FAILED
      const stale = await prisma.analysisJob.updateMany({
        where: {
          status: { in: ['RUNNING', 'QUEUED'] },
        },
        data: {
          status: 'FAILED',
          error: 'Analysis was interrupted by a server restart. Please click Retry.',
          errorMessage: 'Analysis was interrupted by a server restart. Please click Retry.',
          currentStage: 'Interrupted by server restart',
          completedAt: new Date(),
        },
      });

      if (stale.count > 0) {
        console.log(`[AnalysisQueue] Cleaned up ${stale.count} stale analysis jobs from prior runtime.`);
      }
    } catch (err: any) {
      console.warn('[AnalysisQueue] Stale job cleanup warning:', err.message);
    }
  }

  /**
   * Subscribe to live events for a specific job.
   */
  public static onJobEvent(jobId: string, listener: (event: AnalysisJobEvent) => void): () => void {
    const eventName = `job:${jobId}`;
    this.eventEmitter.on(eventName, listener);
    return () => {
      this.eventEmitter.off(eventName, listener);
    };
  }

  private static emitJobEvent(jobId: string, event: AnalysisJobEvent): void {
    this.eventEmitter.emit(`job:${jobId}`, event);
    this.eventEmitter.emit('global', event);
  }

  /**
   * Enqueues an analysis job for background execution.
   */
  public static enqueue(task: AnalysisTask): void {
    // Avoid duplicate queue entries
    if (this.queue.some((t) => t.jobId === task.jobId) || this.runningJobs.has(task.jobId)) {
      return;
    }

    this.queue.push(task);
    console.log(
      `[AnalysisQueue] Enqueued job ${task.jobId} (${task.type}) for repo ${task.repositoryId}. Queue size: ${this.queue.length}`
    );
    this.processQueue();
  }

  /**
   * Cancels a queued or running job.
   */
  public static async cancelJob(jobId: string): Promise<boolean> {
    const abortCtrl = this.runningJobs.get(jobId);
    if (abortCtrl) {
      abortCtrl.abort();
      this.runningJobs.delete(jobId);
    }

    const qIdx = this.queue.findIndex((t) => t.jobId === jobId);
    if (qIdx !== -1) {
      this.queue.splice(qIdx, 1);
    }

    try {
      await prisma.analysisJob.update({
        where: { id: jobId },
        data: {
          status: 'CANCELLED',
          currentStage: 'Cancelled by user',
          completedAt: new Date(),
        },
      });

      this.emitJobEvent(jobId, {
        type: 'cancelled',
        data: { jobId, status: 'CANCELLED', progress: 0, currentStage: 'Cancelled by user' },
      });

      console.log(`[AnalysisQueue] Job ${jobId} cancelled successfully.`);
      return true;
    } catch (err: any) {
      console.warn(`[AnalysisQueue] Failed to update cancelled job ${jobId}:`, err.message);
      return false;
    }
  }

  public static async updateJobStage(
    jobId: string,
    status: 'RUNNING' | 'COMPLETED' | 'FAILED',
    progress: number,
    currentStage: string,
    extra?: { result?: any; error?: string }
  ): Promise<void> {
    // 1. Emit live event immediately for 0ms UI responsiveness
    this.emitJobEvent(jobId, {
      type: status === 'COMPLETED' ? 'completed' : status === 'FAILED' ? 'failed' : 'progress',
      data: {
        jobId,
        status,
        progress,
        currentStage,
        result: extra?.result,
        error: extra?.error,
      },
    });

    // 2. Persist to PostgreSQL (await only on final states; intermediate stages update asynchronously)
    const dbUpdatePromise = prisma.analysisJob.update({
      where: { id: jobId },
      data: {
        status,
        progress,
        currentStage,
        ...(status === 'RUNNING' && progress <= 15 ? { startedAt: new Date() } : {}),
        ...(status === 'COMPLETED' || status === 'FAILED' ? { completedAt: new Date() } : {}),
        ...(extra?.result !== undefined ? { result: extra.result } : {}),
        ...(extra?.error !== undefined ? { error: extra.error, errorMessage: extra.error } : {}),
      },
    }).catch((err) => {
      console.warn(`[AnalysisQueue] DB update error for job ${jobId}:`, err.message);
    });

    if (status === 'COMPLETED' || status === 'FAILED') {
      await dbUpdatePromise;
    }
  }

  private static async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.runningJobs.size < this.MAX_CONCURRENT_JOBS && this.queue.length > 0) {
        const task = this.queue.shift();
        if (!task) break;

        const abortCtrl = new AbortController();
        this.runningJobs.set(task.jobId, abortCtrl);

        // Execute task in background without blocking the queue loop
        this.executeTask(task, abortCtrl).finally(() => {
          this.runningJobs.delete(task.jobId);
          this.processQueue();
        });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private static async executeTask(task: AnalysisTask, abortCtrl: AbortController): Promise<void> {
    const { jobId, repositoryId, sessionId, type, targetParam, params, commitSha } = task;
    const normalizedType = normalizeAnalysisType(type);
    console.log(`[AnalysisQueue] 🚀 Starting job ${jobId} (${normalizedType}) for repo ${repositoryId}`);

    if (abortCtrl.signal.aborted) {
      console.log(`[AnalysisQueue] Job ${jobId} was aborted before execution.`);
      return;
    }

    const executor = AnalysisJobRegistry.getExecutor(normalizedType);
    if (!executor) {
      const errMsg = `Unsupported analysis job type: ${type}`;
      console.error(`[AnalysisQueue] ${errMsg}`);
      await this.updateJobStage(jobId, 'FAILED', 0, 'Unsupported Type', { error: errMsg });
      return;
    }

    try {
      await this.updateJobStage(jobId, 'RUNNING', 5, 'Initializing analysis environment');

      const onProgress = async (progress: number, currentStage: string) => {
        if (abortCtrl.signal.aborted) return;
        await this.updateJobStage(jobId, 'RUNNING', progress, currentStage);
      };

      const result = await executor({
        jobId,
        repositoryId,
        sessionId,
        type: normalizedType,
        targetParam,
        params,
        commitSha,
        signal: abortCtrl.signal,
        onProgress,
      });

      if (abortCtrl.signal.aborted) {
        console.log(`[AnalysisQueue] Job ${jobId} was aborted during execution.`);
        return;
      }

      await this.updateJobStage(jobId, 'COMPLETED', 100, `${normalizedType} Analysis Completed`, {
        result,
      });

      console.log(`[AnalysisQueue] ✅ Job ${jobId} (${normalizedType}) completed successfully.`);
    } catch (err: any) {
      if (abortCtrl.signal.aborted) {
        console.log(`[AnalysisQueue] Job ${jobId} was aborted.`);
        return;
      }

      console.error(`[AnalysisQueue] ❌ Job ${jobId} (${normalizedType}) failed:`, err.message);
      await this.updateJobStage(jobId, 'FAILED', 0, 'Analysis Failed', {
        error: err.message || 'Analysis operation failed.',
      });
    }
  }
}

import {
  TaskType,
  TaskComplexity,
  OrchestratorRequest,
  OrchestratorExecutionPlan,
  MultiModelExecutionPlan,
  CandidateExecutionResult,
} from './types.js';
import { TaskRouter } from './task-router.js';
import { ComplexityRouter } from './complexity-router.js';
import { ProviderRegistry } from './provider-registry.js';
import { ModelRegistry } from './model-registry.js';
import { KeyManager } from './key-manager.js';
import { OpenAIService, ExecutionContext } from '../services/openai.service.js';
import { ResponseEvaluator } from './response-evaluator.js';

export class MultiModelOrchestrator {
  public static getMaxTotalModelCalls(): number {
    const raw = parseInt(process.env.AI_MAX_TOTAL_MODEL_CALLS || '4', 10);
    return isNaN(raw) || raw < 1 ? 4 : Math.min(raw, 6);
  }

  /**
   * Plans multi-model candidate dispatch based on task type and complexity.
   */
  public static planMultiModelExecution(request: OrchestratorRequest): MultiModelExecutionPlan {
    const taskType = TaskRouter.detectTask(request);
    const complexity = ComplexityRouter.assessComplexity(request, taskType);
    const maxParallel = ComplexityRouter.getMaxParallelModels();
    const maxTotal = this.getMaxTotalModelCalls();

    // Determine target candidate count
    let targetCount = 1;
    let requiresEvaluation = false;

    if (complexity === 'complex') {
      targetCount = Math.min(2, maxParallel);
      requiresEvaluation = targetCount > 1;
    } else if (complexity === 'critical') {
      targetCount = Math.min(3, maxParallel);
      requiresEvaluation = targetCount > 1;
    }

    // Hard guardrail on total calls per logical request
    if (requiresEvaluation && targetCount + 1 > maxTotal) {
      targetCount = Math.max(1, maxTotal - 1);
    }

    const requiredCap = TaskRouter.getRequiredCapabilityForTask(taskType);
    const allModels = ModelRegistry.getAllModels().filter((m) => m.enabled && m.capabilities.includes(requiredCap));

    // Rank candidates by capability match score
    const rankedCandidates: Array<{
      model: typeof allModels[0];
      provider: ReturnType<typeof ProviderRegistry.getProvider>;
      score: number;
    }> = [];

    for (const model of allModels) {
      const provider = ProviderRegistry.getProvider(model.providerId);
      if (!provider || !provider.enabled || !KeyManager.hasKeys(provider.id)) continue;

      const modelScore = model.priority * 100;
      const providerScore = Math.max(0, (10 - provider.priority) * 10);
      rankedCandidates.push({
        model,
        provider,
        score: modelScore + providerScore,
      });
    }

    // Sort descending by score
    rankedCandidates.sort((a, b) => b.score - a.score);

    // Pick top candidates with distinct model IDs, preferring provider diversity when targetCount > 1
    const selectedPlans: OrchestratorExecutionPlan[] = [];
    const usedModelIds = new Set<string>();
    const usedProviderIds = new Set<string>();

    // Pass 1: Select distinct model IDs from distinct providers
    for (const cand of rankedCandidates) {
      if (selectedPlans.length >= targetCount) break;
      if (!usedModelIds.has(cand.model.id) && !usedProviderIds.has(cand.provider!.id)) {
        const key = KeyManager.getKey(cand.provider!.id);
        if (key) {
          selectedPlans.push({
            provider: cand.provider!,
            model: cand.model,
            key,
            routerMode: 'auto',
            taskType,
            score: cand.score,
          });
          usedModelIds.add(cand.model.id);
          usedProviderIds.add(cand.provider!.id);
        }
      }
    }

    // Pass 2: If we still need candidates and have other distinct models on same provider, add them
    for (const cand of rankedCandidates) {
      if (selectedPlans.length >= targetCount) break;
      if (!usedModelIds.has(cand.model.id)) {
        const key = KeyManager.getKey(cand.provider!.id);
        if (key) {
          selectedPlans.push({
            provider: cand.provider!,
            model: cand.model,
            key,
            routerMode: 'auto',
            taskType,
            score: cand.score,
          });
          usedModelIds.add(cand.model.id);
        }
      }
    }

    // Fallback if no models matched
    if (selectedPlans.length === 0) {
      const fallbackProvider = ProviderRegistry.getEnabledProviders()[0] || ProviderRegistry.getProvider('nvidia');
      const fallbackModel = ModelRegistry.getModel('z-ai/glm-5.2', fallbackProvider?.id) || {
        id: 'z-ai/glm-5.2',
        name: 'GLM-5.2',
        providerId: fallbackProvider?.id || 'nvidia',
        contextWindow: 128000,
        capabilities: ['chat', 'coding', 'debugging', 'architecture', 'security', 'documentation', 'testing', 'reasoning', 'streaming', 'structured_json'],
        priority: 10,
        enabled: true,
      };
      const key = KeyManager.getKey(fallbackProvider?.id || 'nvidia') || {
        id: 'fallback-key',
        providerId: fallbackProvider?.id || 'nvidia',
        key: '',
        index: 1,
      };

      selectedPlans.push({
        provider: fallbackProvider!,
        model: fallbackModel,
        key,
        routerMode: 'auto',
        taskType,
        score: 50,
      });
    }

    return {
      taskType,
      complexity,
      candidates: selectedPlans,
      requiresEvaluation: selectedPlans.length > 1 && requiresEvaluation,
    };
  }

  /**
   * Executes a multi-model request, handling concurrency, partial candidate failures, and response synthesis.
   */
  public static async execute(request: OrchestratorRequest): Promise<string> {
    const plan = this.planMultiModelExecution(request);
    console.log(`[AI] Task=${plan.taskType} Complexity=${plan.complexity} Candidates=${plan.candidates.length}`);

    // Single-candidate fast path
    if (plan.candidates.length === 1) {
      const candidate = plan.candidates[0];
      const context: ExecutionContext = {
        apiKey: candidate.key.key || undefined,
        baseURL: candidate.provider.baseUrl,
        model: candidate.model.id,
        providerName: candidate.provider.name,
        keyId: candidate.key.id,
      };

      try {
        const result = await OpenAIService.generate(
          request.systemPrompt,
          request.userMessage,
          request.maxTokens || 2048,
          context
        );
        console.log(`[AI] Candidate provider=${candidate.provider.id} model=${candidate.model.id} status=success`);
        return result;
      } catch (err: any) {
        console.log(`[AI] Candidate provider=${candidate.provider.id} model=${candidate.model.id} status=failed`);
        throw err;
      }
    }

    // Multi-candidate concurrent execution with bounded concurrency
    const candidatePromises = plan.candidates.map(async (candidate): Promise<CandidateExecutionResult> => {
      const start = Date.now();
      const context: ExecutionContext = {
        apiKey: candidate.key.key || undefined,
        baseURL: candidate.provider.baseUrl,
        model: candidate.model.id,
        providerName: candidate.provider.name,
        keyId: candidate.key.id,
      };

      try {
        const res = await OpenAIService.generate(
          request.systemPrompt,
          request.userMessage,
          request.maxTokens || 2048,
          context
        );
        const elapsed = Date.now() - start;
        console.log(`[AI] Candidate provider=${candidate.provider.id} model=${candidate.model.id} status=success (${elapsed}ms)`);
        return {
          candidateId: `${candidate.provider.id}::${candidate.model.id}`,
          providerId: candidate.provider.id,
          modelId: candidate.model.id,
          keyId: candidate.key.id,
          status: 'success',
          response: res,
          elapsedMs: elapsed,
        };
      } catch (err: any) {
        const elapsed = Date.now() - start;
        console.log(`[AI] Candidate provider=${candidate.provider.id} model=${candidate.model.id} status=failed (${err.message})`);
        return {
          candidateId: `${candidate.provider.id}::${candidate.model.id}`,
          providerId: candidate.provider.id,
          modelId: candidate.model.id,
          keyId: candidate.key.id,
          status: 'failed',
          error: err.message,
          elapsedMs: elapsed,
        };
      }
    });

    const settled = await Promise.allSettled(candidatePromises);
    const successfulResponses: Array<{
      candidateId: string;
      modelId: string;
      providerId: string;
      response: string;
    }> = [];

    for (const outcome of settled) {
      if (outcome.status === 'fulfilled' && outcome.value.status === 'success' && outcome.value.response) {
        successfulResponses.push({
          candidateId: outcome.value.candidateId,
          modelId: outcome.value.modelId,
          providerId: outcome.value.providerId,
          response: outcome.value.response,
        });
      }
    }

    // Failure Handling Matrix:
    // 1. All failed -> throw sanitized error
    if (successfulResponses.length === 0) {
      throw new Error('All AI candidate models failed to generate a response. Please try again shortly.');
    }

    // 2. Exactly one succeeded -> return directly
    if (successfulResponses.length === 1 || !plan.requiresEvaluation) {
      return successfulResponses[0].response;
    }

    // 3. Multiple succeeded -> evaluate & synthesize final answer
    return await ResponseEvaluator.synthesize({
      originalPrompt: request.userMessage,
      taskType: plan.taskType,
      repoContext: request.rawContextText,
      candidateResponses: successfulResponses,
    });
  }

  /**
   * Stream handler respecting complexity tier.
   * Simple requests stream directly; multi-model synthesized responses stream after synthesis.
   */
  public static async *stream(
    request: OrchestratorRequest
  ): AsyncGenerator<string, void, unknown> {
    const taskType = TaskRouter.detectTask(request);
    const complexity = ComplexityRouter.assessComplexity(request, taskType);

    // For simple requests: stream tokens directly from primary candidate
    if (complexity === 'simple') {
      const plan = this.planMultiModelExecution(request);
      const candidate = plan.candidates[0];
      const context: ExecutionContext = {
        apiKey: candidate.key.key || undefined,
        baseURL: candidate.provider.baseUrl,
        model: candidate.model.id,
        providerName: candidate.provider.name,
        keyId: candidate.key.id,
      };

      console.log(`[AI] Task=${taskType} Complexity=simple Streaming Candidate provider=${candidate.provider.id} model=${candidate.model.id}`);

      for await (const token of OpenAIService.streamChat(
        request.systemPrompt,
        request.userMessage,
        request.conversationHistory || [],
        context
      )) {
        yield token;
      }
      return;
    }

    // For moderate/complex/critical multi-model operations: execute synthesis and yield final result
    const synthesizedResult = await this.execute(request);
    yield synthesizedResult;
  }
}

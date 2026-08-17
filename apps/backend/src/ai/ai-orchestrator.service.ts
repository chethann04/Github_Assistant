import {
  AIRouterMode,
  AIProvider,
  AIModel,
  AIProviderKey,
  OrchestratorRequest,
  OrchestratorExecutionPlan,
  TaskType,
} from './types.js';
import { ProviderRegistry } from './provider-registry.js';
import { ModelRegistry } from './model-registry.js';
import { KeyManager } from './key-manager.js';
import { TaskRouter } from './task-router.js';
import { MultiModelOrchestrator } from './multi-model-orchestrator.js';
import { OpenAIService, ExecutionContext } from '../services/openai.service.js';

export class AIOrchestratorService {
  /**
   * Determine the router mode from environment ('forced' | 'auto').
   */
  public static getRouterMode(): AIRouterMode {
    const raw = (process.env.AI_ROUTER_MODE || 'forced').trim().toLowerCase();
    return raw === 'auto' ? 'auto' : 'forced';
  }

  /**
   * Resolves the optimal execution plan (Provider, Model, Key, Mode, Task) for a logical request.
   */
  public static planExecution(request: OrchestratorRequest): OrchestratorExecutionPlan {
    const routerMode = this.getRouterMode();
    const taskType = TaskRouter.detectTask(request);

    let targetProvider: AIProvider | undefined;
    let targetModel: AIModel | undefined;
    let targetKey: AIProviderKey | undefined;
    let selectedScore = 0;

    if (routerMode === 'forced') {
      // 1. FORCED MODE: Use explicitly configured LLM_PROVIDER or request.preferredProvider
      const forcedProviderId = (
        request.preferredProvider ||
        process.env.LLM_PROVIDER ||
        'nvidia'
      ).trim().toLowerCase();

      targetProvider = ProviderRegistry.getProvider(forcedProviderId);
      if (!targetProvider) {
        throw new Error(`[AIOrchestrator] Forced provider "${forcedProviderId}" is not registered.`);
      }

      const modelId = request.preferredModel || targetProvider.defaultModel;
      targetModel = ModelRegistry.getModel(modelId, targetProvider.id) || {
        id: modelId,
        name: modelId,
        providerId: targetProvider.id,
        contextWindow: 128000,
        capabilities: [
          'chat',
          'coding',
          'debugging',
          'architecture',
          'security',
          'documentation',
          'testing',
          'reasoning',
          'streaming',
          'structured_json',
        ],
        priority: 10,
        enabled: true,
      };

      targetKey = KeyManager.getKey(targetProvider.id);
      selectedScore = 100;
    } else {
      // 2. AUTO MODE: Capability-based ranking & intelligent selection
      const requiredCap = TaskRouter.getRequiredCapabilityForTask(taskType);
      const needsStreaming = Boolean(request.stream);
      const needsJson = Boolean(
        request.requiresJson ||
        ['architecture', 'security', 'debugging', 'impact_analysis'].includes(taskType) ||
        (request.userMessage && request.userMessage.toLowerCase().includes('json'))
      );

      const allModels = ModelRegistry.getAllModels().filter((m) => m.enabled);
      const candidates: Array<{
        model: AIModel;
        provider: AIProvider;
        key: AIProviderKey;
        score: number;
      }> = [];

      for (const model of allModels) {
        // Capability filter
        if (!model.capabilities.includes(requiredCap)) continue;
        if (needsStreaming && !model.capabilities.includes('streaming')) continue;
        if (needsJson && !model.capabilities.includes('structured_json')) continue;

        // Provider check
        const provider = ProviderRegistry.getProvider(model.providerId);
        if (!provider || !provider.enabled) continue;

        // Key check
        if (!KeyManager.hasKeys(provider.id)) continue;
        const key = KeyManager.getKey(provider.id);
        if (!key) continue;

        // Deterministic candidate scoring:
        // - Model Priority (primary, weight: 100x)
        // - Provider Priority (secondary bonus, lower priority rank = higher bonus)
        const modelScore = model.priority * 100;
        const providerScore = Math.max(0, (10 - provider.priority) * 10);
        const totalScore = modelScore + providerScore;

        candidates.push({
          model,
          provider,
          key,
          score: totalScore,
        });
      }

      if (candidates.length > 0) {
        // Sort descending by score and pick highest-scoring candidate
        candidates.sort((a, b) => b.score - a.score);
        const best = candidates[0];
        targetModel = best.model;
        targetProvider = best.provider;
        targetKey = best.key;
        selectedScore = best.score;
      } else {
        // Fallback to highest priority enabled provider with keys
        const enabledProviders = ProviderRegistry.getEnabledProviders();
        for (const provider of enabledProviders) {
          if (KeyManager.hasKeys(provider.id)) {
            targetProvider = provider;
            targetModel = ModelRegistry.getModel(provider.defaultModel, provider.id);
            targetKey = KeyManager.getKey(provider.id);
            selectedScore = 50;
            break;
          }
        }
      }
    }

    if (!targetProvider) {
      throw new Error('[AIOrchestrator] No AI provider available in the registry.');
    }

    if (!targetModel) {
      targetModel = {
        id: targetProvider.defaultModel,
        name: targetProvider.defaultModel,
        providerId: targetProvider.id,
        contextWindow: 128000,
        capabilities: [
          'chat',
          'coding',
          'debugging',
          'architecture',
          'security',
          'documentation',
          'testing',
          'reasoning',
          'streaming',
          'structured_json',
        ],
        priority: 10,
        enabled: true,
      };
    }

    // If key not found in pool, construct a placeholder key metadata
    if (!targetKey) {
      targetKey = {
        id: `${targetProvider.id}-key-missing`,
        providerId: targetProvider.id,
        key: '',
        index: 0,
      };
    }

    return {
      provider: targetProvider,
      model: targetModel,
      key: targetKey,
      routerMode,
      taskType,
      score: selectedScore,
    };
  }

  /**
   * Stream a chat completion through the orchestrated provider and key.
   */
  public static async *streamChat(
    request: OrchestratorRequest
  ): AsyncGenerator<string, void, unknown> {
    const routerMode = this.getRouterMode();

    if (routerMode === 'auto') {
      for await (const token of MultiModelOrchestrator.stream(request)) {
        yield token;
      }
      return;
    }

    // Forced mode: single model direct streaming
    const plan = this.planExecution(request);
    console.log(`[AI] Task=${plan.taskType} Provider=${plan.provider.id} Model=${plan.model.id} Key=${plan.key.id}`);

    const context: ExecutionContext = {
      apiKey: plan.key.key || undefined,
      baseURL: plan.provider.baseUrl,
      model: plan.model.id,
      providerName: plan.provider.name,
      keyId: plan.key.id,
    };

    for await (const token of OpenAIService.streamChat(
      request.systemPrompt,
      request.userMessage,
      request.conversationHistory || [],
      context
    )) {
      yield token;
    }
  }

  /**
   * Non-streaming direct text/JSON generation through the orchestrated provider and key.
   */
  public static async generate(request: OrchestratorRequest): Promise<string> {
    const routerMode = this.getRouterMode();

    if (routerMode === 'auto') {
      return await MultiModelOrchestrator.execute(request);
    }

    // Forced mode: single model direct generation
    const plan = this.planExecution(request);
    console.log(`[AI] Task=${plan.taskType} Provider=${plan.provider.id} Model=${plan.model.id} Key=${plan.key.id}`);

    const context: ExecutionContext = {
      apiKey: plan.key.key || undefined,
      baseURL: plan.provider.baseUrl,
      model: plan.model.id,
      providerName: plan.provider.name,
      keyId: plan.key.id,
    };

    return await OpenAIService.generate(
      request.systemPrompt,
      request.userMessage,
      request.maxTokens || 2048,
      context
    );
  }

  /**
   * Convenience helper for direct prompt completion.
   */
  public static async generateText(prompt: string, taskType: TaskType = 'general'): Promise<string> {
    return this.generate({
      systemPrompt: 'You are an expert AI software engineering and evaluation assistant.',
      userMessage: prompt,
      taskType,
    });
  }
}



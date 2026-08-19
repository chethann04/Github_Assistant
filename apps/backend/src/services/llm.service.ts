import { GeminiService } from './gemini.service.js';
import { OpenAIService } from './openai.service.js';
import { ProviderRouter } from '../ai/provider-router.js';
import { getNormalizedProviders } from '../ai/provider-config.js';
import { TaskType } from '../ai/index.js';
import { config } from '../config/env.js';

export type LLMProviderType = 'gemini' | 'openai' | 'nvidia' | 'openrouter' | 'dual' | 'auto';

export interface StreamChatOptions {
  systemPrompt: string;
  userMessage: string;
  conversationHistory?: Array<{ role: 'user' | 'model'; parts: string }>;
  provider?: LLMProviderType;
  rawContextText?: string;
  taskType?: TaskType;
  onEvent?: (event: { type: string; provider: string; model: string; message?: string }) => void;
}

export class LLMService {
  /**
   * Determine available providers
   */
  public static getAvailableProviders(): {
    gemini: boolean;
    openai: boolean;
    activeDefault: LLMProviderType;
    isNvidia: boolean;
    isOpenRouter: boolean;
    openaiModel: string;
    geminiModel: string;
    providers: Array<{ id: string; name: string; model: string; priority: number }>;
  } {
    const normalized = getNormalizedProviders();
    const hasNvidia = normalized.some((p) => p.id === 'nvidia');
    const hasOpenRouter = normalized.some((p) => p.id === 'openrouter');
    const hasOpenAI = normalized.some((p) => p.id === 'openai' || p.id === 'nvidia' || p.id === 'openrouter');
    const hasGemini = normalized.some((p) => p.id === 'gemini');

    const activeDefault: LLMProviderType = (config.llmProvider as LLMProviderType) || 'openrouter';

    return {
      gemini: hasGemini,
      openai: hasOpenAI,
      activeDefault,
      isNvidia: hasNvidia,
      isOpenRouter: hasOpenRouter,
      openaiModel: config.openaiModel || 'z-ai/glm-5.2',
      geminiModel: config.geminiModel,
      providers: normalized.map((p) => ({
        id: p.id,
        name: p.name,
        model: p.model,
        priority: p.priority,
      })),
    };
  }

  /**
   * Unified streaming chat with automatic multi-provider fallback and accurate identity resolution.
   */
  public static async *streamChat(options: StreamChatOptions): AsyncGenerator<string, void, unknown> {
    const {
      systemPrompt,
      userMessage,
      conversationHistory = [],
      provider = (config.llmProvider as LLMProviderType) || 'openrouter',
      rawContextText = '',
      onEvent,
    } = options;

    for await (const token of ProviderRouter.streamChat({
      systemPrompt,
      userMessage,
      conversationHistory,
      preferredProvider: provider,
      rawContextText,
      onEvent,
    })) {
      yield token;
    }
  }

  /**
   * Non-streaming direct generation with automatic multi-provider fallback and task-based routing.
   */
  public static async generate(
    systemPrompt: string,
    userMessage: string,
    preferredProvider?: LLMProviderType,
    maxTokens: number = 2048,
    taskType?: TaskType
  ): Promise<string> {
    return await ProviderRouter.generate({
      systemPrompt,
      userMessage,
      preferredProvider: preferredProvider || (config.llmProvider as LLMProviderType) || 'openrouter',
      maxTokens,
    });
  }

}

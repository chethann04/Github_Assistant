import { OpenAIService, ExecutionContext } from '../services/openai.service.js';
import { GeminiService } from '../services/gemini.service.js';
import {
  getNormalizedProviders,
  classifyProviderError,
  NormalizedProviderConfig,
  resolveProviderName,
} from './provider-config.js';

export interface ProviderRouterStreamOptions {
  systemPrompt: string;
  userMessage: string;
  conversationHistory?: Array<{ role: 'user' | 'model'; parts: string }>;
  preferredProvider?: string;
  rawContextText?: string;
  onEvent?: (event: { type: string; provider: string; model: string; message?: string }) => void;
}

export interface ProviderRouterGenerateOptions {
  systemPrompt: string;
  userMessage: string;
  conversationHistory?: Array<{ role: 'user' | 'model'; parts: string }>;
  preferredProvider?: string;
  maxTokens?: number;
}

/**
 * ProviderRouter — Universal multi-provider orchestrator with automatic fallback,
 * bounded retries, and accurate provider identity resolution.
 */
export class ProviderRouter {
  /**
   * Streams chat completion with automatic provider fallback on recoverable errors.
   */
  public static async *streamChat(options: ProviderRouterStreamOptions): AsyncGenerator<string, void, unknown> {
    const { systemPrompt, userMessage, conversationHistory = [], preferredProvider, onEvent } = options;

    let providers = getNormalizedProviders();

    if (providers.length === 0) {
      yield '⚠️ No AI providers are configured with a valid API key. Please check your environment configuration.';
      return;
    }

    // If preferredProvider is requested and enabled, boost it to first position
    if (preferredProvider && preferredProvider !== 'auto' && preferredProvider !== 'dual') {
      const idx = providers.findIndex((p) => p.id === preferredProvider);
      if (idx > 0) {
        const [preferred] = providers.splice(idx, 1);
        providers.unshift(preferred);
      }
    }

    let lastError: any = null;

    for (let pIdx = 0; pIdx < providers.length; pIdx++) {
      const provider = providers[pIdx];
      const maxRetries = 2; // 1 attempt + 1 retry per provider

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(
          `[AI] Provider: ${provider.name} | Model: ${provider.model} | BaseURL: ${provider.baseUrl} | Stream: true | Attempt: ${attempt}`
        );

        if (onEvent) {
          onEvent({
            type: attempt === 1 ? 'provider_attempt' : 'provider_retry',
            provider: provider.name,
            model: provider.model,
            message: `Connecting to ${provider.name}...`,
          });
        }

        let buffer = '';
        let streamSuccess = false;

        try {
          if (provider.adapter === 'gemini') {
            for await (const token of GeminiService.streamChat(systemPrompt, userMessage, conversationHistory)) {
              buffer += token;
              yield token;
            }
            streamSuccess = true;
            return;
          } else {
            // OpenAI-compatible adapter (NVIDIA NIM, OpenRouter, OpenAI, etc.)
            const context: ExecutionContext = {
              apiKey: provider.apiKey,
              baseURL: provider.baseUrl,
              model: provider.model,
              providerName: provider.name,
            };

            for await (const token of OpenAIService.streamChat(
              systemPrompt,
              userMessage,
              conversationHistory,
              context
            )) {
              buffer += token;
              yield token;
            }
            streamSuccess = true;
            return;
          }
        } catch (err: any) {
          lastError = err;
          const classification = classifyProviderError(err);

          console.warn(
            `[AI] Error attempt=${attempt} provider=${provider.name} model=${provider.model} type=${classification.type} status=${classification.status || 'error'} msg="${err?.message?.substring(0, 100)}"`
          );

          // If recoverable and has retries remaining on this provider
          if (classification.isRecoverable && attempt < maxRetries && classification.type !== 'AUTH_ERROR' && classification.type !== 'INSUFFICIENT_CREDITS') {
            await new Promise((r) => setTimeout(r, 1000 * attempt));
            continue; // Retry current provider
          }

          // Otherwise fall through to next provider
          break;
        }
      }

      // If there is another provider available to try
      if (pIdx < providers.length - 1) {
        const nextProvider = providers[pIdx + 1];
        const classification = classifyProviderError(lastError);

        console.log(
          `[AI] 🔄 Fallback: Switching from ${provider.name} to ${nextProvider.name} due to ${classification.type}...`
        );

        if (onEvent) {
          onEvent({
            type: 'provider_fallback',
            provider: nextProvider.name,
            model: nextProvider.model,
            message: `Falling back from ${provider.name} to ${nextProvider.name}...`,
          });
        }
      }
    }

    // If all providers failed
    const classification = classifyProviderError(lastError);
    yield `\n\n*[All configured AI providers failed to generate a response. Reason: ${classification.message}]*`;
  }

  /**
   * Generates non-streaming completion with automatic provider fallback on recoverable errors.
   */
  public static async generate(options: ProviderRouterGenerateOptions): Promise<string> {
    const { systemPrompt, userMessage, conversationHistory = [], preferredProvider, maxTokens = 2048 } = options;

    let providers = getNormalizedProviders();
    if (providers.length === 0) {
      throw new Error('No AI providers are configured with a valid API key.');
    }

    if (preferredProvider && preferredProvider !== 'auto' && preferredProvider !== 'dual') {
      const idx = providers.findIndex((p) => p.id === preferredProvider);
      if (idx > 0) {
        const [preferred] = providers.splice(idx, 1);
        providers.unshift(preferred);
      }
    }

    let lastError: any = null;

    for (let pIdx = 0; pIdx < providers.length; pIdx++) {
      const provider = providers[pIdx];
      const maxRetries = 2;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(
          `[AI] Provider: ${provider.name} | Model: ${provider.model} | BaseURL: ${provider.baseUrl} | Stream: false | Attempt: ${attempt}`
        );

        try {
          if (provider.adapter === 'gemini') {
            return await GeminiService.generate(systemPrompt, userMessage);
          } else {
            const context: ExecutionContext = {
              apiKey: provider.apiKey,
              baseURL: provider.baseUrl,
              model: provider.model,
              providerName: provider.name,
            };
            return await OpenAIService.generate(systemPrompt, userMessage, maxTokens, context);
          }
        } catch (err: any) {
          lastError = err;
          const classification = classifyProviderError(err);
          console.warn(
            `[AI] Error attempt=${attempt} provider=${provider.name} model=${provider.model} type=${classification.type} msg="${err?.message?.substring(0, 100)}"`
          );

          if (classification.isRecoverable && attempt < maxRetries && classification.type !== 'AUTH_ERROR' && classification.type !== 'INSUFFICIENT_CREDITS') {
            await new Promise((r) => setTimeout(r, 1000 * attempt));
            continue;
          }
          break;
        }
      }

      if (pIdx < providers.length - 1) {
        const nextProvider = providers[pIdx + 1];
        const classification = classifyProviderError(lastError);
        console.log(
          `[AI] 🔄 Fallback: Switching from ${provider.name} to ${nextProvider.name} due to ${classification.type}...`
        );
      }
    }

    throw lastError || new Error('All configured AI providers failed.');
  }
}

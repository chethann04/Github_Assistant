import { OpenAIService, ExecutionContext } from '../services/openai.service.js';
import { GeminiService } from '../services/gemini.service.js';
import {
  getNormalizedProviders,
  classifyProviderError,
  NormalizedProviderConfig,
  resolveProviderName,
} from './provider-config.js';
import { ProviderHealthManager } from './provider-health.js';
import { config } from '../config/env.js';

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
 * provider-specific cooldown management, bounded retries, and accurate provider identity resolution.
 * Chatbot Priority Order: OpenRouter > NVIDIA NIM > Google Gemini > OpenAI
 */
export class ProviderRouter {
  /**
   * Helper to log provider-specific success message
   */
  private static logProviderSuccess(providerId: string, isFallback: boolean): void {
    if (providerId === 'openrouter') {
      console.log('[AI] OpenRouter request successful');
    } else if (providerId === 'nvidia') {
      console.log('[AI] NVIDIA NIM request successful');
    } else if (providerId === 'gemini') {
      console.log(isFallback ? '[AI] Gemini fallback request successful' : '[AI] Google Gemini request successful');
    } else if (providerId === 'openai') {
      console.log('[AI] OpenAI request successful');
    }
  }

  /**
   * Streams chat completion with automatic provider fallback on recoverable errors.
   */
  public static async *streamChat(options: ProviderRouterStreamOptions): AsyncGenerator<string, void, unknown> {
    const { systemPrompt, userMessage, conversationHistory = [], preferredProvider, onEvent } = options;

    // 1. Check & restore any expired provider cooldowns
    ProviderHealthManager.checkAndRestoreProviders();

    let providers = getNormalizedProviders();

    if (providers.length === 0) {
      yield '⚠️ No AI providers are configured with a valid API key. Please check your environment configuration.';
      return;
    }

    // If preferredProvider is explicitly requested and enabled (and not auto/dual), prioritize it
    if (preferredProvider && preferredProvider !== 'auto' && preferredProvider !== 'dual') {
      const idx = providers.findIndex((p) => p.id === preferredProvider);
      if (idx > 0) {
        const [preferred] = providers.splice(idx, 1);
        providers.unshift(preferred);
      }
    }

    // 2. Filter out providers in active cooldown and log bypass
    const availableProviders: NormalizedProviderConfig[] = [];
    for (const p of providers) {
      if (ProviderHealthManager.isProviderInCooldown(p.id)) {
        const remainingMs = ProviderHealthManager.getCooldownRemainingMs(p.id);
        console.log(`[AI] ${p.name} is temporarily rate-limited`);
        console.log(`[AI] Cooldown active for ${remainingMs}ms`);
      } else {
        availableProviders.push(p);
      }
    }

    if (availableProviders.length === 0) {
      yield '⚠️ All configured AI providers are currently in cooldown. Please wait a few moments and try again.';
      return;
    }

    let lastError: any = null;

    for (let pIdx = 0; pIdx < availableProviders.length; pIdx++) {
      const provider = availableProviders[pIdx];
      const nextProvider = pIdx < availableProviders.length - 1 ? availableProviders[pIdx + 1] : null;
      const isFastFailProvider = provider.id === 'openrouter' || provider.id === 'nvidia';
      const maxRetries = isFastFailProvider ? 1 : 2;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`[AI] Provider: ${provider.name} | Model: ${provider.model} | Attempt: ${attempt}`);

        if (onEvent) {
          onEvent({
            type: attempt === 1 ? 'provider_attempt' : 'provider_retry',
            provider: provider.name,
            model: provider.model,
            message: `Connecting to ${provider.name}...`,
          });
        }

        let yieldedAny = false;

        try {
          if (provider.adapter === 'gemini') {
            for await (const token of GeminiService.streamChat(systemPrompt, userMessage, conversationHistory)) {
              yieldedAny = true;
              yield token;
            }

            this.logProviderSuccess(provider.id, pIdx > 0 || availableProviders.length < providers.length);
            return;
          } else {
            // OpenAI-compatible adapter (OpenRouter, NVIDIA NIM, OpenAI)
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
              yieldedAny = true;
              yield token;
            }

            this.logProviderSuccess(provider.id, pIdx > 0 || availableProviders.length < providers.length);
            return;
          }
        } catch (err: any) {
          lastError = err;
          const classification = classifyProviderError(err);

          // 1. Handle HTTP 429 Rate Limit (Immediate Fallback, activate cooldown, no retries)
          if (classification.type === 'RATE_LIMIT' || classification.status === 429) {
            const cooldown = ProviderHealthManager.markProviderUnavailable(provider.id, '429 RATE_LIMIT', 429);
            const durationSec = Math.round(cooldown.durationMs / 1000);
            console.log(`[AI] ${provider.name} returned 429 RATE_LIMIT`);
            console.log(`[AI] ${provider.name} cooldown activated for ${durationSec}s`);
            if (nextProvider) {
              console.log(`[AI] Fallback: Switching to ${nextProvider.name}`);
            }
            break;
          }

          // 2. Handle HTTP 402 Insufficient Credits (Immediate Fallback, disable provider temporarily)
          if (classification.type === 'INSUFFICIENT_CREDITS' || classification.status === 402) {
            const cooldown = ProviderHealthManager.markProviderUnavailable(provider.id, '402 INSUFFICIENT_CREDITS', 402);
            const durationSec = Math.round(cooldown.durationMs / 1000);
            console.log(`[AI] ${provider.name} returned 402 INSUFFICIENT_CREDITS`);
            console.log(`[AI] ${provider.name} temporarily disabled for ${durationSec}s`);
            if (nextProvider) {
              console.log(`[AI] Fallback: Switching to ${nextProvider.name}`);
            }
            break;
          }

          // 3. Handle Auth & Permission & Bad Request (no retries)
          if (
            classification.type === 'AUTH_ERROR' ||
            classification.type === 'PERMISSION_DENIED' ||
            classification.type === 'INVALID_REQUEST'
          ) {
            console.warn(
              `[AI] ${provider.name} error type=${classification.type} status=${classification.status || 'error'}: ${err?.message || classification.message}`
            );
            if (nextProvider) {
              console.log(`[AI] Fallback: Switching to ${nextProvider.name}`);
            }
            break;
          }

          // 4. Handle recoverable 5xx / timeout / network errors
          console.warn(
            `[AI] Error attempt=${attempt} provider=${provider.name} model=${provider.model} type=${classification.type} msg="${err?.message?.substring(0, 100)}"`
          );

          if (classification.isRecoverable && attempt < maxRetries && !yieldedAny) {
            await new Promise((r) => setTimeout(r, 1000 * attempt));
            continue;
          }

          if (nextProvider) {
            console.log(`[AI] Fallback: Switching to ${nextProvider.name} due to ${classification.type}...`);
          }
          break;
        }
      }

      if (nextProvider && onEvent) {
        onEvent({
          type: 'provider_fallback',
          provider: nextProvider.name,
          model: nextProvider.model,
          message: `Falling back from ${provider.name} to ${nextProvider.name}...`,
        });
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

    // 1. Check & restore any expired provider cooldowns
    ProviderHealthManager.checkAndRestoreProviders();

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

    // 2. Filter out providers in active cooldown
    const availableProviders: NormalizedProviderConfig[] = [];
    for (const p of providers) {
      if (ProviderHealthManager.isProviderInCooldown(p.id)) {
        const remainingMs = ProviderHealthManager.getCooldownRemainingMs(p.id);
        console.log(`[AI] ${p.name} is temporarily rate-limited`);
        console.log(`[AI] Cooldown active for ${remainingMs}ms`);
      } else {
        availableProviders.push(p);
      }
    }

    if (availableProviders.length === 0) {
      throw new Error('All configured AI providers are currently in cooldown. Please wait a few moments and try again.');
    }

    let lastError: any = null;

    for (let pIdx = 0; pIdx < availableProviders.length; pIdx++) {
      const provider = availableProviders[pIdx];
      const nextProvider = pIdx < availableProviders.length - 1 ? availableProviders[pIdx + 1] : null;
      const isFastFailProvider = provider.id === 'openrouter' || provider.id === 'nvidia';
      const maxRetries = isFastFailProvider ? 1 : 2;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`[AI] Provider: ${provider.name} | Model: ${provider.model} | Attempt: ${attempt}`);

        try {
          if (provider.adapter === 'gemini') {
            const result = await GeminiService.generate(systemPrompt, userMessage);
            this.logProviderSuccess(provider.id, pIdx > 0 || availableProviders.length < providers.length);
            return result;
          } else {
            const context: ExecutionContext = {
              apiKey: provider.apiKey,
              baseURL: provider.baseUrl,
              model: provider.model,
              providerName: provider.name,
            };
            const result = await OpenAIService.generate(systemPrompt, userMessage, maxTokens, context);
            this.logProviderSuccess(provider.id, pIdx > 0 || availableProviders.length < providers.length);
            return result;
          }
        } catch (err: any) {
          lastError = err;
          const classification = classifyProviderError(err);

          // 1. Handle HTTP 429 Rate Limit (Immediate Fallback, activate cooldown, no retries)
          if (classification.type === 'RATE_LIMIT' || classification.status === 429) {
            const cooldown = ProviderHealthManager.markProviderUnavailable(provider.id, '429 RATE_LIMIT', 429);
            const durationSec = Math.round(cooldown.durationMs / 1000);
            console.log(`[AI] ${provider.name} returned 429 RATE_LIMIT`);
            console.log(`[AI] ${provider.name} cooldown activated for ${durationSec}s`);
            if (nextProvider) {
              console.log(`[AI] Fallback: Switching to ${nextProvider.name}`);
            }
            break;
          }

          // 2. Handle HTTP 402 Insufficient Credits (Immediate Fallback, disable provider temporarily)
          if (classification.type === 'INSUFFICIENT_CREDITS' || classification.status === 402) {
            const cooldown = ProviderHealthManager.markProviderUnavailable(provider.id, '402 INSUFFICIENT_CREDITS', 402);
            const durationSec = Math.round(cooldown.durationMs / 1000);
            console.log(`[AI] ${provider.name} returned 402 INSUFFICIENT_CREDITS`);
            console.log(`[AI] ${provider.name} temporarily disabled for ${durationSec}s`);
            if (nextProvider) {
              console.log(`[AI] Fallback: Switching to ${nextProvider.name}`);
            }
            break;
          }

          // 3. Handle Auth & Permission & Bad Request (no retries)
          if (
            classification.type === 'AUTH_ERROR' ||
            classification.type === 'PERMISSION_DENIED' ||
            classification.type === 'INVALID_REQUEST'
          ) {
            console.warn(
              `[AI] ${provider.name} error type=${classification.type} status=${classification.status || 'error'}: ${err?.message || classification.message}`
            );
            if (nextProvider) {
              console.log(`[AI] Fallback: Switching to ${nextProvider.name}`);
            }
            break;
          }

          // 4. Handle recoverable 5xx / timeout / network errors
          console.warn(
            `[AI] Error attempt=${attempt} provider=${provider.name} model=${provider.model} type=${classification.type} msg="${err?.message?.substring(0, 100)}"`
          );

          if (classification.isRecoverable && attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, 1000 * attempt));
            continue;
          }

          if (nextProvider) {
            console.log(`[AI] Fallback: Switching to ${nextProvider.name} due to ${classification.type}...`);
          }
          break;
        }
      }
    }

    throw lastError || new Error('All configured AI providers failed.');
  }
}


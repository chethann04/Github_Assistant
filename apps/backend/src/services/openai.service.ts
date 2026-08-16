import OpenAI from 'openai';
import { config } from '../config/env.js';

export interface OpenAILLMError {
  code: 'LLM_TEMPORARILY_UNAVAILABLE' | 'LLM_RATE_LIMITED' | 'LLM_TIMEOUT' | 'LLM_ERROR';
  message: string;
}

export class OpenAIService {
  private static client: OpenAI | null =
    config.openaiApiKey && config.openaiApiKey.length > 10
      ? new OpenAI({
          apiKey: config.openaiApiKey,
          baseURL: config.openaiBaseUrl || undefined,
        })
      : null;

  private static candidateModels = config.isNvidiaProvider
    ? Array.from(new Set([config.openaiModel, 'z-ai/glm-5.2']))
    : [config.openaiModel, 'gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'];

  /**
   * Helper to check if OpenAI/NVIDIA is configured.
   */
  public static isConfigured(): boolean {
    return Boolean(this.client);
  }

  /**
   * Helper to determine if an error is transient and retryable (503, 429, timeout, network error).
   */
  private static isTransientError(err: any): { isTransient: boolean; status?: number; code?: string; isRateLimit: boolean } {
    const status = err?.status || err?.response?.status || err?.code;
    const msg = (err?.message || '').toLowerCase();

    if (status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('rate limit') || msg.includes('too many requests')) {
      return { isTransient: true, status: 429, code: 'LLM_RATE_LIMITED', isRateLimit: true };
    }
    if (status === 503 || status === 502 || msg.includes('503') || msg.includes('502') || msg.includes('service unavailable') || msg.includes('overloaded')) {
      return { isTransient: true, status: 503, code: 'LLM_TEMPORARILY_UNAVAILABLE', isRateLimit: false };
    }
    if (msg.includes('timeout') || msg.includes('etimedout') || msg.includes('econnreset') || msg.includes('fetch failed')) {
      return { isTransient: true, status: 408, code: 'LLM_TIMEOUT', isRateLimit: false };
    }

    return { isTransient: false, status: typeof status === 'number' ? status : undefined, isRateLimit: false };
  }

  /**
   * Extract Retry-After header and compute bounded retry delay.
   */
  private static getRetryDelay(err: any, attempt: number, maxDelayMs: number = 3000): { delayMs: number; canRetry: boolean } {
    const retryHeader =
      err?.headers?.['retry-after'] ||
      err?.response?.headers?.get?.('retry-after') ||
      err?.response?.headers?.['retry-after'];

    if (retryHeader) {
      const parsedSeconds = parseInt(String(retryHeader), 10);
      if (!isNaN(parsedSeconds)) {
        if (parsedSeconds > 5) {
          // If provider asks to wait > 5s, do not stall user request; fail fast with clear error
          return { delayMs: 0, canRetry: false };
        }
        return { delayMs: Math.min(parsedSeconds * 1000, maxDelayMs), canRetry: true };
      }
    }

    // Default bounded exponential backoff
    const computedDelay = Math.min(1000 * Math.pow(1.5, attempt - 1), maxDelayMs);
    return { delayMs: computedDelay, canRetry: true };
  }

  /**
   * Maps internal errors to clean, safe user-facing error messages without exposing keys.
   */
  public static mapUserFriendlyError(err: any): OpenAILLMError {
    const { status, code } = this.isTransientError(err);
    const isNvidia = config.isNvidiaProvider;
    const providerName = isNvidia ? 'NVIDIA NIM (GLM-5.2)' : 'ChatGPT';

    if (status === 401 || err?.message?.includes('401') || err?.message?.toLowerCase().includes('auth') || err?.message?.toLowerCase().includes('api key')) {
      return {
        code: 'LLM_ERROR',
        message: isNvidia
          ? 'NVIDIA GLM-5.2 authentication failed. Please verify your NVIDIA_API_KEY.'
          : 'OpenAI authentication failed. Please check your API key.',
      };
    }
    if (status === 404 || err?.message?.includes('404')) {
      return {
        code: 'LLM_ERROR',
        message: isNvidia
          ? `NVIDIA model "${config.openaiModel}" not found or unsupported on NVIDIA NIM.`
          : 'OpenAI model not found.',
      };
    }
    if (status === 429 || code === 'LLM_RATE_LIMITED') {
      return {
        code: 'LLM_RATE_LIMITED',
        message: `${providerName} rate limit reached (HTTP 429). Please wait a few moments and try again.`,
      };
    }
    if (status === 503 || code === 'LLM_TEMPORARILY_UNAVAILABLE') {
      return {
        code: 'LLM_TEMPORARILY_UNAVAILABLE',
        message: `${providerName} service is temporarily unavailable. Please try again.`,
      };
    }
    if (status === 408 || code === 'LLM_TIMEOUT') {
      return {
        code: 'LLM_TIMEOUT',
        message: `${providerName} request timed out. Please try again.`,
      };
    }

    return {
      code: 'LLM_ERROR',
      message: err?.message || `${providerName} encountered an unexpected error. Please try again.`,
    };
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Format history for OpenAI/NVIDIA chat completions
   */
  private static formatMessages(
    systemPrompt: string,
    userMessage: string,
    conversationHistory: Array<{ role: 'user' | 'model'; parts: string }> = []
  ): OpenAI.Chat.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    for (const item of conversationHistory) {
      if (!item.parts || !item.parts.trim()) continue;
      messages.push({
        role: item.role === 'model' ? 'assistant' : 'user',
        content: item.parts.trim(),
      });
    }

    messages.push({ role: 'user', content: userMessage });
    return messages;
  }

  /**
   * Stream a chat response using NVIDIA NIM / OpenAI with bounded retry policy.
   */
  public static async *streamChat(
    systemPrompt: string,
    userMessage: string,
    conversationHistory: Array<{ role: 'user' | 'model'; parts: string }> = []
  ): AsyncGenerator<string, void, unknown> {
    if (!this.client) {
      yield config.isNvidiaProvider
        ? 'NVIDIA API key is not configured. Please set NVIDIA_API_KEY in apps/backend/.env.'
        : 'OpenAI API key is not configured. Please set OPENAI_API_KEY in apps/backend/.env.';
      return;
    }

    const messages = this.formatMessages(systemPrompt, userMessage, conversationHistory);
    const modelsToTry = [config.openaiModel]; // Stick to primary configured model
    const maxRetries = 2; // Bounded: 1 attempt + 1 retry max
    const overallStartTime = Date.now();
    const maxBudgetMs = 75000; // 75s total budget ceiling for reliable inference

    let lastError: any = null;

    for (const modelName of modelsToTry) {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        if (Date.now() - overallStartTime > maxBudgetMs) {
          break; // Stop immediately if overall wait budget is reached
        }

        const startTime = Date.now();
        console.log(`[AI] Provider: ${config.isNvidiaProvider ? 'NVIDIA NIM' : 'OpenAI'} | Model: ${modelName} | BaseURL: ${config.openaiBaseUrl || 'default'} | Stream: true | Attempt: ${attempt}`);

        try {
          const stream = await this.client.chat.completions.create({
            model: modelName,
            messages,
            temperature: 0.2,
            stream: true,
          });

          let yieldedAny = false;
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              yieldedAny = true;
              yield content;
            }
          }

          const elapsed = Date.now() - startTime;
          console.log(`[AI] Response finished successfully (${elapsed}ms)`);

          if (yieldedAny) {
            return;
          }
        } catch (err: any) {
          lastError = err;
          const { isTransient, status, isRateLimit } = this.isTransientError(err);
          const { delayMs, canRetry } = this.getRetryDelay(err, attempt);

          console.log(`[AI] Error attempt=${attempt} model=${modelName} status=${status || 'error'} msg="${err?.message?.substring(0, 120)}" retrying=${isTransient && attempt < maxRetries && canRetry}`);

          if (!isTransient || attempt >= maxRetries || !canRetry) {
            break;
          }

          if (delayMs > 0) {
            await this.sleep(delayMs);
          }
        }
      }
    }

    const friendly = this.mapUserFriendlyError(lastError);
    yield `\n\n*${friendly.message}*`;
  }

  /**
   * Non-streaming direct generation with NVIDIA / OpenAI with bounded retry policy.
   */
  public static async generate(systemPrompt: string, userMessage: string, maxTokens: number = 2048): Promise<string> {
    if (!this.client) {
      throw new Error(
        config.isNvidiaProvider
          ? 'NVIDIA API key not configured. Please set NVIDIA_API_KEY in your environment.'
          : 'OpenAI API key not configured. Please set OPENAI_API_KEY in your environment.'
      );
    }

    const messages = this.formatMessages(systemPrompt, userMessage);
    const modelsToTry = [config.openaiModel]; // Primary model
    const maxRetries = 2; // Bounded: 1 attempt + 1 retry max
    const overallStartTime = Date.now();
    const maxBudgetMs = 28000; // 28s total budget ceiling
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        if (Date.now() - overallStartTime > maxBudgetMs) {
          break; // Hard ceiling stop
        }

        const startTime = Date.now();
        console.log(`[AI] Provider: ${config.isNvidiaProvider ? 'NVIDIA NIM' : 'OpenAI'} | Model: ${modelName} | BaseURL: ${config.openaiBaseUrl || 'default'} | Non-stream | Attempt: ${attempt}`);

        try {
          const stream = await this.client.chat.completions.create({
            model: modelName,
            messages,
            temperature: 0.2,
            max_tokens: maxTokens,
            stream: true,
          });

          let fullContent = '';
          let firstTokenTime: number | null = null;

          for await (const chunk of stream) {
            const token = chunk.choices[0]?.delta?.content || '';
            if (token) {
              if (firstTokenTime === null) {
                firstTokenTime = Date.now();
                const ttft = ((firstTokenTime - startTime) / 1000).toFixed(2);
                console.log(`[AI] TTFT: ${ttft}s (first token received)`);
              }
              fullContent += token;
            }
          }

          const elapsed = Date.now() - startTime;
          console.log(`[AI] Streaming generation complete (${elapsed}ms, ${fullContent.length} chars)`);
          if (fullContent.trim().length > 0) return fullContent;
        } catch (err: any) {
          lastError = err;
          const { isTransient, status } = this.isTransientError(err);
          const { delayMs, canRetry } = this.getRetryDelay(err, attempt);

          console.log(`[AI] Error attempt=${attempt} model=${modelName} status=${status || 'error'} msg="${err?.message?.substring(0, 120)}" retrying=${isTransient && attempt < maxRetries && canRetry}`);

          if (!isTransient || attempt >= maxRetries || !canRetry) {
            break;
          }

          if (delayMs > 0) {
            await this.sleep(delayMs);
          }
        }
      }
    }

    const friendly = this.mapUserFriendlyError(lastError);
    throw new Error(friendly.message);
  }

  public static async generateText(prompt: string): Promise<string> {
    return this.generate('You are an expert AI software engineering and evaluation assistant.', prompt);
  }
}

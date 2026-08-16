import { GoogleGenAI } from '@google/genai';
import { config } from '../config/env.js';

export interface LLMError {
  code: 'LLM_TEMPORARILY_UNAVAILABLE' | 'LLM_RATE_LIMITED' | 'LLM_TIMEOUT' | 'LLM_ERROR';
  message: string;
}

export class GeminiService {
  private static ai: GoogleGenAI | null =
    config.geminiApiKey && config.geminiApiKey.length > 10
      ? new GoogleGenAI({ apiKey: config.geminiApiKey })
      : null;

  private static candidateModels = [
    config.geminiModel,
    'gemini-2.5-flash',
    'gemini-2.0-flash',
  ];

  /**
   * Helper to determine if an error is transient and retryable (503, 429, timeout, network error).
   */
  private static isTransientError(err: any): { isTransient: boolean; status?: number; code?: string } {
    const status = err?.status || err?.response?.status || err?.code;
    const msg = (err?.message || '').toLowerCase();

    if (status === 503 || msg.includes('503') || msg.includes('service unavailable') || msg.includes('overloaded')) {
      return { isTransient: true, status: 503, code: 'LLM_TEMPORARILY_UNAVAILABLE' };
    }
    if (status === 429 || msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('quota') || msg.includes('rate limit')) {
      return { isTransient: true, status: 429, code: 'LLM_RATE_LIMITED' };
    }
    if (msg.includes('timeout') || msg.includes('etimedout') || msg.includes('econnreset') || msg.includes('fetch failed')) {
      return { isTransient: true, status: 408, code: 'LLM_TIMEOUT' };
    }

    return { isTransient: false };
  }

  /**
   * Maps internal errors to clean, safe user-facing error messages without exposing keys or provider JSON.
   */
  public static mapUserFriendlyError(err: any): LLMError {
    const { isTransient, status, code } = this.isTransientError(err);

    if (status === 503 || code === 'LLM_TEMPORARILY_UNAVAILABLE') {
      return {
        code: 'LLM_TEMPORARILY_UNAVAILABLE',
        message: 'AI service is temporarily unavailable. Please try again.',
      };
    }
    if (status === 429 || code === 'LLM_RATE_LIMITED') {
      return {
        code: 'LLM_RATE_LIMITED',
        message: 'AI service is temporarily rate-limited. Please try again shortly.',
      };
    }
    if (status === 408 || code === 'LLM_TIMEOUT') {
      return {
        code: 'LLM_TIMEOUT',
        message: 'The AI service took too long to respond. Please try again.',
      };
    }

    return {
      code: 'LLM_ERROR',
      message: 'AI service encountered an unexpected error. Please try again.',
    };
  }

  /**
   * Sleep helper for exponential backoff
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Normalize conversation history so roles strictly alternate between 'user' and 'model'.
   */
  private static normalizeConversation(
    history: Array<{ role: 'user' | 'model'; parts: string }>,
    currentQuery: string
  ): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
    const rawItems = [...history, { role: 'user' as const, parts: currentQuery }];
    const normalized: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    for (const item of rawItems) {
      const text = (item.parts || '').trim();
      if (!text) continue;

      if (normalized.length === 0) {
        if (item.role === 'user') {
          normalized.push({ role: 'user', parts: [{ text }] });
        }
      } else {
        const last = normalized[normalized.length - 1];
        if (last.role === item.role) {
          last.parts[0].text += `\n\n${text}`;
        } else {
          normalized.push({ role: item.role, parts: [{ text }] });
        }
      }
    }

    if (normalized.length === 0 || normalized[normalized.length - 1].role !== 'user') {
      normalized.push({ role: 'user', parts: [{ text: currentQuery }] });
    }

    return normalized;
  }

  /**
   * Stream a chat response using Gemini with exponential backoff for 503/429/timeouts and fallback models.
   */
  public static async *streamChat(
    systemPrompt: string,
    userMessage: string,
    conversationHistory: Array<{ role: 'user' | 'model'; parts: string }> = []
  ): AsyncGenerator<string, void, unknown> {
    if (!this.ai) {
      yield 'Gemini API key is not configured. Please set GEMINI_API_KEY in apps/backend/.env.';
      return;
    }

    const contents = this.normalizeConversation(conversationHistory, userMessage);
    const modelsToTry = Array.from(new Set(this.candidateModels));
    const maxRetries = 3;
    const delays = [0, 1000, 2500];

    let lastError: any = null;

    for (const modelName of modelsToTry) {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        if (attempt > 1) {
          const delay = delays[attempt - 1] || 2500;
          await this.sleep(delay);
        }

        try {
          const responseStream = await this.ai.models.generateContentStream({
            model: modelName,
            contents,
            config: {
              systemInstruction: { parts: [{ text: systemPrompt }] },
              temperature: 0.2,
              maxOutputTokens: 4096,
            },
          });

          let yieldedAny = false;
          for await (const chunk of responseStream) {
            const text = chunk.text || chunk.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (text) {
              yieldedAny = true;
              yield text;
            }
          }

          if (yieldedAny) {
            return;
          }
        } catch (err: any) {
          lastError = err;
          const { isTransient, status } = this.isTransientError(err);
          console.log(`[LLM] attempt=${attempt} provider=gemini model=${modelName} status=${status || 'error'} retrying=${isTransient && attempt < maxRetries}`);

          if (!isTransient || attempt === maxRetries) {
            break; // Try next model candidate
          }
        }
      }
    }

    const friendly = this.mapUserFriendlyError(lastError);
    yield `\n\n*${friendly.message}*`;
  }

  /**
   * Non-streaming generation for architecture/docs/bug analysis with exponential backoff.
   */
  public static async generate(systemPrompt: string, userMessage: string): Promise<string> {
    if (!this.ai) {
      throw new Error('Gemini API key not configured. Please set GEMINI_API_KEY in your environment.');
    }

    const modelsToTry = Array.from(new Set(this.candidateModels));
    const maxRetries = 3;
    const delays = [0, 1000, 2500];
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        if (attempt > 1) {
          await this.sleep(delays[attempt - 1] || 2500);
        }

        try {
          const response = await this.ai.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: userMessage }] }],
            config: {
              systemInstruction: { parts: [{ text: systemPrompt }] },
              temperature: 0.2,
              maxOutputTokens: 8192,
            },
          });

          const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) return text;
        } catch (err: any) {
          lastError = err;
          const { isTransient, status } = this.isTransientError(err);
          console.log(`[LLM] attempt=${attempt} provider=gemini model=${modelName} status=${status || 'error'} retrying=${isTransient && attempt < maxRetries}`);

          if (!isTransient || attempt === maxRetries) {
            break;
          }
        }
      }
    }

    const friendly = this.mapUserFriendlyError(lastError);
    throw new Error(friendly.message);
  }

  /**
   * Simple text prompt generation helper for benchmarks and evaluations.
   */
  public static async generateText(prompt: string): Promise<string> {
    return this.generate('You are an expert AI software engineering and evaluation assistant.', prompt);
  }

  public static isConfigured(): boolean {
    return Boolean(this.ai);
  }
}

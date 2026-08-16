import { GeminiService } from './gemini.service.js';
import { OpenAIService } from './openai.service.js';
import { config } from '../config/env.js';

export type LLMProviderType = 'gemini' | 'openai' | 'nvidia' | 'dual' | 'auto';

export interface StreamChatOptions {
  systemPrompt: string;
  userMessage: string;
  conversationHistory?: Array<{ role: 'user' | 'model'; parts: string }>;
  provider?: LLMProviderType;
  rawContextText?: string;
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
    openaiModel: string;
    geminiModel: string;
  } {
    const hasGemini = GeminiService.isConfigured();
    const hasOpenAI = OpenAIService.isConfigured();

    let activeDefault: LLMProviderType = 'gemini';
    if (config.isNvidiaProvider || config.llmProvider === 'nvidia' || config.llmProvider === 'openai') {
      activeDefault = 'nvidia';
    } else if (hasGemini && hasOpenAI) {
      activeDefault = 'dual';
    } else if (hasOpenAI && !hasGemini) {
      activeDefault = 'openai';
    } else if (hasGemini) {
      activeDefault = 'gemini';
    }

    return {
      gemini: hasGemini,
      openai: hasOpenAI,
      activeDefault,
      isNvidia: config.isNvidiaProvider,
      openaiModel: config.openaiModel,
      geminiModel: config.geminiModel,
    };
  }

  /**
   * Unified streaming chat with direct routing to configured LLM provider.
   */
  public static async *streamChat(options: StreamChatOptions): AsyncGenerator<string, void, unknown> {
    const {
      systemPrompt,
      userMessage,
      conversationHistory = [],
      provider = (config.llmProvider as LLMProviderType) || 'nvidia',
      rawContextText = '',
    } = options;

    const available = this.getAvailableProviders();

    // 1. DIRECT NVIDIA / OPENAI MODE (Primary & Sole LLM when configured)
    if (config.isNvidiaProvider || provider === 'nvidia' || provider === 'openai') {
      if (available.openai) {
        for await (const token of OpenAIService.streamChat(systemPrompt, userMessage, conversationHistory)) {
          yield token;
        }
        return;
      }
    }

    // 2. DUAL-AI ENSEMBLE VERIFIER MODE (Only when dual is explicitly enabled and NOT in NVIDIA-only mode)
    if (provider === 'dual' && !config.isNvidiaProvider && available.gemini && available.openai) {
      try {
        let draft = '';
        try {
          draft = await GeminiService.generate(systemPrompt, userMessage);
        } catch (geminiErr: any) {
          console.warn('[LLMService] Gemini draft generation failed, falling back to direct OpenAI stream:', geminiErr.message);
          for await (const token of OpenAIService.streamChat(systemPrompt, userMessage, conversationHistory)) {
            yield token;
          }
          return;
        }

        if (!draft || draft.trim().length === 0) {
          for await (const token of OpenAIService.streamChat(systemPrompt, userMessage, conversationHistory)) {
            yield token;
          }
          return;
        }

        const verifierSystemPrompt = `You are a Principal Code Reviewer & Verifier.
Your task is to verify that all cited files and logic are accurate against the codebase.
Output the verified, finalized answer.`;

        const verifierUserMessage = `=== VERIFIED CODE CONTEXT ===
${rawContextText || 'See system prompt context.'}

=== USER QUESTION ===
${userMessage}

=== INITIAL DRAFT ===
${draft}

Please produce the final verified answer:`;

        for await (const token of OpenAIService.streamChat(verifierSystemPrompt, verifierUserMessage, [])) {
          yield token;
        }
        return;
      } catch (dualErr: any) {
        console.error('[LLMService] Dual pipeline error, falling back to single model:', dualErr.message);
      }
    }

    // 3. GEMINI MODE (Only if specifically requested and Gemini is available)
    if (provider === 'gemini' && available.gemini) {
      for await (const token of GeminiService.streamChat(systemPrompt, userMessage, conversationHistory)) {
        yield token;
      }
      return;
    }

    // Fallback to OpenAI / NVIDIA
    if (available.openai) {
      for await (const token of OpenAIService.streamChat(systemPrompt, userMessage, conversationHistory)) {
        yield token;
      }
      return;
    }

    yield 'No AI provider is configured. Please configure NVIDIA_API_KEY in apps/backend/.env.';
  }

  /**
   * Non-streaming direct generation with provider selection.
   */
  public static async generate(
    systemPrompt: string,
    userMessage: string,
    preferredProvider?: LLMProviderType,
    maxTokens: number = 2048
  ): Promise<string> {
    const available = this.getAvailableProviders();
    const provider = preferredProvider || (config.llmProvider as LLMProviderType) || 'nvidia';

    // 1. Direct NVIDIA / OpenAI generation (Default & Sole LLM when configured)
    if (config.isNvidiaProvider || provider === 'nvidia' || provider === 'openai') {
      if (available.openai) {
        return await OpenAIService.generate(systemPrompt, userMessage, maxTokens);
      }
    }

    // 2. Dual verification (Only if explicitly enabled and not in NVIDIA-only mode)
    if (provider === 'dual' && !config.isNvidiaProvider && available.gemini && available.openai) {
      try {
        const draft = await GeminiService.generate(systemPrompt, userMessage);
        const verifierPrompt = `You are a Principal Code Reviewer. Review and verify the technical accuracy and file citations of this draft answer against the user's requirements. Refine and return the finalized response.`;
        const verifierUser = `Draft:\n${draft}\n\nTask: ${userMessage}`;
        return await OpenAIService.generate(verifierPrompt, verifierUser, maxTokens);
      } catch (err: any) {
        console.warn('[LLMService] Dual non-streaming failed, falling back to OpenAI:', err.message);
        return await OpenAIService.generate(systemPrompt, userMessage, maxTokens);
      }
    }

    // 3. Gemini fallback if explicitly configured
    if (provider === 'gemini' && available.gemini) {
      return await GeminiService.generate(systemPrompt, userMessage);
    }

    if (available.openai) {
      return await OpenAIService.generate(systemPrompt, userMessage, maxTokens);
    }

    throw new Error('No AI LLM provider configured. Please configure NVIDIA_API_KEY in apps/backend/.env.');
  }

  public static async generateText(prompt: string, preferredProvider?: LLMProviderType): Promise<string> {
    return this.generate('You are an expert AI software engineering assistant.', prompt, preferredProvider);
  }
}

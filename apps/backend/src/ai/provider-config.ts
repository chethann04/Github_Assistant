import { config } from '../config/env.js';

export type ProviderErrorType =
  | 'NETWORK_ERROR'
  | 'RATE_LIMIT'
  | 'INSUFFICIENT_CREDITS'
  | 'SERVICE_UNAVAILABLE'
  | 'TIMEOUT'
  | 'AUTH_ERROR'
  | 'INVALID_REQUEST'
  | 'PERMISSION_DENIED'
  | 'UNKNOWN_ERROR';

export interface NormalizedProviderConfig {
  id: string;
  name: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  priority: number;
  enabled: boolean;
  adapter: 'openai_compatible' | 'gemini';
}

export interface ClassifiedError {
  isRecoverable: boolean;
  type: ProviderErrorType;
  status?: number;
  message: string;
}

/**
 * Returns normalized provider configuration resolved strictly from environment and credentials.
 * Providers with valid API keys are sorted by priority / LLM_PROVIDER_ORDER.
 */
export function getNormalizedProviders(): NormalizedProviderConfig[] {
  const providerOrderRaw = process.env.LLM_PROVIDER_ORDER || 'openrouter,nvidia,gemini,openai';
  const orderList = providerOrderRaw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const preferredProvider = (process.env.LLM_PROVIDER || '').trim().toLowerCase();

  const glmModel = process.env.GLM_MODEL || process.env.NVIDIA_MODEL || 'z-ai/glm-5.2';

  const providers: NormalizedProviderConfig[] = [
    {
      id: 'openrouter',
      name: 'OpenRouter',
      model: process.env.OPENROUTER_MODEL || glmModel,
      baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || (process.env.OPENAI_BASE_URL?.includes('openrouter') ? process.env.OPENAI_API_KEY : '') || '',
      priority: preferredProvider === 'openrouter' ? 1 : 10,
      enabled: false,
      adapter: 'openai_compatible',
    },
    {
      id: 'nvidia',
      name: 'NVIDIA NIM',
      model: glmModel,
      baseUrl: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
      apiKey: process.env.NVIDIA_API_KEY || (process.env.OPENAI_BASE_URL?.includes('nvidia') ? process.env.OPENAI_API_KEY : '') || '',
      priority: preferredProvider === 'nvidia' ? 1 : 20,
      enabled: false,
      adapter: 'openai_compatible',
    },
    {
      id: 'gemini',
      name: 'Google Gemini',
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      baseUrl: 'https://generativelanguage.googleapis.com',
      apiKey: process.env.GEMINI_API_KEY || '',
      priority: preferredProvider === 'gemini' ? 1 : 30,
      enabled: false,
      adapter: 'gemini',
    },
    {
      id: 'openai',
      name: 'OpenAI',
      model: process.env.OPENAI_MODEL && !process.env.OPENAI_MODEL.includes('glm') ? process.env.OPENAI_MODEL : 'gpt-4o-mini',
      baseUrl: process.env.OPENAI_BASE_URL && !process.env.OPENAI_BASE_URL.includes('nvidia') && !process.env.OPENAI_BASE_URL.includes('openrouter')
        ? process.env.OPENAI_BASE_URL
        : 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY || '',
      priority: preferredProvider === 'openai' ? 1 : 40,
      enabled: false,
      adapter: 'openai_compatible',
    },
  ];

  // Enable providers that have non-empty API keys
  for (const p of providers) {
    if (p.apiKey && p.apiKey.trim().length > 5 && !p.apiKey.includes('YOUR_')) {
      p.enabled = true;
    }

    // Apply custom priority from LLM_PROVIDER_ORDER if specified
    const orderIndex = orderList.indexOf(p.id);
    if (orderIndex !== -1 && preferredProvider !== p.id) {
      p.priority = (orderIndex + 1) * 10;
    }
  }

  // Sort by priority ascending (1 is highest priority)
  return providers.filter((p) => p.enabled).sort((a, b) => a.priority - b.priority);
}

/**
 * Resolves accurate provider human-readable name from Base URL or ID.
 */
export function resolveProviderName(baseUrl?: string, providerId?: string): string {
  const url = (baseUrl || '').toLowerCase();
  const id = (providerId || '').toLowerCase();

  if (id === 'nvidia' || url.includes('integrate.api.nvidia.com') || url.includes('nvidia')) {
    return 'NVIDIA NIM';
  }
  if (id === 'openrouter' || url.includes('openrouter.ai')) {
    return 'OpenRouter';
  }
  if (id === 'gemini' || url.includes('googleapis.com') || url.includes('google')) {
    return 'Google Gemini';
  }
  if (id === 'openai' || url.includes('api.openai.com')) {
    return 'OpenAI';
  }
  return providerId || 'AI Provider';
}

/**
 * Robust, unified error classifier for all LLM providers.
 */
export function classifyProviderError(err: any): ClassifiedError {
  const status = err?.status || err?.response?.status || err?.statusCode || (typeof err?.code === 'number' ? err.code : undefined);
  const msg = (err?.message || '').toLowerCase();
  const name = (err?.name || '').toLowerCase();
  const code = (err?.code || '').toString().toLowerCase();

  // 1. NETWORK & CONNECTION ERRORS (Recoverable)
  if (
    name.includes('apiconnectionerror') ||
    name.includes('fetcherror') ||
    msg.includes('connection error') ||
    msg.includes('connect error') ||
    msg.includes('network error') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    msg.includes('fetch failed') ||
    msg.includes('socket hang up') ||
    code === 'econnreset' ||
    code === 'econnrefused' ||
    code === 'enotfound'
  ) {
    return {
      isRecoverable: true,
      type: 'NETWORK_ERROR',
      status: typeof status === 'number' ? status : 0,
      message: err.message || 'Connection error to AI provider.',
    };
  }

  // 2. TIMEOUTS (Recoverable)
  if (
    name.includes('apitimeouterror') ||
    name.includes('timeouterror') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    code === 'etimedout' ||
    status === 408 ||
    status === 504
  ) {
    return {
      isRecoverable: true,
      type: 'TIMEOUT',
      status: 408,
      message: 'Request timed out waiting for AI response.',
    };
  }

  // 3. RATE LIMITS / HTTP 429 (Recoverable via retry/fallback)
  if (status === 429 || msg.includes('429') || msg.includes('rate limit') || msg.includes('quota') || msg.includes('too many requests')) {
    return {
      isRecoverable: true,
      type: 'RATE_LIMIT',
      status: 429,
      message: 'Provider rate limit or quota exceeded.',
    };
  }

  // 4. INSUFFICIENT CREDITS / HTTP 402 (Recoverable via immediate fallback to next provider)
  if (status === 402 || msg.includes('402') || msg.includes('insufficient credits') || msg.includes('payment required') || msg.includes('credit')) {
    return {
      isRecoverable: true,
      type: 'INSUFFICIENT_CREDITS',
      status: 402,
      message: 'Provider credit exhausted. Moving to next provider.',
    };
  }

  // 5. SERVER / OVERLOAD ERRORS HTTP 500, 502, 503 (Recoverable)
  if (
    status === 500 ||
    status === 502 ||
    status === 503 ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('service unavailable') ||
    msg.includes('overloaded') ||
    msg.includes('bad gateway')
  ) {
    return {
      isRecoverable: true,
      type: 'SERVICE_UNAVAILABLE',
      status: typeof status === 'number' ? status : 503,
      message: 'AI provider is temporarily unavailable.',
    };
  }

  // 6. AUTHENTICATION ERRORS HTTP 401 (Non-recoverable for this provider; triggers fallback)
  if (status === 401 || msg.includes('401') || msg.includes('unauthorized') || msg.includes('invalid api key')) {
    return {
      isRecoverable: true, // Recoverable by switching to next configured provider
      type: 'AUTH_ERROR',
      status: 401,
      message: 'Invalid API key or authentication failed.',
    };
  }

  // 7. PERMISSION / ACCESS ERRORS HTTP 403 (Non-recoverable)
  if (status === 403 || msg.includes('403') || msg.includes('forbidden')) {
    return {
      isRecoverable: false,
      type: 'PERMISSION_DENIED',
      status: 403,
      message: 'Access to the requested model was denied.',
    };
  }

  // 8. INVALID REQUEST / BAD PAYLOAD HTTP 400 (Non-recoverable)
  if (status === 400 || msg.includes('400') || msg.includes('bad request')) {
    return {
      isRecoverable: false,
      type: 'INVALID_REQUEST',
      status: 400,
      message: 'Invalid request payload or prompt length exceeded.',
    };
  }

  return {
    isRecoverable: true, // Default to attempting fallback for unclassified unexpected errors
    type: 'UNKNOWN_ERROR',
    status,
    message: err.message || 'An unexpected error occurred.',
  };
}

import { AIProvider, AIProviderId } from './types.js';

export class ProviderRegistry {
  private static providers: Map<AIProviderId, AIProvider> = new Map();

  static {
    this.initializeDefaultProviders();
  }

  public static initializeDefaultProviders(): void {
    const nvidiaBaseUrl = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';
    const openrouterBaseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    const defaultGlmModel = process.env.GLM_MODEL || 'z-ai/glm-5.2';

    // 1. NVIDIA NIM Provider
    this.registerProvider({
      id: 'nvidia',
      name: 'NVIDIA NIM',
      baseUrl: nvidiaBaseUrl,
      isOpenAICompatible: true,
      enabled: true,
      priority: 1,
      defaultModel: defaultGlmModel,
      supportedModels: [defaultGlmModel],
      capabilities: ['chat', 'coding', 'reasoning', 'streaming', 'structured_json'],
    });

    // 2. OpenRouter Provider
    this.registerProvider({
      id: 'openrouter',
      name: 'OpenRouter',
      baseUrl: openrouterBaseUrl,
      isOpenAICompatible: true,
      enabled: true,
      priority: 2,
      defaultModel: defaultGlmModel,
      supportedModels: [defaultGlmModel],
      capabilities: ['chat', 'coding', 'reasoning', 'streaming', 'structured_json'],
    });
  }

  public static registerProvider(provider: AIProvider): void {
    this.providers.set(provider.id, { ...provider });
  }

  public static getProvider(id: AIProviderId): AIProvider | undefined {
    return this.providers.get(id);
  }

  public static getAllProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  public static getEnabledProviders(): AIProvider[] {
    return Array.from(this.providers.values())
      .filter((p) => p.enabled)
      .sort((a, b) => a.priority - b.priority);
  }

  public static setProviderEnabled(id: AIProviderId, enabled: boolean): void {
    const provider = this.providers.get(id);
    if (provider) {
      provider.enabled = enabled;
    }
  }
}

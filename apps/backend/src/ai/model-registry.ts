import { AIModel, AIModelCapability, AIProviderId } from './types.js';

export class ModelRegistry {
  private static models: Map<string, AIModel> = new Map();

  static {
    this.initializeDefaultModels();
  }

  private static getModelKey(modelId: string, providerId: AIProviderId): string {
    return `${providerId}::${modelId}`;
  }

  public static initializeDefaultModels(): void {
    const glmModel = process.env.GLM_MODEL || 'z-ai/glm-5.2';

    // Register GLM-5.2 under NVIDIA NIM
    this.registerModel({
      id: glmModel,
      name: 'GLM-5.2 (NVIDIA NIM)',
      providerId: 'nvidia',
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
    });

    // Register GLM-5.2 under OpenRouter
    this.registerModel({
      id: glmModel,
      name: 'GLM-5.2 (OpenRouter)',
      providerId: 'openrouter',
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
    });
  }

  public static registerModel(model: AIModel): void {
    const key = this.getModelKey(model.id, model.providerId);
    this.models.set(key, { ...model });
  }

  public static unregisterModel(modelId: string, providerId: AIProviderId): void {
    const key = this.getModelKey(modelId, providerId);
    this.models.delete(key);
  }

  public static resetDefaultModels(): void {
    this.models.clear();
    this.initializeDefaultModels();
  }

  public static getModel(modelId: string, providerId?: AIProviderId): AIModel | undefined {
    if (providerId) {
      return this.models.get(this.getModelKey(modelId, providerId));
    }
    // If providerId not specified, find first enabled matching model
    for (const model of this.models.values()) {
      if (model.id === modelId && model.enabled) {
        return model;
      }
    }
    return undefined;
  }

  public static getModelsForProvider(providerId: AIProviderId): AIModel[] {
    return Array.from(this.models.values()).filter(
      (m) => m.providerId === providerId && m.enabled
    );
  }

  public static getModelsWithCapability(capability: AIModelCapability): AIModel[] {
    return Array.from(this.models.values()).filter(
      (m) => m.enabled && m.capabilities.includes(capability)
    );
  }

  public static isTestModel(modelId: string): boolean {
    const lower = modelId.toLowerCase();
    return lower.includes('-mock') || lower.includes('mock/') || lower.startsWith('test-');
  }

  public static getProductionModels(): AIModel[] {
    return Array.from(this.models.values()).filter(
      (m) => m.enabled && !this.isTestModel(m.id)
    );
  }

  public static getAllModels(includeTestModels?: boolean): AIModel[] {
    const shouldInclude = includeTestModels ?? (process.env.NODE_ENV === 'test');
    return Array.from(this.models.values()).filter(
      (m) => shouldInclude || !this.isTestModel(m.id)
    );
  }
}

import { AIProviderId, AIProviderKey } from './types.js';

export class KeyManager {
  private static keyPools: Map<AIProviderId, AIProviderKey[]> = new Map();
  private static roundRobinIndices: Map<AIProviderId, number> = new Map();

  static {
    this.initializeFromEnvironment();
  }

  /**
   * Discovers and loads keys from environment variables:
   * 1. Checks numbered variables: NVIDIA_API_KEY_1, NVIDIA_API_KEY_2, etc.
   * 2. If no numbered keys exist, falls back to legacy NVIDIA_API_KEY.
   * 3. Same for OPENROUTER_API_KEY_1..N and OPENROUTER_API_KEY.
   */
  public static initializeFromEnvironment(): void {
    this.keyPools.clear();
    this.roundRobinIndices.clear();

    // 1. Load NVIDIA keys
    const nvidiaKeys = this.discoverKeysForProvider('nvidia', 'NVIDIA_API_KEY');
    if (nvidiaKeys.length > 0) {
      this.keyPools.set('nvidia', nvidiaKeys);
    }

    // 2. Load OpenRouter keys
    const openrouterKeys = this.discoverKeysForProvider('openrouter', 'OPENROUTER_API_KEY');
    if (openrouterKeys.length > 0) {
      this.keyPools.set('openrouter', openrouterKeys);
    }
  }

  private static discoverKeysForProvider(
    providerId: AIProviderId,
    baseEnvName: string
  ): AIProviderKey[] {
    const discovered: AIProviderKey[] = [];

    // Check numbered keys 1 to 20
    for (let i = 1; i <= 20; i++) {
      const numberedEnv = process.env[`${baseEnvName}_${i}`];
      if (numberedEnv && numberedEnv.trim().length > 5) {
        discovered.push({
          id: `${providerId}-key-${i}`,
          providerId,
          key: numberedEnv.trim(),
          index: i,
          failureCount: 0,
        });
      }
    }

    // If no numbered keys, check base env variable
    if (discovered.length === 0) {
      const singleKey = process.env[baseEnvName] || (providerId === 'nvidia' ? process.env.OPENAI_API_KEY : '');
      if (singleKey && singleKey.trim().length > 5) {
        discovered.push({
          id: `${providerId}-key-1`,
          providerId,
          key: singleKey.trim(),
          index: 1,
          failureCount: 0,
        });
      }
    }

    return discovered;
  }

  /**
   * Deterministic round-robin key selection for a provider.
   * Returns a sanitized AIProviderKey where .id is safe for logging, and .key contains the secret for execution.
   */
  public static getKey(providerId: AIProviderId): AIProviderKey | undefined {
    const pool = this.keyPools.get(providerId);
    if (!pool || pool.length === 0) {
      return undefined;
    }

    const currentIndex = this.roundRobinIndices.get(providerId) || 0;
    const selectedKey = pool[currentIndex % pool.length];

    // Advance round-robin pointer
    this.roundRobinIndices.set(providerId, (currentIndex + 1) % pool.length);
    selectedKey.lastUsed = Date.now();

    return selectedKey;
  }

  public static hasKeys(providerId: AIProviderId): boolean {
    const pool = this.keyPools.get(providerId);
    return Boolean(pool && pool.length > 0);
  }

  public static getKeyCount(providerId: AIProviderId): number {
    return this.keyPools.get(providerId)?.length || 0;
  }

  public static registerKey(providerId: AIProviderId, rawKey: string, index?: number): void {
    if (!rawKey || rawKey.trim().length < 5) return;

    if (!this.keyPools.has(providerId)) {
      this.keyPools.set(providerId, []);
    }

    const pool = this.keyPools.get(providerId)!;
    const nextIndex = index ?? (pool.length + 1);
    pool.push({
      id: `${providerId}-key-${nextIndex}`,
      providerId,
      key: rawKey.trim(),
      index: nextIndex,
      failureCount: 0,
    });
  }

  public static resetPool(providerId?: AIProviderId): void {
    if (providerId) {
      this.keyPools.delete(providerId);
      this.roundRobinIndices.delete(providerId);
    } else {
      this.keyPools.clear();
      this.roundRobinIndices.clear();
      this.initializeFromEnvironment();
    }
  }
}

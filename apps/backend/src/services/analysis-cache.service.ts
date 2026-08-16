export interface AnalysisCacheEntry<T = any> {
  data: T;
  createdAt: number;
  commitSha: string;
  analysisType: string;
  sizeBytes: number;
}

/**
 * AnalysisCacheService — Commit-aware caching layer for repository AI analysis.
 *
 * Cache key: `${repositoryId}:${commitSha}:${analysisType}:${subKey}`
 * Invalidation: Automatically on new commit or manual invalidation per repo.
 */
export class AnalysisCacheService {
  private static cache = new Map<string, AnalysisCacheEntry>();
  private static readonly TTL_MS = 2 * 60 * 60 * 1000; // 2 hours TTL
  private static readonly MAX_ENTRIES = 500;

  private static buildKey(repositoryId: string, commitSha: string, analysisType: string, subKey: string = ''): string {
    const cleanSubKey = subKey ? `:${subKey}` : '';
    return `${repositoryId}:${commitSha}:${analysisType}${cleanSubKey}`;
  }

  public static get<T = any>(repositoryId: string, commitSha: string, analysisType: string, subKey: string = ''): T | null {
    const key = this.buildKey(repositoryId, commitSha, analysisType, subKey);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.createdAt > this.TTL_MS) {
      this.cache.delete(key);
      return null;
    }

    // Check commit validity
    if (entry.commitSha !== commitSha) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  public static set<T = any>(
    repositoryId: string,
    commitSha: string,
    analysisType: string,
    data: T,
    subKey: string = ''
  ): void {
    if (this.cache.size >= this.MAX_ENTRIES) {
      // Evict oldest entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    const key = this.buildKey(repositoryId, commitSha, analysisType, subKey);
    const serialized = typeof data === 'string' ? data : JSON.stringify(data);

    this.cache.set(key, {
      data,
      createdAt: Date.now(),
      commitSha,
      analysisType,
      sizeBytes: Buffer.byteLength(serialized, 'utf8'),
    });
  }

  public static invalidateRepo(repositoryId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${repositoryId}:`)) {
        this.cache.delete(key);
      }
    }
  }

  public static clear(): void {
    this.cache.clear();
  }

  public static getStats(): { totalEntries: number; totalSizeBytes: number } {
    let totalSizeBytes = 0;
    for (const entry of this.cache.values()) {
      totalSizeBytes += entry.sizeBytes;
    }
    return {
      totalEntries: this.cache.size,
      totalSizeBytes,
    };
  }
}

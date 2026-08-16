import { config } from '../config/env.js';

/**
 * In-memory embedding cache (zero external dependencies, zero Redis).
 */
class InMemoryEmbeddingCache {
  private cache = new Map<string, number[]>();
  private readonly maxSize = 2000;

  public get(text: string): number[] | null {
    return this.cache.get(text) || null;
  }

  public set(text: string, vector: number[]): void {
    if (this.cache.size >= this.maxSize) {
      // Evict oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(text, vector);
  }

  public clear(): void {
    this.cache.clear();
  }
}

const memoryCache = new InMemoryEmbeddingCache();

/**
 * EmbeddingService — NVIDIA NIM Nemotron-3-Embed-1B embedding generation.
 *
 * Model: nvidia/nemotron-3-embed-1b
 * Dimension: 2048
 * Endpoint: https://integrate.api.nvidia.com/v1/embeddings
 *
 * Strict vector dimension validation: 2048.
 * Deterministic/fake fallback embeddings are strictly disabled.
 */
export class EmbeddingService {
  private static loggedDiagnostics: boolean = false;

  private static logDiagnosticsOnce(): void {
    if (!this.loggedDiagnostics) {
      console.log(`[EmbeddingService] provider=NVIDIA NIM model=${config.embeddingModel} dimensions=${config.embeddingDimensions} baseUrl=${config.nvidiaBaseUrl}`);
      this.loggedDiagnostics = true;
    }
  }

  private static get baseUrl(): string {
    const rawUrl = config.nvidiaBaseUrl || 'https://integrate.api.nvidia.com/v1';
    return rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
  }

  private static get apiKey(): string {
    return config.nvidiaApiKey || process.env.NVIDIA_API_KEY || process.env.OPENAI_API_KEY || '';
  }

  private static sanitizeEmbeddingInput(text: string): string {
    if (!text || typeof text !== 'string') return '';
    // Strip inline data:image/... URIs and literal data:image prefixes which trigger NVIDIA NIM multimodal VLM router errors (HTTP 400 / 503)
    return text.replace(/data:image(?:\/[^"'\s)>]+|(?:\/)?|\b)/gi, '[IMAGE_DATA_URI]');
  }

  /**
   * Generates a 2048-dimensional embedding vector for a single string.
   */
  public static async generateEmbedding(
    text: string,
    inputType: 'query' | 'passage' = 'passage'
  ): Promise<number[]> {
    this.logDiagnosticsOnce();
    const expectedDims = config.embeddingDimensions;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new Error(`[EmbeddingService] Cannot generate embedding for empty text input.`);
    }

    const sanitized = this.sanitizeEmbeddingInput(text);
    const trimmedText = sanitized.substring(0, 8000);
    const cacheKey = `${inputType}:${trimmedText}`;

    // 1. Check in-memory cache
    const cached = memoryCache.get(cacheKey);
    if (cached && Array.isArray(cached) && cached.length === expectedDims) {
      return cached;
    }

    const apiKey = this.apiKey;
    if (!apiKey) {
      throw new Error(`[EmbeddingService] NVIDIA API key is missing. Set NVIDIA_API_KEY in environment.`);
    }

    const endpoint = `${this.baseUrl}/embeddings`;
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: config.embeddingModel,
            input: [trimmedText],
            input_type: inputType,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          const isRateLimit = response.status === 429 || errText.includes('429') || errText.includes('quota');

          if (isRateLimit && attempt < maxRetries - 1) {
            const delay = (attempt + 1) * 2000;
            console.warn(`[EmbeddingService] Rate limit hit (attempt ${attempt + 1}/${maxRetries}), waiting ${delay}ms before retry...`);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }

          throw new Error(`HTTP ${response.status} ${response.statusText}: ${errText}`);
        }

        const data: any = await response.json();
        const embeddingValues = data?.data?.[0]?.embedding;

        if (!embeddingValues || !Array.isArray(embeddingValues)) {
          throw new Error(`Invalid embedding structure received from NVIDIA API: ${JSON.stringify(data)}`);
        }

        // Strict dimension validation
        if (embeddingValues.length !== expectedDims) {
          throw new Error(
            `Embedding dimension mismatch: expected ${expectedDims}, received ${embeddingValues.length} from ${config.embeddingModel}.`
          );
        }

        // Store in cache
        memoryCache.set(cacheKey, embeddingValues);
        return embeddingValues;
      } catch (err: any) {
        if (err.message?.includes('Embedding dimension mismatch')) {
          throw err;
        }

        if (attempt === maxRetries - 1) {
          throw new Error(`Failed to generate embeddings via NVIDIA model ${config.embeddingModel}: ${err.message}`);
        }

        const delay = (attempt + 1) * 1500;
        console.warn(`[EmbeddingService] Embedding request attempt ${attempt + 1} failed (${err.message}). Retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    throw new Error(`Failed to generate valid ${expectedDims}-dimensional vector embedding from ${config.embeddingModel}.`);
  }

  /**
   * Generates 2048-dimensional embeddings for a batch of strings.
   * Utilizes native batch embedding API support for optimal performance.
   */
  public static async generateBatchEmbeddings(
    texts: string[],
    concurrency: number = 16,
    inputType: 'passage' | 'query' = 'passage'
  ): Promise<number[][]> {
    this.logDiagnosticsOnce();
    const expectedDims = config.embeddingDimensions;
    const results: number[][] = new Array(texts.length);
    const missingIndices: number[] = [];
    const missingTexts: string[] = [];

    // Check cache first
    for (let i = 0; i < texts.length; i++) {
      const sanitized = this.sanitizeEmbeddingInput(texts[i]);
      const trimmed = sanitized.substring(0, 8000);
      const cacheKey = `${inputType}:${trimmed}`;
      const cached = memoryCache.get(cacheKey);
      if (cached && cached.length === expectedDims) {
        results[i] = cached;
      } else {
        missingIndices.push(i);
        missingTexts.push(trimmed);
      }
    }

    if (missingTexts.length === 0) return results;

    const apiKey = this.apiKey;
    if (!apiKey) {
      throw new Error(`[EmbeddingService] NVIDIA API key is missing. Set NVIDIA_API_KEY in environment.`);
    }

    const endpoint = `${this.baseUrl}/embeddings`;
    const batchSize = Math.max(1, Math.min(concurrency, 16));

    for (let i = 0; i < missingIndices.length; i += batchSize) {
      const sliceIndices = missingIndices.slice(i, i + batchSize);
      const sliceTexts = missingTexts.slice(i, i + batchSize);

      let batchVectors: number[][] | null = null;
      const maxRetries = 3;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: config.embeddingModel,
              input: sliceTexts,
              input_type: inputType,
            }),
          });

          if (!response.ok) {
            const errText = await response.text();
            if (response.status === 429 && attempt < maxRetries - 1) {
              const delay = (attempt + 1) * 2000;
              console.warn(`[EmbeddingService] Batch rate limit hit, waiting ${delay}ms...`);
              await new Promise((r) => setTimeout(r, delay));
              continue;
            }
            throw new Error(`HTTP ${response.status}: ${errText}`);
          }

          const data: any = await response.json();
          const items = data?.data;

          if (!Array.isArray(items) || items.length !== sliceTexts.length) {
            throw new Error(`Batch embedding response length mismatch: sent ${sliceTexts.length}, received ${items?.length}`);
          }

          batchVectors = items.map((item: any, idx: number) => {
            const vec = item.embedding;
            if (!Array.isArray(vec) || vec.length !== expectedDims) {
              throw new Error(
                `Batch item ${idx} dimension mismatch: expected ${expectedDims}, received ${vec?.length}`
              );
            }
            return vec;
          });

          break;
        } catch (err: any) {
          if (attempt === maxRetries - 1) {
            // Fall back to single requests in slice
            console.warn(`[EmbeddingService] Batch call failed (${err.message}). Falling back to individual generation.`);
            batchVectors = await Promise.all(sliceTexts.map((t) => this.generateEmbedding(t, inputType)));
            break;
          }
          await new Promise((r) => setTimeout(r, (attempt + 1) * 1500));
        }
      }

      if (!batchVectors) {
        throw new Error(`Failed to generate batch embeddings for slice of ${sliceTexts.length} texts.`);
      }

      for (let j = 0; j < sliceIndices.length; j++) {
        const origIdx = sliceIndices[j];
        const vec = batchVectors[j];
        results[origIdx] = vec;
        memoryCache.set(`${inputType}:${missingTexts[j]}`, vec);
      }
    }

    return results;
  }
}

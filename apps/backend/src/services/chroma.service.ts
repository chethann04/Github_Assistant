import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import readline from 'readline';
import crypto from 'crypto';
import { config } from '../config/env.js';
import { sanitizeUnicodeText, sanitizeMetadata } from '../utils/sanitizer.js';

export interface ChunkPayload {
  repositoryId: string;
  commitSha: string;
  filePath: string;
  startLine: number;
  endLine: number;
  chunkType: string;
  language: string;
  name?: string;
  content: string;
}

export interface SearchResult {
  id: string;
  score: number;
  payload: ChunkPayload;
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timer: NodeJS.Timeout;
}

export class VectorStore {
  private static workerProcess: ChildProcess | null = null;
  private static readlineInterface: readline.Interface | null = null;
  private static pendingRequests = new Map<number, PendingRequest>();
  private static nextReqId = 1;
  private static startPromise: Promise<ChildProcess> | null = null;
  private static hooksRegistered = false;

  // Local in-memory fallback map if explicitly enabled
  private static localPoints: Map<string, { vector: number[]; payload: ChunkPayload }> = new Map();

  private static get persistDirectory(): string {
    const configured = config.chromaPersistDirectory;
    if (configured && path.isAbsolute(configured)) return configured;

    const candidates = [
      path.resolve(__dirname, '../../data/chroma'),
      path.resolve(__dirname, '../../../apps/backend/data/chroma'),
      path.resolve(process.cwd(), 'apps/backend/data/chroma'),
      path.resolve(process.cwd(), 'data/chroma'),
    ];

    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }

    return path.resolve(process.cwd(), 'apps/backend/data/chroma');
  }

  private static get collectionName(): string {
    return config.chromaCollectionName;
  }

  private static get pythonScriptPath(): string {
    // Try multiple possible paths relative to source or dist
    const candidatePaths = [
      path.resolve(__dirname, 'chroma_worker.py'),
      path.resolve(__dirname, '../services/chroma_worker.py'),
      path.resolve(__dirname, '../../src/services/chroma_worker.py'),
      path.resolve(process.cwd(), 'apps/backend/src/services/chroma_worker.py'),
      path.resolve(process.cwd(), 'src/services/chroma_worker.py'),
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) return p;
    }
    return path.resolve(__dirname, 'chroma_worker.py');
  }

  /**
   * Registers process exit and termination handlers to prevent orphaned worker processes.
   */
  private static registerProcessHooks(): void {
    if (this.hooksRegistered) return;
    this.hooksRegistered = true;

    const safeExitCleanup = () => {
      this.cleanupWorker(true);
    };

    process.once('exit', safeExitCleanup);
    process.once('SIGINT', () => {
      safeExitCleanup();
      process.exit(0);
    });
    process.once('SIGTERM', () => {
      safeExitCleanup();
      process.exit(0);
    });
    process.once('beforeExit', safeExitCleanup);
  }

  /**
   * Spawns exactly one Python worker process if none exists.
   */
  private static async spawnWorker(): Promise<ChildProcess> {
    const scriptPath = this.pythonScriptPath;
    const persistDir = this.persistDirectory;
    if (!fs.existsSync(persistDir)) {
      fs.mkdirSync(persistDir, { recursive: true });
    }

    const pythonExecutable = process.platform === 'win32' ? 'python' : 'python3';
    const worker = spawn(pythonExecutable, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
      },
    });

    const pid = worker.pid;

    worker.on('error', (err) => {
      console.error(`[ChromaWorker] Failed to start Python process (PID: ${pid}):`, err.message);
      this.cleanupWorker();
    });

    worker.on('exit', (code, signal) => {
      console.log(`[ChromaWorker] Worker exited\nPID: ${pid}\ncode: ${code}\nsignal: ${signal}`);
      if (this.workerProcess === worker) {
        this.cleanupWorker();
      }
    });

    if (worker.stderr) {
      worker.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg && !msg.includes('Telemet') && !msg.includes('notice')) {
          console.warn(`[ChromaWorker stderr]: ${msg}`);
        }
      });
    }

    const rl = readline.createInterface({
      input: worker.stdout!,
      terminal: false,
    });

    rl.on('line', (line) => {
      const str = line.trim();
      if (!str) return;
      try {
        const data = JSON.parse(str);
        const reqId = data.req_id;
        if (reqId && this.pendingRequests.has(reqId)) {
          const pending = this.pendingRequests.get(reqId)!;
          clearTimeout(pending.timer);
          this.pendingRequests.delete(reqId);
          if (data.error) {
            pending.reject(new Error(data.error));
          } else {
            pending.resolve(data);
          }
        }
      } catch {
        // Non-JSON output ignored
      }
    });

    this.workerProcess = worker;
    this.readlineInterface = rl;
    return worker;
  }

  /**
   * Initializes and maintains the singleton long-lived Python ChromaDB worker process.
   */
  private static async getWorker(): Promise<ChildProcess> {
    this.registerProcessHooks();

    if (this.workerProcess && !this.workerProcess.killed && this.workerProcess.exitCode === null) {
      return this.workerProcess;
    }

    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = this.spawnWorker();
    try {
      const worker = await this.startPromise;
      return worker;
    } catch (err) {
      this.cleanupWorker();
      throw err;
    } finally {
      this.startPromise = null;
    }
  }

  /**
   * Cleans up the child worker process owned by this Node instance.
   * Strictly idempotent and safe to call multiple times.
   */
  private static cleanupWorker(isProcessExiting = false): void {
    const proc = this.workerProcess;
    this.workerProcess = null;
    this.startPromise = null;

    if (this.readlineInterface) {
      try {
        this.readlineInterface.close();
      } catch {}
      this.readlineInterface = null;
    }

    if (proc) {
      try {
        if (!proc.killed && proc.exitCode === null) {
          proc.kill('SIGTERM');
        }
      } catch {}
    }

    for (const [, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('ChromaDB worker process terminated.'));
    }
    this.pendingRequests.clear();
  }

  private static async sendCommand<T = any>(
    action: string,
    payload: Record<string, any> = {},
    attempt: number = 0
  ): Promise<T> {
    try {
      const worker = await this.getWorker();
      const reqId = this.nextReqId++;

      return await new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
          if (this.pendingRequests.has(reqId)) {
            this.pendingRequests.delete(reqId);
            reject(new Error(`ChromaDB worker timed out after 30s for action: ${action}`));
          }
        }, 30000);

        this.pendingRequests.set(reqId, { resolve, reject, timer });

        const cmd = {
          req_id: reqId,
          action,
          persist_directory: this.persistDirectory,
          collection_name: this.collectionName,
          ...payload,
        };

        try {
          worker.stdin!.write(JSON.stringify(cmd) + '\n');
        } catch (err: any) {
          clearTimeout(timer);
          this.pendingRequests.delete(reqId);
          reject(err);
        }
      });
    } catch (err: any) {
      if (attempt < 2 && (err.message?.includes('terminated') || err.message?.includes('timed out'))) {
        this.cleanupWorker();
        await new Promise((r) => setTimeout(r, 300));
        return this.sendCommand<T>(action, payload, attempt + 1);
      }
      throw err;
    }
  }

  /**
   * Check if ChromaDB local engine is available.
   */
  public static async isAvailable(): Promise<boolean> {
    try {
      const res = await this.sendCommand<{ status: string }>('ping');
      return res.status === 'ok';
    } catch {
      return false;
    }
  }

  /**
   * Ensure the ChromaDB collection exists with Cosine similarity space.
   */
  public static async ensureCollection(): Promise<void> {
    try {
      await this.sendCommand('ensure_collection');
    } catch (err: any) {
      if (config.enableInMemoryFallback) {
        console.warn(`[ChromaDB] Collection setup warning: ${err.message}. Using in-memory fallback.`);
        return;
      }
      throw new Error(`[ChromaDB] Failed to initialize persistent collection "${this.collectionName}" at ${this.persistDirectory}: ${err.message}`);
    }
  }

  private static activeDeletions = new Set<string>();

  /**
   * Delete all vectors scoped strictly to a specific repository.
   * Fully idempotent, serialized per repository, with pre-check, auto-recovery, and post-verification.
   */
  public static async deleteByRepositoryId(
    repositoryId: string
  ): Promise<{ success: boolean; deletedCount: number; alreadyDeleted: boolean }> {
    if (!repositoryId) return { success: true, deletedCount: 0, alreadyDeleted: true };

    // Prevent concurrent double-deletes for the same repository
    while (this.activeDeletions.has(repositoryId)) {
      await new Promise((r) => setTimeout(r, 100));
    }

    this.activeDeletions.add(repositoryId);
    try {
      // 1. Clean from local in-memory fallback if active
      for (const [id, item] of this.localPoints.entries()) {
        if (item.payload.repositoryId === repositoryId) {
          this.localPoints.delete(id);
        }
      }

      // 2. Read-only vector count check first (prevents unnecessary delete on 0-vector repos)
      const initialCount = await this.countChunks(repositoryId);
      if (initialCount === 0) {
        console.log(`[VectorStore] Zero vectors found for repository ${repositoryId} (skipping Chroma delete)`);
        return { success: true, deletedCount: 0, alreadyDeleted: true };
      }

      // 3. Dispatch delete command to worker with auto-recovery
      let res: any;
      try {
        res = await this.sendCommand('delete_repo', { repository_id: repositoryId });
      } catch (cmdErr: any) {
        console.warn(`[VectorStore] Worker error during delete for ${repositoryId}: ${cmdErr.message}. Re-checking vector count...`);
        // Re-check if delete actually took effect
        const remainingAfterError = await this.countChunks(repositoryId);
        if (remainingAfterError === 0) {
          console.log(`[VectorStore] Verification confirmed: zero vectors remain for ${repositoryId}`);
          return { success: true, deletedCount: initialCount, alreadyDeleted: false };
        }
        // Perform one retry if vectors still exist
        console.log(`[VectorStore] Retrying deletion for ${repositoryId} (${remainingAfterError} vectors remain)...`);
        res = await this.sendCommand('delete_repo', { repository_id: repositoryId });
      }

      if (res && res.status === 'error') {
        throw new Error(res.error || 'ChromaDB worker reported deletion failure');
      }

      // 4. Verify zero vectors remain
      const remainingCount = await this.countChunks(repositoryId);
      if (remainingCount > 0) {
        throw new Error(`[ChromaDB] Deletion verification failed: ${remainingCount} vectors still remain for repository ${repositoryId}`);
      }

      console.log(`[VectorStore] Successfully deleted ${initialCount} vectors for repository ${repositoryId}`);
      return { success: true, deletedCount: initialCount, alreadyDeleted: false };
    } finally {
      this.activeDeletions.delete(repositoryId);
    }
  }

  /**
   * Delete vectors for a specific file path within a repository.
   */
  public static async deleteByFilePath(repositoryId: string, filePath: string): Promise<void> {
    for (const [id, item] of this.localPoints.entries()) {
      if (item.payload.repositoryId === repositoryId && item.payload.filePath === filePath) {
        this.localPoints.delete(id);
      }
    }

    try {
      await this.sendCommand('delete_file', {
        repository_id: repositoryId,
        file_path: filePath,
      });
      console.log(`[VectorStore] Deleted vectors for file ${filePath} in repo ${repositoryId}`);
    } catch (err: any) {
      console.warn(`[VectorStore] Delete by file path failed: ${err.message}`);
      if (!config.enableInMemoryFallback) {
        throw new Error(`[ChromaDB] Delete by file path failed: ${err.message}`);
      }
    }
  }

  /**
   * Upsert chunks into local ChromaDB persistent storage.
   */
  public static async upsertChunks(
    repositoryId: string,
    commitSha: string,
    chunks: Array<{ chunk: ChunkPayload; vector: number[] }>
  ): Promise<void> {
    if (chunks.length === 0) return;

    const ids: string[] = [];
    const embeddings: number[][] = [];
    const documents: string[] = [];
    const metadatas: Array<Record<string, any>> = [];

    for (const item of chunks) {
      const idSource = `${repositoryId}:${commitSha}:${item.chunk.filePath}:${item.chunk.startLine}`;
      const pointId = crypto.createHash('md5').update(idSource).digest('hex');

      ids.push(pointId);
      embeddings.push(item.vector);
      documents.push(sanitizeUnicodeText(item.chunk.content, item.chunk.filePath, item.chunk.startLine));
      metadatas.push(
        sanitizeMetadata(
          {
            repositoryId: item.chunk.repositoryId,
            commitSha: item.chunk.commitSha,
            filePath: item.chunk.filePath,
            startLine: item.chunk.startLine,
            endLine: item.chunk.endLine,
            chunkType: item.chunk.chunkType,
            language: item.chunk.language,
            name: item.chunk.name || '',
          },
          item.chunk.filePath
        )
      );
    }

    try {
      await this.sendCommand('upsert', {
        ids,
        embeddings,
        documents,
        metadatas,
      });
      console.log(`[VectorStore] Persisted ${chunks.length} chunks to ChromaDB collection "${this.collectionName}"`);
    } catch (err: any) {
      if (config.enableInMemoryFallback) {
        console.warn(`[VectorStore] Upsert failed: ${err.message}. Falling back to memory.`);
        for (let i = 0; i < ids.length; i++) {
          this.localPoints.set(ids[i], { vector: embeddings[i], payload: chunks[i].chunk });
        }
        return;
      }
      throw new Error(`[ChromaDB] Upsert failed at ${this.persistDirectory}: ${err.message}`);
    }
  }

  /**
   * Search vectors strictly scoped to repositoryId.
   */
  public static async searchSimilar(
    queryVector: number[],
    repositoryId: string,
    limit: number = 8,
    filePath?: string
  ): Promise<SearchResult[]> {
    try {
      const res = await this.sendCommand<{ results: SearchResult[] }>('search', {
        query_vector: queryVector,
        repository_id: repositoryId,
        limit,
        file_path: filePath || undefined,
      });

      return res.results || [];
    } catch (err: any) {
      if (config.enableInMemoryFallback) {
        console.warn(`[VectorStore] Search failed: ${err.message}. Using in-memory fallback.`);
        return this.localSearch(queryVector, repositoryId, limit, filePath);
      }
      throw new Error(`[ChromaDB] Vector search failed: ${err.message}`);
    }
  }

  /**
   * Count total chunks indexed for a repository.
   */
  public static async countChunks(repositoryId: string): Promise<number> {
    try {
      const res = await this.sendCommand<{ count: number }>('count', {
        repository_id: repositoryId,
      });
      return res.count || 0;
    } catch {
      if (config.enableInMemoryFallback) {
        let count = 0;
        for (const [, item] of this.localPoints.entries()) {
          if (item.payload.repositoryId === repositoryId) count++;
        }
        return count;
      }
      return 0;
    }
  }

  /**
   * Purge collection and reset vector database.
   */
  public static async purgeAll(): Promise<void> {
    this.localPoints.clear();
    try {
      await this.sendCommand('purge');
      console.log(`[VectorStore] Purged ChromaDB collection "${this.collectionName}"`);
    } catch (err: any) {
      console.warn(`[VectorStore] Purge warning: ${err.message}`);
    }
  }

  private static localSearch(
    queryVector: number[],
    repositoryId: string,
    limit: number,
    filePath?: string
  ): SearchResult[] {
    const matches: SearchResult[] = [];

    for (const [id, item] of this.localPoints.entries()) {
      if (item.payload.repositoryId !== repositoryId) continue;
      if (filePath && item.payload.filePath !== filePath) continue;

      let dot = 0, qNorm = 0, vNorm = 0;
      for (let i = 0; i < queryVector.length; i++) {
        const qVal = queryVector[i] || 0;
        const vVal = item.vector[i] || 0;
        dot += qVal * vVal;
        qNorm += qVal * qVal;
        vNorm += vVal * vVal;
      }
      const denom = Math.sqrt(qNorm) * Math.sqrt(vNorm);
      const score = denom > 0 ? dot / denom : 0.5;
      matches.push({ id, score: isNaN(score) ? 0.5 : score, payload: item.payload });
    }

    return matches.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

// Exports for convenience and compatibility
export const ChromaService = VectorStore;

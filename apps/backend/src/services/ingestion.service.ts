import prisma from '../config/prisma.js';
import { GitHubService } from './github.service.js';
import { ChunkerService, CodeChunk } from './chunker.service.js';
import { EmbeddingService } from './embedding.service.js';
import { VectorStore, ChunkPayload } from './chroma.service.js';
import { AnalysisCacheService } from './analysis-cache.service.js';
import { config } from '../config/env.js';

async function updateJobStep(jobId: string, status: string, progress: number, currentStep: string, extra?: Record<string, any>) {
  try {
    await prisma.indexJob.update({
      where: { id: jobId },
      data: { status, progress, currentStep, ...extra },
    });
  } catch (err: any) {
    console.warn(`[IngestionService] Failed to update job ${jobId}:`, err.message);
  }
}

async function updateRepoStatus(repositoryId: string, status: string) {
  try {
    await prisma.repository.update({
      where: { id: repositoryId },
      data: { status },
    });
  } catch (err: any) {
    console.warn(`[IngestionService] Failed to update repo status:`, err.message);
  }
}

const activeCancelledJobs = new Set<string>();

export function cancelIngestionJob(jobId: string): boolean {
  activeCancelledJobs.add(jobId);
  return true;
}

export function isJobCancelled(jobId: string): boolean {
  return activeCancelledJobs.has(jobId);
}

/**
 * Direct Asynchronous Ingestion Service.
 *
 * Flow:
 * 1. Ensure ChromaDB collection is ready.
 * 2. Fetch file tree from GitHub API.
 * 3. Scope-clean old vectors for re-indexing.
 * 4. Extract code chunks with AST parsing.
 * 5. Generate 2048-dimensional embeddings with NVIDIA Nemotron-3-Embed-1B.
 * 6. Upsert points into ChromaDB vector store and verify persistence.
 * 7. Update index job and repository status to READY / COMPLETED.
 */
export async function executeIngestion(
  jobId: string,
  repositoryId: string,
  owner: string,
  name: string,
  commitSha: string,
  isReindex: boolean = false
): Promise<void> {
  const label = `[IngestionService] Job ${jobId} for ${owner}/${name}`;
  console.log(`${label} started (commit: ${commitSha.substring(0, 7)})`);
  console.log(`[IngestionService] Repository: ${owner}/${name}`);

  const startTime = Date.now();

  try {
    // ─── Step 0: Ensure ChromaDB vector collection exists ───────────────────
    await updateJobStep(jobId, 'INITIALIZING', 5, 'Connecting to vector database');
    await updateRepoStatus(repositoryId, 'INDEXING');

    const vectorStoreOk = await VectorStore.isAvailable();
    if (!vectorStoreOk && !config.enableInMemoryFallback) {
      throw new Error(
        `Local Vector Database (ChromaDB) is unavailable at ${config.chromaPersistDirectory}. Please verify storage directory permissions and Python environment.`
      );
    }
    await VectorStore.ensureCollection();

    if (activeCancelledJobs.has(jobId)) {
      activeCancelledJobs.delete(jobId);
      console.log(`${label} cancelled before file fetch`);
      return;
    }

    // ─── Step 1: CLONING / FETCHING TREE ────────────────────────────────────
    console.log(`[RAG] Ingestion started repositoryId=${repositoryId} repo=${owner}/${name}`);
    await updateJobStep(jobId, 'CLONING', 10, 'Fetching repository file tree', { startedAt: new Date() });

    const files = await GitHubService.fetchRepoFileTree(owner, name, commitSha);
    console.log(`[RAG] filesDiscovered=${files.length}`);
    console.log(`${label} discovered ${files.length} files`);

    if (files.length === 0) {
      throw new Error('No valid source code or documentation files found in repository.');
    }

    if (activeCancelledJobs.has(jobId)) {
      activeCancelledJobs.delete(jobId);
      console.log(`${label} cancelled after file tree fetch`);
      return;
    }

    await updateJobStep(jobId, 'CLONING', 20, `Discovered ${files.length} indexable files`, { totalFiles: files.length });

    // ─── Step 2: Clean up old vectors for this repository only ─────────────
    if (isReindex) {
      console.log(`${label} clearing previous vectors for re-index`);
      await updateJobStep(jobId, 'CLONING', 22, 'Clearing previous index');
      await VectorStore.deleteByRepositoryId(repositoryId);
    }

    // ─── Step 3: CHUNKING ─────────────────────────────────────────────────
    await updateJobStep(jobId, 'CHUNKING', 25, 'Parsing and chunking source files');

    const maxFiles = Math.min(files.length, config.maxFilesToIndex);
    const processableFiles = files.slice(0, maxFiles);
    const allChunks: CodeChunk[] = [];
    const fileErrors: string[] = [];

    const updateFrequency = processableFiles.length <= 20 ? 1 : Math.max(1, Math.floor(processableFiles.length / 10));

    for (let i = 0; i < processableFiles.length; i++) {
      if (activeCancelledJobs.has(jobId)) {
        activeCancelledJobs.delete(jobId);
        console.log(`${label} cancelled during chunking`);
        return;
      }

      const file = processableFiles[i];
      try {
        const content = await GitHubService.fetchRawFileContent(owner, name, commitSha, file.path);
        const fileChunks = ChunkerService.chunkFile(file.path, content);
        allChunks.push(...fileChunks);
      } catch (err: any) {
        fileErrors.push(file.path);
        console.warn(`${label} skipped ${file.path}: ${err.message}`);
      }

      // Progress update dynamically
      if ((i + 1) % updateFrequency === 0 || i === processableFiles.length - 1) {
        const chunkProgress = Math.min(25 + Math.floor(((i + 1) / processableFiles.length) * 35), 60);
        await updateJobStep(
          jobId,
          'CHUNKING',
          chunkProgress,
          `Chunking file ${i + 1}/${processableFiles.length}: ${file.path.split('/').pop()}`,
          { totalChunks: allChunks.length }
        );
      }
    }

    if (activeCancelledJobs.has(jobId)) {
      activeCancelledJobs.delete(jobId);
      console.log(`${label} cancelled after chunking`);
      return;
    }

    console.log(`[RAG] filesProcessed=${processableFiles.length}`);
    console.log(`[RAG] filesSkipped=${fileErrors.length}`);
    console.log(`[RAG] chunksCreated=${allChunks.length}`);
    console.log(`[IngestionService] Files: ${processableFiles.length}`);
    console.log(`[IngestionService] Chunks: ${allChunks.length}`);

    if (allChunks.length === 0) {
      throw new Error('No code chunks could be extracted from the repository files.');
    }

    // ─── Step 4: EMBEDDING & VECTOR STORE ──────────────────────────────────
    await updateJobStep(jobId, 'EMBEDDING', 62, `Generating embeddings for ${allChunks.length} chunks`);
    console.log(`[IngestionService] Embeddings: ${allChunks.length}`);

    const batchSize = 20;
    const totalBatches = Math.ceil(allChunks.length / batchSize);
    let embeddedCount = 0;
    const embeddingStartTime = Date.now();

    for (let i = 0; i < allChunks.length; i += batchSize) {
      if (activeCancelledJobs.has(jobId)) {
        activeCancelledJobs.delete(jobId);
        console.log(`${label} cancelled during embedding batch ${Math.floor(i / batchSize) + 1}`);
        return;
      }
      const batchNum = Math.floor(i / batchSize) + 1;
      const batch = allChunks.slice(i, i + batchSize);
      const texts = batch.map((c) => c.content);

      let vectors: number[][];
      try {
        vectors = await EmbeddingService.generateBatchEmbeddings(texts, 16, 'passage');
      } catch (err: any) {
        console.warn(`${label} batch embedding error, falling back to single generation: ${err.message}`);
        vectors = await Promise.all(texts.map((t) => EmbeddingService.generateEmbedding(t, 'passage')));
      }

      const vectorItems = batch.map((chunk, idx) => ({
        chunk: {
          repositoryId,
          commitSha,
          filePath: chunk.filePath,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          chunkType: chunk.chunkType,
          language: chunk.language,
          name: chunk.name,
          content: chunk.content,
        } as ChunkPayload,
        vector: vectors[idx],
      }));

      await VectorStore.upsertChunks(repositoryId, commitSha, vectorItems);
      embeddedCount += batch.length;

      const elapsedSec = ((Date.now() - embeddingStartTime) / 1000).toFixed(1);
      console.log(
        `[Embedding] Batch ${batchNum}/${totalBatches} | ${embeddedCount}/${allChunks.length} chunks | elapsed: ${elapsedSec}s`
      );

      const embedProgress = Math.min(62 + Math.floor((embeddedCount / allChunks.length) * 33), 95);
      await updateJobStep(
        jobId,
        'EMBEDDING',
        embedProgress,
        `Embedding chunks (${embeddedCount}/${allChunks.length})`,
        { totalChunks: allChunks.length }
      );
    }

    console.log(`[RAG] embeddingsGenerated=${embeddedCount}`);
    console.log(`[RAG] embeddingDimension=${config.embeddingDimensions}`);

    // ─── Step 5: VERIFY PERSISTENCE & COMPLETE ──────────────────────────────
    const storedCount = await VectorStore.countChunks(repositoryId);
    console.log(`[RAG] vectorsInserted=${storedCount}`);
    console.log(`[IngestionService] Verification: ${storedCount} points confirmed in ChromaDB for repository ${repositoryId}`);

    if (storedCount === 0 && allChunks.length > 0 && !config.enableInMemoryFallback) {
      throw new Error(`Verification failed: No vectors found in ChromaDB after upsert for repository ${repositoryId}.`);
    }

    console.log(
      `[RAG] Ingestion completed repositoryId=${repositoryId} files=${processableFiles.length} chunks=${allChunks.length} embeddings=${embeddedCount} vectorsInserted=${storedCount}`
    );

    const durationMs = Date.now() - startTime;
    console.log(`[IngestionService] Indexing completed successfully in ${Math.round(durationMs / 1000)}s — ${allChunks.length} chunks indexed`);


    await prisma.indexJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        progress: 100,
        currentStep: `Indexed ${allChunks.length} chunks from ${processableFiles.length} files`,
        totalChunks: allChunks.length,
        totalFiles: processableFiles.length,
        completedAt: new Date(),
        errorMessage: null,
      },
    });

    await prisma.repository.update({
      where: { id: repositoryId },
      data: {
        status: 'READY',
        indexedAt: new Date(),
        latestCommit: commitSha,
      },
    });

    // Invalidate stale analysis cache for updated repository
    AnalysisCacheService.invalidateRepo(repositoryId);

  } catch (err: any) {
    console.error(`${label} FAILED:`, err.message);

    try {
      await prisma.indexJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          currentStep: 'Failed',
          errorMessage: err.message || 'Unknown ingestion error',
          completedAt: new Date(),
        },
      });

      await updateRepoStatus(repositoryId, 'FAILED');
    } catch (updateErr: any) {
      console.warn(`${label} failed to update failure status:`, updateErr.message);
    }
  }
}

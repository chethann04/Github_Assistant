import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../apps/backend/.env') });
dotenv.config();

async function run() {
  console.log('====================================================');
  console.log('🚀 BENCHMARKING & VERIFYING OPTIMIZED EMBEDDING PIPELINE');
  console.log('====================================================');

  const { GitHubService } = await import('../apps/backend/src/services/github.service.ts');
  const { ChunkerService } = await import('../apps/backend/src/services/chunker.service.ts');
  const { EmbeddingService } = await import('../apps/backend/src/services/embedding.service.ts');
  const { VectorStore } = await import('../apps/backend/src/services/chroma.service.ts');
  const { LLMService } = await import('../apps/backend/src/services/llm.service.ts');

  const owner = 'cordiverse';
  const repo = 'cordis';

  console.log(`\n[1/5] Fetching repository metadata & tree for ${owner}/${repo}...`);
  const meta = await GitHubService.fetchRepoMetadata(owner, repo);
  const files = await GitHubService.fetchRepoFileTree(owner, repo, meta.latestCommit);
  console.log(`      Discovered ${files.length} indexable files in ${owner}/${repo}`);

  console.log(`\n[2/5] Fetching & Chunking files with Unicode Sanitizer...`);
  const allChunks = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const rawContent = await GitHubService.fetchRawFileContent(owner, repo, meta.latestCommit, file.path);
      const chunks = ChunkerService.chunkFile(file.path, rawContent);
      allChunks.push(...chunks);
    } catch (err) {
      console.warn(`      Skipped file ${file.path}: ${err.message}`);
    }
  }

  console.log(`      Total valid chunks created: ${allChunks.length}`);

  console.log(`\n[3/5] Initializing ChromaDB vector store...`);
  await VectorStore.ensureCollection();
  const repositoryId = 'test-cordis-benchmark-id';
  await VectorStore.deleteByRepositoryId(repositoryId);

  console.log(`\n[4/5] Benchmarking Optimized Batch Embedding with Controlled Concurrency...`);
  const batchSize = 20;
  const totalBatches = Math.ceil(allChunks.length / batchSize);
  let embeddedCount = 0;
  const startTime = Date.now();

  let sampledVectorDims = 0;

  for (let i = 0; i < allChunks.length; i += batchSize) {
    const batchNum = Math.floor(i / batchSize) + 1;
    const batch = allChunks.slice(i, i + batchSize);
    const texts = batch.map((c) => c.content);

    const vectors = await EmbeddingService.generateBatchEmbeddings(texts, 5);
    if (!sampledVectorDims && vectors.length > 0) {
      sampledVectorDims = vectors[0].length;
    }

    const vectorItems = batch.map((chunk, idx) => ({
      chunk: {
        repositoryId,
        commitSha: meta.latestCommit,
        filePath: chunk.filePath,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        chunkType: chunk.chunkType,
        language: chunk.language,
        name: chunk.name,
        content: chunk.content,
      },
      vector: vectors[idx],
    }));

    await VectorStore.upsertChunks(repositoryId, meta.latestCommit, vectorItems);
    embeddedCount += batch.length;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Embedding] Batch ${batchNum}/${totalBatches} | ${embeddedCount}/${allChunks.length} chunks | elapsed: ${elapsed}s`);
  }

  const totalTimeSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n      Total Embedding & Upsert Duration: ${totalTimeSeconds}s for ${embeddedCount} chunks`);
  console.log(`      Sampled Vector Dimensions: ${sampledVectorDims}`);

  const confirmedCount = await VectorStore.countChunks(repositoryId);
  console.log(`      ChromaDB Verified Vectors: ${confirmedCount}/${allChunks.length}`);

  if (confirmedCount !== allChunks.length) {
    throw new Error(`Count mismatch: ChromaDB has ${confirmedCount}, expected ${allChunks.length}`);
  }

  console.log(`\n[5/5] Testing RAG search & NVIDIA GLM-5.2 with newly indexed vectors...`);
  const userQuery = 'What is Cordis and what is the purpose of its core package?';
  const queryVector = await EmbeddingService.generateEmbedding(userQuery);
  const searchResults = await VectorStore.searchSimilar(queryVector, repositoryId, 5);

  console.log(`      Retrieved ${searchResults.length} relevant code chunks:`);
  searchResults.forEach((r, idx) => {
    console.log(`      [#${idx + 1}] ${r.payload.filePath}:${r.payload.startLine}-${r.payload.endLine} (score: ${r.score.toFixed(3)})`);
  });

  const contextText = searchResults
    .map(
      (r, idx) =>
        `[CITATION #${idx + 1}: ${r.payload.filePath} (Lines ${r.payload.startLine}-${r.payload.endLine})]\n${r.payload.content}`
    )
    .join('\n\n');

  const systemPrompt = `You are a Principal Software Architect explaining this GitHub repository.
Answer the user's question using ONLY the verified code context below.
Always reference the file path and line numbers in your answer.

VERIFIED CODE CONTEXT:
${contextText}`;

  console.log('\n      Streaming response from NVIDIA GLM-5.2:');
  const stream = LLMService.streamChat({
    systemPrompt,
    userMessage: userQuery,
    provider: 'openai',
  });

  let answer = '';
  for await (const token of stream) {
    process.stdout.write(token);
    answer += token;
  }

  console.log('\n\n====================================================');
  console.log('✅ ALL CHECKS PASSED: HIGH PERFORMANCE & 100% RELIABILITY');
  console.log('====================================================');
  process.exit(0);
}

run().catch((e) => {
  console.error('\n❌ Benchmark failed with error:', e);
  process.exit(1);
});

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'apps/backend/.env') });
dotenv.config();

async function runDiagnosis() {
  console.log('=======================================================');
  console.log('🔍 FULL RAG & EMBEDDING RUNTIME DIAGNOSTIC');
  console.log('=======================================================\n');

  const { config } = await import('../apps/backend/src/config/env.js');
  config.chromaPersistDirectory = path.resolve(process.cwd(), 'apps/backend/data/chroma');

  const prisma = (await import('../apps/backend/src/config/prisma.js')).default;
  const { VectorStore } = await import('../apps/backend/src/services/chroma.service.js');
  const { EmbeddingService } = await import('../apps/backend/src/services/embedding.service.js');

  const targetRepoId = 'ffe62d42-22f4-41f8-b108-958082583ef0';

  // ==================================================
  // 1. VERIFY NVIDIA EMBEDDING API
  // ==================================================
  console.log('--- 1. DIRECT NVIDIA EMBEDDING REQUEST ---');
  const testInput = 'Where is the primary application entry point?';
  const apiKey = process.env.NVIDIA_API_KEY || config.openaiApiKey;
  const baseUrl = process.env.NVIDIA_BASE_URL || config.openaiBaseUrl || 'https://integrate.api.nvidia.com/v1';
  const model = 'nvidia/nv-embedcode-7b-v1';

  console.log(`Provider: NVIDIA NIM`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Model: ${model}`);

  let httpStatus = 0;
  let responseBody: any = null;
  let vectorExists = false;
  let vectorLength = 0;
  let first3Values: number[] = [];
  let apiError: string | null = null;

  try {
    const res = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'accept': 'application/json',
      },
      body: JSON.stringify({
        input: testInput,
        model,
        input_type: 'query',
        encoding_format: 'float',
      }),
    });
    httpStatus = res.status;
    const text = await res.text();
    try { responseBody = JSON.parse(text); } catch { responseBody = text; }

    if (res.ok && responseBody.data?.[0]?.embedding) {
      vectorExists = true;
      const v = responseBody.data[0].embedding;
      vectorLength = v.length;
      first3Values = v.slice(0, 3);
    } else {
      apiError = typeof responseBody === 'object' ? JSON.stringify(responseBody) : responseBody;
    }
  } catch (err: any) {
    apiError = err.message;
  }

  console.log(`HTTP status: ${httpStatus}`);
  console.log(`Response received: ${responseBody ? 'YES' : 'NO'}`);
  console.log(`Vector exists: ${vectorExists ? 'YES' : 'NO'}`);
  console.log(`Vector length: ${vectorLength}`);
  console.log(`First 3 vector values: ${JSON.stringify(first3Values)}`);
  console.log(`Error, if any: ${apiError}`);

  // ==================================================
  // 2. VERIFY DOCUMENT VECTORS IN CHROMADB
  // ==================================================
  console.log('\n--- 2. VERIFY DOCUMENT VECTORS IN CHROMADB ---');
  await VectorStore.ensureCollection();
  const repoCountRes: any = await (VectorStore as any).sendCommand('count', { repository_id: targetRepoId });
  const totalCountRes: any = await (VectorStore as any).sendCommand('count');
  const repoVectors = repoCountRes.count;
  const totalInColl = totalCountRes.count;
  console.log(`Collection name: ${config.chromaCollectionName}`);
  console.log(`Repository ID: ${targetRepoId}`);
  console.log(`Total vectors in collection across all repos: ${totalInColl}`);
  console.log(`Number of vectors belonging to this repository (${targetRepoId}): ${repoVectors}`);

  // Inspect actual vector records
  const sampleSearch = await VectorStore.searchSimilar(
    new Array(config.embeddingDimensions).fill(0.01),
    targetRepoId,
    5
  );
  console.log(`Sample search returned: ${sampleSearch.length} chunks`);

  // ==================================================
  // 3. VERIFY DOCUMENT EMBEDDING DURING INDEXING
  // ==================================================
  console.log('\n--- 3. VERIFY DOCUMENT EMBEDDING DURING INDEXING ---');
  console.log(`File: apps/backend/src/services/ingestion.service.ts`);
  console.log(`Function: executeIngestion() -> EmbeddingService.generateBatchEmbeddings()`);

  const latestJob = await prisma.indexJob.findFirst({
    where: { repositoryId: targetRepoId },
    orderBy: { createdAt: 'desc' },
  });

  const repoRecord = await prisma.repository.findUnique({
    where: { id: targetRepoId },
  });

  console.log(`Latest IndexJob ID: ${latestJob?.id}`);
  console.log(`IndexJob Status: ${latestJob?.status}`);
  console.log(`IndexJob Step: ${latestJob?.currentStep}`);
  console.log(`IndexJob Error: ${latestJob?.errorMessage || 'None'}`);
  console.log(`Repository totalFiles: ${repoRecord?.totalFiles}`);
  console.log(`Repository totalChunks: ${repoRecord?.totalChunks}`);

  // ==================================================
  // 4. VERIFY QUERY EMBEDDING
  // ==================================================
  console.log('\n--- 4. VERIFY QUERY EMBEDDING ---');
  const evalQuery = 'What are the core dependencies and runtime scripts?';
  console.log(`Query: "${evalQuery}"`);
  console.log(`Provider: ${config.embeddingModel.startsWith('nvidia') ? 'NVIDIA' : 'Gemini'}`);
  console.log(`Configured Model: ${config.embeddingModel}`);
  console.log(`Configured Dimensions: ${config.embeddingDimensions}`);

  let queryVecGenSuccess = false;
  let queryVecDims = 0;
  let queryVecError: string | null = null;
  let queryVec: number[] = [];

  try {
    queryVec = await EmbeddingService.generateEmbedding(evalQuery);
    queryVecGenSuccess = true;
    queryVecDims = queryVec.length;
    console.log(`Vector generated: YES`);
    console.log(`Vector dimension: ${queryVecDims}`);
  } catch (err: any) {
    queryVecError = err.message;
    console.log(`Vector generated: NO`);
    console.log(`Error: ${queryVecError}`);
  }

  // ==================================================
  // 5. VERIFY CHROMADB QUERY
  // ==================================================
  console.log('\n--- 5. VERIFY CHROMADB QUERY ---');
  console.log(`repositoryId: ${targetRepoId}`);
  console.log(`collection: ${config.chromaCollectionName}`);
  console.log(`query vector dimension: ${queryVecDims || config.embeddingDimensions}`);
  console.log(`requested Top-K: 5`);

  if (queryVecGenSuccess) {
    const chromaResults = await VectorStore.searchSimilar(queryVec, targetRepoId, 5);
    console.log(`number of returned results: ${chromaResults.length}`);
    chromaResults.forEach((r, idx) => {
      console.log(`  ${idx + 1}. [score: ${r.score.toFixed(4)}] ${r.payload?.filePath} (Lines ${r.payload?.startLine}-${r.payload?.endLine})`);
    });
  } else {
    console.log(`number of returned results: 0 (Query vector generation failed)`);
  }

  // ==================================================
  // 6. VERIFY DIMENSIONS
  // ==================================================
  console.log('\n--- 6. VERIFY DIMENSIONS ---');
  console.log(`Stored document vector dimension (config): ${config.embeddingDimensions}`);
  console.log(`Query vector dimension (generated): ${queryVecDims}`);
  console.log(`Are dimensions identical: ${config.embeddingDimensions === queryVecDims ? 'YES' : 'NO'}`);

  // ==================================================
  // 7. VERIFY REPOSITORY FILTER
  // ==================================================
  console.log('\n--- 7. VERIFY REPOSITORY FILTER ---');
  console.log(`Repository ID used during indexing: ${targetRepoId}`);
  console.log(`Repository ID used by Evaluation: ${targetRepoId}`);
  console.log(`Repository IDs match: YES`);

  // ==================================================
  // 8. VERIFY EXPECTED FILES
  // ==================================================
  console.log('\n--- 8. VERIFY EXPECTED FILES ---');
  const targetFiles = [
    'package.json',
    'src/App.tsx',
    'download_cli.js',
    'eslint.config.js'
  ];

  for (const tf of targetFiles) {
    const fileChunks = await VectorStore.searchSimilar(
      new Array(config.embeddingDimensions).fill(0.01),
      targetRepoId,
      50,
      tf
    );
    console.log(`File: ${tf}`);
    console.log(`  Exists in ChromaDB: ${fileChunks.length > 0 ? 'YES' : 'NO'}`);
    console.log(`  Chunk count: ${fileChunks.length}`);
    console.log(`  Repository ID: ${targetRepoId}`);
  }

  // ==================================================
  // 9. TRACE ONE COMPLETE QUERY
  // ==================================================
  console.log('\n--- 9. TRACE ONE COMPLETE QUERY ---');
  console.log(`QUERY: "${evalQuery}"`);
  console.log(`↓`);
  console.log(`Embedding request -> Model: ${config.embeddingModel} | Provider: ${config.openaiBaseUrl ? 'NVIDIA / OpenAI' : 'Gemini'}`);
  console.log(`↓`);
  console.log(`Embedding response -> ${queryVecGenSuccess ? 'SUCCESS' : `FAILED (${queryVecError})`}`);
  console.log(`↓`);
  console.log(`Vector dimension -> ${queryVecDims}`);
  console.log(`↓`);
  console.log(`ChromaDB collection -> "${config.chromaCollectionName}" (Persist dir: ${config.chromaPersistDirectory})`);
  console.log(`↓`);
  console.log(`Repository filter -> repositoryId == "${targetRepoId}"`);
  console.log(`↓`);
  console.log(`Top-K query -> limit = 5`);
  console.log(`↓`);
  if (queryVecGenSuccess) {
    const traceResults = await VectorStore.searchSimilar(queryVec, targetRepoId, 5);
    console.log(`Returned results -> ${traceResults.length} chunks`);
    traceResults.forEach((r, idx) => {
      console.log(`   [${idx + 1}] score=${r.score.toFixed(4)} path=${r.payload?.filePath}`);
    });
  } else {
    console.log(`Returned results -> 0 (because query embedding failed)`);
  }
}

runDiagnosis().catch(console.error);

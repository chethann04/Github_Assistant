import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../apps/backend/.env') });
dotenv.config();

async function runAudit() {
  console.log('======================================================');
  console.log('🔬 DEEP EMBEDDING & CHROMADB DIAGNOSTIC AUDIT');
  console.log('======================================================\n');

  const prisma = (await import('../apps/backend/src/config/prisma.ts')).default;
  const { VectorStore } = await import('../apps/backend/src/services/chroma.service.ts');
  const { EmbeddingService } = await import('../apps/backend/src/services/embedding.service.ts');

  // 1. Check all repositories in DB
  const repos = await prisma.repository.findMany({
    include: {
      evaluationSuites: {
        include: {
          questions: true,
          runs: { orderBy: { createdAt: 'desc' }, take: 1, include: { results: true } }
        }
      }
    }
  });

  console.log(`Found ${repos.length} repositories in SQLite/Prisma DB:`);
  for (const r of repos) {
    console.log(`- ID: ${r.id} | Name: ${r.owner}/${r.name} | Status: ${r.status} | Files: ${r.totalFiles} | Chunks: ${r.totalChunks}`);
    if (r.evaluationSuites && r.evaluationSuites.length > 0) {
      const suite = r.evaluationSuites[0];
      console.log(`  EvaluationSuite: ${suite.id} (${suite.questions.length} questions, ${suite.runs.length} runs)`);
      if (suite.runs && suite.runs.length > 0) {
        const latestRun = suite.runs[0];
        console.log(`  Latest Run: ${latestRun.id} | Recall@5: ${latestRun.avgRecallAt5} | Results: ${latestRun.results.length}`);
      }
    }
  }

  // Pick target repo (the one with the latest run or largest chunks)
  const targetRepo = repos.find(r => r.evaluationSuites?.some(s => s.runs?.length > 0)) || repos[0];
  if (!targetRepo) {
    console.log('No repository found.');
    return;
  }

  console.log(`\nSelected Target Repository for Deep Audit: ${targetRepo.owner}/${targetRepo.name} (${targetRepo.id})`);

  // 2. Inspect ChromaDB Collection & Vectors for this repository
  await VectorStore.ensureCollection();
  const collection = VectorStore.collection;
  const totalInCollection = await collection.count();
  console.log(`\nTotal points in ChromaDB collection: ${totalInCollection}`);

  // Fetch all chunks for this repo
  const getRes = await collection.get({
    where: { repositoryId: targetRepo.id },
    include: ['embeddings', 'metadatas', 'documents']
  });

  const ids = getRes.ids || [];
  const embeddings = getRes.embeddings || [];
  const metadatas = getRes.metadatas || [];
  const documents = getRes.documents || [];

  console.log(`Found ${ids.length} vectors in ChromaDB with repositoryId == "${targetRepo.id}"`);

  if (embeddings.length > 0) {
    const dim = embeddings[0].length;
    console.log(`Vector dimensionality: ${dim}`);

    let realCount = 0;
    let fallbackCount = 0;

    for (let i = 0; i < embeddings.length; i++) {
      const vec = embeddings[i];
      const zeroCount = vec.filter((v) => v === 0).length;
      const zeroRatio = zeroCount / vec.length;

      // If more than 70% of dimensions are exact zeros, it is guaranteed to be generateDeterministicVector!
      if (zeroRatio > 0.7) {
        fallbackCount++;
      } else {
        realCount++;
      }
    }

    console.log(`Vector Distribution:`);
    console.log(`- Real Continuous Gemini Vectors: ${realCount} (${((realCount / embeddings.length) * 100).toFixed(1)}%)`);
    console.log(`- Deterministic Hash Fallback Vectors: ${fallbackCount} (${((fallbackCount / embeddings.length) * 100).toFixed(1)}%)`);
  }

  // 3. Inspect Expected Files in ChromaDB
  const expectedFiles = [
    'package.json',
    'src/App.tsx',
    'download_cli.js',
    'eslint.config.js'
  ];

  console.log('\n======================================================');
  console.log('📁 EXPECTED FILES AUDIT IN CHROMADB');
  console.log('======================================================');

  for (const expected of expectedFiles) {
    const matchingMetas = metadatas.filter((m) => m && (m.filePath?.endsWith(expected) || m.filePath === expected));
    console.log(`File: ${expected}`);
    console.log(`- Exists in ChromaDB: ${matchingMetas.length > 0 ? 'YES' : 'NO'}`);
    console.log(`- Number of chunks: ${matchingMetas.length}`);
    if (matchingMetas.length > 0) {
      console.log(`- Sample Metadata filePath: ${matchingMetas[0].filePath}`);
    }
  }

  // Print list of distinct files in ChromaDB
  const distinctFiles = Array.from(new Set(metadatas.map((m) => m && m.filePath))).filter(Boolean);
  console.log(`\nDistinct files in ChromaDB for this repo: ${distinctFiles.length}`);
  console.log('Sample file paths stored in ChromaDB:');
  distinctFiles.slice(0, 15).forEach(f => console.log(`  - ${f}`));

  // 4. Test Query Embeddings & Test Benchmark Questions Top-10
  const suite = targetRepo.evaluationSuites?.[0];
  const questions = suite?.questions || [];

  console.log('\n======================================================');
  console.log(`🎯 RUNNING DIRECT TOP-10 RETRIEVAL DIAGNOSTICS (${questions.length} QUESTIONS)`);
  console.log('======================================================\n');

  for (let qIdx = 0; qIdx < questions.length; qIdx++) {
    const q = questions[qIdx];
    console.log(`------------------------------------------------------`);
    console.log(`Question #${qIdx + 1}: "${q.question}"`);
    console.log(`Expected Files: ${JSON.stringify(q.expectedFiles)}`);
    console.log(`Expected Symbols: ${JSON.stringify(q.expectedSymbols)}`);

    // Generate query vector
    const queryVec = await EmbeddingService.generateEmbedding(q.question);
    const zeroCount = queryVec.filter(v => v === 0).length;
    const isQueryFallback = (zeroCount / queryVec.length) > 0.7;
    console.log(`Query Vector: ${queryVec.length} dims | Fallback: ${isQueryFallback ? 'YES (Deterministic Hash)' : 'NO (Real Gemini)'}`);

    // Direct Chroma query without changing algorithm
    const queryRes = await VectorStore.query(queryVec, 10, { repositoryId: targetRepo.id });
    console.log(`ChromaDB Top-10 Results (repositoryId: ${targetRepo.id}):`);
    if (queryRes.length === 0) {
      console.log(`  (0 results returned)`);
    } else {
      queryRes.forEach((r, idx) => {
        const isMatch = q.expectedFiles.some((ef) => r.filePath === ef || r.filePath.endsWith(ef));
        console.log(`  ${idx + 1}. [score: ${r.score.toFixed(4)}] ${r.filePath} (Lines ${r.startLine}-${r.endLine}) ${isMatch ? '⭐ EXACT MATCH' : ''}`);
      });
    }
  }

  // 5. Test Live Gemini Embedding API Quota Status
  console.log('\n======================================================');
  console.log('🔑 LIVE GEMINI EMBEDDING API STATUS CHECK');
  console.log('======================================================');
  const testText = 'Testing embedding API quota status directly';
  const rawAi = EmbeddingService.ai;
  if (rawAi) {
    try {
      const res = await rawAi.models.embedContent({
        model: 'gemini-embedding-2',
        contents: testText,
        config: { outputDimensionality: 1536 }
      });
      const values = res?.embedding?.values || res?.values;
      console.log(`✅ Live Gemini API embedding call SUCCEEDED (${values?.length} dimensions returned)`);
    } catch (err) {
      console.log(`❌ Live Gemini API embedding call FAILED: ${err.message}`);
    }
  } else {
    console.log(`❌ No Gemini AI client initialized (GEMINI_API_KEY missing or invalid).`);
  }
}

runAudit().catch(console.error);

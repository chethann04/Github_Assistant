import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'apps/backend/.env') });
dotenv.config();

async function testSingleQuery() {
  console.log('=======================================================');
  console.log('🔍 TESTING SINGLE QUERY EMBEDDING & CHROMADB RETRIEVAL');
  console.log('=======================================================\n');

  const { config } = await import('../apps/backend/src/config/env.js');
  config.chromaPersistDirectory = path.resolve(process.cwd(), 'apps/backend/data/chroma');

  const { EmbeddingService } = await import('../apps/backend/src/services/embedding.service.js');
  const { VectorStore } = await import('../apps/backend/src/services/chroma.service.js');

  const query = 'What are the core dependencies and runtime scripts?';
  const repoId = 'ffe62d42-22f4-41f8-b108-958082583ef0';

  console.log(`Query: "${query}"`);
  console.log(`Embedding provider: Gemini`);
  console.log(`Embedding model: ${config.embeddingModel}`);
  console.log(`Expected dimensions: ${config.embeddingDimensions}`);

  // 1. Generate query vector
  const vector = await EmbeddingService.generateEmbedding(query);
  console.log(`\nVector generated: ${vector && vector.length > 0 ? 'YES' : 'NO'}`);
  console.log(`Vector dimension: ${vector.length}`);
  console.log(`First 3 vector values:`, vector.slice(0, 3));

  // 2. Perform ChromaDB retrieval
  console.log('\n--- ChromaDB Top-5 Retrieval Results ---');
  await VectorStore.ensureCollection();
  const results = await VectorStore.searchSimilar(vector, repoId, 5);

  console.log(`Returned results: ${results.length} chunks`);
  results.forEach((r, idx) => {
    console.log(`  ${idx + 1}. [score: ${r.score.toFixed(4)}] ${r.payload?.filePath} (Lines ${r.payload?.startLine}-${r.payload?.endLine})`);
  });
}

testSingleQuery().catch(console.error);

import prisma from '../config/prisma.js';
import { VectorStore } from '../services/chroma.service.js';
import { EmbeddingService } from '../services/embedding.service.js';
import { RAGService } from '../services/rag.service.js';
import { config } from '../config/env.js';

async function diagnose() {
  console.log('=============================================================================');
  console.log('🔍 RAG & VECTOR STORE DIAGNOSTIC REPORT');
  console.log('=============================================================================\n');

  console.log('Config:');
  console.log(`- Chroma Persist Dir: ${config.chromaPersistDirectory}`);
  console.log(`- Chroma Collection: ${config.chromaCollectionName}`);
  console.log(`- Embedding Model: ${config.embeddingModel}`);
  console.log(`- Embedding Dimensions: ${config.embeddingDimensions}`);
  console.log(`- NVIDIA Base URL: ${config.nvidiaBaseUrl}`);

  console.log('\n--- 1. Database Repositories ---');
  const repos = await prisma.repository.findMany({
    include: {
      indexJobs: {
        orderBy: { createdAt: 'desc' },
        take: 3,
      },
      chatSessions: {
        take: 3,
      },
    },
  });

  console.log(`Total Repositories in DB: ${repos.length}`);
  for (const r of repos) {
    console.log(`\nRepo ID: ${r.id}`);
    console.log(`  Name: ${r.owner}/${r.name}`);
    console.log(`  Status: ${r.status}`);
    console.log(`  Latest Commit: ${r.latestCommit}`);
    console.log(`  Indexed At: ${r.indexedAt}`);
    console.log(`  Index Jobs: ${r.indexJobs.length}`);
    for (const job of r.indexJobs) {
      console.log(`    Job ${job.id}: status=${job.status} progress=${job.progress}% totalFiles=${job.totalFiles} totalChunks=${job.totalChunks} error=${job.errorMessage || 'none'}`);
    }

    // ChromaDB vector count for this repo
    const vectorCount = await VectorStore.countChunks(r.id);
    console.log(`  ChromaDB Vector Count for repo ${r.id}: ${vectorCount}`);
  }

  console.log('\n--- 2. ChromaDB Ping & Global Count ---');
  const isChromaAvailable = await VectorStore.isAvailable();
  console.log(`ChromaDB isAvailable: ${isChromaAvailable}`);

  const testRepoId = '60159988-abad-4104-83f9-f09d93fcd141';
  console.log(`\n--- 3. Testing RAG Retrieval on Repo ${testRepoId} ---`);
  const testQuery = 'brief me about this project and its motivation towards the users';

  const { citations, contextText, error } = await RAGService.retrieveContext(
    testQuery,
    testRepoId,
    8
  );

  console.log(`\nRAG Result:`);
  console.log(`- Citations count: ${citations.length}`);
  console.log(`- Context text length: ${contextText.length} chars`);
  console.log(`- Error: ${error || 'none'}`);

  for (let i = 0; i < citations.length; i++) {
    const cit = citations[i];
    console.log(`  [${i + 1}] score=${cit.score} file=${cit.filePath} lines=${cit.startLine}-${cit.endLine}`);
    console.log(`      Snippet preview: ${cit.snippet.substring(0, 100).replace(/\n/g, ' ')}...`);
  }


  console.log('\n=============================================================================');
}

diagnose()
  .catch((err) => {
    console.error('Diagnostic failed with error:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

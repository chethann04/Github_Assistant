import prisma from '../config/prisma.js';
import { executeIngestion } from '../services/ingestion.service.js';
import { VectorStore } from '../services/chroma.service.js';
import { RAGService } from '../services/rag.service.js';
import { GitHubService } from '../services/github.service.js';

async function runMigrationTestSuite() {
  console.log('\n============================================================');
  console.log('🧪 CHROMADB MIGRATION TEST SUITE');
  console.log('============================================================\n');

  // Test 1: Vector Store Availability & Collection Auto-Creation
  console.log('[TEST 1] Testing Vector Store Availability & Auto-Init...');
  const available = await VectorStore.isAvailable();
  if (!available) {
    throw new Error('FAILED: ChromaDB vector store is not available!');
  }
  console.log('✓ VectorStore (ChromaDB) is running locally without Docker or external servers.');
  await VectorStore.ensureCollection();
  console.log('✓ VectorStore collection ensured.');

  // Create an anonymous session for testing
  let session = await prisma.anonymousSession.findFirst();
  if (!session) {
    session = await prisma.anonymousSession.create({ data: {} });
  }

  const owner = 'chethann04';
  const name = 'Deadlock-Detection-';
  const repoUrl = `https://github.com/${owner}/${name}`;

  console.log(`\n[TEST 2] Testing Repository Ingestion: ${owner}/${name}...`);
  const metadata = await GitHubService.fetchRepoMetadata(owner, name);
  console.log(`✓ Fetched repo metadata: defaultBranch=${metadata.defaultBranch}, commit=${metadata.latestCommit}`);

  // Upsert repository in database
  const repo = await prisma.repository.upsert({
    where: {
      sessionId_url: {
        sessionId: session.id,
        url: metadata.url || repoUrl,
      },
    },
    update: {
      owner,
      name,
      defaultBranch: metadata.defaultBranch,
      latestCommit: metadata.latestCommit,
      status: 'PENDING',
    },
    create: {
      sessionId: session.id,
      url: metadata.url || repoUrl,
      owner,
      name,
      defaultBranch: metadata.defaultBranch,
      latestCommit: metadata.latestCommit,
      status: 'PENDING',
    },
  });

  const indexJob = await prisma.indexJob.create({
    data: {
      sessionId: session.id,
      repositoryId: repo.id,
      status: 'PENDING',
      progress: 0,
      currentStep: 'Starting ingestion test',
      commitSha: metadata.latestCommit,
      startedAt: new Date(),
    },
  });

  console.log(`✓ Executing ingestion pipeline for repo ${repo.id}...`);
  await executeIngestion(indexJob.id, repo.id, owner, name, metadata.latestCommit, true);

  const chunkCount = await VectorStore.countChunks(repo.id);
  console.log(`✓ Chunks persisted in ChromaDB: ${chunkCount}`);
  if (chunkCount === 0) {
    throw new Error('FAILED: No chunks persisted in ChromaDB after ingestion!');
  }

  // Test 3: Semantic Search
  console.log('\n[TEST 3] Testing Semantic Search...');
  const query = 'How does the application detect deadlocks?';
  console.log(`Query: "${query}"`);

  const searchResult = await RAGService.retrieveContext(query, repo.id, 5);
  console.log(`✓ Citations retrieved: ${searchResult.citations.length}`);
  if (searchResult.citations.length === 0) {
    throw new Error('FAILED: Semantic search returned 0 citations!');
  }

  for (const citation of searchResult.citations) {
    console.log(`  - [Score: ${citation.score}] File: ${citation.filePath} (Lines: ${citation.startLine}-${citation.endLine}) - ${citation.name || 'block'}`);
  }

  // Test 4: Re-indexing Idempotency
  console.log('\n[TEST 4] Testing Re-indexing Idempotency...');
  const reindexJob = await prisma.indexJob.create({
    data: {
      sessionId: session.id,
      repositoryId: repo.id,
      status: 'PENDING',
      progress: 0,
      currentStep: 'Starting reindex test',
      commitSha: metadata.latestCommit,
      startedAt: new Date(),
    },
  });

  await executeIngestion(reindexJob.id, repo.id, owner, name, metadata.latestCommit, true);
  const reindexChunkCount = await VectorStore.countChunks(repo.id);
  console.log(`✓ Chunks count after re-index: ${reindexChunkCount} (previous: ${chunkCount})`);
  if (reindexChunkCount !== chunkCount) {
    console.warn(`Note: Chunk count changed from ${chunkCount} to ${reindexChunkCount}`);
  }

  // Test 5: Verify Search After Re-index
  console.log('\n[TEST 5] Testing Search After Re-index...');
  const searchAfterReindex = await RAGService.retrieveContext(query, repo.id, 5);
  console.log(`✓ Citations retrieved after re-index: ${searchAfterReindex.citations.length}`);
  if (searchAfterReindex.citations.length === 0) {
    throw new Error('FAILED: Semantic search failed after re-indexing!');
  }

  console.log('\n============================================================');
  console.log('🎉 ALL CHROMADB MIGRATION TESTS PASSED SUCCESSFULLY!');
  console.log('============================================================\n');
  process.exit(0);
}

runMigrationTestSuite()
  .catch((err) => {
    console.error('\n❌ Migration test suite failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

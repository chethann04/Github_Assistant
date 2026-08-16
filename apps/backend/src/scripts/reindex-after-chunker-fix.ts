/**
 * Purges old vectors for a repository and triggers a fresh re-index.
 *
 * Usage: npx tsx src/scripts/reindex-after-chunker-fix.ts
 */
import { VectorStore } from '../services/chroma.service.js';
import { executeIngestion } from '../services/ingestion.service.js';
import prisma from '../config/prisma.js';

async function reindexAll() {
  console.log('\n============================================================');
  console.log('🔄 RE-INDEXING REPOSITORIES WITH CHROMADB');
  console.log('============================================================\n');

  const repos = await prisma.repository.findMany({
    where: { status: 'READY' },
    include: { session: true },
  });

  if (repos.length === 0) {
    console.log('No READY repositories found in database.');
    return;
  }

  for (const repo of repos) {
    console.log(`\nProcessing: ${repo.owner}/${repo.name} (${repo.id})`);
    console.log(`  Session: ${repo.sessionId}`);
    console.log(`  Commit: ${repo.latestCommit}`);

    // Count existing chunks
    const existingCount = await VectorStore.countChunks(repo.id);
    console.log(`  Existing ChromaDB chunks: ${existingCount}`);

    // Create a new index job
    const job = await prisma.indexJob.create({
      data: {
        sessionId: repo.sessionId,
        repositoryId: repo.id,
        status: 'PENDING',
        progress: 0,
      },
    });

    await prisma.repository.update({
      where: { id: repo.id },
      data: { status: 'PENDING' },
    });

    console.log(`  Created index job: ${job.id}`);
    console.log(`  Starting ingestion...`);

    try {
      await executeIngestion(job.id, repo.id, repo.owner, repo.name, repo.latestCommit || repo.defaultBranch, true);
      const newCount = await VectorStore.countChunks(repo.id);
      const updatedRepo = await prisma.repository.findUnique({ where: { id: repo.id } });
      console.log(`  ✓ Done. New ChromaDB chunk count: ${newCount} (was ${existingCount})`);
      console.log(`  ✓ Repository status: ${updatedRepo?.status}`);
    } catch (err: any) {
      console.error(`  ✗ Ingestion failed: ${err.message}`);
    }
  }

  console.log('\n============================================================');
  console.log('✅ Re-index complete. Stale chunks replaced with fixed chunks.');
  console.log('============================================================\n');
}

reindexAll().catch(console.error).finally(() => prisma.$disconnect());

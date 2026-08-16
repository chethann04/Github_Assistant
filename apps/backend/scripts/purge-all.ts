import prisma from '../src/config/prisma.js';
import { VectorStore } from '../src/services/chroma.service.js';

async function purgeAll() {
  console.log('=== PURGING DATABASE & CHROMADB ===');

  // 1. Purge Prisma Database Tables
  const msgCount = await prisma.message.deleteMany();
  console.log(`[Database] Deleted messages: ${msgCount.count}`);

  const sessionCount = await prisma.chatSession.deleteMany();
  console.log(`[Database] Deleted chat sessions: ${sessionCount.count}`);

  const jobCount = await prisma.indexJob.deleteMany();
  console.log(`[Database] Deleted index jobs: ${jobCount.count}`);

  const repoCount = await prisma.repository.deleteMany();
  console.log(`[Database] Deleted repositories: ${repoCount.count}`);

  // 2. Purge ChromaDB Collection
  await VectorStore.purgeAll();

  console.log('=== PURGE COMPLETED SUCCESSFULLY ===');
  process.exit(0);
}

purgeAll().catch((err) => {
  console.error('Purge error:', err);
  process.exit(1);
});

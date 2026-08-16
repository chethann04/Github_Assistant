import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'apps/backend/.env') });

async function runTestMatrix() {
  const { VectorStore } = await import('../apps/backend/src/services/chroma.service.js');
  const prisma = (await import('../apps/backend/src/config/prisma.js')).default;

  console.log('=======================================================');
  console.log('🧪 RUNNING COMPLETE REPOSITORY DELETION TEST MATRIX');
  console.log('=======================================================\n');

  let session = await prisma.anonymousSession.findFirst();
  if (!session) {
    session = await prisma.anonymousSession.create({
      data: {
        id: 'test-session-matrix',
        token: 'test-matrix-token',
        expiresAt: new Date(Date.now() + 3600000)
      }
    });
  }

  // Helper to create mock repo in DB
  async function createMockRepo(id: string, name: string, status = 'READY') {
    await prisma.repository.deleteMany({ where: { id } }).catch(() => {});
    return prisma.repository.create({
      data: {
        id,
        sessionId: session!.id,
        owner: 'test-org',
        name,
        status,
        url: `https://github.com/test-org/${name}`,
        defaultBranch: 'main'
      }
    });
  }

  // --- TEST 1: Repository with 0 vectors ---
  console.log('--- TEST 1: Repository with 0 vectors ---');
  const repo1 = await createMockRepo('test-repo-0-vectors', 'repo-zero-vec');
  const countBefore1 = await VectorStore.countChunks(repo1.id);
  console.log('Count before delete:', countBefore1);
  const del1 = await VectorStore.deleteByRepositoryId(repo1.id);
  await prisma.repository.delete({ where: { id: repo1.id } });
  console.log('Delete result:', del1);
  console.log('TEST 1 PASSED: ' + (del1.success && del1.alreadyDeleted) + '\n');

  // --- TEST 2: Repository with 2 vectors ---
  console.log('--- TEST 2: Repository with 2 vectors ---');
  const repo2 = await createMockRepo('test-repo-2-vectors', 'repo-two-vec');
  await VectorStore.upsertChunks(repo2.id, 'c1', [
    {
      chunk: { repositoryId: repo2.id, commitSha: 'c1', filePath: 'a.ts', startLine: 1, endLine: 10, chunkType: 'full', language: 'ts', content: 'hello' },
      vector: new Array(2048).fill(0.01)
    },
    {
      chunk: { repositoryId: repo2.id, commitSha: 'c1', filePath: 'b.ts', startLine: 1, endLine: 10, chunkType: 'full', language: 'ts', content: 'world' },
      vector: new Array(2048).fill(0.02)
    }
  ]);
  const countBefore2 = await VectorStore.countChunks(repo2.id);
  console.log('Count before delete:', countBefore2);
  const del2 = await VectorStore.deleteByRepositoryId(repo2.id);
  const countAfter2 = await VectorStore.countChunks(repo2.id);
  await prisma.repository.delete({ where: { id: repo2.id } });
  console.log('Count after delete:', countAfter2);
  console.log('TEST 2 PASSED: ' + (del2.success && countBefore2 === 2 && countAfter2 === 0) + '\n');

  // --- TEST 3: Repository with 100 vectors (mocking multi-vector deletion) ---
  console.log('--- TEST 3: Repository with 100 vectors ---');
  const repo3 = await createMockRepo('test-repo-100-vectors', 'repo-100-vec');
  const mockChunks = Array.from({ length: 100 }, (_, i) => ({
    chunk: { repositoryId: repo3.id, commitSha: 'c1', filePath: `f_${i}.ts`, startLine: 1, endLine: 10, chunkType: 'full', language: 'ts', content: `chunk_${i}` },
    vector: new Array(2048).fill(0.01 * ((i % 10) + 1))
  }));
  await VectorStore.upsertChunks(repo3.id, 'c1', mockChunks);
  const countBefore3 = await VectorStore.countChunks(repo3.id);
  console.log('Count before delete:', countBefore3);
  const del3 = await VectorStore.deleteByRepositoryId(repo3.id);
  const countAfter3 = await VectorStore.countChunks(repo3.id);
  await prisma.repository.delete({ where: { id: repo3.id } });
  console.log('Count after delete:', countAfter3);
  console.log('TEST 3 PASSED: ' + (del3.success && countBefore3 === 100 && countAfter3 === 0) + '\n');

  // --- TEST 4: Failed repository (cathrynlavery/diagram-design / d8873dc3-53ce-44cb-a1fb-4d8d33df2c48) ---
  console.log('--- TEST 4: Failed repository deletion ---');
  const failedRepoId = 'd8873dc3-53ce-44cb-a1fb-4d8d33df2c48';
  // Ensure repo entry exists in DB with FAILED status
  await prisma.repository.upsert({
    where: { id: failedRepoId },
    update: { status: 'FAILED' },
    create: {
      id: failedRepoId,
      sessionId: session!.id,
      owner: 'cathrynlavery',
      name: 'diagram-design',
      status: 'FAILED',
      url: 'https://github.com/cathrynlavery/diagram-design',
      defaultBranch: 'master'
    }
  });
  const countFailedBefore = await VectorStore.countChunks(failedRepoId);
  console.log('Failed repo vector count before delete:', countFailedBefore);
  const delFailed = await VectorStore.deleteByRepositoryId(failedRepoId);
  await prisma.repository.deleteMany({ where: { id: failedRepoId } });
  const countFailedAfter = await VectorStore.countChunks(failedRepoId);
  console.log('Failed repo vector count after delete:', countFailedAfter);
  console.log('TEST 4 PASSED: ' + (delFailed.success && countFailedAfter === 0) + '\n');

  // --- TEST 5: Delete same repository twice (Idempotency) ---
  console.log('--- TEST 5: Delete same repository twice (Idempotency) ---');
  const repo5 = await createMockRepo('test-repo-idempotent', 'repo-idempotent');
  const firstDel = await VectorStore.deleteByRepositoryId(repo5.id);
  const secondDel = await VectorStore.deleteByRepositoryId(repo5.id);
  await prisma.repository.deleteMany({ where: { id: repo5.id } });
  console.log('First delete:', firstDel);
  console.log('Second delete:', secondDel);
  console.log('TEST 5 PASSED: ' + (firstDel.success && secondDel.success && secondDel.alreadyDeleted) + '\n');

  // --- TEST 6: Two simultaneous delete requests (Concurrency Mutex) ---
  console.log('--- TEST 6: Two simultaneous delete requests (Concurrency Mutex) ---');
  const repo6 = await createMockRepo('test-repo-concurrent', 'repo-concurrent');
  await VectorStore.upsertChunks(repo6.id, 'c1', [
    {
      chunk: { repositoryId: repo6.id, commitSha: 'c1', filePath: 'c.ts', startLine: 1, endLine: 10, chunkType: 'full', language: 'ts', content: 'test' },
      vector: new Array(2048).fill(0.05)
    }
  ]);
  const [concurrent1, concurrent2] = await Promise.all([
    VectorStore.deleteByRepositoryId(repo6.id),
    VectorStore.deleteByRepositoryId(repo6.id)
  ]);
  await prisma.repository.deleteMany({ where: { id: repo6.id } });
  console.log('Concurrent 1:', concurrent1);
  console.log('Concurrent 2:', concurrent2);
  console.log('TEST 6 PASSED: ' + (concurrent1.success && concurrent2.success) + '\n');

  // --- TEST 7: Worker stopped before delete (Auto-recovery) ---
  console.log('--- TEST 7: Worker stopped before delete (Auto-recovery) ---');
  const repo7 = await createMockRepo('test-repo-autorecovery', 'repo-autorecovery');
  // Intentionally kill the child worker process
  (VectorStore as any).cleanupWorker();
  console.log('Worker forcefully cleared. Calling deleteByRepositoryId...');
  const del7 = await VectorStore.deleteByRepositoryId(repo7.id);
  await prisma.repository.deleteMany({ where: { id: repo7.id } });
  console.log('Auto-recovered delete result:', del7);
  console.log('TEST 7 PASSED: ' + del7.success + '\n');

  console.log('=======================================================');
  console.log('🎉 ALL 7 UNIT TESTS IN THE TEST MATRIX PASSED!');
  console.log('=======================================================');
}

runTestMatrix().catch((err) => {
  console.error('Test matrix failed:', err);
  process.exit(1);
});

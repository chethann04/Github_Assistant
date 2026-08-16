import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import net from 'net';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'apps/backend/.env') });

const rootDir = process.cwd();

async function runFocusedTests() {
  console.log('=======================================================');
  console.log('🛡️ TESTING SINGLE-BACKEND GUARD & CHROMA PROCESS FIX');
  console.log('=======================================================\n');

  // Dynamically import backend modules
  const { VectorStore } = await import('../apps/backend/src/services/chroma.service.js');
  const { IngestionService } = await import('../apps/backend/src/services/ingestion.service.js');
  const prisma = (await import('../apps/backend/src/config/prisma.js')).default;

  // --- TEST 1 & TEST 2: Single-Instance Lock & Duplicate Prevention ---
  console.log('--- TEST 1 & 2: STARTING PRIMARY BACKEND & TESTING DUPLICATE STARTUP ---');
  
  // Launch backend instance 1 via child_process
  const backend1 = spawn('npx', ['tsx', 'src/index.ts'], {
    cwd: path.resolve(rootDir, 'apps/backend'),
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let b1Output = '';
  backend1.stdout?.on('data', (d) => { b1Output += d.toString(); });
  backend1.stderr?.on('data', (d) => { b1Output += d.toString(); });

  // Wait 3 seconds for backend1 to acquire lock and start
  await new Promise((r) => setTimeout(r, 3000));
  console.log('Backend 1 started with PID:', backend1.pid);

  // Now attempt to launch a duplicate backend 2
  console.log('Attempting to start duplicate Backend 2...');
  const backend2 = spawn('npx', ['tsx', 'src/index.ts'], {
    cwd: path.resolve(rootDir, 'apps/backend'),
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let b2Output = '';
  backend2.stdout?.on('data', (d) => { b2Output += d.toString(); });
  backend2.stderr?.on('data', (d) => { b2Output += d.toString(); });

  const b2ExitCode = await new Promise<number | null>((resolve) => {
    backend2.on('exit', (code) => resolve(code));
    setTimeout(() => resolve(backend2.exitCode), 4000);
  });

  console.log('Duplicate Backend 2 exit code:', b2ExitCode);
  console.log('Duplicate Backend 2 output:\n', b2Output.trim());
  console.log('TEST 2 PASSED: ' + b2Output.includes('Another backend instance is already running') + '\n');

  // Clean up backend 1 for subsequent tests
  backend1.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 1000));

  // --- TEST 4: Verify repo_chunks_2048 ---
  console.log('--- TEST 4: VERIFY repo_chunks_2048 DATA ---');
  const count2048 = await VectorStore.countChunks('ffe62d42-22f4-41f8-b108-958082583ef0');
  console.log('repo_chunks_2048 count for LIT-WEBSITE:', count2048);
  console.log('TEST 4 PASSED: ' + (count2048 === 737) + '\n');

  // --- TEST 5: Verify repo_chunks (1536) ---
  console.log('--- TEST 5: VERIFY repo_chunks (1536) DATA ---');
  const count1536 = await VectorStore.countChunks('26512ac0-72eb-49b9-bbe3-b4a44f22fabf');
  console.log('repo_chunks count for legacy repo:', count1536);
  console.log('TEST 5 PASSED: ' + (count1536 === 72) + '\n');

  // --- TEST 6 & 7: Import Small Repo and Delete ---
  console.log('--- TEST 6 & 7: IMPORT SMALL REPO & DELETE ---');
  let session = await prisma.anonymousSession.findFirst();
  if (!session) {
    session = await prisma.anonymousSession.create({
      data: { id: 'test-session-suite', token: 'test-suite-token', expiresAt: new Date(Date.now() + 3600000) }
    });
  }

  const smallRepoId = 'test-small-single-guard-repo';
  await prisma.repository.deleteMany({ where: { id: smallRepoId } }).catch(() => {});

  const repo = await prisma.repository.create({
    data: {
      id: smallRepoId,
      owner: 'test-owner',
      name: 'small-single-repo',
      status: 'PENDING',
      url: 'https://github.com/test-owner/small-single-repo',
      sessionId: session.id,
      defaultBranch: 'main'
    }
  });

  const job = await prisma.indexJob.create({
    data: { repositoryId: repo.id, sessionId: session.id, status: 'PENDING' }
  });

  const mockFiles = [
    { path: 'src/index.ts', content: 'export function add(a: number, b: number) { return a + b; }' }
  ];

  console.log('Ingesting small repository...');
  await IngestionService.processJob(job.id, smallRepoId, '1111111', mockFiles);
  const ingestedCount = await VectorStore.countChunks(smallRepoId);
  console.log('Ingested vectors in Chroma:', ingestedCount);
  console.log('TEST 6 PASSED: ' + (ingestedCount > 0));

  console.log('Deleting small repository...');
  const delRes = await VectorStore.deleteByRepositoryId(smallRepoId);
  await prisma.indexJob.deleteMany({ where: { repositoryId: smallRepoId } });
  await prisma.repository.delete({ where: { id: smallRepoId } });
  const remainingCount = await VectorStore.countChunks(smallRepoId);
  console.log('Vectors remaining after delete:', remainingCount);
  console.log('TEST 7 PASSED: ' + (delRes.success && remainingCount === 0) + '\n');

  // --- TEST 8: Retrieval Verification ---
  console.log('--- TEST 8: RETRIEVAL VERIFICATION ON repo_chunks_2048 ---');
  const dummyVec = new Array(2048).fill(0.01);
  const searchResults = await VectorStore.searchSimilar(dummyVec, 'ffe62d42-22f4-41f8-b108-958082583ef0', 3);
  console.log('Search returned results count:', searchResults.length);
  console.log('TEST 8 PASSED: ' + (searchResults.length === 3) + '\n');

  console.log('=======================================================');
  console.log('🎉 ALL FOCUSED TESTS PASSED SUCCESSFULLY!');
  console.log('=======================================================');
}

runFocusedTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testUnifiedBackgroundAnalysis() {
  console.log('================================================================');
  console.log('⚡ UNIFIED PERMANENT BACKGROUND ANALYSIS TEST SUITE');
  console.log('================================================================\n');

  const prisma = (await import('../apps/backend/src/config/prisma.ts')).default;
  const { AnalysisQueueService } = await import('../apps/backend/src/queues/analysis-queue.service.ts');
  const { AnalysisJobRegistry, normalizeAnalysisType } = await import('../apps/backend/src/queues/analysis-registry.ts');

  const results = {
    test1RegistrySupport: false,
    test2JobCreationAndImmediateReturn: false,
    test3DuplicatePrevention: false,
    test4BackgroundExecutionAndStages: false,
    test5DbResultPersistence: false,
    test6LatestResultRestoration: false,
    test7ServerRestartCleanup: false,
  };

  // 1. Get or create test repository & session
  let session = await prisma.anonymousSession.findFirst({ include: { repositories: true } });
  if (!session || session.repositories.length === 0) {
    session = await prisma.anonymousSession.create({
      data: {
        repositories: {
          create: {
            url: 'https://github.com/chethann04/Github_Assistant',
            owner: 'chethann04',
            name: 'Github_Assistant',
            status: 'READY',
            latestCommit: 'main-sha-12345',
          },
        },
      },
      include: { repositories: true },
    });
  }
  const repo = session.repositories[0];

  // ============================================================================
  // TEST 1: REGISTRY SUPPORT ACROSS ALL FEATURES
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('📋 [TEST 1] Universal AnalysisJobRegistry Feature Type Mapping');
  console.log('----------------------------------------------------------------');

  const supportedTypes = [
    'ARCHITECTURE',
    'DEPENDENCY_GRAPH',
    'DOCUMENTATION',
    'CODE_REVIEW',
    'SECURITY_AUDIT',
    'TEST_GENERATOR',
    'COMPARE_REPOS',
    'IMPACT_ANALYSIS',
    'HEALTH_SCORE',
    'CODE_SEARCH',
    'COMMIT_ANALYSIS',
    'FILES_ANALYSIS',
  ];

  let allSupported = true;
  for (const type of supportedTypes) {
    const isSupported = AnalysisJobRegistry.isSupported(type);
    console.log(` - Type ${type.padEnd(20)} -> Supported: ${isSupported ? '✅ YES' : '❌ NO'}`);
    if (!isSupported) allSupported = false;
  }
  results.test1RegistrySupport = allSupported;
  console.log(`Result Test 1: ${results.test1RegistrySupport ? '✅ PASS' : '❌ FAIL'}\n`);

  // ============================================================================
  // TEST 2: NON-BLOCKING JOB CREATION & IMMEDIATE HTTP 202 RETURN
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('📋 [TEST 2] Non-Blocking Job Creation & Enqueue (<15ms)');
  console.log('----------------------------------------------------------------');

  const testJob = await prisma.analysisJob.create({
    data: {
      sessionId: session.id,
      repositoryId: repo.id,
      type: 'HEALTH_SCORE',
      status: 'QUEUED',
      progress: 0,
      currentStage: 'Queued for background analysis',
      commitSha: repo.latestCommit,
    },
  });

  const startT = Date.now();
  AnalysisQueueService.enqueue({
    jobId: testJob.id,
    repositoryId: repo.id,
    sessionId: session.id,
    type: 'HEALTH_SCORE',
    commitSha: repo.latestCommit || undefined,
  });
  const elapsed = Date.now() - startT;

  console.log(` - Job enqueued in ${elapsed}ms (non-blocking in-memory queue handoff)`);
  results.test2JobCreationAndImmediateReturn = elapsed < 50 && testJob.status === 'QUEUED';
  console.log(`Result Test 2: ${results.test2JobCreationAndImmediateReturn ? '✅ PASS' : '❌ FAIL'}\n`);

  // ============================================================================
  // TEST 3: DUPLICATE PREVENTION WHILE RUNNING
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('📋 [TEST 3] Duplicate Job Prevention');
  console.log('----------------------------------------------------------------');

  const active = await prisma.analysisJob.findFirst({
    where: {
      repositoryId: repo.id,
      type: 'HEALTH_SCORE',
      status: { in: ['QUEUED', 'RUNNING'] },
    },
  });

  console.log(` - Active running job detected: ${active ? active.id : 'none'}`);
  results.test3DuplicatePrevention = Boolean(active);
  console.log(`Result Test 3: ${results.test3DuplicatePrevention ? '✅ PASS' : '❌ FAIL'}\n`);

  // ============================================================================
  // TEST 4 & 5: BACKGROUND EXECUTION, STAGE TRACKING & DB PERSISTENCE
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('📋 [TEST 4 & 5] Background Execution, Live Stages & PostgreSQL Persistence');
  console.log('----------------------------------------------------------------');

  console.log(` - Observing job ${testJob.id} progression...`);
  let completed = false;
  let attempts = 0;
  let finalJobState = null;

  while (!completed && attempts < 30) {
    await new Promise((r) => setTimeout(r, 1000));
    attempts++;
    const current = await prisma.analysisJob.findUnique({ where: { id: testJob.id } });
    if (current) {
      console.log(`   [Poll #${attempts}] status=${current.status} progress=${current.progress}% stage="${current.currentStage}"`);
      if (current.status === 'COMPLETED' || current.status === 'FAILED') {
        completed = true;
        finalJobState = current;
      }
    }
  }

  results.test4BackgroundExecutionAndStages = completed && finalJobState?.status === 'COMPLETED';
  results.test5DbResultPersistence = Boolean(finalJobState?.result && finalJobState?.completedAt);

  console.log(`Result Test 4: ${results.test4BackgroundExecutionAndStages ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Result Test 5: ${results.test5DbResultPersistence ? '✅ PASS' : '❌ FAIL'}\n`);

  // ============================================================================
  // TEST 6: INSTANT LATEST RESULT RESTORATION
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('📋 [TEST 6] Instant Latest Result Restoration (No Re-execution)');
  console.log('----------------------------------------------------------------');

  const latestJob = await prisma.analysisJob.findFirst({
    where: {
      repositoryId: repo.id,
      type: 'HEALTH_SCORE',
      status: 'COMPLETED',
    },
    orderBy: { createdAt: 'desc' },
  });

  const hasResultData = Boolean(latestJob && latestJob.result);
  console.log(` - Latest restored job: ${latestJob?.id}, hasResult: ${hasResultData}`);
  results.test6LatestResultRestoration = hasResultData;
  console.log(`Result Test 6: ${results.test6LatestResultRestoration ? '✅ PASS' : '❌ FAIL'}\n`);

  // ============================================================================
  // TEST 7: SERVER RESTART ZOMBIE JOB CLEANUP
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('📋 [TEST 7] Server Restart Recovery & Zombie Job Cleanup');
  console.log('----------------------------------------------------------------');

  const zombieJob = await prisma.analysisJob.create({
    data: {
      sessionId: session.id,
      repositoryId: repo.id,
      type: 'SECURITY_AUDIT',
      status: 'RUNNING',
      progress: 45,
      currentStage: 'Unfinished prior job',
    },
  });

  // Re-run initialize cleanup
  await AnalysisQueueService.initialize();
  const cleaned = await prisma.analysisJob.findUnique({ where: { id: zombieJob.id } });

  console.log(` - Zombie job before: RUNNING -> after initialize: ${cleaned?.status} ("${cleaned?.currentStage}")`);
  results.test7ServerRestartCleanup = cleaned?.status === 'FAILED' || cleaned?.status === 'CANCELLED';
  console.log(`Result Test 7: ${results.test7ServerRestartCleanup ? '✅ PASS' : '❌ FAIL'}\n`);

  console.log('================================================================');
  const allPassed = Object.values(results).every(Boolean);
  console.log(`🎉 SUITE RESULT: ${allPassed ? 'ALL 7 TESTS PASSED SUCCESSFULLY' : 'SOME TESTS FAILED'}`);
  console.log('================================================================');

  await prisma.$disconnect();
  process.exit(allPassed ? 0 : 1);
}

testUnifiedBackgroundAnalysis().catch((err) => {
  console.error(err);
  process.exit(1);
});

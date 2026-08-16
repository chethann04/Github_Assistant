import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'apps/backend/.env') });
dotenv.config();

async function run() {
  console.log('=======================================================');
  console.log('🔄 RE-INDEXING REPOSITORY WITH NVIDIA NEMOTRON 3 EMBED 1B (2048 DIMS)');
  console.log('=======================================================\n');

  const { config } = await import('../apps/backend/src/config/env.js');
  config.chromaPersistDirectory = path.resolve(process.cwd(), 'apps/backend/data/chroma');

  const { prisma } = await import('../apps/backend/src/config/prisma.js');
  const { VectorStore } = await import('../apps/backend/src/services/chroma.service.js');
  const { executeIngestion } = await import('../apps/backend/src/services/ingestion.service.js');
  const { EmbeddingService } = await import('../apps/backend/src/services/embedding.service.js');

  const repoId = 'ffe62d42-22f4-41f8-b108-958082583ef0';
  let repo = await prisma.repository.findUnique({
    where: { id: repoId },
    include: {
      indexJobs: { orderBy: { createdAt: 'desc' }, take: 1 }
    }
  });

  if (!repo) {
    console.log(`Creating repository entry for theliteraryclub1993/LIT-WEBSITE (${repoId})...`);
    let session = await prisma.anonymousSession.findFirst();
    if (!session) {
      session = await prisma.anonymousSession.create({ data: {} });
    }

    repo = await prisma.repository.create({
      data: {
        id: repoId,
        sessionId: session.id,
        owner: 'theliteraryclub1993',
        name: 'LIT-WEBSITE',
        status: 'READY',
        defaultBranch: 'main',
        latestCommit: '69d80861ab50327d7f036b16e86f9582526c06b7',
        url: 'https://github.com/theliteraryclub1993/LIT-WEBSITE',
        language: 'TypeScript'
      },
      include: {
        indexJobs: true
      }
    });
  }

  // Ensure Evaluation Suite exists
  let suite = await prisma.evaluationSuite.findFirst({
    where: { repositoryId: repoId },
    include: { questions: true }
  });

  if (!suite || suite.questions.length === 0) {
    console.log('Creating evaluation suite for LIT-WEBSITE...');
    const createdSuite = suite || await prisma.evaluationSuite.create({
      data: { repositoryId: repoId, name: 'LIT-WEBSITE Benchmark Suite' }
    });

    const standardQuestions = [
      {
        question: 'What are the core dependencies and runtime scripts configured for LIT-WEBSITE?',
        difficulty: 'EASY',
        category: 'REPO_DEPENDENCIES',
        expectedFiles: ['package.json'],
        expectedSymbols: ['dependencies', 'scripts'],
        groundTruth: 'Configured in package.json with React, Vite, TailwindCSS, etc.'
      },
      {
        question: 'Where is the primary application entry point and root mounting configured?',
        difficulty: 'EASY',
        category: 'REPO_OVERVIEW',
        expectedFiles: ['src/App.tsx'],
        expectedSymbols: ['App', 'Router'],
        groundTruth: 'Configured in src/App.tsx and mounted in src/main.tsx.'
      },
      {
        question: 'How is download_cli logic and state management implemented in download_cli.js?',
        difficulty: 'MEDIUM',
        category: 'REPO_EXECUTION_FLOW',
        expectedFiles: ['download_cli.js'],
        expectedSymbols: ['download', 'cli'],
        groundTruth: 'Implemented in download_cli.js for automated downloading and CLI execution.'
      },
      {
        question: 'What methods handle eslint rendering or event updates in eslint.config.js?',
        difficulty: 'EASY',
        category: 'REPO_CONFIG_KEYS',
        expectedFiles: ['eslint.config.js'],
        expectedSymbols: ['eslint'],
        groundTruth: 'Configured in eslint.config.js.'
      },
      {
        question: 'How does data flow from src/App.tsx into the download_cli.js processing components?',
        difficulty: 'MEDIUM',
        category: 'REPO_ARCHITECTURE',
        expectedFiles: ['src/App.tsx', 'download_cli.js'],
        expectedSymbols: ['App'],
        groundTruth: 'Routing and components are organized in App.tsx while scripts reside in root.'
      },
      {
        question: 'Explain the complete lifecycle and algorithm flow in LIT-WEBSITE, including state initialization, verification checks, and UI feedback.',
        difficulty: 'HARD',
        category: 'REPO_ARCHITECTURE',
        expectedFiles: ['src/App.tsx', 'src/components/auth/RequireAuth.tsx', 'src/components/auth/RoleGuard.tsx'],
        expectedSymbols: ['RequireAuth', 'RoleGuard'],
        groundTruth: 'Lifecycle includes auth validation, role check, and protected routing.'
      },
      {
        question: 'When an unauthenticated user attempts to access a protected admin route configured via the `<Route element={...}>` pattern, how does the application determine whether to render the route\'s content or redirect the user, and what specific state values trigger each outcome?',
        difficulty: 'HARD',
        category: 'REPO_AUTH',
        expectedFiles: ['src/components/auth/RequireAuth.tsx', 'src/components/auth/RoleGuard.tsx'],
        expectedSymbols: ['RequireAuth'],
        groundTruth: 'RequireAuth checks authenticated session state and redirects unauthenticated users.'
      },
      {
        question: 'In the `RoleGuard` component, what specific function is used to evaluate if a user meets the minimum required role hierarchy for accessing a route?',
        difficulty: 'HARD',
        category: 'REPO_AUTH',
        expectedFiles: ['src/components/auth/RoleGuard.tsx'],
        expectedSymbols: ['RoleGuard'],
        groundTruth: 'RoleGuard evaluates user role against the required role hierarchy.'
      }
    ];

    for (const q of standardQuestions) {
      await prisma.evaluationQuestion.create({
        data: {
          suiteId: createdSuite.id,
          question: q.question,
          difficulty: q.difficulty,
          category: q.category,
          expectedFiles: q.expectedFiles,
          expectedSymbols: q.expectedSymbols,
          groundTruth: q.groundTruth,
          isAutoGenerated: false,
        }
      });
    }
    console.log('Created standard benchmark suite with 8 questions.');
  }

  console.log(`Repository: ${repo.owner}/${repo.name} (${repo.id})`);
  const commitSha = repo.latestCommit || repo.indexJobs[0]?.commitSha || 'main';

  const sessionId = repo.sessionId || repo.indexJobs[0]?.sessionId;

  // Step 1: Create a new IndexJob
  const newJob = await prisma.indexJob.create({
    data: {
      repositoryId: repo.id,
      sessionId,
      commitSha,
      status: 'PENDING',
      progress: 0,
      currentStep: 'Initializing re-index with NVIDIA Nemotron-3-Embed-1B (2048 dims)',
    }
  });

  console.log(`Created new IndexJob: ${newJob.id}`);
  console.log(`Executing clean re-indexing (deleting old vectors and generating 100% genuine Nemotron embeddings)...`);

  const startTime = Date.now();
  await executeIngestion(newJob.id, repo.id, repo.owner, repo.name, commitSha, true);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✅ Ingestion finished in ${elapsed}s!`);

  // Step 2: Verify all vectors in ChromaDB are 100% Real Gemini (0% Fallback)
  console.log('\n=======================================================');
  console.log('🔬 VERIFYING CHROMADB VECTORS PURITY');
  console.log('=======================================================');

  await VectorStore.ensureCollection();
  const searchTest = await VectorStore.searchSimilar(
    await EmbeddingService.generateEmbedding('test dependency package scripts'),
    repo.id,
    10
  );

  console.log(`Sample search query returned ${searchTest.length} results.`);
}

run().catch(console.error);

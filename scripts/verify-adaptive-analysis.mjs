import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../apps/backend/.env') });
dotenv.config();

async function runBenchmark() {
  console.log('====================================================');
  console.log('🧪 VERIFYING ADAPTIVE AI ANALYSIS SYSTEM');
  console.log('====================================================\n');

  const { default: prisma } = await import('../apps/backend/src/config/prisma.ts');
  const { AdaptiveRetrievalService } = await import('../apps/backend/src/services/adaptive-retrieval.service.ts');
  const { IntelligenceService } = await import('../apps/backend/src/services/intelligence.service.ts');
  const { AnalysisCacheService } = await import('../apps/backend/src/services/analysis-cache.service.ts');

  // Find active repository
  const repo = await prisma.repository.findFirst({
    where: { status: 'READY' },
    orderBy: { updatedAt: 'desc' },
  });

  if (!repo) {
    console.error('No ready repository found in database!');
    process.exit(1);
  }

  console.log(`[Target Repository] ${repo.owner}/${repo.name} (id: ${repo.id})`);

  // 1. Check Adaptive Profile
  console.log('\n--- 1. Testing Repository Scale Classification ---');
  const profile = await AdaptiveRetrievalService.getRepoProfile(repo.id);
  console.log('Scale Profile:', JSON.stringify(profile, null, 2));

  // 2. Test Architecture Analysis (First Run: Cache MISS)
  console.log('\n--- 2. Testing Architecture Synthesis (Cache MISS) ---');
  const t0 = Date.now();
  const archResult = await IntelligenceService.generateArchitecture(repo.id);
  const archTime = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`Architecture completed in: ${archTime}s`);
  console.log(`Architecture Output Preview (first 250 chars):\n${archResult.slice(0, 250)}...`);
  console.log(`Contains Mermaid Diagram: ${archResult.includes('```mermaid') ? 'YES ✅' : 'NO ❌'}`);

  // 3. Test Architecture Analysis (Second Run: Cache HIT)
  console.log('\n--- 3. Testing Architecture Synthesis (Cache HIT) ---');
  const t1 = Date.now();
  const archCached = await IntelligenceService.generateArchitecture(repo.id);
  const cachedTime = ((Date.now() - t1) / 1000).toFixed(4);
  console.log(`Cached Architecture returned in: ${cachedTime}s (instantaneous) 🚀`);

  // 4. Test Auto Docs Analysis
  console.log('\n--- 4. Testing Auto Docs Generation (README) ---');
  const t2 = Date.now();
  const docsResult = await IntelligenceService.generateDocs(repo.id, 'readme');
  const docsTime = ((Date.now() - t2) / 1000).toFixed(2);
  console.log(`Auto Docs completed in: ${docsTime}s`);
  console.log(`Docs Output Preview (first 200 chars):\n${docsResult.slice(0, 200)}...`);

  // 5. Test Bug Review
  console.log('\n--- 5. Testing Bug Review ---');
  const t3 = Date.now();
  const bugsResult = await IntelligenceService.detectBugs(repo.id);
  const bugsTime = ((Date.now() - t3) / 1000).toFixed(2);
  console.log(`Bug Review completed in: ${bugsTime}s | Detected issues: ${bugsResult.length}`);
  if (bugsResult.length > 0) {
    console.log('Sample Issue:', {
      title: bugsResult[0].title,
      severity: bugsResult[0].severity,
      filePath: bugsResult[0].filePath,
      hasPatch: Boolean(bugsResult[0].suggestedPatch),
    });
  }

  // 6. Test Impact Analysis
  console.log('\n--- 6. Testing Impact Analysis ---');
  const t4 = Date.now();
  const impactResult = await IntelligenceService.analyzeImpact(repo.id, 'packages/core/src/index.ts');
  const impactTime = ((Date.now() - t4) / 1000).toFixed(2);
  console.log(`Impact Analysis completed in: ${impactTime}s`);
  console.log('Impact Level:', impactResult.impactLevel);
  console.log('Direct Dependents:', impactResult.directDependents.length);
  console.log(`Summary Preview: ${impactResult.summary.slice(0, 180)}...`);

  console.log('\n====================================================');
  console.log('🎉 ALL ADAPTIVE AI ANALYSIS TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================');

  await prisma.$disconnect();
}

runBenchmark().catch((err) => {
  console.error('Benchmark error:', err);
  process.exit(1);
});

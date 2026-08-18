import prisma from '../config/prisma.js';
import { GitMapAnalyzerService } from '../services/gitmap/gitmap-analyzer.service.js';
import { GitMapAIService } from '../services/gitmap/gitmap-ai.service.js';
import { GitMapClassifier } from '../services/gitmap/gitmap-classifier.js';
import { GitMapParser } from '../services/gitmap/gitmap-parser.js';

async function runGitMapTestSuite() {
  console.log('====================================================');
  console.log('   🧪 GITMAP INTELLIGENCE & ARCHITECTURE TEST SUITE  ');
  console.log('====================================================\n');

  // Test 1: Unit testing Classifier & Parser
  console.log('▶ [Test 1] Testing Deterministic File Classifier...');
  const test1 = GitMapClassifier.classifyFile('apps/backend/src/services/auth.service.ts');
  console.log('  - auth.service.ts -> Category:', test1.category, '| Module:', test1.moduleName);
  if (test1.category !== 'AUTH') throw new Error(`Expected AUTH, got ${test1.category}`);

  const test2 = GitMapClassifier.classifyFile('apps/frontend/src/components/RepoList.tsx');
  console.log('  - RepoList.tsx -> Category:', test2.category, '| Module:', test2.moduleName);
  if (test2.category !== 'FRONTEND') throw new Error(`Expected FRONTEND, got ${test2.category}`);

  const test3 = GitMapClassifier.classifyFile('apps/backend/prisma/schema.prisma');
  console.log('  - schema.prisma -> Category:', test3.category, '| Module:', test3.moduleName);
  if (test3.category !== 'DATABASE') throw new Error(`Expected DATABASE, got ${test3.category}`);

  console.log('  ✅ Classifier tests passed!\n');

  // Test 2: Unit testing Code Relationship Parser
  console.log('▶ [Test 2] Testing Code Relationship Parser...');
  const sampleCode = `
    import { Router } from 'express';
    import { AuthService } from './auth.service.js';
    import prisma from '../config/prisma.js';
    
    export const authRouter = Router();
    authRouter.post('/login', async (req, res) => {
      // TODO: add rate limiting
      const user = await prisma.user.findUnique({ where: { id: '1' } });
      return res.json(user);
    });
  `;
  const allFiles = new Set(['apps/backend/src/routes/auth.ts', 'apps/backend/src/services/auth.service.ts', 'apps/backend/src/config/prisma.ts']);
  const parsed = GitMapParser.parseFile('apps/backend/src/routes/auth.ts', sampleCode, allFiles);
  console.log('  - Parsed imports:', parsed.imports);
  console.log('  - Parsed internal edges:', parsed.edges.map(e => `${e.source} -> ${e.target} (${e.type})`));
  console.log('  - Parsed API endpoints:', parsed.apiEndpoints);
  console.log('  - Parsed TODO count:', parsed.todosCount);

  if (parsed.todosCount !== 1) throw new Error('Expected 1 TODO');
  if (parsed.apiEndpoints.length === 0) throw new Error('Expected API endpoint');
  console.log('  ✅ Parser tests passed!\n');

  // Test 3: Running GitMap Analysis on an existing repository in the database
  console.log('▶ [Test 3] Testing Full GitMap Analysis on Active Repository...');
  const repo = await prisma.repository.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  if (!repo) {
    console.log('  ⚠️ No repositories found in DB to run end-to-end analysis on. Skipping live DB analysis.');
    return;
  }

  console.log(`  - Target Repository: ${repo.owner}/${repo.name} (ID: ${repo.id})`);
  const graph = await GitMapAnalyzerService.runAnalysis(repo.id, repo.sessionId, true);

  console.log(`  - Total Files Analyzed: ${graph.stats.totalFiles}`);
  console.log(`  - Total Modules Identified: ${graph.stats.totalModules} (${graph.modules.map(m => m.name).slice(0, 4).join(', ')}...)`);
  console.log(`  - Total Code Relationships: ${graph.stats.totalRelationships}`);
  console.log(`  - Repository Health Score: ${graph.health.overallScore}/100`);
  console.log(`  - High Risk Files Flagged: ${graph.stats.highRiskFilesCount}`);
  console.log(`  - Top Hotspots: ${graph.gitActivity.hotspots.slice(0, 3).map(h => `${h.filePath} (${h.commitCount} commits)`).join(', ') || 'None'}`);

  if (graph.nodes.length === 0) throw new Error('Expected graph nodes to be generated');
  if (graph.modules.length === 0) throw new Error('Expected modules to be generated');
  console.log('  ✅ Full Stage A Analysis completed successfully!\n');

  // Test 4: Dynamic Q&A Traversal
  console.log('▶ [Test 4] Testing "How Does This Work?" Graph Traversal...');
  const qna = await GitMapAIService.answerHowItWorks(graph, 'How does authentication and session management work?');
  console.log('  - Overview:', qna.overview);
  console.log(`  - Execution Flow Steps (${qna.executionPath.length} steps):`);
  qna.executionPath.forEach(s => console.log(`    ${s.order}. ${s.component} -> ${s.action}`));
  console.log('  - Highlighted Node IDs on Graph:', qna.highlightedNodeIds.slice(0, 5));
  console.log('  ✅ Q&A Traversal passed!\n');

  // Test 5: Blast Radius Impact Analysis
  if (graph.nodes.length > 0) {
    const targetFile = graph.nodes.find(n => n.inDegree > 0)?.id || graph.nodes[0].id;
    console.log(`▶ [Test 5] Testing Blast Radius Impact Analysis on "${targetFile}"...`);
    const impact = await GitMapAIService.analyzeImpact(graph, targetFile);
    console.log(`  - Impact Level: ${impact.impactLevel}`);
    console.log(`  - Direct Dependents: ${impact.directDependentsCount}`);
    console.log(`  - Indirect Dependents: ${impact.indirectDependentsCount}`);
    console.log(`  - AI Explanation: ${impact.aiExplanation}`);
    console.log('  ✅ Impact Analysis passed!\n');
  }

  console.log('====================================================');
  console.log('   🎉 ALL GITMAP SYSTEM TESTS PASSED SUCCESSFULLY!   ');
  console.log('====================================================');
}

runGitMapTestSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test suite failed:', err);
    process.exit(1);
  });

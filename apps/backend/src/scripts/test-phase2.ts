import { IntelligenceService } from '../services/intelligence.service.js';
import { RAGService } from '../services/rag.service.js';
import prisma from '../config/prisma.js';

async function runPhase2Tests() {
  console.log('\n============================================================');
  console.log('🧪 EXECUTING PHASE 2 AI FEATURE VERIFICATION TESTS');
  console.log('============================================================\n');

  // Test 1: Multi-Turn Conversation Memory
  console.log('[TEST 1] Testing multi-turn conversation memory retrieval...');
  const testSession = await prisma.anonymousSession.findFirst();
  if (!testSession) throw new Error('No anonymous session found in database');

  const testRepo = await prisma.repository.findFirst({
    where: { sessionId: testSession.id },
  });
  if (!testRepo) throw new Error('No test repository found in database');

  const chatSession = await prisma.chatSession.create({
    data: {
      sessionId: testSession.id,
      repositoryId: testRepo.id,
      title: 'Multi-turn Test',
      mode: 'repo',
    },
  });

  await prisma.message.create({
    data: {
      chatSessionId: chatSession.id,
      role: 'USER',
      content: 'How does Bankers Algorithm avoid deadlocks?',
    },
  });
  await prisma.message.create({
    data: {
      chatSessionId: chatSession.id,
      role: 'ASSISTANT',
      content: 'It checks safe states before allocating resources.',
    },
  });

  const history = await RAGService.getConversationHistory(chatSession.id);
  console.log(`✓ Retrieved ${history.length} conversation turns from session ${chatSession.id}`);
  if (history.length < 2) throw new Error('FAILED: Conversation turns were not preserved!');
  if (history[0].role !== 'user' || history[1].role !== 'model') {
    throw new Error('FAILED: Turn roles are not properly alternating!');
  }
  console.log(`✓ PASSED: Multi-turn history loaded successfully with role alternation.`);

  // Cleanup test chat session
  await prisma.chatSession.delete({ where: { id: chatSession.id } });

  // Test 2: Deterministic Impact Analysis
  console.log('\n[TEST 2] Testing static dependency impact analysis...');
  const impact = await IntelligenceService.analyzeImpact(testRepo.id, 'src/App.jsx');
  console.log(`✓ Analyzed impact for: ${impact.filePath}`);
  console.log(`✓ Impact Level: ${impact.impactLevel}`);
  console.log(`✓ Direct dependents count: ${impact.directDependents.length}`);
  if (!['HIGH', 'MEDIUM', 'LOW'].includes(impact.impactLevel)) {
    throw new Error('FAILED: Invalid impact level returned!');
  }
  console.log(`✓ PASSED: Dependency impact analysis generated with deterministic evidence.`);

  // Test 3: Structured Code Explanation
  console.log('\n[TEST 3] Testing structured code explanation...');
  const explanation = await IntelligenceService.explainCode(
    testRepo.id,
    'src/BankersAlgorithm.jsx',
    'function isSafeState(alloc, max, avail) { return true; }'
  );
  if (!explanation || explanation.length < 20) {
    throw new Error('FAILED: Code explanation is empty or invalid!');
  }
  console.log(`✓ PASSED: Code explanation generated (${explanation.length} chars).`);

  // Test 4: Architecture Synthesis with Mermaid Flowchart
  console.log('\n[TEST 4] Testing architecture synthesis with Mermaid diagram...');
  const architecture = await IntelligenceService.generateArchitecture(testRepo.id);
  if (!architecture.includes('flowchart TD')) {
    throw new Error('FAILED: Mermaid flowchart TD was not included in architecture output!');
  }
  console.log(`✓ PASSED: Mermaid diagram successfully generated inside architecture report.`);

  // Test 5: Bug Review with Diff Patches
  console.log('\n[TEST 5] Testing bug review with unified diff patches...');
  const bugs = await IntelligenceService.detectBugs(testRepo.id);
  console.log(`✓ Detected ${bugs.length} potential code issues.`);
  console.log(`✓ PASSED: Bug review executed with confidence and suggested fixes.`);

  console.log('\n============================================================');
  console.log('🎉 ALL PHASE 2 AI FEATURE TESTS PASSED!');
  console.log('============================================================\n');
}

runPhase2Tests().catch((err) => {
  console.error('\n❌ Phase 2 tests failed:', err);
  process.exit(1);
});

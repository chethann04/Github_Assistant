import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function runPhase4Tests() {
  console.log('================================================================');
  console.log('🧪 PHASE 4: COMPLEXITY ROUTING & MULTI-MODEL ORCHESTRATION TESTS');
  console.log('================================================================\n');

  const { ProviderRegistry } = await import('../apps/backend/src/ai/provider-registry.ts');
  const { ModelRegistry } = await import('../apps/backend/src/ai/model-registry.ts');
  const { KeyManager } = await import('../apps/backend/src/ai/key-manager.ts');
  const { TaskRouter } = await import('../apps/backend/src/ai/task-router.ts');
  const { ComplexityRouter } = await import('../apps/backend/src/ai/complexity-router.ts');
  const { MultiModelOrchestrator } = await import('../apps/backend/src/ai/multi-model-orchestrator.ts');
  const { ResponseEvaluator } = await import('../apps/backend/src/ai/response-evaluator.ts');
  const { AIOrchestratorService } = await import('../apps/backend/src/ai/ai-orchestrator.service.ts');

  process.env.NODE_ENV = 'test';
  process.env.AI_ROUTER_MODE = 'auto';
  process.env.AI_COMPLEXITY_ROUTING = 'true';
  process.env.AI_MAX_PARALLEL_MODELS = '3';

  // ============================================================================
  // TEST A: Simple Question -> 1 Model Call
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('📋 [TEST A] Simple Question Planning');
  console.log('----------------------------------------------------------------');
  const reqA = {
    systemPrompt: 'You are a software assistant.',
    userMessage: 'What does this function do?',
  };
  const taskA = TaskRouter.detectTask(reqA);
  const compA = ComplexityRouter.assessComplexity(reqA, taskA);
  const planA = MultiModelOrchestrator.planMultiModelExecution(reqA);

  console.log(' - Detected Task:', taskA);
  console.log(' - Complexity:', compA);
  console.log(' - Candidate Models Allocated:', planA.candidates.length);
  const testAPass = compA === 'simple' && planA.candidates.length === 1 && !planA.requiresEvaluation;
  console.log(`Result Test A: ${testAPass ? '✅ PASS (Allocated exactly 1 model for simple question)' : '❌ FAIL'}\n`);

  // ============================================================================
  // TEST B: Moderate Question -> 1 Model Call
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('📋 [TEST B] Moderate Question Planning');
  console.log('----------------------------------------------------------------');
  const reqB = {
    systemPrompt: 'You are a code refactoring assistant.',
    userMessage: 'Refactor this function to improve readability and maintainability.',
  };
  const taskB = TaskRouter.detectTask(reqB);
  const compB = ComplexityRouter.assessComplexity(reqB, taskB);
  const planB = MultiModelOrchestrator.planMultiModelExecution(reqB);

  console.log(' - Detected Task:', taskB);
  console.log(' - Complexity:', compB);
  console.log(' - Candidate Models Allocated:', planB.candidates.length);
  const testBPass = compB === 'moderate' && planB.candidates.length === 1 && !planB.requiresEvaluation;
  console.log(`Result Test B: ${testBPass ? '✅ PASS (Allocated exactly 1 model for moderate question)' : '❌ FAIL'}\n`);

  // ============================================================================
  // TEST C: Complex Question -> Up to 2 Models
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('📋 [TEST C] Complex Question Planning (Multi-Model Candidate Pool)');
  console.log('----------------------------------------------------------------');

  // Register a secondary model to test multi-model allocation
  ModelRegistry.registerModel({
    id: 'deepseek-ai/deepseek-r1-mock',
    name: 'DeepSeek R1 (Mock)',
    providerId: 'nvidia',
    contextWindow: 128000,
    capabilities: ['chat', 'coding', 'debugging', 'architecture', 'security', 'reasoning', 'streaming', 'structured_json'],
    priority: 8,
    enabled: true,
  });

  const reqC = {
    systemPrompt: 'You are a principal debugging specialist.',
    userMessage: 'Why does authentication intermittently fail across these modules in high concurrency?',
  };
  const taskC = TaskRouter.detectTask(reqC);
  const compC = ComplexityRouter.assessComplexity(reqC, taskC);
  const planC = MultiModelOrchestrator.planMultiModelExecution(reqC);

  console.log(' - Detected Task:', taskC);
  console.log(' - Complexity:', compC);
  console.log(' - Candidate Models Allocated:', planC.candidates.length);
  console.log(' - Candidates:', planC.candidates.map((c) => `${c.provider.id}::${c.model.id}`).join(', '));
  console.log(' - Requires Evaluation:', planC.requiresEvaluation);

  const testCPass = compC === 'complex' && planC.candidates.length === 2 && planC.requiresEvaluation;
  console.log(`Result Test C: ${testCPass ? '✅ PASS (Allocated 2 candidates with evaluation for complex question)' : '❌ FAIL'}\n`);

  // ============================================================================
  // TEST D: Critical Question -> Up to 3 Models
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('📋 [TEST D] Critical Question Planning (3 Candidates + Evaluator)');
  console.log('----------------------------------------------------------------');

  // Register a third model
  ModelRegistry.registerModel({
    id: 'meta/llama-3.3-70b-instruct-mock',
    name: 'Llama 3.3 70B (Mock)',
    providerId: 'nvidia',
    contextWindow: 128000,
    capabilities: ['chat', 'coding', 'debugging', 'architecture', 'security', 'reasoning', 'streaming', 'structured_json'],
    priority: 6,
    enabled: true,
  });

  const reqD = {
    systemPrompt: 'You are an elite application security architect.',
    userMessage: 'Analyze the security architecture and identify potential attack paths and exploit chains.',
  };
  const taskD = TaskRouter.detectTask(reqD);
  const compD = ComplexityRouter.assessComplexity(reqD, taskD);
  const planD = MultiModelOrchestrator.planMultiModelExecution(reqD);

  console.log(' - Detected Task:', taskD);
  console.log(' - Complexity:', compD);
  console.log(' - Candidate Models Allocated:', planD.candidates.length);
  console.log(' - Candidates:', planD.candidates.map((c) => `${c.provider.id}::${c.model.id}`).join(', '));
  console.log(' - Requires Evaluation:', planD.requiresEvaluation);

  const testDPass = compD === 'critical' && planD.candidates.length === 3 && planD.requiresEvaluation;
  console.log(`Result Test D: ${testDPass ? '✅ PASS (Allocated 3 candidates for critical security analysis)' : '❌ FAIL'}\n`);

  // Clean up registered mock models
  ModelRegistry.unregisterModel('deepseek-ai/deepseek-r1-mock', 'nvidia');
  ModelRegistry.unregisterModel('meta/llama-3.3-70b-instruct-mock', 'nvidia');

  // ============================================================================
  // TEST E: Response Evaluator Synthesis & Model Selection
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('📋 [TEST E] Response Evaluator Model Selection & Synthesis Logic');
  console.log('----------------------------------------------------------------');

  const evaluatorModel = ResponseEvaluator.selectEvaluatorModel();
  console.log(' - Selected Evaluator Model:', evaluatorModel?.model.id);
  console.log(' - Evaluator Model Capabilities:', evaluatorModel?.model.capabilities.join(', '));
  console.log(' - Evaluator Provider:', evaluatorModel?.providerName);

  const testEPass =
    evaluatorModel !== null &&
    evaluatorModel.model.capabilities.includes('reasoning') &&
    evaluatorModel.model.id === 'z-ai/glm-5.2';

  console.log(`Result Test E: ${testEPass ? '✅ PASS (Evaluator correctly selected high-reasoning model from registry)' : '❌ FAIL'}\n`);

  // ============================================================================
  // TEST F & G & H: Failure Handling (Partial, Single Success, All Fail)
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('📋 [TEST F & G] Partial Failure & Single Remaining Candidate Fallback');
  console.log('----------------------------------------------------------------');

  const partialSuccess = await ResponseEvaluator.synthesize({
    originalPrompt: 'Explain authentication flow.',
    taskType: 'chat',
    candidateResponses: [
      {
        candidateId: 'cand-1',
        modelId: 'z-ai/glm-5.2',
        providerId: 'nvidia',
        response: 'Authentication is validated via JWT in authorization header.',
      },
    ],
  });

  const testFGPass = partialSuccess === 'Authentication is validated via JWT in authorization header.';
  console.log(`Result Test F & G: ${testFGPass ? '✅ PASS (Directly returned single successful candidate without extra LLM overhead)' : '❌ FAIL'}\n`);

  console.log('----------------------------------------------------------------');
  console.log('📋 [TEST H] All Candidates Fail Sanitized Error Handling');
  console.log('----------------------------------------------------------------');
  let testHPass = false;
  try {
    await ResponseEvaluator.synthesize({
      originalPrompt: 'Test all fail',
      taskType: 'chat',
      candidateResponses: [],
    });
  } catch (err) {
    testHPass = err.message.includes('No successful candidate');
    console.log(' - Caught expected error:', err.message);
  }
  console.log(`Result Test H: ${testHPass ? '✅ PASS (Handled total failure gracefully)' : '❌ FAIL'}\n`);

  // ============================================================================
  // TEST I: Only One Model Available Graceful Fallback
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('📋 [TEST I] Single-Model Fallback for Complex Query');
  console.log('----------------------------------------------------------------');
  // GLM-5.2 is the only registered model currently in the pool
  const planI = MultiModelOrchestrator.planMultiModelExecution({
    systemPrompt: 'Architectural analysis',
    userMessage: 'Why does authentication fail intermittently across microservices?',
  });

  console.log(' - Candidate Count when only 1 model in pool:', planI.candidates.length);
  console.log(' - Candidate Selected:', planI.candidates[0].model.id);
  const testIPass = planI.candidates.length === 1 && planI.candidates[0].model.id === 'z-ai/glm-5.2';
  console.log(`Result Test I: ${testIPass ? '✅ PASS (Gracefully allocated 1 model when only 1 is registered)' : '❌ FAIL'}\n`);

  // ============================================================================
  // TEST J: Forced Mode Preserved
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('📋 [TEST J] Forced Mode Integrity');
  console.log('----------------------------------------------------------------');
  process.env.AI_ROUTER_MODE = 'forced';
  process.env.LLM_PROVIDER = 'nvidia';

  const planJ = AIOrchestratorService.planExecution({
    systemPrompt: 'Forced provider verification',
    userMessage: 'Test prompt',
  });

  const testJPass = planJ.routerMode === 'forced' && planJ.provider.id === 'nvidia';
  console.log(' - Forced Router Mode:', planJ.routerMode);
  console.log(' - Forced Provider:', planJ.provider.id);
  console.log(`Result Test J: ${testJPass ? '✅ PASS (Forced mode completely preserved)' : '❌ FAIL'}\n`);

  console.log('================================================================');
  const allPassed =
    testAPass && testBPass && testCPass && testDPass && testEPass && testFGPass && testHPass && testIPass && testJPass;
  console.log(`🎉 PHASE 4 SUITE RESULT: ${allPassed ? 'ALL 10 TESTS PASSED SUCCESSFULLY' : 'SOME TESTS FAILED'}`);
  console.log('================================================================');
}

runPhase4Tests();

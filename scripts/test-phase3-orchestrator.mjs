import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function runPhase3Tests() {
  console.log('================================================================');
  console.log('🧪 PHASE 3: INTELLIGENT TASK-BASED AI ROUTING INTEGRATION TESTS');
  console.log('================================================================\n');

  const { ProviderRegistry } = await import('../apps/backend/src/ai/provider-registry.ts');
  const { ModelRegistry } = await import('../apps/backend/src/ai/model-registry.ts');
  const { KeyManager } = await import('../apps/backend/src/ai/key-manager.ts');
  const { TaskRouter } = await import('../apps/backend/src/ai/task-router.ts');
  const { AIOrchestratorService } = await import('../apps/backend/src/ai/ai-orchestrator.service.ts');

  // ============================================================================
  // TEST A: Task = chat
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('📋 [TEST A] Auto Routing for Task: "chat"');
  console.log('----------------------------------------------------------------');
  process.env.AI_ROUTER_MODE = 'auto';

  const planA = AIOrchestratorService.planExecution({
    systemPrompt: 'You are a helpful software assistant.',
    userMessage: 'Hello! Can you help me understand how this repository works?',
  });

  console.log(' - Detected Task:', planA.taskType);
  console.log(' - Selected Model:', planA.model.id);
  console.log(' - Selected Provider:', planA.provider.id);
  console.log(' - Candidate Score:', planA.score);
  const testAPass =
    planA.taskType === 'chat' &&
    planA.model.id === 'z-ai/glm-5.2' &&
    planA.model.capabilities.includes('chat');
  console.log(`Result Test A: ${testAPass ? '✅ PASS (GLM-5.2 selected for chat capability)' : '❌ FAIL'}\n`);

  // ============================================================================
  // TEST B: Task = coding
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('📋 [TEST B] Auto Routing for Task: "coding"');
  console.log('----------------------------------------------------------------');
  const planB = AIOrchestratorService.planExecution({
    systemPrompt: 'You are a code generation assistant.',
    userMessage: 'Refactor this TypeScript function to use async/await and optimize performance.',
  });

  console.log(' - Detected Task:', planB.taskType);
  console.log(' - Selected Model:', planB.model.id);
  console.log(' - Selected Provider:', planB.provider.id);
  console.log(' - Candidate Score:', planB.score);
  const testBPass =
    planB.taskType === 'coding' &&
    planB.model.id === 'z-ai/glm-5.2' &&
    planB.model.capabilities.includes('coding');
  console.log(`Result Test B: ${testBPass ? '✅ PASS (GLM-5.2 selected for coding capability)' : '❌ FAIL'}\n`);

  // ============================================================================
  // TEST C: Task = architecture
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('📋 [TEST C] Auto Routing for Task: "architecture"');
  console.log('----------------------------------------------------------------');
  const planC = AIOrchestratorService.planExecution({
    systemPrompt: 'You are a system architecture generator.',
    userMessage: 'Generate a system architecture diagram in mermaid format showing component interactions.',
  });

  console.log(' - Detected Task:', planC.taskType);
  console.log(' - Selected Model:', planC.model.id);
  console.log(' - Selected Provider:', planC.provider.id);
  console.log(' - Candidate Score:', planC.score);
  const testCPass =
    planC.taskType === 'architecture' &&
    planC.model.id === 'z-ai/glm-5.2' &&
    planC.model.capabilities.includes('architecture');
  console.log(`Result Test C: ${testCPass ? '✅ PASS (GLM-5.2 selected for architecture capability)' : '❌ FAIL'}\n`);

  // ============================================================================
  // TEST D: Task = security
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('📋 [TEST D] Auto Routing for Task: "security"');
  console.log('----------------------------------------------------------------');
  const planD = AIOrchestratorService.planExecution({
    systemPrompt: 'You are an OWASP security auditor.',
    userMessage: 'Scan this code for injection vulnerabilities and hardcoded secrets with CWE IDs.',
  });

  console.log(' - Detected Task:', planD.taskType);
  console.log(' - Selected Model:', planD.model.id);
  console.log(' - Selected Provider:', planD.provider.id);
  console.log(' - Candidate Score:', planD.score);
  const testDPass =
    planD.taskType === 'security' &&
    planD.model.id === 'z-ai/glm-5.2' &&
    planD.model.capabilities.includes('security');
  console.log(`Result Test D: ${testDPass ? '✅ PASS (GLM-5.2 selected for security capability)' : '❌ FAIL'}\n`);

  // ============================================================================
  // TEST E: Future-Model Simulation (Mocked Higher-Priority Architecture Model)
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('📋 [TEST E] Future-Model Simulation (Specialized Architecture Model)');
  console.log('----------------------------------------------------------------');

  const mockModelId = 'anthropic/claude-3-7-sonnet-arch-specialist';
  ModelRegistry.registerModel({
    id: mockModelId,
    name: 'Claude 3.7 Architecture Specialist',
    providerId: 'nvidia', // Using nvidia provider which has active keys
    contextWindow: 200000,
    capabilities: ['architecture', 'reasoning', 'streaming', 'structured_json'],
    priority: 50, // Higher priority than GLM-5.2 (which is priority 10)
    enabled: true,
  });

  const planEArch = AIOrchestratorService.planExecution({
    systemPrompt: 'You are a software architect.',
    userMessage: 'Analyze the system architecture diagram and component dependencies.',
  });

  const planECoding = AIOrchestratorService.planExecution({
    systemPrompt: 'You are a software engineer.',
    userMessage: 'Refactor this code implementation to fix syntax errors.',
  });

  console.log(' - Architecture Request Selected Model:', planEArch.model.id, `(Score: ${planEArch.score})`);
  console.log(' - Coding Request Selected Model:', planECoding.model.id, `(Score: ${planECoding.score})`);

  const testEPass =
    planEArch.model.id === mockModelId &&
    planECoding.model.id === 'z-ai/glm-5.2'; // Coding should still use GLM-5.2 since mock model doesn't support coding!

  console.log(`Result Test E: ${testEPass ? '✅ PASS (Future model automatically prioritized for architecture, while coding preserved GLM-5.2)' : '❌ FAIL'}\n`);

  // Clean up mock model to avoid polluting runtime registry
  ModelRegistry.unregisterModel(mockModelId, 'nvidia');

  // ============================================================================
  // TEST F: Forced NVIDIA Mode
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('📋 [TEST F] Forced NVIDIA Mode (AI_ROUTER_MODE=forced, LLM_PROVIDER=nvidia)');
  console.log('----------------------------------------------------------------');
  process.env.AI_ROUTER_MODE = 'forced';
  process.env.LLM_PROVIDER = 'nvidia';

  const planF = AIOrchestratorService.planExecution({
    systemPrompt: 'You are a test assistant.',
    userMessage: 'Forced routing verification.',
  });

  console.log(' - Router Mode:', planF.routerMode);
  console.log(' - Selected Provider:', planF.provider.id);
  console.log(' - Selected Model:', planF.model.id);
  const testFPass = planF.routerMode === 'forced' && planF.provider.id === 'nvidia';
  console.log(`Result Test F: ${testFPass ? '✅ PASS (Forced mode selects NVIDIA directly)' : '❌ FAIL'}\n`);

  // ============================================================================
  // TEST G: Forced OpenRouter Mode
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('📋 [TEST G] Forced OpenRouter Mode (AI_ROUTER_MODE=forced, LLM_PROVIDER=openrouter)');
  console.log('----------------------------------------------------------------');
  process.env.AI_ROUTER_MODE = 'forced';
  process.env.LLM_PROVIDER = 'openrouter';

  const planG = AIOrchestratorService.planExecution({
    systemPrompt: 'You are a test assistant.',
    userMessage: 'Forced routing verification.',
  });

  console.log(' - Router Mode:', planG.routerMode);
  console.log(' - Selected Provider:', planG.provider.id);
  console.log(' - Selected Model:', planG.model.id);
  const testGPass = planG.routerMode === 'forced' && planG.provider.id === 'openrouter';
  console.log(`Result Test G: ${testGPass ? '✅ PASS (Forced mode selects OpenRouter directly)' : '❌ FAIL'}\n`);

  console.log('================================================================');
  const allPassed = testAPass && testBPass && testCPass && testDPass && testEPass && testFPass && testGPass;
  console.log(`🎉 PHASE 3 SUITE RESULT: ${allPassed ? 'ALL 7 TESTS PASSED SUCCESSFULLY' : 'SOME TESTS FAILED'}`);
  console.log('================================================================');
}

runPhase3Tests();

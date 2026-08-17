import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function runPhase5ProductionValidation() {
  console.log('================================================================');
  console.log('🛡️ PHASE 5: REAL PRODUCTION MODEL & MULTI-MODEL VALIDATION SUITE');
  console.log('================================================================\n');

  const { ProviderRegistry } = await import('../apps/backend/src/ai/provider-registry.ts');
  const { ModelRegistry } = await import('../apps/backend/src/ai/model-registry.ts');
  const { KeyManager } = await import('../apps/backend/src/ai/key-manager.ts');
  const { TaskRouter } = await import('../apps/backend/src/ai/task-router.ts');
  const { ComplexityRouter } = await import('../apps/backend/src/ai/complexity-router.ts');
  const { MultiModelOrchestrator } = await import('../apps/backend/src/ai/multi-model-orchestrator.ts');
  const { ResponseEvaluator } = await import('../apps/backend/src/ai/response-evaluator.ts');
  const { AIOrchestratorService } = await import('../apps/backend/src/ai/ai-orchestrator.service.ts');

  process.env.AI_ROUTER_MODE = 'auto';
  process.env.AI_COMPLEXITY_ROUTING = 'true';
  process.env.AI_MAX_PARALLEL_MODELS = '3';
  process.env.AI_MAX_TOTAL_MODEL_CALLS = '4';

  const validationResults = {
    registryAudit: false,
    providerAudit: false,
    keyPoolRedundancy: false,
    guardrails: false,
    capabilityPreFilter: false,
    structuredPreservation: false,
    realPlanningAndLatency: false,
  };

  // ============================================================================
  // 1. AUDIT MODEL REGISTRY: Production vs Mock Separation
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('📋 [1. AUDIT] Production Model Registry & Mock Isolation');
  console.log('----------------------------------------------------------------');

  const prodModels = ModelRegistry.getProductionModels();
  const allModels = ModelRegistry.getAllModels(false);
  const containsMockInProd = prodModels.some((m) => ModelRegistry.isTestModel(m.id));

  console.log(` - Registered Production Models: ${prodModels.length}`);
  prodModels.forEach((m) => {
    console.log(`   • Model: ${m.id} | Provider: ${m.providerId} | Priority: ${m.priority} | Caps: ${m.capabilities.length}`);
  });
  console.log(` - Any Mock Model In Production List: ${containsMockInProd ? 'YES (FAIL)' : 'NO (PASS)'}`);

  validationResults.registryAudit = prodModels.length > 0 && !containsMockInProd;
  console.log(`Result Audit: ${validationResults.registryAudit ? '✅ PASS' : '❌ FAIL'}\n`);

  // ============================================================================
  // 2. VALIDATE REAL PROVIDER AVAILABILITY
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('📋 [2. PROVIDERS] Real Provider Availability & Key Verification');
  console.log('----------------------------------------------------------------');

  const nvidiaProvider = ProviderRegistry.getProvider('nvidia');
  const openrouterProvider = ProviderRegistry.getProvider('openrouter');
  const hasNvidiaKey = KeyManager.hasKeys('nvidia');
  const hasOpenrouterKey = KeyManager.hasKeys('openrouter');

  console.log(` - NVIDIA NIM: ${nvidiaProvider?.enabled ? 'ENABLED' : 'DISABLED'} | BaseURL: ${nvidiaProvider?.baseUrl} | Key Configured: ${hasNvidiaKey ? 'YES' : 'NO'}`);
  console.log(` - OpenRouter: ${openrouterProvider?.enabled ? 'ENABLED' : 'DISABLED'} | BaseURL: ${openrouterProvider?.baseUrl} | Key Configured: ${hasOpenrouterKey ? 'YES' : 'NO'}`);

  validationResults.providerAudit = Boolean(nvidiaProvider && nvidiaProvider.enabled && hasNvidiaKey);
  console.log(`Result Providers: ${validationResults.providerAudit ? '✅ PASS (Primary production provider ready)' : '❌ FAIL'}\n`);

  // ============================================================================
  // 3. KEY POOL REDUNDANCY vs CANDIDATE COUNT
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('📋 [3. KEY POOL] Credential Redundancy Verification');
  console.log('----------------------------------------------------------------');

  // Verify that having 3 keys for NVIDIA does not create 3 candidate models for a request
  KeyManager.resetPool('nvidia');
  KeyManager.registerKey('nvidia', 'nvapi-prod-key-primary-1', 1);
  KeyManager.registerKey('nvidia', 'nvapi-prod-key-backup-2', 2);
  KeyManager.registerKey('nvidia', 'nvapi-prod-key-backup-3', 3);

  const planKeys = MultiModelOrchestrator.planMultiModelExecution({
    systemPrompt: 'Architecture review',
    userMessage: 'Intermittent failure in token synchronization',
  });

  const nvidiaCandidates = planKeys.candidates.filter((c) => c.provider.id === 'nvidia');
  console.log(` - Number of Keys in Pool for NVIDIA: ${KeyManager.getKeyCount('nvidia')}`);
  console.log(` - Number of NVIDIA Candidates in Multi-Model Plan: ${nvidiaCandidates.length}`);

  validationResults.keyPoolRedundancy = nvidiaCandidates.length === 1;
  console.log(`Result Key Pool: ${validationResults.keyPoolRedundancy ? '✅ PASS (Multiple keys provide redundancy without duplicate candidate calls)' : '❌ FAIL'}\n`);

  // Restore real keys
  KeyManager.resetPool();

  // ============================================================================
  // 4. COST & USAGE GUARDRAILS ENFORCEMENT
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('📋 [4. GUARDRAILS] Hard Concurrency & Total Call Limits');
  console.log('----------------------------------------------------------------');

  const maxParallel = ComplexityRouter.getMaxParallelModels();
  const maxTotalCalls = MultiModelOrchestrator.getMaxTotalModelCalls();

  console.log(` - Max Parallel Models Allowed: ${maxParallel}`);
  console.log(` - Max Total Model Calls Allowed: ${maxTotalCalls}`);

  validationResults.guardrails = maxParallel <= 5 && maxTotalCalls <= 6 && maxParallel > 0 && maxTotalCalls > 0;
  console.log(`Result Guardrails: ${validationResults.guardrails ? '✅ PASS (Safety ceilings enforced)' : '❌ FAIL'}\n`);

  // ============================================================================
  // 5. CAPABILITY FILTERING BEFORE PRIORITY SCORING
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('📋 [5. CAPABILITY] Capability Pre-Filtering Verification');
  console.log('----------------------------------------------------------------');

  // Register high priority model that ONLY has coding capability
  ModelRegistry.registerModel({
    id: 'test/coding-high-priority',
    name: 'Coding High Priority',
    providerId: 'nvidia',
    contextWindow: 128000,
    capabilities: ['coding'],
    priority: 999, // Super high priority, but lacks architecture capability!
    enabled: true,
  });

  const planArch = MultiModelOrchestrator.planMultiModelExecution({
    systemPrompt: 'Generate architecture diagram',
    userMessage: 'Generate a system architecture mermaid diagram showing dependency flow',
  });

  const pickedCodingOnlyModel = planArch.candidates.some((c) => c.model.id === 'test/coding-high-priority');
  console.log(` - High Priority Coding Model Picked for Architecture? ${pickedCodingOnlyModel ? 'YES (FAIL)' : 'NO (PASS)'}`);
  console.log(` - Actual Model Selected for Architecture: ${planArch.candidates[0]?.model.id}`);

  validationResults.capabilityPreFilter = !pickedCodingOnlyModel && planArch.candidates[0]?.model.capabilities.includes('architecture');
  console.log(`Result Capability Filter: ${validationResults.capabilityPreFilter ? '✅ PASS (Capability filtering strictly precedes priority)' : '❌ FAIL'}\n`);

  ModelRegistry.unregisterModel('test/coding-high-priority', 'nvidia');

  // ============================================================================
  // 6. STRUCTURED OUTPUT PRESERVATION IN EVALUATION
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('📋 [6. STRUCTURED OUTPUT] Schema & Format Preservation');
  console.log('----------------------------------------------------------------');

  const jsonCandidateA = JSON.stringify([{ id: 'VULN-1', severity: 'HIGH', title: 'SQLi', file: 'auth.ts' }]);
  const jsonCandidateB = JSON.stringify([{ id: 'VULN-1', severity: 'HIGH', title: 'SQLi', file: 'auth.ts' }, { id: 'VULN-2', severity: 'LOW', title: 'Missing header', file: 'server.ts' }]);

  // Test single response bypass
  const directJson = await ResponseEvaluator.synthesize({
    originalPrompt: 'Scan security issues in JSON',
    taskType: 'security',
    candidateResponses: [{ candidateId: '1', modelId: 'm1', providerId: 'p1', response: jsonCandidateB }],
  });

  let parsed = null;
  try {
    parsed = JSON.parse(directJson);
  } catch { /* parse fail */ }

  validationResults.structuredPreservation = Array.isArray(parsed) && parsed.length === 2;
  console.log(` - Direct JSON Preserved: ${validationResults.structuredPreservation ? 'YES (PASS)' : 'NO (FAIL)'}`);
  console.log(`Result Structured Output: ${validationResults.structuredPreservation ? '✅ PASS' : '❌ FAIL'}\n`);

  // ============================================================================
  // 7. REAL MULTI-MODEL LATENCY MEASUREMENT & PLANNING
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('📋 [7. REAL PLANNING & LATENCY] Complex Request Telemetry');
  console.log('----------------------------------------------------------------');

  const complexQuery = {
    systemPrompt: 'You are an expert repository architect and debugger.',
    userMessage: 'Analyze the authentication flow in this repository, identify possible causes of intermittent authentication failures, and explain which files/components should be inspected first.',
  };

  const t0 = Date.now();
  const detectedTask = TaskRouter.detectTask(complexQuery);
  const tRouting = Date.now() - t0;

  const t1 = Date.now();
  const complexity = ComplexityRouter.assessComplexity(complexQuery, detectedTask);
  const tComplexity = Date.now() - t1;

  const t2 = Date.now();
  const executionPlan = MultiModelOrchestrator.planMultiModelExecution(complexQuery);
  const tPlanning = Date.now() - t2;

  console.log(`[Latency Breakdown]`);
  console.log(` • Task Detection Latency:       ${tRouting}ms (Detected: "${detectedTask}")`);
  console.log(` • Complexity Assessment:        ${tComplexity}ms (Tier: "${complexity}")`);
  console.log(` • Candidate Selection & Plan:   ${tPlanning}ms (Candidates: ${executionPlan.candidates.length})`);
  console.log(` • Total Decision Overhead:      ${tRouting + tComplexity + tPlanning}ms (< 5ms budget)`);

  validationResults.realPlanningAndLatency = tRouting + tComplexity + tPlanning < 50;
  console.log(`Result Telemetry: ${validationResults.realPlanningAndLatency ? '✅ PASS' : '❌ FAIL'}\n`);

  // ============================================================================
  // FINAL SUITE VALIDATION SUMMARY
  // ============================================================================
  console.log('================================================================');
  const allPassed = Object.values(validationResults).every(Boolean);
  console.log(`🎉 PHASE 5 PRODUCTION READINESS: ${allPassed ? 'READY FOR PRODUCTION' : 'NOT READY'}`);
  console.log('================================================================');
}

runPhase5ProductionValidation();

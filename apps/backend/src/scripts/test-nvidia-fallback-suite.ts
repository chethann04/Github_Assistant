import { ProviderHealthManager } from '../ai/provider-health.js';
import { ProviderRouter } from '../ai/provider-router.js';
import { OpenAIService } from '../services/openai.service.js';
import { GeminiService } from '../services/gemini.service.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${testName}${detail ? `: ${detail}` : ''}`);
  }
}

async function runTests() {
  console.log('=============================================================================');
  console.log('🤖 CHATBOT PROVIDER HIERARCHY (OpenRouter > NVIDIA > Gemini > OpenAI) TEST SUITE');
  console.log('=============================================================================\n');

  process.env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 'sk-or-mock-openrouter-key-12345';
  process.env.NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || 'nvapi-mock-nvidia-key-12345';
  process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'mock-gemini-key-12345';
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-mock-openai-key-12345';

  // Save original methods
  const originalOpenAIGenerate = OpenAIService.generate;
  const originalOpenAIStream = OpenAIService.streamChat;
  const originalGeminiGenerate = GeminiService.generate;
  const originalGeminiStream = GeminiService.streamChat;

  try {
    // -----------------------------------------------------------------
    // TEST 1: OpenRouter succeeds
    // Expected: OpenRouter response, NVIDIA/Gemini/OpenAI not called.
    // -----------------------------------------------------------------
    console.log('--- TEST 1: OpenRouter Primary Success Flow ---');
    ProviderHealthManager.reset();

    let openRouterCalled: boolean = false;
    let nvidiaCalled: boolean = false;
    let geminiCalled: boolean = false;
    let openaiCalled: boolean = false;

    OpenAIService.generate = async (_sys, _user, _max, ctx) => {
      const pName = (ctx?.providerName || '').toLowerCase();
      if (pName.includes('openrouter')) {
        openRouterCalled = true;
        return 'OpenRouter Response: Success';
      }
      if (pName.includes('nvidia')) {
        nvidiaCalled = true;
        return 'NVIDIA Response';
      }
      openaiCalled = true;
      return 'OpenAI Response';
    };
    GeminiService.generate = async () => {
      geminiCalled = true;
      return 'Gemini Response';
    };

    const res1 = await ProviderRouter.generate({
      systemPrompt: 'System',
      userMessage: 'Hello',
    });

    assert(Boolean(openRouterCalled), 'TEST 1: OpenRouter was called as highest priority');
    assert(!nvidiaCalled, 'TEST 1: NVIDIA was NOT called when OpenRouter succeeded');
    assert(!geminiCalled, 'TEST 1: Gemini was NOT called');
    assert(!openaiCalled, 'TEST 1: OpenAI was NOT called');
    assert(res1 === 'OpenRouter Response: Success', 'TEST 1: Response matches OpenRouter output');

    // -----------------------------------------------------------------
    // TEST 2: OpenRouter returns 429
    // Expected: OpenRouter cooldown activated, immediate fallback to NVIDIA without retries.
    // -----------------------------------------------------------------
    console.log('\n--- TEST 2: OpenRouter 429 Rate Limit Immediate Fallback to NVIDIA ---');
    ProviderHealthManager.reset();

    let openRouterAttempts = 0;
    nvidiaCalled = false;
    geminiCalled = false;

    OpenAIService.generate = async (_sys, _user, _max, ctx) => {
      const pName = (ctx?.providerName || '').toLowerCase();
      if (pName.includes('openrouter')) {
        openRouterAttempts++;
        const err: any = new Error('OpenRouter Rate Limited');
        err.status = 429;
        throw err;
      }
      if (pName.includes('nvidia')) {
        nvidiaCalled = true;
        return 'NVIDIA Response: Handled Fallback';
      }
      return 'Other';
    };

    const res2 = await ProviderRouter.generate({
      systemPrompt: 'System',
      userMessage: 'Rate limited request',
    });

    assert(openRouterAttempts === 1, 'TEST 2: OpenRouter attempted exactly ONCE without duplicate retries');
    assert(Boolean(nvidiaCalled), 'TEST 2: NVIDIA NIM handled request as 2nd preference');
    assert(!geminiCalled, 'TEST 2: Gemini was NOT called when NVIDIA succeeded');
    assert(res2 === 'NVIDIA Response: Handled Fallback', 'TEST 2: Response matches NVIDIA output');
    assert(ProviderHealthManager.isProviderInCooldown('openrouter'), 'TEST 2: OpenRouter cooldown is ACTIVE');

    // -----------------------------------------------------------------
    // TEST 3: OpenRouter returns 402 INSUFFICIENT_CREDITS
    // Expected: OpenRouter cooldown activated, immediate fallback to NVIDIA without retries.
    // -----------------------------------------------------------------
    console.log('\n--- TEST 3: OpenRouter 402 Insufficient Credits Fallback to NVIDIA ---');
    ProviderHealthManager.reset();

    openRouterAttempts = 0;
    nvidiaCalled = false;

    OpenAIService.generate = async (_sys, _user, _max, ctx) => {
      const pName = (ctx?.providerName || '').toLowerCase();
      if (pName.includes('openrouter')) {
        openRouterAttempts++;
        const err: any = new Error('OpenRouter 402 Payment Required: Insufficient Credits');
        err.status = 402;
        throw err;
      }
      if (pName.includes('nvidia')) {
        nvidiaCalled = true;
        return 'NVIDIA Response: Handled 402 Fallback';
      }
      return 'Other';
    };

    const res3 = await ProviderRouter.generate({
      systemPrompt: 'System',
      userMessage: 'Insufficient credits request',
    });

    assert(openRouterAttempts === 1, 'TEST 3: OpenRouter was not repeatedly retried on 402');
    assert(Boolean(nvidiaCalled), 'TEST 3: NVIDIA handled request immediately');
    assert(res3 === 'NVIDIA Response: Handled 402 Fallback', 'TEST 3: Correct response returned');
    assert(ProviderHealthManager.isProviderInCooldown('openrouter'), 'TEST 3: OpenRouter disabled temporarily');

    // -----------------------------------------------------------------
    // TEST 4: OpenRouter unavailable + NVIDIA succeeds
    // Expected: OpenRouter skipped, NVIDIA response returned.
    // -----------------------------------------------------------------
    console.log('\n--- TEST 4: OpenRouter in Cooldown -> NVIDIA Directly ---');
    openRouterCalled = false;
    nvidiaCalled = false;

    OpenAIService.generate = async (_sys, _user, _max, ctx) => {
      const pName = (ctx?.providerName || '').toLowerCase();
      if (pName.includes('openrouter')) {
        openRouterCalled = true;
        return 'OpenRouter should not be called';
      }
      if (pName.includes('nvidia')) {
        nvidiaCalled = true;
        return 'NVIDIA Response: Direct Cooldown Route';
      }
      return 'Other';
    };

    const res4 = await ProviderRouter.generate({
      systemPrompt: 'System',
      userMessage: 'Request during OpenRouter cooldown',
    });

    assert(!openRouterCalled, 'TEST 4: OpenRouter was bypassed during cooldown');
    assert(Boolean(nvidiaCalled), 'TEST 4: NVIDIA NIM called directly');
    assert(res4 === 'NVIDIA Response: Direct Cooldown Route', 'TEST 4: Response matches NVIDIA');

    // -----------------------------------------------------------------
    // TEST 5: OpenRouter unavailable + NVIDIA 429 -> Gemini response
    // -----------------------------------------------------------------
    console.log('\n--- TEST 5: OpenRouter unavailable + NVIDIA 429 -> Gemini Fallback ---');
    let nvidiaAttempts = 0;
    geminiCalled = false;

    OpenAIService.generate = async (_sys, _user, _max, ctx) => {
      const pName = (ctx?.providerName || '').toLowerCase();
      if (pName.includes('nvidia')) {
        nvidiaAttempts++;
        const err: any = new Error('NVIDIA 429 Rate Limit');
        err.status = 429;
        throw err;
      }
      return 'Other';
    };
    GeminiService.generate = async () => {
      geminiCalled = true;
      return 'Gemini Response: 3rd Preference Fallback';
    };

    const res5 = await ProviderRouter.generate({
      systemPrompt: 'System',
      userMessage: 'OpenRouter in cooldown and NVIDIA 429',
    });

    assert(nvidiaAttempts === 1, 'TEST 5: NVIDIA attempted once without retry on 429');
    assert(Boolean(geminiCalled), 'TEST 5: Gemini handled request as fallback');
    assert(res5 === 'Gemini Response: 3rd Preference Fallback', 'TEST 5: Correct response from Gemini');
    assert(ProviderHealthManager.isProviderInCooldown('nvidia'), 'TEST 5: NVIDIA cooldown is now ACTIVE');

    // -----------------------------------------------------------------
    // TEST 6: OpenRouter + NVIDIA unavailable -> Gemini directly
    // -----------------------------------------------------------------
    console.log('\n--- TEST 6: OpenRouter & NVIDIA in Cooldown -> Gemini Directly ---');
    openRouterCalled = false;
    nvidiaCalled = false;
    geminiCalled = false;

    GeminiService.generate = async () => {
      geminiCalled = true;
      return 'Gemini Response: Direct Dual-Cooldown Route';
    };

    const res6 = await ProviderRouter.generate({
      systemPrompt: 'System',
      userMessage: 'Request during OpenRouter and NVIDIA cooldown',
    });

    assert(!openRouterCalled, 'TEST 6: OpenRouter bypassed');
    assert(!nvidiaCalled, 'TEST 6: NVIDIA bypassed');
    assert(Boolean(geminiCalled), 'TEST 6: Gemini called directly');
    assert(res6 === 'Gemini Response: Direct Dual-Cooldown Route', 'TEST 6: Correct response returned');

    // -----------------------------------------------------------------
    // TEST 7: OpenRouter + NVIDIA + Gemini unavailable -> OpenAI response
    // -----------------------------------------------------------------
    console.log('\n--- TEST 7: OpenRouter, NVIDIA, Gemini unavailable -> OpenAI 4th Preference ---');
    ProviderHealthManager.markProviderUnavailable('gemini', '429 RATE_LIMIT', 429);
    openaiCalled = false;

    OpenAIService.generate = async (_sys, _user, _max, ctx) => {
      const pName = (ctx?.providerName || '').toLowerCase();
      if (pName.includes('openai')) {
        openaiCalled = true;
        return 'OpenAI Response: 4th Final Fallback';
      }
      return 'Other';
    };

    const res7 = await ProviderRouter.generate({
      systemPrompt: 'System',
      userMessage: 'Request when first 3 providers unavailable',
    });

    assert(Boolean(openaiCalled), 'TEST 7: OpenAI was called as 4th preference');
    assert(res7 === 'OpenAI Response: 4th Final Fallback', 'TEST 7: Correct response from OpenAI');

    // -----------------------------------------------------------------
    // TEST 8: All providers unavailable -> clean error
    // -----------------------------------------------------------------
    console.log('\n--- TEST 8: All Providers Fail / In Cooldown ---');
    ProviderHealthManager.markProviderUnavailable('openai', '429 RATE_LIMIT', 429);

    let caughtAllFailed = false;
    try {
      await ProviderRouter.generate({
        systemPrompt: 'System',
        userMessage: 'All providers in cooldown',
      });
    } catch (err: any) {
      caughtAllFailed = true;
      assert(true, 'TEST 8: Clean error thrown when all providers are unavailable', err.message);
    }
    assert(caughtAllFailed, 'TEST 8: Handled gracefully without infinite loop');

    // -----------------------------------------------------------------
    // TEST 9: OpenRouter cooldown expires -> restored as highest priority
    // -----------------------------------------------------------------
    console.log('\n--- TEST 9: OpenRouter Cooldown Expiration & Recovery ---');
    ProviderHealthManager.reset();
    ProviderHealthManager.markProviderUnavailable('openrouter', '429 RATE_LIMIT', 429);
    // Expire OpenRouter cooldown
    ProviderHealthManager.setProviderCooldownUntilForTesting('openrouter', Date.now() - 1000);

    openRouterCalled = false;
    nvidiaCalled = false;

    OpenAIService.generate = async (_sys, _user, _max, ctx) => {
      const pName = (ctx?.providerName || '').toLowerCase();
      if (pName.includes('openrouter')) {
        openRouterCalled = true;
        return 'OpenRouter Response: Restored After Expiry';
      }
      if (pName.includes('nvidia')) {
        nvidiaCalled = true;
        return 'NVIDIA';
      }
      return 'Other';
    };

    const res9 = await ProviderRouter.generate({
      systemPrompt: 'System',
      userMessage: 'Request after OpenRouter cooldown expires',
    });

    assert(Boolean(openRouterCalled), 'TEST 9: OpenRouter restored as highest-priority provider');
    assert(!nvidiaCalled, 'TEST 9: NVIDIA not needed');
    assert(res9 === 'OpenRouter Response: Restored After Expiry', 'TEST 9: OpenRouter succeeded');
    assert(!ProviderHealthManager.isProviderInCooldown('openrouter'), 'TEST 9: OpenRouter cooldown cleared');

    // -----------------------------------------------------------------
    // TEST 10: NVIDIA cooldown expires -> eligible again but OpenRouter is 1st
    // -----------------------------------------------------------------
    console.log('\n--- TEST 10: NVIDIA Recovery with OpenRouter Primary ---');
    ProviderHealthManager.markProviderUnavailable('nvidia', '429 RATE_LIMIT', 429);
    ProviderHealthManager.setProviderCooldownUntilForTesting('nvidia', Date.now() - 1000);

    openRouterCalled = false;
    nvidiaCalled = false;

    const res10 = await ProviderRouter.generate({
      systemPrompt: 'System',
      userMessage: 'Request when both are healthy',
    });

    assert(Boolean(openRouterCalled), 'TEST 10: OpenRouter is attempted 1st even when NVIDIA recovered');
    assert(!nvidiaCalled, 'TEST 10: NVIDIA is 2nd preference');
    assert(!ProviderHealthManager.isProviderInCooldown('nvidia'), 'TEST 10: NVIDIA cooldown cleared');

    // -----------------------------------------------------------------
    // TEST 11: Streaming Fallback across full chain
    // -----------------------------------------------------------------
    console.log('\n--- TEST 11: Streaming Fallback (OpenRouter 402 -> NVIDIA 429 -> Gemini Stream) ---');
    ProviderHealthManager.reset();

    OpenAIService.streamChat = async function* (_sys, _user, _hist, ctx) {
      const pName = (ctx?.providerName || '').toLowerCase();
      if (pName.includes('openrouter')) {
        const err: any = new Error('OpenRouter 402 Payment Required');
        err.status = 402;
        throw err;
      }
      if (pName.includes('nvidia')) {
        const err: any = new Error('NVIDIA 429 Rate Limit');
        err.status = 429;
        throw err;
      }
      yield 'OpenAI Stream';
    };
    GeminiService.streamChat = async function* () {
      yield 'Hello ';
      yield 'from ';
      yield 'Gemini ';
      yield 'Stream!';
    };

    let streamedContent = '';
    for await (const token of ProviderRouter.streamChat({
      systemPrompt: 'System',
      userMessage: 'Stream fallback across chain',
    })) {
      streamedContent += token;
    }

    assert(streamedContent === 'Hello from Gemini Stream!', 'TEST 11: Stream cleanly fell back to Gemini', `Got: ${streamedContent}`);
    assert(ProviderHealthManager.isProviderInCooldown('openrouter'), 'TEST 11: OpenRouter cooldown activated');
    assert(ProviderHealthManager.isProviderInCooldown('nvidia'), 'TEST 11: NVIDIA cooldown activated');

  } finally {
    // Restore original methods
    OpenAIService.generate = originalOpenAIGenerate;
    OpenAIService.streamChat = originalOpenAIStream;
    GeminiService.generate = originalGeminiGenerate;
    GeminiService.streamChat = originalGeminiStream;
    ProviderHealthManager.reset();
  }

  console.log('\n=============================================================================');
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('=============================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

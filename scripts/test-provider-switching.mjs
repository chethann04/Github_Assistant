import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testProviderSwitching() {
  console.log('====================================================');
  console.log('TESTING PROVIDER SWITCHING & RESOLUTION');
  console.log('====================================================\n');

  // 1. TEST NVIDIA CONFIGURATION & RESOLUTION
  console.log('--- [TEST 1] Testing with LLM_PROVIDER="nvidia" ---');
  process.env.LLM_PROVIDER = 'nvidia';
  
  // Dynamic import of config and services
  const envModNvidia = await import(`../apps/backend/src/config/env.ts?t=${Date.now()}`);
  const configNv = envModNvidia.config;

  console.log('Resolved Provider:', configNv.llmProvider);
  console.log('Resolved Base URL:', configNv.openaiBaseUrl);
  console.log('Resolved Model:', configNv.openaiModel);
  console.log('Is NVIDIA Provider Flag:', configNv.isNvidiaProvider);
  console.log('Is OpenRouter Provider Flag:', configNv.isOpenRouterProvider);

  const openaiServiceModNv = await import(`../apps/backend/src/services/openai.service.ts?t=${Date.now()}`);
  const OpenAIServiceNv = openaiServiceModNv.OpenAIService;
  console.log('OpenAIService Provider Name:', OpenAIServiceNv.getProviderName());
  console.log('OpenAIService Configured:', OpenAIServiceNv.isConfigured());

  console.log('\nSending test prompt to NVIDIA GLM-5.2 via OpenAIService.streamChat...');
  const startNv = Date.now();
  let nvText = '';
  try {
    for await (const chunk of OpenAIServiceNv.streamChat(
      'You are a helpful assistant.',
      'Reply with exactly: NVIDIA GLM-5.2 integration successful.'
    )) {
      nvText += chunk;
    }
    const elapsedNv = ((Date.now() - startNv) / 1000).toFixed(2);
    console.log(`NVIDIA Response (${elapsedNv}s): "${nvText.trim()}"`);
    console.log('NVIDIA Test: PASS');
  } catch (err) {
    console.error('NVIDIA Test Error:', err.message);
  }

  // 2. TEST OPENROUTER CONFIGURATION & RESOLUTION
  console.log('\n----------------------------------------------------');
  console.log('--- [TEST 2] Testing with LLM_PROVIDER="openrouter" ---');
  process.env.LLM_PROVIDER = 'openrouter';

  const envModOpenRouter = await import(`../apps/backend/src/config/env.ts?t=${Date.now() + 1}`);
  const configOr = envModOpenRouter.config;

  console.log('Resolved Provider:', configOr.llmProvider);
  console.log('Resolved Base URL:', configOr.openaiBaseUrl);
  console.log('Resolved Model:', configOr.openaiModel);
  console.log('Is NVIDIA Provider Flag:', configOr.isNvidiaProvider);
  console.log('Is OpenRouter Provider Flag:', configOr.isOpenRouterProvider);

  const openaiServiceModOr = await import(`../apps/backend/src/services/openai.service.ts?t=${Date.now() + 1}`);
  const OpenAIServiceOr = openaiServiceModOr.OpenAIService;
  console.log('OpenAIService Provider Name:', OpenAIServiceOr.getProviderName());
  console.log('OpenAIService Configured:', OpenAIServiceOr.isConfigured());

  console.log('\nSending test prompt to OpenRouter GLM-5.2 via OpenAIService.streamChat...');
  const startOr = Date.now();
  let orText = '';
  try {
    for await (const chunk of OpenAIServiceOr.streamChat(
      'You are a helpful assistant.',
      'Reply with exactly: OpenRouter GLM-5.2 integration successful.'
    )) {
      orText += chunk;
    }
    const elapsedOr = ((Date.now() - startOr) / 1000).toFixed(2);
    console.log(`OpenRouter Response (${elapsedOr}s): "${orText.trim()}"`);
  } catch (err) {
    console.error('OpenRouter Test Error:', err.message);
  }

  // 3. TEST 402 ERROR HANDLING MAPPING
  console.log('\n----------------------------------------------------');
  console.log('--- [TEST 3] Testing Sanitized Error Mapping for HTTP 402 ---');
  const mock402 = {
    status: 402,
    message: 'Insufficient credits. This account never purchased credits.',
  };
  const mappedError = OpenAIServiceOr.mapUserFriendlyError(mock402);
  console.log('Mapped 402 Error Code:', mappedError.code);
  console.log('Mapped 402 Error Message:', mappedError.message);

  console.log('\n====================================================');
  console.log('TEST COMPLETE');
  console.log('====================================================');
}

testProviderSwitching();

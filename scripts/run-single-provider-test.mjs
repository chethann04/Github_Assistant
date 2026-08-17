import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Allow overriding LLM_PROVIDER from command line argument
const cliProvider = process.argv[2];
if (cliProvider) {
  process.env.LLM_PROVIDER = cliProvider;
}

dotenv.config({ path: path.resolve(__dirname, '../.env') });
if (cliProvider) {
  process.env.LLM_PROVIDER = cliProvider;
}

async function run() {
  const { config } = await import('../apps/backend/src/config/env.ts');
  const { OpenAIService } = await import('../apps/backend/src/services/openai.service.ts');
  const { LLMService } = await import('../apps/backend/src/services/llm.service.ts');

  console.log('========================================================');
  console.log(`🚀 TEST RUNNER: LLM_PROVIDER="${config.llmProvider}"`);
  console.log('========================================================');
  console.log(' - config.llmProvider:', config.llmProvider);
  console.log(' - config.openaiBaseUrl:', config.openaiBaseUrl);
  console.log(' - config.openaiModel:', config.openaiModel);
  console.log(' - config.isNvidiaProvider:', config.isNvidiaProvider);
  console.log(' - config.isOpenRouterProvider:', config.isOpenRouterProvider);
  console.log(' - OpenAIService.getProviderName():', OpenAIService.getProviderName());
  console.log(' - OpenAIService.isConfigured():', OpenAIService.isConfigured());
  console.log(' - LLMService.getAvailableProviders():', JSON.stringify(LLMService.getAvailableProviders()));

  console.log('\n[Streaming Chat Test]');
  const prompt = `Reply with exactly: ${OpenAIService.getProviderName()} integration successful.`;
  const start = Date.now();
  let full = '';
  try {
    for await (const chunk of LLMService.streamChat({
      systemPrompt: 'You are a helpful assistant.',
      userMessage: prompt,
    })) {
      full += chunk;
    }
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`Stream Output (${elapsed}s):\n${full.trim()}`);
  } catch (err) {
    console.error('Stream Error:', err.message);
  }
}

run();

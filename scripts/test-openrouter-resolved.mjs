import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
process.env.LLM_PROVIDER = 'openrouter';

async function testOpenRouterResolved() {
  console.log('Testing OpenRouter resolution with LLM_PROVIDER="openrouter"...');
  const { config } = await import('../apps/backend/src/config/env.ts');
  console.log('Config Provider:', config.llmProvider);
  console.log('Config Base URL:', config.openaiBaseUrl);
  console.log('Config Model:', config.openaiModel);
  console.log('Config isOpenRouterProvider:', config.isOpenRouterProvider);

  const { OpenAIService } = await import('../apps/backend/src/services/openai.service.ts');
  console.log('OpenAIService Provider Name:', OpenAIService.getProviderName());
  console.log('OpenAIService Configured:', OpenAIService.isConfigured());

  console.log('\nInvoking OpenAIService.streamChat for OpenRouter...');
  let full = '';
  for await (const chunk of OpenAIService.streamChat(
    'You are a helpful assistant.',
    'Reply with exactly: OpenRouter GLM-5.2 integration successful.'
  )) {
    full += chunk;
  }
  console.log('Stream Output:\n', full);
}

testOpenRouterResolved();

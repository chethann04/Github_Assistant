import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runProcess(envProvider) {
  return new Promise((resolve, reject) => {
    console.log(`\n========================================================`);
    console.log(`🚀 RUNNING BACKEND RUNTIME WITH LLM_PROVIDER="${envProvider}"`);
    console.log(`========================================================`);

    const child = spawn('npx', ['tsx', '-e', `
      import { config } from './apps/backend/src/config/env.ts';
      import { OpenAIService } from './apps/backend/src/services/openai.service.ts';
      import { LLMService } from './apps/backend/src/services/llm.service.ts';

      async function run() {
        console.log('[Runtime Config]');
        console.log(' - config.llmProvider:', config.llmProvider);
        console.log(' - config.openaiBaseUrl:', config.openaiBaseUrl);
        console.log(' - config.openaiModel:', config.openaiModel);
        console.log(' - config.isNvidiaProvider:', config.isNvidiaProvider);
        console.log(' - config.isOpenRouterProvider:', config.isOpenRouterProvider);
        console.log(' - OpenAIService.getProviderName():', OpenAIService.getProviderName());
        console.log(' - OpenAIService.isConfigured():', OpenAIService.isConfigured());
        console.log(' - LLMService.getAvailableProviders():', JSON.stringify(LLMService.getAvailableProviders()));

        console.log('\\n[Stream Test]');
        const prompt = 'Reply with exactly: ' + OpenAIService.getProviderName() + ' integration successful.';
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
          console.log('Stream Output (' + elapsed + 's):\\n' + full.trim());
        } catch (err) {
          console.error('Stream Error:', err.message);
        }
      }

      run();
    `], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, LLM_PROVIDER: envProvider },
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Process exited with code ${code}`));
    });
  });
}

async function main() {
  // Test OpenRouter first (fast resolution & error mapping)
  await runProcess('openrouter');
  
  // Test NVIDIA NIM (streaming with GLM-5.2)
  await runProcess('nvidia');

  console.log('\n========================================================');
  console.log('🎉 ALL INTEGRATION & PROVIDER SWITCHING TESTS FINISHED');
  console.log('========================================================');
}

main().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});

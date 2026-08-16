import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../apps/backend/.env') });
dotenv.config();

async function run() {
  console.log('====================================================');
  console.log('⏱️ MEASURING NVIDIA GLM-5.2 TTFT & GENERATION LATENCY');
  console.log('====================================================\n');

  const { OpenAIService } = await import('../apps/backend/src/services/openai.service.ts');

  const systemPrompt = 'You are a principal software architect. Analyze the provided repository code chunks and produce an evidence-based architecture report in markdown format.';
  const userMessage = `Repository: cordiverse/cordis (TypeScript)
Code Evidence:
[CITATION #1: packages/core/src/index.ts (Lines 1-45)]
export * from '@cordisjs/core';
export class Context {
  constructor(public config: any) {}
  plugin(plugin: any, options?: any) {}
  start() {}
}

[CITATION #2: packages/timer/src/index.ts (Lines 1-35)]
export class TimerService {
  setTimeout(cb: Function, ms: number) {}
  setInterval(cb: Function, ms: number) {}
}

Provide a concise 3-section architecture overview.`;

  console.log('Sending request to NVIDIA GLM-5.2...');
  const start = Date.now();
  let firstTokenTime = null;
  let fullText = '';
  let tokenCount = 0;

  try {
    for await (const chunk of OpenAIService.streamChat(systemPrompt, userMessage)) {
      if (firstTokenTime === null && chunk.trim().length > 0) {
        firstTokenTime = Date.now();
        const ttft = ((firstTokenTime - start) / 1000).toFixed(2);
        console.log(`⚡ Time-to-First-Token (TTFT): ${ttft}s`);
      }
      fullText += chunk;
      tokenCount++;
    }

    const totalTime = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`\n✅ Total Generation Time: ${totalTime}s`);
    console.log(`Chunks received: ${tokenCount}`);
    console.log(`\nResponse Preview (first 300 chars):\n${fullText.slice(0, 300)}...`);
  } catch (err) {
    console.error('Generation error:', err);
  }
}

run();

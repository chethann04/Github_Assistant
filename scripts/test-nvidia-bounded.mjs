import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../apps/backend/.env') });
dotenv.config();

async function runTest() {
  console.log('Testing NVIDIA GLM-5.2 bounded retry generation...');
  const { OpenAIService } = await import('../apps/backend/src/services/openai.service.ts');

  const start = Date.now();
  try {
    const res = await OpenAIService.generate(
      'You are a software engineering assistant.',
      'Explain in 2 sentences what an Abstract Syntax Tree (AST) is.'
    );
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`\n✅ Generation succeeded in ${elapsed}s (Attempt 1, no unnecessary retries)`);
    console.log(`Response:\n${res}\n`);
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`\n❌ Generation failed in ${elapsed}s: ${err.message}`);
  }
}

runTest();

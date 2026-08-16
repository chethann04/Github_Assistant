import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../apps/backend/.env') });
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
console.log('API Key present:', Boolean(apiKey));

const ai = new GoogleGenAI({ apiKey });

async function inspectModels() {
  console.log('Inspecting ai.models methods:');
  console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(ai.models)));

  // Test single embed
  const t0 = Date.now();
  try {
    const res = await ai.models.embedContent({
      model: 'gemini-embedding-2',
      contents: 'function hello() { return "world"; }',
      config: {
        outputDimensionality: 1536,
      },
    });
    console.log(`Single embed success in ${Date.now() - t0}ms. Dims:`, res?.embedding?.values?.length || res?.embeddings?.[0]?.values?.length);
  } catch (err) {
    console.error('Single embed error:', err.message);
  }

  // Test batch array of contents if supported
  const t1 = Date.now();
  try {
    const res = await ai.models.embedContent({
      model: 'gemini-embedding-2',
      contents: [
        'function one() { return 1; }',
        'function two() { return 2; }',
        'function three() { return 3; }',
      ],
      config: {
        outputDimensionality: 1536,
      },
    });
    console.log(`Array contents embed in ${Date.now() - t1}ms:`, res);
  } catch (err) {
    console.log('Array contents embed failed:', err.message);
  }

  // Test controlled concurrency with Promise.all
  const t2 = Date.now();
  const sampleTexts = Array.from({ length: 10 }, (_, i) => `function test_${i}() { return ${i}; }`);
  try {
    const promises = sampleTexts.map((text) =>
      ai.models.embedContent({
        model: 'gemini-embedding-2',
        contents: text,
        config: { outputDimensionality: 1536 },
      })
    );
    const results = await Promise.all(promises);
    console.log(`Controlled concurrency (10 parallel) success in ${Date.now() - t2}ms for 10 texts.`);
  } catch (err) {
    console.log('Controlled concurrency failed:', err.message);
  }
}

inspectModels().catch(console.error);

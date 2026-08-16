import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../apps/backend/.env') });
dotenv.config();

async function test() {
  const { GoogleGenAI } = await import('@google/genai');
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('Testing Gemini API key:', apiKey?.slice(0, 10) + '...');

  const ai = new GoogleGenAI({ apiKey });
  try {
    const res = await ai.models.embedContent({
      model: 'gemini-embedding-2',
      contents: 'Testing live Gemini Embedding 2 for production vector consistency',
      config: { outputDimensionality: 1536 }
    });

    console.log('Keys on res:', Object.keys(res));
    console.log('res.embedding:', res.embedding);
    console.log('res.embeddings:', res.embeddings);
    const values = res?.embedding?.values || res?.embeddings?.[0]?.values || res?.values;
    console.log(`✅ Success! Received ${values?.length} continuous dimensions from Gemini Embedding 2`);
    console.log('Sample vector preview:', values.slice(0, 5));
    const zeroCount = values.filter(v => v === 0).length;
    console.log(`Zero count: ${zeroCount}/1536 (${(zeroCount/1536*100).toFixed(1)}%)`);
  } catch (err) {
    console.error(`❌ Gemini API Error:`, err.message);
  }
}

test();

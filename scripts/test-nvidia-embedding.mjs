import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../apps/backend/.env') });
dotenv.config();

async function testNvidiaEmbedding() {
  console.log('=======================================================');
  console.log('🔍 TESTING NVIDIA nv-embedcode-7b-v1 EMBEDDING API');
  console.log('=======================================================\n');

  const apiKey = process.env.NVIDIA_API_KEY;
  const baseUrl = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';
  const model = 'nvidia/nv-embedcode-7b-v1';

  console.log('Provider: NVIDIA NIM');
  console.log('Base URL:', baseUrl);
  console.log('Model:', model);
  console.log('API Key:', apiKey ? `${apiKey.slice(0, 10)}...` : 'MISSING');

  const client = new OpenAI({
    apiKey,
    baseURL: baseUrl,
  });

  try {
    const input = 'Where is the main application entry point?';
    console.log(`\nGenerating single embedding for: "${input}"`);
    const startTime = Date.now();

    const fetchRes = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input,
        input_type: 'query',
      }),
    });

    const json = await fetchRes.json();
    if (!fetchRes.ok) {
      throw new Error(`HTTP ${fetchRes.status}: ${JSON.stringify(json)}`);
    }

    const elapsed = Date.now() - startTime;
    const vector = json.data[0].embedding;

    console.log(`\n✅ NVIDIA Embedding API Call Succeeded!`);
    console.log(`- Time elapsed: ${elapsed}ms`);
    console.log(`- Returned vector length: ${vector.length}`);
    console.log(`- Vector preview (first 5):`, vector.slice(0, 5));
    console.log(`- Vector preview (last 5):`, vector.slice(-5));
    console.log(`- Is vector length === 4096?: ${vector.length === 4096 ? 'YES' : 'NO'}`);

    // Test Document (passage) vs Query (query) Cosine Similarity
    console.log('\n--- Testing Document (passage) + Query (query) Cosine Similarity ---');
    const docInput = 'src/App.tsx contains the main React application entry point.';
    const queryInput = 'Where is the main application entry point?';

    const docFetch = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: docInput,
        input_type: 'passage',
      }),
    });
    const docJson = await docFetch.json();
    const docVec = docJson.data[0].embedding;

    const queryFetch = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: queryInput,
        input_type: 'query',
      }),
    });
    const queryJson = await queryFetch.json();
    const queryVec = queryJson.data[0].embedding;

    console.log(`Doc vector length: ${docVec.length} | Query vector length: ${queryVec.length}`);

    // Compute cosine similarity
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < docVec.length; i++) {
      dot += docVec[i] * queryVec[i];
      normA += docVec[i] * docVec[i];
      normB += queryVec[i] * queryVec[i];
    }
    const similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB));
    console.log(`Cosine Similarity between doc and query: ${similarity.toFixed(4)}`);

  } catch (err) {
    console.error(`❌ NVIDIA Embedding Error:`, err.message);
  }
}

testNvidiaEmbedding();

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../apps/backend/.env') });
dotenv.config();

async function testAllModels() {
  const apiKey = process.env.NVIDIA_API_KEY;
  const baseUrl = 'https://integrate.api.nvidia.com/v1/embeddings';

  const models = [
    'nvidia/nv-embedcode-7b-v1',
    'nvidia/nv-embedqa-e5-v5',
    'nvidia/nv-embedqa-mistral-7b-v2',
    'nvidia/llama-3.2-nv-embedqa-1b-v1',
    'snowflake/arctic-embed-l',
    'baai/bge-m3',
    'nvidia/embeddings-nv-embed-qa-4'
  ];

  for (const model of models) {
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          input: ["src/App.tsx contains the main React application entry point."],
          model,
          input_type: "passage",
          encoding_format: "float",
        }),
      });

      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { json = text; }

      if (res.ok) {
        const dim = json.data?.[0]?.embedding?.length;
        console.log(`✅ Model '${model}' is ONLINE | Dims: ${dim}`);
      } else {
        console.log(`❌ Model '${model}' failed (HTTP ${res.status}): ${typeof json === 'object' ? JSON.stringify(json) : json.slice(0, 100)}`);
      }
    } catch (e) {
      console.log(`❌ Model '${model}' error: ${e.message}`);
    }
  }
}

testAllModels();

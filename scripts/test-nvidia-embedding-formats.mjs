import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../apps/backend/.env') });
dotenv.config();

async function testFormats() {
  const apiKey = process.env.NVIDIA_API_KEY;
  const baseUrl = 'https://integrate.api.nvidia.com/v1';

  const testPayloads = [
    {
      name: 'input array + input_type query + float',
      payload: {
        model: 'nvidia/nv-embedcode-7b-v1',
        input: ['Where is the main application entry point?'],
        input_type: 'query',
        encoding_format: 'float'
      }
    },
    {
      name: 'input string + input_type query + truncate NONE',
      payload: {
        model: 'nvidia/nv-embedcode-7b-v1',
        input: 'Where is the main application entry point?',
        input_type: 'query',
        truncate: 'NONE'
      }
    },
    {
      name: 'input array + input_type query (no encoding format)',
      payload: {
        model: 'nvidia/nv-embedcode-7b-v1',
        input: ['Where is the main application entry point?'],
        input_type: 'query'
      }
    },
    {
      name: 'nvidia/nv-embedqa-e5-v5 (alternative nvidia embedding model)',
      payload: {
        model: 'nvidia/nv-embedqa-e5-v5',
        input: ['Where is the main application entry point?'],
        input_type: 'query'
      }
    },
    {
      name: 'nvidia/embeddings-nv-embed-qa-4 (alternative)',
      payload: {
        model: 'nvidia/embeddings-nv-embed-qa-4',
        input: ['Where is the main application entry point?'],
        input_type: 'query'
      }
    },
    {
      name: 'baai/bge-large-en-v1.5 on nvidia nim',
      payload: {
        model: 'baai/bge-large-en-v1.5',
        input: ['Where is the main application entry point?'],
        input_type: 'query'
      }
    }
  ];

  for (const t of testPayloads) {
    console.log(`\nTesting format: ${t.name}...`);
    try {
      const res = await fetch(`${baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(t.payload)
      });
      const data = await res.json();
      if (!res.ok) {
        console.log(`  ❌ Failed (HTTP ${res.status}):`, JSON.stringify(data));
      } else {
        const vec = data.data?.[0]?.embedding;
        console.log(`  ✅ Success! Returned vector length: ${vec?.length}`);
      }
    } catch (e) {
      console.log(`  ❌ Error:`, e.message);
    }
  }
}

testFormats();

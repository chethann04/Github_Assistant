import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../apps/backend/.env') });
dotenv.config();

async function testExactCurl() {
  const apiKey = process.env.NVIDIA_API_KEY;
  const baseUrl = 'https://integrate.api.nvidia.com/v1/embeddings';

  const body = {
    input: "src/App.tsx contains the main React application entry point.",
    model: "nvidia/nv-embedcode-7b-v1",
    input_type: "passage",
    encoding_format: "float",
    truncate: "NONE"
  };

  console.log("Sending payload:", JSON.stringify(body, null, 2));

  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  console.log(`Status: ${res.status}`);
  console.log(`Response text:`, text);
}

testExactCurl();

import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

async function runAudit() {
  console.log('====================================================');
  console.log('AUDIT: Testing Direct LLM Providers with GLM-5.2');
  console.log('====================================================');

  const providers = [
    {
      name: 'NVIDIA NIM',
      apiKey: process.env.NVIDIA_API_KEY,
      baseURL: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
      model: process.env.GLM_MODEL || process.env.NVIDIA_MODEL || 'z-ai/glm-5.2',
    },
    {
      name: 'OpenRouter',
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      model: process.env.GLM_MODEL || 'z-ai/glm-5.2',
    }
  ];

  for (const prov of providers) {
    console.log(`\n----------------------------------------------------`);
    console.log(`[TESTING] ${prov.name}`);
    console.log(`Base URL: ${prov.baseURL}`);
    console.log(`Model: ${prov.model}`);
    console.log(`Key Configured: ${Boolean(prov.apiKey && prov.apiKey.length > 5)}`);

    if (!prov.apiKey) {
      console.log(`[FAIL] ${prov.name}: Missing API Key`);
      continue;
    }

    const client = new OpenAI({
      apiKey: prov.apiKey,
      baseURL: prov.baseURL,
      timeout: 30000,
    });

    // Test 1: Simple Prompt Streaming
    console.log(`\n--> Test 1: Simple Prompt (Streaming)`);
    const prompt1 = `Reply with exactly: ${prov.name} GLM-5.2 integration successful.`;
    const startStream = Date.now();
    try {
      const stream = await client.chat.completions.create({
        model: prov.model,
        messages: [{ role: 'user', content: prompt1 }],
        temperature: 0.1,
        max_tokens: 100,
        stream: true,
      });

      let streamOutput = '';
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || '';
        streamOutput += text;
      }
      const streamDuration = Date.now() - startStream;
      console.log(`Response (${streamDuration}ms): "${streamOutput.trim()}"`);
      console.log(`Result: PASS`);
    } catch (err) {
      console.log(`[FAIL] Streaming failed:`, err.status, err.message);
      if (err.error) console.log(`Error details:`, JSON.stringify(err.error));
    }

    // Test 2: Structured JSON Generation (Used by Generate Buttons: Architecture, Docs, Security, etc.)
    console.log(`\n--> Test 2: Structured JSON (Generate button simulation)`);
    const jsonPrompt = `Analyze this code snippet and return ONLY a valid JSON object with the following schema:
{
  "summary": "one sentence summary",
  "status": "success",
  "score": 95
}
Snippet:
function add(a, b) { return a + b; }`;

    const startJson = Date.now();
    try {
      const stream = await client.chat.completions.create({
        model: prov.model,
        messages: [
          { role: 'system', content: 'You are a code analysis tool. Output valid JSON only, without any markdown code fence.' },
          { role: 'user', content: jsonPrompt }
        ],
        temperature: 0.1,
        max_tokens: 300,
        stream: true,
      });

      let jsonOutput = '';
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || '';
        jsonOutput += text;
      }
      const jsonDuration = Date.now() - startJson;
      console.log(`Raw output (${jsonDuration}ms): ${jsonOutput.trim()}`);
      
      // Clean JSON if fences exist
      let cleaned = jsonOutput.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
      if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
      if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
      cleaned = cleaned.trim();

      const parsed = JSON.parse(cleaned);
      console.log(`Parsed JSON:`, parsed);
      console.log(`Result: PASS (Valid structured response)`);
    } catch (err) {
      console.log(`[FAIL] Structured JSON failed:`, err.status, err.message);
    }
  }

  console.log('\n====================================================');
  console.log('AUDIT SCRIPT COMPLETE');
  console.log('====================================================');
}

runAudit();

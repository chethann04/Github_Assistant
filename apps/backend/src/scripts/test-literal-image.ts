import { config } from '../config/env.js';

function sanitize(text: string): string {
  // Replace full data:image URIs or data:image prefixes
  return text.replace(/data:image(?:\/[^"'\s)>]+|(?:\/)?)/gi, '[IMAGE_DATA_URI]');
}

async function testAll() {
  const cases = [
    'if not lowered.startswith("data:image/"):',
    'const icon = "data:image/png;base64,iVBORw0KGgo=";',
    'const mime = "data:image";',
    'const svg = "data:image/svg+xml;utf8,<svg></svg>";',
    '<img src="data:image/jpeg;base64,/9j/4AAQSkZJRg==" alt="test">'
  ];

  for (const c of cases) {
    const s = sanitize(c);
    console.log(`Original: ${c}`);
    console.log(`Sanitized: ${s}`);
    const res = await fetch(`${config.nvidiaBaseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.nvidiaApiKey}`,
      },
      body: JSON.stringify({
        model: config.embeddingModel,
        input: [s],
        input_type: 'passage',
      }),
    });
    console.log(`Status: ${res.status}\n`);
  }
}

testAll();

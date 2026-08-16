import http from 'http';

const ACTIONS = [
  'Understand Project',
  'Explain Architecture',
  'Explain Data Flow',
  'Explain Authentication',
  'Explain Database',
  'Explain API Flow',
  'Explain Main Features',
  'Find Entry Point',
  'Find Important Files',
];

async function run() {
  console.log('1. Fetching repositories & acquiring anonymous session cookie...');
  
  const reposRes = await fetch('http://localhost:4000/api/v1/repos');
  const cookie = reposRes.headers.get('set-cookie');
  const repos = await reposRes.json();
  
  if (!repos || repos.length === 0) {
    console.error('[ERROR] No repositories found in database.');
    process.exit(1);
  }

  const targetRepo = repos[0];
  console.log(`[INFO] Using repository: ${targetRepo.owner}/${targetRepo.name} (${targetRepo.id})`);

  console.log('\n2. Testing Codebase Understand Action routing with RAG context...');

  // Test the primary action: "Understand Project"
  const testAction = 'Understand Project';
  const payload = JSON.stringify({
    repositoryId: targetRepo.id,
    query: testAction,
    mode: 'repo',
    provider: 'openai',
  });

  const req = http.request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/v1/chat/stream',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...(cookie ? { 'Cookie': cookie.split(';')[0] } : {}),
      },
    },
    (res) => {
      let raw = '';
      let citationsReceived = [];
      let tokenCount = 0;

      res.on('data', (chunk) => {
        raw += chunk.toString();
        const lines = raw.split('\n');
        raw = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const str = line.slice(6).trim();
              if (str === '[DONE]') {
                console.log(`\n\n[PASS] "${testAction}" stream completed [DONE]. Total tokens: ${tokenCount}`);
                return;
              }
              const parsed = JSON.parse(str);
              if (parsed.type === 'citations') {
                const list = Array.isArray(parsed.data) ? parsed.data : parsed.data?.citations || [];
                citationsReceived = list;
                console.log(`\n[PASS] "${testAction}" Citations Received (${list.length} sources):`);
                list.slice(0, 5).forEach((c, idx) => {
                  console.log(`  📄 [Source ${idx + 1}] ${c.filePath} (Lines ${c.startLine}–${c.endLine}) [Score: ${(c.score * 100).toFixed(1)}%]`);
                });
              } else if (parsed.type === 'token') {
                tokenCount++;
                const tokenStr = parsed.data?.token !== undefined ? parsed.data.token : (typeof parsed.data === 'string' ? parsed.data : '');
                if (tokenCount === 1) {
                  process.stdout.write(`\n[PASS] Streaming GLM-5.2 response for "${testAction}": `);
                }
                process.stdout.write(tokenStr);
              }
            } catch {}
          }
        }
      });

      res.on('end', () => {
        if (citationsReceived.length > 0) {
          console.log('\n\n=============================================');
          console.log('✅ PHASE 3 CODEBASE UNDERSTAND MODE VERIFICATION PASSED');
          console.log('=============================================');
          process.exit(0);
        } else {
          console.error('\n[FAIL] No citations received for Understand action.');
          process.exit(1);
        }
      });
    }
  );

  req.on('error', (err) => {
    console.error('[ERROR]', err.message);
    process.exit(1);
  });

  req.write(payload);
  req.end();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

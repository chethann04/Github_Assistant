import http from 'http';

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

  const payload = JSON.stringify({
    repositoryId: targetRepo.id,
    query: 'How is this repository structured and what are the main backend services and routes?',
    mode: 'repo',
    provider: 'openai',
  });

  console.log('\n2. Initiating RAG Stream with Phase 1 Source Citations...');

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
                console.log(`\n\n[PASS] Stream completed [DONE]. Total tokens: ${tokenCount}`);
                return;
              }
              const parsed = JSON.parse(str);
              if (parsed.type === 'citations') {
                const list = Array.isArray(parsed.data) ? parsed.data : parsed.data?.citations || [];
                if (list.length > 0) {
                  citationsReceived = list;
                  console.log(`\n[PASS] Citations Event Received (${list.length} sources):`);
                  list.forEach((c, idx) => {
                    console.log(`  📄 [Source ${idx + 1}] ${c.filePath} (Lines ${c.startLine}–${c.endLine}) [Score: ${(c.score * 100).toFixed(1)}%]`);
                    console.log(`     Snippet: ${c.snippet.slice(0, 70).replace(/\n/g, ' ')}...`);
                  });
                }
              } else if (parsed.type === 'token') {
                tokenCount++;
                const tokenStr = parsed.data?.token !== undefined ? parsed.data.token : (typeof parsed.data === 'string' ? parsed.data : '');
                if (tokenCount === 1) {
                  process.stdout.write('\n[PASS] Streaming GLM-5.2 tokens: ');
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
          console.log('✅ PHASE 1 SOURCE CITATION VERIFICATION PASSED');
          console.log('=============================================');
          process.exit(0);
        } else {
          console.error('\n[FAIL] No citations received.');
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

import axios from 'axios';

const API_BASE = 'http://localhost:4000/api/v1';

async function testLiveChatStream() {
  console.log('\n============================================================');
  console.log('💬 TESTING LIVE CHAT STREAMING PIPELINE');
  console.log('============================================================\n');

  // 1. Initialize session and get cookie
  let sessionCookie: string | null = null;
  const initRes = await axios.get(`${API_BASE}/repos`);
  const setCookie = initRes.headers['set-cookie'];
  if (setCookie && setCookie[0]) {
    sessionCookie = setCookie[0].split(';')[0];
  }
  console.log(`✓ Got anonymous session cookie: ${sessionCookie}`);

  // 2. Get repository list
  const reposRes = await axios.get(`${API_BASE}/repos`, {
    headers: sessionCookie ? { Cookie: sessionCookie } : {},
  });

  let repo = reposRes.data[0];
  if (!repo) {
    console.log('No repository found in session, importing expressjs/cors...');
    const importRes = await axios.post(
      `${API_BASE}/repos/import`,
      { url: 'https://github.com/expressjs/cors' },
      { headers: sessionCookie ? { Cookie: sessionCookie } : {} }
    );
    repo = importRes.data.repository;
  }
  console.log(`✓ Using repository: ${repo.owner}/${repo.name} (${repo.id})`);

  // 3. Test SSE stream
  console.log('\nTesting POST /api/v1/chat/stream...');
  const streamRes = await axios.post(
    `${API_BASE}/chat/stream`,
    {
      query: 'What does this project do and what are the main exports?',
      repositoryId: repo.id,
      mode: 'repo',
    },
    {
      headers: {
        'Content-Type': 'application/json',
        ...(sessionCookie ? { Cookie: sessionCookie } : {}),
      },
      responseType: 'stream',
      timeout: 30000,
    }
  );

  let tokensReceived = 0;
  let citationsReceived = 0;
  let receivedSessionId = '';

  await new Promise<void>((resolve, reject) => {
    streamRes.data.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const jsonStr = line.replace(/^data:\s*/, '').trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;
        try {
          const event = JSON.parse(jsonStr);
          if (event.type === 'sessionId') {
            receivedSessionId = event.data.sessionId;
          } else if (event.type === 'citations') {
            citationsReceived = event.data.citations.length;
          } else if (event.type === 'token') {
            tokensReceived++;
            process.stdout.write(event.data.token);
          }
        } catch {}
      }
    });

    streamRes.data.on('end', () => resolve());
    streamRes.data.on('error', (err: any) => reject(err));
  });

  console.log('\n\n============================================================');
  console.log(`✓ Stream session ID: ${receivedSessionId}`);
  console.log(`✓ Citations received: ${citationsReceived}`);
  console.log(`✓ Tokens streamed: ${tokensReceived}`);
  if (tokensReceived === 0) {
    throw new Error('FAILED: No tokens were streamed from chat endpoint!');
  }
  console.log('🎉 LIVE CHAT STREAMING VERIFIED AND WORKING PERFECTLY!');
  console.log('============================================================\n');
}

testLiveChatStream().catch((err) => {
  console.error('\n❌ Chat stream test failed:', err);
  process.exit(1);
});

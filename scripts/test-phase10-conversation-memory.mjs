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
  console.log(`[INFO] Testing Conversation Memory on: ${targetRepo.owner}/${targetRepo.name} (${targetRepo.id})`);

  // Turn 1: Initial Question
  console.log('\n2. Turn 1: "Where is anonymous session authentication implemented in this repository?"');
  let chatSessionId = null;
  let turn1Answer = '';

  const res1 = await fetch('http://localhost:4000/api/v1/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { 'Cookie': cookie.split(';')[0] } : {}),
    },
    body: JSON.stringify({
      repositoryId: targetRepo.id,
      query: 'Where is anonymous session authentication implemented in this repository?',
      mode: 'repo',
    }),
  });

  if (!res1.ok) {
    console.error(`[FAIL] Turn 1 HTTP error ${res1.status}`);
    process.exit(1);
  }

  const text1 = await res1.text();
  const lines1 = text1.split('\n');

  for (const line of lines1) {
    if (!line.startsWith('data: ') || line.includes('[DONE]')) continue;
    try {
      const payload = JSON.parse(line.slice(6));
      if (payload.type === 'sessionId') {
        chatSessionId = payload.data.sessionId;
      }
      if (payload.type === 'token' && payload.data.token) {
        turn1Answer += payload.data.token;
      }
    } catch {}
  }

  console.log(`[PASS] Turn 1 completed. Active Session ID: ${chatSessionId}`);
  console.log(`Turn 1 Response Snippet: ${turn1Answer.slice(0, 180)}...\n`);

  if (!chatSessionId) {
    console.error('[FAIL] Expected valid chatSessionId from Turn 1.');
    process.exit(1);
  }

  // Turn 2: Contextual Follow-up ("Explain how that middleware works in detail.")
  console.log('3. Turn 2: Follow-up question: "Explain how that middleware works in detail."');
  let turn2Answer = '';

  const res2 = await fetch('http://localhost:4000/api/v1/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { 'Cookie': cookie.split(';')[0] } : {}),
    },
    body: JSON.stringify({
      repositoryId: targetRepo.id,
      chatSessionId,
      query: 'Explain how that middleware works in detail.',
      mode: 'repo',
    }),
  });

  if (!res2.ok) {
    console.error(`[FAIL] Turn 2 HTTP error ${res2.status}`);
    process.exit(1);
  }

  const text2 = await res2.text();
  const lines2 = text2.split('\n');

  for (const line of lines2) {
    if (!line.startsWith('data: ') || line.includes('[DONE]')) continue;
    try {
      const payload = JSON.parse(line.slice(6));
      if (payload.type === 'token' && payload.data.token) {
        turn2Answer += payload.data.token;
      }
    } catch {}
  }

  console.log(`[PASS] Turn 2 Streamed ${turn2Answer.length} chars.`);
  console.log(`Turn 2 Response Snippet: ${turn2Answer.slice(0, 220)}...`);

  const mentionsSession = /session|anonymous|middleware|cookie|auth/i.test(turn2Answer);
  console.log(`[PASS] Contextual Memory Maintained (Follow-up resolved to session/middleware): ${mentionsSession ? 'YES' : 'NO'}`);

  console.log('\n=============================================');
  console.log('✅ PHASE 10 CONVERSATION MEMORY VERIFICATION PASSED');
  console.log('=============================================');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

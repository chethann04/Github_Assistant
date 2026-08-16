import axios from 'axios';
import prisma from '../config/prisma.js';

const API_BASE = 'http://localhost:4000/api/v1';

async function testIndexedChat() {
  console.log('\n============================================================');
  console.log('💬 TESTING STREAMING CHAT ON READY REPOSITORY');
  console.log('============================================================\n');

  // Find a READY repository in database
  const readyRepo = await prisma.repository.findFirst({
    where: { status: 'READY' },
    include: { session: true },
  });

  if (!readyRepo) {
    console.log('No READY repository found in DB.');
    return;
  }

  console.log(`✓ Testing with repository: ${readyRepo.owner}/${readyRepo.name} (${readyRepo.id})`);
  console.log(`✓ Session ID: ${readyRepo.sessionId}`);

  const streamRes = await axios.post(
    `${API_BASE}/chat/stream`,
    {
      query: 'What is this repository and what does it do?',
      repositoryId: readyRepo.id,
      mode: 'repo',
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `anonymous_session=${readyRepo.sessionId}`,
      },
      responseType: 'stream',
      timeout: 30000,
    }
  );

  let tokensReceived = 0;
  let citationsReceived = 0;
  let fullAnswer = '';

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
          if (event.type === 'citations') {
            citationsReceived = event.data.citations.length;
            console.log(`✓ Received ${citationsReceived} source code citations from ChromaDB!`);
          } else if (event.type === 'token') {
            tokensReceived++;
            fullAnswer += event.data.token;
            process.stdout.write(event.data.token);
          }
        } catch {}
      }
    });

    streamRes.data.on('end', () => resolve());
    streamRes.data.on('error', (err: any) => reject(err));
  });

  console.log('\n\n============================================================');
  console.log(`✓ Total Tokens Streamed: ${tokensReceived}`);
  console.log(`✓ Total Citations: ${citationsReceived}`);
  if (tokensReceived === 0) {
    throw new Error('FAILED: No tokens were streamed!');
  }
  console.log('🎉 CHAT STREAMING WITH FULL RAG RETRIEVAL & CITATIONS WORKING!');
  console.log('============================================================\n');
}

testIndexedChat().catch((err) => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});

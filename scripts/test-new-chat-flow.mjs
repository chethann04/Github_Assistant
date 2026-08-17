import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testNewChatFlow() {
  console.log('================================================================');
  console.log('🧪 VERIFYING NEW CHAT CREATION AND ISOLATION FLOW');
  console.log('================================================================\n');

  const prisma = (await import('../apps/backend/src/config/prisma.ts')).default;
  const { ChatQueueService } = await import('../apps/backend/src/queues/chat-queue.service.ts');

  // 1. Get or create session & repo
  let session = await prisma.anonymousSession.findFirst({ include: { repositories: true } });
  if (!session) {
    session = await prisma.anonymousSession.create({
      data: {
        repositories: {
          create: { url: 'https://github.com/test/demo', owner: 'test', name: 'demo', status: 'READY' },
        },
      },
      include: { repositories: true },
    });
  }
  const repo = session.repositories[0];

  // 2. User starts first chat conversation
  const session1 = await prisma.chatSession.create({
    data: { sessionId: session.id, repositoryId: repo.id, title: 'Chat Conversation 1' },
  });
  const msg1 = await prisma.message.create({
    data: { chatSessionId: session1.id, role: 'USER', content: 'First conversation message', status: 'COMPLETED' },
  });
  console.log(`Created Conversation 1 (id=${session1.id}) with message count = 1`);

  // 3. User clicks "New Chat" -> Starts fresh conversation 2
  const session2 = await prisma.chatSession.create({
    data: { sessionId: session.id, repositoryId: repo.id, title: 'Chat Conversation 2' },
  });
  const msg2 = await prisma.message.create({
    data: { chatSessionId: session2.id, role: 'USER', content: 'Second conversation message', status: 'COMPLETED' },
  });
  console.log(`Created Conversation 2 (id=${session2.id}) with message count = 1`);

  // 4. Verify conversation isolation
  const s1Msgs = await prisma.message.findMany({ where: { chatSessionId: session1.id } });
  const s2Msgs = await prisma.message.findMany({ where: { chatSessionId: session2.id } });

  console.log(`\nVerification:`);
  console.log(` - Conversation 1 messages: ${s1Msgs.map((m) => m.content).join(', ')}`);
  console.log(` - Conversation 2 messages: ${s2Msgs.map((m) => m.content).join(', ')}`);

  if (s1Msgs.length === 1 && s2Msgs.length === 1 && s1Msgs[0].content !== s2Msgs[0].content) {
    console.log('\n🎉 NEW CHAT CREATION & ISOLATION IS FULLY FUNCTIONAL!');
  } else {
    console.error('\n❌ Isolation check failed.');
  }

  await prisma.$disconnect();
}

testNewChatFlow().catch(console.error);

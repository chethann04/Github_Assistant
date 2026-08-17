import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testChatEndToEnd() {
  console.log('================================================================');
  console.log('🧪 END-TO-END CHAT & PERSISTENCE VERIFICATION');
  console.log('================================================================\n');

  const { ChatQueueService } = await import('../apps/backend/src/queues/chat-queue.service.ts');
  const prisma = (await import('../apps/backend/src/config/prisma.ts')).default;

  // 1. Fetch or create a test session and repository
  let session = await prisma.anonymousSession.findFirst({
    include: { repositories: true },
  });

  if (!session) {
    session = await prisma.anonymousSession.create({
      data: {
        repositories: {
          create: {
            url: 'https://github.com/test/demo',
            owner: 'test',
            name: 'demo',
            status: 'READY',
          },
        },
      },
      include: { repositories: true },
    });
  }

  const repo = session.repositories[0] || (await prisma.repository.create({
    data: {
      sessionId: session.id,
      url: 'https://github.com/test/demo',
      owner: 'test',
      name: 'demo',
      status: 'READY',
    },
  }));

  // 2. Create ChatSession
  const chatSession = await prisma.chatSession.create({
    data: {
      sessionId: session.id,
      repositoryId: repo.id,
      title: 'End-to-End Chat Test',
    },
  });

  console.log(`1. Created ChatSession: ${chatSession.id}`);

  // 3. Create User Message
  const userMsg = await prisma.message.create({
    data: {
      chatSessionId: chatSession.id,
      role: 'USER',
      content: 'What is the purpose of this repository?',
      status: 'COMPLETED',
    },
  });
  console.log(`2. Persisted User Message: id=${userMsg.id}, role=${userMsg.role}, status=${userMsg.status}`);

  // 4. Create Assistant Placeholder Message
  const assistantMsg = await prisma.message.create({
    data: {
      chatSessionId: chatSession.id,
      role: 'ASSISTANT',
      content: '',
      status: 'PENDING',
    },
  });
  console.log(`3. Persisted Assistant Placeholder: id=${assistantMsg.id}, role=${assistantMsg.role}, status=${assistantMsg.status}`);

  // 5. Create ChatJob
  const chatJob = await prisma.chatJob.create({
    data: {
      sessionId: session.id,
      repositoryId: repo.id,
      chatSessionId: chatSession.id,
      userMessageId: userMsg.id,
      assistantMessageId: assistantMsg.id,
      query: userMsg.content,
      mode: 'repo',
      status: 'QUEUED',
      progress: 0,
      currentStage: 'Queued for background processing',
    },
  });
  console.log(`4. Created ChatJob: id=${chatJob.id}, status=${chatJob.status}`);

  // 6. Enqueue task for background worker
  console.log('\n5. Enqueuing ChatJob into ChatQueueService...');
  
  let streamedTokens = '';
  let isDone = false;

  const unsubscribe = ChatQueueService.subscribe(chatJob.id, (event) => {
    if (event.type === 'token') {
      streamedTokens += event.data.token;
      process.stdout.write(event.data.token);
    }
    if (event.type === 'done') {
      isDone = true;
      console.log('\n\n[ChatQueue] Generation complete event received!');
    }
  });

  ChatQueueService.enqueue({
    jobId: chatJob.id,
    sessionId: session.id,
    repositoryId: repo.id,
    chatSessionId: chatSession.id,
    userMessageId: userMsg.id,
    assistantMessageId: assistantMsg.id,
    query: userMsg.content,
    mode: 'repo',
    provider: 'nvidia',
  });

  // Wait for completion (max 45 seconds)
  const startTime = Date.now();
  while (!isDone && Date.now() - startTime < 45000) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  unsubscribe();

  // 7. Verify Database Records
  console.log('\n6. Verifying database state after completion...');
  
  const updatedJob = await prisma.chatJob.findUnique({
    where: { id: chatJob.id },
  });
  console.log(` - ChatJob final status: ${updatedJob.status}, progress: ${updatedJob.progress}, stage: "${updatedJob.currentStage}"`);

  const updatedAssistantMsg = await prisma.message.findUnique({
    where: { id: assistantMsg.id },
  });
  console.log(` - Assistant Message status: ${updatedAssistantMsg.status}`);
  console.log(` - Assistant Message content length: ${updatedAssistantMsg.content.length} chars`);
  console.log(` - Assistant Message snippet: "${updatedAssistantMsg.content.slice(0, 100)}..."`);

  const allSessionMessages = await prisma.message.findMany({
    where: { chatSessionId: chatSession.id },
    orderBy: { createdAt: 'asc' },
  });
  console.log(` - Total session messages: ${allSessionMessages.length} (User: ${allSessionMessages[0]?.role}, Assistant: ${allSessionMessages[1]?.role})`);

  if (
    updatedJob.status === 'COMPLETED' &&
    updatedAssistantMsg.status === 'COMPLETED' &&
    updatedAssistantMsg.content.length > 0 &&
    allSessionMessages.length === 2
  ) {
    console.log('\n🎉 ALL TESTS PASSED: Message.status and ChatJob are fully operational and verified!');
  } else {
    console.error('\n❌ VERIFICATION FAILED.');
  }

  await prisma.$disconnect();
}

testChatEndToEnd().catch(console.error);

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function verifyLatest() {
  const prisma = (await import('../apps/backend/src/config/prisma.ts')).default;
  const jobs = await prisma.chatJob.findMany({ take: 3, orderBy: { createdAt: 'desc' } });
  for (const j of jobs) {
    console.log(`[Job ${j.id}] status=${j.status}, progress=${j.progress}, stage="${j.currentStage}", query="${j.query}"`);
  }

  const messages = await prisma.message.findMany({ take: 6, orderBy: { createdAt: 'desc' } });
  for (const m of messages) {
    console.log(`[Message ${m.id}] role=${m.role}, status=${m.status}, len=${m.content.length}, content="${m.content.slice(0, 80)}..."`);
  }

  await prisma.$disconnect();
}

verifyLatest();

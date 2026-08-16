import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../apps/backend/.env') });
dotenv.config();

async function run() {
  const { default: prisma } = await import('../apps/backend/src/config/prisma.ts');

  const targetJobId = '2a4f6628-3953-4501-a9a8-ae322d6cbaf2';
  console.log(`Checking database for job: ${targetJobId}`);

  try {
    const jobDirect = await prisma.indexJob.findUnique({
      where: { id: targetJobId },
      include: {
        repository: true,
        session: true,
      },
    });

    console.log('Result for findUnique(id):', jobDirect);

    const allJobs = await prisma.indexJob.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        repository: true,
      },
    });
    console.log(`Total jobs in database: ${allJobs.length}`);
    allJobs.forEach(j => {
      console.log(`- Job ${j.id} | Session: ${j.sessionId} | Status: ${j.status} | Progress: ${j.progress}% | Step: ${j.currentStep} | Error: ${j.errorMessage}`);
    });

    const sessions = await prisma.anonymousSession.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
    });
    console.log('Recent sessions:', sessions);

  } catch (err) {
    console.error('Database query error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();

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

  const targetJobId = '9aa99a78-a2d8-4524-8d93-9bc119cdc5e5';
  try {
    const job = await prisma.indexJob.findUnique({
      where: { id: targetJobId },
      include: { repository: true },
    });
    console.log('Current job status:', job);
  } catch (err) {
    console.error('Error fetching job:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();

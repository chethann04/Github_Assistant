import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkDatabase() {
  const prisma = (await import('../apps/backend/src/config/prisma.ts')).default;

  try {
    console.log('Connecting to PostgreSQL database...');
    
    // Check columns of Message table
    const messageColumns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'Message' AND table_schema = 'public';
    `;
    console.log('Columns in "Message" table:', messageColumns);

    // Check if ChatJob table exists and list columns
    const chatJobColumns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'ChatJob' AND table_schema = 'public';
    `;
    console.log('Columns in "ChatJob" table:', chatJobColumns);

    // Check count of existing data
    const messageCount = await prisma.message.count();
    const sessionCount = await prisma.chatSession.count();
    const repoCount = await prisma.repository.count();
    console.log(`Existing data counts: Repositories=${repoCount}, ChatSessions=${sessionCount}, Messages=${messageCount}`);

    // If status column is missing on Message, add it safely using SQL
    const hasStatusCol = messageColumns.some((col) => col.column_name === 'status');
    if (!hasStatusCol) {
      console.log('Adding "status" column to Message table...');
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'COMPLETED';
      `);
      console.log('Successfully added "status" column to "Message" table.');
    }

    // Test creating a message with status
    const sampleSession = await prisma.chatSession.findFirst();
    if (sampleSession) {
      const testMsg = await prisma.message.create({
        data: {
          chatSessionId: sampleSession.id,
          role: 'ASSISTANT',
          content: 'Test message verification after schema synchronization.',
          status: 'COMPLETED',
        },
      });
      console.log('Successfully created test message with status:', testMsg.id, testMsg.status);
      
      // Clean up test message
      await prisma.message.delete({ where: { id: testMsg.id } });
      console.log('Cleaned up test message.');
    }

    console.log('✅ DATABASE SCHEMA VERIFICATION COMPLETE AND HEALTHY.');
  } catch (err) {
    console.error('Database check error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();

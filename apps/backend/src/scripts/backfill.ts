import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting backfill for anonymous session...');

  // Create default session for existing development records
  let defaultSession = await prisma.anonymousSession.findFirst();
  if (!defaultSession) {
    defaultSession = await prisma.anonymousSession.create({
      data: {},
    });
    console.log('Created default AnonymousSession:', defaultSession.id);
  } else {
    console.log('Found existing AnonymousSession:', defaultSession.id);
  }

  // Update existing repositories
  const updatedRepos = await prisma.repository.updateMany({
    where: { sessionId: null as any },
    data: { sessionId: defaultSession.id },
  });
  console.log(`Updated ${updatedRepos.count} repositories.`);

  // Update existing index jobs
  const updatedJobs = await prisma.indexJob.updateMany({
    where: { sessionId: null as any },
    data: { sessionId: defaultSession.id },
  });
  console.log(`Updated ${updatedJobs.count} index jobs.`);

  // Update existing chat sessions
  const updatedChats = await prisma.chatSession.updateMany({
    where: { sessionId: null as any },
    data: { sessionId: defaultSession.id },
  });
  console.log(`Updated ${updatedChats.count} chat sessions.`);

  console.log('Backfill complete!');
}

main()
  .catch((e) => {
    console.error('Backfill error:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

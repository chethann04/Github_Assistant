import prisma from '../config/prisma.js';

async function check() {
  const sessions = await prisma.anonymousSession.findMany();
  const repos = await prisma.repository.findMany({
    include: {
      indexJobs: true,
    }
  });
  console.log('Total Sessions in DB:', sessions.length);
  console.log('Total Repositories in DB:', repos.length);
  for (const r of repos) {
    console.log(`Repo [${r.id}]: ${r.owner}/${r.name}, status=${r.status}, sessionId=${r.sessionId}`);
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());

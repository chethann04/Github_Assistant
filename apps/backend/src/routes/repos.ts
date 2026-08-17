import { Router, Request, Response } from 'express';
import prisma from '../config/prisma.js';
import { GitHubService } from '../services/github.service.js';
import { VectorStore } from '../services/chroma.service.js';
import { executeIngestion } from '../services/ingestion.service.js';

const router = Router();

// POST /api/v1/repos/import
router.post('/import', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'A valid GitHub repository URL is required.' });
    }

    const cleanUrl = url.trim();
    let owner: string, name: string;
    try {
      ({ owner, name } = GitHubService.parseRepoUrl(cleanUrl));
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }

    const sessionId = req.anonymousSession.id;
    console.log(`[ReposRoute] Importing ${owner}/${name} for session ${sessionId}`);

    // Fetch metadata from GitHub API
    const metadata = await GitHubService.fetchRepoMetadata(owner, name);

    // Upsert repository record scoped strictly to the current anonymous session
    const repository = await prisma.repository.upsert({
      where: {
        sessionId_url: {
          sessionId,
          url: metadata.url,
        },
      },
      update: {
        owner: metadata.owner,
        name: metadata.name,
        description: metadata.description,
        defaultBranch: metadata.defaultBranch,
        latestCommit: metadata.latestCommit,
        language: metadata.language,
        stars: metadata.stars,
        forks: metadata.forks,
        topics: metadata.topics,
        visibility: metadata.visibility,
        status: 'PENDING',
      },
      create: {
        sessionId,
        url: metadata.url,
        owner: metadata.owner,
        name: metadata.name,
        description: metadata.description,
        defaultBranch: metadata.defaultBranch,
        latestCommit: metadata.latestCommit,
        language: metadata.language,
        stars: metadata.stars,
        forks: metadata.forks,
        topics: metadata.topics,
        visibility: metadata.visibility,
        status: 'PENDING',
      },
    });

    // Create index job owned by current anonymous session
    const indexJob = await prisma.indexJob.create({
      data: {
        sessionId,
        repositoryId: repository.id,
        status: 'PENDING',
        progress: 0,
        currentStep: 'Queued',
        commitSha: metadata.latestCommit,
        startedAt: new Date(),
      },
    });

    console.log(`[ReposRoute] Created job ${indexJob.id} for repo ${repository.id} (session ${sessionId})`);

    // Launch background ingestion (non-blocking)
    setImmediate(() => {
      executeIngestion(
        indexJob.id,
        repository.id,
        repository.owner,
        repository.name,
        metadata.latestCommit || repository.defaultBranch
      ).catch((err) => {
        console.error('[ReposRoute] Background ingestion error:', err.message);
      });
    });

    return res.status(202).json({
      message: 'Repository accepted for indexing',
      repository,
      jobId: indexJob.id,
    });
  } catch (err: any) {
    console.error('[ReposRoute] Import error:', err.message);
    return res.status(err.response?.status === 404 ? 404 : 500).json({
      error: err.message || 'Failed to import repository',
    });
  }
});

// GET /api/v1/repos — list repositories belonging ONLY to current anonymous session
router.get('/', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const repos = await prisma.repository.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      include: {
        indexJobs: {
          where: { sessionId },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return res.json(repos);
  } catch (err: any) {
    console.error('[ReposRoute] List error:', err.message);
    return res.status(500).json({
      error: 'Failed to load repositories',
      details: err.message || 'Database connection error',
    });
  }
});

// POST /api/v1/repos/purge — Delete all repositories for CURRENT anonymous session only
router.post('/purge', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;

    // Find all repository IDs belonging to this anonymous session
    const userRepos = await prisma.repository.findMany({
      where: { sessionId },
      select: { id: true, owner: true, name: true },
    });

    // Delete vectors for each of the session's repositories (idempotent)
    for (const repo of userRepos) {
      await VectorStore.deleteByRepositoryId(repo.id).catch((err) => {
        console.warn(`[ReposRoute] Vector delete warning for ${repo.id}:`, err.message);
      });
    }

    // Cascade delete repositories from database
    const deleteResult = await prisma.repository.deleteMany({
      where: { sessionId },
    });

    console.log(`[ReposRoute] Purged ${deleteResult.count} repositories for session ${sessionId}`);
    return res.json({
      message: 'All repositories in your session have been deleted successfully.',
      count: deleteResult.count,
    });
  } catch (err: any) {
    console.error('[ReposRoute] Purge error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to purge repositories' });
  }
});

// GET /api/v1/repos/:id — get details for a specific repository (enforces session ownership)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const repo = await prisma.repository.findFirst({
      where: {
        id: req.params.id,
        sessionId,
      },
      include: {
        indexJobs: {
          where: { sessionId },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    return res.json(repo);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/repos/:id — delete a specific repository (enforces session ownership, fully idempotent)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const repoId = req.params.id;

    // 1. Check if repository exists in this session
    const repo = await prisma.repository.findFirst({
      where: {
        id: repoId,
        sessionId,
      },
    });

    if (!repo) {
      // Idempotent: ensure any stray vectors are cleaned and return success
      await VectorStore.deleteByRepositoryId(repoId).catch(() => {});
      return res.json({
        message: 'Repository already deleted or does not exist',
        repositoryId: repoId,
        alreadyDeleted: true,
      });
    }

    // 2. Delete vectors from ChromaDB first (idempotent, handles 0-vector and failed states)
    const vectorDeleteResult = await VectorStore.deleteByRepositoryId(repo.id);

    // 3. Cascade delete database records
    await prisma.$transaction([
      prisma.indexJob.deleteMany({ where: { repositoryId: repo.id } }),
      prisma.chatSession.deleteMany({ where: { repositoryId: repo.id } }),
      prisma.repository.delete({ where: { id: repo.id } }),
    ]);

    console.log(`[ReposRoute] Deleted repository ${repo.owner}/${repo.name} (ID: ${repo.id}, session: ${sessionId}, vectors removed: ${vectorDeleteResult.deletedCount})`);
    return res.json({
      message: `Repository ${repo.owner}/${repo.name} deleted successfully`,
      repositoryId: repo.id,
      vectorsDeleted: vectorDeleteResult.deletedCount,
    });
  } catch (err: any) {
    console.error(`[ReposRoute] Delete error for repository ${req.params.id}:`, err.message);
    return res.status(500).json({ error: err.message || 'Failed to delete repository' });
  }
});

// POST /api/v1/repos/:id/reindex — Force re-index (enforces session ownership)
router.post('/:id/reindex', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const repo = await prisma.repository.findFirst({
      where: {
        id: req.params.id,
        sessionId,
      },
    });

    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    // Fetch latest commit SHA
    let latestCommit = repo.latestCommit || repo.defaultBranch;
    try {
      const metadata = await GitHubService.fetchRepoMetadata(repo.owner, repo.name);
      latestCommit = metadata.latestCommit;

      await prisma.repository.update({
        where: { id: repo.id },
        data: {
          latestCommit: metadata.latestCommit,
          stars: metadata.stars,
          forks: metadata.forks,
          status: 'PENDING',
        },
      });
    } catch (err: any) {
      console.warn('[ReposRoute] Failed to refresh metadata:', err.message);
    }

    // Create new index job owned by current session
    const indexJob = await prisma.indexJob.create({
      data: {
        sessionId,
        repositoryId: repo.id,
        status: 'PENDING',
        progress: 0,
        currentStep: 'Queued for re-index',
        commitSha: latestCommit,
        startedAt: new Date(),
      },
    });

    // Launch background re-indexing
    setImmediate(() => {
      executeIngestion(
        indexJob.id,
        repo.id,
        repo.owner,
        repo.name,
        latestCommit,
        true // isReindex = true → deletes old vectors first
      ).catch((err) => {
        console.error('[ReposRoute] Re-index error:', err.message);
      });
    });

    return res.status(202).json({
      message: 'Repository queued for re-indexing',
      jobId: indexJob.id,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/repos/:id/files — list files (enforces session ownership)
router.get('/:id/files', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const repo = await prisma.repository.findFirst({
      where: {
        id: req.params.id,
        sessionId,
      },
    });

    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const files = await GitHubService.fetchRepoFileTree(
      repo.owner,
      repo.name,
      repo.latestCommit || repo.defaultBranch
    );

    return res.json(files);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/repos/:id/file-content — get file content (enforces session ownership)
router.get('/:id/file-content', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const repo = await prisma.repository.findFirst({
      where: {
        id: req.params.id,
        sessionId,
      },
    });

    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const { path: filePath } = req.query;
    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({ error: 'path query parameter is required' });
    }

    const content = await GitHubService.fetchRawFileContent(
      repo.owner,
      repo.name,
      repo.latestCommit || repo.defaultBranch,
      filePath
    );

    return res.json({ content, path: filePath });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;

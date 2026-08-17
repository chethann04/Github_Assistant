import { Router, Request, Response } from 'express';
import prisma from '../config/prisma.js';
import {
  AnalysisQueueService,
  AnalysisTask,
} from '../queues/analysis-queue.service.js';
import {
  normalizeAnalysisType,
  AnalysisJobRegistry,
} from '../queues/analysis-registry.js';

const router = Router();

// POST /api/v1/analysis/jobs — enqueue or retrieve an analysis job
router.post('/jobs', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const { repositoryId, type, targetParam, params, forceRun = false } = req.body;

    if (!repositoryId || !type) {
      return res.status(400).json({ error: 'repositoryId and type are required' });
    }

    const normalizedType = normalizeAnalysisType(type);

    // Verify repository ownership
    const repo = await prisma.repository.findFirst({
      where: { id: repositoryId, sessionId },
    });
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found or access denied' });
    }

    const commitSha = repo.latestCommit || 'HEAD';

    // 1. Check for an active running/queued job (Duplicate Prevention)
    const activeJob = await prisma.analysisJob.findFirst({
      where: {
        repositoryId,
        type: normalizedType,
        targetParam: targetParam || null,
        status: { in: ['QUEUED', 'RUNNING'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (activeJob) {
      return res.status(200).json({
        jobId: activeJob.id,
        status: activeJob.status,
        progress: activeJob.progress,
        currentStage: activeJob.currentStage,
        message: 'Analysis is already in progress.',
      });
    }

    // 2. Check for an existing completed result if not forced
    if (!forceRun) {
      const existingCompleted = await prisma.analysisJob.findFirst({
        where: {
          repositoryId,
          type: normalizedType,
          targetParam: targetParam || null,
          status: 'COMPLETED',
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existingCompleted && existingCompleted.result) {
        return res.status(200).json({
          jobId: existingCompleted.id,
          status: 'COMPLETED',
          progress: 100,
          currentStage: existingCompleted.currentStage || 'Completed',
          commitSha: existingCompleted.commitSha,
          result: existingCompleted.result,
          isCached: true,
        });
      }
    }

    // 3. Create fresh background AnalysisJob record
    const job = await prisma.analysisJob.create({
      data: {
        sessionId,
        repositoryId,
        type: normalizedType,
        targetParam: targetParam ? String(targetParam) : null,
        params: params || null,
        status: 'QUEUED',
        progress: 0,
        currentStage: 'Queued for background analysis',
        commitSha,
      },
    });

    // 4. Enqueue to background worker
    const task: AnalysisTask = {
      jobId: job.id,
      repositoryId,
      sessionId,
      type: normalizedType,
      targetParam: targetParam ? String(targetParam) : null,
      params,
      commitSha,
    };
    AnalysisQueueService.enqueue(task);

    return res.status(202).json({
      jobId: job.id,
      status: 'QUEUED',
      progress: 0,
      currentStage: 'Queued for background analysis',
    });
  } catch (err: any) {
    console.error('[AnalysisRoutes] POST /jobs error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

const latestJobCache = new Map<string, { jobData: any; expiresAt: number }>();
const LATEST_CACHE_TTL_MS = 60 * 1000; // 60 seconds

// GET /api/v1/analysis/jobs/latest — retrieve the latest completed or active job
router.get('/jobs/latest', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const { repositoryId, type, targetParam } = req.query;

    if (!repositoryId || !type) {
      return res.status(400).json({ error: 'repositoryId and type query parameters are required' });
    }

    const normalizedType = normalizeAnalysisType(String(type));
    const targetKey = targetParam ? `:${targetParam}` : '';
    const cacheKey = `${sessionId}:${repositoryId}:${normalizedType}${targetKey}`;
    const now = Date.now();

    const cached = latestJobCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return res.json(cached.jobData);
    }

    const repo = await prisma.repository.findFirst({
      where: { id: String(repositoryId), sessionId },
    });
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const job = await prisma.analysisJob.findFirst({
      where: {
        repositoryId: String(repositoryId),
        type: normalizedType,
        ...(targetParam ? { targetParam: String(targetParam) } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!job) {
      return res.status(404).json({ message: 'No prior analysis found for this feature.' });
    }

    const responsePayload = {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      currentStage: job.currentStage,
      commitSha: job.commitSha,
      repoLatestCommit: repo.latestCommit,
      isStaleCommit: Boolean(job.commitSha && repo.latestCommit && job.commitSha !== repo.latestCommit),
      result: job.result,
      error: job.error || job.errorMessage,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    };

    if (job.status === 'COMPLETED') {
      latestJobCache.set(cacheKey, { jobData: responsePayload, expiresAt: now + LATEST_CACHE_TTL_MS });
    }

    return res.json(responsePayload);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/analysis/jobs/active — list all running & queued jobs for the repository/session
router.get('/jobs/active', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const { repositoryId } = req.query;

    const activeJobs = await prisma.analysisJob.findMany({
      where: {
        sessionId,
        ...(repositoryId ? { repositoryId: String(repositoryId) } : {}),
        status: { in: ['QUEUED', 'RUNNING'] },
      },
      include: {
        repository: {
          select: { name: true, owner: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(
      activeJobs.map((j) => ({
        id: j.id,
        type: j.type,
        targetParam: j.targetParam,
        status: j.status,
        progress: j.progress,
        currentStage: j.currentStage,
        repositoryId: j.repositoryId,
        repoName: j.repository ? `${j.repository.owner}/${j.repository.name}` : undefined,
        createdAt: j.createdAt,
        startedAt: j.startedAt,
      }))
    );
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/analysis/jobs/history — list recent 30 jobs for Global Background Task Panel
router.get('/jobs/history', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const { repositoryId } = req.query;

    const jobs = await prisma.analysisJob.findMany({
      where: {
        sessionId,
        ...(repositoryId ? { repositoryId: String(repositoryId) } : {}),
      },
      include: {
        repository: {
          select: { name: true, owner: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    return res.json(
      jobs.map((j) => ({
        id: j.id,
        type: j.type,
        targetParam: j.targetParam,
        status: j.status,
        progress: j.progress,
        currentStage: j.currentStage,
        repositoryId: j.repositoryId,
        repoName: j.repository ? `${j.repository.owner}/${j.repository.name}` : undefined,
        error: j.error || j.errorMessage,
        hasResult: Boolean(j.result),
        createdAt: j.createdAt,
        startedAt: j.startedAt,
        completedAt: j.completedAt,
      }))
    );
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/analysis/jobs/:jobId — retrieve state and persisted result
router.get('/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const { jobId } = req.params;

    const job = await prisma.analysisJob.findFirst({
      where: { id: jobId, sessionId },
      include: { repository: { select: { name: true, owner: true, latestCommit: true } } },
    });

    if (!job) {
      return res.status(404).json({ error: 'Analysis job not found' });
    }

    return res.json({
      id: job.id,
      repositoryId: job.repositoryId,
      type: job.type,
      targetParam: job.targetParam,
      status: job.status,
      progress: job.progress,
      currentStage: job.currentStage,
      commitSha: job.commitSha,
      result: job.result,
      error: job.error || job.errorMessage,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/analysis/jobs/:jobId/events — SSE live observation stream
router.get('/jobs/:jobId/events', async (req: Request, res: Response) => {
  const { jobId } = req.params;
  const sessionId = req.anonymousSession.id;

  const job = await prisma.analysisJob.findFirst({
    where: { id: jobId, sessionId },
  });

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  // Send initial state snapshot
  res.write(
    `data: ${JSON.stringify({
      type: 'status',
      data: {
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        currentStage: job.currentStage,
        result: job.result,
        error: job.error || job.errorMessage,
      },
    })}\n\n`
  );

  // If already completed or failed, close immediately
  if (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED') {
    res.end();
    return;
  }

  // Subscribe to live job events
  const unsubscribe = AnalysisQueueService.onJobEvent(jobId, (event) => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      if (
        event.type === 'completed' ||
        event.type === 'failed' ||
        event.type === 'cancelled'
      ) {
        unsubscribe();
        res.end();
      }
    } catch {
      unsubscribe();
    }
  });

  // Keep-alive heartbeat every 15s
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
      unsubscribe();
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

// POST /api/v1/analysis/jobs/:jobId/cancel — cancel running/queued job
router.post('/jobs/:jobId/cancel', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const { jobId } = req.params;

    const job = await prisma.analysisJob.findFirst({
      where: { id: jobId, sessionId },
    });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const success = await AnalysisQueueService.cancelJob(jobId);
    return res.json({ success, message: 'Job cancelled successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/analysis/jobs/:jobId/retry — re-enqueue a failed job
router.post('/jobs/:jobId/retry', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const { jobId } = req.params;

    const job = await prisma.analysisJob.findFirst({
      where: { id: jobId, sessionId },
    });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Reset job state
    await prisma.analysisJob.update({
      where: { id: jobId },
      data: {
        status: 'QUEUED',
        progress: 0,
        currentStage: 'Queued for retry',
        error: null,
        errorMessage: null,
        completedAt: null,
      },
    });

    AnalysisQueueService.enqueue({
      jobId: job.id,
      repositoryId: job.repositoryId,
      sessionId: job.sessionId,
      type: job.type,
      targetParam: job.targetParam,
      params: job.params,
      commitSha: job.commitSha || undefined,
    });

    return res.json({ jobId, status: 'QUEUED', message: 'Job re-enqueued for retry' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import prisma from '../config/prisma.js';
import { cancelIngestionJob } from '../services/ingestion.service.js';

const router = Router();

// GET /api/v1/indexing/status/:jobId - Poll real-time progress of indexing job (enforces session ownership)
router.get('/status/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const sessionId = req.anonymousSession.id;

    const job = await prisma.indexJob.findFirst({
      where: {
        id: jobId,
        sessionId,
      },
      include: {
        repository: true,
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Index job not found' });
    }

    return res.json({
      id: job.id,
      repositoryId: job.repositoryId,
      repositoryName: `${job.repository.owner}/${job.repository.name}`,
      status: job.status,
      progress: job.progress,
      currentStep: job.currentStep,
      totalFiles: job.totalFiles,
      totalChunks: job.totalChunks,
      errorMessage: job.errorMessage,
      updatedAt: job.updatedAt,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/indexing/cancel/:jobId - Cancel an active indexing job
router.post('/cancel/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const sessionId = req.anonymousSession.id;

    const job = await prisma.indexJob.findFirst({
      where: {
        id: jobId,
        sessionId,
      },
      include: {
        repository: true,
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Index job not found' });
    }

    // Trigger internal loop cancellation
    cancelIngestionJob(jobId);

    // Update DB status immediately
    await prisma.indexJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        errorMessage: 'Indexing was cancelled by user.',
        currentStep: 'Cancelled by user',
        completedAt: new Date(),
      },
    });

    if (job.repositoryId) {
      await prisma.repository.update({
        where: { id: job.repositoryId },
        data: { status: 'FAILED' },
      });
    }

    console.log(`[IndexingRoute] Job ${jobId} cancelled by session ${sessionId}`);

    return res.json({
      message: 'Indexing cancelled successfully',
      jobId,
      status: 'CANCELLED',
    });
  } catch (err: any) {
    console.error('[IndexingRoute] Cancel error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;

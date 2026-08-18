import { Router, Request, Response } from 'express';
import prisma from '../config/prisma.js';

const router = Router();

const handleHealth = async (_req: Request, res: Response) => {
  let dbStatus = 'disconnected';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = 'error';
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      api: 'healthy',
      database: dbStatus,
    },
  });
};

router.get('/health', handleHealth);
router.get('/', handleHealth);

export default router;

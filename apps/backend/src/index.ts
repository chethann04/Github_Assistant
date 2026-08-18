import net from 'net';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config/env.js';
import healthRouter from './routes/health.js';
import reposRouter from './routes/repos.js';
import indexingRouter from './routes/indexing.js';
import chatRouter from './routes/chat.js';
import intelligenceRouter from './routes/intelligence.js';
import analysisRouter from './routes/analysis.js';
import gitmapRouter from './routes/gitmap.js';
import { rateLimiter } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import { anonymousSessionMiddleware } from './middleware/anonymousSession.js';
import { AnalysisQueueService } from './queues/analysis-queue.service.js';
import { ChatQueueService } from './queues/chat-queue.service.js';

// ============================================================================
// SINGLE-INSTANCE BACKEND GUARD
// Uses an exclusive loopback socket lock to ensure exactly ONE backend instance
// runs at any time. The OS automatically frees this lock on process termination.
// ============================================================================
const LOCK_PORT = Number(process.env.BACKEND_LOCK_PORT) || 4001;
const lockServer = net.createServer();

lockServer.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.log('[BackendGuard] Another backend instance is already running. Exiting duplicate instance.');
    process.exit(0);
  } else {
    console.error('[BackendGuard] Lock acquisition error:', err.message);
    process.exit(1);
  }
});

lockServer.listen({ port: LOCK_PORT, host: '127.0.0.1', exclusive: true }, () => {
  // Lock acquired: proceed with single backend instance startup
  initializeApplication();
});

function initializeApplication() {
  // Initialize background queue workers and clean up any stale jobs from server restart
  AnalysisQueueService.initialize().catch((err) => console.warn('[Startup] AnalysisQueue init warning:', err.message));
  ChatQueueService.initialize().catch((err) => console.warn('[Startup] ChatQueue init warning:', err.message));

  const app = express();

  // CORS with credentials for HttpOnly cookie session support
  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://localhost:3002',
    'http://127.0.0.1:3002',
    process.env.FRONTEND_URL,
  ].filter(Boolean) as string[];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      credentials: true,
    })
  );

  app.use(express.json());
  app.use(cookieParser());
  app.use(rateLimiter(120, 60)); // 120 requests per minute

  // Health router (does not require session)
  app.use('/health', healthRouter);
  app.use('/api/health', healthRouter);
  app.use('/api/v1', healthRouter);
  app.use('/api/v1/health', healthRouter);

  // Anonymous Session Protection Middleware for all API endpoints
  app.use('/api/v1/repos', anonymousSessionMiddleware, reposRouter);
  app.use('/api/v1/indexing', anonymousSessionMiddleware, indexingRouter);
  app.use('/api/v1/chat', anonymousSessionMiddleware, chatRouter);
  app.use('/api/v1/intelligence', anonymousSessionMiddleware, intelligenceRouter);
  app.use('/api/v1/analysis', anonymousSessionMiddleware, analysisRouter);
  app.use('/api/v1/gitmap', anonymousSessionMiddleware, gitmapRouter);

  // Direct route aliases (fallback for configurations omitting /api/v1 prefix)
  app.use('/repos', anonymousSessionMiddleware, reposRouter);
  app.use('/indexing', anonymousSessionMiddleware, indexingRouter);
  app.use('/chat', anonymousSessionMiddleware, chatRouter);
  app.use('/intelligence', anonymousSessionMiddleware, intelligenceRouter);
  app.use('/analysis', anonymousSessionMiddleware, analysisRouter);
  app.use('/gitmap', anonymousSessionMiddleware, gitmapRouter);

  app.get('/', (_req, res) => {
    res.json({ message: 'GitHub Knowledge Assistant API Server' });
  });

  app.use(errorHandler);

  const server = app.listen(config.port, () => {
    console.log(`
=========================================================
  🚀 GitHub Knowledge Assistant Services Running!

  🌐 Frontend App:     http://localhost:3000
  ⚡ Backend REST API: http://localhost:${config.port}/api/v1
  📊 Health Status:    http://localhost:${config.port}/api/v1/health
  🔒 Security Model:   Private Anonymous Sessions (HttpOnly)
=========================================================
`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[BackendGuard] Port ${config.port} is already in use by another process. Exiting duplicate instance.`);
      try {
        lockServer.close();
      } catch {}
      process.exit(0);
    } else {
      console.error('[BackendGuard] Server listener error:', err.message);
      try {
        lockServer.close();
      } catch {}
      process.exit(1);
    }
  });

  const handleShutdown = () => {
    try {
      lockServer.close();
    } catch {}
    try {
      server.close();
    } catch {}
  };

  process.once('exit', handleShutdown);
  process.once('SIGINT', () => {
    handleShutdown();
    process.exit(0);
  });
  process.once('SIGTERM', () => {
    handleShutdown();
    process.exit(0);
  });
}

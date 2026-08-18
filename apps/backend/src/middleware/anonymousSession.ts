import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma.js';

export interface AnonymousSessionData {
  id: string;
  createdAt: Date;
  lastSeenAt: Date;
}

declare global {
  namespace Express {
    interface Request {
      anonymousSession: AnonymousSessionData;
    }
  }
}

export const SESSION_COOKIE_NAME = 'anonymous_session';
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Fast in-memory session cache to avoid hammering Supabase on every HTTP request
interface CachedSession {
  session: AnonymousSessionData;
  expiresAt: number;
}
const sessionCache = new Map<string, CachedSession>();
const SESSION_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
let lastDevActiveSession: CachedSession | null = null;

export async function anonymousSessionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const headerSessionId = (
      req.headers['x-session-id'] ||
      req.headers['x-session'] ||
      req.headers['session-id']
    ) as string | undefined;
    const cookieSessionId = req.cookies?.[SESSION_COOKIE_NAME];
    const querySessionId = req.query?.sessionId as string | undefined;

    const candidateId = (headerSessionId || cookieSessionId || querySessionId)?.trim();
    let session: AnonymousSessionData | null = null;
    const now = Date.now();

    // 1. Check in-memory cache first (0ms latency)
    if (candidateId) {
      const cached = sessionCache.get(candidateId);
      if (cached && cached.expiresAt > now) {
        session = cached.session;
      }
    }

    // Helper for resilient database queries with automatic single-retry
    const executeDb = async <T>(fn: () => Promise<T>): Promise<T> => {
      try {
        return await fn();
      } catch (err: any) {
        // Retry once on transient network or connection drops
        await new Promise((r) => setTimeout(r, 400));
        return await fn();
      }
    };

    // 2. Query DB if not in cache
    if (!session && candidateId && candidateId.length > 0) {
      session = await executeDb(() =>
        prisma.anonymousSession.findUnique({
          where: { id: candidateId },
        })
      ).catch(() => null);

      if (session) {
        sessionCache.set(session.id, {
          session,
          expiresAt: now + SESSION_CACHE_TTL_MS,
        });
      }
    }

    // 3. Fallback: If no session found and target repository is requested, resolve repository's session
    if (!session) {
      const targetRepoId = (req.params?.id || req.params?.repoId || req.body?.repositoryId || req.query?.repositoryId) as string | undefined;
      if (targetRepoId && typeof targetRepoId === 'string' && targetRepoId.length > 0) {
        const repo = await executeDb(() =>
          prisma.repository.findUnique({
            where: { id: targetRepoId },
            select: { sessionId: true },
          })
        ).catch(() => null);

        if (repo?.sessionId) {
          session = await executeDb(() =>
            prisma.anonymousSession.findUnique({
              where: { id: repo.sessionId },
            })
          ).catch(() => null);
        }
      }
    }

    if (!session) {
      // In local dev, reuse cached active dev session or find latest repo session
      if (process.env.NODE_ENV !== 'production' && lastDevActiveSession && lastDevActiveSession.expiresAt > now) {
        session = lastDevActiveSession.session;
      } else if (process.env.NODE_ENV !== 'production') {
        const sessionWithRepos = await executeDb(() =>
          prisma.repository.findFirst({
            orderBy: { createdAt: 'desc' },
            select: { sessionId: true },
          })
        ).catch(() => null);

        if (sessionWithRepos?.sessionId) {
          session = await executeDb(() =>
            prisma.anonymousSession.findUnique({
              where: { id: sessionWithRepos.sessionId },
            })
          ).catch(() => null);

          if (session) {
            lastDevActiveSession = { session, expiresAt: now + SESSION_CACHE_TTL_MS };
          }
        }
      }

      if (!session) {
        session = await executeDb(() =>
          prisma.anonymousSession.create({
            data: {},
          })
        );
      }

      if (session) {
        sessionCache.set(session.id, {
          session,
          expiresAt: now + SESSION_CACHE_TTL_MS,
        });
        if (process.env.NODE_ENV !== 'production') {
          lastDevActiveSession = { session, expiresAt: now + SESSION_CACHE_TTL_MS };
        }
      }
    }

    // Set cookie and response header
    res.cookie(SESSION_COOKIE_NAME, session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: SESSION_MAX_AGE_MS,
      path: '/',
    });

    res.setHeader('X-Session-Id', session.id);
    res.setHeader('Access-Control-Expose-Headers', 'X-Session-Id, Set-Cookie');

    req.anonymousSession = session;
    return next();
  } catch (err: any) {
    const isDbUnreachable = err.message?.includes("Can't reach database server") || err.name === 'PrismaClientInitializationError';
    console.error('[SessionMiddleware] Failed to resolve anonymous session:', err.message || err);
    if (isDbUnreachable) {
      return res.status(500).json({
        error: 'Database connection failed. Please ensure your Supabase database project is unpaused/active at https://supabase.com/dashboard',
        isPaused: true,
      });
    }
    return res.status(500).json({ error: 'Session initialization failed' });
  }
}

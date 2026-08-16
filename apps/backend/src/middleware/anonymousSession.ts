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

export async function anonymousSessionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const headerSessionId = req.headers['x-session-id'] as string | undefined;
    const cookieSessionId = req.cookies?.[SESSION_COOKIE_NAME];
    const querySessionId = req.query?.sessionId as string | undefined;

    const candidateId = headerSessionId || cookieSessionId || querySessionId;
    let session: AnonymousSessionData | null = null;

    if (candidateId && typeof candidateId === 'string' && candidateId.trim().length > 0) {
      session = await prisma.anonymousSession.findUnique({
        where: { id: candidateId.trim() },
      });
    }

    if (!session) {
      // In local dev, reuse the most recent session with repositories to prevent losing context across restarts
      if (process.env.NODE_ENV !== 'production') {
        const sessionWithRepos = await prisma.repository.findFirst({
          orderBy: { createdAt: 'desc' },
          select: { sessionId: true },
        });

        if (sessionWithRepos?.sessionId) {
          session = await prisma.anonymousSession.findUnique({
            where: { id: sessionWithRepos.sessionId },
          });
        }
      }

      if (!session) {
        session = await prisma.anonymousSession.create({
          data: {},
        });
      }
    }

    // Set cookie and response header
    res.cookie(SESSION_COOKIE_NAME, session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE_MS,
      path: '/',
    });

    res.setHeader('X-Session-Id', session.id);
    res.setHeader('Access-Control-Expose-Headers', 'X-Session-Id, Set-Cookie');

    req.anonymousSession = session;
    return next();
  } catch (err: any) {
    console.error('[SessionMiddleware] Failed to resolve anonymous session:', err);
    return res.status(500).json({ error: 'Internal session authentication failure' });
  }
}

import { Request, Response, NextFunction } from 'express';

/**
 * In-memory sliding window rate limiter (zero Redis, zero external dependencies).
 */
export function rateLimiter(limit: number = 120, windowSeconds: number = 60) {
  const memoryCounts = new Map<string, { count: number; expiresAt: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const key = `ratelimit:${ip}`;
    const now = Date.now();

    const entry = memoryCounts.get(key);
    if (!entry || entry.expiresAt < now) {
      memoryCounts.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
      return next();
    }

    entry.count += 1;
    if (entry.count > limit) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please wait a moment before sending more requests.',
      });
    }

    next();
  };
}

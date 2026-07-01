import type { Request, Response, NextFunction } from 'express';

interface Bucket { count: number; resetAt: number; }

/**
 * Limiteur de débit simple à fenêtre fixe, en mémoire (mono-instance).
 * Suffisant pour freiner le brute-force sur les endpoints de login.
 */
export function rateLimit(opts: { windowMs: number; max: number; message?: string }) {
  const { windowMs, max, message = 'Trop de tentatives. Réessaie plus tard.' } = opts;
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || b.resetAt < now) { b = { count: 0, resetAt: now + windowMs }; buckets.set(key, b); }
    b.count += 1;
    if (b.count > max) {
      res.setHeader('Retry-After', Math.ceil((b.resetAt - now) / 1000));
      res.status(429).json({ error: message });
      return;
    }
    // Nettoyage opportuniste pour éviter une croissance illimitée de la Map.
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
    }
    next();
  };
}

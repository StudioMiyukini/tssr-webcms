import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { CacheStats } from '../../shared/types';

// Cache mémoire des réponses publiques GET (mono-instance). Le contenu d'un site
// vitrine change rarement et via l'admin uniquement : on sert depuis la RAM avec
// un TTL court + ETag (304 conditionnel), et on vide tout sur la moindre écriture admin.

interface Entry { body: string; type: string; etag: string; expiresAt: number; bytes: number; }

const store = new Map<string, Entry>();
let hits = 0;
let misses = 0;

export interface CacheConfig { enabled: boolean; ttlMs: number; }

/** Hash FNV-1a rapide → ETag stable pour un corps de réponse. */
function weakEtag(body: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < body.length; i++) { h ^= body.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return `W/"${(h >>> 0).toString(36)}-${body.length.toString(36)}"`;
}

/** Vide entièrement le cache public (appelé après toute écriture admin réussie). */
export function clearPublicCache(): void { store.clear(); }

/** Statistiques pour le panneau d'admin. */
export function cacheStats(cfg: CacheConfig): CacheStats {
  let approxBytes = 0;
  for (const e of store.values()) approxBytes += e.bytes;
  const total = hits + misses;
  return {
    enabled: cfg.enabled,
    entries: store.size,
    hits, misses,
    hitRate: total ? Math.round((hits / total) * 100) : 0,
    approxBytes,
    ttl: Math.round(cfg.ttlMs / 1000),
  };
}

/**
 * Middleware de cache pour les réponses publiques GET.
 * Court-circuite et sert depuis la RAM (ou renvoie 304) tant que l'entrée est fraîche.
 * `getConfig` est relu à chaque requête → bascule activé/TTL à chaud depuis l'admin.
 */
export function publicCache(getConfig: () => CacheConfig): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const cfg = getConfig();
    if (!cfg.enabled || req.method !== 'GET') { next(); return; }

    const key = req.originalUrl;
    const now = Date.now();
    const hit = store.get(key);
    if (hit && hit.expiresAt > now) {
      hits += 1;
      res.setHeader('ETag', hit.etag);
      res.setHeader('Cache-Control', `public, max-age=${Math.round(cfg.ttlMs / 1000)}`);
      res.setHeader('X-Cache', 'HIT');
      if (req.headers['if-none-match'] === hit.etag) { res.status(304).end(); return; }
      res.type(hit.type).send(hit.body);
      return;
    }
    misses += 1;
    if (hit) store.delete(key); // expirée

    // Intercepte res.send pour mémoriser la réponse 200 JSON/texte.
    const originalSend = res.send.bind(res);
    res.setHeader('X-Cache', 'MISS');
    res.send = ((body?: unknown) => {
      try {
        if (res.statusCode === 200 && (typeof body === 'string' || Buffer.isBuffer(body))) {
          const text = typeof body === 'string' ? body : body.toString('utf8');
          if (text.length <= 512 * 1024) { // ne cache pas les réponses énormes
            const etag = weakEtag(text);
            const type = String(res.getHeader('Content-Type') || 'application/json');
            store.set(key, { body: text, type, etag, expiresAt: Date.now() + cfg.ttlMs, bytes: text.length });
            res.setHeader('ETag', etag);
            res.setHeader('Cache-Control', `public, max-age=${Math.round(cfg.ttlMs / 1000)}`);
          }
        }
      } catch { /* en cas de souci, on sert sans cacher */ }
      return originalSend(body as any);
    }) as Response['send'];
    next();
  };
}

/**
 * Middleware à monter sur /api : après toute écriture admin réussie
 * (POST/PUT/PATCH/DELETE sur /api/admin), vide le cache public pour éviter le contenu périmé.
 */
// Routes admin qui n'affectent jamais le rendu public → inutile de vider le cache
// (les notes s'auto-sauvegardent très souvent : on évite de purger le cache à chaque frappe).
const NEVER_PUBLIC = ['/api/admin/notes', '/api/admin/note-folders'];

export function cacheBustOnWrite(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const mutating = req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS';
    if (mutating && req.path.startsWith('/api/admin') && !NEVER_PUBLIC.some(p => req.path.startsWith(p))) {
      res.on('finish', () => { if (res.statusCode < 400) clearPublicCache(); });
    }
    next();
  };
}

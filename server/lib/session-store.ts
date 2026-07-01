import session from 'express-session';
import { rawDb } from '../db/client';

/**
 * Store de session persistant adossé à better-sqlite3 (table `sessions`).
 * Remplace le MemoryStore : sessions conservées entre redémarrages, pas de fuite mémoire.
 */
export class SqliteSessionStore extends session.Store {
  private getStmt = rawDb.prepare('SELECT data, expires FROM sessions WHERE sid = ?');
  private setStmt = rawDb.prepare(
    'INSERT INTO sessions (sid, data, expires) VALUES (?, ?, ?) ' +
    'ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires = excluded.expires',
  );
  private delStmt = rawDb.prepare('DELETE FROM sessions WHERE sid = ?');
  private touchStmt = rawDb.prepare('UPDATE sessions SET expires = ? WHERE sid = ?');
  private pruneStmt = rawDb.prepare('DELETE FROM sessions WHERE expires < ?');

  private expiry(sess: session.SessionData): number {
    const exp = sess?.cookie?.expires ? new Date(sess.cookie.expires).getTime() : null;
    if (exp) return exp;
    const maxAge = sess?.cookie?.maxAge;
    if (typeof maxAge === 'number') return Date.now() + maxAge;
    return Date.now() + 8 * 60 * 60 * 1000;
  }

  get(sid: string, cb: (err?: unknown, session?: session.SessionData | null) => void): void {
    try {
      const row = this.getStmt.get(sid) as { data: string; expires: number } | undefined;
      if (!row) { cb(null, null); return; }
      if (row.expires && row.expires < Date.now()) { this.delStmt.run(sid); cb(null, null); return; }
      cb(null, JSON.parse(row.data));
    } catch (e) { cb(e); }
  }

  set(sid: string, sess: session.SessionData, cb?: (err?: unknown) => void): void {
    try { this.setStmt.run(sid, JSON.stringify(sess), this.expiry(sess)); cb?.(); }
    catch (e) { cb?.(e); }
  }

  destroy(sid: string, cb?: (err?: unknown) => void): void {
    try { this.delStmt.run(sid); cb?.(); } catch (e) { cb?.(e); }
  }

  touch(sid: string, sess: session.SessionData, cb?: (err?: unknown) => void): void {
    try { this.touchStmt.run(this.expiry(sess), sid); cb?.(); } catch (e) { cb?.(e); }
  }

  /** Purge les sessions expirées (à appeler périodiquement). */
  prune(): void {
    try { this.pruneStmt.run(Date.now()); } catch { /* ignore */ }
  }
}

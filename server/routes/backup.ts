import { Router } from 'express';
import express from 'express';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { requireAuth } from '../lib/auth';
import { clearPublicCache } from '../lib/cache';
import { rawDb } from '../db/client';
import { DB_PATH, UPLOADS_DIR } from '../env';

/* Export / import du site depuis le back-office (admin) ou en HTTP authentifié.
   - GET  /api/admin/export : télécharge un .zip = base cms.sqlite (backup consistant) + uploads.
   - POST /api/admin/import : réinjecte un .zip (base + uploads) dans l'instance en cours.
   Zip/dézip via PowerShell (Compress-Archive / Expand-Archive) — serveur Windows. */

const router = Router();
const pexec = promisify(execFile);
const PS = ['-NoProfile', '-NonInteractive', '-Command'];
// Tables à NE PAS écraser à l'import : sessions (garde l'admin connecté) et l'index FTS (reconstruit tout seul).
const SKIP = (name: string) => name === 'sessions' || name.startsWith('search_fts') || name.startsWith('sqlite_');

function find(base: string, name: string, isDir: boolean): string | null {
  const stack = [base];
  while (stack.length) {
    const d = stack.shift()!;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (isDir && e.name === name) return p; if (e.name !== 'node_modules' && e.name !== 'dist') stack.push(p); }
      else if (!isDir && e.name === name) return p;
    }
  }
  return null;
}
function countFiles(dir: string): number {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) n += e.isDirectory() ? countFiles(path.join(dir, e.name)) : 1;
  return n;
}

/** Importe le contenu d'un fichier cms.sqlite dans la base LIVE (copie table par table, colonnes communes). */
function importDb(file: string): { tables: number; rows: number } {
  const q = (s: string) => s.replace(/'/g, "''");
  rawDb.exec(`ATTACH '${q(file)}' AS imp`);
  try {
    const impTables = (rawDb.prepare("SELECT name FROM imp.sqlite_master WHERE type='table'").all() as Array<{ name: string }>).map(r => r.name).filter(n => !SKIP(n));
    const mainTables = new Set((rawDb.prepare("SELECT name FROM main.sqlite_master WHERE type='table'").all() as Array<{ name: string }>).map(r => r.name));
    let tables = 0, rows = 0;
    rawDb.pragma('foreign_keys = OFF');
    const tx = rawDb.transaction(() => {
      for (const t of impTables) {
        if (!mainTables.has(t)) continue;
        const mainCols = (rawDb.pragma(`main.table_info("${t}")`) as Array<{ name: string }>).map(c => c.name);
        const impCols = new Set((rawDb.pragma(`imp.table_info("${t}")`) as Array<{ name: string }>).map(c => c.name));
        const common = mainCols.filter(c => impCols.has(c));
        if (!common.length) continue;
        const list = common.map(c => `"${c}"`).join(',');
        rawDb.exec(`DELETE FROM main."${t}"`);
        rawDb.exec(`INSERT INTO main."${t}" (${list}) SELECT ${list} FROM imp."${t}"`);
        rows += (rawDb.prepare(`SELECT count(*) c FROM main."${t}"`).get() as { c: number }).c;
        tables++;
      }
    });
    tx();
    rawDb.pragma('foreign_keys = ON');
    return { tables, rows };
  } finally {
    rawDb.exec('DETACH imp');
  }
}

// ---- EXPORT : télécharge base + uploads en .zip ----
router.get('/api/admin/export', requireAuth, async (_req, res) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-exp-'));
  const stage = path.join(tmp, 'site');
  const cleanup = () => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* */ } };
  try {
    fs.mkdirSync(stage, { recursive: true });
    const src = new Database(DB_PATH, { readonly: true });
    await src.backup(path.join(stage, 'cms.sqlite')); // snapshot consistant (WAL replié)
    src.close();
    if (fs.existsSync(UPLOADS_DIR)) fs.cpSync(UPLOADS_DIR, path.join(stage, 'uploads'), { recursive: true });
    const zip = path.join(tmp, 'site.zip');
    await pexec('powershell', [...PS, `Compress-Archive -Path '${stage}\\*' -DestinationPath '${zip}' -Force`]);
    const size = fs.statSync(zip).size;
    const name = `tssr-site-${new Date().toISOString().slice(0, 10)}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.setHeader('Content-Length', String(size));
    const rs = fs.createReadStream(zip);
    rs.on('close', cleanup); rs.on('error', cleanup);
    rs.pipe(res);
  } catch (e) {
    cleanup();
    if (!res.headersSent) res.status(500).json({ error: 'Export impossible : ' + String((e as any)?.message || e) });
  }
});

// ---- IMPORT : réinjecte un .zip (base + uploads) ----
router.post('/api/admin/import', requireAuth, express.raw({ type: () => true, limit: '120mb' }), async (req, res) => {
  const buf = req.body as Buffer;
  if (!Buffer.isBuffer(buf) || !buf.length) { res.status(400).json({ error: 'Archive vide.' }); return; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-imp-'));
  try {
    const zpath = path.join(tmp, 'in.zip');
    fs.writeFileSync(zpath, buf);
    const ext = path.join(tmp, 'x');
    await pexec('powershell', [...PS, `Expand-Archive -Path '${zpath}' -DestinationPath '${ext}' -Force`]);
    const dbFile = find(ext, 'cms.sqlite', false);
    if (!dbFile) { res.status(400).json({ error: 'cms.sqlite introuvable dans l’archive.' }); return; }
    // Filet de sécurité : sauvegarde consistante de la base actuelle avant de la remplacer.
    const bak = `${DB_PATH}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    try { await rawDb.backup(bak); } catch { /* on continue même si la sauvegarde échoue */ }
    const stats = importDb(dbFile);
    const upDir = find(ext, 'uploads', true);
    let uploads = 0;
    if (upDir) { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); fs.cpSync(upDir, UPLOADS_DIR, { recursive: true }); uploads = countFiles(upDir); }
    clearPublicCache();
    res.json({ ok: true, tables: stats.tables, rows: stats.rows, uploads });
  } catch (e) {
    res.status(500).json({ error: 'Import impossible : ' + String((e as any)?.message || e) });
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* */ }
  }
});

export default router;

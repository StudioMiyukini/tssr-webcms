import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { and, eq, like, or, sql, desc } from 'drizzle-orm';
import { db } from '../db/client';
import { notes, note_folders } from '../db/schema';
import { isAuthed } from '../lib/auth';
import { isSitePrivate } from './settings';
import { parseBody, parseId, notFound } from '../lib/http';

const router = Router();

// Gestion des notes : autorisée à l'admin, OU à un visiteur débloqué quand le site est privé
// (espace de notes partagé derrière le mot de passe du site). Sinon refus.
const requireAuth: RequestHandler = (req, res, next) => {
  if (isAuthed(req) || (isSitePrivate() && req.session?.siteUnlocked === true)) { next(); return; }
  res.status(401).json({ error: 'Unauthorized' });
};

// Extrait un aperçu texte d'un contenu HTML (pour la liste, sans renvoyer tout le corps).
function snippet(html: string, len = 150): string {
  const t = String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
  return t.length > len ? `${t.slice(0, len).trimEnd()}…` : t;
}

const COLORS = ['', 'yellow', 'green', 'blue', 'pink', 'purple', 'orange', 'gray'];

// ===== Dossiers =====
router.get('/api/admin/note-folders', requireAuth, (_req, res) => {
  const folders = db.select().from(note_folders).orderBy(note_folders.sort_order, note_folders.id).all();
  const counts = db.select({ folder_id: notes.folder_id, n: sql<number>`count(*)` })
    .from(notes).where(eq(notes.archived, 0)).groupBy(notes.folder_id).all();
  const byId = new Map(counts.map(c => [c.folder_id, c.n]));
  res.json(folders.map(f => ({ id: f.id, name: f.name, count: byId.get(f.id) || 0 })));
});

const folderSchema = z.object({ name: z.string().min(1).max(80) });

router.post('/api/admin/note-folders', requireAuth, (req, res) => {
  const data = parseBody(folderSchema, req.body);
  const rec = db.insert(note_folders).values({ name: data.name.trim() }).returning().get();
  res.status(201).json({ id: rec.id, name: rec.name, count: 0 });
});

router.put('/api/admin/note-folders/:id', requireAuth, (req, res) => {
  const id = parseId(String(req.params.id));
  const data = parseBody(folderSchema, req.body);
  const rec = db.update(note_folders).set({ name: data.name.trim() }).where(eq(note_folders.id, id)).returning().get();
  if (!rec) throw notFound('Dossier introuvable');
  res.json({ id: rec.id, name: rec.name });
});

router.delete('/api/admin/note-folders/:id', requireAuth, (req, res) => {
  const id = parseId(String(req.params.id));
  db.update(notes).set({ folder_id: 0 }).where(eq(notes.folder_id, id)).run(); // détache les notes
  db.delete(note_folders).where(eq(note_folders.id, id)).run();
  res.json({ ok: true });
});

// ===== Notes =====
router.get('/api/admin/notes', requireAuth, (req, res) => {
  const archived = req.query.archived === '1' ? 1 : 0;
  const folder = req.query.folder ? Number(req.query.folder) : null;
  const q = String(req.query.q || '').trim();

  const conds = [eq(notes.archived, archived)];
  if (folder != null && Number.isFinite(folder)) conds.push(eq(notes.folder_id, folder));
  if (q) conds.push(or(like(notes.title, `%${q}%`), like(notes.content, `%${q}%`))!);

  const rows = db.select({
    id: notes.id, title: notes.title, content: notes.content, folder_id: notes.folder_id,
    color: notes.color, pinned: notes.pinned, archived: notes.archived, updated_at: notes.updated_at,
  }).from(notes).where(and(...conds)).orderBy(desc(notes.pinned), desc(notes.updated_at)).all();

  res.json(rows.map(r => ({
    id: r.id, title: r.title, snippet: snippet(r.content), folder_id: r.folder_id,
    color: r.color, pinned: r.pinned, archived: r.archived, updated_at: r.updated_at,
  })));
});

router.get('/api/admin/notes/:id', requireAuth, (req, res) => {
  const id = parseId(String(req.params.id));
  const rec = db.select().from(notes).where(eq(notes.id, id)).get();
  if (!rec) throw notFound('Note introuvable');
  res.json(rec);
});

const createSchema = z.object({
  title: z.string().max(300).optional().default(''),
  content: z.string().optional().default(''),
  folder_id: z.coerce.number().int().min(0).optional().default(0),
});

router.post('/api/admin/notes', requireAuth, (req, res) => {
  const data = parseBody(createSchema, req.body);
  const rec = db.insert(notes).values({
    title: data.title, content: data.content, folder_id: data.folder_id,
  }).returning().get();
  res.status(201).json(rec);
});

const updateSchema = z.object({
  title: z.string().max(300).optional(),
  content: z.string().optional(),
  folder_id: z.coerce.number().int().min(0).optional(),
  color: z.enum(COLORS as [string, ...string[]]).optional(),
  pinned: z.coerce.number().int().min(0).max(1).optional(),
  archived: z.coerce.number().int().min(0).max(1).optional(),
});

router.put('/api/admin/notes/:id', requireAuth, (req, res) => {
  const id = parseId(String(req.params.id));
  const data = parseBody(updateSchema, req.body);
  const patch: Record<string, unknown> = { updated_at: sql`CURRENT_TIMESTAMP` };
  for (const k of ['title', 'content', 'folder_id', 'color', 'pinned', 'archived'] as const) {
    if (data[k] !== undefined) patch[k] = data[k];
  }
  const rec = db.update(notes).set(patch).where(eq(notes.id, id)).returning().get();
  if (!rec) throw notFound('Note introuvable');
  res.json({ ok: true, id: rec.id, updated_at: rec.updated_at });
});

router.delete('/api/admin/notes/:id', requireAuth, (req, res) => {
  const id = parseId(String(req.params.id));
  db.delete(notes).where(eq(notes.id, id)).run();
  res.json({ ok: true });
});

// ===== Public : note embarquée dans une page (bloc « note » du page builder) =====
router.get('/api/public/notes/:id', (req, res) => {
  const id = parseId(String(req.params.id));
  const rec = db.select({ id: notes.id, title: notes.title, content: notes.content, color: notes.color })
    .from(notes).where(and(eq(notes.id, id), eq(notes.archived, 0))).get();
  if (!rec) throw notFound('Note introuvable');
  res.json(rec);
});

export default router;

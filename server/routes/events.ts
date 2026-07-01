import { Router } from 'express';
import { z } from 'zod';
import { eq, and, asc, desc, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { events } from '../db/schema';
import { requireAuth } from '../lib/auth';
import { requireFeature } from './settings';
import { parseBody, parseId, notFound, conflict } from '../lib/http';
import { slugify } from '../lib/utils';

const router = Router();

const eventInput = z.object({
  title: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional().default(''),
  location: z.string().optional().default(''),
  start_at: z.string().min(1),
  end_at: z.string().optional().default(''),
  all_day: z.coerce.number().int().min(0).max(1).default(0),
  url: z.string().optional().default(''),
  image_url: z.string().optional().default(''),
  published: z.coerce.number().int().min(0).max(1).default(1),
});

// ===== Admin =====
router.get('/api/admin/events', requireAuth, (_req, res) => {
  res.json(db.select().from(events).orderBy(desc(events.start_at)).all());
});

router.get('/api/admin/events/:id', requireAuth, (req, res) => {
  const ev = db.select().from(events).where(eq(events.id, parseId(String(req.params.id)))).get();
  if (!ev) throw notFound('Événement introuvable');
  res.json(ev);
});

router.post('/api/admin/events', requireAuth, (req, res) => {
  const data = parseBody(eventInput, req.body);
  const slug = slugify(data.slug || data.title);
  try { res.status(201).json(db.insert(events).values({ ...data, slug }).returning().get()); }
  catch { throw conflict('Slug déjà utilisé'); }
});

router.put('/api/admin/events/:id', requireAuth, (req, res) => {
  const id = parseId(String(req.params.id));
  const data = parseBody(eventInput, req.body);
  const slug = slugify(data.slug || data.title);
  const updated = db.update(events).set({ ...data, slug, updated_at: sql`CURRENT_TIMESTAMP` }).where(eq(events.id, id)).returning().get();
  if (!updated) throw notFound('Événement introuvable');
  res.json(updated);
});

router.delete('/api/admin/events/:id', requireAuth, (req, res) => {
  db.delete(events).where(eq(events.id, parseId(String(req.params.id)))).run();
  res.json({ ok: true });
});

// ===== Public (agenda) =====
router.get('/api/public/events', requireFeature('events'), (_req, res) => {
  res.json(db.select().from(events).where(eq(events.published, 1)).orderBy(asc(events.start_at)).all());
});

router.get('/api/public/events/:slug', requireFeature('events'), (req, res) => {
  const ev = db.select().from(events).where(and(eq(events.slug, String(req.params.slug)), eq(events.published, 1))).get();
  if (!ev) throw notFound('Événement introuvable');
  res.json(ev);
});

export default router;

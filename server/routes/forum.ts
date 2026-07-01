import { Router } from 'express';
import { z } from 'zod';
import { eq, asc, desc, sql } from 'drizzle-orm';
import { db, rawDb } from '../db/client';
import { forum_categories, forum_topics, forum_replies } from '../db/schema';
import { requireAuth } from '../lib/auth';
import { requireFeature } from './settings';
import { parseBody, parseId, notFound, conflict } from '../lib/http';
import { slugify } from '../lib/utils';
import { rateLimit } from '../lib/rate-limit';

const router = Router();
const postLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 10, message: 'Trop de messages. Réessaie dans quelques minutes.' });

// ===== Admin : catégories =====
const catInput = z.object({ name: z.string().min(1), slug: z.string().optional(), description: z.string().optional().default(''), sort_order: z.coerce.number().int().default(0) });

router.get('/api/admin/forum/categories', requireAuth, (_req, res) => {
  res.json(db.select().from(forum_categories).orderBy(asc(forum_categories.sort_order), asc(forum_categories.id)).all());
});
router.post('/api/admin/forum/categories', requireAuth, (req, res) => {
  const d = parseBody(catInput, req.body);
  const slug = slugify(d.slug || d.name);
  try { res.status(201).json(db.insert(forum_categories).values({ name: d.name, slug, description: d.description, sort_order: d.sort_order }).returning().get()); }
  catch { throw conflict('Slug déjà utilisé'); }
});
router.put('/api/admin/forum/categories/:id', requireAuth, (req, res) => {
  const id = parseId(String(req.params.id));
  const d = parseBody(catInput, req.body);
  const slug = slugify(d.slug || d.name);
  const rec = db.update(forum_categories).set({ name: d.name, slug, description: d.description, sort_order: d.sort_order }).where(eq(forum_categories.id, id)).returning().get();
  if (!rec) throw notFound('Catégorie introuvable');
  res.json(rec);
});
router.delete('/api/admin/forum/categories/:id', requireAuth, (req, res) => {
  const id = parseId(String(req.params.id));
  const topicIds = db.select({ id: forum_topics.id }).from(forum_topics).where(eq(forum_topics.category_id, id)).all().map(t => t.id);
  for (const tid of topicIds) db.delete(forum_replies).where(eq(forum_replies.topic_id, tid)).run();
  db.delete(forum_topics).where(eq(forum_topics.category_id, id)).run();
  db.delete(forum_categories).where(eq(forum_categories.id, id)).run();
  res.json({ ok: true });
});

// ===== Admin : modération sujets / réponses =====
router.get('/api/admin/forum/topics', requireAuth, (_req, res) => {
  res.json(db.select().from(forum_topics).orderBy(desc(forum_topics.last_activity_at)).all());
});
const modSchema = z.object({ pinned: z.coerce.number().int().min(0).max(1).optional(), locked: z.coerce.number().int().min(0).max(1).optional() });
router.put('/api/admin/forum/topics/:id', requireAuth, (req, res) => {
  const id = parseId(String(req.params.id));
  const d = parseBody(modSchema, req.body);
  const patch: Record<string, unknown> = {};
  if (d.pinned !== undefined) patch.pinned = d.pinned;
  if (d.locked !== undefined) patch.locked = d.locked;
  const rec = db.update(forum_topics).set(patch).where(eq(forum_topics.id, id)).returning().get();
  if (!rec) throw notFound('Sujet introuvable');
  res.json(rec);
});
router.delete('/api/admin/forum/topics/:id', requireAuth, (req, res) => {
  const id = parseId(String(req.params.id));
  db.delete(forum_replies).where(eq(forum_replies.topic_id, id)).run();
  db.delete(forum_topics).where(eq(forum_topics.id, id)).run();
  res.json({ ok: true });
});
router.delete('/api/admin/forum/replies/:id', requireAuth, (req, res) => {
  const id = parseId(String(req.params.id));
  const rep = db.select().from(forum_replies).where(eq(forum_replies.id, id)).get();
  db.delete(forum_replies).where(eq(forum_replies.id, id)).run();
  if (rep) db.update(forum_topics).set({ reply_count: sql`MAX(reply_count - 1, 0)` }).where(eq(forum_topics.id, rep.topic_id)).run();
  res.json({ ok: true });
});

// ===== Public =====
const forumOverviewStmt = rawDb.prepare(`
  SELECT c.id, c.name, c.slug, c.description, c.sort_order,
         COUNT(t.id) AS topic_count,
         COALESCE(SUM(t.reply_count), 0) AS reply_count,
         COALESCE(MAX(t.last_activity_at), '') AS last_activity_at
  FROM forum_categories c
  LEFT JOIN forum_topics t ON t.category_id = c.id
  GROUP BY c.id
  ORDER BY c.sort_order, c.id
`);
router.get('/api/public/forum', requireFeature('forum'), (_req, res) => {
  res.json(forumOverviewStmt.all()); // une seule requête agrégée (plus de N+1)
});
router.get('/api/public/forum/:catSlug', requireFeature('forum'), (req, res) => {
  const cat = db.select().from(forum_categories).where(eq(forum_categories.slug, String(req.params.catSlug))).get();
  if (!cat) throw notFound('Catégorie introuvable');
  const topics = db.select().from(forum_topics).where(eq(forum_topics.category_id, cat.id)).orderBy(desc(forum_topics.pinned), desc(forum_topics.last_activity_at)).all();
  res.json({ category: cat, topics });
});
router.get('/api/public/forum/topics/:slug', requireFeature('forum'), (req, res) => {
  const topic = db.select().from(forum_topics).where(eq(forum_topics.slug, String(req.params.slug))).get();
  if (!topic) throw notFound('Sujet introuvable');
  const category = db.select().from(forum_categories).where(eq(forum_categories.id, topic.category_id)).get();
  const replies = db.select().from(forum_replies).where(eq(forum_replies.topic_id, topic.id)).orderBy(asc(forum_replies.id)).all();
  res.json({ topic, category, replies });
});

const topicInput = z.object({ title: z.string().min(3).max(200), author: z.string().min(1).max(80), body: z.string().min(1).max(10000) });
router.post('/api/public/forum/:catSlug/topics', requireFeature('forum'), postLimiter, (req, res) => {
  const cat = db.select().from(forum_categories).where(eq(forum_categories.slug, String(req.params.catSlug))).get();
  if (!cat) throw notFound('Catégorie introuvable');
  const d = parseBody(topicInput, req.body);
  const base = slugify(d.title) || 'sujet';
  let slug = base, n = 1;
  while (db.select({ id: forum_topics.id }).from(forum_topics).where(eq(forum_topics.slug, slug)).get()) { n += 1; slug = `${base}-${n}`; }
  const rec = db.insert(forum_topics).values({ category_id: cat.id, title: d.title, slug, author: d.author, body: d.body }).returning().get();
  res.status(201).json(rec);
});

const replyInput = z.object({ author: z.string().min(1).max(80), body: z.string().min(1).max(10000) });
router.post('/api/public/forum/topics/:slug/replies', requireFeature('forum'), postLimiter, (req, res) => {
  const topic = db.select().from(forum_topics).where(eq(forum_topics.slug, String(req.params.slug))).get();
  if (!topic) throw notFound('Sujet introuvable');
  if (topic.locked) throw conflict('Ce sujet est verrouillé');
  const d = parseBody(replyInput, req.body);
  const rec = db.insert(forum_replies).values({ topic_id: topic.id, author: d.author, body: d.body }).returning().get();
  db.update(forum_topics).set({ reply_count: sql`reply_count + 1`, last_activity_at: sql`CURRENT_TIMESTAMP` }).where(eq(forum_topics.id, topic.id)).run();
  res.status(201).json(rec);
});

export default router;

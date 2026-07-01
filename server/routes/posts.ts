import { Router } from 'express';
import { z } from 'zod';
import { eq, and, ne, desc, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { posts, comments } from '../db/schema';
import { requireAuth } from '../lib/auth';
import { requireFeature } from './settings';
import { parseBody, parseId, notFound, conflict } from '../lib/http';
import { slugify } from '../lib/utils';

const router = Router();

const postInput = z.object({
  title: z.string().min(1),
  slug: z.string().optional(),
  excerpt: z.string().optional().default(''),
  content: z.string().optional().default(''),
  builder_json: z.string().optional().default(''),
  cover_url: z.string().optional().default(''),
  category: z.string().optional().default(''),
  author: z.string().optional().default(''),
  published: z.coerce.number().int().min(0).max(1).default(1),
  featured: z.coerce.number().int().min(0).max(1).default(0),
  published_at: z.string().optional().default(''),
});

// ===== Admin =====
router.get('/api/admin/posts', requireAuth, (_req, res) => {
  res.json(db.select({ id: posts.id, title: posts.title, slug: posts.slug, category: posts.category, published: posts.published, featured: posts.featured, published_at: posts.published_at })
    .from(posts).orderBy(desc(posts.published_at), desc(posts.id)).all());
});

router.get('/api/admin/posts/:id', requireAuth, (req, res) => {
  const p = db.select().from(posts).where(eq(posts.id, parseId(String(req.params.id)))).get();
  if (!p) throw notFound('Article introuvable');
  res.json(p);
});

router.post('/api/admin/posts', requireAuth, (req, res) => {
  const data = parseBody(postInput, req.body);
  const slug = slugify(data.slug || data.title);
  const published_at = data.published_at || new Date().toISOString().slice(0, 10);
  try { res.status(201).json(db.insert(posts).values({ ...data, slug, published_at }).returning().get()); }
  catch { throw conflict('Slug déjà utilisé'); }
});

router.put('/api/admin/posts/:id', requireAuth, (req, res) => {
  const id = parseId(String(req.params.id));
  const data = parseBody(postInput, req.body);
  const slug = slugify(data.slug || data.title);
  const published_at = data.published_at || new Date().toISOString().slice(0, 10);
  const updated = db.update(posts).set({ ...data, slug, published_at, updated_at: sql`CURRENT_TIMESTAMP` }).where(eq(posts.id, id)).returning().get();
  if (!updated) throw notFound('Article introuvable');
  res.json(updated);
});

router.delete('/api/admin/posts/:id', requireAuth, (req, res) => {
  const id = parseId(String(req.params.id));
  db.delete(comments).where(eq(comments.post_id, id)).run();
  db.delete(posts).where(eq(posts.id, id)).run();
  res.json({ ok: true });
});

// ===== Public (blog) =====
const PUBLIC_COLS = { id: posts.id, title: posts.title, slug: posts.slug, excerpt: posts.excerpt, cover_url: posts.cover_url, category: posts.category, author: posts.author, featured: posts.featured, published_at: posts.published_at };

router.get('/api/public/posts', requireFeature('blog'), (req, res) => {
  const category = String(req.query.category || '').trim();
  const featuredOnly = String(req.query.featured || '') === '1';
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.limit) || 9));
  const conds = [eq(posts.published, 1)];
  if (category) conds.push(eq(posts.category, category));
  if (featuredOnly) conds.push(eq(posts.featured, 1));
  const where = and(...conds);
  const total = db.select({ c: sql<number>`COUNT(*)` }).from(posts).where(where).get()?.c ?? 0;
  const items = db.select(PUBLIC_COLS).from(posts).where(where).orderBy(desc(posts.published_at), desc(posts.id)).limit(pageSize).offset((page - 1) * pageSize).all();
  res.json({ items, total, page, pageSize });
});

router.get('/api/public/posts/categories', requireFeature('blog'), (_req, res) => {
  const list = db.select({ category: posts.category }).from(posts).where(eq(posts.published, 1)).all();
  res.json(Array.from(new Set(list.map(p => p.category).filter(Boolean))).sort());
});

router.get('/api/public/posts/:slug/related', requireFeature('blog'), (req, res) => {
  const cur = db.select().from(posts).where(and(eq(posts.slug, String(req.params.slug)), eq(posts.published, 1))).get();
  if (!cur) { res.json([]); return; }
  let items = cur.category
    ? db.select(PUBLIC_COLS).from(posts).where(and(eq(posts.published, 1), eq(posts.category, cur.category), ne(posts.id, cur.id))).orderBy(desc(posts.published_at)).limit(4).all()
    : [];
  if (items.length < 4) {
    const extra = db.select(PUBLIC_COLS).from(posts).where(and(eq(posts.published, 1), ne(posts.id, cur.id))).orderBy(desc(posts.published_at)).limit(8).all();
    for (const p of extra) { if (items.length >= 4) break; if (!items.some(i => i.id === p.id)) items = [...items, p]; }
  }
  res.json(items);
});

router.get('/api/public/posts/:slug', requireFeature('blog'), (req, res) => {
  // On exclut builder_json (éditeur) : le rendu public utilise `content`.
  const p = db.select({
    id: posts.id, title: posts.title, slug: posts.slug, excerpt: posts.excerpt, content: posts.content,
    cover_url: posts.cover_url, category: posts.category, author: posts.author,
    published: posts.published, featured: posts.featured, published_at: posts.published_at, updated_at: posts.updated_at,
  }).from(posts).where(and(eq(posts.slug, String(req.params.slug)), eq(posts.published, 1))).get();
  if (!p) throw notFound('Article introuvable');
  res.json(p);
});

export default router;

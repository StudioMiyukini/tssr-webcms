import { Router } from 'express';
import { z } from 'zod';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { pages } from '../db/schema';
import { requireAuth } from '../lib/auth';
import { slugify } from '../lib/utils';

const router = Router();

const pageInput = z.object({
  title: z.string().min(1),
  slug: z.string().optional(),
  excerpt: z.string().optional().default(''),
  content: z.string().optional().default(''),
  builder_json: z.string().optional().default(''),
  published: z.coerce.number().int().min(0).max(1).default(1),
});

router.get('/api/admin/pages', requireAuth, (_req, res) => {
  res.json(db.select().from(pages).orderBy(desc(pages.id)).all());
});

router.get('/api/admin/pages/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const page = db.select().from(pages).where(eq(pages.id, id)).get();
  if (!page) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(page);
});

router.post('/api/admin/pages', requireAuth, (req, res) => {
  const parsed = pageInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const data = parsed.data;
  const slug = slugify(data.slug || data.title);
  try {
    const result = db.insert(pages).values({
      title: data.title,
      slug,
      excerpt: data.excerpt,
      content: data.content,
      builder_json: data.builder_json,
      published: data.published,
    }).returning().get();
    res.status(201).json(result);
  } catch (e: any) {
    res.status(409).json({ error: 'Slug déjà utilisé', detail: e.message });
  }
});

router.put('/api/admin/pages/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const parsed = pageInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const data = parsed.data;
  const slug = slugify(data.slug || data.title);
  const updated = db.update(pages).set({
    title: data.title,
    slug,
    excerpt: data.excerpt,
    content: data.content,
    builder_json: data.builder_json,
    published: data.published,
    updated_at: sql`CURRENT_TIMESTAMP`,
  }).where(eq(pages.id, id)).returning().get();
  if (!updated) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(updated);
});

router.delete('/api/admin/pages/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  db.delete(pages).where(eq(pages.id, id)).run();
  res.json({ ok: true });
});

export default router;

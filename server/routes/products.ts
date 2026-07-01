import { Router } from 'express';
import { z } from 'zod';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { products } from '../db/schema';
import { requireAuth } from '../lib/auth';
import { slugify } from '../lib/utils';

const router = Router();

const productInput = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional().default(''),
  short_description: z.string().optional().default(''),
  price_cents: z.coerce.number().int().min(0).default(0),
  sale_price_cents: z.coerce.number().int().min(0).default(0),
  compare_at_price_cents: z.coerce.number().int().min(0).default(0),
  stock: z.coerce.number().int().min(0).default(0),
  image_url: z.string().optional().default(''),
  sku: z.string().optional().default(''),
  category: z.string().optional().default(''),
  featured: z.coerce.number().int().min(0).max(1).default(0),
  manage_stock: z.coerce.number().int().min(0).max(1).default(1),
  published: z.coerce.number().int().min(0).max(1).default(1),
  variants_json: z.string().optional().default('[]'),
});

router.get('/api/admin/products', requireAuth, (_req, res) => {
  res.json(db.select().from(products).orderBy(desc(products.featured), desc(products.id)).all());
});

router.get('/api/admin/products/:id', requireAuth, (req, res) => {
  const product = db.select().from(products).where(eq(products.id, Number(req.params.id))).get();
  if (!product) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(product);
});

router.post('/api/admin/products', requireAuth, (req, res) => {
  const parsed = productInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const data = parsed.data;
  const slug = slugify(data.slug || data.name);
  try {
    const result = db.insert(products).values({ ...data, slug }).returning().get();
    res.status(201).json(result);
  } catch (e: any) {
    res.status(409).json({ error: 'Slug déjà utilisé', detail: e.message });
  }
});

router.put('/api/admin/products/:id', requireAuth, (req, res) => {
  const parsed = productInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const data = parsed.data;
  const slug = slugify(data.slug || data.name);
  const updated = db.update(products).set({ ...data, slug, updated_at: sql`CURRENT_TIMESTAMP` }).where(eq(products.id, Number(req.params.id))).returning().get();
  if (!updated) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(updated);
});

router.delete('/api/admin/products/:id', requireAuth, (req, res) => {
  db.delete(products).where(eq(products.id, Number(req.params.id))).run();
  res.json({ ok: true });
});

export default router;

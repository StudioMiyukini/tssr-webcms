import { Router } from 'express';
import { z } from 'zod';
import { asc, eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { shipping_methods } from '../db/schema';
import { requireAuth } from '../lib/auth';

const router = Router();

const shippingInput = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(''),
  price_cents: z.coerce.number().int().min(0).default(0),
  free_from_cents: z.coerce.number().int().min(0).default(0),
  active: z.coerce.number().int().min(0).max(1).default(1),
  sort_order: z.coerce.number().int().default(0),
});

router.get('/api/admin/shipping-methods', requireAuth, (_req, res) => {
  res.json(db.select().from(shipping_methods).orderBy(asc(shipping_methods.sort_order), asc(shipping_methods.id)).all());
});

router.get('/api/admin/shipping-methods/:id', requireAuth, (req, res) => {
  const m = db.select().from(shipping_methods).where(eq(shipping_methods.id, Number(req.params.id))).get();
  if (!m) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(m);
});

router.post('/api/admin/shipping-methods', requireAuth, (req, res) => {
  const parsed = shippingInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const result = db.insert(shipping_methods).values(parsed.data).returning().get();
  res.status(201).json(result);
});

router.put('/api/admin/shipping-methods/:id', requireAuth, (req, res) => {
  const parsed = shippingInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const updated = db.update(shipping_methods).set({ ...parsed.data, updated_at: sql`CURRENT_TIMESTAMP` }).where(eq(shipping_methods.id, Number(req.params.id))).returning().get();
  if (!updated) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(updated);
});

router.delete('/api/admin/shipping-methods/:id', requireAuth, (req, res) => {
  db.delete(shipping_methods).where(eq(shipping_methods.id, Number(req.params.id))).run();
  res.json({ ok: true });
});

export default router;

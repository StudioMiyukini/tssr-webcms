import { Router } from 'express';
import { z } from 'zod';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { coupons } from '../db/schema';
import { requireAuth } from '../lib/auth';

const router = Router();

const couponInput = z.object({
  code: z.string().min(1).transform(s => s.trim().toUpperCase()),
  label: z.string().optional().default(''),
  discount_type: z.enum(['percent', 'fixed']).default('percent'),
  discount_value: z.coerce.number().int().min(0).default(0),
  min_subtotal_cents: z.coerce.number().int().min(0).default(0),
  active: z.coerce.number().int().min(0).max(1).default(1),
});

router.get('/api/admin/coupons', requireAuth, (_req, res) => {
  res.json(db.select().from(coupons).orderBy(desc(coupons.id)).all());
});

router.get('/api/admin/coupons/:id', requireAuth, (req, res) => {
  const c = db.select().from(coupons).where(eq(coupons.id, Number(req.params.id))).get();
  if (!c) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(c);
});

router.post('/api/admin/coupons', requireAuth, (req, res) => {
  const parsed = couponInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  try {
    const result = db.insert(coupons).values(parsed.data).returning().get();
    res.status(201).json(result);
  } catch (e: any) {
    res.status(409).json({ error: 'Code déjà utilisé', detail: e.message });
  }
});

router.put('/api/admin/coupons/:id', requireAuth, (req, res) => {
  const parsed = couponInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const updated = db.update(coupons).set({ ...parsed.data, updated_at: sql`CURRENT_TIMESTAMP` }).where(eq(coupons.id, Number(req.params.id))).returning().get();
  if (!updated) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(updated);
});

router.delete('/api/admin/coupons/:id', requireAuth, (req, res) => {
  db.delete(coupons).where(eq(coupons.id, Number(req.params.id))).run();
  res.json({ ok: true });
});

export default router;

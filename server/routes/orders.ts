import { Router } from 'express';
import { z } from 'zod';
import { desc, eq, sql, asc } from 'drizzle-orm';
import { db } from '../db/client';
import { orders, order_items } from '../db/schema';
import { requireAuth } from '../lib/auth';

const router = Router();

router.get('/api/admin/orders', requireAuth, (_req, res) => {
  const list = db.select({
    id: orders.id,
    order_number: orders.order_number,
    customer_name: orders.customer_name,
    customer_email: orders.customer_email,
    status: orders.status,
    total_cents: orders.total_cents,
    tax_cents: orders.tax_cents,
    shipping_price_cents: orders.shipping_price_cents,
    created_at: orders.created_at,
    items_count: sql<number>`(SELECT COUNT(*) FROM order_items WHERE order_id = ${orders.id})`.as('items_count'),
  }).from(orders).orderBy(desc(orders.id)).all();
  res.json(list);
});

router.get('/api/admin/orders/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const order = db.select().from(orders).where(eq(orders.id, id)).get();
  if (!order) { res.status(404).json({ error: 'Not found' }); return; }
  const items = db.select().from(order_items).where(eq(order_items.order_id, id)).orderBy(asc(order_items.id)).all();
  res.json({ order, items });
});

const statusSchema = z.object({ status: z.enum(['pending','processing','completed','cancelled','refunded']) });

router.post('/api/admin/orders/:id/status', requireAuth, (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const updated = db.update(orders).set({ status: parsed.data.status, updated_at: sql`CURRENT_TIMESTAMP` }).where(eq(orders.id, Number(req.params.id))).returning().get();
  if (!updated) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(updated);
});

export default router;

import { Router } from 'express';
import { z } from 'zod';
import { asc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { menu_items } from '../db/schema';
import { requireAuth } from '../lib/auth';

const router = Router();

const menuInput = z.object({
  label: z.string().min(1),
  url: z.string().min(1),
  sort_order: z.coerce.number().int().default(0),
});

router.get('/api/admin/menus', requireAuth, (_req, res) => {
  res.json(db.select().from(menu_items).orderBy(asc(menu_items.sort_order), asc(menu_items.id)).all());
});

router.get('/api/admin/menus/:id', requireAuth, (req, res) => {
  const item = db.select().from(menu_items).where(eq(menu_items.id, Number(req.params.id))).get();
  if (!item) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(item);
});

router.post('/api/admin/menus', requireAuth, (req, res) => {
  const parsed = menuInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const item = db.insert(menu_items).values(parsed.data).returning().get();
  res.status(201).json(item);
});

router.put('/api/admin/menus/:id', requireAuth, (req, res) => {
  const parsed = menuInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const updated = db.update(menu_items).set(parsed.data).where(eq(menu_items.id, Number(req.params.id))).returning().get();
  if (!updated) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(updated);
});

router.delete('/api/admin/menus/:id', requireAuth, (req, res) => {
  db.delete(menu_items).where(eq(menu_items.id, Number(req.params.id))).run();
  res.json({ ok: true });
});

export default router;

import { Router } from 'express';
import { z } from 'zod';
import { eq, and, asc, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { plannings } from '../db/schema';
import { requireAuth } from '../lib/auth';
import { requireFeature } from './settings';
import { parseBody, parseId, notFound, conflict } from '../lib/http';
import { slugify } from '../lib/utils';
import type { PlanningRecord } from '../../shared/types';

const router = Router();

const cellSchema = z.object({ text: z.string().default(''), color: z.string().default('') });
const rowSchema = z.object({ weekday: z.string().default(''), day: z.string().default(''), weekend: z.boolean().default(false), cells: z.array(cellSchema).default([]) });
const legendSchema = z.object({ label: z.string().default(''), color: z.string().default('') });
const planningInput = z.object({
  title: z.string().min(1),
  slug: z.string().optional(),
  section: z.string().optional().default(''),
  period: z.string().optional().default(''),
  columns: z.coerce.number().int().min(1).max(12).default(4),
  legend: z.array(legendSchema).default([]),
  rows: z.array(rowSchema).default([]),
  published: z.coerce.number().int().min(0).max(1).default(1),
  sort_order: z.coerce.number().int().default(0),
});

function safeParse(s: string): any[] { try { const a = JSON.parse(s || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } }
function toRecord(r: typeof plannings.$inferSelect): PlanningRecord {
  return {
    id: r.id, title: r.title, slug: r.slug, section: r.section, period: r.period,
    columns: r.columns, published: r.published, sort_order: r.sort_order,
    created_at: r.created_at ?? '', updated_at: r.updated_at ?? '',
    legend: safeParse(r.legend_json), rows: safeParse(r.rows_json),
  };
}

// ===== Admin =====
router.get('/api/admin/plannings', requireAuth, (_req, res) => {
  res.json(db.select().from(plannings).orderBy(asc(plannings.sort_order), asc(plannings.id)).all().map(toRecord));
});
router.get('/api/admin/plannings/:id', requireAuth, (req, res) => {
  const rec = db.select().from(plannings).where(eq(plannings.id, parseId(String(req.params.id)))).get();
  if (!rec) throw notFound('Planning introuvable');
  res.json(toRecord(rec));
});
router.post('/api/admin/plannings', requireAuth, (req, res) => {
  const d = parseBody(planningInput, req.body);
  const slug = slugify(d.slug || d.title);
  try {
    const rec = db.insert(plannings).values({
      title: d.title, slug, section: d.section, period: d.period, columns: d.columns,
      legend_json: JSON.stringify(d.legend), rows_json: JSON.stringify(d.rows),
      published: d.published, sort_order: d.sort_order,
    }).returning().get();
    res.status(201).json(toRecord(rec));
  } catch { throw conflict('Slug déjà utilisé'); }
});
router.put('/api/admin/plannings/:id', requireAuth, (req, res) => {
  const id = parseId(String(req.params.id));
  const d = parseBody(planningInput, req.body);
  const slug = slugify(d.slug || d.title);
  const rec = db.update(plannings).set({
    title: d.title, slug, section: d.section, period: d.period, columns: d.columns,
    legend_json: JSON.stringify(d.legend), rows_json: JSON.stringify(d.rows),
    published: d.published, sort_order: d.sort_order, updated_at: sql`CURRENT_TIMESTAMP`,
  }).where(eq(plannings.id, id)).returning().get();
  if (!rec) throw notFound('Planning introuvable');
  res.json(toRecord(rec));
});
router.delete('/api/admin/plannings/:id', requireAuth, (req, res) => {
  db.delete(plannings).where(eq(plannings.id, parseId(String(req.params.id)))).run();
  res.json({ ok: true });
});

// ===== Public =====
router.get('/api/public/plannings', requireFeature('planning'), (_req, res) => {
  res.json(db.select().from(plannings).where(eq(plannings.published, 1)).orderBy(asc(plannings.sort_order), asc(plannings.id)).all().map(toRecord));
});
router.get('/api/public/plannings/:slug', requireFeature('planning'), (req, res) => {
  const rec = db.select().from(plannings).where(and(eq(plannings.slug, String(req.params.slug)), eq(plannings.published, 1))).get();
  if (!rec) throw notFound('Planning introuvable');
  res.json(toRecord(rec));
});

export default router;

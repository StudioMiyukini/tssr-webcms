import { Router } from 'express';
import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { forms, form_submissions } from '../db/schema';
import { requireAuth } from '../lib/auth';
import { requireFeature } from './settings';
import { parseBody, parseId, notFound, badRequest, conflict, asyncHandler } from '../lib/http';
import { slugify } from '../lib/utils';
import { rateLimit } from '../lib/rate-limit';
import { readEmailSettings, sendTransactionalEmail, buildKeyValuesEmailHtml } from '../lib/email';
import { FORM_OPTION_TYPES, type FormField, type FormFieldMetric, type FormMetrics } from '../../shared/types';

const router = Router();
const submitLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 15, message: 'Trop d’envois. Réessaie dans quelques minutes.' });

const formInput = z.object({
  title: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional().default(''),
  fields_json: z.string().optional().default('[]'),
  success_message: z.string().optional().default('Merci, votre réponse a bien été enregistrée.'),
  published: z.coerce.number().int().min(0).max(1).default(1),
});

function parseFields(json: string): FormField[] {
  try { const a = JSON.parse(json || '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
}
function safeParse(json: string): Record<string, unknown> {
  try { const o = JSON.parse(json || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; }
}
function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (Array.isArray(v)) return v.length === 0;
  return String(v).trim() === '';
}

// ===== Admin CRUD =====
router.get('/api/admin/forms', requireAuth, (_req, res) => {
  res.json(db.select({
    id: forms.id, title: forms.title, slug: forms.slug, description: forms.description, published: forms.published,
    submissions_count: sql<number>`(SELECT COUNT(*) FROM form_submissions WHERE form_submissions.form_id = forms.id)`,
  }).from(forms).orderBy(desc(forms.id)).all());
});

router.get('/api/admin/forms/:id', requireAuth, (req, res) => {
  const form = db.select().from(forms).where(eq(forms.id, parseId(String(req.params.id)))).get();
  if (!form) throw notFound('Formulaire introuvable');
  res.json(form);
});

router.post('/api/admin/forms', requireAuth, (req, res) => {
  const data = parseBody(formInput, req.body);
  const slug = slugify(data.slug || data.title);
  try {
    const rec = db.insert(forms).values({ title: data.title, slug, description: data.description, fields_json: data.fields_json, success_message: data.success_message, published: data.published }).returning().get();
    res.status(201).json(rec);
  } catch { throw conflict('Slug déjà utilisé'); }
});

router.put('/api/admin/forms/:id', requireAuth, (req, res) => {
  const id = parseId(String(req.params.id));
  const data = parseBody(formInput, req.body);
  const slug = slugify(data.slug || data.title);
  const updated = db.update(forms).set({ title: data.title, slug, description: data.description, fields_json: data.fields_json, success_message: data.success_message, published: data.published, updated_at: sql`CURRENT_TIMESTAMP` }).where(eq(forms.id, id)).returning().get();
  if (!updated) throw notFound('Formulaire introuvable');
  res.json(updated);
});

router.delete('/api/admin/forms/:id', requireAuth, (req, res) => {
  const id = parseId(String(req.params.id));
  db.delete(form_submissions).where(eq(form_submissions.form_id, id)).run();
  db.delete(forms).where(eq(forms.id, id)).run();
  res.json({ ok: true });
});

// ===== Réponses =====
router.get('/api/admin/forms/:id/submissions', requireAuth, (req, res) => {
  const id = parseId(String(req.params.id));
  const rows = db.select().from(form_submissions).where(eq(form_submissions.form_id, id)).orderBy(desc(form_submissions.id)).all();
  res.json(rows.map(r => ({ id: r.id, created_at: r.created_at, payload: safeParse(r.payload_json) })));
});

router.delete('/api/admin/forms/:id/submissions/:sid', requireAuth, (req, res) => {
  db.delete(form_submissions).where(eq(form_submissions.id, parseId(String(req.params.sid)))).run();
  res.json({ ok: true });
});

// ===== Métriques =====
function computeFieldMetric(f: FormField, payloads: Record<string, unknown>[]): FormFieldMetric {
  const values = payloads.map(p => p[f.name]).filter(v => !isEmpty(v));
  const m: FormFieldMetric = { name: f.name, label: f.label, type: f.type, answered: values.length };
  if (FORM_OPTION_TYPES.includes(f.type)) {
    const counts = new Map<string, number>();
    for (const o of f.options) counts.set(o, 0);
    for (const v of values) {
      const arr = Array.isArray(v) ? v.map(String) : [String(v)];
      for (const a of arr) counts.set(a, (counts.get(a) || 0) + 1);
    }
    m.options = Array.from(counts.entries()).map(([label, count]) => ({ label, count }));
  } else if (f.type === 'number') {
    const nums = values.map(v => Number(v)).filter(n => Number.isFinite(n));
    m.number = nums.length
      ? { count: nums.length, avg: Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100, min: Math.min(...nums), max: Math.max(...nums) }
      : { count: 0, avg: 0, min: 0, max: 0 };
  } else {
    m.samples = values.slice(0, 10).map(v => String(v));
  }
  return m;
}

router.get('/api/admin/forms/:id/metrics', requireAuth, (req, res) => {
  const id = parseId(String(req.params.id));
  const form = db.select().from(forms).where(eq(forms.id, id)).get();
  if (!form) throw notFound('Formulaire introuvable');
  const fields = parseFields(form.fields_json).filter(f => f.type !== 'heading');
  const payloads = db.select().from(form_submissions).where(eq(form_submissions.form_id, id)).all().map(s => safeParse(s.payload_json));
  const out: FormMetrics = { total: payloads.length, fields: fields.map(f => computeFieldMetric(f, payloads)) };
  res.json(out);
});

// ===== Public =====
router.get('/api/public/forms/:slug', requireFeature('forms'), (req, res) => {
  const form = db.select().from(forms).where(and(eq(forms.slug, String(req.params.slug)), eq(forms.published, 1))).get();
  if (!form) throw notFound('Formulaire introuvable');
  res.json({ id: form.id, title: form.title, slug: form.slug, description: form.description, success_message: form.success_message, fields: parseFields(form.fields_json) });
});

router.post('/api/public/forms/:slug/submit', requireFeature('forms'), submitLimiter, asyncHandler(async (req, res) => {
  const form = db.select().from(forms).where(and(eq(forms.slug, String(req.params.slug)), eq(forms.published, 1))).get();
  if (!form) throw notFound('Formulaire introuvable');
  const fields = parseFields(form.fields_json).filter(f => f.type !== 'heading');
  const payload = (req.body && typeof req.body.payload === 'object' && req.body.payload) ? req.body.payload as Record<string, unknown> : {};
  const missing = fields.filter(f => f.required && isEmpty(payload[f.name])).map(f => f.label);
  if (missing.length) throw badRequest(`Champs requis manquants : ${missing.join(', ')}`);
  const clean: Record<string, unknown> = {};
  for (const f of fields) if (f.name in payload) clean[f.name] = payload[f.name];
  db.insert(form_submissions).values({ form_id: form.id, payload_json: JSON.stringify(clean) }).run();

  // Emailing automatique
  const cfg = readEmailSettings();
  if (cfg.notifyOnForm && cfg.notifyTo) {
    const rows = fields.map(f => ({ label: f.label, value: Array.isArray(clean[f.name]) ? (clean[f.name] as string[]).join(', ') : String(clean[f.name] ?? '') }));
    await sendTransactionalEmail({ to: cfg.notifyTo, subject: `Nouvelle réponse — ${form.title}`, html: buildKeyValuesEmailHtml(`Nouvelle réponse — ${form.title}`, '', rows), eventType: 'form_submission' });
  }
  if (cfg.ackToSubmitter) {
    const emailField = fields.find(f => f.type === 'email');
    const addr = emailField ? String(clean[emailField.name] || '').trim() : '';
    if (addr) await sendTransactionalEmail({ to: addr, subject: `Confirmation — ${form.title}`, html: `<h1>Merci !</h1><p>${form.success_message}</p>`, eventType: 'form_ack' });
  }

  res.status(201).json({ ok: true, success_message: form.success_message });
}));

export default router;

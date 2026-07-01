import { Router } from 'express';
import { z } from 'zod';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { quote_forms, quote_submissions } from '../db/schema';
import { requireAuth } from '../lib/auth';
import { slugify } from '../lib/utils';

const router = Router();

const quoteFormInput = z.object({
  title: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional().default(''),
  intro_html: z.string().optional().default(''),
  cta_label: z.string().optional().default('Envoyer ma demande'),
  success_message: z.string().optional().default('Votre demande de devis a bien été envoyée.'),
  recipient_email: z.string().optional().default(''),
  fields_json: z.string().optional().default('[]'),
  blocks_json: z.string().optional().default('[]'),
  published: z.coerce.number().int().min(0).max(1).default(1),
});

router.get('/api/admin/quote-forms', requireAuth, (_req, res) => {
  const forms = db.select({
    id: quote_forms.id,
    title: quote_forms.title,
    slug: quote_forms.slug,
    description: quote_forms.description,
    published: quote_forms.published,
    submissions_count: sql<number>`(SELECT COUNT(*) FROM quote_submissions WHERE quote_form_id = ${quote_forms.id})`.as('submissions_count'),
  }).from(quote_forms).orderBy(desc(quote_forms.id)).all();
  res.json(forms);
});

router.get('/api/admin/quote-forms/:id', requireAuth, (req, res) => {
  const form = db.select().from(quote_forms).where(eq(quote_forms.id, Number(req.params.id))).get();
  if (!form) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(form);
});

router.post('/api/admin/quote-forms', requireAuth, (req, res) => {
  const parsed = quoteFormInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const data = parsed.data;
  const slug = slugify(data.slug || data.title);
  try {
    const result = db.insert(quote_forms).values({ ...data, slug }).returning().get();
    res.status(201).json(result);
  } catch (e: any) {
    res.status(409).json({ error: 'Slug déjà utilisé', detail: e.message });
  }
});

router.put('/api/admin/quote-forms/:id', requireAuth, (req, res) => {
  const parsed = quoteFormInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const data = parsed.data;
  const slug = slugify(data.slug || data.title);
  const updated = db.update(quote_forms).set({ ...data, slug, updated_at: sql`CURRENT_TIMESTAMP` }).where(eq(quote_forms.id, Number(req.params.id))).returning().get();
  if (!updated) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(updated);
});

router.delete('/api/admin/quote-forms/:id', requireAuth, (req, res) => {
  db.delete(quote_forms).where(eq(quote_forms.id, Number(req.params.id))).run();
  res.json({ ok: true });
});

// ===== Submissions =====
router.get('/api/admin/quote-submissions', requireAuth, (_req, res) => {
  const list = db.select({
    id: quote_submissions.id,
    customer_name: quote_submissions.customer_name,
    customer_email: quote_submissions.customer_email,
    customer_company: quote_submissions.customer_company,
    status: quote_submissions.status,
    created_at: quote_submissions.created_at,
    computed_total_cents: quote_submissions.computed_total_cents,
    form_title: quote_forms.title,
    form_slug: quote_forms.slug,
  }).from(quote_submissions).innerJoin(quote_forms, eq(quote_forms.id, quote_submissions.quote_form_id)).orderBy(desc(quote_submissions.id)).all();
  res.json(list);
});

router.get('/api/admin/quote-submissions/:id', requireAuth, (req, res) => {
  const sub = db.select({
    id: quote_submissions.id,
    customer_name: quote_submissions.customer_name,
    customer_email: quote_submissions.customer_email,
    customer_company: quote_submissions.customer_company,
    payload_json: quote_submissions.payload_json,
    notes: quote_submissions.notes,
    status: quote_submissions.status,
    created_at: quote_submissions.created_at,
    computed_total_cents: quote_submissions.computed_total_cents,
    form_title: quote_forms.title,
    form_slug: quote_forms.slug,
  }).from(quote_submissions).innerJoin(quote_forms, eq(quote_forms.id, quote_submissions.quote_form_id)).where(eq(quote_submissions.id, Number(req.params.id))).get();
  if (!sub) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(sub);
});

router.delete('/api/admin/quote-submissions/:id', requireAuth, (req, res) => {
  db.delete(quote_submissions).where(eq(quote_submissions.id, Number(req.params.id))).run();
  res.json({ ok: true });
});

export default router;

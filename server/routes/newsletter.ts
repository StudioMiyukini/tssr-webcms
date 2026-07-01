import { Router } from 'express';
import { z } from 'zod';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { email_templates, campaigns, customers, forms, form_submissions } from '../db/schema';
import { requireAuth } from '../lib/auth';
import { parseBody, parseId, notFound, asyncHandler } from '../lib/http';
import { sendTransactionalEmail } from '../lib/email';

const router = Router();
const MAX_RECIPIENTS = 2000;

interface Recipient { email: string; name: string; }

function dedupe(list: Recipient[]): Recipient[] {
  const seen = new Set<string>();
  return list.filter(r => {
    const k = r.email.toLowerCase();
    if (!r.email.includes('@') || seen.has(k)) return false;
    seen.add(k); return true;
  });
}

function resolveRecipients(source: string, formId?: number, emails?: string[]): Recipient[] {
  if (source === 'customers') {
    return dedupe(db.select({ email: customers.email, name: customers.name }).from(customers).all().map(r => ({ email: String(r.email || ''), name: String(r.name || '') })));
  }
  if (source === 'form' && formId) {
    const form = db.select().from(forms).where(eq(forms.id, formId)).get();
    if (!form) return [];
    let fields: any[] = [];
    try { fields = JSON.parse(form.fields_json || '[]'); } catch { fields = []; }
    const emailField = fields.find(f => f?.type === 'email');
    if (!emailField) return [];
    const nameField = fields.find(f => f?.type === 'text');
    const out: Recipient[] = [];
    for (const s of db.select().from(form_submissions).where(eq(form_submissions.form_id, formId)).all()) {
      try {
        const p = JSON.parse(s.payload_json || '{}');
        const email = String(p[emailField.name] || '').trim();
        if (email) out.push({ email, name: nameField ? String(p[nameField.name] || '') : '' });
      } catch { /* ignore */ }
    }
    return dedupe(out);
  }
  if (source === 'manual' && Array.isArray(emails)) {
    return dedupe(emails.map(e => ({ email: String(e).trim(), name: '' })));
  }
  return [];
}

const applyVars = (str: string, r: Recipient) =>
  str.replace(/\{\{\s*name\s*\}\}/g, r.name || '').replace(/\{\{\s*email\s*\}\}/g, r.email);

// ===== Modèles d'email =====
const templateInput = z.object({ name: z.string().min(1), subject: z.string().optional().default(''), body_html: z.string().optional().default('') });

router.get('/api/admin/email-templates', requireAuth, (_req, res) => {
  res.json(db.select().from(email_templates).orderBy(desc(email_templates.id)).all());
});
router.get('/api/admin/email-templates/:id', requireAuth, (req, res) => {
  const t = db.select().from(email_templates).where(eq(email_templates.id, parseId(String(req.params.id)))).get();
  if (!t) throw notFound('Modèle introuvable');
  res.json(t);
});
router.post('/api/admin/email-templates', requireAuth, (req, res) => {
  const data = parseBody(templateInput, req.body);
  res.status(201).json(db.insert(email_templates).values(data).returning().get());
});
router.put('/api/admin/email-templates/:id', requireAuth, (req, res) => {
  const id = parseId(String(req.params.id));
  const data = parseBody(templateInput, req.body);
  const updated = db.update(email_templates).set({ ...data, updated_at: sql`CURRENT_TIMESTAMP` }).where(eq(email_templates.id, id)).returning().get();
  if (!updated) throw notFound('Modèle introuvable');
  res.json(updated);
});
router.delete('/api/admin/email-templates/:id', requireAuth, (req, res) => {
  db.delete(email_templates).where(eq(email_templates.id, parseId(String(req.params.id)))).run();
  res.json({ ok: true });
});

// ===== Newsletter / envoi groupé =====
const audienceQuery = z.object({ source: z.enum(['customers', 'form', 'manual']), formId: z.coerce.number().int().optional() });

router.get('/api/admin/newsletter/audience', requireAuth, (req, res) => {
  const { source, formId } = audienceQuery.parse({ source: req.query.source, formId: req.query.formId });
  const list = resolveRecipients(source, formId);
  res.json({ count: list.length, sample: list.slice(0, 5).map(r => r.email) });
});

const sendSchema = z.object({
  subject: z.string().min(1),
  body_html: z.string().min(1),
  source: z.enum(['customers', 'form', 'manual']),
  formId: z.coerce.number().int().optional(),
  emails: z.array(z.string()).optional(),
});

router.post('/api/admin/newsletter/send', requireAuth, asyncHandler(async (req, res) => {
  const data = parseBody(sendSchema, req.body);
  let recipients = resolveRecipients(data.source, data.formId, data.emails);
  const capped = recipients.length > MAX_RECIPIENTS;
  if (capped) recipients = recipients.slice(0, MAX_RECIPIENTS);

  let sent = 0, skipped = 0, failed = 0;
  for (const r of recipients) {
    const result = await sendTransactionalEmail({
      to: r.email,
      subject: applyVars(data.subject, r),
      html: applyVars(data.body_html, r),
      eventType: 'newsletter',
    });
    if (result.ok) sent++; else if (result.skipped) skipped++; else failed++;
  }

  const audience = data.source === 'form' ? `form:${data.formId}` : data.source;
  db.insert(campaigns).values({ subject: data.subject, audience, recipients: recipients.length, sent, skipped, failed }).run();
  res.json({ recipients: recipients.length, sent, skipped, failed, capped });
}));

router.get('/api/admin/newsletter/campaigns', requireAuth, (_req, res) => {
  res.json(db.select().from(campaigns).orderBy(desc(campaigns.id)).limit(50).all());
});

export default router;

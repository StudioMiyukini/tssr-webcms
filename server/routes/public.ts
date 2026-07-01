import { Router } from 'express';
import { z } from 'zod';
import { asc, desc, eq, and } from 'drizzle-orm';
import { db } from '../db/client';
import { pages, menu_items, products, quote_forms, quote_submissions } from '../db/schema';
import { parseFields, parseBlocks, blocksToFields, computeQuoteTotal } from './_quote-utils';
import { requireFeature } from './settings';
import { rateLimit } from '../lib/rate-limit';
import { readEmailSettings, sendTransactionalEmail, buildKeyValuesEmailHtml } from '../lib/email';

const router = Router();
const quoteLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 15, message: 'Trop d’envois. Réessaie dans quelques minutes.' });

// ===== Menus =====
router.get('/api/public/menus', (_req, res) => {
  const items = db.select().from(menu_items).orderBy(asc(menu_items.sort_order), asc(menu_items.id)).all();
  res.json(items);
});

// ===== Pages =====
// Lecture publique : on ne renvoie pas builder_json (données d'éditeur lourdes, inutiles côté public).
const PAGE_PUBLIC_COLS = { id: pages.id, title: pages.title, slug: pages.slug, content: pages.content, excerpt: pages.excerpt, published: pages.published, updated_at: pages.updated_at };
router.get('/api/public/pages/:slug', (req, res) => {
  const page = db.select(PAGE_PUBLIC_COLS).from(pages).where(and(eq(pages.slug, req.params.slug), eq(pages.published, 1))).get();
  if (!page) { res.status(404).json({ error: 'Page introuvable' }); return; }
  res.json(page);
});

// ===== Products =====
router.get('/api/public/products', requireFeature('shop'), (req, res) => {
  const category = String(req.query.category || '').trim();
  const where = category
    ? and(eq(products.published, 1), eq(products.category, category))
    : eq(products.published, 1);
  const list = db.select().from(products).where(where).orderBy(desc(products.featured), desc(products.id)).all();
  res.json(list);
});

router.get('/api/public/products/:slug', requireFeature('shop'), (req, res) => {
  const product = db.select().from(products).where(and(eq(products.slug, String(req.params.slug)), eq(products.published, 1))).get();
  if (!product) { res.status(404).json({ error: 'Produit introuvable' }); return; }
  const related = db.select().from(products)
    .where(and(eq(products.published, 1)))
    .orderBy(desc(products.featured), desc(products.id))
    .limit(6)
    .all()
    .filter(p => p.id !== product.id)
    .slice(0, 3);
  res.json({ product, related });
});

router.get('/api/public/categories', requireFeature('shop'), (_req, res) => {
  const list = db.select().from(products).where(eq(products.published, 1)).all();
  const cats = Array.from(new Set(list.map(p => p.category).filter(Boolean))).sort();
  res.json(cats);
});

// ===== Quote forms =====
router.get('/api/public/quote-forms/:slug', requireFeature('quotes'), (req, res) => {
  const form = db.select().from(quote_forms).where(and(eq(quote_forms.slug, String(req.params.slug)), eq(quote_forms.published, 1))).get();
  if (!form) { res.status(404).json({ error: 'Formulaire introuvable' }); return; }
  const blocks = parseBlocks(form.blocks_json);
  const fields = blocks.length > 0 ? blocksToFields(blocks) : parseFields(form.fields_json);
  res.json({ form, blocks, fields });
});

const submitSchema = z.object({
  customer_name: z.string().min(1),
  customer_email: z.string().email(),
  customer_phone: z.string().optional().default(''),
  customer_company: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  payload: z.record(z.string(), z.any()),
});

router.post('/api/public/quote-forms/:slug/submit', requireFeature('quotes'), quoteLimiter, async (req, res) => {
  const form = db.select().from(quote_forms).where(and(eq(quote_forms.slug, String(req.params.slug)), eq(quote_forms.published, 1))).get();
  if (!form) { res.status(404).json({ error: 'Formulaire introuvable' }); return; }
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const blocks = parseBlocks(form.blocks_json);
  const fields = blocks.length > 0 ? blocksToFields(blocks) : parseFields(form.fields_json);
  const missing = fields.filter(f => f.required && !String(parsed.data.payload[f.name] || '').trim()).map(f => f.label);
  if (missing.length) { res.status(400).json({ error: `Champs requis manquants : ${missing.join(', ')}` }); return; }
  const computedTotalCents = blocks.length > 0 ? computeQuoteTotal(blocks, parsed.data.payload) : 0;
  const inserted = db.insert(quote_submissions).values({
    quote_form_id: form.id,
    customer_name: parsed.data.customer_name,
    customer_email: parsed.data.customer_email,
    customer_company: parsed.data.customer_company,
    payload_json: JSON.stringify({ ...parsed.data.payload, customer_phone: parsed.data.customer_phone }),
    notes: parsed.data.notes,
    computed_total_cents: computedTotalCents,
  }).returning().get();
  const emailCfg = readEmailSettings();
  if (emailCfg.notifyOnQuote && emailCfg.notifyTo) {
    const rows = [
      { label: 'Client', value: parsed.data.customer_name },
      { label: 'Email', value: parsed.data.customer_email },
      ...fields.map(f => ({ label: f.label, value: String(parsed.data.payload[f.name] ?? '') })),
    ];
    await sendTransactionalEmail({ to: emailCfg.notifyTo, subject: `Nouvelle demande de devis — ${form.title}`, html: buildKeyValuesEmailHtml(`Nouvelle demande — ${form.title}`, '', rows), eventType: 'quote_submission' });
  }
  res.status(201).json({ ok: true, id: inserted.id, success_message: form.success_message, computed_total_cents: computedTotalCents });
});

export default router;

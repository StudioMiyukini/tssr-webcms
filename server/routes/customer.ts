import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { eq, desc, asc, and, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { customers, orders, order_items, user_files } from '../db/schema';
import { requireCustomerAuth, isCustomerAuthed } from '../lib/auth';
import { streamInvoicePdf } from '../lib/invoice';
import { rateLimit } from '../lib/rate-limit';
import { parseBody, parseId, badRequest, notFound } from '../lib/http';
import { CLOUD_DIR } from '../env';

const router = Router();
fs.mkdirSync(CLOUD_DIR, { recursive: true });

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 15, message: 'Trop de tentatives. Réessaie plus tard.' });

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional().default(''),
  company: z.string().optional().default(''),
  address: z.string().optional().default(''),
});

router.post('/api/customer/register', authLimiter, (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const email = parsed.data.email.toLowerCase().trim();
  const existing = db.select().from(customers).where(eq(customers.email, email)).get();
  if (existing) { res.status(409).json({ error: 'Email déjà utilisé' }); return; }
  const hash = bcrypt.hashSync(parsed.data.password, 10);
  const c = db.insert(customers).values({
    name: parsed.data.name,
    email,
    password_hash: hash,
    phone: parsed.data.phone,
    company: parsed.data.company,
    address: parsed.data.address,
  }).returning().get();
  req.session.customer = { id: c.id, name: c.name, email: c.email, phone: c.phone, company: c.company, address: c.address };
  res.status(201).json({ id: c.id, name: c.name, email: c.email });
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

router.post('/api/customer/login', authLimiter, (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Identifiants invalides' }); return; }
  const c = db.select().from(customers).where(eq(customers.email, parsed.data.email.toLowerCase().trim())).get();
  if (!c || !bcrypt.compareSync(parsed.data.password, c.password_hash)) { res.status(401).json({ error: 'Identifiants invalides' }); return; }
  req.session.customer = { id: c.id, name: c.name, email: c.email, phone: c.phone, company: c.company, address: c.address };
  res.json({ id: c.id, name: c.name, email: c.email });
});

router.post('/api/customer/logout', (req, res) => {
  req.session.customer = null;
  res.json({ ok: true });
});

router.get('/api/customer/me', (req, res) => {
  if (!isCustomerAuthed(req)) { res.status(401).json({ error: 'Not authenticated' }); return; }
  res.json(req.session.customer);
});

// ===== Profil =====
const profileSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(60).optional().default(''),
  company: z.string().max(200).optional().default(''),
  address: z.string().max(1000).optional().default(''),
});
router.put('/api/customer/me', requireCustomerAuth, (req, res) => {
  const d = parseBody(profileSchema, req.body);
  const id = req.session.customer!.id;
  const c = db.update(customers).set({ name: d.name, phone: d.phone, company: d.company, address: d.address, updated_at: sql`CURRENT_TIMESTAMP` }).where(eq(customers.id, id)).returning().get();
  if (!c) throw notFound('Profil introuvable');
  req.session.customer = { id: c.id, name: c.name, email: c.email, phone: c.phone, company: c.company, address: c.address };
  res.json(req.session.customer);
});

const passwordSchema = z.object({ current: z.string().min(1), next: z.string().min(8) });
router.put('/api/customer/password', requireCustomerAuth, (req, res) => {
  const d = parseBody(passwordSchema, req.body);
  const id = req.session.customer!.id;
  const c = db.select().from(customers).where(eq(customers.id, id)).get();
  if (!c || !bcrypt.compareSync(d.current, c.password_hash)) { res.status(403).json({ error: 'Mot de passe actuel incorrect' }); return; }
  db.update(customers).set({ password_hash: bcrypt.hashSync(d.next, 10), updated_at: sql`CURRENT_TIMESTAMP` }).where(eq(customers.id, id)).run();
  res.json({ ok: true });
});

// ===== Cloud privé par profil (fichiers stockés sous CLOUD_DIR/<customerId>, jamais servis statiquement) =====
const CLOUD_MAX = 24 * 1024 * 1024; // 24 Mo par fichier (limite JSON 32mb dans index.ts)
const uploadSchema = z.object({ filename: z.string().min(1).max(255), dataUrl: z.string().min(1) });
const safeExt = (name: string) => { const m = name.match(/\.([a-zA-Z0-9]{1,8})$/); return m ? m[1].toLowerCase() : 'bin'; };
const fileDir = (cid: number) => { const d = path.join(CLOUD_DIR, String(cid)); fs.mkdirSync(d, { recursive: true }); return d; };

router.get('/api/customer/cloud', requireCustomerAuth, (req, res) => {
  const cid = req.session.customer!.id;
  const files = db.select().from(user_files).where(eq(user_files.customer_id, cid)).orderBy(desc(user_files.id)).all();
  res.json(files.map(f => ({ id: f.id, original_name: f.original_name, mime: f.mime, size: f.size, created_at: f.created_at })));
});

router.post('/api/customer/cloud', requireCustomerAuth, (req, res) => {
  const cid = req.session.customer!.id;
  const data = parseBody(uploadSchema, req.body);
  const m = data.dataUrl.match(/^data:([\w/+.\-]*);base64,(.+)$/s);
  if (!m) throw badRequest('Fichier invalide : data URL base64 attendue.');
  const mime = (m[1] || 'application/octet-stream').toLowerCase();
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length) throw badRequest('Fichier vide.');
  if (buf.length > CLOUD_MAX) throw badRequest('Fichier trop volumineux (max 24 Mo).');
  const base = data.filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 60) || 'fichier';
  const stored = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${base}.${safeExt(data.filename)}`;
  fs.writeFileSync(path.join(fileDir(cid), stored), buf);
  const rec = db.insert(user_files).values({ customer_id: cid, original_name: data.filename, stored_name: stored, mime, size: buf.length }).returning().get();
  res.status(201).json({ id: rec.id, original_name: rec.original_name, mime: rec.mime, size: rec.size, created_at: rec.created_at });
});

router.get('/api/customer/cloud/:id/download', requireCustomerAuth, (req, res) => {
  const cid = req.session.customer!.id;
  const f = db.select().from(user_files).where(and(eq(user_files.id, parseId(String(req.params.id))), eq(user_files.customer_id, cid))).get();
  if (!f) throw notFound('Fichier introuvable');
  const abs = path.join(CLOUD_DIR, String(cid), f.stored_name);
  if (!fs.existsSync(abs)) throw notFound('Fichier absent du stockage');
  res.setHeader('Content-Type', f.mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(f.original_name)}`);
  fs.createReadStream(abs).pipe(res);
});

router.delete('/api/customer/cloud/:id', requireCustomerAuth, (req, res) => {
  const cid = req.session.customer!.id;
  const f = db.select().from(user_files).where(and(eq(user_files.id, parseId(String(req.params.id))), eq(user_files.customer_id, cid))).get();
  if (!f) throw notFound('Fichier introuvable');
  try { fs.unlinkSync(path.join(CLOUD_DIR, String(cid), f.stored_name)); } catch { /* déjà absent */ }
  db.delete(user_files).where(eq(user_files.id, f.id)).run();
  res.json({ ok: true });
});

router.get('/api/customer/orders', requireCustomerAuth, (req, res) => {
  const list = db.select().from(orders).where(eq(orders.customer_id, req.session.customer!.id)).orderBy(desc(orders.id)).all();
  res.json(list);
});

router.get('/api/customer/orders/:id', requireCustomerAuth, (req, res) => {
  const id = Number(req.params.id);
  const order = db.select().from(orders).where(and(eq(orders.id, id), eq(orders.customer_id, req.session.customer!.id))).get();
  if (!order) { res.status(404).json({ error: 'Not found' }); return; }
  const items = db.select().from(order_items).where(eq(order_items.order_id, id)).orderBy(asc(order_items.id)).all();
  res.json({ order, items });
});

router.get('/api/customer/orders/:id/invoice.pdf', requireCustomerAuth, (req, res) => {
  const id = Number(req.params.id);
  const order = db.select().from(orders).where(and(eq(orders.id, id), eq(orders.customer_id, req.session.customer!.id))).get();
  if (!order) { res.status(404).json({ error: 'Not found' }); return; }
  const items = db.select().from(order_items).where(eq(order_items.order_id, id)).orderBy(asc(order_items.id)).all();
  streamInvoicePdf(res, order, items as any);
});

export default router;

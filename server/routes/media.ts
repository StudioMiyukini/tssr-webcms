import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/client';
import { media } from '../db/schema';
import { requireAuth } from '../lib/auth';
import { parseBody, parseId, badRequest, notFound } from '../lib/http';
import { UPLOADS_DIR } from '../env';

const router = Router();
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/avif': 'avif',
};
const MAX_BYTES = 12 * 1024 * 1024;

const uploadSchema = z.object({
  filename: z.string().min(1).max(200),
  dataUrl: z.string().min(1),
});

// Upload (data URL base64 — pas de dépendance multipart). Limite portée à 16mb dans index.ts.
router.post('/api/admin/media', requireAuth, (req, res) => {
  const data = parseBody(uploadSchema, req.body);
  const m = data.dataUrl.match(/^data:([\w/+.-]+);base64,(.+)$/s);
  if (!m) throw badRequest('Fichier invalide : data URL base64 attendue.');
  const mime = m[1].toLowerCase();
  const ext = MIME_EXT[mime];
  if (!ext) throw badRequest('Type non supporté (JPEG, PNG, GIF, WebP, SVG, AVIF).');
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length) throw badRequest('Fichier vide.');
  if (buf.length > MAX_BYTES) throw badRequest('Image trop volumineuse (max 12 Mo).');
  const base = data.filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 60) || 'image';
  const stored = `${Date.now().toString(36)}-${Math.abs(hash(data.filename + buf.length)).toString(36)}-${base}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, stored), buf);
  const rec = db.insert(media).values({
    filename: stored, original_name: data.filename, url: `/uploads/${stored}`, mime, size: buf.length,
  }).returning().get();
  res.status(201).json(rec);
});

router.get('/api/admin/media', requireAuth, (_req, res) => {
  res.json(db.select().from(media).orderBy(desc(media.id)).all());
});

router.delete('/api/admin/media/:id', requireAuth, (req, res) => {
  const id = parseId(String(req.params.id));
  const rec = db.select().from(media).where(eq(media.id, id)).get();
  if (!rec) throw notFound('Média introuvable');
  try { fs.unlinkSync(path.join(UPLOADS_DIR, rec.filename)); } catch { /* fichier déjà absent */ }
  db.delete(media).where(eq(media.id, id)).run();
  res.json({ ok: true });
});

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
  return h;
}

export default router;

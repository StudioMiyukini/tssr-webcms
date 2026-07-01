import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { admins } from '../db/schema';
import { isAuthed } from '../lib/auth';
import { rateLimit } from '../lib/rate-limit';

const router = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Trop de tentatives de connexion. Réessaie dans quelques minutes.' });

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

router.post('/api/auth/login', loginLimiter, (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid payload' }); return; }
  const { username, password } = parsed.data;
  const admin = db.select().from(admins).where(eq(admins.username, username)).get();
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    res.status(401).json({ error: 'Identifiants invalides' });
    return;
  }
  req.session.admin = { id: admin.id, username: admin.username };
  res.json({ id: admin.id, username: admin.username });
});

router.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/api/auth/me', (req, res) => {
  if (!isAuthed(req)) { res.status(401).json({ error: 'Not authenticated' }); return; }
  res.json(req.session.admin);
});

export default router;

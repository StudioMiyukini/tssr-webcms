import { Router } from 'express';
import { z } from 'zod';
import { eq, and, asc, desc } from 'drizzle-orm';
import { db } from '../db/client';
import { comments, posts } from '../db/schema';
import { requireAuth } from '../lib/auth';
import { requireFeature } from './settings';
import { parseBody, parseId, notFound, asyncHandler } from '../lib/http';
import { readEmailSettings, sendTransactionalEmail, buildKeyValuesEmailHtml } from '../lib/email';
import { rateLimit } from '../lib/rate-limit';

const router = Router();
const commentLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 6, message: 'Trop de commentaires envoyés. Réessaie dans quelques minutes.' });

// ===== Admin (modération) =====
router.get('/api/admin/comments', requireAuth, (req, res) => {
  const status = String(req.query.status || '').trim();
  const rows = db.select({
    id: comments.id, post_id: comments.post_id, author: comments.author, email: comments.email,
    body: comments.body, status: comments.status, created_at: comments.created_at,
    post_title: posts.title, post_slug: posts.slug,
  }).from(comments).leftJoin(posts, eq(posts.id, comments.post_id)).orderBy(desc(comments.id)).all();
  res.json(status ? rows.filter(r => r.status === status) : rows);
});

router.post('/api/admin/comments/:id/approve', requireAuth, (req, res) => {
  const updated = db.update(comments).set({ status: 'approved' }).where(eq(comments.id, parseId(String(req.params.id)))).returning().get();
  if (!updated) throw notFound('Commentaire introuvable');
  res.json(updated);
});

router.delete('/api/admin/comments/:id', requireAuth, (req, res) => {
  db.delete(comments).where(eq(comments.id, parseId(String(req.params.id)))).run();
  res.json({ ok: true });
});

// ===== Public =====
const postBySlug = (slug: string) => db.select().from(posts).where(and(eq(posts.slug, slug), eq(posts.published, 1))).get();

router.get('/api/public/posts/:slug/comments', requireFeature('blog'), (req, res) => {
  const post = postBySlug(String(req.params.slug));
  if (!post) { res.json([]); return; }
  res.json(db.select({ id: comments.id, author: comments.author, body: comments.body, created_at: comments.created_at })
    .from(comments).where(and(eq(comments.post_id, post.id), eq(comments.status, 'approved'))).orderBy(asc(comments.id)).all());
});

const commentInput = z.object({
  author: z.string().min(1).max(120),
  email: z.string().max(200).optional().default(''),
  body: z.string().min(1).max(4000),
  website: z.string().optional().default(''), // honeypot : doit rester vide
});

router.post('/api/public/posts/:slug/comments', requireFeature('blog'), commentLimiter, asyncHandler(async (req, res) => {
  const post = postBySlug(String(req.params.slug));
  if (!post) throw notFound('Article introuvable');
  const data = parseBody(commentInput, req.body);
  // Honeypot : un bot remplit le champ caché → on simule un succès sans rien enregistrer.
  if (data.website.trim()) { res.status(201).json({ ok: true, message: 'Merci !' }); return; }
  db.insert(comments).values({ post_id: post.id, author: data.author, email: data.email, body: data.body, status: 'pending' }).run();
  const cfg = readEmailSettings();
  if (cfg.notifyTo) {
    await sendTransactionalEmail({
      to: cfg.notifyTo,
      subject: `Nouveau commentaire — ${post.title}`,
      html: buildKeyValuesEmailHtml(`Commentaire en attente — ${post.title}`, 'À modérer dans l’admin.', [
        { label: 'Auteur', value: data.author }, { label: 'Email', value: data.email }, { label: 'Message', value: data.body },
      ]),
      eventType: 'comment',
    });
  }
  res.status(201).json({ ok: true, message: 'Merci ! Ton commentaire sera publié après modération.' });
}));

export default router;

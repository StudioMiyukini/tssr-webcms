import { Router } from 'express';
import { like, or, eq, and, desc } from 'drizzle-orm';
import { db } from '../db/client';
import { pages, posts } from '../db/schema';
import { readFeatureFlags } from './settings';

const router = Router();

function snippet(html: string): string {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
}

router.get('/api/public/search', (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) { res.json({ items: [], total: 0, page: 1, pageSize: 10 }); return; }
  const term = `%${q.replace(/[%_\\]/g, '')}%`;
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  const out: Array<{ type: string; title: string; excerpt: string; url: string }> = [];

  const pg = db.select({ title: pages.title, slug: pages.slug, excerpt: pages.excerpt, content: pages.content })
    .from(pages).where(and(eq(pages.published, 1), or(like(pages.title, term), like(pages.content, term), like(pages.excerpt, term)))).limit(50).all();
  for (const p of pg) out.push({ type: 'Page', title: p.title, excerpt: p.excerpt || snippet(p.content), url: p.slug === 'accueil' ? '/' : `/${p.slug}` });

  if (readFeatureFlags().blog) {
    const ps = db.select({ title: posts.title, slug: posts.slug, excerpt: posts.excerpt, content: posts.content })
      .from(posts).where(and(eq(posts.published, 1), or(like(posts.title, term), like(posts.content, term), like(posts.excerpt, term)))).orderBy(desc(posts.id)).limit(50).all();
    for (const p of ps) out.push({ type: 'Article', title: p.title, excerpt: p.excerpt || snippet(p.content), url: `/blog/${p.slug}` });
  }

  res.json({ items: out.slice((page - 1) * pageSize, page * pageSize), total: out.length, page, pageSize });
});

export default router;

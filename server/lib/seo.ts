import { eq, and } from 'drizzle-orm';
import { db } from '../db/client';
import { pages, posts, events } from '../db/schema';
import { readThemeSettings } from '../routes/settings';
import { PUBLIC_BASE_URL } from '../env';

const BASE = PUBLIC_BASE_URL.replace(/\/+$/, '');
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const snippet = (html: string) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
const abs = (url: string) => (!url ? '' : /^https?:/i.test(url) ? url : BASE + (url.startsWith('/') ? url : `/${url}`));

export interface Meta { title: string; description: string; image: string; url: string; type: string; }

/** Résout les métadonnées (OG/SEO) d'une route publique à partir du contenu en base.
 *  Si `locked` (site privé non déverrouillé), on renvoie uniquement la marque — aucun extrait de contenu. */
export function resolveMeta(path: string, locked = false): Meta {
  const theme = readThemeSettings();
  const brand = theme.brandName || 'Mon Site';
  const base: Meta = { title: brand, description: '', image: abs(theme.faviconUrl || theme.logoUrl || ''), url: BASE + path, type: 'website' };
  if (locked) return base;
  try {
    let m: RegExpMatchArray | null;
    if ((m = path.match(/^\/blog\/([^/]+)$/)) && m[1] !== 'categorie') {
      const p = db.select().from(posts).where(and(eq(posts.slug, decodeURIComponent(m[1])), eq(posts.published, 1))).get();
      if (p) return { ...base, title: `${p.title} — ${brand}`, description: p.excerpt || snippet(p.content), image: abs(p.cover_url) || base.image, type: 'article' };
    } else if ((m = path.match(/^\/agenda\/([^/]+)$/))) {
      const ev = db.select().from(events).where(and(eq(events.slug, decodeURIComponent(m[1])), eq(events.published, 1))).get();
      if (ev) return { ...base, title: `${ev.title} — ${brand}`, description: snippet(ev.description), image: abs(ev.image_url) || base.image, type: 'article' };
    } else if (path === '/') {
      const p = db.select().from(pages).where(and(eq(pages.slug, 'accueil'), eq(pages.published, 1))).get();
      if (p) return { ...base, description: p.excerpt || snippet(p.content) };
    } else if (path === '/blog') {
      return { ...base, title: `Blog — ${brand}` };
    } else if ((m = path.match(/^\/([^/]+)$/))) {
      const p = db.select().from(pages).where(and(eq(pages.slug, decodeURIComponent(m[1])), eq(pages.published, 1))).get();
      if (p) return { ...base, title: `${p.title} — ${brand}`, description: p.excerpt || snippet(p.content) };
    }
  } catch { /* défaut */ }
  return base;
}

/** Génère les balises <title> + OpenGraph + Twitter. */
export function metaTags(m: Meta): string {
  const t = esc(m.title), d = esc(m.description), img = esc(m.image), url = esc(m.url);
  return [
    `<title>${t}</title>`,
    d && `<meta name="description" content="${d}"/>`,
    `<meta property="og:site_name" content="${esc(readThemeSettings().brandName || 'Mon Site')}"/>`,
    `<meta property="og:title" content="${t}"/>`,
    d && `<meta property="og:description" content="${d}"/>`,
    `<meta property="og:type" content="${esc(m.type)}"/>`,
    `<meta property="og:url" content="${url}"/>`,
    img && `<meta property="og:image" content="${img}"/>`,
    `<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}"/>`,
    `<meta name="twitter:title" content="${t}"/>`,
    d && `<meta name="twitter:description" content="${d}"/>`,
    img && `<meta name="twitter:image" content="${img}"/>`,
  ].filter(Boolean).join('\n    ');
}

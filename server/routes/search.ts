import { Router } from 'express';
import { rawDb } from '../db/client';
import { readFeatureFlags } from './settings';

const router = Router();

// Marqueurs de surlignage injectés par snippet() (SQL char(2)/char(3)) puis
// remplacés en sortie par <mark>…</mark>. Ces octets de contrôle sont retirés
// du contenu indexé, donc aucune collision possible.
const HL_OPEN = String.fromCharCode(2);
const HL_CLOSE = String.fromCharCode(3);

/** HTML → texte brut nettoyé (pour l'indexation et les extraits). */
function toText(html: string): string {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;|&rsquo;|&apos;/g, "'").replace(/&quot;|&laquo;|&raquo;/g, '"')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
/** Étiquette de catégorie déduite du slug de la page. */
function kindOf(slug: string): string {
  if (/^procedure-/.test(slug)) return 'Procédure';
  if (/^astuce-/.test(slug)) return 'Astuce';
  if (slug === 'cours' || slug === 'glossaire') return 'Index';
  return 'Cours';
}

let ftsReady = false;
let indexSig = '';

function ensureTable(): void {
  if (ftsReady) return;
  rawDb.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS search_fts USING fts5(
    url UNINDEXED, kind UNINDEXED, title, excerpt, body,
    tokenize='unicode61 remove_diacritics 2'
  );`);
  ftsReady = true;
}

/** Signature du contenu publié : détecte qu'une ré-indexation est nécessaire. */
function currentSignature(blog: boolean): string {
  const p = rawDb.prepare(`SELECT count(*) c, coalesce(max(updated_at),'') m FROM pages WHERE published=1`).get() as { c: number; m: string };
  let sig = `p:${p.c}:${p.m}`;
  if (blog) {
    const b = rawDb.prepare(`SELECT count(*) c, coalesce(max(updated_at),'') m FROM posts WHERE published=1`).get() as { c: number; m: string };
    sig += `|b:${b.c}:${b.m}`;
  }
  return sig;
}

/** (Re)construit l'index FTS depuis les pages (et articles si le blog est actif). */
function reindex(blog: boolean): void {
  ensureTable();
  const ins = rawDb.prepare(`INSERT INTO search_fts (url, kind, title, excerpt, body) VALUES (?, ?, ?, ?, ?)`);
  const tx = rawDb.transaction(() => {
    rawDb.exec('DELETE FROM search_fts;');
    const pg = rawDb.prepare(`SELECT slug, title, excerpt, content FROM pages WHERE published=1`).all() as Array<{ slug: string; title: string; excerpt: string; content: string }>;
    for (const p of pg) {
      const url = p.slug === 'accueil' ? '/' : `/${p.slug}`;
      ins.run(url, kindOf(p.slug), p.title || '', toText(p.excerpt || ''), toText(p.content || ''));
    }
    if (blog) {
      const ps = rawDb.prepare(`SELECT slug, title, excerpt, content FROM posts WHERE published=1`).all() as Array<{ slug: string; title: string; excerpt: string; content: string }>;
      for (const p of ps) ins.run(`/blog/${p.slug}`, 'Article', p.title || '', toText(p.excerpt || ''), toText(p.content || ''));
    }
  });
  tx();
}

/** Garantit un index à jour (ré-indexe si le contenu a changé). */
function ensureFresh(): void {
  const blog = Boolean(readFeatureFlags().blog);
  ensureTable();
  const sig = currentSignature(blog);
  if (sig !== indexSig) { reindex(blog); indexSig = sig; }
}

/** Construit l'expression FTS MATCH : chaque mot en préfixe, combinés en ET. */
function buildMatch(q: string): string {
  const tokens = q.toLowerCase().split(/[^\p{L}\p{N}]+/u).map(t => t.trim()).filter(t => t.length >= 1);
  if (!tokens.length) return '';
  return tokens.map(t => `${t}*`).join(' ');
}
/** Rend un extrait surligné (HTML sûr) à partir de la sortie de snippet(). */
function renderSnippet(snip: string, fallback: string): string {
  const raw = snip && snip.trim() ? snip : fallback;
  return escHtml(raw).split(HL_OPEN).join('<mark>').split(HL_CLOSE).join('</mark>');
}

router.get('/api/public/search', (req, res) => {
  const q = String(req.query.q || '').trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  if (q.length < 2) { res.json({ items: [], total: 0, page: 1, pageSize }); return; }

  const match = buildMatch(q);
  if (!match) { res.json({ items: [], total: 0, page, pageSize }); return; }

  let rows: Array<{ url: string; kind: string; title: string; excerpt: string; snip: string }> = [];
  try {
    ensureFresh();
    rows = rawDb.prepare(`
      SELECT url, kind, title, excerpt,
             snippet(search_fts, 4, char(2), char(3), '…', 14) AS snip,
             bm25(search_fts, 0.0, 0.0, 12.0, 5.0, 1.0) AS rank
      FROM search_fts
      WHERE search_fts MATCH ?
      ORDER BY rank
      LIMIT 60
    `).all(match) as typeof rows;
  } catch {
    rows = [];
  }

  const items = rows.map(r => {
    const plain = r.snip ? r.snip.split(HL_OPEN).join('').split(HL_CLOSE).join('') : '';
    return {
      type: r.kind,
      title: r.title,
      excerpt: (plain || r.excerpt || '').slice(0, 220),
      snippet: renderSnippet(r.snip, r.excerpt || ''),
      url: r.url,
    };
  });

  res.json({ items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize });
});

export default router;

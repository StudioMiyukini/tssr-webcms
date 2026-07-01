/* Refait la page Glossaire avec des blocs natifs du page builder (accordéon par catégorie).
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-glossaire-blocks.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { GLOSSARY, GLOSSARY_CATEGORIES } from '../client/src/lib/glossary-data';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);

const accItems = GLOSSARY_CATEGORIES.map(cat => {
  const terms = GLOSSARY.filter(t => t.category === cat.key);
  const html = terms.map(t => `<p><strong>${t.acronym}</strong> — <em>${t.name}</em><br>${t.definition}</p>`).join('');
  return { title: `${cat.label} (${terms.length})`, text: html, href: '' };
});

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'RNCP 37682', title: 'Glossaire TSSR', subtitle: 'Tous les acronymes et termes du métier — Technicien Supérieur Systèmes & Réseaux.' }),
  block('html', { html: `<p>Le vocabulaire essentiel, classé par catégorie. <strong>${GLOSSARY.length} termes</strong> répartis en ${GLOSSARY_CATEGORIES.length} familles. Clique sur une catégorie pour la déplier.</p>` }),
  block('accordion', { items: accItems }),
  block('html', { html: '<aside class="pb-note pb-note-green"><p class="pb-note-title">🧭 Astuce</p><p>Utilise <kbd>Ctrl+F</kbd> de ton navigateur pour rechercher un terme précis dans la page.</p></aside>' }),
];

function cookieFrom(res: Response): string {
  const sc = (res.headers as any).getSetCookie?.() as string[] | undefined;
  return (sc && sc.length ? sc : [res.headers.get('set-cookie') || '']).map(c => c.split(';')[0]).filter(Boolean).join('; ');
}
async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: PW }) });
  if (!login.ok) throw new Error(`login ${login.status}`);
  const cookie = cookieFrom(login);
  const h = { 'Content-Type': 'application/json', Cookie: cookie };
  const pages = await (await fetch(`${BASE}/api/admin/pages`, { headers: { Cookie: cookie } })).json() as Array<{ id: number; slug: string }>;
  const g = pages.find(p => p.slug === 'glossaire');
  const body = JSON.stringify({ title: 'Glossaire TSSR', slug: 'glossaire', excerpt: 'Glossaire des termes et acronymes TSSR (par catégorie).', content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1 });
  const res = g
    ? await fetch(`${BASE}/api/admin/pages/${g.id}`, { method: 'PUT', headers: h, body })
    : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log('PAGE glossaire', res.status, g ? '(maj)' : '(créée)', res.ok ? '' : await res.text());
  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

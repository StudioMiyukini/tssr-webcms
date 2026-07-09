/* Procédure « Plateforme 1 » : montage de l'infrastructure réalisée pendant l'exercice.
   Squelette — le contenu sera rédigé étape par étape (dicté par l'utilisateur).
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-procedure-plateforme-1.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'procedure-plateforme-1', title: 'Plateforme 1 — montage de l’infrastructure', excerpt: 'Procédure de bout en bout du montage de notre infrastructure « Plateforme 1 » réalisée pendant l’exercice : rédigée étape par étape.' };
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });

// ── Contenu ── (les étapes seront ajoutées ici au fur et à mesure)
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Procédure · Projet', title: 'Plateforme 1', subtitle: 'Montage de notre infrastructure, étape par étape, tel que réalisé pendant l’exercice.' }),
  note('yellow', '🚧 En cours de rédaction', '<p>Cette procédure sera <strong>complétée pas à pas</strong> : chaque étape du montage de la plateforme y sera ajoutée au fur et à mesure.</p>'),
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
  const existing = await (await fetch(`${BASE}/api/admin/pages`, { headers: { Cookie: cookie } })).json() as Array<{ id: number; slug: string }>;
  const cur = existing.find(e => e.slug === PAGE.slug);
  const body = JSON.stringify({ title: PAGE.title, slug: PAGE.slug, excerpt: PAGE.excerpt, content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1 });
  const res = cur ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body }) : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log(`PAGE ${PAGE.slug}`, res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());
  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

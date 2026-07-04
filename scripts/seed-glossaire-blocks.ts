/* Page Glossaire = îlot React interactif (data-block="glossaire") : recherche, filtres,
   cartes dépliables, renvois vers les cours, et deep-linking #gt-<slug> (déplie + défile
   jusqu'au terme). C'est la cible des auto-liens d'acronymes du site.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-glossaire-blocks.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);

const blocks: PageBlock[] = [
  block('html', { html: '<div class="pb-dynamic" data-block="glossaire"></div>' }),
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
  const body = JSON.stringify({ title: 'Glossaire TSSR', slug: 'glossaire', excerpt: 'Glossaire interactif des termes et acronymes TSSR : recherche, filtres, définitions et renvois vers les cours.', content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1 });
  const res = g
    ? await fetch(`${BASE}/api/admin/pages/${g.id}`, { method: 'PUT', headers: h, body })
    : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log('PAGE glossaire', res.status, g ? '(maj)' : '(créée)', res.ok ? '' : await res.text());
  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

/* Crée le hub « Exercices » (page slug 'exercices'), retire « À propos » du menu et y ajoute
   l'entrée « Exercices » (après « Cours »). Idempotent.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-exercices.ts */
import { renderPageBlocksToHtml, serializePageBlocks } from '../client/src/lib/page-blocks';
import { buildExercicesHub } from './_exercices-hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const MENU_LABEL = 'Exercices';
const MENU_URL = `${BASE}/pages/exercices`;

function cookieFrom(res: Response): string {
  const sc = (res.headers as any).getSetCookie?.() as string[] | undefined;
  return (sc && sc.length ? sc : [res.headers.get('set-cookie') || '']).map(c => c.split(';')[0]).filter(Boolean).join('; ');
}

async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: PW }) });
  if (!login.ok) throw new Error(`login ${login.status}`);
  const cookie = cookieFrom(login);
  const h = { 'Content-Type': 'application/json', Cookie: cookie };

  // 1) Page hub « Exercices »
  const pages = await (await fetch(`${BASE}/api/admin/pages`, { headers: { Cookie: cookie } })).json() as Array<{ id: number; slug: string }>;
  const blocks = buildExercicesHub();
  const body = JSON.stringify({ title: 'Exercices', slug: 'exercices', excerpt: 'Teste et consolide tes connaissances : quiz, exercices et jeux.', content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1 });
  const cur = pages.find(p => p.slug === 'exercices');
  const pr = cur
    ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body })
    : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log('PAGE exercices', pr.status, cur ? '(maj)' : '(créée)', pr.ok ? '' : await pr.text());

  // 2) Menu : supprimer « À propos », ajouter « Exercices »
  const menus = await (await fetch(`${BASE}/api/admin/menus`, { headers: { Cookie: cookie } })).json() as Array<{ id: number; label: string; url: string }>;
  for (const m of menus.filter(m => m.label.trim().toLowerCase() === 'à propos')) {
    const d = await fetch(`${BASE}/api/admin/menus/${m.id}`, { method: 'DELETE', headers: { Cookie: cookie } });
    console.log('MENU suppr. « À propos »', d.status);
  }
  const existingEx = menus.find(m => m.label === MENU_LABEL);
  if (existingEx) {
    const u = await fetch(`${BASE}/api/admin/menus/${existingEx.id}`, { method: 'PUT', headers: h, body: JSON.stringify({ label: MENU_LABEL, url: MENU_URL, sort_order: 2 }) });
    console.log('MENU « Exercices » (maj)', u.status);
  } else {
    const c = await fetch(`${BASE}/api/admin/menus`, { method: 'POST', headers: h, body: JSON.stringify({ label: MENU_LABEL, url: MENU_URL, sort_order: 2 }) });
    console.log('MENU « Exercices » (créé)', c.status);
  }

  // 3) Cache
  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

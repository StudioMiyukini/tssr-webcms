/* Page outil « Convertisseur hexadécimal ↔ texte / décimal » (îlot data-block="hex-converter").
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-convertisseur-hexa.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'convertisseur-hexa', title: 'Convertisseur hexadécimal ↔ texte / décimal', excerpt: 'Coller un dump hexadécimal (trame Wireshark) et lire son contenu en texte UTF-8/ASCII, décimal ou binaire. Convertit aussi Texte → hexa et décode le Base64 (ex. Authorization: Basic).' };
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Outil · Réseau', title: PAGE.title, subtitle: 'Lire ce que cachent les octets d’une trame : hexadécimal → texte, décimal, binaire (et Base64).' }),
  block('html', { html: '<p>Colle un <strong>dump hexadécimal</strong> (par exemple les octets d’une trame capturée dans Wireshark) : l’outil le convertit en <strong>texte UTF-8/ASCII</strong>, en <strong>décimal</strong> et en <strong>binaire</strong>. Il fait aussi l’inverse (<strong>Texte → hexa</strong>) et décode le <strong>Base64</strong>. Le collage tolère les espaces, les retours à la ligne, les <code>0x</code> et les <code>:</code>.</p>' }),
  block('html', { html: '<div class="pb-dynamic" data-block="hex-converter"></div>' }),
  note('blue', 'ℹ️ À quoi ça sert', '<p>En analyse de trames, le contenu applicatif (requête HTTP, nom DNS…) est en <strong>ASCII</strong> : le décoder révèle le message « en clair ». Le mode <strong>Base64 → texte</strong> décode un en-tête <code>Authorization: Basic &lt;valeur&gt;</code>, qui n’est <em>pas</em> chiffré et contient <code>identifiant:mot_de_passe</code> — d’où la nécessité du HTTPS. Cours associé : <a href="/pages/le-wireshark">Wireshark : capturer et analyser une trame</a>.</p>'),
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

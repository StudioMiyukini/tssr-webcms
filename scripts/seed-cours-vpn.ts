/* Cours « Le VPN ». Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-vpn.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'le-vpn', title: 'Le VPN (réseau privé virtuel)', excerpt: 'Créer un tunnel chiffré à travers Internet : VPN nomade (accès distant) vs site-à-site, notions de tunnel et de chiffrement, protocoles (IPsec, SSL/TLS, WireGuard). À quoi ça sert et comment ça marche.' };
const block = (t: Parameters<typeof makePageBlock>[0], p: Partial<PageBlock>) => Object.assign(makePageBlock(t), p);
const note = (c: string, t: string, h: string) => block('html', { html: `<aside class="pb-note pb-note-${c}"><p class="pb-note-title">${t}</p>${h}</aside>` });
const styleBlock = block('html', { html: `<style>.vp-t{border-collapse:collapse;width:100%;font-size:13px;margin:6px 0}.vp-t th,.vp-t td{border:1px solid var(--border);padding:7px 10px;text-align:left}.vp-t th{background:var(--surface-2)}</style>` });
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Réseau', title: PAGE.title, subtitle: 'Étendre le réseau de l’entreprise à travers Internet, en toute confidentialité.' }),
  styleBlock,
  block('html', { html: '<p>Un <strong>VPN</strong> (<em>Virtual Private Network</em>) crée un <strong>tunnel chiffré</strong> à travers un réseau public (Internet) : les données y circulent comme si les deux extrémités étaient sur le <strong>même réseau privé</strong>, à l’abri des regards. On <strong>encapsule</strong> (tunneling) et on <strong>chiffre</strong> chaque paquet.</p>' }),
  note('blue', '🎯 Deux grands usages', '<table class="vp-t"><thead><tr><th>Type</th><th>Relie</th><th>Exemple</th></tr></thead><tbody><tr><td><strong>Nomade (accès distant)</strong></td><td>un <strong>utilisateur</strong> à son entreprise</td><td>télétravail : le PC accède aux serveurs internes</td></tr><tr><td><strong>Site-à-site</strong></td><td>deux <strong>sites</strong> (routeurs/pare-feux)</td><td>relier le siège et une agence en permanence</td></tr></tbody></table>'),
  block('heading', { level: 2, text: '1) Le principe : tunnel + chiffrement' }),
  block('html', { html: '<p>Le paquet d’origine (avec l’adressage privé) est <strong>emballé</strong> dans un nouveau paquet à destination de l’autre extrémité du tunnel, et son contenu est <strong>chiffré</strong>. Un attaquant qui intercepte ne voit qu’un flux illisible entre deux passerelles. À l’arrivée, on déchiffre et on désencapsule.</p>' }),
  block('heading', { level: 2, text: '2) Les protocoles' }),
  block('html', { html: `<table class="vp-t"><thead><tr><th>Protocole</th><th>Profil</th></tr></thead><tbody>
    <tr><td><strong>IPsec</strong></td><td>standard du VPN <strong>site-à-site</strong> (chiffre au niveau IP). Souvent IKE + ESP.</td></tr>
    <tr><td><strong>SSL/TLS</strong> (OpenVPN, SSTP)</td><td>VPN <strong>nomade</strong>, passe facilement les pare-feux (port 443).</td></tr>
    <tr><td><strong>WireGuard</strong></td><td>moderne, simple et rapide (de plus en plus utilisé).</td></tr>
    <tr><td><strong>L2TP/IPsec, PPTP</strong></td><td>plus anciens (PPTP est <strong>obsolète</strong>, peu sûr).</td></tr>
  </tbody></table>` }),
  note('gray', '🔐 Ce que garantit un bon VPN', '<p><strong>Confidentialité</strong> (chiffrement), <strong>intégrité</strong> (les données n’ont pas été altérées) et <strong>authentification</strong> (on parle bien à la bonne extrémité — clés pré-partagées ou certificats).</p>'),
  block('heading', { level: 2, text: '3) Où on le met en place' }),
  block('html', { html: '<p>Sur un <strong>pare-feu / routeur</strong> (site-à-site : ex. tunnel IPsec entre deux routeurs), ou via un <strong>serveur d’accès distant</strong> (côté Windows : rôle <strong>RRAS</strong> ; côté Linux : OpenVPN/WireGuard) pour les utilisateurs nomades. L’utilisateur lance un <strong>client VPN</strong> qui monte le tunnel avant d’accéder aux ressources.</p>' }),
  note('green', '🔗 Liens', '<p><a href="/pages/le-pare-feu">Le pare-feu</a> · <a href="/pages/notions-complementaires">Notions clés (VPN, NAT, DMZ…)</a> · <a href="/pages/le-ssh">SSH</a> (tunnel chiffré ponctuel) · <a href="/pages/cisco-nat">NAT</a>.</p>'),
];
function cookieFrom(res: Response): string { const sc = (res.headers as any).getSetCookie?.() as string[] | undefined; return (sc && sc.length ? sc : [res.headers.get('set-cookie') || '']).map(c => c.split(';')[0]).filter(Boolean).join('; '); }
async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: PW }) });
  if (!login.ok) throw new Error(`login ${login.status}`);
  const cookie = cookieFrom(login); const h = { 'Content-Type': 'application/json', Cookie: cookie };
  const existing = await (await fetch(`${BASE}/api/admin/pages`, { headers: { Cookie: cookie } })).json() as Array<{ id: number; slug: string }>;
  const cur = existing.find(e => e.slug === PAGE.slug);
  const body = JSON.stringify({ title: PAGE.title, slug: PAGE.slug, excerpt: PAGE.excerpt, content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1 });
  const res = cur ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body }) : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log(`PAGE ${PAGE.slug}`, res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());
  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } }); console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

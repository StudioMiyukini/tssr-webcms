/* Cours « RADIUS & 802.1X ». Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-radius.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'radius-8021x', title: 'RADIUS & 802.1X : contrôler l’accès au réseau', excerpt: 'N’autoriser sur le réseau (port du switch ou Wi-Fi) que les utilisateurs/appareils authentifiés : le modèle AAA, le serveur RADIUS (NPS côté Windows), le protocole 802.1X et ses trois rôles (client, authentificateur, serveur).' };
const block = (t: Parameters<typeof makePageBlock>[0], p: Partial<PageBlock>) => Object.assign(makePageBlock(t), p);
const note = (c: string, t: string, h: string) => block('html', { html: `<aside class="pb-note pb-note-${c}"><p class="pb-note-title">${t}</p>${h}</aside>` });
const styleBlock = block('html', { html: `<style>.rd-t{border-collapse:collapse;width:100%;font-size:13px;margin:6px 0}.rd-t th,.rd-t td{border:1px solid var(--border);padding:7px 10px;text-align:left}.rd-t th{background:var(--surface-2)}</style>` });
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Réseau / Sécurité', title: PAGE.title, subtitle: 'Brancher un câble ne suffit plus : il faut d’abord prouver qui on est.' }),
  styleBlock,
  block('html', { html: '<p>Par défaut, quiconque branche un câble sur un switch (ou connaît la clé Wi-Fi) accède au réseau. <strong>802.1X</strong> impose une <strong>authentification</strong> <em>avant</em> d’ouvrir le port : seul un utilisateur/appareil légitime obtient l’accès. La vérification des identités est déléguée à un serveur <strong>RADIUS</strong>.</p>' }),
  block('heading', { level: 2, text: '1) Le modèle AAA' }),
  block('html', { html: `<table class="rd-t"><thead><tr><th>AAA</th><th>Rôle</th></tr></thead><tbody>
    <tr><td><strong>Authentication</strong></td><td>qui es-tu ? (identifiant/mot de passe, certificat)</td></tr>
    <tr><td><strong>Authorization</strong></td><td>à quoi as-tu droit ? (quel VLAN, quelles ressources)</td></tr>
    <tr><td><strong>Accounting</strong></td><td>traçabilité : qui s’est connecté, quand, combien de temps</td></tr>
  </tbody></table>` }),
  note('gray', '📻 RADIUS', '<p><strong>RADIUS</strong> (Remote Authentication Dial-In User Service) est le protocole standard qui porte le AAA. Côté Windows, le rôle serveur RADIUS s’appelle <strong>NPS</strong> (Network Policy Server) ; il s’appuie généralement sur les comptes <strong>Active Directory</strong>.</p>'),
  block('heading', { level: 2, text: '2) Les trois rôles de 802.1X' }),
  block('html', { html: `<table class="rd-t"><thead><tr><th>Rôle</th><th>Qui</th></tr></thead><tbody>
    <tr><td><strong>Supplicant</strong> (client)</td><td>le poste qui veut se connecter (logiciel 802.1X)</td></tr>
    <tr><td><strong>Authenticator</strong></td><td>le <strong>switch</strong> ou le <strong>point d’accès Wi-Fi</strong> : il bloque le port et relaie la demande</td></tr>
    <tr><td><strong>Serveur d’authentification</strong></td><td>le serveur <strong>RADIUS</strong> (NPS) : il valide, et répond « accepté / refusé »</td></tr>
  </tbody></table>` }),
  block('heading', { level: 2, text: '3) Le déroulé' }),
  block('html', { html: '<ol style="padding-left:22px;line-height:1.8"><li>Le poste se branche → le switch <strong>bloque</strong> tout sauf l’authentification (EAP).</li><li>Le poste envoie ses identifiants ; le switch les <strong>relaie</strong> au RADIUS.</li><li>Le RADIUS vérifie (dans AD) et répond <strong>Access-Accept</strong> ou <strong>Access-Reject</strong>.</li><li>Si accepté, le switch <strong>ouvre</strong> le port — et peut même placer le poste dans le <strong>bon VLAN</strong> (VLAN dynamique).</li></ol>' }),
  note('yellow', '💡 Cas concret', '<p>Un visiteur qui branche son PC non géré → refusé (ou placé dans un VLAN « invité » restreint). Un poste de l’entreprise (compte AD ou certificat) → accepté et placé dans son VLAN métier. C’est la base du <strong>contrôle d’accès réseau (NAC)</strong>.</p>'),
  note('green', '🔗 Liens', '<p><a href="/pages/les-vlan">Les VLAN</a> (attribution dynamique) · <a href="/pages/vocabulaire-active-directory">Active Directory</a> (les comptes) · <a href="/pages/le-switch">Le switch</a> · <a href="/pages/le-vpn">Le VPN</a>.</p>'),
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

/* Procédure maîtresse « Construire un réseau multi-routeurs de A à Z (Packet Tracer) » :
   la démarche complète que l'outil Atelier Réseau automatise — contexte, plan d'adressage, topologie,
   interfaces, routes statiques, DHCP relais, DNS, SSH, tests. Renvoie aux procédures détaillées.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-procedure-atelier-reseau-az.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'procedure-atelier-reseau-az', title: 'Construire un réseau multi-routeurs de A à Z (Packet Tracer)', excerpt: 'La démarche complète de bout en bout : contexte, plan d’adressage VLSM, topologie, interfaces, routes statiques, DHCP par relais, DNS, SSH et tests. Procédure maîtresse qui justifie l’outil Atelier Réseau.' };
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Procédure · Cisco / Packet Tracer', title: PAGE.title, subtitle: 'La méthode complète, dans l’ordre, pour te justifier de tout ce que fait l’Atelier Réseau.' }),
  note('blue', '🎯 But', '<p>Cette procédure <strong>maîtresse</strong> déroule, dans l’ordre, la construction d’une infrastructure réseau à <strong>plusieurs routeurs</strong> sous Packet Tracer. C’est la démarche manuelle qui <strong>justifie</strong> l’<a href="/pages/atelier-reseau">Atelier Réseau</a> : chaque étape renvoie à sa procédure détaillée.</p>'),

  block('heading', { level: 2, text: '① Recueillir le contexte' }),
  block('list', { listItems: [
    'Nom de l’entreprise et nom de domaine (ex. miyukini.lan).',
    'Réseau de base fourni (ex. 192.168.10.0/24) — infrastructure neuve ou extension d’un existant.',
    'Besoin en hôtes de chaque service / sous-réseau (Production, Bureaux, Wi-Fi…).',
    'Conventions maison : login/mot de passe/enable secret, position des IP fixes (clients en début de plage, switch puis routeur en fin).',
  ] }),

  block('heading', { level: 2, text: '② Plan d’adressage (VLSM)' }),
  block('html', { html: '<p>Découpe le réseau de base en sous-réseaux selon les besoins en hôtes (du plus grand au plus petit), sans chevauchement. Pour chacun : adresse réseau, masque/CIDR, plage utilisable, broadcast, passerelle. N’oublie pas les <strong>liaisons entre routeurs</strong> (souvent des /30 ou /29 via switch).</p>' }),
  note('gray', '📎 Détail', '<p>→ <a href="/pages/procedure-plan-adressage">Plan d’adressage (découpage en sous-réseaux)</a> · outil : <a href="/pages/segmentation-reseau">segmentation VLSM/FLSM</a>.</p>'),

  block('heading', { level: 2, text: '③ Poser la topologie' }),
  block('list', { listItems: [
    'Placer les routeurs (2811 / 2911), les switches et les postes/serveurs.',
    'Relier chaque LAN à son routeur via un switch ; relier les routeurs entre eux (segment Ethernet via switch, ou liaison série).',
    'Attribuer les IP d’interfaces d’après le plan : passerelle de chaque LAN, une IP par routeur sur chaque segment d’interconnexion, IP de gestion des switches.',
  ] }),

  block('heading', { level: 2, text: '④ Configurer les interfaces des routeurs' }),
  block('html', { html: '<p>Sur chaque routeur : nom d’hôte, puis chaque interface (IP + <code>no shutdown</code>, <code>clock rate</code> côté DCE des liaisons série), puis sauvegarde.</p>' }),
  note('gray', '📎 Détail', '<p>→ <a href="/pages/procedure-cisco-routeur-cli">Configurer un routeur Cisco en CLI</a> · outil : <a href="/pages/configurateur-routeur-cisco">configurateur routeur</a>.</p>'),

  block('heading', { level: 2, text: '⑤ Routes statiques' }),
  block('html', { html: '<p>Pour que les routeurs se joignent, ajoute sur chacun les routes vers les réseaux <strong>non directement connectés</strong>, avec le bon prochain saut (aller ET retour).</p>' }),
  note('gray', '📎 Détail', '<p>→ <a href="/pages/procedure-routes-statiques">Configurer les routes statiques (multi-routeurs)</a> · outil : <a href="/pages/generateur-routes-statiques">générateur de routes</a>.</p>'),

  block('heading', { level: 2, text: '⑥ DHCP (serveur + relais)' }),
  block('html', { html: '<p>Configure les étendues sur le serveur DHCP (une par sous-réseau client), puis active <code>ip helper-address</code> sur les interfaces LAN des routeurs.</p>' }),
  note('gray', '📎 Détail', '<p>→ <a href="/pages/procedure-dhcp-relais">DHCP centralisé : serveur + relais</a>.</p>'),

  block('heading', { level: 2, text: '⑦ DNS' }),
  block('html', { html: '<p>Sur le serveur DNS, crée la zone du domaine et les enregistrements A/PTR (routeurs, serveurs). Distribue l’adresse du serveur DNS aux clients via le DHCP.</p>' }),
  note('gray', '📎 Détail', '<p>→ <a href="/pages/procedure-dns">DNS : zones & enregistrements</a>.</p>'),

  block('heading', { level: 2, text: '⑧ SSH (administration à distance)' }),
  block('html', { html: '<p>Active SSH sur chaque routeur et chaque switch (domaine, clés RSA, compte privilège 15, VTY <code>transport input ssh</code>) ; les switches reçoivent une IP de gestion (SVI VLAN 1) + passerelle.</p>' }),
  note('gray', '📎 Détail', '<p>→ <a href="/pages/procedure-ssh-packet-tracer">SSH sur Packet Tracer</a>.</p>'),

  block('heading', { level: 2, text: '⑨ Tests de bout en bout' }),
  block('list', { listItems: [
    'Ping intra-sous-réseau (client → passerelle), puis inter-sous-réseaux (client A → client B distant).',
    'DHCP : un client obtient bien IP + passerelle + DNS de la bonne plage.',
    'DNS : nslookup / ping par nom (ex. ping r2.miyukini.lan).',
    'SSH : connexion à un routeur/switch depuis un client (ssh -l admin <IP>).',
    'En cas d’échec, remonter les couches : lien/interface up ? IP correcte ? route retour ? service (DHCP/DNS) actif ?',
  ] }),

  note('green', '✅ Justification complète', '<p>En suivant ces 9 étapes, tu produis manuellement l’intégralité de ce que génère l’<a href="/pages/atelier-reseau">Atelier Réseau</a> (plan, interfaces, routes, DHCP, DNS, SSH). Méthode de dépannage transverse : <a href="/pages/procedure-test-connectivite">test de connectivité méthodique</a>.</p>'),
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

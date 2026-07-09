/* Procédure « Plateforme 1 » : montage de l'infrastructure réalisée pendant l'exercice.
   Squelette — le contenu sera rédigé étape par étape (dicté par l'utilisateur).
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-procedure-plateforme-1.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'procedure-plateforme-1', title: 'Plateforme 1 — infrastructure EDIVN', excerpt: 'Montage de l’infrastructure de l’École de Développement Informatique (EDIVN) : cahier des charges (contexte, mission, sous-réseaux, DHCP, Wi-Fi, serveurs DNS/Web, SSH), livrables attendus et Annexe 1 (configuration des VM). La réalisation pas-à-pas suit.' };
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const th = (t: string) => `<th style="border:1px solid var(--border);padding:7px 10px;text-align:left;background:var(--surface-2)">${t}</th>`;
const td = (t: string) => `<td style="border:1px solid var(--border);padding:7px 10px">${t}</td>`;
const tbl = (head: string[], rows: string[][]) => `<div style="overflow-x:auto;margin:6px 0"><table style="border-collapse:collapse;width:100%;min-width:440px;font-size:13px"><thead><tr>${head.map(th).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(td).join('')}</tr>`).join('')}</tbody></table></div>`;

// ── Contenu ──
const annexe1 = `<div style="overflow-x:auto;margin:6px 0"><table style="border-collapse:collapse;width:100%;min-width:560px;font-size:13px">
<thead><tr>${['Caractéristique', 'VM Serveur 1', 'VM Serveur 2', 'VM Client'].map(th).join('')}</tr></thead>
<tbody>
${[
  ['Nom de la VM', '<strong>SRV-DNS</strong>', '<strong>SRV-IIS</strong>', '<strong>CLIENT-W</strong>'],
  ['Mémoire (RAM)', '2048 Mo', '2048 Mo', '1024 Mo'],
  ['Stockage', 'C : 30 Go', 'C : 30 Go', 'C : 20 Go'],
  ['Commutateur', 'Privé / Interne', 'Privé / Interne', 'Privé / Interne'],
  ['Adresse IP', '192.168.10.11', '192.168.10.12', '192.168.10.101'],
  ['Masque', '255.255.255.0', '255.255.255.0', '255.255.255.0'],
  ['Serveur DNS', 'SRV-DNS', 'SRV-DNS', 'SRV-DNS'],
  ['Nom de domaine', '<em>GroupeXX-EDIVN.lan</em> (à définir)', '—', '—'],
].map(r => `<tr>${td(`<strong>${r[0]}</strong>`)}${td(r[1])}${td(r[2])}${td(r[3])}</tr>`).join('')}
</tbody></table></div>`;

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Procédure · Projet', title: 'Plateforme 1 — infrastructure EDIVN', subtitle: 'Restructurer et monter le réseau de l’École de Développement Informatique (EDIVN).' }),

  note('blue', '🏫 Contexte', '<p>L’<strong>École de Développement Informatique EDIVN</strong> forme des développeurs et souhaite <strong>restructurer son réseau</strong> pour gagner en efficacité et en sécurité. Dans le cadre de son agrandissement, chaque site dispose d’une équipe pour restructurer le réseau. M. Dupont nous confie cette mission.</p>'),

  block('heading', { level: 2, text: '🎯 Mission' }),
  block('list', { listItems: [
    'Configurer les routeurs : routage entre les différents réseaux de la structure et vers les autres écoles.',
    'Configurer les serveurs : mise en service du serveur DNS et du serveur Web.',
    'Sécuriser le réseau : accès de management à distance en SSH sur le switch et le routeur (mot de passe : cisco).',
    'Configurer le point d’accès sans-fil Cisco : Wi-Fi pour les utilisateurs.',
    'Accès site Web : permettre l’accès au site web de chaque site.',
  ] }),

  block('heading', { level: 2, text: '📋 Cahier des charges (besoins)' }),

  block('heading', { level: 3, text: 'Sous-réseaux' }),
  block('list', { listItems: [
    '<strong>Réseau Admin (IT)</strong> : postes de travail des administrateurs + serveur DNS/Web.',
    '<strong>Réseau Utilisateurs</strong> : postes de travail des formateurs et stagiaires.',
  ] }),

  block('heading', { level: 3, text: 'Wi-Fi' }),
  block('html', { html: '<p>Un point d’accès <strong>Cisco WAP 371</strong> fournit le Wi-Fi aux stagiaires et formateurs, avec un <strong>SSID</strong> spécifique <code>SSID-EDWINXX</code> et une attribution d’<strong>IP dynamiques par DHCP</strong>.</p>' }),

  block('heading', { level: 3, text: 'DHCP' }),
  block('html', { html: '<p>Un service <strong>DHCP</strong> (solution libre) gère l’attribution des configurations réseau pour <strong>l’ensemble du réseau</strong> de l’école.</p>' }),

  block('heading', { level: 3, text: 'Serveur Web (réseau IT, IP fixe)' }),
  block('html', { html: '<p>Hébergé dans le réseau IT, il héberge les sites de l’école. Deux sites à créer :</p>' }),
  block('list', { listItems: [
    'Site 1 : <code>www.GroupeXX-EDIVN.lan</code> sur le <strong>port 8080</strong>, accessible <strong>depuis l’extérieur</strong>.',
    'Site 2 (intranet) : <code>Intranet.XX.EDIVN.lan</code>, accessible <strong>pour l’école</strong>, avec une page d’accueil affichant « <em>Bienvenue sur le site de l’école EDIVN</em> ».',
  ] }),

  block('heading', { level: 3, text: 'Switches & accès distant' }),
  block('list', { listItems: [
    'Renommer <strong>l’ensemble des switches</strong>.',
    'Mettre en place une connexion à distance <strong>SSH</strong> sur le switch et le routeur (mot de passe : <code>cisco</code>).',
  ] }),

  block('heading', { level: 2, text: '📦 Dossier technique attendu (livrables)' }),
  block('list', { listItems: [
    '<strong>Schéma logique</strong> : architecture réseau (sous-réseaux, équipements, interconnexions).',
    '<strong>Configuration des machines</strong> (Annexe 1) : matériel et logiciel de chaque machine.',
    '<strong>Configuration des switches et du routeur</strong> (Annexe 2) : paramètres réseau.',
    '<strong>Tables de routage</strong> : captures / listes des routes configurées.',
    '<strong>Borne Wi-Fi</strong> : captures montrant son fonctionnement.',
  ] }),

  block('heading', { level: 2, text: '🗺️ Schéma logique & plan d’adressage (validé — Groupe 5)' }),
  note('gray', '🖼️ Schéma', '<p>Le schéma logique (draw.io) est <strong>validé</strong>. Pour l’afficher ici, dépose le <strong>fichier .png</strong> exporté et je l’intègre à cet endroit. Voici le plan d’adressage qu’il fixe.</p>'),

  block('heading', { level: 3, text: 'Réseau Admin / IT — 192.5.10.0/28' }),
  block('html', { html: tbl(['Équipement', 'Adresse IP', 'Rôle'], [
    ['Poste Admin 1', '192.5.10.1', 'poste administrateur'],
    ['Serveur DHCP-DNS-Web', '<strong>192.5.10.12</strong>', 'serveur (IP fixe)'],
    ['SW-1', '192.5.10.13', 'switch — IP de gestion'],
    ['Passerelle (R_IT_G5 Gi0/0)', '<strong>192.5.10.14</strong>', 'passerelle du réseau'],
  ]) }),
  block('html', { html: '<p class="meta" style="font-size:12px">Masque <code>255.255.255.240</code> · broadcast <code>192.5.10.15</code> · plage utilisable <code>.1 → .14</code>.</p>' }),

  block('heading', { level: 3, text: 'Réseau Utilisateurs — 192.5.50.0/24' }),
  block('html', { html: tbl(['Équipement', 'Adresse IP', 'Rôle'], [
    ['Stagiaire', '192.5.50.1', 'poste — <strong>via DHCP</strong>'],
    ['Formateur', '192.5.50.3', 'poste — <strong>via DHCP</strong>'],
    ['CISCO WAP 371', '192.5.50.124', 'point d’accès Wi-Fi (SSID-EDWIN05)'],
    ['Sw-2', '192.5.50.253', 'switch — IP de gestion'],
    ['Passerelle (R_IT_G5 Gi0/1)', '<strong>192.5.50.254</strong>', 'passerelle du réseau'],
  ]) }),
  block('html', { html: '<p class="meta" style="font-size:12px">Masque <code>255.255.255.0</code> · les postes Stagiaire/Formateur et le Wi-Fi reçoivent leur IP par <strong>DHCP</strong>.</p>' }),

  block('heading', { level: 3, text: 'Liaison extérieure / autres écoles — 172.16.3.0/24' }),
  block('html', { html: tbl(['Équipement', 'Adresse IP', 'Rôle'], [
    ['Routeur_G5 Gi0/0', '172.16.3.250', 'sortie vers le nuage / les autres écoles (réseau « Salle »)'],
  ]) }),

  block('heading', { level: 3, text: 'Routeurs & interfaces' }),
  block('html', { html: tbl(['Routeur', 'Interface', 'Réseau', 'Adresse IP'], [
    ['R_IT_G5', 'Gi0/0', 'Admin 192.5.10.0/28', '192.5.10.14'],
    ['R_IT_G5', 'Gi0/1', 'Utilisateurs 192.5.50.0/24', '192.5.50.254'],
    ['Routeur_G5', 'Gi0/0', 'Extérieur 172.16.3.0/24', '172.16.3.250'],
    ['Routeur_G5', 'Gi0/1', 'Utilisateurs 192.5.50.0/24', '192.5.50.254 ⚠️'],
  ]) }),
  note('yellow', '⚠️ 2 points à vérifier avant de configurer', '<ul><li><strong>Conflit d’adresse</strong> : <strong>R_IT_G5</strong> et <strong>Routeur_G5</strong> portent tous les deux <code>192.5.50.254</code> sur le réseau Utilisateurs — impossible (2 machines, même IP). Une seule est la passerelle des clients (<code>.254</code>) ; donne à l’autre routeur une <strong>IP libre distincte</strong> (ex. <code>192.5.50.252</code>) sur ce segment, et prévois le <strong>routage</strong> entre les deux.</li><li><strong>Étiquette de masque</strong> : sur le schéma, l’interface <code>R_IT_G5 Gi0/0</code> est notée <code>/24</code> alors que le réseau Admin est en <strong>/28</strong> (<code>255.255.255.240</code>). Corrige l’étiquette en <code>/28</code>.</li></ul>'),

  block('heading', { level: 2, text: '🖥️ Annexe 1 — configuration des machines virtuelles' }),
  block('html', { html: annexe1 }),
  note('gray', 'ℹ️ Remarques', '<p>Toutes les VM sont sur le commutateur <strong>Privé/Interne</strong> et pointent vers <strong>SRV-DNS</strong> comme serveur DNS. Le <strong>nom de domaine</strong> reste à définir (ex. <code>GroupeXX-EDIVN.lan</code>) ; remplace <code>XX</code> par ton numéro de groupe partout.</p>'),

  note('yellow', '🚧 Suite : réalisation pas à pas', '<p>La partie <strong>« ce que nous avons fait »</strong> (montage étape par étape) sera ajoutée ci-dessous au fur et à mesure : VM &amp; réseau, adressage, DHCP, DNS, serveur Web (IIS, 2 sites), routage inter-réseaux, SSH switch/routeur, point d’accès Wi-Fi, puis tests.</p>'),
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

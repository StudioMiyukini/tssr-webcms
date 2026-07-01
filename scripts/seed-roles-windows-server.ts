/* Cours « Les rôles de Windows Server » (vulgarisé, d'après it-connect.fr — WS2025 principaux rôles).
   Ajoute la page + l'insère dans la colonne Software du hub Cours.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-roles-windows-server.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock, type CardItem } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const SLUG = 'roles-windows-server';
const TITLE = 'Les rôles de Windows Server';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const accordion = (it: Array<[string, string]>) => block('accordion', { items: it.map(([title, text]) => ({ title, text, href: '' })) });

// ===== Schéma SVG : un serveur, plusieurs familles de rôles =====
const K = { srv: '#2563eb', id: '#dc2626', net: '#0891b2', files: '#059706', web: '#7c3aed', virt: '#d97706', rds: '#db2777', upd: '#64748b' };
function boxR(x: number, y: number, w: number, h: number, fill: string, label: string): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}"/><text x="${x + w / 2}" y="${y + h / 2 + 4}" text-anchor="middle" font-size="12" fill="#fff" font-weight="bold">${label}</text>`;
}
const defs = '<defs><marker id="ar" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8"/></marker></defs>';
const arrow = (x1: number, y1: number, x2: number, y2: number) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#94a3b8" stroke-width="2" marker-end="url(#ar)"/>`;
const svg = (() => {
  const fams: Array<[string, string]> = [['Identité', K.id], ['Réseau', K.net], ['Fichiers / Impression', K.files], ['Web', K.web], ['Virtualisation', K.virt], ['Accès distant', K.rds], ['Mises à jour', K.upd]];
  const W = 440, sx = 16, sy = 110, sw = 120, sh = 50;
  let s = boxR(sx, sy, sw, sh, K.srv, 'Windows Server');
  const rx = 220, rw = 200, rh = 26, gap = 6, top = 8;
  fams.forEach((f, i) => {
    const y = top + i * (rh + gap);
    s += arrow(sx + sw, sy + sh / 2, rx - 4, y + rh / 2) + boxR(rx, y, rw, rh, f[1], f[0]);
  });
  const H = top + fams.length * (rh + gap) + 4;
  return `<svg viewBox="0 0 ${W} ${Math.max(H, sy + sh + 6)}" role="img" style="max-width:${W}px;width:100%;height:auto;margin:6px 0 12px;font-family:system-ui,sans-serif">${defs}${s}</svg>`;
})();

const overview: CardItem[] = [
  { title: '🔐 Identité', text: 'AD DS, AD CS, AD FS — comptes, certificats, connexion unique.', href: '' },
  { title: '🌐 Réseau', text: 'DNS, DHCP, NPS — noms, adresses IP, contrôle d’accès.', href: '' },
  { title: '📁 Fichiers & impression', text: 'Serveur de fichiers (DFS), serveur d’impression.', href: '' },
  { title: '🕸️ Web', text: 'IIS — héberger sites et applications web.', href: '' },
  { title: '🖥️ Virtualisation', text: 'Hyper-V — plusieurs serveurs virtuels sur une machine.', href: '' },
  { title: '🌍 Accès distant', text: 'RDS — bureaux et applis à distance.', href: '' },
];

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Software', title: TITLE, subtitle: 'Le panorama des grands services qu’un serveur Windows peut rendre — expliqués simplement.' }),
  block('html', { html: '<p>Windows Server fonctionne <strong>« à la carte »</strong> : par défaut, il ne fait presque rien. On lui ajoute des <strong>rôles</strong> selon les besoins de l’entreprise — chaque rôle est une <strong>grande fonction</strong> (un service) qu’il rend aux autres machines du réseau. Voici les principaux, regroupés par famille pour s’y retrouver.</p>' }),
  note('blue', '🔎 Analogie', '<p>Un serveur, c’est un <strong>employé polyvalent</strong> à qui on confie des <strong>métiers</strong> : « tu seras l’annuaire de l’entreprise », « toi le distributeur d’adresses », « toi l’hébergeur du site web »… Chaque métier confié = un rôle installé. On n’active que ceux dont on a besoin.</p>'),
  block('heading', { level: 2, text: 'Vue d’ensemble' }),
  block('html', { html: svg }),
  block('cards', { items: overview }),

  block('heading', { level: 2, text: '🔐 Identité & sécurité' }),
  accordion([
    ['AD DS — Active Directory Domain Services', '<p>L’<strong>annuaire central</strong> de l’entreprise : il gère les <strong>comptes utilisateurs, les ordinateurs et les groupes</strong> dans un <strong>domaine</strong>. Chacun se connecte <strong>une seule fois</strong> avec le même identifiant partout, et l’administrateur applique des règles à tout le parc via les <strong>stratégies de groupe (GPO)</strong>. 🧷 <em>L’équivalent du registre du personnel + le badge d’accès unique de l’entreprise.</em></p>'],
    ['AD CS — Active Directory Certificate Services', '<p>L’<strong>autorité de certificats</strong> interne (<strong>PKI</strong>) : elle <strong>fabrique, distribue et révoque</strong> des <strong>certificats numériques</strong> servant à chiffrer et à prouver une identité (HTTPS interne, authentification par carte à puce, signature). 🧷 <em>Le service qui délivre les « passeports officiels » numériques de l’organisation.</em></p>'],
    ['AD FS — Active Directory Federation Services', '<p>La <strong>fédération d’identités</strong> : elle permet l’<strong>authentification unique (SSO)</strong> vers des services <strong>externes ou partenaires</strong> sans recréer de comptes. On se connecte avec son compte d’entreprise chez un prestataire. 🧷 <em>Un « passe inter-entreprises » reconnu par les partenaires.</em></p>'],
    ['NPS — Network Policy Server', '<p>Le <strong>gardien de l’accès réseau</strong> (protocole <strong>RADIUS</strong>) : il décide <strong>qui a le droit de se connecter</strong> au WiFi ou au VPN, et sous quelles conditions. 🧷 <em>Le contrôle d’identité à l’entrée du réseau.</em></p>'],
  ]),

  block('heading', { level: 2, text: '🌐 Réseau & adressage' }),
  accordion([
    ['DNS — Domain Name System', '<p>L’<strong>annuaire des noms</strong> : il traduit les <strong>noms</strong> (ex. <code>serveur.entreprise.local</code>) en <strong>adresses IP</strong>. Indispensable au réseau <strong>et</strong> à Active Directory. 🧷 <em>Le répertoire téléphonique du réseau.</em></p>'],
    ['DHCP — Dynamic Host Configuration Protocol', '<p>Le <strong>distributeur d’adresses</strong> : il <strong>attribue automatiquement</strong> une adresse IP (et la passerelle, le DNS…) à chaque appareil qui se connecte, sans configuration manuelle. 🧷 <em>L’hôtesse qui donne un numéro de chambre à l’arrivée.</em></p>'],
    ['NPS — Network Policy Server', '<p>Voir « Identité & sécurité » : il s’appuie sur le réseau pour <strong>autoriser ou refuser</strong> les connexions (WiFi/VPN) selon des politiques.</p>'],
  ]),

  block('heading', { level: 2, text: '📁 Fichiers & impression' }),
  accordion([
    ['Serveur de fichiers (DFS)', '<p>Le <strong>partage centralisé de dossiers</strong> sur le réseau, avec des <strong>droits</strong> par utilisateur/groupe. Le <strong>DFS</strong> offre en plus une <strong>arborescence unifiée</strong> (un seul chemin même si les données sont sur plusieurs serveurs) et de la <strong>réplication</strong> (copies de secours). 🧷 <em>L’armoire commune de l’entreprise, avec doubles de sécurité.</em></p>'],
    ['Serveur d’impression', '<p>Centralise la gestion des <strong>imprimantes réseau</strong> : files d’attente, pilotes, droits d’accès, supervision. 🧷 <em>Le secrétariat qui gère toutes les imprimantes au même endroit.</em></p>'],
  ]),

  block('heading', { level: 2, text: '🕸️ Web, virtualisation & accès distant' }),
  accordion([
    ['IIS — Internet Information Services', '<p>Le <strong>serveur web</strong> de Windows : il <strong>héberge des sites et des applications</strong> (HTTP, HTTPS, FTP, ASP.NET). 🧷 <em>La vitrine qui sert les pages aux visiteurs.</em></p>'],
    ['Hyper-V — Virtualisation', '<p>Transforme le serveur en <strong>hyperviseur</strong> : il fait tourner plusieurs <strong>machines virtuelles</strong> (serveurs « dans le serveur ») isolées les unes des autres sur un seul matériel. 🧷 <em>Un immeuble qui contient plusieurs appartements indépendants.</em></p>'],
    ['RDS — Remote Desktop Services', '<p>Le <strong>bureau à distance</strong> : les utilisateurs accèdent à un <strong>bureau ou à des applications hébergés sur le serveur</strong>, depuis n’importe où. 🧷 <em>Travailler sur le PC du bureau… depuis chez soi.</em></p>'],
  ]),

  block('heading', { level: 2, text: '🔄 Gestion du parc' }),
  accordion([
    ['WSUS — Windows Server Update Services', '<p>Centralise les <strong>mises à jour</strong> Windows de toute l’entreprise : le serveur <strong>télécharge une seule fois</strong>, l’administrateur <strong>approuve</strong> ce qui doit être déployé, puis distribue aux postes. 🧷 <em>Économise la bande passante et garde le contrôle sur ce qui est installé.</em></p>'],
  ]),

  block('heading', { level: 2, text: 'Récapitulatif' }),
  block('html', { html: '<table class="wp-list"><thead><tr><th>Rôle</th><th>Famille</th><th>En une phrase</th></tr></thead><tbody>'
    + '<tr><td><strong>AD DS</strong></td><td>Identité</td><td>Annuaire central (comptes, ordinateurs, GPO).</td></tr>'
    + '<tr><td><strong>AD CS</strong></td><td>Identité</td><td>Fabrique les certificats (PKI).</td></tr>'
    + '<tr><td><strong>AD FS</strong></td><td>Identité</td><td>Connexion unique vers des partenaires (SSO).</td></tr>'
    + '<tr><td><strong>NPS</strong></td><td>Réseau / sécurité</td><td>Autorise les accès WiFi/VPN (RADIUS).</td></tr>'
    + '<tr><td><strong>DNS</strong></td><td>Réseau</td><td>Traduit les noms en adresses IP.</td></tr>'
    + '<tr><td><strong>DHCP</strong></td><td>Réseau</td><td>Distribue les adresses IP automatiquement.</td></tr>'
    + '<tr><td><strong>Serveur de fichiers / DFS</strong></td><td>Fichiers</td><td>Partage centralisé + réplication.</td></tr>'
    + '<tr><td><strong>Serveur d’impression</strong></td><td>Impression</td><td>Gère les imprimantes réseau.</td></tr>'
    + '<tr><td><strong>IIS</strong></td><td>Web</td><td>Héberge sites et applis web.</td></tr>'
    + '<tr><td><strong>Hyper-V</strong></td><td>Virtualisation</td><td>Fait tourner des machines virtuelles.</td></tr>'
    + '<tr><td><strong>RDS</strong></td><td>Accès distant</td><td>Bureaux et applis à distance.</td></tr>'
    + '<tr><td><strong>WSUS</strong></td><td>Gestion du parc</td><td>Centralise les mises à jour Windows.</td></tr>'
    + '</tbody></table>' }),
  note('green', '💡 À retenir', '<p>Un serveur Windows s’équipe <strong>à la carte</strong> de rôles selon le besoin. À connaître en priorité : <strong>AD DS</strong> (annuaire), <strong>DNS</strong> + <strong>DHCP</strong> (réseau), <strong>serveur de fichiers</strong>, <strong>IIS</strong> (web) et <strong>Hyper-V</strong> (virtualisation). Pour <strong>installer</strong> un rôle, voir <a href="/pages/serveur-roles">Gérer les rôles (CRUD)</a> ; pour les <strong>concepts</strong>, le cours <a href="/pages/windows-server">Windows Server</a>. Sigles dans le <a href="/glossaire">Glossaire</a>.</p>'),
  block('html', { html: '<p class="meta">Source d’inspiration : it-connect.fr — « Windows Server 2025 : les principaux rôles ».</p>' }),
];

// ===== Mise à jour du hub Software =====
const SOFTWARE: Array<[string, string]> = [
  ['/pages/le-systeme-exploitation', 'Le système d’exploitation'],
  ['/pages/demarrage-bios-uefi', 'Le démarrage : BIOS & UEFI'],
  ['/pages/systemes-de-fichiers', 'Les systèmes de fichiers'],
  ['/pages/gestion-ordinateur-windows', 'La gestion de l’ordinateur'],
  ['/pages/base-de-registre', 'La base de registre'],
  ['/pages/windows-server', 'Windows Server'],
  ['/pages/roles-windows-server', 'Les rôles de Windows Server'],
  ['/pages/gestionnaire-de-serveurs', 'Le gestionnaire de serveurs'],
];
const HARDWARE: Array<[string, string]> = [
  ['/pages/hardware', 'Le hardware'], ['/pages/les-form-factor', 'Les form factors'],
  ['/pages/ports-arriere-carte-mere', 'Les ports arrière de la carte-mère'], ['/pages/carte-mere', 'La carte-mère — connectique interne'],
  ['/pages/le-chipset', 'Le chipset'], ['/pages/le-processeur', 'Le processeur (CPU)'], ['/pages/le-raid', 'Les niveaux de RAID'],
];
const RESEAU: Array<[string, string]> = [['/pages/le-routeur', 'Le routeur'], ['/pages/le-switch', 'Le switch'], ['/pages/le-pare-feu', 'Le pare-feu']];
const MAINTENANCE: Array<[string, string]> = [['/pages/les-7-couches-osi', 'Les 7 couches OSI'], ['/pages/le-ticketing', 'Le ticketing']];
const col = (icon: string, name: string, sub: string, links: Array<[string, string]>): PageBlock[] => [
  block('heading', { level: 2, text: `${icon} ${name}` }),
  block('html', { html: `<p class="meta">${sub}</p>` }),
  ...links.map(([href, label], i) => block('button', { label, href, variant: i < 4 ? 'primary' : 'secondary' })),
];
const hubBlocks: PageBlock[] = buildHubBlocks();

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
  const cur = existing.find(e => e.slug === SLUG);
  const bodyJson = JSON.stringify({ title: TITLE, slug: SLUG, excerpt: 'Panorama vulgarisé des principaux rôles de Windows Server : AD DS, DNS, DHCP, fichiers, IIS, Hyper-V, RDS, WSUS…', content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1 });
  const res = cur
    ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body: bodyJson })
    : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body: bodyJson });
  console.log('PAGE', res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());

  const cours = existing.find(e => e.slug === 'cours');
  if (cours) {
    const r2 = await fetch(`${BASE}/api/admin/pages/${cours.id}`, { method: 'PUT', headers: h, body: JSON.stringify({ title: 'Cours', slug: 'cours', content: renderPageBlocksToHtml(hubBlocks), builder_json: serializePageBlocks(hubBlocks), published: 1 }) });
    console.log('HUB Cours', r2.status, r2.ok ? '(maj)' : await r2.text());
  }
  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

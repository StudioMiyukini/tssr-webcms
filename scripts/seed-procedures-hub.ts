/* Section « Procédures » : entrée de menu + page annuaire (cartes horizontales, pagination 20/page)
   listant les procédures pas-à-pas. Les procédures ne sont plus dans le hub « Cours ».
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-procedures-hub.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);

type Proc = { slug: string; icon: string; title: string; desc: string; tags: string[]; cat: string };
const CATEGORIES: { id: string; icon: string; label: string }[] = [
  { id: 'virtualisation', icon: '🖥️', label: 'Virtualisation & Hyper-V' },
  { id: 'ad', icon: '🏢', label: 'Active Directory' },
  { id: 'reseau', icon: '🌐', label: 'Réseau & adressage' },
  { id: 'windows', icon: '🪟', label: 'Poste Windows & disques' },
  { id: 'services', icon: '📶', label: 'Services : DHCP · DNS · Web · Fichiers' },
  { id: 'cisco', icon: '🧪', label: 'Cisco / Packet Tracer' },
];
const PROCEDURES: Proc[] = [
  { slug: 'procedure-vm-hyperv', icon: '🖥️', title: 'Créer & configurer une VM (ISO) sur Hyper-V', desc: 'De la création de la VM au début du TP : OS, nom, IP fixe, pare-feu.', tags: ['Hyper-V', 'Réseau'], cat: 'virtualisation' },
  { slug: 'procedure-hyperv-ressources', icon: '🧩', title: 'Hyper-V : fonctionnement & ressources', desc: 'Hyperviseur, VM, commutateurs, VHDX — et attribuer CPU/RAM/disque/réseau.', tags: ['Hyper-V', 'Hébergement'], cat: 'virtualisation' },
  { slug: 'procedure-installation-active-directory', icon: '🏢', title: 'Installer & configurer Active Directory', desc: 'De la VM vierge au client intégré au domaine : procédure complète.', tags: ['Active Directory'], cat: 'ad' },
  { slug: 'procedure-ad-objets', icon: '👥', title: 'AD : UO, groupes & utilisateurs (unitaire & masse)', desc: 'Créer les objets AD en console (dsa.msc) et PowerShell : UO, groupes, comptes, copie de modèle, import CSV en masse.', tags: ['Active Directory', 'PowerShell'], cat: 'ad' },
  { slug: 'procedure-agdlp', icon: '🔐', title: 'Mettre en place AGDLP', desc: 'Attribuer les droits proprement : Account → Global → Domain Local → Permission.', tags: ['Active Directory', 'Droits'], cat: 'ad' },
  { slug: 'procedure-sauvegarde-ad', icon: '💾', title: 'Sauvegarde & restauration d’Active Directory', desc: 'État système (Windows Server Backup), corbeille AD (objet supprimé) et restauration faisant autorité (DSRM / ntdsutil).', tags: ['Active Directory', 'Sauvegarde', 'Haute dispo'], cat: 'ad' },
  { slug: 'procedure-gpo', icon: '🛡️', title: 'GPO : stratégies de groupe', desc: 'Créer et lier une GPO à une UO, régler les paramètres, filtrer par groupe, forcer/vérifier (gpupdate / gpresult), ordre LSDOU.', tags: ['Active Directory', 'GPO'], cat: 'ad' },
  { slug: 'procedure-plan-adressage', icon: '🧮', title: 'Plan d’adressage (découpage en sous-réseaux)', desc: 'Découper un réseau selon le besoin en hôtes (VLSM), sans chevauchement.', tags: ['Réseau', 'Subnetting'], cat: 'reseau' },
  { slug: 'procedure-ip-fixe-windows', icon: '🔧', title: 'Configurer une IP fixe (Windows)', desc: 'IP statique sous Windows 10/11 & Server : méthode graphique + netsh.', tags: ['Réseau', 'Windows'], cat: 'reseau' },
  { slug: 'procedure-test-connectivite', icon: '📡', title: 'Test de connectivité méthodique', desc: 'Dépanner dans l’ordre : loopback → passerelle → Internet → DNS.', tags: ['Réseau', 'Diagnostic'], cat: 'reseau' },
  { slug: 'procedure-renommer-poste', icon: '🏷️', title: 'Renommer un poste Windows', desc: 'Changer le nom d’un PC/serveur (convention de nommage) puis redémarrer.', tags: ['Windows'], cat: 'windows' },
  { slug: 'procedure-gestion-disques', icon: '💽', title: 'Gestion des disques & partitionnement', desc: 'Initialiser (MBR/GPT), partitionner, formater NTFS — diskmgmt & diskpart.', tags: ['Windows', 'Hébergement'], cat: 'windows' },
  { slug: 'procedure-dhcp', icon: '📶', title: 'DHCP : étendue, options & réservation', desc: 'Rôle DHCP, plage, options 003/006/015, réservation par MAC.', tags: ['Hébergement', 'Réseau'], cat: 'services' },
  { slug: 'procedure-dhcp-basculement', icon: '🔁', title: 'Basculement DHCP (failover)', desc: 'Redondance entre 2 serveurs : prérequis, répartition de charge vs veille active, pas-à-pas.', tags: ['Hébergement', 'DHCP', 'Haute dispo'], cat: 'services' },
  { slug: 'procedure-dns', icon: '🌐', title: 'DNS : zones & enregistrements', desc: 'Zones directe/inversée, enregistrements A/CNAME/PTR, tests nslookup.', tags: ['Hébergement', 'Réseau'], cat: 'services' },
  { slug: 'procedure-dns-redondance', icon: '🌐', title: 'Redondance DNS', desc: 'Zone intégrée AD répliquée sur un 2e DC, ou zone secondaire + transfert de zone ; redirecteurs, DNS secondaire côté clients.', tags: ['Hébergement', 'DNS', 'Haute dispo'], cat: 'services' },
  { slug: 'procedure-dfs', icon: '🗂️', title: 'DFS : espace de noms + réplication', desc: 'Chemin unique \\\\domaine\\Partages (DFS-N), cibles multiples pour la redondance et réplication DFS-R entre serveurs.', tags: ['Hébergement', 'Fichiers', 'Haute dispo'], cat: 'services' },
  { slug: 'procedure-iis', icon: '🕸️', title: 'IIS : héberger un site web', desc: 'Rôle IIS, site + liaison, DNS, permissions NTFS, pare-feu.', tags: ['Hébergement', 'Web'], cat: 'services' },
  { slug: 'procedure-iis-hyperv', icon: '🌍', title: 'Installer un serveur IIS sur une VM Hyper-V', desc: 'De la création de la VM à la publication du site : VM → Windows Server → IP → IIS → site → test.', tags: ['Hébergement', 'Hyper-V', 'Web'], cat: 'services' },
  { slug: 'procedure-atelier-reseau-az', icon: '🗺️', title: 'Réseau multi-routeurs de A à Z', desc: 'La démarche complète (contexte, VLSM, interfaces, routes, DHCP, DNS, SSH, tests) — justifie l’Atelier Réseau.', tags: ['Cisco', 'Packet Tracer', 'Réseau'], cat: 'cisco' },
  { slug: 'procedure-cisco-routeur-cli', icon: '📟', title: 'Configurer un routeur Cisco en CLI', desc: 'Modes Cisco, hostname, interfaces (IP, no shutdown, clock rate DCE), vérification et sauvegarde.', tags: ['Cisco', 'Packet Tracer'], cat: 'cisco' },
  { slug: 'procedure-routes-statiques', icon: '🛣️', title: 'Configurer les routes statiques (multi-routeurs)', desc: 'Réseaux non connectés, prochain saut (plus court chemin), ip route, route par défaut, vérification.', tags: ['Cisco', 'Packet Tracer', 'Routage'], cat: 'cisco' },
  { slug: 'procedure-dhcp-relais', icon: '📡', title: 'DHCP centralisé : serveur + relais', desc: 'Étendues sur le serveur DHCP + ip helper-address sur les routeurs, tests et dépannage.', tags: ['Réseau', 'DHCP', 'Packet Tracer'], cat: 'cisco' },
  { slug: 'procedure-dhcp-packet-tracer', icon: '📶', title: 'DHCP sur Packet Tracer', desc: 'Serveur (GUI) ou routeur (CLI ip dhcp pool) + exclusions, relais et tests clients.', tags: ['Réseau', 'DHCP', 'Packet Tracer'], cat: 'cisco' },
  { slug: 'procedure-ssh-packet-tracer', icon: '🔑', title: 'SSH sur Packet Tracer', desc: 'Accès distant chiffré à un routeur/switch Cisco : domaine, clés RSA, compte, VTY, test.', tags: ['Cisco', 'Packet Tracer', 'Sécurité'], cat: 'cisco' },
];

function pill(t: string) { return `<span style="display:inline-block;font-size:10.5px;font-weight:600;color:var(--text-muted);background:var(--surface-3);border:1px solid var(--border);border-radius:999px;padding:1px 9px;margin:4px 4px 0 0">${t}</span>`; }
function card(p: Proc) {
  return `<a class="dir-card" href="/pages/${p.slug}"><div class="dc-ico">${p.icon}</div>`
    + `<div class="dc-body"><div class="dc-title">${p.title}</div><div class="dc-desc meta">${p.desc}</div><div>${p.tags.map(pill).join('')}</div></div>`
    + `<div class="dc-go">Voir →</div></a>`;
}
function buildDirectory(items: Proc[]): string {
  const cats = CATEGORIES.filter(c => items.some(p => p.cat === c.id));
  const css = '.dir{position:relative}'
    + '.dir .pd-nav{display:flex;flex-wrap:wrap;gap:8px;margin:2px 0 24px}'
    + '.dir .pd-chip{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;color:var(--text-soft);text-decoration:none;border:1px solid var(--border);border-radius:999px;padding:5px 13px;background:var(--surface);transition:border-color .15s,color .15s}'
    + '.dir .pd-chip:hover{border-color:var(--accent);color:var(--accent)}'
    + '.dir .pd-chip .pd-n{font-size:11px;color:var(--text-muted);background:var(--surface-3);border-radius:999px;padding:0 7px}'
    + '.dir .pd-sec{margin:0 0 30px;scroll-margin-top:84px}'
    + '.dir .pd-h{font-size:16.5px;font-weight:800;color:var(--text);margin:0 0 13px;display:flex;align-items:center;gap:9px;padding-bottom:8px;border-bottom:1px solid var(--border)}'
    + '.dir .pd-h .pd-count{font-size:12px;font-weight:700;color:var(--text-muted);background:var(--surface-3);border:1px solid var(--border);border-radius:999px;padding:1px 9px}'
    + '.dir .pd-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px}'
    + '.dir-card{display:flex;gap:14px;align-items:center;padding:14px 16px;border:1px solid var(--border);border-radius:12px;background:var(--surface);text-decoration:none;transition:border-color .15s,transform .15s}'
    + '.dir-card:hover{border-color:var(--accent);transform:translateY(-1px)}'
    + '.dir-card .dc-ico{font-size:30px;line-height:1}'
    + '.dir-card .dc-body{flex:1;min-width:0}'
    + '.dir-card .dc-title{font-weight:700;font-size:15px;color:var(--text)}'
    + '.dir-card .dc-desc{font-size:13px;margin-top:2px}'
    + '.dir-card .dc-go{color:var(--accent);font-weight:700;white-space:nowrap}'
    + '@media (max-width:640px){.dir .pd-grid{grid-template-columns:1fr}}';
  const nav = cats.map(c => `<a class="pd-chip" href="#sec-${c.id}">${c.icon} ${c.label} <span class="pd-n">${items.filter(p => p.cat === c.id).length}</span></a>`).join('');
  const sections = cats.map(c => {
    const group = items.filter(p => p.cat === c.id);
    return `<section class="pd-sec" id="sec-${c.id}"><h2 class="pd-h">${c.icon} ${c.label} <span class="pd-count">${group.length}</span></h2>`
      + `<div class="pd-grid">${group.map(card).join('')}</div></section>`;
  }).join('');
  return `<div class="dir"><style>${css}</style><nav class="pd-nav">${nav}</nav>${sections}</div>`;
}

const dirBlocks: PageBlock[] = [
  block('hero', { eyebrow: 'TSSR', title: 'Procédures', subtitle: 'Modes opératoires pas-à-pas, prêts à suivre en TP ou en production.' }),
  block('html', { html: `<p class="meta">${PROCEDURES.length} procédures, classées par domaine. Utilise le sommaire pour sauter à une catégorie, puis clique sur une carte pour ouvrir le mode opératoire.</p>` }),
  block('html', { html: buildDirectory(PROCEDURES) }),
];

// ===================================================================================
// EXÉCUTION
// ===================================================================================
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

  const cur = existing.find(e => e.slug === 'procedures');
  const body = JSON.stringify({ title: 'Procédures', slug: 'procedures', excerpt: 'Annuaire des procédures pas-à-pas (Hyper-V, Active Directory…).', content: renderPageBlocksToHtml(dirBlocks), builder_json: serializePageBlocks(dirBlocks), published: 1 });
  const res = cur
    ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body })
    : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log('PAGE procedures', res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());

  // Entrée de menu « Procédures »
  const menus = await (await fetch(`${BASE}/api/admin/menus`, { headers: { Cookie: cookie } })).json() as Array<{ id: number; label: string; url: string }>;
  if (!menus.some(m => m.url === '/pages/procedures' || m.label === 'Procédures')) {
    const r = await fetch(`${BASE}/api/admin/menus`, { method: 'POST', headers: h, body: JSON.stringify({ label: 'Procédures', url: '/pages/procedures', sort_order: 3 }) });
    console.log('MENU Procédures', r.status, r.ok ? '(ajouté)' : await r.text());
  } else console.log('MENU Procédures déjà présent');

  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

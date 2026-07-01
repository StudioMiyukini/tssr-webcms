/* Crée la page projet « Concevoir & déployer le réseau d'une entreprise multi-services »
   (Production · Comptabilité · RH · Direction) — conception, installation, déploiement.
   Vulgarisé, schématisé (SVG inline → compatibles CSP), peu verbeux grâce aux accordéons.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-reseau-entreprise.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);

// ===== Palette commune des schémas SVG =====
const C = { net: '#2563eb', dev: '#059669', warn: '#d97706', danger: '#dc2626', grey: '#64748b', slate: '#475569', purple: '#7c3aed', ok: '#16a34a' };
const accordion = (it: Array<[string, string]>) => block('accordion', { items: it.map(([title, text]) => ({ title, text, href: '' })) });
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const code = (lines: string[]) => `<pre style="background:var(--surface-2);border:1px solid var(--border);padding:10px 12px;border-radius:8px;overflow-x:auto;font-size:13px;line-height:1.55;margin:8px 0"><code>${lines.map(l => l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')).join('\n')}</code></pre>`;

// ===================================================================================
// SCHÉMAS SVG (inline). Pas d'emoji dans les <text> : rendu police incertain.
// ===================================================================================
function box(x: number, y: number, w: number, h: number, fill: string, label: string, sub = ''): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}"/>`
    + `<text x="${x + w / 2}" y="${y + (sub ? h / 2 - 2 : h / 2 + 4)}" text-anchor="middle" font-size="13" fill="#fff" font-weight="bold">${label}</text>`
    + (sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 14}" text-anchor="middle" font-size="10" fill="#e5e7eb">${sub}</text>` : '');
}
const line = (x1: number, y1: number, x2: number, y2: number, col = '#94a3b8') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="2.5"/>`;
const wrap = (w: number, h: number, inner: string) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="max-width:${w}px;width:100%;height:auto;margin:6px 0 12px;font-family:system-ui,sans-serif">${inner}</svg>`;

// ===== Icônes d'appareils (dessins simples → style « schéma illustré ») =====
const cap = (x: number, y: number, t: string, col = '#64748b', s = 11) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${s}" fill="${col}">${t}</text>`;
const lbl = (x: number, y: number, t: string, col = '#475569', s = 11) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${s}" fill="${col}" font-weight="bold">${t}</text>`;
const ipText = (x: number, y: number, t: string) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="9" fill="#475569" font-family="ui-monospace,monospace">${t}</text>`;

// Nuage Internet
function icCloud(cx: number, cy: number) {
  return `<g fill="${C.grey}"><ellipse cx="${cx}" cy="${cy + 9}" rx="40" ry="14"/><circle cx="${cx - 22}" cy="${cy + 3}" r="15"/><circle cx="${cx + 20}" cy="${cy + 1}" r="16"/><circle cx="${cx - 1}" cy="${cy - 9}" r="17"/></g>`
    + `<text x="${cx}" y="${cy + 7}" text-anchor="middle" font-size="12" fill="#fff" font-weight="bold">Internet</text>`;
}
// Box / modem du fournisseur (2 antennes + diodes)
function icBox(cx: number, cy: number, label = 'Box FAI') {
  const w = 58, h = 38, x = cx - w / 2, y = cy - h / 2;
  return `<line x1="${cx - 12}" y1="${y - 12}" x2="${cx - 12}" y2="${y}" stroke="${C.slate}" stroke-width="2"/>`
    + `<line x1="${cx + 12}" y1="${y - 12}" x2="${cx + 12}" y2="${y}" stroke="${C.slate}" stroke-width="2"/>`
    + `<circle cx="${cx - 12}" cy="${y - 13}" r="3" fill="${C.slate}"/><circle cx="${cx + 12}" cy="${y - 13}" r="3" fill="${C.slate}"/>`
    + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${C.grey}"/>`
    + `<circle cx="${x + 13}" cy="${y + h - 9}" r="3" fill="#4ade80"/><circle cx="${x + 25}" cy="${y + h - 9}" r="3" fill="#fbbf24"/><circle cx="${x + 37}" cy="${y + h - 9}" r="3" fill="#60a5fa"/>`
    + lbl(cx, y + h + 15, label, C.slate);
}
// Pare-feu : mur de briques
function icWall(cx: number, cy: number, label = 'Pare-feu') {
  const w = 54, h = 44, x = cx - w / 2, y = cy - h / 2;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${C.danger}"/>`;
  for (let r = 1; r < 4; r++) s += `<line x1="${x}" y1="${y + r * h / 4}" x2="${x + w}" y2="${y + r * h / 4}" stroke="#ffffff" stroke-opacity="0.5" stroke-width="1.5"/>`;
  const rows = [[x + w / 3, x + 2 * w / 3], [x + w / 6, x + w / 2, x + 5 * w / 6], [x + w / 3, x + 2 * w / 3], [x + w / 6, x + w / 2, x + 5 * w / 6]];
  rows.forEach((xs, ri) => { const y0 = y + ri * h / 4; xs.forEach(xx => { s += `<line x1="${xx}" y1="${y0}" x2="${xx}" y2="${y0 + h / 4}" stroke="#ffffff" stroke-opacity="0.5" stroke-width="1.5"/>`; }); });
  return s + lbl(cx, y + h + 15, label, C.danger);
}
// Switch : boîtier plat avec une rangée de ports
function icSwitch(cx: number, cy: number, w: number, label = 'Switch', sub = '') {
  const h = 28, x = cx - w / 2, y = cy - h / 2;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${C.net}"/>`;
  const n = Math.max(3, Math.floor((w - 14) / 10));
  for (let i = 0; i < n; i++) s += `<rect x="${x + 8 + i * 10}" y="${y + h - 11}" width="7" height="7" rx="1.5" fill="#fff" fill-opacity="0.85"/>`;
  if (label) s += lbl(cx, y + h + 15, label, C.net);
  if (sub) s += cap(cx, y + h + 28, sub, '#64748b', 10);
  return s;
}
// Serveur : tour avec slots et diodes
function icServer(cx: number, cy: number, label = 'Serveurs', sub = '') {
  const w = 46, h = 54, x = cx - w / 2, y = cy - h / 2;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${C.slate}"/>`;
  for (let i = 0; i < 3; i++) { const yy = y + 8 + i * 15; s += `<rect x="${x + 6}" y="${yy}" width="${w - 12}" height="10" rx="2" fill="#ffffff" fill-opacity="0.14"/><circle cx="${x + 12}" cy="${yy + 5}" r="2.4" fill="#4ade80"/>`; }
  s += lbl(cx, y + h + 15, label, C.slate);
  if (sub) s += cap(cx, y + h + 28, sub, '#64748b', 10);
  return s;
}
// Poste de travail : écran + pied (IP optionnelle sous l'icône)
function icPC(cx: number, cy: number, color: string = C.net, ip = '') {
  const x = cx - 16, y = cy - 13;
  let s = `<rect x="${x}" y="${y}" width="32" height="22" rx="3" fill="${color}"/>`
    + `<rect x="${x + 3}" y="${y + 3}" width="26" height="14" rx="1.5" fill="#e2e8f0"/>`
    + `<rect x="${cx - 4}" y="${y + 22}" width="8" height="4" fill="${color}"/>`
    + `<rect x="${cx - 11}" y="${y + 26}" width="22" height="3" rx="1.5" fill="${color}"/>`;
  if (ip) s += ipText(cx, y + 42, ip);
  return s;
}

// --- Vue d'ensemble : appareils DISTINCTS en icônes + 4 VLAN avec 3 postes (IP) chacun ---
const TOPO_SVC = [
  { cx: 89, col: C.dev, name: 'Production', vlan: '10' },
  { cx: 263, col: C.warn, name: 'Comptabilite', vlan: '20' },
  { cx: 437, col: C.purple, name: 'RH', vlan: '30' },
  { cx: 611, col: C.net, name: 'Direction', vlan: '40' },
];
const PC_DEFS = [{ dx: -48, h: '.11' }, { dx: 0, h: '.12' }, { dx: 48, h: '.13' }];
const topoZones = TOPO_SVC.map(s =>
  `<rect x="${s.cx - 79}" y="150" width="158" height="200" rx="12" fill="${s.col}" fill-opacity="0.07" stroke="${s.col}" stroke-width="1.5"/>`
  + lbl(s.cx, 172, s.name, s.col, 13)
  + cap(s.cx, 188, 'VLAN ' + s.vlan, s.col, 11)
  + ipText(s.cx, 202, `192.168.${s.vlan}.0/24`)
  + icSwitch(s.cx, 228, 120, '', '')                                  // switch d'accès du service
  + cap(s.cx, 254, 'Switch acces', s.col, 9)
  + PC_DEFS.map(p => line(s.cx, 242, s.cx + p.dx, 282, s.col)).join('') // étoile switch → 3 postes
  + PC_DEFS.map(p => icPC(s.cx + p.dx, 295, s.col, p.h)).join(''),
).join('');
const topoBus = line(350, 69, 350, 120) + line(89, 120, 611, 120)
  + TOPO_SVC.map(s => line(s.cx, 120, s.cx, 150)).join('');
const svgTopo = wrap(700, 402,
  icCloud(48, 55)
  + line(88, 55, 121, 55, C.net) + icBox(150, 55)
  + line(179, 55, 231, 55, C.net) + icWall(258, 55)
  + line(285, 55, 320, 55, C.net) + icSwitch(350, 55, 120, '', '') + lbl(350, 33, 'Switch coeur', C.net)
  + line(410, 55, 477, 52, C.net) + icServer(500, 52, 'Salle serveurs', 'AD - DNS - DHCP')
  + topoBus + topoZones
  + cap(350, 384, "Chaque service a son switch d'acces relie au coeur ; 3 postes (.11 a .13) par VLAN."));

// --- Les 3 phases du projet ---
const svgSteps = wrap(620, 130,
  box(20, 40, 170, 55, C.net, '1 - Conception', 'besoins, plan IP, schema')
  + `<text x="210" y="72" font-size="20" fill="${C.grey}">&#8594;</text>`
  + box(230, 40, 170, 55, C.warn, '2 - Installation', 'cablage, switch, serveurs')
  + `<text x="420" y="72" font-size="20" fill="${C.grey}">&#8594;</text>`
  + box(440, 40, 170, 55, C.ok, '3 - Deploiement', 'postes, GPO, tests')
  + `<text x="315" y="120" text-anchor="middle" font-size="11" fill="#64748b">Du plan sur le papier a la mise en service, etape par etape.</text>`);

// --- La baie 19" : des équipements DISTINCTS empilés (1 appareil = 1 rôle) ---
const svgRack = wrap(320, 300,
  `<rect x="80" y="14" width="160" height="244" rx="6" fill="none" stroke="${C.slate}" stroke-width="2"/>`
  + box(92, 24, 136, 32, C.grey, 'Bandeau brassage')
  + box(92, 62, 136, 32, C.net, 'Switch acces', '48 ports')
  + box(92, 100, 136, 32, C.net, 'Switch coeur', 'niveau 3')
  + box(92, 138, 136, 32, C.danger, 'Pare-feu')
  + box(92, 176, 136, 32, C.slate, 'Serveur')
  + box(92, 214, 136, 32, C.warn, 'Onduleur')
  + `<text x="160" y="276" text-anchor="middle" font-size="11" fill="#64748b">Des equipements distincts,</text>`
  + `<text x="160" y="290" text-anchor="middle" font-size="11" fill="#64748b">empiles dans la baie 19".</text>`);

// --- La chaîne des équipements (chaque maillon = un appareil séparé, en icônes) ---
const svgChain = wrap(700, 150,
  icCloud(48, 58)
  + line(88, 58, 128, 58, C.net) + icBox(160, 58)
  + line(192, 58, 238, 58, C.net) + icWall(268, 58)
  + line(298, 58, 352, 58, C.net) + icSwitch(404, 58, 86, 'Switch coeur', '')
  + line(450, 58, 500, 58, C.net) + icSwitch(548, 58, 86, 'Switch acces', '')
  + line(594, 58, 632, 58, C.net) + icPC(656, 58, C.dev, 'PC')
  + cap(350, 134, 'Chaque maillon est un appareil different, relie au suivant par un cable.'));

// --- Règles entre services : tous joignent les serveurs, mais pas entre eux (icônes) ---
const RULES_SVC = [
  { cx: 80, col: C.dev, name: 'Production', vlan: 'VLAN 10' },
  { cx: 240, col: C.warn, name: 'Comptabilite', vlan: 'VLAN 20' },
  { cx: 400, col: C.purple, name: 'RH', vlan: 'VLAN 30' },
  { cx: 560, col: C.net, name: 'Direction', vlan: 'VLAN 40' },
];
const svgRules = wrap(640, 292,
  icServer(320, 48, 'Serveurs communs', '')
  + RULES_SVC.map(s => line(s.cx, 185, 290 + RULES_SVC.indexOf(s) * 17, 76, C.ok)).join('')
  + cap(545, 120, 'acces autorise', C.ok, 11)
  + RULES_SVC.map(s => icPC(s.cx, 200, s.col) + lbl(s.cx, 238, s.name, s.col, 11) + cap(s.cx, 251, s.vlan, s.col, 10)).join('')
  + `<line x1="70" y1="266" x2="570" y2="266" stroke="${C.danger}" stroke-width="2.5" stroke-dasharray="6 5"/>`
  + cap(320, 283, 'Entre services : bloque par defaut (sauf regle explicite)', C.danger, 11));

// --- Le domaine : un compte géré au même endroit s'applique à tous les postes (icônes) ---
const svgDomain = wrap(520, 224,
  icServer(260, 50, 'Active Directory', 'comptes + GPO')
  + line(260, 77, 70, 152, C.slate) + line(260, 77, 200, 152, C.slate) + line(260, 77, 330, 152, C.slate) + line(260, 77, 460, 152, C.slate)
  + icPC(70, 165, C.dev) + icPC(200, 165, C.dev) + icPC(330, 165, C.dev) + icPC(460, 165, C.dev)
  + cap(260, 212, "Un seul compte par employe, gere au meme endroit ; les regles s'appliquent a tous."));

// --- Plan d'adressage IP (tableau HTML responsive) ---
const ipPlan = `<div style="overflow-x:auto;margin:6px 0 12px">
<table style="border-collapse:collapse;width:100%;min-width:480px;font-size:14px">
<thead><tr style="background:var(--surface-2)">
<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">Service</th>
<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">VLAN</th>
<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">Réseau</th>
<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">Passerelle</th>
<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">~ Postes</th>
</tr></thead><tbody>
${[
  ['🏭 Production', '10', '192.168.10.0/24', '192.168.10.254', '~ 200'],
  ['💶 Comptabilité', '20', '192.168.20.0/24', '192.168.20.254', '~ 30'],
  ['👥 RH', '30', '192.168.30.0/24', '192.168.30.254', '~ 30'],
  ['🎯 Direction', '40', '192.168.40.0/24', '192.168.40.254', '~ 20'],
  ['🖥️ Serveurs', '99', '192.168.99.0/24', '192.168.99.254', 'fixes'],
].map(r => `<tr>${r.map((c, i) => `<td style="padding:8px 10px;border:1px solid var(--border)${i === 0 ? ';font-weight:600' : ''}">${c}</td>`).join('')}</tr>`).join('')}
</tbody></table></div>`;

// ===================================================================================
// PAGE
// ===================================================================================
const SLUG = 'reseau-entreprise';
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Réseau · Projet', title: 'Concevoir & déployer le réseau d’une entreprise', subtitle: 'De la feuille blanche à la mise en service : un réseau multi-services (Production, Comptabilité, RH, Direction).' }),
  block('html', { html: '<p>Monter le réseau d’une entreprise, ce n’est pas « brancher des câbles ». C’est un <strong>projet en 3 phases</strong> : on <strong>conçoit</strong> (sur le papier), on <strong>installe</strong> (le matériel), puis on <strong>déploie</strong> (les postes et les services). Le fil rouge de cette page : une PME avec 4 services aux besoins différents — la <strong>Production</strong>, la <strong>Comptabilité</strong>, les <strong>RH</strong> et la <strong>Direction</strong>.</p>' }),
  note('blue', '🔎 Analogie', '<p>Pense à <strong>construire un immeuble de bureaux</strong>. D’abord l’<strong>architecte</strong> dessine les plans (conception), puis les ouvriers <strong>bâtissent les murs et tirent l’électricité</strong> (installation), enfin on <strong>installe chaque service à son étage</strong> avec ses clés et ses droits d’accès (déploiement). Un réseau, c’est le même chantier — en version numérique.</p>'),

  block('heading', { level: 2, text: 'Vue d’ensemble' }),
  block('html', { html: svgTopo }),
  block('html', { html: '<p>Plusieurs <strong>appareils distincts</strong> se relaient, chacun avec son rôle : la <strong>box du fournisseur</strong> apporte Internet, le <strong>pare-feu</strong> garde la porte, le <strong>switch cœur</strong> distribue et fait communiquer les services, et la <strong>salle serveurs</strong> héberge les services communs (annuaire, DNS, DHCP, fichiers). Chaque service vit dans son propre <strong>VLAN</strong> (réseau virtuel séparé) : on <strong>cloisonne</strong> pour la sécurité et l’organisation.</p>' }),
  block('html', { html: '<p class="meta">Ces équipements sont <strong>physiquement séparés</strong> et reliés en chaîne, chacun par son câble :</p>' }),
  block('html', { html: svgChain }),
  note('blue', '📐 C’est quoi un VLAN ?', '<p>Un <strong>VLAN</strong> (<em>Virtual LAN</em>, « réseau local <strong>virtuel</strong> ») est un <strong>réseau séparé créé par logiciel</strong> sur les switchs — <strong>sans tirer de nouveaux câbles</strong>. Il regroupe des appareils dans la même « bulle » même s’ils sont branchés sur des switchs différents, et les <strong>isole</strong> des autres bulles. Ici, chaque service a son VLAN : les postes de la Compta (192.168.<strong>20</strong>.x) et des RH (192.168.<strong>30</strong>.x) ne se voient pas, sauf règle explicite. C’est ce qui permet de <strong>cloisonner</strong> sans multiplier le matériel.</p>'),

  block('heading', { level: 2, text: 'Les 3 grandes phases' }),
  block('html', { html: svgSteps }),

  // ---------------- PHASE 1 ----------------
  block('heading', { level: 2, text: '🧭 Phase 1 — Conception (sur le papier)' }),
  block('html', { html: '<p>On ne touche à aucun matériel tant que le plan n’est pas clair. Objectif : <strong>traduire les besoins en décisions techniques</strong>.</p>' }),
  accordion([
    ['📋 Recenser les besoins', '<p>On interroge chaque service : combien de <strong>postes, imprimantes, serveurs</strong> ? Quels <strong>logiciels</strong> (ERP de prod, logiciel de paie, suite RH…) ? Quelles <strong>contraintes</strong> (la Compta et les RH manipulent des données <strong>sensibles</strong>, la Production tourne <strong>24/7</strong>). C’est le cahier des charges.</p>'],
    ['🔢 Plan d’adressage IP', `<p>On découpe l’espace d’adresses en <strong>un réseau par service</strong>, avec une logique simple et mémorisable. Un <strong>/24</strong> = 254 machines possibles, largement suffisant par service.</p>${ipPlan}`],
    ['🧩 Segmentation en VLAN', '<p>On décide de <strong>cloisonner</strong> : un <strong>VLAN par service</strong> (10, 20, 30, 40) + un VLAN serveurs (99). Avantages : <strong>sécurité</strong> (la Compta n’est pas joignable depuis la Prod), <strong>moins de bruit</strong> réseau, et des <strong>règles claires</strong> entre services.</p>'],
    ['✏️ Schéma & dimensionnement', '<p>On dessine le <strong>schéma réseau</strong> (comme la « Vue d’ensemble » ci-dessus) et on <strong>dimensionne</strong> le matériel : nombre de <strong>ports switch</strong>, débit (1 Gb/s aux postes, 10 Gb/s vers les serveurs), <strong>Wi-Fi</strong>, et la <strong>baie</strong> qui accueillera le tout.</p>'],
    ['🛒 Choisir le matériel', '<p>On liste : <strong>routeur/pare-feu</strong> (ex. Stormshield, pfSense), <strong>switchs manageables</strong> (VLAN obligatoires), <strong>bornes Wi-Fi</strong>, <strong>serveurs</strong>, <strong>onduleur</strong>, câblage et baie 19". On vise le <strong>juste besoin</strong> + une marge de croissance.</p>'],
  ]),

  // ---------------- PHASE 2 ----------------
  block('heading', { level: 2, text: '🔧 Phase 2 — Installation (le matériel)' }),
  block('html', { html: svgRack }),
  block('html', { html: '<p>On passe au concret : on monte le <strong>local technique</strong>, on câble, puis on configure les équipements actifs. Tout l’actif réseau se regroupe dans une <strong>baie 19"</strong>, ventilée et protégée par un onduleur.</p>' }),
  accordion([
    ['🧰 Baie & câblage', '<p>Pose de la <strong>baie</strong>, du <strong>bandeau de brassage</strong>, tirage des câbles vers chaque bureau (les <strong>prises murales RJ45</strong>), repérage et <strong>étiquetage</strong> de chaque lien. Un câblage propre = un dépannage facile plus tard.</p>'],
    ['🔀 Configuration des switchs (VLAN)', '<p>On crée les <strong>VLAN 10/20/30/40/99</strong> sur les switchs. Chaque <strong>port</strong> est affecté au VLAN de son service (mode « access »), et les liens entre switchs transportent tous les VLAN (mode « <strong>trunk</strong> »). C’est ici que le cloisonnement devient réel.</p>'],
    ['🛡️ Switch cœur, pare-feu & règles entre services', '<p>Le <strong>switch cœur</strong> (niveau 3) fait communiquer les VLAN entre eux ; le <strong>pare-feu</strong> contrôle ce qui passe vers Internet et applique les règles entre services : ex. « RH et Compta ↔ serveurs : oui », « Production → Compta : non ». Ce sont <strong>deux appareils séparés</strong>, chacun son rôle. Principe d’or : <strong>tout interdire, n’autoriser que le nécessaire</strong>.</p>'],
    ['🖥️ Serveurs : AD, DNS, DHCP, fichiers', '<p>On installe les services communs : <strong>Active Directory</strong> (annuaire des comptes), <strong>DNS</strong> (résolution des noms), <strong>DHCP</strong> (distribue une IP par VLAN), et le <strong>serveur de fichiers</strong> (partages par service). Voir les cours <a href="/pages/windows-server">Windows Server</a> et <a href="/pages/roles-windows-server">ses rôles</a>.</p>'],
    ['📶 Wi-Fi & onduleur', '<p>Mise en place du <strong>Wi-Fi</strong> (souvent un SSID « interne » mappé aux VLAN + un SSID « invités » <strong>isolé</strong>). L’<strong>onduleur (UPS)</strong> protège la baie des coupures et permet d’éteindre proprement les serveurs.</p>'],
  ]),

  // ---------------- PHASE 3 ----------------
  block('heading', { level: 2, text: '🚀 Phase 3 — Déploiement (mise en service)' }),
  block('html', { html: '<p>Le réseau « tient debout » : on y <strong>met les utilisateurs</strong>, on applique les règles métier, puis on <strong>vérifie et on livre</strong>.</p>' }),
  block('html', { html: svgDomain }),
  accordion([
    ['🔗 Joindre les postes au domaine', '<p>Chaque PC est <strong>rattaché à Active Directory</strong> : les employés se connectent avec <strong>leur compte</strong>, retrouvent leur environnement sur n’importe quel poste, et l’admin gère tout de façon <strong>centralisée</strong>.</p>'],
    ['⚙️ Stratégies de groupe (GPO)', '<p>Les <strong>GPO</strong> appliquent automatiquement des règles selon le service : fond d’écran, <strong>lecteurs réseau</strong> mappés, restrictions, mises à jour. On configure <strong>une fois</strong>, ça s’applique à <strong>tous</strong>.</p>'],
    ['🗂️ Partages & droits NTFS', '<p>On crée un <strong>dossier partagé par service</strong> avec les bons <strong>droits</strong> : seuls les RH lisent le dossier RH, seule la Compta accède à la paie. On respecte le <strong>moindre privilège</strong> (chacun voit ce qui le concerne, pas plus).</p>'],
    ['💾 Sauvegardes', '<p>On met en place la <strong>sauvegarde</strong> des serveurs et des données (règle <strong>3-2-1</strong> : 3 copies, 2 supports, 1 hors site). Un réseau sans sauvegarde, c’est une panne qui devient une catastrophe.</p>'],
    ['✅ Tests & recette', '<p>On vérifie <strong>méthodiquement</strong> (couche par couche, façon <a href="/pages/les-7-couches-osi">OSI</a>) : un poste de chaque service a-t-il Internet ? Accède-t-il à <strong>ses</strong> partages et <strong>pas</strong> à ceux des autres ? Le Wi-Fi invité est-il bien isolé ? On valide avec le client : c’est la <strong>recette</strong>.</p>'],
    ['📚 Documentation & livraison', '<p>On livre un <strong>dossier</strong> : schéma réseau, plan IP, mots de passe (coffre-fort), procédures. Indispensable pour la <strong>maintenance</strong> et le <a href="/pages/le-ticketing">support</a> futurs.</p>'],
  ]),

  // ---------------- PROCÉDURES ----------------
  block('heading', { level: 2, text: '🧰 Les procédures à effectuer (pas à pas)' }),
  block('html', { html: '<p class="meta">Les commandes clés de chaque étape, dans l’ordre. L’exemple reprend notre cas : VLAN 20 = Compta, serveurs en 192.168.99.x, domaine <code>entreprise.local</code>.</p>' }),
  accordion([
    ['1 · Créer un VLAN et y affecter les ports (switch)', '<p>Sur un switch <strong>manageable</strong>, on crée le VLAN du service puis on range les ports des postes dedans (exemple en CLI type Cisco).</p>' + code([
      'enable',
      'configure terminal',
      'vlan 20',
      ' name COMPTA',
      'exit',
      'interface range gigabitEthernet 0/1 - 12',
      ' switchport mode access',
      ' switchport access vlan 20',
      'end',
      'write memory',
    ])],
    ['2 · Relier les switchs entre eux (trunk)', '<p>Le câble entre le switch d’accès et le switch cœur doit transporter <strong>tous</strong> les VLAN : on le passe en <strong>trunk</strong>.</p>' + code([
      'interface gigabitEthernet 0/24',
      ' switchport mode trunk',
      ' switchport trunk allowed vlan 10,20,30,40,99',
      'end',
    ])],
    ['3 · Routage entre VLAN (switch cœur / niveau 3)', '<p>Sur le switch <strong>niveau 3</strong>, on crée une passerelle (SVI) par VLAN : c’est l’adresse <code>.254</code> que voient les postes.</p>' + code([
      'ip routing',
      'interface vlan 20',
      ' ip address 192.168.20.254 255.255.255.0',
      ' no shutdown',
    ])],
    ['4 · Distribuer les IP automatiquement (DHCP)', '<p>Une <strong>étendue DHCP</strong> par service donne une IP, la passerelle et le DNS à chaque poste qui se branche (PowerShell, Windows Server).</p>' + code([
      'Add-DhcpServerv4Scope -Name "VLAN20-Compta" `',
      '  -StartRange 192.168.20.50 -EndRange 192.168.20.200 `',
      '  -SubnetMask 255.255.255.0',
      'Set-DhcpServerv4OptionValue -ScopeId 192.168.20.0 `',
      '  -Router 192.168.20.254 -DnsServer 192.168.99.10',
    ])],
    ['5 · Installer Active Directory + DNS', '<p>On promeut le serveur en <strong>contrôleur de domaine</strong> (le DNS s’installe au passage).</p>' + code([
      'Install-WindowsFeature AD-Domain-Services -IncludeManagementTools',
      'Install-ADDSForest -DomainName "entreprise.local" `',
      '  -InstallDns -Force',
    ])],
    ['6 · Joindre un poste au domaine', '<p>Sur chaque poste, on rejoint le domaine puis on redémarre. Ensuite, les employés se connectent avec <strong>leur compte</strong>.</p>' + code([
      'Add-Computer -DomainName "entreprise.local" `',
      '  -Credential entreprise\\admin -Restart',
    ])],
    ['7 · Créer un partage + droits NTFS', '<p>Un dossier par service, accessible au <strong>seul groupe concerné</strong> (moindre privilège).</p>' + code([
      'New-Item -Path "D:\\Partages\\Compta" -ItemType Directory',
      'New-SmbShare -Name "Compta" -Path "D:\\Partages\\Compta" `',
      '  -FullAccess "entreprise\\GG_Compta"',
      'icacls "D:\\Partages\\Compta" /inheritance:r `',
      '  /grant "entreprise\\GG_Compta:(OI)(CI)M"',
    ])],
    ['8 · Créer et appliquer une GPO', '<p>On crée la stratégie, puis on la <strong>lie</strong> à l’unité d’organisation (OU) du service pour qu’elle s’applique à ses postes.</p>' + code([
      'New-GPO -Name "Compta - Lecteurs reseau"',
      'New-GPLink -Name "Compta - Lecteurs reseau" `',
      '  -Target "OU=Compta,DC=entreprise,DC=local"',
    ])],
    ['9 · Tester (recette)', '<p>Depuis un poste de chaque service, on vérifie l’IP, l’accès aux serveurs… et l’<strong>isolation</strong> entre services.</p>' + code([
      'ipconfig /all              :: bonne IP/VLAN et bonne passerelle ?',
      'ping 192.168.99.10         :: serveurs joignables ?',
      'nslookup entreprise.local  :: le DNS repond ?',
      'ping 192.168.30.11         :: depuis la Prod -> doit ECHOUER (isole)',
    ])],
  ]),
  note('yellow', '⚠️ À adapter à ton matériel', '<p>Ces commandes sont des <strong>exemples génériques</strong> (CLI type Cisco pour les switchs, PowerShell pour Windows Server). La syntaxe exacte dépend du <strong>modèle</strong> et de la <strong>version</strong> — vérifie toujours la doc du constructeur.</p>'),

  // ---------------- SÉCURITÉ ----------------
  block('heading', { level: 2, text: '🔒 Le fil rouge : cloisonner les services' }),
  block('html', { html: '<p>Pourquoi tout ce travail de VLAN et de règles ? Parce que tous les services n’ont pas les mêmes <strong>droits</strong> ni la même <strong>sensibilité</strong> :</p><ul><li>💶 <strong>Comptabilité</strong> & 👥 <strong>RH</strong> : données <strong>sensibles</strong> (paie, contrats) → accès très restreint, isolées des autres.</li><li>🏭 <strong>Production</strong> : beaucoup de postes, doit rester <strong>disponible</strong> → isolée pour ne pas être perturbée.</li><li>🎯 <strong>Direction</strong> : accès <strong>transverse</strong> à certains tableaux de bord, mais via des règles explicites.</li></ul>' }),
  block('html', { html: svgRules }),
  note('yellow', '🧠 À chacun son étage', '<p>Le VLAN est au réseau ce que la <strong>porte à badge</strong> est à l’immeuble : tout le monde travaille dans le même bâtiment, mais on ne rentre que dans <strong>les pièces autorisées</strong>. C’est le cœur de la sécurité d’un réseau d’entreprise.</p>'),

  note('green', '💡 À retenir', '<p>Un réseau d’entreprise se construit en <strong>3 phases</strong> : <strong>Conception</strong> (besoins → plan IP → VLAN → schéma → matériel), <strong>Installation</strong> (baie, câblage, switchs, pare-feu, serveurs) et <strong>Déploiement</strong> (domaine, GPO, partages, tests, doc). Le maître-mot : <strong>cloisonner</strong> chaque service et n’ouvrir que le <strong>strict nécessaire</strong>. Sigles (VLAN, AD, GPO, DHCP…) dans le <a href="/glossaire">Glossaire</a>.</p>'),
];

const PAGE = {
  slug: SLUG,
  title: 'Concevoir & déployer le réseau d’une entreprise',
  excerpt: 'Projet réseau de A à Z : conception, installation et déploiement d’un réseau multi-services (Production, Comptabilité, RH, Direction) — vulgarisé et schématisé.',
};

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

  const cur = existing.find(e => e.slug === PAGE.slug);
  const bodyJson = JSON.stringify({ title: PAGE.title, slug: PAGE.slug, excerpt: PAGE.excerpt, content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1 });
  const res = cur
    ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body: bodyJson })
    : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body: bodyJson });
  console.log(`PAGE ${PAGE.slug}`, res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());

  const cours = existing.find(e => e.slug === 'cours');
  if (cours) {
    const hubBlocks = buildHubBlocks();
    const r = await fetch(`${BASE}/api/admin/pages/${cours.id}`, { method: 'PUT', headers: h, body: JSON.stringify({ title: 'Cours', slug: 'cours', content: renderPageBlocksToHtml(hubBlocks), builder_json: serializePageBlocks(hubBlocks), published: 1 }) });
    console.log('HUB Cours', r.status, r.ok ? '(maj)' : await r.text());
  } else console.log('HUB Cours introuvable');

  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

/* Crée la page de cours « Les bases du réseau » : c'est quoi un réseau, côté hardware
   (carte réseau, câble RJ45, switch, box, Wi-Fi) et côté software (IP, MAC, masque,
   passerelle, DNS, DHCP, protocoles), avec définitions, analogies et schémas. Vulgarisé.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-bases-reseau.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);

const C = { net: '#2563eb', dev: '#059669', warn: '#d97706', danger: '#dc2626', grey: '#64748b', slate: '#475569', purple: '#7c3aed', ok: '#16a34a' };
const accordion = (it: Array<[string, string]>) => block('accordion', { items: it.map(([title, text]) => ({ title, text, href: '' })) });
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });

// ===================================================================================
// Icônes + schémas SVG
// ===================================================================================
const wrap = (w: number, h: number, inner: string) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="max-width:${w}px;width:100%;height:auto;margin:6px 0 12px;font-family:system-ui,sans-serif">${inner}</svg>`;
const line = (x1: number, y1: number, x2: number, y2: number, col = '#94a3b8') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="2.5"/>`;
const cap = (x: number, y: number, t: string, col = '#64748b', s = 11) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${s}" fill="${col}">${t}</text>`;
const lbl = (x: number, y: number, t: string, col = '#475569', s = 11) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${s}" fill="${col}" font-weight="bold">${t}</text>`;

function icCloud(cx: number, cy: number) {
  return `<g fill="${C.grey}"><ellipse cx="${cx}" cy="${cy + 9}" rx="40" ry="14"/><circle cx="${cx - 22}" cy="${cy + 3}" r="15"/><circle cx="${cx + 20}" cy="${cy + 1}" r="16"/><circle cx="${cx - 1}" cy="${cy - 9}" r="17"/></g>`
    + `<text x="${cx}" y="${cy + 7}" text-anchor="middle" font-size="12" fill="#fff" font-weight="bold">Internet</text>`;
}
function icSwitch(cx: number, cy: number, w: number, label = '', sub = '') {
  const h = 30, x = cx - w / 2, y = cy - h / 2;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${C.net}"/>`;
  const n = Math.max(3, Math.floor((w - 14) / 10));
  for (let i = 0; i < n; i++) s += `<rect x="${x + 8 + i * 10}" y="${y + h - 11}" width="7" height="7" rx="1.5" fill="#fff" fill-opacity="0.85"/>`;
  if (label) s += lbl(cx, y + h + 15, label, C.net);
  if (sub) s += cap(cx, y + h + 28, sub, '#64748b', 10);
  return s;
}
function icPC(cx: number, cy: number, color = C.net, label = '') {
  const x = cx - 16, y = cy - 13;
  let s = `<rect x="${x}" y="${y}" width="32" height="22" rx="3" fill="${color}"/><rect x="${x + 3}" y="${y + 3}" width="26" height="14" rx="1.5" fill="#e2e8f0"/>`
    + `<rect x="${cx - 4}" y="${y + 22}" width="8" height="4" fill="${color}"/><rect x="${cx - 11}" y="${y + 26}" width="22" height="3" rx="1.5" fill="${color}"/>`;
  if (label) s += lbl(cx, y + 44, label, color, 11);
  return s;
}

// Un petit réseau local (LAN) : PC ─ câble RJ45 ─ box/switch ─ Internet
const svgLan = wrap(640, 230,
  icPC(75, 80, C.dev, 'PC') + icPC(75, 175, C.dev, 'PC')
  + line(101, 76, 232, 110, C.warn) + line(101, 171, 232, 124, C.warn)
  + `<text x="150" y="86" font-size="10" fill="${C.warn}" font-weight="bold">cable RJ45</text>`
  + icSwitch(292, 117, 120, 'Box / Switch', '')
  + line(352, 117, 512, 117, C.net) + cap(432, 110, 'vers Internet', C.net, 10)
  + icCloud(560, 117)
  + cap(300, 222, 'Les appareils sont relies par cable RJ45 a une box (ou un switch), elle-meme reliee a Internet.', C.grey, 11));

// Anatomie d'un câble Ethernet + connecteur RJ45
const wires = ['#f97316', '#fdba74', '#22c55e', '#86efac', '#3b82f6', '#93c5fd', '#a16207', '#d6a23a'];
const svgRj45 = wrap(520, 190,
  `<rect x="20" y="74" width="280" height="36" rx="10" fill="${C.grey}"/>`
  + wires.map((col, i) => `<line x1="34" y1="${80 + i * 4}" x2="300" y2="${80 + i * 4}" stroke="${col}" stroke-width="2.5"/>`).join('')
  + cap(160, 132, '8 fils — 4 paires torsadees', C.slate, 11)
  + `<rect x="300" y="70" width="120" height="44" rx="5" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1.5"/>`
  + Array.from({ length: 8 }, (_, i) => `<rect x="${312 + i * 13}" y="58" width="8" height="14" rx="1" fill="#eab308"/>`).join('')
  + `<rect x="346" y="114" width="28" height="12" rx="2" fill="#94a3b8"/>`
  + `<text x="360" y="96" text-anchor="middle" font-size="11" fill="#334155" font-weight="bold">RJ45</text>`
  + cap(360, 48, 'pins dores (contacts)', C.warn, 10)
  + `<text x="382" y="124" font-size="10" fill="${C.slate}" font-weight="bold">clip</text>`
  + cap(255, 182, 'Le cable Ethernet : 4 paires de fils torsadees, serties dans un connecteur RJ45.', C.grey, 11));

// Fibre optique : multimode (cœur large, plusieurs rayons) vs monomode (cœur fin, un rayon)
const svgFiber = wrap(520, 168,
  lbl(64, 56, 'Multimode', C.warn, 11)
  + `<rect x="120" y="36" width="360" height="38" rx="6" fill="#cbd5e1"/><rect x="120" y="46" width="360" height="18" fill="#fde68a"/>`
  + `<polyline points="124,60 160,48 196,60 232,48 268,60 304,48 340,60 376,48 412,60 448,48 476,55" fill="none" stroke="${C.danger}" stroke-width="2"/>`
  + cap(300, 90, 'coeur large (~50 µm) · plusieurs rayons · courte distance', C.grey, 9)
  + lbl(64, 128, 'Monomode', C.net, 11)
  + `<rect x="120" y="112" width="360" height="28" rx="6" fill="#cbd5e1"/><rect x="120" y="122" width="360" height="8" fill="#fef08a"/>`
  + `<line x1="124" y1="126" x2="476" y2="126" stroke="${C.danger}" stroke-width="2"/>`
  + cap(300, 156, 'coeur fin (~9 µm) · un seul rayon · longue distance', C.grey, 9));

// Wi-Fi : comparaison des bandes 2,4 GHz vs 5 GHz
const wifiRows: Array<[string, string, string, string, string, string]> = [
  ['2,4 GHz', 'Plus lent', 'Plus longue', 'Traverse bien les murs', 'Élevé (Bluetooth, micro-ondes)', C.dev],
  ['5 GHz', 'Plus rapide', 'Plus courte', 'Traverse moins bien', 'Faible', C.net],
];
const wifiTable = `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:680px;font-size:14px">
<thead><tr style="background:var(--surface-2)">${['Bande', 'Débit', 'Portée', 'Obstacles (murs)', 'Encombrement'].map(c => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${c}</th>`).join('')}</tr></thead><tbody>
${wifiRows.map(([b, d, p, m, e, col]) => `<tr>`
  + `<td style="padding:8px 10px;border:1px solid var(--border);font-weight:700;color:#fff;background:${col}">${b}</td>`
  + [d, p, m, e].map(c => `<td style="padding:8px 10px;border:1px solid var(--border)">${c}</td>`).join('') + `</tr>`).join('')}
</tbody></table></div>`;

// Réseaux mobiles 3G / 4G / 5G
const xgTable = `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:520px;font-size:14px">
<thead><tr style="background:var(--surface-2)">${['Génération', 'Débit', 'Latence', 'Usage'].map(c => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${c}</th>`).join('')}</tr></thead><tbody>
${[
  ['3G', 'Faible (quelques Mb/s)', 'Élevée', 'Web et mails de base'],
  ['4G (LTE)', 'Élevé', 'Faible', 'Streaming, usage mobile courant'],
  ['5G', 'Très élevé', 'Très faible', 'Très haut débit, temps réel, objets connectés'],
].map(r => `<tr><td style="padding:8px 10px;border:1px solid var(--border);font-weight:600">${r[0]}</td>${r.slice(1).map(c => `<td style="padding:8px 10px;border:1px solid var(--border)">${c}</td>`).join('')}</tr>`).join('')}
</tbody></table></div>`;

// Fiche d'identité réseau (côté software) — HTML responsive
const idCard = `<div style="max-width:440px;border:1px solid var(--border);border-radius:12px;overflow:hidden;margin:8px 0">
<div style="background:var(--surface-2);padding:8px 12px;font-weight:600">🪪 Fiche d’identité réseau d’un PC</div>
<div style="padding:6px 12px;font-size:14px">
${[
  ['🏷️ Adresse IP', '192.168.1.10', 'son adresse sur le réseau'],
  ['🧭 Masque', '255.255.255.0', 'délimite le « quartier »'],
  ['🚪 Passerelle', '192.168.1.254', 'la porte vers l’extérieur'],
  ['📖 DNS', '8.8.8.8', 'l’annuaire des noms'],
  ['🆔 Adresse MAC', 'A1:B2:C3:D4:E5:F6', 'le n° de série de la carte'],
].map(([k, v, d]) => `<div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;padding:6px 0;border-bottom:1px dashed var(--border)"><span>${k} <span class="meta" style="font-size:12px">— ${d}</span></span><code style="white-space:nowrap">${v}</code></div>`).join('')}
</div></div>`;

// Adresses privées (LAN) derrière une seule IP publique (WAN) via NAT
const svgIpScope = wrap(620, 200,
  `<rect x="20" y="42" width="252" height="138" rx="10" fill="${C.net}" fill-opacity="0.06" stroke="${C.net}" stroke-width="1.5" stroke-dasharray="6 4"/>`
  + `<text x="30" y="60" font-size="11" fill="${C.net}" font-weight="bold">Reseau local (LAN) — 192.168.1.0/24</text>`
  + icPC(90, 102, C.dev, '192.168.1.10') + icPC(195, 102, C.dev, '192.168.1.11')
  + line(272, 104, 305, 104, C.net)
  + `<rect x="305" y="78" width="96" height="52" rx="8" fill="${C.grey}"/><text x="353" y="100" text-anchor="middle" font-size="12" fill="#fff" font-weight="bold">Box</text><text x="353" y="115" text-anchor="middle" font-size="9" fill="#e5e7eb">passerelle</text>`
  + cap(353, 146, 'cote LAN : 192.168.1.254', C.slate, 9) + cap(353, 158, 'cote WAN : 88.12.34.56', C.warn, 9)
  + line(401, 104, 510, 104, C.net) + cap(456, 96, 'NAT', C.purple, 10)
  + icCloud(552, 104)
  + cap(310, 192, 'Beaucoup d adresses privees 192.168.x.y partagent une seule IP publique (WAN) grace au NAT.', C.grey, 11));

// Ports physiques d'un switch et d'une box
const rj = (x: number, y: number, col: string) => `<rect x="${x}" y="${y}" width="28" height="20" rx="2" fill="${col}"/><rect x="${x + 10}" y="${y + 19}" width="8" height="4" rx="1" fill="${col}"/>`;
const svgPorts = wrap(620, 230,
  lbl(310, 24, 'Switch — 8 ports RJ45 identiques (tous LAN)', C.net, 11)
  + `<rect x="40" y="34" width="540" height="48" rx="6" fill="${C.net}"/>`
  + Array.from({ length: 8 }, (_, i) => rj(64 + i * 62, 50, '#e2e8f0')).join('')
  + lbl(310, 128, 'Box / Routeur — des ports LAN + 1 port WAN', C.slate, 11)
  + `<rect x="40" y="138" width="540" height="48" rx="6" fill="${C.slate}"/>`
  + rj(70, 154, '#fbbf24') + rj(140, 154, '#fbbf24') + rj(210, 154, '#fbbf24') + rj(280, 154, '#fbbf24')
  + rj(400, 154, '#60a5fa')
  + cap(180, 208, 'ports LAN (jaunes) : tes appareils', C.warn, 10)
  + cap(414, 208, 'port WAN : vers Internet', C.net, 10)
  + cap(310, 224, 'Sur un switch, tous les ports sont identiques ; sur une box, un port WAN se distingue des ports LAN.', C.grey, 11));

// Conventions d'adressage IP (tableau)
const ipConv = `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:480px;font-size:14px">
<thead><tr style="background:var(--surface-2)">${['Adresse', 'Nom', 'Rôle'].map(c => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${c}</th>`).join('')}</tr></thead><tbody>
${[
  ['127.0.0.1', 'Boucle locale (localhost)', 'La machine se parle à elle-même (test en local)'],
  ['192.168.x.y', 'Adresse privée (LAN)', 'Réseau local — aussi 10.x.x.x et 172.16–31.x.x — invisible depuis Internet'],
  ['ex. 88.12.34.56', 'IP publique (WAN)', 'L’adresse vue depuis Internet, fournie par le FAI, unique au monde'],
].map(r => `<tr>${r.map((c, i) => `<td style="padding:8px 10px;border:1px solid var(--border)${i === 0 ? ';font-weight:600;font-family:ui-monospace,monospace' : ''}">${c}</td>`).join('')}</tr>`).join('')}
</tbody></table></div>`;

// ===================================================================================
// PAGE
// ===================================================================================
const SLUG = 'bases-du-reseau';
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Réseau', title: 'Les bases du réseau', subtitle: 'Relier des machines pour communiquer : le matériel (hardware) et la logique (software).' }),
  block('html', { html: '<p>Un <strong>réseau informatique</strong>, c’est simplement <strong>plusieurs appareils reliés entre eux pour communiquer et partager</strong> : des fichiers, une imprimante, une connexion Internet. Pour que ça marche, il faut deux choses : du <strong>matériel</strong> (les câbles, les cartes, les boîtiers) et de la <strong>logique</strong> (les adresses et les règles qui organisent les échanges).</p>' }),
  note('blue', '🔎 Analogie', '<p>Pense au <strong>réseau routier</strong> d’un pays. Les <strong>routes</strong> et les <strong>carrefours</strong> sont le <strong>matériel</strong> (câbles, switchs). Les <strong>adresses</strong>, le <strong>code de la route</strong> et le <strong>GPS</strong> sont la <strong>logique</strong> (adresses IP, protocoles). Sans routes on ne circule pas ; sans adresses on ne sait pas où aller. Il faut les deux.</p>'),

  block('heading', { level: 2, text: '🌐 C’est quoi un réseau ?' }),
  block('html', { html: '<p>Dès que <strong>deux appareils ou plus</strong> sont connectés pour s’échanger des données, on parle de réseau. À la maison, ta <strong>box</strong> relie tes appareils entre eux et à Internet : c’est déjà un réseau.</p>' }),
  block('html', { html: svgLan }),
  note('blue', '🏠 Le réseau local (LAN)', '<p>Un <strong>réseau local</strong> (<em>LAN — Local Area Network</em>) est un réseau <strong>limité à un même lieu</strong> : une maison, un bureau, une salle. Les appareils y sont reliés (par <strong>câble RJ45</strong> ou <strong>Wi-Fi</strong>) à un <strong>switch</strong> ou à une <strong>box</strong>, et communiquent <strong>directement entre eux à grande vitesse</strong>, sans passer par Internet. <strong>Analogie :</strong> les pièces d’une même <strong>maison</strong> — on circule librement à l’intérieur ; pour <strong>sortir</strong>, on passe par la porte (la box).</p>'),

  block('heading', { level: 2, text: '🔌 Côté hardware — le matériel qu’on touche' }),
  block('html', { html: '<p>Le matériel, c’est tout ce qui transporte physiquement les données : la <strong>carte réseau</strong> de chaque appareil, les <strong>câbles</strong> et les <strong>boîtiers</strong> qui les relient.</p>' }),
  accordion([
    ['🖥️ La carte réseau (NIC)', '<p>La <strong>carte réseau</strong> (<em>Network Interface Card</em>) est le composant qui permet à un appareil de se connecter au réseau. C’est par elle que passent les données entrantes et sortantes, via un <strong>port RJ45</strong> (filaire) ou une <strong>antenne Wi-Fi</strong> (sans fil). Chaque carte possède une <strong>adresse MAC</strong> unique. <strong>Analogie :</strong> c’est la <strong>boîte aux lettres</strong> de la machine — le point d’entrée/sortie du courrier.</p>'],
    ['🔌 Le câble RJ45 (Ethernet)', '<p>Le <strong>câble réseau</strong> (Ethernet) transporte les données d’un appareil à l’autre. Il contient <strong>8 fils en 4 paires torsadées</strong> (le torsadage réduit les perturbations), sertis dans un connecteur <strong>RJ45</strong> qui clipse dans le port. Il existe des <strong>catégories</strong> (cat. 5e, 6, 6a…) qui montent en débit. <strong>Analogie :</strong> c’est le <strong>tuyau</strong> (ou la route) dans lequel circulent les données.</p>'],
    ['🔀 Le switch (commutateur)', '<p>Le <strong>switch</strong> relie plusieurs appareils d’un <strong>même réseau local</strong> et envoie chaque message <strong>au bon destinataire</strong>. <strong>Analogie :</strong> une <strong>standardiste</strong> qui transfère l’appel au bon poste. Détails : <a href="/pages/le-switch">cours sur le switch</a>.</p>'],
    ['📶 La box / le routeur', '<p>La <strong>box</strong> (ou le <strong>routeur</strong>) fait le lien entre ton réseau local et <strong>Internet</strong>, et distribue les adresses. <strong>Analogie :</strong> la <strong>porte d’entrée</strong> de l’immeuble vers le reste du monde. Détails : <a href="/pages/le-routeur">cours sur le routeur</a>.</p>'],
    ['📡 Le Wi-Fi (sans fil)', '<p>Le <strong>Wi-Fi</strong> remplace le câble par des <strong>ondes radio</strong> : pratique et mobile, mais plus sensible aux interférences et à la distance. <strong>Analogie :</strong> parler <strong>à voix haute</strong> dans une pièce plutôt que par un tuyau dédié.</p>'],
  ]),
  block('html', { html: svgRj45 }),

  block('heading', { level: 2, text: '🔦 La fibre optique (multimode & monomode)' }),
  block('html', { html: '<p>À côté du câble cuivre (RJ45), la <strong>fibre optique</strong> transporte les données sous forme de <strong>lumière</strong> au lieu d’électricité. Atouts : <strong>très haut débit</strong>, <strong>longues distances</strong> et <strong>insensibilité aux perturbations électromagnétiques</strong>. On l’utilise surtout entre <strong>bâtiments, entre sites et dans les datacenters</strong> (le cœur de réseau) ; le cuivre RJ45 reste pour les <strong>derniers mètres</strong> jusqu’au poste.</p>' }),
  block('html', { html: svgFiber }),
  accordion([
    ['🟧 Fibre multimode (MMF)', '<p>Cœur <strong>large</strong> (≈ 50 ou 62,5 µm) dans lequel <strong>plusieurs rayons</strong> de lumière (les « modes ») se propagent en <strong>rebondissant</strong>. Source <strong>LED / laser bon marché</strong>, pour les <strong>courtes distances</strong> (quelques centaines de mètres : bâtiment, datacenter). Moins chère — catégories <strong>OM1 à OM5</strong> (gaines souvent orange ou aqua).</p>'],
    ['🟨 Fibre monomode (SMF)', '<p>Cœur <strong>très fin</strong> (≈ 9 µm) où passe <strong>un seul rayon</strong>, bien droit. Source <strong>laser</strong>, pour les <strong>très longues distances</strong> (plusieurs km à des dizaines de km : opérateurs, liaisons inter-sites). Plus chère, portée et débit supérieurs — catégories <strong>OS1 / OS2</strong> (gaine souvent jaune).</p>'],
    ['🔌 Connecteurs & branchement', '<p>Connecteurs courants : <strong>LC</strong> (petit, le plus répandu) et <strong>SC</strong>. La fibre se raccorde aux switchs via un <strong>module SFP / SFP+</strong>. <strong>Règle simple :</strong> monomode = <strong>longue distance</strong>, multimode = <strong>courte distance</strong>.</p>'],
  ]),
  note('blue', '🔎 Analogie', '<p><strong>Multimode</strong> = un <strong>tuyau large</strong> où plusieurs faisceaux rebondissent : parfait sur de courtes distances, mais à la longue les rayons se « dispersent ». <strong>Monomode</strong> = un <strong>tuyau très fin</strong> avec un seul faisceau bien droit : il file <strong>très loin</strong> sans se brouiller.</p>'),

  block('heading', { level: 2, text: '📶 Le Wi-Fi : bandes & SSID' }),
  block('html', { html: '<p>Le <strong>Wi-Fi</strong> est un réseau local <strong>sans fil</strong> : les appareils se connectent par <strong>ondes radio</strong> à une <strong>borne</strong> (point d’accès), au lieu d’un câble. Pratique et mobile, mais plus sensible à la <strong>distance</strong> et aux <strong>obstacles</strong> (murs) que le filaire. Le Wi-Fi utilise principalement <strong>deux bandes de fréquences</strong> :</p>' }),
  block('html', { html: wifiTable }),
  note('blue', '🏷️ Le SSID, c’est quoi ?', '<p>Le <strong>SSID</strong> (<em>Service Set IDentifier</em>) est le <strong>nom du réseau Wi-Fi</strong> — celui qui apparaît dans la liste des réseaux disponibles sur ton téléphone. Une même borne peut diffuser <strong>plusieurs SSID</strong> (ex. un réseau « interne » et un réseau « invités » séparés), et un SSID peut être <strong>masqué</strong> (réseau « caché »). On le protège par un <strong>mot de passe</strong> (clé WPA2/WPA3).</p>'),

  block('heading', { level: 2, text: '📱 Les réseaux mobiles (3G / 4G / 5G)' }),
  block('html', { html: '<p>Pour accéder à Internet <strong>en mobilité</strong>, on passe par le <strong>réseau cellulaire</strong> de l’opérateur (les <strong>antennes-relais</strong>). On parle de <strong>générations</strong>, chacune plus rapide que la précédente :</p>' }),
  block('html', { html: xgTable }),
  note('green', '💡 Wi-Fi ou réseau mobile ?', '<p>Le <strong>Wi-Fi</strong> est <strong>local</strong> (ta borne, quelques dizaines de mètres). La <strong>3G/4G/5G</strong> couvre de <strong>grandes zones</strong> via l’opérateur. Sur un smartphone, on bascule automatiquement de l’un à l’autre selon la <strong>couverture</strong> disponible.</p>'),

  block('heading', { level: 2, text: '🔌 Les ports d’un switch et d’un routeur' }),
  block('html', { html: '<p>Sur un switch ou une box, un <strong>port</strong> est une <strong>prise RJ45</strong> où l’on branche un câble. Un switch aligne <strong>plusieurs ports identiques</strong> (tous pour le réseau local). Une box a des <strong>ports LAN</strong> (tes appareils) <strong>plus un port spécial WAN / Internet</strong> relié à la fibre ou l’ADSL.</p>' }),
  block('html', { html: svgPorts }),
  accordion([
    ['🔢 Combien de ports ?', '<p>Un switch existe en <strong>5, 8, 16, 24 ou 48 ports</strong>. Plus il y a d’appareils, plus il faut de ports — et on peut <strong>relier (chaîner) les switchs</strong> entre eux pour en ajouter.</p>'],
    ['🟡 Ports LAN vs 🔵 port WAN', '<p>Les <strong>ports LAN</strong> (souvent jaunes) servent à brancher tes appareils. Le <strong>port WAN</strong> (ou « Internet », d’une autre couleur) relie la box au réseau du <strong>fournisseur d’accès</strong>. Un <strong>switch n’a pas de port WAN</strong> : tous ses ports sont LAN.</p>'],
    ['💡 Les voyants & le débit', '<p>Chaque port a des <strong>voyants</strong> : un voyant <strong>fixe</strong> = câble bien branché (lien établi), un voyant <strong>clignotant</strong> = données qui circulent. Le port a aussi un <strong>débit</strong> : <strong>100 Mb/s</strong> (Fast Ethernet) ou <strong>1 Gb/s</strong> (Gigabit), parfois plus.</p>'],
  ]),
  note('yellow', '⚠️ Ne pas confondre deux sens du mot « port »', '<p>Ici, un « port » est une <strong>prise physique</strong> (RJ45) où l’on branche un câble. Il existe aussi des <strong>ports logiciels</strong> — des <strong>numéros</strong> comme <strong>80</strong> (web), <strong>443</strong> (web sécurisé), <strong>22</strong> (SSH) — qui identifient un <strong>service</strong>. C’est une autre notion, vue avec le <a href="/pages/le-pare-feu">pare-feu</a>.</p>'),

  block('heading', { level: 2, text: '🧱 Pare-feu : matériel ou virtuel' }),
  block('html', { html: '<p>Le <strong>pare-feu</strong> filtre le trafic réseau selon des règles, pour protéger le réseau (voir <a href="/pages/le-pare-feu">le cours dédié</a>). On le rencontre sous <strong>deux formes</strong> :</p><ul><li><strong>Pare-feu matériel</strong> : un <strong>boîtier physique dédié</strong>, placé en coupure entre le réseau local et Internet (ex. Stormshield, Fortinet, pfSense sur appliance). <strong>Performant et robuste</strong>, il protège <strong>tout le réseau</strong> depuis un seul point. <em>Analogie : le poste de garde à l’entrée du bâtiment.</em></li><li><strong>Pare-feu virtuel</strong> : le même rôle, mais sous forme de <strong>logiciel</strong>, exécuté dans une <strong>machine virtuelle</strong> ou sur un serveur / hyperviseur (ex. pfSense virtualisé, pare-feu intégré à un hyperviseur, Pare-feu Windows). <strong>Souple et rapide à déployer</strong>, idéal en environnement <strong>virtualisé ou cloud</strong> (voir <a href="/pages/virtualisation">la virtualisation</a>). <em>Analogie : un garde « logiciel » qu’on peut dupliquer à volonté.</em></li></ul>' }),

  block('heading', { level: 2, text: '🧠 Côté software — la logique invisible' }),
  block('html', { html: '<p>Le matériel transporte, mais il faut aussi <strong>organiser</strong> les échanges : qui est qui, où envoyer, dans quelle langue. C’est le rôle des <strong>adresses</strong> et des <strong>protocoles</strong>. Voici la « carte d’identité réseau » d’un PC :</p>' }),
  block('html', { html: idCard }),
  accordion([
    ['🏷️ L’adresse IP', '<p>L’<strong>adresse IP</strong> (ex. <code>192.168.1.10</code>) identifie un appareil <strong>sur le réseau</strong>. Elle peut <strong>changer</strong> selon le réseau où tu te connectes. <strong>Analogie :</strong> l’<strong>adresse postale</strong> (rue + numéro) — elle dit <em>où</em> livrer.</p>'],
    ['🆔 L’adresse MAC', '<p>L’<strong>adresse MAC</strong> (ex. <code>A1:B2:C3:D4:E5:F6</code>) est <strong>gravée dans la carte réseau</strong> à la fabrication et <strong>ne change pas</strong>. <strong>Analogie :</strong> le <strong>numéro de série</strong> ou la <strong>carte d’identité</strong> de l’appareil — l’IP est l’adresse du moment, la MAC est l’identité permanente.</p>'],
    ['🧭 Le masque de sous-réseau', '<p>Le <strong>masque</strong> (ex. <code>255.255.255.0</code>) indique quelle partie de l’IP désigne le <strong>réseau</strong> et quelle partie désigne la <strong>machine</strong>. Il définit le « <strong>quartier</strong> » : qui est joignable <strong>directement</strong>, et qui est « ailleurs ». <strong>Analogie :</strong> les <strong>limites du quartier</strong>.</p>'],
    ['🚪 La passerelle (gateway)', '<p>La <strong>passerelle</strong> (souvent l’IP de la box, ex. <code>192.168.1.254</code>) est la <strong>sortie</strong> du réseau local vers les autres réseaux (Internet). <strong>Analogie :</strong> la <strong>porte du quartier</strong> par laquelle on sort pour aller en ville.</p>'],
    ['📖 Le DNS', '<p>Le <strong>DNS</strong> traduit un <strong>nom</strong> (ex. <code>google.fr</code>) en <strong>adresse IP</strong>, car les machines ne parlent qu’en chiffres. <strong>Analogie :</strong> l’<strong>annuaire</strong> téléphonique (un nom → un numéro).</p>'],
    ['🎫 Le DHCP', '<p>Le <strong>DHCP</strong> <strong>attribue automatiquement</strong> une adresse IP à chaque appareil qui se connecte, pour éviter de tout configurer à la main. <strong>Analogie :</strong> l’<strong>hôtel</strong> qui te donne un <strong>numéro de chambre</strong> à l’arrivée.</p>'],
    ['🗣️ Les protocoles (TCP/IP)', '<p>Un <strong>protocole</strong> est un <strong>ensemble de règles communes</strong> pour que les machines se comprennent. La base d’Internet, c’est <strong>TCP/IP</strong>. <strong>Analogie :</strong> une <strong>langue</strong> et des règles de politesse partagées. Voir <a href="/pages/tcp-et-udp">TCP & UDP</a>.</p>'],
  ]),

  block('heading', { level: 2, text: '🔢 Les adresses IP à connaître' }),
  block('html', { html: '<p>Quelques adresses reviennent <strong>tout le temps</strong>. Trois conventions à retenir :</p>' }),
  block('html', { html: ipConv }),
  block('html', { html: svgIpScope }),
  accordion([
    ['🔁 127.0.0.1 — « localhost » (boucle locale)', '<p><code>127.0.0.1</code> est l’adresse de <strong>boucle locale</strong> : elle désigne <strong>la machine elle-même</strong>. Quand un programme contacte <code>127.0.0.1</code>, il se parle <strong>à lui-même</strong>, sans passer par le réseau. <strong>Analogie :</strong> se parler dans un <strong>miroir</strong>. Pratique pour tester un site ou un serveur <strong>en local</strong>.</p>'],
    ['🏠 192.168.x.y — les adresses privées (LAN)', '<p>Les adresses <code>192.168.x.y</code> (ainsi que <code>10.x.x.x</code> et <code>172.16–31.x.x</code>) sont <strong>privées</strong> : réservées aux <strong>réseaux locaux</strong> et <strong>invisibles depuis Internet</strong>. Ta box est souvent <code>192.168.1.254</code> et tes appareils <code>192.168.1.x</code>. <strong>Analogie :</strong> les <strong>numéros de poste</strong> internes d’une entreprise, valables seulement dans le bâtiment.</p>'],
    ['🌍 L’IP WAN (publique)', '<p>L’<strong>IP WAN</strong> (ex. <code>88.12.34.56</code>) est l’adresse <strong>publique</strong> de ta connexion, attribuée par ton <strong>fournisseur d’accès (FAI)</strong> et <strong>unique sur Internet</strong>. Tous tes appareils privés sortent <strong>derrière cette seule IP</strong> grâce au <strong>NAT</strong>. <strong>Analogie :</strong> l’<strong>adresse postale publique</strong> de l’immeuble — le facteur ne connaît pas les numéros de poste internes.</p>'],
  ]),

  block('heading', { level: 2, text: '📏 Les étendues de réseau (BAN → GAN)' }),
  block('html', { html: '<p>On classe les réseaux selon leur <strong>taille</strong>, du plus petit (autour du corps) au plus grand (la planète) :</p>' }),
  block('html', { html: `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:620px;font-size:14px"><thead><tr style="background:var(--surface-2)">${['Sigle', 'Nom', 'Portée', 'Exemple'].map(c => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${c}</th>`).join('')}</tr></thead><tbody>${([
    ['BAN', 'Body Area Network', 'Sur / autour du corps', 'Objets de santé, implants (transhumanisme)', '#16a34a'],
    ['PAN', 'Personal Area Network', 'Quelques mètres autour de soi', 'Bluetooth : montre connectée, écouteurs', '#059669'],
    ['LAN', 'Local Area Network', 'Un lieu : pièce, bâtiment', 'Le réseau d’une maison ou d’un bureau', '#2563eb'],
    ['MAN', 'Metropolitan Area Network', 'Une ville, plusieurs sites', 'Grande entreprise multi-sites, réseau d’une ville', '#1d4ed8'],
    ['WAN', 'Wide Area Network', 'Entre villes, entre pays', 'Internet, le plus grand des WAN', '#7c3aed'],
    ['GAN', 'Global Area Network', 'Mondial / planétaire', 'Réseaux mondiaux, liaisons par satellite', '#6d28d9'],
  ] as Array<[string, string, string, string, string]>).map(([s, n, p, e, col]) => `<tr><td style="padding:8px 10px;border:1px solid var(--border);font-weight:700;color:#fff;text-align:center;background:${col}">${s}</td><td style="padding:8px 10px;border:1px solid var(--border);font-weight:600">${n}</td><td style="padding:8px 10px;border:1px solid var(--border)">${p}</td><td style="padding:8px 10px;border:1px solid var(--border)">${e}</td></tr>`).join('')}</tbody></table></div>` }),
  block('html', { html: '<p>⚡ Le <strong>débit</strong> se mesure en <strong>Mb/s</strong> ou <strong>Gb/s</strong> : c’est la <strong>vitesse</strong> de circulation des données. La <strong>bande passante</strong>, c’est la <strong>largeur du tuyau</strong>.</p>' }),

  note('green', '💡 À retenir', '<p>Un réseau = du <strong>hardware</strong> (carte réseau, câble RJ45, switch, box) qui <strong>transporte</strong>, et du <strong>software</strong> (IP, MAC, masque, passerelle, DNS, DHCP, protocoles) qui <strong>organise</strong>. L’<strong>IP</strong> = l’adresse du moment ; la <strong>MAC</strong> = l’identité gravée. Pour aller plus loin : <a href="/pages/le-switch">switch</a>, <a href="/pages/le-routeur">routeur</a>, <a href="/pages/les-7-couches-osi">les 7 couches OSI</a>, <a href="/pages/tcp-et-udp">TCP & UDP</a>. Sigles dans le <a href="/glossaire">Glossaire</a>.</p>'),
];

const PAGE = {
  slug: SLUG,
  title: 'Les bases du réseau',
  excerpt: 'Les bases du réseau expliquées simplement : carte réseau, câble RJ45, côté hardware et côté software (IP, MAC, masque, passerelle, DNS, DHCP), avec définitions et analogies.',
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

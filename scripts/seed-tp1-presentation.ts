/* Crée la page « TP1 — Réussir la présentation (cybercafé eSport) » : méthode complète
   pour répondre au cahier des charges, structurer la présentation, faire le devis,
   vulgariser la notion imposée, réussir l'oral — + LE SCHÉMA RÉSEAU IDÉAL du TP
   (image SVG + fichier draw.io éditable téléchargeable). Basé sur l'énoncé du TP1.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-tp1-presentation.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);

const C = { net: '#2563eb', dev: '#059669', warn: '#d97706', danger: '#dc2626', grey: '#64748b', slate: '#475569', purple: '#7c3aed', ok: '#16a34a' };
const accordion = (it: Array<[string, string]>) => block('accordion', { items: it.map(([title, text]) => ({ title, text, href: '' })) });
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });

// ===================================================================================
// Helpers SVG + bibliothèque d'icônes
// ===================================================================================
const wrap = (w: number, h: number, inner: string) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="max-width:${w}px;width:100%;height:auto;margin:6px 0 12px;font-family:system-ui,sans-serif">${inner}</svg>`;
const line = (x1: number, y1: number, x2: number, y2: number, col = '#94a3b8') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="2.5"/>`;
const cap = (x: number, y: number, t: string, col = '#64748b', s = 11) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${s}" fill="${col}">${t}</text>`;
const lbl = (x: number, y: number, t: string, col = '#475569', s = 11) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${s}" fill="${col}" font-weight="bold">${t}</text>`;
const rlbl = (x: number, y: number, t: string, col: string, s = 10) => `<text x="${x}" y="${y}" font-size="${s}" fill="${col}" font-weight="bold">${t}</text>`;
const ipText = (x: number, y: number, t: string) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="9" fill="#475569" font-family="ui-monospace,monospace">${t}</text>`;
const zone = (x: number, y: number, w: number, h: number, col: string, label: string) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${col}" fill-opacity="0.07" stroke="${col}" stroke-width="1.5" stroke-dasharray="6 4"/>`
  + `<text x="${x + 10}" y="${y + 16}" font-size="11" fill="${col}" font-weight="bold">${label}</text>`;

function icCloud(cx: number, cy: number) {
  return `<g fill="${C.grey}"><ellipse cx="${cx}" cy="${cy + 9}" rx="40" ry="14"/><circle cx="${cx - 22}" cy="${cy + 3}" r="15"/><circle cx="${cx + 20}" cy="${cy + 1}" r="16"/><circle cx="${cx - 1}" cy="${cy - 9}" r="17"/></g>`
    + `<text x="${cx}" y="${cy + 7}" text-anchor="middle" font-size="12" fill="#fff" font-weight="bold">Internet</text>`;
}
function icBox(cx: number, cy: number, label = 'Box FAI') {
  const w = 58, h = 38, x = cx - w / 2, y = cy - h / 2;
  return `<line x1="${cx - 12}" y1="${y - 12}" x2="${cx - 12}" y2="${y}" stroke="${C.slate}" stroke-width="2"/><line x1="${cx + 12}" y1="${y - 12}" x2="${cx + 12}" y2="${y}" stroke="${C.slate}" stroke-width="2"/>`
    + `<circle cx="${cx - 12}" cy="${y - 13}" r="3" fill="${C.slate}"/><circle cx="${cx + 12}" cy="${y - 13}" r="3" fill="${C.slate}"/>`
    + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${C.grey}"/>`
    + `<circle cx="${x + 13}" cy="${y + h - 9}" r="3" fill="#4ade80"/><circle cx="${x + 25}" cy="${y + h - 9}" r="3" fill="#fbbf24"/><circle cx="${x + 37}" cy="${y + h - 9}" r="3" fill="#60a5fa"/>`
    + (label ? lbl(cx, y + h + 15, label, C.slate) : '');
}
function icWall(cx: number, cy: number, label = 'Pare-feu') {
  const w = 54, h = 44, x = cx - w / 2, y = cy - h / 2;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${C.danger}"/>`;
  for (let r = 1; r < 4; r++) s += `<line x1="${x}" y1="${y + r * h / 4}" x2="${x + w}" y2="${y + r * h / 4}" stroke="#ffffff" stroke-opacity="0.5" stroke-width="1.5"/>`;
  const rows = [[x + w / 3, x + 2 * w / 3], [x + w / 6, x + w / 2, x + 5 * w / 6], [x + w / 3, x + 2 * w / 3], [x + w / 6, x + w / 2, x + 5 * w / 6]];
  rows.forEach((xs, ri) => { const y0 = y + ri * h / 4; xs.forEach(xx => { s += `<line x1="${xx}" y1="${y0}" x2="${xx}" y2="${y0 + h / 4}" stroke="#ffffff" stroke-opacity="0.5" stroke-width="1.5"/>`; }); });
  return s + (label ? lbl(cx, y + h + 15, label, C.danger) : '');
}
function icSwitch(cx: number, cy: number, w: number, label = 'Switch', sub = '') {
  const h = 28, x = cx - w / 2, y = cy - h / 2;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${C.net}"/>`;
  const n = Math.max(3, Math.floor((w - 14) / 10));
  for (let i = 0; i < n; i++) s += `<rect x="${x + 8 + i * 10}" y="${y + h - 11}" width="7" height="7" rx="1.5" fill="#fff" fill-opacity="0.85"/>`;
  if (label) s += lbl(cx, y + h + 15, label, C.net);
  if (sub) s += cap(cx, y + h + 28, sub, '#64748b', 10);
  return s;
}
function icServer(cx: number, cy: number, label = 'Serveur', sub = '') {
  const w = 46, h = 54, x = cx - w / 2, y = cy - h / 2;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${C.slate}"/>`;
  for (let i = 0; i < 3; i++) { const yy = y + 8 + i * 15; s += `<rect x="${x + 6}" y="${yy}" width="${w - 12}" height="10" rx="2" fill="#ffffff" fill-opacity="0.14"/><circle cx="${x + 12}" cy="${yy + 5}" r="2.4" fill="#4ade80"/>`; }
  if (label) s += lbl(cx, y + h + 15, label, C.slate);
  if (sub) s += cap(cx, y + h + 28, sub, '#64748b', 10);
  return s;
}
function icPC(cx: number, cy: number, color: string = C.net, ip = '') {
  const x = cx - 16, y = cy - 13;
  let s = `<rect x="${x}" y="${y}" width="32" height="22" rx="3" fill="${color}"/><rect x="${x + 3}" y="${y + 3}" width="26" height="14" rx="1.5" fill="#e2e8f0"/>`
    + `<rect x="${cx - 4}" y="${y + 22}" width="8" height="4" fill="${color}"/><rect x="${cx - 11}" y="${y + 26}" width="22" height="3" rx="1.5" fill="${color}"/>`;
  if (ip) s += ipText(cx, y + 42, ip);
  return s;
}
function icAP(cx: number, cy: number, label = 'Wi-Fi') {
  const w = 44, h = 18, x = cx - w / 2, y = cy - h / 2;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${C.dev}"/><circle cx="${cx}" cy="${y - 2}" r="2" fill="${C.dev}"/>`;
  for (let i = 1; i <= 3; i++) { const r = 5 + i * 6; s += `<path d="M ${cx - r} ${y - 2} A ${r} ${r} 0 0 0 ${cx + r} ${y - 2}" fill="none" stroke="${C.dev}" stroke-width="2" stroke-opacity="${1 - i * 0.22}"/>`; }
  return s + (label ? lbl(cx, y + h + 14, label, C.dev) : '');
}

// ===================================================================================
// LE SCHÉMA RÉSEAU IDÉAL DU TP (cybercafé eSport)
// ===================================================================================
const tpInner =
  // Internet + hébergement VPS + autre site (VPN)
  icCloud(360, 52)
  + line(400, 52, 500, 58, C.net) + icServer(540, 58, 'VPS hebergeur', 'site web')
  + `<rect x="118" y="30" width="96" height="44" rx="8" fill="${C.slate}"/><text x="166" y="57" text-anchor="middle" font-size="12" fill="#fff" font-weight="bold">Autre site</text>`
  + `<line x1="214" y1="52" x2="320" y2="52" stroke="${C.purple}" stroke-width="2.5" stroke-dasharray="7 5"/>`
  + `<text x="266" y="44" text-anchor="middle" font-size="11" fill="${C.purple}" font-weight="bold">VPN</text>`
  // Colonne vertébrale : Box -> Pare-feu/VPN -> Switch Gigabit
  + line(360, 80, 360, 109, C.slate) + icBox(360, 128, '') + rlbl(392, 132, 'Box FAI', C.slate)
  + line(360, 147, 360, 168, C.slate) + icWall(360, 190, '') + rlbl(392, 194, 'Pare-feu + VPN', C.danger)
  + line(360, 212, 360, 238, C.slate) + icSwitch(360, 252, 150, '', '') + rlbl(440, 256, 'Switch Gigabit', C.net)
  + line(360, 266, 360, 290, C.slate)
  // Bus de distribution vers les 3 zones
  + line(185, 290, 626, 290, C.slate) + line(185, 290, 185, 305, C.slate) + line(446, 290, 446, 305, C.slate) + line(626, 290, 626, 305, C.slate)
  + zone(20, 305, 330, 160, C.net, 'Postes gaming — VLAN 10 · 192.168.10.0/24')
  + zone(362, 305, 168, 160, C.purple, 'Staff — VLAN 20')
  + zone(542, 305, 168, 160, C.dev, 'Wi-Fi clients — VLAN 30 (isole)')
  // Gaming : 4 postes en étoile sur le switch
  + line(185, 318, 75, 365, C.net) + line(185, 318, 150, 365, C.net) + line(185, 318, 225, 365, C.net) + line(185, 318, 300, 365, C.net)
  + icPC(75, 378, C.net, '.11') + icPC(150, 378, C.net, '.12') + icPC(225, 378, C.net, '.13') + icPC(300, 378, C.net, '.14')
  + cap(185, 452, 'LAN Gigabit — jeu en reseau', C.slate, 10)
  // Staff : poste montage + portable CM
  + line(446, 318, 408, 372, C.purple) + line(446, 318, 486, 372, C.purple)
  + lbl(408, 360, 'Montage', C.purple, 10) + icPC(408, 388, C.purple, '.11')
  + lbl(486, 360, 'Portable CM', C.purple, 10) + icPC(486, 388, C.purple, '.12')
  // Wi-Fi clients : borne + 2 clients isolés
  + line(626, 305, 626, 335, C.dev) + icAP(626, 344, 'Borne Wi-Fi')
  + line(626, 357, 588, 405, C.dev) + line(626, 357, 664, 405, C.dev)
  + icPC(588, 418, C.dev, '') + icPC(664, 418, C.dev, '') + cap(626, 452, 'acces clients isole', C.slate, 10)
  + cap(360, 476, 'Postes gaming en LAN Gigabit · staff et clients separes en VLAN · VPN inter-sites · site web en VPS.', C.grey, 11);
const svgTpNet = wrap(720, 480, tpInner);

// ===================================================================================
// SCHÉMA : le plan de présentation (vignettes de diapos)
// ===================================================================================
function slide(x: number, y: number, n: number, title: string): string {
  return `<rect x="${x}" y="${y}" width="200" height="64" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>`
    + `<rect x="${x}" y="${y}" width="36" height="64" rx="8" fill="${C.net}"/><rect x="${x + 28}" y="${y}" width="8" height="64" fill="${C.net}"/>`
    + `<text x="${x + 18}" y="${y + 39}" text-anchor="middle" font-size="20" fill="#fff" font-weight="bold">${n}</text>`
    + `<text x="${x + 46}" y="${y + 37}" font-size="12" fill="#334155" font-weight="bold">${title}</text>`;
}
const DECK = ['Page de titre', 'Contexte & besoins', 'Solution (synthèse)', 'Postes gaming x4', 'Poste montage video', 'Portable Com. Manager', 'Amenagement & cablage', 'Reseau & interconnexion', 'Wi-Fi + VPN inter-sites', 'Hebergement web', 'Notion (RAID, sauv...)', 'Devis & conclusion'];
const cols = [20, 240, 460], rows = [16, 96, 176, 256];
const svgDeck = wrap(680, 340, DECK.map((t, i) => slide(cols[i % 3], rows[Math.floor(i / 3)], i + 1, t)).join(''));

// Devis exemple (tableau HTML responsive)
const devis = `<div style="overflow-x:auto;margin:6px 0 12px">
<table style="border-collapse:collapse;width:100%;min-width:560px;font-size:14px">
<thead><tr style="background:var(--surface-2)">
${['Élément', 'Détail / modèle type', 'Qté', 'P.U. ≈', 'Total ≈'].map(c => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${c}</th>`).join('')}
</tr></thead><tbody>
${[
  ['PC gaming', 'Ryzen 7 / RTX 4060 / 32 Go / SSD 1 To', '4', '1 100 €', '4 400 €'],
  ['Périphériques gaming', 'Écran 165 Hz, clavier méca, souris, casque', '4', '350 €', '1 400 €'],
  ['Poste montage vidéo', 'i7 / RTX / 32 Go / SSD NVMe (Première Pro)', '1', '1 600 €', '1 600 €'],
  ['Portable Com. Manager', '14" léger, 16 Go, SSD 512 Go', '1', '900 €', '900 €'],
  ['Réseau & câblage', 'Switch Gigabit, RJ45 cat. 6 F/UTP, prises', '1', '400 €', '400 €'],
  ['Wi-Fi + VPN', 'Borne Wi-Fi 6 + routeur/pare-feu VPN', '1', '500 €', '500 €'],
  ['Hébergement web', 'VPS performant + nom de domaine (/an)', '1', '240 €', '240 €'],
].map(r => `<tr>${r.map((c, i) => `<td style="padding:8px 10px;border:1px solid var(--border)${i === 0 ? ';font-weight:600' : ''}">${c}</td>`).join('')}</tr>`).join('')}
<tr style="background:var(--surface-2);font-weight:700"><td colspan="4" style="padding:8px 10px;border:1px solid var(--border);text-align:right">Total estimatif (hors main-d’œuvre)</td><td style="padding:8px 10px;border:1px solid var(--border)">≈ 9 440 €</td></tr>
</tbody></table></div>`;

// ===================================================================================
// FICHIER draw.io (modèle rééditable) — XML mxGraph dans un SVG éditable
// ===================================================================================
const DRAWIO_NAME = 'schema-reseau-tp1.drawio.svg';
const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const NET = 'sketch=0;html=1;outlineConnect=0;labelBackgroundColor=#ffffff;verticalLabelPosition=bottom;verticalAlign=top;';
const mcell = (id: string, value: string, style: string, x: number, y: number, w: number, h: number) =>
  `<mxCell id="${id}" value="${escAttr(value).replace(/\n/g, '&#10;')}" style="${style}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`;
const medge = (id: string, src: string, tgt: string, extra = '') =>
  `<mxCell id="${id}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=none;strokeColor=#64748b;${extra}" edge="1" parent="1" source="${src}" target="${tgt}"><mxGeometry relative="1" as="geometry"/></mxCell>`;

function buildMxfile(): string {
  const cells = [
    mcell('zgame', 'Postes gaming — VLAN 10 (192.168.10.0/24)', 'rounded=1;dashed=1;html=1;whiteSpace=wrap;fillColor=#eff6ff;strokeColor=#2563eb;align=left;verticalAlign=top;spacingLeft=8;spacingTop=4;fontStyle=1;fontColor=#1d4ed8;', 40, 500, 360, 180),
    mcell('zstaff', 'Staff — VLAN 20 (192.168.20.0/24)', 'rounded=1;dashed=1;html=1;whiteSpace=wrap;fillColor=#f5f3ff;strokeColor=#7c3aed;align=left;verticalAlign=top;spacingLeft=8;spacingTop=4;fontStyle=1;fontColor=#6d28d9;', 420, 500, 180, 180),
    mcell('zwifi', 'Wi-Fi clients — VLAN 30 (isolé)', 'rounded=1;dashed=1;html=1;whiteSpace=wrap;fillColor=#ecfdf5;strokeColor=#059669;align=left;verticalAlign=top;spacingLeft=8;spacingTop=4;fontStyle=1;fontColor=#047857;', 620, 500, 180, 180),
    mcell('title', "Schéma réseau — TP1 cybercafé eSport\nAuteur : ______    Date : ______    v1.0", 'rounded=0;html=1;whiteSpace=wrap;fillColor=#f8fafc;strokeColor=#475569;align=left;verticalAlign=top;spacing=6;fontSize=11;', 40, 16, 420, 46),
    mcell('net', 'Internet', NET + 'shape=mxgraph.networks.cloud;fillColor=#e2e8f0;strokeColor=#64748b;verticalLabelPosition=middle;verticalAlign=middle;', 300, 90, 120, 70),
    mcell('vps', 'VPS hébergeur\nsite web', NET + 'shape=mxgraph.networks.server;fillColor=#cbd5e1;strokeColor=#475569;', 520, 95, 56, 64),
    mcell('site2', 'Autre site', 'rounded=1;html=1;whiteSpace=wrap;fillColor=#475569;fontColor=#ffffff;strokeColor=#334155;', 110, 100, 100, 50),
    mcell('box', 'Box FAI', NET + 'shape=mxgraph.networks.modem;fillColor=#cbd5e1;strokeColor=#475569;', 320, 200, 80, 50),
    mcell('fw', 'Pare-feu + VPN', NET + 'shape=mxgraph.networks.firewall;fillColor=#fecaca;strokeColor=#dc2626;', 324, 290, 72, 74),
    mcell('sw', 'Switch Gigabit (LAN)', NET + 'shape=mxgraph.networks.switch;fillColor=#bfdbfe;strokeColor=#2563eb;', 290, 400, 140, 46),
    mcell('pc1', 'PC gaming 192.168.10.11', NET + 'shape=mxgraph.networks.pc;fillColor=#bfdbfe;strokeColor=#2563eb;', 60, 560, 56, 58),
    mcell('pc2', 'PC gaming 192.168.10.12', NET + 'shape=mxgraph.networks.pc;fillColor=#bfdbfe;strokeColor=#2563eb;', 150, 560, 56, 58),
    mcell('pc3', 'PC gaming 192.168.10.13', NET + 'shape=mxgraph.networks.pc;fillColor=#bfdbfe;strokeColor=#2563eb;', 240, 560, 56, 58),
    mcell('pc4', 'PC gaming 192.168.10.14', NET + 'shape=mxgraph.networks.pc;fillColor=#bfdbfe;strokeColor=#2563eb;', 330, 560, 56, 58),
    mcell('mont', 'Poste montage\n192.168.20.11', NET + 'shape=mxgraph.networks.pc;fillColor=#ddd6fe;strokeColor=#7c3aed;', 438, 560, 56, 58),
    mcell('cm', 'Portable CM\n192.168.20.12', NET + 'shape=mxgraph.networks.laptop;fillColor=#ddd6fe;strokeColor=#7c3aed;', 520, 560, 56, 58),
    mcell('ap', 'Borne Wi-Fi', NET + 'shape=mxgraph.networks.wireless_access_point;fillColor=#bbf7d0;strokeColor=#059669;', 662, 540, 56, 46),
    mcell('cl1', 'Client', NET + 'shape=mxgraph.networks.laptop;fillColor=#bbf7d0;strokeColor=#059669;', 632, 620, 46, 40),
    mcell('cl2', 'Client', NET + 'shape=mxgraph.networks.laptop;fillColor=#bbf7d0;strokeColor=#059669;', 700, 620, 46, 40),
    mcell('leg', 'Légende\nBleu = postes gaming (LAN Gigabit)   Violet = staff   Vert = Wi-Fi clients isolé\nVPN = liaison chiffrée vers l’autre site   VPS = site web hébergé à l’extérieur', 'rounded=0;html=1;whiteSpace=wrap;fillColor=#ffffff;strokeColor=#cbd5e1;align=left;verticalAlign=top;spacing=6;fontSize=10;', 40, 700, 560, 70),
    medge('e1', 'net', 'vps'), medge('e2', 'site2', 'fw', 'dashed=1;strokeColor=#7c3aed;'),
    medge('e3', 'net', 'box'), medge('e4', 'box', 'fw'), medge('e5', 'fw', 'sw'),
    medge('e6', 'sw', 'pc1'), medge('e7', 'sw', 'pc2'), medge('e8', 'sw', 'pc3'), medge('e9', 'sw', 'pc4'),
    medge('e10', 'sw', 'mont'), medge('e11', 'sw', 'cm'), medge('e12', 'sw', 'ap'),
    medge('e13', 'ap', 'cl1'), medge('e14', 'ap', 'cl2'),
  ].join('');
  return `<mxfile host="app.diagrams.net" type="device"><diagram id="reseau-tp1" name="Reseau TP1"><mxGraphModel dx="1100" dy="800" grid="1" gridSize="10" guides="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}</root></mxGraphModel></diagram></mxfile>`;
}
const editableSvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="720" height="480" viewBox="0 0 720 480" content="${escAttr(buildMxfile())}">${tpInner}</svg>`;

// ===================================================================================
// PAGE
// ===================================================================================
const SLUG = 'tp1-presentation-cybercafe';
function buildBlocks(downloadUrl: string): PageBlock[] {
  return [
  block('hero', { eyebrow: 'TSSR · TP1', title: 'Réussir la présentation du TP1', subtitle: 'Équiper un cybercafé orienté eSport — devis, présentation et réponse au cahier des charges.' }),
  block('html', { html: '<p>Le gérant d’un <strong>cybercafé</strong> veut développer son activité autour de l’<strong>eSport</strong> et de l’<strong>organisation d’événements</strong>. Il te demande une <strong>solution complète</strong> pour équiper son établissement. Ton rendu : un <strong>devis</strong>, une <strong>présentation</strong> et une <strong>réponse au cahier des charges</strong>. Cette page te donne la <strong>méthode</strong> pour viser la meilleure note.</p>' }),
  note('blue', '🎯 Les 3 livrables', '<p>Ne perds jamais de vue ce qui est demandé : <strong>1)</strong> un <strong>devis</strong> chiffré et réaliste · <strong>2)</strong> une <strong>présentation</strong> (PowerPoint) claire · <strong>3)</strong> une <strong>réponse au cahier des charges</strong> point par point. Tout le reste sert ces trois objectifs.</p>'),

  block('heading', { level: 2, text: '📋 Comment tu es noté' }),
  block('html', { html: '<p>Garde ces <strong>6 critères</strong> sous les yeux : chaque diapo doit en servir au moins un.</p><ol><li><strong>Qualité de la présentation</strong> — devis et choix clairs, organisés (modèles, specs, coûts).</li><li><strong>Adéquation du matériel</strong> — montrer qu’on a compris les besoins et <strong>justifier</strong> chaque choix.</li><li><strong>Interconnexion des postes</strong> — comment les relier pour <strong>jouer ensemble</strong> (composants, schéma).</li><li><strong>Mise en place du serveur web</strong> — fiabilité et sécurité (logiciels, configuration).</li><li><strong>Solutions alternatives</strong> — un plan B si coût ou contrainte technique.</li><li><strong>Explications</strong> — rendre le <strong>vocabulaire</strong> compréhensible à un public <strong>non initié</strong>.</li></ol>' }),

  block('heading', { level: 2, text: '🗂️ Le plan de présentation idéal' }),
  block('html', { html: '<p>Une bonne présentation <strong>raconte une histoire</strong> : on part du besoin, on déroule la solution, on chiffre, on conclut. Voici un déroulé prêt à l’emploi (≈ 12 diapos) :</p>' }),
  block('html', { html: svgDeck }),
  note('green', '🧭 La règle d’or', '<p><strong>1 idée = 1 diapo.</strong> Peu de texte, des <strong>visuels</strong> (photos de matériel, schéma réseau, tableau du devis), et on <strong>justifie</strong> toujours : « ce composant, pour ce besoin, parce que… ».</p>'),

  block('heading', { level: 2, text: '🖼️ Exemple complet de chaque diapo' }),
  block('html', { html: '<p>Le contenu prêt à reprendre, <strong>diapo par diapo</strong> (adapte les chiffres et les modèles à ta solution). Chaque fiche indique <strong>ce qui va sur la diapo</strong> et <strong>ce qu’il faut dire à l’oral</strong>.</p>' }),
  accordion([
    ['1 · Page de titre', '<p><strong>Sur la diapo :</strong></p><ul><li><strong>Titre :</strong> « Équipement & réseau — Cybercafé eSport »</li><li>Sous-titre : projet TSSR + noms du groupe</li><li>Date + un visuel (logo, photo gaming)</li></ul><p class="meta">🎙️ À l’oral : « Bonjour, nous sommes [groupe], voici notre proposition pour le cybercafé. »</p>'],
    ['2 · Contexte & besoins', '<p><strong>Sur la diapo :</strong></p><ul><li>Le client : gérant d’un cybercafé qui se lance dans l’<strong>eSport</strong> et l’<strong>événementiel</strong></li><li>Ses besoins en liste courte : 4 postes gaming, poste montage vidéo, portable CM, hébergement web, câblage, partage inter-sites + Wi-Fi clients</li></ul><p class="meta">🎙️ À l’oral : reformule le besoin avec tes mots pour montrer que tu l’as compris.</p>'],
    ['3 · Solution (synthèse)', '<p><strong>Sur la diapo :</strong> la proposition en un coup d’œil (4-5 puces) :</p><ul><li>Matériel : 4 PC gaming + poste montage + portable</li><li>Réseau : switch Gigabit, VLAN, Wi-Fi clients isolé, VPN</li><li>Web : hébergement VPS sécurisé</li><li>Budget global : <strong>≈ 9 500 €</strong></li></ul><p class="meta">🎙️ À l’oral : « Voici notre solution en résumé ; on détaille ensuite chaque point. »</p>'],
    ['4 · Postes gaming ×4', '<p><strong>Sur la diapo :</strong> une config type + photo + prix.</p><ul><li>Tour : <strong>Ryzen 7 / RTX 4060 / 32 Go / SSD 1 To</strong></li><li>Périphériques : écran <strong>165 Hz</strong>, clavier mécanique, souris, casque</li><li>Pourquoi : fait tourner les jeux populaires en haute qualité, faible latence</li><li>Prix : 4 × (PC + périph.) = <strong>5 800 €</strong></li></ul><p class="meta">🎙️ À l’oral : justifie le GPU et la fréquence d’écran (fluidité = avantage compétitif).</p>'],
    ['5 · Poste montage vidéo', '<p><strong>Sur la diapo :</strong></p><ul><li>Config : <strong>i7/Ryzen 9, RTX, 32 Go, SSD NVMe</strong>, double écran</li><li>Logiciel : <strong>Adobe Première Pro</strong> (rappelle ses exigences système)</li><li>Pourquoi : le montage vidéo exige CPU + RAM + GPU</li><li>Prix : <strong>1 600 €</strong></li></ul><p class="meta">🎙️ À l’oral : montre que ta config dépasse les exigences d’Adobe.</p>'],
    ['6 · Portable Community Manager', '<p><strong>Sur la diapo :</strong></p><ul><li>Portable <strong>14"</strong>, léger, 16 Go, SSD, bonne autonomie</li><li>Usage : réseaux sociaux, communication, déplacements sur les événements</li><li>Prix : <strong>900 €</strong></li></ul><p class="meta">🎙️ À l’oral : explique pourquoi la mobilité prime sur la puissance.</p>'],
    ['7 · Aménagement & câblage', '<p><strong>Sur la diapo :</strong> le compte précis.</p><ul><li>Prises électriques : ~<strong>2 par poste</strong> (PC + écran) → multiprises ondulées</li><li>Prises réseau <strong>RJ45</strong> : 1 par poste + serveurs</li><li>Câble : <strong>cat. 6 F/UTP</strong> (blindé, Gigabit)</li><li>Switch <strong>Gigabit</strong></li></ul><p class="meta">🎙️ À l’oral : pourquoi le filaire pour le gaming (stabilité, latence).</p>'],
    ['8 · Réseau & interconnexion', '<p><strong>Sur la diapo :</strong> <strong>le schéma réseau</strong> (celui de cette page) en grand.</p><ul><li>4 PC gaming reliés au <strong>switch Gigabit</strong> → jeu en LAN</li><li>Segmentation <strong>VLAN</strong> : gaming / staff / clients</li></ul><p class="meta">🎙️ À l’oral : explique comment les joueurs jouent ensemble (même LAN, faible latence).</p>'],
    ['9 · Wi-Fi + VPN inter-sites', '<p><strong>Sur la diapo :</strong></p><ul><li><strong>Wi-Fi clients</strong> sécurisé (WPA2/3) et <strong>isolé</strong> du réseau interne</li><li><strong>VPN</strong> entre les sites : partage de ressources chiffré</li></ul><p class="meta">🎙️ À l’oral : insiste sur la séparation clients / interne (sécurité).</p>'],
    ['10 · Hébergement web', '<p><strong>Sur la diapo :</strong></p><ul><li>Choix : <strong>VPS</strong> (performances, bande passante, évolutivité)</li><li>Sécurisation : <strong>HTTPS</strong>, sauvegardes, mises à jour, pare-feu</li><li>Prix : <strong>≈ 240 €/an</strong> (VPS + nom de domaine)</li></ul><p class="meta">🎙️ À l’oral : pourquoi un VPS plutôt qu’un mutualisé (pics d’audience eSport).</p>'],
    ['11 · La notion (vulgarisée)', '<p><strong>Sur la diapo :</strong> la notion choisie par ton groupe (RAID, sauvegarde, hébergement ou parc), expliquée avec <strong>1 schéma</strong> et une <strong>analogie</strong>.</p><ul><li>Définition simple en 1 phrase</li><li>Les variantes (ex. RAID 0 / 1 / 5 / 10)</li><li>Pourquoi c’est utile pour le cybercafé</li></ul><p class="meta">🎙️ À l’oral : vulgarise pour un public non initié, sans jargon.</p>'],
    ['12 · Devis & conclusion', '<p><strong>Sur la diapo :</strong></p><ul><li>Le <strong>tableau du devis</strong> + <strong>total</strong></li><li>Une <strong>alternative moins chère</strong> (ex. carte graphique de génération précédente)</li><li>Conclusion : la solution répond à <strong>tous</strong> les besoins</li></ul><p class="meta">🎙️ À l’oral : conclus, remercie, et ouvre aux questions.</p>'],
  ]),

  block('heading', { level: 2, text: '🧩 Répondre au cahier des charges, point par point' }),
  accordion([
    ['🎮 4 postes gaming + périphériques', '<p><strong>À fournir :</strong> 4 PC aux <strong>performances optimales</strong> pour le jeu en ligne (CPU récent, <strong>carte graphique dédiée</strong>, 16–32 Go RAM, SSD), + écran haute fréquence (144/165 Hz), clavier, souris, casque. <strong>Le réflexe :</strong> appuie-toi sur les <strong>specs recommandées</strong> des jeux populaires du moment et justifie le GPU/CPU. Voir <a href="/pages/le-processeur">le processeur</a> et <a href="/pages/hardware">le hardware</a>.</p>'],
    ['🎬 Poste développeur / graphiste (Adobe Première Pro)', '<p><strong>À fournir :</strong> une machine taillée pour le <strong>montage vidéo</strong> — CPU puissant, <strong>32 Go de RAM</strong>, GPU compatible, SSD NVMe rapide, double écran utile. <strong>Le réflexe :</strong> reprends les <strong>exigences système</strong> d’Adobe Première Pro et montre que ta config les dépasse.</p>'],
    ['📱 PC portable Community Manager', '<p><strong>À fournir :</strong> un <strong>portable</strong> léger et autonome (réseaux sociaux, communication, déplacements sur les événements). <strong>Le réflexe :</strong> pas besoin d’une bête de course — privilégie <strong>mobilité, autonomie et écran correct</strong>.</p>'],
    ['☁️ Hébergement du site web', '<p><strong>À fournir :</strong> une <strong>solution d’hébergement</strong> avec performances élevées, <strong>bande passante</strong> suffisante, <strong>sécurité</strong> robuste, support réactif et <strong>évolutivité</strong>. <strong>Le réflexe :</strong> compare mutualisé / VPS / dédié et choisis selon le trafic attendu (eSport = pics d’audience).</p>'],
    ['🔌 Aménagement : prises électriques & réseau', '<p><strong>À fournir :</strong> le <strong>nombre de prises électriques</strong> (PC + périphériques + écrans), le <strong>nombre et le type de prises réseau (RJ45)</strong>, et la <strong>catégorie + le blindage du câble</strong> (ex. <strong>cat. 6 F/UTP</strong>). <strong>Le réflexe :</strong> compte précisément par poste et prévois une marge.</p>'],
    ['🔒 Partage inter-sites (VPN) + Wi-Fi client', '<p><strong>À fournir :</strong> un <strong>partage de ressources sécurisé</strong> entre les sites via un <strong>VPN</strong> (confidentialité), et un <strong>Wi-Fi sécurisé</strong> pour les clients. <strong>Le réflexe :</strong> sépare le réseau <strong>clients</strong> du réseau <strong>interne</strong>. Voir <a href="/pages/reseau-entreprise">réseau d’entreprise</a>.</p>'],
  ]),

  block('heading', { level: 2, text: '🖧 L’interconnexion & le schéma réseau' }),
  block('html', { html: '<p>Critère noté à part : explique <strong>comment les postes communiquent</strong> pour le jeu en réseau. Les 4 PC gaming sont reliés à un <strong>switch Gigabit</strong> (faible latence, jeu en LAN). On <strong>segmente</strong> en VLAN (gaming / staff / Wi-Fi clients), le <strong>Wi-Fi clients est isolé</strong> du réseau interne, un <strong>VPN</strong> relie l’autre site et le <strong>site web</strong> est hébergé en <strong>VPS</strong>. Voici le schéma réseau idéal pour ce TP :</p>' }),
  block('html', { html: svgTpNet }),
  block('button', { label: '⬇️ Télécharger ce schéma (éditable dans draw.io)', href: downloadUrl, variant: 'primary' }),
  block('html', { html: '<p class="meta">Clic = aperçu. Pour l’éditer : télécharge le fichier (clic droit → « Enregistrer la cible »), puis dans <a href="https://app.diagrams.net" target="_blank" rel="noopener">draw.io</a> fais <em>Fichier → Ouvrir</em>. Adapte-le à ta solution avant de l’insérer dans ta présentation.</p>' }),
  note('blue', '🛠️ Comment refaire un schéma propre', '<p>Tu peux repartir de zéro avec la méthode du cours <a href="/pages/schemas-infrastructure">Les schémas d’infrastructure</a> (draw.io, légende, plan d’adressage, zones).</p>'),

  block('heading', { level: 2, text: '📖 La notion à expliquer (vulgarisée)' }),
  block('html', { html: '<p>Chaque groupe choisit <strong>une</strong> notion et l’explique pour un <strong>public non initié</strong>. Voici l’essentiel des quatre familles :</p>' }),
  accordion([
    ['🗄️ Hébergement', '<p><strong>Mutualisé</strong> (on partage un serveur, pas cher mais limité), <strong>VPS</strong> (une part dédiée et isolée, bon compromis), <strong>privé/dédié</strong> (un serveur rien que pour soi, puissant), <strong>on-premise/local</strong> (serveur chez soi, contrôle total mais à gérer). Pense aussi à la <strong>sécurisation du serveur web</strong> (HTTPS, mises à jour, pare-feu).</p>'],
    ['💾 Sauvegarde', '<p><strong>Complète</strong> (tout, à chaque fois — lourd mais simple), <strong>incrémentielle</strong> (seulement ce qui a changé depuis la dernière — léger), <strong>différentielle</strong> (ce qui a changé depuis la dernière complète). Retiens la <strong>règle 3-2-1</strong> : 3 copies, 2 supports, 1 hors site.</p>'],
    ['🧱 RAID', '<p>Combiner plusieurs disques : <strong>RAID 0</strong> (vitesse, zéro sécurité), <strong>RAID 1</strong> (miroir, sécurité), <strong>RAID 5/6</strong> (bon compromis capacité/sécurité), <strong>RAID 10</strong> (vitesse + sécurité). Détails et schémas dans le cours <a href="/pages/le-raid">Les niveaux de RAID</a>.</p>'],
    ['🛠️ Gestionnaire de parc informatique', '<p>Un outil (ex. <strong>GLPI</strong>) pour <strong>inventorier</strong> le matériel et les logiciels, suivre les <strong>tickets</strong>, planifier les <strong>mises à jour</strong>. <strong>Avantages :</strong> on sait ce qu’on possède, on dépanne plus vite, on anticipe les pannes. Voir <a href="/pages/le-ticketing">le ticketing</a>.</p>'],
  ]),

  block('heading', { level: 2, text: '💶 Le devis' }),
  block('html', { html: '<p>Le devis doit être <strong>chiffré, lisible et réaliste</strong> (le budget n’est pas fixé, mais le tarif doit tenir la route). Un tableau propre : élément, modèle, quantité, prix unitaire, total — et un <strong>total général</strong>. Exemple de structure (prix à ajuster) :</p>' }),
  block('html', { html: devis }),
  note('yellow', '💡 Astuce devis', '<p>Mets des <strong>modèles précis</strong> (pas « un bon PC » mais « Tour Ryzen 7 5700X / RTX 4060 »). Ça prouve que tu as cherché et ça rend le devis <strong>crédible</strong>. Prévois une ligne « <strong>alternative moins chère</strong> » pour cocher le critère « solutions alternatives ».</p>'),

  block('heading', { level: 2, text: '🎤 Réussir l’oral & le design' }),
  accordion([
    ['🎨 Le design des diapos', '<p>Une idée par diapo, <strong>peu de texte</strong> (mots-clés, pas des paragraphes), des <strong>visuels</strong> (photos matériel, schéma, tableau), des <strong>couleurs cohérentes</strong>, une police lisible <strong>de loin</strong>, et des diapos <strong>numérotées</strong> avec une page de titre et une conclusion.</p>'],
    ['🗣️ L’oral', '<p><strong>Ne lis pas tes diapos.</strong> Regarde le public, parle clairement, répartis le temps de parole entre les membres du groupe, prépare les <strong>transitions</strong> (« maintenant, le réseau… ») et entraîne-toi à voix haute.</p>'],
    ['⏱️ Le timing & les questions', '<p><strong>Répète</strong> pour tenir dans le temps imparti. Anticipe 2-3 <strong>questions</strong> (« pourquoi ce GPU ? », « pourquoi un VPN ? ») et prépare des réponses courtes.</p>'],
    ['🧰 Les outils', '<p>Diapos : <strong>PowerPoint</strong>, Google Slides ou Canva. Schémas : <strong>draw.io</strong> (voir <a href="/pages/schemas-infrastructure">le cours dédié</a>). Devis : un tableau Word/Excel propre, exporté en PDF.</p>'],
  ]),

  note('green', '✅ Checklist avant de rendre', '<ul><li>Devis <strong>chiffré</strong> et réaliste (modèles + prix + total).</li><li><strong>Tous</strong> les besoins du cahier des charges traités.</li><li>Un <strong>schéma réseau</strong> (draw.io) inclus.</li><li>Chaque choix matériel <strong>justifié</strong> (specs ↔ besoin).</li><li>L’<strong>interconnexion</strong> et le <strong>serveur web</strong> (fiabilité + sécurité) expliqués.</li><li>La <strong>notion</strong> vulgarisée pour un non-initié.</li><li>Une <strong>alternative</strong> proposée.</li><li>Diapos <strong>numérotées</strong>, page de titre, conclusion, orthographe relue.</li></ul>'),

  note('blue', '💡 À retenir', '<p>Réponds à <strong>tout</strong> le cahier des charges, <strong>justifie</strong> chaque choix, <strong>chiffre</strong> un devis crédible, illustre avec un <strong>schéma</strong>, et <strong>vulgarise</strong> la notion. Une présentation gagnante, c’est claire, justifiée et bien racontée. Cours utiles : <a href="/pages/hardware">hardware</a>, <a href="/pages/le-raid">RAID</a>, <a href="/pages/schemas-infrastructure">schémas</a>, <a href="/pages/reseau-entreprise">réseau d’entreprise</a>.</p>'),
  ];
}

const PAGE = {
  slug: SLUG,
  title: 'TP1 — Réussir la présentation (cybercafé eSport)',
  excerpt: 'Méthode complète pour réussir la présentation du TP1 : répondre au cahier des charges du cybercafé eSport, structurer les diapos, faire un devis réaliste, le schéma réseau idéal (draw.io) et réussir l’oral.',
};

// ===================================================================================
// EXÉCUTION
// ===================================================================================
function cookieFrom(res: Response): string {
  const sc = (res.headers as any).getSetCookie?.() as string[] | undefined;
  return (sc && sc.length ? sc : [res.headers.get('set-cookie') || '']).map(c => c.split(';')[0]).filter(Boolean).join('; ');
}
async function ensureMedia(cookie: string, h: Record<string, string>): Promise<string> {
  const list = await (await fetch(`${BASE}/api/admin/media`, { headers: { Cookie: cookie } })).json() as Array<{ original_name: string; url: string }>;
  const found = list.find(m => m.original_name === DRAWIO_NAME);
  if (found) { console.log('MEDIA', DRAWIO_NAME, '(déjà)', found.url); return found.url; }
  const dataUrl = 'data:image/svg+xml;base64,' + Buffer.from(editableSvg, 'utf8').toString('base64');
  const up = await fetch(`${BASE}/api/admin/media`, { method: 'POST', headers: h, body: JSON.stringify({ filename: DRAWIO_NAME, dataUrl }) });
  if (!up.ok) throw new Error(`media ${up.status} ${await up.text()}`);
  const rec = await up.json() as { url: string };
  console.log('MEDIA', DRAWIO_NAME, '(créé)', rec.url);
  return rec.url;
}
async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: PW }) });
  if (!login.ok) throw new Error(`login ${login.status}`);
  const cookie = cookieFrom(login);
  const h = { 'Content-Type': 'application/json', Cookie: cookie };
  const existing = await (await fetch(`${BASE}/api/admin/pages`, { headers: { Cookie: cookie } })).json() as Array<{ id: number; slug: string }>;

  const downloadUrl = await ensureMedia(cookie, h);
  const blocks = buildBlocks(downloadUrl);
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

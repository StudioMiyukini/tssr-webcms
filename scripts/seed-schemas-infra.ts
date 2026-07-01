/* Crée la page de cours « Les schémas d'infrastructure » : présentation de draw.io,
   exemples selon la taille de l'infra (petite / PME / grande) et schéma complet idéal
   pour les examens / TP / présentations TSSR. Vulgarisé, schématisé (SVG inline).
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-schemas-infra.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);

const C = { net: '#2563eb', dev: '#059669', warn: '#d97706', danger: '#dc2626', grey: '#64748b', slate: '#475569', purple: '#7c3aed', ok: '#16a34a' };
const accordion = (it: Array<[string, string]>) => block('accordion', { items: it.map(([title, text]) => ({ title, text, href: '' })) });
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });

// ===================================================================================
// Bibliothèque d'icônes (style « schéma illustré »)
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
function icServer(cx: number, cy: number, label = 'Serveurs', sub = '') {
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
function icPrinter(cx: number, cy: number, label = 'Imprimante') {
  const w = 40, h = 30, x = cx - w / 2, y = cy - h / 2;
  const s = `<rect x="${x + 5}" y="${y}" width="${w - 10}" height="8" rx="2" fill="${C.slate}"/>`
    + `<rect x="${x}" y="${y + 8}" width="${w}" height="15" rx="3" fill="${C.grey}"/>`
    + `<rect x="${x + 6}" y="${y + 21}" width="${w - 12}" height="8" rx="2" fill="#e2e8f0"/>`
    + `<circle cx="${x + w - 7}" cy="${y + 14}" r="2.5" fill="#4ade80"/>`;
  return s + (label ? lbl(cx, y + h + 13, label, C.slate) : '');
}

// ===================================================================================
// SCHÉMAS
// ===================================================================================
// Maquette de l'interface draw.io
const chip = (x: number, y: number, t: string) => `<rect x="${x}" y="${y}" width="104" height="22" rx="5" fill="#fff" stroke="#cbd5e1"/><rect x="${x + 6}" y="${y + 5}" width="12" height="12" rx="2" fill="${C.net}"/><text x="${x + 26}" y="${y + 15}" font-size="10" fill="${C.slate}">${t}</text>`;
const svgDrawio = wrap(580, 300,
  `<rect x="6" y="6" width="568" height="288" rx="10" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>`
  + `<rect x="6" y="6" width="568" height="28" rx="10" fill="${C.slate}"/>`
  + `<circle cx="22" cy="20" r="4" fill="#f87171"/><circle cx="36" cy="20" r="4" fill="#fbbf24"/><circle cx="50" cy="20" r="4" fill="#34d399"/>`
  + `<text x="290" y="24" text-anchor="middle" font-size="12" fill="#fff" font-weight="bold">diagrams.net — infra.drawio</text>`
  + `<rect x="6" y="34" width="124" height="260" fill="#f1f5f9"/>`
  + `<text x="68" y="52" text-anchor="middle" font-size="11" fill="${C.slate}" font-weight="bold">Formes</text>`
  + chip(12, 62, 'Reseau') + chip(12, 90, 'Cloud') + chip(12, 118, 'Switch') + chip(12, 146, 'Serveur') + chip(12, 174, 'Poste') + chip(12, 202, 'Pare-feu')
  + `<rect x="468" y="34" width="106" height="260" fill="#f1f5f9"/>`
  + `<text x="521" y="52" text-anchor="middle" font-size="11" fill="${C.slate}" font-weight="bold">Format</text>`
  + `<rect x="478" y="64" width="86" height="14" rx="3" fill="#fff" stroke="#cbd5e1"/><rect x="478" y="86" width="86" height="14" rx="3" fill="#fff" stroke="#cbd5e1"/><rect x="478" y="108" width="86" height="40" rx="3" fill="#fff" stroke="#cbd5e1"/>`
  + icCloud(200, 100)
  + line(240, 100, 262, 100, C.net) + icWall(290, 100, '')
  + line(317, 100, 348, 100, C.net) + icSwitch(380, 100, 64, '', '')
  + line(380, 114, 380, 150, C.slate) + line(330, 150, 430, 150, C.slate)
  + line(330, 150, 330, 170, C.slate) + line(430, 150, 430, 170, C.slate)
  + icPC(330, 185, C.net, '') + icPC(430, 185, C.net, '')
  + cap(300, 286, 'Glisse les formes « reseau » sur la feuille, relie-les, exporte en PNG / PDF.'));

// Exemple 1 — petite infra
const svgSmall = wrap(470, 180,
  icCloud(50, 55)
  + line(90, 55, 128, 55, C.net) + icBox(160, 55)
  + line(190, 55, 228, 55, C.net) + icSwitch(290, 55, 90, '', '') + lbl(290, 37, 'Switch', C.net, 10)
  + line(290, 69, 290, 98, C.slate) + line(120, 98, 420, 98, C.slate)
  + line(120, 98, 120, 118, C.slate) + line(220, 98, 220, 118, C.slate) + line(320, 98, 320, 118, C.slate) + line(420, 98, 420, 118, C.slate)
  + icPC(120, 133, C.net, '.11') + icPC(220, 133, C.net, '.12') + icPC(320, 133, C.net, '.13') + icPrinter(420, 126, 'Impr.')
  + cap(240, 176, "Petite infra (TPE / particulier) : l'essentiel, rien de plus."));

// Exemple 2 — PME
const svgMedium = wrap(560, 252,
  zone(28, 150, 432, 92, C.net, 'VLAN bureau — 192.168.1.0/24  ·  passerelle 192.168.1.254 (pare-feu)')
  + icCloud(50, 55)
  + line(90, 55, 122, 55, C.net) + icBox(155, 55)
  + line(185, 55, 222, 55, C.net) + icWall(252, 55, '') + lbl(252, 33, 'Pare-feu', C.danger, 10)
  + line(279, 55, 310, 55, C.net) + icSwitch(365, 55, 110, '', '') + lbl(365, 37, 'Switch', C.net, 10)
  + line(420, 55, 470, 52, C.net) + icServer(500, 52, 'Serveur', 'AD/DNS')
  + line(365, 69, 365, 150, C.slate)
  + icPC(90, 200, C.net, '.10') + icPC(170, 200, C.net, '.11') + icPC(250, 200, C.net, '.12') + icAP(350, 196, 'Wi-Fi')
  + cap(255, 248, 'PME : pare-feu, serveur, Wi-Fi, debut de segmentation (1 VLAN).'));

// Exemple 3 — grande infra multi-sites
const svgLarge = wrap(640, 300,
  icCloud(320, 48)
  + zone(20, 98, 290, 184, C.net, 'Site A — siege')
  + zone(330, 98, 290, 184, C.dev, 'Site B — agence')
  + `<line x1="295" y1="58" x2="120" y2="128" stroke="${C.purple}" stroke-width="2.5" stroke-dasharray="7 5"/>`
  + `<line x1="345" y1="58" x2="430" y2="128" stroke="${C.purple}" stroke-width="2.5" stroke-dasharray="7 5"/>`
  + `<text x="200" y="92" font-size="11" fill="${C.purple}" font-weight="bold">VPN</text>`
  + `<text x="392" y="92" font-size="11" fill="${C.purple}" font-weight="bold">VPN</text>`
  + icWall(120, 150, '') + rlbl(150, 152, 'Pare-feu', C.danger)
  + line(120, 172, 120, 196, C.slate) + icSwitch(120, 210, 100, '', '') + rlbl(175, 214, 'Coeur', C.net)
  + icServer(245, 150, 'Serveurs', '')
  + line(120, 224, 120, 248, C.net) + icPC(85, 262, C.net, '') + icPC(160, 262, C.net, '')
  + icWall(430, 150, '') + rlbl(460, 152, 'Pare-feu', C.danger)
  + line(430, 172, 430, 196, C.slate) + icSwitch(430, 210, 100, '', '') + rlbl(485, 214, 'Coeur', C.dev)
  + icServer(555, 150, 'Serveurs', '')
  + line(430, 224, 430, 248, C.dev) + icPC(395, 262, C.dev, '') + icPC(470, 262, C.dev, '')
  + cap(320, 296, 'Grande infra : plusieurs sites relies par VPN, redondance et DMZ par site.'));

// Schéma complet idéal (examens / TP / présentation)
const completeInner =
  zone(470, 24, 234, 98, C.warn, 'DMZ 192.168.200.0/24 (passerelle .254)')
  + zone(28, 286, 322, 152, C.net, 'VLAN Utilisateurs — 192.168.10.0/24')
  + `<text x="38" y="316" font-size="9" fill="#64748b" font-family="ui-monospace,monospace">passerelle : 192.168.10.254</text>`
  + zone(372, 286, 320, 152, C.purple, 'VLAN Serveurs — 192.168.99.0/24')
  + `<text x="382" y="316" font-size="9" fill="#64748b" font-family="ui-monospace,monospace">passerelle : 192.168.99.254</text>`
  + icCloud(60, 58)
  + line(100, 58, 128, 58, C.net) + icBox(160, 58)
  + line(190, 58, 240, 58, C.net) + icWall(270, 58, '') + rlbl(300, 50, 'Pare-feu', C.danger)
  + line(297, 64, 537, 64, C.warn) + icServer(560, 70, 'Web / Mail', '')
  + line(270, 80, 270, 134, C.slate)
  + icSwitch(270, 150, 150, '', '') + rlbl(350, 150, 'Switch coeur (niveau 3)', C.net) + rlbl(350, 163, '= porte les passerelles .254', C.grey, 9)
  + line(270, 164, 270, 205, C.slate) + line(150, 205, 450, 205, C.slate)
  + line(150, 205, 150, 226, C.slate) + line(450, 205, 450, 226, C.slate)
  + icSwitch(150, 240, 120, '', '') + lbl(150, 222, 'Switch acces 1', C.net, 10)
  + icSwitch(450, 240, 120, '', '') + lbl(450, 222, 'Switch acces 2', C.net, 10)
  + line(150, 254, 150, 300, C.net)
  + icPC(85, 332, C.net, '.11') + icPC(155, 332, C.net, '.12') + icPC(225, 332, C.net, '.13')
  + icAP(300, 326, 'Wi-Fi') + icPrinter(110, 408, 'Imprimante')
  + line(450, 254, 450, 300, C.purple)
  + icServer(435, 352, 'AD / DNS', 'DHCP') + icServer(565, 352, 'Fichiers', '')
  + cap(360, 448, 'Internet · pare-feu · DMZ · coeur · switchs acces · VLAN users et serveurs · Wi-Fi · impression.');
const svgComplete = wrap(720, 452, completeInner);

// Légende + plan IP du schéma complet
const legend = `<p style="margin:8px 0 2px;font-weight:600">Légende</p><div style="display:flex;flex-wrap:wrap;gap:8px 16px;font-size:13px;margin-bottom:8px">`
  + ([['#64748b', 'Internet / WAN'], ['#dc2626', 'Pare-feu'], ['#d97706', 'DMZ'], ['#2563eb', 'Switch / postes'], ['#7c3aed', 'Serveurs'], ['#059669', 'Wi-Fi']] as Array<[string, string]>)
    .map(([c, t]) => `<span style="display:inline-flex;align-items:center;gap:6px"><span style="width:12px;height:12px;border-radius:3px;background:${c};display:inline-block"></span>${t}</span>`).join('')
  + `</div>`;
const ipComplete = `<div style="overflow-x:auto;margin:6px 0 12px">
<table style="border-collapse:collapse;width:100%;min-width:440px;font-size:14px">
<thead><tr style="background:var(--surface-2)">
<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">Zone</th>
<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">VLAN</th>
<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">Réseau</th>
<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">Passerelle</th>
</tr></thead><tbody>
${[
  ['🟧 DMZ', '200', '192.168.200.0/24', '.254'],
  ['🟦 Utilisateurs', '10', '192.168.10.0/24', '.254'],
  ['🟪 Serveurs', '99', '192.168.99.0/24', '.254'],
].map(r => `<tr>${r.map((c, i) => `<td style="padding:8px 10px;border:1px solid var(--border)${i === 0 ? ';font-weight:600' : ''}">${c}</td>`).join('')}</tr>`).join('')}
</tbody></table></div>`;

// ===================================================================================
// FICHIER draw.io (modèle rééditable) — XML mxGraph embarqué dans un SVG éditable
// ===================================================================================
const DRAWIO_NAME = 'schema-infra-tssr-v2.drawio.svg';
const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const NET = 'sketch=0;html=1;outlineConnect=0;labelBackgroundColor=#ffffff;verticalLabelPosition=bottom;verticalAlign=top;';
const mcell = (id: string, value: string, style: string, x: number, y: number, w: number, h: number) =>
  `<mxCell id="${id}" value="${escAttr(value).replace(/\n/g, '&#10;')}" style="${style}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`;
const medge = (id: string, src: string, tgt: string) =>
  `<mxCell id="${id}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=none;strokeColor=#64748b;" edge="1" parent="1" source="${src}" target="${tgt}"><mxGeometry relative="1" as="geometry"/></mxCell>`;

function buildMxfile(): string {
  const cells = [
    // Zones (en arrière-plan)
    mcell('zdmz', 'DMZ — 192.168.200.0/24\npasserelle .254', 'rounded=1;dashed=1;html=1;whiteSpace=wrap;fillColor=#fff7ed;strokeColor=#d97706;align=left;verticalAlign=top;spacingLeft=8;spacingTop=4;fontStyle=1;fontColor=#b45309;', 520, 80, 250, 140),
    mcell('zuser', 'VLAN Utilisateurs — 192.168.10.0/24\npasserelle 192.168.10.254', 'rounded=1;dashed=1;html=1;whiteSpace=wrap;fillColor=#eff6ff;strokeColor=#2563eb;align=left;verticalAlign=top;spacingLeft=8;spacingTop=4;fontStyle=1;fontColor=#1d4ed8;', 60, 460, 430, 250),
    mcell('zsrv', 'VLAN Serveurs — 192.168.99.0/24\npasserelle 192.168.99.254', 'rounded=1;dashed=1;html=1;whiteSpace=wrap;fillColor=#f5f3ff;strokeColor=#7c3aed;align=left;verticalAlign=top;spacingLeft=8;spacingTop=4;fontStyle=1;fontColor=#6d28d9;', 520, 460, 290, 250),
    // Cartouche
    mcell('title', "Schéma d’infrastructure — TSSR (modèle)\nAuteur : ______    Date : ______    Version : 1.0", 'rounded=0;html=1;whiteSpace=wrap;fillColor=#f8fafc;strokeColor=#475569;align=left;verticalAlign=top;spacing=6;fontSize=11;', 40, 16, 390, 48),
    // Équipements
    mcell('net', 'Internet', NET + 'shape=mxgraph.networks.cloud;fillColor=#e2e8f0;strokeColor=#64748b;verticalLabelPosition=middle;verticalAlign=middle;', 40, 110, 120, 70),
    mcell('box', 'Box FAI', NET + 'shape=mxgraph.networks.modem;fillColor=#cbd5e1;strokeColor=#475569;', 215, 120, 80, 50),
    mcell('fw', 'Pare-feu', NET + 'shape=mxgraph.networks.firewall;fillColor=#fecaca;strokeColor=#dc2626;', 360, 106, 72, 74),
    mcell('srvdmz', 'Serveur Web / Mail\n192.168.200.10', NET + 'shape=mxgraph.networks.server;fillColor=#fde68a;strokeColor=#d97706;', 600, 116, 56, 66),
    mcell('core', 'Switch cœur (niveau 3)\nporte les passerelles .254', NET + 'shape=mxgraph.networks.switch;fillColor=#bfdbfe;strokeColor=#2563eb;', 355, 246, 150, 50),
    mcell('acc1', 'Switch accès 1', NET + 'shape=mxgraph.networks.switch;fillColor=#bfdbfe;strokeColor=#2563eb;', 200, 360, 120, 42),
    mcell('acc2', 'Switch accès 2', NET + 'shape=mxgraph.networks.switch;fillColor=#bfdbfe;strokeColor=#2563eb;', 560, 360, 120, 42),
    mcell('pc1', 'PC 192.168.10.11', NET + 'shape=mxgraph.networks.pc;fillColor=#bfdbfe;strokeColor=#2563eb;', 95, 540, 56, 58),
    mcell('pc2', 'PC 192.168.10.12', NET + 'shape=mxgraph.networks.pc;fillColor=#bfdbfe;strokeColor=#2563eb;', 185, 540, 56, 58),
    mcell('pc3', 'PC 192.168.10.13', NET + 'shape=mxgraph.networks.pc;fillColor=#bfdbfe;strokeColor=#2563eb;', 275, 540, 56, 58),
    mcell('ap', 'Borne Wi-Fi', NET + 'shape=mxgraph.networks.wireless_access_point;fillColor=#bbf7d0;strokeColor=#059669;', 375, 545, 56, 46),
    mcell('prn', 'Imprimante', NET + 'shape=mxgraph.networks.printer;fillColor=#e2e8f0;strokeColor=#475569;', 150, 640, 56, 56),
    mcell('srvad', 'AD / DNS / DHCP\n192.168.99.10', NET + 'shape=mxgraph.networks.server;fillColor=#ddd6fe;strokeColor=#7c3aed;', 560, 540, 56, 66),
    mcell('srvfile', 'Serveur Fichiers\n192.168.99.11', NET + 'shape=mxgraph.networks.server;fillColor=#ddd6fe;strokeColor=#7c3aed;', 690, 540, 56, 66),
    // Légende
    mcell('leg', 'Légende\nNuage = Internet/WAN   Mur = Pare-feu   Zone orange = DMZ\nBleu = switchs & postes   Violet = serveurs   Vert = Wi-Fi', 'rounded=0;html=1;whiteSpace=wrap;fillColor=#ffffff;strokeColor=#cbd5e1;align=left;verticalAlign=top;spacing=6;fontSize=10;', 60, 730, 470, 70),
    // Liens
    medge('e1', 'net', 'box'), medge('e2', 'box', 'fw'), medge('e3', 'fw', 'srvdmz'),
    medge('e4', 'fw', 'core'), medge('e5', 'core', 'acc1'), medge('e6', 'core', 'acc2'),
    medge('e7', 'acc1', 'pc1'), medge('e8', 'acc1', 'pc2'), medge('e9', 'acc1', 'pc3'),
    medge('e10', 'acc1', 'ap'), medge('e11', 'acc1', 'prn'),
    medge('e12', 'acc2', 'srvad'), medge('e13', 'acc2', 'srvfile'),
  ].join('');
  return `<mxfile host="app.diagrams.net" type="device"><diagram id="infra-tssr" name="Infra TSSR"><mxGraphModel dx="1100" dy="800" grid="1" gridSize="10" guides="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}</root></mxGraphModel></diagram></mxfile>`;
}
// SVG éditable : image visible + modèle draw.io dans l'attribut content (réouvrable/éditable)
const editableSvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="720" height="452" viewBox="0 0 720 452" content="${escAttr(buildMxfile())}">${completeInner}</svg>`;

// ===================================================================================
// PAGE
// ===================================================================================
const SLUG = 'schemas-infrastructure';
function buildBlocks(downloadUrl: string): PageBlock[] {
  return [
  block('hero', { eyebrow: 'Cours · Réseau · Méthode', title: 'Les schémas d’infrastructure', subtitle: 'Dessiner un réseau clairement avec draw.io — du petit local au multi-sites.' }),
  block('html', { html: '<p>Un <strong>schéma d’infrastructure</strong> est le <strong>plan</strong> de ton réseau : il montre les équipements, comment ils sont reliés et comment circule l’information. C’est un outil pour <strong>concevoir</strong>, <strong>documenter</strong>, <strong>dépanner</strong>… et, en formation TSSR, c’est <strong>attendu aux examens et aux TP</strong>.</p>' }),
  note('blue', '🔎 Analogie', '<p>C’est le <strong>plan de l’architecte</strong>. Avant (et après) de construire, on a besoin d’un dessin qui montre où sont les murs, les portes, l’électricité. Un schéma réseau, c’est pareil : on doit le <strong>lire en quelques secondes</strong> et comprendre toute l’installation.</p>'),

  block('heading', { level: 2, text: '🛠️ L’outil : draw.io (diagrams.net)' }),
  block('html', { html: '<p><strong>draw.io</strong> (aussi appelé <strong>diagrams.net</strong>) est l’outil le plus utilisé pour ça : <strong>gratuit</strong>, dans le navigateur ou en appli, avec des <strong>formes réseau</strong> toutes prêtes. On glisse les éléments, on les relie, on exporte.</p>' }),
  block('html', { html: svgDrawio }),
  accordion([
    ['🚀 Où le trouver & créer un schéma', '<p>draw.io = <strong>diagrams.net</strong> : gratuit, dans le navigateur (<code>app.diagrams.net</code>) ou en appli bureau. Aucun compte requis. On choisit où enregistrer (PC, Google Drive…) puis « Créer un diagramme ».</p>'],
    ['🧱 Les formes réseau', '<p>Dans le panneau <strong>Formes</strong> (à gauche), active la catégorie <strong>Réseau</strong> (« Plus de formes… » → Networking) : routeurs, switchs, serveurs, postes, pare-feu, cloud… puis glisse-les sur la feuille.</p>'],
    ['🔗 Relier & annoter', '<p>Survole une forme : des flèches apparaissent → tire vers une autre pour créer un <strong>lien</strong>. Double-clic pour <strong>nommer</strong> (IP, VLAN, nom d’hôte). Le panneau <strong>Format</strong> (à droite) gère couleurs et styles.</p>'],
    ['📤 Exporter', '<p><em>Fichier → Exporter sous</em> : <strong>PNG</strong> (présentation), <strong>PDF</strong> (rendu de TP) ou <strong>SVG</strong> (net à toute taille). Le fichier source <code>.drawio</code> reste rééditable.</p>'],
    ['🎨 Bonnes pratiques', '<p><strong>Aligne</strong> les formes (la grille aide), garde des <strong>couleurs cohérentes</strong> par type, ajoute une <strong>légende</strong> et un <strong>cartouche</strong>, et ne <strong>surcharge pas</strong> : un bon schéma se lit vite.</p>'],
  ]),
  block('button', { label: 'Ouvrir draw.io', href: 'https://app.diagrams.net', variant: 'primary' }),

  block('heading', { level: 2, text: '📐 Adapter le schéma à la taille de l’infra' }),
  block('html', { html: '<p>Un schéma doit montrer <strong>ce qui compte</strong>, ni plus ni moins. Plus l’infrastructure grandit, plus on ajoute des couches (pare-feu, segmentation, redondance). Trois exemples :</p>' }),
  block('tabs', {
    items: [
      { title: '🟢 Petite', href: '', text: svgSmall + '<p><strong>TPE, association, particulier.</strong> Une box, un switch, quelques postes et une imprimante. <strong>Quand l’utiliser :</strong> peu de matériel, pas de serveur, pas de cloisonnement.</p>' },
      { title: '🟠 Moyenne (PME)', href: '', text: svgMedium + '<p><strong>PME.</strong> On ajoute un <strong>pare-feu</strong>, un <strong>serveur</strong> (AD/DNS), le <strong>Wi-Fi</strong> et un premier <strong>VLAN</strong>. <strong>Quand l’utiliser :</strong> dès qu’il y a des comptes utilisateurs et des données à protéger.</p>' },
      { title: '🔴 Grande', href: '', text: svgLarge + '<p><strong>Multi-sites.</strong> Plusieurs sites reliés par <strong>VPN</strong>, une <strong>DMZ</strong> et de la <strong>redondance</strong> par site. <strong>Quand l’utiliser :</strong> plusieurs implantations, services exposés, exigence de disponibilité.</p>' },
    ],
  }),

  block('heading', { level: 2, text: '🏆 Le schéma complet (idéal examens / TP / présentation)' }),
  block('html', { html: '<p>Voici un schéma « modèle » qui coche toutes les cases attendues en TSSR : Internet, <strong>pare-feu</strong>, <strong>DMZ</strong>, <strong>cœur de réseau</strong>, <strong>switchs d’accès</strong>, <strong>VLAN</strong> séparés (utilisateurs / serveurs), <strong>Wi-Fi</strong>, impression — le tout avec <strong>légende</strong> et <strong>plan d’adressage</strong>.</p>' }),
  block('html', { html: svgComplete }),
  block('html', { html: legend }),
  block('html', { html: '<p class="meta">Plan d’adressage associé :</p>' }),
  block('html', { html: ipComplete }),
  note('blue', '🚪 Où est la passerelle ? (switch et routeur ont-ils une IP ?)', '<p>Question classique en lisant un schéma. La réponse :</p><ul><li>Un <strong>switch de niveau 2</strong> (switch d’accès) <strong>n’a pas d’IP</strong> pour faire transiter le trafic — tout au plus une <strong>IP de management</strong> pour l’administrer à distance. Il n’est donc <strong>jamais</strong> la passerelle.</li><li>La <strong>passerelle</strong> (celle qu’on configure sur les postes) est portée par un équipement de <strong>niveau 3</strong> : le <strong>routeur</strong>, le <strong>pare-feu</strong>, ou le <strong>switch cœur (niveau 3)</strong> via son <strong>interface de VLAN (SVI)</strong>.</li><li><strong>Convention :</strong> la passerelle est souvent la <strong>première</strong> (<code>.1</code>) ou la <strong>dernière</strong> (<code>.254</code>) adresse du sous-réseau. Ici, chaque VLAN a sa passerelle en <strong>.254</strong>, portée par le <strong>switch cœur</strong> (et le <strong>pare-feu</strong> est la passerelle vers Internet).</li></ul><p>👉 Sur un schéma, on note donc l’<strong>IP de passerelle dans le VLAN</strong> (le <code>.254</code> du plan d’adressage), et c’est l’<strong>équipement de niveau 3</strong> qui la porte. Détail des IP/MAC : <a href="/pages/adresses-ip">Les adresses IP</a>.</p>'),
  block('button', { label: '⬇️ Télécharger le schéma (SVG éditable dans draw.io)', href: downloadUrl, variant: 'primary' }),
  block('html', { html: '<p class="meta">Clic = aperçu. Pour l’éditer : télécharge le fichier (clic droit → « Enregistrer la cible »), puis dans <a href="https://app.diagrams.net" target="_blank" rel="noopener">draw.io</a> fais <em>Fichier → Ouvrir</em>. C’est un modèle de départ prêt à adapter pour tes TP.</p>' }),
  note('green', '✅ La checklist du schéma parfait', '<ul><li>Un <strong>cartouche</strong> : titre, auteur, date, version.</li><li>Une <strong>légende</strong> des symboles et des couleurs.</li><li>Le <strong>plan d’adressage</strong> (réseaux / VLAN, passerelles).</li><li>Des <strong>zones</strong> colorées (Internet, DMZ, LAN, serveurs).</li><li>Toujours <strong>Internet + pare-feu</strong> visibles, avec le sens du trafic.</li><li>La <strong>redondance</strong> indiquée si elle existe (liens ou équipements doublés).</li></ul>'),

  note('yellow', '💡 À retenir', '<p>Un schéma se fait avec <strong>draw.io</strong>, s’<strong>adapte à la taille</strong> de l’infra, et reste <strong>lisible</strong> (légende + plan IP + zones). Pour un examen ou un TP, vise le <strong>schéma complet</strong> ci-dessus comme modèle. Voir aussi le <a href="/pages/reseau-entreprise">projet réseau d’entreprise</a> et les <a href="/pages/les-7-couches-osi">7 couches OSI</a>.</p>'),
  ];
}

const PAGE = {
  slug: SLUG,
  title: 'Les schémas d’infrastructure',
  excerpt: 'Dessiner un réseau avec draw.io : présentation de l’outil, exemples selon la taille de l’infra (petite / PME / multi-sites) et un schéma complet modèle pour les examens et TP TSSR.',
};

// ===================================================================================
// EXÉCUTION
// ===================================================================================
function cookieFrom(res: Response): string {
  const sc = (res.headers as any).getSetCookie?.() as string[] | undefined;
  return (sc && sc.length ? sc : [res.headers.get('set-cookie') || '']).map(c => c.split(';')[0]).filter(Boolean).join('; ');
}
// Téléverse le SVG éditable draw.io (ou réutilise l'existant) et renvoie son URL publique.
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

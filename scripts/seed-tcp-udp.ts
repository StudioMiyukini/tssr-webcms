/* Crée la page de cours « TCP & UDP » (couche Transport) — vulgarisée, schématisée,
   avec la vidéo intégrée « TCP vs UDP : Comprends la Différence avec un Cas Réel ! ».
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-tcp-udp.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);

const C = { net: '#2563eb', dev: '#059669', warn: '#d97706', danger: '#dc2626', grey: '#64748b', slate: '#475569', purple: '#7c3aed', ok: '#16a34a' };
const accordion = (it: Array<[string, string]>) => block('accordion', { items: it.map(([title, text]) => ({ title, text, href: '' })) });
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });

// ===================================================================================
// SCHÉMAS SVG (inline → compatibles CSP)
// ===================================================================================
function box(x: number, y: number, w: number, h: number, fill: string, label: string, sub = ''): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}"/>`
    + `<text x="${x + w / 2}" y="${y + (sub ? h / 2 - 2 : h / 2 + 4)}" text-anchor="middle" font-size="13" fill="#fff" font-weight="bold">${label}</text>`
    + (sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 14}" text-anchor="middle" font-size="10" fill="#e5e7eb">${sub}</text>` : '');
}
const line = (x1: number, y1: number, x2: number, y2: number, col = '#94a3b8') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="2.5"/>`;
const wrap = (w: number, h: number, inner: string) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="max-width:${w}px;width:100%;height:auto;margin:6px 0 12px;font-family:system-ui,sans-serif">${inner}</svg>`;
const cap = (x: number, y: number, t: string, col = '#64748b', s = 11) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${s}" fill="${col}">${t}</text>`;
const xMark = (cx: number, cy: number) => `<line x1="${cx - 5}" y1="${cy - 5}" x2="${cx + 5}" y2="${cy + 5}" stroke="${C.danger}" stroke-width="2.5"/><line x1="${cx - 5}" y1="${cy + 5}" x2="${cx + 5}" y2="${cy - 5}" stroke="${C.danger}" stroke-width="2.5"/>`;

// Flèche horizontale étiquetée entre deux lignes de vie (style diagramme de séquence)
function arr(x1: number, x2: number, y: number, col: string, label: string, dash = false, lost = false): string {
  const endx = lost ? Math.round(x1 + (x2 - x1) * 0.55) : x2;
  let s = `<line x1="${x1}" y1="${y}" x2="${endx}" y2="${y}" stroke="${col}" stroke-width="2.5"${dash ? ' stroke-dasharray="6 4"' : ''}/>`;
  if (lost) s += xMark(endx + 9, y);
  else s += x2 > x1
    ? `<polygon points="${x2},${y} ${x2 - 9},${y - 5} ${x2 - 9},${y + 5}" fill="${col}"/>`
    : `<polygon points="${x2},${y} ${x2 + 9},${y - 5} ${x2 + 9},${y + 5}" fill="${col}"/>`;
  return s + `<text x="${(x1 + x2) / 2}" y="${y - 8}" text-anchor="middle" font-size="11" fill="#475569" font-weight="bold">${label}</text>`;
}

// Couche Transport : application → en-tête (ports) + données
const svgSeg = wrap(470, 118,
  box(15, 30, 120, 52, C.purple, 'Application', 'HTTP, visio, jeu')
  + `<line x1="135" y1="56" x2="166" y2="56" stroke="${C.slate}" stroke-width="2.5"/><polygon points="166,56 158,51 158,61" fill="${C.slate}"/>`
  + box(170, 30, 80, 52, C.net, 'En-tete', 'ports')
  + box(252, 30, 200, 52, C.dev, 'Donnees', 'ton contenu')
  + cap(235, 108, "TCP et UDP ajoutent un en-tete (avec les ports) : c'est la couche Transport (n4)."));

// TCP : poignée de main en 3 temps
const svgHandshake = wrap(470, 300,
  box(20, 12, 100, 38, C.net, 'Client')
  + box(330, 12, 120, 38, C.slate, 'Serveur')
  + `<line x1="70" y1="50" x2="70" y2="266" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="4 4"/>`
  + `<line x1="390" y1="50" x2="390" y2="266" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="4 4"/>`
  + arr(70, 390, 92, C.net, '1. SYN — « tu es la ? »')
  + arr(390, 70, 140, C.dev, '2. SYN-ACK — « oui, et toi ? »')
  + arr(70, 390, 188, C.net, '3. ACK — « parfait ! »')
  + arr(70, 390, 236, C.ok, 'Donnees (canal fiable etabli)')
  + cap(230, 288, "Poignee de main en 3 temps : la connexion est etablie AVANT d'envoyer les donnees."));

// TCP : perte détectée, renvoi, remise en ordre
const svgTcp = wrap(490, 212,
  box(20, 12, 100, 38, C.net, 'Emetteur')
  + box(350, 12, 120, 38, C.slate, 'Recepteur')
  + `<line x1="70" y1="50" x2="70" y2="182" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="4 4"/>`
  + `<line x1="410" y1="50" x2="410" y2="182" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="4 4"/>`
  + arr(70, 410, 72, C.net, 'segment 1')
  + arr(70, 410, 98, C.danger, 'segment 2 (perdu)', true, true)
  + arr(70, 410, 124, C.net, 'segment 3')
  + arr(410, 70, 150, C.dev, 'ACK : il manque le 2')
  + arr(70, 410, 176, C.ok, 'segment 2 (renvoye)')
  + cap(240, 202, "TCP detecte la perte, renvoie le manquant et remet tout dans l'ordre."));

// UDP : on envoie sans connexion, une perte n'est pas rattrapée
const svgUdp = wrap(490, 188,
  box(20, 12, 100, 38, C.net, 'Emetteur')
  + box(350, 12, 120, 38, C.slate, 'Recepteur')
  + `<line x1="70" y1="50" x2="70" y2="158" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="4 4"/>`
  + `<line x1="410" y1="50" x2="410" y2="158" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="4 4"/>`
  + arr(70, 410, 64, C.warn, 'datagramme 1')
  + arr(70, 410, 90, C.warn, 'datagramme 2')
  + arr(70, 410, 116, C.danger, 'datagramme 3 (perdu)', true, true)
  + arr(70, 410, 142, C.warn, 'datagramme 4')
  + cap(240, 178, "UDP envoie sans connexion ni accuse : rapide, mais une perte n'est pas rattrapee."));

// Comparatif TCP / UDP (tableau HTML responsive)
const compare = `<div style="overflow-x:auto;margin:6px 0 12px">
<table style="border-collapse:collapse;width:100%;min-width:480px;font-size:14px">
<thead><tr style="background:var(--surface-2)">
<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">Critère</th>
<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">🟦 TCP</th>
<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">🟧 UDP</th>
</tr></thead><tbody>
${[
  ['Connexion', 'Oui — poignée de main', 'Non — on envoie direct'],
  ['Fiabilité', 'Garantie (accusés + renvoi)', 'Aucune garantie'],
  ['Ordre', 'Remis dans l’ordre', 'Pas garanti'],
  ['Vitesse', 'Plus lent (contrôles)', 'Très rapide et léger'],
  ['Analogie', 'Lettre recommandée', 'Carte postale'],
  ['Pour quoi ?', 'Web, mail, fichiers', 'Visio, jeu, streaming, DNS'],
].map(r => `<tr>${r.map((c, i) => `<td style="padding:8px 10px;border:1px solid var(--border)${i === 0 ? ';font-weight:600' : ''}">${c}</td>`).join('')}</tr>`).join('')}
</tbody></table></div>`;

// ===================================================================================
// PAGE
// ===================================================================================
const SLUG = 'tcp-et-udp';
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Réseau', title: 'TCP & UDP', subtitle: 'Les deux protocoles de transport : fiabilité (TCP) ou vitesse (UDP) ?' }),
  block('html', { html: '<p><strong>TCP</strong> et <strong>UDP</strong> sont les <strong>deux grands protocoles de transport</strong> : ce sont eux qui décident <strong>comment</strong> tes données voyagent sur le réseau. Tout se résume à un arbitrage : <strong>fiabilité</strong> (TCP) ou <strong>rapidité</strong> (UDP). Cette page s’appuie sur la vidéo ci-dessous et l’illustre avec des schémas.</p>' }),
  block('video', { videoUrl: 'https://www.youtube.com/watch?v=Mo-o6nEx_yM' }),
  note('blue', '🔎 Analogie', '<p><strong>TCP</strong>, c’est un <strong>appel téléphonique</strong> : on décroche, on vérifie « tu m’entends ? — oui », puis on parle en s’assurant d’être suivi. <strong>UDP</strong>, c’est <strong>crier une info dans la rue</strong> (ou la radio en direct) : instantané, mais si quelqu’un n’a pas entendu, tant pis — on ne répète pas.</p>'),

  block('heading', { level: 2, text: '🔌 Le point commun : la couche Transport' }),
  block('html', { html: '<p>Avant de les opposer : TCP et UDP font le <strong>même métier de base</strong>. Ils prennent les données de tes applications, les emballent avec un <strong>en-tête</strong> contenant les <strong>ports</strong> (qui identifient le service : 443 = web, 53 = DNS…), et les confient au réseau. Tous deux vivent sur la <strong>couche 4 (Transport)</strong> du modèle <a href="/pages/les-7-couches-osi">OSI</a>.</p>' }),
  block('html', { html: svgSeg }),

  block('heading', { level: 2, text: '🟦 TCP — la fiabilité' }),
  block('html', { html: '<p>TCP (<em>Transmission Control Protocol</em>) garantit que <strong>tout arrive, intact et dans l’ordre</strong>. Pour ça, il établit d’abord une <strong>connexion</strong>, puis vérifie chaque envoi.</p>' }),
  block('html', { html: svgHandshake }),
  block('html', { html: '<p>Une fois la connexion ouverte, chaque segment est suivi. Si l’un se perd, TCP le <strong>renvoie</strong> :</p>' }),
  block('html', { html: svgTcp }),
  accordion([
    ['🤝 La connexion (poignée de main)', '<p>Avant d’échanger, TCP établit une connexion en <strong>3 temps</strong> (SYN → SYN-ACK → ACK), comme se dire « allô ? — oui — parfait » avant de parler.</p>'],
    ['📦 L’ordre & les accusés de réception', '<p>Chaque segment est <strong>numéroté</strong> et le destinataire <strong>accuse réception</strong> (ACK). Les données sont <strong>remises dans l’ordre</strong>, même si elles arrivent mélangées.</p>'],
    ['🔁 La retransmission', '<p>Un segment non confirmé est considéré perdu → TCP le <strong>renvoie</strong>. À l’arrivée, <strong>rien ne manque</strong> : c’est ça, la fiabilité.</p>'],
    ['🚦 Le contrôle de flux & de congestion', '<p>TCP <strong>adapte son débit</strong> pour ne pas noyer le destinataire ni saturer le réseau : il ralentit dès qu’il détecte des pertes.</p>'],
    ['👋 La fermeture', '<p>En fin d’échange, la connexion se <strong>ferme proprement</strong> (FIN/ACK), des deux côtés.</p>'],
  ]),

  block('heading', { level: 2, text: '🟧 UDP — la rapidité' }),
  block('html', { html: '<p>UDP (<em>User Datagram Protocol</em>) fait l’inverse : <strong>aucune connexion, aucune vérification</strong>. Il envoie les données et passe à la suite. C’est <strong>rapide et léger</strong>, mais sans filet.</p>' }),
  block('html', { html: svgUdp }),
  accordion([
    ['📨 Sans connexion', '<p>Pas de poignée de main : on envoie les <strong>datagrammes</strong> directement, sans prévenir. Zéro temps perdu à établir un lien.</p>'],
    ['🤷 Aucune garantie', '<p>UDP ne vérifie <strong>rien</strong> : pas d’accusé, pas de renvoi, pas de remise en ordre. Un datagramme perdu est… perdu.</p>'],
    ['⚡ Léger & rapide', '<p>En-tête minuscule, aucun contrôle : c’est <strong>le plus rapide</strong>. Idéal quand la vitesse compte plus que la perfection.</p>'],
    ['📡 La diffusion', '<p>UDP sait <strong>diffuser</strong> à plusieurs destinataires d’un coup (broadcast / multicast), ce que TCP ne sait pas faire.</p>'],
  ]),

  block('heading', { level: 2, text: '⚖️ TCP ou UDP ? Le comparatif' }),
  block('html', { html: compare }),

  block('heading', { level: 2, text: '🎯 Le cas réel : lequel choisir ?' }),
  block('html', { html: '<p>La bonne question n’est pas « lequel est le meilleur ? » mais « <strong>qu’est-ce qui compte le plus ici</strong> : ne rien perdre, ou aller vite ? »</p>' }),
  accordion([
    ['🌐 Charger une page web / télécharger → TCP', '<p>On veut <strong>toutes</strong> les données, <strong>exactes</strong> : un seul octet manquant et l’image ou le fichier est corrompu. La fiabilité prime → <strong>TCP</strong> (HTTP/HTTPS).</p>'],
    ['📞 Appel visio / téléphonie (VoIP) → UDP', '<p>Mieux vaut une image qui <strong>saute</strong> qu’un appel qui <strong>fige</strong> pour rattraper une image déjà périmée. La vitesse prime → <strong>UDP</strong>.</p>'],
    ['🎮 Jeu en ligne → UDP', '<p>La position d’il y a 2 secondes ne sert à rien : on veut <strong>la dernière</strong>, tout de suite. → <strong>UDP</strong>.</p>'],
    ['🔎 Requête DNS → UDP (puis TCP si besoin)', '<p>Une question courte « quelle IP pour ce nom ? » → <strong>UDP</strong> (rapide). Si la réponse est trop grosse, on bascule sur <strong>TCP</strong>.</p>'],
  ]),

  note('green', '💡 À retenir', '<p><strong>TCP</strong> = <strong>fiable</strong> mais plus lent (connexion, accusés, renvoi, ordre) → web, mail, fichiers. <strong>UDP</strong> = <strong>rapide</strong> mais sans garantie → visio, jeu, streaming, DNS. Les deux vivent sur la <strong>couche Transport (4)</strong> du modèle <a href="/pages/les-7-couches-osi">OSI</a> et utilisent des <strong>ports</strong>. Sigles (TCP, UDP, ACK, SYN…) dans le <a href="/glossaire">Glossaire</a>.</p>'),
];

const PAGE = {
  slug: SLUG,
  title: 'TCP & UDP',
  excerpt: 'TCP vs UDP expliqué simplement : fiabilité ou vitesse, poignée de main, perte et renvoi, comparatif et cas réels — avec vidéo et schémas.',
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

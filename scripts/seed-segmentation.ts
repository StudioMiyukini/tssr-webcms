/* Page « La segmentation de sous-réseaux (subnetting) » : les deux méthodes — par nombre de
   sous-réseaux (FLSM) et par nombre d'hôtes (VLSM) — avec la méthode pas-à-pas et les exemples
   corrigés du tuto (192.168.10.0/24). Schémas de découpage + tableaux de résultats.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-segmentation.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const code = (html: string) => block('html', { html: `<div style="font-family:ui-monospace,monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:6px 0;overflow-x:auto;font-size:14px;line-height:1.7">${html}</div>` });

const C = { net: '#2563eb', dev: '#059669', warn: '#d97706', danger: '#dc2626', grey: '#64748b', slate: '#475569', purple: '#7c3aed', ok: '#16a34a' };

// Tableau des sous-réseaux : [nom, idsr, plage utilisable, broadcast, cidr, msr]
const subnetTable = (rows: Array<[string, string, string, string, string, string]>) => `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:720px;font-size:13.5px">
<thead><tr style="background:var(--surface-2)">${['Sous-réseau', 'IDSR (réseau)', 'Plage utilisable', 'Broadcast', 'CIDR / Masque'].map(c => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${c}</th>`).join('')}</tr></thead><tbody>
${rows.map(([nom, idsr, plage, brd, cidr, msr]) => `<tr>`
  + `<td style="padding:8px 10px;border:1px solid var(--border);font-weight:700;color:#fff;background:${C.net};white-space:nowrap">${nom}</td>`
  + `<td style="padding:8px 10px;border:1px solid var(--border);font-family:ui-monospace,monospace;white-space:nowrap">${idsr}</td>`
  + `<td style="padding:8px 10px;border:1px solid var(--border);font-family:ui-monospace,monospace;white-space:nowrap">${plage}</td>`
  + `<td style="padding:8px 10px;border:1px solid var(--border);font-family:ui-monospace,monospace;white-space:nowrap">${brd}</td>`
  + `<td style="padding:8px 10px;border:1px solid var(--border);white-space:nowrap"><b>${cidr}</b><br><span class="meta" style="font-size:12px;font-family:ui-monospace,monospace">${msr}</span></td>`
  + `</tr>`).join('')}
</tbody></table></div>`;

// Barre de découpage 0→255 : segments [label, sous-label, débutPct, largeurPct, couleur]
const wrap = (h: number, inner: string) => `<svg viewBox="0 0 640 ${h}" role="img" style="max-width:640px;width:100%;height:auto;margin:8px 0 14px;font-family:system-ui,sans-serif">${inner}</svg>`;
const segBar = (segs: Array<[string, string, number, number, string]>) => {
  const X = 10, W = 620, Y = 24, H = 46;
  let s = `<text x="${X}" y="16" font-size="11" fill="${C.slate}" font-weight="bold">192.168.10.0/24 — 256 adresses (.0 → .255)</text>`;
  for (const [label, sub, start, width, col] of segs) {
    const x = X + (start / 256) * W, w = (width / 256) * W;
    s += `<rect x="${x}" y="${Y}" width="${w}" height="${H}" rx="4" fill="${col}" stroke="#fff" stroke-width="1.5"/>`;
    if (w > 40) {
      s += `<text x="${x + w / 2}" y="${Y + 20}" text-anchor="middle" font-size="11" fill="#fff" font-weight="bold">${label}</text>`;
      s += `<text x="${x + w / 2}" y="${Y + 36}" text-anchor="middle" font-size="9.5" fill="#fff" fill-opacity="0.92">${sub}</text>`;
    } else {
      s += `<text x="${x + w / 2}" y="${Y + H + 14}" text-anchor="middle" font-size="9" fill="${col}" font-weight="bold">${label}</text>`;
    }
  }
  return s;
};
// Méthode par hôtes (VLSM) : SR2=.0–.127, SR3=.128–.191, SR1=.192–.199, libre=.200–.255
const svgVlsm = wrap(96, segBar([
  ['SR2 · 64 hôtes', '/25 · .0–.127', 0, 128, C.net],
  ['SR3 · 36 hôtes', '/26 · .128–.191', 128, 64, C.dev],
  ['SR1', '.192/29', 192, 8, C.warn],
  ['Libre', '.200–.255', 200, 56, C.grey],
]));
// Méthode par sous-réseaux (FLSM) : 8 blocs de 32, 5 utilisés
const svgFlsm = wrap(96, segBar([
  ['SR1', '.0/27', 0, 32, C.net],
  ['SR2', '.32/27', 32, 32, C.purple],
  ['SR3', '.64/27', 64, 32, C.net],
  ['SR4', '.96/27', 96, 32, C.purple],
  ['SR5', '.128/27', 128, 32, C.net],
  ['libre', '', 160, 96, C.grey],
]));

// ===================================================================================
// PAGE
// ===================================================================================
const SLUG = 'segmentation-sous-reseaux';
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Réseau', title: 'La segmentation de sous-réseaux (subnetting)', subtitle: 'Découper un réseau en plusieurs sous-réseaux : par nombre de sous-réseaux (FLSM) ou par nombre d’hôtes (VLSM).' }),
  block('html', { html: '<p>La <strong>segmentation</strong> (ou <em>subnetting</em>) consiste à <strong>découper un grand réseau en plusieurs sous-réseaux</strong> plus petits. On agrandit le <strong>masque</strong> (le CIDR), en empruntant des bits à la partie « machine » pour créer une partie « sous-réseau ». Objectifs : <strong>cloisonner</strong> (sécurité, isolation des services), <strong>organiser</strong> (un sous-réseau par service ou par étage) et <strong>limiter le gaspillage</strong> d’adresses.</p>' }),
  note('blue', '🧰 Prérequis', '<p>Cette page suppose les bases du <a href="/pages/calcul-ip-masque">calcul d’IP & masque (nombre magique)</a> et de l’<a href="/pages/ip-et-binaire">IP en binaire</a>. On y réutilise : <strong>CIDR</strong>, <strong>masque (MSR)</strong>, <strong>IDSR</strong> (adresse réseau), <strong>broadcast</strong> et <strong>nombre d’hôtes</strong> = 2<sup>(32−CIDR)</sup> − 2.</p>'),

  block('html', { html: `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:560px;font-size:14px"><thead><tr style="background:var(--surface-2)">${['Méthode', 'On part de…', 'Principe'].map(c => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${c}</th>`).join('')}</tr></thead><tbody>` +
    `<tr><td style="padding:8px 10px;border:1px solid var(--border);font-weight:700;color:#fff;background:${C.net}">Par sous-réseaux (FLSM)</td><td style="padding:8px 10px;border:1px solid var(--border)">d’un <b>nombre de sous-réseaux</b> voulu</td><td style="padding:8px 10px;border:1px solid var(--border)">Des sous-réseaux <b>tous de même taille</b>. On <b>ajoute</b> des bits au CIDR.</td></tr>` +
    `<tr><td style="padding:8px 10px;border:1px solid var(--border);font-weight:700;color:#fff;background:${C.dev}">Par hôtes (VLSM)</td><td style="padding:8px 10px;border:1px solid var(--border)">d’un <b>nombre d’hôtes</b> par sous-réseau</td><td style="padding:8px 10px;border:1px solid var(--border)">Des sous-réseaux <b>de tailles différentes</b>, ajustés au besoin. On part de <b>/32</b>.</td></tr>` +
    `</tbody></table></div>` }),

  // ============================ MÉTHODE 1 ============================
  block('heading', { level: 2, text: '1️⃣ Segmentation par nombre de sous-réseaux (FLSM)' }),
  block('html', { html: '<p>On veut un <strong>certain nombre de sous-réseaux</strong>, tous de <strong>même taille</strong>. La méthode :</p>' }),
  block('list', { listItems: [
    'Déterminer l’IDSR de l’adresse de départ.',
    'Prendre le nombre de sous-réseaux voulu et trouver l’exposant de 2 supérieur ou égal à ce nombre (2ⁿ ≥ nombre).',
    'Ajouter cet exposant au CIDR de départ → c’est le nouveau CIDR (et donc le nouveau masque MSR).',
    'Convertir le nouveau masque en binaire et repérer le dernier bit à 1 : sa valeur décimale = le « pas » (l’écart entre deux sous-réseaux).',
    'Dérouler les sous-réseaux de pas en pas : IDSR, broadcast et plage utilisable.',
  ] }),

  block('heading', { level: 3, text: '📝 Exemple — 5 sous-réseaux depuis 192.168.10.0/24' }),
  code(
    'Adresse de départ&nbsp;: <b>192.168.10.25 /24</b> → IDSR&nbsp;: <b>192.168.10.0 /24</b><br>'
    + 'Objectif&nbsp;: <b>5 sous-réseaux</b><br>'
    + '① 2<sup>n</sup> ≥ 5&nbsp;→ 2<sup>3</sup> = 8 ≥ 5&nbsp;&nbsp;⇒ exposant = <b>3</b><br>'
    + '② nouveau CIDR&nbsp;: 24 + 3 = <b>/27</b>&nbsp;&nbsp;⇒ MSR&nbsp;: <b>255.255.255.224</b><br>'
    + '③ /27 en binaire&nbsp;: 1111&nbsp;1111.1111&nbsp;1111.1111&nbsp;1111.<b>111</b>0&nbsp;0000<br>'
    + '④ dernier bit à 1&nbsp;= <b>32</b>&nbsp;&nbsp;⇒ le « pas » = <b>32</b>'
  ),
  block('html', { html: '<p>On déroule alors de <strong>32 en 32</strong> (8 sous-réseaux possibles, on en utilise 5) :</p>' }),
  block('html', { html: svgFlsm }),
  block('html', { html: subnetTable([
    ['SR1', '192.168.10.0', '.1 → .30', '192.168.10.31', '/27', '255.255.255.224'],
    ['SR2', '192.168.10.32', '.33 → .62', '192.168.10.63', '/27', '255.255.255.224'],
    ['SR3', '192.168.10.64', '.65 → .94', '192.168.10.95', '/27', '255.255.255.224'],
    ['SR4', '192.168.10.96', '.97 → .126', '192.168.10.127', '/27', '255.255.255.224'],
    ['SR5', '192.168.10.128', '.129 → .158', '192.168.10.159', '/27', '255.255.255.224'],
  ]) }),
  note('green', '💡 À retenir', '<p>Chaque sous-réseau /27 offre <strong>32 adresses</strong>, dont <strong>30 utilisables</strong> (on retire IDSR + broadcast). Le découpage est <strong>régulier</strong> : tous les sous-réseaux ont la même taille, qu’on en ait besoin ou non.</p>'),

  // ============================ MÉTHODE 2 ============================
  block('heading', { level: 2, text: '2️⃣ Segmentation par nombre d’hôtes (VLSM)' }),
  block('html', { html: '<p>Ici, chaque sous-réseau a un <strong>besoin d’hôtes différent</strong>. On <strong>taille chaque sous-réseau au plus juste</strong> (VLSM — <em>Variable Length Subnet Mask</em>), pour éviter le gaspillage. La méthode pour <strong>un</strong> sous-réseau :</p>' }),
  block('list', { listItems: [
    'Prendre le nombre d’hôtes voulu et y AJOUTER 2 (l’adresse réseau IDSR et le broadcast ne sont pas utilisables par les hôtes).',
    'Trouver l’exposant de 2 immédiatement supérieur ou égal à ce total (2ⁿ ≥ hôtes + 2).',
    'Calculer le CIDR : /32 − n. En déduire le masque (MSR).',
    'Convertir le masque en binaire, repérer le dernier bit à 1 → sa valeur = le « pas » du sous-réseau.',
    'En déduire IDSR, broadcast et plage. Recommencer pour le sous-réseau suivant à partir de l’adresse libre.',
  ] }),
  note('yellow', '⚠️ Deux pièges à éviter', '<p>1. <strong>N’oubliez jamais le +2</strong> (IDSR + broadcast) avant de chercher la puissance de 2.<br>2. <strong>Traitez les sous-réseaux par ordre décroissant</strong> du nombre d’hôtes (le plus gros d’abord). Sinon les blocs ne s’alignent pas correctement et vous gaspillez de l’espace.</p>'),

  block('heading', { level: 3, text: '📝 Exemple — 3 sous-réseaux : 64, 36 et 5 hôtes' }),
  block('html', { html: '<p>Depuis <strong>192.168.10.0/24</strong> (256 adresses), on veut : <strong>SR1 = 5 hôtes</strong>, <strong>SR2 = 64 hôtes</strong>, <strong>SR3 = 36 hôtes</strong>. On les traite dans l’ordre <strong>décroissant : SR2 (64) → SR3 (36) → SR1 (5)</strong>.</p>' }),
  code(
    '<b>SR2 — 64 hôtes</b>&nbsp;: 64 + 2 = 66 → 2<sup>7</sup> = 128 ≥ 66&nbsp;⇒ CIDR = 32 − 7 = <b>/25</b> → MSR 255.255.255.128&nbsp;(pas = 128)<br>'
    + '<b>SR3 — 36 hôtes</b>&nbsp;: 36 + 2 = 38 → 2<sup>6</sup> = 64 ≥ 38&nbsp;⇒ CIDR = 32 − 6 = <b>/26</b> → MSR 255.255.255.192&nbsp;(pas = 64)<br>'
    + '<b>SR1 — 5 hôtes</b>&nbsp;:&nbsp; 5 + 2 = 7&nbsp;&nbsp; → 2<sup>3</sup> = 8 ≥ 7&nbsp;&nbsp;&nbsp;⇒ CIDR = 32 − 3 = <b>/29</b> → MSR 255.255.255.248&nbsp;(pas = 8)'
  ),
  block('html', { html: '<p>On place les blocs les uns après les autres, du plus gros au plus petit :</p>' }),
  block('html', { html: svgVlsm }),
  block('html', { html: subnetTable([
    ['SR2 · 64 h', '192.168.10.0', '.1 → .126', '192.168.10.127', '/25', '255.255.255.128'],
    ['SR3 · 36 h', '192.168.10.128', '.129 → .190', '192.168.10.191', '/26', '255.255.255.192'],
    ['SR1 · 5 h', '192.168.10.192', '.193 → .198', '192.168.10.199', '/29', '255.255.255.248'],
  ]) }),
  note('green', '💡 Pourquoi le VLSM gagne de la place', '<p>Avec un découpage régulier (FLSM), il aurait fallu prendre la taille du plus gros (/25 pour 64 hôtes) <strong>pour tous</strong> — impossible de loger 3 réseaux dans un /24. En VLSM, on consomme seulement <strong>.0 → .199</strong> et il reste <strong>.200 → .255 de libre</strong> pour de futurs besoins.</p>'),

  // ============================ MÉMO ============================
  block('heading', { level: 2, text: '🧠 Mémo' }),
  block('html', { html: `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:520px;font-size:14px"><thead><tr style="background:var(--surface-2)">${['CIDR', 'Masque (MSR)', 'Adresses', 'Hôtes utiles'].map(c => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${c}</th>`).join('')}</tr></thead><tbody>` +
    ([
      ['/24', '255.255.255.0', '256', '254'],
      ['/25', '255.255.255.128', '128', '126'],
      ['/26', '255.255.255.192', '64', '62'],
      ['/27', '255.255.255.224', '32', '30'],
      ['/28', '255.255.255.240', '16', '14'],
      ['/29', '255.255.255.248', '8', '6'],
      ['/30', '255.255.255.252', '4', '2'],
    ] as Array<[string, string, string, string]>).map(r => `<tr><td style="padding:8px 10px;border:1px solid var(--border);font-weight:700;font-family:ui-monospace,monospace">${r[0]}</td><td style="padding:8px 10px;border:1px solid var(--border);font-family:ui-monospace,monospace">${r[1]}</td><td style="padding:8px 10px;border:1px solid var(--border)">${r[2]}</td><td style="padding:8px 10px;border:1px solid var(--border);font-weight:600">${r[3]}</td></tr>`).join('') +
    `</tbody></table></div>` }),
  note('blue', '🎯 En résumé', '<p><strong>Par sous-réseaux (FLSM)</strong> : 2<sup>n</sup> ≥ nombre de SR → CIDR de départ <strong>+ n</strong>. Tous identiques.<br><strong>Par hôtes (VLSM)</strong> : hôtes <strong>+ 2</strong> → 2<sup>n</sup> ≥ total → CIDR = <strong>/32 − n</strong>. Du plus gros au plus petit. Le « pas » = dernier bit à 1 du masque. Pour s’entraîner : <a href="/pages/calcul-ip-masque">calculateur d’IP & masque</a>.</p>'),
];

const PAGE = {
  slug: SLUG,
  title: 'La segmentation de sous-réseaux (subnetting)',
  excerpt: 'Découper un réseau en sous-réseaux : méthode par nombre de sous-réseaux (FLSM) et par nombre d’hôtes (VLSM), avec la démarche pas-à-pas et des exemples corrigés.',
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

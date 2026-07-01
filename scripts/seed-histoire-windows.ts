/* Cours « L'histoire de Windows » (digeste, d'après toutwindows.com/historique-de-windows).
   Crée la page + l'ajoute en tête de la colonne Software du hub Cours.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-histoire-windows.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock, type CardItem } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const SLUG = 'histoire-de-windows';
const TITLE = 'L’histoire de Windows';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const accordion = (it: Array<[string, string]>) => block('accordion', { items: it.map(([title, text]) => ({ title, text, href: '' })) });
const ul = (items: string[]) => `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`;

// ===== Helpers SVG (conventions Miyukini CMS) =====
const C = { net: '#2563eb', dev: '#059669', warn: '#d97706', grey: '#64748b', slate: '#475569', purple: '#7c3aed' };
const wrap = (w: number, h: number, inner: string) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="max-width:${w}px;width:100%;height:auto;margin:8px 0 14px;font-family:system-ui,sans-serif">${inner}</svg>`;
const line = (x1: number, y1: number, x2: number, y2: number, col = '#94a3b8') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="2.5"/>`;
const cap = (x: number, y: number, t: string, col = '#64748b', s = 11) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${s}" fill="${col}">${t}</text>`;
const lbl = (x: number, y: number, t: string, col = '#475569', s = 11) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${s}" fill="${col}" font-weight="bold">${t}</text>`;

// ===== Frise chronologique horizontale (jalons alternes au-dessus / en dessous de l'axe) =====
// Annees/versions reellement citees dans la page (texte ASCII only dans les <text>).
const svgTimeline = (() => {
  const pts: Array<[string, string, string]> = [
    ['1985', 'Windows 1.0', C.grey],
    ['1990', 'Windows 3.0', C.slate],
    ['1993', 'NT 3.1', C.dev],
    ['1995', 'Windows 95', C.net],
    ['1998', 'Windows 98', C.net],
    ['2000', 'Windows 2000', C.dev],
    ['2001', 'Windows XP', C.purple],
    ['2006', 'Vista', C.warn],
    ['2009', 'Windows 7', C.purple],
    ['2015', 'Windows 10', C.warn],
    ['2021', 'Windows 11', C.net],
  ];
  const W = 860, H = 160, x0 = 36, x1 = W - 36, y = 80, n = pts.length;
  const step = (x1 - x0) / (n - 1);
  let s = line(x0, y, x1, y, '#94a3b8');
  pts.forEach((p, i) => {
    const x = x0 + i * step, up = i % 2 === 0;
    const tickEnd = up ? y - 14 : y + 14;
    s += line(x, y, x, tickEnd, p[2]);
    s += `<circle cx="${x}" cy="${y}" r="6" fill="${p[2]}"/>`;
    s += lbl(x, up ? y - 32 : y + 30, p[0], p[2], 12);
    s += cap(x, up ? y - 18 : y + 44, p[1], C.slate, 10);
  });
  return wrap(W, H, s);
})();

// ===== Frise chronologique (SVG, CSP-safe) =====
const frise = (() => {
  const pts: Array<[string, string, string]> = [
    ['1985', 'Windows 1.0', '#64748b'], ['1993', 'NT 3.1', '#0891b2'], ['1995', 'Windows 95', '#2563eb'],
    ['2001', 'XP', '#16a34a'], ['2009', 'Seven (7)', '#7c3aed'], ['2015', 'Windows 10', '#d97706'], ['2021', 'Windows 11', '#dc2626'],
  ];
  const W = 700, x0 = 40, x1 = W - 30, y = 80, n = pts.length;
  const step = (x1 - x0) / (n - 1);
  let s = `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="#94a3b8" stroke-width="3"/>`;
  pts.forEach((p, i) => {
    const x = x0 + i * step, up = i % 2 === 0;
    s += `<circle cx="${x}" cy="${y}" r="7" fill="${p[2]}"/>`;
    s += `<text x="${x}" y="${up ? y - 30 : y + 44}" text-anchor="middle" font-size="13" font-weight="bold" fill="${p[2]}">${p[1]}</text>`;
    s += `<text x="${x}" y="${up ? y - 14 : y + 28}" text-anchor="middle" font-size="12" fill="#64748b">${p[0]}</text>`;
    s += `<line x1="${x}" y1="${up ? y - 10 : y + 10}" x2="${x}" y2="${y}" stroke="${p[2]}" stroke-width="2"/>`;
  });
  return `<svg viewBox="0 0 ${W} 130" role="img" style="max-width:${W}px;width:100%;height:auto;margin:8px 0 14px;font-family:system-ui,sans-serif">${s}</svg>`;
})();

// ===== Les deux lignées qui convergent vers XP =====
const conv = (() => {
  const box = (x: number, y: number, w: number, h: number, f: string, l: string, sub: string) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${f}"/><text x="${x + w / 2}" y="${y + h / 2 - 1}" text-anchor="middle" font-size="12" fill="#fff" font-weight="bold">${l}</text><text x="${x + w / 2}" y="${y + h / 2 + 14}" text-anchor="middle" font-size="10" fill="#e5e7eb">${sub}</text>`;
  const defs = '<defs><marker id="a2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8"/></marker></defs>';
  const ar = (x1: number, y1: number, x2: number, y2: number) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#94a3b8" stroke-width="2.5" marker-end="url(#a2)"/>`;
  let s = box(8, 8, 150, 46, '#0891b2', 'Branche NT', 'pro / serveur, robuste')
    + box(8, 96, 150, 46, '#2563eb', 'Branche 9x', 'grand public, sur DOS')
    + box(250, 52, 120, 46, '#16a34a', 'Windows XP', '2001 — fusion')
    + box(410, 52, 130, 46, '#7c3aed', 'Vista → 11', 'l’ère moderne');
  s += ar(158, 31, 250, 64) + ar(158, 119, 250, 86) + ar(370, 75, 410, 75);
  return `<svg viewBox="0 0 560 150" role="img" style="max-width:560px;width:100%;height:auto;margin:8px 0 14px;font-family:system-ui,sans-serif">${defs}${s}</svg>`;
})();

const cultes: CardItem[] = [
  { title: '🪟 Windows 95', text: '1995 — menu Démarrer, barre des tâches, Plug and Play. La révolution grand public.', href: '' },
  { title: '🛡️ Windows XP', text: '2001 — fusion fiabilité (NT) + convivialité (9x). Un succès qui a duré.', href: '' },
  { title: '👍 Windows 7', text: '2009 — le « bon » Vista : rapide, stable, adoré des utilisateurs.', href: '' },
  { title: '🔄 Windows 10', text: '2015 — retour du menu Démarrer + « Windows as a service » (maj continues).', href: '' },
  { title: '✨ Windows 11', text: '2021 — design épuré et centré, exigences matérielles (TPM 2.0).', href: '' },
];

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Software', title: TITLE, subtitle: 'Près de 40 ans d’évolution, des fenêtres posées sur MS-DOS jusqu’à Windows 11 — en version digeste.' }),
  block('html', { html: '<p><strong>Windows</strong> est né en 1985 comme une simple <strong>surcouche graphique</strong> posée sur MS-DOS (un système en ligne de commande). En quatre décennies, il est devenu le système d’exploitation le plus répandu sur les PC. Son histoire tient en une idée simple : <strong>deux lignées</strong> (une pour le grand public, une pour les professionnels) qui ont fini par <strong>fusionner</strong>.</p>' }),
  block('html', { html: svgTimeline }),
  block('heading', { level: 2, text: 'La frise express' }),
  block('html', { html: frise }),
  block('heading', { level: 2, text: 'Les deux lignées… qui n’en font plus qu’une' }),
  block('html', { html: conv }),
  block('html', { html: '<p>Pendant les années 90, Microsoft a mené <strong>deux gammes en parallèle</strong> : la branche <strong>9x</strong> (Windows 95/98/Me), conviviale mais bâtie sur MS-DOS et fragile, et la branche <strong>NT</strong> (NT 3.x/4.0, 2000), robuste et pensée pour les entreprises. <strong>Windows XP (2001)</strong> a réuni les deux : la solidité de NT <em>et</em> la simplicité grand public. Depuis, tout descend de NT.</p>' }),
  block('heading', { level: 2, text: 'Les versions cultes' }),
  block('cards', { items: cultes }),
  block('heading', { level: 2, text: 'Époque par époque' }),
  accordion([
    ['🌱 1985–1990 — Les débuts graphiques', ul([
      '<strong>Windows 1.0 (1985)</strong> : la toute première interface graphique, posée sur MS-DOS.',
      '<strong>Windows 2.0 (1987)</strong> : fenêtres qui se chevauchent, échange de données entre applis (DDE).',
      '<strong>Windows 3.0 / 3.1 (1990–92)</strong> : premier vrai succès — Gestionnaire de programmes, Gestionnaire de fichiers, 16 couleurs.',
    ])],
    ['🏢 1993–2000 — La branche NT (pro / serveur)', ul([
      '<strong>NT 3.1 (1993)</strong> : architecture <strong>32 bits</strong>, multitâche, multiprocesseur, système de fichiers <strong>NTFS</strong>.',
      '<strong>NT 3.5 (1994)</strong> : prise en charge native de <strong>TCP/IP</strong> (le protocole d’Internet).',
      '<strong>NT 4.0 (1996)</strong> : reprend l’interface de Windows 95, intègre le serveur web <strong>IIS</strong>.',
      '<strong>Windows 2000 (2000)</strong> : arrivée d’<strong>Active Directory</strong> (l’annuaire d’entreprise).',
    ])],
    ['🏠 1995–2000 — La branche 9x (grand public)', ul([
      '<strong>Windows 95 (1995)</strong> : <strong>menu Démarrer</strong>, <strong>barre des tâches</strong>, <strong>Plug and Play</strong> — la révolution pour le grand public.',
      '<strong>Windows 98 (1998)</strong> : meilleure prise en charge de l’<strong>USB</strong>, Internet Explorer intégré.',
      '<strong>Windows Me (2000)</strong> : version éphémère et réputée instable, fin de la lignée DOS.',
    ])],
    ['🤝 2001 — Windows XP, la convergence', '<p><strong>Windows XP (2001)</strong> réunit enfin les deux mondes : le noyau solide de <strong>NT</strong> et la <strong>convivialité</strong> du grand public. Stable, simple, il connaît un <strong>immense succès</strong> et une durée de vie record (plus de 12 ans de support).</p>'],
    ['💻 2006–2015 — L’ère moderne', ul([
      '<strong>Windows Vista (2006)</strong> : grande refonte visuelle (Aero), mais lourd et mal accueilli.',
      '<strong>Windows 7 (2009)</strong> : le « Vista réussi » — rapide et stable, plébiscité.',
      '<strong>Windows 8 / 8.1 (2012–13)</strong> : interface <strong>Metro</strong> à tuiles, pensée pour le tactile — controversée (disparition du menu Démarrer).',
      '<strong>Windows 10 (2015)</strong> : <strong>retour du menu Démarrer</strong> et modèle « <strong>Windows as a service</strong> » : mises à jour continues plutôt qu’une nouvelle version tous les 3 ans.',
    ])],
    ['✨ 2021 → Aujourd’hui — Windows 11', '<p><strong>Windows 11 (2021)</strong> : design <strong>épuré et centré</strong>, fenêtres arrondies, intégration de nouveautés (widgets, IA). Il impose des <strong>exigences matérielles</strong> (puce de sécurité <strong>TPM 2.0</strong>) et adopte un rythme de <strong>mises à jour annuelles</strong>.</p>'],
  ]),
  note('blue', '🖧 Et Windows Server ?', '<p>En parallèle des versions « bureau », Microsoft édite <strong>Windows Server</strong> (issu de la même branche NT) : <strong>Server 2003, 2008/R2, 2012, 2016, 2019, 2022, 2025</strong>. Même socle, mais orienté <strong>services réseau</strong> (annuaire, web, virtualisation). Voir le cours <a href="/pages/windows-server">Windows Server</a> et <a href="/pages/roles-windows-server">Les rôles de Windows Server</a>.</p>'),
  note('green', '💡 À retenir', '<p>Windows = une <strong>surcouche graphique</strong> (1985) devenue l’OS dominant. Retiens les <strong>3 temps</strong> : deux lignées séparées (<strong>9x</strong> grand public / <strong>NT</strong> pro) → <strong>fusion avec XP</strong> (2001) → ère moderne (<strong>7, 10, 11</strong>) sous le modèle « service ». Termes (MS-DOS, NTFS, TPM…) dans le <a href="/glossaire">Glossaire</a>.</p>'),
  block('html', { html: '<p class="meta">Source d’inspiration : toutwindows.com — « Historique de Windows ».</p>' }),
];

// ===== Hub Cours — 4 colonnes (source de vérité) =====
const HARDWARE: Array<[string, string]> = [
  ['/pages/hardware', 'Le hardware'], ['/pages/les-form-factor', 'Les form factors'],
  ['/pages/ports-arriere-carte-mere', 'Les ports arrière de la carte-mère'], ['/pages/carte-mere', 'La carte-mère — connectique interne'],
  ['/pages/le-chipset', 'Le chipset'], ['/pages/le-processeur', 'Le processeur (CPU)'], ['/pages/le-raid', 'Les niveaux de RAID'],
];
const SOFTWARE: Array<[string, string]> = [
  ['/pages/histoire-de-windows', 'L’histoire de Windows'],
  ['/pages/le-systeme-exploitation', 'Le système d’exploitation'],
  ['/pages/demarrage-bios-uefi', 'Le démarrage : BIOS & UEFI'],
  ['/pages/systemes-de-fichiers', 'Les systèmes de fichiers'],
  ['/pages/gestion-ordinateur-windows', 'La gestion de l’ordinateur'],
  ['/pages/base-de-registre', 'La base de registre'],
  ['/pages/windows-server', 'Windows Server'],
  ['/pages/roles-windows-server', 'Les rôles de Windows Server'],
  ['/pages/gestionnaire-de-serveurs', 'Le gestionnaire de serveurs'],
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
  const bodyJson = JSON.stringify({ title: TITLE, slug: SLUG, excerpt: 'L’histoire de Windows en version digeste : de Windows 1.0 (1985) à Windows 11, et la fusion des lignées 9x et NT.', content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1 });
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

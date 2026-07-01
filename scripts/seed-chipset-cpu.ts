/* Crée 2 cours débutant : "Le chipset" et "Le processeur (CPU)" + les ajoute au hub Cours.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-chipset-cpu.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, normalizePageBlocks, type PageBlock, type CardItem } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const grp = (intro: string, items: string[], retenir: string) =>
  `<p>${intro}</p><ul>${items.map(i => `<li>${i}</li>`).join('')}</ul><p><strong>À retenir :</strong> ${retenir}</p>`;
const acc = (title: string, text: string) => ({ title, text, href: '' });

// ===== SVG helpers (style aligné sur seed-bases-reseau.ts) =====
const C = { net: '#2563eb', dev: '#059669', warn: '#d97706', grey: '#64748b', slate: '#475569', purple: '#7c3aed' };
const wrap = (w: number, h: number, inner: string) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="max-width:${w}px;width:100%;height:auto;margin:8px 0 14px;font-family:system-ui,sans-serif">${inner}</svg>`;
const line = (x1: number, y1: number, x2: number, y2: number, col = '#94a3b8') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="2.5"/>`;
const cap = (x: number, y: number, t: string, col = '#64748b', s = 11) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${s}" fill="${col}">${t}</text>`;
const lbl = (x: number, y: number, t: string, col = '#475569', s = 11) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${s}" fill="${col}" font-weight="bold">${t}</text>`;

// Schéma en blocs : CPU <-> chipset (PCH) <-> périphériques/bus cités dans la page
const boxR = (x: number, y: number, w: number, h: number, fill: string, t: string, sub = '', tcol = '#fff') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}"/>`
  + `<text x="${x + w / 2}" y="${y + (sub ? h / 2 - 2 : h / 2 + 4)}" text-anchor="middle" font-size="13" fill="${tcol}" font-weight="bold">${t}</text>`
  + (sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 14}" text-anchor="middle" font-size="10" fill="${tcol}" fill-opacity="0.9">${sub}</text>` : '');
// flèche bidirectionnelle simple (ligne + petits chevrons aux deux bouts non requis : on garde des lignes nettes)
const svgChipset = wrap(640, 360,
  // CPU en haut
  boxR(245, 18, 150, 48, C.slate, 'CPU', 'processeur')
  // RAM directement reliee au CPU (controleur memoire integre)
  + boxR(470, 24, 130, 38, C.purple, 'RAM', 'DDR4 / DDR5')
  + line(395, 43, 470, 43, C.purple) + cap(432, 36, 'rapide', C.purple, 9)
  // lien CPU <-> chipset (bus, ex. DMI)
  + line(320, 66, 320, 122, C.net)
  + cap(360, 98, 'bus CPU <-> chipset', C.net, 10)
  // Chipset au centre
  + boxR(220, 124, 200, 56, C.net, 'CHIPSET (PCH)', "aiguilleur de donnees")
  // Halo "aiguilleur"
  + cap(320, 198, 'Le chipset oriente les donnees entre le CPU et les peripheriques', C.grey, 10)
  // Peripheriques / bus en bas, relies au chipset
  + line(255, 180, 90, 250, C.dev) + boxR(30, 252, 120, 42, C.dev, 'PCIe', 'cartes / SSD')
  + line(290, 180, 235, 250, C.dev) + boxR(165, 252, 110, 42, C.dev, 'USB', 'ports')
  + line(330, 180, 355, 250, C.dev) + boxR(290, 252, 130, 42, C.dev, 'SATA', 'stockage')
  + line(370, 180, 500, 250, C.dev) + boxR(435, 252, 110, 42, C.dev, 'Reseau', 'LAN / Wi-Fi')
  + line(405, 180, 600, 250, C.warn) + boxR(560, 252, 60, 42, C.warn, 'Audio')
  + cap(320, 340, 'CPU et RAM dialoguent directement ; tout le reste passe par le chipset.', C.grey, 11));

// ===== CHIPSET =====
const chipsetCards: CardItem[] = [
  { title: '🧭 Aiguilleur', text: 'Fait circuler les données entre le CPU et le reste.', href: '' },
  { title: '🔗 Fonctionnalités', text: 'Nombre de ports USB/SATA, PCIe, overclocking.', href: '' },
  { title: '🏛️ Une seule puce', text: 'Le northbridge est passé dans le processeur (PCH).', href: '' },
  { title: '🔤 Lettre = segment', text: 'Intel H/B/Z, AMD A/B/X.', href: '' },
  { title: '🤝 Compatibilité', text: 'Doit s\'accorder au socket et à la génération du CPU.', href: '' },
  { title: '🧩 Exemples', text: 'Intel B75/B760/Z790, AMD B650/X670.', href: '' },
];
const chipsetBlocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Hardware', title: 'Le chipset', subtitle: 'La puce qui orchestre la carte-mère, expliquée simplement.' }),
  block('html', { html: '<p>Le <strong>chipset</strong> est une puce de la carte-mère qui orchestre les échanges entre le processeur et tous les composants. C\'est lui qui décide de ce que la carte « sait faire ».</p>' }),
  block('html', { html: svgChipset }),
  block('html', { html: '<aside class="pb-note pb-note-blue"><p class="pb-note-title">🧭 En clair</p><p>Le chipset détermine les <strong>fonctionnalités</strong> de la carte (nombre de ports, overclocking, PCIe). Sur la <a href="/pages/carte-mere">carte-mère</a> du TP, c\'est le n°8 (Intel B75).</p></aside>' }),
  block('heading', { level: 2, text: 'L\'essentiel en un coup d\'œil' }),
  block('cards', { items: chipsetCards }),
  block('heading', { level: 2, text: 'Le détail' }),
  block('html', { html: '<p class="meta">Clique sur une rubrique pour la déplier.</p>' }),
  block('accordion', { items: [
    acc('🧭 C\'est quoi un chipset ?', grp(
      'Une puce (souvent sous un petit radiateur) qui sert d\'<strong>aiguilleur</strong> : elle fait circuler les données entre le processeur et le reste de la carte (stockage, USB, slots, réseau).',
      ['Pense à un <strong>chef de gare</strong> qui dirige les trains (les données) vers les bons quais.', 'Repéré par son nom sur la carte (ex. B75, Z790, B650).'],
      'le chipset est l\'intermédiaire entre le processeur et les périphériques.')),
    acc('🔗 Ce qu\'il détermine', grp(
      'Le chipset fixe les <strong>fonctionnalités</strong> de la carte-mère.',
      ['Le <strong>nombre de ports</strong> USB et SATA.', 'Le nombre de <strong>lignes PCIe</strong> (cartes, SSD).', 'La possibilité d\'<strong>overclocker</strong> (pousser le CPU/la RAM).', 'Des options avancées : RAID, Wi-Fi intégré selon les modèles.'],
      'même socket mais chipset différent = options différentes.')),
    acc('🏛️ Northbridge & Southbridge', grp(
      'Avant, le chipset, c\'était <strong>deux puces</strong>.',
      ['<strong>Northbridge</strong> : rapide, près du CPU, gérait RAM et carte graphique.', '<strong>Southbridge</strong> : plus lent, gérait les périphériques (USB, SATA, audio).', 'Aujourd\'hui le northbridge est <strong>intégré au processeur</strong> ; il ne reste qu\'une puce (le <strong>PCH</strong> chez Intel).'],
      'le « chipset » moderne ≈ l\'ancien southbridge ; le reste est dans le CPU.')),
    acc('🔤 Lire un nom de chipset', grp(
      'La <strong>lettre</strong> indique le segment, le <strong>chiffre</strong> la génération.',
      ['<strong>Intel</strong> : H (entrée), B (bureautique/PME, ex. B75/B760), Z (haut de gamme + overclocking, ex. Z790), W/X (stations de travail).', '<strong>AMD</strong> : A (entrée), B (grand public, ex. B650), X (haut de gamme, ex. X670). Le chiffre = la génération.'],
      'plus on monte (Z chez Intel, X chez AMD), plus la carte est équipée.')),
    acc('🤝 Compatibilité', grp(
      'Le chipset doit s\'accorder avec le processeur.',
      ['Il va de pair avec un <strong>socket</strong> et une <strong>génération</strong> de CPU précis.', 'Avant d\'acheter : vérifier <strong>CPU ↔ socket ↔ chipset</strong> (parfois une mise à jour du BIOS est nécessaire).'],
      'le bon trio CPU/socket/chipset = un montage qui démarre.')),
  ] }),
  block('html', { html: '<aside class="pb-note pb-note-green"><p class="pb-note-title">🧭 Pour aller plus loin</p><p>Le chipset doit correspondre au socket et à la génération du processeur. Voir aussi <a href="/pages/le-processeur">Le processeur</a> et la <a href="/pages/carte-mere">carte-mère</a>. Sigles dans le <a href="/glossaire">Glossaire TSSR</a>.</p></aside>' }),
];

// ===== PROCESSEUR =====
const cpuCards: CardItem[] = [
  { title: '🧠 Le cerveau', text: 'Exécute les instructions et calcule.', href: '' },
  { title: '🏭 Fabricants', text: 'Intel, AMD (et ARM).', href: '' },
  { title: '🔌 Socket', text: 'LGA (Intel) / PGA-LGA (AMD).', href: '' },
  { title: '⚙️ Cœurs & threads', text: 'Tâches en parallèle.', href: '' },
  { title: '⏱️ Fréquence & cache', text: 'Vitesse et mémoire interne.', href: '' },
  { title: '🌡️ Refroidissement', text: 'Ventirad + pâte thermique.', href: '' },
];
const cpuBlocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Hardware', title: 'Le processeur (CPU)', subtitle: 'Le cerveau de l\'ordinateur : fabricants, sockets et fonctions, expliqués simplement.' }),
  block('html', { html: '<p>Le <strong>processeur</strong> (CPU, <em>Central Processing Unit</em>) est le cerveau de l\'ordinateur. Voici qui le fabrique, comment il se branche (socket) et ce qui fait sa puissance.</p>' }),
  block('html', { html: '<aside class="pb-note pb-note-blue"><p class="pb-note-title">🧷 Le trio à vérifier</p><p><strong>Processeur ↔ socket de la carte-mère ↔ chipset</strong> doivent être compatibles, plus le type de <strong>RAM</strong> (DDR4 ou DDR5).</p></aside>' }),
  block('heading', { level: 2, text: 'L\'essentiel en un coup d\'œil' }),
  block('cards', { items: cpuCards }),
  block('heading', { level: 2, text: 'Le détail' }),
  block('html', { html: '<p class="meta">Clique sur une rubrique pour la déplier.</p>' }),
  block('accordion', { items: [
    acc('🧠 C\'est quoi un processeur ?', grp(
      'Le CPU est le <strong>cerveau</strong> : il exécute les instructions des programmes et fait les calculs.',
      ['Il lit les instructions en mémoire, les exécute et renvoie les résultats — des milliards d\'opérations par seconde.', 'Tout passe par lui : c\'est le composant central.'],
      'sans processeur, rien ne tourne.')),
    acc('🏭 Fabricants', grp(
      'Deux grands fabricants pour les PC.',
      ['<strong>Intel</strong> : Core i3 / i5 / i7 / i9 (et Core Ultra récents), Xeon pour les serveurs.', '<strong>AMD</strong> : Ryzen 3 / 5 / 7 / 9, Threadripper et EPYC pour le pro/serveur.', '<strong>ARM</strong> : surtout mobile et Mac (Apple Silicon), de plus en plus présent.'],
      'pour un PC de bureau ou un serveur : Intel et AMD dominent.')),
    acc('🔌 Sockets', grp(
      'Le socket est l\'<strong>emplacement</strong> du processeur sur la carte-mère ; il doit correspondre au CPU.',
      ['<strong>Intel — LGA</strong> : les broches sont sur la carte-mère (ex. LGA 1155, 1200, 1700).', '<strong>AMD — PGA puis LGA</strong> : broches sous le CPU (AM4), puis sur la carte-mère (AM5).', 'Le socket va de pair avec un <strong>chipset</strong> et une génération de CPU.'],
      'CPU ↔ socket ↔ chipset doivent être cohérents, sinon ça ne se monte pas.')),
    acc('⚙️ Caractéristiques (fonctions)', grp(
      'Ce qui définit la puissance d\'un processeur.',
      ['<strong>Cœurs</strong> : plusieurs « mini-processeurs » → plus de tâches en parallèle.', '<strong>Threads</strong> : chaque cœur peut traiter 2 fils (Hyper-Threading Intel / SMT AMD).', '<strong>Fréquence (GHz)</strong> : la vitesse de traitement.', '<strong>Cache (L1/L2/L3)</strong> : mémoire ultra-rapide intégrée.', '<strong>TDP (watts)</strong> : consommation et chaleur dégagée.', '<strong>iGPU</strong> : certains intègrent une puce graphique (pas besoin de carte graphique pour la bureautique).'],
      'plus de cœurs + fréquence élevée + gros cache = plus rapide (mais plus chaud).')),
    acc('🌡️ Refroidissement', grp(
      'Le processeur chauffe en travaillant : il faut évacuer la chaleur.',
      ['Un <strong>ventirad</strong> (radiateur + ventilateur) ou un <strong>watercooling</strong>.', 'Une fine couche de <strong>pâte thermique</strong> entre le CPU et le radiateur.'],
      'sans refroidissement, le CPU ralentit puis s\'arrête pour se protéger.')),
    acc('🛒 Lire un nom de CPU', grp(
      'Le nom encode la gamme, la génération et le suffixe.',
      ['<strong>Intel Core i7-13700K</strong> : i7 = gamme, 13 = génération, K = débloqué (overclocking).', '<strong>AMD Ryzen 7 7800X3D</strong> : Ryzen 7 = gamme, 7000 = génération, X3D = gros cache pour le jeu.', 'Suffixes — Intel : K (overclock), F (sans iGPU), H/U (portables). AMD : X (perf), G (avec iGPU).'],
      'gamme + génération + suffixe te disent le positionnement de la puce.')),
  ] }),
  block('html', { html: '<aside class="pb-note pb-note-green"><p class="pb-note-title">🧭 Pour aller plus loin</p><p>Voir aussi <a href="/pages/carte-mere">la carte-mère</a> (le socket = n°2) et <a href="/pages/le-chipset">le chipset</a>. Sigles dans le <a href="/glossaire">Glossaire TSSR</a>.</p></aside>' }),
];

const PAGES = [
  { slug: 'le-chipset', title: 'Le chipset', excerpt: 'Cours débutant : le chipset de la carte-mère vulgarisé.', blocks: chipsetBlocks },
  { slug: 'le-processeur', title: 'Le processeur (CPU)', excerpt: 'Cours débutant : fabricants, sockets et fonctions du processeur.', blocks: cpuBlocks },
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

  for (const p of PAGES) {
    const body = JSON.stringify({ title: p.title, slug: p.slug, excerpt: p.excerpt, content: renderPageBlocksToHtml(p.blocks), builder_json: serializePageBlocks(p.blocks), published: 1 });
    const cur = existing.find(x => x.slug === p.slug);
    const res = cur
      ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body })
      : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
    console.log(`PAGE ${p.slug}`, res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());
  }

  // Hub Cours : boutons manquants
  const cours = existing.find(p => p.slug === 'cours');
  if (cours) {
    const full = await (await fetch(`${BASE}/api/admin/pages/${cours.id}`, { headers: { Cookie: cookie } })).json() as { builder_json: string };
    const hub = normalizePageBlocks(full.builder_json);
    const hrefs = new Set(hub.filter(b => b.type === 'button').map(b => b.href.replace(/^https?:\/\/[^/]+/, '')));
    let added = 0;
    for (const p of PAGES) if (!hrefs.has(`/pages/${p.slug}`)) { hub.push(block('button', { label: p.title, href: `/pages/${p.slug}`, variant: 'secondary' })); added++; }
    if (added) {
      const r2 = await fetch(`${BASE}/api/admin/pages/${cours.id}`, { method: 'PUT', headers: h, body: JSON.stringify({ title: 'Cours', slug: 'cours', content: renderPageBlocksToHtml(hub), builder_json: serializePageBlocks(hub), published: 1 }) });
      console.log(`HUB Cours : ${added} bouton(s) ajouté(s)`, r2.status);
    } else console.log('HUB Cours : déjà à jour');
  }
  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

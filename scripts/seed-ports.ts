/* Crée la page de cours "Les ports arrière de la carte-mère" (débutant, blocs) et l'ajoute au hub Cours.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-ports.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, normalizePageBlocks, type PageBlock, type CardItem } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const SLUG = 'ports-arriere-carte-mere';
const TITLE = 'Les ports arrière de la carte-mère';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);

const grp = (intro: string, items: string[], retenir: string) =>
  `<p>${intro}</p><ul>${items.map(i => `<li>${i}</li>`).join('')}</ul><p><strong>À retenir :</strong> ${retenir}</p>`;

// ===================================================================================
// Schéma SVG : le panneau d'E/S arrière de la carte-mère
// ===================================================================================
const C = { net: '#2563eb', dev: '#059669', warn: '#d97706', danger: '#dc2626', grey: '#64748b', slate: '#475569', purple: '#7c3aed' };
const wrap = (w: number, h: number, inner: string) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="max-width:${w}px;width:100%;height:auto;margin:8px 0 14px;font-family:system-ui,sans-serif">${inner}</svg>`;
const cap = (x: number, y: number, t: string, col = '#64748b', s = 11) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${s}" fill="${col}">${t}</text>`;
const lbl = (x: number, y: number, t: string, col = '#475569', s = 11) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${s}" fill="${col}" font-weight="bold">${t}</text>`;

// Un port = un petit rectangle coloré + une étiquette dessous (ASCII only dans les <text>)
const port = (x: number, y: number, w: number, h: number, fill: string, label: string, stroke = '#1e293b') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`
  + cap(x + w / 2, y + h + 13, label, C.slate, 9.5);

// Port rond (PS/2 combiné, jacks audio)
const round = (cx: number, cy: number, r: number, fill: string, label: string) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="#1e293b" stroke-width="1.2"/><circle cx="${cx}" cy="${cy}" r="${r * 0.4}" fill="#0f172a" fill-opacity="0.35"/>`
  + cap(cx, cy + r + 13, label, C.slate, 9.5);

const svgPanel = wrap(660, 250,
  // Le panneau métallique (grand rectangle)
  `<rect x="14" y="14" width="632" height="200" rx="10" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>`
  + `<rect x="22" y="22" width="616" height="184" rx="7" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1"/>`
  // PS/2 combiné (vert/violet) — périphériques
  + round(58, 60, 16, C.purple, 'PS/2')
  // USB-A 2.0 (noir) + USB-A 3.0 (bleu)
  + port(96, 48, 26, 14, '#1e293b', 'USB-A 2.0')
  + port(96, 70, 26, 14, C.net, 'USB-A 3.0')
  // USB-C (gris)
  + port(150, 52, 22, 11, C.slate, 'USB-C')
  + port(150, 73, 22, 11, C.slate, 'USB-C')
  // Video : VGA (bleu), HDMI, DisplayPort
  + port(204, 50, 46, 22, C.net, 'VGA')
  + port(266, 50, 40, 18, C.danger, 'HDMI')
  + port(322, 50, 40, 18, C.danger, 'DisplayPort')
  // Reseau RJ45
  + port(204, 96, 36, 30, C.dev, 'RJ45')
  + cap(222, 142, '(reseau)', C.grey, 8.5)
  // USB-A double rangee supplementaire
  + port(266, 96, 26, 14, C.net, 'USB-A')
  + port(266, 118, 26, 14, C.net, 'USB-A')
  // Audio : jacks 3.5 mm (vert sortie, bleu entree, rose micro) + optique
  + round(440, 60, 11, '#16a34a', 'Sortie')
  + round(480, 60, 11, C.net, 'Entree')
  + round(520, 60, 11, '#ec4899', 'Micro')
  + round(560, 60, 11, '#facc15', 'Surround')
  + round(600, 60, 11, '#94a3b8', 'Caisson')
  + port(440, 104, 26, 18, '#0f172a', 'Optique')
  + cap(453, 138, 'S/PDIF', C.grey, 8.5)
  // Etiquettes de zones
  + lbl(95, 30, 'Peripheriques (USB / PS/2)', C.slate, 10)
  + lbl(283, 30, 'Video', C.slate, 10)
  + lbl(520, 30, 'Audio (jacks 3.5 mm)', C.slate, 10)
  + cap(330, 234, 'Panneau d\'E/S arriere : chaque prise a une forme et souvent une couleur qui indiquent son usage.', C.grey, 11));

const categories: Array<{ title: string; text: string }> = [
  { title: '🖥️ Vidéo / écran', text: grp(
    'Pour brancher un ou plusieurs écrans. Les formats récents sont numériques (image nette, et le son passe avec).',
    ['<strong>VGA</strong> (prise bleue, 15 broches) — analogique, ancien : à éviter aujourd\'hui.',
     '<strong>DVI</strong> — transition analogique/numérique, en voie de disparition.',
     '<strong>HDMI</strong> — numérique, image + son. Le plus répandu (écrans, TV).',
     '<strong>DisplayPort</strong> et <strong>mini-DisplayPort</strong> — numérique, haute performance (taux de rafraîchissement élevés, plusieurs écrans).',
     '<strong>USB-C</strong> (mode DisplayPort) — peut aussi transporter la vidéo.'],
    'VGA et DVI = anciens ; HDMI et DisplayPort = les standards actuels.') },
  { title: '🔌 USB & périphériques', text: grp(
    'Pour connecter clavier, souris, clés USB, disques externes, imprimantes…',
    ['<strong>USB Type-A</strong> — le rectangle classique. Repère couleur : <strong>noir/blanc</strong> = USB 2.0, <strong>bleu</strong> = USB 3.0 (plus rapide).',
     '<strong>USB-C</strong> — petit, réversible, rapide ; tend à tout remplacer.',
     '<strong>PS/2</strong> — ancien port rond : <strong>vert</strong> = souris, <strong>violet</strong> = clavier (parfois un seul port combiné).',
     '<strong>FireWire</strong> (IEEE 1394) — ancien, pour caméras vidéo. Obsolète.',
     '<strong>Port parallèle (LPT)</strong> — très ancien, imprimantes d\'époque. Disparu.'],
    'USB-A bleu = USB 3 (rapide) ; USB-C = le futur ; PS/2 et parallèle = vestiges.') },
  { title: '🌐 Réseau', text: grp(
    'Pour la connexion filaire au réseau local et à Internet.',
    ['<strong>Ethernet (RJ45)</strong> — prise carrée à clip, pour le câble réseau. Plus stable et constant que le Wi-Fi.'],
    'RJ45 = réseau filaire ; le débit dépend de la carte (1 Gb/s courant, 2,5 Gb/s sur les cartes récentes).') },
  { title: '💾 Stockage externe', text: grp(
    'Pour brancher un disque externe directement sur le bus SATA.',
    ['<strong>eSATA</strong> — version externe du SATA, pour disques externes.'],
    'eSATA est devenu rare : aujourd\'hui on branche le stockage externe en USB.') },
  { title: '🔊 Audio', text: grp(
    'Les prises jack colorées (3,5 mm) et la sortie optique pour le son.',
    ['<strong>Vert</strong> — sortie son (enceintes / casque, voie frontale).',
     '<strong>Bleu</strong> — entrée ligne (line-in, source externe).',
     '<strong>Rose</strong> — entrée microphone.',
     'Sorties <strong>surround</strong>/arrière et <strong>caisson de basses</strong> (central/subwoofer) pour le son multicanal (5.1, 7.1).',
     '<strong>Optique numérique (S/PDIF)</strong> — son numérique vers une barre de son ou un ampli.'],
    'mémo couleurs : vert = sortie, bleu = entrée, rose = micro.') },
  { title: '🛠️ Boutons spéciaux (BIOS)', text: grp(
    'Présents sur certaines cartes-mères (souvent gaming / haut de gamme).',
    ['<strong>BIOS Flashback</strong> (port « flash BIOS ») — met à jour le BIOS depuis une clé USB, même sans processeur installé.',
     '<strong>Clear / Reset BIOS</strong> — réinitialise les réglages du BIOS (utile après un mauvais paramétrage).'],
    'ces boutons dépannent le BIOS sans rien démonter.') },
];

const overview: CardItem[] = [
  { title: '🖥️ Vidéo', text: 'VGA, DVI, HDMI, DisplayPort, USB-C.', href: '' },
  { title: '🔌 USB & périphériques', text: 'USB-A, USB-C, PS/2, FireWire, parallèle.', href: '' },
  { title: '🌐 Réseau', text: 'Ethernet (RJ45).', href: '' },
  { title: '💾 Stockage externe', text: 'eSATA.', href: '' },
  { title: '🔊 Audio', text: 'Jacks couleur + optique numérique.', href: '' },
  { title: '🛠️ Boutons BIOS', text: 'Flashback, Clear/Reset BIOS.', href: '' },
];

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Hardware', title: TITLE, subtitle: 'Le panneau d\'entrées/sorties à l\'arrière du PC : reconnaître chaque prise et savoir quoi y brancher.' }),
  block('html', { html: '<p>À l\'arrière de l\'ordinateur, la carte-mère expose un <strong>panneau de ports</strong> (E/S) : c\'est là qu\'on branche l\'écran, le clavier, la souris, le réseau, le son et les périphériques USB. Chaque prise a une forme — et souvent une couleur — qui indique son usage.</p>' }),
  block('html', { html: svgPanel }),
  block('html', { html: '<aside class="pb-note pb-note-blue"><p class="pb-note-title">🎨 Les codes couleur utiles</p><p><strong>PS/2</strong> : vert = souris, violet = clavier. <strong>USB-A</strong> : bleu = USB 3 (rapide). <strong>Audio</strong> : vert = sortie (enceintes), bleu = entrée, rose = micro.</p></aside>' }),
  block('heading', { level: 2, text: 'Les ports en un coup d\'œil' }),
  block('cards', { items: overview }),
  block('heading', { level: 2, text: 'Le détail par type de port' }),
  block('html', { html: '<p class="meta">Clique sur une catégorie pour déplier les ports.</p>' }),
  block('accordion', { items: categories.map(c => ({ title: c.title, text: c.text, href: '' })) }),
  block('html', { html: '<aside class="pb-note pb-note-green"><p class="pb-note-title">🧭 Bon à savoir</p><p>Les ports évoluent : <strong>VGA, DVI, PS/2, parallèle, FireWire</strong> disparaissent au profit de <strong>HDMI/DisplayPort, USB-C</strong> et du <strong>Wi-Fi</strong>. Tous les sigles sont définis dans le <a href="/glossaire">Glossaire TSSR</a>.</p></aside>' }),
];

const content = renderPageBlocksToHtml(blocks);
const builder_json = serializePageBlocks(blocks);

function cookieFrom(res: Response): string {
  const sc = (res.headers as any).getSetCookie?.() as string[] | undefined;
  return (sc && sc.length ? sc : [res.headers.get('set-cookie') || '']).map(c => c.split(';')[0]).filter(Boolean).join('; ');
}

async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: PW }) });
  if (!login.ok) throw new Error(`login ${login.status}`);
  const cookie = cookieFrom(login);
  const h = { 'Content-Type': 'application/json', Cookie: cookie };
  const pages = await (await fetch(`${BASE}/api/admin/pages`, { headers: { Cookie: cookie } })).json() as Array<{ id: number; slug: string }>;

  // 1) Créer / mettre à jour la page de cours
  const existing = pages.find(p => p.slug === SLUG);
  const body = JSON.stringify({ title: TITLE, slug: SLUG, excerpt: 'Cours débutant : identifier les ports du panneau arrière de la carte-mère.', content, builder_json, published: 1 });
  const res = existing
    ? await fetch(`${BASE}/api/admin/pages/${existing.id}`, { method: 'PUT', headers: h, body })
    : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log('PAGE cours', res.status, existing ? '(mise à jour)' : '(créée)', res.ok ? '' : await res.text());

  // 2) Ajouter au hub "Cours" les boutons manquants vers les cours hardware
  const cours = pages.find(p => p.slug === 'cours');
  if (cours) {
    const full = await (await fetch(`${BASE}/api/admin/pages/${cours.id}`, { headers: { Cookie: cookie } })).json() as { builder_json: string };
    const hubBlocks = normalizePageBlocks(full.builder_json);
    const hrefs = new Set(hubBlocks.filter(b => b.type === 'button').map(b => b.href.replace(/^https?:\/\/[^/]+/, '')));
    const wanted = [
      { label: 'Composants d\'un PC (Hardware)', href: '/pages/hardware' },
      { label: 'Les Form factor', href: '/pages/les-form-factor' },
      { label: TITLE, href: `/pages/${SLUG}` },
    ];
    let added = 0;
    for (const w of wanted) {
      if (!hrefs.has(w.href)) { hubBlocks.push(block('button', { label: w.label, href: w.href, variant: 'secondary' })); added++; }
    }
    if (added > 0) {
      const hb = JSON.stringify({ title: 'Cours', slug: 'cours', content: renderPageBlocksToHtml(hubBlocks), builder_json: serializePageBlocks(hubBlocks), published: 1 });
      const r2 = await fetch(`${BASE}/api/admin/pages/${cours.id}`, { method: 'PUT', headers: h, body: hb });
      console.log(`HUB Cours : ${added} bouton(s) ajouté(s) ->`, r2.status);
    } else console.log('HUB Cours : déjà à jour');
  }

  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

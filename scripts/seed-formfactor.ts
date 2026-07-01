/* Étoffe la page "Les Form factor" pour débutants, en blocs du page builder.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-formfactor.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock, type CardItem } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);

// ===================================================================================
// Infographie SVG : comparaison proportionnelle des formats de cartes-meres
// ===================================================================================
const C = { net: '#2563eb', dev: '#059669', warn: '#d97706', grey: '#64748b', slate: '#475569', purple: '#7c3aed' };
const wrap = (w: number, h: number, inner: string) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="max-width:${w}px;width:100%;height:auto;margin:8px 0 14px;font-family:system-ui,sans-serif">${inner}</svg>`;
const cap = (x: number, y: number, t: string, col = '#64748b', s = 11) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${s}" fill="${col}">${t}</text>`;
const lbl = (x: number, y: number, t: string, col = '#475569', s = 11) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${s}" fill="${col}" font-weight="bold">${t}</text>`;

// Rectangles a l'echelle : px = mm * F. Dimensions en mm (largeur x profondeur).
// Reprend les formats de la page : ATX, micro-ATX, mini-ITX, E-ATX.
const F = 0.55;
const PAD = 20, TOP = 34;
const formats = [
  { name: 'E-ATX',     w: 305, d: 330, col: C.purple, note: '305 x 330 mm' },
  { name: 'ATX',       w: 305, d: 244, col: C.net,    note: '305 x 244 mm' },
  { name: 'micro-ATX', w: 244, d: 244, col: C.dev,    note: '244 x 244 mm' },
  { name: 'mini-ITX',  w: 170, d: 170, col: C.warn,   note: '170 x 170 mm' },
];
const maxW = Math.max(...formats.map(f => f.w));
const maxD = Math.max(...formats.map(f => f.d));
const svgW = Math.round(maxW * F) + PAD * 2;
const svgH = Math.round(maxD * F) + TOP + 76;
const baseY = TOP + Math.round(maxD * F); // ligne de base commune (bas des cartes)
const svgFormats = wrap(svgW, svgH,
  lbl(svgW / 2, 18, 'Tailles relatives des cartes-meres (a l\'echelle)', C.slate, 13)
  // rectangles superposes, alignes en bas-gauche, du plus grand au plus petit
  + formats.map(f => {
      const rw = Math.round(f.w * F), rh = Math.round(f.d * F);
      const x = PAD, y = baseY - rh;
      return `<rect x="${x}" y="${y}" width="${rw}" height="${rh}" rx="4" fill="${f.col}" fill-opacity="0.14" stroke="${f.col}" stroke-width="2"/>`
        + lbl(x + 6, y + 16, f.name, f.col, 12).replace('text-anchor="middle"', 'text-anchor="start"')
        + cap(x + 6, y + 30, f.note, f.col, 10).replace('text-anchor="middle"', 'text-anchor="start"');
    }).join('')
  // legende : du plus grand au plus petit
  + cap(svgW / 2, baseY + 24, 'Meme echelle pour les 4 formats : E-ATX > ATX > micro-ATX > mini-ITX.', C.grey, 11)
  + cap(svgW / 2, baseY + 40, 'Plus le format est petit, moins il y a de slots RAM et PCIe.', C.grey, 11));

const cat = (intro: string, formats: string[], retenir: string) =>
  `<p>${intro}</p>`
  + `<p><strong>Les formats courants :</strong></p><ul>${formats.map(f => `<li>${f}</li>`).join('')}</ul>`
  + `<p><strong>À retenir :</strong> ${retenir}</p>`;

const categories: Array<{ title: string; text: string }> = [
  { title: '🧩 Cartes-mères', text: cat(
    'La taille et l\'agencement de la carte-mère. C\'est le format de référence : il fixe le boîtier compatible et le nombre de ports disponibles.',
    ['<strong>ATX</strong> (≈ 305 × 244 mm) — le standard : beaucoup de slots RAM et PCIe. Idéal pour un PC complet.',
     '<strong>micro-ATX (mATX)</strong> — plus compacte, moins de slots. Bon compromis taille / prix.',
     '<strong>mini-ITX</strong> (170 × 170 mm) — très petite : 2 slots RAM, 1 port PCIe. Pour mini-PC.',
     '<strong>E-ATX</strong> — plus grande qu\'ATX : stations de travail et serveurs.'],
    'la carte-mère doit rentrer dans un boîtier compatible avec son format.') },
  { title: '🧰 Boîtiers', text: cat(
    'La taille du boîtier, choisie selon le format de la carte-mère et le nombre de composants à loger.',
    ['<strong>Grande tour</strong> — beaucoup d\'espace (E-ATX, watercooling, plusieurs disques).',
     '<strong>Moyenne tour</strong> — le plus courant : accueille l\'ATX et les formats en dessous.',
     '<strong>Mini-tour</strong> — compacte, surtout pour micro-ATX.',
     '<strong>SFF (Small Form Factor)</strong> — très compact, pour mini-ITX.'],
    'un boîtier ATX accepte aussi mATX et mini-ITX ; l\'inverse n\'est pas vrai.') },
  { title: '🔌 Alimentations', text: cat(
    'Le format physique du bloc d\'alimentation, qui doit correspondre à l\'emplacement prévu dans le boîtier.',
    ['<strong>ATX</strong> — le standard, rentre dans la plupart des boîtiers.',
     '<strong>SFX</strong> — compact, pour les petits boîtiers (SFF / mini-ITX).'],
    'vérifier que le format d\'alim correspond à l\'emplacement du boîtier (ATX ≠ SFX).') },
  { title: '💽 Stockage (disques)', text: cat(
    'Le format physique des disques de stockage.',
    ['<strong>3,5 pouces</strong> — les disques durs (HDD) de bureau.',
     '<strong>2,5 pouces</strong> — SSD et HDD d\'ordinateur portable (en SATA).',
     '<strong>M.2</strong> — petite « barrette » qui se visse directement sur la carte-mère (SSD NVMe, très rapide).'],
    'M.2 NVMe = pas de câble et le plus rapide ; 2,5" SATA = facile à ajouter dans un PC existant.') },
  { title: '🗂️ Mémoire RAM', text: cat(
    'Le format des barrettes de mémoire vive.',
    ['<strong>DIMM</strong> — barrette longue, pour PC fixe.',
     '<strong>SO-DIMM</strong> — barrette courte, pour PC portable (et mini-PC).'],
    'fixe = DIMM, portable = SO-DIMM ; les deux ne sont pas interchangeables.') },
  { title: '🧱 Cartes d\'extension (PCIe)', text: cat(
    'Le format des cartes qui se branchent sur les ports PCIe de la carte-mère.',
    ['<strong>PCIe x16</strong> — port long, pour la carte graphique.',
     '<strong>PCIe x1</strong> — port court, pour les petites cartes (réseau, son, USB…).',
     '<strong>Low profile</strong> — version « demi-hauteur » pour les boîtiers compacts.'],
    'une petite carte (x1) entre dans un grand port (x16), mais pas l\'inverse.') },
];

const overview: CardItem[] = [
  { title: '🧩 Carte-mère', text: 'ATX, micro-ATX, mini-ITX, E-ATX.', href: '' },
  { title: '🧰 Boîtier', text: 'Grande / moyenne / mini-tour, SFF.', href: '' },
  { title: '🔌 Alimentation', text: 'ATX (standard), SFX (compact).', href: '' },
  { title: '💽 Stockage', text: '3,5", 2,5", M.2.', href: '' },
  { title: '🗂️ Mémoire RAM', text: 'DIMM (fixe), SO-DIMM (portable).', href: '' },
  { title: '🧱 Cartes PCIe', text: 'x16 (carte graphique), x1 (petites cartes).', href: '' },
];

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours', title: 'Les Form Factors', subtitle: 'Les formats standardisés des composants — pour comprendre la compatibilité, expliqué simplement.' }),
  block('html', { html: '<p>Un <strong>form factor</strong> (« format »), c\'est une <strong>norme de taille et d\'agencement</strong> d\'un composant : dimensions, trous de fixation, emplacement des connecteurs. Grâce à ces standards, les pièces sont <strong>compatibles et interchangeables</strong> — un peu comme le format A4 pour le papier.</p>' }),
  block('html', { html: '<aside class="pb-note pb-note-blue"><p class="pb-note-title">🧷 Pourquoi c\'est important</p><p>Avant de monter un PC, on choisit des formats cohérents. Une carte-mère <strong>ATX</strong> a besoin d\'un boîtier qui accepte l\'ATX ; un SSD <strong>M.2</strong> a besoin d\'un slot M.2 ; une alim <strong>SFX</strong> ne rentre que dans un emplacement SFX.</p></aside>' }),
  block('heading', { level: 2, text: 'Les formats en un coup d\'œil' }),
  block('cards', { items: overview }),
  block('heading', { level: 2, text: 'Le détail par catégorie' }),
  block('html', { html: '<p class="meta">Clique sur une catégorie pour déplier ses formats.</p>' }),
  block('accordion', { items: categories.map(c => ({ title: c.title, text: c.text, href: '' })) }),
  block('heading', { level: 2, text: 'Les cartes-mères à l\'échelle' }),
  block('html', { html: '<p>Voici les principaux formats de cartes-mères représentés <strong>à la même échelle</strong>, pour visualiser leurs tailles relatives :</p>' }),
  block('html', { html: svgFormats }),
  block('html', { html: '<aside class="pb-note pb-note-green"><p class="pb-note-title">🧭 Règle d\'or</p><p>Le format du <strong>boîtier</strong> doit être supérieur ou égal à celui de la <strong>carte-mère</strong>. Tous les sigles (ATX, M.2, PCIe, DIMM…) sont définis dans le <a href="/glossaire">Glossaire TSSR</a>.</p></aside>' }),
  block('image', { url: '/uploads/mq7zgzf7-lxst94-Fortformat.jpg', alt: 'Comparaison des form factors de cartes-mères' }),
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
  const ff = pages.find(p => p.slug === 'les-form-factor');
  const body = JSON.stringify({ title: 'Les Form factor', slug: 'les-form-factor', excerpt: 'Les formats standardisés des composants (pour débutants).', content, builder_json, published: 1 });
  const res = ff
    ? await fetch(`${BASE}/api/admin/pages/${ff.id}`, { method: 'PUT', headers: h, body })
    : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log('PAGE form factor', res.status, ff ? '(mise à jour)' : '(créée)', res.ok ? '' : await res.text());
  // Vide le cache public (sinon l'ancien contenu reste servi jusqu'au TTL)
  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

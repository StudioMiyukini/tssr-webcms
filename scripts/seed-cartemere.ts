/* Crée la page "La carte-mère — connectique interne" (cours débutant, blocs) + upload l'image du TP + hub Cours.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cartemere.ts */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, normalizePageBlocks, type PageBlock, type CardItem } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const SLUG = 'carte-mere';
const TITLE = 'La carte-mère — connectique interne';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);

const grp = (intro: string, items: string[], retenir: string) =>
  `<p>${intro}</p><ul>${items.map(i => `<li>${i}</li>`).join('')}</ul><p><strong>À retenir :</strong> ${retenir}</p>`;

const categories: Array<{ title: string; text: string }> = [
  { title: '🧠 Socket & mémoire', text: grp(
    'Là où se posent le « cerveau » et la mémoire de travail.',
    ['<strong>Socket CPU</strong> — l\'emplacement du processeur (levier + cadre métallique). Compatible avec un type de CPU précis.',
     '<strong>Slots DIMM</strong> — les fentes des barrettes de RAM, avec un clip à chaque extrémité.'],
    'le socket doit correspondre au processeur ; on insère la RAM jusqu\'au « clic » des clips.') },
  { title: '🔌 Alimentation de la carte', text: grp(
    'Les connecteurs qui amènent le courant depuis le bloc d\'alimentation.',
    ['<strong>ATX 24 broches</strong> — le gros connecteur qui alimente la carte-mère.',
     '<strong>CPU 8 broches</strong> (EPS / 12V) — alimente le processeur, situé en haut près du socket.'],
    'deux câbles d\'alim à brancher : 24 broches (carte-mère) + 8 broches (CPU). Sans le 8 broches, le PC ne démarre pas.') },
  { title: '💾 Stockage interne', text: grp(
    'Pour brancher les disques à l\'intérieur du boîtier.',
    ['<strong>Ports SATA</strong> — pour les disques HDD et SSD SATA (câble de données plat).',
     '<strong>Slots M.2</strong> — pour les SSD NVMe, une « barrette » vissée directement sur la carte.'],
    'SATA = avec câble ; M.2 NVMe = sans câble et plus rapide.') },
  { title: '🧱 Cartes d\'extension (PCIe)', text: grp(
    'Les fentes pour ajouter des cartes.',
    ['<strong>PCIe x16</strong> — la fente longue, pour la carte graphique.',
     '<strong>PCIe x1</strong> — les fentes courtes, pour les petites cartes (réseau, son, USB…).'],
    'la carte graphique va dans le premier port x16 ; une petite carte x1 entre aussi dans un x16.') },
  { title: '🌀 Ventilateurs (fan headers)', text: grp(
    'Les petits connecteurs qui alimentent et pilotent les ventilateurs.',
    ['<strong>CPU_FAN</strong> — le ventilateur du processeur (ventirad).',
     '<strong>SYS_FAN / CHA_FAN</strong> — les ventilateurs du boîtier.'],
    'connecteurs à 4 broches (PWM) = vitesse régulée automatiquement ; branche bien le CPU_FAN, sinon alerte au démarrage.') },
  { title: '🎛️ Façade du boîtier', text: grp(
    'Le petit faisceau de fils qui relie la façade du boîtier à la carte-mère.',
    ['<strong>Front panel (F_PANEL)</strong> — boutons Power et Reset + voyants (Power LED, HDD LED).',
     '<strong>USB façade</strong> — header USB 2.0 (9 broches), USB 3.x (gros connecteur bleu), USB-C de façade.',
     '<strong>Audio façade (F_AUDIO / HD Audio)</strong> — les prises casque/micro de devant.'],
    'le front panel est le branchement le plus délicat : respecter polarité (+/−) des LED et la sérigraphie.') },
  { title: '💡 Éclairage RGB', text: grp(
    'Les connecteurs pour les LED (bandes, ventilateurs lumineux).',
    ['<strong>RGB 12V</strong> — connecteur à 4 broches.',
     '<strong>ARGB 5V</strong> — connecteur à 3 broches (LED adressables, couleurs individuelles).'],
    '⚠️ ne pas confondre : brancher de l\'ARGB 5V sur du RGB 12V grille les LED.') },
  { title: '⚙️ BIOS & divers', text: grp(
    'Les éléments liés aux réglages.',
    ['<strong>Pile CMOS (CR2032)</strong> — garde l\'heure et les réglages du BIOS quand le PC est débranché.',
     '<strong>Clear CMOS</strong> (cavalier ou bouton) — réinitialise les réglages du BIOS.'],
    'un PC qui « oublie l\'heure » a souvent une pile CMOS à changer.') },
  { title: '🔒 Port TPM (sécurité)', text: grp(
    'Un connecteur (header) sur la carte-mère, pour brancher une puce <strong>TPM (Trusted Platform Module)</strong>. C\'est un petit coffre-fort matériel pour les secrets de sécurité.',
    ['Il stocke de façon <strong>sécurisée</strong> les clés de chiffrement, certificats et empreintes.',
     'Utilisé par <strong>BitLocker</strong> (chiffrement du disque sous Windows) et le démarrage sécurisé.',
     'Souvent déjà intégré au firmware : <strong>fTPM</strong> (AMD) ou <strong>PTT</strong> (Intel), à activer dans le BIOS — pas besoin de module physique.',
     'Sinon, un petit module se branche sur le <strong>header TPM</strong> de la carte-mère.'],
    'version actuelle <strong>TPM 2.0</strong> ; il est requis pour installer Windows 11.') },
];

const overview: CardItem[] = [
  { title: '🧠 Socket & RAM', text: 'Processeur et barrettes de mémoire.', href: '' },
  { title: '🔌 Alimentation', text: 'ATX 24 broches + CPU 8 broches.', href: '' },
  { title: '💾 Stockage', text: 'Ports SATA et slots M.2.', href: '' },
  { title: '🧱 PCIe', text: 'x16 (carte graphique), x1 (petites cartes).', href: '' },
  { title: '🌀 Ventilateurs', text: 'CPU_FAN, SYS_FAN (4 broches PWM).', href: '' },
  { title: '🎛️ Façade', text: 'Front panel, USB et audio de devant.', href: '' },
  { title: '💡 RGB', text: 'RGB 12V et ARGB 5V.', href: '' },
  { title: '⚙️ BIOS', text: 'Pile CMOS, Clear CMOS.', href: '' },
  { title: '🔒 TPM', text: 'Puce de sécurité (BitLocker, Windows 11).', href: '' },
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

  // Upload de l'image du TP (idempotent : on réutilise si déjà présente)
  let imgUrl = '';
  const media = await (await fetch(`${BASE}/api/admin/media`, { headers: { Cookie: cookie } })).json() as Array<{ url: string; original_name: string }>;
  const found = media.find(m => m.original_name === 'carte-mere-tp3.png');
  if (found) { imgUrl = found.url; console.log('IMAGE déjà présente', imgUrl); }
  else {
    const png = fs.readFileSync(path.join(__dirname, 'tp3-board.png'));
    const dataUrl = 'data:image/png;base64,' + png.toString('base64');
    const up = await fetch(`${BASE}/api/admin/media`, { method: 'POST', headers: h, body: JSON.stringify({ filename: 'carte-mere-tp3.png', dataUrl }) });
    const m = await up.json() as { url: string };
    imgUrl = m.url; console.log('IMAGE uploadée', up.status, imgUrl);
  }

  const blocks: PageBlock[] = [
    block('hero', { eyebrow: 'Cours · Hardware', title: TITLE, subtitle: 'Reconnaître les connecteurs internes d\'une carte-mère : socket, RAM, alimentation, stockage, ventilateurs, façade…' }),
    block('html', { html: '<p>La carte-mère relie tous les composants. Au-delà des <a href="/pages/ports-arriere-carte-mere">ports arrière</a>, elle porte de nombreux <strong>connecteurs internes</strong>, à l\'intérieur du boîtier. Les repérer, c\'est savoir monter un PC.</p>' }),
    block('html', { html: '<aside class="pb-note pb-note-blue"><p class="pb-note-title">🧷 Détrompeurs & sérigraphie</p><p>Chaque connecteur a une forme et une encoche qui n\'autorisent qu\'un seul sens de branchement. Les inscriptions sur la carte (<strong>CPU_FAN</strong>, <strong>F_PANEL</strong>, <strong>SATA3</strong>…) indiquent le rôle de chaque connecteur.</p></aside>' }),
    block('image', { url: imgUrl, alt: 'Carte-mère avec ses connecteurs internes (support du TP)', size: 60 }),
    block('html', { html: '<p class="meta" style="text-align:center">Modèle : Gigabyte GA-B75-D3V (socket LGA 1155).</p>' }),
    block('heading', { level: 2, text: 'Légende : à quoi correspondent les numéros' }),
    block('html', { html: '<ol>'
      + '<li><strong>Alimentation du processeur</strong> — 8 broches (ATX 12V / EPS)</li>'
      + '<li><strong>Socket du processeur</strong> (LGA 1155)</li>'
      + '<li><strong>Slots de mémoire RAM</strong> (DIMM)</li>'
      + '<li><strong>Connecteur mSATA</strong> (emplacement mini-SSD)</li>'
      + '<li><strong>Connecteur USB 3.0</strong> en façade</li>'
      + '<li><strong>Alimentation principale</strong> de la carte-mère (ATX 24 broches)</li>'
      + '<li><strong>Port d\'extension PCIe x1</strong></li>'
      + '<li><strong>Chipset</strong> (Intel B75)</li>'
      + '<li><strong>Port d\'extension PCIe x1</strong></li>'
      + '<li><strong>Port PCIe x16</strong> — carte graphique (PCI Express 3.0)</li>'
      + '<li><strong>Pile CMOS</strong> (CR2032 — garde l\'heure et les réglages du BIOS)</li>'
      + '<li><strong>Ports SATA</strong> (disques HDD / SSD)</li>'
      + '<li><strong>Connecteurs USB 2.0</strong> en façade</li>'
      + '<li><strong>Connecteur de façade</strong> du boîtier (F_PANEL : power, reset, LED)</li>'
      + '<li><strong>Connecteur audio</strong> en façade (F_AUDIO)</li>'
      + '</ol>' }),
    block('heading', { level: 2, text: 'Les connecteurs en un coup d\'œil' }),
    block('cards', { items: overview }),
    block('heading', { level: 2, text: 'Le détail par famille' }),
    block('html', { html: '<p class="meta">Clique sur une famille pour déplier les connecteurs.</p>' }),
    block('accordion', { items: categories.map(c => ({ title: c.title, text: c.text, href: '' })) }),
    block('html', { html: '<aside class="pb-note pb-note-green"><p class="pb-note-title">🧭 Astuce montage</p><p>Monte d\'abord <strong>CPU + RAM (+ ventirad)</strong> hors boîtier, puis branche l\'<strong>alimentation</strong> (24 broches + 8 broches CPU), enfin la <strong>façade</strong> (F_PANEL) et le <strong>stockage</strong>. Tous les sigles sont dans le <a href="/glossaire">Glossaire TSSR</a>.</p></aside>' }),
  ];
  const content = renderPageBlocksToHtml(blocks);
  const builder_json = serializePageBlocks(blocks);

  // Créer / mettre à jour la page
  const pages = await (await fetch(`${BASE}/api/admin/pages`, { headers: { Cookie: cookie } })).json() as Array<{ id: number; slug: string }>;
  const existing = pages.find(p => p.slug === SLUG);
  const body = JSON.stringify({ title: TITLE, slug: SLUG, excerpt: 'Cours débutant : la connectique interne de la carte-mère.', content, builder_json, published: 1 });
  const res = existing
    ? await fetch(`${BASE}/api/admin/pages/${existing.id}`, { method: 'PUT', headers: h, body })
    : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log('PAGE', res.status, existing ? '(maj)' : '(créée)', res.ok ? '' : await res.text());

  // Hub Cours : bouton vers la page
  const cours = pages.find(p => p.slug === 'cours');
  if (cours) {
    const full = await (await fetch(`${BASE}/api/admin/pages/${cours.id}`, { headers: { Cookie: cookie } })).json() as { builder_json: string };
    const hub = normalizePageBlocks(full.builder_json);
    const hrefs = new Set(hub.filter(b => b.type === 'button').map(b => b.href.replace(/^https?:\/\/[^/]+/, '')));
    if (!hrefs.has(`/pages/${SLUG}`)) {
      hub.push(block('button', { label: TITLE, href: `/pages/${SLUG}`, variant: 'secondary' }));
      const r2 = await fetch(`${BASE}/api/admin/pages/${cours.id}`, { method: 'PUT', headers: h, body: JSON.stringify({ title: 'Cours', slug: 'cours', content: renderPageBlocksToHtml(hub), builder_json: serializePageBlocks(hub), published: 1 }) });
      console.log('HUB Cours : bouton ajouté', r2.status);
    } else console.log('HUB Cours : déjà présent');
  }
  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

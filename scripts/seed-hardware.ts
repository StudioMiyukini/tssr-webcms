/* Étoffe le cours "Hardware" pour débutants, en blocs du page builder.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-hardware.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock, type CardItem } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);

const comp = (quoi: string, sert: string, retenir: string[]) =>
  `<p><strong>C'est quoi ?</strong> ${quoi}</p>`
  + `<p><strong>À quoi ça sert ?</strong> ${sert}</p>`
  + `<p><strong>À retenir :</strong></p><ul>${retenir.map(r => `<li>${r}</li>`).join('')}</ul>`;

const components: Array<{ title: string; text: string }> = [
  { title: '🧰 Boîtier (format ATX)', text: comp(
    'La « boîte » (métal + verre) qui contient et protège tous les composants.',
    'C\'est la maison de l\'ordinateur : il range les pièces, les protège de la poussière et des chocs, et organise la circulation de l\'air pour les refroidir.',
    ['<strong>ATX</strong> = le format (la taille) le plus répandu, compatible avec la plupart des cartes-mères.', 'En façade : bouton d\'allumage, prises USB, jack audio.', 'Un bon flux d\'air = composants plus au frais = PC plus stable.']) },
  { title: '🧩 Carte-mère (ATX)', text: comp(
    'La grande carte électronique sur laquelle se branchent TOUS les autres composants.',
    'C\'est la colonne vertébrale : elle relie le processeur, la mémoire, les disques et les cartes, et les fait communiquer.',
    ['Le <strong>socket</strong> reçoit le processeur (doit être compatible avec lui).', 'Les <strong>slots DIMM</strong> reçoivent les barrettes de RAM.', 'Les ports <strong>PCIe</strong> reçoivent la carte graphique ; <strong>SATA</strong> / <strong>M.2</strong> les disques.', 'Le format (ATX) doit correspondre au boîtier.']) },
  { title: '🔌 Alimentation (PSU)', text: comp(
    'Le bloc qui transforme le courant de la prise (230 V) en courant utilisable par le PC (12 V, 5 V, 3,3 V).',
    'C\'est le cœur électrique : sans elle, rien ne s\'allume. Elle distribue l\'énergie à chaque composant.',
    ['Puissance en <strong>watts (W)</strong> : prévoir une marge (≈ 550–750 W pour un PC courant).', 'Certification <strong>80 PLUS</strong> (Bronze, Gold…) = efficacité énergétique.', 'Connecteurs : 24 broches (carte-mère), CPU, PCIe (carte graphique).']) },
  { title: '🧠 Processeur (CPU)', text: comp(
    'La puce qui exécute les calculs et les instructions des programmes.',
    'C\'est le cerveau : il lit les instructions en mémoire, les exécute et renvoie les résultats. Tout passe par lui.',
    ['<strong>Cœurs</strong> : plus il y en a, plus il fait de choses en parallèle.', '<strong>Fréquence (GHz)</strong> : la vitesse de traitement.', 'Doit être compatible avec le <strong>socket</strong> de la carte-mère.', 'Marques principales : Intel et AMD.', 'Il chauffe → besoin d\'un refroidissement (ventirad).']) },
  { title: '❄️ Ventirad (refroidissement CPU)', text: comp(
    'Un radiateur métallique surmonté d\'un ventilateur, posé sur le processeur.',
    'C\'est la climatisation du cerveau : le processeur chauffe en travaillant ; le ventirad évacue cette chaleur pour éviter la surchauffe.',
    ['Une fine couche de <strong>pâte thermique</strong> améliore le contact CPU / radiateur.', 'Deux familles : <strong>à air</strong> (radiateur + ventilo) ou <strong>watercooling</strong> (liquide).', 'Sans refroidissement, le CPU ralentit, puis s\'arrête pour se protéger.']) },
  { title: '🌀 Ventilateur de boîtier', text: comp(
    'Une hélice qui brasse l\'air à l\'intérieur du boîtier.',
    'Il fait entrer l\'air frais et sortir l\'air chaud, pour garder tous les composants à bonne température.',
    ['On équilibre les <strong>entrées</strong> (avant/bas) et les <strong>sorties</strong> (arrière/haut).', 'Tailles courantes : 120 mm et 140 mm.', '<strong>PWM</strong> = vitesse régulée automatiquement selon la température.']) },
  { title: '🗂️ Mémoire vive (RAM)', text: comp(
    'La mémoire de travail : très rapide, mais temporaire.',
    'C\'est le bureau sur lequel on étale les dossiers en cours : le PC y garde ce qu\'il utilise <em>maintenant</em>. Tout est effacé à l\'extinction (mémoire « volatile »).',
    ['<strong>Capacité (Go)</strong> : 8 Go minimum, 16 Go confortable aujourd\'hui.', 'Type <strong>DDR4</strong> ou <strong>DDR5</strong> (doit correspondre à la carte-mère).', 'Se présente en <strong>barrettes</strong> (DIMM) à clipser dans les slots.', '⚠️ Ne pas confondre avec le <strong>stockage</strong> : la RAM oublie tout une fois éteinte.']) },
  { title: '🎮 Carte graphique (GPU)', text: comp(
    'Une carte spécialisée dans le calcul des images.',
    'Elle dessine ce qui s\'affiche à l\'écran. Indispensable pour les jeux, la 3D, le montage vidéo et l\'IA. Pour la bureautique, le graphique intégré au processeur suffit souvent.',
    ['<strong>VRAM</strong> = mémoire dédiée de la carte.', 'Se branche sur un port <strong>PCIe</strong> et demande souvent une alimentation dédiée.', '<strong>Intégrée</strong> (dans le CPU) vs <strong>dédiée</strong> (carte séparée, plus puissante).']) },
  { title: '💽 Disque dur (HDD)', text: comp(
    'Un disque de stockage à plateaux magnétiques qui tournent.',
    'C\'est la grande armoire : il garde tes fichiers même éteint (« non volatile »). Lent, mais peu cher au téraoctet — pratique pour stocker beaucoup.',
    ['Capacité en <strong>To</strong> (téraoctets).', 'Vitesse : 5400 ou 7200 tours/min — bien plus lent qu\'un SSD.', 'Pièces mécaniques → sensible aux chocs.', 'Idéal pour archives et sauvegardes, à éviter pour le système.']) },
  { title: '⚡ Disque SSD (SATA)', text: comp(
    'Un disque de stockage à mémoire flash, sans aucune pièce mobile.',
    'C\'est le tiroir rapide : beaucoup plus véloce que le HDD. À utiliser pour le système et les programmes → le PC démarre et répond bien plus vite.',
    ['Aucune pièce mécanique → silencieux et résistant.', 'SATA : ≈ 550 Mo/s (déjà 5 à 10× plus rapide qu\'un HDD).', 'Encore plus rapide : les SSD <strong>NVMe</strong> (format M.2).', '👉 Le meilleur rapport confort/prix pour réveiller un vieux PC.']) },
  { title: '🔗 Câble SATA', text: comp(
    'Le petit câble plat qui relie un disque (HDD ou SSD SATA) à la carte-mère.',
    'Il transporte les <strong>données</strong> entre le disque et la carte-mère. L\'énergie du disque, elle, arrive par un câble séparé venant de l\'alimentation.',
    ['Deux câbles par disque SATA : <strong>données</strong> (vers la carte-mère) + <strong>alimentation</strong> (vers le PSU).', 'Le connecteur en <strong>L</strong> ne se branche que dans un sens.', 'Les SSD M.2 / NVMe se branchent directement sur la carte-mère, sans câble.']) },
  { title: '💿 Lecteur optique', text: comp(
    'Le lecteur / graveur de CD, DVD ou Blu-ray.',
    'Il lit (et parfois grave) les disques optiques. De moins en moins utilisé : aujourd\'hui on installe surtout via clé USB ou Internet.',
    ['Optionnel sur un PC moderne.', 'Se branche en <strong>SATA</strong>, comme les disques.', 'Encore utile pour d\'anciens logiciels ou films sur disque.']) },
];

const overview: CardItem[] = [
  { title: '🧠 Processeur (CPU)', text: 'Le cerveau : il calcule tout.', href: '' },
  { title: '🗂️ Mémoire (RAM)', text: 'Le bureau : mémoire de travail rapide et temporaire.', href: '' },
  { title: '⚡ Stockage (SSD / HDD)', text: 'L\'armoire : garde tes fichiers même éteint.', href: '' },
  { title: '🧩 Carte-mère', text: 'La colonne vertébrale : relie tous les composants.', href: '' },
  { title: '🔌 Alimentation', text: 'L\'énergie : transforme le courant de la prise.', href: '' },
  { title: '🎮 Carte graphique', text: 'L\'image : calcule l\'affichage (jeux, 3D, IA).', href: '' },
  { title: '❄️ Refroidissement', text: 'La clim : ventirad + ventilateurs contre la chauffe.', href: '' },
  { title: '🧰 Boîtier', text: 'La maison : protège et organise le tout.', href: '' },
];

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours', title: 'Hardware — le matériel', subtitle: 'Les composants d\'un ordinateur expliqués simplement, pour bien débuter en informatique.' }),
  block('html', { html: '<p>Le <strong>hardware</strong> (« matériel »), c\'est tout ce qui est <strong>physique</strong> dans un ordinateur : les pièces qu\'on peut toucher. À l\'inverse, le <strong>software</strong> (« logiciel ») désigne les programmes. Un ordinateur est un assemblage de composants qui travaillent ensemble — chacun avec son rôle.</p>' }),
  block('html', { html: '<aside class="pb-note pb-note-blue"><p class="pb-note-title">💡 Le PC, c\'est une équipe</p><p>Un <strong>cerveau</strong> (processeur) qui calcule, une <strong>mémoire de travail</strong> (RAM) pour les tâches en cours, une <strong>mémoire longue durée</strong> (disque) pour tout garder, une <strong>colonne vertébrale</strong> (carte-mère) qui relie tout, et de l\'<strong>énergie</strong> (alimentation) pour faire fonctionner l\'ensemble.</p></aside>' }),
  block('heading', { level: 2, text: 'Les composants en un coup d\'œil' }),
  block('cards', { items: overview }),
  block('heading', { level: 2, text: 'Le détail, composant par composant' }),
  block('html', { html: '<p class="meta">Clique sur un composant pour déplier son explication.</p>' }),
  block('accordion', { items: components.map(c => ({ title: c.title, text: c.text, href: '' })) }),
  block('html', { html: '<aside class="pb-note pb-note-green"><p class="pb-note-title">🧭 Pour aller plus loin</p><p>Tous les sigles (CPU, RAM, SSD, PCIe, SATA…) sont définis dans le <a href="/glossaire">Glossaire TSSR</a> — pratique pour réviser le vocabulaire.</p></aside>' }),
  block('image', { url: '/uploads/mq7yllvk-4pmaz-Corps.png', alt: 'Vue des composants d\'un ordinateur' }),
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
  const hw = pages.find(p => p.slug === 'hardware');
  const body = JSON.stringify({ title: 'Hardware', slug: 'hardware', excerpt: 'Cours d\'introduction au matériel informatique (pour débutants).', content, builder_json, published: 1 });
  const res = hw
    ? await fetch(`${BASE}/api/admin/pages/${hw.id}`, { method: 'PUT', headers: h, body })
    : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log('PAGE hardware', res.status, hw ? '(mise à jour)' : '(créée)', res.ok ? '' : await res.text());
}
main().catch(e => { console.error(e); process.exit(1); });

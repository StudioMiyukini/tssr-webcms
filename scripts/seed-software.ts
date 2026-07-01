/* Cours « Software » (d'après les TP Software V2026 + correction V2023) : une page par grande notion.
   Crée/complète les pages + reconstruit la colonne Software du hub Cours (hub à 4 colonnes, source de vérité ici).
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-software.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const accordion = (it: Array<[string, string]>) => block('accordion', { items: it.map(([title, text]) => ({ title, text, href: '' })) });
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const ul = (items: string[]) => `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
const ol = (items: string[]) => `<ol>${items.map(i => `<li>${i}</li>`).join('')}</ol>`;

// ===== Schémas SVG (inline, CSP-safe) =====
const C = { hw: '#475569', os: '#2563eb', drv: '#0891b2', app: '#059669', user: '#7c3aed', warn: '#d97706', ok: '#16a34a', grey: '#64748b' };
function boxR(x: number, y: number, w: number, h: number, fill: string, label: string, sub = ''): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}"/>`
    + `<text x="${x + w / 2}" y="${y + (sub ? h / 2 - 1 : h / 2 + 4)}" text-anchor="middle" font-size="13" fill="#fff" font-weight="bold">${label}</text>`
    + (sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 14}" text-anchor="middle" font-size="10" fill="#e5e7eb">${sub}</text>` : '');
}
const arrow = (x1: number, y1: number, x2: number, y2: number, col = '#94a3b8') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="2.5" marker-end="url(#ar)"/>`;
const defs = '<defs><marker id="ar" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8"/></marker></defs>';
const wrap = (w: number, h: number, inner: string) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="max-width:${w}px;width:100%;height:auto;margin:6px 0 12px;font-family:system-ui,sans-serif">${defs}${inner}</svg>`;

// OS : pile Utilisateur → Applications → Système d'exploitation → Pilotes → Matériel
const svgOsStack = wrap(360, 250,
  boxR(70, 8, 220, 34, C.user, 'Utilisateur')
  + arrow(180, 42, 180, 54)
  + boxR(40, 56, 280, 34, C.app, 'Applications', 'navigateur, bureautique…')
  + boxR(40, 98, 280, 40, C.os, 'Système d’exploitation', 'noyau : CPU · mémoire · fichiers')
  + boxR(40, 146, 280, 34, C.drv, 'Pilotes', 'traduisent OS ↔ matériel')
  + boxR(40, 188, 280, 40, C.hw, 'Matériel', 'CPU · RAM · disque · périphériques')
  + `<text x="180" y="244" text-anchor="middle" font-size="11" fill="#64748b">L’OS est l’intermédiaire entre l’utilisateur et le matériel</text>`);

// Boot : séquence horizontale
function svgBoot(): string {
  const steps = [['Sous tension', C.grey], ['POST', C.grey], ['UEFI/BIOS', C.os], ['Secure Boot', C.os], ['Bootloader', C.warn], ['Noyau + pilotes', C.drv], ['OS + login', C.ok]];
  const bw = 92, bh = 44, gap = 26, x0 = 8, y = 30;
  let s = '';
  steps.forEach((st, i) => {
    const x = x0 + i * (bw + gap);
    s += boxR(x, y, bw, bh, st[1] as string, `${i + 1}`, st[0] as string);
    if (i < steps.length - 1) s += arrow(x + bw, y + bh / 2, x + bw + gap, y + bh / 2);
  });
  const W = x0 + steps.length * (bw + gap) - gap + 8;
  return wrap(W, y + bh + 22, s + `<text x="${W / 2}" y="${y + bh + 16}" text-anchor="middle" font-size="11" fill="#64748b">Du bouton power à l’écran de connexion</text>`);
}

// Registre : arbre des ruches HKEY
function svgRegistry(): string {
  const root = boxR(120, 8, 130, 34, C.os, 'Registre');
  const hives = ['HKLM', 'HKCU', 'HKCR', 'HKU', 'HKCC'];
  const bw = 64, bh = 30, gap = 8, y = 70, x0 = 8;
  let s = root + arrow(185, 42, 185, y - 4);
  hives.forEach((hk, i) => {
    const x = x0 + i * (bw + gap);
    s += `<line x1="185" y1="${y - 4}" x2="${x + bw / 2}" y2="${y}" stroke="#94a3b8" stroke-width="1.5"/>` + boxR(x, y, bw, bh, C.grey, hk);
  });
  return wrap(x0 + hives.length * (bw + gap) - gap + 8, y + bh + 8, s);
}

type Page = { slug: string; title: string; excerpt: string; blocks: PageBlock[] };

const PAGES: Page[] = [
  // 1 — SYSTÈME D'EXPLOITATION
  {
    slug: 'le-systeme-exploitation', title: 'Le système d’exploitation', excerpt: 'Le rôle de l’OS : interface entre l’utilisateur et le matériel, gestion des ressources, processus et fichiers.',
    blocks: [
      block('hero', { eyebrow: 'Cours · Software', title: 'Le système d’exploitation', subtitle: 'Le chef d’orchestre du PC : il fait le lien entre toi, tes logiciels et le matériel.' }),
      block('html', { html: '<p>Un <strong>système d’exploitation</strong> (OS, <em>Operating System</em>) est l’ensemble de programmes le plus proche du matériel. Il <strong>gère les ressources</strong> (processeur, mémoire, disque, périphériques) et sert d’<strong>interface entre l’utilisateur et la machine</strong>. Sans lui, tes logiciels ne sauraient pas utiliser le matériel.</p>' }),
      note('blue', '🔎 Analogie', '<p>Imagine un <strong>chef d’orchestre</strong> : les musiciens (le matériel) savent jouer, mais c’est lui qui distribue les partitions, donne le tempo et coordonne tout le monde pour qu’une symphonie (tes applications) en sorte. L’OS répartit le temps de calcul, la mémoire et l’accès aux périphériques entre tous les programmes qui le demandent.</p>'),
      block('heading', { level: 2, text: 'Où se situe l’OS ?' }),
      block('html', { html: svgOsStack }),
      block('heading', { level: 2, text: 'Ses grands rôles' }),
      accordion([
        ['🧠 Gérer les ressources', `<p>L’OS répartit les ressources limitées de la machine entre les programmes :</p>${ul(['<strong>Processeur</strong> : il décide quel programme s’exécute, et quand.', '<strong>Mémoire (RAM)</strong> : il attribue de l’espace à chaque programme et l’isole des autres.', '<strong>Disque & périphériques</strong> : il organise les accès au stockage, à l’imprimante, au réseau…'])}`],
        ['🖱️ L’interface Homme-Machine (IHM)', `<p>L’<strong>IHM</strong> permet le <strong>dialogue à double sens</strong> entre l’utilisateur et la machine : l’utilisateur agit (interface graphique ou ligne de commande), le système répond (affichage, <strong>messages système</strong>). Elle s’appuie sur les périphériques d’<strong>entrées-sorties</strong> :</p>${ul(['<strong>Entrée</strong> : clavier, souris, scanner, micro, webcam, manette, pad tactile.', '<strong>Sortie</strong> : écran, imprimante, haut-parleurs, casque, projecteur.', '<strong>Entrée <em>et</em> sortie</strong> : tout le stockage (clé USB, HDD/SSD, carte mémoire), l’écran tactile, le casque-micro, l’imprimante multifonction (avec scanner)…'])}`],
        ['⚙️ Processus vs service', `<p>Un <strong>processus</strong> est un programme <strong>en cours d’exécution</strong> (il a un identifiant, de la mémoire, et peut avoir des processus « enfants ») ; il a souvent une interface et s’appuie sur un ou plusieurs services. Un <strong>service</strong> est un programme qui tourne <strong>en arrière-plan</strong>, sans fenêtre, souvent démarré par l’OS lui-même (ex. : mises à jour, audio, impression). En clair : un service s’exécute <strong>sous la forme d’un ou plusieurs processus</strong>, mais « dans l’ombre ».</p>`],
        ['⏱️ L’ordonnanceur', `<p>L’<strong>ordonnanceur</strong> (<em>scheduler</em>) est la fonction de l’OS qui <strong>décide quel programme utilise le processeur, et dans quel ordre</strong>. Comme le CPU ne fait qu’une chose à la fois (par cœur), l’ordonnanceur distribue de minuscules tranches de temps à chacun et gère les <strong>priorités</strong>. Les <strong>interruptions (IRQ)</strong> d’un périphérique peuvent venir bousculer cet ordre pour traiter un événement urgent. 🧷 <em>Le chef de gare qui décide quel train passe, et quand.</em></p>`],
        ['📁 Gérer les fichiers', `<p>L’OS a ici <strong>deux rôles</strong> : <strong>(1)</strong> organiser le stockage permanent en <strong>arborescence</strong> (dossiers/sous-dossiers, indexation) ; <strong>(2)</strong> gérer le <strong>système de fichiers</strong> (le format : NTFS, FAT32, ext4…), qui définit comment les fichiers sont écrits et quels <strong>droits</strong> leur sont attribués. Détails : <a href="/pages/systemes-de-fichiers">Les systèmes de fichiers</a>.</p>`],
      ]),
      block('heading', { level: 2, text: 'Exemples' }),
      block('html', { html: ul(['🪟 <strong>Windows</strong> — le plus répandu sur les PC de bureau.', '🐧 <strong>Linux</strong> — serveurs, embarqué, postes techniques (libre).', '🍎 <strong>macOS</strong> — ordinateurs Apple.', '📱 <strong>Android / iOS</strong> — smartphones et tablettes.']) }),
      note('green', '💡 À retenir', '<p>L’OS = <strong>interface utilisateur ↔ matériel</strong> + <strong>gestionnaire de ressources</strong> (CPU, mémoire, fichiers, périphériques). Il orchestre processus et services. Vocabulaire (noyau, IHM, processus…) dans le <a href="/glossaire">Glossaire</a>.</p>'),
    ],
  },
  // 2 — DÉMARRAGE : BIOS / UEFI
  {
    slug: 'demarrage-bios-uefi', title: 'Le démarrage : BIOS & UEFI', excerpt: 'BIOS vs UEFI, MBR vs GPT, et la séquence de démarrage du POST à l’écran de connexion.',
    blocks: [
      block('hero', { eyebrow: 'Cours · Software', title: 'Le démarrage : BIOS & UEFI', subtitle: 'Ce qui se passe entre l’appui sur le bouton et l’écran de connexion.' }),
      block('html', { html: '<p>Quand tu allumes un PC, l’OS n’est pas encore chargé : c’est un <strong>micro-programme</strong> gravé sur la carte mère — le <strong>BIOS</strong> ou, aujourd’hui, l’<strong>UEFI</strong> — qui prend les commandes en premier. Il vérifie le matériel, puis va chercher et lance le système d’exploitation.</p>' }),
      note('blue', '🔎 Analogie', '<p>C’est la <strong>check-list du pilote avant le décollage</strong> : avant que l’avion (l’OS) ne roule, on vérifie les instruments, le carburant, les commandes… Le BIOS/UEFI fait ce contrôle matériel, puis « donne le feu vert » au décollage du système.</p>'),
      block('heading', { level: 2, text: 'La séquence de démarrage' }),
      block('html', { html: svgBoot() }),
      block('html', { html: `<p>Les <strong>9 grandes étapes</strong>, dans l’ordre :</p>${ol(['<strong>Mise sous tension</strong> de l’ordinateur (signal « Power Good »).', '<strong>POST</strong> (<em>Power-On Self-Test</em>) : test du matériel essentiel (RAM, clavier, disque…).', 'Chargement du <strong>BIOS / UEFI</strong> et de sa configuration.', '<strong>Recherche</strong> du périphérique sur lequel démarrer (selon l’ordre de démarrage).', 'Chargement du <strong>chargeur d’amorçage</strong> (Windows Boot Manager, GRUB…).', 'Chargement du <strong>noyau (kernel)</strong> du système d’exploitation.', 'Chargement des <strong>pilotes</strong> et des <strong>services système</strong>.', 'Affichage de l’<strong>écran d’ouverture de session</strong>.', 'Chargement du <strong>profil utilisateur</strong> et ouverture de la session.'])}` }),
      block('heading', { level: 2, text: 'Les notions clés' }),
      accordion([
        ['🆚 BIOS vs UEFI', `<p>Ce sont les <strong>microprogrammes de la carte mère</strong> : ils définissent comment le PC s’allume, sur quel lecteur il démarre, quels périphériques il reconnaît.</p><p><strong>BIOS</strong> (<em>Basic Input-Output System</em>, années 80, aujourd’hui dit « <em>Legacy</em> ») :</p>${ul(['Fonctionne en mode processeur <strong>16 bits</strong>.', '<strong>Pas</strong> d’interface graphique ni de souris.', 'Limité à des disques de <strong>moins de ~2,2 To</strong> (à cause du <strong>MBR</strong>) et 4 partitions principales.'])}<p><strong>UEFI</strong> (<em>Unified Extensible Firmware Interface</em>, généralisé à partir de ~2007/Windows 7) :</p>${ul(['<strong>Interface graphique</strong> et souris, plus détaillée.', 'Prise en charge des disques de <strong>plus de 2,2 To</strong> via le <strong>GPT</strong> (pas de blocage à 4 partitions).', 'Démarrage/arrêt <strong>plus rapides</strong> et <strong>Secure Boot</strong>.', 'Compatible avec un mode « <em>Legacy</em> » pour l’ancien matériel.'])}`],
        ['🗂️ MBR vs GPT', `<p>Ce sont deux façons de décrire le partitionnement d’un disque :</p>${ul(['<strong>MBR</strong> (ancien) : disques ≤ <strong>2 To</strong>, maximum <strong>4 partitions principales</strong>. Lié au BIOS.', '<strong>GPT</strong> (moderne) : disques <strong>> 2 To</strong>, <strong>nombreuses partitions</strong>, plus robuste (table dupliquée). Lié à l’UEFI.'])}`],
        ['🔒 Secure Boot', `<p>Le <strong>Secure Boot</strong> n’autorise au démarrage que des composants <strong>signés numériquement</strong> et reconnus. Objectif : empêcher un logiciel malveillant (rootkit) de se charger <strong>avant</strong> l’OS et de prendre le contrôle de la machine.</p>`],
        ['🐣 POST & bip codes', `<p>Le <strong>POST</strong> teste le matériel vital au démarrage. En cas de problème, la machine peut émettre une suite de <strong>bips</strong> ou afficher un code : c’est un premier outil de diagnostic matériel.</p>`],
      ]),
      note('green', '💡 À retenir', '<p>BIOS/UEFI = le <strong>firmware</strong> qui démarre la machine et lance l’OS. <strong>UEFI</strong> (moderne) va avec <strong>GPT</strong> et le <strong>Secure Boot</strong> ; <strong>BIOS</strong> (ancien) avec <strong>MBR</strong>. Sigles (UEFI, GPT, POST…) dans le <a href="/glossaire">Glossaire</a>.</p>'),
    ],
  },
  // 3 — SYSTÈMES DE FICHIERS
  {
    slug: 'systemes-de-fichiers', title: 'Les systèmes de fichiers', excerpt: 'NTFS, FAT32, exFAT, ext4 : avantages et limites, et les types de partitions.',
    blocks: [
      block('hero', { eyebrow: 'Cours · Software', title: 'Les systèmes de fichiers', subtitle: 'La façon dont les données sont rangées et retrouvées sur un disque.' }),
      block('html', { html: '<p>Un <strong>système de fichiers</strong> est la méthode d’<strong>organisation des données</strong> sur un support de stockage : comment les fichiers sont nommés, rangés, retrouvés, et quelles informations on garde sur eux (droits, dates…). Avant d’utiliser un disque, on le <strong>formate</strong> dans un système de fichiers donné.</p>' }),
      note('blue', '🔎 Analogie', '<p>C’est le <strong>plan de classement d’une bibliothèque</strong> : sans système de rangement (cotes, rayons, fichier des emprunts), impossible de retrouver un livre. Le système de fichiers, c’est ce plan — et chaque système (NTFS, FAT32…) a ses règles de classement.</p>'),
      block('heading', { level: 2, text: 'Les principaux systèmes' }),
      accordion([
        ['🪟 NTFS — le standard Windows (1993)', `<p>Système par défaut de Windows moderne, robuste et sécurisé.</p><p><strong>Avantages :</strong></p>${ul(['<strong>Droits fins</strong> (ACL) : qui peut lire/écrire/modifier chaque fichier.', '<strong>Chiffrement</strong> (BitLocker), <strong>compression</strong>, <strong>quotas</strong> de disque.', '<strong>Journalisation</strong> : suit les modifications → résiste mieux aux coupures de courant.', '<strong>Gros fichiers</strong> et grands disques, noms jusqu’à 255 caractères, rapide.'])}<p><strong>Limites :</strong> unité d’allocation plus grande que FAT32, et peu compatible hors Windows (lecture seule sous macOS sans pilote, mal géré par Android…).</p>`],
        ['💾 FAT32 — l’universel (1996)', `<p>Ancien et simple, lu par <strong>quasiment tout</strong> (Windows, macOS, Linux, consoles, appareils photo).</p><p><strong>Avantages :</strong> compatibilité maximale, idéal pour une petite clé USB d’échange. Désormais libre de droit.</p><p><strong>Limites :</strong> fichier de <strong>4 Go maximum</strong> ; partition limitée à <strong>32 Go</strong> avec l’outil de formatage de Windows (jusqu’à 2 To avec un outil tiers) ; <strong>pas de droits</strong> ni de journalisation.</p>`],
        ['🔌 exFAT — pour les gros fichiers nomades', `<p>Pensé pour les <strong>clés USB et cartes SD</strong> : compatible Windows/macOS, <strong>sans la limite des 4 Go</strong> de FAT32. Idéal pour transporter des fichiers volumineux (vidéos), mais sans droits ni journalisation.</p>`],
        ['🐧 ext2 / ext3 / ext4 — la lignée Linux', `<p>La famille <strong>ext</strong> équipe Linux depuis longtemps :</p>${ul(['<strong>ext2</strong> : créé par le Français <strong>Rémy Card</strong> ; se fragmente très peu (pas besoin de défragmenter) mais <strong>non journalisé</strong> → risque de perte en cas de crash.', '<strong>ext3</strong> : ext2 + <strong>journalisation</strong> → bien plus sûr en cas de coupure.', '<strong>ext4 (2006)</strong> : amélioration d’ext3 — meilleure gestion des <strong>gros disques</strong>, moins de fragmentation, taille de partition gigantesque (jusqu’à ~1 Exaoctet).'])}<p>Très lisible sous Linux, mais peu lisible nativement depuis Windows.</p>`],
        ['🧩 Les partitions', `<p>Un disque peut être découpé en <strong>partitions</strong> (des volumes logiques) :</p>${ul(['<strong>Principale</strong> : peut contenir un OS amorçable (souvent C:).', '<strong>Étendue</strong> : un conteneur (schéma MBR) qui héberge des <strong>partitions logiques</strong>, pour dépasser la limite de 4 principales.', '<strong>Active</strong> : la partition principale marquée comme amorçable, sur laquelle le bootloader va chercher l’OS.'])}`],
      ]),
      block('heading', { level: 2, text: 'Comparatif' }),
      block('html', { html: '<table class="wp-list"><thead><tr><th>Système</th><th>Usage type</th><th>Taille fichier max</th><th>Droits / journal</th><th>Compatibilité</th></tr></thead><tbody>'
        + '<tr><td><strong>NTFS</strong></td><td>Disque Windows</td><td>Très grande</td><td>✔ Oui</td><td>Windows (autres : limitée)</td></tr>'
        + '<tr><td><strong>FAT32</strong></td><td>Petite clé USB</td><td>4 Go</td><td>✘ Non</td><td>Universelle</td></tr>'
        + '<tr><td><strong>exFAT</strong></td><td>USB / SD gros fichiers</td><td>Très grande</td><td>✘ Non</td><td>Windows / macOS</td></tr>'
        + '<tr><td><strong>ext4</strong></td><td>Disque Linux</td><td>Très grande</td><td>✔ Oui</td><td>Linux</td></tr>'
        + '</tbody></table>' }),
      note('green', '💡 À retenir', '<p><strong>NTFS</strong> pour Windows (droits + sécurité), <strong>FAT32/exFAT</strong> pour l’échange universel (clés USB), <strong>ext4</strong> pour Linux. Le choix dépend de la <strong>compatibilité</strong> et des <strong>fonctionnalités</strong> voulues. Termes (formatage, ACL, journalisation…) dans le <a href="/glossaire">Glossaire</a>.</p>'),
    ],
  },
  // 3bis — CONFIGURATION DU SYSTÈME (MSCONFIG)
  {
    slug: 'msconfig-configuration-systeme', title: 'La configuration du système (MSConfig)', excerpt: 'L’outil MSConfig : modes de démarrage (normal, diagnostic, sélectif), démarrage sécurisé, onglets Services/Démarrage/Outils.',
    blocks: [
      block('hero', { eyebrow: 'Cours · Software', title: 'La configuration du système (MSConfig)', subtitle: 'L’outil qui contrôle comment Windows démarre — précieux pour diagnostiquer une panne.' }),
      block('html', { html: '<p><strong>MSConfig</strong> (« Configuration du système ») est un utilitaire intégré qui permet de <strong>contrôler le démarrage</strong> de Windows : quels pilotes, services et programmes se lancent. On l’ouvre en tapant <code>msconfig</code> (touche <kbd>Win</kbd>+<kbd>R</kbd>). C’est l’outil de référence pour <strong>diagnostiquer</strong> un PC lent ou instable au démarrage.</p>' }),
      note('blue', '🔎 Analogie', '<p>C’est le <strong>mode « diagnostic » du garagiste</strong> : on démarre la voiture avec le strict minimum branché pour <strong>isoler la pièce fautive</strong>. Ici, on démarre Windows en ne chargeant que l’essentiel pour trouver ce qui pose problème.</p>'),
      block('heading', { level: 2, text: 'Les modes de démarrage (onglet « Général »)' }),
      accordion([
        ['▶️ Démarrage normal', '<p>Le démarrage <strong>classique</strong> : charge <strong>tous</strong> les pilotes, services Windows et applications qui se lancent au démarrage. C’est l’état dans lequel on revient une fois le diagnostic terminé.</p>'],
        ['🩺 Démarrage en mode diagnostic', '<p>Charge <strong>seulement les pilotes et services de base</strong>, mais un peu plus que le mode sans échec (réseau, périphériques externes…). Utile pour savoir si le problème vient de Windows lui-même ou d’un ajout.</p>'],
        ['🎚️ Démarrage sélectif', '<p>Démarrage <strong>personnalisé</strong> : on choisit ce qu’on charge (services système, éléments de démarrage, configuration d’origine). Idéal pour <strong>réactiver les éléments un par un</strong> et trouver le coupable.</p>'],
      ]),
      block('heading', { level: 2, text: 'Le démarrage sécurisé (onglet « Démarrer »)' }),
      block('html', { html: '<p>Les <strong>modes sans échec</strong> modernes, à cocher dans l’onglet <em>Démarrer</em> :</p>' + ul([
        '<strong>Minimal</strong> : interface graphique en mode sécurisé, <strong>uniquement les services et pilotes critiques</strong>, réseau désactivé (l’ancien « sans échec »).',
        '<strong>Autre environnement</strong> : ouvre l’<strong>invite de commandes</strong> en mode sécurisé, sans interface graphique ni réseau (l’ancien « sans échec en ligne de commande »).',
        '<strong>Réseau</strong> : comme le minimal, mais avec le <strong>réseau activé</strong>.',
      ]) }),
      block('html', { html: '<p>Les <strong>options</strong> associées :</p>' + ul([
        '<strong>Ne pas démarrer la GUI</strong> : masque le logo Windows au démarrage.',
        '<strong>Journaliser le démarrage</strong> : écrit le détail du démarrage dans <code>%SystemRoot%\\Ntbtlog.txt</code>.',
        '<strong>Vidéo de base</strong> : charge les pilotes <strong>VGA standard</strong> au lieu des pilotes du matériel vidéo (utile si l’écran est noir à cause du pilote graphique).',
        '<strong>Infos de démarrage du SE</strong> : affiche le nom des pilotes au fur et à mesure de leur chargement.',
        '<strong>Délai</strong> : durée d’affichage de l’écran de choix de l’OS (s’ajoute au temps de démarrage).',
      ]) }),
      block('heading', { level: 2, text: 'Les autres onglets' }),
      accordion([
        ['🧩 Services', '<p>Liste tous les <strong>services</strong> ; on peut les <strong>activer/désactiver au démarrage</strong>. Astuce : cocher « Masquer tous les services Microsoft » pour ne voir que les services tiers (souvent la cause d’un souci).</p>'],
        ['🚀 Démarrage', '<p>Les <strong>applications qui se lancent avec Windows</strong>. On peut décocher celles qui ralentissent le démarrage. Sous <strong>Windows 10/11</strong>, cet onglet renvoie vers le <strong>Gestionnaire des tâches</strong> (onglet « Démarrage »).</p>'],
        ['🧰 Outils', '<p>Un <strong>lanceur</strong> vers les outils Windows (base de registre, invite de commandes, gestionnaire des tâches, observateur d’événements…). Bonus : il <strong>affiche la commande</strong> exacte pour lancer chaque outil manuellement.</p>'],
      ]),
      note('yellow', '⚠️ Bon réflexe', '<p>MSConfig sert au <strong>diagnostic</strong>, pas à la configuration permanente. Après avoir trouvé/réglé le problème, <strong>repasse en « Démarrage normal »</strong> pour ne pas laisser des services/pilotes désactivés.</p>'),
      note('green', '💡 À retenir', '<p><code>msconfig</code> = contrôler le <strong>démarrage</strong> de Windows. 3 modes (<strong>Normal / Diagnostic / Sélectif</strong>), un <strong>démarrage sécurisé</strong> (Minimal / Autre environnement / Réseau) et des onglets <strong>Services</strong>, <strong>Démarrage</strong>, <strong>Outils</strong>. C’est l’outil d’<strong>isolation de panne</strong> au démarrage. Voir aussi <a href="/pages/gestion-ordinateur-windows">La gestion de l’ordinateur</a>.</p>'),
    ],
  },
  // 4 — GESTION DE L'ORDINATEUR (WINDOWS)
  {
    slug: 'gestion-ordinateur-windows', title: 'La gestion de l’ordinateur', excerpt: 'Utilisateurs (SAM), groupes, pilotes, observateur d’événements, partitions et services — et la console MMC.',
    blocks: [
      block('hero', { eyebrow: 'Cours · Software', title: 'La gestion de l’ordinateur', subtitle: 'Administrer un poste Windows : comptes, groupes, pilotes et services.' }),
      block('html', { html: '<p>Windows regroupe ses outils d’administration dans la console <strong>Gestion de l’ordinateur</strong> (<code>compmgmt.msc</code>). On y gère les <strong>utilisateurs</strong> et <strong>groupes</strong>, les <strong>pilotes</strong>, les <strong>disques</strong> et les <strong>services</strong>. C’est le tableau de bord de l’administrateur du poste.</p>' }),
      note('blue', '🔎 Analogie', '<p>C’est la <strong>régie d’un immeuble</strong> : on y distribue les <strong>badges</strong> (comptes), on définit qui a accès à quel étage (<strong>groupes/droits</strong>), on entretient les <strong>équipements</strong> (pilotes) et on supervise les <strong>installations qui tournent en continu</strong> — chauffage, ascenseur (services).</p>'),
      block('heading', { level: 2, text: 'Les notions' }),
      accordion([
        ['👤 Les utilisateurs (et la base SAM)', `<p>Un <strong>utilisateur</strong> est un compte qui interagit avec le système. Les comptes locaux sont stockés dans la base <strong>SAM</strong> (<em>Security Account Manager</em>) ; le mot de passe y est <strong>chiffré</strong>. Pour se connecter, le compte doit exister dans la SAM et le mot de passe être connu. Les principaux types :</p>${ul(['<strong>Administrateur</strong> : tous les droits — créer/modifier/supprimer des comptes, installer des logiciels, accéder à tout. (au moins un compte admin existe).', '<strong>Standard (utilisateur)</strong> : droits limités — usage quotidien, ne peut pas gérer les autres comptes ni tout modifier.', '<strong>Invité</strong> : quasiment aucun droit (ni dossier « Mes documents », ni modification de comptes).'])}<p>En ligne de commande : <code>net user tech2 Azerty77 /add</code> crée un utilisateur ; <code>net localgroup Administrateurs Admin2 /add</code> l’ajoute aux administrateurs.</p>`],
        ['👥 Les groupes (et leurs types)', `<p>Un <strong>groupe</strong> rassemble des utilisateurs auxquels on attribue des <strong>droits/interdictions</strong> en bloc → plus simple que de gérer chaque personne. Les groupes locaux courants :</p>${ul(['<strong>Administrateurs</strong> : contrôle total de l’ordinateur.', '<strong>Opérateurs de sauvegarde</strong> : sauvegarder/restaurer le système (sans changer la sécurité).', '<strong>Opérateurs de configuration réseau</strong> : modifier les paramètres TCP/IP.', '<strong>Utilisateurs avec pouvoir</strong> : créer des comptes/partages, installer certains programmes (groupe hérité).', '<strong>Duplicateurs</strong> : réplication de fichiers entre serveurs d’un domaine.', '<strong>Utilisateurs du Bureau à distance</strong> : se connecter à la machine à distance.', '<strong>Utilisateurs</strong> : droits minimaux sur la machine.'])}`],
        ['🔧 Les pilotes', `<p>Un <strong>pilote</strong> (<em>driver</em>) est le programme qui <strong>exploite/contrôle un périphérique</strong> et lui permet de communiquer avec Windows (carte graphique, imprimante, WiFi…). Le <strong>Gestionnaire de périphériques</strong> (<code>devmgmt.msc</code>) sert à l’<strong>installer, mettre à jour ou désinstaller</strong>. Un bon pilote rend le périphérique plus performant ; un mauvais/absent = matériel mal reconnu.</p>`],
        ['📑 L’observateur d’événements', `<p>L’<strong>Observateur d’événements</strong> (<code>eventvwr.msc</code>) est le <strong>journal de bord</strong> de la machine : il enregistre tout ce qui se passe. Types d’événements : <strong>Critique, Erreur, Avertissement, Information, Succès/Échec d’audit</strong>.</p><p>Ses dossiers :</p>${ul(['<strong>Affichage personnalisé</strong> : vues filtrées sur les événements qui t’intéressent.', '<strong>Journaux Windows</strong> : historique système, sécurité, installations, erreurs.', '<strong>Journaux des applications et services</strong> : événements classés par composant.', '<strong>Abonnements</strong> : récupérer les événements d’autres PC du réseau.'])}<p>🔧 <strong>En cas d’erreur</strong>, on note 3 choses pour diagnostiquer : l’<strong>ID</strong> de l’événement (recherche web), sa <strong>source</strong>, et son <strong>descriptif</strong>.</p>`],
        ['🧩 Les partitions & MBR/GPT', `<p>Un disque se découpe en <strong>partitions</strong> :</p>${ul(['<strong>Principale</strong> : jusqu’à <strong>4</strong> en MBR ; seule à pouvoir accueillir un OS Windows amorçable.', '<strong>Étendue</strong> : une principale transformée en conteneur de <strong>partitions logiques</strong>, pour dépasser la limite de 4.', '<strong>Active</strong> : la partition de <strong>démarrage</strong> (celle sur laquelle l’OS se lance).'])}<p><strong>MBR</strong> (ancien) : ≤ 2 To, 4 partitions principales, lié au BIOS. <strong>GPT</strong> (moderne, UEFI) : > 2 To, jusqu’à 128 partitions sous Windows, plus flexible. Gestion via <code>diskmgmt.msc</code>. Voir aussi <a href="/pages/demarrage-bios-uefi">BIOS &amp; UEFI</a>.</p>`],
        ['⚙️ Les services (démarrage & états)', `<p>Un <strong>service</strong> tourne en arrière-plan (<code>services.msc</code>), sans interface. <strong>Types de démarrage</strong> :</p>${ul(['<strong>Automatique</strong> : lancé au démarrage de Windows.', '<strong>Automatique (début différé)</strong> : lancé peu après, pour alléger le démarrage.', '<strong>Manuel</strong> : démarré au besoin (par un programme/un autre service).', '<strong>Manuel (déclenché)</strong> : démarré sur un événement (ex. branchement USB).', '<strong>Automatique (déclenché)</strong> : au démarrage, ou relancé sur événement s’il est arrêté.', '<strong>Désactivé</strong> : ne peut pas démarrer.'])}<p><strong>États</strong> : en cours, arrêté, suspendu. <strong>Changer l’état</strong> : clic droit / Propriétés du service, ou en CLI <code>net start</code> / <code>net stop &lt;service&gt;</code>. Détails : <a href="/pages/serveur-gerer-service">Arrêter &amp; redémarrer un service</a>.</p>`],
        ['🧰 Les consoles utiles & la MMC personnalisée', `<p>Quelques consoles à connaître :</p>${ul(['<code>compmgmt.msc</code> — Gestion de l’ordinateur (tout-en-un).', '<code>lusrmgr.msc</code> — Utilisateurs et groupes locaux.', '<code>services.msc</code> — Services.', '<code>devmgmt.msc</code> — Gestionnaire de périphériques (pilotes).', '<code>diskmgmt.msc</code> — Gestion des disques et partitions.', '<code>eventvwr.msc</code> — Observateur d’événements.', '<code>regedit</code> — Base de registre.'])}<p>💡 Toutes ces consoles sont des <strong>composants MMC</strong> (<em>Microsoft Management Console</em>). On peut lancer <code>mmc</code> et, via <em>Fichier → Ajouter/Supprimer un composant logiciel enfichable</em>, se créer une <strong>console personnalisée</strong> regroupant ses outils préférés (utilisateurs, services, périphériques…) puis l’enregistrer en <code>.msc</code>.</p>`],
      ]),
      note('green', '💡 À retenir', '<p>On administre un poste via <strong>compmgmt.msc</strong> : <strong>comptes</strong> (admin/standard/invité, base <strong>SAM</strong>), <strong>groupes</strong> (droits collectifs), <strong>pilotes</strong>, <strong>observateur d’événements</strong> (journal), <strong>partitions</strong> et <strong>services</strong>. Les outils sont des composants <strong>MMC</strong> qu’on peut regrouper dans une console <code>.msc</code> sur mesure. Voir le <a href="/glossaire">Glossaire</a>.</p>'),
    ],
  },
  // 5 — BASE DE REGISTRE
  {
    slug: 'base-de-registre', title: 'La base de registre', excerpt: 'Le registre Windows : rôle, ruches (HKEY), clés et valeurs, exemples et précautions.',
    blocks: [
      block('hero', { eyebrow: 'Cours · Software', title: 'La base de registre', subtitle: 'La base de données centrale où Windows range tous ses réglages.' }),
      block('html', { html: '<p>La <strong>base de registre</strong> est une <strong>base de données hiérarchique</strong> qui stocke la quasi-totalité des <strong>réglages</strong> de Windows et des logiciels : configuration matérielle, comptes, préférences, associations de fichiers… On l’ouvre avec la commande <code>regedit</code>.</p>' }),
      note('blue', '🔎 Analogie', '<p>C’est le <strong>grand carnet de réglages</strong> de la maison : tous les interrupteurs, thermostats et préférences y sont notés au même endroit. Modifier une ligne change le comportement de la maison — d’où l’intérêt… et le danger.</p>'),
      block('heading', { level: 2, text: 'Comment c’est organisé' }),
      block('html', { html: svgRegistry() }),
      block('html', { html: '<p>Le registre est arborescent. Les « dossiers » s’appellent des <strong>clés</strong> (et sous-clés) ; chaque clé contient des <strong>valeurs</strong> (le réglage proprement dit). À la racine, on trouve les <strong>ruches</strong> (<em>hives</em>), les grandes branches <code>HKEY_*</code>.</p>' }),
      block('heading', { level: 2, text: 'Les ruches principales' }),
      accordion([
        ['HKEY_LOCAL_MACHINE (HKLM)', '<p>Réglages de <strong>toute la machine</strong> (matériel, pilotes, logiciels installés pour tous) — valables quel que soit l’utilisateur connecté.</p>'],
        ['HKEY_CURRENT_USER (HKCU)', '<p>Réglages de l’<strong>utilisateur actuellement connecté</strong> (préférences, bureau, applications).</p>'],
        ['HKEY_USERS (HKU)', '<p>Les profils de <strong>tous les utilisateurs</strong> de la machine (HKCU n’est qu’une vue de l’un d’eux).</p>'],
        ['HKEY_CLASSES_ROOT (HKCR)', '<p>Les <strong>associations de fichiers</strong> (quel programme ouvre quel type) et les objets COM.</p>'],
        ['HKEY_CURRENT_CONFIG (HKCC)', '<p>Le <strong>profil matériel</strong> utilisé au démarrage en cours.</p>'],
      ]),
      block('heading', { level: 2, text: 'Exemples concrets' }),
      block('html', { html: ul([
        '<strong>Message à l’ouverture de session</strong> : sous <code>HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon</code>, créer/renseigner <code>LegalNoticeCaption</code> (titre de la fenêtre) et <code>LegalNoticeText</code> (texte du message) affichés <strong>avant</strong> la connexion.',
        '<strong>NumLock activé au démarrage</strong> : sous <code>HKCU\\Control Panel\\Keyboard</code> (et <code>HKEY_USERS\\.DEFAULT\\Control Panel\\Keyboard</code> pour l’écran de connexion), mettre <code>InitialKeyboardIndicators</code> à <code>2</code> (<code>0</code> = éteint).',
      ]) }),
      note('yellow', '⚠️ Précautions', '<p>Une mauvaise modification peut <strong>empêcher Windows de démarrer</strong>. Avant toute action : <strong>exporter une sauvegarde</strong> (Fichier → Exporter), ne toucher que ce qu’on comprend, et noter les changements. En entreprise, on documente ces actions dans une <strong>procédure</strong>.</p>'),
      note('green', '💡 À retenir', '<p>Registre = base de données des <strong>réglages</strong> de Windows, ouverte par <code>regedit</code>. Structure : <strong>ruches</strong> (HKEY_*) → <strong>clés</strong>/sous-clés → <strong>valeurs</strong>. À manipuler avec prudence (sauvegarde !). Voir le <a href="/glossaire">Glossaire</a>.</p>'),
    ],
  },
  // 6 — WINDOWS SERVER
  {
    slug: 'windows-server', title: 'Windows Server : rôles & fonctionnalités', excerpt: 'Rôles vs fonctionnalités, DNS, DHCP, Active Directory, serveur de fichiers, IIS, BitLocker.',
    blocks: [
      block('hero', { eyebrow: 'Cours · Software', title: 'Windows Server', subtitle: 'Le système d’exploitation des serveurs : rôles, fonctionnalités et services réseau.' }),
      block('html', { html: '<p><strong>Windows Server</strong> est la version de Windows destinée aux <strong>serveurs</strong>. On l’administre via le <strong>Gestionnaire de serveur</strong>, qui permet d’ajouter des <strong>rôles</strong> et des <strong>fonctionnalités</strong> grâce à l’assistant « <em>Ajouter des rôles et fonctionnalités</em> ».</p>' }),
      note('blue', '🔎 Analogie', '<p>Un serveur, c’est comme un <strong>employé polyvalent</strong> : son <strong>rôle</strong> est son métier principal (réceptionniste, comptable…), et les <strong>fonctionnalités</strong> sont ses outils d’appoint (une calculatrice, un téléphone). On lui ajoute des métiers et des outils selon les besoins.</p>'),
      block('heading', { level: 2, text: 'Rôle ou fonctionnalité ?' }),
      block('html', { html: '<p>Un <strong>rôle</strong> définit la <strong>fonction principale</strong> qu’assure le serveur pour les autres machines (ex. : serveur web, DNS, DHCP, annuaire). Une <strong>fonctionnalité</strong> est un <strong>composant d’appoint</strong> qui aide le serveur ou un rôle (ex. : Client Telnet, BitLocker, Sauvegarde). En résumé : <strong>rôle = service rendu</strong>, <strong>fonctionnalité = outil complémentaire</strong>.</p>' }),
      block('heading', { level: 2, text: 'Les rôles courants' }),
      accordion([
        ['🌐 Serveur DNS', '<p>Le <strong>DNS</strong> traduit les <strong>noms</strong> (ex. <code>monsite.local</code>) en <strong>adresses IP</strong> et inversement. C’est l’annuaire qui permet de joindre les machines par leur nom plutôt que par des chiffres.</p>'],
        ['🏷️ Serveur DHCP', '<p>Le <strong>DHCP</strong> <strong>attribue automatiquement</strong> les adresses IP (et passerelle, DNS…) aux appareils du réseau, évitant la configuration manuelle de chaque poste.</p>'],
        ['🗂️ Active Directory (AD DS)', '<p><strong>Active Directory</strong> est l’<strong>annuaire centralisé</strong> de l’entreprise : il gère les <strong>utilisateurs, ordinateurs et groupes</strong> d’un <strong>domaine</strong>. On s’authentifie une fois, et les <strong>stratégies de groupe (GPO)</strong> appliquent des règles à tout le parc depuis un point unique.</p>'],
        ['📁 Serveur de fichiers', '<p>Centralise le <strong>partage de fichiers</strong> : dossiers communs accessibles sur le réseau, avec des <strong>droits</strong> par utilisateur/groupe et une sauvegarde centralisée.</p>'],
        ['🕸️ Serveur Web (IIS)', '<p><strong>IIS</strong> (<em>Internet Information Services</em>) héberge des <strong>sites et applications web</strong>. On peut démarrer/arrêter/redémarrer le service (console IIS, ou <code>iisreset</code> / <code>net stop W3SVC</code>).</p>'],
      ]),
      block('heading', { level: 2, text: 'Quelques fonctionnalités' }),
      block('html', { html: ul([
        '<strong>BitLocker</strong> — chiffre un volume entier pour protéger les données en cas de vol du disque.',
        '<strong>Client Telnet</strong> — outil en ligne de commande pour tester une connexion sur un port (ex. <code>telnet monserveur 80</code>).',
        '<strong>Sauvegarde Windows Server</strong> — planifie et réalise les sauvegardes du serveur.',
      ]) }),
      accordion([
        ['❓ Installation « basée sur un rôle » vs « Services Bureau à distance »', '<p>L’installation <strong>basée sur un rôle/fonctionnalité</strong> est le cas général (on ajoute DNS, IIS, etc. à un serveur). L’installation <strong>Services Bureau à distance (RDS)</strong> est un assistant <strong>spécialisé</strong> qui répartit les composants RDS sur un ou plusieurs serveurs pour fournir des <strong>bureaux/applications à distance</strong> aux utilisateurs.</p>'],
      ]),
      note('green', '💡 À retenir', '<p>Windows Server s’administre par le <strong>Gestionnaire de serveur</strong> : on ajoute des <strong>rôles</strong> (DNS, DHCP, AD DS, fichiers, IIS) = services rendus, et des <strong>fonctionnalités</strong> (BitLocker, Telnet, Sauvegarde) = outils d’appoint. Sigles (DNS, DHCP, AD, GPO, IIS…) dans le <a href="/glossaire">Glossaire</a>.</p>'),
    ],
  },
];

// ===== HUB « Cours » — défini dans ./_hub.ts (source de vérité unique) =====
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

  for (const p of PAGES) {
    const cur = existing.find(e => e.slug === p.slug);
    const bodyJson = JSON.stringify({ title: p.title, slug: p.slug, excerpt: p.excerpt, content: renderPageBlocksToHtml(p.blocks), builder_json: serializePageBlocks(p.blocks), published: 1 });
    const res = cur
      ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body: bodyJson })
      : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body: bodyJson });
    console.log(`PAGE ${p.slug}`.padEnd(40), res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());
  }

  const cours = existing.find(e => e.slug === 'cours');
  if (cours) {
    const res = await fetch(`${BASE}/api/admin/pages/${cours.id}`, { method: 'PUT', headers: h, body: JSON.stringify({ title: 'Cours', slug: 'cours', content: renderPageBlocksToHtml(hubBlocks), builder_json: serializePageBlocks(hubBlocks), published: 1 }) });
    console.log('HUB Cours', res.status, res.ok ? '(Software rempli)' : await res.text());
  }
  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

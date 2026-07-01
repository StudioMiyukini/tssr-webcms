/* Crée la page de cours « La virtualisation : théorie & concepts » (contexte TSSR).
   Abstraction, types de virtualisation, hyperviseurs Type 1/2, VM vs conteneur, outils, place en TSSR.
   Vulgarisé + schémas. Complète la page pratique « Virtualisation avec Hyper-V ».
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-virtualisation-theorie.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const accordion = (it: Array<[string, string]>) => block('accordion', { items: it.map(([title, text]) => ({ title, text, href: '' })) });
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });

const C = { net: '#2563eb', dev: '#059669', warn: '#d97706', danger: '#dc2626', grey: '#64748b', slate: '#475569', purple: '#7c3aed' };
function box(x: number, y: number, w: number, h: number, fill: string, label: string, sub = ''): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}"/>`
    + `<text x="${x + w / 2}" y="${y + (sub ? h / 2 - 2 : h / 2 + 4)}" text-anchor="middle" font-size="13" fill="#fff" font-weight="bold">${label}</text>`
    + (sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 14}" text-anchor="middle" font-size="10" fill="#e5e7eb">${sub}</text>` : '');
}
const wrap = (w: number, h: number, inner: string) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="max-width:${w}px;width:100%;height:auto;margin:8px 0 12px;font-family:system-ui,sans-serif">${inner}</svg>`;
const cap = (x: number, y: number, t: string, col = '#64748b', s = 11) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${s}" fill="${col}">${t}</text>`;
const lbl = (x: number, y: number, t: string, col = '#475569', s = 11) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${s}" fill="${col}" font-weight="bold">${t}</text>`;

// Schéma : l'abstraction (matériel → hyperviseur → VM)
const svgAbstraction = wrap(560, 232,
  [0, 1, 2].map(i => {
    const x = 26 + i * 178;
    return `<rect x="${x}" y="14" width="160" height="92" rx="10" fill="${C.dev}" fill-opacity="0.08" stroke="${C.dev}" stroke-width="1.5"/>`
      + lbl(x + 80, 30, 'VM ' + (i + 1), C.slate, 12)
      + box(x + 12, 38, 136, 26, C.purple, 'OS + applis')
      + box(x + 12, 70, 136, 28, C.dev, 'vCPU · vRAM · vDisque');
  }).join('')
  + box(20, 124, 520, 36, C.net, 'Couche de virtualisation (hyperviseur)', 'mutualise et isole les ressources')
  + box(20, 166, 520, 40, C.slate, 'Ressources physiques', 'CPU · RAM · Disque · Carte réseau')
  + cap(280, 224, 'Chaque VM reçoit une part « virtuelle » du matériel, sans savoir qu’elle est partagée.'));

// Schéma : ce que l'on peut virtualiser
const TYPES: Array<[string, string, string]> = [
  ['🖥️ Serveurs', 'une machine = plusieurs serveurs', C.net],
  ['💻 Poste de travail', 'VDI : bureaux virtuels', C.dev],
  ['📦 Applications', 'appli isolée, sans installation', C.purple],
  ['🌐 Réseau', 'SDN, commutateur virtuel', C.warn],
  ['💾 Stockage', 'pools de disques (vSAN, SAN)', C.slate],
  ['🐳 Conteneurs', 'plus léger qu’une VM', C.danger],
];
const svgTypes = wrap(620, 212,
  lbl(310, 22, 'Ce que l’on peut virtualiser', C.slate, 13)
  + TYPES.map((t, i) => { const col = i % 3, row = Math.floor(i / 3); return box(20 + col * 200, 40 + row * 84, 184, 62, t[2], t[0], t[1]); }).join(''));

// Schéma : les piles Type 1 (bare-metal) vs Type 2 (hébergé)
const vmRow = (x: number, w: number, y: number) => { const gap = 8, bw = (w - gap * 2) / 3; return [0, 1, 2].map(i => box(x + i * (bw + gap), y, bw, 28, C.dev, 'VM')).join(''); };
const svgTypeStacks = wrap(640, 236,
  lbl(165, 22, 'Type 1 — « bare-metal »', C.slate, 13)
  + lbl(475, 22, 'Type 2 — « hébergé »', C.slate, 13)
  // Type 1 : hyperviseur directement sur le matériel
  + vmRow(25, 280, 36)
  + box(25, 72, 280, 32, C.net, 'Hyperviseur (Type 1)', 'ESXi · Hyper-V · Proxmox · KVM')
  + box(25, 112, 280, 34, C.slate, 'Matériel physique', 'CPU · RAM · Disque · NIC')
  + cap(165, 172, 'Posé directement sur le matériel', C.net)
  + cap(165, 190, '→ performant : pour les serveurs')
  // Type 2 : hyperviseur posé sur un OS hôte
  + vmRow(335, 280, 36)
  + box(335, 72, 280, 30, C.warn, 'Hyperviseur (Type 2)')
  + box(335, 110, 280, 30, C.purple, 'Système hôte (OS)', 'Windows · macOS · Linux')
  + box(335, 148, 280, 28, C.slate, 'Matériel physique')
  + cap(475, 200, 'Logiciel installé sur un OS existant', C.warn)
  + cap(475, 218, '→ pour s’entraîner, labos, HomeLab'));

// Schéma : le cycle de vie d'une VM
const LIFE: Array<[string, string, string, string]> = [
  ['1', 'Création', 'CPU · RAM · disque', C.net],
  ['2', 'Installation OS', 'ISO / clé USB', C.purple],
  ['3', 'Utilisation', 'admin au quotidien', C.dev],
  ['4', 'Sauvegarde', 'backup / snapshot', C.warn],
  ['5', 'Fin de vie', 'suppression / clonage', C.slate],
];
const svgLifecycle = wrap(680, 132,
  lbl(340, 20, 'Le cycle de vie d’une machine virtuelle', C.slate, 13)
  + LIFE.map((s, i) => {
    const x = 14 + i * 134;
    const arrow = i < LIFE.length - 1 ? `<polygon points="${x + 126},${64} ${x + 134},${68} ${x + 126},${72}" fill="#94a3b8"/><line x1="${x + 122}" y1="68" x2="${x + 126}" y2="68" stroke="#94a3b8" stroke-width="2"/>` : '';
    return box(x, 42, 122, 52, s[3], s[0] + '. ' + s[1], s[2]) + arrow;
  }).join(''));

// Tableau : les 3 modes de commutateur virtuel
const yn = (ok: boolean) => ok ? '<strong style="color:#059669">oui</strong>' : '<span style="color:#dc2626">non</span>';
const switchTable = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:14px;margin:8px 0"><thead><tr style="background:var(--surface-2)">'
  + ['Mode', 'VM ↔ VM', 'VM ↔ Hôte', 'VM ↔ LAN / Internet', 'Usage typique'].map(h => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${h}</th>`).join('')
  + '</tr></thead><tbody>'
  + [
    ['🌍 Externe', true, true, true, 'Production : les VM sont sur le réseau réel. Le commutateur « prend » une carte réseau physique (NIC).'],
    ['🏠 Interne', true, true, false, 'VM et machine hôte communiquent entre elles, mais coupées du réseau extérieur.'],
    ['🔒 Privé', true, false, false, 'Labo 100 % isolé : les VM ne parlent qu’entre elles (ni hôte, ni LAN).'],
  ].map(r => `<tr><td style="padding:8px 10px;border:1px solid var(--border);font-weight:bold">${r[0]}</td><td style="padding:8px 10px;border:1px solid var(--border)">${yn(r[1] as boolean)}</td><td style="padding:8px 10px;border:1px solid var(--border)">${yn(r[2] as boolean)}</td><td style="padding:8px 10px;border:1px solid var(--border)">${yn(r[3] as boolean)}</td><td style="padding:8px 10px;border:1px solid var(--border)">${r[4]}</td></tr>`).join('')
  + '</tbody></table></div>';

// ===================================================================================
const SLUG = 'virtualisation-theorie';
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Virtualisation', title: 'La virtualisation : théorie & concepts', subtitle: 'Comprendre les fondamentaux — une compétence centrale du métier de TSSR.' }),
  block('html', { html: '<p>La <strong>virtualisation</strong> consiste à créer des versions <strong>« virtuelles » (logicielles)</strong> de ressources matérielles : un serveur, un poste, un réseau, un disque… On ne dépend plus d’une machine physique « en dur » : on <strong>découpe</strong> et on <strong>partage</strong> le matériel. C’est devenu un pilier de l’informatique d’entreprise — et donc une compétence clé en <strong>TSSR</strong>.</p>' }),
  note('blue', '🔎 Analogie', '<p>Pense à un <strong>immeuble d’appartements</strong> : un seul bâtiment (le serveur physique) héberge plein de logements <strong>indépendants et isolés</strong> (les machines virtuelles). Le <strong>syndic</strong> qui répartit l’eau et l’électricité, c’est l’<strong>hyperviseur</strong>. Un seul immeuble, plein de locataires séparés.</p>'),

  block('heading', { level: 2, text: '🧱 Le principe : l’abstraction' }),
  block('html', { html: '<p>L’idée centrale est l’<strong>abstraction</strong> : une <strong>couche logicielle</strong> (l’hyperviseur) s’intercale entre le <strong>matériel réel</strong> et les systèmes. Elle <strong>découpe</strong> les ressources (processeur, mémoire, disque, réseau) et en distribue une part à chaque machine virtuelle, qui <strong>croit</strong> avoir son propre ordinateur.</p>' }),
  block('html', { html: svgAbstraction }),
  block('html', { html: '<p>Deux bénéfices fondamentaux en découlent : la <strong>mutualisation</strong> (un gros serveur fait tourner plusieurs systèmes) et l’<strong>isolation</strong> (chaque VM est étanche : un crash ou un virus reste confiné).</p>' }),

  block('heading', { level: 2, text: '🗂️ Les types de virtualisation' }),
  block('html', { html: '<p>On ne virtualise pas que des serveurs — la virtualisation touche toutes les ressources :</p>' }),
  block('html', { html: svgTypes }),
  accordion([
    ['🖥️ Virtualisation de serveurs', '<p>La plus courante : faire tourner <strong>plusieurs serveurs (VM)</strong> sur une même machine physique (ex. un contrôleur de domaine, un serveur web et un serveur de fichiers côte à côte).</p>'],
    ['💻 Virtualisation du poste de travail (VDI)', '<p><strong>VDI</strong> (<em>Virtual Desktop Infrastructure</em>) : les bureaux des utilisateurs tournent <strong>sur le serveur</strong>, et chacun s’y connecte depuis un poste léger. Centralisé, sécurisé, facile à déployer.</p>'],
    ['📦 Virtualisation applicative', '<p>Une <strong>application</strong> est encapsulée et tourne <strong>isolée</strong>, sans installation classique sur le poste (ex. App-V, applications « portables »).</p>'],
    ['🌐 Virtualisation du réseau', '<p>Le réseau devient <strong>logiciel</strong> : commutateurs virtuels (vSwitch), VLAN, et le <strong>SDN</strong> (<em>Software-Defined Networking</em>) qui pilote le réseau par configuration plutôt que par câblage.</p>'],
    ['💾 Virtualisation du stockage', '<p>On regroupe plusieurs disques/baies en <strong>pools</strong> présentés comme un seul espace (SAN, NAS, <strong>vSAN</strong>), indépendamment du matériel sous-jacent.</p>'],
    ['🐳 Les conteneurs', '<p>Forme <strong>plus légère</strong> que la VM : le conteneur (ex. <strong>Docker</strong>) embarque seulement l’application et <strong>partage le noyau</strong> de l’hôte. Démarrage en secondes, très utilisé en déploiement moderne.</p>'],
  ]),

  block('heading', { level: 2, text: '🎛️ L’hyperviseur : Type 1 vs Type 2' }),
  block('html', { html: '<p>L’<strong>hyperviseur</strong> est le logiciel qui crée et pilote les VM. C’est la <strong>couche intermédiaire entre le matériel et les VM</strong>. Il en existe <strong>deux familles</strong> :</p><ul><li><strong>Type 1 (bare-metal)</strong> : posé <strong>directement sur le matériel</strong>, il <em>est</em> le système. Le plus performant, pour les <strong>serveurs</strong>. Ex. <strong>VMware ESXi</strong>, <strong>Microsoft Hyper-V</strong>, <strong>Proxmox</strong>.</li><li><strong>Type 2 (hébergé)</strong> : un <strong>logiciel installé sur un OS existant</strong> (Windows, macOS). Idéal pour <strong>s’entraîner</strong>. Ex. <strong>VirtualBox</strong>, <strong>VMware Workstation</strong>, <strong>QEMU</strong>.</li></ul>' }),
  block('html', { html: svgTypeStacks }),
  note('yellow', '💡 Bon à savoir', '<p><strong>Hyper-V sous Windows 10/11</strong> se comporte comme un <strong>Type 2</strong> (posé sur le poste). Mais dès qu’on l’active, Windows passe « derrière » l’hyperviseur : un Type 2 peut en réalité se rapprocher d’un <strong>Type 1</strong> en <strong>fusionnant avec l’OS</strong>. En entreprise, Hyper-V tourne en <strong>Type 1</strong> sur Windows Server, directement au plus près du matériel.</p>'),
  note('green', '👉 En pratique', '<p>La mise en œuvre côté Windows Server est détaillée dans le cours <a href="/pages/virtualisation">La virtualisation avec Hyper-V</a> (installer le rôle, créer une VM, commutateur virtuel…).</p>'),

  block('heading', { level: 2, text: '⚖️ Avantages & inconvénients' }),
  block('html', { html: '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin:8px 0">'
    + '<div style="border:1px solid var(--border);border-radius:10px;padding:12px 14px;background:rgba(5,150,105,0.06)"><p style="margin:0 0 6px;font-weight:bold;color:#059669">✅ Avantages</p><ul style="margin:0;padding-left:18px"><li><strong>Rentable dans le temps</strong> : moins de matériel à acheter et entretenir.</li><li><strong>Gain de place</strong> : plusieurs serveurs dans une seule machine.</li><li><strong>Centralisation & optimisation</strong> des ressources.</li><li><strong>Déploiement rapide</strong> (modèles, clones).</li><li><strong>Isolation</strong> des environnements (chaque service dans sa bulle).</li></ul></div>'
    + '<div style="border:1px solid var(--border);border-radius:10px;padding:12px 14px;background:rgba(220,38,38,0.06)"><p style="margin:0 0 6px;font-weight:bold;color:#dc2626">⚠️ Inconvénients</p><ul style="margin:0;padding-left:18px"><li><strong>Panne physique</strong> = toutes les VM tombent → on répond par un <strong>cluster de serveurs</strong>.</li><li><strong>Coût à l’installation</strong> (matériel costaud, <strong>licences</strong>).</li><li><strong>Besoin de ressources important</strong> sur l’hôte.</li><li><strong>Performances impactées</strong> si l’on entasse trop de VM sur une seule machine.</li></ul></div>'
    + '</div>' }),

  block('heading', { level: 2, text: '🗃️ Ressources, stockage & scalabilité' }),
  block('html', { html: '<p>Comme pour une machine physique, on <strong>alloue des ressources virtuelles</strong> à chaque VM — et cela <strong>impacte directement ses performances</strong> :</p><ul><li><strong>vCPU</strong> — nombre de processeurs virtuels alloués.</li><li><strong>RAM</strong> — mémoire attribuée, <strong>statique</strong> (fixe) ou <strong>dynamique</strong> (ajustée au besoin, avec Hyper-V).</li><li><strong>vNIC</strong> — carte(s) réseau virtuelle(s) reliée(s) à un commutateur virtuel.</li><li><strong>Stockage</strong> — espace disque alloué (disque virtuel).</li></ul>' }),
  accordion([
    ['💽 Le disque virtuel : VHD / VHDX', '<p>Le disque d’une VM est un <strong>gros fichier</strong> sur le disque réel. Sous Hyper-V : <strong>VHD</strong> (ancien, max 2 To) ou <strong>VHDX</strong> (récent, jusqu’à 64 To, plus résistant aux coupures). Il peut être <strong>de taille fixe</strong> (réservée d’avance) ou <strong>dynamique</strong> (grandit au besoin).</p>'],
    ['📍 Emplacement : local ou partagé', '<p>Les disques des VM peuvent être stockés <strong>en local</strong> (sur le serveur lui-même) ou sur un <strong>stockage partagé</strong> (SAN/NAS). Le stockage partagé est ce qui permet la <strong>migration à chaud</strong> et les <strong>clusters</strong> : plusieurs serveurs accèdent aux mêmes VM.</p>'],
    ['📈 Scalabilité (évolutivité)', '<p><strong>Verticale</strong> : on <strong>augmente la puissance</strong> d’une machine (plus de vCPU/vRAM). <strong>Horizontale</strong> : on <strong>ajoute des machines</strong> (plus de serveurs/VM qui se répartissent la charge). La virtualisation rend les deux <strong>faciles et rapides</strong>.</p>'],
  ]),

  block('heading', { level: 2, text: '🔄 Le cycle de vie d’une VM' }),
  block('html', { html: '<p>Une VM se <strong>gère comme un système complet</strong>, de sa création à sa suppression :</p>' }),
  block('html', { html: svgLifecycle }),

  block('heading', { level: 2, text: '🔀 Le commutateur virtuel (Virtual Switch)' }),
  block('html', { html: '<p>Pour qu’une VM ait du réseau, on lui branche une <strong>carte réseau virtuelle</strong> sur un <strong>commutateur virtuel</strong> (le « switch logiciel » de l’hyperviseur). Sous Hyper-V, il existe <strong>3 modes</strong> :</p>' }),
  block('html', { html: switchTable }),
  note('blue', '🔌 NIC physique', '<p>Un commutateur <strong>externe</strong> s’adosse à une <strong>carte réseau physique (NIC)</strong> de l’hôte. On peut donc créer <strong>autant de commutateurs externes que de cartes réseau physiques</strong>. C’est lui qui ouvre les VM vers la <strong>LAN/Internet</strong> ; pense à configurer l’<strong>adressage IP</strong> en conséquence.</p>'),

  block('heading', { level: 2, text: '⚙️ Quelques notions de théorie' }),
  accordion([
    ['🔁 Virtualisation complète vs paravirtualisation', '<p><strong>Complète</strong> : l’OS invité <strong>ne sait pas</strong> qu’il est virtualisé — l’hyperviseur lui présente un matériel « comme réel ». <strong>Paravirtualisation</strong> : l’OS invité est <strong>au courant</strong> et <strong>coopère</strong> (pilotes spéciaux), ce qui est <strong>plus performant</strong>.</p>'],
    ['🧩 Les ressources virtuelles', '<p>À chaque VM on attribue des <strong>vCPU</strong> (cœurs virtuels), de la <strong>vRAM</strong>, un <strong>disque virtuel</strong> (un gros fichier sur le disque réel) et une <strong>carte réseau virtuelle</strong> reliée à un <strong>commutateur virtuel</strong>.</p>'],
    ['📸 Snapshots (points de restauration)', '<p><strong>Snapshot</strong> = une « photo » de la VM à un <strong>instant T</strong> pour <strong>revenir en arrière</strong>. Idéal <strong>avant une opération à risque</strong> : une mise à jour, l’application d’un correctif suite à un <strong>bulletin de sécurité / CVE</strong>. À garder <strong>ponctuel</strong> : pas plus de <strong>2 ou 3 à la suite</strong>, et on ne laisse <strong>jamais un snapshot vivre plus de ~72 h</strong> (il grossit et consomme tout le disque). En exam comme en réel, on en prend un <strong>après l’installation de l’OS</strong>, avant de configurer.</p>'],
    ['🆚 Snapshot ≠ Backup', '<p>Un <strong>snapshot</strong> est <strong>lié à la VM</strong> et à son hôte : si le serveur meurt, le snapshot meurt avec. Un <strong>backup (sauvegarde)</strong> est une <strong>copie indépendante</strong>, stockée ailleurs, pour <strong>restaurer</strong> en cas de gros incident. <strong>Règle d’or :</strong> on fait un <strong>backup AVANT</strong> de jouer avec les snapshots. Les deux sont complémentaires, jamais interchangeables.</p>'],
    ['🧬 Clones & migration à chaud', '<p><strong>Clone</strong> : une copie complète d’une VM pour en <strong>déployer une nouvelle</strong> rapidement. <strong>Migration à chaud</strong> : déplacer une VM d’un serveur à un autre <strong>sans l’éteindre</strong> (nécessite un stockage partagé).</p>'],
    ['🆚 VM vs conteneur', '<p>Une <strong>VM</strong> embarque un <strong>OS complet</strong> (isolation forte, mais lourd). Un <strong>conteneur</strong> <strong>partage le noyau</strong> de l’hôte (léger, rapide). <strong>Analogie :</strong> la VM = une maison avec ses fondations ; le conteneur = un appartement qui partage les fondations de l’immeuble.</p>'],
  ]),

  block('heading', { level: 2, text: '🛡️ Isolation & sécurité' }),
  block('html', { html: '<p>Les VM sont <strong>isolées, mais pas totalement indépendantes</strong> : elles partagent toutes le même hôte et le même hyperviseur. Quelques points de vigilance :</p><ul><li>Chaque VM est <strong>séparée des autres</strong> : une compromission reste, en principe, <strong>limitée</strong> à sa bulle.</li><li>Mais l’<strong>hyperviseur lui-même</strong> est une cible : s’il tombe, <strong>toutes</strong> les VM tombent.</li><li>D’où l’importance des <strong>mises à jour et correctifs</strong>, du <strong>contrôle des accès</strong> et de la <strong>segmentation réseau</strong>.</li></ul>' }),
  note('yellow', '🔐 Règle d’or', '<p>La <strong>sécurisation de l’hyperviseur est indispensable</strong> : c’est le point unique dont dépendent toutes les machines virtuelles.</p>'),

  block('heading', { level: 2, text: '♻️ Haute disponibilité & tolérance de panne' }),
  block('html', { html: '<p>En entreprise, on veut <strong>assurer la continuité de service</strong> même si un serveur tombe. La virtualisation l’organise :</p><ul><li><strong>Haute disponibilité (HA)</strong> : si un hôte plante, ses VM <strong>redémarrent automatiquement sur un autre hôte</strong>.</li><li><strong>Migration à chaud (Live Migration)</strong> : déplacer une VM d’un serveur à un autre <strong>sans interruption</strong> de service.</li><li>Ces deux mécanismes exigent un <strong>stockage partagé</strong> (les hôtes accèdent aux mêmes disques de VM).</li></ul><p>Résultat : <strong>moins de temps d’arrêt</strong> et un impact des pannes fortement réduit.</p>' }),

  block('heading', { level: 2, text: '💽 iSCSI : le stockage partagé par le réseau' }),
  block('html', { html: '<p><strong>iSCSI</strong> permet de <strong>partager du stockage via le réseau</strong> : un serveur utilise un disque distant (une <strong>baie de disques</strong>) <strong>comme s’il était local</strong>. C’est souvent ce qui fournit le stockage partagé nécessaire à la HA.</p>' }),
  accordion([
    ['⚙️ Comment ça marche', '<p>iSCSI transporte des <strong>commandes SCSI</strong> (le langage des disques) <strong>sur le réseau IP</strong> (port <strong>TCP 3260</strong>). Deux rôles : l’<strong>initiateur</strong> (le serveur qui demande le disque) et la <strong>cible / target</strong> (la baie qui fournit le disque).</p>'],
    ['🧱 LUN', '<p>La cible présente des <strong>LUN</strong> (<em>Logical Unit Number</em>) : chaque LUN correspond à un <strong>volume disque</strong> que l’initiateur voit et utilise comme un disque local.</p>'],
    ['🎯 À quoi ça sert', '<p><strong>Centraliser</strong> le stockage des VM sur le réseau, et fournir le <strong>stockage partagé indispensable aux clusters et à la haute disponibilité</strong>. Une solution simple pour <strong>mutualiser le stockage</strong> en virtualisation.</p>'],
  ]),

  block('heading', { level: 2, text: '🎯 Pourquoi c’est central pour un TSSR' }),
  block('html', { html: '<ul><li>💰 <strong>Consolidation</strong> : moins de serveurs physiques → économies (électricité, place, matériel).</li><li>🧪 <strong>Maquettes & labs</strong> : monter et casser des environnements de test sans risque — c’est la base de la formation.</li><li>🛡️ <strong>Isolation & sécurité</strong> : chaque service dans sa bulle.</li><li>♻️ <strong>Sauvegarde & PRA</strong> : snapshots, clones et reprise d’activité rapides après incident.</li><li>☁️ <strong>Cloud</strong> : les offres <strong>IaaS</strong> (AWS, Azure…) ne sont que de la virtualisation à grande échelle. Un TSSR y est de plus en plus confronté.</li></ul>' }),

  block('heading', { level: 2, text: '🧰 Panorama des outils' }),
  block('html', { html: '<ul><li>🟩 <strong>VMware</strong> — ESXi (Type 1, entreprise) et Workstation/Player (Type 2).</li><li>🟦 <strong>Microsoft Hyper-V</strong> — rôle de Windows Server (Type 1).</li><li>🟧 <strong>Proxmox VE</strong> — Type 1, libre, VM + conteneurs.</li><li>🟦 <strong>VirtualBox</strong> — Type 2, gratuit, parfait pour débuter.</li><li>🐧 <strong>KVM</strong> — la virtualisation native de Linux.</li><li>🧪 <strong>QEMU</strong> — émulateur/virtualiseur, souvent couplé à KVM ; parfait en HomeLab.</li><li>🐳 <strong>Docker</strong> — la référence des conteneurs.</li><li>☁️ <strong>AWS / Azure / GCP</strong> — virtualisation dans le cloud (IaaS).</li></ul>' }),

  note('green', '💡 À retenir', '<p>La virtualisation = <strong>abstraire</strong> le matériel pour le <strong>mutualiser</strong> et l’<strong>isoler</strong>, via un <strong>hyperviseur</strong> (Type 1 serveur / Type 2 poste). On alloue des <strong>ressources virtuelles</strong> (vCPU, vRAM, vNIC, disque <strong>VHD/VHDX</strong>), on relie les VM avec un <strong>commutateur virtuel</strong> (externe / interne / privé), et on les protège par <strong>snapshots</strong> (≠ backup), <strong>sécurité de l’hyperviseur</strong>, <strong>haute disponibilité</strong> et stockage partagé (<strong>iSCSI</strong>). Pour un TSSR : labs, consolidation, sauvegarde/PRA, cloud. Pour la pratique : <a href="/pages/virtualisation">La virtualisation avec Hyper-V</a>. Sigles dans le <a href="/glossaire">Glossaire</a>.</p>'),
];

const PAGE = { slug: SLUG, title: 'La virtualisation : théorie & concepts', excerpt: 'Les fondamentaux de la virtualisation pour le TSSR : abstraction, types, hyperviseurs Type 1/2, ressources (vCPU/vRAM/vNIC, VHD/VHDX), cycle de vie, snapshots, commutateur virtuel, sécurité, haute disponibilité et iSCSI.' };

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
  const body = JSON.stringify({ title: PAGE.title, slug: PAGE.slug, excerpt: PAGE.excerpt, content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1 });
  const res = cur
    ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body })
    : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log(`PAGE ${PAGE.slug}`, res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());

  const cours = existing.find(e => e.slug === 'cours');
  if (cours) {
    const hub = buildHubBlocks();
    const r = await fetch(`${BASE}/api/admin/pages/${cours.id}`, { method: 'PUT', headers: h, body: JSON.stringify({ title: 'Cours', slug: 'cours', content: renderPageBlocksToHtml(hub), builder_json: serializePageBlocks(hub), published: 1 }) });
    console.log('HUB Cours', r.status, r.ok ? '(maj)' : await r.text());
  } else console.log('HUB Cours introuvable');

  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

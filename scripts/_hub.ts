/* Source de vérité UNIQUE du hub « Cours ».
   Tous les scripts de seed importent buildHubBlocks() → aucun risque de divergence.
   Mise en page : sections par domaine, sous-catégories, et grille de cartes (titre + description). */
import { makePageBlock, type PageBlock } from '../client/src/lib/page-blocks';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);

export type Course = { href: string; title: string; desc: string };
export type SubCat = { name: string; courses: Course[] };
export type Domain = { icon: string; name: string; intro: string; subcats: SubCat[] };

export const DOMAINS: Domain[] = [
  {
    icon: '🔧', name: 'Hardware', intro: 'Les composants physiques de la machine.',
    subcats: [
      { name: 'Fondamentaux', courses: [
        { href: '/pages/hardware', title: 'Le hardware', desc: 'Les composants physiques, pour débuter.' },
        { href: '/pages/les-form-factor', title: 'Les form factors', desc: 'Formats de cartes mères et de boîtiers.' },
      ] },
      { name: 'La carte mère', courses: [
        { href: '/pages/carte-mere', title: 'Connectique interne', desc: 'Les connecteurs internes, repérés sur le schéma.' },
        { href: '/pages/ports-arriere-carte-mere', title: 'Les ports arrière', desc: 'USB, HDMI, RJ45… le panneau arrière.' },
        { href: '/pages/le-chipset', title: 'Le chipset', desc: 'Le chef d’orchestre de la carte mère.' },
        { href: '/pages/le-processeur', title: 'Le processeur (CPU)', desc: 'Fabricants, sockets et fonctions.' },
      ] },
      { name: 'Stockage', courses: [
        { href: '/pages/le-raid', title: 'Les niveaux de RAID', desc: '0, 1, 5, 6, 10 : performance et sécurité.' },
      ] },
    ],
  },
  {
    icon: '💾', name: 'Software', intro: 'Systèmes, configuration et administration.',
    subcats: [
      { name: 'Culture & système', courses: [
        { href: '/pages/histoire-de-windows', title: 'L’histoire de Windows', desc: 'De Windows 1.0 (1985) à Windows 11.' },
        { href: '/pages/le-systeme-exploitation', title: 'Le système d’exploitation', desc: 'Rôle de l’OS, processus, fichiers.' },
      ] },
      { name: 'Démarrage & disques', courses: [
        { href: '/pages/demarrage-bios-uefi', title: 'Le démarrage : BIOS & UEFI', desc: 'Du bouton power à l’écran de connexion.' },
        { href: '/pages/systemes-de-fichiers', title: 'Les systèmes de fichiers', desc: 'NTFS, FAT32, exFAT, ext4.' },
        { href: '/pages/msconfig-configuration-systeme', title: 'Configuration du système (MSConfig)', desc: 'Maîtriser et diagnostiquer le démarrage.' },
      ] },
      { name: 'Administration Windows', courses: [
        { href: '/pages/gestion-ordinateur-windows', title: 'La gestion de l’ordinateur', desc: 'Comptes, groupes, services, console MMC.' },
        { href: '/pages/base-de-registre', title: 'La base de registre', desc: 'Les réglages internes de Windows.' },
        { href: '/pages/cmd-et-powershell', title: 'Invite de commandes & PowerShell', desc: 'La ligne de commande et les commandes clés.' },
      ] },
      { name: 'Windows Server', courses: [
        { href: '/pages/windows-server', title: 'Windows Server', desc: 'Concepts : rôles vs fonctionnalités.' },
        { href: '/pages/roles-windows-server', title: 'Les rôles de Windows Server', desc: 'AD, DNS, DHCP, IIS, Hyper-V…' },
        { href: '/pages/gestionnaire-de-serveurs', title: 'Le gestionnaire de serveurs', desc: 'Installer & gérer (fiches pratiques).' },
        { href: '/pages/vocabulaire-active-directory', title: 'Vocabulaire Active Directory (AD)', desc: 'Forêt, domaine, DC, schéma, OU, groupes… en questions-réponses.' },
        { href: '/pages/hebergement-web', title: 'L’hébergement web (DNS + IIS)', desc: 'Publier un site : serveur web IIS, résolution DNS, FQDN, FTP, tests.' },
      ] },
      { name: 'Virtualisation', courses: [
        { href: '/pages/virtualisation-theorie', title: 'La virtualisation : théorie & concepts', desc: 'Abstraction, types, hyperviseurs, VM vs conteneur — et la place en TSSR.' },
        { href: '/pages/virtualisation', title: 'La virtualisation avec Hyper-V', desc: 'Hyper-V, VM, commutateur virtuel — via le Gestionnaire de serveurs.' },
        { href: '/pages/tp2-virtualisation-hyperv', title: 'TP2 — Virtualisation Hyper-V (notes & corrigé)', desc: 'Manipulations + résultats : VM, snapshots, export/import, commutateurs, ping.' },
      ] },
    ],
  },
  {
    icon: '🌐', name: 'Réseau', intro: 'Relier et faire communiquer les machines.',
    subcats: [
      { name: 'Fondamentaux', courses: [
        { href: '/pages/bases-du-reseau', title: 'Les bases du réseau', desc: 'Carte réseau, RJ45, IP, MAC… hardware et software.' },
        { href: '/pages/adresses-ip', title: 'Les adresses IP', desc: 'Format, réseau/machine & masque, privées/publiques, DHCP.' },
        { href: '/pages/ip-et-binaire', title: 'IP et initiation au binaire', desc: 'Bit, octet, conversions, l’IP en 32 bits, le masque/CIDR.' },
        { href: '/pages/calcul-ip-masque', title: 'Calcul d’IP & masque (nombre magique)', desc: 'Masque, idSR, broadcast, hôtes — méthode + calculateur /CIDR.' },
        { href: '/pages/segmentation-sous-reseaux', title: 'La segmentation (subnetting)', desc: 'Découper un réseau : par nombre de sous-réseaux (FLSM) ou d’hôtes (VLSM).' },
        { href: '/pages/adresses-mac', title: 'Les adresses MAC', desc: 'L’identité matérielle de la carte réseau (vs IP).' },
        { href: '/pages/notions-complementaires', title: 'Notions clés (lexique illustré)', desc: 'NAT, VPN, DMZ, VLAN, PoE, DNS, DHCP, ARP, proxy, QoS.' },
      ] },
      { name: 'Équipements', courses: [
        { href: '/pages/le-routeur', title: 'Le routeur', desc: 'Relie ton réseau local à Internet.' },
        { href: '/pages/le-switch', title: 'Le switch', desc: 'Connecte les appareils d’un même réseau.' },
        { href: '/pages/le-pare-feu', title: 'Le pare-feu', desc: 'Filtre le trafic selon des règles.' },
      ] },
      { name: 'Protocoles', courses: [
        { href: '/pages/tcp-et-udp', title: 'TCP & UDP', desc: 'Fiable ou rapide : les deux protocoles de transport.' },
      ] },
      { name: 'Schémas & doc', courses: [
        { href: '/pages/schemas-infrastructure', title: 'Les schémas d’infrastructure', desc: 'Dessiner un réseau avec draw.io, selon la taille de l’infra.' },
      ] },
      { name: 'Projet', courses: [
        { href: '/pages/reseau-entreprise', title: 'Réseau d’entreprise (A→Z)', desc: 'Concevoir, installer et déployer un réseau multi-services.' },
        { href: '/pages/tp1-presentation-cybercafe', title: 'TP1 — Présentation cybercafé', desc: 'Réussir le devis et la présentation du TP1 (eSport).' },
      ] },
    ],
  },
  {
    icon: '🛠️', name: 'Maintenance', intro: 'Méthode, diagnostic et support.',
    subcats: [
      { name: 'Méthode & support', courses: [
        { href: '/pages/les-7-couches-osi', title: 'Les 7 couches OSI', desc: 'La carte du réseau, pour dépanner.' },
        { href: '/pages/le-ticketing', title: 'Le ticketing', desc: 'Gérer les incidents et les demandes.' },
      ] },
    ],
  },
  {
    icon: '🇬🇧', name: 'Anglais', intro: 'L’anglais professionnel, indispensable dans le métier.',
    subcats: [
      { name: 'Communication professionnelle', courses: [
        { href: '/pages/anglais-professionnel', title: 'L’anglais professionnel en informatique', desc: 'Compétence REAC, niveaux CECRL, programme, épreuves & ressources.' },
      ] },
    ],
  },
  {
    icon: '📋', name: 'Procédures', intro: 'Modes opératoires pas-à-pas, prêts à suivre en TP ou en production.',
    subcats: [
      { name: 'Machines virtuelles', courses: [
        { href: '/pages/procedure-vm-hyperv', title: 'Créer & configurer une VM (ISO) sur Hyper-V', desc: 'De la création de la VM au début du TP : OS, nom, IP fixe, pare-feu.' },
      ] },
      { name: 'Active Directory', courses: [
        { href: '/pages/procedure-installation-active-directory', title: 'Installer & configurer Active Directory', desc: 'De la VM vierge au client intégré au domaine : procédure complète.' },
      ] },
    ],
  },
  {
    icon: '💡', name: 'Astuces', intro: 'Petites manips qui font gagner du temps au quotidien.',
    subcats: [
      { name: 'Réseau & pare-feu', courses: [
        { href: '/pages/astuce-pare-feu-ping', title: 'Autoriser le ping (ICMP) dans le pare-feu', desc: 'Rendre une machine « pingable » : Windows Server, Windows 10 & 11.' },
      ] },
    ],
  },
  {
    icon: '📟', name: 'Cisco Packet Tracer', intro: 'Simuler et configurer des équipements réseau en ligne de commande (CLI).',
    subcats: [
      { name: 'Routeurs', courses: [
        { href: '/pages/cisco-routeur-cli', title: 'Configurer un routeur en CLI', desc: 'Modes Cisco et configuration d’une interface (IP, masque, no shutdown).' },
        { href: '/pages/cisco-route-statique', title: 'Les routes statiques en CLI', desc: 'Indiquer manuellement le chemin vers un réseau distant (ip route).' },
      ] },
    ],
  },
];

/** Construit les blocs du hub « Cours » (hero + sections par domaine → sous-catégories → grille de cartes). */
export function buildHubBlocks(): PageBlock[] {
  const total = DOMAINS.reduce((n, d) => n + d.subcats.reduce((m, s) => m + s.courses.length, 0), 0);
  const blocks: PageBlock[] = [
    block('hero', { eyebrow: 'TSSR', title: 'Cours', subtitle: 'Tous les supports, classés par domaine et par thème.' }),
    block('html', { html: `<p class="meta">${total} cours répartis dans ${DOMAINS.length} domaines. Clique sur une carte pour ouvrir le cours.</p>` }),
  ];
  // Code couleur par catégorie (domaine) — repère visuel dans le hub.
  const COLORS: Record<string, string> = {
    'Hardware': '#ea580c',            // orange
    'Software': '#2563eb',            // bleu
    'Réseau': '#059669',              // vert
    'Maintenance': '#dc2626',         // rouge
    'Anglais': '#7c3aed',             // violet
    'Procédures': '#0d9488',          // sarcelle
    'Astuces': '#ca8a04',             // doré
    'Cisco Packet Tracer': '#0891b2', // cyan
  };
  const FALLBACK = '#64748b';
  for (const d of DOMAINS) {
    const col = COLORS[d.name] || FALLBACK;
    const n = d.subcats.reduce((m, s) => m + s.courses.length, 0);
    blocks.push(block('html', { html:
      `<div style="margin-top:18px;padding:12px 16px;border-radius:12px;background:${col}14;border:1px solid ${col}55;border-left:6px solid ${col}">`
      + `<h2 style="margin:0;font-size:19px;color:${col};display:flex;align-items:center;gap:8px;flex-wrap:wrap">${d.icon} ${d.name}`
      + `<span style="font-size:11px;font-weight:600;color:#fff;background:${col};border-radius:999px;padding:2px 9px">${n}</span></h2>`
      + `<p class="meta" style="margin:5px 0 0">${d.intro}</p></div>` }));
    for (const sc of d.subcats) {
      blocks.push(block('html', { html: `<h3 style="margin:14px 0 8px;font-size:15px;border-left:4px solid ${col};padding-left:10px;color:${col}">${sc.name}</h3>` }));
      blocks.push(block('cards', { items: sc.courses.map(c => ({ title: c.title, text: c.desc, href: c.href })) }));
    }
  }
  return blocks;
}

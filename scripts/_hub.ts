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
        { href: '/pages/administration-domaine-ad', title: 'Administration d’un domaine AD', desc: 'Rôles FSMO, SYSVOL, relations d’approbation & délégation de contrôle (avec schémas).' },
        { href: '/pages/hebergement-web', title: 'L’hébergement web (DNS + IIS)', desc: 'Publier un site : serveur web IIS, résolution DNS, FQDN, FTP, tests.' },
      ] },
      { name: 'Serveur de fichiers', courses: [
        { href: '/pages/permissions-partage-ntfs', title: 'Permissions : Partage & NTFS', desc: 'Partage vs NTFS, cumul (le plus restrictif), héritage, bonne pratique.' },
        { href: '/pages/gestion-avancee-utilisateurs', title: 'Gestion avancée (profils, home, scripts, quotas)', desc: 'Horaires, profils itinérants, dossier de base, scripts de session, ABE, quotas.' },
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
    icon: '💡', name: 'Astuces', intro: 'Petites manips qui font gagner du temps au quotidien.',
    subcats: [
      { name: 'Réseau & pare-feu', courses: [
        { href: '/pages/astuce-pare-feu-ping', title: 'Autoriser le ping (ICMP) dans le pare-feu', desc: 'Rendre une machine « pingable » : Windows Server, Windows 10 & 11.' },
      ] },
      { name: 'Accès à distance', courses: [
        { href: '/pages/astuce-bureau-a-distance', title: 'Activer le Bureau à distance (RDP)', desc: 'Prendre la main à distance : Windows 10/11 & Server, pare-feu, mstsc.' },
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
  // Code couleur par catégorie (domaine).
  const COLORS: Record<string, string> = {
    'Hardware': '#ea580c', 'Software': '#2563eb', 'Réseau': '#059669', 'Maintenance': '#dc2626',
    'Anglais': '#7c3aed', 'Procédures': '#0d9488', 'Astuces': '#ca8a04', 'Cisco Packet Tracer': '#0891b2',
  };
  const FALLBACK = '#64748b';
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const idOf = (s: string) => 'cat-' + s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const col = (d: Domain) => COLORS[d.name] || FALLBACK;
  const count = (d: Domain) => d.subcats.reduce((m, s) => m + s.courses.length, 0);

  const style = '<style>'
    + '.crs-nav{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 4px}'
    + '.crs-chip{display:inline-flex;align-items:center;gap:7px;padding:6px 13px;border-radius:999px;border:1px solid var(--border);background:var(--surface);text-decoration:none;font-size:13px;font-weight:600;color:var(--text);transition:transform .12s,box-shadow .12s}'
    + '.crs-chip:hover{transform:translateY(-1px);box-shadow:0 3px 10px rgba(0,0,0,.08)}'
    + '.crs-chip .crs-dot{width:10px;height:10px;border-radius:50%;flex:0 0 auto}'
    + '.crs-chip .crs-n{font-size:11px;color:var(--text-muted);font-weight:700}'
    + '.crs-domain{scroll-margin-top:76px;margin-top:26px}'
    + '.crs-dhead{display:flex;align-items:center;gap:12px;padding:13px 16px;border-radius:12px;color:#fff}'
    + '.crs-dhead .crs-t{font-size:18px;font-weight:800;line-height:1.15}'
    + '.crs-dhead .crs-i{opacity:.92;font-size:12.5px;margin-top:2px}'
    + '.crs-dhead .crs-b{margin-left:auto;background:rgba(255,255,255,.22);border-radius:999px;padding:3px 11px;font-size:12px;font-weight:800;white-space:nowrap}'
    + '.crs-sub{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;margin:16px 0 9px;padding-left:11px;border-left:3px solid}'
    + '.crs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}'
    + '.crs-card{display:block;padding:13px 15px;border:1px solid var(--border);border-left:4px solid;border-radius:10px;background:var(--surface);text-decoration:none;transition:transform .12s,box-shadow .12s}'
    + '.crs-card:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(0,0,0,.08)}'
    + '.crs-ct{font-weight:700;font-size:14.5px;color:var(--text);display:flex;justify-content:space-between;align-items:center;gap:8px}'
    + '.crs-ct .crs-a{color:var(--text-muted);transition:transform .12s}'
    + '.crs-card:hover .crs-ct .crs-a{transform:translateX(3px)}'
    + '.crs-cd{font-size:12.5px;color:var(--text-muted);margin-top:4px;line-height:1.4}'
    + '</style>';
  const nav = `<div class="crs-nav">${DOMAINS.map(d => `<a class="crs-chip" href="#${idOf(d.name)}"><span class="crs-dot" style="background:${col(d)}"></span>${d.icon} ${esc(d.name)}<span class="crs-n">${count(d)}</span></a>`).join('')}</div>`;

  const blocks: PageBlock[] = [
    block('hero', { eyebrow: 'TSSR', title: 'Cours', subtitle: 'Tous les supports, classés par catégorie et par thème.' }),
    block('html', { html: `${style}<p class="meta" style="margin:2px 0 0">${total} cours dans ${DOMAINS.length} catégories — clique sur une pastille pour aller directement à une catégorie.</p>${nav}` }),
  ];
  for (const d of DOMAINS) {
    const c = col(d);
    let html = `<section class="crs-domain" id="${idOf(d.name)}">`;
    html += `<div class="crs-dhead" style="background:${c}"><span style="font-size:22px">${d.icon}</span><div><div class="crs-t">${esc(d.name)}</div><div class="crs-i">${esc(d.intro)}</div></div><span class="crs-b">${count(d)} cours</span></div>`;
    for (const sc of d.subcats) {
      html += `<div class="crs-sub" style="border-color:${c};color:${c}">${esc(sc.name)}</div>`;
      html += `<div class="crs-grid">${sc.courses.map(co => `<a class="crs-card" style="border-left-color:${c}" href="${co.href}"><div class="crs-ct">${esc(co.title)}<span class="crs-a">→</span></div><div class="crs-cd">${esc(co.desc)}</div></a>`).join('')}</div>`;
    }
    html += '</section>';
    blocks.push(block('html', { html }));
  }
  return blocks;
}

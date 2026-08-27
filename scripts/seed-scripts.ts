/* Section « Scripts » : un annuaire de scripts (cartes horizontales, pagination 20/page) +
   les fiches de script. Ajoute aussi l'entrée de menu « Scripts ».
   1er script : configuration standard d'une VM (renommage + IP fixe + DNS, commutateur privé COM_private).
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-scripts.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pre = (code: string, lang = 'PowerShell') => `<div style="margin:6px 0 12px"><div class="meta" style="font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">${lang}</div><pre style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;overflow-x:auto;font-size:12.5px;line-height:1.55;margin:0"><code>${esc(code)}</code></pre></div>`;

// ===================================================================================
// Catalogue des scripts (ajoute ici les futurs scripts)
// ===================================================================================
type Script = { slug: string; icon: string; title: string; desc: string; tags: string[]; cat: string; featured?: string };
const CATEGORIES: { id: string; icon: string; label: string }[] = [
  { id: 'cisco', icon: '📟', label: 'Cisco / Packet Tracer' },
  { id: 'reseau', icon: '🌐', label: 'Réseau & adressage' },
  { id: 'ad', icon: '🏢', label: 'Active Directory' },
  { id: 'virtualisation', icon: '🧰', label: 'Hyper-V & VM' },
  { id: 'linux', icon: '🐧', label: 'Linux & ligne de commande' },
];
const SCRIPTS: Script[] = [
  {
    slug: 'simulateur-complet', icon: '🖥️',
    title: 'Simulateur complet — Poste de travail virtuel',
    desc: 'Un bureau unique (barre des tâches, menu Démarrer, plein écran) qui réunit tous les simulateurs : Windows Server (Hyper-V, Active Directory, DNS/DHCP/IIS, GPO), invite de commandes cmd & PowerShell, console routeur Cisco et Réalisation 1. Chaque fenêtre garde son état pour dérouler un TP de bout en bout.',
    tags: ['Interactif', 'Windows', 'Active Directory', 'Hyper-V', 'cmd', 'Cisco'], cat: 'virtualisation', featured: 'Le bureau virtuel tout-en-un',
  },
  {
    slug: 'entrainement-realisation-1', icon: '🎯',
    title: 'Entraînement — Réalisation 1 Windows',
    desc: 'Refais la Réalisation 1 en aveugle : saisis noms de machines, IP fixes, masque, DNS, zone + enregistrements, sites IIS, étendue DHCP et IP hôte Hyper-V. L’outil valide chaque étape, signale les erreurs (valeur attendue) et donne un score.',
    tags: ['Interactif', 'Windows', 'DNS', 'IIS', 'DHCP', 'Entraînement'], cat: 'virtualisation', featured: 'S’entraîner en conditions d’examen',
  },
  {
    slug: 'emulateur-invite-commandes', icon: '⌨️',
    title: 'Émulateur d’invite de commandes (bac à sable)',
    desc: 'Terminal cmd simulé avec état machine modifiable : netsh, ipconfig, ping, nslookup, hostname, arp… et équivalents PowerShell. La config change réellement (l’IP posée par netsh apparaît dans ipconfig) ; table d’hôtes éditable pour des tests ping/DNS réalistes selon le sous-réseau. Réutilisable pour n’importe quelle configuration.',
    tags: ['Interactif', 'Réseau', 'cmd', 'PowerShell', 'netsh'], cat: 'reseau',
  },
  {
    slug: 'atelier-reseau', icon: '🗺️',
    title: 'Atelier Réseau & Packet Tracer (assistant)',
    desc: 'Assistant multi-étapes à contexte partagé : contexte, préférences, segmentation VLSM multi-routeurs (2811/2911) avec attribution auto des interfaces (LAN + liaisons série/Gig, DCE/clock), schéma (blocs + SVG), pools DHCP par routeur et enregistrements DNS + tests.',
    tags: ['Interactif', 'Réseau', 'Cisco', 'Packet Tracer', 'VLSM', 'Assistant'], cat: 'cisco', featured: 'Un TP réseau de A à Z',
  },
  {
    slug: 'configurateur-vm', icon: '🧰',
    title: 'Configurateur — VM serveur',
    desc: 'Outil interactif : clone une VM source (Export/Import), applique ressources, réseau, pare-feu (ping), rôles, nom et domaine/groupe de travail → script PowerShell en 2 parties, prêt à copier.',
    tags: ['Interactif', 'PowerShell', 'Hyper-V', 'Clone'], cat: 'virtualisation',
  },
  {
    slug: 'diagnostic-reseau', icon: '🩺',
    title: 'Diagnostic réseau (modèle OSI)',
    desc: 'Outil de dépannage : saisis ton contexte (IP, passerelle, DNS, cible, port, partage) → script PowerShell qui teste couche par couche et réduit le périmètre de la panne.',
    tags: ['Interactif', 'PowerShell', 'Réseau', 'Dépannage'], cat: 'reseau',
  },
  {
    slug: 'convertisseur-hexa', icon: '🔢',
    title: 'Convertisseur hexadécimal ↔ texte / décimal',
    desc: 'Coller un dump hexa (trame Wireshark) → texte UTF-8/ASCII, décimal, binaire. Fait aussi Texte → hexa et décode le Base64 (Authorization: Basic).',
    tags: ['Interactif', 'Réseau', 'Analyse de trames', 'Hexadécimal'], cat: 'reseau',
  },
  {
    slug: 'generateur-routes-statiques', icon: '🛣️',
    title: 'Générateur — Routes statiques multi-routeurs (CLI)',
    desc: 'Décris la topologie (routeurs, liaisons, LAN) : l’outil calcule pour chaque routeur les routes statiques (ip route) vers tous les réseaux, avec le bon prochain saut. CLI prête à coller.',
    tags: ['Interactif', 'Cisco', 'Packet Tracer', 'Routage'], cat: 'cisco',
  },
  {
    slug: 'configurateur-dhcp-cisco', icon: '📶',
    title: 'Générateur — DHCP routeur (Packet Tracer)',
    desc: 'Outil interactif : pools DHCP (réseau, passerelle, DNS, domaine, bail) et adresses exclues → configuration CLI IOS (ip dhcp pool) prête à coller dans Packet Tracer.',
    tags: ['Interactif', 'Cisco', 'Packet Tracer', 'DHCP'], cat: 'cisco',
  },
  {
    slug: 'segmentation-reseau', icon: '🧮',
    title: 'Outil de segmentation réseau (VLSM / FLSM)',
    desc: 'Planificateur de sous-réseaux : réseau de base + besoins en hôtes → plan d’adressage complet (réseau, plage, broadcast, masque, passerelle, hôtes). Modes VLSM et FLSM.',
    tags: ['Interactif', 'Réseau', 'Subnetting', 'VLSM'], cat: 'reseau',
  },
  {
    slug: 'configurateur-routeur-cisco', icon: '📟',
    title: 'Configurateur — Routeur Cisco (Packet Tracer)',
    desc: 'Outil interactif : hostname, interfaces (IP fixe + activation, clock rate DCE), routes statiques et NAT/PAT (inside/outside, overload, NAT statique & redirection de port) → configuration CLI IOS prête à coller dans Packet Tracer.',
    tags: ['Interactif', 'Cisco', 'Packet Tracer', 'Routage', 'NAT'], cat: 'cisco',
  },
  {
    slug: 'installateur-linux', icon: '📦',
    title: 'Installateur du site — serveur Linux Debian ou Rocky',
    desc: 'Un script interactif qui deploie le CMS et toutes ses dependances sur Debian/Ubuntu ou RHEL/Rocky/AlmaLinux : Node.js, compte de service, unite systemd confinee, nginx en proxy inverse, HTTPS, pare-feu — et les booleens SELinux qui manquent toujours. Chaque etape se termine par un verrou qui verifie le resultat avant de continuer.',
    tags: ['Bash', 'Linux', 'Debian', 'Rocky', 'Déploiement'], cat: 'linux', featured: 'De la machine nue au site en ligne',
  },
  {
    slug: 'configurateur-debian-reseau', icon: '🌐',
    title: 'Configurateur d’adressage IP — Debian',
    desc: 'Saisis ton adressage, obtiens /etc/network/interfaces, /etc/resolv.conf et /etc/hosts prets a coller. Et surtout les verifications que la syntaxe ne fait pas : passerelle hors du sous-reseau, adresse de reseau ou de diffusion, auto oublie, dns-nameservers sans resolvconf.',
    tags: ['Interactif', 'Linux', 'Debian', 'Réseau'], cat: 'linux',
  },
  {
    slug: 'repertoire-commandes', icon: '🐧',
    title: 'Répertoire des commandes Linux — recherche en français',
    desc: 'Pose ta question en français — « comment voir la place qui reste sur le disque ? ». La phrase est découpée, les mots inutiles jetés, les synonymes reconnus (place = espace = disque). Les anciens noms (ifconfig, netstat) et les équivalents Windows (ipconfig, findstr) mènent au bon endroit.',
    tags: ['Interactif', 'Linux', 'Ligne de commande', 'Recherche'], cat: 'linux',
  },
  {
    slug: 'outils-linux', icon: '🧱',
    title: 'Constructeur de script Bash',
    desc: 'Assemble le squelette d’un script d’administration — mode strict, arguments, journal horodaté, vérification des dépendances, verrou anti-chevauchement, nettoyage garanti par trap, simulation — et dit ce que chaque garde-fou évite. Le script produit est complet et vérifié : bash -n l’accepte dans les 1024 combinaisons.',
    tags: ['Interactif', 'Linux', 'Bash', 'Scripting'], cat: 'linux',
  },
  {
    slug: 'constructeur-agdlp', icon: '🔐',
    title: 'Constructeur AGDLP',
    desc: 'Outil tout-en-un : services, dossiers + besoins d’accès, utilisateurs → génère UO, groupes G/DL (bonne convention), imbrication, comptes et partages NTFS. Arborescence UO + NTFS en aperçu, 2 scripts PowerShell.',
    tags: ['Interactif', 'PowerShell', 'Active Directory', 'AGDLP', 'NTFS'], cat: 'ad',
  },
  {
    slug: 'constructeur-ad', icon: '🏗️',
    title: 'Constructeur AD (masse)',
    desc: 'Outil graphique : définir UO / groupes (imbriqués) / utilisateurs, créer des comptes en masse (collage de liste) → script PowerShell complet.',
    tags: ['Interactif', 'PowerShell', 'Active Directory', 'Masse'], cat: 'ad',
  },
  {
    slug: 'configurateur-ad', icon: '🏢',
    title: 'Configurateur — Active Directory',
    desc: 'Outil interactif : crée une UO, copie un utilisateur modèle (ex. administrateur → Jean NGUYEN) et désactive le compte source → script PowerShell prêt à copier.',
    tags: ['Interactif', 'PowerShell', 'Active Directory'], cat: 'ad',
  },
  {
    slug: 'script-config-vm', icon: '🖥️',
    title: 'Configuration standard d’une VM',
    desc: 'Renomme le PC (Client_xx / SRV_rôle_xx), applique l’IP fixe (IP, masque, passerelle .254, DNS) et rappelle le commutateur privé COM_private.',
    tags: ['PowerShell', 'Hyper-V', 'Réseau'], cat: 'virtualisation',
  },
];

// ===================================================================================
// Page ANNUAIRE — cartes horizontales, pagination CSS 20 par page (sans JS)
// ===================================================================================
function pill(t: string) { return `<span class="sc-pill">${t}</span>`; }
// Carte compacte (verticale) — description tronquée à 3 lignes, 3 tags max.
function card(s: Script) {
  const interactif = s.tags.includes('Interactif');
  const badge = `<span class="sc-badge sc-badge-${interactif ? 'int' : 'ps'}">${interactif ? '⚡ Interactif' : '📜 Script'}</span>`;
  const tags = s.tags.filter(t => t !== 'Interactif').slice(0, 3);
  return `<a class="script-card" href="/pages/${s.slug}">`
    + `<div class="sc-top"><span class="sc-ico">${s.icon}</span>${badge}</div>`
    + `<div class="sc-title">${s.title}</div>`
    + `<div class="sc-desc meta">${s.desc}</div>`
    + `<div class="sc-tags">${tags.map(pill).join('')}</div>`
    + `</a>`;
}
// Grande carte « À la une » — pour les outils phares.
function heroCard(s: Script) {
  return `<a class="sc-feat" href="/pages/${s.slug}">`
    + `<span class="sc-feat-ico">${s.icon}</span>`
    + `<span class="sc-feat-body"><span class="sc-feat-kicker">${s.featured}</span>`
    + `<span class="sc-feat-title">${s.title}</span>`
    + `<span class="sc-feat-desc">${s.desc}</span></span>`
    + `<span class="sc-feat-go">Lancer →</span></a>`;
}
function buildDirectory(scripts: Script[]): string {
  const feats = scripts.filter(s => s.featured);
  const rest = scripts.filter(s => !s.featured);
  const cats = CATEGORIES.filter(c => rest.some(s => s.cat === c.id));
  const css = `.scripts-dir{position:relative}`
    // À la une
    + `.sc-feats{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin:0 0 30px}`
    + `.sc-feat{position:relative;display:flex;flex-direction:column;gap:10px;padding:20px 18px 16px;border:1px solid color-mix(in srgb,var(--accent) 35%,var(--border));border-radius:16px;text-decoration:none;background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 10%,var(--surface)),var(--surface) 65%);transition:transform .14s,box-shadow .14s,border-color .14s}`
    + `.sc-feat:hover{transform:translateY(-3px);border-color:var(--accent);box-shadow:0 14px 34px rgba(0,0,0,.16)}`
    + `.sc-feat-ico{font-size:34px;line-height:1}`
    + `.sc-feat-kicker{display:block;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--accent);margin-bottom:4px}`
    + `.sc-feat-title{display:block;font-weight:800;font-size:16.5px;color:var(--text);line-height:1.3}`
    + `.sc-feat-desc{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;font-size:12.5px;color:var(--text-muted);margin-top:6px;line-height:1.5}`
    + `.sc-feat-go{margin-top:auto;padding-top:8px;font-size:13px;font-weight:800;color:var(--accent)}`
    // Sommaire
    + `.scripts-dir .sc-nav{display:flex;flex-wrap:wrap;gap:8px;margin:2px 0 24px}`
    + `.scripts-dir .sc-chip{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;color:var(--text-soft);text-decoration:none;border:1px solid var(--border);border-radius:999px;padding:5px 13px;background:var(--surface);transition:border-color .15s,color .15s}`
    + `.scripts-dir .sc-chip:hover{border-color:var(--accent);color:var(--accent)}`
    + `.scripts-dir .sc-chip .sc-n{font-size:11px;color:var(--text-muted);background:var(--surface-3);border-radius:999px;padding:0 7px}`
    // Sections
    + `.scripts-dir .sc-sec{margin:0 0 32px;scroll-margin-top:84px}`
    + `.scripts-dir .sc-h{font-size:16.5px;font-weight:800;color:var(--text);margin:0 0 13px;display:flex;align-items:center;gap:9px;padding-bottom:8px;border-bottom:1px solid var(--border)}`
    + `.scripts-dir .sc-h .sc-count{font-size:12px;font-weight:700;color:var(--text-muted);background:var(--surface-3);border:1px solid var(--border);border-radius:999px;padding:1px 9px}`
    + `.scripts-dir .sc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(235px,1fr));gap:12px}`
    // Cartes compactes
    + `.script-card{display:flex;flex-direction:column;gap:7px;padding:15px 15px 13px;border:1px solid var(--border);border-radius:13px;background:var(--surface);text-decoration:none;transition:border-color .15s,transform .15s,box-shadow .15s}`
    + `.script-card:hover{border-color:var(--accent);transform:translateY(-2px);box-shadow:0 10px 24px rgba(0,0,0,.12)}`
    + `.script-card .sc-top{display:flex;align-items:center;justify-content:space-between}`
    + `.script-card .sc-ico{font-size:26px;line-height:1}`
    + `.script-card .sc-title{font-weight:700;font-size:14px;color:var(--text);line-height:1.35}`
    + `.script-card .sc-desc{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;font-size:12px;line-height:1.5;margin:0}`
    + `.script-card .sc-tags{margin-top:auto;padding-top:4px}`
    + `.sc-pill{display:inline-block;font-size:10px;font-weight:600;color:var(--text-muted);background:var(--surface-3);border:1px solid var(--border);border-radius:999px;padding:1px 8px;margin:3px 4px 0 0}`
    + `.sc-badge{display:inline-block;font-size:10px;font-weight:700;border-radius:999px;padding:1px 8px}`
    + `.sc-badge-int{color:#7c3aed;background:color-mix(in srgb,#7c3aed 14%,transparent);border:1px solid color-mix(in srgb,#7c3aed 40%,transparent)}`
    + `.sc-badge-ps{color:var(--text-muted);background:var(--surface-3);border:1px solid var(--border)}`
    + `@media (max-width:560px){.scripts-dir .sc-grid{grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}.sc-feats{grid-template-columns:1fr}}`;
  const nav = cats.map(c => `<a class="sc-chip" href="#sec-${c.id}">${c.icon} ${c.label} <span class="sc-n">${rest.filter(s => s.cat === c.id).length}</span></a>`).join('');
  const sections = cats.map(c => {
    const group = rest.filter(s => s.cat === c.id);
    return `<section class="sc-sec" id="sec-${c.id}"><h2 class="sc-h">${c.icon} ${c.label} <span class="sc-count">${group.length}</span></h2>`
      + `<div class="sc-grid">${group.map(card).join('')}</div></section>`;
  }).join('');
  return `<div class="scripts-dir"><style>${css}</style>`
    + `<h2 class="sc-h" style="border:none;margin-bottom:10px">⭐ À la une</h2><div class="sc-feats">${feats.map(heroCard).join('')}</div>`
    + `<nav class="sc-nav">${nav}</nav>${sections}</div>`;
}

const dirBlocks: PageBlock[] = [
  block('hero', { eyebrow: 'TSSR', title: 'Outils', subtitle: 'Outils interactifs et scripts prêts à l’emploi pour automatiser les tâches courantes.' }),
  block('html', { html: `<p class="meta">${SCRIPTS.length} outils. Commence par les <strong>⭐ outils phares</strong>, puis explore par domaine avec le sommaire. Les <strong>⚡ interactifs</strong> génèrent une config/un script à partir de tes choix ; les <strong>📜 scripts</strong> sont prêts à copier.</p>` }),
  block('html', { html: buildDirectory(SCRIPTS) }),
];

// ===================================================================================
// FICHE — Configuration standard d'une VM
// ===================================================================================
const psGuest = `#Requires -RunAsAdministrator
# ============================================================
#  Configuration standard d'une VM  (a executer DANS la VM)
#  -> renomme le PC + IP fixe (IP / masque / passerelle / DNS)
# ============================================================

# ---------- A ADAPTER ----------
$Type           = 'SRV'            # 'Client' ou 'SRV'
$Role           = 'AD'             # role principal si SRV (AD, DNS, DHCP, IIS, FILE...)
$Num            = '01'             # numero [xx] : 01, 02, ...
$IP             = '192.168.10.11'  # adresse IP fixe
$PrefixLength   = 24               # masque en CIDR (24 = 255.255.255.0)
$DNS            = '192.168.10.11'  # serveur DNS prefere
$InterfaceAlias = 'Ethernet'       # nom de la carte (cf. Get-NetAdapter)
# -------------------------------

# Nom de la machine selon la convention
if ($Type -eq 'Client') { $NewName = "Client_$Num" } else { $NewName = "SRV_\${Role}_$Num" }

# Passerelle = ID sous-reseau termine par .254 (reseaux /24)
$o = $IP.Split('.')
$Gateway = "$($o[0]).$($o[1]).$($o[2]).254"

Write-Host "Nom        : $NewName"
Write-Host "IP/Masque  : $IP/$PrefixLength"
Write-Host "Passerelle : $Gateway"
Write-Host "DNS        : $DNS"

# 1) IP fixe : on nettoie l'ancienne conf IPv4 puis on applique la nouvelle
Remove-NetIPAddress -InterfaceAlias $InterfaceAlias -AddressFamily IPv4 -Confirm:$false -ErrorAction SilentlyContinue
Remove-NetRoute     -InterfaceAlias $InterfaceAlias -AddressFamily IPv4 -Confirm:$false -ErrorAction SilentlyContinue
New-NetIPAddress -InterfaceAlias $InterfaceAlias -IPAddress $IP -PrefixLength $PrefixLength -DefaultGateway $Gateway | Out-Null
Set-DnsClientServerAddress -InterfaceAlias $InterfaceAlias -ServerAddresses $DNS

# 2) Renommage (le redemarrage est reporte : on redemarre a la fin)
Rename-Computer -NewName $NewName -Force

Write-Host ""
Write-Host "OK. Redemarre la VM pour appliquer le nom." -ForegroundColor Green`;

const psHost = `# ===== Cote HOTE Hyper-V (a executer sur l'hote, avant de demarrer la VM) =====

# Creer le commutateur prive une seule fois (s'il n'existe pas deja) :
if (-not (Get-VMSwitch -Name 'COM_private' -ErrorAction SilentlyContinue)) {
    New-VMSwitch -Name 'COM_private' -SwitchType Private
}

# Connecter la carte reseau de la VM au commutateur prive :
$VMName = 'SRV_AD_01'
Connect-VMNetworkAdapter -VMName $VMName -SwitchName 'COM_private'`;

const ficheBlocks: PageBlock[] = [
  block('hero', { eyebrow: 'Script · Hyper-V / VM', title: 'Configuration standard d’une VM', subtitle: 'Renommer le PC et appliquer l’IP fixe en une fois, sur le commutateur privé COM_private.' }),
  block('html', { html: '<p>Ce script <strong>standardise la mise en service d’une VM</strong> : il <strong>renomme</strong> la machine selon la convention, puis applique l’<strong>adresse IP fixe</strong> (IP, masque, passerelle, DNS). Le réseau passe <strong>toujours</strong> par le commutateur privé <strong><code>COM_private</code></strong>.</p>' }),
  note('blue', '🏷️ Convention de nommage', '<ul><li>Poste client : <code>Client_[xx]</code> — ex. <code>Client_01</code>.</li><li>Serveur : <code>SRV_[rôle principal]_[xx]</code> — ex. <code>SRV_AD_01</code>, <code>SRV_DNS_02</code>, <code>SRV_IIS_01</code>.</li></ul>'),
  note('yellow', '🚪 Passerelle & adressage', '<p>La <strong>passerelle</strong> = l’<strong>ID du sous-réseau terminé par <code>.254</code></strong> (ex. réseau <code>192.168.10.0/24</code> → passerelle <code>192.168.10.254</code>). Le <strong>masque</strong> est donné en CIDR (<code>24</code> = <code>255.255.255.0</code>), puis on renseigne le <strong>DNS</strong>.</p>'),

  block('heading', { level: 2, text: '📜 Le script (dans la VM)' }),
  block('html', { html: '<p>Ouvre <strong>PowerShell en administrateur</strong> dans la VM, adapte le bloc « À ADAPTER », puis exécute :</p>' }),
  block('html', { html: pre(psGuest) }),

  block('heading', { level: 2, text: '🔌 Côté hôte : le commutateur privé COM_private' }),
  block('html', { html: '<p>La connexion de la carte réseau de la VM au commutateur privé se fait <strong>sur l’hôte Hyper-V</strong> (le commutateur privé isole les VM entre elles, sans accès à l’hôte ni à Internet) :</p>' }),
  block('html', { html: pre(psHost) }),

  block('heading', { level: 2, text: '▶️ Utilisation' }),
  block('list', { listItems: [
    'Sur l’hôte : créer/garantir le commutateur privé COM_private et y connecter la VM (script ci-dessus).',
    'Dans la VM : ouvrir PowerShell en administrateur.',
    'Adapter les variables (Type, Role, Num, IP, PrefixLength, DNS, InterfaceAlias).',
    'Exécuter le script, puis redémarrer la VM pour appliquer le nom.',
    'Vérifier : ipconfig (IP/passerelle/DNS) et le nom dans sysdm.cpl.',
  ] }),
  note('green', '🎯 Rappel', '<p>Convention : <code>Client_[xx]</code> ou <code>SRV_[rôle]_[xx]</code>. Passerelle en <code>.254</code>. Commutateur <strong>privé</strong> <code>COM_private</code>. Pour la mise en place complète d’une VM, voir la procédure <a href="/pages/procedure-vm-hyperv">Créer & configurer une VM (ISO) sur Hyper-V</a>.</p>'),
];

// ===================================================================================
// PAGE — Configurateur interactif (îlot React hydraté : data-block="vm-configurator")
// ===================================================================================
const configBlocks: PageBlock[] = [
  block('hero', { eyebrow: 'Script · Outil', title: 'Configurateur — VM serveur', subtitle: 'Renseigne les champs : le script PowerShell de mise en service est généré automatiquement.' }),
  block('html', { html: '<p>Cet outil construit le <strong>script de mise en service d’une VM serveur</strong> à partir de tes choix : <strong>ressources</strong> (vCPU/RAM), <strong>clonage</strong> (VM source, dossiers d’export & de destination, <em>mémorisés dans le navigateur</em>), <strong>nom</strong> (convention <code>Client_xx</code> / <code>SRV_rôle_xx</code>), <strong>rôles</strong>, <strong>appartenance</strong> (domaine ou groupe de travail) et <strong>réseau</strong>. La VM est <strong>clonée</strong> par <em>Export-VM / Import-VM</em> (base : <em>New-VMClone.ps1</em>, F. Burnel — it-connect.fr), connectée au commutateur privé <code>COM_private</code> ; dans la VM, des <strong>règles de pare-feu personnalisées</strong> autorisent le <strong>ping</strong> et la <strong>passerelle</strong> est déduite (réseau en <code>.254</code>). Le script est fourni en <strong>2 fenêtres</strong> : ① sur l’hôte, ② dans la VM.</p>' }),
  block('html', { html: '<div class="pb-dynamic" data-block="vm-configurator"></div>' }),
  note('blue', 'ℹ️ Comment l’utiliser', '<p>Le script a <strong>deux parties</strong> : la <strong>1</strong> s’exécute sur l’<strong>hôte Hyper-V</strong> (ressources + commutateur privé), la <strong>2</strong> <strong>dans la VM</strong> en PowerShell administrateur (IP, DNS, rôles, renommage). Pour la démarche complète, voir la procédure <a href="/pages/procedure-vm-hyperv">Créer & configurer une VM (ISO) sur Hyper-V</a>.</p>'),
];

// ===================================================================================
// PAGE — Diagnostic réseau OSI (îlot React : data-block="net-diagnostic")
// ===================================================================================
const netDiagBlocks: PageBlock[] = [
  block('hero', { eyebrow: 'Script · Dépannage', title: 'Diagnostic réseau (modèle OSI)', subtitle: 'Un dépannage méthodique, de la couche physique jusqu’aux accès, pour cerner la panne.' }),
  block('html', { html: '<p>Cet outil génère un <strong>script de diagnostic</strong> qui teste, <strong>couche par couche</strong> (du bas vers le haut du modèle <strong>OSI</strong>), les points essentiels : <strong>physique</strong> (carte réseau), <strong>commutateurs Hyper-V</strong> (chaque VM sur le bon switch), <strong>configuration IP</strong>, <strong>pare-feu</strong> (ping), <strong>connectivité</strong> (pings loopback / passerelle / DNS / cible), <strong>résolution DNS</strong>, <strong>protocoles standards</strong> (DNS, Kerberos, LDAP, SMB, RDP, HTTP/S… par leurs ports) et <strong>accès au partage</strong>. Chaque test affiche <span style="color:#16a34a;font-weight:700">[OK]</span> ou <span style="color:#dc2626;font-weight:700">[KO]</span> avec une <strong>piste de correction</strong>. Objectif : <strong>réduire le périmètre de la panne</strong> — et le résultat peut être <strong>entièrement positif</strong>.</p>' }),
  block('html', { html: '<div class="pb-dynamic" data-block="net-diagnostic"></div>' }),
  note('blue', 'ℹ️ Lecture du résultat', '<p>Le script <strong>ne modifie rien</strong> (lecture/tests seulement). Corrige toujours la <strong>première couche en échec</strong> en priorité : une panne basse (physique/IP) fait échouer tout ce qui est au-dessus. Pour les corrections : <a href="/pages/astuce-pare-feu-ping">autoriser le ping</a>, <a href="/pages/permissions-partage-ntfs">permissions Partage/NTFS</a>, <a href="/pages/hebergement-web">DNS/hébergement</a>.</p>'),
];

// ===================================================================================
// PAGE — Constructeur AD de masse (îlot React : data-block="ad-bulk-configurator")
// ===================================================================================
const adBulkBlocks: PageBlock[] = [
  block('hero', { eyebrow: 'Script · Active Directory', title: 'Constructeur AD (masse)', subtitle: 'Construire graphiquement UO, groupes et utilisateurs, puis générer le script de création en masse.' }),
  block('html', { html: '<p>Cet outil <strong>graphique</strong> te laisse définir ta structure Active Directory : <strong>unités d’organisation</strong> (imbriquables), <strong>groupes</strong> (avec <em>portée</em>, <em>type</em>, et surtout <strong>imbrication</strong> — un groupe membre d’un autre via menu déroulant à chips) et <strong>utilisateurs</strong>. Pour la <strong>création de masse</strong>, deux options : <strong>coller une liste « Prénom Nom »</strong>, ou <strong>importer un fichier CSV</strong> (un modèle conforme est téléchargeable en un clic). Les comptes sont générés (login automatique) avec UO et groupes, puis modifiables un par un. Le <strong>script PowerShell</strong> complet se met à jour en direct.</p>' }),
  block('html', { html: '<div class="pb-dynamic" data-block="ad-bulk-configurator"></div>' }),
  note('yellow', '⚠️ À exécuter sur le contrôleur de domaine', '<p>Le script (module <code>ActiveDirectory</code>) crée les objets dans l’ordre : UO → groupes → imbrication → utilisateurs → adhésions. Il demande le <strong>mot de passe initial</strong> à l’exécution et force son changement à la 1ʳᵉ connexion. Les créations sont <strong>idempotentes</strong> (elles vérifient l’existence avant de créer). <strong>Procédure manuelle (justification)</strong> : <a href="/pages/procedure-ad-objets">AD : UO, groupes & utilisateurs (unitaire & masse)</a>. Voir aussi : <a href="/pages/configurateur-ad">Configurateur AD (copie d’utilisateur)</a>, <a href="/pages/vocabulaire-active-directory">vocabulaire AD</a>.</p>'),
];

// ===================================================================================
// PAGE — Générateur de routes statiques (îlot React : data-block="static-route-generator")
// ===================================================================================
const staticRouteBlocks: PageBlock[] = [
  block('hero', { eyebrow: 'Script · Cisco / Packet Tracer', title: 'Générateur — Routes statiques', subtitle: 'Décris ta topologie : les routes statiques de chaque routeur sont calculées automatiquement.' }),
  block('html', { html: '<p>Cet outil calcule les <strong>routes statiques</strong> (<code>ip route</code>) de <strong>plusieurs routeurs</strong>. Tu décris la <strong>topologie</strong> : les <strong>routeurs</strong>, les <strong>liaisons</strong> qui les relient (réseau + IP de chaque extrémité) et les <strong>LAN</strong> derrière chacun. Pour chaque routeur, l’outil génère les routes vers <strong>tous les réseaux non directement connectés</strong>, avec le <strong>prochain saut correct</strong> (calculé par plus court chemin). Route par défaut optionnelle par routeur.</p>' }),
  block('html', { html: '<div class="pb-dynamic" data-block="static-route-generator"></div>' }),
  note('blue', 'ℹ️ Comment l’utiliser', '<p>Configure d’abord les <strong>interfaces</strong> (IP + <code>no shutdown</code>) de chaque routeur avec le <a href="/pages/configurateur-routeur-cisco">configurateur routeur</a>, puis colle les routes statiques générées ici. Rappel : une route statique indique <em>« pour atteindre CE réseau, envoie au routeur suivant »</em>. <strong>Procédure manuelle (justification)</strong> : <a href="/pages/procedure-routes-statiques">Configurer les routes statiques (multi-routeurs)</a>. Cours : <a href="/pages/cisco-route-statique">Les routes statiques en CLI</a>.</p>'),
];

// ===================================================================================
// PAGE — Générateur DHCP routeur (îlot React : data-block="dhcp-configurator")
// ===================================================================================
const dhcpBlocks: PageBlock[] = [
  block('hero', { eyebrow: 'Script · Cisco / Packet Tracer', title: 'Générateur — DHCP routeur', subtitle: 'Décris tes étendues DHCP : la configuration CLI IOS est générée, prête à coller.' }),
  block('html', { html: '<p>Cet outil génère la <strong>configuration DHCP d’un routeur Cisco</strong> pour <strong>Packet Tracer</strong> : une ou plusieurs <strong>étendues (pools)</strong> avec <strong>réseau + masque</strong>, <strong>passerelle</strong> (<code>default-router</code>), <strong>DNS</strong>, <strong>domaine</strong> et <strong>bail</strong>, plus les <strong>adresses exclues</strong> (passerelle, serveurs, imprimantes). Colle le bloc dans la CLI du routeur.</p>' }),
  block('html', { html: '<div class="pb-dynamic" data-block="dhcp-configurator"></div>' }),
  note('blue', 'ℹ️ Comment l’utiliser', '<p>Ouvre l’onglet <strong>CLI</strong> du routeur et colle la configuration. Rappel : <strong>exclus toujours la passerelle et les IP fixes</strong> de la distribution. Si le routeur n’est pas sur le réseau des clients, ajoute <code>ip helper-address</code> sur l’interface côté clients (relais DHCP). Procédure complète : <a href="/pages/procedure-dhcp-packet-tracer">Configurer un serveur DHCP sur Packet Tracer</a>.</p>'),
];

// ===================================================================================
// PAGE — Outil de segmentation réseau (îlot React : data-block="subnet-planner")
// ===================================================================================
const segBlocks: PageBlock[] = [
  block('hero', { eyebrow: 'Outil · Réseau', title: 'Segmentation réseau (VLSM / FLSM)', subtitle: 'Découpe un réseau en sous-réseaux et obtiens le plan d’adressage complet, automatiquement.' }),
  block('html', { html: '<p>Cet outil calcule ton <strong>plan d’adressage</strong>. Renseigne le <strong>réseau de base</strong> (IP + CIDR), puis :</p><ul><li><strong>VLSM</strong> — saisis le <strong>besoin en hôtes</strong> de chaque service : l’outil attribue à chacun le plus petit bloc suffisant, dans le bon ordre (du plus grand au plus petit), sans chevauchement ;</li><li><strong>FLSM</strong> — indique un <strong>nombre de sous-réseaux</strong> égaux à obtenir.</li></ul><p>Pour chaque sous-réseau : <strong>adresse réseau</strong>, <strong>plage utilisable</strong>, <strong>broadcast</strong>, <strong>masque</strong>, <strong>passerelle</strong> (1re ou dernière IP, au choix) et <strong>nombre d’hôtes</strong>. Le plan est copiable.</p>' }),
  block('html', { html: '<div class="pb-dynamic" data-block="subnet-planner"></div>' }),
  note('blue', 'ℹ️ Pour comprendre le calcul', '<p>La méthode pas-à-pas (nombre magique) et un exerciseur : <a href="/pages/trouver-plage-ip-cidr">Trouver une plage d’IP (IP + CIDR)</a>. La procédure de conception : <a href="/pages/procedure-plan-adressage">Plan d’adressage (VLSM)</a>. Cours : <a href="/pages/segmentation-sous-reseaux">La segmentation (subnetting)</a>.</p>'),
];

// ===================================================================================
// PAGE — Configurateur routeur Cisco (îlot React : data-block="router-configurator")
// ===================================================================================
const routerBlocks: PageBlock[] = [
  block('hero', { eyebrow: 'Script · Cisco / Packet Tracer', title: 'Configurateur — Routeur Cisco', subtitle: 'Renseigne les interfaces et les routes : la configuration CLI IOS est générée, prête à coller.' }),
  block('html', { html: '<p>Cet outil construit la <strong>configuration CLI (Cisco IOS)</strong> d’un routeur pour <strong>Packet Tracer</strong> : <strong>hostname</strong>, <strong>interfaces</strong> (adresse IP fixe + masque, <em>description</em>, activation <code>no shutdown</code>, et <code>clock rate</code> côté <strong>DCE</strong> pour les liaisons série), <strong>routes statiques</strong> (y compris une <strong>route par défaut</strong>) et <strong>NAT / PAT</strong> : désignation des interfaces <code>inside</code>/<code>outside</code>, <strong>PAT (overload)</strong> avec ACL des réseaux internes, <strong>NAT statique 1:1</strong> et <strong>redirection de port</strong> (publier un service interne). Colle le bloc généré dans la CLI du routeur (mode <code>enable</code>).</p>' }),
  block('html', { html: '<div class="pb-dynamic" data-block="router-configurator"></div>' }),
  note('blue', 'ℹ️ Comment l’utiliser', '<p>Dans Packet Tracer, ouvre l’onglet <strong>CLI</strong> du routeur, puis <strong>colle</strong> la configuration (elle démarre par <code>enable</code> puis <code>configure terminal</code>). Rappel : sur une liaison <strong>série</strong>, seul le côté <strong>DCE</strong> impose le <code>clock rate</code>. <strong>Procédure manuelle (justification)</strong> : <a href="/pages/procedure-cisco-routeur-cli">Configurer un routeur Cisco en CLI</a>. Cours liés : <a href="/pages/cisco-routeur-cli">Configurer un routeur en CLI</a> et <a href="/pages/cisco-route-statique">Les routes statiques en CLI</a>.</p>'),
];

// ===================================================================================
// PAGE — Constructeur AGDLP (îlot React : data-block="agdlp-builder")
// ===================================================================================
const agdlpBlocks: PageBlock[] = [
  block('hero', { eyebrow: 'Script · Active Directory', title: 'Constructeur AGDLP', subtitle: 'Des services, des dossiers et des utilisateurs → toute la structure AGDLP générée, en un minimum de temps.' }),
  block('html', { html: '<p>Cet outil <strong>tout-en-un</strong> applique la stratégie <strong>AGDLP</strong> (<em>Account → Global → Domain Local → Permission</em>) sans erreur de convention. Tu définis tes <strong>services</strong> (métiers), tes <strong>ressources</strong> (dossiers) avec <strong>qui a quel droit</strong>, et tes <strong>utilisateurs</strong> ; l’outil génère automatiquement : les <strong>UO</strong>, les <strong>groupes Globaux</strong> (<code>G_&lt;service&gt;</code>), les <strong>groupes Domaine Local</strong> (<code>DL_&lt;ressource&gt;_&lt;droit&gt;</code>), l’<strong>imbrication</strong> G→DL, les <strong>comptes</strong> (login <code>prénom.nom</code>, placés dans la bonne OU et le bon Global) et les <strong>partages + permissions NTFS</strong> posées sur les groupes DL. Tu obtiens aussi l’<strong>arborescence des UO</strong> et l’<strong>arborescence des droits NTFS</strong> en aperçu, plus <strong>2 scripts</strong> : ① sur le contrôleur de domaine, ② sur le serveur de fichiers.</p>' }),
  block('html', { html: '<div class="pb-dynamic" data-block="agdlp-builder"></div>' }),
  note('yellow', '⚠️ Ordre & exécution', '<p>Exécute d’abord le script <strong>① sur le contrôleur de domaine</strong> (module <code>ActiveDirectory</code> : OU, groupes, imbrication, utilisateurs — il demande le mot de passe initial), puis le script <strong>② sur le serveur de fichiers</strong> (dossiers, partages, <code>icacls</code>). Les créations sont <strong>idempotentes</strong>. Le partage reste large : c’est le <strong>NTFS sur les groupes DL</strong> qui filtre réellement. Méthode graphique équivalente : <a href="/pages/procedure-agdlp">Mettre en place AGDLP</a>.</p>'),
];

// ===================================================================================
// PAGE — Configurateur Active Directory (îlot React : data-block="ad-configurator")
// ===================================================================================
const adBlocks: PageBlock[] = [
  block('hero', { eyebrow: 'Script · Active Directory', title: 'Configurateur — Active Directory', subtitle: 'Crée une UO, copie un utilisateur modèle et désactive le compte source.' }),
  block('html', { html: '<p>Cet outil génère un script <strong>PowerShell (module ActiveDirectory)</strong> à exécuter <strong>sur le contrôleur de domaine</strong>. Il enchaîne : <strong>① création d’une unité d’organisation</strong>, <strong>② copie d’un utilisateur modèle</strong> (ex. <code>administrateur</code> → <em>Jean NGUYEN</em>, <code>jean.nguyen@domaine</code>, avec reprise des groupes) et <strong>③ désactivation du compte source</strong>. Le mot de passe est demandé à l’exécution (jamais écrit dans le script).</p>' }),
  block('html', { html: '<div class="pb-dynamic" data-block="ad-configurator"></div>' }),
  note('yellow', '⚠️ Avant de désactiver l’administrateur', '<p>Assure-toi de disposer d’un <strong>autre compte administrateur du domaine fonctionnel</strong> avant de désactiver <code>administrateur</code>, sous peine de perdre l’accès d’administration. <strong>Procédure manuelle (justification)</strong> : <a href="/pages/procedure-ad-objets">AD : UO, groupes & utilisateurs</a>. Voir aussi la procédure <a href="/pages/procedure-installation-active-directory">Installer & configurer Active Directory</a> et le <a href="/pages/vocabulaire-active-directory">vocabulaire AD</a>.</p>'),
];

// ===================================================================================
// PAGE — Entraînement Réalisation 1 (îlot React : data-block="realisation1-trainer")
// ===================================================================================
const r1Blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Entraînement · Réalisation Windows', title: 'Entraînement — Réalisation 1 Windows', subtitle: 'Refais la réalisation en aveugle : l’outil corrige chaque étape et te donne un score.' }),
  block('html', { html: '<p>Cet outil te fait <strong>rejouer la Réalisation 1 Windows</strong> (contexte Engineer Aero) de A à Z, sans regarder le corrigé. Tu <strong>saisis toi-même</strong> : les <strong>noms des 3 machines</strong>, leurs <strong>IP fixes</strong>, le <strong>masque</strong> et le <strong>DNS</strong>, la <strong>zone DNS</strong> et ses <strong>enregistrements</strong>, les <strong>deux sites IIS</strong> (nom d’hôte + port), l’<strong>étendue DHCP</strong> (plage de 25 + réservation) et l’<strong>IP de la carte vEthernet</strong> de l’hôte. À chaque étape, clique sur <strong>« Vérifier »</strong> : l’outil coche les bonnes réponses, signale les erreurs avec la <strong>valeur attendue</strong> et met à jour ton <strong>score</strong>. Un bouton <em>« Voir le corrigé »</em> reste dispo par étape si tu bloques.</p>' }),
  note('yellow', '⚠️ Rappels du sujet', '<p>Réseau <strong>interne isolé</strong> <code>192.168.10.0/24</code> — <strong>pas de passerelle</strong>, <strong>pas d’Active Directory</strong>. Le <strong>domaine reprend ton prénom</strong> (technicien) : <code>engineer&lt;prénom&gt;.lan</code>. Commence par renseigner ton prénom en haut de l’outil.</p>'),
  block('heading', { level: 2, text: '🖱️ Simulateur de parcours (bureau Windows / Hyper-V)' }),
  block('html', { html: '<p>Avant de remplir les fenêtres, entraîne-toi au <strong>chemin pour y arriver</strong> — là où ça manque souvent de pratique. Ce simulateur reproduit le <strong>bureau Windows Server</strong> (barre des tâches, menu Démarrer, Gestionnaire de serveur, consoles) : choisis un <strong>objectif</strong>, puis clique de menu en menu jusqu’à la bonne fenêtre (bouton <strong>💡 Indice</strong> si tu bloques). Parcours couverts : <strong>IP fixe</strong> (icône réseau → Connexions réseau → clic droit Ethernet → Propriétés → TCP/IPv4), <strong>Hyper-V</strong> (commutateur virtuel + paramètres VM), <strong>renommage du poste</strong> (Ce PC → Propriétés → Propriétés système → Modifier, avec la zone domaine/groupe de travail prête pour Active Directory), <strong>installation des rôles</strong> (Gérer → Ajouter des rôles : DNS, DHCP, IIS, AD DS) puis leur <strong>utilisation</strong> — Gestionnaire <strong>DNS</strong> (zone + enregistrements A + alias CNAME), console <strong>DHCP</strong> (étendue de 25 adresses + réservation) et <strong>IIS</strong> (2 sites : Présentation:80 et intranet:8080). Enfin <strong>Active Directory</strong> : promouvoir le serveur en <strong>contrôleur de domaine</strong> (nouvelle forêt), <strong>joindre le poste au domaine</strong>, créer une <strong>OU + un utilisateur</strong> (console Utilisateurs et ordinateurs AD) et une <strong>GPO</strong> liée à l’OU (Gestion des stratégies de groupe). 12 objectifs, avec indice du prochain clic à chaque étape.</p>' }),
  block('html', { html: '<div class="pb-dynamic" data-block="windows-sim"></div>' }),

  block('heading', { level: 2, text: '⌨️ Entraînement — saisie directe des fenêtres' }),
  block('html', { html: '<p>Ici, les fenêtres sont ouvertes directement : concentre-toi sur les <strong>valeurs à saisir</strong> (IP, DNS, zone, sites IIS, étendue DHCP…). L’outil valide chaque étape et donne un score.</p>' }),
  block('html', { html: '<div class="pb-dynamic" data-block="realisation1-trainer"></div>' }),
  note('blue', 'ℹ️ Pour réviser avant / après', '<p>Le corrigé complet illustré : <a href="/pages/correction-realisation-1-windows">Réalisation 1 Windows — Correction</a>. Procédures liées : <a href="/pages/procedure-dns">DNS (zones & enregistrements)</a> · <a href="/pages/procedure-iis">IIS (héberger un site)</a> · <a href="/pages/procedure-dhcp">DHCP (étendue & réservation)</a> · <a href="/pages/procedure-vm-hyperv">Créer une VM Hyper-V</a> · <a href="/pages/trouver-plage-ip-cidr">Trouver une plage d’IP</a>.</p>'),
];

// ===================================================================================
// PAGE — Émulateur d'invite de commandes (îlot React : data-block="cmd-emulator")
// ===================================================================================
const cmdBlocks: PageBlock[] = [
  block('hero', { eyebrow: 'Outil · Réseau / CLI', title: 'Émulateur d’invite de commandes', subtitle: 'Un vrai terminal cmd simulé, avec un état machine qui change quand tu tapes tes commandes.' }),
  block('html', { html: '<p>Ce <strong>bac à sable</strong> reproduit l’<strong>invite de commandes Windows</strong> avec un <strong>état machine modifiable et persisté</strong> : tu poses une IP avec <code>netsh interface ip set address</code>, et <code>ipconfig</code> l’affiche ; tu configures le DNS, et <code>nslookup</code> s’en sert ; <code>ping</code> répond selon ton <strong>sous-réseau</strong> et la <strong>table d’hôtes</strong> (éditable). Il gère aussi un <strong>système de fichiers virtuel</strong> (<code>dir</code>, <code>cd</code>, <code>md</code>, <code>type</code>, <code>echo &gt; fichier</code>, <code>tree</code>), les <strong>variables d’environnement</strong> (<code>set</code>, <code>%COMPUTERNAME%</code>), le <strong>pare-feu</strong> (<code>netsh advfirewall</code>) et un <strong>serveur DHCP simulé</strong> (bail via <code>ipconfig /renew</code>). Idéal pour t’entraîner aux manipulations en ligne de commande de tes prochaines configurations. <strong>cmd prioritaire</strong> (netsh, ipconfig, ping, nslookup, arp, route, netstat, net, netdom…), avec les équivalents <strong>PowerShell</strong> (autorisé) : <code>New-NetIPAddress</code>, <code>Set-DnsClientServerAddress</code>, <code>Rename-Computer</code>, <code>Test-NetConnection</code>, <code>Resolve-DnsName</code>…</p>' }),
  note('blue', '⌨️ Pour commencer', '<ul><li>Tape <code>help</code> pour la liste des commandes. <kbd>Tab</kbd> = auto-complétion, <kbd>↑</kbd>/<kbd>↓</kbd> = historique, <kbd>Ctrl+L</kbd> = effacer.</li><li>Essaie : <code>ipconfig</code> → <code>netsh interface ip set address "Ethernet" static 192.168.10.101 255.255.255.0 192.168.10.254</code> → <code>ipconfig</code> à nouveau.</li><li><code>netsh interface ip set dns "Ethernet" static 192.168.10.250</code> puis <code>nslookup srv-dhcp</code> et <code>ping srv-dns</code>.</li><li>Fichiers : <code>cd Documents</code> → <code>type notes.txt</code> ; <code>echo test &gt; a.txt</code> → <code>type a.txt</code>.</li><li>L’état (config, fichiers, hôtes) est <strong>sauvegardé</strong> dans le navigateur — bouton « Réinitialiser » pour repartir à zéro.</li></ul>'),
  block('html', { html: '<div class="pb-dynamic" data-block="cmd-emulator"></div>' }),
  note('green', '🔗 Procédures liées', '<p><a href="/pages/procedure-ip-fixe-windows">Configurer une IP fixe (Windows)</a> · <a href="/pages/procedure-test-connectivite">Test de connectivité méthodique</a> · <a href="/pages/procedure-renommer-poste">Renommer un poste</a> · <a href="/pages/cmd-et-powershell">Invite de commandes & PowerShell</a>.</p>'),
];

// ===================================================================================
// EXÉCUTION
// ===================================================================================
function cookieFrom(res: Response): string {
  const sc = (res.headers as any).getSetCookie?.() as string[] | undefined;
  return (sc && sc.length ? sc : [res.headers.get('set-cookie') || '']).map(c => c.split(';')[0]).filter(Boolean).join('; ');
}
async function upsertPage(h: Record<string, string>, cookie: string, existing: Array<{ id: number; slug: string }>, slug: string, title: string, excerpt: string, blocks: PageBlock[]) {
  const cur = existing.find(e => e.slug === slug);
  const body = JSON.stringify({ title, slug, excerpt, content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1 });
  const res = cur
    ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body })
    : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log(`PAGE ${slug}`, res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());
}
async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: PW }) });
  if (!login.ok) throw new Error(`login ${login.status}`);
  const cookie = cookieFrom(login);
  const h = { 'Content-Type': 'application/json', Cookie: cookie };
  const existing = await (await fetch(`${BASE}/api/admin/pages`, { headers: { Cookie: cookie } })).json() as Array<{ id: number; slug: string }>;

  await upsertPage(h, cookie, existing, 'diagnostic-reseau', 'Diagnostic réseau (modèle OSI)',
    'Outil de dépannage interactif : saisir le contexte réseau (IP, passerelle, DNS, cible, port, partage) et générer un script PowerShell qui teste couche par couche (modèle OSI) pour réduire le périmètre de la panne.', netDiagBlocks);
  await upsertPage(h, cookie, existing, 'constructeur-ad', 'Constructeur AD (masse)',
    'Constructeur AD graphique : définir UO, groupes (imbriqués) et utilisateurs, créer des comptes en masse (collage de liste) et générer le script PowerShell complet (module ActiveDirectory).', adBulkBlocks);
  await upsertPage(h, cookie, existing, 'generateur-routes-statiques', 'Générateur — Routes statiques multi-routeurs (CLI)',
    'Générateur de routes statiques Cisco : décrire la topologie (routeurs, liaisons, LAN) → calcul automatique des routes ip route de chaque routeur avec le bon prochain saut (plus court chemin).', staticRouteBlocks);
  await upsertPage(h, cookie, existing, 'configurateur-dhcp-cisco', 'Générateur — DHCP routeur (Packet Tracer)',
    'Générateur interactif de configuration DHCP pour routeur Cisco (Packet Tracer) : pools (réseau, passerelle, DNS, domaine, bail) et adresses exclues → configuration CLI IOS prête à coller.', dhcpBlocks);
  await upsertPage(h, cookie, existing, 'segmentation-reseau', 'Outil de segmentation réseau (VLSM / FLSM)',
    'Planificateur de sous-réseaux (subnetting) : à partir d’un réseau de base et des besoins en hôtes, calcule le plan d’adressage complet (adresse réseau, plage utilisable, broadcast, masque, passerelle, nombre d’hôtes). Modes VLSM et FLSM.', segBlocks);
  await upsertPage(h, cookie, existing, 'configurateur-routeur-cisco', 'Configurateur — Routeur Cisco (Packet Tracer)',
    'Configurateur interactif de routeur Cisco pour Packet Tracer : hostname, interfaces (IP fixe, activation, clock rate DCE) et routes statiques → configuration CLI IOS prête à coller.', routerBlocks);
  await upsertPage(h, cookie, existing, 'constructeur-agdlp', 'Constructeur AGDLP',
    'Outil tout-en-un AGDLP : services, dossiers + besoins d’accès et utilisateurs → génère UO, groupes Globaux/Domaine Local (convention G_/DL_), imbrication, comptes et partages NTFS. Arborescence UO + NTFS et 2 scripts PowerShell (DC + serveur de fichiers).', agdlpBlocks);
  await upsertPage(h, cookie, existing, 'configurateur-ad', 'Configurateur — Active Directory',
    'Configurateur interactif Active Directory : crée une UO, copie un utilisateur modèle (administrateur → Jean NGUYEN) et désactive le compte source. Génère le script PowerShell prêt à copier.', adBlocks);
  await upsertPage(h, cookie, existing, 'configurateur-vm', 'Configurateur — VM serveur',
    'Configurateur interactif : génère le script PowerShell de mise en service d’une VM serveur (vCPU/RAM, rôles, IP/masque/passerelle .254/DNS, nom Client_xx / SRV_rôle_xx, commutateur privé COM_private).', configBlocks);
  await upsertPage(h, cookie, existing, 'emulateur-invite-commandes', 'Émulateur d’invite de commandes (bac à sable)',
    'Terminal cmd Windows simulé avec état machine modifiable : netsh, ipconfig, ping, nslookup, hostname, arp et équivalents PowerShell (New-NetIPAddress, Set-DnsClientServerAddress, Test-NetConnection). La configuration change réellement et ping/nslookup répondent selon le sous-réseau et une table d’hôtes éditable.', cmdBlocks);
  await upsertPage(h, cookie, existing, 'entrainement-realisation-1', 'Entraînement — Réalisation 1 Windows',
    'Entraînement auto-corrigé de la Réalisation 1 Windows : saisir noms de machines, IP fixes, masque, DNS, zone + enregistrements, sites IIS, étendue DHCP et IP hôte Hyper-V ; l’outil valide chaque étape, signale les erreurs (valeur attendue) et donne un score.', r1Blocks);
  await upsertPage(h, cookie, existing, 'script-config-vm', 'Configuration standard d’une VM',
    'Script PowerShell : renommer le PC (Client_xx / SRV_rôle_xx) et configurer l’IP fixe (IP, masque, passerelle .254, DNS) sur le commutateur privé COM_private.', ficheBlocks);
  await upsertPage(h, cookie, existing, 'scripts', 'Outils',
    'Annuaire d’outils interactifs et de scripts prêts à l’emploi (générateurs Cisco/AD, PowerShell, Hyper-V, réseau).', dirBlocks);

  // Entrée de menu « Outils » (renomme l’ancienne « Scripts » si présente, sinon crée — URL conservée)
  const menus = await (await fetch(`${BASE}/api/admin/menus`, { headers: { Cookie: cookie } })).json() as Array<{ id: number; label: string; url: string; sort_order?: number }>;
  const existingMenu = menus.find(m => m.url === '/pages/scripts' || m.label === 'Scripts' || m.label === 'Outils');
  if (existingMenu) {
    const r = await fetch(`${BASE}/api/admin/menus/${existingMenu.id}`, { method: 'PUT', headers: h, body: JSON.stringify({ label: 'Outils', url: '/pages/scripts', sort_order: existingMenu.sort_order ?? 5 }) });
    console.log('MENU Outils', r.status, r.ok ? '(renommé)' : await r.text());
  } else {
    const r = await fetch(`${BASE}/api/admin/menus`, { method: 'POST', headers: h, body: JSON.stringify({ label: 'Outils', url: '/pages/scripts', sort_order: 5 }) });
    console.log('MENU Outils', r.status, r.ok ? '(ajouté)' : await r.text());
  }

  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

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
type Script = { slug: string; icon: string; title: string; desc: string; tags: string[] };
const SCRIPTS: Script[] = [
  {
    slug: 'configurateur-vm', icon: '🧰',
    title: 'Configurateur — VM serveur',
    desc: 'Outil interactif : clone une VM source (Export/Import), applique ressources, réseau, pare-feu (ping), rôles, nom et domaine/groupe de travail → script PowerShell en 2 parties, prêt à copier.',
    tags: ['Interactif', 'PowerShell', 'Hyper-V', 'Clone'],
  },
  {
    slug: 'diagnostic-reseau', icon: '🩺',
    title: 'Diagnostic réseau (modèle OSI)',
    desc: 'Outil de dépannage : saisis ton contexte (IP, passerelle, DNS, cible, port, partage) → script PowerShell qui teste couche par couche et réduit le périmètre de la panne.',
    tags: ['Interactif', 'PowerShell', 'Réseau', 'Dépannage'],
  },
  {
    slug: 'constructeur-ad', icon: '🏗️',
    title: 'Constructeur AD (masse)',
    desc: 'Outil graphique : définir UO / groupes (imbriqués) / utilisateurs, créer des comptes en masse (collage de liste) → script PowerShell complet.',
    tags: ['Interactif', 'PowerShell', 'Active Directory', 'Masse'],
  },
  {
    slug: 'configurateur-ad', icon: '🏢',
    title: 'Configurateur — Active Directory',
    desc: 'Outil interactif : crée une UO, copie un utilisateur modèle (ex. administrateur → Jean NGUYEN) et désactive le compte source → script PowerShell prêt à copier.',
    tags: ['Interactif', 'PowerShell', 'Active Directory'],
  },
  {
    slug: 'script-config-vm', icon: '🖥️',
    title: 'Configuration standard d’une VM',
    desc: 'Renomme le PC (Client_xx / SRV_rôle_xx), applique l’IP fixe (IP, masque, passerelle .254, DNS) et rappelle le commutateur privé COM_private.',
    tags: ['PowerShell', 'Hyper-V', 'Réseau'],
  },
];

// ===================================================================================
// Page ANNUAIRE — cartes horizontales, pagination CSS 20 par page (sans JS)
// ===================================================================================
const PER_PAGE = 20;
function chunk<T>(arr: T[], n: number): T[][] { const out: T[][] = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; }
function pill(t: string) { return `<span style="display:inline-block;font-size:10.5px;font-weight:600;color:var(--text-muted);background:var(--surface-3);border:1px solid var(--border);border-radius:999px;padding:1px 9px;margin:4px 4px 0 0">${t}</span>`; }
function card(s: Script) {
  return `<a class="script-card" href="/pages/${s.slug}">`
    + `<div class="sc-ico">${s.icon}</div>`
    + `<div class="sc-body"><div class="sc-title">${s.title}</div><div class="sc-desc meta">${s.desc}</div><div>${s.tags.map(pill).join('')}</div></div>`
    + `<div class="sc-go">Voir →</div></a>`;
}
function buildDirectory(scripts: Script[]): string {
  const pages = chunk(scripts, PER_PAGE);
  const radios = pages.map((_, i) => `<input class="sp-radio" type="radio" name="sp" id="sp-${i + 1}"${i === 0 ? ' checked' : ''}>`).join('');
  let css = `.scripts-dir{position:relative}`
    + `.scripts-dir input.sp-radio{position:absolute;width:0;height:0;opacity:0;pointer-events:none}`
    + `.scripts-dir .sp-page{display:none}`
    + `.script-card{display:flex;gap:14px;align-items:center;padding:14px 16px;border:1px solid var(--border);border-radius:12px;background:var(--surface);text-decoration:none;margin:10px 0;transition:border-color .15s,transform .15s}`
    + `.script-card:hover{border-color:var(--accent);transform:translateY(-1px)}`
    + `.script-card .sc-ico{font-size:30px;line-height:1}`
    + `.script-card .sc-body{flex:1;min-width:0}`
    + `.script-card .sc-title{font-weight:700;font-size:15px;color:var(--text)}`
    + `.script-card .sc-desc{font-size:13px;margin-top:2px}`
    + `.script-card .sc-go{color:var(--accent);font-weight:700;white-space:nowrap}`
    + `.scripts-dir .sp-pager{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:14px}`
    + `.scripts-dir .sp-pager label{cursor:pointer;border:1px solid var(--border);border-radius:8px;padding:4px 11px;font-size:13px;font-weight:600;color:var(--text-soft)}`;
  pages.forEach((_, i) => { css += `#sp-${i + 1}:checked~.sp-pages .sp-page-${i + 1}{display:block}`; });
  pages.forEach((_, i) => { css += `#sp-${i + 1}:checked~.sp-pager label[for="sp-${i + 1}"]{background:var(--accent);color:#fff;border-color:var(--accent)}`; });
  const body = `<div class="sp-pages">${pages.map((pg, i) => `<div class="sp-page sp-page-${i + 1}">${pg.map(card).join('')}</div>`).join('')}</div>`;
  const pager = pages.length > 1 ? `<div class="sp-pager">${pages.map((_, i) => `<label for="sp-${i + 1}">${i + 1}</label>`).join('')}</div>` : '';
  return `<div class="scripts-dir"><style>${css}</style>${radios}${body}${pager}</div>`;
}

const dirBlocks: PageBlock[] = [
  block('hero', { eyebrow: 'TSSR', title: 'Scripts', subtitle: 'Annuaire de scripts prêts à l’emploi pour automatiser les tâches courantes.' }),
  block('html', { html: `<p class="meta">${SCRIPTS.length} script(s) · affichés par pages de ${PER_PAGE}. Clique sur une carte pour ouvrir la fiche (script + explications).</p>` }),
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
  block('html', { html: '<p>Cet outil génère un <strong>script de diagnostic</strong> qui teste, <strong>couche par couche</strong> (du bas vers le haut du modèle <strong>OSI</strong>), les points essentiels : <strong>physique</strong> (carte réseau), <strong>configuration IP</strong>, <strong>pare-feu</strong> (ping), <strong>connectivité</strong> (pings loopback / passerelle / DNS / cible), <strong>résolution DNS</strong>, <strong>service/port</strong> et <strong>accès au partage</strong>. Chaque test affiche <span style="color:#16a34a;font-weight:700">[OK]</span> ou <span style="color:#dc2626;font-weight:700">[KO]</span> avec une <strong>piste de correction</strong>. Objectif : <strong>réduire le périmètre de la panne</strong> — et le résultat peut être <strong>entièrement positif</strong>.</p>' }),
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
  note('yellow', '⚠️ À exécuter sur le contrôleur de domaine', '<p>Le script (module <code>ActiveDirectory</code>) crée les objets dans l’ordre : UO → groupes → imbrication → utilisateurs → adhésions. Il demande le <strong>mot de passe initial</strong> à l’exécution et force son changement à la 1ʳᵉ connexion. Les créations sont <strong>idempotentes</strong> (elles vérifient l’existence avant de créer). Voir aussi : <a href="/pages/configurateur-ad">Configurateur AD (copie d’utilisateur)</a>, <a href="/pages/vocabulaire-active-directory">vocabulaire AD</a>.</p>'),
];

// ===================================================================================
// PAGE — Configurateur Active Directory (îlot React : data-block="ad-configurator")
// ===================================================================================
const adBlocks: PageBlock[] = [
  block('hero', { eyebrow: 'Script · Active Directory', title: 'Configurateur — Active Directory', subtitle: 'Crée une UO, copie un utilisateur modèle et désactive le compte source.' }),
  block('html', { html: '<p>Cet outil génère un script <strong>PowerShell (module ActiveDirectory)</strong> à exécuter <strong>sur le contrôleur de domaine</strong>. Il enchaîne : <strong>① création d’une unité d’organisation</strong>, <strong>② copie d’un utilisateur modèle</strong> (ex. <code>administrateur</code> → <em>Jean NGUYEN</em>, <code>jean.nguyen@domaine</code>, avec reprise des groupes) et <strong>③ désactivation du compte source</strong>. Le mot de passe est demandé à l’exécution (jamais écrit dans le script).</p>' }),
  block('html', { html: '<div class="pb-dynamic" data-block="ad-configurator"></div>' }),
  note('yellow', '⚠️ Avant de désactiver l’administrateur', '<p>Assure-toi de disposer d’un <strong>autre compte administrateur du domaine fonctionnel</strong> avant de désactiver <code>administrateur</code>, sous peine de perdre l’accès d’administration. Voir aussi la procédure <a href="/pages/procedure-installation-active-directory">Installer & configurer Active Directory</a> et le <a href="/pages/vocabulaire-active-directory">vocabulaire AD</a>.</p>'),
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
  await upsertPage(h, cookie, existing, 'configurateur-ad', 'Configurateur — Active Directory',
    'Configurateur interactif Active Directory : crée une UO, copie un utilisateur modèle (administrateur → Jean NGUYEN) et désactive le compte source. Génère le script PowerShell prêt à copier.', adBlocks);
  await upsertPage(h, cookie, existing, 'configurateur-vm', 'Configurateur — VM serveur',
    'Configurateur interactif : génère le script PowerShell de mise en service d’une VM serveur (vCPU/RAM, rôles, IP/masque/passerelle .254/DNS, nom Client_xx / SRV_rôle_xx, commutateur privé COM_private).', configBlocks);
  await upsertPage(h, cookie, existing, 'script-config-vm', 'Configuration standard d’une VM',
    'Script PowerShell : renommer le PC (Client_xx / SRV_rôle_xx) et configurer l’IP fixe (IP, masque, passerelle .254, DNS) sur le commutateur privé COM_private.', ficheBlocks);
  await upsertPage(h, cookie, existing, 'scripts', 'Scripts',
    'Annuaire de scripts prêts à l’emploi (PowerShell, Hyper-V, réseau).', dirBlocks);

  // Entrée de menu « Scripts » (idempotent)
  const menus = await (await fetch(`${BASE}/api/admin/menus`, { headers: { Cookie: cookie } })).json() as Array<{ id: number; label: string; url: string }>;
  if (!menus.some(m => m.url === '/pages/scripts' || m.label === 'Scripts')) {
    const r = await fetch(`${BASE}/api/admin/menus`, { method: 'POST', headers: h, body: JSON.stringify({ label: 'Scripts', url: '/pages/scripts', sort_order: 5 }) });
    console.log('MENU Scripts', r.status, r.ok ? '(ajouté)' : await r.text());
  } else console.log('MENU Scripts déjà présent');

  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

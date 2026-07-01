/* Cours « Gestionnaire de serveurs Windows » : 1 page-hub + 5 pages procédurales.
   Rôles (CRUD), Fonctionnalités, Arrêter/redémarrer un service, Client Telnet, Lister les fonctionnalités.
   Reconstruit aussi le hub Cours (4 colonnes — source de vérité ici).
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-server-manager.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const accordion = (it: Array<[string, string]>) => block('accordion', { items: it.map(([title, text]) => ({ title, text, href: '' })) });
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const ul = (items: string[]) => `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
const ol = (items: string[]) => `<ol>${items.map(i => `<li>${i}</li>`).join('')}</ol>`;
const code = (lines: string[]) => `<pre style="background:var(--surface-2);border:1px solid var(--border);padding:10px 12px;border-radius:8px;overflow:auto;font-size:13px;line-height:1.5;margin:8px 0"><code>${lines.join('\n')}</code></pre>`;
const back = () => block('html', { html: '<p class="meta">← <a href="/pages/gestionnaire-de-serveurs">Retour au gestionnaire de serveurs</a></p>' });
// « Capture décrite » : un encadré qui décrit ce que l'on voit à l'écran (à défaut d'image).
const screen = (html: string) => `<aside class="pb-note pb-note-gray"><p class="pb-note-title">🖼️ À l’écran</p>${html}</aside>`;

// ===== Schémas SVG (inline, CSP-safe) =====
const K = { sm: '#2563eb', role: '#059669', feat: '#7c3aed', svc: '#d97706', grey: '#64748b', ok: '#16a34a' };
function boxR(x: number, y: number, w: number, h: number, fill: string, label: string, sub = ''): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}"/>`
    + `<text x="${x + w / 2}" y="${y + (sub ? h / 2 - 1 : h / 2 + 4)}" text-anchor="middle" font-size="13" fill="#fff" font-weight="bold">${label}</text>`
    + (sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 14}" text-anchor="middle" font-size="10" fill="#e5e7eb">${sub}</text>` : '');
}
const defs = '<defs><marker id="ar" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8"/></marker></defs>';
const arrow = (x1: number, y1: number, x2: number, y2: number) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#94a3b8" stroke-width="2.5" marker-end="url(#ar)"/>`;
const wrapS = (w: number, h: number, inner: string) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="max-width:${w}px;width:100%;height:auto;margin:6px 0 12px;font-family:system-ui,sans-serif">${defs}${inner}</svg>`;

// Hub : Gestionnaire de serveurs → Rôles / Fonctionnalités / Services
const svgHub = wrapS(420, 180,
  boxR(140, 8, 140, 40, K.sm, 'Gestionnaire', 'de serveurs')
  + arrow(180, 48, 70, 96) + arrow(210, 48, 210, 96) + arrow(240, 48, 350, 96)
  + boxR(20, 98, 110, 44, K.role, 'Rôles', 'services rendus')
  + boxR(150, 98, 120, 44, K.feat, 'Fonctionnalités', 'outils d’appoint')
  + boxR(290, 98, 110, 44, K.svc, 'Services', 'arrière-plan')
  + `<text x="210" y="170" text-anchor="middle" font-size="11" fill="#64748b">Un point d’entrée unique pour administrer le serveur</text>`);

// Flux assistant horizontal
function flow(steps: string[]): string {
  const bw = 96, bh = 46, gap = 26, x0 = 8, y = 16;
  let s = '';
  steps.forEach((st, i) => {
    const x = x0 + i * (bw + gap);
    s += boxR(x, y, bw, bh, i === steps.length - 1 ? K.ok : K.sm, `${i + 1}`, st);
    if (i < steps.length - 1) s += arrow(x + bw, y + bh / 2, x + bw + gap, y + bh / 2);
  });
  const W = x0 + steps.length * (bw + gap) - gap + 8;
  return wrapS(W, y + bh + 14, s);
}

type Page = { slug: string; title: string; excerpt: string; blocks: PageBlock[] };
const EB = 'Cours · Software · Windows Server';

const PAGES: Page[] = [
  // ---------- HUB ----------
  {
    slug: 'gestionnaire-de-serveurs', title: 'Le gestionnaire de serveurs Windows', excerpt: 'La console centrale d’administration de Windows Server : rôles, fonctionnalités et services.',
    blocks: [
      block('hero', { eyebrow: 'Cours · Software', title: 'Le gestionnaire de serveurs Windows', subtitle: 'La console qui pilote tout : ajouter des rôles, des fonctionnalités et gérer les services.' }),
      block('html', { html: '<p>Le <strong>Gestionnaire de serveur</strong> (<em>Server Manager</em>) est la <strong>console centrale</strong> de Windows Server. Il s’ouvre <strong>automatiquement à l’ouverture de session</strong> (sinon : menu Démarrer → « Gestionnaire de serveur », ou <code>servermanager.exe</code>). Depuis son tableau de bord, on installe des rôles et des fonctionnalités, on <strong>supervise l’état</strong> des serveurs et on accède à tous les <strong>outils</strong> d’administration.</p>' }),
      note('blue', '🔎 Analogie', '<p>C’est le <strong>cockpit</strong> du serveur : un seul tableau de bord d’où l’on voit tous les voyants et d’où l’on actionne les commandes, plutôt que de courir d’un équipement à l’autre.</p>'),
      block('heading', { level: 2, text: 'Ce qu’on y administre' }),
      block('html', { html: svgHub }),
      block('html', { html: `<p>Tout part de l’assistant <strong>« Ajouter des rôles et fonctionnalités »</strong> (menu <em>Gérer</em>) : il sert aussi bien à installer un <strong>rôle</strong> (service rendu aux autres machines) qu’une <strong>fonctionnalité</strong> (outil d’appoint).</p>` }),
      block('heading', { level: 2, text: 'Ouvrir le gestionnaire de serveur' }),
      block('html', { html: ul([
        '<strong>Automatiquement</strong> : il se lance à chaque ouverture de session (on peut le désactiver via <em>Gérer → Propriétés du Gestionnaire de serveur</em>).',
        '<strong>Menu Démarrer</strong> → « Gestionnaire de serveur ».',
        '<strong>Exécuter</strong> (<kbd>Win</kbd>+<kbd>R</kbd>) → <code>servermanager.exe</code>.',
      ]) }),
      block('heading', { level: 2, text: 'Le tableau de bord, zone par zone' }),
      block('html', { html: screen(ul([
        '<strong>En haut</strong> : la barre de menus <em>Gérer</em>, <em>Outils</em>, <em>Afficher</em>, <em>Aide</em>, et le <strong>drapeau de notifications</strong> 🚩 (progression des installations, redémarrages en attente).',
        '<strong>À gauche</strong> : <em>Tableau de bord</em>, <em>Serveur local</em>, <em>Tous les serveurs</em>, puis <strong>une entrée par rôle installé</strong> (AD DS, DNS, IIS…).',
        '<strong>Au centre</strong> : les <strong>vignettes par rôle/groupe</strong>, avec un bandeau <span style="color:#16a34a">vert</span> si tout va bien ou <span style="color:#dc2626">rouge</span> en cas d’alerte (service arrêté, événement critique).',
      ])) }),
      accordion([
        ['🖥️ « Serveur local » vs « Tous les serveurs »', '<p><strong>Serveur local</strong> affiche les propriétés de la machine courante (nom, domaine, pare-feu, IP, mises à jour…). <strong>Tous les serveurs</strong> regroupe <strong>plusieurs serveurs</strong> que l’on administre depuis une seule console.</p>'],
        ['➕ Ajouter des serveurs à gérer (pool)', `<p>Le Gestionnaire de serveur peut piloter <strong>d’autres serveurs à distance</strong>. Via <em>Gérer → Ajouter des serveurs</em>, on recherche les machines (par Active Directory, DNS ou import). On administre alors tout le parc depuis un poste unique.</p>${code(['# Gérer un serveur distant en PowerShell', 'Install-WindowsFeature -Name DNS -ComputerName SRV-02'])}`],
        ['🧰 Le menu « Outils »', '<p>Le menu <strong>Outils</strong> est le raccourci vers <strong>toutes les consoles MMC</strong> : Utilisateurs et ordinateurs Active Directory, DNS, DHCP, <strong>Services</strong> (services.msc), Observateur d’événements, Planificateur de tâches, Pare-feu… C’est souvent par là qu’on configure un rôle après l’avoir installé.</p>'],
        ['🚩 Le drapeau de notifications', '<p>L’icône drapeau signale les <strong>tâches en cours</strong> (installation d’un rôle) et les <strong>actions requises</strong> (« Configuration post-déploiement requise », redémarrage en attente). Un clic ouvre le détail et les liens d’action.</p>'],
        ['⚙️ Alternatives modernes', '<p><strong>Windows Admin Center</strong> est l’outil web moderne qui complète (voire remplace) le Gestionnaire de serveur pour l’administration à distance. Et tout se pilote aussi en <strong>PowerShell</strong> (<code>Get-WindowsFeature</code>, <code>Install-WindowsFeature</code>…), pratique pour automatiser et pour les serveurs <strong>Core</strong> (sans interface graphique).</p>'],
      ]),
      block('heading', { level: 2, text: 'Les fiches pratiques' }),
      block('button', { label: '⊕ Créer un rôle, un serveur, une fonctionnalité', href: '/pages/serveur-creer' }),
      block('button', { label: '① Gérer les rôles (CRUD)', href: '/pages/serveur-roles' }),
      block('button', { label: '② Gérer les fonctionnalités', href: '/pages/serveur-fonctionnalites' }),
      block('button', { label: '③ Arrêter & redémarrer un service', href: '/pages/serveur-gerer-service' }),
      block('button', { label: '④ Installer le Client Telnet', href: '/pages/serveur-client-telnet', variant: 'secondary' }),
      block('button', { label: '⑤ Lister les fonctionnalités installées', href: '/pages/serveur-lister-fonctionnalites', variant: 'secondary' }),
      note('green', '💡 À retenir', '<p>Le Gestionnaire de serveur centralise l’administration. Pour les <strong>concepts</strong> (rôle vs fonctionnalité, DNS, DHCP, AD…), voir le cours <a href="/pages/windows-server">Windows Server</a>. Sigles dans le <a href="/glossaire">Glossaire</a>.</p>'),
    ],
  },
  // ---------- 0. CRÉER (rôle / serveur / fonctionnalité) ----------
  {
    slug: 'serveur-creer', title: 'Créer un rôle, un serveur, une fonctionnalité', excerpt: 'Les trois actions de création dans le Gestionnaire de serveur : ajouter un serveur à gérer, un rôle, une fonctionnalité.',
    blocks: [
      block('hero', { eyebrow: EB, title: 'Créer un rôle, un serveur, une fonctionnalité', subtitle: 'Les trois ajouts de base dans le Gestionnaire de serveur, côte à côte.' }),
      block('html', { html: '<p>Dans le Gestionnaire de serveur, presque tout se crée depuis <strong>deux entrées du menu <em>Gérer</em></strong> : « <strong>Ajouter des serveurs</strong> » (pour gérer une machine) et « <strong>Ajouter des rôles et fonctionnalités</strong> » (le même assistant pour les deux). Cette fiche présente les <strong>trois créations</strong> les unes après les autres.</p>' }),
      note('blue', '🔎 « Créer un serveur » ?', '<p>On ne « fabrique » pas un serveur depuis cette console : on <strong>ajoute un serveur existant</strong> pour l’administrer (le mettre dans le pool). Créer une <strong>vraie nouvelle machine</strong>, c’est installer Windows Server (physique) ou créer une <strong>machine virtuelle</strong> sous <a href="/pages/roles-windows-server">Hyper-V</a>.</p>'),

      block('heading', { level: 2, text: '① Ajouter un serveur (à gérer)' }),
      block('html', { html: ol([
        'Gestionnaire de serveur → menu <strong>Gérer</strong> → <strong>Ajouter des serveurs</strong>.',
        'Choisir comment le trouver : <strong>Active Directory</strong>, <strong>DNS</strong> ou <strong>Importer</strong> (liste de noms).',
        'Rechercher, sélectionner le(s) serveur(s) → flèche → <strong>OK</strong>.',
        'Le serveur apparaît dans <strong>Tous les serveurs</strong> ; on peut le ranger dans un <strong>groupe de serveurs</strong> (<em>Gérer → Créer un groupe de serveurs</em>).',
      ]) }),
      block('html', { html: screen(ul([
        'Fenêtre « <strong>Ajouter des serveurs</strong> » avec 3 onglets : <em>Active Directory</em>, <em>DNS</em>, <em>Importer</em>.',
        'À droite, la zone <strong>Sélectionné</strong> liste les serveurs qu’on va ajouter au pool.',
      ])) }),
      note('yellow', '⚠️ Pré-requis', '<p>Gérer un serveur <strong>à distance</strong> suppose les bonnes permissions et le pare-feu/WinRM configuré (<code>Enable-PSRemoting</code> côté serveur cible).</p>'),

      block('heading', { level: 2, text: '② Ajouter un rôle' }),
      block('html', { html: flow(['Gérer', 'Type d’install.', 'Serveur', 'Cocher le rôle', 'Confirmer', 'Installer']) }),
      block('html', { html: ol([
        '<strong>Gérer</strong> → <strong>Ajouter des rôles et fonctionnalités</strong>.',
        'Type : <em>Installation basée sur un rôle ou une fonctionnalité</em> → choisir le serveur.',
        'Page <strong>Rôles</strong> : cocher le rôle (ex. <em>Serveur Web (IIS)</em>) → accepter l’ajout des outils → <strong>Installer</strong>.',
      ]) + code(['Install-WindowsFeature -Name Web-Server -IncludeManagementTools']) }),
      block('html', { html: '<p class="meta">Cycle de vie complet (vérifier, configurer, supprimer) : voir <a href="/pages/serveur-roles">Gérer les rôles (CRUD)</a>.</p>' }),

      block('heading', { level: 2, text: '③ Ajouter une fonctionnalité' }),
      block('html', { html: ol([
        'Même assistant <strong>Ajouter des rôles et fonctionnalités</strong>.',
        'Avancer jusqu’à la page <strong>Fonctionnalités</strong>.',
        'Cocher la fonctionnalité (ex. <em>Client Telnet</em>) → <strong>Installer</strong>.',
      ]) + code(['Install-WindowsFeature -Name Telnet-Client']) }),
      block('html', { html: '<p class="meta">Détails et exemples : voir <a href="/pages/serveur-fonctionnalites">Gérer les fonctionnalités</a> et <a href="/pages/serveur-client-telnet">Installer le Client Telnet</a>.</p>' }),

      note('blue', '🧩 Rôle ou fonctionnalité ?', '<p><strong>Rôle</strong> = service principal rendu au réseau (IIS, DNS, DHCP, AD…). <strong>Fonctionnalité</strong> = outil d’appoint (Telnet, BitLocker, Sauvegarde…). Les deux s’installent dans le <strong>même assistant</strong>, sur deux pages différentes.</p>'),
      note('green', '💡 À retenir', '<p>Tout part du menu <strong>Gérer</strong> : <strong>Ajouter des serveurs</strong> (gérer une machine) et <strong>Ajouter des rôles et fonctionnalités</strong> (rôle <em>ou</em> fonctionnalité). En PowerShell, un seul verbe : <code>Install-WindowsFeature</code>.</p>'),
      back(),
    ],
  },
  // ---------- 1. RÔLES (CRUD) ----------
  {
    slug: 'serveur-roles', title: 'Gérer les rôles (CRUD)', excerpt: 'Installer, vérifier, configurer et supprimer un rôle dans Windows Server (interface + PowerShell).',
    blocks: [
      block('hero', { eyebrow: EB, title: 'Gérer les rôles (CRUD)', subtitle: 'Créer, lire, mettre à jour et supprimer un rôle — au clic et en ligne de commande.' }),
      block('html', { html: '<p>Un <strong>rôle</strong> est la <strong>fonction principale</strong> qu’un serveur rend au réseau (serveur web IIS, DNS, DHCP, Active Directory…). On gère son cycle de vie via le <strong>Gestionnaire de serveur</strong>. Voici les 4 opérations « <strong>CRUD</strong> » appliquées aux rôles.</p>' }),
      block('heading', { level: 2, text: 'C — Créer (installer un rôle)' }),
      block('html', { html: flow(['Gérer', 'Type d’install.', 'Serveur', 'Cocher le rôle', 'Confirmer', 'Installer']) }),
      block('html', { html: ol([
        'Gestionnaire de serveur → menu <strong>Gérer</strong> → <strong>Ajouter des rôles et fonctionnalités</strong>.',
        'Page <em>Avant de commencer</em> (rappels) → <strong>Suivant</strong>.',
        'Type d’installation : <strong>Installation basée sur un rôle ou une fonctionnalité</strong>.',
        'Sélectionner le <strong>serveur</strong> de destination dans le pool.',
        'Page <strong>Rôles</strong> : cocher le rôle voulu (ex. <em>Serveur Web (IIS)</em>) → une fenêtre propose d’<strong>ajouter les outils de gestion</strong> → <em>Ajouter des fonctionnalités</em>.',
        '(Selon le rôle) choisir les <strong>services de rôle</strong> à inclure.',
        'Confirmer, puis <strong>Installer</strong>. Suivre la barre de progression.',
      ]) }),
      block('html', { html: screen(ul([
        'À l’étape <strong>Rôles de serveurs</strong>, une longue liste à cocher (AD DS, DNS, DHCP, Hyper-V, Serveur Web…).',
        'Quand on coche un rôle, une <strong>fenêtre surgit</strong> : « Ajouter les fonctionnalités requises pour <em>…</em> ? » — on accepte.',
        'La dernière page propose « <strong>Redémarrer automatiquement</strong> le serveur de destination si nécessaire » (à cocher si le rôle l’exige).',
      ])) }),
      block('html', { html: 'En PowerShell (admin) :' + code([
        '# Installer le rôle Serveur Web (IIS) + ses outils', 'Install-WindowsFeature -Name Web-Server -IncludeManagementTools',
        '', '# Un rôle qui demande un redémarrage (ex. Hyper-V)', 'Install-WindowsFeature -Name Hyper-V -IncludeManagementTools -Restart',
        '', '# Sur un serveur distant', 'Install-WindowsFeature -Name DNS -ComputerName SRV-02 -IncludeManagementTools',
      ]) }),
      note('blue', '🧩 Rôle, service de rôle, fonctionnalité', '<p>Un <strong>rôle</strong> peut contenir des <strong>services de rôle</strong> (sous-composants : ex. IIS → « Documents par défaut », « ASP.NET »…). À ne pas confondre avec les <strong>fonctionnalités</strong>, qui sont des outils d’appoint indépendants. Voir <a href="/pages/serveur-fonctionnalites">Gérer les fonctionnalités</a>.</p>'),
      block('heading', { level: 2, text: 'R — Lire (vérifier qu’il est installé)' }),
      block('html', { html: ul([
        'Le rôle apparaît dans le <strong>volet de gauche</strong> du Gestionnaire de serveur et sur le tableau de bord (une vignette dédiée).',
        'Ou via l’assistant : la case du rôle est <strong>cochée et grisée</strong>.',
      ]) + code([
        '# La colonne « Install State » indique Installed', 'Get-WindowsFeature -Name Web-Server',
        '', '# Tout ce qui est installé', 'Get-WindowsFeature | Where-Object Installed',
      ]) }),
      block('heading', { level: 2, text: 'U — Mettre à jour (configurer / ajouter des services de rôle)' }),
      block('html', { html: ul([
        'Un rôle se configure via sa <strong>console dédiée</strong>, accessible depuis le menu <strong>Outils</strong> (Gestionnaire IIS, DNS, DHCP, « Utilisateurs et ordinateurs Active Directory »…).',
        'Certains rôles demandent une <strong>configuration post-déploiement</strong> : le <strong>drapeau 🚩</strong> du Gestionnaire l’indique (ex. « Promouvoir ce serveur en contrôleur de domaine » après l’ajout d’AD DS).',
        'On peut <strong>ajouter des services de rôle</strong> en relançant l’assistant et en cochant les sous-composants manquants.',
      ]) }),
      block('heading', { level: 2, text: 'D — Supprimer (désinstaller un rôle)' }),
      block('html', { html: ol([
        'Menu <strong>Gérer</strong> → <strong>Supprimer des rôles et fonctionnalités</strong>.',
        'Sélectionner le serveur → page <strong>Rôles</strong> : <strong>décocher</strong> le rôle à retirer.',
        'Confirmer la suppression des fonctionnalités associées → <strong>Supprimer</strong>.',
        'Un <strong>redémarrage</strong> peut être demandé pour finaliser.',
      ]) + code(['# Désinstaller le rôle (et redémarrer si besoin)', 'Uninstall-WindowsFeature -Name Web-Server -Restart']) }),
      note('yellow', '⚠️ Avant de désinstaller', '<p>Désinstaller un rôle peut <strong>casser des services dépendants</strong> (ex. retirer AD DS d’un contrôleur de domaine en production). Vérifie l’impact, préviens, et fais-le hors période critique.</p>'),
      block('heading', { level: 2, text: 'Les rôles les plus courants' }),
      block('html', { html: '<table class="wp-list"><thead><tr><th>Rôle</th><th>Nom PowerShell</th><th>À quoi ça sert</th></tr></thead><tbody>'
        + '<tr><td>AD DS</td><td><code>AD-Domain-Services</code></td><td>Annuaire / domaine</td></tr>'
        + '<tr><td>DNS</td><td><code>DNS</code></td><td>Noms ↔ adresses IP</td></tr>'
        + '<tr><td>DHCP</td><td><code>DHCP</code></td><td>Distribution d’IP</td></tr>'
        + '<tr><td>Serveur Web (IIS)</td><td><code>Web-Server</code></td><td>Sites & applis web</td></tr>'
        + '<tr><td>Hyper-V</td><td><code>Hyper-V</code></td><td>Virtualisation</td></tr>'
        + '<tr><td>Serveur de fichiers</td><td><code>FS-FileServer</code></td><td>Partage de fichiers</td></tr>'
        + '</tbody></table>' }),
      note('green', '💡 À retenir', '<p>Rôles = <strong>Gérer → Ajouter / Supprimer des rôles et fonctionnalités</strong>, ou <code>Install-WindowsFeature</code> / <code>Uninstall-WindowsFeature</code> (avec <code>-IncludeManagementTools</code>, <code>-Restart</code>, <code>-ComputerName</code>). Vérification : volet de gauche ou <code>Get-WindowsFeature</code>. Configuration : menu <strong>Outils</strong>. Pour le panorama des rôles, voir <a href="/pages/roles-windows-server">Les rôles de Windows Server</a>.</p>'),
      back(),
    ],
  },
  // ---------- 2. FONCTIONNALITÉS ----------
  {
    slug: 'serveur-fonctionnalites', title: 'Gérer les fonctionnalités', excerpt: 'Les fonctionnalités de Windows Server : installer, supprimer, exemples et différence avec un rôle.',
    blocks: [
      block('hero', { eyebrow: EB, title: 'Gérer les fonctionnalités', subtitle: 'Les composants d’appoint qui complètent le serveur ou un rôle.' }),
      block('html', { html: '<p>Une <strong>fonctionnalité</strong> est un <strong>composant d’appoint</strong> qui ajoute une capacité au serveur, sans être le « métier » principal de la machine. Elle s’installe avec <strong>le même assistant</strong> que les rôles, dans la page <strong>Fonctionnalités</strong>.</p>' }),
      note('blue', '🔎 Rôle ou fonctionnalité ?', '<p><strong>Rôle</strong> = service rendu aux autres machines (IIS, DNS, DHCP, AD). <strong>Fonctionnalité</strong> = outil complémentaire (Client Telnet, BitLocker, Sauvegarde…). Détails dans le cours <a href="/pages/windows-server">Windows Server</a>.</p>'),
      block('heading', { level: 2, text: 'Installer une fonctionnalité' }),
      block('html', { html: ol([
        'Gestionnaire de serveur → <strong>Gérer</strong> → <strong>Ajouter des rôles et fonctionnalités</strong>.',
        'Avancer (Type d’installation → Serveur → page <strong>Rôles</strong>) jusqu’à la page <strong>Fonctionnalités</strong>.',
        'Cocher la fonctionnalité voulue → <strong>Suivant</strong> → <strong>Installer</strong>.',
      ]) }),
      block('html', { html: screen(ul([
        'La page <strong>Fonctionnalités</strong> présente une liste à cocher, avec des éléments dépliables (ex. <em>.NET Framework 3.5</em>, <em>.NET Framework 4.x</em>).',
        'Certaines fonctionnalités déclenchent la fenêtre « <strong>Ajouter les fonctionnalités requises</strong> » (dépendances).',
        'Les éléments <strong>cochés et grisés</strong> sont déjà installés.',
      ])) + code(['# Exemple : installer une fonctionnalité', 'Install-WindowsFeature -Name Telnet-Client']) }),
      note('blue', '🌐 Cas du .NET Framework 3.5 (source requise)', `<p>Certaines fonctionnalités (comme <strong>.NET Framework 3.5</strong>) ne sont pas sur le disque par défaut (« <em>Features on Demand</em> ») : il faut indiquer la <strong>source</strong> (le dossier <code>sources\\sxs</code> de l’ISO de Windows).</p>${code(['Install-WindowsFeature -Name NET-Framework-Core \\', '  -Source D:\\sources\\sxs'])}`),
      block('heading', { level: 2, text: 'Supprimer une fonctionnalité' }),
      block('html', { html: ol([
        '<strong>Gérer</strong> → <strong>Supprimer des rôles et fonctionnalités</strong>.',
        'Décocher la fonctionnalité → <strong>Supprimer</strong>.',
      ]) + code([
        'Uninstall-WindowsFeature -Name Telnet-Client',
        '', '# Retirer aussi les fichiers du disque (libère de l’espace)', 'Uninstall-WindowsFeature -Name Telnet-Client -Remove',
      ]) }),
      block('heading', { level: 2, text: 'Quelques fonctionnalités courantes' }),
      block('html', { html: '<table class="wp-list"><thead><tr><th>Fonctionnalité</th><th>Nom PowerShell</th><th>À quoi ça sert</th></tr></thead><tbody>'
        + '<tr><td>Client Telnet</td><td><code>Telnet-Client</code></td><td>Tester l’ouverture d’un port (diagnostic)</td></tr>'
        + '<tr><td>BitLocker</td><td><code>BitLocker</code></td><td>Chiffrement de volume</td></tr>'
        + '<tr><td>Sauvegarde Windows Server</td><td><code>Windows-Server-Backup</code></td><td>Sauvegardes planifiées</td></tr>'
        + '<tr><td>.NET Framework 3.5</td><td><code>NET-Framework-Core</code></td><td>Socle d’anciennes applications</td></tr>'
        + '<tr><td>Basculement (cluster)</td><td><code>Failover-Clustering</code></td><td>Haute disponibilité</td></tr>'
        + '<tr><td>Déduplication des données</td><td><code>FS-Data-Deduplication</code></td><td>Économise l’espace disque</td></tr>'
        + '</tbody></table>' }),
      note('green', '💡 À retenir', '<p>Fonctionnalités = page <strong>Fonctionnalités</strong> du même assistant, ou <code>Install-WindowsFeature</code> / <code>Uninstall-WindowsFeature</code> (option <code>-Remove</code> pour effacer les fichiers, <code>-Source</code> pour les composants « à la demande »). Ce sont des <strong>outils d’appoint</strong>, pas le service principal du serveur. Exemple détaillé : <a href="/pages/serveur-client-telnet">Installer le Client Telnet</a>.</p>'),
      back(),
    ],
  },
  // ---------- 3. SERVICE ----------
  {
    slug: 'serveur-gerer-service', title: 'Arrêter & redémarrer un service', excerpt: 'Démarrer, arrêter et redémarrer un service Windows : console services.msc et ligne de commande.',
    blocks: [
      block('hero', { eyebrow: EB, title: 'Arrêter & redémarrer un service', subtitle: 'Piloter les programmes d’arrière-plan, à la console ou en ligne de commande.' }),
      block('html', { html: '<p>Un <strong>service</strong> est un programme qui tourne <strong>en arrière-plan</strong>. Après une modification de configuration, il faut souvent l’<strong>arrêter</strong> puis le <strong>redémarrer</strong> pour appliquer les changements. Plusieurs méthodes existent.</p>' }),
      block('heading', { level: 2, text: 'Méthode 1 — Console Services (graphique)' }),
      block('html', { html: ol([
        'Ouvrir <code>services.msc</code> (ou Gestionnaire de serveur → <em>Outils</em> → Services).',
        'Repérer le service dans la liste (ex. <em>World Wide Web Publishing Service</em> pour IIS).',
        '<strong>Clic droit</strong> → <strong>Arrêter</strong>, <strong>Démarrer</strong> ou <strong>Redémarrer</strong>.',
        'La colonne <strong>État</strong> indique « En cours d’exécution » ou « Arrêté ».',
      ]) }),
      block('heading', { level: 2, text: 'Méthode 2 — Gestionnaire de serveur' }),
      block('html', { html: '<p>Sur la page d’un rôle, la vignette <strong>Services</strong> liste les services associés : clic droit → <strong>Arrêter / Démarrer / Redémarrer</strong>.</p>' }),
      block('heading', { level: 2, text: 'Méthode 3 — Ligne de commande' }),
      block('html', { html: 'Invite de commandes (administrateur) :' + code(['net stop W3SVC      :: arrêter le service IIS', 'net start W3SVC     :: démarrer le service IIS', 'sc query W3SVC      :: voir son état']) }),
      block('html', { html: 'PowerShell (administrateur) :' + code(['Stop-Service  -Name W3SVC', 'Start-Service -Name W3SVC', 'Restart-Service -Name W3SVC   # arrêt + redémarrage', 'Get-Service   -Name W3SVC     # état']) }),
      block('html', { html: 'Cas particulier IIS — tout redémarrer d’un coup :' + code(['iisreset /restart', 'iisreset /stop', 'iisreset /start']) }),
      note('yellow', '⚠️ Attention aux dépendances', '<p>Certains services en font tourner d’autres. Arrêter un service « parent » peut <strong>arrêter ses dépendants</strong>. Windows prévient ; vérifie l’onglet <strong>Dépendances</strong> (propriétés du service) avant d’agir en production.</p>'),
      note('green', '💡 À retenir', '<p>Graphique : <code>services.msc</code> → clic droit. CLI : <code>net stop/start</code>, <code>Stop/Start/Restart-Service</code>, et <code>iisreset</code> pour IIS.</p>'),
      back(),
    ],
  },
  // ---------- 4. CLIENT TELNET ----------
  {
    slug: 'serveur-client-telnet', title: 'Installer le Client Telnet', excerpt: 'Installer la fonctionnalité Client Telnet sur Windows Server et tester une connexion sur un port.',
    blocks: [
      block('hero', { eyebrow: EB, title: 'Installer le Client Telnet', subtitle: 'Ajouter l’outil Telnet pour tester l’ouverture d’un port réseau.' }),
      block('html', { html: '<p>Le <strong>Client Telnet</strong> est une <strong>fonctionnalité</strong> en ligne de commande pratique pour <strong>tester si un port est ouvert</strong> sur une machine distante. Il n’est <strong>pas installé par défaut</strong> : voici comment l’ajouter.</p>' }),
      block('heading', { level: 2, text: 'Méthode graphique (assistant)' }),
      block('html', { html: flow(['Gérer', 'Type d’install.', 'Serveur', 'Fonctionnalités', 'Client Telnet', 'Installer']) }),
      block('html', { html: ol([
        'Gestionnaire de serveur → <strong>Gérer</strong> → <strong>Ajouter des rôles et fonctionnalités</strong>.',
        '<em>Installation basée sur un rôle ou une fonctionnalité</em> → sélectionner le serveur.',
        'Aller jusqu’à la page <strong>Fonctionnalités</strong>.',
        'Cocher <strong>Client Telnet</strong> → <strong>Suivant</strong> → <strong>Installer</strong>.',
      ]) }),
      block('heading', { level: 2, text: 'Méthode ligne de commande' }),
      block('html', { html: 'PowerShell (administrateur) :' + code(['Install-WindowsFeature -Name Telnet-Client']) + 'Ou avec DISM (valable aussi sur Windows 10/11) :' + code(['dism /online /Enable-Feature /FeatureName:TelnetClient']) }),
      block('heading', { level: 2, text: 'Tester la connexion' }),
      block('html', { html: 'Ouvrir une invite de commandes et tester un port (ex. le web sur 80) :' + code(['telnet 127.0.0.1 80', 'telnet www.exemple.com 443']) }),
      block('html', { html: '<p>Si l’écran devient <strong>noir / vide</strong>, la connexion a réussi → le <strong>port est ouvert</strong>. Un message d’<strong>échec</strong> signifie que le port est fermé ou filtré (pare-feu, service arrêté).</p>' }),
      note('yellow', '⚠️ Telnet n’est pas sécurisé', '<p>Telnet transmet tout <strong>en clair</strong> (non chiffré). On l’utilise <strong>uniquement pour du diagnostic</strong> (tester un port), jamais pour administrer une machine à distance — pour ça, on utilise <strong>SSH</strong>.</p>'),
      note('green', '💡 À retenir', '<p>Client Telnet = fonctionnalité (page Fonctionnalités, ou <code>Install-WindowsFeature -Name Telnet-Client</code>). Usage : <code>telnet &lt;hôte&gt; &lt;port&gt;</code> pour vérifier qu’un port répond.</p>'),
      back(),
    ],
  },
  // ---------- 5. LISTER LES FONCTIONNALITÉS ----------
  {
    slug: 'serveur-lister-fonctionnalites', title: 'Lister les fonctionnalités installées', excerpt: 'Afficher la liste des rôles et fonctionnalités installés sur Windows Server (GUI, PowerShell, DISM).',
    blocks: [
      block('hero', { eyebrow: EB, title: 'Lister les fonctionnalités installées', subtitle: 'Vérifier d’un coup d’œil ce qui est installé sur le serveur.' }),
      block('html', { html: '<p>Après une installation, on veut <strong>vérifier</strong> que le rôle ou la fonctionnalité apparaît bien dans la liste des composants installés. Trois façons de faire.</p>' }),
      block('heading', { level: 2, text: 'Méthode graphique' }),
      block('html', { html: ul([
        'Gestionnaire de serveur → <strong>Tableau de bord</strong> ou page <strong>Tous les serveurs</strong> → vignette <strong>Rôles et fonctionnalités</strong> : la liste de l’installé s’affiche.',
        'Ou via l’assistant <em>Ajouter des rôles et fonctionnalités</em> : les éléments déjà installés sont <strong>cochés et grisés</strong>.',
      ]) }),
      block('heading', { level: 2, text: 'Méthode PowerShell' }),
      block('html', { html: code([
        '# Tout voir (colonne Install State = Installed / Available)',
        'Get-WindowsFeature',
        '',
        '# Uniquement ce qui est installé',
        'Get-WindowsFeature | Where-Object Installed',
        '',
        '# Vérifier un composant précis',
        'Get-WindowsFeature -Name Telnet-Client',
      ]) }),
      block('heading', { level: 2, text: 'Méthode DISM' }),
      block('html', { html: 'Fonctionne aussi sur Windows 10/11 :' + code(['dism /online /get-features /format:table']) }),
      note('green', '💡 À retenir', '<p>Liste de l’installé : Gestionnaire de serveur (vignette Rôles et fonctionnalités), <code>Get-WindowsFeature | Where-Object Installed</code>, ou <code>dism /online /get-features</code>. Une case <strong>cochée et grisée</strong> dans l’assistant = déjà installé.</p>'),
      back(),
    ],
  },
];

// ===== HUB « Cours » — 4 colonnes (source de vérité) =====
const HARDWARE: Array<[string, string]> = [
  ['/pages/hardware', 'Le hardware'],
  ['/pages/les-form-factor', 'Les form factors'],
  ['/pages/ports-arriere-carte-mere', 'Les ports arrière de la carte-mère'],
  ['/pages/carte-mere', 'La carte-mère — connectique interne'],
  ['/pages/le-chipset', 'Le chipset'],
  ['/pages/le-processeur', 'Le processeur (CPU)'],
  ['/pages/le-raid', 'Les niveaux de RAID'],
];
const SOFTWARE: Array<[string, string]> = [
  ['/pages/le-systeme-exploitation', 'Le système d’exploitation'],
  ['/pages/demarrage-bios-uefi', 'Le démarrage : BIOS & UEFI'],
  ['/pages/systemes-de-fichiers', 'Les systèmes de fichiers'],
  ['/pages/gestion-ordinateur-windows', 'La gestion de l’ordinateur'],
  ['/pages/base-de-registre', 'La base de registre'],
  ['/pages/windows-server', 'Windows Server'],
  ['/pages/gestionnaire-de-serveurs', 'Le gestionnaire de serveurs'],
];
const RESEAU: Array<[string, string]> = [
  ['/pages/le-routeur', 'Le routeur'],
  ['/pages/le-switch', 'Le switch'],
  ['/pages/le-pare-feu', 'Le pare-feu'],
];
const MAINTENANCE: Array<[string, string]> = [
  ['/pages/les-7-couches-osi', 'Les 7 couches OSI'],
  ['/pages/le-ticketing', 'Le ticketing'],
];
const col = (icon: string, name: string, sub: string, links: Array<[string, string]>): PageBlock[] => [
  block('heading', { level: 2, text: `${icon} ${name}` }),
  block('html', { html: `<p class="meta">${sub}</p>` }),
  ...links.map(([href, label], i) => block('button', { label, href, variant: i < 4 ? 'primary' : 'secondary' })),
];
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
    console.log(`PAGE ${p.slug}`.padEnd(44), res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());
  }

  const cours = existing.find(e => e.slug === 'cours');
  if (cours) {
    const res = await fetch(`${BASE}/api/admin/pages/${cours.id}`, { method: 'PUT', headers: h, body: JSON.stringify({ title: 'Cours', slug: 'cours', content: renderPageBlocksToHtml(hubBlocks), builder_json: serializePageBlocks(hubBlocks), published: 1 }) });
    console.log('HUB Cours', res.status, res.ok ? '(maj)' : await res.text());
  }
  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

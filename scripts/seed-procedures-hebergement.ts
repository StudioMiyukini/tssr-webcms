/* Lot de procédures « à suivre » pour la Réalisation « Hébergement » (site accessible le jour J) :
   - procedure-hyperv-ressources : fonctionnement Hyper-V + attribuer des ressources à une VM
   - procedure-gestion-disques   : gestion des disques & partitionnement (diskmgmt / diskpart)
   - procedure-dhcp              : rôle DHCP, étendue, options (003/006/015), réservation MAC
   - procedure-dns               : rôle DNS, zones directe/inversée, enregistrements A/CNAME/PTR
   - procedure-iis               : héberger un site web (IIS) + liaison DNS + NTFS + pare-feu
   Garde-fou transversal : NOMMAGE des machines (convention) + passerelle .254 + cmd (pas de PowerShell).
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-procedures-hebergement.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const stepsStyle = block('html', { html: `<style>.proc-steps{padding-left:22px;line-height:1.75}.proc-steps>li{margin:7px 0}.proc-steps code,.proc-steps kbd{font-family:ui-monospace,'Space Mono',monospace}.proc-steps kbd{border:1px solid var(--border);border-radius:5px;padding:1px 6px;background:var(--surface-2)}.proc-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto}.ref-table td{padding:7px 10px;border:1px solid var(--border)}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="proc-cmd">${t}</div>` });
const nameGuard = note('yellow', '🏷️ Nommage des machines', '<p>Respecte la <strong>convention de nommage</strong> du sujet (préfixe par rôle + n° : <code>SRV-HYPV01</code>, <code>SRV-AD01</code>, <code>SRV-WEB01</code>, <code>PC-CLIENT01</code>…). À faire <strong>avant</strong> toute jointure au domaine. Voir <a href="/procedure-renommer-poste">Renommer un poste</a>.</p>');

type Page = { slug: string; title: string; excerpt: string; blocks: PageBlock[] };

// ===================================================================================
// 1) HYPER-V : FONCTIONNEMENT + ATTRIBUER DES RESSOURCES
// ===================================================================================
const hyperv: Page = {
  slug: 'procedure-hyperv-ressources',
  title: 'Hyper-V : fonctionnement & attribution de ressources',
  excerpt: 'Comprendre Hyper-V (hyperviseur type 1, VM, commutateur virtuel, VHDX) et attribuer processeur, mémoire, disque et réseau à une VM.',
  blocks: [
    block('hero', { eyebrow: 'Procédure · Hébergement', title: 'Hyper-V : fonctionnement & ressources', subtitle: 'Le rôle de virtualisation de Windows Server, et comment doser les ressources d’une VM.' }),
    stepsStyle,
    block('heading', { level: 2, text: '🧠 Comment ça marche' }),
    block('html', { html: `<ul>
      <li><strong>Hyper-V</strong> = hyperviseur <strong>type 1 (bare metal)</strong> : il s’installe comme un <strong>rôle</strong> de Windows Server, directement au-dessus du matériel.</li>
      <li>Une <strong>VM</strong> (machine virtuelle) est une machine complète isolée, avec son propre OS.</li>
      <li>Le <strong>commutateur virtuel</strong> relie les VM au réseau : <strong>externe</strong> (accès au réseau physique), <strong>interne</strong> (VM ↔ hôte), <strong>privé</strong> (VM ↔ VM uniquement, ex. <code>COM_private</code>).</li>
      <li>Le disque d’une VM est un fichier <strong>VHDX</strong> : <strong>dynamique</strong> (grossit à l’usage) ou <strong>fixe</strong> (taille réservée, plus performant).</li>
      <li>Les <strong>points de contrôle</strong> (snapshots) figent l’état d’une VM pour y revenir.</li>
    </ul>` }),
    block('heading', { level: 2, text: '⚙️ Attribuer des ressources (VM éteinte)' }),
    block('html', { html: `<ol class="proc-steps">
      <li>Ouvre le <strong>Gestionnaire Hyper-V</strong> → sélectionne la VM → <strong>Paramètres…</strong> (VM <strong>arrêtée</strong> pour changer CPU/RAM).</li>
      <li><strong>Processeur</strong> : règle le <em>nombre de processeurs virtuels</em> (sans dépasser les cœurs physiques).</li>
      <li><strong>Mémoire</strong> : quantité de RAM. <em>Mémoire dynamique</em> (min/max) pour économiser, ou <em>statique</em> pour un serveur sensible (AD/DNS).</li>
      <li><strong>Disque</strong> : contrôleur <em>SCSI</em> → <strong>Disque dur</strong> → <strong>Ajouter</strong> → créer un <strong>VHDX</strong> (dynamique conseillé) → taille.</li>
      <li><strong>Carte réseau</strong> : connecte-la au bon <strong>commutateur virtuel</strong> (ex. <code>COM_private</code> ou externe selon le besoin).</li>
      <li>Option : <strong>démarrage automatique</strong> / actions à l’arrêt, ordre de démarrage (BIOS/firmware).</li>
      <li><strong>Appliquer</strong> → démarre la VM.</li>
    </ol>` }),
    nameGuard,
    note('green', '🔗 Enchaînement', '<p><a href="/procedure-vm-hyperv">Créer & configurer une VM (ISO)</a> pour la création · <a href="/procedure-gestion-disques">Gestion des disques</a> pour partitionner le VHDX ajouté · <a href="/virtualisation">La virtualisation avec Hyper-V</a> (cours).</p>'),
  ],
};

// ===================================================================================
// 2) GESTION DES DISQUES & PARTITIONNEMENT
// ===================================================================================
const disques: Page = {
  slug: 'procedure-gestion-disques',
  title: 'Gestion des disques & partitionnement',
  excerpt: 'Initialiser (MBR/GPT), partitionner, formater NTFS et affecter une lettre à un disque sous Windows : console diskmgmt et diskpart.',
  blocks: [
    block('hero', { eyebrow: 'Procédure · Hébergement', title: 'Gestion des disques & partitionnement', subtitle: 'Rendre utilisable un disque ajouté : initialiser, partitionner, formater NTFS.' }),
    stepsStyle,
    note('blue', 'ℹ️ Le contexte', '<p>Après avoir ajouté un <strong>VHDX</strong> à la VM (voir <a href="/procedure-hyperv-ressources">Hyper-V</a>), le disque apparaît <strong>non initialisé</strong> dans l’OS : il faut l’<strong>initialiser</strong>, le <strong>partitionner</strong> et le <strong>formater</strong> avant de pouvoir écrire dessus.</p>'),
    block('heading', { level: 2, text: '🖱️ Méthode graphique (diskmgmt)' }),
    block('html', { html: `<ol class="proc-steps">
      <li><kbd>Win</kbd>+<kbd>R</kbd> → <code>diskmgmt.msc</code> → <kbd>Entrée</kbd> (Gestion des disques).</li>
      <li>Le nouveau disque est <em>Inconnu / Non initialisé</em> → <strong>clic droit</strong> dessus → <strong>Initialiser le disque</strong> → choisis <strong>GPT</strong> (moderne, &gt; 2 To, UEFI) ou <strong>MBR</strong> (legacy, ≤ 2 To).</li>
      <li>Sur l’<strong>espace non alloué</strong> → clic droit → <strong>Nouveau volume simple</strong>.</li>
      <li>Assistant : <strong>taille</strong> de la partition → <strong>lettre</strong> de lecteur → <strong>Formater</strong> en <strong>NTFS</strong> + <em>nom de volume</em> (ex. <code>DATA</code>) → <strong>Terminer</strong>.</li>
      <li>Besoin d’agrandir/réduire ? Clic droit sur le volume → <strong>Étendre</strong> / <strong>Réduire</strong> (l’espace libre doit être <strong>contigu</strong>).</li>
    </ol>` }),
    block('heading', { level: 2, text: '⌨️ Méthode diskpart (cmd admin)' }),
    cmd('diskpart\nlist disk\nselect disk 1\nonline disk                (si le disque est hors ligne)\nattributes disk clear readonly\nconvert gpt                (ou : convert mbr)\ncreate partition primary\nformat fs=ntfs quick label="DATA"\nassign letter=E\nexit'),
    block('html', { html: `<div style="overflow-x:auto;margin:10px 0"><table style="border-collapse:collapse;width:100%;min-width:460px;font-size:13.5px" class="ref-table"><thead><tr style="background:var(--surface-2)"><th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">Table</th><th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">Quand l’utiliser</th></tr></thead><tbody><tr><td><strong>MBR</strong></td><td>Disques ≤ 2 To, compatibilité ancienne (BIOS legacy).</td></tr><tr><td><strong>GPT</strong></td><td>Disques &gt; 2 To, démarrage UEFI, &gt; 4 partitions. À privilégier aujourd’hui.</td></tr></tbody></table></div>` }),
    note('yellow', '⚠️ Attention', '<p>Le <strong>formatage efface les données</strong>. Vérifie bien le <strong>numéro de disque</strong> (<code>select disk N</code>) avant toute action dans diskpart : une erreur de disque est irréversible.</p>'),
  ],
};

// ===================================================================================
// 3) DHCP : ÉTENDUE, OPTIONS, RÉSERVATION
// ===================================================================================
const dhcp: Page = {
  slug: 'procedure-dhcp',
  title: 'DHCP : étendue, options & réservation',
  excerpt: 'Installer le rôle DHCP, créer une étendue, configurer les options (routeur 003, DNS 006, domaine 015) et une réservation par adresse MAC.',
  blocks: [
    block('hero', { eyebrow: 'Procédure · Hébergement', title: 'DHCP : étendue, options & réservation', subtitle: 'Distribuer automatiquement les IP, avec les bonnes options et des réservations fixes.' }),
    stepsStyle,
    block('heading', { level: 2, text: '① Installer le rôle DHCP' }),
    block('html', { html: `<ol class="proc-steps">
      <li><strong>Gestionnaire de serveur</strong> → <em>Gérer</em> → <strong>Ajouter des rôles et fonctionnalités</strong> → coche <strong>Serveur DHCP</strong> → installer.</li>
      <li>À la fin, <strong>terminer la configuration post-déploiement</strong> : création des groupes de sécurité et, si domaine, <strong>autoriser</strong> le serveur DHCP dans Active Directory.</li>
    </ol>` }),
    block('heading', { level: 2, text: '② Créer l’étendue (plage d’adresses)' }),
    block('html', { html: `<ol class="proc-steps">
      <li>Ouvre la console <strong>DHCP</strong> (<code>dhcpmgmt.msc</code>) → développe le serveur → <strong>IPv4</strong>.</li>
      <li>Clic droit <strong>IPv4</strong> → <strong>Nouvelle étendue</strong> → nom de l’étendue.</li>
      <li><strong>Plage de distribution</strong> : ex. <code>192.168.10.100</code> → <code>192.168.10.200</code>, masque <code>/24</code>.</li>
      <li><strong>Exclusions</strong> : exclus les adresses fixes (serveurs, imprimantes) et la <strong>passerelle <code>.254</code></strong>.</li>
      <li><strong>Durée du bail</strong> (par défaut 8 jours) → continue.</li>
    </ol>` }),
    block('heading', { level: 2, text: '③ Configurer les options' }),
    block('html', { html: `<div style="overflow-x:auto;margin:8px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:520px;font-size:13.5px" class="ref-table"><thead><tr style="background:var(--surface-2)">${['Option', 'Rôle', 'Valeur typique'].map(h => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${h}</th>`).join('')}</tr></thead><tbody>`
      + [
        ['003 — Routeur', 'Passerelle par défaut', '192.168.10.254'],
        ['006 — Serveurs DNS', 'Résolution de noms', 'IP du contrôleur de domaine'],
        ['015 — Nom de domaine DNS', 'Suffixe du domaine', 'domaine.local'],
      ].map(r => `<tr><td style="font-weight:600">${r[0]}</td><td>${r[1]}</td><td style="font-family:ui-monospace,'Space Mono',monospace">${r[2]}</td></tr>`).join('')
      + `</tbody></table></div>` }),
    block('html', { html: '<p>Renseigne ces options dans l’assistant (ou plus tard via <em>Options d’étendue</em>), puis <strong>Activer l’étendue</strong>.</p>' }),
    block('heading', { level: 2, text: '④ Créer une réservation (IP fixe par MAC)' }),
    block('html', { html: `<ol class="proc-steps">
      <li>Sur le client, récupère l’<strong>adresse MAC</strong> : <code>ipconfig /all</code> → « Adresse physique ».</li>
      <li>Console DHCP → développe l’étendue → <strong>Réservations</strong> → clic droit → <strong>Nouvelle réservation</strong>.</li>
      <li>Saisis : <strong>nom</strong>, <strong>adresse IP réservée</strong>, <strong>adresse MAC</strong> du client → <strong>Ajouter</strong>.</li>
      <li>Côté client, force le renouvellement : <code>ipconfig /release</code> puis <code>ipconfig /renew</code>.</li>
    </ol>` }),
    cmd('REM Vérification côté client\nipconfig /release\nipconfig /renew\nipconfig /all'),
    note('yellow', '⚠️ Pièges', '<ul><li><strong>Exclure la passerelle et les IP serveurs</strong> de la plage, sinon conflit d’adresses.</li><li>La réservation doit être <strong>dans l’étendue</strong> (mais peut être dans la zone d’exclusion : elle a priorité).</li><li>Sans <strong>autorisation AD</strong>, un DHCP en domaine ne distribue pas.</li></ul>'),
    note('purple', '🔁 Basculement DHCP (redondance)', '<p>Pour rendre le DHCP <strong>redondant</strong> entre deux serveurs, suis la procédure dédiée : <a href="/procedure-dhcp-basculement">Configurer le basculement DHCP (failover)</a>. Rappel : le failover exige que le serveur soit <strong>membre du domaine AD</strong> (sinon « <em>erreur de validation du serveur partenaire</em> » → <a href="/depannage#dep-dhcp-basculement-partenaire">Dépannage</a>).</p>'),
    nameGuard,
  ],
};

// ===================================================================================
// 4) DNS : ZONES & ENREGISTREMENTS
// ===================================================================================
const dns: Page = {
  slug: 'procedure-dns',
  title: 'DNS : zones & enregistrements',
  excerpt: 'Créer une zone de recherche directe et inversée, ajouter des enregistrements A / CNAME / PTR et tester avec nslookup.',
  blocks: [
    block('hero', { eyebrow: 'Procédure · Hébergement', title: 'DNS : zones & enregistrements', subtitle: 'Faire résoudre les noms : zones directe et inversée, enregistrements, tests.' }),
    stepsStyle,
    note('blue', 'ℹ️ Contexte', '<p>Le rôle <strong>DNS</strong> est généralement installé <strong>avec Active Directory</strong> (le domaine a besoin du DNS). Sinon, ajoute-le via le Gestionnaire de serveur. Console : <code>dnsmgmt.msc</code>.</p>'),
    block('heading', { level: 2, text: '① Créer une zone de recherche directe (assistant Nouvelle zone)' }),
    block('html', { html: '<p>Une <strong>zone de recherche directe</strong> traduit un <strong>nom → IP</strong>. Console DNS (<code>dnsmgmt.msc</code>) → clic droit <strong>Zones de recherche directe</strong> → <strong>Nouvelle zone…</strong>, puis déroule l’assistant, écran par écran :</p>' }),
    block('html', { html: `<ol class="proc-steps">
      <li><strong>Type de zone</strong> → <strong>Zone principale</strong> (crée la copie <em>maîtresse</em>, modifiable directement sur ce serveur). Garde cochée « <strong>Enregistrer la zone dans Active Directory</strong> » si le serveur est contrôleur de domaine → zone <strong>intégrée AD</strong> (répliquée et sécurisée).</li>
      <li><strong>Étendue de la zone de réplication AD</strong> → choisis où la zone est copiée :
        <ul>
          <li><em>Vers tous les serveurs DNS de cette <strong>forêt</strong></em> — le plus large (utile en multi-domaines).</li>
          <li><em>Vers tous les serveurs DNS de ce <strong>domaine</strong></em> — le choix courant (réplication sur les DC-DNS du domaine).</li>
          <li><em>Vers tous les DC (compatibilité Windows 2000)</em> — hérité, à éviter.</li>
        </ul>
      </li>
      <li><strong>Nom de la zone</strong> → le nom DNS pour lequel le serveur fait autorité (ex. <code>miyukini.lan</code>, ou une zone dédiée comme <code>scooter.tamr</code>).</li>
      <li><strong>Mise à niveau dynamique</strong> → <strong>N’autoriser que les mises à jour dynamiques sécurisées</strong> (recommandé pour AD : les clients et DC enregistrent automatiquement leurs enregistrements, de façon authentifiée). « <em>Ne pas autoriser</em> » impose une saisie <strong>manuelle</strong> de tous les enregistrements.</li>
      <li><strong>Terminer</strong> → la zone apparaît dans la console, prête à recevoir des enregistrements.</li>
    </ol>` }),
    note('yellow', '⚠️ Les choix qui comptent (écrans de l’assistant)', '<p><strong>Principale</strong> (maîtresse, modifiable) vs <strong>Secondaire</strong> (copie en lecture seule alimentée par transfert — voir <a href="/procedure-dns-redondance">Redondance DNS</a>) vs <strong>Stub</strong> (uniquement les NS). · <strong>Intégrée AD</strong> = réplication multi-maître + mises à jour <em>sécurisées</em> possibles (option grisée pour une zone non intégrée). · <strong>Mises à jour sécurisées</strong> = seuls les membres du domaine authentifiés créent/modifient leurs enregistrements (anti-usurpation).</p>'),
    block('heading', { level: 2, text: '② Ajouter des enregistrements' }),
    block('html', { html: '<p><strong>Clic droit sur la zone</strong> (ex. <code>scooter.tamr</code>) → le menu propose <strong>Nouvel hôte (A ou AAAA)…</strong>, <strong>Nouvel alias (CNAME)…</strong>, <strong>Nouveau serveur de messagerie (MX)…</strong>, <strong>Nouveau domaine…</strong></p>' }),
    block('html', { html: `<p><strong>Nouvel hôte (A)</strong> — l’enregistrement le plus courant (nom → IPv4) :</p>
    <ol class="proc-steps">
      <li><strong>Nom</strong> : le nom court de l’hôte (ex. <code>www</code>). <strong>Laissé vide</strong>, l’enregistrement porte le nom de la <strong>zone elle-même</strong> (le domaine racine).</li>
      <li><strong>FQDN</strong> : se remplit automatiquement (nom + zone), ex. <code>www.scooter.tamr.</code> — ou <code>scooter.tamr.</code> si le nom est vide.</li>
      <li><strong>Adresse IP</strong> : l’IP de la machine cible — ex. l’<strong>IP du serveur IIS</strong> qui héberge le site.</li>
      <li>Coche <strong>« Créer un pointeur d’enregistrement PTR associé »</strong> pour créer en même temps la résolution inverse (nécessite que la <strong>zone inversée</strong> existe — voir ③).</li>
      <li>Laisse <em>« Autoriser tout utilisateur identifié à mettre à jour les enregistrements… »</em> <strong>décoché</strong> (réservé aux mises à jour dynamiques).</li>
      <li><strong>Ajouter un hôte</strong> → l’enregistrement apparaît dans la zone.</li>
    </ol>` }),
    block('html', { html: `<ul>
      <li><strong>CNAME (alias)</strong> : clic droit → <strong>Nouvel alias</strong> → ex. <code>www</code> → cible <code>srv-web01.miyukini.lan</code> (un nom qui pointe vers un autre nom).</li>
      <li><strong>MX</strong> : clic droit → <strong>Nouveau serveur de messagerie</strong> → serveur de mail + priorité.</li>
    </ul>` }),
    note('gray', '🌐 Astuce hébergement web', '<p>Pour publier un site : crée un <strong>hôte (A)</strong> <code>www</code> (ou <strong>nom vide</strong> pour le domaine racine) pointant vers l’<strong>IP du serveur IIS</strong>. Le client tape <code>http://www.scooter.tamr</code> et arrive sur le site. Voir <a href="/procedure-iis">IIS : héberger un site web</a>.</p>'),
    block('html', { html: `<p>Les principaux types d’enregistrements :</p><div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:520px;font-size:13.5px" class="ref-table"><thead><tr style="background:var(--surface-2)">${['Type', 'Rôle'].map(h => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${h}</th>`).join('')}</tr></thead><tbody>`
      + [
        ['A', 'Nom → adresse IPv4'],
        ['AAAA', 'Nom → adresse IPv6'],
        ['CNAME', 'Alias vers un autre nom'],
        ['MX', 'Serveur de messagerie du domaine'],
        ['NS', 'Serveur DNS faisant autorité sur la zone'],
        ['SOA', 'Infos de la zone (DNS primaire, e-mail admin, n° de série)'],
        ['PTR', 'Adresse IP → nom (zone inversée)'],
        ['SRV', 'Localise un service (host + port) — vital en AD : LDAP, Kerberos'],
      ].map(r => `<tr><td style="font-weight:700;font-family:ui-monospace,'Space Mono',monospace">${r[0]}</td><td>${r[1]}</td></tr>`).join('')
      + `</tbody></table></div>` }),
    block('heading', { level: 2, text: '③ Zone de recherche inversée (IP → nom)' }),
    block('html', { html: `<ol class="proc-steps">
      <li>Clic droit <strong>Zones de recherche inversée</strong> → <strong>Nouvelle zone</strong> → IPv4 → <strong>ID réseau</strong> (ex. <code>192.168.10</code>).</li>
      <li>Les enregistrements <strong>PTR</strong> se créent alors automatiquement quand tu coches « créer un PTR » sur un hôte A.</li>
    </ol>` }),
    block('heading', { level: 2, text: '④ Tester' }),
    cmd('nslookup srv-web01.domaine.local\nnslookup 192.168.10.20\nping srv-web01.domaine.local'),
    note('yellow', '⚠️ À retenir', '<p>Sur les <strong>clients</strong>, le <strong>DNS préféré</strong> doit être l’<strong>IP du serveur DNS/DC</strong> (jamais la box), sinon la résolution du domaine échoue. Voir <a href="/procedure-ip-fixe-windows">Configurer une IP fixe</a>.</p>'),
    note('purple', '🔁 Haute disponibilité', '<p>Le DNS est <strong>critique</strong> (résolution + ouverture de session AD) : prévois-en <strong>au moins deux</strong>. Procédure dédiée : <a href="/procedure-dns-redondance">Redondance DNS</a> (zone intégrée AD ou zone secondaire).</p>'),
  ],
};

// ===================================================================================
// 5) IIS : HÉBERGER UN SITE WEB
// ===================================================================================
const iis: Page = {
  slug: 'procedure-iis',
  title: 'IIS : héberger un site web',
  excerpt: 'Installer le rôle Serveur Web (IIS), créer un site, sa liaison (binding), l’enregistrement DNS, les permissions NTFS et ouvrir le pare-feu.',
  blocks: [
    block('hero', { eyebrow: 'Procédure · Hébergement', title: 'IIS : héberger un site web', subtitle: 'Publier un site : rôle IIS, site + liaison, DNS, NTFS et pare-feu.' }),
    stepsStyle,
    block('heading', { level: 2, text: '① Installer le rôle IIS' }),
    block('html', { html: '<p><strong>Gestionnaire de serveur</strong> → <strong>Ajouter des rôles et fonctionnalités</strong> → coche <strong>Serveur Web (IIS)</strong> → installe (garde les composants par défaut).</p>' }),
    block('heading', { level: 2, text: '② Déposer le site & créer le site dans IIS' }),
    block('html', { html: `<ol class="proc-steps">
      <li>Place les fichiers du site dans un dossier, ex. <code>C:\\inetpub\\wwwroot\\monsite</code>.</li>
      <li>Ouvre le <strong>Gestionnaire IIS</strong> (<code>inetmgr</code>) → clic droit <strong>Sites</strong> → <strong>Ajouter un site Web</strong>.</li>
      <li><strong>Nom du site</strong>, <strong>chemin physique</strong> (le dossier ci-dessus), <strong>liaison</strong> : type <code>http</code>, port <code>80</code>, <strong>nom d’hôte</strong> <code>www.domaine.local</code>.</li>
      <li>Valide : le site démarre.</li>
    </ol>` }),
    block('heading', { level: 2, text: '③ DNS, permissions NTFS & pare-feu' }),
    block('html', { html: `<ol class="proc-steps">
      <li><strong>DNS</strong> : crée un enregistrement <strong>A</strong> (ou CNAME) <code>www</code> → IP du serveur web (voir <a href="/procedure-dns">DNS</a>).</li>
      <li><strong>NTFS</strong> : le dossier du site doit autoriser en <strong>lecture</strong> le groupe <code>IIS_IUSRS</code> (et <code>IUSR</code>). Clic droit dossier → Propriétés → Sécurité.</li>
      <li><strong>Pare-feu</strong> : autorise le <strong>port 80</strong> (HTTP) entrant si nécessaire.</li>
    </ol>` }),
    block('heading', { level: 2, text: '④ Tester' }),
    block('html', { html: '<p>Depuis un <strong>client</strong> du réseau, ouvre <code>http://www.domaine.local</code>. Si erreur : vérifie DNS (<code>nslookup www.domaine.local</code>), la liaison IIS, les permissions NTFS et le pare-feu.</p>' }),
    block('heading', { level: 2, text: '⑤ Haute disponibilité (ferme Web + NLB)' }),
    block('html', { html: '<p>Pour tenir la charge et survivre à la panne d’un serveur, on place <strong>plusieurs serveurs IIS identiques</strong> derrière un <strong>point d’entrée unique</strong>. Trois briques :</p>' }),
    block('html', { html: `<ol class="proc-steps">
      <li><strong>Contenu identique</strong> sur chaque nœud : héberge le site sur un <strong>partage commun</strong> (UNC) ou <strong>réplique</strong> le dossier entre serveurs avec <a href="/procedure-dfs">DFS-R</a>.</li>
      <li><strong>Répartition de charge</strong> : installe l’<strong>équilibrage de charge réseau (NLB)</strong> sur les serveurs web, avec une <strong>IP virtuelle (VIP)</strong> commune vers laquelle pointe l’enregistrement DNS <code>www</code> (alternative : un répartiteur / reverse-proxy externe).</li>
      <li><strong>Cohérence des sessions</strong> : mets la <strong>même</strong> <code>&lt;machineKey&gt;</code> (clés de validation/chiffrement) dans le <code>web.config</code> de tous les nœuds, sinon les cookies d’authentification et le ViewState cassent au basculement ; pour l’état de session, utilise un <strong>StateServer</strong> ou <strong>SQL</strong> (hors-process).</li>
    </ol>` }),
    block('html', { html: '<p>Créer le cluster NLB (puis ajouter chaque nœud) :</p>' }),
    cmd('Install-WindowsFeature NLB -IncludeManagementTools\nNew-NlbCluster -InterfaceName "Ethernet" -ClusterName "WEB" -ClusterPrimaryIP 192.168.10.30 -SubnetMask 255.255.255.0 -OperationMode Multicast\nAdd-NlbClusterNode -InterfaceName "Ethernet" -NewNodeName "SRV-WEB02"\nAdd-NlbClusterPortRule -Protocol Tcp -StartPort 80 -EndPort 80 -Affinity Single'),
    note('yellow', '⚠️ NLB : points d’attention', '<p>Le <strong>mode</strong> (unicast/multicast) doit être compatible avec le commutateur ; l’<strong>affinité « Single »</strong> garde un client sur le même nœud (utile si sessions locales). NLB répartit mais ne teste pas la santé <em>applicative</em> : un site planté sur un nœud qui répond encore au réseau continue de recevoir du trafic.</p>'),
    note('green', '🔗 Lien', '<p>Cours complet : <a href="/hebergement-web">L’hébergement web (DNS + IIS)</a>. Redondance des données : <a href="/procedure-dfs">DFS</a>.</p>'),
    nameGuard,
  ],
};

const PAGES: Page[] = [hyperv, disques, dhcp, dns, iis];

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

  for (const p of PAGES) {
    const cur = existing.find(e => e.slug === p.slug);
    const bodyJson = JSON.stringify({ title: p.title, slug: p.slug, excerpt: p.excerpt, content: renderPageBlocksToHtml(p.blocks), builder_json: serializePageBlocks(p.blocks), published: 1 });
    const res = cur
      ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body: bodyJson })
      : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body: bodyJson });
    console.log(`PAGE ${p.slug}`, res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());
  }

  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

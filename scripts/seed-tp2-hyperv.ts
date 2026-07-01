/* Crée la page « TP2 — Virtualisation Hyper-V (notes & corrigé) » : manipulations + résultats,
   pour pouvoir refaire l'exercice. Insiste sur le renommage de l'OS + IP fixe + conventions de nommage.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-tp2-hyperv.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const accordion = (it: Array<[string, string]>) => block('accordion', { items: it.map(([title, text]) => ({ title, text, href: '' })) });
const esc = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const code = (lines: string[]) => `<pre style="background:var(--surface-2);border:1px solid var(--border);padding:10px 12px;border-radius:8px;overflow-x:auto;font-size:13.5px;line-height:1.6;margin:8px 0"><code>${lines.map(esc).join('\n')}</code></pre>`;
// Tableau générique : entêtes + lignes (cellules = HTML)
const table = (heads: string[], rows: string[][]) => '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:14px;margin:8px 0"><thead><tr style="background:var(--surface-2)">'
  + heads.map(h => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${h}</th>`).join('') + '</tr></thead><tbody>'
  + rows.map(r => '<tr>' + r.map((c, i) => `<td style="padding:8px 10px;border:1px solid var(--border)${i === 0 ? ';font-weight:bold' : ''}">${c}</td>`).join('') + '</tr>').join('')
  + '</tbody></table></div>';

const C = { net: '#2563eb', dev: '#059669', warn: '#d97706', danger: '#dc2626', grey: '#64748b', slate: '#475569', purple: '#7c3aed' };
function box(x: number, y: number, w: number, h: number, fill: string, label: string, sub = ''): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}"/>`
    + `<text x="${x + w / 2}" y="${y + (sub ? h / 2 - 2 : h / 2 + 4)}" text-anchor="middle" font-size="13" fill="#fff" font-weight="bold">${label}</text>`
    + (sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 14}" text-anchor="middle" font-size="10" fill="#e5e7eb">${sub}</text>` : '');
}
const line = (x1: number, y1: number, x2: number, y2: number, col = '#94a3b8') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="2.5"/>`;
const wrap = (w: number, h: number, inner: string) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="max-width:${w}px;width:100%;height:auto;margin:8px 0 12px;font-family:system-ui,sans-serif">${inner}</svg>`;
const cap = (x: number, y: number, t: string, col = '#64748b', s = 11) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${s}" fill="${col}">${t}</text>`;

// Schéma : maquette du TP (hôte + 2 VM reliées par un commutateur, IP fixes)
const svgLab = wrap(620, 270,
  cap(310, 18, 'Maquette du TP — réseau interne 192.168.10.0/24', C.slate, 13)
  + box(220, 116, 180, 40, C.net, 'Commutateur virtuel', 'interne / privé (sans DHCP)')
  + box(40, 38, 180, 46, C.slate, 'Machine HÔTE', 'physique · Hyper-V')
  + box(40, 196, 180, 46, C.dev, 'VM Windows 10', 'W10-TSSR-01 · .10')
  + box(400, 196, 180, 46, C.purple, 'VM Serveur 2019', 'SRV-2019-01 · .1')
  + line(220, 136, 130, 84) + line(220, 136, 130, 196) + line(400, 136, 490, 196)
  + cap(310, 262, 'Sans DHCP : chaque VM a une IP fixe, sinon elle tombe en 169.254.x.x (APIPA) et ne ping plus.', '#dc2626'));

// ===================================================================================
const SLUG = 'tp2-virtualisation-hyperv';
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'TP · Virtualisation', title: 'TP2 — Virtualisation Hyper-V (notes & corrigé)', subtitle: 'Toutes les manipulations et leurs résultats, pour refaire l’exercice pas à pas.' }),
  block('html', { html: '<p>Ces notes reprennent le <strong>TP2 Hyper-V</strong> dans l’ordre : <strong>création et gestion matérielle d’une VM</strong>, <strong>fonctionnalités Hyper-V</strong>, puis <strong>connectivité réseau</strong>. Pour chaque étape : la <strong>manipulation</strong> et le <strong>résultat attendu</strong>. Prérequis : Windows 10 <strong>Pro ou Entreprise</strong> (Hyper-V n’existe pas en édition Famille) et la virtualisation <strong>activée dans le BIOS/UEFI</strong>.</p>' }),
  note('blue', '👉 Avant de commencer', '<p>Théorie : <a href="/pages/virtualisation-theorie">La virtualisation : théorie & concepts</a>. Pratique guidée : <a href="/pages/virtualisation">La virtualisation avec Hyper-V</a>. Ces notes sont le <strong>corrigé</strong> de mise en pratique.</p>'),

  // ====== ENCADRÉ IMPORTANT : nommage + IP fixe ======
  block('heading', { level: 2, text: '⭐ Règle d’or — à faire À CHAQUE VM créée' }),
  note('red', '🚨 IMPORTANT — ne jamais l’oublier', '<p>Dès qu’une VM est installée, <strong>deux gestes obligatoires</strong> avant toute autre chose :</p><ol><li><strong>Renommer l’OS</strong> (le nom de la machine) avec un <strong>nom normalisé</strong> — pas de « DESKTOP-7F3A9K » par défaut.</li><li><strong>Fixer une adresse IP statique</strong> (IP fixe) — surtout sur un commutateur <strong>interne ou privé</strong> qui n’a <strong>pas de DHCP</strong>.</li></ol><p>Sans ça : les machines ne se reconnaissent pas, et sans IP fixe elles tombent en <strong>APIPA (169.254.x.x)</strong> → <strong>aucun ping ne passe</strong>.</p>'),

  block('heading', { level: 3, text: '🏷️ Renommer l’OS (nom de machine)' }),
  block('html', { html: '<p>Sous Windows : <strong>Paramètres → Système → Informations système → Renommer ce PC</strong>, ou en PowerShell (admin) :</p>' + code(['Rename-Computer -NewName "W10-TSSR-01" -Restart']) }),
  block('html', { html: '<p>Les <strong>conventions de nommage standard</strong> rendent le parc lisible. Règles de base :</p><ul><li><strong>15 caractères maximum</strong> (limite NetBIOS).</li><li>Uniquement <strong>A–Z, 0–9 et le tiret «&nbsp;-&nbsp;»</strong> : pas d’espace, pas d’accent, pas de caractère spécial.</li><li>Nom <strong>unique</strong> et <strong>parlant</strong> : rôle/fonction + numéro.</li><li><strong>Numérotation sur 2 chiffres</strong> (01, 02, 03…).</li></ul>' }),
  block('html', { html: table(['Équipement', 'Préfixe', 'Exemple'], [
    ['Contrôleur de domaine', '<code>DC</code>', '<code>DC01</code>, <code>DC02</code>'],
    ['Serveur de rôle', '<code>SRV-&lt;rôle&gt;</code>', '<code>SRV-DHCP01</code>, <code>SRV-FILE01</code>, <code>SRV-DNS01</code>'],
    ['Hyperviseur', '<code>HV-</code>', '<code>HV-01</code>'],
    ['Poste fixe', '<code>PC-&lt;service&gt;</code>', '<code>PC-COMPTA-01</code>, <code>PC-RH-02</code>'],
    ['Portable', '<code>LT-</code>', '<code>LT-DIR-01</code>'],
    ['VM de test / lab', '<code>W10-</code> / <code>TEST-</code>', '<code>W10-TSSR-01</code>, <code>SRV-2019-01</code>'],
  ]) }),

  block('heading', { level: 3, text: '📌 Donner une IP fixe' }),
  block('html', { html: '<p><strong>Paramètres réseau → Propriétés de la carte → IPv4 → « Utiliser l’adresse IP suivante »</strong>, ou en PowerShell :</p>' + code(['New-NetIPAddress -InterfaceAlias "Ethernet" -IPAddress 192.168.10.10 -PrefixLength 24 -DefaultGateway 192.168.10.254', 'Set-DnsClientServerAddress -InterfaceAlias "Ethernet" -ServerAddresses 192.168.10.1']) }),
  block('html', { html: '<p>Plan d’adressage proposé pour la maquette (réseau <strong>interne, sans DHCP</strong>) :</p>' + table(['Machine', 'Nom', 'IP fixe', 'Masque'], [
    ['VM Windows 10', '<code>W10-TSSR-01</code>', '<code>192.168.10.10</code>', '<code>255.255.255.0 (/24)</code>'],
    ['VM Serveur 2019', '<code>SRV-2019-01</code>', '<code>192.168.10.1</code>', '<code>255.255.255.0 (/24)</code>'],
    ['Passerelle (si besoin)', '—', '<code>192.168.10.254</code>', '<code>/24</code>'],
  ]) }),
  block('html', { html: svgLab }),
  note('yellow', '💡 Pourquoi APIPA ?', '<p>Quand une carte est en <strong>DHCP automatique</strong> mais qu’<strong>aucun serveur DHCP</strong> ne répond (cas d’un commutateur interne/privé), Windows s’auto-attribue une adresse <strong>169.254.x.x</strong> (APIPA). Deux machines en APIPA <strong>ne se pingent pas de façon fiable</strong> → d’où l’<strong>IP fixe obligatoire</strong>. Voir <a href="/pages/adresses-ip">Les adresses IP</a>.</p>'),

  // ====== PARTIE 1 ======
  block('heading', { level: 2, text: '🧩 Partie 1 — Création & gestion matérielle d’une VM' }),
  accordion([
    ['1. Le processeur supporte-t-il la virtualisation ?', '<p>Il faut <strong>Intel VT-x</strong> ou <strong>AMD-V</strong>. On vérifie sur la fiche du fabricant (<em>ark.intel.com</em> / site AMD), ou directement : <strong>Gestionnaire des tâches → Performances → Processeur</strong> → ligne « <strong>Virtualisation : Activée</strong> », ou la commande <code>systeminfo</code>. La fonction doit aussi être <strong>activée dans le BIOS/UEFI</strong>.</p>'],
    ['2. Installer le rôle Hyper-V', '<p><strong>Panneau de configuration → Programmes → Activer ou désactiver des fonctionnalités Windows</strong> → cocher <strong>Hyper-V</strong>. Ou en PowerShell (admin) :</p>' + code(['Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All']) + '<p><strong>Résultat :</strong> un <strong>redémarrage</strong> est demandé. Hyper-V n’est dispo qu’en <strong>Windows 10 Pro/Entreprise/Éducation</strong>.</p>'],
    ['3. Préconisations Microsoft pour Windows 10', '<p>Configuration minimale officielle : <strong>CPU 1 GHz</strong>, <strong>2 Go de RAM</strong> (64 bits), <strong>20 à 32 Go de disque</strong>, carte graphique DirectX 9. C’est sur cette base qu’on dimensionne la VM (capture d’écran à l’appui dans le TP).</p>'],
    ['4–5. Créer la VM puis installer Windows 10', '<p><strong>Gestionnaire Hyper-V → Action → Nouveau → Ordinateur virtuel</strong> : nom, <strong>génération</strong>, RAM, <strong>commutateur réseau</strong>, <strong>disque virtuel</strong>, puis <strong>image ISO</strong> de Windows 10 en support d’installation. On démarre la VM et on déroule l’installation comme sur une machine physique.</p>'],
    ['6. À quoi sert la RAM dynamique ?', '<p>La VM démarre avec un <strong>minimum</strong> de RAM, et Hyper-V <strong>ajuste automatiquement</strong> la mémoire allouée (entre un mini et un maxi) <strong>selon les besoins réels</strong>. Avantage : on <strong>mutualise mieux</strong> la RAM entre plusieurs VM, sans réserver inutilement.</p>'],
    ['7. Génération 1 vs Génération 2 ?', '<p><strong>Gen 1</strong> : firmware <strong>BIOS hérité</strong>, démarrage IDE — compatible vieux OS (32 bits, anciennes versions). <strong>Gen 2</strong> : firmware <strong>UEFI + Secure Boot</strong>, démarrage SCSI/PXE, démarrage à chaud de disques — pour les <strong>OS 64 bits récents</strong> (Windows 8/2012 et +). Plus moderne et sécurisé. ⚠️ <strong>La génération se choisit à la création et ne se change plus ensuite.</strong></p>'],
    ['8. La VM a-t-elle accès à Internet ?', '<p>Cela dépend du <strong>commutateur</strong> affecté. Avec le <strong>« Default Switch »</strong> (NAT) ou un commutateur <strong>externe</strong> → <strong>oui</strong>. Avec un commutateur <strong>interne</strong> ou <strong>privé</strong> → <strong>non</strong> (voir Partie 3).</p>'],
    ['9. À quoi sert « Ctrl + Alt + Fin » ?', '<p>C’est l’équivalent de <strong>Ctrl + Alt + Suppr</strong> envoyé <strong>à l’intérieur de la VM</strong> (le vrai Ctrl+Alt+Suppr est capté par la machine hôte). Sert à ouvrir l’écran de sécurité / déverrouiller la session de la VM.</p>'],
    ['10. Peut-on modifier RAM / taille de disque VM allumée ?', '<p><strong>En général non</strong> : la <strong>RAM statique</strong> et la <strong>taille du disque</strong> se modifient <strong>VM éteinte</strong>. Exceptions en <strong>Génération 2</strong> : la <strong>RAM dynamique</strong> s’ajuste à chaud et on peut <strong>ajouter/retirer un disque SCSI</strong> sans éteindre.</p>'],
    ['11. Mémoire vive à 4096 Mo', '<p>On met <strong>Paramètres → Mémoire → 4096 Mo</strong> (VM éteinte). <strong>Résultat :</strong> la VM démarre normalement avec 4 Go.</p>'],
    ['12. Mémoire vive à 128 Mo — la machine s’allume-t-elle ?', '<p><strong>Non.</strong> 128 Mo sont <strong>très en dessous du minimum</strong> requis par Windows : la VM <strong>refuse de démarrer</strong> (ou Hyper-V renvoie une erreur de mémoire insuffisante).</p>'],
    ['13. Ajouter un processeur virtuel', '<p><strong>Paramètres → Processeur → Nombre de processeurs virtuels</strong> (VM éteinte). On passe par ex. de 1 à 2 vCPU.</p>'],
    ['14. Ajouter un 2ᵉ disque de 25 Go, partitionné en U: et V:', '<p>Créer un <strong>nouveau disque virtuel (VHDX) de 25 Go</strong> et l’attacher (contrôleur SCSI). Dans la VM : <strong>Gestion des disques</strong> → initialiser le disque → créer <strong>deux volumes</strong> et leur attribuer les lettres <strong>U:</strong> et <strong>V:</strong>.</p>'],
    ['15. Ajouter un lecteur CD/DVD', '<p><strong>Paramètres</strong> de la VM → sur le <strong>contrôleur IDE</strong> (Gen 1) → <strong>Ajouter → Lecteur de DVD</strong>. En Gen 2 le lecteur est sur le contrôleur SCSI.</p>'],
    ['16. Peut-on éjecter un CD/ISO VM allumée ?', '<p><strong>Oui.</strong> Dans les paramètres du lecteur DVD, on peut <strong>changer ou éjecter l’image ISO à chaud</strong>, sans éteindre la VM.</p>'],
  ]),

  // ====== PARTIE 2 ======
  block('heading', { level: 2, text: '🛠️ Partie 2 — Fonctionnalités d’Hyper-V' }),
  accordion([
    ['1. Copier-coller du texte entre hôte et VM', '<p>Fonctionne grâce aux <strong>services d’intégration</strong> et au <strong>mode session améliorée</strong> : le <strong>presse-papier</strong> est partagé dans les deux sens. ⚠️ Le <strong>glisser-déposer de fichiers</strong> n’est pas pris en charge par Hyper-V (contrairement à VMware) — on passe par un dossier réseau ou le presse-papier.</p>'],
    ['2. Quels sont les modes d’arrêt d’une VM ?', '<p><strong>Arrêter</strong> (extinction propre via les services d’intégration), <strong>Éteindre</strong> (coupure brutale, comme débrancher la prise), <strong>Enregistrer</strong> (<em>Save state</em> : fige l’état en mémoire/disque pour reprendre plus tard), <strong>Suspendre/Pause</strong> (met en pause sans libérer la RAM). On trouve aussi <strong>Redémarrer</strong>.</p>'],
    ['3. Où sont stockés les ordinateurs virtuels (config) ?', '<p>Par défaut dans <code>C:\\ProgramData\\Microsoft\\Windows\\Hyper-V\\</code>. Ce répertoire contient les <strong>fichiers de configuration</strong> des VM (<code>.vmcx</code>, état <code>.vmrs</code>) et les points de contrôle.</p>'],
    ['4. Où sont stockés les disques durs virtuels ?', '<p>Par défaut dans <code>C:\\Users\\Public\\Documents\\Hyper-V\\Virtual Hard Disks\\</code>. Ce répertoire contient les <strong>images disque</strong> <code>.vhd</code> / <code>.vhdx</code> des VM.</p>'],
    ['5. Point de contrôle + changement de fond d’écran → restauration', '<p>On fait un <strong>point de contrôle (snapshot)</strong>, puis on <strong>change le fond d’écran</strong>. Après <strong>restauration de l’instantané</strong> : <strong>le fond d’écran redevient l’ancien</strong> — la VM est revenue exactement à l’état figé. C’est la démonstration du <strong>retour arrière</strong>.</p>'],
    ['6. Installer Windows Server 2012 en réseau interne', '<p>Nouvelle VM avec une ISO de <strong>Windows Server 2012</strong>, commutateur réglé sur <strong>interne</strong>. (Penser à la <strong>règle d’or</strong> : renommer + IP fixe.)</p>'],
    ['7. Changer la génération après installation ?', '<p><strong>Impossible nativement.</strong> La génération est <strong>figée à la création</strong>. Pour « changer », il faut <strong>recréer la VM</strong> dans la bonne génération (ou utiliser un script de conversion communautaire type <em>Convert-VMGeneration</em>).</p>'],
    ['8. Démarrer la VM au démarrage de l’hôte', '<p><strong>Paramètres de la VM → Action de démarrage automatique</strong> → « <strong>Toujours démarrer automatiquement cet ordinateur virtuel</strong> » (capture d’écran demandée).</p>'],
    ['9. Éteindre la VM à l’arrêt de l’hôte', '<p><strong>Paramètres de la VM → Action d’arrêt automatique</strong> → « <strong>Arrêter le système d’exploitation invité</strong> » (ou « Enregistrer l’état »).</p>'],
    ['10. Exporter la VM Windows 10', '<p>Clic droit sur la VM → <strong>Exporter</strong> → choisir un dossier. <strong>Résultat :</strong> le dossier exporté contient bien la <strong>configuration</strong>, les <strong>disques virtuels (VHDX)</strong> et les <strong>snapshots</strong> (à vérifier par capture d’écran).</p>'],
    ['11. Importer une VM — quelles différences entre les 3 modes ?', '<p><strong>① Inscrire sur place</strong> : utilise les fichiers <strong>là où ils sont</strong>, conserve le même <strong>identifiant (ID)</strong>. <strong>② Restaurer</strong> : <strong>copie</strong> les fichiers vers l’emplacement Hyper-V, conserve le <strong>même ID</strong>. <strong>③ Copier</strong> : crée une <strong>nouvelle copie</strong> avec un <strong>nouvel ID unique</strong> → pour <strong>cloner</strong> sans conflit avec l’originale.</p>'],
  ]),

  // ====== PARTIE 3 ======
  block('heading', { level: 2, text: '🌐 Partie 3 (bonus) — Connectivité réseau' }),
  block('html', { html: '<p>On teste la communication entre les machines (hôte ↔ VM) avec l’outil <strong>ping</strong> (dans l’invite de commandes <strong>CMD</strong>). On crée pour cela une VM <strong>Windows Server 2019</strong> en plus de la VM Windows 10.</p>' }),
  block('html', { html: '<p><strong>Test de référence depuis l’hôte</strong> (Internet présent) :</p>' + code(['C:\\> ping 8.8.8.8', '', 'Réponse de 8.8.8.8 : octets=32 temps=14 ms TTL=117', 'Réponse de 8.8.8.8 : octets=32 temps=13 ms TTL=117']) + '<p>Une <strong>réponse</strong> = la machine joint bien la cible. « <em>Délai d’attente dépassé</em> » = pas de route / machine injoignable.</p>' }),
  accordion([
    ['Les 3 types de commutateurs Hyper-V', '<p><strong>Externe</strong> : relie les VM au <strong>réseau physique (LAN/Internet)</strong> via une carte réseau de l’hôte. <strong>Interne</strong> : communication <strong>VM ↔ VM et VM ↔ hôte</strong>, mais <strong>pas d’accès externe</strong>. <strong>Privé</strong> : communication <strong>entre VM uniquement</strong> (ni hôte, ni réseau). Détail : <a href="/pages/virtualisation-theorie">théorie de la virtualisation</a>.</p>'],
    ['Commutateur EXTERNE (ex : externe-NIC1)', '<p>On crée un commutateur <strong>externe</strong> nommé d’après la carte réseau (ex. <code>externe-NIC1</code>) et on l’affecte à la VM Win10. <strong>Hôte :</strong> garde Internet (brève coupure pendant la création, le temps que la carte bascule sur le commutateur). <strong>VM :</strong> a Internet — elle est désormais sur le <strong>réseau physique</strong>.</p>'],
    ['Commutateur INTERNE (ex : Com-Interne)', '<p>On crée un commutateur <strong>interne</strong> et on l’affecte à la VM. <strong>Hôte :</strong> garde Internet (sa carte physique n’est pas concernée). <strong>VM :</strong> <strong>plus d’Internet</strong> — l’interne ne sort pas vers la LAN ; il ne relie que la VM et l’hôte (réseau privé hôte↔VM).</p>'],
    ['Commutateur PRIVÉ (ex : Com-privee)', '<p>On crée un commutateur <strong>privé</strong>. <strong>Hôte :</strong> garde Internet. <strong>VM :</strong> <strong>aucun accès</strong> — le privé ne relie <strong>que les VM entre elles</strong>, pas même l’hôte. Idéal pour un <strong>labo 100 % isolé</strong>.</p>'],
  ]),
  block('html', { html: '<p>Récapitulatif de la portée de chaque commutateur :</p>' + table(['Commutateur', 'Hôte a Internet ?', 'VM a Internet ?', 'VM ↔ hôte', 'VM ↔ VM'], [
    ['🌍 Externe', '<strong style="color:#059669">oui</strong>', '<strong style="color:#059669">oui</strong>', 'oui', 'oui'],
    ['🏠 Interne', '<strong style="color:#059669">oui</strong>', '<span style="color:#dc2626">non</span>', 'oui', 'oui'],
    ['🔒 Privé', '<strong style="color:#059669">oui</strong>', '<span style="color:#dc2626">non</span>', '<span style="color:#dc2626">non</span>', 'oui'],
  ]) }),
  note('blue', '🧪 Les scénarios de ping', '<p>Pour les 7 scénarios du TP, on fait pinger les <strong>3 machines</strong> (Win10, Serveur 2019, hôte) selon le <strong>commutateur affecté</strong> et les <strong>IP fixes</strong>. Le résultat se lit dans le tableau ci-dessus : deux machines <strong>ne se pingent que si elles partagent le même commutateur</strong> et sont dans le <strong>même réseau IP</strong> (ici 192.168.10.0/24). Une machine sur un <strong>privé</strong> ne joindra <strong>jamais</strong> l’hôte ; sur un <strong>interne</strong>, elle joint l’hôte mais pas Internet. Pense à <strong>autoriser le ping dans le pare-feu</strong> Windows (ICMP) si une réponse manque alors que la config est bonne.</p>'),
  block('html', { html: '<p>En fin de TP, on <strong>supprime le commutateur</strong> <code>externe-nic2</code> pour revenir à l’état initial.</p>' }),

  note('green', '💡 À retenir', '<p>Pour <strong>chaque VM</strong> : <strong>renommer l’OS</strong> (nom normalisé ≤ 15 car., sans accent/espace) et poser une <strong>IP fixe</strong> (sinon APIPA 169.254.x.x → pas de ping). La <strong>génération</strong> (1/2) et la <strong>RAM dynamique</strong> se décident à la création ; les snapshots permettent le <strong>retour arrière</strong> ; le <strong>commutateur</strong> (externe/interne/privé) décide de qui parle à qui. Voir aussi <a href="/pages/virtualisation">Hyper-V (pratique)</a> et <a href="/pages/adresses-ip">Les adresses IP</a>.</p>'),
];

const PAGE = { slug: SLUG, title: 'TP2 — Virtualisation Hyper-V (notes & corrigé)', excerpt: 'Notes et corrigé du TP2 Hyper-V : créer/gérer une VM (génération, RAM dynamique, disques, vCPU), fonctionnalités (snapshots, export/import, stockage), connectivité (commutateurs externe/interne/privé, ping). Avec règle d’or : renommer l’OS + IP fixe + conventions de nommage.' };

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

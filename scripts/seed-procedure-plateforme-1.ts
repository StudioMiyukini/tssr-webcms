/* Procédure « Plateforme 1 — montage de l'infrastructure EDIVN ».
   Guide pas-à-pas réutilisable, destiné à une équipe qui doit monter l'infra.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-procedure-plateforme-1.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'procedure-plateforme-1', title: 'Plateforme 1 — montage de l’infrastructure EDIVN', excerpt: 'Procédure complète et applicable pour monter le réseau de l’École de Développement Informatique (EDIVN) : plan d’adressage, puis 8 étapes couleur (reset, routeur interne + SSH, VM Hyper-V, switches, câblage, serveur DNS/Web/IIS, DHCP + relais, routage inter-routeurs + NAT/PAT, Wi-Fi), tests de validation et dépannage.' };

const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const th = (t: string) => `<th style="border:1px solid var(--border);padding:7px 10px;text-align:left;background:var(--surface-2)">${t}</th>`;
const td = (t: string) => `<td style="border:1px solid var(--border);padding:7px 10px">${t}</td>`;
const tbl = (head: string[], rows: string[][]) => `<div style="overflow-x:auto;margin:6px 0"><table style="border-collapse:collapse;width:100%;min-width:440px;font-size:13px"><thead><tr>${head.map(th).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(td).join('')}</tr>`).join('')}</tbody></table></div>`;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cmd = (t: string) => block('html', { html: `<div class="proc-cmd">${esc(t)}</div>` });
// Liste HTML (les items peuvent contenir des balises — contrairement au bloc « list » qui les échappe).
const ul = (items: string[]) => block('html', { html: `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>` });

// Bandeau d'étape coloré (couleur = repère visuel de l'étape).
const step = (n: string, title: string, sub: string, color: string) => block('html', { html: `<div class="step-banner" style="border-left-color:${color}"><span class="step-num" style="background:${color}">${n}</span><span class="step-tt"><h3 id="etape-${n}">${title}</h3><span class="step-sub">${sub}</span></span></div>` });

const C = { reset: '#64748b', routeur: '#3b82f6', vm: '#8b5cf6', switch: '#0ea5e9', cable: '#f59e0b', serveur: '#22c55e', dhcp: '#f97316', nat: '#ef4444', wifi: '#6366f1' };

const styleBlock = block('html', { html: `<style>
.proc-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}
.step-banner{display:flex;align-items:center;gap:14px;margin:32px 0 12px;padding:13px 16px;border:1px solid var(--border);border-left-width:6px;border-radius:12px;background:var(--surface-2)}
.step-banner .step-num{flex:0 0 auto;width:36px;height:36px;border-radius:10px;display:grid;place-items:center;font-weight:700;color:#fff;font-size:16px;line-height:1}
.step-banner .step-tt{display:flex;flex-direction:column;gap:2px;min-width:0}
.step-banner h3{margin:0;font-size:17px;line-height:1.25}
.step-banner .step-sub{font-size:12.5px;color:var(--muted,#7a8699);font-weight:400}
.pb-acc{border:1px solid var(--border);border-radius:10px;margin:10px 0;overflow:hidden;background:var(--surface-2)}
.pb-acc>summary{cursor:pointer;padding:12px 16px;font-weight:600;font-size:14.5px;list-style:none;display:flex;align-items:center;gap:10px}
.pb-acc>summary::-webkit-details-marker{display:none}
.pb-acc>summary::before{content:'▶';font-size:10px;color:var(--muted,#7a8699);transition:transform .15s;flex:0 0 auto}
.pb-acc[open]>summary::before{transform:rotate(90deg)}
.pb-acc[open]>summary{border-bottom:1px solid var(--border)}
.pb-acc-body{padding:6px 16px 12px}
.pb-acc-body>*:first-child{margin-top:8px}
</style>` });

const figure = (url: string, cap: string) => block('html', { html: `<figure style="margin:12px 0 16px;text-align:center"><img src="${url}" alt="${cap}" loading="lazy" style="max-width:100%;border:1px solid var(--border);border-radius:8px"/><figcaption class="meta" style="margin-top:6px;font-size:12.5px">${cap}</figcaption></figure>` });
// Accordéon repliable : regroupe des blocs HTML dans un <details>.
const acc = (summary: string, inner: PageBlock[]) => block('html', { html: `<details class="pb-acc"><summary>${summary}</summary><div class="pb-acc-body">${inner.map(b => (b as any).html || '').join('')}</div></details>` });

// ── Annexe 1 : machines virtuelles (relevé des configurations réelles) ──
const annexe1 = tbl(['Caractéristique', 'VM Serveur', 'VM Poste client'], [
  ['Nom de la VM', '<strong>SRV-1</strong>', '<strong>CLIENT10</strong>'],
  ['Rôles / usage', 'DNS · IIS · DHCP', 'poste client'],
  ['Système', 'Windows Server 2019', 'Windows 10 Pro'],
  ['Mémoire (RAM)', '4096 Mo', '4096 Mo'],
  ['Stockage', 'C : 50 Go', 'C : 40 Go'],
  ['Commutateur virtuel', 'Externe (commutateur 1)', 'Externe (commutateur 2)'],
  ['Adresse IP', '<strong>192.5.10.12</strong> /28', '192.5.10.1 /28'],
  ['Masque de sous-réseau', '255.255.255.240', '255.255.255.240'],
  ['Passerelle par défaut', '192.5.10.14', '192.5.10.14'],
  ['Serveur DNS', 'SRV-1 (192.5.10.12)', 'SRV-1 (192.5.10.12)'],
  ['Nom de domaine', 'edivn.lan', 'edivn.lan'],
]);

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Procédure · Projet réseau', title: 'Plateforme EDIVN — montage de l’infrastructure', subtitle: 'Guide pas-à-pas pour restructurer et monter le réseau de l’École de Développement Informatique (EDIVN).' }),
  styleBlock,

  note('blue', '🏫 Contexte', '<p>L’<strong>École de Développement Informatique EDIVN</strong> forme des développeurs et souhaite <strong>restructurer son réseau</strong> pour gagner en efficacité et en sécurité. Dans le cadre de son agrandissement, chaque site dispose d’une équipe chargée de restructurer le réseau.</p>'),
  note('gray', '🧭 Comment lire cette procédure', '<p>Suivez les <strong>8 étapes colorées</strong> dans l’ordre. Chaque étape est autonome (objectif, commandes, vérification). Les exemples prennent le <strong>Groupe 5</strong> comme référence : <strong>remplacez le suffixe de groupe</strong> (<code>G5</code>, <code>Groupe5</code>, <code>05</code>) et le domaine par les vôtres.</p>'),

  block('heading', { level: 2, text: '🎯 Mission' }),
  ul([
    'Configurer les routeurs : routage entre les réseaux de la structure et vers les autres écoles.',
    'Configurer les serveurs : mise en service des services DNS et Web.',
    'Sécuriser le réseau : accès de management à distance en SSH sur les switches et les routeurs (mot de passe : <code>cisco</code>).',
    'Configurer le point d’accès sans-fil Cisco : Wi-Fi pour les utilisateurs.',
    'Accès site Web : permettre l’accès au site web du site.',
  ]),

  block('heading', { level: 2, text: '📋 Cahier des charges (besoins)' }),
  block('heading', { level: 3, text: 'Sous-réseaux' }),
  ul([
    '<strong>Réseau Admin (IT)</strong> : postes des administrateurs + serveur DNS/Web.',
    '<strong>Réseau Utilisateurs</strong> : postes des formateurs et stagiaires.',
  ]),
  block('heading', { level: 3, text: 'Wi-Fi' }),
  block('html', { html: '<p>Un point d’accès <strong>Cisco WAP 371</strong> fournit le Wi-Fi aux stagiaires et formateurs, avec un <strong>SSID</strong> dédié <code>SSID-EDWINXX</code> et une attribution d’<strong>IP dynamiques par DHCP</strong>.</p>' }),
  block('heading', { level: 3, text: 'DHCP' }),
  block('html', { html: '<p>Un service <strong>DHCP</strong> gère l’attribution des configurations réseau pour <strong>l’ensemble du réseau</strong> de l’école.</p>' }),
  block('heading', { level: 3, text: 'Serveur Web (réseau IT, IP fixe)' }),
  block('html', { html: '<p>Hébergé dans le réseau IT, il héberge les sites de l’école. Deux sites à créer :</p>' }),
  ul([
    'Site 1 : <code>www.Groupe05-EDIVN.lan</code> sur le <strong>port 8080</strong>, accessible <strong>depuis l’extérieur</strong>.',
    'Site 2 (intranet) : <code>Intranet.05.EDIVN.lan</code>, accessible <strong>pour l’école</strong>, avec une page d’accueil « <em>Bienvenue sur le site de l’école EDIVN</em> ».',
  ]),
  block('heading', { level: 3, text: 'Switches & accès distant' }),
  ul([
    'Renommer <strong>l’ensemble des switches</strong>.',
    'Mettre en place une connexion à distance <strong>SSH</strong> sur les switches et les routeurs (mot de passe : <code>cisco</code>).',
  ]),

  block('heading', { level: 2, text: '📦 Livrables attendus (dossier technique)' }),
  ul([
    '<strong>Schéma logique</strong> : architecture réseau (sous-réseaux, équipements, interconnexions).',
    '<strong>Configuration des machines</strong> (Annexe 1).',
    '<strong>Configuration des switches et des routeurs</strong> (Annexe 2).',
    '<strong>Tables de routage</strong> : captures / listes des routes configurées.',
    '<strong>Borne Wi-Fi</strong> : captures montrant son fonctionnement.',
  ]),

  block('heading', { level: 2, text: '🗺️ Schéma logique & plan d’adressage' }),
  figure('/uploads/plat1-schema-reseau.png', 'Schéma logique EDIVN : réseau Admin/IT (192.5.10.0/28), réseau Utilisateurs (192.5.50.0/24), routeur interne R_IT_G5, routeur de bordure Routeur_G5 et sortie vers 172.16.3.0/24.'),
  block('html', { html: '<p>Le plan d’adressage ci-dessous découle de ce schéma.</p>' }),

  block('heading', { level: 3, text: 'Réseau Admin / IT — 192.5.10.0/28' }),
  block('html', { html: tbl(['Équipement', 'Adresse IP', 'Rôle'], [
    ['Poste Admin 1', '192.5.10.1', 'poste administrateur'],
    ['Serveur DHCP-DNS-Web', '<strong>192.5.10.12</strong>', 'serveur (IP fixe)'],
    ['SW-1', '192.5.10.13', 'switch — IP de gestion'],
    ['Passerelle (R_IT_G5 Gi0/0)', '<strong>192.5.10.14</strong>', 'passerelle du réseau'],
  ]) }),
  block('html', { html: '<p class="meta" style="font-size:12px">Masque <code>255.255.255.240</code> · broadcast <code>192.5.10.15</code> · plage utilisable <code>.1 → .14</code>.</p>' }),

  block('heading', { level: 3, text: 'Réseau Utilisateurs — 192.5.50.0/24' }),
  block('html', { html: tbl(['Équipement', 'Adresse IP', 'Rôle'], [
    ['Stagiaire', '192.5.50.1', 'poste — <strong>via DHCP</strong>'],
    ['Formateur', '192.5.50.2', 'poste — <strong>via DHCP</strong>'],
    ['CISCO WAP 371', '192.5.50.251', 'point d’accès Wi-Fi (SSID-EDWIN05) — IP fixe'],
    ['Routeur_G5 (LAN)', '192.5.50.252', 'routeur de bordure — IP fixe'],
    ['Sw-2', '192.5.50.253', 'switch — IP de gestion'],
    ['Passerelle (R_IT_G5 Gi0/1)', '<strong>192.5.50.254</strong>', 'passerelle du réseau'],
  ]) }),
  block('html', { html: '<p class="meta" style="font-size:12px">Masque <code>255.255.255.0</code> · les postes et les clients Wi-Fi reçoivent leur IP par <strong>DHCP</strong> (pool <code>.1 → .200</code>). Les équipements d’infra à IP fixe (<code>.251 → .254</code>) sont <strong>au-dessus du pool</strong> → aucune exclusion nécessaire.</p>' }),

  block('heading', { level: 3, text: 'Liaison extérieure / autres écoles — 172.16.3.0/24' }),
  block('html', { html: tbl(['Équipement', 'Adresse IP', 'Rôle'], [
    ['Routeur_G5 (WAN)', '172.16.3.250', 'sortie vers les autres écoles / Internet'],
    ['Passerelle de la salle', '172.16.3.254', 'route par défaut du routeur de bordure'],
  ]) }),
  block('html', { html: '<p class="meta" style="font-size:12px">L’IP WAN et la passerelle sont <strong>fournies par la salle</strong> (réseau <code>172.16.3.0/24</code>) ; adaptez-les à votre poste.</p>' }),

  block('heading', { level: 3, text: 'Routeurs & interfaces' }),
  block('html', { html: tbl(['Routeur', 'Interface', 'Réseau', 'Adresse IP'], [
    ['R_IT_G5 (interne)', 'Gi0/0', 'Admin 192.5.10.0/28', '192.5.10.14'],
    ['R_IT_G5 (interne)', 'Gi0/1', 'Utilisateurs 192.5.50.0/24', '192.5.50.254'],
    ['Routeur_G5 (bordure)', 'Gi0/1', 'Utilisateurs 192.5.50.0/24', '192.5.50.252'],
    ['Routeur_G5 (bordure)', 'Gi0/0', 'Extérieur 172.16.3.0/24', '172.16.3.250'],
  ]) }),
  note('gray', 'ℹ️ Nommage des interfaces', '<p>Sur les <strong>routeurs 2811</strong> les interfaces sont des <code>FastEthernet0/x</code> ; sur un <strong>2911</strong> des <code>GigabitEthernet0/x</code>. Rôles identiques — adaptez simplement le nom dans la CLI.</p>'),
  note('gray', 'ℹ️ Noms de domaine utilisés', '<p>Le domaine des <strong>équipements réseau</strong> (<code>ip domain-name</code> des routeurs/switches, requis pour SSH) est <code>edivn.lan</code>. Les <strong>sites Web</strong> ont chacun leur <strong>zone DNS</strong> : <code>Groupe05-EDIVN.lan</code> (site public) et <code>05.EDIVN.lan</code> (intranet). Adaptez le numéro de groupe.</p>'),

  block('heading', { level: 2, text: '🖥️ Annexe 1 — configuration des machines virtuelles' }),
  block('html', { html: annexe1 }),
  figure('/uploads/plat1-annexe.png', 'Fiche de configuration des machines (relevé d’origine).'),
  note('gray', 'ℹ️ Remarques', '<p>Les deux VM (SRV-1 + CLIENT10) sont sur le <strong>même segment Admin</strong> et pointent vers le <strong>DNS 192.5.10.12</strong>, mais <strong>chacune sur son propre commutateur externe</strong> (2 cartes ou 2 hôtes — voir Étape 2). Masque <code>/28</code> = <code>255.255.255.240</code>, passerelle <code>192.5.10.14</code>.</p>'),

  block('heading', { level: 2, text: '🔧 Réalisation pas à pas' }),
  block('html', { html: '<p>Huit étapes, à suivre dans l’ordre. Chacune se termine par une <strong>vérification</strong> avant de passer à la suivante.</p>' }),

  // ── Étape 0 ──
  step('0', 'Réinitialiser les équipements réseau', 'Routeurs & switches — partir d’une configuration vierge', C.reset),
  note('red', '🧨 À faire AVANT toute configuration sur du matériel réutilisé', '<p>Un équipement qui a déjà servi peut contenir une config qui <strong>bloque tout</strong> : routes par défaut erronées, ACL/NAT hors sujet, doublons d’adresses, VLAN parasites (fréquent sur du matériel de lab). On <strong>efface la configuration de démarrage</strong> et on <strong>redémarre</strong>.</p>'),
  cmd(`enable
write erase          ! ou :  erase startup-config
reload
! "System configuration has been modified. Save? [yes/no]:"  -> no
! "Proceed with reload? [confirm]"                            -> Entree
! au redemarrage, refuser l'assistant de configuration :
! "...enter the initial configuration dialog? [yes/no]:"      -> no`),
  note('yellow', '💡 Bon à savoir', '<p><code>write erase</code> efface la <strong>startup-config</strong> (NVRAM) ; c’est le <code>reload</code> qui recharge une config vide. Sur un <strong>switch</strong>, supprimez aussi la base VLAN si des VLAN parasites subsistent : <code>delete flash:vlan.dat</code> (confirmer) <strong>avant</strong> le <code>reload</code>. Répondez <strong>no</strong> à l’enregistrement.</p>'),
  note('gray', '🔗 Détail', '<p>Pas-à-pas générique : <a href="/pages/procedure-cisco-routeur-cli">Configurer un routeur Cisco (CLI)</a>.</p>'),

  // ── Étape 1 ──
  step('1', 'Routeur interne R_IT — interfaces & SSH', 'Adressage des 2 interfaces + accès de management SSH', C.routeur),
  block('html', { html: '<p>Configurer les <strong>deux interfaces</strong> du routeur interne (côté Admin/IT et côté Utilisateurs) puis l’<strong>accès SSH</strong> (mot de passe <code>cisco</code>). Tout se fait <strong>depuis la console</strong> (onglet <code>CLI</code> sous Packet Tracer, ou câble console sur matériel réel) — le SSH n’étant pas encore actif.</p>' }),
  cmd(`enable
configure terminal
hostname R_IT_G5
!
! --- Interfaces ---
interface GigabitEthernet0/0
 description Reseau Admin/IT
 ip address 192.5.10.14 255.255.255.240
 no shutdown
 exit
interface GigabitEthernet0/1
 description Reseau Utilisateurs
 ip address 192.5.50.254 255.255.255.0
 no shutdown
 exit
!
! --- Acces distant SSH (mot de passe : cisco) ---
ip domain-name edivn.lan
enable secret cisco
username admin privilege 15 secret cisco
crypto key generate rsa
1024
ip ssh version 2
line vty 0 4
 transport input ssh
 login local
 exit
!
end
write memory`),
  note('gray', 'ℹ️ Points clés', '<ul><li><code>Gi0/0</code> = passerelle du réseau <strong>Admin/IT</strong> (<code>192.5.10.14/28</code>), <code>Gi0/1</code> = passerelle du réseau <strong>Utilisateurs</strong> (<code>192.5.50.254/24</code>).</li><li>SSH exige un <strong>hostname</strong>, un <strong>ip domain-name</strong> et des <strong>clés RSA</strong> (le <code>1024</code> répond à la question de longueur de clé). <code>login local</code> utilise le compte <code>username</code>.</li></ul>'),
  block('html', { html: '<p><strong>Vérification :</strong></p>' }),
  cmd(`do show ip interface brief
! Gi0/0 -> 192.5.10.14  up/up  |  Gi0/1 -> 192.5.50.254  up/up
! puis, depuis un client : ssh -l admin 192.5.10.14`),
  note('gray', '🔗 Rappels', '<p><a href="/pages/procedure-cisco-routeur-cli">Configurer un routeur en CLI</a> · <a href="/pages/procedure-ssh-packet-tracer">SSH sur Packet Tracer</a>.</p>'),

  // ── Étape 2 ──
  step('2', 'Machines virtuelles (Hyper-V)', 'Serveur SRV-1 + poste CLIENT10, un commutateur externe par VM', C.vm),
  block('html', { html: '<p>Préparer les deux machines Windows du réseau Admin/IT — le poste <strong>CLIENT10</strong> et le serveur <strong>SRV-1</strong> — chacune reliée à la maquette Cisco par son <strong>propre commutateur externe</strong> (voir la règle ci-dessous). Peut se faire en parallèle de l’étape 1.</p>' }),
  ul([
    'Créer les 2 VM (Gestionnaire Hyper-V → <strong>Nouvel ordinateur virtuel</strong>, génération 2), selon l’Annexe 1.',
    'Placer <strong>chaque VM sur un commutateur virtuel Externe distinct</strong> (ex. <code>COMM-VIRTUEL-EXT-client</code> pour CLIENT10) — voir la règle ⚠️ ci-dessous.',
    'Installer les OS : <strong>Windows Server 2019</strong> (Expérience de bureau) sur <strong>SRV-1</strong>, <strong>Windows 10 Pro</strong> sur <strong>CLIENT10</strong> ; définir le mot de passe administrateur.',
    'Renommer les machines et appliquer l’<strong>IP fixe</strong> (tableau ci-dessous).',
  ]),
  block('html', { html: tbl(['VM', 'Nom', 'IP / masque', 'Passerelle', 'DNS'], [
    ['Serveur', 'SRV-1', '<strong>192.5.10.12</strong> /28', '192.5.10.14', '192.5.10.12 (lui-même)'],
    ['Poste client', 'CLIENT10', '192.5.10.1 /28', '192.5.10.14', '192.5.10.12'],
  ]) }),
  figure('/uploads/plat1-vm-specs-client10.png', 'Spécifications de CLIENT10 : Windows 10 Pro, 4 Go de RAM.'),
  figure('/uploads/plat1-vm-hyperv-carte-reseau.png', 'Paramètres Hyper-V de CLIENT10 — la carte réseau est rattachée au commutateur virtuel <strong>Externe</strong> « COMM-VIRTUEL-EXT-client ».'),
  figure('/uploads/plat1-vm-tcpip-client10.png', 'Configuration IPv4 fixe du poste : IP 192.5.10.1, masque 255.255.255.240 (/28), passerelle 192.5.10.14, DNS préféré 192.5.10.12.'),
  note('blue', '🧩 Rôles du serveur', '<p>Le serveur <strong>SRV-1</strong> (Windows Server 2019, <code>192.5.10.12</code>) porte les rôles <strong>DHCP</strong>, <strong>DNS</strong> et <strong>Serveur Web (IIS)</strong>, installés aux étapes 5 et 6. <strong>CLIENT10</strong> est un simple poste <strong>Windows 10 Pro</strong>.</p>'),
  note('red', '⚠️ Règle : un commutateur externe distinct par VM', '<p>Un commutateur virtuel <strong>Externe</strong> est lié à <strong>une seule carte réseau physique</strong>. Sur le matériel du lab, faire passer les deux VM par le <strong>même</strong> commutateur externe provoque des problèmes de connectivité (pont / multi-homing). La règle est donc : <strong>chaque VM sur son propre commutateur externe</strong>, ce qui impose</p><ul><li>soit <strong>2 cartes réseau physiques distinctes</strong> sur le même hôte (un commutateur externe par carte),</li><li>soit <strong>2 hôtes Hyper-V différents</strong>, une VM par hôte.</li></ul><p>Les deux VM restent sur le <strong>même segment Admin</strong> (<code>192.5.10.0/28</code>) — c’est le <strong>lien physique</strong> qui est dédoublé, pas le sous-réseau. Vérifiez que chaque commutateur externe pointe sur la <strong>bonne carte</strong> (cf. <em>Pièges fréquents ①</em> et <em>④</em>).</p>'),
  note('gray', '🔗 Détails', '<p><a href="/pages/procedure-vm-hyperv">Créer & configurer une VM (ISO) sur Hyper-V</a> · <a href="/pages/procedure-hyperv-ressources">Hyper-V : ressources</a> · <a href="/pages/procedure-ip-fixe-windows">Configurer une IP fixe</a> · <a href="/pages/procedure-renommer-poste">Renommer un poste</a>.</p>'),

  // ── Étape 3 ──
  step('3', 'Switches — renommage, gestion & SSH', 'IP de gestion (SVI VLAN 1) + accès SSH sur SW-1 et Sw-2', C.switch),
  block('html', { html: '<p><strong>Renommer</strong> les deux switches, leur attribuer une <strong>IP de gestion</strong> (SVI <code>VLAN 1</code>) et activer <strong>SSH</strong> (mot de passe <code>cisco</code>). Configuration depuis la console.</p>' }),
  cmd(`enable
configure terminal
hostname SW-1
ip domain-name edivn.lan
enable secret cisco
username admin privilege 15 secret cisco
!
! --- IP de gestion (SVI) ---
interface vlan 1
 ip address 192.5.10.13 255.255.255.240
 no shutdown
 exit
ip default-gateway 192.5.10.14
!
! --- SSH ---
crypto key generate rsa
1024
ip ssh version 2
line vty 0 4
 transport input ssh
 login local
 exit
!
end
write memory`),
  block('html', { html: '<p>Mêmes commandes pour <strong>Sw-2</strong> en adaptant le nom, l’IP de gestion et la passerelle :</p>' }),
  block('html', { html: tbl(['Switch', 'Réseau', 'IP de gestion (VLAN 1)', 'Masque', 'ip default-gateway'], [
    ['SW-1', 'Admin / IT', '192.5.10.13', '255.255.255.240', '192.5.10.14'],
    ['Sw-2', 'Utilisateurs', '192.5.50.253', '255.255.255.0', '192.5.50.254'],
  ]) }),
  note('gray', 'ℹ️ IP de gestion', '<p>Un switch de niveau 2 n’a pas d’IP sur ses ports ; on lui donne une <strong>adresse de gestion sur le SVI VLAN 1</strong> (dans le sous-réseau de son segment) + une <code>ip default-gateway</code> pour être joignable en SSH depuis un autre réseau.</p>'),

  // ── Étape 4 ──
  step('4', 'Câblage & vérifications physiques', 'Interconnexion des équipements et contrôle des liens', C.cable),
  ul([
    '<strong>SW-1</strong> (Admin/IT) : Poste Admin 1 et Serveur en <strong>ports access</strong> ; liaison montante vers <strong>R_IT_G5 Gi0/0</strong>.',
    '<strong>Sw-2</strong> (Utilisateurs) : Stagiaire, Formateur et le <strong>WAP 371</strong> en ports access ; liaisons vers <strong>R_IT_G5 Gi0/1</strong> et <strong>Routeur_G5</strong>.',
    '<strong>Routeur_G5</strong> : côté Utilisateurs (Sw-2) et côté extérieur (<code>172.16.3.0/24</code>) vers les autres écoles.',
  ]),
  note('yellow', '🔍 Vérifications', '<ul><li><code>show ip interface brief</code> sur chaque switch → <strong>Vlan1 up/up</strong>.</li><li>Voyants des ports au <strong>vert</strong> une fois tout branché.</li><li>Depuis le poste admin : <code>ssh -l admin 192.5.10.13</code> (SW-1) et un <code>ping</code> vers la passerelle.</li></ul>'),

  block('heading', { level: 3, text: '🔌 Plan de tests ping (communication réseau)' }),
  note('blue', '🎯 Méthode : tester en anneaux', '<p>Une fois le câblage terminé, on valide la connectivité du <strong>plus proche au plus lointain</strong> : d’abord sa <strong>passerelle</strong>, puis le <strong>réseau distant</strong>, puis la <strong>sortie</strong>, puis <strong>Internet</strong>. La <strong>première</strong> étape qui échoue localise la panne au saut près. Les <strong>interfaces de routeur</strong> répondent toujours → idéales pour valider le <strong>routage</strong> sans interférence du pare-feu.</p>'),
  note('gray', '🕐 Quand chaque anneau devient testable', '<ul><li><strong>A (local)</strong> : dès le câblage — passerelles, switches, serveur en IP fixe.</li><li><strong>B (inter-réseaux)</strong> : les interfaces de routeur dès l’étape 1 ; les <strong>postes Utilisateurs</strong> une fois le <strong>DHCP</strong> en service (étape 6).</li><li><strong>C (salle / Internet)</strong> : après le <strong>routage + NAT</strong> (étape 7).</li></ul>'),

  block('heading', { level: 4, text: 'A. Dans chaque réseau (liaison locale)' }),
  block('html', { html: '<p><strong>Depuis le Poste Admin</strong> (<code>192.5.10.1</code>, réseau Admin) :</p>' }),
  block('html', { html: tbl(['Commande', 'Cible', 'Ce que ça valide'], [
    ['<code>ping 192.5.10.14</code>', 'passerelle Admin (R_IT_G5 Gi0/0)', 'lien local + switch SW-1'],
    ['<code>ping 192.5.10.13</code>', 'SW-1 (IP de gestion)', 'switch joignable'],
    ['<code>ping 192.5.10.12</code>', 'SRV-1 (serveur) ✱', 'le serveur répond'],
  ]) }),
  block('html', { html: '<p><strong>Depuis un poste Utilisateurs</strong> (<code>192.5.50.x</code>) :</p>' }),
  block('html', { html: tbl(['Commande', 'Cible', 'Ce que ça valide'], [
    ['<code>ping 192.5.50.254</code>', 'passerelle Users (R_IT_G5 Gi0/1)', 'lien local + switch Sw-2'],
    ['<code>ping 192.5.50.253</code>', 'Sw-2 (IP de gestion)', 'switch joignable'],
    ['<code>ping 192.5.50.252</code>', 'Routeur_G5 (LAN)', 'routeur de bordure joignable'],
    ['<code>ping 192.5.50.251</code>', 'WAP 371', 'point d’accès joignable'],
    ['<code>ping &lt;IP Formateur&gt;</code>', 'autre poste du réseau ✱', 'communication entre postes'],
  ]) }),

  block('heading', { level: 4, text: 'B. Entre les réseaux (routage via R_IT_G5)' }),
  block('html', { html: tbl(['Depuis', 'Commande', 'Ce que ça valide'], [
    ['Poste Users', '<code>ping 192.5.10.14</code>', 'routage Users → Admin (interface routeur, répond toujours)'],
    ['Poste Users', '<code>ping 192.5.10.12</code> ✱', 'le serveur Admin est joignable depuis Users'],
    ['Poste Admin', '<code>ping 192.5.50.254</code>', 'routage Admin → Users (interface routeur)'],
    ['Poste Admin', '<code>ping 192.5.50.251</code>', 'le WAP est joignable depuis Admin'],
  ]) }),
  note('yellow', '✱ Ping vers une machine Windows', '<p>Les cibles marquées <strong>✱</strong> sont des <strong>postes/serveurs Windows</strong> : leur <strong>pare-feu</strong> peut bloquer le ping entrant <strong>même si le routage est bon</strong>. Si <code>ping .10.14</code> passe mais <code>ping .10.12</code> échoue → ce n’est pas le routage, c’est le pare-feu du serveur (voir <em>dépannage ③</em>). Autorisez l’ICMP entrant, ou fiez-vous à l’interface du routeur pour juger le routage.</p>'),

  block('heading', { level: 4, text: 'C. Vers la salle & Internet (via Routeur_G5)' }),
  block('html', { html: '<p><strong>Depuis un client du LAN</strong> :</p>' }),
  block('html', { html: tbl(['Commande', 'Cible', 'Ce que ça valide'], [
    ['<code>ping 172.16.3.250</code>', 'Routeur_G5 (WAN)', 'routage jusqu’au routeur de bordure'],
    ['<code>ping 172.16.3.254</code>', 'passerelle de la salle', 'sortie vers le réseau de la salle'],
    ['<code>ping 8.8.8.8</code>', 'Internet', 'accès Internet (via NAT/PAT)'],
  ]) }),

  block('heading', { level: 4, text: 'D. Depuis les routeurs (pour isoler une panne)' }),
  block('html', { html: tbl(['Sur', 'Commande', 'Ce que ça valide'], [
    ['R_IT_G5', '<code>ping 192.5.10.12</code> · <code>ping 192.5.50.252</code>', 'joint le serveur et le routeur de bordure'],
    ['R_IT_G5', '<code>ping 172.16.3.254</code>', 'la route par défaut vers Routeur_G5 fonctionne'],
    ['Routeur_G5', '<code>ping 192.5.50.254</code> · <code>ping 8.8.8.8</code>', 'joint R_IT_G5 et Internet'],
  ]) }),
  note('gray', '🧭 Si un test échoue', '<p>Déroulez les anneaux dans l’ordre A → B → C. Le premier échec situe la coupure : câble/switch (A), routage ou pare-feu (B), NAT/route par défaut (C). Détails dans les <strong>Pièges fréquents</strong> (bas de page) et la <a href="/pages/procedure-test-connectivite">méthode de test de connectivité</a>.</p>'),

  // ── Étape 5 ──
  step('5', 'Serveur — rôles, sites Web (IIS) & DNS', 'Installation DHCP/DNS/IIS, 2 sites et enregistrements DNS', C.serveur),
  block('html', { html: '<p>Sur <strong>SRV-1</strong> (<code>192.5.10.12</code>) : installer les <strong>rôles</strong>, créer les <strong>2 sites Web</strong> et les <strong>enregistrements DNS</strong>.</p>' }),

  block('heading', { level: 4, text: 'Rôles installés' }),
  ul(['<strong>DHCP</strong> (configuré à l’étape 6).', '<strong>DNS</strong> (zones + enregistrements).', '<strong>Serveur Web (IIS)</strong>.', '<strong>Services de fichiers et de stockage</strong> (présent par défaut).']),
  figure('/uploads/plat1-srv-roles.png', 'Gestionnaire de serveur : les 4 rôles installés — DHCP, DNS, IIS, Services de fichiers et de stockage.'),

  block('heading', { level: 4, text: 'Sites Web (IIS)' }),
  ul([
    'Créer <strong>deux sites</strong>, un <strong>dossier physique</strong> par site avec un <code>index.html</code> ; la page de l’intranet affiche « <em>Bienvenue sur le site de l’école EDIVN</em> ».',
    'Site <strong>Public</strong> — dossier <code>C:\\inetpub\\Public-EDIVN</code> ; liaison HTTP <code>www.Groupe05-EDIVN.lan</code> sur le <strong>port 8080</strong>, accessible depuis l’extérieur.',
    'Site <strong>intranet privé</strong> — dossier <code>C:\\inetpub\\Prive-EDIVN</code> ; liaison HTTP, accessible pour l’école (<code>Intranet.05.EDIVN.lan</code>).',
  ]),
  figure('/uploads/plat1-iis-sites.png', 'IIS → deux sites : « intranet privé » et « Public ».'),
  figure('/uploads/plat1-iis-public.png', 'Site Public → dossier physique C:\\inetpub\\Public-EDIVN.'),
  figure('/uploads/plat1-iis-binding-8080.png', 'Liaison du site Public : http, nom d’hôte www.Groupe05-EDIVN.lan, port 8080, IP 192.5.10.12.'),
  figure('/uploads/plat1-iis-intranet.png', 'Site intranet privé → dossier physique C:\\inetpub\\Prive-EDIVN.'),

  block('heading', { level: 4, text: 'Enregistrements DNS' }),
  block('html', { html: '<p>Deux <strong>zones de recherche directe</strong> sur SRV-1, chacune avec un enregistrement <strong>A</strong> racine vers <code>192.5.10.12</code> et un <strong>alias (CNAME)</strong> vers la racine :</p>' }),
  block('html', { html: tbl(['Zone', 'Enregistrements', 'Résout'], [
    ['<code>Groupe05-EDIVN.lan</code>', 'A (racine) → 192.5.10.12 · CNAME <code>www</code> → racine', '<code>www.Groupe05-EDIVN.lan</code> (site Public)'],
    ['<code>05.EDIVN.lan</code>', 'A (racine) → 192.5.10.12 · CNAME <code>Intranet</code> → racine', '<code>Intranet.05.EDIVN.lan</code> (intranet)'],
  ]) }),
  figure('/uploads/plat1-dns-zones.png', 'Gestionnaire DNS : les deux zones de recherche directe.'),
  figure('/uploads/plat1-dns-zone-www.png', 'Zone Groupe05-EDIVN.lan : A racine → 192.5.10.12 et CNAME www.'),
  figure('/uploads/plat1-dns-zone-intranet.png', 'Zone 05.EDIVN.lan : A racine → 192.5.10.12 et CNAME Intranet.'),
  note('blue', '🌐 Accès au site sur le port 8080', '<p>Le site est <strong>servi par IIS sur le port 8080</strong> (défini dans la <strong>liaison / binding</strong>). On y accède par <code>http://www.Groupe05-EDIVN.lan:8080</code> : le <strong>DNS</strong> résout le nom vers <code>192.5.10.12</code>, et le <code>:8080</code> correspond à la liaison IIS. <strong>Rappel</strong> : un enregistrement DNS (A/CNAME) ne transporte <strong>pas</strong> de port — c’est la <strong>liaison IIS</strong> qui fixe le 8080. Pour l’<strong>accès externe</strong>, prévoir une <strong>redirection de port (NAT/PAT)</strong> vers <code>192.5.10.12:8080</code> (étape 7).</p>'),
  note('gray', '🔗 Détails', '<p><a href="/pages/procedure-iis">IIS : héberger un site</a> · <a href="/pages/procedure-dns">DNS : zones & enregistrements</a> · <a href="/pages/procedure-dhcp">rôle DHCP</a>.</p>'),

  // ── Étape 6 ──
  step('6', 'DHCP — étendues & relais', 'Deux étendues + relais ip helper-address sur le routeur', C.dhcp),
  block('html', { html: '<p>Créer deux <strong>étendues</strong> sur SRV-1 (<code>192.5.10.12</code>), une par réseau, puis un <strong>relais</strong> sur le routeur pour les clients du réseau Utilisateurs.</p>' }),
  block('html', { html: tbl(['Étendue', 'Réseau', 'Plage distribuée', 'Passerelle (003)', 'DNS (006)'], [
    ['Etendue Admins', '192.5.10.0/28', '192.5.10.1 → .11', '192.5.10.14', '192.5.10.12'],
    ['Etendue Stagiaires', '192.5.50.0/24', '192.5.50.1 → .200', '192.5.50.254', '192.5.10.12'],
  ]) }),
  figure('/uploads/plat1-dhcp-etendues.png', 'Les deux étendues actives sur SRV-1 : « Etendue Admins » (192.5.10.0) et « Etendue Stagiaires » (192.5.50.0).'),
  figure('/uploads/plat1-dhcp-pool-admins.png', 'Pool de l’étendue Admins : 192.5.10.1 → 192.5.10.11.'),
  figure('/uploads/plat1-dhcp-pool-stagiaires.png', 'Pool de l’étendue Stagiaires : 192.5.50.1 → 192.5.50.200.'),
  figure('/uploads/plat1-dhcp-options-stagiaires.png', 'Options de l’étendue Stagiaires : 003 Routeur = 192.5.50.254, 006 DNS = 192.5.10.12.'),
  figure('/uploads/plat1-dhcp-options-admins.png', 'Options de l’étendue Admins : 003 Routeur = 192.5.10.14, 006 DNS = 192.5.10.12.'),
  block('heading', { level: 4, text: 'Réservations' }),
  block('html', { html: '<p>Le <strong>point d’accès Wi-Fi</strong> reçoit toujours la même adresse grâce à une <strong>réservation DHCP</strong> (association MAC → IP) : <code>192.5.50.251</code>. Cette adresse est <strong>hors du pool <code>.1–.200</code></strong>, donc aucun conflit possible.</p>' }),
  figure('/uploads/plat1-dhcp-reservations.png', 'Réservation DHCP « Reservation Wifi » → 192.5.50.251 dans l’étendue Stagiaires.'),
  note('gray', 'ℹ️ Exclusions', '<p>Les autres IP fixes de l’infra (Routeur_G5 <code>.252</code>, Sw-2 <code>.253</code>, passerelle <code>.254</code>) sont déjà <strong>au-dessus du pool</strong> → rien à exclure. Côté Admin, le poste en IP fixe est géré par <strong>réservation</strong> (ex. <code>192.5.10.5</code>).</p>'),
  block('heading', { level: 4, text: 'Relais DHCP sur R_IT_G5 (indispensable)' }),
  block('html', { html: '<p>Le serveur DHCP est dans le réseau Admin ; les clients Utilisateurs sont <strong>derrière le routeur</strong> → leurs demandes (des <strong>broadcasts</strong>) ne franchissent pas le routeur sans <strong>relais</strong>. On ajoute <code>ip helper-address</code> sur l’interface côté Utilisateurs :</p>' }),
  cmd(`configure terminal
interface GigabitEthernet0/1
 ip helper-address 192.5.10.12
 exit
end
write memory`),
  note('yellow', '🧪 Sans relais, pas d’adresse', '<p>Sans <code>ip helper-address</code>, les postes Stagiaire/Formateur ne reçoivent <strong>aucune adresse</strong> (leur broadcast DHCP reste bloqué au routeur).</p>'),
  block('html', { html: '<p><strong>Vérification</strong> (sur un poste du réseau Utilisateurs) :</p>' }),
  cmd(`ipconfig /release
ipconfig /renew
ipconfig /all      REM IP dans la plage .1-.200, passerelle .254, DNS 192.5.10.12`),
  figure('/uploads/plat1-dhcp-baux.png', 'Baux d’adresses attribués côté serveur (ex. PC-Jean-Marc → 192.5.10.1).'),
  note('gray', '🔗 Détails', '<p><a href="/pages/procedure-dhcp">DHCP : étendue, options & réservation</a> · <a href="/pages/procedure-dhcp-relais">DHCP par relais (ip helper-address)</a>.</p>'),

  // ── Étape 7 ──
  step('7', 'Routage inter-routeurs & accès Internet', 'NAT/PAT sur le routeur de bordure + routes par défaut', C.nat),
  note('blue', '🗺️ Deux routeurs, deux rôles', '<p><strong>R_IT_G5</strong> = routeur <strong>interne</strong> (passerelle des clients, relie Utilisateurs et Admin). <strong>Routeur_G5</strong> = routeur de <strong>bordure</strong> : il fait le <strong>NAT/PAT</strong> vers le réseau de la salle (<code>172.16.3.0/24</code>) pour donner Internet.</p>'),
  block('html', { html: tbl(['Routeur', 'Interface', 'IP', 'Rôle NAT'], [
    ['Routeur_G5', 'LAN (vers Sw-2)', '192.5.50.252 /24', 'ip nat inside'],
    ['Routeur_G5', 'WAN (vers salle)', '172.16.3.250 /24', 'ip nat outside'],
    ['R_IT_G5', 'LAN Utilisateurs', '192.5.50.254 /24', '—'],
    ['R_IT_G5', 'LAN Admin', '192.5.10.14 /28', '—'],
  ]) }),
  block('heading', { level: 4, text: 'Configuration de Routeur_G5 (bordure)' }),
  block('html', { html: '<p><strong>NAT/PAT</strong> : l’ACL <code>LAN</code> désigne les réseaux <em>internes</em> à traduire ; le PAT (<code>overload</code>) les masque tous derrière l’IP de l’interface WAN.</p>' }),
  cmd(`enable
configure terminal
hostname Routeur_G5
!
! --- Interfaces ---
interface FastEthernet0/0
 description LAN Utilisateurs
 ip address 192.5.50.252 255.255.255.0
 ip nat inside
 no shutdown
 exit
interface FastEthernet0/1
 description Sortie salle / autres ecoles
 ip address 172.16.3.250 255.255.255.0     ! IP WAN fournie par la salle
 ip nat outside
 no shutdown
 exit
!
! --- NAT/PAT : les reseaux internes sortent derriere l'IP WAN ---
ip access-list standard LAN
 permit 192.5.50.0 0.0.0.255
 permit 192.5.10.0 0.0.0.15
 exit
ip nat inside source list LAN interface FastEthernet0/1 overload
!
! --- Routage ---
ip route 0.0.0.0 0.0.0.0 172.16.3.254             ! sortie Internet (passerelle salle)
ip route 192.5.10.0 255.255.255.240 192.5.50.254  ! LAN Admin, via R_IT_G5
end
write memory`),
  block('heading', { level: 4, text: 'Complément sur R_IT_G5 (indispensable pour Internet)' }),
  note('red', '⚠️ Route par défaut manquante = pas d’Internet', '<p>Les clients ont R_IT_G5 pour passerelle : il doit renvoyer tout l’inconnu vers Routeur_G5. Sans cette route par défaut, le trafic Internet s’arrête sur R_IT_G5.</p>'),
  cmd(`! sur R_IT_G5
configure terminal
ip route 0.0.0.0 0.0.0.0 192.5.50.252
end
write memory`),
  block('html', { html: '<p><strong>Vérification</strong> :</p>' }),
  cmd(`! sur Routeur_G5
show ip route             ! une seule default -> 172.16.3.254
show access-lists LAN     ! permit 192.5.50.0 / 192.5.10.0
show ip nat translations  ! des lignes apparaissent quand un client sort
! sur un client du LAN
ping 172.16.3.254         ! passerelle WAN
ping 8.8.8.8              ! Internet (via PAT)`),

  block('heading', { level: 4, text: 'Accès externe au site (redirection de port)' }),
  note('blue', '🌍 Publier le site vers la salle', '<p>Le serveur <code>192.5.10.12</code> est en <strong>adresse privée</strong> → injoignable directement depuis la salle. On <strong>publie le port 8080</strong> de Routeur_G5 vers le serveur (NAT statique entrant / port forwarding). <strong>NAT = joindre</strong> ; c’est indépendant du DNS.</p>'),
  cmd(`! sur Routeur_G5 — rediriger le port 8080 externe vers le serveur IIS
configure terminal
ip nat inside source static tcp 192.5.10.12 8080 interface FastEthernet0/1 8080
end
write memory
! depuis la salle :  http://172.16.3.250:8080
! (confort : publier le port 80 -> 8080 pour eviter de taper :8080)
! ip nat inside source static tcp 192.5.10.12 8080 interface FastEthernet0/1 80`),
  note('yellow', '🌐 Résolution du nom (DNS) pour la salle', '<p>Votre DNS (SRV-1) résout <code>www.Groupe05-EDIVN.lan → 192.5.10.12</code>, une IP <strong>privée inatteignable</strong> de l’extérieur. Deux options :</p><ul><li><strong>Le plus simple</strong> : la salle accède par l’<strong>IP publique</strong> <code>http://172.16.3.250:8080</code> — aucun DNS requis.</li><li><strong>Par le nom</strong> : ajouter sur le <strong>DNS de la salle</strong> un enregistrement <code>www.Groupe05-EDIVN.lan → 172.16.3.250</code> (l’IP <strong>WAN</strong>, pas la privée) — c’est du <strong>DNS « split »</strong> (interne = <code>.10.12</code>, externe = <code>172.16.3.250</code>).</li></ul><p>⚠️ Le DNS ne transporte <strong>pas</strong> de port : la salle tape <code>:8080</code> (sauf si vous publiez le port 80).</p>'),
  note('gray', '🧪 Vérification', '<p><code>show ip nat translations</code> (l’entrée statique <code>tcp</code> apparaît) · depuis la salle, ouvrir <code>http://172.16.3.250:8080</code> · penser à <strong>autoriser HTTP entrant</strong> dans le pare-feu Windows de SRV-1.</p>'),
  note('gray', '🔗 Détails', '<p><a href="/pages/procedure-routes-statiques">Routes statiques</a> · <a href="/pages/procedure-nat">NAT / PAT</a> · <a href="/pages/procedure-cisco-routeur-cli">Config routeur Cisco (CLI)</a>.</p>'),

  // ── Étape 8 ──
  step('8', 'Point d’accès Wi-Fi — Cisco WAP 371', 'SSID EDWIN05, IP fixe, clients en DHCP', C.wifi),
  block('html', { html: '<p>Le WAP 371 diffuse le Wi-Fi des stagiaires/formateurs. Il reçoit une <strong>IP fixe</strong> (<code>192.5.50.251</code>) et ses clients obtiennent leur IP par <strong>DHCP</strong> (le relais de l’étape 6 est déjà en place).</p>' }),
  ul([
    'Attribuer au WAP l’<strong>IP fixe <code>192.5.50.251</code></strong> (masque <code>/24</code>, passerelle <code>192.5.50.254</code>) et le connecter en port access sur <strong>Sw-2</strong>.',
    'Accéder à l’interface d’administration du WAP (navigateur → IP du point d’accès).',
    'Créer le <strong>SSID</strong> <code>SSID-EDWIN05</code>, activer la <strong>sécurité WPA2-PSK</strong> et définir la clé.',
    'Laisser les clients Wi-Fi en <strong>DHCP</strong> (ils tombent dans l’étendue Utilisateurs <code>.1–.200</code>).',
  ]),
  note('yellow', '🔍 Vérification', '<p>Associer un client au SSID <code>SSID-EDWIN05</code> → il doit recevoir une <strong>IP <code>192.5.50.x</code></strong> par DHCP, joindre sa passerelle <code>.254</code> et accéder au site / à Internet.</p>'),

  block('heading', { level: 2, text: '✅ Tests de validation (bout en bout)' }),
  ul([
    '<strong>SSH</strong> depuis le poste admin vers R_IT_G5, SW-1, Sw-2 et Routeur_G5 (<code>ssh -l admin &lt;IP&gt;</code>).',
    '<strong>DHCP</strong> : un client Utilisateurs reçoit une IP <code>.1–.200</code>, passerelle <code>.254</code>, DNS <code>192.5.10.12</code>.',
    '<strong>Routage inter-réseaux</strong> : depuis un client, <code>ping 192.5.10.12</code> (serveur) et <code>ping 192.5.10.14</code> (passerelle Admin).',
    '<strong>DNS</strong> : <code>nslookup www.Groupe05-EDIVN.lan</code> → <code>192.5.10.12</code>.',
    '<strong>Web</strong> : <code>http://www.Groupe05-EDIVN.lan:8080</code> et l’intranet s’affichent.',
    '<strong>Internet</strong> : <code>ping 8.8.8.8</code> depuis un client ; <code>show ip nat translations</code> se remplit sur Routeur_G5.',
    '<strong>Wi-Fi</strong> : association au SSID <code>SSID-EDWIN05</code> + IP DHCP.',
  ]),

  block('heading', { level: 2, text: '🧰 Pièges fréquents & dépannage' }),

  acc('① Les VM ne communiquent pas — commutateur externe sur la mauvaise carte', [
    block('html', { html: '<p><strong>Symptôme</strong> : les VM n’ont pas de connectivité vers la maquette.<br><strong>Cause</strong> : le <strong>commutateur virtuel externe</strong> Hyper-V est rattaché à la <strong>mauvaise carte réseau physique</strong>.<br><strong>Solution</strong> : Gestionnaire Hyper-V → <em>Gestionnaire de commutateur virtuel</em> → commutateur <strong>Externe</strong> → sélectionner la <strong>bonne carte</strong> → OK. Vérifier ensuite, dans les <em>Paramètres</em> de chaque VM, que la carte réseau est connectée à ce commutateur.</p>' }),
  ]),

  acc('② SSH ne fonctionne pas — clé RSA invalide ou client Windows incompatible', [
  note('yellow', '🔑 Cause 1 & solution : clé RSA', '<p>La <strong>clé RSA</strong> a été générée <strong>avant</strong> d’avoir fixé le <code>hostname</code> et le <code>ip domain-name</code> (ou l’équipement a été renommé ensuite) → la clé porte un mauvais nom. <strong>Solution</strong> : fixer hostname + domaine, puis <strong>supprimer et régénérer</strong> la clé.</p>'),
  cmd(`configure terminal
ip domain-name edivn.lan
crypto key zeroize rsa          ! supprime l'ancienne cle
crypto key generate rsa
1024                            ! la longueur, seule sur sa ligne
ip ssh version 2
line vty 0 4
 login local
 transport input ssh
 exit
end
! Verifications :
show ip ssh                     ! doit indiquer SSH Enabled, version 2.0
show crypto key mypubkey rsa    ! la cle doit exister
! Test depuis un client : ssh -l admin 192.5.10.13`),
  note('red', '🖥️ Cause 2 & solution : client SSH Windows incompatible → PuTTY / MobaXterm', '<p>Même avec une clé valide, la connexion peut échouer avec un message du type <em>« Unable to negotiate… no matching key exchange method / host key type »</em>. Le <strong>client OpenSSH natif de Windows</strong> (commande <code>ssh</code>) <strong>désactive par défaut les algorithmes hérités</strong> (<code>diffie-hellman-group1-sha1</code>, clé d’hôte <code>ssh-rsa</code>, chiffrements <code>aes-cbc</code>/<code>3des</code>) que les <strong>anciens IOS Cisco du lab</strong> sont seuls à proposer → aucune négociation possible.</p><p><strong>Solution : se connecter avec <a href="https://www.putty.org/" target="_blank" rel="noopener">PuTTY</a> ou <a href="https://mobaxterm.mobatek.net/" target="_blank" rel="noopener">MobaXterm</a></strong>, qui prennent encore en charge ces algorithmes hérités. C’est la méthode fiable sur le matériel à disposition.</p>'),
  ul([
    '<strong>PuTTY</strong> : <em>Host Name</em> = l’IP de l’équipement (ex. <code>192.5.10.13</code>), <em>Port</em> <code>22</code>, <em>Connection type</em> <strong>SSH</strong> → <em>Open</em>, puis login <code>admin</code> / <code>cisco</code>.',
    '<strong>MobaXterm</strong> : <em>Session → SSH</em>, <em>Remote host</em> = l’IP, <em>Specify username</em> = <code>admin</code> → OK.',
    'Dépannage seulement, si l’on tient au client natif : <code>ssh -o KexAlgorithms=+diffie-hellman-group1-sha1 -o HostKeyAlgorithms=+ssh-rsa -l admin &lt;IP&gt;</code> (moins pratique — PuTTY/MobaXterm restent conseillés).',
  ]),
  note('gray', 'ℹ️ À contrôler aussi', '<ul><li>Un <strong>compte local</strong> existe : <code>username admin privilege 15 secret cisco</code>.</li><li>Modulus <strong>≥ 768</strong> (1024 recommandé) pour SSHv2.</li><li>Utilisez <strong>SSH</strong> (pas <code>telnet</code>).</li></ul>'),
  ]),

  acc('③ Ping d’un poste vers le serveur qui échoue (l’inverse fonctionne)', [
  note('yellow', '🛡️ Cause & solution : pare-feu Windows du serveur', '<p>Si le sens <strong>Serveur → poste</strong> fonctionne, le <strong>routage est bon</strong>. Ce qui échoue, c’est le <strong>ping entrant</strong> : le <strong>pare-feu Windows</strong> bloque par défaut l’<strong>ICMP entrant</strong> non sollicité (surtout depuis un autre sous-réseau). <strong>Solution : autoriser l’ICMP echo entrant</strong> sur le serveur.</p>'),
  cmd(`REM Sur le SERVEUR Windows (invite admin) — autoriser le ping entrant IPv4 :
netsh advfirewall firewall add rule name="ICMPv4 Echo In" protocol=icmpv4:8,any dir=in action=allow

REM ou en PowerShell (admin) :
Enable-NetFirewallRule -DisplayName "Partage de fichiers et d'imprimantes (demande d'echo - trafic entrant ICMPv4)"`),
  note('gray', 'ℹ️ Détail', '<p>Pas-à-pas illustré : <a href="/pages/astuce-pare-feu-ping">Autoriser le ping (ICMP) dans le pare-feu</a>.</p>'),
  ]),

  acc('④ Impossible de pinguer un autre réseau depuis un hôte Hyper-V à deux cartes', [
  note('yellow', '🔎 Diagnostic', '<p>D’abord vérifier l’évidence : sur R_IT_G5, <code>show ip interface brief</code> (les 2 interfaces <strong>up/up</strong>) et, côté client, <code>ipconfig /all</code> (bon masque <strong>/24</strong> et <strong>passerelle par défaut</strong> <code>192.5.50.254</code>). <strong>Piège</strong> : pinguer sa <em>propre</em> passerelle réussit même sans passerelle par défaut (même sous-réseau) — ça ne prouve rien sur le routage.</p>'),
  note('red', '🎯 Cause fréquente : hôte multi-homé (2 passerelles par défaut)', '<p>Si vous testez depuis l’<strong>hôte Hyper-V</strong> et qu’il a <strong>deux cartes</strong> (une physique DHCP vers la salle <code>172.16.3.x</code>, une vEthernet du lab <code>192.5.50.x</code>), Windows applique la <strong>route par défaut de la carte physique</strong> pour tout réseau non directement connecté. Le ping part alors <strong>vers Internet</strong> au lieu du routeur du lab — le routage Cisco n’est pas en cause.</p>'),
  cmd(`:: preuve : le 1er saut sort par la mauvaise carte
tracert -d 192.5.10.14      ! 1er saut = 172.16.3.254 => mauvais chemin

:: fix ponctuel : router le reseau Admin par le routeur du lab
route add 192.5.10.0 mask 255.255.255.240 192.5.50.254 -p
tracert -d 192.5.10.14      ! 1er saut doit devenir 192.5.50.254`),
  note('green', '✅ Solutions', '<p>(1) Tester depuis une <strong>VM à une seule carte</strong> sur le réseau Utilisateurs (elle atteint l’autre réseau sans rien ajouter) ; ou (2) <strong>désactiver la carte inutile</strong> le temps du test ; ou (3) ne garder <strong>qu’une seule passerelle par défaut</strong> sur l’hôte + des <strong>routes statiques</strong> vers les sous-réseaux du lab.</p>'),
  note('gray', '🔗 Méthode', '<p><a href="/pages/procedure-test-connectivite">Test de connectivité méthodique</a> (dérouler dans l’ordre : lien → passerelle → réseau distant).</p>'),
  ]),

  acc('⑤ Câble RJ45 débranché — simple mais très bloquant', [
    note('yellow', '🔌 Le réflexe à avoir', '<p>Un câble <strong>RJ45</strong> mal enclenché (languette cassée, prise à demi enfoncée) peut se <strong>débrancher tout seul</strong> — parfois sans qu’on y touche. Résultat : une machine ou un segment entier tombe, alors que <strong>toute la configuration est correcte</strong>. On cherche longtemps un problème logiciel qui n’existe pas.</p>'),
    ul([
      'Symptômes : lien <code>down/down</code> sur <code>show ip interface brief</code>, voyant de port <strong>éteint</strong>, plus de ping, un poste qui perd son bail DHCP.',
      '<strong>Vérifiez physiquement les câbles périodiquement</strong> — surtout après avoir bougé un équipement, et dès qu’un test échoue « sans raison ».',
      'Réenclenchez à fond jusqu’au <em>clic</em>. Si la languette est cassée, <strong>remplacez le câble</strong>.',
      'Contrôlez les deux extrémités (côté machine <em>et</em> côté switch) et les liaisons montantes routeur ↔ switch.',
    ]),
    note('gray', '💡 Avant de suspecter la config', '<p>Face à une panne réseau soudaine, commencez <strong>toujours</strong> par la <strong>couche 1</strong> (câble, voyant, port) avant de rouvrir la CLI. C’est la cause la plus fréquente et la plus vite écartée.</p>'),
  ]),
];

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
  const res = cur ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body }) : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log(`PAGE ${PAGE.slug}`, res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());
  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

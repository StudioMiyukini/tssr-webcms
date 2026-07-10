/* Procédure « Plateforme 1 » : montage de l'infrastructure réalisée pendant l'exercice.
   Squelette — le contenu sera rédigé étape par étape (dicté par l'utilisateur).
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-procedure-plateforme-1.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'procedure-plateforme-1', title: 'Plateforme 1 — infrastructure EDIVN', excerpt: 'Montage de l’infrastructure de l’École de Développement Informatique (EDIVN) : cahier des charges (contexte, mission, sous-réseaux, DHCP, Wi-Fi, serveurs DNS/Web, SSH), livrables attendus et Annexe 1 (configuration des VM). La réalisation pas-à-pas suit.' };
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const th = (t: string) => `<th style="border:1px solid var(--border);padding:7px 10px;text-align:left;background:var(--surface-2)">${t}</th>`;
const td = (t: string) => `<td style="border:1px solid var(--border);padding:7px 10px">${t}</td>`;
const tbl = (head: string[], rows: string[][]) => `<div style="overflow-x:auto;margin:6px 0"><table style="border-collapse:collapse;width:100%;min-width:440px;font-size:13px"><thead><tr>${head.map(th).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(td).join('')}</tr>`).join('')}</tbody></table></div>`;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stepsStyle = block('html', { html: `<style>.proc-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="proc-cmd">${esc(t)}</div>` });
// Liste HTML (les items peuvent contenir des balises — contrairement au bloc « list » qui les échappe).
const ul = (items: string[]) => block('html', { html: `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>` });

// ── Contenu ──
const annexe1 = `<div style="overflow-x:auto;margin:6px 0"><table style="border-collapse:collapse;width:100%;min-width:560px;font-size:13px">
<thead><tr>${['Caractéristique', 'VM Serveur 1', 'VM Serveur 2', 'VM Client'].map(th).join('')}</tr></thead>
<tbody>
${[
  ['Nom de la VM', '<strong>SRV-DNS</strong>', '<strong>SRV-IIS</strong>', '<strong>CLIENT-W</strong>'],
  ['Mémoire (RAM)', '2048 Mo', '2048 Mo', '1024 Mo'],
  ['Stockage', 'C : 30 Go', 'C : 30 Go', 'C : 20 Go'],
  ['Commutateur', 'Privé / Interne', 'Privé / Interne', 'Privé / Interne'],
  ['Adresse IP', '192.168.10.11', '192.168.10.12', '192.168.10.101'],
  ['Masque', '255.255.255.0', '255.255.255.0', '255.255.255.0'],
  ['Serveur DNS', 'SRV-DNS', 'SRV-DNS', 'SRV-DNS'],
  ['Nom de domaine', '<em>GroupeXX-EDIVN.lan</em> (à définir)', '—', '—'],
].map(r => `<tr>${td(`<strong>${r[0]}</strong>`)}${td(r[1])}${td(r[2])}${td(r[3])}</tr>`).join('')}
</tbody></table></div>`;

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Procédure · Projet', title: 'Plateforme 1 — infrastructure EDIVN', subtitle: 'Restructurer et monter le réseau de l’École de Développement Informatique (EDIVN).' }),
  stepsStyle,

  note('blue', '🏫 Contexte', '<p>L’<strong>École de Développement Informatique EDIVN</strong> forme des développeurs et souhaite <strong>restructurer son réseau</strong> pour gagner en efficacité et en sécurité. Dans le cadre de son agrandissement, chaque site dispose d’une équipe pour restructurer le réseau. M. Dupont nous confie cette mission.</p>'),

  block('heading', { level: 2, text: '🎯 Mission' }),
  ul([
    'Configurer les routeurs : routage entre les différents réseaux de la structure et vers les autres écoles.',
    'Configurer les serveurs : mise en service du serveur DNS et du serveur Web.',
    'Sécuriser le réseau : accès de management à distance en SSH sur le switch et le routeur (mot de passe : cisco).',
    'Configurer le point d’accès sans-fil Cisco : Wi-Fi pour les utilisateurs.',
    'Accès site Web : permettre l’accès au site web de chaque site.',
  ]),

  block('heading', { level: 2, text: '📋 Cahier des charges (besoins)' }),

  block('heading', { level: 3, text: 'Sous-réseaux' }),
  ul([
    '<strong>Réseau Admin (IT)</strong> : postes de travail des administrateurs + serveur DNS/Web.',
    '<strong>Réseau Utilisateurs</strong> : postes de travail des formateurs et stagiaires.',
  ]),

  block('heading', { level: 3, text: 'Wi-Fi' }),
  block('html', { html: '<p>Un point d’accès <strong>Cisco WAP 371</strong> fournit le Wi-Fi aux stagiaires et formateurs, avec un <strong>SSID</strong> spécifique <code>SSID-EDWINXX</code> et une attribution d’<strong>IP dynamiques par DHCP</strong>.</p>' }),

  block('heading', { level: 3, text: 'DHCP' }),
  block('html', { html: '<p>Un service <strong>DHCP</strong> (solution libre) gère l’attribution des configurations réseau pour <strong>l’ensemble du réseau</strong> de l’école.</p>' }),

  block('heading', { level: 3, text: 'Serveur Web (réseau IT, IP fixe)' }),
  block('html', { html: '<p>Hébergé dans le réseau IT, il héberge les sites de l’école. Deux sites à créer :</p>' }),
  ul([
    'Site 1 : <code>www.GroupeXX-EDIVN.lan</code> sur le <strong>port 8080</strong>, accessible <strong>depuis l’extérieur</strong>.',
    'Site 2 (intranet) : <code>Intranet.XX.EDIVN.lan</code>, accessible <strong>pour l’école</strong>, avec une page d’accueil affichant « <em>Bienvenue sur le site de l’école EDIVN</em> ».',
  ]),

  block('heading', { level: 3, text: 'Switches & accès distant' }),
  ul([
    'Renommer <strong>l’ensemble des switches</strong>.',
    'Mettre en place une connexion à distance <strong>SSH</strong> sur le switch et le routeur (mot de passe : <code>cisco</code>).',
  ]),

  block('heading', { level: 2, text: '📦 Dossier technique attendu (livrables)' }),
  ul([
    '<strong>Schéma logique</strong> : architecture réseau (sous-réseaux, équipements, interconnexions).',
    '<strong>Configuration des machines</strong> (Annexe 1) : matériel et logiciel de chaque machine.',
    '<strong>Configuration des switches et du routeur</strong> (Annexe 2) : paramètres réseau.',
    '<strong>Tables de routage</strong> : captures / listes des routes configurées.',
    '<strong>Borne Wi-Fi</strong> : captures montrant son fonctionnement.',
  ]),

  block('heading', { level: 2, text: '🗺️ Schéma logique & plan d’adressage (validé — Groupe 5)' }),
  note('gray', '🖼️ Schéma', '<p>Le schéma logique (draw.io) est <strong>validé</strong>. Pour l’afficher ici, dépose le <strong>fichier .png</strong> exporté et je l’intègre à cet endroit. Voici le plan d’adressage qu’il fixe.</p>'),

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
    ['Formateur', '192.5.50.3', 'poste — <strong>via DHCP</strong>'],
    ['CISCO WAP 371', '192.5.50.124', 'point d’accès Wi-Fi (SSID-EDWIN05)'],
    ['Sw-2', '192.5.50.253', 'switch — IP de gestion'],
    ['Passerelle (R_IT_G5 Gi0/1)', '<strong>192.5.50.254</strong>', 'passerelle du réseau'],
  ]) }),
  block('html', { html: '<p class="meta" style="font-size:12px">Masque <code>255.255.255.0</code> · les postes Stagiaire/Formateur et le Wi-Fi reçoivent leur IP par <strong>DHCP</strong>.</p>' }),

  block('heading', { level: 3, text: 'Liaison extérieure / autres écoles — 172.16.3.0/24' }),
  block('html', { html: tbl(['Équipement', 'Adresse IP', 'Rôle'], [
    ['Routeur_G5 Gi0/0', '172.16.3.250', 'sortie vers le nuage / les autres écoles (réseau « Salle »)'],
  ]) }),

  block('heading', { level: 3, text: 'Routeurs & interfaces' }),
  block('html', { html: tbl(['Routeur', 'Interface', 'Réseau', 'Adresse IP'], [
    ['R_IT_G5', 'Gi0/0', 'Admin 192.5.10.0/28', '192.5.10.14'],
    ['R_IT_G5', 'Gi0/1', 'Utilisateurs 192.5.50.0/24', '192.5.50.254'],
    ['Routeur_G5', 'Gi0/0', 'Extérieur 172.16.3.0/24', '172.16.3.250'],
    ['Routeur_G5', 'Gi0/1', 'Utilisateurs 192.5.50.0/24', '192.5.50.254 ⚠️'],
  ]) }),
  note('yellow', '⚠️ 2 points à vérifier avant de configurer', '<ul><li><strong>Conflit d’adresse</strong> : <strong>R_IT_G5</strong> et <strong>Routeur_G5</strong> portent tous les deux <code>192.5.50.254</code> sur le réseau Utilisateurs — impossible (2 machines, même IP). Une seule est la passerelle des clients (<code>.254</code>) ; donne à l’autre routeur une <strong>IP libre distincte</strong> (ex. <code>192.5.50.252</code>) sur ce segment, et prévois le <strong>routage</strong> entre les deux.</li><li><strong>Étiquette de masque</strong> : sur le schéma, l’interface <code>R_IT_G5 Gi0/0</code> est notée <code>/24</code> alors que le réseau Admin est en <strong>/28</strong> (<code>255.255.255.240</code>). Corrige l’étiquette en <code>/28</code>.</li></ul>'),

  block('heading', { level: 2, text: '🖥️ Annexe 1 — configuration des machines virtuelles' }),
  block('html', { html: annexe1 }),
  note('gray', 'ℹ️ Remarques', '<p>Toutes les VM sont sur le commutateur <strong>Privé/Interne</strong> et pointent vers <strong>SRV-DNS</strong> comme serveur DNS. Le <strong>nom de domaine</strong> reste à définir (ex. <code>GroupeXX-EDIVN.lan</code>) ; remplace <code>XX</code> par ton numéro de groupe partout.</p>'),

  block('heading', { level: 2, text: '🔧 Réalisation pas à pas' }),
  block('html', { html: '<p>Ce que nous avons effectué, dans l’ordre. Cette partie s’étoffe au fur et à mesure du montage.</p>' }),

  block('heading', { level: 3, text: 'Étape 1 — Routeur R_IT_G5 : interfaces + SSH' }),
  block('html', { html: '<p>Configuration des <strong>deux interfaces</strong> du routeur interne (côté Admin/IT et côté Utilisateurs) puis de l’<strong>accès de management à distance en SSH</strong> (mot de passe <code>cisco</code>, comme demandé dans le cahier des charges). Toute cette configuration se fait <strong>depuis la console</strong> (onglet <code>CLI</code> sous Packet Tracer, ou câble console sur un équipement réel) — le SSH n’étant pas encore actif.</p>' }),
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
ip domain-name G5-EDIVN.lan
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
  note('gray', 'ℹ️ Points clés', '<ul><li><code>Gi0/0</code> = passerelle du réseau <strong>Admin/IT</strong> (<code>192.5.10.14/28</code>), <code>Gi0/1</code> = passerelle du réseau <strong>Utilisateurs</strong> (<code>192.5.50.254/24</code>).</li><li>SSH exige un <strong>hostname</strong>, un <strong>ip domain-name</strong> et des <strong>clés RSA</strong> (le <code>1024</code> seul répond à la question de longueur de clé). <code>login local</code> utilise le compte <code>username</code>.</li><li>Nom de domaine <code>G5-EDIVN.lan</code> à ajuster selon le domaine retenu.</li></ul>'),
  block('html', { html: '<p><strong>Vérification :</strong></p>' }),
  cmd(`do show ip interface brief
! Gi0/0 -> 192.5.10.14  up/up  |  Gi0/1 -> 192.5.50.254  up/up
! puis, depuis un client : ssh -l admin 192.5.10.14`),
  note('gray', '🔗 Rappels', '<p>Détails : <a href="/pages/procedure-cisco-routeur-cli">Configurer un routeur en CLI</a> · <a href="/pages/procedure-ssh-packet-tracer">SSH sur Packet Tracer</a>. Si <code>enable</code> refuse après SSH : voir <a href="/depannage">Dépannage</a>.</p>'),

  block('heading', { level: 3, text: 'Étape 2 (en parallèle) — Préparation des VM sur l’hôte Hyper-V' }),
  block('html', { html: '<p>Pendant la configuration du routeur, on prépare les deux machines Windows du réseau Admin/IT — le <strong>Poste Admin 1</strong> et le <strong>Serveur DHCP-DNS-Web</strong> — <strong>sur le même hôte Hyper-V</strong>.</p>' }),
  ul([
    'Créer les 2 VM (Gestionnaire Hyper-V → <strong>Nouvel ordinateur virtuel</strong>, génération 2), selon l’Annexe 1 : <strong>Serveur</strong> 2048 Mo / 30 Go, <strong>Poste</strong> 1024 Mo / 20 Go.',
    'Connecter les deux au <strong>même commutateur virtuel</strong> (privé / interne) = segment <strong>Admin/IT</strong>.',
    'Installer les OS : <strong>Windows Server</strong> (édition Expérience de bureau) sur la VM serveur, <strong>Windows 10 Pro</strong> sur le poste admin ; définir le mot de passe administrateur.',
    'Renommer les machines et appliquer l’<strong>IP fixe</strong> (voir le tableau ci-dessous).',
  ]),
  block('html', { html: tbl(['VM', 'Nom', 'IP / masque', 'Passerelle', 'DNS'], [
    ['Serveur', 'SRV (DHCP-DNS-Web)', '<strong>192.5.10.12</strong> /28', '192.5.10.14', '192.5.10.12 (lui-même)'],
    ['Poste admin', 'Poste-Admin-1', '192.5.10.1 /28', '192.5.10.14', '192.5.10.12'],
  ]) }),
  note('blue', '🧩 Rôles du serveur SRV', '<p>Le serveur <strong>Windows Server</strong> (<code>192.5.10.12</code>) portera <strong>trois rôles</strong>, installés aux étapes suivantes : <strong>DHCP</strong> (attribution des IP aux postes du réseau Utilisateurs, via relais), <strong>DNS</strong> (résolution des noms + zones du domaine) et <strong>Serveur Web / IIS</strong> (les 2 sites : <code>www.Groupe5-EDIVN.lan</code> sur le port 8080 et l’intranet). Le poste admin est un simple client <strong>Windows 10 Pro</strong>.</p>'),
  note('gray', 'ℹ️ Points clés', '<ul><li>Les deux VM sont sur le <strong>même hôte</strong> et le <strong>même commutateur virtuel</strong> (privé/interne) → elles communiquent sur le réseau Admin/IT <code>192.5.10.0/28</code>.</li><li>Le poste et (plus tard) les serveurs pointent vers le <strong>serveur DNS = 192.5.10.12</strong>.</li><li>Masque <code>/28</code> = <code>255.255.255.240</code>, passerelle <code>192.5.10.14</code> (interface Gi0/0 du routeur).</li></ul>'),
  note('gray', '🔗 Détails', '<p><a href="/pages/procedure-vm-hyperv">Créer & configurer une VM (ISO) sur Hyper-V</a> · <a href="/pages/procedure-hyperv-ressources">Hyper-V : ressources</a> · <a href="/pages/procedure-ip-fixe-windows">Configurer une IP fixe</a> · <a href="/pages/procedure-renommer-poste">Renommer un poste</a>.</p>'),

  block('heading', { level: 3, text: 'Étape 3 — Switches (SW-1, Sw-2) : renommage, IP de gestion & SSH' }),
  block('html', { html: '<p>On <strong>renomme</strong> les deux switches, on leur attribue une <strong>IP de gestion</strong> (SVI <code>VLAN 1</code>) pour l’administration à distance, et on active <strong>SSH</strong> (mot de passe <code>cisco</code>). Configuration depuis la console.</p>' }),
  cmd(`enable
configure terminal
hostname SW-1
ip domain-name G5-EDIVN.lan
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

  block('heading', { level: 3, text: 'Étape 4 — Câblage (tout branché)' }),
  ul([
    '<strong>SW-1</strong> (Admin/IT) : Poste Admin 1 et Serveur en <strong>ports access</strong> ; liaison montante vers <strong>R_IT_G5 Gi0/0</strong>.',
    '<strong>Sw-2</strong> (Utilisateurs) : Stagiaire, Formateur et le <strong>WAP 371</strong> en ports access ; liaisons vers <strong>R_IT_G5 Gi0/1</strong> et <strong>Routeur_G5</strong>.',
    '<strong>Routeur_G5</strong> : côté Utilisateurs (Sw-2) et côté extérieur (<code>172.16.3.0/24</code>) vers le nuage / les autres écoles.',
  ]),
  note('yellow', '🔗 Vérifications', '<ul><li><code>show ip interface brief</code> sur chaque switch → <strong>Vlan1 up/up</strong>.</li><li>Voyants des ports (Packet Tracer) au <strong>vert</strong> une fois tout branché.</li><li>Depuis le poste admin : <code>ssh -l admin 192.5.10.13</code> (SW-1) et un <code>ping</code> vers la passerelle.</li></ul>'),

  block('heading', { level: 3, text: 'Étape 5 — Serveur : rôles, sites Web (IIS) & DNS' }),
  block('html', { html: '<p>Sur le serveur Windows (<code>192.5.10.12</code>) : installation des <strong>rôles</strong>, création des <strong>2 sites Web</strong> et des <strong>enregistrements DNS</strong>.</p>' }),
  block('heading', { level: 4, text: 'Rôles installés' }),
  ul(['Rôle <strong>DHCP</strong> (à configurer : étendue réseau Utilisateurs + relais).', 'Rôle <strong>DNS</strong> (zones + enregistrements).', 'Rôle <strong>Serveur Web (IIS)</strong>.']),
  block('heading', { level: 4, text: 'Sites Web (IIS)' }),
  ul([
    'Un <strong>dossier par site</strong> avec un fichier <code>index.html</code> ; la page de l’intranet affiche « <em>Bienvenue sur le site de l’école EDIVN</em> ».',
    'Site 1 — <code>www.Groupe5-EDIVN.lan</code> : liaison HTTP sur le <strong>port 8080</strong>, accessible depuis l’extérieur.',
    'Site 2 — intranet (<code>Intranet.5.EDIVN.lan</code>) : liaison HTTP, accessible pour l’école.',
  ]),
  block('heading', { level: 4, text: 'Enregistrements DNS' }),
  ul([
    'Enregistrement <strong>A</strong> pour le <strong>domaine racine</strong> : <code>Groupe5-EDIVN.lan → 192.5.10.12</code>.',
    'Un <strong>alias (CNAME)</strong> <code>www</code> → domaine racine (et l’entrée pour l’intranet).',
  ]),
  note('yellow', '⚠️ Un enregistrement DNS ne porte pas de port', '<p>Un <strong>A/CNAME résout seulement un nom en IP</strong> — il ne contient <strong>pas</strong> le port. Le <code>8080</code> vient de la <strong>liaison IIS</strong>, pas de l’alias : l’URL reste donc <code>http://www.Groupe5-EDIVN.lan:8080</code>. Pour l’atteindre <strong>sans taper « :8080 »</strong>, il faut l’une de ces solutions : une <strong>liaison sur le port 80 avec en-tête d’hôte</strong>, une <strong>redirection HTTP</strong> vers :8080, ou une <strong>redirection de port (NAT/PAT)</strong> sur le routeur pour l’accès externe. <em>(Préciser la méthode retenue.)</em></p>'),
  note('gray', 'ℹ️ Cohérence du domaine', '<p>Utilise le <strong>même nom de domaine</strong> partout : la zone DNS, les <code>ip domain-name</code> des routeurs/switches et les URL des sites (ex. tout en <code>Groupe5-EDIVN.lan</code>).</p>'),
  note('gray', '🔗 Détails', '<p><a href="/pages/procedure-iis">IIS : héberger un site</a> · <a href="/pages/procedure-dns">DNS : zones & enregistrements</a> · <a href="/pages/procedure-dhcp">rôle DHCP</a>.</p>'),

  block('heading', { level: 2, text: '🔧 Problèmes rencontrés & résolution' }),

  block('heading', { level: 3, text: '① Commutateur externe Hyper-V sur la mauvaise carte réseau — ✅ résolu' }),
  block('html', { html: '<p><strong>Symptôme</strong> : les VM ne communiquaient pas avec la maquette (pas de connectivité vers le réseau).<br><strong>Cause</strong> : le <strong>commutateur virtuel externe</strong> Hyper-V était rattaché à la <strong>mauvaise carte réseau physique</strong>.<br><strong>Solution</strong> : Gestionnaire Hyper-V → <em>Gestionnaire de commutateur virtuel</em> → commutateur <strong>Externe</strong> → sélectionner la <strong>bonne carte réseau</strong> (celle reliée au réseau/pont) → OK. Vérifier ensuite, dans les <em>Paramètres</em> de chaque VM, que la carte réseau est bien connectée à ce commutateur.</p>' }),

  block('heading', { level: 3, text: '② SSH non fonctionnel — problème de clé / encodage' }),
  note('yellow', '🔑 Cause probable & solution', '<p>La <strong>clé RSA</strong> a probablement été générée <strong>avant</strong> d’avoir fixé le <code>hostname</code> et le <code>ip domain-name</code> (ou l’équipement a été renommé <em>après</em>) → la clé porte un mauvais nom et est invalide. <strong>Solution</strong> : fixer hostname + domaine, puis <strong>supprimer et régénérer</strong> la clé.</p>'),
  cmd(`configure terminal
ip domain-name G5-EDIVN.lan
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
  note('gray', 'ℹ️ À contrôler aussi', '<ul><li>Un <strong>compte local</strong> existe : <code>username admin privilege 15 secret cisco</code> (le <code>login local</code> s’en sert).</li><li>Modulus <strong>≥ 768</strong> (1024 recommandé) pour SSHv2.</li><li>Depuis le client PT : ouvre l’<em>invite de commandes</em> et tape <code>ssh -l admin &lt;IP&gt;</code> (pas <code>telnet</code>).</li></ul>'),

  block('heading', { level: 3, text: '③ Ping Stagiaire → Serveur échoue (l’inverse fonctionne)' }),
  note('yellow', '🛡️ Cause & solution : pare-feu Windows du serveur', '<p>Le sens <strong>Serveur → Stagiaire</strong> fonctionne → le <strong>routage est bon dans les deux sens</strong>. Ce qui échoue, c’est le <strong>ping entrant</strong> vers le serveur : le <strong>pare-feu Windows</strong> du serveur <strong>bloque par défaut les requêtes ICMP entrantes</strong> non sollicitées (surtout venant d’un <em>autre sous-réseau</em>). Quand le serveur initie le ping, la réponse revient (pare-feu à état) ; quand le stagiaire initie, la requête entrante est bloquée. <strong>Solution : autoriser l’ICMP echo entrant</strong> sur le serveur.</p>'),
  cmd(`REM Sur le SERVEUR Windows (invite admin) — autoriser le ping entrant IPv4 :
netsh advfirewall firewall add rule name="ICMPv4 Echo In" protocol=icmpv4:8,any dir=in action=allow

REM ou en PowerShell (admin) :
Enable-NetFirewallRule -DisplayName "Partage de fichiers et d'imprimantes (demande d'echo - trafic entrant ICMPv4)"`),
  note('gray', 'ℹ️ Détail', '<p>Pas-à-pas illustré : <a href="/pages/astuce-pare-feu-ping">Autoriser le ping (ICMP) dans le pare-feu</a>. Après ça, <code>ping 192.5.10.12</code> depuis le stagiaire doit répondre.</p>'),

  note('yellow', '🚧 Suite', '<p>Prochaines étapes à documenter : <strong>configuration DHCP</strong> (étendue réseau Utilisateurs + relais <code>ip helper-address</code> sur R_IT_G5), <strong>routage</strong> (R_IT_G5 ↔ Routeur_G5 ↔ extérieur), <strong>accès externe</strong> du site <code>:8080</code>, <strong>point d’accès Wi-Fi</strong> (WAP 371), puis <strong>tests de bout en bout</strong>.</p>'),
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

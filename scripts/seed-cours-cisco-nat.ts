/* Cours « NAT / PAT : la translation d'adresses » (Cisco Packet Tracer).
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-cisco-nat.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'cisco-nat', title: 'NAT / PAT : la translation d’adresses', excerpt: 'Faire sortir un réseau privé vers Internet avec une (ou peu d’) adresse(s) publique(s) : NAT statique (1:1), NAT dynamique (pool) et surtout PAT/overload (plusieurs machines derrière une IP, via les ports). Notions inside/outside, config CLI Cisco et vérifications.' };
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const styleBlock = block('html', { html: `<style>.nx-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}.nx-t{border-collapse:collapse;width:100%;font-size:13px;margin:6px 0}.nx-t th,.nx-t td{border:1px solid var(--border);padding:7px 10px;text-align:left}.nx-t th{background:var(--surface-2)}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="nx-cmd">${esc(t)}</div>` });
const th = (t: string) => `<th>${t}</th>`; const td = (t: string) => `<td>${t}</td>`;
const tbl = (head: string[], rows: string[][]) => `<div style="overflow-x:auto"><table class="nx-t"><thead><tr>${head.map(th).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(td).join('')}</tr>`).join('')}</tbody></table></div>`;
// Schéma SVG responsive + légende (couleurs via variables de thème).
const diagram = (vb: string, inner: string, cap: string) => block('html', { html: `<figure style="text-align:center;margin:16px 0"><svg viewBox="0 0 ${vb}" style="width:100%;max-width:680px;height:auto;font-family:'Segoe UI',Tahoma,sans-serif" role="img" aria-label="${cap.replace(/"/g, '')}">${inner}</svg><figcaption class="meta" style="font-size:12px;margin-top:6px">${cap}</figcaption></figure>` });

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Cisco / Packet Tracer', title: PAGE.title, subtitle: 'Comment tout un réseau privé sort sur Internet derrière une seule adresse publique.' }),
  styleBlock,
  block('html', { html: '<p>Le <strong>NAT</strong> (<em>Network Address Translation</em>, « translation d’adresses ») <strong>réécrit</strong> l’adresse IP d’un paquet quand il traverse un routeur de bordure : à la sortie, l’adresse <strong>privée</strong> de la source est remplacée par une adresse <strong>publique</strong> ; au retour, l’opération inverse est faite. Sans NAT, les adresses privées (non routables sur Internet) ne pourraient jamais dialoguer avec l’extérieur.</p>' }),

  // ═══ THÉORIE ═══
  block('heading', { level: 2, text: '📖 La théorie : pourquoi le NAT existe' }),
  block('html', { html: '<p>IPv4 ne compte qu’environ <strong>4,3 milliards</strong> d’adresses — <strong>épuisées</strong> depuis des années. Impossible de donner une adresse publique à chaque machine. La solution retenue (RFC 1918 + RFC 3022) : réserver des <strong>plages privées</strong>, réutilisables librement dans chaque réseau, et n’utiliser une adresse <strong>publique</strong> qu’au moment de <strong>sortir</strong> — c’est le rôle du NAT.</p>' }),
  block('html', { html: tbl(['Plage privée (RFC 1918)', 'Masque', 'Taille', 'Typique'], [
    ['<code>10.0.0.0</code> → <code>10.255.255.255</code>', '/8', '≈ 16,7 M', 'grandes entreprises'],
    ['<code>172.16.0.0</code> → <code>172.31.255.255</code>', '/12', '≈ 1 M', 'moyennes infras'],
    ['<code>192.168.0.0</code> → <code>192.168.255.255</code>', '/16', '65 536', 'box, petits réseaux'],
  ]) }),
  block('html', { html: '<p>Ces adresses sont <strong>rejetées</strong> par les routeurs d’Internet : un paquet qui sort avec une source privée ne reviendrait jamais. Le NAT lui substitue donc une IP publique routable, puis <strong>mémorise la correspondance</strong> dans une <strong>table de traduction</strong> pour savoir, à la réponse, à quelle machine interne renvoyer.</p>' }),
  diagram('660 175',
    `<defs><marker id="nd1" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--accent)"/></marker></defs>
    <rect x="8" y="52" width="150" height="70" rx="10" fill="var(--surface-2)" stroke="var(--border)"/>
    <text x="83" y="80" text-anchor="middle" font-size="13" font-weight="700" fill="var(--text)">💻 PC interne</text>
    <text x="83" y="100" text-anchor="middle" font-size="12" fill="var(--text-soft)">192.168.10.5</text>
    <rect x="258" y="45" width="150" height="84" rx="10" fill="var(--surface-2)" stroke="var(--accent)" stroke-width="1.6"/>
    <text x="333" y="78" text-anchor="middle" font-size="13" font-weight="700" fill="var(--text)">Routeur NAT</text>
    <text x="333" y="97" text-anchor="middle" font-size="10.5" fill="var(--text-muted)">inside → outside</text>
    <ellipse cx="600" cy="87" rx="52" ry="40" fill="var(--surface-2)" stroke="var(--border)"/>
    <text x="600" y="91" text-anchor="middle" font-size="12" font-weight="700" fill="var(--text)">Internet</text>
    <line x1="158" y1="87" x2="252" y2="87" stroke="var(--accent)" stroke-width="2.5" marker-end="url(#nd1)"/>
    <line x1="408" y1="87" x2="542" y2="87" stroke="var(--accent)" stroke-width="2.5" marker-end="url(#nd1)"/>
    <text x="205" y="76" text-anchor="middle" font-size="10.5" fill="#2563eb" font-weight="700">src 192.168.10.5</text>
    <text x="205" y="104" text-anchor="middle" font-size="10" fill="#2563eb">privé</text>
    <text x="475" y="76" text-anchor="middle" font-size="10.5" fill="#16a34a" font-weight="700">src 203.0.113.1</text>
    <text x="475" y="104" text-anchor="middle" font-size="10" fill="#16a34a">public</text>`,
    'Principe : à la sortie, le routeur remplace l’adresse source <b>privée</b> par son adresse <b>publique</b> — et fait l’inverse au retour, grâce à sa table de traduction.'),
  note('blue', '🎯 Ce que le NAT apporte', '<ul><li><strong>Contourner la pénurie IPv4</strong> : tout un LAN partage <strong>une seule</strong> IP publique (celle du routeur/box).</li><li><strong>Masquage</strong> : l’adressage interne est invisible de l’extérieur (effet de bord sécurité, ce n’est <em>pas</em> un pare-feu).</li><li><strong>Souplesse</strong> : on peut changer de fournisseur (donc d’IP publique) sans re-adresser tout le LAN.</li></ul>'),
  note('yellow', '⚠️ Ses limites', '<p>Le NAT <strong>casse le principe « bout-en-bout »</strong> d’Internet : une machine externe ne peut pas joindre spontanément une machine interne (il faudra du <strong>port forwarding</strong>, plus bas). Il complique aussi certains protocoles qui transportent des IP dans leurs données (FTP actif, SIP, IPsec) → d’où les mécanismes <em>ALG</em>. IPv6, avec ses adresses en quantité illimitée, supprime le besoin de NAT.</p>'),

  // ═══ VOCABULAIRE ═══
  block('heading', { level: 2, text: '🧭 Le vocabulaire Cisco (inside / outside · local / global)' }),
  block('html', { html: '<p>Cisco décrit une adresse par <strong>deux axes</strong> : de quel <strong>côté</strong> se trouve la machine (<em>inside</em> = interne, <em>outside</em> = externe) et <strong>comment on la voit</strong> (<em>local</em> = telle qu’elle apparaît dans le réseau interne, <em>global</em> = telle qu’elle apparaît sur Internet). D’où quatre termes :</p>' }),
  block('html', { html: tbl(['Terme', 'Signification', 'Exemple'], [
    ['<strong>Inside local</strong>', 'IP <strong>privée</strong> réelle de la machine interne', '<code>192.168.10.51</code>'],
    ['<strong>Inside global</strong>', 'IP <strong>publique</strong> sous laquelle l’interne est vue dehors', '<code>203.0.113.10</code>'],
    ['<strong>Outside global</strong>', 'IP <strong>publique</strong> réelle de la machine externe', '<code>8.8.8.8</code>'],
    ['<strong>Outside local</strong>', 'IP de la machine externe vue depuis l’intérieur (rare, souvent = global)', '<code>8.8.8.8</code>'],
  ]) }),
  note('gray', '💡 À retenir pour l’examen', '<p>La traduction courante porte sur <strong>inside local → inside global</strong> : on remplace l’IP privée de nos machines par une IP publique en sortie. C’est la colonne <em>« Inside »</em> de <code>show ip nat translations</code>.</p>'),

  // ═══ INSIDE / OUTSIDE (config) ═══
  block('heading', { level: 2, text: '① Désigner les interfaces inside / outside' }),
  block('html', { html: '<p>Avant tout NAT, on indique au routeur quelle interface est <strong>interne</strong> (côté LAN privé) et quelle interface est <strong>externe</strong> (côté Internet). C’est indispensable : sans ça, aucune traduction ne se produit.</p>' }),
  cmd(`interface GigabitEthernet0/0
 ip nat inside
 exit
interface GigabitEthernet0/1
 ip nat outside
 exit`),

  // ═══ APERÇU DES 3 TYPES ═══
  block('heading', { level: 2, text: '② Les trois types de NAT' }),
  block('html', { html: tbl(['Type', 'Principe', 'Sens', 'Quand l’utiliser'], [
    ['<strong>NAT statique</strong>', 'correspondance <strong>fixe 1:1</strong> (une privée ↔ une publique)', 'les deux sens', 'publier un <strong>serveur</strong> joignable de l’extérieur'],
    ['<strong>NAT dynamique</strong>', 'un <strong>pool</strong> d’IP publiques prêtées à la volée', 'sortant', 'plusieurs IP publiques mais moins que d’hôtes (rare)'],
    ['<strong>PAT / overload</strong>', '<strong>plusieurs</strong> privées → <strong>une seule</strong> publique, via le <strong>port</strong>', 'sortant', '<strong>le cas courant</strong> : tout le LAN derrière l’IP du routeur/box'],
  ]) }),
  block('html', { html: '<p>Détail de chacun ci-dessous.</p>' }),

  // ═══ NAT STATIQUE ═══
  block('heading', { level: 3, text: '2.1 — NAT statique (1:1)' }),
  block('html', { html: '<p>Une adresse privée est <strong>liée en permanence</strong> à une adresse publique dédiée. La correspondance est <strong>bidirectionnelle</strong> : non seulement l’interne peut sortir, mais l’<strong>externe peut aussi initier</strong> une connexion vers cette IP publique — c’est ce qui permet de <strong>publier un serveur</strong>.</p>' }),
  cmd(`! serveur web interne 192.168.10.51 publié sur l'IP publique 203.0.113.10
ip nat inside source static 192.168.10.51 203.0.113.10`),
  block('html', { html: tbl(['Inside local', 'Inside global', 'Effet'], [
    ['<code>192.168.10.51</code>', '<code>203.0.113.10</code>', 'toute connexion (tous ports) est associée 1:1'],
  ]) }),
  note('gray', 'ℹ️ Coût', '<p>Chaque NAT statique <strong>consomme une IP publique entière</strong> : c’est réservé aux quelques serveurs à exposer. Pour n’exposer qu’<strong>un service</strong> (un port) sans gaspiller une IP, on utilise le <strong>port forwarding</strong> (plus bas).</p>'),

  // ═══ NAT DYNAMIQUE ═══
  block('heading', { level: 3, text: '2.2 — NAT dynamique (pool)' }),
  block('html', { html: '<p>On dispose d’un <strong>pool</strong> de plusieurs IP publiques. Quand un hôte interne sort, le routeur lui prête <strong>la première IP publique libre</strong> du pool, pour la durée de la session (1:1 <strong>temporaire</strong>). Quand la session se termine, l’IP retourne au pool.</p>' }),
  cmd(`! 1) le pool d'adresses publiques disponibles
ip nat pool PUB 203.0.113.10 203.0.113.20 netmask 255.255.255.0
!
! 2) qui a le droit d'être traduit (ACL)
access-list 1 permit 192.168.10.0 0.0.0.255
!
! 3) traduire la liste vers le pool
ip nat inside source list 1 pool PUB`),
  note('yellow', '⚠️ Limite forte', '<p>Sans <code>overload</code>, il n’y a <strong>pas de partage</strong> : s’il y a plus d’hôtes actifs que d’IP dans le pool, les <strong>suivants n’ont plus de traduction</strong> (pas d’accès Internet). En pratique on ajoute presque toujours <code>overload</code> au pool → c’est du <strong>PAT sur pool</strong>. Le NAT dynamique « pur » est aujourd’hui <strong>rare</strong>.</p>'),

  // ═══ PAT / OVERLOAD ═══
  block('heading', { level: 3, text: '2.3 — PAT / overload (le cas courant)' }),
  block('html', { html: '<p><strong>Toutes</strong> les machines internes sortent derrière <strong>une seule</strong> IP publique. Pour les distinguer, le routeur change aussi le <strong>port source</strong> et le note dans sa table : au retour, le couple <em>IP publique + port</em> lui indique à quelle machine interne renvoyer. Une seule IP peut ainsi porter des <strong>dizaines de milliers</strong> de connexions simultanées.</p>' }),
  cmd(`! 1) réseaux internes autorisés (ACL)
access-list 1 permit 192.168.10.0 0.0.0.255
!
! 2) traduire vers l'IP de l'interface externe, en SURCHARGE
ip nat inside source list 1 interface GigabitEthernet0/1 overload`),
  block('html', { html: '<p>Exemple de table : deux machines internes sortent vers le même serveur, différenciées par le port :</p>' }),
  block('html', { html: tbl(['Inside local (privé:port)', 'Inside global (public:port)', 'Outside (destination)'], [
    ['<code>192.168.10.5:1030</code>', '<code>203.0.113.1:1030</code>', '<code>8.8.8.8:443</code>'],
    ['<code>192.168.10.8:1030</code>', '<code>203.0.113.1:<strong>1031</strong></code>', '<code>8.8.8.8:443</code>'],
  ]) }),
  diagram('660 230',
    `<defs><marker id="nd2" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--accent)"/></marker></defs>
    <rect x="8" y="22" width="162" height="58" rx="10" fill="var(--surface-2)" stroke="var(--border)"/>
    <text x="89" y="45" text-anchor="middle" font-size="12.5" font-weight="700" fill="var(--text)">💻 PC A</text>
    <text x="89" y="65" text-anchor="middle" font-size="11.5" fill="var(--text-soft)">192.168.10.5:1030</text>
    <rect x="8" y="150" width="162" height="58" rx="10" fill="var(--surface-2)" stroke="var(--border)"/>
    <text x="89" y="173" text-anchor="middle" font-size="12.5" font-weight="700" fill="var(--text)">💻 PC B</text>
    <text x="89" y="193" text-anchor="middle" font-size="11.5" fill="var(--text-soft)">192.168.10.8:1030</text>
    <rect x="262" y="75" width="150" height="82" rx="10" fill="var(--surface-2)" stroke="var(--accent)" stroke-width="1.6"/>
    <text x="337" y="108" text-anchor="middle" font-size="13" font-weight="700" fill="var(--text)">Routeur PAT</text>
    <text x="337" y="127" text-anchor="middle" font-size="10.5" fill="var(--text-muted)">overload</text>
    <ellipse cx="602" cy="116" rx="52" ry="40" fill="var(--surface-2)" stroke="var(--border)"/>
    <text x="602" y="120" text-anchor="middle" font-size="12" font-weight="700" fill="var(--text)">Internet</text>
    <line x1="170" y1="51" x2="258" y2="98" stroke="var(--accent)" stroke-width="2.5" marker-end="url(#nd2)"/>
    <line x1="170" y1="179" x2="258" y2="134" stroke="var(--accent)" stroke-width="2.5" marker-end="url(#nd2)"/>
    <line x1="412" y1="116" x2="544" y2="116" stroke="var(--accent)" stroke-width="2.5" marker-end="url(#nd2)"/>
    <text x="482" y="102" text-anchor="middle" font-size="10.5" font-weight="700" fill="#16a34a">203.0.113.1</text>
    <text x="482" y="134" text-anchor="middle" font-size="11" fill="#16a34a">:1030 &#160;/&#160; :1031</text>`,
    'PAT (overload) : les deux PC sortent sous la <b>même</b> IP publique, mais avec des <b>ports</b> différents (1030, 1031) — c’est le port qui permet de renvoyer chaque réponse au bon PC.'),
  note('gray', '🔌 Les noms du PAT', '<p><strong>PAT</strong> = <em>Port Address Translation</em>. Cisco l’appelle <strong>overload</strong> ; Linux/iptables <strong>MASQUERADE</strong> ; dans une box, c’est simplement « le NAT ». C’est ce que fait votre box à la maison.</p>'),

  // ═══ PORT FORWARDING ═══
  block('heading', { level: 2, text: '🎯 Le port forwarding (redirection de port)' }),
  block('html', { html: '<p>Avec le PAT, l’extérieur <strong>ne peut pas</strong> initier de connexion vers l’intérieur (aucune entrée pré-établie dans la table). Or on veut souvent <strong>publier un service interne</strong> — un site web, un serveur RDP, une caméra… Le <strong>port forwarding</strong> crée une <strong>entrée statique</strong> : « tout trafic arrivant sur <em>IP publique : port X</em> est redirigé vers <em>machine interne : port Y</em> ».</p>' }),
  block('html', { html: '<p>C’est exactement la rubrique <strong>« Redirection de port »</strong> / <em>Port forwarding</em> / <em>Virtual Server</em> de l’interface d’une box.</p>' }),
  cmd(`! publier le serveur web interne (port 8080) sur le port 8080 de l'IP publique
ip nat inside source static tcp 192.168.10.51 8080 interface GigabitEthernet0/1 8080
!
! on peut MAPPER un port externe différent du port interne :
! dehors on tape :80, en interne ça tape :8080
ip nat inside source static tcp 192.168.10.51 8080 interface GigabitEthernet0/1 80
!
! autres exemples : RDP et SSH publiés
ip nat inside source static tcp 192.168.10.60 3389 interface GigabitEthernet0/1 3389
ip nat inside source static tcp 192.168.10.70 22   interface GigabitEthernet0/1 2222`),
  diagram('660 165',
    `<defs><marker id="nd3" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--accent)"/></marker></defs>
    <ellipse cx="64" cy="82" rx="55" ry="42" fill="var(--surface-2)" stroke="var(--border)"/>
    <text x="64" y="78" text-anchor="middle" font-size="12.5" font-weight="700" fill="var(--text)">🌍 Client</text>
    <text x="64" y="95" text-anchor="middle" font-size="11" fill="var(--text-muted)">Internet</text>
    <rect x="248" y="40" width="160" height="86" rx="10" fill="var(--surface-2)" stroke="var(--accent)" stroke-width="1.6"/>
    <text x="328" y="76" text-anchor="middle" font-size="13" font-weight="700" fill="var(--text)">Routeur</text>
    <text x="328" y="95" text-anchor="middle" font-size="10" fill="var(--text-muted)">redirection de port</text>
    <rect x="498" y="47" width="154" height="70" rx="10" fill="var(--surface-2)" stroke="var(--border)"/>
    <text x="575" y="76" text-anchor="middle" font-size="12.5" font-weight="700" fill="var(--text)">🖧 Serveur</text>
    <text x="575" y="96" text-anchor="middle" font-size="11" fill="var(--text-soft)">192.168.10.51:8080</text>
    <line x1="119" y1="82" x2="242" y2="82" stroke="var(--accent)" stroke-width="2.5" marker-end="url(#nd3)"/>
    <line x1="408" y1="82" x2="492" y2="82" stroke="var(--accent)" stroke-width="2.5" marker-end="url(#nd3)"/>
    <text x="180" y="71" text-anchor="middle" font-size="10.5" font-weight="700" fill="#16a34a">203.0.113.1:8080</text>
    <text x="450" y="71" text-anchor="middle" font-size="10.5" fill="var(--text-muted)">:8080</text>`,
    'Port forwarding : une connexion venue d’Internet sur <b>203.0.113.1:8080</b> est redirigée vers le serveur interne <b>192.168.10.51:8080</b> — l’unique façon de joindre un service interne depuis dehors.'),
  block('html', { html: tbl(['Depuis l’extérieur on tape…', 'Le routeur redirige vers…', 'Service'], [
    ['<code>203.0.113.1:8080</code>', '<code>192.168.10.51:8080</code>', 'site web'],
    ['<code>203.0.113.1:3389</code>', '<code>192.168.10.60:3389</code>', 'bureau à distance (RDP)'],
    ['<code>203.0.113.1:2222</code>', '<code>192.168.10.70:22</code>', 'SSH (port externe remappé)'],
  ]) }),
  note('blue', '🔎 Port forwarding vs NAT statique', '<p>Le <strong>NAT statique</strong> mappe <strong>toute l’IP</strong> (tous les ports) → il faut une IP publique dédiée. Le <strong>port forwarding</strong> ne mappe qu’<strong>un port</strong> → il partage l’<strong>unique</strong> IP publique du PAT entre plusieurs services (web sur 8080, RDP sur 3389…). C’est pour ça qu’on peut tout publier derrière une seule adresse.</p>'),
  note('yellow', '🛡️ Ne pas oublier le pare-feu', '<p>Le port forwarding rend le service <strong>joignable</strong> au niveau réseau ; encore faut-il que le <strong>pare-feu de la machine cible</strong> (ex. pare-feu Windows) <strong>autorise le port entrant</strong> (HTTP 80/8080, RDP 3389…). Sinon la redirection marche mais le service refuse la connexion.</p>'),
  note('gray', '🔗 Cas concret', '<p>Dans la <a href="/pages/procedure-plateforme-1">plateforme EDIVN</a>, le site IIS interne (<code>:8080</code>) est publié vers la salle par un <code>ip nat inside source static tcp … 8080 … 8080</code> — exactement ce mécanisme.</p>'),

  // ═══ VÉRIFIER ═══
  block('heading', { level: 2, text: '🔍 Vérifier & dépanner' }),
  cmd(`show ip nat translations      ! table des traductions actives (inside local/global, ports)
show ip nat statistics        ! compteurs + interfaces inside/outside déclarées
debug ip nat                  ! voir les traductions en direct (labo uniquement)
clear ip nat translation *    ! purger la table (test)`),
  note('yellow', '🛠️ Pannes fréquentes', '<ul><li><strong>Pas de sortie Internet</strong> → interfaces <code>ip nat inside</code>/<code>outside</code> <strong>inversées ou manquantes</strong>.</li><li><strong>Table vide</strong> → l’<strong>ACL</strong> ne couvre pas le bon réseau (mauvais wildcard), ou aucun trafic n’a encore circulé.</li><li>Sortie OK mais <strong>rien ne revient</strong> → il manque la <strong>route de retour</strong> côté FAI/salle, ou une <a href="/pages/cisco-route-statique">route par défaut</a> <code>ip route 0.0.0.0 0.0.0.0 …</code> sur le routeur.</li><li><strong>Service publié injoignable</strong> → port forwarding OK mais <strong>pare-feu</strong> de la cible fermé, ou mauvais port mappé.</li></ul>'),

  note('green', '🔗 Pour aller plus loin', '<p>Cours liés : <a href="/pages/cisco-routeur-cli">Configurer un routeur en CLI</a>, <a href="/pages/cisco-route-statique">Les routes statiques</a>, <a href="/pages/cisco-acl">Les ACL</a> (le NAT s’appuie sur une ACL), <a href="/pages/adresses-ip">Les adresses IP</a> (privées/publiques). Mise en pratique : <a href="/pages/procedure-plateforme-1">plateforme EDIVN</a> (étape 7).</p>'),
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

/* Procédure « Mettre en place des VLAN (Packet Tracer) » — pas-à-pas complet.
   Part d'une topologie vierge et arrive à deux VLAN qui communiquent, avec un
   contrôle après chaque étape. Complète le cours théorique /pages/les-vlan.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-procedure-vlan.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = {
  slug: 'procedure-vlan-packet-tracer',
  title: 'Mettre en place des VLAN (Packet Tracer)',
  excerpt: 'De la topologie vierge à deux VLAN qui communiquent : plan d’adressage, création des VLAN, ports access, trunk, puis les deux méthodes de routage inter-VLAN détaillées pas à pas — router-on-a-stick avec sous-interfaces, et switch multicouche avec SVI. Commandes Cisco, contrôle après chaque étape, erreurs classiques.',
};

const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const styleBlock = block('html', { html: `<style>.vl-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}.vl-t{border-collapse:collapse;width:100%;font-size:13px;margin:6px 0}.vl-t th,.vl-t td{border:1px solid var(--border);padding:7px 10px;text-align:left;vertical-align:top}.vl-t th{background:var(--surface-2)}.vl-flow{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:12px;margin:8px 0;white-space:pre;overflow-x:auto;font-size:12px;line-height:1.5}.vl-chk{background:color-mix(in srgb,#059669 9%,transparent);border:1px solid color-mix(in srgb,#059669 35%,transparent);border-radius:8px;padding:10px 13px;margin:10px 0}.vl-chk p{margin:0 0 6px;font-weight:600;color:#059669}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="vl-cmd">${esc(t)}</div>` });
const flow = (t: string) => block('html', { html: `<div class="vl-flow">${esc(t)}</div>` });
const check = (html: string) => block('html', { html: `<div class="vl-chk"><p>✅ Contrôle avant de continuer</p>${html}</div>` });

const blocks: PageBlock[] = [
  block('hero', {
    eyebrow: 'Procédure · Cisco / Packet Tracer',
    title: PAGE.title,
    subtitle: 'Une maquette complète, montée dans l’ordre, vérifiée à chaque étape.',
  }),
  styleBlock,

  block('html', { html: '<p>Cette procédure part d’une <strong>topologie vide</strong> et arrive à deux VLAN qui communiquent. La théorie est dans le cours <a href="/pages/les-vlan">Les VLAN &amp; le routage inter-VLAN</a> : ici, on <strong>fait</strong>, dans l’ordre, avec un contrôle après chaque étape.</p><p>Compte environ <strong>30 minutes</strong> la première fois.</p>' }),

  note('blue', '🎯 Ce qu’on va construire', '<p>Deux services d’une PME, isolés l’un de l’autre mais capables de se joindre via un routeur : <strong>Administration</strong> (VLAN 10) et <strong>Production</strong> (VLAN 20). Deux switches reliés par un trunk, un routeur pour le passage entre VLAN.</p>'),

  block('heading', { level: 2, text: '🗺️ La maquette' }),
  flow(`                      ┌───────────┐
                      │  Routeur  │  R1
                      │   G0/0    │
                      └─────┬─────┘
                            │  trunk (802.1Q)
                      ┌─────┴─────┐
                      │  SW1      │  Gi0/1 ── trunk ── Gi0/1 ┌──────┐
                      │           │                          │ SW2  │
                      └──┬─────┬──┘                          └─┬──┬─┘
                    Fa0/1│     │Fa0/2                    Fa0/1│  │Fa0/2
                         │     │                              │  │
                      [PC-A1] [PC-P1]                    [PC-A2] [PC-P2]
                      VLAN 10  VLAN 20                   VLAN 10  VLAN 20`),

  block('html', { html: `<table class="vl-t"><thead><tr><th>VLAN</th><th>Nom</th><th>Réseau</th><th>Passerelle</th><th>Postes</th></tr></thead><tbody>
    <tr><td><strong>10</strong></td><td>ADMIN</td><td>192.168.10.0/24</td><td>192.168.10.254</td><td>PC-A1 : .1 · PC-A2 : .2</td></tr>
    <tr><td><strong>20</strong></td><td>PRODUCTION</td><td>192.168.20.0/24</td><td>192.168.20.254</td><td>PC-P1 : .1 · PC-P2 : .2</td></tr>
    <tr><td><strong>99</strong></td><td>NATIF</td><td>—</td><td>—</td><td>aucun (VLAN natif dédié)</td></tr>
  </tbody></table>` }),

  note('gray', '📋 Le plan d’adressage d’abord, toujours', '<p>On écrit le tableau <strong>avant</strong> de toucher au clavier. C’est ce qui évite de découvrir en cours de route que deux VLAN partagent le même réseau IP — l’erreur la plus pénible à démêler, parce que tout <em>semble</em> configuré correctement.</p>'),

  block('heading', { level: 2, text: '1️⃣ Étape 1 — Poser la topologie' }),
  block('html', { html: '<p>Dans Packet Tracer, place et câble :</p><ul><li><strong>2 switches</strong> 2960 (SW1, SW2)</li><li><strong>1 routeur</strong> 2911 (R1)</li><li><strong>4 PC</strong> (PC-A1, PC-P1, PC-A2, PC-P2)</li></ul><p>Câblage en <strong>cuivre droit</strong> (<em>Copper Straight-Through</em>) partout : PC → switch, switch → switch, switch → routeur. Packet Tracer accepte aussi le câble automatique (l’éclair), mais autant prendre l’habitude du bon câble.</p>' }),

  check('<p>Les liens switch–switch et switch–routeur passent au <strong>vert</strong> après quelques secondes. S’ils restent orange, c’est le spanning-tree qui converge : patiente. S’ils restent <strong>rouges</strong>, le câble ou le port est mauvais.</p>'),

  block('heading', { level: 2, text: '2️⃣ Étape 2 — Créer les VLAN sur les deux switches' }),
  block('html', { html: '<p>Les VLAN se créent <strong>sur chaque switch</strong> — sauf si tu utilises VTP (voir <a href="/pages/vlan-vtp">VTP : propager les VLAN</a>). Ici, on fait à la main : c’est plus sûr et plus lisible.</p><p>À taper <strong>sur SW1 puis sur SW2</strong>, à l’identique :</p>' }),

  cmd(`enable
configure terminal
hostname SW1                  ! (SW2 sur le second switch)

vlan 10
 name ADMIN
 exit
vlan 20
 name PRODUCTION
 exit
vlan 99
 name NATIF
 exit
end`),

  check('<p><code>show vlan brief</code> doit lister les VLAN <strong>10, 20 et 99</strong> avec leurs noms, en plus du VLAN 1 par défaut. Si un VLAN manque, tu l’as créé sur l’autre switch.</p>'),

  block('heading', { level: 2, text: '3️⃣ Étape 3 — Affecter les ports des PC (access)' }),
  block('html', { html: '<p>Chaque port qui reçoit un PC est un port <strong>access</strong>, dans <strong>un seul</strong> VLAN.</p>' }),

  cmd(`configure terminal

interface FastEthernet0/1
 switchport mode access
 switchport access vlan 10
 switchport nonegotiate
 spanning-tree portfast
 exit

interface FastEthernet0/2
 switchport mode access
 switchport access vlan 20
 switchport nonegotiate
 spanning-tree portfast
 exit
end
write memory`),

  note('yellow', '⚠️ Les deux lignes qu’on oublie', '<ul><li><code>switchport mode access</code> <strong>avant</strong> <code>switchport access vlan</code> : sans elle, le port reste en négociation automatique et reste vulnérable (voir <a href="/pages/vlan-securite">Sécuriser les VLAN</a>).</li><li><code>write memory</code> : sans lui, tout est perdu au redémarrage du switch. En examen, c’est un point qui se perd bêtement.</li></ul>'),

  check('<p>Configure les IP des PC (onglet <em>Desktop → IP Configuration</em>) selon le tableau, <strong>passerelle comprise</strong>. Puis : <strong>PC-A1 doit pinguer PC-A2</strong> (même VLAN, à travers le trunk — qui n’existe pas encore, donc ce test échoue pour l’instant). En revanche, sur un même switch, deux PC du même VLAN doivent déjà se voir.</p>'),

  block('heading', { level: 2, text: '4️⃣ Étape 4 — Le trunk entre les switches' }),
  block('html', { html: '<p>Le lien SW1 ↔ SW2 doit transporter <strong>plusieurs VLAN</strong> : c’est un trunk. À faire <strong>des deux côtés</strong>, avec exactement les mêmes valeurs.</p>' }),

  cmd(`configure terminal
interface GigabitEthernet0/1
 switchport mode trunk
 switchport trunk native vlan 99         ! identique des deux côtés !
 switchport trunk allowed vlan 10,20,99
 switchport nonegotiate
 exit
end
write memory`),

  check('<p><code>show interfaces trunk</code> doit afficher le port en <strong>trunking</strong>, avec <code>Native vlan 99</code> et les VLAN 10, 20, 99 autorisés. Maintenant, <strong>PC-A1 doit pinguer PC-A2</strong> (même VLAN, switches différents). Si ça échoue, le trunk est en cause, pas les PC.</p>'),

  note('red', '🚨 L’erreur numéro 1 sur les trunks', '<p>Un VLAN natif <strong>différent</strong> des deux côtés. Packet Tracer affiche alors un avertissement <em>native VLAN mismatch</em> dans la console — facile à rater si tu ne regardes pas. Le lien fonctionne partiellement, ce qui rend le symptôme déroutant : certains VLAN passent, un autre non.</p>'),

  block('heading', { level: 2, text: '5️⃣ Étape 5 — Le routage inter-VLAN (router-on-a-stick)' }),
  block('html', { html: '<p>À ce stade, chaque VLAN fonctionne <strong>en vase clos</strong>. Pour qu’Administration parle à Production, il faut un équipement de <strong>couche 3</strong>. Méthode classique : une seule interface physique du routeur, découpée en <strong>sous-interfaces</strong>, une par VLAN.</p>' }),

  block('html', { html: '<p>D’abord, côté switch, le port vers le routeur doit être un <strong>trunk</strong> :</p>' }),
  cmd(`! Sur SW1
interface GigabitEthernet0/2
 switchport mode trunk
 switchport trunk native vlan 99
 switchport trunk allowed vlan 10,20,99
 switchport nonegotiate
 exit`),

  block('html', { html: '<p>Puis, sur le routeur :</p>' }),
  cmd(`enable
configure terminal
hostname R1

interface GigabitEthernet0/0
 no shutdown                        ! l'interface physique doit être ACTIVE
 exit

interface GigabitEthernet0/0.10
 encapsulation dot1Q 10
 ip address 192.168.10.254 255.255.255.0
 exit

interface GigabitEthernet0/0.20
 encapsulation dot1Q 20
 ip address 192.168.20.254 255.255.255.0
 exit

interface GigabitEthernet0/0.99
 encapsulation dot1Q 99 native      ! le natif se déclare "native"
 exit
end
write memory`),

  note('yellow', '⚠️ Les trois pièges de cette étape', '<ul><li><strong>Oublier <code>no shutdown</code></strong> sur l’interface physique : les sous-interfaces ne fonctionneront pas, même bien configurées. C’est de loin l’erreur la plus fréquente.</li><li><strong>Le mot-clé <code>native</code></strong> sur la sous-interface du VLAN natif : sans lui, le routeur attend une étiquette qui n’arrive jamais.</li><li><strong>La passerelle des PC</strong> doit être l’adresse de la sous-interface correspondante — <code>192.168.10.254</code> pour le VLAN 10.</li></ul>'),

  check('<p>Sur R1 : <code>show ip interface brief</code> → les sous-interfaces <code>.10</code> et <code>.20</code> sont <strong>up/up</strong>. Puis, depuis PC-A1 : <code>ping 192.168.10.254</code> (sa passerelle) doit répondre, puis <code>ping 192.168.20.1</code> (PC-P1, <strong>autre VLAN</strong>) doit répondre aussi. <strong>Le routage inter-VLAN fonctionne.</strong></p>'),

  block('heading', { level: 2, text: '6️⃣ Étape 6 — La même chose avec un switch multicouche (SVI)' }),
  block('html', { html: '<p>Même résultat, autre équipement : c’est le <strong>switch multicouche</strong> (niveau 3) qui route, à la place du routeur. Tout ce qui précède reste vrai — les VLAN, les ports access, le trunk entre switches. Seule la partie <em>routage</em> change de machine.</p><p>Dans Packet Tracer, prends un <strong>3560</strong> : le 2960 ne route pas.</p>' }),

  flow(`                  ┌────────────────────────┐
                  │   SW-L3  (3560)        │
                  │   ip routing           │
                  │  ┌────────┐┌────────┐  │
                  │  │ SVI 10 ││ SVI 20 │  │   .254 dans chaque réseau
                  │  └────────┘└────────┘  │
                  └──┬───────┬────────┬────┘
               Fa0/1 │ Fa0/2 │ Gi0/1  │ trunk (802.1Q)
                     │       │        │
                  [PC-A1] [PC-P1]  ┌──┴────────────┐
                  VLAN 10 VLAN 20  │      SW2      │
                                   └──┬────────┬───┘
                                      │        │
                                   [PC-A2]  [PC-P2]
                                   VLAN 10  VLAN 20`),

  block('html', { html: '<p><strong>Ce qui disparaît :</strong> le routeur, le lien qui y menait et les sous-interfaces. <strong>Ce qui apparaît :</strong> une <em>interface VLAN</em> par VLAN, portée par le switch lui-même. Le plan d’adressage ne bouge pas d’un chiffre — les postes gardent les mêmes passerelles.</p>' }),

  block('heading', { level: 3, text: '6.1 — Les VLAN doivent exister ici aussi' }),
  block('html', { html: '<p>Un switch L3 reste un switch : sans VLAN dans sa base, aucune interface VLAN ne montera. C’est l’étape 2, refaite sur la nouvelle machine.</p>' }),
  cmd(`enable
configure terminal
hostname SW-L3

vlan 10
 name ADMIN
 exit
vlan 20
 name PRODUCTION
 exit
vlan 99
 name NATIF
 exit`),

  block('heading', { level: 3, text: '6.2 — Les ports : access pour les postes, trunk vers SW2' }),
  block('html', { html: '<p>Rien de neuf par rapport aux étapes 3 et 4 — sauf <strong>une ligne</strong> sur le trunk, qui n’existe pas sur un 2960.</p>' }),
  cmd(`! Les postes branchés directement sur le switch L3
interface FastEthernet0/1
 switchport mode access
 switchport access vlan 10
 spanning-tree portfast
 exit

interface FastEthernet0/2
 switchport mode access
 switchport access vlan 20
 spanning-tree portfast
 exit

! Le lien vers SW2
interface GigabitEthernet0/1
 switchport trunk encapsulation dot1q   ! OBLIGATOIRE sur 3560 — absent du 2960
 switchport mode trunk
 switchport trunk native vlan 99
 switchport trunk allowed vlan 10,20,99
 exit`),

  note('yellow', '⚠️ La ligne qui n’existe pas sur un 2960', '<p><code>switchport trunk encapsulation dot1q</code> doit venir <strong>avant</strong> <code>switchport mode trunk</code> sur un 3560. Le 2960 ne connaît que le 802.1Q, il n’a donc pas cette commande ; le 3560 a connu ISL en plus, et exige qu’on choisisse.</p><p>Sans elle, la commande suivante est refusée par un message déroutant : <em>Command rejected: An interface whose trunk encapsulation is Auto can not be configured to trunk mode</em>. C’est l’erreur classique quand on recopie une configuration de 2960.</p>'),

  block('heading', { level: 3, text: '6.3 — Activer le routage' }),
  block('html', { html: '<p>Une seule commande, et c’est celle qu’on oublie. Un switch multicouche sort d’usine en <strong>commutation seule</strong> : les SVI peuvent être parfaitement configurées, rien ne passera d’un VLAN à l’autre.</p>' }),
  cmd(`ip routing`),

  note('gray', '🧭 Le pendant exact du routeur', '<p>En router-on-a-stick, l’équipement <em>est</em> un routeur : il route par nature. Ici on part d’un switch, et le routage est une fonction qu’on allume. Toute la différence de posture entre les deux méthodes tient dans cette ligne.</p>'),

  block('heading', { level: 3, text: '6.4 — Une SVI par VLAN' }),
  block('html', { html: '<p>C’est l’équivalent des sous-interfaces : une passerelle par VLAN. La différence est qu’il n’y a <strong>rien à encapsuler</strong> — le switch connaît déjà ses VLAN, le numéro de l’interface suffit à dire duquel on parle.</p>' }),
  cmd(`interface vlan 10
 ip address 192.168.10.254 255.255.255.0
 no shutdown
 exit

interface vlan 20
 ip address 192.168.20.254 255.255.255.0
 no shutdown
 exit
end
write memory`),

  block('html', { html: `<table class="vl-t"><thead><tr><th>Router-on-a-stick</th><th>Switch multicouche</th></tr></thead><tbody>
    <tr><td><code>interface Gi0/0.10</code></td><td><code>interface vlan 10</code></td></tr>
    <tr><td><code>encapsulation dot1Q 10</code></td><td>— <em>inutile : le VLAN est déjà connu</em></td></tr>
    <tr><td><code>ip address 192.168.10.254 …</code></td><td><code>ip address 192.168.10.254 …</code></td></tr>
    <tr><td><code>no shutdown</code> sur l’interface <strong>physique</strong></td><td><code>no shutdown</code> sur la <strong>SVI</strong></td></tr>
    <tr><td>—</td><td><code>ip routing</code>, une fois pour toutes</td></tr>
  </tbody></table>` }),

  note('blue', '🔎 Pourquoi une SVI reste parfois down/down', '<p>Une interface VLAN ne monte que si <strong>trois conditions</strong> sont réunies en même temps :</p><ol><li>le VLAN <strong>existe</strong> dans la base — <code>show vlan brief</code> ;</li><li><strong>au moins un port actif</strong> appartient à ce VLAN : un port access dont le câble est branché, ou un trunk qui transporte ce VLAN ;</li><li>la SVI n’est pas <code>shutdown</code>.</li></ol><p>C’est le pendant exact du <code>no shutdown</code> oublié en router-on-a-stick : la configuration <em>semble</em> juste et rien ne passe. Débranche le dernier poste d’un VLAN et sa SVI tombe — comportement normal, souvent pris pour une panne.</p>'),

  block('heading', { level: 3, text: '6.5 — La sortie vers l’extérieur' }),
  block('html', { html: '<p>Entre VLAN, ce qui précède suffit. Dès qu’il faut sortir — Internet, un autre site — deux façons de raccorder le switch L3 au routeur de bordure :</p>' }),
  block('html', { html: `<table class="vl-t"><thead><tr><th>Méthode</th><th>Sur le switch L3</th><th>Quand la choisir</th></tr></thead><tbody>
    <tr><td><strong>Port routé</strong></td><td><code>no switchport</code> puis <code>ip address</code> sur le port physique</td><td>Le plus propre : un vrai lien point à point vers le routeur</td></tr>
    <tr><td><strong>VLAN de transit</strong></td><td>Un VLAN dédié (99 ou 199) avec sa SVI, en trunk vers le routeur</td><td>Quand le lien doit aussi transporter d’autres VLAN</td></tr>
  </tbody></table>` }),
  cmd(`! Port routé vers le routeur de bordure
interface GigabitEthernet0/2
 no switchport                      ! le port cesse d'être un port de commutation
 ip address 10.0.0.2 255.255.255.252
 no shutdown
 exit

! Puis la route par défaut
ip route 0.0.0.0 0.0.0.0 10.0.0.1`),

  note('yellow', '⚠️ ip default-gateway ne sert plus à rien ici', '<p>Sur un switch de niveau 2, <code>ip default-gateway</code> indique par où sortir pour l’administration. Dès que <code>ip routing</code> est actif, <strong>cette commande est ignorée</strong> : le switch route lui-même, il lui faut une vraie route — <code>ip route 0.0.0.0 0.0.0.0 …</code>. La ligne reste souvent dans la configuration sans que personne remarque qu’elle ne fait plus rien.</p>'),

  check('<p>Sur SW-L3 : <code>show ip interface brief</code> → <code>Vlan10</code> et <code>Vlan20</code> en <strong>up/up</strong>. Puis <code>show ip route</code> → deux lignes <code>C</code>, une par réseau : <em>c’est la preuve que le routage est actif</em>, car sans <code>ip routing</code> la table n’existe pas. Enfin, depuis PC-A1 : <code>ping 192.168.10.254</code> puis <code>ping 192.168.20.1</code>. <strong>Les VLAN communiquent, sans routeur.</strong></p>'),

  block('heading', { level: 3, text: 'Router-on-a-stick ou switch multicouche ?' }),
  block('html', { html: `<table class="vl-t"><thead><tr><th></th><th>Router-on-a-stick</th><th>Switch multicouche</th></tr></thead><tbody>
    <tr><td><strong>Matériel</strong></td><td>Routeur + switch</td><td>Un seul switch L3</td></tr>
    <tr><td><strong>Débit</strong></td><td>Limité : tout le trafic inter-VLAN passe deux fois par le même lien</td><td>Commutation matérielle, sans goulot</td></tr>
    <tr><td><strong>Passerelles</strong></td><td>Sous-interfaces <code>.10</code>, <code>.20</code></td><td>SVI <code>interface vlan 10</code>, <code>20</code></td></tr>
    <tr><td><strong>À ne pas oublier</strong></td><td><code>no shutdown</code> sur l’interface physique</td><td><code>ip routing</code>, et <code>encapsulation dot1q</code> sur le trunk</td></tr>
    <tr><td><strong>Sortie Internet</strong></td><td>Native : le routeur est déjà en bordure</td><td>Port routé ou VLAN de transit, plus une route par défaut</td></tr>
    <tr><td><strong>Coût</strong></td><td>Faible</td><td>Plus élevé</td></tr>
    <tr><td><strong>Usage</strong></td><td>Petit site, maquette, examen</td><td>Réseau d’entreprise</td></tr>
  </tbody></table>` }),

  note('gray', '💡 SVI, le nom qu’on entend en entreprise', '<p>Une <code>interface vlan 10</code> sur un switch L3 s’appelle une <strong>SVI</strong> (<em>Switched Virtual Interface</em>). C’est le terme du terrain : « la SVI du VLAN 10 » = la passerelle du VLAN 10, portée par le switch.</p>'),

  note('gray', '🏭 Sur du matériel réel', '<p>Certains modèles d’entrée de gamme — un 2960 en IOS 15, par exemple — ne routent qu’après <code>sdm prefer lanbase-routing</code> <strong>suivi d’un <code>reload</code></strong> : la commande répartit autrement la mémoire du switch et ne prend effet qu’au redémarrage. Sur 3560 et au-delà, rien à faire ; Packet Tracer accepte <code>ip routing</code> directement sur le 3560.</p>'),

  block('heading', { level: 2, text: '🔍 Récapitulatif des vérifications' }),
  cmd(`! Sur les switches
show vlan brief                  ! les VLAN existent, les ports sont dedans
show interfaces trunk            ! trunks actifs, VLAN natif, VLAN autorisés
show interfaces Fa0/1 switchport ! le mode réel d'un port

! Sur le routeur (router-on-a-stick)
show ip interface brief          ! les sous-interfaces .10 et .20 en up/up
show ip route                    ! les réseaux connectés apparaissent en C

! Sur le switch multicouche (SVI)
show ip interface brief          ! Vlan10 et Vlan20 en up/up
show ip route                    ! sans "ip routing", cette table n'existe pas
show running-config | include ip routing    ! la ligne est-elle bien là ?
show interfaces trunk            ! l'encapsulation dot1q est-elle posée ?

! Depuis un PC
ping <sa passerelle>             ! d'abord la passerelle
ping <PC d'un autre VLAN>        ! ensuite l'autre VLAN`),

  block('heading', { level: 2, text: '🛠️ Les pannes classiques, dans l’ordre où les chercher' }),
  block('html', { html: `<table class="vl-t"><thead><tr><th>Symptôme</th><th>Cause la plus probable</th><th>Vérification</th></tr></thead><tbody>
    <tr><td>Deux PC du <strong>même VLAN</strong>, même switch, ne se voient pas</td><td>Mauvais <code>access vlan</code>, ou VLAN non créé</td><td><code>show vlan brief</code></td></tr>
    <tr><td>Deux PC du <strong>même VLAN</strong>, switches différents</td><td>Trunk absent, mal configuré, ou VLAN non autorisé</td><td><code>show interfaces trunk</code></td></tr>
    <tr><td>Le ping vers la <strong>passerelle</strong> échoue</td><td><code>no shutdown</code> oublié, ou mauvaise passerelle sur le PC</td><td><code>show ip interface brief</code></td></tr>
    <tr><td>La passerelle répond, mais <strong>pas l’autre VLAN</strong></td><td>Sous-interface manquante, ou <code>ip routing</code> absent sur un L3</td><td><code>show ip route</code></td></tr>
    <tr><td>Sur switch L3 : la <strong>SVI reste down/down</strong></td><td>Aucun port actif dans ce VLAN, ou VLAN absent de la base</td><td><code>show vlan brief</code></td></tr>
    <tr><td>Sur 3560 : le passage en trunk est <strong>refusé</strong></td><td><code>switchport trunk encapsulation dot1q</code> non posé avant</td><td><code>show interfaces Gi0/1 switchport</code></td></tr>
    <tr><td>Les VLAN communiquent, mais <strong>pas Internet</strong></td><td>Route par défaut absente — <code>ip default-gateway</code> est ignoré dès que le routage est actif</td><td><code>show ip route</code></td></tr>
    <tr><td>Un VLAN passe, un autre non</td><td>VLAN absent de <code>allowed vlan</code>, ou natif divergent</td><td><code>show interfaces trunk</code></td></tr>
    <tr><td>Tout marchait, plus rien après redémarrage</td><td><code>write memory</code> oublié</td><td><code>show startup-config</code></td></tr>
  </tbody></table>` }),

  note('blue', '🧭 La méthode, plus utile que la liste', '<p>Dépanne <strong>de bas en haut</strong>, comme dans <a href="/pages/procedure-test-connectivite">Test de connectivité méthodique</a> : le lien est-il up ? le port est-il dans le bon VLAN ? le VLAN traverse-t-il le trunk ? la passerelle répond-elle ? le routage est-il actif ? Chaque question élimine une couche. Tester au hasard fait perdre bien plus de temps que de suivre l’ordre.</p>'),

  note('green', '🔗 Pour aller plus loin', '<p>Théorie : <a href="/pages/les-vlan">Les VLAN &amp; le routage inter-VLAN</a>. Durcissement : <a href="/pages/vlan-securite">Sécuriser les VLAN</a>. À l’échelle : <a href="/pages/vlan-vtp">VTP</a>. Téléphonie : <a href="/pages/vlan-voix">Le VLAN voix</a>. Procédures voisines : <a href="/pages/procedure-cisco-routeur-cli">Configurer un routeur en CLI</a>, <a href="/pages/procedure-dhcp-relais">DHCP centralisé : serveur + relais</a>, <a href="/pages/procedure-atelier-reseau-az">Réseau multi-routeurs de A à Z</a>. Outil : <a href="/atelier">Atelier Réseau</a>.</p>'),
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

/* TP 1.5 — Configuration réseau : IP statique dans une plage réservée.
   Le TP applique ce que le cours réseau explique. Sa vraie valeur est la
   section des messages d'erreur : celle qui distingue l'erreur inoffensive de
   celle qui compte.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-tp-config-reseau.ts */
import { block, note, sh, flow, table, styleLinux, publier } from './_cours-linux';
import type { PageBlock } from '../client/src/lib/page-blocks';

const PAGE = {
  slug: 'tp-config-reseau-statique',
  title: 'TP — Configuration réseau : IP statique',
  excerpt: 'Relever la configuration obtenue en DHCP, la transformer en adresse fixe prise dans la plage réservée, et appliquer sans se couper. Avec les deux messages d’erreur du TP — celui qui est inoffensif et celui qui ne l’est pas — et le configurateur du site pour vérifier avant d’écrire.',
};

const blocks: PageBlock[] = [
  block('hero', {
    eyebrow: 'TP · Linux',
    title: 'Configuration réseau : IP statique',
    subtitle: 'Relever ce que le DHCP a donné, puis le figer — sans perdre la main.',
  }),
  styleLinux,

  note('blue', '🎯 Objectif', '<p>Passer ta machine Debian d’une adresse obtenue en DHCP à une <strong>adresse fixe</strong>, prise dans la plage qui t’a été réservée — pour ne pas entrer en conflit avec les machines des autres, ni avec ta propre machine physique.</p>'),

  block('heading', { level: 2, text: '1) Sauvegarder avant de toucher' }),
  block('html', { html: '<p>La configuration réseau vit dans <code>/etc/network/interfaces</code>. On en fait une copie <strong>avant</strong> de l’ouvrir : c’est le seul retour arrière possible si l’on se coupe.</p>' }),
  sh(`sudo cp /etc/network/interfaces /etc/network/interfaces.old
ls -al /etc/network/          # verifier que l'original ET la copie sont la`),
  note('gray', '💡 Pourquoi <code>.old</code> et pas autre chose', '<p>Peu importe le suffixe, ce qui compte est de le reconnaître dans six mois. <code>.old</code> est la convention du TP ; en production on préfère souvent une date : <code>interfaces.avant-2026-08-25</code>, qui dit <em>quand</em> et permet d’en accumuler plusieurs.</p>'),

  block('heading', { level: 2, text: '2) Relever ce qu’on a' }),
  block('html', { html: '<p>Avant de figer quoi que ce soit, il faut savoir ce que le DHCP a donné. Deux commandes suffisent.</p>' }),
  sh(`ip a          # l'adresse, le masque, la diffusion
ip r          # les routes — c'est la qu'est la PASSERELLE`),
  flow(`$ ip a
2: enp0s3: <BROADCAST,MULTICAST,UP,LOWER_UP> ...
    inet 192.168.15.70/24 brd 192.168.15.255 scope global dynamic enp0s3
         │              │    └─ diffusion
         │              └─ MSR : /24, soit 255.255.255.0
         └─ l'adresse actuelle, obtenue en DHCP

$ ip r
default via 192.168.15.254 dev enp0s3       <- LA PASSERELLE
192.168.15.0/24 dev enp0s3 ... src 192.168.15.70`),
  table(['À relever', 'Exemple', 'Ce qu’il devient'], [
    ['Adresse IP', '<code>192.168.15.70</code>', '<strong>Remplacée</strong> par une adresse de ta plage réservée.'],
    ['MSR (masque)', '<code>/24</code> = <code>255.255.255.0</code>', 'Inchangé.'],
    ['Diffusion', '<code>192.168.15.255</code>', 'Se déduit du masque, on ne l’écrit pas.'],
    ['Passerelle', '<code>192.168.15.254</code>', 'Inchangée — c’est ta box.'],
  ]),
  note('yellow', '⚠️ La passerelle n’est pas dans <code>ip a</code>', '<p>C’est l’information qui manque toujours, et c’est <code>ip r</code> qui la donne : la ligne <code>default via</code>. Sans elle, la machine joindra son propre réseau et rien d’autre — le symptôme trompeur « je ping mon voisin mais pas Internet ».</p>'),
  note('gray', '💡 La deuxième ligne de <code>ip r</code>', '<p><code>192.168.15.0/24 dev enp0s3</code> dit : « pour joindre ce réseau, passe par cette carte ». Elle n’a pas été écrite par quelqu’un — elle est apparue toute seule quand l’interface a reçu son adresse. On l’appelle une route <strong>connectée</strong>.</p>'),

  block('heading', { level: 2, text: '3) Choisir son adresse' }),
  note('red', '🚫 Une adresse déjà prise coupe deux machines, pas une', '<p>Deux machines avec la même adresse, et plus rien ne fonctionne correctement pour <em>aucune</em> des deux — les réponses partent au hasard vers l’une ou l’autre. D’où la plage réservée : elle garantit que personne d’autre ne prendra la tienne.</p><p>Vérifie aussi que tu ne l’utilises pas déjà sur une <strong>autre VM allumée</strong>, ou sur ta machine physique. Un <code>ping</code> avant de l’attribuer coûte deux secondes : si quelque chose répond, c’est qu’elle est prise.</p>'),
  sh(`ping -c2 192.168.15.150     # si ca repond, l'adresse est DEJA utilisee`),

  block('heading', { level: 2, text: '4) Écrire la configuration' }),
  sh(`sudo nano /etc/network/interfaces`),
  flow(`# On ne touche JAMAIS au loopback. Il reste exactement comme ca.
auto lo
iface lo inet loopback

# La carte a modifier — verifie son nom avec « ip -br a » :
# enp0s3, ens18, eth0... il change d'une machine a l'autre.
auto enp0s3
iface enp0s3 inet static
    address 192.168.15.150
    netmask 255.255.255.0
    gateway 192.168.15.254`),
  note('blue', '💡 <code>dhcp</code> devient <code>static</code>', '<p>C’est le mot qui bascule tout : la ligne <code>iface enp0s3 inet dhcp</code> devient <code>iface enp0s3 inet static</code>, et les trois lignes indentées qui suivent fournissent ce que le serveur DHCP donnait.</p>'),
  note('gray', '💡 Deux façons d’écrire le masque', '<p><code>netmask 255.255.255.0</code> est la forme du TP, encore partout dans les documentations. La forme moderne le colle à l’adresse : <code>address 192.168.15.150/24</code>, et l’on supprime alors la ligne <code>netmask</code>. Les deux fonctionnent — ne pas mélanger les deux sur la même interface.</p>'),
  block('html', { html: '<p>Dans <code>nano</code> : <strong>Ctrl-O</strong> puis Entrée pour enregistrer, <strong>Ctrl-X</strong> pour quitter. (Ctrl-X seul propose d’enregistrer avant de sortir : répondre <strong>O</strong>.)</p>' }),

  block('heading', { level: 2, text: '5) Appliquer' }),
  sh(`sudo ifdown enp0s3     # eteindre la carte
sudo ifup enp0s3       # la rallumer avec la NOUVELLE configuration

ip a                   # verifier qu'on a bien la nouvelle adresse
ip r                   # et que la route par defaut est toujours la`),
  note('red', '🚫 Si tu travailles en SSH, tu vas perdre la main', '<p>Changer l’adresse coupe la session en cours — c’est normal, tu te reconnecteras sur la <strong>nouvelle</strong> adresse. Fais-le depuis la <strong>console de l’hyperviseur</strong>, pas par SSH, tant que tu n’es pas sûr de ta configuration.</p>'),

  block('heading', { level: 2, text: '6) Les deux messages d’erreur' }),
  block('html', { html: '<p>Le TP en produit deux, et il est important de ne pas les confondre : le premier est sans conséquence, le second bloque tout.</p>' }),
  note('green', '✅ Inoffensif — sur <code>ifdown</code>', '<div class="lx-cmd">ifdown: interface enp0s3 not configured</div><p>Tu demandes d’éteindre une carte qui est déjà éteinte. C’est une information, pas une panne : comme d’appuyer sur l’interrupteur d’une lampe déjà éteinte. <strong>Continue avec <code>ifup</code>.</strong></p><p>Ce qui compte, c’est de ne pas avoir d’erreur au <em>rallumage</em>.</p>'),
  note('red', '🚫 Bloquant — sur <code>ifup</code> ou <code>ifdown</code>', '<div class="lx-cmd">/etc/network/interfaces:2: unknown option &quot;adress&quot;</div><p>Une faute dans le fichier, avec le <strong>numéro de ligne</strong>. Presque toujours une faute de frappe : <code>adress</code> au lieu de <code>address</code>, <code>getway</code> au lieu de <code>gateway</code>, ou une indentation perdue.</p><p>On rouvre le fichier, on va à la ligne indiquée, on corrige — et l’on peut vérifier sans appliquer :</p><div class="lx-cmd">ifquery enp0s3     # ce que le FICHIER declare, sans rien appliquer</div>'),
  note('yellow', '⚠️ Le filet, si tout est perdu', '<p>La copie faite à l’étape 1 sert exactement à ça :</p><div class="lx-cmd">sudo cp /etc/network/interfaces.old /etc/network/interfaces\nsudo ifdown enp0s3 ; sudo ifup enp0s3</div><p>On revient à l’état d’avant, et l’on recommence tranquillement.</p>'),

  block('heading', { level: 2, text: '7) Contrôler que tout est en place' }),
  sh(`ip a                        # la nouvelle adresse est-elle posee ?
ip r                        # la route par defaut est-elle la ?
ping -c2 192.168.15.254     # la passerelle repond-elle ?
ping -c2 1.1.1.1            # ca sort ?
ping -c2 debian.org         # les noms se resolvent-ils ?`),
  note('green', '🎯 Les deux derniers <code>ping</code>, dans cet ordre', '<p><code>1.1.1.1</code> réussit et <code>debian.org</code> échoue : le réseau fonctionne, <strong>c’est le DNS</strong>. Les deux échouent : c’est la route ou la passerelle. Cette paire partage le problème en deux, et évite de reconfigurer une interface qui n’avait rien.</p>'),
  note('blue', '⚠️ Le DNS après un passage en statique', '<p>En DHCP, le serveur fournissait aussi les serveurs DNS. En statique, plus personne ne les donne — et <code>dns-nameservers</code> dans <code>interfaces</code> <strong>ne sert à rien sans le paquet <code>resolvconf</code></strong>, qui n’est pas installé sur une Debian minimale. Si les noms ne résolvent plus après ce TP, c’est là : il faut renseigner <code>/etc/resolv.conf</code> directement. → <a href="/pages/linux-reseau">le cours réseau</a>.</p>'),

  note('green', '🔧 Vérifier avant d’écrire', '<p>Le <a href="/pages/configurateur-debian-reseau">configurateur d’adressage</a> du site produit le fichier à partir de tes relevés, et signale ce que la syntaxe ne voit pas : passerelle hors du sous-réseau, adresse de réseau ou de diffusion, <code>auto</code> oublié. Il génère aussi un script qui restaure tout seul si la vérification échoue.</p>'),
  note('blue', '🔗 Les cours qui expliquent ce TP', '<p><a href="/pages/linux-reseau">Configuration réseau</a> — la grammaire du fichier, <code>/etc/hosts</code> et <code>/etc/resolv.conf</code> · <a href="/pages/linux-commandes-base">Commandes de base</a> · <a href="/pages/tp-debian-reseau-recherche">TP de recherche</a></p>'),
];

publier(PAGE, blocks).catch(e => { console.error(e); process.exit(1); });

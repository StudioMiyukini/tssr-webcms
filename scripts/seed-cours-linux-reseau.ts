/* Cours « Linux : configuration réseau ».
   Reprend le plan de la fiche existante (voir, statique Debian, Netplan, DNS,
   UFW) et le porte au niveau des autres cours du site : ce que chaque commande
   montre, ce qui casse, et la méthode de diagnostic couche par couche.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-linux-reseau.ts */
import { block, note, sh, flow, table, styleLinux, liens, publier } from './_cours-linux';
import type { PageBlock } from '../client/src/lib/page-blocks';

const PAGE = {
  slug: 'linux-reseau',
  title: 'Linux : configuration réseau',
  excerpt: 'Lire une configuration avec ip et ss, poser une adresse fixe sous Debian (/etc/network/interfaces) comme sous Ubuntu (Netplan), comprendre la résolution DNS et ce que systemd-resolved change, filtrer avec UFW — et diagnostiquer une panne couche par couche au lieu de tout retenter au hasard.',
};

const blocks: PageBlock[] = [
  block('hero', {
    eyebrow: 'Cours · Linux',
    title: PAGE.title,
    subtitle: 'Poser une adresse, la garder au redémarrage, et savoir où ça coince quand ça ne passe pas.',
  }),
  styleLinux,

  block('html', { html: '<p>Un serveur Linux se configure en trois couches, et les confondre fait perdre l’essentiel du temps de dépannage : <strong>l’adresse</strong> (la machine sait-elle qui elle est ?), <strong>la route</strong> (sait-elle par où sortir ?), <strong>la résolution</strong> (sait-elle traduire un nom ?). Une panne appartient toujours à l’une des trois, et on peut les tester séparément.</p>' }),

  block('heading', { level: 2, text: '1) Voir ce qui est configuré' }),
  note('blue', '🔗 Sur Rocky / RHEL, <code>/etc/network/interfaces</code> n’existe pas', '<p><code>ip a</code>, <code>ip r</code>, <code>/etc/hosts</code> et <code>/etc/resolv.conf</code> se comportent à l’identique. Mais la <strong>configuration permanente</strong> passe par <strong>NetworkManager</strong> — <code>nmtui</code> en menus, ou <code>nmcli</code> en ligne de commande — et non par un fichier <code>interfaces</code>.</p><p>→ <a href="/pages/linux-redhat">le cours Rocky</a>, §4c.</p>'),
  sh(`ip a                    # adresses par interface (remplace ifconfig)
ip r                    # table de routage : par ou on sort
ip -br a                # une ligne par interface : lisible d'un coup d'oeil
ss -tulpn               # ports en ecoute, et QUI les ecoute (remplace netstat)
ip neigh                # table ARP : qui repond sur le lien local`),
  flow(`$ ip -br a
lo               UNKNOWN  127.0.0.1/8
ens18            UP       192.168.10.20/24
                 │        └─ adresse ET masque, ensemble
                 └─ UP = le lien est actif. DOWN = cable, VM, ou interface eteinte.

$ ip r
default via 192.168.10.254 dev ens18     <- la passerelle
192.168.10.0/24 dev ens18 proto kernel scope link src 192.168.10.20`),
  note('yellow', '⚠️ Pas de ligne <code>default</code>, pas d’Internet', '<p>Une machine sans route par défaut joint parfaitement son propre réseau et rien d’autre. Le symptôme trompe : « le ping du serveur voisin marche, donc le réseau va bien ». Il ne va pas bien. <code>ip r</code> est la deuxième commande à taper, toujours.</p>'),
  note('gray', '💡 <code>ifconfig</code> et <code>netstat</code> ne sont plus installés', '<p>Ils appartiennent à <code>net-tools</code>, absent des Debian récentes. Ce n’est pas une panne : <code>ip</code> et <code>ss</code> les remplacent, et donnent davantage. Autant prendre l’habitude tout de suite — c’est ce qu’on trouvera sur les serveurs.</p>'),

  block('heading', { level: 2, text: '2) Adresse fixe — Debian, /etc/network/interfaces' }),
  sh(`sudo nano /etc/network/interfaces`),
  flow(`# Le loopback, toujours present
auto lo
iface lo inet loopback

# L'interface serveur, en statique
auto ens18                       # 'auto' = montee au demarrage
iface ens18 inet static
    address 192.168.10.20/24     # notation moderne, masque inclus
    gateway 192.168.10.254
    dns-nameservers 192.168.10.11 1.1.1.1

# La meme, en DHCP :
# iface ens18 inet dhcp`),
  sh(`sudo systemctl restart networking
# ou, sans couper les autres interfaces :
sudo ifdown ens18 && sudo ifup ens18

ip a show ens18       # verifier avant de fermer la session !`),
  note('red', '🚫 Redémarrer le réseau par SSH', '<p>Si la configuration est fausse, la session tombe et la machine est injoignable — il faut la console de l’hyperviseur. Sur un serveur distant, on prend l’habitude de lancer un filet : <code>echo "ip a add 192.168.10.20/24 dev ens18" | at now + 5 minutes</code>, ou une session <code>tmux</code> qui survit à la coupure. C’est la première leçon d’administration distante, et elle s’apprend en général une fois.</p>'),
  note('blue', '💡 <code>ens18</code>, <code>enp0s3</code>, <code>eth0</code> ?', '<p>Les noms « prévisibles » décrivent l’emplacement matériel : <code>en</code> (ethernet) + <code>p0s3</code> (bus PCI 0, slot 3). C’est stable au rebranchement, contrairement à <code>eth0</code> qui pouvait changer d’une carte à l’autre au redémarrage. <strong>Vérifie toujours le nom avec <code>ip -br a</code></strong> avant d’écrire le fichier : configurer <code>eth0</code> sur une machine qui a <code>ens18</code> est la faute la plus fréquente du TP.</p>'),

  block('heading', { level: 3, text: 'La grammaire du fichier' }),
  block('html', { html: '<p>Le fichier est fait de <strong>strophes</strong>. Chacune commence par un mot-clé et s’applique jusqu’à la suivante ; les lignes indentées en dessous sont ses options.</p>' }),
  flow(`auto ens18
│    └─ l'interface concernee
└─ QUAND la monter

iface ens18 inet static
│     │     │    └─ la METHODE : comment obtenir l'adresse
│     │     └─ la FAMILLE : inet = IPv4, inet6 = IPv6
│     └─ l'interface
└─ declaration

    address 192.168.10.20/24
    └─ les OPTIONS, indentees, propres a la methode choisie`),

  block('heading', { level: 3, text: 'Quand monter l’interface' }),
  table(['Mot-clé', 'Ce qu’il déclenche', 'Où on le veut'], [
    ['<code>auto</code>', 'Montée <strong>au démarrage</strong>, systématiquement, même câble débranché.', '<strong>Sur un serveur.</strong> L’interface doit exister au boot, quoi qu’il arrive.'],
    ['<code>allow-hotplug</code>', 'Montée <strong>quand le noyau détecte</strong> la carte : branchement à chaud, USB, câble reconnecté.', 'Sur un portable, ou une carte amovible.'],
    ['<em>ni l’un ni l’autre</em>', 'L’interface est déclarée mais jamais montée seule.', 'Quand on la monte à la main : <code>ifup ens18</code>.'],
  ]),
  note('yellow', '⚠️ Le symptôme d’un <code>auto</code> oublié', '<p>La configuration est juste, <code>ifup ens18</code> fonctionne parfaitement — et après redémarrage la machine n’a plus d’adresse. C’est exactement le pendant réseau de <code>start</code> sans <code>enable</code> : ça marche maintenant, ça ne survit pas au boot.</p>'),

  block('heading', { level: 3, text: 'Les méthodes' }),
  table(['Méthode', 'Ce qu’elle fait'], [
    ['<code>static</code>', 'Adresse fixe, écrite ici. Le cas d’un serveur.'],
    ['<code>dhcp</code>', 'Adresse obtenue d’un serveur DHCP.'],
    ['<code>loopback</code>', 'Réservée à <code>lo</code>. Ne jamais la retirer — beaucoup de services en dépendent.'],
    ['<code>manual</code>', 'L’interface est montée <strong>sans adresse</strong>. Sert aux ponts, aux VLAN et aux interfaces d’agrégation.'],
  ]),

  block('heading', { level: 3, text: 'Les options utiles' }),
  table(['Option', 'Rôle'], [
    ['<code>address 192.168.10.20/24</code>', 'L’adresse et son masque. Forme moderne, tout-en-un.'],
    ['<code>netmask 255.255.255.0</code>', 'L’ancienne écriture du masque, séparée. Encore très répandue dans les documentations.'],
    ['<code>gateway 192.168.10.254</code>', 'La passerelle. <strong>Une seule pour toute la machine</strong>, pas une par interface.'],
    ['<code>dns-nameservers</code> / <code>dns-search</code>', 'Les serveurs DNS et le domaine de recherche — mais voir le piège ci-dessous.'],
    ['<code>mtu 1500</code>', 'Taille maximale des trames. À baisser derrière certains VPN.'],
    ['<code>hwaddress ether 00:11:22:33:44:55</code>', 'Force une adresse MAC.'],
  ]),
  note('red', '🚫 <code>dns-nameservers</code> ne fait rien tout seul', '<p>Cette ligne n’est pas lue par le noyau : elle est traitée par le paquet <strong><code>resolvconf</code></strong>, qui écrit ensuite <code>/etc/resolv.conf</code>. Sur une Debian minimale — celle du TP, où l’on a tout décoché — ce paquet <strong>n’est pas installé</strong>, et la ligne est ignorée en silence. On croit avoir configuré le DNS, et la résolution ne marche pas.</p><p>Deux issues : installer <code>resolvconf</code>, ou renseigner directement <code>/etc/resolv.conf</code> — voir la section 4.</p>'),

  block('heading', { level: 3, text: 'Les crochets : agir au montage' }),
  block('html', { html: '<p>Quatre mots-clés permettent d’exécuter une commande autour du montage. C’est ainsi qu’on ajoute une route ou une seconde adresse sans outil supplémentaire.</p>' }),
  flow(`pre-up    avant de monter l'interface
up        juste apres l'avoir montee
down      juste avant de la descendre
post-down apres l'avoir descendue`),
  sh(`auto ens18
iface ens18 inet static
    address 192.168.10.20/24
    gateway 192.168.10.254
    # Une seconde adresse sur la meme carte
    up   ip addr add 192.168.10.21/24 dev ens18
    down ip addr del 192.168.10.21/24 dev ens18
    # Une route vers un reseau joignable par un AUTRE routeur
    up   ip route add 10.0.0.0/8 via 192.168.10.253`),
  note('gray', '💡 Chaque <code>up</code> doit avoir son <code>down</code>', '<p>Sinon l’adresse ou la route survit à un <code>ifdown</code>, et la configuration réelle diverge de ce que décrit le fichier. C’est le genre d’écart qu’on découvre six mois plus tard, en cherchant pourquoi une route existe alors que personne ne l’a déclarée.</p>'),

  block('heading', { level: 3, text: 'Découper le fichier' }),
  sh(`# En tete de /etc/network/interfaces, presente par defaut :
source /etc/network/interfaces.d/*

ls /etc/network/interfaces.d/`),
  block('html', { html: '<p>Même logique que pour les dépôts : un fichier par interface ou par usage dans <code>interfaces.d/</code>, plutôt qu’un fichier principal qui grossit. On retire une configuration en supprimant un fichier.</p>' }),

  block('heading', { level: 3, text: 'Appliquer, et vérifier' }),
  sh(`sudo ifup ens18                # monter UNE interface
sudo ifdown ens18              # la descendre
sudo ifdown ens18 && sudo ifup ens18   # la recharger, sans toucher aux autres

sudo systemctl restart networking      # tout recharger (plus brutal)

ifquery ens18                  # ce que le FICHIER declare
ifquery --state                # ce qui est cense etre monte
ip a show ens18                # ce qui est REELLEMENT applique`),
  note('green', '🎯 <code>ifquery</code> contre <code>ip a</code> : le seul test qui tranche', '<p>Le premier montre ce que le fichier <strong>dit</strong>, le second ce que la machine <strong>fait</strong>. Quand les deux divergent, la configuration n’a pas été appliquée — ou quelque chose d’autre la pilote, voir juste en dessous. C’est en dix secondes la réponse à « pourtant j’ai bien écrit l’adresse ».</p>'),
  note('red', '🚫 Deux gestionnaires pour une même interface', '<p>Si <strong>NetworkManager</strong> est installé, il pilote par défaut les interfaces qu’<code>ifupdown</code> ne déclare pas — et sur certaines installations, les deux se disputent la même carte : l’adresse change toute seule, ou revient en DHCP après quelques minutes. Sur un serveur, on garde <strong>un seul</strong> gestionnaire. <code>systemctl status NetworkManager</code> dit s’il tourne ; <code>nmcli device status</code> montre ce qu’il gère.</p>'),
  note('yellow', '⚠️ Une erreur de syntaxe ne se voit pas toujours', '<p><code>ifup</code> s’arrête à la première strophe fautive et laisse les suivantes non appliquées — parfois sans message clair. Après toute modification : <code>ifquery --state</code> et <code>ip a</code>, <strong>avant</strong> de fermer la session SSH.</p>'),

  block('heading', { level: 2, text: '3) Adresse fixe — Ubuntu, Netplan' }),
  block('html', { html: '<p>Ubuntu serveur décrit le réseau en YAML dans <code>/etc/netplan/</code>. Le YAML est <strong>sensible à l’indentation</strong>, et refuse les tabulations.</p>' }),
  flow(`# /etc/netplan/01-serveur.yaml
network:
  version: 2
  renderer: networkd
  ethernets:
    ens18:
      dhcp4: false
      addresses: [192.168.10.20/24]
      routes:
        - to: default
          via: 192.168.10.254
      nameservers:
        addresses: [192.168.10.11, 1.1.1.1]
        search: [miyukini.lan]`),
  sh(`sudo netplan try      # applique, et REVIENT EN ARRIERE au bout de 120 s
                      # si on ne confirme pas. A utiliser en SSH, toujours.
sudo netplan apply    # applique definitivement
sudo netplan get      # la configuration effective, fusionnee`),
  note('green', '🎯 <code>netplan try</code> est la réponse au piège précédent', '<p>Il applique la configuration, attend une confirmation au clavier, et restaure l’ancienne si elle ne vient pas. Une erreur ne coupe donc l’accès que deux minutes. C’est exactement le filet que Debian n’offre pas.</p>'),
  note('yellow', '⚠️ <code>gateway4</code> est obsolète', '<p>On le rencontre encore dans beaucoup de tutoriels. Netplan récent affiche un avertissement et l’ignorera à terme : la forme <code>routes: - to: default</code> est celle qu’il faut écrire.</p>'),

  block('heading', { level: 2, text: '4) La résolution des noms' }),
  block('html', { html: '<p>Traduire <code>srv.miyukini.lan</code> en adresse n’est pas une seule opération : c’est une <strong>chaîne</strong>, et elle se parcourt toujours dans le même ordre. La connaître, c’est savoir où regarder — et dans quel ordre — quand un nom ne résout pas.</p>' }),
  flow(`  Une application demande « srv.miyukini.lan »
              │
              v
  1. /etc/nsswitch.conf      QUI decide de l'ordre
              │              ligne « hosts: files dns »
              v
  2. /etc/hosts              CONSULTE EN PREMIER
              │              une correspondance ici ? -> on s'arrete la,
              │              le DNS ne sera jamais interroge
              v (rien trouve)
  3. /etc/resolv.conf        A QUI demander
              │              les serveurs DNS, dans l'ordre
              v
  4. Le serveur DNS repond   ou dit que le nom n'existe pas`),
  table(['Fichier', 'Sa question', 'Le piège'], [
    ['<code>/etc/nsswitch.conf</code>', '<strong>Dans quel ordre</strong> chercher ?', 'On ne pense jamais à le regarder — c’est pourtant lui qui donne la priorité au fichier local.'],
    ['<code>/etc/hosts</code>', '<strong>La réponse est-elle déjà ici ?</strong>', 'Une entrée périmée masque le DNS <em>en silence</em>, et l’on cherche du mauvais côté.'],
    ['<code>/etc/resolv.conf</code>', '<strong>À qui</strong> demander ensuite ?', 'Souvent généré : l’éditer à la main ne tient pas au redémarrage.'],
  ]),
  note('green', '🎯 L’ordre est aussi celui du dépannage', '<p>Devant un nom qui ne résout pas, on remonte la chaîne dans le sens où elle est parcourue : <strong>d’abord <code>hosts</code></strong> — y a-t-il une entrée qui interfère ? — <strong>puis <code>resolv.conf</code></strong> — interroge-t-on le bon serveur ? La cause est presque toujours dans l’un des deux, et rarement dans le serveur DNS lui-même.</p>'),

  block('heading', { level: 3, text: '/etc/hosts — le fichier consulté en premier' }),
  block('html', { html: '<p>C’est l’ancêtre du DNS : avant qu’il n’existe, chaque machine portait la liste complète des noms du réseau dans ce fichier. Il a survécu, et il garde une propriété décisive — <strong>il est consulté avant d’interroger le moindre serveur DNS</strong>.</p>' }),
  sh(`cat /etc/hosts

127.0.0.1       localhost
127.0.1.1       srv-debian.miyukini.lan   srv-debian
 │              │                          └─ alias (nom court)
 │              └─ nom canonique (FQDN)
 └─ l'adresse

# Les lignes IPv6, presentes par defaut
::1     localhost ip6-localhost ip6-loopback
ff02::1 ip6-allnodes
ff02::2 ip6-allrouters`),
  block('html', { html: '<p>Le format tient en une phrase : <strong>une adresse, puis un ou plusieurs noms</strong>, séparés par des espaces ou des tabulations. Le premier nom est le nom canonique, les suivants sont des alias. Une ligne par adresse, et <code>#</code> commence un commentaire.</p>' }),
  note('gray', '💡 Le mystérieux <code>127.0.1.1</code>', '<p>Ce n’est pas une faute de frappe pour <code>127.0.0.1</code>. C’est une particularité Debian : elle permet à la machine de résoudre <strong>son propre nom</strong> même sans réseau, sans pour autant l’associer à <code>localhost</code>. La distinction compte pour les logiciels qui résolvent leur propre nom au démarrage.</p>'),

  block('heading', { level: 3, text: 'Qui décide de l’ordre : nsswitch.conf' }),
  sh(`grep '^hosts' /etc/nsswitch.conf
hosts:  files dns
        │     └─ ensuite seulement, le DNS
        └─ D'ABORD /etc/hosts`),
  block('html', { html: '<p>C’est cette ligne, et elle seule, qui donne la priorité au fichier. Inverser l’ordre serait possible — personne ne le fait, mais savoir <em>où</em> l’ordre est décidé permet de répondre à « pourquoi ma machine ignore le DNS ? ».</p>' }),

  block('heading', { level: 3, text: 'À quoi il sert vraiment' }),
  table(['Usage', 'Pourquoi ici plutôt que dans le DNS'], [
    ['<strong>Maquette sans DNS</strong>', 'En TP ou sur un réseau isolé, quelques lignes remplacent un serveur à monter.'],
    ['<strong>Forcer une adresse</strong>', 'Tester un serveur de recette avant de basculer l’enregistrement DNS public.'],
    ['<strong>Dépanner</strong>', 'Vérifier qu’un problème vient bien du DNS : si ça marche avec une entrée <code>hosts</code>, c’est la résolution qui échoue, pas le réseau.'],
    ['<strong>Bloquer un domaine</strong>', 'Le renvoyer vers <code>0.0.0.0</code>. Efficace sur une machine, ingérable sur un parc.'],
  ]),
  sh(`sudo nano /etc/hosts

# Ajouter une correspondance
192.168.10.11   srv-fichiers.miyukini.lan   srv-fichiers

# Bloquer un domaine
0.0.0.0         pub.exemple.com

# Aucun service a redemarrer : le fichier est relu a chaque resolution.`),
  note('green', '🎯 Le test qui isole le DNS en dix secondes', '<p>Un service est injoignable par son nom. On ajoute son adresse dans <code>/etc/hosts</code> et on réessaie : si ça marche, le réseau et le service vont bien, <strong>c’est la résolution de noms qui est en cause</strong>. Si ça ne marche toujours pas, le problème est ailleurs. Une ligne, et le champ des causes est divisé en deux — puis on retire la ligne.</p>'),

  block('heading', { level: 3, text: 'Les trois pièges' }),
  note('red', '🚫 <code>ping</code> et <code>dig</code> se contredisent', '<p><code>ping srv</code> utilise <code>/etc/hosts</code> ; <code>dig srv</code> interroge <strong>directement le DNS</strong> et ignore le fichier. Une entrée périmée dans <code>hosts</code> fait donc répondre <code>ping</code> avec une adresse que <code>dig</code> ne connaît pas — et l’on cherche pendant une heure du côté du serveur DNS. Pour trancher : <code>getent hosts srv</code>, qui suit exactement le même chemin que les applications.</p>'),
  note('red', '🚫 « sudo: unable to resolve host »', '<p>Après avoir renommé la machine dans <code>/etc/hostname</code> <strong>sans mettre à jour <code>/etc/hosts</code></strong>, chaque <code>sudo</code> attend plusieurs secondes puis affiche cet avertissement. La commande finit par s’exécuter, ce qui fait croire à un détail — mais c’est un délai à chaque appel. Le nom doit figurer sur la ligne <code>127.0.1.1</code>, et les deux fichiers doivent dire la même chose.</p>'),
  note('yellow', '⚠️ Il ne connaît ni les jokers ni les sous-domaines', '<p><code>*.exemple.com</code> ne fonctionne pas : une correspondance est exacte, nom par nom. Et le fichier ne vaut que pour <strong>cette machine</strong> — ce n’est pas un serveur DNS, rien n’est publié aux autres. Pour un parc, il faut un vrai DNS.</p>'),

  sh(`getent hosts srv-fichiers      # LE test : le meme chemin que les applications
ping -c1 srv-fichiers          # utilise /etc/hosts
dig +short srv-fichiers        # IGNORE /etc/hosts : interroge le DNS
resolvectl query srv-fichiers  # ce que systemd-resolved en fait

hostnamectl                    # le nom de la machine, et sa coherence
grep '^hosts' /etc/nsswitch.conf`),
  note('blue', '🪟 Côté Windows, le même fichier', '<p><code>C:\\Windows\\System32\\drivers\\etc\\hosts</code> — même format, même priorité sur le DNS, et les mêmes pièges. Il faut l’ouvrir en administrateur, et <code>ipconfig /displaydns</code> montre le cache que Windows ajoute par-dessus — cache que Linux n’a pas par défaut, sauf si <code>systemd-resolved</code> est actif.</p>'),

  block('heading', { level: 3, text: '/etc/resolv.conf — à QUI on demande' }),
  block('html', { html: '<p>Quand <code>/etc/hosts</code> ne répond pas, il faut interroger un serveur. Ce fichier dit lesquels.</p>' }),
  sh(`cat /etc/resolv.conf

nameserver 192.168.10.11      # le serveur DNS a interroger
nameserver 1.1.1.1            # le suivant, SI le premier ne repond pas
search miyukini.lan           # domaine ajoute aux noms courts
options timeout:2 attempts:2  # facultatif : patience et nombre d'essais`),
  table(['Directive', 'Ce qu’elle fait'], [
    ['<code>nameserver</code>', 'Un serveur DNS. <strong>Trois au maximum</strong> — la bibliothèque C ignore les suivants, silencieusement.'],
    ['<code>search</code>', 'Domaines essayés pour un nom court : <code>ping srv</code> devient <code>srv.miyukini.lan</code>.'],
    ['<code>domain</code>', 'Ancienne forme, un seul domaine. <code>search</code> la remplace.'],
    ['<code>options</code>', '<code>timeout:2</code> secondes d’attente, <code>attempts:2</code> essais par serveur, <code>rotate</code> pour alterner.'],
  ]),
  note('red', '🚫 Le second nameserver n’est pas un équilibrage', '<p>Il n’est interrogé que si le premier <strong>ne répond pas du tout</strong>. Un serveur qui répond « ce nom n’existe pas » a répondu : on ne passe pas au suivant. C’est pourquoi mettre <code>1.1.1.1</code> en secours derrière le DNS du domaine ne rattrape rien quand l’annuaire interne est incomplet — et fait perdre des heures à chercher pourquoi « le secours ne prend pas le relais ».</p>'),

  note('yellow', '⚠️ L’éditer ne sert souvent à rien', '<p>Sur un système moderne, ce fichier est <strong>généré</strong> : NetworkManager, <code>systemd-resolved</code> ou <code>ifupdown</code> le réécrivent au redémarrage, et la modification faite à la main disparaît. On regarde donc toujours à quoi on a affaire avant d’ouvrir l’éditeur.</p>'),
  sh(`ls -l /etc/resolv.conf

# Trois cas possibles :
# -rw-r--r--  1 root root  ...  /etc/resolv.conf
#     -> un vrai fichier : l'editer fonctionne
#
# lrwxrwxrwx  ... /etc/resolv.conf -> ../run/systemd/resolve/stub-resolv.conf
#     -> systemd-resolved : passer par lui (voir plus bas)
#
# lrwxrwxrwx  ... /etc/resolv.conf -> /run/resolvconf/resolv.conf
#     -> genere par resolvconf a partir de la conf reseau`),
  note('gray', '💡 Pourquoi <code>nameserver 127.0.0.53</code>', '<p>Cette adresse de bouclage n’est pas une erreur : c’est le <em>stub</em> de <code>systemd-resolved</code>, qui écoute localement, met en cache et transmet aux vrais serveurs. Les serveurs réellement utilisés ne sont donc <strong>pas</strong> dans ce fichier — il faut <code>resolvectl status</code> pour les voir.</p>'),

  block('heading', { level: 3, text: 'Le poser durablement' }),
  sh(`# Debian, dans /etc/network/interfaces : la ligne est reprise au demarrage
iface ens18 inet static
    address 192.168.10.20/24
    gateway 192.168.10.254
    dns-nameservers 192.168.10.11 1.1.1.1
    dns-search miyukini.lan

# Ubuntu / Netplan
#   nameservers:
#     addresses: [192.168.10.11, 1.1.1.1]
#     search: [miyukini.lan]

# systemd-resolved : /etc/systemd/resolved.conf
#   [Resolve]
#   DNS=192.168.10.11
#   Domains=miyukini.lan
sudo systemctl restart systemd-resolved`),
  sh(`resolvectl status              # les serveurs REELLEMENT utilises, par interface
resolvectl query srv           # resoudre en passant par la meme chaine que les applis
resolvectl flush-caches        # vider le cache apres un changement DNS
resolvectl statistics          # taux de reussite du cache`),
  note('green', '🎯 L’ordre de lecture, en une ligne', '<p><strong><code>nsswitch.conf</code> dit dans quel ordre, <code>hosts</code> répond en premier, <code>resolv.conf</code> dit à qui demander ensuite.</strong> Les trois fichiers forment une chaîne : devant une résolution qui se comporte mal, on les regarde dans cet ordre, et la cause apparaît presque toujours au premier ou au deuxième.</p>'),

  note('blue', '💡 Le domaine de recherche', '<p><code>search miyukini.lan</code> permet de taper <code>ping srv</code> au lieu de <code>ping srv.miyukini.lan</code>. Pratique — et source de confusion quand un nom court résout « tout seul » sur une machine et pas sur une autre.</p>'),

  block('heading', { level: 2, text: '5) Le pare-feu : UFW' }),
  block('html', { html: '<p>Sous le capot, Linux filtre avec <strong>nftables</strong> (successeur d’iptables). <strong>UFW</strong> en est une façade lisible, et c’est celle qu’on attend en TSSR sur Debian et Ubuntu.</p>' }),
  sh(`sudo ufw status verbose

# La posture par defaut : on refuse ce qui entre, on laisse sortir
sudo ufw default deny incoming
sudo ufw default allow outgoing

# ON OUVRE SSH AVANT D'ACTIVER. Sinon on se ferme dehors.
sudo ufw allow 22/tcp
sudo ufw enable

sudo ufw allow 80,443/tcp                       # un serveur web
sudo ufw allow from 192.168.10.0/24 to any port 3306   # MySQL, LAN seulement
sudo ufw limit 22/tcp                           # freine le bourrage de mots de passe

sudo ufw status numbered
sudo ufw delete 3`),
  note('red', '🚫 L’ordre compte : <code>allow 22</code> avant <code>enable</code>', '<p><code>ufw enable</code> applique immédiatement la politique par défaut. Activer d’abord et autoriser SSH ensuite coupe la session en cours, et la règle suivante n’arrive jamais. UFW affiche un avertissement — qu’on lit rarement à temps.</p>'),
  note('gray', '💡 Docker perce UFW', '<p>Docker écrit ses propres règles directement dans nftables, en amont de celles d’UFW : un port publié par un conteneur est joignable même si UFW l’interdit. Ce n’est pas un bug d’UFW, c’est une conséquence de l’architecture. À savoir avant de conclure que « le pare-feu ne marche pas ».</p>'),

  block('heading', { level: 2, text: '6) Diagnostiquer : couche par couche' }),
  block('html', { html: '<p>Devant « ça ne marche pas », on ne retente pas au hasard : on descend la pile, et on s’arrête au premier échec. Chaque étape écarte une cause.</p>' }),
  flow(`1. Le lien          ip -br a          ens18 est-il UP ?
2. L'adresse        ip a              en a-t-il une, dans le bon reseau ?
3. La passerelle    ping 192.168.10.254   le routeur repond-il ?
4. La route         ip r              y a-t-il un 'default via' ?
5. L'exterieur      ping 1.1.1.1      ca sort ? (adresse, pas nom)
6. Le DNS           dig cisco.com     le nom se traduit-il ?
7. Le service       ss -tulpn         le port ecoute-t-il ?
8. Le filtre        sudo ufw status   la regle existe-t-elle ?`),
  note('green', '🎯 L’étape 5 puis 6 : le test qui vaut dix minutes', '<p><code>ping 1.1.1.1</code> réussit et <code>ping cisco.com</code> échoue : le réseau fonctionne, <strong>c’est le DNS</strong>. Les deux échouent : c’est la route ou la passerelle. Cette seule paire de commandes partage le problème en deux, et évite de reconfigurer une interface qui n’avait rien.</p>'),
  sh(`# Aller plus loin quand le chemin est en cause
traceroute 1.1.1.1          # ou l'on s'arrete
mtr 1.1.1.1                 # traceroute continu : voit les pertes intermittentes
nc -zv srv.miyukini.lan 445 # ce port precis est-il joignable ?
sudo tcpdump -i ens18 port 53 -n   # ce qui part vraiment sur le fil`),
  note('blue', '🧩 Le lien avec le reste du cursus', '<p>Ces couches sont celles du <a href="/pages/modele-osi">modèle OSI</a>, et le raisonnement est le même que dans l’<a href="/pages/atelier-reseau">Atelier Réseau</a> : adresse, passerelle, route, service. Ce qui change entre un routeur Cisco et un serveur Debian, c’est la syntaxe — pas la démarche.</p>'),

  liens('/pages/linux-reseau'),
];

publier(PAGE, blocks).catch(e => { console.error(e); process.exit(1); });

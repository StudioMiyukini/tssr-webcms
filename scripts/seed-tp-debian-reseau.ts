/* TP 1.3.1 — Recherche : configuration d'une machine Debian et réseau.
 *
 * C'est un TP de recherche : l'élève doit chercher lui-même, et le support
 * précise l'intention — garder le fichier et le maintenir à jour comme
 * glossaire personnel. Les réponses figurent donc en fin de page, annoncées
 * comme des repères de vérification, pas comme un corrigé à recopier.
 *
 * Usage : BASE=... ADMIN_PW=... tsx scripts/seed-tp-debian-reseau.ts
 */
import { block, note, sh, flow, table, styleLinux, publier } from './_cours-linux';
import type { PageBlock } from '../client/src/lib/page-blocks';

const PAGE = {
  slug: 'tp-debian-reseau-recherche',
  title: 'TP — Recherche : configuration d’une machine Debian et réseau',
  excerpt: 'Le TP de recherche qui suit l’installation : définir les commandes de base, les termes de /etc/network/interfaces, les fichiers de configuration, puis répondre à cinq questions sur le réseau, les services et les dépôts. Avec les repères de vérification en fin de page — à consulter après avoir cherché, pas avant.',
};

const blocks: PageBlock[] = [
  block('hero', {
    eyebrow: 'TP · Linux',
    title: 'Recherche : configuration d’une machine Debian et réseau',
    subtitle: 'Avant de toucher à une machine en ligne de commande, il faut connaître un minimum son environnement.',
  }),
  styleLinux,

  note('blue', '🎯 L’intention du TP', '<p>Ce travail produit <strong>ton</strong> glossaire. Garde le fichier, complète-le avec tes mots tout au long de la formation : il est plus simple de chercher une information dans un seul document que dans dix. Les réponses ci-dessous servent à <em>vérifier</em> ce que tu as trouvé — pas à remplacer la recherche, qui est justement l’exercice.</p>'),

  block('heading', { level: 2, text: 'Partie 1 — Les commandes' }),
  block('html', { html: '<p>Pour chacune : à quoi elle sert, son utilisation principale, et les options que tu juges utiles.</p>' }),
  flow(`  apt          sudo         su -  (ou su -l)     usermod
  exit         cd           cp                    pwd
  ls           nano         source                ip a
  ifconfig`),
  note('gray', '🔎 Où chercher', '<p><code>man commande</code> pour le manuel complet, <code>commande --help</code> pour l’essentiel, <code>apropos motif</code> quand on ne connaît pas le nom. Et la <a href="/pages/linux-commandes-base">fiche des commandes de base</a> du site, qui les couvre presque toutes.</p>'),

  block('heading', { level: 2, text: 'Partie 2 — Les termes de /etc/network/interfaces' }),
  flow(`  loopback     lo        iface      inet
  auto         allow-hotplug
  eth0         eth1      wlan0`),

  block('heading', { level: 2, text: 'Partie 3 — Les fichiers' }),
  flow(`  .bashrc
  /etc/hostname
  /etc/hosts
  /etc/network/interfaces
  /etc/resolv.conf
  /etc/apt/sources.list`),

  block('heading', { level: 2, text: 'Partie 4 — Les cinq questions' }),
  block('html', { html: '<ol><li>Quels paramètres mettre dans <code>/etc/network/interfaces</code> pour configurer une <strong>adresse IP statique</strong> ?</li><li>Quelles commandes pour voir la <strong>configuration réseau</strong> de la machine ?</li><li>Quelles commandes pour <strong>redémarrer un service</strong> ?</li><li>Quelles commandes pour <strong>éteindre</strong> l’ordinateur ? Et pour le <strong>redémarrer</strong> ?</li><li>Dans <code>/etc/apt/sources.list</code>, quelle est la <strong>syntaxe d’une ligne de dépôt</strong> ? Explique chaque composant.</li></ol>' }),

  note('yellow', '⏸️ Cherche d’abord', '<p>Ce qui suit est un repère de vérification. Le lire avant d’avoir cherché fait gagner une heure et perdre l’exercice : ce qu’on retient, c’est ce qu’on a trouvé soi-même.</p>'),

  block('heading', { level: 2, text: 'Repères — Partie 1' }),
  table(['Commande', 'À quoi elle sert', 'Options utiles'], [
    ['<code>apt</code>', 'Le gestionnaire de paquets de Debian (<em>Advanced Package Tool</em>) : installer, mettre à jour, supprimer.', '<code>update</code> (rafraîchit la liste), <code>upgrade</code>, <code>install</code>, <code>remove</code>, <code>search</code>'],
    ['<code>sudo</code>', 'Exécuter <strong>une commande</strong> avec les droits de root, en s’authentifiant avec son propre mot de passe. Laisse une trace dans les journaux.', '<code>-l</code> ce que j’ai le droit de faire, <code>-u</code> agir en tant qu’un autre'],
    ['<code>su -</code> / <code>su -l</code>', '<em>Switch user</em> : devenir un autre utilisateur, root par défaut. Le <strong>tiret charge son environnement complet</strong> (PATH, home).', 'Sans le tiret, on est root avec le PATH du précédent — et <code>usermod</code> répond « commande introuvable ».'],
    ['<code>usermod</code>', 'Modifier un compte : groupes, shell, verrouillage.', '<strong><code>-aG</code></strong> ajoute à un groupe. <strong>Sans le <code>-a</code>, on REMPLACE tous les groupes secondaires.</strong>'],
    ['<code>exit</code>', 'Quitter le shell courant. Après un <code>su -</code>, revient à l’utilisateur précédent.', '<code>Ctrl-D</code> fait la même chose.'],
    ['<code>cd</code>', 'Changer de dossier.', '<code>cd ..</code> parent · <code>cd ~</code> sa maison · <code>cd -</code> le précédent'],
    ['<code>cp</code>', 'Copier un fichier ou un dossier.', '<code>-r</code> récursif · <strong><code>-a</code></strong> préserve droits, dates et liens'],
    ['<code>pwd</code>', '<em>Print Working Directory</em> : afficher où l’on se trouve.', '—'],
    ['<code>ls</code>', 'Lister le contenu d’un dossier.', '<code>-l</code> format long · <code>-a</code> cachés · <code>-h</code> tailles lisibles · <code>-t</code> par date'],
    ['<code>nano</code>', 'Éditeur de texte simple, en console.', '<code>Ctrl-O</code> enregistrer · <code>Ctrl-X</code> quitter · <code>Ctrl-W</code> chercher'],
    ['<code>source</code>', 'Exécuter un fichier <strong>dans le shell courant</strong> — donc ses variables restent définies après.', '<code>. fichier</code> est l’écriture courte. Sert après avoir modifié <code>.bashrc</code>.'],
    ['<code>ip a</code>', 'Afficher les adresses des interfaces. Abrégé de <code>ip address show</code>.', '<code>ip -br a</code> une ligne par interface · <code>ip r</code> la table de routage'],
    ['<code>ifconfig</code>', 'L’<strong>ancienne</strong> commande d’affichage réseau, du paquet <code>net-tools</code>.', 'Plus installée par défaut : <code>ip</code> la remplace et donne davantage.'],
  ]),
  note('red', '🚫 Le piège du TP : <code>source</code> et <code>./</code>', '<p><code>./script.sh</code> lance le script dans un <strong>sous-shell</strong> : ce qu’il définit disparaît en sortant. <code>source script.sh</code> l’exécute dans le shell courant : ses variables et ses fonctions restent. C’est pour cela qu’après avoir modifié <code>.bashrc</code> on fait <code>source ~/.bashrc</code> — et non <code>./.bashrc</code>, qui ne changerait rien à la session en cours.</p>'),

  block('heading', { level: 2, text: 'Repères — Partie 2' }),
  table(['Terme', 'Ce qu’il désigne'], [
    ['<code>loopback</code>', 'La boucle locale : la machine se parle à elle-même. Toujours présente, indispensable au fonctionnement de nombreux services.'],
    ['<code>lo</code>', 'Le <strong>nom</strong> de cette interface, portant <code>127.0.0.1</code>.'],
    ['<code>iface</code>', 'Mot-clé qui <strong>déclare une interface</strong> : <code>iface eth0 inet static</code>.'],
    ['<code>inet</code>', 'La famille d’adresses : IPv4. Pour IPv6, on écrit <code>inet6</code>.'],
    ['<code>auto</code>', 'L’interface est montée <strong>au démarrage</strong>, systématiquement.'],
    ['<code>allow-hotplug</code>', 'L’interface est montée <strong>quand le noyau la détecte</strong> — branchement à chaud, carte USB, câble reconnecté.'],
    ['<code>eth0</code> / <code>eth1</code>', 'Anciens noms des cartes Ethernet, numérotés dans l’ordre de détection.'],
    ['<code>wlan0</code>', 'Une carte <strong>sans fil</strong>.'],
  ]),
  note('yellow', '⚠️ <code>auto</code> ou <code>allow-hotplug</code> : la nuance qui compte', '<p><code>auto</code> monte l’interface au démarrage même si le câble est débranché ; <code>allow-hotplug</code> attend que le noyau signale la carte. Sur un <strong>serveur</strong>, on veut <code>auto</code> : l’interface doit exister au boot, quoi qu’il arrive. Sur un portable, <code>allow-hotplug</code> est plus adapté.</p>'),
  note('blue', '💡 <code>eth0</code> a souvent disparu', '<p>Les noms « prévisibles » décrivent l’emplacement matériel : <code>ens18</code>, <code>enp0s3</code>. C’est stable au rebranchement, contrairement à <code>eth0</code> qui pouvait changer d’une carte à l’autre. <strong>Vérifie toujours avec <code>ip -br a</code></strong> avant d’écrire le fichier — configurer <code>eth0</code> sur une machine qui a <code>ens18</code> est la faute la plus fréquente.</p>'),

  block('heading', { level: 2, text: 'Repères — Partie 3' }),
  table(['Fichier', 'Son rôle'], [
    ['<code>.bashrc</code>', 'Dans <strong>ta maison</strong> : lu à chaque ouverture de shell interactif. Alias, invite, variables. Personnel — chaque utilisateur a le sien.'],
    ['<code>/etc/hostname</code>', 'Le nom de la machine, seul, sur une ligne.'],
    ['<code>/etc/hosts</code>', 'Correspondances nom ↔ adresse <strong>locales</strong>, consultées <strong>avant</strong> le DNS. Une entrée oubliée ici masque le DNS et produit une panne incompréhensible. → <a href="/pages/linux-reseau">le détail dans le cours réseau</a>.'],
    ['<code>/etc/network/interfaces</code>', 'La configuration réseau persistante sous Debian : statique ou DHCP, par interface.'],
    ['<code>/etc/resolv.conf</code>', 'Les serveurs DNS à interroger, et le domaine de recherche. <strong>Souvent généré</strong> : vérifier avec <code>ls -l</code> avant d’éditer — <a href="/pages/linux-reseau">pourquoi, et comment le poser durablement</a>.'],
    ['<code>/etc/apt/sources.list</code>', 'Les dépôts où <code>apt</code> va chercher les paquets.'],
  ]),

  block('heading', { level: 2, text: 'Repères — Partie 4' }),
  block('heading', { level: 3, text: '1. Une adresse IP statique' }),
  sh(`# /etc/network/interfaces
auto lo
iface lo inet loopback

auto ens18                       # 'auto' : montee au demarrage
iface ens18 inet static          # 'static' plutot que 'dhcp'
    address 192.168.10.20/24     # l'adresse ET le masque
    gateway 192.168.10.254       # la passerelle
    dns-nameservers 192.168.10.11 1.1.1.1`),
  note('gray', '💡 Deux écritures du masque', '<p><code>address 192.168.10.20/24</code> est la forme moderne, tout-en-un. L’ancienne sépare : <code>address 192.168.10.20</code> puis <code>netmask 255.255.255.0</code>. Les deux fonctionnent ; on rencontre encore la seconde dans beaucoup de documentations.</p>'),
  sh(`sudo systemctl restart networking
# ou, sans couper les autres interfaces :
sudo ifdown ens18 && sudo ifup ens18
ip a show ens18                  # VERIFIER avant de fermer la session`),

  block('heading', { level: 3, text: '2. Voir la configuration réseau' }),
  sh(`ip a              # les adresses (ip address show)
ip -br a          # une ligne par interface : lisible d'un coup
ip r              # la table de routage : y a-t-il un « default via » ?
ip neigh          # la table ARP : qui repond sur le lien local
ss -tulpn         # les ports en ecoute, et qui les ecoute
cat /etc/resolv.conf   # les serveurs DNS
hostname -I       # juste les adresses, pour un script`),
  note('yellow', '⚠️ <code>ip a</code> ne suffit pas', '<p>Une machine peut avoir une adresse correcte et ne joindre personne, faute de <strong>route par défaut</strong>. <code>ip r</code> est la deuxième commande à taper, toujours — l’absence de ligne <code>default</code> explique la moitié des « je n’ai pas Internet ».</p>'),

  block('heading', { level: 3, text: '3. Redémarrer un service' }),
  sh(`sudo systemctl restart ssh      # arret puis demarrage
sudo systemctl reload ssh       # relire la conf SANS couper les connexions
systemctl status ssh            # verifier apres coup

# Anciennes formes, encore rencontrees :
sudo service ssh restart
sudo /etc/init.d/ssh restart`),
  note('blue', '💡 <code>reload</code> quand il existe', '<p>Sur un service en production, <code>restart</code> coupe les connexions en cours ; <code>reload</code> relit la configuration sans interruption. Tous ne le proposent pas — la commande échoue proprement si ce n’est pas prévu, ce qui est une bonne façon de le savoir.</p>'),

  block('heading', { level: 3, text: '4. Éteindre et redémarrer' }),
  table(['Action', 'Commande moderne', 'Anciennes formes'], [
    ['<strong>Éteindre</strong>', '<code>sudo systemctl poweroff</code>', '<code>sudo shutdown -h now</code> · <code>sudo halt -p</code> · <code>sudo poweroff</code>'],
    ['<strong>Redémarrer</strong>', '<code>sudo systemctl reboot</code>', '<code>sudo shutdown -r now</code> · <code>sudo reboot</code>'],
    ['<strong>Différer</strong>', '—', '<code>sudo shutdown -h +10 "maintenance"</code> — prévient les utilisateurs connectés'],
    ['<strong>Annuler</strong>', '—', '<code>sudo shutdown -c</code>'],
  ]),
  note('red', '🚫 <code>shutdown -h now</code> sur la mauvaise machine', '<p>En SSH, on administre souvent plusieurs serveurs dans plusieurs fenêtres. Avant un arrêt, un <code>hostname</code> coûte une seconde et évite d’éteindre la production depuis la fenêtre qu’on croyait être celle du serveur de test. C’est une erreur classique, et elle ne se rattrape pas à distance.</p>'),

  block('heading', { level: 3, text: '5. Une ligne de sources.list' }),
  flow(`deb  http://deb.debian.org/debian  bookworm  main contrib non-free
 │            │                        │         │
 │            │                        │         └─ SECTIONS (composants)
 │            │                        └─ DISTRIBUTION (nom de code)
 │            └─ URL du depot (le miroir)
 └─ TYPE : « deb » = paquets binaires
           « deb-src » = les codes sources`),
  table(['Composant', 'Ce qu’il vaut'], [
    ['<code>deb</code>', 'Paquets compilés, prêts à installer. <code>deb-src</code> désigne les sources — rarement utile, et on peut le laisser commenté.'],
    ['<code>http://deb.debian.org/debian</code>', 'Le miroir. <code>deb.debian.org</code> redirige vers le serveur le plus proche.'],
    ['<code>bookworm</code>', 'Le nom de code de la version. On peut écrire <code>stable</code>, mais alors la machine <strong>changera de version majeure</strong> à la prochaine sortie — rarement ce qu’on veut sur un serveur.'],
    ['<code>main</code>', 'Logiciels libres, supportés officiellement.'],
    ['<code>contrib</code>', 'Libres, mais dépendant de composants non libres.'],
    ['<code>non-free</code>', 'Non libres : surtout des pilotes et des micrologiciels.'],
  ]),
  sh(`# La ligne des correctifs de securite : celle qu'on ne retire jamais
deb http://security.debian.org/debian-security bookworm-security main

cat /etc/apt/sources.list          # les depots declares
ls /etc/apt/sources.list.d/        # ceux ajoutes par des logiciels tiers
apt policy nginx                   # d'ou viendrait ce paquet, et en quelle version`),
  note('yellow', '⚠️ <code>stable</code> ou le nom de code ?', '<p>Écrire <code>bookworm</code> fige la version : la machine reste sur Debian 12 et ne reçoit que ses correctifs. Écrire <code>stable</code> la fait <strong>basculer toute seule</strong> vers Debian 13 le jour de sa sortie — une montée de version majeure, non planifiée, un dimanche. Sur un serveur, on écrit le nom de code.</p>'),

  note('green', '🎓 Ce que le TP construit vraiment', '<p>Pas une liste de définitions : un <strong>réflexe de vérification</strong>. Chacune des cinq questions correspond à un geste que tu feras des centaines de fois — regarder une configuration réseau, redémarrer un service, comprendre d’où vient un paquet. Le glossaire n’a de valeur que s’il est écrit avec tes mots, et relu quand tu bloques.</p>'),

  note('blue', '🔗 Les cours qui couvrent ce TP', '<p><a href="/pages/linux-bases">Les bases</a> · <a href="/pages/linux-commandes-base">Commandes de base</a> · <a href="/pages/linux-paquets-essentiels">Les paquets essentiels</a> · <a href="/pages/linux-reseau">Configuration réseau</a> · <a href="/pages/linux-systemd">systemd : services et journaux</a> · <a href="/pages/linux-droits">Utilisateurs, droits et sudo</a></p>'),
];

publier(PAGE, blocks).catch(e => { console.error(e); process.exit(1); });

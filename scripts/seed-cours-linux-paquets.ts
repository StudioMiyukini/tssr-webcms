/* Page « Les paquets essentiels » — ce qu'on installe sur une Debian fraîche.
   Le TP décoche tout à l'installation : la machine obtenue est volontairement
   nue. Cette page dit ce qu'on y ajoute, pourquoi, et ce qu'on n'y met pas.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-linux-paquets.ts */
import { block, note, sh, flow, table, styleLinux, liens, publier } from './_cours-linux';
import type { PageBlock } from '../client/src/lib/page-blocks';

const PAGE = {
  slug: 'linux-paquets-essentiels',
  title: 'Les paquets essentiels',
  excerpt: 'Après une installation Debian où l’on a tout décoché, la machine est nue : ni sudo, ni SSH, ni tree, ni de quoi diagnostiquer. Voici ce qu’on ajoute et pourquoi — se repérer, réseau, diagnostic, transfert, scripts — avec la ligne unique qui installe l’ensemble, et ce qu’on n’installe surtout pas sur un serveur.',
};

const blocks: PageBlock[] = [
  block('hero', {
    eyebrow: 'Cours · Linux',
    title: PAGE.title,
    subtitle: 'Ce qu’on ajoute à une Debian fraîche — et ce qu’on n’y met pas.',
  }),
  styleLinux,

  block('html', { html: '<p>Le TP demande de <strong>tout décocher</strong> à la sélection des logiciels. C’est le bon réflexe pour un serveur : on part du minimum et on ajoute. Mais la machine obtenue est réellement nue — pas de <code>sudo</code>, pas de SSH, pas de <code>tree</code>, et rien pour diagnostiquer.</p><p>Cette page dit ce qu’on installe ensuite, et surtout <strong>pourquoi chacun</strong>. Un paquet qu’on ne sait pas justifier n’a rien à faire sur un serveur.</p>' }),

  note('yellow', '⚠️ Vérifier avant de conclure qu’il manque', '<div class="lx-cmd">dpkg -l | grep tree        # est-il deja installe ?\ndpkg -s tree              # son etat en detail\napt list --installed      # tout ce qui est en place</div>'),

  block('heading', { level: 2, text: '1) Le strict nécessaire, tout de suite' }),
  block('html', { html: '<p>Trois paquets, dans cet ordre, depuis la console de l’hyperviseur.</p>' }),
  sh(`su -                              # mot de passe de ROOT
apt update
apt install sudo openssh-server
usermod -aG sudo TON_IDENTIFIANT  # et se reconnecter ensuite !
systemctl enable --now ssh`),
  table(['Paquet', 'Pourquoi il passe en premier'], [
    ['<strong><code>sudo</code></strong>', 'Le TP donne un mot de passe à root, donc Debian n’installe pas <code>sudo</code> et ne met personne dans le groupe. Sans lui, tout se fait en <code>su -</code>.'],
    ['<strong><code>openssh-server</code></strong>', 'Tant qu’il manque, on travaille dans la console de l’hyperviseur : pas de copier-coller confortable, pas de plusieurs fenêtres, pas de transfert de fichiers.'],
  ]),

  block('heading', { level: 2, text: '2) Se repérer et lire' }),
  table(['Paquet', 'Ce qu’il apporte'], [
    ['<strong><code>tree</code></strong>', 'Affiche une arborescence en un coup d’œil, au lieu d’enchaîner les <code>ls</code>. <strong>Indispensable pour comprendre une structure de dossiers</strong> — et pour la montrer dans un compte rendu.'],
    ['<code>bash-completion</code>', 'La <strong>Tab</strong> complète aussi les <em>options</em> et les arguments : <code>systemctl re</code>+Tab, <code>apt inst</code>+Tab. Le confort le plus rentable de la liste.'],
    ['<code>less</code>', 'Naviguer dans un fichier long. Souvent déjà là, mais pas toujours après un décochage complet.'],
    ['<code>vim</code>', 'L’éditeur qu’on retrouve sur tous les serveurs, y compris ceux des autres. <code>nano</code> suffit pour débuter.'],
    ['<code>tmux</code>', 'Garder une session ouverte malgré une coupure SSH — et y revenir avec <code>tmux attach</code>. Ce qui sauve un traitement long.'],
  ]),
  sh(`apt install tree bash-completion less vim tmux

tree -L 2 /etc              # deux niveaux, pour ne pas tout deverser
tree -d /srv                # les dossiers seulement
tree -a -L 1 ~              # y compris les fichiers caches
tree -h /var/log            # avec la taille des fichiers`),
  note('green', '🎯 <code>tree</code> : les options qui servent vraiment', '<p><code>-L n</code> limite la profondeur — sans elle, <code>tree /</code> déverse des dizaines de milliers de lignes. <code>-d</code> ne montre que les dossiers, <code>-h</code> ajoute les tailles, <code>-a</code> inclut les fichiers cachés. La combinaison la plus utile au quotidien : <code>tree -L 2 -d</code>.</p>'),
  note('blue', '💡 <code>bash-completion</code> demande une reconnexion', '<p>Il s’active par un fichier chargé à l’ouverture de session. Après l’installation, on se déconnecte et on se reconnecte — sinon on conclut à tort qu’il ne fonctionne pas.</p>'),

  block('heading', { level: 2, text: '3) Réseau et diagnostic' }),
  table(['Paquet', 'Ce qu’il apporte', 'La commande'], [
    ['<code>dnsutils</code>', 'Interroger le DNS, et savoir <em>quel</em> serveur répond.', '<code>dig</code>, <code>nslookup</code>'],
    ['<code>curl</code>', 'Tester un service web, une API, un temps de réponse.', '<code>curl -I https://site</code>'],
    ['<code>wget</code>', 'Télécharger un fichier, reprendre un téléchargement coupé.', '<code>wget -c url</code>'],
    ['<code>netcat-openbsd</code>', 'Tester <strong>un port précis</strong> — un ping qui passe ne dit rien du service.', '<code>nc -zv srv 445</code>'],
    ['<code>traceroute</code>', 'Voir où le chemin s’arrête.', '<code>traceroute 1.1.1.1</code>'],
    ['<code>mtr-tiny</code>', 'Traceroute continu : révèle les pertes intermittentes qu’un traceroute unique manque.', '<code>mtr 1.1.1.1</code>'],
    ['<code>tcpdump</code>', 'Voir ce qui part vraiment sur le fil. L’arbitre des désaccords.', '<code>tcpdump -i eth0 port 53</code>'],
  ]),
  sh(`apt install dnsutils curl wget netcat-openbsd traceroute mtr-tiny tcpdump`),
  note('gray', '💡 <code>net-tools</code> : à connaître, pas à installer', '<p>C’est le paquet qui fournit <code>ifconfig</code>, <code>netstat</code> et <code>route</code>. Il n’est plus installé par défaut, et c’est volontaire : <code>ip</code> et <code>ss</code> les remplacent en donnant davantage. L’installer par habitude, c’est retarder l’apprentissage des commandes qu’on trouvera partout ailleurs.</p>'),

  block('heading', { level: 2, text: '4) Surveiller la machine' }),
  table(['Paquet', 'Ce qu’il montre'], [
    ['<code>htop</code>', 'Processus, CPU et mémoire, en couleurs et à la souris. Le <code>top</code> qu’on garde.'],
    ['<code>ncdu</code>', '<strong>Où passe la place disque</strong>, en navigation interactive. Trouve en trente secondes ce qu’un <code>du</code> cherche en dix minutes.'],
    ['<code>lsof</code>', 'Quel processus tient un fichier ou un port. La réponse à « périphérique occupé ».'],
    ['<code>sysstat</code>', '<code>iostat</code>, <code>sar</code> : l’historique des performances, utile quand la panne est passée.'],
    ['<code>smartmontools</code>', 'La santé réelle des disques — secteurs réalloués, heures de fonctionnement.'],
  ]),
  sh(`apt install htop ncdu lsof sysstat smartmontools

ncdu /var                   # naviguer dans ce qui prend de la place
lsof +L1                    # fichiers supprimes mais encore ouverts
smartctl -H /dev/sda        # le disque est-il en train de mourir ?`),

  block('heading', { level: 2, text: '5) Transférer et scripter' }),
  table(['Paquet', 'Ce qu’il apporte'], [
    ['<code>rsync</code>', 'Copier en ne transférant que les différences, en préservant droits et ACL. La base de toute sauvegarde.'],
    ['<code>cifs-utils</code>', 'Monter un partage Windows/SMB — le pont vers l’infrastructure Microsoft.'],
    ['<code>unzip</code>', 'Ouvrir une archive <code>.zip</code> : <code>tar</code> ne le fait pas.'],
    ['<code>git</code>', 'Versionner ses scripts et ses configurations. Un script sur le bureau d’un serveur n’a pas d’historique.'],
    ['<strong><code>shellcheck</code></strong>', 'Analyse les scripts Bash : variables non protégées, comparaisons douteuses. Il trouve dans le premier script des fautes qu’on aurait découvertes en production.'],
    ['<code>apt-file</code>', 'Répond à « command not found » : <strong>quel paquet fournit cette commande ?</strong>'],
  ]),
  sh(`apt install rsync cifs-utils unzip git shellcheck apt-file
apt-file update

apt-file search bin/dig      # quel paquet fournit dig ?
dpkg -S /usr/bin/tree        # l'inverse : a quel paquet appartient ce fichier ?`),

  block('heading', { level: 2, text: '6) La ligne unique' }),
  block('html', { html: '<p>Pour une machine de formation, tout d’un coup :</p>' }),
  sh(`sudo apt update && sudo apt install -y \\
  tree bash-completion vim tmux \\
  dnsutils curl wget netcat-openbsd traceroute mtr-tiny tcpdump \\
  htop ncdu lsof sysstat smartmontools \\
  rsync cifs-utils unzip git shellcheck apt-file

sudo apt-file update`),
  note('yellow', '⚠️ Sur un serveur de production, on ne colle pas cette ligne', '<p>Chaque paquet ajoute du code à maintenir, à corriger et à surveiller. <code>tcpdump</code> et <code>nmap</code> sur une machine exposée sont aussi des outils <strong>pour l’attaquant</strong> une fois qu’il est entré. En production, on installe ce dont on a besoin, quand on en a besoin — et l’on retire ensuite les outils d’analyse.</p>'),

  block('heading', { level: 2, text: '7) Vérifier et faire le ménage' }),
  sh(`apt list --installed | wc -l      # combien de paquets sur cette machine
apt list --upgradable            # ce qui attend une mise a jour
sudo apt autoremove              # les dependances devenues inutiles
sudo apt clean                   # vider le cache des .deb telecharges

dpkg -L tree                     # ce qu'un paquet a installe, fichier par fichier
apt show tree                    # description, taille, dependances`),
  note('green', '🎯 La question à se poser pour chaque paquet', '<p><strong>« Qu’est-ce que je ne pourrais pas faire sans lui ? »</strong> Si la réponse ne vient pas, il n’a rien à faire là. C’est ce qui distingue un serveur tenu d’un serveur qui accumule — et c’est exactement le raisonnement attendu en <a href="/pages/linux-systemd">exploitation</a>.</p>'),

  liens('/pages/linux-paquets-essentiels'),
];

publier(PAGE, blocks).catch(e => { console.error(e); process.exit(1); });

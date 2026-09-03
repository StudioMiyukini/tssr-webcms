// Aide-mémoire des commandes Linux — données.
//
// L'inventaire des GPO règle un problème de localisation : on connaît le nom du
// paramètre, jamais son emplacement. Ici c'est l'inverse — on sait parfaitement
// ce qu'on veut faire, et on ignore le nom de la commande. « Comment je trouve
// les gros fichiers ? » ne se cherche pas dans un index alphabétique.
//
// Chaque entrée est donc indexée par sa **tâche**, écrite comme on la formule :
// « voir qui écoute sur un port », pas « ss ». Les alias couvrent le reste,
// y compris les commandes obsolètes qu'on tape par habitude (ifconfig, netstat)
// et les noms Windows, parce qu'un TSSR arrive presque toujours de ce côté-là.
//
// Le champ `piege` n'est rempli que lorsqu'il y a réellement quelque chose à
// dire. Une note sur chaque ligne ne serait plus lue.

/*
 * @id     tssr.atelier.linuxData
 * @do     definir_donnees_linux
 * @role   donnee
 * @layer  outil
 * @human  Données de l'atelier : commandes Linux classées par catégorie.
 */
export interface LinuxCategorie {
  key: string;
  label: string;
  icon: string;
}

export interface LinuxEntry {
  /** Ce qu'on veut faire, formulé comme on le formule. C'est la clé d'entrée. */
  tache: string;
  /** La commande, prête à adapter. */
  commande: string;
  categorie: string;
  /** Ce qu'elle fait, et pourquoi celle-ci plutôt qu'une autre. */
  quoi: string;
  /** Les options qu'on utilise vraiment. */
  options?: [string, string][];
  /** Variantes ou compléments, dans le même esprit. */
  aussi?: string[];
  /** L'erreur classique. Absent quand il n'y en a pas de notable. */
  piege?: string;
  /** L'équivalent Windows, quand il existe et éclaire. */
  windows?: string;
  /** Mots qu'on tape vraiment, y compris les commandes obsolètes. */
  alias?: string[];
  /** Demande les droits root. */
  root?: boolean;
}

export const LINUX_CATEGORIES: LinuxCategorie[] = [
  { key: 'fichiers', label: 'Fichiers & dossiers', icon: '📁' },
  { key: 'recherche', label: 'Chercher', icon: '🔍' },
  { key: 'texte', label: 'Traiter du texte', icon: '📝' },
  { key: 'droits', label: 'Droits & comptes', icon: '🔐' },
  { key: 'processus', label: 'Processus', icon: '⚙️' },
  { key: 'services', label: 'Services & journaux', icon: '🔧' },
  { key: 'reseau', label: 'Réseau', icon: '🌐' },
  { key: 'disques', label: 'Disques & espace', icon: '💾' },
  { key: 'paquets', label: 'Paquets', icon: '📦' },
  { key: 'archives', label: 'Archives & copie', icon: '🗜️' },
  { key: 'systeme', label: 'Système', icon: '🖥️' },
];

export const LINUX_ENTRIES: LinuxEntry[] = [
  // ── Fichiers & dossiers ────────────────────────────────────────────────
  {
    tache: 'Lister les fichiers avec leurs droits et leur taille',
    commande: 'ls -lh',
    categorie: 'fichiers',
    quoi: 'Le format long : type, droits, propriétaire, groupe, taille et date.',
    options: [['-a', 'y compris les fichiers cachés (commençant par un point)'], ['-h', 'tailles lisibles : 4,0K au lieu de 4096'], ['-t', 'les plus récents en premier'], ['-S', 'les plus gros en premier'], ['-R', 'récursif']],
    aussi: ['ls -lhat   # cachés + lisible + par date, la combinaison la plus utile'],
    windows: 'dir',
    alias: ['dir', 'lister', 'contenu dossier'],
  },
  {
    tache: 'Voir où je suis et me déplacer',
    commande: 'pwd ; cd /var/log ; cd -',
    categorie: 'fichiers',
    quoi: '`pwd` affiche le dossier courant. `cd -` revient au précédent, `cd` seul revient à la maison.',
    aussi: ['cd ..     # le dossier parent', 'cd ~jean  # la maison de jean'],
    alias: ['ou je suis', 'se deplacer', 'changer de dossier', 'chdir'],
  },
  {
    tache: 'Créer une arborescence de dossiers d’un coup',
    commande: 'mkdir -p /srv/appli/{conf,data,logs}',
    categorie: 'fichiers',
    quoi: '`-p` crée les parents manquants ; les accolades produisent plusieurs dossiers en une fois.',
    piege: 'Sans `-p`, `mkdir /srv/appli/conf` échoue si `/srv/appli` n’existe pas encore.',
    alias: ['creer dossier', 'md', 'repertoire'],
  },
  {
    tache: 'Copier un dossier en gardant droits et dates',
    commande: 'cp -a /srv/site /srv/site.bak',
    categorie: 'fichiers',
    quoi: '`-a` (archive) préserve droits, propriétaires, dates et liens symboliques.',
    piege: 'Un `cp -r` simple perd les droits et les dates, et convertit les liens en copies. Sur des données serveur, c’est presque toujours une erreur.',
    windows: 'robocopy /E /COPYALL',
    alias: ['copier', 'copy', 'dupliquer'],
  },
  {
    tache: 'Voir la taille d’un dossier',
    commande: 'du -sh /var/log',
    categorie: 'disques',
    quoi: '`-s` totalise au lieu de détailler, `-h` rend lisible.',
    aussi: ['du -sh /var/* | sort -h   # classe les sous-dossiers du plus petit au plus gros', 'ncdu /var                 # navigation interactive (paquet ncdu)'],
    piege: '`du` additionne ce qu’il parcourt, `df` interroge le système de fichiers : ils divergent quand un montage masque un dossier, ou quand un fichier supprimé reste ouvert.',
    alias: ['taille dossier', 'poids', 'occupation'],
  },
  {
    tache: 'Créer un lien symbolique',
    commande: 'ln -s /srv/appli/current /opt/appli',
    categorie: 'fichiers',
    quoi: 'Un raccourci vers un autre chemin. La cible se met à jour sans toucher au lien.',
    piege: 'L’ordre est `ln -s cible lien`, dans cet ordre-là. Inversé, on crée un lien à l’endroit de la cible.',
    windows: 'mklink',
    alias: ['lien', 'raccourci', 'symlink'],
  },

  // ── Chercher ───────────────────────────────────────────────────────────
  {
    tache: 'Trouver un fichier par son nom',
    commande: "find /etc -name '*.conf'",
    categorie: 'recherche',
    quoi: 'Parcourt réellement l’arborescence : toujours à jour, mais lent sur un gros disque.',
    options: [['-iname', 'insensible à la casse'], ['-type f', 'fichiers seulement (`d` pour les dossiers)'], ['-maxdepth 2', 'limite la profondeur'], ['-user jean', 'appartenant à jean']],
    aussi: ['locate fichier.conf   # instantané, mais lit un index (updatedb) parfois périmé'],
    piege: 'Sans guillemets autour de `*.conf`, le shell le remplace par les fichiers du dossier courant avant même que find ne le voie.',
    windows: 'dir /s /b *.conf',
    alias: ['chercher fichier', 'localiser', 'where', 'trouver'],
  },
  {
    tache: 'Trouver les fichiers qui prennent toute la place',
    commande: "find / -type f -size +500M -exec ls -lh {} \\; 2>/dev/null",
    categorie: 'recherche',
    quoi: 'Les fichiers de plus de 500 Mo, avec leur taille. `2>/dev/null` masque les dossiers interdits.',
    aussi: ['du -ah /var | sort -rh | head -20   # le top 20, dossiers compris'],
    piege: 'Cherche d’abord dans `/var` et `/home` : c’est là que ça déborde. Un `find /` complet prend plusieurs minutes et charge le disque.',
    alias: ['gros fichiers', 'disque plein', 'espace', 'volumineux'],
  },
  {
    tache: 'Trouver les fichiers modifiés récemment',
    commande: 'find /etc -mtime -2 -type f',
    categorie: 'recherche',
    quoi: 'Modifiés il y a moins de 2 jours. Sert à retrouver ce qu’on a changé — ou ce qui a changé tout seul.',
    aussi: ['find /etc -mmin -60    # dans la dernière heure'],
    alias: ['modifie recemment', 'qui a change', 'date'],
  },
  {
    tache: 'Chercher un texte dans des fichiers',
    commande: "grep -rn 'ServerName' /etc/apache2/",
    categorie: 'recherche',
    quoi: '`-r` descend dans les sous-dossiers, `-n` donne le numéro de ligne — indispensable pour aller éditer.',
    options: [['-i', 'insensible à la casse'], ['-v', 'les lignes qui NE contiennent PAS'], ['-l', 'seulement les noms de fichiers'], ['-c', 'compter les occurrences'], ['-A 3 -B 3', 'afficher 3 lignes autour']],
    windows: 'findstr /s /n',
    alias: ['chercher texte', 'findstr', 'contenu', 'occurrence'],
  },
  {
    tache: 'Voir la configuration sans les commentaires ni les lignes vides',
    commande: "grep -vE '^\\s*(#|$)' /etc/ssh/sshd_config",
    categorie: 'recherche',
    quoi: 'Un fichier de configuration de 400 lignes se réduit souvent à 12 lignes actives. C’est celles-là qu’on veut voir.',
    aussi: ["grep -vE '^\\s*(#|;|$)' fichier   # aussi pour les .ini"],
    alias: ['sans commentaires', 'conf active', 'nettoyer affichage'],
  },
  {
    tache: 'Savoir où se trouve une commande',
    commande: 'which systemctl ; type -a ls',
    categorie: 'recherche',
    quoi: '`which` donne le chemin, `type -a` révèle en plus les alias et les fonctions du shell.',
    piege: 'Un `ls` coloré vient souvent d’un alias, pas du binaire. `type` le dit, `which` non.',
    alias: ['ou est la commande', 'chemin binaire', 'where'],
  },

  // ── Traiter du texte ───────────────────────────────────────────────────
  {
    tache: 'Suivre un fichier de log en direct',
    commande: 'tail -f /var/log/syslog',
    categorie: 'texte',
    quoi: 'Affiche la fin et reste à l’écoute. On lance ça, puis on reproduit la panne dans une autre fenêtre.',
    aussi: ['tail -n 100 fichier      # les 100 dernières lignes', 'tail -f fichier | grep -i erreur'],
    piege: 'Sur un fichier qui tourne (logrotate), `tail -f` suit l’ancien inode et se fige. `tail -F` rouvre le fichier — c’est celui à prendre.',
    alias: ['suivre log', 'temps reel', 'derniere lignes'],
  },
  {
    tache: 'Remplacer du texte dans un fichier',
    commande: "sed -i 's/ancien/nouveau/g' fichier.conf",
    categorie: 'texte',
    quoi: '`-i` modifie sur place, `g` remplace toutes les occurrences de chaque ligne.',
    piege: 'Toujours essayer SANS `-i` d’abord : la sortie montre le résultat sans rien modifier. Avec `-i` et une expression fausse, le fichier est perdu. `sed -i.bak` garde une copie.',
    alias: ['remplacer', 'substituer', 'replace', 'modifier texte'],
  },
  {
    tache: 'Extraire une colonne',
    commande: "awk '{print $1, $5}' /var/log/nginx/access.log",
    categorie: 'texte',
    quoi: 'Découpe chaque ligne en champs et affiche ceux qu’on veut. `$0` est la ligne entière.',
    aussi: ["cut -d: -f1 /etc/passwd        # plus simple quand le séparateur est fixe", "awk -F: '{print $1}' /etc/passwd"],
    alias: ['colonne', 'champ', 'decouper', 'cut'],
  },
  {
    tache: 'Compter et classer les occurrences',
    commande: "awk '{print $1}' access.log | sort | uniq -c | sort -rn | head",
    categorie: 'texte',
    quoi: 'Le motif le plus utile de l’analyse de logs : quelles adresses reviennent le plus. `uniq -c` compte, `sort -rn` classe décroissant.',
    piege: '`uniq` ne compare que des lignes **adjacentes** : sans `sort` avant, il ne dédoublonne rien.',
    alias: ['compter', 'top', 'statistiques log', 'classement'],
  },
  {
    tache: 'Comparer deux fichiers',
    commande: 'diff -u avant.conf apres.conf',
    categorie: 'texte',
    quoi: 'Affiche les différences ligne à ligne, format unifié.',
    aussi: ['diff -r dossier1/ dossier2/   # récursif', 'md5sum fichier1 fichier2      # identiques ou non, sans le détail'],
    windows: 'fc',
    alias: ['comparer', 'difference', 'fc'],
  },

  // ── Droits & comptes ───────────────────────────────────────────────────
  {
    tache: 'Changer les droits d’un fichier',
    commande: 'chmod 640 fichier.conf',
    categorie: 'droits',
    quoi: 'r=4, w=2, x=1, additionnés pour propriétaire / groupe / autres.',
    aussi: ['chmod -R u+rwX,go-w /srv/site   # X majuscule : x seulement sur les dossiers', 'chmod g+w fichier'],
    piege: '`chmod -R +x` rend exécutables les images et les textes. `+X` majuscule ne touche que les dossiers.',
    alias: ['droits', 'permissions', 'icacls', 'chmod'],
  },
  {
    tache: 'Changer le propriétaire',
    commande: 'chown -R www-data:www-data /var/www/site',
    categorie: 'droits',
    quoi: 'Propriétaire et groupe. `chown jean:` seul prend le groupe primaire de jean.',
    root: true,
    windows: 'takeown / icacls /setowner',
    alias: ['proprietaire', 'owner', 'chown', 'appartenance'],
  },
  {
    tache: 'Comprendre pourquoi j’ai « Permission denied »',
    commande: 'namei -l /srv/compta/budgets/2026.ods',
    categorie: 'droits',
    quoi: 'Affiche les droits de CHAQUE niveau du chemin. Le refus vient presque toujours d’un dossier parent sans `x`, pas du fichier visé.',
    aussi: ['sudo -u jean -s     # essayer en tant que lui plutôt que deviner', 'getfacl /srv/compta  # les ACL, et leur masque'],
    alias: ['permission denied', 'acces refuse', 'droits refuses'],
  },
  {
    tache: 'Ajouter un utilisateur à un groupe',
    commande: 'usermod -aG sudo jean',
    categorie: 'droits',
    quoi: '`-a` ajoute au lieu de remplacer, `-G` vise les groupes secondaires.',
    root: true,
    piege: 'Sans le `-a`, tous les autres groupes secondaires de l’utilisateur sont REMPLACÉS par celui-ci. C’est irréversible sans sauvegarde de `/etc/group`.',
    aussi: ['id jean       # vérifier après coup'],
    alias: ['groupe', 'ajouter groupe', 'sudo', 'droits admin'],
  },
  {
    tache: 'Savoir ce que j’ai le droit de faire en sudo',
    commande: 'sudo -l',
    categorie: 'droits',
    quoi: 'Liste les commandes autorisées pour le compte courant, telles que sudoers les définit.',
    alias: ['sudo', 'delegation', 'que puis-je faire'],
  },

  // ── Processus ──────────────────────────────────────────────────────────
  {
    tache: 'Voir ce qui consomme le processeur ou la mémoire',
    commande: 'top',
    categorie: 'processus',
    quoi: 'Vue temps réel. Dans top : `M` classe par mémoire, `P` par CPU, `k` tue un processus, `q` quitte.',
    aussi: ['htop                        # plus lisible, souris et couleurs (paquet htop)', 'ps aux --sort=-%mem | head  # le top mémoire, en une ligne'],
    windows: 'Gestionnaire des tâches',
    alias: ['top', 'cpu', 'memoire', 'ram', 'ralenti', 'lent'],
  },
  {
    tache: 'Trouver le processus qui utilise un fichier ou un dossier',
    commande: 'sudo lsof /srv/donnees',
    categorie: 'processus',
    quoi: 'Répond à « le périphérique est occupé » quand un démontage échoue.',
    root: true,
    aussi: ['sudo fuser -v /srv/donnees', 'sudo lsof +L1   # fichiers supprimés mais encore ouverts : l’espace non rendu'],
    alias: ['device is busy', 'occupe', 'demontage impossible', 'fichier ouvert'],
  },
  {
    tache: 'Arrêter un processus',
    commande: 'kill 1234',
    categorie: 'processus',
    quoi: 'Envoie TERM : demande poliment au processus de s’arrêter et de nettoyer.',
    aussi: ['pkill -f collecte.sh   # par motif de ligne de commande', 'kill -9 1234           # SIGKILL : le noyau le tue, sans nettoyage'],
    piege: '`kill -9` en premier réflexe laisse des fichiers de verrou et des données non écrites. On essaie TERM, on attend, et on n’escalade qu’ensuite.',
    windows: 'taskkill',
    alias: ['tuer', 'arreter processus', 'kill', 'taskkill'],
  },
  {
    tache: 'Lancer une commande qui survit à la fermeture de la session',
    commande: 'nohup ./long-traitement.sh > sortie.log 2>&1 &',
    categorie: 'processus',
    quoi: 'Détache le processus du terminal. Le `&` le met en arrière-plan, la redirection garde la sortie.',
    aussi: ['tmux new -s travail   # mieux : une session qu’on retrouve avec `tmux attach`'],
    piege: 'Sans redirection, la sortie va dans `nohup.out` du dossier courant — et on la cherche.',
    alias: ['arriere plan', 'background', 'nohup', 'session ssh coupee'],
  },

  // ── Services & journaux ────────────────────────────────────────────────
  {
    tache: 'Démarrer, arrêter, activer un service',
    commande: 'systemctl enable --now apache2',
    categorie: 'services',
    quoi: '`enable` planifie au démarrage, `start` lance maintenant, `--now` fait les deux.',
    root: true,
    options: [['status', 'état + PID + dernières lignes de journal'], ['restart', 'arrêt puis démarrage'], ['reload', 'relit la conf sans couper les connexions'], ['disable', 'ne démarrera plus au boot']],
    piege: '`start` sans `enable` : le service fonctionne parfaitement et disparaît au redémarrage. C’est l’erreur classique du TP.',
    windows: 'services.msc / sc config',
    alias: ['service', 'demarrer', 'redemarrer', 'daemon', 'sc'],
  },
  {
    tache: 'Voir pourquoi un service ne démarre pas',
    commande: 'journalctl -xeu apache2',
    categorie: 'services',
    quoi: '`-u` filtre sur l’unité, `-e` saute à la fin, `-x` ajoute les explications de systemd.',
    aussi: ['systemctl status apache2 -l --no-pager', 'journalctl -u apache2 -f       # en direct', 'journalctl -p err -b           # les erreurs depuis le démarrage'],
    windows: 'Observateur d’événements',
    alias: ['log service', 'ne demarre pas', 'journal', 'erreur service'],
  },
  {
    tache: 'Lister ce qui est en échec',
    commande: 'systemctl --failed',
    categorie: 'services',
    quoi: 'La première commande à taper sur un serveur qui se comporte mal. Courte, et souvent suffisante.',
    aussi: ['systemctl list-units --type=service --state=running'],
    alias: ['failed', 'en panne', 'echec', 'probleme serveur'],
  },
  {
    tache: 'Voir les journaux d’un moment précis',
    commande: "journalctl --since '2026-08-21 09:00' --until '2026-08-21 10:00'",
    categorie: 'services',
    quoi: 'Cible la fenêtre de l’incident au lieu de faire défiler.',
    aussi: ["journalctl --since '1 hour ago'", 'journalctl -b -1     # le démarrage précédent : utile après un plantage'],
    alias: ['journal heure', 'incident', 'hier', 'historique'],
  },

  // ── Réseau ─────────────────────────────────────────────────────────────
  {
    tache: 'Voir mon adresse IP',
    commande: 'ip -br a',
    categorie: 'reseau',
    quoi: 'Une ligne par interface : nom, état, adresse. La version lisible de `ip a`.',
    aussi: ['ip a          # complet', 'ip r          # la table de routage, et le "default via"'],
    piege: '`ifconfig` n’est plus installé par défaut (paquet net-tools). Prendre l’habitude de `ip` évite de l’installer sur chaque serveur.',
    windows: 'ipconfig',
    alias: ['ifconfig', 'ipconfig', 'adresse ip', 'mon ip'],
  },
  {
    tache: 'Voir qui écoute sur quel port',
    commande: 'sudo ss -tulpn',
    categorie: 'reseau',
    quoi: '`t` TCP, `u` UDP, `l` en écoute, `p` le processus, `n` sans résolution de noms.',
    root: true,
    piege: 'Sans `sudo`, la colonne du processus reste vide : le noyau ne dit pas à un simple utilisateur qui écoute.',
    windows: 'netstat -abno',
    alias: ['netstat', 'port', 'ecoute', 'listen', 'qui utilise le port'],
  },
  {
    tache: 'Tester si un port distant est joignable',
    commande: 'nc -zv srv.miyukini.lan 445',
    categorie: 'reseau',
    quoi: 'Teste le port précis, pas seulement la machine. Un ping qui passe ne dit rien du service.',
    aussi: ['curl -I https://site.fr        # teste la couche HTTP', 'telnet srv 25                 # historique, encore utile'],
    alias: ['port ouvert', 'telnet', 'tester port', 'connexion refusee'],
  },
  {
    tache: 'Diagnostiquer une panne réseau',
    commande: 'ping -c3 1.1.1.1 && ping -c3 cisco.com',
    categorie: 'reseau',
    quoi: 'Le test qui partage le problème en deux : si l’adresse répond et pas le nom, c’est le DNS. Si aucun ne répond, c’est la route ou la passerelle.',
    aussi: ['ip r                 # y a-t-il une route par défaut ?', 'traceroute 1.1.1.1   # où ça s’arrête', 'mtr 1.1.1.1          # traceroute continu, voit les pertes'],
    alias: ['pas internet', 'panne reseau', 'diagnostic', 'ne repond pas'],
  },
  {
    tache: 'Résoudre un nom DNS',
    commande: 'dig srv.miyukini.lan',
    categorie: 'reseau',
    quoi: 'Interroge le DNS et montre la réponse complète.',
    aussi: ['dig @192.168.10.11 srv.miyukini.lan   # interroger un serveur précis', 'dig -x 192.168.10.11                  # résolution inverse', 'resolvectl status                     # les serveurs réellement utilisés'],
    piege: 'Une entrée dans `/etc/hosts` court-circuite le DNS sans rien dire. `dig` l’ignore, `ping` non : les deux peuvent donc se contredire.',
    windows: 'nslookup',
    alias: ['dns', 'nslookup', 'resolution', 'nom ne resout pas'],
  },
  {
    tache: 'Ouvrir un port dans le pare-feu',
    commande: 'sudo ufw allow 443/tcp',
    categorie: 'reseau',
    quoi: 'UFW est la façade lisible de nftables sur Debian et Ubuntu.',
    root: true,
    aussi: ['sudo ufw status numbered', 'sudo ufw allow from 192.168.10.0/24 to any port 3306', 'sudo ufw limit 22/tcp   # freine le bourrage de mots de passe'],
    piege: 'Autoriser SSH AVANT `ufw enable`. Dans l’autre ordre, la session tombe et la commande suivante n’arrive jamais.',
    alias: ['firewall', 'pare-feu', 'ouvrir port', 'ufw', 'bloquer'],
  },
  {
    tache: 'Copier un fichier vers un serveur distant',
    commande: 'scp fichier.tar.gz jean@srv:/srv/depot/',
    categorie: 'reseau',
    quoi: 'Copie par SSH. Simple, suffisant pour un fichier.',
    aussi: ['rsync -avz --progress /srv/site/ jean@srv:/srv/site/   # mieux pour un dossier : reprend et ne recopie que les différences'],
    piege: 'La barre finale compte : `rsync /src/` copie le CONTENU, `rsync /src` copie le DOSSIER dans la destination.',
    alias: ['copier distant', 'transferer', 'scp', 'rsync', 'envoyer fichier'],
  },

  // ── Disques & espace ───────────────────────────────────────────────────
  {
    tache: 'Voir l’espace libre — combien de place reste-t-il',
    commande: 'df -h',
    categorie: 'disques',
    quoi: 'Par système de fichiers monté, en unités lisibles.',
    aussi: ['df -i    # les inodes : l’autre façon d’être plein', 'lsblk -f # disques, partitions, montages et UUID'],
    piege: 'Plein alors que `df -h` montre de la place : regarder `df -i` (inodes épuisés) et `lsof +L1` (fichier supprimé mais encore ouvert, espace non rendu).',
    windows: 'Gestion des disques',
    alias: ['espace disque', 'plein', 'place libre', 'full'],
  },
  {
    tache: 'Monter un partage Windows',
    commande: "sudo mount -t cifs //srv-win/partage /mnt/win -o credentials=/etc/cifs.cred,uid=1000",
    categorie: 'disques',
    quoi: 'Monte un partage SMB. Le fichier d’identifiants évite le mot de passe dans l’historique.',
    root: true,
    aussi: ['# /etc/cifs.cred, en chmod 600 :', 'username=jean', 'password=...', 'domain=MIYUKINI'],
    piege: 'Ajouter `nofail` dans `/etc/fstab` : sans elle, un serveur SMB éteint empêche la machine de démarrer.',
    alias: ['smb', 'cifs', 'partage windows', 'monter partage'],
  },
  {
    tache: 'Agrandir un volume LVM',
    commande: 'sudo lvextend -r -L +50G /dev/vg0/donnees',
    categorie: 'disques',
    quoi: '`-r` agrandit le système de fichiers en même temps que le volume — c’est le raccourci à retenir.',
    root: true,
    piege: 'Sans `-r`, `lvs` affiche la nouvelle taille et `df` l’ancienne : le système de fichiers ignore l’espace ajouté. Il manque `resize2fs` (ext4) ou `xfs_growfs` (xfs).',
    alias: ['lvm', 'agrandir', 'etendre volume', 'ajouter disque'],
  },

  // ── Paquets ────────────────────────────────────────────────────────────
  {
    tache: 'Installer un paquet',
    commande: 'sudo apt update && sudo apt install -y htop',
    categorie: 'paquets',
    quoi: '`update` rafraîchit la liste des paquets disponibles, `install` installe.',
    root: true,
    piege: '`apt install` sans `apt update` préalable échoue souvent sur une machine restée éteinte : les URL du cache local ne correspondent plus aux versions du dépôt.',
    windows: 'winget install',
    alias: ['installer', 'apt', 'paquet', 'logiciel'],
  },
  {
    tache: 'Trouver quel paquet fournit une commande',
    commande: 'apt-file search bin/dig',
    categorie: 'paquets',
    quoi: 'Répond à « command not found » : quel paquet installer. Demande `apt install apt-file && apt-file update`.',
    aussi: ['dpkg -S /usr/bin/dig    # l’inverse : à quel paquet appartient ce fichier déjà installé', 'dpkg -L dnsutils        # ce qu’un paquet a installé'],
    alias: ['command not found', 'quel paquet', 'manquant'],
  },
  {
    tache: 'Mettre à jour le système',
    commande: 'sudo apt update && sudo apt full-upgrade',
    categorie: 'paquets',
    quoi: '`full-upgrade` accepte de retirer un paquet quand une dépendance l’exige ; `upgrade` s’en abstient et bloque parfois.',
    root: true,
    aussi: ['sudo apt autoremove    # les dépendances devenues inutiles', 'apt list --upgradable  # voir avant de faire'],
    alias: ['mise a jour', 'update', 'upgrade', 'patch'],
  },

  // ── Archives & copie ───────────────────────────────────────────────────
  {
    tache: 'Créer une archive compressée',
    commande: 'tar -czvf sauvegarde.tar.gz /srv/site',
    categorie: 'archives',
    quoi: '`c` créer, `z` gzip, `v` verbeux, `f` fichier. L’ordre des lettres est libre, `f` doit précéder le nom.',
    aussi: ['tar -xzvf archive.tar.gz -C /srv/restore   # extraire vers un dossier', 'tar -tzvf archive.tar.gz                   # LISTER sans extraire'],
    piege: 'Les ACL et les attributs étendus ne sont pas conservés par défaut : `--acls --xattrs`. Une restauration « complète » où plus personne n’a accès vient de là.',
    windows: 'Compresser / wbadmin',
    alias: ['tar', 'archive', 'compresser', 'zip', 'sauvegarde'],
  },
  {
    tache: 'Synchroniser un dossier vers une sauvegarde',
    commande: 'rsync -aAX --delete /srv/site/ /mnt/backup/site/',
    categorie: 'archives',
    quoi: '`-a` préserve tout, `-A` les ACL, `-X` les attributs étendus, `--delete` reflète les suppressions.',
    piege: 'Essayer d’abord avec `-n` (`--dry-run`) : `--delete` sur une source vide efface toute la destination. C’est la commande qui détruit une sauvegarde en une seconde.',
    aussi: ['rsync -aAX --delete -n /srv/site/ /mnt/backup/site/   # simulation'],
    alias: ['rsync', 'synchroniser', 'sauvegarde', 'miroir', 'backup'],
  },

  // ── Système ────────────────────────────────────────────────────────────
  {
    tache: 'Savoir quelle distribution et quel noyau',
    commande: 'cat /etc/os-release ; uname -r',
    categorie: 'systeme',
    quoi: 'La première question de tout dépannage : sur quoi suis-je en train de travailler.',
    aussi: ['hostnamectl    # nom, distribution, noyau et virtualisation en une fois'],
    windows: 'winver / systeminfo',
    alias: ['version', 'distribution', 'noyau', 'quel systeme'],
  },
  {
    tache: 'Voir les messages du noyau',
    commande: 'sudo dmesg -T | tail -40',
    categorie: 'systeme',
    quoi: '`-T` met des dates lisibles. C’est là que le matériel parle : disque en erreur, USB, mémoire.',
    root: true,
    alias: ['dmesg', 'noyau', 'materiel', 'erreur disque'],
  },
  {
    tache: 'Voir depuis quand la machine tourne, et sa charge',
    commande: 'uptime',
    categorie: 'systeme',
    quoi: 'Durée depuis le démarrage et charge moyenne sur 1, 5 et 15 minutes.',
    piege: 'La charge n’est pas un pourcentage : 4,00 sur 4 cœurs signifie « pleinement occupé », pas « 4 % ». À comparer au nombre de cœurs (`nproc`).',
    alias: ['charge', 'load', 'uptime', 'depuis quand'],
  },
  {
    tache: 'Planifier une tâche',
    commande: 'crontab -e',
    categorie: 'systeme',
    quoi: 'Édite les tâches de l’utilisateur courant. Format : `min heure jour mois jour-semaine commande`.',
    aussi: ['crontab -l                 # lister', 'sudo crontab -u root -e    # celles de root', '# 30 2 * * *  /usr/local/bin/sauvegarde.sh'],
    piege: 'Le PATH de cron est minimal : on écrit les chemins ABSOLUS. Et le `%` a un sens particulier — il faut l’échapper (`\\%`), notamment dans un `date +%F`.',
    windows: 'Planificateur de tâches',
    alias: ['cron', 'planifier', 'tache', 'automatiser', 'schtasks'],
  },
  {
    tache: 'Réafficher et réutiliser une commande passée',
    commande: 'history | grep rsync',
    categorie: 'systeme',
    quoi: 'Retrouve ce qu’on a tapé la semaine dernière. `!1234` rejoue la commande n° 1234.',
    aussi: ['Ctrl-R puis le début de la commande   # recherche interactive, la plus rapide', '!!        # la commande précédente', 'sudo !!   # la relancer en sudo, après un "Permission denied"'],
    alias: ['historique', 'history', 'commande precedente', 'refaire'],
  },
];

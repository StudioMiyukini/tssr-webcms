/* Page « Commandes de base Linux / Bash » — la fiche qu'on garde ouverte.
   Distincte de l'aide-mémoire cherchable (/pages/outils-linux) : celle-ci se
   lit dans l'ordre, se parcourt des yeux et s'imprime. L'outil sert quand on
   cherche une commande précise ; cette page sert quand on apprend.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-linux-commandes.ts */
import { block, note, sh, flow, table, styleLinux, liens, publier } from './_cours-linux';
import type { PageBlock } from '../client/src/lib/page-blocks';

const PAGE = {
  slug: 'linux-commandes-base',
  title: 'Commandes de base Linux / Bash',
  excerpt: 'La fiche à garder ouverte pendant les premières semaines : se repérer, naviguer, manipuler des fichiers, lire, chercher, gérer les droits, les paquets, les services et le réseau. Avec la structure d’une commande, les raccourcis du terminal qui font gagner le plus de temps, et les huit commandes à connaître par cœur.',
};

const blocks: PageBlock[] = [
  block('hero', {
    eyebrow: 'Cours · Linux',
    title: PAGE.title,
    subtitle: 'La fiche qu’on garde ouverte les premières semaines.',
  }),
  styleLinux,

  block('html', { html: '<p>Cette page se lit dans l’ordre et s’imprime. Quand tu chercheras <em>une</em> commande précise sans te souvenir de son nom, utilise plutôt l’<a href="/pages/outils-linux">aide-mémoire cherchable</a> : on l’interroge avec ce qu’on veut faire.</p>' }),

  block('heading', { level: 2, text: '1) Comment une commande est faite' }),
  flow(`  ls -lh /var/log
  │   │   └── ARGUMENT   : sur quoi on agit
  │   └────── OPTIONS    : comment (souvent -x court, --long lisible)
  └────────── COMMANDE   : quoi

  Les options courtes se cumulent :  ls -l -h -a   ==   ls -lha
  L'option longue est plus claire dans un script : --human-readable`),
  sh(`ls --help            # l'aide courte, souvent suffisante
man ls               # le manuel complet (q pour quitter, / pour chercher)
type ls              # est-ce un binaire, un alias, une fonction ?
which ls             # son chemin`),
  note('blue', '💡 Linux distingue les majuscules', '<p><code>Fichier</code> et <code>fichier</code> sont deux fichiers différents. De même pour les options : <code>-r</code> et <code>-R</code> ne font pas la même chose sur certaines commandes.</p>'),

  block('heading', { level: 2, text: '2) Se repérer' }),
  table(['Commande', 'Ce qu’elle dit'], [
    ['<code>pwd</code>', 'Où je suis.'],
    ['<code>whoami</code>', 'Qui je suis.'],
    ['<code>id</code>', 'Mon UID, mon groupe principal et <strong>tous mes groupes</strong>.'],
    ['<code>hostname</code>', 'Le nom de la machine.'],
    ['<code>uname -a</code>', 'Noyau, architecture, nom de machine.'],
    ['<code>cat /etc/os-release</code>', 'La <strong>distribution</strong> et sa version.'],
    ['<code>uptime</code>', 'Depuis quand elle tourne, et sa charge.'],
    ['<code>date</code>', 'L’heure — à vérifier avant toute lecture de journaux.'],
  ]),

  block('heading', { level: 2, text: '3) Naviguer' }),
  sh(`cd /var/log          # aller quelque part
cd ..                # le dossier parent
cd ~                 # ma maison  (ou : cd  tout court)
cd -                 # revenir au precedent

ls                   # lister
ls -l                # format long : droits, proprietaire, taille, date
ls -lh               # tailles lisibles (4,0K au lieu de 4096)
ls -la               # y compris les fichiers caches (commencant par un point)
ls -lt               # les plus recents en premier
ls -lS               # les plus gros en premier

tree -L 2            # l'arborescence sur 2 niveaux (apt install tree)`),
  note('gray', '📁 Chemin absolu et chemin relatif', '<p><code>/var/log/syslog</code> part de la racine : il est vrai partout. <code>log/syslog</code> part d’où l’on se trouve : il dépend du contexte. <strong>Dans un script, on écrit toujours des chemins absolus</strong> — c’est ce qui explique la moitié des scripts qui marchent à la main et échouent en cron.</p>'),

  block('heading', { level: 2, text: '4) Fichiers et dossiers' }),
  sh(`mkdir dossier                 # creer un dossier
mkdir -p /srv/appli/conf      # creer aussi les parents manquants
touch fichier.txt             # creer un fichier vide (ou dater un existant)

cp source destination         # copier
cp -a dossier/ copie/         # copier en gardant droits, dates et liens
mv ancien nouveau             # deplacer OU renommer : c'est la meme commande
rm fichier                    # supprimer
rm -r dossier                 # recursif
rmdir dossier                 # ne marche que si le dossier est VIDE

ln -s /srv/appli/v2 /opt/appli   # lien symbolique : ln -s CIBLE LIEN`),
  note('red', '🚫 <code>rm -rf</code> ne demande rien et ne pardonne rien', '<p>Il n’y a pas de corbeille. Avant un <code>rm -rf</code>, on remplace <code>rm</code> par <code>ls</code> pour <strong>voir ce qui va disparaître</strong> — c’est un réflexe qui coûte deux secondes et sauve des soirées. Et l’on se méfie de l’espace de trop : <code>rm -rf /srv /appli</code> n’est pas <code>rm -rf /srv/appli</code>.</p>'),

  block('heading', { level: 2, text: '5) Lire un fichier' }),
  table(['Commande', 'Quand'], [
    ['<code>cat fichier</code>', 'Court : tout s’affiche d’un coup.'],
    ['<code>less fichier</code>', '<strong>Long</strong> : on navigue. <code>q</code> quitte, <code>/mot</code> cherche, <code>G</code> va à la fin.'],
    ['<code>head -n 20</code>', 'Les 20 premières lignes.'],
    ['<code>tail -n 50</code>', 'Les 50 dernières — le début du dépannage.'],
    ['<code>tail -f</code>', '<strong>Suivre en direct</strong> : on lance, puis on reproduit la panne.'],
    ['<code>wc -l</code>', 'Compter les lignes.'],
    ['<code>nano fichier</code>', 'Éditer. <code>Ctrl-O</code> enregistre, <code>Ctrl-X</code> quitte.'],
  ]),
  note('yellow', '⚠️ <code>tail -F</code> plutôt que <code>-f</code> sur un journal', '<p>Quand la rotation remplace le fichier, <code>-f</code> continue de suivre l’ancien et se fige sans rien dire. <code>-F</code> majuscule rouvre le fichier : c’est celui à prendre sur <code>/var/log</code>.</p>'),

  block('heading', { level: 2, text: '6) Chercher' }),
  sh(`# Chercher un FICHIER par son nom
find /etc -name '*.conf'          # les guillemets sont obligatoires
find /var -type f -size +100M     # les fichiers de plus de 100 Mo
find . -mtime -1                  # modifies dans les dernieres 24 h

# Chercher du TEXTE dans des fichiers
grep motif fichier
grep -i motif fichier             # sans tenir compte de la casse
grep -rn motif /etc/              # recursif, avec le numero de ligne
grep -v motif fichier             # les lignes qui NE contiennent PAS

# La configuration active, sans les commentaires ni les lignes vides
grep -vE '^\\s*(#|$)' /etc/ssh/sshd_config`),
  note('green', '🎯 La dernière commande vaut d’être retenue', '<p>Un fichier de configuration de 400 lignes se réduit souvent à une douzaine de lignes actives. Les voir seules, c’est comprendre la configuration en dix secondes au lieu de faire défiler.</p>'),

  block('heading', { level: 2, text: '7) Enchaîner et rediriger' }),
  flow(`  |    le TUBE : la sortie de gauche devient l'entree de droite
       ls -l /etc | grep conf | wc -l

  >    ECRIRE dans un fichier  (ECRASE ce qui existait)
  >>   AJOUTER a la fin
  2>   rediriger les ERREURS
  &>   rediriger la sortie ET les erreurs

       commande > sortie.txt 2> erreurs.txt
       commande &> tout.txt
       commande > /dev/null 2>&1     # se taire completement

  &&   ET  : la suivante ne s'execute que si la precedente a REUSSI
  ||   OU  : elle s'execute si la precedente a ECHOUE
  ;    puis : dans tous les cas

       apt update && apt upgrade     # n'upgrade pas si update a rate`),
  note('red', '🚫 <code>&gt;</code> écrase sans prévenir', '<p><code>commande &gt; fichier.log</code> vide le fichier avant d’écrire, même si la commande échoue ensuite. Pour ajouter, c’est <code>&gt;&gt;</code>. La confusion entre les deux est une perte de journal classique.</p>'),

  block('heading', { level: 2, text: '8) Droits' }),
  sh(`ls -l fichier          # -rw-r-----  1 jean compta ...
                       #  └┬┘└┬┘└┬┘
                       #   │  │  └ autres
                       #   │  └─── groupe
                       #   └────── proprietaire

chmod 640 fichier      # r=4 w=2 x=1, additionnes par categorie
chmod +x script.sh     # rendre executable
chown jean:compta f    # changer proprietaire et groupe

sudo commande          # executer en root
su -                   # devenir root (avec SON environnement)`),
  note('blue', '💡 Le détail du modèle est ailleurs', '<p>Catégories évaluées exclusivement, umask, SUID/SGID/sticky, ACL : voir le cours <a href="/pages/linux-droits">Utilisateurs, droits et sudo</a>. Ici, c’est le strict nécessaire pour travailler.</p>'),

  block('heading', { level: 2, text: '9) Paquets, services, réseau' }),
  sh(`# --- Paquets (Debian / Ubuntu) ---
sudo apt update                  # rafraichir la LISTE
sudo apt upgrade                 # installer les mises a jour
sudo apt install nom             # installer
sudo apt remove nom              # desinstaller
apt search motif                 # chercher
apt show nom                     # details d'un paquet

# --- Services ---
systemctl status ssh             # etat + dernieres lignes de journal
sudo systemctl start|stop|restart ssh
sudo systemctl enable --now ssh  # demarrer MAINTENANT et AU BOOT
systemctl --failed               # ce qui est en echec
journalctl -u ssh -n 50          # les journaux d'un service

# --- Reseau ---
ip -br a                         # mes adresses, en bref
ip r                             # la route par defaut
ss -tulpn                        # qui ecoute sur quels ports
ping -c4 1.1.1.1                 # ca sort ?
dig cisco.com                    # le DNS repond ?`),
  note('yellow', '⚠️ <code>start</code> n’est pas <code>enable</code>', '<p><code>start</code> démarre maintenant et ne survit pas au redémarrage. <code>enable</code> planifie au boot et ne lance rien tout de suite. Le service qui fonctionnait parfaitement et a disparu après un reboot a été <code>start</code>é sans être <code>enable</code>d.</p>'),

  block('heading', { level: 2, text: '10) Les raccourcis qui font gagner le plus de temps' }),
  table(['Touche', 'Effet'], [
    ['<strong>Tab</strong>', '<strong>Complète</strong> une commande ou un chemin. Deux fois : propose les possibilités. À utiliser sans arrêt — c’est aussi une protection contre les fautes de frappe.'],
    ['<strong>↑ ↓</strong>', 'Reprendre les commandes précédentes.'],
    ['<strong>Ctrl-R</strong>', '<strong>Chercher</strong> dans l’historique : on tape quelques lettres, la commande remonte.'],
    ['<strong>Ctrl-C</strong>', 'Interrompre la commande en cours.'],
    ['<strong>Ctrl-D</strong>', 'Fin de saisie / fermer la session.'],
    ['<strong>Ctrl-L</strong>', 'Nettoyer l’écran (comme <code>clear</code>).'],
    ['<strong>Ctrl-A</strong> / <strong>Ctrl-E</strong>', 'Aller au début / à la fin de la ligne.'],
    ['<strong>Ctrl-U</strong> / <strong>Ctrl-K</strong>', 'Effacer avant / après le curseur.'],
  ]),
  sh(`history            # les commandes passees
history | grep ssh # retrouver celle de la semaine derniere
!!                 # rejouer la precedente
sudo !!            # la rejouer en sudo, apres un « Permission denied »`),
  note('green', '🎯 <code>sudo !!</code> et <strong>Ctrl-R</strong>', '<p>Deux raccourcis qui changent le quotidien. Le premier rattrape le « Permission denied » sans retaper la ligne ; le second retrouve une commande complexe tapée il y a trois semaines. Personne ne les découvre seul — d’où cette page.</p>'),

  block('heading', { level: 2, text: '11) Les huit à connaître par cœur' }),
  flow(`  pwd  ls  cd        se reperer et naviguer
  cat  less  tail    lire
  grep               chercher dedans
  find               chercher un fichier

  Tout le reste se retrouve. Ces huit-la doivent venir sans reflechir,
  parce qu'on les tape des dizaines de fois par jour.`),
  note('gray', '💡 Et quand on ne sait pas', '<p><code>man commande</code> pour le manuel, <code>commande --help</code> pour l’essentiel, <code>apropos motif</code> pour trouver la commande qu’on cherche. Et l’<a href="/pages/outils-linux">aide-mémoire du site</a>, qui s’interroge avec ses mots plutôt qu’avec un nom de commande.</p>'),

  liens('/pages/linux-commandes-base'),
];

publier(PAGE, blocks).catch(e => { console.error(e); process.exit(1); });

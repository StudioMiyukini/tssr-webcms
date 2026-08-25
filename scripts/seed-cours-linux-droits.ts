/* Cours « Utilisateurs, droits et sudo » (Linux).
   Le pendant Linux du cours NTFS : qui possède, qui peut quoi, et comment on
   délègue l'administration sans distribuer le mot de passe de root.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-linux-droits.ts */
import { block, note, sh, flow, table, styleLinux, liens, publier } from './_cours-linux';
import type { PageBlock } from '../client/src/lib/page-blocks';

const PAGE = {
  slug: 'linux-droits',
  title: 'Linux : utilisateurs, droits et sudo',
  excerpt: 'Le pendant Linux des permissions NTFS. Comprendre rwx et les trois catégories, lire un chmod en octal sans hésiter, savoir ce que umask retire, reconnaître SUID/SGID/sticky, poser des droits fins avec les ACL, et déléguer l’administration par sudo au lieu de distribuer le mot de passe de root.',
};

const blocks: PageBlock[] = [
  block('hero', {
    eyebrow: 'Cours · Linux',
    title: PAGE.title,
    subtitle: 'Qui possède, qui peut quoi — et comment déléguer sans tout donner.',
  }),
  styleLinux,

  block('html', { html: '<p>Sous Windows, une autorisation se pose sur autant de groupes qu’on veut, avec une douzaine de droits élémentaires. Sous Linux, le modèle historique tient en <strong>trois catégories</strong> et <strong>trois droits</strong>. C’est beaucoup plus simple — et c’est précisément pour cela qu’il faut connaître ses limites, et les ACL qui les repoussent.</p>' }),

  block('heading', { level: 2, text: '1) Lire une ligne de ls -l' }),
  flow(`-rw-r-----  1 jean  compta  4096  12 mai  10:32  budget.ods
│└┬┘└┬┘└┬┘     │     │
│ │  │  └── autres  : ---  (aucun droit)
│ │  └───── groupe  : r--  (lecture)
│ └──────── proprietaire : rw-  (lecture + ecriture)
└────────── type : -  fichier   d  dossier   l  lien   b/c  peripherique`),
  block('html', { html: '<p>Les trois catégories sont évaluées <strong>dans l’ordre et exclusivement</strong> : si tu es le propriétaire, seuls les droits du propriétaire s’appliquent — même si le groupe en a davantage. C’est la différence majeure avec Windows, où les autorisations se <em>cumulent</em>.</p>' }),
  note('yellow', '⚠️ Le piège du propriétaire moins bien servi', '<p><code>r-- rwx ---</code> sur un fichier dont tu es propriétaire : tu es <strong>en lecture seule</strong>, alors que les membres du groupe peuvent écrire. Beaucoup s’attendent au contraire. Linux s’arrête à la première catégorie qui te concerne.</p>'),

  block('heading', { level: 2, text: '2) rwx : la même lettre ne veut pas dire la même chose' }),
  table(['Droit', 'Sur un <strong>fichier</strong>', 'Sur un <strong>dossier</strong>'], [
    ['<code>r</code> (4)', 'Lire le contenu.', '<strong>Lister</strong> les noms qu’il contient.'],
    ['<code>w</code> (2)', 'Modifier le contenu.', '<strong>Créer, renommer, supprimer</strong> des entrées — quel que soit leur propriétaire.'],
    ['<code>x</code> (1)', 'Exécuter le fichier.', '<strong>Traverser</strong> : entrer dedans, atteindre ce qu’il contient.'],
  ]),
  note('red', '🚫 <code>w</code> sur un dossier permet de supprimer un fichier qu’on ne peut pas lire', '<p>Supprimer n’est pas une opération sur le fichier : c’est une modification du <em>dossier</em>. Un utilisateur avec <code>w</code> sur <code>/data</code> peut effacer <code>/data/secret.txt</code> même s’il est en <code>---</code> dessus. C’est exactement ce que corrige le <strong>sticky bit</strong>, section 5.</p>'),
  note('blue', '💡 <code>x</code> sans <code>r</code> sur un dossier', '<p>On peut traverser sans pouvoir lister : <code>--x</code> autorise <code>cd /data/projets/rapport.pdf</code> si on connaît le nom exact, mais interdit de voir ce qu’il y a. C’est l’équivalent du droit « Traverser le dossier » de Windows, et c’est ce qui permet de publier <code>/home/jean/public</code> sans exposer le reste de <code>/home/jean</code>.</p>'),

  block('heading', { level: 2, text: '3) chmod : octal et symbolique' }),
  sh(`# Octal : r=4  w=2  x=1, additionnes par categorie
chmod 640 budget.ods      # rw- r-- ---   proprietaire ecrit, groupe lit
chmod 750 scripts/        # rwx r-x ---   un dossier a besoin de x pour etre traverse
chmod 600 ~/.ssh/id_ed25519   # rw- --- ---  une cle privee, et rien d'autre

# Symbolique : plus lisible quand on ajuste au lieu de tout poser
chmod g+w rapport.txt     # ajoute l'ecriture au groupe
chmod o-rwx /srv/appli    # retire tout aux autres
chmod -R u+rwX,go-w /srv/site   # X majuscule : x seulement sur les dossiers`),
  note('gray', '💡 Le <code>X</code> majuscule vaut la peine d’être connu', '<p><code>chmod -R +x</code> rend <strong>tous</strong> les fichiers exécutables, y compris les images et les textes. <code>+X</code> ne pose <code>x</code> que sur les dossiers et sur les fichiers qui l’avaient déjà. C’est ce qu’on veut dans 99 % des récursions.</p>'),

  block('heading', { level: 2, text: '4) chown, et umask' }),
  sh(`chown jean fichier.txt          # changer le proprietaire
chown jean:compta fichier.txt   # proprietaire ET groupe
chgrp compta fichier.txt        # le groupe seul
chown -R www-data: /var/www/site   # ':' seul = le groupe primaire de l'utilisateur`),
  block('html', { html: '<p>Le <strong>umask</strong> ne donne pas de droits : il en <em>retire</em>. Il décrit ce qu’on refuse par défaut aux fichiers nouvellement créés.</p>' }),
  flow(`umask 022  (valeur courante)
  fichier : 666 - 022 = 644   rw- r-- r--
  dossier : 777 - 022 = 755   rwx r-x r-x

umask 007  (travail en equipe : rien pour les autres)
  fichier : 666 - 007 = 660   rw- rw- ---
  dossier : 777 - 007 = 770   rwx rwx ---`),
  note('blue', '💡 Pourquoi 666 et pas 777 pour un fichier', '<p>Linux ne rend jamais un fichier exécutable à la création : ce serait une porte ouverte. Le <code>x</code> se pose toujours à la main, ce qui est une bonne chose.</p>'),

  block('heading', { level: 2, text: '5) Les trois bits spéciaux' }),
  table(['Bit', 'Se pose sur', 'Effet', 'Exemple réel'], [
    ['<strong>SUID</strong> <code>4</code>', 'Un exécutable', 'Il s’exécute avec l’identité de <strong>son propriétaire</strong>, pas de celui qui le lance.', '<code>/usr/bin/passwd</code> : modifier son mot de passe suppose d’écrire dans <code>/etc/shadow</code>, qui appartient à root.'],
    ['<strong>SGID</strong> <code>2</code>', 'Un <strong>dossier</strong>', 'Tout ce qui y est créé <strong>hérite du groupe du dossier</strong>.', 'Le dossier d’équipe : les fichiers appartiennent à <code>compta</code> quel que soit leur auteur.'],
    ['<strong>Sticky</strong> <code>1</code>', 'Un dossier partagé', 'Seul le <strong>propriétaire d’un fichier</strong> peut le supprimer, malgré le <code>w</code> sur le dossier.', '<code>/tmp</code>, où tout le monde écrit sans pouvoir effacer les fichiers des autres.'],
  ]),
  sh(`# Le dossier d'equipe qui marche vraiment
mkdir /srv/compta
chgrp compta /srv/compta
chmod 2770 /srv/compta        # le 2 en tete = SGID
ls -ld /srv/compta            # drwxrws--- : le 's' a la place du x du groupe

# /tmp et son sticky bit
ls -ld /tmp                   # drwxrwxrwt : le 't' final`),
  note('green', '🎯 Le motif à retenir : SGID + umask 007', '<p>Un dossier d’équipe sans SGID produit des fichiers appartenant au groupe primaire de chacun — donc illisibles par les collègues. SGID corrige le groupe, <code>umask 007</code> corrige les droits. Les deux ensemble, et le partage fonctionne sans intervention.</p>'),

  block('heading', { level: 2, text: '6) Les ACL : quand trois catégories ne suffisent plus' }),
  block('html', { html: '<p>« Le groupe compta en écriture, <em>et</em> l’auditeur en lecture seule » n’a pas de solution avec un seul groupe. Les <strong>ACL POSIX</strong> ajoutent des entrées supplémentaires, comme les ACE de Windows.</p>' }),
  sh(`# Voir : un '+' apparait en fin de ligne de ls -l quand un fichier porte des ACL
getfacl /srv/compta

# Accorder a un utilisateur, a un groupe
setfacl -m u:auditeur:rx /srv/compta
setfacl -m g:direction:rwx /srv/compta

# ACL par DEFAUT : heritee par ce qui sera cree dedans (le pendant de (OI)(CI))
setfacl -d -m g:compta:rwx /srv/compta

# Retirer une entree, ou tout
setfacl -x u:auditeur /srv/compta
setfacl -b /srv/compta`),
  note('yellow', '⚠️ Le masque, et le droit qui disparaît sans prévenir', '<p>Une ACL affiche une ligne <code>mask::</code>. Elle <strong>plafonne</strong> tous les droits accordés par ACL : si le masque est <code>r-x</code>, une entrée <code>rwx</code> ne donnera que <code>r-x</code>. Un <code>chmod g+w</code> recalcule le masque et peut donc <em>modifier silencieusement</em> les ACL. Devant un droit accordé qui ne prend pas, c’est la première chose à regarder dans <code>getfacl</code>.</p>'),
  note('gray', '💡 Sauvegarder les ACL', '<p><code>cp</code> et <code>tar</code> les perdent par défaut : <code>cp -a</code>, <code>tar --acls</code>, <code>rsync -A</code>. Une restauration qui « a tout remis » mais où plus personne n’a accès vient presque toujours de là.</p>'),

  block('heading', { level: 2, text: '7) sudo, en entier' }),
  block('html', { html: '<p>Se connecter en root est une mauvaise habitude pour trois raisons : aucune trace de qui a fait quoi, la moindre faute de frappe est définitive, et le mot de passe de root doit circuler entre les administrateurs. <strong>sudo</strong> règle les trois — on exécute une commande précise avec les droits de root, en s’authentifiant avec <em>son propre</em> mot de passe, et l’appel est journalisé.</p>' }),

  block('heading', { level: 3, text: 'sudo, su, su - : trois choses différentes' }),
  table(['Commande', 'Ce qu’elle fait', 'Le mot de passe demandé'], [
    ['<code>sudo commande</code>', 'Exécute <strong>une</strong> commande en root, puis rend la main.', '<strong>Le vôtre.</strong>'],
    ['<code>su</code>', 'Ouvre un shell root, mais garde l’environnement courant (PATH compris).', 'Celui de root.'],
    ['<code>su -</code>', 'Ouvre un shell root <strong>avec son environnement complet</strong>.', 'Celui de root.'],
    ['<code>sudo -i</code>', 'Un shell root complet, sans connaître le mot de passe de root.', 'Le vôtre.'],
  ]),
  note('yellow', '⚠️ Le tiret de <code>su -</code> n’est pas décoratif', '<p>Sans lui, on est root avec le <code>PATH</code> de l’utilisateur précédent — et <code>usermod</code>, <code>systemctl</code> ou <code>fdisk</code> répondent « commande introuvable » alors qu’ils sont bien installés, simplement dans <code>/usr/sbin</code>, absent du PATH d’un utilisateur ordinaire.</p>'),

  block('heading', { level: 3, text: 'Comment ça marche' }),
  flow(`  1. sudo est un binaire SUID root : il s'execute avec l'identite de
     son proprietaire (root), quel que soit celui qui le lance.
     -rwsr-xr-x  1 root root  /usr/bin/sudo
        └─ le « s » : c'est ce bit qui rend tout possible

  2. Il lit /etc/sudoers (et /etc/sudoers.d/*) : ai-je le droit de
     lancer CETTE commande, sur CETTE machine, en tant que QUI ?

  3. Il demande MON mot de passe, pas celui de root.
     Puis il le retient quelques minutes (15 par defaut).

  4. Il journalise : qui, quand, depuis quel terminal, quelle commande.
     -> /var/log/auth.log`),
  note('blue', '💡 C’est la journalisation qui fait la valeur de sudo', '<p>Un compte root partagé rend toute enquête impossible : personne ne sait qui a supprimé le fichier. Avec sudo, chaque élévation porte un nom. C’est ce que réclame un audit, et ce que demande un client après un incident.</p>'),

  block('heading', { level: 3, text: 'Sur Debian : qui a le droit, et pourquoi parfois personne' }),
  sh(`# Le groupe qui donne les pleins pouvoirs sur Debian
usermod -aG sudo jean          # -a : AJOUTER. Sans lui, on REMPLACE
                               # tous les groupes secondaires de jean.
# Puis jean doit se DECONNECTER et se reconnecter :
# l'appartenance aux groupes est fixee a l'ouverture de session.

id jean                        # verifier : « sudo » doit apparaitre
sudo -l                        # ce que J'AI le droit de faire ici`),
  note('red', '🚫 « sudo : commande introuvable » sur une Debian fraîche', '<p>Ce n’est pas une panne. Quand on <strong>donne un mot de passe à root</strong> pendant l’installation, Debian considère que l’administration passera par ce compte : il n’installe pas <code>sudo</code> et ne met personne dans le groupe. Si l’on avait laissé le mot de passe root vide, l’inverse se produirait — pas de root utilisable, et l’utilisateur placé d’office dans <code>sudo</code>.</p><p>La sortie : <code>su -</code>, puis <code>apt install sudo</code>, puis <code>usermod -aG sudo</code>, puis rouvrir la session.</p>'),

  block('heading', { level: 3, text: 'La syntaxe d’une règle' }),
  flow(`jean    ALL = (root)    NOPASSWD: /usr/bin/systemctl restart apache2
 │       │      │           │         └─ les COMMANDES autorisees
 │       │      │           └─ options (facultatif)
 │       │      └─ EN TANT QUE qui il peut les lancer
 │       └─ sur QUELLES machines (ALL : partout ; utile si le fichier
 │          est distribue sur un parc)
 └─ QUI : un utilisateur, ou %groupe`),
  table(['Champ', 'Ce qu’on y met'], [
    ['<strong>Qui</strong>', '<code>jean</code>, ou <code>%operateurs</code> pour un groupe (le <code>%</code> est obligatoire).'],
    ['<strong>Machines</strong>', '<code>ALL</code> presque toujours. Le champ existe parce qu’un même <code>sudoers</code> peut être déployé sur tout un parc.'],
    ['<strong>En tant que</strong>', '<code>(root)</code>, ou <code>(www-data)</code> pour agir en tant qu’un compte de service.'],
    ['<strong>Options</strong>', '<code>NOPASSWD:</code> n’exige pas de mot de passe — nécessaire pour un script automatisé, à restreindre à des commandes précises.'],
    ['<strong>Commandes</strong>', 'Des <strong>chemins absolus</strong>, séparés par des virgules. <code>ALL</code> = tout.'],
  ]),
  sh(`# Les pleins pouvoirs, tels qu'ils sont ecrits sur Debian
%sudo   ALL=(ALL:ALL) ALL

# Une delegation ciblee
%operateurs ALL=(root) /usr/bin/systemctl restart apache2, \\
                       /usr/bin/systemctl status apache2

# Agir en tant qu'un compte de service, sans etre root
jean ALL=(www-data) /usr/bin/php /var/www/site/console

# Sans mot de passe, pour un script de supervision
%supervision ALL=(root) NOPASSWD: /usr/bin/journalctl`),
  note('gray', '💡 Les alias, quand la liste s’allonge', '<p><code>User_Alias ADMINS = jean, marie</code>, <code>Cmnd_Alias SERVICES = /usr/bin/systemctl start *, /usr/bin/systemctl stop *</code>, puis <code>ADMINS ALL=(root) SERVICES</code>. Plus lisible qu’une ligne de trois cents caractères — mais attention aux jokers, voir plus bas.</p>'),

  block('heading', { level: 3, text: 'Où écrire, et avec quoi' }),
  sh(`visudo                                    # JAMAIS nano /etc/sudoers
visudo -f /etc/sudoers.d/exploitation      # mieux : un fichier par delegation
visudo -c                                  # verifier la syntaxe de l'ensemble`),
  note('red', '🚫 Pourquoi <code>visudo</code> et pas un éditeur ordinaire', '<p>Il <strong>vérifie la syntaxe avant d’enregistrer</strong>. Une erreur dans <code>sudoers</code> rend <code>sudo</code> inutilisable pour tout le monde — et s’il n’y a pas de mot de passe root, la machine devient inadministrable sans passer par un démarrage en mode secours. <code>visudo</code> pose aussi un verrou : deux administrateurs ne peuvent pas l’éditer en même temps.</p>'),
  note('yellow', '⚠️ Les fichiers de <code>/etc/sudoers.d/</code> ont des règles de nom', '<p>Ils sont <strong>ignorés en silence</strong> s’ils contiennent un point ou se terminent par un tilde. <code>exploitation.conf</code> ne sera jamais lu ; <code>exploitation</code> le sera. C’est une source de « ma règle ne s’applique pas » difficile à trouver, parce qu’aucun message n’apparaît.</p>'),

  block('heading', { level: 3, text: 'Les options globales' }),
  sh(`Defaults        env_reset                 # repart d'un environnement propre
Defaults        secure_path="/usr/sbin:/usr/bin:/sbin:/bin"
Defaults        timestamp_timeout=15      # minutes avant de redemander le mdp
Defaults        passwd_tries=3
Defaults        logfile="/var/log/sudo.log"   # un journal dedie
Defaults:jean   !authenticate             # dangereux : jean n'est jamais invite`),
  note('blue', '💡 <code>env_reset</code> et <code>secure_path</code> protegent de vous-même', '<p>Sans eux, une variable comme <code>PATH</code> ou <code>LD_PRELOAD</code> héritée de l’utilisateur permettrait de faire exécuter <em>son</em> binaire à la place de celui attendu. C’est pour cela que <code>sudo</code> ne trouve pas toujours une commande que vous voyez : son <code>PATH</code> est le sien, pas le vôtre.</p>'),

  block('heading', { level: 3, text: 'Les délégations qui n’en sont pas' }),
  block('html', { html: '<p>Une délégation ne vaut que si la commande autorisée <strong>ne permet pas d’en lancer une autre</strong>. Beaucoup d’outils courants ouvrent un shell, et donnent alors les pleins pouvoirs.</p>' }),
  table(['Règle apparemment inoffensive', 'Ce qu’elle donne vraiment'], [
    ['<code>… /usr/bin/vi</code>', 'Depuis vi : <code>:!bash</code> → un shell root. Idem <code>vim</code>, <code>nano</code> (via <code>^R^X</code>), <code>less</code>, <code>more</code>, <code>man</code>.'],
    ['<code>… /usr/bin/find</code>', '<code>find . -exec /bin/sh \\;</code> → shell root.'],
    ['<code>… /usr/bin/awk</code>', '<code>awk \'BEGIN {system("/bin/sh")}\'</code> → shell root. Même chose avec <code>python</code>, <code>perl</code>, <code>tar --checkpoint-action</code>.'],
    ['<code>… /usr/bin/systemctl restart *</code>', 'Le joker laisse passer des arguments inattendus — et <code>systemctl</code> sait exécuter des unités.'],
    ['<code>… /home/jean/script.sh</code>', 'Si jean peut <strong>écrire</strong> le script, il choisit ce que root exécutera.'],
  ]),
  note('red', '🚫 La règle à retenir', '<p><strong>Autoriser un éditeur, un lecteur de fichiers ou un interpréteur revient à autoriser <code>ALL</code>.</strong> Si un utilisateur doit éditer un fichier précis en root, on lui donne <code>sudoedit</code> (qui copie, fait éditer sans privilège, puis recopie) — pas <code>sudo vi</code>.</p><p>Et le script délégué appartient à root, en <code>755</code>, dans un dossier où l’utilisateur ne peut pas écrire.</p>'),

  block('heading', { level: 3, text: 'Au quotidien' }),
  sh(`sudo -l                    # ce que j'ai le droit de faire, ici
sudo -u www-data ls /srv   # agir en tant qu'un AUTRE que root
sudo -i                    # shell root complet (a eviter au quotidien)
sudo -s                    # shell root, mais avec mon environnement
sudo -k                    # oublier le mot de passe retenu, tout de suite
sudo !!                    # rejouer la commande precedente en sudo
sudo -E commande           # conserver mes variables d'environnement (prudence)

# La commande qui rate parce que la redirection n'est PAS en root :
sudo echo "texte" > /etc/fichier      # ECHOUE : le > est execute par le shell
echo "texte" | sudo tee /etc/fichier  # marche
sudo sh -c 'echo "texte" > /etc/fichier'   # marche aussi`),
  note('green', '🎯 Le piege de la redirection', '<p><code>sudo echo x &gt; /etc/fichier</code> échoue avec « Permission denied » alors qu’on est en sudo. La raison : <code>sudo</code> élève <code>echo</code>, mais la redirection <code>&gt;</code> est exécutée par <strong>votre</strong> shell, qui n’a pas les droits. C’est une des questions les plus posées, et la réponse est <code>tee</code>.</p>'),

  block('heading', { level: 3, text: 'Lire les traces' }),
  sh(`sudo grep sudo /var/log/auth.log | tail -20
sudo journalctl _COMM=sudo -n 30

# Une ligne typique :
# jean : TTY=pts/0 ; PWD=/home/jean ; USER=root ; COMMAND=/usr/bin/systemctl restart ssh
#  │          │            │              └─ en tant que qui
#  │          │            └─ depuis quel dossier
#  │          └─ depuis quel terminal
#  └─ QUI

# Les tentatives refusees, celles qui interessent un audit :
sudo grep 'NOT in sudoers\|incorrect password' /var/log/auth.log`),

  note('blue', '🪟 En regard de Windows', '<p><code>sudo</code> ↔ l’élévation UAC, mais nominative et journalisée · <code>sudo -u</code> ↔ <code>runas /user:</code> · <code>/etc/sudoers.d/</code> ↔ la délégation de contrôle d’Active Directory · <code>/var/log/auth.log</code> ↔ l’Observateur d’événements. Le principe est le même des deux côtés : <strong>on ne se connecte pas avec un compte privilégié, on élève ponctuellement</strong> — voir le <a href="/pages/permissions-partage-ntfs">cours NTFS</a>.</p>'),

  block('heading', { level: 2, text: '8) Comptes et groupes' }),
  sh(`adduser jean               # Debian : interactif, cree /home, le groupe, demande le mot de passe
useradd -m -s /bin/bash jean   # bas niveau : rien n'est fait tout seul

groupadd compta
usermod -aG compta jean    # ajouter au groupe secondaire
id jean                    # uid, gid, et TOUS les groupes
groups jean

passwd jean                # changer un mot de passe
usermod -L jean            # verrouiller le compte (mot de passe)
usermod -s /usr/sbin/nologin sauvegarde   # un compte de service ne se connecte pas`),
  note('yellow', '⚠️ Les groupes ne prennent effet qu’à la prochaine session', '<p>Comme le jeton d’accès Windows, l’appartenance aux groupes est fixée à l’ouverture de session. Après un <code>usermod -aG</code>, l’utilisateur doit se déconnecter — <code>id</code> montrera le nouveau groupe avant que <code>groups</code> dans son shell courant ne le voie.</p>'),
  table(['Fichier', 'Contient'], [
    ['<code>/etc/passwd</code>', 'Comptes : nom, uid, gid, shell, home. Lisible par tous — il n’y a plus de mot de passe dedans depuis longtemps.'],
    ['<code>/etc/shadow</code>', 'Les empreintes de mots de passe et leur expiration. Lisible par root seul.'],
    ['<code>/etc/group</code>', 'Groupes et leurs membres secondaires.'],
    ['<code>/etc/sudoers.d/</code>', 'Les délégations, un fichier par usage.'],
  ]),

  block('heading', { level: 2, text: '9) Diagnostic' }),
  sh(`namei -l /srv/compta/budgets/2026.ods   # OU exactement le chemin se bloque
sudo -u jean -s                          # essayer en tant que lui, plutot que deviner
getfacl /srv/compta                      # ACL et masque
ls -ld /srv /srv/compta                  # le parent aussi doit etre traversable`),
  note('green', '🎯 « Permission denied » : la méthode', '<p>Le refus porte rarement sur le fichier visé. <code>namei -l</code> affiche les droits de <strong>chaque niveau</strong> du chemin : il suffit qu’un dossier parent manque de <code>x</code> pour que tout ce qui est en dessous devienne inatteignable, quels que soient ses propres droits. C’est le pendant exact du droit « Traverser » de Windows.</p>'),

  note('blue', '🪟 Le tableau de correspondance avec Windows', '<p>Voir le cours <a href="/pages/permissions-partage-ntfs">Permissions : Partage &amp; NTFS</a>. Les idées se répondent : <code>x</code> sur un dossier ↔ Traverser · ACL POSIX ↔ ACE · ACL par défaut ↔ héritage <code>(OI)(CI)</code> · propriétaire ↔ propriétaire · sudo ↔ élévation UAC et délégation.</p>'),

  liens('/pages/linux-droits'),
];

publier(PAGE, blocks).catch(e => { console.error(e); process.exit(1); });

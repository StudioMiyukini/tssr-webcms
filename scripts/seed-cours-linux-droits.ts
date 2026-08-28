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

  block('heading', { level: 2, text: '1) Le problème que ça résout' }),
  block('html', { html: '<p>Plusieurs personnes travaillent sur la même machine. Le comptable ne doit pas lire les salaires de la direction, le stagiaire ne doit pas effacer la production, et le serveur web ne doit pas fouiller dans les dossiers personnels. Il faut donc que le système sache, pour <em>chaque</em> fichier, <strong>qui a le droit d’en faire quoi</strong>.</p>' }),
  block('html', { html: '<p>Windows répond en attachant à chaque fichier une <strong>liste</strong> : autant de personnes et de groupes qu’on veut, chacun avec ses droits. Linux répond autrement, et beaucoup plus simplement.</p>' }),

  block('heading', { level: 3, text: 'Chaque fichier porte deux étiquettes, et rien de plus' }),
  flow(`   budget.ods
      ├─ PROPRIETAIRE : jean      <- une personne
      └─ GROUPE       : compta    <- un groupe

   C'est tout. Pas de liste, pas d'exceptions.
   Deux etiquettes, et trois jeux de droits qui vont avec.`),
  block('html', { html: '<p>Et devant ce fichier, <strong>tout le monde tombe dans l’une de trois catégories</strong>, jamais deux :</p>' }),
  table(['Catégorie', 'Qui c’est', 'Exemple'], [
    ['<strong>Le propriétaire</strong> <code>u</code>', 'La personne nommée sur l’étiquette.', 'jean'],
    ['<strong>Le groupe</strong> <code>g</code>', 'Ceux qui sont membres du groupe étiqueté — sans être le propriétaire.', 'marie, si elle est dans <code>compta</code>'],
    ['<strong>Les autres</strong> <code>o</code>', 'Tout le reste du monde.', 'paul, du service commercial'],
  ]),
  note('blue', '💡 Pourquoi c’est si simple, et ce que ça coûte', '<p>Trois catégories suffisent à l’immense majorité des cas, et tiennent en neuf caractères — c’est pour ça que le modèle a traversé cinquante ans. La contrepartie arrive vite : « le groupe compta en écriture, <em>et</em> l’auditeur en lecture seule » n’a pas de solution avec un seul groupe. C’est ce que réparent les ACL, section 8.</p>'),

  block('heading', { level: 2, text: '2) Les trois cas, et pourquoi Linux s’arrête au premier' }),
  block('html', { html: '<p>Voilà le point qui surprend tout le monde, et il vaut mieux le rencontrer ici que devant une panne. Linux détermine <strong>dans quelle catégorie tu tombes</strong>, applique ses droits, et <strong>s’arrête là</strong>. Il ne regarde pas les autres, même si elles sont plus généreuses.</p>' }),
  flow(`   Es-tu le proprietaire ?
        OUI -> on applique SES droits. On s'arrete. Fin.
        non
         v
   Es-tu membre du groupe ?
        OUI -> on applique les droits du GROUPE. On s'arrete. Fin.
        non
         v
   Alors tu es « les autres » -> on applique ces droits-la.`),
  block('heading', { level: 3, text: 'Ce que ça donne concrètement' }),
  block('html', { html: '<p>Un fichier appartenant à <strong>jean</strong>, groupe <strong>compta</strong>, avec les droits <code>r-- rw- ---</code> :</p>' }),
  table(['Qui essaie', 'Catégorie', 'Ce qu’il peut faire'], [
    ['<strong>jean</strong> (le propriétaire)', 'propriétaire → <code>r--</code>', '<strong>Lecture seule.</strong> Il ne peut pas modifier son propre fichier.'],
    ['<strong>marie</strong> (membre de compta)', 'groupe → <code>rw-</code>', 'Lecture <em>et</em> écriture. Elle en fait plus que le propriétaire.'],
    ['<strong>paul</strong> (ni l’un ni l’autre)', 'autres → <code>---</code>', 'Rien du tout.'],
  ]),
  note('yellow', '⚠️ Le propriétaire peut avoir moins de droits que le groupe', '<p>C’est contre-intuitif, et c’est pourtant la règle : jean est bloqué en lecture alors que marie écrit. Sous Windows, les autorisations se <strong>cumulent</strong> — jean serait dans les deux catégories et obtiendrait le total. Sous Linux, on s’arrête à la première qui correspond.</p><p>Consolation : le propriétaire peut toujours <strong>changer les droits</strong>. Il se débloque lui-même avec <code>chmod u+w</code>.</p>'),

  block('heading', { level: 2, text: '3) Les trois droits' }),
  block('html', { html: '<p>Trois actions possibles, et c’est tout : <strong>lire</strong>, <strong>écrire</strong>, <strong>exécuter</strong>. Chaque catégorie les a, ou ne les a pas.</p>' }),
  block('html', { html: '<p>Mais la même lettre ne veut pas dire la même chose sur un fichier et sur un dossier — et c’est là que se logent la moitié des surprises.</p>' }),
  table(['Droit', 'Sur un <strong>fichier</strong>', 'Sur un <strong>dossier</strong>'], [
    ['<code>r</code> — lire', 'Voir le contenu du fichier.', '<strong>Lister</strong> ce qu’il contient : connaître les noms.'],
    ['<code>w</code> — écrire', 'Modifier le contenu.', '<strong>Créer, renommer, supprimer</strong> des entrées — quel que soit leur propriétaire.'],
    ['<code>x</code> — exécuter', 'Lancer le fichier comme un programme.', '<strong>Traverser</strong> : entrer dedans, atteindre ce qu’il contient.'],
  ]),
  block('heading', { level: 3, text: 'Un dossier n’est qu’une liste' }),
  block('html', { html: '<p>Pour comprendre le tableau ci-dessus, il faut savoir ce qu’est vraiment un dossier : <strong>une liste de noms</strong>, avec l’emplacement du contenu en face. Rien d’autre. Le contenu des fichiers est ailleurs.</p>' }),
  flow(`   /data  (un dossier = une liste)
      ├─ « rapport.txt »  -> emplacement 1234
      ├─ « secret.txt »   -> emplacement 5678
      └─ « photo.jpg »    -> emplacement 9012

   LIRE le dossier   = voir cette liste (les noms)
   ECRIRE le dossier = ajouter ou retirer une ligne de la liste
   TRAVERSER         = avoir le droit d'aller a l'emplacement indique`),
  note('red', '🚫 On peut supprimer un fichier qu’on ne peut pas lire', '<p>Supprimer, ce n’est pas toucher au fichier : c’est <strong>retirer une ligne de la liste</strong> — donc modifier le <em>dossier</em>. Quelqu’un qui a <code>w</code> sur <code>/data</code> peut effacer <code>/data/secret.txt</code> même s’il est en <code>---</code> dessus, et même s’il ne peut pas l’ouvrir.</p><p>C’est exactement ce que corrige le <strong>sticky bit</strong> — section 7 —, et c’est pour ça que <code>/tmp</code> en porte un.</p>'),
  note('blue', '💡 Traverser sans voir : <code>--x</code>', '<p>Un dossier en <code>--x</code> se traverse mais ne se liste pas. <code>ls /data</code> est refusé ; <code>cat /data/rapport.txt</code> fonctionne, <strong>si l’on connaît le nom exact</strong>. C’est ce qui permet de publier <code>/home/jean/public</code> sans exposer le reste de <code>/home/jean</code> — et c’est l’équivalent du droit « Traverser le dossier » de Windows.</p>'),
  note('yellow', '⚠️ Un dossier sans <code>x</code> bloque tout ce qu’il contient', '<p>Peu importe les droits du fichier visé : si l’un des dossiers du chemin n’est pas traversable, on n’y arrive pas. C’est la première cause de « Permission denied », et la raison d’être de <code>namei -l</code> — section 11.</p>'),

  block('heading', { level: 2, text: '4) Lire une ligne de ls -l' }),
  block('html', { html: '<p>Maintenant que le modèle est en place, la notation se lit toute seule. Neuf caractères, groupés par trois, dans l’ordre des trois catégories.</p>' }),
  flow(`-rw-r-----  1 jean  compta  4096  12 mai 10:32  budget.ods
│└┬┘└┬┘└┬┘     │     │
│ │  │  │      │     └─ le GROUPE etiquette
│ │  │  │      └─ le PROPRIETAIRE
│ │  │  └─ les AUTRES        : ---  rien
│ │  └──── le GROUPE        : r--  lecture
│ └─────── le PROPRIETAIRE  : rw-  lecture + ecriture
└───────── le TYPE : - fichier  d dossier  l lien  b/c peripherique`),
  block('html', { html: '<p>Un tiret à la place d’une lettre veut dire « ce droit-là, non ». Les positions ne bougent jamais : c’est toujours <code>rwx</code> dans cet ordre, pour le propriétaire, puis le groupe, puis les autres.</p>' }),
  note('gray', '💡 Le tout premier caractère n’est pas un droit', '<p>C’est le <strong>type</strong> de l’objet. Un <code>d</code> annonce un dossier, un <code>l</code> un lien symbolique. On le confond souvent avec un droit manquant du propriétaire — il n’en fait pas partie, les droits commencent au deuxième caractère.</p>'),

  block('heading', { level: 2, text: '5) chmod : poser les droits' }),
  sh(`# Octal : r=4  w=2  x=1, additionnes par categorie
chmod 640 budget.ods      # rw- r-- ---   proprietaire ecrit, groupe lit
chmod 750 scripts/        # rwx r-x ---   un dossier a besoin de x pour etre traverse
chmod 600 ~/.ssh/id_ed25519   # rw- --- ---  une cle privee, et rien d'autre

# Symbolique : plus lisible quand on ajuste au lieu de tout poser
chmod g+w rapport.txt     # ajoute l'ecriture au groupe
chmod o-rwx /srv/appli    # retire tout aux autres
chmod -R u+rwX,go-w /srv/site   # X majuscule : x seulement sur les dossiers`),
  note('gray', '💡 Le <code>X</code> majuscule vaut la peine d’être connu', '<p><code>chmod -R +x</code> rend <strong>tous</strong> les fichiers exécutables, y compris les images et les textes. <code>+X</code> ne pose <code>x</code> que sur les dossiers et sur les fichiers qui l’avaient déjà. C’est ce qu’on veut dans 99 % des récursions.</p>'),

  block('heading', { level: 2, text: '6) chown, et umask' }),
  sh(`chown jean fichier.txt          # changer le proprietaire
chown jean:compta fichier.txt   # proprietaire ET groupe
chgrp compta fichier.txt        # le groupe seul
chown -R www-data: /var/www/site   # ':' seul = le groupe primaire de l'utilisateur`),
  block('html', { html: '<p>Le <strong>umask</strong> ne donne pas de droits : il en <em>retire</em>. Il décrit ce qu’on refuse par défaut aux fichiers nouvellement créés.</p>' }),
  flow(`Le masque dit ce qu'on RETIRE. On part du maximum, on enleve.

umask 022   (la valeur courante)
  le masque retire :  ---  -w-  -w-     (0 = rien, 2 = w)
  fichier  rw- rw- rw-  ->  rw- r-- r--   soit 644
  dossier  rwx rwx rwx  ->  rwx r-x r-x   soit 755

umask 027   (plus prudent : rien pour les autres)
  le masque retire :  ---  -w-  rwx     (0, 2, 7)
  fichier  rw- rw- rw-  ->  rw- r-- ---   soit 640
  dossier  rwx rwx rwx  ->  rwx r-x ---   soit 750`),
  note('red', '\U0001f6ab « 666 moins le masque » : le raccourci qui trompe', '<p>Avec <code>umask 022</code>, la soustraction tombe juste par hasard : 666 − 022 = 644, la bonne réponse. Elle échoue dès qu’on change de masque — avec <code>umask 027</code>, très courant, elle donnerait 639, qui n’est même pas un nombre octal valide.</p><p>Un masque ne se soustrait pas : il <strong>retire des droits</strong>, chiffre par chiffre, comme on barrerait des cases.</p>'),
  note('blue', '💡 Pourquoi 666 et pas 777 pour un fichier', '<p>Linux ne rend jamais un fichier exécutable à la création : ce serait une porte ouverte. Le <code>x</code> se pose toujours à la main, ce qui est une bonne chose.</p>'),

  block('heading', { level: 2, text: '7) Les trois bits spéciaux' }),
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

  block('heading', { level: 2, text: '8) Les ACL : quand trois catégories ne suffisent plus' }),
  block('html', { html: '<p>« Le groupe compta en écriture, <em>et</em> l’auditeur en lecture seule » n’a pas de solution avec les trois catégories vues jusqu’ici. Les <strong>ACL</strong> attachent au fichier une <strong>liste d’entrées nominatives</strong>, une par utilisateur ou par groupe, indépendantes du propriétaire et du groupe principal.</p>' }),
  sh(`sudo apt install acl                    # getfacl et setfacl

getfacl /srv/compta                     # lire — un « + » dans ls -l les signale
setfacl -m u:auditeur:rx /srv/compta    # accorder a une personne
setfacl -d -m g:compta:rwx /srv/compta  # l'heritage, pour ce qui sera cree
setfacl -b /srv/compta                  # tout retirer, retour au POSIX`),
  note('green', '🎯 La règle avant d’en poser', '<p><strong>Si un <code>chmod</code> et un groupe bien choisi résolvent le problème, ne pose pas d’ACL.</strong> Elles ajoutent une couche que le prochain administrateur devra comprendre — et qu’un <code>ls -l</code> ne montre pas.</p>'),
  note('blue', '🔗 Les ACL ont leur propre cours', '<p>Le sujet a sa logique et ses pièges — le masque qui plafonne tout, la traversée du chemin, et <code>ls -l</code> qui affiche le masque au lieu du groupe. Tout est là : <strong><a href="/pages/linux-acl">Les ACL : des droits au-delà de rwx</a></strong>.</p>'),

  block('heading', { level: 2, text: '9) sudo, en entier' }),
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

  block('heading', { level: 2, text: '10) Comptes et groupes' }),

  block('heading', { level: 3, text: 'Pourquoi deux commandes pour chaque opération' }),
  block('html', { html: '<p>C’est la première surprise, et elle déroute : il existe <strong>deux commandes pour chaque geste</strong>. Elles ne font pas la même chose.</p>' }),
  table(['Bas niveau', 'Debian', 'Ce qui les sépare'], [
    ['<code>useradd</code>', '<code>adduser</code>', 'Créer un compte'],
    ['<code>userdel</code>', '<code>deluser</code>', 'Supprimer un compte'],
    ['<code>groupadd</code>', '<code>addgroup</code>', 'Créer un groupe'],
    ['<code>groupdel</code>', '<code>delgroup</code>', 'Supprimer un groupe'],
  ]),
  flow(`useradd  userdel  groupadd  groupdel     <- les OUTILS (shadow-utils)
   |                                          presents sur TOUTES les distributions
   |                                          font STRICTEMENT ce qu'on demande
   |                                          ne posent aucune question
   |
   +-- adduser  deluser  addgroup  delgroup   <- les SCRIPTS Debian
                                                 des enveloppes AUTOUR des outils
                                                 appliquent la politique maison
                                                 posent des questions`),
  table(['', '<code>useradd</code> et compagnie', '<code>adduser</code> et compagnie'],[
    ['Origine', 'Les utilitaires <em>shadow-utils</em>, communs à toutes les distributions.', 'Des scripts <strong>propres à Debian</strong> (et Ubuntu), écrits en Perl, qui appellent les précédents.'],
    ['Comportement', 'Fait le minimum demandé, <strong>rien de plus</strong>. Silencieux.', 'Applique la politique de <code>/etc/adduser.conf</code> : plage d’UID, dossier personnel, groupe personnel.'],
    ['Dossier personnel', '<strong>Non</strong> — sauf si l’on ajoute <code>-m</code>.', 'Oui, automatiquement, et il y recopie <code>/etc/skel</code>.'],
    ['Shell', 'Celui de <code>/etc/default/useradd</code> — sur Debian <code>/bin/sh</code>.', 'Demandé ou pris dans la configuration.'],
    ['Mot de passe', 'Non. Le compte reste <strong>verrouillé</strong>.', 'Demandé tout de suite, de façon interactive.'],
    ['Interactif', 'Jamais.', 'Oui — nom complet, téléphone, mot de passe.'],
    ['Où l’utiliser', '<strong>Dans un script</strong>, ou sur une distribution non Debian.', '<strong>Au clavier, sur Debian.</strong>'],
  ]),
  note('green', '🎯 La règle en une phrase', '<p><strong>Au clavier sur Debian : <code>adduser</code>. Dans un script, ou ailleurs que sur Debian : <code>useradd</code></strong> — avec <code>-m</code> et <code>-s</code> écrits explicitement, puisque rien n’est fait tout seul.</p><p>Un script qui utilise <code>adduser</code> se bloque sur la première question et n’est pas portable ; un <code>useradd</code> tapé à la main produit un compte sans maison, sans mot de passe et avec un shell inconfortable. Chacune est mauvaise à la place de l’autre.</p>'),
  sh(`# Debian, au clavier — tout est fait, tout est demande
sudo adduser florence

# Bas niveau — il faut TOUT dire, et le mot de passe est une etape a part
sudo useradd -m -s /bin/bash florence
sudo passwd florence`),
  note('yellow', '⚠️ <code>adduser</code> a une deuxième syntaxe, qui n’a rien à voir', '<p>Avec <strong>deux</strong> arguments, il n’ajoute pas un utilisateur : il ajoute un utilisateur <strong>à un groupe</strong>.</p><div class="lx-cmd">sudo adduser florence formateurs     # ajoute florence AU GROUPE formateurs\nsudo usermod -aG formateurs florence  # exactement le meme effet</div><p>La même commande fait donc deux choses selon le nombre d’arguments. C’est déroutant la première fois, et c’est ce qui explique qu’on trouve les deux formes dans les documentations.</p>'),

  block('heading', { level: 3, text: 'Les commandes du quotidien' }),
  sh(`groupadd compta                # creer un groupe
usermod -aG compta jean        # ajouter jean au groupe compta (SECONDAIRE)
gpasswd -a jean compta         # la meme chose, autre commande
gpasswd -d jean compta         # l'en RETIRER
id jean                        # uid, gid principal, et TOUS les groupes
groups jean                    # seulement la liste des groupes

passwd jean                    # changer un mot de passe
usermod -L jean                # verrouiller le compte
usermod -s /bin/bash jean      # changer le shell
usermod -s /usr/sbin/nologin sauvegarde   # un compte de service ne se connecte pas`),
  note('red', '🚫 <code>usermod -G</code> sans le <code>-a</code> efface tout', '<p><code>-G</code> seul <strong>remplace</strong> la liste des groupes secondaires par celle qu’on donne. <code>usermod -G compta jean</code> retire jean de <em>tous</em> ses autres groupes — <code>sudo</code> compris. C’est ainsi qu’on se retire soi-même le droit d’administrer.</p><p><strong>Toujours <code>-aG</code></strong>, où <code>a</code> veut dire <em>append</em>, ajouter.</p>'),
  note('yellow', '⚠️ Les groupes ne prennent effet qu’à la prochaine session', '<p>Comme le jeton d’accès Windows, l’appartenance aux groupes est fixée à l’ouverture de session. Après un <code>usermod -aG</code>, l’utilisateur doit se déconnecter — <code>id</code> montrera le nouveau groupe avant que <code>groups</code> dans son shell courant ne le voie.</p>'),
  note('blue', '🔗 Sur Rocky / RHEL, trois valeurs par défaut changent', '<p>Les commandes sont les mêmes, leurs <strong>réglages par défaut</strong> non :</p><ul><li>le groupe des administrateurs est <strong><code>wheel</code></strong>, pas <code>sudo</code> ;</li><li><code>useradd</code> <strong>crée le dossier personnel</strong> sans qu’on ait à écrire <code>-m</code> ;</li><li>le shell par défaut est <strong><code>/bin/bash</code></strong>, pas <code>/bin/sh</code> — le prompt réduit à un <code>$</code> ne s’y produit donc jamais.</li></ul><p>Et la question « pourquoi deux commandes ? » n’y a pas de sens : <code>adduser</code> y est un simple <strong>lien symbolique vers <code>useradd</code></strong>. Les scripts Perl <code>adduser</code>/<code>deluser</code> sont une particularité Debian. → <a href="/pages/linux-redhat">le cours Rocky</a>, §5.</p>'),

  block('heading', { level: 3, text: 'Les trois fichiers, ligne par ligne' }),
  block('html', { html: '<p>Aucune de ces commandes ne fait de magie : elles écrivent dans trois fichiers texte. Savoir les lire, c’est pouvoir vérifier — et réparer.</p>' }),

  block('html', { html: '<p><strong><code>/etc/passwd</code></strong> — les comptes. Sept champs séparés par des deux-points :</p>' }),
  flow(`florence:x:1001:1001:Florence Martin,,,:/home/florence:/bin/bash
    |    |   |    |            |                  |             |
    |    |   |    |            |                  |             +-- 7. SHELL de connexion
    |    |   |    |            |                  +-- 6. dossier personnel
    |    |   |    |            +-- 5. GECOS : nom complet, bureau, telephones
    |    |   |    +-- 4. GID du groupe PRINCIPAL
    |    |   +-- 3. UID — l'identite reelle du compte
    |    +-- 2. « x » : le mot de passe est ailleurs, dans /etc/shadow
    +-- 1. nom du compte`),
  note('gray', '💡 Le « x » du deuxième champ', '<p>Historiquement, l’empreinte du mot de passe se trouvait <em>là</em> — dans un fichier que <strong>tout le monde peut lire</strong>. On l’a déplacée dans <code>/etc/shadow</code>, réservé à root, et laissé un <code>x</code> à la place pour dire « va voir là-bas ». Un fichier <code>passwd</code> qui n’est plus lisible par tous casse la moitié du système : il sert à traduire les UID en noms, partout.</p>'),
  table(['Plage d’UID', 'À qui', 'Sur Debian'], [
    ['<strong>0</strong>', '<strong>root</strong>', 'C’est l’UID qui donne les pouvoirs, pas le nom. Un compte nommé autrement avec l’UID 0 <em>est</em> root.'],
    ['1 – 999', 'Comptes système', 'Services : <code>www-data</code>, <code>sshd</code>, <code>systemd-*</code>. Shell <code>nologin</code>.'],
    ['<strong>≥ 1000</strong>', '<strong>Humains</strong>', 'Le premier compte créé à l’installation porte 1000.'],
  ]),

  block('html', { html: '<p><strong><code>/etc/group</code></strong> — les groupes. Quatre champs :</p>' }),
  flow(`formateurs:x:1002:florence,amelie
     |     |   |         |
     |     |   |         +-- 4. les membres SECONDAIRES, separes par des virgules
     |     |   +-- 3. GID — c'est LUI qui relie a /etc/passwd
     |     +-- 2. mot de passe de groupe (quasi jamais utilise)
     +-- 1. nom du groupe`),
  note('red', '🚫 Le piège : le groupe principal n’apparaît PAS dans cette liste', '<p>Le quatrième champ ne contient que les membres <strong>secondaires</strong>. Le groupe <em>principal</em> d’un utilisateur est inscrit ailleurs — dans le <strong>quatrième champ de sa ligne de <code>/etc/passwd</code></strong>.</p><p>Conséquence directe : chercher <code>florence</code> dans la ligne <code>florence:x:1001:</code> de <code>/etc/group</code> ne donne rien, et l’on conclut à tort qu’elle n’est pas dans son propre groupe. La commande qui dit la vérité, c’est <code>id florence</code> — elle regarde les deux fichiers.</p>'),
  note('blue', '💡 Le groupe personnel', '<p>Sur Debian, créer l’utilisateur <code>florence</code> crée aussi un <strong>groupe <code>florence</code></strong>, dont elle est le seul membre, et qui devient son groupe principal. Ce n’est pas un doublon inutile : c’est ce qui permet à un <code>umask</code> de <code>002</code> d’être sûr — un fichier créé en groupe-écriture n’est partagé qu’avec elle-même, tant qu’on ne change pas son groupe propriétaire.</p>'),

  block('html', { html: '<p><strong><code>/etc/shadow</code></strong> — les mots de passe. Lisible par root seul. Ce qui compte est le deuxième champ :</p>' }),
  flow(`florence:$6$xR2f...9Kd:20321:0:99999:7:::
     |        |
     |        +-- l'empreinte. $6$ = SHA-512. $y$ = yescrypt (Debian 12+)
     +-- le compte

Valeurs particulieres du 2e champ :
   !   ou  !!   compte VERROUILLE — aucune connexion par mot de passe
   *              pas de mot de passe possible (comptes de service)
   (vide)         AUCUN mot de passe demande — dangereux`),
  note('yellow', '⚠️ « Un compte sans mot de passe n’est pas actif »', '<p>Après un <code>useradd</code>, le champ vaut <code>!</code> : le compte <strong>existe</strong>, il a un UID, un dossier peut-être — mais <strong>aucune connexion par mot de passe n’est possible</strong>. C’est pour cela qu’un <code>su - toto</code> échoue juste après la création. Il manque une étape :</p><div class="lx-cmd">sudo passwd toto</div><p>C’est aussi la différence de fond avec <code>adduser</code>, qui demande le mot de passe dans la foulée.</p>'),

  block('heading', { level: 3, text: 'Le champ shell, et le prompt qui ne ressemble à rien' }),
  block('html', { html: '<p>Un compte créé par <code>useradd</code> sans <code>-s</code> reçoit le shell par défaut de <code>/etc/default/useradd</code> : sur Debian, <strong><code>/bin/sh</code></strong>. À la connexion, on obtient ceci :</p>' }),
  flow(`$                            <- /bin/sh : un dollar, et c'est tout
                                 pas d'historique avec les fleches
                                 pas de completion avec la tabulation
                                 pas de couleurs

jean@debian:~$               <- /bin/bash : nom, machine, dossier courant
                                 tout le confort`),
  block('html', { html: '<p>Ce n’est pas une panne : c’est le septième champ de <code>/etc/passwd</code>. Deux façons de le corriger :</p>' }),
  sh(`sudo usermod -s /bin/bash toto     # la bonne : elle valide ce qu'on ecrit
sudo chsh -s /bin/bash toto        # equivalent

sudo nano /etc/passwd              # a la main : on voit ce qu'on change,
                                   # mais une faute de frappe rend le compte
                                   # inutilisable — vipw verifie avant d'ecrire`),
  note('gray', '💡 Éditer <code>/etc/passwd</code> à la main : avec <code>vipw</code>', '<p>Modifier le fichier directement est formateur — on voit exactement quel champ change. Mais une erreur de syntaxe empêche la connexion. <code>sudo vipw</code> ouvre le même fichier, <strong>pose un verrou</strong> pour qu’une commande concurrente ne l’écrase pas, et <strong>vérifie la syntaxe avant d’enregistrer</strong>. Le pendant pour les groupes est <code>vigr</code>.</p><p>Dans les deux cas, le changement de shell ne prend effet qu’à la <strong>prochaine connexion</strong>.</p>'),

  block('heading', { level: 3, text: 'Après la suppression : les fichiers restent' }),
  sh(`sudo deluser toto                    # supprime le compte, GARDE /home/toto
sudo deluser --remove-home toto      # supprime le compte ET son dossier
sudo userdel -r toto                 # equivalent bas niveau

sudo delgroup formateurs             # supprimer un groupe`),
  block('html', { html: '<p>Supprimer un compte ne supprime <strong>pas</strong> ses fichiers — c’est volontaire : les données d’un salarié qui part ne doivent pas disparaître avec son badge. Mais un <code>ls -al</code> donne alors ceci :</p>' }),
  flow(`AVANT la suppression :
drwxr-xr-x  2 toto  toto   4096  ... documents

APRES la suppression du compte :
drwxr-xr-x  2 1001  1001   4096  ... documents
              |     |
              +-----+-- l'UID et le GID NUS, sans nom en face`),
  note('blue', '💡 Pourquoi un nombre s’affiche à la place du nom', '<p>Le système n’a <strong>jamais</strong> stocké le nom du propriétaire sur le fichier : il n’y a qu’un <strong>numéro</strong>. Le nom vient de <code>/etc/passwd</code>, consulté au moment de l’affichage. Le compte supprimé, plus personne ne répond à « qui est 1001 ? », et <code>ls</code> affiche le nombre.</p><p>C’est la même mécanique qu’un SID orphelin sous Windows, affiché en <code>S-1-5-21-…</code> dans l’onglet Sécurité.</p>'),
  note('red', '🚫 Le danger réel des fichiers orphelins', '<p>Le prochain compte créé reçoit le <strong>premier UID libre</strong> — c’est-à-dire, très souvent, <strong>celui qui vient d’être libéré</strong>. Le nouvel arrivant hérite alors, sans rien demander, de la propriété de tous les fichiers de son prédécesseur.</p><p>D’où la règle en production : au départ d’un utilisateur, on <strong>décide</strong> — on archive, on réattribue à un responsable (<code>chown -R</code>), ou on supprime. On ne laisse pas traîner.</p><div class="lx-cmd">sudo find /home -nouser -o -nogroup     # lister tous les fichiers orphelins</div>'),

  block('heading', { level: 2, text: '11) Diagnostic' }),
  sh(`namei -l /srv/compta/budgets/2026.ods   # OU exactement le chemin se bloque
sudo -u jean -s                          # essayer en tant que lui, plutot que deviner
getfacl /srv/compta                      # ACL et masque
ls -ld /srv /srv/compta                  # le parent aussi doit etre traversable`),
  note('green', '🎯 « Permission denied » : la méthode', '<p>Le refus porte rarement sur le fichier visé. <code>namei -l</code> affiche les droits de <strong>chaque niveau</strong> du chemin : il suffit qu’un dossier parent manque de <code>x</code> pour que tout ce qui est en dessous devienne inatteignable, quels que soient ses propres droits. C’est le pendant exact du droit « Traverser » de Windows.</p>'),

  note('blue', '🪟 Le tableau de correspondance avec Windows', '<p>Voir le cours <a href="/pages/permissions-partage-ntfs">Permissions : Partage &amp; NTFS</a>. Les idées se répondent : <code>x</code> sur un dossier ↔ Traverser · ACL POSIX ↔ ACE · ACL par défaut ↔ héritage <code>(OI)(CI)</code> · propriétaire ↔ propriétaire · sudo ↔ élévation UAC et délégation.</p>'),

  liens('/pages/linux-droits'),
];

publier(PAGE, blocks).catch(e => { console.error(e); process.exit(1); });

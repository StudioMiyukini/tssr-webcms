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

  block('heading', { level: 2, text: '7) sudo : déléguer sans donner root' }),
  block('html', { html: '<p>Se connecter en root est une mauvaise habitude : aucune trace de qui a fait quoi, et la moindre faute de frappe est définitive. <strong>sudo</strong> permet d’exécuter une commande précise avec les droits de root, en s’authentifiant avec <em>son propre</em> mot de passe, et en laissant une trace dans <code>/var/log/auth.log</code>.</p>' }),
  sh(`# Debian : donner les pleins pouvoirs a un administrateur
usermod -aG sudo jean          # -aG : AJOUTER au groupe. Sans le -a, on REMPLACE
                               # tous ses groupes secondaires par celui-ci.

# On n'edite JAMAIS /etc/sudoers directement
visudo                         # il verifie la syntaxe avant d'enregistrer
visudo -f /etc/sudoers.d/exploitation   # mieux : un fichier par delegation`),
  block('html', { html: '<p>Un fichier de délégation ciblée, dans <code>/etc/sudoers.d/</code> :</p>' }),
  flow(`# /etc/sudoers.d/exploitation
# Les operateurs redemarrent le service web, et rien d'autre.
%operateurs ALL=(root) /usr/bin/systemctl restart apache2, /usr/bin/systemctl status apache2

# Le superviseur lit les journaux, sans mot de passe (pour un script)
%supervision ALL=(root) NOPASSWD: /usr/bin/journalctl`),
  note('red', '🚫 Deux délégations qui rendent sudo inutile', '<ul><li><code>%operateurs ALL=(root) /usr/bin/vi</code> — depuis <code>vi</code>, on ouvre un shell (<code>:!bash</code>) en root. Même chose avec <code>less</code>, <code>find</code>, <code>tar</code>, <code>awk</code>.</li><li>Un chemin non absolu, ou avec un joker : <code>/usr/bin/systemctl restart *</code> laisse redémarrer n’importe quel service — y compris en manipulant les arguments.</li></ul><p>Une délégation ne vaut que si la commande autorisée ne permet pas d’en lancer une autre.</p>'),
  sh(`sudo -l                    # ce que J'AI le droit de faire ici
sudo -u www-data ls /srv   # agir en tant qu'un autre utilisateur que root
sudo -i                    # un shell root complet (a eviter au quotidien)`),

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

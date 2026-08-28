/* Cours « Les ACL POSIX » (Linux), d'après le TP ACL.
   Les ACL vivaient dans une section du cours des droits, où elles étaient
   devenues le plus gros chapitre d'une page déjà longue. Elles ont leur propre
   page : le sujet a sa logique, ses pièges, et on y revient pour eux.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-linux-acl.ts */
import { block, note, sh, flow, table, styleLinux, liens, publier } from './_cours-linux';
import type { PageBlock } from '../client/src/lib/page-blocks';

const PAGE = {
  slug: 'linux-acl',
  title: 'Les ACL : des droits au-delà de rwx',
  excerpt: 'Accorder un droit à une personne précise sans créer de groupe, faire hériter les nouveaux fichiers, et comprendre les trois pièges qui font échouer une ACL pourtant correcte : la traversée du chemin, le masque qui plafonne tout, et ls -l qui affiche le masque au lieu du groupe.',
};

const blocks: PageBlock[] = [
  block('hero', {
    eyebrow: 'Cours · Linux',
    title: PAGE.title,
    subtitle: 'Quand trois catégories ne suffisent plus — et les trois pièges qui vont avec.',
  }),
  styleLinux,

  block('heading', { level: 2, text: '1) Le problème que ça résout' }),
  block('html', { html: '<p>Le modèle POSIX n’expose que <strong>trois</strong> jeux de droits par fichier : propriétaire, groupe, autres. Impossible d’accorder deux niveaux d’accès différents à deux personnes qui ne partagent aucun groupe — sans créer un groupe pour l’occasion.</p><p>Les <strong>ACL</strong> (<em>Access Control Lists</em>) lèvent la limite : elles attachent au fichier une <strong>liste d’entrées nominatives</strong>, une par utilisateur ou par groupe, indépendantes du propriétaire et du groupe principal.</p>' }),
  flow(`SANS ACL                          AVEC ACL

proprietaire  rwx                 proprietaire      rwx
groupe        r-x                 groupe            r-x
autres        ---                 user:bob          rwx   <- nommement
                                  user:carol        r-x   <- nommement
   trois cases, pas une de plus   group:direction   rwx
                                  autres            ---`),
  table(['La situation', 'La bonne réponse'], [
    ['Un propriétaire, un groupe, un accès uniforme', '<strong>Droits classiques.</strong> Pas d’ACL.'],
    ['Deux utilisateurs de groupes différents sur le même fichier', 'ACL — plus simple que créer un groupe pour l’occasion.'],
    ['Chaque personne a un niveau d’accès <em>différent</em> sur le même dossier', '<strong>ACL : la seule solution.</strong>'],
    ['Un prestataire doit lire un dossier sans rejoindre un groupe', 'ACL sur l’utilisateur — plutôt qu’élargir <code>other</code>.'],
    ['Les nouveaux fichiers doivent hériter des droits', '<strong>ACL par défaut.</strong>'],
  ]),
  note('green', '🎯 La règle avant de commencer', '<p><strong>Si un <code>chmod</code> et un groupe bien choisi résolvent le problème, ne pose pas d’ACL.</strong> Elles ajoutent une couche que le prochain administrateur devra comprendre — et qu’un <code>ls -l</code> ne montre pas. On les réserve aux cas où les droits classiques butent vraiment.</p>'),
  note('gray', '🪟 En regard de Windows', '<p>Les ACL POSIX sont le pendant direct des <strong>permissions NTFS</strong> : une liste d’entrées par compte ou par groupe, avec héritage. La différence tient au vocabulaire — <code>setfacl -d</code> pour l’héritage là où NTFS parle de <code>(OI)(CI)</code>. → <a href="/pages/permissions-ntfs">Permissions NTFS</a>.</p>'),

  block('heading', { level: 2, text: '2) Installer, et vérifier que c’est possible' }),
  sh(`sudo apt install acl                 # Debian : getfacl et setfacl
sudo dnf install acl                 # Rocky / RHEL

# Le systeme de fichiers doit monter l'option acl.
# Sur ext4 et xfs recents c'est le defaut — on verifie quand meme :
findmnt -o TARGET,SOURCE,FSTYPE,OPTIONS /srv`),
  note('yellow', '⚠️ Tous les systèmes de fichiers ne savent pas', '<p><strong>ext4</strong> et <strong>xfs</strong> gèrent les ACL nativement. <strong><code>vfat</code>, <code>exfat</code> et <code>ntfs</code> ne les portent pas du tout</strong> — pas plus que les droits Unix. Poser une ACL sur une clé USB en FAT échoue, ou pire, semble réussir sans rien conserver.</p>'),

  block('heading', { level: 2, text: '3) Lire une ACL' }),
  sh(`getfacl /srv/compta`),
  flow(`# file: srv/compta
# owner: alice
# group: compta
user::rwx                 <- le PROPRIETAIRE (1er triplet de ls -l)
user:bob:r-x              <- une entree NOMMEE : bob, quel que soit son groupe
group::r-x                <- le GROUPE proprietaire
group:direction:rwx       <- une entree nommee de groupe
mask::rwx                 <- LE PLAFOND de toutes les entrees nommees
other::---                <- tous les autres
default:user:bob:rw-      <- ce dont HERITERONT les fichiers crees ici`),
  table(['Entrée', 'Ce qu’elle vaut'], [
    ['<code>user::rwx</code>', 'Le propriétaire.'],
    ['<code>user:bob:r-x</code>', '<strong>Une entrée nommée</strong> — bob, indépendamment de son groupe.'],
    ['<code>group::r-x</code>', 'Le groupe propriétaire.'],
    ['<code>group:dev:rw-</code>', 'Une entrée nommée de groupe.'],
    ['<strong><code>mask::rwx</code></strong>', '<strong>Le plafond</strong> de toutes les entrées nommées. Section 5.'],
    ['<code>other::---</code>', 'Tous les autres.'],
    ['<code>default:…</code>', 'L’héritage. <strong>Sur les répertoires seulement.</strong>'],
  ]),
  block('html', { html: '<p>Et dans un <code>ls -l</code>, une ACL se signale par un seul caractère :</p>' }),
  flow(`-rw-r--r--  1 alice compta  2048  sans-acl.txt
-rw-rw-r--+ 1 alice compta  2048  avec-acl.txt
          ^
          le « + » : ce fichier porte des ACL.
          Il ne dit PAS lesquelles — seul getfacl les montre.`),

  block('heading', { level: 2, text: '4) Poser, modifier, retirer' }),
  sh(`setfacl -m u:bob:r         rapport.txt     # -m : ajoute ou MODIFIE
setfacl -m g:direction:rwx /srv/compta

setfacl -d -m u:bob:rw     /srv/compta      # -d : ACL par DEFAUT (l'heritage)
setfacl -R -m u:bob:rw     /srv/compta      # -R : sur le contenu EXISTANT
setfacl -R -d -m u:bob:rw  /srv/compta      # les deux : existant ET a venir

setfacl -x u:bob           rapport.txt      # -x : retirer UNE entree
setfacl -b                 rapport.txt      # -b : tout retirer, retour au POSIX
setfacl -m m::rwx          /srv/compta      # modifier le masque lui-meme`),
  note('blue', '💡 <code>-d</code> et <code>-R</code> ne font pas la même chose', '<p><code>-R</code> agit sur ce qui <strong>existe déjà</strong>. <code>-d</code> agit sur ce qui <strong>sera créé</strong>. Poser l’un sans l’autre laisse la moitié du dossier de côté — c’est l’erreur la plus fréquente sur un partage repris en cours de route.</p><p>Sur un dossier déjà peuplé, il faut donc <strong>les deux commandes</strong>.</p>'),
  note('gray', '💡 Une entrée par défaut en fait apparaître cinq', '<p>Après <code>setfacl -d -m u:bob:rw</code>, <code>getfacl</code> en affiche cinq : <code>default:user::</code>, <code>default:user:bob:</code>, <code>default:group::</code>, <code>default:mask::</code>, <code>default:other::</code>.</p><p>Ce n’est pas une anomalie : une ACL par défaut doit être <strong>complète</strong> pour être applicable — le noyau complète le jeu.</p>'),
  note('yellow', '⚠️ <code>setfacl -b</code> ne remet pas les droits « d’avant »', '<p>Il retire les entrées nommées et le masque, et laisse les droits POSIX <strong>tels qu’ils sont à cet instant</strong> — y compris ceux qu’un <code>chmod</code> a modifiés entre-temps via le masque. Après un <code>-b</code>, vérifier au <code>ls -l</code> : le <code>+</code> a disparu, mais les trois triplets ne sont pas forcément ceux qu’on croit.</p>'),

  block('heading', { level: 2, text: '5) Le masque : le plafond qu’on oublie' }),
  block('html', { html: '<p>C’est le concept le plus important des ACL, et le plus mal compris. Le masque <strong>plafonne toutes les entrées nommées</strong>, ainsi que le groupe propriétaire.</p>' }),
  flow(`user:bob:rw-      #effective:r--       <- ce que bob a REELLEMENT
mask::r--                                 <- ... parce que le masque plafonne

  L'entree accorde rw-. Le masque n'autorise que r--.
  bob n'a donc que r--. getfacl le dit lui-meme : « effective ».`),
  note('red', '🚫 <code>chmod</code> ne touche pas les entrées : il change LE MASQUE', '<p>Sur un fichier porteur d’ACL, un <code>chmod g=r</code> ne modifie pas les droits du groupe propriétaire — il abaisse <strong>le masque</strong>, et <strong>plafonne d’un coup toutes les entrées nommées</strong> à la lecture seule, quelles que soient les valeurs posées par <code>setfacl</code>.</p><p>C’est ainsi qu’un droit accordé la veille disparaît sans que personne n’ait touché aux ACL. Après chaque <code>setfacl</code>, et surtout après chaque <code>chmod</code> :</p><div class="lx-cmd">getfacl fichier | grep -E \'mask|effective\'</div>'),
  note('red', '🚫 <code>ls -l</code> affiche le masque, pas le groupe', '<p>Dès qu’un <strong><code>+</code></strong> apparaît, la position du groupe dans <code>ls -l</code> ne montre plus les droits du <em>groupe propriétaire</em> — elle montre <strong>le masque</strong>.</p><div class="lx-cmd">-rw-rw-r--+ 1 alice compta  2048  rapport.txt\\n     ^^^\\n     ce n\'est PAS le groupe compta : c\'est le masque</div><p><strong>Sur un fichier porteur du <code>+</code>, seul <code>getfacl</code> dit la vérité.</strong> Diagnostiquer un partage à ACL en lisant des <code>ls -l</code> mène droit dans le mur.</p>'),

  block('heading', { level: 2, text: '6) Le piège de la traversée' }),
  block('html', { html: '<p>Une ACL dit ce qu’on a le droit de <strong>faire</strong> sur un fichier. Elle ne dit rien du droit d’<strong>arriver</strong> jusqu’à lui. Le noyau vérifie d’abord le droit de traversée — le <code>x</code> — sur <strong>chaque répertoire du chemin</strong>. Un seul maillon manquant, et la lecture échoue.</p>' }),
  sh(`sudo chmod 750 /srv/projet
sudo -u bob cat /srv/projet/rapport.txt
#   Permission denied

getfacl /srv/projet/rapport.txt
#   user:bob:r--          <- le droit EST bien la, sur le fichier

sudo setfacl -m u:bob:x /srv/projet        # il manquait le droit d'ENTRER
sudo -u bob cat /srv/projet/rapport.txt    # ... et ca passe`),
  note('red', '🚫 Sur un répertoire, <code>r</code> sans <code>x</code> ne sert à rien', '<p>Sur un répertoire, <code>r</code> autorise à <strong>lister les noms</strong> et <code>x</code> à <strong>entrer et ouvrir</strong> ce qu’il contient. Un <code>r</code> seul donne donc un dossier dont on voit le contenu sans pouvoir rien lire — la pire des situations, parce qu’elle <em>ressemble</em> à un droit accordé.</p><p><strong>En lecture, la bonne ACL sur un répertoire est <code>rx</code>, jamais <code>r</code>. En écriture, <code>rwx</code>, jamais <code>rw</code>.</strong></p>'),
  note('green', '🎯 <code>namei -l</code> désigne le maillon fautif', '<p>Plutôt que de deviner quel niveau du chemin bloque :</p><div class="lx-cmd">namei -l /srv/projet/rapport.txt</div><p>Il affiche les droits de <strong>chaque étage</strong>, de la racine au fichier. Le maillon manquant saute aux yeux — et c’est presque toujours un dossier parent, pas le fichier visé.</p>'),

  block('heading', { level: 2, text: '7) Un espace projet, en entier' }),
  block('html', { html: '<p>Trois rôles sur <code>/srv/webapp</code> : <strong>alice</strong> développe (tous droits), <strong>bob</strong> intègre (lecture-écriture), <strong>carol</strong> audite (lecture seule).</p>' }),
  sh(`sudo mkdir -p /srv/webapp
sudo chown alice:alice /srv/webapp
sudo chmod 750 /srv/webapp                 # « other » n'a rien, et c'est voulu

# Sur le REPERTOIRE — noter les x, indispensables pour y entrer
sudo setfacl -m u:bob:rwx  /srv/webapp
sudo setfacl -m u:carol:rx /srv/webapp

# Sur ce qui sera cree dedans : ce sont des FICHIERS, pas de x inutile
sudo setfacl -d -m u:alice:rwx /srv/webapp
sudo setfacl -d -m u:bob:rw    /srv/webapp
sudo setfacl -d -m u:carol:r   /srv/webapp

getfacl /srv/webapp                        # l'etat complet
sudo -u alice touch /srv/webapp/app.py
getfacl /srv/webapp/app.py                 # l'heritage a-t-il joue ?`),
  note('blue', '💡 <code>rx</code> sur le dossier, <code>r</code> sur les fichiers', '<p>Ce n’est pas une inattention : le <code>x</code> d’un répertoire sert à le <em>traverser</em>, celui d’un fichier à l’<em>exécuter</em>. Carol a besoin d’entrer dans le dossier (<code>rx</code>) et de lire les fichiers (<code>r</code>) — lui donner <code>x</code> sur les fichiers ne servirait à rien et brouillerait la lecture.</p>'),
  note('green', '🎯 Vérifier en se mettant à leur place', '<p>Lire un <code>getfacl</code> permet de croire qu’on a raison. L’essayer permet de le savoir :</p><div class="lx-cmd">sudo -u carol cat /srv/webapp/app.py       # doit passer\\nsudo -u carol touch /srv/webapp/essai      # doit ECHOUER</div><p>Un droit qu’on n’a pas testé dans les deux sens — ce qui doit marcher <em>et</em> ce qui doit échouer — n’est pas vérifié.</p>'),

  block('heading', { level: 2, text: '8) Sauvegarder et migrer' }),
  sh(`getfacl -pR /srv/webapp > /root/acl-webapp.bak    # sauvegarder
setfacl --restore=/root/acl-webapp.bak            # restaurer

cp -a source destination        # -a preserve les ACL
tar --acls -czf x.tgz dossier   # tar les PERD sans cette option
rsync -avA source/ dest/        # -A preserve les ACL`),
  note('red', '🚫 Le <code>-p</code> de <code>getfacl</code> n’est pas facultatif', '<p>Sans lui, la sauvegarde enregistre des chemins <strong>relatifs</strong> — <code># file: srv/webapp</code> au lieu de <code># file: /srv/webapp</code>. La restauration ne fonctionne alors que si on la lance <em>depuis la racine</em>, et échoue partout ailleurs.</p><p><strong>Vérifie toujours que la première ligne du fichier commence par <code># file: /</code>.</strong></p>'),
  note('yellow', '⚠️ Les outils courants perdent les ACL par défaut', '<p><code>cp</code> sans <code>-a</code>, <code>tar</code> sans <code>--acls</code>, <code>rsync</code> sans <code>-A</code> : dans les trois cas, la copie arrive avec les droits POSIX seuls. C’est la cause classique du « les droits ont sauté après la migration » — et l’on cherche alors du côté du serveur d’arrivée, alors que le problème était dans la commande de copie.</p>'),

  block('heading', { level: 2, text: '9) Diagnostic' }),
  sh(`ls -l fichier                    # y a-t-il un « + » ?
getfacl fichier                  # LA verite : entrees, masque, effectif
getfacl fichier | grep -E 'mask|effective'
namei -l /chemin/complet/fichier # OU exactement ca bloque
sudo -u bob -s                   # essayer EN TANT QUE lui, plutot que deviner
findmnt -o TARGET,FSTYPE,OPTIONS /srv   # le systeme de fichiers porte-t-il les ACL ?`),
  table(['Le symptôme', 'La cause, presque toujours'], [
    ['<code>getfacl</code> montre le droit, l’accès échoue', '<strong>La traversée</strong> — un <code>x</code> manque sur un dossier parent. <code>namei -l</code>.'],
    ['Un droit accordé a disparu', '<strong>Le masque</strong> — un <code>chmod</code> est passé par là.'],
    ['<code>ls -l</code> et <code>getfacl</code> se contredisent', 'Normal : avec un <code>+</code>, <code>ls -l</code> affiche le masque.'],
    ['On voit les noms, on ne peut rien lire', '<code>r</code> sans <code>x</code> sur le répertoire.'],
    ['Les ACL ont disparu après une copie', '<code>cp</code> sans <code>-a</code>, ou <code>tar</code> sans <code>--acls</code>.'],
    ['<code>setfacl</code> refuse : « Operation not supported »', 'Le système de fichiers ne porte pas les ACL — FAT, exFAT.'],
  ]),

  block('heading', { level: 2, text: '10) Le mémo' }),
  flow(`LIRE        getfacl fichier              toujours apres un setfacl
            ls -l                        le « + », rien de plus

POSER       setfacl -m u:bob:rwx  cible  un utilisateur
            setfacl -m g:dev:rwx  cible  un groupe
            setfacl -d -m ...     dossier  l'HERITAGE
            setfacl -R -m ...     dossier  l'EXISTANT
            setfacl -m m::rwx     cible  le masque

RETIRER     setfacl -x u:bob      cible  une entree
            setfacl -b            cible  tout — retour au POSIX

SAUVER      getfacl -pR dossier > f.bak      -p OBLIGATOIRE
            setfacl --restore=f.bak

CHERCHER    namei -l /chemin/fichier         ou ca bloque
            sudo -u bob -s                   se mettre a sa place

LES TROIS PIEGES
  1. l'ACL du fichier ne donne pas le droit d'y ARRIVER  -> x sur les parents
  2. le masque plafonne tout, et chmod le change          -> grep effective
  3. ls -l affiche le masque, pas le groupe               -> getfacl`),

  block('heading', { level: 2, text: '11) Se tester' }),
  block('html', { html: '<ol><li>Quelle est la différence entre les droits POSIX classiques et les ACL ?</li><li>Que signifie le <code>+</code> affiché par <code>ls -l</code> ?</li><li>Pourquoi une ACL correcte sur un fichier ne suffit-elle pas toujours à y accéder ?</li><li>Sur un répertoire, pourquoi <code>r</code> seul est-il insuffisant, et que faut-il ajouter ?</li><li>Qu’est-ce que le masque, et quel rôle joue-t-il vis-à-vis des entrées nommées ?</li><li>Un fichier porte <code>user:bob:rwx</code> et <code>mask::r--</code>. Que peut faire bob ?</li><li>Quelle commande pose un droit sur les fichiers <em>à venir</em> d’un dossier ? Et sur ceux qui <em>existent déjà</em> ?</li><li>Pourquoi <code>getfacl -R</code> sans <code>-p</code> produit-il une sauvegarde difficilement restaurable ?</li></ol>' }),
  note('gray', '💡 La réponse à la sixième', '<p><strong>Lire, et rien d’autre.</strong> Le masque à <code>r--</code> plafonne l’entrée à <code>r--</code> — <code>getfacl</code> l’écrit d’ailleurs en clair : <code>user:bob:rwx #effective:r--</code>.</p>'),

  note('blue', '🔗 Les pages liées', '<p><a href="/pages/linux-droits">Utilisateurs, droits et sudo</a> — <code>rwx</code>, l’octal, <code>umask</code>, les bits spéciaux · <a href="/pages/permissions-ntfs">Permissions NTFS</a>, le pendant Windows · <a href="/pages/linux-disques">Disques et systèmes de fichiers</a> — lesquels portent les ACL · <a href="/pages/tp-utilisateurs-droits">TP : utilisateurs et droits</a></p>'),
  liens('/pages/linux-acl'),
];

publier(PAGE, blocks).catch(e => { console.error(e); process.exit(1); });

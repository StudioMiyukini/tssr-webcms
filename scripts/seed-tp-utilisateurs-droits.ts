/* TP 1.8.4 — Utilisateurs et droits, suite du 1.8.2.
   L'énoncé donne des consignes en français ; tout le travail consiste à les
   traduire en chown / chgrp / chmod. Les repères enseignent donc la TRADUCTION
   — phrase → droits → octal — plutôt que de livrer la liste des commandes.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-tp-utilisateurs-droits.ts */
import { block, note, sh, flow, table, styleLinux, publier } from './_cours-linux';
import type { PageBlock } from '../client/src/lib/page-blocks';

const PAGE = {
  slug: 'tp-utilisateurs-droits',
  title: 'TP — Utilisateurs et droits',
  excerpt: 'Remettre d’aplomb l’arborescence du TP 1.8.2 avec chown, chgrp et chmod : rendre chaque dossier à son propriétaire, poser le bon groupe, traduire chaque phrase de l’énoncé en droits. Avec la méthode de traduction phrase → rwx → octal, et le piège du -R qui rend les fichiers exécutables.',
};

const blocks: PageBlock[] = [
  block('hero', {
    eyebrow: 'TP · Linux',
    title: 'Utilisateurs et droits',
    subtitle: 'Suite du 1.8.2 — reprendre une arborescence qui appartient entièrement à root.',
  }),
  styleLinux,

  note('blue', '🎯 Objectif', '<p>Utiliser <code>chmod</code>, <code>chown</code> et <code>chgrp</code> pour donner à chaque dossier et à chaque fichier le bon propriétaire, le bon groupe et les bons droits.</p><p><strong>Prérequis :</strong> une Debian 12 sur laquelle le <a href="/pages/tp-utilisateurs">TP 1.8.2</a> a été réalisé. Ce TP <strong>reprend son arborescence</strong>.</p>'),

  block('heading', { level: 2, text: '1) Contrôle avant de commencer' }),
  block('html', { html: '<p>Le support impose de vérifier trois choses. Si l’une manque, on la remet en place <strong>avant</strong> de continuer — sinon toute la suite porte à faux.</p>' }),
  table(['À vérifier', 'Où', 'Tolérance'], [
    ['L’arborescence de <code>/home/documents</code>', '<code>tree /home</code>', 'Doit correspondre à la fin du 1.8.2.'],
    ['<code>florence</code> est le seul compte en plus du tien', '<code>/etc/passwd</code>', 'La ligne n’a pas à être identique — il faut juste que <code>florence</code> existe.'],
    ['Les groupes et leurs membres', '<code>/etc/group</code>', 'Les <strong>GID peuvent différer</strong>, ce n’est pas grave.'],
  ]),
  sh(`tree /home                 # l'arborescence
getent passwd florence     # le compte existe ?
getent group formateurs coordinateurs informatique
id florence                # ses groupes reels`),

  block('heading', { level: 2, text: '2) Le travail à faire' }),

  block('heading', { level: 3, text: 'a. Compléter l’arborescence' }),
  block('html', { html: '<p><em>Amélie a quitté la société. Christophe la remplace et reprend l’entièreté de son poste.</em></p><ul><li>Créer <code>christophe</code> avec son dossier personnel ; l’ajouter au groupe <code>formateurs</code>.</li><li>Renommer <code>/home/documents/formateurs/amelie</code> en <code>christophe</code>.</li><li>Créer <code>mathieu</code> avec son dossier personnel ; l’ajouter à <code>formateurs</code>.</li><li>Dans <code>formateurs</code>, créer <code>mathieu</code>, et dedans <code>reseau</code>, contenant les fichiers <code>cours</code> et <code>travaux_pratique</code>.</li><li>Créer <code>marc</code> avec son dossier personnel ; l’ajouter à <code>coordinateurs</code>.</li><li>Renommer le dossier <code>coordinatrice</code> en <code>coordinateurs</code>.</li><li>Renommer le fichier <code>planning</code> en <code>planning_reseau</code>, et créer à côté <code>planning_dev</code>.</li><li>Ajouter <strong>tous les nouveaux utilisateurs</strong> au groupe <code>informatique</code>.</li></ul>' }),

  block('heading', { level: 3, text: 'b. Les utilisateurs propriétaires' }),
  block('html', { html: '<ul><li><code>documents</code>, <code>coordinateurs</code> et le fichier <code>planning_reseau</code> → <strong>florence</strong></li><li><code>planning_dev</code> → <strong>marc</strong></li><li><code>courssegmentation</code> → <strong>ton compte personnel</strong></li><li><code>formateurs</code> et <code>informatique</code>, <strong>récursivement</strong> → <strong>christophe</strong></li><li><code>mathieu</code> → <strong>mathieu</strong></li></ul>' }),

  block('heading', { level: 3, text: 'c. Les groupes propriétaires' }),
  block('html', { html: '<ul><li><code>documents</code> → groupe <strong>informatique</strong></li><li><code>coordinateurs</code>, <strong>récursivement</strong> → groupe <strong>coordinateurs</strong></li><li><code>courssegmentation</code> → <strong>ton groupe personnel</strong></li><li><code>formateurs</code>, <strong>récursivement</strong> → groupe <strong>formateurs</strong></li><li><code>informatique</code>, <strong>récursivement</strong> → groupe <strong>informatique</strong></li></ul>' }),

  block('heading', { level: 3, text: 'd. Les droits' }),
  block('html', { html: '<ul><li><strong>Sur toute l’arborescence : les autres n’ont aucun droit.</strong></li><li><code>documents</code> et <code>coordinateurs</code> : propriétaire tous les droits ; groupe lire et exécuter.</li><li><code>planning_dev</code> et <code>planning_reseau</code> : propriétaire tous les droits ; groupe lire seulement.</li><li><code>courssegmentation</code> : le propriétaire est le <strong>seul</strong> à y avoir accès, avec tous les droits.</li><li><code>formateurs</code>, <strong>récursivement</strong> : propriétaire tous les droits ; groupe lire et exécuter.</li><li><code>informatique</code>, <strong>récursivement</strong> : propriétaire <strong>et</strong> groupe, tous les droits.</li></ul>' }),

  note('yellow', '⏸️ Cherche d’abord', '<p>Ce qui suit donne la <strong>méthode de traduction</strong>, pas les commandes toutes faites. Mais si tu la lis maintenant, tu ne construiras pas le réflexe — et c’est lui qu’on évalue.</p>'),

  block('heading', { level: 2, text: 'Repères — traduire une phrase en droits' }),
  block('html', { html: '<p>Tout ce TP est un exercice de traduction. Une phrase française donne toujours <strong>trois blocs</strong>, dans cet ordre : propriétaire, groupe, autres.</p>' }),
  flow(`« le proprietaire tous les droits, le groupe lire et executer,
   les autres aucun droit »

        proprietaire        groupe            autres
           r w x            r - x             - - -
           4+2+1=7          4+0+1=5           0
                    ->  750`),
  table(['Lettre', 'Valeur', 'Sur un fichier', 'Sur un dossier'], [
    ['<code>r</code>', '<strong>4</strong>', 'Lire le contenu', 'Lister les noms (<code>ls</code>)'],
    ['<code>w</code>', '<strong>2</strong>', 'Modifier le contenu', '<strong>Créer, renommer, supprimer</strong> dedans'],
    ['<code>x</code>', '<strong>1</strong>', 'Exécuter', '<strong>Entrer</strong> dedans (<code>cd</code>), traverser'],
  ]),
  note('red', '🚫 Sur un dossier, <code>x</code> n’est pas optionnel', '<p>Un dossier sans <code>x</code> est un dossier dans lequel on <strong>ne peut pas entrer</strong>, même avec <code>r</code>. Et sans <code>x</code>, <code>r</code> ne sert quasiment à rien : on voit les noms, sans pouvoir lire les fichiers.</p><p>C’est pour cela que les consignes disent « lire <strong>et exécuter</strong> » pour les dossiers, et « lire » seul pour les fichiers. Ce n’est pas une formule : c’est la différence entre un dossier consultable et un dossier mort.</p>'),

  block('heading', { level: 2, text: 'Repères — la table de traduction du TP' }),
  block('html', { html: '<p>Chaque consigne de la section (d), traduite. Le dernier chiffre est <strong>toujours 0</strong> : « sur toute l’arborescence, les autres n’ont aucun droit ».</p>' }),
  table(['Consigne', 'Ce que ça donne', 'Octal'], [
    ['<code>documents</code>, <code>coordinateurs</code> — propriétaire tout, groupe lire+exécuter', '<code>rwx r-x ---</code>', '<strong>750</strong>'],
    ['<code>planning_dev</code>, <code>planning_reseau</code> — propriétaire tout, groupe lire', '<code>rwx r-- ---</code>', '<strong>740</strong>'],
    ['<code>courssegmentation</code> — le propriétaire seul, tous droits', '<code>rwx --- ---</code>', '<strong>700</strong>'],
    ['<code>formateurs</code> <em>(récursif)</em> — propriétaire tout, groupe lire+exécuter', '<code>rwx r-x ---</code>', '<strong>750</strong>'],
    ['<code>informatique</code> <em>(récursif)</em> — propriétaire et groupe, tous droits', '<code>rwx rwx ---</code>', '<strong>770</strong>'],
  ]),
  note('blue', '💡 Vérifier une traduction sans se tromper', '<p><code>stat -c "%a %U %G %n" fichier</code> affiche les droits en octal, le propriétaire et le groupe sur une seule ligne — bien plus lisible qu’un <code>ls -l</code> quand on contrôle vingt entrées.</p><div class="lx-cmd">stat -c "%a %U %G %n" /home/documents\\nfind /home/documents -exec stat -c "%a %U %G %n" {} +     # toute l\'arborescence</div>'),

  block('heading', { level: 2, text: 'Repères — les trois commandes' }),
  table(['Commande', 'Change', 'Forme utile ici'], [
    ['<code>chown</code>', 'L’utilisateur propriétaire', '<code>sudo chown florence documents</code><br><code>sudo chown -R christophe formateurs</code>'],
    ['<code>chgrp</code>', 'Le groupe propriétaire', '<code>sudo chgrp informatique documents</code><br><code>sudo chgrp -R formateurs formateurs</code>'],
    ['<code>chmod</code>', 'Les droits', '<code>sudo chmod 750 documents</code><br><code>sudo chmod -R 770 informatique</code>'],
  ]),
  note('gray', '💡 <code>chown</code> peut faire les deux d’un coup', '<p><code>sudo chown florence:informatique documents</code> pose l’utilisateur <strong>et</strong> le groupe en une commande. <code>chgrp</code> reste plus lisible quand seul le groupe change — et le TP demande les deux séparément, ce qui est plus formateur.</p><p>Seul <strong>root</strong> peut donner un fichier à quelqu’un d’autre : d’où <code>sudo</code> partout ici.</p>'),

  block('heading', { level: 2, text: 'Repères — les trois pièges de ce TP' }),

  note('red', '🚫 1. L’ordre compte : les droits en dernier', '<p><code>chown</code> et <code>chgrp</code> ne modifient pas les droits, mais poser les droits <strong>avant</strong> de changer le propriétaire mène à se tromper de cible : on raisonne sur « le propriétaire » alors que ce n’est pas encore le bon.</p><p><strong>Faire dans l’ordre : propriétaire → groupe → droits.</strong> C’est d’ailleurs l’ordre des sections (b), (c), (d) de l’énoncé — ce n’est pas un hasard.</p>'),

  note('red', '🚫 2. <code>chmod -R 750</code> rend tous les fichiers exécutables', '<p>Un <code>-R</code> applique le <strong>même</strong> mode à tout : dossiers <em>et</em> fichiers. Le <code>x</code> voulu pour entrer dans les dossiers se retrouve donc posé sur <code>cours</code> et <code>travaux_pratique</code>, qui deviennent « exécutables » — ce qui n’a aucun sens pour un fichier texte, et brouille la lecture d’un <code>ls</code>.</p><p>Le TP l’accepte, et sa correction attend ce résultat. Mais en production, on écrit :</p><div class="lx-cmd">sudo chmod -R u=rwX,g=rX,o= formateurs</div><p>Le <strong>X majuscule</strong> pose <code>x</code> <em>uniquement</em> sur les dossiers et sur les fichiers qui étaient déjà exécutables. C’est la forme correcte, et elle vaut la peine d’être notée dans ton dictionnaire.</p>'),

  note('red', '🚫 3. Un dossier parent sans <code>x</code> bloque tout ce qui est dessous', '<p>Les droits se vérifient <strong>à chaque niveau du chemin</strong>. Si <code>documents</code> est en <code>750</code> et que <code>mathieu</code> n’est ni florence ni dans le groupe <code>informatique</code>, il tombe dans « autres » — soit <code>---</code> — et <strong>ne peut pas atteindre son propre dossier</strong>, quels que soient les droits posés dessus.</p><p>Quand un accès est refusé, la commande qui répond est :</p><div class="lx-cmd">namei -l /home/documents/formateurs/mathieu/reseau/cours</div><p>Elle affiche les droits de chaque niveau et montre exactement <strong>où</strong> ça bloque.</p>'),

  block('heading', { level: 2, text: 'Contrôler le résultat' }),
  sh(`# Vue d'ensemble : droits, proprietaire, groupe, sur tout l'arbre
find /home/documents -exec stat -c "%a %U %G %n" {} +

# Verifier qu'AUCUN « autre » n'a de droit : le 3e chiffre doit etre 0 partout
find /home/documents ! -perm -o=--- -o -perm /007

# Se mettre a la place d'un utilisateur, plutot que deviner
sudo -u mathieu ls -al /home/documents/formateurs/mathieu
sudo -u marc cat /home/documents/coordinateurs/planning_dev`),
  note('green', '🎯 Le meilleur contrôle : essayer d’être l’utilisateur', '<p><code>sudo -u mathieu <em>commande</em></code> exécute la commande <strong>en tant que</strong> mathieu, sans avoir à connaître son mot de passe. C’est le seul moyen de vérifier vraiment qu’un droit fonctionne : lire un <code>ls -l</code> permet de croire qu’on a raison, l’essayer permet de le savoir.</p>'),

  note('blue', '🔗 Les pages qui vont avec', '<p><a href="/pages/linux-droits">Cours : utilisateurs, droits et sudo</a> — <code>rwx</code>, octal, <code>umask</code>, ACL · <a href="/pages/tp-utilisateurs">1.8.2 — TP Utilisateurs</a> (le point de départ) · <a href="/pages/tp-utilisateurs-recherche">1.8.1 — Recherche</a> · <a href="/pages/tp-manipulation-fichiers">TP : manipulation de fichiers</a></p>'),
];

publier(PAGE, blocks).catch(e => { console.error(e); process.exit(1); });

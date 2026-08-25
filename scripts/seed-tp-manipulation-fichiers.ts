/* TP 1.7.1 — Recherche : manipulation de fichiers et de dossiers.
   Même principe que le TP 1.3.1 : l'élève cherche, les repères servent à
   vérifier après coup. Ils complètent le dictionnaire de commandes qu'il tient
   depuis le premier TP.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-tp-manipulation-fichiers.ts */
import { block, note, sh, flow, table, styleLinux, publier } from './_cours-linux';
import type { PageBlock } from '../client/src/lib/page-blocks';

const PAGE = {
  slug: 'tp-manipulation-fichiers',
  title: 'TP — Recherche : manipulation de fichiers',
  excerpt: 'Documenter dix-sept commandes de manipulation de fichiers et six de dossiers : à quoi elles servent, leur syntaxe, deux paramètres et un exemple. Avec les repères de vérification — dont les pièges qui ne se voient qu’une fois : cp qui écrase sans demander, mv qui sert à deux choses, et rmdir qui refuse un dossier non vide.',
};

const blocks: PageBlock[] = [
  block('hero', {
    eyebrow: 'TP · Linux',
    title: 'Recherche : manipulation de fichiers',
    subtitle: 'Vingt-trois commandes à documenter — et à ajouter à ton dictionnaire.',
  }),
  styleLinux,

  note('blue', '🎯 La consigne', '<p>Pour chaque commande : <strong>à quoi elle sert, sa syntaxe, au moins deux paramètres, et un exemple d’utilisation</strong>. Complète le dictionnaire de commandes commencé au TP précédent — c’est lui qui te servira toute l’année, pas cette page.</p>'),

  block('heading', { level: 2, text: 'I — Manipulation de fichiers' }),
  flow(`  man     touch   cp      mv      cat
  tac     more    less    head    tail
  nl      diff    wc      find    grep
  split   rm`),

  block('heading', { level: 2, text: 'II — Manipulation de dossiers' }),
  flow(`  mkdir   mkdir -p   cp -R
  mv      rm -R      rmdir`),

  note('gray', '🔎 Où chercher', '<p><code>man commande</code> pour le manuel complet — <code>q</code> pour sortir, <code>/mot</code> pour chercher dedans. <code>commande --help</code> quand on veut juste l’essentiel. Et la <a href="/pages/linux-commandes-base">fiche des commandes de base</a>, qui les couvre presque toutes.</p>'),

  note('yellow', '⏸️ Cherche d’abord', '<p>Ce qui suit vérifie ton travail. Le lire avant fait gagner une heure et perdre l’exercice.</p>'),

  block('heading', { level: 2, text: 'Repères — les fichiers' }),
  table(['Commande', 'À quoi elle sert', 'Deux paramètres utiles'], [
    ['<code>man</code>', 'Le manuel d’une commande. <strong>La première à connaître</strong> : elle donne toutes les autres.', '<code>man -k motif</code> cherche par mot-clé · <code>man 5 passwd</code> vise la section 5 (formats de fichiers) plutôt que la commande'],
    ['<code>touch</code>', 'Créer un fichier vide, ou <strong>mettre à jour sa date</strong> s’il existe déjà.', '<code>-a</code> date d’accès seule · <code>-t</code> imposer une date'],
    ['<code>cp</code>', 'Copier.', '<strong><code>-a</code></strong> préserve droits, dates et liens · <code>-i</code> demande avant d’écraser'],
    ['<code>mv</code>', 'Déplacer <strong>ou renommer</strong> — c’est la même opération.', '<code>-i</code> demande avant d’écraser · <code>-n</code> n’écrase jamais'],
    ['<code>cat</code>', 'Afficher tout le contenu d’un coup. Sert aussi à <strong>concaténer</strong> : <code>cat a b > c</code>.', '<code>-n</code> numérote les lignes · <code>-A</code> montre les caractères invisibles'],
    ['<code>tac</code>', '<code>cat</code> à l’envers : de la dernière ligne à la première. Pratique sur un journal.', '—'],
    ['<code>more</code>', 'Afficher page par page. Ancien : n’avance que vers le bas.', '<code>Espace</code> page suivante · <code>q</code> quitter'],
    ['<code>less</code>', 'La version moderne : on navigue dans les deux sens, on cherche. <strong>C’est celle qu’on utilise.</strong>', '<code>/motif</code> chercher · <code>G</code> aller à la fin · <code>-N</code> numéroter'],
    ['<code>head</code>', 'Le début du fichier (10 lignes par défaut).', '<code>-n 20</code> vingt lignes · <code>-c 100</code> cent octets'],
    ['<code>tail</code>', 'La fin. <strong>Le début du dépannage.</strong>', '<code>-n 50</code> · <strong><code>-f</code></strong> suivre en direct (préférer <code>-F</code> sur un journal)'],
    ['<code>nl</code>', 'Afficher en numérotant les lignes.', '<code>-b a</code> numéroter aussi les lignes vides'],
    ['<code>diff</code>', 'Comparer deux fichiers ligne à ligne.', '<code>-u</code> format unifié, lisible · <code>-r</code> comparer deux dossiers'],
    ['<code>wc</code>', 'Compter (<em>word count</em>).', '<code>-l</code> les lignes · <code>-c</code> les octets · <code>-w</code> les mots'],
    ['<code>find</code>', 'Chercher des <strong>fichiers</strong> dans l’arborescence.', '<code>-name \'*.conf\'</code> · <code>-type f</code> · <code>-mtime -2</code> · <code>-size +100M</code>'],
    ['<code>grep</code>', 'Chercher du <strong>texte</strong> dans des fichiers.', '<code>-rn</code> récursif + numéro de ligne · <code>-i</code> ignorer la casse · <code>-v</code> l’inverse'],
    ['<code>split</code>', 'Découper un gros fichier en morceaux.', '<code>-b 100M</code> par taille · <code>-l 1000</code> par nombre de lignes'],
    ['<code>rm</code>', 'Supprimer. <strong>Définitivement.</strong>', '<code>-r</code> récursif · <code>-i</code> demander · <code>-f</code> ne rien demander'],
  ]),
  note('red', '🚫 Les trois pièges de ce tableau', '<ul><li><strong><code>cp</code> et <code>mv</code> écrasent sans prévenir.</strong> <code>cp a b</code> détruit <code>b</code> s’il existait, sans un mot. L’option <code>-i</code> fait demander confirmation — beaucoup l’activent par un alias permanent.</li><li><strong><code>rm</code> n’a pas de corbeille.</strong> Ce qui est supprimé l’est. Avant un <code>rm</code> avec joker, on remplace <code>rm</code> par <code>ls</code> pour voir ce qui va disparaître.</li><li><strong><code>cp -r</code> n’est pas <code>cp -a</code>.</strong> Le premier copie le contenu en perdant droits, dates et liens ; le second préserve tout. Sur des données serveur, <code>-a</code> presque toujours.</li></ul>'),
  note('blue', '💡 <code>mv</code> fait deux choses avec une seule commande', '<p>« Déplacer » et « renommer » sont la même opération : on change le nom <em>ou</em> l’emplacement d’une entrée dans un dossier. <code>mv vieux nouveau</code> renomme, <code>mv fichier /autre/dossier/</code> déplace, <code>mv fichier /autre/dossier/nouveau-nom</code> fait les deux. Il n’existe pas de commande <code>rename</code> de base — c’est <code>mv</code>.</p>'),
  note('gray', '💡 <code>man</code> a des sections numérotées', '<p><code>man passwd</code> décrit la <em>commande</em> ; <code>man 5 passwd</code> décrit le <em>fichier</em> <code>/etc/passwd</code>. Section 1 = commandes, 5 = formats de fichiers, 8 = administration. Quand une recherche ne donne pas ce qu’on attend, c’est souvent qu’on est tombé dans la mauvaise section.</p>'),

  block('heading', { level: 2, text: 'Repères — les dossiers' }),
  table(['Commande', 'À quoi elle sert', 'À savoir'], [
    ['<code>mkdir</code>', 'Créer un dossier.', 'Échoue si le parent n’existe pas.'],
    ['<code>mkdir -p</code>', 'Créer <strong>toute la chaîne</strong> de parents manquants.', 'Ne proteste pas si le dossier existe déjà — donc utilisable dans un script sans le faire échouer.'],
    ['<code>cp -R</code>', 'Copier un dossier et tout ce qu’il contient.', '<code>-R</code> et <code>-r</code> sont équivalents ici. Préférer <code>-a</code>, qui ajoute la préservation.'],
    ['<code>mv</code>', 'Déplacer ou renommer un dossier.', 'Pas besoin d’option récursive : le dossier entier suit.'],
    ['<code>rm -R</code>', 'Supprimer un dossier et son contenu.', '<strong>Aucune confirmation.</strong> C’est la commande la plus dangereuse du TP.'],
    ['<code>rmdir</code>', 'Supprimer un dossier <strong>vide uniquement</strong>.', 'Refuse s’il reste quoi que ce soit — et c’est une sécurité, pas une limitation.'],
  ]),
  note('green', '🎯 <code>rmdir</code> mérite mieux que sa réputation', '<p>On le trouve inutile parce qu’il refuse les dossiers non vides. C’est exactement son intérêt : <strong>il ne peut pas détruire par erreur</strong>. Quand on veut juste retirer un dossier qu’on croit vide, <code>rmdir</code> confirme qu’il l’était — là où <code>rm -r</code> aurait emporté ce qui restait sans rien dire.</p>'),
  note('yellow', '⚠️ La barre finale change le sens de <code>cp</code> et <code>rsync</code>', '<p><code>cp -a /src /dst</code> place <em>le dossier</em> <code>src</code> dans <code>dst</code>. <code>cp -a /src/. /dst</code> copie <em>son contenu</em>. C’est une source d’arborescences doublées (<code>/dst/src/src</code>) qu’on ne comprend qu’après coup.</p>'),

  block('heading', { level: 2, text: 'S’entraîner sans rien casser' }),
  sh(`mkdir -p ~/essai/{a,b,c}     # un bac a sable, hors des dossiers systeme
cd ~/essai
touch a/fichier1 a/fichier2 b/note.txt
tree                           # voir ce qu'on vient de creer

cp -a a/ copie-de-a/           # copier un dossier entier
mv b/note.txt c/               # deplacer
mv c/note.txt c/memo.txt       # renommer : la meme commande
ls -R                          # tout revoir

rm -r ~/essai                  # et on efface le bac a sable`),
  note('blue', '💡 Toujours s’exercer dans sa maison', '<p><code>~/essai</code> n’appartient qu’à toi : une erreur n’y casse rien du système. Les commandes de ce TP se comportent exactement pareil ailleurs — mais ailleurs, <code>rm -r</code> a des conséquences.</p>'),

  note('green', '🔗 Les cours qui couvrent ce TP', '<p><a href="/pages/linux-commandes-base">Commandes de base</a> — chemins, métacaractères, tubes et redirections · <a href="/pages/repertoire-commandes">Répertoire des commandes</a>, qu’on interroge en français · <a href="/pages/linux-droits">Droits et sudo</a> · <a href="/pages/linux-bases">Les bases</a></p>'),
];

publier(PAGE, blocks).catch(e => { console.error(e); process.exit(1); });

/* Cours « Archivage et compression » (Linux), d'après le support 1.12.1.
   Deux gestes que tout le monde confond parce que Windows les fusionne dans
   « dossier compressé » : réunir, et réduire. Sous Linux ce sont deux outils
   distincts — et c'est ce qui explique la forme des options de tar.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-linux-archivage.ts */
import { block, note, sh, flow, table, styleLinux, publier } from './_cours-linux';
import type { PageBlock } from '../client/src/lib/page-blocks';

const PAGE = {
  slug: 'linux-archivage',
  title: 'Linux : archivage et compression',
  excerpt: 'Réunir des fichiers avec tar, réduire leur taille avec gzip — et pourquoi ce sont deux gestes distincts sous Linux là où Windows n’en montre qu’un. Options de tar, pièges de gzip et du suffixe .gz, lecture d’un fichier compressé sans le décompresser, et échange avec Windows via zip.',
};

const blocks: PageBlock[] = [
  block('hero', {
    eyebrow: 'Cours · Linux',
    title: PAGE.title,
    subtitle: 'Réunir, puis réduire — deux gestes, deux outils.',
  }),
  styleLinux,

  block('heading', { level: 2, text: '1) Archiver n’est pas compresser' }),
  block('html', { html: '<p>C’est la distinction que Windows efface. Un « dossier compressé » <code>.zip</code> fait les deux d’un coup, et l’on finit par croire que c’est la même opération. Sous Linux, ce sont deux outils :</p>' }),
  flow(`ARCHIVER = reunir plusieurs fichiers en un seul

   doc1  doc2  doc3   -->   doc.tar
                            (un seul fichier, meme taille totale)

COMPRESSER = reduire la taille

   doc.tar            -->   doc.tar.gz
                            (un seul fichier, PLUS PETIT)`),
  table(['', 'Archiver', 'Compresser'], [
    ['Ce que ça fait', 'Réunit plusieurs fichiers en un seul.', 'Réduit la taille d’<strong>un</strong> fichier.'],
    ['La taille', '<strong>Ne change pas</strong> (elle augmente même un peu).', 'Diminue.'],
    ['L’outil', '<strong><code>tar</code></strong>', '<strong><code>gzip</code></strong> (ou <code>bzip2</code>, <code>xz</code>)'],
    ['Combien de fichiers ?', 'Autant qu’on veut → un seul.', '<strong>Un seul</strong> → un seul.'],
  ]),
  note('green', '🎯 Pourquoi cet ordre, et pas l’inverse', '<p><code>gzip</code> ne sait traiter qu’<strong>un</strong> fichier à la fois. Pour compresser un dossier entier, il faut donc d’abord en faire <strong>un seul fichier</strong> — c’est le rôle de <code>tar</code>.</p><p>D’où <code>.tar.gz</code>, qui se lit de gauche à droite : <em>d’abord archivé, ensuite compressé</em>. Et d’où l’ordre inverse à la sortie : on décompresse, puis on extrait.</p>'),
  note('blue', '💡 Compresser après avoir réuni compresse mieux', '<p>Ce n’est pas qu’une contrainte technique. Un compresseur trouve les répétitions ; sur un seul gros fichier contenant cent fichiers similaires, il en trouve <strong>beaucoup plus</strong> que sur cent fichiers traités séparément.</p><p>C’est exactement pour cela qu’un <code>.tar.gz</code> de cent fichiers texte est souvent plus petit qu’un <code>.zip</code> des mêmes fichiers, où chacun est compressé dans son coin.</p>'),

  block('heading', { level: 2, text: '2) tar : réunir' }),
  sh(`tar -cf doc.tar doc1 doc2 doc3     # creer l'archive doc.tar avec 3 fichiers
tar -cvf doc.tar doc1 doc2 doc3    # ... en affichant ce qui se passe
tar -cf doc.tar mon_dossier/       # bien plus simple : archiver UN DOSSIER`),
  table(['Option', 'Nom', 'Ce qu’elle fait'], [
    ['<code>-c</code>', '<em>create</em>', '<strong>Créer</strong> une archive.'],
    ['<code>-x</code>', '<em>extract</em>', '<strong>Extraire</strong> le contenu.'],
    ['<code>-t</code>', '<em>list</em>', '<strong>Lister</strong> le contenu, sans rien extraire.'],
    ['<code>-r</code>', '<em>append</em>', '<strong>Ajouter</strong> un fichier à une archive existante.'],
    ['<strong><code>-f</code></strong>', '<em>file</em>', '<strong>Le nom de l’archive suit.</strong> Presque toujours nécessaire.'],
    ['<code>-v</code>', '<em>verbose</em>', 'Afficher ce qui est traité. Facultatif, mais rassurant.'],
    ['<code>-z</code>', '<em>gzip</em>', 'Compresser (ou décompresser) au passage avec gzip.'],
    ['<code>-C</code>', '<em>directory</em>', 'Se placer dans ce dossier avant d’agir.'],
  ]),
  note('red', '🚫 <code>-c</code>, <code>-x</code> et <code>-t</code> s’excluent', '<p>Ce sont les trois <strong>verbes</strong> de <code>tar</code> : créer, extraire, lister. On en met exactement un. Les autres options sont des adverbes qui s’ajoutent.</p><p>Et <code>-f</code> doit être <strong>en dernier</strong> parmi les options groupées, puisque c’est lui qui annonce le nom de fichier : <code>-cvf</code> et non <code>-cfv</code>, qui prendrait <code>v</code> pour le nom de l’archive.</p>'),
  note('yellow', '⚠️ <code>.tar</code> n’est pas une extension', '<p>Linux n’utilise pas d’extensions : le point est un caractère comme un autre. <code>tar -cf doc doc1 doc2</code> fonctionne parfaitement et produit un fichier nommé <code>doc</code> — rien, dans un <code>ls</code>, ne dira que c’est une archive.</p><p><strong>C’est une convention, pas une règle</strong> : on écrit <code>doc.tar</code> pour se repérer, et parce que le shell colore alors le nom en rouge. La commande qui dit la vérité sur un fichier est <code>file</code> :</p><div class="lx-cmd">file doc\n#   doc: POSIX tar archive (GNU)</div>'),

  block('heading', { level: 3, text: 'Regarder sans extraire' }),
  sh(`tar -tf doc.tar        # la liste des fichiers
tar -tvf doc.tar       # ... avec droits, proprietaire, taille et date`),
  note('green', '🎯 Toujours lister avant d’extraire', '<p>Deux secondes, et l’on sait ce qui va être écrit et <strong>où</strong>. C’est ce qui évite la mauvaise surprise ci-dessous.</p>'),

  block('heading', { level: 3, text: 'Extraire — et le piège du dossier courant' }),
  sh(`tar -xvf doc.tar               # extrait DANS LE DOSSIER OU L'ON SE TROUVE
mkdir extraction
tar -xvf doc.tar -C extraction/   # extrait dans le dossier indique`),
  note('red', '🚫 Les fichiers atterrissent là où tu es', '<p><code>tar -xf</code> déverse le contenu dans le <strong>dossier courant</strong>. Avec trois fichiers, c’est anodin. Avec cent, ils se mélangent à tout ce qui s’y trouvait déjà, sans moyen simple de faire le tri après coup.</p><p>Deux réflexes :</p><ul><li><code>tar -tf</code> d’abord, pour voir si l’archive contient un dossier ou des fichiers en vrac ;</li><li><strong>extraire dans un dossier neuf</strong>, avec <code>-C</code>.</li></ul><p>Une archive dont le contenu n’est pas rangé dans un dossier s’appelle une <em>tar bomb</em> — et de ce point de vue, un <code>.zip</code> se comporte pareil.</p>'),
  note('blue', '💡 Bien archiver, c’est archiver un dossier', '<p>Plutôt que <code>tar -cf doc.tar doc1 doc2 doc3</code>, mettre les fichiers dans un dossier et archiver <strong>le dossier</strong> : <code>tar -cf doc.tar doc/</code>. C’est plus court à écrire, et surtout l’extraction recrée le dossier au lieu de tout éparpiller.</p>'),

  block('heading', { level: 3, text: 'Ajouter un fichier oublié' }),
  sh(`tar -rvf doc.tar doc4     # ajoute doc4 a l'archive existante`),
  note('yellow', '⚠️ <code>-r</code> ne marche pas sur une archive compressée', '<p><code>tar -rvf doc.tar.gz doc4</code> échoue : <em>« Cannot update compressed archives »</em>. On ne peut pas insérer proprement dans un flux compressé.</p><p>Il faut décompresser, ajouter, recompresser :</p><div class="lx-cmd">gunzip doc.tar.gz\ntar -rvf doc.tar doc4\ngzip doc.tar</div><p>C’est une des rares choses que le <code>.zip</code> fait mieux : chaque fichier y étant compressé séparément, on peut en ajouter un sans toucher aux autres.</p>'),

  block('heading', { level: 2, text: '3) gzip : réduire' }),
  sh(`gzip doc.tar          # -> doc.tar.gz    (l'original DISPARAIT)
gunzip doc.tar.gz     # -> doc.tar       (le .gz disparait a son tour)

gzip -k doc.tar       # -k : GARDER l'original
gzip -9 doc.tar       # compression maximale, plus lente
gzip -l doc.tar.gz    # taux de compression obtenu`),
  note('yellow', '⚠️ <code>gzip</code> remplace le fichier', '<p>Contrairement à un logiciel d’archivage graphique, <code>gzip</code> ne crée pas une copie à côté : il <strong>transforme</strong> le fichier et supprime l’original. C’est surprenant la première fois. L’option <code>-k</code> (<em>keep</em>) conserve les deux.</p>'),
  note('red', '🚫 <code>gunzip</code> exige le suffixe <code>.gz</code> dans le NOM', '<p>Renommer <code>doc.tar.gz</code> en <code>doc.tar</code> ne le décompresse pas : le contenu reste compressé. Mais au moment de le décompresser :</p><div class="lx-cmd">gunzip doc.tar\n#   gzip: doc.tar: unknown suffix -- ignored</div><p>Il refuse, parce qu’il se fie <strong>au nom</strong> pour décider. Le contenu, lui, porte bien une signature reconnaissable — c’est pourquoi <code>file</code> l’identifie sans hésiter :</p><div class="lx-cmd">file doc.tar\n#   doc.tar: gzip compressed data\n\nmv doc.tar doc.tar.gz     # remettre le suffixe, et tout rentre dans l\'ordre\ngunzip -c doc.tar > doc   # ou forcer, en ecrivant la sortie ailleurs</div><p><strong>Ne renomme pas une archive compressée</strong> — le suffixe n’est pas décoratif ici, il est fonctionnel.</p>'),

  block('heading', { level: 2, text: '4) Les deux en une seule commande' }),
  sh(`tar -zcvf doc.tar.gz doc/     # archiver ET compresser
tar -zxvf doc.tar.gz          # decompresser ET extraire
tar -ztf doc.tar.gz           # lister une archive COMPRESSEE`),
  flow(` tar -z c v f  doc.tar.gz  doc/
      |  | | |       |        |
      |  | | |       |        +-- ce qu'on archive
      |  | | |       +-- le nom de l'archive
      |  | | +-- f : « le nom suit »
      |  | +-- v : montre ce que tu fais
      |  +-- c : creer   (x pour extraire, t pour lister)
      +-- z : avec gzip`),
  note('red', '🚫 Le <code>-t</code> seul ne lit pas une archive compressée', '<p><code>tar -tf doc.tar.gz</code> échoue avec <em>« This does not look like a tar archive »</em> — et c’est logique : <code>tar</code> regarde un flux compressé qu’il ne comprend pas. Il faut <strong><code>-ztf</code></strong>.</p>'),
  note('green', '🎯 Nommer l’archive <code>.tar.gz</code> quand on utilise <code>-z</code>', '<p><code>tar -zcvf doc doc/</code> fonctionne et produit un fichier compressé nommé <code>doc</code> — mais <code>gunzip</code> refusera de le décompresser, faute de suffixe. <strong>Avec <code>-z</code>, écris <code>.tar.gz</code>.</strong></p>'),
  note('blue', '💡 Sur les tar récents, <code>-z</code> est inutile à l’extraction', '<p>GNU tar reconnaît tout seul le type de compression : <code>tar -xvf archive.tar.gz</code>, <code>tar -xvf archive.tar.bz2</code> et <code>tar -xvf archive.tar.xz</code> fonctionnent sans rien préciser.</p><p><strong>À la création, en revanche, il faut le dire</strong> — tar ne peut pas deviner ce qu’on veut. Retiens donc <code>-z</code> pour créer ; à l’extraction, <code>tar -xvf</code> suffit presque toujours.</p>'),
  table(['Compresseur', 'Option de tar', 'Suffixe', 'Compromis'], [
    ['<strong><code>gzip</code></strong>', '<code>-z</code>', '<code>.tar.gz</code>', '<strong>Le standard.</strong> Rapide, présent partout.'],
    ['<code>bzip2</code>', '<code>-j</code>', '<code>.tar.bz2</code>', 'Un peu plus petit, nettement plus lent.'],
    ['<code>xz</code>', '<code>-J</code>', '<code>.tar.xz</code>', 'Le plus petit, le plus lent. Utilisé pour les sources et les paquets.'],
  ]),

  block('heading', { level: 2, text: '5) Lire sans décompresser' }),
  block('html', { html: '<p><code>gzip</code> s’applique aussi à un fichier ordinaire — pas seulement à une archive. Mais un <code>cat</code> sur un fichier compressé n’affiche qu’un charabia binaire.</p>' }),
  sh(`gzip doc1              # -> doc1.gz
cat doc1.gz            # illisible : c'est du binaire

zcat doc1.gz           # AFFICHE le contenu, sans decompresser le fichier
zless doc1.gz          # le parcourir page par page
zgrep erreur doc1.gz   # y CHERCHER un motif`),
  note('green', '🎯 <code>zgrep</code> sur les journaux archivés : le vrai cas d’usage', '<p><code>/var/log</code> conserve les journaux anciens compressés — <code>syslog.2.gz</code>, <code>auth.log.3.gz</code>. Chercher un incident d’il y a une semaine ne demande pas de les décompresser :</p><div class="lx-cmd">zgrep "Failed password" /var/log/auth.log.*.gz</div><p>C’est un réflexe de dépannage, pas une curiosité.</p>'),

  block('heading', { level: 2, text: '6) Échanger avec Windows : zip' }),
  block('html', { html: '<p><code>.tar.gz</code> est l’usage sous Linux ; <code>.zip</code> celui de Windows. Les outils existent des deux côtés, mais <strong>ne sont pas installés par défaut sur une Debian minimale</strong> :</p>' }),
  sh(`sudo apt install zip unzip

unzip -l revisions.zip           # LISTER sans extraire
unzip revisions.zip              # extraire dans le dossier courant
unzip revisions.zip -d cible/    # extraire dans un dossier precis

zip -r revisions.zip revisions/  # creer : -r est INDISPENSABLE`),
  note('red', '🚫 <code>zip</code> sans <code>-r</code> produit une archive vide', '<p><code>zip archive.zip mon_dossier/</code> enregistre <strong>le dossier lui-même, et rien de ce qu’il contient</strong>. L’archive fait quelques centaines d’octets et paraît normale — l’erreur ne se voit qu’à l’ouverture.</p><p><strong>Avec un dossier, toujours <code>-r</code></strong> (récursif). C’est l’inverse de <code>tar</code>, qui descend dans les dossiers sans qu’on le demande.</p>'),
  table(['', '<code>tar</code> + <code>gzip</code>', '<code>zip</code>'], [
    ['Récursif', '<strong>Par défaut.</strong>', '<strong>Seulement avec <code>-r</code>.</strong>'],
    ['Compression', 'De l’archive entière → meilleur taux.', 'Fichier par fichier → moins bon, mais…'],
    ['Ajouter / retirer un fichier', 'Impossible sur une archive compressée.', '<strong>Possible</strong>, sans toucher au reste.'],
    ['Droits et propriétaires Unix', '<strong>Conservés.</strong>', 'Perdus.'],
    ['Lu par Windows sans rien installer', 'Non.', '<strong>Oui.</strong>'],
  ]),
  note('yellow', '⚠️ Passer par un <code>.zip</code> perd les droits', '<p>Pour une sauvegarde de serveur, c’est rédhibitoire : à la restauration, propriétaires et permissions sont à refaire. <strong><code>tar</code> les conserve</strong> — c’est même sa raison d’être (<em>tape archive</em>, à l’origine pour les sauvegardes sur bande).</p><p>Règle simple : <strong><code>.zip</code> pour échanger avec Windows, <code>.tar.gz</code> pour tout le reste.</strong></p>'),

  block('heading', { level: 2, text: '7) Le mémo' }),
  flow(`CREER            tar -zcvf archive.tar.gz dossier/
LISTER           tar -ztf  archive.tar.gz
EXTRAIRE         tar -zxvf archive.tar.gz -C destination/
AJOUTER          tar -rvf  archive.tar fichier      (non compressee seulement)

COMPRESSER un fichier      gzip -k fichier
DECOMPRESSER               gunzip fichier.gz
LIRE sans decompresser     zcat / zless / zgrep

ZIP              zip -r archive.zip dossier/
                 unzip -l archive.zip        (lister)
                 unzip archive.zip -d cible/ (extraire)`),
  note('green', '🎯 Le moyen mnémotechnique', '<p><strong>Créer</strong> : <code>-zcvf</code> — « <em>ze compresse, vois le fichier</em> ». <strong>Extraire</strong> : <code>-zxvf</code> — le <code>c</code> devient <code>x</code>. C’est la seule lettre qui change entre les deux commandes qu’on tape le plus souvent.</p>'),

  note('blue', '🔗 Les pages liées', '<p><a href="/pages/tp-archivage">TP — Archivage et compression</a> · <a href="/pages/linux-commandes-base">Commandes de base</a> — métacaractères et redirections · <a href="/pages/linux-droits">Droits</a> — ce que <code>tar</code> conserve · <a href="/pages/linux-disques">Disques et espace</a> · <a href="/pages/repertoire-commandes">Répertoire des commandes</a></p>'),
];

publier(PAGE, blocks).catch(e => { console.error(e); process.exit(1); });

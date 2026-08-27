/* TP 1.12.2 — Archivage et compression de fichiers.
   TP guidé de 20 manipulations sur une arborescence à construire, qui se
   termine par un aller-retour Windows ↔ Linux via le panneau SFTP de
   MobaXterm. Les repères portent sur les quatre commandes qui échouent
   quand on suit l'énoncé au pied de la lettre.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-tp-archivage.ts */
import { block, note, sh, flow, table, styleLinux, publier } from './_cours-linux';
import type { PageBlock } from '../client/src/lib/page-blocks';

const PAGE = {
  slug: 'tp-archivage',
  title: 'TP — Archivage et compression',
  excerpt: 'Vingt manipulations de tar, gzip et zip sur une arborescence de cours, puis un aller-retour Windows ↔ Linux par le panneau SFTP de MobaXterm. Avec les quatre commandes qui échouent si on suit l’énoncé littéralement — dont lire une archive compressée et lire un fichier .gz.',
};

const blocks: PageBlock[] = [
  block('hero', {
    eyebrow: 'TP · Linux',
    title: 'Archivage et compression',
    subtitle: 'Réunir, réduire, transférer — et faire l’aller-retour avec Windows.',
  }),
  styleLinux,

  note('blue', '🎯 Objectif et matériel', '<p>Connaître et savoir utiliser les différentes méthodes d’archivage et de compression.</p><p><strong>Matériel :</strong> la machine Linux configurée et <strong>promue en serveur SSH</strong>, plus la machine physique Windows.</p><p><strong>Le cours qui va avec :</strong> <a href="/pages/linux-archivage">Archivage et compression</a>.</p>'),

  block('heading', { level: 2, text: '1) Construire l’arborescence' }),
  block('html', { html: '<p>Dans le dossier personnel, créer l’arborescence ci-dessous. <strong>Écrire quelques mots dans chaque fichier</strong> pour qu’ils ne soient pas vides — un fichier vide se compresse mal et rend les vérifications trompeuses.</p>' }),
  flow(`~/
├── cours/
│   ├── anglais/
│   ├── linux/
│   │   └── segmentation
│   └── windows/
│       ├── ad
│       └── dns
└── reseaux/`),
  note('gray', '💡 Le squelette en une commande', '<p><code>mkdir -p</code> crée toute la chaîne de parents manquants — inutile de descendre niveau par niveau. Et les accolades évitent de répéter le chemin.</p><div class="lx-cmd">mkdir -p ~/cours/{anglais,linux,windows} ~/reseaux\necho "notions de segmentation" > ~/cours/linux/segmentation\necho "active directory"       > ~/cours/windows/ad\necho "resolution de noms"     > ~/cours/windows/dns\ntree ~</div>'),

  block('heading', { level: 2, text: '2) Les manipulations' }),
  block('html', { html: '<ol><li>Compresser le fichier <code>ad</code>.</li><li>Dans le dossier personnel, créer une archive du dossier <code>reseaux</code>.</li><li>Dans <code>cours</code>, créer une archive du dossier <code>anglais</code>.</li><li>Dans <code>cours</code>, <strong>archiver et compresser en une seule commande</strong> le dossier <code>linux</code>.</li><li>Dans <code>cours</code>, créer une archive du dossier <code>windows</code>.</li><li>Créer le fichier <code>motivation-letter</code> dans le dossier <code>anglais</code>.</li><li><strong>Ajouter</strong> ce nouveau document à l’archive <code>anglais.tar</code> déjà créée.</li><li>Regarder le contenu de l’archive du dossier <code>anglais</code>.</li><li>Compresser l’archive du dossier <code>windows</code>.</li><li>Copier l’archive compressée du dossier <code>linux</code> à la racine du dossier personnel.</li><li>La décompresser, puis en extraire les fichiers — toujours à la racine du dossier personnel.</li><li>Afficher le contenu du fichier <code>segmentation</code>.</li><li>Afficher le contenu du fichier <code>dns</code> présent dans <code>windows.tar.gz</code>.</li><li>Afficher le contenu du fichier <code>ad.gz</code> présent dans le dossier <code>windows</code>.</li><li>Installer les commandes <code>zip</code> et <code>unzip</code>.</li></ol>' }),

  block('heading', { level: 2, text: '3) L’aller-retour avec Windows' }),
  block('html', { html: '<ol start="16"><li>Sur la machine Windows, créer un dossier <code>revisions</code> contenant les documents <code>windows</code>, <code>reseaux</code> et <code>linux</code>. Y écrire quelques mots.</li><li>En faire une archive <strong><code>.zip</code></strong>.</li><li>Installer et lancer <strong>MobaXterm</strong>. Créer une session SSH vers la machine Linux, se connecter.</li><li>Dans le panneau de gauche, se placer dans <code>cours</code> et <strong>y faire glisser</strong> <code>revisions.zip</code> depuis Windows. Vérifier qu’elle est bien arrivée.</li><li>Chercher dans les manuels de <code>zip</code> et <code>unzip</code> comment <strong>lister</strong> le contenu de <code>revisions.zip</code>.</li><li>La décompresser dans le dossier <code>cours</code>. Vérifier.</li><li>Créer une archive <code>.zip</code> du dossier <code>linux</code> et de ses fichiers.</li></ol>' }),
  note('blue', '💡 Pourquoi MobaXterm et pas PuTTY, ici', '<p>MobaXterm ouvre automatiquement un panneau <strong>SFTP</strong> à gauche du terminal — on y glisse un fichier au lieu de taper une commande. PuTTY n’a pas cet équivalent.</p><p>Ce n’est pas de la magie : c’est du SFTP transporté par <strong>la même session SSH</strong>, donc chiffré, sur le même port. → <a href="/pages/linux-ssh">le cours SSH</a>.</p>'),
  block('html', { html: '<p><strong>Pour finir :</strong> tester la compatibilité entre les fichiers des deux systèmes. Ajouter des « extensions » sous Linux, écrire dans les documents depuis Windows, et inversement.</p>' }),

  note('yellow', '⏸️ Fais le TP d’abord', '<p>Ce qui suit explique les quatre commandes qui échouent quand on suit l’énoncé au pied de la lettre. Les rencontrer soi-même vaut mieux que les lire.</p>'),

  block('heading', { level: 2, text: 'Repères — les quatre commandes qui échouent' }),

  note('red', '🚫 1. Étape 13 — lire un fichier <em>dans</em> une archive compressée', '<p>« Afficher le contenu du fichier <code>dns</code> présent dans <code>windows.tar.gz</code> ». Le réflexe est <code>tar -tf</code>, et il échoue :</p><div class="lx-cmd">tar -tf windows.tar.gz\n#   tar: This does not look like a tar archive</div><p><strong>Il manque le <code>-z</code></strong> : sans lui, tar regarde un flux compressé qu’il ne sait pas lire. Et « afficher le contenu » demande plus que lister — il faut extraire ce seul fichier vers la sortie :</p><div class="lx-cmd">tar -ztf windows.tar.gz              # LISTER ce qu\'elle contient\ntar -zxOf windows.tar.gz windows/dns  # AFFICHER un fichier, sans rien ecrire sur le disque</div><p>Le <code>-O</code> majuscule envoie le fichier extrait <strong>sur la sortie standard</strong> au lieu du disque. Et le chemin doit être écrit <strong>exactement comme il apparaît dans la liste</strong> — d’où le <code>-ztf</code> d’abord.</p>'),

  note('red', '🚫 2. Étape 14 — lire un fichier <code>.gz</code>', '<p>« Afficher le contenu du fichier <code>ad.gz</code> ». Un <code>cat</code> donne un charabia binaire, et peut dérégler l’affichage du terminal.</p><div class="lx-cmd">cat ad.gz      # illisible — si le terminal devient bizarre, taper « reset »\nzcat ad.gz     # LA bonne commande\nzless ad.gz    # pour un fichier long</div><p><code>zcat</code> décompresse <strong>à la volée</strong> et affiche : le fichier <code>.gz</code> reste intact sur le disque.</p>'),

  note('red', '🚫 3. Étape 7 — ajouter dans une archive… non compressée', '<p>« Ajouter <code>motivation-letter</code> à l’archive <code>anglais.tar</code> » fonctionne, parce qu’<code>anglais.tar</code> <strong>n’est pas compressée</strong> :</p><div class="lx-cmd">tar -rvf anglais.tar cours/anglais/motivation-letter</div><p>Mais si tu avais compressé l’archive avant, la même commande échouerait :</p><div class="lx-cmd">tar -rvf anglais.tar.gz fichier\n#   tar: Cannot update compressed archives</div><p>C’est pour cela que l’énoncé fait créer <code>anglais</code> en <code>.tar</code> simple à l’étape 3, et <code>linux</code> en <code>.tar.gz</code> à l’étape 4. <strong>L’ordre des questions n’est pas innocent.</strong></p>'),

  note('red', '🚫 4. Étape 22 — <code>zip</code> sans <code>-r</code> produit une archive vide', '<p>« Créer une archive <code>.zip</code> du dossier <code>linux</code> <strong>et de ses fichiers</strong> » — le « et de ses fichiers » est l’avertissement.</p><div class="lx-cmd">zip linux.zip cours/linux/       # enregistre le DOSSIER, et rien dedans\nzip -r linux.zip cours/linux/    # correct</div><p>L’archive fautive fait quelques centaines d’octets et paraît normale : l’erreur ne se voit qu’à l’ouverture. <strong>C’est l’inverse de <code>tar</code></strong>, qui descend dans les dossiers sans qu’on le demande.</p>'),

  block('heading', { level: 2, text: 'Repères — le déroulé, étape par étape' }),
  sh(`# 1  compresser un simple fichier
gzip ~/cours/windows/ad                  # -> ad.gz, l'original disparait

# 2  archiver un dossier, depuis le dossier personnel
cd ~ && tar -cvf reseaux.tar reseaux/

# 3  une archive NON compressee (on y ajoutera un fichier plus tard)
cd ~/cours && tar -cvf anglais.tar anglais/

# 4  archiver ET compresser, en une commande
tar -zcvf linux.tar.gz linux/

# 5  archive simple du dossier windows
tar -cvf windows.tar windows/`),
  sh(`# 6-7  creer un fichier, puis l'AJOUTER a l'archive existante
touch anglais/motivation-letter
echo "candidature" > anglais/motivation-letter
tar -rvf anglais.tar anglais/motivation-letter

# 8  verifier qu'il y est
tar -tvf anglais.tar

# 9  compresser une archive deja creee
gzip windows.tar                         # -> windows.tar.gz`),
  sh(`# 10-11  copier, decompresser, extraire
cp ~/cours/linux.tar.gz ~/
cd ~
gunzip linux.tar.gz                      # -> linux.tar
tar -xvf linux.tar                       # extrait le dossier linux/

# 12  afficher un fichier ordinaire
cat ~/linux/segmentation

# 13  afficher un fichier DANS une archive compressee
tar -ztf ~/cours/windows.tar.gz          # d'abord voir le chemin exact
tar -zxOf ~/cours/windows.tar.gz windows/dns

# 14  afficher un fichier .gz
zcat ~/cours/windows/ad.gz

# 15  installer les outils zip
sudo apt install zip unzip`),
  note('green', '🎯 Étapes 10-11 : la version en une commande', '<p><code>gunzip</code> puis <code>tar -xvf</code> font le travail en deux temps, et c’est formateur. Mais <code>tar</code> sait faire les deux :</p><div class="lx-cmd">tar -zxvf linux.tar.gz</div><p>Une seule lettre change par rapport à la création : le <code>c</code> devient <code>x</code>.</p>'),

  block('heading', { level: 2, text: 'Repères — la partie Windows' }),
  sh(`# 20  lister sans extraire — c'est ce que « man unzip » donne
unzip -l revisions.zip

# 21  extraire dans le dossier courant, ou ailleurs
cd ~/cours && unzip revisions.zip
unzip revisions.zip -d ~/cours/          # equivalent, depuis n'importe ou

# 22  creer un zip — le -r est indispensable
zip -r linux.zip linux/
unzip -l linux.zip                       # verifier qu'il n'est pas vide`),
  note('blue', '💡 Étape 20 : la réponse est dans <code>man unzip</code>', '<p>L’énoncé demande de chercher dans le manuel — c’est l’exercice. La section utile est en haut de la page :</p><div class="lx-cmd">man unzip\n/  -l                    # chercher « -l » dans le manuel\nunzip -l archive.zip     # liste\nunzip -v archive.zip     # liste + taux de compression\nunzip -t archive.zip     # tester l\'integrite sans extraire</div>'),

  block('heading', { level: 2, text: 'Repères — le test de compatibilité final' }),
  block('html', { html: '<p>La dernière consigne — ajouter des « extensions » sous Linux, écrire depuis Windows, et inversement — met en évidence trois différences réelles.</p>' }),
  table(['Ce qu’on observe', 'Pourquoi'], [
    ['Renommer <code>segmentation</code> en <code>segmentation.txt</code> ne change <strong>rien</strong> sous Linux', 'Le point est un caractère ordinaire. Le type est déterminé par le <strong>contenu</strong> (<code>file</code>), jamais par le nom.'],
    ['Le même fichier s’ouvre alors <strong>au double-clic</strong> sous Windows', 'Windows, lui, choisit le programme <strong>d’après l’extension</strong>. Sans elle, il ne sait pas quoi en faire.'],
    ['Un fichier écrit sous Windows affiche parfois des <code>^M</code> en fin de ligne sous Linux', 'Fin de ligne <strong>CRLF</strong> côté Windows, <strong>LF</strong> côté Linux. <code>dos2unix fichier</code> convertit.'],
    ['<code>Cours</code> et <code>cours</code> coexistent sous Linux, pas sous Windows', 'Linux <strong>distingue la casse</strong>. Une archive contenant les deux perd un fichier à l’extraction sous Windows.'],
    ['Un <code>.zip</code> ouvert sous Windows a perdu les droits Unix', 'Le format <code>zip</code> ne les transporte pas. <strong><code>tar</code> les conserve</strong> — c’est sa raison d’être.'],
  ]),
  note('green', '🎯 Ce que le TP démontre vraiment', '<p><strong><code>.zip</code> pour échanger avec Windows, <code>.tar.gz</code> pour tout le reste.</strong> Le premier est lu partout sans rien installer ; le second conserve droits, propriétaires et liens — ce qui est indispensable dès qu’on sauvegarde un serveur.</p>'),

  note('blue', '🔗 Les pages liées', '<p><a href="/pages/linux-archivage">Cours : archivage et compression</a> · <a href="/pages/linux-ssh">Cours SSH</a> — MobaXterm et son panneau SFTP · <a href="/pages/tp-manipulation-fichiers">TP : manipulation de fichiers</a> · <a href="/pages/linux-commandes-base">Commandes de base</a></p>'),
];

publier(PAGE, blocks).catch(e => { console.error(e); process.exit(1); });

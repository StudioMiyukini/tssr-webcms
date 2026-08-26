/* TP 1.8.2 — Utilisateurs.
   TP guidé, pas de recherche : l'énoncé est une suite de manipulations. Sa
   vraie leçon est à la fin — tout appartient à root — et le support la pose en
   question sans y répondre. C'est ce qui prépare le 1.8.4.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-tp-utilisateurs.ts */
import { block, note, sh, flow, table, styleLinux, publier } from './_cours-linux';
import type { PageBlock } from '../client/src/lib/page-blocks';

const PAGE = {
  slug: 'tp-utilisateurs',
  title: 'TP — Utilisateurs',
  excerpt: 'Créer, modifier et supprimer des comptes et des groupes, en vérifiant chaque geste dans /etc/passwd et /etc/group. Avec les trois surprises du TP : le compte qu’on ne peut pas ouvrir, le prompt réduit à un dollar, et la découverte finale — tout appartient à root, et c’est le sujet du TP suivant.',
};

const blocks: PageBlock[] = [
  block('hero', {
    eyebrow: 'TP · Linux',
    title: 'Utilisateurs',
    subtitle: 'Créer des comptes, les ranger dans des groupes — et vérifier dans les fichiers, à chaque fois.',
  }),
  styleLinux,

  note('blue', '🎯 Objectif', '<p>Mettre en pratique les commandes cherchées au <a href="/pages/tp-utilisateurs-recherche">TP 1.8.1</a> pour comprendre comment elles fonctionnent réellement — et surtout <strong>où elles écrivent</strong>.</p>'),
  note('gray', '📋 Méthode imposée par le support', '<ul><li>À chaque étape, <strong>vérifier</strong> que l’action a bien eu lieu : <code>ls -al</code>, ou <code>tree</code> (à installer au préalable : <code>sudo apt install tree</code>).</li><li>Noter sur le document <strong>les commandes réellement tapées</strong> — c’est ce qui en fait un exemple utilisable plus tard.</li><li>Répondre aux questions de façon justifiée, avec captures d’écran, et rendre le document au formateur.</li></ul>'),

  block('heading', { level: 2, text: 'Partie 1 — Un utilisateur : toto' }),
  block('html', { html: '<ul><li>Créer un utilisateur <code>toto</code> <strong>et son dossier personnel en une seule commande</strong> : <code>useradd -m</code>.</li><li>Un compte sans mot de passe n’est pas actif : lui en donner un.</li><li>Se connecter sur <code>toto</code> et créer dans <code>/home</code> le dossier <code>documents</code>. Dedans, un fichier <code>courssegmentation</code>.</li></ul>' }),
  block('html', { html: '<p>Puis vérifier dans les deux fichiers, ouverts avec <code>nano</code> :</p><ul><li><code>/etc/passwd</code> — <code>toto</code> y est-il ?</li><li><code>/etc/group</code> — son groupe y est-il ?</li></ul>' }),
  flow(`/etc/passwd  ->  [nom] : [mot de passe] : [n° utilisateur] : [n° de groupe] :
                  [nom complet] : [repertoire] : [programme de demarrage]

/etc/group   ->  [nom du groupe] : [mot de passe] : [GID] : [liste utilisateurs]

     exemple :   formateur : * : 400 : julien,sylvain,morgane

Le GID est le LIEN entre les deux fichiers.`),
  block('html', { html: '<p><strong>Question.</strong> En se connectant sur <code>toto</code>, le prompt est presque vide — juste un <code>$</code>. Regarder attentivement <code>/etc/passwd</code> et <strong>comparer la ligne de <code>toto</code> avec celle de son propre compte</strong>. Identifier la différence, comprendre à quoi elle correspond, l’expliquer — puis corriger, se déconnecter et se reconnecter.</p>' }),
  block('html', { html: '<p><strong>Suite.</strong> <code>toto</code> change définitivement d’ordinateur : supprimer son compte. Puis :</p><ul><li>Un <code>ls -al /home</code> : son dossier personnel existe-t-il encore ? Son nom apparaît-il dans les colonnes propriétaire ? <strong>Expliquer pourquoi.</strong></li><li>Vérifier dans <code>/etc/passwd</code> et <code>/etc/group</code> que <code>toto</code> et son groupe ont disparu. Sinon, les supprimer — ainsi que son dossier personnel.</li></ul>' }),

  block('heading', { level: 2, text: 'Partie 2 — Des groupes, et du mouvement' }),
  block('html', { html: '<p>Depuis le compte principal :</p><ul><li>Créer un groupe <code>formateurs</code>.</li><li>Créer <code>florence</code> et <code>amelie</code>, avec leurs dossiers personnels.</li><li>Vérifier — <strong>dans quel fichier ?</strong> Capture à l’appui.</li><li>Les ajouter au groupe <code>formateurs</code>. Vérifier — <strong>dans quel fichier ?</strong></li><li>Dans <code>documents</code>, créer un dossier <code>formateurs</code>.</li><li>Connecté sur <code>florence</code> : dans <code>formateurs</code>, créer un dossier <code>florence</code>, et dedans deux fichiers <code>cours</code> et <code>travaux_pratique</code>.</li><li>Même chose connecté sur <code>amelie</code>, avec un dossier <code>amelie</code>.</li></ul>' }),
  block('html', { html: '<p><strong>Florence n’est plus formatrice, elle devient coordinatrice :</strong></p><ul><li>Créer le groupe <code>coordinateurs</code>.</li><li>Sortir <code>florence</code> de <code>formateurs</code> et l’intégrer à <code>coordinateurs</code>.</li><li>Quelle commande, ou quel fichier, permet de vérifier ?</li><li>Connecté sur <code>florence</code> : dans <code>documents</code>, créer <code>coordinatrice</code>, et dedans un fichier <code>planning</code>.</li><li>Supprimer le dossier <code>florence</code> créé dans <code>formateurs</code>.</li></ul>' }),
  block('html', { html: '<p><strong>Puis :</strong></p><ul><li>Créer un groupe <code>informatique</code> et y ajouter <code>amelie</code>.</li><li>Connecté sur <code>amelie</code> : dans <code>documents</code>, créer <code>informatique</code> et dedans un fichier <code>linux</code>.</li><li><strong>Amélie quitte la société</strong> : supprimer son compte, son groupe personnel et son dossier personnel <strong>en une seule commande</strong>.</li><li><code>florence</code> souhaite changer son mot de passe. Le faire.</li></ul>' }),

  note('yellow', '❓ Les questions finales — ce sont les plus importantes', '<p>« <em>Avez-vous pu créer vos dossiers et fichiers directement depuis les utilisateurs concernés, à chaque fois ? Si oui comment ? Si non pourquoi ?</em> »</p><p>« <em>Regardez les droits sur vos différents dossiers avec un <code>ls -al</code>. Avez-vous les noms de florence ou amelie qui apparaissent en propriétaire, ou n’avez-vous que root ?</em> »</p><p>Ces deux questions ne sont pas de la vérification : elles sont <strong>le sujet réel du TP</strong>, et la raison d’être du 1.8.4.</p>'),

  note('yellow', '⏸️ Fais le TP d’abord', '<p>Ce qui suit explique les pièges. Les lire avant, c’est se priver de les rencontrer — et ce sont eux qu’on retient.</p>'),

  block('heading', { level: 2, text: 'Repères — les trois surprises' }),

  block('heading', { level: 3, text: '1. Le compte existe, mais refuse de s’ouvrir' }),
  sh(`sudo useradd -m toto
su - toto          # -> « Authentication failure », alors que le compte EXISTE`),
  block('html', { html: '<p><code>useradd</code> ne pose pas de mot de passe. Dans <code>/etc/shadow</code>, le deuxième champ vaut <code>!</code> : <strong>compte verrouillé</strong>. Il faut une seconde commande :</p>' }),
  sh(`sudo passwd toto
sudo passwd -S toto     # « P » = mot de passe pose, « L » = verrouille, « NP » = aucun`),
  note('blue', '💡 C’est là toute la différence avec <code>adduser</code>', '<p><code>sudo adduser toto</code> aurait créé le compte, le dossier, le groupe personnel <strong>et</strong> demandé le mot de passe dans la foulée. La commande de bas niveau ne fait que ce qu’on écrit — c’est sa qualité dans un script, et son inconvénient au clavier.</p>'),

  block('heading', { level: 3, text: '2. Le prompt réduit à un dollar' }),
  flow(`Compte principal :   jean@debian:~$        <- /bin/bash
Compte toto      :   $                     <- /bin/sh

Ni historique avec les fleches, ni completion avec la tabulation,
ni couleurs, ni nom de machine.`),
  block('html', { html: '<p>La différence est dans le <strong>septième et dernier champ</strong> de la ligne de <code>/etc/passwd</code> — le programme de démarrage, c’est-à-dire le <strong>shell</strong>.</p>' }),
  flow(`toto:x:1001:1001::/home/toto:/bin/sh
jean:x:1000:1000:Jean,,,:/home/jean:/bin/bash
                                     ^^^^^^^^^
                              la seule difference qui compte`),
  block('html', { html: '<p><code>useradd</code> sans <code>-s</code> prend le shell par défaut de <code>/etc/default/useradd</code>, qui vaut <code>/bin/sh</code> sur Debian. Trois façons de corriger :</p>' }),
  sh(`sudo usermod -s /bin/bash toto     # la commande dediee — elle valide
sudo chsh -s /bin/bash toto        # equivalent
sudo vipw                          # editer /etc/passwd AVEC verrou et verification`),
  note('yellow', '⚠️ La correction ne s’applique qu’à la prochaine connexion', '<p>Le shell est choisi <strong>au moment où la session s’ouvre</strong>. Il faut donc se déconnecter de <code>toto</code> et s’y reconnecter — ce que le support demande explicitement.</p><p>Si tu modifies <code>/etc/passwd</code> à la main comme le suggère le support, préfère <code>sudo vipw</code> à <code>sudo nano</code> : même fichier, mais avec un verrou et une vérification de syntaxe avant enregistrement. Une faute de frappe dans ce fichier rend un compte inutilisable.</p>'),

  block('heading', { level: 3, text: '3. Le dossier survit au compte, et affiche un nombre' }),
  flow(`AVANT :  drwxr-xr-x  2 toto  toto  4096  ... /home/toto
APRES :  drwxr-xr-x  2 1001  1001  4096  ... /home/toto
                       |     |
                       +-----+-- l'UID et le GID nus`),
  block('html', { html: '<p><strong>Réponse aux deux questions du support.</strong> Le dossier existe toujours parce que <code>deluser toto</code> ne supprime que le <em>compte</em> — c’est volontaire : les données d’une personne qui part ne doivent pas disparaître avec son badge.</p><p>Et le nom n’apparaît plus parce qu’il <strong>n’a jamais été écrit sur le fichier</strong> : le système ne stocke qu’un <strong>numéro</strong>. Le nom vient de <code>/etc/passwd</code>, consulté à l’affichage. Le compte supprimé, plus personne ne répond à « qui est 1001 ? ».</p>' }),
  sh(`sudo deluser --remove-home toto     # compte + dossier personnel
sudo userdel -r toto                 # equivalent bas niveau
sudo delgroup toto                   # si le groupe personnel subsiste

sudo find /home -nouser -o -nogroup  # lister tous les fichiers orphelins`),
  note('red', '🚫 Pourquoi les orphelins sont dangereux', '<p>Le prochain compte créé reçoit le <strong>premier UID libre</strong> — donc, très souvent, celui qu’on vient de libérer. Le nouvel arrivant hérite alors de la propriété de tous les fichiers de son prédécesseur, sans que personne ne l’ait décidé.</p>'),

  block('heading', { level: 2, text: 'Repères — vérifier ses manipulations' }),
  table(['Ce qu’on veut vérifier', 'Où regarder', 'Ou plus simplement'], [
    ['Le compte existe', '<code>/etc/passwd</code>', '<code>getent passwd florence</code>'],
    ['Le groupe existe', '<code>/etc/group</code>', '<code>getent group formateurs</code>'],
    ['Le compte a un mot de passe', '<code>/etc/shadow</code> (root)', '<code>sudo passwd -S florence</code>'],
    ['<strong>À quels groupes il appartient</strong>', 'les <strong>deux</strong> fichiers', '<strong><code>id florence</code></strong>'],
    ['Qui est dans un groupe', '<code>/etc/group</code>, 4ᵉ champ', '<code>getent group formateurs</code>'],
    ['L’arborescence créée', '—', '<code>tree /home</code> ou <code>ls -alR</code>'],
  ]),
  note('red', '🚫 Le piège de la vérification dans <code>/etc/group</code>', '<p>Le quatrième champ ne liste que les membres <strong>secondaires</strong>. Le groupe <em>principal</em> d’un utilisateur est le <strong>quatrième champ de sa ligne de <code>/etc/passwd</code></strong>, sous forme de GID — il n’apparaît nulle part dans <code>/etc/group</code>.</p><p>Chercher <code>florence</code> dans la ligne <code>florence:x:1001:</code> ne donne donc rien, et l’on conclut à tort qu’elle n’est pas dans son groupe. <strong><code>id florence</code></strong> lit les deux fichiers et donne la vraie réponse.</p>'),
  sh(`# Deplacer florence de formateurs vers coordinateurs
sudo groupadd coordinateurs
sudo gpasswd -d florence formateurs      # la RETIRER
sudo gpasswd -a florence coordinateurs   # l'AJOUTER
id florence                              # verifier`),

  block('heading', { level: 2, text: 'La vraie leçon : tout appartient à root' }),
  note('green', '🎯 La réponse aux questions finales du support', '<p>Le dossier <code>/home/documents</code> a été créé avec <code>sudo</code> — donc il appartient à <strong><code>root:root</code></strong>, en <code>755</code> : écriture pour le propriétaire seul.</p><p>Quand <code>florence</code> essaie d’y créer son dossier, elle n’est ni <code>root</code>, ni dans son groupe : il ne lui reste que les droits « autres », soit <code>r-x</code> — <strong>elle peut entrer et lire, pas écrire</strong>. Le système répond <code>Permission denied</code>.</p><p>Deux issues, et une seule a été possible :</p><ul><li>soit la commande a <strong>échoué</strong> ;</li><li>soit elle a été relancée <strong>avec <code>sudo</code></strong> — et tout ce qui a été créé appartient alors à <strong>root</strong>, pas à florence.</li></ul>'),
  flow(`$ ls -al /home/documents
drwxr-xr-x  2 root  root  4096  ... formateurs
drwxr-xr-x  2 root  root  4096  ... coordinatrice
-rw-r--r--  1 root  root     0  ... courssegmentation
              ^^^^  ^^^^
    ni florence, ni amelie : root partout`),
  note('blue', '💡 Ce n’est pas une erreur du TP — c’est sa mise en place', '<p>Le support fait volontairement construire une arborescence dont <strong>les propriétaires sont tous faux</strong>. C’est exactement la situation qu’un administrateur trouve en arrivant sur un serveur mal repris.</p><p>Le <a href="/pages/tp-utilisateurs-droits">TP 1.8.4</a> consiste à la remettre d’aplomb avec <code>chown</code>, <code>chgrp</code> et <code>chmod</code>. Il <strong>reprend cette arborescence</strong> : ne la supprime pas, et vérifie qu’elle est conforme avant de continuer.</p>'),
  note('yellow', '⚠️ Avant de passer à la suite', '<p>Le support impose un passage par <strong>1.8.3 — Cours : les droits</strong> entre les deux TP. Sur ce site, c’est <a href="/pages/linux-droits">Utilisateurs, droits et sudo</a> : sections 3 à 6 pour <code>rwx</code>, l’octal, <code>chmod</code> et <code>chown</code>.</p>'),

  note('green', '🔗 La suite', '<p><a href="/pages/tp-utilisateurs-recherche">1.8.1 — Recherche</a> · <a href="/pages/linux-droits">1.8.3 — Cours : droits</a> · <a href="/pages/tp-utilisateurs-droits">1.8.4 — TP : utilisateurs et droits</a> · <a href="/pages/tp-manipulation-fichiers">TP : manipulation de fichiers</a></p>'),
];

publier(PAGE, blocks).catch(e => { console.error(e); process.exit(1); });

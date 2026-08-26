/* TP 1.8.1 — Recherche : utilisateurs et droits.
   Même modèle que les TP 1.3.1 et 1.7.1 : l'élève cherche, les repères servent
   à vérifier après coup. La question centrale du support — pourquoi deux
   commandes pour chaque opération — a sa réponse développée dans le cours.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-tp-utilisateurs-recherche.ts */
import { block, note, sh, flow, table, styleLinux, publier } from './_cours-linux';
import type { PageBlock } from '../client/src/lib/page-blocks';

const PAGE = {
  slug: 'tp-utilisateurs-recherche',
  title: 'TP — Recherche : utilisateurs et droits',
  excerpt: 'Documenter quinze commandes et trois fichiers de gestion des comptes : à quoi ils servent, la syntaxe, trois paramètres, un exemple. Avec la réponse à la question du TP — pourquoi useradd et adduser existent tous les deux — et les repères pour vérifier son travail.',
};

const blocks: PageBlock[] = [
  block('hero', {
    eyebrow: 'TP · Linux',
    title: 'Recherche : utilisateurs et droits',
    subtitle: 'Quinze commandes, trois fichiers — et une question à laquelle il faut vraiment répondre.',
  }),
  styleLinux,

  note('blue', '🎯 La consigne', '<p>Pour chaque commande : <strong>à quoi elle sert, sa syntaxe, au moins trois paramètres, et un exemple d’utilisation</strong>. Complète le dictionnaire de commandes commencé aux TP précédents.</p><p>Attention : cette fois c’est <strong>trois</strong> paramètres, pas deux.</p>'),

  block('heading', { level: 2, text: 'I — Les comptes et les groupes' }),
  flow(`  useradd  et  adduser
  userdel  et  deluser
  groupadd et  addgroup
  groupdel et  delgroup

  passwd     usermod    groupmod    groups    gpasswd`),

  note('yellow', '❓ La question du TP — celle qui compte vraiment', '<p>« <em>Pourquoi, pour ces 4 commandes de gestion d’utilisateurs et de groupes, existe-t-il à chaque fois <strong>deux</strong> commandes ? En quoi sont-elles différentes ?</em> »</p><p>Ce n’est pas une question de forme. Tant qu’on n’a pas la réponse, on utilise l’une pour l’autre — et l’on obtient soit un compte inutilisable, soit un script qui se fige en attendant une réponse que personne ne tapera.</p><p>Cherche <strong>qui</strong> les fournit, <strong>ce que chacune fait de plus</strong>, et <strong>sur quelles distributions</strong> elles existent.</p>'),

  block('heading', { level: 2, text: 'II — Les trois fichiers' }),
  flow(`  /etc/passwd        /etc/group        /etc/shadow`),
  block('html', { html: '<p>Pour chacun : ce qu’il contient, <strong>le rôle de chaque champ</strong> d’une ligne, qui a le droit de le lire, et quelle commande le modifie proprement.</p>' }),

  block('heading', { level: 2, text: 'III — Les droits' }),
  flow(`  chmod        chown        chgrp`),

  note('gray', '🔎 Où chercher', '<p><code>man commande</code> — et pense aux <strong>sections</strong> : <code>man passwd</code> décrit la commande, <code>man 5 passwd</code> décrit le <em>fichier</em> <code>/etc/passwd</code>. C’est exactement le cas où la section 5 est celle qu’il te faut.</p><p>Ensuite : <a href="/pages/linux-droits">le cours utilisateurs, droits et sudo</a> et le <a href="/pages/repertoire-commandes">répertoire des commandes</a>.</p>'),

  note('yellow', '⏸️ Cherche d’abord', '<p>Ce qui suit vérifie ton travail. Le lire avant fait gagner une heure et perdre l’exercice.</p>'),

  block('heading', { level: 2, text: 'Repères — comptes et groupes' }),
  table(['Commande', 'À quoi elle sert', 'Trois paramètres'], [
    ['<code>useradd</code>', 'Créer un compte. <strong>Bas niveau</strong> : fait strictement ce qu’on demande, rien de plus.', '<code>-m</code> créer le dossier personnel · <code>-s /bin/bash</code> imposer le shell · <code>-G grp1,grp2</code> groupes secondaires · <code>-u 1500</code> forcer l’UID'],
    ['<code>adduser</code>', 'Créer un compte. <strong>Script Debian</strong> : interactif, applique <code>/etc/adduser.conf</code>.', '<code>--system</code> compte de service · <code>--home /chemin</code> · <code>--disabled-password</code> · <code>--gecos ""</code> ne pas poser les questions'],
    ['<code>userdel</code>', 'Supprimer un compte.', '<code>-r</code> supprimer aussi le dossier personnel · <code>-f</code> forcer même si connecté'],
    ['<code>deluser</code>', 'Supprimer un compte, version Debian.', '<code>--remove-home</code> · <code>--remove-all-files</code> · <code>--backup</code> archiver avant'],
    ['<code>groupadd</code> / <code>addgroup</code>', 'Créer un groupe.', '<code>-g 1500</code> forcer le GID · <code>--system</code> groupe système'],
    ['<code>groupdel</code> / <code>delgroup</code>', 'Supprimer un groupe.', 'Refuse si c’est le groupe <strong>principal</strong> d’un utilisateur existant.'],
    ['<code>passwd</code>', 'Changer un mot de passe, ou l’état d’un compte.', '<code>-l</code> verrouiller · <code>-u</code> déverrouiller · <code>-e</code> expirer (changement imposé) · <code>-S</code> afficher l’état'],
    ['<code>usermod</code>', 'Modifier un compte existant. <strong>La commande à tout faire.</strong>', '<strong><code>-aG grp</code></strong> ajouter à un groupe · <code>-s</code> shell · <code>-l</code> renommer · <code>-L</code>/<code>-U</code> verrouiller · <code>-d /chemin -m</code> déplacer le home'],
    ['<code>groupmod</code>', 'Modifier un groupe.', '<code>-n nouveau_nom</code> renommer · <code>-g 1500</code> changer le GID'],
    ['<code>groups</code>', 'Afficher les groupes d’un utilisateur.', 'Sans argument : les siens. <code>groups jean</code> : ceux de jean.'],
    ['<code>gpasswd</code>', 'Gérer les membres d’un groupe.', '<code>-a jean grp</code> ajouter · <code>-d jean grp</code> retirer · <code>-M j1,j2 grp</code> fixer la liste · <code>-A jean grp</code> nommer administrateur'],
  ]),

  note('green', '🎯 La réponse à la question du TP', '<p><strong><code>useradd</code>, <code>userdel</code>, <code>groupadd</code>, <code>groupdel</code></strong> sont les <em>outils</em> — les utilitaires <em>shadow-utils</em>, présents sur <strong>toutes</strong> les distributions Linux. Ils font exactement ce qu’on leur demande, sans rien ajouter et sans poser de question.</p><p><strong><code>adduser</code>, <code>deluser</code>, <code>addgroup</code>, <code>delgroup</code></strong> sont des <em>scripts Perl propres à Debian</em>, écrits <strong>par-dessus</strong> les précédents. Ils appliquent la politique de <code>/etc/adduser.conf</code> : ils choisissent l’UID dans la bonne plage, créent le dossier personnel, y recopient <code>/etc/skel</code>, créent le groupe personnel et demandent le mot de passe.</p><p><strong>La règle : au clavier sur Debian → <code>adduser</code>. Dans un script, ou hors Debian → <code>useradd</code></strong>, avec <code>-m</code> et <code>-s</code> écrits explicitement.</p><p>→ le détail complet dans <a href="/pages/linux-droits">le cours</a>, section 10.</p>'),
  note('red', '🚫 Deux pièges à noter dans ton dictionnaire', '<ul><li><strong><code>usermod -G</code> sans le <code>-a</code> REMPLACE</strong> la liste des groupes secondaires. <code>usermod -G compta jean</code> retire jean de tous ses autres groupes — <code>sudo</code> compris. Toujours <code>-aG</code>.</li><li><strong><code>adduser</code> avec deux arguments ne crée rien</strong> : <code>adduser florence formateurs</code> ajoute florence <em>au groupe</em>. La même commande fait deux choses selon le nombre d’arguments.</li></ul>'),

  block('heading', { level: 2, text: 'Repères — les trois fichiers' }),
  table(['Fichier', 'Champs d’une ligne', 'Qui peut lire'], [
    ['<code>/etc/passwd</code>', '<strong>7</strong> : nom : x : UID : GID principal : GECOS : dossier personnel : shell', '<strong>Tout le monde</strong> — c’est lui qui traduit les UID en noms.'],
    ['<code>/etc/group</code>', '<strong>4</strong> : nom : x : GID : membres <strong>secondaires</strong>', 'Tout le monde.'],
    ['<code>/etc/shadow</code>', '<strong>9</strong> : nom : empreinte : dernier changement : min : max : avertissement : …', '<strong>root seul.</strong> C’est toute la raison de son existence.'],
  ]),
  flow(`florence:x:1001:1001:Florence Martin,,,:/home/florence:/bin/bash
    1    2   3    4            5                    6            7

formateurs:x:1002:florence,amelie
     1     2   3         4`),
  note('red', '🚫 Le piège du TP : le groupe principal n’est PAS dans <code>/etc/group</code>', '<p>Le quatrième champ ne liste que les membres <strong>secondaires</strong>. Le groupe <em>principal</em> est le <strong>quatrième champ de <code>/etc/passwd</code></strong>, sous forme de GID.</p><p>Chercher florence dans la ligne <code>florence:x:1001:</code> ne donne donc rien — et l’on croit à tort qu’elle n’appartient pas à son propre groupe. La commande qui dit la vérité est <code>id florence</code> : elle lit les deux fichiers.</p>'),
  note('yellow', '⚠️ Le deuxième champ de <code>/etc/shadow</code>', '<p><code>$6$…</code> une empreinte SHA-512 · <code>$y$…</code> yescrypt (Debian 12) · <code>!</code> ou <code>!!</code> <strong>compte verrouillé</strong> · <code>*</code> connexion par mot de passe impossible · <strong>vide</strong> = aucun mot de passe demandé.</p><p>Après un <code>useradd</code>, c’est <code>!</code>. Le compte existe mais <strong>on ne peut pas s’y connecter</strong> — d’où le <code>sudo passwd toto</code> obligatoire.</p>'),

  block('heading', { level: 2, text: 'Repères — les droits' }),
  table(['Commande', 'Ce qu’elle change', 'Trois paramètres'], [
    ['<code>chmod</code>', 'Les <strong>droits</strong> : qui peut lire, écrire, exécuter.', '<code>-R</code> récursif · <code>u+x</code> / <code>g-w</code> / <code>o=</code> forme symbolique · <code>750</code> forme octale · <code>--reference=fichier</code> copier les droits d’un autre'],
    ['<code>chown</code>', 'L’<strong>utilisateur propriétaire</strong> — et le groupe si on ajoute <code>:groupe</code>.', '<code>-R</code> récursif · <code>jean:compta</code> les deux d’un coup · <code>--from=ancien</code> ne changer que ceux d’un propriétaire donné'],
    ['<code>chgrp</code>', 'Le <strong>groupe propriétaire</strong> uniquement.', '<code>-R</code> récursif · <code>--reference=fichier</code> · <code>-v</code> dire ce qui change'],
  ]),
  note('blue', '💡 <code>chown</code> fait déjà le travail de <code>chgrp</code>', '<p><code>chown :formateurs dossier</code> — avec deux-points et sans nom d’utilisateur — ne change que le groupe. <code>chgrp</code> reste plus lisible quand c’est la seule intention, et c’est pour cela que les deux existent.</p><p>Seul <strong>root</strong> peut donner un fichier à quelqu’un d’autre : sinon, n’importe qui pourrait déposer ses fichiers sur le quota d’un collègue.</p>'),

  note('green', '🔗 Pour la suite', '<p>Ce TP de recherche prépare deux TP pratiques : <a href="/pages/tp-utilisateurs">1.8.2 — TP Utilisateurs</a> (créer, modifier, supprimer), puis <a href="/pages/tp-utilisateurs-droits">1.8.4 — TP Utilisateurs et droits</a>, qui reprend la même arborescence. Le cours de référence : <a href="/pages/linux-droits">Utilisateurs, droits et sudo</a>.</p>'),
];

publier(PAGE, blocks).catch(e => { console.error(e); process.exit(1); });

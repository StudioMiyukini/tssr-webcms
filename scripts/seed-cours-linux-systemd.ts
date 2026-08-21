/* Cours « systemd : services, démarrage et unités » (Linux).
   Le pendant Linux des services Windows : ce que systemctl fait vraiment,
   écrire une unité qui redémarre toute seule, comprendre les dépendances, et
   lire un démarrage qui traîne.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-linux-systemd.ts */
import { block, note, sh, flow, table, styleLinux, liens, publier } from './_cours-linux';
import type { PageBlock } from '../client/src/lib/page-blocks';

const PAGE = {
  slug: 'linux-systemd',
  title: 'systemd : services, démarrage et unités',
  excerpt: 'Le pendant Linux des services Windows. systemctl au quotidien, la différence entre enable et start qu’on confond une fois pour toutes, écrire une unité qui redémarre son application toute seule, comprendre les dépendances et les cibles, les timers comme alternative à cron, et lire un démarrage qui traîne avec systemd-analyze.',
};

const blocks: PageBlock[] = [
  block('hero', {
    eyebrow: 'Cours · Linux',
    title: PAGE.title,
    subtitle: 'Ce qui démarre, dans quel ordre, et ce qui se passe quand ça tombe.',
  }),
  styleLinux,

  block('html', { html: '<p><strong>systemd</strong> est le premier processus lancé par le noyau (PID 1). Il démarre tout le reste, surveille ce qu’il a démarré, le relance si besoin, et collecte les journaux. C’est l’équivalent du <em>Gestionnaire de contrôle des services</em> de Windows, en plus large : il gère aussi les points de montage, les sockets et les tâches planifiées.</p>' }),

  block('heading', { level: 2, text: '1) systemctl au quotidien' }),
  sh(`systemctl status apache2       # etat, PID, memoire, ET les dernieres lignes de journal
systemctl start apache2        # demarrer MAINTENANT
systemctl stop apache2
systemctl restart apache2      # arret puis demarrage
systemctl reload apache2       # relire la conf SANS couper les connexions
systemctl enable apache2       # demarrer AU PROCHAIN BOOT
systemctl disable apache2
systemctl enable --now apache2 # les deux d'un coup : le raccourci utile`),
  note('red', '🚫 <code>start</code> n’est pas <code>enable</code> — l’erreur du TP', '<p><code>start</code> démarre <strong>maintenant</strong> et ne survit pas au redémarrage. <code>enable</code> planifie le démarrage <strong>au boot</strong> et ne lance rien tout de suite. Le service configuré, testé, qui fonctionne parfaitement — et qui a disparu après le redémarrage du serveur — a été <code>start</code>é sans être <code>enable</code>d. C’est le classique de l’examen, et de la vraie vie.</p>'),
  sh(`systemctl list-units --type=service --state=running   # ce qui tourne
systemctl list-unit-files --state=enabled            # ce qui demarrera au boot
systemctl --failed                                   # ce qui a echoue : a regarder en premier
systemctl is-active apache2 ; systemctl is-enabled apache2`),
  note('blue', '💡 <code>reload</code> quand il existe', '<p>Sur un serveur web en production, <code>restart</code> coupe les connexions en cours ; <code>reload</code> fait relire la configuration sans interruption. Tous les services ne le proposent pas — <code>systemctl reload apache2</code> échoue proprement si ce n’est pas prévu, ce qui est une bonne façon de le savoir.</p>'),

  block('heading', { level: 2, text: '2) Une unité, et où elle vit' }),
  table(['Emplacement', 'Contenu', 'Règle'], [
    ['<code>/lib/systemd/system/</code>', 'Les unités livrées par les paquets.', '<strong>On n’y touche pas</strong> : une mise à jour du paquet écrase tout.'],
    ['<code>/etc/systemd/system/</code>', 'Les nôtres, et nos surcharges.', 'C’est ici qu’on écrit. Prioritaire sur le précédent.'],
    ['<code>…/nom.service.d/*.conf</code>', 'Surcharge partielle d’une unité existante.', 'Créée par <code>systemctl edit nom</code> : on ne modifie qu’un réglage.'],
  ]),
  note('yellow', '⚠️ Après toute modification : <code>systemctl daemon-reload</code>', '<p>systemd garde les unités en mémoire. Éditer un <code>.service</code> ne change rien tant qu’il n’a pas relu ses fichiers, et le service redémarré tourne alors avec l’ancienne configuration — sans le dire. « J’ai modifié le fichier et ça n’a pas changé » vient de là dans neuf cas sur dix.</p>'),

  block('heading', { level: 2, text: '3) Écrire un service' }),
  block('html', { html: '<p>Le cas concret du TSSR : une application métier, un script de collecte, un serveur maison — quelque chose qui doit tourner en permanence et repartir tout seul.</p>' }),
  flow(`# /etc/systemd/system/collecte.service
[Unit]
Description=Collecte des relevés
After=network-online.target       # apres le reseau REELLEMENT disponible
Wants=network-online.target

[Service]
Type=simple                        # le processus reste au premier plan
User=collecte                      # PAS root : un service tourne avec le
Group=collecte                     # minimum de droits necessaires
WorkingDirectory=/opt/collecte
ExecStart=/opt/collecte/collecte.sh --config /etc/collecte.conf
Restart=on-failure                 # relance si le processus meurt en erreur
RestartSec=10                      # en attendant 10 s, pour ne pas s'emballer

[Install]
WantedBy=multi-user.target         # ce que 'enable' rattache`),
  sh(`sudo systemctl daemon-reload
sudo systemctl enable --now collecte
systemctl status collecte
journalctl -u collecte -f          # suivre ses journaux en direct`),
  table(['<code>Type=</code>', 'Quand l’utiliser'], [
    ['<code>simple</code>', 'Le processus reste au premier plan. <strong>Le cas normal</strong>, et le bon choix par défaut.'],
    ['<code>forking</code>', 'Le programme se dédouble et rend la main (démons anciens). Demande souvent <code>PIDFile=</code>.'],
    ['<code>oneshot</code>', 'Fait une chose et s’arrête. Avec <code>RemainAfterExit=yes</code> pour rester « actif » ensuite.'],
    ['<code>notify</code>', 'Le programme prévient systemd quand il est vraiment prêt. Le plus précis, si le programme le sait faire.'],
  ]),
  note('red', '🚫 <code>ExecStart</code> veut un chemin absolu', '<p><code>ExecStart=collecte.sh</code> échoue : systemd n’a pas de <code>PATH</code> de shell, ni de répertoire courant par défaut. Même chose pour les redirections et les pipes — <code>ExecStart=/bin/sh -c "cmd | autre"</code> si on en a besoin. Le message d’erreur, <code>status=203/EXEC</code>, veut dire exactement ça.</p>'),
  note('green', '🎯 <code>Restart=on-failure</code> : la moitié de l’intérêt de systemd', '<p>C’est ce qui distingue un service d’un script lancé à la main. L’application tombe à 3 h du matin, systemd la relance, et le journal garde la trace. <code>Restart=always</code> relance aussi après un arrêt volontaire — rarement ce qu’on veut.</p>'),

  block('heading', { level: 2, text: '4) Surcharger sans casser' }),
  block('html', { html: '<p>Changer un réglage d’un service livré par un paquet ne se fait pas en éditant son fichier : la prochaine mise à jour l’écraserait.</p>' }),
  sh(`sudo systemctl edit apache2        # cree un fragment de surcharge`),
  flow(`# S'ouvre vide : on n'ecrit QUE ce qu'on change.
[Service]
Restart=on-failure
RestartSec=5

# Enregistre dans /etc/systemd/system/apache2.service.d/override.conf
# La mise a jour du paquet ne l'effacera pas.`),
  sh(`systemctl cat apache2      # l'unite finale : original + surcharges
systemctl show apache2 -p Restart -p User    # la valeur reellement appliquee`),
  note('blue', '💡 Vider une directive de liste', '<p>Pour <em>remplacer</em> un <code>ExecStart</code> au lieu d’en ajouter un second, il faut d’abord le vider : <code>ExecStart=</code> seul sur une ligne, puis la nouvelle valeur. Sans cela, systemd refuse l’unité en signalant deux <code>ExecStart</code> pour un <code>Type=simple</code>.</p>'),

  block('heading', { level: 2, text: '5) Dépendances et cibles' }),
  block('html', { html: '<p>systemd démarre tout ce qu’il peut <strong>en parallèle</strong> — c’est ce qui rend le boot rapide. L’ordre ne s’obtient donc que si on le déclare.</p>' }),
  table(['Directive', 'Ce qu’elle dit'], [
    ['<code>After=</code> / <code>Before=</code>', 'L’<strong>ordre</strong>, uniquement. N’oblige pas l’autre unité à démarrer.'],
    ['<code>Wants=</code>', 'La <strong>souhaite</strong> : si elle échoue, on démarre quand même. C’est le lien à préférer.'],
    ['<code>Requires=</code>', 'L’<strong>exige</strong> : si elle échoue ou s’arrête, on s’arrête aussi. À manier avec précaution.'],
  ]),
  note('yellow', '⚠️ <code>After=network.target</code> ne suffit presque jamais', '<p><code>network.target</code> signifie « la pile réseau est en place », pas « une adresse IP est configurée ». Un service qui doit se lier à une adresse précise démarre trop tôt et échoue. Il faut <code>network-online.target</code>, <strong>avec</strong> <code>Wants=</code> — la cible n’est atteinte que si quelque chose la demande.</p>'),
  sh(`systemctl list-dependencies apache2
systemctl get-default                    # graphical.target ou multi-user.target
sudo systemctl set-default multi-user.target   # un serveur n'a pas besoin d'interface graphique`),
  block('html', { html: '<p>Les <strong>cibles</strong> (<code>.target</code>) remplacent les niveaux d’exécution : <code>multi-user.target</code> correspond à l’ancien runlevel 3, <code>graphical.target</code> au 5. <code>rescue.target</code> et <code>emergency.target</code> servent au dépannage.</p>' }),

  block('heading', { level: 2, text: '6) Les timers : cron, mais intégré' }),
  block('html', { html: '<p>Un <strong>timer</strong> déclenche un service à une heure donnée. Comparé à cron, il apporte les journaux, l’état, les dépendances et le rattrapage.</p>' }),
  flow(`# /etc/systemd/system/sauvegarde.service     (ce qu'on fait)
[Unit]
Description=Sauvegarde nocturne
[Service]
Type=oneshot
ExecStart=/usr/local/bin/sauvegarde.sh

# /etc/systemd/system/sauvegarde.timer       (quand on le fait)
[Unit]
Description=Declenche la sauvegarde chaque nuit
[Timer]
OnCalendar=*-*-* 02:30:00
Persistent=true        # rattrape si la machine etait eteinte a 2h30
RandomizedDelaySec=300 # etale la charge quand vingt machines sauvegardent
[Install]
WantedBy=timers.target`),
  sh(`sudo systemctl enable --now sauvegarde.timer
systemctl list-timers --all        # prochaine execution, derniere, et le retard
journalctl -u sauvegarde           # la sortie du script, horodatee et conservee`),
  note('green', '🎯 <code>Persistent=true</code> : ce que cron ne sait pas faire', '<p>Une tâche cron prévue à 2 h 30 sur une machine éteinte à 2 h 30 ne s’exécute jamais, et personne n’est prévenu. Un timer <code>Persistent</code> la lance au démarrage suivant. Sur des postes ou des serveurs qu’on éteint, c’est décisif.</p>'),

  block('heading', { level: 2, text: '7) Un démarrage qui traîne' }),
  sh(`systemd-analyze                    # temps total : firmware, chargeur, noyau, userspace
systemd-analyze blame              # les unites, de la plus lente a la plus rapide
systemd-analyze critical-chain     # la CHAINE qui a reellement retarde le boot
systemd-analyze plot > boot.svg    # une frise chronologique, a ouvrir dans un navigateur`),
  note('blue', '💡 <code>blame</code> accuse souvent à tort', '<p>Une unité lente qui démarre <em>en parallèle</em> ne retarde rien. <code>critical-chain</code> montre la file qui a vraiment tenu le boot — c’est elle qu’il faut regarder. Deux minutes perdues au démarrage viennent presque toujours d’un montage réseau injoignable dans <code>/etc/fstab</code> : voir <a href="/pages/linux-disques">le cours stockage</a> et l’option <code>nofail</code>.</p>'),

  block('heading', { level: 2, text: '8) Quand un service refuse de démarrer' }),
  sh(`systemctl status collecte -l --no-pager   # les 10 dernieres lignes de journal
journalctl -u collecte -n 50 --no-pager   # davantage
journalctl -xeu collecte                  # avec les explications de systemd
systemd-analyze verify /etc/systemd/system/collecte.service   # la syntaxe`),
  table(['Code', 'Signification', 'Cause habituelle'], [
    ['<code>203/EXEC</code>', 'Le binaire n’a pas pu être lancé.', 'Chemin non absolu, fichier absent, ou <code>x</code> manquant.'],
    ['<code>200/CHDIR</code>', '<code>WorkingDirectory</code> inaccessible.', 'Dossier absent, ou droits de l’utilisateur du service.'],
    ['<code>217/USER</code>', 'L’utilisateur n’existe pas.', '<code>User=</code> pointe un compte jamais créé.'],
    ['<code>1/FAILURE</code>', 'Le programme a démarré et s’est arrêté en erreur.', 'C’est le journal du programme qu’il faut lire, pas celui de systemd.'],
    ['<code>start request repeated too quickly</code>', 'Trop de relances en peu de temps.', 'Une vraie panne masquée par <code>Restart=</code>. Corriger la cause, pas le délai.'],
  ]),

  note('blue', '🪟 En regard de Windows', '<p><code>systemctl</code> ↔ <code>services.msc</code> · <code>enable</code> ↔ démarrage automatique · <code>Restart=on-failure</code> ↔ onglet Récupération · <code>journalctl -u</code> ↔ Observateur d’événements filtré par source · <code>.timer</code> ↔ Planificateur de tâches.</p>'),

  liens('/pages/linux-systemd'),
];

publier(PAGE, blocks).catch(e => { console.error(e); process.exit(1); });

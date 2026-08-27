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

  block('heading', { level: 2, text: '2) Lire un <code>systemctl status</code>, ligne par ligne' }),
  block('html', { html: '<p>C’est la commande la plus tapée de toute l’administration Linux, et la plus survolée. Elle répond à quatre questions différentes, empilées — et savoir laquelle est en défaut fait gagner le plus clair du temps de dépannage.</p>' }),
  flow(`$ systemctl status ssh
* ssh.service - OpenBSD Secure Shell server
     Loaded: loaded (/lib/systemd/system/ssh.service; enabled; preset: enabled)
     |         |              |                        |
     |         |              |                        +-- 2. MODE DE DEMARRAGE
     |         |              +-- ou vit le fichier d'unite
     |         +-- 1. CHARGEMENT
     |
     Active: active (running) since Wed 2026-08-27 09:14:02 CEST; 2h 3min ago
     |         |
     |         +-- 3. ETAT
     |
       Docs: man:sshd(8)                      <- ou lire la documentation
   Main PID: 683 (sshd)                       <- l'identifiant du processus
      Tasks: 1 (limit: 4653)
     Memory: 5.6M
        CPU: 84ms
     CGroup: /system.slice/ssh.service
             \`-683 "sshd: /usr/sbin/sshd -D [listener]"

aout 27 09:14:02 debian sshd[683]: Server listening on 0.0.0.0 port 22.
                                    ^
                          4. LES DERNIERES LIGNES DE JOURNAL
                             c'est ici qu'une erreur s'explique`),

  block('heading', { level: 3, text: '1. Le chargement — le fichier a-t-il été lu ?' }),
  table(['Valeur', 'Ce que ça veut dire'], [
    ['<code>loaded</code>', 'Le fichier d’unité a été lu correctement. <strong>Le cas normal.</strong>'],
    ['<code>not-found</code>', '<strong>Aucun fichier d’unité pour ce nom.</strong> Neuf fois sur dix : une faute de frappe, ou le paquet n’est pas installé.'],
    ['<code>error</code>', 'Le fichier existe mais n’a pas pu être lu — droits, ou fichier illisible.'],
    ['<code>bad-setting</code>', 'Un réglage essentiel du fichier est incompréhensible. Une erreur de syntaxe dans l’unité.'],
    ['<code>masked</code>', 'L’unité a été <strong>masquée</strong> volontairement — voir plus bas.'],
  ]),

  block('heading', { level: 3, text: '2. Le mode de démarrage — repartira-t-il au boot ?' }),
  table(['Valeur', 'Ce que ça veut dire'], [
    ['<code>enabled</code>', '<strong>Démarrera au prochain boot.</strong>'],
    ['<code>disabled</code>', 'Ne démarrera pas tout seul. Il peut tourner malgré tout — voir la nuance ci-dessous.'],
    ['<code>static</code>', 'L’unité <strong>n’a pas de section <code>[Install]</code></strong> : on ne peut ni l’activer ni la désactiver. Elle est tirée <em>par une autre unité</em> qui en dépend.'],
    ['<code>masked</code>', 'Verrouillée : <strong>aucun démarrage possible</strong>, ni automatique ni manuel.'],
    ['<code>alias</code>', 'Un autre nom pour la même unité. C’est ainsi que <code>sshd.service</code> désigne <code>ssh.service</code> sur Debian, ou <code>mysql</code> désigne <code>mariadb</code>.'],
    ['<code>linked</code>', 'Le fichier d’unité est un lien symbolique vers un fichier situé ailleurs.'],
  ]),
  note('red', '🚫 <code>static</code> ne veut pas dire « systemd ne sait pas le gérer »', '<p>C’est une confusion qu’on lit souvent. <strong><code>start</code>, <code>stop</code> et <code>status</code> fonctionnent parfaitement sur une unité <code>static</code>.</strong> La seule chose impossible est <code>enable</code> / <code>disable</code> — parce que le fichier ne contient pas de section <code>[Install]</code>, donc systemd ne sait pas <em>où</em> l’accrocher au démarrage.</p><p>Ce n’est pas un défaut : ces unités sont des briques, tirées automatiquement par celles qui en ont besoin. Vouloir les activer à la main n’aurait pas de sens.</p>'),
  note('yellow', '⚠️ <code>enabled</code> et <code>active</code> sont deux questions distinctes', '<p>Un service peut être <code>disabled</code> et pourtant <code>active (running)</code> — quelqu’un l’a démarré à la main, et il disparaîtra au prochain redémarrage. L’inverse existe aussi : <code>enabled</code> mais <code>failed</code>.</p><p>La ligne <strong>Loaded</strong> répond à « <em>et demain ?</em> », la ligne <strong>Active</strong> à « <em>et maintenant ?</em> ».</p>'),

  block('heading', { level: 3, text: '3. L’état — que fait-il en ce moment ?' }),
  table(['Valeur', 'Ce que ça veut dire'], [
    ['<code>active (running)</code>', 'Il tourne en arrière-plan. <strong>Le cas d’un vrai démon</strong> : ssh, apache, mariadb.'],
    ['<code>active (exited)</code>', 'Il a fait son travail <strong>et s’est arrêté — c’est normal</strong>. Typique d’une tâche ponctuelle : monter un disque, appliquer une règle de pare-feu. <strong>Ce n’est pas une panne.</strong>'],
    ['<code>active (waiting)</code>', 'Il tourne, mais attend un déclencheur : une connexion, un minuteur.'],
    ['<code>inactive</code>', 'Arrêté. Ni erreur, ni activité.'],
    ['<strong><code>failed</code></strong>', '<strong>Il a échoué.</strong> Les dernières lignes du journal, en bas du <code>status</code>, disent pourquoi.'],
  ]),
  note('blue', '💡 <code>active (exited)</code> inquiète pour rien', '<p>Voir « exited » alors qu’on attend un service qui tourne fait croire à un plantage. C’est au contraire le signe que tout s’est bien passé : l’unité avait une seule chose à faire, elle l’a faite. Le vert du <code>active</code> est là pour ça.</p>'),

  block('heading', { level: 3, text: '4. Le PID, et le journal' }),
  block('html', { html: '<p><strong>Main PID</strong> est l’identifiant du processus principal — c’est <em>lui</em> qu’on utilisera pour un <code>kill</code>. Des lignes <strong>Process</strong> peuvent s’y ajouter quand l’unité lance aussi des commandes avant ou après (<code>ExecStartPre</code>, <code>ExecStartPost</code>) ; il peut donc y en avoir plusieurs.</p><p>Et en dessous, <strong>les dernières lignes de journal</strong>. C’est la partie qu’il faut lire, toujours : sur un service qui va bien, elle indique par exemple le port écouté ; sur un service en échec, elle donne la raison exacte.</p>' }),
  sh(`systemctl status ssh          # les ~10 dernieres lignes
journalctl -u ssh -n 50       # les 50 dernieres
journalctl -u ssh -f          # en direct — a laisser tourner pendant qu'on teste
journalctl -u ssh -b          # depuis le dernier demarrage de la machine`),

  block('heading', { level: 2, text: '2 bis) Les questions courtes, et le masquage' }),
  sh(`systemctl is-active ssh        # active / inactive — repond en un mot
systemctl is-enabled ssh       # enabled / disabled / static / masked
systemctl is-failed ssh        # a-t-il echoue ?
systemctl --failed --type=service      # TOUT ce qui est en erreur : a taper en premier
systemctl list-unit-files --type=service --all   # tout, avec le mode de demarrage`),
  note('green', '🎯 Les commandes <code>is-*</code> sont faites pour les scripts', '<p>Elles répondent en un mot <strong>et par leur code de retour</strong> — 0 si oui, non nul sinon. D’où leur usage naturel dans un test, sans avoir à analyser du texte :</p><div class="lx-cmd">if systemctl is-active --quiet ssh; then\n  echo "SSH tourne"\nfi</div>'),

  block('heading', { level: 3, text: 'Masquer un service' }),
  block('html', { html: '<p><code>disable</code> empêche le démarrage automatique, mais n’empêche pas quelqu’un — ou un paquet — de le démarrer. <strong><code>mask</code> le verrouille pour de bon.</strong></p>' }),
  sh(`sudo systemctl mask apache2     # verrouille : plus AUCUN demarrage possible
sudo systemctl unmask apache2   # rend l'unite a son etat precedent`),
  flow(`$ sudo systemctl start apache2
Failed to start apache2.service: Unit apache2.service is masked.`),
  note('blue', '💡 Le cas d’usage réel', '<p>On installe nginx sur une machine où apache2 est présent : les deux veulent le port 80. Masquer apache2 garantit qu’aucune mise à jour de paquet, aucun collègue et aucune dépendance ne le relancera par inadvertance.</p><p>Techniquement, <code>mask</code> crée un lien symbolique de l’unité vers <code>/dev/null</code> — il n’y a plus rien à démarrer. C’est brutal, et c’est le but.</p>'),

  block('heading', { level: 2, text: '2 ter) Sous les services : les processus' }),
  block('html', { html: '<p><code>systemctl</code> raisonne en <em>services</em>. En dessous, il n’y a que des <strong>processus</strong>, et les commandes Unix classiques restent indispensables — notamment quand un programme n’a pas été lancé par systemd.</p>' }),
  sh(`ps                 # les commandes de MON terminal, rien de plus
ps x               # tous MES processus, meme hors terminal
ps aux             # TOUS les processus de la machine, avec les ressources
ps aux | grep ssh  # filtrer
pgrep sshd         # juste le PID
pgrep -a sshd      # le PID et la ligne de commande`),
  table(['Colonne de <code>ps aux</code>', 'Ce qu’elle donne'], [
    ['<code>USER</code>', 'Le compte au nom duquel le processus tourne.'],
    ['<strong><code>PID</code></strong>', '<strong>L’identifiant unique</strong> — c’est lui qu’on utilise pour agir.'],
    ['<code>%CPU</code>', 'Part du processeur utilisée.'],
    ['<code>%MEM</code>', 'Part de la <strong>mémoire vive</strong> utilisée.'],
    ['<code>VSZ</code>', 'Mémoire <em>virtuelle</em> réservée — souvent énorme et peu parlante.'],
    ['<code>RSS</code>', '<strong>Mémoire physique réellement occupée</strong>, en Ko. C’est celle qui compte.'],
    ['<code>TTY</code>', 'Le terminal associé. <strong><code>?</code> = aucun</strong>, donc un démon.'],
    ['<code>STAT</code>', 'L’état : <code>R</code> en cours, <code>S</code> endormi (le cas le plus fréquent), <code>D</code> attente disque, <code>T</code> <strong>suspendu</strong>, <code>Z</code> zombie.'],
    ['<code>START</code>', 'L’heure de démarrage.'],
    ['<code>TIME</code>', 'Temps processeur consommé au total.'],
    ['<code>COMMAND</code>', 'La ligne de commande.'],
  ]),
  note('gray', '💡 <code>S</code> partout, et c’est normal', '<p>La quasi-totalité des processus d’une machine sont en <code>S</code> — endormis, en attente d’un événement. Un système où tout serait en <code>R</code> serait un système saturé. <code>T</code> signifie <strong>suspendu</strong> (un <kbd>Ctrl-Z</kbd>, par exemple), pas « terminé » ; un processus terminé mais que son parent n’a pas récupéré est un <strong>zombie</strong>, <code>Z</code>.</p>'),
  note('yellow', '⚠️ <code>ps aux</code> ou <code>ps -aux</code> ?', '<p><code>ps</code> accepte deux grammaires : celle de BSD, <strong>sans tiret</strong> (<code>ps aux</code>, <code>ps x</code>), et celle d’UNIX, <strong>avec</strong> (<code>ps -ef</code>). <code>ps aux</code> est la forme correcte et universellement utilisée ; <code>ps -aux</code> fonctionne par tolérance, mais mélange les deux.</p>'),

  block('heading', { level: 3, text: 'Arrêter un processus' }),
  sh(`systemctl stop ssh        # LA bonne facon, quand c'est un service
systemctl kill ssh        # signal d'arret a tous les processus du service

kill 1234                 # demande poliment au PID 1234 de se terminer (SIGTERM)
kill -KILL 1234           # ou kill -9 : le noyau le termine, sans discussion
pkill -f mon-script.sh    # par nom, plutot que par PID`),
  note('red', '🚫 <code>kill -9</code> en dernier recours seulement', '<p><strong><code>kill</code></strong> seul envoie <strong>SIGTERM</strong> : « termine-toi ». Le programme le reçoit, ferme ses fichiers, écrit ce qu’il avait en attente, et sort proprement.</p><p><strong><code>kill -9</code></strong> envoie <strong>SIGKILL</strong>, que le programme <strong>ne peut ni intercepter ni ignorer</strong> : c’est le noyau qui le supprime. Rien n’est enregistré, rien n’est fermé. Sur une base de données, c’est le meilleur moyen de corrompre des données.</p><p><strong>Toujours <code>kill</code> d’abord</strong> ; attendre quelques secondes ; <code>-9</code> seulement s’il ne répond pas.</p>'),
  note('green', '🎯 Sur un service, préférer <code>systemctl</code> à <code>kill</code>', '<p>Tuer le PID d’un service géré par systemd, c’est court-circuiter le gestionnaire : selon la configuration <code>Restart=</code>, il peut le relancer aussitôt — on croit avoir arrêté quelque chose qui repart seul.</p><p><code>systemctl stop</code> arrête <strong>le service</strong>, avec tous ses processus enfants, et systemd sait qu’il ne doit pas le relancer.</p>'),

  block('heading', { level: 2, text: '2 quater) Avant systemd, et à côté' }),
  block('html', { html: '<p>systemd est le gestionnaire d’initialisation par défaut de la plupart des distributions — <strong>mais pas de toutes</strong>. Certaines utilisent encore <em>SysVinit</em> (System V), avec la commande <code>service</code>, ou l’intermédiaire <em>Upstart</em>, peu répandu.</p>' }),
  sh(`service ssh status        # ancienne syntaxe : REDIRIGEE vers systemctl
systemctl status ssh      # ce qui est reellement execute`),
  note('yellow', '⚠️ Les alias disparaissent peu à peu', '<p>Les distributions passées à systemd ont conservé une redirection : <code>service ssh status</code> est traduit à la volée en <code>systemctl status ssh</code>. C’est confortable, et c’est provisoire — ces passerelles s’effacent avec le temps.</p><p><strong>Prends l’habitude de <code>systemctl</code></strong>, y compris quand une documentation ancienne montre <code>service</code>.</p>'),
  note('gray', '💡 Ce que fait vraiment un gestionnaire d’initialisation', '<p>Une fois le noyau chargé, il reste à démarrer tout le reste — les services, les sessions, le réseau : ce qu’on appelle l’<em>espace utilisateur</em>. C’est son premier rôle. Le second, celui qu’on utilise tous les jours, est de <strong>gérer ces services pendant que la machine tourne</strong>.</p><p>systemd travaille sur des <strong>unités</strong>, reconnaissables à leur suffixe : <code>.service</code>, <code>.timer</code>, <code>.socket</code>, <code>.mount</code>, <code>.target</code>. Le suffixe <code>.service</code> peut être omis — <code>systemctl status ssh</code> suffit, systemd devine.</p>'),

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

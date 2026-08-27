/* Cours « Rocky Linux et la famille Red Hat ».
   Tous les autres cours Linux du site sont écrits pour Debian. Celui-ci est la
   table de traduction : ce qui change de nom, ce qui change de commande, et
   surtout les trois mécanismes qui n'existent pas côté Debian et qui font
   échouer les manipulations apprises en TP — SELinux, firewalld, NetworkManager.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-linux-redhat.ts */
import { block, note, sh, flow, table, styleLinux, liens, publier } from './_cours-linux';
import type { PageBlock } from '../client/src/lib/page-blocks';

const PAGE = {
  slug: 'linux-redhat',
  title: 'Rocky Linux et la famille Red Hat',
  excerpt: 'La table de traduction entre Debian et RHEL / Rocky / AlmaLinux : dnf et rpm à la place d’apt, firewalld allumé par défaut, SELinux en mode bloquant, nmcli au lieu d’interfaces, le groupe wheel au lieu de sudo. Avec les manipulations des TP refaites côté Rocky — dont le changement de port SSH, qui demande trois commandes au lieu d’une.',
};

const blocks: PageBlock[] = [
  block('hero', {
    eyebrow: 'Cours · Linux',
    title: PAGE.title,
    subtitle: 'La deuxième famille — celle qu’on trouve derrière les serveurs critiques.',
  }),
  styleLinux,

  note('blue', '🎯 Pourquoi ce cours', '<p>Tous les autres cours Linux de ce site sont écrits pour <strong>Debian</strong>, parce que c’est la distribution de la formation. En entreprise, un TSSR rencontre <strong>les deux familles</strong> — et souvent dans la même salle serveur.</p><p>Cette page ne réapprend pas Linux : elle traduit. Ce qui change de nom, ce qui change de commande, et surtout <strong>les trois mécanismes qui n’existent pas côté Debian</strong> et qui font échouer les manipulations des TP.</p>'),

  block('heading', { level: 2, text: '1) Qui est qui dans la famille' }),
  table(['Distribution', 'Ce que c’est', 'Rythme', 'Où on la rencontre'], [
    ['<strong>RHEL</strong><br><em>Red Hat Enterprise Linux</em>', 'La version commerciale, avec support payant.', 'Version majeure ~3 ans, <strong>10 ans de support</strong>.', 'Grands comptes, banques, administrations, industrie.'],
    ['<strong>Rocky Linux</strong>', '<strong>Reconstruction libre et gratuite de RHEL</strong>, binaire pour binaire.', 'Suit RHEL, version pour version.', 'Partout où l’on veut RHEL sans le contrat de support.'],
    ['<strong>AlmaLinux</strong>', 'L’autre reconstruction libre de RHEL.', 'Suit RHEL.', 'Même usage que Rocky. Le choix entre les deux est souvent affectif.'],
    ['<strong>CentOS Stream</strong>', '<strong>L’avant-RHEL</strong> : ce qui deviendra la prochaine version mineure.', 'Continu.', 'Développement, tests de compatibilité. <strong>Pas un clone de RHEL.</strong>'],
    ['<strong>Fedora</strong>', 'Le laboratoire de Red Hat. Tout y est testé en premier.', '2 versions par an, <strong>~13 mois de support</strong>.', 'Postes de développeurs. <strong>Jamais en production.</strong>'],
    ['<strong>Oracle Linux</strong>', 'Encore une reconstruction de RHEL, par Oracle.', 'Suit RHEL.', 'Environnements Oracle Database.'],
  ]),
  flow(`     Fedora            ->     CentOS Stream      ->      RHEL
   le laboratoire          l'avant-derniere          la version
   2 versions/an           etape, en continu         commerciale
                                                          |
                                                          | reconstruite
                                                          v
                                              Rocky Linux / AlmaLinux
                                              memes binaires, gratuit`),
  note('gray', '🕰️ Pourquoi Rocky existe — l’histoire vaut d’être connue', '<p>Jusqu’en 2020, <strong>CentOS</strong> était la reconstruction libre de RHEL, et le choix par défaut de milliers de serveurs. En décembre 2020, Red Hat annonce que CentOS 8 s’arrêtera fin 2021 et sera remplacé par <strong>CentOS Stream</strong>, qui se situe <em>en amont</em> de RHEL et non plus en aval.</p><p>Pour ceux qui voulaient un clone stable, la promesse était rompue — et sur une version annoncée pour dix ans. <strong>Gregory Kurtzer</strong>, cofondateur du projet CentOS d’origine, lance <strong>Rocky Linux</strong> dans les jours qui suivent, nommé en mémoire de Rocky McGaugh, un autre des premiers de CentOS. CloudLinux lance <strong>AlmaLinux</strong> en parallèle.</p><p>En 2023, Red Hat restreint encore l’accès public aux sources, ce qui complique les reconstructions. Les deux projets tiennent, par des voies différentes — Alma privilégiant désormais la compatibilité fonctionnelle plutôt que l’identité stricte.</p>'),
  note('yellow', '⚠️ Ce qui se dit en entretien', '<p>« Rocky ou Alma ? » n’a pas de bonne réponse technique : les deux se substituent à RHEL sans changer une ligne d’administration. En revanche, savoir <strong>pourquoi ils existent</strong> montre qu’on a compris ce qu’est une distribution <em>d’entreprise</em> — un engagement de durée, pas seulement un ensemble de logiciels.</p>'),

  block('heading', { level: 2, text: '2) Le mémo de traduction' }),
  table(['Ce qu’on veut faire', 'Debian', 'Rocky / RHEL'], [
    ['Installer un paquet', '<code>apt install nom</code>', '<code>dnf install nom</code>'],
    ['Rafraîchir le catalogue', '<code>apt update</code>', '<em>automatique</em> — voir §3'],
    ['Mettre à jour', '<code>apt upgrade</code>', '<code>dnf upgrade</code>'],
    ['Chercher un paquet', '<code>apt search</code>', '<code>dnf search</code>'],
    ['Quel paquet fournit cette commande ?', '<code>apt-file search</code>', '<code>dnf provides */nom</code>'],
    ['Lister ce qui est installé', '<code>dpkg -l</code>', '<code>rpm -qa</code>'],
    ['Nettoyer les orphelins', '<code>apt autoremove</code>', '<code>dnf autoremove</code>'],
    ['Dépôts', '<code>/etc/apt/sources.list</code>', '<code>/etc/yum.repos.d/*.repo</code>'],
    ['Pare-feu', '<code>ufw</code> (souvent absent)', '<strong><code>firewall-cmd</code> — actif d’office</strong>'],
    ['Réseau', '<code>/etc/network/interfaces</code>', '<strong><code>nmcli</code></strong>'],
    ['Groupe des administrateurs', '<code>sudo</code>', '<strong><code>wheel</code></strong>'],
    ['Serveur web', '<code>apache2</code>', '<strong><code>httpd</code></strong>'],
    ['Journal système', '<code>/var/log/syslog</code>', '<code>/var/log/messages</code>'],
    ['Journal d’authentification', '<code>/var/log/auth.log</code>', '<code>/var/log/secure</code>'],
    ['Réglages par service', '<code>/etc/default/</code>', '<code>/etc/sysconfig/</code>'],
    ['Système de fichiers par défaut', '<code>ext4</code>', '<strong><code>XFS</code></strong>'],
    ['Sécurité renforcée', '<em>AppArmor, discret</em>', '<strong>SELinux, bloquant</strong>'],
  ]),
  note('green', '🎯 Ce qui ne change pas — c’est-à-dire presque tout', '<p><code>systemctl</code>, <code>journalctl</code>, <code>ls</code>, <code>chmod</code>, <code>chown</code>, <code>tar</code>, <code>ssh</code>, <code>vim</code>, l’arborescence, les droits <code>rwx</code>, les tubes et redirections, <code>/etc/passwd</code>, <code>/etc/group</code>, <code>/etc/shadow</code>, <code>cron</code>, <code>ip a</code>, <code>ss</code>…</p><p><strong>Tout ce que tu as appris reste vrai.</strong> Les différences tiennent sur la page que tu lis — c’est peu, mais ce sont exactement les points où l’on se bloque.</p>'),

  block('heading', { level: 2, text: '3) Les paquets : dnf et rpm' }),
  sh(`sudo dnf install httpd            # installer
sudo dnf remove httpd             # desinstaller
sudo dnf upgrade                  # tout mettre a jour
sudo dnf autoremove               # retirer les dependances orphelines
sudo dnf clean all                # vider le cache

dnf search serveur web            # chercher
dnf info httpd                    # la fiche du paquet
dnf provides */ifconfig           # QUEL PAQUET fournit cette commande
dnf list installed | grep ssh
dnf group list                    # les groupes de paquets
sudo dnf group install "Development Tools"`),
  note('blue', '💡 Pas d’équivalent d’<code>apt update</code> — et c’est voulu', '<p>C’est la première surprise. Sous Debian, oublier <code>apt update</code> fait travailler sur un catalogue périmé. <strong><code>dnf</code> vérifie la fraîcheur de ses métadonnées tout seul</strong> et les retélécharge si elles ont dépassé leur durée de validité (<code>metadata_expire</code>, 48 h par défaut).</p><p>Il existe bien <code>dnf check-update</code> et <code>dnf makecache</code>, mais on ne les tape pratiquement jamais. <strong>Un <code>dnf install</code> suffit.</strong></p>'),
  note('green', '🎯 <code>dnf history</code> : ce qu’<code>apt</code> ne sait pas faire', '<p>dnf tient un registre de toutes les transactions, et sait <strong>les annuler</strong> :</p><div class="lx-cmd">dnf history                  # la liste, numerotee\ndnf history info 42          # ce qu\'a fait la transaction 42\nsudo dnf history undo 42     # ANNULER la transaction 42\nsudo dnf history rollback 40 # revenir a l\'etat d\'apres la 40</div><p>Après une mise à jour qui casse un service, c’est une porte de sortie que le monde Debian n’a pas. À connaître : c’est l’argument qui revient le plus souvent en faveur de la famille Red Hat.</p>'),
  block('html', { html: '<p><code>rpm</code> est l’outil de bas niveau, l’équivalent de <code>dpkg</code>. Il <strong>ne résout pas les dépendances</strong> :</p>' }),
  sh(`rpm -qa                    # tout ce qui est installe
rpm -qi httpd              # les informations d'un paquet
rpm -ql httpd              # TOUS LES FICHIERS qu'il a poses
rpm -qf /etc/httpd/conf/httpd.conf   # a QUEL PAQUET appartient ce fichier
rpm -qc httpd              # seulement ses fichiers de configuration

sudo dnf install ./paquet.rpm   # installer un .rpm local : preferer dnf
sudo rpm -ivh paquet.rpm        # bas niveau : ne resout PAS les dependances`),
  note('gray', '💡 <code>rpm -qf</code> répond à une question qu’on se pose souvent', '<p>« D’où sort ce fichier ? » — devant un <code>/etc</code> inconnu, <code>rpm -qf</code> nomme le paquet responsable en une seconde. L’équivalent Debian est <code>dpkg -S</code>.</p>'),

  block('heading', { level: 3, text: 'Les dépôts, et EPEL' }),
  block('html', { html: '<p>Un dépôt est un fichier dans <code>/etc/yum.repos.d/</code>, pas une ligne dans un fichier unique :</p>' }),
  flow(`# /etc/yum.repos.d/rocky.repo
[baseos]
name=Rocky Linux $releasever - BaseOS
mirrorlist=https://mirrors.rockylinux.org/mirrorlist?arch=$basearch&repo=BaseOS-$releasever
gpgcheck=1
enabled=1
gpgkey=file:///etc/pki/rpm-gpg/RPM-GPG-KEY-Rocky-$releasever`),
  sh(`dnf repolist                                   # les depots actifs
dnf repolist --all                             # y compris les desactives
sudo dnf config-manager --set-enabled crb      # activer un depot
sudo dnf install epel-release                  # ajouter EPEL`),
  note('yellow', '⚠️ Le dépôt de base est plus pauvre que celui de Debian', '<p>C’est la deuxième surprise, et elle arrive vite : <code>htop</code>, <code>tree</code>, <code>nload</code>, <code>fail2ban</code> — beaucoup d’outils courants <strong>ne sont pas dans le dépôt de base</strong>. La priorité de RHEL est la stabilité sur dix ans, pas l’exhaustivité.</p><p>Il faut alors <strong>EPEL</strong> (<em>Extra Packages for Enterprise Linux</em>), maintenu par le projet Fedora :</p><div class="lx-cmd">sudo dnf install epel-release\nsudo dnf install htop tree fail2ban</div><p>Et <strong>CRB</strong> (<em>CodeReady Builder</em>, appelé <em>PowerTools</em> sur RHEL 8) pour les bibliothèques de développement dont EPEL a parfois besoin.</p>'),

  block('heading', { level: 2, text: '4) Les trois mécanismes qui n’existent pas côté Debian' }),
  block('html', { html: '<p>Ce sont eux qui font échouer les manipulations apprises en TP. <strong>Aucun n’est un défaut</strong> : ce sont des protections actives par défaut, là où Debian laisse la machine ouverte et confie le durcissement à l’administrateur.</p>' }),

  block('heading', { level: 3, text: 'a. firewalld — le pare-feu est allumé' }),
  block('html', { html: '<p>Sur Debian, <code>ufw</code> n’est en général ni installé ni actif : on installe un service, il répond. <strong>Sur Rocky, le pare-feu tourne dès l’installation et bloque tout sauf SSH.</strong> On installe Apache, il démarre correctement… et personne ne le joint.</p>' }),
  sh(`sudo firewall-cmd --state                          # running ?
sudo firewall-cmd --list-all                       # ce qui est ouvert

sudo firewall-cmd --add-service=http --permanent   # ouvrir par NOM DE SERVICE
sudo firewall-cmd --add-port=22320/tcp --permanent # ou par numero de port
sudo firewall-cmd --reload                         # APPLIQUER

firewall-cmd --get-services                        # les services connus par leur nom`),
  note('red', '🚫 Sans <code>--permanent</code>, la règle disparaît au redémarrage', '<p><code>firewall-cmd --add-service=http</code> agit <strong>immédiatement mais temporairement</strong>. Avec <code>--permanent</code>, la règle est écrite <strong>mais pas appliquée</strong> — il faut <code>--reload</code>.</p><p>D’où la double erreur classique : ouvrir sans <code>--permanent</code> (ça marche, puis ça casse au reboot), ou avec <code>--permanent</code> mais sans <code>--reload</code> (ça ne marche pas tout de suite, et on cherche ailleurs).</p><p><strong>La forme sûre : <code>--permanent</code> puis <code>--reload</code>.</strong></p>'),

  block('heading', { level: 3, text: 'b. SELinux — la protection qui refuse sans expliquer' }),
  block('html', { html: '<p>C’est la vraie différence culturelle entre les deux familles, et de loin la plus déroutante.</p><p>Les droits <code>rwx</code> disent <em>qui</em> a le droit d’ouvrir un fichier. <strong>SELinux dit ce que chaque programme a le droit de faire</strong>, indépendamment de l’utilisateur. Apache tournant sous <code>root</code> ne peut toujours pas lire un fichier qui ne porte pas la bonne étiquette.</p>' }),
  sh(`getenforce                 # Enforcing / Permissive / Disabled
sestatus                   # le detail

ls -Z /var/www/html/       # les ETIQUETTES des fichiers
ps -Z                      # celles des processus`),
  flow(`-rw-r--r--. root root unconfined_u:object_r:httpd_sys_content_t:s0  index.html
                                          |
                                          +-- LE TYPE : c'est lui qui compte.
                                              httpd ne lit que du httpd_sys_content_t.

  Le point apres « -rw-r--r-- » signale qu'une etiquette SELinux existe.`),
  sh(`# Remettre les etiquettes par defaut d'une arborescence
sudo restorecon -Rv /var/www/html/

# Declarer un chemin NON standard, puis appliquer
sudo dnf install policycoreutils-python-utils
sudo semanage fcontext -a -t httpd_sys_content_t "/srv/web(/.*)?"
sudo restorecon -Rv /srv/web

# Autoriser un COMPORTEMENT (booleen)
getsebool -a | grep httpd
sudo setsebool -P httpd_can_network_connect on

# Autoriser un PORT non standard
sudo semanage port -a -t http_port_t -p tcp 8080`),
  note('red', '🚫 Le symptôme : « ça devrait marcher, et ça ne marche pas »', '<p>Les droits sont bons, le service tourne, le pare-feu est ouvert — et l’on reçoit un <em>403 Forbidden</em> ou un <em>Permission denied</em> incompréhensible. <strong>Neuf fois sur dix, c’est SELinux</strong>, et il ne le dit nulle part dans le journal du service.</p><p>Il le dit dans <strong>le sien</strong> :</p><div class="lx-cmd">sudo ausearch -m avc -ts recent          # les refus recents\nsudo dnf install setroubleshoot-server\nsudo sealert -a /var/log/audit/audit.log  # les explique EN FRANCAIS, avec la commande a taper</div><p><code>sealert</code> mérite d’être installé : il ne se contente pas de signaler le refus, il propose la correction.</p>'),
  note('yellow', '⚠️ <code>setenforce 0</code> : pour diagnostiquer, jamais pour corriger', '<p><code>sudo setenforce 0</code> bascule en mode <em>Permissive</em> : SELinux journalise mais ne bloque plus. <strong>C’est un outil de diagnostic</strong> — si le problème disparaît, on a la confirmation. On remet <code>setenforce 1</code> et on corrige l’étiquette.</p><p>Le désactiver durablement dans <code>/etc/selinux/config</code> est le premier réflexe de beaucoup de tutoriels. C’est aussi la première chose que relèvera un audit de sécurité : on se prive de la protection qui distingue précisément RHEL d’une distribution ordinaire.</p>'),

  block('heading', { level: 3, text: 'c. NetworkManager — plus de fichier interfaces' }),
  block('html', { html: '<p><code>/etc/network/interfaces</code> <strong>n’existe pas</strong>. La configuration passe par <code>nmcli</code>, en ligne de commande, ou <code>nmtui</code>, en menus.</p>' }),
  sh(`nmcli con show                       # les connexions definies
nmcli dev status                     # l'etat des cartes
nmtui                                # l'interface en menus — le plus simple au debut

# Passer une carte en adresse fixe
nmcli con mod "ens18" ipv4.method manual \\
    ipv4.addresses 192.168.15.150/24 \\
    ipv4.gateway 192.168.15.254 \\
    ipv4.dns "1.1.1.1 9.9.9.9"
nmcli con up "ens18"                 # APPLIQUER

ip a ; ip r                          # verifier — identique a Debian`),
  note('blue', '💡 Le nom de la connexion n’est pas celui de la carte', '<p><code>nmcli con mod</code> attend le <strong>nom de la connexion</strong>, qui peut différer du nom de l’interface — souvent <code>System ens18</code>, ou <code>Wired connection 1</code>. Un <code>nmcli con show</code> donne les deux colonnes.</p>'),
  note('gray', '💡 Où les fichiers sont écrits', '<p>Sur RHEL 9 et Rocky 9, les connexions vivent dans <code>/etc/NetworkManager/system-connections/*.nmconnection</code>. Les anciens <code>/etc/sysconfig/network-scripts/ifcfg-*</code> <strong>ne sont plus le format de référence</strong> — on les rencontre encore dans les documentations et sur les machines migrées depuis CentOS 7.</p><p>On peut les éditer à la main, mais il faut alors <code>nmcli con reload</code> pour que NetworkManager les relise.</p>'),

  block('heading', { level: 2, text: '5) Utilisateurs et sudo : deux différences qui comptent' }),
  sh(`sudo useradd florence              # cree AUSSI le dossier personnel
sudo passwd florence
sudo usermod -aG wheel florence    # lui donner sudo : groupe WHEEL, pas « sudo »
id florence`),
  table(['', 'Debian', 'Rocky / RHEL'], [
    ['Groupe des administrateurs', '<code>sudo</code>', '<strong><code>wheel</code></strong>'],
    ['<code>useradd</code> crée le dossier personnel', '<strong>Non</strong> — il faut <code>-m</code>', '<strong>Oui, par défaut</strong>'],
    ['Shell par défaut de <code>useradd</code>', '<code>/bin/sh</code>', '<strong><code>/bin/bash</code></strong>'],
    ['<code>adduser</code>', 'Un <strong>script Perl</strong> interactif, différent de <code>useradd</code>', 'Un simple <strong>lien symbolique vers <code>useradd</code></strong> — même comportement'],
  ]),
  note('green', '🎯 Deux pièges des TP Debian disparaissent ici', '<p>Le <a href="/pages/tp-utilisateurs">TP Utilisateurs</a> fait découvrir deux surprises : <code>useradd</code> sans <code>-m</code> ne crée pas le dossier personnel, et le compte obtenu a un prompt réduit à un <code>$</code> parce que son shell est <code>/bin/sh</code>.</p><p><strong>Sur Rocky, ni l’une ni l’autre n’arrive</strong> : le dossier est créé, le shell est <code>bash</code>. Ce n’est pas que la commande soit différente — c’est que <code>/etc/login.defs</code> et <code>/etc/default/useradd</code> ne portent pas les mêmes valeurs par défaut.</p><p>Et la question du TP 1.8.1 — <em>pourquoi deux commandes ?</em> — n’a pas de sens ici : <code>adduser</code> <strong>est</strong> <code>useradd</code>, par lien symbolique. Les scripts Perl <code>adduser</code>/<code>deluser</code> sont une particularité <strong>Debian</strong>.</p>'),

  block('heading', { level: 2, text: '6) Le cas concret : changer le port SSH sur Rocky' }),
  block('html', { html: '<p>C’est l’exemple qui résume toute cette page. Le <a href="/pages/tp-ssh-securisation">TP SSH</a> fait passer le serveur sur le port 22320. Sous Debian, c’est une ligne à modifier et un service à relancer. <strong>Sous Rocky, la même manipulation échoue deux fois</strong> — et chaque échec vient d’un des mécanismes du §4.</p>' }),
  flow(`DEBIAN                          ROCKY / RHEL

1. modifier sshd_config         1. modifier sshd_config
2. systemctl restart ssh        2. semanage port -a -t ssh_port_t -p tcp 22320
                                     ^ sinon sshd REFUSE de demarrer
                                3. firewall-cmd --add-port=22320/tcp --permanent
                                   firewall-cmd --reload
                                     ^ sinon le port est bloque
                                4. systemctl restart sshd`),
  sh(`# 1. le fichier — identique a Debian
sudo nano /etc/ssh/sshd_config          # Port 22  ->  Port 22320

# 2. SELINUX : autoriser sshd a ecouter sur ce port
sudo dnf install policycoreutils-python-utils
sudo semanage port -a -t ssh_port_t -p tcp 22320
sudo semanage port -l | grep ssh        # verifier

# 3. FIREWALLD : ouvrir le port
sudo firewall-cmd --add-port=22320/tcp --permanent
sudo firewall-cmd --reload

# 4. relancer, et verifier
sudo systemctl restart sshd
sudo ss -tlnp | grep sshd`),
  note('red', '🚫 Sans l’étape 2, le service ne démarre pas du tout', '<p>Le message n’est pas explicite :</p><div class="lx-cmd">error: Bind to port 22320 on 0.0.0.0 failed: Permission denied.</div><p>« Permission denied » alors qu’on est root : c’est la signature d’un refus SELinux. Sans le <code>semanage port</code>, <code>sshd</code> n’a tout simplement pas le droit de se poser sur ce port-là.</p><p>Et si l’on saute l’étape 3, le service démarre normalement — mais aucune connexion n’arrive. <strong>Les deux échecs sont distincts et se diagnostiquent différemment</strong> : le premier dans <code>systemctl status</code>, le second dans un <code>ss -tlnp</code> qui montre le service en écoute alors que le client expire.</p>'),
  note('green', '🎯 La méthode, sur toute la famille Red Hat', '<p>Quand quelque chose ne marche pas alors que tout semble correct, il y a <strong>trois suspects, dans cet ordre</strong> :</p><ol><li><strong>Le service</strong> — <code>systemctl status</code>, et lire le journal.</li><li><strong>Le pare-feu</strong> — <code>firewall-cmd --list-all</code>.</li><li><strong>SELinux</strong> — <code>sudo ausearch -m avc -ts recent</code>.</li></ol><p>Sur Debian, seul le premier existe. C’est toute la différence d’expérience entre les deux familles.</p>'),

  block('heading', { level: 2, text: '7) Les noms et les chemins qui changent' }),
  table(['', 'Debian', 'Rocky / RHEL'], [
    ['Serveur web — paquet', '<code>apache2</code>', '<code>httpd</code>'],
    ['Serveur web — configuration', '<code>/etc/apache2/</code>', '<code>/etc/httpd/conf/httpd.conf</code><br><code>/etc/httpd/conf.d/</code>'],
    ['Activer un site', '<code>a2ensite</code> / <code>sites-available</code>', '<strong>N’existe pas</strong> : un <code>.conf</code> dans <code>conf.d/</code> est actif d’office'],
    ['Activer un module', '<code>a2enmod</code>', '<strong>N’existe pas</strong> : un fichier dans <code>/etc/httpd/conf.modules.d/</code>'],
    ['Utilisateur du serveur web', '<code>www-data</code>', '<strong><code>apache</code></strong>'],
    ['Racine web par défaut', '<code>/var/www/html</code>', '<code>/var/www/html</code> — identique'],
    ['Réglages d’un service', '<code>/etc/default/nom</code>', '<code>/etc/sysconfig/nom</code>'],
    ['Journal général', '<code>/var/log/syslog</code>', '<code>/var/log/messages</code>'],
    ['Journal d’authentification', '<code>/var/log/auth.log</code>', '<code>/var/log/secure</code>'],
    ['Unité SSH', '<code>ssh.service</code>', '<strong><code>sshd.service</code></strong>'],
  ]),
  note('yellow', '⚠️ Sur Rocky, c’est bien <code>sshd</code>, pas <code>ssh</code>', '<p>Le <a href="/pages/linux-ssh">cours SSH</a> signale que sur Debian l’unité s’appelle <code>ssh.service</code>, <code>sshd.service</code> n’étant qu’un alias. <strong>Sur la famille Red Hat, c’est l’inverse</strong> : l’unité est <code>sshd.service</code>, et il n’y a pas d’alias <code>ssh</code>.</p><p>C’est pourquoi les documentations écrivent <code>systemctl status sshd</code> — elles sont souvent d’origine Red Hat.</p>'),
  note('blue', '💡 Apache : la différence de philosophie tient en une phrase', '<p>Debian sépare « disponible » et « activé » (<code>sites-available</code> / <code>sites-enabled</code>, avec <code>a2ensite</code> pour faire le lien). <strong>Red Hat ne sépare pas</strong> : tout fichier <code>.conf</code> déposé dans <code>/etc/httpd/conf.d/</code> est lu au démarrage.</p><p>Pour désactiver un site, on renomme le fichier ou on le déplace. C’est plus direct, et un peu moins sûr.</p>'),

  block('heading', { level: 2, text: '8) Les disques : XFS par défaut' }),
  block('html', { html: '<p>RHEL et ses reconstructions formatent en <strong>XFS</strong>, là où Debian utilise <code>ext4</code>. L’installateur met aussi <strong>LVM en place par défaut</strong>, ce que l’installateur Debian propose sans l’imposer.</p>' }),
  table(['', 'ext4 (Debian)', 'XFS (Rocky)'], [
    ['Agrandir à chaud', 'Oui', 'Oui'],
    ['<strong>Réduire</strong>', 'Oui', '<strong>Non — impossible</strong>'],
    ['Vérifier', '<code>fsck.ext4</code>', '<code>xfs_repair</code>'],
    ['Agrandir', '<code>resize2fs</code>', '<code>xfs_growfs</code>'],
  ]),
  note('red', '🚫 Un volume XFS ne se réduit pas', '<p>C’est une limite du format, pas un manque d’outil. Si l’on a donné 400 Go à <code>/var</code> et 20 Go à <code>/home</code>, on ne peut <strong>pas</strong> reprendre les 300 Go inutilisés de <code>/var</code> : il faut sauvegarder, détruire, recréer plus petit, restaurer.</p><p>Conséquence pratique : sur Rocky, <strong>on découpe petit et on agrandit ensuite</strong>. LVM est là pour cela — et c’est justement pourquoi l’installateur le met par défaut.</p>'),

  block('heading', { level: 2, text: '9) Le mémo' }),
  flow(`PAQUETS      dnf install / remove / upgrade / search
             dnf provides */commande        quel paquet fournit ceci
             dnf history undo N             ANNULER une transaction
             rpm -qa / -ql / -qf            bas niveau
             dnf install epel-release       les paquets manquants

PARE-FEU     firewall-cmd --list-all
             firewall-cmd --add-port=N/tcp --permanent
             firewall-cmd --reload          NE PAS OUBLIER

SELINUX      getenforce                     Enforcing ?
             ls -Z / ps -Z                  les etiquettes
             restorecon -Rv /chemin         remettre par defaut
             semanage port -a -t X -p tcp N un port non standard
             ausearch -m avc -ts recent     POURQUOI ca a ete refuse

RESEAU       nmtui                          le plus simple
             nmcli con show / mod / up

COMPTES      usermod -aG wheel jean         donner sudo

QUAND CA NE MARCHE PAS :  service  ->  pare-feu  ->  SELinux`),

  note('blue', '🔗 Pour pratiquer', '<p>Rocky Linux s’installe en machine virtuelle exactement comme Debian — <a href="https://rockylinux.org/download" target="_blank" rel="noopener">l’image <em>minimal</em></a> suffit. Refaire dessus les TP <a href="/pages/tp-utilisateurs">Utilisateurs</a>, <a href="/pages/tp-ssh-securisation">SSH</a> et <a href="/pages/tp-config-reseau-statique">IP statique</a> est le meilleur moyen de fixer les différences : ce sont précisément ceux qui butent.</p>'),
  liens('/pages/linux-redhat'),
];

publier(PAGE, blocks).catch(e => { console.error(e); process.exit(1); });

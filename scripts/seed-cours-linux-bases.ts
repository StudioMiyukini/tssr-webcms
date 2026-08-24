/* Cours « Linux : les bases (Debian) » — arborescence, commandes essentielles, utilisateurs & droits,
   paquets, services systemd, réseau. Premier cours du track Linux.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-linux-bases.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'linux-bases', title: 'Linux : les bases (Debian)', excerpt: 'Prendre en main un serveur Linux : arborescence des fichiers, commandes essentielles (navigation, fichiers, recherche), utilisateurs & groupes, permissions (rwx / chmod / chown), gestion des paquets (apt), services (systemctl) et réseau.' };
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const styleBlock = block('html', { html: `<style>.lx-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}.lx-t{border-collapse:collapse;width:100%;font-size:13px;margin:6px 0}.lx-t th,.lx-t td{border:1px solid var(--border);padding:6px 10px;text-align:left}.lx-t th{background:var(--surface-2)}.lx-t td:first-child{font-family:ui-monospace,monospace;white-space:nowrap;font-weight:600}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="lx-cmd">${esc(t)}</div>` });
const tbl = (head: string[], rows: string[][]) => block('html', { html: `<table class="lx-t"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>` });

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Linux', title: PAGE.title, subtitle: 'Le minimum vital pour administrer un serveur Linux en ligne de commande.' }),
  styleBlock,
  block('html', { html: '<p><strong>Linux</strong> équipe la majorité des serveurs (web, DNS, fichiers…). En TSSR, on l’administre surtout <strong>en ligne de commande</strong> (souvent en SSH), généralement sur une distribution <strong>Debian</strong>. Ce cours donne les fondations ; les services (SSH, Apache, Samba) font l’objet de cours dédiés.</p>' }),
  note('blue', '🧭 Repères', '<p><strong>Tout est fichier</strong> sous Linux. On distingue l’utilisateur normal (invite <code>$</code>) du <strong>super-utilisateur root</strong> (invite <code>#</code>). On élève ses droits avec <code>sudo</code> devant une commande. Linux est <strong>sensible à la casse</strong> (<code>Fichier</code> ≠ <code>fichier</code>).</p>'),

  block('heading', { level: 2, text: '1) Un système d’exploitation, et pourquoi Linux' }),
  block('html', { html: '<p>Un <strong>système d’exploitation</strong> est le programme qui se place entre le matériel et les applications. Il distribue le processeur et la mémoire, parle aux disques et aux cartes réseau, et empeche qu’un programme aille lire ce qui ne le regarde pas. Sans lui, chaque application devrait connaître chaque modèle de carte du marché.</p>' }),
  block('html', { html: '<p><strong>Linux</strong> désigne précisément le <em>noyau</em>. Ce qu’on installe s’appelle plus justement <strong>GNU/Linux</strong> : le noyau Linux, entouré des outils GNU qui le rendent utilisable. C’est un <strong>logiciel libre</strong> — le code est lisible, modifiable et redistribuable, ce qui explique qu’on le trouve du téléphone au superordinateur.</p>' }),
  tbl(['Où on le rencontre', 'Pourquoi lui'], [
    ['<strong>Serveurs</strong>', 'Stable, léger, administrable à distance, sans licence par machine.'],
    ['<strong>Cloud</strong>', 'La grande majorité des instances louées chez un hébergeur tournent dessus.'],
    ['<strong>Cybersécurité</strong>', 'Les outils d’analyse et de test y sont nés ; on peut inspecter ce que fait le système.'],
    ['<strong>Embarqué</strong>', 'Box, NAS, automates, Android — souvent sans que l’utilisateur le sache.'],
    ['<strong>Poste de travail</strong>', 'Possible, mais c’est l’usage le moins répandu en entreprise.'],
  ]),
  note('blue', '🧭 En TSSR, on l’apprend pour le serveur', '<p>Un technicien rencontre Linux sur des serveurs, des équipements et des machines virtuelles — rarement sur le poste des utilisateurs, qui reste sous Windows dans la plupart des entreprises. C’est pourquoi ce cours travaille <strong>en ligne de commande</strong> et sans interface graphique.</p>'),

  block('heading', { level: 3, text: 'Un peu d’histoire' }),
  tbl(['Année', 'Événement'], [
    ['<strong>1969</strong>', 'Ken Thompson développe la première version d’un système mono-utilisateur qui deviendra <strong>Unix</strong>.'],
    ['1981', 'Microsoft sort <strong>MS-DOS</strong>.'],
    ['<strong>1984</strong>', 'Richard Stallman lance le projet <strong>GNU</strong> — <em>GNU is Not Unix</em> — pour répondre à la montée des prix d’Unix. Il crée les programmes de base : copie de fichiers, éditeur de texte, compilateur.'],
    ['<strong>1991</strong>', 'Linus Torvalds écrit un noyau libre : <strong>Linux</strong>, contraction de <em>Linus</em> et <em>Unix</em>. Il lui manquait les programmes ; GNU les avait, il lui manquait un noyau.'],
    ['1996', 'Le logo : un manchot pygmée nommé <strong>Tux</strong> (<em>Torvalds UniX</em>) — une mascotte chétive choisie face au géant Unix.'],
  ]),
  note('gray', '💡 Les noyaux des autres systèmes', '<p>Chaque système a le sien : <strong>Linux</strong> pour GNU/Linux, <strong>NT</strong> pour Windows, <strong>Mach</strong> pour macOS — lui-même dérivé d’Unix. C’est pourquoi beaucoup de commandes de ce cours fonctionnent aussi dans un terminal Mac.</p>'),

  block('heading', { level: 2, text: '2) Le noyau' }),
  block('html', { html: '<p>Le <strong>noyau</strong> (<em>kernel</em>) est la partie du système qui parle au matériel. Il est le seul à y accéder directement : tout le reste passe par lui en le lui demandant.</p>' }),
  tbl(['Ce que fait le noyau', 'Concrètement'], [
    ['Gérer les processus', 'Décide quel programme occupe le processeur, et quand.'],
    ['Gérer la mémoire', 'Attribue la RAM, isole les programmes les uns des autres.'],
    ['Parler au matériel', 'Par les <strong>pilotes</strong> : disques, cartes réseau, USB.'],
    ['Gérer les fichiers', 'Traduit « lire /etc/passwd » en accès disque.'],
    ['Séparer les droits', 'Distingue ce que peut faire root de ce que peut faire un utilisateur.'],
  ]),
  block('html', { html: '<div class="lx-cmd">uname -r                   # la version du noyau en cours\nuname -a                   # noyau, architecture, nom de machine\ncat /etc/os-release        # la DISTRIBUTION, ce qui est different</div>' }),
  note('gray', '💡 Noyau et distribution ne se confondent pas', '<p><code>uname -r</code> répond « 6.1.0-18-amd64 » : c’est le noyau. <code>cat /etc/os-release</code> répond « Debian 12 » : c’est la distribution. Deux distributions différentes peuvent faire tourner le même noyau, et une même distribution en propose plusieurs versions.</p>'),

  block('heading', { level: 2, text: '3) Les distributions' }),
  block('html', { html: '<p>Une <strong>distribution</strong> est un ensemble prêt à l’emploi : <strong>noyau + logiciels + outils d’installation et d’administration</strong>, assemblés et testés ensemble par un éditeur ou une communauté. Personne n’installe « Linux » : on installe Debian, Ubuntu ou Red Hat.</p>' }),
  tbl(['Famille', 'Distributions', 'Paquets', 'Où on la rencontre'], [
    ['<strong>Debian</strong>', 'Debian, Ubuntu, Mint', '<code>.deb</code> · <code>apt</code>', 'Serveurs, cloud, formation. Debian stable est la référence en entreprise.'],
    ['<strong>Red Hat</strong>', 'RHEL, Rocky, AlmaLinux, Fedora', '<code>.rpm</code> · <code>dnf</code>', 'Grandes entreprises, avec support commercial.'],
    ['<strong>SUSE</strong>', 'SLES, openSUSE', '<code>.rpm</code> · <code>zypper</code>', 'Industrie, SAP.'],
    ['<strong>Arch</strong>', 'Arch, Manjaro', '<code>pacman</code>', 'Postes personnels. Peu répandu en production.'],
  ]),
  note('yellow', '⚠️ Une distribution de bureau n’est pas une distribution serveur', '<p>C’est l’erreur qui coûte le plus cher à moyen terme. Une version « bureau » privilégie la nouveauté : versions récentes, cycle court, support de quelques mois, interface graphique installée. Une version serveur privilégie la <strong>durée</strong> : versions figées, correctifs de sécurité pendant cinq ans ou plus, aucun logiciel superflu.</p><p>Monter un serveur sur une distribution de bureau, c’est accepter de le réinstaller tous les neuf mois — ou de le laisser sans correctifs.</p>'),
  block('heading', { level: 3, text: 'Debian, celle de la formation' }),
  block('html', { html: '<p>Lancée en <strong>1993 par Ian Murdock</strong> avec le soutien de la Free Software Foundation, avec un but affiché : un système composé à <strong>100 % de logiciels libres</strong>. Elle n’appartient à aucune entreprise — c’est la seule grande distribution portée par une communauté de développeurs indépendants, ce qui explique sa réputation de stabilité : rien n’y est publié pour tenir un calendrier commercial.</p><p>Plus de <strong>59 000 paquets</strong>, une dizaine d’architectures de processeurs, et un dérivé très connu : <strong>Ubuntu</strong>.</p>' }),
  note('gray', '🧸 Les noms de code viennent de Toy Story', '<p>Buzz, Rex, Bo, Woody, Bullseye, Bookworm… En 1996, Bruce Perens succède à Ian Murdock à la tête du projet ; il travaillait chez <strong>Pixar</strong>, alors en train de produire le film. Debian 1.1 est devenue « Buzz », et la tradition n’a plus cessé. Un nom se retient mieux qu’un numéro — et sur un serveur, on parle souvent de « bookworm » plutôt que de « Debian 12 ».</p>'),

  note('yellow', '⚠️ Les paquets ne se mélangent pas entre familles', '<p>Un <code>.deb</code> ne s’installe pas sur une Red Hat, et un dépôt prévu pour Ubuntu 24.04 installé sur une Debian 12 casse les dépendances — parfois des mois plus tard, à la première mise à jour. On reste dans les dépôts de sa distribution et de sa version.</p>'),

  block('heading', { level: 2, text: '4) Interfaces et outils' }),
  tbl(['', 'CLI — ligne de commande', 'GUI — interface graphique'], [
    ['Ressources', '<strong>Quelques Mo de RAM</strong>', 'Plusieurs centaines de Mo, et un processeur occupé à dessiner'],
    ['À distance', 'SSH, sur une liaison lente ou saturée', 'Demande une session graphique, lourde à relayer'],
    ['Répétition', '<strong>Se scripte</strong> : cent serveurs comme un seul', 'Se refait à la main, cent fois'],
    ['Traçabilité', 'L’historique dit ce qui a été fait', 'Aucune trace des clics'],
    ['Apprentissage', 'Il faut connaître les commandes', '<strong>Plus intuitive pour débuter</strong>'],
    ['Surface d’attaque', 'Réduite : moins de code installé', 'Plus large : navigateur, pilotes, services graphiques'],
  ]),
  note('green', '🎯 En entreprise : pas d’interface graphique sur un serveur', '<p>Elle consomme des ressources que rien ne justifie, ajoute des vulnérabilités à corriger, et empêche d’automatiser. La règle tient en une phrase : <strong>on n’installe aucun environnement de bureau sur un serveur</strong>, et on l’administre à distance par SSH. Voir l’installation, section 12.</p>'),
  block('html', { html: '<p>Le <strong>shell</strong> est le programme qui lit les commandes et les exécute : c’est <em>le</em> CLI de Linux, et l’outil central de l’administration.</p>' }),
  tbl(['Shell', 'Ce qu’il est'], [
    ['<code>sh</code>', 'Le shell minimal, présent partout. C’est celui que visent les scripts portables.'],
    ['<code>bash</code>', '<strong>Le plus répandu</strong>, celui de Debian et Ubuntu par défaut. Ce cours l’utilise.'],
    ['<code>zsh</code>', 'Plus confortable (complétion, invite riche). Courant sur les postes, rare sur les serveurs.'],
  ]),
  block('html', { html: '<div class="lx-cmd">echo $SHELL                # quel shell j\'utilise\ncat /etc/shells            # ceux qui sont installes\nchsh -s /bin/bash          # en changer pour son compte</div>' }),

  block('heading', { level: 2, text: '5) L’arborescence des fichiers — « tout est fichier »' }),
  block('html', { html: '<p>Un seul arbre partant de la racine <code>/</code> (pas de <code>C:</code>). Les répertoires clés :</p>' }),
  tbl(['Chemin', 'Contenu'], [
    ['/etc', 'fichiers de <strong>configuration</strong> (le cœur de l’admin)'],
    ['/home', 'dossiers personnels des utilisateurs'],
    ['/var', 'données variables : <strong>logs</strong> (/var/log), sites web, bases…'],
    ['/root', 'dossier personnel de <strong>root</strong>'],
    ['/bin, /usr/bin', 'programmes / commandes'],
    ['/tmp', 'fichiers temporaires'],
    ['/dev', 'périphériques (disques : /dev/sda…)'],
    ['/mnt', 'point de <strong>montage temporaire</strong> : on y accroche une clé, un partage réseau, un disque le temps d’une intervention'],
    ['/media', 'montages <strong>automatiques</strong> des supports amovibles (clés USB, CD)'],
    ['/opt', 'logiciels installés <strong>hors gestionnaire de paquets</strong> : chacun dans son sous-dossier'],
    ['/proc', '<strong>vue du noyau</strong>, pas un vrai dossier : un dossier par processus, et l’état du système'],
    ['/sys', '<strong>vue du matériel</strong> : périphériques, pilotes, réglages du noyau'],
  ]),

  note('blue', '💡 /proc et /sys ne sont pas sur le disque', '<p>Ce sont des <strong>systèmes de fichiers virtuels</strong> : le noyau les fabrique à la volée quand on les lit. Rien n’y occupe d’espace, et rien n’y survit au redémarrage. C’est ce qui explique le détail troublant : <code>ls -l /proc/cpuinfo</code> annonce <strong>0 octet</strong> alors que <code>cat</code> en affiche cinquante lignes. La taille n’existe qu’au moment de la lecture.</p>'),

  block('html', { html: '<p>Ce qu’on y lit vraiment, au quotidien :</p>' }),
  block('html', { html: '<div class="lx-cmd">'
    + 'cat /proc/cpuinfo          # processeur : modele, nombre de coeurs\n'
    + 'cat /proc/meminfo          # memoire : totale, libre, cache\n'
    + 'cat /proc/mounts           # ce qui est REELLEMENT monte\n'
    + 'cat /proc/uptime           # depuis combien de secondes la machine tourne\n'
    + 'ls /proc/1234/             # tout sur le processus 1234 (PID)\n'
    + 'cat /proc/1234/cmdline     # avec quelle ligne de commande il a demarre\n'
    + '\n'
    + 'ls /sys/class/net/         # les interfaces reseau vues par le noyau\n'
    + 'cat /sys/class/net/ens18/address    # adresse MAC\n'
    + 'cat /sys/block/sda/size    # taille du disque, en secteurs de 512 o'
    + '</div>' }),
  note('gray', '🧭 À quoi ça sert en dépannage', '<p>Les commandes usuelles ne font souvent que <strong>mettre en forme</strong> ces fichiers : <code>free</code> lit <code>/proc/meminfo</code>, <code>ps</code> parcourt les dossiers de <code>/proc</code>, <code>df</code> s’appuie sur <code>/proc/mounts</code>. Le savoir dépanne le jour où un outil manque sur une machine minimale ou dans un conteneur : la source, elle, est toujours là.</p>'),
  note('yellow', '⚠️ Écrire dans /proc et /sys agit immédiatement', '<p>Certains fichiers sont modifiables et changent le comportement du noyau à la seconde — activer le routage, par exemple : <code>echo 1 &gt; /proc/sys/net/ipv4/ip_forward</code>. Mais <strong>rien n’est conservé au redémarrage</strong> : pour que le réglage tienne, il faut l’écrire dans <code>/etc/sysctl.conf</code> ou <code>/etc/sysctl.d/</code>. C’est la cause classique du « ça marchait hier » après un redémarrage.</p>'),
  note('gray', '📦 /opt, /usr/local et les paquets', '<p><code>apt</code> installe dans <code>/usr</code> : on n’y touche pas à la main, le gestionnaire de paquets en est propriétaire. Ce qu’on ajoute soi-même va dans <code>/opt</code> (un logiciel livré en bloc, chacun dans son dossier) ou <code>/usr/local</code> (ce qu’on a compilé soi-même). La séparation a un but précis : une mise à jour du système n’écrase jamais ce qui est dans <code>/opt</code>.</p>'),
  note('yellow', '⚠️ /mnt : monter n’efface pas, ça masque', '<p>Monter un support sur un dossier <strong>non vide</strong> ne supprime rien : le contenu d’origine disparaît de la vue tant que le montage tient, et réapparaît au démontage. C’est la façon classique de croire qu’on a perdu des données. → <a href="/pages/linux-disques">Disques, partitions et LVM</a>.</p>'),

  block('heading', { level: 2, text: '6) Se déplacer et manipuler les fichiers' }),
  tbl(['Commande', 'Rôle'], [
    ['pwd', 'affiche le répertoire courant'],
    ['ls -l / ls -la', 'liste (détaillé / avec fichiers cachés)'],
    ['cd /etc, cd .., cd ~', 'se déplacer (dossier, parent, home)'],
    ['cp source dest', 'copier (<code>-r</code> pour un dossier)'],
    ['mv source dest', 'déplacer / renommer'],
    ['rm fichier', 'supprimer (<code>-r</code> dossier, <code>-f</code> forcer)'],
    ['mkdir / rmdir', 'créer / supprimer un dossier'],
    ['cat / less / tail -f', 'afficher / paginer / suivre un fichier (log)'],
    ['nano / vim', 'éditer un fichier texte'],
  ]),
  note('gray', '🔎 Chercher & enchaîner', '<p><code>find /etc -name "*.conf"</code> cherche des fichiers ; <code>grep motif fichier</code> cherche du texte. Le <strong>pipe</strong> <code>|</code> enchaîne : <code>cat /etc/passwd | grep jean</code>. La <strong>redirection</strong> <code>&gt;</code> écrit dans un fichier, <code>&gt;&gt;</code> ajoute à la fin.</p>'),

  block('heading', { level: 2, text: '7) Utilisateurs & groupes' }),
  cmd(`sudo adduser jean            # créer un utilisateur (interactif)
sudo passwd jean             # (re)définir son mot de passe
sudo usermod -aG sudo jean   # l'ajouter au groupe sudo (droits admin)
groups jean                  # voir ses groupes
sudo deluser jean            # supprimer`),
  block('html', { html: '<p>Les comptes sont dans <code>/etc/passwd</code>, les groupes dans <code>/etc/group</code>, les mots de passe (hachés) dans <code>/etc/shadow</code>.</p>' }),

  block('heading', { level: 2, text: '8) Les permissions (rwx)' }),
  block('html', { html: '<p>Chaque fichier a un <strong>propriétaire</strong>, un <strong>groupe</strong> et des droits pour trois catégories : <strong>u</strong>ser (propriétaire), <strong>g</strong>roup, <strong>o</strong>ther. Trois droits : <strong>r</strong>ead (4), <strong>w</strong>rite (2), e<strong>x</strong>ecute (1). <code>ls -l</code> les montre : <code>-rwxr-x---</code>.</p>' }),
  tbl(['Notation', 'Signification'], [
    ['rwx = 7', 'lecture + écriture + exécution'],
    ['rw- = 6', 'lecture + écriture'],
    ['r-x = 5', 'lecture + exécution'],
    ['r-- = 4', 'lecture seule'],
  ]),
  cmd(`chmod 750 script.sh          # u=rwx, g=r-x, o=--- (numérique)
chmod u+x script.sh          # ajouter exécution au propriétaire (symbolique)
chown jean:admins fichier    # changer propriétaire:groupe
chmod -R 755 /var/www        # récursif sur un dossier`),
  note('yellow', '💡 Lire un rwx', '<p><code>-rwxr-x---</code> : fichier (<code>-</code>), propriétaire = <strong>rwx</strong>, groupe = <strong>r-x</strong>, autres = <strong>---</strong>. Soit <strong>750</strong>. Pour un dossier, <code>x</code> = droit d’y <em>entrer</em>.</p>'),

  block('heading', { level: 2, text: '9) Installer des paquets (apt)' }),
  cmd(`sudo apt update              # met à jour la liste des paquets
sudo apt upgrade             # met à jour les paquets installés
sudo apt install apache2     # installer un paquet
sudo apt remove apache2      # désinstaller
apt search samba             # rechercher`),
  block('html', { html: '<p>Debian/Ubuntu utilisent <strong>apt</strong> (paquets <code>.deb</code>). D’autres familles utilisent <code>yum</code>/<code>dnf</code> (Red Hat/CentOS).</p>' }),

  block('heading', { level: 2, text: '10) Gérer les services (systemd)' }),
  cmd(`systemctl status ssh         # état d'un service
sudo systemctl start ssh     # démarrer
sudo systemctl stop ssh      # arrêter
sudo systemctl restart ssh   # redémarrer
sudo systemctl enable ssh    # démarrage automatique au boot
sudo systemctl disable ssh   # désactiver au boot
journalctl -u ssh            # journaux du service`),

  block('heading', { level: 2, text: '11) Réseau' }),
  cmd(`ip a                         # adresses IP des interfaces (ex ifconfig)
ip r                         # table de routage / passerelle
ping 8.8.8.8                 # test connectivité
cat /etc/resolv.conf         # serveurs DNS
# IP fixe : /etc/network/interfaces (Debian) ou Netplan (Ubuntu récent)`),
  note('gray', '🔧 IP fixe Debian (extrait)', '<div class="lx-cmd"># /etc/network/interfaces\nauto ens33\niface ens33 inet static\n    address 192.168.10.20/24\n    gateway 192.168.10.254\n    dns-nameservers 192.168.10.1</div><p>Puis <code>sudo systemctl restart networking</code>.</p>'),

  note('green', '🔗 Suite du track Linux', '<p>À venir : <strong>SSH serveur</strong>, <strong>Apache</strong> (serveur web), <strong>Samba</strong> (partage de fichiers vers Windows). Cours liés : <a href="/pages/le-ssh">Le SSH</a>, <a href="/pages/systemes-de-fichiers">Les systèmes de fichiers</a>, <a href="/pages/permissions-partage-ntfs">Permissions (Windows)</a> pour comparer.</p>'),

  block('heading', { level: 2, text: '12) Se connecter à la machine' }),
  tbl(['Accès', 'Quand', 'Limite'], [
    ['<strong>Console directe</strong>', 'Installation, machine sans réseau, dépannage à froid.', 'Il faut être devant, ou passer par la console de l’hyperviseur.'],
    ['<strong>SSH</strong>', '<strong>Le cas normal</strong> : toute l’administration courante.', 'Suppose une adresse IP et le service <code>sshd</code> démarré.'],
  ]),
  block('html', { html: '<p><strong>SSH</strong> (<em>Secure Shell</em>) ouvre un terminal distant dans un canal chiffré. Il écoute sur le <strong>port 22</strong> par défaut, et c’est l’outil sans lequel on n’administre pas un serveur Linux.</p>' }),
  block('html', { html: '<div class="lx-cmd">ssh jean@192.168.10.20            # se connecter\nssh -p 2222 jean@srv.miyukini.lan  # sur un autre port\nscp fichier.tar.gz jean@srv:/srv/  # copier un fichier\n\nsystemctl status ssh               # le service tourne-t-il ?\nsudo systemctl enable --now ssh    # le demarrer, et au boot</div>' }),
  block('html', { html: '<p>Trois façons de prouver son identité, de la plus faible à la plus solide :</p>' }),
  tbl(['Méthode', 'Ce qu’elle vaut'], [
    ['Utilisateur + mot de passe', 'Simple, mais exposée au <strong>bourrage d’identifiants</strong> : un serveur sur Internet reçoit des milliers de tentatives par jour.'],
    ['<strong>Clé de chiffrement</strong>', 'Une paire privée/publique. La clé privée ne quitte jamais le poste. <strong>C’est la méthode à privilégier.</strong>'],
    ['Clé + phrase de passe', 'La clé est elle-même protégée : un poste volé ne donne pas l’accès.'],
  ]),
  block('html', { html: '<div class="lx-cmd">ssh-keygen -t ed25519 -C \'jean@poste\'    # generer la paire\nssh-copy-id jean@192.168.10.20            # deposer la cle publique\nssh jean@192.168.10.20                    # plus de mot de passe demande</div>' }),
  note('yellow', '⚠️ Changer le port 22 : ce que ça apporte, et ce que ça n’apporte pas', '<p>Déplacer SSH sur un autre port fait disparaître <strong>l’essentiel du bruit</strong> : les balayages automatiques visent le 22 et passent leur chemin. Les journaux redeviennent lisibles, ce qui n’est pas rien.</p><p>En revanche ce n’est <strong>pas une sécurité</strong> : un balayage de ports retrouve le service en quelques secondes. Ce qui protège vraiment, c’est l’authentification par clé, l’interdiction de la connexion directe en root, et le filtrage des adresses autorisées.</p>'),
  block('html', { html: '<div class="lx-cmd"># /etc/ssh/sshd_config — les trois lignes qui comptent\nPort 2222\nPermitRootLogin no                # jamais de root en direct\nPasswordAuthentication no         # cle uniquement (APRES avoir teste sa cle !)\n\nsudo systemctl restart ssh</div>' }),
  note('red', '🚫 Garder une session ouverte pendant le test', '<p>Passer <code>PasswordAuthentication no</code> sans avoir vérifié que sa clé fonctionne ferme la porte définitivement — il faut alors la console de l’hyperviseur pour rentrer. On garde <strong>la session en cours ouverte</strong>, on en ouvre une seconde pour tester, et on ne ferme la première qu’une fois sûr.</p>'),
  note('gray', '🖥️ La VM Linux du TP', '<p>Elle se crée avec un <strong>commutateur externe</strong> : la machine obtient alors une adresse sur le réseau physique, donc joignable en SSH depuis le poste. Un commutateur interne ou privé l’isolerait, et il faudrait passer par la console de l’hyperviseur pour tout.</p>'),

  block('heading', { level: 2, text: '13) Les dépôts (repositories)' }),
  block('html', { html: '<p>Un <strong>dépôt</strong> est un serveur qui héberge les paquets de la distribution, signés cryptographiquement. <code>apt install</code> ne télécharge rien au hasard sur le web : il va chercher dans les dépôts déclarés, vérifie la signature, puis installe — avec les dépendances.</p>' }),
  block('html', { html: '<div class="lx-cmd">cat /etc/apt/sources.list          # les depots declares\nls /etc/apt/sources.list.d/        # ceux ajoutes par des logiciels tiers\n\nsudo apt update                    # rafraichir la LISTE (pas les logiciels)\napt policy nginx                   # d\'ou viendrait ce paquet, et en quelle version</div>' }),
  tbl(['Section Debian', 'Ce qu’elle contient'], [
    ['<code>main</code>', 'Libre, supporté officiellement. <strong>C’est là qu’on reste.</strong>'],
    ['<code>contrib</code>', 'Libre, mais dépend de composants non libres.'],
    ['<code>non-free</code>', 'Non libre : surtout des pilotes et des micrologiciels.'],
    ['<code>security</code>', '<strong>Les correctifs de sécurité.</strong> Ne jamais le retirer.'],
  ]),
  note('yellow', '⚠️ Ajouter un dépôt tiers n’est pas anodin', '<p>Un dépôt extérieur peut remplacer des paquets du système par ses propres versions, et vous devenez dépendant de celui qui le maintient — y compris pour la sécurité. On n’en ajoute que si le logiciel n’existe pas dans la distribution, on épingle sa priorité, et on note pourquoi il est là.</p>'),
  note('gray', '💡 <code>apt update</code> ne met rien à jour', '<p>Il rafraîchit la <strong>liste</strong> de ce qui est disponible. C’est <code>apt upgrade</code> qui installe. D’où l’enchaînement habituel : <code>apt update &amp;&amp; apt upgrade</code>. Un <code>apt install</code> lancé sur une machine restée éteinte échoue souvent pour cette raison — sa liste pointe vers des versions qui n’existent plus dans le dépôt.</p>'),

  block('heading', { level: 2, text: '14) Installer un serveur Debian' }),
  block('html', { html: '<p>Avec l’image <code>debian-12-amd64-netinst</code>, sur une machine virtuelle créée au préalable — disque, mémoire, <strong>carte réseau en commutateur externe</strong>, et l’ISO montée.</p>' }),
  note('blue', '⌨️ On oublie la souris', '<p>L’installateur Debian est en mode texte. <strong>Flèches</strong> pour se déplacer dans une liste, <strong>Espace</strong> pour cocher ou décocher, <strong>Tabulation</strong> pour passer d’une zone à l’autre, <strong>Entrée</strong> pour valider. Au menu de démarrage, on choisit <em>Install</em>.</p>'),

  block('heading', { level: 3, text: 'Langue, pays, clavier' }),
  block('html', { html: '<p>Français, France, clavier français. Le choix de la langue vaut pour l’installation <em>et</em> pour les messages du système ensuite ; celui du clavier évite de chercher pourquoi le mot de passe est refusé alors qu’on l’a bien tapé — en AZERTY sur un clavier déclaré QWERTY.</p>' }),

  block('heading', { level: 3, text: 'Nom de machine et domaine' }),
  tbl(['Champ', 'La règle de la formation', 'Exemple'], [
    ['<strong>Nom de machine</strong>', '<code>os</code> + ton prénom (et la 1re lettre du nom si plusieurs).', '<code>osmorgane</code>'],
    ['<strong>Domaine</strong>', 'Un nom + un TLD. En réseau local, le TLD est <code>.lan</code>. <strong>Différent pour chacun</strong>, sinon les machines se marchent dessus.', '<code>pandora.lan</code>'],
  ]),
  note('yellow', '⚠️ Ni majuscules ni caractères spéciaux', '<p>Le nom de machine circule sur le réseau, entre dans le DNS et se retrouve dans l’invite du shell. Une majuscule ou un accent produit des comportements incohérents selon les outils. Minuscules et tirets, rien d’autre.</p>'),

  block('heading', { level: 3, text: 'Les comptes' }),
  tbl(['Compte', 'Rôle', 'En formation'], [
    ['<strong>root</strong>', 'Le superutilisateur — l’équivalent d’Administrateur sous Windows. Il peut tout, sans confirmation.', 'Mot de passe <code>Azerty77</code>'],
    ['<strong>Utilisateur</strong>', 'Le compte de travail quotidien. C’est avec lui qu’on se connecte.', 'Prénom (+ 1re lettre du nom), même identifiant, <code>Azerty77</code>'],
  ]),
  note('red', '🚫 L’utilisateur ne porte pas le nom de la machine ni du domaine', '<p>Avoir <code>morgane@morgane:~$</code>, ou un utilisateur qui s’appelle comme le domaine, rend les messages d’erreur et les chemins illisibles — on ne sait plus si l’on parle du compte, de la machine ou du réseau. Trois noms distincts, dès le départ.</p>'),

  block('heading', { level: 3, text: 'Partitionner' }),
  block('html', { html: '<p>« Utiliser un disque entier », puis « Tout dans une seule partition » — suffisant pour un serveur de formation, et le plus simple à relire.</p>' }),
  note('red', '🚫 Le piège de l’écran de confirmation', '<p>À la question <strong>« Faut-il appliquer les changements sur les disques ? »</strong>, la sélection est sur <strong>Non</strong> par défaut. Valider sans regarder annule tout le partitionnement, et l’installation repart en boucle sans expliquer pourquoi. Il faut déplacer la sélection sur <strong>Oui</strong>.</p>'),

  block('heading', { level: 3, text: 'Les dépôts' }),
  tbl(['Question', 'Réponse', 'Pourquoi'], [
    ['Analyser un autre CD/DVD ?', '<strong>Non</strong>', 'L’image <em>netinst</em> est minimale : le reste vient d’Internet.'],
    ['Pays du miroir', '<strong>France</strong>', 'Un miroir proche, donc rapide.'],
    ['Miroir', '<strong><code>deb.debian.org</code></strong>', 'Le miroir officiel, qui répartit vers le serveur le plus proche.'],
    ['Mandataire HTTP', '<em>vide</em>', 'Pas de proxy sur le réseau de formation. En entreprise, c’est ici qu’il se renseigne.'],
    ['popularity-contest', '<strong>Non</strong>', 'Étude statistique facultative sur les paquets installés.'],
  ]),
  note('gray', '💡 <code>apt</code> = <em>Advanced Package Tool</em>', '<p>C’est ce qu’on configure à cette étape : où le système ira chercher ses paquets. Voir la section 13 sur les dépôts.</p>'),

  block('heading', { level: 3, text: 'Sélection des logiciels' }),
  note('green', '🎯 Tout décocher — y compris le serveur SSH', '<p>On déplace la sélection sur chaque ligne et on retire l’étoile avec <strong>Espace</strong>. Environnements de bureau, serveur web, serveur d’impression, <strong>et « serveur SSH »</strong> : rien n’est coché.</p><p>Le principe est celui d’un serveur : <strong>on part du minimum et on ajoute ce dont on a besoin</strong>, plutôt que d’installer largement et de désinstaller ensuite. Ce qui n’est pas installé ne consomme rien, ne se met pas à jour et ne se fait pas attaquer.</p>'),
  note('yellow', '⚠️ Conséquence immédiate : pas de SSH au premier démarrage', '<p>La première connexion se fait donc <strong>en console</strong>, sur l’hyperviseur. On installe SSH ensuite, depuis cette console : <code>sudo apt update &amp;&amp; sudo apt install openssh-server</code>, puis <code>sudo systemctl enable --now ssh</code>. À partir de là, on quitte la console pour de bon — voir la section 12.</p>'),

  block('heading', { level: 3, text: 'GRUB' }),
  block('html', { html: '<p><strong>GRUB</strong> (<em>GRand Unified Bootloader</em>) est le programme chargé par le BIOS/UEFI, et qui charge ensuite le noyau. C’est l’équivalent du gestionnaire de démarrage de Windows. On répond <strong>oui</strong> — sans lui, la machine ne démarre sur rien.</p>' }),
  note('blue', '💡 Sur le <strong>disque</strong>, pas sur une partition : <code>/dev/sda</code>', '<p>L’installateur demande le périphérique. On désigne le premier disque, celui qui porte le système : <code>/dev/sda</code>.</p><p>Lire ce nom : <code>sd</code> = disque SATA/SCSI · <code>a</code> = <strong>premier</strong> disque (puis <code>b</code>, <code>c</code>…) · et le chiffre qui suivrait désignerait une <strong>partition</strong>, numérotée à partir de <strong>1</strong>. Les deux ne partent donc pas du même endroit : lettre à partir de <code>a</code> pour les disques, numéro à partir de <code>1</code> pour les partitions — il n’existe pas de <code>sda0</code>. Sur un disque NVMe, la logique change : <code>nvme0n1p1</code>.</p><p>Choisir <code>/dev/sda1</code> placerait GRUB dans une partition que le BIOS n’ira pas lire.</p>'),

  block('heading', { level: 3, text: 'Le premier démarrage' }),
  block('html', { html: '<p>Fond noir, texte blanc : la machine annonce son système et son nom, puis demande un identifiant. On saisit celui de l’utilisateur, puis son mot de passe.</p>' }),
  note('gray', '🔒 Le mot de passe ne s’affiche pas, même pas en étoiles', '<p>Ce n’est pas un blocage : la frappe est bien prise en compte. L’absence totale de retour est volontaire — elle ne révèle même pas la <strong>longueur</strong> du mot de passe à quelqu’un qui regarderait l’écran. On tape, on valide.</p>'),
  block('html', { html: '<p>Une fois connecté, l’invite résume où l’on est :</p>' }),
  block('html', { html: '<div class="lx-cmd">morgane@osmorgane:~$\n   │        │        │ └─ $ = utilisateur normal  (# = root)\n   │        │        └── ou l\'on se trouve (~ = son dossier personnel)\n   │        └───────── le nom de la MACHINE\n   └───────────────── l\'UTILISATEUR connecte</div>' }),
  note('red', '🚫 « sudo : commande introuvable » au premier essai', '<p>C’est normal, et c’est une conséquence directe du TP. Sur Debian, <strong>quand on donne un mot de passe à root pendant l’installation</strong>, l’utilisateur créé n’est pas ajouté au groupe <code>sudo</code> — et <code>sudo</code> n’est même pas installé. L’installateur considère que l’administration passera par le compte root.</p><p>(Si l’on avait laissé le mot de passe root <em>vide</em>, Debian aurait fait l’inverse : pas de compte root utilisable, et l’utilisateur placé d’office dans <code>sudo</code>. Les deux fonctionnent — il faut juste savoir dans lequel on est.)</p>'),
  block('html', { html: '<p>On devient root avec <code>su -</code>, et on installe <code>sudo</code> une bonne fois :</p>' }),
  block('html', { html: '<div class="lx-cmd">su -                          # mot de passe de ROOT (Azerty77)\napt update\napt install sudo\nusermod -aG sudo miyukini     # ton identifiant, pas le mien\nexit                          # on quitte root\n\n# IMPORTANT : il faut se DECONNECTER et se reconnecter.\n# L\'appartenance aux groupes est fixee a l\'ouverture de session :\n# tant qu\'on ne la rouvre pas, sudo repondra encore que tu n\'y es pas.\nexit                          # puis on se reloggue</div>' }),
  note('yellow', '⚠️ <code>su -</code> et non <code>su</code>', '<p>Le tiret charge <strong>l’environnement complet</strong> de root : son <code>PATH</code>, son dossier personnel, ses variables. Sans lui, on est root mais avec l’environnement de l’utilisateur précédent — et des commandes d’administration comme <code>usermod</code> ou <code>systemctl</code> répondent « commande introuvable » alors qu’elles sont bien installées, simplement dans <code>/usr/sbin</code> qui n’est pas dans le PATH d’un utilisateur ordinaire.</p>'),
  note('green', '🎯 Les premiers gestes, dans l’ordre', '<div class="lx-cmd">ip a                                   # ai-je une adresse ?\n\n# --- une seule fois, pour pouvoir utiliser sudo ensuite ---\nsu -\napt update &amp;&amp; apt install sudo\nusermod -aG sudo TON_IDENTIFIANT\nexit\n# se deconnecter, se reconnecter\n\n# --- ensuite, tout se fait en sudo ---\nsudo apt update &amp;&amp; sudo apt upgrade\nsudo apt install openssh-server\nsudo systemctl enable --now ssh\n# on peut maintenant quitter la console et travailler en SSH</div>'),
  note('gray', '💡 Vérifier que ça a pris', '<div class="lx-cmd">id                            # les groupes doivent contenir « sudo »\ngroups\nsudo -l                       # ce que j\'ai le droit de faire</div><p>Si <code>id</code> ne montre pas <code>sudo</code>, la session n’a pas été rouverte.</p>'),

];

function cookieFrom(res: Response): string {
  const sc = (res.headers as any).getSetCookie?.() as string[] | undefined;
  return (sc && sc.length ? sc : [res.headers.get('set-cookie') || '']).map(c => c.split(';')[0]).filter(Boolean).join('; ');
}
async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: PW }) });
  if (!login.ok) throw new Error(`login ${login.status}`);
  const cookie = cookieFrom(login);
  const h = { 'Content-Type': 'application/json', Cookie: cookie };
  const existing = await (await fetch(`${BASE}/api/admin/pages`, { headers: { Cookie: cookie } })).json() as Array<{ id: number; slug: string }>;
  const cur = existing.find(e => e.slug === PAGE.slug);
  const body = JSON.stringify({ title: PAGE.title, slug: PAGE.slug, excerpt: PAGE.excerpt, content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1 });
  const res = cur ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body }) : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log(`PAGE ${PAGE.slug}`, res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());
  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

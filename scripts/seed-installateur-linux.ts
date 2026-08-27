/* Outil « Installateur du site sur un serveur Linux ».
   Présente deploy/linux/install-webcms.sh : ce qu'il fait, ce qu'il demande,
   ce qu'il vérifie, et comment le dépanner sur les deux familles. La page sert
   aussi de lecture commentée d'un vrai script d'installation — c'est le
   pendant appliqué du cours Bash.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-installateur-linux.ts */
import { block, note, sh, flow, table, styleLinux, publier } from './_cours-linux';
import type { PageBlock } from '../client/src/lib/page-blocks';

const DEPOT = 'https://github.com/StudioMiyukini/tssr-webcms';
const BRUT = 'https://raw.githubusercontent.com/StudioMiyukini/tssr-webcms/main/deploy/linux/install-webcms.sh';

const PAGE = {
  slug: 'installateur-linux',
  title: 'Installer le site sur un serveur Linux (Debian ou Rocky)',
  excerpt: 'Un script d’installation interactif qui déploie le CMS et toutes ses dépendances sur Debian/Ubuntu ou RHEL/Rocky/AlmaLinux : Node.js, compte système, service systemd confiné, nginx en proxy inverse, HTTPS, pare-feu et SELinux. Chaque étape se termine par un verrou qui vérifie le résultat avant de continuer.',
};

const blocks: PageBlock[] = [
  block('hero', {
    eyebrow: 'Outil · Linux',
    title: 'Installer le site sur un serveur Linux',
    subtitle: 'Un script interactif, deux familles de distributions, un verrou après chaque étape.',
  }),
  styleLinux,

  note('blue', '🎯 Ce que fait ce script', '<p>Il prend une machine <strong>Debian/Ubuntu</strong> ou <strong>RHEL/Rocky/AlmaLinux</strong> fraîchement installée et en fait un serveur qui héberge le site : dépendances système, Node.js, compte de service, application, service systemd, proxy inverse, HTTPS, pare-feu — et les réglages SELinux quand il y en a besoin.</p><p>Il pose une dizaine de questions, puis <strong>vérifie chaque étape avant de passer à la suivante</strong>.</p>'),

  block('heading', { level: 2, text: '1) Récupérer et lancer' }),
  sh(`# Recuperer le script
curl -fsSL ${BRUT} -o install-webcms.sh
chmod +x install-webcms.sh

# LE LIRE avant de l'executer en root — c'est la moindre des choses
less install-webcms.sh

# Voir ce qu'il ferait, sans rien modifier
sudo ./install-webcms.sh --dry-run

# Installer
sudo ./install-webcms.sh`),
  note('red', '🚫 Ne canalise jamais un script d’installation dans un shell', '<p>La forme <code>curl … | sudo bash</code> se voit partout. Elle exécute <strong>en root</strong> un contenu que personne n’a lu, servi par un site dont on ne contrôle rien — et qui peut très bien renvoyer autre chose à un client <code>curl</code> qu’à un navigateur.</p><p>Deux commandes de plus — télécharger, puis lire — et le risque disparaît. Ce script applique d’ailleurs la même règle à lui-même : quand il doit ajouter le dépôt NodeSource, il <strong>télécharge le script, affiche sa taille et son empreinte SHA-256, et demande confirmation</strong> avant de l’exécuter.</p>'),
  table(['Option', 'Effet'], [
    ['<em>(aucune)</em>', 'Installation interactive. Le cas normal.'],
    ['<code>--dry-run</code>', 'Affiche chaque commande sans rien exécuter. À faire en premier.'],
    ['<code>--verifier</code>', 'Contrôle une installation existante : service, port, HTTP 200, environnement.'],
    ['<code>--non-interactif</code>', 'Ne pose aucune question : tout vient de l’environnement.'],
    ['<code>--help</code>', 'L’aide.'],
  ]),

  block('heading', { level: 2, text: '2) Les questions posées' }),
  table(['Question', 'Défaut', 'Ce qui en dépend'], [
    ['Nom de domaine public', '<em>(aucun)</em>', '<strong><code>PUBLIC_BASE_URL</code></strong> — voir l’avertissement ci-dessous.'],
    ['Port interne', '<code>3470</code>', 'Le port sur <code>127.0.0.1</code>. Jamais exposé directement si nginx est installé.'],
    ['Dossier d’installation', '<code>/opt/webcms</code>', 'Emplacement de l’application, de la base et des envois.'],
    ['Compte système', '<code>webcms</code>', 'Le service ne tourne <strong>pas</strong> en root.'],
    ['Identifiant administrateur', '<code>admin</code>', 'La connexion à <code>/admin</code>.'],
    ['Mot de passe', '<em>(généré)</em>', 'Saisie masquée, 12 caractères minimum. Vide = généré aléatoirement.'],
    ['Dépôt Git ou archive', '—', 'D’où viennent les fichiers du site.'],
    ['nginx en proxy inverse', '<code>o</code>', 'Le site en ports 80/443 au lieu du port interne.'],
    ['HTTPS Let’s Encrypt', '<code>o</code>', 'Certificat + redirection + renouvellement automatique.'],
    ['Ouvrir le pare-feu', '<code>o</code>', '<code>ufw</code> sous Debian, <code>firewall-cmd</code> sous Rocky.'],
  ]),
  note('yellow', '⚠️ Le domaine n’est pas une formalité', '<p>Sans domaine renseigné, <code>PUBLIC_BASE_URL</code> reste vide et le site <strong>s’annonce comme <code>example.com</code></strong> dans ses balises de partage : un lien envoyé sur une messagerie affiche un aperçu pointant vers un domaine tiers, et <code>og:image</code> est cassé.</p><p>Le script le signale à la fin s’il n’a pas eu de domaine. Cela se corrige à tout moment :</p><div class="lx-cmd">sudo nano /etc/webcms/webcms.env      # PUBLIC_BASE_URL=https://mon-domaine.fr\\nsudo systemctl restart webcms</div>'),

  block('heading', { level: 2, text: '3) Ce qu’il installe, famille par famille' }),
  table(['Étape', 'Debian / Ubuntu', 'RHEL / Rocky / Alma'], [
    ['Outils de base', '<code>apt-get</code> : git, curl, <code>build-essential</code>, python3', '<code>dnf</code> : git, curl, <code>gcc-c++</code>, make, python3'],
    ['Node.js ≥ 20', 'Paquet de la distribution s’il est assez récent, sinon NodeSource', 'Module <code>nodejs:22</code>, sinon NodeSource'],
    ['Compte de service', '<code>useradd --system</code>, sans shell de connexion', 'idem'],
    ['Application', '<code>npm ci</code> puis <code>npm run build</code>', 'idem'],
    ['Service', '<code>webcms.service</code> — systemd, confiné', 'idem'],
    ['Proxy', 'nginx, <code>sites-available</code> + lien symbolique', 'nginx, <code>conf.d/</code> — pas de <code>a2ensite</code>'],
    ['Pare-feu', '<code>ufw allow</code>', '<code>firewall-cmd --permanent</code> puis <code>--reload</code>'],
    ['SELinux', '<em>sans objet</em>', '<strong><code>setsebool -P httpd_can_network_connect on</code></strong>'],
  ]),
  note('green', '🎯 La ligne SELinux est celle qui évite une soirée perdue', '<p>Sur Rocky, nginx qui relaie vers <code>127.0.0.1:3470</code> reçoit un <code>Permission denied</code> et renvoie un <strong>502</strong>. Le journal d’nginx dit « connexion refusée » sans dire pourquoi, et le service applicatif, lui, va très bien.</p><p>C’est SELinux qui interdit à un processus <code>httpd_t</code> d’ouvrir une connexion réseau sortante. Le booléen <code>httpd_can_network_connect</code> l’autorise. → <a href="/pages/linux-redhat">le cours Rocky</a>, §4b.</p>'),

  block('heading', { level: 2, text: '4) Les verrous' }),
  block('html', { html: '<p>C’est le principe du script : <strong>chaque étape se termine par une vérification</strong>. Si elle échoue, il s’arrête là, en donnant le motif <em>et</em> la commande de diagnostic — plutôt que de continuer sur une base fausse et de laisser une installation à moitié faite.</p>' }),
  flow(`1.  root ? distribution reconnue ? systemd ? DNS ? espace disque ?
2.  (questions — port valide, domaine sans http://, courriel si TLS)
3.  git, curl et python3 repondent
4.  node -v >= 20            <- sinon on ne va pas plus loin
5.  package.json present apres recuperation des sources
6.  /etc/webcms/webcms.env ecrit ET en 640
7.  node_modules/tsx present, better-sqlite3 compile, dist/ construit
8.  service ACTIF + demarrage automatique arme
    HTTP 200 sur 127.0.0.1:PORT     <- le verrou qui compte vraiment
9.  nginx -t valide, nginx actif, relais qui repond
10. pare-feu mis a jour
11. controle final complet`),
  note('blue', '💡 Le verrou HTTP 200 est celui qui distingue « demarre » de « fonctionne »', '<p>Un service <code>active (running)</code> ne prouve rien : le processus tourne, mais il peut avoir échoué à ouvrir sa base, à lire son environnement, ou à écouter. Le script boucle donc jusqu’à 20 secondes en interrogeant réellement le site, et n’accepte que <strong>200</strong>.</p><p>C’est la différence entre « <em>systemd n’a pas signalé d’erreur</em> » et « <em>le site répond</em> ».</p>'),
  sh(`# La forme du verrou, dans le script
gate() {
  local libelle="$1" diag="\${2:-}"; shift 2 || shift 1
  if [ "$DRY_RUN" = 1 ]; then detail "verrou (simule) : $libelle"; return 0; fi
  if "$@"; then ok "$libelle"; else echoue "$libelle" "$diag"; fi
}

gate "Le site repond en HTTP 200 sur 127.0.0.1:$PORT" \\
  "curl -v http://127.0.0.1:$PORT/ ; journalctl -u webcms -n 50 --no-pager" \\
  bash -c "[ \\"\\$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$PORT/)\\" = 200 ]"`),

  block('heading', { level: 2, text: '5) Le service systemd produit' }),
  block('html', { html: '<p>Le script écrit <code>/etc/systemd/system/webcms.service</code>. Il vaut d’être lu : c’est une unité <strong>confinée</strong>, pas un simple <code>ExecStart</code>.</p>' }),
  flow(`[Service]
User=webcms                       <- PAS root
EnvironmentFile=/etc/webcms/webcms.env
ExecStart=/usr/bin/env node node_modules/tsx/dist/cli.mjs server/index.ts
Restart=on-failure

NoNewPrivileges=true              <- ne peut pas gagner de privileges
PrivateTmp=true                   <- son propre /tmp
ProtectSystem=strict              <- tout le systeme en LECTURE SEULE
ProtectHome=true                  <- /home invisible
ProtectKernelTunables=true
ProtectKernelModules=true
RestrictSUIDSGID=true
ReadWritePaths=/opt/webcms        <- la SEULE exception en ecriture`),
  note('green', '🎯 <code>ProtectSystem=strict</code> + <code>ReadWritePaths</code> : la bonne paire', '<p>La première rend <strong>tout le système de fichiers en lecture seule</strong> pour ce service. La seconde rouvre en écriture <strong>uniquement</strong> le dossier dont il a besoin.</p><p>Conséquence concrète : même si une faille permettait d’exécuter du code dans le contexte du site, il ne pourrait écrire ni dans <code>/etc</code>, ni dans <code>/usr</code>, ni dans les dossiers personnels. C’est peu de lignes pour beaucoup de surface en moins.</p><p>→ <a href="/pages/linux-systemd">le cours systemd</a> pour écrire ses propres unités.</p>'),

  block('heading', { level: 2, text: '6) Après l’installation' }),
  sh(`systemctl status webcms            # etat
journalctl -u webcms -f            # journal en direct
systemctl restart webcms           # apres modification de l'environnement
sudo ./install-webcms.sh --verifier  # controle complet

sudo nano /etc/webcms/webcms.env   # la configuration (root:webcms, 640)`),
  note('yellow', '⚠️ Le mot de passe n’est affiché qu’une fois', '<p>À la fin de l’installation, et nulle part ailleurs — il est ensuite stocké en clair dans <code>/etc/webcms/webcms.env</code>, lisible par root seulement. <strong>Note-le à ce moment-là.</strong></p><p>Perdu, il se remplace : modifier <code>CMS_ADMIN_PASSWORD</code> dans le fichier d’environnement <em>ne suffit pas</em> si le compte existe déjà en base — le mot de passe y est stocké en empreinte bcrypt. Il faut le changer depuis l’administration, ou recréer le compte.</p>'),

  block('heading', { level: 3, text: 'Sauvegarder' }),
  block('html', { html: '<p>Tout le contenu du site tient dans <strong>deux emplacements</strong> :</p>' }),
  sh(`/opt/webcms/cms.sqlite      # pages, articles, reglages, comptes
/opt/webcms/uploads/        # images et fichiers deposes`),
  sh(`# Sauvegarde a chaud CORRECTE — la base est en mode WAL
sudo -u webcms sqlite3 /opt/webcms/cms.sqlite ".backup '/var/backups/cms-$(date +%F).sqlite'"
sudo tar -czf /var/backups/uploads-$(date +%F).tar.gz -C /opt/webcms uploads`),
  note('red', '🚫 Ne copie pas <code>cms.sqlite</code> avec <code>cp</code> pendant que le site tourne', '<p>La base est en mode <strong>WAL</strong> : les écritures récentes vivent dans <code>cms.sqlite-wal</code>, à côté. Un <code>cp</code> du seul fichier principal produit une sauvegarde <strong>silencieusement incomplète</strong> — elle s’ouvre sans erreur, et il y manque les dernières modifications.</p><p><code>sqlite3 ".backup"</code> prend le verrou qu’il faut et produit un fichier cohérent, site en fonctionnement.</p>'),

  block('heading', { level: 2, text: '7) Dépannage' }),
  table(['Symptôme', 'Où regarder'], [
    ['Le script s’arrête sur un verrou', 'Il affiche <strong>la commande de diagnostic</strong>. C’est la première à taper.'],
    ['Service <code>failed</code> au démarrage', '<code>journalctl -u webcms -n 50</code>. Souvent : <code>CMS_ADMIN_PASSWORD</code> manquant — le serveur <strong>refuse de démarrer</strong> sans, c’est voulu.'],
    ['<code>better-sqlite3</code> échoue à la compilation', 'Node trop ancien, ou compilateur absent. <code>node -v</code> doit donner ≥ 20.'],
    ['nginx renvoie <strong>502</strong>', 'Le service applicatif répond-il ? <code>curl http://127.0.0.1:3470/</code>. Si oui et que le 502 persiste sur Rocky : <strong>SELinux</strong>.'],
    ['nginx renvoie <strong>404</strong> partout', 'Sous Debian, <code>/etc/nginx/sites-enabled/default</code> prend la main. Le script le retire, mais une réinstallation d’nginx le remet.'],
    ['Le site répond en local, pas depuis l’extérieur', 'Pare-feu. <code>ufw status</code> ou <code>firewall-cmd --list-all</code>.'],
    ['Les liens de partage pointent vers <code>example.com</code>', '<code>PUBLIC_BASE_URL</code> vide dans <code>/etc/webcms/webcms.env</code>.'],
    ['<code>certbot</code> échoue', 'Le domaine doit <strong>déjà</strong> pointer vers la machine, et le port 80 être joignable depuis internet. Le site reste accessible en HTTP en attendant.'],
  ]),
  note('blue', '💡 La méthode, dans l’ordre', '<p><strong>1.</strong> <code>systemctl status webcms</code> — le service tourne-t-il ?<br><strong>2.</strong> <code>curl http://127.0.0.1:3470/</code> — répond-il en local ?<br><strong>3.</strong> <code>curl -H "Host: mon-domaine" http://127.0.0.1/</code> — nginx relaie-t-il ?<br><strong>4.</strong> depuis l’extérieur — le pare-feu laisse-t-il passer ?</p><p>Chaque étape teste <strong>une seule</strong> chose. Sauter directement au navigateur, c’est tester les quatre à la fois et ne rien savoir de celle qui échoue.</p>'),

  note('yellow', '⚠️ Limite connue, dite franchement', '<p>Le script est vérifié syntaxiquement (<code>bash -n</code>) et ses garde-fous d’entrée sont testés, mais il <strong>n’a pas été exécuté de bout en bout</strong> sur une Debian ni sur une Rocky réelles. Passe-le d’abord avec <code>--dry-run</code>, puis sur une machine jetable — c’est de toute façon la bonne façon d’essayer un script d’installation.</p>'),

  note('green', '🔗 Les pages liées', `<p><a href="/pages/linux-redhat">Rocky Linux et la famille Red Hat</a> — SELinux, firewalld, dnf · <a href="/pages/linux-systemd">systemd</a> — écrire et confiner une unité · <a href="/pages/linux-bash">Scripts Bash</a> — <code>set -euo pipefail</code>, verrous, idempotence · <a href="/pages/linux-ssh">SSH serveur</a> · <a href="${DEPOT}/tree/main/deploy/linux" target="_blank" rel="noopener">Le script sur GitHub</a></p>`),
];

publier(PAGE, blocks).catch(e => { console.error(e); process.exit(1); });

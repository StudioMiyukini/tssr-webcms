# -*- coding: utf-8 -*-
"""
Les notions des TP Apache et ProFTPd : deux cours et trois corrigés.

D'OÙ VIENT LE CONTENU
Trois énoncés fournis par le formateur — la recherche préalable sur Apache, le
TP « hôtes virtuels » et le cours/TP ProFTPd. Les notions qui y émergent sans
exister sur le site deviennent des cours ; les demandes deviennent des corrigés.

DEUX GABARITS DISTINCTS, PARCE QUE DEUX SECTIONS.
Un cours utilise `.lx-cmd` et va du concept vers la commande. Un corrigé utilise
`.proc-cmd`, des titres numérotés ① ② ③ et des blocs `.qr` qui répondent
explicitement à une question de l'énoncé. On reprend l'un et l'autre à
l'identique pour que les nouvelles pages ne se distinguent pas des anciennes.

LES ADRESSES SUIVENT LES CONVENTIONS DU SITE (serveur 192.168.10.30, client
.50, passerelle .254) mais les NOMS suivent l'énoncé (exemple1.lan, intranet…) :
c'est ce que l'apprenant a sous les yeux.

IDEMPOTENT : relancer met à jour, ne duplique pas.
"""
import sqlite3
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent / 'cms.sqlite'

STYLE_COURS = ("<style>.lx-cmd{font-family:ui-monospace,'Space Mono',monospace;"
               "background:var(--surface-2);border:1px solid var(--border);border-radius:8px;"
               "padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;"
               "font-size:12.5px;line-height:1.55}"
               ".lx-tab{border-collapse:collapse;width:100%;margin:10px 0}"
               ".lx-tab td,.lx-tab th{padding:6px 9px;border:1px solid var(--border);"
               "text-align:left;font-size:12.5px;vertical-align:top}"
               ".lx-tab th{color:var(--text-muted);background:var(--surface-2)}"
               "@media (max-width:640px){.lx-tab{display:block;overflow-x:auto}}"
               "code{overflow-wrap:anywhere}</style>")

STYLE_TP = ("<style>.proc-steps{padding-left:22px;line-height:1.75}.proc-steps>li{margin:7px 0}"
            ".proc-steps code,.proc-cmd,.qr code{font-family:ui-monospace,'Space Mono',monospace}"
            ".proc-cmd{background:var(--surface-2);border:1px solid var(--border);border-radius:8px;"
            "padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;"
            "line-height:1.5}.ref-table{border-collapse:collapse;width:100%;margin:10px 0}"
            ".ref-table td,.ref-table th{padding:6px 9px;border:1px solid var(--border);"
            "text-align:left;font-size:12.5px;vertical-align:top}"
            ".ref-table th{color:var(--text-muted);background:var(--surface-2)}"
            # Un tableau dense ne descend pas sous sa largeur minimale : sur un
            # écran étroit il pousserait toute la page. Il défile dans sa propre
            # boîte. Même raison pour les chemins longs en <code>.
            "@media (max-width:640px){.ref-table{display:block;overflow-x:auto}}"
            "code{overflow-wrap:anywhere}"
            ".qr{border:1px solid var(--border);border-left:3px solid var(--accent);"
            "background:var(--surface-2);border-radius:8px;padding:9px 13px;margin:9px 0}"
            ".qr .q{font-weight:600;margin-bottom:3px}"
            ".qr .a{color:var(--text-soft);font-size:13.5px}</style>")


def hero(pill, titre, sous):
    return (f'<section class="hero"><span class="pill">{pill}</span><h1>{titre}</h1>'
            f'<p>{sous}</p></section>')


def note(couleur, titre, *paras):
    corps = ''.join(f'<p>{p}</p>' for p in paras)
    return (f'<aside class="pb-note pb-note-{couleur}"><p class="pb-note-title">{titre}</p>'
            f'{corps}</aside>')


def cmd(t, classe='lx-cmd'):
    return f'<div class="{classe}">{t}</div>'


def qr(q, a):
    return f'<p class="qr"><span class="q">{q}</span> <span class="a">{a}</span></p>'


# ══════════════════════════════════ COURS 1 — Apache en profondeur ══

APACHE_VH = '\n'.join([
    hero('Cours · Linux', 'Apache : hôtes virtuels, pages par défaut et HTTPS',
         'Aller au-delà d’un site : comment Apache choisit quoi servir, et les réglages qui '
         'répondent aux questions qu’on se pose ensuite.'),
    STYLE_COURS,
    '<p>Le cours <a href="/pages/linux-apache">Apache : héberger un site web</a> pose un site et '
    'son hôte virtuel. Dès qu’on en veut plusieurs sur la même machine, une question arrive : '
    '<strong>comment Apache décide-t-il quel site répondre ?</strong> Tout le reste en découle.</p>',

    '<h2>1) Les trois discriminants</h2>',
    '<p>Apache range ses hôtes virtuels selon trois critères, et les applique <strong>dans cet '
    'ordre</strong> :</p>',
    '<table class="lx-tab"><tr><th>Critère</th><th>Où il s’écrit</th><th>Ce qu’il permet</th></tr>'
    '<tr><td>L’adresse IP écoutée</td><td><code>&lt;VirtualHost 192.168.10.31:80&gt;</code></td>'
    '<td>Réserver un site à une adresse du serveur</td></tr>'
    '<tr><td>Le port</td><td><code>&lt;VirtualHost *:8080&gt;</code> + <code>Listen 8080</code></td>'
    '<td>Séparer des sites sans changer de nom</td></tr>'
    '<tr><td>Le nom demandé</td><td><code>ServerName</code> / <code>ServerAlias</code></td>'
    '<td>Des dizaines de sites sur une seule IP</td></tr></table>',
    '<p>Concrètement : Apache retient d’abord tous les hôtes virtuels qui écoutent sur '
    '<strong>l’IP et le port</strong> par lesquels la requête est arrivée. Parmi ceux-là seulement, '
    'il compare l’en-tête <code>Host:</code> du navigateur aux <code>ServerName</code>.</p>',
    note('gray', '💡 L’en-tête <code>Host:</code>, la clé de tout',
         'Le navigateur envoie le nom tapé dans la barre d’adresse. C’est ce qui permet à cent sites '
         'de vivre derrière une seule adresse IP : le serveur lit le nom demandé et sert le bon '
         'dossier. Sans cet en-tête, on serait limité à un site par adresse.'),

    '<h2>2) Le site par défaut</h2>',
    '<p>Et si aucun <code>ServerName</code> ne correspond ? Apache ne renvoie pas d’erreur : il sert '
    '<strong>le premier hôte virtuel déclaré</strong> pour cette IP et ce port. C’est ça, le site par '
    'défaut — il n’y a pas de directive « site par défaut », c’est une question d’<strong>ordre de '
    'lecture</strong>.</p>',
    '<p>Sur Debian, Apache lit les liens de <code>/etc/apache2/sites-enabled/</code> dans l’ordre '
    '<strong>alphabétique</strong>. D’où le nom du fichier fourni : <code>000-default.conf</code>, '
    'qui passe avant tout le monde.</p>',
    cmd('ls -l /etc/apache2/sites-enabled/\n'
        '# 000-default.conf -> ../sites-available/000-default.conf   ← lu en premier\n'
        '# intranet.conf    -> ../sites-available/intranet.conf\n'
        '# monsite.conf     -> ../sites-available/monsite.conf'),
    '<p>Pour imposer son propre site par défaut : le nommer de façon à sortir en tête '
    '(<code>000-…</code>), ou utiliser le mot-clé <code>_default_</code> qui n’attrape que ce qui '
    'n’a pas trouvé preneur.</p>',
    cmd('&lt;VirtualHost _default_:80&gt;\n'
        '    DocumentRoot /var/www/defaut\n'
        '&lt;/VirtualHost&gt;'),
    note('yellow', '⚠️ Le test qui ne trompe pas',
         'Tape l’<strong>adresse IP</strong> du serveur dans le navigateur, pas un nom. Aucun '
         '<code>ServerName</code> ne peut correspondre à une IP : tu tombes forcément sur le site par '
         'défaut. Et comme tu n’utilises pas de nom, aucun besoin de toucher au fichier '
         '<code>hosts</code> ni au DNS.'),

    '<h2>3) <code>DirectoryIndex</code> — la page d’ouverture</h2>',
    '<p>Quand on demande un dossier et non un fichier, Apache cherche une page d’accueil. La liste '
    'par défaut est <code>index.html</code>, <code>index.php</code>… Pour un nom différent :</p>',
    cmd('&lt;VirtualHost *:80&gt;\n'
        '    ServerName monsite.lan\n'
        '    DocumentRoot /var/www/monsite\n'
        '    DirectoryIndex accueil.html index.html\n'
        '&lt;/VirtualHost&gt;'),
    '<p>L’ordre compte : Apache prend <strong>le premier trouvé</strong>. Garder '
    '<code>index.html</code> en second est une sécurité.</p>',
    note('gray', '💡 Si aucune page d’index n’existe',
         'Apache affiche la <strong>liste du dossier</strong> à qui passe par là — le contenu du site '
         'à nu. C’est ce que coupe <code>Options -Indexes</code>. À poser sur tout site public.'),

    '<h2>4) <code>ErrorDocument</code> — les pages d’erreur</h2>',
    cmd('ErrorDocument 404 /erreurs/introuvable.html\n'
        'ErrorDocument 403 /erreurs/interdit.html\n'
        'ErrorDocument 500 /erreurs/panne.html\n'
        '# ou directement un texte :\n'
        'ErrorDocument 404 "Cette page n\'existe pas."'),
    '<p>Le chemin commence par <code>/</code> et part de la <strong>racine du site</strong> '
    '(<code>DocumentRoot</code>), pas du disque.</p>',
    note('yellow', '⚠️ La page d’erreur doit être accessible',
         'Si <code>/erreurs/introuvable.html</code> est lui-même introuvable ou interdit, Apache '
         'abandonne et affiche sa page brute. Et ne place jamais la page d’erreur 403 dans un dossier '
         'protégé : l’erreur déclencherait l’erreur.'),

    '<h2>5) Un site sur un autre port</h2>',
    '<p>Deux gestes, et le second est celui qu’on oublie : déclarer le port dans l’hôte virtuel '
    '<strong>ne fait pas écouter Apache dessus</strong>.</p>',
    cmd('# 1. /etc/apache2/ports.conf\nListen 80\nListen 8080\n\n'
        '# 2. l’hôte virtuel\n&lt;VirtualHost *:8080&gt;\n'
        '    ServerName intranet.monsite.lan\n'
        '    DocumentRoot /var/www/monsite/intranet\n'
        '&lt;/VirtualHost&gt;'),
    '<p>On y accède par <code>http://intranet.monsite.lan:8080</code> — le port doit être tapé, '
    'puisque le navigateur suppose 80.</p>',
    cmd('sudo ss -tlnp | grep apache   # Apache écoute-t-il vraiment sur 8080 ?'),

    '<h2>6) Restreindre un site à certains clients</h2>',
    cmd('&lt;VirtualHost *:80&gt;\n'
        '    ServerName prive.monsite.lan\n'
        '    DocumentRoot /var/www/prive\n\n'
        '    &lt;Directory /var/www/prive&gt;\n'
        '        Require ip 192.168.10.50\n'
        '        # ou tout un réseau :  Require ip 192.168.10.0/24\n'
        '    &lt;/Directory&gt;\n'
        '&lt;/VirtualHost&gt;'),
    note('yellow', '⚠️ <code>Order allow,deny</code> est de l’Apache 2.2',
         'Beaucoup de tutoriels en ligne montrent encore <code>Order</code>, <code>Allow from</code>, '
         '<code>Deny from</code>. Sur Debian 12 (Apache 2.4), ces directives ne sont plus comprises '
         'sans le module de compatibilité : le service refuse de démarrer. La syntaxe actuelle est '
         '<code>Require</code>.'),

    '<h2>7) Lier un site à une adresse IP du serveur</h2>',
    '<p>Une machine peut porter plusieurs adresses. On réserve alors un site à l’une d’elles : le '
    'nom ne répondra que sur cette adresse.</p>',
    cmd('&lt;VirtualHost 192.168.10.31:80&gt;\n'
        '    ServerName siteweb.monsite.lan\n'
        '    DocumentRoot /var/www/siteweb\n'
        '&lt;/VirtualHost&gt;'),
    '<p>Encore faut-il que la machine <strong>possède</strong> cette adresse. C’est le rôle d’une '
    '<strong>interface virtuelle</strong> (ou alias IP) : une seconde adresse sur la même carte '
    'physique, sans matériel supplémentaire.</p>',
    cmd('# tout de suite, pour tester (perdu au redémarrage)\n'
        'sudo ip addr add 192.168.10.31/24 dev ens33\n'
        'ip -br addr show ens33\n\n'
        '# durablement — /etc/network/interfaces\n'
        'auto ens33\n'
        'iface ens33 inet static\n'
        '    address 192.168.10.30/24\n'
        '    gateway 192.168.10.254\n\n'
        'auto ens33:0\n'
        'iface ens33:0 inet static\n'
        '    address 192.168.10.31/24\n\n'
        'sudo systemctl restart networking'),
    note('gray', '💡 <code>eth0</code> ou <code>ens33</code> ?',
         'Depuis Debian 9, les cartes portent un nom « prévisible » dérivé de leur emplacement '
         'matériel (<code>ens33</code>, <code>enp0s3</code>…) au lieu de <code>eth0</code>. '
         '<code>ip -br link</code> donne le nom réel de ta machine — c’est celui-là qu’il faut '
         'écrire, l’alias devenant <code>ens33:0</code>.'),

    '<h2>8) Servir en HTTPS</h2>',
    '<p>Trois choses : un <strong>module</strong>, un <strong>certificat</strong>, un <strong>hôte '
    'virtuel sur le port 443</strong>.</p>',
    cmd('# 1. le module (il ajoute aussi « Listen 443 »)\n'
        'sudo a2enmod ssl\n\n'
        '# 2. un certificat auto-signé, pour un réseau interne\n'
        'sudo mkdir -p /etc/ssl/monsite\n'
        'sudo openssl req -x509 -nodes -days 825 -newkey rsa:2048 \\\n'
        '  -keyout /etc/ssl/monsite/monsite.key \\\n'
        '  -out    /etc/ssl/monsite/monsite.crt \\\n'
        '  -subj "/CN=monsite.lan"\n\n'
        '# 3. l’hôte virtuel\n'
        '&lt;VirtualHost *:443&gt;\n'
        '    ServerName monsite.lan\n'
        '    DocumentRoot /var/www/monsite\n'
        '    SSLEngine on\n'
        '    SSLCertificateFile    /etc/ssl/monsite/monsite.crt\n'
        '    SSLCertificateKeyFile /etc/ssl/monsite/monsite.key\n'
        '&lt;/VirtualHost&gt;\n\n'
        'sudo apache2ctl configtest\nsudo systemctl reload apache2'),
    '<p>Pour que personne ne reste en clair, on renvoie le port 80 vers le 443 :</p>',
    cmd('&lt;VirtualHost *:80&gt;\n'
        '    ServerName monsite.lan\n'
        '    Redirect permanent / https://monsite.lan/\n'
        '&lt;/VirtualHost&gt;'),
    note('yellow', '⚠️ L’avertissement du navigateur est normal',
         'Un certificat <strong>auto-signé</strong> n’est vérifié par aucune autorité : le navigateur '
         'prévient qu’il ne peut pas garantir l’identité du site. Le chiffrement, lui, fonctionne. '
         'Sur un site exposé à Internet, on prend un certificat gratuit Let’s Encrypt '
         '(<code>certbot</code>), qui règle l’avertissement et se renouvelle seul.'),

    '<h2>9) Sites parent et enfant</h2>',
    '<p>Convention d’arborescence : un sous-site vit <strong>dans</strong> le dossier de son '
    'parent, ce qui garde le lien visible sur le disque.</p>',
    cmd('/var/www/exemple1/            ← exemple1.lan\n'
        '/var/www/exemple1/intranet/   ← intranet.exemple1.lan'),
    '<p>Ce sont deux hôtes virtuels distincts : l’imbrication des dossiers ne crée aucun lien pour '
    'Apache, elle sert à qui relira l’arborescence dans six mois.</p>',

    note('green', '🎓 Passer à la pratique',
         'Le corrigé complet, site par site : <a href="/pages/tp-apache-virtualhosts"><strong>TP '
         'Apache — hôtes virtuels (corrigé)</strong></a>. Les trois questions de recherche préalables '
         'sont traitées dans <a href="/pages/tp-apache-recherche">TP Apache — recherche '
         '(corrigé)</a>. Et la mise en place de base : '
         '<a href="/pages/procedure-apache-linux">Héberger un site avec Apache sous Debian</a>.'),
])

# ═════════════════════════════════════════ COURS 2 — ProFTPd / FTP ══

PROFTPD = '\n'.join([
    hero('Cours · Linux', 'FTP : le serveur ProFTPd',
         'Échanger des fichiers par le réseau : les deux canaux du protocole, les modes actif et '
         'passif, et la configuration qui cloisonne les utilisateurs.'),
    STYLE_COURS,
    '<p><strong>FTP</strong> (<em>File Transfer Protocol</em>) sert à déposer et récupérer des '
    'fichiers sur un serveur. Sous Debian, <strong>ProFTPd</strong> est l’un des serveurs les plus '
    'répandus — souple, et configuré par un unique fichier.</p>',

    '<h2>1) Client et serveur</h2>',
    '<table class="lx-tab"><tr><th></th><th>Où</th><th>Exemples</th></tr>'
    '<tr><td><strong>Serveur FTP</strong></td><td>Sur la machine qui héberge les fichiers</td>'
    '<td>ProFTPd, vsftpd</td></tr>'
    '<tr><td><strong>Client FTP</strong></td><td>Sur le poste de la personne</td>'
    '<td>FileZilla, MobaXterm, la commande <code>ftp</code></td></tr></table>',

    '<h2>2) Deux canaux, deux ports</h2>',
    '<p>C’est la particularité de FTP, et la source de la plupart de ses ennuis : il utilise '
    '<strong>deux connexions</strong>.</p>',
    '<table class="lx-tab"><tr><th>Canal</th><th>Port</th><th>Ce qui y passe</th></tr>'
    '<tr><td>Commandes</td><td><strong>21</strong></td>'
    '<td>Connexion, identifiants, <code>LIST</code>, <code>CWD</code>…</td></tr>'
    '<tr><td>Données</td><td><strong>20</strong> ou un port haut</td>'
    '<td>Le contenu des fichiers et le résultat des listings</td></tr></table>',

    '<h2>3) Mode actif et mode passif</h2>',
    '<p>La question est : <strong>qui ouvre le canal de données ?</strong></p>',
    '<table class="lx-tab"><tr><th></th><th>Actif</th><th>Passif</th></tr>'
    '<tr><td>Qui ouvre</td><td>Le <strong>serveur</strong> vers le client (depuis le port 20)</td>'
    '<td>Le <strong>client</strong> vers le serveur</td></tr>'
    '<tr><td>Ce qui coince</td><td>Le pare-feu du client voit une connexion entrante non sollicitée '
    'et la jette</td><td>Il faut ouvrir une plage de ports côté serveur</td></tr>'
    '<tr><td>Aujourd’hui</td><td>Historique</td><td><strong>Recommandé</strong></td></tr></table>',
    note('gray', '💡 Le symptôme qui trahit le mode actif',
         'La connexion réussit, l’identifiant est accepté… puis le listing du dossier reste vide ou '
         'se fige. Le canal de commandes passe, le canal de données non. C’est presque toujours un '
         'problème de mode ou de pare-feu, jamais un problème de mot de passe.'),

    '<h2>4) Installer</h2>',
    cmd('sudo apt update\n'
        '# le nom du paquet change selon la version de Debian :\n'
        'apt search ^proftpd\n'
        'sudo apt install proftpd-core     # Debian 12\n'
        '# sudo apt install proftpd-basic  # Debian 11\n\n'
        'systemctl status proftpd --no-pager\n'
        'sudo ss -tlnp | grep :21'),

    '<h2>5) Le fichier de configuration</h2>',
    '<p>Tout tient dans <code>/etc/proftpd/proftpd.conf</code> : une instruction par ligne, et des '
    'lignes commentées par <code>#</code> qui documentent celles qui suivent. Activer une option, '
    'c’est souvent simplement <strong>retirer le dièse</strong>.</p>',
    cmd('sudo cp /etc/proftpd/proftpd.conf /etc/proftpd/proftpd.conf.old\n'
        'sudo nano /etc/proftpd/proftpd.conf'),
    note('yellow', '⚠️ On sauvegarde la copie, on modifie l’original',
         'La copie <code>.old</code> est le filet de secours : elle ne doit plus bouger. Modifier la '
         'copie et redémarrer le service ne change évidemment rien — et fait chercher longtemps.'),

    '<h2>6) Les directives qui comptent</h2>',
    '<table class="lx-tab"><tr><th>Directive</th><th>Rôle</th><th>Valeur courante</th></tr>'
    '<tr><td><code>ServerName</code></td><td>Le nom annoncé aux clients à la connexion</td>'
    '<td><code>"FTP Miyukini"</code></td></tr>'
    '<tr><td><code>DefaultRoot</code></td><td><strong>Cloisonne</strong> l’utilisateur : il descend '
    'dans les sous-dossiers, jamais au-dessus</td><td><code>~</code> (son dossier personnel)</td></tr>'
    '<tr><td><code>PassivePorts</code></td><td>La plage où le serveur pioche pour le canal de '
    'données</td><td><code>49152 65534</code></td></tr>'
    '<tr><td><code>Port</code></td><td>Le port de commandes</td><td><code>21</code></td></tr>'
    '<tr><td><code>MaxInstances</code></td><td>Connexions simultanées acceptées</td>'
    '<td><code>30</code></td></tr>'
    '<tr><td><code>TimeoutIdle</code></td><td>Déconnexion après inactivité (secondes)</td>'
    '<td><code>1200</code></td></tr></table>',

    '<h2>7) <code>DefaultRoot</code> : le réglage de sécurité</h2>',
    '<p>Sans lui, l’utilisateur arrive bien dans son dossier personnel… mais peut '
    '<strong>remonter</strong> vers <code>/home</code>, puis <code>/</code>, et lire une bonne partie '
    'du serveur. Il ne pourra pas grand-chose modifier, mais il verra tout : l’arborescence, les '
    'noms des autres comptes, les fichiers de configuration lisibles.</p>',
    cmd('DefaultRoot ~'),
    '<p>On peut aussi envoyer un groupe ailleurs. Les lignes sont examinées dans l’ordre : la '
    '<strong>règle particulière d’abord</strong>, la générale ensuite.</p>',
    cmd('DefaultRoot /var/www  webadmins   # les membres du groupe webadmins\n'
        'DefaultRoot ~                     # tous les autres'),
    note('gray', '💡 <code>RequireValidShell</code>',
         'ProFTPd refuse par défaut les comptes dont le shell n’est pas listé dans '
         '<code>/etc/shells</code>. Un compte créé avec <code>/usr/sbin/nologin</code> — le réflexe '
         'sain pour un compte de service — ne pourra donc pas se connecter, avec un message qui parle '
         'seulement d’identifiants incorrects. Soit on ajoute <code>RequireValidShell off</code>, '
         'soit on ajoute <code>nologin</code> à <code>/etc/shells</code>.'),

    '<h2>8) Les connexions anonymes</h2>',
    '<p>Le bloc <code>&lt;Anonymous&gt;</code>, commenté d’origine, ouvre le serveur à tous : on se '
    'connecte avec l’identifiant <code>anonymous</code> et n’importe quel mot de passe.</p>',
    cmd('&lt;Anonymous ~ftp&gt;\n'
        '  User                ftp\n'
        '  Group               nogroup\n'
        '  UserAlias           anonymous ftp\n'
        '  RequireValidShell   off\n\n'
        '  &lt;Limit WRITE&gt;\n'
        '    DenyAll\n'
        '  &lt;/Limit&gt;\n'
        '&lt;/Anonymous&gt;'),
    '<p><code>~ftp</code> désigne le <strong>dossier personnel de l’utilisateur système '
    '<code>ftp</code></strong>, soit <code>/srv/ftp</code> sur Debian. Changer le point d’arrivée, '
    'c’est donc soit écrire un chemin en dur à la place de <code>~ftp</code>, soit déplacer le '
    'dossier personnel de ce compte.</p>',
    cmd('getent passwd ftp\n'
        '# ftp:x:105:65534:ftp daemon,,,:/srv/ftp:/usr/sbin/nologin\n\n'
        'sudo usermod -d /srv/depot ftp   # déplace le point d’arrivée'),
    note('red', '🚨 L’écriture anonyme',
         'Le bloc <code>&lt;Limit WRITE&gt; DenyAll</code> est ce qui empêche n’importe qui de déposer '
         'n’importe quoi sur le serveur. On ne le retire pas « pour voir » : un serveur FTP anonyme en '
         'écriture devient en quelques heures un entrepôt pour le premier robot qui le trouve.'),

    '<h2>9) Appliquer et vérifier</h2>',
    cmd('sudo proftpd -t                    # contrôle la syntaxe AVANT de redémarrer\n'
        'sudo systemctl restart proftpd\n'
        'systemctl status proftpd --no-pager\n'
        'sudo tail -f /var/log/proftpd/proftpd.log'),

    '<h2>10) FTP circule en clair</h2>',
    '<p>Identifiant et mot de passe traversent le réseau <strong>sans chiffrement</strong>. Une '
    'capture <a href="/pages/le-wireshark">Wireshark</a> sur le port 21 les affiche en toutes '
    'lettres.</p>',
    '<table class="lx-tab"><tr><th>Protocole</th><th>Ce que c’est</th><th>Port</th></tr>'
    '<tr><td>FTP</td><td>En clair — usage interne ou dépôt public seulement</td><td>21</td></tr>'
    '<tr><td>FTPS</td><td>FTP enveloppé dans TLS (<code>TLSEngine on</code>)</td><td>21 / 990</td></tr>'
    '<tr><td><strong>SFTP</strong></td><td>Rien à voir avec FTP : c’est un transfert de fichiers '
    '<strong>dans SSH</strong>. Déjà disponible dès qu’OpenSSH tourne.</td><td>22</td></tr></table>',
    note('gray', '💡 Le choix par défaut aujourd’hui',
         'Si le besoin est « déposer des fichiers sur ce serveur », SFTP ne demande rien à installer : '
         '<a href="/pages/linux-ssh">le serveur SSH</a> le fournit, et FileZilla s’y connecte de la '
         'même façon. ProFTPd garde son intérêt pour un dépôt public anonyme ou un cloisonnement fin '
         'par groupe.'),

    note('green', '🎓 Passer à la pratique',
         'Le corrigé du TP, manipulation par manipulation : '
         '<a href="/pages/tp-proftpd"><strong>TP ProFTPd (corrigé)</strong></a> — connexion '
         'authentifiée puis anonyme, <code>welcome.msg</code>, changement du point d’arrivée et '
         'utilisateur <code>webadmin</code> envoyé dans <code>/var/www</code>.'),
])

# ═══════════════════════════════════ TP 1 — recherche Apache (corrigé) ══

TP_RECHERCHE = '\n'.join([
    hero('TP · corrigé · Linux', 'TP Apache — Recherche préalable (corrigé)',
         'Les trois questions à savoir répondre : page d’ouverture, page d’erreur, site en HTTPS.'),
    STYLE_TP,
    note('blue', '🎯 Le TP',
         'Une recherche documentaire avant la pratique : trois questions qui constituent la base d’un '
         'serveur web. Ce corrigé donne la réponse <strong>et</strong> ce qu’il faut avoir compris '
         'derrière — c’est ce qu’on redemande ensuite. Cours : '
         '<a href="/pages/linux-apache-virtualhosts">Apache : hôtes virtuels, pages par défaut et '
         'HTTPS</a>.'),

    '<h2>① Une page d’ouverture au nom inhabituel</h2>',
    qr('La réponse',
       'La directive <code>DirectoryIndex</code>, placée dans l’hôte virtuel (ou dans un bloc '
       '<code>&lt;Directory&gt;</code>).'),
    cmd('&lt;VirtualHost *:80&gt;\n'
        '    ServerName exemple1.lan\n'
        '    DocumentRoot /var/www/exemple1\n'
        '    DirectoryIndex bienvenue.html index.html\n'
        '&lt;/VirtualHost&gt;', 'proc-cmd'),
    '<p>Apache sert <strong>le premier fichier trouvé</strong> dans la liste. Laisser '
    '<code>index.html</code> en dernier recours évite un site muet le jour où le fichier principal '
    'est renommé.</p>',
    qr('Ce qu’il faut avoir compris',
       'Sans <code>DirectoryIndex</code> satisfait, Apache affiche la <strong>liste du dossier</strong> '
       '— tout le contenu du site à qui passe. C’est <code>Options -Indexes</code> qui l’en empêche, '
       'et ça n’a rien d’optionnel sur un site accessible.'),

    '<h2>② La page affichée en cas d’erreur</h2>',
    qr('La réponse',
       'La directive <code>ErrorDocument</code>, une par code d’erreur à personnaliser.'),
    cmd('ErrorDocument 404 /erreurs/introuvable.html\n'
        'ErrorDocument 403 /erreurs/interdit.html\n'
        'ErrorDocument 500 /erreurs/panne.html\n\n'
        '# variante sans fichier :\n'
        'ErrorDocument 404 "Cette page n\'existe pas."', 'proc-cmd'),
    '<table class="ref-table"><tr><th>Code</th><th>Signification</th><th>Cause la plus fréquente</th></tr>'
    '<tr><td><strong>403</strong></td><td>Interdit</td><td>Droits Unix, ou <code>Require</code> qui '
    'refuse</td></tr>'
    '<tr><td><strong>404</strong></td><td>Introuvable</td><td>Mauvais chemin, ou fichier absent</td></tr>'
    '<tr><td><strong>500</strong></td><td>Erreur interne</td><td>Faute dans la configuration ou dans '
    'un script</td></tr></table>',
    qr('Le piège',
       'Le chemin part de la <strong>racine du site</strong> (<code>DocumentRoot</code>), pas du '
       'disque : il commence par <code>/</code> mais désigne <code>/var/www/…/erreurs/…</code>. Et si '
       'la page d’erreur est elle-même inaccessible, Apache affiche sa page brute — vérifie qu’elle '
       'n’est pas dans un dossier protégé.'),

    '<h2>③ Créer un site en HTTPS</h2>',
    qr('La réponse en trois temps',
       'Activer le module <code>ssl</code>, obtenir un certificat, puis déclarer un hôte virtuel sur '
       'le <strong>port 443</strong> avec <code>SSLEngine on</code>.'),
    cmd('# 1 — le module (ajoute aussi « Listen 443 » à ports.conf)\n'
        'sudo a2enmod ssl\n\n'
        '# 2 — un certificat auto-signé, suffisant en réseau interne\n'
        'sudo mkdir -p /etc/ssl/exemple1\n'
        'sudo openssl req -x509 -nodes -days 825 -newkey rsa:2048 \\\n'
        '  -keyout /etc/ssl/exemple1/site.key \\\n'
        '  -out    /etc/ssl/exemple1/site.crt \\\n'
        '  -subj "/CN=exemple1.lan"\n\n'
        '# 3 — l’hôte virtuel\n'
        '&lt;VirtualHost *:443&gt;\n'
        '    ServerName exemple1.lan\n'
        '    DocumentRoot /var/www/exemple1\n'
        '    SSLEngine on\n'
        '    SSLCertificateFile    /etc/ssl/exemple1/site.crt\n'
        '    SSLCertificateKeyFile /etc/ssl/exemple1/site.key\n'
        '&lt;/VirtualHost&gt;\n\n'
        'sudo a2ensite exemple1-ssl\n'
        'sudo apache2ctl configtest\n'
        'sudo systemctl reload apache2', 'proc-cmd'),
    '<p>Et pour que personne ne reste en clair, on renvoie le port 80 :</p>',
    cmd('&lt;VirtualHost *:80&gt;\n'
        '    ServerName exemple1.lan\n'
        '    Redirect permanent / https://exemple1.lan/\n'
        '&lt;/VirtualHost&gt;', 'proc-cmd'),
    qr('Pourquoi le navigateur proteste',
       'Un certificat <strong>auto-signé</strong> chiffre parfaitement, mais aucune autorité ne '
       'garantit l’identité du site : le navigateur ne peut pas savoir qu’il parle au bon serveur. '
       'Sur Internet, on prend un certificat Let’s Encrypt (<code>certbot</code>), gratuit, reconnu et '
       'renouvelé automatiquement.'),
    qr('Le contrôle',
       '<code>sudo ss -tlnp | grep :443</code> pour vérifier qu’Apache écoute, puis '
       '<code>openssl s_client -connect exemple1.lan:443</code> qui affiche le certificat présenté.'),

    note('green', '➡️ La suite',
         'Ces trois réponses servent directement dans le <a href="/pages/tp-apache-virtualhosts">'
         '<strong>TP Apache — hôtes virtuels</strong></a>, qui demande un site par défaut, des sites '
         'sur d’autres ports et un site en 443.'),
])

# ═════════════════════════════ TP 2 — hôtes virtuels Apache (corrigé) ══

TP_VH = '\n'.join([
    hero('TP · corrigé · Linux', 'TP Apache — Hôtes virtuels (corrigé)',
         'Site par défaut, site sur un autre port, restriction par IP cliente, site sur une adresse '
         'dédiée, zones DNS et site en HTTPS.'),
    STYLE_TP,
    note('blue', '🎯 Le TP',
         'Aller plus loin qu’un site : exploiter toutes les façons de déclarer un hôte virtuel. '
         'Prérequis — un serveur Debian avec Apache et le site <code>exemple1.lan</code> déjà en '
         'place, joint depuis un client Windows par le fichier <code>hosts</code>.',
         'Adresses de ce corrigé : serveur <strong>192.168.10.30</strong>, adresse secondaire '
         '<strong>192.168.10.31</strong>, client <strong>192.168.10.50</strong>. Cours : '
         '<a href="/pages/linux-apache-virtualhosts">Apache : hôtes virtuels, pages par défaut et '
         'HTTPS</a>.'),

    '<h2>① Le site par défaut, sur le port 80</h2>',
    qr('Ce qu’il faut avoir compris',
       'Il n’existe <strong>pas</strong> de directive « site par défaut ». Apache sert le '
       '<strong>premier hôte virtuel déclaré</strong> pour l’IP et le port concernés quand aucun '
       '<code>ServerName</code> ne correspond. Sur Debian, les liens de <code>sites-enabled</code> '
       'sont lus par ordre alphabétique : il suffit donc de nommer son fichier pour qu’il sorte en '
       'tête — d’où le <code>000-</code>.'),
    cmd('sudo mkdir -p /var/www/defaut\n'
        'echo "&lt;h1&gt;Votre requête n\'a pas pu aboutir, vous voici sur la page par défaut '
        'd\'Apache&lt;/h1&gt;" \\\n'
        '  | sudo tee /var/www/defaut/index.html\n'
        'sudo chown -R www-data:www-data /var/www/defaut', 'proc-cmd'),
    '<p><code>/etc/apache2/sites-available/000-defaut.conf</code> :</p>',
    cmd('&lt;VirtualHost *:80&gt;\n'
        '    DocumentRoot /var/www/defaut\n'
        '    ErrorLog ${APACHE_LOG_DIR}/defaut-error.log\n'
        '    CustomLog ${APACHE_LOG_DIR}/defaut-access.log combined\n'
        '&lt;/VirtualHost&gt;', 'proc-cmd'),
    cmd('sudo a2dissite 000-default.conf     # le site fourni par Debian\n'
        'sudo a2ensite 000-defaut.conf\n'
        'sudo apache2ctl configtest\n'
        'sudo systemctl reload apache2\n'
        'ls -l /etc/apache2/sites-enabled/    # 000-defaut doit venir en premier', 'proc-cmd'),
    qr('Pourquoi pas de <code>ServerName</code> ici',
       'Volontairement : ce site ne doit répondre à <strong>aucun</strong> nom en particulier, mais à '
       'tout ce qui n’a pas trouvé preneur. Un <code>ServerName</code> le ferait aussi répondre à ce '
       'nom-là, sans changer son rôle de site par défaut.'),
    qr('Le test — et pourquoi le fichier <code>hosts</code> ne sert à rien',
       'Tape <code>http://192.168.10.30</code> dans le navigateur du client. Comme tu utilises une '
       '<strong>adresse IP</strong> et non un nom, il n’y a rien à résoudre : ni <code>hosts</code>, '
       'ni DNS. Et aucun <code>ServerName</code> ne pouvant valoir « 192.168.10.30 », Apache tombe '
       'forcément sur le site par défaut.'),

    '<h2>② <code>intranet.exemple1.lan</code> sur le port 8080</h2>',
    qr('Le geste qu’on oublie',
       'Déclarer <code>&lt;VirtualHost *:8080&gt;</code> ne suffit pas : Apache n’écoute que les ports '
       'listés dans <code>ports.conf</code>. Sans <code>Listen 8080</code>, la configuration est '
       'valide et le site injoignable.'),
    cmd('# arborescence : l’enfant DANS le parent\n'
        'sudo mkdir -p /var/www/exemple1/intranet\n'
        'echo "&lt;h1&gt;Bienvenu sur l\'Intranet de la société Pandora !&lt;/h1&gt;" \\\n'
        '  | sudo tee /var/www/exemple1/intranet/index.html\n'
        'sudo chown -R www-data:www-data /var/www/exemple1', 'proc-cmd'),
    cmd('# /etc/apache2/ports.conf\nListen 80\nListen 8080', 'proc-cmd'),
    cmd('# /etc/apache2/sites-available/intranet.conf\n'
        '&lt;VirtualHost *:8080&gt;\n'
        '    ServerName intranet.exemple1.lan\n'
        '    DocumentRoot /var/www/exemple1/intranet\n'
        '    ErrorLog ${APACHE_LOG_DIR}/intranet-error.log\n'
        '&lt;/VirtualHost&gt;\n\n'
        'sudo a2ensite intranet\nsudo systemctl reload apache2\n'
        'sudo ss -tlnp | grep -E ":(80|8080)"', 'proc-cmd'),
    qr('L’adresse à taper',
       '<code>http://intranet.exemple1.lan:8080</code>. L’énoncé écrit l’adresse sans le port, mais '
       'un navigateur suppose toujours 80 : le port doit être précisé. Sans lui, tu tombes sur le '
       'site par défaut de la question ①.'),
    qr('Côté client',
       'Ajouter <code>192.168.10.30  intranet.exemple1.lan</code> dans '
       '<code>C:\\Windows\\System32\\drivers\\etc\\hosts</code> (à ouvrir en tant qu’administrateur) — '
       'jusqu’à la question ⑥ qui remplace tout ça par du DNS.'),

    '<h2>③ Un site réservé à l’adresse IP du client</h2>',
    cmd('sudo mkdir -p /var/www/prive\n'
        'echo "&lt;h1&gt;Zone privée — poste autorisé&lt;/h1&gt;" | sudo tee /var/www/prive/index.html\n'
        'sudo chown -R www-data:www-data /var/www/prive', 'proc-cmd'),
    cmd('# /etc/apache2/sites-available/prive.conf\n'
        '&lt;VirtualHost *:80&gt;\n'
        '    ServerName prive.exemple1.lan\n'
        '    DocumentRoot /var/www/prive\n\n'
        '    &lt;Directory /var/www/prive&gt;\n'
        '        Options -Indexes\n'
        '        Require ip 192.168.10.50\n'
        '    &lt;/Directory&gt;\n'
        '&lt;/VirtualHost&gt;', 'proc-cmd'),
    qr('La syntaxe qui piège',
       'La plupart des tutoriels montrent encore <code>Order allow,deny</code> / <code>Allow from</code> '
       ': c’est de l’Apache <strong>2.2</strong>. Sur Debian 12 (Apache 2.4) ces directives ne sont '
       'pas comprises et <code>configtest</code> échoue. La syntaxe actuelle est '
       '<code>Require ip</code> / <code>Require all granted</code> / <code>Require all denied</code>.'),
    qr('Le test',
       'Depuis le poste autorisé : la page s’affiche. Depuis une autre machine (ou le serveur '
       'lui-même en <code>curl</code>) : <strong>403 Forbidden</strong>. Un test qui ne renvoie pas '
       '403 depuis une machine non autorisée ne prouve rien.'),
    cmd('# depuis le serveur — doit répondre 403\n'
        'curl -I -H "Host: prive.exemple1.lan" http://127.0.0.1', 'proc-cmd'),

    '<h2>④ <code>siteweb.exemple1.lan</code> sur une adresse IP dédiée</h2>',
    qr('Les deux moitiés du travail',
       'Déclarer l’hôte virtuel sur l’adresse ne suffit pas : la machine doit '
       '<strong>posséder</strong> cette adresse. C’est le rôle d’une <strong>interface virtuelle</strong> '
       '(alias IP) — une seconde adresse sur la carte physique, déclarée dans le système, sans rien '
       'ajouter côté hyperviseur.'),
    cmd('# le nom réel de la carte\nip -br link\n\n'
        '# essai immédiat (perdu au redémarrage)\n'
        'sudo ip addr add 192.168.10.31/24 dev ens33\n'
        'ip -br addr show ens33', 'proc-cmd'),
    '<p>Pour que ça tienne — <code>/etc/network/interfaces</code> :</p>',
    cmd('auto ens33\n'
        'iface ens33 inet static\n'
        '    address 192.168.10.30/24\n'
        '    gateway 192.168.10.254\n\n'
        'auto ens33:0\n'
        'iface ens33:0 inet static\n'
        '    address 192.168.10.31/24\n\n'
        'sudo systemctl restart networking\n'
        'ip -br addr', 'proc-cmd'),
    cmd('# /etc/apache2/sites-available/siteweb.conf\n'
        '&lt;VirtualHost 192.168.10.31:80&gt;\n'
        '    ServerName siteweb.exemple1.lan\n'
        '    DocumentRoot /var/www/exemple1/siteweb\n'
        '&lt;/VirtualHost&gt;', 'proc-cmd'),
    qr('Ce que ça change',
       'Le nom <code>siteweb.exemple1.lan</code> ne répondra que sur <strong>.31</strong>. Côté '
       'client, l’entrée <code>hosts</code> (ou l’enregistrement DNS) doit donc pointer vers '
       '<code>192.168.10.31</code> et non <code>.30</code> — c’est là que se joue l’exercice.'),
    qr('Le contrôle qui isole la panne',
       '<code>curl -H "Host: siteweb.exemple1.lan" http://192.168.10.31</code> doit répondre, et la '
       'même commande sur <code>192.168.10.30</code> doit servir le site par défaut. Si les deux '
       'répondent pareil, l’hôte virtuel n’est pas lié à l’adresse.'),

    '<h2>⑤ Le site sur le vrai nom de domaine</h2>',
    '<p><code>exemple1.lan</code> n’était qu’un support d’exercice. On publie la page d’accueil sur '
    'le domaine réel — ici <code>miyukini.lan</code>, l’énoncé prend <code>pandora.lan</code>.</p>',
    cmd('sudo mkdir -p /var/www/miyukini\n'
        'echo "&lt;h1&gt;Miyukini&lt;/h1&gt;" | sudo tee /var/www/miyukini/index.html\n'
        'sudo chown -R www-data:www-data /var/www/miyukini', 'proc-cmd'),
    cmd('&lt;VirtualHost *:80&gt;\n'
        '    ServerName miyukini.lan\n'
        '    ServerAlias www.miyukini.lan\n'
        '    DocumentRoot /var/www/miyukini\n'
        '&lt;/VirtualHost&gt;', 'proc-cmd'),
    qr('<code>ServerAlias</code>',
       'Un hôte virtuel ne répond qu’au nom exact de son <code>ServerName</code>. '
       '<code>www.miyukini.lan</code> et <code>miyukini.lan</code> sont deux noms différents : sans '
       '<code>ServerAlias</code>, le second tombe sur le site par défaut.'),

    '<h2>⑥ Un DNS pour remplacer les fichiers <code>hosts</code></h2>',
    qr('Pourquoi plusieurs zones',
       'Une zone DNS couvre <strong>un</strong> domaine. Avec <code>exemple1.lan</code> et '
       '<code>miyukini.lan</code>, il faut <strong>deux zones directes</strong>, chacune avec son '
       'fichier. Les sous-domaines (<code>intranet</code>, <code>siteweb</code>) sont de simples '
       'enregistrements <strong>dans</strong> la zone du parent — pas des zones supplémentaires.'),
    cmd('sudo apt install -y bind9 bind9-utils\n\n'
        '# /etc/bind/named.conf.local\n'
        'zone "exemple1.lan" {\n'
        '    type master;\n'
        '    file "/etc/bind/db.exemple1.lan";\n'
        '};\n\n'
        'zone "miyukini.lan" {\n'
        '    type master;\n'
        '    file "/etc/bind/db.miyukini.lan";\n'
        '};', 'proc-cmd'),
    cmd('; /etc/bind/db.exemple1.lan\n'
        '$TTL    3D\n'
        '@   IN  SOA srv.exemple1.lan. admin.exemple1.lan. (\n'
        '        2026090201 ; serial — à incrémenter à CHAQUE modification\n'
        '        8H ; refresh\n        2H ; retry\n        4W ; expire\n        3D ) ; minimum\n'
        '@           IN  NS  srv.exemple1.lan.\n'
        'srv         IN  A   192.168.10.30\n'
        '@           IN  A   192.168.10.30\n'
        'intranet    IN  A   192.168.10.30\n'
        'prive       IN  A   192.168.10.30\n'
        'siteweb     IN  A   192.168.10.31   ; l’adresse dédiée de la question ④', 'proc-cmd'),
    cmd('sudo named-checkconf\n'
        'sudo named-checkzone exemple1.lan /etc/bind/db.exemple1.lan\n'
        'sudo named-checkzone miyukini.lan /etc/bind/db.miyukini.lan\n'
        'sudo systemctl restart bind9\n\n'
        '# depuis le client, après avoir pointé son DNS sur 192.168.10.30 :\n'
        'nslookup intranet.exemple1.lan\n'
        'nslookup siteweb.exemple1.lan     # doit répondre .31, pas .30', 'proc-cmd'),
    qr('Ne pas oublier',
       'Vider les entrées ajoutées dans le <code>hosts</code> du client, sinon elles continuent de '
       'répondre <strong>avant</strong> le DNS et tu testeras l’ancienne configuration sans le savoir. '
       'Puis <code>ipconfig /flushdns</code>.'),
    '<p>Détail complet dans le corrigé <a href="/pages/tp-dns-bind9-directe">TP DNS BIND9 — zone '
    'directe</a> et la <a href="/pages/procedure-dns-linux-bind9">procédure BIND9</a>.</p>',

    '<h2>⑦ <code>monhistoire.exemple1.lan</code> sur le port 443 uniquement</h2>',
    cmd('sudo a2enmod ssl\n'
        'sudo mkdir -p /var/www/exemple1/monhistoire /etc/ssl/exemple1\n'
        'echo "&lt;h1&gt;Mon histoire&lt;/h1&gt;" \\\n'
        '  | sudo tee /var/www/exemple1/monhistoire/index.html\n\n'
        'sudo openssl req -x509 -nodes -days 825 -newkey rsa:2048 \\\n'
        '  -keyout /etc/ssl/exemple1/monhistoire.key \\\n'
        '  -out    /etc/ssl/exemple1/monhistoire.crt \\\n'
        '  -subj "/CN=monhistoire.exemple1.lan"', 'proc-cmd'),
    cmd('&lt;VirtualHost *:443&gt;\n'
        '    ServerName monhistoire.exemple1.lan\n'
        '    DocumentRoot /var/www/exemple1/monhistoire\n'
        '    SSLEngine on\n'
        '    SSLCertificateFile    /etc/ssl/exemple1/monhistoire.crt\n'
        '    SSLCertificateKeyFile /etc/ssl/exemple1/monhistoire.key\n'
        '&lt;/VirtualHost&gt;\n\n'
        'sudo a2ensite monhistoire\nsudo apache2ctl configtest\n'
        'sudo systemctl reload apache2', 'proc-cmd'),
    qr('« Uniquement sur 443 »',
       'On ne déclare <strong>aucun</strong> hôte virtuel sur le port 80 pour ce nom. '
       '<code>http://monhistoire.exemple1.lan</code> tombera donc sur le site par défaut de la '
       'question ①, ce qui est le comportement attendu. Ajouter une redirection 80 → 443 serait plus '
       'confortable, mais ne répond plus à l’énoncé.'),
    qr('Et l’enregistrement DNS',
       'Ajouter <code>monhistoire IN A 192.168.10.30</code> dans <code>db.exemple1.lan</code>, et '
       '<strong>incrémenter le serial</strong> — sans quoi les clients garderont l’ancienne zone.'),

    '<h2>✅ Le récapitulatif</h2>',
    '<table class="ref-table"><tr><th>Site</th><th>Écoute</th><th>Particularité</th></tr>'
    '<tr><td>défaut</td><td><code>*:80</code>, lu en premier</td><td>Aucun <code>ServerName</code></td></tr>'
    '<tr><td>exemple1.lan</td><td><code>*:80</code></td><td>Le site du TP précédent</td></tr>'
    '<tr><td>intranet.exemple1.lan</td><td><code>*:8080</code></td><td><code>Listen 8080</code> requis</td></tr>'
    '<tr><td>prive.exemple1.lan</td><td><code>*:80</code></td><td><code>Require ip</code></td></tr>'
    '<tr><td>siteweb.exemple1.lan</td><td><code>192.168.10.31:80</code></td><td>Alias IP sur la carte</td></tr>'
    '<tr><td>miyukini.lan</td><td><code>*:80</code></td><td>Le domaine réel + <code>ServerAlias</code></td></tr>'
    '<tr><td>monhistoire.exemple1.lan</td><td><code>*:443</code></td><td>SSL, rien sur le 80</td></tr></table>',
    note('gray', '🔍 Quand un site répond à la place d’un autre',
         '<code>apache2ctl -S</code> affiche la liste complète des hôtes virtuels, leur ordre, et '
         '<strong>lequel est le site par défaut</strong> de chaque IP:port. C’est la commande qui '
         'répond en une ligne à « pourquoi c’est cette page qui s’affiche ».'),
])

# ══════════════════════════════════════════ TP 3 — ProFTPd (corrigé) ══

TP_FTP = '\n'.join([
    hero('TP · corrigé · Linux', 'TP ProFTPd (corrigé)',
         'Installer un serveur FTP, observer ce qu’il autorise avant configuration, cloisonner les '
         'utilisateurs, ouvrir un accès anonyme et le placer où l’on veut.'),
    STYLE_TP,
    note('blue', '🎯 Le TP',
         'Une Debian et un client Windows en IP fixe, qui se voient et accèdent à Internet. Le serveur '
         'web du TP précédent fait très bien l’affaire — c’est même ce qui donne son intérêt à la '
         'dernière question. Cours : <a href="/pages/linux-proftpd">FTP : le serveur ProFTPd</a>.',
         'Adresses de ce corrigé : serveur <strong>192.168.10.30</strong>, client '
         '<strong>192.168.10.50</strong>.'),

    '<h2>① Installer, sans rien configurer</h2>',
    cmd('sudo apt update\n'
        'apt search ^proftpd          # le nom du paquet dépend de la version\n'
        'sudo apt install proftpd-core    # Debian 12 (Debian 11 : proftpd-basic)\n\n'
        'systemctl status proftpd --no-pager\n'
        'sudo ss -tlnp | grep :21', 'proc-cmd'),
    '<p>Sur la machine, déposer un repère dans le dossier personnel — on saura tout de suite où l’on '
    'atterrit :</p>',
    cmd('touch ~/JE-SUIS-DANS-MON-DOSSIER-PERSO.txt', 'proc-cmd'),

    '<h2>② Se connecter avant toute configuration — et regarder</h2>',
    '<p>Avec FileZilla : hôte <code>192.168.10.30</code>, identifiant et mot de passe du compte '
    'Linux, port 21. En ligne de commande : <code>ftp 192.168.10.30</code>.</p>',
    qr('Où arrive-t-on ?',
       'Dans son <strong>dossier personnel</strong> (<code>/home/toto</code>) — le fichier repère est '
       'là.'),
    qr('Que peut-on y faire ?',
       '<strong>Tout</strong> : lire, écrire, créer, supprimer. Les droits appliqués sont ceux du '
       'compte Unix, et il est propriétaire de son dossier.'),
    qr('Peut-on se déplacer dans l’arborescence ?',
       '<strong>Oui, et c’est le problème.</strong> <code>cd ..</code> remonte dans '
       '<code>/home</code>, puis <code>/</code>. On parcourt <code>/etc</code>, on liste les autres '
       'comptes, on lit les fichiers de configuration lisibles par tous. On ne peut pas les modifier, '
       'mais tout voir est déjà beaucoup trop.'),
    cmd('ftp&gt; pwd\n250 "/home/toto" is the current directory\n'
        'ftp&gt; cd ..\nftp&gt; ls\n'
        '# … toute l’arborescence du serveur', 'proc-cmd'),
    '<p>C’est exactement ce que corrige <code>DefaultRoot</code>.</p>',

    '<h2>③ Sauvegarder, puis configurer</h2>',
    cmd('sudo cp /etc/proftpd/proftpd.conf /etc/proftpd/proftpd.conf.old\n'
        'sudo nano /etc/proftpd/proftpd.conf', 'proc-cmd'),
    note('yellow', '⚠️ Une ambiguïté de l’énoncé',
         'Il demande de faire une copie… puis d’« ouvrir le fichier que nous venons de sauvegarder ». '
         'C’est bien l’<strong>original</strong> qu’on modifie : la copie <code>.old</code> est le '
         'filet de secours et ne doit plus bouger. ProFTPd ne lit que '
         '<code>/etc/proftpd/proftpd.conf</code>.'),
    '<table class="ref-table"><tr><th>Ligne à modifier</th><th>Valeur</th><th>Effet</th></tr>'
    '<tr><td><code>ServerName</code></td><td><code>"FTP Miyukini"</code></td>'
    '<td>Le nom annoncé à la connexion</td></tr>'
    '<tr><td><code>DefaultRoot</code></td><td><code>~</code> (décommenter)</td>'
    '<td>Enferme chacun dans son dossier personnel</td></tr>'
    '<tr><td><code>PassivePorts</code></td><td><code>49152 65534</code></td>'
    '<td>La plage du canal de données</td></tr>'
    '<tr><td><code>MaxInstances</code></td><td><code>30</code></td><td>Connexions simultanées</td></tr>'
    '<tr><td><code>TimeoutIdle</code></td><td><code>1200</code></td>'
    '<td>Déconnexion après 20 min d’inactivité</td></tr></table>',
    cmd('sudo proftpd -t                 # contrôle de syntaxe\n'
        'sudo systemctl restart proftpd', 'proc-cmd'),
    qr('La différence avec les tests du ②',
       'Le nom annoncé change à la connexion, et surtout <code>cd ..</code> ne remonte plus : le '
       'dossier personnel <strong>est devenu la racine</strong> pour cet utilisateur '
       '(<code>pwd</code> répond <code>/</code>). Il descend dans ses sous-dossiers, il ne sort plus.'),

    '<h2>④ La connexion anonyme</h2>',
    '<p>Décommenter le bloc <code>&lt;Anonymous ~ftp&gt;</code>, puis redémarrer. On se connecte avec '
    'l’identifiant <code>anonymous</code> et n’importe quel mot de passe (par convention, une adresse '
    'de courriel).</p>',
    qr('Qu’est-ce qui est possible ?',
       '<strong>Lire et télécharger</strong>, dans <code>/srv/ftp</code>.'),
    qr('Qu’est-ce qui ne l’est pas ?',
       '<strong>Écrire</strong> : créer un dossier, déposer ou supprimer un fichier renvoie une erreur '
       'de permission. C’est le bloc <code>&lt;Limit WRITE&gt; DenyAll &lt;/Limit&gt;</code> qui '
       'l’interdit — et il faut le laisser.'),
    note('red', '🚨 Pourquoi on ne le retire pas',
         'Un serveur FTP anonyme ouvert en écriture est repéré en quelques heures par des robots qui '
         'l’utilisent comme entrepôt de fichiers. C’est le sens de la remarque de l’énoncé : « il '
         'faudrait être fou pour autoriser tout le monde à écrire ».'),

    '<h2>⑤ Trouver <code>welcome.msg</code> et la directive qui l’amène</h2>',
    cmd('sudo find / -name "welcome.msg" 2&gt;/dev/null\n'
        '# /srv/ftp/welcome.msg', 'proc-cmd'),
    qr('Pourquoi <code>/srv/ftp</code> ?',
       'Le bloc s’ouvre sur <code>&lt;Anonymous ~ftp&gt;</code>. Le <code>~ftp</code> désigne le '
       '<strong>dossier personnel de l’utilisateur système <code>ftp</code></strong>, et sur Debian '
       'c’est <code>/srv/ftp</code>. C’est donc <code>~ftp</code>, la directive qui décide du point '
       'd’arrivée.'),
    cmd('getent passwd ftp\n'
        '# ftp:x:105:65534:ftp daemon,,,:/srv/ftp:/usr/sbin/nologin\n'
        '#                                ^^^^^^^^ le voilà', 'proc-cmd'),
    qr('Et qui affiche le fichier ?',
       'La directive <code>DisplayLogin welcome.msg</code>, dans le bloc <code>&lt;Anonymous&gt;</code> '
       ': elle affiche le contenu du fichier au moment de la connexion. Deux directives distinctes '
       'donc — l’une décide <em>où</em>, l’autre <em>quoi afficher</em>.'),

    '<h2>⑥ Faire atterrir l’anonyme dans un autre dossier</h2>',
    cmd('mkdir -p ~/depot-public\n'
        'echo "Bienvenue sur le dépôt public de Miyukini." &gt; ~/depot-public/A-LIRE.txt\n'
        'echo "Dépôt public — lecture seule." &gt; ~/depot-public/welcome.msg\n'
        'chmod -R a+rX ~/depot-public\n'
        'chmod a+x ~                     # l’anonyme doit pouvoir TRAVERSER le dossier parent', 'proc-cmd'),
    '<p>Deux façons, au choix :</p>',
    cmd('# A — écrire le chemin en dur dans le bloc\n'
        '&lt;Anonymous /home/toto/depot-public&gt;\n'
        '  User              ftp\n'
        '  Group             nogroup\n'
        '  UserAlias         anonymous ftp\n'
        '  RequireValidShell off\n'
        '  DisplayLogin      welcome.msg\n'
        '  &lt;Limit WRITE&gt;\n    DenyAll\n  &lt;/Limit&gt;\n'
        '&lt;/Anonymous&gt;', 'proc-cmd'),
    cmd('# B — déplacer le dossier personnel du compte ftp, et garder ~ftp\n'
        'sudo usermod -d /home/toto/depot-public ftp\n'
        'getent passwd ftp', 'proc-cmd'),
    cmd('sudo proftpd -t\nsudo systemctl restart proftpd', 'proc-cmd'),
    qr('Le piège des droits',
       'L’anonyme se connecte en tant qu’utilisateur <code>ftp</code>, pas en tant que toi. Il doit '
       'pouvoir <strong>traverser</strong> chaque dossier du chemin — <code>/home</code>, '
       '<code>/home/toto</code>, puis <code>depot-public</code>. Un <code>/home/toto</code> en '
       '<code>750</code> bloque tout, avec un message qui parle de connexion refusée et non de '
       'droits.'),
    '<p><strong>Le test :</strong> se reconnecter en <code>anonymous</code> depuis FileZilla. Le '
    'message d’accueil doit être celui du nouveau <code>welcome.msg</code>, et '
    '<code>A-LIRE.txt</code> visible dès l’arrivée.</p>',

    '<h2>⑦ <code>webadmin</code> dans <code>/var/www</code>, les autres chez eux</h2>',
    qr('L’idée',
       '<code>DefaultRoot</code> accepte un <strong>second argument</strong> : un groupe. On peut donc '
       'empiler les règles. ProFTPd retient la <strong>première qui correspond</strong> à '
       'l’utilisateur : la règle particulière se place <strong>avant</strong> la générale.'),
    cmd('sudo useradd -m -s /bin/bash webadmin\n'
        'sudo passwd webadmin\n'
        'sudo groupadd -f webadmins\n'
        'sudo usermod -aG webadmins webadmin\n\n'
        '# lui donner de quoi travailler dans /var/www\n'
        'sudo chgrp -R webadmins /var/www\n'
        'sudo chmod -R 2775 /var/www', 'proc-cmd'),
    cmd('# /etc/proftpd/proftpd.conf — dans cet ordre !\n'
        'DefaultRoot /var/www  webadmins\n'
        'DefaultRoot ~', 'proc-cmd'),
    cmd('sudo proftpd -t\nsudo systemctl restart proftpd', 'proc-cmd'),
    qr('Le contrôle',
       'Se connecter en <code>webadmin</code> : <code>pwd</code> répond <code>/</code> et le contenu '
       'est celui de <code>/var/www</code> — les sites du TP Apache sont là. Se reconnecter avec un '
       'autre compte : on est toujours dans son dossier personnel. Si <strong>tout le monde</strong> '
       'arrive dans <code>/var/www</code>, les deux lignes sont dans le mauvais ordre.'),
    qr('La variante sans groupe',
       '<code>sudo usermod -d /var/www webadmin</code> déplace son dossier personnel : avec '
       '<code>DefaultRoot ~</code>, il atterrit dans <code>/var/www</code> sans autre réglage. Plus '
       'court, mais ça change aussi l’endroit où il arrive en SSH — l’approche par groupe ne touche '
       'que le FTP.'),

    '<h2>🔒 Pour finir : ce que ce TP ne montre pas</h2>',
    '<p>Toute cette session circule <strong>en clair</strong>. Une capture '
    '<a href="/pages/le-wireshark">Wireshark</a> sur le port 21 pendant la connexion affiche '
    'l’identifiant et le mot de passe en toutes lettres — c’est une démonstration à faire une fois, '
    'elle marque durablement.</p>',
    cmd('sudo tcpdump -i ens33 -A port 21', 'proc-cmd'),
    '<p>En production, on utilise <strong>SFTP</strong> (fourni par '
    '<a href="/pages/linux-ssh">OpenSSH</a>, rien à installer) ou <strong>FTPS</strong> '
    '(<code>TLSEngine on</code> dans ProFTPd). ProFTPd garde son intérêt pour un dépôt public anonyme '
    'et pour le cloisonnement par groupe qu’on vient de faire.</p>',
])

# ═══════════════════════════════════════════════════════════ le lot ══

PAGES = [
    ('linux-apache-virtualhosts', 'Apache : hôtes virtuels, pages par défaut et HTTPS',
     'Comment Apache choisit le site à servir : IP, port et nom ; le site par défaut ; '
     'DirectoryIndex et ErrorDocument ; restriction par IP ; alias IP ; HTTPS et certificat.',
     APACHE_VH),
    ('linux-proftpd', 'FTP : le serveur ProFTPd',
     'Client et serveur, les deux canaux (21 et 20), modes actif et passif, DefaultRoot et le '
     'cloisonnement, connexions anonymes — et pourquoi SFTP est le choix par défaut aujourd’hui.',
     PROFTPD),
    ('tp-apache-recherche', 'TP Apache — Recherche préalable (corrigé)',
     'Les trois questions corrigées : DirectoryIndex pour la page d’ouverture, ErrorDocument pour '
     'les pages d’erreur, et la mise en place d’un site en HTTPS.',
     TP_RECHERCHE),
    ('tp-apache-virtualhosts', 'TP Apache — Hôtes virtuels (corrigé)',
     'Site par défaut, site sur le port 8080, restriction à une IP cliente, site sur une adresse '
     'dédiée avec alias IP, domaine réel, zones DNS et site en 443.',
     TP_VH),
    ('tp-proftpd', 'TP ProFTPd (corrigé)',
     'De l’installation nue au cloisonnement : ce qu’un utilisateur peut faire sans DefaultRoot, '
     'l’accès anonyme, welcome.msg, le déplacement du point d’arrivée et webadmin dans /var/www.',
     TP_FTP),
]


def main():
    c = sqlite3.connect(BASE)
    crees, majs = [], []
    for slug, titre, extrait, contenu in PAGES:
        if c.execute('SELECT 1 FROM pages WHERE slug=?', (slug,)).fetchone():
            c.execute("UPDATE pages SET title=?, excerpt=?, content=?, published=1,"
                      " updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug=?",
                      (titre, extrait, contenu, slug))
            majs.append(slug)
        else:
            c.execute("INSERT INTO pages (title, slug, content, excerpt, builder_json, published,"
                      " created_at, updated_at) VALUES (?,?,?,?,'',1,"
                      " strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
                      (titre, slug, contenu, extrait))
            crees.append(slug)
    c.commit()
    c.close()
    print(f'{len(crees)} creee(s), {len(majs)} maj')
    for s in crees:
        print('  +', s, len(dict((p[0], p[3]) for p in PAGES)[s]), 'car.')
    for s in majs:
        print('  ~', s, len(dict((p[0], p[3]) for p in PAGES)[s]), 'car.')
    return 0


if __name__ == '__main__':
    sys.exit(main())

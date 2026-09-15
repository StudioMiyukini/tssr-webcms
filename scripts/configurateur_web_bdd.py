# -*- coding: utf-8 -*-
"""
Page « Configurateur — duo web + base » : deux VM Debian clonées depuis un
master, l'une nginx + Node.js, l'autre MariaDB, IP fixes, moteur relié à la
base, page de test. L'îlot React est `WebDbConfigurator` (data-block
"web-db-configurator") ; cette page l'encadre et le range dans les Outils.

IDEMPOTENT.
"""
import re
import sqlite3
import sys

from _cours import BASE, STYLE, bullets, hero, note, publier, steps, tab

SLUG = 'configurateur-web-bdd'
TITRE = 'Configurateur — duo web + base de données'

CONTENU = '\n'.join([
    hero('Outil · Linux / Virtualisation', TITRE,
         'Deux VM Debian clonées depuis ton master : un moteur nginx + Node.js et une base MariaDB, '
         'chacune en IP fixe dans son réseau, reliées automatiquement, avec une page qui prouve que tout fonctionne.'),
    STYLE,
    '<p>C’est le montage le plus courant d’une application d’entreprise : un <strong>serveur web</strong> '
    'devant, une <strong>base de données</strong> derrière, sur deux machines séparées. L’outil génère les '
    'scripts qui le construisent de bout en bout — clonage, adressage, installation, liaison, test — '
    'à partir de tes choix. Le mot de passe est celui du labo, <code>Azerty77</code>, partout.</p>',

    '<h2>Ce que l’outil produit</h2>',
    tab(['Script', 'Où le jouer', 'Ce qu’il fait'], [
        ['① Clonage', 'Sur l’hôte (PowerShell Hyper-V, ou shell Proxmox)', 'Deux clones du master (trois avec la messagerie), vCPU / RAM, commutateur, démarrage ; dépôt des scripts ② et ③ dans les VM (Hyper-V, si <code>hyperv-daemons</code> est dans le master)'],
        ['② VM base', 'Dans la VM base, en root', 'Nom, IP fixe, MariaDB qui écoute sur le réseau, base + utilisateur autorisé <strong>depuis la VM web seulement</strong>, table de test remplie'],
        ['③ VM web', 'Dans la VM web, en root', 'Nom, IP fixe, nginx + Node.js, application de test dans <code>/srv/app</code> (identifiants dans <code>.env</code>), service systemd, nginx en mandataire inverse'],
        ['④ VM messagerie (option)', 'Dans la VM DMZ, en root', 'Postfix + Dovecot + Roundcube, comptes lus dans la base, message de test envoyé et remis, webmail vérifié'],
        ['⑤ Vérifier', 'Depuis un poste, puis depuis chaque VM', 'ping, <code>curl /api/sante</code>, la page dans le navigateur, le client mysql, les journaux'],
    ]),

    '<div data-block="web-db-configurator"></div>',

    '<h2>Option : GLPI sur la VM web</h2>',
    '<p>Cocher <strong>Installer GLPI ici</strong> sur la VM 1 ajoute au script ③ l’installation de PHP-FPM et de la '
    '<strong>dernière version de GLPI</strong> (téléchargée depuis GitHub, installée par sa ligne de commande '
    '<code>bin/console db:install</code>, sans assistant web), sur une base <code>glpi</code> créée par le script ② sur la '
    'VM base — avec l’utilisateur <code>glpi</code> autorisé depuis l’IP du web seulement, et les <strong>tables de fuseaux '
    'horaires</strong> que GLPI exige. GLPI répond sur <code>http://&lt;IP web&gt;:8080/</code> (le port 80 reste à la page '
    'de test) et sur le port 80 sous le nom <code>glpi.&lt;domaine&gt;</code> si le DNS interne le connaît. Comptes par '
    'défaut <code>glpi/glpi</code>, <code>tech/tech</code>, <code>normal/normal</code>, <code>post-only/postonly</code> : '
    'GLPI demande de les changer, c’est la première chose à faire. Le cours : <a href="/pages/le-ticketing">Le ticketing</a>, '
    '<a href="/pages/itil-support">ITIL pour le support</a>.</p>',

    '<h2>Option : la messagerie en DMZ</h2>',
    '<p>En cochant <strong>VM 3 — messagerie en DMZ</strong>, l’outil ajoute un troisième clone : '
    '<strong>Postfix</strong> (SMTP, port 25 entre serveurs et 587 authentifié pour les clients), '
    '<strong>Dovecot</strong> (IMAP 143/993, remise LMTP) et <strong>Roundcube</strong> (webmail sur Apache). '
    'La base MariaDB de la VM base est <strong>réutilisée</strong> deux fois : les domaines, boîtes et alias '
    'sont dans <code>maildb</code> (Postfix et Dovecot les lisent avec un compte en lecture seule autorisé depuis '
    'l’IP de la DMZ), et Roundcube a sa base <code>roundcube</code>. Le mot de passe des boîtes est stocké au '
    'format Dovecot <code>{SHA512}</code>, calculé en SQL par le script base — le serveur de messagerie n’a '
    'donc rien à écrire dans la base.</p>',
    tab(['Composant', 'Rôle', 'Où il lit / écrit'], [
        ['Postfix', 'Reçoit (25), accepte les envois authentifiés (587), remet à Dovecot par LMTP', '<code>maildb</code> : <code>virtual_domains</code>, <code>virtual_users</code>, <code>virtual_aliases</code> (lecture)'],
        ['Dovecot', 'Authentifie (SASL pour Postfix, IMAP pour les clients), range en Maildir sous <code>/var/mail/vhosts/&lt;domaine&gt;/&lt;boîte&gt;</code>', '<code>maildb.virtual_users</code> (lecture) ; utilisateur système <code>vmail</code> (uid 5000)'],
        ['Roundcube', 'Webmail <code>http://&lt;IP DMZ&gt;/roundcube/</code>, IMAP et SMTP en local', '<code>roundcube</code> (lecture/écriture : sessions, carnets, préférences)'],
    ]),
    note('yellow', '🧱 Ce que le pare-feu doit laisser passer',
         '<strong>DMZ → LAN</strong> : TCP 3306 de la VM messagerie vers la VM base — le seul flux de la DMZ vers '
         'l’intérieur, à écrire précisément (source, destination, port) · <strong>LAN → DMZ</strong> : 25, 587, 143, 993 '
         'et 80 vers la VM messagerie · <strong>DMZ → Internet</strong> : 80/443 le temps de l’installation · '
         '<strong>Internet → DMZ</strong> : 25 seulement si le domaine reçoit du courrier de l’extérieur. Dans le DNS '
         'interne (Unbound sur OPNsense) : un A pour <code>mail.&lt;domaine&gt;</code> et un MX pour le domaine. '
         'Les cours : <a href="/pages/dmz">Comprendre la DMZ</a>, <a href="/pages/dmz-mise-en-place">Mettre en place une DMZ</a>.'),
    '<p>Le script messagerie vérifie lui-même : le flux vers la base, que Postfix trouve une boîte dans '
    'MariaDB, que Dovecot authentifie un compte, puis <strong>envoie un vrai message</strong> d’une boîte à l’autre '
    'en SMTP authentifié et constate sa remise dans le Maildir, et enfin que le webmail répond. Côté client : '
    'IMAP sur l’IP DMZ port 143, SMTP port 587, identifiant = l’adresse complète, mot de passe du labo.</p>',

    '<h2>Avant de lancer</h2>',
    bullets('Le <strong>master</strong> est un Debian 12 ou 13 installé, à jour, éteint (les scripts reconnaissent Dovecot 2.3 / 2.4 et le client <code>mariadb</code> de Debian 13). Le script reconnaît le gestionnaire réseau en place — <code>ifupdown</code> (installation par défaut), NetworkManager (avec bureau) ou systemd-networkd (images cloud) — et ne remplace que sa configuration. Sur Hyper-V, le paquet <code>hyperv-daemons</code> dans le master permet à ① de déposer les scripts sans réseau.',
            'Les VM ont besoin d’<strong>Internet pendant l’installation</strong> (<code>apt</code>, <code>npm</code>). Le script s’adapte : si le réseau courant du clone sort déjà, il installe d’abord et adresse à la fin ; sinon il applique l’IP fixe d’abord. Sans Internet dans les deux cas, il s’arrête avec un message clair avant d’avoir rien cassé.',
            'Chaque VM a <strong>son réseau</strong> : adresse, masque, passerelle (par défaut le .254 de son sous-réseau) et DNS (par défaut la passerelle). Deux sous-réseaux différents — par exemple le moteur en <code>192.168.30.5</code> et la base en <code>192.168.20.5</code> — sont le cas normal d’une architecture segmentée : le flux passe alors par le routeur ou le pare-feu, qui doit <strong>router les deux réseaux et autoriser TCP 3306 du moteur vers la base</strong>. L’outil le rappelle et le script web teste ce flux avant l’application.',
            'On joue ② <strong>avant</strong> ③ : le script web teste la connexion à la base à la fin, et dit précisément ce qui manque sinon.',
            'Un script se lance <strong>depuis un fichier</strong>, jamais collé ligne à ligne dans le terminal (il définirait juste une fonction et le dirait). Le bouton <strong>🖥️ Pour la console</strong> copie une version qui s’enregistre dans <code>/root</code> et se lance toute seule : on la colle dans la console de la VM (ou une session SSH), et c’est tout. Sinon : <code>💾 .sh</code>, transfert, puis <code>sudo bash /root/bdd.sh</code>, et ensuite <code>sudo bash /root/web.sh</code>. En <strong>SSH</strong>, le changement d’adresse couperait la session : le script le détecte, continue en arrière-plan et journalise dans <code>/var/log/config-vm.log</code> ; on se reconnecte sur la nouvelle adresse et on suit avec <code>tail -f</code>.',
            'Variables acceptées : <code>SANS_RESEAU=1 sudo bash …</code> pour ne pas toucher au réseau (VM déjà adressée), <code>IFACE=ens33</code> pour forcer la carte. Les scripts se rejouent sans dommage.',
            'Chaque clone reçoit un <strong>machine-id</strong> et des <strong>clés SSH</strong> neufs : deux clones identiques sur ce point posent des problèmes de DHCP et d’avertissements SSH.'),
    note('yellow', '⚠️ Convention de labo, pas de production',
         'Un seul mot de passe partout, connu de tous, c’est ce qui permet à une promotion de se '
         'dépanner mutuellement — et exactement ce qu’on ne fait pas en entreprise : voir '
         '<a href="/pages/zero-trust-iam">Zero trust, PSSI et IAM</a>. Ce que le montage fait '
         'correctement malgré tout : l’utilisateur MariaDB n’est accepté que depuis l’adresse du '
         'moteur, les identifiants sont dans un fichier d’environnement lisible par le service seul, '
         'et Node n’écoute que sur <code>127.0.0.1</code> derrière nginx.'),

    '<h2>Comment le moteur trouve la base</h2>',
    steps('Le script ② crée l’utilisateur <code>appuser@&lt;IP du web&gt;</code> : MariaDB n’accepte cette identité <em>que</em> depuis cette adresse, et n’écoute sur le réseau que parce que <code>bind-address</code> a été ouvert.',
          'Le script ③ écrit <code>/srv/app/.env</code> avec <code>DB_HOST</code>, <code>DB_USER</code>, <code>DB_PASS</code> — la même adresse et le même compte. Le service systemd charge ce fichier (<code>EnvironmentFile=</code>) ; l’application le lit dans <code>process.env</code>.',
          'Au démarrage, l’application ouvre un <em>pool</em> de connexions <code>mysql2</code> ; chaque visite de <code>/</code> ou de <code>/api/sante</code> exécute <code>SELECT NOW()</code> et lit la table <code>messages</code>.',
          'La page affiche deux cartes : <strong>Affichage</strong> (nginx → Node répondent) et <strong>Connexion à la base</strong>, verte avec l’heure de MariaDB et les lignes de test, rouge avec le code d’erreur sinon.'),

    '<h2>Quand la page est rouge</h2>',
    tab(['Erreur affichée', 'Cause', 'Vérification'], [
        ['<code>ETIMEDOUT</code>, <code>EHOSTUNREACH</code>', 'La VM base n’est pas joignable : éteinte, mauvaise IP, ou — dans deux réseaux — routage absent / règle de pare-feu manquante entre les deux', '<code>ping</code> depuis la VM web ; <code>ip route</code> (la passerelle est-elle là ?) ; sur OPNsense, une règle qui laisse passer TCP 3306 du réseau web vers l’IP de la base'],
        ['<code>ECONNREFUSED</code>', 'MariaDB n’écoute pas sur le réseau', '<code>ss -tlnp | grep 3306</code> sur la base : <code>127.0.0.1:3306</code> = bind-address non modifié'],
        ['<code>ER_HOST_NOT_PRIVILEGED</code>, <code>ER_ACCESS_DENIED_ERROR</code>', 'L’utilisateur n’est pas autorisé depuis cette adresse : l’IP du web a changé, ou ② a été généré avec une autre valeur', '<code>SELECT User, Host FROM mysql.user</code> sur la base ; regénérer et rejouer ②'],
        ['<code>ER_BAD_DB_ERROR</code>', 'La base n’existe pas', '<code>SHOW DATABASES</code> ; ② a-t-il été joué ?'],
        ['Page 502 de nginx', 'Node ne tourne pas', '<code>systemctl status app</code>, <code>journalctl -u app -n 30</code> (souvent : <code>npm install</code> sans Internet)'],
        ['« deb.debian.org injoignable »', 'Le script s’est arrêté avant d’installer : pas de sortie Internet', 'Passerelle, DNS, commutateur ; <code>ping 1.1.1.1</code> puis <code>ping deb.debian.org</code>'],
    ]),

    note('green', '🔗 Les cours qui expliquent ce qu’il génère',
         '<a href="/pages/linux-reseau">Configuration réseau Debian</a> · '
         '<a href="/pages/linux-systemd">systemd</a> · '
         '<a href="/pages/linux-apache">Héberger un site sous Linux</a> · '
         '<a href="/pages/sauvegarde-bases-donnees">Sauvegarder une base de données</a> · '
         '<a href="/pages/virtualisation">Hyper-V</a> · <a href="/pages/proxmox-multi-hotes">Proxmox</a> · '
         '<a href="/pages/configurateur-vm">Configurateur VM serveur (Windows)</a>.'),
])

EXTRAIT = ('Génère les scripts pour cloner deux VM Debian depuis un master (Hyper-V ou Proxmox), l’une nginx + Node.js, '
           'l’autre MariaDB, en IP fixe, reliées automatiquement, avec une page de test de l’affichage et de la connexion à la base.')

CARTE = ('<a class="script-card" href="/pages/configurateur-web-bdd"><div class="sc-top"><span class="sc-ico">🐧</span>'
         '<span class="sc-badge sc-badge-int">⚡ Interactif</span></div><div class="sc-title">Configurateur — duo web + base</div>'
         '<div class="sc-desc meta">Outil interactif : clone deux VM Debian depuis un master (Hyper-V / Proxmox), nginx + Node.js '
         'd’un côté, MariaDB de l’autre, IP fixes, liaison automatique et page de test — trois scripts prêts à copier.</div>'
         '<div class="sc-tags"><span class="sc-pill">Bash</span><span class="sc-pill">PowerShell</span><span class="sc-pill">Debian</span>'
         '<span class="sc-pill">Clone</span></div></a>')


def ranger_outil(c):
    """La carte dans la section « Hyper-V & VM » du hub Outils, et les compteurs."""
    ct = c.execute("SELECT content FROM pages WHERE slug='scripts'").fetchone()[0]
    if SLUG in ct:
        return 'déjà présent'
    i = ct.index('id="sec-virtualisation"')
    j = ct.index('</div></section>', i)
    ct = ct[:j] + CARTE + ct[j:]
    # compteur de la section, pastille du sommaire, total en tête
    sec = ct[i:ct.index('</section>', i)]
    n = sec.count('<a class="script-card"')
    ct = ct[:i] + re.sub(r'<span class="sc-count">\d+</span>', f'<span class="sc-count">{n}</span>', sec, count=1) + ct[i + len(sec):]
    ct = re.sub(r'(<a class="sc-chip" href="#sec-virtualisation">.*?<span class="sc-n">)\d+(</span>)', lambda m: m.group(1) + str(n) + m.group(2), ct, count=1, flags=re.S)
    total = ct.count('<a class="script-card"') + ct.count('class="sc-feat"')   # les outils phares ne sont pas des cartes
    ct = re.sub(r'<p class="meta">\d+ outils\.', f'<p class="meta">{total} outils.', ct, count=1)
    c.execute("UPDATE pages SET content=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug='scripts'", (ct,))
    return f'carte ajoutée (section {n}, total {total})'


if __name__ == '__main__':
    c = sqlite3.connect(BASE)
    print(SLUG, ':', publier(c, SLUG, TITRE, EXTRAIT, CONTENU))
    print('outils :', ranger_outil(c).encode('ascii', 'replace').decode())
    c.commit()
    c.close()
    sys.exit(0)

# -*- coding: utf-8 -*-
"""
Page « Réalisation 1 Linux — Correction / pas à pas » : la solution complète de
la Réalisation Linux 1 (contexte Engineer Aero), point de contrôle par point de
contrôle (captures 1 à 20). Même langage visuel que la correction Windows
(step-banner / step-rail / proc-cmd / pb-note), rangée dans la section
« Corrections de réalisations » de l'index des procédures.

S'appuie sur les configurateurs et cours du site (utilisateurs, BIND9, SSH,
droits) pour la profondeur, et donne inline ce que l'énoncé demande vraiment.

IDEMPOTENT : republie la page, ne duplique pas sa carte, recalcule les compteurs.
"""
import re
import sqlite3
import sys

from _cours import BASE, publier

SLUG = 'correction-realisation-1-linux'
TITRE = 'Réalisation 1 Linux — Correction'

STYLE = ('<style>'
         ".proc-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);"
         "border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;"
         "white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}"
         ".step-banner{display:flex;align-items:center;gap:14px;margin:32px 0 12px;padding:13px 16px;"
         "border:1px solid var(--border);border-left-width:6px;border-radius:12px;background:var(--surface-2)}"
         ".step-banner .step-num{flex:0 0 auto;width:36px;height:36px;border-radius:10px;display:grid;"
         "place-items:center;font-weight:700;color:#fff;font-size:16px;line-height:1}"
         ".step-banner .step-tt{display:flex;flex-direction:column;gap:2px;min-width:0}"
         ".step-banner h3{margin:0;font-size:17px;line-height:1.25}"
         ".step-banner .step-sub{font-size:12.5px;color:var(--text-muted);font-weight:400}"
         ".step-rail{border-left:4px solid var(--border);padding:2px 0 2px 16px;margin:0 0 10px 4px}"
         ".step-rail>*:first-child{margin-top:6px}"
         ".cap{display:inline-block;font-size:11px;font-weight:700;color:#fff;background:#6366f1;"
         "border-radius:6px;padding:1px 8px;margin:2px 4px 2px 0;font-family:ui-monospace,monospace}"
         ".rt{border-collapse:collapse;width:100%;margin:8px 0;font-size:12.5px}"
         ".rt td,.rt th{border:1px solid var(--border);padding:6px 9px;text-align:left;vertical-align:top}"
         ".rt th{background:var(--surface-2);color:var(--text-muted)}"
         "</style>")


def cmd(t):
    return f'<div class="proc-cmd">{t}</div>'


def note(couleur, titre, *paras):
    return (f'<aside class="pb-note pb-note-{couleur}"><p class="pb-note-title">{titre}</p>'
            + ''.join(f'<p>{p}</p>' for p in paras) + '</aside>')


def cap(*noms):
    return ''.join(f'<span class="cap">📷 {n}</span>' for n in noms)


def tab(entetes, lignes):
    th = ''.join(f'<th>{h}</th>' for h in entetes)
    tr = ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in l) + '</tr>' for l in lignes)
    return f'<table class="rt"><tr>{th}</tr>{tr}</table>'


def etape(num, couleur, titre, sous, corps):
    return (f'<div class="step-banner" style="border-left-color:{couleur}">'
            f'<span class="step-num" style="background:{couleur}">{num}</span>'
            f'<span class="step-tt"><h3>{titre}</h3><span class="step-sub">{sous}</span></span></div>'
            f'<div class="step-rail" style="border-left-color:{couleur}">{corps}</div>')


BLEU, VERT, AMBRE, VIOLET, ROUGE, TEAL, ROSE = '#3b82f6', '#16a34a', '#d97706', '#7c3aed', '#dc2626', '#0d9488', '#db2777'

CORPS = '\n'.join([
    '<section class="hero"><span class="pill">Correction · Réalisation Linux</span>'
    '<h1>Réalisation 1 Linux — Correction</h1>'
    '<p>La solution complète, point de contrôle par point de contrôle (contexte Engineer Aero) — '
    'pour la refaire proprement, capture par capture.</p></section>',
    STYLE,

    note('blue', '🎯 Comment lire cette page',
         'Chaque étape reprend une consigne de l’énoncé, la commande attendue, et le nom exact de la '
         '<strong>capture</strong> à enregistrer (badge <span class="cap">📷 …</span>). Les blocs de '
         'commandes sont prêts à copier — <strong>remplace <code>PRENOM</code> et <code>NOM</code> '
         'par les tiens</strong>. Trois outils du site font le gros du travail et t’évitent les fautes '
         'de frappe : les configurateurs '
         '<a href="/pages/configurateur-utilisateurs">utilisateurs &amp; droits</a>, '
         '<a href="/pages/configurateur-bind9">BIND9</a> et '
         '<a href="/pages/configurateur-debian-reseau">adressage Debian</a>.'),
    note('red', '⚠️ Deux pièges de l’énoncé à régler d’emblée',
         '<strong>Le domaine.</strong> L’énoncé écrit <code>engineer-aero-nom.lan</code> pour le '
         'domaine mais <code>db.engineer-aero-prenom.lan</code> pour le fichier — incohérent. Le '
         'fichier de zone <strong>doit porter le nom du domaine</strong> : choisis-en un seul (ici '
         '<code>engineer-aero-NOM.lan</code>) et tiens-t’y partout.',
         '<strong>Deux réseaux successifs.</strong> Tu travailles d’abord sur ton réseau '
         '<strong>172.x</strong> (avec Internet : mises à jour, forwarders DNS, ping Google), puis tu '
         'bascules à la fin sur un réseau <strong>privé 170.12.0.192/26</strong>, serveur '
         '<code>170.12.0.250</code>. Fais les tests Internet <em>avant</em> la bascule (étape 11), et '
         'régénère l’adresse + la zone DNS <em>après</em> (étape 12).'),

    etape(1, BLEU, 'Le poste client Windows', 'Une VM Windows 7 ou 10 nommée « Client »',
          '<p>Crée la VM Windows, renomme-la <strong>Client</strong> '
          '(<span class="proc-cmd" style="display:inline;padding:1px 7px">Paramètres › Système › '
          'Informations › Renommer ce PC</span>), redémarre.</p>' + cap('1 - Nom poste Windows')),

    etape(2, VERT, 'Installer et nommer le serveur Debian', 'hostname, domaine, utilisateur',
          '<p>Installe Debian. Nom de machine <code>srvlinuxPRENOM</code>, utilisateur '
          '<code>PRENOM</code>. Le domaine <code>engineer-aero-NOM.lan</code> ne « s’installe » pas '
          'ici : il est porté par le DNS (étape 10) et par <code>/etc/hosts</code> pour que '
          '<code>hostname -f</code> réponde le bon FQDN (étape 4).</p>'
          + cmd('sudo hostnamectl set-hostname srvlinuxPRENOM')
          + '<p>Ajoute ton utilisateur au groupe <code>sudo</code> s’il n’y est pas '
          '(un mot de passe root défini à l’installation ne donne pas sudo automatiquement) :</p>'
          + cmd('su -\napt install sudo -y\nusermod -aG sudo PRENOM\nexit    # puis se déconnecter / reconnecter')),

    etape(3, VIOLET, 'Prompts colorés', 'Utilisateur en vert, root en rouge',
          '<p>Le prompt est défini par la variable <code>PS1</code> dans le <code>.bashrc</code> de '
          'chaque compte. <strong>Utilisateur</strong> (<code>~/.bashrc</code>) — ajoute à la fin :</p>'
          + cmd("PS1='\\[\\e[1;32m\\]\\u@\\h:\\w\\$\\[\\e[0m\\] '")
          + '<p><strong>Root</strong> (<code>/root/.bashrc</code>, donc <code>sudo nano '
          '/root/.bashrc</code>) :</p>'
          + cmd("PS1='\\[\\e[1;31m\\]\\u@\\h:\\w\\#\\[\\e[0m\\] '")
          + '<p>Puis <code>source ~/.bashrc</code> (et <code>su -</code> pour voir le prompt root). '
          '<code>32</code> = vert, <code>31</code> = rouge ; <code>1;</code> = gras.</p>'
          + cap('2 - Prompt utilisateur vert', '3 - Prompt root rouge')),

    etape(4, VERT, 'Le nom complet (FQDN)', 'hostname -f = srvlinuxPRENOM.engineer-aero-NOM.lan',
          '<p><code>hostname -f</code> lit <code>/etc/hosts</code> : il faut une ligne qui associe '
          'l’adresse du serveur à son FQDN <em>puis</em> son nom court.</p>'
          + cmd('sudo nano /etc/hosts\n# ajouter (avec l\'adresse du serveur) :\n170.12.0.250   srvlinuxPRENOM.engineer-aero-NOM.lan srvlinuxPRENOM\n\nhostname -f    # -> srvlinuxPRENOM.engineer-aero-NOM.lan')
          + note('gray', '💡 Pourquoi le FQDN vient de /etc/hosts',
                 'L’ordre sur la ligne compte : le <strong>nom complet en premier</strong>, le nom '
                 'court ensuite. Si tu inverses, <code>hostname -f</code> renverra le nom court.')
          + cap('4 - Nom FQDN')),

    etape(5, AMBRE, 'Miroirs et mise à jour', 'sources.list puis apt update && upgrade',
          '<p>Montre le fichier des miroirs, puis mets à jour.</p>'
          + cmd('cat /etc/apt/sources.list')
          + '<p>Pour Debian 12 (<em>bookworm</em>) il ressemble à ceci — adapte à ta version '
          '(<em>trixie</em> = 13) :</p>'
          + cmd('deb http://deb.debian.org/debian bookworm main\ndeb http://deb.debian.org/debian bookworm-updates main\ndeb http://security.debian.org/debian-security bookworm-security main')
          + cmd('sudo apt update && sudo apt upgrade -y')
          + cap('5 - Miroir sources list', '6 - Update')),

    etape(6, BLEU, 'IP fixe (réseau 172, avec Internet)', 'address/gateway/dns dans interfaces, puis ip a',
          '<p>Passe le serveur en adresse fixe <strong>sur ta plage 172, connectée à Internet</strong> '
          '(pour les mises à jour et, plus tard, les forwarders DNS et le ping Google). Le '
          '<a href="/pages/configurateur-debian-reseau">configurateur d’adressage Debian</a> écrit ce '
          'fichier et vérifie ce que la syntaxe ne dit pas (passerelle hors sous-réseau, etc.).</p>'
          + cmd('sudo nano /etc/network/interfaces\n\nauto eth0\niface eth0 inet static\n    address 172.16.10.250/24        # une adresse libre de TA plage\n    gateway 172.16.10.254          # ta passerelle vers Internet\n    dns-nameservers 8.8.8.8\n\nsudo systemctl restart networking\nip a')
          + note('yellow', '⚠️ Nom de la carte',
                 'La carte peut s’appeler <code>eth0</code>, <code>ens33</code>, <code>enp0s3</code>… '
                 'Vérifie avec <code>ip a</code> et mets le bon nom.')
          + cap('7 - Configuration réseau', '8 - Ip a 172')),

    etape(7, TEAL, 'SSH par clé (asymétrique)', 'ssh-keygen + clé publique sur le serveur',
          '<p>Depuis <strong>ta machine cliente</strong> (le poste, ou le Windows avec MobaXterm), '
          'génère une paire de clés et dépose la <strong>clé publique</strong> sur le serveur, pour '
          'te connecter sans mot de passe. Détail : '
          '<a href="/pages/procedure-cle-ssh">Générer et installer une clé SSH</a>, '
          '<a href="/pages/linux-ssh">SSH serveur sous Linux</a>.</p>'
          + cmd('# sur le CLIENT :\nssh-keygen -t ed25519\nssh-copy-id PRENOM@172.16.10.250      # depose la cle publique\nssh PRENOM@172.16.10.250              # doit entrer SANS mot de passe')
          + note('gray', '🔑 Sous Windows / MobaXterm sans ssh-copy-id',
                 'Génère la paire (MobaKeyGen ou <code>ssh-keygen</code>), puis copie le contenu de la '
                 'clé publique dans <code>~/.ssh/authorized_keys</code> du serveur '
                 '(<code>chmod 700 ~/.ssh ; chmod 600 ~/.ssh/authorized_keys</code>, sinon SSH refuse '
                 'la clé).')
          + cap('9 - SSH asymétrique')),

    etape(8, ROSE, 'Utilisateurs et groupes', '10 utilisateurs, 6 groupes, les bonnes appartenances',
          '<p>C’est exactement ce que génère le '
          '<a href="/pages/configurateur-utilisateurs">configurateur utilisateurs &amp; droits</a> '
          '(déjà pré-rempli avec ces dix comptes et six groupes). Il produit un script rejouable. '
          'Le principe :</p>'
          + cmd('# groupes\nfor g in administration direction technique maquettiste dessinateur ingenieur; do sudo groupadd -f $g; done\n\n# un utilisateur (avec /home) + mot de passe + groupes secondaires\nsudo useradd -m -s /bin/bash jack\necho "jack:MotDePasse" | sudo chpasswd\nsudo usermod -aG administration,direction,technique jack\n# ... idem vala, samantha, daniel, tealc, aiden, teyla, john, rodney, eliza')
          + tab(['Groupe', 'Membres'], [
              ['administration', 'jack, vala, samantha'],
              ['direction', 'jack, vala'],
              ['technique', 'jack, daniel, tealc, aiden, teyla, john, rodney, eliza'],
              ['maquettiste', 'aiden, teyla'],
              ['dessinateur', 'tealc'],
              ['ingenieur', 'john, rodney, eliza'],
          ])
          + '<p>Captures : la fin de <code>/etc/passwd</code>, <code>tree /home</code>, et la fin de '
          '<code>/etc/group</code> (<code>getent group</code>).</p>'
          + cap('10 - Users passwd', '11 - Tree home', '12 - Groups')),

    etape(9, ROSE, 'Arborescence de partage et droits', 'mkdir, chown, chmod récursif (+ SGID)',
          '<p>Monte <code>/home/partage</code> et ses sous-dossiers, puis pose les droits '
          '<strong>propriétaire / groupe / autres</strong> — récursivement, pour qu’ils s’appliquent '
          'au contenu (c’est explicitement demandé). Le '
          '<a href="/pages/configurateur-utilisateurs">configurateur</a> le fait ; à la main :</p>'
          + cmd('sudo mkdir -p /home/partage/direction /home/partage/technique\nsudo chown -R root:direction /home/partage/direction\nsudo chmod -R 2770 /home/partage/direction     # 2 = SGID : les fichiers heritent du groupe')
          + note('gray', '💡 Le <strong>2</strong> devant le mode (SGID)',
                 'Sur un dossier d’équipe, <code>2770</code> fait que tout fichier créé dedans '
                 'appartient au <strong>groupe du dossier</strong>, pas au groupe personnel de son '
                 'créateur — sinon les collègues ne peuvent pas le modifier. Voir '
                 '<a href="/pages/durcissement-linux">les permissions spéciales</a>.')
          + '<p>Puis le fichier des droits à livrer :</p>'
          + cmd('cd /home\nsudo ls -lR > droits.txt      # a mettre dans l\'archive')
          + cap('13 - Tree partage')),

    etape(10, VERT, 'Le serveur DNS (BIND9)', 'options + local + zone directe + zone inverse, vérifiées',
          '<p>Installe BIND9 et écris les quatre fichiers demandés. Le '
          '<a href="/pages/configurateur-bind9">configurateur BIND9</a> les génère cohérents '
          '(domaine <code>engineer-aero-NOM.lan</code>, serveur <code>170.12.0.250</code>, zone '
          'inverse déduite). Théorie : TP '
          '<a href="/pages/tp-dns-bind9-directe">zone directe</a> et '
          '<a href="/pages/tp-dns-bind9-inverse">zone inverse</a>.</p>'
          + cmd('sudo apt install bind9 bind9-utils dnsutils -y')
          + '<p>Les quatre fichiers (<code>/etc/bind/</code>) : <code>named.conf.options</code> '
          '(forwarders <code>8.8.8.8</code>, <code>allow-query</code>, <code>recursion yes</code>), '
          '<code>named.conf.local</code> (les deux zones en <em>master</em>), '
          '<code>db.engineer-aero-NOM.lan</code> (SOA, NS, A) et la zone inverse '
          '<code>db.0.12.170.in-addr.arpa</code> (SOA, NS, PTR).</p>'
          + '<p>Les vérifications — c’est <strong>ça</strong>, la capture 14 :</p>'
          + cmd('sudo named-checkconf\nsudo named-checkzone engineer-aero-NOM.lan /etc/bind/db.engineer-aero-NOM.lan\nsudo named-checkzone 0.12.170.in-addr.arpa /etc/bind/db.0.12.170.in-addr.arpa\nsudo systemctl restart named       # (ou bind9)\ndig @localhost srvlinuxPRENOM.engineer-aero-NOM.lan +short\ndig @localhost -x 170.12.0.250 +short')
          + note('yellow', '⚠️ Si tu configures le DNS pendant la phase 172',
                 'Mets l’adresse 172 du serveur dans l’enregistrement A et la zone inverse pour tester '
                 'le ping Google (étape 11). À la bascule (étape 12), remets <code>170.12.0.250</code>, '
                 'régénère la zone inverse en <code>0.12.170.in-addr.arpa</code> et '
                 '<strong>incrémente le numéro de série</strong> du SOA — sinon rien ne se met à jour.')
          + cap('14 - Vérifications DNS')),

    etape(11, BLEU, 'Le client Windows utilise le DNS', 'IP fixe, DNS = serveur, ipconfig, pings',
          '<p>Sur le Windows <strong>Client</strong>, mets une IP fixe du même réseau et surtout '
          '<strong>DNS = l’adresse du serveur</strong> '
          '(<a href="/pages/procedure-ip-fixe-windows">procédure IP fixe Windows</a>). Puis :</p>'
          + cmd('ipconfig /all')
          + cmd('ping 8.8.8.8\nping www.google.fr')
          + note('gray', '🌍 Pourquoi Google répond',
                 'Le <code>ping 8.8.8.8</code> teste la route Internet ; <code>www.google.fr</code> '
                 'teste la <strong>résolution</strong> : ton serveur DNS ne connaît pas Google, il '
                 'transmet la question à ses <strong>forwarders</strong> (8.8.8.8). Cela suppose '
                 'qu’Internet est là — donc pendant la phase 172, avant la bascule.')
          + cap('15 - Ipconfig', '16 - Pings Google')),

    etape(12, AMBRE, 'Bascule en réseau privé 170.12.0.192/26', 'commutateur privé, serveur en .250',
          '<p>Passe la VM sur un <strong>commutateur privé</strong> Hyper-V (réseau '
          '<code>170.12.0.192/26</code>), et donne au serveur <code>170.12.0.250/26</code>. Le /26 '
          'va de <code>.192</code> à <code>.255</code> (utilisables <code>.193</code>–<code>.254</code>). '
          'Réseau privé = plus d’Internet : la passerelle n’a plus de sens, le DNS du serveur pointe '
          'sur lui-même.</p>'
          + cmd('sudo nano /etc/network/interfaces\n\nauto eth0\niface eth0 inet static\n    address 170.12.0.250/26\n    dns-nameservers 127.0.0.1\n\nsudo systemctl restart networking\nip a')
          + note('red', '⚠️ Mets le DNS à jour après la bascule',
                 'Change l’adresse du serveur dans <code>/etc/hosts</code>, l’enregistrement A '
                 '(<code>170.12.0.250</code>), et la <strong>zone inverse</strong> '
                 '(<code>0.12.170.in-addr.arpa</code>, PTR <code>250</code>), puis '
                 '<strong>incrémente le serial</strong> et <code>sudo systemctl restart named</code>.')
          + cap('17 - Réseau HyperV', '18 - Ip a 170')),

    etape(13, TEAL, 'Archiver /home', 'tar.gz dans /tmp, puis vérifier le contenu',
          '<p>Fais une archive compressée de tout <code>/home</code>, dans <code>/tmp</code>, nommée '
          '<code>home_user.tar.gz</code>. Voir '
          '<a href="/pages/linux-archivage">Linux : archivage et compression</a>.</p>'
          + cmd('sudo tar czf /tmp/home_user.tar.gz /home\ntar tzf /tmp/home_user.tar.gz     # lister le contenu, sans extraire')
          + note('gray', '🗜️ Les options',
                 '<code>c</code> = créer, <code>z</code> = gzip, <code>f</code> = fichier ; '
                 '<code>t</code> = lister (<em>t</em>able). <code>tar</code> prévient « suppression du '
                 '/ initial » — c’est normal, il stocke les chemins en relatif.')
          + cap('19 – Archive tar.gz', '20 – Contenu Archive')),

    etape(14, ROUGE, 'Le rendu', 'captures + fichiers → zip → mail',
          '<p>Relis la partie <em>Consignes</em> de l’énoncé. Réunis dans un dossier :</p>'
          + '<ul class="proc-steps"><li>toutes les captures <span class="cap">📷 1</span> à '
          '<span class="cap">📷 20</span> ;</li>'
          '<li>les fichiers : <code>droits.txt</code>, <code>named.conf.options</code>, '
          '<code>named.conf.local</code>, <code>db.engineer-aero-NOM.lan</code> et la zone inverse '
          '(récupérés par SSH / SFTP) ;</li>'
          '<li>ce document Word <strong>annoté dans une autre couleur</strong> partout où tu t’es '
          'aidé d’un cours ou d’Internet (cette page compte : cite-la), renommé '
          '<code>Réalisation Linux 1 - TSSR - Prénom Nom</code>.</li></ul>'
          + '<p>Compresse le tout en <code>.zip</code> nommé <code>Prénom Nom.zip</code>, objet du '
          'mail <code>prénom nom - Réalisation Linux 1</code>.</p>'
          + note('green', '✅ Avant d’envoyer',
                 'Vérifie que tu as bien <strong>les 20 captures</strong> et <strong>les 5 fichiers</strong>. '
                 'Un oubli de capture ou un fichier de zone qui ne correspond pas à l’adresse finale '
                 '(<code>170.12.0.250</code>) sont les pertes de points les plus fréquentes.')),

    note('gray', '🔗 Les outils et cours mobilisés',
         '<a href="/pages/configurateur-utilisateurs">Configurateur utilisateurs &amp; droits</a> · '
         '<a href="/pages/configurateur-bind9">Configurateur BIND9</a> · '
         '<a href="/pages/configurateur-debian-reseau">Configurateur adressage Debian</a> · '
         '<a href="/pages/linux-droits">Utilisateurs, droits &amp; sudo</a> · '
         '<a href="/pages/linux-ssh">SSH sous Linux</a> · '
         '<a href="/pages/tp-dns-bind9-directe">TP BIND9</a> · '
         '<a href="/pages/linux-archivage">Archivage</a> · '
         '<a href="/pages/durcissement-linux">Durcissement (permissions spéciales)</a>.'),
])

EXTRAIT = ('La solution complète de la Réalisation Linux 1 (Engineer Aero), capture par capture : '
           'installation Debian, prompts colorés, FQDN, miroirs, IP fixe, SSH par clé, utilisateurs '
           'et groupes, arborescence et droits, DNS BIND9, client Windows, bascule réseau privé, '
           'archive tar.gz et rendu.')

CARTE = ('<a class="dir-card" href="/pages/correction-realisation-1-linux"><div class="dc-ico">🐧</div>'
         '<div class="dc-body"><div class="dc-title">Réalisation 1 Linux — Correction</div>'
         '<div class="dc-desc meta">Solution pas-à-pas (contexte Engineer Aero) : Debian, prompts '
         'colorés, FQDN, miroirs &amp; update, IP fixe, SSH par clé, utilisateurs/groupes, '
         'arborescence &amp; droits (SGID), DNS BIND9, client Windows, bascule réseau privé, archive '
         'tar.gz — capture par capture.</div>'
         '<div><span style="display:inline-block;font-size:10.5px;font-weight:600;color:var(--text-muted);'
         'background:var(--surface-3);border:1px solid var(--border);border-radius:999px;padding:1px 9px;'
         'margin:4px 4px 0 0">Correction</span>'
         '<span style="display:inline-block;font-size:10.5px;font-weight:600;color:var(--text-muted);'
         'background:var(--surface-3);border:1px solid var(--border);border-radius:999px;padding:1px 9px;'
         'margin:4px 4px 0 0">Linux</span></div></div><div class="dc-go">Voir →</div></a>')


def ranger(c):
    h = c.execute("SELECT content FROM pages WHERE slug='procedures'").fetchone()[0]
    if SLUG not in h:
        m = re.search(r'<section class="pd-sec" id="sec-correction">.*?</section>', h, re.S)
        bloc = m.group(0)
        fin = bloc.rindex('</div></section>')
        bloc = bloc[:fin] + CARTE + bloc[fin:]
        h = h[:m.start()] + bloc + h[m.end():]
    # recompter
    comptes = {}
    for m in re.finditer(r'<section class="pd-sec" id="(sec-[^"]+)">(.*?)</section>', h, re.S):
        comptes[m.group(1)] = len(re.findall(r'<a class="dir-card"', m.group(2)))
    h = re.sub(r'<section class="pd-sec" id="(sec-[^"]+)">.*?</section>',
               lambda m: re.sub(r'(<span class="pd-count">)\d+(</span>)',
                                lambda t: t.group(1) + str(comptes[m.group(1)]) + t.group(2), m.group(0), count=1),
               h, flags=re.S)
    h = re.sub(r'<a class="pd-chip" href="#(sec-[^"]+)">.*?</a>',
               lambda m: re.sub(r'(<span class="pd-n">)\d+(</span>)',
                                lambda t: t.group(1) + str(comptes.get(m.group(1), 0)) + t.group(2), m.group(0), count=1),
               h, flags=re.S)
    total = sum(comptes.values())
    h = re.sub(r'>\d+ procédures,', f'>{total} procédures,', h, count=1)
    c.execute("UPDATE pages SET content=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug='procedures'", (h,))
    return f'index : sec-correction={comptes.get("sec-correction")} ; total {total}'


if __name__ == '__main__':
    c = sqlite3.connect(BASE)
    print(SLUG, ':', publier(c, SLUG, TITRE, EXTRAIT, CORPS))
    print(ranger(c).encode('ascii', 'replace').decode())
    c.commit()
    c.close()
    sys.exit(0)

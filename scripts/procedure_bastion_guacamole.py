# -*- coding: utf-8 -*-
"""
Page « Bastion Apache Guacamole — la procédure » : déployer un bastion
d'administration HTML5 (SSH/RDP/VNC dans le navigateur) sur une VM Debian, en
Docker, avec la pile officielle (guacd + guacamole + PostgreSQL), configurer les
connexions, puis durcir (HTTPS, MFA TOTP, pare-feu). Style step-banner comme les
autres procédures. Rangée dans Procédures › Linux & Debian.

IDEMPOTENT.
"""
import re
import sqlite3
import sys

from _cours import BASE, publier

SLUG = 'procedure-bastion-guacamole'
TITRE = 'Bastion Apache Guacamole (HTML5) — la procédure'

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
         ".rt{border-collapse:collapse;width:100%;margin:8px 0;font-size:12.5px}"
         ".rt td,.rt th{border:1px solid var(--border);padding:6px 9px;text-align:left;vertical-align:top}"
         ".rt th{background:var(--surface-2);color:var(--text-muted)}"
         "</style>")


def cmd(t):
    return f'<div class="proc-cmd">{t}</div>'


def note(couleur, titre, *paras):
    return (f'<aside class="pb-note pb-note-{couleur}"><p class="pb-note-title">{titre}</p>'
            + ''.join(f'<p>{p}</p>' for p in paras) + '</aside>')


def tab(entetes, lignes):
    th = ''.join(f'<th>{h}</th>' for h in entetes)
    tr = ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in l) + '</tr>' for l in lignes)
    return f'<table class="rt"><tr>{th}</tr>{tr}</table>'


def etape(num, couleur, titre, sous, corps):
    return (f'<div class="step-banner" style="border-left-color:{couleur}">'
            f'<span class="step-num" style="background:{couleur}">{num}</span>'
            f'<span class="step-tt"><h3>{titre}</h3><span class="step-sub">{sous}</span></span></div>'
            f'<div class="step-rail" style="border-left-color:{couleur}">{corps}</div>')


BLEU, VERT, AMBRE, VIOLET, ROUGE, TEAL = '#3b82f6', '#16a34a', '#d97706', '#7c3aed', '#dc2626', '#0d9488'

COMPOSE = ('services:\n'
           '  guacd:\n'
           '    image: guacamole/guacd:1.5.5\n'
           '    restart: unless-stopped\n'
           '\n'
           '  postgres:\n'
           '    image: postgres:16\n'
           '    environment:\n'
           '      POSTGRES_DB: guacamole_db\n'
           '      POSTGRES_USER: guacamole_user\n'
           '      POSTGRES_PASSWORD: Azerty77\n'
           '    volumes:\n'
           '      - ./init:/docker-entrypoint-initdb.d:ro   # le schema, joue au 1er demarrage\n'
           '      - pgdata:/var/lib/postgresql/data\n'
           '    restart: unless-stopped\n'
           '\n'
           '  guacamole:\n'
           '    image: guacamole/guacamole:1.5.5\n'
           '    depends_on: [guacd, postgres]\n'
           '    environment:\n'
           '      GUACD_HOSTNAME: guacd\n'
           '      POSTGRESQL_HOSTNAME: postgres\n'
           '      POSTGRESQL_DATABASE: guacamole_db\n'
           '      POSTGRESQL_USER: guacamole_user\n'
           '      POSTGRESQL_PASSWORD: Azerty77\n'
           '    ports:\n'
           '      - "8080:8080"\n'
           '    restart: unless-stopped\n'
           '\n'
           'volumes:\n'
           '  pgdata:')

CORPS = '\n'.join([
    '<section class="hero"><span class="pill">Procédure · Linux · Sécurité</span>'
    '<h1>Monter un bastion Apache Guacamole (HTML5)</h1>'
    '<p>Une passerelle d’administration <strong>sans client lourd</strong> : SSH, RDP et VNC dans le '
    'navigateur, derrière un seul point d’entrée tracé — déployée en Docker sur une VM Debian.</p>'
    '</section>',
    STYLE,

    note('blue', '🎯 Ce qu’est Guacamole, et à quoi il sert',
         'Apache Guacamole est une <strong>passerelle d’accès distant HTML5</strong> : le technicien '
         'ouvre une page web et se retrouve sur le SSH d’un serveur ou le bureau RDP d’un poste, '
         '<em>sans rien installer</em>. Comme bastion, il centralise l’administration : un seul '
         'portail à exposer, durcir et journaliser, au lieu d’ouvrir le port 22 ou 3389 de chaque '
         'machine. C’est la brique déployée en fin de <a href="/pages/tp-opnsense-dmz">TP 1.4 (DMZ)</a>. '
         'Autre approche du même besoin — un vrai rebond SSH (ProxyJump) — l’outil '
         '<a href="/pages/configurateur-bastion">configurateur bastion SSH</a>.'),
    note('gray', '🧩 Trois composants, pas un',
         'Guacamole n’est pas un binaire unique : <strong>guacd</strong> (le démon qui parle SSH/RDP/VNC '
         'aux machines cibles), <strong>l’application web</strong> Guacamole (Tomcat, l’interface), et '
         'une <strong>base de données</strong> (PostgreSQL) qui stocke utilisateurs, connexions et '
         'permissions. Docker Compose les orchestre ensemble.'),

    etape(1, BLEU, 'La VM et Docker', 'Debian, dans la zone d’administration ou la DMZ',
          '<p>Une VM <strong>Debian 12/13</strong> (2 vCPU, 2 Go), adresse fixe, placée là où elle voit '
          'les machines à administrer (zone d’admin, ou la DMZ comme au TP 1.4). Installer Docker :</p>'
          + cmd('sudo apt update && sudo apt install -y curl ca-certificates\ncurl -fsSL https://get.docker.com | sudo sh\nsudo usermod -aG docker $USER      # se deconnecter / reconnecter pour la prise en compte\ndocker --version && docker compose version')
          + note('yellow', '⚠️ Docker a besoin d’Internet à l’installation',
                 'En DMZ filtrée, l’installation de Docker et le téléchargement des images demandent une '
                 '<strong>sortie temporaire</strong> vers les dépôts. À rouvrir/refermer proprement '
                 '(voir <a href="/pages/tp-opnsense-dmz">TP 1.4</a>), ou charger les images par '
                 '<code>docker save</code>/<code>docker load</code> depuis l’hôte.')),

    etape(2, VERT, 'Déployer la pile officielle', 'guacd + Guacamole + PostgreSQL',
          '<p>Dans un dossier dédié, le <code>docker-compose.yml</code> :</p>'
          + cmd('mkdir -p ~/guacamole/init && cd ~/guacamole\nnano docker-compose.yml')
          + cmd(COMPOSE)
          + '<p><strong>Générer le schéma de la base</strong> — indispensable, et <em>avant</em> le '
          'premier démarrage (PostgreSQL ne l’initialise qu’au tout premier lancement) :</p>'
          + cmd('docker run --rm guacamole/guacamole:1.5.5 /opt/guacamole/bin/initdb.sh --postgresql > init/initdb.sql\nls -l init/initdb.sql        # doit faire quelques dizaines de Ko\n\ndocker compose up -d\ndocker compose ps            # les 3 services « running »')
          + note('red', '🚨 L’ordre compte : le schéma d’abord',
                 'Si tu lances <code>docker compose up</code> <strong>avant</strong> d’avoir écrit '
                 '<code>init/initdb.sql</code>, PostgreSQL crée sa base vide et n’y reviendra plus : '
                 'Guacamole affichera « internal error » à la connexion. En cas d’oubli : '
                 '<code>docker compose down -v</code> (efface le volume) puis on recommence dans le bon '
                 'ordre.')),

    etape(3, VIOLET, 'Premier accès et mot de passe', 'http://&lt;ip&gt;:8080/guacamole/',
          '<p>Dans un navigateur : <code>http://&lt;ip-du-bastion&gt;:8080/guacamole/</code> '
          '(le <code>/guacamole/</code> final compte avec l’image officielle). Compte par défaut :</p>'
          + cmd('identifiant : guacadmin\nmot de passe : guacadmin')
          + note('red', '🚨 Changer guacadmin AVANT tout le reste',
                 'C’est le premier réflexe : en haut à droite → <em>Paramètres ▸ Préférences</em> → '
                 'changer le mot de passe de <code>guacadmin</code>, ou créer un compte admin nominatif '
                 'et désactiver <code>guacadmin</code>. Un bastion, c’est la clé de tout le parc : le '
                 'laisser en guacadmin/guacadmin revient à ne rien avoir sécurisé.')),

    etape(4, TEAL, 'Créer les connexions cibles', 'Paramètres ▸ Connexions ▸ Nouvelle connexion',
          '<p><em>Paramètres ▸ Connexions ▸ Nouvelle connexion</em>. Le protocole par défaut est VNC — '
          'le changer en <strong>SSH</strong> ou <strong>RDP</strong>. Le bastion joint ses cibles '
          '<strong>directement, sur leur port standard</strong> (22, 3389), à l’intérieur du réseau — '
          'pas par une redirection NAT.</p>'
          + tab(['Champ', 'SSH (serveur Linux)', 'RDP (poste Windows)'], [
              ['Protocole', 'SSH', 'RDP'],
              ['Nom d’hôte', '<code>192.168.20.3</code>', '<code>192.168.20.2</code>'],
              ['Port', '22', '3389'],
              ['Nom d’utilisateur / mot de passe', 'le compte du serveur', 'Administrator + mdp'],
              ['Sécurité', '—', 'Ignorer le certificat du serveur (auto-signé Windows)'],
          ])
          + note('yellow', '⚠️ SSH qui ne monte pas sur Debian 13 (piège du TP 1.4)',
                 'Debian 13 (trixie) a retiré par défaut de vieux algorithmes d’échange de clés que la '
                 'bibliothèque SSH de guacd propose encore → « le serveur distant a fermé la '
                 'connexion ». Sur la <strong>cible</strong>, réautoriser dans '
                 '<code>/etc/ssh/sshd_config</code> : <code>KexAlgorithms +diffie-hellman-group14-sha1,'
                 'diffie-hellman-group-exchange-sha256</code> puis <code>systemctl restart ssh</code>. '
                 'Et vérifier que le pare-feu de la cible ouvre le 22/3389 <strong>pour l’IP du '
                 'bastion</strong> (voir <a href="/pages/durcissement-linux">durcissement</a>).')),

    etape(5, AMBRE, 'Durcir le bastion', 'HTTPS, MFA, pare-feu — c’est un point d’entrée unique',
          '<p>Un bastion concentre les accès : mal protégé, il les compromet tous. Les quatre '
          'durcissements qui comptent :</p>'
          + tab(['Mesure', 'Pourquoi', 'Comment'], [
              ['<strong>HTTPS</strong>', 'En HTTP simple, le mot de passe guacadmin et les identifiants SSH/RDP passent en clair',
               'Un reverse-proxy (Nginx, Caddy, Traefik) devant Guacamole, avec un certificat (Let’s Encrypt ou interne) ; n’exposer que le 443'],
              ['<strong>MFA (TOTP)</strong>', 'Un seul mot de passe protège tout le parc',
               'Activer l’extension <code>auth-totp</code> de Guacamole (double authentification par code)'],
              ['<strong>Pare-feu</strong>', 'Le bastion ne doit être joignable que par les admins, et guacd jamais depuis l’extérieur',
               'N’exposer que 443 vers le réseau d’admin ; <code>guacd</code> et PostgreSQL restent internes au réseau Docker'],
              ['<strong>Journalisation</strong>', 'Savoir qui s’est connecté, quand, vers quoi',
               'Guacamole historise les sessions ; option d’<strong>enregistrement vidéo</strong> des sessions ; fail2ban sur l’hôte'],
          ])
          + note('gray', '🔐 Exposer par NAT (labo TP 1.4)',
                 'Pour l’atteindre depuis l’extérieur de la DMZ, une redirection sur le pare-feu : '
                 '<code>Firewall ▸ NAT ▸ Port Forward</code> — WAN, TCP, vers '
                 '<code>&lt;ip-bastion&gt;:8080</code> (ou 443 une fois le HTTPS en place). Le '
                 '<a href="/pages/configurateur-opnsense">configurateur OPNsense</a> / '
                 '<a href="/pages/configurateur-pfsense">pfSense</a> écrit cette règle.')),

    etape(6, VERT, 'Vérifier et exploiter', 'Se connecter, tracer',
          '<p>Depuis l’accueil de Guacamole, cliquer une connexion : la session SSH ou RDP s’ouvre '
          '<strong>dans l’onglet</strong>. À vérifier :</p>'
          + '<ul class="proc-steps">'
          '<li>la session <strong>SSH</strong> vers le serveur Linux s’ouvre et on tape des commandes ;</li>'
          '<li>la session <strong>RDP</strong> vers le poste Windows affiche le bureau ;</li>'
          '<li>l’<strong>historique</strong> (Paramètres ▸ Historique des connexions) montre qui est '
          'passé et vers quelle machine ;</li>'
          '<li>l’accès <strong>direct</strong> (SSH depuis un poste vers la cible, sans bastion) est '
          'refusé par le pare-feu de la cible — sinon le bastion ne sert à rien.</li></ul>'
          + cmd('# côté hôte, l\'état des conteneurs et les logs si un service coince :\ndocker compose ps\ndocker compose logs -f guacamole guacd')),

    note('gray', '⚡ La variante rapide (labo)',
         'Pour un montage <strong>express</strong> sans base séparée, l’image tout-en-un '
         '<code>abesnier/guacamole</code> (ou l’ancienne <code>oznu/guacamole</code>) embarque guacd et '
         'une base : un seul conteneur, port <code>8080</code>, un volume <code>./config</code>. Pratique '
         'pour un TP jetable, mais la pile officielle (guacd + Guacamole + PostgreSQL) est celle qu’on '
         'garde en production — sauvegardes, montée de version, extensions.'),
    note('green', '✅ À retenir',
         'Guacamole = une <strong>passerelle HTML5</strong> (guacd + web + base) qui met SSH/RDP/VNC '
         'dans le navigateur. Comme bastion : un seul point d’entrée, à <strong>durcir</strong> '
         '(HTTPS, MFA, pare-feu, journal) parce qu’il ouvre sur tout le parc. Les cibles n’acceptent '
         'l’administration que <strong>depuis lui</strong>. Le schéma d’init de la base se génère '
         '<em>avant</em> le premier démarrage — l’erreur n°1.'),
    note('gray', '🔗 À rapprocher',
         '<a href="/pages/tp-opnsense-dmz">TP 1.4 — DMZ, GLPI &amp; bastion</a> (Guacamole en situation) · '
         '<a href="/pages/configurateur-bastion">Configurateur bastion SSH</a> (l’autre bastion, ProxyJump) · '
         '<a href="/pages/durcissement-linux">Durcir un serveur Linux</a> · '
         '<a href="/pages/dmz">La DMZ</a>.'),
])

EXTRAIT = ('Déployer un bastion d’administration HTML5 (SSH/RDP/VNC dans le navigateur) avec Apache '
           'Guacamole en Docker sur Debian : la pile officielle guacd + Guacamole + PostgreSQL, la '
           'génération du schéma, les connexions cibles, et le durcissement (HTTPS, MFA TOTP, pare-feu).')

CARTE = ('<a class="dir-card" href="/pages/procedure-bastion-guacamole"><div class="dc-ico">🌉</div>'
         '<div class="dc-body"><div class="dc-title">Bastion Apache Guacamole (HTML5)</div>'
         '<div class="dc-desc meta">Pas à pas : déployer un bastion d’administration SSH/RDP/VNC dans '
         'le navigateur, en Docker (guacd + Guacamole + PostgreSQL), créer les connexions, et durcir '
         '(HTTPS, MFA TOTP, pare-feu).</div>'
         '<div><span style="display:inline-block;font-size:10.5px;font-weight:600;color:var(--text-muted);'
         'background:var(--surface-3);border:1px solid var(--border);border-radius:999px;padding:1px 9px;'
         'margin:4px 4px 0 0">Docker</span>'
         '<span style="display:inline-block;font-size:10.5px;font-weight:600;color:var(--text-muted);'
         'background:var(--surface-3);border:1px solid var(--border);border-radius:999px;padding:1px 9px;'
         'margin:4px 4px 0 0">Bastion</span></div></div><div class="dc-go">Voir →</div></a>')


def ranger(c):
    h = c.execute("SELECT content FROM pages WHERE slug='procedures'").fetchone()[0]
    if SLUG not in h:
        m = re.search(r'<section class="pd-sec" id="sec-linux">.*?</section>', h, re.S)
        bloc = m.group(0)
        fin = bloc.rindex('</div></section>')
        bloc = bloc[:fin] + CARTE + bloc[fin:]
        h = h[:m.start()] + bloc + h[m.end():]
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
    return f'index : sec-linux={comptes.get("sec-linux")} ; total {total}'


if __name__ == '__main__':
    c = sqlite3.connect(BASE)
    print(SLUG, ':', publier(c, SLUG, TITRE, EXTRAIT, CORPS))
    print(ranger(c).encode('ascii', 'replace').decode())
    c.commit()
    c.close()
    sys.exit(0)

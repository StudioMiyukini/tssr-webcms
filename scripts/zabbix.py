# -*- coding: utf-8 -*-
"""
Zabbix / supervision → trois pages :
  1. COURS  « Zabbix : superviser son SI (Linux & Windows) » (cat-supervision)
  2. PROCÉDURE « Installer un serveur Zabbix + ses agents » (sec-linux)
  3. CONFIGURATEUR « Configurateur — agent Zabbix » (hub Outils, sec-linux),
     îlot React data-block="zabbix-agent-configurator".

Contenu original (réécrit), inspiré de l'architecture décrite par IT-Connect
(cité en source). Orienté Debian 13 + Zabbix 7.4 / Agent 2, agent Windows en MSI.

IDEMPOTENT.
"""
import re
import sqlite3
import sys

from _cours import (BASE, Categorie, STYLE, bullets, hero, note, publier,
                    publier_lot, retenir, tab)

SRC = 'https://www.it-connect.fr/zabbix-le-guide-complet-pour-bien-debuter-sa-supervision-linux-windows/'

CAT = Categorie('cat-supervision', '📈', 'Supervision &amp; monitoring',
                'Surveiller serveurs, services et réseau : métriques, seuils et alertes, avec Zabbix.',
                '#e11d48')

# ═══════════════════════════════════════════════ 1) LE COURS ═══════════════════

def boite(emoji, titre, sous):
    return (f'<div style="flex:1 1 170px;border:1px solid var(--border);border-radius:10px;'
            f'padding:12px 14px;background:var(--surface-2)"><strong>{emoji} {titre}</strong>'
            f'<div class="meta" style="font-size:12px;margin-top:3px">{sous}</div></div>')

SCHEMA = (
    '<div style="display:flex;gap:10px;flex-wrap:wrap;margin:14px 0">'
    + boite('🧠', 'Serveur Zabbix', 'Le cœur (écrit en C) : collecte, évalue les seuils, déclenche les actions.')
    + boite('🖥️', 'Frontend web', 'Interface PHP servie par Apache/nginx : configuration et tableaux de bord.')
    + boite('🗄️', 'Base de données', 'MySQL/MariaDB ou PostgreSQL : configuration + historique des mesures.')
    + '</div>'
    '<div style="display:flex;gap:10px;flex-wrap:wrap;margin:0 0 6px">'
    + boite('📟', 'Agents', 'Installés sur les hôtes supervisés (Agent 2, en Go) : ils mesurent et renvoient.')
    + boite('🛰️', 'Proxy (option)', 'Relais qui collecte pour un site distant et soulage le serveur central.')
    + '</div>'
)

COURS = '\n'.join([
    hero('Cours · Supervision · Zabbix',
         'Zabbix : superviser son SI (Linux &amp; Windows)',
         'Savoir si un serveur est tombé <em>avant</em> que l’utilisateur n’appelle : c’est le rôle de la '
         'supervision. Tour d’horizon de <strong>Zabbix</strong> — son architecture, ses agents, et les '
         'notions d’items, triggers, templates et alertes.'),
    STYLE,
    note('blue', '🎯 La supervision, pour quoi faire',
         'Superviser, c’est <strong>mesurer en continu</strong> l’état des machines et services (CPU, RAM, '
         'disque, ports, processus…), <strong>comparer à des seuils</strong>, et <strong>alerter</strong> '
         'quand quelque chose dérape — idéalement avant la panne. Zabbix est une solution libre, complète '
         'et gratuite, capable de superviser Linux, Windows, du réseau (SNMP) et des applications.'),

    '<h2>L’architecture de Zabbix</h2>',
    '<p>Zabbix se compose de briques séparées, qu’on peut installer sur une seule machine (en labo) ou '
    'réparties en production :</p>',
    SCHEMA,
    tab(['Brique', 'Rôle'],
        [['<strong>Serveur</strong>', 'Reçoit les mesures, évalue les déclencheurs, lance les actions (mails, scripts).'],
         ['<strong>Frontend</strong>', 'L’interface web (PHP + Apache/nginx) pour tout configurer et visualiser.'],
         ['<strong>Base de données</strong>', 'MySQL/MariaDB ou PostgreSQL : stocke la configuration et l’historique.'],
         ['<strong>Agent</strong>', 'Sur chaque hôte supervisé ; <em>Agent 2</em> est la version moderne (plugins).'],
         ['<strong>Proxy</strong>', 'Facultatif : collecte pour un site distant puis transmet au serveur.']]),

    '<h2>Les notions à connaître</h2>',
    tab(['Terme', 'Définition'],
        [['<strong>Host</strong> (hôte)', 'Un équipement supervisé (serveur, poste, switch…), rattaché à un groupe.'],
         ['<strong>Item</strong> (élément)', 'Une mesure, identifiée par une <strong>clé</strong> : ex. <code>system.cpu.load</code>, <code>vm.memory.size[available]</code>, <code>agent.ping</code>.'],
         ['<strong>Trigger</strong> (déclencheur)', 'Une <strong>condition/seuil</strong> sur un ou plusieurs items (ex. CPU &gt; 90 % pendant 5 min) qui fait passer l’hôte en « problème ».'],
         ['<strong>Template</strong> (modèle)', 'Un paquet d’items + triggers prêts à l’emploi, <strong>hérité</strong> par les hôtes (ex. « Linux by Zabbix agent »). On applique des dizaines de mesures d’un clic.'],
         ['<strong>Action / alerte</strong>', 'Ce qui se passe quand un trigger s’active : e-mail, message (Telegram, webhook), exécution d’un script.'],
         ['<strong>Découverte</strong>', 'Détection automatique d’hôtes (réseau) ou d’éléments (LLD : partitions, interfaces…) pour créer les items tout seuls.']]),

    '<h2>Agent passif ou actif&nbsp;?</h2>',
    '<p>L’agent se décline en deux modes (souvent les deux ensemble) qui changent <strong>qui initie la '
    'connexion</strong> — important pour le pare-feu :</p>',
    tab(['Mode', 'Qui contacte qui', 'Port', 'Quand']	,
        [['<strong>Passif</strong>', 'Le serveur interroge l’agent', '<code>10050</code> (vers l’agent)',
          'Réseau simple, l’agent est joignable depuis le serveur.'],
         ['<strong>Actif</strong>', 'L’agent pousse vers le serveur', '<code>10051</code> (vers le serveur)',
          'L’hôte est derrière un NAT/pare-feu ; allège le serveur.']]),
    note('yellow', '⚠️ En mode actif, le nom compte',
         'Le paramètre <code>Hostname=</code> de l’agent doit être <strong>exactement</strong> le « Host name » '
         'déclaré côté serveur, sinon les données actives n’arrivent jamais.'),

    retenir(
        'Zabbix = <strong>serveur</strong> + <strong>frontend web</strong> + <strong>base</strong> + '
        '<strong>agents</strong> (+ proxy optionnel).',
        'Un <strong>item</strong> (clé) mesure, un <strong>trigger</strong> compare à un seuil, une '
        '<strong>action</strong> alerte ; un <strong>template</strong> applique tout ça d’un coup.',
        'Agent <strong>passif</strong> = serveur → agent sur <code>10050</code> ; agent <strong>actif</strong> '
        '= agent → serveur sur <code>10051</code>.'),

    note('gray', '🔗 Pour aller plus loin',
         f'Le guide complet d’IT-Connect : <a href="{SRC}" target="_blank" rel="noopener noreferrer">'
         'Zabbix, bien débuter sa supervision</a>. Et la pratique : '
         '<a href="/pages/procedure-zabbix">installer un serveur Zabbix + ses agents</a> · '
         '<a href="/pages/configurateur-zabbix">le configurateur d’agent</a>.'),
])
EXTRAIT_COURS = ('La supervision avec Zabbix : architecture (serveur, frontend web, base, agents, proxy), '
                 'notions d’host/item/trigger/template/action/découverte, et agent passif (10050) vs actif '
                 '(10051). Pour superviser Linux et Windows.')
DESC_COURS = ('Architecture Zabbix, notions clés (items, triggers, templates, alertes) et modes d’agent '
              'passif/actif : les bases de la supervision d’un SI.')
PAGES_COURS = [('zabbix-supervision', 'Zabbix : superviser son SI (Linux &amp; Windows)',
                EXTRAIT_COURS, COURS, 'Zabbix', DESC_COURS)]

# ═══════════════════════════════════════════════ 2) LA PROCÉDURE ═══════════════

PSTYLE = ('<style>'
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
          ".lx-nav{font-family:ui-monospace,monospace;font-size:12px;font-weight:600;"
          "background:var(--surface-3);border:1px solid var(--border);border-radius:6px;padding:1px 7px}"
          "</style>")


def cmd(t): return f'<div class="proc-cmd">{t}</div>'
def note2(c, t, *p): return (f'<aside class="pb-note pb-note-{c}"><p class="pb-note-title">{t}</p>'
                             + ''.join(f'<p>{x}</p>' for x in p) + '</aside>')
def tab2(h, l):
    th = ''.join(f'<th>{x}</th>' for x in h)
    tr = ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in r) + '</tr>' for r in l)
    return f'<table class="rt"><tr>{th}</tr>{tr}</table>'
def etape(n, c, t, s, corps):
    return (f'<div class="step-banner" style="border-left-color:{c}">'
            f'<span class="step-num" style="background:{c}">{n}</span>'
            f'<span class="step-tt"><h3>{t}</h3><span class="step-sub">{s}</span></span></div>'
            f'<div class="step-rail" style="border-left-color:{c}">{corps}</div>')


BLEU, VERT, AMBRE, VIOLET, ROUGE, TEAL = '#3b82f6', '#16a34a', '#d97706', '#7c3aed', '#dc2626', '#0d9488'

PROC = '\n'.join([
    '<section class="hero"><span class="pill">Procédure · Supervision · Zabbix</span>'
    '<h1>Installer un serveur Zabbix et ses agents</h1>'
    '<p>Monter un serveur <strong>Zabbix 7.4</strong> sur Debian (serveur + frontend web + base), puis '
    'y raccrocher des <strong>agents</strong> Linux et Windows, ajouter un hôte avec son template, et '
    'recevoir une <strong>alerte mail</strong> au premier seuil dépassé.</p>'
    '</section>',
    PSTYLE,
    note2('blue', '🧩 L’idée',
          'On installe d’abord le <strong>serveur</strong> (il porte aussi le frontend web et la base), puis '
          'un <strong>agent</strong> sur chaque machine à surveiller. Le serveur interroge les agents (ou les '
          'agents poussent) et affiche tout dans l’interface. Rappel des concepts : '
          '<a href="/pages/zabbix-supervision">le cours</a>.'),

    etape(1, ROUGE, 'Installer le serveur Zabbix (Debian)', 'Dépôt + paquets + base MariaDB',
          '<p>Sur une VM Debian 13 dédiée, en root. D’abord le dépôt officiel Zabbix 7.4 :</p>'
          + cmd('wget https://repo.zabbix.com/zabbix/7.4/release/debian/pool/main/z/zabbix-release/'
                'zabbix-release_latest_7.4+debian13_all.deb\n'
                'sudo dpkg -i zabbix-release_latest_7.4+debian13_all.deb\n'
                'sudo apt update')
          + '<p>Les paquets du serveur, du frontend et de l’agent local, plus MariaDB :</p>'
          + cmd('sudo apt install -y zabbix-server-mysql zabbix-frontend-php zabbix-apache-conf '
                'zabbix-sql-scripts zabbix-agent2 mariadb-server')
          + note2('gray', '🗄️ Serveur + frontend + base sur une même VM',
                  'Parfait en labo. En production, on sépare souvent la base et le frontend sur d’autres '
                  'machines.')),

    etape(2, AMBRE, 'Créer la base et importer le schéma', 'MariaDB : base, utilisateur, schéma',
          '<p>Créer la base <code>zabbix</code> (collation <code>utf8mb4_bin</code> exigée) et son '
          'utilisateur :</p>'
          + cmd('sudo mysql -uroot -p')
          + cmd('CREATE DATABASE zabbix CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;\n'
                "CREATE USER zabbix@localhost IDENTIFIED BY 'MotDePasseRobuste';\n"
                'GRANT ALL PRIVILEGES ON zabbix.* TO zabbix@localhost;\n'
                'SET GLOBAL log_bin_trust_function_creators = 1;\n'
                'quit;')
          + '<p>Importer le schéma initial (il crée les tables + les données de base) :</p>'
          + cmd('zcat /usr/share/zabbix-sql-scripts/mysql/server.sql.gz | '
                'mysql --default-character-set=utf8mb4 -uzabbix -p zabbix')
          + '<p>Puis on peut remettre le paramètre temporaire à 0 :</p>'
          + cmd('sudo mysql -uroot -p -e "SET GLOBAL log_bin_trust_function_creators = 0;"')
          + note2('amber', '⏳ Patience',
                  'L’import du schéma prend une à deux minutes et affiche la saisie du mot de passe '
                  'de l’utilisateur <code>zabbix</code>.')),

    etape(3, VERT, 'Configurer et démarrer le serveur', 'DBPassword + services',
          '<p>Renseigner le mot de passe de la base dans la conf du serveur :</p>'
          + cmd('sudo nano /etc/zabbix/zabbix_server.conf\n'
                '# décommenter / renseigner :\n'
                'DBPassword=MotDePasseRobuste')
          + '<p>Démarrer et activer serveur, agent local, Apache et PHP-FPM :</p>'
          + cmd('sudo systemctl restart zabbix-server zabbix-agent2 apache2\n'
                'sudo systemctl enable zabbix-server zabbix-agent2 apache2')
          + '<p>Ouvrir le port de collecte active sur le pare-feu du serveur :</p>'
          + cmd('command -v ufw >/dev/null && sudo ufw allow 10051/tcp || true')),

    etape(4, BLEU, 'Terminer l’installation via le navigateur', 'Assistant web Zabbix',
          '<ol style="margin:0;padding-left:18px;line-height:1.7">'
          '<li>Ouvrir <span class="lx-nav">http://&lt;IP_SERVEUR_ZABBIX&gt;/zabbix</span>.</li>'
          '<li>Suivre l’assistant : langue, vérification des prérequis PHP, puis les <strong>paramètres de '
          'base</strong> (hôte <code>localhost</code>, base <code>zabbix</code>, utilisateur '
          '<code>zabbix</code> + mot de passe).</li>'
          '<li>Se connecter : identifiant <strong>Admin</strong>, mot de passe <strong>zabbix</strong> '
          '(à changer <em>immédiatement</em>).</li></ol>'
          + note2('yellow', '🔐 Premier réflexe',
                  'Changer le mot de passe du compte <strong>Admin</strong> dès la première connexion '
                  '(Utilisateurs ▸ Admin).')),

    etape(5, TEAL, 'Installer un agent sur un hôte', 'Agent 2 — Linux (Debian) et Windows',
          '<p><strong>Linux (Debian)</strong> — sur la machine à superviser :</p>'
          + cmd('wget https://repo.zabbix.com/zabbix/7.4/release/debian/pool/main/z/zabbix-release/'
                'zabbix-release_latest_7.4+debian13_all.deb\n'
                'sudo dpkg -i zabbix-release_latest_7.4+debian13_all.deb\n'
                'sudo apt update && sudo apt install -y zabbix-agent2')
          + '<p>Pointer l’agent vers le serveur dans '
          '<span class="lx-nav">/etc/zabbix/zabbix_agent2.conf</span> :</p>'
          + cmd('Server=&lt;IP_SERVEUR_ZABBIX&gt;\n'
                'ServerActive=&lt;IP_SERVEUR_ZABBIX&gt;\n'
                'Hostname=SRV-WEB-01')
          + cmd('sudo systemctl enable --now zabbix-agent2\n'
                'sudo systemctl restart zabbix-agent2')
          + '<p><strong>Windows</strong> : télécharger le MSI « Zabbix agent 2 » (7.4, amd64) sur '
          '<span class="lx-nav">zabbix.com/download_agents</span>, puis l’installer (l’assistant demande '
          'l’IP du serveur et le Hostname), ou en silencieux :</p>'
          + cmd('msiexec /i zabbix_agent2-7.4.0-windows-amd64-openssl.msi /qn '
                'SERVER=&lt;IP&gt; SERVERACTIVE=&lt;IP&gt; HOSTNAME=PC-WIN-01 ENABLEPATH=1')
          + note2('gray', '⚙️ Générer la conf sans se tromper',
                  'Le <a href="/pages/configurateur-zabbix">configurateur d’agent Zabbix</a> produit le '
                  'fichier <code>zabbix_agent2.conf</code> et le script d’installation (Debian ou Windows) '
                  'd’après l’IP du serveur, le nom d’hôte, le mode et l’éventuel PSK.')),

    etape(6, VIOLET, 'Déclarer l’hôte et appliquer un template', 'Collecte de données ▸ Hôtes',
          '<ol style="margin:0;padding-left:18px;line-height:1.7">'
          '<li><strong>Collecte de données ▸ Hôtes ▸ Créer un hôte</strong>.</li>'
          '<li><strong>Nom de l’hôte</strong> = le <code>Hostname</code> de l’agent ; choisir un '
          '<strong>groupe</strong> (Linux servers / Windows servers).</li>'
          '<li>Ajouter une <strong>interface Agent</strong> : IP de l’hôte, port '
          '<span class="lx-nav">10050</span>.</li>'
          '<li>Onglet <strong>Modèles</strong> : associer « <strong>Linux by Zabbix agent</strong> » (ou '
          '« Windows by Zabbix agent »).</li></ol>'
          + note2('gray', '🟢 Vérifier',
                  'Au bout d’~1 min l’indicateur <strong>ZBX</strong> passe au vert et des dizaines d’items '
                  '(CPU, RAM, disque, services) remontent, hérités du template. Test en ligne de commande '
                  'depuis le serveur : <code>zabbix_get -s &lt;IP_HOTE&gt; -k agent.ping</code> (→ 1).')),

    etape(7, VERT, 'Un déclencheur et une alerte mail', 'Trigger + média + action',
          '<ol style="margin:0;padding-left:18px;line-height:1.7">'
          '<li>Les templates fournissent déjà des <strong>triggers</strong> (ex. « High CPU utilization »). '
          'Pour en créer un : <strong>Collecte de données ▸ Hôtes ▸ Déclencheurs ▸ Créer</strong>, avec une '
          'expression du type '
          '<span class="lx-nav">last(/SRV-WEB-01/system.cpu.util)&gt;90</span>.</li>'
          '<li><strong>Alertes ▸ Types de média ▸ Email</strong> : renseigner le serveur SMTP.</li>'
          '<li>Sur ton utilisateur : onglet <strong>Média</strong> → ajouter ton adresse e-mail.</li>'
          '<li><strong>Alertes ▸ Actions</strong> : créer une action « Envoyer un e-mail aux admins » sur '
          'déclenchement d’un problème.</li></ol>'
          + note2('green', '🏁 Résultat',
                  'Dès qu’un trigger passe en « Problème », Zabbix envoie l’e-mail. La supervision est '
                  'bouclée : mesure → seuil → alerte.')),

    note2('gray', '🔗 Pour aller plus loin',
          f'Le guide détaillé d’IT-Connect : <a href="{SRC}" target="_blank" rel="noopener noreferrer">'
          'Zabbix, bien débuter sa supervision</a>. À rapprocher : '
          '<a href="/pages/zabbix-supervision">le cours</a> · '
          '<a href="/pages/configurateur-zabbix">le configurateur d’agent</a>.'),
])
EXTRAIT_PROC = ('Installer Zabbix 7.4 sur Debian : dépôt, serveur + frontend + base MariaDB (schéma '
                'utf8mb4_bin), setup web, agents Agent 2 Linux et Windows, ajout d’un hôte + template, puis '
                'trigger et alerte mail.')

CARTE_PROC = ('<a class="dir-card" href="/pages/procedure-zabbix"><div class="dc-ico">📈</div>'
              '<div class="dc-body"><div class="dc-title">Installer un serveur Zabbix + ses agents</div>'
              '<div class="dc-desc meta">Serveur Zabbix 7.4 sur Debian (serveur + frontend + base MariaDB), '
              'agents Agent 2 Linux &amp; Windows, ajout d’hôte + template, trigger et alerte mail.</div>'
              '<div><span style="display:inline-block;font-size:10.5px;font-weight:600;color:var(--text-muted);'
              'background:var(--surface-3);border:1px solid var(--border);border-radius:999px;padding:1px 9px;'
              'margin:4px 4px 0 0">Zabbix</span>'
              '<span style="display:inline-block;font-size:10.5px;font-weight:600;color:var(--text-muted);'
              'background:var(--surface-3);border:1px solid var(--border);border-radius:999px;padding:1px 9px;'
              'margin:4px 4px 0 0">Supervision</span></div></div><div class="dc-go">Voir →</div></a>')

# ═══════════════════════════════════════════════ 3) LE CONFIGURATEUR ═══════════

CONF = '\n'.join([
    hero('Outil · Supervision · Zabbix', 'Configurateur — agent Zabbix',
         'Une IP de serveur, un nom d’hôte, un mode — et l’outil écrit le '
         '<strong>zabbix_agent2.conf</strong> et le script d’installation complet, pour <strong>Debian</strong> '
         'ou <strong>Windows</strong>, avec l’option <strong>PSK</strong>.'),
    STYLE,
    '<p>Raccrocher une machine à un serveur Zabbix, c’est installer l’agent, écrire la bonne conf '
    '(<code>Server</code>/<code>ServerActive</code>/<code>Hostname</code>), ouvrir le port, puis déclarer '
    'l’hôte côté serveur. Cet outil génère tout ça de façon cohérente — et rappelle le template à '
    'appliquer. Il complète la <a href="/pages/procedure-zabbix">procédure d’installation du serveur</a>.</p>',
    '<h2>Ce que l’outil produit</h2>',
    tab(['Section', 'Où', 'Ce qu’elle fait'],
        [['Fichier <code>zabbix_agent2.conf</code>', 'Sur l’hôte supervisé',
          'La conf prête : mode passif/actif, <code>Hostname</code>, port, et bloc PSK si activé.'],
         ['Script d’installation', 'Dans la VM (Debian) en root',
          'Dépôt Zabbix, <code>apt install zabbix-agent2</code>, écriture de la conf, service, règle '
          'pare-feu — en un script (bouton « Pour la console » / « Ligne curl »).'],
         ['Installation Windows', 'Sur le poste Windows',
          'La commande <code>msiexec</code> silencieuse (Server/Hostname/port) + le service + la règle '
          'de pare-feu.'],
         ['Côté serveur', 'Interface web Zabbix',
          'Le rappel pour créer l’hôte et appliquer « Linux/Windows by Zabbix agent », plus les tests '
          '<code>zabbix_get</code>.']]),
    '<div data-block="zabbix-agent-configurator"></div>',
    note('yellow', '⚠️ Le nom d’hôte doit correspondre',
         'En mode <strong>actif</strong>, le <code>Hostname=</code> de l’agent doit être <strong>identique</strong> '
         'au « Host name » déclaré côté serveur, sinon les données ne remontent pas.'),
    note('gray', '🔗 À rapprocher',
         '<a href="/pages/procedure-zabbix">La procédure d’installation du serveur</a> · '
         '<a href="/pages/zabbix-supervision">le cours sur la supervision</a> · '
         f'<a href="{SRC}" target="_blank" rel="noopener noreferrer">le guide IT-Connect</a>.'),
])
EXTRAIT_CONF = ('Outil interactif : génère le zabbix_agent2.conf et l’installation d’un agent Zabbix (Debian '
                'ou Windows) — mode passif/actif, port, PSK — plus le rappel côté serveur (hôte + template).')

CARTE_OUTIL = ('<a class="script-card" href="/pages/configurateur-zabbix"><div class="sc-top">'
               '<span class="sc-ico">📈</span><span class="sc-badge sc-badge-int">⚡ Interactif</span></div>'
               '<div class="sc-title">Configurateur — agent Zabbix</div>'
               '<div class="sc-desc meta">Outil interactif : génère le zabbix_agent2.conf et le script '
               'd’installation d’un agent (Debian ou Windows), mode passif/actif, PSK, + rappel côté serveur.</div>'
               '<div class="sc-tags"><span class="sc-pill">Zabbix</span><span class="sc-pill">Supervision</span>'
               '<span class="sc-pill">Linux</span><span class="sc-pill">Windows</span></div></a>')


# ── rangements ─────────────────────────────────────────────────────────────────

def ranger(c, slug, sec_id, carte):
    h = c.execute("SELECT content FROM pages WHERE slug='procedures'").fetchone()[0]
    if slug not in h:
        m = re.search(r'<section class="pd-sec" id="%s">.*?</section>' % sec_id, h, re.S)
        bloc = m.group(0)
        fin = bloc.rindex('</div></section>')
        bloc = bloc[:fin] + carte + bloc[fin:]
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
    return f'{sec_id}={comptes.get(sec_id)} ; total {total}'


def ranger_outil(c):
    ct = c.execute("SELECT content FROM pages WHERE slug='scripts'").fetchone()[0]
    if 'configurateur-zabbix' in ct:
        return 'deja present'
    i = ct.index('id="sec-linux"')
    j = ct.index('</div></section>', i)
    ct = ct[:j] + CARTE_OUTIL + ct[j:]
    sec = ct[i:ct.index('</section>', i)]
    n = sec.count('<a class="script-card"')
    ct = ct[:i] + re.sub(r'<span class="sc-count">\d+</span>', f'<span class="sc-count">{n}</span>', sec, count=1) + ct[i + len(sec):]
    ct = re.sub(r'(<a class="sc-chip" href="#sec-linux">.*?<span class="sc-n">)\d+(</span>)',
                lambda m: m.group(1) + str(n) + m.group(2), ct, count=1, flags=re.S)
    total = ct.count('<a class="script-card"') + ct.count('class="sc-feat"')
    ct = re.sub(r'<p class="meta">\d+ outils\.', f'<p class="meta">{total} outils.', ct, count=1)
    c.execute("UPDATE pages SET content=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug='scripts'", (ct,))
    return f'outil range (sec-linux {n}, total {total})'


if __name__ == '__main__':
    publier_lot(PAGES_COURS, CAT)
    c = sqlite3.connect(BASE)
    print('procedure-zabbix :', publier(c, 'procedure-zabbix',
          'Installer un serveur Zabbix et ses agents', EXTRAIT_PROC, PROC))
    print(ranger(c, 'procedure-zabbix', 'sec-linux', CARTE_PROC).encode('ascii', 'replace').decode())
    print('configurateur-zabbix :', publier(c, 'configurateur-zabbix',
          'Configurateur — agent Zabbix', EXTRAIT_CONF, CONF))
    print(ranger_outil(c).encode('ascii', 'replace').decode())
    c.commit()
    c.close()
    sys.exit(0)

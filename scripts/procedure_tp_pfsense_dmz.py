# -*- coding: utf-8 -*-
"""
Page « TP pfSense — DMZ, AD et serveur Web (corrigé) » : le corrigé pas à pas du
TP1 de la série deux-agences — hyperviseur & vSwitch, plan d'adressage arbitré,
installation pfSense (interfaces WAN/LAN/LAN Serveur/DMZ, DHCP, règles), AD DS +
OU + partage, serveur Web en DMZ, puis NAT / règles pare-feu et cahier de test.
Style step-banner. Rangée dans Procédures › Réseau & adressage.

IDEMPOTENT.
"""
import re
import sqlite3
import sys

from _cours import BASE, publier

SLUG = 'procedure-tp-pfsense-dmz'
TITRE = 'TP pfSense — DMZ, Active Directory et serveur Web (corrigé)'

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
         ".lx-nav{font-family:ui-monospace,monospace;font-size:12px;font-weight:600;"
         "background:var(--surface-3);border:1px solid var(--border);border-radius:6px;padding:1px 7px}"
         "</style>")


def cmd(t):
    return f'<div class="proc-cmd">{t}</div>'


def nav(t):
    return f'<span class="lx-nav">{t}</span>'


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

CORPS = '\n'.join([
    '<section class="hero"><span class="pill">Procédure · TP · pfSense · DMZ</span>'
    '<h1>TP pfSense — DMZ, Active Directory et serveur Web</h1>'
    '<p>Le corrigé pas à pas du premier TP de la série deux-agences : bâtir une infrastructure '
    'complète et sécurisée pour une agence (Bordeaux <em>ou</em> Toulouse) — hyperviseur, pare-feu '
    'pfSense à quatre interfaces, Active Directory, serveur Web isolé en DMZ — prête à être reliée à '
    'l’autre agence par VPN.</p>'
    '</section>',
    STYLE,

    note('blue', '🎯 Le contexte et l’objectif',
         'Entreprise d’infogérance, un client ouvre <strong>deux agences</strong> à relier plus tard '
         'par un <a href="/pages/procedure-vpn-ipsec-pfsense">VPN site-à-site</a>. En binôme : l’un '
         'monte <strong>Bordeaux</strong>, l’autre <strong>Toulouse</strong>. Chaque agence a le même '
         'gabarit — un pare-feu <strong>pfSense</strong>, un <strong>LAN utilisateurs</strong>, un '
         '<strong>LAN Serveur</strong> (AD), une <strong>DMZ</strong> (serveur Web) — mais un '
         '<strong>adressage différent</strong> pour ne pas entrer en conflit au moment du VPN.',
         'Les valeurs d’adressage ci-dessous sont <strong>arbitrées</strong> pour ce corrigé ; '
         'elles sont cohérentes avec le TP VPN et le TP sauvegarde qui suivent.'),

    etape(1, TEAL, 'Préparer l’hyperviseur : les commutateurs virtuels',
          'Un vSwitch par réseau — et l’hyperviseur visible depuis le LAN Serveur',
          '<p>Avant toute VM, on crée les <strong>commutateurs virtuels</strong>. Chaque réseau du '
          'schéma = un vSwitch. Le WAN est le seul commutateur <strong>externe</strong> (il rejoint '
          'l’autre agence / Internet) ; les autres sont <strong>privés/internes</strong>.</p>'
          + tab(['Réseau', 'Type de vSwitch', 'Rôle'],
                [['LAN Serveur', '<strong>Privé / interne</strong>', 'AD, serveurs — et l’hyperviseur'],
                 ['LAN', '<strong>Privé / interne</strong>', 'Postes utilisateurs (adressés par DHCP)'],
                 ['DMZ', '<strong>Privé / interne</strong>', 'Serveur Web exposé, isolé du reste'],
                 ['WAN', '<strong>Externe</strong>', 'Vers l’autre agence / Internet']])
          + note('amber', '⚠️ Contrainte imposée par la suite des TP',
                 'L’<strong>hyperviseur doit être joignable depuis le LAN Serveur</strong> : c’est ce '
                 'réseau que Veeam utilisera pour la sauvegarde et la réplication. Sous Hyper-V, on '
                 'donne à l’hôte une carte sur le vSwitch <em>LAN Serveur</em> ; sous ESXi, le '
                 'port de management y est raccordé. <strong>Faire valider par l’intervenant.</strong>')),

    etape(2, BLEU, 'Définir le plan d’adressage',
          'Trois réseaux internes par agence + l’interconnexion WAN',
          '<p>Adressage arbitré — Bordeaux en <span class="lx-nav">10.180.x.x/24</span>, Toulouse en '
          '<span class="lx-nav">10.160.x.x/24</span> :</p>'
          + tab(['Agence', 'Réseau', 'Adresse réseau', 'Masque', 'Passerelle', 'DNS'],
                [['<strong>Bordeaux</strong>', 'DMZ', '10.180.30.0', '/24', '10.180.30.254', '10.180.30.254'],
                 ['', 'LAN Serveur', '10.180.10.0', '/24', '10.180.10.254', '10.180.10.1'],
                 ['', 'LAN', '10.180.20.0', '/24', '10.180.20.254', '10.180.10.1'],
                 ['<strong>Toulouse</strong>', 'DMZ', '10.160.30.0', '/24', '10.160.30.254', '10.160.30.254'],
                 ['', 'LAN Serveur', '10.160.10.0', '/24', '10.160.10.254', '10.160.10.1'],
                 ['', 'LAN', '10.160.20.0', '/24', '10.160.20.254', '10.160.10.1'],
                 ['<strong>WAN</strong>', 'Bordeaux', '10.22.10.181', '/24', '10.22.10.254', '8.8.8.8'],
                 ['', 'Toulouse', '10.22.10.161', '/24', '10.22.10.254', '8.8.8.8']])
          + note('green', '❓ Combien d’interfaces sur le pare-feu pfSense ?',
                 '<strong>Quatre.</strong> Une par réseau à raccorder : <strong>WAN</strong>, '
                 '<strong>LAN</strong>, <strong>LAN Serveur</strong> (OPT1) et <strong>DMZ</strong> '
                 '(OPT2). Chaque interface porte l’adresse <span class="lx-nav">.254</span> de son '
                 'réseau — c’est la passerelle de la zone. <strong>Faire valider par l’intervenant.</strong>')
          + note('blue', '🧭 Repère',
                 'Le <strong>DNS du LAN et du LAN Serveur pointe vers l’AD</strong> '
                 '(<span class="lx-nav">.10</span>) ; celui de la DMZ pointe vers le pare-feu '
                 '(<span class="lx-nav">.254</span>), car la DMZ ne doit pas interroger l’AD interne. '
                 'Besoin d’un coup de main pour poser les IP des équipements ? '
                 '<a href="/pages/configurateur-pfsense">Le configurateur pfSense</a> génère le '
                 'plan et les règles.')),

    etape(3, VIOLET, 'Installer et configurer pfSense',
          'VM, quatre interfaces, adresses, DHCP du LAN, et deux règles à corriger',
          '<ol style="margin:0;padding-left:18px;line-height:1.7">'
          '<li>Créer la <strong>VM pfSense</strong> et lui ajouter <strong>quatre cartes réseau</strong>, '
          'une sur chaque vSwitch (WAN, LAN, LAN Serveur, DMZ).</li>'
          '<li>Au premier démarrage, <strong>assigner les interfaces</strong> '
          '(<span class="lx-nav">assign interfaces</span>) : WAN, LAN, puis OPT1 = LAN Serveur, '
          'OPT2 = DMZ.</li>'
          '<li>Poser l’<strong>IP .254</strong> de chaque zone (menu <span class="lx-nav">2) Set '
          'interface IP address</span>), sauf le WAN qui prend l’IP d’interconnexion du plan.</li>'
          '<li>Depuis un poste du LAN, ouvrir la <strong>console web</strong> '
          '(<span class="lx-nav">https://10.180.20.254</span>) et finir la configuration.</li></ol>'
          + note('green', '🔧 DHCP du LAN',
                 '<span class="lx-nav">Services ▸ DHCP Server ▸ LAN</span> : activer, définir une '
                 'plage (ex. <span class="lx-nav">10.180.20.50–150</span>), passerelle '
                 '<span class="lx-nav">.254</span>, DNS <span class="lx-nav">.10</span> (l’AD). '
                 'Le LAN Serveur et la DMZ restent en <strong>IP fixe</strong>.')
          + note('amber', '⚠️ Les deux règles par défaut à corriger',
                 '<strong>1. Supprimer / désactiver le “LAN → any:any”.</strong> pfSense ouvre le LAN '
                 'en grand par défaut : on remplace cette règle permissive par des règles '
                 'explicites (accès Internet, accès au serveur Web, etc.).',
                 '<strong>2. Désactiver « Block private networks » sur le WAN.</strong> Le WAN de ce '
                 'lab utilise des adresses privées (<span class="lx-nav">10.22.10.0/24</span>) : '
                 'sans cela, le pare-feu bloquerait l’interconnexion entre agences. '
                 '<span class="lx-nav">Interfaces ▸ WAN ▸ décocher Block private networks</span>.')),

    etape(4, BLEU, 'Windows Server + Active Directory',
          'AD DS, domaine, OU et utilisateurs, poste client, partage de fichiers',
          '<ol style="margin:0;padding-left:18px;line-height:1.7">'
          '<li>VM <strong>Windows Server 2019/2022</strong> (60 Go, 4 Go RAM, 2 vCPU), '
          '<strong>IP fixe</strong> <span class="lx-nav">10.180.10.10</span>, nom d’hôte conforme, '
          'mises à jour.</li>'
          '<li>Installer le rôle <strong>AD DS</strong> et promouvoir en nouveau domaine '
          '<span class="lx-nav">bordeaux.local</span> (ou <span class="lx-nav">toulouse.local</span>).</li>'
          '<li>Créer l’<strong>enregistrement DNS</strong> du futur site Web de la DMZ '
          '(<span class="lx-nav">www</span> → IP du serveur Web).</li></ol>'
          '<p>Arborescence des OU et comptes demandée :</p>'
          + tab(['OU', 'Utilisateurs'],
                [['Services', '—'],
                 ['Services ▸ Direction ▸ Users', 'Marie Poch, Daniel Pivot'],
                 ['Services ▸ Production ▸ Users', 'Jean Marre, Patrick Morel, <em>votre nom</em>']])
          + '<ol start="4" style="margin:8px 0 0;padding-left:18px;line-height:1.7">'
          '<li>Créer la VM <strong>Windows 10 Pro</strong> nommée '
          '<span class="lx-nav">PC-PROD01</span> et la <strong>joindre au domaine</strong> '
          '(adapter les règles pare-feu du LAN pour laisser passer le trafic AD).</li>'
          '<li>Ajouter un <strong>disque de 10 Go</strong>, le monter en <span class="lx-nav">E:</span> '
          'et le nommer <strong>DATA</strong>.</li>'
          '<li>Ajouter le rôle <strong>Services de fichiers</strong>, créer le dossier partagé '
          '<span class="lx-nav">PARTAGE</span> (droits pour tout le monde, à restreindre ensuite), '
          'et <strong>tester l’accès</strong> depuis PC-PROD01.</li></ol>'
          + note('blue', '🔗 Aller plus vite',
                 'Pour la masse (OU, comptes, groupes AGDLP, partage), voir '
                 '<a href="/pages/configurateur-ad">le configurateur Active Directory</a> et '
                 '<a href="/pages/constructeur-serveur-fichiers">le constructeur de serveur de '
                 'fichiers</a>.')),

    etape(5, AMBRE, 'Le serveur Web en DMZ',
          'Debian/Ubuntu isolé, virtual host, page d’accueil, enregistrement DNS',
          '<ol style="margin:0;padding-left:18px;line-height:1.7">'
          '<li>VM <strong>Debian/Ubuntu</strong> sur le vSwitch <strong>DMZ</strong>, IP fixe '
          '<span class="lx-nav">10.180.30.10</span>, passerelle <span class="lx-nav">10.180.30.254</span>, '
          'nom d’hôte conforme, mises à jour '
          '(<a href="/pages/tp-config-reseau-statique">rappel : IP statique sous Debian</a>).</li>'
          '<li>Installer un serveur web (Apache, NGINX, Caddy…).</li>'
          '<li>Configurer un <strong>virtual host</strong> pour '
          '<span class="lx-nav">www.bordeaux.local</span> et personnaliser la page d’accueil au nom '
          'de l’agence.</li>'
          '<li>Sur l’AD, ajouter/valider l’<strong>enregistrement DNS</strong> '
          '<span class="lx-nav">www</span> → <span class="lx-nav">10.180.30.10</span> pour joindre '
          'le site par son nom.</li></ol>'
          + cmd('# Apache — exemple de vhost minimal\n'
                'sudo apt update && sudo apt install -y apache2\n'
                'echo "<h1>Agence de Bordeaux</h1>" | sudo tee /var/www/html/index.html\n'
                'sudo systemctl enable --now apache2')
          + note('amber', '🔒 Pourquoi une DMZ',
                 'Le serveur Web est <strong>exposé</strong> : on l’isole dans sa propre zone pour '
                 'que sa compromission ne donne pas accès au LAN Serveur. La DMZ ne doit pas pouvoir '
                 'initier de connexions vers l’intérieur — c’est l’objet des règles de l’étape 6.')),

    etape(6, ROUGE, 'Les règles du pare-feu',
          'SSH, sorties DMZ, NAT du site Web, accès depuis le LAN, et les logs',
          '<p>On applique le principe du <strong>moindre privilège</strong> : tout est bloqué, on '
          'ouvre au cas par cas.</p>'
          + tab(['Où', 'Règle', 'But'],
                [['pfSense', 'Activer <strong>SSH</strong> '
                  '(<span class="lx-nav">System ▸ Advanced ▸ Secure Shell</span>)',
                  'Administration en ligne de commande'],
                 ['DMZ', 'Autoriser <strong>HTTP/HTTPS/DNS sortants</strong> uniquement',
                  'Le serveur Web se met à jour, résout des noms — rien de plus'],
                 ['DMZ', '<strong>Bloquer</strong> DMZ → LAN Serveur et DMZ → LAN',
                  'Un serveur exposé ne parle jamais à l’intérieur'],
                 ['WAN (NAT)', '<strong>Port forward</strong> WAN → serveur Web (80/443)',
                  'Publier le site depuis l’extérieur / l’autre agence'],
                 ['LAN', 'Autoriser <strong>LAN → serveur Web</strong> (80/443)',
                  'Les postes internes consultent le site'],
                 ['LAN', 'Autoriser DNS/HTTP/HTTPS sortants, bloquer le reste',
                  'Remplace le any/any supprimé à l’étape 3']])
          + note('green', '📖 Visualiser les logs des règles',
                 '<span class="lx-nav">Status ▸ System Logs ▸ Firewall</span> : chaque paquet '
                 'accepté/bloqué y apparaît. Pour tracer une règle précise, cocher '
                 '<strong>Log packets… </strong> dans la règle, puis filtrer par interface ou IP. '
                 'Indispensable pour comprendre <em>pourquoi</em> un flux passe ou ne passe pas.')
          + note('blue', '🔗 Le NAT en détail',
                 'La mécanique du port forward et du reverse-NAT : '
                 '<a href="/pages/opnsense-nat">NAT et redirections de port</a> (transposable à '
                 'pfSense) et <a href="/pages/dmz-mise-en-place">mettre en place une DMZ</a>.')),

    etape(7, VERT, 'Cahier de test et validation',
          'Écrire les tests attendus, puis les jouer',
          '<p>Un <strong>cahier de test</strong> transforme « ça a l’air de marcher » en preuve. '
          'Une ligne par exigence, un résultat attendu, un résultat obtenu :</p>'
          + tab(['Test', 'Attendu'],
                [['PC-PROD01 obtient une IP par DHCP', 'IP dans la plage, DNS = AD'],
                 ['PC-PROD01 est joint au domaine', 'Ouverture de session Marie Poch OK'],
                 ['PC-PROD01 accède à <span class="lx-nav">\\\\SRV-AD\\PARTAGE</span>', 'Lecture/écriture OK'],
                 ['Depuis le LAN : <span class="lx-nav">http://www.bordeaux.local</span>', 'Page de l’agence'],
                 ['Depuis le WAN : <span class="lx-nav">http://&lt;IP WAN&gt;</span>', 'Page servie via NAT'],
                 ['DMZ → LAN Serveur (ping AD)', '<strong>Bloqué</strong> (isolation DMZ)'],
                 ['Serveur Web → Internet (apt update)', 'OK (sortie DMZ autorisée)']])
          + note('green', '🏁 Faire valider par l’intervenant',
                 'Une agence tient debout : pare-feu à quatre zones, AD, postes joints, partage, '
                 'site Web publié et DMZ étanche. La suite : relier les deux agences par le '
                 '<a href="/pages/procedure-vpn-ipsec-pfsense">VPN IPsec site-à-site</a>, ajouter la '
                 '<a href="/pages/procedure-approbation-ad">relation d’approbation entre domaines</a>, '
                 'puis sécuriser par <a href="/pages/procedure-veeam-replication">sauvegarde et '
                 'réplication</a>.')),
])

EXTRAIT = ('Le corrigé pas à pas du TP1 deux-agences : commutateurs virtuels, plan d’adressage arbitré '
           '(Bordeaux 10.180.x / Toulouse 10.160.x), pfSense à quatre interfaces (WAN, LAN, LAN Serveur, '
           'DMZ) avec DHCP et règles corrigées, Active Directory (OU, comptes, partage), serveur Web '
           'isolé en DMZ, NAT et règles pare-feu, puis cahier de test.')

CARTE = ('<a class="dir-card" href="/pages/procedure-tp-pfsense-dmz"><div class="dc-ico">🧱</div>'
         '<div class="dc-body"><div class="dc-title">TP pfSense — DMZ, AD et serveur Web (corrigé)</div>'
         '<div class="dc-desc meta">Corrigé du TP1 deux-agences : vSwitch, plan d’adressage, pfSense '
         'à 4 interfaces (WAN/LAN/LAN Serveur/DMZ) + DHCP + règles, Active Directory, serveur Web en '
         'DMZ, NAT et pare-feu, cahier de test.</div>'
         '<div><span style="display:inline-block;font-size:10.5px;font-weight:600;color:var(--text-muted);'
         'background:var(--surface-3);border:1px solid var(--border);border-radius:999px;padding:1px 9px;'
         'margin:4px 4px 0 0">pfSense</span>'
         '<span style="display:inline-block;font-size:10.5px;font-weight:600;color:var(--text-muted);'
         'background:var(--surface-3);border:1px solid var(--border);border-radius:999px;padding:1px 9px;'
         'margin:4px 4px 0 0">DMZ</span></div></div><div class="dc-go">Voir →</div></a>')


def ranger(c):
    h = c.execute("SELECT content FROM pages WHERE slug='procedures'").fetchone()[0]
    if SLUG not in h:
        m = re.search(r'<section class="pd-sec" id="sec-reseau">.*?</section>', h, re.S)
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
    return f'index : sec-reseau={comptes.get("sec-reseau")} ; total {total}'


if __name__ == '__main__':
    c = sqlite3.connect(BASE)
    print(SLUG, ':', publier(c, SLUG, TITRE, EXTRAIT, CORPS))
    print(ranger(c).encode('ascii', 'replace').decode())
    c.commit()
    c.close()
    sys.exit(0)

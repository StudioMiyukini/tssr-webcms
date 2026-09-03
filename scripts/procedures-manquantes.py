# -*- coding: utf-8 -*-
"""
Crée les procédures qui manquaient face aux cours du site.

POURQUOI CE SCRIPT PLUTÔT QUE L'INTERFACE D'ADMINISTRATION
Quinze pages saisies à la main, c'est quinze occasions d'oublier une balise ou
de casser le style commun. Ici le squelette est écrit UNE fois et appliqué à
toutes : le jour où l'on change la présentation d'une procédure, on la change
partout.

Le script est IDEMPOTENT : relancé, il met à jour les pages existantes au lieu
d'en créer des doublons. C'est ce qui permet de corriger une coquille et de
rejouer sans faire le ménage avant.

L'index de recherche (`search_fts`) se reconstruit tout seul côté serveur dès
que la signature du contenu change — rien à faire ici.

Conventions reprises des cours du site : domaine `miyukini.lan`, réseau
`192.168.10.0/24`, passerelle `.254`, DC/DNS `192.168.10.1`, Debian 12.
"""
import sqlite3
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent / 'cms.sqlite'

# La feuille de style commune à toutes les procédures, reprise telle quelle des
# procédures déjà en ligne pour que les nouvelles ne détonnent pas.
STYLE = (
    '<style>.proc-steps{padding-left:22px;line-height:1.75}.proc-steps>li{margin:7px 0}'
    ".proc-steps code,.proc-steps kbd{font-family:ui-monospace,'Space Mono',monospace}"
    '.proc-steps kbd{border:1px solid var(--border);border-radius:5px;padding:1px 6px;'
    'background:var(--surface-2)}'
    ".proc-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);"
    'border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;'
    'white-space:pre-wrap;overflow-x:auto}'
    '.proc-tab{width:100%;border-collapse:collapse;margin:10px 0;font-size:14px}'
    '.proc-tab th,.proc-tab td{border:1px solid var(--border);padding:7px 10px;text-align:left;'
    'vertical-align:top}.proc-tab th{background:var(--surface-2);font-weight:700}'
    # Un tableau dense ne descend pas sous sa largeur minimale : sur un écran
    # étroit il pousserait toute la page. Il défile dans sa propre boîte, et le
    # corps de page reste en place. Même raison pour les chemins longs en <code>.
    '@media (max-width:640px){.proc-tab{display:block;overflow-x:auto}}'
    'code{overflow-wrap:anywhere}</style>'
)


def note(couleur, titre, corps):
    return (f'<aside class="pb-note pb-note-{couleur}"><p class="pb-note-title">{titre}</p>'
            f'<p>{corps}</p></aside>')


def etapes(*items):
    return '<ol class="proc-steps">' + ''.join(f'<li>{i}</li>' for i in items) + '</ol>'


def cmd(texte):
    return f'<div class="proc-cmd">{texte}</div>'


def page(pill, titre, sous_titre, corps):
    return (f'<section class="hero"><span class="pill">{pill}</span><h1>{titre}</h1>'
            f'<p>{sous_titre}</p></section>\n{STYLE}\n' + '\n'.join(corps))


# ═════════════════════════════════════════════════ Cisco / Packet Tracer ══

NAT = page(
    'Procédure · Cisco / Packet Tracer',
    'Configurer le NAT et le PAT',
    'Faire sortir un réseau privé vers l’extérieur : NAT statique, NAT dynamique et PAT (surcharge).',
    [
        note('blue', 'ℹ️ Avant de commencer',
             'Le routeur doit déjà router : interfaces montées, adresses posées, route par défaut vers '
             'le fournisseur. Vérifie-le avant de toucher au NAT, sinon tu chercheras une panne de NAT '
             'là où c’est le routage qui manque. Cours associé : '
             '<a href="/cisco-nat">NAT / PAT : la translation d’adresses</a>.'),
        '<h2>🧭 Poser le dedans et le dehors</h2>',
        '<p>Le NAT ne fait rien tant qu’on n’a pas dit au routeur quelle interface regarde le réseau '
        'privé et laquelle regarde l’extérieur. C’est l’étape qu’on oublie, et rien ne se traduit.</p>',
        cmd('enable\nconfigure terminal\n'
            'interface GigabitEthernet0/0\n ip address 192.168.10.254 255.255.255.0\n ip nat inside\n exit\n'
            'interface GigabitEthernet0/1\n ip address 203.0.113.2 255.255.255.252\n ip nat outside\n exit\n'
            'ip route 0.0.0.0 0.0.0.0 203.0.113.1'),
        '<h2>🔁 PAT — tout le réseau derrière une seule adresse publique</h2>',
        '<p>C’est le cas courant : une seule IP publique, des dizaines de postes derrière. Le routeur '
        'distingue les conversations par le <strong>numéro de port</strong> — d’où le nom.</p>',
        etapes(
            'Décris <strong>qui a le droit de sortir</strong> avec une liste d’accès.',
            'Associe cette liste à l’interface extérieure, avec le mot-clé <code>overload</code>.',
        ),
        cmd('access-list 1 permit 192.168.10.0 0.0.0.255\n'
            'ip nat inside source list 1 interface GigabitEthernet0/1 overload'),
        note('gray', '💡 Pourquoi <code>overload</code>',
             'Sans lui, le routeur ferait du NAT <em>dynamique</em> : une adresse publique par poste, '
             'jusqu’à épuisement du lot. Avec lui, il ajoute le port source à la traduction et fait '
             'tenir tout le réseau derrière une seule adresse.'),
        '<h2>📌 NAT statique — rendre un serveur joignable de l’extérieur</h2>',
        '<p>Une correspondance fixe, dans les deux sens. C’est ce qu’il faut pour un serveur web '
        'interne qu’on veut exposer.</p>',
        cmd('ip nat inside source static 192.168.10.20 203.0.113.20\n'
            '! ou seulement un port (redirection de port) :\n'
            'ip nat inside source static tcp 192.168.10.20 80 203.0.113.2 80'),
        '<h2>🎲 NAT dynamique — un lot d’adresses publiques</h2>',
        cmd('ip nat pool SORTIE 203.0.113.10 203.0.113.20 netmask 255.255.255.0\n'
            'access-list 1 permit 192.168.10.0 0.0.0.255\n'
            'ip nat inside source list 1 pool SORTIE'),
        '<h2>✅ Vérifier</h2>',
        cmd('show ip nat translations\nshow ip nat statistics\n'
            'show run | include ip nat\n'
            '! remettre les compteurs et la table à zéro pendant les essais :\n'
            'clear ip nat translation *'),
        '<p>Depuis un poste interne, un <code>ping</code> ou un accès web vers l’extérieur doit faire '
        'apparaître une ligne dans <code>show ip nat translations</code>. Si la table reste vide, le '
        'trafic ne traverse pas le routeur : reprends le <a href="/procedure-test-connectivite">test '
        'de connectivité méthodique</a>.</p>',
        note('yellow', '⚠️ Les trois pièges',
             '<strong>1.</strong> <code>ip nat inside</code> / <code>outside</code> oubliés sur une '
             'interface — cause numéro un. <strong>2.</strong> La liste d’accès du NAT décrit qui '
             '<em>peut sortir</em> : un <code>deny</code> y interdit la traduction, il ne filtre rien. '
             '<strong>3.</strong> Pas de route par défaut : la traduction se fait, le paquet part '
             'nulle part.'),
    ])

ACL = page(
    'Procédure · Cisco / Packet Tracer',
    'Configurer des listes de contrôle d’accès (ACL)',
    'Filtrer le trafic : liste standard, liste étendue, liste nommée — et surtout où les poser.',
    [
        note('blue', 'ℹ️ Avant de commencer',
             'Écris d’abord la règle en français : « les postes du VLAN 20 ne doivent pas joindre le '
             'serveur de compta en HTTP ». Une ACL rédigée sans cette phrase finit toujours par '
             'bloquer autre chose. Cours associé : '
             '<a href="/cisco-acl">Les ACL : filtrer le trafic</a>.'),
        '<h2>📏 Standard ou étendue : la règle de placement</h2>',
        '<table class="proc-tab"><tr><th>Type</th><th>Numéros</th><th>Ce qu’elle sait lire</th>'
        '<th>Où la poser</th></tr>'
        '<tr><td>Standard</td><td>1–99</td><td>L’adresse <strong>source</strong>, rien d’autre</td>'
        '<td>Au plus près de la <strong>destination</strong></td></tr>'
        '<tr><td>Étendue</td><td>100–199</td><td>Source, destination, protocole, port</td>'
        '<td>Au plus près de la <strong>source</strong></td></tr></table>',
        '<p>La raison est simple : une liste standard ne connaît que la source, donc la poser trop tôt '
        'couperait <em>tout</em> le trafic de cette source. Une liste étendue sait exactement quoi '
        'couper, autant le faire avant que le paquet ne traverse le réseau pour rien.</p>',
        '<h2>1️⃣ Liste standard</h2>',
        cmd('access-list 10 deny 192.168.20.0 0.0.0.255\n'
            'access-list 10 permit any\n'
            'interface GigabitEthernet0/0\n ip access-group 10 out'),
        '<h2>2️⃣ Liste étendue</h2>',
        cmd('access-list 110 deny tcp 192.168.20.0 0.0.0.255 host 192.168.10.20 eq 80\n'
            'access-list 110 deny tcp 192.168.20.0 0.0.0.255 host 192.168.10.20 eq 443\n'
            'access-list 110 permit ip any any\n'
            'interface GigabitEthernet0/1\n ip access-group 110 in'),
        '<h2>3️⃣ Liste nommée — celle qu’on relit dans six mois</h2>',
        '<p>Une liste nommée se modifie ligne par ligne, là où une liste numérotée doit être effacée et '
        'refaite en entier. Sur un équipement en service, c’est ce qui évite une coupure.</p>',
        cmd('ip access-list extended BLOQUE-COMPTA\n'
            ' 10 deny tcp 192.168.20.0 0.0.0.255 host 192.168.10.20 eq 80\n'
            ' 20 permit ip any any\n exit\n'
            'interface GigabitEthernet0/1\n ip access-group BLOQUE-COMPTA in\n exit\n'
            '! retirer UNE ligne sans toucher au reste :\n'
            'ip access-list extended BLOQUE-COMPTA\n no 10'),
        '<h2>🎭 Le masque générique (wildcard)</h2>',
        '<p>C’est l’inverse du masque de sous-réseau : un <strong>0</strong> signifie « ce bit doit '
        'correspondre », un <strong>1</strong> « peu importe ».</p>',
        '<table class="proc-tab"><tr><th>Ce qu’on veut viser</th><th>Écriture</th></tr>'
        '<tr><td>Tout le réseau 192.168.20.0/24</td><td><code>192.168.20.0 0.0.0.255</code></td></tr>'
        '<tr><td>Une seule machine</td><td><code>host 192.168.20.15</code></td></tr>'
        '<tr><td>N’importe qui</td><td><code>any</code></td></tr></table>',
        '<h2>✅ Vérifier</h2>',
        cmd('show access-lists\n'
            'show ip interface GigabitEthernet0/1 | include access list\n'
            '! remettre les compteurs de correspondance à zéro avant un test :\n'
            'clear access-list counters'),
        '<p>Les compteurs de <code>show access-lists</code> disent quelles lignes ont réellement servi. '
        'Une ligne à zéro alors que le test tourne : elle n’est pas atteinte, ou la liste n’est pas '
        'appliquée dans le bon sens.</p>',
        note('yellow', '⚠️ Le <code>deny any</code> invisible',
             'Toute ACL se termine par un refus implicite que rien n’affiche. Une liste qui ne contient '
             'que des <code>deny</code> bloque donc <strong>tout</strong> le reste. Il faut presque '
             'toujours finir par <code>permit ip any any</code>.'),
        note('red', '🚨 Sur un équipement à distance',
             'Une ACL posée en <code>in</code> sur l’interface par laquelle tu es connecté peut te '
             'couper la ligne. Prépare la commande de retrait avant de valider, et sur un vrai '
             'équipement, arme un <code>reload in 5</code>.'),
    ])

VTP = page(
    'Procédure · Cisco / Packet Tracer',
    'Propager les VLAN avec VTP',
    'Déclarer les VLAN une fois sur le switch serveur et les voir arriver sur les autres.',
    [
        note('blue', 'ℹ️ Avant de commencer',
             'VTP ne propage <strong>que la liste des VLAN</strong>. Il ne configure aucun port en '
             'accès : ça reste à faire switch par switch. Cours associé : '
             '<a href="/vlan-vtp">VTP : propager les VLAN entre switches</a>.'),
        '<h2>🔗 D’abord les liens entre switches</h2>',
        '<p>VTP ne circule que sur des liaisons <strong>trunk</strong>. Tant que le lien inter-switch '
        'est en mode accès, rien ne se propage — et c’est la panne la plus fréquente.</p>',
        cmd('interface GigabitEthernet0/1\n switchport mode trunk\n'
            ' switchport trunk allowed vlan 10,20,999\n exit'),
        '<h2>🖥️ Le switch serveur</h2>',
        etapes(
            'Nomme le domaine VTP — il doit être <strong>identique au caractère près</strong> partout.',
            'Pose un mot de passe : sans lui, n’importe quel switch branché rejoint le domaine.',
            'Déclare les VLAN une seule fois, ici.',
        ),
        cmd('vtp domain MIYUKINI\nvtp password Tssr2026\nvtp mode server\nvtp version 2\n'
            'vlan 10\n name ADMIN\nvlan 20\n name BUREAUX\nvlan 999\n name NATIF-MORT'),
        '<h2>💻 Les switches clients</h2>',
        cmd('vtp domain MIYUKINI\nvtp password Tssr2026\nvtp mode client'),
        '<p>Sur un client, <code>vlan 30</code> est refusé : c’est normal et voulu. La liste ne se '
        'modifie que sur le serveur.</p>',
        '<h2>✅ Vérifier</h2>',
        cmd('show vtp status\nshow vtp password\nshow vlan brief\nshow interfaces trunk'),
        '<p>Sur chaque switch, <code>show vtp status</code> doit afficher le même <em>domaine</em>, le '
        'même <em>numéro de révision</em>, et <code>show vlan brief</code> la même liste.</p>',
        note('red', '🚨 Le numéro de révision — le piège qui efface un réseau',
             'Un switch qui rejoint le domaine avec un <strong>numéro de révision plus élevé</strong> '
             'impose SA base de VLAN à tout le monde, y compris au serveur. Un switch récupéré d’une '
             'autre salle peut ainsi effacer tous les VLAN en production. Avant de le brancher, '
             'remets-le à zéro : passe-le en <code>vtp mode transparent</code> puis reviens en '
             '<code>client</code>, ou change son domaine et reviens — dans les deux cas la révision '
             'retombe à 0. Vérifie avec <code>show vtp status</code> AVANT de connecter le câble.'),
        note('gray', '💡 Le mode transparent',
             'Un switch transparent ne participe pas au domaine mais <em>relaie</em> les annonces. '
             'C’est le mode à choisir pour un switch qui a ses propres VLAN locaux.'),
    ])

VLAN_SECU = page(
    'Procédure · Sécurité',
    'Sécuriser les VLAN d’un commutateur',
    'Port-security, VLAN natif dédié et ports inutilisés : les trois gestes qui ferment un switch.',
    [
        note('blue', 'ℹ️ Avant de commencer',
             'Les VLAN doivent déjà exister et les ports être affectés. On ne sécurise pas un réseau '
             'qu’on n’a pas encore fait marcher. Cours associé : '
             '<a href="/vlan-securite">Sécuriser les VLAN</a>.'),
        '<h2>1️⃣ Port-security — limiter qui se branche</h2>',
        '<p>Le principe : le switch apprend les adresses MAC autorisées sur un port et refuse les '
        'autres. C’est ce qui empêche quelqu’un de débrancher une imprimante pour brancher son '
        'portable.</p>',
        cmd('interface range FastEthernet0/1-20\n'
            ' switchport mode access\n'
            ' switchport access vlan 20\n'
            ' switchport port-security\n'
            ' switchport port-security maximum 2\n'
            ' switchport port-security mac-address sticky\n'
            ' switchport port-security violation restrict\n exit'),
        '<table class="proc-tab"><tr><th>Réglage</th><th>Ce qu’il fait</th></tr>'
        '<tr><td><code>maximum 2</code></td><td>Deux MAC : le poste et le téléphone IP devant lui. '
        'À 1, tout téléphone en cascade coupe le port.</td></tr>'
        '<tr><td><code>sticky</code></td><td>Le switch apprend la MAC et l’écrit dans sa configuration. '
        'Plus besoin de les saisir à la main.</td></tr>'
        '<tr><td><code>restrict</code></td><td>Rejette les trames et compte l’incident, mais laisse le '
        'port vivant.</td></tr></table>',
        note('gray', '💡 Pourquoi <code>restrict</code> plutôt que <code>shutdown</code>',
             '<code>shutdown</code> éteint le port et exige un passage sur place pour le relever. En '
             'salle comme en production, c’est un appel au support pour un téléphone déplacé. '
             '<code>restrict</code> protège autant et se diagnostique à distance.'),
        '<h2>2️⃣ Un VLAN natif dédié</h2>',
        '<p>Le VLAN natif d’un trunk circule <strong>sans étiquette</strong>. Le laisser sur le VLAN 1 '
        'ouvre la porte au saut de VLAN par double étiquetage. On lui donne un VLAN à lui, qui ne sert '
        'à rien d’autre.</p>',
        cmd('vlan 999\n name NATIF-MORT\n exit\n'
            'interface GigabitEthernet0/1\n'
            ' switchport trunk native vlan 999\n'
            ' switchport trunk allowed vlan 10,20\n exit'),
        '<h2>3️⃣ Les ports inutilisés</h2>',
        '<p>Un port libre et actif dans le VLAN 1, c’est une prise ouverte dans un couloir.</p>',
        cmd('interface range FastEthernet0/21-24\n'
            ' switchport mode access\n'
            ' switchport access vlan 999\n'
            ' shutdown\n exit'),
        '<h2>✅ Vérifier</h2>',
        cmd('show port-security\n'
            'show port-security interface FastEthernet0/1\n'
            'show interfaces trunk\n'
            'show interfaces status\n'
            '! après un incident, relever un port bloqué :\n'
            'interface FastEthernet0/1\n shutdown\n no shutdown'),
        '<p><code>show interfaces trunk</code> doit afficher le VLAN natif 999 <strong>des deux '
        'côtés</strong> du lien, et la liste des VLAN autorisés réduite à ce qui est utile.</p>',
        note('yellow', '⚠️ Le VLAN natif doit correspondre aux deux bouts',
             'Un natif 999 d’un côté et 1 de l’autre : le switch le signale en boucle dans ses journaux '
             '(<em>native VLAN mismatch</em>) et le trafic non étiqueté part dans le mauvais VLAN. '
             'Configure toujours les deux extrémités dans la foulée.'),
    ])

# ══════════════════════════════════════════════════════════════ Linux ══

SAMBA = page(
    'Procédure · Linux',
    'Partager des fichiers vers Windows avec Samba',
    'Monter un partage réseau sur Debian, accessible depuis l’Explorateur Windows.',
    [
        note('blue', 'ℹ️ Avant de commencer',
             'Serveur Debian 12 à jour, IP fixe posée, et un nom résolu par le DNS si tu veux y accéder '
             'autrement que par l’adresse. Cours associé : '
             '<a href="/linux-samba">Samba : partager des fichiers vers Windows</a>.'),
        '<h2>📦 Installer</h2>',
        cmd('sudo apt update\nsudo apt install -y samba\nsystemctl status smbd --no-pager'),
        '<h2>📁 Préparer le dossier et ses droits</h2>',
        '<p>Les droits Linux s’appliquent <strong>avant</strong> ceux de Samba. Un partage ouvert sur un '
        'dossier fermé ne donne rien : commence toujours par le système de fichiers.</p>',
        cmd('sudo mkdir -p /srv/partage/commun\n'
            'sudo groupadd -f partage\n'
            'sudo chgrp -R partage /srv/partage/commun\n'
            'sudo chmod 2775 /srv/partage/commun'),
        note('gray', '💡 Le <code>2</code> de <code>2775</code>',
             'C’est le bit <strong>setgid</strong> : tout fichier créé dans le dossier hérite du groupe '
             '<code>partage</code> au lieu du groupe de celui qui l’a créé. Sans lui, deux personnes '
             'd’équipes différentes finissent par ne plus pouvoir se relire.'),
        '<h2>⚙️ Déclarer le partage</h2>',
        '<p>À la fin de <code>/etc/samba/smb.conf</code> :</p>',
        cmd('[commun]\n'
            '   comment = Partage commun\n'
            '   path = /srv/partage/commun\n'
            '   browseable = yes\n'
            '   read only = no\n'
            '   valid users = @partage\n'
            '   create mask = 0664\n'
            '   directory mask = 2775'),
        '<h2>👤 Les comptes Samba</h2>',
        '<p>Samba tient <strong>ses propres mots de passe</strong> : un compte Linux ne suffit pas.</p>',
        cmd('sudo useradd -M -s /usr/sbin/nologin alice\n'
            'sudo usermod -aG partage alice\n'
            'sudo smbpasswd -a alice\n'
            'sudo smbpasswd -e alice'),
        '<h2>🚀 Appliquer</h2>',
        cmd('sudo testparm\nsudo systemctl restart smbd nmbd\nsudo systemctl enable smbd nmbd'),
        '<h2>✅ Vérifier</h2>',
        cmd('# depuis le serveur\nsmbclient -L //localhost -U alice\n'
            '# depuis un poste Linux\nsmbclient //192.168.10.30/commun -U alice\n'
            '# côté Windows : dans l’Explorateur\n\\\\192.168.10.30\\commun'),
        note('yellow', '⚠️ Les deux pièges',
             '<strong>1.</strong> <code>testparm</code> avant tout redémarrage : il relit la '
             'configuration et signale les fautes de frappe, là où un service redémarré se contente de '
             'ne pas fonctionner. <strong>2.</strong> Le mot de passe Samba est indépendant du mot de '
             'passe Linux — le changer d’un côté ne le change pas de l’autre.'),
        note('gray', '🔍 Quand rien ne marche',
             'Regarde les journaux : <code>sudo tail -f /var/log/samba/log.smbd</code>. Puis vérifie le '
             'pare-feu du serveur et, si le poste Windows refuse la connexion, qu’il n’a pas gardé en '
             'cache d’anciens identifiants (<code>net use * /delete</code>).'),
    ])

APACHE = page(
    'Procédure · Hébergement',
    'Héberger un site avec Apache sous Debian',
    'Installer Apache, créer un hôte virtuel et servir un site sur son propre nom.',
    [
        note('blue', 'ℹ️ Avant de commencer',
             'Debian 12, IP fixe, et un enregistrement DNS pointant vers le serveur si tu veux un vrai '
             'nom. Cours associés : <a href="/linux-apache">Apache : héberger un site web sous '
             'Linux</a> et <a href="/hebergement-web">L’hébergement web</a>.'),
        '<h2>📦 Installer</h2>',
        cmd('sudo apt update\nsudo apt install -y apache2\n'
            'systemctl status apache2 --no-pager\n'
            '# la page par défaut doit répondre :\ncurl -I http://localhost'),
        '<h2>📁 Le dossier du site</h2>',
        cmd('sudo mkdir -p /var/www/intranet\n'
            "echo '<h1>Intranet Miyukini</h1>' | sudo tee /var/www/intranet/index.html\n"
            'sudo chown -R www-data:www-data /var/www/intranet'),
        '<h2>⚙️ L’hôte virtuel</h2>',
        '<p>Un <em>hôte virtuel</em> permet de servir plusieurs sites depuis la même adresse : Apache '
        'choisit d’après le nom demandé. Crée '
        '<code>/etc/apache2/sites-available/intranet.conf</code> :</p>',
        cmd('&lt;VirtualHost *:80&gt;\n'
            '    ServerName intranet.miyukini.lan\n'
            '    DocumentRoot /var/www/intranet\n\n'
            '    &lt;Directory /var/www/intranet&gt;\n'
            '        Options -Indexes +FollowSymLinks\n'
            '        AllowOverride None\n'
            '        Require all granted\n'
            '    &lt;/Directory&gt;\n\n'
            '    ErrorLog ${APACHE_LOG_DIR}/intranet-error.log\n'
            '    CustomLog ${APACHE_LOG_DIR}/intranet-access.log combined\n'
            '&lt;/VirtualHost&gt;'),
        note('gray', '💡 <code>Options -Indexes</code>',
             'Sans lui, un dossier sans <code>index.html</code> affiche la liste de son contenu à '
             'n’importe quel visiteur. C’est la fuite d’information la plus banale d’un serveur web.'),
        '<h2>🚀 Activer</h2>',
        etapes(
            '<code>a2ensite intranet</code> — active le site (crée le lien dans <code>sites-enabled</code>).',
            '<code>a2dissite 000-default</code> — désactive la page d’accueil de Debian, sinon elle '
            'répond à toute requête qui ne correspond à aucun nom.',
            '<code>apache2ctl configtest</code> — <strong>toujours</strong> avant de recharger.',
            '<code>systemctl reload apache2</code> — recharge sans couper les connexions en cours.',
        ),
        cmd('sudo a2ensite intranet\nsudo a2dissite 000-default\n'
            'sudo apache2ctl configtest\nsudo systemctl reload apache2'),
        '<h2>✅ Vérifier</h2>',
        cmd('curl -H "Host: intranet.miyukini.lan" http://127.0.0.1\n'
            'sudo tail -f /var/log/apache2/intranet-access.log\n'
            'sudo ss -tlnp | grep :80'),
        '<p>L’en-tête <code>Host</code> forcé permet de tester l’hôte virtuel <strong>avant</strong> que '
        'le DNS ne soit prêt : c’est ce qui sépare un problème Apache d’un problème de résolution.</p>',
        note('yellow', '⚠️ <code>reload</code> et non <code>restart</code>',
             '<code>restart</code> coupe toutes les connexions en cours ; <code>reload</code> laisse '
             'finir les requêtes commencées. Sur un serveur en service, l’un se voit et l’autre non.'),
        note('gray', '🔍 Erreur 403 ?',
             'Trois causes, dans cet ordre : le <code>Require all granted</code> manquant, les droits '
             'Unix du dossier (<code>www-data</code> doit pouvoir traverser <em>tous</em> les dossiers '
             'parents), et l’absence d’<code>index.html</code> avec <code>-Indexes</code>.'),
        note('green', '🎓 Au-delà d’un site',
             'Plusieurs sites sur la même machine, une page d’ouverture au nom choisi, des pages '
             'd’erreur, un site réservé à une adresse ou servi en HTTPS : le cours '
             '<a href="/linux-apache-virtualhosts"><strong>Apache : hôtes virtuels, pages par '
             'défaut et HTTPS</strong></a>. Et le corrigé du TP correspondant : '
             '<a href="/tp-apache-virtualhosts">TP hôtes virtuels</a>.'),
    ])

LVM = page(
    'Procédure · Linux',
    'Ajouter un disque et le gérer en LVM',
    'Du disque brut au dossier monté : partition, volume physique, groupe, volume logique, fstab.',
    [
        note('blue', 'ℹ️ Avant de commencer',
             'Un disque supplémentaire attaché à la machine (Hyper-V : ajoute-le à chaud, il apparaît '
             'sans redémarrer). Cours associé : '
             '<a href="/linux-disques">Linux : disques, partitions et LVM</a>.'),
        note('red', '🚨 Identifie le bon disque AVANT toute commande',
             'Une commande de partitionnement sur <code>/dev/sda</code> au lieu de <code>/dev/sdb</code> '
             'détruit le système en une seconde et sans confirmation. Vérifie la taille et l’absence de '
             'point de montage.'),
        cmd('lsblk -f\nsudo fdisk -l | head -40'),
        '<h2>1️⃣ Partitionner</h2>',
        cmd('sudo parted /dev/sdb --script mklabel gpt\n'
            'sudo parted /dev/sdb --script mkpart primary 0% 100%\n'
            'sudo parted /dev/sdb --script set 1 lvm on\n'
            'lsblk /dev/sdb'),
        '<h2>2️⃣ Les trois étages de LVM</h2>',
        '<table class="proc-tab"><tr><th>Étage</th><th>Ce que c’est</th><th>Commande</th></tr>'
        '<tr><td>Volume physique (PV)</td><td>Un disque ou une partition offerts à LVM</td>'
        '<td><code>pvcreate</code></td></tr>'
        '<tr><td>Groupe de volumes (VG)</td><td>Le réservoir : un ou plusieurs PV mis en commun</td>'
        '<td><code>vgcreate</code></td></tr>'
        '<tr><td>Volume logique (LV)</td><td>La « partition » qu’on formate et qu’on monte</td>'
        '<td><code>lvcreate</code></td></tr></table>',
        '<p>Tout l’intérêt est là : le volume logique n’est plus prisonnier d’un disque. On agrandit le '
        'réservoir en y ajoutant un disque, puis le volume, <strong>sans démonter ni redémarrer</strong>.</p>',
        cmd('sudo apt install -y lvm2\n'
            'sudo pvcreate /dev/sdb1\n'
            'sudo vgcreate vg-donnees /dev/sdb1\n'
            'sudo lvcreate -L 10G -n lv-partage vg-donnees\n'
            'sudo lvs && sudo vgs && sudo pvs'),
        '<h2>3️⃣ Formater et monter</h2>',
        cmd('sudo mkfs.ext4 /dev/vg-donnees/lv-partage\n'
            'sudo mkdir -p /srv/partage\n'
            'sudo mount /dev/vg-donnees/lv-partage /srv/partage\n'
            'df -h /srv/partage'),
        '<h2>4️⃣ Rendre le montage permanent</h2>',
        '<p>On monte par <strong>UUID</strong>, jamais par <code>/dev/sdb1</code> : l’ordre des disques '
        'peut changer d’un démarrage à l’autre, l’UUID non.</p>',
        cmd('sudo blkid /dev/vg-donnees/lv-partage\n'
            '# ajouter dans /etc/fstab :\n'
            'UUID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx  /srv/partage  ext4  defaults  0  2\n'
            '# puis, IMPÉRATIVEMENT :\n'
            'sudo mount -a'),
        note('red', '🚨 <code>mount -a</code> avant de redémarrer',
             'Une faute de frappe dans <code>/etc/fstab</code> empêche le serveur de démarrer et exige '
             'un accès console pour le réparer. <code>mount -a</code> rejoue le fichier tout de suite : '
             's’il ne dit rien, le démarrage se passera bien.'),
        '<h2>📈 Agrandir plus tard</h2>',
        cmd('# ajouter un disque au réservoir\nsudo pvcreate /dev/sdc1\n'
            'sudo vgextend vg-donnees /dev/sdc1\n'
            '# agrandir le volume ET son système de fichiers, à chaud\n'
            'sudo lvextend -L +5G /dev/vg-donnees/lv-partage\n'
            'sudo resize2fs /dev/vg-donnees/lv-partage\n'
            'df -h /srv/partage'),
        note('yellow', '⚠️ Deux opérations, pas une',
             'Agrandir le volume logique ne suffit pas : le système de fichiers, lui, ignore la place '
             'nouvelle tant qu’on ne l’a pas étendu (<code>resize2fs</code> pour ext4, '
             '<code>xfs_growfs</code> pour XFS). Le raccourci <code>lvextend -r</code> fait les deux.'),
        '<h2>✅ Vérifier</h2>',
        cmd('lsblk -f\ndf -h\nsudo vgs\nsudo lvs\nfindmnt /srv/partage'),
    ])

SYSTEMD = page(
    'Procédure · Linux',
    'Créer et gérer un service systemd',
    'Faire tourner un programme au démarrage, le surveiller, et lire ses journaux.',
    [
        note('blue', 'ℹ️ Avant de commencer',
             'Ton programme doit déjà fonctionner quand tu le lances à la main. Un service systemd '
             'n’est qu’un emballage : il ne répare pas un script qui plante. Cours associé : '
             '<a href="/linux-systemd">systemd : services, démarrage et unités</a>.'),
        '<h2>📝 Le script</h2>',
        cmd('sudo nano /usr/local/bin/sauvegarde.sh\n'
            '#!/bin/bash\nset -euo pipefail\n'
            'rsync -a --delete /srv/partage/ /srv/sauvegardes/partage/\n'
            '# puis :\nsudo chmod +x /usr/local/bin/sauvegarde.sh\n'
            'sudo -u sauvegarde /usr/local/bin/sauvegarde.sh   # essai à la main'),
        '<h2>⚙️ L’unité</h2>',
        '<p><code>/etc/systemd/system/sauvegarde.service</code> :</p>',
        cmd('[Unit]\n'
            'Description=Sauvegarde des partages\n'
            'After=network-online.target\n'
            'Wants=network-online.target\n\n'
            '[Service]\n'
            'Type=oneshot\n'
            'User=sauvegarde\n'
            'ExecStart=/usr/local/bin/sauvegarde.sh\n\n'
            '[Install]\n'
            'WantedBy=multi-user.target'),
        '<table class="proc-tab"><tr><th>Directive</th><th>Ce qu’elle décide</th></tr>'
        '<tr><td><code>Type=oneshot</code></td><td>Le programme se termine — c’est normal. Pour un '
        'démon qui reste en vie, c’est <code>Type=simple</code>.</td></tr>'
        '<tr><td><code>User=</code></td><td>Sans elle, le service tourne en <strong>root</strong>. '
        'On donne toujours le compte le moins puissant qui suffit.</td></tr>'
        '<tr><td><code>After=</code> / <code>Wants=</code></td><td>L’ordre de démarrage. '
        '<code>network-online</code> attend une adresse IP, <code>network</code> ne l’attend pas.</td></tr>'
        '<tr><td><code>WantedBy=</code></td><td>À quel moment le service doit s’activer. Sans section '
        '<code>[Install]</code>, <code>enable</code> ne sert à rien.</td></tr></table>',
        '<h2>🚀 Activer</h2>',
        etapes(
            '<code>systemctl daemon-reload</code> — <strong>obligatoire</strong> après toute création ou '
            'modification d’unité : systemd relit ses fichiers.',
            '<code>systemctl enable --now sauvegarde.service</code> — active au démarrage '
            '<em>et</em> lance tout de suite.',
            '<code>systemctl status</code> — lit le résultat.',
        ),
        cmd('sudo systemctl daemon-reload\n'
            'sudo systemctl enable --now sauvegarde.service\n'
            'systemctl status sauvegarde.service --no-pager'),
        '<h2>⏰ Le déclencher périodiquement</h2>',
        '<p>Un <em>timer</em> remplace avantageusement cron : il se surveille avec les mêmes outils que '
        'le service, et rattrape les exécutions manquées si la machine était éteinte. '
        '<code>/etc/systemd/system/sauvegarde.timer</code> :</p>',
        cmd('[Unit]\nDescription=Sauvegarde quotidienne\n\n'
            '[Timer]\nOnCalendar=*-*-* 02:00:00\nPersistent=true\n\n'
            '[Install]\nWantedBy=timers.target\n\n'
            '# puis\nsudo systemctl daemon-reload\n'
            'sudo systemctl enable --now sauvegarde.timer\n'
            'systemctl list-timers --all | grep sauvegarde'),
        '<h2>✅ Vérifier et diagnostiquer</h2>',
        cmd('systemctl status sauvegarde.service --no-pager\n'
            'journalctl -u sauvegarde.service -n 50 --no-pager\n'
            'journalctl -u sauvegarde.service -f          # en direct\n'
            'systemd-analyze verify /etc/systemd/system/sauvegarde.service'),
        note('yellow', '⚠️ Les trois oublis classiques',
             '<strong>1.</strong> <code>daemon-reload</code> non fait : systemd exécute encore '
             'l’ancienne version. <strong>2.</strong> <code>start</code> confondu avec '
             '<code>enable</code> : le premier lance maintenant, le second au prochain démarrage. '
             '<strong>3.</strong> Un chemin relatif dans <code>ExecStart</code> : systemd n’a pas ton '
             '<code>PATH</code>, tout doit être absolu.'),
    ])

CRON = page(
    'Procédure · Linux',
    'Planifier avec cron et lire les journaux',
    'Programmer une tâche récurrente, capturer sa sortie, et retrouver ce qui s’est passé.',
    [
        note('blue', 'ℹ️ Avant de commencer',
             'Le script doit tourner correctement lancé à la main, avec le compte qui l’exécutera. '
             'Cours associé : <a href="/linux-cron-logs">Linux : planification (cron) & journaux</a>.'),
        '<h2>🕐 Lire une ligne de cron</h2>',
        cmd('┌─── minute (0-59)\n│ ┌─── heure (0-23)\n│ │ ┌─── jour du mois (1-31)\n'
            '│ │ │ ┌─── mois (1-12)\n│ │ │ │ ┌─── jour de la semaine (0-7, 0 et 7 = dimanche)\n'
            '│ │ │ │ │\n0 2 * * *   /usr/local/bin/sauvegarde.sh'),
        '<table class="proc-tab"><tr><th>Écriture</th><th>Quand</th></tr>'
        '<tr><td><code>0 2 * * *</code></td><td>Tous les jours à 2 h 00</td></tr>'
        '<tr><td><code>*/15 * * * *</code></td><td>Toutes les 15 minutes</td></tr>'
        '<tr><td><code>0 8 * * 1-5</code></td><td>À 8 h, du lundi au vendredi</td></tr>'
        '<tr><td><code>@reboot</code></td><td>À chaque démarrage</td></tr></table>',
        '<h2>👤 Cron d’un utilisateur</h2>',
        cmd('crontab -e          # édite le sien\ncrontab -l          # le liste\n'
            'sudo crontab -u sauvegarde -l   # celui d’un autre'),
        '<h2>🖥️ Cron système</h2>',
        '<p>Un fichier dans <code>/etc/cron.d/</code> se versionne et se déploie, là où un '
        '<code>crontab -e</code> vit dans un coin invisible. Attention : il comporte un champ de plus, '
        '<strong>l’utilisateur</strong>.</p>',
        cmd('sudo nano /etc/cron.d/sauvegarde\n\n'
            'SHELL=/bin/bash\n'
            'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\n'
            'MAILTO=""\n\n'
            '0 2 * * *  sauvegarde  /usr/local/bin/sauvegarde.sh >> /var/log/sauvegarde.log 2>&1'),
        note('yellow', '⚠️ Cron n’a pas ton environnement',
             'Il démarre avec un <code>PATH</code> minimal, sans tes variables ni ton '
             '<code>.bashrc</code>. Un script qui marche dans ton terminal peut échouer sous cron pour '
             'cette seule raison. Deux règles : <strong>chemins absolus partout</strong>, et '
             'déclare <code>PATH</code> en tête du fichier.'),
        note('gray', '💡 <code>&gt;&gt; fichier 2&gt;&amp;1</code>',
             'Sans redirection, la sortie du script part par courriel local que personne ne lit — et '
             'l’erreur reste invisible. <code>2&gt;&amp;1</code> capture aussi le canal d’erreur, celui '
             'qui contient justement ce qu’on veut savoir.'),
        '<h2>📜 Retrouver ce qui s’est passé</h2>',
        cmd('# cron a-t-il lancé la tâche ?\ngrep CRON /var/log/syslog | tail -20\n'
            'journalctl -u cron --since "today" --no-pager\n\n'
            '# le journal du script lui-même\ntail -f /var/log/sauvegarde.log\n\n'
            '# les erreurs de tout le système\njournalctl -p err --since "-1h" --no-pager\n'
            'journalctl --since "2026-09-01" --until "2026-09-02"'),
        '<h2>♻️ Éviter le journal qui remplit le disque</h2>',
        '<p><code>/etc/logrotate.d/sauvegarde</code> :</p>',
        cmd('/var/log/sauvegarde.log {\n'
            '    weekly\n    rotate 8\n    compress\n    missingok\n    notifempty\n'
            '    create 0640 sauvegarde adm\n}\n\n'
            '# essai à blanc\nsudo logrotate -d /etc/logrotate.d/sauvegarde'),
        '<h2>✅ Vérifier</h2>',
        etapes(
            'Programme la tâche <strong>deux minutes plus tard</strong> et attends : c’est le seul essai '
            'qui prouve quelque chose.',
            'Contrôle que cron l’a lancée (<code>grep CRON /var/log/syslog</code>).',
            'Contrôle le journal du script : lancée n’est pas réussie.',
            'Remets ensuite l’horaire définitif.',
        ),
    ])

# ═══════════════════════════════════════════════════ Windows / AD ══

PARTAGE_NTFS = page(
    'Procédure · Windows Server',
    'Créer un partage et régler les permissions (partage + NTFS)',
    'Les deux couches d’autorisations, et pourquoi c’est toujours la plus restrictive qui gagne.',
    [
        note('blue', 'ℹ️ Avant de commencer',
             'Les groupes doivent exister dans l’annuaire, idéalement selon '
             '<a href="/procedure-agdlp">AGDLP</a> : on donne les droits à un groupe de domaine local, '
             'et on y met les groupes globaux. Cours associé : '
             '<a href="/permissions-partage-ntfs">Les permissions : Partage & NTFS</a>.'),
        '<h2>🧠 Deux couches, une seule règle</h2>',
        '<p>Un accès réseau traverse <strong>deux</strong> jeux d’autorisations. Ce qui s’applique est '
        '<strong>l’intersection</strong> : la plus restrictive des deux.</p>',
        '<table class="proc-tab"><tr><th>Couche</th><th>Portée</th><th>Ce qu’on y met</th></tr>'
        '<tr><td>Partage</td><td>Accès <strong>par le réseau</strong> uniquement</td>'
        '<td>« Utilisateurs authentifiés » = Contrôle total</td></tr>'
        '<tr><td>NTFS</td><td>Le dossier, <strong>quel que soit le chemin d’accès</strong></td>'
        '<td>Les vrais droits, groupe par groupe</td></tr></table>',
        note('gray', '💡 Pourquoi ouvrir le partage en grand',
             'Régler les deux couches revient à tenir deux listes qui doivent rester d’accord — et un '
             'jour elles ne le sont plus, sans que rien ne l’indique. On ouvre donc le partage et on '
             'règle tout en NTFS : une seule liste, celle qui s’applique aussi en local.'),
        '<h2>1️⃣ Le dossier et le partage</h2>',
        etapes(
            'Crée <code>D:\\Partages\\Compta</code> — jamais sur le disque système.',
            '<strong>Clic droit</strong> → Propriétés → onglet <strong>Partage</strong> → '
            '<strong>Partage avancé…</strong>',
            'Coche <em>Partager ce dossier</em>. Nomme-le <code>Compta$</code> : le '
            '<strong>$</strong> le rend invisible dans le voisinage réseau (il reste joignable par son '
            'chemin).',
            '<strong>Autorisations</strong> → retire <em>Tout le monde</em>, ajoute '
            '<em>Utilisateurs authentifiés</em> avec <strong>Contrôle total</strong>.',
        ),
        '<h2>2️⃣ Les droits NTFS</h2>',
        etapes(
            'Onglet <strong>Sécurité</strong> → <strong>Avancé</strong>.',
            '<strong>Désactiver l’héritage</strong> → <em>Convertir les autorisations héritées en '
            'autorisations explicites</em>. Sans cette étape, les droits venus de la racine restent et '
            'tout le monde lit tout.',
            'Retire le groupe <em>Utilisateurs</em>.',
            'Garde <em>SYSTEM</em> et <em>Administrateurs</em> en Contrôle total — sinon les sauvegardes '
            'et l’administration ne passent plus.',
            'Ajoute <code>GL-Compta-Modifier</code> → <strong>Modification</strong>.',
            'Ajoute <code>GL-Compta-Lecture</code> → <strong>Lecture &amp; exécution</strong>.',
        ),
        '<h2>⌨️ En PowerShell</h2>',
        cmd('New-Item -ItemType Directory -Path D:\\Partages\\Compta\n'
            'New-SmbShare -Name "Compta$" -Path D:\\Partages\\Compta '
            '-FullAccess "Utilisateurs authentifiés"\n\n'
            '$acl = Get-Acl D:\\Partages\\Compta\n'
            '$acl.SetAccessRuleProtection($true, $true)   # coupe l’héritage, en conservant l’existant\n'
            '$regle = New-Object System.Security.AccessControl.FileSystemAccessRule(\n'
            '    "MIYUKINI\\GL-Compta-Modifier", "Modify", "ContainerInherit,ObjectInherit", "None", "Allow")\n'
            '$acl.AddAccessRule($regle)\n'
            'Set-Acl D:\\Partages\\Compta $acl'),
        '<h2>✅ Vérifier</h2>',
        cmd('net share\nGet-SmbShare\nGet-SmbShareAccess -Name "Compta$"\n'
            'Get-Acl D:\\Partages\\Compta | Format-List'),
        '<p>Puis, et c’est le seul contrôle qui compte : onglet <strong>Sécurité → Avancé → Accès '
        'effectif</strong>, choisis un utilisateur réel et lis ce qu’il obtient. Termine par un essai '
        'depuis un poste client avec son compte à lui.</p>',
        note('yellow', '⚠️ Un refus l’emporte toujours',
             'Une autorisation <strong>Refuser</strong> bat toutes les autorisations accordées, y '
             'compris par un autre groupe. On ne s’en sert quasiment jamais : on retire le groupe de la '
             'liste plutôt que de lui refuser explicitement.'),
        note('gray', '🔍 « Accès refusé » alors que les droits semblent bons',
             'L’utilisateur porte encore son ancien jeton d’accès : les groupes ne sont relus qu’à '
             'l’ouverture de session. Fais-le se déconnecter et se reconnecter — pas seulement '
             'verrouiller.'),
    ])

LECTEUR_GPO = page(
    'Procédure · Active Directory',
    'Monter un lecteur réseau par GPO',
    'Distribuer un lecteur S: à un groupe précis, sans script de connexion.',
    [
        note('blue', 'ℹ️ Avant de commencer',
             'Le partage doit exister et être accessible (voir '
             '<a href="/procedure-partage-ntfs">Créer un partage et régler les permissions</a>), et les '
             'utilisateurs être rangés dans une UO. Cours associé : '
             '<a href="/lecteurs-reseau">Les lecteurs réseau</a>.'),
        note('gray', '💡 Préférence, pas paramètre',
             'On passe par les <strong>Préférences</strong> de stratégie de groupe, pas par un script '
             'd’ouverture de session. Un script s’écrit, se teste et se débogue ; une préférence se lit '
             'dans la console, se cible par groupe et se retire proprement.'),
        '<h2>1️⃣ Créer la stratégie</h2>',
        etapes(
            'Ouvre la <strong>Gestion de stratégie de groupe</strong> (<code>gpmc.msc</code>).',
            'Clic droit sur l’<strong>UO qui contient les utilisateurs</strong> → <em>Créer un objet GPO '
            'dans ce domaine, et le lier ici…</em> → nomme-la <code>U-Lecteurs-Reseau</code>.',
            'Clic droit sur la GPO → <strong>Modifier</strong>.',
        ),
        note('yellow', '⚠️ La GPO doit être liée à l’UO des UTILISATEURS',
             'Un mappage de lecteur est un paramètre de <em>configuration utilisateur</em> : lié à une '
             'UO d’ordinateurs, il ne s’appliquera jamais. C’est l’erreur la plus fréquente sur cette '
             'procédure.'),
        '<h2>2️⃣ Déclarer le lecteur</h2>',
        etapes(
            'Va dans <strong>Configuration utilisateur → Préférences → Paramètres Windows → Mappages de '
            'lecteurs</strong>.',
            'Clic droit → <strong>Nouveau → Lecteur mappé</strong>.',
            'Action : <strong>Mettre à jour</strong> — elle crée si absent et corrige si présent, alors '
            'que <em>Créer</em> ne repasse jamais sur l’existant.',
            'Emplacement : <code>\\\\SRV-AD01\\Compta$</code>',
            'Coche <strong>Reconnecter</strong>, choisis la lettre <strong>S:</strong>, et donne un nom '
            'lisible (« Compta »).',
        ),
        '<h2>3️⃣ Ne le donner qu’aux bonnes personnes</h2>',
        '<p>C’est ce qui permet de mettre <strong>tous</strong> les lecteurs dans une seule GPO, chacun '
        'ciblé sur son groupe, plutôt qu’une GPO par service.</p>',
        etapes(
            'Dans la fenêtre du lecteur, onglet <strong>Commun</strong>.',
            'Coche <strong>Ciblage au niveau de l’élément</strong> → <strong>Ciblage…</strong>',
            '<em>Nouvel élément → Groupe de sécurité</em> → choisis <code>GG-Compta</code>.',
        ),
        '<h2>✅ Vérifier</h2>',
        cmd('gpupdate /force\n'
            '# fermer la session et la rouvrir : un lecteur se monte à l’ouverture\n'
            'net use\n'
            'gpresult /r /scope:user\n'
            'gpresult /h C:\\rapport.html   # rapport complet, très lisible'),
        '<p>Dans le rapport, cherche la GPO dans les stratégies <strong>appliquées</strong>. Si elle est '
        'dans les <em>refusées</em>, la raison y est écrite : filtrage de sécurité, ciblage, ou lien sur '
        'la mauvaise UO.</p>',
        note('yellow', '⚠️ Le lecteur ne vient qu’à l’ouverture de session',
             '<code>gpupdate /force</code> applique la stratégie mais ne monte pas le lecteur : il faut '
             'une <strong>nouvelle session</strong>. Se contenter de verrouiller/déverrouiller ne suffit '
             'pas.'),
        note('gray', '🔍 Lecteur avec une croix rouge',
             'Le mappage est passé mais l’accès échoue : c’est un problème de droits sur le partage ou '
             'en NTFS, pas de GPO. Teste le chemin <code>\\\\SRV-AD01\\Compta$</code> à la main avec le '
             'compte concerné.'),
    ])

PROFILS = page(
    'Procédure · Active Directory',
    'Mettre en place des profils itinérants',
    'Retrouver son bureau et ses documents sur n’importe quel poste du domaine.',
    [
        note('blue', 'ℹ️ Avant de commencer',
             'Un domaine fonctionnel et un serveur de fichiers avec de la place : un profil pèse vite '
             'plusieurs gigaoctets par utilisateur. Cours associé : '
             '<a href="/profils-itinerants">Les profils itinérants (Active Directory)</a>.'),
        '<h2>1️⃣ Le partage des profils</h2>',
        etapes(
            'Crée <code>D:\\Profils</code> sur le serveur de fichiers.',
            'Partage-le sous le nom <code>Profils$</code> (caché), avec <em>Utilisateurs authentifiés</em> '
            'en <strong>Contrôle total</strong> au niveau du partage.',
        ),
        '<h2>2️⃣ Les droits NTFS — l’étape à ne pas rater</h2>',
        '<p>Les utilisateurs doivent pouvoir <strong>créer</strong> leur dossier, sans pouvoir ouvrir '
        'celui des autres. C’est un réglage précis, pas un « Contrôle total » global.</p>',
        etapes(
            'Onglet <strong>Sécurité → Avancé</strong> → désactive l’héritage et convertis.',
            'Retire <em>Utilisateurs</em>.',
            '<em>Utilisateurs authentifiés</em> → <strong>Avancé</strong> → s’applique à '
            '<strong>« Ce dossier uniquement »</strong> → coche <em>Création de dossier / Ajout de '
            'données</em> et <em>Liste du dossier / Lecture de données</em>.',
            '<em>CREATEUR PROPRIETAIRE</em> → <strong>Contrôle total</strong> → s’applique aux '
            '<strong>« Sous-dossiers et fichiers uniquement »</strong>.',
            '<em>SYSTEM</em> et <em>Administrateurs</em> → Contrôle total, sur tout.',
        ),
        note('red', '🚨 Ne crée jamais le dossier d’un utilisateur à la main',
             'Windows le crée à la première ouverture de session et lui pose les bons droits — '
             'l’utilisateur en devient propriétaire. Un dossier créé par l’administrateur appartient à '
             'l’administrateur : l’utilisateur ne pourra pas y écrire, et le profil échouera avec un '
             'message qui ne dit pas pourquoi.'),
        '<h2>3️⃣ Déclarer le chemin dans l’annuaire</h2>',
        etapes(
            'Ouvre <strong>Utilisateurs et ordinateurs Active Directory</strong>.',
            'Propriétés de l’utilisateur → onglet <strong>Profil</strong>.',
            'Chemin du profil : <code>\\\\SRV-AD01\\Profils$\\%username%</code>',
        ),
        '<p>Pour tout un groupe d’un coup :</p>',
        cmd('Get-ADUser -SearchBase "OU=Bureaux,OU=Utilisateurs,DC=miyukini,DC=lan" -Filter * |\n'
            '  ForEach-Object { Set-ADUser $_ -ProfilePath "\\\\SRV-AD01\\Profils$\\$($_.SamAccountName)" }'),
        note('gray', '💡 Pourquoi la boucle explicite',
             'Un simple <code>| Set-ADUser -ProfilePath "…$($_.SamAccountName)"</code> ne marche pas : '
             'le paramètre est évalué une seule fois, avant la boucle, et <code>$_</code> y est '
             'encore vide — tout le monde recevrait le même chemin. <code>ForEach-Object</code> '
             'réévalue la chaîne pour chaque utilisateur.'),
        '<h2>✅ Vérifier</h2>',
        etapes(
            'Ouvre une session avec un compte concerné sur un poste du domaine.',
            'Pose un fichier sur le bureau, ferme la session (proprement : la copie se fait à la '
            'fermeture).',
            'Ouvre la même session sur un <strong>autre</strong> poste : le fichier doit être là.',
            'Sur le serveur, un dossier <code>utilisateur.V6</code> doit être apparu.',
        ),
        note('gray', '💡 Le suffixe <code>.V6</code>',
             'Windows ajoute un numéro de version au dossier : <code>.V6</code> pour Windows 10 et 11. '
             'C’est ce qui permet à des versions différentes de cohabiter sans se corrompre — ne le '
             'retire pas, et ne le mets pas dans le chemin de l’annuaire.'),
        note('yellow', '⚠️ Le profil qui met trois minutes à ouvrir',
             'Tout le profil transite par le réseau à chaque connexion. Redirige les gros dossiers '
             '(Documents, Images, Téléchargements) par GPO — <em>Redirection de dossiers</em> — pour '
             'qu’ils restent sur le serveur au lieu d’être recopiés.'),
    ])

PARE_FEU = page(
    'Procédure · Sécurité',
    'Créer une règle de pare-feu Windows',
    'Ouvrir un port ou un service, en interface graphique, en PowerShell, et pour tout le parc par GPO.',
    [
        note('blue', 'ℹ️ Avant de commencer',
             'Sache <strong>quel protocole et quel port</strong> tu ouvres, et <strong>pour qui</strong>. '
             'Une règle « autoriser tout depuis n’importe où » n’est pas une règle de pare-feu. Cours '
             'associé : <a href="/le-pare-feu">Le pare-feu</a>.'),
        '<h2>🧭 Les trois profils</h2>',
        '<table class="proc-tab"><tr><th>Profil</th><th>Quand il s’applique</th></tr>'
        '<tr><td><strong>Domaine</strong></td><td>La machine joint son contrôleur de domaine — le cas '
        'd’un poste au bureau</td></tr>'
        '<tr><td><strong>Privé</strong></td><td>Réseau déclaré de confiance</td></tr>'
        '<tr><td><strong>Public</strong></td><td>Tout le reste : hôtel, gare, partage de connexion</td></tr></table>',
        '<p>Une règle cochée sur les trois profils suit la machine partout, y compris là où on ne la '
        'voudrait pas. Sur un serveur du domaine, ne coche que <strong>Domaine</strong>.</p>',
        '<h2>🖱️ En interface graphique</h2>',
        etapes(
            '<kbd>Win</kbd>+<kbd>R</kbd> → <code>wf.msc</code>.',
            '<strong>Règles de trafic entrant</strong> → clic droit → <strong>Nouvelle règle</strong>.',
            'Type <strong>Port</strong> → TCP → <code>3389</code> (Bureau à distance).',
            '<strong>Autoriser la connexion</strong>.',
            'Coche <strong>uniquement Domaine</strong>.',
            'Nomme-la explicitement : <code>RDP entrant (Domaine)</code> — dans six mois, personne ne '
            'devinera à quoi sert « Règle 1 ».',
        ),
        '<h2>⌨️ En PowerShell</h2>',
        cmd('# ouvrir un port, seulement depuis le réseau interne\n'
            'New-NetFirewallRule -DisplayName "RDP entrant (Domaine)" `\n'
            '  -Direction Inbound -Protocol TCP -LocalPort 3389 `\n'
            '  -RemoteAddress 192.168.10.0/24 -Profile Domain -Action Allow\n\n'
            '# autoriser le ping (ICMP écho)\n'
            'New-NetFirewallRule -DisplayName "Ping entrant (Domaine)" `\n'
            '  -Direction Inbound -Protocol ICMPv4 -IcmpType 8 -Profile Domain -Action Allow\n\n'
            '# activer un groupe de règles déjà prévu par Windows\n'
            'Enable-NetFirewallRule -DisplayGroup "Partage de fichiers et d’imprimantes"'),
        note('gray', '💡 <code>-RemoteAddress</code>',
             'C’est ce qui transforme « le port est ouvert » en « le port est ouvert <em>pour le réseau '
             'interne</em> ». Une règle sans restriction de source est presque toujours trop large.'),
        '<h2>🏢 Pour tout le parc, par GPO</h2>',
        etapes(
            '<code>gpmc.msc</code> → GPO liée à l’UO des <strong>ordinateurs</strong>.',
            '<strong>Configuration ordinateur → Stratégies → Paramètres Windows → Paramètres de '
            'sécurité → Pare-feu Windows Defender avec fonctions avancées de sécurité</strong>.',
            'Crée la règle entrante exactement comme en local.',
            '<code>gpupdate /force</code> sur un poste témoin, puis vérifie.',
        ),
        '<h2>✅ Vérifier</h2>',
        cmd('Get-NetFirewallRule -DisplayName "RDP*" | Format-Table DisplayName,Enabled,Direction,Action\n'
            'Get-NetFirewallRule -DisplayName "RDP entrant (Domaine)" | Get-NetFirewallPortFilter\n'
            'Get-NetFirewallProfile | Format-Table Name,Enabled\n\n'
            '# depuis un autre poste : le port répond-il vraiment ?\n'
            'Test-NetConnection 192.168.10.20 -Port 3389'),
        '<p><code>Test-NetConnection</code> est le seul contrôle qui vaille : il dit si le port répond '
        '<em>depuis l’extérieur de la machine</em>, ce qu’aucune inspection locale ne prouve.</p>',
        note('yellow', '⚠️ Ne désactive pas le pare-feu pour « voir »',
             'C’est le réflexe qui fait passer un problème de règle pour un problème résolu — et laisse '
             'la machine ouverte quand on oublie de le rallumer. Crée une règle temporaire large, '
             'nommée, et retire-la ensuite.'),
        note('gray', '🔍 Voir ce qui est bloqué',
             'Active le journal du pare-feu (<code>wf.msc</code> → Propriétés → Journalisation → '
             '<em>Consigner les paquets perdus</em>) et lis '
             '<code>%systemroot%\\system32\\LogFiles\\Firewall\\pfirewall.log</code>. Voir aussi '
             '<a href="/astuce-pare-feu-ping">Autoriser le ping dans le pare-feu</a>.'),
    ])

RAID = page(
    'Procédure · Windows Server',
    'Créer un volume RAID sous Windows Server',
    'Miroir, agrégat par bandes et RAID-5 : gestion des disques et espaces de stockage.',
    [
        note('blue', 'ℹ️ Avant de commencer',
             'Au moins deux disques supplémentaires, non initialisés, de taille identique de '
             'préférence. Cours associé : <a href="/le-raid">Les niveaux de RAID</a>.'),
        note('red', '🚨 Le RAID n’est pas une sauvegarde',
             'Il protège d’une <strong>panne de disque</strong>, et de rien d’autre. Un fichier effacé, '
             'chiffré par un rançongiciel ou écrasé par erreur l’est instantanément sur tous les '
             'disques de la grappe. Voir <a href="/procedure-sauvegarde">Sauvegarde &amp; restauration '
             'des données</a>.'),
        '<h2>🧮 Choisir le niveau</h2>',
        '<table class="proc-tab"><tr><th>Niveau</th><th>Disques</th><th>Capacité utile</th>'
        '<th>Tolère</th><th>Pour quoi</th></tr>'
        '<tr><td>RAID 0 (bandes)</td><td>2+</td><td>100 %</td><td><strong>Rien</strong></td>'
        '<td>Vitesse seule, données jetables</td></tr>'
        '<tr><td>RAID 1 (miroir)</td><td>2</td><td>50 %</td><td>1 disque</td>'
        '<td>Système, petits volumes critiques</td></tr>'
        '<tr><td>RAID 5</td><td>3+</td><td>(n−1)/n</td><td>1 disque</td>'
        '<td>Volumes de données</td></tr></table>',
        '<h2>🖱️ Gestion des disques (méthode classique)</h2>',
        etapes(
            '<kbd>Win</kbd>+<kbd>R</kbd> → <code>diskmgmt.msc</code>.',
            'Clic droit sur chaque disque neuf → <strong>Initialiser</strong> → <strong>GPT</strong>.',
            'Clic droit sur l’espace non alloué → <strong>Nouveau volume en miroir</strong> (ou '
            '<em>agrégé par bandes</em>, ou <em>RAID-5</em>).',
            'Ajoute le second disque, attribue une lettre, formate en <strong>NTFS</strong> avec un nom '
            'parlant.',
            'Windows propose de convertir les disques en <strong>dynamiques</strong> : accepte, c’est '
            'nécessaire pour ces volumes.',
        ),
        '<h2>🧱 Espaces de stockage (méthode recommandée)</h2>',
        '<p>Plus souple : on ajoute des disques au pool sans refaire le volume, et on peut créer un '
        'disque virtuel plus grand que la place réellement installée.</p>',
        cmd('# les disques disponibles\nGet-PhysicalDisk -CanPool $true\n\n'
            '# le pool\n'
            'New-StoragePool -FriendlyName "Pool-Donnees" `\n'
            '  -StorageSubSystemFriendlyName (Get-StorageSubSystem).FriendlyName `\n'
            '  -PhysicalDisks (Get-PhysicalDisk -CanPool $true)\n\n'
            '# le disque virtuel en miroir\n'
            'New-VirtualDisk -StoragePoolFriendlyName "Pool-Donnees" -FriendlyName "VD-Partages" `\n'
            '  -ResiliencySettingName Mirror -UseMaximumSize\n\n'
            '# le formater et le monter\n'
            'Get-VirtualDisk "VD-Partages" | Get-Disk | Initialize-Disk -PartitionStyle GPT\n'
            'Get-VirtualDisk "VD-Partages" | Get-Disk | New-Partition -AssignDriveLetter -UseMaximumSize |\n'
            '  Format-Volume -FileSystem NTFS -NewFileSystemLabel "Partages"'),
        '<h2>✅ Vérifier</h2>',
        cmd('Get-VirtualDisk | Format-Table FriendlyName,ResiliencySettingName,HealthStatus,OperationalStatus\n'
            'Get-PhysicalDisk | Format-Table FriendlyName,MediaType,HealthStatus,Size\n'
            'Get-Volume | Format-Table DriveLetter,FileSystemLabel,HealthStatus,SizeRemaining'),
        '<p><code>HealthStatus</code> doit valoir <strong>Healthy</strong>. Après la création, un miroir '
        'reste un moment en <em>InService</em> : c’est la synchronisation initiale, laisse-la finir.</p>',
        note('yellow', '⚠️ Surveille, sinon le RAID ne sert à rien',
             'Une grappe qui perd un disque continue de fonctionner <strong>sans rien dire</strong>. Si '
             'personne ne regarde, le second disque lâche des mois plus tard et tout est perdu. Mets en '
             'place une alerte — voir <a href="/supervision">La supervision</a>.'),
    ])

WIRESHARK = page(
    'Procédure · Diagnostic',
    'Capturer et analyser une trame avec Wireshark',
    'Choisir la bonne interface, filtrer utilement, et lire ce qui se passe vraiment sur le câble.',
    [
        note('blue', 'ℹ️ Avant de commencer',
             'Wireshark montre ce qui <strong>arrive sur la carte réseau</strong> — pas ce qui circule '
             'sur le réseau. La différence décide de tout, voir l’encadré sur le commutateur. Cours '
             'associé : <a href="/le-wireshark">Wireshark : capturer et analyser une trame</a>.'),
        '<h2>1️⃣ Choisir l’interface et démarrer</h2>',
        etapes(
            'Lance Wireshark : l’écran d’accueil liste les interfaces avec un tracé d’activité.',
            'Choisis celle qui <strong>bouge</strong> — c’est la seule façon fiable de repérer la bonne '
            'carte quand il y en a plusieurs (Wi-Fi, Ethernet, machines virtuelles).',
            'Double-clique pour démarrer la capture.',
        ),
        '<h2>2️⃣ Deux filtres à ne pas confondre</h2>',
        '<table class="proc-tab"><tr><th></th><th>Filtre de capture</th><th>Filtre d’affichage</th></tr>'
        '<tr><td>Quand</td><td><strong>Avant</strong> la capture</td><td><strong>Après</strong>, à tout moment</td></tr>'
        '<tr><td>Effet</td><td>Ce qui n’est pas pris est perdu</td><td>Cache sans jeter</td></tr>'
        '<tr><td>Syntaxe</td><td><code>host 192.168.10.20</code></td><td><code>ip.addr == 192.168.10.20</code></td></tr>'
        '<tr><td>Quand l’utiliser</td><td>Capture longue, réseau chargé</td><td>Presque toujours</td></tr></table>',
        '<h2>3️⃣ Les filtres d’affichage qui servent</h2>',
        cmd('ip.addr == 192.168.10.20              # tout ce qui concerne cette machine\n'
            'ip.addr == 192.168.10.20 && tcp.port == 80\n'
            'tcp.flags.syn == 1 && tcp.flags.ack == 0   # les demandes de connexion\n'
            'dns                                    # les résolutions de noms\n'
            'dhcp                                   # DISCOVER / OFFER / REQUEST / ACK\n'
            'arp                                    # « qui a cette IP ? »\n'
            'icmp                                   # les ping\n'
            'http.request                           # seulement les requêtes web\n'
            'tcp.analysis.retransmission            # les signes d’un réseau qui souffre'),
        note('gray', '💡 <code>==</code> et non <code>=</code>',
             'La barre de filtre passe au <strong>vert</strong> quand la syntaxe est valide, au '
             '<strong>rouge</strong> sinon. Regarde la couleur avant de conclure qu’il n’y a « rien à '
             'voir ».'),
        '<h2>4️⃣ Lire une conversation</h2>',
        etapes(
            'Clic droit sur un paquet → <strong>Suivre → Flux TCP</strong> : Wireshark reconstitue '
            'l’échange complet, dans l’ordre et en clair quand il n’est pas chiffré.',
            'Pour un accès web qui échoue, cherche la <strong>poignée de main</strong> : '
            '<code>SYN</code> → <code>SYN, ACK</code> → <code>ACK</code>. Un <code>SYN</code> sans '
            'réponse = rien n’écoute en face, ou un pare-feu jette. Un <code>RST</code> = le port est '
            'fermé et la machine le dit.',
            'Menu <strong>Statistiques → Conversations</strong> : qui parle à qui, et combien.',
        ),
        '<h2>✅ Un cas concret : « le DHCP ne donne pas d’adresse »</h2>',
        etapes(
            'Filtre <code>dhcp</code> et relance la carte du client (<code>ipconfig /renew</code>).',
            'Tu vois <code>DISCOVER</code> seul : la demande part, personne ne répond — le serveur est '
            'absent, ou le <a href="/procedure-dhcp-relais">relais DHCP</a> manque.',
            'Tu vois <code>DISCOVER</code> puis <code>OFFER</code> mais pas d’<code>ACK</code> : deux '
            'serveurs se marchent dessus, ou l’étendue est épuisée.',
            'Tu ne vois rien du tout : tu n’es pas sur la bonne interface, ou pas dans le bon VLAN.',
        ),
        note('yellow', '⚠️ Un commutateur ne te montre pas le trafic des autres',
             'Contrairement à un vieux concentrateur, un switch n’envoie à ton port que <em>ton</em> '
             'trafic et les diffusions. Pour observer une autre machine, il faut un <strong>port '
             'miroir</strong> (SPAN) configuré sur le switch, ou capturer directement sur la machine '
             'concernée. Sans cela, tu conclus « il n’y a pas de trafic » alors que tu ne peux pas le '
             'voir.'),
        note('gray', '🔍 Garder la capture',
             '<strong>Fichier → Enregistrer sous</strong> au format <code>.pcapng</code>. C’est la pièce '
             'jointe qui transforme « ça ne marche pas » en un ticket qu’un tiers peut analyser.'),
    ])

# ═════════════════════════════════════════════════════════ le lot ══

PROCEDURES = [
    ('procedure-nat-pat', 'Configurer le NAT et le PAT (Cisco)',
     'NAT statique, NAT dynamique et PAT sur un routeur Cisco : déclarer le dedans et le dehors, '
     'traduire, vérifier.', NAT),
    ('procedure-acl', 'Configurer des listes de contrôle d’accès (ACL)',
     'ACL standard, étendue et nommée : où les poser, comment les écrire, et le refus implicite qui '
     'coupe tout.', ACL),
    ('procedure-vtp', 'Propager les VLAN avec VTP',
     'Déclarer les VLAN une seule fois sur le switch serveur, et le piège du numéro de révision qui '
     'efface un réseau.', VTP),
    ('procedure-vlan-securite', 'Sécuriser les VLAN d’un commutateur',
     'Port-security, VLAN natif dédié et ports inutilisés : les trois gestes qui ferment un switch.',
     VLAN_SECU),
    ('procedure-samba', 'Partager des fichiers vers Windows avec Samba',
     'Installer Samba sur Debian, régler les droits Unix puis le partage, et y accéder depuis '
     'l’Explorateur Windows.', SAMBA),
    ('procedure-apache-linux', 'Héberger un site avec Apache sous Debian',
     'Installer Apache, créer un hôte virtuel, l’activer et le tester avant même que le DNS ne soit '
     'prêt.', APACHE),
    ('procedure-linux-lvm', 'Ajouter un disque et le gérer en LVM',
     'Du disque brut au dossier monté : partition, PV, VG, LV, fstab par UUID, et l’extension à '
     'chaud.', LVM),
    ('procedure-systemd-service', 'Créer et gérer un service systemd',
     'Écrire une unité, l’activer, la déclencher périodiquement par un timer, et lire ses journaux.',
     SYSTEMD),
    ('procedure-cron-journaux', 'Planifier avec cron et lire les journaux',
     'Programmer une tâche récurrente, capturer sa sortie, retrouver ce qui s’est passé et faire '
     'tourner les journaux.', CRON),
    ('procedure-partage-ntfs', 'Créer un partage et régler les permissions (partage + NTFS)',
     'Les deux couches d’autorisations, la plus restrictive qui gagne, et le contrôle par l’accès '
     'effectif.', PARTAGE_NTFS),
    ('procedure-lecteur-reseau-gpo', 'Monter un lecteur réseau par GPO',
     'Distribuer un lecteur à un groupe précis par les préférences de stratégie de groupe, sans script '
     'de connexion.', LECTEUR_GPO),
    ('procedure-profils-itinerants', 'Mettre en place des profils itinérants',
     'Partage des profils, droits NTFS exacts, chemin dans l’annuaire — et pourquoi on ne crée jamais '
     'le dossier à la main.', PROFILS),
    ('procedure-pare-feu-windows', 'Créer une règle de pare-feu Windows',
     'Ouvrir un port ou un service en graphique, en PowerShell et par GPO, en restreignant la source.',
     PARE_FEU),
    ('procedure-raid-windows', 'Créer un volume RAID sous Windows Server',
     'Choisir le niveau, monter la grappe en gestion des disques ou en espaces de stockage, et la '
     'surveiller.', RAID),
    ('procedure-wireshark', 'Capturer et analyser une trame avec Wireshark',
     'Choisir la bonne interface, distinguer filtre de capture et filtre d’affichage, et lire une '
     'conversation.', WIRESHARK),
]


def main():
    if not BASE.exists():
        print(f'base introuvable : {BASE}', file=sys.stderr)
        return 1

    c = sqlite3.connect(BASE)
    c.execute('PRAGMA journal_mode=WAL')
    crees, majs = [], []

    for slug, titre, extrait, contenu in PROCEDURES:
        existe = c.execute('SELECT id FROM pages WHERE slug=?', (slug,)).fetchone()
        if existe:
            c.execute(
                "UPDATE pages SET title=?, excerpt=?, content=?, published=1,"
                " updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug=?",
                (titre, extrait, contenu, slug))
            majs.append(slug)
        else:
            c.execute(
                "INSERT INTO pages (title, slug, content, excerpt, builder_json, published,"
                " created_at, updated_at) VALUES (?,?,?,?,'',1,"
                " strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
                (titre, slug, contenu, extrait))
            crees.append(slug)

    c.commit()
    c.close()

    print(f'{len(crees)} créée(s), {len(majs)} mise(s) à jour')
    for s in crees:
        print('  +', s)
    for s in majs:
        print('  ~', s)
    return 0


if __name__ == '__main__':
    sys.exit(main())

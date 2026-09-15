# -*- coding: utf-8 -*-
"""
Série VPN en trois volets, dans Réseau › Sécurité & accès distant :
  1. `le-vpn`            — comprendre (réécrit : la page faisait 3,7 Ko)
  2. `vpn-nomade`        — mettre en place l'accès distant (WireGuard sur OPNsense, OpenVPN quand il faut MFA)
  3. `vpn-site-a-site`   — relier deux sites (IPsec IKEv2, WireGuard), exploiter et surveiller

Le volet OPNsense « accès distants et détection d'intrusion » reste : il est
cité comme le pas-à-pas dans l'interface, ces trois cours donnent le fond.

IDEMPOTENT.
"""
import sys

from _cours import (Categorie, STYLE, acc, bullets, cmd, hero, menu, note, publier_lot, retenir, steps, tab)

RESEAU = Categorie('cat-reseau', '🌐', 'Réseau', '', '#059669')
SG = 'Sécurité &amp; accès distant'

BANDEAU = ('<div class="ops-serie"><span class="ops-l">Série VPN</span>'
           '<a class="ops-v{a}" href="/pages/le-vpn">1 · Comprendre</a>'
           '<a class="ops-v{b}" href="/pages/vpn-nomade">2 · L’accès nomade</a>'
           '<a class="ops-v{c}" href="/pages/vpn-site-a-site">3 · Deux sites, et l’exploitation</a></div>')


def bandeau(n):
    return BANDEAU.format(a=' ops-ici' if n == 1 else '', b=' ops-ici' if n == 2 else '', c=' ops-ici' if n == 3 else '')


# ══════════════════════════════════════════════════════ 1. Comprendre ══

SVG_TUNNEL = (
    '<svg viewBox="0 0 760 210" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:760px;display:block;margin:10px auto;font-family:system-ui,sans-serif">'
    '<defs><marker id="fl" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#64748b"/></marker></defs>'
    '<rect x="10" y="40" width="150" height="120" rx="12" fill="#ecfdf5" stroke="#059669" stroke-width="2"/><text x="85" y="62" text-anchor="middle" font-size="12" font-weight="700" fill="#065f46">Poste nomade</text>'
    '<text x="85" y="84" text-anchor="middle" font-size="11" fill="#065f46">IP publique 203.0.113.7</text><text x="85" y="102" text-anchor="middle" font-size="11" fill="#065f46">IP du tunnel 10.10.10.2</text>'
    '<text x="85" y="140" text-anchor="middle" font-size="10.5" fill="#334155">paquet vers 192.168.20.5</text>'
    '<rect x="600" y="40" width="150" height="120" rx="12" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/><text x="675" y="62" text-anchor="middle" font-size="12" font-weight="700" fill="#1e3a8a">Pare-feu / OPNsense</text>'
    '<text x="675" y="84" text-anchor="middle" font-size="11" fill="#1e3a8a">WAN 198.51.100.1</text><text x="675" y="102" text-anchor="middle" font-size="11" fill="#1e3a8a">IP du tunnel 10.10.10.1</text>'
    '<text x="675" y="140" text-anchor="middle" font-size="10.5" fill="#334155">→ LAN 192.168.20.0/24</text>'
    '<rect x="200" y="70" width="360" height="60" rx="30" fill="#fef3c7" stroke="#d97706" stroke-width="2" stroke-dasharray="6 4"/>'
    '<text x="380" y="92" text-anchor="middle" font-size="12" font-weight="700" fill="#92400e">Internet — tunnel chiffré (UDP 51820)</text>'
    '<text x="380" y="112" text-anchor="middle" font-size="10.5" fill="#92400e">en-tête public : 203.0.113.7 → 198.51.100.1 · charge : le paquet privé, chiffré</text>'
    '<line x1="160" y1="100" x2="200" y2="100" stroke="#64748b" stroke-width="2" marker-end="url(#fl)"/><line x1="560" y1="100" x2="600" y2="100" stroke="#64748b" stroke-width="2" marker-end="url(#fl)"/>'
    '<text x="380" y="185" text-anchor="middle" font-size="11" fill="#475569">Le paquet privé (10.10.10.2 → 192.168.20.5) voyage <tspan font-weight="700">à l’intérieur</tspan> d’un paquet public : encapsulation, puis chiffrement.</text>'
    '</svg>')

COMPRENDRE = '\n'.join([
    hero('Cours · Réseau', 'Le VPN : comprendre',
         'Un tunnel qui fait passer un réseau privé à travers un réseau public. Ce qu’il chiffre, ce qu’il '
         'n’empêche pas, les trois familles (IPsec, OpenVPN, WireGuard), nomade ou site-à-site, split ou '
         'full tunnel — pour choisir avant de configurer.'),
    STYLE, bandeau(1),
    '<p>Un <strong>VPN</strong> (<em>Virtual Private Network</em>) relie des machines qui ne sont pas sur le même '
    'réseau comme si elles l’étaient : le télétravailleur qui ouvre le partage de fichiers du bureau, l’agence '
    'qui parle au serveur du siège. Entre les deux, Internet — qu’on ne contrôle pas. Le VPN y creuse un '
    '<strong>tunnel</strong> : les paquets privés sont emballés dans des paquets publics et chiffrés. Le REAC 2026 '
    'demande de « configurer un accès distant sécurisé » et d’exploiter « un environnement hybride » : le VPN est '
    'la brique entre les deux.</p>',

    '<h2>1) Le principe : encapsuler, chiffrer, authentifier</h2>',
    SVG_TUNNEL,
    tab(['Opération', 'Ce que ça fait', 'Sans elle'], [
        ['<strong>Encapsulation</strong>', 'Le paquet privé (adresses internes) devient la charge utile d’un paquet public (adresses Internet)', 'Un routeur d’Internet jetterait un paquet vers 192.168.x.x'],
        ['<strong>Chiffrement</strong>', 'La charge utile est illisible pour qui la voit passer (opérateur, Wi-Fi public)', 'Tout le trafic interne serait lisible sur le chemin'],
        ['<strong>Intégrité</strong>', 'Un paquet modifié en route est détecté et rejeté', 'Injection ou altération possibles'],
        ['<strong>Authentification</strong>', 'Chaque extrémité prouve qui elle est (clé, certificat, secret partagé) avant que le tunnel n’existe', 'N’importe qui pourrait « être » le nomade'],
    ]),
    note('yellow', '⚠️ Ce qu’un VPN ne fait pas',
         'Il protège le <em>chemin</em>, pas les <em>extrémités</em>. Un poste infecté qui monte le tunnel amène '
         'l’infection dans le réseau. Un VPN n’est pas un antivirus, pas un pare-feu, pas une authentification '
         'forte à lui seul. Et les « VPN » grand public vendus pour « être anonyme » sont un autre produit : '
         'un mandataire vers Internet, pas un accès à un réseau d’entreprise.'),

    '<h2>2) Deux usages qui ne se configurent pas pareil</h2>',
    tab(['', 'Nomade (accès distant)', 'Site-à-site'], [
        ['Relie', 'Un <strong>poste</strong> (ou un téléphone) à l’entreprise', 'Deux <strong>réseaux</strong>, par leurs pare-feux ou routeurs'],
        ['Qui monte le tunnel', 'L’utilisateur, quand il en a besoin (ou le poste au démarrage)', 'Les équipements, en permanence'],
        ['Adresse côté distant', 'Une IP du tunnel attribuée au poste (10.10.10.x)', 'Tout le sous-réseau de l’autre site est routé'],
        ['Authentification', 'Par utilisateur : clé, certificat, compte + MFA', 'Par équipement : secret partagé ou certificats'],
        ['Exemple', 'Télétravail, administrateur en déplacement', 'Siège ↔ agence, entreprise ↔ datacenter, LAN ↔ cloud (Azure VPN Gateway)'],
        ['Volet', '<a href="/pages/vpn-nomade">2 · L’accès nomade</a>', '<a href="/pages/vpn-site-a-site">3 · Deux sites</a>'],
    ]),

    '<h2>3) Les trois familles de protocoles</h2>',
    tab(['', 'IPsec (IKEv2)', 'OpenVPN', 'WireGuard'], [
        ['Âge, statut', 'Années 1990, norme IETF, partout (routeurs, pare-feux, Windows, iOS, Android nativement)', '2001, logiciel libre, très répandu', '2015, dans le noyau Linux depuis 2020, en pleine adoption'],
        ['Couche', 'Réseau (3) : chiffre les paquets IP eux-mêmes (ESP)', 'Transport via TLS, sur UDP (ou TCP)', 'Réseau, sur UDP'],
        ['Négociation', '<strong>IKE</strong> : phase 1 (authentifier, clés de session), phase 2 (le tunnel ESP)', 'Poignée de main TLS, comme HTTPS', 'Aucune session : des <strong>clés publiques statiques</strong> et une poignée de main d’une seule passe'],
        ['Authentification', 'Secret partagé (PSK) ou certificats ; EAP pour les comptes utilisateurs', 'Certificats (PKI), + mot de passe / MFA en option', 'Clé publique de chaque pair, point'],
        ['Taille du code', 'Énorme (des dizaines d’options)', 'Grande', '~4 000 lignes : auditable'],
        ['Performances', 'Bonnes (matériel dédié possible)', 'Moyennes (espace utilisateur)', 'Excellentes'],
        ['Traversée de NAT', 'NAT-T (UDP 4500) : parfois capricieuse', 'Très bonne (un port UDP ou TCP, même 443)', 'Très bonne (UDP, garde le NAT ouvert par <em>keepalive</em>)'],
        ['MFA native', 'Oui, via EAP / RADIUS', 'Oui (plugin, TOTP, RADIUS)', '<strong>Non</strong> : la clé seule (l’ajouter au-dessus, ou choisir OpenVPN)'],
        ['Client', 'Intégré aux OS', 'À installer', 'À installer (léger)'],
        ['Choisir pour', 'Site-à-site entre pare-feux, interop constructeurs, cloud', 'Nomade avec MFA et comptes AD, réseaux qui filtrent tout sauf 443', 'Nomade et site-à-site simples, performance, administrateurs'],
    ]),
    acc(
        ('IPsec en un peu plus de détail',
         '<p><strong>IKE</strong> (Internet Key Exchange, aujourd’hui v2) est la négociation : les deux pairs s’authentifient et '
         'fabriquent des clés de session (phase 1, « IKE SA »), puis définissent ce qui passe dans le tunnel et avec quels '
         'algorithmes (phase 2, « Child SA » ou « IPsec SA »). <strong>ESP</strong> (Encapsulating Security Payload) transporte '
         'ensuite les paquets chiffrés — protocole IP n° 50, ou encapsulé dans UDP 4500 quand il y a du NAT (<strong>NAT-T</strong>). '
         'Deux modes : <em>tunnel</em> (tout le paquet IP est encapsulé — le site-à-site) et <em>transport</em> (seule la charge '
         'est chiffrée — entre deux hôtes). Ce qui fait échouer 90 % des IPsec : une <strong>proposition</strong> qui ne correspond pas '
         'des deux côtés (AES-256-GCM / SHA-256 / groupe DH 14…) ou des <strong>réseaux locaux/distants</strong> mal déclarés en phase 2.</p>'),
        ('WireGuard en un peu plus de détail',
         '<p>Chaque extrémité a une <strong>paire de clés</strong> (comme SSH). Un pair est défini par sa clé publique, son point '
         'd’entrée (adresse:port) et ses <strong>AllowedIPs</strong> : les adresses qui, en sortie, sont envoyées vers ce pair '
         'et qui, en entrée, sont acceptées de lui. C’est à la fois la <em>table de routage</em> et le <em>filtre</em> du tunnel — '
         'l’erreur classique est d’y mettre trop (<code>0.0.0.0/0</code> : tout passe par le tunnel) ou pas assez (le réseau '
         'du bureau manque : injoignable). Le chiffrement est fixe (ChaCha20-Poly1305, Curve25519) : rien à négocier, rien '
         'à se tromper. Pas de notion de session : un pair « injoignable » ne produit aucune erreur, juste pas de '
         '<em>handshake</em> — <code>wg show</code> est le seul diagnostic.</p>'),
        ('OpenVPN en un peu plus de détail',
         '<p>Un serveur avec un <strong>certificat</strong> (PKI interne), des clients avec le leur (ou un compte + mot de passe, '
         'ou les deux). Le tunnel est une session TLS, sur UDP 1194 par défaut — ou TCP 443, ce qui lui permet de traverser '
         'les réseaux d’hôtel qui bloquent tout le reste. Interface <code>tun</code> (niveau 3, le cas normal) ou <code>tap</code> '
         '(niveau 2, pour faire passer des broadcasts — rare et lourd). Sa force : l’authentification riche (RADIUS, LDAP/AD, TOTP, '
         'certificats révocables par CRL). Sa faiblesse : la vitesse, et un client à déployer.</p>'),
    ),

    '<h2>4) Split tunnel ou full tunnel</h2>',
    tab(['', 'Split tunnel', 'Full tunnel'], [
        ['Ce qui passe dans le VPN', 'Seulement les réseaux de l’entreprise (192.168.0.0/16…)', 'Tout, y compris Internet'],
        ['Internet du nomade', 'Direct, par sa propre connexion', 'Par l’entreprise (son pare-feu, son proxy, son adresse publique)'],
        ['Pour', 'Performance, visioconférence, bande passante du site épargnée', 'Contrôle total : filtrage web, journalisation, Wi-Fi public douteux'],
        ['Contre', 'Le poste est à la fois « dedans » et « dehors » (pont possible pour un attaquant)', 'Toute la bande passante du site ; latence ; le Netflix du soir passe par le bureau'],
        ['Réglage', 'Routes poussées limitées / <code>AllowedIPs</code> = réseaux internes', 'Route par défaut poussée / <code>AllowedIPs = 0.0.0.0/0</code>'],
    ]),
    '<p>Choix de sécurité, pas de confort : la PSSI tranche. Le compromis courant : split tunnel pour les '
    'utilisateurs, full tunnel imposé sur les postes des administrateurs et depuis les réseaux publics.</p>',

    '<h2>5) Les détails qui font marcher — ou pas</h2>',
    tab(['Sujet', 'Ce qu’il faut savoir'], [
        ['<strong>MTU</strong>', 'L’encapsulation ajoute 60 à 80 octets : un paquet de 1500 ne rentre plus. Symptôme : le ping passe, les pages web « tournent », les partages se figent. Remède : MTU du tunnel à 1420 (WireGuard) / 1400, ou MSS clamping sur le pare-feu.'],
        ['<strong>Adressage</strong>', 'Le tunnel a son propre sous-réseau (10.10.10.0/24), distinct de tous les LAN reliés. Deux sites en 192.168.1.0/24 chacun ne peuvent pas se parler sans NAT : on choisit des plans d’adressage différents dès le départ (voir <a href="/pages/procedure-plan-adressage">Plan d’adressage</a>).'],
        ['<strong>Routage</strong>', 'Chaque côté doit savoir que le réseau de l’autre est derrière le tunnel ; et les serveurs doivent avoir pour passerelle le pare-feu qui porte le VPN (sinon la réponse part ailleurs : <em>routage asymétrique</em>).'],
        ['<strong>Pare-feu</strong>', 'Le tunnel débouche dans une <strong>zone</strong> à part (interface <code>wg0</code>, <code>ipsec</code>, <code>ovpns1</code>) : ce qu’un nomade atteint reste décidé par des règles, pas par le fait d’être connecté.'],
        ['<strong>DNS</strong>', 'Le nomade doit résoudre <code>srv-fic01.entreprise.local</code> : on lui pousse le DNS interne (et le suffixe de recherche), sinon « le VPN marche mais rien ne répond par nom ».'],
        ['<strong>NAT et ports</strong>', 'Le serveur VPN a besoin d’une adresse publique (ou d’une redirection de port) : UDP 51820 (WireGuard), UDP 1194 / TCP 443 (OpenVPN), UDP 500 + 4500 + ESP (IPsec).'],
        ['<strong>Horloge</strong>', 'Certificats et TOTP exigent des horloges justes : NTP des deux côtés.'],
    ]),

    '<h2>6) Authentifier : de la clé au compte avec MFA</h2>',
    bullets('<strong>Secret partagé (PSK)</strong> : le même mot de passe des deux côtés — acceptable entre deux pare-feux (long, aléatoire, changé quand un admin part), jamais pour des nomades.',
            '<strong>Clés (WireGuard)</strong> : une paire par poste ; on révoque en retirant la clé publique du serveur. Simple, mais rien ne vérifie <em>qui</em> tient le poste.',
            '<strong>Certificats (OpenVPN, IPsec)</strong> : émis par la <a href="/pages/pki-adcs">PKI interne</a>, révocables (CRL), avec une date de fin.',
            '<strong>Compte + MFA</strong> : OpenVPN ou IPsec-EAP vers <a href="/pages/radius-8021x">RADIUS (NPS)</a> et l’AD, avec l’extension MFA ou un TOTP — ce que l’ANSSI attend pour un accès distant : voir <a href="/pages/mfa-acces-conditionnel">MFA</a>.',
            'Le poste lui-même : un VPN d’entreprise ne devrait accepter que des postes gérés (certificat machine, conformité Intune). C’est là que le VPN rejoint le <a href="/pages/zero-trust-iam">zero trust</a>.'),

    '<h2>7) VPN et zero trust : ce qui change</h2>',
    '<p>Le VPN classique ouvre une porte sur <em>le réseau</em> : une fois dedans, le nomade voit ce que les règles '
    'lui laissent — souvent trop. Le modèle <strong>ZTNA</strong> (Zero Trust Network Access) donne accès à <em>des applications</em>, '
    'une par une, après vérification de l’identité <em>et</em> du poste, sans jamais mettre le poste « sur le réseau ». '
    'Les produits (Cloudflare Access, Zscaler, Entra Private Access, Tailscale…) remplacent le VPN pour les applications '
    'web et SSH ; le VPN reste pour le site-à-site et les protocoles qui ne se publient pas. En labo, on construit d’abord le '
    'VPN : c’est ce qu’il faut comprendre pour juger le reste.</p>',

    retenir('Un VPN <strong>encapsule, chiffre, authentifie</strong> le chemin ; il ne protège pas les extrémités.',
            '<strong>Nomade</strong> (par utilisateur) ≠ <strong>site-à-site</strong> (par équipement, permanent).',
            '<strong>IPsec</strong> : la norme des équipements et du cloud ; <strong>OpenVPN</strong> : l’authentification riche (MFA, AD), passe partout en TCP 443 ; <strong>WireGuard</strong> : simple, rapide, clés statiques, pas de MFA native.',
            '<strong>Split tunnel</strong> (réseaux internes seulement) ou <strong>full tunnel</strong> (tout) : un choix de PSSI.',
            'Ce qui casse : MTU, adressages qui se chevauchent, routage asymétrique, DNS non poussé, ports non ouverts, horloges.',
            'Le tunnel débouche dans une <strong>zone</strong> : des règles décident, pas la connexion.'),
    note('green', '➡️ La suite',
         '<a href="/pages/vpn-nomade">2 · L’accès nomade : WireGuard sur OPNsense, et OpenVPN quand il faut la MFA</a> · '
         '<a href="/pages/vpn-site-a-site">3 · Relier deux sites (IPsec, WireGuard) et exploiter</a> · '
         'le pas-à-pas dans l’interface : <a href="/pages/opnsense-vpn-ids">OPNsense : accès distants et détection d’intrusion</a>.'),
])

# ══════════════════════════════════════════════════════ 2. Nomade ══

NOMADE = '\n'.join([
    hero('Cours · Réseau', 'Le VPN nomade : mettre en place l’accès distant',
         'WireGuard sur OPNsense de bout en bout — serveur, pairs, règles, DNS, clients Windows et téléphone, '
         'diagnostic — puis OpenVPN quand il faut des comptes et la MFA. Avec ce qu’on donne à l’utilisateur, et ce '
         'qu’on lui retire quand il part.'),
    STYLE, bandeau(2),
    note('gray', '📚 Avant ce cours',
         '<a href="/pages/le-vpn">1 · Comprendre le VPN</a>, <a href="/pages/opnsense">OPNsense</a> et '
         '<a href="/pages/opnsense-segmentation">la segmentation</a> : le tunnel débouche dans une zone, et c’est le '
         'pare-feu qui décide.'),
    '<p>Le besoin : un utilisateur, depuis chez lui ou un hôtel, atteint le partage de fichiers, l’intranet et '
    'l’application métier comme au bureau — et rien d’autre. Le montage de référence en 2026 pour un labo ou une '
    'PME : <strong>WireGuard sur le pare-feu</strong>. On le construit ici entièrement, puis on voit quand '
    '<strong>OpenVPN</strong> reste le bon choix.</p>',

    '<h2>1) Le plan avant les clics</h2>',
    tab(['Élément', 'Valeur du labo', 'Pourquoi'], [
        ['Serveur VPN', 'OPNsense, interface WAN <code>198.51.100.1</code>', 'C’est le pare-feu qui porte le tunnel : une seule porte, ses règles'],
        ['Port', 'UDP <strong>51820</strong>', 'Le port WireGuard par défaut ; à ouvrir sur le WAN'],
        ['Réseau du tunnel', '<code>10.10.10.0/24</code> — serveur <code>.1</code>, nomades <code>.2</code>, <code>.3</code>…', 'Distinct de tous les LAN ; une adresse par pair, fixe'],
        ['Ce que les nomades atteignent', '<code>192.168.20.0/24</code> (serveurs), <code>192.168.30.0/24</code> (web)', 'Split tunnel : seuls ces réseaux passent dans le tunnel'],
        ['DNS poussé', '<code>192.168.20.10</code> (le DC) + suffixe <code>entreprise.local</code>', 'Pour joindre les serveurs par leur nom'],
        ['Zone d’arrivée', 'Interface <code>wg0</code> = zone « VPN »', 'Des règles dédiées : pas d’accès à l’administration du pare-feu, ni à la DMZ'],
    ]),

    '<h2>2) WireGuard sur OPNsense : le serveur (l’instance)</h2>',
    steps(menu('VPN › WireGuard › Instances › +') + ' : <strong>Name</strong> <code>wg-nomades</code>, <strong>Listen port</strong> <code>51820</code>, <strong>Tunnel address</strong> <code>10.10.10.1/24</code>. Le bouton <em>Generate</em> fabrique la paire de clés de l’instance : la <strong>clé publique</strong> affichée sera donnée à chaque client.',
          menu('Interfaces › Assignments') + ' : la nouvelle interface <code>wg0</code> apparaît, <strong>+</strong>, puis la renommer <code>VPN</code> et <strong>Enable</strong> (sans adresse : l’instance la porte déjà). C’est ce qui crée la <em>zone</em> et son onglet de règles.',
          menu('VPN › WireGuard › Settings') + ' : <strong>Enable WireGuard</strong>, Apply.',
          menu('Firewall › Rules › WAN › +') + ' : <strong>Pass</strong>, protocole <strong>UDP</strong>, destination <em>WAN address</em>, port <strong>51820</strong>, description « WireGuard entrant ». Sans elle, aucun client ne joindra le serveur.',
          menu('Firewall › Rules › VPN › +') + ' : <strong>Pass</strong>, source <em>VPN net</em>, destination <code>192.168.20.0/24</code> et <code>192.168.30.0/24</code> (un alias « Reseaux_internes »), ports selon la politique (445, 3389, 80/443, 22…). <strong>Rien vers <em>This Firewall</em></strong> sauf 53 (DNS) si c’est lui qui résout, et rien vers la DMZ.'),
    note('blue', '💡 Où est le NAT ?',
         'Nulle part : les nomades sont en 10.10.10.x, et les serveurs du LAN savent y répondre parce que leur '
         'passerelle est OPNsense, qui connaît <code>wg0</code>. Si un serveur a une autre passerelle (un routeur '
         'interne), il lui faut une route vers 10.10.10.0/24 — ou le NAT sortant sur <code>wg0</code> en dernier recours.'),

    '<h2>3) Les pairs : un par poste, jamais partagé</h2>',
    '<p>Une paire de clés se génère <strong>sur le poste</strong> (le client WireGuard le fait au premier '
    'lancement) ; ou, en labo, sur OPNsense qui affiche alors la configuration complète et un QR code. La clé '
    'privée du poste ne devrait jamais transiter — en labo on tolère, en production on la génère côté client.</p>',
    steps(menu('VPN › WireGuard › Peers › +') + ' : <strong>Name</strong> <code>portable-jean</code>, <strong>Public key</strong> (celle du poste), <strong>Allowed IPs</strong> <code>10.10.10.2/32</code> — l’adresse que ce pair a le droit d’utiliser, et rien d’autre.',
          'Rattacher le pair à l’instance <code>wg-nomades</code> (menu déroulant <em>Instances</em> du pair, ou onglet <em>Peers</em> de l’instance selon la version), Apply.',
          'Si OPNsense a généré la paire : bouton <em>QR code</em> pour un téléphone, ou copie de la configuration pour le poste.'),
    cmd('# Configuration cote poste : C:\\Users\\jean\\… > client WireGuard > Ajouter un tunnel > Ajouter un tunnel vide\n'
        '[Interface]\n'
        'PrivateKey = <cle privee du poste, generee par le client>\n'
        'Address = 10.10.10.2/32\n'
        'DNS = 192.168.20.10, entreprise.local\n'
        'MTU = 1420\n'
        '\n'
        '[Peer]\n'
        'PublicKey = <cle publique de l instance wg-nomades, affichee par OPNsense>\n'
        'Endpoint = vpn.entreprise.fr:51820            # ou 198.51.100.1:51820\n'
        'AllowedIPs = 192.168.20.0/24, 192.168.30.0/24   # split tunnel ; 0.0.0.0/0 pour un full tunnel\n'
        'PersistentKeepalive = 25                       # garde le NAT de la box ouvert'),
    tab(['Ligne', 'Ce qui se passe si elle est fausse'], [
        ['<code>Address</code> ≠ Allowed IPs du pair côté serveur', 'Handshake OK mais rien ne passe : le serveur refuse les paquets venant d’une adresse non autorisée'],
        ['<code>AllowedIPs</code> sans le réseau visé', 'Le poste envoie les paquets par sa route normale : « le VPN est connecté mais le serveur ne répond pas »'],
        ['<code>DNS</code> absent', 'Ping par IP OK, par nom KO'],
        ['<code>Endpoint</code> avec un nom qui ne résout pas depuis l’extérieur', 'Pas de handshake ; tester avec l’IP'],
        ['<code>PersistentKeepalive</code> absent derrière une box', 'Le tunnel « tombe » après quelques minutes d’inactivité et met du temps à revenir'],
    ]),

    '<h2>4) Vérifier, côté serveur et côté poste</h2>',
    cmd('# OPNsense (ou tout Linux WireGuard) : l etat des pairs\n'
        'wg show\n'
        'interface: wg0\n'
        '  public key: ...\n'
        '  listening port: 51820\n'
        'peer: <cle publique de portable-jean>\n'
        '  endpoint: 203.0.113.7:41821\n'
        '  allowed ips: 10.10.10.2/32\n'
        '  latest handshake: 12 seconds ago         <- s il n y a pas de handshake, rien n est arrive : port WAN, cles, endpoint\n'
        '  transfer: 1.2 MiB received, 8.4 MiB sent  <- reçu > 0 mais envoye = 0 : les regles VPN ou le routage retour\n'
        '\n'
        '# Poste Windows\n'
        'ping 10.10.10.1                 # le serveur du tunnel : prouve le tunnel\n'
        'ping 192.168.20.10              # un serveur du LAN : prouve les regles et le routage\n'
        'nslookup srv-fic01.entreprise.local   # prouve le DNS pousse\n'
        'Test-NetConnection 192.168.20.5 -Port 445'),
    tab(['Symptôme', 'Cause', 'Où regarder'], [
        ['Pas de <em>latest handshake</em>', 'UDP 51820 bloqué sur le WAN (règle, box sans redirection, FAI), clé publique fausse, endpoint faux', 'Règle WAN ; <code>Firewall › Log Files › Live View</code> filtré sur 51820 ; les clés comparées'],
        ['Handshake OK, ping 10.10.10.1 KO', 'Adresse du pair hors des Allowed IPs côté serveur', 'Le pair dans OPNsense : Allowed IPs = l’adresse du poste /32'],
        ['10.10.10.1 OK, 192.168.20.x KO', 'Règles de la zone VPN, ou AllowedIPs côté poste, ou passerelle du serveur', 'Live View : paquet bloqué sur VPN ? Sinon <code>tracert</code> depuis le poste et la passerelle du serveur'],
        ['Tout marche sauf les pages web / partages qui se figent', 'MTU', 'MTU 1420 côté poste ; <em>MSS clamping</em> sur l’interface VPN'],
        ['Marche en 4G, pas depuis l’hôtel', 'L’hôtel bloque UDP', 'C’est le cas d’OpenVPN en TCP 443 (§6)'],
    ]),

    '<h2>5) Ce qu’on donne à l’utilisateur — et ce qu’on retire</h2>',
    bullets('Le <strong>client</strong> (wireguard.com/install ; Windows, macOS, iOS, Android) et sa configuration : fichier <code>.conf</code> par un canal sûr, ou QR code sur son téléphone <em>devant lui</em>.',
            'Une <strong>fiche</strong> de deux paragraphes : activer le tunnel, ce qui est accessible, ce qui ne l’est pas (split tunnel), qui appeler ; et la règle : « la clé, c’est vous — pas de partage, pas de copie ».',
            'Un <strong>ticket</strong> à l’ouverture (qui, quel poste, quelle adresse 10.10.10.x) : le pair est nommé d’après le poste et la personne.',
            'Au <strong>départ</strong> ou à la perte du poste : supprimer le pair dans OPNsense — c’est la révocation, immédiate. C’est une ligne du <a href="/pages/cycle-vie-compte">cycle de vie d’un compte</a>.',
            'Une <strong>revue</strong> trimestrielle des pairs : <code>wg show</code> montre le dernier handshake — un pair muet depuis six mois n’a plus de raison d’exister.'),
    note('red', '🚨 La limite de WireGuard : personne ne vérifie la personne',
         'La clé prouve le <em>poste</em>. Poste volé, session ouverte : le voleur est « Jean ». Pour les accès sensibles, '
         'il faut une seconde vérification — un mot de passe et un code TOTP — que WireGuard ne sait pas faire seul. '
         'Trois réponses : chiffrer le disque du poste (BitLocker) et verrouiller la session ; ajouter une '
         'authentification applicative derrière (RDP avec NLA + MFA, le <a href="/pages/configurateur-bastion">bastion</a>) ; '
         'ou choisir OpenVPN.'),

    '<h2>6) OpenVPN quand il faut des comptes et la MFA</h2>',
    '<p>OpenVPN authentifie un <strong>certificat</strong> (le poste) <em>et</em> un <strong>compte</strong> (la personne), '
    'via l’AD et RADIUS avec MFA. Il passe en TCP 443 là où UDP est bloqué. C’est plus long à monter ; voici l’ossature '
    'sur OPNsense (le détail des écrans est dans <a href="/pages/opnsense-vpn-ids">le volet OPNsense</a>).</p>',
    steps('<strong>PKI</strong> : ' + menu('System › Trust › Authorities') + ' — une autorité interne « CA-VPN » ; puis un certificat <em>serveur</em> « vpn.entreprise.fr » (' + menu('System › Trust › Certificates') + '), et un certificat par <em>utilisateur</em>.',
          '<strong>Authentification des comptes</strong> : ' + menu('System › Access › Servers') + ' — un serveur RADIUS (NPS sur Windows Server, avec l’extension MFA ou un TOTP) ou LDAP vers l’AD. Test avec ' + menu('System › Access › Tester') + '.',
          '<strong>Serveur OpenVPN</strong> : ' + menu('VPN › OpenVPN › Instances › +') + ' (ou <em>Servers</em> selon la version) — rôle <em>Server</em>, protocole UDP 1194 (ou TCP 443), certificat serveur, CA, <strong>authentification : certificat + RADIUS</strong>, réseau du tunnel <code>10.10.20.0/24</code>, réseaux locaux poussés <code>192.168.20.0/24, 192.168.30.0/24</code>, DNS poussé.',
          '<strong>Interface et règles</strong> : assigner <code>ovpns1</code> comme zone « VPN-OVPN », règle WAN pour le port, règles de la zone comme pour WireGuard.',
          '<strong>Export client</strong> : ' + menu('VPN › OpenVPN › Client Export') + ' — un fichier <code>.ovpn</code> par utilisateur (certificat inclus, ou séparé), à importer dans le client OpenVPN Connect / GUI. À la connexion : certificat vérifié, puis compte + mot de passe + code MFA.',
          '<strong>Révoquer</strong> : ' + menu('System › Trust › Revocation') + ' — le certificat va dans la CRL, l’utilisateur est refusé même s’il a encore le fichier ; et le compte AD est désactivé.'),
    tab(['Critère', 'WireGuard', 'OpenVPN'], [
        ['Mise en place', '30 minutes', 'Une demi-journée avec la PKI et RADIUS'],
        ['Authentification', 'Clé du poste', 'Certificat + compte AD + MFA'],
        ['Révocation', 'Supprimer le pair', 'CRL + compte désactivé'],
        ['Traverse les réseaux filtrants', 'UDP seulement', 'TCP 443 possible'],
        ['Vitesse', 'Ligne', 'Correcte'],
        ['Le bon choix pour', 'Administrateurs, labo, PME avec postes chiffrés', 'Utilisateurs nombreux, exigence MFA, conformité'],
    ]),

    '<h2>7) Le VPN natif de Windows : IKEv2</h2>',
    '<p>Sans rien installer, Windows (comme iOS et Android) sait monter un tunnel <strong>IPsec IKEv2</strong> avec un '
    'certificat ou un compte EAP-MSCHAPv2 vérifié par RADIUS/NPS. OPNsense le sert par ' + menu('VPN › IPsec › Connections') +
    ' (mode <em>Mobile clients</em>). C’est l’option des flottes gérées par Intune (profil VPN poussé, connexion « Always On » '
    'avant l’ouverture de session). Plus délicat à déboguer (propositions, NAT-T), mais aucun client tiers.</p>',

    retenir('Le plan d’abord : réseau du tunnel distinct, réseaux atteignables, DNS poussé, zone d’arrivée avec ses règles.',
            'WireGuard sur OPNsense : <strong>instance</strong> (clés, port, adresse), interface assignée = zone, règle WAN UDP 51820, règles de la zone, un <strong>pair par poste</strong> avec <code>AllowedIPs</code> = son /32.',
            'Côté poste : <code>Address</code>, <code>DNS</code>, <code>MTU 1420</code>, <code>AllowedIPs</code> = réseaux internes (split), <code>PersistentKeepalive</code>.',
            'Diagnostic : <code>wg show</code> (handshake, transfert), puis ping 10.10.10.1 → serveur → nom.',
            'WireGuard prouve le poste ; <strong>OpenVPN</strong> (certificat + compte + MFA, TCP 443) ou <strong>IKEv2</strong> natif prouvent la personne.',
            'Ouvrir = ticket + fiche ; partir = supprimer le pair / révoquer le certificat ; revue trimestrielle des pairs.'),
    note('green', '➡️ La suite',
         '<a href="/pages/vpn-site-a-site">3 · Relier deux sites (IPsec, WireGuard), superviser et entretenir</a>.'),
])

# ══════════════════════════════════════════════════ 3. Site-à-site ══

SVG_SITES = (
    '<svg viewBox="0 0 760 200" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:760px;display:block;margin:10px auto;font-family:system-ui,sans-serif">'
    '<rect x="10" y="30" width="200" height="140" rx="12" fill="#ecfdf5" stroke="#059669" stroke-width="2"/><text x="110" y="52" text-anchor="middle" font-size="12" font-weight="700" fill="#065f46">Siège</text>'
    '<text x="110" y="74" text-anchor="middle" font-size="11" fill="#065f46">LAN 192.168.20.0/24</text><text x="110" y="92" text-anchor="middle" font-size="11" fill="#065f46">OPNsense-A · WAN 198.51.100.1</text>'
    '<text x="110" y="120" text-anchor="middle" font-size="10.5" fill="#334155">route : 192.168.50.0/24 → tunnel</text><text x="110" y="150" text-anchor="middle" font-size="10.5" fill="#334155">DC, fichiers, ERP</text>'
    '<rect x="550" y="30" width="200" height="140" rx="12" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/><text x="650" y="52" text-anchor="middle" font-size="12" font-weight="700" fill="#1e3a8a">Agence</text>'
    '<text x="650" y="74" text-anchor="middle" font-size="11" fill="#1e3a8a">LAN 192.168.50.0/24</text><text x="650" y="92" text-anchor="middle" font-size="11" fill="#1e3a8a">OPNsense-B · WAN 203.0.113.20</text>'
    '<text x="650" y="120" text-anchor="middle" font-size="10.5" fill="#334155">route : 192.168.20.0/24 → tunnel</text><text x="650" y="150" text-anchor="middle" font-size="10.5" fill="#334155">postes, imprimante, RODC</text>'
    '<rect x="240" y="70" width="280" height="60" rx="30" fill="#fef3c7" stroke="#d97706" stroke-width="2" stroke-dasharray="6 4"/>'
    '<text x="380" y="94" text-anchor="middle" font-size="12" font-weight="700" fill="#92400e">Internet — IPsec IKEv2 (ou WireGuard)</text>'
    '<text x="380" y="114" text-anchor="middle" font-size="10.5" fill="#92400e">permanent · authentifié par PSK ou certificats · surveillé</text>'
    '<line x1="210" y1="100" x2="240" y2="100" stroke="#64748b" stroke-width="2"/><line x1="520" y1="100" x2="550" y2="100" stroke="#64748b" stroke-width="2"/>'
    '</svg>')

SITES = '\n'.join([
    hero('Cours · Réseau', 'Le VPN site-à-site : relier deux sites, puis exploiter',
         'Deux pare-feux, un tunnel permanent : IPsec IKEv2 entre deux OPNsense pas à pas (propositions, phases, '
         'routes, règles), la variante WireGuard, le lien vers le cloud — et ce qu’on surveille, journalise et '
         'renouvelle pour que ça tienne des années.'),
    STYLE, bandeau(3),
    note('gray', '📚 Avant ce cours',
         '<a href="/pages/le-vpn">1 · Comprendre</a> (IKE, ESP, NAT-T) et <a href="/pages/vpn-nomade">2 · L’accès nomade</a>.'),
    '<p>Le siège et l’agence ont chacun leur pare-feu et leur réseau ; on veut que l’agence voie le contrôleur de '
    'domaine, les fichiers et l’ERP du siège comme s’ils étaient sur place. Le tunnel est monté par les équipements, '
    'tout le temps, sans que personne ne clique. IPsec est la norme de ce cas — tout pare-feu, tout routeur, tout '
    'cloud le parle. WireGuard fait pareil entre deux OPNsense (ou deux Linux) en plus simple.</p>',
    SVG_SITES,

    '<h2>1) Les conditions, avant de toucher aux pare-feux</h2>',
    tab(['Condition', 'Pourquoi', 'Si elle manque'], [
        ['<strong>Deux plans d’adressage différents</strong> (20.0/24 et 50.0/24)', 'Le routage doit savoir de quel côté est chaque adresse', 'NAT 1:1 dans le tunnel — possible, laid, à éviter : renuméroter l’agence avant'],
        ['Une <strong>adresse publique</strong> joignable de chaque côté (ou au moins d’un côté)', 'IKE doit atteindre son pair', 'Le côté sans IP fixe initie ; DNS dynamique ; ou le pair derrière NAT avec NAT-T'],
        ['<strong>UDP 500, UDP 4500, ESP</strong> autorisés vers le WAN', 'La négociation puis le trafic', 'Sans 4500 derrière un NAT : phase 1 OK, phase 2 muette'],
        ['<strong>Horloges à l’heure</strong> (NTP)', 'Certificats, rejeu', 'Renégociations en échec « aléatoires »'],
        ['Les <strong>mêmes propositions</strong> des deux côtés', 'IKE ne négocie que ce qui est commun', '« NO_PROPOSAL_CHOSEN » dans le journal'],
    ]),

    '<h2>2) IPsec IKEv2 entre deux OPNsense</h2>',
    '<p>Interface moderne (' + menu('VPN › IPsec › Connections') + ', OPNsense ≥ 23.1) : on décrit la <strong>connexion</strong>, '
    'ses <strong>authentifications locale et distante</strong>, et ses <strong>enfants</strong> (les paires de réseaux). '
    'À faire en miroir sur les deux pare-feux.</p>',
    steps('<strong>Pré-partagé ou certificats ?</strong> Pour deux pare-feux de la même organisation, un <strong>PSK</strong> long et aléatoire (' + menu('VPN › IPsec › Pre-Shared Keys') + ', 32 caractères générés) est acceptable ; entre organisations ou sur le long terme, des certificats de la PKI.',
          menu('VPN › IPsec › Connections › +') + ' — <strong>General</strong> : Proposals <code>aes256gcm16-sha256-modp2048</code> (AES-256-GCM, SHA-256, DH groupe 14), Version <strong>IKEv2</strong>, Local addresses = l’IP WAN, Remote addresses = l’IP WAN de l’autre. <strong>DPD</strong> (Dead Peer Detection) activé : 30 s.',
          '<strong>Local authentication</strong> : PSK, id = l’IP WAN locale (ou un FQDN) ; <strong>Remote authentication</strong> : PSK, id = l’IP WAN distante. Les identifiants doivent correspondre <em>croisés</em> de l’autre côté — la faute n° 1.',
          '<strong>Children › +</strong> : Local <code>192.168.20.0/24</code>, Remote <code>192.168.50.0/24</code>, ESP proposals <code>aes256gcm16-modp2048</code>, Mode <em>tunnel</em>, Start action <strong>Start</strong> (le siège initie), <em>Close action</em> = Start pour remonter seul.',
          menu('Firewall › Rules › WAN') + ' : <strong>Pass</strong> UDP 500, UDP 4500 et protocole <strong>ESP</strong> depuis l’IP WAN de l’autre site. ' + menu('Firewall › Rules › IPsec') + ' : ce que l’agence a le droit d’atteindre au siège (et inversement, de l’autre côté) — pas « any ».',
          menu('VPN › IPsec › Status Overview') + ' : la connexion apparaît, <em>Connect</em> ; puis <strong>Established</strong> avec ses SA. Test : depuis un poste de l’agence, <code>ping 192.168.20.10</code> ; le journal ' + menu('VPN › IPsec › Log File') + ' en cas d’échec.'),
    tab(['Journal dit…', 'Sens', 'Correction'], [
        ['<code>NO_PROPOSAL_CHOSEN</code>', 'Aucun algorithme commun (phase 1 ou 2)', 'Mêmes propositions des deux côtés, y compris le groupe DH'],
        ['<code>AUTHENTICATION_FAILED</code>', 'PSK différent, ou identifiants (IKE ID) qui ne correspondent pas', 'Recopier le PSK ; ids locaux/distants croisés'],
        ['<code>TS_UNACCEPTABLE</code>', 'Les réseaux de l’enfant ne correspondent pas (« traffic selectors »)', 'Local de A = Remote de B, exactement (masque compris)'],
        ['Established, mais rien ne passe', 'Règles IPsec absentes ; ou route/passerelle des serveurs ; ou un côté fait du NAT sortant sur le tunnel', 'Règles de la zone IPsec ; passerelle des serveurs = le pare-feu ; <em>Outbound NAT</em> : pas de règle pour 192.168.x vers 192.168.y'],
        ['Tombe toutes les heures puis revient', 'Renégociation (rekey) qui échoue d’un côté', 'Mêmes durées de vie ; laisser un seul côté initier'],
        ['Marche dans un sens', 'Routage asymétrique, ou DPD/Start action d’un seul côté', 'Un côté <em>Start</em>, l’autre <em>Trap</em> ou Start aussi ; vérifier les routes des deux LAN'],
    ]),
    note('blue', '💡 Routes : où sont-elles ?',
         'Avec IPsec en mode tunnel (« policy-based »), il n’y a pas de route à écrire : les <em>traffic selectors</em> '
         'des enfants disent au noyau quel trafic entre dans le tunnel. Les <strong>serveurs</strong>, eux, doivent avoir pour '
         'passerelle le pare-feu ; et un réseau derrière un routeur interne doit être ajouté comme enfant ou routé vers '
         'le pare-feu. La variante <em>route-based</em> (interface VTI) crée une interface et se route comme n’importe '
         'quel lien — utile avec OSPF ou plusieurs réseaux.'),

    '<h2>3) La même chose en WireGuard</h2>',
    '<p>Entre deux OPNsense (ou deux serveurs Linux), WireGuard fait un site-à-site en dix minutes : une instance de '
    'chaque côté, chacune est le pair de l’autre, et <code>AllowedIPs</code> porte le réseau distant.</p>',
    cmd('# Siege (OPNsense-A) : instance wg-agence, port 51821, tunnel 10.10.99.1/30\n'
        '#   pair "agence" : cle publique de B, endpoint 203.0.113.20:51821, AllowedIPs 10.10.99.2/32, 192.168.50.0/24, keepalive 25\n'
        '# Agence (OPNsense-B) : instance wg-siege, port 51821, tunnel 10.10.99.2/30\n'
        '#   pair "siege"  : cle publique de A, endpoint 198.51.100.1:51821, AllowedIPs 10.10.99.1/32, 192.168.20.0/24, keepalive 25\n'
        '# Puis, de chaque cote : interface assignee (zone), regle WAN UDP 51821, regles de la zone,\n'
        '# et une route statique : System > Routes > 192.168.50.0/24 via la passerelle wg (si elle n est pas ajoutee automatiquement).'),
    tab(['', 'IPsec IKEv2', 'WireGuard'], [
        ['Interopérabilité', 'Tout équipement, tout cloud', 'OPNsense/pfSense, Linux, Mikrotik… pas les vieux routeurs'],
        ['Mise en place', 'Précise (propositions, ids, enfants)', 'Simple (clés, AllowedIPs)'],
        ['Diagnostic', 'Journal verbeux mais explicite', '<code>wg show</code>, silence sinon'],
        ['Performance', 'Bonne', 'Meilleure'],
        ['Renouvellement des clés', 'Automatique (rekey)', 'Rotation manuelle des paires (à planifier)'],
        ['Choisir', 'Vers le cloud, entre organisations, exigence de conformité', 'Entre ses propres pare-feux'],
    ]),

    '<h2>4) Le cloud : relier le LAN à Azure ou AWS</h2>',
    bullets('Côté cloud, une <strong>passerelle VPN</strong> (Azure VPN Gateway, AWS Site-to-Site VPN) avec une IP publique, un PSK, et le préfixe du LAN déclaré (« Local Network Gateway » chez Azure).',
            'Côté OPNsense : la même connexion IPsec que ci-dessus, avec les propositions que le fournisseur documente (Azure : IKEv2, AES-256, SHA-256, DH 14 ; AWS impose souvent deux tunnels pour la redondance).',
            'Le cas d’usage TSSR : Entra Connect ou une VM Azure qui doit joindre le DC local, une sauvegarde vers le cloud, un serveur applicatif hébergé — voir <a href="/pages/cloud-premiers-pas">Le cloud : premiers pas</a>.',
            'Les alternatives quand IPsec ne suffit pas : ExpressRoute / Direct Connect (liaison privée), ou un VPN dans une VM cloud (WireGuard) pour un labo.'),

    '<h2>5) Exploiter : ce qu’on surveille</h2>',
    tab(['Quoi', 'Comment', 'Seuil / réaction'], [
        ['<strong>Le tunnel est monté</strong>', 'Supervision : <code>wg show</code> (dernier handshake &lt; 3 min) ou état IPsec (<code>swanctl --list-sas</code>) ; en Zabbix, un élément par tunnel ou un ping <em>à travers</em> le tunnel vers une IP de l’autre site', 'Down &gt; 2 min → CRITICAL ; voir <a href="/pages/installer-zabbix">Zabbix</a>'],
        ['<strong>Ce qui le traverse</strong>', 'Compteurs d’interface (<code>wg0</code>, <code>ipsec</code>) en SNMP ; NetFlow/Insight sur OPNsense', 'Un tunnel qui débite la nuit, une machine qui parle beaucoup à l’agence : à expliquer'],
        ['<strong>Les nomades connectés</strong>', 'Liste des pairs avec handshake récent ; journal OpenVPN des connexions/déconnexions', 'Une connexion à 3 h du matin depuis un pays inattendu = incident'],
        ['<strong>Les échecs</strong>', 'Journal IPsec (AUTHENTICATION_FAILED répétés), journal OpenVPN (mot de passe refusé), Live View sur le port VPN', 'Tentatives en rafale = force brute : bloquer la source'],
        ['<strong>La latence et les pertes</strong>', '<code>ping</code> et <code>mtr</code> à travers le tunnel, gardés en graphique', 'La qualité du lien FAI se lit là ; un tunnel « lent » est souvent une ligne saturée'],
    ]),

    '<h2>6) Entretenir</h2>',
    bullets('<strong>Mises à jour</strong> du pare-feu : un correctif de sécurité sur IPsec ou WireGuard se traite comme sur un service exposé — c’en est un (voir <a href="/pages/gerer-mises-a-jour">Gérer les mises à jour</a>). Fenêtre annoncée : le tunnel tombe pendant le redémarrage.',
            '<strong>Secrets</strong> : rotation du PSK annuelle (ou au départ de qui le connaissait), rotation des clés WireGuard site-à-site sur le même rythme, renouvellement des certificats avant expiration — dans le calendrier, pas de mémoire.',
            '<strong>Pairs et comptes</strong> : revue trimestrielle ; pair sans handshake depuis 90 jours = supprimé ; départ = suppression le jour même.',
            '<strong>Configuration sauvegardée</strong> après chaque changement (' + menu('System › Configuration › Backups') + ') : un pare-feu qui meurt se reconstruit avec ses tunnels.',
            '<strong>Documentation</strong> : le schéma avec les deux WAN, les réseaux de chaque enfant, les ports, où sont les secrets ; et la procédure « le tunnel est tombé » en dix lignes (Status Overview, journal, Connect, qui appeler chez le FAI).',
            '<strong>Redondance</strong> si le lien est critique : deux tunnels (deux WAN, ou IPsec + WireGuard en secours), et un test de bascule par semestre — c’est le PCA du lien, voir <a href="/pages/pra-pca">PRA / PCA</a>.'),

    '<h2>7) Dans la DMZ ou pas ?</h2>',
    '<p>Le service VPN écoute sur l’interface WAN du pare-feu lui-même : il n’est pas « dans » la DMZ, il est '
    'le pare-feu. Ce qui doit être pensé comme la DMZ, c’est la <strong>zone d’arrivée</strong> : les nomades et '
    'l’agence débouchent sur une interface à part, filtrée, sans accès à l’administration du pare-feu ni aux réseaux '
    'qui ne les concernent pas. Un serveur VPN <em>logiciel</em> (OpenVPN sur une VM, Linux WireGuard), lui, se place en '
    'DMZ avec une seule redirection de port — voir <a href="/pages/dmz-mise-en-place">Mettre en place une DMZ</a>.</p>',

    retenir('Site-à-site = monté par les <strong>équipements</strong>, permanent, authentifié par PSK ou certificats ; deux plans d’adressage différents, IP publique, UDP 500/4500 + ESP, NTP.',
            'IPsec IKEv2 sur OPNsense : connexion (propositions identiques, IKEv2, DPD), authentifications avec ids <strong>croisés</strong>, enfants = paires de réseaux <strong>miroir</strong>, règles WAN et zone IPsec, Status Overview.',
            'Le journal dit tout : NO_PROPOSAL_CHOSEN (algos), AUTHENTICATION_FAILED (PSK/ids), TS_UNACCEPTABLE (réseaux) ; « Established mais rien ne passe » = règles, passerelles, NAT.',
            'WireGuard site-à-site : deux instances pairs l’une de l’autre, <code>AllowedIPs</code> = réseau distant, une route ; plus simple entre ses propres pare-feux, IPsec vers le cloud et les autres.',
            'Exploiter : tunnel supervisé (handshake, ping à travers), trafic et échecs journalisés, secrets et certificats renouvelés au calendrier, revue des pairs, configuration sauvegardée, procédure « tunnel tombé », bascule testée.'),
    note('green', '🔗 Autour',
         '<a href="/pages/opnsense-vpn-ids">OPNsense : accès distants et détection d’intrusion</a> · '
         '<a href="/pages/le-pare-feu">Le pare-feu</a> · <a href="/pages/supervision">La supervision</a> · '
         '<a href="/pages/cloud-premiers-pas">Le cloud : premiers pas</a>.'),
])

PAGES = [
    ('le-vpn', 'Le VPN : comprendre',
     'Encapsulation, chiffrement, authentification ; nomade ou site-à-site ; IPsec, OpenVPN, WireGuard comparés ; split ou full tunnel ; MTU, adressage, routage, DNS ; authentification et MFA ; VPN et zero trust.',
     COMPRENDRE, SG,
     'Volet 1 — le tunnel, les trois familles de protocoles, nomade ou site-à-site, split ou full tunnel, ce qui casse.'),
    ('vpn-nomade', 'Le VPN nomade : mettre en place l’accès distant',
     'WireGuard sur OPNsense pas à pas (instance, zone, règles, pairs, client Windows/téléphone, DNS, diagnostic avec wg show), ce qu’on donne à l’utilisateur et ce qu’on retire ; OpenVPN avec certificats + compte + MFA ; IKEv2 natif.',
     NOMADE, SG,
     'Volet 2 — WireGuard sur OPNsense de bout en bout, le client, le diagnostic, OpenVPN quand il faut la MFA.'),
    ('vpn-site-a-site', 'Le VPN site-à-site : relier deux sites, puis exploiter',
     'IPsec IKEv2 entre deux OPNsense (propositions, ids croisés, enfants miroir, règles, journal décodé), WireGuard site-à-site, lien vers Azure/AWS, supervision du tunnel, entretien (secrets, certificats, pairs, sauvegardes, bascule).',
     SITES, SG,
     'Volet 3 — IPsec entre deux pare-feux, la variante WireGuard, le cloud, et ce qu’on surveille et renouvelle.'),
]

# `le-vpn` existe déjà : sa carte est retirée puis reposée pour prendre la nouvelle description.
LOTS = [(PAGES, RESEAU, ('le-vpn',))]

if __name__ == '__main__':
    for lot in LOTS:
        publier_lot(*lot)
    sys.exit(0)

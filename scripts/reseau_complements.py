# -*- coding: utf-8 -*-
"""
Chantier P3 du comparatif REAC 2026 : compléments réseau (compétence 4).

Le REAC cite le routage dynamique, le Wi-Fi d'entreprise (et le plateau de
l'épreuve a un point d'accès) et le proxy. Trois cours : OSPF dans
Cisco / Packet Tracer › Routeurs, Wi-Fi d'entreprise dans Réseau › Équipements,
proxy Squid dans Réseau › Sécurité & accès distant.

IDEMPOTENT.
"""
import sys

from _cours import (Categorie, STYLE, acc, bullets, cmd, hero, menu, note, publier_lot, retenir, steps, tab)

CISCO = Categorie('cat-cisco-packet-tracer', '🔀', 'Cisco / Packet Tracer', '', '#0891b2')
RESEAU = Categorie('cat-reseau', '🌐', 'Réseau', '', '#059669')

# ═══════════════════════════════════════════════════════════════ OSPF ══

OSPF = '\n'.join([
    hero('Cours · Cisco', 'OSPF : le routage dynamique',
         'Pourquoi les routes statiques ne tiennent pas au-delà de trois routeurs, comment OSPF '
         'découvre ses voisins et calcule les chemins, la configuration sur Cisco (Packet Tracer), '
         'la vérification et les pannes classiques.'),
    STYLE,
    note('gray', '📚 Avant ce cours',
         '<a href="/pages/procedure-atelier-reseau-az">Construire un réseau multi-routeurs de A à Z</a> — '
         'en routes statiques. OSPF les remplace.'),
    '<p>Avec deux routeurs, on écrit deux routes statiques. Avec six routeurs et douze réseaux, on en '
    'écrit soixante, et chaque ajout de réseau se propage à la main sur chaque routeur ; une liaison '
    'qui tombe n’est pas contournée. Le <strong>routage dynamique</strong> laisse les routeurs '
    's’échanger ce qu’ils connaissent et recalculer quand ça change. <strong>OSPF</strong> (Open '
    'Shortest Path First) est le protocole standard des réseaux d’entreprise.</p>',

    '<h2>1) Statique, dynamique, et les familles de protocoles</h2>',
    tab(['', 'Route statique', 'RIP', 'OSPF', 'EIGRP', 'BGP'], [
        ['Type', 'Manuelle', 'Vecteur de distance', '<strong>État de liens</strong>', 'Vecteur de distance avancé', 'Vecteur de chemin'],
        ['Métrique', '—', 'Nombre de sauts (max 15)', '<strong>Coût</strong> (fonction de la bande passante)', 'Bande passante + délai', 'Politiques'],
        ['Convergence', '—', 'Lente (minutes)', 'Rapide (secondes)', 'Rapide', 'Lente, volontairement'],
        ['Pour', 'Petits réseaux, route par défaut, cas particuliers', 'Laboratoire, historique', '<strong>L’entreprise</strong>, multi-constructeurs', 'Réseaux Cisco', 'Internet, entre opérateurs'],
        ['Distance administrative (Cisco)', '1', '120', '110', '90', '20 / 200'],
    ]),
    '<p>La <strong>distance administrative</strong> départage deux sources pour le même réseau : plus '
    'petite = préférée. Une route statique (1) l’emporte sur OSPF (110) ; c’est voulu, et c’est un '
    'piège en dépannage.</p>',

    '<h2>2) Comment OSPF fonctionne</h2>',
    steps('<strong>Voisinage</strong> : chaque routeur envoie des paquets <em>Hello</em> (multicast 224.0.0.5, toutes les 10 s sur Ethernet) sur ses interfaces OSPF. Deux routeurs sur le même lien deviennent voisins s’ils ont la <strong>même aire, le même masque, les mêmes temporisateurs, la même authentification</strong>.',
          '<strong>Échange</strong> : les voisins se décrivent leurs bases de données (DBD), demandent ce qui leur manque (LSR), reçoivent les annonces d’état de lien (<strong>LSA</strong>). L’adjacence passe par les états <em>Init → 2-Way → ExStart → Exchange → Loading → <strong>Full</strong></em>.',
          '<strong>Base de données</strong> (LSDB) : chaque routeur de l’aire finit avec la <strong>même carte</strong> complète du réseau — qui est relié à qui, avec quel coût.',
          '<strong>Calcul</strong> : chacun applique l’algorithme de Dijkstra (SPF) depuis lui-même et obtient le plus court chemin vers chaque réseau → la table de routage.',
          '<strong>Changement</strong> : une liaison tombe, le routeur concerné inonde une nouvelle LSA, tous recalculent — en quelques secondes.'),
    tab(['Notion', 'Sens', 'Ce qu’il faut savoir'], [
        ['<strong>Coût</strong>', '10<sup>8</sup> / bande passante (bps) par défaut : FastEthernet = 1, GigabitEthernet = 1 aussi (!), série 1,5 Mb/s = 64', 'Régler <code>auto-cost reference-bandwidth 10000</code> sur tous les routeurs pour distinguer Gig et 10 Gig ; ou forcer <code>ip ospf cost</code>'],
        ['<strong>Router ID</strong>', 'L’identité du routeur : configuré, sinon la plus haute IP de loopback, sinon la plus haute IP d’interface', 'Toujours le fixer (<code>router-id 1.1.1.1</code>) : lisible et stable'],
        ['<strong>Aire</strong>', 'Un domaine de calcul ; l’aire 0 (backbone) relie les autres', 'Une seule aire 0 suffit jusqu’à quelques dizaines de routeurs ; les aires multiples réduisent la taille de la LSDB'],
        ['<strong>DR / BDR</strong>', 'Sur un réseau multi-accès (Ethernet), un routeur désigné centralise les échanges', 'Élu par priorité puis Router ID ; <code>ip ospf priority 0</code> pour ne jamais être DR'],
        ['<strong>Interface passive</strong>', 'OSPF annonce le réseau mais n’envoie pas de Hello', 'Sur les interfaces vers les utilisateurs : sécurité et propreté'],
    ]),

    '<h2>3) Configurer sur Cisco (Packet Tracer)</h2>',
    '<p>Trois routeurs en triangle, un réseau utilisateurs derrière chacun, R1 avec la sortie Internet :</p>',
    cmd('R1 :  G0/0 10.0.12.1/30 ↔ R2      G0/1 10.0.13.1/30 ↔ R3      G0/2 192.168.1.1/24 (LAN A)      G0/3 → Internet (défaut)\n'
        'R2 :  G0/0 10.0.12.2/30 ↔ R1      G0/1 10.0.23.2/30 ↔ R3      G0/2 192.168.2.1/24 (LAN B)\n'
        'R3 :  G0/0 10.0.13.2/30 ↔ R1      G0/1 10.0.23.1/30 ↔ R2      G0/2 192.168.3.1/24 (LAN C)'),
    cmd('! R1\n'
        'router ospf 1\n'
        ' router-id 1.1.1.1\n'
        ' auto-cost reference-bandwidth 10000\n'
        ' network 10.0.12.0 0.0.0.3 area 0\n'
        ' network 10.0.13.0 0.0.0.3 area 0\n'
        ' network 192.168.1.0 0.0.0.255 area 0\n'
        ' passive-interface GigabitEthernet0/2\n'
        ' default-information originate          ! R1 annonce sa route par défaut aux autres\n'
        '!\n'
        'ip route 0.0.0.0 0.0.0.0 203.0.113.1     ! la sortie Internet de R1\n'
        '\n'
        '! R2 (même logique)\n'
        'router ospf 1\n'
        ' router-id 2.2.2.2\n'
        ' auto-cost reference-bandwidth 10000\n'
        ' network 10.0.12.0 0.0.0.3 area 0\n'
        ' network 10.0.23.0 0.0.0.3 area 0\n'
        ' network 192.168.2.0 0.0.0.255 area 0\n'
        ' passive-interface GigabitEthernet0/2'),
    bullets('<code>network</code> + <strong>masque inversé</strong> (wildcard) : il ne « crée » pas de réseau, il dit <em>sur quelles interfaces activer OSPF</em> — toute interface dont l’adresse tombe dans la plage. <code>0.0.0.3</code> = /30, <code>0.0.0.255</code> = /24.',
            'L’alternative moderne, interface par interface : <code>interface G0/0</code> → <code>ip ospf 1 area 0</code>. Plus lisible ; Packet Tracer le supporte sur les routeurs récents.',
            '<code>default-information originate</code> : seul le routeur qui a la vraie sortie Internet le fait ; les autres apprennent <code>O*E2 0.0.0.0/0</code>.',
            'Le processus (<code>ospf 1</code>) est local au routeur ; il n’a pas besoin d’être le même partout — mais l’aire, si.'),

    '<h2>4) Vérifier</h2>',
    cmd('R1# show ip ospf neighbor\n'
        'Neighbor ID     Pri   State           Dead Time   Address         Interface\n'
        '2.2.2.2           1   FULL/DR         00:00:35    10.0.12.2       GigabitEthernet0/0\n'
        '3.3.3.3           1   FULL/BDR        00:00:38    10.0.13.2       GigabitEthernet0/1\n'
        '\n'
        'R1# show ip route ospf\n'
        'O     192.168.2.0/24 [110/2] via 10.0.12.2, 00:05:12, GigabitEthernet0/0\n'
        'O     192.168.3.0/24 [110/2] via 10.0.13.2, 00:05:12, GigabitEthernet0/1\n'
        'O     10.0.23.0/30 [110/2] via 10.0.12.2, ... via 10.0.13.2, ...     <- deux chemins égaux : partage de charge\n'
        '\n'
        'R1# show ip ospf interface brief\n'
        'R1# show ip protocols                  ! router-id, réseaux annoncés, interfaces passives\n'
        'R1# show ip ospf database              ! la LSDB : identique sur tous les routeurs de l’aire'),
    '<p>Le test qui prouve la convergence : <code>shutdown</code> sur la liaison R1–R2, puis '
    '<code>traceroute 192.168.2.10</code> depuis le LAN A — le trafic passe par R3 en quelques secondes, '
    'sans toucher à rien. Remettre la liaison : il revient par le chemin le plus court.</p>',

    '<h2>5) Les pannes classiques</h2>',
    tab(['Symptôme', 'Cause', 'Vérification'], [
        ['Pas de voisin (<code>show ip ospf neighbor</code> vide)', 'Aire différente, masque différent sur le lien, temporisateurs différents, interface passive des deux côtés, <code>network</code> qui ne couvre pas l’interface', '<code>show ip ospf interface G0/0</code> des deux côtés ; <code>debug ip ospf adj</code> (avec parcimonie)'],
        ['Voisin bloqué en <em>EXSTART / EXCHANGE</em>', 'MTU différente entre les deux interfaces', '<code>ip ospf mtu-ignore</code> ou corriger la MTU'],
        ['Voisin en <em>2-WAY</em> et ça reste ainsi', 'Normal entre deux routeurs non-DR/BDR sur un même segment', 'Rien à faire'],
        ['La route est là, mais le trafic prend un mauvais chemin', 'Coûts par défaut identiques (Gig = Fast = 1), ou une route statique (AD 1) qui l’emporte', '<code>show ip route</code> : <code>S</code> devant la route ? Régler <code>reference-bandwidth</code>'],
        ['Pas de route par défaut sur R2 / R3', 'R1 n’a pas <code>default-information originate</code>, ou n’a pas lui-même de route par défaut', '<code>show ip route</code> sur R1 ; la commande accepte <code>always</code> pour annoncer sans route'],
        ['Les LAN ne se voient pas mais les liens oui', 'Le réseau LAN n’est pas dans un <code>network</code> ; ou l’interface est down (pas de câble / pas de <code>no shutdown</code>)', '<code>show ip protocols</code>, <code>show ip interface brief</code>'],
    ]),

    '<h2>6) Sécuriser et propreté</h2>',
    bullets('<strong>Authentification</strong> des voisins : <code>ip ospf authentication message-digest</code> + <code>ip ospf message-digest-key 1 md5 Cle</code> sur chaque interface de lien (ou <code>area 0 authentication message-digest</code>) — sans elle, un routeur pirate branché sur un lien injecte des routes.',
            '<strong>Interfaces passives</strong> partout où il n’y a pas de routeur en face (<code>passive-interface default</code> puis <code>no passive-interface G0/0</code>…).',
            '<strong>Router ID</strong> explicite, en loopback, documenté dans le schéma.',
            'Un seul protocole : pas de RIP <em>et</em> OSPF sur le même réseau sans redistribution maîtrisée.',
            'Le pare-feu (OPNsense) parle aussi OSPF (plugin FRR) : utile pour annoncer la route par défaut depuis le pare-feu — voir <a href="/pages/le-pare-feu">Le pare-feu</a>.'),

    retenir('Le routage dynamique remplace les routes statiques dès qu’il y a plus de deux ou trois routeurs ; <strong>OSPF</strong> est le standard d’entreprise (état de liens, coût, AD 110).',
            'Voisinage par Hello (même aire, masque, temporisateurs, authentification) → LSDB identique → Dijkstra → table de routage ; convergence en secondes.',
            'Configuration : <code>router ospf 1</code>, <code>router-id</code>, <code>network</code> + wildcard <code>area 0</code>, <code>passive-interface</code> côté utilisateurs, <code>default-information originate</code> sur le routeur de sortie, <code>reference-bandwidth</code> partout.',
            'Vérifier : <code>show ip ospf neighbor</code> (FULL), <code>show ip route ospf</code>, <code>show ip protocols</code> ; tester en coupant un lien.',
            'Pannes : pas de voisin (aire, masque, network, passive), EXSTART (MTU), mauvais chemin (coût, statique), pas de défaut (originate).'),
])

# ═══════════════════════════════════════════════════════ Wi-Fi d'entreprise ══

WIFI = '\n'.join([
    hero('Cours · Réseau', 'Le Wi-Fi d’entreprise',
         'Bandes et canaux, normes, ce qui distingue un Wi-Fi d’entreprise d’une box : plusieurs SSID '
         'sur des VLAN, WPA3-Enterprise avec 802.1X, contrôleur, réseau invités, couverture — et le '
         'dépannage du « Wi-Fi qui marche mal ».'),
    STYLE,
    note('gray', '📚 Avant ce cours',
         '<a href="/pages/vlan-securite">Les VLAN</a> et <a href="/pages/radius-8021x">RADIUS et 802.1X</a> : le '
         'Wi-Fi d’entreprise repose dessus.'),
    '<p>Le plateau de l’épreuve 2026 comprend un point d’accès et un poste avec accès sans fil ; '
    'l’incident réseau devant le jury peut être un incident Wi-Fi. Au-delà de l’examen, le Wi-Fi est '
    'le premier accès réseau des utilisateurs — et la première plainte du support.</p>',

    '<h2>1) Les bases radio</h2>',
    tab(['Bande', 'Canaux', 'Portée', 'Débit', 'Usage'], [
        ['<strong>2,4 GHz</strong>', '13 en Europe, mais seulement <strong>3 sans recouvrement</strong> (1, 6, 11)', 'Longue, traverse les murs', 'Faible, encombrée (micro-ondes, Bluetooth, voisins)', 'Objets connectés, imprimantes, vieux matériels'],
        ['<strong>5 GHz</strong>', '19 non recouvrants (avec DFS), largeur 20/40/80 MHz', 'Moyenne', 'Élevé', 'Les postes et téléphones : la bande principale'],
        ['<strong>6 GHz</strong> (Wi-Fi 6E / 7)', 'Beaucoup, sans matériel ancien', 'Courte', 'Très élevé', 'Bureaux denses, matériel récent'],
    ]),
    tab(['Norme', 'Nom', 'Débit max théorique', 'Apport'], [
        ['802.11n', 'Wi-Fi 4', '600 Mb/s', 'MIMO, 2,4 et 5 GHz'],
        ['802.11ac', 'Wi-Fi 5', '3,5 Gb/s', '5 GHz seulement, MU-MIMO descendant'],
        ['<strong>802.11ax</strong>', '<strong>Wi-Fi 6 / 6E</strong>', '9,6 Gb/s', 'OFDMA : efficace en environnement dense ; 6E ajoute le 6 GHz'],
        ['802.11be', 'Wi-Fi 7', '46 Gb/s', 'Canaux 320 MHz, multi-liens'],
    ]),
    note('blue', '💡 Le débit réel',
         'Divisez le débit théorique par 2 à 4 : le Wi-Fi est half-duplex, partagé entre tous les '
         'clients du point d’accès, et dégradé par la distance. Un point d’accès Wi-Fi 6 avec 30 '
         'portables donne 20 à 50 Mb/s à chacun — suffisant pour du bureau, pas pour sauvegarder '
         '100 Go.'),

    '<h2>2) Ce qui distingue le Wi-Fi d’entreprise</h2>',
    tab(['', 'Box / point d’accès grand public', 'Wi-Fi d’entreprise'], [
        ['Points d’accès', 'Un', 'Plusieurs, gérés ensemble par un <strong>contrôleur</strong> (matériel, logiciel, ou cloud : UniFi, Aruba Central, Meraki, Omada, Cisco WLC)'],
        ['SSID', 'Un, un mot de passe pour tous', 'Plusieurs, chacun sur un <strong>VLAN</strong> : utilisateurs, invités, objets connectés, téléphones'],
        ['Authentification', 'WPA2-Personal (PSK)', '<strong>WPA3 / WPA2-Enterprise</strong> : 802.1X, chaque utilisateur avec son compte ou son certificat'],
        ['Itinérance', 'Aucune', 'Le client passe d’un AP à l’autre sans coupure (802.11r/k/v)'],
        ['Alimentation', 'Secteur', '<strong>PoE</strong> depuis le commutateur : un seul câble'],
        ['Supervision', 'Aucune', 'Clients, débits, interférences, AP hors ligne → alertes'],
        ['Radio', 'Canal automatique', 'Plan de canaux et puissance gérés (RRM), déploiement étudié'],
    ]),

    '<h2>3) Les SSID et leurs VLAN</h2>',
    tab(['SSID', 'Sécurité', 'VLAN', 'Accès'], [
        ['<code>Entreprise</code>', 'WPA3-Enterprise (802.1X, EAP-TLS ou PEAP)', '20 (utilisateurs)', 'Tout le SI, comme en filaire'],
        ['<code>Entreprise-Invites</code>', 'WPA3-Personal ou portail captif, isolation client', '99 (invités)', 'Internet seulement, débit limité, 24 h'],
        ['<code>Entreprise-IoT</code>', 'WPA2-Personal (les objets ne font pas 802.1X), 2,4 GHz', '30 (IoT)', 'Le serveur qui les gère, rien d’autre'],
        ['SSID masqué', '—', '—', 'Ne sert à rien : masquer un SSID ne le cache pas d’un scanner, et complique les clients'],
    ]),
    '<p>Le point d’accès est branché sur un port <strong>trunk</strong> du commutateur (VLAN de gestion natif, '
    'VLAN 20, 30, 99 tagués). Chaque SSID est associé à un VLAN dans le contrôleur. C’est la source de '
    'l’incident classique : « le Wi-Fi marche mais on n’atteint pas le serveur » = mauvais VLAN sur le '
    'SSID ou VLAN absent du trunk.</p>',
    cmd('! commutateur Cisco, port du point d’accès\n'
        'interface GigabitEthernet1/0/24\n'
        ' description AP-ETAGE2-01\n'
        ' switchport mode trunk\n'
        ' switchport trunk native vlan 10          ! gestion des AP\n'
        ' switchport trunk allowed vlan 10,20,30,99\n'
        ' spanning-tree portfast trunk'),

    '<h2>4) WPA3-Enterprise et 802.1X</h2>',
    steps('Un serveur <strong>RADIUS</strong> (NPS sur Windows Server, FreeRADIUS) relié à l’AD — <a href="/pages/radius-8021x">RADIUS et 802.1X</a>.',
          'Un <strong>certificat serveur</strong> sur le RADIUS, émis par la <a href="/pages/pki-adcs">PKI interne</a> : les clients vérifient qu’ils parlent au vrai serveur (sinon un faux AP récupère les mots de passe).',
          'La méthode : <strong>PEAP-MSCHAPv2</strong> (compte et mot de passe AD ; simple) ou <strong>EAP-TLS</strong> (certificat sur le poste, déployé par GPO / Intune : le plus sûr, rien à taper).',
          'Le SSID en WPA3-Enterprise (ou WPA2-Enterprise en transition), pointant vers le RADIUS (adresse, port 1812, secret partagé).',
          'Le profil Wi-Fi <strong>déployé par GPO</strong> (' + menu('Configuration ordinateur › Paramètres Windows › Paramètres de sécurité › Stratégies de réseau sans fil') + ') ou Intune : SSID, méthode, validation du certificat serveur — l’utilisateur n’a rien à configurer.',
          'Le journal NPS (Observateur d’événements › Sécurité, ID 6272 accordé / 6273 refusé) pour le dépannage.'),
    note('red', '🚨 Le PSK partagé sur le SSID entreprise',
         'Un mot de passe unique connu de 200 personnes, écrit sur le tableau de la salle de réunion, '
         'jamais changé au départ d’un salarié : ce n’est pas une authentification. Le réseau '
         'utilisateurs est en 802.1X ; le PSK est réservé aux objets qui ne savent pas faire mieux, '
         'sur leur propre VLAN.'),

    '<h2>5) Le réseau invités</h2>',
    bullets('VLAN dédié, <strong>isolé</strong> du SI par le pare-feu (Internet seulement, et pas les réseaux internes).',
            '<strong>Isolation client</strong> sur le SSID : les invités ne se voient pas entre eux.',
            '<strong>Portail captif</strong> (contrôleur, ou OPNsense) : conditions d’utilisation, code du jour ou compte sponsorisé, durée limitée.',
            '<strong>Limitation de débit</strong> par client, et pas de priorité sur le trafic métier.',
            'La <strong>journalisation</strong> : en France, un fournisseur d’accès (ce qu’on devient en offrant le Wi-Fi) conserve les données de connexion un an (adresse, horodatage) — le portail captif s’en charge.'),

    '<h2>6) Déployer : couverture et canaux</h2>',
    bullets('<strong>Étude de site</strong> (même simple, avec une application d’analyse Wi-Fi) : un AP pour 200–300 m² de bureaux et 20–30 clients ; les murs porteurs et les vitrages coupent le 5 GHz.',
            'AP au <strong>plafond</strong>, centrés dans les zones, pas dans les couloirs ni derrière un meuble métallique.',
            '<strong>Canaux</strong> : en 2,4 GHz, 1 / 6 / 11 en alternance ; en 5 GHz, laisser le contrôleur gérer (RRM), largeur 40 MHz en bureaux (80 seulement si peu d’AP).',
            '<strong>Puissance</strong> : pas au maximum — un AP trop puissant garde des clients éloignés qui ralentissent tout le monde ; on préfère plus d’AP moins puissants.',
            '<strong>Débit minimal</strong> : désactiver les vitesses 802.11b (1, 2, 5,5, 11 Mb/s) pour forcer les clients à changer d’AP quand ils s’éloignent.',
            '<strong>PoE</strong> : vérifier le budget du commutateur (un AP Wi-Fi 6 demande 15 à 25 W, PoE+).',
            'Le <strong>nom</strong> et la position de chaque AP dans l’inventaire et le plan.'),

    '<h2>7) Dépanner « le Wi-Fi marche mal »</h2>',
    tab(['Symptôme', 'Cause probable', 'Vérification'], [
        ['Connecté, pas d’adresse (169.254.x.x)', 'VLAN du SSID absent du trunk, ou DHCP absent sur ce VLAN', '<code>show interfaces trunk</code> ; un client filaire sur le même VLAN a-t-il une adresse ?'],
        ['Connecté, Internet OK, serveur inaccessible', 'Mauvais SSID (invités), ou mauvais VLAN sur le SSID', 'L’adresse obtenue : 192.168.99.x = invités'],
        ['Authentification refusée', 'RADIUS injoignable, secret faux, certificat non approuvé, compte hors du groupe autorisé, mot de passe expiré', 'Journal NPS 6273 (motif), <code>show radius statistics</code> sur le contrôleur'],
        ['Lent dans une salle', 'Trop de clients sur un AP, canal saturé, client accroché à un AP lointain, 2,4 GHz', 'Contrôleur : clients par AP, RSSI (&lt; -70 dBm = mauvais), taux de retransmission ; analyseur de spectre'],
        ['Coupures en se déplaçant', 'Itinérance lente (pas de 802.11r), puissance trop forte, vitesses basses activées', 'Activer 802.11r/k/v, ajuster puissance et débit minimal'],
        ['Un AP hors ligne', 'PoE insuffisant, câble, port désactivé (err-disabled), AP non adopté par le contrôleur', '<code>show power inline</code>, <code>show interfaces status</code>, voyant de l’AP'],
        ['Seulement un modèle de téléphone', 'Pilote / version, WPA3 non supporté, DFS', 'Tester en WPA2 transition ; mettre à jour'],
    ]),
    cmd('# côté poste Windows : voir ce à quoi il est connecté\n'
        'netsh wlan show interfaces          # SSID, canal, bande, signal (%), débit, authentification\n'
        'netsh wlan show networks mode=bssid # tous les réseaux visibles, canaux, signal\n'
        'netsh wlan show profiles            # profils enregistrés ; delete name="X" pour repartir propre'),

    retenir('2,4 GHz porte loin mais 3 canaux ; <strong>5 GHz</strong> est la bande de travail ; Wi-Fi 6 pour la densité ; le débit réel est un quart du théorique.',
            'Entreprise = <strong>contrôleur</strong>, plusieurs <strong>SSID sur des VLAN</strong> (port trunk), PoE, itinérance, supervision.',
            'Utilisateurs en <strong>WPA3-Enterprise / 802.1X</strong> (RADIUS + certificat serveur + profil GPO) ; PSK réservé aux objets ; invités isolés avec portail.',
            'Déployer : AP au plafond, canaux 1/6/11 en 2,4, RRM en 5, puissance modérée, vitesses basses coupées, budget PoE.',
            'Dépanner : l’adresse obtenue dit le VLAN ; NPS 6273 dit pourquoi ; RSSI et clients par AP disent le débit ; <code>netsh wlan show interfaces</code> côté poste.'),
])

# ═══════════════════════════════════════════════════════════ Proxy Squid ══

PROXY = '\n'.join([
    hero('Cours · Réseau', 'Le proxy web : filtrer et journaliser avec Squid',
         'À quoi sert un proxy en entreprise, transparent ou explicite, installer Squid sur Debian, '
         'filtrer par listes et par catégories, authentifier, journaliser dans les règles — et '
         'l’alternative OPNsense.'),
    STYLE,
    note('gray', '📚 Avant ce cours',
         '<a href="/pages/le-pare-feu">Le pare-feu</a> filtre par adresses et ports ; le proxy filtre par '
         '<em>sites</em> et <em>contenus</em>. <a href="/pages/linux-bases">Linux : les bases</a> pour l’installation.'),
    '<p>Un <strong>proxy web</strong> s’intercale entre les navigateurs et Internet : il reçoit les '
    'requêtes HTTP / HTTPS, les autorise ou non, les journalise, parfois les met en cache, puis les '
    'relaie. Le REAC le cite parmi les services réseau qu’un TSSR installe et exploite ; en pratique, '
    'c’est l’outil du filtrage web (charte, protection des mineurs en établissement scolaire, '
    'sécurité) et de la traçabilité.</p>',

    '<h2>1) Pourquoi un proxy</h2>',
    tab(['Besoin', 'Ce que fait le proxy'], [
        ['<strong>Filtrer</strong>', 'Bloquer des catégories (jeux, adultes, streaming), des domaines, des types de fichiers ; appliquer la charte'],
        ['<strong>Journaliser</strong>', 'Qui a accédé à quoi, quand — obligation légale de conservation d’un an pour les données de connexion ; preuve en cas d’incident'],
        ['<strong>Sécuriser</strong>', 'Bloquer les domaines malveillants connus, les téléchargements exécutables, les sites d’hameçonnage ; analyser les contenus (antivirus, ICAP)'],
        ['<strong>Contrôler la sortie</strong>', 'Les postes n’ont <em>pas</em> d’accès direct à Internet : seul le proxy sort. Un logiciel malveillant qui ignore le proxy ne sort pas'],
        ['<strong>Économiser</strong>', 'Le cache : moins utile aujourd’hui (HTTPS partout), sauf pour les mises à jour Windows / Linux (cache dédié)'],
    ]),
    note('yellow', '⚠️ Filtrer, oui ; espionner, non',
         'Le filtrage et la journalisation sont légaux s’ils sont <strong>proportionnés</strong>, '
         '<strong>annoncés</strong> (charte informatique, information du CSE) et si les journaux ne servent '
         'pas à surveiller individuellement les salariés hors procédure. La CNIL a une fiche dédiée. '
         'Les journaux sont consultés pour un incident de sécurité ou une enquête formelle, pas par '
         'curiosité.'),

    '<h2>2) Explicite ou transparent</h2>',
    tab(['', 'Proxy explicite', 'Proxy transparent'], [
        ['Principe', 'Le navigateur est <strong>configuré</strong> pour envoyer tout au proxy (adresse:port)', 'Le pare-feu <strong>redirige</strong> le trafic 80/443 vers le proxy sans que le poste le sache'],
        ['Configuration des postes', 'Par GPO (proxy système), fichier PAC, ou WPAD (découverte automatique par DHCP option 252 / DNS)', 'Aucune'],
        ['HTTPS', 'Le navigateur fait un <code>CONNECT</code> : le proxy voit le domaine (SNI), pas le contenu ; il peut filtrer par domaine', 'Pour filtrer par domaine, le proxy lit le SNI ; pour voir le contenu, il faut une <strong>interception TLS</strong> (certificat interne sur tous les postes)'],
        ['Authentification', 'Possible (compte AD, Kerberos) : journaux nominatifs', 'Impossible (par IP seulement)'],
        ['Pour', 'L’entreprise avec AD : le standard', 'Les invités, les objets, les réseaux sans gestion des postes'],
    ]),
    '<p>Le pare-feu <strong>bloque la sortie directe</strong> en 80/443 depuis le VLAN utilisateurs (sauf '
    'depuis le proxy) : sinon, changer le paramètre du navigateur suffit à contourner le filtrage.</p>',

    '<h2>3) Installer Squid sur Debian</h2>',
    cmd('apt install -y squid\n'
        'cp /etc/squid/squid.conf /etc/squid/squid.conf.orig       # 8 000 lignes de commentaires : on repart d’un fichier court\n'
        'cat > /etc/squid/squid.conf <<\'EOF\'\n'
        '# --- réseau et port ---\n'
        'http_port 3128\n'
        'acl lan src 192.168.20.0/24 192.168.21.0/24\n'
        '\n'
        '# --- ports et méthodes autorisés ---\n'
        'acl SSL_ports port 443\n'
        'acl Safe_ports port 80 443 21 1025-65535\n'
        'acl CONNECT method CONNECT\n'
        'http_access deny !Safe_ports\n'
        'http_access deny CONNECT !SSL_ports\n'
        '\n'
        '# --- listes de filtrage ---\n'
        'acl bloques dstdomain "/etc/squid/listes/domaines-bloques.txt"\n'
        'acl autorises_toujours dstdomain "/etc/squid/listes/domaines-autorises.txt"\n'
        'acl exe urlpath_regex -i \\.(exe|msi|bat|scr|ps1)$\n'
        'acl pause time MTWHF 12:00-14:00\n'
        'acl reseaux_sociaux dstdomain .facebook.com .tiktok.com .instagram.com\n'
        '\n'
        'http_access allow lan autorises_toujours\n'
        'http_access deny lan bloques\n'
        'http_access deny lan exe\n'
        'http_access allow lan reseaux_sociaux pause         # tolérés à la pause déjeuner\n'
        'http_access deny lan reseaux_sociaux\n'
        'http_access allow lan\n'
        'http_access deny all\n'
        '\n'
        '# --- journaux ---\n'
        'access_log /var/log/squid/access.log squid\n'
        'logfile_rotate 365\n'
        '\n'
        '# --- cache : petit, on n’est plus en 2005 ---\n'
        'cache_dir ufs /var/spool/squid 2000 16 256\n'
        'cache_mem 256 MB\n'
        'EOF\n'
        'mkdir -p /etc/squid/listes && touch /etc/squid/listes/domaines-{bloques,autorises}.txt\n'
        'echo ".jeux-en-ligne.example" >> /etc/squid/listes/domaines-bloques.txt\n'
        'squid -k parse && systemctl restart squid && systemctl enable squid'),
    bullets('Les <code>http_access</code> se lisent <strong>dans l’ordre</strong> ; la première règle qui correspond décide. « allow autorisés » avant « deny bloqués » permet des exceptions.',
            '<code>dstdomain .exemple.com</code> avec le point initial couvre les sous-domaines.',
            '<code>squid -k parse</code> avant chaque redémarrage : une faute de syntaxe laisse tout le monde sans Internet.',
            'Tester depuis un poste : <code>curl -x http://192.168.10.5:3128 -I https://www.debian.org</code>, puis un domaine bloqué → <code>403</code> et une ligne <code>TCP_DENIED</code> dans le journal.'),

    '<h2>4) Filtrer par catégories</h2>',
    '<p>Écrire ses listes à la main ne tient pas. Des <strong>listes par catégories</strong> existent, '
    'maintenues : la <em>blacklist de l’Université Toulouse 1 Capitole</em> (libre, référence en France, '
    'utilisée par l’Éducation nationale), Shalla (arrêtée), des listes commerciales. Chaque catégorie est '
    'un dossier avec un fichier <code>domains</code>.</p>',
    cmd('cd /etc/squid && wget https://dsi.ut-capitole.fr/blacklists/download/blacklists.tar.gz && tar xzf blacklists.tar.gz\n'
        '# squid.conf\n'
        'acl cat_adult dstdomain "/etc/squid/blacklists/adult/domains"\n'
        'acl cat_malware dstdomain "/etc/squid/blacklists/malware/domains"\n'
        'acl cat_phishing dstdomain "/etc/squid/blacklists/phishing/domains"\n'
        'acl cat_games dstdomain "/etc/squid/blacklists/games/domains"\n'
        'http_access deny lan cat_malware\n'
        'http_access deny lan cat_phishing\n'
        'http_access deny lan cat_adult\n'
        '# mise à jour hebdomadaire par cron/timer, puis : squid -k reconfigure'),
    '<p>Pour des listes très grandes, <strong>SquidGuard</strong> ou <strong>ufdbGuard</strong> (redirecteurs '
    'avec base indexée) sont plus rapides que des ACL Squid, et gèrent une page de blocage par '
    'catégorie et des politiques par groupe.</p>',

    '<h2>5) Authentifier : des journaux nominatifs</h2>',
    '<p>Par IP, on sait quel <em>poste</em> ; par compte, on sait <em>qui</em> — et on applique des '
    'politiques par groupe AD (les RH ont accès aux réseaux sociaux, l’atelier non).</p>',
    cmd('# authentification de base contre l’AD (LDAP) — simple, mais le mot de passe transite : réservé au LAN, ou préférer Kerberos\n'
        'auth_param basic program /usr/lib/squid/basic_ldap_auth -R -b "DC=entreprise,DC=local" -D "CN=svc-squid,OU=Services,DC=entreprise,DC=local" -W /etc/squid/ldap.pass -f "sAMAccountName=%s" -h dc01.entreprise.local\n'
        'auth_param basic children 10\n'
        'auth_param basic realm Proxy Entreprise\n'
        'acl authentifies proxy_auth REQUIRED\n'
        '# groupe AD\n'
        'external_acl_type ad_group %LOGIN /usr/lib/squid/ext_ldap_group_acl -R -b "DC=entreprise,DC=local" -D "CN=svc-squid,..." -W /etc/squid/ldap.pass -f "(&(sAMAccountName=%v)(memberOf=CN=%g,OU=Groupes,DC=entreprise,DC=local))" -h dc01.entreprise.local\n'
        'acl grp_rh external ad_group G_Proxy_RH\n'
        'http_access allow authentifies grp_rh reseaux_sociaux\n'
        'http_access deny authentifies reseaux_sociaux\n'
        'http_access allow authentifies\n'
        'http_access deny all'),
    '<p>En production, l’authentification <strong>Kerberos</strong> (<code>negotiate_kerberos_auth</code>) '
    'est transparente pour l’utilisateur joint au domaine : aucune fenêtre de mot de passe. Le compte '
    'de service <code>svc-squid</code> a un droit de lecture seulement.</p>',

    '<h2>6) HTTPS : ce qu’on voit, ce qu’on ne voit pas</h2>',
    bullets('Sans interception, le proxy voit le <strong>nom du site</strong> (SNI / CONNECT) et le volume : assez pour filtrer par domaine et journaliser, pas pour lire les pages ni bloquer un fichier dans une page HTTPS.',
            'L’<strong>interception TLS</strong> (<code>ssl_bump</code>) déchiffre et rechiffre : Squid devient une autorité de certification que tous les postes doivent approuver (certificat déployé par GPO depuis la <a href="/pages/pki-adcs">PKI</a>). C’est intrusif : à décider avec le RSSI, à annoncer, à <strong>exclure</strong> pour la banque, la santé, les sites personnels sensibles (listes d’exclusion), et à éviter pour les applications qui épinglent leur certificat.',
            'La plupart des PME s’en tiennent au filtrage par domaine + antivirus sur les postes : proportionné et suffisant.'),

    '<h2>7) Journaux et exploitation</h2>',
    cmd('tail -f /var/log/squid/access.log\n'
        '1757840112.483   215 192.168.20.57 TCP_TUNNEL/200 5120 CONNECT www.debian.org:443 marie.martin HIER_DIRECT/151.101.2.132 -\n'
        '1757840120.019     0 192.168.20.57 TCP_DENIED/403 3941 GET http://jeux-en-ligne.example/ marie.martin HIER_NONE/- text/html\n'
        '#  horodatage  durée  client  résultat/code  octets  méthode  URL  utilisateur  ...\n'
        '\n'
        '# les 20 domaines les plus demandés aujourd’hui\n'
        'awk \'{print $7}\' /var/log/squid/access.log | sed -E \'s#^(https?://)?([^/:]+).*#\\2#\' | sort | uniq -c | sort -rn | head -20\n'
        '# les blocages\n'
        'grep TCP_DENIED /var/log/squid/access.log | awk \'{print $3, $7}\' | sort | uniq -c | sort -rn | head'),
    bullets('<strong>Rotation et conservation</strong> : un an (obligation légale), protégés (root et le groupe des administrateurs), sauvegardés.',
            '<strong>Rapports</strong> : SARG ou LightSquid génèrent des pages HTML par jour / utilisateur / site — utiles pour le dimensionnement, à manier avec la retenue vue plus haut.',
            '<strong>Supervision</strong> : le service, le port 3128, le disque des journaux, le temps de réponse (<code>squidclient mgr:info</code>) — voir <a href="/pages/supervision">La supervision</a>.',
            '<strong>Haute disponibilité</strong> : un proxy tombé = plus d’Internet pour personne. Deux proxies et un fichier PAC qui bascule, ou une VIP (keepalived).'),

    '<h2>8) L’alternative : le proxy d’OPNsense</h2>',
    '<p>OPNsense embarque Squid (' + menu('Services › Proxy Web') + ') avec une interface : listes de '
    'catégories importées (UT1), authentification LDAP, mode transparent, et l’intégration avec le '
    'pare-feu (redirection automatique). Pour une PME qui a déjà OPNsense, c’est souvent le plus '
    'simple — voir <a href="/pages/le-pare-feu">Le pare-feu</a> et la série '
    '<a href="/pages/tp-opnsense-installation">TP OPNsense</a>. Le principe et les règles restent ceux de ce cours.</p>',

    retenir('Le proxy <strong>filtre</strong> (domaines, catégories, types de fichiers), <strong>journalise</strong> (un an), <strong>sécurise</strong> (malware, hameçonnage) et devient la <strong>seule sortie</strong> web — le pare-feu bloque le reste.',
            '<strong>Explicite</strong> (GPO / PAC / WPAD, authentification possible) pour les postes gérés ; <strong>transparent</strong> pour les invités et les objets.',
            'Squid : fichier court, <code>http_access</code> dans l’ordre, listes UT1 par catégories, <code>squid -k parse</code> avant tout redémarrage.',
            'Authentification AD (LDAP en LAN, <strong>Kerberos</strong> en production) → journaux nominatifs et politiques par groupe.',
            'HTTPS : filtrage par domaine sans interception suffit le plus souvent ; l’interception TLS est une décision RSSI, annoncée, avec exclusions. Charte, CNIL, proportionnalité.'),
])

PAGES_CISCO = [
    ('ospf', 'OSPF : le routage dynamique',
     'Statique vs dynamique, comment OSPF fonctionne (Hello, LSDB, Dijkstra, coût, Router ID, aire, DR/BDR), configuration Cisco à trois routeurs, vérification, pannes classiques, authentification.',
     OSPF, 'Routeurs',
     'Pourquoi le routage dynamique, comment OSPF converge, la configuration Cisco, vérifier, dépanner, sécuriser.'),
]

PAGES_RESEAU = [
    ('wifi-entreprise', 'Le Wi-Fi d’entreprise',
     'Bandes et normes, contrôleur, SSID sur VLAN (trunk), WPA3-Enterprise avec 802.1X (RADIUS, certificat, GPO), réseau invités, couverture et canaux, dépannage.',
     WIFI, 'Équipements',
     'Radio et normes, ce qui distingue un Wi-Fi d’entreprise, SSID et VLAN, 802.1X, invités, déployer, dépanner.'),
    ('proxy-squid', 'Le proxy web : filtrer et journaliser avec Squid',
     'Pourquoi un proxy, explicite ou transparent, installer et configurer Squid, listes par catégories (UT1), authentification AD, HTTPS et interception, journaux et cadre légal, OPNsense.',
     PROXY, 'Sécurité &amp; accès distant',
     'Filtrer, journaliser, sécuriser la sortie web ; Squid sur Debian, catégories, authentification AD, HTTPS, journaux, OPNsense.'),
]

LOTS = [(PAGES_CISCO, CISCO), (PAGES_RESEAU, RESEAU)]

if __name__ == '__main__':
    for lot in LOTS:
        publier_lot(*lot)
    sys.exit(0)

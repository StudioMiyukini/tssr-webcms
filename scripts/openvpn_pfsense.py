# -*- coding: utf-8 -*-
"""
Un cours pratique : OpenVPN en accès distant sur pfSense.

D'OÙ VIENT LE CONTENU
Un TP fourni — « OpenVPN sur pfSense » : installer pfSense, créer la chaîne de
certificats (autorité, certificat serveur, utilisateur + certificat client),
configurer un serveur OpenVPN Remote Access (SSL/TLS + User Auth), exporter la
configuration du client avec le greffon openvpn-client-export, ouvrir les règles
de pare-feu, et tester par un accès RDP à une machine interne.

POURQUOI UNE PAGE À CÔTÉ DE LA SÉRIE VPN, PAS DEDANS
La série `le-vpn` / `vpn-nomade` / `vpn-site-a-site` est centrée OPNsense et
WireGuard, avec OpenVPN évoqué « quand il faut la MFA ». Ce TP est le pas-à-pas
concret d'OpenVPN sur **pfSense** (chaîne de certificats, assistant, export
client), l'autre grand pare-feu libre. On en fait une page dédiée, rangée dans
le même sous-groupe « Sécurité & accès distant », et on la relie à la série :
elle est le « comment le faire vraiment » du §6 de `vpn-nomade`.

pfSense N'EST PAS OPNsense : mêmes concepts (les deux dérivent de m0n0wall),
menus différents. Le cours suit les écrans pfSense du TP et signale, quand
c'est utile, où OPNsense place la même chose.

IDEMPOTENT : relancer met à jour la page, ne duplique pas sa carte dans l'index,
recalcule les compteurs. Ajoute aussi un renvoi depuis `vpn-nomade` vers cette
page (une seule fois).
"""
import re
import sqlite3
import sys
from pathlib import Path

from _cours import (Categorie, STYLE, acc, bullets, cmd, hero, menu, note,
                    publier_lot, retenir, steps, tab)

BASE = Path(__file__).resolve().parent.parent / 'cms.sqlite'

RESEAU = Categorie('cat-reseau', '🌐', 'Réseau', '', '#059669')
SG = 'Sécurité &amp; accès distant'

# ── un schéma : le tunnel nomade, split tunnel ────────────────────────────────
SVG = (
    '<svg viewBox="0 0 560 250" role="img" aria-label="Un client nomade monte un tunnel OpenVPN vers '
    'pfSense et atteint le LAN interne, le reste de son trafic passant en direct par Internet" '
    'style="max-width:560px;width:100%;height:auto;margin:8px 0 14px;font-family:system-ui,sans-serif">'
    '<rect x="16" y="92" width="118" height="64" rx="9" fill="#0f766e"/>'
    '<text x="75" y="116" text-anchor="middle" font-size="12" fill="#fff" font-weight="bold">Client nomade</text>'
    '<text x="75" y="132" text-anchor="middle" font-size="9" fill="#ccfbf1">OpenVPN + .ovpn</text>'
    '<text x="75" y="146" text-anchor="middle" font-size="9" fill="#ccfbf1">tun : 10.0.8.x</text>'
    # tunnel
    '<line x1="134" y1="116" x2="244" y2="116" stroke="#7c3aed" stroke-width="4" stroke-dasharray="2 5" stroke-linecap="round"/>'
    '<text x="189" y="104" text-anchor="middle" font-size="9.5" fill="#7c3aed" font-weight="bold">tunnel chiffré</text>'
    '<text x="189" y="132" text-anchor="middle" font-size="8.5" fill="#7c3aed">UDP 1194</text>'
    # internet cloud below the tunnel
    '<ellipse cx="189" cy="200" rx="60" ry="24" fill="#94a3b8"/>'
    '<text x="189" y="204" text-anchor="middle" font-size="11" fill="#fff" font-weight="bold">Internet</text>'
    '<line x1="75" y1="156" x2="150" y2="182" stroke="#cbd5e1" stroke-width="2"/>'
    '<text x="70" y="176" font-size="8" fill="#64748b">web, mail : direct</text>'
    # pfSense
    '<rect x="244" y="84" width="120" height="80" rx="10" fill="#dc2626"/>'
    '<text x="304" y="110" text-anchor="middle" font-size="13" fill="#fff" font-weight="bold">pfSense</text>'
    '<text x="304" y="127" text-anchor="middle" font-size="9.5" fill="#fecaca">serveur OpenVPN</text>'
    '<text x="304" y="141" text-anchor="middle" font-size="9" fill="#fff">WAN .x &middot; LAN .254</text>'
    '<text x="304" y="154" text-anchor="middle" font-size="8.5" fill="#fecaca">CA + certificats</text>'
    # LAN
    '<line x1="364" y1="120" x2="430" y2="120" stroke="#16a34a" stroke-width="2.5"/>'
    '<rect x="430" y="80" width="118" height="52" rx="8" fill="#059669"/>'
    '<text x="489" y="100" text-anchor="middle" font-size="11.5" fill="#fff" font-weight="bold">LAN interne</text>'
    '<text x="489" y="115" text-anchor="middle" font-size="9" fill="#d1fae5">10.0.0.0/24</text>'
    '<text x="489" y="127" text-anchor="middle" font-size="8.5" fill="#d1fae5">poste Windows &middot; RDP</text>'
    '<line x1="489" y1="132" x2="489" y2="158" stroke="#16a34a" stroke-width="2"/>'
    '<rect x="436" y="158" width="106" height="40" rx="7" fill="#047857"/>'
    '<text x="489" y="175" text-anchor="middle" font-size="10" fill="#fff" font-weight="bold">Windows</text>'
    '<text x="489" y="189" text-anchor="middle" font-size="8.5" fill="#d1fae5">3389 / RDP</text>'
    '<text x="280" y="242" text-anchor="middle" font-size="10.5" fill="#64748b">'
    'Split tunnel : seules les IP du LAN passent par le VPN &mdash; le reste va droit sur Internet</text>'
    '</svg>')


def qr(q, a):
    return (f'<p style="border:1px solid var(--border);border-left:3px solid var(--accent);'
            f'background:var(--surface-2);border-radius:8px;padding:9px 13px;margin:9px 0">'
            f'<span style="font-weight:600">{q}</span> '
            f'<span style="color:var(--text-soft);font-size:13.5px">{a}</span></p>')


PAGE = '\n'.join([
    hero('Cours · Réseau', 'OpenVPN sur pfSense : l’accès distant pas à pas',
         'La chaîne de certificats, l’assistant serveur en Remote Access (SSL/TLS + authentification), '
         'l’export du profil client, les règles de pare-feu, et le test par un accès RDP au réseau '
         'interne — le VPN nomade d’OpenVPN, monté de bout en bout sur pfSense.'),
    STYLE,
    note('blue', '🎯 L’objectif',
         'Mettre en place un <strong>OpenVPN d’accès distant</strong> sur pfSense pour qu’un poste '
         'extérieur atteigne les machines du LAN comme s’il y était — ici, un accès Bureau à distance '
         '(RDP) à une machine Windows interne, à travers un tunnel chiffré. Ce cours est le '
         '« comment » concret du <a href="/pages/vpn-nomade">§6 de « L’accès nomade »</a> ; pour le '
         '<em>pourquoi</em> (encapsulation, split vs full tunnel, les familles de protocoles), voir '
         '<a href="/pages/le-vpn">Le VPN — comprendre</a>.'),
    SVG,
    note('gray', '🧭 pfSense ou OPNsense ?',
         'Les deux dérivent du même ancêtre : mêmes concepts, menus différents. Ce cours suit les '
         'écrans <strong>pfSense</strong>. Sur OPNsense, la même chaîne se retrouve dans '
         '<span class="lx-cmd" style="display:inline;padding:1px 6px">System › Trust</span> pour les '
         'certificats et <span class="lx-cmd" style="display:inline;padding:1px 6px">VPN › OpenVPN › '
         'Instances</span> pour le serveur — voir le '
         '<a href="/pages/opnsense-vpn-ids">volet OPNsense · accès distants</a>.'),

    '<h2>1) La maquette</h2>',
    '<p>pfSense en machine virtuelle, <strong>deux cartes</strong> : une en accès externe (pont / '
    'bridge, côté WAN), une sur le réseau interne <code>10.0.0.0/24</code>. Derrière, un poste '
    'Windows (7, 10, ou un Windows Server) sur ce même réseau interne, qui servira de cible RDP. On '
    'administre pfSense par son interface web depuis un poste du LAN.</p>',
    tab(['Élément', 'Réglage'],
        [['Système invité', 'FreeBSD 64 bits'],
         ['Ressources', '2 cœurs, 1 Go de RAM, 10 Go de disque'],
         ['Carte 1 (WAN)', 'Mode pont (bridge) — accès à l’extérieur'],
         ['Carte 2 (LAN)', 'Réseau interne <code>10.0.0.0/24</code>'],
         ['ISO', 'pfSense CE amd64, décompressée du <code>.iso.gz</code> (7-Zip, WinRAR…)']]),
    note('yellow', '⚠️ Un VPN se monte sur des certificats — donc sur l’heure',
         'Un certificat a une date de début et de fin. Si l’horloge de pfSense est fausse, le '
         'serveur peut juger le certificat « pas encore valide » ou « expiré » et refuser la '
         'connexion sans raison apparente. Vérifier que l’heure et le fuseau sont justes '
         '(<span class="lx-cmd" style="display:inline;padding:1px 6px">System › General Setup</span>) '
         'avant de se battre avec le tunnel.'),

    '<h2>2) La chaîne de certificats</h2>',
    '<p>OpenVPN en SSL/TLS chiffre et authentifie le tunnel avec des certificats. Il en faut '
    '<strong>trois</strong>, dans cet ordre — chacun signé par le précédent :</p>',
    steps(
        '<strong>L’autorité de certification (CA)</strong> — celle qui signera tout le reste. '
        + menu('System › Certificates › Authorities › Add') + '. <em>Descriptive name</em> : '
        '« pandora-cert » ; méthode <em>Create an internal Certificate Authority</em> ; '
        '<em>Common Name</em> « pandoravpn ». Remplir pays / région / ville / organisation, '
        '<em>Save</em>.',
        '<strong>Le certificat du serveur</strong> — l’identité de pfSense pour le VPN. '
        + menu('Certificates › Certificates › Add/Sign') + '. Méthode <em>Create an internal '
        'Certificate</em>, nom « pandora-openvpn », <em>Common Name</em> « pandoravpn ». Le point '
        'qui compte : <em>Certificate Type</em> = <strong>Server Certificate</strong> (et non '
        'utilisateur), sinon OpenVPN refusera de l’utiliser comme certificat serveur. <em>Save</em>.',
        '<strong>L’utilisateur et son certificat client</strong>. '
        + menu('System › User Manager › Add') + '. Nom d’utilisateur « user », mot de passe (le '
        'fameux <code>Azerty77</code> du labo), nom complet ; cocher <strong>Click to create a '
        'user certificate</strong>, nom « pandora-user ». <em>Save</em>. Le certificat client est '
        'ainsi lié au compte : à la connexion, OpenVPN vérifiera <em>le certificat</em> (le poste) '
        '<em>et</em> <em>le mot de passe</em> (la personne).'),
    qr('Pourquoi trois certificats et pas un ?',
       'Parce qu’ils jouent trois rôles distincts. La <strong>CA</strong> est la racine de '
       'confiance : c’est sa signature qui rend les autres valables, et c’est elle qu’on révoque '
       'pour tout invalider d’un coup. Le <strong>certificat serveur</strong> prouve au client '
       'qu’il parle bien à <em>votre</em> pfSense (pas à un imposteur). Le <strong>certificat '
       'client</strong> prouve au serveur que ce poste est autorisé — révocable individuellement, '
       'sans toucher aux autres.'),

    '<h2>3) Le serveur OpenVPN</h2>',
    '<p>' + menu('VPN › OpenVPN › Servers › Add') + '. Les choix qui structurent tout le reste :</p>',
    tab(['Champ', 'Valeur', 'Pourquoi'],
        [['Server mode', '<strong>Remote Access (SSL/TLS + User Auth)</strong>',
          'Un client se connecte à un site (pas du pair-à-pair), avec la double preuve certificat + compte'],
         ['Protocol / Port', '<code>UDP</code> / <code>1194</code>',
          'OpenVPN est en UDP par défaut ; changer le port est une bonne habitude (moins de bruit de scan), laissé par défaut ici'],
         ['Peer Certificate Authority', '<code>pandora-cert</code>', 'La CA créée au §2'],
         ['Server Certificate', '<code>pandora-openvpn</code>', 'Le certificat serveur du §2'],
         ['Encryption', 'Par défaut (ex. <code>CHACHA20-POLY1305</code> ou AES-GCM)',
          'Les valeurs par défaut sont déjà solides ; CHACHA20-POLY1305 est le plus rapide sur mobile']]),
    '<h3>Le réseau du tunnel</h3>',
    tab(['Champ', 'Valeur', 'Rôle'],
        [['IPv4 Tunnel Network', '<code>10.0.8.0/24</code>',
          'Le réseau <em>virtuel</em> interne au VPN ; chaque client y reçoit une adresse'],
         ['Redirect IPv4 Gateway', '<strong>décoché</strong>',
          'Coché = <em>full tunnel</em> (tout le trafic du client passe par le VPN, comme un NordVPN). Décoché = <em>split tunnel</em>'],
         ['IPv4 Local Network(s)', '<code>10.0.0.0/24</code>',
          'Les seules destinations routées dans le tunnel : le LAN distant. Le reste du trafic du client sort en direct'],
         ['Concurrent Connections', 'selon le besoin', 'Le nombre de clients simultanés admis']]),
    qr('Split tunnel ou full tunnel ?',
       'Ici, <strong>split</strong> : le client va sur Internet <em>sans</em> VPN, et ne bascule '
       'dans le tunnel que pour joindre une IP du LAN (10.0.0.0/24). C’est plus léger et ça '
       'n’expose pas toute la navigation de l’utilisateur au pare-feu. Le <em>full tunnel</em> '
       '(cocher <em>Redirect Gateway</em>) sert quand on veut justement tout faire passer par '
       'l’entreprise — filtrage, journalisation, sortie par une IP maîtrisée.'),
    '<h3>Les réglages client</h3>',
    tab(['Option', 'Choix', 'Conséquence'],
        [['Topology', '<strong>subnet</strong> (une IP par client) ou <em>net30</em>',
          'Historiquement net30 enfermait chaque client dans un /30 (4 IP consommées) ; <em>subnet</em> est aujourd’hui la valeur saine — l’isolation entre clients se fait par les règles, pas par le découpage'],
         ['DNS Default Domain / Servers', 'à activer si besoin',
          'Pousser le nom de domaine interne et un résolveur du LAN au client'],
         ['Custom Options', '<code>auth-nocache</code>',
          'Empêche le client de garder les identifiants en mémoire — bonne pratique']]),
    note('gray', '📝 Une nuance sur la topologie',
         'Le TP d’origine choisit <em>net30</em> « pour enfermer chaque utilisateur dans son petit '
         'réseau ». En pratique, la topologie <strong>subnet</strong> est recommandée depuis '
         'longtemps (une seule IP par client, plus simple, plus économe) ; l’isolation entre '
         'clients du VPN se règle par une case dédiée et par les <strong>règles de pare-feu</strong> '
         'de l’interface OpenVPN, pas par la taille du sous-réseau. On retient le principe — '
         '« un client ne doit pas voir les autres » — et on l’applique là où il se règle vraiment.'),

    '<h2>4) Exporter le profil du client</h2>',
    '<p>pfSense ne sait pas générer de fichier <code>.ovpn</code> tout seul : on lui ajoute le '
    'greffon. ' + menu('System › Package Manager › Available Packages') + ', chercher '
    '<code>openvpn</code>, installer <strong>openvpn-client-export</strong>.</p>',
    steps(
        'Retour dans ' + menu('VPN › OpenVPN › Client Export') + '.',
        'Ajouter <code>auth-nocache</code> dans <em>Additional configuration options</em>, puis '
        '<em>Save as default</em>.',
        'Plus bas, dans <em>Inline Configurations</em>, cliquer <strong>Most Clients</strong> : '
        'cela télécharge un <code>.ovpn</code> auto-suffisant (certificats inclus) que l’utilisateur '
        'dépose dans le dossier <code>config</code> de son client OpenVPN.'),
    qr('Que contient ce fichier .ovpn, et à qui le confier ?',
       'L’adresse du serveur (l’IP WAN de pfSense), le port, les paramètres du tunnel, la CA et le '
       '<strong>certificat client</strong> (donc une clé privée). C’est un secret : il '
       's’<strong>transmet par un canal sûr</strong>, un par utilisateur. Le perdre, c’est '
       'permettre à quelqu’un d’autre de tenter la connexion — d’où l’intérêt de la révocation par '
       'la CRL et du second facteur qu’est le mot de passe du compte.'),

    '<h2>5) Les règles de pare-feu</h2>',
    '<p>Deux règles, sur deux interfaces différentes — ne pas les confondre :</p>',
    steps(
        '<strong>Laisser entrer le VPN.</strong> ' + menu('Firewall › Rules › WAN › Add') + ' : '
        '<em>Action</em> Pass, <em>Interface</em> WAN, <em>Protocol</em> <code>UDP</code>, '
        '<em>Source</em> any, <em>Destination port</em> <code>1194</code> (ou le port choisi). '
        'C’est ce qui autorise l’arrivée des connexions OpenVPN sur pfSense.',
        '<strong>Autoriser ce que le client fait une fois dans le tunnel.</strong> '
        + menu('Firewall › Rules › OpenVPN › Add') + ' : l’interface n’est plus WAN mais '
        '<code>OpenVPN</code>. Pour le test RDP : Pass, TCP, <em>Source</em> any, '
        '<em>Destination</em> l’IP du poste Windows, <em>port</em> <code>3389</code>.',
        '<strong>Appliquer.</strong> <em>Apply Changes</em> — sans quoi les règles sont enregistrées '
        'mais pas actives.'),
    note('yellow', '⚠️ Le tunnel qui monte mais ne « sert » à rien',
         'Symptôme classique : le client se connecte (l’icône passe au vert) mais aucune ressource '
         'interne ne répond. Presque toujours, c’est la <strong>seconde</strong> règle qui manque : '
         'l’interface <code>OpenVPN</code> a, elle aussi, son refus par défaut. Monter le tunnel '
         '(règle WAN) et <em>autoriser le trafic dedans</em> (règle OpenVPN) sont deux choses '
         'distinctes — exactement comme le NAT et sa règle de filtrage au '
         '<a href="/pages/tp-opnsense-nat">TP 1.3</a>.'),

    '<h2>6) Le test, côté client</h2>',
    steps(
        'Installer le <strong>client OpenVPN</strong> (OpenVPN Connect / OpenVPN GUI) sur le poste '
        'physique extérieur.',
        'Y placer le <code>.ovpn</code> exporté, puis se connecter — le certificat est vérifié, '
        'puis le compte et le mot de passe demandés.',
        'Le tunnel monté, ouvrir une session <strong>Bureau à distance</strong> vers l’IP interne '
        'du poste Windows. (Penser à activer le Bureau à distance sur la cible et à ouvrir le '
        'port 3389 dans son pare-feu Windows.)'),
    cmd('# sur le poste nomade, une fois le tunnel actif :\nipconfig            # une carte TAP/tun a pris une IP en 10.0.8.x\nping 10.0.0.10      # une machine du LAN interne repond a travers le tunnel\nmstsc /v:10.0.0.10  # Bureau a distance vers le poste Windows interne'),
    acc(
        ('🔍 « Ça se connecte puis ça coupe » — par où chercher',
         '<ul class="proc-steps">'
         '<li><strong>Le journal serveur</strong> : ' + menu('Status › OpenVPN') + ' et '
         + menu('Status › System Logs › OpenVPN') + ' — la cause y est presque toujours nommée.</li>'
         '<li><strong>TLS / certificat</strong> : « certificate is not yet valid » = horloge '
         'fausse (§1) ; « VERIFY error » = mauvaise CA ou certificat serveur non typé <em>Server</em>.</li>'
         '<li><strong>UDP filtré</strong> : certains réseaux d’hôtel bloquent l’UDP sortant. '
         'Bascule possible du serveur en <strong>TCP 443</strong>, qui passe presque partout '
         '(mais un peu plus lent).</li>'
         '<li><strong>Adressages qui se chevauchent</strong> : si le réseau local du nomade est '
         'aussi en 10.0.0.0/24, sa route locale gagne et le LAN distant reste injoignable — un '
         'grand classique du VPN nomade (voir <a href="/pages/le-vpn">Le VPN — comprendre</a>).</li>'
         '</ul>'),
        ('🔒 Révoquer un accès',
         '<p>Un poste perdu, un départ : ' + menu('System › Cert. Manager › Certificate Revocation')
         + ' — créer une CRL liée à la CA, y ajouter le certificat de l’utilisateur, et la '
         'sélectionner dans la configuration du serveur OpenVPN. Le fichier <code>.ovpn</code> '
         'devient inutilisable même s’il a été copié, et le compte peut être désactivé en '
         'complément dans <em>User Manager</em>. C’est tout l’intérêt d’avoir une CA interne '
         'plutôt qu’une clé partagée unique.</p>'),
    ),

    retenir(
        'OpenVPN <strong>Remote Access</strong> repose sur une chaîne : une CA interne signe un '
        'certificat <em>serveur</em> (typé Server !) et un certificat <em>client</em> par '
        'utilisateur, lié à un compte.',
        'Le <strong>split tunnel</strong> ne route dans le VPN que les réseaux locaux déclarés '
        '(<em>IPv4 Local Networks</em>), en laissant <em>Redirect Gateway</em> décoché.',
        'Le greffon <strong>openvpn-client-export</strong> produit le <code>.ovpn</code> auto-suffisant '
        '— un secret, un par personne, transmis par un canal sûr.',
        'Il faut <strong>deux règles</strong> : une sur WAN pour laisser entrer le tunnel, une sur '
        'l’interface OpenVPN pour autoriser le trafic une fois dedans.',
        'Certificats = horloge juste, et révocation par <strong>CRL</strong> : c’est ce qui '
        'distingue un VPN d’entreprise d’une clé partagée qu’on ne peut pas retirer.',
    ),
    note('gray', '🔗 Dans la même série',
         '<a href="/pages/le-vpn">Le VPN — comprendre</a> · '
         '<a href="/pages/vpn-nomade">L’accès nomade (WireGuard, OpenVPN, IKEv2)</a> · '
         '<a href="/pages/vpn-site-a-site">Le VPN site-à-site</a> · '
         '<a href="/pages/opnsense-vpn-ids">OPNsense · accès distants &amp; IDS</a> · '
         '<a href="/pages/pki-adcs">Certificats, PKI &amp; AD CS</a>.'),
])

EXTRAIT = ('La chaîne de certificats (CA, serveur, client), l’assistant OpenVPN Remote Access '
           '(SSL/TLS + User Auth), l’export du profil .ovpn, les deux règles de pare-feu, et le test '
           'par RDP au LAN interne — le VPN nomade OpenVPN monté de bout en bout sur pfSense.')
DESCRIPTION = ('Le pas-à-pas OpenVPN sur pfSense : certificats, serveur Remote Access, export client, '
               'règles de pare-feu, test RDP — le « comment » concret de l’accès nomade.')

PAGES = [('openvpn-pfsense', 'OpenVPN sur pfSense : l’accès distant pas à pas',
          EXTRAIT, PAGE, SG, DESCRIPTION)]


def renvoi_vpn_nomade(c):
    """Un lien vers cette page depuis le §6 (OpenVPN) de vpn-nomade, une seule fois."""
    row = c.execute("SELECT content FROM pages WHERE slug='vpn-nomade'").fetchone()
    if not row:
        return 'vpn-nomade absent'
    html = row[0]
    if '/pages/openvpn-pfsense' in html:
        return 'renvoi déjà présent'
    # Ancre : la fin de la section 6 (juste avant la section 7 IKEv2).
    ancre = '<h2>7) Le VPN natif de Windows'
    if ancre not in html:
        return 'ancre §7 introuvable — renvoi non posé'
    lien = ('<p style="border:1px solid var(--border);border-left:3px solid var(--accent);'
            'background:var(--surface-2);border-radius:8px;padding:9px 13px;margin:10px 0">'
            '👉 <strong>Le même montage, écran par écran, sur pfSense</strong> : '
            '<a href="/pages/openvpn-pfsense">OpenVPN sur pfSense — l’accès distant pas à pas</a> '
            '(chaîne de certificats, assistant Remote Access, export du profil, test RDP).</p>')
    html = html.replace(ancre, lien + ancre, 1)
    c.execute("UPDATE pages SET content=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') "
              "WHERE slug='vpn-nomade'", (html,))
    return 'renvoi posé dans vpn-nomade'


if __name__ == '__main__':
    publier_lot(PAGES, RESEAU)
    c = sqlite3.connect(BASE)
    print(renvoi_vpn_nomade(c).encode('ascii', 'replace').decode('ascii'))
    c.commit()
    c.close()
    sys.exit(0)

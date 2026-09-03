# -*- coding: utf-8 -*-
"""
Volets 4 et 5 du cours OPNsense : segmentation, puis accès distants et IDS.

CES DEUX-LÀ CLÔTURENT LA SÉRIE.
Le volet 4 crée des zones ; le volet 5 y raccorde des gens de l'extérieur et
surveille ce qui y circule. L'un ne se conçoit pas sans l'autre : un VPN qui
débouche sur un réseau plat annule le travail de segmentation, et c'est
précisément ce qui est dit au § 6 du volet 5.

Après leur publication, VOLETS (dans opnsense_serie.py) les marque comme parus :
les bandeaux des volets 1 à 3 se mettent à jour au prochain passage de leurs
scripts, qui sont idempotents.

IDEMPOTENT.
"""
import sqlite3
import sys
from pathlib import Path

from opnsense_serie import (STYLE, acc, bandeau, menu, note, publier, ranger_dans_index)

BASE = Path(__file__).resolve().parent.parent / 'cms.sqlite'

# ══════════════════════════════════════════ Volet 4 — segmentation ══

SVG_ZONES = (
    '<svg viewBox="0 0 470 268" role="img" '
    'aria-label="Quatre zones raccordées au pare-feu, et ce qui a le droit de parler à quoi" '
    'style="max-width:470px;width:100%;height:auto;margin:8px 0 12px;'
    'font-family:system-ui,sans-serif">'
    '<ellipse cx="50" cy="36" rx="44" ry="24" fill="#64748b"/>'
    '<text x="50" y="41" text-anchor="middle" font-size="11.5" fill="#fff" font-weight="bold">Internet</text>'
    '<line x1="94" y1="36" x2="150" y2="36" stroke="#94a3b8" stroke-width="2.5"/>'
    '<rect x="150" y="16" width="118" height="230" rx="10" fill="#dc2626"/>'
    '<text x="209" y="40" text-anchor="middle" font-size="13" fill="#fff" font-weight="bold">OPNsense</text>'
    '<text x="209" y="58" text-anchor="middle" font-size="9.5" fill="#fecaca">une zone = une interface</text>'
    # les quatre zones
    '<line x1="268" y1="88" x2="330" y2="88" stroke="#16a34a" stroke-width="2.5"/>'
    '<rect x="330" y="70" width="130" height="36" rx="7" fill="#059669"/>'
    '<text x="395" y="86" text-anchor="middle" font-size="11" fill="#fff" font-weight="bold">LAN</text>'
    '<text x="395" y="99" text-anchor="middle" font-size="9" fill="#d1fae5">192.168.10.0/24</text>'
    '<line x1="268" y1="134" x2="330" y2="134" stroke="#f59e0b" stroke-width="2.5"/>'
    '<rect x="330" y="116" width="130" height="36" rx="7" fill="#d97706"/>'
    '<text x="395" y="132" text-anchor="middle" font-size="11" fill="#fff" font-weight="bold">DMZ</text>'
    '<text x="395" y="145" text-anchor="middle" font-size="9" fill="#fef3c7">192.168.20.0/24</text>'
    '<line x1="268" y1="180" x2="330" y2="180" stroke="#7c3aed" stroke-width="2.5"/>'
    '<rect x="330" y="162" width="130" height="36" rx="7" fill="#7c3aed"/>'
    '<text x="395" y="178" text-anchor="middle" font-size="11" fill="#fff" font-weight="bold">IOT</text>'
    '<text x="395" y="191" text-anchor="middle" font-size="9" fill="#ede9fe">192.168.30.0/24</text>'
    '<line x1="268" y1="226" x2="330" y2="226" stroke="#0891b2" stroke-width="2.5"/>'
    '<rect x="330" y="208" width="130" height="36" rx="7" fill="#0891b2"/>'
    '<text x="395" y="224" text-anchor="middle" font-size="11" fill="#fff" font-weight="bold">INVITES</text>'
    '<text x="395" y="237" text-anchor="middle" font-size="9" fill="#cffafe">192.168.40.0/24</text>'
    '<text x="235" y="262" text-anchor="middle" font-size="10.5" fill="#64748b">'
    'Aucune zone ne parle à une autre tant qu’une règle ne l’autorise pas</text>'
    '</svg>')

SEGMENTATION = '\n'.join([
    '<section class="hero"><span class="pill">Cours · Réseau</span>'
    '<h1>OPNsense : segmenter le réseau (DMZ, VLAN, règles inter-zones)</h1>'
    '<p>Volet 4 — découper le réseau en zones, les créer par carte physique ou par VLAN, et écrire '
    'la matrice de flux qui décide qui a le droit de parler à qui.</p>'
    '</section>',
    STYLE,
    bandeau('opnsense-segmentation'),

    note('blue', '📚 Avant ce volet',
         'Les <a href="/pages/opnsense">volets 1</a> à <a href="/pages/opnsense-services">3</a>. La '
         'notion de VLAN elle-même est traitée dans <a href="/pages/les-vlan">Les VLAN</a> et '
         '<a href="/pages/vlan-securite">Sécuriser les VLAN</a> — ici on la met en œuvre côté '
         'pare-feu.'),

    '<h2>1) Pourquoi découper</h2>',
    '<p>Un réseau plat, c’est une seule pièce où tout le monde se voit. La caméra IP y voit le '
    'serveur de compta ; le portable d’un visiteur y voit les imprimantes ; un poste infecté y '
    'trouve tout le reste en quelques secondes.</p>',
    '<p>C’est le <strong>mouvement latéral</strong> : l’intrusion initiale ne vaut que par ce qu’elle '
    'permet d’atteindre <em>ensuite</em>. Segmenter ne l’empêche pas — segmenter fait qu’elle ne '
    'mène nulle part.</p>',
    SVG_ZONES,
    note('gray', '💡 Ce qui décide d’une zone',
         'Pas la technologie, mais le <strong>niveau de confiance</strong> et ce que la zone doit '
         'pouvoir joindre. On sépare ce qu’on ne maîtrise pas (objets connectés, visiteurs), ce qui '
         'est exposé (DMZ) et ce qui est sensible (serveurs, administration). Trois zones bien '
         'choisies valent mieux que dix mal découpées.'),

    '<h2>2) Deux façons d’ajouter une zone</h2>',
    '<table class="lx-tab"><tr><th></th><th>Une carte de plus</th><th>Des VLAN sur une carte</th></tr>'
    '<tr><td>Matériel</td><td>Une carte réseau par zone</td><td>Une seule carte, un lien '
    '<strong>trunk</strong> vers un switch gérant le 802.1Q</td></tr>'
    '<tr><td>Limite</td><td>Le nombre de ports du boîtier</td><td>La bande passante du lien '
    'unique, partagée par toutes les zones</td></tr>'
    '<tr><td>Isolation</td><td>Physique</td><td>Logique — elle vaut ce que vaut la configuration '
    'du switch</td></tr>'
    '<tr><td>Quand</td><td>2 ou 3 zones, du matériel disponible</td><td>Dès qu’il y en a '
    'plusieurs, ou en maquette</td></tr></table>',
    '<p>Côté règles de filtrage, <strong>rien ne change</strong> : chaque zone devient un onglet, '
    'qu’elle vienne d’une carte ou d’un VLAN. Le choix est matériel, pas conceptuel.</p>',

    '<h2>3) Ajouter une interface physique</h2>',
    '<ul class="proc-steps">'
    f'<li>{menu("Interfaces › Assignments")} : la nouvelle carte apparaît en bas, on l’ajoute — elle '
    'devient <code>OPT1</code>.</li>'
    f'<li>{menu("Interfaces › [OPT1]")} : cocher <strong>Enable</strong>, la renommer '
    '(<code>DMZ</code>), choisir <em>Static IPv4</em> et poser l’adresse : '
    '<code>192.168.20.254/24</code>.</li>'
    f'<li>{menu("Services › DHCP › [DMZ]")} : une étendue si la zone en a besoin — une DMZ de '
    'serveurs, plutôt pas.</li>'
    '<li><strong>Écrire les règles</strong> de la zone : sans elles, rien n’en sort. C’est le § 5.</li>'
    '</ul>',
    note('yellow', '⚠️ Une interface activée sans règle est une zone morte',
         'C’est normal et voulu : contrairement au LAN, une interface <code>OPT</code> ne reçoit '
         '<strong>aucune règle par défaut</strong>. Les machines de la zone obtiennent une adresse, '
         'pinguent leur passerelle… et rien d’autre. Ce n’est pas une panne, c’est le refus implicite.'),

    '<h2>4) Créer des VLAN</h2>',
    f'<p>{menu("Interfaces › Other Types › VLAN")}, puis un VLAN par zone :</p>',
    '<table class="lx-tab"><tr><th>Champ</th><th>Valeur</th><th>Remarque</th></tr>'
    '<tr><td>Parent interface</td><td>La carte physique reliée au switch</td>'
    '<td>La même pour tous les VLAN</td></tr>'
    '<tr><td>VLAN tag</td><td><code>20</code></td><td>Doit correspondre <strong>exactement</strong> '
    'au numéro configuré sur le switch</td></tr>'
    '<tr><td>Description</td><td><em>DMZ</em></td><td>C’est ce qu’on lira dans la liste des '
    'interfaces</td></tr></table>',
    f'<p>Chaque VLAN créé se comporte ensuite comme une carte : on l’assigne dans '
    f'{menu("Interfaces › Assignments")}, on l’active, on lui donne son adresse.</p>',
    note('red', '🚨 Le lien vers le switch doit être un trunk',
         'Le port du switch qui va vers OPNsense doit être en mode <strong>trunk</strong> et laisser '
         'passer les VLAN concernés étiquetés. S’il est en mode accès, le pare-feu reçoit des trames '
         'sans étiquette et <strong>aucun</strong> VLAN ne fonctionne — alors que la configuration '
         'côté OPNsense est parfaite. Voir '
         '<a href="/pages/procedure-vlan-packet-tracer">Mettre en place des VLAN</a>.'),
    acc(
        ('🖥️ En maquette Hyper-V : le trunk se déclare en PowerShell',
         '<p>L’interface graphique d’Hyper-V ne propose qu’un VLAN unique par carte. Pour recevoir '
         'plusieurs VLAN étiquetés, il faut passer la carte en mode trunk en ligne de commande, sur '
         'l’hôte :</p>'
         '<div class="lx-cmd">Set-VMNetworkAdapterVlan -VMName "OPNSENSE" `\n'
         '  -VMNetworkAdapterName "LAN" -Trunk `\n'
         '  -AllowedVlanIdList "20,30,40" -NativeVlanId 0\n\n'
         'Get-VMNetworkAdapterVlan -VMName "OPNSENSE"</div>'
         '<p>Sans cela, les trames étiquetées sont jetées par le commutateur virtuel avant même '
         'd’atteindre la machine — et l’on cherche l’erreur dans OPNsense, où il n’y en a pas.</p>'),
        ('🔀 C’est le même principe que le « routeur sur un bâton »',
         '<p>Un lien unique porte plusieurs VLAN étiquetés, et l’équipement de niveau 3 crée une '
         'sous-interface par VLAN pour les router entre eux. C’est exactement ce que fait ici '
         'OPNsense — à ceci près qu’il <strong>filtre</strong> en même temps qu’il route, là où un '
         'routeur Cisco laisse passer tant qu’aucune ACL ne dit le contraire.</p>'),
    ),

    '<h2>5) La matrice de flux</h2>',
    '<p>Avant d’écrire la moindre règle, on écrit le tableau. C’est lui le vrai travail : les règles '
    'n’en sont que la transcription.</p>',
    '<table class="lx-tab">'
    '<tr><th>De ↓ vers →</th><th>Internet</th><th>LAN</th><th>DMZ</th><th>IOT</th><th>Le pare-feu</th></tr>'
    '<tr><th>LAN</th><td>✔ web, DNS, mail</td><td>—</td><td>✔ vers les serveurs publiés</td>'
    '<td>✔ pilotage</td><td>✔ DNS, admin</td></tr>'
    '<tr><th>DMZ</th><td>✔ mises à jour</td><td><strong>✘</strong></td><td>—</td>'
    '<td><strong>✘</strong></td><td>✔ DNS seul</td></tr>'
    '<tr><th>IOT</th><td>✔ ou ✘ selon les objets</td><td><strong>✘</strong></td>'
    '<td><strong>✘</strong></td><td>—</td><td>✔ DNS, DHCP</td></tr>'
    '<tr><th>INVITES</th><td>✔ web seulement</td><td><strong>✘</strong></td><td><strong>✘</strong></td>'
    '<td><strong>✘</strong></td><td>✔ DNS, DHCP</td></tr></table>',
    note('green', '💡 Lire la colonne, pas la ligne',
         'Les croix sont le cœur du dispositif. Une DMZ qui ne peut pas joindre le LAN, c’est un '
         'serveur web compromis qui ne mène à rien. Un réseau d’objets connectés qui ne voit rien '
         'd’autre qu’Internet, c’est une caméra vulnérable qui reste un problème de caméra.'),

    '<h2>6) Traduire la matrice en règles</h2>',
    '<p>Le point délicat : « sortir sur Internet » et « joindre les autres zones » ne se distinguent '
    'pas tout seuls, parce que <code>any</code> veut dire <em>tout</em>, y compris les réseaux '
    'voisins. On procède donc en deux temps, dans cet ordre.</p>',
    f'<p>D’abord un alias — {menu("Firewall › Aliases")}, type <em>Network(s)</em> :</p>',
    '<div class="lx-cmd">Nom : RESEAUX_INTERNES\n'
    '10.0.0.0/8\n172.16.0.0/12\n192.168.0.0/16</div>',
    '<p>Puis, sur l’onglet de la zone, les règles <strong>dans cet ordre</strong> :</p>',
    '<table class="lx-tab"><tr><th>#</th><th>Action</th><th>Destination</th><th>Rôle</th></tr>'
    '<tr><td>1</td><td>Pass</td><td>Cette interface, port 53</td><td>Laisser le DNS du pare-feu '
    'répondre</td></tr>'
    '<tr><td>2</td><td>Block</td><td><em>This Firewall</em></td><td>Interdire l’accès à '
    'l’administration depuis cette zone</td></tr>'
    '<tr><td>3</td><td>Block</td><td><code>RESEAUX_INTERNES</code></td><td><strong>Couper le '
    'passage vers les autres zones</strong></td></tr>'
    '<tr><td>4</td><td>Pass</td><td><code>any</code>, ports 80/443</td><td>Sortir sur Internet — ce '
    'qui reste après la règle 3</td></tr></table>',
    note('red', '🚨 L’ordre est tout',
         'Placer la règle 4 avant la règle 3 rend la 3 <strong>inatteignable</strong> : la première '
         'qui correspond décide, et <code>any</code> englobe déjà les réseaux voisins. La zone sort '
         'sur Internet <em>et</em> voit tout le reste — sans que rien ne le signale. Relis toujours '
         'une liste de règles de haut en bas en te demandant ce que la précédente a déjà attrapé.'),
    note('gray', '💡 <em>This Firewall</em> et la règle anti-verrouillage',
         'La règle anti-verrouillage du volet 1 ne protège que le <strong>LAN</strong>. Sur une zone '
         'd’invités ou d’objets connectés, rien n’empêche d’atteindre la page d’administration : '
         'c’est à la règle 2 de le faire. Attention à ne pas bloquer du même coup le DNS et le DHCP, '
         'qui sont <em>aussi</em> rendus par le pare-feu — d’où la règle 1, placée avant.'),

    '<h2>7) Ce qu’il ne faut pas oublier en créant une zone</h2>',
    '<ul class="proc-steps">'
    '<li><strong>Le NAT sortant.</strong> En mode automatique, la nouvelle zone est prise en charge '
    'toute seule. Si tu es passé en <em>Hybrid</em> ou <em>Manual</em> au '
    '<a href="/pages/opnsense-nat">volet 2</a>, il faut ajouter sa règle — sinon elle route sans '
    'traduire, et rien ne revient.</li>'
    '<li><strong>Le DNS.</strong> Le résolveur du <a href="/pages/opnsense-services">volet 3</a> '
    'n’écoute pas forcément sur la nouvelle interface : vérifie la liste des interfaces d’Unbound.</li>'
    '<li><strong>La passerelle des machines</strong> de la zone : l’adresse d’OPNsense sur cette '
    'interface, pas celle du LAN.</li>'
    '<li><strong>Le switch</strong>, si c’est un VLAN : port trunk côté pare-feu, ports accès côté '
    'machines.</li>'
    '</ul>',

    '<h2>8) Vérifier — tester ce qui doit échouer autant que ce qui doit marcher</h2>',
    '<p>Une segmentation ne se vérifie pas en constatant qu’Internet fonctionne. Elle se vérifie en '
    'constatant que le reste <strong>ne</strong> fonctionne <strong>pas</strong>.</p>',
    '<div class="lx-cmd"># depuis une machine de la DMZ, ce qui DOIT échouer :\n'
    'ping 192.168.10.20            # un poste du LAN\n'
    'Test-NetConnection 192.168.10.1 -Port 445\n'
    'https://192.168.20.254        # l’administration du pare-feu\n\n'
    '# ce qui doit marcher :\n'
    'nslookup www.google.fr\ncurl -I https://deb.debian.org</div>',
    f'<p>En parallèle, {menu("Firewall › Log Files › Live View")} filtré sur l’adresse de la machine '
    ': chaque tentative interdite doit produire une <strong>ligne rouge</strong>, et le clic sur la '
    'ligne doit mener à la règle 2 ou 3. Un blocage qui n’apparaît pas dans le journal n’a pas été '
    'décidé par la règle qu’on croit.</p>',
    note('yellow', '⚠️ Le test qui ment',
         'Tester depuis une machine qui a <strong>deux</strong> cartes, ou depuis le pare-feu '
         'lui-même. Le pare-feu, lui, joint toutes les zones : ses propres <code>ping</code> ne '
         'prouvent rien sur ce qu’une machine de la zone peut faire.'),

    '<h2>✅ À retenir</h2>',
    '<ul class="proc-steps">'
    '<li>Segmenter n’empêche pas l’intrusion : ça l’empêche de <strong>mener quelque part</strong>.</li>'
    '<li>Une zone naît d’une carte de plus <strong>ou</strong> d’un VLAN — côté règles, c’est '
    'identique.</li>'
    '<li>Un VLAN suppose un <strong>port trunk</strong> en face ; en Hyper-V il se déclare en '
    'PowerShell.</li>'
    '<li>Une interface <code>OPT</code> n’a <strong>aucune règle</strong> par défaut : c’est normal.</li>'
    '<li>On écrit la <strong>matrice de flux</strong> avant les règles.</li>'
    '<li><strong>Bloquer <code>RESEAUX_INTERNES</code> avant d’autoriser <code>any</code></strong>, '
    'sinon la zone voit tout.</li>'
    '<li>On vérifie surtout <strong>ce qui doit échouer</strong>.</li>'
    '</ul>',
    note('blue', '📘 Volet suivant',
         '<a href="/pages/opnsense-vpn-ids"><strong>Accès distants et détection d’intrusion</strong>'
         '</a> — WireGuard, OpenVPN, et Suricata. Avec la question qui fait le lien : dans quelle '
         'zone débouche un utilisateur nomade ?'),
])

# ═══════════════════════════════════════════ Volet 5 — VPN et IDS ══

SVG_TUNNEL = (
    '<svg viewBox="0 0 470 210" role="img" '
    'aria-label="Un nomade rejoint une zone du réseau par un tunnel chiffré" '
    'style="max-width:470px;width:100%;height:auto;margin:8px 0 12px;'
    'font-family:system-ui,sans-serif">'
    '<rect x="8" y="76" width="88" height="44" rx="8" fill="#0891b2"/>'
    '<text x="52" y="94" text-anchor="middle" font-size="11" fill="#fff" font-weight="bold">Nomade</text>'
    '<text x="52" y="108" text-anchor="middle" font-size="9" fill="#cffafe">10.10.10.2</text>'
    '<path d="M96 98 Q160 62 224 98" stroke="#7c3aed" stroke-width="3" fill="none" stroke-dasharray="7 4"/>'
    '<text x="160" y="56" text-anchor="middle" font-size="10" fill="#7c3aed" font-weight="bold">'
    'tunnel chiffré</text>'
    '<text x="160" y="122" text-anchor="middle" font-size="9" fill="#64748b">UDP 51820 · par Internet</text>'
    '<rect x="224" y="46" width="112" height="128" rx="10" fill="#dc2626"/>'
    '<text x="280" y="70" text-anchor="middle" font-size="12.5" fill="#fff" font-weight="bold">OPNsense</text>'
    '<rect x="236" y="82" width="88" height="26" rx="5" fill="#fff" fill-opacity=".18"/>'
    '<text x="280" y="100" text-anchor="middle" font-size="10" fill="#fff">interface wg0</text>'
    '<rect x="236" y="116" width="88" height="26" rx="5" fill="#fff" fill-opacity=".18"/>'
    '<text x="280" y="134" text-anchor="middle" font-size="10" fill="#fff">ses règles</text>'
    '<text x="280" y="160" text-anchor="middle" font-size="9" fill="#fecaca">une zone de plus</text>'
    '<line x1="336" y1="88" x2="386" y2="88" stroke="#16a34a" stroke-width="2.5"/>'
    '<rect x="386" y="70" width="78" height="36" rx="7" fill="#059669"/>'
    '<text x="425" y="93" text-anchor="middle" font-size="11" fill="#fff" font-weight="bold">LAN</text>'
    '<line x1="336" y1="134" x2="386" y2="134" stroke="#d97706" stroke-width="2.5" stroke-dasharray="5 4"/>'
    '<rect x="386" y="116" width="78" height="36" rx="7" fill="#d97706" fill-opacity=".45"/>'
    '<text x="425" y="139" text-anchor="middle" font-size="11" fill="#7c2d12" font-weight="bold">DMZ</text>'
    '<text x="235" y="200" text-anchor="middle" font-size="10.5" fill="#64748b">'
    'Le tunnel arrive dans une zone à part — ce qu’il atteint reste décidé par des règles</text>'
    '</svg>')

VPN_IDS = '\n'.join([
    '<section class="hero"><span class="pill">Cours · Réseau</span>'
    '<h1>OPNsense : accès distants et détection d’intrusion</h1>'
    '<p>Volet 5 — faire entrer un nomade sans ouvrir le réseau, relier deux sites, et voir passer '
    'ce qui ne devrait pas.</p>'
    '</section>',
    STYLE,
    bandeau('opnsense-vpn-ids'),

    note('blue', '📚 Avant ce volet',
         'Toute la série précédente, et surtout le <a href="/pages/opnsense-segmentation">volet 4</a> '
         ': un VPN qui débouche sur un réseau plat annule la segmentation qu’on vient de faire. La '
         'théorie du tunnel est dans <a href="/pages/le-vpn">Le VPN</a>.'),

    '<h2>1) Deux besoins qu’on confond</h2>',
    '<table class="lx-tab"><tr><th></th><th>Accès nomade</th><th>Liaison de sites</th></tr>'
    '<tr><td>Qui</td><td>Une personne, un portable</td><td>Deux pare-feu, en permanence</td></tr>'
    '<tr><td>Sens</td><td>Le client appelle</td><td>Les deux appellent, ou l’un des deux</td></tr>'
    '<tr><td>Ce qu’on règle</td><td>Un compte ou une clé par personne</td>'
    '<td>Les réseaux annoncés de part et d’autre</td></tr>'
    '<tr><td>Le risque</td><td>Un portable compromis entre dans le réseau</td>'
    '<td>Les deux sites deviennent un seul réseau plat</td></tr></table>',

    '<h2>2) Choisir le protocole</h2>',
    '<table class="lx-tab"><tr><th></th><th>WireGuard</th><th>OpenVPN</th><th>IPsec</th></tr>'
    '<tr><td>Mise en place</td><td><strong>Simple</strong> — une paire de clés par pair</td>'
    '<td>Moyenne — il faut une autorité de certification</td><td>Complexe, beaucoup de paramètres à '
    'accorder</td></tr>'
    '<tr><td>Performance</td><td><strong>Excellente</strong></td><td>Correcte</td><td>Bonne</td></tr>'
    '<tr><td>Traversée des pare-feu</td><td>UDP seul</td><td><strong>Sait passer en TCP 443</strong>, '
    'donc partout</td><td>Souvent bloqué</td></tr>'
    '<tr><td>Authentification</td><td>Clés publiques</td><td>Certificats, mot de passe, double '
    'facteur</td><td>Clé partagée ou certificats</td></tr>'
    '<tr><td>Interopérabilité</td><td>Bonne et croissante</td><td>Très bonne</td>'
    '<td><strong>Le standard</strong> entre équipements de marques différentes</td></tr>'
    '<tr><td>Pour commencer</td><td><strong>Celui-ci</strong></td><td>Si le réseau visité filtre '
    'l’UDP</td><td>Si l’équipement d’en face l’impose</td></tr></table>',

    '<h2>3) WireGuard en pratique</h2>',
    SVG_TUNNEL,
    f'<p>{menu("VPN › WireGuard")} — d’abord une <strong>instance</strong>, c’est-à-dire le serveur :</p>',
    '<table class="lx-tab"><tr><th>Champ</th><th>Valeur</th><th>Remarque</th></tr>'
    '<tr><td>Name</td><td><code>wg-nomades</code></td><td></td></tr>'
    '<tr><td>Listen port</td><td><code>51820</code></td><td>UDP</td></tr>'
    '<tr><td>Tunnel address</td><td><code>10.10.10.1/24</code></td><td>Un réseau <strong>à part</strong>, '
    'qui n’existe que dans le tunnel</td></tr>'
    '<tr><td>Public / private key</td><td>Générées par le bouton</td><td>La clé privée ne quitte '
    'jamais le boîtier</td></tr></table>',
    '<p>Puis un <strong>pair</strong> (<em>peer</em>) par personne :</p>',
    '<table class="lx-tab"><tr><th>Champ</th><th>Valeur</th><th>Remarque</th></tr>'
    '<tr><td>Public key</td><td>Celle générée sur le poste client</td><td>Seule la clé <em>publique</em> '
    'se transmet</td></tr>'
    '<tr><td>Allowed IPs</td><td><code>10.10.10.2/32</code></td><td><strong>Le /32 compte</strong> : '
    'c’est ce qui empêche un pair d’usurper l’adresse d’un autre</td></tr></table>',
    '<p>Trois choses restent à faire, et ce sont elles qu’on oublie :</p>',
    '<ul class="proc-steps">'
    f'<li><strong>Ouvrir le port sur le WAN.</strong> Une règle {menu("Firewall › Rules › WAN")} : '
    'Pass, UDP, destination <em>WAN address</em>, port <code>51820</code>. Sans elle, le tunnel '
    'n’est même pas contacté.</li>'
    f'<li><strong>Assigner l’interface.</strong> {menu("Interfaces › Assignments")} : le tunnel '
    'devient une interface à part entière, avec son onglet de règles. C’est <strong>là</strong> qu’on '
    'décide ce que le nomade atteint.</li>'
    '<li><strong>Écrire les règles du tunnel.</strong> Par défaut : rien ne passe. On applique la '
    'même matrice de flux qu’au <a href="/pages/opnsense-segmentation">volet 4</a>.</li>'
    '</ul>',
    note('yellow', '⚠️ Tunnel complet ou tunnel partagé',
         'Côté client, <code>AllowedIPs</code> décide de ce qui emprunte le tunnel. '
         '<code>192.168.10.0/24</code> : seul le trafic vers l’entreprise y passe — le reste sort par '
         'la connexion locale (<em>split tunnel</em>). <code>0.0.0.0/0</code> : '
         '<strong>tout</strong> passe par le tunnel, y compris la navigation personnelle. Le second '
         'permet d’appliquer le filtrage de l’entreprise partout, au prix de la bande passante et de '
         'la vie privée. C’est une décision, pas un réglage par défaut.'),

    '<h2>4) OpenVPN</h2>',
    '<p>Plus long à mettre en place, mais il passe là où WireGuard est bloqué — un hôtel ou un '
    'réseau invité qui ne laisse sortir que le TCP 443.</p>',
    '<ul class="proc-steps">'
    f'<li>{menu("System › Trust › Authorities")} : créer une <strong>autorité de certification</strong> '
    'interne.</li>'
    f'<li>{menu("System › Trust › Certificates")} : un certificat serveur, puis un certificat '
    '<strong>par utilisateur</strong>.</li>'
    f'<li>{menu("VPN › OpenVPN")} : l’instance serveur — protocole, port, réseau du tunnel, réseaux '
    'annoncés au client.</li>'
    '<li>La règle sur le WAN, comme pour WireGuard.</li>'
    '<li>Le greffon d’<strong>export client</strong> produit un fichier de configuration prêt à '
    'importer, certificat inclus.</li>'
    '</ul>',
    note('green', '💡 Un certificat par personne, pas un pour tous',
         'C’est ce qui permet de <strong>révoquer</strong> l’accès d’une seule personne — départ, '
         'portable perdu — sans redistribuer une configuration à tout le monde. Un certificat partagé '
         'est un mot de passe partagé : le jour où il faut le changer, personne ne le fait.'),

    '<h2>5) Relier deux sites</h2>',
    '<p>Même outil, autre logique : ce ne sont plus des personnes mais des <strong>réseaux</strong> '
    'qu’on annonce de part et d’autre.</p>',
    '<table class="lx-tab"><tr><th>Site A — 192.168.10.0/24</th><th>Site B — 192.168.50.0/24</th></tr>'
    '<tr><td>Allowed IPs du pair B : <code>10.10.20.2/32, 192.168.50.0/24</code></td>'
    '<td>Allowed IPs du pair A : <code>10.10.20.1/32, 192.168.10.0/24</code></td></tr>'
    '<tr><td colspan="2">Les deux plans d’adressage doivent être <strong>différents</strong> : deux '
    'sites en <code>192.168.1.0/24</code> ne peuvent pas se router l’un vers l’autre.</td></tr></table>',
    note('yellow', '⚠️ Deux sites reliés font un réseau plus grand, pas un réseau de confiance',
         'Un incident sur le site B devient un incident sur le site A. Les règles de l’interface du '
         'tunnel doivent dire ce que chaque site a réellement besoin d’atteindre chez l’autre — un '
         'serveur de fichiers, un annuaire — et pas « tout ».'),

    '<h2>6) Dans quelle zone débouche le nomade ?</h2>',
    '<p>C’est <strong>la</strong> question de ce volet, et elle est rarement posée.</p>',
    '<p>Un portable qui se connecte depuis un hôtel n’a pas le même niveau de confiance qu’un poste '
    'du bureau : il a passé la semaine sur des réseaux inconnus. Lui donner un accès équivalent au '
    'LAN revient à défaire le volet 4 par un tunnel chiffré — c’est-à-dire proprement, et sans que '
    'personne ne le voie.</p>',
    '<table class="lx-tab"><tr><th>Ce que le nomade doit joindre</th><th>La règle</th></tr>'
    '<tr><td>Le serveur de fichiers</td><td>Pass, destination <code>SRV_FICHIERS</code>, ports SMB</td></tr>'
    '<tr><td>L’annuaire, pour ouvrir sa session</td><td>Pass, destination <code>SRV_AD</code>, ports '
    'AD</td></tr>'
    '<tr><td>L’application métier</td><td>Pass, destination <code>SRV_APPLI</code>, son port</td></tr>'
    '<tr><td>Le reste du LAN</td><td><strong>Block</strong></td></tr>'
    '<tr><td>L’administration du pare-feu</td><td><strong>Block</strong></td></tr></table>',

    '<h2>7) Suricata — voir ce qui passe</h2>',
    f'<p>{menu("Services › Intrusion Detection")} active <strong>Suricata</strong>, qui compare le '
    'trafic à des signatures d’attaques connues.</p>',
    '<table class="lx-tab"><tr><th></th><th>IDS — détection</th><th>IPS — prévention</th></tr>'
    '<tr><td>Ce qu’il fait</td><td>Signale, laisse passer</td><td>Signale <strong>et bloque</strong></td></tr>'
    '<tr><td>Le risque</td><td>Une alerte que personne ne lit</td><td>Un <strong>faux positif</strong> '
    'coupe un service légitime</td></tr>'
    '<tr><td>Par où commencer</td><td><strong>Ici</strong>, quelques semaines</td>'
    '<td>Ensuite, jeu de règles par jeu de règles</td></tr></table>',
    note('gray', '💡 Sur quelle interface l’activer',
         'Sur le <strong>WAN</strong>, on voit surtout le bruit de fond d’Internet — des balayages '
         'permanents qui n’atteignent rien, et des milliers d’alertes sans intérêt. Sur le '
         '<strong>LAN</strong>, on voit les <strong>vraies adresses internes</strong> : si une machine '
         'se met à parler à un serveur de commande, on sait <em>laquelle</em>. C’est ce qu’on veut '
         'savoir un jour d’incident.'),
    note('yellow', '⚠️ Ce que Suricata ne verra pas',
         'La quasi-totalité du trafic web est <strong>chiffrée</strong> : le contenu lui est '
         'inaccessible. Il travaille sur ce qui reste en clair — le nom du site demandé lors de '
         'l’établissement TLS, les requêtes DNS, les métadonnées, les protocoles non chiffrés. C’est '
         'déjà beaucoup, mais ce n’est pas « il voit tout ». Un IDS ne remplace ni un antivirus, ni '
         'les sauvegardes, ni la segmentation du volet 4.'),
    acc(
        ('📦 Les jeux de règles',
         '<p>Suricata ne détecte que ce que ses signatures décrivent. On active les jeux qui '
         'correspondent à ce qu’on héberge — inutile de charger les règles d’un serveur de jeu si '
         'l’on n’en a pas — et on les laisse se mettre à jour automatiquement. Un jeu de règles figé '
         'ne détecte plus rien de récent au bout de quelques mois.</p>'),
        ('🚦 Passer en mode IPS, prudemment',
         '<p>Le mode bloquant demande une carte réseau compatible avec l’accélération employée : sur '
         'une machine virtuelle, tous les types de carte ne conviennent pas. Et surtout, on ne bascule '
         'pas tout d’un coup : on regarde d’abord quelles alertes reviennent en fonctionnement '
         'normal, on écarte les faux positifs, <strong>puis</strong> on rend bloquant, jeu par jeu.</p>'),
        ('🧭 Les autres greffons de filtrage',
         '<p>Un <strong>mandataire web</strong> filtre par catégories de sites et journalise les accès. '
         'Des greffons de nouvelle génération y ajoutent l’identification applicative. À évaluer '
         '<em>après</em> : la segmentation et des règles justes protègent davantage qu’une couche '
         'd’analyse posée sur un réseau plat.</p>'),
    ),

    '<h2>8) Vérifier</h2>',
    '<div class="lx-cmd"># le tunnel est-il monté ?  (côté client WireGuard)\n'
    'ping 10.10.10.1                     # l’adresse du pare-feu DANS le tunnel\n\n'
    '# ce que le nomade DOIT joindre\n'
    'Test-NetConnection 192.168.10.20 -Port 445\n\n'
    '# ce qu’il ne doit PAS joindre\n'
    'Test-NetConnection 192.168.10.99 -Port 3389   # doit échouer\n'
    'https://192.168.10.254                        # l’administration : doit échouer\n\n'
    '# le trafic passe-t-il vraiment par le tunnel ?\n'
    'tracert 192.168.10.20               # le premier saut doit être 10.10.10.1</div>',
    f'<p>Côté pare-feu : la page du service montre la <strong>dernière poignée de main</strong> de '
    'chaque pair — c’est le seul indicateur fiable qu’un tunnel vit. Et '
    f'{menu("Firewall › Log Files › Live View")}, filtré sur l’adresse du tunnel, montre ce que le '
    'nomade a essayé d’atteindre.</p>',
    note('gray', '🔍 Le tunnel monte mais rien ne passe',
         'Dans l’ordre : l’interface du tunnel est-elle <strong>assignée</strong> ? A-t-elle des '
         '<strong>règles</strong> ? Les <code>AllowedIPs</code> du client couvrent-ils le réseau '
         'visé ? Et la machine cible a-t-elle une <strong>route de retour</strong> vers le réseau du '
         'tunnel — c’est-à-dire OPNsense comme passerelle ? Ce dernier point explique la moitié des '
         'cas où « le VPN marche mais on ne peut rien faire ».'),

    '<h2>✅ À retenir</h2>',
    '<ul class="proc-steps">'
    '<li><strong>WireGuard</strong> pour commencer ; <strong>OpenVPN</strong> quand le réseau visité '
    'filtre ; <strong>IPsec</strong> quand l’équipement d’en face l’impose.</li>'
    '<li>Un tunnel ne s’ouvre pas tout seul : <strong>règle sur le WAN</strong>, '
    '<strong>interface assignée</strong>, <strong>règles sur le tunnel</strong>.</li>'
    '<li><code>AllowedIPs</code> en <code>/32</code> par pair : c’est l’anti-usurpation.</li>'
    '<li>Le nomade débouche dans une <strong>zone à part</strong>, avec sa propre matrice de flux.</li>'
    '<li>Un <strong>certificat par personne</strong>, pour pouvoir en révoquer un seul.</li>'
    '<li>Suricata : <strong>en détection d’abord</strong>, sur l’interface interne, et il ne voit pas '
    'ce qui est chiffré.</li>'
    '</ul>',
    note('green', '🎓 La série est complète',
         'Les cinq volets : <a href="/pages/opnsense">découverte</a>, '
         '<a href="/pages/opnsense-nat">NAT</a>, '
         '<a href="/pages/opnsense-services">DHCP &amp; DNS</a>, '
         '<a href="/pages/opnsense-segmentation">segmentation</a>, et celui-ci. De quoi monter un '
         'pare-feu d’entreprise de bout en bout, et savoir pourquoi chaque réglage est là.',
         'À lire à côté : <a href="/pages/le-pare-feu">Le pare-feu</a>, '
         '<a href="/pages/le-vpn">Le VPN</a>, <a href="/pages/les-vlan">Les VLAN</a>, '
         '<a href="/pages/le-wireshark">Wireshark</a> et '
         '<a href="/pages/supervision">La supervision</a>.'),
])

# ═══════════════════════════════════════════════════════════ le lot ══

PAGES = [
    ('opnsense-segmentation',
     'OPNsense : segmenter le réseau (DMZ, VLAN, règles inter-zones)',
     'Volet 4 — pourquoi découper, créer une zone par carte ou par VLAN, écrire la matrice de flux, '
     'et l’ordre des règles qui décide si une zone voit ou non ses voisines.',
     SEGMENTATION,
     'Volet 4 — le mouvement latéral, une zone par carte ou par VLAN (avec le trunk Hyper-V), la '
     'matrice de flux, l’alias RESEAUX_INTERNES bloqué avant le any, et la vérification par ce qui '
     'doit échouer.'),
    ('opnsense-vpn-ids',
     'OPNsense : accès distants et détection d’intrusion',
     'Volet 5 — WireGuard, OpenVPN et IPsec comparés, la liaison de sites, la zone dans laquelle '
     'débouche un nomade, et Suricata en détection puis en prévention.',
     VPN_IDS,
     'Volet 5 — choisir entre WireGuard, OpenVPN et IPsec, monter un tunnel de bout en bout, relier '
     'deux sites, décider ce qu’un nomade atteint, et mettre Suricata en détection avant de le '
     'rendre bloquant.'),
]


def main():
    c = sqlite3.connect(BASE)
    rapport = []
    for slug, titre, extrait, contenu, description in PAGES:
        etat = publier(c, slug, titre, extrait, contenu)
        idx = c.execute("SELECT content FROM pages WHERE slug='cours'").fetchone()[0]
        neuf, info = ranger_dans_index(idx, slug, titre, description)
        if neuf is None:
            print(f'{slug} : {info}', file=sys.stderr)
            return 1
        c.execute("UPDATE pages SET content=?,"
                  " updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug='cours'", (neuf,))
        rapport.append(f'{slug} : {etat} ({len(contenu)} car.) | {info}')
    c.commit()
    c.close()
    print('\n'.join(rapport).encode('ascii', 'replace').decode('ascii'))
    return 0


if __name__ == '__main__':
    sys.exit(main())

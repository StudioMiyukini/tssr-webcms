# -*- coding: utf-8 -*-
"""
Volets 2 et 3 du cours OPNsense : le NAT, puis les services rendus par le boîtier.

POURQUOI CES DEUX-LÀ ENSEMBLE
Ils se répondent. Le volet NAT se termine sur la réflexion — le client interne
qui demande le nom public d'un serveur interne — et la bonne réponse à ce
problème n'est pas un réglage de NAT mais un enregistrement DNS local, traité au
volet suivant. Les écrire d'un coup évite de promettre un renvoi qui n'existe
pas encore.

Le style, le bandeau de série et le rangement dans l'index viennent du module
partagé : voir `opnsense_serie.py`.

IDEMPOTENT.
"""
import sqlite3
import sys
from pathlib import Path

from opnsense_serie import (STYLE, acc, bandeau, menu, note, publier, ranger_dans_index)

BASE = Path(__file__).resolve().parent.parent / 'cms.sqlite'

# ═══════════════════════════════════════════════════ Volet 2 — le NAT ══

SVG_REDIRECTION = (
    '<svg viewBox="0 0 480 260" role="img" '
    'aria-label="Une redirection de port : le pare-feu réécrit la destination avant de filtrer" '
    'style="max-width:480px;width:100%;height:auto;margin:8px 0 12px;'
    'font-family:system-ui,sans-serif">'
    '<ellipse cx="52" cy="48" rx="46" ry="26" fill="#64748b"/>'
    '<text x="52" y="53" text-anchor="middle" font-size="12" fill="#fff" font-weight="bold">Client</text>'
    '<text x="52" y="88" text-anchor="middle" font-size="9.5" fill="#64748b">sur Internet</text>'
    '<line x1="98" y1="48" x2="168" y2="48" stroke="#94a3b8" stroke-width="2.5"/>'
    '<text x="133" y="40" text-anchor="middle" font-size="9.5" fill="#64748b">→ 203.0.113.10:443</text>'
    '<rect x="168" y="18" width="140" height="200" rx="10" fill="#dc2626"/>'
    '<text x="238" y="42" text-anchor="middle" font-size="13" fill="#fff" font-weight="bold">OPNsense</text>'
    '<rect x="182" y="58" width="112" height="46" rx="6" fill="#fff" fill-opacity=".18"/>'
    '<text x="238" y="76" text-anchor="middle" font-size="10.5" fill="#fff" font-weight="bold">1 · NAT</text>'
    '<text x="238" y="94" text-anchor="middle" font-size="9.5" fill="#fecaca">'
    'destination réécrite</text>'
    '<line x1="238" y1="108" x2="238" y2="126" stroke="#fff" stroke-width="2"/>'
    '<polygon points="238,132 233,122 243,122" fill="#fff"/>'
    '<rect x="182" y="136" width="112" height="46" rx="6" fill="#fff" fill-opacity=".18"/>'
    '<text x="238" y="154" text-anchor="middle" font-size="10.5" fill="#fff" font-weight="bold">'
    '2 · Filtrage</text>'
    '<text x="238" y="172" text-anchor="middle" font-size="9.5" fill="#fecaca">'
    'voit déjà 192.168.20.10</text>'
    '<text x="238" y="204" text-anchor="middle" font-size="9.5" fill="#fecaca">'
    'onglet WAN</text>'
    '<line x1="308" y1="118" x2="374" y2="118" stroke="#f59e0b" stroke-width="2.5"/>'
    '<text x="341" y="110" text-anchor="middle" font-size="9.5" fill="#b45309">→ :443</text>'
    '<rect x="374" y="96" width="98" height="44" rx="8" fill="#d97706"/>'
    '<text x="423" y="114" text-anchor="middle" font-size="11.5" fill="#fff" font-weight="bold">'
    'Serveur DMZ</text>'
    '<text x="423" y="129" text-anchor="middle" font-size="9.5" fill="#fef3c7">192.168.20.10</text>'
    '<text x="240" y="248" text-anchor="middle" font-size="10.5" fill="#64748b">'
    'La traduction a lieu AVANT le filtrage : la règle porte sur l’adresse interne</text>'
    '</svg>')

NAT = '\n'.join([
    '<section class="hero"><span class="pill">Cours · Réseau</span>'
    '<h1>OPNsense : le NAT et les redirections de port</h1>'
    '<p>Volet 2 — faire sortir un réseau privé, exposer un serveur interne sans l’exposer tout '
    'entier, et comprendre pourquoi la règle de filtrage porte sur l’adresse interne.</p>'
    '</section>',
    STYLE,
    bandeau('opnsense-nat'),

    note('blue', '📚 Avant ce volet',
         'La théorie de la translation d’adresses est traitée dans '
         '<a href="/pages/cisco-nat">NAT / PAT : la translation d’adresses</a> — pourquoi elle '
         'existe, ce qu’est la surcharge. Ici on la met en œuvre dans OPNsense. Le '
         '<a href="/pages/opnsense">volet 1</a> doit être fait : interfaces assignées, interface web '
         'accessible, règles comprises.'),

    '<h2>1) Les trois NAT d’OPNsense</h2>',
    f'<p>Tout se trouve dans {menu("Firewall › NAT")}, qui offre trois onglets — trois besoins '
    'différents qu’on confond souvent.</p>',
    '<table class="lx-tab"><tr><th>Onglet</th><th>Sens</th><th>À quoi ça sert</th></tr>'
    '<tr><td><strong>Outbound</strong><br>(sortant)</td><td>Interne → Internet</td>'
    '<td>Faire sortir tout le réseau privé derrière l’adresse publique. <strong>Actif par '
    'défaut</strong>, on n’y touche souvent jamais.</td></tr>'
    '<tr><td><strong>Port Forward</strong><br>(redirection)</td><td>Internet → interne</td>'
    '<td>Exposer <strong>un service</strong> d’un serveur interne : le web d’un serveur, rien '
    'd’autre.</td></tr>'
    '<tr><td><strong>One-to-One</strong><br>(1:1)</td><td>Les deux sens</td>'
    '<td>Associer <strong>toute</strong> une adresse publique à une adresse interne. Suppose '
    'plusieurs IP publiques.</td></tr></table>',

    '<h2>2) Le NAT sortant — celui qui marche déjà</h2>',
    f'<p>{menu("Firewall › NAT › Outbound")} propose quatre modes :</p>',
    '<table class="lx-tab"><tr><th>Mode</th><th>Effet</th></tr>'
    '<tr><td><strong>Automatic</strong> <em>(défaut)</em></td><td>OPNsense génère seul les règles : '
    'tout réseau local qui sort par le WAN prend l’adresse du WAN. C’est du PAT.</td></tr>'
    '<tr><td><strong>Hybrid</strong></td><td>Les règles automatiques <strong>plus</strong> les '
    'tiennes, qui passent avant. Le bon choix dès qu’on a un cas particulier.</td></tr>'
    '<tr><td><strong>Manual</strong></td><td>Plus rien d’automatique. À réserver aux cas où l’on '
    'sait exactement ce qu’on fait.</td></tr>'
    '<tr><td><strong>Disabled</strong></td><td>Aucune traduction. Utile seulement si le routage est '
    'assuré ailleurs.</td></tr></table>',
    note('yellow', '⚠️ Le passage en manuel qui coupe Internet',
         'Choisir <em>Manual</em> et enregistrer <strong>efface le comportement automatique</strong>. '
         'Si l’on n’écrit pas tout de suite les règles équivalentes, plus rien ne sort. Le réflexe : '
         'passer en <strong>Hybrid</strong>, qui garde l’existant et laisse ajouter au-dessus.'),
    '<p>Un cas où l’on ajoute une règle : donner à une machine précise une <strong>adresse publique '
    'différente</strong> du reste du réseau, ou conserver son port source.</p>',
    '<table class="lx-tab"><tr><th>Champ</th><th>Valeur</th><th>Pourquoi</th></tr>'
    '<tr><td>Interface</td><td>WAN</td><td>Par où ça sort</td></tr>'
    '<tr><td>Source</td><td><code>192.168.10.0/24</code> ou un alias</td><td>Qui est traduit</td></tr>'
    '<tr><td>Translation / target</td><td><em>Interface address</em></td>'
    '<td>L’adresse du WAN ; ou une IP virtuelle si l’on en a plusieurs</td></tr>'
    '<tr><td>Static port</td><td>décoché</td><td>Coché, le port source est <strong>conservé</strong>. '
    'Nécessaire pour certains protocoles (IPsec, SIP, quelques jeux) qui vérifient ce port — et '
    'à éviter partout ailleurs, car deux machines ne peuvent alors plus utiliser le même.</td></tr>'
    '</table>',

    '<h2>3) La redirection de port</h2>',
    '<p>Le besoin type : un serveur web en DMZ, joignable depuis Internet en HTTPS — et '
    '<strong>seulement</strong> en HTTPS.</p>',
    SVG_REDIRECTION,
    f'<p>{menu("Firewall › NAT › Port Forward")}, bouton <strong>+</strong> :</p>',
    '<table class="lx-tab"><tr><th>Champ</th><th>Valeur</th><th>Remarque</th></tr>'
    '<tr><td>Interface</td><td>WAN</td><td>Là où la demande <strong>arrive</strong></td></tr>'
    '<tr><td>Protocol</td><td>TCP</td><td>Pas « TCP/UDP » par confort : on n’ouvre que ce qui '
    'sert</td></tr>'
    '<tr><td>Destination</td><td><em>WAN address</em></td><td>Un renvoi dynamique : survit à un '
    'changement d’adresse publique</td></tr>'
    '<tr><td>Destination port range</td><td>HTTPS (443)</td><td>Le port vu de l’extérieur</td></tr>'
    '<tr><td>Redirect target IP</td><td><code>192.168.20.10</code></td><td>Le serveur interne</td></tr>'
    '<tr><td>Redirect target port</td><td>HTTPS</td><td>Peut différer : on peut publier le 443 '
    'externe vers le 8443 interne</td></tr>'
    '<tr><td>Filter rule association</td><td><strong>Add associated filter rule</strong></td>'
    '<td>Crée <strong>et maintient</strong> la règle de filtrage qui va avec</td></tr>'
    '<tr><td>Description</td><td><em>Web DMZ — HTTPS</em></td><td>Se retrouve dans la règle liée</td></tr>'
    '</table>',
    note('red', '🚨 Le point qui fait chercher des heures : le NAT passe AVANT le filtrage',
         'Quand la règle de filtrage du WAN examine le paquet, la destination a '
         '<strong>déjà</strong> été réécrite. La règle doit donc viser '
         '<code>192.168.20.10</code> — l’adresse <strong>interne</strong> — et surtout pas '
         '<em>WAN address</em>. Une règle écrite sur l’adresse publique ne correspond jamais, et le '
         'paquet tombe dans le refus implicite.',
         'C’est exactement pour éviter cette erreur qu’existe <strong>Add associated filter '
         'rule</strong> : OPNsense écrit la règle correcte à ta place, et la met à jour si tu changes '
         'la redirection. Choisis-la tant que tu n’as pas une raison précise de faire autrement.'),
    acc(
        ('🔗 Les quatre choix de « Filter rule association »',
         '<p><strong>Add associated filter rule</strong> — crée une règle <em>liée</em>, qui suit '
         'automatiquement les modifications de la redirection. Le choix par défaut, et le bon.</p>'
         '<p><strong>Add unassociated filter rule</strong> — crée la règle une fois, puis la laisse '
         'vivre sa vie. Utile si tu veux ensuite la restreindre à certaines sources.</p>'
         '<p><strong>Pass</strong> — pas de règle du tout : la redirection laisse passer d’elle-même. '
         'Pratique, mais le trafic autorisé n’apparaît plus dans la liste des règles, donc plus '
         'personne ne le voit à la relecture.</p>'
         '<p><strong>None</strong> — aucune règle. Rien ne passera tant que tu ne l’écris pas '
         'toi-même.</p>'),
        ('🎯 Restreindre la source',
         '<p>Une redirection ouverte à <code>any</code> expose le service au monde entier. Si le '
         'service n’a que quelques utilisateurs connus — un accès de télémaintenance, par exemple — '
         'renseigne le champ <strong>Source</strong> de la redirection avec un alias contenant leurs '
         'adresses. Le service disparaît alors pour tous les autres, y compris pour les robots qui '
         'balaient Internet en continu.</p>'),
        ('🚪 Publier sur un autre port que le port réel',
         '<p>Rien n’oblige à ce que le port externe soit le port interne. Publier le SSH d’un serveur '
         'sur un port haut réduit énormément le bruit dans les journaux : les balayages '
         'automatiques visent le 22. Ce n’est pas de la sécurité — juste moins de bruit. La sécurité '
         'reste l’authentification par clé et la restriction de source.</p>'),
    ),

    '<h2>4) Le NAT 1:1</h2>',
    '<p>Quand on dispose de plusieurs adresses publiques, on peut en dédier une entière à une '
    'machine : tout ce qui arrive sur l’adresse publique va vers l’adresse interne, et tout ce que '
    'la machine émet ressort avec cette adresse publique.</p>',
    f'<p>Préalable : déclarer l’adresse supplémentaire dans {menu("Interfaces › Virtual IPs")}, en '
    'type <strong>IP Alias</strong>. Sans quoi le pare-feu ne répond pas pour elle.</p>',
    note('yellow', '⚠️ Le 1:1 ne remplace pas les règles de filtrage',
         'Il <strong>traduit</strong>, il n’<strong>autorise</strong> pas. Sans règle sur l’onglet '
         'WAN, rien n’entre — et c’est heureux : un 1:1 qui ouvrirait tout exposerait la totalité des '
         'ports de la machine interne.'),

    '<h2>5) Les alias — ne jamais écrire deux fois la même adresse</h2>',
    f'<p>{menu("Firewall › Aliases")} permet de nommer un groupe d’adresses, de réseaux ou de ports, '
    'puis d’utiliser ce nom dans les règles et les redirections.</p>',
    '<table class="lx-tab"><tr><th>Type</th><th>Contient</th><th>Exemple d’usage</th></tr>'
    '<tr><td>Host(s)</td><td>Des adresses</td><td><code>SRV_WEB</code>, <code>ADMINS_DISTANTS</code></td></tr>'
    '<tr><td>Network(s)</td><td>Des réseaux</td><td><code>RESEAUX_INTERNES</code></td></tr>'
    '<tr><td>Port(s)</td><td>Des ports</td><td><code>PORTS_WEB</code> = 80, 443</td></tr>'
    '<tr><td>URL Table</td><td>Une liste téléchargée périodiquement</td>'
    '<td>Listes d’adresses malveillantes tenues à jour ailleurs</td></tr>'
    '<tr><td>GeoIP</td><td>Des pays</td><td>Restreindre un accès à un pays</td></tr></table>',
    note('gray', '💡 Ce que les alias changent vraiment',
         'Ils ne rendent pas les règles plus rapides : ils les rendent <strong>modifiables</strong>. '
         'Le jour où un serveur change d’adresse, on corrige l’alias — une fois — au lieu de relire '
         'quinze règles en espérant n’en oublier aucune. Et une liste de règles qui parle de '
         '<code>SRV_WEB</code> se relit, là où une suite d’adresses ne se relit pas.'),

    '<h2>6) La réflexion NAT — le piège du client interne</h2>',
    '<p>Le serveur web est publié, il répond parfaitement depuis Internet. Mais depuis un poste '
    '<strong>du LAN</strong>, <code>https://www.miyukini.fr</code> ne répond pas.</p>',
    '<p>La raison : le poste résout le nom vers l’<strong>adresse publique</strong>, et envoie donc '
    'sa demande au pare-feu… pour un serveur qui est juste à côté de lui. Le paquet entre et devrait '
    'ressortir par la même zone — ce que le pare-feu ne fait pas spontanément.</p>',
    '<p>Deux réponses, et elles ne se valent pas.</p>',
    '<table class="lx-tab"><tr><th></th><th>La réflexion NAT</th><th>Le DNS partagé <em>(split DNS)</em></th></tr>'
    '<tr><td>Le principe</td><td>Le pare-feu accepte de faire demi-tour et retraduit</td>'
    '<td>Le DNS interne répond l’adresse <strong>interne</strong> pour le nom public</td></tr>'
    '<tr><td>Où</td><td>' + menu('Firewall › Settings › Advanced') + '</td>'
    '<td>' + menu('Services › Unbound DNS › Overrides') + '</td></tr>'
    '<tr><td>Le trafic</td><td>Fait un détour par le pare-feu</td>'
    '<td>Va <strong>directement</strong> au serveur</td></tr>'
    '<tr><td>Les journaux du serveur</td><td>Voient l’adresse du pare-feu, plus celle du client</td>'
    '<td>Voient le vrai client</td></tr>'
    '<tr><td>Recommandation</td><td>Dépannage, ou quand on ne tient pas le DNS</td>'
    '<td><strong>La bonne solution</strong></td></tr></table>',
    note('green', '💡 Pourquoi le DNS partagé est meilleur',
         'Il supprime le problème au lieu de le contourner : le poste interne apprend la vraie '
         'adresse du serveur et lui parle directement. Le pare-feu ne voit plus passer ce trafic — '
         'moins de charge, des journaux serveur exploitables, et un comportement identique que le '
         'lien Internet soit debout ou non. La mise en place est traitée au '
         '<a href="/pages/opnsense-services">volet 3</a>.'),

    '<h2>7) Vérifier</h2>',
    '<ul class="proc-steps">'
    f'<li><strong>Le NAT sortant.</strong> Depuis un poste du LAN, un site qui affiche l’adresse '
    'publique doit montrer celle du WAN. Et {menu("Firewall › Diagnostics › States")} montre la '
    'traduction ligne par ligne.</li>'
    '<li><strong>La redirection.</strong> Le seul test qui compte se fait <strong>depuis '
    'l’extérieur</strong> — un partage de connexion mobile, pas le LAN, sans quoi c’est la réflexion '
    'qu’on teste sans le savoir.</li>'
    f'<li><strong>Ce que le pare-feu en a fait.</strong> {menu("Firewall › Log Files › Live View")}, '
    'filtré sur le port publié : la ligne verte indique la règle qui a laissé passer.</li>'
    '<li><strong>Le service lui-même.</strong> <code>Test-NetConnection ip.publique -Port 443</code> '
    'depuis Windows, ou <code>nc -vz ip.publique 443</code>. Un refus immédiat vient du pare-feu ; '
    'une attente puis un échec vient plutôt du serveur ou de son propre pare-feu.</li>'
    '</ul>',
    note('gray', '🔍 Une règle modifiée qui « ne prend pas »',
         'Les connexions déjà établies continuent sur l’état existant : le changement ne les concerne '
         'pas. Vide l’état correspondant depuis '
         + menu('Firewall › Diagnostics › States') + ', puis refais le test.'),

    '<h2>8) Les pièges, dans l’ordre où on les rencontre</h2>',
    '<table class="lx-tab"><tr><th>Symptôme</th><th>Cause la plus fréquente</th></tr>'
    '<tr><td>La redirection ne fonctionne pas, rien dans les journaux</td>'
    '<td>Le fournisseur d’accès filtre le port, ou la box en amont n’a pas elle-même redirigé vers '
    'OPNsense</td></tr>'
    '<tr><td>Journaux : bloqué sur le WAN</td><td>Pas de règle de filtrage, ou une règle écrite sur '
    'l’adresse publique au lieu de l’adresse interne</td></tr>'
    '<tr><td>Ça marche de l’extérieur, pas du LAN</td><td>La réflexion — voir le § 6</td></tr>'
    '<tr><td>Ça marche du LAN, pas de l’extérieur</td><td>On a testé depuis le LAN et cru que '
    'c’était bon</td></tr>'
    '<tr><td>Le serveur répond mais très mal</td><td>Sa passerelle par défaut n’est pas OPNsense : '
    'les réponses partent par un autre chemin</td></tr>'
    '<tr><td>Plus rien ne sort après un changement</td><td>Le NAT sortant est passé en '
    '<em>Manual</em> sans règle équivalente</td></tr></table>',

    '<h2>✅ À retenir</h2>',
    '<ul class="proc-steps">'
    '<li>Le <strong>NAT sortant</strong> est automatique : on n’y touche que pour un cas '
    'particulier, et en mode <em>Hybrid</em>.</li>'
    '<li>Une <strong>redirection de port</strong> traduit ; elle n’autorise pas. Il faut une règle de '
    'filtrage, et <em>Add associated filter rule</em> l’écrit correctement.</li>'
    '<li><strong>Le NAT précède le filtrage</strong> : la règle du WAN porte sur l’adresse '
    '<strong>interne</strong>.</li>'
    '<li>On teste une publication <strong>depuis l’extérieur</strong>, jamais depuis le LAN.</li>'
    '<li>Le client interne qui n’atteint pas le serveur publié se règle par un '
    '<strong>DNS partagé</strong>, pas par la réflexion.</li>'
    '<li>Les <strong>alias</strong> ne servent pas à aller plus vite, mais à pouvoir modifier et '
    'relire.</li>'
    '</ul>',
    note('blue', '📘 Volet suivant',
         '<a href="/pages/opnsense-services"><strong>DHCP, DNS et les services du boîtier</strong>'
         '</a> — distribuer les adresses, tenir la résolution de noms, mettre en place le DNS partagé '
         'annoncé plus haut, et cohabiter avec un annuaire Active Directory.'),
])

# ══════════════════════════════════════ Volet 3 — DHCP, DNS, services ══

SVG_DEMARRAGE = (
    '<svg viewBox="0 0 480 190" role="img" '
    'aria-label="Ce qu’un poste obtient au démarrage et dans quel ordre" '
    'style="max-width:480px;width:100%;height:auto;margin:8px 0 12px;'
    'font-family:system-ui,sans-serif">'
    '<rect x="10" y="66" width="86" height="46" rx="8" fill="#059669"/>'
    '<text x="53" y="86" text-anchor="middle" font-size="11.5" fill="#fff" font-weight="bold">Poste</text>'
    '<text x="53" y="101" text-anchor="middle" font-size="9.5" fill="#d1fae5">qui démarre</text>'
    '<line x1="96" y1="80" x2="152" y2="80" stroke="#2563eb" stroke-width="2.5"/>'
    '<text x="124" y="72" text-anchor="middle" font-size="9" fill="#2563eb">DISCOVER</text>'
    '<line x1="152" y1="98" x2="96" y2="98" stroke="#2563eb" stroke-width="2.5"/>'
    '<text x="124" y="113" text-anchor="middle" font-size="9" fill="#2563eb">OFFER</text>'
    '<rect x="152" y="20" width="128" height="150" rx="10" fill="#dc2626"/>'
    '<text x="216" y="42" text-anchor="middle" font-size="12.5" fill="#fff" font-weight="bold">OPNsense</text>'
    '<rect x="164" y="56" width="104" height="30" rx="6" fill="#fff" fill-opacity=".18"/>'
    '<text x="216" y="76" text-anchor="middle" font-size="10.5" fill="#fff">DHCP</text>'
    '<rect x="164" y="94" width="104" height="30" rx="6" fill="#fff" fill-opacity=".18"/>'
    '<text x="216" y="114" text-anchor="middle" font-size="10.5" fill="#fff">Unbound (DNS)</text>'
    '<rect x="164" y="132" width="104" height="26" rx="6" fill="#fff" fill-opacity=".18"/>'
    '<text x="216" y="150" text-anchor="middle" font-size="10.5" fill="#fff">NTP</text>'
    '<line x1="280" y1="108" x2="344" y2="108" stroke="#94a3b8" stroke-width="2.5"/>'
    '<ellipse cx="392" cy="108" rx="46" ry="25" fill="#64748b"/>'
    '<text x="392" y="112" text-anchor="middle" font-size="11" fill="#fff" font-weight="bold">Internet</text>'
    '<text x="240" y="184" text-anchor="middle" font-size="10.5" fill="#64748b">'
    'Le DHCP donne l’adresse, la passerelle ET le serveur DNS — les trois d’un coup</text>'
    '</svg>')

SERVICES = '\n'.join([
    '<section class="hero"><span class="pill">Cours · Réseau</span>'
    '<h1>OPNsense : DHCP, DNS et les services du boîtier</h1>'
    '<p>Volet 3 — distribuer les adresses, tenir la résolution de noms, mettre en place le DNS '
    'partagé, et cohabiter proprement avec un annuaire Active Directory.</p>'
    '</section>',
    STYLE,
    bandeau('opnsense-services'),

    note('blue', '📚 Avant ce volet',
         'Les <a href="/pages/opnsense">volets 1</a> et <a href="/pages/opnsense-nat">2</a> : '
         'interfaces assignées, règles comprises, NAT en place. Le DNS partagé annoncé au volet 2 se '
         'met en place ici, au § 4.'),

    '<h2>1) Un pare-feu qui rend aussi des services</h2>',
    '<p>OPNsense ne fait pas que filtrer : il distribue les adresses, résout les noms, donne '
    'l’heure. Sur un petit réseau, cela évite un serveur de plus — et les trois services se règlent '
    'au même endroit, ce qui limite les incohérences.</p>',
    SVG_DEMARRAGE,
    note('yellow', '⚠️ Où est la limite',
         'Dès qu’il y a un <strong>domaine Active Directory</strong>, le DNS ne doit plus être rendu '
         'par le pare-feu aux postes du domaine : c’est le contrôleur de domaine qui doit répondre, '
         'sans quoi les postes ne trouvent plus les services de l’annuaire. Le § 5 explique le '
         'partage des rôles.'),

    '<h2>2) Le serveur DHCP</h2>',
    f'<p>Le service se configure <strong>par interface</strong> : {menu("Services › DHCP › [LAN]")}. '
    'Chaque zone a son étendue.</p>',
    note('gray', '💡 Le nom du service change selon la version',
         'OPNsense a longtemps utilisé <strong>ISC DHCP</strong>, aujourd’hui en voie de retrait au '
         'profit de <strong>Kea DHCP</strong>, et <strong>Dnsmasq</strong> sait aussi le faire. Le '
         'menu s’appelle donc <em>DHCPv4</em>, <em>Kea DHCP</em> ou <em>Dnsmasq DNS &amp; DHCP</em> '
         'suivant ta version. Les notions et les champs, eux, sont les mêmes — regarde ce qui est '
         'présent dans le menu <em>Services</em> de ta machine.'),
    '<table class="lx-tab"><tr><th>Champ</th><th>Valeur d’exemple</th><th>Ce qu’il décide</th></tr>'
    '<tr><td>Range</td><td><code>192.168.10.100</code> → <code>192.168.10.200</code></td>'
    '<td>La plage distribuée. Elle doit <strong>exclure</strong> les adresses fixes des serveurs et '
    'des imprimantes.</td></tr>'
    '<tr><td>Gateway</td><td><code>192.168.10.254</code></td><td>Vide = l’adresse de l’interface. '
    'On la renseigne quand la passerelle n’est pas le pare-feu.</td></tr>'
    '<tr><td>DNS servers</td><td><code>192.168.10.254</code></td><td>Vide = l’adresse de '
    'l’interface, donc le résolveur du boîtier.</td></tr>'
    '<tr><td>Domain name</td><td><code>miyukini.lan</code></td><td>Le suffixe ajouté aux noms '
    'courts : <code>ping srv-web</code> devient <code>srv-web.miyukini.lan</code>.</td></tr>'
    '<tr><td>Default lease time</td><td><code>7200</code> s</td><td>La durée du bail. Court sur un '
    'réseau d’invités où les machines passent, long sur un parc stable.</td></tr></table>',
    '<h3>Les réservations</h3>',
    '<p>Une <strong>réservation</strong> associe une adresse MAC à une adresse fixe : la machine '
    'reçoit toujours la même, sans qu’on ait à la configurer sur la machine elle-même.</p>',
    note('green', '💡 Pourquoi réserver plutôt que fixer sur la machine',
         'Le réglage reste <strong>au même endroit que le reste</strong> : on lit le plan d’adressage '
         'dans le DHCP, pas en se connectant à quinze machines. Le poste remplacé reprend son adresse '
         'en changeant une seule ligne. Et une imprimante remise à zéro retrouve la sienne toute '
         'seule. Réserve les serveurs, les imprimantes et les points d’accès ; laisse les postes en '
         'dynamique.'),
    note('red', '🚨 Deux serveurs DHCP sur le même réseau',
         'C’est la panne la plus déroutante d’une salle de TP : le pare-feu distribue, et la box '
         'restée branchée distribue aussi. Les postes obtiennent une adresse <strong>de l’un ou de '
         'l’autre selon qui répond le plus vite</strong> — donc certains fonctionnent et d’autres non, '
         'sans logique apparente, et le symptôme change à chaque redémarrage. Un seul serveur DHCP par '
         'domaine de diffusion : coupe celui de la box.'),

    '<h2>3) Le résolveur DNS</h2>',
    f'<p>{menu("Services › Unbound DNS")} est le résolveur d’OPNsense, actif par défaut. Deux façons '
    'de travailler, qui répondent à deux besoins.</p>',
    '<table class="lx-tab"><tr><th></th><th>Résolveur récursif <em>(défaut)</em></th>'
    '<th>Redirecteur <em>(forwarding)</em></th></tr>'
    '<tr><td>Comment</td><td>Interroge lui-même les serveurs racine, puis de proche en proche</td>'
    '<td>Transmet la question aux DNS configurés (FAI, 1.1.1.1, 9.9.9.9…)</td></tr>'
    '<tr><td>Avantage</td><td>Indépendant : personne d’autre ne voit ni ne filtre les questions</td>'
    '<td>Plus rapide au démarrage, marche derrière un réseau qui bride le DNS sortant</td></tr>'
    '<tr><td>Inconvénient</td><td>Premières résolutions plus lentes</td>'
    '<td>Le fournisseur choisi voit tout le trafic DNS</td></tr>'
    '<tr><td>Où</td><td colspan="2">' + menu('Services › Unbound DNS › Query Forwarding')
    + ' pour activer le mode redirecteur</td></tr></table>',
    acc(
        ('🏷️ Enregistrer les baux DHCP dans le DNS',
         '<p>Une option d’Unbound inscrit automatiquement les machines servies par le DHCP dans la '
         'résolution locale : <code>ping poste12.miyukini.lan</code> fonctionne sans rien déclarer. '
         'Très pratique sur un petit réseau. Sur un parc important, cela remplit le DNS de noms qui '
         'changent tout le temps — on préfère alors n’enregistrer que les <strong>réservations</strong>, '
         'ce qui est une option distincte.</p>'),
        ('🔐 DNS over TLS',
         '<p>Les requêtes d’Unbound vers l’extérieur circulent en clair par défaut : le fournisseur '
         'd’accès voit chaque nom demandé. Le mode <em>DNS over TLS</em> les chiffre vers un '
         'résolveur qui l’accepte. À noter : cela suppose de passer en mode redirecteur, donc de '
         'faire confiance à ce résolveur plutôt qu’à son fournisseur — c’est un déplacement de la '
         'confiance, pas une disparition.</p>'),
        ('🚫 Les listes de blocage',
         '<p>Unbound peut refuser de résoudre les noms figurant sur des listes publiques (publicité, '
         'traqueurs, domaines malveillants). C’est un filtrage <strong>par le nom</strong> : léger, '
         'appliqué à tout le réseau d’un coup, et sans agent sur les postes. Ce n’est pas un antivirus '
         'et cela ne bloque rien qui utilise directement une adresse IP.</p>'),
    ),

    '<h2>4) Le DNS partagé — la bonne réponse au problème du volet 2</h2>',
    '<p>Rappel du problème : le serveur web est publié sur <code>www.miyukini.fr</code>, il répond '
    'depuis Internet, mais pas depuis le LAN — parce que le poste interne résout le nom vers '
    'l’adresse <strong>publique</strong>.</p>',
    f'<p>La correction tient en une ligne. {menu("Services › Unbound DNS › Overrides")}, section '
    '<strong>Host Overrides</strong> :</p>',
    '<table class="lx-tab"><tr><th>Champ</th><th>Valeur</th></tr>'
    '<tr><td>Host</td><td><code>www</code></td></tr>'
    '<tr><td>Domain</td><td><code>miyukini.fr</code></td></tr>'
    '<tr><td>Type</td><td>A</td></tr>'
    '<tr><td>IP address</td><td><code>192.168.20.10</code> — l’adresse <strong>interne</strong></td></tr>'
    '<tr><td>Description</td><td><em>DNS partagé — serveur web DMZ</em></td></tr></table>',
    '<p>Désormais, le même nom donne deux réponses différentes selon d’où l’on demande : l’adresse '
    'publique depuis Internet, l’adresse interne depuis le réseau. Le poste interne parle '
    '<strong>directement</strong> au serveur.</p>',
    note('gray', '💡 Un <em>Domain Override</em> n’est pas la même chose',
         'Un <strong>Host Override</strong> répond lui-même pour <em>un nom</em>. Un <strong>Domain '
         'Override</strong> renvoie <em>tout un domaine</em> vers un autre serveur DNS. Le second sert '
         'précisément à cohabiter avec un annuaire : voir le paragraphe suivant.'),

    '<h2>5) Cohabiter avec un Active Directory</h2>',
    '<p>Un domaine AD impose une règle simple et non négociable : <strong>les postes membres du '
    'domaine doivent avoir le contrôleur de domaine comme serveur DNS</strong>. C’est lui qui publie '
    'les enregistrements de service (<code>_ldap</code>, <code>_kerberos</code>…) sans lesquels '
    'l’ouverture de session, les GPO et la jonction au domaine échouent.</p>',
    '<table class="lx-tab"><tr><th>Qui</th><th>Quel DNS</th><th>Qui il interroge ensuite</th></tr>'
    '<tr><td>Postes du domaine</td><td><strong>Le contrôleur de domaine</strong> '
    '(<code>192.168.10.1</code>)</td><td>Le DC transmet ce qu’il ne connaît pas — vers OPNsense ou '
    'vers Internet</td></tr>'
    '<tr><td>Machines hors domaine, invités, matériel réseau</td><td>OPNsense</td>'
    '<td>Unbound résout</td></tr>'
    '<tr><td>OPNsense lui-même</td><td>Ses propres redirecteurs</td>'
    '<td>Avec un <em>Domain Override</em> sur <code>miyukini.lan</code> vers le DC, s’il doit '
    'résoudre des noms du domaine</td></tr></table>',
    note('yellow', '⚠️ Le réglage à corriger dans le DHCP',
         'Le champ <strong>DNS servers</strong> de l’étendue DHCP doit alors pointer vers le '
         '<strong>contrôleur de domaine</strong>, pas vers le pare-feu. Laissé vide, il distribue '
         'l’adresse d’OPNsense — et l’on obtient des postes qui pingent Internet parfaitement mais ne '
         'trouvent pas leur domaine. Le symptôme classique : « la jonction au domaine échoue alors que '
         'le réseau marche ».'),
    '<p>Voir <a href="/pages/procedure-dns">DNS : installer et configurer</a> côté Windows Server et '
    '<a href="/pages/procedure-installation-active-directory">l’installation d’Active Directory</a>.</p>',

    '<h2>6) L’heure</h2>',
    f'<p>{menu("Services › Network Time")} : OPNsense se synchronise sur des serveurs publics et peut '
    'servir l’heure au réseau. Ça n’a l’air de rien jusqu’au jour où ça casse tout.</p>',
    note('gray', '💡 Pourquoi l’heure est un sujet de sécurité',
         '<strong>Kerberos</strong>, l’authentification d’Active Directory, refuse un écart de plus de '
         '<strong>cinq minutes</strong> entre le poste et le contrôleur : au-delà, l’ouverture de '
         'session échoue. Les certificats TLS ont des dates de validité. Et des journaux dont les '
         'horodatages ne concordent pas d’une machine à l’autre ne servent à rien le jour d’un '
         'incident. Dans un domaine AD, c’est le contrôleur qui fait référence pour ses membres.'),

    '<h2>7) Vérifier — depuis un poste, pas depuis le pare-feu</h2>',
    '<div class="lx-cmd">ipconfig /all\n'
    '# Adresse, passerelle, serveurs DNS, suffixe de domaine, et le bail DHCP\n\n'
    'ipconfig /release &amp;&amp; ipconfig /renew   # forcer un nouveau bail\n\n'
    'nslookup www.miyukini.fr\n'
    '# doit répondre l’adresse INTERNE si le DNS partagé est en place\n\n'
    'nslookup srv-ad01.miyukini.lan\n'
    '# dans un domaine AD : doit être résolu par le contrôleur\n\n'
    'w32tm /query /status                 # l’heure et sa source</div>',
    '<p>Côté pare-feu, la liste des baux en cours montre qui a reçu quoi, et permet de transformer '
    'un bail en réservation d’un clic — c’est le moyen le plus rapide de fixer l’adresse d’une '
    'imprimante qu’on vient de brancher.</p>',
    note('yellow', '⚠️ Le poste ne prend pas les nouveaux réglages',
         'Un changement d’étendue DHCP ne s’applique qu’au <strong>renouvellement du bail</strong>. '
         'Tant que le poste garde l’ancien, il garde l’ancienne passerelle et l’ancien DNS. '
         '<code>ipconfig /release</code> puis <code>/renew</code> — et <code>ipconfig /flushdns</code> '
         'après un changement de DNS, sinon le cache local répond encore l’ancienne adresse.'),

    '<h2>✅ À retenir</h2>',
    '<ul class="proc-steps">'
    '<li>Le DHCP se règle <strong>par interface</strong> ; la plage distribuée doit exclure les '
    'adresses fixes.</li>'
    '<li>Il distribue <strong>trois choses</strong> : l’adresse, la passerelle et le DNS. Un poste '
    'qui « n’a pas Internet » a souvent reçu la bonne adresse et le mauvais DNS.</li>'
    '<li>Un seul serveur DHCP par réseau — <strong>coupe celui de la box</strong>.</li>'
    '<li>Les <strong>réservations</strong> gardent le plan d’adressage en un seul endroit.</li>'
    '<li>Le <strong>DNS partagé</strong> (Host Override) est la bonne réponse au client interne qui '
    'demande un nom public.</li>'
    '<li>Avec un <strong>Active Directory</strong>, le DNS des postes du domaine est le contrôleur, '
    'pas le pare-feu.</li>'
    '<li>L’heure n’est pas un détail : Kerberos tolère cinq minutes.</li>'
    '</ul>',
    note('blue', '📘 Volet suivant',
         'La <strong>segmentation</strong> : créer une DMZ et des VLAN, écrire les règles entre '
         'zones, et décider ce qui a le droit de parler à quoi. Puis les <strong>accès distants et la '
         'détection d’intrusion</strong>.'),
    note('green', '🔗 À lire à côté',
         'Côté Windows Server, les mêmes services : <a href="/pages/procedure-dhcp">installer et '
         'configurer le DHCP</a>, <a href="/pages/procedure-dns">le DNS</a>. Et la théorie : '
         '<a href="/pages/bases-du-reseau">les bases du réseau</a>.'),
])

# ═══════════════════════════════════════════════════════════ le lot ══

PAGES = [
    ('opnsense-nat', 'OPNsense : le NAT et les redirections de port',
     'Volet 2 — NAT sortant, redirection de port, NAT 1:1, alias, et le point qui fait chercher : '
     'la traduction a lieu avant le filtrage, donc la règle porte sur l’adresse interne.',
     NAT,
     'Volet 2 — NAT sortant et ses quatre modes, redirection de port champ par champ, NAT 1:1, '
     'alias, réflexion contre DNS partagé, et les pièges dans l’ordre où on les rencontre.'),
    ('opnsense-services', 'OPNsense : DHCP, DNS et les services du boîtier',
     'Volet 3 — étendue DHCP et réservations, résolveur Unbound récursif ou redirecteur, DNS '
     'partagé, cohabitation avec un Active Directory, et l’heure comme sujet de sécurité.',
     SERVICES,
     'Volet 3 — l’étendue DHCP et les réservations, le résolveur Unbound, le DNS partagé qui règle '
     'le problème du volet 2, la cohabitation avec un Active Directory et la synchronisation de '
     'l’heure.'),
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

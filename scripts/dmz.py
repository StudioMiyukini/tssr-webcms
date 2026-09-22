# -*- coding: utf-8 -*-
"""
La DMZ en trois volets : comprendre, mettre en place, surveiller et entretenir.

POURQUOI UN COURS À PART, ALORS QUE LE VOLET 4 D'OPNSENSE PARLE DE DMZ
Le volet 4 explique COMMENT créer une zone dans le boîtier et traduire une
matrice de flux en règles. Il ne dit ni pourquoi une DMZ existe, ni ce qu'on y
met, ni comment on la vit ensuite — la surveillance et l'entretien, qui font
l'essentiel du travail d'un technicien une fois la zone en place. Ce cours
tient ce rôle et renvoie au volet 4 pour les clics ; il ne les recopie pas.

TROIS VOLETS PARCE QUE TROIS MOMENTS : on comprend (avant), on construit (une
fois), on surveille et on entretient (tout le temps). Une seule page mélangerait
le concept et la checklist trimestrielle, et personne n'irait au bout.

L'EXEMPLE FIL ROUGE suit les conventions du site : LAN 192.168.10.0/24, DMZ
192.168.20.0/24 (comme le volet 4 et les TP OPNsense), passerelles en .254,
adresse publique dans la plage de documentation 203.0.113.0/24.

IDEMPOTENT : relancer met à jour les trois pages et ne duplique pas les cartes
de l'index. Le bandeau se reconstruit depuis VOLETS.
"""
import sqlite3
import sys
from pathlib import Path

from opnsense_serie import STYLE, menu, note, publier, ranger_dans_index

BASE = Path(__file__).resolve().parent.parent / 'cms.sqlite'

VOLETS = [
    ('dmz', 1, 'Comprendre'),
    ('dmz-mise-en-place', 2, 'Mettre en place'),
    ('dmz-surveillance-entretien', 3, 'Surveiller &amp; entretenir'),
]

SOUS_GROUPE = 'Sécurité &amp; accès distant'


def hero(titre, sous):
    return (f'<section class="hero"><span class="pill">Cours · Réseau</span><h1>{titre}</h1>'
            f'<p>{sous}</p></section>')


def cmd(t):
    return f'<div class="lx-cmd">{t}</div>'


def tab(entetes, lignes):
    th = ''.join(f'<th>{h}</th>' for h in entetes)
    tr = ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in l) + '</tr>' for l in lignes)
    return f'<table class="lx-tab"><tr>{th}</tr>{tr}</table>'


def bandeau(slug_actuel):
    p = []
    for slug, num, libelle in VOLETS:
        n = f'<span class="ops-n">{num}</span>'
        if slug == slug_actuel:
            p.append(f'<span class="ops-v ops-ici">{n}{libelle}</span>')
        else:
            p.append(f'<a class="ops-v" href="/pages/{slug}">{n}{libelle}</a>')
    return ('<nav class="ops-serie" aria-label="Les volets du cours DMZ">'
            '<span class="ops-t">La DMZ en 3 volets</span>' + ''.join(p) + '</nav>')


# ═══════════════════════════════════════════════════ les schémas ══

# Le pare-feu à trois pattes, avec le sens des flux — c'est le dessin qu'il faut
# avoir en tête pour tout le reste.
SVG_TROIS_PATTES = (
    '<svg viewBox="0 0 520 270" role="img" aria-label="Une DMZ sur un pare-feu à trois interfaces, '
    'avec les flux autorisés et interdits" style="max-width:520px;width:100%;height:auto;'
    'margin:8px 0 12px;font-family:system-ui,sans-serif">'
    '<ellipse cx="60" cy="130" rx="50" ry="28" fill="#64748b"/>'
    '<text x="60" y="128" text-anchor="middle" font-size="12.5" fill="#fff" font-weight="bold">Internet</text>'
    '<text x="60" y="142" text-anchor="middle" font-size="9.5" fill="#e2e8f0">WAN</text>'
    '<line x1="110" y1="130" x2="200" y2="130" stroke="#94a3b8" stroke-width="2.5"/>'
    '<rect x="200" y="70" width="110" height="120" rx="10" fill="#dc2626"/>'
    '<text x="255" y="112" text-anchor="middle" font-size="13.5" fill="#fff" font-weight="bold">Pare-feu</text>'
    '<text x="255" y="130" text-anchor="middle" font-size="10" fill="#fecaca">3 interfaces</text>'
    '<text x="255" y="150" text-anchor="middle" font-size="10" fill="#fff">WAN · LAN · DMZ</text>'
    '<line x1="310" y1="95" x2="400" y2="60" stroke="#16a34a" stroke-width="2.5"/>'
    '<rect x="400" y="36" width="110" height="48" rx="8" fill="#059669"/>'
    '<text x="455" y="56" text-anchor="middle" font-size="12" fill="#fff" font-weight="bold">LAN</text>'
    '<text x="455" y="72" text-anchor="middle" font-size="9.5" fill="#d1fae5">postes, serveurs internes</text>'
    '<line x1="310" y1="165" x2="400" y2="200" stroke="#f59e0b" stroke-width="2.5"/>'
    '<rect x="400" y="176" width="110" height="48" rx="8" fill="#d97706"/>'
    '<text x="455" y="196" text-anchor="middle" font-size="12" fill="#fff" font-weight="bold">DMZ</text>'
    '<text x="455" y="212" text-anchor="middle" font-size="9.5" fill="#fef3c7">web, relais mail, proxy</text>'
    # Les flux, en légende sous le dessin.
    '<text x="20" y="232" font-size="10.5" fill="#16a34a">✔ Internet → DMZ : les ports publiés seulement</text>'
    '<text x="20" y="247" font-size="10.5" fill="#16a34a">✔ LAN → DMZ : administration, consultation</text>'
    '<text x="270" y="232" font-size="10.5" fill="#dc2626">✘ DMZ → LAN : jamais à l’initiative de la DMZ</text>'
    '<text x="270" y="247" font-size="10.5" fill="#d97706">◐ DMZ → Internet : mises à jour, DNS, rien d’autre</text>'
    '<text x="260" y="266" text-anchor="middle" font-size="10" fill="#64748b">'
    'Un serveur de la DMZ compromis ne trouve rien derrière lui</text>'
    '</svg>')

# La DMZ en sandwich entre deux pare-feu.
SVG_SANDWICH = (
    '<svg viewBox="0 0 560 150" role="img" aria-label="Une DMZ entre deux pare-feu en série" '
    'style="max-width:560px;width:100%;height:auto;margin:8px 0 12px;font-family:system-ui,sans-serif">'
    '<ellipse cx="50" cy="60" rx="42" ry="24" fill="#64748b"/>'
    '<text x="50" y="64" text-anchor="middle" font-size="12" fill="#fff" font-weight="bold">Internet</text>'
    '<line x1="92" y1="60" x2="130" y2="60" stroke="#94a3b8" stroke-width="2.5"/>'
    '<rect x="130" y="30" width="86" height="60" rx="8" fill="#dc2626"/>'
    '<text x="173" y="55" text-anchor="middle" font-size="11.5" fill="#fff" font-weight="bold">Pare-feu</text>'
    '<text x="173" y="71" text-anchor="middle" font-size="10" fill="#fecaca">externe</text>'
    '<line x1="216" y1="60" x2="248" y2="60" stroke="#f59e0b" stroke-width="2.5"/>'
    '<rect x="248" y="30" width="86" height="60" rx="8" fill="#d97706"/>'
    '<text x="291" y="55" text-anchor="middle" font-size="11.5" fill="#fff" font-weight="bold">DMZ</text>'
    '<text x="291" y="71" text-anchor="middle" font-size="10" fill="#fef3c7">serveurs exposés</text>'
    '<line x1="334" y1="60" x2="366" y2="60" stroke="#94a3b8" stroke-width="2.5"/>'
    '<rect x="366" y="30" width="86" height="60" rx="8" fill="#b91c1c"/>'
    '<text x="409" y="55" text-anchor="middle" font-size="11.5" fill="#fff" font-weight="bold">Pare-feu</text>'
    '<text x="409" y="71" text-anchor="middle" font-size="10" fill="#fecaca">interne</text>'
    '<line x1="452" y1="60" x2="484" y2="60" stroke="#16a34a" stroke-width="2.5"/>'
    '<rect x="484" y="30" width="66" height="60" rx="8" fill="#059669"/>'
    '<text x="517" y="64" text-anchor="middle" font-size="12" fill="#fff" font-weight="bold">LAN</text>'
    '<text x="280" y="128" text-anchor="middle" font-size="10" fill="#64748b">'
    'Deux équipements à franchir — idéalement de deux marques différentes</text>'
    '</svg>')

# L'exemple fil rouge du volet 2, avec ses adresses.
SVG_EXEMPLE = (
    '<svg viewBox="0 0 560 280" role="img" aria-label="La DMZ de l’exemple : reverse proxy, serveur web '
    'et relais de messagerie derrière un OPNsense" style="max-width:560px;width:100%;height:auto;'
    'margin:8px 0 12px;font-family:system-ui,sans-serif">'
    '<ellipse cx="70" cy="50" rx="50" ry="26" fill="#64748b"/>'
    '<text x="70" y="48" text-anchor="middle" font-size="12" fill="#fff" font-weight="bold">Internet</text>'
    '<text x="70" y="62" text-anchor="middle" font-size="9" fill="#e2e8f0">clients, partenaires</text>'
    '<line x1="120" y1="50" x2="190" y2="50" stroke="#94a3b8" stroke-width="2.5"/>'
    '<text x="155" y="42" text-anchor="middle" font-size="9" fill="#64748b">203.0.113.10</text>'
    '<rect x="190" y="20" width="110" height="60" rx="10" fill="#dc2626"/>'
    '<text x="245" y="45" text-anchor="middle" font-size="12.5" fill="#fff" font-weight="bold">OPNsense</text>'
    '<text x="245" y="62" text-anchor="middle" font-size="9.5" fill="#fecaca">DMZ .254 · LAN .254</text>'
    '<line x1="300" y1="40" x2="380" y2="40" stroke="#16a34a" stroke-width="2.5"/>'
    '<rect x="380" y="16" width="160" height="48" rx="8" fill="#059669"/>'
    '<text x="460" y="36" text-anchor="middle" font-size="12" fill="#fff" font-weight="bold">LAN 192.168.10.0/24</text>'
    '<text x="460" y="52" text-anchor="middle" font-size="9.5" fill="#d1fae5">postes, AD, base de données</text>'
    '<line x1="245" y1="80" x2="245" y2="110" stroke="#f59e0b" stroke-width="2.5"/>'
    '<rect x="40" y="110" width="480" height="150" rx="12" fill="none" stroke="#d97706" stroke-width="2" stroke-dasharray="6 4"/>'
    '<text x="60" y="130" font-size="12" fill="#d97706" font-weight="bold">DMZ 192.168.20.0/24</text>'
    '<rect x="60" y="150" width="130" height="80" rx="8" fill="#d97706"/>'
    '<text x="125" y="172" text-anchor="middle" font-size="11.5" fill="#fff" font-weight="bold">Reverse proxy</text>'
    '<text x="125" y="188" text-anchor="middle" font-size="10" fill="#fef3c7">.20 · nginx / HAProxy</text>'
    '<text x="125" y="203" text-anchor="middle" font-size="10" fill="#fef3c7">reçoit 80 et 443</text>'
    '<text x="125" y="218" text-anchor="middle" font-size="10" fill="#fef3c7">porte le certificat</text>'
    '<rect x="215" y="150" width="130" height="80" rx="8" fill="#b45309"/>'
    '<text x="280" y="172" text-anchor="middle" font-size="11.5" fill="#fff" font-weight="bold">Serveur web</text>'
    '<text x="280" y="188" text-anchor="middle" font-size="10" fill="#fef3c7">.10 · IIS ou Apache</text>'
    '<text x="280" y="203" text-anchor="middle" font-size="10" fill="#fef3c7">joignable du proxy</text>'
    '<text x="280" y="218" text-anchor="middle" font-size="10" fill="#fef3c7">seulement</text>'
    '<rect x="370" y="150" width="130" height="80" rx="8" fill="#b45309"/>'
    '<text x="435" y="172" text-anchor="middle" font-size="11.5" fill="#fff" font-weight="bold">Relais mail</text>'
    '<text x="435" y="188" text-anchor="middle" font-size="10" fill="#fef3c7">.30 · Postfix</text>'
    '<text x="435" y="203" text-anchor="middle" font-size="10" fill="#fef3c7">reçoit 25</text>'
    '<text x="435" y="218" text-anchor="middle" font-size="10" fill="#fef3c7">relaie vers le LAN</text>'
    '<text x="280" y="248" text-anchor="middle" font-size="10" fill="#64748b">'
    'Internet ne voit que le proxy et le relais — le serveur web n’est pas publié</text>'
    '<text x="280" y="274" text-anchor="middle" font-size="10" fill="#64748b">'
    'Vers le LAN, deux flux nominatifs seulement : le web vers la base, le relais vers la messagerie</text>'
    '</svg>')

# Le cycle de vie de la zone, pour le volet 3.
SVG_CYCLE = (
    '<svg viewBox="0 0 560 130" role="img" aria-label="Le cycle d’exploitation d’une DMZ : surveiller, '
    'détecter, corriger, mettre à jour, revoir" style="max-width:560px;width:100%;height:auto;'
    'margin:8px 0 12px;font-family:system-ui,sans-serif">'
    + ''.join(
        f'<rect x="{x}" y="30" width="96" height="52" rx="10" fill="{c}"/>'
        f'<text x="{x + 48}" y="52" text-anchor="middle" font-size="11.5" fill="#fff" font-weight="bold">{t}</text>'
        f'<text x="{x + 48}" y="68" text-anchor="middle" font-size="9.5" fill="#fff" fill-opacity=".85">{s}</text>'
        for x, c, t, s in [
            (10, '#0369a1', 'Surveiller', 'journaux, sondes'),
            (120, '#7c3aed', 'Détecter', 'alertes, écarts'),
            (230, '#dc2626', 'Corriger', 'règle, correctif'),
            (340, '#059669', 'Mettre à jour', 'OS, applis, boîtier'),
            (450, '#d97706', 'Revoir', 'règles, doc, audit'),
        ])
    + ''.join(f'<line x1="{x}" y1="56" x2="{x + 14}" y2="56" stroke="#94a3b8" stroke-width="2.5"/>'
              f'<polygon points="{x + 14},51 {x + 20},56 {x + 14},61" fill="#94a3b8"/>'
              for x in (106, 216, 326, 436))
    + '<path d="M 498 82 Q 498 112 280 112 Q 58 112 58 82" fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="5 4"/>'
    '<polygon points="53,86 58,78 63,86" fill="#94a3b8"/>'
    '<text x="280" y="126" text-anchor="middle" font-size="10" fill="#64748b">… et on recommence : une DMZ n’est jamais « finie »</text>'
    '</svg>')


# ═══════════════════════════════════════════ volet 1 : comprendre ══

DMZ = '\n'.join([
    hero('La DMZ : comprendre la zone démilitarisée',
         'Volet 1 — pourquoi une zone à part pour ce qu’on expose, ce qu’on y met et ce qu’on n’y met '
         'jamais, les deux architectures, et les flux qu’on autorise ou qu’on interdit.'),
    STYLE,
    bandeau('dmz'),
    note('gray', '📚 Avant ce volet',
         '<a href="/pages/le-pare-feu">Le pare-feu</a> — les zones, les règles, le filtrage à états. '
         'Et l’idée de <a href="/pages/segmentation-sous-reseaux">sous-réseau</a> : une DMZ est '
         'd’abord un réseau distinct.'),

    '<h2>1) Le problème que la DMZ résout</h2>',
    '<p>Une entreprise a des services que le monde entier doit pouvoir joindre : son site web, sa '
    'messagerie, un portail pour ses clients. Et elle a des choses que <strong>personne</strong> '
    'dehors ne doit approcher : ses postes, son annuaire, sa comptabilité, ses fichiers. Tant que '
    'tout est sur le même réseau, exposer le premier expose le second : un serveur web piraté est '
    '<strong>dans</strong> le réseau, à côté du contrôleur de domaine.</p>',
    '<p>La <strong>DMZ</strong> (<em>zone démilitarisée</em>) est la réponse : une zone réseau '
    '<strong>à part</strong>, ni dedans ni dehors, où l’on place ce qu’on expose. Internet peut y '
    'entrer — par les portes qu’on a ouvertes — mais rien de ce qui y vit ne peut, de lui-même, '
    'aller vers le réseau interne.</p>',
    note('blue', '🔎 Analogie',
         'Le <strong>sas d’accueil</strong> d’un bâtiment. Les visiteurs y entrent librement, on y '
         'reçoit les livraisons, il y a un comptoir. Mais la porte vers les bureaux ne s’ouvre que de '
         'l’intérieur. Un visiteur mal intentionné reste un problème de hall d’accueil — pas un '
         'problème de bureaux. Le terme vient des zones tampons entre deux armées : personne n’y '
         'stationne ses forces.'),
    '<p>Ce que ça change concrètement : le jour où le serveur web est compromis — et sur Internet '
    'ce n’est pas « si », c’est « quand » — l’attaquant se retrouve dans une pièce vide. Il ne voit '
    'ni le LAN, ni les autres serveurs de la DMZ s’ils sont bien cloisonnés. C’est ce qu’on appelle '
    'limiter le <strong>mouvement latéral</strong>.</p>',

    '<h2>2) Ce qu’on met dans une DMZ — et ce qu’on n’y met jamais</h2>',
    tab(['En DMZ', 'Pourquoi'], [
        ['<strong>Serveur web</strong> public, portail clients', 'C’est ce que le monde doit voir : il est exposé par nature'],
        ['<strong>Reverse proxy</strong>', 'Le seul à recevoir 80/443 ; il distribue vers les applications derrière lui — même en DMZ'],
        ['<strong>Relais de messagerie</strong> (MTA entrant)', 'Reçoit le port 25 d’Internet, filtre, puis remet au serveur de messagerie interne'],
        ['<strong>DNS public</strong> (zone externe)', 'Répond à Internet sur le nom de l’entreprise ; ne connaît rien des machines internes'],
        ['<strong>Concentrateur VPN</strong>', 'Le point d’entrée des nomades, isolé jusqu’à ce qu’ils soient authentifiés'],
        ['<strong>Serveur FTP / SFTP</strong> d’échange', 'Dépôt pour les partenaires, sans accès aux partages internes'],
        ['<strong>Bastion</strong> d’administration', 'Le seul point d’où l’on administre la DMZ — jamais RDP ou SSH direct depuis Internet'],
    ]),
    tab(['Jamais en DMZ', 'Pourquoi'], [
        ['<strong>Contrôleur de domaine</strong>', 'C’est le trousseau de clés de tout le réseau : un DC compromis, c’est tout le domaine'],
        ['<strong>Base de données</strong> métier', 'Les données restent en zone interne ; le serveur web l’interroge par un flux précis, autorisé une fois'],
        ['<strong>Serveur de fichiers</strong>, sauvegardes', 'Ce sont les cibles finales d’un attaquant — on ne les met pas dans le sas'],
        ['<strong>Postes de travail</strong>', 'Un poste, ça clique sur des liens ; sa place est dans le LAN, derrière deux couches'],
    ]),
    note('yellow', '⚠️ « Le serveur web a besoin de la base de données »',
         'C’est vrai, et c’est le cas le plus fréquent. La réponse n’est pas de mettre la base en '
         'DMZ, ni le serveur web dans le LAN : c’est <strong>un flux</strong>, DMZ → LAN, de '
         'l’adresse du serveur web vers l’adresse de la base, sur le seul port de la base. Autorisé '
         'explicitement, journalisé, et c’est tout. Une règle étroite n’est pas une brèche ; un '
         'serveur au mauvais endroit en est une.'),

    '<h2>3) Le pare-feu à trois pattes</h2>',
    '<p>L’architecture la plus courante, et celle des TP : <strong>un seul pare-feu, trois '
    'interfaces</strong> — WAN, LAN, DMZ. La DMZ est un réseau IP distinct, sur sa propre carte ou '
    'son propre VLAN, et le pare-feu est la passerelle des deux zones internes.</p>',
    SVG_TROIS_PATTES,
    tab(['Flux', 'Décision', 'Détail'], [
        ['Internet → DMZ', '✔ <strong>ports publiés</strong> seulement', 'Une redirection de port par service, vers une adresse et un port précis — rien de plus'],
        ['Internet → LAN', '✘ <strong>jamais</strong>', 'Aucun service interne n’est publié directement ; les nomades passent par le VPN'],
        ['LAN → DMZ', '✔ administration, consultation', 'SSH/RDP depuis les postes d’admin, HTTPS pour tout le monde'],
        ['LAN → Internet', '✔ selon la politique', 'Ce que la DMZ ne change pas'],
        ['DMZ → LAN', '✘ <strong>par défaut, tout</strong>', 'Les rares exceptions (base de données, relais mail) sont nominatives : une source, une destination, un port'],
        ['DMZ → Internet', '◐ le strict nécessaire', 'DNS, mises à jour, éventuellement l’envoi de mail. Pas « any » : un serveur compromis ne doit pas pouvoir appeler chez lui'],
        ['DMZ → DMZ', '◐ entre serveurs, au cas par cas', 'Le proxy vers le web, oui ; le web vers le relais mail, non'],
    ]),
    note('red', '🚨 La règle qui fait la DMZ',
         '<strong>DMZ → LAN : bloqué.</strong> Tout le reste est du réglage ; celle-ci est le '
         'principe. Une DMZ dont les serveurs peuvent ouvrir des connexions vers le réseau interne '
         'n’est pas une DMZ : c’est un sous-réseau avec un nom rassurant.'),

    '<h2>4) Les deux pare-feu en série</h2>',
    '<p>Dans les grandes infrastructures, on place la DMZ <strong>entre deux pare-feu</strong> : '
    'un externe, qui ne connaît que le WAN et la DMZ, un interne, qui ne connaît que la DMZ et le '
    'LAN. Pour atteindre le LAN depuis Internet, il faut alors franchir deux équipements — et si '
    'ce sont deux produits différents, une faille dans l’un ne suffit pas.</p>',
    SVG_SANDWICH,
    tab(['', 'Trois pattes', 'Deux pare-feu'], [
        ['Équipements', 'Un', 'Deux, idéalement de marques différentes'],
        ['Coût, complexité', 'Faible', 'Double : matériel, licences, compétences, deux jeux de règles à tenir cohérents'],
        ['Si le pare-feu est compromis', 'Tout tombe', 'Il reste le second'],
        ['Point unique de panne', 'Oui', 'Deux — la haute disponibilité se fait alors par paire sur chacun'],
        ['Pour qui', 'PME, TP, la très grande majorité des cas', 'Grands comptes, secteurs réglementés, hébergeurs'],
    ]),
    note('gray', '💡 La « DMZ » de la box n’en est pas une',
         'Les box grand public proposent une option <em>DMZ</em> : elle désigne une machine du LAN '
         'vers laquelle tout le trafic entrant non sollicité est renvoyé. Aucune zone, aucun '
         'cloisonnement — c’est l’inverse d’une DMZ. Le mot est le même, l’objet n’a rien à voir.'),

    '<h2>5) Plusieurs DMZ, plusieurs niveaux</h2>',
    '<p>Rien n’oblige à n’en avoir qu’une. Dès que deux services exposés n’ont pas le même niveau '
    'de confiance, on les sépare : une DMZ pour le web public, une autre pour les échanges avec '
    'les partenaires, une troisième pour l’accès VPN. Et à l’intérieur d’une application, on '
    'retrouve la même idée en <strong>étages</strong> :</p>',
    tab(['Étage', 'Zone', 'Reçoit de', 'Parle à'], [
        ['Présentation', 'DMZ', 'Internet (443)', 'L’étage applicatif'],
        ['Application', 'DMZ ou zone interne dédiée', 'Le reverse proxy', 'La base de données'],
        ['Données', 'LAN, ou zone « données »', 'L’application, sur un port', 'Personne'],
    ]),
    '<p>Chaque étage ne connaît que le suivant. Le principe est le même que pour la DMZ entière : '
    '<strong>ce qui est exposé ne touche pas directement ce qui est précieux</strong>.</p>',

    '<h2>6) Ce que la DMZ ne fait pas</h2>',
    '<ul class="proc-steps">'
    '<li>Elle ne protège pas le serveur qu’elle contient : il reste exposé, et doit être '
    '<strong>durci</strong>, à jour, surveillé — c’est le volet 2 et le volet 3.</li>'
    '<li>Elle ne remplace pas un <strong>reverse proxy</strong> ou un WAF : elle limite ce que '
    'l’attaque peut atteindre ensuite, pas l’attaque elle-même.</li>'
    '<li>Elle ne vaut que par ses <strong>règles</strong>. Une DMZ avec « DMZ net → any : pass » '
    'est un décor.</li>'
    '<li>Elle ne tient pas toute seule : chaque service ajouté, chaque « juste pour tester » '
    'l’érode. D’où l’entretien.</li>'
    '</ul>',

    '<h2>✅ À retenir</h2>',
    '<ul class="proc-steps">'
    '<li>La DMZ est une <strong>zone à part</strong> pour ce qu’on expose à Internet : le sas, ni '
    'dedans ni dehors.</li>'
    '<li>On y met les <strong>services publiés</strong> (web, reverse proxy, relais mail, DNS '
    'public, VPN) ; jamais l’annuaire, les données, les fichiers, les postes.</li>'
    '<li><strong>Internet → DMZ</strong> sur les ports publiés, <strong>LAN → DMZ</strong> pour '
    'administrer, <strong>DMZ → LAN bloqué</strong> sauf exceptions nominatives, '
    '<strong>DMZ → Internet</strong> au strict nécessaire.</li>'
    '<li>Un pare-feu à trois pattes suffit presque toujours ; deux pare-feu en série pour les '
    'grands comptes.</li>'
    '<li>Le but : qu’un serveur exposé compromis <strong>ne mène nulle part</strong>.</li>'
    '</ul>',
    note('blue', '📘 La suite',
         '<a href="/pages/dmz-mise-en-place"><strong>Volet 2 — Mettre en place une DMZ</strong></a> : '
         'la démarche complète, de l’inventaire des services aux tests, sur un exemple chiffré.'),
    note('green', '🔗 À lire à côté',
         'Le concept de zones et de règles : <a href="/pages/le-pare-feu">Le pare-feu</a>. La DMZ '
         'sur le schéma d’une entreprise : <a href="/pages/schemas-infrastructure">Les schémas '
         'd’infrastructure</a> et <a href="/pages/reseau-entreprise">Concevoir le réseau d’une '
         'entreprise</a>. Les autres zones qu’on isole de la même façon : '
         '<a href="/pages/opnsense-segmentation">segmenter avec OPNsense</a>.'),
])


# ═════════════════════════════════════════ volet 2 : mise en place ══

MISE_EN_PLACE = '\n'.join([
    hero('Mettre en place une DMZ',
         'Volet 2 — la démarche, dans l’ordre : ce qu’on expose, l’adressage, la matrice de flux, la '
         'zone, les règles, la publication, le durcissement des serveurs, l’accès admin et les tests.'),
    STYLE,
    bandeau('dmz-mise-en-place'),
    note('gray', '📚 Avant ce volet',
         '<a href="/pages/dmz">Volet 1</a> pour le concept. Les manipulations dans le boîtier sont '
         'celles du cours OPNsense : <a href="/pages/opnsense-segmentation">créer une zone et écrire '
         'ses règles</a> (volet 4) et <a href="/pages/opnsense-nat">publier par redirection de '
         'port</a> (volet 2). Ici on suit la démarche ; là-bas, les clics.'),
    '<p>Une DMZ ne se « configure » pas : elle se <strong>conçoit</strong>, puis se construit, puis '
    'se vérifie. L’ordre ci-dessous est celui qui évite de revenir en arrière. L’exemple fil '
    'rouge : une PME qui publie son site web et reçoit sa messagerie.</p>',
    SVG_EXEMPLE,

    '<h2>1) L’inventaire : qu’est-ce qu’on expose, et pourquoi</h2>',
    '<p>Tout part d’une liste, et chaque ligne doit avoir une justification. Un service qu’on ne '
    'sait pas justifier ne se publie pas.</p>',
    tab(['Service', 'Port', 'Reçu par', 'Justification', 'Responsable'], [
        ['Site web', '443 (80 → redirigé)', 'Reverse proxy .20', 'Vitrine et espace client', 'Équipe web'],
        ['Messagerie entrante', '25', 'Relais mail .30', 'Recevoir le courrier du domaine', 'Admin système'],
        ['<s>RDP sur le serveur web</s>', '<s>3389</s>', '—', 'Refusé : administration par le bastion', '—'],
    ]),
    note('yellow', '⚠️ Le tableau se remplit avant d’acheter ou d’installer quoi que ce soit',
         'Chaque service publié est une surface d’attaque et un engagement d’entretien. Le moment '
         'de dire non, c’est ici — une fois qu’un port est ouvert et que quelqu’un s’en sert, le '
         'refermer devient un projet.'),

    '<h2>2) L’adressage</h2>',
    '<p>La DMZ est un sous-réseau distinct, avec sa propre passerelle. On lui réserve une plage '
    'qui se lit d’un coup d’œil dans les journaux : ici <code>192.168.20.0/24</code>, quand le LAN '
    'est en <code>192.168.10.0/24</code>.</p>',
    tab(['Machine', 'Adresse', 'Remarque'], [
        ['Pare-feu, interface DMZ', '<code>192.168.20.254</code>', 'La passerelle de la zone — convention du site'],
        ['Reverse proxy', '<code>192.168.20.20</code>', 'Le seul à recevoir 80 et 443 depuis le WAN'],
        ['Serveur web', '<code>192.168.20.10</code>', 'Ne reçoit que du proxy'],
        ['Relais mail', '<code>192.168.20.30</code>', 'Reçoit 25 depuis le WAN'],
        ['Adresse publique', '<code>203.0.113.10</code>', 'Celle du WAN du pare-feu, ou une adresse dédiée en NAT 1:1'],
    ]),
    '<p>Des <strong>adresses fixes</strong> partout : un serveur exposé n’a rien à faire en DHCP, '
    'et les règles de filtrage visent des adresses. Pas de DHCP sur l’interface DMZ, donc — ou '
    'une réservation stricte, mais l’absence est plus simple à auditer. Voir '
    '<a href="/pages/procedure-plan-adressage">Plan d’adressage</a>.</p>',

    '<h2>3) La matrice de flux</h2>',
    '<p>Le vrai travail. Avant la moindre règle, un tableau qui dit, zone par zone, qui a le droit '
    'de parler à qui, sur quoi. Il sera <strong>la documentation</strong> de la DMZ pendant toute sa '
    'vie — c’est lui qu’on relit à chaque changement.</p>',
    tab(['De ↓ vers →', 'Internet', 'LAN', 'Proxy .20', 'Web .10', 'Relais .30', 'Le pare-feu'], [
        ['<strong>Internet</strong>', '—', '✘', '✔ 443, 80', '✘', '✔ 25', '✘'],
        ['<strong>LAN</strong>', '✔ politique LAN', '—', '✔ 443 · admin 22', '✔ admin 22/3389', '✔ admin 22', '✔ DNS, admin'],
        ['<strong>Proxy .20</strong>', '✔ 443 (ACME, màj)', '✘', '—', '✔ 8080', '✘', '✔ DNS'],
        ['<strong>Web .10</strong>', '✔ 443 (màj)', '<strong>✔ 1433 → BDD</strong> nominatif', '✘', '—', '✘', '✔ DNS'],
        ['<strong>Relais .30</strong>', '✔ 25, 443 (màj)', '<strong>✔ 25 → messagerie</strong> nominatif', '✘', '✘', '—', '✔ DNS'],
    ]),
    note('blue', '💡 Lire les croix',
         'Trois lignes de serveurs, trois ✘ dans la colonne LAN — sauf deux exceptions en gras, '
         'chacune vers <strong>une</strong> adresse sur <strong>un</strong> port. Et aucun serveur '
         'de la DMZ ne parle à un autre, hormis le proxy vers le web. Si le relais mail est compromis, '
         'il ne voit ni le site, ni le proxy : chaque machine est seule dans sa case.'),

    '<h2>4) Créer la zone</h2>',
    '<p>Une carte réseau dédiée ou un VLAN — le <a href="/pages/opnsense-segmentation">volet 4 '
    'd’OPNsense</a> détaille les deux. Le résultat attendu : une interface nommée <code>DMZ</code>, '
    'en <code>192.168.20.254/24</code>, <strong>sans DHCP</strong> et, à ce stade, <strong>sans '
    'aucune règle</strong>. Les serveurs branchés dessus pinguent leur passerelle et rien d’autre : '
    'c’est le point de départ correct.</p>',
    '<p>Côté commutateur, si la DMZ est un VLAN : le port vers le pare-feu en trunk, les ports des '
    'serveurs en accès sur le VLAN de la DMZ, et <strong>aucun autre port</strong> dans ce VLAN. '
    'Une prise libre dans le VLAN DMZ est une prise où l’on branchera un jour un portable '
    '(<a href="/pages/vlan-securite">Sécuriser les VLAN</a>).</p>',

    '<h2>5) Les règles, dans l’ordre</h2>',
    '<p>Sur l’onglet <strong>DMZ</strong> — les paquets qui <em>entrent</em> par cette interface, '
    'c’est-à-dire ce que les serveurs de la DMZ émettent :</p>',
    tab(['#', 'Action', 'Source', 'Destination', 'Port', 'Rôle'], [
        ['1', 'Pass', 'DMZ net', 'DMZ address', '53', 'Le DNS du pare-feu (ou un résolveur dédié) répond aux serveurs'],
        ['2', 'Pass · log', '192.168.20.10', '192.168.10.50 (BDD)', '1433/TCP', 'L’exception nominative : le web interroge la base'],
        ['3', 'Pass · log', '192.168.20.30', '192.168.10.25 (messagerie)', '25/TCP', 'L’exception nominative : le relais remet le courrier'],
        ['4', 'Pass', '192.168.20.20', '192.168.20.10', '8080/TCP', 'Le proxy parle au serveur web'],
        ['5', '<strong>Block · log</strong>', 'DMZ net', 'This Firewall', 'tous', 'Jamais d’administration du pare-feu depuis la DMZ'],
        ['6', '<strong>Block · log</strong>', 'DMZ net', 'RESEAUX_INTERNES', 'tous', 'La règle qui fait la DMZ : rien vers le LAN ni les autres zones'],
        ['7', 'Pass', 'DMZ net', 'any', '80, 443/TCP', 'Mises à jour, ACME — ce qui reste après la 6'],
        ['—', '<em>refus implicite</em>', '', '', '', 'Tout le reste est jeté'],
    ]),
    '<p>Sur l’onglet <strong>LAN</strong>, ce qui va vers la DMZ : HTTPS vers le proxy pour tout le '
    'monde ; SSH et RDP vers les serveurs de la DMZ <strong>depuis les seules adresses '
    'd’administration</strong> (un alias <code>POSTES_ADMIN</code>), pas depuis « LAN net ».</p>',
    note('red', '🚨 Deux erreurs qui annulent tout',
         'Une règle <em>Pass any</em> placée <strong>au-dessus</strong> de la règle 6 : la 6 n’est '
         'plus jamais lue, la DMZ voit le LAN. Et un alias <code>RESEAUX_INTERNES</code> incomplet — '
         'oublier <code>10.0.0.0/8</code> quand une zone y vit. Après chaque modification, on relit '
         'la liste de haut en bas en se demandant, pour chaque règle, si une précédente ne l’a pas '
         'déjà décidée. La méthode : <a href="/pages/opnsense-segmentation">volet 4, § 6</a>.'),

    '<h2>6) Publier : redirection de port ou reverse proxy</h2>',
    '<p>Deux façons de rendre un service joignable depuis Internet, et on les combine.</p>',
    tab(['', 'Redirection de port (NAT)', 'Reverse proxy'], [
        ['Ce que c’est', 'Le pare-feu renvoie WAN:443 vers une adresse et un port de la DMZ',
         'Un serveur de la DMZ reçoit toutes les requêtes HTTP(S) et les distribue selon le nom du site'],
        ['Plusieurs sites sur une IP', 'Un port par service — 443 ne peut aller qu’à un endroit',
         'Autant qu’on veut, par nom (<em>vhost</em>)'],
        ['Certificats TLS', 'Sur chaque serveur', 'Au proxy, un seul endroit à renouveler'],
        ['Filtrage applicatif', 'Aucun', 'Possible : WAF, limitation de débit, blocage d’URL'],
        ['Pour quoi', 'Le mail (25), le VPN, un service unique', 'Tout ce qui est web'],
    ]),
    '<p>Dans l’exemple : deux redirections seulement — <code>443</code> et <code>80</code> vers le '
    'proxy .20, <code>25</code> vers le relais .30 — chacune avec sa règle de filtrage associée sur le '
    'WAN (<a href="/pages/opnsense-nat">volet 2, § 3</a>). Le serveur web .10 n’est <strong>pas</strong> '
    'publié : Internet ne connaît que le proxy. Le proxy, lui, est un '
    '<a href="/pages/linux-apache-virtualhosts">Apache</a> ou un nginx avec un '
    '<code>proxy_pass http://192.168.20.10:8080</code> par site.</p>',
    note('gray', '💡 Le DNS, dedans et dehors',
         'Vu d’Internet, <code>www.entreprise.fr</code> pointe sur <code>203.0.113.10</code>. Vu du '
         'LAN, il vaut mieux qu’il pointe sur <code>192.168.20.20</code> directement : c’est le '
         '<strong>DNS partagé</strong> (<em>split DNS</em>), qui évite la réflexion NAT et garde le '
         'trafic interne à l’intérieur (<a href="/pages/opnsense-services">volet 3, § 4</a>).'),

    '<h2>7) Durcir les serveurs de la DMZ</h2>',
    '<p>La zone limite les dégâts ; elle ne protège pas la machine. Un serveur en DMZ est '
    '<strong>attaqué en permanence</strong> dès qu’il a une adresse publique — les journaux le '
    'montrent en quelques minutes. Il se prépare en conséquence :</p>',
    '<ul class="proc-steps">'
    '<li><strong>Le minimum installé.</strong> Un rôle par machine, pas d’interface graphique sur '
    'un Linux, pas de service qu’on n’a pas listé au § 1. Ce qui n’est pas installé n’a pas de '
    'faille.</li>'
    '<li><strong>À jour avant d’être branché</strong>, et à jour ensuite (volet 3). Un serveur '
    'exposé avec un correctif en retard est trouvé par un scanner avant la fin de la semaine.</li>'
    '<li><strong>Pas de compte partagé, pas de mot de passe par défaut</strong>, des clés SSH '
    '(<a href="/pages/procedure-cle-ssh">les générer</a>, <a href="/pages/tp-ssh-securisation">'
    'sécuriser SSH</a>), et jamais <code>root</code> ou <code>Administrateur</code> en direct.</li>'
    '<li><strong>Le pare-feu local aussi</strong> : sur le serveur, n’écouter que sur les ports '
    'prévus. C’est une seconde couche si une règle du boîtier est un jour trop large '
    '(<a href="/pages/procedure-securite-poste">Sécuriser un serveur Windows</a>).</li>'
    '<li><strong>Pas membre du domaine interne.</strong> Un serveur de la DMZ joint à l’AD garde '
    'des secrets du domaine en mémoire — c’est précisément ce qu’on ne veut pas dans le sas. '
    'Comptes locaux, ou une forêt dédiée si l’on a vraiment besoin d’un annuaire.</li>'
    '<li><strong>Un compte de service par flux</strong> vers le LAN : celui qui interroge la base '
    'n’a de droits que sur cette base, en lecture si ça suffit.</li>'
    '<li><strong>Des journaux qui partent ailleurs</strong> : syslog vers le LAN (un flux sortant '
    'nominatif de plus, vers un port), pour qu’un attaquant ne puisse pas les effacer.</li>'
    '</ul>',

    '<h2>8) Administrer sans exposer l’administration</h2>',
    '<p>Le réflexe fatal : ouvrir 3389 ou 22 depuis Internet « pour pouvoir intervenir de chez '
    'soi ». Ces ports sont scannés en continu, et une administration exposée est la première '
    'porte essayée. Les trois façons acceptables :</p>',
    tab(['Méthode', 'Comment', 'Pour qui'], [
        ['Depuis le LAN', 'SSH/RDP vers la DMZ, autorisés depuis les seuls postes d’administration', 'Le quotidien'],
        ['Par le VPN', 'Le nomade entre par le <a href="/pages/le-vpn">VPN</a>, débouche dans une zone d’admin, puis va vers la DMZ', 'Les interventions à distance'],
        ['Par un bastion', 'Une machine unique, durcie, journalisée, seule autorisée à ouvrir SSH/RDP vers la DMZ', 'Dès qu’on est plusieurs, ou audité'],
    ]),
    '<p>Dans tous les cas, l’interface web du pare-feu reste <strong>inaccessible depuis la '
    'DMZ</strong> — c’est la règle 5 — et accessible depuis le LAN sur un port non standard, par '
    'un compte nommé (<a href="/pages/tp-opnsense-installation">TP 1.1</a>).</p>',

    '<h2>9) Vérifier — ce qui doit marcher, et ce qui doit échouer</h2>',
    '<p>Une DMZ se teste <strong>dans les deux sens</strong>. Un test qui réussit prouve qu’un '
    'service fonctionne ; un test qui échoue prouve que la zone fait son travail. Le second compte '
    'autant que le premier.</p>',
    tab(['Depuis', 'Test', 'Attendu'], [
        ['Internet (4G, pas le LAN)', '<code>https://www.entreprise.fr</code>', 'Le site, avec un certificat valide'],
        ['Internet', '<code>nmap -Pn 203.0.113.10</code>', '<strong>Trois ports</strong> ouverts : 25, 80, 443. Rien d’autre'],
        ['Internet', '<code>nmap -p 22,3389 203.0.113.10</code>', 'filtered — l’administration n’existe pas vue de dehors'],
        ['Le serveur web .10', '<code>ping 192.168.10.1</code>, <code>nc -vz 192.168.10.10 445</code>', '<strong>Échec</strong> — la règle 6, en rouge dans le journal'],
        ['Le serveur web .10', '<code>nc -vz 192.168.10.50 1433</code>', 'Réussite — la seule porte vers le LAN'],
        ['Le serveur web .10', '<code>curl https://deb.debian.org</code>', 'Réussite — les mises à jour passent'],
        ['Le relais .30', '<code>nc -vz 192.168.20.10 8080</code>', 'Échec — un serveur de la DMZ ne voit pas l’autre'],
        ['Un poste du LAN', '<code>ssh admin@192.168.20.10</code>', 'Réussite depuis un poste d’admin, échec depuis un autre'],
        ['La DMZ', '<code>https://192.168.20.254</code>', 'Échec — la règle 5'],
    ]),
    '<p>On garde ces résultats : ils sont la <strong>référence</strong> que le volet 3 rejouera '
    'régulièrement. Un test qui change de résultat sans qu’on ait rien voulu changer est une '
    'alerte.</p>',
    note('gray', '📝 Ce qu’on documente en sortant',
         'Le schéma avec les adresses, le tableau des services publiés (§ 1), la matrice de flux '
         '(§ 3), la liste des règles avec leur justification, les comptes d’administration et le '
         'résultat des tests. Une page suffit — mais sans elle, dans un an, plus personne n’osera '
         'toucher à une règle.'),

    '<h2>✅ À retenir</h2>',
    '<ul class="proc-steps">'
    '<li>L’ordre : <strong>inventaire → adressage → matrice → zone → règles → publication → '
    'durcissement → accès admin → tests</strong>. On ne commence pas par les règles.</li>'
    '<li>Des adresses fixes, pas de DHCP, un sous-réseau qui se reconnaît dans les journaux.</li>'
    '<li>La règle <strong>DMZ → réseaux internes : bloqué</strong>, et au-dessus d’elle les seules '
    'exceptions nominatives.</li>'
    '<li>Un <strong>reverse proxy</strong> reçoit tout le web ; les serveurs derrière ne sont pas '
    'publiés.</li>'
    '<li>Les serveurs sont <strong>durcis</strong>, hors domaine, administrés depuis le LAN, le '
    'VPN ou un bastion — jamais depuis Internet.</li>'
    '<li>On teste ce qui doit <strong>échouer</strong> autant que ce qui doit marcher, et on garde '
    'la référence.</li>'
    '</ul>',
    note('blue', '📘 La suite',
         '<a href="/pages/dmz-surveillance-entretien"><strong>Volet 3 — Surveiller et entretenir '
         'une DMZ</strong></a> : ce qu’on regarde chaque jour, ce qu’on met à jour, ce qu’on revoit '
         'chaque trimestre, et quoi faire quand un serveur du sas est compromis.'),
    note('green', '🎓 Pour s’exercer',
         'Les <a href="/pages/tp-opnsense-filtrage">TP OPNsense 1.2</a> et '
         '<a href="/pages/tp-opnsense-nat">1.3</a> construisent exactement ce schéma en maquette : '
         'une zone de serveurs isolée, des règles nominatives, une publication par redirection de '
         'port. Il ne manque que le reverse proxy — un <a href="/pages/linux-apache-virtualhosts">'
         'Apache</a> de plus dans la zone.'),
])


# ══════════════════════════════ volet 3 : surveillance et entretien ══

SURVEILLANCE = '\n'.join([
    hero('Surveiller et entretenir une DMZ',
         'Volet 3 — une DMZ se construit une fois et se surveille tous les jours : journaux, '
         'détection d’intrusion, supervision, scans d’exposition, mises à jour, revue des règles, '
         'certificats, sauvegardes, et la conduite à tenir en cas de compromission.'),
    STYLE,
    bandeau('dmz-surveillance-entretien'),
    note('gray', '📚 Avant ce volet',
         '<a href="/pages/dmz">Volet 1</a> et <a href="/pages/dmz-mise-en-place">volet 2</a>. Les '
         'outils du boîtier : <a href="/pages/opnsense-vpn-ids">Suricata dans OPNsense</a> (volet 5, '
         '§ 7). Et le cours général sur <a href="/pages/supervision">la supervision</a>.'),
    '<p>Le jour de la mise en service, la DMZ est exactement ce qu’on a conçu. Puis les semaines '
    'passent : un correctif sort, un collègue ajoute une règle « temporaire », un certificat '
    'expire, un serveur est retiré mais pas sa redirection. Sans surveillance ni entretien, une '
    'DMZ <strong>dérive</strong> — et personne ne le voit, parce que le site continue de '
    'répondre.</p>',
    SVG_CYCLE,

    '<h2>1) Surveiller : ce qu’on regarde, et où</h2>',
    '<p>Surveiller, c’est comparer en permanence ce qui se passe à ce qu’on avait décidé. Quatre '
    'sources, chacune répond à une question différente.</p>',
    tab(['Source', 'La question', 'Où, dans OPNsense'], [
        ['<strong>Journal du pare-feu</strong>', 'Qui a essayé quoi, et qu’en a-t-on fait ?', menu('Firewall › Log Files › Live View') + ' et ' + menu('Plain View')],
        ['<strong>IDS / IPS</strong>', 'Ce trafic autorisé ressemble-t-il à une attaque ?', menu('Services › Intrusion Detection › Alerts')],
        ['<strong>Supervision</strong>', 'Le service répond-il, et dans quel état sont les machines ?', 'Un outil dédié : Zabbix, Centreon, Uptime Kuma ; ' + menu('Services › Monit') + ' au minimum'],
        ['<strong>Journaux des serveurs</strong>', 'Qu’a fait l’application, qui s’est connecté ?', 'Sur chaque serveur — et centralisés en dehors de la DMZ'],
    ]),

    '<h3>Le journal du pare-feu</h3>',
    '<p>Sur une DMZ, tout n’a pas le même poids. Ce qu’on filtre en priorité :</p>',
    tab(['Ce qu’on cherche', 'Filtre', 'Ce que ça veut dire'], [
        ['<strong>DMZ → LAN bloqué</strong>', 'Interface DMZ, action block, destination 192.168.10.0/24',
         '<strong>Le signal le plus fort.</strong> Un serveur de la DMZ n’a aucune raison d’essayer. '
         'Soit une erreur de configuration, soit une machine compromise qui explore'],
        ['DMZ → Internet bloqué', 'Interface DMZ, action block, destination hors réseaux internes',
         'Un serveur qui tente de sortir sur un port imprévu : un logiciel malveillant qui appelle son serveur de commande, ou une mise à jour vers une adresse nouvelle'],
        ['WAN → DMZ bloqué, en masse', 'Interface WAN, action block',
         'Le bruit de fond d’Internet — des milliers de lignes par jour, normal. Ce qui compte : un port publié qui apparaît soudain en <em>block</em>, ou un pic soudain depuis une seule adresse'],
        ['WAN → DMZ passé, hors ports publiés', 'Interface WAN, action pass, port ∉ {25, 80, 443}',
         'Ne doit <strong>jamais</strong> exister. Si oui, une règle a été ajoutée — par qui ?'],
        ['Admin vers la DMZ', 'Destination DMZ, port 22 ou 3389',
         'Chaque connexion doit correspondre à une intervention connue'],
    ]),
    note('yellow', '⚠️ Les règles qui ne journalisent pas sont invisibles',
         'Une règle <em>Pass</em> ne laisse aucune trace par défaut. Sur les exceptions nominatives '
         'DMZ → LAN et sur toutes les règles de blocage, la case <em>Log</em> est cochée dès la '
         'mise en place (volet 2, § 5). Le jour de l’incident, c’est la différence entre savoir et '
         'supposer.'),
    '<p>Les journaux du boîtier ont une durée de vie courte et disparaissent avec lui. On les '
    'envoie vers un serveur syslog dans le LAN : ' + menu('System › Settings › Logging / targets')
    + ', un hôte, le port 514, et les catégories <em>filter</em> et <em>suricata</em>. Le serveur '
    'de journaux est un bon candidat pour la supervision : c’est lui qui garde la mémoire.</p>',

    '<h3>La détection d’intrusion</h3>',
    '<p>Le pare-feu sait qu’un paquet va vers le port 443 ; il ne sait pas que la requête HTTP '
    'qu’il contient exploite une faille. C’est le rôle de Suricata, activé sur '
    '<strong>l’interface DMZ</strong> (et sur le WAN), en mode IDS d’abord — on regarde ce qu’il '
    'lève pendant deux semaines — puis IPS sur les signatures qui ne produisent pas de faux '
    'positifs. Les jeux de règles gratuits d’ET Open suffisent pour commencer. Le détail : '
    '<a href="/pages/opnsense-vpn-ids">volet 5, § 7</a>.</p>',
    note('gray', '💡 Un IDS sur la DMZ voit peu de choses, et c’est ce qui le rend lisible',
         'Sur le LAN, l’IDS se noie dans le trafic des postes. Sur la DMZ, il n’y a que trois '
         'serveurs et cinq flux : chaque alerte mérite un regard. C’est la meilleure interface pour '
         'apprendre à s’en servir.'),

    '<h3>La supervision</h3>',
    '<p>Trois niveaux, et on commence par le premier :</p>',
    tab(['Niveau', 'Ce qu’on sonde', 'Exemple'], [
        ['Le service, <strong>vu de dehors</strong>', 'Le site répond-il, avec le bon contenu, en HTTPS valide ?', 'Une sonde HTTP depuis l’extérieur (Uptime Kuma, un service en ligne) qui vérifie un mot de la page et l’expiration du certificat'],
        ['La machine', 'CPU, mémoire, disque, charge — et leurs <strong>seuils</strong>', 'Un disque plein sur le relais mail, c’est du courrier perdu'],
        ['Le flux', 'La base répond-elle au serveur web ? Le relais joint-il la messagerie ?', 'Une sonde TCP sur 1433 et 25 depuis les serveurs concernés'],
    ]),
    '<p>Le point à ne pas rater : <strong>l’expiration des certificats</strong>. Un certificat '
    'échu ne casse rien la veille et tout le lendemain matin. Une sonde qui alerte à 14 jours, ou '
    'mieux, un renouvellement automatique par ACME sur le reverse proxy — et on surveille quand même.</p>',

    '<h3>Le scan d’exposition</h3>',
    '<p>Une fois par mois, on refait le test du volet 2 depuis l’extérieur — un partage de '
    'connexion mobile, pas le LAN :</p>',
    cmd('nmap -Pn -p- 203.0.113.10          # tous les ports TCP : il doit en rester trois\n'
        'nmap -Pn -sU --top-ports 50 203.0.113.10   # et rien en UDP\n'
        'nmap -Pn -sV -p 25,80,443 203.0.113.10     # les versions annoncées — les mêmes qu’avant ?'),
    '<p>On compare au résultat de référence. Un port de plus, c’est une redirection ajoutée ; une '
    'version qui change, c’est une mise à jour — ou un remplacement qu’on ignorait. Les services '
    'comme Shodan ou Censys font ce scan en continu pour tout Internet : consulter ce qu’ils voient '
    'de son adresse est gratuit et instructif.</p>',

    '<h2>2) Entretenir : ce qu’on fait, et à quel rythme</h2>',

    '<h3>Les mises à jour</h3>',
    '<p>Un serveur exposé se met à jour <strong>avant</strong> les autres, pas après. Trois '
    'composants, trois rythmes :</p>',
    tab(['Composant', 'Rythme', 'Comment'], [
        ['Les <strong>applications</strong> exposées (CMS, proxy, MTA)', 'Dès qu’un correctif de sécurité sort — sous une semaine',
         'Abonnement aux annonces de sécurité de chaque produit ; un CMS avec ses extensions est le cas le plus critique'],
        ['Le <strong>système</strong> des serveurs', 'Mensuel, plus tôt si critique',
         '<code>apt update &amp;&amp; apt upgrade</code>, Windows Update — avec un instantané de la VM avant'],
        ['Le <strong>pare-feu</strong> lui-même', 'À chaque version, après lecture des notes',
         menu('System › Firmware') + ' — sauvegarde de la configuration d’abord, créneau annoncé, la version précédente reste disponible'],
    ]),
    note('yellow', '⚠️ Mettre à jour, c’est changer',
         'Chaque mise à jour passe par la procédure de changement du § 3 : sauvegarde, créneau, '
         'test, retour arrière possible. Un serveur qui ne redémarre pas après un correctif à '
         '18 h un vendredi, c’est une nuit blanche évitable.'),

    '<h3>La revue des règles</h3>',
    '<p>Chaque trimestre, la liste des règles de la DMZ et du WAN se relit ligne à ligne, avec la '
    'matrice de flux du volet 2 à côté. Pour chaque règle :</p>',
    '<ul class="proc-steps">'
    '<li>Est-elle <strong>dans la matrice</strong> ? Si non, qui l’a ajoutée, pourquoi, et la '
    'matrice doit-elle changer — ou la règle disparaître ?</li>'
    '<li>A-t-elle une <strong>description</strong> qui dit son rôle ? Une règle sans description '
    'est une règle que personne n’osera supprimer.</li>'
    '<li>A-t-elle <strong>servi</strong> ? OPNsense affiche les compteurs par règle '
    '(' + menu('Firewall › Rules') + ', l’icône de statistiques). Une règle à zéro depuis trois '
    'mois est une règle à désactiver — puis supprimer au trimestre suivant si rien n’a crié.</li>'
    '<li>Est-elle <strong>aussi étroite</strong> que possible ? « DMZ net → LAN net : 1433 » est '
    'plus large que « .10 → .50 : 1433 », et ce n’est pas la même DMZ.</li>'
    '<li>Les <strong>alias</strong> sont-ils à jour ? Une machine retirée qui reste dans '
    '<code>POSTES_ADMIN</code> est un droit orphelin.</li>'
    '</ul>',
    '<p>Même exercice pour les <strong>redirections de port</strong> : chacune correspond à une '
    'ligne du tableau des services publiés. Une redirection vers une adresse qui ne répond plus est '
    'à supprimer, pas à laisser « au cas où ».</p>',

    '<h3>Les sauvegardes</h3>',
    tab(['Quoi', 'Quand', 'Où'], [
        ['La configuration du pare-feu (XML)', 'Avant chaque changement, et chaque semaine par tâche', 'Hors du pare-feu — le LAN, un dépôt versionné : ' + menu('System › Configuration › Backups')],
        ['Les serveurs de la DMZ', 'Quotidien pour les données, hebdomadaire pour le système', '<strong>Vers le LAN, à l’initiative du LAN</strong> : le serveur de sauvegarde vient chercher, la DMZ ne pousse pas'],
        ['La documentation (matrice, schéma, tests de référence)', 'À chaque changement', 'Avec la configuration'],
    ]),
    '<p>Une sauvegarde qu’on n’a jamais restaurée n’existe pas. Une fois par an au moins, on '
    'reconstruit un serveur de la DMZ depuis la sauvegarde sur une VM à part, et on vérifie que le '
    'site s’affiche. C’est aussi le meilleur entraînement pour le § 4 '
    '(<a href="/pages/procedure-sauvegarde">Sauvegarde &amp; restauration</a>).</p>',

    '<h3>Les certificats et les secrets</h3>',
    '<ul class="proc-steps">'
    '<li>Les certificats TLS : renouvelés par ACME sur le proxy, surveillés par la sonde. Ceux qui '
    'ne peuvent pas l’être ont une date dans le calendrier, deux mois avant l’échéance.</li>'
    '<li>Les mots de passe des comptes de service (base de données, relais) et les clés SSH : '
    'changés quand une personne qui les connaissait part, et au moins une fois par an.</li>'
    '<li>Le certificat de l’interface d’administration du pare-feu, souvent oublié : le remplacer '
    'par un vrai évite d’habituer tout le monde à cliquer sur « continuer malgré le risque ».</li>'
    '</ul>',

    '<h2>3) Changer sans casser : la procédure</h2>',
    '<p>Une DMZ en production ne se modifie pas « vite fait ». Toute modification — règle, '
    'redirection, mise à jour, nouveau service — suit le même chemin :</p>',
    '<ol class="proc-steps">'
    '<li><strong>Écrire</strong> ce qu’on va changer et pourquoi, et mettre à jour la matrice de '
    'flux <em>avant</em> le boîtier.</li>'
    '<li><strong>Sauvegarder</strong> la configuration du pare-feu et faire un instantané des VM '
    'concernées.</li>'
    '<li><strong>Prévenir</strong> : un créneau, en dehors des heures où le service compte.</li>'
    '<li><strong>Appliquer</strong> — une seule modification à la fois.</li>'
    '<li><strong>Tester</strong> : les tests de référence du volet 2, dans les deux sens. Le '
    'nouveau flux passe ; ceux qui doivent échouer échouent toujours.</li>'
    '<li><strong>Revenir en arrière</strong> si un test de référence change de résultat sans qu’on '
    'l’ait voulu — c’est à ça que sert la sauvegarde de l’étape 2.</li>'
    '<li><strong>Documenter</strong> : la description de la règle, le tableau des services, la '
    'date.</li>'
    '</ol>',
    note('red', '🚨 « Temporaire »',
         'Une règle temporaire a une <strong>date de fin dans sa description</strong> et un rappel '
         'dans le calendrier. Sinon elle est permanente — toutes les DMZ ont une règle « TEST — à '
         'supprimer » vieille de deux ans, et c’est par elle que ça passe.'),

    '<h2>4) Quand un serveur de la DMZ est compromis</h2>',
    '<p>C’est le scénario pour lequel la DMZ existe. Si elle a été bien tenue, il est '
    '<strong>contenu</strong> ; il faut maintenant le traiter sans détruire les traces.</p>',
    '<ol class="proc-steps">'
    '<li><strong>Isoler, pas éteindre.</strong> Désactiver la redirection de port et la règle de '
    'sortie du serveur — il ne reçoit plus rien, ne peut plus rien appeler. Éteindre la machine '
    'efface la mémoire et ce qu’elle contient d’utile.</li>'
    '<li><strong>Figer les preuves.</strong> Un instantané de la VM, une copie des journaux du '
    'pare-feu et du syslog pour la période, avant toute autre action.</li>'
    '<li><strong>Chercher l’étendue.</strong> Dans le journal du pare-feu : ce que le serveur a '
    'tenté vers le LAN et vers Internet, et depuis quand. Les <em>block</em> DMZ → LAN sont la '
    'preuve que la zone a tenu ; un <em>pass</em> inattendu dit l’inverse et change l’échelle de '
    'l’incident.</li>'
    '<li><strong>Ne pas nettoyer : reconstruire.</strong> Un serveur compromis se réinstalle depuis '
    'zéro — et depuis un système à jour, pas depuis la sauvegarde d’hier qui contient peut-être déjà '
    'la porte dérobée. Les données seules sont restaurées, après vérification.</li>'
    '<li><strong>Changer tous les secrets</strong> que la machine connaissait : compte de base de '
    'données, clés, certificats, mots de passe des comptes qui s’y sont connectés.</li>'
    '<li><strong>Comprendre par où</strong>, corriger — le correctif manquant, la règle trop large, '
    'l’extension du CMS — et écrire ce qui s’est passé. Le rapport d’incident est ce qui empêche le '
    'suivant.</li>'
    '</ol>',

    '<h2>5) Le calendrier</h2>',
    tab(['Quand', 'Quoi'], [
        ['<strong>Chaque jour</strong>', 'Un coup d’œil aux alertes de supervision et aux <em>block</em> DMZ → LAN des dernières 24 h ; les alertes IDS de sévérité haute'],
        ['<strong>Chaque semaine</strong>', 'Les annonces de sécurité des produits exposés ; la sauvegarde de la configuration a-t-elle eu lieu ; l’espace disque des serveurs'],
        ['<strong>Chaque mois</strong>', 'Mises à jour système des serveurs et du boîtier ; le scan d’exposition depuis l’extérieur, comparé à la référence ; le certificat expire dans plus de 30 jours'],
        ['<strong>Chaque trimestre</strong>', 'Revue des règles, des redirections et des alias ; règles à zéro désactivées ; tableau des services publiés relu avec les responsables'],
        ['<strong>Chaque année</strong>', 'Restauration d’essai d’un serveur ; rotation des secrets ; un test d’intrusion externe, même modeste ; le schéma et la matrice remis à jour'],
        ['<strong>À chaque changement</strong>', 'La procédure du § 3, sans exception'],
    ]),

    '<h2>✅ À retenir</h2>',
    '<ul class="proc-steps">'
    '<li>Une DMZ <strong>dérive</strong> si on ne la regarde pas ; le site qui répond ne prouve '
    'rien.</li>'
    '<li>Surveiller : le journal du pare-feu (les <strong>block DMZ → LAN</strong> d’abord), l’IDS '
    'sur l’interface DMZ, une supervision vue de dehors, un scan d’exposition mensuel comparé à la '
    'référence.</li>'
    '<li>Entretenir : mises à jour <strong>avant</strong> les autres, revue trimestrielle des '
    'règles avec la matrice, sauvegardes tirées depuis le LAN et restaurées une fois par an, '
    'certificats et secrets datés.</li>'
    '<li>Changer suit une procédure : écrire, sauvegarder, prévenir, appliquer, tester dans les '
    'deux sens, documenter.</li>'
    '<li>Compromis : isoler sans éteindre, figer les preuves, mesurer, <strong>reconstruire</strong>, '
    'changer les secrets, écrire le rapport.</li>'
    '</ul>',
    note('green', '🔗 À lire à côté',
         '<a href="/pages/supervision">La supervision</a> pour les outils et les seuils ; '
         '<a href="/pages/le-wireshark">Wireshark</a> quand un flux résiste à l’analyse ; '
         '<a href="/pages/opnsense-vpn-ids">Suricata dans OPNsense</a> ; et '
         '<a href="/pages/depannage">le dépannage</a> pour la méthode quand quelque chose ne répond '
         'plus.'),
])


# ═══════════════════════════════════════════════════════ le lot ══

PAGES = [
    ('dmz', 'La DMZ : comprendre la zone démilitarisée',
     'Volet 1 — pourquoi une zone à part pour ce qu’on expose, ce qu’on y met et ce qu’on n’y met '
     'jamais, pare-feu à trois pattes ou deux pare-feu en série, et les flux autorisés ou interdits.',
     DMZ,
     'Volet 1 — le sas entre Internet et le LAN : ce qu’on y met, ce qu’on n’y met jamais, les '
     'deux architectures et la règle qui fait la DMZ (DMZ → LAN bloqué).'),
    ('dmz-mise-en-place', 'Mettre en place une DMZ',
     'Volet 2 — la démarche dans l’ordre : inventaire des services, adressage, matrice de flux, '
     'zone, règles, publication par NAT ou reverse proxy, durcissement, accès admin, tests.',
     MISE_EN_PLACE,
     'Volet 2 — la démarche sur un exemple chiffré : inventaire, adressage, matrice de flux, '
     'règles dans l’ordre, reverse proxy, durcissement des serveurs, administration, tests.'),
    ('dmz-surveillance-entretien', 'Surveiller et entretenir une DMZ',
     'Volet 3 — journaux, détection d’intrusion, supervision, scans d’exposition, mises à jour, '
     'revue des règles, sauvegardes, procédure de changement, conduite en cas de compromission.',
     SURVEILLANCE,
     'Volet 3 — ce qu’on regarde chaque jour, ce qu’on met à jour, la revue trimestrielle des '
     'règles, les sauvegardes, la procédure de changement et le calendrier — et quoi faire quand un '
     'serveur du sas est compromis.'),
]


def main():
    c = sqlite3.connect(BASE)
    rapport = []
    for slug, titre, extrait, contenu, description in PAGES:
        etat = publier(c, slug, titre, extrait, contenu)
        idx = c.execute("SELECT content FROM pages WHERE slug='cours'").fetchone()[0]
        neuf, info = ranger_dans_index(idx, slug, titre, description, sous_groupe=SOUS_GROUPE)
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

# -*- coding: utf-8 -*-
"""
Le module pare-feu du formateur : un cours de notions et trois corrigés de TP.

D'OÙ VIENT LE CONTENU
Quatre documents fournis — une présentation « Firewall » (onze diapositives :
définition, zones, règles, stateful, journaux, NAT/PAT, fonctions avancées,
bonnes pratiques) et trois énoncés de TP OPNsense : 1.1 installation, 1.2
filtrage des flux, 1.3 NAT. Comme pour Apache/ProFTPd : les notions deviennent
un cours, les demandes deviennent des corrigés.

POURQUOI RÉÉCRIRE `le-pare-feu` PLUTÔT QUE CRÉER UNE PAGE À CÔTÉ
La page existait, courte (une analogie, un schéma, quatre notions). La
présentation couvre exactement le même sujet, en plus complet. Deux pages
« Le pare-feu » se seraient fait concurrence dans l'index, le quiz et les
douze renvois qui pointent déjà sur ce slug. On garde le slug, l'analogie et
le schéma d'origine, et on y met tout le reste.

L'INFRASTRUCTURE EST CELLE DE L'ÉNONCÉ, pas celle du cours OPNsense : trois
cartes (WAN, LAN 192.168.10.0/24, LAN_SRV 192.168.20.0/24), un poste Windows 10
en DHCP, un serveur DNS/Web en 192.168.20.100, domaine macao.city. C'est ce que
l'apprenant a sous les yeux. L'énoncé 1.3 parle d'un serveur en .10 là où le
schéma dit .100 : le corrigé suit le schéma et signale l'écart.

LES CORRIGÉS TRANCHENT là où l'énoncé laisse un choix qui change tout : quelle
carte devient « LAN » au sens d'OPNsense (celle des postes clients, pour que
l'anti-lockout serve à quelque chose), et le DHCP qu'on n'active pas à
l'installation puisque le TP 1.2 le fait faire dans l'interface.

IDEMPOTENT : relancer met à jour les quatre pages, ne duplique ni la carte de
l'index des cours ni la section de l'index des TP, et recalcule les compteurs.
"""
import re
import sqlite3
import sys
from pathlib import Path

from opnsense_serie import STYLE as STYLE_COURS, acc, note, publier, ranger_dans_index

BASE = Path(__file__).resolve().parent.parent / 'cms.sqlite'

# Le gabarit des corrigés, repris à l'identique d'apache-ftp.py : `.proc-cmd`,
# titres ① ② ③ et blocs `.qr` qui répondent à une question de l'énoncé.
STYLE_TP = ("<style>.proc-steps{padding-left:22px;line-height:1.75}.proc-steps>li{margin:7px 0}"
            ".proc-steps code,.proc-cmd,.qr code{font-family:ui-monospace,'Space Mono',monospace}"
            ".proc-cmd{background:var(--surface-2);border:1px solid var(--border);border-radius:8px;"
            "padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;"
            "line-height:1.5}.ref-table{border-collapse:collapse;width:100%;margin:10px 0}"
            ".ref-table td,.ref-table th{padding:6px 9px;border:1px solid var(--border);"
            "text-align:left;font-size:12.5px;vertical-align:top}"
            ".ref-table th{color:var(--text-muted);background:var(--surface-2)}"
            "@media (max-width:640px){.ref-table{display:block;overflow-x:auto}}"
            "code{overflow-wrap:anywhere}"
            ".qr{border:1px solid var(--border);border-left:3px solid var(--accent);"
            "background:var(--surface-2);border-radius:8px;padding:9px 13px;margin:9px 0}"
            ".qr .q{font-weight:600;margin-bottom:3px}"
            ".qr .a{color:var(--text-soft);font-size:13.5px}"
            ".lx-nav{font-family:ui-monospace,'Space Mono',monospace;font-size:12.5px;"
            "font-weight:600;background:var(--surface-3);border:1px solid var(--border);"
            "border-radius:6px;padding:1px 7px;white-space:nowrap}"
            # Le fil des trois TP, même dessin que le bandeau des volets du cours.
            ".ops-serie{display:flex;flex-wrap:wrap;gap:7px;align-items:center;margin:4px 0 18px}"
            ".ops-serie .ops-t{font-size:11.5px;font-weight:700;color:var(--text-muted);"
            "text-transform:uppercase;letter-spacing:.04em;margin-right:3px}"
            ".ops-v{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;"
            "text-decoration:none;border:1px solid var(--border);border-radius:999px;padding:4px 12px;"
            "background:var(--surface);color:var(--text-soft);transition:border-color .15s,color .15s}"
            "a.ops-v:hover{border-color:var(--accent);color:var(--accent)}"
            ".ops-v .ops-n{font-size:11px;font-weight:700;color:var(--text-muted);"
            "background:var(--surface-3);border-radius:999px;padding:0 6px}"
            ".ops-v.ops-ici{border-color:var(--accent);color:var(--accent);"
            "background:color-mix(in srgb,var(--accent) 8%,var(--surface))}</style>")

TPS = [
    ('tp-opnsense-installation', '1.1', 'Installation'),
    ('tp-opnsense-filtrage', '1.2', 'Filtrage des flux'),
    ('tp-opnsense-nat', '1.3', 'NAT'),
]


def hero(pill, titre, sous):
    return (f'<section class="hero"><span class="pill">{pill}</span><h1>{titre}</h1>'
            f'<p>{sous}</p></section>')


def cmd(t):
    return f'<div class="proc-cmd">{t}</div>'


def qr(q, a):
    return f'<p class="qr"><span class="q">{q}</span> <span class="a">{a}</span></p>'


def tab(entetes, lignes, classe='ref-table'):
    th = ''.join(f'<th>{h}</th>' for h in entetes)
    tr = ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in l) + '</tr>' for l in lignes)
    return f'<table class="{classe}"><tr>{th}</tr>{tr}</table>'


def fil_tp(slug_actuel):
    """Les trois TP en pastilles, celui qu'on lit mis en avant."""
    p = []
    for slug, num, libelle in TPS:
        n = f'<span class="ops-n">{num}</span>'
        if slug == slug_actuel:
            p.append(f'<span class="ops-v ops-ici">{n}{libelle}</span>')
        else:
            p.append(f'<a class="ops-v" href="/pages/{slug}">{n}{libelle}</a>')
    return ('<nav class="ops-serie" aria-label="Les TP OPNsense">'
            '<span class="ops-t">TP OPNsense</span>' + ''.join(p) + '</nav>')


# ═══════════════════════════════════════════════════ les schémas ══

# L'infrastructure des trois TP, telle que le schéma de l'énoncé la donne.
SVG_INFRA = (
    '<svg viewBox="0 0 560 260" role="img" aria-label="La maquette des TP : OPNsense entre le WAN, '
    'le LAN des postes et le LAN des serveurs" style="max-width:560px;width:100%;height:auto;'
    'margin:8px 0 12px;font-family:system-ui,sans-serif">'
    '<ellipse cx="280" cy="30" rx="48" ry="22" fill="#64748b"/>'
    '<text x="280" y="35" text-anchor="middle" font-size="12.5" fill="#fff" font-weight="bold">Internet</text>'
    '<line x1="280" y1="52" x2="280" y2="96" stroke="#94a3b8" stroke-width="2.5"/>'
    '<text x="290" y="70" font-size="10" fill="#64748b">WAN · réseau de la salle</text>'
    '<text x="290" y="84" font-size="10" fill="#64748b">hn0 · adresse .x (fixe)</text>'
    '<rect x="220" y="96" width="120" height="86" rx="10" fill="#dc2626"/>'
    '<text x="280" y="122" text-anchor="middle" font-size="13.5" fill="#fff" font-weight="bold">OPNsense</text>'
    '<text x="280" y="139" text-anchor="middle" font-size="10" fill="#fecaca">pare-feu · routeur</text>'
    '<text x="280" y="158" text-anchor="middle" font-size="10" fill="#fff">hn1 → LAN · hn2 → LAN_SRV</text>'
    '<text x="280" y="173" text-anchor="middle" font-size="10" fill="#fecaca">2 Go · 2 cœurs · 20 Go</text>'
    '<line x1="220" y1="140" x2="150" y2="140" stroke="#16a34a" stroke-width="2.5"/>'
    '<text x="200" y="133" text-anchor="middle" font-size="10" fill="#16a34a">.254</text>'
    '<rect x="20" y="112" width="130" height="56" rx="8" fill="#059669"/>'
    '<text x="85" y="133" text-anchor="middle" font-size="12" fill="#fff" font-weight="bold">LAN</text>'
    '<text x="85" y="148" text-anchor="middle" font-size="9.5" fill="#d1fae5">192.168.10.0/24</text>'
    '<text x="85" y="161" text-anchor="middle" font-size="9" fill="#d1fae5">COM Privée 1</text>'
    '<line x1="85" y1="168" x2="85" y2="196" stroke="#16a34a" stroke-width="2"/>'
    '<rect x="25" y="196" width="120" height="44" rx="8" fill="#0f766e"/>'
    '<text x="85" y="214" text-anchor="middle" font-size="11" fill="#fff" font-weight="bold">Poste Windows 10</text>'
    '<text x="85" y="229" text-anchor="middle" font-size="9.5" fill="#ccfbf1">adresse par DHCP</text>'
    '<line x1="340" y1="140" x2="410" y2="140" stroke="#f59e0b" stroke-width="2.5"/>'
    '<text x="360" y="133" text-anchor="middle" font-size="10" fill="#d97706">.254</text>'
    '<rect x="410" y="112" width="130" height="56" rx="8" fill="#d97706"/>'
    '<text x="475" y="133" text-anchor="middle" font-size="12" fill="#fff" font-weight="bold">LAN_SRV</text>'
    '<text x="475" y="148" text-anchor="middle" font-size="9.5" fill="#fef3c7">192.168.20.0/24</text>'
    '<text x="475" y="161" text-anchor="middle" font-size="9" fill="#fef3c7">COM Privée 2</text>'
    '<line x1="475" y1="168" x2="475" y2="196" stroke="#f59e0b" stroke-width="2"/>'
    '<rect x="415" y="196" width="120" height="44" rx="8" fill="#b45309"/>'
    '<text x="475" y="214" text-anchor="middle" font-size="11" fill="#fff" font-weight="bold">Serveur DNS / Web</text>'
    '<text x="475" y="229" text-anchor="middle" font-size="9.5" fill="#fef3c7">192.168.20.100</text>'
    '<text x="280" y="252" text-anchor="middle" font-size="10.5" fill="#64748b">'
    'Trois cartes, trois zones — tout ce qui passe de l’une à l’autre traverse les règles</text>'
    '</svg>')

# Le pare-feu entre ses trois zones, pour le cours de notions.
SVG_ZONES = (
    '<svg viewBox="0 0 460 250" role="img" aria-label="Le pare-feu placé entre Internet, le LAN et la DMZ" '
    'style="max-width:460px;width:100%;height:auto;margin:8px 0 12px;font-family:system-ui,sans-serif">'
    '<ellipse cx="55" cy="60" rx="48" ry="27" fill="#64748b"/>'
    '<text x="55" y="58" text-anchor="middle" font-size="12.5" fill="#fff" font-weight="bold">WAN</text>'
    '<text x="55" y="72" text-anchor="middle" font-size="9.5" fill="#e2e8f0">Internet</text>'
    '<line x1="103" y1="60" x2="165" y2="60" stroke="#94a3b8" stroke-width="2.5"/>'
    '<rect x="165" y="20" width="118" height="200" rx="10" fill="#dc2626"/>'
    '<text x="224" y="56" text-anchor="middle" font-size="13.5" fill="#fff" font-weight="bold">Pare-feu</text>'
    '<text x="224" y="74" text-anchor="middle" font-size="10" fill="#fecaca">règles · états · NAT</text>'
    '<rect x="181" y="96" width="86" height="24" rx="5" fill="#fff" fill-opacity=".16"/>'
    '<text x="224" y="112" text-anchor="middle" font-size="10.5" fill="#fff">WAN ⇄ LAN</text>'
    '<rect x="181" y="128" width="86" height="24" rx="5" fill="#fff" fill-opacity=".16"/>'
    '<text x="224" y="144" text-anchor="middle" font-size="10.5" fill="#fff">WAN ⇄ DMZ</text>'
    '<rect x="181" y="160" width="86" height="24" rx="5" fill="#fff" fill-opacity=".16"/>'
    '<text x="224" y="176" text-anchor="middle" font-size="10.5" fill="#fff">LAN ⇄ DMZ</text>'
    '<line x1="283" y1="120" x2="352" y2="120" stroke="#16a34a" stroke-width="2.5"/>'
    '<rect x="352" y="100" width="94" height="40" rx="8" fill="#059669"/>'
    '<text x="399" y="118" text-anchor="middle" font-size="12" fill="#fff" font-weight="bold">LAN</text>'
    '<text x="399" y="133" text-anchor="middle" font-size="9.5" fill="#d1fae5">postes, utilisateurs</text>'
    '<line x1="283" y1="190" x2="352" y2="190" stroke="#f59e0b" stroke-width="2.5"/>'
    '<rect x="352" y="170" width="94" height="40" rx="8" fill="#d97706"/>'
    '<text x="399" y="188" text-anchor="middle" font-size="12" fill="#fff" font-weight="bold">DMZ</text>'
    '<text x="399" y="203" text-anchor="middle" font-size="9.5" fill="#fef3c7">serveurs exposés</text>'
    '<text x="230" y="240" text-anchor="middle" font-size="10.5" fill="#64748b">'
    'Chaque flux qui change de zone est analysé et filtré — jamais de raccourci</text>'
    '</svg>')

# Le schéma d'origine de la page « Le pare-feu », conservé tel quel.
SVG_FILTRE = (
    '<svg viewBox="0 0 440 220" role="img" style="max-width:440px;width:100%;height:auto;margin:6px 0 12px;'
    'font-family:system-ui,sans-serif"><ellipse cx="60" cy="95" rx="50" ry="30" fill="#64748b"/>'
    '<text x="60" y="100" text-anchor="middle" font-size="13" fill="#fff" font-weight="bold">Internet</text>'
    '<line x1="110" y1="95" x2="175" y2="95" stroke="#94a3b8" stroke-width="2.5"/>'
    '<rect x="175" y="35" width="90" height="120" rx="8" fill="#dc2626"/>'
    '<text x="220" y="90" text-anchor="middle" font-size="13" fill="#fff" font-weight="bold">Pare-feu</text>'
    '<text x="220" y="108" text-anchor="middle" font-size="10" fill="#fee2e2">règles</text>'
    '<line x1="265" y1="70" x2="350" y2="70" stroke="#16a34a" stroke-width="2.5"/>'
    '<text x="358" y="74" font-size="12" fill="#16a34a">✔ autorisé</text>'
    '<line x1="265" y1="120" x2="330" y2="120" stroke="#dc2626" stroke-width="2.5" stroke-dasharray="5 4"/>'
    '<text x="338" y="124" font-size="12" fill="#dc2626">✘ bloqué</text>'
    '<rect x="350" y="150" width="80" height="40" rx="8" fill="#059669"/>'
    '<text x="390" y="174" text-anchor="middle" font-size="13" fill="#fff" font-weight="bold">LAN</text>'
    '<text x="220" y="208" text-anchor="middle" font-size="11" fill="#64748b">'
    'Chaque paquet est comparé aux règles : on laisse passer ou on jette</text></svg>')


# ═══════════════════════════════════ le cours : « Le pare-feu » ══

FONCTIONS_AVANCEES = [
    ('🔗', 'VPN site-à-site (IPsec)',
     'Relie deux réseaux distants — deux agences — par un tunnel chiffré au travers d’Internet. '
     'Les postes des deux côtés se voient comme sur un même réseau.'),
    ('🧳', 'VPN nomade (SSL / IPsec)',
     'Un utilisateur en déplacement monte un tunnel vers le pare-feu et retrouve les ressources '
     'internes, sans rien exposer sur Internet.'),
    ('🌐', 'Proxy / filtrage web',
     'Contrôle et filtre les accès à Internet : par URL, par catégorie de site, par contenu. '
     'C’est aussi ce qui permet d’avoir un journal de la navigation.'),
    ('🛡️', 'IDS / IPS',
     'Détection (IDS) puis blocage (IPS) des intrusions : le trafic est comparé à des signatures '
     'd’attaques connues, pas seulement à des adresses et des ports.'),
    ('🧩', 'Filtrage applicatif (couche 7)',
     'Le pare-feu reconnaît l’application dans le flux — HTTP, DNS, un client de messagerie… — et '
     'peut l’autoriser ou la refuser même quand elle change de port.'),
    ('📜', 'Journalisation',
     'Chaque décision peut être enregistrée. Sans journaux, un pare-feu est une boîte noire : on '
     'ne sait ni ce qu’il a laissé passer, ni ce qu’il a arrêté.'),
]


def cartes_fonctions():
    c = ''.join(
        f'<div style="border:1px solid var(--border);border-radius:10px;padding:11px 13px;'
        f'background:var(--surface)"><div style="font-weight:700;font-size:13.5px">'
        f'<span style="font-size:18px;margin-right:6px">{ico}</span>{t}</div>'
        f'<p style="margin:5px 0 0;font-size:13px;color:var(--text-soft)">{d}</p></div>'
        for ico, t, d in FONCTIONS_AVANCEES)
    return ('<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));'
            f'gap:10px;margin:10px 0 14px">{c}</div>')


PARE_FEU = '\n'.join([
    hero('Cours · Réseau', 'Le pare-feu',
         'Le « vigile » du réseau : il filtre ce qui entre et ce qui sort selon des règles, et '
         'décide ce qui a le droit de passer d’une zone à l’autre.'),
    STYLE_COURS,

    '<h2>1) Qu’est-ce qu’un pare-feu ?</h2>',
    '<p>Un <strong>pare-feu</strong> (<em>firewall</em>) est un équipement de sécurité réseau — un '
    'boîtier, une machine virtuelle ou un logiciel — qui <strong>contrôle le trafic</strong>. Il '
    'examine chaque paquet qui veut entrer ou sortir et décide, selon des <strong>règles</strong>, '
    'de le <strong>laisser passer</strong> ou de le <strong>bloquer</strong>.</p>',
    note('blue', '🔎 Analogie',
         'C’est le <strong>videur à l’entrée d’une boîte de nuit</strong> avec une liste. Il regarde '
         'chaque personne (paquet) : « Tu es sur la liste ? Entre. Sinon, refusé. » Le pare-feu '
         'applique cette même logique au trafic réseau, en continu et à grande vitesse.'),
    '<p>Derrière ce principe simple, un pare-feu d’entreprise tient plusieurs rôles à la fois :</p>',
    '<ul class="proc-steps">'
    '<li>Il <strong>filtre</strong> les communications entrantes et sortantes.</li>'
    '<li>Il <strong>applique une politique de sécurité</strong> (<em>policy</em>) : ce qui est '
    'permis, ce qui ne l’est pas.</li>'
    '<li>Il <strong>contrôle les flux entre les zones</strong> du réseau — LAN, WAN, DMZ.</li>'
    '<li>Il <strong>regroupe plusieurs fonctions</strong> : proxy, VPN, détection d’intrusion…</li>'
    '<li>Il <strong>route</strong> : placé entre les réseaux, c’est lui qui fait passer les paquets '
    'de l’un à l’autre — ou pas.</li>'
    '</ul>',
    SVG_FILTRE,

    '<h2>2) Pourquoi en déployer un ?</h2>',
    '<p>Parce qu’un réseau sans pare-feu est un réseau où <strong>tout le monde parle à tout le '
    'monde</strong> — y compris Internet aux serveurs internes. Le pare-feu sécurise le réseau en '
    'contrôlant les communications entre ses zones :</p>',
    tab(['Ce qu’il fait', 'Ce que ça évite'], [
        ['<strong>Filtrer</strong> les flux entrants et sortants',
         'Un service interne joignable depuis Internet sans qu’on l’ait décidé'],
        ['<strong>Bloquer</strong> les accès non autorisés',
         'Un poste qui atteint un serveur qu’il n’a pas à connaître'],
        ['<strong>Appliquer</strong> des règles de sécurité écrites',
         'Une politique qui n’existe que dans la tête de l’admin'],
        ['<strong>Segmenter</strong> le réseau (LAN, WAN, DMZ)',
         'Un serveur exposé qui donne accès à tout le réseau interne'],
        ['<strong>Limiter la propagation</strong> d’une attaque',
         'Un poste compromis qui contamine tous les autres'],
    ], 'lx-tab'),
    '<p>Au total : il <strong>réduit le risque de compromission</strong> du système d’information. '
    'Pas à zéro — mais un attaquant qui passe une zone se heurte à la suivante.</p>',

    '<h2>3) Où il se place : les zones</h2>',
    '<p>Un pare-feu ne protège pas « le réseau » en général : il se place <strong>entre des '
    'zones</strong>, et contrôle ce qui passe de l’une à l’autre.</p>',
    SVG_ZONES,
    tab(['Zone', 'Ce qu’on y trouve', 'Niveau de confiance'], [
        ['<strong>LAN</strong>', 'Le réseau interne : postes des utilisateurs, imprimantes, '
         'serveurs internes.', 'Élevé — mais pas absolu'],
        ['<strong>WAN</strong>', 'Le réseau externe : Internet, ou tout réseau qu’on ne '
         'contrôle pas.', 'Nul — rien n’y est fiable'],
        ['<strong>DMZ</strong>', 'La zone intermédiaire : les serveurs qu’on expose (web, '
         'messagerie…), isolés du LAN.', 'Faible — exposé, donc suspect'],
    ], 'lx-tab'),
    note('yellow', '⚠️ La DMZ est la réponse à une question précise',
         '« Comment publier un serveur web sans donner accès au LAN si ce serveur est piraté ? » '
         'En le mettant dans une zone à part, d’où il ne peut <strong>pas</strong> initier de '
         'connexion vers le LAN. Un serveur exposé posé dans le LAN, c’est une porte ouverte sur '
         'tout le reste.'),

    '<h2>4) Les règles de filtrage</h2>',
    '<p>Une règle dit <strong>quel flux</strong> est concerné et <strong>ce qu’on en fait</strong> : '
    '<strong>autoriser</strong> (<em>allow / pass</em>) ou <strong>bloquer</strong> '
    '(<em>block / deny</em>). Le flux est décrit par :</p>',
    '<ul class="proc-steps">'
    '<li>l’<strong>adresse IP</strong> source et destination — qui parle à qui ;</li>'
    '<li>le <strong>port</strong> source et destination — quel service : 80 le web, 443 le web '
    'chiffré, 22 SSH, 53 le DNS, 25 la messagerie… ;</li>'
    '<li>le <strong>protocole</strong> — TCP, UDP, ICMP (le ping).</li>'
    '</ul>',
    tab(['#', 'Action', 'Source', 'Destination', 'Port', 'Ce que ça dit'], [
        ['1', '✔ Autoriser', 'LAN', 'Serveur web (DMZ)', '443/TCP', 'Les postes consultent l’intranet'],
        ['2', '✔ Autoriser', 'LAN', 'Internet', '80, 443/TCP', 'Les postes naviguent'],
        ['3', '✘ Bloquer', 'DMZ', 'LAN', 'tous', 'Un serveur exposé ne remonte jamais vers les postes'],
        ['—', '✘ Bloquer', 'tout', 'tout', 'tous', 'La politique par défaut, implicite'],
    ], 'lx-tab'),
    '<p>Trois principes commandent la lecture de cette liste, et le troisième est celui qui fait '
    'perdre le plus de temps :</p>',
    '<ol class="proc-steps">'
    '<li>Les règles sont traitées <strong>dans un ordre précis</strong>, de haut en bas.</li>'
    '<li><strong>La première règle qui correspond s’applique</strong> — les suivantes ne sont même '
    'pas lues. Une règle « bloquer » placée au-dessus d’une règle « autoriser » gagne.</li>'
    '<li>Si <strong>aucune règle ne correspond</strong>, c’est la <strong>politique par '
    'défaut</strong> qui décide — et le bon réflexe est <em>deny all</em> : tout ce qui n’est pas '
    'explicitement autorisé est refusé.</li>'
    '</ol>',
    note('gray', '📋 Un mot sur « ACL »',
         'L’ensemble des règles forme une <strong>politique de filtrage</strong>. Sur un routeur '
         'Cisco, on parle de liste de contrôle d’accès — <a href="/pages/cisco-acl">les ACL</a> — '
         'avec exactement la même logique : ordonnée, première correspondance, refus implicite à la '
         'fin.'),

    '<h2>5) Avec ou sans état : <em>stateful</em> et <em>stateless</em></h2>',
    '<p>Deux façons de filtrer, et elles ne voient pas la même chose.</p>',
    tab(['', 'Stateless (sans état)', 'Stateful (à états)'], [
        ['Ce qu’il regarde', 'Chaque paquet <strong>indépendamment</strong>',
         'La <strong>connexion</strong> à laquelle le paquet appartient'],
        ['Sur quoi il décide', 'IP, port, protocole — et rien d’autre',
         'Les mêmes critères, plus une <strong>table des sessions</strong> ouvertes'],
        ['La réponse à une requête', 'Il faut une règle pour l’aller <strong>et une pour le retour</strong>',
         'Le retour est <strong>autorisé automatiquement</strong> : la connexion est connue'],
        ['Une connexion entrante non sollicitée', 'Passe si une règle « retour » trop large existe',
         'Refusée : aucune session ne lui correspond'],
        ['Performance / sécurité', 'Rapide, peu sûr', 'Plus intelligent, plus sûr'],
        ['Aujourd’hui', 'Cas particuliers (filtrage très simple, très haut débit)',
         '<strong>Le standard</strong> de tous les pare-feu modernes'],
    ], 'lx-tab'),
    note('blue', '🧠 Ce que « à états » change concrètement',
         'Si <strong>toi</strong> as demandé une page web, le pare-feu a mémorisé la connexion et '
         'laisse revenir la réponse. Tu n’écris jamais la règle du retour — c’est même le signe '
         'qu’on a mal compris quand on essaie. À l’inverse, un paquet qui arrive d’Internet sans '
         'qu’aucune connexion ne l’attende est jeté, même s’il vise un port ouvert vers l’intérieur.'),

    '<h2>6) Les journaux</h2>',
    '<p>Un pare-feu qui ne journalise pas est une boîte noire. Les <strong>logs</strong> permettent '
    'de tracer et d’analyser son activité :</p>',
    '<ul class="proc-steps">'
    '<li>l’enregistrement des connexions, <strong>autorisées comme bloquées</strong> ;</li>'
    '<li>le suivi de <strong>quelle règle</strong> s’est appliquée à quel flux ;</li>'
    '<li>l’identification des anomalies et des <strong>tentatives d’intrusion</strong> ;</li>'
    '<li>le diagnostic réseau (« pourquoi ça ne passe pas ? »), l’analyse de sécurité, '
    'l’<strong>audit</strong> et la conformité.</li>'
    '</ul>',
    '<p>Ils doivent être <strong>conservés selon une politique définie</strong> — combien de temps, '
    'où, qui y accède — et de préférence envoyés vers un serveur de journaux distinct : un attaquant '
    'qui prend la main sur le pare-feu efface d’abord les traces locales.</p>',
    note('gray', '🔍 Le premier réflexe quand « ça ne marche pas »',
         'Lire le journal du pare-feu, filtré sur l’adresse du poste qui se plaint. La ligne rouge '
         'donne la règle qui a bloqué — ou l’absence de règle. C’est plus rapide que de relire toute '
         'la politique.'),

    '<h2>7) NAT et PAT</h2>',
    '<p>Le pare-feu est aussi l’endroit où les <strong>adresses changent</strong>. Le '
    '<strong>NAT</strong> (<em>Network Address Translation</em>) modifie les adresses IP des paquets '
    'qui le traversent :</p>',
    tab(['', 'NAT', 'PAT'], [
        ['Ce qui est traduit', 'L’<strong>adresse IP</strong>', 'L’adresse IP <strong>et le port</strong>'],
        ['Ce que ça permet', 'Masquer le réseau interne derrière une autre adresse',
         'Faire partager <strong>une seule adresse publique</strong> à toutes les machines internes'],
        ['Où on le rencontre', 'La traduction 1:1 d’un serveur',
         'La sortie vers Internet de tout un LAN, et la <strong>redirection de port</strong>'],
    ], 'lx-tab'),
    '<p>Trois usages reviennent tout le temps :</p>',
    '<ul class="proc-steps">'
    '<li><strong>L’accès Internet des postes internes</strong> — ils sortent tous avec l’adresse '
    'publique du pare-feu (PAT sortant).</li>'
    '<li><strong>La publication d’un service interne</strong> — un serveur web en adresse privée '
    'devient joignable depuis l’extérieur.</li>'
    '<li><strong>La redirection de port</strong> (<em>port forwarding</em>) — « ce qui arrive sur '
    'mon port 443 va au serveur 192.168.20.100 ».</li>'
    '</ul>',
    note('yellow', '⚠️ NAT et filtrage sont deux choses',
         'Une redirection de port dit <em>où</em> envoyer le paquet ; elle ne dit pas qu’il a le '
         'droit d’entrer. Il faut <strong>aussi</strong> une règle de filtrage qui l’autorise sur '
         'l’interface WAN. Le détail, avec les commandes : <a href="/pages/cisco-nat">NAT / PAT</a>, '
         'et sur un vrai pare-feu : <a href="/pages/opnsense-nat">OPNsense — le NAT et les '
         'redirections de port</a>.'),

    '<h2>8) Les fonctions avancées</h2>',
    '<p>Un pare-feu moderne ne se limite plus à comparer des adresses et des ports. Il intègre '
    'plusieurs fonctions de sécurité, qui partagent son point de passage obligé :</p>',
    cartes_fonctions(),
    acc(
        ('🛡️ Où le trouve-t-on ?',
         '<p>Sur ta <strong>box</strong> (basique), dans <strong>Windows</strong> (« Pare-feu '
         'Windows Defender »), sur des <strong>boîtiers dédiés</strong> en entreprise (Stormshield, '
         'Fortinet, Palo Alto) ou des distributions libres qu’on installe soi-même '
         '(<a href="/pages/opnsense">OPNsense</a>, pfSense). On parle de <strong>NGFW</strong> '
         '(<em>Next-Generation Firewall</em>) dès qu’il inspecte aussi le contenu : antivirus, '
         'filtrage applicatif, IPS.</p>'),
        ('🧱 Matériel ou virtuel ?',
         '<p>Le <strong>boîtier physique</strong> est performant et protège tout le réseau depuis un '
         'seul point — le poste de garde à l’entrée du bâtiment. Le <strong>pare-feu virtuel</strong> '
         'rend le même service sous forme de machine virtuelle : souple, rapide à déployer, à '
         'dupliquer, idéal en environnement virtualisé ou cloud. Les TP de ce parcours utilisent la '
         'seconde forme.</p>'),
    ),

    '<h2>9) Les bonnes pratiques</h2>',
    '<p>Un pare-feu doit appliquer des règles <strong>simples et strictes</strong> :</p>',
    '<ul class="proc-steps">'
    '<li><strong>Tout bloquer par défaut</strong> (<em>deny all</em>), puis ouvrir.</li>'
    '<li>N’autoriser <strong>que les flux nécessaires</strong> — pas « tout le LAN vers tout », '
    'mais « ces postes vers ce serveur sur ce port ».</li>'
    '<li>Appliquer le <strong>principe du moindre privilège</strong> : chaque zone, chaque machine '
    'n’a que les droits dont elle a besoin.</li>'
    '<li><strong>Justifier chaque ouverture</strong> de flux, et l’écrire dans la description de la '
    'règle : dans six mois, personne ne saura plus pourquoi le port 8443 est ouvert.</li>'
    '<li>Réduire au maximum la <strong>surface d’exposition</strong> : chaque service publié est '
    'une cible.</li>'
    '</ul>',
    '<p>L’objectif n’est pas d’empêcher le réseau de fonctionner mais de <strong>limiter le risque '
    'en contrôlant les flux</strong>. Et un pare-feu seul ne suffit pas : il s’intègre dans une '
    '<strong>stratégie globale</strong> de sécurité — mises à jour, comptes, sauvegardes, '
    'supervision.</p>',

    '<h2>Exemples concrets</h2>',
    '<ul><li>🚫 Bloquer l’accès à certains sites depuis le réseau d’une entreprise.</li>'
    '<li>🔒 Empêcher Internet d’atteindre directement un serveur interne : seul le port utile est '
    'ouvert, et vers une DMZ.</li>'
    '<li>🧱 Isoler le réseau « invités » du réseau « administration ».</li>'
    '<li>📜 Retrouver, dans les journaux, quel poste a tenté de joindre un serveur interdit à 3 h '
    'du matin.</li></ul>',

    note('green', '💡 À retenir',
         'Pare-feu = il <strong>filtre le trafic entre des zones</strong> selon des '
         '<strong>règles</strong> ordonnées (source, destination, port, protocole), lues de haut en '
         'bas, la première qui correspond décide, et <strong>tout est bloqué par défaut</strong>. Il '
         'est <strong>à états</strong> : la réponse à une connexion sortante revient sans règle. Il '
         'fait aussi le <strong>NAT</strong>, journalise, et porte souvent VPN, proxy et IDS. '
         'Vocabulaire dans le <a href="/glossaire">Glossaire</a> ; pour se tester : '
         '<a href="/pages/quiz-le-pare-feu">le quiz</a>.'),
    note('green', '🎓 Passer à la pratique',
         'Sur un poste : <a href="/pages/procedure-pare-feu-windows"><strong>Créer une règle de '
         'pare-feu Windows</strong></a>. Sur un vrai pare-feu : le cours '
         '<a href="/pages/opnsense"><strong>OPNsense</strong></a> en cinq volets, et les trois TP '
         'corrigés — <a href="/pages/tp-opnsense-installation">1.1 Installation</a>, '
         '<a href="/pages/tp-opnsense-filtrage">1.2 Filtrage des flux</a>, '
         '<a href="/pages/tp-opnsense-nat">1.3 NAT</a>.'),
])

PARE_FEU_EXTRAIT = ('Le pare-feu (firewall) : filtrer le trafic entre les zones du réseau selon des règles '
                    'ordonnées, avec ou sans état, journaux, NAT/PAT, fonctions avancées et bonnes pratiques.')
PARE_FEU_DESCRIPTION = ('Rôles et zones (LAN, WAN, DMZ), règles lues de haut en bas, stateful vs stateless, '
                        'journaux, NAT/PAT, fonctions avancées et bonnes pratiques.')


# ══════════════════════════════════════════ TP 1.1 : installation ══

def le_tp(texte_objectifs, liens_cours):
    return note('blue', '🎯 Le TP',
                texte_objectifs,
                f'Cours à lire à côté : {liens_cours}.')


TP11 = '\n'.join([
    hero('TP · corrigé · Réseau', 'TP OPNsense 1.1 — Installation (corrigé)',
         'Installer OPNsense dans une VM à trois cartes, assigner WAN, LAN et LAN_SRV, donner leurs '
         'adresses aux interfaces et prendre l’interface web en main.'),
    STYLE_TP,
    fil_tp('tp-opnsense-installation'),
    le_tp('Installer un pare-feu OPNsense en environnement virtualisé, comprendre le rôle des '
          'interfaces (WAN, LAN), leur donner des adresses fixes, accéder à l’interface '
          'd’administration et faire les premiers gestes d’administration.',
          '<a href="/pages/opnsense">OPNsense — volet 1, découverte</a> et '
          '<a href="/pages/le-pare-feu">Le pare-feu</a> (le concept)'),
    '<h2>L’infrastructure</h2>',
    SVG_INFRA,
    tab(['Interface OPNsense', 'Carte Hyper-V', 'Commutateur virtuel', 'Réseau', 'Adresse du pare-feu'], [
        ['<strong>WAN</strong>', 'hn0', 'COM Externe', 'Le réseau de la salle', '<code>.x</code> — une adresse libre de la salle'],
        ['<strong>LAN</strong>', 'hn1', 'COM Privée 1', '<code>192.168.10.0/24</code> — les postes', '<code>192.168.10.254</code>'],
        ['<strong>LAN_SRV</strong> (OPT1)', 'hn2', 'COM Privée 2', '<code>192.168.20.0/24</code> — les serveurs', '<code>192.168.20.254</code>'],
    ]),
    '<p>Le poste Windows 10 prend son adresse par DHCP — mais le DHCP n’arrive qu’au TP 1.2, ce qui '
    'a une conséquence au ⑤. Le serveur DNS/Web est en <code>192.168.20.100</code>.</p>',

    '<h2>① La machine virtuelle</h2>',
    tab(['Réglage', 'Valeur'], [
        ['Mémoire', '2048 Mo'], ['Processeurs', '2 cœurs'], ['Disque', '20 Go'],
        ['Cartes réseau', '<strong>3</strong> — WAN (COM Externe), LAN-SRV (COM Privée 2), LAN-CLIENT (COM Privée 1)'],
        ['Génération', '1 — la 2 demande de désactiver le démarrage sécurisé, sinon l’ISO refuse de s’amorcer'],
    ]),
    note('yellow', '⚠️ L’ordre des cartes compte — mais pas comme on croit',
         'L’énoncé prévient que l’ordre des cartes dans la VM aura son importance. FreeBSD les '
         'nomme <code>hn0</code>, <code>hn1</code>, <code>hn2</code> dans l’ordre où Hyper-V les '
         'présente. Mais le seul lien <strong>fiable</strong> entre une carte et son commutateur est '
         'son <strong>adresse MAC</strong> : Hyper-V l’affiche dans les paramètres de la carte, la '
         'console d’OPNsense l’affiche à côté du nom. C’est elle qu’on compare au ③, pas la '
         'position. Voir <a href="/pages/procedure-vm-hyperv">Créer une VM sur Hyper-V</a>.'),

    '<h2>② L’installation</h2>',
    '<p>La VM démarre sur un système vivant : rien n’est encore écrit sur le disque. On laisse la '
    'préconfiguration se terminer, puis on se connecte avec le compte réservé à l’installation.</p>',
    cmd('login: installer\npassword: opnsense'),
    tab(['Écran', 'Réponse', 'Pourquoi'], [
        ['Keymap', 'Sélectionner <code>fr.kbd</code> avec Espace, tester si on veut, puis '
         '<em>Continue with fr.kbd keymap</em>',
         'Sans ça, le mot de passe root sera tapé en QWERTY sans qu’on le voie'],
        ['Mode d’installation', '<strong>Install (ZFS)</strong>',
         'L’énoncé le demande ; ZFS apporte instantanés et sommes de contrôle'],
        ['Avertissement mémoire', 'Ignorer et continuer', 'ZFS aime la RAM ; 2 Go suffisent pour une maquette'],
        ['ZFS configuration', '<strong>stripe</strong> — pas de RAID', 'Un seul disque, rien à répliquer'],
        ['Disque', 'Le seul de la VM (<code>da0</code>)', 'Cocher avec Espace, puis OK'],
        ['« Toutes les données seront perdues »', 'YES', 'Le disque est vide, c’est attendu'],
        ['Mot de passe root', 'Le changer <strong>maintenant</strong>', 'Le mot de passe d’usine est connu de tous'],
        ['Menu final', '<strong>Complete install</strong>, puis redémarrer', 'Retirer l’ISO du lecteur avant, sinon on repart sur le système vivant'],
    ]),
    '<p>Après le redémarrage, la console propose un menu numéroté. On se connecte en '
    '<code>root</code> avec le mot de passe choisi.</p>',

    '<h2>③ Assigner les interfaces</h2>',
    '<p>C’est l’étape qui décide de tout le reste : dire quelle carte est le WAN, laquelle est le '
    'LAN, laquelle est la troisième. Au menu de la console, l’option <strong>1) Assign '
    'interfaces</strong>.</p>',
    cmd('Do you want to configure LAGGs now? [y/N]: n\n'
        'Do you want to configure VLANs now? [y/N]: n\n\n'
        'Valid interfaces are:\n'
        'hn0   00:15:5d:0a:11:01   Hyper-V Network Interface\n'
        'hn1   00:15:5d:0a:11:02   Hyper-V Network Interface\n'
        'hn2   00:15:5d:0a:11:03   Hyper-V Network Interface\n\n'
        'Enter the WAN interface name or \'a\' for auto-detection: hn0\n'
        'Enter the LAN interface name or \'a\' for auto-detection: hn1\n'
        'Enter the Optional 1 interface name (or nothing if finished): hn2\n'
        'Enter the Optional 2 interface name (or nothing if finished): &lt;Entrée&gt;\n\n'
        'The interfaces will be assigned as follows:\n'
        'WAN  -> hn0\nLAN  -> hn1\nOPT1 -> hn2\n\n'
        'Do you want to proceed? [y/N]: y'),
    qr('Quelle carte devient « LAN » ?',
       '<strong>Celle des postes clients</strong> (COM Privée 1, 192.168.10.0/24). Ce n’est pas un '
       'détail : OPNsense pose sur l’interface qu’il appelle LAN deux règles qu’il ne pose nulle part '
       'ailleurs — l’<strong>anti-lockout</strong>, qui garantit l’accès à l’interface web, et '
       '<strong>Default allow LAN to any</strong>. En donnant ce rôle au réseau des postes, on peut '
       'administrer le pare-feu depuis le Windows 10 dès la fin de ce TP. Le réseau des serveurs '
       'devient <strong>OPT1</strong>, sans aucune règle — et c’est exactement ce que le TP 1.2 fera '
       'observer.'),
    qr('Comment être sûr que hn0 est bien la carte du commutateur externe ?',
       'Par la MAC. Dans Hyper-V : paramètres de la VM › la carte reliée à <em>COM Externe</em> › '
       'Fonctionnalités avancées › adresse MAC. Si elle correspond à <code>hn1</code> et non à '
       '<code>hn0</code>, on répond <code>hn1</code> à la question du WAN : la position n’a aucune '
       'importance, seule la correspondance compte.'),

    '<h2>④ Les adresses des interfaces</h2>',
    '<p>Option <strong>2) Set interface IP address</strong>, puis le numéro de l’interface. On '
    'commence par le WAN, en s’appuyant sur le schéma : une adresse libre du réseau de la salle, '
    'dont la passerelle est le routeur de la salle.</p>',
    tab(['Question de l’assistant', 'WAN', 'LAN', 'OPT1 (LAN_SRV)'], [
        ['Configure IPv4 address WAN interface via DHCP?', '<code>n</code>', '<code>n</code>', '<code>n</code>'],
        ['Enter the new IPv4 address', 'l’adresse <code>.x</code> de la salle <em>(ex. 172.16.0.50)</em>',
         '<code>192.168.10.254</code>', '<code>192.168.20.254</code>'],
        ['Subnet bit count (CIDR)', '<code>24</code> <em>(celui de la salle)</em>', '<code>24</code>', '<code>24</code>'],
        ['Upstream gateway address', 'le routeur de la salle <em>(ex. 172.16.0.1)</em>',
         '<strong>vide</strong> — Entrée', '<strong>vide</strong> — Entrée'],
        ['Use this gateway as the DNS server?', '<code>n</code>', '—', '—'],
        ['Enter the new DNS server', 'le DNS de la salle, ou <code>1.1.1.1</code>', '—', '—'],
        ['Configure IPv6 via WAN tracking / DHCP6?', '<code>n</code>', '<code>n</code>', '<code>n</code>'],
        ['Enter the new IPv6 address', '<strong>vide</strong> — Entrée', 'vide', 'vide'],
        ['Enable the DHCP server on this interface?', '—', '<code>n</code> — voir ci-dessous', '<code>n</code>'],
        ['Revert to HTTP as the web GUI protocol?', '<code>n</code> — on reste en HTTPS', '<code>n</code>', '<code>n</code>'],
        ['Generate a new self-signed web GUI certificate?', '<code>y</code>', '—', '—'],
        ['Restore web GUI access defaults?', '<code>n</code>', '—', '—'],
    ]),
    qr('Pourquoi une passerelle sur le WAN et aucune sur les LAN ?',
       'La passerelle d’une interface, c’est « par où sortir quand la destination n’est pas un '
       'réseau que je connais ». Le pare-feu <strong>est</strong> la passerelle des deux LAN ; lui '
       'n’a besoin d’une route par défaut que d’un seul côté, vers Internet. Mettre une passerelle '
       'sur le LAN transforme OPNsense en « multi-WAN » sans qu’on l’ait voulu.'),
    qr('Et le DHCP sur le LAN, puisque le poste Windows est en DHCP ?',
       'On répond <code>n</code> ici : le TP 1.2 demande de <strong>configurer le service DHCP dans '
       'l’interface web</strong>, et c’est là qu’on le fera proprement. Le temps de ce TP, le poste '
       'Windows reçoit une adresse fixe provisoire (⑤).'),
    note('gray', '💡 Le certificat auto-signé',
         'OPNsense génère lui-même le certificat de son interface web : personne ne l’a signé, le '
         'navigateur protestera à la première connexion. On passe outre — c’est le même phénomène '
         'que pour un site en HTTPS auto-signé, vu avec <a href="/pages/tp-apache-recherche">Apache</a>.'),

    '<h2>⑤ Le premier accès à l’interface web</h2>',
    '<p>Sur le poste Windows 10 — une seule carte, sur COM Privée 1, <strong>pas d’autre accès '
    'à Internet</strong> — une adresse fixe provisoire : <code>192.168.10.50/24</code>, passerelle '
    '<code>192.168.10.254</code>, DNS <code>192.168.20.100</code> (voir '
    '<a href="/pages/procedure-ip-fixe-windows">Configurer une IP fixe</a>). Puis, dans un '
    'navigateur :</p>',
    cmd('https://192.168.10.254\nlogin : root\nmot de passe : celui de l’installation'),
    '<p>L’assistant de configuration se lance (<span class="lx-nav">System › Wizard</span> pour le '
    'rejouer) : nom de la machine, domaine <code>macao.city</code>, serveurs DNS, fuseau horaire, '
    'confirmation du WAN et du LAN. Tout est modifiable ensuite.</p>',
    qr('Pourquoi ça marche depuis le LAN et pas depuis LAN_SRV ?',
       'À cause des deux règles de l’interface LAN évoquées au ③. Sur OPT1, rien n’autorise quoi que '
       'ce soit : depuis le serveur, <code>https://192.168.20.254</code> ne répond pas — ce n’est pas '
       'une panne, c’est le refus implicite. Le TP 1.2 commence précisément par ce constat.'),
    '<p>Dernier geste avant la prise en main : donner son nom à la troisième interface, pour ne '
    'plus lire « OPT1 » partout. <span class="lx-nav">Interfaces › [OPT1]</span> : cocher '
    '<em>Enable Interface</em>, description <code>LAN_SRV</code>, <em>Save</em> puis '
    '<em>Apply changes</em>. Les onglets de <span class="lx-nav">Firewall › Rules</span> reprennent '
    'aussitôt ce nom.</p>',

    '<h2>⑥ La prise en main</h2>',
    '<p>Huit recherches, à faire avec la '
    '<a href="https://docs.opnsense.org/" target="_blank" rel="noopener">documentation officielle</a>. '
    'Les chemins ci-dessous sont ceux de l’interface en anglais — après la première tâche, ils '
    'seront en français.</p>',
    qr('Mettre la langue en français',
       '<span class="lx-nav">System › Settings › General</span> › <em>Language</em> : '
       '<code>French</code>, puis <em>Save</em>. Toute l’interface bascule. La documentation, elle, '
       'reste en anglais : garder les deux noms en tête évite de s’y perdre.'),
    qr('Créer un utilisateur « prénom » avec les droits administrateur',
       '<span class="lx-nav">System › Access › Users</span> › <strong>+</strong>. Nom, mot de passe, '
       'et dans <em>Group Memberships</em> : ajouter le groupe <code>admins</code> — c’est ce groupe '
       'qui porte le privilège <em>All pages</em>. Se déconnecter, se reconnecter avec ce compte, '
       'et ne plus utiliser <code>root</code> au quotidien.'),
    qr('Changer le port de l’interface en 22443',
       '<span class="lx-nav">System › Settings › Administration</span> › <em>TCP port</em> : '
       '<code>22443</code>, <em>Save</em>. L’adresse devient '
       '<code>https://192.168.10.254:22443</code>. La règle anti-lockout suit automatiquement le '
       'nouveau port — c’est pour ça qu’on ne se retrouve pas dehors.'),
    qr('Passer l’interface en thème sombre',
       'Les thèmes sombres sont des greffons : <span class="lx-nav">System › Firmware › '
       'Plugins</span>, installer <code>os-theme-vicuna</code> (ou <code>os-theme-cicada</code>), '
       'puis <span class="lx-nav">System › Settings › General</span> › <em>Theme</em>. L’installation '
       'demande d’avoir d’abord fait une mise à jour du dépôt — le bouton <em>Check for updates</em> '
       'de l’onglet <em>Status</em>.'),
    qr('Lister les services disponibles et leur rôle',
       '<span class="lx-nav">System › Diagnostics › Services</span> les montre tous, avec leur '
       'état. Les principaux : <strong>Unbound DNS</strong> (résolveur), <strong>DHCPv4 / '
       'DHCPv6</strong> (ISC, ou Kea sur les versions récentes — attribuer des adresses), '
       '<strong>NTP</strong> (l’heure, indispensable aux journaux et aux certificats), '
       '<strong>OpenSSH</strong> (console à distance), <strong>Syslog-ng</strong> (journaux, locaux '
       'ou envoyés ailleurs), <strong>Web GUI</strong> (l’interface elle-même), '
       '<strong>Cron</strong> (tâches planifiées), <strong>Monit</strong> (supervision), '
       '<strong>Intrusion Detection</strong> (Suricata), <strong>OpenVPN / IPsec / '
       'WireGuard</strong> (accès distants), <strong>Captive Portal</strong> (portail d’accueil '
       'Wi-Fi), <strong>Router Advertisements</strong> (IPv6). Le proxy web, lui, est un greffon '
       '(TP 1.2).'),
    qr('Afficher les journaux en temps réel sur le tableau de bord',
       '<span class="lx-nav">Lobby › Dashboard</span> › <em>Add widget</em> › '
       '<strong>Firewall Log</strong> (ou <em>Firewall</em> selon la version), puis <em>Save</em>. '
       'Le bloc défile en direct, ligne verte pour un passage, rouge pour un blocage. Il montre '
       'exactement ce que le TP 1.2 demandera de capturer.'),
    qr('Configurer le pare-feu pour accéder à l’administration depuis le LAN',
       'C’est déjà le cas grâce à l’anti-lockout — mais elle disparaîtra au TP 1.2 avec les règles '
       'par défaut. La règle explicite, sur l’onglet <span class="lx-nav">Firewall › Rules › LAN</span> : '
       '<em>Pass</em>, protocole <code>TCP</code>, source <code>LAN net</code>, destination '
       '<code>This Firewall</code>, port <code>22443</code>, description « Admin web depuis le LAN ». '
       'Elle reste valable même si l’anti-lockout est un jour désactivée.'),
    qr('Faire une sauvegarde de la configuration',
       '<span class="lx-nav">System › Configuration › Backups</span> › <em>Download '
       'configuration</em>. Un seul fichier XML contient tout le pare-feu — le restaurer sur une VM '
       'neuve le reconstitue à l’identique. Le réflexe pour la suite : exporter <strong>avant</strong> '
       'chaque TP, on pourra revenir en arrière en un clic.'),

    note('green', '✅ Ce qu’on a en fin de TP',
         'Un OPNsense à trois interfaces nommées, adressées, administré depuis le poste Windows sur '
         'le port 22443 par un compte nommé, et une sauvegarde de cet état. '
         'La suite : <a href="/pages/tp-opnsense-filtrage"><strong>TP 1.2 — Filtrage des '
         'flux</strong></a>, qui commence par retirer les règles par défaut.'),
])


# ═══════════════════════════════════════ TP 1.2 : filtrage des flux ══

TP12 = '\n'.join([
    hero('TP · corrigé · Réseau', 'TP OPNsense 1.2 — Filtrage des flux (corrigé)',
         'Observer ce qu’un pare-feu fait sans règle, écrire les règles qui autorisent le ping, le '
         'web et le DNS, vérifier l’ordre d’évaluation, puis ajouter le DHCP et un greffon.'),
    STYLE_TP,
    fil_tp('tp-opnsense-filtrage'),
    le_tp('Comprendre le filtrage réseau et le comportement par défaut d’un pare-feu, créer et '
          'ordonner des règles, autoriser ou bloquer des flux par IP, port et protocole, et '
          'exploiter les journaux.',
          '<a href="/pages/le-pare-feu">Le pare-feu</a> (règles, états, journaux), '
          '<a href="/pages/opnsense">OPNsense — volet 1</a> (comment il lit ses règles) et '
          '<a href="/pages/opnsense-services">volet 3</a> (DHCP et DNS)'),
    note('gray', '📚 Les liens de l’énoncé',
         '<a href="https://docs.opnsense.org/manual/firewall.html" target="_blank" rel="noopener">'
         'docs.opnsense.org — Firewall</a> · '
         '<a href="https://blog.stephane-robert.info/docs/securiser/reseaux/opnsense/comprendre/" '
         'target="_blank" rel="noopener">Stéphane Robert — comprendre OPNsense</a> · '
         '<a href="https://rdr-it.com/opnsense-mise-en-place-dun-pare-feu/" target="_blank" '
         'rel="noopener">RDR-IT — mise en place d’un pare-feu</a>.'),
    '<h2>L’infrastructure</h2>',
    SVG_INFRA,
    '<p>La maquette du <a href="/pages/tp-opnsense-installation">TP 1.1</a> : LAN = les postes '
    '(<code>192.168.10.0/24</code>), LAN_SRV = les serveurs (<code>192.168.20.0/24</code>), le '
    'serveur DNS/Web en <code>192.168.20.100</code>, le poste Windows encore en adresse fixe '
    '<code>192.168.10.50</code> jusqu’au ⑥.</p>',

    '<h2>① Les règles présentes par défaut</h2>',
    '<p><span class="lx-nav">Firewall › Rules</span>, un onglet par interface — c’est la capture '
    'demandée, une par onglet. Ce qu’on y trouve, avant d’avoir rien écrit :</p>',
    tab(['Interface', 'Règle', 'Ce qu’elle fait'], [
        ['WAN', 'Block private networks', 'Jette ce qui arrive du WAN avec une adresse source privée (RFC 1918)'],
        ['WAN', 'Block bogon networks', 'Jette les plages attribuées à personne'],
        ['WAN', '<em>(aucune autorisation)</em>', 'Rien n’entre — le refus implicite'],
        ['LAN', 'Anti-Lockout Rule', 'Garantit l’accès à l’interface web depuis le LAN ; ne se supprime pas ici'],
        ['LAN', 'Default allow LAN to any rule', 'Le LAN sort partout, en IPv4'],
        ['LAN', 'Default allow LAN IPv6 to any rule', 'Idem en IPv6'],
        ['LAN_SRV', '<em>(aucune)</em>', 'Rien n’est autorisé'],
    ]),
    note('yellow', '⚠️ Le WAN de la maquette est un réseau privé',
         '« Block private networks » jette tout ce qui arrive sur le WAN depuis une adresse '
         '192.168.x, 172.16-31.x ou 10.x. Or le réseau de la salle en est un. Tant qu’on ne publie '
         'rien vers l’extérieur ça ne gêne pas ; au <a href="/pages/tp-opnsense-nat">TP 1.3</a>, '
         'ce sera la première chose à décocher.'),

    '<h2>② Le ping depuis le serveur (LAN_SRV)</h2>',
    cmd('C:\\&gt; ping 192.168.20.254\n\nDélai d’attente de la demande dépassé.'),
    qr('Cela fonctionne-t-il ? Pourquoi ?',
       '<strong>Non.</strong> Le paquet ICMP entre dans le pare-feu par l’interface LAN_SRV, et cet '
       'onglet ne contient <strong>aucune règle</strong>. Aucune règle ne correspond, donc la '
       'politique par défaut s’applique : <strong>refus implicite</strong>. Ce n’est pas le serveur '
       'qui est mal configuré, ni le pare-feu Windows : c’est OPNsense qui jette le paquet, et on le '
       'voit en rouge dans <span class="lx-nav">Firewall › Log Files › Live View</span>.'),

    '<h2>③ Le même ping depuis le poste Windows (LAN)</h2>',
    cmd('C:\\&gt; ping 192.168.10.254\n\nRéponse de 192.168.10.254 : octets=32 temps&lt;1ms TTL=64'),
    qr('Cela fonctionne-t-il ? Pourquoi ?',
       '<strong>Oui.</strong> Le paquet entre par l’interface LAN, où la règle <em>Default allow LAN '
       'to any</em> correspond : source LAN net, n’importe quelle destination, n’importe quel '
       'protocole. La réponse revient sans règle supplémentaire — le pare-feu est à états.'),
    '<p>Puis on supprime les règles par défaut de l’onglet LAN — les deux <em>Default allow</em> '
    '(l’anti-lockout, elle, n’est pas dans la liste) — et on clique <em>Apply changes</em>. Le même '
    'ping échoue désormais.</p>',
    qr('Que déduire du fonctionnement d’un pare-feu sans aucune règle ?',
       'Qu’il <strong>bloque tout</strong>. La politique par défaut d’OPNsense est <em>deny all</em> : '
       'une interface sans règle ne laisse rien entrer, dans aucune direction. Tout ce qui doit '
       'passer doit être <strong>explicitement autorisé</strong> — c’est la bonne pratique du '
       '<a href="/pages/le-pare-feu">cours</a>, appliquée d’usine. Et l’interface web reste '
       'accessible : c’est le rôle de l’anti-lockout.'),

    '<h2>④ Autoriser les flux demandés</h2>',
    '<p>La question à se poser avant chaque règle : <strong>« par quelle interface ce paquet '
    'entre-t-il dans le pare-feu ? »</strong> La réponse donne l’onglet. Un ping du LAN vers '
    'LAN_SRV entre par LAN ; un ping émis par le serveur entre par LAN_SRV.</p>',
    tab(['Onglet', 'Action', 'Proto', 'Source', 'Destination', 'Port dest.', 'Description'], [
        ['LAN', 'Pass', 'ICMP', 'LAN net', 'LAN_SRV net', '—', 'Ping LAN → LAN_SRV'],
        ['LAN_SRV', 'Pass', 'ICMP', 'LAN_SRV net', 'any', '—', 'Ping depuis LAN_SRV'],
        ['LAN', 'Pass', 'TCP', 'LAN net', '192.168.20.100', '80, 443', 'Web LAN → serveur'],
        ['LAN', 'Pass', 'TCP/UDP', 'LAN net', '192.168.20.100', '53', 'DNS LAN → serveur'],
        ['LAN', 'Pass', 'TCP', 'LAN net', 'any', '80, 443', 'Navigation Internet'],
        ['LAN_SRV', 'Pass', 'TCP/UDP', '192.168.20.100', 'any', '53', 'Le serveur DNS interroge Internet'],
    ]),
    '<p>Sur chaque règle : cocher <strong>Log packets that are handled by this rule</strong> — sans '
    'ça, une règle <em>Pass</em> ne laisse aucune trace, et la capture de journal demandée sera '
    'vide. Puis <em>Save</em>, et <em>Apply changes</em> une fois toutes les règles écrites.</p>',
    qr('Pourquoi la dernière ligne, que l’énoncé ne demande pas ?',
       'Parce que « la navigation Internet depuis le LAN » ne marche pas sans résolution de noms. '
       'Le poste interroge le serveur DNS en 192.168.20.100 ; ce serveur, pour répondre sur '
       '<code>www.google.fr</code>, doit lui-même sortir vers Internet — et il entre dans le pare-feu '
       'par LAN_SRV, sans règle. Sans cette ligne, le navigateur affiche « adresse introuvable » et '
       'on accuse à tort la règle 80/443.'),
    qr('Le ping du LAN vers le serveur ne répond toujours pas ?',
       'La règle est bonne : c’est <strong>Windows Server</strong> qui ne répond pas au ping par '
       'défaut. Autoriser ICMP dans son pare-feu — '
       '<a href="/pages/astuce-pare-feu-ping">l’astuce est ici</a>. Pour distinguer les deux cas : '
       'la <em>Live View</em> montre le paquet passer en vert ; s’il est vert et sans réponse, le '
       'problème est après le pare-feu.'),
    note('gray', '💡 Deux gestes qui évitent de tout réécrire',
         'Un <strong>alias</strong> (<span class="lx-nav">Firewall › Aliases</span>) '
         '<code>Ports_web</code> = 80, 443 : les règles y font référence, on ne retape plus la liste. '
         'Et <code>LAN net</code>, <code>LAN_SRV net</code> : les réseaux des interfaces, tels '
         'qu’OPNsense les connaît — si l’adressage change, les règles suivent.'),
    '<p>Les captures demandées, par service :</p>',
    tab(['Service', 'Le test réussi', 'La trace dans le journal'], [
        ['Ping', '<code>ping 192.168.20.100</code> depuis le poste — réponses', 'Live View filtrée sur <code>icmp</code> : ligne verte, interface LAN'],
        ['Web', '<code>http://www.macao.city</code> dans le navigateur — la page IIS', 'Ligne verte, dst <code>192.168.20.100:80</code>, la description de la règle'],
        ['DNS', '<code>nslookup www.macao.city 192.168.20.100</code> — l’adresse 192.168.20.100', 'Ligne verte, dst <code>192.168.20.100:53</code>, proto udp'],
    ]),
    note('yellow', '⚠️ L’enregistrement DNS, sans lequel le test web ne prouve rien',
         'Sur le serveur, dans la zone <code>macao.city</code> : un enregistrement <strong>A</strong> '
         '<code>www</code> → <code>192.168.20.100</code> (voir <a href="/pages/procedure-dns">DNS : '
         'zones &amp; enregistrements</a>). Tester par le nom et non par l’adresse valide les deux '
         'règles d’un coup — DNS puis HTTP.'),

    '<h2>⑤ Une règle de blocage en première position</h2>',
    '<p>Sur l’onglet LAN : <em>Block</em>, TCP, source <code>LAN net</code>, destination '
    '<code>any</code>, ports <code>80, 443</code>, journalisation cochée. On la fait glisser '
    '<strong>tout en haut</strong> de la liste, <em>Apply changes</em>, puis on recharge un site.</p>',
    qr('Que se passe-t-il ?',
       'Le site ne charge plus — ni Internet, ni l’intranet en <code>www.macao.city</code>, puisque '
       'la destination est <code>any</code>. Dans la <em>Live View</em>, les paquets vers le port 80 '
       'et 443 passent en rouge avec la description de la règle de blocage.'),
    qr('Que déduire du « match » des règles ?',
       'Les règles sont lues <strong>de haut en bas</strong> et <strong>la première qui correspond '
       'décide</strong> : les règles <em>Pass</em> plus bas ne sont même pas lues. Deux règles '
       'peuvent être justes chacune et se contredire — seul l’ordre tranche. C’est pour ça qu’on met '
       'les exceptions étroites en haut et les autorisations larges en bas.'),
    note('gray', '🔍 « Ça marche encore » juste après Apply',
         'Une connexion déjà ouverte continue sur son état : la nouvelle règle ne concerne que les '
         '<strong>nouvelles</strong> connexions. Pour voir l’effet immédiatement, vider les états du '
         'poste dans <span class="lx-nav">Firewall › Diagnostics › States</span>, ou fermer le '
         'navigateur. Ne pas oublier de retirer la règle de blocage avant la suite.'),

    '<h2>⑥ Le DHCP sur l’interface LAN</h2>',
    '<p><span class="lx-nav">Services › ISC DHCPv4 › [LAN]</span> — ou <span class="lx-nav">Services '
    '› Kea DHCP › Kea DHCPv4</span> sur les versions récentes, où ISC est en fin de vie. Les deux '
    'demandent la même chose :</p>',
    tab(['Réglage', 'Valeur'], [
        ['Enable', 'coché'],
        ['Range', '<code>192.168.10.100</code> → <code>192.168.10.200</code>'],
        ['DNS servers', '<code>192.168.20.100</code> — le serveur du TP, pas le pare-feu'],
        ['Gateway', 'vide : l’adresse de l’interface (<code>192.168.10.254</code>) est proposée par défaut'],
        ['Domain name', '<code>macao.city</code>'],
    ]),
    '<p>Le service est <em>Running</em> dans <span class="lx-nav">System › Diagnostics › '
    'Services</span> (ou l’icône en haut à droite du tableau de bord) — c’est la capture de l’étape '
    '7. Sur le poste Windows, remettre la carte en « Obtenir une adresse IP automatiquement », puis :</p>',
    cmd('C:\\&gt; ipconfig /release\nC:\\&gt; ipconfig /renew\nC:\\&gt; ipconfig /all\n\n'
        '   DHCP activé . . . . . . . . . : Oui\n'
        '   Adresse IPv4. . . . . . . . . : 192.168.10.100\n'
        '   Serveur DHCP. . . . . . . . . : 192.168.10.254\n'
        '   Serveurs DNS. . . . . . . . . : 192.168.20.100'),
    qr('D’autres services, sans greffon ?',
       'Le résolveur <strong>Unbound DNS</strong> (avec ses listes de blocage), le '
       '<strong>DHCPv6</strong> et les <strong>Router Advertisements</strong>, <strong>NTP</strong>, '
       'les VPN <strong>OpenVPN</strong>, <strong>IPsec</strong> et <strong>WireGuard</strong>, la '
       'détection d’intrusion <strong>Suricata</strong>, le <strong>portail captif</strong>, la '
       '<strong>supervision Monit</strong>, le <strong>traffic shaper</strong> (limitation de débit), '
       'la haute disponibilité <strong>CARP</strong>. Le détail du DHCP et du DNS : '
       '<a href="/pages/opnsense-services">volet 3 du cours</a>.'),

    '<h2>⑦ Un greffon : Squid</h2>',
    '<p>Avant tout greffon, le dépôt doit être à jour : <span class="lx-nav">System › Firmware › '
    'Status</span> › <em>Check for updates</em>, et appliquer la mise à jour proposée (le pare-feu '
    'redémarre parfois — d’où l’intérêt de la sauvegarde du TP 1.1). Puis l’onglet '
    '<em>Plugins</em> : chercher <code>os-squid</code>, <strong>+</strong>. Un nouveau menu '
    '<span class="lx-nav">Services › Squid Web Proxy</span> apparaît.</p>',
    qr('Quel est l’intérêt des greffons ?',
       'Garder un pare-feu <strong>léger</strong> — moins de code, moins de surface d’attaque, des '
       'mises à jour plus simples — tout en pouvant l’<strong>étendre</strong> à la demande : un '
       'proxy web avec cache et filtrage d’URL (Squid), un répartiteur de charge (HAProxy), des '
       'certificats Let’s Encrypt (acme-client), un agent de supervision (Zabbix, SNMP), du routage '
       'dynamique (FRR), des thèmes. Chacun s’installe et se retire sans toucher au reste.'),

    note('green', '✅ Ce qu’il faut retenir',
         'Sans règle, un pare-feu <strong>bloque tout</strong>. Une règle se pose sur l’interface par '
         'laquelle le paquet <strong>entre</strong>. Les règles sont lues <strong>de haut en '
         'bas</strong>, la première qui correspond gagne. La réponse n’a jamais besoin de règle. Et '
         'une règle sans journalisation ne prouve rien. '
         'La suite : <a href="/pages/tp-opnsense-nat"><strong>TP 1.3 — NAT</strong></a>, où le '
         'serveur web devient visible depuis le WAN.'),
])


# ═══════════════════════════════════════════════════ TP 1.3 : NAT ══

TP13 = '\n'.join([
    hero('TP · corrigé · Réseau', 'TP OPNsense 1.3 — NAT (corrigé)',
         'Publier le serveur web interne vers le WAN par une redirection de port, comprendre le lien '
         'entre NAT et règles de filtrage, et lire la traduction dans les journaux.'),
    STYLE_TP,
    fil_tp('tp-opnsense-nat'),
    le_tp('Comprendre le NAT et le PAT, mettre en place une redirection de port, publier un service '
          'interne, comprendre le lien entre NAT et règles de filtrage, vérifier les traductions '
          'dans les journaux.',
          '<a href="/pages/cisco-nat">NAT / PAT</a> (la théorie), '
          '<a href="/pages/opnsense-nat">OPNsense — volet 2, le NAT et les redirections de port</a>'),
    note('gray', '📚 Les liens de l’énoncé',
         '<a href="https://www.it-connect.fr/le-nat-et-le-pat-pour-les-debutants/" target="_blank" '
         'rel="noopener">IT-Connect — le NAT et le PAT pour les débutants</a> · '
         '<a href="https://docs.opnsense.org/manual/nat.html" target="_blank" rel="noopener">'
         'docs.opnsense.org — NAT</a> · '
         '<a href="https://rdr-it.com/opnsense-configurer-une-redirection-de-port-port-forwarding/" '
         'target="_blank" rel="noopener">RDR-IT — configurer une redirection de port</a>.'),
    '<h2>L’infrastructure</h2>',
    SVG_INFRA,
    '<p>Le but : rendre le site du serveur IIS accessible <strong>depuis le WAN</strong> — la '
    'machine hôte, ou n’importe quel poste de la salle — sans exposer le serveur lui-même, qui '
    'garde son adresse privée.</p>',
    note('yellow', '⚠️ Une ambiguïté de l’énoncé',
         'L’étape 1 parle du serveur en <code>192.168.20.10</code> ; le schéma d’infrastructure, '
         'commun aux trois TP, le place en <code>192.168.20.100</code>. Ce corrigé suit le schéma. '
         'Si le serveur est réellement en .10, remplacer partout — la démarche ne change pas.'),

    '<h2>① Vérifier l’accès depuis le LAN</h2>',
    '<p>Depuis le poste Windows, <code>http://192.168.20.100</code> : la page d’accueil d’IIS '
    's’affiche, grâce à la règle « Web LAN → serveur » du <a href="/pages/tp-opnsense-filtrage">TP '
    '1.2</a>.</p>',
    qr('Le serveur est-il accessible depuis le LAN ?',
       '<strong>Oui</strong> — le paquet entre par LAN, une règle <em>Pass</em> vers 192.168.20.100 '
       'port 80 correspond.'),
    qr('Sur quel port écoute le service HTTP ?',
       'Le <strong>port 80/TCP</strong> — 443 pour HTTPS. Sur le serveur, '
       '<code>netstat -ano | findstr :80</code> le montre en <em>LISTENING</em>.'),
    qr('Le serveur est-il accessible depuis l’extérieur ?',
       '<strong>Non</strong>, pour trois raisons qui se cumulent. <code>192.168.20.100</code> est une '
       'adresse <strong>privée</strong> : personne sur le WAN ne sait la router, elle n’existe que '
       'derrière le pare-feu. Aucune règle sur l’onglet WAN n’autorise quoi que ce soit. Et rien ne '
       'dit au pare-feu <em>où</em> envoyer un paquet qui arriverait sur son adresse WAN : c’est '
       'exactement ce que la redirection va ajouter.'),

    '<h2>② La règle NAT</h2>',
    '<p><span class="lx-nav">Firewall › NAT › Port Forward</span> › <strong>+</strong> :</p>',
    tab(['Champ', 'Valeur', 'Pourquoi'], [
        ['Interface', '<code>WAN</code>', 'Là où le paquet arrive'],
        ['TCP/IP Version', '<code>IPv4</code>', ''],
        ['Protocol', '<code>TCP</code>', 'HTTP est du TCP'],
        ['Source', '<code>any</code>', 'N’importe qui sur le WAN (restreint au bonus)'],
        ['Destination', '<code>WAN address</code>', 'L’adresse .x du pare-feu — ce qu’on tape dans le navigateur'],
        ['Destination port range', '<code>HTTP</code> (80) → <code>HTTP</code>', 'Le port sur lequel le pare-feu écoute pour le compte du serveur'],
        ['Redirect target IP', '<code>192.168.20.100</code>', 'Le serveur, en adresse privée'],
        ['Redirect target port', '<code>HTTP</code> (80)', 'Le port du service sur le serveur — il peut différer du port publié'],
        ['Description', '« Web IIS depuis le WAN »', 'Dans six mois, on saura pourquoi'],
        ['Filter rule association', '<code>Add associated filter rule</code>', '<strong>Le point clé</strong> — voir ci-dessous'],
    ]),
    '<p><em>Save</em>, puis <em>Apply changes</em>. La capture demandée est la liste de '
    '<em>Port Forward</em> avec cette ligne.</p>',
    qr('Quel est le lien entre NAT et règles de filtrage ?',
       'Ce sont <strong>deux opérations distinctes</strong>. La redirection dit <em>où</em> envoyer '
       'le paquet (traduire la destination WAN:80 en 192.168.20.100:80) ; elle ne dit pas qu’il a le '
       'droit d’entrer. Il faut <strong>aussi</strong> une règle <em>Pass</em> sur l’onglet WAN vers '
       '192.168.20.100 port 80. <em>Add associated filter rule</em> la crée et la maintient '
       'automatiquement — elle apparaît dans <span class="lx-nav">Firewall › Rules › WAN</span>, '
       'verrouillée, liée à la redirection. Sans elle, la traduction a lieu puis le paquet est jeté '
       'par le refus implicite du WAN.'),
    note('red', '🚨 « Block private networks » va bloquer votre test',
         'Le WAN de la maquette est le réseau de la salle, donc une adresse privée. La règle '
         'd’usine du WAN jette tout paquet qui arrive d’une source privée — y compris la machine '
         'hôte. <span class="lx-nav">Interfaces › [WAN]</span> : décocher <strong>Block private '
         'networks</strong>, <em>Save</em>, <em>Apply</em>. Sur un vrai WAN Internet, on la laisse '
         'cochée.'),

    '<h2>③ Le test depuis l’hôte</h2>',
    cmd('http://&lt;adresse WAN du pare-feu&gt;        ← depuis la machine hôte, ou un poste de la salle'),
    qr('Le serveur est-il accessible depuis l’extérieur ?',
       '<strong>Oui</strong> : la page IIS s’affiche alors que le navigateur ne connaît que '
       'l’adresse du pare-feu. Le serveur, lui, n’a rien vu changer — il a reçu une requête dont la '
       'source est l’hôte, et il répond via sa passerelle 192.168.20.254, où la traduction inverse '
       'se fait toute seule (le pare-feu est à états).'),
    note('gray', '🔍 Si la page ne vient pas',
         'Dans l’ordre : <strong>Block private networks</strong> encore coché ? La règle de filtrage '
         'associée existe-t-elle sur l’onglet WAN ? Le pare-feu <strong>Windows</strong> du serveur '
         'accepte-t-il le port 80 depuis un réseau étranger (profil public) ? Et le test est-il '
         'bien fait <strong>depuis le WAN</strong> — depuis le LAN avec l’adresse WAN, c’est la '
         'réflexion NAT qu’on teste, qui est désactivée par défaut (<a href="/pages/opnsense-nat">'
         'volet 2, § 6</a>).'),

    '<h2>④ Les journaux</h2>',
    '<p><span class="lx-nav">Firewall › Log Files › Live View</span>, filtre sur <code>80</code> ou '
    'sur l’adresse de l’hôte, puis recharger la page depuis l’hôte.</p>',
    qr('Voit-on le trafic entrant sur le WAN ?',
       '<strong>Oui.</strong> Une ligne verte, interface <strong>WAN</strong>, direction '
       '<em>in</em>, source = l’adresse de l’hôte, destination = <code>192.168.20.100:80</code>, et '
       'la description de la règle associée à la redirection. La destination affichée est '
       '<strong>déjà traduite</strong> : le NAT s’applique <em>avant</em> le filtrage, et la règle '
       'de filtrage voit le paquet tel qu’il sera livré. C’est pour ça que la règle associée vise '
       '192.168.20.100 et non l’adresse WAN. La traduction elle-même, ligne par ligne : '
       '<span class="lx-nav">Firewall › Diagnostics › States</span>.'),

    '<h2>⑤ Le bonus</h2>',
    acc(
        ('🔒 IIS en HTTPS, consultable depuis le WAN',
         '<p>Sur le serveur, Gestionnaire IIS › <em>Certificats de serveur</em> › <em>Créer un '
         'certificat auto-signé</em>, puis sur le site : <em>Liaisons</em> › ajouter '
         '<code>https</code>, port 443, ce certificat. Côté OPNsense, une seconde redirection : WAN, '
         'TCP, <em>WAN address</em> port <code>443</code> → <code>192.168.20.100</code> port '
         '<code>443</code>, règle associée. Depuis l’hôte, <code>https://&lt;adresse WAN&gt;</code> : '
         'l’avertissement de certificat est attendu. Voir <a href="/pages/procedure-iis">IIS : '
         'héberger un site web</a>.</p>'),
        ('📁 Un serveur FTP IIS, joignable depuis l’hôte',
         '<p>Ajouter le service de rôle <em>Serveur FTP</em>, créer un site FTP sur '
         '<code>C:\\inetpub\\wwwroot</code> avec <em>authentification de base</em> et un compte '
         'local autorisé en lecture/écriture — c’est ce qui permet de déposer la nouvelle page. '
         'FTP a deux canaux (<a href="/pages/linux-proftpd">le cours l’explique</a>) : le port 21, '
         'et une plage passive. Dans IIS, <em>Prise en charge du pare-feu FTP</em> : plage '
         '<code>50000-50100</code> et <strong>adresse IP externe = l’adresse WAN du pare-feu</strong>, '
         'sans quoi le serveur annonce son adresse privée au client. Puis deux redirections : port '
         '21, et la plage 50000-50100, vers 192.168.20.100. Le client FTP se connecte en mode '
         '<strong>passif</strong>.</p>'),
        ('🖥️ Bureau à distance sur le client et le serveur, depuis l’hôte seulement',
         '<p>Un seul port 3389 côté WAN, deux machines derrière : on <strong>publie sur deux ports '
         'différents</strong>. Redirection WAN <code>3389</code> → <code>192.168.20.100:3389</code> '
         '(serveur) et WAN <code>3390</code> → <code>&lt;IP du ClientMacao&gt;:3389</code>. Le client '
         'est en DHCP : lui faire une <strong>réservation</strong> (bail statique) dans le DHCP du '
         'TP 1.2, sinon la redirection vise une adresse qui changera. Et dans chaque redirection, '
         '<em>Source</em> › <em>Advanced</em> › <code>Single host</code> = l’adresse de l’hôte : la '
         'règle associée en hérite, tout autre poste de la salle est refusé. Bureau à distance doit '
         'être activé sur les deux machines Windows (<a href="/pages/astuce-bureau-a-distance">astuce RDP</a>).</p>'),
        ('🐧 Une VM Debian dans LAN_SRV, SSH publié sur le port 22140',
         '<p>La VM : une carte sur COM Privée 2, adresse fixe <code>192.168.20.20/24</code>, '
         'passerelle <code>192.168.20.254</code>, DNS <code>192.168.20.100</code> '
         '(<a href="/pages/tp-config-reseau-statique">TP — IP statique</a>), '
         '<code>hostnamectl set-hostname srvdeb.macao.city</code>, <code>apt install '
         'openssh-server</code>. Pour qu’<code>apt</code> fonctionne, une règle sur LAN_SRV : Pass, '
         'TCP/UDP, source <code>192.168.20.20</code>, destination any, ports 53, 80, 443. Puis la '
         'redirection : WAN, TCP, <em>WAN address</em> port <code>22140</code> → '
         '<code>192.168.20.20</code> port <code>22</code>. Le port publié et le port du service '
         'diffèrent — c’est le <strong>PAT</strong> au sens strict. Depuis l’hôte : '
         '<code>ssh utilisateur@&lt;adresse WAN&gt; -p 22140</code>. Un enregistrement A '
         '<code>srvdeb</code> dans la zone macao.city complète le tableau.</p>'),
    ),

    note('green', '✅ Ce qu’il faut retenir',
         'Une redirection de port <strong>traduit</strong> la destination ; une règle de filtrage '
         '<strong>autorise</strong> — il faut les deux, et OPNsense sait lier la seconde à la '
         'première. Le NAT s’applique avant le filtrage, ce qui se lit dans les journaux. Un port '
         'publié peut différer du port du service (PAT). Et on restreint la <strong>source</strong> '
         'dès qu’on le peut : une publication ouverte au monde entier est une cible.'),
])


# ══════════════════════════════════════════════════ les index ══

TP_SECTION_ID = 'sec-opnsense'
TP_SECTION_TITRE = '🧱 Pare-feu · OPNsense (Hyper-V)'
TP_CHIP = '🧱 Pare-feu · OPNsense'
TP_CARTES = [
    ('tp-opnsense-installation', '💿', 'OPNsense 1.1 — Installation',
     'La VM à trois cartes, l’installation, l’assignation WAN / LAN / LAN_SRV par la MAC, les '
     'adresses en console, le premier accès web et les huit gestes de prise en main.'),
    ('tp-opnsense-filtrage', '🧱', 'OPNsense 1.2 — Filtrage des flux',
     'Ce qu’un pare-feu fait sans règle, les règles ping / web / DNS / Internet, l’ordre '
     'd’évaluation vérifié par un blocage en tête, le DHCP et le greffon Squid.'),
    ('tp-opnsense-nat', '🔁', 'OPNsense 1.3 — NAT',
     'Publier IIS par une redirection de port, la règle de filtrage associée, le piège des réseaux '
     'privés sur le WAN, la traduction dans les journaux — et le bonus HTTPS, FTP, RDP, SSH.'),
]


def carte_tp(slug, icone, titre, desc):
    return (f'\n<a class="dir-card" href="/pages/{slug}"><div class="dc-ico">{icone}</div>'
            f'<div class="dc-body"><div class="dc-title">{titre}</div>'
            f'<div class="dc-desc meta">{desc}</div></div><div class="dc-go">Voir →</div></a>')


def maj_tp(html):
    """Une section neuve dans l'index des TP, ou ses cartes manquantes, puis les compteurs."""
    if f'id="{TP_SECTION_ID}"' not in html:
        section = (f'\n\n<section class="pd-sec" id="{TP_SECTION_ID}">'
                   f'<h2 class="pd-h">{TP_SECTION_TITRE} <span class="pd-count">0</span></h2>'
                   f'<div class="pd-grid">\n</div></section>')
        i = html.rindex('</section>') + len('</section>')
        html = html[:i] + section + html[i:]
        chip = (f'\n<a class="pd-chip" href="#{TP_SECTION_ID}">{TP_CHIP} '
                f'<span class="pd-n">0</span></a>')
        j = html.index('</nav>')
        html = html[:j] + chip + html[j:]

    m = re.search(r'<section class="pd-sec" id="%s">.*?</section>' % TP_SECTION_ID, html, re.S)
    bloc = m.group(0)
    manquantes = ''.join(carte_tp(*x) for x in TP_CARTES if f'href="/pages/{x[0]}"' not in bloc)
    if manquantes:
        k = bloc.rindex('\n</div></section>')
        bloc = bloc[:k] + manquantes + bloc[k:]
        html = html[:m.start()] + bloc + html[m.end():]

    comptes = {}
    for s in re.finditer(r'<section class="pd-sec" id="(sec-[^"]+)">(.*?)</section>', html, re.S):
        comptes[s.group(1)] = len(re.findall(r'<a class="dir-card"', s.group(2)))
    html = re.sub(r'<section class="pd-sec" id="(sec-[^"]+)">.*?</section>',
                  lambda s: re.sub(r'(<span class="pd-count">)\d+(</span>)',
                                   lambda t: t.group(1) + str(comptes[s.group(1)]) + t.group(2),
                                   s.group(0), count=1), html, flags=re.S)
    html = re.sub(r'<a class="pd-chip" href="#(sec-[^"]+)">.*?</a>',
                  lambda s: re.sub(r'(<span class="pd-n">)\d+(</span>)',
                                   lambda t: t.group(1) + str(comptes.get(s.group(1), 0)) + t.group(2),
                                   s.group(0), count=1), html, flags=re.S)

    # Le chapô du hero énumère les domaines : il doit suivre.
    html = html.replace('Active Directory &amp; Windows, Apache &amp; FTP.',
                        'Active Directory &amp; Windows, Apache &amp; FTP, pare-feu OPNsense.')
    return html, ' — '.join(f'{k}:{v}' for k, v in comptes.items())


def maj_carte_cours(html, slug, description):
    """La description de la carte d'un cours déjà rangé dans l'index."""
    return re.sub(r'(<a class="crs-card"[^>]*href="/pages/%s">.*?<div class="crs-cd">).*?(</div></a>)'
                  % re.escape(slug), lambda m: m.group(1) + description + m.group(2), html,
                  count=1, flags=re.S)


PAGES = [
    ('le-pare-feu', 'Le pare-feu', PARE_FEU_EXTRAIT, PARE_FEU),
    ('tp-opnsense-installation', 'TP OPNsense 1.1 — Installation (corrigé)',
     'Installer OPNsense dans une VM Hyper-V à trois cartes, assigner WAN / LAN / LAN_SRV, adresser '
     'les interfaces en console, ouvrir l’interface web et faire les premiers gestes d’administration.',
     TP11),
    ('tp-opnsense-filtrage', 'TP OPNsense 1.2 — Filtrage des flux (corrigé)',
     'Le comportement d’un pare-feu sans règle, les règles ping / web / DNS / Internet, l’ordre '
     'd’évaluation, les journaux, puis le DHCP et l’installation d’un greffon.', TP12),
    ('tp-opnsense-nat', 'TP OPNsense 1.3 — NAT (corrigé)',
     'Publier le serveur web interne vers le WAN par une redirection de port, le lien entre NAT et '
     'règles de filtrage, la traduction dans les journaux — et le bonus HTTPS, FTP, RDP, SSH.', TP13),
]


def main():
    c = sqlite3.connect(BASE)
    rapport = []
    for slug, titre, extrait, contenu in PAGES:
        etat = publier(c, slug, titre, extrait, contenu)
        rapport.append(f'{slug} : {etat} ({len(contenu)} car.)')

    # « Le pare-feu » avait un builder_json d'avant la réécriture : on l'efface pour
    # que l'éditeur reparte du HTML publié et non d'une version qui n'existe plus.
    c.execute("UPDATE pages SET builder_json='' WHERE slug='le-pare-feu'")

    idx = c.execute("SELECT content FROM pages WHERE slug='cours'").fetchone()[0]
    neuf, info = ranger_dans_index(idx, 'le-pare-feu', 'Le pare-feu', PARE_FEU_DESCRIPTION)
    if neuf is None:
        print('index cours :', info, file=sys.stderr)
        return 1
    neuf = maj_carte_cours(neuf, 'le-pare-feu', PARE_FEU_DESCRIPTION)
    c.execute("UPDATE pages SET content=?,"
              " updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug='cours'", (neuf,))
    rapport.append(f'index cours : {info}')

    tp = c.execute("SELECT content FROM pages WHERE slug='tp'").fetchone()[0]
    neuf, info = maj_tp(tp)
    # L'extrait sert de sous-titre en tête de page : il énumère aussi les domaines.
    c.execute("UPDATE pages SET content=?, excerpt=?,"
              " updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug='tp'",
              (neuf, 'Les travaux pratiques du parcours, corrigés : DNS/BIND9, VLAN Cisco, Active '
                     'Directory & Windows, Apache & FTP, pare-feu OPNsense.'))
    rapport.append(f'index tp : {info}')

    c.commit()
    c.close()
    print('\n'.join(rapport).encode('ascii', 'replace').decode('ascii'))
    return 0


if __name__ == '__main__':
    sys.exit(main())

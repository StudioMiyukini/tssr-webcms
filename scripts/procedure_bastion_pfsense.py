# -*- coding: utf-8 -*-
"""
Page « Un bastion d'administration derrière pfSense » : la configuration pfSense
qui publie et verrouille un bastion (Guacamole ou SSH) — placement, alias, NAT
source-restreint, règles qui forcent l'administration à passer par le bastion,
variante « accès par VPN ». Complète la procédure de déploiement Guacamole par
le côté réseau. Style step-banner. Rangée dans Procédures › Réseau & adressage.

IDEMPOTENT.
"""
import re
import sqlite3
import sys

from _cours import BASE, publier

SLUG = 'procedure-bastion-pfsense'
TITRE = 'Un bastion d’administration derrière pfSense'

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
         ".rt{border-collapse:collapse;width:100%;margin:8px 0;font-size:12.2px}"
         ".rt td,.rt th{border:1px solid var(--border);padding:6px 9px;text-align:left;vertical-align:top}"
         ".rt th{background:var(--surface-2);color:var(--text-muted)}"
         ".rt code{font-size:11.5px}"
         "</style>")


def cmd(t):
    return f'<div class="proc-cmd">{t}</div>'


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
    '<section class="hero"><span class="pill">Procédure · pfSense · Sécurité</span>'
    '<h1>Un bastion d’administration derrière pfSense</h1>'
    '<p>La configuration pfSense qui fait qu’un bastion mérite son nom : un seul point d’entrée '
    'd’administration, les serveurs injoignables autrement, et l’accès restreint à qui de droit.</p>'
    '</section>',
    STYLE,

    note('blue', '🎯 Le rôle de pfSense dans un bastion',
         'Déployer le bastion (le <a href="/pages/procedure-bastion-guacamole">Guacamole HTML5</a>, ou '
         'un <a href="/pages/configurateur-bastion">rebond SSH</a>) ne suffit pas : tant que les '
         'serveurs acceptent une connexion d’administration <em>venant d’ailleurs</em>, le bastion '
         'n’est qu’une porte de plus. C’est <strong>pfSense</strong> qui fait respecter la règle : '
         'l’administration ne peut atteindre les serveurs que <strong>depuis le bastion</strong>, et le '
         'bastion lui-même n’est joignable que par les administrateurs. Cette page couvre ce côté '
         'réseau (le déploiement du serveur est <a href="/pages/procedure-bastion-guacamole">ici</a>).'),
    note('gray', '🧭 Le principe en une phrase',
         'Un bastion = <strong>un goulot d’étranglement voulu</strong>. Tout le trafic d’administration '
         'y converge, on le durcit et on le journalise une fois, au lieu de surveiller quarante ports '
         '22 et 3389 dispersés. pfSense dessine ce goulot avec des <strong>alias</strong> et l’ordre '
         'des <strong>règles</strong>.'),

    etape(1, BLEU, 'L’architecture', 'Où placer le bastion, et qui parle à qui',
          '<p>Le bastion vit dans une zone tenue (DMZ d’admin, ou l’OPT du TP 1.4). Les serveurs à '
          'administrer sont ailleurs (réseau serveurs). Exemple d’adressage repris du '
          '<a href="/pages/tp-opnsense-dmz">TP 1.4</a> :</p>'
          + tab(['Élément', 'Zone', 'Adresse'], [
              ['<strong>Bastion</strong> (Guacamole)', 'DMZ', '<code>192.168.30.2</code> · web 8080/443'],
              ['Serveur Linux (SSH)', 'OPT1 · serveurs', '<code>192.168.20.3</code> · 22'],
              ['Serveur Windows (RDP)', 'OPT1 · serveurs', '<code>192.168.20.2</code> · 3389'],
              ['Poste de l’administrateur', 'WAN / hôte', '<code>10.22.10.125</code>'],
          ])
          + '<p>Trois flux, et trois seulement, doivent exister : <strong>admin → bastion</strong> '
          '(le portail web), <strong>bastion → serveurs</strong> (SSH/RDP), et <strong>rien</strong> '
          'd’autre vers les ports d’administration des serveurs.</p>'),

    etape(2, VERT, 'Les alias', 'Nommer une fois, réutiliser partout',
          '<p><code>Firewall ▸ Aliases ▸ Add</code>. Des noms parlants rendent les règles lisibles et '
          'faciles à faire évoluer (ajouter un serveur = éditer l’alias, pas dix règles).</p>'
          + tab(['Alias', 'Type', 'Contenu'], [
              ['<code>ADMINS</code>', 'Host(s)', 'les IP des postes d’administration (ex. <code>10.22.10.125</code>)'],
              ['<code>SRV_ADMIN</code>', 'Host(s)', 'les serveurs à administrer (<code>192.168.20.2</code>, <code>192.168.20.3</code>)'],
              ['<code>PORTS_ADMIN</code>', 'Port(s)', '<code>22</code>, <code>3389</code> (SSH, RDP)'],
          ])),

    etape(3, VIOLET, 'Publier le bastion — NAT source-restreint', 'Firewall ▸ NAT ▸ Port Forward',
          '<p>Pour atteindre le portail depuis l’extérieur, une redirection — mais <strong>jamais '
          'ouverte à tous</strong> : la source est limitée aux administrateurs.</p>'
          + tab(['Champ', 'Valeur'], [
              ['Interface', 'WAN'],
              ['Protocol', 'TCP'],
              ['Source', '<strong><code>ADMINS</code></strong> (Advanced ▸ Source)'],
              ['Destination', 'WAN address'],
              ['Destination port', '<code>8080</code> (ou 443 une fois le HTTPS posé)'],
              ['Redirect target IP / port', '<code>192.168.30.2</code> / <code>8080</code>'],
              ['Filter rule association', 'Add associated filter rule'],
          ])
          + note('yellow', '⚠️ Le port publié ≠ « ouvert à Internet »',
                 'La <em>redirection</em> dit seulement où envoyer le paquet ; c’est la <strong>règle '
                 'associée</strong> (créée avec, sur l’onglet WAN) qui autorise l’entrée. En la limitant '
                 'à l’alias <code>ADMINS</code>, personne d’autre ne voit même le portail. Save puis '
                 '<strong>Apply Changes</strong>. Le '
                 '<a href="/pages/configurateur-pfsense">configurateur pfSense</a> écrit cette '
                 'redirection et sa règle.')),

    etape(4, AMBRE, 'Les règles qui FONT le bastion', 'L’ordre est déterminant',
          '<p>C’est ici que le bastion devient réel. Trois idées, dans le bon ordre (la première règle '
          'qui correspond gagne).</p>'
          + '<p><strong>a) Sur la zone du bastion (DMZ) — bastion → serveurs, uniquement l’admin :</strong></p>'
          + tab(['#', 'Action', 'Source', 'Destination', 'Port'], [
              ['1', '<span style="color:#16a34a">Pass</span>', '<code>192.168.30.2</code> (bastion)', '<code>SRV_ADMIN</code>', '<code>PORTS_ADMIN</code>'],
              ['2', '<span style="color:#dc2626">Block</span> (journalisé)', '<code>DMZ net</code>', '<code>Zone_Internes</code> (LAN+OPT)', 'any'],
          ])
          + '<p><strong>b) Sur les autres zones (LAN, clients) — personne ne joint le 22/3389 des '
          'serveurs directement :</strong></p>'
          + tab(['#', 'Action', 'Source', 'Destination', 'Port'], [
              ['1', '<span style="color:#dc2626">Block</span> (journalisé)', '<code>LAN net</code> / clients', '<code>SRV_ADMIN</code>', '<code>PORTS_ADMIN</code>'],
              ['2', '<span style="color:#16a34a">Pass</span>', '…', 'le reste des flux métier normaux', '…'],
          ])
          + note('red', '🚨 La règle de blocage AU-DESSUS',
                 'Le blocage <em>clients → serveurs:22/3389</em> doit être <strong>plus haut</strong> '
                 'que les règles permissives qui laissent le LAN travailler, sinon il ne sert à rien '
                 '(une règle spécifique placée <em>sous</em> un « pass » général est ignorée). C’est ce '
                 'blocage qui oblige l’administration à passer par le bastion.')
          + note('gray', '🔒 Contenir le bastion',
                 'Le bastion est exposé : on le <strong>contient</strong>. Sur sa zone, après la règle '
                 'qui le laisse joindre les serveurs, un <strong>blocage vers Internet et vers le reste '
                 'de l’interne</strong> (sauf ce dont Guacamole a besoin) — s’il est compromis, il ne '
                 'pivote nulle part. Voir <a href="/pages/tp-opnsense-dmz">TP 1.4</a>.')),

    etape(5, TEAL, 'Variante robuste — atteindre le bastion par VPN', 'Ne rien exposer sur le WAN',
          '<p>Mieux que publier le portail sur le WAN : ne <strong>rien</strong> exposer, et faire '
          'entrer l’administrateur par un <strong>VPN</strong>. Il monte le tunnel, se retrouve « sur '
          'le réseau d’admin », puis ouvre le bastion sur son IP privée.</p>'
          + '<ul class="proc-steps">'
          '<li><strong>OpenVPN accès nomade</strong> pour les administrateurs : '
          '<a href="/pages/openvpn-pfsense">OpenVPN sur pfSense</a> — certificat + compte + MFA.</li>'
          '<li>Aucune redirection NAT du portail sur le WAN : le bastion n’est joignable que '
          '<em>depuis le tunnel</em> (règle sur l’interface OpenVPN : <code>VPN admins</code> → '
          'bastion:8080).</li>'
          '<li>Entre deux sites, le bastion d’un site administre l’autre à travers le '
          '<a href="/pages/procedure-vpn-ipsec-pfsense">tunnel IPsec site-à-site</a>.</li></ul>'
          + note('gray', '🧱 Le vrai « moindre privilège »',
                 'Un portail d’admin sur le WAN, même restreint par IP, reste une surface. Le sortir de '
                 'la vue d’Internet (VPN d’abord, bastion ensuite) est le schéma des '
                 '<a href="/pages/zero-trust-iam">architectures en tiers</a> : on ne présente jamais '
                 'l’administration à l’extérieur.')),

    etape(6, VERT, 'Vérifier', 'La contre-preuve autant que le test',
          '<p>Un bastion se valide par ce qui <strong>ne marche plus</strong> autant que par ce qui '
          'marche :</p>'
          + '<ul class="proc-steps">'
          '<li><strong>Via le bastion</strong> : depuis le portail, la session SSH vers '
          '<code>192.168.20.3</code> et RDP vers <code>192.168.20.2</code> s’ouvrent.</li>'
          '<li><strong>En direct (doit échouer)</strong> : depuis un poste du LAN, un '
          '<code>ssh 192.168.20.3</code> ou un RDP <code>mstsc /v:192.168.20.2</code> est '
          '<strong>refusé</strong> — le journal pfSense montre le « block » sur la bonne règle.</li>'
          '<li><strong>Le portail</strong> n’est atteignable que depuis <code>ADMINS</code> (ou le '
          'VPN) — un autre poste ne charge même pas la page.</li>'
          '<li><strong>Les journaux</strong> : <code>Status ▸ System Logs ▸ Firewall</code> pour voir '
          'qui a été bloqué ou est passé, et l’historique des connexions dans Guacamole pour « qui a '
          'administré quoi ».</li></ul>'
          + cmd('# depuis un poste du LAN, ces deux commandes DOIVENT échouer (bloquées par pfSense) :\nssh admin@192.168.20.3\nmstsc /v:192.168.20.2\n# l\'administration ne passe QUE par le portail du bastion.')),

    note('green', '✅ À retenir',
         'Le bastion n’existe vraiment que si pfSense l’<strong>impose</strong> : NAT source-restreint '
         '(ou VPN) pour l’atteindre, une règle qui laisse <strong>le bastion seul</strong> joindre le '
         '22/3389 des serveurs, et un <strong>blocage au-dessus</strong> qui interdit à tout le monde '
         'd’y aller directement. On contient le bastion (pas de pivot), et on lit les journaux des deux '
         'côtés. La sécurité n’est pas dans le serveur Guacamole : elle est dans l’<strong>ordre des '
         'règles</strong>.'),
    note('gray', '🔗 À rapprocher',
         '<a href="/pages/procedure-bastion-guacamole">Déployer le bastion Guacamole</a> (le serveur) · '
         '<a href="/pages/configurateur-bastion">Configurateur bastion SSH</a> (ProxyJump) · '
         '<a href="/pages/configurateur-pfsense">Configurateur pfSense</a> (écrit NAT &amp; règles) · '
         '<a href="/pages/tp-opnsense-dmz">TP 1.4 — DMZ, GLPI &amp; bastion</a> · '
         '<a href="/pages/openvpn-pfsense">OpenVPN sur pfSense</a>.'),
])

EXTRAIT = ('La configuration pfSense d’un bastion d’administration : alias, NAT source-restreint (ou '
           'accès par VPN), et surtout les règles qui forcent l’administration à passer par le bastion '
           '(le bastion seul joint le 22/3389 des serveurs, blocage au-dessus pour tout le reste) — '
           'avec la contre-preuve.')

CARTE = ('<a class="dir-card" href="/pages/procedure-bastion-pfsense"><div class="dc-ico">🛡️</div>'
         '<div class="dc-body"><div class="dc-title">Un bastion d’administration derrière pfSense</div>'
         '<div class="dc-desc meta">Le côté réseau du bastion : alias, NAT source-restreint (ou VPN), '
         'et les règles qui forcent l’administration à passer par le bastion — le bastion seul joint '
         'le 22/3389 des serveurs, blocage au-dessus pour tout le reste.</div>'
         '<div><span style="display:inline-block;font-size:10.5px;font-weight:600;color:var(--text-muted);'
         'background:var(--surface-3);border:1px solid var(--border);border-radius:999px;padding:1px 9px;'
         'margin:4px 4px 0 0">pfSense</span>'
         '<span style="display:inline-block;font-size:10.5px;font-weight:600;color:var(--text-muted);'
         'background:var(--surface-3);border:1px solid var(--border);border-radius:999px;padding:1px 9px;'
         'margin:4px 4px 0 0">Bastion</span></div></div><div class="dc-go">Voir →</div></a>')


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

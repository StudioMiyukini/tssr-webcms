# -*- coding: utf-8 -*-
"""
Page « Configurateur — OPNsense » : à partir des interfaces (WAN/LAN/OPT), du
DHCP, des alias, des redirections NAT et des règles, produit le plan de
configuration de l'interface web OPNsense (chemins de menu + valeurs de chaque
champ). Îlot React `OpnsenseConfigurator` (data-block "opnsense-configurator").

IDEMPOTENT.
"""
import re
import sqlite3
import sys

from _cours import BASE, STYLE, hero, note, publier, tab

SLUG = 'configurateur-opnsense'
TITRE = 'Configurateur — OPNsense'

EXTRAIT = ('Décris tes interfaces (WAN/LAN/OPT), le DHCP, les alias, les redirections NAT et les '
           'règles : obtiens le plan de configuration OPNsense pas à pas — le chemin de menu et la '
           'valeur de chaque champ, prêts à recopier dans l’interface web.')

CONTENU = '\n'.join([
    hero('Outil · Réseau', TITRE,
         'OPNsense ne se configure pas en ligne de commande mais par son interface web. Cet outil '
         'écrit le <strong>plan exact</strong> : pour chaque interface, le DHCP, chaque alias, chaque '
         'redirection NAT et chaque règle — le menu à ouvrir et la valeur de chaque champ.'),
    STYLE,
    '<p>Configurer un pare-feu, c’est répétitif et sensible à l’ordre : une IP de passerelle hors '
    'sous-réseau, une règle de blocage mal placée, un « WAN address » à la place d’une IP dédiée, et '
    'plus rien ne passe. Cet outil part de <em>ton</em> adressage et déroule le '
    '<strong>plan de configuration</strong> section par section, avec le chemin de menu OPNsense et '
    'la valeur de chaque champ — de quoi refaire un TP sans rien oublier. Pour la théorie et les '
    'écrans : la série <a href="/pages/opnsense">OPNsense</a> et les '
    '<a href="/pages/tp-opnsense-installation">TP 1.1 à 1.4</a>. Version pfSense : '
    '<a href="/pages/configurateur-pfsense">configurateur pfSense</a>.</p>',

    '<h2>Ce que l’outil produit</h2>',
    tab(['Section', 'Menu OPNsense', 'Ce qu’elle règle'], [
        ['① Interfaces', '<code>Interfaces ▸ Assignments</code> puis <code>[WAN]/[LAN]/[OPT1]</code>',
         'Association carte→zone, activation, type d’adressage, IP/masque, passerelle (WAN)'],
        ['② DHCP', '<code>Services ▸ ISC DHCPv4 ▸ [zone]</code>',
         'Plage distribuée, DNS et passerelle poussés aux clients'],
        ['③ Alias', '<code>Firewall ▸ Aliases</code>',
         'Regrouper des réseaux/hôtes/ports sous un nom (ex. <code>reseaux_internes</code>)'],
        ['④ NAT', '<code>Firewall ▸ NAT ▸ Port Forward</code>',
         'Publier un service interne (la règle de filtrage associée est créée avec)'],
        ['⑤ Règles', '<code>Firewall ▸ Rules ▸ [zone]</code>',
         'Autoriser / bloquer, dans le bon ordre (le blocage spécifique au-dessus)'],
        ['⑥ Système', '<code>System ▸ Settings ▸ General</code>', 'Hostname, domaine, serveurs DNS, fuseau horaire'],
        ['⑦ Passerelles &amp; routes', '<code>System ▸ Gateways / Routes</code>', 'La passerelle WAN et les routes statiques'],
        ['⑧ VPN OpenVPN', '<code>VPN ▸ OpenVPN</code>', 'Un accès nomade (Remote Access) : certificats, tunnel, split tunnel'],
    ]),

    '<div data-block="opnsense-configurator"></div>',

    '<h2>Comment s’en servir</h2>',
    '<p>Renseigne tes interfaces (la <strong>carte physique</strong> — <code>hn0</code>, <code>hn1</code>… '
    'sous Hyper-V — se lit à sa <strong>MAC</strong> dans la console, pas à sa position), tes plages '
    'DHCP, tes alias, tes redirections et tes règles. Chaque bloc en sortie te donne le menu et les '
    'champs ; tu recopies dans l’interface, tu <strong>Enregistres puis Appliques</strong>.</p>',
    note('gray', 'ℹ️ Pourquoi pas un config.xml à restaurer ?',
         'OPNsense ne restaure une configuration que <strong>complète</strong> '
         '(<code>System ▸ Configuration ▸ Backups</code>), pas zone par zone depuis l’interface — la '
         'restauration partielle passe par la console (avancé). Le plan est de toute façon la façon '
         'normale de configurer le boîtier en TP. La version <a href="/pages/configurateur-pfsense">'
         'pfSense</a>, elle, sait restaurer chaque zone (config.xml par zone).'),
    note('yellow', '⚠️ Deux réflexes qui évitent 90 % des ratés',
         'Sur le <strong>WAN</strong> d’un labo (réseau privé de la salle), décoche <em>Block private '
         'networks</em> sinon le pare-feu jette ton propre test. Et une <strong>redirection NAT</strong> '
         '(où envoyer) ne suffit pas sans la <strong>règle de filtrage</strong> associée (le droit '
         'd’entrer) : coche « ajouter la règle associée ». Voir le '
         '<a href="/pages/tp-opnsense-nat">TP 1.3 — NAT</a>.'),
])

CARTE = ('<a class="script-card" href="/pages/configurateur-opnsense"><div class="sc-top">'
         '<span class="sc-ico">🧱</span><span class="sc-badge sc-badge-int">⚡ Interactif</span></div>'
         '<div class="sc-title">Configurateur — OPNsense</div>'
         '<div class="sc-desc meta">Outil interactif : interfaces (WAN/LAN/OPT), DHCP, alias, NAT et '
         'règles → le plan de configuration OPNsense pas à pas, chemin de menu et valeur de chaque '
         'champ.</div>'
         '<div class="sc-tags"><span class="sc-pill">Réseau</span><span class="sc-pill">Pare-feu</span>'
         '<span class="sc-pill">OPNsense</span></div></a>')


def ranger_outil(c):
    ct = c.execute("SELECT content FROM pages WHERE slug='scripts'").fetchone()[0]
    if SLUG in ct:
        return 'déjà présent'
    i = ct.index('id="sec-reseau"')
    j = ct.index('</div></section>', i)
    ct = ct[:j] + CARTE + ct[j:]
    sec = ct[i:ct.index('</section>', i)]
    n = sec.count('<a class="script-card"')
    ct = ct[:i] + re.sub(r'<span class="sc-count">\d+</span>', f'<span class="sc-count">{n}</span>', sec, count=1) + ct[i + len(sec):]
    ct = re.sub(r'(<a class="sc-chip" href="#sec-reseau">.*?<span class="sc-n">)\d+(</span>)',
                lambda m: m.group(1) + str(n) + m.group(2), ct, count=1, flags=re.S)
    total = ct.count('<a class="script-card"') + ct.count('class="sc-feat"')
    ct = re.sub(r'<p class="meta">\d+ outils\.', f'<p class="meta">{total} outils.', ct, count=1)
    c.execute("UPDATE pages SET content=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug='scripts'", (ct,))
    return f'carte ajoutée (section {n}, total {total})'


if __name__ == '__main__':
    c = sqlite3.connect(BASE)
    print(SLUG, ':', publier(c, SLUG, TITRE, EXTRAIT, CONTENU))
    print('outils :', ranger_outil(c).encode('ascii', 'replace').decode())
    c.commit()
    c.close()
    sys.exit(0)

# -*- coding: utf-8 -*-
"""
Page « Configurateur — pfSense » : à partir des interfaces (WAN/LAN/OPT), du
DHCP, des alias, des redirections NAT et des règles, produit le plan de
configuration de l'interface web pfSense ET le config.xml par zone (restaurable
via « Restore area »). Îlot React `PfsenseConfigurator`
(data-block "pfsense-configurator").

IDEMPOTENT.
"""
import re
import sqlite3
import sys

from _cours import BASE, STYLE, hero, note, publier, tab

SLUG = 'configurateur-pfsense'
TITRE = 'Configurateur — pfSense'

EXTRAIT = ('Décris tes interfaces (WAN/LAN/OPT), le DHCP, les alias, les redirections NAT et les '
           'règles : obtiens le plan de configuration pfSense pas à pas, et le config.xml par zone à '
           'restaurer (Restore area).')

CONTENU = '\n'.join([
    hero('Outil · Réseau', TITRE,
         'pfSense se configure par son interface web — et sait restaurer une configuration <strong>'
         'zone par zone</strong>. Cet outil écrit le plan pas à pas (menu + valeur de chaque champ) '
         'et le <strong>config.xml</strong> de chaque zone, prêt à restaurer.'),
    STYLE,
    '<p>À partir de <em>ton</em> adressage, l’outil déroule le <strong>plan de configuration</strong> '
    'section par section (interfaces, DHCP, alias, NAT, règles) avec le chemin de menu pfSense et la '
    'valeur de chaque champ — et, en bonus, le <strong>config.xml par zone</strong> que pfSense sait '
    'réimporter d’un coup (<code>Diagnostics ▸ Backup &amp; Restore ▸ Restore area</code>). C’est le '
    'même outil que le <a href="/pages/configurateur-opnsense">configurateur OPNsense</a>, en '
    'dialecte pfSense. Pour approfondir OPNsense (très proche) : la série '
    '<a href="/pages/opnsense">OPNsense</a> et les '
    '<a href="/pages/tp-opnsense-nat">TP</a> ; le VPN : '
    '<a href="/pages/openvpn-pfsense">OpenVPN sur pfSense</a>.</p>',

    '<h2>Ce que l’outil produit</h2>',
    tab(['Section', 'Menu pfSense', 'Ce qu’elle règle'], [
        ['① Interfaces', '<code>Interfaces ▸ Assignments</code> puis <code>WAN/LAN/OPT1</code>',
         'Association carte→zone, activation, type d’adressage, IP/masque, passerelle (WAN)'],
        ['② DHCP', '<code>Services ▸ DHCP Server ▸ [zone]</code>',
         'Plage distribuée, DNS et passerelle poussés aux clients'],
        ['③ Alias', '<code>Firewall ▸ Aliases</code>', 'Regrouper réseaux/hôtes/ports sous un nom'],
        ['④ NAT', '<code>Firewall ▸ NAT ▸ Port Forward</code>',
         'Publier un service interne + la règle de filtrage associée'],
        ['⑤ Règles', '<code>Firewall ▸ Rules ▸ [zone]</code>', 'Autoriser / bloquer, dans le bon ordre'],
        ['⑥ Système', '<code>System ▸ General Setup</code>', 'Hostname, domaine, serveurs DNS, fuseau horaire'],
        ['⑦ Passerelles &amp; routes', '<code>System ▸ Routing</code>', 'La passerelle WAN et les routes statiques vers d’autres réseaux'],
        ['⑧ VPN OpenVPN', '<code>VPN ▸ OpenVPN</code>', 'Un accès nomade (Remote Access) : certificats, tunnel, split tunnel, export du profil'],
        ['🧩 config.xml', '<code>Diagnostics ▸ Backup &amp; Restore ▸ Restore area</code>',
         'Le XML de chaque zone (Aliases, DHCP, NAT, Firewall Rules) à restaurer d’un coup'],
    ]),

    '<div data-block="pfsense-configurator"></div>',

    '<h2>Deux façons de l’appliquer</h2>',
    '<p><strong>À la main (sûr) :</strong> suis le plan, section par section, et '
    '<strong>Save puis Apply Changes</strong>. <strong>Rapide (config.xml) :</strong> pour chaque '
    'zone, copie le bloc XML, va dans <code>Diagnostics ▸ Backup &amp; Restore</code>, choisis '
    '<em>Restore area</em> = la zone correspondante, colle/téléverse, Restore.</p>',
    note('yellow', '⚠️ Les interfaces d’abord, à la main',
         'Le config.xml par zone <strong>n’inclut pas les interfaces</strong> : les noms de cartes '
         '(<code>hn0</code>, <code>em0</code>, <code>vtnet0</code>…) dépendent de ta machine, une '
         'restauration à l’aveugle casserait l’accès. Fais l’<strong>assignation et l’adressage des '
         'interfaces avec le plan ①</strong>, puis restaure les autres zones. Et vérifie toujours '
         'après restauration.'),
    note('gray', '🔁 NAT et règle associée',
         'Une redirection de port (<em>où</em> envoyer) ne suffit pas sans la <strong>règle de '
         'filtrage</strong> qui l’autorise : le plan coche « Add associated filter rule », et le '
         'config.xml NAT est pensé pour aller avec. Détail : '
         '<a href="/pages/tp-opnsense-nat">le TP NAT</a> (OPNsense, mais identique en principe).'),
])

CARTE = ('<a class="script-card" href="/pages/configurateur-pfsense"><div class="sc-top">'
         '<span class="sc-ico">🧱</span><span class="sc-badge sc-badge-int">⚡ Interactif</span></div>'
         '<div class="sc-title">Configurateur — pfSense</div>'
         '<div class="sc-desc meta">Outil interactif : interfaces (WAN/LAN/OPT), DHCP, alias, NAT et '
         'règles → le plan de configuration pfSense pas à pas, et le config.xml par zone à restaurer '
         '(Restore area).</div>'
         '<div class="sc-tags"><span class="sc-pill">Réseau</span><span class="sc-pill">Pare-feu</span>'
         '<span class="sc-pill">pfSense</span></div></a>')


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

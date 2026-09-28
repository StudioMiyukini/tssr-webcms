# -*- coding: utf-8 -*-
"""
Page « Configurateur — VPN IPsec & OpenVPN (OPNsense / pfSense) » : à partir des
endpoints WAN, de la PSK, des paramètres Phase 1 / Phase 2 et des réseaux, produit
le plan de configuration d'un tunnel IPsec site-à-site (dans les deux sens, l'un
miroir de l'autre) ; ou, en mode OpenVPN, le plan d'un serveur d'accès nomade.
Îlot React `VpnConfigurator` (data-block "vpn-configurator"). Même famille que les
configurateurs OPNsense / pfSense.

IDEMPOTENT.
"""
import re
import sqlite3
import sys

from _cours import BASE, STYLE, hero, note, tab
from _cours import publier

SLUG = 'configurateur-vpn'
TITRE = 'Configurateur — VPN IPsec & OpenVPN (OPNsense / pfSense)'

EXTRAIT = ('Saisis les endpoints WAN, la clé pré-partagée, les paramètres Phase 1 / Phase 2 et les '
           'réseaux : obtiens le plan d’un tunnel IPsec site-à-site (avec le miroir de l’autre bout) '
           'ou d’un serveur OpenVPN d’accès nomade — dialecte OPNsense ou pfSense, menu par menu.')

CONTENU = '\n'.join([
    hero('Outil · Réseau / Sécurité', TITRE,
         'Deux endpoints WAN, une clé, les réseaux de chaque site — et le plan complet d’un tunnel '
         '<strong>IPsec site-à-site</strong> : Phase 1, Phase 2, règles de pare-feu, et le miroir à '
         'appliquer sur l’autre boîtier. Ou, en un onglet, le plan d’un serveur '
         '<strong>OpenVPN</strong> d’accès nomade. Dialecte OPNsense ou pfSense.'),
    STYLE,
    '<p>Relier deux agences par IPsec, c’est deux boîtiers configurés <strong>à l’identique au bit '
    'près</strong> en Phase 1, avec les réseaux <em>inversés</em> en Phase 2 — et les règles qui '
    'laissent passer ISAKMP et ESP, sans quoi le tunnel monte mais rien ne circule. Cet outil part '
    'de ton arbitrage d’adressage et écrit les deux côtés, cohérents. L’onglet OpenVPN produit, lui, '
    'le serveur d’accès nomade (SSL/TLS, réseau du tunnel, réseaux poussés). Il complète les '
    '<a href="/pages/configurateur-pfsense">configurateurs pfSense</a> et '
    '<a href="/pages/configurateur-opnsense">OPNsense</a>, qui couvrent interfaces, DHCP, NAT et '
    'règles. La théorie et le pas à pas : '
    '<a href="/pages/procedure-vpn-ipsec-pfsense">VPN IPsec site-à-site</a>, '
    '<a href="/pages/le-vpn">le VPN</a>.</p>',

    '<h2>Ce que l’outil produit</h2>',
    tab(['Mode', 'Sections', 'Ce qu’il écrit'], [
        ['IPsec site-à-site', 'Phase 1 · Phase 2 · Règles · Miroir',
         'Phase 1 (IKE, remote gateway, PSK mutuelle, chiffrement/hash/DH), une entrée Phase 2 par '
         'couple de réseaux (local ↔ distant, ESP, PFS), les règles WAN (ISAKMP 500/4500 + ESP) et '
         'IPsec, et le <strong>rappel du miroir</strong> à poser sur l’autre pare-feu'],
        ['OpenVPN nomade', 'Serveur · Règles',
         'Le serveur Remote Access (SSL/TLS, éventuellement + compte), le réseau du tunnel, les '
         'réseaux internes poussés, et les règles WAN + OpenVPN — plus le rappel de l’export .ovpn'],
    ]),

    '<div data-block="vpn-configurator"></div>',

    '<h2>Le piège classique</h2>',
    note('yellow', '⚠️ Phase 1 identique, Phase 2 inversée',
         'Un tunnel IPsec ne monte que si la <strong>Phase 1 est identique des deux côtés</strong> : '
         'même version IKE, même chiffrement, même hash, même groupe DH, même PSK. Un seul paramètre '
         'qui diffère et la négociation échoue « en silence ». En <strong>Phase 2</strong>, au '
         'contraire, les réseaux local et distant sont <strong>inversés</strong> d’un bout à l’autre. '
         'L’outil met ce miroir en évidence.'),
    note('gray', '🔗 Dans l’atelier aussi',
         'Un pare-feu pfSense / OPNsense posé dans l’<a href="/pages/atelier-reseau">atelier réseau</a> '
         'génère désormais son plan de configuration (interfaces, DHCP, NAT, règles) depuis la '
         'topologie, dans la vue « Par matériel ». Ce configurateur-ci se concentre sur les tunnels.'),
])

# ── carte dans le hub Outils (section Réseau) ─────────────────────────────────
CARTE = ('<a class="script-card" href="/pages/configurateur-vpn"><div class="sc-top">'
         '<span class="sc-ico">🔐</span><span class="sc-badge sc-badge-int">⚡ Interactif</span></div>'
         '<div class="sc-title">Configurateur — VPN IPsec & OpenVPN</div>'
         '<div class="sc-desc meta">Outil interactif : le plan d’un tunnel IPsec site-à-site '
         '(Phase 1 / Phase 2, règles, miroir de l’autre bout) ou d’un serveur OpenVPN nomade — '
         'dialecte OPNsense ou pfSense, menu par menu.</div>'
         '<div class="sc-tags"><span class="sc-pill">Réseau</span><span class="sc-pill">VPN</span>'
         '<span class="sc-pill">IPsec</span><span class="sc-pill">pfSense</span>'
         '<span class="sc-pill">OPNsense</span></div></a>')

RENVOI_PROC = ('<aside class="pb-note pb-note-blue"><p class="pb-note-title">⚡ Le générer d’un coup</p>'
               '<p>Une fois la méthode comprise, le '
               '<a href="/pages/configurateur-vpn">configurateur VPN</a> écrit le plan Phase 1 / '
               'Phase 2 + règles à partir de tes endpoints et réseaux — pour les deux bouts, l’un '
               'miroir de l’autre.</p></aside>')


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


def renvoi_proc(c):
    row = c.execute("SELECT content FROM pages WHERE slug='procedure-vpn-ipsec-pfsense'").fetchone()
    if not row:
        return 'procedure-vpn-ipsec-pfsense absente'
    ct = row[0]
    if SLUG in ct:
        return 'déjà présent'
    ct = ct + '\n' + RENVOI_PROC
    c.execute("UPDATE pages SET content=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug='procedure-vpn-ipsec-pfsense'", (ct,))
    return 'renvoi ajouté'


if __name__ == '__main__':
    c = sqlite3.connect(BASE)
    print(SLUG, ':', publier(c, SLUG, TITRE, EXTRAIT, CONTENU))
    print('outils :', ranger_outil(c).encode('ascii', 'replace').decode())
    print('proc :', renvoi_proc(c).encode('ascii', 'replace').decode())
    c.commit()
    c.close()
    sys.exit(0)

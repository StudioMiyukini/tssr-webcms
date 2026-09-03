# -*- coding: utf-8 -*-
"""
Range les nouvelles pages dans les index « cours » et « tp ».

DEUX INDEX, DEUX BALISAGES DIFFÉRENTS.
`cours` utilise des `<details class="crs-domain">` repliables avec des
sous-groupes ; `tp` utilise les mêmes `pd-sec` / `dir-card` que l'index des
procédures. On respecte l'un et l'autre plutôt que d'uniformiser au passage.

LES COMPTEURS SONT RECALCULÉS DEPUIS LES CARTES RÉELLES, à chaque niveau :
sous-groupe, catégorie, pastille du sommaire et total en tête. Les saisir à la
main revient à programmer leur divergence.

IDEMPOTENT.
"""
import io
import re
import sqlite3
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent / 'cms.sqlite'
ORANGE = '#f59e0b'  # la couleur de la catégorie Linux, reprise telle quelle

# ── index « cours » : deux cartes dans Linux → Services ─────────────────
COURS = [
    ('linux-apache-virtualhosts', 'Apache : hôtes virtuels &amp; HTTPS',
     'Comment Apache choisit le site : IP, port, nom. Site par défaut, DirectoryIndex, '
     'ErrorDocument, restriction par IP, alias IP et certificat SSL.'),
    ('linux-proftpd', 'FTP : le serveur ProFTPd',
     'Les deux canaux (21/20), modes actif et passif, DefaultRoot et le cloisonnement, '
     'connexions anonymes — et pourquoi SFTP est le choix par défaut.'),
]

# ── index « tp » : une section neuve ────────────────────────────────────
TP_SECTION_ID = 'sec-web-ftp'
TP_SECTION_TITRE = '🌍 Web &amp; FTP (Linux/Debian)'
TP_CHIP = '🌍 Web &amp; FTP'
TP_CARTES = [
    ('tp-apache-recherche', '🔎', 'Apache — Recherche préalable',
     'Les trois questions corrigées : DirectoryIndex pour la page d’ouverture, ErrorDocument pour '
     'les erreurs, et la mise en place d’un site en HTTPS.'),
    ('tp-apache-virtualhosts', '🌐', 'Apache — Hôtes virtuels',
     'Site par défaut, port 8080, restriction à une IP cliente, site sur une adresse dédiée avec '
     'alias IP, domaine réel, zones DNS et site en 443.'),
    ('tp-proftpd', '📁', 'ProFTPd — Serveur FTP',
     'Ce qu’un utilisateur peut faire sans DefaultRoot, l’accès anonyme, welcome.msg, le '
     'déplacement du point d’arrivée et webadmin dans /var/www.'),
]


def carte_cours(slug, titre, desc):
    return (f'<a class="crs-card" style="border-left-color:{ORANGE}" href="/pages/{slug}">'
            f'<div class="crs-ct">{titre}<span class="crs-a">→</span></div>'
            f'<div class="crs-cd">{desc}</div></a>')


def carte_tp(slug, icone, titre, desc):
    return (f'\n<a class="dir-card" href="/pages/{slug}"><div class="dc-ico">{icone}</div>'
            f'<div class="dc-body"><div class="dc-title">{titre}</div>'
            f'<div class="dc-desc meta">{desc}</div></div><div class="dc-go">Voir →</div></a>')


def maj_cours(html):
    m = re.search(r'<details class="crs-domain" id="cat-linux".*?</details>', html, re.S)
    if not m:
        return None, 'catégorie Linux introuvable'
    bloc = m.group(0)

    nouvelles = ''.join(carte_cours(*x) for x in COURS if f'href="/pages/{x[0]}"' not in bloc)
    if nouvelles:
        # Le dernier sous-groupe (« Services ») se termine juste avant le
        # pied de catégorie : on insère à la fin de sa grille.
        ancre = '</div><div class="crs-back">'
        if ancre not in bloc:
            return None, 'pied de la catégorie Linux introuvable'
        i = bloc.rindex(ancre)
        bloc = bloc[:i] + nouvelles + bloc[i:]

    # Compteurs des sous-groupes : on découpe sur les en-têtes, chaque morceau
    # ne contient plus que les cartes de SON groupe.
    morceaux = bloc.split('<div class="crs-sub"')
    for k in range(1, len(morceaux)):
        n = morceaux[k].count('<a class="crs-card"')
        morceaux[k] = re.sub(r'(<span class="crs-subn">)\d+(</span>)',
                             lambda t: t.group(1) + str(n) + t.group(2), morceaux[k], count=1)
    bloc = '<div class="crs-sub"'.join(morceaux)

    total_cat = bloc.count('<a class="crs-card"')
    bloc = re.sub(r'<span class="crs-b">\d+ cours</span>',
                  f'<span class="crs-b">{total_cat} cours</span>', bloc, count=1)

    html = html[:m.start()] + bloc + html[m.end():]

    # Pastille du sommaire pour cette catégorie.
    html = re.sub(r'(<a class="crs-chip" href="#cat-linux">.*?<span class="crs-n">)\d+(</span>)',
                  lambda t: t.group(1) + str(total_cat) + t.group(2), html, count=1, flags=re.S)

    # Total en tête, recalculé sur toutes les catégories.
    total = sum(b.count('<a class="crs-card"')
                for b in re.findall(r'<details class="crs-domain".*?</details>', html, re.S))
    cats = len(re.findall(r'<details class="crs-domain"', html))
    html, n = re.subn(r'\d+ cours dans \d+ catégories',
                      f'{total} cours dans {cats} catégories', html, count=1)
    if n != 1:
        return None, 'total en tête non retrouvé'
    return html, f'Linux : {total_cat} cours — total {total} dans {cats} catégories'


def maj_tp(html):
    if f'id="{TP_SECTION_ID}"' not in html:
        section = (f'\n\n<section class="pd-sec" id="{TP_SECTION_ID}">'
                   f'<h2 class="pd-h">{TP_SECTION_TITRE} <span class="pd-count">0</span></h2>'
                   f'<div class="pd-grid">' + ''.join(carte_tp(*x) for x in TP_CARTES)
                   + '\n</div></section>')
        # La page se termine par la dernière section, puis la fermeture du
        # conteneur `.dir` : on s'insère juste avant.
        i = html.rindex('</section>') + len('</section>')
        html = html[:i] + section + html[i:]

        chip = (f'\n<a class="pd-chip" href="#{TP_SECTION_ID}">{TP_CHIP} '
                f'<span class="pd-n">0</span></a>')
        j = html.index('</nav>')
        html = html[:j] + chip + html[j:]

    comptes = {}
    for m in re.finditer(r'<section class="pd-sec" id="(sec-[^"]+)">(.*?)</section>', html, re.S):
        comptes[m.group(1)] = len(re.findall(r'<a class="dir-card"', m.group(2)))

    html = re.sub(r'<section class="pd-sec" id="(sec-[^"]+)">.*?</section>',
                  lambda m: re.sub(r'(<span class="pd-count">)\d+(</span>)',
                                   lambda t: t.group(1) + str(comptes[m.group(1)]) + t.group(2),
                                   m.group(0), count=1), html, flags=re.S)
    html = re.sub(r'<a class="pd-chip" href="#(sec-[^"]+)">.*?</a>',
                  lambda m: re.sub(r'(<span class="pd-n">)\d+(</span>)',
                                   lambda t: t.group(1) + str(comptes.get(m.group(1), 0)) + t.group(2),
                                   m.group(0), count=1), html, flags=re.S)

    # Le chapô du hero énumère les domaines : il doit suivre.
    html = html.replace(
        'Les travaux pratiques du parcours, corrigés : DNS/BIND9, VLAN Cisco, Active Directory '
        '&amp; Windows.',
        'Les travaux pratiques du parcours, corrigés : DNS/BIND9, VLAN Cisco, Active Directory '
        '&amp; Windows, Apache &amp; FTP.')
    return html, ' — '.join(f'{k}:{v}' for k, v in comptes.items())


def main():
    c = sqlite3.connect(BASE)
    rapport = []
    for slug, fonction in (('cours', maj_cours), ('tp', maj_tp)):
        ligne = c.execute('SELECT content FROM pages WHERE slug=?', (slug,)).fetchone()
        if not ligne:
            print(f'page {slug} introuvable', file=sys.stderr)
            return 1
        io.open(str(BASE.parent / f'{slug}.avant.html'), 'w', encoding='utf-8').write(ligne[0])
        neuf, info = fonction(ligne[0])
        if neuf is None:
            print(f'{slug} : {info}', file=sys.stderr)
            return 1
        c.execute("UPDATE pages SET content=?,"
                  " updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug=?", (neuf, slug))
        rapport.append(f'{slug} : {info}')
    c.commit()
    c.close()
    print('\n'.join(rapport).encode('ascii', 'replace').decode('ascii'))
    return 0


if __name__ == '__main__':
    sys.exit(main())

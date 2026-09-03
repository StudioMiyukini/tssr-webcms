# -*- coding: utf-8 -*-
"""
Ce qui est commun aux volets du cours OPNsense.

POURQUOI UN MODULE PARTAGÉ
La série compte cinq volets. Sans cet endroit unique, la feuille de style, le
bandeau de navigation et le rangement dans l'index seraient recopiés cinq fois —
et diveregeraient au premier changement. Ici, ajouter un volet, c'est ajouter une
ligne à VOLETS ; le bandeau des volets déjà publiés se met à jour tout seul au
prochain passage du script.

LE BANDEAU DIT AUSSI CE QUI N'EXISTE PAS ENCORE : les volets à venir y figurent
en gris, sans lien. C'est plus honnête qu'une série qui s'arrête sans prévenir,
et ça évite les liens morts.
"""
import re

# (slug, numéro, libellé court, publié ?)
VOLETS = [
    ('opnsense', 1, 'Découverte', True),
    ('opnsense-nat', 2, 'NAT', True),
    ('opnsense-services', 3, 'DHCP &amp; DNS', True),
    ('opnsense-segmentation', 4, 'Segmentation', True),
    ('opnsense-vpn-ids', 5, 'VPN &amp; IDS', True),
]

VERT = '#059669'  # la couleur de la catégorie Réseau dans l'index des cours

STYLE = ("<style>.lx-cmd{font-family:ui-monospace,'Space Mono',monospace;"
         "background:var(--surface-2);border:1px solid var(--border);border-radius:8px;"
         "padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;"
         "font-size:12.5px;line-height:1.55}"
         ".lx-tab{border-collapse:collapse;width:100%;margin:10px 0}"
         ".lx-tab td,.lx-tab th{padding:6px 9px;border:1px solid var(--border);"
         "text-align:left;font-size:12.5px;vertical-align:top}"
         ".lx-tab th{color:var(--text-muted);background:var(--surface-2)}"
         # Un tableau à trois colonnes denses ne peut pas descendre sous sa
         # largeur minimale : sur un écran étroit il pousserait toute la page.
         # On le fait défiler DANS SA PROPRE BOÎTE plutôt que de laisser le
         # corps de page déborder — la lecture reste possible, le reste ne bouge pas.
         "@media (max-width:640px){.lx-tab{display:block;overflow-x:auto;-webkit-overflow-scrolling:touch}}"
         ".lx-nav{font-family:ui-monospace,'Space Mono',monospace;font-size:12.5px;"
         "font-weight:600;background:var(--surface-3);border:1px solid var(--border);"
         "border-radius:6px;padding:1px 7px;white-space:nowrap}"
         # Le bandeau de série : des pastilles qui tiennent sur une ligne et
         # passent à la ligne d'elles-mêmes sur un écran étroit.
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
         "background:color-mix(in srgb,var(--accent) 8%,var(--surface))}"
         ".ops-v.ops-futur{opacity:.5;font-weight:500}</style>")


def menu(t):
    """Un chemin de menu de l'interface web, balisé pour se repérer d'un coup d'œil."""
    return f'<span class="lx-nav">{t}</span>'


def note(couleur, titre, *paras):
    return (f'<aside class="pb-note pb-note-{couleur}"><p class="pb-note-title">{titre}</p>'
            + ''.join(f'<p>{p}</p>' for p in paras) + '</aside>')


def acc(*items):
    corps = ''.join(f'<details class="pb-acc"><summary>{t}</summary>'
                    f'<div class="pb-acc-body">{c}</div></details>' for t, c in items)
    return f'<div class="pb-accordion">{corps}</div>'


def bandeau(slug_actuel):
    """Le fil des volets, avec le volet courant mis en avant et les à-venir en gris."""
    pastilles = []
    for slug, num, libelle, publie in VOLETS:
        n = f'<span class="ops-n">{num}</span>'
        if slug == slug_actuel:
            pastilles.append(f'<span class="ops-v ops-ici">{n}{libelle}</span>')
        elif publie:
            pastilles.append(f'<a class="ops-v" href="/pages/{slug}">{n}{libelle}</a>')
        else:
            pastilles.append(f'<span class="ops-v ops-futur" title="À venir">{n}{libelle}</span>')
    return ('<nav class="ops-serie" aria-label="Les volets du cours OPNsense">'
            '<span class="ops-t">Cours en 5 volets</span>' + ''.join(pastilles) + '</nav>')


def ranger_dans_index(html, slug, titre, description, sous_groupe='Équipements',
                      categorie='cat-reseau'):
    """
    Ajoute (ou laisse en place) la carte du cours dans l'index « cours », puis
    recalcule TOUS les compteurs depuis les cartes réellement présentes :
    sous-groupes, badge de catégorie, pastille du sommaire et total en tête.
    """
    m = re.search(r'<details class="crs-domain" id="%s".*?</details>' % re.escape(categorie),
                  html, re.S)
    if not m:
        return None, f'catégorie {categorie} introuvable'
    bloc = m.group(0)

    if f'href="/pages/{slug}"' not in bloc:
        carte = (f'<a class="crs-card" style="border-left-color:{VERT}" href="/pages/{slug}">'
                 f'<div class="crs-ct">{titre}<span class="crs-a">→</span></div>'
                 f'<div class="crs-cd">{description}</div></a>')
        morceaux = bloc.split('<div class="crs-sub"')
        cible = next((k for k in range(1, len(morceaux)) if sous_groupe in morceaux[k][:160]), None)
        if cible is None:
            return None, f'sous-groupe {sous_groupe} introuvable'
        fin = morceaux[cible].rstrip()
        if not fin.endswith('</div>'):
            return None, 'fin du sous-groupe inattendue'
        morceaux[cible] = fin[:-len('</div>')] + carte + '</div>'
        bloc = '<div class="crs-sub"'.join(morceaux)

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
    html = re.sub(r'(<a class="crs-chip" href="#%s">.*?<span class="crs-n">)\d+(</span>)'
                  % re.escape(categorie),
                  lambda t: t.group(1) + str(total_cat) + t.group(2), html, count=1, flags=re.S)

    total = sum(b.count('<a class="crs-card"')
                for b in re.findall(r'<details class="crs-domain".*?</details>', html, re.S))
    cats = len(re.findall(r'<details class="crs-domain"', html))
    html, n = re.subn(r'\d+ cours dans \d+ catégories',
                      f'{total} cours dans {cats} catégories', html, count=1)
    if n != 1:
        return None, 'total en tête non retrouvé'
    return html, f'{categorie} : {total_cat} — total {total}'


def publier(c, slug, titre, extrait, contenu):
    """Écrit la page (création ou mise à jour) et renvoie ce qui a été fait."""
    if c.execute('SELECT 1 FROM pages WHERE slug=?', (slug,)).fetchone():
        c.execute("UPDATE pages SET title=?, excerpt=?, content=?, published=1,"
                  " updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug=?",
                  (titre, extrait, contenu, slug))
        return 'maj'
    c.execute("INSERT INTO pages (title, slug, content, excerpt, builder_json, published,"
              " created_at, updated_at) VALUES (?,?,?,?,'',1,"
              " strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
              (titre, slug, contenu, extrait))
    return 'creation'

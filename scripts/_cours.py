# -*- coding: utf-8 -*-
"""
Socle commun des scripts de cours : gabarit de page, rangement dans l'index.

POURQUOI UN MODULE DE PLUS
`opnsense_serie.py` fournit le style et les briques (note, accordéon, menu) et
`ranger_dans_index` sait poser une carte dans un sous-groupe EXISTANT. Le plan
REAC 2026 demande des catégories et des sous-groupes qui n'existent pas encore
(IA, cloud & identité hybride, le titre, continuité…). Ce module sait les créer,
puis range la carte n'importe où — y compris dans le dernier sous-groupe d'une
catégorie, cas que `ranger_dans_index` ne gérait pas.

IDEMPOTENT : une catégorie, un sous-groupe ou une carte déjà présents ne sont
pas recréés ; les compteurs sont toujours recalculés depuis les cartes réelles.
"""
import re
import sqlite3
from pathlib import Path

from opnsense_serie import STYLE, acc, menu, note, publier  # noqa: F401 (réexportés)

BASE = Path(__file__).resolve().parent.parent / 'cms.sqlite'


def hero(pill, titre, sous):
    return (f'<section class="hero"><span class="pill">{pill}</span><h1>{titre}</h1>'
            f'<p>{sous}</p></section>')


def cmd(t):
    return f'<div class="lx-cmd">{t}</div>'


def tab(entetes, lignes):
    th = ''.join(f'<th>{h}</th>' for h in entetes)
    tr = ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in l) + '</tr>' for l in lignes)
    return f'<table class="lx-tab"><tr>{th}</tr>{tr}</table>'


def steps(*items):
    return '<ol class="proc-steps">' + ''.join(f'<li>{i}</li>' for i in items) + '</ol>'


def bullets(*items):
    return '<ul class="proc-steps">' + ''.join(f'<li>{i}</li>' for i in items) + '</ul>'


def retenir(*items):
    return '<h2>✅ À retenir</h2>' + bullets(*items)


# ══════════════════════════════════════════════════ l'index des cours ══

def _esc(s):
    return re.escape(s)


def ajouter_categorie(html, cat_id, emoji, titre, intro, couleur):
    """Une catégorie repliable en fin d'index, et sa pastille dans le sommaire."""
    if f'id="{cat_id}"' in html:
        return html
    bloc = (f'\n<details class="crs-domain" id="{cat_id}" open><summary class="crs-dhead" '
            f'style="background:{couleur}"><span style="font-size:22px">{emoji}</span><div>'
            f'<div class="crs-t">{titre}</div><div class="crs-i">{intro}</div></div>'
            f'<span class="crs-b">0 cours</span><span class="crs-chev">⌄</span></summary>'
            f'<div class="crs-dbody"><div class="crs-back"><a href="#cours-top">↑ Sommaire</a></div>'
            f'</div></details>')
    i = html.rindex('</details>') + len('</details>')
    html = html[:i] + bloc + html[i:]
    chip = (f'<a class="crs-chip" href="#{cat_id}"><span class="crs-dot" style="background:{couleur}">'
            f'</span>{emoji} {titre}<span class="crs-n">0</span></a>')
    j = html.index('</div>', html.index('<div class="crs-nav"'))
    return html[:j] + chip + html[j:]


def ajouter_sous_groupe(html, cat_id, nom, couleur):
    """Un sous-groupe vide en fin de catégorie (avant le lien « Sommaire »)."""
    m = re.search(r'<details class="crs-domain" id="%s".*?</details>' % _esc(cat_id), html, re.S)
    if not m:
        raise RuntimeError(f'catégorie {cat_id} introuvable')
    bloc = m.group(0)
    if re.search(r'<div class="crs-sub"[^>]*>%s<span' % _esc(nom), bloc):
        return html
    sub = (f'<div class="crs-sub" style="border-color:{couleur};color:{couleur}">{nom}'
           f'<span class="crs-subn">0</span></div><div class="crs-grid"></div>')
    k = bloc.rindex('<div class="crs-back">')
    bloc = bloc[:k] + sub + bloc[k:]
    return html[:m.start()] + bloc + html[m.end():]


def recompter(html):
    """Sous-groupes, badges de catégorie, pastilles du sommaire, total en tête : depuis les cartes."""
    def par_cat(m):
        bloc = m.group(0)
        morceaux = bloc.split('<div class="crs-sub"')
        for k in range(1, len(morceaux)):
            n = morceaux[k].count('<a class="crs-card"')
            morceaux[k] = re.sub(r'(<span class="crs-subn">)\d+(</span>)',
                                 lambda t: t.group(1) + str(n) + t.group(2), morceaux[k], count=1)
        bloc = '<div class="crs-sub"'.join(morceaux)
        total = bloc.count('<a class="crs-card"')
        return re.sub(r'<span class="crs-b">\d+ cours</span>', f'<span class="crs-b">{total} cours</span>',
                      bloc, count=1)
    html = re.sub(r'<details class="crs-domain" id="[^"]+".*?</details>', par_cat, html, flags=re.S)
    totaux = {m.group(1): m.group(2).count('<a class="crs-card"')
              for m in re.finditer(r'<details class="crs-domain" id="([^"]+)"(.*?)</details>', html, re.S)}
    html = re.sub(r'(<a class="crs-chip" href="#([^"]+)">.*?<span class="crs-n">)\d+(</span>)',
                  lambda t: t.group(1) + str(totaux.get(t.group(2), 0)) + t.group(3), html, flags=re.S)
    return re.sub(r'\d+ cours dans \d+ catégories',
                  f'{sum(totaux.values())} cours dans {len(totaux)} catégories', html, count=1)


def ranger(html, cat_id, sous_groupe, slug, titre, description, couleur):
    """La carte du cours dans son sous-groupe (créé au besoin), sans doublon."""
    html = ajouter_sous_groupe(html, cat_id, sous_groupe, couleur)
    m = re.search(r'<details class="crs-domain" id="%s".*?</details>' % _esc(cat_id), html, re.S)
    bloc = m.group(0)
    if f'href="/pages/{slug}"' not in bloc:
        carte = (f'<a class="crs-card" style="border-left-color:{couleur}" href="/pages/{slug}">'
                 f'<div class="crs-ct">{titre}<span class="crs-a">→</span></div>'
                 f'<div class="crs-cd">{description}</div></a>')
        s = re.search(r'<div class="crs-sub"[^>]*>%s<span' % _esc(sous_groupe), bloc).start()
        fin = min(x for x in (bloc.find('<div class="crs-sub"', s + 10), bloc.find('<div class="crs-back">', s)) if x != -1)
        k = bloc.rindex('</div>', s, fin)          # la fermeture de la grille
        bloc = bloc[:k] + carte + bloc[k:]
    html = html[:m.start()] + bloc + html[m.end():]
    return recompter(html)


def retirer(html, slug):
    """Enlève la carte d'un cours, où qu'elle soit (pour la déplacer) ; recompte."""
    html = re.sub(r'<a class="crs-card"[^>]*href="/pages/%s">.*?</a>' % _esc(slug), '', html, flags=re.S)
    return recompter(html)


class Categorie:
    """Décrit où ranger un lot de cours : identifiant, apparence, couleur des cartes."""

    def __init__(self, cat_id, emoji, titre, intro, couleur):
        self.cat_id, self.emoji, self.titre, self.intro, self.couleur = cat_id, emoji, titre, intro, couleur


def publier_lot(pages, categorie, deplacer=()):
    """
    pages : liste de (slug, titre, extrait, contenu, sous_groupe, description).
    Écrit chaque page, crée la catégorie si besoin, range la carte, recompte.
    deplacer : slugs dont la carte existante est d'abord retirée (changement de sous-groupe).
    """
    c = sqlite3.connect(BASE)
    rapport = []
    idx = c.execute("SELECT content FROM pages WHERE slug='cours'").fetchone()[0]
    idx = ajouter_categorie(idx, categorie.cat_id, categorie.emoji, categorie.titre, categorie.intro, categorie.couleur)
    for slug in deplacer:
        idx = retirer(idx, slug)
    for slug, titre, extrait, contenu, sous_groupe, description in pages:
        etat = publier(c, slug, titre, extrait, contenu)
        idx = ranger(idx, categorie.cat_id, sous_groupe, slug, titre, description, categorie.couleur)
        rapport.append(f'{slug} : {etat} ({len(contenu)} car.)')
    c.execute("UPDATE pages SET content=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug='cours'", (idx,))
    c.commit()
    total = re.search(r'\d+ cours dans \d+ catégories', idx).group(0)
    c.close()
    print(('\n'.join(rapport) + f'\nindex : {total}').encode('ascii', 'replace').decode('ascii'))

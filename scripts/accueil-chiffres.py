# -*- coding: utf-8 -*-
"""
Contrôle les chiffres affichés en tête de la page d'accueil.

POURQUOI CE SCRIPT EXISTE
Le bandeau de mesures annonce « 86 cours, 57 procédures, 13 TP, 28 quiz ». Ces
valeurs sont écrites en dur dans le HTML — la page est statique. Elles vont donc
dériver au premier cours ajouté, et personne ne s'en apercevra : un chiffre faux
ne casse rien, il se contente de mentir.

Ici on les recalcule depuis la base et on signale l'écart. Sortie non nulle en
cas de divergence, pour pouvoir l'enchaîner après une publication.

  python scripts/accueil-chiffres.py          # contrôle
  python scripts/accueil-chiffres.py --ecrire # corrige la page et le script
"""
import io
import re
import sqlite3
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent / 'cms.sqlite'
SOURCE = Path(__file__).resolve().parent / 'accueil.py'


def compter(c):
    """Les quatre mesures, comptées là où elles sont réellement listées."""
    lire = lambda s: (c.execute('SELECT content FROM pages WHERE slug=?', (s,)).fetchone() or [''])[0]
    return {
        'cours': len(re.findall(r'<a class="crs-card"', lire('cours'))),
        'procédures': len(re.findall(r'<a class="dir-card"', lire('procedures'))),
        'TP corrigés': len(re.findall(r'<a class="dir-card"', lire('tp'))),
        'quiz': c.execute("SELECT count(*) FROM pages"
                          " WHERE published=1 AND slug LIKE 'quiz-%'").fetchone()[0],
    }


def affiches(c):
    """Ce que la page annonce, relu dans son HTML."""
    h = (c.execute("SELECT content FROM pages WHERE slug='accueil'").fetchone() or [''])[0]
    return {libelle: int(n) for n, libelle in
            re.findall(r'<span class="n">(\d+)</span><span class="l">([^<]+)</span>', h)}


def main():
    ecrire = '--ecrire' in sys.argv
    c = sqlite3.connect(BASE)
    reels, vus = compter(c), affiches(c)

    ecarts = []
    for libelle, n in reels.items():
        vu = vus.get(libelle)
        etat = 'ok' if vu == n else ('MANQUANT' if vu is None else f'affiche {vu}')
        if vu != n:
            ecarts.append((libelle, vu, n))
        print(f'  {libelle:<14} reel {n:>3}   {etat}')

    if not ecarts:
        print('\nles chiffres de la page d’accueil sont à jour')
        c.close()
        return 0

    if not ecrire:
        print(f'\n{len(ecarts)} ecart(s) — relancer avec --ecrire pour corriger',
              file=sys.stderr)
        c.close()
        return 1

    # On corrige la SOURCE, pas la base : la page se régénère ensuite par
    # accueil.py, sans quoi la correction serait effacée au prochain passage.
    s = io.open(SOURCE, encoding='utf-8').read()
    for libelle, _, n in ecarts:
        motif = r"\('\d+', '" + re.escape(libelle) + r"'"
        s, k = re.subn(motif, f"('{n}', '{libelle}'", s, count=1)
        if k != 1:
            print(f'mesure « {libelle} » introuvable dans accueil.py', file=sys.stderr)
            c.close()
            return 1
    io.open(SOURCE, 'w', encoding='utf-8').write(s)
    c.close()
    print(f'\n{len(ecarts)} mesure(s) corrigee(s) dans accueil.py — '
          f'relancer « python scripts/accueil.py » pour republier')
    return 0


if __name__ == '__main__':
    sys.exit(main())

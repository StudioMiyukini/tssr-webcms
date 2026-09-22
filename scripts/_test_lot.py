# -*- coding: utf-8 -*-
"""Rejoue un chantier sur une copie de la base et vérifie l'équilibre des balises."""
import importlib, re, sqlite3, sys, pathlib
s = sqlite3.connect('../cms.sqlite'); d = sqlite3.connect('../.smoke-test.sqlite'); s.backup(d); d.close(); s.close()
import _cours
_cours.BASE = pathlib.Path('../.smoke-test.sqlite').resolve()
mod = importlib.import_module(sys.argv[1])
lots = mod.LOTS if hasattr(mod, 'LOTS') else [(mod.PAGES, mod.CAT)]
for lot in lots:
    _cours.publier_lot(*lot)
c = sqlite3.connect(_cours.BASE)
idx = c.execute("select content from pages where slug='cours'").fetchone()[0]
for m in re.finditer(r'<details class="crs-domain" id="([^"]+)"(.*?)</details>', idx, re.S):
    subs = re.findall(r'<div class="crs-sub"[^>]*>(.*?)<span class="crs-subn">(\d+)', m.group(2))
    print(m.group(1), [(s.encode('ascii', 'replace').decode(), n) for s, n in subs])
for pages, *_ in lots:
    for slug, *_ in pages:
        ct = c.execute('select content from pages where slug=?', (slug,)).fetchone()[0]
        for t in ['table', 'div', 'ul', 'ol', 'aside', 'details', 'section', 'p', 'h2', 'h3', 'span', 'code', 'strong', 'a', 'li', 'tr', 'td', 'th', 'em']:
            o = len(re.findall(r'<%s[ >]' % t, ct)); f = ct.count('</%s>' % t)
            if o != f: print('  !! ', slug, t, o, f)
        for l in set(re.findall(r'href="/pages/([^"#]+)"', ct)):
            if not c.execute('select 1 from pages where slug=?', (l,)).fetchone(): print('  lien absent :', slug, '->', l)
print('verif ok')

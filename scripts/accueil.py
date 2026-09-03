# -*- coding: utf-8 -*-
"""
Reconstruit la page d'accueil sur les motifs de ui.miyukini.org.

LE BOGUE D'ORIGINE, ET POURQUOI LE CORRECTIF EST STRUCTUREL
Le rendu public assainit le HTML avec DOMPurify, qui parse la chaîne en document
puis ne conserve que le <body>. Or l'analyseur HTML range un <style> rencontré
AVANT tout contenu de corps dans le <head> : il était donc jeté en silence, et
la page s'affichait sans une seule de ses règles. D'où la page nue de la capture.
Ici le <style> vient APRÈS le hero — comme sur toutes les pages du site qui,
elles, n'ont jamais eu le problème.

POURQUOI DU HTML ET PAS LES COMPOSANTS REACT DU REGISTRE
ui.miyukini.org sert des composants React + Tailwind v4 via une CLI shadcn. Ce
CMS n'a ni Tailwind, ni shadcn, ni components.json : les installer imposerait
toute une chaîne d'outils, un build et un déploiement pour un défaut d'affichage.
On reprend donc les DÉCISIONS de conception des composants, transposées dans les
variables CSS du site — ce qui garde la page éditable depuis l'administration.

CE QUI VIENT DU REGISTRE, ET CE QUI A DÛ ÊTRE ADAPTÉ
  · grid-pattern   → un <pattern> SVG masqué en radial, pas un dégradé répété :
                     le trait reste net à tous les zooms.
  · bento-grid     → `grid-auto-rows: minmax(11rem, auto)`. La hauteur vient du
                     contenu ; une hauteur fixe casse dès que le texte déborde.
                     Une colonne sous 640 px : une grille asymétrique à 390 px
                     n'est plus une composition, c'est un empilement.
  · spotlight-card → le halo au survol. ADAPTATION : l'original suit le curseur
                     en écrivant --sx/--sy sur un événement de pointeur ;
                     DOMPurify retire tous les attributs on*, donc le halo est
                     ici centré et purement CSS. L'intention est gardée, le suivi
                     du curseur non — c'est le seul écart avec le composant.
  · stat-strip     → `gap: 1px` sur un conteneur au fond contrasté : l'espace EST
                     le filet séparateur. Et chiffres tabulaires, sans quoi un
                     compteur qui passe de 9 à 10 fait bouger toute la ligne.

LES DEUX ÎLOTS REACT SONT REPRIS TELS QUELS. `data-block="events"` et
`data-block="planning"` sont montés par RichContent : les retoucher casserait
l'agenda et le planning.

IDEMPOTENT.
"""
import sqlite3
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent / 'cms.sqlite'

# ── Le fond quadrillé du hero (motif grid-pattern) ─────────────────────
GRILLE = (
    '<svg class="pt-grille" aria-hidden="true">'
    '<defs><pattern id="pt-maille" width="44" height="44" patternUnits="userSpaceOnUse">'
    '<path d="M 44 0 L 0 0 0 44" fill="none" stroke="currentColor" stroke-width="1"/>'
    '</pattern></defs>'
    '<rect width="100%" height="100%" fill="url(#pt-maille)"/>'
    '</svg>')

# ── Le bandeau de chiffres (motif stat-strip) ──────────────────────────
# Les valeurs sont écrites ici plutôt que calculées à l'affichage : la page est
# du HTML statique. Le script `accueil-chiffres.py` les recalcule et signale
# l'écart, pour qu'elles ne dérivent pas en silence.
MESURES = [
    ('86', 'cours', 'classés par domaine', '/pages/cours'),
    ('57', 'procédures', 'pas-à-pas concrets', '/pages/procedures'),
    ('13', 'TP corrigés', 'DNS, VLAN, AD, Apache, FTP', '/pages/tp'),
    ('28', 'quiz', 'pour se tester', '/pages/exercices'),
]

# ── Les tuiles (motif bento-grid + spotlight-card) ─────────────────────
# (lien, icône, titre, badge, description, colonnes, rangées)
TUILES = [
    ('/pages/cours', '📚', 'Cours', '',
     'Le programme complet, classé par domaine : hardware, Windows &amp; Active Directory, réseau, '
     'Cisco, Linux. Notions, schémas et fiches — 86 cours, du binaire au pare-feu d’entreprise.',
     # Deux colonnes, UNE rangée. Le composant d'origine le dit : la hauteur vient
     # du contenu. Une tuile qui s'étend sur deux rangées avec trois lignes de
     # texte laisse un grand vide — c'est le travers que `auto-rows` évite.
     2, 1),
    ('/pages/procedures', '🧭', 'Procédures', '',
     'Pas-à-pas concrets : AD, DNS, DHCP, GPO, IIS, Cisco, Hyper-V, LVM, Samba…', 1, 1),
    ('/pages/simulateur-complet', '🖥️', 'Simulateur complet', 'Nouveau',
     'Bureau virtuel : Windows/AD/Hyper-V, cmd &amp; PowerShell, console routeur.', 1, 1),
    ('/pages/exercices', '🎯', 'Exercices', '',
     'S’entraîner : subnetting, quiz, TP corrigés et jeux.', 1, 1),
    ('/atelier', '🗺️', 'Atelier réseau', 'Appli',
     'Conçois un réseau Cisco complet et génère les configurations (VLSM, DHCP, DNS, SSH, NAT). '
     'Projets sauvegardés.', 2, 1),
    ('/pages/scripts', '⚙️', 'Outils', '',
     'Configurateurs &amp; générateurs : routeur Cisco, AD, IP/VLSM, DHCP…', 1, 1),
    ('/pages/depannage', '🩺', 'Dépannage', '',
     'Méthode couche par couche (OSI), diagnostics et corrections.', 1, 1),
    ('/glossaire', '📖', 'Glossaire', '',
     'Tous les acronymes et définitions du métier, en un coup d’œil.', 1, 1),
    ('/planning', '📅', 'Planning', '',
     'Le calendrier de la formation et les séances.', 1, 1),
    ('https://cv.miyukini.org', '📄', 'Créer un CV', 'Externe',
     'Mon assistant en ligne pour créer et mettre en forme des CV.', 1, 1),
]

DOMAINES = [
    ('🔧', 'Hardware'), ('💾', 'Windows &amp; AD'), ('🌐', 'Réseau'),
    ('📟', 'Cisco / Packet Tracer'), ('🐧', 'Linux'), ('🛠️', 'Maintenance &amp; support'),
    ('🇬🇧', 'Anglais pro'), ('💡', 'Astuces'),
]

STYLE = """<style>
/* ——— Hero ——— */
.pt-hero{position:relative;overflow:hidden;text-align:center;padding:44px 22px 34px;border:1px solid var(--border);border-radius:20px;background:var(--surface-2);margin:0 0 22px;color:var(--accent)}
.pt-grille{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:.17;-webkit-mask-image:radial-gradient(120% 90% at 30% 0%,#000 28%,transparent 76%);mask-image:radial-gradient(120% 90% at 30% 0%,#000 28%,transparent 76%)}
.pt-hero>*:not(.pt-grille){position:relative}
.pt-eyebrow{display:inline-block;font-size:11.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,transparent);border:1px solid color-mix(in srgb,var(--accent) 32%,transparent);padding:4px 13px;border-radius:999px;margin-bottom:15px}
.pt-hero h1{font-size:clamp(28px,4.8vw,44px);margin:0 0 12px;line-height:1.07;color:var(--text)}
.pt-hero h1 .dot{color:var(--accent)}
.pt-hero p.lead{font-size:clamp(14px,2vw,17px);color:var(--text-soft);max-width:660px;margin:0 auto 22px;line-height:1.6}
.pt-cta{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.pt-btn{display:inline-flex;align-items:center;gap:7px;padding:11px 21px;border-radius:11px;font-weight:700;font-size:14px;text-decoration:none;border:1px solid var(--accent);background:var(--accent);color:#fff;transition:transform .12s,box-shadow .12s}
.pt-btn:hover{transform:translateY(-2px);box-shadow:0 8px 22px color-mix(in srgb,var(--accent) 35%,transparent)}
.pt-btn.alt{background:transparent;color:var(--accent)}
.pt-btn.alt:hover{background:color-mix(in srgb,var(--accent) 10%,transparent);box-shadow:none}

/* ——— Bandeau de chiffres — l'espace de 1px EST le filet séparateur ——— */
.pt-stats{display:grid;grid-template-columns:1fr;gap:1px;margin:0 0 30px;padding:0;border:1px solid var(--border);border-radius:14px;overflow:hidden;background:var(--border)}
.pt-stat{display:flex;flex-direction:column;gap:2px;padding:15px 17px;background:var(--surface);text-decoration:none;color:var(--text);transition:background .12s}
.pt-stat:hover{background:var(--surface-2)}
.pt-stat .n{font-size:26px;font-weight:800;line-height:1.1;color:var(--accent);font-variant-numeric:tabular-nums}
.pt-stat .l{font-size:13.5px;font-weight:700}
.pt-stat .d{font-size:12px;color:var(--text-muted)}

/* ——— Sections ——— */
.pt-sec{margin:34px 0 15px}
.pt-sec h2{display:flex;align-items:center;gap:9px;font-size:20px;margin:0 0 3px}
.pt-sec p.sub{color:var(--text-muted);font-size:13px;margin:0}

/* ——— Grille bento : la hauteur vient du contenu, jamais d'une valeur fixe ——— */
.pt-grid{display:grid;grid-template-columns:1fr;gap:14px;grid-auto-rows:minmax(11rem,auto);grid-auto-flow:dense}
.pt-card{position:relative;overflow:hidden;display:flex;flex-direction:column;gap:8px;padding:19px 18px 16px;border:1px solid var(--border);border-radius:16px;background:var(--surface);text-decoration:none;color:var(--text);transition:transform .13s,border-color .13s,box-shadow .13s}
/* Le halo du spotlight-card. Centré et non suivi du curseur : les attributs
   on* sont retirés par l'assainisseur, donc aucun script ne peut le déplacer. */
.pt-card::before{content:"";position:absolute;inset:0;opacity:0;transition:opacity .3s;pointer-events:none;background:radial-gradient(260px circle at 50% 0%,color-mix(in srgb,var(--accent) 20%,transparent),transparent 70%)}
.pt-card:hover::before{opacity:1}
.pt-card:hover{transform:translateY(-3px);border-color:color-mix(in srgb,var(--accent) 55%,var(--border));box-shadow:0 12px 28px rgba(0,0,0,.13)}
.pt-card>*{position:relative}
.pt-card .ic{font-size:28px;line-height:1}
.pt-card .ti{font-weight:700;font-size:16px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.pt-card .de{font-size:13px;color:var(--text-muted);line-height:1.55}
.pt-card .go{margin-top:auto;padding-top:6px;font-size:12.5px;font-weight:700;color:var(--accent)}
.pt-badge{font-size:9.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#fff;background:var(--accent);border-radius:999px;padding:2px 8px}

/* ——— Domaines ——— */
.pt-doms{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(165px,1fr))}
.pt-dom{display:flex;align-items:center;gap:10px;padding:11px 13px;border:1px solid var(--border);border-radius:12px;background:var(--surface);text-decoration:none;color:var(--text);font-weight:600;font-size:13.5px;transition:border-color .12s,background .12s}
.pt-dom:hover{border-color:var(--accent);background:var(--surface-2)}
.pt-dom .ic{font-size:20px}

.pt-note{margin:34px 0 6px;text-align:center;font-size:12.5px;color:var(--text-muted);line-height:1.6}

/* Deux colonnes dès 640 px, trois dès 1024 px. En dessous, une seule : une
   grille asymétrique à 390 px n'est plus une composition. */
@media(min-width:640px){
  .pt-grid{grid-template-columns:repeat(2,1fr)}
  .pt-stats{grid-template-columns:repeat(2,1fr)}
  .pt-c2{grid-column:span 2}
  .pt-r2{grid-row:span 2}
}
@media(min-width:1024px){
  .pt-grid{grid-template-columns:repeat(3,1fr)}
  .pt-stats{grid-template-columns:repeat(4,1fr)}
}
</style>"""


def hero():
    return (
        '<div class="pt-hero">' + GRILLE +
        '<span class="pt-eyebrow">Mémo de formation</span>'
        '<h1>Portail de révision <span class="dot">TSSR</span></h1>'
        '<p class="lead">Cours, procédures, exercices et outils interactifs pour préparer le titre '
        '<strong>Technicien Supérieur Systèmes et Réseaux</strong> — hardware, Windows &amp; Active '
        'Directory, réseau, Cisco, Linux.</p>'
        '<div class="pt-cta">'
        '<a class="pt-btn" href="/pages/cours">📚 Explorer les cours</a>'
        '<a class="pt-btn alt" href="/pages/simulateur-complet">🖥️ Ouvrir le simulateur</a>'
        '</div></div>')


def stats():
    cases = ''.join(
        f'<a class="pt-stat" href="{lien}"><span class="n">{n}</span>'
        f'<span class="l">{libelle}</span><span class="d">{detail}</span></a>'
        for n, libelle, detail, lien in MESURES)
    return f'<div class="pt-stats">{cases}</div>'


def tuiles():
    cartes = []
    for lien, icone, titre, badge, desc, cols, rangs in TUILES:
        classes = 'pt-card' + (' pt-c2' if cols == 2 else '') + (' pt-r2' if rangs == 2 else '')
        b = f'<span class="pt-badge">{badge}</span>' if badge else ''
        # Un lien sortant s'ouvre ailleurs ; l'assainisseur y ajoutera rel="noopener".
        cible = ' target="_blank"' if lien.startswith('http') else ''
        cartes.append(
            f'<a class="{classes}" href="{lien}"{cible}><span class="ic">{icone}</span>'
            f'<span class="ti">{titre}{b}</span><span class="de">{desc}</span>'
            f'<span class="go">Ouvrir →</span></a>')
    return '<div class="pt-grid">' + ''.join(cartes) + '</div>'


def domaines():
    return ('<div class="pt-doms">' + ''.join(
        f'<a class="pt-dom" href="/pages/cours"><span class="ic">{i}</span>{n}</a>'
        for i, n in DOMAINES) + '</div>')


def section(titre, sous=None):
    s = f'<p class="sub">{sous}</p>' if sous else ''
    return f'<div class="pt-sec"><h2>{titre}</h2>{s}</div>'


CONTENU = '\n'.join([
    # Le hero D'ABORD : un <style> en tête de contenu est rangé dans le <head>
    # par l'analyseur, et l'assainisseur ne renvoie que le <body>. Voir l'en-tête.
    hero(),
    STYLE,
    stats(),
    section('🚀 Accès rapide', 'Les grandes sections du site.'),
    tuiles(),
    section('🧭 Domaines couverts', 'Ce que tu trouveras dans les cours.'),
    domaines(),
    section('📅 Agenda de la formation', 'Échéances, rendus et séances à venir.'),
    # Îlots React montés par RichContent — repris à l'identique.
    '<div class="pb-dynamic" data-block="events" data-count="8" data-title=""></div>',
    section('🗂️ Planning'),
    '<div class="pb-dynamic" data-block="planning" data-slug=""></div>',
    '<p class="pt-note">Ce site reprend la <strong>prise de notes de Van Jean NGUYEN</strong> '
    'pendant la formation<br>Technicien Supérieur Systèmes et Réseaux (TSSR).</p>',
])


def main():
    if CONTENU.lstrip().startswith('<style'):
        print('la page commencerait par <style> : son CSS serait supprime au rendu',
              file=sys.stderr)
        return 1

    c = sqlite3.connect(BASE)
    ancien = c.execute("SELECT content FROM pages WHERE slug='accueil'").fetchone()
    if not ancien:
        print('page accueil introuvable', file=sys.stderr)
        return 1
    Path(BASE.parent / 'accueil.avant.html').write_text(ancien[0], encoding='utf-8')

    # Les îlots doivent survivre à la reconstruction : on le vérifie au lieu de
    # l'espérer. Une page d'accueil sans agenda ni planning serait une régression
    # silencieuse.
    for ilot in ('data-block="events"', 'data-block="planning"'):
        if ilot in ancien[0] and ilot not in CONTENU:
            print(f'ilot perdu : {ilot}', file=sys.stderr)
            return 1

    c.execute("UPDATE pages SET content=?, published=1,"
              " updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug='accueil'", (CONTENU,))
    c.commit()
    c.close()
    print(f'accueil : reconstruite ({len(CONTENU)} car., avant {len(ancien[0])}) — '
          f'{len(TUILES)} tuiles, {len(MESURES)} mesures, 2 ilots preserves')
    return 0


if __name__ == '__main__':
    sys.exit(main())

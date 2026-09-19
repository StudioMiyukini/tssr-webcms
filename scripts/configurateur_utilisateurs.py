# -*- coding: utf-8 -*-
"""
Page « Configurateur — utilisateurs, groupes & droits » : à partir de listes de
groupes, d'utilisateurs (avec leurs groupes) et d'une arborescence annotée de
droits, produit un script qui crée les comptes et groupes, pose les dossiers et
fichiers, applique chown/chmod (récursif au besoin), plus un bloc de vérif.
Îlot React `UsersConfigurator` (data-block "users-configurator").

IDEMPOTENT.
"""
import re
import sqlite3
import sys

from _cours import BASE, STYLE, hero, note, publier, tab

SLUG = 'configurateur-utilisateurs'
TITRE = 'Configurateur — utilisateurs, groupes & droits'

EXTRAIT = ('Saisis tes groupes, tes utilisateurs (avec leurs groupes) et une arborescence annotée de '
           'droits : obtiens un script rejouable qui crée les comptes, pose les dossiers et fichiers '
           'et applique les droits propriétaire / groupe / autres (chown, chmod, récursif, SGID).')

CONTENU = '\n'.join([
    hero('Outil · Linux', TITRE,
         'Groupes, utilisateurs et leurs appartenances, une arborescence de dossiers et de fichiers, '
         'et les droits qui vont dessus — décrits une fois, générés en un script bash rejouable. '
         'Fini les vingt <code>useradd</code> et les <code>chmod</code> à la chaîne.'),
    STYLE,
    '<p>Créer une dizaine d’utilisateurs, les répartir dans des groupes, monter une arborescence de '
    'partage et poser les bons droits : c’est répétitif, et une faute de frappe sur un '
    '<code>chmod</code> ou un groupe passe inaperçue jusqu’à ce que quelqu’un ne puisse plus écrire. '
    'Cet outil part de ce que tu décris — la liste des groupes, « qui est dans quoi », l’arborescence '
    'et ses droits — et écrit un script <strong>rejouable</strong> : un compte déjà là n’est pas '
    'recréé, seuls les droits sont réappliqués. Même famille que les '
    '<a href="/pages/configurateur-bind9">autres configurateurs</a> : mêmes boutons (console, ligne '
    'curl). Les notions : <a href="/pages/linux-droits">Utilisateurs, droits &amp; sudo</a> et '
    '<a href="/pages/linux-acl">les ACL</a>.</p>',

    '<h2>Ce que l’outil produit</h2>',
    tab(['Script', 'Où le jouer', 'Ce qu’il fait'], [
        ['① Groupes &amp; utilisateurs', 'Dans la VM, en root',
         '<code>groupadd -f</code> pour chaque groupe (déclaré ou référencé), <code>useradd -m</code> '
         'pour chaque utilisateur (home + shell), le mot de passe du labo, et <code>usermod -aG</code> '
         'pour les groupes secondaires'],
        ['② Arborescence &amp; droits', 'Dans la VM, en root',
         'Les dossiers (<code>mkdir -p</code>) et fichiers (<code>touch</code>, dossier parent créé au '
         'besoin), puis <code>chown</code> et <code>chmod</code> — récursifs quand tu le demandes, pour '
         'que les droits s’appliquent aussi au contenu'],
        ['③ Vérifier', 'Dans la VM',
         '<code>getent group</code> (les groupes et leurs membres), <code>tail /etc/passwd</code>, '
         '<code>id</code>, <code>ls -lR</code> et <code>tree</code> — les captures qu’une éval demande'],
    ]),

    '<div data-block="users-configurator"></div>',

    '<h2>La syntaxe de l’arborescence</h2>',
    '<p>Une ligne par élément : <code>chemin&nbsp;absolu&nbsp;[proprietaire:groupe]&nbsp;[mode]&nbsp;[R]</code>.</p>',
    tab(['Élément', 'Sens'], [
        ['<code>/home/partage/</code>', 'Le <code>/</code> final = <strong>dossier</strong> ; sans lui = <strong>fichier</strong> (son dossier parent est créé automatiquement)'],
        ['<code>root:direction</code>', 'Propriétaire et groupe (<code>chown</code>). <code>alice</code> seul = ne change que le propriétaire ; <code>:direction</code> = ne change que le groupe'],
        ['<code>2770</code>', 'Le mode (<code>chmod</code>) en octal. Le <strong>2</strong> de tête = <strong>SGID</strong> : les fichiers créés dans le dossier héritent de son groupe — la base d’un dossier d’équipe'],
        ['<code>R</code>', 'Applique le droit <strong>récursivement</strong> au contenu déjà présent'],
    ]),
    note('gray', '💡 Le SGID, pourquoi c’est le bon réflexe pour un partage',
         'Sur un dossier d’équipe, <code>2770</code> (au lieu de <code>770</code>) fait que <strong>tout '
         'fichier créé dedans appartient au groupe du dossier</strong>, pas au groupe personnel de celui '
         'qui l’a créé. Sans ça, Alice crée un fichier que Bob (même équipe) ne peut pas modifier. '
         'C’est exactement le rôle du bit SGID sur un répertoire — voir '
         '<a href="/pages/durcissement-linux">les permissions spéciales</a>.'),
    note('yellow', '⚠️ L’ordre et la récursivité',
         'Les droits sont posés <strong>après</strong> avoir créé dossiers et fichiers, pour qu’un '
         '<code>-R</code> touche bien le contenu. Et un <code>chmod -R</code> sur un dossier racine '
         'suivi d’un <code>chmod</code> plus précis sur un sous-dossier : le second gagne, car il '
         'passe après. L’outil range les commandes dans cet ordre.'),
    note('gray', '📥 Sans navigateur dans la VM',
         'Comme les autres : <strong>🖥️ Pour la console</strong> copie une version qui s’enregistre et '
         'se lance seule, <strong>🔗 Ligne curl</strong> dépose le script sur le site (sept jours) pour '
         'le récupérer d’une commande.'),
])

CARTE = ('<a class="script-card" href="/pages/configurateur-utilisateurs"><div class="sc-top">'
         '<span class="sc-ico">👥</span><span class="sc-badge sc-badge-int">⚡ Interactif</span></div>'
         '<div class="sc-title">Configurateur — utilisateurs, groupes &amp; droits</div>'
         '<div class="sc-desc meta">Outil interactif : décris tes groupes, tes utilisateurs et une '
         'arborescence annotée de droits, obtiens un script rejouable — useradd/usermod, mkdir/touch, '
         'chown/chmod récursifs, SGID — plus les commandes de vérification.</div>'
         '<div class="sc-tags"><span class="sc-pill">Linux</span><span class="sc-pill">Droits</span>'
         '<span class="sc-pill">Utilisateurs</span><span class="sc-pill">Bash</span></div></a>')


def ranger_outil(c):
    ct = c.execute("SELECT content FROM pages WHERE slug='scripts'").fetchone()[0]
    if SLUG in ct:
        return 'déjà présent'
    i = ct.index('id="sec-linux"')
    j = ct.index('</div></section>', i)
    ct = ct[:j] + CARTE + ct[j:]
    sec = ct[i:ct.index('</section>', i)]
    n = sec.count('<a class="script-card"')
    ct = ct[:i] + re.sub(r'<span class="sc-count">\d+</span>', f'<span class="sc-count">{n}</span>', sec, count=1) + ct[i + len(sec):]
    ct = re.sub(r'(<a class="sc-chip" href="#sec-linux">.*?<span class="sc-n">)\d+(</span>)',
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

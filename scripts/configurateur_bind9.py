# -*- coding: utf-8 -*-
"""
Page « Configurateur — serveur DNS BIND9 » : à partir d'un domaine, d'une IP,
d'un réseau et d'une liste d'enregistrements, produit les scripts d'installation
d'un serveur DNS maître (options + zones directe et inverse, checkconf/checkzone,
tests dig) et, en option, d'un secondaire (esclave). Îlot React `Bind9Configurator`
(data-block "bind9-configurator"). Même famille que les configurateurs duo et
bastion : mêmes briques de script.

IDEMPOTENT.
"""
import re
import sqlite3
import sys

from _cours import BASE, STYLE, hero, note, tab

# publier peut être importé de _cours (réexporté) ou d'opnsense_serie ; on prend _cours.
from _cours import publier

SLUG = 'configurateur-bind9'
TITRE = 'Configurateur — serveur DNS BIND9'

EXTRAIT = ('Saisis un domaine, l’IP du serveur, le réseau et tes enregistrements : obtiens le script '
           'd’installation d’un serveur DNS BIND9 (zones directe et inverse, named-checkconf / '
           'named-checkzone, tests dig), et un secondaire (esclave) en option.')

CONTENU = '\n'.join([
    hero('Outil · Réseau / Linux', TITRE,
         'Un domaine, une IP, un réseau, quelques enregistrements — et le script complet d’un '
         'serveur DNS BIND9 : named.conf.options, named.conf.local, la zone directe et la zone '
         'inverse générées ensemble, validées, testées. Un serveur secondaire en un clic.'),
    STYLE,
    '<p>BIND9 est le serveur DNS de référence sous Linux. Le monter à la main, c’est cinq fichiers '
    'à écrire sans se tromper d’un point ou d’un octet — et une zone inverse à recopier à l’envers. '
    'Cet outil part de ce que tu sais (le domaine, l’adresse du serveur, tes machines) et écrit les '
    'fichiers <strong>cohérents entre eux</strong> : le <code>ns</code> qui manque, le PTR qui '
    'correspond à chaque A, le numéro de série, la déclaration du secondaire. Il fait suite aux '
    '<a href="/pages/configurateur-web-bdd">configurateurs duo web + base</a> et '
    '<a href="/pages/configurateur-bastion">bastion</a> : mêmes briques de script (adresse fixe, '
    'identité du clone), mêmes boutons. La théorie : les TP '
    '<a href="/pages/tp-dns-bind9-directe">zone directe</a>, '
    '<a href="/pages/tp-dns-bind9-inverse">zone inverse</a> et '
    '<a href="/pages/tp-dns-bind9-secondaire">serveur secondaire</a>.</p>',

    '<h2>Ce que l’outil produit</h2>',
    tab(['Script', 'Où le jouer', 'Ce qu’il fait'], [
        ['① Maître', 'Dans la VM du serveur DNS, en root',
         'Nom, IP fixe, DNS pointé sur lui-même, installation de BIND9, puis <code>named.conf.options</code> '
         '(redirecteurs, <code>allow-query</code> limité au LAN), <code>named.conf.local</code> (zones directe '
         'et inverse en <em>master</em>), les fichiers de zone <code>db.&lt;domaine&gt;</code> et '
         '<code>db.&lt;inverse&gt;</code>, la validation <code>named-checkconf</code> / '
         '<code>named-checkzone</code>, le démarrage et un test <code>dig</code>'],
        ['② Secondaire <span class="meta">(optionnel)</span>', 'Dans la VM du second serveur, en root',
         'BIND9 en <em>slave</em> : les mêmes zones déclarées en <code>type slave</code> avec le maître comme '
         'source ; les fichiers de zone arrivent par <strong>transfert</strong>, rien à recopier'],
        ['③ Vérifier', 'Depuis un client (ou avec <code>@IP</code>)',
         'Les <code>dig</code> qui prouvent la résolution directe (nom → adresse), inverse (adresse → nom), '
         'le MX, et que le secondaire répond la même chose'],
    ]),

    '<div data-block="bind9-configurator"></div>',

    '<h2>Ce qui est écrit, concrètement</h2>',
    '<p>Rien de propriétaire : le paquet <strong>bind9</strong> de Debian et ses cinq fichiers, ceux '
    'des TP. La <strong>zone inverse</strong> est déduite du réseau (un <code>/24</code> donne '
    '<code>x.y.z.in-addr.arpa</code>, un PTR par octet final) et n’inclut que les adresses '
    '<em>du bon réseau</em> — un enregistrement A vers une adresse externe n’y crée pas de PTR '
    'bancal. Le serveur se prend <strong>lui-même comme résolveur</strong>, ne répond qu’au LAN '
    '(<code>allow-query</code>), et transmet le reste à tes <strong>redirecteurs</strong>.</p>',
    note('yellow', '⚠️ Le numéro de série, le port, et les clients',
         'Le <strong>numéro de série</strong> (SOA) est celui du jour (<code>AAAAMMJJ01</code>) : à chaque '
         'modification d’une zone, il faut l’<strong>incrémenter</strong>, sinon le secondaire ne voit pas le '
         'changement. Ouvre le port <strong>53 en UDP <em>et</em> TCP</strong> si un pare-feu est actif (le TCP '
         'sert aux transferts de zone et aux grosses réponses). Enfin, un serveur DNS ne sert à rien tant que '
         'les <strong>clients ne le connaissent pas</strong> : pousse son adresse par le DHCP, ou mets-la dans '
         'leur configuration réseau.'),
    note('gray', '📥 Sans navigateur dans la VM',
         'Comme pour les autres configurateurs : <strong>🖥️ Pour la console</strong> copie une version qui '
         's’enregistre dans <code>~/</code> et se lance seule, et <strong>🔗 Ligne curl</strong> dépose le '
         'script sur le site (sept jours) pour le récupérer d’une commande — <code>curl -fsSL https://…/s/'
         'abcd2345 -o ~/dns-maitre.sh &amp;&amp; sudo bash ~/dns-maitre.sh</code>.'),
])

# ── carte dans le hub Outils (section Linux) ──────────────────────────────────
CARTE = ('<a class="script-card" href="/pages/configurateur-bind9"><div class="sc-top">'
         '<span class="sc-ico">🌿</span><span class="sc-badge sc-badge-int">⚡ Interactif</span></div>'
         '<div class="sc-title">Configurateur — serveur DNS BIND9</div>'
         '<div class="sc-desc meta">Outil interactif : un domaine, une IP, tes enregistrements, et le script '
         'd’un serveur DNS BIND9 — options, zones directe et inverse cohérentes, named-checkconf/checkzone, '
         'tests dig — plus un secondaire (esclave) en option.</div>'
         '<div class="sc-tags"><span class="sc-pill">Linux</span><span class="sc-pill">DNS</span>'
         '<span class="sc-pill">Debian</span><span class="sc-pill">BIND9</span></div></a>')

RENVOI_TP = ('<aside class="pb-note pb-note-blue"><p class="pb-note-title">⚡ Le faire d’un coup</p>'
             '<p>Une fois la méthode comprise, le <a href="/pages/configurateur-bind9">configurateur BIND9</a> '
             'écrit ces cinq fichiers (zone directe <em>et</em> inverse, cohérentes) et le script '
             'd’installation à partir de ton domaine et de tes enregistrements — avec un secondaire en '
             'option.</p></aside>')


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


def renvoi_tp(c):
    ct = c.execute("SELECT content FROM pages WHERE slug='tp-dns-bind9-directe'").fetchone()
    if not ct:
        return 'tp-dns-bind9-directe absent'
    ct = ct[0]
    if SLUG in ct:
        return 'déjà présent'
    # après le dernier bloc du TP (avant la fin), on ajoute l'aside.
    ct = ct + '\n' + RENVOI_TP
    c.execute("UPDATE pages SET content=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug='tp-dns-bind9-directe'", (ct,))
    return 'renvoi ajouté'


if __name__ == '__main__':
    c = sqlite3.connect(BASE)
    print(SLUG, ':', publier(c, SLUG, TITRE, EXTRAIT, CONTENU))
    print('outils :', ranger_outil(c).encode('ascii', 'replace').decode())
    print('tp :', renvoi_tp(c).encode('ascii', 'replace').decode())
    c.commit()
    c.close()
    sys.exit(0)

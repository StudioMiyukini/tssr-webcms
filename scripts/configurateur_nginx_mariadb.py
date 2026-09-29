# -*- coding: utf-8 -*-
"""
Page « Configurateur — serveur web nginx + MariaDB » : installe une pile LEMP
(nginx + PHP + MariaDB) sur une ou deux VM Debian, avec l'adressage, l'enregistrement
DNS du site, le port forwarding pour le publier, et le renvoi au configurateur de
load balancer quand on met le site en frontal. Îlot React `NginxMariadbConfigurator`
(data-block "nginx-mariadb-configurator"). Même famille que les configurateurs duo,
BIND9 et load balancer.

IDEMPOTENT.
"""
import re
import sqlite3
import sys

from _cours import BASE, STYLE, hero, note, tab
from _cours import publier

SLUG = 'configurateur-nginx-mariadb'
TITRE = 'Configurateur — serveur web nginx + MariaDB'

EXTRAIT = ('Installe une pile nginx + PHP + MariaDB (LEMP) sur une ou deux VM Debian : adressage IP, '
           'création de la base et de l’utilisateur, enregistrement DNS du site, port forwarding pour '
           'le publier depuis le WAN, et mise derrière un load balancer — le tout en scripts prêts à '
           'coller.')

CONTENU = '\n'.join([
    hero('Outil · Réseau / Linux', TITRE,
         'Une IP, un nom de site, une base — et les scripts complets d’un serveur web '
         '<strong>nginx + PHP + MariaDB</strong> : sur une seule VM, ou nginx et la base sur '
         '<strong>deux machines</strong>. Avec l’enregistrement <strong>DNS</strong>, le '
         '<strong>port forwarding</strong> pour le publier, et le renvoi vers le load balancer.'),
    STYLE,
    '<p>Monter un serveur web dynamique, c’est nginx qui sert les pages et exécute PHP, PHP qui parle '
    'à MariaDB, la base qui n’accepte que le bon client, un enregistrement DNS pour le nom, et souvent '
    'une règle NAT pour le publier. Cet outil écrit tout, <strong>cohérent</strong> : le '
    '<code>GRANT</code> limité à l’IP du serveur web, le <code>bind-address</code> de MariaDB, le vhost '
    'nginx, la page de test qui prouve la connexion à la base. Il complète le '
    '<a href="/pages/configurateur-web-bdd">duo web + base (clonage Hyper-V)</a> en se concentrant sur '
    'l’<strong>installation et la publication</strong>, et s’appuie sur le '
    '<a href="/pages/configurateur-loadbalancer">configurateur de load balancer</a> quand le site '
    'passe en frontal.</p>',

    '<h2>Ce que l’outil produit</h2>',
    tab(['Section', 'Où', 'Ce qu’elle fait'], [
        ['① Serveur web', 'Dans la VM nginx, en root',
         'Adresse fixe, installation de <strong>nginx + PHP-FPM + php-mysql</strong>, un <strong>hôte '
         'virtuel</strong> pour le nom du site, une page <code>index.php</code> de test qui se connecte '
         'à la base — et, en mono-machine, <strong>MariaDB local</strong> avec la base et l’utilisateur'],
        ['② Serveur MariaDB <span class="meta">(si 2 machines)</span>', 'Dans la VM base, en root',
         'Installation de MariaDB, écoute sur le réseau (<code>bind-address</code>), création de la '
         'base et d’un utilisateur <strong>autorisé seulement depuis l’IP du serveur web</strong>, port '
         '3306 filtré'],
        ['③ DNS', 'Sur le serveur DNS',
         'L’enregistrement <strong>A</strong> du site : ligne de zone <strong>BIND9</strong>, commande '
         '<strong>Windows/AD</strong>, ou entrée <code>/etc/hosts</code> — pointant vers le serveur '
         '(ou le load balancer)'],
        ['Port forwarding <span class="meta">(option)</span>', 'Sur le pare-feu',
         'La redirection <strong>WAN → serveur web</strong> (80/443) en plan <strong>pfSense / '
         'OPNsense</strong> ou en NAT statique <strong>Cisco</strong>'],
        ['Load balancer <span class="meta">(option)</span>', 'Sur le répartiteur',
         'Le bloc <code>upstream</code> déclarant ce serveur comme <strong>backend</strong> — le '
         'répartiteur complet se génère avec l’outil dédié'],
    ]),

    '<div data-block="nginx-mariadb-configurator"></div>',

    '<h2>Une ou deux machines ?</h2>',
    '<p>Sur <strong>une seule VM</strong>, nginx et MariaDB cohabitent : plus simple à monter, MariaDB '
    'reste en écoute locale (<code>127.0.0.1</code>). Sur <strong>deux VM</strong>, la base vit sur le '
    'réseau serveur, isolée : elle <strong>n’accepte que le serveur web</strong> (<code>GRANT … '
    '@\'ip-du-web\'</code> + pare-feu 3306). C’est la séparation des rôles attendue en production — et '
    'ce qui permet ensuite de <strong>répartir plusieurs serveurs web</strong> devant la même base.</p>',
    note('yellow', '⚠️ DNS, port-forward et load balancer pointent au bon endroit',
         'Sans load balancer, le <strong>DNS</strong> et le <strong>port forwarding</strong> visent le '
         'serveur web. Avec un load balancer, ils visent le <strong>répartiteur</strong> : l’outil '
         'ajuste automatiquement l’IP publiée. Un serveur web derrière un LB n’a pas besoin d’être '
         'exposé directement — seul le répartiteur l’est.'),
    note('gray', '📥 Sans navigateur dans la VM',
         'Comme pour les autres configurateurs : <strong>🖥️ Pour la console</strong> copie une version '
         'qui s’enregistre dans <code>~/</code> et se lance seule, et <strong>🔗 Ligne curl</strong> '
         'dépose le script sur le site (sept jours) — <code>curl -fsSL https://…/s/abcd2345 -o '
         '~/serveur-web.sh &amp;&amp; sudo bash ~/serveur-web.sh</code>.'),
])

# ── carte dans le hub Outils (section Linux) ──────────────────────────────────
CARTE = ('<a class="script-card" href="/pages/configurateur-nginx-mariadb"><div class="sc-top">'
         '<span class="sc-ico">🌐</span><span class="sc-badge sc-badge-int">⚡ Interactif</span></div>'
         '<div class="sc-title">Configurateur — serveur web nginx + MariaDB</div>'
         '<div class="sc-desc meta">Outil interactif : pile LEMP (nginx + PHP + MariaDB) sur 1 ou 2 '
         'VM, avec adressage, base + utilisateur, enregistrement DNS, port forwarding et mise '
         'derrière un load balancer.</div>'
         '<div class="sc-tags"><span class="sc-pill">Linux</span><span class="sc-pill">nginx</span>'
         '<span class="sc-pill">MariaDB</span><span class="sc-pill">PHP</span>'
         '<span class="sc-pill">Debian</span></div></a>')


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

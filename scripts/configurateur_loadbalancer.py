# -*- coding: utf-8 -*-
"""
Page « Configurateur — load balancer nginx » : à partir d'une IP de répartiteur,
d'un réseau, d'une liste de backends et d'un algorithme, produit le script
d'installation d'un load balancer nginx (upstream + serveur proxy, health checks
passifs, serveur de secours, persistance, stub_status, terminaison TLS) et, en
option, un script keepalived pour la haute disponibilité (IP virtuelle). Îlot
React `LoadBalancerConfigurator` (data-block "loadbalancer-configurator"). Même
famille que les configurateurs BIND9 / duo / bastion : mêmes briques de script.

IDEMPOTENT.
"""
import re
import sqlite3
import sys

from _cours import BASE, STYLE, hero, note, tab
from _cours import publier

SLUG = 'configurateur-loadbalancer'
TITRE = 'Configurateur — load balancer nginx'

EXTRAIT = ('Saisis l’IP du répartiteur, le réseau, tes backends et un algorithme : obtiens le script '
           'd’installation d’un load balancer nginx (upstream, health checks, serveur de secours, '
           'persistance, stub_status, HTTPS), et un script keepalived pour la haute disponibilité '
           '(IP virtuelle) en option.')

CONTENU = '\n'.join([
    hero('Outil · Réseau / Linux', TITRE,
         'Une IP, un réseau, la liste de tes serveurs web — et le script complet d’un load balancer '
         'nginx : le bloc <code>upstream</code>, le serveur proxy, les health checks, la persistance, '
         'la page d’état, la terminaison HTTPS. Et keepalived + IP virtuelle en un clic pour rendre '
         'le répartiteur lui-même redondant.'),
    STYLE,
    '<p>Répartir la charge sur plusieurs serveurs web, c’est un bloc <code>upstream</code> et un '
    '<code>proxy_pass</code> — mais aussi les bons <em>health checks</em>, un serveur de secours, la '
    'persistance de session, et surtout la <strong>haute disponibilité du répartiteur</strong>, sans '
    'quoi on a juste déplacé le point unique de défaillance. Cet outil part de ce que tu sais (l’IP '
    'du LB, tes backends) et écrit le tout, <strong>cohérent</strong>. Il fait suite aux '
    '<a href="/pages/configurateur-web-bdd">configurateurs duo web + base</a> et '
    '<a href="/pages/configurateur-bind9">BIND9</a> : mêmes briques de script (adresse fixe, identité '
    'du clone), mêmes boutons. La théorie et le pas à pas : '
    '<a href="/pages/procedure-loadbalancer-debian">mettre en place un load balancer</a>.</p>',

    '<h2>Ce que l’outil produit</h2>',
    tab(['Script', 'Où le jouer', 'Ce qu’il fait'], [
        ['① Load balancer', 'Dans la VM du répartiteur, en root',
         'Nom, IP fixe, installation de <strong>nginx</strong>, retrait du site par défaut, puis '
         '<code>/etc/nginx/conf.d/loadbalancer.conf</code> : le bloc <code>upstream</code> (algorithme, '
         '<code>max_fails</code>/<code>fail_timeout</code>, <code>weight</code>, <code>backup</code>), '
         'le serveur proxy (<code>proxy_pass</code>, en-têtes <code>X-Forwarded-For</code>…), la page '
         '<code>stub_status</code>, la terminaison <strong>HTTPS</strong> si demandée (cert auto-signé), '
         'la validation <code>nginx -t</code> et le rechargement'],
        ['② keepalived <span class="meta">(optionnel)</span>', 'Sur chaque LB (MASTER + BACKUP), en root',
         'Installe keepalived et écrit la config <strong>VRRP</strong> : l’<strong>IP virtuelle</strong> '
         'vit sur le MASTER et bascule sur le BACKUP si nginx tombe (<code>track_script</code> '
         '<code>chk_nginx</code>)'],
        ['③ Vérifier', 'Depuis un client',
         'Les <code>curl</code> qui prouvent que chaque backend répond, que le LB répartit, l’état '
         'nginx, et comment éprouver la bascule (arrêt d’un backend, puis du MASTER)'],
    ]),

    '<div data-block="loadbalancer-configurator"></div>',

    '<h2>Ce qui est écrit, concrètement</h2>',
    '<p>Rien de propriétaire : le paquet <strong>nginx</strong> de Debian en reverse proxy '
    'équilibreur, et <strong>keepalived</strong> pour l’IP flottante. Les <strong>backends</strong> se '
    'saisissent en clair — <code>ip[:port] [weight=N] [backup]</code> par ligne — et l’outil en déduit '
    'le bloc <code>upstream</code>. Les <em>health checks</em> sont <strong>passifs</strong> '
    '(<code>max_fails</code> / <code>fail_timeout</code>) : c’est ce que propose nginx open-source ; '
    'les checks <em>actifs</em> et la persistance par cookie « sticky » relèvent de nginx Plus.</p>',
    note('yellow', '⚠️ Les ports, la persistance, et le point unique de défaillance',
         'Ouvre le port <strong>80</strong> (et <strong>443</strong> en HTTPS) sur le load balancer, et '
         'le flux du LB <strong>vers chaque backend</strong> — sinon le répartiteur ne joint pas les '
         'serveurs. Pour garder un visiteur sur « son » serveur (session, panier), choisis '
         '<code>ip_hash</code>. Et rappelle-toi qu’un load balancer <strong>seul</strong> est un point '
         'unique de défaillance : renseigne une <strong>IP virtuelle</strong> pour générer keepalived '
         'et faire pointer le DNS des clients sur la VIP, pas sur un LB en particulier.'),
    note('gray', '📥 Sans navigateur dans la VM',
         'Comme pour les autres configurateurs : <strong>🖥️ Pour la console</strong> copie une version qui '
         's’enregistre dans <code>~/</code> et se lance seule, et <strong>🔗 Ligne curl</strong> dépose le '
         'script sur le site (sept jours) pour le récupérer d’une commande — <code>curl -fsSL https://…/s/'
         'abcd2345 -o ~/loadbalancer.sh &amp;&amp; sudo bash ~/loadbalancer.sh</code>.'),
])

# ── carte dans le hub Outils (section Linux) ──────────────────────────────────
CARTE = ('<a class="script-card" href="/pages/configurateur-loadbalancer"><div class="sc-top">'
         '<span class="sc-ico">⚖️</span><span class="sc-badge sc-badge-int">⚡ Interactif</span></div>'
         '<div class="sc-title">Configurateur — load balancer nginx</div>'
         '<div class="sc-desc meta">Outil interactif : une IP, tes backends, un algorithme, et le script '
         'd’un load balancer nginx — upstream, health checks passifs, serveur de secours, persistance, '
         'stub_status, HTTPS — plus keepalived (IP virtuelle) en option.</div>'
         '<div class="sc-tags"><span class="sc-pill">Linux</span><span class="sc-pill">nginx</span>'
         '<span class="sc-pill">Debian</span><span class="sc-pill">Haute dispo</span></div></a>')

RENVOI_PROC = ('<aside class="pb-note pb-note-blue"><p class="pb-note-title">⚡ Le générer d’un coup</p>'
               '<p>Une fois la méthode comprise, le '
               '<a href="/pages/configurateur-loadbalancer">configurateur load balancer</a> écrit ce '
               'fichier <code>upstream</code> + serveur proxy et le script d’installation à partir de '
               'ton IP et de tes backends — avec keepalived (IP virtuelle) en option.</p></aside>')


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


def renvoi_proc(c):
    row = c.execute("SELECT content FROM pages WHERE slug='procedure-loadbalancer-debian'").fetchone()
    if not row:
        return 'procedure-loadbalancer-debian absente'
    ct = row[0]
    if SLUG in ct:
        return 'déjà présent'
    ct = ct + '\n' + RENVOI_PROC
    c.execute("UPDATE pages SET content=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug='procedure-loadbalancer-debian'", (ct,))
    return 'renvoi ajouté'


if __name__ == '__main__':
    c = sqlite3.connect(BASE)
    print(SLUG, ':', publier(c, SLUG, TITRE, EXTRAIT, CONTENU))
    print('outils :', ranger_outil(c).encode('ascii', 'replace').decode())
    print('proc :', renvoi_proc(c).encode('ascii', 'replace').decode())
    c.commit()
    c.close()
    sys.exit(0)

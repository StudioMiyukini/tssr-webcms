# -*- coding: utf-8 -*-
"""
Page « Mettre en place un load balancer sous Debian (nginx) » : la procédure
pas à pas — le principe (upstream, backends, VIP, algorithmes), préparer les
serveurs web, installer nginx, écrire l'upstream + le serveur proxy (health
checks passifs, serveur de secours, persistance de session), la supervision
(stub_status), la terminaison TLS, puis la haute disponibilité du répartiteur
lui-même avec keepalived (VRRP / IP virtuelle).
Style step-banner. Rangée dans Procédures › Services.

IDEMPOTENT.
"""
import re
import sqlite3
import sys

from _cours import BASE, publier

SLUG = 'procedure-loadbalancer-debian'
TITRE = 'Mettre en place un load balancer sous Debian (nginx)'

STYLE = ('<style>'
         ".proc-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);"
         "border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;"
         "white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}"
         ".step-banner{display:flex;align-items:center;gap:14px;margin:32px 0 12px;padding:13px 16px;"
         "border:1px solid var(--border);border-left-width:6px;border-radius:12px;background:var(--surface-2)}"
         ".step-banner .step-num{flex:0 0 auto;width:36px;height:36px;border-radius:10px;display:grid;"
         "place-items:center;font-weight:700;color:#fff;font-size:16px;line-height:1}"
         ".step-banner .step-tt{display:flex;flex-direction:column;gap:2px;min-width:0}"
         ".step-banner h3{margin:0;font-size:17px;line-height:1.25}"
         ".step-banner .step-sub{font-size:12.5px;color:var(--text-muted);font-weight:400}"
         ".step-rail{border-left:4px solid var(--border);padding:2px 0 2px 16px;margin:0 0 10px 4px}"
         ".step-rail>*:first-child{margin-top:6px}"
         ".rt{border-collapse:collapse;width:100%;margin:8px 0;font-size:12.5px}"
         ".rt td,.rt th{border:1px solid var(--border);padding:6px 9px;text-align:left;vertical-align:top}"
         ".rt th{background:var(--surface-2);color:var(--text-muted)}"
         ".lx-nav{font-family:ui-monospace,monospace;font-size:12px;font-weight:600;"
         "background:var(--surface-3);border:1px solid var(--border);border-radius:6px;padding:1px 7px}"
         "</style>")


def cmd(t):
    return f'<div class="proc-cmd">{t}</div>'


def nav(t):
    return f'<span class="lx-nav">{t}</span>'


def note(couleur, titre, *paras):
    return (f'<aside class="pb-note pb-note-{couleur}"><p class="pb-note-title">{titre}</p>'
            + ''.join(f'<p>{p}</p>' for p in paras) + '</aside>')


def tab(entetes, lignes):
    th = ''.join(f'<th>{h}</th>' for h in entetes)
    tr = ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in l) + '</tr>' for l in lignes)
    return f'<table class="rt"><tr>{th}</tr>{tr}</table>'


def etape(num, couleur, titre, sous, corps):
    return (f'<div class="step-banner" style="border-left-color:{couleur}">'
            f'<span class="step-num" style="background:{couleur}">{num}</span>'
            f'<span class="step-tt"><h3>{titre}</h3><span class="step-sub">{sous}</span></span></div>'
            f'<div class="step-rail" style="border-left-color:{couleur}">{corps}</div>')


BLEU, VERT, AMBRE, VIOLET, ROUGE, TEAL = '#3b82f6', '#16a34a', '#d97706', '#7c3aed', '#dc2626', '#0d9488'

# --- Configs embarquées (pas d'angle brackets : sûres pour le HTML) ---

CONF_LB = (
    '# /etc/nginx/conf.d/loadbalancer.conf\n'
    'upstream web_backend {\n'
    '    least_conn;                                    # algorithme (defaut : round-robin)\n'
    '    server 10.180.30.11:80 max_fails=3 fail_timeout=10s;\n'
    '    server 10.180.30.12:80 max_fails=3 fail_timeout=10s;\n'
    '    # server 10.160.30.2:80 backup;                # secours (ex. replica agence distante)\n'
    '}\n'
    '\n'
    'server {\n'
    '    listen 80;\n'
    '    server_name _;\n'
    '\n'
    '    location / {\n'
    '        proxy_pass http://web_backend;\n'
    '        proxy_set_header Host              $host;\n'
    '        proxy_set_header X-Real-IP         $remote_addr;\n'
    '        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;\n'
    '        proxy_set_header X-Forwarded-Proto $scheme;\n'
    '\n'
    '        proxy_connect_timeout 3s;\n'
    '        proxy_next_upstream error timeout http_502 http_503 http_504;\n'
    '    }\n'
    '\n'
    '    access_log /var/log/nginx/lb_access.log;\n'
    '    error_log  /var/log/nginx/lb_error.log;\n'
    '}'
)

CONF_STATUS = (
    '# ajouter dans le meme fichier : etat de nginx\n'
    'server {\n'
    '    listen 8080;\n'
    '    location /nginx_status {\n'
    '        stub_status;\n'
    '        allow 127.0.0.1;\n'
    '        allow 10.180.0.0/16;    # adapter a votre reseau d\'admin\n'
    '        deny all;\n'
    '    }\n'
    '}'
)

CONF_TLS = (
    '# terminaison HTTPS sur le load balancer\n'
    'server {\n'
    '    listen 443 ssl;\n'
    '    server_name www.bordeaux.local;\n'
    '\n'
    '    ssl_certificate     /etc/nginx/certs/site.crt;\n'
    '    ssl_certificate_key /etc/nginx/certs/site.key;\n'
    '\n'
    '    location / {\n'
    '        proxy_pass http://web_backend;\n'
    '        proxy_set_header Host              $host;\n'
    '        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;\n'
    '        proxy_set_header X-Forwarded-Proto $scheme;\n'
    '    }\n'
    '}\n'
    '\n'
    'server {                                   # rediriger le 80 vers le 443\n'
    '    listen 80;\n'
    '    server_name www.bordeaux.local;\n'
    '    return 301 https://$host$request_uri;\n'
    '}'
)

CONF_KEEPALIVED = (
    '# /etc/keepalived/keepalived.conf  (MASTER)\n'
    'vrrp_script chk_nginx {\n'
    '    script "/usr/bin/killall -0 nginx"     # 0 = nginx vivant\n'
    '    interval 2\n'
    '    weight 2\n'
    '}\n'
    '\n'
    'vrrp_instance VI_1 {\n'
    '    state MASTER\n'
    '    interface eth0\n'
    '    virtual_router_id 51\n'
    '    priority 110                            # BACKUP : 100\n'
    '    advert_int 1\n'
    '    authentication { auth_type PASS; auth_pass ChangeMoi }\n'
    '    virtual_ipaddress { 10.180.30.10/24 }\n'
    '    track_script { chk_nginx }\n'
    '}'
)

CORPS = '\n'.join([
    '<section class="hero"><span class="pill">Procédure · Linux · Load balancing</span>'
    '<h1>Mettre en place un load balancer sous Debian (nginx)</h1>'
    '<p>Répartir le trafic web sur plusieurs serveurs identiques avec <strong>nginx</strong> : monter '
    'le répartiteur, déclarer les backends, écarter automatiquement un serveur en panne, garder la '
    'session d’un visiteur sur le bon serveur — puis rendre le répartiteur lui-même redondant avec '
    '<strong>keepalived</strong> et une IP virtuelle.</p>'
    '</section>',
    STYLE,

    note('blue', '🎯 Ce qu’on met en place',
         'Un <strong>load balancer</strong> (répartiteur de charge) place un point d’entrée unique '
         'devant plusieurs serveurs web. Il <strong>répartit</strong> les requêtes (pour tenir la '
         'charge) et <strong>écarte</strong> un serveur qui ne répond plus (pour la disponibilité). '
         'On utilise <strong>nginx</strong> comme reverse proxy équilibreur — léger, déjà connu comme '
         'serveur web, et parfait pour ce rôle.',
         'Tant qu’il est seul, le load balancer reste un <strong>point unique de défaillance</strong>. '
         'On règle ce point à l’étape 7 avec <strong>keepalived</strong> (une seconde instance nginx '
         'et une <strong>IP virtuelle</strong> qui bascule).'),

    etape(1, TEAL, 'Le principe et le plan',
          'Bloc upstream, backends, IP virtuelle — et le bon algorithme',
          '<p>nginx raisonne en deux temps : un bloc <strong>upstream</strong> regroupe les serveurs '
          'réels, et un bloc <strong>server</strong> qui écoute les clients renvoie vers cet upstream '
          'par <span class="lx-nav">proxy_pass</span>.</p>'
          + tab(['Rôle', 'Machine', 'Adresse'],
                [['IP virtuelle (VIP)', 'Point d’entrée public', '<span class="lx-nav">10.180.30.10</span>'],
                 ['Load balancer 1 (MASTER)', 'nginx + keepalived', '<span class="lx-nav">10.180.30.8</span>'],
                 ['Load balancer 2 (BACKUP)', 'nginx + keepalived', '<span class="lx-nav">10.180.30.9</span>'],
                 ['Serveur web 1', 'Apache/NGINX', '<span class="lx-nav">10.180.30.11</span>'],
                 ['Serveur web 2', 'Apache/NGINX', '<span class="lx-nav">10.180.30.12</span>']])
          + note('blue', '⚖️ Choisir l’algorithme de répartition',
                 '<strong>round-robin</strong> (par défaut, aucune directive) — chacun son tour, idéal '
                 'si les serveurs sont équivalents. <strong>least_conn</strong> — vers le serveur qui a '
                 'le moins de connexions actives, utile pour des sessions longues. <strong>ip_hash</strong> '
                 '— un même client va toujours au même serveur (persistance). '
                 '<span class="lx-nav">weight=N</span> sur un <span class="lx-nav">server</span> pour '
                 'pondérer un backend plus puissant.')
          + note('gray', '🧱 Couche 7 ou couche 4',
                 'Ici on répartit du <strong>HTTP</strong> (couche 7) : nginx lit l’URL et les en-têtes. '
                 'Pour un flux brut (SQL, SMTP…), nginx sait aussi faire du <strong>couche 4</strong> '
                 'via un bloc <span class="lx-nav">stream { }</span> dans '
                 '<span class="lx-nav">nginx.conf</span> — même logique d’upstream, sans comprendre le '
                 'protocole.')),

    etape(2, VERT, 'Préparer les serveurs web (backends)',
          'Deux serveurs identiques, joignables par le load balancer',
          '<p>Le répartiteur ne sert à rien sans au moins <strong>deux backends équivalents</strong>. '
          'Chacun héberge le <em>même</em> site '
          '(<a href="/pages/procedure-apache-linux">héberger un site avec Apache sous Debian</a>). '
          'Pour visualiser la répartition pendant les tests, on marque temporairement chaque page :</p>'
          + cmd('# Sur web1 (10.180.30.11)\n'
                'echo "<h1>Servi par WEB-1</h1>" | sudo tee /var/www/html/index.html\n\n'
                '# Sur web2 (10.180.30.12)\n'
                'echo "<h1>Servi par WEB-2</h1>" | sudo tee /var/www/html/index.html')
          + note('amber', '⚠️ Le point souvent oublié',
                 'Les backends doivent être <strong>joignables depuis le load balancer</strong> '
                 '(même réseau ou route + pare-feu ouvert sur le port 80/443). En production, ces '
                 'serveurs web n’ont pas besoin d’être exposés directement : seul le LB l’est.')),

    etape(3, BLEU, 'Installer nginx',
          'Le paquet, et le drapeau qui permettra la VIP',
          cmd('sudo apt update\n'
              'sudo apt install -y nginx\n'
              'nginx -v        # verifier la version installee')
          + '<p>On autorise nginx à écouter sur une adresse qui n’est pas encore montée localement '
          '(nécessaire pour la VIP keepalived côté BACKUP) :</p>'
          + cmd('echo "net.ipv4.ip_nonlocal_bind = 1" | sudo tee /etc/sysctl.d/90-nginx.conf\n'
                'sudo sysctl --system')
          + note('gray', '🗂️ Où vit la configuration',
                 'Le site par défaut occupe le port 80 : on le retire pour laisser la place à notre '
                 'répartiteur. Notre configuration ira dans '
                 '<span class="lx-nav">/etc/nginx/conf.d/loadbalancer.conf</span>.')
          + cmd('sudo rm -f /etc/nginx/sites-enabled/default')),

    etape(4, VIOLET, 'Configurer l’upstream et le serveur proxy',
          'Répartition, health checks passifs, serveur de secours, persistance',
          '<p>Créer <span class="lx-nav">/etc/nginx/conf.d/loadbalancer.conf</span> :</p>'
          + cmd(CONF_LB)
          + tab(['Directive', 'Ce qu’elle fait'],
                [['<span class="lx-nav">least_conn;</span>', 'Algorithme de répartition (voir étape 1)'],
                 ['<span class="lx-nav">max_fails / fail_timeout</span>', 'Health check <strong>passif</strong> : après N échecs, le serveur est écarté pendant le délai'],
                 ['<span class="lx-nav">proxy_next_upstream</span>', 'Rejoue la requête sur un autre backend en cas d’erreur/timeout'],
                 ['<span class="lx-nav">backup</span>', 'Serveur de secours : ne sert que si tous les autres sont KO'],
                 ['<span class="lx-nav">proxy_set_header X-Forwarded-For</span>', 'Transmet l’IP réelle du client au backend']])
          + note('blue', '🍪 Persistance de session',
                 'Sans persistance, deux requêtes d’un même utilisateur peuvent tomber sur deux serveurs '
                 'différents — et il perd sa session. Ajouter <span class="lx-nav">ip_hash;</span> dans '
                 'l’upstream colle un client à « son » backend (par son IP). '
                 'La persistance par <strong>cookie applicatif</strong> (<span class="lx-nav">sticky</span>) '
                 'et les <strong>health checks actifs</strong> nécessitent, eux, nginx <em>Plus</em> '
                 '(édition commerciale) ; en open-source, on s’appuie sur '
                 '<span class="lx-nav">ip_hash</span> et les checks passifs ci-dessus.')),

    etape(5, AMBRE, 'Supervision, démarrage et test',
          'Vérifier, activer, et voir la répartition en direct',
          '<p>Ajouter une page d’état (connexions et requêtes en temps réel) :</p>'
          + cmd(CONF_STATUS)
          + '<p>Vérifier la syntaxe <strong>avant</strong> de recharger, puis appliquer :</p>'
          + cmd('sudo nginx -t                       # -t = test de configuration\n'
                'sudo systemctl enable --now nginx\n'
                'sudo systemctl reload nginx          # recharge sans coupure')
          + '<p>Tester la répartition depuis un client (répéter la requête) :</p>'
          + cmd('for i in $(seq 1 6); do curl -s http://10.180.30.10/ | grep -i servi; done\n'
                '# En round-robin on voit alterner WEB-1 / WEB-2')
          + note('green', '📊 Voir l’état et la bascule',
                 'Ouvrir <span class="lx-nav">http://10.180.30.10:8080/nginx_status</span> pour le '
                 'résumé nginx. Le détail par backend se lit surtout dans '
                 '<span class="lx-nav">/var/log/nginx/lb_access.log</span> (upstream servi) et '
                 '<span class="lx-nav">lb_error.log</span>. Couper Apache sur web1 '
                 '(<span class="lx-nav">sudo systemctl stop apache2</span>) : après '
                 '<span class="lx-nav">max_fails</span>, nginx l’écarte et sert tout depuis web2 — '
                 'sans coupure côté client.')),

    etape(6, TEAL, 'Terminaison HTTPS (option recommandée)',
          'Déchiffrer le TLS sur le load balancer',
          '<p>On concentre le certificat sur le LB : il déchiffre le HTTPS et parle en HTTP aux '
          'backends. Contrairement à d’autres répartiteurs, nginx attend le certificat et la clé dans '
          '<strong>deux fichiers séparés</strong> :</p>'
          + cmd('sudo mkdir -p /etc/nginx/certs\n'
                'sudo cp fullchain.pem /etc/nginx/certs/site.crt\n'
                'sudo cp privkey.pem  /etc/nginx/certs/site.key\n'
                'sudo chmod 600 /etc/nginx/certs/site.key')
          + '<p>Puis écouter en 443 et rediriger le 80 vers le 443 :</p>'
          + cmd(CONF_TLS)
          + note('amber', '🔐 Note',
                 'Le certificat peut venir de Let’s Encrypt (certbot) ou d’une PKI interne. Le trafic '
                 'LB → backends reste en HTTP <em>sur le réseau interne</em> ; si ce lien traverse une '
                 'zone non sûre, rechiffrer avec un <span class="lx-nav">proxy_pass https://…</span> '
                 'vers un upstream en 443.')),

    etape(7, ROUGE, 'Haute disponibilité du load balancer (keepalived)',
          'Une seconde instance nginx + une IP virtuelle qui bascule',
          '<p>Un seul LB = un point unique de défaillance. On installe nginx '
          '<strong>à l’identique</strong> sur une seconde machine, puis <strong>keepalived</strong> '
          'sur les deux : il fait vivre la <strong>VIP <span class="lx-nav">10.180.30.10</span></strong> '
          'sur le MASTER et la bascule sur le BACKUP si le MASTER (ou son nginx) tombe.</p>'
          + cmd('sudo apt install -y keepalived')
          + '<p><span class="lx-nav">/etc/keepalived/keepalived.conf</span> sur le MASTER '
          '(le BACKUP est identique avec <span class="lx-nav">state BACKUP</span> et '
          '<span class="lx-nav">priority 100</span>) :</p>'
          + cmd(CONF_KEEPALIVED)
          + cmd('sudo systemctl enable --now keepalived\n'
                'ip a | grep 10.180.30.10     # la VIP doit apparaitre sur le MASTER')
          + note('green', '✅ Éprouver la bascule',
                 'Arrêter keepalived (ou nginx) sur le MASTER : la VIP <strong>migre</strong> sur le '
                 'BACKUP en ~1 s, le service continue. Le <span class="lx-nav">chk_nginx</span> '
                 'garantit qu’un nginx planté déclenche la bascule, même si la machine répond encore. '
                 'Même logique que la <a href="/pages/procedure-dns-redondance">redondance DNS</a>.')),

    note('green', '🏁 À retenir',
         'nginx pense en <strong>upstream</strong> (les serveurs) → <strong>server</strong> qui '
         '<span class="lx-nav">proxy_pass</span> vers lui. Les <strong>health checks passifs</strong> '
         '(<span class="lx-nav">max_fails</span>) écartent un serveur mort ; '
         '<span class="lx-nav">ip_hash</span> garde une session sur son serveur ; '
         '<span class="lx-nav">backup</span> tient le secours. Toujours '
         '<span class="lx-nav">nginx -t</span> avant de recharger. Et un load balancer seul reste un '
         'point unique de défaillance : <strong>keepalived + VIP</strong> le rendent redondant.'),

    note('gray', '🔗 À rapprocher',
         '<a href="/pages/procedure-apache-linux">Héberger un site avec Apache sous Debian</a> · '
         '<a href="/pages/procedure-veeam-replication">Réplication Veeam</a> (nginx en frontal du replica) · '
         '<a href="/pages/procedure-dns-redondance">Redondance DNS</a> · '
         '<a href="/pages/durcissement-linux">Durcir un serveur Linux</a>.'),
])

EXTRAIT = ('La procédure pas à pas pour répartir le trafic web sous Debian avec nginx : le principe '
           '(upstream, backends, VIP, algorithmes round-robin / least_conn / ip_hash), préparer deux '
           'serveurs web, installer et configurer nginx (health checks passifs, serveur de secours, '
           'persistance), la supervision stub_status, la terminaison HTTPS, puis la haute disponibilité '
           'du répartiteur avec keepalived et une IP virtuelle.')

CARTE = ('<a class="dir-card" href="/pages/procedure-loadbalancer-debian"><div class="dc-ico">⚖️</div>'
         '<div class="dc-body"><div class="dc-title">Mettre en place un load balancer sous Debian (nginx)</div>'
         '<div class="dc-desc meta">Pas à pas : upstream/proxy nginx, algorithmes de répartition, '
         'health checks passifs, serveur de secours, persistance de session, supervision stub_status, '
         'terminaison HTTPS, et haute disponibilité du répartiteur avec keepalived (IP virtuelle).</div>'
         '<div><span style="display:inline-block;font-size:10.5px;font-weight:600;color:var(--text-muted);'
         'background:var(--surface-3);border:1px solid var(--border);border-radius:999px;padding:1px 9px;'
         'margin:4px 4px 0 0">nginx</span>'
         '<span style="display:inline-block;font-size:10.5px;font-weight:600;color:var(--text-muted);'
         'background:var(--surface-3);border:1px solid var(--border);border-radius:999px;padding:1px 9px;'
         'margin:4px 4px 0 0">Haute dispo</span></div></div><div class="dc-go">Voir →</div></a>')


def ranger(c):
    h = c.execute("SELECT content FROM pages WHERE slug='procedures'").fetchone()[0]
    if SLUG not in h:
        m = re.search(r'<section class="pd-sec" id="sec-services">.*?</section>', h, re.S)
        bloc = m.group(0)
        fin = bloc.rindex('</div></section>')
        bloc = bloc[:fin] + CARTE + bloc[fin:]
        h = h[:m.start()] + bloc + h[m.end():]
    comptes = {}
    for m in re.finditer(r'<section class="pd-sec" id="(sec-[^"]+)">(.*?)</section>', h, re.S):
        comptes[m.group(1)] = len(re.findall(r'<a class="dir-card"', m.group(2)))
    h = re.sub(r'<section class="pd-sec" id="(sec-[^"]+)">.*?</section>',
               lambda m: re.sub(r'(<span class="pd-count">)\d+(</span>)',
                                lambda t: t.group(1) + str(comptes[m.group(1)]) + t.group(2), m.group(0), count=1),
               h, flags=re.S)
    h = re.sub(r'<a class="pd-chip" href="#(sec-[^"]+)">.*?</a>',
               lambda m: re.sub(r'(<span class="pd-n">)\d+(</span>)',
                                lambda t: t.group(1) + str(comptes.get(m.group(1), 0)) + t.group(2), m.group(0), count=1),
               h, flags=re.S)
    total = sum(comptes.values())
    h = re.sub(r'>\d+ procédures,', f'>{total} procédures,', h, count=1)
    c.execute("UPDATE pages SET content=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug='procedures'", (h,))
    return f'index : sec-services={comptes.get("sec-services")} ; total {total}'


if __name__ == '__main__':
    c = sqlite3.connect(BASE)
    print(SLUG, ':', publier(c, SLUG, TITRE, EXTRAIT, CORPS))
    print(ranger(c).encode('ascii', 'replace').decode())
    c.commit()
    c.close()
    sys.exit(0)

# -*- coding: utf-8 -*-
"""
Page « Boîte à outils Debian — administration TSSR » : présente et héberge le
script bash interactif (client/public/tssr-toolbox.sh, servi sur
https://tssr.miyukini.com/tssr-toolbox.sh). Menu + séquences avec gate de
validation, journal des erreurs, retour au menu. Rangée dans Outils › Linux.

IDEMPOTENT.
"""
import re
import sqlite3
import sys

from _cours import BASE, STYLE, hero, note, tab, bullets, publier

SLUG = 'outil-boite-debian'
TITRE = 'Boîte à outils Debian — administration TSSR'
URL = 'https://tssr.miyukini.com/tssr-toolbox.sh'

EXTRAIT = ('Un script bash interactif et pédagogique pour administrer une Debian de TP : menu, '
           'séquences (statut réseau, paquets, IP, SSH, utilisateur, serveurs web Apache/nginx, '
           'bastion Guacamole, GLPI, sauvegarde), chacune avec une gate de validation et un journal '
           'des erreurs. Récupérable en une ligne depuis la VM.')

CONTENU = '\n'.join([
    hero('Outil · Linux · Debian', TITRE,
         'Un <strong>menu</strong>, des <strong>séquences</strong> prêtes à l’emploi pour les TP : '
         'statut réseau, paquets de base, IP statique, durcissement SSH, création d’utilisateur, '
         'serveurs web, bastion, GLPI, sauvegarde. <strong>Chaque séquence</strong> se termine par '
         'une <strong>gate de validation</strong>, journalise ses erreurs et revient au menu.'),
    STYLE,

    note('blue', '🎯 À quoi ça sert',
         'Rassembler, dans un seul script <strong>commenté et clair</strong>, les gestes que l’on '
         'répète en TP. Pensé pour apprendre : chaque action est expliquée, validée par une '
         '<strong>gate</strong> (OK / ÉCHEC), et en cas de pépin un <strong>journal horodaté</strong> '
         'dit <em>pourquoi</em> ça n’a pas marché avant de revenir au menu.'),

    '<h2>À distance ou en local ?</h2>',
    '<p>Choisis, copie, colle dans le terminal de ta VM. Le bloc <strong>« Voir tout le code »</strong> '
    'permet aussi de lire le script en entier (il est commenté et balisé MSCM).</p>',
    '<div data-block="toolbox-cta"></div>',
    note('yellow', '🚫 Pourquoi pas « curl | bash »',
         'Le script est <strong>interactif</strong> (un menu qui lit le clavier). Avec '
         '<code>curl … | bash</code>, l’entrée standard est occupée par le tube : le menu ne reçoit '
         'plus tes touches et le script tourne à vide. On utilise donc l’une des deux méthodes '
         'ci-dessous.'),

    '<h3>① Lancer sans l’installer (à la volée)</h3>',
    '<p>La <em>substitution de processus</em> de bash exécute le script directement depuis le site '
    '<strong>sans créer de fichier</strong>, tout en gardant le clavier actif :</p>',
    '<div class="proc-cmd">sudo bash &lt;(curl -fsSL ' + URL + ')</div>',
    note('gray', '🔎 Pourquoi ça marche',
         '<code>&lt;(curl …)</code> fournit le script comme un <strong>fichier temporaire</strong> '
         '(<code>/dev/fd/…</code>) : bash le lit là, pendant que <strong>stdin reste ton '
         'terminal</strong>. Le menu fonctionne donc normalement. (Nécessite <code>bash</code> — pas '
         '<code>sh</code>.)'),

    '<h3>② Télécharger puis exécuter</h3>',
    '<p>Pour garder le script sous la main (et le relire — il est commenté) :</p>',
    '<div class="proc-cmd">curl -fsSL ' + URL + ' -o tssr-toolbox.sh\n'
    'chmod +x tssr-toolbox.sh\n'
    'sudo ./tssr-toolbox.sh</div>',
    '<p>Ou avec <code>wget</code> :</p>',
    '<div class="proc-cmd">wget -qO tssr-toolbox.sh ' + URL + ' &amp;&amp; chmod +x tssr-toolbox.sh &amp;&amp; sudo ./tssr-toolbox.sh</div>',

    '<h3>③ Vérifier l’intégrité avant d’exécuter (recommandé)</h3>',
    '<p>Comme le script se lance <strong>en root</strong>, on vérifie sa somme SHA-256 '
    '(publiée dans <a href="https://tssr.miyukini.com/SHA256SUMS">SHA256SUMS</a>) avant de l’exécuter :</p>',
    '<div class="proc-cmd">curl -fsSL ' + URL + ' -o tssr-toolbox.sh\n'
    'curl -fsSL https://tssr.miyukini.com/SHA256SUMS -o SHA256SUMS\n'
    'sha256sum --ignore-missing -c SHA256SUMS &amp;&amp; sudo ./tssr-toolbox.sh</div>',
    note('gray', '🔐 Portée de la vérification',
         'La somme et le script étant servis par le même site, cela protège surtout d’un '
         '<strong>téléchargement partiel ou altéré</strong> (cache, coupure). Pour une garantie '
         'forte contre une modification, compare la somme à celle <strong>communiquée en cours</strong> '
         '(hors ligne).'),

    '<h2>Les séquences du menu</h2>',
    tab(['#', 'Séquence', 'Gate de validation'], [
        ['1', 'Statut &amp; tests rapides — IP, DHCP/statique, passerelle, DNS, '
              'pings (passerelle, DNS, 8.8.8.8, google.fr), <code>df -h</code>, '
              '<code>free -h</code>, <code>uptime -p</code>', 'une IP est détectée'],
        ['2', 'Paquets de base — curl, git, vim, htop, tree, net-tools, ufw, sudo', 'chaque outil répond'],
        ['3', 'Config IP statique — réécrit <code>/etc/network/interfaces</code>, redémarre le réseau '
              '(sauvegarde l’ancienne conf)', 'l’IP est active sur l’interface'],
        ['4', 'Durcissement SSH — port personnalisé (ex. 2222), <code>PermitRootLogin no</code>, '
              '<code>sshd -t</code> avant redémarrage', 'SSH écoute sur le nouveau port'],
        ['5', 'Créer un utilisateur — mot de passe lab <code>Azerty77</code> ou aléatoire, option '
              'sudo, option invite colorée (statut ✔/✘ + chemin absolu)', 'le compte existe'],
        ['6', 'Serveur web <strong>Apache</strong> + MariaDB + PHP — base locale ou distante, '
              'page de test de la connexion', 'service actif + PHP exécuté'],
        ['7', 'Serveur web <strong>nginx</strong> + MariaDB + PHP', 'service actif + PHP exécuté'],
        ['8', 'Bastion <strong>Apache Guacamole</strong> (guacd + base + webapp, en Docker)', 'webapp sur :8080'],
        ['9', 'Serveur <strong>GLPI</strong> — LAMP + extensions + base dédiée + dépôt', '<code>/glpi</code> répond'],
        ['10', 'Sauvegarde — <code>/etc</code> + <code>/home</code> dans '
               '<code>/var/backups/backup_AAAA-MM-JJ.tar.gz</code>', 'archive présente et intègre'],
    ]),

    note('gray', '🧭 Les règles communes à toutes les séquences',
         'Un <strong>menu principal</strong> (avec une entrée <em>Quitter</em>) ; après chaque '
         'séquence, <strong>Entrée</strong> = revenir au menu (par défaut) ou <strong>Q</strong> = '
         'quitter ; en cas d’<strong>erreur</strong>, création d’un <strong>journal</strong> '
         '(<code>/var/log/tssr-toolbox/…</code>), explication du <em>pourquoi</em>, puis retour au '
         'menu principal.'),

    note('yellow', '⚠️ À savoir avant de lancer',
         'Les séquences d’installation demandent <strong>root</strong> (<code>sudo</code>). '
         '<strong>Config IP</strong> et <strong>SSH</strong> peuvent couper une session distante : '
         'garde un accès console de secours (le script sauvegarde les fichiers modifiés et teste la '
         'conf SSH avant de redémarrer). Les mots de passe de démonstration '
         '(<code>Azerty77</code>) sont à durcir hors TP.'),

    note('green', '🏁 À retenir',
         'Un outil unique, <strong>commenté pour les étudiants</strong> et balisé '
         '<strong>MSCM</strong>, qui transforme les gestes d’administration répétés en séquences '
         '<strong>validées</strong> et <strong>tracées</strong>. On apprend en lisant le script '
         'autant qu’en l’utilisant.'),

    note('gray', '🔗 À rapprocher',
         '<a href="/pages/procedure-bashrc-couleurs">Prompt coloré + tree</a> · '
         '<a href="/pages/configurateur-nginx-mariadb">Configurateur nginx + MariaDB</a> · '
         '<a href="/pages/procedures">Toutes les procédures</a>.'),
])

# ── carte dans le hub Outils (section Linux) ──────────────────────────────────
CARTE = ('<a class="script-card" href="/pages/outil-boite-debian"><div class="sc-top">'
         '<span class="sc-ico">🧰</span><span class="sc-badge sc-badge-int">📜 Script</span></div>'
         '<div class="sc-title">Boîte à outils Debian — administration TSSR</div>'
         '<div class="sc-desc meta">Script bash interactif : menu + séquences (statut, paquets, IP, '
         'SSH, utilisateur, web Apache/nginx, bastion, GLPI, sauvegarde), chacune avec gate de '
         'validation et journal des erreurs. Récupérable en une ligne.</div>'
         '<div class="sc-tags"><span class="sc-pill">Debian</span><span class="sc-pill">bash</span>'
         '<span class="sc-pill">admin</span><span class="sc-pill">TP</span></div></a>')


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
    return f'carte ajoutée (section Linux {n}, total {total})'


if __name__ == '__main__':
    c = sqlite3.connect(BASE)
    print(SLUG, ':', publier(c, SLUG, TITRE, EXTRAIT, CONTENU))
    print('outils :', ranger_outil(c).encode('ascii', 'replace').decode())
    c.commit()
    c.close()
    sys.exit(0)

# -*- coding: utf-8 -*-
"""
Un cours de fond : durcir un serveur Linux (hardening).

D'OÙ VIENT LE CONTENU
Un guide « Hardening Linux » (famille Red Hat : RHEL/Rocky/Alma) couvrant mises
à jour, synchronisation de l'heure, comptes & privilèges, politique de mots de
passe, permissions et permissions spéciales (SUID/SGID/sticky), sysctl, SSH,
firewalld, SELinux (en profondeur), services & paquets, Fail2ban, sauvegardes,
journalisation, auditd, GRUB, et audit final (Lynis/OpenSCAP + check-list).

POURQUOI UNE PAGE NEUVE
Le site sécurise SSH (tp-ssh-securisation, linux-ssh) et parle de firewalld par
petites touches, mais n'a pas de cours *méthodique* de durcissement d'un serveur
— réduire la surface d'attaque, moindre privilège, défense en profondeur. C'est
un attendu métier et d'examen. On le range dans la catégorie Linux, dans un
sous-groupe « Sécurité & durcissement » créé au besoin.

ORIENTATION RHEL, avec les équivalents Debian signalés (apt, ufw/nftables,
AppArmor), puisque la catégorie Linux du site est surtout Debian mais qu'il
existe déjà un cours `linux-redhat`.

IDEMPOTENT : relancer met à jour la page, ne duplique pas sa carte, recompte.
"""
import sys

from _cours import (Categorie, STYLE, acc, bullets, cmd, hero, note,
                    publier_lot, retenir, tab)

LINUX = Categorie('cat-linux', '🐧', 'Linux', '', '#0ea5e9')
SG = 'Sécurité &amp; durcissement'


def qr(q, a):
    return (f'<p style="border:1px solid var(--border);border-left:3px solid var(--accent);'
            f'background:var(--surface-2);border-radius:8px;padding:9px 13px;margin:9px 0">'
            f'<span style="font-weight:600">{q}</span> '
            f'<span style="color:var(--text-soft);font-size:13.5px">{a}</span></p>')


def toc(items):
    liens = ''.join(
        f'<a href="#{a}" style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;'
        f'font-weight:600;color:var(--text-soft);text-decoration:none;border:1px solid var(--border);'
        f'border-radius:999px;padding:4px 11px;background:var(--surface)">{t}</a>' for a, t in items)
    return (f'<nav style="display:flex;flex-wrap:wrap;gap:7px;margin:6px 0 18px">{liens}</nav>')


# ── un schéma : la défense en profondeur ─────────────────────────────────────
SVG_COUCHES = (
    '<svg viewBox="0 0 560 300" role="img" aria-label="La défense en profondeur : plusieurs couches '
    'de protection concentriques autour des données, du périmètre réseau jusqu’à SELinux" '
    'style="max-width:560px;width:100%;height:auto;margin:10px 0 14px;font-family:system-ui,sans-serif">'
    '<rect x="20" y="20" width="520" height="260" rx="12" fill="#0c4a6e"/>'
    '<text x="280" y="40" text-anchor="middle" font-size="11.5" fill="#e0f2fe" font-weight="bold">firewalld — n’ouvrir que les ports utiles</text>'
    '<rect x="60" y="52" width="440" height="212" rx="11" fill="#075985"/>'
    '<text x="280" y="72" text-anchor="middle" font-size="11.5" fill="#e0f2fe" font-weight="bold">SSH durci — clés, root interdit, AllowGroups, Fail2ban</text>'
    '<rect x="100" y="84" width="360" height="164" rx="10" fill="#0369a1"/>'
    '<text x="280" y="104" text-anchor="middle" font-size="11.5" fill="#e0f2fe" font-weight="bold">Comptes &amp; sudo — moindre privilège</text>'
    '<rect x="140" y="116" width="280" height="116" rx="9" fill="#0284c7"/>'
    '<text x="280" y="136" text-anchor="middle" font-size="11.5" fill="#fff" font-weight="bold">Permissions &amp; SELinux</text>'
    '<text x="280" y="151" text-anchor="middle" font-size="9.5" fill="#e0f2fe">contrôle d’accès obligatoire (MAC)</text>'
    '<rect x="188" y="160" width="184" height="60" rx="8" fill="#38bdf8"/>'
    '<text x="280" y="185" text-anchor="middle" font-size="12.5" fill="#0c4a6e" font-weight="bold">🎯 Les données</text>'
    '<text x="280" y="203" text-anchor="middle" font-size="9.5" fill="#0c4a6e">service, base, fichiers</text>'
    '<text x="280" y="288" text-anchor="middle" font-size="10" style="fill:var(--text-soft)">'
    'Aucune couche ne suffit seule — si l’une cède, la suivante contient les dégâts</text>'
    '</svg>')


PAGE = '\n'.join([
    hero('Cours · Linux', 'Durcir un serveur Linux (hardening)',
         'Réduire la surface d’attaque et contenir une compromission, sans casser le service. Mises '
         'à jour, comptes & sudo, SSH, firewalld, SELinux, permissions, Fail2ban, journalisation et '
         'audit — la méthode de durcissement d’un serveur de la famille Red Hat, applicable aussi à '
         'Debian.'),
    STYLE,
    note('blue', '🎯 De quoi on parle',
         'Le <strong>durcissement</strong> (<em>hardening</em>) rassemble les mesures qui '
         '<strong>réduisent la surface d’attaque</strong> d’un serveur et limitent les dégâts en cas '
         'de compromission. Trois idées le traversent de bout en bout : <strong>réduire</strong> '
         '(moins de services, de ports, de comptes, de droits), <strong>moindre privilège</strong> '
         '(chacun juste ce qu’il lui faut) et <strong>défense en profondeur</strong> (plusieurs '
         'couches, pour qu’aucune faille unique ne suffise). Le guide vise la famille '
         '<strong>Red Hat</strong> (<a href="/pages/linux-redhat">RHEL/Rocky/Alma</a> : '
         '<code>dnf</code>, <code>firewalld</code>, SELinux) ; les équivalents Debian sont signalés.'),
    SVG_COUCHES,
    note('yellow', '⚠️ Avant de commencer — ne jamais se verrouiller dehors',
         'Le durcissement peut couper un service ou un accès distant. Avant toute intervention : un '
         '<strong>snapshot</strong> de la VM ou une sauvegarde récente, une <strong>fenêtre de '
         'maintenance</strong>, un test en préproduction, et surtout un <strong>accès console</strong> '
         '(hyperviseur ou physique) conservé pendant toute l’opération — une erreur sur SSH, le '
         'pare-feu ou SELinux peut rendre le serveur injoignable par le réseau. Documenter chaque '
         'paramètre d’origine avant de le changer.'),

    toc([('maj', '1 · Mises à jour'), ('heure', '2 · Heure'), ('comptes', '3 · Comptes &amp; sudo'),
         ('mdp', '4 · Mots de passe'), ('perm', '5 · Permissions'), ('special', '6 · SUID/SGID'),
         ('sysctl', '7 · Noyau (sysctl)'), ('ssh', '8 · SSH'), ('firewalld', '9 · firewalld'),
         ('selinux', '10 · SELinux'), ('services', '11 · Services &amp; paquets'),
         ('fail2ban', '12 · Fail2ban'), ('journaux', '13 · Journaux &amp; audit'),
         ('grub', '14 · GRUB'), ('audit', '15 · Auditer'), ('checklist', '✅ Check-list')]),

    '<h2 id="maj">1) Maintenir le système à jour</h2>',
    '<p>La première mesure, et la plus rentable. Un serveur non à jour reste exposé à des failles '
    '<strong>connues et documentées</strong> que des outils automatisés cherchent en permanence.</p>',
    cmd('sudo dnf check-update          # ce qui peut etre mis a jour\nsudo dnf upgrade               # tout appliquer\nsudo dnf needs-restarting -r   # un redemarrage est-il necessaire ? (noyau, libs critiques)\n# Debian : sudo apt update && sudo apt full-upgrade'),
    bullets('Installer <strong>régulièrement</strong> les correctifs de sécurité — ne pas attendre des mois.',
            'Vérifier que les dépôts configurés sont <strong>officiels et fiables</strong>.',
            'Tester en préproduction avant un serveur critique ; <strong>planifier les redémarrages</strong> '
            '(<code>sudo shutdown -h 23:00</code>) pour limiter les interruptions.'),

    '<h2 id="heure">2) Synchroniser l’heure</h2>',
    '<p>Souvent négligée, l’heure conditionne pourtant l’authentification, la validité des '
    '<strong>certificats</strong> et la corrélation des journaux lors d’un incident. Sous RHEL, '
    'c’est <code>chronyd</code> (protocole NTP).</p>',
    cmd('timedatectl                    # date, fuseau, "clock synchronized: yes"\nsudo systemctl status chronyd\nchronyc sources                # les sources ; l\'asterisque = celle utilisee\nchronyc tracking               # decalage et qualite de la synchro'),
    note('gray', '🏢 En entreprise',
         'On synchronise les serveurs sur une <strong>source de temps interne</strong> (un serveur '
         'NTP local) plutôt que sur des serveurs publics : gestion centralisée, moins de dépendances '
         'externes, heure cohérente sur toute l’infrastructure. La config de chrony est dans '
         '<code>/etc/chrony.conf</code> (directives <code>server</code> / <code>pool … iburst</code>).'),

    '<h2 id="comptes">3) Comptes utilisateurs et privilèges</h2>',
    '<p>Chaque compte est un point d’entrée. On applique le <strong>moindre privilège</strong> : le '
    'moins de comptes possible, juste les droits nécessaires, et les comptes inutiles supprimés.</p>',
    cmd('cat /etc/passwd                          # les comptes declares\ngrep "/bin/bash\\|/bin/sh" /etc/passwd     # ceux qui ont un shell de connexion\nsudo usermod -L compte                    # verrouiller / -U pour deverrouiller\nsudo userdel -r compte                    # supprimer (et son /home)'),
    '<h3>Privilégier sudo, éviter root au quotidien</h3>',
    '<p>Le compte <code>root</code> a tout pouvoir : une erreur ou une commande malveillante sous ce '
    'compte est sans filet. On se connecte avec un compte <strong>nominatif</strong> et on élève '
    'juste ce qu’il faut avec <code>sudo</code> (ou <code>sudo -i</code> pour un shell admin), ce qui '
    '<strong>trace</strong> en prime les commandes privilégiées dans les journaux.</p>',
    cmd('sudo usermod -aG wheel compte    # groupe wheel = sudoers sous RHEL (Debian : sudo)\nsudo visudo                      # TOUJOURS editer /etc/sudoers via visudo (verifie la syntaxe)\ngetent group wheel               # qui a les droits admin ? chacun doit etre justifie'),
    note('yellow', '⚠️ Ne jamais éditer /etc/sudoers directement',
         'Une faute de syntaxe dans <code>/etc/sudoers</code> peut <strong>bloquer toute élévation '
         'de privilèges</strong> sur le serveur. <code>visudo</code> vérifie la syntaxe avant '
         'd’enregistrer — c’est le seul moyen sûr.'),

    '<h2 id="mdp">4) Politique de mots de passe</h2>',
    '<p>Même quand on privilégie les clés SSH pour l’administration, les comptes locaux doivent '
    'respecter des règles. Sous RHEL, la complexité passe par le module PAM <code>pam_pwquality</code> '
    '(<code>/etc/security/pwquality.conf</code>) et l’expiration par <code>/etc/login.defs</code>.</p>',
    cmd('# /etc/security/pwquality.conf\nminlen = 14        # longueur mini\nminclass = 3       # au moins 3 familles (minuscule/majuscule/chiffre/special)\nmaxrepeat = 3      # pas plus de 3 caracteres repetes\n\n# /etc/login.defs (nouveaux comptes seulement)\nPASS_MAX_DAYS 90   PASS_MIN_DAYS 1   PASS_WARN_AGE 7\n\n# un compte existant : chage\nsudo chage -M 90 -m 1 -W 7 utilisateur\nsudo chage -l utilisateur          # consulter'),
    note('gray', '📌 Ce que disent les recommandations récentes',
         'Le <strong>NIST</strong> privilégie désormais des <strong>phrases de passe longues</strong> '
         'plutôt que des règles de complexité très contraignantes, et déconseille le '
         '<strong>changement périodique imposé</strong> (sauf compromission). Et en entreprise, '
         'l’authentification est souvent <strong>centralisée</strong> (Active Directory, FreeIPA, '
         'LDAP) : la politique se définit alors dans l’annuaire, et les réglages locaux ne '
         's’appliquent qu’aux comptes locaux.'),

    '<h2 id="perm">5) Permissions des fichiers</h2>',
    '<p>La première couche de protection des fichiers. Trois ensembles (propriétaire <code>u</code>, '
    'groupe <code>g</code>, autres <code>o</code>) et trois droits (<code>r</code> lecture, '
    '<code>w</code> écriture, <code>x</code> exécution). <code>-rwxr-x---</code> se lit : tout pour '
    'le propriétaire, lecture+exécution pour le groupe, rien pour les autres.</p>',
    cmd('ls -l fichier                        # voir les permissions\nchmod 640 fichier.txt                # u=rw, g=r, o=rien (ou notation u+x)\nsudo chown apache:apache index.html  # proprietaire:groupe\numask                                # permissions par defaut des nouveaux fichiers (0022 -> 644/755)'),
    '<p>Vérifier régulièrement les fichiers sensibles : <code>/etc/passwd</code>, '
    '<code>/etc/shadow</code> (accessible au seul <code>root</code>), '
    '<code>/etc/ssh/sshd_config</code>, <code>/root</code>.</p>',
    bullets('Appliquer le <strong>moindre privilège</strong> : limiter l’écriture aux seuls autorisés.',
            'Contrôler le <strong>propriétaire</strong> après une copie ou une restauration.',
            'Éviter le <strong>777</strong> sauf cas exceptionnel et parfaitement maîtrisé.',
            'SELinux (§10) et permissions classiques sont <strong>complémentaires</strong>, pas '
            'concurrents. Les deux comptent — voir aussi <a href="/pages/linux-droits">Utilisateurs, '
            'droits et sudo</a> et <a href="/pages/linux-acl">les ACL</a>.'),

    '<h2 id="special">6) Permissions spéciales : SUID, SGID, Sticky Bit</h2>',
    '<p>Trois bits modifient le comportement à l’exécution. Nécessaires à certains programmes, ils '
    'sont aussi un risque : on les <strong>inventorie</strong> régulièrement.</p>',
    tab(['Bit', 'Effet', 'Exemple'], [
        ['<strong>SUID</strong> (<code>-rwsr-xr-x</code>)',
         'Le programme s’exécute avec les droits de son <strong>propriétaire</strong>, pas de qui le lance',
         '<code>passwd</code> modifie <code>/etc/shadow</code> (réservé à root) sans donner root à l’utilisateur'],
        ['<strong>SGID</strong> (<code>-rwxr-sr-x</code>)',
         'Droits du <strong>groupe</strong> propriétaire (fichier) ; héritage du groupe (répertoire partagé)',
         'Répertoire partagé entre plusieurs admins'],
        ['<strong>Sticky Bit</strong> (<code>drwxrwxrwt</code>)',
         'Seul le propriétaire d’un fichier (ou root) peut le supprimer dans le répertoire',
         '<code>/tmp</code>'],
    ]),
    cmd('find / -perm -4000 -type f 2>/dev/null   # tous les SUID\nfind / -perm -2000 -type f 2>/dev/null   # tous les SGID\nsudo chmod u-s fichier                   # retirer le SUID (g-s pour SGID, -t pour sticky)'),
    note('yellow', '⚠️ Comprendre avant de retirer',
         'La présence d’un SUID/SGID n’est pas anormale — beaucoup de commandes système en ont '
         'besoin. L’audit consiste à vérifier que chaque fichier concerné provient d’un '
         '<strong>paquet légitime</strong> et reste justifié. Retirer un bit sur un binaire système '
         'peut l’empêcher de fonctionner : on comprend le rôle du programme avant d’y toucher, et on '
         'se méfie surtout des SUID sur des programmes <strong>maison</strong>.'),

    '<h2 id="sysctl">7) Renforcer le noyau avec sysctl</h2>',
    '<p>Le noyau expose de nombreux paramètres (sous <code>/proc/sys</code>) qui pilotent la pile '
    'réseau et la mémoire. On les durcit via <code>sysctl</code>, en rendant les changements '
    '<strong>permanents</strong> dans un fichier dédié.</p>',
    cmd('# /etc/sysctl.d/99-hardening.conf\nnet.ipv4.conf.all.accept_redirects = 0     # ignorer les redirections ICMP (attaques de reroutage)\nnet.ipv4.conf.all.send_redirects = 0       # un serveur n\'est pas un routeur\nnet.ipv4.conf.all.rp_filter = 1            # anti-usurpation d\'IP (spoofing)\nnet.ipv4.ip_forward = 0                    # pas de routage IP (sauf routeur)\nkernel.randomize_va_space = 2              # ASLR : rend l\'exploitation memoire plus dure\n\nsudo sysctl --system                       # appliquer\nsudo sysctl -a | grep randomize            # verifier un parametre'),
    note('gray', '📝 Prudence',
         'On ne modifie que les paramètres <strong>compris et documentés</strong>, on teste en '
         'préproduction, et on garde les réglages personnalisés dans un fichier dédié sous '
         '<code>/etc/sysctl.d/</code> pour la maintenance.'),

    '<h2 id="ssh">8) Sécuriser SSH</h2>',
    '<p>SSH est le principal moyen d’administration <em>et</em> l’un des services les plus attaqués '
    '(force brute, identifiants volés, config bancale). Toujours <strong>vérifier la syntaxe</strong> '
    'avant de recharger — pour ne pas se couper l’accès.</p>',
    cmd('sudo sshd -t                       # verifier la config AVANT\nsudo systemctl reload sshd         # applique sans couper les sessions ouvertes'),
    tab(['Directive (<code>/etc/ssh/sshd_config</code>)', 'Valeur', 'Effet'], [
        ['<code>PermitRootLogin</code>', '<code>no</code>', 'Interdire la connexion directe de root'],
        ['<code>PasswordAuthentication</code>', '<code>no</code>', 'Clés seulement — une fois les clés déployées'],
        ['<code>AllowUsers</code> / <code>AllowGroups</code>', '<code>sshadmins</code>', 'Restreindre qui peut se connecter'],
        ['<code>MaxAuthTries</code>', '<code>3</code>', 'Moins de tentatives par connexion'],
        ['<code>LoginGraceTime</code>', '<code>30</code>', 'Délai max pour s’authentifier'],
        ['<code>ClientAliveInterval</code> / <code>...CountMax</code>', '<code>300</code> / <code>0</code>',
         'Fermer les sessions inactives (5 min)'],
        ['<code>Port</code>', '<code>2222</code>', 'Réduit le bruit des scans (pas une sécurité en soi)'],
    ]),
    '<h3>L’authentification par clés</h3>',
    cmd('ssh-keygen -t ed25519                 # sur le POSTE admin (jamais copier la cle privee !)\nssh-copy-id utilisateur@serveur       # depose la cle publique dans ~/.ssh/authorized_keys\nchmod 700 ~/.ssh ; chmod 600 ~/.ssh/authorized_keys   # sinon OpenSSH refuse les cles'),
    note('yellow', '⚠️ L’ordre qui évite le verrouillage',
         'Ne jamais couper <code>PasswordAuthentication</code> ni <code>PermitRootLogin</code> sans '
         'avoir <strong>vérifié dans une nouvelle session</strong> qu’au moins un compte non-root '
         'passe par clé <em>et</em> dispose de sudo. Même précaution que sur '
         '<a href="/pages/tp-opnsense-dmz">webdmz au TP 1.4</a>. Détail pas à pas : '
         '<a href="/pages/tp-ssh-securisation">TP — sécuriser SSH</a> et '
         '<a href="/pages/linux-ssh">SSH serveur sous Linux</a>. Changer le port suppose aussi de '
         'l’ouvrir dans firewalld <em>et</em> de le déclarer à SELinux (§10).'),

    '<h2 id="firewalld">9) Le pare-feu : firewalld</h2>',
    '<p>Sous RHEL, <code>firewalld</code> gère dynamiquement le filtrage, en <strong>zones</strong> '
    '(un niveau de confiance par interface). La règle : n’ouvrir que les ports <strong>strictement '
    'nécessaires</strong>. (Debian : <code>ufw</code> ou <code>nftables</code>.)</p>',
    cmd('sudo firewall-cmd --get-active-zones      # la zone active\nsudo firewall-cmd --list-all              # ses regles\nsudo firewall-cmd --permanent --add-service=ssh\nsudo firewall-cmd --permanent --add-service=https\nsudo firewall-cmd --permanent --add-port=8080/tcp\nsudo firewall-cmd --reload                # appliquer les regles --permanent'),
    note('gray', '💡 --permanent, sinon rien ne survit',
         'Une règle sans <code>--permanent</code> est <strong>temporaire</strong> (perdue au '
         'redémarrage). On ajoute donc <code>--permanent</code>, puis <code>--reload</code>. Autoriser '
         'un <em>service</em> connu (<code>--add-service</code>) est préférable à un numéro de port '
         'brut quand il existe.'),

    '<h2 id="selinux">10) SELinux : le contrôle d’accès obligatoire</h2>',
    '<p>SELinux (Security-Enhanced Linux) ajoute un <strong>contrôle d’accès obligatoire (MAC)</strong> '
    'par-dessus les permissions classiques : il définit précisément ce que <em>chaque processus</em> '
    'a le droit de faire. Même si un service exposé est compromis, SELinux <strong>limite</strong> ce '
    'que l’attaquant peut en faire. On ne le désactive pas sur un serveur de production : on '
    'diagnostique et on adapte.</p>',
    cmd('getenforce                         # Enforcing / Permissive / Disabled\nsestatus                           # etat detaille\n# Enforcing = applique et bloque (le mode recommande en production)'),
    '<h3>Les contextes de sécurité</h3>',
    '<p>Chaque fichier, processus et port porte un <strong>contexte</strong> — une étiquette à quatre '
    'champs. SELinux vérifie que le contexte du processus est autorisé à accéder au contexte de la '
    'ressource. Un serveur Apache peut avoir les permissions Linux pour lire un fichier et se voir '
    '<em>quand même</em> refuser l’accès si le <strong>type</strong> ne correspond pas.</p>',
    cmd('system_u : object_r : httpd_sys_content_t : s0\n  \\____ user ___/  \\_ role _/  \\____ TYPE (le principal) ___/  \\ niveau (MLS)\n\nls -Z fichier                      # contexte d\'un fichier\nps -auxZ | grep httpd              # contexte d\'un processus (ex : httpd_t)\nsudo semanage port -l | grep ssh   # ports autorises (ex : ssh_port_t tcp 22)'),
    tab(['Domaine du processus', 'Service confiné'], [
        ['<code>httpd_t</code>', 'Serveur web Apache'],
        ['<code>sshd_t</code>', 'Service SSH'],
        ['<code>named_t</code>', 'Serveur DNS'],
        ['<code>mysqld_t</code>', 'MariaDB / MySQL'],
    ]),
    note('gray', '🧩 « unconfined » ne veut pas dire « sans sécurité »',
         'La politique par défaut est <strong>targeted</strong> : elle confine surtout les services '
         'réseau sensibles. Un administrateur connecté en SSH tourne souvent dans le domaine peu '
         'restreint <code>unconfined_t</code> — mais SELinux <em>fonctionne toujours</em> : les '
         'journaux sont générés et les services (<code>httpd_t</code>, <code>sshd_t</code>…) restent '
         'confinés par leurs propres domaines.'),
    '<h3>Corriger un contexte, un port, un booléen</h3>',
    cmd('# contexte de fichier (ex : apres avoir deplace du contenu web)\nsudo restorecon -Rv /var/www/html/                       # remet le contexte attendu\nsudo semanage fcontext -a -t httpd_sys_content_t "/srv/site(/.*)?"\nsudo restorecon -Rv /srv/site                            # rendre permanent\n\n# port non standard (SSH sur 2222)\nsudo semanage port -a -t ssh_port_t -p tcp 2222\n\n# booleen : autoriser un comportement prevu par la politique\nsudo setsebool -P httpd_read_user_content on              # -P = permanent'),
    note('yellow', '🔍 Diagnostiquer un blocage — pas le désactiver',
         'Quand un service a les permissions Linux mais n’accède pas à une ressource, SELinux est '
         'souvent en cause (mauvais contexte, port non déclaré, ou booléen à activer). L’outil '
         '<code>sealert -a /var/log/audit/audit.log</code> (paquet '
         '<code>setroubleshoot-server</code>) analyse les refus et <strong>propose le correctif</strong> '
         '(souvent un <code>setsebool</code>). <code>ausearch -m AVC -ts recent</code> montre les '
         'refus bruts. <code>audit2allow</code> peut générer une règle — mais en '
         '<strong>dernier recours</strong> seulement, après avoir vérifié contexte, port et booléens : '
         'ses règles automatiques sont souvent trop permissives. Outils : '
         '<code>dnf install policycoreutils-python-utils setroubleshoot-server</code>.'),

    '<h2 id="services">11) Services et paquets inutiles</h2>',
    '<p>Chaque service actif et chaque paquet installé est une surface d’attaque potentielle — même '
    'inutilisé, il peut contenir une faille. On ne garde que le nécessaire au rôle du serveur.</p>',
    cmd('systemctl list-units --type=service --state=running   # services actifs\nsudo systemctl disable --now cups                     # arreter + desactiver au boot\n\ndnf list installed                                    # paquets installes\nsudo dnf remove paquet_inutile\nrpm -V paquet                                         # verifier l\'integrite d\'un paquet'),
    note('gray', '📌 Vérifier avant de couper',
         'Contrôler les <strong>dépendances</strong> avant de désactiver un service ou de retirer un '
         'paquet, et repasser régulièrement la liste des services actifs pour repérer l’apparition '
         'd’un service non voulu.'),

    '<h2 id="fail2ban">12) Fail2ban contre le bruteforce</h2>',
    '<p>Fail2ban surveille les journaux et <strong>bannit temporairement</strong> les IP qui '
    'multiplient les échecs d’authentification. Un complément (pas un remplaçant) des clés SSH, du '
    'pare-feu et d’une bonne politique de mots de passe. Sous RHEL, via le dépôt EPEL.</p>',
    cmd('sudo dnf install epel-release && sudo dnf install fail2ban\nsudo systemctl enable --now fail2ban\n\n# /etc/fail2ban/jail.local  (ne pas editer jail.conf directement)\n[sshd]\nenabled = true\nport = ssh\nmaxretry = 5\nfindtime = 10m\nbantime = 1h\n\nsudo fail2ban-client status sshd    # IP bannies, compteurs'),

    '<h2 id="journaux">13) Journalisation, surveillance et audit</h2>',
    '<p>Sans journaux, un serveur est une boîte noire. <code>journalctl</code> donne les événements '
    'système ; <code>auditd</code> ajoute une traçabilité <strong>orientée sécurité</strong> '
    '(authentifications, accès aux fichiers sensibles, commandes privilégiées).</p>',
    cmd('journalctl -p err                  # les erreurs recentes\njournalctl -u sshd                 # un service precis\njournalctl -f                      # en temps reel\n\nsudo systemctl enable --now auditd\nsudo ausearch -m USER_LOGIN        # tentatives d\'authentification\nsudo aureport --login              # rapport de synthese des connexions\nsudo aureport --exec               # commandes executees'),
    note('gray', '📊 Doser',
         'Une journalisation <strong>trop</strong> abondante sature le disque et noie les événements '
         'importants. RHEL fournit déjà des règles d’audit adaptées (<code>/etc/audit/rules.d/</code>, '
         '<code>auditctl -l</code>) : on vérifie l’existant avant d’ajouter des règles. Idéalement, '
         'on <strong>centralise</strong> les journaux sur un serveur dédié (voir '
         '<a href="/pages/linux-cron-logs">Planification &amp; journaux</a> et '
         '<a href="/pages/la-supervision">la supervision</a>).'),

    '<h2 id="grub">14) Protéger le chargeur de démarrage (GRUB)</h2>',
    '<p>Toutes les mesures ci-dessus supposent un accès par le réseau ou un compte authentifié. Mais '
    'un <strong>accès physique ou à la console de l’hyperviseur</strong> permet de contourner le tout '
    'en éditant le menu GRUB au démarrage (ajouter <code>init=/bin/bash</code>, passer en '
    '<em>single-user</em>) pour obtenir un shell root <strong>sans mot de passe et sans trace</strong>. '
    'On protège donc GRUB par mot de passe.</p>',
    cmd('sudo grub2-setpassword                          # demande et hache le mot de passe\nsudo grub2-mkconfig -o /boot/grub2/grub.cfg     # regenerer la config'),
    note('yellow', '⚠️ Un mot de passe à ne pas perdre',
         'Conserver ce mot de passe dans un coffre-fort séparé et une procédure documentée : en cas '
         'd’oubli, la récupération exige un support de démarrage externe et peut immobiliser le '
         'serveur. Vérifier après chaque mise à jour du noyau que la protection reste active. Elle ne '
         'remplace pas un <strong>contrôle d’accès physique</strong> rigoureux.'),

    '<h2 id="audit">15) Vérifier le niveau de sécurité</h2>',
    '<p>Appliquer des mesures ne prouve pas qu’elles sont complètes et cohérentes. Deux outils '
    'automatisent la vérification :</p>',
    tab(['Outil', 'Ce qu’il fait'], [
        ['<strong>Lynis</strong>', 'Audit de durcissement : config, services, permissions, SSH, '
         'pare-feu, noyau, journaux → <em>warnings</em>, <em>suggestions</em> et un '
         '<strong>Hardening Index</strong> (à suivre dans le temps, ce n’est pas une certification)'],
        ['<strong>OpenSCAP</strong>', 'Vérifie la <strong>conformité</strong> à un référentiel '
         '(CIS, profils Red Hat) — pour les environnements soumis à audit'],
    ]),
    cmd('sudo dnf install epel-release && sudo dnf install lynis\nsudo lynis audit system'),
    note('gray', '🧠 L’outil ne remplace pas l’analyse',
         'Les audits repèrent vite des oublis, mais certaines recommandations ne conviennent pas au '
         'rôle du serveur : on <strong>analyse</strong> les résultats avant d’appliquer. On complète '
         'toujours par une revue humaine de la configuration.'),

    '<h2 id="checklist">✅ Check-list avant mise en production</h2>',
    acc(
        ('Système & comptes',
         '<ul class="proc-steps"><li>Système entièrement à jour ; paquets et services inutiles '
         'retirés/désactivés.</li><li>Comptes inutilisés supprimés ; droits limités au nécessaire ; '
         'administration via <code>sudo</code>.</li></ul>'),
        ('SSH',
         '<ul class="proc-steps"><li>Root direct désactivé ; authentification par clés ; mot de passe '
         'coupé si possible.</li><li>Utilisateurs autorisés limités ; <code>MaxAuthTries</code>, '
         '<code>LoginGraceTime</code>, sessions inactives configurés ; port changé si la PSSI le '
         'prévoit.</li></ul>'),
        ('Pare-feu & SELinux',
         '<ul class="proc-steps"><li>firewalld actif, seuls les services nécessaires ouverts, règles '
         'inutiles retirées.</li><li>SELinux en <strong>Enforcing</strong> ; contextes corrects ; '
         'ports déclarés ; booléens vérifiés avant toute règle personnalisée.</li></ul>'),
        ('Protection & résilience',
         '<ul class="proc-steps"><li>Fail2ban installé si nécessaire ; GRUB protégé sur les serveurs '
         'à accès physique/console.</li><li>Stratégie de sauvegarde (<strong>3-2-1</strong> : 3 '
         'copies, 2 supports, 1 hors site) et restauration <strong>testée</strong>.</li><li>Journaux '
         'consultés régulièrement ; <code>auditd</code> actif.</li></ul>'),
    ),

    retenir(
        'Trois principes : <strong>réduire</strong> la surface (services, ports, comptes, droits), '
        '<strong>moindre privilège</strong>, <strong>défense en profondeur</strong>.',
        'À jour + heure juste : la base. Un serveur non patché est une cible connue ; une horloge '
        'fausse casse certificats et journaux.',
        'SSH : <strong>clés</strong>, root interdit, utilisateurs limités, et toujours '
        '<code>sshd -t</code> avant de recharger — pour ne pas se verrouiller.',
        'firewalld n’ouvre que l’utile ; <strong>SELinux</strong> reste en Enforcing — on le '
        'diagnostique (<code>sealert</code>), on ne le désactive pas.',
        'Fail2ban, journaux, <code>auditd</code>, GRUB et <strong>sauvegardes testées</strong> '
        'complètent le tableau ; Lynis/OpenSCAP mesurent le résultat.',
        'Le durcissement n’est pas un acte unique : il fait partie du <strong>cycle de vie</strong> '
        'du serveur (mises à jour, revue des journaux et des configs, tests de restauration).',
    ),
    note('green', '➡️ À rapprocher',
         '<a href="/pages/linux-redhat">Rocky Linux &amp; la famille Red Hat</a> · '
         '<a href="/pages/linux-ssh">SSH serveur sous Linux</a> · '
         '<a href="/pages/tp-ssh-securisation">TP — sécuriser SSH</a> · '
         '<a href="/pages/linux-droits">Utilisateurs, droits &amp; sudo</a> · '
         '<a href="/pages/tp-opnsense-dmz">TP 1.4 — DMZ, GLPI &amp; bastion</a> (le durcissement en '
         'situation) · <a href="/pages/la-cryptographie">La cryptographie</a>.'),
])

EXTRAIT = ('Réduire la surface d’attaque et contenir une compromission : mises à jour, comptes & '
           'sudo, mots de passe, permissions et SUID/SGID, sysctl, SSH, firewalld, SELinux, '
           'services, Fail2ban, journaux & auditd, GRUB, Lynis — la méthode, sur la famille Red Hat.')
DESCRIPTION = ('La méthode de durcissement d’un serveur (RHEL/Rocky, transposable Debian) : SSH, '
               'firewalld, SELinux, permissions, Fail2ban, auditd, GRUB, check-list de mise en prod.')

PAGES = [('durcissement-linux', 'Durcir un serveur Linux (hardening)',
          EXTRAIT, PAGE, SG, DESCRIPTION)]


if __name__ == '__main__':
    publier_lot(PAGES, LINUX)
    sys.exit(0)

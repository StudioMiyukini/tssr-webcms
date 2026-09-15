# -*- coding: utf-8 -*-
"""
Page « Configurateur — bastion SSH » : une VM Debian clonée, seule porte
d'entrée SSH vers les serveurs du labo ; serveurs verrouillés derrière elle ;
poste de l'administrateur en ProxyJump. Îlot React `BastionConfigurator`
(data-block "bastion-configurator"). Fait suite au configurateur duo web + base.

IDEMPOTENT.
"""
import re
import sqlite3
import sys

from _cours import BASE, STYLE, bullets, hero, note, publier, steps, tab

SLUG = 'configurateur-bastion'
TITRE = 'Configurateur — bastion SSH'

CONTENU = '\n'.join([
    hero('Outil · Sécurité / Linux', TITRE,
         'Une VM clonée depuis ton master devient la seule porte d’entrée SSH vers les serveurs : '
         'administrateurs nommés avec leur clé, root interdit, essais répétés bannis, tout journalisé.'),
    STYLE,
    '<p>Un <strong>bastion</strong> (ou serveur de rebond) est la machine par laquelle passe toute administration '
    'à distance : les serveurs n’acceptent SSH que depuis lui, et lui n’accepte que des administrateurs '
    'identifiés. Un seul point à surveiller, à durcir et à journaliser, au lieu de quarante ports 22 ouverts. '
    'C’est la mise en pratique du <a href="/pages/zero-trust-iam">moindre privilège et du tiering</a> : le '
    'bastion est l’outil du « tier 1 », séparé des postes qui lisent leurs mails. Cet outil fait suite au '
    '<a href="/pages/configurateur-web-bdd">configurateur duo web + base</a> : mêmes réglages d’hôte, mêmes scripts.</p>',

    '<h2>Ce que l’outil produit</h2>',
    tab(['Script', 'Où le jouer', 'Ce qu’il fait'], [
        ['① Clonage', 'Sur l’hôte (Hyper-V ou Proxmox)', 'Un clone du master, 1 vCPU / 1 Go, sur le commutateur choisi ; dépôt du script ②'],
        ['② Bastion', 'Dans la VM bastion, en root', 'Nom, IP fixe, comptes des administrateurs avec leurs clés, SSH durci (root interdit, clés seulement, X11 et agent interdits, journal détaillé, bannière), fail2ban, commande <code>journal-bastion</code>'],
        ['③ Serveurs', 'Sur <strong>chaque</strong> serveur à protéger, en root (le même script partout)', 'Les mêmes administrateurs, root interdit, et le port 22 ouvert <strong>seulement pour l’adresse du bastion</strong> (nftables, ou ufw s’il est actif) — avec un verrou si tu es connecté en SSH depuis ailleurs'],
        ['④ Poste', 'Sur le PC de l’administrateur', '<strong>Windows</strong> : un script PowerShell qui vérifie le client OpenSSH, génère la clé si besoin, affiche la ligne à coller dans le champ Administrateurs, écrit le bloc <code>ProxyJump</code> dans <code>~/.ssh/config</code> (remplacé à chaque rejeu, sans BOM) et teste ; <strong>④ bis</strong> : le même script en bash pour Linux / macOS / WSL. <code>ssh srv-web-01</code> traverse le bastion en une commande ; la clé privée ne quitte jamais le poste'],
        ['⑤ Vérifier', 'Poste, bastion, serveurs', 'Le rebond fonctionne, l’accès direct échoue, le journal montre qui est passé'],
    ]),

    '<div data-block="bastion-configurator"></div>',

    '<h2>Ce qui est installé, concrètement</h2>',
    '<p>Pas de produit « bastion » : le serveur <strong>OpenSSH de Debian</strong>, configuré pour ne faire que ça — '
    'comptes nommés dans <code>AllowUsers</code>, <code>PermitRootLogin no</code>, clés seulement (le mot de passe du labo '
    'sur demande), ni X11 ni transfert d’agent, mais <code>AllowTcpForwarding yes</code> pour le rebond, journal '
    '<code>VERBOSE</code> (l’empreinte de chaque clé acceptée ou refusée) et bannière ; <strong>fail2ban</strong> qui bannit une '
    'adresse après 5 échecs ; une commande <code>journal-bastion</code>. C’est tout : un bastion est une machine qui '
    'sait faire une seule chose, et qu’on peut relire en dix lignes de configuration '
    '(<code>/etc/ssh/sshd_config.d/10-bastion.conf</code>).</p>',
    note('red', '🚨 Ton compte actuel reste autorisé — c’est voulu',
         'Le script est lancé par <code>sudo</code> depuis un compte existant (celui du master, souvent). Ce compte est '
         '<strong>ajouté à <code>AllowUsers</code></strong> même s’il n’est pas dans la liste des administrateurs, et s’il n’a pas '
         'de clé installée, <strong>le mot de passe reste accepté</strong> : sinon la connexion suivante (MobaXterm, ssh) serait '
         'refusée et tu serais enfermé dehors. Le script l’annonce en AVERTISSEMENT. Quand les administrateurs ont leurs clés, '
         'retire ce compte de <code>AllowUsers</code> et passe <code>PasswordAuthentication no</code>. Autre effet attendu : les '
         '<strong>clés d’hôte</strong> du clone sont régénérées, ton client SSH signalera un changement d’empreinte à la reconnexion.'),
    '<h2>Avant de lancer</h2>',
    bullets('Le bastion vit dans un <strong>réseau d’administration</strong> distinct (ici <code>192.168.40.0/24</code> par défaut) : le pare-feu laisse les postes d’administration atteindre le bastion sur son port SSH, le bastion atteindre les serveurs sur 22, et <strong>rien d’autre vers le port 22 des serveurs</strong>.',
            'Chaque administrateur génère <strong>sa</strong> clé sur <strong>son</strong> poste (<code>ssh-keygen -t ed25519</code>, bloc ④) et te donne la ligne <code>.pub</code> ; le bastion et les serveurs ne reçoivent que des clés publiques. Sans clé, seul le mot de passe du labo ouvre la porte — à cocher explicitement.',
            'Joue ② puis ③ sur chaque serveur <strong>depuis la console</strong> (ou via une session SSH déjà passée par le bastion) : le script ③ refuse de couper la branche sur laquelle tu es assis.',
            'Le script ③ ne touche qu’au port 22 : il ajoute une table nftables à part (<code>inet bastion</code>) sans politique par défaut — les autres services du serveur restent tels quels. Si <code>ufw</code> est actif, il passe par ufw.',
            'Les scripts se rejouent sans dommage ; <code>SANS_RESEAU=1</code> et <code>IFACE=</code> valent comme pour le duo.'),
    note('yellow', '⚠️ Ce qu’un bastion n’est pas',
         'Il ne remplace ni le pare-feu (c’est lui qui interdit le port 22 ailleurs), ni la MFA sur les comptes '
         'des administrateurs (option « clé + code TOTP » de l’outil), ni la revue des accès : un administrateur '
         'parti est un compte à supprimer sur le bastion <em>et</em> sur les serveurs — voir '
         '<a href="/pages/cycle-vie-compte">Le cycle de vie d’un compte</a>. Et il n’enregistre pas les sessions '
         'frappe par frappe : pour cela, un outil dédié (Teleport, Guacamole, tlog).'),

    '<h2>Comment ça marche : ProxyJump</h2>',
    steps('Le poste ouvre une session SSH vers le <strong>bastion</strong>, authentifiée par la clé de l’administrateur.',
          'À travers cette session, il demande au bastion d’ouvrir un <strong>tunnel TCP</strong> vers le serveur cible, port 22 (<code>AllowTcpForwarding yes</code> — c’est le seul privilège que le bastion accorde).',
          'Dans ce tunnel, le poste ouvre une <strong>seconde session SSH</strong>, de bout en bout, vers le serveur — avec la même clé. Le bastion voit passer des octets chiffrés, jamais les commandes ni la clé.',
          'Le serveur, lui, voit une connexion venant de l’adresse du bastion : c’est la seule qu’il accepte.'),
    '<p>Avantage sur l’ancienne méthode (se connecter au bastion, puis <code>ssh</code> depuis le bastion) : la clé privée '
    'reste sur le poste, aucun transfert d’agent (<code>AllowAgentForwarding no</code>), et <code>scp</code>, <code>sftp</code>, '
    'VS Code Remote fonctionnent tels quels avec <code>ssh srv-web-01</code>.</p>',

    '<h2>Quand ça coince</h2>',
    tab(['Symptôme', 'Cause', 'Vérification'], [
        ['<code>Permission denied (publickey)</code> sur le bastion', 'Clé absente de <code>authorized_keys</code>, login pas dans <code>AllowUsers</code>, ou mot de passe non autorisé', '<code>journal-bastion</code> sur le bastion (LogLevel VERBOSE dit quelle clé a été présentée) ; <code>ssh -v</code> côté poste'],
        ['MobaXterm ne se connecte plus après le script', 'Adresse ou port changés ; compte pas dans <code>AllowUsers</code> ; mot de passe désactivé ; empreinte d’hôte changée (clés régénérées)', 'Nouvelle session vers la nouvelle IP / le port ; accepter la nouvelle empreinte ; Advanced SSH settings › Use private key ; pour un serveur derrière : Network settings › SSH gateway (jump host) = le bastion'],
        ['<code>Connection timed out</code> vers un serveur, même via le bastion', 'Le pare-feu entre le réseau d’administration et le serveur ne laisse pas le bastion sur 22 ; ou le script ③ a été joué avec une autre IP de bastion', '<code>nft list table inet bastion</code> sur le serveur ; règles OPNsense'],
        ['Le rebond marche, l’accès direct <strong>aussi</strong>', 'Script ③ non joué, ou ufw actif sans règle', '<code>ufw status numbered</code>, <code>nft list ruleset</code>'],
        ['Banni par fail2ban', '5 échecs en 10 min', '<code>fail2ban-client status sshd</code> ; <code>fail2ban-client set sshd unbanip &lt;IP&gt;</code>'],
        ['<code>Access denied by PAM account configuration</code>', '<code>/run/nologin</code> ou <code>/etc/nologin</code> présent (démarrage inachevé)', '<code>ls /run/nologin</code> ; <code>systemctl start systemd-user-sessions</code>'],
    ]),
    note('green', '🔗 Les cours qui expliquent ce qu’il génère',
         '<a href="/pages/linux-ssh">SSH serveur sous Linux</a> · <a href="/pages/tp-ssh-securisation">TP — Sécuriser SSH</a> · '
         '<a href="/pages/zero-trust-iam">Zero trust, PSSI et IAM</a> · <a href="/pages/le-pare-feu">Le pare-feu</a> · '
         '<a href="/pages/dmz-mise-en-place">Mettre en place une DMZ</a>.'),
])

EXTRAIT = ('Génère les scripts d’un bastion SSH cloné depuis le master : administrateurs et clés, SSH durci, fail2ban, journal ; '
           'chaque serveur n’accepte SSH que depuis le bastion ; le poste rebondit avec ProxyJump.')

CARTE = ('<a class="script-card" href="/pages/configurateur-bastion"><div class="sc-top"><span class="sc-ico">🛡️</span>'
         '<span class="sc-badge sc-badge-int">⚡ Interactif</span></div><div class="sc-title">Configurateur — bastion SSH</div>'
         '<div class="sc-desc meta">Outil interactif : clone un bastion depuis le master, administrateurs avec clés, SSH durci et fail2ban, '
         'serveurs verrouillés derrière lui (nftables), poste en ProxyJump — cinq blocs prêts à copier.</div>'
         '<div class="sc-tags"><span class="sc-pill">Bash</span><span class="sc-pill">SSH</span><span class="sc-pill">Sécurité</span>'
         '<span class="sc-pill">Clone</span></div></a>')

RENVOI_DUO = ('<aside class="pb-note pb-note-blue"><p class="pb-note-title">➡️ Et ensuite : le bastion</p>'
              '<p>Une fois les VM en place, l’administration à distance passe par un point unique : le '
              '<a href="/pages/configurateur-bastion">configurateur bastion SSH</a> clone une VM de rebond, verrouille le port 22 '
              'des serveurs derrière elle et écrit le <code>~/.ssh/config</code> du poste (ProxyJump).</p></aside>')


def ranger_outil(c):
    ct = c.execute("SELECT content FROM pages WHERE slug='scripts'").fetchone()[0]
    if SLUG in ct:
        return 'déjà présent'
    i = ct.index('id="sec-virtualisation"')
    j = ct.index('</div></section>', i)
    ct = ct[:j] + CARTE + ct[j:]
    sec = ct[i:ct.index('</section>', i)]
    n = sec.count('<a class="script-card"')
    ct = ct[:i] + re.sub(r'<span class="sc-count">\d+</span>', f'<span class="sc-count">{n}</span>', sec, count=1) + ct[i + len(sec):]
    ct = re.sub(r'(<a class="sc-chip" href="#sec-virtualisation">.*?<span class="sc-n">)\d+(</span>)', lambda m: m.group(1) + str(n) + m.group(2), ct, count=1, flags=re.S)
    total = ct.count('<a class="script-card"') + ct.count('class="sc-feat"')
    ct = re.sub(r'<p class="meta">\d+ outils\.', f'<p class="meta">{total} outils.', ct, count=1)
    c.execute("UPDATE pages SET content=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug='scripts'", (ct,))
    return f'carte ajoutée (section {n}, total {total})'


def renvoi_duo(c):
    ct = c.execute("SELECT content FROM pages WHERE slug='configurateur-web-bdd'").fetchone()[0]
    if 'configurateur-bastion' in ct:
        return 'déjà présent'
    i = ct.index('<h2>Avant de lancer</h2>')
    ct = ct[:i] + RENVOI_DUO + '\n' + ct[i:]
    c.execute("UPDATE pages SET content=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug='configurateur-web-bdd'", (ct,))
    return 'renvoi ajouté'


if __name__ == '__main__':
    c = sqlite3.connect(BASE)
    print(SLUG, ':', publier(c, SLUG, TITRE, EXTRAIT, CONTENU))
    print('outils :', ranger_outil(c).encode('ascii', 'replace').decode())
    print('duo :', renvoi_duo(c).encode('ascii', 'replace').decode())
    c.commit()
    c.close()
    sys.exit(0)

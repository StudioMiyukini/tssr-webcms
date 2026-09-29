# -*- coding: utf-8 -*-
"""
Page « Prompt coloré + tree : récupérer un .bashrc depuis la VM » : une commande
à taper dans une VM Debian pour installer tree et poser une invite colorée (verte
pour l'utilisateur, rouge pour root). Le script est hébergé sur le site
(client/public/bashrc-couleurs.sh → https://tssr.miyukini.com/bashrc-couleurs.sh).
Style step-banner. Rangée dans Procédures › Linux & Debian.

IDEMPOTENT.
"""
import re
import sqlite3
import sys

from _cours import BASE, publier

SLUG = 'procedure-bashrc-couleurs'
TITRE = 'Prompt coloré + tree : récupérer un .bashrc depuis la VM'
URL_SCRIPT = 'https://tssr.miyukini.com/bashrc-couleurs.sh'

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
         "</style>")


def cmd(t):
    return f'<div class="proc-cmd">{t}</div>'


def note(couleur, titre, *paras):
    return (f'<aside class="pb-note pb-note-{couleur}"><p class="pb-note-title">{titre}</p>'
            + ''.join(f'<p>{p}</p>' for p in paras) + '</aside>')


def etape(num, couleur, titre, sous, corps):
    return (f'<div class="step-banner" style="border-left-color:{couleur}">'
            f'<span class="step-num" style="background:{couleur}">{num}</span>'
            f'<span class="step-tt"><h3>{titre}</h3><span class="step-sub">{sous}</span></span></div>'
            f'<div class="step-rail" style="border-left-color:{couleur}">{corps}</div>')


BLEU, VERT, AMBRE, VIOLET, ROUGE = '#3b82f6', '#16a34a', '#d97706', '#7c3aed', '#dc2626'

BLOC_BASHRC = (
    '# ~/.bashrc — à coller à la fin du fichier (invite colorée)\n'
    'if [ "$EUID" -eq 0 ]; then\n'
    "    PS1='\\[\\e[1;31m\\]\\u@\\h\\[\\e[0m\\]:\\[\\e[1;34m\\]\\w\\[\\e[0m\\]# '   # root = rouge\n"
    'else\n'
    "    PS1='\\[\\e[1;32m\\]\\u@\\h\\[\\e[0m\\]:\\[\\e[1;34m\\]\\w\\[\\e[0m\\]\\$ '  # utilisateur = vert\n"
    'fi\n'
    "alias ll='ls -alF --color=auto'\n"
    "alias grep='grep --color=auto'"
)

CORPS = '\n'.join([
    '<section class="hero"><span class="pill">Procédure · Linux · Confort</span>'
    '<h1>Prompt coloré + tree : récupérer un .bashrc depuis la VM</h1>'
    '<p>Une invite de commande <strong style="color:#16a34a">verte</strong> pour l’utilisateur, '
    '<strong style="color:#dc2626">rouge</strong> pour root — pour voir d’un coup d’œil « qui je '
    'suis » avant de taper une commande dangereuse — et l’outil <code>tree</code> installé au '
    'passage. Récupérable en une ligne depuis n’importe quelle VM Debian.</p>'
    '</section>',
    STYLE,

    note('blue', '🎯 Pourquoi',
         'Le <strong>rouge du prompt root</strong> est un réflexe de sécurité : on hésite avant un '
         '<code>rm -rf</code> quand la ligne est rouge. Le <strong>vert</strong> rassure qu’on est en '
         'utilisateur simple. Et <code>tree</code> affiche l’arborescence des dossiers, bien pratique '
         'en TP. Le fichier <code>.bashrc</code> est justement le script lu à chaque ouverture d’un '
         'terminal bash : on y pose l’invite (<code>PS1</code>) et les alias.'),

    etape(1, VERT, 'La solution en une ligne',
          'À taper dans la VM Debian, en root',
          '<p>Le script est <strong>hébergé sur le site</strong> : la VM le récupère et l’applique '
          'd’une commande (rien à copier-coller à la main).</p>'
          + cmd(f'curl -fsSL {URL_SCRIPT} | sudo bash')
          + '<p>Ou, si <code>curl</code> n’est pas installé :</p>'
          + cmd(f'wget -qO- {URL_SCRIPT} | sudo bash')
          + note('gray', '🔎 Ce que fait le script',
                 'Il installe <code>tree</code>, puis ajoute un bloc à la fin des <code>.bashrc</code> '
                 'de <strong>root</strong>, de <strong>l’utilisateur</strong> qui a lancé '
                 '<code>sudo</code>, et de <code>/etc/skel</code> (pour les futurs comptes). '
                 'Il est <strong>idempotent</strong> : le relancer ne crée pas de doublon.')),

    etape(2, BLEU, 'Activer sans rouvrir de terminal',
          'Recharger le .bashrc courant',
          '<p>Le nouveau prompt s’applique aux <strong>nouveaux</strong> terminaux. Pour l’avoir tout '
          'de suite dans la session en cours :</p>'
          + cmd('source ~/.bashrc')
          + '<p>Vérifier que <code>tree</code> répond :</p>'
          + cmd('tree -L 1 /etc')),

    etape(3, AMBRE, 'À la main (sans télécharger)',
          'Coller le bloc directement dans ~/.bashrc',
          '<p>Si tu préfères ne rien télécharger : installe <code>tree</code>, puis colle ce bloc à la '
          '<strong>fin</strong> de <code>~/.bashrc</code> (et de <code>/root/.bashrc</code> pour '
          'root).</p>'
          + cmd('sudo apt update && sudo apt install -y tree')
          + cmd('nano ~/.bashrc      # aller tout en bas, coller le bloc ci-dessous')
          + cmd(BLOC_BASHRC)
          + cmd('source ~/.bashrc')
          + note('gray', '🎨 Comment se lit le PS1',
                 'Le test <code>[ "$EUID" -eq 0 ]</code> distingue root (identifiant 0) des autres. '
                 'Dans <code>PS1</code>, <code>\\[\\e[1;31m\\]</code> ouvre une couleur '
                 '(<strong>31</strong>&nbsp;= rouge, <strong>32</strong>&nbsp;= vert, '
                 '<strong>34</strong>&nbsp;= bleu&nbsp;; <strong>1</strong>&nbsp;= gras) et '
                 '<code>\\[\\e[0m\\]</code> la referme. <code>\\u</code>&nbsp;= utilisateur, '
                 '<code>\\h</code>&nbsp;= hôte, <code>\\w</code>&nbsp;= chemin courant.')),

    note('green', '🏁 À retenir',
         'Le <code>.bashrc</code> personnalise chaque terminal ; <code>PS1</code> définit l’invite, et '
         'les séquences <code>\\e[…m</code> la colorent. Une invite <strong>rouge en root</strong> est '
         'un garde-fou simple et efficace. Le script du site pose tout ça (plus <code>tree</code>) en '
         'une commande, sur root comme sur l’utilisateur.'),

    note('gray', '🔗 À rapprocher',
         '<a href="/pages/linux-commandes">Les commandes Linux de base</a> · '
         '<a href="/pages/tp-config-reseau-statique">IP statique sous Debian</a> · '
         '<a href="/pages/durcissement-linux">Durcir un serveur Linux</a>.'),
])

EXTRAIT = ('Une commande à taper dans une VM Debian pour installer tree et poser une invite colorée : '
           'verte pour l’utilisateur, rouge pour root (un garde-fou avant les commandes sensibles). '
           'Le script est hébergé sur le site et se récupère en une ligne — ou se colle à la main dans '
           '~/.bashrc.')

CARTE = ('<a class="dir-card" href="/pages/procedure-bashrc-couleurs"><div class="dc-ico">🎨</div>'
         '<div class="dc-body"><div class="dc-title">Prompt coloré + tree : récupérer un .bashrc</div>'
         '<div class="dc-desc meta">Une ligne dans la VM Debian : invite verte (utilisateur) / rouge '
         '(root) et installation de tree. Script hébergé sur le site, idempotent, appliqué à root, '
         'à l’utilisateur sudo et aux futurs comptes.</div>'
         '<div><span style="display:inline-block;font-size:10.5px;font-weight:600;color:var(--text-muted);'
         'background:var(--surface-3);border:1px solid var(--border);border-radius:999px;padding:1px 9px;'
         'margin:4px 4px 0 0">Debian</span>'
         '<span style="display:inline-block;font-size:10.5px;font-weight:600;color:var(--text-muted);'
         'background:var(--surface-3);border:1px solid var(--border);border-radius:999px;padding:1px 9px;'
         'margin:4px 4px 0 0">bash</span></div></div><div class="dc-go">Voir →</div></a>')


def ranger(c):
    h = c.execute("SELECT content FROM pages WHERE slug='procedures'").fetchone()[0]
    if SLUG not in h:
        m = re.search(r'<section class="pd-sec" id="sec-linux">.*?</section>', h, re.S)
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
    return f'index : sec-linux={comptes.get("sec-linux")} ; total {total}'


if __name__ == '__main__':
    c = sqlite3.connect(BASE)
    print(SLUG, ':', publier(c, SLUG, TITRE, EXTRAIT, CORPS))
    print(ranger(c).encode('ascii', 'replace').decode())
    c.commit()
    c.close()
    sys.exit(0)

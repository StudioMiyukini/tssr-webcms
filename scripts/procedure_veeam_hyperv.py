# -*- coding: utf-8 -*-
"""
Page « Sauvegarder une VM Hyper-V avec Veeam » : la procédure pas à pas —
ajouter l'hôte Hyper-V, créer un référentiel, monter un job de sauvegarde
(VM, rétention, traitement applicatif VSS, planification), lancer, vérifier, et
restaurer. Style step-banner. Rangée dans Procédures › Virtualisation & Hyper-V.

IDEMPOTENT.
"""
import re
import sqlite3
import sys

from _cours import BASE, publier

SLUG = 'procedure-veeam-hyperv'
TITRE = 'Sauvegarder une VM Hyper-V avec Veeam'

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

CORPS = '\n'.join([
    '<section class="hero"><span class="pill">Procédure · Sauvegarde · Hyper-V</span>'
    '<h1>Sauvegarder une VM Hyper-V avec Veeam</h1>'
    '<p>De l’installation au job planifié, puis la restauration : sauvegarder une machine virtuelle '
    'Hyper-V avec Veeam Backup &amp; Replication, proprement — et vérifier qu’on sait la remonter.</p>'
    '</section>',
    STYLE,

    note('blue', '🎯 Ce qu’on met en place',
         'Une sauvegarde <strong>automatique et cohérente</strong> d’une VM Hyper-V, avec Veeam '
         '<strong>Backup &amp; Replication</strong> (l’édition <em>Community</em>, gratuite, suffit '
         'pour une poignée de VM). Le principe Veeam : on déclare l’<strong>hôte</strong> à sauvegarder, '
         'un <strong>référentiel</strong> où déposer les fichiers, puis un <strong>job</strong> qui '
         'relie les deux et tourne tout seul. Le durcissement d’un serveur rappelle pourquoi : '
         '<a href="/pages/durcissement-linux">une sauvegarde jamais testée n’est pas une sauvegarde</a> '
         '(règle 3-2-1).',
         'Trois <strong>granularités</strong> selon le besoin : la VM <strong>entière</strong> (job '
         'image-level, étapes 2–4), <strong>certains fichiers</strong> d’une VM (agent File Level, '
         'étape 5), ou un <strong>partage de fichiers</strong> sur un serveur (File Share / Unstructured '
         'Data, sans agent — étape 5). Le TP demande la VM Web en entier, les documents du bureau du '
         'serveur AD, et le dossier « Partage » du serveur de fichiers.'),
    note('yellow', '⚠️ Une évidence qu’on oublie : pas sur le même disque',
         'Le référentiel de sauvegarde doit être sur un <strong>support différent</strong> du disque '
         'qui porte les VHDX de la VM — un second disque, un NAS, un partage. Sauvegarder une VM à '
         'côté d’elle-même ne protège de rien : si le disque lâche, la VM <em>et</em> sa sauvegarde '
         'partent ensemble.'),

    etape(1, BLEU, 'Prérequis', 'Veeam installé, l’hôte et une cible',
          '<ul class="proc-steps">'
          '<li><strong>Veeam Backup &amp; Replication</strong> installé (sur l’hôte Hyper-V lui-même '
          'en labo, ou sur une machine de gestion). L’édition <em>Community</em> est gratuite.</li>'
          '<li>Un <strong>compte administrateur</strong> de l’hôte Hyper-V.</li>'
          '<li>Un <strong>espace de stockage</strong> distinct pour les sauvegardes (2ᵉ disque, NAS, '
          'partage réseau).</li>'
          '<li>Les <strong>services d’intégration</strong> Hyper-V à jour dans la VM (pour une '
          'sauvegarde cohérente en ligne).</li></ul>'),

    etape(2, VERT, 'Déclarer l’hôte Hyper-V', 'Inventory ▸ Managed Servers ▸ Add Server',
          '<p>Dans la console Veeam : ' + nav('Inventory ▸ Managed Servers') + ' → clic droit → '
          '<em>Add Server</em> → <strong>Microsoft Hyper-V</strong> → <em>Microsoft Hyper-V '
          '(standalone)</em>.</p>'
          + tab(['Écran', 'À renseigner'], [
              ['DNS name or IP', 'Le nom ou l’IP de l’hôte Hyper-V (<code>localhost</code> si Veeam est dessus)'],
              ['Credentials', 'Un compte <strong>administrateur local</strong> de l’hôte (Add → domaine\\admin + mot de passe)'],
              ['Rôle / composants', 'Laisser Veeam installer les transports ; l’hôte devient le <em>proxy</em> qui lit les VHDX'],
          ])
          + note('gray', '🔌 Le proxy, c’est quoi',
                 'Le <em>Hyper-V proxy</em> est le composant qui lit réellement les disques de la VM '
                 'pendant la sauvegarde. En labo (un seul hôte), l’hôte joue ce rôle lui-même '
                 '(<em>on-host backup</em>) — rien à configurer de plus.')),

    etape(3, VIOLET, 'Créer le référentiel de sauvegarde', 'Backup Infrastructure ▸ Backup Repositories',
          '<p>' + nav('Backup Infrastructure ▸ Backup Repositories') + ' → clic droit → '
          '<em>Add Backup Repository</em>.</p>'
          + tab(['Écran', 'Choix'], [
              ['Type', '<strong>Direct attached storage ▸ Microsoft Windows</strong> (2ᵉ disque local) — ou <em>Shared folder</em> pour un partage SMB / NAS'],
              ['Repository server', 'Le serveur qui porte l’espace de stockage'],
              ['Path', 'Le dossier des sauvegardes, ex. <code>E:\\Backups</code> — <strong>pas</strong> le volume des VHDX'],
              ['Load control', 'Laisser par défaut en labo'],
          ])),

    etape(4, TEAL, 'Créer le job de sauvegarde', 'Home ▸ Backup Job ▸ Microsoft Hyper-V',
          '<p>' + nav('Home ▸ Backup Job ▸ Virtual machine ▸ Microsoft Hyper-V') + '. L’assistant '
          'déroule quatre réglages qui comptent :</p>'
          + tab(['Onglet', 'Ce qu’on règle'], [
              ['<strong>Name</strong>', 'Un nom parlant (ex. <code>Sauvegarde SRV-AD</code>)'],
              ['<strong>Virtual Machines</strong>', '<em>Add</em> → parcourir l’hôte → cocher la VM à sauvegarder'],
              ['<strong>Storage</strong>', 'Le <strong>référentiel</strong> (étape 3) et la <strong>rétention</strong> : nombre de <em>points de restauration</em> à garder (ex. 7)'],
              ['<strong>Guest Processing</strong>', 'Cocher <strong>Enable application-aware processing</strong> et donner un compte admin <em>de la VM</em> (VSS)'],
              ['<strong>Schedule</strong>', 'Cocher <em>Run the job automatically</em> — ex. tous les jours à 22 h'],
          ])
          + note('red', '🚨 « Application-aware processing » — surtout pour un AD/SQL',
                 'Sans lui, Veeam prend un instantané <em>crash-consistent</em> (comme couper le '
                 'courant). Pour une VM qui porte <strong>Active Directory</strong>, SQL ou Exchange, '
                 'coche <strong>Enable application-aware processing</strong> : Veeam déclenche '
                 '<strong>VSS</strong> dans la VM, met la base au repos une fraction de seconde et '
                 'obtient une sauvegarde <em>application-consistent</em>, réellement restaurable. C’est '
                 'le réglage qui distingue une vraie sauvegarde d’AD d’une copie qui ne remontera pas '
                 'proprement.')),

    etape(5, VIOLET, 'Sauvegarder seulement certains fichiers d’une VM', 'L’agent Veeam pour Windows — mode File Level',
          '<p>Un job image-level (étapes 2–4) sauvegarde la VM <strong>entière</strong>. Pour ne '
          'protéger que <strong>des fichiers ou dossiers précis</strong> — par exemple les documents '
          'du bureau du serveur AD — on passe par l’<strong>agent Veeam pour Microsoft Windows</strong> '
          '(gratuit) en mode <strong>File Level</strong>. À ne pas confondre avec la '
          '<em>restauration</em> de fichiers depuis une image (étape 7) : ici on crée un job qui ne '
          'sauvegarde <em>que</em> ces fichiers.</p>'
          + '<p><strong>Piloté depuis la console Veeam</strong> (recommandé) :</p>'
          + '<ol class="proc-steps">'
          '<li>Déployer l’agent : ' + nav('Inventory ▸ Physical Infrastructure ▸ Add Protection Group') +
          ' → ajouter le serveur AD avec un compte admin <em>de la VM</em> — Veeam installe l’agent à distance.</li>'
          '<li>' + nav('Home ▸ Backup Job ▸ Windows computer') + ' → type <em>Server</em>.</li>'
          '<li>Mode de sauvegarde : <strong>File Level backup</strong> (et non <em>Entire computer</em>).</li>'
          '<li>Choisir les dossiers : le bureau du serveur AD — <code>C:\\Users\\Administrateur\\Desktop</code> '
          '(ou directement les deux fichiers <code>.txt</code> à protéger).</li>'
          '<li>Référentiel (étape 3), rétention, planification, puis <em>Finish</em>.</li></ol>'
          + note('gray', '💻 Variante autonome (labo)',
                 'Sans la console : installer <strong>Veeam Agent for Microsoft Windows</strong> '
                 '<em>dans</em> le serveur AD, lancer <em>Configure Backup</em> → '
                 '<strong>File Level backup</strong> → ajouter le dossier <code>Desktop</code> → choisir '
                 'la cible (dossier local, disque USB, partage réseau) → planifier. Même résultat, géré '
                 'depuis la VM elle-même.')
          + note('yellow', '⚠️ Fichiers ≠ image',
                 'Une sauvegarde <em>File Level</em> protège des fichiers, pas le système : on en '
                 'restaure des documents, mais pas la VM par Instant Recovery. Pour pouvoir remonter '
                 'tout le serveur, on garde <strong>en plus</strong> un job image-level de sa VM (comme '
                 'pour la VM Web). Le VSS applicatif est inutile pour de simples fichiers.')
          + note('blue', '🗂️ Troisième voie : un partage de fichiers (File Share)',
                 'Pour un <strong>dossier partagé d’un serveur de fichiers</strong> (ex. « Partage » '
                 'en SMB), ni agent ni image : Veeam sauvegarde le partage <strong>directement</strong>. '
                 + nav('Inventory ▸ Unstructured Data ▸ Add ▸ File Server') + ' — déclarer le serveur '
                 'par son nœud <strong>File Server</strong> (et non <em>File Share</em>) — puis '
                 + nav('Home ▸ Backup Job ▸ File Share') + ' → sélectionner le dossier « Partage » → '
                 'référentiel + rétention → lancer, et vérifier <em>Success</em> dans '
                 + nav('History') + '. La restauration d’un fichier supprimé se fait ensuite par '
                 + nav('Home ▸ Restore ▸ File Share') + ' (restauration granulaire), sans remonter tout '
                 'le serveur.')),

    etape(6, AMBRE, 'Lancer et surveiller les jobs', 'Start, puis Last 24 Hours',
          '<p>À la fin de l’assistant, laisser <em>Run the job when I click Finish</em> — ou plus '
          'tard : clic droit sur le job → <strong>Start</strong> (ou <em>Active Full</em> pour forcer '
          'une sauvegarde complète). Le premier passage est un <strong>full</strong> (toute la VM) ; '
          'les suivants sont <strong>incrémentaux</strong> (seulement ce qui a changé).</p>'
          + '<p>Suivre l’avancement dans ' + nav('Home ▸ Jobs') + ' ou ' + nav('Home ▸ Last 24 Hours') +
          ' : la session doit finir en <strong>Success</strong> (vert). Un <em>Warning</em> (orange) '
          'signale souvent que VSS n’a pas pu s’exécuter (identifiants de la VM à corriger).</p>'
          + note('gray', '🧱 Full, incrémental, rétention',
                 'La chaîne : un <em>full</em>, puis des <em>incréments</em> ; Veeam garde autant de '
                 'points que la rétention (7 = une semaine de retours possibles). Un <strong>full '
                 'périodique</strong> (actif ou synthétique) évite une chaîne d’incréments trop longue '
                 'et fragile.')),

    etape(7, VERT, 'Vérifier — et savoir restaurer', 'Home ▸ Restore ▸ Hyper-V',
          '<p>Le point de contrôle : sous ' + nav('Home ▸ Backups ▸ Disk') + ', la VM apparaît avec '
          'ses <strong>points de restauration</strong> datés. Mais une sauvegarde ne vaut que par sa '
          '<strong>restauration</strong> — à tester :</p>'
          + tab(['Besoin', 'Restauration Veeam'], [
              ['Récupérer un <strong>fichier</strong> dans la VM', 'Guest Files (Microsoft Windows) — monte le disque et parcourt l’arborescence'],
              ['Remonter la VM <strong>tout de suite</strong>', '<strong>Instant Recovery</strong> — la VM redémarre depuis la sauvegarde, le temps de la remettre au propre'],
              ['Restaurer la <strong>VM entière</strong>', 'Entire VM — réécrit la VM sur l’hôte (même emplacement ou ailleurs)'],
          ])
          + cmd('Home ▸ Restore ▸ Microsoft Hyper-V ▸ (Instant Recovery | Entire VM | Guest Files)\n→ choisir le point de restauration daté, suivre l\'assistant.')
          + note('green', '✅ Le test qui valide tout',
                 'Fais au moins une fois une <strong>restauration de fichier</strong> (rapide) et, si '
                 'possible, une <strong>Instant Recovery</strong> dans un réseau isolé : c’est la seule '
                 'preuve que la sauvegarde est exploitable. Une sauvegarde jamais restaurée est une '
                 'hypothèse, pas une sécurité.')
          + note('blue', '🔎 Vérifier sans restaurer à la main : Health Check &amp; SureBackup',
                 'Veeam sait <strong>contrôler l’intégrité</strong> des sauvegardes tout seul. Le '
                 '<strong>Health Check</strong> (une option du job : <em>Storage ▸ Advanced ▸ '
                 'Maintenance</em>) relit les blocs et détecte une sauvegarde <em>corrompue</em> — '
                 'mais il ne prouve pas que la VM redémarre. <strong>SureBackup</strong> va plus loin : '
                 'il <strong>démarre réellement</strong> la VM sauvegardée dans un <em>bac à sable '
                 'réseau isolé</em> (virtual lab) et teste qu’elle boote et répond, automatiquement, '
                 'à chaque cycle. C’est la réponse à « pourquoi tester les restaurations » — sauf que '
                 'la machine le fait pour toi. <em>(SureBackup n’est pas dans l’édition Community ; '
                 'à défaut, on garde le test de restauration manuel.)</em>')),

    note('green', '✅ À retenir',
         'Trois briques Veeam : l’<strong>hôte</strong> déclaré, un <strong>référentiel</strong> sur un '
         'support <em>distinct</em>, un <strong>job</strong> planifié qui les relie. <strong>VM '
         'entière</strong> = job <em>image-level</em> (Hyper-V) ; <strong>fichiers précis</strong> = '
         'agent Veeam en mode <em>File Level</em>. Pour une VM AD/base de données, '
         '<strong>application-aware processing</strong> (VSS) est obligatoire pour une sauvegarde image '
         'restaurable. Un <strong>partage de fichiers</strong> se sauvegarde sans agent (File Share / '
         'Unstructured Data). La chaîne full + incréments suit une <strong>rétention</strong>, et on '
         '<strong>teste la restauration</strong> (à la main, ou automatiquement par <strong>Health '
         'Check / SureBackup</strong>) — sinon ce n’est pas une sauvegarde. Penser <strong>3-2-1</strong>, '
         'voire <strong>3-2-1-1-0</strong> : 3 copies, 2 supports, 1 hors site, <strong>1 immuable</strong>, '
         '<strong>0 erreur</strong> de restauration vérifiée.'),
    note('gray', '🔗 À rapprocher',
         '<a href="/pages/procedure-veeam-replication">Réplication et politique de sauvegarde</a> '
         '(la suite : répliquer entre agences, failover / failback) · '
         '<a href="/pages/procedure-vm-hyperv">Créer une VM sur Hyper-V</a> · '
         '<a href="/pages/durcissement-linux">Durcir un serveur</a> (la règle 3-2-1).'),
])

EXTRAIT = ('La procédure pas à pas pour sauvegarder une VM Hyper-V avec Veeam Backup & Replication : '
           'déclarer l’hôte, créer un référentiel sur un support distinct, monter un job (VM, '
           'rétention, traitement applicatif VSS, planification), lancer, surveiller, et restaurer '
           '(fichier, Instant Recovery, VM entière).')

CARTE = ('<a class="dir-card" href="/pages/procedure-veeam-hyperv"><div class="dc-ico">💽</div>'
         '<div class="dc-body"><div class="dc-title">Sauvegarder une VM Hyper-V avec Veeam</div>'
         '<div class="dc-desc meta">Pas à pas : déclarer l’hôte Hyper-V, créer un référentiel, monter '
         'un job de sauvegarde (VM, rétention, VSS application-aware, planification), lancer, '
         'surveiller, et restaurer (fichier / Instant Recovery / VM entière).</div>'
         '<div><span style="display:inline-block;font-size:10.5px;font-weight:600;color:var(--text-muted);'
         'background:var(--surface-3);border:1px solid var(--border);border-radius:999px;padding:1px 9px;'
         'margin:4px 4px 0 0">Hyper-V</span>'
         '<span style="display:inline-block;font-size:10.5px;font-weight:600;color:var(--text-muted);'
         'background:var(--surface-3);border:1px solid var(--border);border-radius:999px;padding:1px 9px;'
         'margin:4px 4px 0 0">Sauvegarde</span></div></div><div class="dc-go">Voir →</div></a>')


def ranger(c):
    h = c.execute("SELECT content FROM pages WHERE slug='procedures'").fetchone()[0]
    if SLUG not in h:
        m = re.search(r'<section class="pd-sec" id="sec-virtualisation">.*?</section>', h, re.S)
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
    return f'index : sec-virtualisation={comptes.get("sec-virtualisation")} ; total {total}'


if __name__ == '__main__':
    c = sqlite3.connect(BASE)
    print(SLUG, ':', publier(c, SLUG, TITRE, EXTRAIT, CORPS))
    print(ranger(c).encode('ascii', 'replace').decode())
    c.commit()
    c.close()
    sys.exit(0)

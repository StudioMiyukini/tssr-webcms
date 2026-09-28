# -*- coding: utf-8 -*-
"""
Page « Relation d'approbation entre deux domaines AD » : monter une approbation
de forêt bidirectionnelle entre bordeaux.local et toulouse.local, puis accorder
les droits croisés pour que l'administrateur de chaque domaine puisse intervenir
dans l'autre. Fait suite au VPN IPsec site-à-site (TP2). Style step-banner.
Rangée dans Procédures › Active Directory.

IDEMPOTENT.
"""
import re
import sqlite3
import sys

from _cours import BASE, publier

SLUG = 'procedure-approbation-ad'
TITRE = 'Relation d’approbation entre deux domaines Active Directory'

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
         "</style>")


def cmd(t):
    return f'<div class="proc-cmd">{t}</div>'


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
    '<section class="hero"><span class="pill">Procédure · Active Directory</span>'
    '<h1>Approbation entre deux domaines AD</h1>'
    '<p>Relier <code>bordeaux.local</code> et <code>toulouse.local</code> par une approbation de '
    'forêt bidirectionnelle, puis donner à chaque administrateur les droits pour intervenir dans '
    'l’autre domaine.</p></section>',
    STYLE,

    note('blue', '🎯 Le but, et la nuance qui fait tout',
         'On veut qu’un administrateur de Toulouse administre aussi Bordeaux (et l’inverse) avec '
         '<em>son</em> compte. Il faut <strong>deux choses distinctes</strong>, qu’on confond souvent : '
         'l’<strong>approbation</strong>, qui permet à un domaine de <em>reconnaître</em> les comptes '
         'de l’autre (authentification) ; et les <strong>droits</strong>, qu’on accorde ensuite '
         'explicitement (autorisation). <strong>Une approbation seule ne donne aucun pouvoir</strong> — '
         'c’est l’erreur n°1. Fait suite au <a href="/pages/procedure-vpn-ipsec-pfsense">VPN IPsec '
         'site-à-site</a> (les deux sites doivent d’abord se joindre).'),
    note('gray', '🧭 Externe ou forêt ?',
         'Entre deux forêts autonomes à un seul domaine (<code>bordeaux.local</code>, '
         '<code>toulouse.local</code>), on crée une <strong>approbation de forêt</strong> '
         '(Kerberos, transitive dans chaque forêt) plutôt qu’une approbation externe (NTLM, non '
         'transitive). En <strong>bidirectionnel</strong> : chacun fait confiance à l’autre.'),

    etape(1, BLEU, 'Prérequis', 'Réseau, comptes, niveaux fonctionnels',
          '<p>Avant de toucher aux approbations :</p>'
          + '<ul class="proc-steps">'
          '<li><strong>Connectivité</strong> entre les deux DC : le tunnel '
          '<a href="/pages/procedure-vpn-ipsec-pfsense">IPsec site-à-site</a> monté, et le pare-feu '
          'qui laisse passer les ports AD (DNS 53, Kerberos 88, LDAP 389/636, SMB 445, RPC 135 + '
          'plage dynamique).</li>'
          '<li>Un compte <strong>Admins de l’entreprise</strong> (ou Admins du domaine) de '
          '<em>chaque</em> côté.</li>'
          '<li>Le <strong>niveau fonctionnel de forêt</strong> ≥ Windows Server 2003 (toujours vrai '
          'sur 2019/2022) — requis pour une approbation de forêt.</li>'
          '<li>Des <strong>noms de domaine différents</strong> (c’est le cas) et des '
          '<strong>plans d’adressage distincts</strong> (10.180 vs 10.160).</li></ul>'
          + tab(['', 'Bordeaux', 'Toulouse'], [
              ['Domaine', '<code>bordeaux.local</code>', '<code>toulouse.local</code>'],
              ['DC / DNS', '<code>10.180.10.1</code>', '<code>10.160.10.1</code>'],
          ])),

    etape(2, VERT, 'La résolution DNS croisée', 'Le préalable qu’on oublie',
          '<p>Une approbation se monte par <strong>nom de domaine</strong>, pas par IP : chaque DC '
          'doit résoudre le domaine de l’autre. Le plus simple, un <strong>redirecteur '
          'conditionnel</strong> de chaque côté (DNS Manager ▸ Conditional Forwarders ▸ New, ou en '
          'PowerShell) :</p>'
          + cmd('# sur le DC de Bordeaux :\nAdd-DnsServerConditionalForwarderZone -Name "toulouse.local" -MasterServers 10.160.10.1\n\n# sur le DC de Toulouse :\nAdd-DnsServerConditionalForwarderZone -Name "bordeaux.local" -MasterServers 10.180.10.1')
          + '<p>Vérifier la résolution <strong>dans les deux sens</strong> avant d’aller plus loin :</p>'
          + cmd('# depuis Bordeaux :\nnslookup toulouse.local\nnslookup _ldap._tcp.dc._msdcs.toulouse.local     # les SRV du contrôleur distant\nTest-NetConnection 10.160.10.1 -Port 389')
          + note('yellow', '⚠️ Si l’assistant « ne trouve pas » l’autre domaine',
                 'C’est presque toujours le DNS : redirecteur conditionnel absent ou pointant sur la '
                 'mauvaise IP, ou le pare-feu qui bloque le 53/389. Tant que <code>nslookup '
                 'toulouse.local</code> échoue, l’approbation échouera aussi. Une <em>zone de stub</em> '
                 'est une alternative au redirecteur.')),

    etape(3, VIOLET, 'Créer l’approbation de forêt', 'Domaines et approbations AD ▸ Nouvelle approbation',
          '<p><code>Domaines et approbations Active Directory</code> '
          '(<code>domain.msc</code>) → clic droit sur <code>bordeaux.local</code> → '
          '<em>Propriétés</em> → onglet <strong>Approbations</strong> → <strong>Nouvelle '
          'approbation</strong>. L’assistant :</p>'
          + tab(['Écran', 'Choix'], [
              ['Nom', '<code>toulouse.local</code> (le domaine distant)'],
              ['Type', '<strong>Approbation de forêt</strong>'],
              ['Direction', '<strong>Bidirectionnelle</strong>'],
              ['Côtés', '<strong>Les deux côtés</strong> (« ce domaine et le domaine spécifié ») si tu as un compte admin distant — sinon un côté à la fois avec un mot de passe d’approbation partagé'],
              ['Étendue d’authentification', 'À l’échelle de la forêt (labo) ; « authentification sélective » pour restreindre (production)'],
          ])
          + '<p>Répéter n’est pas nécessaire si tu as choisi « les deux côtés » : l’assistant crée '
          'l’approbation entrante <em>et</em> sortante d’un coup. Sinon, refaire l’assistant sur '
          'Toulouse avec le <strong>même mot de passe d’approbation</strong>.</p>'
          + note('gray', '⌨️ En ligne de commande (alternative)',
                 'Depuis un DC de Bordeaux, avec les identifiants des deux côtés : '
                 '<code>netdom trust bordeaux.local /Domain:toulouse.local /add /twoway '
                 '/userD:toulouse\\administrateur /passwordD:* /userO:bordeaux\\administrateur '
                 '/passwordO:*</code>')),

    etape(4, TEAL, 'Valider l’approbation', 'Confirmer qu’elle fonctionne dans les deux sens',
          '<p>Toujours dans l’onglet <strong>Approbations</strong>, sélectionner l’approbation → '
          '<em>Propriétés</em> → <strong>Valider</strong>. Répondre « oui, valider l’approbation '
          'entrante » et fournir un compte admin de l’autre domaine. À faire une fois ; les deux sens '
          'doivent être confirmés.</p>'
          + cmd('# vérifier en ligne de commande :\nnetdom trust bordeaux.local /Domain:toulouse.local /verify\nGet-ADTrust -Filter * | Format-Table Name,Direction,ForestTransitive')
          + note('yellow', '⚠️ Échec de validation',
                 'Erreur d’authentification à la validation = horloge (Kerberos tolère ~5 min d’écart : '
                 'les deux DC doivent être à l’heure), ou DNS incomplet, ou mot de passe d’approbation '
                 'différent si tu as monté les deux côtés séparément.')),

    etape(5, AMBRE, 'Accorder les droits croisés', 'L’approbation authentifie ; ici on autorise',
          '<p>Maintenant que Bordeaux <em>reconnaît</em> les comptes de Toulouse, on leur donne des '
          '<strong>droits d’administration</strong>. Le bon réceptacle : le groupe local de domaine '
          '<strong>Builtin\\Administrateurs</strong>, qui <em>peut</em> contenir un groupe d’un '
          'domaine approuvé (contrairement à <em>Admins du domaine</em>, un groupe global).</p>'
          + '<p><strong>Sur Bordeaux</strong> — donner l’administration à Toulouse '
          '(<code>Utilisateurs et ordinateurs AD</code> → conteneur <em>Builtin</em> → '
          '<em>Administrateurs</em> → <em>Ajouter</em> → <em>Emplacements</em> = '
          '<code>toulouse.local</code> → choisir <em>Admins du domaine</em>) :</p>'
          + cmd('# sur le DC de Bordeaux, en PowerShell :\nAdd-ADGroupMember -Identity "Administrators" -Members (Get-ADGroup -Server toulouse.local "Domain Admins")')
          + '<p><strong>Sur Toulouse</strong> — le symétrique, pour que Bordeaux administre Toulouse :</p>'
          + cmd('# sur le DC de Toulouse :\nAdd-ADGroupMember -Identity "Administrators" -Members (Get-ADGroup -Server bordeaux.local "Domain Admins")')
          + note('gray', '🎯 Plus fin que « tout admin » (production)',
                 'Ajouter <em>Admins du domaine</em> entier de l’autre côté est large. En pratique on '
                 'crée un groupe dédié (ex. <code>TLS-Admins-Distants</code>), on y met les seuls '
                 'administrateurs concernés, et c’est <em>ce</em> groupe qu’on ajoute à '
                 '<code>Builtin\\Administrateurs</code>. Pour administrer les <strong>serveurs '
                 'membres</strong> et postes, on pousse ce groupe dans leurs administrateurs locaux via '
                 'une <strong>GPO ▸ Groupes restreints</strong>.'),
          ),

    etape(6, VERT, 'Vérifier l’intervention croisée', 'Se connecter, administrer, accéder',
          '<p>Le test, avec un compte de <strong>Toulouse</strong> agissant sur <strong>Bordeaux</strong> :</p>'
          + '<ul class="proc-steps">'
          '<li><strong>Ouverture de session</strong> : sur un poste de Bordeaux, se connecter avec '
          '<code>TOULOUSE\\administrateur</code> — l’approbation permet le choix du domaine.</li>'
          '<li><strong>Administrer à distance</strong> : lancer <code>dsa.msc</code> et « Changer de '
          'domaine » vers <code>bordeaux.local</code>, ou ouvrir une console ciblée :</li></ul>'
          + cmd('# depuis Toulouse, piloter l\'AD de Bordeaux avec un compte de Toulouse :\nGet-ADUser -Filter * -Server bordeaux.local\n# ou une console MMC / RSAT pointée sur bordeaux.local\n# ou une session RDP vers le DC de Bordeaux (si le compte est admin, cf. étape 5)')
          + '<p><strong>Accès à un partage</strong> avec ses propres identifiants : depuis un poste '
          'de Bordeaux, ouvrir <code>\\\\10.160.10.1\\PARTAGE</code> (le serveur de Toulouse) — '
          'l’authentification passe par l’approbation, et les droits NTFS peuvent viser un groupe de '
          'l’autre domaine.</p>'
          + note('red', '🚨 Ça marche mais « accès refusé » ?',
                 'L’ouverture de session réussit (approbation OK) mais l’action est refusée : c’est '
                 'que les <strong>droits</strong> manquent (étape 5 pas faite du bon côté), ou que le '
                 'partage/NTFS ne cite pas le groupe distant. Authentifié ≠ autorisé — toujours la '
                 'même distinction.')),

    note('green', '✅ À retenir',
         'Deux étapes à ne pas confondre : l’<strong>approbation de forêt bidirectionnelle</strong> '
         '(après DNS croisé et connectivité) fait que chaque domaine <em>reconnaît</em> les comptes de '
         'l’autre ; les <strong>droits</strong> (ajouter le groupe admin distant à '
         '<code>Builtin\\Administrateurs</code>, ou via GPO Groupes restreints) donnent le '
         '<em>pouvoir</em> d’agir. Sans la seconde, l’admin distant se connecte mais ne peut rien '
         'faire. Et rien ne marche si le DNS croisé et le tunnel ne sont pas debout d’abord.'),
    note('gray', '🔗 À rapprocher',
         '<a href="/pages/procedure-vpn-ipsec-pfsense">VPN IPsec site-à-site pfSense</a> (le lien entre '
         'les deux sites) · <a href="/pages/tp-ad-decouverte">TP AD — découverte</a> · '
         '<a href="/pages/tp-ad-gpo">TP AD — GPO</a> (pour les Groupes restreints) · '
         '<a href="/pages/tp-ad-fichiers-droits">TP AD — fichiers &amp; droits NTFS</a>.'),
])

EXTRAIT = ('Monter une approbation de forêt bidirectionnelle entre deux domaines AD (bordeaux.local ↔ '
           'toulouse.local) : prérequis réseau, résolution DNS croisée, création et validation de '
           'l’approbation, puis les droits croisés (Builtin\\Administrateurs) pour que chaque '
           'administrateur intervienne dans l’autre domaine — authentifié n’est pas autorisé.')

CARTE = ('<a class="dir-card" href="/pages/procedure-approbation-ad"><div class="dc-ico">🤝</div>'
         '<div class="dc-body"><div class="dc-title">Approbation entre deux domaines AD</div>'
         '<div class="dc-desc meta">Pas à pas : approbation de forêt bidirectionnelle '
         '(bordeaux.local ↔ toulouse.local), DNS croisé, validation, puis les droits croisés '
         '(Builtin\\Administrateurs) pour que chaque admin intervienne dans l’autre domaine.</div>'
         '<div><span style="display:inline-block;font-size:10.5px;font-weight:600;color:var(--text-muted);'
         'background:var(--surface-3);border:1px solid var(--border);border-radius:999px;padding:1px 9px;'
         'margin:4px 4px 0 0">Active Directory</span>'
         '<span style="display:inline-block;font-size:10.5px;font-weight:600;color:var(--text-muted);'
         'background:var(--surface-3);border:1px solid var(--border);border-radius:999px;padding:1px 9px;'
         'margin:4px 4px 0 0">Approbation</span></div></div><div class="dc-go">Voir →</div></a>')


def ranger(c):
    h = c.execute("SELECT content FROM pages WHERE slug='procedures'").fetchone()[0]
    if SLUG not in h:
        m = re.search(r'<section class="pd-sec" id="sec-ad">.*?</section>', h, re.S)
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
    return f'index : sec-ad={comptes.get("sec-ad")} ; total {total}'


if __name__ == '__main__':
    c = sqlite3.connect(BASE)
    print(SLUG, ':', publier(c, SLUG, TITRE, EXTRAIT, CORPS))
    print(ranger(c).encode('ascii', 'replace').decode())
    c.commit()
    c.close()
    sys.exit(0)

# -*- coding: utf-8 -*-
"""
Page « pfSense — VPN IPsec site-à-site (Bordeaux ↔ Toulouse) » : la procédure
pas à pas qui répond aux TP1 (DMZ/pfSense) et TP2 (VPN site-à-site), avec
l'adressage arbitré par le formateur. Même langage visuel que les corrections
de réalisation (step-banner / step-rail / proc-cmd / pb-note). Rangée dans
Procédures › Réseau & adressage.

IDEMPOTENT.
"""
import re
import sqlite3
import sys

from _cours import BASE, publier

SLUG = 'procedure-vpn-ipsec-pfsense'
TITRE = 'pfSense — VPN IPsec site-à-site (Bordeaux ↔ Toulouse)'

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
         ".rt code{font-size:12px}"
         ".bx{color:#2563eb;font-weight:700}.tl{color:#dc2626;font-weight:700}"
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
    '<section class="hero"><span class="pill">Procédure · pfSense · VPN</span>'
    '<h1>VPN IPsec site-à-site sur pfSense</h1>'
    '<p>Relier deux agences (Bordeaux ↔ Toulouse) par un tunnel IPsec IKEv2 — la '
    'réponse pas à pas aux TP1 (pfSense/DMZ) et TP2 (VPN site-à-site), avec l’adressage arrêté.</p>'
    '</section>',
    STYLE,

    note('blue', '🎯 Ce que couvre cette procédure',
         'Le montage du <strong>tunnel IPsec</strong> entre les deux pfSense, en supposant le TP1 '
         'acquis (interfaces, DMZ, DHCP, AD). On part de l’<strong>adressage arrêté</strong>, on monte '
         'la <strong>phase 1</strong> et la <strong>phase 2</strong> avec exactement les paramètres '
         'demandés, on ouvre le pare-feu pour le VPN, on teste (ping client↔client, accès au dossier '
         '<code>PARTAGE</code>) et on finit par la <strong>relation d’approbation</strong> entre les '
         'deux domaines. Le fond théorique : '
         '<a href="/pages/vpn-site-a-site">Le VPN site-à-site</a> et '
         '<a href="/pages/le-vpn">Le VPN — comprendre</a>. L’outil qui écrit le reste de la config '
         'pfSense : <a href="/pages/configurateur-pfsense">le configurateur pfSense</a>.'),
    note('red', '⚠️ LE piège du labo : « Block private networks » sur le WAN',
         'Ici le WAN des deux agences est un réseau <strong>privé</strong> (10.22.10.0/24, le réseau '
         'de la salle). La règle d’usine du WAN <strong>jette tout paquet venant d’une source '
         'privée</strong> — donc la phase 1 du VPN, qui arrive de l’autre agence, ne démarre jamais et '
         '<em>sans le moindre message</em>. Sur <strong>chaque</strong> pfSense : '
         '<code>Interfaces ▸ WAN</code> → décocher <strong>Block private networks</strong> et '
         '<strong>Block bogon networks</strong>, Save, Apply. À faire avant tout le reste.'),

    etape(1, BLEU, 'Le plan d’adressage', 'Les deux agences, réseaux distincts (10.180 vs 10.160)',
          '<p>Bordeaux vit en <span class="bx">10.180.x.x/24</span>, Toulouse en '
          '<span class="tl">10.160.x.x/24</span> — jamais le même adressage des deux côtés, sinon le '
          'tunnel n’a rien à router. Le WAN des deux est sur le <strong>même segment '
          'd’interconnexion</strong> 10.22.10.0/24 : ils se joignent directement.</p>'
          + tab(['Interface pfSense', 'Rôle', '<span class="bx">Bordeaux</span>', '<span class="tl">Toulouse</span>'], [
              ['<strong>WAN</strong>', 'Interconnexion', '<code>10.22.10.65/24</code> · gw <code>10.22.10.254</code>', '<code>10.22.10.164/24</code> · gw <code>10.22.10.254</code>'],
              ['<strong>LAN</strong>', 'SRV / AD', '<code>10.180.10.254/24</code>', '<code>10.160.10.254/24</code>'],
              ['<strong>OPT1</strong>', 'CLIENT (DHCP)', '<code>10.180.20.254/24</code> · bail .100–.200', '<code>10.160.20.254/24</code> · bail .100–.200'],
              ['<strong>OPT2</strong>', 'DMZ', '<code>10.180.30.254/24</code>', '<code>10.160.30.254/24</code>'],
          ])
          + '<p>Repères pour les machines : AD/DNS <span class="bx">10.180.10.10</span> / '
          '<span class="tl">10.160.10.10</span> ; serveur web DMZ <span class="bx">10.180.30.10</span> '
          '/ <span class="tl">10.160.30.10</span> ; les postes clients en DHCP sur OPT1.</p>'
          + note('gray', '📌 Combien d’interfaces ? (TP1)',
                 'Quatre par pfSense : <strong>WAN, LAN, OPT1, OPT2</strong> — donc quatre cartes '
                 'réseau sur la VM, chacune sur son vSwitch (LAN Serveur, LAN, DMZ, et le vSwitch '
                 'd’interconnexion partagé entre les deux agences pour le WAN).')),

    etape(2, VERT, 'Vérifier la liaison WAN entre les agences', 'Avant le VPN, le simple ping WAN↔WAN',
          '<p>Les deux WAN sont sur <code>10.22.10.0/24</code> : ils doivent se pinguer '
          '<strong>directement</strong>, sans passer par la passerelle Internet.</p>'
          + cmd('# depuis le pfSense de Bordeaux (Diagnostics ▸ Ping, source WAN) :\nping 10.22.10.164     # le WAN de Toulouse\n\n# et l\'inverse depuis Toulouse :\nping 10.22.10.65')
          + note('yellow', '⚠️ Si le ping ne passe pas',
                 'C’est presque toujours <strong>Block private networks</strong> encore coché (voir '
                 'l’encadré du haut), ou les deux WAN qui ne sont pas sur le même vSwitch '
                 'd’interconnexion. Tant que ce ping ne passe pas, inutile d’attaquer le VPN.')),

    etape(3, VIOLET, 'Phase 1 — la négociation IKE', 'VPN ▸ IPsec ▸ Tunnels ▸ Add P1',
          '<p><code>VPN ▸ IPsec ▸ Tunnels ▸ + Add P1</code>. Les paramètres sont '
          '<strong>identiques des deux côtés</strong> ; seule change la <em>passerelle distante</em> '
          '(l’autre agence).</p>'
          + tab(['Champ', 'Valeur', 'Côté Bordeaux', 'Côté Toulouse'], [
              ['Key Exchange version', '<strong>IKEv2</strong>', '—', '—'],
              ['Internet Protocol', 'IPv4', '—', '—'],
              ['Interface', '<strong>WAN</strong>', '—', '—'],
              ['Remote Gateway', '<em>l’autre agence</em>', '<code>10.22.10.164</code>', '<code>10.22.10.65</code>'],
              ['Authentication Method', '<strong>Mutual PSK</strong>', '—', '—'],
              ['My identifier', 'My IP address', '—', '—'],
              ['Peer identifier', 'Peer IP address', '—', '—'],
              ['Pre-Shared Key', '<em>une clé longue, identique</em>', '<code>&lt;PSK&gt;</code>', '<code>&lt;même PSK&gt;</code>'],
              ['Encryption Algorithm', '<strong>AES256-GCM</strong>, longueur <strong>128 bits</strong>', '—', '—'],
              ['Hash', '<strong>SHA256</strong>', '—', '—'],
              ['DH Group', '<strong>14 (2048 bit)</strong>', '—', '—'],
          ])
          + note('red', '🚨 La faute n°1 : la clé et les identifiants',
                 'La <strong>Pre-Shared Key doit être rigoureusement la même</strong> des deux côtés '
                 '(copier-coller, pas retaper). Avec <em>My IP / Peer IP</em>, les identifiants se '
                 'déduisent des adresses WAN — rien à saisir, mais si tu forces un identifiant, il doit '
                 'être <strong>croisé</strong> : le « My » d’un côté = le « Peer » de l’autre.')),

    etape(4, TEAL, 'Phase 2 — ce qui passe dans le tunnel', 'Show Phase 2 ▸ Add P2',
          '<p>Sous le tunnel, <code>Show Phase 2 Entries ▸ + Add P2</code>. La phase 2 dit '
          '<strong>quels réseaux</strong> se parlent à travers le tunnel. Le plus simple pour que '
          '<em>tout</em> l’interne d’une agence joigne tout l’interne de l’autre : déclarer les '
          '<strong>supernets /16</strong>.</p>'
          + tab(['Champ', 'Valeur', 'Côté Bordeaux', 'Côté Toulouse'], [
              ['Mode', 'Tunnel IPv4', '—', '—'],
              ['Local Network', 'Network', '<code>10.180.0.0/16</code>', '<code>10.160.0.0/16</code>'],
              ['Remote Network', 'Network', '<code>10.160.0.0/16</code>', '<code>10.180.0.0/16</code>'],
              ['Protocol', 'ESP', '—', '—'],
              ['Encryption', '<strong>AES256-GCM 128</strong>', '—', '—'],
              ['Hash', 'SHA256', '—', '—'],
              ['PFS key group', '<strong>14 (2048 bit)</strong>', '—', '—'],
          ])
          + note('gray', '🎯 /16 ou réseau par réseau ?',
                 'Le <strong>/16</strong> (10.180.0.0/16 ↔ 10.160.0.0/16) couvre d’un coup LAN, CLIENT '
                 '<em>et</em> DMZ, et suffit à tous les tests. Si tu veux <strong>exclure la DMZ</strong> '
                 'du tunnel, n’ajoute pas le /16 mais <strong>une entrée Phase 2 par couple de réseaux</strong> '
                 'à relier (ex. CLIENT-Bx <code>10.180.20.0/24</code> ↔ SRV-Tls <code>10.160.10.0/24</code>, '
                 'etc.) — plus précis, mais il en faut une par paire source/destination.')),

    etape(5, AMBRE, 'Ouvrir le pare-feu pour le VPN', 'WAN : IKE + ESP ; onglet IPsec : le trafic',
          '<p>Deux endroits, à ne pas confondre.</p>'
          + '<p><strong>a) Laisser <em>entrer</em> la négociation sur le WAN</strong> '
          '(<code>Firewall ▸ Rules ▸ WAN</code>). pfSense ajoute ces règles automatiquement quand IPsec '
          'est activé ; pour les poser à la main, source = l’IP WAN de l’autre agence :</p>'
          + tab(['Règle', 'Proto', 'Source', 'Destination', 'Port'], [
              ['IKE', 'UDP', '<em>WAN distant</em>', 'WAN address', '500'],
              ['NAT-T', 'UDP', '<em>WAN distant</em>', 'WAN address', '4500'],
              ['ESP', 'ESP', '<em>WAN distant</em>', 'WAN address', '—'],
          ])
          + '<p><strong>b) Autoriser le trafic <em>déchiffré</em></strong> '
          '(<code>Firewall ▸ Rules ▸ IPsec</code>) : cet onglet filtre ce qui ressort du tunnel. '
          'Pour le labo, une règle <strong>Pass IPv4 * de source « réseau distant » vers « réseaux '
          'locaux »</strong> (ou any→any) suffit ; en production on restreint aux flux utiles.</p>'
          + note('gray', '🔎 Le « WAN distant » en pratique',
                 'Bordeaux autorise la source <code>10.22.10.164</code> ; Toulouse autorise '
                 '<code>10.22.10.65</code>. Save, puis <strong>Apply Changes</strong> — la sauvegarde '
                 'seule ne suffit jamais sur pfSense.')),

    etape(6, VERT, 'Démarrer et vérifier le tunnel', 'Status ▸ IPsec',
          '<p><code>Status ▸ IPsec</code> → bouton <strong>Connect</strong> sur le tunnel (ou générer '
          'du trafic vers l’autre agence pour le monter). On veut voir la <strong>phase 1 '
          '« Established »</strong> et la <strong>phase 2 (Child SA)</strong> avec des octets qui '
          'montent.</p>'
          + '<p>Puis les tests du TP2, depuis un <strong>poste client</strong> (pas depuis pfSense — '
          'un ping lancé du pfSense part avec l’IP WAN, hors du /16 du tunnel) :</p>'
          + cmd('# depuis un client de Bordeaux (10.180.20.x) :\nping 10.160.20.50        # un client de Toulouse\nping 10.160.10.10        # l\'AD de Toulouse\n\n# acces au partage du serveur AD distant (explorateur Windows) :\n\\\\10.160.10.10\\PARTAGE')
          + note('yellow', '⚠️ « Established mais rien ne passe »',
                 'Le tunnel est monté mais le ping échoue : c’est presque toujours la <strong>phase 2</strong> '
                 '(réseaux locaux/distants mal déclarés, ou pas en miroir) ou l’onglet '
                 '<strong>Firewall ▸ IPsec</strong> qui bloque. Vérifie aussi que le pare-feu '
                 '<strong>Windows</strong> du serveur/poste autorise le ping et le partage depuis un '
                 'réseau étranger (profil « Domaine »).')),

    etape(7, ROUGE, 'Diagnostic — lire le journal', 'Status ▸ System Logs ▸ IPsec',
          '<p>Le journal nomme presque toujours la cause. Les grands classiques :</p>'
          + tab(['Message', 'Cause', 'Correctif'], [
              ['<code>NO_PROPOSAL_CHOSEN</code>', 'Les propositions diffèrent (algos phase 1 ou 2 pas identiques)', 'Recopier AES256-GCM/SHA256/DH14 <strong>à l’identique</strong> des deux côtés'],
              ['<code>AUTHENTICATION_FAILED</code>', 'PSK différente, ou identifiants (IKE ID) non croisés', 'Recopier la PSK ; laisser My IP / Peer IP'],
              ['<code>TS_UNACCEPTABLE</code>', 'Les réseaux de la phase 2 ne correspondent pas', 'Local d’un côté = Remote de l’autre (miroir)'],
              ['Phase 1 muette, aucun log', 'UDP 500 jeté à l’entrée du WAN', '<strong>Block private networks</strong> encore coché, ou règle WAN absente'],
              ['Established, 0 octet', 'Filtrage après déchiffrement', 'Règle <em>Pass</em> sur l’onglet <code>Firewall ▸ IPsec</code>'],
          ])),

    etape(8, BLEU, 'La relation d’approbation entre domaines', 'TP2 — bordeaux.local ⇄ toulouse.local',
          '<p>Dernier objectif du TP2 : qu’un utilisateur de Toulouse ouvre un dossier de Bordeaux avec '
          '<em>ses</em> identifiants, et l’inverse. C’est une <strong>approbation bidirectionnelle</strong> '
          'entre les deux forêts, une fois le tunnel debout.</p>'
          + '<ol class="proc-steps">'
          '<li><strong>Résolution DNS croisée</strong> (indispensable, sinon l’approbation échoue) : sur '
          'l’AD de Bordeaux, un <em>redirecteur conditionnel</em> <code>toulouse.local</code> → '
          '<code>10.160.10.10</code> ; sur l’AD de Toulouse, <code>bordeaux.local</code> → '
          '<code>10.180.10.10</code>. (DNS ▸ Redirecteurs conditionnels.)</li>'
          '<li><strong>Créer l’approbation</strong> : <code>Domaines et approbations Active Directory</code> '
          '→ clic droit sur le domaine → <em>Propriétés</em> → onglet <em>Approbations</em> → '
          '<em>Nouvelle approbation</em> → type <strong>Approbation de forêt</strong> (ou externe), sens '
          '<strong>bidirectionnel</strong>. À faire d’un seul côté avec le mot de passe d’approbation, '
          'puis valider dans les deux sens.</li>'
          '<li><strong>Vérifier</strong> : depuis un poste de Bordeaux, se connecter avec un compte '
          '<code>TOULOUSE\\utilisateur</code> ; ouvrir <code>\\\\10.160.10.10\\PARTAGE</code> et poser '
          'les droits NTFS pour un groupe de l’autre domaine.</li></ol>'
          + note('gray', '💡 Pourquoi le DNS d’abord',
                 'Une approbation se monte par <strong>nom de domaine</strong>, pas par IP : sans '
                 'résolution croisée, l’assistant ne trouve pas l’autre forêt. Le redirecteur '
                 'conditionnel (ou une zone de stub) est le préalable qu’on oublie le plus souvent.')),

    note('green', '✅ Le cahier de test (TP1 & TP2)',
         '<strong>Local :</strong> chaque interface se pingue depuis pfSense ; un client OPT1 reçoit '
         'une IP DHCP ; le site web de la DMZ répond en http/https depuis le LAN et depuis le WAN (NAT). '
         '<strong>VPN :</strong> WAN↔WAN OK ; phase 1 <em>Established</em> ; phase 2 avec trafic ; '
         'client Bx ↔ client Tls ; accès <code>\\\\AD-distant\\PARTAGE</code> dans les deux sens ; '
         'ouverture de session inter-domaine après l’approbation.'),
    note('gray', '🔗 Pour aller avec',
         '<a href="/pages/configurateur-pfsense">Configurateur pfSense</a> (interfaces, DHCP, NAT, '
         'règles du TP1) · <a href="/pages/vpn-site-a-site">Le VPN site-à-site</a> · '
         '<a href="/pages/le-vpn">La cryptographie du tunnel (IKE, ESP, PSK)</a> · '
         '<a href="/pages/openvpn-pfsense">OpenVPN sur pfSense</a> (l’accès nomade, l’autre besoin).'),
])

EXTRAIT = ('Monter un tunnel IPsec IKEv2 entre deux pfSense (Bordeaux ↔ Toulouse) : plan d’adressage, '
           'phase 1 (IKEv2, PSK mutuel, AES256-GCM, SHA256, DH14), phase 2 (réseaux /16), règles WAN + '
           'onglet IPsec, tests client↔client et accès PARTAGE, diagnostic, et la relation '
           'd’approbation AD — la réponse aux TP1/TP2.')

CARTE = ('<a class="dir-card" href="/pages/procedure-vpn-ipsec-pfsense"><div class="dc-ico">🔐</div>'
         '<div class="dc-body"><div class="dc-title">pfSense — VPN IPsec site-à-site</div>'
         '<div class="dc-desc meta">Pas à pas Bordeaux ↔ Toulouse (TP1/TP2) : adressage, phase 1 '
         '(IKEv2, PSK mutuel, AES256-GCM, SHA256, DH14), phase 2 /16, règles WAN + IPsec, tests '
         'client↔client et accès PARTAGE, diagnostic du journal, approbation AD.</div>'
         '<div><span style="display:inline-block;font-size:10.5px;font-weight:600;color:var(--text-muted);'
         'background:var(--surface-3);border:1px solid var(--border);border-radius:999px;padding:1px 9px;'
         'margin:4px 4px 0 0">pfSense</span>'
         '<span style="display:inline-block;font-size:10.5px;font-weight:600;color:var(--text-muted);'
         'background:var(--surface-3);border:1px solid var(--border);border-radius:999px;padding:1px 9px;'
         'margin:4px 4px 0 0">VPN IPsec</span></div></div><div class="dc-go">Voir →</div></a>')


def ranger(c):
    h = c.execute("SELECT content FROM pages WHERE slug='procedures'").fetchone()[0]
    if SLUG not in h:
        m = re.search(r'<section class="pd-sec" id="sec-reseau">.*?</section>', h, re.S)
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
    return f'index : sec-reseau={comptes.get("sec-reseau")} ; total {total}'


if __name__ == '__main__':
    c = sqlite3.connect(BASE)
    print(SLUG, ':', publier(c, SLUG, TITRE, EXTRAIT, CORPS))
    print(ranger(c).encode('ascii', 'replace').decode())
    c.commit()
    c.close()
    sys.exit(0)

# -*- coding: utf-8 -*-
"""
Range les nouvelles procédures dans la page d'index `procedures`.

LES COMPTEURS SONT RECALCULÉS, JAMAIS SAISIS.
La page affiche trois fois le même chiffre : dans la puce du sommaire, dans le
titre de la section, et dans le total en tête. Les tenir à la main, c'est
garantir qu'un jour les trois se contredisent — le total annonçait d'ailleurs
40 pour 42 cartes réelles. Ici on compte les cartes présentes et on réécrit les
trois endroits d'après ce comptage.

IDEMPOTENT : une carte dont le lien est déjà là n'est pas ajoutée deux fois.
On peut donc rejouer le script après avoir corrigé un libellé.
"""
import io
import re
import sqlite3
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent / 'cms.sqlite'

# Le style d'étiquette est écrit en ligne dans la page d'origine (pas de classe
# CSS dédiée) : on le reprend tel quel pour que les nouvelles cartes soient
# indiscernables des anciennes.
ETIQ = ('<span style="display:inline-block;font-size:10.5px;font-weight:600;'
        'color:var(--text-muted);background:var(--surface-3);border:1px solid var(--border);'
        'border-radius:999px;padding:1px 9px;margin:4px 4px 0 0">{}</span>')

# section → cartes à ajouter (lien, icône, titre, description, étiquettes)
AJOUTS = {
    'sec-cisco': [
        ('procedure-nat-pat', '🔀', 'Configurer le NAT et le PAT',
         'Déclarer le dedans et le dehors, traduire en PAT (surcharge), en statique ou en dynamique, '
         'et lire la table des traductions.',
         ['Cisco', 'Packet Tracer', 'Réseau']),
        ('procedure-acl', '🛡️', 'Configurer des listes de contrôle d’accès (ACL)',
         'Standard, étendue et nommée : où poser chacune, le masque générique, les compteurs de '
         'correspondance et le refus implicite qui coupe tout.',
         ['Cisco', 'Packet Tracer', 'Sécurité']),
        ('procedure-vtp', '🧬', 'Propager les VLAN avec VTP',
         'Serveur et clients, trunk obligatoire, mot de passe de domaine — et le numéro de révision '
         'qui peut effacer les VLAN de tout le réseau.',
         ['Cisco', 'VLAN', 'Packet Tracer']),
        ('procedure-vlan-securite', '🔒', 'Sécuriser les VLAN d’un commutateur',
         'Port-security en mode sticky, VLAN natif dédié contre le double étiquetage, et mise hors '
         'service des ports inutilisés.',
         ['Cisco', 'VLAN', 'Sécurité']),
    ],
    'sec-linux': [
        ('procedure-samba', '🗂️', 'Partager des fichiers vers Windows avec Samba',
         'Droits Unix d’abord (setgid), puis le partage, les comptes Samba et l’accès depuis '
         'l’Explorateur Windows.',
         ['Linux', 'Debian', 'Fichiers']),
        ('procedure-apache-linux', '🌍', 'Héberger un site avec Apache sous Debian',
         'Hôte virtuel, a2ensite, configtest avant reload — et comment tester le site avant même que '
         'le DNS ne soit prêt.',
         ['Linux', 'Debian', 'Web']),
        ('procedure-linux-lvm', '💽', 'Ajouter un disque et le gérer en LVM',
         'PV, VG, LV expliqués, montage par UUID dans fstab, et l’extension à chaud du volume et de '
         'son système de fichiers.',
         ['Linux', 'Debian', 'Disques']),
        ('procedure-systemd-service', '⚙️', 'Créer et gérer un service systemd',
         'Écrire une unité, comprendre Type, User et WantedBy, la déclencher par un timer et lire ses '
         'journaux avec journalctl.',
         ['Linux', 'Debian', 'Services']),
        ('procedure-cron-journaux', '⏰', 'Planifier avec cron et lire les journaux',
         'Lire une ligne de cron, capturer la sortie du script, retrouver ce qui s’est passé et faire '
         'tourner les journaux avec logrotate.',
         ['Linux', 'Debian', 'Journaux']),
    ],
    'sec-ad': [
        ('procedure-lecteur-reseau-gpo', '🗄️', 'Monter un lecteur réseau par GPO',
         'Préférences de stratégie de groupe plutôt que script de connexion, avec ciblage au niveau de '
         'l’élément pour ne le donner qu’au bon groupe.',
         ['Active Directory', 'GPO', 'Fichiers']),
        ('procedure-profils-itinerants', '👤', 'Mettre en place des profils itinérants',
         'Partage des profils, droits NTFS exacts (créateur propriétaire), chemin %username% dans '
         'l’annuaire, et le suffixe .V6.',
         ['Active Directory', 'Windows', 'Profils']),
    ],
    'sec-services': [
        ('procedure-partage-ntfs', '🔐', 'Créer un partage et régler les permissions',
         'Les deux couches — partage et NTFS — la plus restrictive qui l’emporte, la coupure de '
         'l’héritage, et le contrôle par l’accès effectif.',
         ['Windows Server', 'Fichiers', 'Sécurité']),
    ],
    'sec-windows': [
        ('procedure-pare-feu-windows', '🧱', 'Créer une règle de pare-feu Windows',
         'Les trois profils, l’ouverture d’un port en graphique et en PowerShell, la restriction de la '
         'source, et le déploiement par GPO.',
         ['Windows', 'Sécurité', 'Réseau']),
        ('procedure-raid-windows', '🧮', 'Créer un volume RAID sous Windows Server',
         'Choisir le niveau, monter la grappe en gestion des disques ou en espaces de stockage, et '
         'surveiller sa santé.',
         ['Windows Server', 'Disques', 'Stockage']),
    ],
    'sec-depannage': [
        ('procedure-wireshark', '🔎', 'Capturer et analyser une trame avec Wireshark',
         'Filtre de capture contre filtre d’affichage, suivi de flux TCP, lecture d’un échange DHCP — '
         'et pourquoi un switch ne montre pas le trafic des autres.',
         ['Réseau', 'Diagnostic', 'Analyse']),
    ],
}


def carte(lien, icone, titre, desc, etiquettes):
    return (f'<a class="dir-card" href="/pages/{lien}"><div class="dc-ico">{icone}</div>'
            f'<div class="dc-body"><div class="dc-title">{titre}</div>'
            f'<div class="dc-desc meta">{desc}</div>'
            f'<div>{"".join(ETIQ.format(e) for e in etiquettes)}</div></div>'
            f'<div class="dc-go">Voir →</div></a>')


def main():
    c = sqlite3.connect(BASE)
    ligne = c.execute("SELECT content FROM pages WHERE slug='procedures'").fetchone()
    if not ligne:
        print('page « procedures » introuvable', file=sys.stderr)
        return 1
    html = ligne[0]
    io.open(str(BASE.parent / 'procedures.avant.html'), 'w', encoding='utf-8').write(html)

    ajoutees = 0

    # ── 1. Les cartes, section par section ────────────────────────────────
    for section, cartes in AJOUTS.items():
        m = re.search(r'<section class="pd-sec" id="%s">.*?</section>' % re.escape(section), html, re.S)
        if not m:
            print(f'section {section} introuvable', file=sys.stderr)
            return 1
        bloc = m.group(0)

        nouvelles = ''.join(
            carte(*x) for x in cartes if f'href="/pages/{x[0]}"' not in bloc)
        ajoutees += sum(1 for x in cartes if f'href="/pages/{x[0]}"' not in bloc)

        # Les cartes vivent dans la grille : on insère juste avant sa fermeture.
        if nouvelles:
            fin = bloc.rindex('</div></section>')
            bloc = bloc[:fin] + nouvelles + bloc[fin:]

        html = html[:m.start()] + bloc + html[m.end():]

    # ── 2. Les compteurs, recalculés depuis les cartes présentes ──────────
    comptes = {}
    for m in re.finditer(r'<section class="pd-sec" id="(sec-[^"]+)">(.*?)</section>', html, re.S):
        comptes[m.group(1)] = len(re.findall(r'<a class="dir-card"', m.group(2)))

    def maj_titre(m):
        return re.sub(r'(<span class="pd-count">)\d+(</span>)',
                      lambda t: t.group(1) + str(comptes[m.group(1)]) + t.group(2),
                      m.group(0), count=1)

    html = re.sub(r'<section class="pd-sec" id="(sec-[^"]+)">.*?</section>', maj_titre, html, flags=re.S)

    def maj_puce(m):
        return re.sub(r'(<span class="pd-n">)\d+(</span>)',
                      lambda t: t.group(1) + str(comptes.get(m.group(1), 0)) + t.group(2),
                      m.group(0), count=1)

    html = re.sub(r'<a class="pd-chip" href="#(sec-[^"]+)">.*?</a>', maj_puce, html, flags=re.S)

    total = sum(comptes.values())
    html, n = re.subn(r'>\d+ procédures,', f'>{total} procédures,', html, count=1)
    if n != 1:
        print('le total en tête n’a pas été retrouvé', file=sys.stderr)
        return 1

    c.execute("UPDATE pages SET content=?,"
              " updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug='procedures'", (html,))
    c.commit()
    c.close()

    print(f'{ajoutees} carte(s) ajoutée(s) — total affiché : {total}')
    for s, n in comptes.items():
        print(f'  {s:20} {n}')
    return 0


if __name__ == '__main__':
    sys.exit(main())

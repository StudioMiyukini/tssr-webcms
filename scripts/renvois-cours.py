# -*- coding: utf-8 -*-
"""
Referme la boucle cours → procédure, et répare les liens internes cassés.

POURQUOI DES RENVOIS DEPUIS LES COURS
Une procédure qui n'est atteignable que par l'index se perd. Trente-cinq cours
du site renvoient déjà vers leur procédure par un encadré vert en fin de page —
on reprend exactement ce motif pour les quinze nouvelles, plutôt que d'inventer
une présentation de plus.

LES LIENS CASSÉS SONT ANTÉRIEURS À CE TRAVAIL.
Ils sont réparés ici parce qu'on tenait déjà l'inventaire complet des slugs :
les retrouver coûtait le passage, pas les corriger. Ceux dont la cible n'existe
nulle part ne sont PAS inventés — ils sont signalés en fin d'exécution.

IDEMPOTENT : un cours qui renvoie déjà vers sa procédure n'est pas retouché.
"""
import io
import sqlite3
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent / 'cms.sqlite'

# cours source → (procédure, intitulé du lien, phrase d'accroche)
RENVOIS = [
    ('cisco-nat', 'procedure-nat-pat', 'Configurer le NAT et le PAT',
     'Poser le dedans et le dehors, traduire en PAT, en statique ou en dynamique, et lire la table '
     'des traductions.'),
    ('cisco-acl', 'procedure-acl', 'Configurer des listes de contrôle d’accès',
     'Standard, étendue et nommée : où poser chacune, le masque générique, et le refus implicite qui '
     'coupe tout.'),
    ('vlan-vtp', 'procedure-vtp', 'Propager les VLAN avec VTP',
     'Serveur et clients, trunk obligatoire — et le numéro de révision qui peut effacer les VLAN de '
     'tout le réseau.'),
    ('vlan-securite', 'procedure-vlan-securite', 'Sécuriser les VLAN d’un commutateur',
     'Port-security en mode sticky, VLAN natif dédié et mise hors service des ports inutilisés.'),
    ('linux-samba', 'procedure-samba', 'Partager des fichiers vers Windows avec Samba',
     'Les droits Unix d’abord, puis le partage, les comptes Samba et l’accès depuis l’Explorateur.'),
    ('linux-apache', 'procedure-apache-linux', 'Héberger un site avec Apache sous Debian',
     'Hôte virtuel, a2ensite, configtest avant reload, et le test du site avant même que le DNS ne '
     'soit prêt.'),
    ('linux-disques', 'procedure-linux-lvm', 'Ajouter un disque et le gérer en LVM',
     'Du disque brut au dossier monté, avec le montage par UUID et l’extension à chaud.'),
    ('linux-systemd', 'procedure-systemd-service', 'Créer et gérer un service systemd',
     'Écrire une unité, la déclencher par un timer, et lire ses journaux avec journalctl.'),
    ('linux-cron-logs', 'procedure-cron-journaux', 'Planifier avec cron et lire les journaux',
     'Capturer la sortie du script, retrouver ce qui s’est passé, et faire tourner les journaux.'),
    ('permissions-partage-ntfs', 'procedure-partage-ntfs',
     'Créer un partage et régler les permissions',
     'Les deux couches en pratique, la coupure de l’héritage, et le contrôle par l’accès effectif.'),
    ('lecteurs-reseau', 'procedure-lecteur-reseau-gpo', 'Monter un lecteur réseau par GPO',
     'Préférences de stratégie de groupe et ciblage au niveau de l’élément, sans script de connexion.'),
    ('profils-itinerants', 'procedure-profils-itinerants', 'Mettre en place des profils itinérants',
     'Le partage, les droits NTFS exacts, le chemin %username% dans l’annuaire et le suffixe .V6.'),
    ('le-pare-feu', 'procedure-pare-feu-windows', 'Créer une règle de pare-feu Windows',
     'En graphique, en PowerShell et par GPO, en restreignant la source plutôt qu’en ouvrant large.'),
    ('le-raid', 'procedure-raid-windows', 'Créer un volume RAID sous Windows Server',
     'Gestion des disques ou espaces de stockage, et la surveillance sans laquelle la grappe ne sert '
     'à rien.'),
    ('le-wireshark', 'procedure-wireshark', 'Capturer et analyser une trame avec Wireshark',
     'Filtre de capture contre filtre d’affichage, suivi de flux, et lecture d’un échange DHCP.'),
]

# Liens internes cassés relevés sur l'ensemble du site, avec leur cible réelle.
# On ne répare que ce qui est certain : le libellé du lien désigne sans
# ambiguïté une page existante.
#
# `/atelier` et `/planning` ressemblaient à des liens morts — ce sont en fait
# des routes de l'application (client/src/router.tsx), pas des pages du CMS.
# Les « réparer » les aurait cassés pour de bon.
REPARATIONS = {
    'cmd-powershell': 'cmd-et-powershell',
    'modele-osi': 'les-7-couches-osi',
    'permissions-ntfs': 'permissions-partage-ntfs',
    'procedure-ad': 'procedure-installation-active-directory',
}


def encadre(slug, titre, phrase):
    return ('\n<aside class="pb-note pb-note-green"><p class="pb-note-title">🎓 Passer à la pratique</p>'
            f'<p>Suis la procédure pas-à-pas : <a href="/pages/{slug}"><strong>{titre}</strong></a>. '
            f'{phrase}</p></aside>')


def main():
    c = sqlite3.connect(BASE)
    tous = {r[0] for r in c.execute('SELECT slug FROM pages WHERE published=1')}
    journal = []

    # ── 1. Les renvois depuis les cours ───────────────────────────────────
    ajoutes, deja = 0, 0
    for cours, proc, titre, phrase in RENVOIS:
        ligne = c.execute('SELECT content FROM pages WHERE slug=?', (cours,)).fetchone()
        if not ligne:
            journal.append(f'  cours introuvable : {cours}')
            continue
        html = ligne[0]
        if f'/{proc}"' in html:
            deja += 1
            continue
        c.execute("UPDATE pages SET content=?,"
                  " updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug=?",
                  (html + encadre(proc, titre, phrase), cours))
        ajoutes += 1
        journal.append(f'  + {cours} -> {proc}')

    # ── 2. Les liens cassés ───────────────────────────────────────────────
    reparés = 0
    for casse, cible in REPARATIONS.items():
        if cible not in tous:
            journal.append(f'  cible de remplacement absente : {cible}')
            continue
        for slug, html in c.execute(
                'SELECT slug, content FROM pages WHERE published=1').fetchall():
            neuf = html.replace(f'href="/pages/{casse}"', f'href="/pages/{cible}"') \
                       .replace(f'href="/{casse}"', f'href="/{cible}"')
            if neuf != html:
                c.execute("UPDATE pages SET content=?,"
                          " updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug=?",
                          (neuf, slug))
                reparés += 1
                journal.append(f'  ~ {slug} : /{casse} -> /{cible}')

    c.commit()
    c.close()

    journal.insert(0, f'renvois ajoutés : {ajoutes} (déjà présents : {deja}) — '
                      f'liens réparés : {reparés}')
    io.open(str(BASE.parent / 'renvois-cours.log'), 'w', encoding='utf-8').write('\n'.join(journal))
    print('\n'.join(journal).encode('ascii', 'replace').decode('ascii'))
    return 0


if __name__ == '__main__':
    sys.exit(main())

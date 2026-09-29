# -*- coding: utf-8 -*-
"""
Enrichit le cours « Sauvegarde & restauration des données » (slug
procedure-sauvegarde) avec les notions émergentes de la présentation
Sauvegarde 2026 et du TP Veeam :
  - sauvegarde ≠ archivage ≠ réplication (trois concepts distincts) ;
  - les 3 critères d'une bonne sauvegarde (disponibilité, intégrité, indépendance) ;
  - ce qu'il faut sauvegarder (configs réseau/pare-feu/DNS/AD, clés, certificats) ;
  - l'évolution 3-2-1 → 3-2-1-1-0 (copie immuable + 0 erreur de restauration) ;
  - la vérification d'intégrité automatisée : Health Check et SureBackup.

IDEMPOTENT : chaque insertion est protégée par un marqueur.
"""
import sqlite3
import sys

from _cours import BASE

SLUG = 'procedure-sauvegarde'

# 1) Évolution 3-2-1-1-0, ajoutée à la note d'en-tête « La règle 3-2-1 ».
ANCRE_321 = 'incendie, vol).</p></aside>'
BLOC_32110 = (
    'incendie, vol).</p>'
    '<p><strong>Évolution 3-2-1-1-0</strong> : on ajoute <strong>1</strong> copie <strong>immuable</strong> '
    '(non modifiable pendant sa rétention — à l’épreuve du ransomware) et <strong>0</strong> erreur, '
    'c’est-à-dire des sauvegardes dont la restauration est <strong>vérifiée</strong> automatiquement.</p></aside>'
)

# 2) Trois concepts + 3 critères + quoi sauvegarder, avant « 1) Les types de sauvegarde ».
ANCRE_TYPES = '<h2>1) Les types de sauvegarde</h2>'
BLOC_CONCEPTS = (
    '<h2>Sauvegarde, archivage, réplication : trois choses différentes</h2>'
    '<table class="sv-t"><thead><tr><th>Concept</th><th>But</th><th>Ce qu’il protège… et pas</th></tr></thead><tbody>'
    '<tr><td><strong>Sauvegarde</strong> (backup)</td><td>Copier des données à un instant T pour les '
    '<strong>restaurer</strong> après incident</td><td>Panne, erreur, ransomware — <em>si la copie est '
    'indépendante et testée</em></td></tr>'
    '<tr><td><strong>Archivage</strong></td><td>Conserver des données sur le <strong>long terme</strong> '
    '(raisons légales ou métier)</td><td>La mémoire de l’entreprise ; ce n’est <em>pas</em> une sauvegarde '
    'de production (on n’y restaure pas au quotidien)</td></tr>'
    '<tr><td><strong>Réplication</strong></td><td>Maintenir une copie <strong>synchronisée</strong> (ou '
    'quasi) d’un système, prête à démarrer</td><td>La perte d’un site (reprise rapide) — mais '
    '<strong>pas</strong> une suppression ni un ransomware, qui se propagent au réplica</td></tr>'
    '</tbody></table>'
    '<aside class="pb-note pb-note-yellow"><p class="pb-note-title">⚠️ La réplication ne remplace pas la sauvegarde</p>'
    '<p>Une réplication recopie fidèlement… y compris un fichier chiffré par un ransomware ou supprimé par '
    'erreur. Une stratégie complète <strong>combine les trois</strong> : la sauvegarde pour revenir en '
    'arrière, la réplication pour redémarrer vite, l’archivage pour garder longtemps. Avec Veeam, voir '
    '<a href="/pages/procedure-veeam-replication">réplication &amp; politique de sauvegarde</a>.</p></aside>'
    '<h2>Les 3 critères d’une bonne sauvegarde</h2>'
    '<table class="sv-t"><thead><tr><th>Critère</th><th>Ce qu’il garantit</th></tr></thead><tbody>'
    '<tr><td><strong>Disponibilité</strong></td><td>La sauvegarde est <strong>accessible</strong> au moment '
    'où une restauration est nécessaire (support en ligne, référentiel joignable)</td></tr>'
    '<tr><td><strong>Intégrité</strong></td><td>Les données sont <strong>exploitables et non corrompues</strong> '
    '— ce que vérifient le Health Check et SureBackup (section 3)</td></tr>'
    '<tr><td><strong>Indépendance</strong></td><td>Une copie reste <strong>protégée si la production est '
    'compromise</strong> : hors domaine, hors-ligne ou <strong>immuable</strong></td></tr>'
    '</tbody></table>'
    '<aside class="pb-note pb-note-gray"><p class="pb-note-title">🗃️ Que faut-il sauvegarder ?</p>'
    '<p>Pas seulement les fichiers des utilisateurs : <strong>bases de données</strong> et applications '
    'métier, <strong>configurations</strong> (équipements réseau, pare-feu, DNS, <strong>Active Directory</strong> '
    '— l’état système), <strong>machines virtuelles</strong> et serveurs physiques, et surtout les '
    '<strong>clés, certificats</strong> et éléments nécessaires à une <strong>reprise complète</strong> — '
    'sans eux, une restauration reste partielle.</p></aside>'
)

# 3) Health Check & SureBackup, dans la section « 3) Restaurer (et TESTER) ».
ANCRE_TEST = '<div class="proc-cmd">wbadmin get versions           # lister les sauvegardes disponibles</div>'
BLOC_SUREBACKUP = (
    ANCRE_TEST +
    '<aside class="pb-note pb-note-blue"><p class="pb-note-title">🔎 Vérifier sans tout restaurer à la main : Health Check &amp; SureBackup</p>'
    '<p>Les solutions d’entreprise automatisent la preuve de restauration. Le <strong>Health Check</strong> '
    '<strong>relit les blocs</strong> d’une sauvegarde et détecte une corruption — mais ne prouve pas que le '
    'système redémarre. <strong>SureBackup</strong> (Veeam) va plus loin : il <strong>démarre réellement</strong> '
    'la VM sauvegardée dans un <em>bac à sable réseau isolé</em> (virtual lab) et vérifie qu’elle boote et '
    'répond, à chaque cycle. C’est le <strong>« 0 »</strong> de la règle 3-2-1-1-0 : zéro erreur de '
    'restauration, vérifié par la machine plutôt qu’espéré.</p></aside>'
)


def enrichir(c):
    row = c.execute("SELECT content FROM pages WHERE slug=?", (SLUG,)).fetchone()
    if not row:
        return f'{SLUG} absent'
    ct = row[0]
    faits = []

    if 'Évolution 3-2-1-1-0' not in ct and ANCRE_321 in ct:
        ct = ct.replace(ANCRE_321, BLOC_32110, 1)
        faits.append('3-2-1-1-0')

    if 'trois choses différentes' not in ct and ANCRE_TYPES in ct:
        ct = ct.replace(ANCRE_TYPES, BLOC_CONCEPTS + ANCRE_TYPES, 1)
        faits.append('concepts+critères+quoi')

    if 'Vérifier sans tout restaurer' not in ct and ANCRE_TEST in ct:
        ct = ct.replace(ANCRE_TEST, BLOC_SUREBACKUP, 1)
        faits.append('health-check+surebackup')

    if not faits:
        return 'déjà enrichi'
    c.execute("UPDATE pages SET content=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug=?", (ct, SLUG))
    return 'ajouté : ' + ', '.join(faits)


if __name__ == '__main__':
    c = sqlite3.connect(BASE)
    print(SLUG, ':', enrichir(c).encode('ascii', 'replace').decode())
    c.commit()
    c.close()
    sys.exit(0)

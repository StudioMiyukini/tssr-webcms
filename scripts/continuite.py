# -*- coding: utf-8 -*-
"""
Chantier P1 du comparatif REAC 2026 : continuité et reprise (compétence 9).

Le site savait sauvegarder un serveur Windows et l'AD ; il ne parlait ni de
PRA / PCA, ni de la sauvegarde des VM, des serveurs Linux ou des bases de
données. Quatre cours dans un sous-groupe neuf de la catégorie Maintenance.

IDEMPOTENT.
"""
import sys

from _cours import (Categorie, STYLE, acc, bullets, cmd, hero, menu, note, publier_lot, retenir, steps, tab)

MAINT = Categorie('cat-maintenance', '🛠️', 'Maintenance', '', '#dc2626')
SG = 'Continuité &amp; sauvegardes'

# ══════════════════════════════════════════════════════════════ PRA / PCA ══

PRA = '\n'.join([
    hero('Cours · Continuité', 'PRA, PCA : continuité et reprise d’activité',
         'RTO, RPO, PRI et PCI : ce que l’entreprise accepte de perdre, en temps et en données — et '
         'comment le technicien traduit ça en sauvegardes, en redondance et en tests.'),
    STYLE,
    note('gray', '📚 Avant ce cours',
         '<a href="/pages/procedure-sauvegarde">Sauvegarde &amp; restauration</a> (règle 3-2-1, types de '
         'sauvegarde, Windows Server Backup). Ici on remonte d’un cran : à quoi servent ces sauvegardes, '
         'et qu’est-ce qui doit tourner <em>pendant</em> qu’on restaure.'),
    '<p>Un incendie, un rançongiciel, une inondation dans le local technique, une erreur humaine qui '
    'supprime un partage : la question n’est pas « est-ce que ça arrivera » mais « combien de temps '
    'l’entreprise tient sans son informatique, et combien de données elle accepte de perdre ». Le '
    'REAC 2026 confie au technicien la compétence 9 : « assurer la continuité et la reprise de '
    'l’infrastructure », avec des « sauvegardes conformes au PRI et au PCI » et des « tests de '
    'restauration et de continuité effectués ».</p>',

    '<h2>1) Quatre sigles, deux idées</h2>',
    tab(['Sigle', 'Signifie', 'L’idée'], [
        ['<strong>PCA</strong>', 'Plan de continuité d’activité', '<strong>Continuer</strong> à fonctionner pendant l’incident, même en mode dégradé : redondance, bascule, procédures manuelles'],
        ['<strong>PRA</strong>', 'Plan de reprise d’activité', '<strong>Redémarrer</strong> après l’incident : restaurer, reconstruire, dans un ordre et un délai définis'],
        ['<strong>PCI</strong>', 'Plan de continuité informatique', 'La partie <em>informatique</em> du PCA : ce que le SI doit continuer à fournir'],
        ['<strong>PRI</strong>', 'Plan de reprise informatique', 'La partie informatique du PRA : comment on remonte le SI'],
    ]),
    '<p>Le PCA / PRA est un document de la direction (il parle de personnes, de locaux, de '
    'fournisseurs) ; le PCI / PRI est celui du service informatique. Le technicien exécute le '
    'PRI et fait vivre le PCI.</p>',

    '<h2>2) Les deux chiffres qui décident de tout</h2>',
    tab(['Indicateur', 'Question', 'Exemple', 'Ce que ça impose'], [
        ['<strong>RTO</strong> — Recovery Time Objective', 'Combien de temps d’arrêt maximum ?', 'Messagerie : 4 h. Serveur de fichiers : 8 h. ERP : 2 h. Site vitrine : 48 h.', 'Le délai de restauration : matériel de secours prêt, procédure connue, personne disponible'],
        ['<strong>RPO</strong> — Recovery Point Objective', 'Combien de données perdues maximum ?', 'ERP : 15 min. Fichiers : 24 h. AD : 24 h.', 'La <strong>fréquence</strong> des sauvegardes (ou de la réplication)'],
    ]),
    note('blue', '💡 Un RPO de 15 minutes n’est pas une sauvegarde nocturne',
         'Une sauvegarde chaque nuit donne un RPO de 24 h : ce qui a été saisi dans la journée est '
         'perdu. Un RPO court demande des sauvegardes fréquentes des journaux de transactions (base de '
         'données), une réplication continue, ou un cluster. Le RPO se paie ; c’est la direction qui '
         'choisit, éclairée par le technicien qui chiffre.'),
    '<p>Un troisième terme : la <strong>MTD</strong> (durée maximale d’interruption admissible), fixée par '
    'le métier — le RTO doit lui être inférieur. Le <strong>BIA</strong> (bilan d’impact sur l’activité) '
    'est l’exercice qui liste les activités, leur MTD, et les applications dont elles dépendent.</p>',

    '<h2>3) Du BIA au plan : la démarche</h2>',
    steps('<strong>Inventorier</strong> les services et leurs dépendances : la messagerie a besoin de l’AD, du DNS, du réseau, de l’accès Internet ; l’ERP a besoin de sa base, du serveur d’application, des postes.',
          '<strong>Classer</strong> avec le métier : pour chaque service, MTD, RTO, RPO. Trois niveaux suffisent (critique / important / différable).',
          '<strong>Identifier les scénarios</strong> : panne d’un serveur, d’un hôte de virtualisation, du stockage, du site entier, rançongiciel, erreur humaine, départ de l’unique personne qui sait.',
          '<strong>Choisir les moyens</strong> par service (§4) et les chiffrer.',
          '<strong>Écrire les procédures</strong> de reprise : l’ordre de redémarrage, les commandes, les mots de passe (dans un coffre accessible hors SI), qui appelle qui.',
          '<strong>Tester</strong>, mesurer le RTO réel, corriger, dater. Recommencer chaque année ou à chaque changement majeur.'),

    '<h2>4) Les moyens, du moins cher au plus cher</h2>',
    tab(['Moyen', 'RPO', 'RTO', 'Couvre', 'Ne couvre pas'], [
        ['Sauvegarde nocturne sur disque local', '24 h', 'Heures à jours', 'Erreur humaine, panne de disque', 'Incendie, rançongiciel qui chiffre aussi la sauvegarde'],
        ['Sauvegarde 3-2-1 avec copie <strong>hors site / hors ligne</strong>', '24 h', 'Heures à jours', 'Sinistre du site, rançongiciel', 'Le RTO court : il faut du matériel pour restaurer'],
        ['<strong>Instantanés</strong> (VM, ZFS, VSS)', 'Minutes à heures', 'Minutes', 'Erreur humaine, mise à jour ratée', 'Perte du stockage (l’instantané est dessus) — ce n’est <em>pas</em> une sauvegarde'],
        ['<strong>Réplication</strong> de VM (Hyper-V Replica, ZFS, PBS)', '5–15 min', 'Minutes', 'Perte d’un hôte, d’un site (si réplication distante)', 'La corruption ou le chiffrement, répliqués aussi'],
        ['<strong>Redondance par service</strong> : 2 DC, DHCP failover, DNS secondaire, DFS-R', '0', '0 (transparent)', 'Panne d’un serveur du service', 'Une erreur répliquée (suppression dans l’AD → sur les deux DC)'],
        ['<strong>Cluster</strong> (Hyper-V, Proxmox HA, SQL AlwaysOn)', '0', 'Secondes à minutes', 'Panne matérielle d’un hôte', 'Le stockage partagé, le site, l’erreur humaine'],
        ['<strong>Site de secours</strong> ou cloud (PRA dans Azure)', 'Minutes', 'Heures', 'Le sinistre complet', 'Coût, complexité, exercice à faire'],
    ]),
    note('red', '🚨 La sauvegarde que le rançongiciel ne peut pas atteindre',
         'Un rançongiciel chiffre tout ce qu’il voit : partages, NAS monté, disque USB branché, '
         'sauvegardes accessibles avec un compte administrateur volé. La copie qui compte est '
         '<strong>hors ligne</strong> (bande, disque débranché) ou <strong>immuable</strong> (dépôt en '
         'écriture seule, verrouillage temporel sur le stockage objet, PBS avec compte dédié), et '
         'alimentée en <em>tirant</em> (le serveur de sauvegarde vient chercher) plutôt qu’en poussant. '
         'Voir <a href="/pages/dmz-surveillance-entretien">sauvegardes tirées</a>.'),

    '<h2>5) Le plan de reprise écrit</h2>',
    '<p>Le jour où on en a besoin, le réseau est peut-être coupé et l’intranet inaccessible. Le plan '
    'existe donc <strong>aussi sur papier</strong> et sur un support hors SI. Il contient :</p>',
    bullets('La <strong>cellule de crise</strong> : qui décide de déclencher, qui fait, qui communique (aux utilisateurs, à la direction, aux clients, à la CNIL s’il y a fuite de données personnelles — 72 h).',
            'L’<strong>ordre de redémarrage</strong> : réseau et pare-feu → hyperviseurs et stockage → contrôleurs de domaine et DNS → DHCP → fichiers, bases → applications → postes. Chaque étape avec sa procédure et son test (« le DC répond à <code>nltest /dsgetdc:</code> »).',
            'Les <strong>accès</strong> : mots de passe de secours, clés de chiffrement des sauvegardes (sans elles, la sauvegarde est un bloc inutile), contrats de support, numéros.',
            'Le <strong>mode dégradé</strong> : ce que les métiers font en attendant (bons de commande papier, messagerie de secours).',
            'Le <strong>journal de crise</strong> : heure, action, résultat — pour piloter, et pour l’analyse après coup.'),

    '<h2>6) Tester — sinon ce n’est pas un plan</h2>',
    tab(['Test', 'Fréquence', 'Ce qu’il prouve'], [
        ['<strong>Restauration d’un fichier</strong>', 'Mensuelle', 'La sauvegarde est lisible et on sait s’en servir'],
        ['<strong>Restauration d’une VM complète</strong> dans un réseau isolé', 'Trimestrielle', 'Le RTO réel d’un serveur ; la procédure est juste'],
        ['<strong>Bascule</strong> d’un service redondant (arrêter un DC, un nœud du cluster)', 'Semestrielle', 'La continuité fonctionne <em>vraiment</em>, et personne ne le remarque'],
        ['<strong>Exercice de reprise</strong> sur table ou en réel (scénario « le site est perdu »)', 'Annuelle', 'L’ordre de redémarrage, les accès, la cellule de crise'],
        ['<strong>Suivi des espaces</strong> de sauvegarde', 'Continu (supervision)', 'Que la prochaine sauvegarde aura de la place — critère explicite du RE'],
    ]),
    '<p>Chaque test est <strong>daté, mesuré, documenté</strong> : « restauration de SRV-FIC01 le 12/09, 47 min, '
    'RTO cible 4 h : OK ; la procédure ne mentionnait pas le mot de passe DSRM : corrigé ». C’est ce '
    'compte rendu que le jury et l’auditeur veulent voir.</p>',

    '<h2>7) Ce que ça donne pour une PME de 40 postes</h2>',
    acc(
        ('L’inventaire',
         tab(['Service', 'Niveau', 'RTO', 'RPO', 'Moyen'], [
             ['AD / DNS / DHCP', 'Critique', '1 h', '24 h', '2 DC sur 2 hôtes, DHCP failover, sauvegarde état système quotidienne'],
             ['Fichiers', 'Critique', '4 h', '24 h', 'VM sauvegardée chaque nuit (PBS / Veeam), copie hors site, clichés instantanés VSS toutes les 2 h'],
             ['ERP + base', 'Critique', '2 h', '1 h', 'Sauvegarde complète nocturne + journaux toutes les heures, réplica de VM sur le second hôte'],
             ['Messagerie', 'Important', '4 h', '—', 'Microsoft 365 : responsabilité partagée → sauvegarde tierce des boîtes'],
             ['Pare-feu', 'Critique', '1 h', '—', 'Configuration exportée à chaque changement, boîtier de rechange configuré'],
             ['Site web', 'Différable', '48 h', '24 h', 'Hébergeur + sauvegarde'],
         ])),
        ('Les scénarios couverts',
         bullets('Panne d’un hôte : les VM redémarrent sur l’autre (réplica ou cluster) — RTO minutes.',
                 'Suppression accidentelle : clichés VSS ou corbeille AD — RTO minutes, RPO 2 h.',
                 'Rançongiciel : isolation, reconstruction depuis la copie hors ligne — RTO 1 à 3 jours (assumé, chiffré, accepté par la direction).',
                 'Perte du site : copie hors site + matériel de location ou cloud — RTO 3 à 5 jours (idem).')),
    ),

    retenir('<strong>PCA / PCI</strong> = continuer pendant ; <strong>PRA / PRI</strong> = redémarrer après. Le technicien exécute le PRI et fait vivre le PCI.',
            '<strong>RTO</strong> (temps d’arrêt max) et <strong>RPO</strong> (données perdues max), fixés avec le métier via le BIA ; le RPO décide de la fréquence de sauvegarde.',
            'Les moyens s’empilent : 3-2-1 avec copie hors ligne / immuable, instantanés, réplication, redondance par service, cluster, site de secours.',
            'Le plan existe <strong>sur papier</strong> : cellule de crise, ordre de redémarrage, accès, mode dégradé.',
            '<strong>Tester</strong> : fichier (mois), VM (trimestre), bascule (semestre), exercice (an) — daté, mesuré, documenté.'),
    note('green', '🔗 Les sauvegardes, par type',
         '<a href="/pages/sauvegarde-vm-hyperv">Sauvegarder des machines virtuelles</a> · '
         '<a href="/pages/sauvegarde-linux">Sauvegarder un serveur Linux</a> · '
         '<a href="/pages/sauvegarde-bases-donnees">Sauvegarder une base de données</a> · '
         '<a href="/pages/procedure-sauvegarde-ad">Sauvegarde d’Active Directory</a>.'),
])

# ═══════════════════════════════════════════════════ Sauvegarde des VM ══

VM = '\n'.join([
    hero('Cours · Continuité', 'Sauvegarder des machines virtuelles',
         'Point de contrôle, export, sauvegarde cohérente par VSS, réplication : ce que chacun '
         'protège, avec Hyper-V d’abord, puis Proxmox — et le test de restauration qui va avec.'),
    STYLE,
    note('gray', '📚 Avant ce cours',
         '<a href="/pages/virtualisation">Hyper-V</a>, <a href="/pages/proxmox-multi-hotes">Proxmox</a>, et '
         '<a href="/pages/pra-pca">PRA / PCA</a> pour le RTO / RPO qu’on cherche à tenir.'),
    '<p>Sauvegarder une VM, c’est sauvegarder un fichier disque (VHDX, QCOW2, RAW) et sa '
    'configuration. Ça semble simple ; la difficulté est de le faire <strong>pendant que la VM '
    'tourne</strong>, en obtenant un disque <strong>cohérent</strong> — pas une photo prise au milieu '
    'd’une écriture.</p>',

    '<h2>1) Quatre mécanismes, quatre usages</h2>',
    tab(['Mécanisme', 'C’est…', 'Protège contre', 'Ne protège pas contre'], [
        ['<strong>Point de contrôle</strong> (checkpoint, snapshot)', 'Un disque de différence : les écritures vont dans un nouveau fichier, l’ancien est figé', 'Une mise à jour ratée, une manipulation risquée — <strong>retour en quelques secondes</strong>', 'La perte du stockage (tout est au même endroit) ; à supprimer sous 24–48 h : il ralentit et grossit'],
        ['<strong>Export</strong>', 'Une copie complète de la VM (disques + configuration) dans un dossier', 'La perte de l’hôte, si l’export est ailleurs', 'Le RPO court (c’est une copie complète, lourde) ; à la main, ce n’est pas une stratégie'],
        ['<strong>Sauvegarde</strong> (WSB, Veeam, vzdump, PBS)', 'Une copie cohérente, planifiée, avec rétention et incrémental', 'Tout ce que couvre la 3-2-1, si la copie est hors site', 'Le RTO nul : il faut restaurer'],
        ['<strong>Réplication</strong> (Hyper-V Replica, ZFS replication)', 'La VM recopiée en continu sur un autre hôte, prête à démarrer', 'La perte d’un hôte ou d’un site — <strong>RTO minutes</strong>', 'L’erreur ou le chiffrement, répliqués eux aussi'],
    ]),
    note('red', '🚨 Un point de contrôle n’est pas une sauvegarde',
         'C’est la confusion la plus courante, y compris devant un jury. Le point de contrôle vit sur le '
         'même stockage que la VM : si le disque meurt, tout meurt. Et un point de contrôle oublié '
         'pendant trois mois remplit le volume, ralentit la VM et rend la fusion interminable.'),

    '<h2>2) La cohérence : VSS et l’agent invité</h2>',
    '<p>Sauvegarder un VHDX pendant que Windows écrit dedans donne un disque « sale » — comme un '
    'PC débranché en plein travail. Pour éviter ça, la sauvegarde demande à la VM de se mettre en '
    'état cohérent une fraction de seconde :</p>',
    tab(['Niveau', 'Comment', 'Résultat'], [
        ['<strong>Cohérence de plantage</strong> (crash-consistent)', 'On copie le disque tel quel', 'Comme après une coupure de courant : le système redémarre, mais une base de données peut être corrompue'],
        ['<strong>Cohérence applicative</strong> (application-consistent)', 'L’hôte demande à l’invité (via les services d’intégration Hyper-V ou <code>qemu-guest-agent</code>) de figer les écritures : <strong>VSS</strong> sous Windows, <code>fsfreeze</code> sous Linux', 'Le disque est propre ; SQL Server, Exchange, l’AD sont sauvegardés proprement'],
    ]),
    '<p>Condition : les <strong>services d’intégration</strong> (Hyper-V) ou l’<strong>agent invité</strong> '
    '(Proxmox, VMware) installés et actifs dans la VM. Sans eux, on retombe en cohérence de plantage — '
    'la sauvegarde le signale, et on l’ignore trop souvent.</p>',
    cmd('# Hyper-V : les services d’intégration sont-ils actifs ?\n'
        'Get-VMIntegrationService -VMName SRV-FIC01 | Select Name, Enabled, PrimaryStatusDescription\n'
        '# "Sauvegarde (Instantané de volume)" doit être Enabled / OK'),

    '<h2>3) Hyper-V : Windows Server Backup</h2>',
    steps('Installer la fonctionnalité : <code>Install-WindowsFeature Windows-Server-Backup</code> sur l’<strong>hôte</strong> (pas dans la VM).',
          menu('wbadmin.msc › Planification de sauvegarde') + ' : sauvegarde personnalisée, ajouter les VM sous « Hyper-V » (pas les fichiers VHDX à la main : c’est ce qui déclenche VSS dans l’invité).',
          'Destination : un <strong>disque dédié</strong> (recommandé, WSB le formate et gère lui-même les versions) ou un dossier partagé (une seule version conservée : peu utile).',
          'Horaire : la nuit, en dehors des sauvegardes internes aux VM (base de données) pour ne pas se marcher dessus.',
          'Vérifier le lendemain : ' + menu('wbadmin.msc › Messages') + ', et <code>wbadmin get versions</code>.'),
    cmd('wbadmin start backup -backupTarget:E: -hyperv:"SRV-FIC01,SRV-AD02" -quiet\n'
        'wbadmin get versions\n'
        '# restaurer une VM entière depuis la console : Récupérer › Hyper-V › la VM › vers l’emplacement d’origine ou un autre'),
    '<p>WSB est gratuit et suffisant pour quelques VM. Ses limites : pas de déduplication, pas de '
    'copie hors site intégrée, pas de restauration de fichier <em>dans</em> la VM sans monter le VHDX. '
    'Au-delà, un produit dédié : Veeam Backup &amp; Replication (édition Community gratuite jusqu’à '
    '10 charges), Altaro / Hornetsecurity, Nakivo.</p>',

    '<h2>4) Hyper-V : export, checkpoint, réplica en PowerShell</h2>',
    cmd('# Point de contrôle avant une mise à jour — et sa suppression après\n'
        'Checkpoint-VM -Name SRV-APP01 -SnapshotName "avant-MAJ-2026-09-14"\n'
        'Get-VMSnapshot -VMName SRV-APP01\n'
        'Restore-VMSnapshot -VMName SRV-APP01 -Name "avant-MAJ-2026-09-14" -Confirm:$false   # retour arrière\n'
        'Remove-VMSnapshot -VMName SRV-APP01 -Name "avant-MAJ-2026-09-14"                    # fusion : NE PAS OUBLIER\n'
        '\n'
        '# Export complet (VM allumée possible depuis 2012 R2)\n'
        'Export-VM -Name SRV-APP01 -Path \\\\nas01\\exports\\\n'
        'Import-VM -Path "\\\\nas01\\exports\\SRV-APP01\\Virtual Machines\\<GUID>.vmcx" -Copy -GenerateNewId\n'
        '\n'
        '# Réplica vers un second hôte (à activer sur l’hôte de destination : Hyper-V Settings › Replication)\n'
        'Enable-VMReplication -VMName SRV-FIC01 -ReplicaServerName HV02 -ReplicaServerPort 80 -AuthenticationType Kerberos -ReplicationFrequencySec 300\n'
        'Start-VMInitialReplication -VMName SRV-FIC01\n'
        'Measure-VMReplication                        # état, dernier envoi, retard'),
    note('blue', '💡 Le réplica se teste sans couper',
         '<code>Start-VMFailover -VMName SRV-FIC01 -AsTest</code> sur l’hôte de destination crée une '
         'copie de test isolée : on vérifie qu’elle démarre, sans toucher la production ni la réplication. '
         'C’est le « test de continuité » que le RE demande.'),

    '<h2>5) Proxmox : vzdump et Proxmox Backup Server</h2>',
    tab(['', 'vzdump vers un stockage', 'Proxmox Backup Server'], [
        ['Type', 'Complète à chaque fois (archive .vma.zst)', 'Incrémentale <strong>dédupliquée</strong> : la deuxième nuit ne transfère que les blocs changés'],
        ['Modes', 'snapshot (VM allumée, agent pour la cohérence), suspend, stop', 'snapshot, avec dirty-bitmap'],
        ['Rétention', 'Nombre de sauvegardes par VM', 'Règles fines (7 quotidiennes, 4 hebdo, 12 mensuelles) et <strong>vérification</strong> planifiée de l’intégrité'],
        ['Hors site', 'Copier l’archive soi-même', 'Synchronisation vers un second PBS distant, chiffrement côté client'],
        ['Restauration', 'VM entière', 'VM entière <strong>ou un fichier</strong> à l’intérieur (file restore)'],
    ]),
    cmd('# tâche planifiée : Datacenter › Sauvegarde › Ajouter (toutes les VM, 02:00, mode snapshot, stockage pbs)\n'
        'vzdump 101 --storage pbs --mode snapshot\n'
        'proxmox-backup-client list --repository sauvegarde@pbs@10.10.0.50:datastore1\n'
        '# restaurer sous un nouvel ID pour tester sans écraser la production\n'
        'qmrestore pbs:backup/vm/101/2026-09-14T02:00:12Z 9101 --storage local-lvm'),

    '<h2>6) Ce qu’il y a dans la VM compte aussi</h2>',
    bullets('Une sauvegarde de VM protège le <strong>serveur</strong> ; elle ne remplace pas la sauvegarde <strong>applicative</strong> : l’<a href="/pages/procedure-sauvegarde-ad">état système d’un DC</a>, les <a href="/pages/sauvegarde-bases-donnees">journaux d’une base</a>, une boîte Exchange à restaurer seule.',
            'Restaurer un DC depuis une sauvegarde de VM de trois semaines sans précaution provoque une <strong>restauration non autoritaire incohérente</strong> (USN rollback) : l’AD se répare avec ses outils, ou depuis une sauvegarde reconnue par l’AD (WSB / Veeam application-aware).',
            'Les VM de test et les modèles se sauvegardent moins souvent, ou pas : un tag ou un pool « sans sauvegarde » évite de remplir le stockage.'),

    '<h2>7) Le test de restauration — la procédure</h2>',
    steps('Choisir une VM et une date de sauvegarde ; noter l’heure de début.',
          'Restaurer <strong>sous un autre nom / ID</strong>, sur un réseau virtuel <strong>isolé</strong> (un vSwitch privé, un VLAN de test) : jamais deux SRV-FIC01 sur le même réseau.',
          'Démarrer, ouvrir une session, vérifier le service (partage accessible, base qui répond, journal sans erreur VSS).',
          'Noter l’heure de fin : c’est le <strong>RTO mesuré</strong>. Le comparer au RTO cible.',
          'Supprimer la VM de test ; consigner : date, VM, sauvegarde utilisée, durée, résultat, écarts dans la procédure.'),
    '<p>Une fois par trimestre, une VM différente à chaque fois. Le compte rendu de test est le '
    'livrable que le RE appelle « les tests de restauration sont effectués ».</p>',

    retenir('<strong>Checkpoint</strong> = retour arrière rapide, pas une sauvegarde ; <strong>export</strong> = copie ponctuelle ; <strong>sauvegarde</strong> = planifiée, cohérente, avec rétention ; <strong>réplica</strong> = RTO minutes.',
            'La cohérence applicative demande les <strong>services d’intégration / l’agent invité</strong> (VSS, fsfreeze).',
            'Hyper-V : WSB gratuit sur l’hôte (VM ajoutées sous « Hyper-V »), Veeam au-delà ; <code>Checkpoint-VM</code>, <code>Export-VM</code>, <code>Enable-VMReplication</code>, <code>Start-VMFailover -AsTest</code>.',
            'Proxmox : vzdump planifié ; <strong>PBS</strong> pour l’incrémental dédupliqué, la vérification, le hors site, la restauration de fichier.',
            'La sauvegarde de VM ne remplace pas la sauvegarde applicative (AD, bases) ; <strong>test de restauration trimestriel</strong>, isolé, chronométré, consigné.'),
])

# ══════════════════════════════════════════════════ Sauvegarde Linux ══

LINUX = '\n'.join([
    hero('Cours · Continuité', 'Sauvegarder un serveur Linux',
         'Quoi sauvegarder sur un serveur Linux, avec quoi (tar, rsync, restic), vers où, à quelle '
         'fréquence — un script complet, son timer systemd, et la restauration qu’on a vraiment testée.'),
    STYLE,
    note('gray', '📚 Avant ce cours',
         '<a href="/pages/linux-archivage">Archivage et compression</a>, '
         '<a href="/pages/linux-bash">Scripts Bash</a>, <a href="/pages/linux-cron-logs">cron et journaux</a>.'),
    '<p>Sous Windows, un produit fait tout. Sous Linux, on assemble : un outil de copie, un support, '
    'un planificateur, un journal. C’est plus de choix et plus de responsabilité — d’où l’intérêt '
    'de savoir ce qu’on sauvegarde avant de choisir comment.</p>',

    '<h2>1) Quoi sauvegarder</h2>',
    tab(['Quoi', 'Où', 'Pourquoi'], [
        ['<strong>Les données</strong>', '<code>/srv</code>, <code>/var/www</code>, <code>/home</code>, <code>/var/lib/&lt;appli&gt;</code>', 'Irremplaçables'],
        ['<strong>La configuration</strong>', '<code>/etc</code> (tout), et les fichiers d’unité maison <code>/etc/systemd/system</code>', 'Reconstruire le serveur en une heure au lieu d’une journée'],
        ['<strong>Les bases de données</strong>', 'Un <em>dump</em>, pas les fichiers de <code>/var/lib/mysql</code> à chaud', 'Voir <a href="/pages/sauvegarde-bases-donnees">Sauvegarder une base de données</a>'],
        ['<strong>La liste des paquets</strong>', '<code>dpkg --get-selections &gt; paquets.txt</code>', 'Réinstaller la même chose en une commande'],
        ['<strong>Les journaux</strong>', '<code>/var/log</code>', 'Utile après incident ; rétention courte'],
        ['<strong>Les clés et certificats</strong>', '<code>/etc/ssl/private</code>, <code>/etc/letsencrypt</code>, <code>~/.ssh</code>', 'Sensibles : sauvegarde <strong>chiffrée</strong> obligatoire'],
    ]),
    '<p>Ce qu’on ne sauvegarde pas : <code>/proc</code>, <code>/sys</code>, <code>/dev</code>, <code>/run</code>, '
    '<code>/tmp</code>, le cache de paquets (<code>/var/cache/apt</code>). Le système lui-même '
    '(<code>/usr</code>, <code>/bin</code>) se réinstalle plus vite qu’il ne se restaure.</p>',

    '<h2>2) Trois outils, trois philosophies</h2>',
    tab(['Outil', 'Principe', 'Points forts', 'Limites'], [
        ['<strong>tar</strong>', 'Une archive compressée par sauvegarde', 'Partout, simple, une archive = un fichier à déplacer', 'Complète à chaque fois (ou incrémentale avec <code>--listed-incremental</code>, peu pratique) ; pas de déduplication'],
        ['<strong>rsync</strong>', 'Synchronise une arborescence vers une autre (locale ou SSH), ne transfère que les changements', 'Rapide, reprend où il s’est arrêté, restauration = copier dans l’autre sens', 'Un miroir n’est pas un historique : une suppression se propage. D’où <code>--link-dest</code> pour des versions datées'],
        ['<strong>restic</strong> (ou <strong>borg</strong>)', 'Un dépôt <strong>dédupliqué et chiffré</strong>, des instantanés datés', 'Incrémental permanent, chiffré, rétention intégrée, destinations locales / SSH / S3 / stockage objet', 'Un outil de plus à installer ; la clé du dépôt à conserver hors du serveur'],
    ]),
    note('blue', '💡 Lequel choisir',
         'Un serveur, un disque de sauvegarde : <strong>rsync avec versions</strong> ou <strong>restic</strong>. '
         'Plusieurs serveurs, une copie hors site : <strong>restic</strong> vers un stockage objet ou un serveur '
         'SSH. <strong>tar</strong> pour une archive ponctuelle à emporter (avant une migration, un transfert).'),

    '<h2>3) rsync avec historique : versions datées, peu d’espace</h2>',
    cmd('# chaque jour un dossier daté ; les fichiers inchangés sont des liens durs vers la veille (0 octet de plus)\n'
        'rsync -aAX --delete --link-dest=/mnt/backup/derniere /srv/data/ /mnt/backup/2026-09-14/\n'
        'ln -sfn /mnt/backup/2026-09-14 /mnt/backup/derniere\n'
        '#      -a : archive (droits, dates, liens)  -A : ACL  -X : attributs étendus\n'
        '#      --delete : le miroir suit les suppressions (mais la veille les garde : c’est l’historique)\n'
        '\n'
        '# vers un autre serveur, par SSH avec une clé dédiée\n'
        'rsync -aAX --delete -e "ssh -i /root/.ssh/backup_ed25519" /srv/data/ backup@nas01:/volume1/srv-web01/data/'),
    '<p>Le <code>/</code> final après le dossier source a un sens : <code>/srv/data/</code> copie le '
    '<em>contenu</em>, <code>/srv/data</code> copie le dossier lui-même. La faute la plus classique.</p>',

    '<h2>4) restic : dépôt chiffré, dédupliqué, rétention</h2>',
    cmd('apt install restic\n'
        'export RESTIC_REPOSITORY=sftp:backup@nas01:/volume1/restic/srv-web01\n'
        'export RESTIC_PASSWORD_FILE=/root/.restic-pass        # chmod 600 ; COPIE de la clé hors du serveur !\n'
        '\n'
        'restic init                                          # une fois\n'
        'restic backup /etc /srv /var/www /home --exclude-file=/root/restic-exclude.txt\n'
        'restic snapshots\n'
        'restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 12 --prune\n'
        'restic check                                         # intégrité du dépôt (hebdomadaire)\n'
        '\n'
        '# restaurer\n'
        'restic restore latest --target /tmp/restauration --include /etc/apache2\n'
        'restic mount /mnt/restic                             # parcourir toutes les versions comme un disque'),
    note('red', '🚨 Sans le mot de passe du dépôt, la sauvegarde est perdue',
         'restic et borg chiffrent tout. La clé (le fichier de mot de passe) doit exister <strong>ailleurs</strong> '
         'que sur le serveur sauvegardé — dans le coffre de mots de passe de l’équipe, et dans le plan de reprise.'),

    '<h2>5) Le script complet, et son timer</h2>',
    cmd('#!/usr/bin/env bash\n'
        '# /usr/local/sbin/sauvegarde.sh — sauvegarde quotidienne restic + dump MariaDB. Journal : /var/log/sauvegarde.log\n'
        'set -euo pipefail\n'
        'export RESTIC_REPOSITORY=sftp:backup@nas01:/volume1/restic/srv-web01\n'
        'export RESTIC_PASSWORD_FILE=/root/.restic-pass\n'
        'LOG=/var/log/sauvegarde.log\n'
        'log() { printf \'%s %s\\n\' "$(date \'+%F %T\')" "$*" >> "$LOG"; }\n'
        'trap \'log "ERREUR ligne $LINENO — sauvegarde interrompue"; exit 1\' ERR\n'
        '\n'
        'log "début"\n'
        'mysqldump --single-transaction --all-databases | gzip > /var/backups/mariadb-$(date +%F).sql.gz\n'
        'find /var/backups -name \'mariadb-*.sql.gz\' -mtime +3 -delete\n'
        'dpkg --get-selections > /var/backups/paquets.txt\n'
        'restic backup /etc /srv /var/www /home /var/backups --quiet\n'
        'restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 12 --prune --quiet\n'
        'log "OK — $(restic snapshots --latest 1 --json | head -c 200)"'),
    cmd('# /etc/systemd/system/sauvegarde.service\n'
        '[Unit]\n'
        'Description=Sauvegarde quotidienne\n'
        '[Service]\n'
        'Type=oneshot\n'
        'ExecStart=/usr/local/sbin/sauvegarde.sh\n'
        '\n'
        '# /etc/systemd/system/sauvegarde.timer\n'
        '[Unit]\n'
        'Description=Sauvegarde quotidienne à 02:30\n'
        '[Timer]\n'
        'OnCalendar=*-*-* 02:30:00\n'
        'Persistent=true          # rattrape si le serveur était éteint\n'
        'RandomizedDelaySec=10m\n'
        '[Install]\n'
        'WantedBy=timers.target\n'
        '\n'
        '# systemctl daemon-reload && systemctl enable --now sauvegarde.timer\n'
        '# systemctl list-timers sauvegarde.timer ; journalctl -u sauvegarde.service'),
    '<p>Un timer systemd plutôt que cron : le journal est dans <code>journalctl</code>, le rattrapage est '
    'intégré, et <code>systemctl status</code> dit si la dernière exécution a échoué. cron reste '
    'valable — voir <a href="/pages/linux-cron-logs">cron et journaux</a>.</p>',

    '<h2>6) Les instantanés LVM : pour une copie cohérente</h2>',
    '<p>Sur un volume LVM, un <strong>instantané</strong> fige le système de fichiers le temps de la '
    'copie — utile pour un serveur très actif, ou pour sauvegarder les fichiers d’une base sans '
    'l’arrêter (avec un <code>FLUSH TABLES WITH READ LOCK</code> le temps de créer l’instantané) :</p>',
    cmd('lvcreate -L 5G -s -n data_snap /dev/vg0/data      # 5 Go pour absorber les écritures pendant la copie\n'
        'mount -o ro /dev/vg0/data_snap /mnt/snap\n'
        'rsync -aAX /mnt/snap/ /mnt/backup/2026-09-14/\n'
        'umount /mnt/snap && lvremove -f /dev/vg0/data_snap  # ne jamais oublier : un instantané plein casse le volume'),
    '<p>Sur ZFS ou Btrfs, l’instantané est natif et gratuit (<code>zfs snapshot</code>, '
    '<code>btrfs subvolume snapshot</code>) — et <code>zfs send | zfs receive</code> réplique vers un autre '
    'serveur. Voir <a href="/pages/linux-disques">Disques, partitions et LVM</a>.</p>',

    '<h2>7) Vérifier, surveiller, restaurer</h2>',
    bullets('<strong>Chaque matin</strong> : la ligne « OK » dans le journal, ou une alerte — un script qui échoue en silence est pire que pas de script. Un <code>OnFailure=</code> dans le service peut envoyer un mail ; la <a href="/pages/installer-zabbix">supervision</a> peut surveiller l’âge du dernier instantané.',
            '<strong>Chaque semaine</strong> : <code>restic check</code> ; l’espace restant sur la destination (<code>df -h</code>, critère explicite du RE : « le suivi des espaces de stockage dédiés aux sauvegardes »).',
            '<strong>Chaque mois</strong> : restaurer un fichier au hasard, comparer (<code>diff</code>, <code>sha256sum</code>).',
            '<strong>Chaque trimestre</strong> : reconstruire le serveur sur une VM neuve à partir de la sauvegarde seule (installation minimale, paquets depuis <code>paquets.txt</code>, <code>/etc</code>, données, dump de base) et chronométrer : c’est le RTO réel.'),

    retenir('On sauvegarde <strong>données, /etc, dumps de bases, liste des paquets, clés</strong> — pas le système.',
            '<strong>rsync --link-dest</strong> pour des versions datées économes ; <strong>restic</strong> pour un dépôt chiffré, dédupliqué, avec rétention et hors site ; <strong>tar</strong> pour l’archive ponctuelle.',
            'Le script : <code>set -euo pipefail</code>, <code>trap</code>, journal, dump avant restic, <code>forget --prune</code> ; un <strong>timer systemd</strong> avec <code>Persistent=true</code>.',
            'La clé du dépôt chiffré vit <strong>hors du serveur</strong>.',
            'Vérifier chaque jour, tester chaque mois, <strong>reconstruire chaque trimestre</strong>.'),
])

# ══════════════════════════════════════════ Sauvegarde bases de données ══

BDD = '\n'.join([
    hero('Cours · Continuité', 'Sauvegarder une base de données',
         'Pourquoi copier les fichiers d’une base ne suffit pas, comment obtenir un RPO d’une heure '
         'avec les journaux de transactions, et les commandes pour MariaDB / MySQL, PostgreSQL et '
         'SQL Server — jusqu’à la restauration à un instant précis.'),
    STYLE,
    note('gray', '📚 Avant ce cours',
         '<a href="/pages/pra-pca">PRA / PCA</a> (RPO), <a href="/pages/sauvegarde-linux">Sauvegarder un serveur '
         'Linux</a>, <a href="/pages/sauvegarde-vm-hyperv">Sauvegarder des VM</a>.'),
    '<p>Une base de données, c’est l’ERP, le logiciel de paie, le GLPI, le site web. C’est aussi le '
    'composant dont la sauvegarde rate le plus souvent : copier <code>/var/lib/mysql</code> pendant '
    'que la base écrit donne des fichiers incohérents, qui ne se rouvrent pas. Et c’est celui dont le '
    'RPO est le plus court : perdre une journée de commandes n’est pas acceptable.</p>',

    '<h2>1) Trois façons de sauvegarder une base</h2>',
    tab(['Méthode', 'Principe', 'Avantages', 'Limites'], [
        ['<strong>Dump logique</strong>', 'La base exporte son contenu en SQL (ou format propre)', 'Portable, lisible, restaurable sur une autre version ; un fichier', 'Lent sur les grosses bases ; restauration = rejouer tout le SQL'],
        ['<strong>Sauvegarde physique</strong>', 'Copie des fichiers, mais <em>cohérente</em> (outil de l’éditeur, ou instantané + verrou)', 'Rapide, restauration rapide', 'Même version et même moteur ; plus technique'],
        ['<strong>Journaux de transactions</strong>', 'Après une sauvegarde complète, on archive le journal des modifications en continu', '<strong>RPO de minutes</strong>, restauration à un instant précis (PITR)', 'Chaîne à ne pas casser ; espace ; à comprendre avant de s’y fier'],
    ]),
    '<p>Une stratégie courante : <strong>complète chaque nuit</strong> (dump ou physique) + <strong>journaux '
    'toutes les 15 minutes à une heure</strong> pour les bases critiques.</p>',

    '<h2>2) MariaDB / MySQL</h2>',
    cmd('# dump logique cohérent (InnoDB) sans bloquer les écritures\n'
        'mysqldump --single-transaction --routines --triggers --events --all-databases | gzip > /var/backups/mariadb-$(date +%F-%H%M).sql.gz\n'
        '# une seule base\n'
        'mysqldump --single-transaction glpi | gzip > glpi-$(date +%F).sql.gz\n'
        '\n'
        '# restaurer (dans une base vide ou une base de test !)\n'
        'zcat glpi-2026-09-14.sql.gz | mysql glpi_test\n'
        '\n'
        '# sauvegarde physique à chaud (mariadb-backup / xtrabackup) : pour les grosses bases\n'
        'mariadb-backup --backup --target-dir=/var/backups/mariadb-full/\n'
        'mariadb-backup --prepare --target-dir=/var/backups/mariadb-full/    # avant restauration'),
    '<p>Pour la restauration à un instant précis : activer le <strong>journal binaire</strong> '
    '(<code>log_bin</code> dans la configuration), l’archiver avec le dump, et rejouer avec '
    '<code>mysqlbinlog --stop-datetime="2026-09-14 10:42:00" … | mysql</code> après restauration du '
    'dump — jusqu’à juste avant la fausse manipulation.</p>',
    note('yellow', '⚠️ Les identifiants dans le script',
         'Pas de <code>-p MotDePasse</code> en clair dans un script (visible dans <code>ps</code> et l’historique) : '
         'un fichier <code>/root/.my.cnf</code> en 600 avec <code>[client] user= password=</code>, ou un '
         'compte dédié à la sauvegarde avec les seuls droits <code>SELECT, LOCK TABLES, SHOW VIEW, EVENT, TRIGGER</code>.'),

    '<h2>3) PostgreSQL</h2>',
    cmd('# dump d’une base au format personnalisé (compressé, restauration sélective)\n'
        'sudo -u postgres pg_dump -Fc glpi > /var/backups/glpi-$(date +%F).dump\n'
        '# toutes les bases + rôles\n'
        'sudo -u postgres pg_dumpall | gzip > /var/backups/pg-all-$(date +%F).sql.gz\n'
        '\n'
        '# restaurer\n'
        'sudo -u postgres createdb glpi_test && sudo -u postgres pg_restore -d glpi_test /var/backups/glpi-2026-09-14.dump\n'
        '\n'
        '# sauvegarde physique + archivage des WAL (journaux) : RPO minutes, PITR\n'
        '# postgresql.conf : wal_level = replica ; archive_mode = on ; archive_command = \'cp %p /var/backups/wal/%f\'\n'
        'sudo -u postgres pg_basebackup -D /var/backups/pg-base-$(date +%F) -Ft -z -X stream'),
    '<p>Des outils enveloppent tout ça proprement : <strong>pgBackRest</strong>, <strong>barman</strong> '
    '(complète, incrémentale, WAL, rétention, restauration PITR en une commande).</p>',

    '<h2>4) SQL Server (Windows)</h2>',
    '<p>Le modèle SQL Server est le plus explicite sur les journaux, et c’est celui que le jury '
    'connaît le mieux :</p>',
    tab(['Type', 'Contient', 'Fréquence typique'], [
        ['<strong>Complète</strong> (FULL)', 'Toute la base', 'Chaque nuit'],
        ['<strong>Différentielle</strong> (DIFF)', 'Ce qui a changé depuis la dernière complète', 'Toutes les 6 h sur les grosses bases'],
        ['<strong>Journal</strong> (LOG)', 'Les transactions depuis la dernière sauvegarde de journal — <em>seulement en mode de récupération FULL</em>', 'Toutes les 15 min à 1 h'],
    ]),
    cmd('-- complète, puis journal toutes les heures (mode de récupération : FULL)\n'
        'BACKUP DATABASE Compta TO DISK = \'E:\\Backup\\Compta_FULL_20260914.bak\' WITH COMPRESSION, CHECKSUM;\n'
        'BACKUP LOG Compta TO DISK = \'E:\\Backup\\Compta_LOG_20260914_1000.trn\';\n'
        '\n'
        '-- restaurer à un instant précis (10:42, juste avant la suppression)\n'
        'RESTORE DATABASE Compta_test FROM DISK = \'E:\\Backup\\Compta_FULL_20260914.bak\' WITH NORECOVERY, MOVE ...;\n'
        'RESTORE LOG Compta_test FROM DISK = \'E:\\Backup\\Compta_LOG_20260914_1000.trn\' WITH NORECOVERY;\n'
        'RESTORE LOG Compta_test FROM DISK = \'E:\\Backup\\Compta_LOG_20260914_1100.trn\' WITH STOPAT = \'2026-09-14 10:42:00\', RECOVERY;'),
    note('red', '🚨 Le journal qui remplit le disque',
         'En mode FULL, le journal de transactions ne se vide <em>que</em> quand on le sauvegarde. Une base '
         'en mode FULL sans sauvegarde de journal grossit jusqu’à remplir le disque et bloquer '
         'l’application — panne classique. Soit on sauvegarde le journal, soit on passe la base en '
         'mode SIMPLE (et on renonce au PITR).'),
    '<p>La planification se fait par un <strong>plan de maintenance</strong> (SSMS) ou l’Agent SQL Server ; '
    'sur SQL Express (sans Agent), par le <a href="/pages/planificateur-taches-windows">Planificateur '
    'de tâches</a> et <code>sqlcmd</code>. Les fichiers <code>.bak</code> / <code>.trn</code> sont ensuite '
    'repris par la sauvegarde du serveur ou de la VM.</p>',

    '<h2>5) La base dans une VM : qui sauvegarde quoi ?</h2>',
    bullets('La sauvegarde de VM (avec cohérence applicative, VSS) donne une base <em>redémarrable</em> — RPO = la fréquence de sauvegarde de la VM (souvent 24 h).',
            'La sauvegarde <em>de la base</em> (dumps + journaux) donne le RPO court et la restauration à un instant précis, y compris d’une seule base sans toucher au reste du serveur.',
            'Les deux se complètent : les dumps et journaux sont écrits sur le disque de la VM, puis embarqués dans la sauvegarde de VM — et copiés hors site.',
            'Une seule règle : ne jamais laisser les deux tourner à la même minute (verrous, charge).'),

    '<h2>6) Restaurer — et prouver qu’on sait le faire</h2>',
    steps('<strong>Jamais sur la base de production</strong> en premier : restaurer dans <code>glpi_test</code> / <code>Compta_test</code>, vérifier le contenu (les dernières lignes, un total, une requête métier).',
          'Vérifier l’<strong>intégrité</strong> : <code>CHECK TABLE</code> / <code>mysqlcheck</code>, <code>DBCC CHECKDB</code>, <code>pg_dump</code> qui se termine sans erreur.',
          'Mesurer la durée : c’est le RTO de la base ; un dump de 50 Go se restaure en heures, pas en minutes — d’où la sauvegarde physique pour les grosses bases.',
          'Documenter : quelle sauvegarde, quelle commande, combien de temps, quel écart — le compte rendu de test.',
          'Une fois par trimestre, un <strong>test de restauration à un instant précis</strong> : c’est là que les chaînes de journaux cassées se découvrent.'),

    retenir('Copier les fichiers d’une base à chaud = sauvegarde <strong>incohérente</strong>. On utilise un dump, une sauvegarde physique cohérente, ou un instantané verrouillé.',
            '<strong>Complète chaque nuit + journaux toutes les 15 min à 1 h</strong> pour un RPO court et une restauration à un instant précis (binlog, WAL, .trn).',
            'MariaDB : <code>mysqldump --single-transaction</code>, <code>mariadb-backup</code> ; PostgreSQL : <code>pg_dump -Fc</code>, <code>pg_basebackup</code> + WAL, pgBackRest ; SQL Server : FULL / DIFF / LOG, <code>STOPAT</code>.',
            'Mode FULL sans sauvegarde de journal = disque plein. Identifiants dans un fichier protégé, pas dans la commande.',
            'La sauvegarde de VM complète la sauvegarde de base, elle ne la remplace pas ; on restaure d’abord <strong>dans une base de test</strong>, on chronomètre, on documente.'),
])

PAGES = [
    ('pra-pca', 'PRA, PCA : continuité et reprise d’activité',
     'PCA / PRA / PCI / PRI, RTO et RPO, le BIA, les moyens du moins cher au plus cher (3-2-1 hors ligne, instantanés, réplication, redondance, cluster), le plan écrit, les tests.',
     PRA, SG,
     'PCA, PRA, PCI, PRI ; RTO / RPO ; du BIA au plan ; les moyens et ce qu’ils couvrent ; le plan sur papier ; tester.'),
    ('sauvegarde-vm-hyperv', 'Sauvegarder des machines virtuelles',
     'Checkpoint, export, sauvegarde cohérente (VSS, agent invité), réplication ; Windows Server Backup, PowerShell Hyper-V, vzdump et Proxmox Backup Server ; test de restauration.',
     VM, SG,
     'Checkpoint ≠ sauvegarde, cohérence VSS, WSB et PowerShell Hyper-V, réplica, vzdump / PBS, le test trimestriel.'),
    ('sauvegarde-linux', 'Sauvegarder un serveur Linux',
     'Quoi sauvegarder, tar / rsync --link-dest / restic, script complet avec timer systemd, instantanés LVM, vérification et reconstruction.',
     LINUX, SG,
     'Quoi sauvegarder, rsync avec versions, restic chiffré et dédupliqué, script + timer systemd, LVM snapshot, tests.'),
    ('sauvegarde-bases-donnees', 'Sauvegarder une base de données',
     'Dump, sauvegarde physique, journaux de transactions et restauration à un instant précis : MariaDB / MySQL, PostgreSQL, SQL Server ; la base dans une VM ; restaurer et prouver.',
     BDD, SG,
     'Dump / physique / journaux ; MariaDB, PostgreSQL, SQL Server (FULL, DIFF, LOG, STOPAT) ; RPO court ; restaurer en test.'),
]

LOTS = [(PAGES, MAINT)]

if __name__ == '__main__':
    for pages, cat in LOTS:
        publier_lot(pages, cat)
    sys.exit(0)

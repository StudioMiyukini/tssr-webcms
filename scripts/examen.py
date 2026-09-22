# -*- coding: utf-8 -*-
"""
Chantier P1 du comparatif REAC 2026 : le titre et ses épreuves.

Le site préparait les manipulations, pas l'épreuve : aucune page ne décrivait
la session 2026 (7 h, trois phases, incident devant le jury), ni la façon de
présenter sa production, ni le dossier professionnel, ni la veille et le compte
rendu que le REAC attend. Six pages dans une catégorie neuve « Le titre TSSR »,
et la section « épreuves » de `anglais-professionnel` réécrite selon le RE V03.

Sources : RE TP-01351 V03 (JO 19/06/2026), REAC millésime 03 (22/06/2026).

IDEMPOTENT.
"""
import re
import sqlite3
import sys

from _cours import (BASE, Categorie, STYLE, acc, bullets, cmd, hero, note, publier_lot, retenir, steps, tab)

CAT = Categorie('cat-titre', '🎓', 'Le titre TSSR',
                'Le référentiel 2026, la session d’examen, l’oral, l’incident devant le jury, la veille et le compte rendu.',
                '#be123c')

# ═══════════════════════════════════════════════════ L'examen TSSR 2026 ══

EXAMEN = '\n'.join([
    hero('Le titre · Épreuves', 'L’examen TSSR 2026',
         'La session complète en sept heures — trois phases de mise en situation, questionnaire, '
         'entretiens — ce que le jury regarde, le plateau technique, et les sessions par CCP.'),
    STYLE,
    '<p>Le titre professionnel Technicien supérieur systèmes et réseaux (TP-01351, niveau 5, '
    '<strong>RNCP 42463</strong>) a un nouveau référentiel depuis le <strong>1<sup>er</sup> septembre '
    '2026</strong> : millésime 03, arrêté du 19 juin 2026, valable jusqu’au 31 août 2031. Ce qui suit '
    'décrit l’épreuve <em>telle que le référentiel d’évaluation (RE) la fixe</em> — ton centre '
    'applique ces modalités, pas d’autres.</p>',
    note('yellow', '⚠️ Si tu as commencé avant septembre 2026',
         'Les candidats entrés en formation sous l’ancien référentiel (millésime 02, RNCP 37682, deux '
         'CCP) peuvent être évalués selon lui pendant une période de transition. Ton centre te dit '
         'sous quel millésime tu passes. Cette page décrit le nouveau.'),

    '<h2>1) La session complète : 7 h 00</h2>',
    tab(['Modalité', 'Durée', 'Ce qui se passe'], [
        ['<strong>Mise en situation professionnelle</strong>', '<strong>4 h 45</strong>', 'Trois phases (détail ci-dessous) : manipulations, présentation orale, incident réseau devant le jury'],
        ['<strong>Questionnaire professionnel</strong>', '<strong>1 h 30</strong>', 'Questions ouvertes, sur poste, salle sans Internet, sous surveillance. <strong>Au moins une question en anglais</strong> (compréhension d’une documentation ou question technique)'],
        ['<strong>Entretien technique</strong>', '<strong>30 min</strong>', 'Après la mise en situation et le questionnaire : le jury te questionne sur les compétences <em>à partir de tes réponses au questionnaire</em>'],
        ['<strong>Entretien final</strong>', '<strong>15 min</strong>', 'Le jury a tout ton dossier, dont le dossier professionnel : vision globale du métier, culture professionnelle, échange sur ton parcours'],
    ]),
    '<p>Le jury est présent 1 h 45 en tout : phases 2 et 3 de la mise en situation, entretien '
    'technique, entretien final. Il n’est pas là pendant tes manipulations ni pendant le '
    'questionnaire — il lit ta production et tes réponses.</p>',

    '<h2>2) La mise en situation en trois phases</h2>',
    '<h3>Phase 1 — Les manipulations : 3 h 30</h3>',
    bullets('Sur un poste avec accès à un hyperviseur (local ou distant) qui héberge jusqu’à <strong>quatre VM : un serveur Windows, un serveur Linux, un pare-feu, un client Windows</strong>.',
            'Un <strong>accès Internet contrôlé</strong> ; téléphone interdit.',
            'Des consignes pour <strong>tracer</strong> tes interventions : captures d’écran, insérées dans un fichier — c’est ce fichier qui servira de support à ta présentation.',
            'Les compétences évaluées : IA (exploiter et encadrer), déploiement des équipements et outils collaboratifs, assistance technique, réseau IP, serveurs Windows et Linux, infrastructure virtualisée, scripts optimisés avec l’IA.',
            'Un <strong>dispositif de dépôt sécurisé</strong> pour rendre ta production à la fin : ce qui n’est pas déposé n’existe pas.'),
    note('blue', '💡 Le fichier de production, dès la première minute',
         'Ouvre-le avant la première manipulation. Une capture par étape réussie, avec une ligne : ce que '
         'tu as fait, pourquoi, le résultat. En phase 2 tu n’auras plus accès aux VM — seul ce fichier '
         'restera. Méthode complète : <a href="/pages/presenter-sa-production">Présenter sa production</a>.'),
    '<h3>Phase 2 — La présentation orale : 15 min de préparation + 30 min</h3>',
    bullets('15 minutes dans un local isolé, sous surveillance, sur un poste <strong>sans Internet</strong> et <strong>sans accès aux VM</strong>, pour préparer ton oral à partir de ta production.',
            '30 minutes devant le jury, sur un poste avec logiciel de présentation : tu présentes tes démarches et tes résultats, puis tu réponds aux questions.',
            'Ce qui est jugé : la démarche (pas seulement le résultat), la traçabilité, l’explication claire, la capacité à dire ce qui n’a pas marché et pourquoi.'),
    '<h3>Phase 3 — L’incident réseau devant le jury : 30 min</h3>',
    bullets('Le jury <strong>joue le rôle d’un client ou d’un responsable</strong> : il te soumet une demande de résolution d’incident réseau et t’observe.',
            'Le plateau : un poste avec une VM <strong>serveur Linux</strong>, un poste avec une VM <strong>client Windows</strong> disposant d’un accès filaire <em>et</em> sans fil, un <strong>routeur et un commutateur de niveau 2 gérant des VLAN</strong>, un <strong>point d’accès Wi-Fi</strong>, Internet disponible.',
            'Ce qui est jugé : « le diagnostic respecte une démarche structurée selon les couches réseau », la communication avec le « client », la sécurité opérationnelle, la trace laissée.',
            'Entraînement : <a href="/pages/incident-devant-le-jury">L’incident réseau devant le jury</a>.'),

    '<h2>3) Ce que le jury évalue — les critères</h2>',
    '<p>Le RE liste des critères par compétence. Ils sont publics : autant les connaître, ils disent '
    'ce que le jury coche.</p>',
    acc(
        ('Support (CCP 1)',
         bullets('Les résultats proposés par l’IA sont <strong>vérifiés, validés, corrigés</strong> ; les règles internes de sécurité, de conformité et d’éthique sont respectées.',
                 'Les équipements sont configurés et déployés selon les standards ; ils répondent aux besoins des <strong>personnes en situation de handicap</strong> ; les mises à jour sont faites et vérifiées avant remise ; les outils collaboratifs sont paramétrés selon les standards.',
                 'Les demandes sont qualifiées et traitées <strong>dans les délais du contrat de service</strong> ; les incidents diagnostiqués et résolus selon les procédures ; les <strong>tickets mis à jour</strong>, la traçabilité assurée ; les incidents récurrents documentés et partagés.')),
        ('Exploiter (CCP 2)',
         bullets('Réseau : diagnostic <strong>structuré selon les couches</strong> ; modifications conformes à la demande ; réseau opérationnel selon le contrat de service ; <strong>documents d’exploitation mis à jour</strong>.',
                 'Serveurs Windows et Linux : conformes au cahier des charges ; droits attribués / modifiés / supprimés conformément ; rôles opérationnels ; incidents résolus ; bonnes pratiques de sécurité.',
                 'Virtualisation : outils d’administration utilisés selon les procédures et règles de sécurité ; interventions conformes à la demande.',
                 'Accès et sécurité hybride : <strong>moindre privilège</strong> ; comptes utilisateurs et administrateurs gérés selon les bonnes pratiques ; accès fonctionnels ; politiques de sécurité appliquées.')),
        ('Maintenir en conditions opérationnelles (CCP 3)',
         bullets('Scripts : testés et fonctionnels sur Windows <em>et</em> Linux ; <strong>prompts conformes aux règles de sécurité et contextualisés</strong> ; scripts documentés.',
                 'Continuité : sauvegardes fonctionnelles et conformes au PRI / PCI ; suivi des espaces de sauvegarde ; <strong>tests de restauration et de continuité effectués</strong>.',
                 'Mises à jour et supervision : installées <strong>sans interruption non planifiée</strong> ; correctifs conformes aux préconisations ; indicateurs conformes au cahier des charges ; incidents de supervision analysés et remontés.')),
        ('Les trois compétences transversales',
         '<p><strong>Communiquer</strong>, <strong>mettre en œuvre une démarche de résolution de problème</strong>, '
         '<strong>apprendre en continu</strong>. Elles ne font pas l’objet d’une épreuve séparée : le jury '
         'les voit dans ta présentation, dans l’incident, dans les entretiens. La veille — '
         '<a href="/pages/organiser-sa-veille">Organiser sa veille</a> — est la preuve la plus simple '
         'de la troisième.</p>'),
    ),

    '<h2>4) Le dossier professionnel</h2>',
    '<p>Le dossier professionnel (DP) est le document que <em>tu</em> rédiges avant la session : pour '
    'chaque activité type, des exemples de situations que tu as vécues (en formation, en stage, en '
    'emploi), ce que tu as fait, avec quoi, ce que tu en as tiré. Le jury le lit avant l’entretien '
    'final et s’en sert pour te questionner.</p>',
    bullets('Un exemple <strong>concret et daté</strong> par activité type (support, exploiter, MCO), avec le contexte, la demande, ta démarche, le résultat, ce que tu ferais autrement.',
            'Des situations que tu peux <strong>défendre</strong> : le jury demandera « et si le serveur n’avait pas redémarré ? ». Le stage vaut mieux qu’un TP inventé.',
            'Le vocabulaire du référentiel (ticket, contrat de service, moindre privilège, PRA…) — sans jargon creux.',
            'Le modèle officiel est fourni par le centre ; l’orthographe compte.'),

    '<h2>5) Les sessions par CCP</h2>',
    '<p>Le titre s’obtient aussi par <strong>capitalisation</strong> : un CCP à la fois, en cinq ans. Chaque '
    'CCP a sa propre session, plus courte :</p>',
    tab(['CCP', 'Mise en situation', 'Questionnaire', 'Entretien technique', 'Total'], [
        ['1 · Assurer le support aux utilisateurs', '2 h 15 (manip. 1 h + prép. 15 min + oral 30 min + incident 30 min)', '30 min', '30 min', '<strong>3 h 15</strong>'],
        ['2 · Exploiter les éléments de l’infrastructure', '2 h 15 (idem, incident <em>réseau</em>)', '45 min', '30 min', '<strong>3 h 30</strong>'],
        ['3 · Maintenir en conditions opérationnelles', '1 h 45 (manip. 1 h + prép. 15 min + oral 30 min — <em>pas d’incident</em>)', '45 min', '30 min', '<strong>3 h 00</strong>'],
    ]),
    '<p>Un candidat qui a validé tous les CCP passe ensuite un entretien avec le jury, en fin de session '
    'du dernier CCP, au vu de son livret de certification.</p>',

    '<h2>6) Le jour J : pratique</h2>',
    steps('Pièce d’identité, convocation ; téléphone éteint et rangé — il est interdit à chaque phase.',
          'Le fichier de production ouvert dès le début ; captures nommées et datées ; sauvegarde régulière et dépôt à la fin.',
          'Lire <strong>tout</strong> le sujet avant de toucher une VM ; repérer les dépendances (un DNS avant un domaine, un VLAN avant une règle).',
          'Une manipulation qui bloque plus de 20 minutes : la contourner ou la documenter (« non abouti, hypothèse : … »), et passer. Une production partielle expliquée vaut mieux qu’une production vide.',
          'Phase 2 : 15 minutes = choisir 6 à 8 captures, écrire un plan, chronométrer ; ne pas réécrire.',
          'Phase 3 : parler au « client » avant de toucher au réseau ; voir la méthode dédiée.',
          'Questionnaire : répondre à tout, en phrases courtes ; la question en anglais se répond en français sauf consigne contraire.'),

    retenir('Session complète <strong>7 h</strong> : mise en situation 4 h 45 (3 h 30 + 15 min + 30 min + 30 min), questionnaire 1 h 30, entretien technique 30 min, entretien final 15 min.',
            'Phase 1 = <strong>quatre VM</strong> (Windows Server, Linux, pare-feu, client) et un <strong>fichier de production</strong> avec captures ; phase 2 = <strong>oral sans accès aux VM</strong> ; phase 3 = <strong>incident réseau</strong> devant un jury qui joue le client.',
            'Au moins <strong>une question en anglais</strong> au questionnaire ; l’entretien technique part de tes réponses.',
            'Les <strong>critères</strong> sont publics : traçabilité, démarche par couches, moindre privilège, tests de restauration, prompts contextualisés.',
            'Par CCP : 3 h 15 / 3 h 30 / 3 h 00. Le dossier professionnel se prépare avant.'),
    note('green', '🔗 Les pages du titre',
         '<a href="/pages/parcours-reac">Le parcours de formation selon le REAC</a> · '
         '<a href="/pages/presenter-sa-production">Présenter sa production</a> · '
         '<a href="/pages/incident-devant-le-jury">L’incident réseau devant le jury</a> · '
         '<a href="/pages/organiser-sa-veille">Organiser sa veille</a> · '
         '<a href="/pages/compte-rendu-intervention">Le compte rendu d’intervention</a> · '
         '<a href="/pages/anglais-professionnel">L’anglais professionnel</a>.'),
])

# ═══════════════════════════════════════════════════ Le parcours REAC ══

def _cp(num, titre, pages):
    liens = ' · '.join(f'<a href="/pages/{s}">{t}</a>' for s, t in pages)
    return [f'<strong>CP{num}</strong> — {titre}', liens]


PARCOURS = '\n'.join([
    hero('Le titre · Référentiel', 'Le parcours de formation selon le REAC 2026',
         'Trois activités types, dix compétences, trois compétences transversales — et, pour chacune, '
         'les cours du site qui la préparent. La carte pour savoir où tu en es.'),
    STYLE,
    '<p>Le référentiel emploi activités compétences (REAC) décrit le métier tel que la certification '
    'l’entend. Il est organisé en <strong>activités types</strong> (AT, qui deviennent les CCP à '
    'l’examen) et <strong>compétences professionnelles</strong> (CP). Cette page le traduit en '
    'parcours sur le site.</p>',

    '<h2>1) Le métier en une page</h2>',
    '<p>Le TSSR « assure le support aux utilisateurs, exploite les éléments de l’infrastructure et les '
    'maintient en conditions opérationnelles ». Il travaille dans une DSI, chez un prestataire '
    '(infogérance, ESN) ou dans une petite structure où il est seul ; il intervient sur site, à '
    'distance, et parfois en datacenter. Le référentiel 2026 ajoute trois marqueurs forts : '
    '<strong>l’intelligence artificielle</strong> comme outil quotidien à encadrer, '
    '<strong>l’environnement hybride</strong> (AD local + Entra ID, serveurs locaux + cloud), et la '
    '<strong>continuité d’activité</strong> (PRA / PCA) comme responsabilité du technicien.</p>',

    '<h2>2) AT1 — Assurer le support aux utilisateurs</h2>',
    tab(['Compétence', 'Cours du site'], [
        _cp(1, 'Exploiter l’intelligence artificielle et encadrer son usage',
            [('ia-technicien', 'L’IA au service du technicien'), ('ia-encadrer', 'Encadrer l’IA')]),
        _cp(2, 'Assurer le déploiement des équipements numériques et accompagner à l’utilisation des outils collaboratifs',
            [('deployer-image-windows', 'Déployer une image Windows'), ('microsoft-365-teams', 'Microsoft 365 et Teams'),
             ('accessibilite-windows', 'Accessibilité'), ('maintenance-materielle-niveau-1', 'Maintenance matérielle'),
             ('gestion-ordinateur-windows', 'La gestion de l’ordinateur')]),
        _cp(3, 'Apporter une assistance technique',
            [('le-ticketing', 'Le ticketing'), ('itil-support', 'ITIL pour le support'), ('depannage', 'Le dépannage'),
             ('prise-en-main-distance', 'La prise en main à distance'), ('sensibiliser-utilisateurs', 'Sensibiliser les utilisateurs'),
             ('compte-rendu-intervention', 'Le compte rendu d’intervention')]),
    ]),

    '<h2>3) AT2 — Exploiter les éléments de l’infrastructure</h2>',
    tab(['Compétence', 'Cours du site'], [
        _cp(4, 'Exploiter un réseau IP',
            [('bases-du-reseau', 'Les bases du réseau'), ('adresses-ip', 'Les adresses IP'), ('segmentation-sous-reseaux', 'Le subnetting'),
             ('vlan-securite', 'Les VLAN'), ('le-pare-feu', 'Le pare-feu'), ('diagnostic-reseau', 'Diagnostic réseau'),
             ('wifi-entreprise', 'Wi-Fi d’entreprise'), ('ospf', 'OSPF'), ('reseau-entreprise', 'Concevoir le réseau d’une entreprise')]),
        _cp(5, 'Installer et assurer l’exploitation de serveurs Windows et Linux',
            [('windows-server', 'Windows Server'), ('roles-windows-server', 'Les rôles'), ('administration-domaine-ad', 'Administrer un domaine AD'),
             ('linux-bases', 'Linux : les bases'), ('linux-systemd', 'systemd'), ('linux-samba', 'Samba'), ('entra-id', 'Entra ID')]),
        _cp(6, 'Exploiter des serveurs dans une infrastructure virtualisée',
            [('virtualisation-theorie', 'La virtualisation : théorie'), ('virtualisation', 'Hyper-V'), ('proxmox-multi-hotes', 'Proxmox'),
             ('docker-30-minutes', 'Docker'), ('cloud-premiers-pas', 'Le cloud'), ('datacenter', 'Le datacenter')]),
        _cp(7, 'Gérer les accès et la sécurité dans un environnement hybride',
            [('zero-trust-iam', 'Zero trust, PSSI, IAM'), ('mfa-acces-conditionnel', 'MFA et accès conditionnel'),
             ('cycle-vie-compte', 'Le cycle de vie d’un compte'), ('pki-adcs', 'PKI et AD CS'), ('radius-8021x', 'RADIUS et 802.1X'),
             ('le-vpn', 'Le VPN'), ('procedure-securite-poste', 'Sécuriser un poste')]),
    ]),

    '<h2>4) AT3 — Maintenir en conditions opérationnelles l’infrastructure</h2>',
    tab(['Compétence', 'Cours du site'], [
        _cp(8, 'Optimiser des scripts à l’aide de l’intelligence artificielle',
            [('linux-bash', 'Scripts Bash'), ('scripts-powershell', 'Scripts PowerShell'), ('ia-scripts', 'Optimiser un script avec l’IA'),
             ('planificateur-taches-windows', 'Le Planificateur de tâches'), ('linux-cron-logs', 'cron et journaux')]),
        _cp(9, 'Assurer la continuité et la reprise de l’infrastructure',
            [('pra-pca', 'PRA / PCA'), ('procedure-sauvegarde', 'Sauvegarde et restauration'), ('sauvegarde-vm-hyperv', 'Sauvegarder des VM'),
             ('sauvegarde-linux', 'Sauvegarde Linux'), ('sauvegarde-bases-donnees', 'Sauvegarder une base de données'),
             ('procedure-sauvegarde-ad', 'Sauvegarde d’Active Directory')]),
        _cp(10, 'Mettre à jour et superviser les éléments de l’infrastructure',
            [('gerer-mises-a-jour', 'Gérer les mises à jour'), ('gestion-vulnerabilites', 'Gestion des vulnérabilités'),
             ('supervision', 'La supervision'), ('installer-zabbix', 'Installer Zabbix'), ('dmz-surveillance-entretien', 'Surveiller et entretenir une DMZ')]),
    ]),

    '<h2>5) Les compétences transversales</h2>',
    tab(['Compétence', 'Où on la voit', 'Cours'], [
        ['<strong>Communiquer</strong>', 'La présentation orale, le dialogue avec le « client » de l’incident, les tickets, les comptes rendus, l’anglais', '<a href="/pages/presenter-sa-production">Présenter sa production</a> · <a href="/pages/compte-rendu-intervention">Le compte rendu</a> · <a href="/pages/anglais-professionnel">L’anglais professionnel</a>'],
        ['<strong>Mettre en œuvre une démarche de résolution de problème</strong>', 'Le diagnostic par couches, les hypothèses classées, le test avant l’action', '<a href="/pages/depannage">Le dépannage</a> · <a href="/pages/diagnostic-reseau">Diagnostic réseau</a> · <a href="/pages/incident-devant-le-jury">L’incident devant le jury</a>'],
        ['<strong>Apprendre en continu</strong>', 'La veille, les sources, la documentation lue avant d’agir', '<a href="/pages/organiser-sa-veille">Organiser sa veille</a>'],
    ]),

    '<h2>6) S’auto-évaluer</h2>',
    '<p>Pour chaque compétence, trois questions. Si une réponse est « non », le cours correspondant '
    'est la prochaine étape.</p>',
    bullets('<strong>Je sais l’expliquer</strong> à un utilisateur non technique, en trois phrases.',
            '<strong>Je l’ai fait</strong> au moins une fois sur une VM, avec des captures.',
            '<strong>Je sais ce qui casse</strong> : deux pannes classiques et comment je les diagnostique.'),
    '<p>Les <a href="/pages/exercices">quiz et jeux</a> du site suivent le même découpage par domaine.</p>',

    retenir('3 activités types = 3 CCP ; 10 compétences ; 3 transversales évaluées à travers les autres.',
            '2026 ajoute : <strong>IA</strong> (CP1, CP8), <strong>hybride</strong> (CP5, CP7), <strong>continuité</strong> (CP9), <strong>déploiement et accessibilité</strong> (CP2).',
            'Chaque compétence a ses cours sur le site ; l’auto-évaluation tient en trois questions.',
            'Le référentiel complet : REAC TP-01351 millésime 03, disponible sur la banque de données de l’Afpa et sur francecompetences.fr (RNCP 42463).'),
])

# ══════════════════════════════════════════ Présenter sa production ══

PRESENTER = '\n'.join([
    hero('Le titre · Méthode', 'Présenter sa production',
         'Trente minutes devant le jury, sans accès aux machines, avec pour seul support le fichier '
         'de captures constitué pendant les manipulations. Comment le construire, puis comment le '
         'présenter.'),
    STYLE,
    '<p>C’est la nouveauté qui déstabilise le plus : pendant 3 h 30 tu manipules, puis on te coupe '
    'l’accès aux VM, tu as 15 minutes seul, et tu dois <strong>raconter ce que tu as fait</strong> à '
    'un jury pendant 30 minutes, questions comprises. Le jury n’a pas vu tes VM. Il ne verra que ce '
    'que tu montres.</p>',

    '<h2>1) Le fichier de production : le construire pendant, pas après</h2>',
    tab(['Quand', 'Quoi', 'Combien de temps'], [
        ['Minute 0', 'Ouvrir le fichier (traitement de texte ou diaporama, selon la consigne), le nommer, l’enregistrer, écrire le plan du sujet en titres', '3 min'],
        ['À chaque étape réussie', 'Une capture <strong>lisible</strong> + une ligne : « ce que j’ai fait — pourquoi — résultat »', '1 min par étape'],
        ['À chaque échec ou contournement', 'Une capture de l’erreur + « hypothèse — ce que j’ai tenté — état final »', '2 min'],
        ['Toutes les 30 min', 'Enregistrer ; vérifier que les captures sont dans l’ordre', '1 min'],
        ['15 dernières minutes', 'Une capture de <strong>preuve finale</strong> par livrable (le ping qui passe, le compte qui ouvre une session, le service en vert), dépôt', '15 min'],
    ]),
    note('red', '🚨 Ce qui ne se rattrape pas',
         'Une manipulation réussie sans capture n’existe pas pour le jury. Une capture illisible (fenêtre '
         'trop petite, texte gris sur gris) ne prouve rien. Une capture sans phrase ne se comprend '
         'plus quinze minutes après. Le réflexe « capture + ligne » coûte une minute et sauve la '
         'phase 2.'),
    '<h3>Une bonne capture</h3>',
    bullets('La fenêtre <strong>utile</strong> seulement (Alt + Impr. écran, ou l’outil Capture), pas le bureau entier.',
            'Le <strong>nom de la machine</strong> visible (invite, barre de titre, <code>hostname</code>) : le jury doit savoir sur quelle VM tu es.',
            'La <strong>commande et son résultat</strong> dans la même image ; un <code>cls</code> avant la commande importante.',
            'Un <strong>numéro</strong> et un titre : « 07 – DHCP : étendue créée ».',
            'Une par étape, pas dix : on montre le résultat, pas chaque clic.'),

    '<h2>2) Les 15 minutes de préparation</h2>',
    steps('<strong>Minute 0–3</strong> : relire le sujet mentalement : quels étaient les livrables demandés ? Cocher ce qui est fait, partiel, non fait.',
          '<strong>Minute 3–8</strong> : choisir <strong>6 à 8 captures</strong> — une par livrable — et les mettre dans l’ordre du sujet. Pas de nouvelle capture possible : on choisit, on ne crée pas.',
          '<strong>Minute 8–12</strong> : écrire le plan sur papier : contexte (1 phrase), démarche (l’ordre et pourquoi), résultats, ce qui n’a pas abouti et pourquoi, ce que tu ferais ensuite.',
          '<strong>Minute 12–15</strong> : répéter à voix basse l’introduction et la conclusion. Ce sont les deux minutes que le jury retient.'),

    '<h2>3) Les 30 minutes : structure</h2>',
    tab(['Temps', 'Partie', 'Contenu'], [
        ['1 min', '<strong>Contexte</strong>', '« Le sujet demandait X pour l’entreprise Y ; j’avais quatre machines : … »'],
        ['2 min', '<strong>Démarche</strong>', 'L’ordre choisi et sa raison (« le DNS avant le domaine, parce que… ») ; les vérifications faites avant d’agir'],
        ['8–10 min', '<strong>Résultats</strong>', 'Capture par capture : ce que c’est, ce que ça prouve. « Ici, le client obtient une adresse de l’étendue 192.168.10.0, passerelle .254 : le DHCP est opérationnel. »'],
        ['2 min', '<strong>Ce qui n’a pas abouti</strong>', 'Sans se justifier : le fait, l’hypothèse, ce que tu aurais fait avec plus de temps. Le jury préfère ça à un silence.'],
        ['1 min', '<strong>Conclusion</strong>', 'Les livrables obtenus / demandés ; la suite logique (documentation, sauvegarde, remise à l’utilisateur)'],
        ['10–15 min', '<strong>Questions</strong>', 'Voir ci-dessous'],
    ]),
    note('blue', '💡 Parler de démarche, pas de clics',
         '« J’ai cliqué sur Outils puis sur DHCP puis sur Nouvelle étendue » n’apprend rien au jury. '
         '« J’ai créé une étendue sur le sous-réseau des postes, exclu la plage des imprimantes et '
         'renseigné la passerelle et le DNS ; le client l’a obtenue au premier bail » montre que tu '
         'comprends ce que tu fais.'),

    '<h2>4) Les questions du jury</h2>',
    '<p>Elles portent sur ta production, pas sur le programme. Les familles qui reviennent :</p>',
    tab(['Type', 'Exemple', 'Comment répondre'], [
        ['Pourquoi', '« Pourquoi cette plage d’exclusion ? »', 'La raison technique, en une phrase ; « la consigne le demandait » est une réponse valable si c’est vrai'],
        ['Et si', '« Et si le DHCP tombe ? »', 'La conséquence, puis la parade (bail, failover, deuxième serveur)'],
        ['Vérification', '« Comment as-tu vérifié que ça marchait ? »', 'La commande ou le test — <code>ipconfig /all</code>, <code>ping</code>, l’ouverture de session'],
        ['Sécurité', '« Ce compte a-t-il besoin de ces droits ? »', 'Moindre privilège : dire ce que tu as donné et pourquoi ; reconnaître si c’est trop'],
        ['Ce qui a manqué', '« Tu n’as pas fait la partie 4 ? »', 'Le fait, l’hypothèse, sans excuse ni fiction'],
    ]),
    bullets('Une question dont tu ne connais pas la réponse : « je ne sais pas, je vérifierais dans la documentation de … » vaut mieux qu’une invention — le jury sait.',
            'Reformuler si la question n’est pas claire ; répondre à la question posée, pas à celle qu’on aurait préférée.',
            'Regarder les deux membres du jury, pas l’écran.'),

    '<h2>5) S’entraîner</h2>',
    steps('Prendre un TP du site — <a href="/pages/tp-ad-decouverte">TP AD découverte</a>, <a href="/pages/tp-opnsense-installation">TP OPNsense</a> — et le refaire <strong>avec le fichier de production ouvert</strong>, capture + ligne à chaque étape.',
          'Chronométrer : 1 h de manipulation, stop, 15 minutes de préparation sans revenir aux VM.',
          'Présenter à quelqu’un (un pair, un formateur, ou un enregistrement) pendant 15 minutes, puis répondre à trois questions « pourquoi / et si / comment vérifié ».',
          'Recommencer avec un sujet qui contient une partie impossible : s’entraîner à dire « non abouti ».'),
    '<p>Le cours <a href="/pages/tp1-presentation-cybercafe">TP1 – Présentation cybercafé</a> reste un bon '
    'exercice d’exposé ; la restitution d’une production en est la version technique et chronométrée.</p>',

    retenir('Le fichier de production se construit <strong>pendant</strong> : capture lisible + une ligne, à chaque étape et à chaque échec.',
            '15 minutes = <strong>choisir 6 à 8 captures</strong>, un plan sur papier, répéter l’intro et la conclusion.',
            '30 minutes : contexte, <strong>démarche</strong>, résultats capture par capture, ce qui n’a pas abouti, conclusion, questions.',
            'Parler de démarche et de vérification, pas de clics ; « je ne sais pas, je vérifierais » plutôt qu’inventer.',
            'S’entraîner en conditions : TP chronométré, coupure des VM, présentation à quelqu’un.'),
])

# ══════════════════════════════════════════ L'incident devant le jury ══

INCIDENT = '\n'.join([
    hero('Le titre · Méthode', 'L’incident réseau devant le jury',
         'Trente minutes, un « client » joué par le jury, un poste Windows, un serveur Linux, un '
         'routeur, un commutateur VLAN et un point d’accès. Une méthode par couches, à voix haute.'),
    STYLE,
    note('gray', '📚 Avant ce cours',
         '<a href="/pages/diagnostic-reseau">Diagnostic réseau (modèle OSI)</a> et '
         '<a href="/pages/depannage">Le dépannage</a> : la méthode est la même, ici on l’applique '
         'devant quelqu’un, en parlant.'),
    '<p>La phase 3 de la mise en situation évalue trois choses à la fois : ta <strong>démarche de '
    'diagnostic</strong> (« structurée selon les couches réseau », dit le RE), ta '
    '<strong>communication</strong> avec un utilisateur ou un responsable, et ta <strong>sécurité '
    'opérationnelle</strong> (ne rien casser, tracer). Le jury n’attend pas que tu résolves tout en '
    'silence ; il attend de te voir réfléchir.</p>',

    '<h2>1) Le plateau</h2>',
    tab(['Équipement', 'Ce qu’il permet comme incident'], [
        ['Poste avec VM <strong>client Windows</strong>, accès <strong>filaire et sans fil</strong>', 'IP fixe erronée, DHCP non reçu, DNS faux, passerelle absente, carte désactivée, pare-feu Windows, mauvais SSID'],
        ['Poste avec VM <strong>serveur Linux</strong>', 'Service arrêté (DHCP, DNS, web, SSH), mauvaise interface, pare-feu nftables/ufw, mauvaise adresse'],
        ['<strong>Routeur</strong>', 'Route manquante, interface down, mauvaise passerelle, NAT, ACL'],
        ['<strong>Commutateur niveau 2 avec VLAN</strong>', 'Port dans le mauvais VLAN, trunk sans le VLAN, port désactivé, VLAN natif'],
        ['<strong>Point d’accès Wi-Fi</strong>', 'Mauvais VLAN sur le SSID, mot de passe changé, isolation client, canal / bande'],
        ['Un accès Internet', 'Le test de bout en bout ; et la documentation, si tu la demandes'],
    ]),
    '<p>Les incidents sont « simples » techniquement : une seule cause, réparable en quelques minutes '
    'par quelqu’un qui cherche au bon endroit. Ce qui fait échouer, c’est de chercher partout à la fois.</p>',

    '<h2>2) Les cinq premières minutes : le client d’abord</h2>',
    steps('<strong>Se présenter</strong> et reformuler : « Vous me dites que le poste de la comptabilité n’accède plus au serveur depuis ce matin, c’est bien ça ? »',
          '<strong>Qualifier</strong> : depuis quand ? qu’est-ce qui a changé ? (déménagement, mise à jour, nouveau câble) ; un seul poste ou plusieurs ? filaire ou Wi-Fi ? quel est le symptôme exact (« plus d’Internet » ≠ « plus le partage ») ?',
          '<strong>Fixer le cadre</strong> : « Je vais vérifier du poste vers le serveur, couche par couche ; je vous dis ce que je fais au fur et à mesure ; je ne modifie rien sans vous prévenir. »',
          '<strong>Demander</strong> ce qui existe : un schéma, un plan d’adressage, un accès aux équipements. Le jury a peut-être un document ; il ne le donne que si on le demande.'),
    note('blue', '💡 Le jury note la communication dès la première phrase',
         'Vouvoiement, reformulation, pas de jargon avec le « client » (« la passerelle » se traduit par '
         '« la sortie du réseau »), et l’annonce de ce qu’on va faire. Un candidat qui se jette sur le '
         'clavier sans un mot perd des points avant d’avoir commencé.'),

    '<h2>3) La méthode par couches, à voix haute</h2>',
    tab(['Couche', 'Question', 'Vérification', 'Symptôme typique'], [
        ['1 · Physique', 'Le lien est-il là ?', 'Voyant de la carte, <code>Get-NetAdapter</code>, <code>ip link</code>, <code>show interfaces status</code> sur le commutateur ; en Wi-Fi : connecté au bon SSID ?', '« Câble réseau non connecté », port <em>notconnect</em>, carte désactivée'],
        ['2 · Liaison', 'Suis-je dans le bon VLAN ?', '<code>show vlan brief</code>, <code>show interfaces trunk</code>, <code>show mac address-table</code> ; SSID → VLAN sur le point d’accès', 'Adresse APIPA 169.254.x.x (DHCP inaccessible), poste dans un VLAN sans DHCP'],
        ['3 · Réseau', 'Ai-je une IP, un masque, une passerelle cohérents, et la passerelle répond-elle ?', '<code>ipconfig /all</code>, <code>ip a</code>, <code>ping passerelle</code>, <code>tracert</code>, <code>show ip route</code>, <code>show ip interface brief</code>', 'Masque faux, passerelle d’un autre sous-réseau, route absente sur le routeur, interface <em>administratively down</em>'],
        ['4 · Transport', 'Le port du service est-il ouvert et joignable ?', '<code>Test-NetConnection srv -Port 445</code>, <code>ss -tlnp</code> sur le serveur, <code>nft list ruleset</code> / <code>ufw status</code>, pare-feu Windows', 'Ping OK mais service KO : le service n’écoute pas ou un pare-feu bloque'],
        ['5–7 · Application', 'Le nom se résout-il ? Le service répond-il ?', '<code>nslookup srv</code>, <code>Resolve-DnsName</code>, <code>systemctl status</code>, <code>journalctl -u</code>, <code>curl -I</code>', 'DNS faux sur le client, service arrêté, mauvais fichier de configuration'],
    ]),
    '<p>On part <strong>du poste du client</strong> (c’est lui qui a le problème) et on remonte vers le '
    'serveur. À chaque couche, on <strong>dit</strong> ce qu’on teste, ce qu’on obtient, et ce qu’on en '
    'conclut : « La carte est connectée, mais l’adresse est en 169.254 : le poste ne reçoit pas de '
    'DHCP. Soit le serveur DHCP est arrêté, soit le poste n’est pas dans le bon VLAN. Je vérifie le '
    'port sur le commutateur. »</p>',

    '<h2>4) Cinq incidents plausibles, résolus en parlant</h2>',
    acc(
        ('« Le poste de la compta n’a plus rien depuis qu’on l’a changé de bureau »',
         '<p><strong>Indice</strong> : déménagement = autre prise = autre port. <strong>Couche 1–2</strong> : carte '
         'connectée, IP en 169.254. Sur le commutateur, <code>show interfaces status</code> : le port est '
         'dans le VLAN 1, la compta est en VLAN 20. <strong>Action annoncée</strong> : « Je vais affecter '
         'ce port au VLAN de la comptabilité, comme l’ancien ; ça n’impacte que cette prise. » '
         '<code>switchport access vlan 20</code>, <code>ipconfig /renew</code>, ping serveur, ouverture du partage. '
         '<strong>Trace</strong> : port, VLAN, date, dans le compte rendu.</p>'),
        ('« Le Wi-Fi marche, mais on n’atteint plus le serveur »',
         '<p><strong>Qualifier</strong> : Internet passe ? Oui. Le serveur, non. <strong>Couche 3</strong> : le poste '
         'Wi-Fi est en 192.168.50.x, le serveur en 192.168.10.x. Le SSID est raccordé au VLAN invités, '
         'pas au VLAN utilisateurs — ou le routeur n’a pas la route / bloque l’inter-VLAN. '
         '<code>tracert</code> s’arrête à la passerelle. <strong>Vérification</strong> sur le routeur : '
         '<code>show ip route</code>, ACL. <strong>Action</strong> : selon la politique — si les invités ne '
         'doivent pas voir le serveur, c’est normal : le poste doit être sur le bon SSID. On ne « répare » '
         'pas une règle de sécurité.</p>'),
        ('« Depuis la mise à jour du serveur, plus personne n’a d’adresse »',
         '<p><strong>Indice</strong> : mise à jour = service. Plusieurs postes en APIPA. Sur le serveur Linux : '
         '<code>systemctl status isc-dhcp-server</code> (ou kea) → <em>failed</em>. <code>journalctl -xeu …</code> : '
         'erreur de syntaxe dans la configuration, ou l’interface d’écoute a changé de nom après la MAJ. '
         '<strong>Action annoncée</strong> : corriger, <code>dhcpd -t</code> pour tester la configuration, '
         'redémarrer le service, <code>ipconfig /renew</code> sur un poste. <strong>Sécurité</strong> : la '
         'configuration d’origine sauvegardée avant modification.</p>'),
        ('« On a un ping vers le serveur, mais pas le site intranet »',
         '<p><strong>Couche 4–7</strong> : le réseau va bien. <code>Test-NetConnection srv -Port 80</code> échoue. '
         'Sur le serveur : <code>ss -tlnp | grep :80</code> — rien n’écoute : Apache est arrêté '
         '(<code>systemctl status apache2</code>), ou il écoute mais <code>nft list ruleset</code> bloque 80. '
         '<strong>Action</strong> : démarrer / autoriser, retester du poste, <code>curl -I</code>.</p>'),
        ('« Le nouveau poste n’ouvre pas de session sur le domaine »',
         '<p><strong>Couche 7</strong> : IP correcte, ping du DC OK, mais <code>nslookup domaine.local</code> '
         'échoue : le poste a un DNS public (8.8.8.8) au lieu du DC. Un domaine AD ne se trouve que par '
         'son DNS. <strong>Action</strong> : DNS du poste → le DC (ou corriger l’option DNS de l’étendue '
         'DHCP si plusieurs postes sont touchés), <code>ipconfig /flushdns</code>, session.</p>'),
    ),

    '<h2>5) Ce qui fait perdre des points</h2>',
    tab(['Comportement', 'Ce que le jury en déduit', 'À la place'], [
        ['Redémarrer tout d’abord', 'Pas de méthode', 'Redémarrer après diagnostic, jamais comme diagnostic'],
        ['Modifier une configuration sans prévenir', 'Danger en production', '« Je vais changer X, voici l’effet ; d’accord ? »'],
        ['Changer trois choses à la fois', 'Ne saura pas ce qui a corrigé', 'Une modification, un test'],
        ['Ne pas revenir en arrière après un essai infructueux', 'Laisse le réseau pire qu’avant', 'Annuler ce qui n’a pas aidé'],
        ['Rester muet', 'Communication non évaluable', 'Penser à voix haute, au client'],
        ['Accuser l’utilisateur ou le « collègue d’avant »', 'Posture', 'Les faits ; on cherche la cause, pas le coupable'],
        ['Ne rien noter', 'Pas de traçabilité', 'Cause, action, heure — sur papier — pour le compte rendu'],
    ]),

    '<h2>6) Finir : la clôture</h2>',
    steps('<strong>Vérifier avec le client</strong> : lui faire refaire l’action qui échouait. « Vous pouvez ouvrir le partage ? »',
          '<strong>Expliquer</strong> en langage simple : « Le poste était branché sur une prise qui n’était pas dans le bon réseau ; je l’ai corrigé. »',
          '<strong>Prévenir</strong> la récidive : « Il faudra affecter les prises du nouveau bureau au bon réseau, je le note pour l’équipe. »',
          '<strong>Tracer</strong> : ce qui a été trouvé, ce qui a été fait, ce qui reste à faire — le <a href="/pages/compte-rendu-intervention">compte rendu d’intervention</a> en trois lignes.'),
    '<p>Si l’incident n’est pas résolu à la fin des 30 minutes : dire où on en est, ce qui est écarté, '
    'l’hypothèse restante et la prochaine vérification. Un diagnostic honnête et structuré à 80 % '
    'vaut plus qu’une réparation au hasard.</p>',

    '<h2>7) S’entraîner à deux</h2>',
    bullets('Un pair prépare une panne sur un plateau (Packet Tracer suffit pour le réseau : <a href="/pages/atelier-reseau">Atelier Réseau</a> ; une VM Windows + une VM Debian pour les services) et joue le client, sans donner la cause.',
            'Le candidat a 30 minutes, doit parler tout du long, et n’a le droit qu’à une modification à la fois.',
            'Le « client » note : reformulation, annonce des actions, couches respectées, retour en arrière, clôture.',
            'On inverse. Dix pannes chacun, et la méthode devient un réflexe. Le jeu <a href="/pages/jeu-cisco-erreur">Cisco : trouve l’erreur</a> entraîne la lecture des configurations.'),

    retenir('Le jury évalue la <strong>démarche</strong>, la <strong>communication</strong> et la <strong>sécurité opérationnelle</strong>, pas seulement la réparation.',
            'Cinq premières minutes : se présenter, <strong>reformuler, qualifier</strong>, annoncer le cadre, demander la doc.',
            'Diagnostic <strong>du poste vers le serveur, couche par couche</strong>, à voix haute : ce que je teste, ce que j’obtiens, ce que j’en conclus.',
            'Une modification à la fois, annoncée ; retour en arrière si inutile ; jamais de redémarrage comme méthode.',
            'Clôture : le client vérifie, explication simple, prévention, trace.'),
])

# ══════════════════════════════════════════════════ Organiser sa veille ══

VEILLE = '\n'.join([
    hero('Le titre · Méthode', 'Organiser sa veille technologique',
         '« Apprendre en continu » est une compétence du titre. Des sources qui valent la peine, un '
         'rituel de vingt minutes, et une trace qu’on peut montrer au jury.'),
    STYLE,
    '<p>Un technicien qui ne fait pas de veille administre le SI d’il y a cinq ans. Le REAC 2026 en '
    'fait une compétence transversale (« apprendre en continu ») et un savoir-faire explicite '
    '(« assurer une veille technologique et réglementaire »). Le jury de l’entretien final demande '
    'régulièrement « comment vous tenez-vous au courant ? ». Cette page donne une réponse qu’on '
    'peut prouver.</p>',

    '<h2>1) Trois veilles, pas une</h2>',
    tab(['Veille', 'Question', 'Sources'], [
        ['<strong>Sécurité</strong>', 'Qu’est-ce qui est attaqué ou vulnérable cette semaine, et suis-je concerné ?', 'CERT-FR (alertes et avis), ANSSI, bulletins des éditeurs (Microsoft Patch Tuesday, Debian security), CISA KEV'],
        ['<strong>Technologique</strong>', 'Qu’est-ce qui change dans ce que j’administre ?', 'Blogs et notes de version des éditeurs (Windows Server, Proxmox, OPNsense, Debian), IT-Connect, Korben, LeMagIT, Reddit r/sysadmin, chaînes YouTube techniques'],
        ['<strong>Réglementaire</strong>', 'Qu’est-ce que la loi me demande ?', 'CNIL (RGPD, IA), ANSSI (NIS 2, guides), France Compétences (le titre lui-même), Légifrance pour les textes'],
    ]),
    note('yellow', '⚠️ Une source se juge sur trois critères',
         '<strong>Qui</strong> écrit (un éditeur, une agence, un praticien identifié, ou personne ?), '
         '<strong>quand</strong> (une page sans date n’est pas une source), et <strong>si elle cite ses '
         'sources</strong>. Un assistant IA est un point d’entrée, pas une source : il ne se cite pas '
         'dans une veille — voir <a href="/pages/ia-technicien">L’IA au service du technicien</a>.'),

    '<h2>2) L’outil : un agrégateur RSS</h2>',
    '<p>Aller sur vingt sites chaque matin ne tient pas trois semaines. Un lecteur de flux RSS '
    '(Feedly, Inoreader, NetNewsWire, FreshRSS auto-hébergé — un bon premier conteneur '
    '<a href="/pages/docker-30-minutes">Docker</a>) rassemble tout en une page :</p>',
    cmd('Sécurité       cert.ssi.gouv.fr/feed/       msrc.microsoft.com/update-guide/rss     debian.org/security/dsa\n'
        'Éditeurs       techcommunity.microsoft.com  forum.proxmox.com (annonces)             forum.opnsense.org (annonces)\n'
        'Généralistes   it-connect.fr/feed/           lemagit.fr/rss                         korben.info/feed\n'
        'Réglementaire  cnil.fr/fr/rss                cyber.gouv.fr/actualites/feed'),
    bullets('Des <strong>dossiers</strong> par veille ; on lit les titres, on ouvre trois articles, on archive le reste sans culpabilité.',
            'Une <strong>liste de lecture</strong> pour ce qui mérite plus de dix minutes (le week-end).',
            'Les newsletters hebdomadaires (une par domaine) pour ce qui n’a pas de flux.'),

    '<h2>3) Le rituel : 20 minutes, 3 fois par semaine</h2>',
    steps('<strong>5 min</strong> — Sécurité : les alertes CERT-FR de la semaine. Pour chacune : « suis-je concerné ? » (produit, version). Si oui → un ticket ou une note pour <a href="/pages/gerer-mises-a-jour">les mises à jour</a>.',
          '<strong>10 min</strong> — Technologique : les titres des éditeurs et généralistes ; deux articles lus ; une ligne dans le journal de veille.',
          '<strong>5 min</strong> — Le journal : date, source, ce que j’ai appris en une phrase, ce que ça change pour moi (rien / à tester / à appliquer).'),
    '<p>Le mardi soir pour le Patch Tuesday (deuxième mardi du mois), et une heure par mois pour un '
    'sujet de fond : un cours du site, une documentation, un laboratoire.</p>',

    '<h2>4) Le journal de veille : la preuve</h2>',
    '<p>Un fichier (Markdown, OneNote, un wiki, un dépôt Git) avec une entrée par découverte :</p>',
    cmd('## 2026-09-09 — CERT-FR — CERTFR-2026-AVI-0812 : vulnérabilités dans OPNsense < 26.7.3\n'
        'Concerné : oui (26.7.1 sur le pare-feu du labo). Action : MAJ planifiée jeudi 18h, sauvegarde config avant.\n'
        '\n'
        '## 2026-09-11 — Blog Proxmox — PVE 9.1 : sauvegarde incrémentale des VM vers PBS par défaut\n'
        'À tester sur le cluster de labo ; lien avec le cours PRA/PCA.\n'
        '\n'
        '## 2026-09-12 — CNIL — Recommandations sur les assistants IA au travail\n'
        'À citer dans la charte IA ; résumé de 5 lignes en annexe.'),
    bullets('C’est ce journal que tu montres (ou racontes) au jury : « je suis abonné à …, la semaine dernière j’ai vu …, ça m’a conduit à … ».',
            'Il alimente le <strong>dossier professionnel</strong> et prouve « apprendre en continu ».',
            'Trois mois de journal, c’est une culture ; trois ans, c’est une expertise.'),

    '<h2>5) Partager</h2>',
    bullets('Un message hebdomadaire à l’équipe (« les trois choses à savoir cette semaine ») : la veille devient utile aux autres, et visible.',
            'Une fiche dans la base de connaissances quand une lecture a résolu un problème.',
            'Un laboratoire : tester ce qu’on a lu (une VM, un conteneur), c’est la seule façon de retenir.'),

    '<h2>6) En anglais, forcément</h2>',
    '<p>La majorité des sources primaires (notes de version, bulletins, documentation) sont en anglais. '
    'Lire un bulletin de sécurité en anglais chaque semaine est l’entraînement le plus efficace pour '
    'la question en anglais du questionnaire : voir <a href="/pages/anglais-professionnel">L’anglais '
    'professionnel</a>.</p>',

    retenir('Trois veilles : <strong>sécurité</strong> (CERT-FR, éditeurs), <strong>technologique</strong> (notes de version, blogs), <strong>réglementaire</strong> (CNIL, ANSSI).',
            'Une source : un auteur, une date, des références. L’IA est un point d’entrée, pas une source.',
            'Un <strong>agrégateur RSS</strong>, 20 minutes trois fois par semaine, le Patch Tuesday, une heure de fond par mois.',
            'Un <strong>journal de veille</strong> daté : ce que j’ai appris, ce que ça change — la preuve pour le jury et le dossier professionnel.',
            'Partager et tester : la veille utile aux autres, vérifiée en laboratoire.'),
])

# ══════════════════════════════════════ Le compte rendu d'intervention ══

CR = '\n'.join([
    hero('Le titre · Méthode', 'Le compte rendu d’intervention',
         'Ce qu’on écrit après avoir réparé — pour l’utilisateur, pour le collègue de demain, pour '
         'le contrat de service. Un modèle, trois exemples, et ce qu’on ne met jamais.'),
    STYLE,
    '<p>« Les tickets sont mis à jour et la traçabilité des interventions est assurée » ; « les '
    'incidents récurrents sont documentés et partagés » ; « les documents d’exploitation sont mis à '
    'jour » : le RE 2026 revient trois fois sur l’écrit. Une intervention non écrite n’a pas eu lieu — '
    'et le technicien qui la refait dans six mois repart de zéro.</p>',

    '<h2>1) Trois lecteurs, trois écrits</h2>',
    tab(['Écrit', 'Lecteur', 'Longueur', 'Ton'], [
        ['<strong>Réponse dans le ticket</strong>', 'L’utilisateur', '3 à 5 lignes', 'Simple, sans jargon, orienté « c’est réglé / voilà quoi faire »'],
        ['<strong>Compte rendu technique</strong>', 'L’équipe, le responsable, toi dans six mois', '10 à 30 lignes', 'Précis : machines, commandes, cause, actions, preuve'],
        ['<strong>Fiche de base de connaissances</strong>', 'N’importe quel technicien face au même symptôme', 'Une page', 'Symptôme → cause → résolution, réutilisable'],
    ]),

    '<h2>2) Le modèle du compte rendu technique</h2>',
    cmd('Ticket        : #4521 — Poste COMPTA-03 sans accès au serveur de fichiers\n'
        'Date / durée  : 2026-09-14, 09:40 → 10:05 (25 min)\n'
        'Demandeur     : M. Durand (comptabilité) — impact : 1 poste, activité bloquée (facturation)\n'
        'Priorité      : haute (impact fort, urgence forte)\n'
        '\n'
        'SYMPTÔME\n'
        '  Depuis le déménagement du poste (bureau 214 → 218) ce matin : aucun accès réseau.\n'
        '  Adresse 169.254.32.7 (APIPA). Carte connectée. Internet KO, partage \\\\SRV-FIC01 KO.\n'
        '\n'
        'DIAGNOSTIC\n'
        '  1. Couche 1 : lien OK (voyant, Get-NetAdapter Up).\n'
        '  2. Couche 2 : sur SW-ETAGE2, port Gi1/0/18 (prise 218-A) en VLAN 1 ; VLAN compta = 20.\n'
        '     → le poste n’atteint pas le DHCP du VLAN 20. Cause identifiée.\n'
        '\n'
        'ACTIONS\n'
        '  - SW-ETAGE2 : interface Gi1/0/18 → switchport access vlan 20 (config sauvegardée, wr).\n'
        '  - Poste : ipconfig /renew → 192.168.20.57/24, passerelle .254, DNS .10.\n'
        '\n'
        'VÉRIFICATION\n'
        '  ping SRV-FIC01 OK ; ouverture de \\\\SRV-FIC01\\Compta OK par M. Durand ; Internet OK.\n'
        '\n'
        'RESTE À FAIRE / PRÉVENTION\n'
        '  - Les 4 prises du bureau 218 sont en VLAN 1 : à affecter au VLAN 20 avant les autres déménagements (ticket #4522).\n'
        '  - Plan de brassage de l’étage 2 à mettre à jour (fait : doc/brassage-etage2.xlsx, v12).\n'
        '\n'
        'Statut : résolu — clôture après confirmation utilisateur.'),
    tab(['Rubrique', 'Pourquoi elle est là'], [
        ['Symptôme <em>tel que constaté</em>', 'Pas « plus de réseau » mais l’adresse, les tests : quelqu’un d’autre reconnaîtra le même cas'],
        ['Diagnostic <em>dans l’ordre</em>', 'La démarche par couches est visible ; on sait ce qui a été écarté'],
        ['Actions <em>exactes</em>', 'Équipement, port, commande : réversible, auditable'],
        ['Vérification <em>par l’utilisateur</em>', 'Résolu = l’utilisateur a refait l’action, pas « ça devrait marcher »'],
        ['Reste à faire / prévention', 'C’est ce qui transforme un dépannage en amélioration continue — le RE le cite'],
    ]),

    '<h2>3) La réponse à l’utilisateur</h2>',
    cmd('Bonjour M. Durand,\n'
        '\n'
        'Votre poste est de nouveau connecté : la prise de votre nouveau bureau n’était pas raccordée au réseau\n'
        'de la comptabilité, c’est corrigé. Vous avez pu ouvrir le dossier Compta, je clôture la demande.\n'
        'Si le problème réapparaît, répondez à ce message ou appelez le 4242 en indiquant le numéro 4521.\n'
        '\n'
        'Bonne journée,\n'
        'Le support informatique'),
    bullets('Ce qui s’est passé, en une phrase compréhensible ; ce qui a été fait ; comment nous recontacter.',
            'Pas de reproche, pas de « comme je vous l’avais dit », pas d’acronyme.',
            'Le numéro de ticket : il sert à retrouver l’historique.'),

    '<h2>4) La fiche de base de connaissances</h2>',
    cmd('# Poste en APIPA (169.254.x.x) après déménagement\n'
        '**Symptôme** : carte connectée, adresse 169.254.x.x, aucun accès. Souvent après un changement de bureau ou de prise.\n'
        '**Cause fréquente** : port du commutateur dans un VLAN sans serveur DHCP (VLAN 1 par défaut).\n'
        '**Diagnostic** : `show interfaces status` sur le commutateur de l’étage → colonne VLAN ; comparer au plan (VLAN 20 compta, 30 RH…).\n'
        '**Résolution** : `interface GiX/0/Y` → `switchport access vlan <N>` → `wr` ; `ipconfig /renew` sur le poste.\n'
        '**Autres causes** : DHCP arrêté (plusieurs postes touchés), trunk sans le VLAN, port en err-disabled.\n'
        '**Voir** : plan de brassage par étage ; cours « Sécuriser les VLAN ».'),
    '<p>Une fiche par <strong>symptôme</strong>, pas par ticket : c’est le symptôme que le prochain '
    'technicien tapera dans la recherche. Elle se crée au deuxième ticket identique — c’est la '
    'définition d’un incident récurrent.</p>',

    '<h2>5) Ce qu’on n’écrit jamais</h2>',
    tab(['Jamais', 'Pourquoi', 'À la place'], [
        ['Un mot de passe, une clé', 'Le ticket est lu par beaucoup, archivé longtemps', '« identifiants transmis par le canal habituel »'],
        ['Un jugement sur l’utilisateur (« encore lui », « n’a rien compris »)', 'Le ticket peut lui être montré ; c’est une donnée personnelle (RGPD)', 'Les faits'],
        ['« Ça devrait marcher »', 'Ce n’est pas une vérification', 'Le test fait et son résultat'],
        ['Un roman', 'Personne ne le lira', 'Les rubriques, des phrases courtes'],
        ['Rien', 'Une intervention sans trace n’existe pas', 'Trois lignes valent mieux que zéro'],
    ]),

    '<h2>6) Les autres documents d’exploitation</h2>',
    '<p>Le compte rendu met à jour ce qui existe : le <strong>schéma réseau</strong>, le '
    '<strong>plan d’adressage</strong>, le <strong>plan de brassage</strong>, l’<strong>inventaire</strong>, la '
    '<strong>procédure</strong> si elle était fausse. Une intervention qui change un port sans toucher '
    'le plan de brassage crée le prochain incident. Voir '
    '<a href="/pages/reseau-entreprise">Concevoir et documenter le réseau</a>.</p>',

    retenir('Trois écrits : <strong>réponse à l’utilisateur</strong> (simple), <strong>compte rendu technique</strong> (précis), <strong>fiche de connaissances</strong> (réutilisable, par symptôme).',
            'Le compte rendu : symptôme constaté, diagnostic dans l’ordre, actions exactes, <strong>vérification par l’utilisateur</strong>, reste à faire.',
            'Jamais de mot de passe, jamais de jugement, jamais « ça devrait marcher ».',
            'Le compte rendu met à jour les documents d’exploitation ; la fiche naît au deuxième ticket identique.'),
])

# ══════════════════════════════ correctif : épreuves d'anglais 2026 ══

ANGLAIS_EPREUVES = '\n'.join([
    '<h2>🎓 Les épreuves TSSR</h2>',
    '<p>Depuis le référentiel 2026 (RE V03), l’anglais n’a plus d’épreuve à part : il est évalué '
    '<strong>dans le questionnaire professionnel</strong> (1 h 30 en session complète, 30 à 45 min par CCP). '
    '<strong>Au moins une question</strong> « porte sur la compréhension d’une documentation ou d’une question '
    'technique en anglais ». Il n’y a plus de présentation orale en anglais.</p>',
    '<h3>📝 Ce que ça donne concrètement</h3>',
    '<div class="pb-accordion">'
    '<details class="pb-acc"><summary>A — Lire une documentation et répondre</summary><div class="pb-acc-body"><p>Un extrait de '
    'documentation technique en anglais (notes de version, page d’aide d’un éditeur, bulletin de sécurité, '
    'fiche produit) et une ou plusieurs questions — en français ou en anglais — sur son contenu : que '
    'faut-il faire, quelle version est concernée, quelle est la condition.</p></div></details>'
    '<details class="pb-acc"><summary>B — Répondre à une question technique posée en anglais</summary><div class="pb-acc-body"><p>'
    'Une question du type « <em>What is the purpose of a DHCP relay agent?</em> » ou « <em>Explain the difference '
    'between a full and an incremental backup.</em> » Réponse en français sauf consigne contraire ; une réponse '
    'courte en anglais est un plus, pas une obligation.</p></div></details>'
    '<details class="pb-acc"><summary>C — Un message d’erreur ou un journal en anglais</summary><div class="pb-acc-body"><p>'
    'La forme la plus proche du métier : un message d’erreur, un extrait de journal, une sortie de commande — '
    'à interpréter.</p></div></details></div>',
    '<aside class="pb-note pb-note-yellow"><p class="pb-note-title">💡 Le plus rentable</p><p>La <strong>lecture</strong> '
    'de documentation technique et de messages d’erreur. Chaque semaine, un bulletin de sécurité ou une note '
    'de version en anglais — voir <a href="/pages/organiser-sa-veille">Organiser sa veille</a> — et c’est '
    'exactement l’exercice de l’examen.</p></aside>',
    '<h3>🗣️ Et à l’oral ?</h3>',
    '<p>La présentation orale de la mise en situation (30 min) se fait <strong>en français</strong> : c’est la '
    'restitution de ta production devant le jury — voir <a href="/pages/presenter-sa-production">Présenter sa '
    'production</a>. Le jury peut glisser une question en anglais dans l’entretien technique, mais ce n’est '
    'pas une épreuve d’oral en anglais. Le détail de la session : '
    '<a href="/pages/examen-tssr-2026">L’examen TSSR 2026</a>.</p>',
])


def corriger_anglais(c):
    ct = c.execute("SELECT content FROM pages WHERE slug='anglais-professionnel'").fetchone()[0]
    if 'examen-tssr-2026' in ct:
        return 'déjà corrigé'
    m = re.search(r'<h2>[^<]*Les épreuves TSSR</h2>.*?(?=<h2>)', ct, re.S)
    if not m:
        return 'section introuvable'
    ct = ct[:m.start()] + ANGLAIS_EPREUVES + '\n' + ct[m.end():]
    ct = ct.replace('une compétence à part entière du titre TSSR, évaluée à l’écrit et à l’oral.',
                    'une compétence à part entière du titre TSSR, évaluée par au moins une question du '
                    'questionnaire professionnel (référentiel 2026).')
    c.execute("UPDATE pages SET content=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug='anglais-professionnel'", (ct,))
    return 'section réécrite'


PAGES = [
    ('examen-tssr-2026', 'L’examen TSSR 2026',
     'La session complète (7 h) : mise en situation en trois phases, questionnaire avec question en anglais, entretiens ; critères du jury, dossier professionnel, sessions par CCP, plateau technique.',
     EXAMEN, 'L’épreuve',
     'Session complète 7 h, les trois phases, les critères, le dossier professionnel, les sessions par CCP, le jour J.'),
    ('parcours-reac', 'Le parcours de formation selon le REAC 2026',
     'Trois activités types, dix compétences, trois transversales, et pour chacune les cours du site : la carte pour savoir où tu en es.',
     PARCOURS, 'L’épreuve',
     'AT1 Support, AT2 Exploiter, AT3 MCO : chaque compétence et les cours qui la préparent ; auto-évaluation.'),
    ('presenter-sa-production', 'Présenter sa production',
     'Construire le fichier de captures pendant les manipulations, exploiter les 15 minutes de préparation, structurer 30 minutes d’oral, répondre au jury.',
     PRESENTER, 'Méthodes d’examen',
     'Le fichier de production (capture + une ligne), les 15 minutes, la structure des 30 minutes, les questions du jury.'),
    ('incident-devant-le-jury', 'L’incident réseau devant le jury',
     'Le plateau (client Windows, serveur Linux, routeur, commutateur VLAN, point d’accès), le client d’abord, le diagnostic par couches à voix haute, cinq incidents résolus, la clôture.',
     INCIDENT, 'Méthodes d’examen',
     'Le plateau, les cinq premières minutes avec le client, la méthode par couches à voix haute, cinq incidents, ce qui fait perdre des points.'),
    ('organiser-sa-veille', 'Organiser sa veille technologique',
     'Trois veilles (sécurité, technologique, réglementaire), les sources fiables, un agrégateur RSS, un rituel de 20 minutes, le journal de veille comme preuve.',
     VEILLE, 'Compétences transversales',
     'Sources fiables, agrégateur RSS, rituel de 20 minutes, journal de veille daté à montrer au jury.'),
    ('compte-rendu-intervention', 'Le compte rendu d’intervention',
     'Réponse à l’utilisateur, compte rendu technique (modèle complet), fiche de base de connaissances par symptôme, ce qu’on n’écrit jamais, documents d’exploitation.',
     CR, 'Compétences transversales',
     'Trois écrits pour trois lecteurs, le modèle de compte rendu technique, la fiche de connaissances, ce qu’on n’écrit jamais.'),
]

LOTS = [(PAGES, CAT)]

if __name__ == '__main__':
    for pages, cat in LOTS:
        publier_lot(pages, cat)
    c = sqlite3.connect(BASE)
    print('anglais-professionnel :', corriger_anglais(c).encode('ascii', 'replace').decode())
    c.commit()
    c.close()
    sys.exit(0)

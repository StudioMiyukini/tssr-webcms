# -*- coding: utf-8 -*-
"""
Chantier P2 du comparatif REAC 2026 : déployer les équipements et accompagner
(compétence 2), et les savoirs « environnement de travail » du REAC :
accessibilité, ergonomie et TMS, DEEE et sobriété.

Trois cours dans Software › « Déploiement & poste de travail », trois dans
Maintenance › « Environnement de travail & responsabilité ».

IDEMPOTENT.
"""
import sys

from _cours import (Categorie, STYLE, acc, bullets, cmd, hero, menu, note, publier_lot, retenir, steps, tab)

SOFT = Categorie('cat-software', '💿', 'Software', '', '#2563eb')
MAINT = Categorie('cat-maintenance', '🛠️', 'Maintenance', '', '#dc2626')
SG_DEPLOI = 'Déploiement &amp; poste de travail'
SG_ENV = 'Environnement de travail &amp; responsabilité'

# ═════════════════════════════════════════════ Déployer une image Windows ══

IMAGE = '\n'.join([
    hero('Cours · Déploiement', 'Déployer une image Windows',
         'Du poste installé à la main au parc déployé en masse : image de référence, Sysprep, WDS et '
         'MDT, Autopilot avec Intune — et la liste de contrôle avant de remettre le poste.'),
    STYLE,
    note('gray', '📚 Avant ce cours',
         '<a href="/pages/gestion-ordinateur-windows">La gestion de l’ordinateur</a>, '
         '<a href="/pages/windows-server">Windows Server</a> ; pour la VM de référence, '
         '<a href="/pages/virtualisation">Hyper-V</a>.'),
    '<p>Installer Windows à la main sur un poste prend deux heures ; sur quarante postes, c’est deux '
    'semaines et quarante configurations différentes. Le REAC 2026 demande que « les équipements '
    'numériques soient configurés et déployés <strong>conformément aux standards de '
    'l’organisation</strong> » et que « les mises à jour soient effectuées et vérifiées avant mise à '
    'disposition ». Un déploiement industrialisé, c’est ça : un standard, reproduit.</p>',

    '<h2>1) Le standard : ce que contient un poste « de l’organisation »</h2>',
    tab(['Élément', 'Exemple'], [
        ['Édition et version de Windows', 'Windows 11 Pro 24H2, langue, région, clavier'],
        ['Partitionnement et chiffrement', 'UEFI / GPT, BitLocker activé avec clé de récupération dans l’AD ou Entra'],
        ['Convention de nommage', '<code>PC-COMPTA-03</code>, <code>PORT-JDUPONT</code>'],
        ['Jonction', 'Domaine AD, ou Entra ID + Intune'],
        ['Applications de base', 'Suite bureautique, navigateur, PDF, agent de supervision / RMM, antivirus d’entreprise, VPN, outil de prise en main'],
        ['Configuration', 'Écran de veille, pare-feu, mises à jour, imprimantes, lecteurs réseau — par GPO ou profil Intune, pas dans l’image'],
        ['Comptes', 'Administrateur local avec LAPS ; aucun compte utilisateur local'],
        ['Suppression', 'Applications préinstallées inutiles (bloatware), jeux, essais'],
    ]),
    note('blue', '💡 Dans l’image ou après ?',
         'Dans l’image : ce qui est lourd et identique pour tous (Windows, Office, l’agent). Après, par '
         'GPO / Intune / script : tout ce qui change (imprimantes, lecteurs, logiciels métier d’un '
         'service). Une image « légère » se refait en une heure et vieillit moins vite.'),

    '<h2>2) Les quatre méthodes</h2>',
    tab(['Méthode', 'Principe', 'Pour', 'Effort'], [
        ['<strong>Clé USB + fichier de réponses</strong>', 'ISO Windows, <code>autounattend.xml</code> qui répond aux questions de l’installation, script de post-installation', '1 à 10 postes, sans serveur', 'Faible'],
        ['<strong>Image de référence + Sysprep</strong> (WIM)', 'On installe et configure une VM modèle, on la généralise, on capture le disque en <code>.wim</code>, on l’applique aux postes', '10 à 200 postes, image maîtrisée', 'Moyen'],
        ['<strong>WDS + MDT</strong>', 'Démarrage réseau (PXE), WDS distribue l’image, MDT enchaîne les tâches (partition, image, pilotes, applications, jonction)', 'Le domaine classique', 'Moyen à élevé ; MDT n’évolue plus mais fonctionne'],
        ['<strong>Windows Autopilot + Intune</strong>', 'Le poste sort du carton, se connecte, s’enregistre dans le tenant et se configure tout seul (profils, applications)', 'Postes joints à Entra, télétravail, sans image', 'Faible par poste, élevé au départ (Intune)'],
    ]),

    '<h2>3) Image de référence et Sysprep</h2>',
    steps('Une <strong>VM</strong> (Hyper-V, génération 2) avec Windows installé depuis l’ISO en <strong>mode audit</strong> (Ctrl + Maj + F3 à l’écran de choix de région) : pas de compte utilisateur créé.',
          'Un <strong>point de contrôle</strong> « propre » avant toute personnalisation.',
          'Mises à jour Windows jusqu’à ce qu’il n’y en ait plus ; applications de base ; suppression du superflu (<code>Get-AppxProvisionedPackage -Online | Where DisplayName -like "*Xbox*" | Remove-AppxProvisionedPackage -Online</code>) ; réglages du profil par défaut si besoin.',
          '<strong>Sysprep</strong> : <code>C:\\Windows\\System32\\Sysprep\\sysprep.exe /generalize /oobe /shutdown</code> — supprime le SID, les pilotes spécifiques, l’activation ; le prochain démarrage repart à l’assistant de bienvenue (OOBE).',
          '<strong>Capturer</strong> : démarrer la VM sur WinPE (clé ou ISO) et <code>dism /Capture-Image /ImageFile:D:\\ref-w11-24h2.wim /CaptureDir:C:\\ /Name:"Ref W11 24H2"</code>.',
          '<strong>Revenir au point de contrôle</strong> : la VM de référence n’est jamais sysprepée deux fois (limite de réarmement) ; on la met à jour depuis le point de contrôle et on recapture chaque trimestre.'),
    note('red', '🚨 Sans Sysprep, tous les postes ont le même SID',
         'Cloner un disque sans généraliser donne des postes identiques jusqu’au SID de la machine : '
         'jonction au domaine capricieuse, WSUS qui ne voit qu’un poste, KMS qui compte un seul '
         'client. <code>/generalize</code> n’est pas optionnel.'),
    '<h3>Appliquer l’image à un poste</h3>',
    cmd('REM depuis WinPE, disque 0 en UEFI/GPT\n'
        'diskpart /s partition-uefi.txt\n'
        'dism /Apply-Image /ImageFile:D:\\ref-w11-24h2.wim /Index:1 /ApplyDir:W:\\\n'
        'bcdboot W:\\Windows /s S: /f UEFI\n'
        'REM au redémarrage : OOBE, ou autounattend.xml copié dans W:\\Windows\\Panther\\Unattend\\ pour tout automatiser'),
    '<p>Ce que MDT fait pour toi : les commandes ci-dessus, plus les pilotes par modèle, les applications, '
    'le nom du poste, la jonction au domaine — dans une <strong>séquence de tâches</strong> lancée par PXE.</p>',

    '<h2>4) WDS + MDT en bref</h2>',
    bullets('<strong>WDS</strong> (rôle Windows Server) : répond au démarrage PXE (le DHCP indique le serveur, options 66/67, ou IP helper sur les routeurs), envoie l’image de démarrage WinPE générée par MDT.',
            '<strong>MDT</strong> (Microsoft Deployment Toolkit) + ADK : le partage de déploiement (<code>\\\\srv-mdt\\DeploymentShare$</code>) contient les systèmes (WIM), les pilotes triés par modèle, les applications (installation silencieuse), les séquences de tâches.',
            'Le fichier <code>CustomSettings.ini</code> pré-remplit tout (domaine, compte de jonction, UO, fuseau, nom du poste depuis le numéro de série) : un déploiement « zéro contact » en 25 minutes.',
            'Le compte de jonction au domaine a le <strong>seul droit</strong> de joindre des ordinateurs dans une UO : jamais un administrateur du domaine dans un fichier INI.'),

    '<h2>5) Autopilot + Intune en bref</h2>',
    steps('Le fournisseur (ou toi, avec <code>Get-WindowsAutopilotInfo -Online</code>) enregistre le <strong>hash matériel</strong> du poste dans le tenant.',
          'Un <strong>profil Autopilot</strong> : jonction Entra (ou hybride), qui est administrateur local (personne), nom du poste (<code>PORT-%SERIAL%</code>), pages OOBE masquées.',
          'Des <strong>profils de configuration</strong> Intune (BitLocker, pare-feu, Wi-Fi, VPN, mises à jour) et des <strong>applications</strong> (Win32, Store, M365 Apps) affectés à un groupe dynamique « tous les Autopilot ».',
          'L’utilisateur allume, choisit le Wi-Fi, saisit son compte : la <strong>page d’état d’inscription</strong> montre l’avancement ; 30 à 60 minutes plus tard, le poste est prêt, sans que le technicien l’ait touché.',
          'Réinitialisation à distance (<strong>Autopilot Reset</strong>) pour réaffecter un poste sans réinstaller.'),
    note('yellow', '⚠️ Autopilot n’installe pas Windows',
         'Il configure le Windows livré par le constructeur (avec ses logiciels préinstallés). Pour un '
         'Windows propre, on passe par une image d’abord (MDT / clé), ou on commande des postes '
         '« image d’entreprise » chez le constructeur.'),

    '<h2>6) Avant de remettre le poste : la liste de contrôle</h2>',
    tab(['Vérifier', 'Comment'], [
        ['Nom, jonction, UO', '<code>hostname</code>, <code>dsregcmd /status</code> ou <code>Get-ComputerInfo | Select CsDomain</code>'],
        ['<strong>Mises à jour</strong> installées, aucune en attente', 'Paramètres › Windows Update — le RE le demande explicitement'],
        ['BitLocker actif, clé sauvegardée', '<code>manage-bde -status</code> ; la clé dans l’AD / Entra'],
        ['Antivirus, agent de supervision, VPN présents et à jour', 'Consoles respectives : le poste apparaît'],
        ['Applications du standard', 'Elles s’ouvrent ; Office activé'],
        ['Périphériques', 'Imprimante par défaut, écran(s), audio, webcam, station d’accueil'],
        ['Ouverture de session de l’utilisateur', 'Une fois, avec lui : profil créé, lecteurs mappés, messagerie configurée'],
        ['<strong>Besoins spécifiques</strong>', 'Accessibilité, ergonomie : voir <a href="/pages/accessibilite-windows">Accessibilité</a> et <a href="/pages/ergonomie-tms">Ergonomie</a>'],
        ['Inventaire et ticket', 'Le poste est dans l’inventaire (numéro de série, utilisateur, date) ; le ticket de déploiement est clos avec la liste cochée'],
    ]),

    retenir('Un poste déployé = le <strong>standard de l’organisation</strong>, reproduit : image légère + configuration par GPO / Intune.',
            'Quatre méthodes : clé + <code>autounattend.xml</code>, <strong>image de référence + Sysprep</strong>, <strong>WDS + MDT</strong> (PXE, séquence de tâches), <strong>Autopilot + Intune</strong> (sans image, cloud).',
            'Image de référence : VM en mode audit, point de contrôle, MAJ, Sysprep <code>/generalize</code>, capture DISM, recapture trimestrielle.',
            'Le compte de jonction n’a qu’un droit ; jamais d’admin du domaine dans un INI.',
            'Avant remise : <strong>liste de contrôle</strong> — MAJ, BitLocker, agents, applications, session avec l’utilisateur, besoins spécifiques, inventaire.'),
])

# ═══════════════════════════════════════════════ Microsoft 365 et Teams ══

M365 = '\n'.join([
    hero('Cours · Déploiement', 'Microsoft 365 et Teams : administrer les outils collaboratifs',
         'Ce qu’il y a dans un abonnement, le centre d’administration, licences et boîtes, Teams et '
         'SharePoint côté technicien, le partage externe, et les demandes de support qui reviennent.'),
    STYLE,
    note('gray', '📚 Avant ce cours',
         '<a href="/pages/entra-id">Entra ID</a> : les comptes de Microsoft 365 sont les comptes Entra.'),
    '<p>« Configurer et paramétrer les outils collaboratifs conformément aux standards de '
    'l’organisation » est un critère explicite du RE 2026. Dans la plupart des organisations, ces '
    'outils sont Microsoft 365 : messagerie, Teams, SharePoint, OneDrive. Le technicien n’en est pas '
    'l’architecte, mais il crée les boîtes, affecte les licences, crée les équipes, règle le partage '
    'et répond aux tickets.</p>',

    '<h2>1) Ce qu’il y a dans l’abonnement</h2>',
    tab(['Service', 'Rôle', 'Où ça vit'], [
        ['<strong>Exchange Online</strong>', 'Messagerie, calendriers, boîtes partagées, listes de distribution', 'Centre d’administration Exchange'],
        ['<strong>Teams</strong>', 'Conversations, réunions, équipes et canaux, téléphonie (option)', 'Centre d’administration Teams'],
        ['<strong>SharePoint Online</strong>', 'Sites, bibliothèques de documents ; chaque équipe Teams a un site SharePoint derrière', 'Centre d’administration SharePoint'],
        ['<strong>OneDrive</strong>', 'Les fichiers personnels de chacun (1 To), synchronisés sur le poste', 'Idem SharePoint'],
        ['<strong>Microsoft 365 Apps</strong>', 'Word, Excel, Outlook… installés, jusqu’à 5 appareils par utilisateur', 'Le poste'],
        ['<strong>Entra ID, Intune, Defender</strong>', 'Identité, gestion des appareils, sécurité — selon le plan', 'Leurs centres respectifs'],
    ]),
    tab(['Plan', 'Pour', 'Contient (en résumé)'], [
        ['Business Basic', 'Petite structure, web seulement', 'Exchange, Teams, SharePoint, OneDrive, Office web'],
        ['Business Standard', 'PME', '+ applications Office installées'],
        ['<strong>Business Premium</strong> (≤ 300 utilisateurs)', 'La PME qui veut la sécurité', '+ Intune, Entra ID P1, Defender for Business — le plan le plus courant en PME'],
        ['E3 / E5', 'Grandes organisations', 'Tout, avec conformité et sécurité avancées'],
        ['F3', 'Personnel de terrain sans bureau', 'Web et mobile, boîte réduite'],
    ]),

    '<h2>2) Le centre d’administration Microsoft 365</h2>',
    '<p><code>admin.microsoft.com</code> — le point d’entrée : utilisateurs, groupes, licences, facturation, '
    'état des services, et des liens vers les centres spécialisés. Les tâches du quotidien :</p>',
    tab(['Tâche', 'Où', 'Point d’attention'], [
        ['Créer un utilisateur', 'Dans l’AD si synchronisé (voir <a href="/pages/cycle-vie-compte">cycle de vie</a>), sinon ' + menu('Utilisateurs › Utilisateurs actifs › Ajouter'), 'La licence crée la boîte ; sans licence, pas de boîte'],
        ['Affecter une licence', 'Par <strong>groupe</strong> (Entra › Groupes › Licences) plutôt qu’utilisateur par utilisateur', 'Retirer une licence = boîte supprimée après 30 jours : convertir en boîte partagée avant'],
        ['Boîte partagée (contact@, compta@)', menu('Teams et groupes › Boîtes aux lettres partagées'), 'Gratuite jusqu’à 50 Go, sans licence ; on donne des membres, pas un mot de passe'],
        ['Liste de distribution / groupe M365', menu('Teams et groupes'), 'Le groupe M365 crée aussi une équipe Teams et un site SharePoint : ne pas en créer trente'],
        ['Réinitialiser un mot de passe, révoquer les sessions', 'Utilisateur › la fiche', 'Après vérification d’identité ; voir <a href="/pages/mfa-acces-conditionnel">MFA</a>'],
        ['Voir si un service est en panne', menu('Intégrité › Intégrité du service'), 'Avant de chercher trois heures pourquoi Teams ne répond plus'],
        ['Déléguer', menu('Rôles › Attributions de rôle') + ' : « Administrateur du support technique », « Administrateur Teams », « Administrateur Exchange »', 'Le rôle minimal ; jamais Administrateur général pour le support'],
    ]),

    '<h2>3) Teams côté technicien</h2>',
    tab(['Notion', 'Ce que c’est', 'Règle'], [
        ['<strong>Équipe</strong>', 'Un groupe M365 : membres, propriétaires, un site SharePoint, une boîte', 'Au moins deux propriétaires ; une convention de nommage (<code>PRJ-…</code>, <code>SRV-…</code>) ; qui a le droit d’en créer (par défaut tout le monde : à restreindre par une stratégie)'],
        ['<strong>Canal</strong>', 'Un sujet dans l’équipe : standard (tous les membres), privé (sous-groupe), partagé (avec d’autres équipes ou organisations)', 'Un canal privé crée un site SharePoint séparé'],
        ['<strong>Stratégies</strong>', 'Ce que les utilisateurs peuvent faire : réunions, messagerie, applications, appels', menu('Centre d’administration Teams › Stratégies') + ' ; une stratégie « par défaut » et des exceptions par groupe'],
        ['<strong>Réunions</strong>', 'Salle d’attente, qui peut présenter, enregistrement, transcription', 'Les invités externes en salle d’attente ; enregistrement selon la charte'],
        ['<strong>Salles et équipements</strong>', 'Comptes de ressource (salle de réunion, Teams Rooms)', 'Licence dédiée, calendrier de réservation'],
        ['<strong>Téléphonie</strong>', 'Numéros, files d’attente, standard automatique (avec Teams Phone)', 'Un projet à part'],
    ]),
    cmd('# PowerShell — module MicrosoftTeams\n'
        'Connect-MicrosoftTeams\n'
        'New-Team -DisplayName "PRJ-Migration-ERP" -Visibility Private -Owner chef.projet@entreprise.fr\n'
        'Add-TeamUser -GroupId <id> -User marie.martin@entreprise.fr -Role Member\n'
        'Get-Team | Where-Object Archived -eq $false | Select DisplayName, Visibility | Sort DisplayName'),

    '<h2>4) SharePoint, OneDrive et le partage</h2>',
    bullets('Un <strong>site d’équipe</strong> par équipe Teams ; des <strong>sites de communication</strong> pour l’intranet. Les documents de l’organisation vont sur SharePoint, pas sur les OneDrive personnels (qui partent avec la personne).',
            '<strong>Synchronisation</strong> sur le poste : le client OneDrive synchronise OneDrive et les bibliothèques SharePoint ; « Fichiers à la demande » évite de remplir le disque ; les 300 000 fichiers max et les caractères interdits sont les tickets classiques.',
            '<strong>Partage externe</strong> : réglé au niveau du tenant (' + menu('SharePoint › Stratégies › Partage') + ') puis par site. Standard raisonnable : « invités existants ou nouveaux avec vérification », jamais « n’importe qui avec le lien » par défaut ; expiration des liens anonymes si autorisés.',
            '<strong>Corbeilles</strong> : 93 jours en deux niveaux ; la restauration de fichiers OneDrive à une date (rançongiciel) ; ce n’est pas une sauvegarde — voir <a href="/pages/cloud-premiers-pas">responsabilité partagée</a>.',
            '<strong>Étiquettes de confidentialité</strong> et DLP (Business Premium / E3+) : « Confidentiel » chiffre et bloque le partage externe ; c’est le RSSI qui définit, le technicien qui applique et explique.'),

    '<h2>5) Le poste : installer et configurer Microsoft 365 Apps</h2>',
    bullets('L’<strong>outil de déploiement d’Office</strong> (ODT) : un fichier <code>configuration.xml</code> (canal de mise à jour Entreprise mensuel, langue, applications exclues, 64 bits, pas de Teams si géré à part) + <code>setup.exe /configure</code> ; dans l’image ou par Intune / MDT.',
            '<strong>Activation</strong> : par le compte de l’utilisateur (licence), jusqu’à 5 postes ; activation par ordinateur partagé pour les postes en libre-service / RDS.',
            '<strong>Outlook</strong> : découverte automatique via le DNS (<code>autodiscover</code>) ; le profil se crée avec le compte ; le mode cache et la taille du fichier OST sur les portables.',
            '<strong>Teams</strong> : le nouveau client (installé par machine avec <code>teamsbootstrapper.exe -p</code>), pas dans l’image utilisateur par utilisateur.',
            'Mises à jour : canal choisi, contrôlées par GPO / Intune — voir <a href="/pages/gerer-mises-a-jour">Gérer les mises à jour</a>.'),

    '<h2>6) Les tickets qui reviennent</h2>',
    acc(
        ('« Je n’ai plus accès à Teams / à ma boîte »',
         '<p>Licence retirée ou expirée ? Compte désactivé ? Accès conditionnel (nouvel appareil, MFA à '
         'réinscrire) ? Panne de service ? Dans cet ordre : fiche utilisateur, journaux de connexion Entra, '
         'intégrité du service.</p>'),
        ('« Le partage ne marche pas pour la personne externe »',
         '<p>Le site interdit le partage externe, ou le tenant l’interdit, ou le destinataire n’a pas de '
         'compte Microsoft et le lien exige une connexion. Vérifier la stratégie du site, puis proposer un '
         'lien « personnes spécifiques » avec code de vérification.</p>'),
        ('« OneDrive ne synchronise plus »',
         '<p>Icône : erreur ? Fichier au nom interdit (<code>*</code>, <code>:</code>, <code>?</code>), chemin trop long (&gt; 400), '
         'trop de fichiers, ou compte à reconnecter. <code>Réinitialiser OneDrive</code> en dernier recours ; la '
         'bibliothèque reste intacte dans le cloud.</p>'),
        ('« Créez-moi une équipe Teams pour mon service »',
         '<p>Une équipe existe-t-elle déjà ? Qui sont les propriétaires (deux) ? Privée ou publique ? '
         'Nom selon la convention. On crée, on documente dans le ticket, on rappelle la charte de partage.</p>'),
        ('« Un mail important a été supprimé »',
         '<p>Éléments supprimés → Éléments récupérables (14 à 30 jours) ; au-delà, l’administrateur Exchange '
         'peut restaurer depuis la boîte ; sinon, la sauvegarde tierce si elle existe.</p>'),
    ),

    retenir('Microsoft 365 = Exchange, Teams, SharePoint, OneDrive, Apps (+ Entra, Intune, Defender selon le plan) ; <strong>Business Premium</strong> en PME.',
            'Centre d’administration : licences <strong>par groupe</strong>, boîtes partagées sans licence, rôles délégués minimaux, intégrité du service avant de chercher.',
            'Teams : équipes avec deux propriétaires, convention de nommage, stratégies ; une équipe = un groupe M365 = un site SharePoint.',
            'Documents sur SharePoint, pas sur les OneDrive ; partage externe réglé au tenant puis au site ; corbeille ≠ sauvegarde.',
            'Poste : ODT et <code>configuration.xml</code>, activation par compte, Outlook en autodiscover, nouveau Teams par machine.'),
])

# ══════════════════════════════════════════ Maintenance matérielle N1 ══

MATERIEL = '\n'.join([
    hero('Cours · Déploiement', 'Maintenance matérielle de niveau 1',
         'Diagnostiquer un poste qui ne démarre pas, remplacer ce qui se remplace (RAM, SSD, batterie, '
         'alimentation), gérer la garantie, et le faire en sécurité — pour l’équipement et pour soi.'),
    STYLE,
    note('gray', '📚 Avant ce cours',
         'Les cours Hardware : <a href="/pages/carte-mere">la carte mère</a>, <a href="/pages/ports-arriere-carte-mere">ses ports</a>, <a href="/pages/procedure-gestion-disques">les disques</a>.'),
    '<p>Le technicien de niveau 1 ne répare pas une carte mère ; il identifie <strong>ce qui est en '
    'panne</strong>, remplace ce qui est <strong>remplaçable sur site</strong> (mémoire, disque, batterie, '
    'alimentation, périphérique), et <strong>fait jouer la garantie</strong> pour le reste. Le REAC parle '
    'de « diagnostiquer et résoudre les incidents matériels conformément aux procédures ».</p>',

    '<h2>1) Le poste ne démarre pas : la séquence</h2>',
    tab(['Symptôme', 'Où chercher', 'Test'], [
        ['<strong>Rien</strong> : aucun voyant, aucun ventilateur', 'Alimentation électrique, bloc, bouton', 'Autre prise, autre câble ; portable : sans batterie sur secteur ; voyant du chargeur ; tour : test du bloc (bouton de test ou pont vert-noir)'],
        ['Ventilateurs tournent, <strong>écran noir</strong>, pas de bip', 'Mémoire, carte graphique, carte mère', 'Une barrette à la fois, dans le premier slot ; écran sur la sortie de la carte mère ; codes de bips ou voyants de diagnostic (Dell : séquence orange/blanc)'],
        ['Logo constructeur puis <strong>arrêt</strong> ou boucle', 'Disque, firmware', 'Diagnostic intégré (F12 Dell, Esc HP, F2 Lenovo) ; disque vu dans le BIOS ? SMART ?'],
        ['« <strong>No bootable device</strong> »', 'Ordre de démarrage, disque, mode UEFI/Legacy, Secure Boot', 'BIOS : disque présent ? ordre ? Support de secours pour lire le disque'],
        ['Windows démarre puis <strong>écran bleu</strong>', 'Pilote, mémoire, disque, surchauffe', 'Code d’arrêt noté ; mode sans échec ; <code>mdsched</code> (mémoire) ; <code>chkdsk</code> ; température'],
        ['<strong>Lent</strong>, se fige, redémarre seul', 'Surchauffe, disque en fin de vie, alimentation', 'Température (HWMonitor), SMART (CrystalDiskInfo), poussière des dissipateurs, journal système (ID 41 Kernel-Power)'],
    ]),
    note('blue', '💡 Une chose à la fois',
         'La méthode est celle du <a href="/pages/depannage">dépannage</a> : un changement, un test. '
         'Retirer trois composants d’un coup et rallumer ne dit pas lequel était en cause.'),

    '<h2>2) Les outils du niveau 1</h2>',
    tab(['Outil', 'Pour'], [
        ['Diagnostic constructeur intégré (ePSA Dell, HP PC Hardware Diagnostics, Lenovo Diagnostics)', 'Mémoire, disque, carte mère, avec un code d’erreur pour le support'],
        ['<code>mdsched.exe</code> / MemTest86 sur clé', 'La mémoire, sur plusieurs passes'],
        ['CrystalDiskInfo, <code>smartctl</code>, <code>Get-PhysicalDisk | Get-StorageReliabilityCounter</code>', 'La santé du disque (secteurs réalloués, heures, température)'],
        ['HWMonitor, <code>sensors</code>', 'Températures et tensions'],
        ['Clé WinPE / Linux live', 'Lire le disque, sauver les données avant tout, tester sans le système installé'],
        ['Multimètre, testeur d’alimentation', 'Tensions du bloc (12 V, 5 V, 3,3 V)'],
        ['Tournevis (Torx, Phillips, pentalobe), spatule, bracelet antistatique, bombe à air sec, pâte thermique', 'Ouvrir, nettoyer, remonter'],
        ['Le manuel de maintenance du modèle (site constructeur, numéro de série)', 'L’ordre de démontage, ce qui est remplaçable, les références de pièces'],
    ]),

    '<h2>3) Remplacer : ce qui se fait, et comment</h2>',
    acc(
        ('Mémoire',
         steps('Poste éteint, <strong>débranché</strong>, bouton d’alimentation maintenu 10 s (décharge) ; portable : batterie interne déconnectée si accessible.',
               'Bracelet antistatique ou contact avec le châssis métallique.',
               'Type, fréquence, capacité compatibles (manuel, ou l’outil de compatibilité du fabricant de mémoire) ; en double canal, deux barrettes identiques dans les slots de même couleur.',
               'Clips ouverts, barrette insérée dans l’encoche, pression jusqu’au clic.',
               'Test : le BIOS voit la capacité ; <code>mdsched</code> ; <code>Get-CimInstance Win32_PhysicalMemory</code>.')),
        ('Disque / SSD',
         steps('<strong>Sauvegarder d’abord</strong> si le disque est lisible (clé Linux live, <code>dd</code> ou copie de fichiers) ; un disque qui claque ne se rouvre pas.',
               'SATA 2,5" ou M.2 (SATA ou NVMe : la clé d’encoche diffère) selon le manuel.',
               'Clonage (Clonezilla, outil du fabricant) si le système est sain, ou <a href="/pages/deployer-image-windows">réinstallation par image</a> — plus propre.',
               'BitLocker : la <strong>clé de récupération</strong> avant toute manipulation ; un disque chiffré sans clé est un presse-papiers.',
               'Test : SMART neuf, démarrage, mise à jour du firmware du SSD.')),
        ('Batterie (portable)',
         steps('Diagnostic : <code>powercfg /batteryreport</code> — capacité actuelle / capacité d’origine ; sous 60 %, c’est une batterie à remplacer.',
               'Pièce d’origine ou compatible certifiée ; jamais une batterie gonflée réutilisée, jamais percée (incendie).',
               'Démontage selon le manuel ; connecteur déclipsé délicatement ; vis stockées dans l’ordre.',
               'La batterie usagée va dans la filière <a href="/pages/deee-sobriete">DEEE</a> (bac batteries), pas à la poubelle.')),
        ('Alimentation (tour) et chargeur (portable)',
         steps('Tour : test du bloc ; remplacement par un bloc de puissance ≥ et connectique identique (ATX 24 broches, 8 broches CPU, PCIe) ; câbles bien enfoncés.',
               'Portable : le chargeur d’origine (tension et puissance identiques, connecteur ou USB-C PD suffisant) ; un chargeur trop faible « charge lentement » ou pas du tout.')),
        ('Périphériques : écran, clavier, station d’accueil, câbles',
         '<p>Souvent la vraie panne : un câble HDMI, un dock qui ne détecte plus l’écran (firmware du dock !), '
         'un clavier qui a bu un café. On teste par substitution : un autre câble, un autre écran, un autre port.</p>'),
    ),
    note('red', '🚨 Ce qu’on ne fait pas en niveau 1',
         'Souder, ouvrir une alimentation (condensateurs chargés même débranchée), démonter un écran '
         'LCD (nappe et dalle fragiles), remplacer un processeur ou un GPU soudé, intervenir sur un '
         'serveur sous garantie sans l’accord du support. Ce sont des interventions de niveau 2 ou du '
         'constructeur.'),

    '<h2>4) La garantie et le support constructeur</h2>',
    steps('Le <strong>numéro de série</strong> (étiquette, BIOS, <code>Get-CimInstance Win32_BIOS | Select SerialNumber</code>) ; le site constructeur donne la date de fin de garantie et le niveau (retour atelier, sur site J+1, pièces seules).',
          'Le <strong>code du diagnostic intégré</strong> : avec lui, le support envoie la pièce sans discussion ; sans lui, il fait refaire le diagnostic au téléphone.',
          'Ce que le support demande : symptôme, ce qui a été testé, code, numéro de série, adresse d’intervention. Le compte rendu du ticket contient déjà tout.',
          '<strong>Données</strong> : avant un retour atelier, sauvegarder et, selon la PSSI, effacer ou retirer le disque (garder le disque est souvent une option de contrat : « keep your hard drive »).',
          'Suivi : numéro de dossier constructeur dans le ticket ; poste de prêt à l’utilisateur.'),

    '<h2>5) Entretenir : ce qui évite les pannes</h2>',
    bullets('<strong>Dépoussiérer</strong> les dissipateurs et ventilateurs une fois par an (air sec, ventilateur bloqué avec un doigt pour ne pas le faire tourner).',
            '<strong>Pâte thermique</strong> sur les postes de plus de 4–5 ans qui chauffent.',
            '<strong>Firmwares</strong> : BIOS/UEFI, SSD, dock — via l’outil constructeur, dans le cycle des <a href="/pages/gerer-mises-a-jour">mises à jour</a>.',
            '<strong>SMART</strong> surveillé par la <a href="/pages/supervision">supervision</a> ou l’agent RMM : remplacer un disque qui annonce sa fin, avant qu’elle arrive.',
            '<strong>Inventaire</strong> : date d’achat, garantie, interventions — pour décider entre réparer et remplacer (au-delà de 5 ans, ou si la réparation dépasse 40 % du neuf, on remplace ; le reconditionnement est l’étape d’après).'),

    '<h2>6) Sécurité de l’intervenant</h2>',
    bullets('Débranché, déchargé, bracelet antistatique ; pas de bijoux métalliques.',
            'Alimentations et écrans : on ne les ouvre pas.',
            'Batteries lithium : ni percer, ni chauffer, ni court-circuiter ; une batterie gonflée se met à l’écart sur une surface non inflammable et part en filière DEEE rapidement.',
            'Poussière : masque et air sec dans un espace aéré.',
            'Posture : un serveur se porte à deux ; un écran 27" ne se tient pas par la dalle — voir <a href="/pages/ergonomie-tms">Ergonomie et TMS</a>.'),

    retenir('Diagnostic par symptôme : rien / ventilateurs sans image / arrêt au logo / no bootable device / écran bleu / lenteur — <strong>une chose à la fois</strong>.',
            'Outils : diagnostic intégré (le code pour le support), mémoire, SMART, températures, clé live pour <strong>sauver les données d’abord</strong>.',
            'Niveau 1 remplace mémoire, disque (clé BitLocker !), batterie, alimentation, périphériques — pas les alimentations ouvertes, écrans, composants soudés.',
            'Garantie : numéro de série, code de diagnostic, données sauvegardées / disque retiré, dossier suivi dans le ticket.',
            'Entretien : poussière, firmwares, SMART supervisé, inventaire pour décider réparer / remplacer ; sécurité de l’intervenant.'),
])

# ══════════════════════════════════════════════════ Accessibilité ══

ACCESS = '\n'.join([
    hero('Cours · Environnement de travail', 'Accessibilité numérique : adapter le poste',
         'Les outils intégrés à Windows et à Microsoft 365 pour les déficiences visuelles, auditives, '
         'motrices et cognitives ; les matériels adaptés ; et la façon d’accompagner sans présumer.'),
    STYLE,
    '<p>Le RE 2026 est explicite : « les équipements numériques répondent aux besoins spécifiques des '
    'personnes en situation de handicap », et l’assistance se fait « avec un vocabulaire adapté, y '
    'compris aux personnes en situation de handicap ». En France, l’obligation d’emploi (6 %), le '
    'RGAA pour les services publics et la directive européenne sur l’accessibilité font de ce sujet '
    'une compétence attendue, pas une option.</p>',

    '<h2>1) Commencer par la personne, pas par le handicap</h2>',
    bullets('On <strong>demande</strong> ce qui aide, on ne devine pas : la personne connaît ses besoins et souvent déjà les outils. « De quoi avez-vous besoin pour travailler confortablement ? »',
            'La <strong>médecine du travail</strong> et le <strong>référent handicap</strong> (obligatoire au-delà de 250 salariés) prescrivent et financent (Agefiph, FIPHFP) ; le technicien met en œuvre.',
            'Une adaptation est <strong>individuelle</strong> et <strong>évolutive</strong> : on revient un mois après.',
            'Beaucoup de besoins ne sont pas déclarés (dyslexie, fatigue visuelle, TMS) : proposer les outils à tous, dans la formation de prise en main, évite d’avoir à demander.'),

    '<h2>2) Windows : ce qui est déjà là</h2>',
    '<p>' + menu('Paramètres › Accessibilité') + ' (ou <kbd>Win</kbd> + <kbd>U</kbd>) regroupe tout ; les raccourcis '
    'ci-dessous s’apprennent en une minute et se montrent à l’utilisateur.</p>',
    tab(['Besoin', 'Outil Windows', 'Raccourci / réglage'], [
        ['<strong>Vue basse</strong>', 'Loupe (plein écran, ancrée, lentille) ; taille du texte (jusqu’à 225 %) ; mise à l’échelle ; curseur de souris grand et coloré ; épaisseur du curseur de texte', '<kbd>Win</kbd> + <kbd>+</kbd> / <kbd>-</kbd> ; Accessibilité › Taille du texte'],
        ['<strong>Contraste, daltonisme</strong>', 'Thèmes à contraste élevé ; filtres de couleur (deutéranopie, protanopie, tritanopie, niveaux de gris)', '<kbd>Alt</kbd> gauche + <kbd>Maj</kbd> gauche + <kbd>Impr. écran</kbd> ; <kbd>Win</kbd> + <kbd>Ctrl</kbd> + <kbd>C</kbd>'],
        ['<strong>Cécité</strong>', '<strong>Narrateur</strong> (lecteur d’écran intégré) ; pour un usage professionnel intensif : NVDA (libre) ou JAWS', '<kbd>Win</kbd> + <kbd>Ctrl</kbd> + <kbd>Entrée</kbd>'],
        ['<strong>Surdité, malentendance</strong>', 'Sous-titres en direct (système) ; notifications visuelles (flash) ; audio mono', 'Accessibilité › Sous-titres, Audio'],
        ['<strong>Motricité</strong>', 'Touches rémanentes (une touche à la fois pour Ctrl+Alt+Suppr), touches filtres (ignorer les frappes répétées), contrôle de la souris par le pavé numérique, <strong>reconnaissance vocale</strong> et saisie vocale, contrôle oculaire (avec matériel), clavier visuel', '<kbd>Maj</kbd> × 5 (rémanentes) ; <kbd>Win</kbd> + <kbd>H</kbd> (dictée) ; Accessibilité › Voix'],
        ['<strong>Cognitif, attention, dyslexie</strong>', 'Assistant de concentration / Ne pas déranger ; animations et transparence désactivées ; police lisible ; le <strong>Lecteur immersif</strong> d’Office (espacement, syllabes, lecture à voix haute)', 'Accessibilité › Effets visuels ; Word › Affichage › Lecteur immersif'],
    ]),
    cmd('# régler par GPO ou script ce qui doit l’être pour un profil (exemple : loupe au démarrage)\n'
        'reg add "HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Accessibility" /v Configuration /t REG_SZ /d magnifierpane /f\n'
        '# taille du texte à 150 %\n'
        'reg add "HKCU\\Software\\Microsoft\\Accessibility" /v TextScaleFactor /t REG_DWORD /d 150 /f'),

    '<h2>3) Microsoft 365 et le web</h2>',
    bullets('<strong>Vérificateur d’accessibilité</strong> dans Word, Excel, PowerPoint, Outlook (Révision › Vérifier l’accessibilité) : texte de remplacement des images, contrastes, structure des titres — pour que ce que l’organisation produit soit lisible par un lecteur d’écran.',
            '<strong>Lecteur immersif</strong> (Word, Outlook, Teams, Edge) : lecture à voix haute, espacement, focus ligne.',
            '<strong>Teams</strong> : sous-titres en direct et transcription des réunions ; langue des signes en vue épinglée ; chat pour les personnes qui ne parlent pas.',
            '<strong>Edge</strong> : lecture à voix haute, zoom par site, mode lecture.',
            '<strong>Dictée</strong> dans Office et Windows ; <strong>Cortana / Copilot</strong> comme assistant vocal selon la charte IA.'),

    '<h2>4) Le matériel adapté</h2>',
    tab(['Besoin', 'Matériel', 'Remarque'], [
        ['Vue', 'Grand écran (27–32") avec bonne luminosité, filtre anti-reflets ; plage braille (USB / Bluetooth, avec NVDA / JAWS) ; téléagrandisseur', 'La plage braille se configure dans le lecteur d’écran'],
        ['Audition', 'Casque à conduction osseuse ou compatible appareil auditif (boucle T, Bluetooth), amplificateur téléphonique, alerte visuelle', 'Tester avec l’appareil auditif de la personne'],
        ['Motricité', 'Souris verticale, trackball, joystick, souris à contacteurs, clavier une main / à grosses touches / avec cache-clavier, repose-poignets, bras articulé, commande par la tête ou le regard (Tobii)', 'Réglages Windows (contrôle oculaire, touches) complémentaires'],
        ['Posture, fatigue', 'Bureau réglable en hauteur, siège adapté, support d’écran', 'Voir <a href="/pages/ergonomie-tms">Ergonomie et TMS</a>'],
    ]),
    '<p>Le matériel se commande sur prescription (médecine du travail) et se <strong>configure par le '
    'technicien</strong> : pilotes, boutons, sensibilité, et un test avec la personne.</p>',

    '<h2>5) Accompagner : la communication</h2>',
    tab(['Situation', 'À faire', 'À éviter'], [
        ['Personne malvoyante ou aveugle', 'Se présenter, décrire ce qu’on fait (« je clique sur Fichier, en haut à gauche »), nommer les raccourcis clavier plutôt que « là »', 'Prendre la souris sans prévenir ; parler plus fort'],
        ['Personne sourde ou malentendante', 'Se placer face à elle, articuler normalement, écrire (chat, papier), sous-titres ; prévoir l’interprète LSF pour une formation', 'Crier ; parler en regardant l’écran'],
        ['Motricité réduite', 'Laisser le temps, proposer la prise en main à distance pour montrer, adapter le rythme', 'Faire à sa place systématiquement'],
        ['Troubles cognitifs, dys', 'Une consigne à la fois, écrite et orale, une procédure illustrée, reformuler', 'Le jargon ; « c’est simple »'],
        ['Dans tous les cas', 'Demander comment la personne préfère communiquer ; vocabulaire adapté ; patience ; ne pas parler du handicap à d’autres (donnée de santé, RGPD)', 'Présumer'],
    ]),
    '<p>Les supports de formation et de sensibilisation suivent les mêmes règles : titres structurés, '
    'contraste, texte de remplacement, pas d’information portée par la couleur seule, vidéos '
    'sous-titrées. Voir <a href="/pages/sensibiliser-utilisateurs">Sensibiliser les utilisateurs</a>.</p>',

    '<h2>6) Le cadre</h2>',
    bullets('<strong>Loi de 2005</strong> : obligation d’emploi de 6 % de travailleurs handicapés au-delà de 20 salariés, et d’aménagement raisonnable du poste.',
            '<strong>RGAA</strong> (référentiel général d’amélioration de l’accessibilité) : les services numériques publics doivent être accessibles ; les entreprises de plus de 250 M€ de CA aussi.',
            '<strong>Directive européenne sur l’accessibilité</strong> (2025) : produits et services numériques (sites de commerce, banques, terminaux).',
            '<strong>Agefiph</strong> (privé) et <strong>FIPHFP</strong> (public) financent matériels et formations.',
            '<strong>RGPD</strong> : le handicap est une donnée de santé — le ticket dit « adaptation de poste », pas le diagnostic.'),

    retenir('Demander à la personne ; la médecine du travail prescrit ; le technicien <strong>met en œuvre et configure</strong>.',
            'Windows : loupe, contraste, filtres de couleur, Narrateur / NVDA, sous-titres, touches rémanentes, dictée — <kbd>Win</kbd> + <kbd>U</kbd>.',
            'Office et Teams : vérificateur d’accessibilité, lecteur immersif, sous-titres et transcription.',
            'Matériel : écran, plage braille, casque compatible, souris et claviers adaptés, bureau réglable — configurés et testés avec la personne.',
            'Communication adaptée, sans présumer, et sans divulguer (donnée de santé).'),
])

# ══════════════════════════════════════════════════ Ergonomie & TMS ══

ERGO = '\n'.join([
    hero('Cours · Environnement de travail', 'Ergonomie du poste et prévention des TMS',
         'Régler un poste de travail (écran, siège, clavier, souris) pour prévenir les troubles '
         'musculo-squelettiques, conseiller l’utilisateur, et protéger son propre dos et ses poignets '
         'en intervention.'),
    STYLE,
    '<p>Les troubles musculo-squelettiques (TMS) sont la première maladie professionnelle en France ; '
    'le travail sur écran en est une cause majeure (cou, épaules, poignets, dos), et les techniciens '
    'y ajoutent le port de charges et les postures d’intervention. Le REAC 2026 attend que le '
    'technicien « mette en œuvre les principes d’ergonomie » lors du déploiement d’un poste, et '
    'applique les règles de prévention pour lui-même.</p>',

    '<h2>1) Le poste sur écran : les réglages</h2>',
    tab(['Élément', 'Réglage', 'Pourquoi'], [
        ['<strong>Écran</strong>', 'Haut de l’écran au niveau des yeux (ou légèrement en dessous), à une longueur de bras (50–70 cm), perpendiculaire aux fenêtres', 'Cou droit ; pas de reflets ; les portables ont besoin d’un support + clavier externe pour y arriver'],
        ['<strong>Deux écrans</strong>', 'L’écran principal en face, le second à côté à même hauteur ; ou les deux centrés sur la jointure si usage égal', 'Pas de rotation permanente de la tête'],
        ['<strong>Siège</strong>', 'Hauteur : cuisses horizontales, pieds à plat (repose-pieds si besoin) ; dossier soutenant les lombaires ; accoudoirs au niveau du bureau', 'Le bassin et le dos portés par le siège, pas par les muscles'],
        ['<strong>Bureau</strong>', 'Coudes à 90°, avant-bras posés ; 70–75 cm de hauteur standard ; réglable en hauteur pour alterner assis / debout', 'Épaules relâchées'],
        ['<strong>Clavier</strong>', 'Droit devant, plat (pieds rentrés), à 10–15 cm du bord ; les poignets ne se cassent pas', 'Tendinites et canal carpien'],
        ['<strong>Souris</strong>', 'Près du clavier, à la même hauteur ; bras le long du corps ; sensibilité réglée pour bouger peu', 'Épaule et poignet'],
        ['<strong>Éclairage</strong>', 'Lumière indirecte ; écran ni face ni dos à la fenêtre ; luminosité de l’écran proche de celle de la pièce', 'Fatigue visuelle'],
        ['<strong>Documents</strong>', 'Porte-document entre clavier et écran', 'Cou'],
    ]),
    note('blue', '💡 Le test de 30 secondes',
         'Assis, mains sur le clavier : les yeux tombent-ils sur le tiers supérieur de l’écran ? Les '
         'coudes sont-ils à 90° ? Les pieds à plat ? Les épaules basses ? Quatre oui : le poste est '
         'réglé. C’est le test qu’on fait avec l’utilisateur à la remise du poste.'),

    '<h2>2) Ce que Windows peut faire</h2>',
    bullets('<strong>Rappels de pause</strong> : l’assistant de concentration / Ne pas déranger avec des plages, ou un outil dédié (Workrave, Stretchly, libres) : 5 minutes toutes les heures, le regard au loin toutes les 20 minutes (règle 20-20-20).',
            '<strong>Taille du texte et mise à l’échelle</strong> à 125 % sur un 24" Full HD : moins de rapprochement de l’écran ; voir <a href="/pages/accessibilite-windows">Accessibilité</a>.',
            '<strong>Éclairage nocturne</strong> et luminosité automatique ; taux de rafraîchissement élevé si l’écran le permet.',
            '<strong>Raccourcis clavier</strong> : moins de souris, moins de tension de l’épaule — les enseigner fait partie de la prise en main.'),

    '<h2>3) Le matériel qui aide</h2>',
    tab(['Matériel', 'Pour', 'Remarque'], [
        ['Support de portable + clavier et souris externes', 'Tout utilisateur de portable plus de 2 h par jour', 'Le geste ergonomique le plus rentable du parc'],
        ['Bras d’écran', 'Ajuster hauteur et distance, libérer le bureau', ''],
        ['Souris verticale, trackball', 'Douleurs du poignet ou de l’avant-bras', 'Une période d’adaptation d’une semaine'],
        ['Clavier compact (sans pavé numérique)', 'Rapprocher la souris de l’axe du corps', 'Pavé numérique séparé pour la saisie de chiffres'],
        ['Repose-poignets, repose-pieds', 'Selon la morphologie', 'Le repose-poignets sert entre les frappes, pas pendant'],
        ['Bureau assis-debout', 'Alterner les postures', 'Alterner vraiment : 30 min debout par heure, pas debout toute la journée'],
        ['Casque pour le téléphone', 'Épaule et cou (le combiné coincé)', 'Support et hotline d’abord'],
    ]),

    '<h2>4) Le technicien en intervention</h2>',
    tab(['Situation', 'Risque', 'Prévention'], [
        ['Porter un serveur (20–40 kg), un onduleur (30 kg), une baie', 'Dos', 'À deux ; chariot ; rails ; jamais en torsion ; plier les genoux, dos droit, charge contre soi'],
        ['Câbler sous un bureau, dans une baie basse', 'Genoux, dos, cou', 'Genouillères, lampe frontale, se mettre à genoux plutôt que courbé ; le brassage bas après le haut'],
        ['Câbler en hauteur (chemins de câbles, points d’accès)', 'Épaules, chute', 'Escabeau stable, pas de chaise ; travail à hauteur d’épaule max ; à deux'],
        ['Portables, écrans, cartons de livraison', 'Coupures, dos', 'Cutter de sécurité, déballage sur une table, gants'],
        ['Journée de déploiement (40 postes)', 'Répétition des gestes, dos', 'Chariot, poste de préparation à bonne hauteur, alterner les tâches, pauses'],
        ['Au bureau entre deux tickets', 'Les mêmes TMS que tout le monde', 'Son propre poste réglé — le technicien montre l’exemple'],
    ]),
    note('yellow', '⚠️ Le port de charges a des limites réglementaires',
         'Le Code du travail limite le port manuel (55 kg sur avis médical ; 25 kg recommandés par la '
         'norme AFNOR X35-109 en conditions idéales, moins en posture contrainte). Un serveur 2U '
         'rempli dépasse souvent 30 kg : deux personnes, ou un lève-serveur.'),

    '<h2>5) Repérer et orienter</h2>',
    bullets('Signes : douleur en fin de journée qui disparaît la nuit (début), puis qui persiste, fourmillements dans les doigts, raideur du cou, douleur d’épaule au clic.',
            'Le technicien <strong>n’est pas médecin</strong> : il règle le poste, propose le matériel du catalogue, et oriente vers la <strong>médecine du travail</strong> ou le référent prévention / CSE.',
            'Le poste réglé et le matériel proposé sont notés dans le ticket ; le suivi à un mois aussi.'),

    '<h2>6) Le télétravail</h2>',
    '<p>Le poste à domicile est souvent le pire : portable sur la table de la cuisine, chaise de salle à '
    'manger. L’organisation fournit (ou rembourse) au minimum support, clavier, souris, souvent un '
    'écran ; la fiche « régler son poste » fait partie du kit de télétravail, avec le VPN et la '
    'charte. Un accident du travail à domicile pendant les heures de télétravail est reconnu comme '
    'tel.</p>',

    retenir('Écran à hauteur des yeux, une longueur de bras ; coudes à 90° ; pieds à plat ; épaules basses — le <strong>test de 30 secondes</strong> à la remise du poste.',
            'Portable = <strong>support + clavier + souris externes</strong> ; pauses toutes les heures, regard au loin toutes les 20 minutes.',
            'Matériel adapté sur demande ou prescription ; le technicien règle, propose, oriente vers la médecine du travail.',
            'En intervention : <strong>à deux</strong> pour les charges lourdes, genoux pliés, escabeau, genouillères, alterner.',
            'Télétravail : le kit ergonomique fait partie du kit informatique.'),
])

# ══════════════════════════════════════════════════ DEEE & sobriété ══

DEEE = '\n'.join([
    hero('Cours · Environnement de travail', 'DEEE, cycle de vie et sobriété numérique',
         'Ce que devient un poste en fin de vie, ce que la loi impose (DEEE, REEN, AGEC), comment '
         'effacer les données avant de céder, et les gestes qui réduisent l’empreinte du parc.'),
    STYLE,
    '<p>Le numérique pèse environ 4 % des émissions mondiales de gaz à effet de serre, et l’essentiel '
    'de l’empreinte d’un ordinateur est dans sa <strong>fabrication</strong> (70 à 80 %), pas dans son '
    'usage. Le technicien décide chaque jour de la durée de vie du matériel, de ce qui est jeté, et de '
    'ce que consomment les serveurs. Le REAC 2026 lui demande d’intégrer « les enjeux de sobriété '
    'numérique » et la gestion des DEEE.</p>',

    '<h2>1) Le cycle de vie d’un équipement</h2>',
    tab(['Étape', 'Ce que le technicien fait', 'Le levier'], [
        ['<strong>Achat</strong>', 'Cahier des charges : réparabilité, garantie longue, pièces disponibles, labels (TCO Certified, EPEAT, Energy Star), reconditionné pour certains usages', 'Un poste qui dure 6 ans au lieu de 3 divise l’empreinte par deux'],
        ['<strong>Déploiement</strong>', 'Image sans superflu, gestion de l’énergie activée', 'Voir <a href="/pages/deployer-image-windows">Déployer une image</a>'],
        ['<strong>Usage</strong>', 'Mises à jour, entretien, remplacement de la batterie ou du SSD plutôt que du poste', 'Voir <a href="/pages/maintenance-materielle-niveau-1">Maintenance matérielle</a>'],
        ['<strong>Réaffectation</strong>', 'Un poste de 4 ans va à un usage léger (accueil, salle de réunion), avec un SSD et de la RAM', 'Le reconditionnement interne'],
        ['<strong>Fin de vie</strong>', 'Effacement certifié, don / revente / reconditionneur, ou filière DEEE', 'La loi AGEC impose de proposer le réemploi avant le recyclage'],
    ]),

    '<h2>2) Le cadre légal</h2>',
    tab(['Texte', 'Ce qu’il impose'], [
        ['<strong>Directive DEEE</strong> (2012/19/UE) et Code de l’environnement', 'Les déchets d’équipements électriques et électroniques suivent une filière dédiée : le producteur finance (éco-organismes <strong>Ecosystem</strong>, <strong>Ecologic</strong>), le détenteur professionnel doit remettre ses DEEE à un collecteur agréé et conserver la preuve (bordereau)'],
        ['<strong>Loi AGEC</strong> (2020)', 'Indice de réparabilité (puis de durabilité) ; les administrations achètent 20 % de reconditionné ; réemploi et don prioritaires ; interdiction de détruire les invendus'],
        ['<strong>Loi REEN</strong> (2021)', 'Réduire l’empreinte environnementale du numérique : stratégie numérique responsable obligatoire pour les communes de plus de 50 000 habitants, obligations pour les datacenters'],
        ['<strong>RGPD</strong>', 'Un disque cédé ou jeté avec des données personnelles lisibles est une violation ; l’effacement est une obligation de sécurité'],
        ['<strong>Piles et batteries</strong>', 'Filière spécifique (Corepile, Screlec) ; ne vont jamais avec les DEEE en vrac'],
    ]),
    note('red', '🚨 Jeter un serveur dans la benne',
         'C’est une infraction (Code de l’environnement), une fuite de données potentielle, et un '
         'gaspillage de métaux rares. Un DEEE professionnel se remet à un collecteur agréé, contre un '
         '<strong>bordereau de suivi</strong> qu’on archive avec l’inventaire.'),

    '<h2>3) Effacer les données avant de céder</h2>',
    tab(['Méthode', 'Pour', 'Remarque'], [
        ['<strong>Effacement chiffré</strong> : le disque était chiffré (BitLocker, LUKS, chiffrement matériel), on détruit la clé', 'SSD et disques chiffrés — le cas normal d’un parc bien géré', 'Instantané et sûr : sans la clé, les données sont du bruit. <code>manage-bde -off</code> ne suffit pas ; il faut un reformatage après'],
        ['<strong>Secure Erase / Sanitize</strong> (commande ATA / NVMe)', 'SSD', 'L’outil du fabricant, <code>nvme format --ses=1</code>, <code>hdparm --security-erase</code> ; le seul effacement fiable d’un SSD (l’écrasement multiple ne l’est pas)'],
        ['<strong>Écrasement</strong> (1 passe suffit sur les disques modernes)', 'Disques durs', '<code>dd if=/dev/zero</code>, <code>shred</code>, DBAN / ShredOS, ou un outil certifié (Blancco, avec certificat)'],
        ['<strong>Destruction physique</strong>', 'Disques en panne, données très sensibles', 'Broyeur ou démagnétiseur chez le prestataire, avec certificat'],
        ['Formatage rapide, réinstallation de Windows', 'Rien', 'Les données restent récupérables ; ce n’est <strong>pas</strong> un effacement'],
    ]),
    cmd('# SSD NVMe : effacement sécurisé (depuis un Linux live)\n'
        'nvme id-ctrl /dev/nvme0 | grep -i sanicap        # sanitize supporté ?\n'
        'nvme sanitize /dev/nvme0 -a 2                     # block erase\n'
        '# disque SATA / SSD SATA\n'
        'hdparm -I /dev/sda | grep -A8 "Security"          # "not frozen" requis\n'
        'hdparm --user-master u --security-set-pass p /dev/sda && hdparm --user-master u --security-erase p /dev/sda\n'
        '# disque dur : une passe de zéros, avec avancement\n'
        'dd if=/dev/zero of=/dev/sdb bs=4M status=progress'),
    '<p>Un <strong>certificat d’effacement</strong> (numéro de série, méthode, date, opérateur) par disque '
    'cédé, joint à l’inventaire : c’est ce que la PSSI et l’auditeur demandent, et ce qui protège le '
    'technicien.</p>',

    '<h2>4) Réemploi, don, reconditionnement</h2>',
    bullets('<strong>En interne</strong> : réaffecter à un usage léger, ou constituer un stock de prêt / de secours.',
            '<strong>Don</strong> à une association, une école (réseau Emmaüs Connect, Ateliers du Bocage, associations locales) : réduction d’impôt possible, matériel effacé et fonctionnel, convention.',
            '<strong>Reconditionneur professionnel</strong> : rachète ou reprend gratuitement, efface avec certificat, revend ; pratique pour un lot de 40 postes.',
            '<strong>Pièces</strong> : RAM, SSD, alimentations d’un poste HS servent aux autres — un stock de pièces récupérées.',
            'La <strong>traçabilité</strong> : dans l’inventaire, chaque sortie a une destination, une date, un certificat d’effacement.'),

    '<h2>5) La sobriété au quotidien</h2>',
    tab(['Levier', 'Geste', 'Ordre de grandeur'], [
        ['<strong>Durée de vie</strong>', 'Postes gardés 5–6 ans, serveurs 6–7 ans avec support ; réparer avant de remplacer', 'Le levier n° 1 : la fabrication domine'],
        ['<strong>Énergie des postes</strong>', 'Mise en veille par GPO / Intune (écran 10 min, veille 30 min), extinction le soir (pas seulement l’écran), <code>powercfg</code> ; pas de « veille prolongée jamais »', 'Un poste allumé la nuit et le week-end = 60 % de sa consommation pour rien'],
        ['<strong>Serveurs</strong>', 'Consolider par virtualisation, éteindre les VM de test, dimensionner (pas 64 Go pour un DNS), gestion d’énergie du BIOS en « équilibré »', 'Un serveur physique inutile = 200–400 W permanents'],
        ['<strong>Stockage</strong>', 'Quotas, nettoyage des partages (doublons, fichiers de 10 ans), rétention des sauvegardes raisonnée, déduplication', 'Le stockage a un coût carbone et un coût de sauvegarde'],
        ['<strong>Impression</strong>', 'Recto-verso et noir et blanc par défaut, impression à la demande (badge), suppression des imprimantes individuelles', 'Papier, toner, électricité'],
        ['<strong>Réseau et cloud</strong>', 'Pas de vidéo en 4K en réunion interne, caméras coupées si inutiles, boîtes mail nettoyées, pièces jointes remplacées par des liens', 'La transmission compte moins que le terminal, mais s’additionne'],
        ['<strong>IA</strong>', 'Le bon outil pour la bonne tâche', 'Voir <a href="/pages/ia-encadrer">Encadrer l’IA</a>'],
        ['<strong>Achat</strong>', 'Reconditionné pour les usages standards, labels, mutualisation (une imprimante par étage)', ''],
    ]),
    cmd('# Windows : plan d’alimentation par GPO (Configuration ordinateur › Modèles d’administration › Système › Gestion de l’alimentation)\n'
        '#   Paramètres de veille › Mettre en veille après (sur secteur) : 1800 s\n'
        '#   Paramètres d’affichage vidéo › Éteindre l’écran (sur secteur) : 600 s\n'
        'powercfg /list ; powercfg /change standby-timeout-ac 30 ; powercfg /change monitor-timeout-ac 10\n'
        'powercfg /energy                      # rapport de ce qui empêche la veille'),

    '<h2>6) Mesurer et rendre compte</h2>',
    bullets('L’<strong>inventaire</strong> donne l’âge du parc, le taux de renouvellement, ce qui est sorti et où.',
            'La <strong>supervision</strong> (ou une prise connectée) donne la consommation des serveurs et de la salle ; le PUE du datacenter est demandé à l’hébergeur — voir <a href="/pages/datacenter">Le datacenter</a>.',
            'Un <strong>indicateur simple</strong> par an : nombre de postes réemployés / jetés, tonnes de DEEE collectées (bordereaux), consommation de la salle serveur, durée de vie moyenne. C’est ce que la démarche numérique responsable de l’organisation (et parfois la loi REEN) demande.'),

    retenir('L’empreinte d’un poste est surtout dans sa <strong>fabrication</strong> : <strong>faire durer</strong> est le premier geste.',
            'Un DEEE professionnel va à un <strong>collecteur agréé</strong> avec bordereau ; les batteries ont leur filière ; AGEC impose le réemploi avant le recyclage.',
            '<strong>Effacer</strong> avant de céder : clé de chiffrement détruite + reformatage, Secure Erase pour les SSD, écrasement pour les disques durs, certificat par disque. Le formatage n’efface rien.',
            'Réemploi interne, don, reconditionneur, pièces — tracés dans l’inventaire.',
            'Sobriété : veille par GPO, VM de test éteintes, stockage nettoyé, impression maîtrisée, achats durables ; un indicateur annuel.'),
])

PAGES_DEPLOI = [
    ('deployer-image-windows', 'Déployer une image Windows',
     'Le standard de poste, clé + autounattend, image de référence + Sysprep + DISM, WDS/MDT, Autopilot/Intune, et la liste de contrôle avant remise (mises à jour, BitLocker, agents, besoins spécifiques).',
     IMAGE, SG_DEPLOI,
     'Standard de poste, image de référence et Sysprep, WDS + MDT, Autopilot + Intune, la liste de contrôle avant remise.'),
    ('microsoft-365-teams', 'Microsoft 365 et Teams : administrer les outils collaboratifs',
     'Services et plans, centre d’administration (licences par groupe, boîtes partagées, rôles), Teams (équipes, stratégies, PowerShell), SharePoint/OneDrive et partage externe, Apps sur le poste, tickets fréquents.',
     M365, SG_DEPLOI,
     'Ce qu’il y a dans l’abonnement, le centre d’administration, Teams et SharePoint côté technicien, le poste, les tickets qui reviennent.'),
    ('maintenance-materielle-niveau-1', 'Maintenance matérielle de niveau 1',
     'Le poste qui ne démarre pas (séquence), outils de diagnostic, remplacer mémoire / disque / batterie / alimentation, garantie et support constructeur, entretien, sécurité de l’intervenant.',
     MATERIEL, SG_DEPLOI,
     'Diagnostiquer par symptôme, remplacer ce qui se remplace, faire jouer la garantie, entretenir, se protéger.'),
]

PAGES_ENV = [
    ('accessibilite-windows', 'Accessibilité numérique : adapter le poste',
     'Outils Windows (loupe, contraste, Narrateur, sous-titres, touches, dictée), Office et Teams, matériel adapté, communication adaptée, cadre légal (loi 2005, RGAA, Agefiph).',
     ACCESS, SG_ENV,
     'Ce que Windows et Microsoft 365 offrent, le matériel adapté, accompagner sans présumer, le cadre.'),
    ('ergonomie-tms', 'Ergonomie du poste et prévention des TMS',
     'Régler écran, siège, clavier, souris (test de 30 secondes), outils Windows, matériel, le technicien en intervention (charges, câblage), repérer et orienter, télétravail.',
     ERGO, SG_ENV,
     'Les réglages du poste sur écran, le matériel qui aide, le technicien en intervention, orienter vers la médecine du travail.'),
    ('deee-sobriete', 'DEEE, cycle de vie et sobriété numérique',
     'Cycle de vie d’un équipement, cadre (DEEE, AGEC, REEN, RGPD), effacement des données (chiffrement, Secure Erase, écrasement), réemploi et don, sobriété (veille, serveurs, stockage, impression), indicateurs.',
     DEEE, SG_ENV,
     'Faire durer, effacer avant de céder, la filière DEEE et la loi AGEC, réemploi, les gestes de sobriété et leur mesure.'),
]

LOTS = [(PAGES_DEPLOI, SOFT), (PAGES_ENV, MAINT)]

if __name__ == '__main__':
    for lot in LOTS:
        publier_lot(*lot)
    sys.exit(0)

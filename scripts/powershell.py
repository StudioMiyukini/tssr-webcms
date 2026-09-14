# -*- coding: utf-8 -*-
"""
Chantier P1 du comparatif REAC 2026 : scripts PowerShell et planification Windows.

La compétence 8 (« automatiser des tâches à l'aide de scripts ») avait Bash et
cron côté Linux, et rien côté Windows au-delà de la présentation CMD/PowerShell.
Deux cours dans Software › Administration Windows.

IDEMPOTENT.
"""
import sys

from _cours import (Categorie, STYLE, acc, bullets, cmd, hero, menu, note, publier_lot, retenir, steps, tab)

SOFT = Categorie('cat-software', '💿', 'Software', '', '#2563eb')

# ═══════════════════════════════════════════════════ Scripts PowerShell ══

PS = '\n'.join([
    hero('Cours · Administration Windows', 'Scripts PowerShell',
         'Des objets plutôt que du texte, des cmdlets Verbe-Nom, un premier script avec paramètres, '
         'tests et journal — et les cinq scripts qu’un technicien écrit vraiment.'),
    STYLE,
    note('gray', '📚 Avant ce cours',
         '<a href="/pages/cmd-et-powershell">L’invite de commandes &amp; PowerShell</a> pour les commandes '
         'de base. Ici on écrit des <em>scripts</em> : des fichiers <code>.ps1</code> qu’on rejoue.'),
    '<p>Sous Windows, tout ce qui se fait deux fois se script en PowerShell : créer trente comptes, '
    'vérifier l’espace disque de dix serveurs, installer un logiciel sur tout le parc, sortir un '
    'inventaire. Le REAC 2026 en fait une compétence à part (n° 8) et l’épreuve la mesure : un script '
    'à produire ou à améliorer, testé, documenté.</p>',

    '<h2>1) Ce qui change par rapport à Bash : les objets</h2>',
    '<p>En Bash, une commande sort du <strong>texte</strong> qu’on découpe avec <code>grep</code>, '
    '<code>cut</code>, <code>awk</code>. En PowerShell, une cmdlet sort des <strong>objets</strong> avec '
    'des propriétés nommées : on filtre, trie et affiche sans jamais parser.</p>',
    cmd('Get-Service | Where-Object Status -eq "Stopped" | Where-Object StartType -eq "Automatic" | Select-Object Name, DisplayName\n'
        '#           │                                                                              └ ne garder que ces propriétés\n'
        '#           └ chaque service est un objet : .Name, .Status, .StartType…'),
    tab(['Besoin', 'Cmdlet', 'Alias courant'], [
        ['Voir les propriétés d’un objet', '<code>Get-Member</code>', '<code>gm</code>'],
        ['Filtrer', '<code>Where-Object</code>', '<code>?</code>, <code>where</code>'],
        ['Choisir des propriétés', '<code>Select-Object</code>', '<code>select</code>'],
        ['Trier', '<code>Sort-Object</code>', '<code>sort</code>'],
        ['Boucler', '<code>ForEach-Object</code>', '<code>%</code>, <code>foreach</code>'],
        ['Afficher en tableau / liste', '<code>Format-Table</code>, <code>Format-List</code>', '<code>ft</code>, <code>fl</code>'],
        ['Exporter', '<code>Export-Csv</code>, <code>ConvertTo-Json</code>, <code>Out-File</code>', ''],
        ['Chercher une cmdlet', '<code>Get-Command *-Service</code>, <code>Get-Help Get-Service -Examples</code>', ''],
    ]),
    note('blue', '💡 Verbe-Nom',
         'Toutes les cmdlets suivent <code>Verbe-Nom</code> avec des verbes normalisés : Get, Set, New, '
         'Remove, Start, Stop, Test, Import, Export. On devine <code>Get-ADUser</code>, '
         '<code>New-ADUser</code>, <code>Set-ADUser</code>, <code>Remove-ADUser</code> sans les avoir '
         'appris.'),

    '<h2>2) Windows PowerShell 5.1 ou PowerShell 7 ?</h2>',
    tab(['', 'Windows PowerShell 5.1', 'PowerShell 7'], [
        ['Où', 'Intégré à Windows (<code>powershell.exe</code>)', 'À installer (<code>pwsh.exe</code>), aussi sur Linux et macOS'],
        ['Modules', 'Tous les modules Windows (AD, GPO, Hyper-V…)', 'Presque tous, via compatibilité'],
        ['Pour l’examen', 'Toujours disponible sur un Windows Server', 'Plus moderne, parallélisme (<code>ForEach-Object -Parallel</code>)'],
        ['Éditeur', 'ISE (livré, mais figé)', '<strong>VS Code</strong> + extension PowerShell : le standard'],
    ]),

    '<h2>3) La stratégie d’exécution</h2>',
    '<p>Par défaut, Windows refuse de lancer les scripts : <em>« l’exécution de scripts est désactivée '
    'sur ce système »</em>. Ce n’est pas une sécurité contre les attaquants (contournable en une '
    'option), c’est un garde-fou contre le double-clic accidentel.</p>',
    cmd('Get-ExecutionPolicy -List\n'
        'Set-ExecutionPolicy RemoteSigned -Scope CurrentUser   # scripts locaux OK, scripts téléchargés signés seulement\n'
        '# en entreprise : fixé par GPO (Configuration ordinateur › Modèles d’administration › Windows PowerShell)\n'
        '# AllSigned + certificat de la PKI interne pour les serveurs sensibles : voir /pages/pki-adcs'),

    '<h2>4) Un premier script, complet</h2>',
    '<p>Espace disque de plusieurs serveurs, avec alerte sous un seuil :</p>',
    cmd('<#\n'
        '.SYNOPSIS   Vérifie l’espace disque libre de serveurs et signale ceux sous le seuil.\n'
        '.EXAMPLE    .\\Test-EspaceDisque.ps1 -Serveurs SRV-FIC01,SRV-AD01 -SeuilPourcent 15\n'
        '.NOTES      Auteur : support IT — 2026-09 — v1.1 (journal ajouté)\n'
        '#>\n'
        '[CmdletBinding()]\n'
        'param(\n'
        '    [Parameter(Mandatory)] [string[]] $Serveurs,\n'
        '    [ValidateRange(1, 99)] [int] $SeuilPourcent = 10,\n'
        '    [string] $Journal = "C:\\Scripts\\logs\\espace-disque.log"\n'
        ')\n'
        '\n'
        'function Write-Log {\n'
        '    param([string] $Message)\n'
        '    "$(Get-Date -Format \'yyyy-MM-dd HH:mm:ss\') $Message" | Tee-Object -FilePath $Journal -Append\n'
        '}\n'
        '\n'
        '$alertes = foreach ($srv in $Serveurs) {\n'
        '    try {\n'
        '        $disques = Get-CimInstance Win32_LogicalDisk -ComputerName $srv -Filter "DriveType=3" -ErrorAction Stop\n'
        '        foreach ($d in $disques) {\n'
        '            $libre = [math]::Round($d.FreeSpace / $d.Size * 100, 1)\n'
        '            if ($libre -lt $SeuilPourcent) {\n'
        '                [pscustomobject]@{ Serveur = $srv; Lecteur = $d.DeviceID; LibrePourcent = $libre }\n'
        '            }\n'
        '        }\n'
        '    }\n'
        '    catch { Write-Log "ERREUR $srv : $($_.Exception.Message)" }\n'
        '}\n'
        '\n'
        'if ($alertes) {\n'
        '    $alertes | Format-Table -AutoSize\n'
        '    $alertes | ForEach-Object { Write-Log "ALERTE $($_.Serveur) $($_.Lecteur) : $($_.LibrePourcent) % libre" }\n'
        '    exit 1\n'
        '}\n'
        'Write-Log "OK : $($Serveurs.Count) serveur(s) au-dessus de $SeuilPourcent %"'),
    tab(['Élément', 'Pourquoi il est là'], [
        ['Bloc <code>&lt;# .SYNOPSIS … #&gt;</code>', 'La documentation intégrée : <code>Get-Help .\\Test-EspaceDisque.ps1</code> l’affiche'],
        ['<code>[CmdletBinding()]</code> + <code>param()</code>', 'Le script se comporte comme une cmdlet : <code>-Verbose</code>, <code>-ErrorAction</code>, validation des paramètres'],
        ['<code>Mandatory</code>, <code>ValidateRange</code>', 'Le script refuse de tourner sans serveur, ou avec un seuil absurde — avant de faire quoi que ce soit'],
        ['<code>try / catch</code> avec <code>-ErrorAction Stop</code>', 'Un serveur injoignable ne fait pas planter la boucle : il est journalisé, on passe au suivant'],
        ['<code>[pscustomobject]</code>', 'Le script produit des <strong>objets</strong>, exploitables par un autre script (<code>| Export-Csv</code>)'],
        ['<code>exit 1</code>', 'Le code de retour : le planificateur ou la supervision sauront que ça a échoué'],
    ]),

    '<h2>5) Tester sans casser</h2>',
    bullets('<code>-WhatIf</code> : toute cmdlet qui modifie quelque chose (<code>Remove-Item</code>, <code>New-ADUser</code>, <code>Stop-Service</code>) sait dire ce qu’elle <em>ferait</em>. Ajouter <code>[CmdletBinding(SupportsShouldProcess)]</code> et <code>if ($PSCmdlet.ShouldProcess($cible, "supprimer"))</code> pour que ton script le supporte aussi.',
            '<code>-Verbose</code> et <code>Write-Verbose "…"</code> : une trace détaillée à la demande, silencieuse sinon.',
            'Un jeu de test : deux comptes dans une UO « Test », un CSV de trois lignes, une VM de laboratoire — jamais le premier essai en production.',
            '<code>Invoke-ScriptAnalyzer .\\script.ps1</code> (module PSScriptAnalyzer) : l’équivalent de shellcheck.',
            'Le point d’arrêt dans VS Code (F9, F5) pour regarder les variables en cours d’exécution.'),
    note('red', '🚨 Les erreurs silencieuses',
         'Par défaut, une erreur <em>non</em> bloquante affiche du rouge et continue. Dans un script de '
         'suppression, c’est dangereux : <code>$ErrorActionPreference = "Stop"</code> en tête, ou '
         '<code>-ErrorAction Stop</code> sur chaque cmdlet critique, pour qu’une erreur arrête le script '
         'et tombe dans le <code>catch</code>.'),

    '<h2>6) Cinq scripts du quotidien</h2>',
    acc(
        ('Créer des comptes AD depuis un CSV',
         cmd('Import-Csv .\\arrivees.csv -Delimiter ";" | ForEach-Object {\n'
             '    $login = ($_.Prenom.Substring(0,1) + $_.Nom).ToLower()\n'
             '    if (Get-ADUser -Filter "SamAccountName -eq \'$login\'") { Write-Warning "$login existe déjà"; return }\n'
             '    $mdp = ConvertTo-SecureString (-join ((48..57 + 65..90 + 97..122) | Get-Random -Count 14 | % {[char]$_})) -AsPlainText -Force\n'
             '    New-ADUser -Name "$($_.Prenom) $($_.Nom)" -SamAccountName $login -UserPrincipalName "$login@entreprise.fr" `\n'
             '        -Path $_.UO -Department $_.Service -AccountPassword $mdp -ChangePasswordAtLogon $true -Enabled $true -WhatIf\n'
             '}') + '<p>Le <code>-WhatIf</code> se retire quand le résultat à blanc est le bon. Voir '
         '<a href="/pages/cycle-vie-compte">Le cycle de vie d’un compte</a>.</p>'),
        ('Inventaire du parc',
         cmd('Get-ADComputer -Filter "OperatingSystem -like \'*Windows 1*\'" -Properties OperatingSystem, LastLogonDate |\n'
             '    Select-Object Name, OperatingSystem, LastLogonDate |\n'
             '    Sort-Object LastLogonDate |\n'
             '    Export-Csv .\\parc.csv -NoTypeInformation -Encoding UTF8 -Delimiter ";"') +
         '<p>Ou, poste par poste : <code>Get-CimInstance Win32_ComputerSystem, Win32_BIOS, Win32_OperatingSystem</code> '
         'pour modèle, numéro de série, version.</p>'),
        ('Exécuter à distance sur dix serveurs',
         cmd('$srv = "SRV-FIC01","SRV-AD01","SRV-WEB01"\n'
             'Invoke-Command -ComputerName $srv -ScriptBlock {\n'
             '    Get-Service Spooler | Select-Object PSComputerName, Status\n'
             '}\n'
             '# WinRM doit être activé (Enable-PSRemoting, ou par GPO) ; port 5985/5986') +
         '<p>PowerShell Remoting est le SSH de Windows : une session, des commandes, des objets qui reviennent.</p>'),
        ('Nettoyer les journaux et fichiers temporaires',
         cmd('$limite = (Get-Date).AddDays(-30)\n'
             'Get-ChildItem "D:\\Logs" -Recurse -File -Filter *.log |\n'
             '    Where-Object LastWriteTime -lt $limite |\n'
             '    Remove-Item -Verbose -WhatIf') +
         '<p>Toujours le <code>-WhatIf</code> d’abord : un chemin mal tapé et c’est un autre dossier qui part.</p>'),
        ('Surveiller un service et le relancer',
         cmd('$s = Get-Service -Name "Spooler"\n'
             'if ($s.Status -ne "Running") {\n'
             '    Start-Service $s\n'
             '    Write-EventLog -LogName Application -Source "Scripts IT" -EventId 1001 -EntryType Warning -Message "Spooler relancé"\n'
             '}\n'
             '# Source à créer une fois : New-EventLog -LogName Application -Source "Scripts IT"') +
         '<p>Lancé toutes les cinq minutes par le <a href="/pages/planificateur-taches-windows">Planificateur de tâches</a> ; '
         'l’événement remonte dans la <a href="/pages/supervision">supervision</a>.</p>'),
    ),

    '<h2>7) Les modules à connaître</h2>',
    tab(['Module', 'Pour', 'S’obtient'], [
        ['<code>ActiveDirectory</code>', 'Comptes, groupes, UO, ordinateurs', 'RSAT (fonctionnalité Windows) ou sur un DC'],
        ['<code>GroupPolicy</code>', '<code>Get-GPO</code>, <code>Backup-GPO</code>, <code>New-GPLink</code>', 'RSAT'],
        ['<code>Hyper-V</code>', '<code>New-VM</code>, <code>Checkpoint-VM</code>, <code>Export-VM</code>', 'Avec le rôle'],
        ['<code>DnsServer</code>, <code>DhcpServer</code>', 'Zones, enregistrements, étendues, baux', 'RSAT'],
        ['<code>Microsoft.Graph</code>', 'Entra ID, Microsoft 365', '<code>Install-Module Microsoft.Graph</code>'],
        ['<code>PSWindowsUpdate</code>', 'Lancer et suivre Windows Update', 'PowerShell Gallery'],
        ['<code>PSScriptAnalyzer</code>', 'Analyser ses scripts', 'PowerShell Gallery'],
    ]),

    '<h2>8) Documenter, versionner, faire relire</h2>',
    bullets('L’en-tête d’aide (SYNOPSIS, EXAMPLE, NOTES) : version, date, auteur, ce qui a été testé.',
            'Un dépôt Git (<code>C:\\Scripts</code> versionné, ou un dépôt d’équipe) : l’historique répond à « qui a changé quoi ».',
            'Des noms parlants (<code>Test-EspaceDisque.ps1</code>, pas <code>script2.ps1</code>), en Verbe-Nom aussi.',
            'Pas de mot de passe dans le script : <code>Get-Credential</code>, un fichier chiffré par DPAPI (<code>Export-Clixml</code>), ou un compte de service géré (gMSA) pour les tâches planifiées.',
            'L’IA pour relire, proposer, expliquer — puis tester : <a href="/pages/ia-scripts">Optimiser un script avec l’IA</a>.'),

    retenir('PowerShell manipule des <strong>objets</strong> ; <code>Get-Member</code>, <code>Where</code>, <code>Select</code>, <code>Sort</code>, <code>Export-Csv</code> font 80 % du travail.',
            'Un script propre : en-tête d’aide, <code>[CmdletBinding()]</code>, <code>param()</code> validé, <code>try/catch</code>, journal, <code>exit</code> code.',
            '<code>-WhatIf</code>, <code>-Verbose</code>, un jeu de test, PSScriptAnalyzer : on teste avant.',
            'Stratégie d’exécution : RemoteSigned au minimum, AllSigned + PKI sur le sensible.',
            'Pas de secret dans le script ; Git ; l’IA relit, le technicien vérifie.'),
])

# ═══════════════════════════════════════════ Planificateur de tâches ══

SCHED = '\n'.join([
    hero('Cours · Administration Windows', 'Le Planificateur de tâches',
         'Le cron de Windows : déclencheurs, actions, compte d’exécution, options qui font échouer '
         'silencieusement une tâche — et comment vérifier qu’elle a vraiment tourné.'),
    STYLE,
    note('gray', '📚 En parallèle',
         '<a href="/pages/linux-cron-logs">cron et journaux sous Linux</a> : même besoin, même logique.'),
    '<p>Un script qui n’est lancé que quand on y pense ne sert à rien. Le Planificateur de tâches '
    '(<code>taskschd.msc</code>) lance un programme ou un script à une heure, à un événement, à '
    'l’ouverture de session — sur un poste ou sur tout le parc par GPO. Windows lui-même en '
    'contient des dizaines (défragmentation, mises à jour, télémétrie).</p>',

    '<h2>1) Anatomie d’une tâche</h2>',
    tab(['Onglet', 'Ce qu’on y règle', 'Le piège'], [
        ['<strong>Général</strong>', 'Nom, description, <strong>compte d’exécution</strong>, « exécuter même si l’utilisateur n’est pas connecté », « avec les privilèges les plus élevés »', 'Une tâche « seulement si l’utilisateur est connecté » ne tourne pas la nuit'],
        ['<strong>Déclencheurs</strong>', 'Quotidien / hebdomadaire, à l’ouverture de session, au démarrage, <strong>sur un événement</strong>, à l’inactivité ; répétition toutes les N minutes', 'Un déclencheur « au démarrage » sur un serveur qui ne redémarre jamais'],
        ['<strong>Actions</strong>', 'Programme, arguments, <strong>dossier de démarrage</strong>', 'Le script marche à la main, pas planifié : chemin relatif, dossier de démarrage vide'],
        ['<strong>Conditions</strong>', 'Sur secteur seulement, si le réseau est disponible, à l’inactivité', '« Démarrer la tâche seulement si l’ordinateur est sur secteur » — coché par défaut, silencieux sur un portable'],
        ['<strong>Paramètres</strong>', 'Exécuter dès que possible si manquée, relancer en cas d’échec, arrêter après N heures, si déjà en cours…', 'Une tâche de sauvegarde qui se lance en double parce que « exécuter une nouvelle instance en parallèle »'],
    ]),

    '<h2>2) Lancer un script PowerShell : la ligne qui marche</h2>',
    '<p>Neuf tâches sur dix qui « ne font rien » ont une action mal écrite. La forme correcte :</p>',
    cmd('Programme      : C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe\n'
        'Arguments      : -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "C:\\Scripts\\Test-EspaceDisque.ps1" -Serveurs SRV-FIC01,SRV-AD01\n'
        'Commencer dans : C:\\Scripts'),
    bullets('<code>-NoProfile</code> : pas de profil utilisateur à charger (plus rapide, et pas de surprise venant d’un profil).',
            '<code>-NonInteractive</code> : une question posée par le script (<code>Read-Host</code>, confirmation) échoue au lieu d’attendre pour toujours.',
            '<code>-ExecutionPolicy Bypass</code> : pour cette exécution seulement, la stratégie ne bloque pas — le script est le tien, dans un dossier protégé.',
            '<code>-File</code> avec le chemin <strong>entre guillemets</strong> ; les paramètres du script après.',
            'Le dossier <code>C:\\Scripts</code> : modifiable par les administrateurs seulement — sinon n’importe qui remplace le script que SYSTEM exécute.'),

    '<h2>3) Quel compte ?</h2>',
    tab(['Compte', 'Pour', 'Remarque'], [
        ['<strong>SYSTEM</strong>', 'Tout ce qui est local : nettoyage, service à relancer, inventaire', 'Tous les droits locaux, aucun sur le réseau (s’authentifie comme l’ordinateur sur le domaine)'],
        ['<strong>Compte de service géré (gMSA)</strong>', 'Ce qui touche le réseau ou l’AD', 'Mot de passe géré par l’AD, jamais saisi ; la bonne pratique'],
        ['Compte de domaine dédié', 'Idem, sans gMSA', 'Mot de passe stocké par le planificateur ; « ne pas stocker le mot de passe » = pas d’accès réseau ; expiration = tâche morte'],
        ['Ton compte', 'Un test', 'Jamais en production : ton départ ou ton changement de mot de passe casse la tâche'],
    ]),
    note('yellow', '⚠️ « Ouvrir une session en tant que tâche »',
         'Le compte d’exécution doit avoir ce droit (' + menu('secpol.msc › Attribution des droits utilisateur') +
         ') — accordé automatiquement quand on crée la tâche avec la console, à donner par GPO quand on la '
         'déploie en masse.'),

    '<h2>4) En PowerShell, et par GPO</h2>',
    cmd('$action  = New-ScheduledTaskAction -Execute "powershell.exe" `\n'
        '             -Argument \'-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "C:\\Scripts\\Watch-Spooler.ps1"\' -WorkingDirectory "C:\\Scripts"\n'
        '$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5)\n'
        '$set     = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew\n'
        'Register-ScheduledTask -TaskName "IT\\Surveiller Spooler" -Action $action -Trigger $trigger -Settings $set -User "SYSTEM" -RunLevel Highest\n'
        '\n'
        'Get-ScheduledTask -TaskPath "\\IT\\" | Get-ScheduledTaskInfo | Select TaskName, LastRunTime, LastTaskResult, NextRunTime'),
    '<p>Pour tout le parc : ' + menu('GPO › Configuration ordinateur › Préférences › Paramètres du Panneau de configuration › Tâches planifiées') +
    ' — une tâche définie une fois, déployée sur tous les postes de l’UO, avec le script sur un partage '
    'en lecture seule (<code>\\\\srv-fic01\\scripts$\\…</code>) et un compte gMSA.</p>',

    '<h2>5) A-t-elle vraiment tourné ?</h2>',
    tab(['Où regarder', 'Ce qu’on lit'], [
        ['Console, colonnes « Dernière exécution » et « Dernier résultat »', '<code>0x0</code> = succès ; <code>0x1</code> = le script a fini en erreur ; <code>0x41301</code> = en cours ; <code>0x41303</code> = jamais lancée'],
        [menu('Observateur d’événements › Journaux des applications et services › Microsoft › Windows › TaskScheduler › Operational'), 'Chaque lancement, fin, échec ; à activer s’il est désactivé (clic droit › Activer le journal)'],
        ['Le journal du script lui-même', 'C’est pour ça qu’un script écrit un log : sans lui, on sait qu’il a été lancé, pas ce qu’il a fait'],
        ['<code>Get-ScheduledTaskInfo</code>', 'LastTaskResult pour toutes les tâches d’un coup, sur plusieurs serveurs avec <code>Invoke-Command</code>'],
    ]),
    tab(['Code', 'Sens', 'Cause fréquente'], [
        ['<code>0x1</code>', 'Fonction incorrecte', 'Le script a retourné 1 (souvent volontaire : <code>exit 1</code>), ou n’a pas été trouvé'],
        ['<code>0x2</code>', 'Fichier introuvable', 'Chemin de l’action ou du dossier de démarrage'],
        ['<code>0x80070005</code>', 'Accès refusé', 'Le compte n’a pas le droit sur le fichier, le partage, ou « ouvrir une session en tant que tâche »'],
        ['<code>0x800710E0</code>', 'L’opérateur a refusé la demande', '« Exécuter seulement si l’utilisateur est connecté » et personne ne l’est'],
        ['<code>0x8007052E</code>', 'Nom ou mot de passe incorrect', 'Le mot de passe du compte a changé'],
    ]),

    '<h2>6) Déclencher sur un événement</h2>',
    '<p>Un déclencheur « sur un événement » lance une action quand un identifiant apparaît dans un '
    'journal : l’ID 6008 (arrêt inattendu) envoie un mail, l’ID 4740 (compte verrouillé) écrit dans le '
    'ticketing, l’ID 1074 trace qui a redémarré le serveur. C’est une supervision minimale sans '
    'serveur de supervision — et le complément de <a href="/pages/supervision">Zabbix</a>, pas son '
    'remplaçant.</p>',
    cmd('Déclencheur : Lors d’un événement — Journal : Système — Source : EventLog — ID : 6008\n'
        'Action      : powershell.exe -NoProfile -File "C:\\Scripts\\Send-AlerteArret.ps1"'),

    '<h2>7) Ce que Windows planifie déjà</h2>',
    bullets('' + menu('Bibliothèque › Microsoft › Windows') + ' : des centaines de tâches système. On ne les supprime pas ; on désactive celles qu’une PSSI cite (télémétrie, par exemple), par GPO.',
            'Une tâche inconnue dans la racine de la bibliothèque, qui lance un <code>.vbs</code> ou un PowerShell encodé (<code>-enc …</code>) : c’est un des mécanismes de persistance des logiciels malveillants. À examiner, pas à ignorer.',
            '<code>Get-ScheduledTask | Where-Object { $_.TaskPath -eq "\\" } | Select TaskName, State, Author</code> : ce qui n’est pas à Microsoft.'),

    retenir('Une tâche = <strong>compte</strong> + <strong>déclencheur</strong> + <strong>action</strong> + conditions + paramètres ; chaque onglet a son piège.',
            'Action PowerShell : <code>powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "…"</code> + dossier de démarrage.',
            'SYSTEM pour le local, <strong>gMSA</strong> pour le réseau ; jamais un compte personnel.',
            'Vérifier : dernier résultat (<code>0x0</code>), journal TaskScheduler/Operational, le log du script.',
            'Déploiement par GPO (préférences), script sur un partage en lecture seule ; les tâches inconnues à la racine se regardent de près.'),
])

PAGES = [
    ('scripts-powershell', 'Scripts PowerShell',
     'Objets et cmdlets, stratégie d’exécution, un script complet (param, try/catch, journal, code de retour), tests (-WhatIf, PSScriptAnalyzer), cinq scripts du quotidien, modules.',
     PS, 'Administration Windows',
     'Objets et Verbe-Nom, un script complet et propre, tester sans casser, cinq scripts du quotidien, modules AD/GPO/Hyper-V.'),
    ('planificateur-taches-windows', 'Le Planificateur de tâches',
     'Déclencheurs, actions, compte d’exécution (SYSTEM, gMSA), la ligne PowerShell qui marche, création par PowerShell et par GPO, codes de résultat, déclencheur sur événement.',
     SCHED, 'Administration Windows',
     'Le cron de Windows : onglets et pièges, la ligne PowerShell correcte, gMSA, vérifier qu’une tâche a tourné, GPO.'),
]

LOTS = [(PAGES, SOFT)]

if __name__ == '__main__':
    for pages, cat in LOTS:
        publier_lot(pages, cat)
    sys.exit(0)

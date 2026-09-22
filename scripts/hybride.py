# -*- coding: utf-8 -*-
"""
Chantier P1 du comparatif REAC 2026 : identité hybride, cloud, virtualisation.

Les compétences 5 (Entra ID), 6 (virtualisé / cloud, datacenter) et 7 (accès
sécurisés dans un environnement hybride, PKI, zero trust, cycle de vie des
comptes) n'avaient que Hyper-V et l'AD local. Sept cours dans une catégorie
neuve « Cloud & identité hybride », plus Docker et Proxmox rangés dans
Software › Virtualisation, à côté d'Hyper-V.

IDEMPOTENT.
"""
import sys

from _cours import (Categorie, STYLE, acc, bullets, cmd, hero, menu, note, publier_lot, retenir, steps, tab)

CAT = Categorie('cat-cloud', '☁️', 'Cloud &amp; identité hybride',
                'Entra ID, MFA, zero trust, PKI, premiers pas dans le cloud et dans un datacenter.', '#0284c7')
SOFT = Categorie('cat-software', '💿', 'Software', '', '#2563eb')

# ═══════════════════════════════════════════════════════════ Entra ID ══

ENTRA = '\n'.join([
    hero('Cours · Identité hybride', 'Entra ID : l’annuaire dans le cloud',
         'Ce qu’est un tenant, comment les comptes de l’AD local se synchronisent avec Entra Connect, '
         'et ce que change l’hybride pour le technicien.'),
    STYLE,
    note('gray', '📚 Avant ce cours',
         '<a href="/pages/roles-windows-server">Active Directory</a> et '
         '<a href="/pages/procedure-ad-objets">UO, groupes et utilisateurs</a> : Entra ID est l’autre '
         'moitié d’un annuaire que tu connais déjà.'),
    '<p>Microsoft Entra ID (ex-Azure Active Directory) est le service d’identité du cloud Microsoft. '
    'Dès qu’une organisation utilise Microsoft 365, elle a un Entra ID — souvent sans le savoir. Le '
    'REAC 2026 le nomme explicitement dans la compétence 5 : « configurer et administrer un service '
    'd’annuaire (AD DS / Entra ID) ». Concrètement, un technicien gère aujourd’hui des comptes '
    'qui vivent <strong>aux deux endroits</strong>.</p>',

    '<h2>1) Ce qu’Entra ID n’est pas</h2>',
    tab(['', 'Active Directory (AD DS)', 'Entra ID'], [
        ['Où', 'Sur tes contrôleurs de domaine', 'Chez Microsoft, dans un <strong>tenant</strong>'],
        ['Structure', 'Domaine, forêt, UO, arborescence', 'Plat : utilisateurs, groupes, applications — pas d’UO'],
        ['Authentification', 'Kerberos, NTLM', 'Protocoles web : OAuth 2, OpenID Connect, SAML'],
        ['Stratégies', 'GPO', 'Pas de GPO : Intune (MDM) et accès conditionnel'],
        ['Machines', 'Jointes au domaine', '« Jointes à Entra » ou « hybrides »'],
        ['Administration', 'Console ADUC, PowerShell AD', 'Portail entra.microsoft.com, module Microsoft.Graph'],
    ]),
    note('yellow', '⚠️ Pas de « lift and shift »',
         'On ne migre pas un AD vers Entra ID : ce sont deux annuaires de nature différente, qui '
         '<strong>coexistent</strong>. Une GPO n’existe pas dans Entra ; un partage de fichiers '
         'authentifié en Kerberos a besoin de l’AD. L’hybride est l’état normal de la plupart des '
         'organisations, pas une transition.'),

    '<h2>2) Le tenant</h2>',
    '<p>Un tenant est l’instance Entra ID d’une organisation : un identifiant unique, un domaine '
    'initial <code>entreprise.onmicrosoft.com</code>, et les domaines personnalisés vérifiés '
    '(<code>entreprise.fr</code>, prouvé par un enregistrement TXT dans le DNS public). Tout y est '
    'rattaché : utilisateurs, groupes, appareils, applications, licences, abonnements Azure.</p>',
    tab(['Objet', 'Rôle', 'Où le voir'], [
        ['Utilisateur', 'Une identité : membre (de l’organisation) ou invité (B2B, d’un autre tenant)', menu('Identité › Utilisateurs')],
        ['Groupe', 'Sécurité (droits, accès) ou Microsoft 365 (boîte partagée, Teams, SharePoint) ; statique ou dynamique (règle sur les attributs)', menu('Identité › Groupes')],
        ['Appareil', 'Un poste enregistré, joint à Entra ou hybride', menu('Identité › Appareils')],
        ['Application d’entreprise', 'Un service en SSO : Salesforce, un intranet, une appli maison', menu('Identité › Applications')],
        ['Rôle', 'Administrateur général, des utilisateurs, du support technique…', menu('Identité › Rôles et administrateurs')],
        ['Licence', 'Ce à quoi l’utilisateur a droit : M365 E3, Entra ID P1/P2…', menu('Facturation › Licences')],
    ]),

    '<h2>3) Entra Connect : synchroniser l’AD vers le cloud</h2>',
    '<p>Microsoft Entra Connect (ou sa version allégée, Cloud Sync) s’installe sur un serveur membre '
    'du domaine et <strong>pousse</strong> les objets de l’AD vers le tenant, toutes les 30 minutes. '
    'Le compte est créé dans l’AD, il apparaît dans Entra : c’est la règle. La source d’autorité '
    'reste l’AD local ; un objet synchronisé ne se modifie pas dans le portail (les champs sont '
    'grisés).</p>',
    steps('Vérifier le domaine dans le tenant, et que l’UPN des utilisateurs (<code>prenom.nom@entreprise.fr</code>) correspond à un domaine vérifié — sinon ils arrivent en <code>onmicrosoft.com</code>.',
          'Passer <strong>IdFix</strong> sur l’AD : caractères interdits, doublons de proxyAddresses, UPN invalides.',
          'Installer Entra Connect sur un serveur membre (pas sur un DC en production idéalement), avec un compte d’administrateur général du tenant et un compte AD à droits de réplication.',
          'Choisir la méthode d’authentification (ci-dessous) et <strong>filtrer</strong> : seules les UO à synchroniser — jamais les comptes de service, jamais les UO techniques.',
          'Première synchronisation, puis contrôle : <code>Start-ADSyncSyncCycle -PolicyType Delta</code>, et le journal dans ' + menu('Synchronization Service Manager') + '.'),
    tab(['Méthode', 'Où le mot de passe est vérifié', 'Pour qui'], [
        ['<strong>Synchronisation de hachage (PHS)</strong>', 'Dans Entra, sur un hachage du hachage', 'La majorité : simple, résiliente si l’AD tombe'],
        ['<strong>Authentification directe (PTA)</strong>', 'Sur l’AD, via un agent', 'Les organisations qui refusent tout hachage dans le cloud'],
        ['<strong>Fédération (AD FS)</strong>', 'Sur une ferme AD FS locale', 'Cas particuliers : carte à puce, exigences légales'],
    ]),
    note('blue', '💡 Le mot de passe unique',
         'Avec PHS, un utilisateur ouvre sa session Windows, Outlook, Teams et son intranet en SSO '
         'avec le même mot de passe — et un changement dans l’AD arrive dans le cloud en deux '
         'minutes. C’est ce que les utilisateurs appellent « ça marche », et c’est ce que le '
         'technicien doit savoir dépanner.'),

    '<h2>4) Les postes : joint au domaine, à Entra, ou les deux</h2>',
    tab(['État', 'Ce que ça veut dire', 'Quand'], [
        ['Joint au domaine AD', 'Classique : GPO, Kerberos, profil itinérant', 'Postes fixes dans le réseau de l’entreprise'],
        ['<strong>Joint hybride</strong> (Hybrid Azure AD Join)', 'Joint à l’AD <em>et</em> enregistré dans Entra : GPO + accès conditionnel + Intune', 'Le parc existant qui doit profiter du cloud'],
        ['<strong>Joint à Entra</strong> (Entra Join)', 'Aucun AD : ouverture de session avec le compte cloud, gestion par Intune', 'Nouveaux postes, télétravail, organisations sans AD'],
        ['Enregistré', 'Un appareil personnel (BYOD) connu du tenant, sans y être joint', 'Téléphones, portables personnels'],
    ]),
    cmd('dsregcmd /status\n'
        '  AzureAdJoined : YES\n'
        '  DomainJoined  : YES     <- les deux : joint hybride\n'
        '  TenantName    : Entreprise'),

    '<h2>5) Administrer au quotidien</h2>',
    tab(['Tâche', 'Où', 'Point d’attention'], [
        ['Réinitialiser un mot de passe', 'Dans l’AD (compte synchronisé) — avec la réécriture activée, aussi depuis le portail', 'Un compte synchronisé modifié dans le portail : champs grisés, c’est normal'],
        ['Créer un compte cloud seul', menu('Utilisateurs › Nouvel utilisateur'), 'Pour un prestataire ou un compte technique cloud ; il n’existera pas dans l’AD'],
        ['Donner une licence', 'Par groupe (licence de groupe) plutôt qu’à la main', 'Une licence retirée = boîte mail en sursis 30 jours'],
        ['Déléguer', 'Rôles Entra : « administrateur du support technique » pour réinitialiser les mots de passe, sans être administrateur général', 'Le moins de rôles possible, activés à la demande (PIM avec P2)'],
        ['Voir qui s’est connecté', menu('Surveillance › Journaux de connexion'), 'IP, appareil, application, résultat de l’accès conditionnel'],
    ]),
    cmd('# PowerShell — module Microsoft.Graph\n'
        'Connect-MgGraph -Scopes "User.Read.All","Group.ReadWrite.All"\n'
        'Get-MgUser -Filter "startsWith(userPrincipalName,\'jean\')" | Select DisplayName, UserPrincipalName, AccountEnabled\n'
        'Get-MgUserMemberOf -UserId jean.dupont@entreprise.fr | Select -Expand AdditionalProperties'),

    '<h2>6) Ce qui casse, et par où commencer</h2>',
    acc(
        ('« Mon mot de passe marche sur le PC mais pas sur Outlook »',
         '<p>Le mot de passe vient d’être changé et la synchronisation n’est pas passée (délai PHS ~2 min, '
         'ou Entra Connect arrêté). Vérifier le service <code>ADSync</code> et forcer un cycle delta.</p>'),
        ('« L’utilisateur n’apparaît pas dans le portail »',
         '<p>Son UO n’est pas dans le filtre de synchronisation, ou IdFix aurait signalé son UPN. Regarder '
         'l’erreur d’export dans Synchronization Service Manager.</p>'),
        ('« Il est en @entreprise.onmicrosoft.com »',
         '<p>Son UPN AD porte un suffixe non vérifié (<code>.local</code>). Ajouter le suffixe UPN dans '
         + menu('Domaines et approbations AD') + ' et le changer sur le compte.</p>'),
        ('« Le PC dit "Votre organisation a besoin de plus d’informations" »',
         '<p>L’accès conditionnel exige un enregistrement MFA ou un appareil conforme : voir '
         '<a href="/pages/mfa-acces-conditionnel">MFA et accès conditionnel</a>.</p>'),
    ),

    retenir('Entra ID est l’annuaire <strong>cloud</strong> ; l’AD reste l’annuaire <strong>local</strong> ; l’hybride est l’état normal.',
            'Le <strong>tenant</strong> porte utilisateurs, groupes, appareils, applications, licences, rôles.',
            '<strong>Entra Connect</strong> synchronise l’AD vers Entra ; la source d’autorité reste l’AD ; PHS pour la plupart.',
            'Un poste peut être joint au domaine, <strong>hybride</strong>, ou joint à Entra ; <code>dsregcmd /status</code> le dit.',
            'Les pannes classiques : délai de synchro, UO filtrée, suffixe UPN non vérifié, accès conditionnel.'),
    note('green', '🔗 La suite',
         '<a href="/pages/mfa-acces-conditionnel">MFA et accès conditionnel</a> · '
         '<a href="/pages/cycle-vie-compte">Le cycle de vie d’un compte</a> · '
         '<a href="/pages/microsoft-365-teams">Microsoft 365 et Teams</a>.'),
])

# ══════════════════════════════════════════════ MFA & accès conditionnel ══

MFA = '\n'.join([
    hero('Cours · Identité hybride', 'MFA et accès conditionnel',
         'Pourquoi un mot de passe ne suffit plus, quelles méthodes proposer aux utilisateurs, et '
         'comment une stratégie d’accès conditionnel décide qui entre, d’où, avec quoi.'),
    STYLE,
    '<p>Le mot de passe est le maillon faible : réutilisé, deviné, volé par hameçonnage. '
    'L’<strong>authentification multifacteur</strong> (MFA) ajoute une preuve que l’attaquant n’a '
    'pas — un téléphone, une clé, une empreinte. Microsoft chiffre à plus de 99 % la réduction des '
    'compromissions de comptes une fois la MFA activée. Le REAC 2026 en fait une compétence à part '
    'entière (« sécuriser les accès dans un environnement hybride »).</p>',

    '<h2>1) Les trois facteurs</h2>',
    tab(['Facteur', 'Exemple', 'Ce qu’un attaquant doit voler'], [
        ['Ce que je <strong>sais</strong>', 'Mot de passe, code PIN', 'Une information — la plus facile à voler'],
        ['Ce que je <strong>possède</strong>', 'Téléphone (Authenticator), clé FIDO2, carte à puce', 'Un objet physique'],
        ['Ce que je <strong>suis</strong>', 'Empreinte, visage (Windows Hello)', 'Une biométrie, stockée localement dans le TPM'],
    ]),
    '<p>Multifacteur = au moins deux facteurs <em>de nature différente</em>. Deux mots de passe ne '
    'font pas une MFA.</p>',

    '<h2>2) Les méthodes, de la moins à la plus robuste</h2>',
    tab(['Méthode', 'Robustesse', 'Remarque'], [
        ['SMS / appel vocal', 'Faible', 'Interception, échange de carte SIM ; à réserver au secours'],
        ['Code à usage unique (TOTP) dans une application', 'Moyenne', 'Peut être saisi sur un faux site (hameçonnage en temps réel)'],
        ['Notification Authenticator avec <strong>correspondance de nombre</strong>', 'Bonne', 'L’utilisateur tape le nombre affiché : fin de la « fatigue MFA » (accepter par réflexe)'],
        ['<strong>Windows Hello Entreprise</strong>', 'Forte', 'PIN ou biométrie liés au TPM du poste ; rien ne circule'],
        ['<strong>Clé FIDO2 / passkey</strong>', 'Forte, résistante à l’hameçonnage', 'La clé signe pour le vrai domaine seulement — un faux site n’obtient rien'],
        ['Certificat (carte à puce)', 'Forte', 'Demande une PKI : voir <a href="/pages/pki-adcs">PKI et AD CS</a>'],
    ]),
    note('red', '🚨 Résistant à l’hameçonnage : le mot qui compte',
         'Un code TOTP se donne à un faux site. Une clé FIDO2 ou Windows Hello ne le peuvent pas : la '
         'preuve est liée à l’origine (le vrai nom de domaine). L’ANSSI comme Microsoft poussent vers '
         'ces méthodes pour les administrateurs d’abord.'),

    '<h2>3) Activer la MFA dans Entra ID</h2>',
    tab(['Approche', 'Où', 'Pour qui'], [
        ['<strong>Paramètres de sécurité par défaut</strong>', menu('Identité › Vue d’ensemble › Propriétés'), 'Petite organisation sans licence P1 : MFA pour tous, protocoles hérités bloqués, aucun réglage'],
        ['<strong>Accès conditionnel</strong>', menu('Protection › Accès conditionnel'), 'Avec Entra ID P1 (inclus dans M365 Business Premium, E3) : des règles fines'],
        ['MFA « par utilisateur » (héritée)', 'Portail MFA', 'À ne plus utiliser : Microsoft la retire'],
    ]),
    '<p>Les méthodes autorisées se choisissent dans ' + menu('Protection › Méthodes d’authentification') +
    ' : on active Authenticator (avec correspondance de nombre), FIDO2, on laisse SMS désactivé ou en '
    'secours seulement.</p>',

    '<h2>4) L’accès conditionnel : « si… alors »</h2>',
    '<p>Une stratégie d’accès conditionnel est une phrase : <em>si</em> tel utilisateur accède à telle '
    'application, depuis tel endroit, avec tel appareil, <em>alors</em> on exige (ou on bloque) telle '
    'chose. Elle s’évalue à chaque connexion, après le mot de passe.</p>',
    tab(['Condition (si…)', 'Exemples'], [
        ['Utilisateurs / groupes', 'Tous, un groupe « Administrateurs », les invités'],
        ['Applications', 'Toutes les applications cloud, Exchange Online, une appli précise'],
        ['Emplacement', 'IP publiques du siège (« emplacement nommé »), un pays'],
        ['Plateforme et état de l’appareil', 'Windows / iOS / Android ; joint hybride ; conforme dans Intune'],
        ['Risque (P2)', 'Connexion à risque (voyage impossible, IP anonyme), utilisateur à risque'],
        ['Application cliente', 'Navigateur, client mobile, protocoles hérités (POP, IMAP, SMTP basique)'],
    ]),
    tab(['Contrôle (alors…)', 'Effet'], [
        ['Exiger la MFA', 'Le contrôle le plus courant'],
        ['Exiger une force d’authentification', 'Par exemple « résistante à l’hameçonnage » pour les admins'],
        ['Exiger un appareil conforme ou joint hybride', 'Pas d’accès depuis un PC inconnu'],
        ['Bloquer', 'Protocoles hérités, pays non attendus'],
        ['Fréquence de connexion', 'Redemander la MFA toutes les 12 h sur les postes non gérés'],
    ]),
    '<h3>Les stratégies qu’on met partout</h3>',
    steps('<strong>MFA pour tous les utilisateurs</strong>, toutes les applications — sauf le compte de secours.',
          '<strong>Authentification résistante à l’hameçonnage pour les rôles d’administration</strong>.',
          '<strong>Bloquer les protocoles hérités</strong> : ils ne savent pas faire de MFA, c’est la porte de service des attaquants.',
          '<strong>Appareil conforme ou hybride exigé</strong> pour les données sensibles (SharePoint, Exchange) depuis l’extérieur.',
          '<strong>Bloquer les pays</strong> d’où personne ne travaille — tout en sachant qu’un VPN les contourne.'),
    note('yellow', '⚠️ Mode « rapport seul » d’abord',
         'Une stratégie se crée en <strong>Report-only</strong> : on regarde dans les journaux de connexion '
         'ce qu’elle <em>aurait</em> fait pendant quelques jours, puis on l’active. Une stratégie qui '
         'bloque tout le monde y compris les administrateurs, c’est un incident de niveau ticket '
         'Microsoft.'),
    note('red', '🚨 Le compte de secours (break glass)',
         'Deux comptes cloud, administrateur général, <strong>exclus de toute stratégie</strong>, avec un '
         'mot de passe très long conservé hors ligne (coffre, enveloppe), surveillés (une alerte à '
         'chaque connexion). Si l’accès conditionnel, la MFA ou l’AD tombe, c’est la seule porte.'),

    '<h2>5) Au support : les cas de tous les jours</h2>',
    acc(
        ('Nouveau téléphone, plus d’Authenticator',
         '<p>L’utilisateur ne peut plus valider sa MFA. Le support, avec le rôle « administrateur '
         'de l’authentification », réinitialise ses méthodes dans ' + menu('Utilisateur › Méthodes d’authentification › Exiger une réinscription') +
         ' — <strong>après avoir vérifié l’identité</strong> par un autre canal (le manager, un rappel '
         'sur un numéro connu). Un attaquant appelle le support exactement pour ça.</p>'),
        ('Un « Pass d’accès temporaire » (TAP)',
         '<p>Un code à usage limité dans le temps, que le support génère pour l’inscription initiale ou '
         'la perte du téléphone. Il remplace la MFA le temps de réenregistrer une méthode.</p>'),
        ('« Je reçois des demandes MFA que je n’ai pas déclenchées »',
         '<p>Quelqu’un a le mot de passe. Refuser, signaler, changer le mot de passe, regarder les '
         'journaux de connexion (IP, lieu), révoquer les sessions : ' + menu('Utilisateur › Révoquer les sessions') + '.</p>'),
        ('Un utilisateur bloqué par une stratégie',
         '<p>' + menu('Journaux de connexion › ligne › Accès conditionnel') + ' montre quelle stratégie a '
         'joué et pourquoi (« appareil non conforme », « emplacement »). On corrige la cause, pas la stratégie.</p>'),
    ),

    '<h2>6) Et côté AD local ?</h2>',
    '<p>L’AD seul ne fait pas de MFA. Les options : Windows Hello Entreprise (déployé par GPO ou Intune, '
    'avec ou sans PKI selon le modèle), des cartes à puce (PKI), ou un serveur NPS avec l’extension '
    'MFA pour les VPN et le RDP — voir <a href="/pages/radius-8021x">RADIUS et 802.1X</a>. Pour les '
    'accès distants, la MFA sur le VPN est aujourd’hui la norme : '
    '<a href="/pages/opnsense-vpn-ids">OPNsense : accès distants</a>.</p>',

    retenir('MFA = deux facteurs de <strong>nature différente</strong> ; SMS faible, Authenticator avec nombre correct, FIDO2 / Windows Hello <strong>résistants à l’hameçonnage</strong>.',
            'Petite structure : paramètres de sécurité par défaut ; avec P1 : <strong>accès conditionnel</strong> (si… alors).',
            'Stratégies de base : MFA pour tous, fort pour les admins, protocoles hérités bloqués, appareil conforme — en <strong>rapport seul</strong> d’abord.',
            'Deux <strong>comptes de secours</strong> exclus de tout, surveillés.',
            'Au support, réinitialiser une MFA = <strong>vérifier l’identité</strong> d’abord.'),
])

# ═══════════════════════════════════════════════ Zero trust, PSSI, IAM ══

ZT = '\n'.join([
    hero('Cours · Sécurité', 'Zero trust, PSSI et gestion des identités',
         'Le cadre dans lequel le technicien travaille : la politique de sécurité, le RSSI, les guides '
         'de l’ANSSI, et le principe qui remplace « le réseau interne est de confiance ».'),
    STYLE,
    '<p>Un technicien n’écrit pas la politique de sécurité — mais il l’applique cent fois par jour : '
    'quand il crée un compte, ouvre un flux, donne un droit. Le REAC 2026 demande de connaître « les '
    'recommandations de l’ANSSI », « la PSSI », « le rôle du RSSI » et « les principes du zero trust ». '
    'Ce cours les met en ordre.</p>',

    '<h2>1) Qui décide : RSSI, PSSI, ANSSI</h2>',
    tab(['Sigle', 'Ce que c’est', 'Pour le technicien'], [
        ['<strong>PSSI</strong> — politique de sécurité des systèmes d’information', 'Le document qui fixe les règles de l’organisation : mots de passe, accès, sauvegardes, usages, incidents', 'À lire en arrivant ; c’est la référence quand on te demande « pourquoi je ne peux pas ? »'],
        ['<strong>RSSI</strong> — responsable de la sécurité des SI', 'La personne qui porte la PSSI, arbitre les risques, gère les incidents (parfois un DSI qui cumule, ou un prestataire)', 'Tu lui remontes ce qui sort du cadre ; tu n’accordes pas une exception à sa place'],
        ['<strong>ANSSI</strong> — agence nationale de la sécurité des SI', 'L’autorité française : guides, alertes (CERT-FR), qualifications (SecNumCloud), réglementation (NIS 2)', 'Ses guides sont ce qu’on cite devant un jury et devant un RSSI'],
        ['<strong>DPO</strong> — délégué à la protection des données', 'Le référent RGPD', 'Pour toute question « données personnelles »'],
        ['<strong>Charte informatique</strong>', 'Les règles côté utilisateur, annexée au règlement intérieur', 'Ce que tu rappelles à un utilisateur ; ce qu’il a signé'],
    ]),
    '<h3>Les guides ANSSI à connaître</h3>',
    bullets('<strong>Guide d’hygiène informatique</strong> — 42 mesures : la liste de contrôle de base d’un SI (inventaire, comptes, MAJ, sauvegardes, journaux…).',
            '<strong>Recommandations relatives à l’authentification multifacteur et aux mots de passe</strong> — longueur, pas de rotation forcée, MFA.',
            '<strong>Recommandations de sécurité relatives à Active Directory</strong> — le modèle de tiering, les comptes à privilèges.',
            '<strong>Recommandations pour la protection des SI essentiels</strong> et les guides NIS 2 — pour les organisations concernées.',
            '<strong>CERT-FR</strong> — les alertes et avis de vulnérabilité, à suivre pour la veille.'),

    '<h2>2) Le zero trust : ne jamais faire confiance, toujours vérifier</h2>',
    '<p>Le modèle historique — le « château fort » — considère que ce qui est <em>dedans</em> (le LAN) '
    'est de confiance, et le pare-feu garde la porte. Il ne tient plus : télétravail, cloud, '
    'téléphones, prestataires, et surtout un attaquant qui, une fois entré par un hameçonnage, '
    'circule librement. Le zero trust part du principe inverse : <strong>le réseau est hostile, '
    'partout</strong>.</p>',
    tab(['Principe', 'Ce que ça veut dire', 'Traduction concrète'], [
        ['<strong>Vérifier explicitement</strong>', 'Chaque accès est authentifié et autorisé sur tout ce qu’on sait : identité, appareil, lieu, risque', 'MFA, accès conditionnel, appareil conforme'],
        ['<strong>Moindre privilège</strong>', 'Juste les droits nécessaires, juste le temps nécessaire', 'Pas d’admin local pour les utilisateurs, comptes d’admin séparés, activation à la demande (PIM)'],
        ['<strong>Supposer la compromission</strong>', 'On conçoit comme si l’attaquant était déjà là', 'Segmentation, journalisation, chiffrement, détection'],
    ]),
    note('blue', '💡 Ce n’est pas un produit',
         'Aucun boîtier ne « fait du zero trust ». C’est une direction : à chaque décision technique, '
         'on se demande si l’accès est vérifié, minimal, et surveillé. Un VLAN par usage, une MFA sur '
         'le VPN, un compte admin séparé — c’est déjà du zero trust.'),

    '<h2>3) La gestion des identités et des accès (IAM)</h2>',
    '<p>Le zero trust met l’<strong>identité</strong> au centre : c’est elle qui remplace le périmètre '
    'réseau. La gestion des identités et des accès (IAM) couvre tout le cycle :</p>',
    steps('<strong>Identification</strong> — un compte par personne, jamais partagé ; un compte de service par service.',
          '<strong>Authentification</strong> — mot de passe robuste + MFA ; voir <a href="/pages/mfa-acces-conditionnel">MFA et accès conditionnel</a>.',
          '<strong>Autorisation</strong> — des droits par <strong>groupes</strong> (rôle métier → groupe → ressource), jamais à l’utilisateur directement.',
          '<strong>Revue</strong> — qui a encore accès à quoi ? Trimestrielle pour les droits sensibles ; les revues d’accès d’Entra ID P2 l’automatisent.',
          '<strong>Révocation</strong> — au départ, le jour même : voir <a href="/pages/cycle-vie-compte">Le cycle de vie d’un compte</a>.'),
    '<h3>Les comptes à privilèges</h3>',
    tab(['Règle', 'Pourquoi'], [
        ['Un compte <strong>utilisateur</strong> et un compte <strong>admin</strong> par technicien', 'Le mail et le web se font avec le compte sans privilège ; un hameçonnage ne donne pas les clés'],
        ['<strong>Tiering</strong> AD : tier 0 (DC, PKI, Entra Connect), tier 1 (serveurs), tier 2 (postes)', 'Un admin de tier 0 ne se connecte jamais sur un poste tier 2 : ses identifiants n’y sont jamais en mémoire'],
        ['<strong>LAPS</strong> : mot de passe admin local unique par poste', 'Un poste compromis ne donne pas tous les autres'],
        ['Pas de « Domain Admins » permanent', 'Groupe vide au repos, membres ajoutés pour une tâche, retirés après'],
        ['Postes d’administration dédiés (PAW) ou saut (bastion)', 'L’administration ne part pas d’un poste qui lit ses mails'],
    ]),

    '<h2>4) Mots de passe : ce que disent les recommandations 2021+</h2>',
    bullets('<strong>Longueur</strong> avant complexité : une phrase de passe de 12–16 caractères et plus.',
            '<strong>Pas de rotation forcée</strong> tous les 90 jours (elle produit <code>Ete2026!</code> puis <code>Automne2026!</code>) — mais changement immédiat en cas de suspicion.',
            '<strong>Gestionnaire de mots de passe</strong> pour tout ce qui n’est pas SSO.',
            '<strong>Liste noire</strong> des mots de passe connus (Entra Password Protection, aussi pour l’AD local).',
            '<strong>MFA</strong> partout où c’est possible.'),

    '<h2>5) Ce que le technicien fait, et ne fait pas</h2>',
    tab(['Il fait', 'Il ne fait pas'], [
        ['Applique la PSSI à chaque compte, droit, flux', 'N’accorde pas d’exception « pour dépanner »'],
        ['Remonte au RSSI ce qui sort du cadre, avec les faits', 'Ne décide pas seul d’un risque à accepter'],
        ['Journalise ce qu’il fait (ticket, compte rendu)', 'Ne partage pas un compte, ne note pas un mot de passe'],
        ['Cite les guides ANSSI pour justifier une règle', 'N’invente pas de règle'],
        ['Signale un incident tout de suite', 'Ne « nettoie » pas avant d’avoir prévenu'],
    ]),

    retenir('<strong>PSSI</strong> = les règles ; <strong>RSSI</strong> = celui qui les porte ; <strong>ANSSI</strong> = la référence (hygiène, MFA, AD).',
            '<strong>Zero trust</strong> : vérifier explicitement, moindre privilège, supposer la compromission — l’identité remplace le périmètre.',
            'IAM : compte individuel, MFA, droits par groupes, revues, révocation le jour du départ.',
            'Comptes admin séparés, tiering, LAPS, pas de Domain Admins permanent.',
            'Le technicien applique et remonte ; il n’accorde pas d’exception.'),
    note('green', '🔗 À lire à côté',
         '<a href="/pages/procedure-securite-poste">Sécuriser un poste / serveur Windows</a> · '
         '<a href="/pages/le-pare-feu">Le pare-feu</a> · <a href="/pages/vlan-securite">Sécuriser les VLAN</a> · '
         '<a href="/pages/gestion-vulnerabilites">Gestion des vulnérabilités</a>.'),
])

# ══════════════════════════════════════════════ Cycle de vie d'un compte ══

CYCLE = '\n'.join([
    hero('Cours · Identité hybride', 'Le cycle de vie d’un compte',
         'Arrivée, changement de poste, départ : les étapes, les délais, ce qui se passe dans l’AD, '
         'dans Entra ID et dans les applications — et comment ne rien oublier.'),
    STYLE,
    '<p>La moitié des incidents d’accès viennent d’un compte mal créé ; la moitié des fuites, d’un '
    'compte jamais fermé. Le REAC 2026 demande de « gérer le cycle de vie des comptes » : ce cours '
    'donne le processus, les listes de contrôle et les commandes.</p>',

    '<h2>1) Les quatre moments</h2>',
    tab(['Moment', 'Déclencheur', 'Ce qui doit être prêt / fait'], [
        ['<strong>Arrivée</strong> (onboarding)', 'Fiche RH ou ticket du manager, <em>avant</em> le premier jour', 'Compte, groupes, boîte mail, licence, poste, accès applicatifs, badge'],
        ['<strong>Changement</strong> (mutation, promotion)', 'Ticket du manager', 'Groupes ajoutés <em>et retirés</em>, déplacement d’UO, attributs (service, titre)'],
        ['<strong>Absence longue</strong> (congé, suspension)', 'RH', 'Compte désactivé ou accès restreint, boîte gérée (réponse automatique, délégation)'],
        ['<strong>Départ</strong> (offboarding)', 'RH, <em>le jour même</em>', 'Désactivation, révocation des sessions, récupération du matériel, boîte et données transmises, suppression différée'],
    ]),
    note('yellow', '⚠️ Le processus commence par les RH',
         'Le technicien ne devine pas les arrivées. Une procédure écrite fixe : qui demande (le '
         'manager, via un formulaire ou un ticket), quel délai (J-5 pour une arrivée), et qui valide '
         'les accès sensibles. Sans ça, on crée des comptes par téléphone, à la va-vite, avec trop '
         'de droits.'),

    '<h2>2) Arrivée : la liste de contrôle</h2>',
    steps('<strong>Identité</strong> : convention de nommage (<code>prenom.nom</code>, doublons gérés), UPN sur un domaine vérifié, UO du service.',
          '<strong>Attributs</strong> : service, fonction, manager, téléphone — ils pilotent les groupes dynamiques, l’annuaire Outlook, la signature.',
          '<strong>Groupes par rôle</strong> : un modèle par métier (« Comptable » → G_Compta_Lecture, G_Imprimante_2e, licence M365). On copie un modèle, pas un collègue — le collègue a huit ans de droits accumulés.',
          '<strong>Mot de passe initial</strong> : aléatoire, remis par un canal distinct, « doit changer à la prochaine ouverture ».',
          '<strong>Boîte et licence</strong> : licence par groupe ; la boîte suit.',
          '<strong>MFA</strong> : inscription le premier jour (pass d’accès temporaire si besoin).',
          '<strong>Poste</strong> : préparé, joint, nommé selon la convention ; voir <a href="/pages/deployer-image-windows">Déployer une image Windows</a>.',
          '<strong>Accès applicatifs hors annuaire</strong> : ERP, logiciel métier — la liste par rôle est dans la procédure.',
          '<strong>Ticket</strong> clos avec ce qui a été fait, et un mot de bienvenue avec les règles (charte, MFA, support).'),
    cmd('# AD local — création à partir d’un modèle de rôle\n'
        'New-ADUser -Name "Marie Martin" -GivenName Marie -Surname Martin -SamAccountName marie.martin `\n'
        '  -UserPrincipalName marie.martin@entreprise.fr -Path "OU=Compta,OU=Utilisateurs,DC=entreprise,DC=local" `\n'
        '  -Department Comptabilite -Title "Comptable" -Manager paul.durand `\n'
        '  -AccountPassword (Read-Host -AsSecureString "Mot de passe initial") -ChangePasswordAtLogon $true -Enabled $true\n'
        '\n'
        '(Get-ADUser modele.comptable -Properties MemberOf).MemberOf | ForEach-Object { Add-ADGroupMember $_ marie.martin }'),
    '<p>En masse : <a href="/pages/procedure-ad-objets">UO, groupes et utilisateurs en masse</a> et le '
    '<a href="/pages/constructeur-ad">constructeur AD</a>.</p>',

    '<h2>3) Changement de poste : retirer autant qu’ajouter</h2>',
    '<p>Le piège classique : la personne mutée <em>garde</em> ses anciens droits. Après trois '
    'mutations, elle accède à tout. Le changement se traite comme un départ du rôle précédent suivi '
    'd’une arrivée dans le nouveau :</p>',
    bullets('Lister ses groupes actuels (<code>Get-ADPrincipalGroupMembership</code>) et les comparer au modèle du nouveau rôle.',
            'Retirer ce qui n’est plus justifié — <em>avec</em> l’accord du nouveau manager si un accès transitoire est demandé, et une date de fin.',
            'Déplacer dans la bonne UO (les GPO suivent), mettre à jour les attributs.',
            'Vérifier les accès hors annuaire (ERP, partages avec droits directs — les fameux droits « à l’utilisateur » qu’on n’aurait jamais dû donner).'),

    '<h2>4) Départ : le jour même, dans l’ordre</h2>',
    steps('<strong>Désactiver</strong> le compte (pas supprimer) : AD → synchro → Entra. Le compte disparaît des connexions, ses groupes et sa boîte sont intacts.',
          '<strong>Révoquer les sessions</strong> cloud : ' + menu('Entra › Utilisateur › Révoquer les sessions') + ' — un jeton Teams ou Outlook reste valide des heures sinon.',
          '<strong>Réinitialiser le mot de passe</strong> au passage (contre une session ouverte quelque part).',
          '<strong>Retirer les appareils</strong> : effacement à distance du portable ou du téléphone si Intune, récupération du matériel contre signature.',
          '<strong>La boîte mail</strong> : réponse automatique, délégation au manager, conversion en boîte partagée (elle ne consomme plus de licence) ou export PST selon la PSSI.',
          '<strong>Les données</strong> : OneDrive transféré au manager (30 jours par défaut avant suppression), dossier personnel du serveur de fichiers archivé.',
          '<strong>Les accès hors annuaire</strong> : ERP, SaaS, VPN, badge, comptes partagés dont il connaissait le mot de passe (à changer !).',
          '<strong>Retirer la licence</strong> après transfert de la boîte.',
          '<strong>Supprimer</strong> après le délai de rétention de la PSSI (souvent 30 à 90 jours), l’UO « Comptes désactivés » servant de sas.'),
    cmd('Disable-ADAccount marie.martin\n'
        'Set-ADUser marie.martin -Description "Départ 2026-09-30 — ticket #4521" -Replace @{extensionAttribute1="depart"}\n'
        'Move-ADObject (Get-ADUser marie.martin).DistinguishedName -TargetPath "OU=Desactives,DC=entreprise,DC=local"\n'
        '# côté cloud\n'
        'Revoke-MgUserSignInSession -UserId marie.martin@entreprise.fr'),
    note('red', '🚨 Le compte du prestataire et le compte de service',
         'Deux comptes qu’on oublie. Le prestataire : une <strong>date d’expiration</strong> dès la '
         'création (<code>-AccountExpirationDate</code>), un rappel avant. Le compte de service : un '
         'propriétaire nommé, un mot de passe géré (gMSA de préférence), et une revue quand son '
         'propriétaire part.'),

    '<h2>5) La revue périodique</h2>',
    '<p>Même avec un bon processus, les droits dérivent. Une fois par trimestre :</p>',
    cmd('# comptes inactifs depuis 90 jours\n'
        'Search-ADAccount -AccountInactive -TimeSpan 90.00:00:00 -UsersOnly | Select Name, LastLogonDate\n'
        '# comptes activés dont le mot de passe n’expire jamais\n'
        'Get-ADUser -Filter {PasswordNeverExpires -eq $true -and Enabled -eq $true} | Select Name\n'
        '# membres des groupes sensibles\n'
        'Get-ADGroupMember "Domain Admins" -Recursive | Select Name, SamAccountName'),
    '<p>Dans Entra ID P2, les <strong>revues d’accès</strong> demandent aux managers de confirmer les '
    'membres de leurs groupes ; un non-répondu retire l’accès.</p>',

    '<h2>6) RGPD et traçabilité</h2>',
    bullets('Le compte et la boîte d’une personne partie sont des <strong>données personnelles</strong> : durée de conservation fixée, pas d’accès à la boîte sans base légale (information de la personne, proportionnalité).',
            'Chaque étape est <strong>tracée</strong> : ticket, date, qui a fait quoi. Un audit demande « qui avait accès à ce dossier le 12 mars » — il faut pouvoir répondre.',
            'La procédure est <strong>écrite</strong> et connue des RH, des managers et du support.'),

    retenir('Quatre moments : arrivée, changement, absence, départ — déclenchés par les RH / le manager, via une procédure écrite.',
            'Arrivée : <strong>modèle de rôle</strong>, groupes, attributs, MFA, poste — jamais « copie de Untel ».',
            'Changement : <strong>retirer</strong> les anciens droits, pas seulement ajouter.',
            'Départ le jour même : <strong>désactiver, révoquer les sessions, mot de passe, appareils, boîte, données, accès hors annuaire</strong>, supprimer plus tard.',
            'Revue trimestrielle : inactifs, mots de passe sans expiration, groupes sensibles.'),
])

# ══════════════════════════════════════════════════════════ PKI & AD CS ══

PKI = '\n'.join([
    hero('Cours · Sécurité', 'Certificats, PKI et AD CS',
         'Ce qu’un certificat prouve, comment une autorité de certification interne se met en place '
         'avec Active Directory Certificate Services, et comment distribuer des certificats aux '
         'postes et serveurs sans y toucher un par un.'),
    STYLE,
    '<p>Un cadenas dans le navigateur, un VPN qui accepte le client, un poste qui prouve son identité '
    'en 802.1X, une signature de script PowerShell : tout cela repose sur des '
    '<strong>certificats</strong>. Dans une entreprise, on ne les achète pas un par un ; on monte '
    'une <strong>PKI</strong> interne. Sous Windows Server, c’est le rôle AD CS.</p>',

    '<h2>1) Ce qu’un certificat prouve</h2>',
    '<p>Un certificat lie une <strong>clé publique</strong> à une <strong>identité</strong> '
    '(<code>srv-intranet.entreprise.local</code>, ou <code>marie.martin</code>), et cette liaison est '
    '<strong>signée</strong> par une autorité de certification (CA). Celui qui fait confiance à la '
    'CA fait confiance au certificat. La clé privée, elle, ne sort jamais de la machine qui la détient.</p>',
    tab(['Champ', 'Contenu', 'Ce qui casse si c’est faux'], [
        ['Sujet / SAN', 'Le nom du serveur ou de la personne ; les noms alternatifs (DNS, IP)', '« Le nom du site ne correspond pas au certificat »'],
        ['Émetteur', 'La CA qui a signé', '« Autorité inconnue » si la CA n’est pas dans le magasin de confiance'],
        ['Validité', 'Du… au…', '« Certificat expiré » — la panne la plus bête et la plus fréquente'],
        ['Usage', 'Authentification serveur, client, signature de code, chiffrement de fichiers…', 'Un certificat serveur refusé pour de l’authentification client'],
        ['Révocation (CRL / OCSP)', 'Où vérifier qu’il n’a pas été révoqué', 'Un client qui n’atteint pas la CRL peut refuser le certificat'],
    ]),

    '<h2>2) CA publique ou CA interne ?</h2>',
    tab(['', 'CA publique (Let’s Encrypt, DigiCert…)', 'CA interne (AD CS)'], [
        ['Reconnue par', 'Tous les navigateurs du monde', 'Seulement les machines où on a installé sa racine'],
        ['Pour', 'Sites et services <strong>exposés sur Internet</strong>', 'Tout ce qui est interne : intranet, RDP, LDAPS, 802.1X, VPN, Wi-Fi, signature de scripts'],
        ['Noms', 'Domaines publics vérifiables', 'Aussi les noms internes (<code>.local</code>), impossibles en public'],
        ['Coût', 'Gratuit (ACME) à payant', 'Un serveur Windows'],
        ['Automatisation', 'ACME (certbot, win-acme)', 'Auto-inscription par GPO'],
    ]),

    '<h2>3) Architecture d’une PKI d’entreprise</h2>',
    '<p>Le modèle recommandé (ANSSI, Microsoft) a deux niveaux :</p>',
    tab(['Niveau', 'Rôle', 'État'], [
        ['<strong>CA racine</strong> autonome (hors domaine)', 'Signe seulement la CA émettrice ; sa clé est le bien le plus précieux du SI', '<strong>Éteinte</strong>, hors ligne, allumée une fois par an pour publier sa CRL'],
        ['<strong>CA émettrice</strong> d’entreprise (membre du domaine)', 'Délivre les certificats aux utilisateurs, postes, serveurs, via les modèles', 'En ligne, intégrée à l’AD (les modèles et la racine sont publiés dans l’annuaire)'],
    ]),
    note('yellow', '⚠️ Et une seule CA d’entreprise ?',
         'Pour un laboratoire ou une très petite structure, une CA d’entreprise unique fonctionne. '
         'Mais si sa clé est compromise, toute la PKI est à refaire — la racine hors ligne est '
         'précisément ce qui évite ça. À l’examen, savoir expliquer pourquoi vaut mieux que de '
         'l’avoir déployée.'),

    '<h2>4) Installer AD CS (CA émettrice d’entreprise)</h2>',
    steps('Un serveur membre dédié (pas un DC), nom définitif — <strong>on ne renomme jamais une CA</strong>.',
          menu('Gestionnaire de serveur › Ajouter des rôles › Services de certificats Active Directory') + ' : « Autorité de certification » et « Inscription via le web » si besoin.',
          'Configuration post-déploiement : CA <strong>d’entreprise</strong>, <strong>subordonnée</strong> (si racine hors ligne) ou racine, nouvelle clé privée, RSA 4096 / SHA-256, nom commun <code>Entreprise-CA-Emettrice</code>, validité 5 à 10 ans.',
          'Si subordonnée : la demande générée est signée par la racine (transportée par clé USB), le certificat obtenu s’installe sur la CA émettrice.',
          'Publier les points de distribution (CRL, AIA) sur une URL HTTP accessible par tous — y compris les machines hors domaine et les téléphones — et non seulement en LDAP.',
          'Vérifier : <code>certutil -ping</code>, <code>pkiview.msc</code> tout en vert.'),
    cmd('Install-WindowsFeature ADCS-Cert-Authority -IncludeManagementTools\n'
        'Install-AdcsCertificationAuthority -CAType EnterpriseSubordinateCA -CACommonName "Entreprise-CA-Emettrice" `\n'
        '  -KeyLength 4096 -HashAlgorithmName SHA256 -CryptoProviderName "RSA#Microsoft Software Key Storage Provider"\n'
        'certutil -pulse        # forcer la mise à jour des certificats de la machine'),

    '<h2>5) Les modèles de certificats</h2>',
    '<p>Un modèle décrit ce qu’une CA d’entreprise accepte de délivrer : usage, durée, taille de clé, '
    'qui peut demander. On <strong>duplique</strong> un modèle intégré, on l’adapte, on le publie sur '
    'la CA (' + menu('certtmpl.msc') + ' puis ' + menu('certsrv.msc › Modèles › Nouveau › Modèle à délivrer') + ').</p>',
    tab(['Modèle (dupliqué de…)', 'Pour', 'Droits'], [
        ['Ordinateur → « Poste-Entreprise »', 'Authentification 802.1X, chiffrement', 'Ordinateurs du domaine : lire, inscrire, <strong>inscrire automatiquement</strong>'],
        ['Serveur Web → « Serveur-Web-Interne »', 'HTTPS intranet, LDAPS, RDP', 'Groupe des serveurs concernés ; nom fourni dans la demande'],
        ['Utilisateur → « Utilisateur-Entreprise »', 'Authentification client, signature de mail, EFS', 'Utilisateurs du domaine : auto-inscription'],
        ['Signature de code', 'Signer les scripts PowerShell', 'Un groupe d’administrateurs seulement'],
    ]),

    '<h2>6) Auto-inscription : distribuer sans toucher les postes</h2>',
    '<p>Avec une CA d’entreprise, une GPO suffit pour que chaque poste et chaque utilisateur obtiennent '
    '(et renouvellent) leurs certificats tout seuls :</p>',
    cmd(menu('GPO › Configuration ordinateur › Stratégies › Paramètres Windows › Paramètres de sécurité › Stratégies de clé publique') + '\n'
        '  Client des services de certificats – Inscription automatique : Activé\n'
        '    [x] Renouveler les certificats expirés, mettre à jour les certificats en attente\n'
        '    [x] Mettre à jour les certificats qui utilisent les modèles de certificats'),
    '<p>La <strong>racine</strong> de la CA se propage aux machines du domaine automatiquement (publiée dans '
    'l’AD). Pour les machines hors domaine, les téléphones ou les équipements réseau : exporter la '
    'racine (<code>.cer</code>) et l’installer dans leur magasin de confiance — sinon l’avertissement '
    '« autorité inconnue » reste.</p>',

    '<h2>7) Trois cas d’usage</h2>',
    acc(
        ('HTTPS sur un serveur interne (IIS, Apache, OPNsense)',
         '<p>Demander un certificat avec le modèle « Serveur-Web-Interne » (' + menu('certlm.msc › Personnel › Demander un nouveau certificat') +
         ', ou une CSR pour un serveur Linux signée dans ' + menu('certsrv › Soumettre une demande') + '). Le nom '
         'dans le SAN doit être <em>exactement</em> celui tapé par les utilisateurs. Plus d’avertissement, '
         'chiffrement réel — voir <a href="/pages/linux-apache-virtualhosts">Apache : HTTPS</a>.</p>'),
        ('802.1X et Wi-Fi d’entreprise',
         '<p>Le serveur NPS présente un certificat serveur ; les postes s’authentifient avec leur certificat '
         'ordinateur (EAP-TLS) : plus de mot de passe Wi-Fi à distribuer. Voir '
         '<a href="/pages/radius-8021x">RADIUS et 802.1X</a> et <a href="/pages/wifi-entreprise">Wi-Fi d’entreprise</a>.</p>'),
        ('Signer les scripts PowerShell',
         '<p>Avec la stratégie d’exécution <code>AllSigned</code>, seuls les scripts signés par un '
         'certificat de confiance s’exécutent : <code>Set-AuthenticodeSignature .\\deploiement.ps1 -Certificate $cert</code>. '
         'Voir <a href="/pages/scripts-powershell">Scripts PowerShell</a>.</p>'),
    ),

    '<h2>8) Exploiter une PKI</h2>',
    bullets('<strong>Surveiller les expirations</strong> : le certificat de la CA émettrice, les CRL (une CRL expirée bloque <em>tout</em>), les certificats serveurs. Un script ou la supervision — voir <a href="/pages/installer-zabbix">Zabbix</a>.',
            '<strong>Révoquer</strong> un certificat (poste volé, clé compromise) dans ' + menu('certsrv › Certificats délivrés › Révoquer') + ', puis publier la CRL.',
            '<strong>Sauvegarder</strong> la CA : <code>certutil -backup</code> (base + clé privée), et la racine hors ligne sur un support chiffré.',
            '<strong>Journaliser</strong> : l’audit des délivrances et révocations est activable sur la CA.'),

    retenir('Un certificat lie une <strong>clé publique</strong> à une <strong>identité</strong>, signé par une <strong>CA</strong> ; on fait confiance à la CA.',
            'CA publique pour ce qui est exposé sur Internet ; <strong>CA interne (AD CS)</strong> pour tout l’intérieur.',
            'Architecture : <strong>racine hors ligne</strong> + <strong>émettrice d’entreprise</strong> ; jamais renommer une CA ; CRL accessible en HTTP.',
            '<strong>Modèles</strong> dupliqués + <strong>auto-inscription par GPO</strong> = certificats partout sans toucher aux postes.',
            'Exploiter : expirations (CA, CRL, serveurs), révocation, sauvegarde.'),
])

# ══════════════════════════════════════════════════ Premiers pas cloud ══

CLOUD = '\n'.join([
    hero('Cours · Cloud', 'Le cloud : premiers pas',
         'IaaS, PaaS, SaaS ; public, privé, hybride ; ce que le fournisseur garantit et ce qui reste à '
         'ta charge ; et une première VM chez un fournisseur, avec ce qu’elle coûte.'),
    STYLE,
    '<p>« Le cloud, c’est l’ordinateur de quelqu’un d’autre. » La formule est juste, à condition '
    'd’ajouter : loué à la minute, pilotable par une console ou un script, et facturé à l’usage. Le '
    'REAC 2026 demande d’« installer et configurer un service dans un environnement virtualisé ou '
    'cloud » et de connaître les « principes du cloud computing ». Ce cours donne le vocabulaire et '
    'le premier geste.</p>',

    '<h2>1) Trois modèles de service</h2>',
    tab(['Modèle', 'Ce qu’on loue', 'Ce qu’on gère encore', 'Exemples'], [
        ['<strong>IaaS</strong> — infrastructure', 'Des VM, des disques, des réseaux virtuels', 'L’OS, les MAJ, les applications, les sauvegardes', 'Azure Virtual Machines, AWS EC2, OVHcloud Public Cloud, Scaleway'],
        ['<strong>PaaS</strong> — plateforme', 'Un service prêt : base de données, hébergement web, conteneurs', 'Le code et les données', 'Azure App Service, Azure SQL, AWS RDS'],
        ['<strong>SaaS</strong> — logiciel', 'L’application finie', 'Les comptes, les paramètres, les données', 'Microsoft 365, Google Workspace, Salesforce, un ticketing en ligne'],
    ]),
    '<p>Un technicien TSSR est surtout du côté IaaS (des VM comme sur Hyper-V, mais ailleurs) et SaaS '
    '(administrer Microsoft 365). Le PaaS est le terrain des développeurs.</p>',

    '<h2>2) Quatre modèles de déploiement</h2>',
    tab(['Modèle', 'Où tournent les machines', 'Pour qui'], [
        ['<strong>Public</strong>', 'Chez un fournisseur, infrastructure partagée entre clients (isolée logiquement)', 'La majorité des usages'],
        ['<strong>Privé</strong>', 'Dans le datacenter de l’organisation (ou dédié chez un hébergeur), avec les mêmes outils d’automatisation', 'Contraintes de données, de latence, de coût à grande échelle'],
        ['<strong>Hybride</strong>', 'Les deux, reliés (VPN site à site, Entra Connect, Azure Arc)', 'L’état normal : AD local + M365, serveurs locaux + sauvegarde cloud'],
        ['<strong>Multi-cloud</strong>', 'Plusieurs fournisseurs', 'Éviter la dépendance ; plus complexe'],
    ]),

    '<h2>3) La responsabilité partagée</h2>',
    '<p>Le fournisseur garantit ce qui est <em>en dessous</em> de ce que tu loues. Tout ce qui est '
    '<em>au-dessus</em> reste ta responsabilité — et c’est là que se produisent les incidents.</p>',
    tab(['Couche', 'IaaS', 'PaaS', 'SaaS'], [
        ['Bâtiment, énergie, matériel, réseau physique', 'Fournisseur', 'Fournisseur', 'Fournisseur'],
        ['Hyperviseur', 'Fournisseur', 'Fournisseur', 'Fournisseur'],
        ['Système d’exploitation, MAJ, antivirus', '<strong>Toi</strong>', 'Fournisseur', 'Fournisseur'],
        ['Application, configuration', '<strong>Toi</strong>', '<strong>Toi</strong>', 'Fournisseur'],
        ['Comptes, droits, MFA', '<strong>Toi</strong>', '<strong>Toi</strong>', '<strong>Toi</strong>'],
        ['Données, sauvegardes, conformité', '<strong>Toi</strong>', '<strong>Toi</strong>', '<strong>Toi</strong>'],
    ]),
    note('red', '🚨 « C’est dans le cloud, c’est sauvegardé »',
         'Non. Une VM Azure supprimée est supprimée ; une boîte Microsoft 365 vidée est vidée après la '
         'rétention. Le fournisseur garantit que son infrastructure ne perd pas <em>ses</em> données ; '
         'les tiennes se sauvegardent (Azure Backup, un outil tiers pour M365). Voir '
         '<a href="/pages/pra-pca">PRA / PCA</a>.'),

    '<h2>4) Les briques d’un IaaS (vocabulaire Azure, transposable)</h2>',
    tab(['Brique', 'Azure', 'AWS', 'Équivalent local'], [
        ['Machine virtuelle', 'Virtual Machine', 'EC2 instance', 'Une VM Hyper-V'],
        ['Disque', 'Managed Disk', 'EBS volume', 'Un VHDX'],
        ['Réseau', 'Virtual Network (VNet) + sous-réseaux', 'VPC', 'Un vSwitch + VLAN'],
        ['Pare-feu de niveau réseau', 'Network Security Group (NSG)', 'Security Group', 'Les règles OPNsense'],
        ['IP publique', 'Public IP', 'Elastic IP', 'Le NAT sur le pare-feu'],
        ['Stockage objet', 'Blob Storage', 'S3', 'Pas d’équivalent : fichiers accessibles par HTTP'],
        ['Groupement', 'Resource Group', 'Tags', 'Un dossier de projet'],
        ['Région / zone', 'France Central, zones 1-2-3', 'eu-west-3 (Paris)', 'Le datacenter ; voir <a href="/pages/datacenter">Le datacenter</a>'],
    ]),

    '<h2>5) Première VM : les gestes</h2>',
    steps('Un <strong>groupe de ressources</strong> par projet, dans une région européenne (données, latence, RGPD).',
          'Un <strong>réseau virtuel</strong> avec un sous-réseau — comme un plan d’adressage local.',
          'La <strong>VM</strong> : image (Windows Server 2022, Debian 12), taille (B2s = 2 vCPU / 4 Go pour un test), disque SSD standard, compte administrateur — <strong>par clé SSH</strong> pour Linux.',
          'Le <strong>NSG</strong> : par défaut tout est fermé depuis Internet. On ouvre 22 ou 3389 <em>depuis son IP seulement</em>, jamais depuis « Any ». Mieux : Azure Bastion ou un VPN.',
          'Se connecter, mettre à jour, installer le service, <strong>arrêter la VM (désallouer)</strong> quand on ne s’en sert pas.'),
    cmd('# Azure CLI — la même chose en script (idempotent, rejouable)\n'
        'az group create -n rg-lab -l francecentral\n'
        'az vm create -g rg-lab -n vm-deb01 --image Debian12 --size Standard_B2s \\\n'
        '   --admin-username admin --ssh-key-values ~/.ssh/id_ed25519.pub --public-ip-sku Standard\n'
        'az vm open-port -g rg-lab -n vm-deb01 --port 22          # puis restreindre la source dans le NSG\n'
        'az vm deallocate -g rg-lab -n vm-deb01                    # arrêtée ET non facturée (sauf le disque)'),
    note('yellow', '⚠️ Un RDP ouvert sur Internet est scanné en quelques minutes',
         'Les journaux d’une VM avec 3389 ouvert montrent des milliers de tentatives par jour dès la '
         'première heure. Source restreinte dans le NSG, MFA, ou un accès par bastion / VPN : ce n’est '
         'pas optionnel.'),

    '<h2>6) Ce que ça coûte</h2>',
    tab(['Poste', 'Facturé', 'Le piège'], [
        ['Calcul (VM)', 'À la seconde, tant qu’elle est allumée', 'Une VM de test oubliée un mois'],
        ['Disque', 'À la capacité provisionnée, même VM éteinte', 'Les disques orphelins de VM supprimées'],
        ['IP publique, équilibreur', 'À l’heure', 'Idem'],
        ['<strong>Sortie réseau</strong> (egress)', 'Au Go qui sort du cloud', 'Rapatrier une sauvegarde de 2 To ; l’entrée est gratuite, la sortie non'],
        ['Licences', 'Windows incluse dans le tarif de la VM ; SQL, RDS en plus', 'La licence hybride (Azure Hybrid Benefit) si on en possède'],
    ]),
    bullets('Le <strong>calculateur de prix</strong> du fournisseur avant de créer quoi que ce soit.',
            'Des <strong>budgets et alertes</strong> sur l’abonnement (' + menu('Gestion des coûts › Budgets') + ').',
            'Des <strong>étiquettes</strong> (projet, propriétaire) sur chaque ressource, pour savoir qui paie quoi.',
            'Éteindre (désallouer) ce qui ne sert pas ; supprimer le groupe de ressources d’un test terminé.'),

    '<h2>7) Souveraineté, conformité, réversibilité</h2>',
    bullets('<strong>Localisation</strong> des données : une région européenne ; un fournisseur soumis au droit américain (CLOUD Act) reste un point d’attention pour les données sensibles.',
            '<strong>SecNumCloud</strong> : la qualification ANSSI des offres cloud de confiance (OVHcloud, Outscale, S3NS…) — exigée pour certaines données publiques et de santé.',
            '<strong>Réversibilité</strong> : comment on ressort ? Export des VM (VHD), des données ; tout ce qui est propriétaire (PaaS) coûte cher à quitter.',
            '<strong>Contrat</strong> : SLA (disponibilité garantie, souvent 99,9 % = 8 h 45 d’arrêt par an), support, RGPD (le fournisseur est sous-traitant au sens de l’article 28).'),

    retenir('<strong>IaaS</strong> = des VM ailleurs ; <strong>PaaS</strong> = un service prêt ; <strong>SaaS</strong> = l’application. Public / privé / <strong>hybride</strong>.',
            '<strong>Responsabilité partagée</strong> : l’OS, les comptes, les données et les sauvegardes restent à toi.',
            'Première VM : groupe de ressources, VNet, VM, NSG <strong>fermé sauf depuis ton IP</strong>, désallouer.',
            'Coûts : calcul à la seconde, disques même éteint, <strong>sortie réseau</strong> ; budgets et alertes.',
            'Région européenne, SecNumCloud pour le sensible, penser la réversibilité.'),
    note('green', '🔗 À lire à côté',
         '<a href="/pages/virtualisation-theorie">La virtualisation : théorie</a> · '
         '<a href="/pages/docker-30-minutes">Docker en 30 minutes</a> · '
         '<a href="/pages/entra-id">Entra ID</a> · <a href="/pages/datacenter">Le datacenter</a>.'),
])

# ═══════════════════════════════════════════════════════════ Datacenter ══

DC = '\n'.join([
    hero('Cours · Infrastructure', 'Le datacenter et la salle serveur',
         'Ce qu’il y a derrière une baie : énergie, refroidissement, redondance, niveaux Tier, et les '
         'règles pour intervenir dans une salle sans rien débrancher qu’il ne fallait pas.'),
    STYLE,
    '<p>Qu’il s’agisse du local technique de l’entreprise ou d’un hall de colocation de 5 000 m², les '
    'principes sont les mêmes : de l’électricité sans coupure, de l’air frais, de la place, et un '
    'contrôle de qui entre. Le REAC 2026 attend d’un technicien qu’il sache « intervenir dans un '
    'datacenter » en respectant ses règles.</p>',

    '<h2>1) De la salle serveur au datacenter</h2>',
    tab(['', 'Local technique', 'Salle serveur', 'Datacenter'], [
        ['Taille', 'Un placard, une baie', 'Une pièce, 2 à 10 baies', 'Des halls, des centaines de baies'],
        ['Énergie', 'Un onduleur', 'Onduleur + parfois groupe électrogène', 'Deux arrivées, onduleurs redondants, groupes, cuves de fioul'],
        ['Froid', 'Une clim de bureau', 'Clim dédiée', 'Allées chaudes / froides, confinement, free cooling'],
        ['Accès', 'Une clé', 'Badge', 'Badge + biométrie + sas + accompagnement'],
        ['Qui l’exploite', 'Toi', 'Toi', 'L’hébergeur ; toi pour tes baies (colocation) ou rien (cloud)'],
    ]),

    '<h2>2) Les niveaux Tier (Uptime Institute)</h2>',
    tab(['Tier', 'Redondance', 'Disponibilité annuelle', 'Arrêt max / an'], [
        ['I', 'Aucune : une seule voie électrique et froid', '99,671 %', '~29 h'],
        ['II', 'Composants redondants (N+1) sur une voie', '99,741 %', '~22 h'],
        ['III', 'Deux voies, une active : <strong>maintenance sans arrêt</strong>', '99,982 %', '~1 h 36'],
        ['IV', 'Deux voies actives, tolérance à une panne : <strong>fault tolerant</strong>', '99,995 %', '~26 min'],
    ]),
    '<p>La plupart des hébergeurs professionnels sont Tier III (ou « conçus selon »). Le Tier ne dit '
    'rien de <em>ton</em> serveur : un serveur seul dans un Tier IV a la disponibilité d’un serveur '
    'seul.</p>',

    '<h2>3) L’énergie</h2>',
    bullets('<strong>Deux arrivées</strong> électriques (voies A et B) jusqu’à la baie : deux PDU (multiprises intelligentes) par baie, chaque serveur avec <strong>deux alimentations</strong> branchées l’une sur A, l’autre sur B.',
            '<strong>Onduleur</strong> (UPS) : batteries pour tenir les secondes ou minutes avant le groupe électrogène — et pour lisser le courant. Voir <a href="/pages/pra-pca">PRA / PCA</a> pour l’arrêt propre sur batterie.',
            '<strong>Groupe électrogène</strong> : démarre en 10 à 30 s, testé chaque mois, autonomie en fioul de 24 à 72 h.',
            '<strong>Puissance par baie</strong> : 3 à 10 kW typiquement ; on ne branche pas un serveur de plus sans vérifier la charge des PDU.'),
    note('red', '🚨 Un serveur avec deux alimentations sur le même PDU',
         'La redondance ne sert à rien. Chaque intervention vérifie : alimentation 1 → PDU A, '
         'alimentation 2 → PDU B. C’est la faute la plus courante d’un technicien pressé.'),

    '<h2>4) Le froid</h2>',
    bullets('Un serveur transforme 100 % de son électricité en chaleur : 5 kW dans une baie = un radiateur de 5 kW à évacuer.',
            '<strong>Allées froides / allées chaudes</strong> : les faces avant des baies se font face (elles aspirent l’air froid), les arrières soufflent dans l’allée chaude. On ne monte jamais un serveur à l’envers.',
            '<strong>Confinement</strong> des allées, <strong>obturateurs</strong> sur les U vides : sans eux, l’air chaud recircule devant.',
            'Consigne : 18 à 27 °C en entrée d’air (ASHRAE) ; l’hygrométrie contrôlée contre l’électricité statique et la condensation.',
            '<strong>PUE</strong> (Power Usage Effectiveness) = énergie totale / énergie informatique : 2,0 = autant pour le froid que pour les serveurs ; les bons datacenters sont sous 1,3 (free cooling, air extérieur).'),

    '<h2>5) La baie et le câblage</h2>',
    tab(['Élément', 'Règle'], [
        ['Unité (U)', '44,45 mm ; une baie standard fait 42 U ; on note la position de chaque équipement (U 12–13) dans l’inventaire'],
        ['Rails', 'Serveurs sur rails coulissants ; le lourd (onduleur, stockage) en bas'],
        ['Câbles', 'Codés par couleur (production, administration, stockage), étiquetés aux <strong>deux</strong> bouts, longueur juste, passés dans les guides — jamais devant les ventilateurs'],
        ['Panneaux de brassage', 'Le câblage fixe arrive dessus ; on brasse en cordons courts vers le commutateur'],
        ['Réseau', 'Deux commutateurs, deux cartes par serveur (agrégation ou actif/passif), l’administration (iDRAC, iLO, IPMI) sur un réseau dédié'],
        ['Documentation', 'Le plan de baie et le schéma à jour ; voir <a href="/pages/reseau-entreprise">Concevoir le réseau d’une entreprise</a>'],
    ]),

    '<h2>6) Intervenir dans un datacenter</h2>',
    steps('<strong>Avant</strong> : demande d’accès (nom, pièce d’identité, créneau, baie, motif) 24 à 48 h à l’avance ; ticket de maintenance ouvert ; matériel listé ; procédure écrite avec le retour arrière.',
          '<strong>À l’entrée</strong> : sas, badge, parfois fouille ; pas de carton (les fibres de carton bouchent les filtres), pas de nourriture, pas de photos sans accord.',
          '<strong>Dans la salle</strong> : bruit (80 dB, bouchons), froid dans l’allée froide, chaud derrière. On ne touche <strong>que sa baie</strong>. Bracelet antistatique pour ouvrir un châssis.',
          '<strong>Le geste</strong> : lire l’étiquette deux fois avant de débrancher ; un câble débranché sur une baie mal étiquetée, c’est un client qui tombe. Voyants vérifiés après.',
          '<strong>Après</strong> : inventaire et schéma mis à jour, ticket clos avec ce qui a été fait, rien laissé dans la salle.'),
    note('blue', '💡 Les « mains distantes »',
         'En colocation, l’hébergeur propose un service de <em>remote hands</em> : un technicien sur '
         'place redémarre un serveur, change un disque, branche un câble à ta demande, contre une '
         'facturation à l’heure. Une procédure claire, avec la position en U et la couleur du câble, '
         'évite les allers-retours.'),

    '<h2>7) Sécurité physique et environnement</h2>',
    bullets('Contrôle d’accès tracé, vidéosurveillance, détection d’intrusion.',
            '<strong>Détection incendie</strong> très précoce (aspiration) et <strong>extinction par gaz</strong> inerte (pas d’eau, pas de poudre) : quand l’alarme sonne, on sort.',
            'Détection de fuite d’eau sous le faux plancher.',
            'Pour une salle serveur d’entreprise : les mêmes principes à petite échelle — porte fermée, extincteur CO₂, pas de stockage de cartons, sonde de température qui alerte la supervision.'),

    retenir('Du local technique au datacenter, les mêmes besoins : <strong>énergie sans coupure, froid, place, accès contrôlé</strong>.',
            'Tier I à IV : le III permet la <strong>maintenance sans arrêt</strong> ; le Tier ne rend pas un serveur seul redondant.',
            'Deux voies électriques → deux PDU → <strong>deux alimentations sur des PDU différents</strong>.',
            'Allée froide devant, chaude derrière ; obturateurs ; PUE.',
            'Intervention : demande d’accès, procédure écrite, <strong>on ne touche que sa baie</strong>, étiquette lue deux fois, inventaire à jour.'),
])

# ════════════════════════════════════════════════════ Docker en 30 min ══

DOCKER = '\n'.join([
    hero('Cours · Virtualisation', 'Docker en 30 minutes',
         'Ce qu’est un conteneur par rapport à une VM, installer Docker sur Debian, lancer un premier '
         'service, le rendre persistant, et décrire une pile entière dans un fichier Compose.'),
    STYLE,
    note('gray', '📚 Avant ce cours',
         '<a href="/pages/virtualisation-theorie">La virtualisation : théorie</a> pour les hyperviseurs, '
         '<a href="/pages/linux-bases">Linux : les bases</a> pour le terminal.'),
    '<p>De plus en plus de services arrivent « en conteneur » : un outil de supervision, un GLPI, un '
    'Nextcloud, un Pi-hole. Le REAC 2026 cite les « environnements virtualisés » et la '
    '« conteneurisation » : un technicien doit savoir lancer, exploiter et dépanner un conteneur '
    'Docker, même s’il n’en construit pas.</p>',

    '<h2>1) Conteneur ou VM ?</h2>',
    tab(['', 'Machine virtuelle', 'Conteneur'], [
        ['Ce qui est isolé', 'Une machine entière : noyau, OS, services', 'Un processus et ses fichiers ; il <strong>partage le noyau</strong> de l’hôte'],
        ['Taille', 'Des Go', 'Des Mo'],
        ['Démarrage', 'Des dizaines de secondes', 'Moins d’une seconde'],
        ['Isolation', 'Forte (hyperviseur)', 'Plus faible (espaces de noms, cgroups) : un noyau vulnérable expose tout'],
        ['Pour', 'Un OS différent, une isolation forte, un serveur « classique »', 'Une application et ses dépendances, reproductible, jetable'],
        ['Où', 'Hyper-V, Proxmox, VMware, cloud', 'Sur une VM Linux, un hôte physique, ou dans le cloud'],
    ]),
    '<p>Les deux se combinent : une VM Debian sur Hyper-V ou Proxmox, et dedans Docker avec dix '
    'conteneurs. C’est la disposition la plus courante en entreprise.</p>',

    '<h2>2) Le vocabulaire</h2>',
    tab(['Terme', 'C’est…', 'Analogie'], [
        ['<strong>Image</strong>', 'Un modèle en lecture seule : le système de fichiers de l’application et ses dépendances', 'Un ISO, un modèle de VM'],
        ['<strong>Conteneur</strong>', 'Une instance en cours d’exécution d’une image', 'La VM créée depuis le modèle'],
        ['<strong>Registre</strong>', 'Où on télécharge les images : Docker Hub, GitHub, un registre privé', 'Un dépôt apt'],
        ['<strong>Volume</strong>', 'Un espace de stockage qui survit au conteneur', 'Le disque de données'],
        ['<strong>Réseau</strong>', 'Un réseau virtuel entre conteneurs ; les ports publiés sortent sur l’hôte', 'Le vSwitch et le NAT'],
        ['<strong>Dockerfile</strong>', 'La recette pour construire une image', 'Un script d’installation'],
        ['<strong>Compose</strong>', 'Un fichier YAML qui décrit plusieurs conteneurs, leurs volumes et réseaux', 'Le plan de la pile'],
    ]),

    '<h2>3) Installer Docker sur Debian 12</h2>',
    cmd('# dépôt officiel Docker (celui de Debian est plus ancien)\n'
        'sudo apt update && sudo apt install -y ca-certificates curl\n'
        'sudo install -m 0755 -d /etc/apt/keyrings\n'
        'sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc\n'
        'echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian bookworm stable" | sudo tee /etc/apt/sources.list.d/docker.list\n'
        'sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin\n'
        'sudo usermod -aG docker $USER      # puis se reconnecter\n'
        'docker version && docker run --rm hello-world'),
    note('yellow', '⚠️ Le groupe docker = root',
         'Un membre du groupe <code>docker</code> peut monter <code>/</code> dans un conteneur et devenir '
         'root sur l’hôte. On n’y met que les administrateurs — c’est un droit d’administration, pas '
         'un confort.'),

    '<h2>4) Premier service : un serveur web</h2>',
    cmd('docker run -d --name web -p 8080:80 nginx:1.27\n'
        '#          │   │           │          └ image:version (jamais "latest" en production)\n'
        '#          │   │           └ port 8080 de l’hôte → port 80 du conteneur\n'
        '#          │   └ un nom, pour ne pas manipuler des identifiants\n'
        '#          └ détaché (en arrière-plan)\n'
        'curl -I http://localhost:8080          # HTTP/1.1 200 OK\n'
        'docker ps                              # ce qui tourne\n'
        'docker logs -f web                     # les journaux (Ctrl+C pour sortir)\n'
        'docker exec -it web bash               # un terminal DANS le conteneur\n'
        'docker stop web && docker rm web       # arrêt, suppression : tout ce qui était dedans disparaît'),
    '<p>Ce dernier point est la règle des conteneurs : ils sont <strong>jetables</strong>. Ce qui doit '
    'survivre — la configuration, les données — se met dans un volume.</p>',
    cmd('mkdir -p /srv/web/html && echo "<h1>Intranet</h1>" > /srv/web/html/index.html\n'
        'docker run -d --name web -p 8080:80 --restart unless-stopped \\\n'
        '   -v /srv/web/html:/usr/share/nginx/html:ro nginx:1.27\n'
        '#  └ un dossier de l’hôte monté dans le conteneur (ici en lecture seule)\n'
        '#  --restart : redémarre avec l’hôte'),

    '<h2>5) Compose : décrire la pile</h2>',
    '<p>Dès qu’il y a deux conteneurs (une application et sa base), on écrit un fichier '
    '<code>compose.yaml</code> plutôt que des commandes <code>run</code> de trois lignes. Exemple : un '
    'GLPI (ticketing) avec sa base MariaDB.</p>',
    cmd('# /srv/glpi/compose.yaml\n'
        'services:\n'
        '  db:\n'
        '    image: mariadb:11\n'
        '    restart: unless-stopped\n'
        '    environment:\n'
        '      MARIADB_ROOT_PASSWORD_FILE: /run/secrets/db_root\n'
        '      MARIADB_DATABASE: glpi\n'
        '      MARIADB_USER: glpi\n'
        '      MARIADB_PASSWORD_FILE: /run/secrets/db_pass\n'
        '    volumes:\n'
        '      - db:/var/lib/mysql\n'
        '    secrets: [db_root, db_pass]\n'
        '  glpi:\n'
        '    image: glpi/glpi:11.0\n'
        '    restart: unless-stopped\n'
        '    ports: ["8081:80"]\n'
        '    depends_on: [db]\n'
        '    volumes:\n'
        '      - glpi-data:/var/glpi\n'
        'volumes:\n'
        '  db:\n'
        '  glpi-data:\n'
        'secrets:\n'
        '  db_root: { file: ./secrets/db_root.txt }\n'
        '  db_pass: { file: ./secrets/db_pass.txt }'),
    cmd('cd /srv/glpi && docker compose up -d       # crée réseau, volumes, conteneurs\n'
        'docker compose ps\n'
        'docker compose logs -f glpi\n'
        'docker compose pull && docker compose up -d # mise à jour : nouvelle image, données conservées dans les volumes\n'
        'docker compose down                         # arrête et supprime les conteneurs, GARDE les volumes'),
    note('blue', '💡 Les conteneurs se parlent par leur nom',
         'Dans la pile, GLPI joint sa base à l’adresse <code>db:3306</code> : Docker fournit un DNS '
         'interne sur le réseau du projet. Seul le port <code>8081</code> est publié sur l’hôte — la base '
         'n’est pas joignable de l’extérieur.'),

    '<h2>6) Exploiter et dépanner</h2>',
    tab(['Besoin', 'Commande'], [
        ['Qu’est-ce qui tourne, depuis quand, quels ports ?', '<code>docker ps</code>'],
        ['Pourquoi ce conteneur s’arrête-t-il tout de suite ?', '<code>docker logs nom</code> — la cause y est presque toujours (variable manquante, port pris)'],
        ['Combien il consomme ?', '<code>docker stats</code>'],
        ['Quel port est publié sur quoi ?', '<code>docker port nom</code> ; <code>ss -tlnp</code> côté hôte'],
        ['Où sont ses données ?', '<code>docker inspect nom | grep -A5 Mounts</code>'],
        ['Faire de la place', '<code>docker system df</code> puis <code>docker image prune</code> (images inutilisées)'],
        ['Sauvegarder', 'Les volumes (<code>/var/lib/docker/volumes/…</code>) ou un <code>docker run --rm -v vol:/d -v $(pwd):/b debian tar czf /b/vol.tgz -C /d .</code>, plus le fichier compose'],
    ]),
    '<h3>Sécurité minimale</h3>',
    bullets('Des <strong>versions épinglées</strong> (<code>mariadb:11</code>, pas <code>latest</code>), mises à jour volontairement.',
            'Des <strong>images officielles</strong> ou d’éditeurs connus ; une image inconnue sur Docker Hub, c’est un exécutable inconnu qu’on lance en root.',
            'Pas de secret dans le fichier compose ni dans <code>docker inspect</code> : <code>secrets</code> ou un <code>.env</code> protégé.',
            'Ne pas publier de port inutile ; un reverse proxy (Nginx, Traefik) en façade avec HTTPS.',
            'L’hôte reste un serveur Linux à maintenir : <a href="/pages/gerer-mises-a-jour">mises à jour</a>, pare-feu, journaux.'),

    retenir('Un conteneur <strong>partage le noyau</strong> de l’hôte : léger, rapide, moins isolé qu’une VM ; les deux se combinent.',
            'Image → conteneur ; <strong>volume</strong> pour ce qui doit survivre ; port publié pour ce qui doit être joint.',
            '<code>docker run / ps / logs / exec / stop / rm</code> : le quotidien.',
            '<strong>Compose</strong> décrit la pile ; <code>up -d</code>, <code>pull</code>, <code>down</code> ; les conteneurs se joignent par leur nom.',
            'Versions épinglées, images de confiance, pas de secret en clair, groupe docker = root.'),
    note('green', '🔗 La suite',
         '<a href="/pages/proxmox-multi-hotes">Proxmox : un cluster de virtualisation</a> · '
         '<a href="/pages/installer-zabbix">Installer Zabbix</a> (en conteneur ou non) · '
         '<a href="/pages/cloud-premiers-pas">Le cloud : premiers pas</a>.'),
])

# ══════════════════════════════════════════════════════════════ Proxmox ══

PROXMOX = '\n'.join([
    hero('Cours · Virtualisation', 'Proxmox VE : de l’hôte unique au cluster',
         'L’hyperviseur libre qu’on trouve partout : installer, créer VM et conteneurs LXC, puis '
         'assembler plusieurs hôtes — stockage partagé, migration à chaud, haute disponibilité et '
         'sauvegardes.'),
    STYLE,
    note('gray', '📚 Avant ce cours',
         '<a href="/pages/virtualisation-theorie">La virtualisation : théorie</a> et '
         '<a href="/pages/virtualisation">Hyper-V</a> : Proxmox fait la même chose, autrement.'),
    '<p>Proxmox Virtual Environment est une distribution Debian qui embarque KVM (machines virtuelles), '
    'LXC (conteneurs système) et une interface web. Gratuit, complet, il équipe une grande partie des '
    'PME et des laboratoires. Le REAC 2026 demande de savoir « mettre en œuvre un environnement '
    'virtualisé multi-hôtes » : c’est exactement ce que Proxmox permet sans licence.</p>',

    '<h2>1) Hyper-V et Proxmox, face à face</h2>',
    tab(['', 'Hyper-V', 'Proxmox VE'], [
        ['Base', 'Windows Server (rôle) ou Hyper-V Server', 'Debian + KVM/QEMU + LXC'],
        ['Administration', 'Gestionnaire Hyper-V, PowerShell, SCVMM', 'Interface web (port 8006), <code>qm</code>/<code>pct</code> en CLI, API'],
        ['Conteneurs', 'Conteneurs Windows (peu utilisés)', 'LXC natifs : un Debian en 50 Mo, démarré en 2 s'],
        ['Cluster', 'Cluster de basculement Windows (licence Datacenter pour les VM illimitées)', 'Cluster intégré, gratuit ; HA incluse'],
        ['Stockage partagé', 'CSV sur iSCSI/FC, SMB 3, S2D', 'NFS, iSCSI, Ceph intégré, ZFS répliqué'],
        ['Sauvegarde', 'Windows Server Backup, Veeam, DPM', 'vzdump intégré, Proxmox Backup Server (déduplication, incrémental)'],
        ['Licence', 'Incluse dans Windows Server ; CAL, licence par cœur pour les VM Windows', 'Libre ; abonnement optionnel pour le dépôt entreprise et le support'],
    ]),

    '<h2>2) Installer un premier hôte</h2>',
    steps('Un serveur avec VT-x/AMD-V activé dans le BIOS, deux disques idéalement (système et VM), deux cartes réseau (production, administration/stockage).',
          'ISO Proxmox VE sur clé USB ; installation guidée : disque système (ext4 ou ZFS en miroir si deux disques), pays, mot de passe root, IP de management <strong>fixe</strong>, nom complet (<code>pve1.entreprise.local</code>).',
          'Interface web : <code>https://IP:8006</code>, compte <code>root@pam</code>. L’avertissement de certificat est normal (auto-signé) — remplaçable par un certificat de la <a href="/pages/pki-adcs">PKI interne</a>.',
          'Sans abonnement : désactiver le dépôt entreprise et activer le dépôt <code>pve-no-subscription</code> (' + menu('Nœud › Dépôts') + '), puis ' + menu('Mises à jour › Actualiser › Mettre à niveau') + '.',
          'Le réseau : le pont <code>vmbr0</code> (créé à l’installation) est le vSwitch ; les VM s’y branchent. Un second pont ou un VLAN tag par VM pour la segmentation.'),
    cmd('# côté CLI, ce que l’interface fait\n'
        'pveversion\n'
        'pvesm status                    # les stockages : local (ISO, modèles), local-lvm (disques de VM)\n'
        'ip a show vmbr0'),

    '<h2>3) VM et conteneurs</h2>',
    '<h3>Une VM (KVM)</h3>',
    bullets('ISO envoyé dans ' + menu('local › ISO Images'),
            menu('Créer VM') + ' : nom, ISO, type d’OS, <strong>BIOS UEFI + TPM</strong> pour Windows 11, disque VirtIO SCSI, mémoire, cœurs, carte réseau VirtIO.',
            'Pour Windows : les pilotes VirtIO (ISO <code>virtio-win</code>) à monter pendant l’installation — sinon pas de disque visible.',
            'L’agent invité (<code>qemu-guest-agent</code>) dans la VM : IP visible dans l’interface, arrêt propre, instantanés cohérents.'),
    '<h3>Un conteneur LXC</h3>',
    bullets('Un modèle téléchargé (' + menu('local › CT Templates › Templates') + ' : Debian, Ubuntu, Alpine…).',
            menu('Créer CT') + ' : nom, mot de passe ou clé SSH, modèle, 8 Go de disque, 512 Mo de RAM, IP.',
            'Démarré en deux secondes, il partage le noyau de l’hôte (comme <a href="/pages/docker-30-minutes">Docker</a>, mais avec un système complet dedans : systemd, SSH, cron).',
            'Parfait pour un DNS, un Pi-hole, un reverse proxy, un Zabbix ; pas pour Docker lui-même (conteneur dans conteneur = ennuis) ni pour Windows.'),
    cmd('qm list                                    # les VM\n'
        'pct list                                   # les conteneurs\n'
        'qm start 101 ; qm shutdown 101             # cycle de vie\n'
        'qm snapshot 101 avant-maj                  # instantané (VM sur local-lvm, ZFS ou Ceph)\n'
        'pct enter 200                              # un shell dans le conteneur 200'),

    '<h2>4) Le cluster : plusieurs hôtes, une console</h2>',
    '<p>Trois hôtes (deux au minimum, avec un « QDevice » pour départager) forment un cluster : une seule '
    'interface, des VM déplaçables d’un hôte à l’autre, et la haute disponibilité. Le cluster repose sur '
    '<strong>Corosync</strong>, qui a besoin d’un réseau à faible latence — idéalement une carte dédiée.</p>',
    steps('Sur le premier hôte : ' + menu('Datacenter › Cluster › Créer un cluster') + ' (nom, réseau Corosync).',
          'Sur chaque autre hôte, <strong>vide de VM</strong> : ' + menu('Datacenter › Cluster › Rejoindre') + ' avec les informations de jonction copiées du premier.',
          'Vérifier le quorum : <code>pvecm status</code> — « Quorate: Yes ».',
          'Un hôte qui perd le quorum se met en lecture seule : c’est voulu (éviter que deux hôtes lancent la même VM).'),
    cmd('pvecm create cluster-entreprise --link0 10.10.99.1\n'
        'pvecm add 10.10.99.1                       # depuis pve2, pve3\n'
        'pvecm status | grep -E "Nodes|Quorate"'),
    note('yellow', '⚠️ Deux hôtes seulement ?',
         'Deux votes : si l’un tombe, l’autre n’a plus la majorité et se bloque. Un troisième vote '
         'suffit — un petit Debian (un NAS, un Raspberry) avec <code>corosync-qnetd</code> en QDevice.'),

    '<h2>5) Stockage partagé : la condition de la migration</h2>',
    tab(['Option', 'Principe', 'Pour'], [
        ['<strong>NFS</strong> sur un NAS', 'Les disques de VM sont des fichiers sur le NAS, vus par tous les hôtes', 'Simple ; le NAS devient le point unique de panne'],
        ['<strong>iSCSI</strong> + LVM', 'Un LUN partagé, découpé en volumes', 'Baie de stockage existante'],
        ['<strong>ZFS + réplication</strong>', 'Chaque hôte a son ZFS ; les VM sont répliquées toutes les N minutes vers un autre hôte', 'Deux ou trois hôtes sans stockage externe ; perte des dernières minutes en cas de bascule'],
        ['<strong>Ceph</strong>', 'Stockage distribué sur les disques des hôtes eux-mêmes, répliqué 3 fois', 'À partir de 3 hôtes ; aucun point unique ; demande du réseau (10 Gb/s) et de la méthode'],
    ]),
    '<p>Avec un stockage partagé, la <strong>migration à chaud</strong> (' + menu('VM › Migrer') +
    ') déplace une VM allumée d’un hôte à l’autre en quelques secondes, sans coupure perceptible : '
    'seule la mémoire est copiée. Sans stockage partagé, la migration copie aussi le disque — possible, '
    'mais longue.</p>',

    '<h2>6) Haute disponibilité</h2>',
    bullets('Une VM déclarée en HA (' + menu('Datacenter › HA › Ajouter') + ') est <strong>redémarrée automatiquement sur un autre hôte</strong> si le sien tombe — en une à deux minutes, avec l’arrêt brutal que ça suppose (c’est un redémarrage, pas une migration).',
            'Condition : stockage partagé (ou réplication ZFS) et quorum.',
            'Un <em>fencing</em> par watchdog : un hôte isolé se redémarre lui-même pour ne pas laisser tourner une VM en double.',
            'Ce que la HA ne couvre pas : la panne <em>dans</em> la VM (service planté, OS bloqué) — c’est le rôle de la <a href="/pages/supervision">supervision</a>.'),

    '<h2>7) Sauvegarder : vzdump et Proxmox Backup Server</h2>',
    bullets('<strong>vzdump</strong> intégré (' + menu('Datacenter › Sauvegarde') + ') : une tâche planifiée qui archive les VM (instantané, suspension ou arrêt) vers un stockage (NFS, disque USB, PBS). Complète à chaque fois.',
            '<strong>Proxmox Backup Server</strong> : un serveur dédié qui reçoit des sauvegardes <strong>incrémentales dédupliquées</strong>, vérifie leur intégrité, les chiffre, et les réplique vers un second PBS distant. Restauration d’une VM entière ou d’un seul fichier.',
            'Règle 3-2-1 et test de restauration : voir <a href="/pages/pra-pca">PRA / PCA</a> et <a href="/pages/sauvegarde-vm-hyperv">Sauvegarder des VM</a>.'),
    cmd('vzdump 101 --storage pbs --mode snapshot --notes-template "{{guestname}}"\n'
        'qmrestore /mnt/pve/nfs/dump/vzdump-qemu-101-*.vma.zst 151   # restaurer sous un nouvel ID'),

    '<h2>8) Exploiter</h2>',
    tab(['Tâche', 'Où / comment'], [
        ['Mises à jour de l’hôte', menu('Nœud › Mises à jour') + ' ; migrer les VM avant de redémarrer un hôte du cluster — c’est tout l’intérêt'],
        ['Utilisateurs et droits', menu('Datacenter › Permissions') + ' : comptes locaux ou <strong>AD/LDAP</strong>, rôles (PVEVMUser pour un utilisateur qui gère ses VM), MFA (TOTP) sur root'],
        ['Pare-feu', 'Intégré, à trois niveaux (datacenter, hôte, VM)'],
        ['Supervision', 'Métriques exportées vers InfluxDB/Graphite ; ou un agent Zabbix sur l’hôte'],
        ['Journaux', '<code>journalctl -u pve-cluster</code>, ' + menu('Nœud › Syslog') + ', ' + menu('Tâches') + ' en bas de l’interface'],
    ]),

    retenir('Proxmox = Debian + KVM + LXC + interface web ; libre ; VM et conteneurs système.',
            'Premier hôte : IP fixe, dépôt no-subscription, <code>vmbr0</code> = vSwitch ; VirtIO et agent invité.',
            '<strong>Cluster</strong> : 3 votes minimum (ou QDevice), Corosync sur un réseau dédié, quorum.',
            '<strong>Stockage partagé</strong> (NFS, iSCSI, ZFS répliqué, Ceph) = migration à chaud et <strong>HA</strong>.',
            'Sauvegardes vzdump / <strong>PBS</strong> (incrémental dédupliqué, répliqué), et le test de restauration.'),
])

PAGES_CLOUD = [
    ('entra-id', 'Entra ID : l’annuaire dans le cloud',
     'Tenant, utilisateurs et groupes cloud, Entra Connect (PHS, PTA, fédération), postes joints hybrides, administration et pannes classiques.',
     ENTRA, 'Identité hybride',
     'Le tenant, Entra Connect et la synchronisation de l’AD, les postes hybrides, l’administration au quotidien.'),
    ('mfa-acces-conditionnel', 'MFA et accès conditionnel',
     'Les facteurs, les méthodes (SMS à FIDO2), activer la MFA dans Entra, écrire des stratégies d’accès conditionnel, le compte de secours, les cas de support.',
     MFA, 'Identité hybride',
     'Les méthodes MFA, l’accès conditionnel « si… alors », les stratégies de base, le break glass et le support.'),
    ('cycle-vie-compte', 'Le cycle de vie d’un compte',
     'Arrivée, changement, absence, départ : processus, listes de contrôle AD/Entra, commandes PowerShell, revue trimestrielle, RGPD.',
     CYCLE, 'Identité hybride',
     'Onboarding par modèle de rôle, mutation (retirer !), offboarding le jour même, revue des comptes.'),
    ('zero-trust-iam', 'Zero trust, PSSI et gestion des identités',
     'PSSI, RSSI, guides ANSSI, principes du zero trust, IAM, comptes à privilèges (tiering, LAPS), recommandations mots de passe.',
     ZT, 'Sécurité &amp; gouvernance',
     'Le cadre : PSSI, RSSI, ANSSI ; zero trust ; IAM et comptes à privilèges ; ce que le technicien fait et ne fait pas.'),
    ('pki-adcs', 'Certificats, PKI et AD CS',
     'Ce qu’un certificat prouve, CA publique ou interne, architecture racine hors ligne + émettrice, installation AD CS, modèles, auto-inscription, cas d’usage.',
     PKI, 'Sécurité &amp; gouvernance',
     'Certificats et CA, installer AD CS, modèles et auto-inscription par GPO, HTTPS interne, 802.1X, signature de scripts.'),
    ('cloud-premiers-pas', 'Le cloud : premiers pas',
     'IaaS / PaaS / SaaS, public / privé / hybride, responsabilité partagée, briques Azure/AWS, première VM, coûts, souveraineté (SecNumCloud).',
     CLOUD, 'Cloud &amp; datacenter',
     'Modèles de service et de déploiement, responsabilité partagée, première VM et NSG, ce que ça coûte, SecNumCloud.'),
    ('datacenter', 'Le datacenter et la salle serveur',
     'Tiers, énergie (deux voies, onduleur, groupe), froid (allées, PUE), baie et câblage, règles d’intervention en datacenter, sécurité physique.',
     DC, 'Cloud &amp; datacenter',
     'Niveaux Tier, énergie et froid, la baie, intervenir dans une salle sans rien débrancher qu’il ne fallait pas.'),
]

PAGES_VIRT = [
    ('docker-30-minutes', 'Docker en 30 minutes',
     'Conteneur ou VM, installer Docker sur Debian, premier service, volumes, Compose avec une pile GLPI + MariaDB, exploitation et sécurité minimale.',
     DOCKER, 'Virtualisation',
     'Conteneur vs VM, installer Docker, run / logs / exec, volumes, Compose (GLPI + base), dépannage.'),
    ('proxmox-multi-hotes', 'Proxmox VE : de l’hôte unique au cluster',
     'Installer Proxmox, VM KVM et conteneurs LXC, cluster et quorum, stockage partagé et migration à chaud, HA, sauvegardes vzdump / PBS.',
     PROXMOX, 'Virtualisation',
     'Hyper-V vs Proxmox, premier hôte, VM et LXC, cluster, stockage partagé, migration, HA, PBS.'),
]

LOTS = [(PAGES_CLOUD, CAT), (PAGES_VIRT, SOFT)]

if __name__ == '__main__':
    for pages, cat in LOTS:
        publier_lot(pages, cat)
    sys.exit(0)

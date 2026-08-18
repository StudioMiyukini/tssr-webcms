// Inventaire des stratégies de groupe (GPO) — données.
//
// Il existe plus de quatre mille paramètres de stratégie dans un Windows
// moderne : les lister tous serait recopier la documentation Microsoft, et
// personne ne cherche dedans. Ce fichier retient ceux qu'un administrateur
// pose réellement, et surtout **où les retrouver**, parce que c'est là que le
// temps se perd — le nom du paramètre est connu, son emplacement jamais.
//
// Chaque entrée porte son nom français ET anglais : la moitié de la
// documentation, tous les forums et la totalité des noms de clés sont en
// anglais, et une console française n'aide pas à faire le lien.
//
// Les alias sont ce qui rend la recherche utile : personne ne tape « Accès au
// stockage amovible », on tape « USB » ou « clé ».

export type GpoScope = 'ordinateur' | 'utilisateur';

export interface GpoCategorie {
  key: string;
  label: string;
  icon: string;
}

export interface GpoEntry {
  /** Nom du paramètre, tel qu'affiché dans une console française. */
  nom: string;
  /** Nom anglais — indispensable pour retrouver la documentation. */
  nomEn: string;
  scope: GpoScope;
  categorie: string;
  /** Chemin dans l'arborescence, sous Configuration ordinateur/utilisateur. */
  chemin: string[];
  /** Ce que le paramètre fait, en une phrase. */
  effet: string;
  /** Valeurs typiques ou recommandées. */
  valeurs?: string;
  /** Le piège, quand il y en a un. */
  piege?: string;
  /** Mots que l'on tape réellement pour chercher ce paramètre. */
  alias?: string[];
}

export const GPO_CATEGORIES: GpoCategorie[] = [
  { key: 'comptes', label: 'Mots de passe & comptes', icon: '🔑' },
  { key: 'securite', label: 'Options de sécurité', icon: '🛡️' },
  { key: 'droits', label: 'Droits utilisateur', icon: '⚖️' },
  { key: 'session', label: 'Ouverture de session', icon: '🚪' },
  { key: 'bureau', label: 'Bureau & interface', icon: '🖥️' },
  { key: 'peripheriques', label: 'Périphériques & USB', icon: '🔌' },
  { key: 'reseau', label: 'Réseau & pare-feu', icon: '🌐' },
  { key: 'deploiement', label: 'Déploiement & préférences', icon: '📦' },
  { key: 'maj', label: 'Mises à jour & défense', icon: '🔄' },
  { key: 'moteur', label: 'Moteur de stratégie', icon: '⚙️' },
];

// Racines répétées, pour ne pas les réécrire cinquante fois.
const SEC = ['Paramètres Windows', 'Paramètres de sécurité'];
const ADM_O = ['Modèles d\'administration'];
const ADM_U = ['Modèles d\'administration'];

export const GPO_ENTRIES: GpoEntry[] = [
  // ---------------------------------------------------------------- comptes
  {
    nom: 'Longueur minimale du mot de passe', nomEn: 'Minimum password length',
    scope: 'ordinateur', categorie: 'comptes',
    chemin: [...SEC, 'Stratégies de comptes', 'Stratégie de mot de passe'],
    effet: 'Nombre minimal de caractères exigé.',
    valeurs: '12 à 14 caractères pour un domaine récent (8 est un plancher historique, plus une recommandation).',
    piege: 'Une seule stratégie de mot de passe s\'applique au domaine, et elle vient obligatoirement d\'une GPO liée à la RACINE du domaine. La lier à une OU ne fait rien pour les comptes de domaine — il faut une PSO (stratégie de mot de passe affinée).',
    alias: ['mot de passe', 'password', 'longueur', 'complexité', 'mdp'],
  },
  {
    nom: 'Le mot de passe doit respecter des exigences de complexité', nomEn: 'Password must meet complexity requirements',
    scope: 'ordinateur', categorie: 'comptes',
    chemin: [...SEC, 'Stratégies de comptes', 'Stratégie de mot de passe'],
    effet: 'Impose trois des quatre familles de caractères et interdit le nom du compte dans le mot de passe.',
    valeurs: 'Activé',
    alias: ['complexité', 'majuscule', 'chiffre', 'caractère spécial', 'password'],
  },
  {
    nom: 'Durée de vie maximale du mot de passe', nomEn: 'Maximum password age',
    scope: 'ordinateur', categorie: 'comptes',
    chemin: [...SEC, 'Stratégies de comptes', 'Stratégie de mot de passe'],
    effet: 'Nombre de jours avant expiration forcée.',
    valeurs: '0 = jamais. Les recommandations récentes (NIST, ANSSI) déconseillent l\'expiration périodique sans motif.',
    alias: ['expiration', 'renouvellement', 'age', 'password'],
  },
  {
    nom: 'Conserver l\'historique des mots de passe', nomEn: 'Enforce password history',
    scope: 'ordinateur', categorie: 'comptes',
    chemin: [...SEC, 'Stratégies de comptes', 'Stratégie de mot de passe'],
    effet: 'Nombre d\'anciens mots de passe mémorisés, pour empêcher la réutilisation.',
    valeurs: '24',
    alias: ['historique', 'réutilisation', 'password'],
  },
  {
    nom: 'Seuil de verrouillage du compte', nomEn: 'Account lockout threshold',
    scope: 'ordinateur', categorie: 'comptes',
    chemin: [...SEC, 'Stratégies de comptes', 'Stratégie de verrouillage du compte'],
    effet: 'Nombre d\'échecs d\'ouverture de session avant blocage du compte.',
    valeurs: '5 à 10. 0 désactive le verrouillage.',
    piege: 'Un seuil trop bas transforme n\'importe quel service utilisant un ancien mot de passe en déni de service permanent sur le compte.',
    alias: ['verrouillage', 'lockout', 'blocage', 'tentatives', 'brute force'],
  },
  {
    nom: 'Durée de verrouillage du compte', nomEn: 'Account lockout duration',
    scope: 'ordinateur', categorie: 'comptes',
    chemin: [...SEC, 'Stratégies de comptes', 'Stratégie de verrouillage du compte'],
    effet: 'Minutes pendant lesquelles le compte reste bloqué.',
    valeurs: '15 à 30 minutes. 0 = déblocage manuel par un administrateur.',
    alias: ['verrouillage', 'lockout', 'durée'],
  },

  // --------------------------------------------------------------- securite
  {
    nom: 'Comptes : renommer le compte Administrateur', nomEn: 'Accounts: Rename administrator account',
    scope: 'ordinateur', categorie: 'securite',
    chemin: [...SEC, 'Stratégies locales', 'Options de sécurité'],
    effet: 'Change le nom du compte administrateur local intégré.',
    piege: 'Cosmétique : le SID reste identique et se retrouve en une commande. Cela ralentit un script naïf, pas un attaquant.',
    alias: ['administrateur', 'renommer', 'admin local'],
  },
  {
    nom: 'Ouverture de session interactive : ne pas afficher le dernier nom d\'utilisateur', nomEn: 'Interactive logon: Do not display last user name',
    scope: 'ordinateur', categorie: 'securite',
    chemin: [...SEC, 'Stratégies locales', 'Options de sécurité'],
    effet: 'L\'écran de connexion n\'affiche plus le compte précédent : il faut saisir l\'identifiant.',
    valeurs: 'Activé sur les postes partagés et les serveurs.',
    alias: ['dernier utilisateur', 'écran de connexion', 'nom affiché'],
  },
  {
    nom: 'Contrôle de compte d\'utilisateur : comportement de l\'invite d\'élévation pour les administrateurs', nomEn: 'User Account Control: Behavior of the elevation prompt for administrators',
    scope: 'ordinateur', categorie: 'securite',
    chemin: [...SEC, 'Stratégies locales', 'Options de sécurité'],
    effet: 'Règle l\'UAC : demander un consentement, demander les identifiants, ou élever sans rien demander.',
    valeurs: '« Demande de consentement sur le Bureau sécurisé » par défaut.',
    alias: ['UAC', 'élévation', 'contrôle de compte', 'prompt'],
  },
  {
    nom: 'Accès réseau : ne pas autoriser l\'énumération anonyme des comptes SAM et des partages', nomEn: 'Network access: Do not allow anonymous enumeration of SAM accounts and shares',
    scope: 'ordinateur', categorie: 'securite',
    chemin: [...SEC, 'Stratégies locales', 'Options de sécurité'],
    effet: 'Empêche un anonyme de lister les comptes et partages de la machine.',
    valeurs: 'Activé',
    alias: ['anonyme', 'null session', 'SAM', 'énumération', 'partages'],
  },
  {
    nom: 'Sécurité réseau : ne pas stocker les valeurs de hachage LAN Manager', nomEn: 'Network security: Do not store LAN Manager hash value on next password change',
    scope: 'ordinateur', categorie: 'securite',
    chemin: [...SEC, 'Stratégies locales', 'Options de sécurité'],
    effet: 'Supprime le stockage du hachage LM, cassable en quelques minutes.',
    valeurs: 'Activé',
    alias: ['LM', 'NTLM', 'hash', 'hachage'],
  },
  {
    nom: 'Journal d\'audit : auditer l\'ouverture de session', nomEn: 'Audit logon events',
    scope: 'ordinateur', categorie: 'securite',
    chemin: [...SEC, 'Stratégies locales', 'Stratégie d\'audit'],
    effet: 'Trace les ouvertures de session réussies et/ou échouées dans le journal Sécurité.',
    valeurs: 'Succès et Échec',
    piege: 'La stratégie d\'audit « avancée » (Configuration avancée de la stratégie d\'audit) écrase celle-ci. Ne pas mélanger les deux.',
    alias: ['audit', 'journal', 'traçabilité', 'événement', 'log'],
  },

  // ----------------------------------------------------------------- droits
  {
    nom: 'Autoriser l\'ouverture de session par les services Bureau à distance', nomEn: 'Allow log on through Remote Desktop Services',
    scope: 'ordinateur', categorie: 'droits',
    chemin: [...SEC, 'Stratégies locales', 'Attribution des droits utilisateur'],
    effet: 'Liste les groupes autorisés à ouvrir une session RDP.',
    piege: 'Cette liste REMPLACE l\'existant, elle ne s\'y ajoute pas. Oublier « Administrateurs » ou « Utilisateurs du Bureau à distance » vous enferme dehors.',
    alias: ['RDP', 'bureau à distance', 'TSE', 'remote desktop'],
  },
  {
    nom: 'Interdire l\'ouverture de session locale', nomEn: 'Deny log on locally',
    scope: 'ordinateur', categorie: 'droits',
    chemin: [...SEC, 'Stratégies locales', 'Attribution des droits utilisateur'],
    effet: 'Empêche les comptes listés d\'ouvrir une session sur la console.',
    valeurs: 'Classique sur les serveurs : y placer les comptes de service.',
    alias: ['interdire', 'deny', 'session locale', 'console'],
  },
  {
    nom: 'Ouvrir une session en tant que service', nomEn: 'Log on as a service',
    scope: 'ordinateur', categorie: 'droits',
    chemin: [...SEC, 'Stratégies locales', 'Attribution des droits utilisateur'],
    effet: 'Autorise un compte à faire tourner un service Windows.',
    piege: 'Sans ce droit, le service refuse de démarrer avec une erreur 1069 qui ne dit pas d\'où vient le problème.',
    alias: ['service', 'compte de service', 'logon as a service', '1069'],
  },
  {
    nom: 'Ajouter des stations de travail au domaine', nomEn: 'Add workstations to domain',
    scope: 'ordinateur', categorie: 'droits',
    chemin: [...SEC, 'Stratégies locales', 'Attribution des droits utilisateur'],
    effet: 'Qui peut joindre une machine au domaine.',
    piege: 'Par défaut, tout utilisateur authentifié peut joindre jusqu\'à DIX machines. C\'est un quota d\'annuaire (ms-DS-MachineAccountQuota), pas cette GPO — les deux se combinent.',
    alias: ['joindre le domaine', 'domain join', 'station', 'quota'],
  },

  // ---------------------------------------------------------------- session
  {
    nom: 'Toujours attendre le réseau lors du démarrage et de l\'ouverture de session', nomEn: 'Always wait for the network at computer startup and logon',
    scope: 'ordinateur', categorie: 'session',
    chemin: [...ADM_O, 'Système', 'Ouverture de session'],
    effet: 'Force l\'attente d\'un réseau opérationnel avant d\'appliquer les stratégies.',
    valeurs: 'Activé',
    piege: 'Sans cela, les scripts d\'ouverture de session et les mappages de lecteurs échouent au premier démarrage et ne « prennent » qu\'à la deuxième ouverture. C\'est la cause n° 1 des lecteurs réseau absents.',
    alias: ['lecteur réseau absent', 'script ne marche pas', 'attendre le réseau', 'démarrage lent'],
  },
  {
    nom: 'Scripts (démarrage / arrêt)', nomEn: 'Scripts (Startup/Shutdown)',
    scope: 'ordinateur', categorie: 'session',
    chemin: ['Paramètres Windows', 'Scripts (démarrage/arrêt)'],
    effet: 'Exécute un script au démarrage de la machine, sous le compte SYSTEM.',
    piege: 'SYSTEM n\'a aucun accès réseau authentifié en tant qu\'utilisateur : un script de démarrage ne peut pas mapper un lecteur pour l\'utilisateur.',
    alias: ['script', 'batch', 'powershell', 'démarrage', 'startup'],
  },
  {
    nom: 'Scripts (ouverture / fermeture de session)', nomEn: 'Scripts (Logon/Logoff)',
    scope: 'utilisateur', categorie: 'session',
    chemin: ['Paramètres Windows', 'Scripts (ouverture/fermeture de session)'],
    effet: 'Exécute un script à l\'ouverture de session, sous le compte de l\'utilisateur.',
    piege: 'Placer le script dans le dossier NETLOGON du domaine plutôt que sur un chemin local : sinon il n\'existe que sur la machine où on l\'a écrit.',
    alias: ['script', 'logon', 'ouverture de session', 'netlogon', 'batch'],
  },
  {
    nom: 'Supprimer les profils utilisateur plus vieux qu\'un nombre de jours spécifié', nomEn: 'Delete user profiles older than a specified number of days on system restart',
    scope: 'ordinateur', categorie: 'session',
    chemin: [...ADM_O, 'Système', 'Profils utilisateur'],
    effet: 'Nettoie les profils inactifs au redémarrage.',
    valeurs: '30 à 90 jours sur les postes partagés et les serveurs RDS.',
    alias: ['profil', 'disque plein', 'nettoyage', 'profils'],
  },
  {
    nom: 'Redirection de dossiers', nomEn: 'Folder Redirection',
    scope: 'utilisateur', categorie: 'session',
    chemin: ['Paramètres Windows', 'Redirection de dossiers'],
    effet: 'Redirige Documents, Bureau, Images… vers un partage réseau.',
    piege: 'Cocher « Déplacer le contenu vers le nouvel emplacement » lors de la première application, sinon l\'utilisateur croit avoir perdu ses fichiers.',
    alias: ['documents', 'bureau', 'mes documents', 'redirection', 'folder redirection', 'home'],
  },

  // ----------------------------------------------------------------- bureau
  {
    nom: 'Interdire l\'accès au Panneau de configuration et à l\'application Paramètres', nomEn: 'Prohibit access to Control Panel and PC settings',
    scope: 'utilisateur', categorie: 'bureau',
    chemin: [...ADM_U, 'Panneau de configuration'],
    effet: 'Bloque l\'ouverture du Panneau de configuration et de Paramètres.',
    alias: ['panneau de configuration', 'control panel', 'paramètres', 'bloquer'],
  },
  {
    nom: 'Empêcher l\'accès à l\'invite de commandes', nomEn: 'Prevent access to the command prompt',
    scope: 'utilisateur', categorie: 'bureau',
    chemin: [...ADM_U, 'Système'],
    effet: 'Désactive cmd.exe, et au choix les scripts .bat/.cmd.',
    piege: 'Ne bloque ni PowerShell, ni le Terminal Windows. Une mesure de confort, pas une barrière de sécurité.',
    alias: ['cmd', 'invite de commandes', 'terminal', 'bloquer'],
  },
  {
    nom: 'Empêcher l\'accès aux outils de modification du Registre', nomEn: 'Prevent access to registry editing tools',
    scope: 'utilisateur', categorie: 'bureau',
    chemin: [...ADM_U, 'Système'],
    effet: 'Désactive regedit.',
    alias: ['regedit', 'registre', 'registry', 'bloquer'],
  },
  {
    nom: 'Exécuter uniquement les applications Windows spécifiées', nomEn: 'Run only specified Windows applications',
    scope: 'utilisateur', categorie: 'bureau',
    chemin: [...ADM_U, 'Système'],
    effet: 'Liste blanche d\'exécutables autorisés.',
    piege: 'Se contourne en renommant l\'exécutable. Pour une vraie liste blanche, il faut AppLocker ou WDAC.',
    alias: ['liste blanche', 'applocker', 'restreindre', 'applications'],
  },
  {
    nom: 'Masquer ces lecteurs spécifiés dans l\'Explorateur', nomEn: 'Hide these specified drives in My Computer',
    scope: 'utilisateur', categorie: 'bureau',
    chemin: [...ADM_U, 'Composants Windows', 'Explorateur de fichiers'],
    effet: 'Masque des lettres de lecteur dans l\'Explorateur.',
    piege: 'Masque seulement : le lecteur reste accessible en tapant son chemin. « Empêcher l\'accès aux lecteurs » est la version qui bloque vraiment.',
    alias: ['cacher lecteur', 'masquer', 'C:', 'explorateur'],
  },
  {
    nom: 'Empêcher la modification du fond d\'écran', nomEn: 'Prevent changing desktop background',
    scope: 'utilisateur', categorie: 'bureau',
    chemin: [...ADM_U, 'Panneau de configuration', 'Personnalisation'],
    effet: 'Verrouille le papier peint imposé.',
    alias: ['fond d\'écran', 'wallpaper', 'papier peint', 'personnalisation'],
  },
  {
    nom: 'Papier peint du Bureau', nomEn: 'Desktop Wallpaper',
    scope: 'utilisateur', categorie: 'bureau',
    chemin: [...ADM_U, 'Bureau', 'Bureau'],
    effet: 'Impose une image de fond via un chemin UNC.',
    piege: 'Le chemin doit être lisible par les utilisateurs : un partage en lecture seule pour « Utilisateurs du domaine ».',
    alias: ['fond d\'écran', 'wallpaper', 'image', 'bureau'],
  },
  {
    nom: 'Écran de veille — délai d\'expiration', nomEn: 'Screen saver timeout',
    scope: 'utilisateur', categorie: 'bureau',
    chemin: [...ADM_U, 'Panneau de configuration', 'Personnalisation'],
    effet: 'Délai avant mise en veille de l\'écran, à coupler avec « Protection par mot de passe de l\'écran de veille ».',
    valeurs: '600 secondes (10 min)',
    alias: ['écran de veille', 'screensaver', 'verrouillage auto', 'inactivité'],
  },

  // ---------------------------------------------------------- peripheriques
  {
    nom: 'Disques amovibles : refuser l\'accès en écriture', nomEn: 'Removable Disks: Deny write access',
    scope: 'ordinateur', categorie: 'peripheriques',
    chemin: [...ADM_O, 'Système', 'Accès au stockage amovible'],
    effet: 'Les clés USB restent lisibles mais deviennent non inscriptibles.',
    valeurs: 'Activé — la mesure la plus utile contre la fuite de données par USB.',
    alias: ['USB', 'clé USB', 'disque amovible', 'écriture', 'removable', 'fuite'],
  },
  {
    nom: 'Toutes les classes de stockage amovible : refuser tout accès', nomEn: 'All Removable Storage classes: Deny all access',
    scope: 'ordinateur', categorie: 'peripheriques',
    chemin: [...ADM_O, 'Système', 'Accès au stockage amovible'],
    effet: 'Bloque entièrement tout support amovible.',
    piege: 'Bloque aussi les disques externes de sauvegarde et les clés de dépannage du technicien.',
    alias: ['USB', 'bloquer USB', 'stockage amovible', 'interdire'],
  },
  {
    nom: 'Empêcher l\'installation de périphériques non décrits par d\'autres paramètres', nomEn: 'Prevent installation of devices not described by other policy settings',
    scope: 'ordinateur', categorie: 'peripheriques',
    chemin: [...ADM_O, 'Système', 'Installation de périphériques', 'Restrictions d\'installation de périphériques'],
    effet: 'Liste blanche matérielle : seul ce qui est explicitement autorisé s\'installe.',
    piege: 'Sans exception pour les claviers et souris, on peut se retrouver devant un poste inutilisable.',
    alias: ['périphérique', 'driver', 'pilote', 'liste blanche', 'matériel'],
  },
  {
    nom: 'Imprimantes (préférence)', nomEn: 'Printers (Preference)',
    scope: 'utilisateur', categorie: 'peripheriques',
    chemin: ['Préférences', 'Paramètres du Panneau de configuration', 'Imprimantes'],
    effet: 'Déploie une imprimante partagée et la définit par défaut.',
    piege: 'C\'est une PRÉFÉRENCE : l\'utilisateur peut la retirer. Utiliser « Mettre à jour » plutôt que « Créer » pour qu\'elle revienne à chaque ouverture de session.',
    alias: ['imprimante', 'printer', 'déployer', 'impression'],
  },

  // ----------------------------------------------------------------- reseau
  {
    nom: 'Pare-feu Windows Defender avec fonctions avancées de sécurité', nomEn: 'Windows Defender Firewall with Advanced Security',
    scope: 'ordinateur', categorie: 'reseau',
    chemin: [...SEC, 'Pare-feu Windows Defender avec fonctions avancées de sécurité'],
    effet: 'Profils (domaine, privé, public) et règles de trafic entrantes/sortantes.',
    piege: 'Les règles poussées par GPO s\'AJOUTENT aux règles locales, sauf si l\'on force « Appliquer les règles de pare-feu locales : Non ».',
    alias: ['pare-feu', 'firewall', 'règle', 'port', 'bloquer'],
  },
  {
    nom: 'Autoriser les connexions à distance à cet ordinateur', nomEn: 'Allow users to connect remotely by using Remote Desktop Services',
    scope: 'ordinateur', categorie: 'reseau',
    chemin: [...ADM_O, 'Composants Windows', 'Services Bureau à distance', 'Hôte de session Bureau à distance', 'Connexions'],
    effet: 'Active le Bureau à distance sur la machine.',
    piege: 'Activer le service ne suffit pas : il faut aussi ouvrir le port 3389 au pare-feu et donner le droit d\'ouverture de session RDP.',
    alias: ['RDP', 'bureau à distance', '3389', 'remote desktop', 'télémaintenance'],
  },
  {
    nom: 'Configurer le proxy', nomEn: 'Proxy settings',
    scope: 'utilisateur', categorie: 'reseau',
    chemin: ['Préférences', 'Paramètres du Panneau de configuration', 'Paramètres Internet'],
    effet: 'Impose l\'adresse du proxy et les exclusions.',
    alias: ['proxy', 'internet', 'navigateur'],
  },
  {
    nom: 'Activer la découverte du réseau', nomEn: 'Turn on network discovery',
    scope: 'ordinateur', categorie: 'reseau',
    chemin: [...ADM_O, 'Réseau', 'Connexions réseau'],
    effet: 'Rend les machines visibles dans le voisinage réseau.',
    alias: ['découverte', 'voisinage réseau', 'network discovery'],
  },

  // ------------------------------------------------------------ deploiement
  {
    nom: 'Installation de logiciel', nomEn: 'Software installation',
    scope: 'ordinateur', categorie: 'deploiement',
    chemin: ['Paramètres du logiciel', 'Installation de logiciel'],
    effet: 'Déploie un paquet MSI, attribué à la machine (au démarrage) ou publié à l\'utilisateur.',
    piege: 'MSI uniquement — pas de .exe. Le partage doit être lisible par « Ordinateurs du domaine » et non seulement par les utilisateurs.',
    alias: ['MSI', 'logiciel', 'déployer', 'installer', 'application'],
  },
  {
    nom: 'Mappages de lecteurs', nomEn: 'Drive Maps',
    scope: 'utilisateur', categorie: 'deploiement',
    chemin: ['Préférences', 'Paramètres Windows', 'Mappages de lecteurs'],
    effet: 'Monte un partage réseau sur une lettre de lecteur.',
    valeurs: 'Action « Mettre à jour », lettre imposée, reconnexion cochée.',
    piege: 'Le ciblage au niveau élément (onglet Commun) permet de mapper selon le groupe de l\'utilisateur : c\'est ce qui remplace les vieux scripts de connexion à rallonge.',
    alias: ['lecteur réseau', 'mapper', 'partage', 'drive map', 'net use', 'H:', 'S:'],
  },
  {
    nom: 'Registre (préférence)', nomEn: 'Registry (Preference)',
    scope: 'ordinateur', categorie: 'deploiement',
    chemin: ['Préférences', 'Paramètres Windows', 'Registre'],
    effet: 'Écrit une valeur de registre arbitraire.',
    piege: 'La porte de sortie quand aucun modèle d\'administration n\'existe. À documenter, sinon plus personne ne sait d\'où vient la clé six mois plus tard.',
    alias: ['registre', 'registry', 'clé', 'valeur', 'REG'],
  },
  {
    nom: 'Utilisateurs et groupes locaux', nomEn: 'Local Users and Groups',
    scope: 'ordinateur', categorie: 'deploiement',
    chemin: ['Préférences', 'Paramètres du Panneau de configuration', 'Utilisateurs et groupes locaux'],
    effet: 'Ajoute un groupe de domaine dans le groupe Administrateurs local des postes.',
    piege: 'Utiliser « Mettre à jour » et cocher « Supprimer les membres actuels » seulement en connaissance de cause : cela vide le groupe de tout le reste.',
    alias: ['administrateur local', 'groupe local', 'admin', 'ajouter au groupe'],
  },
  {
    nom: 'Raccourcis', nomEn: 'Shortcuts',
    scope: 'utilisateur', categorie: 'deploiement',
    chemin: ['Préférences', 'Paramètres Windows', 'Raccourcis'],
    effet: 'Pose un raccourci sur le Bureau ou dans le menu Démarrer.',
    alias: ['raccourci', 'shortcut', 'bureau', 'icône'],
  },
  {
    nom: 'Tâches planifiées', nomEn: 'Scheduled Tasks',
    scope: 'ordinateur', categorie: 'deploiement',
    chemin: ['Préférences', 'Paramètres du Panneau de configuration', 'Tâches planifiées'],
    effet: 'Crée une tâche planifiée sur les postes ciblés.',
    alias: ['tâche planifiée', 'scheduled task', 'planificateur', 'cron'],
  },

  // -------------------------------------------------------------------- maj
  {
    nom: 'Configuration du service Mises à jour automatiques', nomEn: 'Configure Automatic Updates',
    scope: 'ordinateur', categorie: 'maj',
    chemin: [...ADM_O, 'Composants Windows', 'Windows Update'],
    effet: 'Choisit le comportement : notifier, télécharger, installer, et à quelle heure.',
    valeurs: '4 — téléchargement et installation planifiée.',
    alias: ['windows update', 'mise à jour', 'WSUS', 'patch'],
  },
  {
    nom: 'Spécifier l\'emplacement intranet du service de mise à jour Microsoft', nomEn: 'Specify intranet Microsoft update service location',
    scope: 'ordinateur', categorie: 'maj',
    chemin: [...ADM_O, 'Composants Windows', 'Windows Update'],
    effet: 'Pointe les postes vers un serveur WSUS interne.',
    piege: 'Les deux champs (service de mise à jour et serveur de statistiques) attendent la même URL, port compris — http://wsus:8530.',
    alias: ['WSUS', 'serveur de mise à jour', 'intranet', '8530'],
  },
  {
    nom: 'Pas de redémarrage automatique avec des utilisateurs connectés', nomEn: 'No auto-restart with logged on users for scheduled automatic updates',
    scope: 'ordinateur', categorie: 'maj',
    chemin: [...ADM_O, 'Composants Windows', 'Windows Update'],
    effet: 'Empêche le redémarrage forcé pendant qu\'une session est ouverte.',
    valeurs: 'Activé sur les serveurs et les postes de production.',
    alias: ['redémarrage', 'reboot', 'update', 'perte de travail'],
  },
  {
    nom: 'Désactiver la protection en temps réel', nomEn: 'Turn off real-time protection',
    scope: 'ordinateur', categorie: 'maj',
    chemin: [...ADM_O, 'Composants Windows', 'Antivirus Microsoft Defender', 'Protection en temps réel'],
    effet: 'Coupe l\'analyse permanente de Defender.',
    piege: 'À ne poser que sur une OU de laboratoire, jamais en production. La protection contre les falsifications (Tamper Protection) peut d\'ailleurs l\'ignorer.',
    alias: ['defender', 'antivirus', 'désactiver', 'exclusion'],
  },
  {
    nom: 'Chiffrement de lecteur BitLocker', nomEn: 'BitLocker Drive Encryption',
    scope: 'ordinateur', categorie: 'maj',
    chemin: [...ADM_O, 'Composants Windows', 'Chiffrement de lecteur BitLocker'],
    effet: 'Impose le chiffrement et la sauvegarde de la clé de récupération dans AD.',
    piege: 'Activer « Ne pas activer BitLocker tant que les informations de récupération ne sont pas stockées dans AD DS » — sinon un poste chiffré sans clé sauvegardée est un poste perdu.',
    alias: ['bitlocker', 'chiffrement', 'clé de récupération', 'TPM'],
  },

  // ----------------------------------------------------------------- moteur
  {
    nom: 'Configurer le mode de traitement par bouclage de la stratégie de groupe utilisateur', nomEn: 'Configure user Group Policy loopback processing mode',
    scope: 'ordinateur', categorie: 'moteur',
    chemin: [...ADM_O, 'Système', 'Stratégie de groupe'],
    effet: 'Applique les paramètres UTILISATEUR d\'une GPO en fonction de la MACHINE où l\'on se connecte.',
    valeurs: 'Fusionner (les deux s\'appliquent) ou Remplacer (seule la GPO de la machine compte).',
    piege: 'Le paramètre indispensable des serveurs RDS et des postes en libre-service : sans lui, un utilisateur emporte son bureau personnel sur un poste partagé.',
    alias: ['loopback', 'bouclage', 'RDS', 'TSE', 'poste partagé', 'kiosque'],
  },
  {
    nom: 'Traitement de la stratégie de Registre', nomEn: 'Configure registry policy processing',
    scope: 'ordinateur', categorie: 'moteur',
    chemin: [...ADM_O, 'Système', 'Stratégie de groupe'],
    effet: 'Force la réapplication des paramètres même quand la GPO n\'a pas changé.',
    piege: 'Cocher « Traiter même si les objets n\'ont pas changé » quand des utilisateurs modifient localement ce que la GPO impose.',
    alias: ['réappliquer', 'refresh', 'forcer', 'gpupdate'],
  },
  {
    nom: 'Intervalle d\'actualisation de la stratégie de groupe pour les ordinateurs', nomEn: 'Set Group Policy refresh interval for computers',
    scope: 'ordinateur', categorie: 'moteur',
    chemin: [...ADM_O, 'Système', 'Stratégie de groupe'],
    effet: 'Change le rafraîchissement automatique (90 minutes + décalage aléatoire par défaut).',
    piege: 'Descendre trop bas charge les contrôleurs de domaine sans bénéfice réel : gpupdate /force reste l\'outil du dépannage.',
    alias: ['intervalle', 'rafraîchissement', '90 minutes', 'gpupdate'],
  },
];

/** Chemin complet, préfixé par la racine de configuration. */
export function gpoChemin(e: GpoEntry): string {
  const racine = e.scope === 'ordinateur' ? 'Configuration ordinateur' : 'Configuration utilisateur';
  // Les préférences ne vivent pas sous « Stratégies » : la console les place à côté.
  const sousRacine = e.chemin[0] === 'Préférences' ? [] : ['Stratégies'];
  return [racine, ...sousRacine, ...e.chemin].join(' › ');
}

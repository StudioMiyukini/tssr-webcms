# -*- coding: utf-8 -*-
"""
Chantier P2 du comparatif REAC 2026 : apporter une assistance technique
(compétence 3) — ITIL au-delà du vocabulaire, la prise en main à distance,
la sensibilisation des utilisateurs. Trois cours dans Maintenance › Méthode &
support, et un renvoi ajouté dans `le-ticketing` vers le cours ITIL.

IDEMPOTENT.
"""
import sqlite3
import sys

from _cours import (BASE, Categorie, STYLE, acc, bullets, cmd, hero, menu, note, publier_lot, retenir, steps, tab)

MAINT = Categorie('cat-maintenance', '🛠️', 'Maintenance', '', '#dc2626')
SG = 'Méthode &amp; support'

# ═══════════════════════════════════════════════════════ ITIL pour le support ══

ITIL = '\n'.join([
    hero('Cours · Support', 'ITIL pour le support : incidents, demandes, problèmes, changements',
         'Le référentiel des services informatiques, réduit à ce qu’un technicien pratique chaque '
         'jour : les quatre processus, le centre de services, le contrat de service, et la '
         'base de connaissances.'),
    STYLE,
    note('gray', '📚 Avant ce cours',
         '<a href="/pages/le-ticketing">Le ticketing</a> donne le vocabulaire ; ici, on voit ce que ces mots '
         'changent dans la façon de travailler.'),
    '<p>ITIL (Information Technology Infrastructure Library) est un ensemble de bonnes pratiques pour '
    '« fournir des services informatiques ». Version 4 depuis 2019. On ne demande pas au technicien '
    'de le connaître par cœur, mais le RE 2026 en reprend les critères mot pour mot : « les demandes '
    'sont <strong>qualifiées</strong> et traitées <strong>dans les délais du contrat de service</strong> », '
    '« les incidents récurrents sont documentés et partagés pour contribuer à l’<strong>amélioration '
    'continue</strong> ». C’est ITIL.</p>',

    '<h2>1) L’idée : un service, pas une machine</h2>',
    '<p>L’utilisateur n’a pas besoin d’un serveur Exchange ; il a besoin d’<em>envoyer des mails</em>. '
    'ITIL regarde l’informatique par les <strong>services</strong> rendus (messagerie, impression, poste '
    'de travail, accès distant), chacun avec des utilisateurs, un niveau attendu et un responsable. Le '
    '<strong>catalogue de services</strong> les liste ; le <strong>contrat de service</strong> (SLA) fixe ce '
    'qu’on promet.</p>',
    tab(['Service', 'Disponibilité promise', 'Prise en charge', 'Résolution', 'Heures'], [
        ['Messagerie', '99,9 %', '30 min', '4 h', '7 h–19 h, lun–ven'],
        ['Poste de travail', '—', '1 h', '8 h (poste de prêt sous 2 h)', 'idem'],
        ['Accès distant (VPN)', '99,5 %', '30 min', '4 h', '7 h–22 h'],
        ['Demande de compte', '—', '4 h', '2 jours ouvrés', 'idem'],
    ]),
    '<p>Un SLA se lit dans les deux sens : il engage le service informatique, et il <strong>protège</strong> '
    'le technicien — « votre demande de compte sera traitée sous deux jours » n’est pas une mauvaise '
    'volonté, c’est le contrat.</p>',

    '<h2>2) Les quatre processus du quotidien</h2>',
    tab(['Processus', 'Déclencheur', 'Objectif', 'Exemple'], [
        ['<strong>Gestion des incidents</strong>', 'Quelque chose ne marche plus (ou moins bien)', '<strong>Rétablir le service au plus vite</strong> — pas forcément comprendre', 'L’imprimante ne répond plus : on redémarre le spouleur, ça remarche, ticket clos'],
        ['<strong>Gestion des demandes</strong>', 'Un besoin normal', 'Fournir ce qui est prévu au catalogue, dans les délais, avec les validations', 'Un nouveau compte, un logiciel, un accès à un partage'],
        ['<strong>Gestion des problèmes</strong>', 'Un incident qui revient, ou un incident majeur', '<strong>Trouver et supprimer la cause</strong>', 'Le spouleur plante chaque semaine : on trouve le pilote en cause, on le remplace sur les 40 postes'],
        ['<strong>Gestion des changements</strong>', 'Une modification du SI', 'Changer <strong>sans casser</strong> : évaluer, planifier, autoriser, tester, communiquer, revenir en arrière si besoin', 'Remplacer le pare-feu, migrer la messagerie, appliquer un correctif majeur'],
    ]),
    note('blue', '💡 Incident ≠ problème',
         'Le technicien de niveau 1 traite l’incident : il rétablit. Quand le même incident revient '
         'trois fois, il ouvre (ou signale) un <strong>problème</strong> : quelqu’un cherche la cause pendant '
         'que les incidents continuent d’être traités avec une <strong>solution de contournement</strong> '
         'documentée. Confondre les deux, c’est passer ses journées à redémarrer le spouleur.'),

    '<h2>3) Le cycle de vie d’un incident, en détail</h2>',
    steps('<strong>Détection et enregistrement</strong> : appel, mail, portail, supervision → un ticket, toujours. Ce qui n’est pas enregistré n’est pas traité et n’est pas mesuré.',
          '<strong>Qualification</strong> : incident ou demande ? Quel service ? Quel utilisateur, quel poste ? Symptôme reformulé. C’est le critère « les demandes sont qualifiées » du RE.',
          '<strong>Priorisation</strong> : <strong>urgence × impact</strong> → priorité → délai SLA. L’urgence, c’est la vitesse à laquelle ça fait mal ; l’impact, combien de personnes ou quelle activité.',
          '<strong>Diagnostic initial et résolution niveau 1</strong> : la base de connaissances d’abord (le cas est peut-être connu), puis le <a href="/pages/depannage">dépannage</a>.',
          '<strong>Escalade</strong> fonctionnelle (niveau 2 / 3, l’éditeur) si la compétence manque ; hiérarchique si le SLA est menacé ou l’impact grave. On escalade <em>avant</em> la fin du délai, avec ce qui a déjà été fait.',
          '<strong>Résolution et rétablissement</strong> : le service remarche, l’utilisateur le confirme.',
          '<strong>Clôture</strong> : catégorie et cause renseignées (elles nourrissent les statistiques et la gestion des problèmes), compte rendu — voir <a href="/pages/compte-rendu-intervention">Le compte rendu d’intervention</a>.'),
    tab(['', 'Impact fort (site, service, VIP)', 'Impact moyen (équipe)', 'Impact faible (une personne)'], [
        ['<strong>Urgence forte</strong> (bloquant)', 'P1 — 30 min / 4 h', 'P2 — 1 h / 8 h', 'P3 — 4 h / 2 j'],
        ['<strong>Urgence moyenne</strong> (contournement existe)', 'P2', 'P3', 'P4 — 1 j / 5 j'],
        ['<strong>Urgence faible</strong> (gêne)', 'P3', 'P4', 'P4'],
    ]),

    '<h2>4) Le centre de services (service desk)</h2>',
    bullets('Le <strong>point de contact unique</strong> : un numéro, une adresse, un portail. L’utilisateur ne cherche pas « qui s’occupe des imprimantes ».',
            'Le <strong>niveau 1</strong> résout ce qu’il peut (objectif courant : 60–70 % des tickets) et route le reste ; il <strong>possède</strong> le ticket jusqu’à la clôture même quand un autre niveau travaille dessus.',
            'Le <strong>portail en libre-service</strong> : le catalogue de demandes (formulaires), l’état des tickets, les fiches de la base de connaissances, la page d’état des services (« la messagerie est perturbée depuis 9 h 12, retour prévu 10 h »).',
            'Les <strong>outils</strong> : GLPI (le plus courant en France, avec inventaire), Zammad, osTicket, Jira Service Management, ServiceNow — tous font tickets, SLA, base de connaissances, catalogue.'),

    '<h2>5) La base de connaissances et l’amélioration continue</h2>',
    bullets('Une <strong>fiche par symptôme</strong> (pas par ticket) : symptôme, cause, résolution, contournement, liens. Elle naît au deuxième ticket identique.',
            'Des fiches <strong>pour les utilisateurs</strong> aussi (« configurer sa messagerie sur le téléphone ») : chaque fiche lue est un ticket évité.',
            'Les <strong>indicateurs</strong> mensuels : volume par catégorie, % résolus au niveau 1, respect du SLA, tickets rouverts, satisfaction. Ils désignent les problèmes à ouvrir et les fiches à écrire.',
            'La <strong>revue des incidents majeurs</strong> (post-mortem) : ce qui s’est passé, chronologie, cause, ce qu’on change — sans chercher de coupable.',
            'C’est la boucle ITIL : mesurer → identifier → améliorer → mesurer. Le RE l’appelle « contribuer à l’amélioration continue du service ».'),

    '<h2>6) Les changements : ce que le technicien demande avant de toucher</h2>',
    tab(['Type', 'Exemple', 'Ce qu’il faut'], [
        ['<strong>Standard</strong> (pré-autorisé)', 'Créer un compte, remplacer un poste, appliquer les mises à jour du mois', 'Suivre la procédure ; le ticket suffit'],
        ['<strong>Normal</strong>', 'Changer la version d’un logiciel métier, ajouter un VLAN, migrer un serveur', 'Une demande de changement : quoi, pourquoi, quand, risque, test, retour arrière, communication ; validée par le responsable (ou un comité — CAB)'],
        ['<strong>Urgent</strong>', 'Correctif d’une faille exploitée, remplacement d’un équipement HS', 'Validation accélérée, mais tracée ; la revue après coup'],
    ]),
    '<p>La fenêtre de maintenance, la sauvegarde avant, le test et le plan de retour arrière : c’est '
    'la gestion des changements appliquée aux <a href="/pages/gerer-mises-a-jour">mises à jour</a>.</p>',

    '<h2>7) Le vocabulaire ITIL 4 qu’on peut croiser</h2>',
    tab(['Terme', 'Sens'], [
        ['Pratique', 'ITIL 4 parle de « pratiques » (34) plutôt que de processus : gestion des incidents, des demandes de service, des problèmes, des changements, des actifs, de la configuration (CMDB), des connaissances…'],
        ['CMDB', 'La base des éléments de configuration (serveurs, applications, liens entre eux) — l’inventaire GLPI en est une forme'],
        ['Chaîne de valeur', 'Les activités qui transforment une demande en valeur pour l’utilisateur'],
        ['Contrat de service (SLA), OLA, UC', 'Avec les utilisateurs ; entre équipes internes ; avec un fournisseur'],
        ['MTTR, MTBF', 'Temps moyen de rétablissement ; temps moyen entre pannes — les indicateurs de disponibilité'],
    ]),

    retenir('ITIL voit l’informatique en <strong>services</strong>, avec un catalogue et un <strong>contrat de service</strong> (SLA) qui engage et protège.',
            'Quatre processus : <strong>incident</strong> (rétablir vite), <strong>demande</strong> (fournir ce qui est prévu), <strong>problème</strong> (supprimer la cause des récurrents), <strong>changement</strong> (modifier sans casser).',
            'Un incident : enregistrer, <strong>qualifier</strong>, prioriser (<strong>urgence × impact</strong>), résoudre ou escalader avant le délai, clôturer avec cause et compte rendu.',
            'Le centre de services : point de contact unique, niveau 1 propriétaire du ticket, portail et base de connaissances.',
            'Amélioration continue : fiches par symptôme, indicateurs mensuels, post-mortem sans coupable.'),
])

# ═══════════════════════════════════════════════ Prise en main à distance ══

REMOTE = '\n'.join([
    hero('Cours · Support', 'La prise en main à distance',
         'Assister un utilisateur sans se déplacer : les outils (Assistance rapide, RDP, TeamViewer / '
         'AnyDesk / RustDesk, RMM, SSH), les règles de consentement et de sécurité, et la conduite '
         'd’une session à distance.'),
    STYLE,
    note('gray', '📚 Avant ce cours',
         '<a href="/pages/astuce-bureau-a-distance">Activer le Bureau à distance (RDP)</a>, '
         '<a href="/pages/le-vpn">Le VPN</a>, <a href="/pages/linux-ssh">SSH</a>.'),
    '<p>La moitié des tickets se résolvent en regardant l’écran de l’utilisateur. Le RE 2026 attend que '
    '« les ressources distantes soient accessibles » et que l’assistance applique « les règles de '
    'sécurité opérationnelle » : la prise en main à distance est puissante — et c’est exactement '
    'l’outil qu’utilisent les faux supports téléphoniques.</p>',

    '<h2>1) Trois besoins, trois familles d’outils</h2>',
    tab(['Besoin', 'Outil', 'Ce qui se passe'], [
        ['<strong>Voir et guider</strong> l’utilisateur, avec lui', 'Assistance rapide (Windows), Aide à distance, TeamViewer / AnyDesk / RustDesk en session assistée, Teams (partage d’écran + contrôle)', 'L’utilisateur est présent, voit tout, donne son accord, peut couper'],
        ['<strong>Administrer</strong> un serveur ou un poste, sans l’utilisateur', 'RDP, SSH, PowerShell Remoting, console de l’hyperviseur, iDRAC / iLO', 'Une session d’administration ; l’utilisateur n’est pas concerné ou est déconnecté'],
        ['<strong>Gérer un parc</strong> : accès non assisté, inventaire, scripts, MAJ', 'RMM (NinjaOne, Datto, Atera, Tactical RMM libre), Intune (aide à distance), GLPI + agent', 'Un agent permanent ; accès sans présence, tracé, avec politique d’accès'],
    ]),

    '<h2>2) Assistance rapide : l’outil intégré</h2>',
    steps('Le technicien ouvre <strong>Assistance rapide</strong> (' + menu('Démarrer › Assistance rapide') + ', ou <kbd>Ctrl</kbd> + <kbd>Win</kbd> + <kbd>Q</kbd>), se connecte avec son compte Microsoft / professionnel, choisit « Aider quelqu’un » : un <strong>code à 6 chiffres</strong> valable 10 minutes.',
          'L’utilisateur ouvre Assistance rapide, saisit le code, <strong>accepte</strong> le partage d’écran ; le technicien demande ensuite le <strong>contrôle total</strong>, que l’utilisateur accepte encore.',
          'Barre d’outils : annotation, pointeur laser, chat, pause ; l’utilisateur peut <strong>arrêter</strong> à tout moment.',
          'Passe par Internet (serveurs Microsoft, chiffré) : fonctionne en télétravail sans VPN ; ne passe pas les écrans UAC sans contrôle total.'),
    '<p>L’<strong>Aide à distance</strong> (msra.exe) est l’ancêtre en domaine : invitation par fichier ou '
    'par GPO « Proposer l’assistance à distance » qui permet au support de solliciter la session — '
    'toujours avec l’acceptation de l’utilisateur.</p>',

    '<h2>3) RDP : administrer, pas assister</h2>',
    bullets('Le Bureau à distance ouvre <strong>une session Windows</strong> : sur un poste, il <strong>déconnecte</strong> l’utilisateur (une seule session interactive sur Windows client) — ce n’est pas un outil d’assistance.',
            'Sur un serveur : deux sessions d’administration ; <code>mstsc /admin</code> pour la console ; <code>query user</code> et <code>logoff &lt;id&gt;</code> pour libérer une session fantôme.',
            'Jamais RDP exposé sur Internet (3389 scanné en continu) : par VPN, par passerelle Bureau à distance (RD Gateway, HTTPS), ou par bastion. Voir <a href="/pages/opnsense-vpn-ids">OPNsense : accès distants</a>.',
            'NLA (authentification au niveau réseau) activée, MFA sur le VPN ou la passerelle, comptes d’administration dédiés.',
            'Sur Linux : SSH, avec clés ; un bureau graphique par xrdp ou VNC dans un tunnel SSH si vraiment nécessaire.'),
    cmd('mstsc /v:srv-fic01.entreprise.local /admin\n'
        'query user /server:srv-fic01          # sessions ouvertes\n'
        'logoff 2 /server:srv-fic01            # fermer la session n° 2 (attention aux travaux en cours)\n'
        '# une commande à distance, sans session graphique\n'
        'Invoke-Command -ComputerName PC-COMPTA-03 -ScriptBlock { Get-Service Spooler | Restart-Service }'),

    '<h2>4) Les outils tiers et le RMM</h2>',
    tab(['Outil', 'Type', 'Points d’attention'], [
        ['<strong>TeamViewer, AnyDesk</strong>', 'Commercial ; session assistée (code) ou non assistée (installé, mot de passe)', 'Licence pro obligatoire en entreprise ; l’accès non assisté avec mot de passe fixe est une porte d’entrée classique des attaquants : MFA, liste blanche, alertes'],
        ['<strong>RustDesk</strong>', 'Libre, auto-hébergeable (serveur relais dans l’organisation)', 'Rien ne transite par un tiers ; à administrer soi-même'],
        ['<strong>Teams</strong>', 'Partage d’écran, demande de contrôle', 'Déjà là, mais pas les écrans UAC ni la session verrouillée'],
        ['<strong>Intune – Aide à distance</strong>', 'Assistance intégrée aux postes gérés, avec rôles et journal', 'Licence additionnelle'],
        ['<strong>RMM</strong>', 'Agent permanent : inventaire, supervision, scripts, MAJ, prise en main', 'L’outil le plus puissant du parc — donc le plus sensible : MFA obligatoire, droits par technicien, journal de chaque session'],
        ['<strong>VNC</strong>', 'Le protocole historique', 'Non chiffré nativement : dans un tunnel SSH / VPN uniquement'],
    ]),
    note('red', '🚨 L’outil de prise en main est une cible',
         'Les attaques par rançongiciel commencent souvent par un TeamViewer / AnyDesk / RMM mal '
         'protégé : mot de passe faible, pas de MFA, agent oublié sur un poste. Règles : un seul '
         'outil autorisé, MFA, journal des sessions, désinstallation de ce qui n’est pas l’outil '
         'officiel, et les utilisateurs formés à refuser toute session qu’ils n’ont pas demandée.'),

    '<h2>5) Les règles : consentement, traçabilité, confidentialité</h2>',
    bullets('<strong>Consentement</strong> : sur un poste utilisateur, on ne prend jamais la main sans l’accord explicite de la personne, à chaque session — c’est le droit (respect de la vie privée au travail, CNIL) et la charte. L’accès non assisté est réservé aux serveurs et aux postes sans utilisateur, ou prévu par la charte pour la maintenance hors heures avec information préalable.',
            '<strong>Annonce</strong> : « Je vais prendre la main sur votre écran, vous voyez tout ce que je fais, dites-moi si vous voulez que j’arrête. »',
            '<strong>Ne pas fouiller</strong> : on va au problème ; on ne lit pas les mails, on n’ouvre pas les documents personnels. Si un fichier personnel s’ouvre par accident, on le dit et on le ferme.',
            '<strong>Identifiants</strong> : l’utilisateur tape lui-même son mot de passe ; on ne le lui demande jamais. Pour l’élévation UAC, le technicien saisit son propre compte d’administration, hors de vue si possible (fenêtre sécurisée).',
            '<strong>Traçabilité</strong> : le ticket mentionne la session à distance (heure, outil, ce qui a été fait) ; l’outil journalise.',
            '<strong>Fin de session</strong> : fermer proprement, vérifier que la connexion est bien terminée (icône, notification), pas d’accès résiduel.'),

    '<h2>6) Conduire une session</h2>',
    steps('<strong>Avant</strong> : ticket ouvert, symptôme qualifié, l’utilisateur prévenu de ce qu’on va faire et de la durée.',
          '<strong>Connexion</strong> : le code par un canal (téléphone), l’acceptation par l’utilisateur ; vérifier qu’on est sur le bon poste (nom dans la barre de titre).',
          '<strong>Pendant</strong> : expliquer à voix haute, <strong>faire faire</strong> plutôt que faire quand c’est un geste que l’utilisateur devra refaire (configurer sa signature, épingler une application) — l’assistance forme.',
          '<strong>Écrans sensibles</strong> : demander à l’utilisateur de fermer ce qui n’a pas à être vu ; pause du partage pendant la saisie d’un mot de passe.',
          '<strong>Résolution</strong> : l’utilisateur refait l’action ; on lui laisse la main pour vérifier.',
          '<strong>Après</strong> : session terminée et confirmée, compte rendu dans le ticket, fiche de base de connaissances si le cas est nouveau.'),

    '<h2>7) Quand ça ne marche pas</h2>',
    tab(['Symptôme', 'Cause fréquente', 'Solution'], [
        ['Code refusé / session impossible', 'Pare-feu sortant, proxy, poste hors ligne', 'Vérifier l’accès Internet du poste ; Assistance rapide a besoin de HTTPS sortant'],
        ['Écran noir en RDP sur un poste', 'L’utilisateur a été déconnecté ; ou pilote graphique', 'C’est le comportement normal de RDP sur Windows client ; utiliser un outil d’assistance'],
        ['Écrans UAC invisibles', 'Contrôle total non accordé, ou outil sans support du bureau sécurisé', 'Demander le contrôle total ; ou faire saisir par l’utilisateur ; ou RMM'],
        ['Lenteur, saccades', 'Bande passante, télétravail sur 4G', 'Réduire la qualité / la résolution, couper les animations ; PowerShell Remoting pour ce qui n’a pas besoin d’écran'],
        ['« Quelqu’un a pris la main sur mon PC »', 'Arnaque au faux support, ou outil résiduel', 'Couper le réseau, ne rien payer, appeler le support ; incident de sécurité : voir <a href="/pages/sensibiliser-utilisateurs">Sensibiliser les utilisateurs</a>'],
    ]),

    retenir('<strong>Assister</strong> (Assistance rapide, session avec l’utilisateur) ≠ <strong>administrer</strong> (RDP, SSH, Remoting) ≠ <strong>gérer un parc</strong> (RMM, agent).',
            'RDP déconnecte l’utilisateur sur un poste ; jamais exposé sur Internet ; VPN / passerelle / bastion + NLA + MFA.',
            'Un seul outil autorisé, <strong>MFA</strong>, journal des sessions, agents non officiels désinstallés : l’outil de prise en main est une cible.',
            '<strong>Consentement à chaque session</strong>, annonce, pas de fouille, mot de passe jamais demandé, session fermée et tracée.',
            'Faire faire plutôt que faire : l’assistance forme l’utilisateur.'),
])

# ═══════════════════════════════════════════ Sensibiliser les utilisateurs ══

SENSIB = '\n'.join([
    hero('Cours · Support', 'Sensibiliser les utilisateurs à la sécurité',
         'Le technicien est le premier formateur du parc : hameçonnage, mots de passe, faux support, '
         'clés USB, télétravail. Une séance de 45 minutes, une campagne, et les réflexes à installer.'),
    STYLE,
    '<p>La plupart des incidents de sécurité commencent par un clic. Le meilleur pare-feu ne protège '
    'pas d’un utilisateur qui donne son mot de passe à un faux Microsoft. Le RE 2026 demande '
    'd’« appliquer les bonnes pratiques de sécurité » et de sensibiliser — à la sécurité comme à '
    'l’<a href="/pages/ia-encadrer">IA</a> — « avec un vocabulaire adapté ». Ce cours donne le contenu '
    'et la méthode.</p>',

    '<h2>1) Les six messages qui comptent</h2>',
    tab(['Message', 'Pourquoi', 'L’exemple qui parle'], [
        ['<strong>Le mail qui presse est suspect</strong>', 'L’hameçonnage joue sur l’urgence et l’autorité ; l’IA a supprimé les fautes d’orthographe', '« Votre compte sera fermé dans 24 h », « le DG demande un virement urgent » — on vérifie par un autre canal'],
        ['<strong>Le lien se lit avant le clic</strong>', 'Le texte du lien et sa destination diffèrent', 'Survoler : <code>microsoft-securite.com</code> n’est pas Microsoft ; en cas de doute, taper l’adresse soi-même'],
        ['<strong>Le mot de passe ne se donne à personne</strong>', 'Ni au support, ni au collègue, ni par mail, ni au téléphone', '« Le support ne vous demandera jamais votre mot de passe » — et la MFA protège même s’il fuit'],
        ['<strong>Une phrase de passe, unique, dans un gestionnaire</strong>', 'La réutilisation transforme une fuite chez un site en accès à tout', '12 caractères et plus, une phrase ; le gestionnaire de l’organisation ; MFA partout'],
        ['<strong>Rien d’inconnu ne se branche ni ne s’installe</strong>', 'Clé USB trouvée, logiciel gratuit, extension de navigateur', 'La clé « perdue » sur le parking ; le convertisseur PDF gratuit qui est un cheval de Troie'],
        ['<strong>Signaler vite, sans honte</strong>', 'Un clic signalé en 5 minutes se contient ; en 3 jours, c’est un rançongiciel', 'Le bouton « signaler » dans Outlook, le numéro du support ; on ne punit pas celui qui signale'],
    ]),
    note('blue', '💡 Vocabulaire adapté',
         'Pas « hameçonnage par usurpation d’identité avec charge utile » mais « un faux mail qui '
         'imite votre banque pour vous faire cliquer ». On parle de ce que la personne voit à son '
         'écran, avec ses mots ; on montre un vrai exemple reçu dans l’organisation (anonymisé).'),

    '<h2>2) Les scénarios à raconter</h2>',
    acc(
        ('L’arnaque au faux support',
         '<p>Un appel ou une fenêtre : « Microsoft a détecté un virus, laissez-nous prendre la main ». '
         'L’escroc installe un outil de prise en main, montre des « erreurs » (l’Observateur d’événements), '
         'fait payer ou vole des données. <strong>Réflexe</strong> : raccrocher, ne rien installer, appeler '
         '<em>le</em> support (le vrai numéro), débrancher le réseau si une session a été ouverte. Voir '
         '<a href="/pages/prise-en-main-distance">La prise en main à distance</a>.</p>'),
        ('La fraude au président / au fournisseur',
         '<p>Un mail « du DG » (adresse proche, ou compte réellement compromis) demande un virement urgent et '
         'discret ; ou un fournisseur « change de RIB ». <strong>Réflexe</strong> : toute demande de paiement ou de '
         'changement de coordonnées se confirme par téléphone, au numéro connu, jamais à celui du mail.</p>'),
        ('La clé USB et le câble',
         '<p>Une clé trouvée, un cadeau publicitaire, un câble de charge inconnu : ils peuvent exécuter du '
         'code à l’insertion. <strong>Réflexe</strong> : on la remet au support, qui l’analyse sur une machine '
         'isolée.</p>'),
        ('Le télétravail et le Wi-Fi public',
         '<p>Un portable pro sur le Wi-Fi de la gare, un enfant qui joue sur le PC du travail, une session '
         'laissée ouverte dans un train. <strong>Réflexe</strong> : VPN systématique, verrouillage '
         '(<kbd>Win</kbd> + <kbd>L</kbd>) dès qu’on se lève, poste pro = usage pro, filtre de confidentialité.</p>'),
        ('Le compromis de compte',
         '<p>Des demandes MFA que je n’ai pas déclenchées, un mail envoyé « par moi » que je n’ai pas '
         'écrit, une règle Outlook inconnue qui déplace les mails. <strong>Réflexe</strong> : refuser la MFA, '
         'signaler immédiatement, changer le mot de passe.</p>'),
        ('L’IA et les données',
         '<p>Le contrat client collé dans un assistant en ligne « pour le résumer ». <strong>Réflexe</strong> : '
         'rien de confidentiel ni de personnel dans un outil non validé — voir <a href="/pages/ia-encadrer">Encadrer l’IA</a>.</p>'),
    ),

    '<h2>3) Une séance de 45 minutes</h2>',
    tab(['Temps', 'Séquence', 'Support'], [
        ['5 min', 'Pourquoi on est là : un incident réel (anonymisé) de l’organisation ou du secteur, ce qu’il a coûté', 'Une diapositive, une histoire'],
        ['10 min', '<strong>Le jeu du vrai / faux mail</strong> : six captures, le groupe vote, on explique les indices', 'Captures réelles, mains levées'],
        ['15 min', 'Les six messages, un scénario chacun', 'Diapositives sobres, un exemple par message'],
        ['10 min', '<strong>Atelier</strong> : chacun active la MFA / vérifie son gestionnaire de mots de passe / trouve le bouton « signaler » sur son poste', 'Les postes des participants'],
        ['5 min', 'À qui parler, comment signaler, la charte ; la fiche mémo distribuée', 'Fiche A4 recto'],
    ]),
    bullets('Groupes de 8 à 15 ; par service (les risques de la compta ne sont pas ceux de l’atelier).',
            'Pas de ton moralisateur : « tout le monde peut cliquer ; ce qui compte, c’est de le dire ».',
            'Accessibilité : supports lisibles, contraste, texte de remplacement, sous-titres si vidéo, rythme — voir <a href="/pages/accessibilite-windows">Accessibilité</a>.',
            'Une <strong>fiche mémo</strong> d’une page : les six messages, le numéro du support, le bouton « signaler ».',
            'Les nouveaux arrivants : la séance fait partie de l’<a href="/pages/cycle-vie-compte">onboarding</a>, avec la signature de la charte.'),

    '<h2>4) Faire durer : la campagne</h2>',
    tab(['Action', 'Fréquence', 'Remarque'], [
        ['<strong>Simulation d’hameçonnage</strong> (outil intégré à Microsoft Defender, GoPhish libre, prestataire)', 'Trimestrielle', 'Pour <em>former</em>, pas pour piéger : celui qui clique reçoit une page pédagogique, jamais une sanction ; les résultats sont globaux, pas nominatifs (dialogue social, CNIL)'],
        ['Un message court (mail, intranet, écran d’accueil)', 'Mensuel', 'Un thème par mois : « octobre, mois de la cybersécurité »'],
        ['Rappel après un incident réel', 'À chaque fois', '« Ce qui s’est passé mardi, et ce qu’on en retient » — sans nommer'],
        ['Formation des nouveaux', 'À l’arrivée', 'Dans les 15 premiers jours'],
        ['Session dédiée pour les rôles exposés', 'Annuelle', 'Direction, comptabilité, RH, assistantes : les cibles de la fraude au président'],
        ['Mesure', 'Trimestrielle', 'Taux de clic en simulation, taux de <strong>signalement</strong> (le vrai indicateur), délai de signalement'],
    ]),

    '<h2>5) Ce que le technicien fait côté technique, en parallèle</h2>',
    bullets('Le <strong>bouton « Signaler »</strong> dans Outlook (Defender / add-in) et une adresse <code>securite@</code> qui répond dans l’heure.',
            'La <strong>bannière</strong> « [EXTERNE] » sur les mails venant de l’extérieur ; SPF, DKIM, DMARC sur le domaine pour que les usurpations soient rejetées.',
            'La <strong>MFA</strong> pour tous, les <strong>mots de passe</strong> longs et non expirants avec liste noire — <a href="/pages/mfa-acces-conditionnel">MFA</a>, <a href="/pages/zero-trust-iam">politique de mots de passe</a>.',
            'Le <strong>blocage des USB</strong> non autorisés par GPO / Intune, les macros désactivées, le filtrage web.',
            'Les <strong>droits</strong> : pas d’administrateur local ; un utilisateur qui ne peut pas installer ne peut pas installer le cheval de Troie.',
            'La procédure d’<strong>incident</strong> écrite : qui appeler, quoi débrancher, quoi ne pas faire (ne pas éteindre un poste chiffré par un rançongiciel avant l’analyse, si la PSSI le dit).'),

    '<h2>6) Quand l’utilisateur appelle après avoir cliqué</h2>',
    steps('<strong>Rassurer</strong> : « vous avez bien fait d’appeler ». Le ton décide si le prochain appellera.',
          '<strong>Isoler</strong> : câble réseau débranché / Wi-Fi coupé, poste laissé allumé (sauf consigne contraire).',
          '<strong>Qualifier</strong> : quoi (lien, pièce jointe, identifiants saisis, outil installé) ; quand ; sur quel compte.',
          '<strong>Contenir</strong> : mot de passe changé depuis un autre poste, sessions révoquées, MFA vérifiée, règles de boîte inspectées ; analyse antivirus ; escalade au RSSI selon la procédure.',
          '<strong>Tracer</strong> : ticket d’incident de sécurité ; notification CNIL sous 72 h si des données personnelles sont compromises (décision du DPO / RSSI).',
          '<strong>Boucler</strong> : ce que l’organisation apprend — un rappel à tous, une règle de filtrage, une fiche.'),

    retenir('Six messages : urgence = suspect, lire le lien, mot de passe à personne, phrase de passe unique + gestionnaire + MFA, rien d’inconnu, <strong>signaler vite sans honte</strong>.',
            'Des scénarios concrets (faux support, fraude au président, clé USB, télétravail, compte compromis, IA) avec les mots de l’utilisateur.',
            'Une séance de 45 min : histoire vraie, jeu vrai / faux, six messages, atelier sur le poste, fiche mémo ; accessible.',
            'Une campagne : simulations pédagogiques non nominatives, messages mensuels, nouveaux arrivants, rôles exposés ; l’indicateur est le <strong>taux de signalement</strong>.',
            'La technique en parallèle : bouton signaler, bannière externe, SPF/DKIM/DMARC, MFA, USB bloqués, pas d’admin local ; et un accueil sans reproche quand quelqu’un a cliqué.'),
])

RENVOI_TICKETING = ('<aside class="pb-note pb-note-blue"><p class="pb-note-title">📚 Pour aller plus loin</p>'
                    '<p><a href="/pages/itil-support">ITIL pour le support</a> : incidents, demandes, problèmes et '
                    'changements, le centre de services, le contrat de service et l’amélioration continue — ce que le '
                    'vocabulaire ci-dessus change dans la pratique. Et <a href="/pages/compte-rendu-intervention">Le compte '
                    'rendu d’intervention</a> pour ce qu’on écrit dans le ticket.</p></aside>')


def enrichir_ticketing(c):
    ct = c.execute("SELECT content FROM pages WHERE slug='le-ticketing'").fetchone()[0]
    if 'itil-support' in ct:
        return 'déjà enrichi'
    i = ct.find('À retenir')
    if i == -1:
        return 'ancre introuvable'
    i = ct.rfind('<aside', 0, i)          # l'encadré « À retenir » commence là
    ct = ct[:i] + RENVOI_TICKETING + '\n' + ct[i:]
    c.execute("UPDATE pages SET content=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug='le-ticketing'", (ct,))
    return 'renvoi ajouté'


PAGES = [
    ('itil-support', 'ITIL pour le support : incidents, demandes, problèmes, changements',
     'Le service et le contrat de service, les quatre processus du quotidien, le cycle de vie d’un incident (qualifier, prioriser urgence × impact, escalader), le centre de services, base de connaissances et amélioration continue, gestion des changements.',
     ITIL, SG,
     'Services et SLA, incident / demande / problème / changement, le cycle d’un incident, le centre de services, l’amélioration continue.'),
    ('prise-en-main-distance', 'La prise en main à distance',
     'Assister (Assistance rapide), administrer (RDP, SSH, Remoting), gérer un parc (RMM) ; outils tiers et leurs risques ; consentement, traçabilité, confidentialité ; conduire une session ; dépannage.',
     REMOTE, SG,
     'Assister, administrer, gérer : les bons outils ; sécurité et consentement ; conduire une session à distance.'),
    ('sensibiliser-utilisateurs', 'Sensibiliser les utilisateurs à la sécurité',
     'Six messages, scénarios (faux support, fraude au président, USB, télétravail, compte compromis, IA), une séance de 45 minutes, une campagne avec simulations pédagogiques, les mesures techniques, l’accueil de celui qui a cliqué.',
     SENSIB, SG,
     'Six messages, des scénarios concrets, une séance de 45 minutes, une campagne, et quoi faire quand quelqu’un a cliqué.'),
]

LOTS = [(PAGES, MAINT)]

if __name__ == '__main__':
    for lot in LOTS:
        publier_lot(*lot)
    c = sqlite3.connect(BASE)
    print('le-ticketing :', enrichir_ticketing(c).encode('ascii', 'replace').decode())
    c.commit()
    c.close()
    sys.exit(0)

# -*- coding: utf-8 -*-
"""
Chantier P1 du comparatif REAC 2026 : l'intelligence artificielle.

La compétence n° 1 du titre (« Exploiter l'IA et encadrer son usage ») et la
n° 8 (« Optimiser des scripts à l'aide de l'IA ») n'avaient aucune page. Trois
cours, dans une catégorie neuve : l'IA comme outil du technicien, l'IA comme
sujet à encadrer, et l'IA appliquée aux scripts. Les exemples sont ceux du
métier — un journal d'authentification, un script de sauvegarde — pas des
généralités sur les modèles de langage.

IDEMPOTENT.
"""
import sys

from _cours import (Categorie, STYLE, acc, bullets, cmd, hero, note, publier_lot, retenir, steps, tab)

CAT = Categorie('cat-ia', '🤖', 'Intelligence artificielle',
                'L’IA comme outil du technicien — et comme usage à encadrer.', '#9333ea')

# ═══════════════════════════════════════ 1. L'IA au service du technicien ══

TECHNICIEN = '\n'.join([
    hero('Cours · IA', 'L’IA au service du technicien',
         'Diagnostiquer, lire un journal, comprendre une erreur, rédiger une procédure — avec un '
         'assistant, sans lui confier ce qui ne doit pas sortir, et sans le croire sur parole.'),
    STYLE,
    '<p>Le REAC 2026 le dit sans détour : l’usage de l’IA est « systématique dans les pratiques '
    'professionnelles observées ». Un technicien s’en sert pour comprendre un message d’erreur, '
    'trier un journal, écrire un premier jet de procédure ou de script. Ce cours apprend à s’en '
    'servir <strong>bien</strong> : ce qu’on lui donne, comment on lui demande, et surtout comment '
    'on vérifie ce qu’il répond.</p>',

    '<h2>1) Ce qu’un assistant sait faire — et ce qu’il ne sait pas</h2>',
    tab(['Il fait bien', 'Il fait mal, ou pas du tout'], [
        ['Expliquer un message d’erreur, une commande, un concept', 'Connaître <em>votre</em> réseau, vos serveurs, votre historique'],
        ['Résumer et structurer un journal de 500 lignes', 'Garantir qu’une commande est sûre sur <em>votre</strong> production'],
        ['Proposer un script, une regex, une requête', 'Savoir si un correctif existe <em>aujourd’hui</em> (sa connaissance a une date)'],
        ['Traduire une documentation en anglais', 'Remplacer le test : il n’exécute rien, il prédit du texte plausible'],
        ['Reformuler une réponse pour un utilisateur', 'Décider à votre place — la responsabilité reste la vôtre'],
    ]),
    note('red', '🚨 Le mot à retenir : plausible',
         'Un modèle de langage produit la suite de texte la plus probable, pas la plus vraie. Il '
         'invente une option de commande qui n’existe pas, cite un chemin de fichier d’une autre '
         'distribution, ou affirme avec assurance une cause de panne fausse. On appelle ça une '
         '<strong>hallucination</strong>. Elle est indétectable au ton : seule la vérification la '
         'révèle.'),

    '<h2>2) Ce qu’on ne lui donne jamais</h2>',
    '<p>La première règle n’est pas technique, elle est de confidentialité. Un assistant en ligne '
    'envoie votre texte sur un serveur que vous ne contrôlez pas, et il peut servir à entraîner le '
    'modèle. Avant de coller quoi que ce soit, on <strong>anonymise</strong>.</p>',
    tab(['Ne sort jamais', 'Se remplace par'], [
        ['Mots de passe, clés, jetons, chaînes de connexion', '<code>MOT_DE_PASSE</code>, <code>CLE_API</code>'],
        ['Adresses IP publiques, noms de domaine réels, noms de machines', '<code>203.0.113.10</code>, <code>entreprise.fr</code>, <code>SRV-01</code>'],
        ['Noms, e-mails, identifiants d’utilisateurs (données personnelles, RGPD)', '<code>utilisateur1</code>, <code>u.exemple@…</code>'],
        ['Extraits de configuration complets d’un pare-feu ou d’un annuaire', 'Le seul bloc qui pose question, expurgé'],
        ['Documents internes marqués confidentiels', 'Rien : on demande la méthode, pas l’analyse du document'],
    ]),
    note('yellow', '⚠️ Ce que dit la charte de l’organisation prime',
         'Beaucoup d’entreprises interdisent les assistants publics et imposent un outil interne '
         '(instance dédiée, modèle hébergé, compte d’entreprise sans entraînement sur les données). '
         'Le REAC demande de « connaître les usages de l’IA tel que prévu par la structure '
         'd’accueil » : la première chose à faire en arrivant est de lire cette règle — et de la '
         'demander si elle n’existe pas.'),

    '<h2>3) Demander correctement : le prompt</h2>',
    '<p>La qualité de la réponse dépend d’abord de la question. Un bon prompt technique donne quatre '
    'choses : le <strong>contexte</strong>, la <strong>demande</strong> précise, les '
    '<strong>contraintes</strong>, et la <strong>forme</strong> attendue.</p>',
    cmd('Contexte : serveur Debian 12, Apache 2.4, site en HTTPS derrière un OPNsense.\n'
        'Symptôme : depuis ce matin, "403 Forbidden" sur tout le site, y compris index.html.\n'
        'Ce que j’ai vérifié : le service tourne (systemctl status), le fichier existe,\n'
        '  ls -l donne -rw-r--r-- root root sur index.html, le dossier /var/www/site est en 750 root:root.\n'
        'Demande : liste les causes possibles par ordre de probabilité, avec pour chacune\n'
        '  la commande qui la confirme ou l’écarte. Ne propose pas de modifier les droits\n'
        '  tant que la cause n’est pas confirmée.\n'
        'Forme : un tableau cause / commande de vérification / correction.'),
    '<p>Comparez avec « mon site apache fait 403 pourquoi » : la même IA répondra vingt causes '
    'génériques, dont dix ne s’appliquent pas à votre cas. Le contexte n’est pas de la politesse, '
    'c’est ce qui filtre.</p>',
    acc(
        ('🧭 Les formulations qui marchent',
         bullets('« Explique cette erreur ligne par ligne » — pour comprendre avant d’agir.',
                 '« Quelles vérifications avant de lancer cette commande ? » — pour se protéger.',
                 '« Donne trois hypothèses classées et comment les départager » — pour diagnostiquer.',
                 '« Réécris pour un utilisateur non technique, en trois phrases » — pour communiquer.',
                 '« Qu’est-ce que tu supposes sans que je l’aie dit ? » — pour débusquer les hypothèses cachées.')),
        ('🚫 Celles qui trompent',
         bullets('« C’est bien ça ? » — l’assistant a tendance à acquiescer.',
                 '« Donne-moi la commande » sans contexte — il choisira une distribution au hasard.',
                 '« Corrige » sans dire ce qui est attendu — il corrigera autre chose.',
                 'Coller 2 000 lignes sans question — la réponse sera un résumé vague.')),
    ),

    '<h2>4) Cas n° 1 — lire un journal</h2>',
    '<p>Un extrait de <code>/var/log/auth.log</code>, anonymisé, collé avec la demande « repère les '
    'motifs anormaux et propose une action par motif ».</p>',
    cmd('sep 14 02:11:03 srv sshd[1201]: Failed password for root from 198.51.100.7 port 51022 ssh2\n'
        'sep 14 02:11:05 srv sshd[1203]: Failed password for root from 198.51.100.7 port 51030 ssh2\n'
        'sep 14 02:11:07 srv sshd[1205]: Failed password for invalid user admin from 198.51.100.7 port 51041 ssh2\n'
        '... (340 lignes similaires en 9 minutes)\n'
        'sep 14 02:20:44 srv sshd[1490]: Accepted publickey for jean from 192.168.10.50 port 40112 ssh2\n'
        'sep 14 02:20:51 srv sudo:     jean : TTY=pts/0 ; COMMAND=/usr/bin/apt upgrade'),
    tab(['Ce que l’IA relève', 'Ce qu’on vérifie soi-même', 'Action'], [
        ['Force brute SSH sur root depuis une IP, ~40 essais/min', 'Le compte des lignes : <code>grep -c "Failed password" auth.log</code> ; l’IP n’est pas interne', 'PermitRootLogin no, fail2ban, clés seulement — et bloquer l’IP au pare-feu'],
        ['Une connexion réussie par clé, depuis le LAN, à 2 h 20', 'Est-ce que jean travaillait à cette heure ? (lui demander, pas supposer)', 'Si non : compromission possible du poste de jean, on traite comme un incident'],
        ['Un apt upgrade dans la foulée', 'Le journal d’apt : <code>/var/log/apt/history.log</code>', 'Cohérent avec une intervention planifiée, ou pas'],
    ]),
    note('blue', '💡 Ce que ce cas montre',
         'L’IA a fait le tri en dix secondes — c’est sa vraie valeur sur un journal long. Mais la '
         'question qui compte (« jean était-il là ? ») ne peut pas venir d’elle. Le technicien '
         'garde le diagnostic ; l’assistant a fait le débroussaillage.'),

    '<h2>5) Cas n° 2 — comprendre une erreur</h2>',
    cmd('Job for nginx.service failed because the control process exited with error code.\n'
        'nginx: [emerg] bind() to 0.0.0.0:80 failed (98: Address already in use)'),
    '<p>Demande : « explique, puis donne la commande pour identifier le processus qui tient le port ». '
    'Réponse attendue : le port 80 est déjà pris ; <code>sudo ss -tlnp | grep :80</code>. On '
    '<strong>exécute la commande de diagnostic</strong>, on lit le résultat (souvent un apache2 '
    'oublié), et seulement ensuite on décide. Si l’IA avait proposé « <code>kill -9</code> du '
    'processus », on ne l’aurait pas fait sans savoir lequel.</p>',

    '<h2>6) Vérifier, toujours</h2>',
    steps('<strong>Recouper</strong> avec la documentation officielle (man, docs de l’éditeur) : une option de commande inventée ne s’y trouve pas.',
          '<strong>Tester à blanc</strong> : sur une VM, un instantané, ou avec l’option de simulation (<code>apt -s</code>, <code>rsync -n</code>, <code>-WhatIf</code> en PowerShell).',
          '<strong>Lire la commande avant de la lancer</strong> : chaque option, chaque chemin. Un <code>rm -rf</code> proposé par une IA reste un <code>rm -rf</code>.',
          '<strong>Se méfier de l’assurance</strong> : le ton est le même pour une réponse juste et une réponse fausse.',
          '<strong>Tracer</strong> : ce qui a été demandé, ce qui a été retenu, ce qui a été modifié — dans le ticket ou le compte rendu.'),
    note('gray', '📝 Documenter l’usage',
         'Le REAC demande de « documenter les pratiques d’usage de l’IA pour en garantir la '
         'traçabilité ». Concrètement : dans le ticket ou le compte rendu, une ligne « Diagnostic '
         'assisté par IA (outil interne), hypothèses vérifiées par … ». Le jour où une décision est '
         'contestée, on sait d’où elle vient.'),

    '<h2>7) Quel outil ?</h2>',
    tab(['Type', 'Exemples', 'Quand', 'Point d’attention'], [
        ['Assistant en ligne grand public', 'ChatGPT, Claude, Gemini, Mistral', 'Apprendre, comprendre, s’entraîner', 'Jamais de données de l’organisation sans accord ; vérifier les conditions d’utilisation'],
        ['Assistant d’entreprise', 'Copilot M365, instance dédiée, compte pro', 'Le quotidien en entreprise', 'Ce que la charte autorise ; les données restent dans le périmètre de l’organisation'],
        ['Modèle local', 'Ollama, LM Studio (Llama, Mistral…)', 'Journaux sensibles, sans réseau', 'Moins performant, mais rien ne sort de la machine'],
        ['IA intégrée aux outils', 'Assistants dans un ticketing, une console de supervision', 'Résumés, suggestions', 'Comprendre ce qu’elle voit et où ça part'],
    ]),

    '<h2>8) L’IA dans la veille</h2>',
    '<p>Un assistant est un bon point d’entrée pour une notion nouvelle — « explique-moi Kea DHCP par '
    'rapport à ISC » — à condition de finir sur la source : la documentation, le bulletin de '
    'sécurité, la page du projet. La veille technologique demandée par le référentiel se construit '
    'sur des sources datées (ANSSI, CERT-FR, éditeurs), pas sur la mémoire d’un modèle. Voir '
    '<a href="/pages/organiser-sa-veille">Organiser sa veille</a>.</p>',

    retenir('L’IA <strong>accélère</strong> la lecture, l’explication et le premier jet ; elle ne connaît ni votre réseau ni la vérité du moment.',
            'On <strong>anonymise</strong> tout avant de coller, et on suit la charte de l’organisation.',
            'Un bon prompt donne <strong>contexte, demande, contraintes, forme</strong>.',
            'Chaque réponse se <strong>vérifie</strong> : documentation, test à blanc, lecture de la commande.',
            'On <strong>documente</strong> l’usage dans le ticket : traçabilité.'),
    note('green', '🔗 À lire à côté',
         '<a href="/pages/ia-encadrer">Encadrer l’IA : RGPD, IA Act et sensibilisation des utilisateurs</a> · '
         '<a href="/pages/ia-scripts">Optimiser un script avec l’IA</a> · '
         '<a href="/pages/depannage">Le dépannage</a> · <a href="/pages/le-ticketing">Le ticketing</a>.'),
])

# ══════════════════════════════════════════ 2. Encadrer l'IA (utilisateurs) ══

ENCADRER = '\n'.join([
    hero('Cours · IA', 'Encadrer l’IA : RGPD, IA Act et sensibilisation des utilisateurs',
         'Les risques que le technicien doit connaître, le cadre légal en trois textes, et comment '
         'former les utilisateurs à un usage responsable et sobre.'),
    STYLE,
    '<p>Le technicien est souvent la première personne à qui l’on demande « est-ce que je peux mettre '
    'ça dans ChatGPT ? ». Le REAC 2026 lui confie un rôle d’<strong>encadrement</strong> : connaître '
    'les risques, le cadre réglementaire, et accompagner les utilisateurs — avec un vocabulaire '
    'adapté, y compris aux personnes en situation de handicap.</p>',

    '<h2>1) Les risques, concrètement</h2>',
    tab(['Risque', 'Ce que ça donne au bureau', 'Le réflexe'], [
        ['<strong>Fuite de données</strong>', 'Un contrat, une liste de clients ou un mot de passe collés dans un assistant public — et potentiellement conservés, réutilisés', 'Anonymiser, ou utiliser l’outil interne ; jamais de données personnelles ni confidentielles'],
        ['<strong>Hallucination</strong>', 'Une procédure inventée suivie à la lettre, une jurisprudence fictive dans un courrier', 'Vérifier à la source avant d’agir ou de diffuser'],
        ['<strong>Biais</strong>', 'Un tri de candidatures ou une évaluation qui reproduit des discriminations présentes dans les données d’entraînement', 'Ne pas laisser l’IA décider seule sur des personnes'],
        ['<strong>Désinformation</strong>', 'Un texte, une image ou une voix fabriqués, crédibles, viraux', 'Douter, recouper, signaler'],
        ['<strong>Hameçonnage augmenté</strong>', 'Des mails sans faute, personnalisés, dans un français parfait — l’ancien indice de fraude a disparu', 'Vérifier l’expéditeur et le contexte, pas l’orthographe'],
        ['<strong>Dépendance et déqualification</strong>', 'On ne sait plus faire sans, on ne comprend plus ce qu’on applique', 'Comprendre avant de coller'],
        ['<strong>Coût énergétique</strong>', 'Une requête à un grand modèle coûte bien plus qu’une recherche classique', 'Le bon outil pour la bonne tâche'],
    ]),

    '<h2>2) Le cadre légal en trois textes</h2>',
    '<h3>Le RGPD — les données personnelles</h3>',
    '<p>Le règlement général sur la protection des données (2018) s’applique dès qu’une information '
    'concerne une personne identifiable : un nom, un e-mail, une adresse IP, un identifiant. '
    'Coller un extrait d’annuaire ou une liste d’utilisateurs dans un assistant, c’est un '
    '<strong>traitement</strong>, avec un <strong>transfert</strong> vers un tiers — souvent hors '
    'Union européenne.</p>',
    tab(['Principe', 'Ce que ça impose à l’usage de l’IA'], [
        ['Finalité', 'On n’utilise les données que pour ce pour quoi elles ont été collectées — pas pour « tester un outil »'],
        ['Minimisation', 'Le strict nécessaire : un journal expurgé, jamais le fichier entier'],
        ['Sécurité', 'Pas de données personnelles vers un service non maîtrisé par l’organisation'],
        ['Transparence', 'Les personnes savent ce qu’on fait de leurs données — un traitement par IA ne fait pas exception'],
        ['Responsabilité', 'L’organisation doit pouvoir démontrer sa conformité : d’où la documentation des usages'],
    ]),
    '<h3>Les recommandations de la CNIL</h3>',
    '<p>La Commission nationale de l’informatique et des libertés publie depuis 2024 des '
    'recommandations sur l’IA : base légale d’un traitement, minimisation, information des '
    'personnes, et un guide pratique pour les usages professionnels d’assistants. Trois consignes '
    'reviennent : <strong>ne pas saisir de données personnelles</strong> dans un outil grand public, '
    '<strong>vérifier les résultats</strong> avant toute décision concernant une personne, '
    '<strong>encadrer l’usage par une charte</strong>. Le site cnil.fr est la source à citer.</p>',
    '<h3>L’IA Act — le règlement européen sur l’IA</h3>',
    '<p>Entré en vigueur en 2024, applicable par étapes jusqu’en 2027, il classe les systèmes d’IA par '
    '<strong>niveau de risque</strong> :</p>',
    tab(['Niveau', 'Exemples', 'Conséquence'], [
        ['Inacceptable — interdit', 'Notation sociale, manipulation, reconnaissance des émotions au travail', 'Interdit dans l’Union'],
        ['Haut risque', 'IA de recrutement, d’accès à des services essentiels, d’infrastructures critiques', 'Obligations lourdes : gestion des risques, supervision humaine, documentation, enregistrement'],
        ['Risque limité — transparence', 'Assistants conversationnels, contenus générés (deepfakes)', 'L’utilisateur doit savoir qu’il parle à une IA ; les contenus générés sont signalés'],
        ['Risque minimal', 'Filtre anti-spam, correcteur, suggestions', 'Aucune obligation particulière'],
    ]),
    note('yellow', '⚠️ Ce qui concerne directement le technicien',
         'La transparence (dire quand un contenu est généré), la <strong>formation des '
         'utilisateurs</strong> (l’IA Act demande une « maîtrise de l’IA » des personnes qui s’en '
         'servent au travail), et la vigilance quand un outil « haut risque » arrive dans '
         'l’organisation — par exemple un tri automatique de candidatures ou de tickets impactant '
         'des personnes.'),

    '<h2>3) La sobriété : l’IA a un coût physique</h2>',
    '<p>Entraîner et faire tourner un grand modèle demande des datacenters, de l’électricité et de '
    'l’eau de refroidissement. Ordre de grandeur souvent cité : une requête à un grand modèle '
    'consomme plusieurs fois l’énergie d’une recherche web classique — davantage encore pour la '
    'génération d’images ou de vidéo. Le REAC demande d’intégrer cette dimension :</p>',
    bullets('Le <strong>bon outil</strong> : une recherche, une doc ou une commande <code>man</code> suffisent souvent.',
            'Le <strong>bon modèle</strong> : un modèle léger ou local pour les tâches simples.',
            'Des <strong>requêtes préparées</strong> plutôt que vingt essais improvisés.',
            'Pas de génération d’images « pour voir ».',
            'Le même raisonnement que pour le parc : voir <a href="/pages/deee-sobriete">DEEE et sobriété numérique</a>.'),

    '<h2>4) Sensibiliser les utilisateurs</h2>',
    '<p>Le technicien forme « à une utilisation éthique, responsable et sobre », en adaptant son '
    'vocabulaire. Une séance de trente minutes tient en cinq messages :</p>',
    tab(['Message', 'Comment le dire', 'L’exemple qui marque'], [
        ['Rien de confidentiel ni de personnel', '« Ce que vous collez part chez un tiers et peut y rester »', 'Le contrat client collé « pour le résumer »'],
        ['Vérifiez avant de diffuser', '« L’IA écrit ce qui est plausible, pas ce qui est vrai »', 'La référence de loi inventée dans un courrier officiel'],
        ['Dites que c’est généré', '« Un texte, une image, une voix produits par IA se signalent »', 'La photo « d’illustration » prise pour une vraie'],
        ['Méfiez-vous des mails parfaits', '« L’orthographe n’est plus un indice »', 'Le faux mail du DG sans faute demandant un virement'],
        ['Utilisez l’outil de l’organisation', '« Il y a un assistant validé, avec les bonnes garanties »', 'La charte, sur l’intranet'],
    ]),
    note('blue', '♿ Adapter la communication',
         'Un support de sensibilisation lisible par tous : contrastes suffisants, texte structuré, '
         'alternative textuelle aux images, rythme laissé à la personne, reformulation à la '
         'demande. Les outils d’accessibilité sont détaillés dans '
         '<a href="/pages/accessibilite-windows">Accessibilité numérique</a>.'),

    '<h2>5) La charte d’usage : ce qu’elle contient</h2>',
    bullets('Les outils <strong>autorisés</strong> (et lesquels sont interdits).',
            'Ce qu’on peut y saisir — et la liste de ce qu’on ne saisit <strong>jamais</strong>.',
            'L’obligation de <strong>vérifier</strong> et de rester responsable du résultat.',
            'La <strong>mention</strong> des contenus générés.',
            'Les usages <strong>interdits</strong> : décisions sur des personnes sans contrôle humain, contournement de la sécurité.',
            'À qui poser une question, et à qui signaler un incident (fuite, résultat douteux).'),

    retenir('Six risques à connaître : fuite, hallucination, biais, désinformation, hameçonnage augmenté, coût énergétique.',
            '<strong>RGPD</strong> : une donnée personnelle collée dans un assistant est un traitement et un transfert. <strong>CNIL</strong> : pas de données personnelles dans un outil grand public. <strong>IA Act</strong> : quatre niveaux de risque, transparence et maîtrise des utilisateurs.',
            'Sobriété : le bon outil, le bon modèle, des requêtes préparées.',
            'Sensibiliser = cinq messages, un vocabulaire adapté, une charte.'),
    note('green', '🔗 À lire à côté',
         '<a href="/pages/ia-technicien">L’IA au service du technicien</a> · '
         '<a href="/pages/sensibiliser-utilisateurs">Sensibiliser les utilisateurs à la sécurité</a> · '
         '<a href="/pages/deee-sobriete">DEEE et sobriété numérique</a>.'),
])

# ═══════════════════════════════════════ 3. Optimiser un script avec l'IA ══

AVANT = ('#!/bin/bash\n'
         'cd /srv/data\n'
         'tar czf /srv/backup/backup.tar.gz *\n'
         'rm -rf /srv/backup/old/*\n'
         'cp /srv/backup/backup.tar.gz /srv/backup/old/\n'
         'echo ok')
APRES = ('#!/usr/bin/env bash\n'
         '# Sauvegarde quotidienne de /srv/data vers /srv/backup, 7 jours de rétention.\n'
         'set -euo pipefail\n'
         'SRC="/srv/data"\n'
         'DEST="/srv/backup"\n'
         'JOUR="$(date +%F)"\n'
         'LOG="/var/log/sauvegarde.log"\n'
         '\n'
         'log() { printf \'%s %s\\n\' "$(date \'+%F %T\')" "$*" | tee -a "$LOG" >&2; }\n'
         '\n'
         '[ -d "$SRC" ]  || { log "ERREUR: source absente $SRC"; exit 1; }\n'
         'mkdir -p "$DEST"\n'
         '\n'
         'archive="$DEST/data-$JOUR.tar.gz"\n'
         'tar czf "$archive" -C "$SRC" .          # -C : pas de cd, chemins relatifs propres\n'
         'tar tzf "$archive" >/dev/null           # l’archive se relit : sinon set -e arrête ici\n'
         'log "OK: $archive ($(du -h "$archive" | cut -f1))"\n'
         '\n'
         '# Rétention : on ne supprime que ce qui est plus vieux que 7 jours, et seulement nos archives\n'
         'find "$DEST" -maxdepth 1 -name \'data-*.tar.gz\' -mtime +7 -print -delete | while read -r f; do\n'
         '  log "SUPPRIME: $f"\n'
         'done')

SCRIPTS = '\n'.join([
    hero('Cours · IA / Scripts', 'Optimiser un script avec l’IA',
         'Analyser un script existant, formuler un prompt qui donne le contexte, faire proposer une '
         'version meilleure, la tester, la documenter et la versionner — en Bash et en PowerShell.'),
    STYLE,
    note('gray', '📚 Avant ce cours',
         '<a href="/pages/linux-bash">Scripts Bash</a> et <a href="/pages/scripts-powershell">Scripts '
         'PowerShell</a> : on ne fait pas optimiser par une IA ce qu’on ne sait pas lire. Et '
         '<a href="/pages/ia-technicien">L’IA au service du technicien</a> pour les règles de '
         'confidentialité, qui s’appliquent ici aussi.'),
    '<p>La compétence 8 du REAC 2026 est précise : à partir d’une demande, <strong>analyser un script '
    'existant</strong>, utiliser l’IA pour proposer des améliorations de performance, lisibilité, '
    'modularité ou sécurité, <strong>tester</strong> le résultat, <strong>documenter</strong>. '
    'L’épreuve évalue les prompts (contextualisés, conformes aux règles de sécurité) autant que le '
    'script.</p>',

    '<h2>1) D’abord lire le script — sans l’IA</h2>',
    '<p>Un script trouvé sur un serveur, lancé chaque nuit par cron :</p>',
    cmd(AVANT),
    '<p>Avant de demander quoi que ce soit, on liste soi-même ce qui cloche. C’est l’exercice qui '
    'fait la différence entre « faire optimiser » et « savoir ce qu’on optimise » :</p>',
    tab(['Ligne', 'Problème', 'Conséquence'], [
        ['<code>cd /srv/data</code>', 'Pas de vérification du succès', 'Si le dossier manque, le <code>tar *</code> archive… le dossier courant du lanceur'],
        ['<code>tar czf … *</code>', 'Le joker exclut les fichiers cachés ; un seul nom d’archive', 'Écrasée chaque nuit : une seule version, jamais d’historique'],
        ['<code>rm -rf /srv/backup/old/*</code>', 'Supprime AVANT d’avoir vérifié que la nouvelle archive est bonne', 'Une nuit où tar échoue, il ne reste rien'],
        ['<code>echo ok</code>', 'Toujours affiché, même en cas d’échec', 'Le journal ment'],
        ['Aucun <code>set -e</code>, aucune variable, aucun commentaire', 'Fragile, illisible, non testable', 'Personne n’ose y toucher'],
    ]),

    '<h2>2) Le prompt : contexte, demande, contraintes, forme</h2>',
    cmd('Contexte : script Bash lancé par cron chaque nuit sur une Debian 12, en root.\n'
        'Il sauvegarde /srv/data (environ 20 Go, fichiers d’une application métier) vers /srv/backup.\n'
        'Voici le script actuel : [script collé — aucune donnée sensible dedans]\n'
        'Problèmes que j’ai identifiés : suppression avant vérification, une seule version,\n'
        '  joker qui ignore les fichiers cachés, aucune gestion d’erreur, message "ok" trompeur.\n'
        'Demande : propose une version corrigée qui garde 7 jours d’archives datées, vérifie\n'
        '  l’archive avant toute suppression, journalise dans /var/log/sauvegarde.log,\n'
        '  et s’arrête proprement à la première erreur.\n'
        'Contraintes : Bash pur, outils standard (tar, find), pas de dépendance à installer,\n'
        '  pas de suppression hors de /srv/backup, explique chaque changement en commentaire.\n'
        'Forme : le script complet, puis la liste des changements avec leur raison.'),
    note('blue', '💡 Pourquoi lister soi-même les problèmes',
         'Deux raisons. L’IA corrige mieux ce qu’on lui désigne — et on peut vérifier qu’elle a '
         'traité chaque point. Et le jury de l’épreuve juge le prompt : « rends ce script mieux » '
         'n’est pas un prompt contextualisé.'),
    note('red', '🚨 Ce que le prompt ne contient pas',
         'Aucun mot de passe, aucun nom de serveur réel, aucun chemin révélant un client. Si le '
         'script d’origine contenait un identifiant en clair (ça arrive), on le remplace par '
         '<code>MOT_DE_PASSE</code> avant de coller — et on note qu’il faudra le sortir du script '
         'pour de bon (fichier protégé, variable d’environnement).'),

    '<h2>3) La réponse — et ce qu’on en fait</h2>',
    cmd(APRES),
    '<p>On ne l’adopte pas parce qu’elle a l’air propre. On la <strong>relit</strong> ligne par ligne, '
    'et on repère ce que l’IA a ajouté sans qu’on l’ait demandé :</p>',
    bullets('<code>set -euo pipefail</code>, variables, <code>log()</code> : demandé, conforme au <a href="/pages/linux-bash">cours Bash</a>.',
            '<code>tar -C "$SRC" .</code> : corrige le joker ET le <code>cd</code> — mieux que prévu, à comprendre avant d’accepter.',
            '<code>tar tzf … &gt;/dev/null</code> : la vérification demandée. Sous <code>set -e</code>, une archive illisible arrête le script <em>avant</em> la rétention.',
            '<code>find … -mtime +7 -name \'data-*.tar.gz\'</code> : ne supprime que nos archives, seulement dans <code>$DEST</code>, seulement les vieilles — la contrainte « pas de suppression hors de /srv/backup » est respectée. On vérifie qu’il n’y a pas de <code>-delete</code> sans <code>-name</code>.',
            'Ce qui manque encore : rien n’alerte personne si le script échoue. Un <code>trap</code> ou un mail sur erreur serait la prochaine itération.'),

    '<h2>4) Tester avant de remplacer</h2>',
    steps('<strong>Analyse statique</strong> : <code>shellcheck sauvegarde.sh</code> — l’IA fait aussi des fautes de guillemets.',
          '<strong>À blanc</strong> : sur une VM, avec un <code>/srv/data</code> de test (quelques fichiers, dont un caché et un avec espace dans le nom).',
          '<strong>Le cas d’erreur</strong> : renommer <code>/srv/data</code> et lancer — le script doit s’arrêter avec le message d’erreur, sans rien supprimer.',
          '<strong>La rétention</strong> : créer des archives datées de 10 jours (<code>touch -d "10 days ago"</code>) et vérifier que seules celles-là partent.',
          '<strong>En conditions réelles</strong> : une première exécution à la main, le journal lu, puis seulement le cron.'),
    cmd('sudo -u root bash -n sauvegarde.sh            # syntaxe seulement\n'
        'shellcheck sauvegarde.sh\n'
        'sudo bash -x sauvegarde.sh 2>&1 | tail -20   # trace de l’exécution'),

    '<h2>5) Le même exercice en PowerShell</h2>',
    '<p>Un script Windows qui crée des comptes AD depuis un CSV, trouvé dans un partage :</p>',
    cmd('Import-Csv C:\\temp\\users.csv | ForEach-Object {\n'
        '  New-ADUser -Name $_.nom -SamAccountName $_.login -AccountPassword (ConvertTo-SecureString "Azerty123!" -AsPlainText -Force) -Enabled $true\n'
        '}'),
    tab(['Problème', 'Ce qu’on demande à l’IA'], [
        ['Mot de passe en clair, identique pour tous', 'Générer un mot de passe aléatoire par compte et forcer le changement à la première ouverture'],
        ['Aucune vérification d’existence', 'Ignorer (et journaliser) les comptes déjà présents'],
        ['Chemin en dur, aucun paramètre', 'Un paramètre <code>-Csv</code> obligatoire, avec <code>[CmdletBinding()]</code>'],
        ['Aucun test possible', 'Supporter <code>-WhatIf</code> pour voir sans créer'],
        ['Aucune trace', 'Un journal avec <code>Start-Transcript</code> ou une fonction de log'],
    ]),
    '<p>Le prompt suit la même grammaire ; la réponse se teste avec <code>-WhatIf</code> sur un '
    'contrôleur de domaine de laboratoire, jamais en production. Le cours '
    '<a href="/pages/scripts-powershell">Scripts PowerShell</a> donne les bases pour la relire.</p>',

    '<h2>6) Adapter un script d’éditeur</h2>',
    '<p>Le REAC cite un cas fréquent : un script d’installation fourni par un éditeur (un '
    '<code>install.sh</code>, un <code>.ps1</code> de déploiement) qu’il faut adapter — autre '
    'chemin, autre compte de service, une étape à sauter. L’IA est utile pour <strong>expliquer '
    'ce que fait le script</strong> avant qu’on y touche (« commente ce script section par '
    'section ») et pour repérer ce qui dépend de l’environnement. Ce qu’on ne fait pas : lancer '
    'un script d’éditeur modifié par une IA sans l’avoir lu en entier.</p>',

    '<h2>7) Documenter et versionner</h2>',
    bullets('<strong>En tête du script</strong> : ce qu’il fait, qui l’a écrit ou modifié, quand, et — le REAC le demande — la mention de l’assistance IA et de ce qui a été vérifié.',
            '<strong>Un dépôt Git</strong>, même local : <code>git init</code>, un commit par version, le message dit pourquoi. Un script sur le bureau d’un serveur n’a pas d’historique.',
            '<strong>Le journal des prompts</strong> utiles : les demandes qui ont bien marché se réutilisent.',
            '<strong>Le test</strong> conservé à côté du script (le jeu de données de test, la commande).'),
    cmd('git init /srv/scripts && cd /srv/scripts\n'
        'git add sauvegarde.sh && git commit -m "Sauvegarde : archives datees, verification, retention 7 j (assiste IA, teste sur VM)"'),

    retenir('On <strong>lit et diagnostique</strong> le script soi-même avant de demander.',
            'Le prompt donne <strong>contexte, problèmes identifiés, demande, contraintes, forme</strong> — sans aucun secret.',
            'La réponse se <strong>relit</strong> (ce qui a été ajouté sans demande) et se <strong>teste</strong> : shellcheck / <code>-WhatIf</code>, VM, cas d’erreur, rétention.',
            'On <strong>documente</strong> (en-tête, assistance IA mentionnée) et on <strong>versionne</strong> (Git).',
            'Un script d’éditeur se fait <strong>expliquer</strong> avant d’être adapté, et se lit en entier.'),
    note('green', '🎓 S’entraîner',
         'Prendre un script existant du site — <a href="/pages/procedure-cron-journaux">celui de la '
         'procédure cron</a>, ou un <code>.ps1</code> du <a href="/pages/constructeur-ad">constructeur '
         'AD</a> — lister ses faiblesses, écrire le prompt, comparer la réponse à la vôtre.'),
])

PAGES = [
    ('ia-technicien', 'L’IA au service du technicien',
     'Diagnostiquer, lire un journal, comprendre une erreur avec un assistant : ce qu’on lui donne, comment on lui demande, comment on vérifie.',
     TECHNICIEN, 'Utiliser l’IA',
     'Ce qu’un assistant sait faire, ce qu’on ne lui donne jamais, le prompt en quatre parties, deux cas (journal, erreur) et la vérification.'),
    ('ia-encadrer', 'Encadrer l’IA : RGPD, IA Act et sensibilisation des utilisateurs',
     'Les risques (fuite, hallucination, biais, désinformation), le cadre RGPD / CNIL / IA Act, la sobriété, et une séance de sensibilisation en cinq messages.',
     ENCADRER, 'Encadrer l’usage',
     'Six risques, trois textes (RGPD, CNIL, IA Act et ses niveaux de risque), la sobriété, et comment sensibiliser les utilisateurs.'),
    ('ia-scripts', 'Optimiser un script avec l’IA',
     'Analyser un script existant, écrire le prompt, relire et tester la proposition, documenter et versionner — en Bash et en PowerShell.',
     SCRIPTS, 'Scripts &amp; automatisation',
     'Un script de sauvegarde avant/après, le prompt contextualisé, la relecture, les tests (shellcheck, -WhatIf, VM), Git.'),
]

if __name__ == '__main__':
    publier_lot(PAGES, CAT)
    sys.exit(0)

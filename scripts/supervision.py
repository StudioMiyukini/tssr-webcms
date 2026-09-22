# -*- coding: utf-8 -*-
"""
Chantier P1/P2 du comparatif REAC 2026 : mettre à jour et superviser (compétence 10).

`supervision` faisait 2 Ko et citait encore le « CCP2 » ; rien sur l'installation
d'un outil, rien sur la gestion des mises à jour comme processus, rien sur les
vulnérabilités. La page est réécrite (garnie) et trois cours l'accompagnent dans
un sous-groupe neuf de Maintenance, « Supervision & mises à jour », où la carte
`supervision` est déplacée.

IDEMPOTENT.
"""
import sys

from _cours import (Categorie, STYLE, acc, bullets, cmd, hero, menu, note, publier_lot, retenir, steps, tab)

MAINT = Categorie('cat-maintenance', '🛠️', 'Maintenance', '', '#dc2626')
SG = 'Supervision &amp; mises à jour'

# ═══════════════════════════════════════════════════════ La supervision ══

SUPERVISION = '\n'.join([
    hero('Cours · Exploitation', 'La supervision (monitoring)',
         'Savoir qu’un service est tombé avant que l’utilisateur n’appelle — et, mieux, avant qu’il '
         'ne tombe. États et seuils, sondes, SNMP, agents, alertes, tableaux de bord, et ce qu’on '
         'supervise sur un SI de PME.'),
    STYLE,
    '<p>La supervision surveille en permanence l’<strong>état</strong> des équipements et des services, '
    'et <strong>alerte</strong> quand quelque chose sort de la normale : un service arrêté, un disque '
    'presque plein, une température qui monte, un certificat qui expire dans dix jours. Le REAC 2026 '
    'en fait la compétence 10, dans le CCP 3 « maintenir en conditions opérationnelles » : « les '
    'indicateurs supervisés sont conformes au cahier des charges ; les incidents identifiés via la '
    'supervision sont analysés et remontés ».</p>',
    note('blue', '💡 Trois questions, dans l’ordre',
         '<strong>Est-ce que ça répond ?</strong> (disponibilité) · <strong>Est-ce que ça va tenir ?</strong> '
         '(ressources, tendances) · <strong>Est-ce que c’est normal ?</strong> (journaux, sécurité). Une '
         'supervision qui ne répond qu’à la première fait de la constatation, pas de la prévention.'),

    '<h2>1) Ce qu’on surveille</h2>',
    tab(['Famille', 'Indicateurs', 'Exemple de seuil'], [
        ['<strong>Disponibilité</strong>', 'L’hôte répond (ICMP), le port est ouvert (TCP), le service répond correctement (HTTP 200, réponse DNS, bannière SMTP)', 'Pas de réponse à 3 essais consécutifs → CRITICAL'],
        ['<strong>Ressources</strong>', 'CPU, mémoire, espace disque, entrées/sorties, charge, swap', 'Disque : &gt; 80 % WARNING, &gt; 90 % CRITICAL ; ou « plein dans moins de 7 jours » selon la tendance'],
        ['<strong>Réseau</strong>', 'État des ports, débit, erreurs et collisions, latence, perte de paquets', 'Port de liaison inter-commutateurs down → CRITICAL ; erreurs CRC en hausse → WARNING'],
        ['<strong>Services et applications</strong>', 'Processus, service Windows / unité systemd, file d’attente d’impression, nombre de sessions, temps de réponse', 'Temps de réponse du site &gt; 2 s → WARNING'],
        ['<strong>Matériel et environnement</strong>', 'Température, ventilateurs, alimentations (IPMI, iDRAC, iLO), état RAID, batterie de l’onduleur, humidité de la salle', 'Un disque du RAID en échec → CRITICAL immédiat'],
        ['<strong>Sauvegardes et sécurité</strong>', 'Âge de la dernière sauvegarde réussie, espace de sauvegarde, expiration des certificats, échecs de connexion, MAJ en attente', 'Sauvegarde &gt; 36 h → CRITICAL ; certificat &lt; 14 j → WARNING'],
    ]),

    '<h2>2) États et seuils</h2>',
    tab(['État', 'Signification', 'Ce qu’on en fait'], [
        ['<span style="color:#059669;font-weight:700">OK</span>', 'Dans la normale', 'Rien'],
        ['<span style="color:#d97706;font-weight:700">WARNING</span>', 'Seuil d’alerte atteint (disque à 82 %)', 'Une action <em>planifiée</em> : ticket, nettoyage, extension'],
        ['<span style="color:#dc2626;font-weight:700">CRITICAL</span>', 'Seuil critique ou service tombé', 'Une action <em>immédiate</em> ; notification'],
        ['<span style="color:#6b7280;font-weight:700">UNKNOWN</span>', 'La sonde n’a pas pu mesurer (agent injoignable, identifiants SNMP faux)', 'Réparer la <em>supervision</em>, pas la cible — un UNKNOWN qui dure cache un vrai incident'],
    ]),
    bullets('Un seuil se règle avec l’<strong>hystérésis</strong> : alerte à 90 %, retour à OK sous 85 % — sinon un disque qui oscille autour de 90 % envoie une alerte par minute.',
            'Un <strong>nombre d’essais</strong> avant de passer en état confirmé (3 échecs à 1 minute d’intervalle) : une perte de paquet isolée n’est pas une panne.',
            'Des <strong>seuils par contexte</strong> : 90 % sur un disque système de 100 Go, c’est 10 Go ; sur une baie de 50 To, c’est 5 To — un seuil en valeur absolue ou en tendance est plus juste.',
            'Une <strong>période de maintenance</strong> déclarée avant une intervention : pas d’alerte pendant qu’on redémarre volontairement.'),

    '<h2>3) Comment on mesure : sondes actives, agents, SNMP, journaux</h2>',
    tab(['Méthode', 'Principe', 'Bon pour', 'Limite'], [
        ['<strong>Sonde active sans agent</strong>', 'Le serveur de supervision <em>interroge</em> la cible de l’extérieur : ping, port TCP, requête HTTP / DNS, connexion SSH', 'La disponibilité vue comme un utilisateur ; tout ce qui n’accepte pas d’agent', 'Ne voit pas l’intérieur (CPU, disque)'],
        ['<strong>Agent</strong>', 'Un petit programme installé sur la cible (agent Zabbix, NRPE, Telegraf, Prometheus node_exporter) répond au serveur ou lui envoie ses mesures', 'Ressources, services, journaux, scripts maison', 'Un logiciel de plus à déployer et maintenir ; un port à ouvrir'],
        ['<strong>SNMP</strong>', 'Le protocole standard des équipements réseau et matériels : le serveur lit des valeurs (OID) dans la MIB de l’équipement ; l’équipement peut envoyer des <em>traps</em>', 'Commutateurs, routeurs, pare-feu, imprimantes, onduleurs, NAS, cartes IPMI', 'v1/v2c : communauté en clair (« public ») ; <strong>v3</strong> : authentification et chiffrement — à utiliser'],
        ['<strong>WMI / PowerShell Remoting</strong>', 'Interrogation native de Windows', 'Windows sans agent', 'Identifiants privilégiés à protéger'],
        ['<strong>Journaux</strong>', 'Collecte centralisée (syslog, Windows Event Forwarding, agent) et règles sur le contenu', 'Sécurité, erreurs applicatives, audit', 'Volume ; c’est le domaine du SIEM'],
        ['<strong>IPMI / Redfish</strong>', 'La carte de gestion du serveur, hors système d’exploitation', 'Température, alimentations, RAID, même serveur éteint', 'Un réseau d’administration dédié'],
    ]),
    cmd('# SNMP en pratique : lire l’état des ports d’un commutateur (v2c, communauté « lecture »)\n'
        'snmpwalk -v2c -c lecture 192.168.1.2 1.3.6.1.2.1.2.2.1.8      # ifOperStatus : 1 = up, 2 = down\n'
        'snmpget  -v2c -c lecture 192.168.1.2 1.3.6.1.2.1.1.3.0        # sysUpTime\n'
        '# v3 : utilisateur, authentification SHA, chiffrement AES\n'
        'snmpwalk -v3 -u superv -l authPriv -a SHA -A "MotDePasseAuth" -x AES -X "MotDePasseChiffr" 192.168.1.2 system'),
    note('yellow', '⚠️ SNMP côté sécurité',
         'La communauté « public » en lecture sur tout le parc, c’est l’inventaire du réseau offert à '
         'quiconque écoute. SNMP v3, ou au minimum une communauté non triviale, restreinte à l’adresse '
         'du serveur de supervision (ACL sur l’équipement), jamais en écriture.'),

    '<h2>4) Alerter les bonnes personnes, au bon moment</h2>',
    bullets('<strong>Canaux</strong> : mail pour le WARNING, SMS / application (Signal, Teams, PagerDuty) pour le CRITICAL, ticket automatique dans le <a href="/pages/le-ticketing">ticketing</a>.',
            '<strong>Escalade</strong> : non acquitté en 15 min → le niveau suivant. Une alerte acquittée arrête les rappels mais reste visible.',
            '<strong>Dépendances</strong> : si le commutateur du bâtiment tombe, les 40 hôtes derrière lui sont injoignables — une seule alerte (le commutateur), pas 41. La supervision doit connaître la topologie.',
            '<strong>Bruit</strong> : une alerte qui part chaque nuit et que personne ne traite finit ignorée — et le jour où elle compte aussi. Chaque alerte récurrente se corrige ou se supprime.',
            '<strong>Astreinte</strong> : qui reçoit quoi, à quelle heure, est écrit ; le CRITICAL du dimanche a un destinataire.'),

    '<h2>5) Voir : tableaux de bord et tendances</h2>',
    '<p>L’état à l’instant t tient sur un écran : ce qui est rouge, ce qui est orange, depuis quand. '
    'Les <strong>graphiques</strong> sur 30 jours répondent à l’autre question : le disque sera plein '
    'dans trois semaines, la mémoire du serveur de fichiers monte depuis la mise à jour, le lien '
    'Internet sature chaque jour à 14 h. C’est la <strong>capacité</strong> — l’argument chiffré pour '
    'demander un disque ou une ligne avant la panne. Grafana est l’outil de référence pour ces vues, '
    'branché sur Zabbix, Prometheus ou une base de séries temporelles.</p>',

    '<h2>6) Les outils</h2>',
    tab(['Outil', 'Profil', 'Quand'], [
        ['<strong>Zabbix</strong>', 'Libre, complet, interface web, agents + SNMP + IPMI, modèles prêts, cartes, graphiques, alertes', 'La PME et l’ETI ; l’outil de ce site — <a href="/pages/installer-zabbix">Installer Zabbix</a>'],
        ['<strong>Nagios / Centreon</strong>', 'La lignée historique : sondes (plugins), configuration par fichiers ; Centreon ajoute l’interface et l’industrialisation', 'Les parcs qui les ont déjà ; Centreon dans les grands comptes français'],
        ['<strong>Prometheus + Grafana</strong>', 'Métriques tirées d’exporteurs, langage de requête, alertes ; Grafana pour les tableaux de bord', 'Conteneurs, cloud, applications modernes'],
        ['<strong>PRTG</strong>', 'Commercial (gratuit jusqu’à 100 capteurs), Windows, très simple', 'Petite structure sans compétence Linux'],
        ['<strong>Uptime Kuma</strong>', 'Ultra-léger, en conteneur, disponibilité HTTP / TCP / ping, page de statut', 'Un premier pas, ou les services exposés sur Internet'],
        ['<strong>LibreNMS / Observium</strong>', 'Spécialisés réseau (SNMP), découverte automatique, cartes de ports', 'Beaucoup d’équipements réseau'],
        ['<strong>Wazuh / SIEM</strong>', 'Journaux, détection, conformité', 'La sécurité ; voir <a href="/pages/dmz-surveillance-entretien">Surveiller une DMZ</a>'],
    ]),

    '<h2>7) Ce que ça donne pour une PME</h2>',
    acc(
        ('Le périmètre supervisé (40 postes, 8 serveurs, 4 commutateurs, un pare-feu)',
         tab(['Cible', 'Méthode', 'Indicateurs'], [
             ['2 DC Windows', 'Agent', 'CPU, RAM, disques, services AD DS / DNS / DHCP, réplication (<code>repadmin</code> via script), sauvegarde état système &lt; 36 h'],
             ['Serveur de fichiers', 'Agent', 'Espace par volume + tendance, service Serveur, clichés VSS, sauvegarde'],
             ['Serveur applicatif + base', 'Agent', 'Service, temps de réponse, taille du journal de transactions, sauvegarde base &lt; 2 h'],
             ['2 hôtes Hyper-V / Proxmox', 'Agent + IPMI', 'CPU, RAM, stockage, VM en état arrêté inattendu, température, RAID, alimentations'],
             ['Pare-feu OPNsense', 'SNMP v3 + sonde HTTP', 'Débit WAN, sessions, CPU, VPN up, certificat de l’interface'],
             ['4 commutateurs', 'SNMP v3', 'Ports de liaison, erreurs, température, uptime (un reboot = alerte)'],
             ['Onduleur', 'SNMP (carte réseau) ou USB sur un serveur', 'Sur batterie, charge, autonomie, état batterie'],
             ['Site web public, VPN', 'Sonde HTTP / TCP depuis l’extérieur', 'Disponibilité vue d’Internet, certificat'],
             ['Imprimantes', 'SNMP v2c en lecture', 'Toner, bourrage, état'],
         ])),
        ('La routine',
         bullets('<strong>Chaque matin</strong> : l’écran des problèmes ; tout ce qui est rouge a un ticket ou une raison.',
                 '<strong>Chaque semaine</strong> : les UNKNOWN et les alertes récurrentes ; les hôtes non supervisés (un nouveau serveur oublié).',
                 '<strong>Chaque mois</strong> : les tendances (disque, réseau) → capacité ; le rapport de disponibilité par service, comparé au contrat de service.',
                 '<strong>À chaque changement</strong> : un serveur ajouté = un hôte ajouté dans la supervision, le jour même. La supervision fait partie de la procédure d’installation.')),
    ),

    '<h2>8) De l’alerte à l’incident</h2>',
    '<p>Une alerte n’est pas un incident : elle en est le signal. Le RE attend que les incidents '
    'identifiés soient « analysés et remontés » :</p>',
    steps('<strong>Acquitter</strong> l’alerte (on sait, on s’en occupe).',
          '<strong>Qualifier</strong> : vrai incident, fausse alerte, ou maintenance non déclarée ? Impact (qui, quoi) ?',
          '<strong>Ouvrir un ticket</strong> (ou l’enrichir s’il existe) avec l’alerte, l’heure, le graphique.',
          '<strong>Diagnostiquer et corriger</strong> — <a href="/pages/depannage">Le dépannage</a>.',
          '<strong>Remonter</strong> au responsable si le contrat de service est menacé, ou si l’incident dépasse ton périmètre.',
          '<strong>Boucler</strong> : l’alerte est-elle revenue à OK ? Le seuil était-il le bon ? Faut-il un nouvel indicateur pour voir venir la prochaine fois ?'),

    retenir('Superviser = <strong>disponibilité, ressources, réseau, services, matériel, sauvegardes et sécurité</strong> ; répondre à « ça répond ? », « ça va tenir ? », « c’est normal ? ».',
            'États OK / WARNING / CRITICAL / <strong>UNKNOWN</strong> ; seuils avec hystérésis, essais, périodes de maintenance.',
            'Mesurer par <strong>sondes actives</strong>, <strong>agents</strong>, <strong>SNMP v3</strong>, journaux, IPMI.',
            'Alerter avec <strong>escalade</strong> et <strong>dépendances</strong>, sans bruit ; voir les <strong>tendances</strong> pour la capacité.',
            'Un nouvel équipement entre dans la supervision le jour de son installation ; une alerte devient un ticket, analysé et remonté.'),
    note('green', '🔗 La suite',
         '<a href="/pages/installer-zabbix">Installer Zabbix et superviser un premier parc</a> · '
         '<a href="/pages/gerer-mises-a-jour">Gérer les mises à jour</a> · '
         '<a href="/pages/gestion-vulnerabilites">Gestion des vulnérabilités</a> · '
         '<a href="/pages/dmz-surveillance-entretien">Surveiller et entretenir une DMZ</a>.'),
])

# ═════════════════════════════════════════════════════ Installer Zabbix ══

ZABBIX = '\n'.join([
    hero('Cours · Exploitation', 'Installer Zabbix et superviser un premier parc',
         'Un serveur Zabbix sur Debian, un agent sur un serveur Windows et un serveur Linux, un '
         'commutateur en SNMP, des modèles, un déclencheur, une alerte par mail — en une après-midi.'),
    STYLE,
    note('gray', '📚 Avant ce cours',
         '<a href="/pages/supervision">La supervision</a> pour les notions, '
         '<a href="/pages/linux-bases">Linux : les bases</a> et <a href="/pages/linux-apache">Apache</a> pour le serveur.'),
    '<p>Zabbix est l’outil de supervision libre le plus répandu dans les PME françaises : un serveur, '
    'une base de données, une interface web, des agents. Il sait tout faire (agents, SNMP, IPMI, '
    'sondes HTTP, scripts), avec des <strong>modèles</strong> prêts pour Windows, Linux, les '
    'commutateurs, les hyperviseurs. Ce cours l’installe et le met au travail.</p>',

    '<h2>1) Le vocabulaire Zabbix</h2>',
    tab(['Terme', 'C’est…'], [
        ['<strong>Hôte</strong>', 'Une machine ou un équipement supervisé, avec ses interfaces (agent, SNMP, IPMI)'],
        ['<strong>Élément</strong> (item)', 'Une mesure : espace libre de C:, état du service Spooler, ifOperStatus du port 24'],
        ['<strong>Déclencheur</strong> (trigger)', 'Une condition sur des éléments qui produit un problème : « espace libre &lt; 10 % pendant 5 min »'],
        ['<strong>Modèle</strong> (template)', 'Un jeu d’éléments, déclencheurs et graphiques réutilisable : « Windows by Zabbix agent », « Linux by Zabbix agent », « Cisco IOS by SNMP »…'],
        ['<strong>Découverte de bas niveau</strong> (LLD)', 'Le modèle trouve tout seul les disques, les interfaces réseau, les services et crée les éléments'],
        ['<strong>Action</strong>', 'Ce qui se passe quand un problème apparaît : notifier un groupe, exécuter un script, escalader'],
        ['<strong>Média</strong>', 'Un canal de notification : mail, SMS, webhook (Teams, Slack, Signal)'],
        ['<strong>Proxy</strong>', 'Un collecteur intermédiaire pour un site distant ou une DMZ'],
    ]),

    '<h2>2) Installer le serveur (Debian 12, MariaDB, Apache)</h2>',
    steps('Une VM : 2 vCPU, 4 Go, 40 Go (la base grossit avec l’historique), IP fixe, nom <code>zabbix.entreprise.local</code> dans le DNS.',
          'Le dépôt officiel Zabbix (la version des dépôts Debian est ancienne) — version LTS (7.0 au moment d’écrire).',
          'Les paquets : serveur, interface web, agent (pour se superviser lui-même), et MariaDB.',
          'La base : créer <code>zabbix</code> avec un utilisateur dédié, importer le schéma.',
          'Configurer le serveur (<code>DBPassword</code>), démarrer, ouvrir l’interface : <code>http://zabbix.entreprise.local/zabbix</code> — l’assistant finit la configuration.',
          'Changer le mot de passe du compte <code>Admin</code> (par défaut <code>zabbix</code>) <strong>avant</strong> toute autre chose ; passer l’interface en HTTPS avec un certificat de la <a href="/pages/pki-adcs">PKI</a>.'),
    cmd('wget https://repo.zabbix.com/zabbix/7.0/debian/pool/main/z/zabbix-release/zabbix-release_latest_7.0+debian12_all.deb\n'
        'dpkg -i zabbix-release_latest_7.0+debian12_all.deb && apt update\n'
        'apt install -y zabbix-server-mysql zabbix-frontend-php zabbix-apache-conf zabbix-sql-scripts zabbix-agent2 mariadb-server\n'
        '\n'
        'mysql -uroot -e "CREATE DATABASE zabbix CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;\n'
        '  CREATE USER zabbix@localhost IDENTIFIED BY \'MotDePasseBase\';\n'
        '  GRANT ALL PRIVILEGES ON zabbix.* TO zabbix@localhost; SET GLOBAL log_bin_trust_function_creators = 1;"\n'
        'zcat /usr/share/zabbix-sql-scripts/mysql/server.sql.gz | mysql -uzabbix -p zabbix\n'
        'mysql -uroot -e "SET GLOBAL log_bin_trust_function_creators = 0;"\n'
        '\n'
        'sed -i \'s/^# DBPassword=.*/DBPassword=MotDePasseBase/\' /etc/zabbix/zabbix_server.conf\n'
        'systemctl restart zabbix-server zabbix-agent2 apache2 && systemctl enable zabbix-server zabbix-agent2 apache2\n'
        'journalctl -u zabbix-server -n 20         # "server #0 started" = OK'),
    note('blue', '💡 En conteneur',
         'Zabbix fournit une pile Docker Compose officielle (serveur, base, web, agent). Pour un '
         'laboratoire ou une petite structure, c’est le plus rapide — voir '
         '<a href="/pages/docker-30-minutes">Docker en 30 minutes</a>. La base reste dans un volume '
         'sauvegardé.'),

    '<h2>3) Superviser un serveur Linux (agent 2)</h2>',
    cmd('# sur le serveur cible (Debian)\n'
        'apt install -y zabbix-agent2\n'
        'sed -i \'s/^Server=.*/Server=192.168.10.20/; s/^ServerActive=.*/ServerActive=192.168.10.20/; s/^Hostname=.*/Hostname=srv-web01/\' /etc/zabbix/zabbix_agent2.conf\n'
        'systemctl enable --now zabbix-agent2\n'
        'ss -tlnp | grep 10050                      # l’agent écoute ; ouvrir 10050/tcp depuis le serveur Zabbix seulement\n'
        '\n'
        '# depuis le serveur Zabbix : ça répond ?\n'
        'zabbix_get -s 192.168.10.31 -k agent.ping        # 1\n'
        'zabbix_get -s 192.168.10.31 -k vfs.fs.size[/,pfree]'),
    steps(menu('Collecte de données › Hôtes › Créer un hôte') + ' : nom <code>srv-web01</code> (identique au <code>Hostname</code> de l’agent), groupe « Linux servers », interface Agent 192.168.10.31:10050.',
          'Modèle : <strong>Linux by Zabbix agent</strong>. Sauvegarder.',
          'Deux minutes plus tard, ' + menu('Surveillance › Dernières données') + ' se remplit : CPU, mémoire, chaque système de fichiers découvert, chaque interface.',
          'Ajouter un élément maison si besoin : <code>systemd.unit.get[apache2.service]</code> ou <code>net.tcp.service[http,,80]</code>.'),

    '<h2>4) Superviser un serveur Windows</h2>',
    steps('Télécharger l’agent 2 Windows (MSI) sur le site de Zabbix ; l’installer avec l’adresse du serveur et le nom d’hôte — ou en masse : <code>msiexec /i zabbix_agent2.msi /qn SERVER=192.168.10.20 SERVERACTIVE=192.168.10.20 HOSTNAME=%COMPUTERNAME%</code> par GPO ou script.',
          'Règle de pare-feu Windows : 10050/tcp entrant depuis le serveur Zabbix — voir <a href="/pages/procedure-pare-feu-windows">Créer une règle de pare-feu Windows</a>.',
          'Dans Zabbix : hôte, groupe « Windows servers », modèle <strong>Windows by Zabbix agent</strong> : services, disques, CPU, mémoire, journal d’événements.',
          'Pour un DC, ajouter des éléments : <code>service.info[NTDS]</code>, <code>service.info[DNS]</code>, <code>service.info[DHCPServer]</code>, et un élément <code>eventlog[System,,"Error"]</code> pour les erreurs système.'),

    '<h2>5) Superviser un commutateur ou un pare-feu en SNMP</h2>',
    steps('Sur l’équipement : activer SNMP <strong>v3</strong> (utilisateur, authentification SHA, chiffrement AES), restreint à l’adresse du serveur Zabbix. Exemple Cisco : <code>snmp-server group SUPERV v3 priv</code>, <code>snmp-server user superv SUPERV v3 auth sha … priv aes 128 …</code>, <code>snmp-server view</code> en lecture.',
          'Sur OPNsense : ' + menu('Services › SNMP') + ' (plugin os-net-snmp), v3, utilisateur dédié.',
          'Dans Zabbix : hôte avec interface <strong>SNMP</strong> (161), version 3, identifiants ; modèle <strong>Cisco IOS by SNMP</strong> (ou « Generic by SNMP » pour l’inconnu, « OPNsense by SNMP » via la communauté).',
          'Le modèle découvre les interfaces : état, débit, erreurs. On désactive les ports d’accès dont on se moque, on garde les liaisons et les ports critiques.'),
    cmd('# tester avant de configurer Zabbix\n'
        'snmpwalk -v3 -u superv -l authPriv -a SHA -A "AuthPass" -x AES -X "PrivPass" 192.168.1.2 1.3.6.1.2.1.1'),

    '<h2>6) Un déclencheur et une alerte</h2>',
    '<p>Les modèles apportent leurs déclencheurs (disque, service, port). Un déclencheur maison, par '
    'exemple « la sauvegarde n’a pas tourné » : un script sur le serveur écrit l’horodatage de la '
    'dernière réussite dans un fichier ; un élément le lit ; un déclencheur alerte s’il est trop vieux.</p>',
    cmd('# élément (type agent) : vfs.file.time[/var/backups/derniere-ok,modify]   valeur = timestamp unix\n'
        '# déclencheur (expression) :\n'
        'now() - last(/srv-web01/vfs.file.time[/var/backups/derniere-ok,modify]) > 36h\n'
        '# gravité : Haute — nom : "Sauvegarde de {HOST.NAME} en retard (> 36 h)"'),
    steps(menu('Alertes › Types de média › Email') + ' : serveur SMTP, expéditeur, authentification. Tester avec le bouton « Test ».',
          menu('Utilisateurs › l’utilisateur (ou un groupe « Astreinte ») › Média') + ' : adresse mail, gravités reçues, plages horaires.',
          menu('Alertes › Actions › Actions de déclencheur › Créer') + ' : condition « gravité ≥ Haute », opération : envoyer aux « Astreinte » ; escalade : si non acquitté après 30 min, envoyer au responsable.',
          'Provoquer un problème (arrêter un service de test) et vérifier que le mail arrive. Sans ce test, l’alerte n’existe pas.'),

    '<h2>7) Exploiter Zabbix au quotidien</h2>',
    tab(['Besoin', 'Où'], [
        ['Ce qui ne va pas maintenant', menu('Surveillance › Problèmes') + ' — acquitter, commenter, fermer'],
        ['Une intervention prévue', menu('Collecte de données › Maintenance') + ' : période, hôtes, pas d’alertes'],
        ['Le tableau de bord de l’équipe', menu('Tableaux de bord') + ' : widgets problèmes, carte réseau, graphiques ; Grafana en plus si on veut du beau'],
        ['La carte du réseau', menu('Surveillance › Cartes') + ' : les hôtes, les liens, rouge quand ça tombe'],
        ['Les tendances', menu('Surveillance › Hôtes › Graphiques') + ' sur 30 j / 1 an ; la prédiction : fonction <code>forecast()</code> dans un déclencheur (« disque plein dans 7 jours »)'],
        ['Le serveur Zabbix lui-même', 'Le modèle « Zabbix server health » : file d’attente, cache, taille de la base — un Zabbix qui étouffe ne prévient personne'],
        ['Sauvegarder Zabbix', 'La base (<code>mysqldump zabbix</code>, voir <a href="/pages/sauvegarde-bases-donnees">bases de données</a>) + <code>/etc/zabbix</code>'],
    ]),
    note('yellow', '⚠️ La rétention',
         'Par défaut, Zabbix garde 31 jours d’historique brut et 365 jours de tendances par élément. '
         'Avec 200 hôtes et 100 éléments chacun, la base atteint des dizaines de Go : on ajuste '
         '(7 jours d’historique suffisent souvent), et on surveille le disque du serveur Zabbix… '
         'avec Zabbix.'),

    retenir('Zabbix = serveur + base + web + <strong>agents</strong> ; installation depuis le dépôt officiel, <strong>mot de passe Admin changé</strong>, HTTPS.',
            '<strong>Hôte + interface + modèle</strong> : « Linux by Zabbix agent », « Windows by Zabbix agent », « Cisco IOS by SNMP » ; la découverte crée les éléments.',
            'SNMP <strong>v3</strong> sur les équipements, restreint au serveur Zabbix.',
            'Déclencheur maison (sauvegarde en retard), média mail, action avec escalade — <strong>et un test provoqué</strong>.',
            'Quotidien : problèmes, maintenance déclarée, tableaux de bord, tendances et prévision ; superviser Zabbix lui-même et sauvegarder sa base.'),
])

# ═══════════════════════════════════════════════ Gérer les mises à jour ══

MAJ = '\n'.join([
    hero('Cours · Exploitation', 'Gérer les mises à jour',
         'Pas « faire les mises à jour » : les gérer. Un processus — inventaire, veille, test, fenêtre, '
         'déploiement, vérification, retour arrière — appliqué à Windows (WSUS, Intune), Linux, aux '
         'équipements réseau et aux applications.'),
    STYLE,
    '<p>Le RE 2026 est précis : « les mises à jour sont installées <strong>sans interruption de service '
    'non planifiée</strong> » et « les correctifs appliqués sont conformes aux préconisations du service '
    'informatique ». Autrement dit : ni le serveur qui redémarre à 14 h parce que Windows l’a décidé, '
    'ni le correctif critique qui attend trois mois. Entre les deux, un processus.</p>',

    '<h2>1) Pourquoi mettre à jour — et pourquoi pas tout de suite</h2>',
    tab(['Mettre à jour vite', 'Mettre à jour prudemment'], [
        ['Une vulnérabilité publiée est exploitée en quelques jours (parfois quelques heures pour les pare-feu et VPN exposés)', 'Une mise à jour peut casser : pilote, application métier, script, imprimante'],
        ['Les rançongiciels entrent par ce qui n’est pas à jour', 'Un serveur de production ne se redémarre pas n’importe quand'],
        ['Les éditeurs ne supportent que les versions à jour', 'Il faut pouvoir revenir en arrière'],
    ]),
    '<p>La réponse n’est pas un compromis mou, c’est une <strong>classification</strong> : le critique '
    'exposé passe en jours, le reste passe dans une fenêtre mensuelle, après test.</p>',

    '<h2>2) Le processus</h2>',
    steps('<strong>Inventaire</strong> : ce qu’on a (systèmes, versions, applications, firmwares), où, et ce qui est exposé à Internet. Sans inventaire, on ne sait pas ce qu’il faut mettre à jour. GLPI + agent, ou le rapport de la supervision.',
          '<strong>Veille</strong> : Patch Tuesday (2<sup>e</sup> mardi du mois), CERT-FR, bulletins des éditeurs de <em>ton</em> parc — voir <a href="/pages/organiser-sa-veille">Organiser sa veille</a>.',
          '<strong>Classification</strong> : critique (exploitée, exposée) → sous 72 h ; importante → fenêtre du mois ; le reste → cycle normal. La <a href="/pages/gestion-vulnerabilites">gestion des vulnérabilités</a> alimente cette étape.',
          '<strong>Test</strong> : un groupe pilote (les postes du service informatique, un serveur de préproduction, une VM restaurée depuis la sauvegarde) une semaine avant le reste.',
          '<strong>Fenêtre de maintenance</strong> : planifiée, <strong>annoncée</strong> aux utilisateurs (mail, bandeau), déclarée dans la <a href="/pages/supervision">supervision</a>. Le mardi 18 h–20 h ou le samedi matin, selon l’activité.',
          '<strong>Sauvegarde ou point de contrôle</strong> avant : instantané de VM (à supprimer après), export de configuration d’équipement.',
          '<strong>Déploiement</strong> par vagues : pilote → serveurs non critiques → serveurs critiques → postes. Jamais tous les DC en même temps. Jamais les deux hôtes du cluster en même temps.',
          '<strong>Vérification</strong> : le service répond (supervision verte), les utilisateurs pilotes confirment, le journal ne montre pas d’erreur nouvelle.',
          '<strong>Retour arrière</strong> si ça casse : désinstaller le correctif, restaurer l’instantané, remettre l’ancien firmware — la procédure est écrite <em>avant</em>.',
          '<strong>Compte rendu</strong> : ce qui a été appliqué, où, quand, les écarts ; l’inventaire mis à jour.'),
    note('red', '🚨 L’instantané de VM avant mise à jour',
         'C’est le filet de sécurité le plus simple — et le piège le plus courant : un instantané '
         'oublié sur un serveur de fichiers grossit jusqu’à remplir le stockage. On le supprime dans '
         'les 48 h une fois la mise à jour validée. Voir <a href="/pages/sauvegarde-vm-hyperv">Sauvegarder '
         'des VM</a>.'),

    '<h2>3) Windows : du poste au parc</h2>',
    tab(['Outil', 'Pour', 'Comment'], [
        ['<strong>Windows Update</strong> seul', 'Un poste isolé', 'Chaque poste télécharge chez Microsoft, redémarre quand il veut : ingérable au-delà de 5 machines'],
        ['<strong>GPO</strong> (sans WSUS)', 'Un petit domaine', menu('Configuration ordinateur › Modèles d’administration › Composants Windows › Windows Update') + ' : heures d’activité, notification avant redémarrage, report des mises à jour de fonctionnalités'],
        ['<strong>WSUS</strong>', 'Le domaine classique, serveurs et postes', 'Un rôle Windows Server : télécharge une fois, on <strong>approuve</strong> par groupe d’ordinateurs (Pilote, Serveurs, Postes), rapport de conformité. GPO : « Spécifier l’emplacement intranet du service de mise à jour » + « Autoriser le ciblage côté client »'],
        ['<strong>Intune</strong> (Windows Update for Business)', 'Postes joints à Entra, télétravail', 'Anneaux de déploiement (rings) : pilote 0 jour, large 7 jours, différé 14 jours ; échéances et délais de grâce'],
        ['<strong>SCCM / MECM</strong>', 'Les grands parcs', 'Tout, y compris les applications tierces et les images'],
    ]),
    cmd('# WSUS en PowerShell : approuver les critiques pour le groupe Pilote\n'
        '$wsus = Get-WsusServer\n'
        'Get-WsusUpdate -Classification Critical -Approval Unapproved | Approve-WsusUpdate -Action Install -TargetGroupName "Pilote"\n'
        '\n'
        '# sur un serveur : que manque-t-il, et installer pendant la fenêtre (module PSWindowsUpdate)\n'
        'Get-WindowsUpdate\n'
        'Install-WindowsUpdate -AcceptAll -AutoReboot:$false      # redémarrage maîtrisé ensuite\n'
        'Get-HotFix | Sort InstalledOn -Descending | Select -First 5'),
    bullets('Les <strong>serveurs</strong> ne redémarrent jamais automatiquement : GPO « Pas de redémarrage automatique avec des utilisateurs connectés » + redémarrage manuel dans la fenêtre, un DC après l’autre.',
            'Les <strong>mises à jour de fonctionnalités</strong> (23H2 → 24H2) sont un projet, pas un patch : test d’application, image, communication.',
            'Les <strong>applications tierces</strong> (navigateurs, PDF, Java, 7-Zip…) sont la moitié des vulnérabilités du poste : winget en script, ou un outil (PatchMyPC, Ninite Pro, l’agent RMM).',
            'Les <strong>pilotes et firmwares</strong> des serveurs (Dell, HPE) : via l’outil constructeur, dans la fenêtre, après sauvegarde.'),

    '<h2>4) Linux : apt, dnf, et le redémarrage qui reste nécessaire</h2>',
    cmd('# Debian / Ubuntu\n'
        'apt update && apt list --upgradable\n'
        'apt -s upgrade                                 # simulation : ce qui serait fait\n'
        'apt upgrade -y && apt autoremove -y\n'
        '[ -f /var/run/reboot-required ] && cat /var/run/reboot-required   # noyau ou libc : redémarrer\n'
        'needrestart                                    # quels services tournent encore sur d’anciennes bibliothèques\n'
        '\n'
        '# Rocky / RHEL\n'
        'dnf check-update ; dnf upgrade -y ; needs-restarting -r\n'
        '\n'
        '# mises à jour de sécurité automatiques (Debian) — pour les postes et serveurs non critiques\n'
        'apt install unattended-upgrades && dpkg-reconfigure -plow unattended-upgrades\n'
        '# /etc/apt/apt.conf.d/50unattended-upgrades : Origins-Pattern "origin=Debian,codename=${distro_codename},label=Debian-Security"\n'
        '#   Unattended-Upgrade::Automatic-Reboot "false";   (serveurs : on redémarre dans la fenêtre)'),
    bullets('Sécurité automatique <strong>oui</strong> sur les serveurs non critiques et les postes ; sur un serveur critique, on préfère appliquer dans la fenêtre — mais jamais « pas du tout ».',
            'Une mise à jour de noyau ou de glibc n’est effective qu’après <strong>redémarrage</strong> ; <code>needrestart</code> le dit, la supervision peut surveiller <code>/var/run/reboot-required</code>.',
            'Les <strong>versions majeures</strong> (Debian 12 → 13) : lecture des notes de version, sauvegarde complète, <code>apt full-upgrade</code>, sur une VM de test d’abord.',
            'En parc : <strong>Ansible</strong> (un playbook <code>apt: upgrade=dist</code> sur un groupe d’hôtes) ou un simple script SSH en boucle — voir <a href="/pages/linux-bash">Scripts Bash</a>.'),

    '<h2>5) Équipements réseau et hyperviseurs</h2>',
    tab(['Équipement', 'Particularité', 'Méthode'], [
        ['Pare-feu (OPNsense, Fortinet…)', '<strong>Exposé sur Internet</strong> : priorité absolue sur les correctifs de sécurité ; le redémarrage coupe tout', 'Sauvegarde de configuration, fenêtre, ' + menu('Système › Firmware') + ' ; en cluster CARP, un nœud après l’autre'],
        ['Commutateurs, points d’accès', 'Redémarrage = coupure du segment ; firmware par image', 'Lire les notes de version (une régression VLAN existe), image copiée (TFTP / SCP), fenêtre, un équipement témoin d’abord'],
        ['Hyperviseurs (Hyper-V, Proxmox)', 'Redémarrer l’hôte = redémarrer les VM… sauf si on migre', 'Migration à chaud des VM vers l’autre hôte, mise à jour, redémarrage, retour — sans interruption ; voir <a href="/pages/proxmox-multi-hotes">Proxmox</a>'],
        ['Cartes de gestion (iDRAC, iLO), onduleurs, NAS', 'Souvent oubliés, souvent vulnérables', 'Dans l’inventaire, dans le cycle trimestriel'],
    ]),

    '<h2>6) Mesurer : la conformité</h2>',
    bullets('Un <strong>tableau de conformité</strong> mensuel : % de machines à jour à J+14 après le Patch Tuesday, par groupe ; les retardataires nommés.',
            'Les sources : le rapport WSUS / Intune, la supervision (élément « mises à jour en attente », « redémarrage requis »), un scan de vulnérabilités.',
            'Un objectif écrit dans les préconisations du service : « critiques sous 72 h, autres sous 30 jours, postes conformes à 95 % ». C’est ce que le RE appelle « conformes aux préconisations ».'),

    retenir('Gérer les mises à jour = un <strong>processus</strong> : inventaire, veille, classification, test, fenêtre annoncée, sauvegarde, vagues, vérification, retour arrière, compte rendu.',
            'Critique exposé sous 72 h ; le reste dans la fenêtre mensuelle après un groupe pilote ; <strong>jamais de redémarrage non planifié</strong> sur un serveur.',
            'Windows : GPO au minimum, <strong>WSUS</strong> pour approuver par groupe, Intune pour les postes cloud ; les applications tierces aussi.',
            'Linux : <code>apt -s</code> puis <code>apt upgrade</code>, <strong>needrestart</strong>, unattended-upgrades sécurité sur le non-critique.',
            'Pare-feu et hyperviseurs ont leurs règles (priorité, migration des VM) ; mesurer la conformité chaque mois.'),
])

# ═══════════════════════════════════════════ Gestion des vulnérabilités ══

VULN = '\n'.join([
    hero('Cours · Sécurité', 'Gestion des vulnérabilités',
         'CVE, CVSS et EPSS pour lire un bulletin ; un scan du parc avec OpenVAS ou Nessus ; '
         'prioriser ce qui compte vraiment ; corriger, atténuer ou accepter — et le prouver.'),
    STYLE,
    note('gray', '📚 Avant ce cours',
         '<a href="/pages/gerer-mises-a-jour">Gérer les mises à jour</a> — la gestion des vulnérabilités '
         'décide <em>quoi</em> corriger en priorité ; les mises à jour sont le <em>comment</em>.'),
    '<p>Chaque semaine, des centaines de vulnérabilités sont publiées. Un technicien ne peut pas '
    'toutes les traiter ; il doit savoir <strong>lesquelles concernent son parc</strong>, lesquelles sont '
    '<strong>réellement exploitées</strong>, et <strong>lesquelles sont exposées</strong>. La gestion des '
    'vulnérabilités est ce tri, en boucle : découvrir, évaluer, prioriser, traiter, vérifier.</p>',

    '<h2>1) Lire une vulnérabilité</h2>',
    tab(['Sigle', 'C’est…', 'Comment on s’en sert'], [
        ['<strong>CVE</strong>', 'L’identifiant unique d’une vulnérabilité : <code>CVE-2026-12345</code>. Base MITRE / NVD', 'Le nom qu’on cherche dans les bulletins, les scanners, les notes de version'],
        ['<strong>CVSS</strong>', 'Un score de gravité <em>théorique</em> de 0 à 10 : vecteur d’attaque (réseau / local), complexité, privilèges requis, interaction utilisateur, impact', '≥ 9 critique, 7–8,9 haute, 4–6,9 moyenne. Un 9,8 sur un service non exposé pèse moins qu’un 7,5 sur le VPN'],
        ['<strong>EPSS</strong>', 'La probabilité (0–1) que la vulnérabilité soit exploitée dans les 30 jours, calculée sur l’activité observée', 'Le complément du CVSS : un 9,8 avec EPSS 0,01 attend ; un 7,2 avec EPSS 0,9 passe devant'],
        ['<strong>KEV</strong> (CISA)', 'La liste des vulnérabilités <strong>exploitées activement</strong>', 'Si c’est dans la KEV et dans ton parc, c’est pour cette semaine'],
        ['<strong>CWE</strong>', 'La famille de faiblesse (injection, débordement…)', 'Pour les développeurs surtout'],
        ['<strong>Bulletin CERT-FR</strong>', 'L’avis français : produits, versions, correctif, contournement', 'La source à citer ; abonnement dans la <a href="/pages/organiser-sa-veille">veille</a>'],
    ]),
    cmd('CVE-2026-31337 — OPNsense < 26.7.3 : contournement d’authentification de l’interface web\n'
        'CVSS 3.1 : 9.8 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H)   EPSS : 0.62   KEV : oui\n'
        '→ concerné (26.7.1 en production), interface web accessible depuis le LAN d’administration seulement.\n'
        '→ traitement : mise à jour sous 48 h ; en attendant, vérifier que l’interface n’est pas exposée sur le WAN.'),

    '<h2>2) Découvrir : le scan de vulnérabilités</h2>',
    tab(['Outil', 'Profil', 'Remarque'], [
        ['<strong>OpenVAS / Greenbone</strong>', 'Libre ; scan réseau authentifié ou non ; rapports par hôte', 'La référence libre ; en conteneur ou VM dédiée'],
        ['<strong>Nessus</strong>', 'Commercial (Essentials gratuit jusqu’à 16 IP) ; très complet', 'Le standard des auditeurs'],
        ['<strong>nmap</strong> + scripts', 'Découverte de ports et de versions ; <code>--script vuln</code> pour les tests basiques', 'Pas un scanner de vulnérabilités, mais le premier regard : <a href="/pages/diagnostic-reseau">Diagnostic réseau</a>'],
        ['<strong>Microsoft Defender Vulnerability Management</strong>, Intune', 'Sans scan réseau : l’agent remonte les logiciels et leurs CVE', 'Postes Windows gérés'],
        ['<strong>Wazuh</strong>', 'Agent + base de CVE : détection de vulnérabilités sur Linux et Windows', 'Si Wazuh est déjà là pour les journaux'],
        ['<strong>Lynis</strong>, <strong>debsecan</strong>', 'Audit local d’un serveur Linux', 'Rapide, sans infrastructure'],
    ]),
    steps('Un scan <strong>non authentifié</strong> depuis le réseau : ce qu’un attaquant interne verrait — ports, services, versions, faiblesses de configuration.',
          'Un scan <strong>authentifié</strong> (compte de lecture sur les hôtes, SSH ou WMI) : les paquets installés, les correctifs manquants, les configurations locales — bien plus précis.',
          'Un scan <strong>externe</strong> de la plage publique : ce qu’Internet voit — pare-feu, VPN, serveur web, DMZ. Voir <a href="/pages/dmz-surveillance-entretien">scan d’exposition</a>.',
          'Planifier : externe chaque semaine, interne chaque mois, à chaque nouveau serveur.'),
    note('yellow', '⚠️ Un scan est une action offensive sur le réseau',
         'Autorisation écrite du responsable, fenêtre annoncée (un scan peut faire tomber un vieil '
         'équipement ou une imprimante), et jamais depuis un poste quelconque : le scanner a sa propre '
         'machine, connue de la supervision et du pare-feu. Scanner ce qui n’est pas à soi est illégal.'),

    '<h2>3) Prioriser : le triangle gravité × exploitation × exposition</h2>',
    tab(['Question', 'Source', 'Poids'], [
        ['Quelle gravité ?', 'CVSS', 'Nécessaire, pas suffisant'],
        ['Est-ce exploité, ou probable ?', 'KEV, EPSS, bulletin CERT-FR', 'Décisif'],
        ['Est-ce <strong>exposé</strong> ? Sur Internet, sur un VLAN ouvert, sur un poste qui lit ses mails ?', 'Inventaire, schéma réseau, règles de pare-feu', 'Décisif'],
        ['Qu’est-ce que ça protège ?', 'BIA (<a href="/pages/pra-pca">PRA / PCA</a>) : le DC, la base de paie, le pare-feu', 'Multiplie le reste'],
        ['Existe-t-il un correctif ? un contournement ?', 'Éditeur', 'Décide du traitement'],
    ]),
    tab(['Niveau', 'Critères', 'Délai (préconisation type)'], [
        ['<strong>P1 — urgent</strong>', 'KEV ou EPSS élevé, exposé sur Internet ou sur un actif critique', '72 h ; contournement immédiat si pas de correctif'],
        ['<strong>P2 — prioritaire</strong>', 'CVSS ≥ 7 sur le réseau interne, ou exploitation possible avec un compte utilisateur', 'Fenêtre du mois'],
        ['<strong>P3 — normal</strong>', 'Le reste, corrigé par le cycle de mises à jour', '90 jours'],
        ['<strong>Accepté</strong>', 'Pas de correctif, atténué, ou risque jugé négligeable — décision <strong>écrite</strong> du responsable', 'Revue à chaque scan'],
    ]),

    '<h2>4) Traiter : corriger, atténuer, accepter</h2>',
    tab(['Traitement', 'Exemples'], [
        ['<strong>Corriger</strong>', 'Mettre à jour, changer la version, remplacer le produit en fin de vie (un Windows Server 2012 ou un commutateur sans firmware n’a <em>pas</em> de correctif : c’est le remplacement qu’on planifie)'],
        ['<strong>Atténuer</strong>', 'Fermer le port au pare-feu, restreindre à un VLAN d’administration, désactiver la fonction vulnérable (SMBv1, un plugin), exiger la MFA, segmenter — en attendant le correctif ou à sa place'],
        ['<strong>Accepter</strong>', 'La machine d’automate industriel isolée qu’on ne peut pas patcher : isolation réseau documentée, décision signée, date de revue'],
        ['<strong>Transférer</strong>', 'Le service SaaS : c’est le fournisseur qui corrige ; on vérifie qu’il le fait (bulletins, contrat)'],
    ]),
    '<p>Chaque vulnérabilité P1 / P2 a un <strong>ticket</strong> : CVE, actifs concernés, traitement, '
    'responsable, échéance. C’est la trace que le RE demande et que l’auditeur cherche.</p>',

    '<h2>5) Vérifier et mesurer</h2>',
    bullets('<strong>Rescanner</strong> après correction : la vulnérabilité a disparu du rapport, ou elle est toujours là (mise à jour non appliquée, service non redémarré, seconde instance oubliée).',
            'Des <strong>indicateurs</strong> mensuels : nombre de vulnérabilités critiques ouvertes, âge moyen, délai moyen de correction par niveau, % d’actifs scannés.',
            'Le <strong>rapport</strong> au responsable : ce qui a été traité, ce qui est accepté, ce qui bloque (un logiciel métier qui impose une vieille version de Java, par exemple).'),

    '<h2>6) Les configurations aussi</h2>',
    '<p>Une part des « vulnérabilités » n’est pas un bug mais une <strong>mauvaise configuration</strong> : '
    'SMBv1 actif, un partage en écriture pour tous, SNMP « public », un compte administrateur '
    'local commun, RDP ouvert sur Internet, un certificat auto-signé sur le VPN. Les guides de '
    'durcissement (ANSSI, CIS Benchmarks) les listent ; les scanners authentifiés les détectent. '
    'Voir <a href="/pages/procedure-securite-poste">Sécuriser un poste / serveur Windows</a> et '
    '<a href="/pages/zero-trust-iam">Zero trust, PSSI et IAM</a>.</p>',

    retenir('<strong>CVE</strong> identifie, <strong>CVSS</strong> mesure la gravité théorique, <strong>EPSS / KEV</strong> disent si c’est exploité : les trois ensemble, plus l’<strong>exposition</strong>, décident.',
            'Découvrir par <strong>scan</strong> (OpenVAS, Nessus) : non authentifié, authentifié, externe — avec autorisation et fenêtre.',
            'P1 sous 72 h (exploité + exposé), P2 dans le mois, P3 dans le cycle, <strong>accepté par écrit</strong> sinon.',
            'Traiter = corriger, <strong>atténuer</strong> (pare-feu, segmentation, désactivation), accepter, transférer ; un ticket par P1 / P2.',
            '<strong>Rescanner</strong> pour prouver ; des indicateurs mensuels ; les mauvaises configurations comptent autant que les correctifs.'),
])

PAGES = [
    ('supervision', 'La supervision (monitoring)',
     'Ce qu’on surveille, états et seuils, sondes actives / agents / SNMP v3 / journaux / IPMI, alertes avec escalade et dépendances, tendances, outils, périmètre d’une PME, de l’alerte à l’incident.',
     SUPERVISION, SG,
     'Ce qu’on surveille et comment, états et seuils, SNMP et agents, alerter sans bruit, tendances, outils, le périmètre d’une PME.'),
    ('installer-zabbix', 'Installer Zabbix et superviser un premier parc',
     'Serveur Zabbix sur Debian, agent Linux et Windows, commutateur en SNMP v3, modèles, déclencheur maison (sauvegarde en retard), alerte mail avec escalade, exploitation.',
     ZABBIX, SG,
     'Installer le serveur, un agent Linux, un agent Windows, un commutateur SNMP v3, un déclencheur et une alerte mail, le quotidien.'),
    ('gerer-mises-a-jour', 'Gérer les mises à jour',
     'Le processus (inventaire, veille, classification, test, fenêtre, vagues, vérification, retour arrière), Windows (GPO, WSUS, Intune), Linux (apt, needrestart, unattended-upgrades), équipements réseau et hyperviseurs, conformité.',
     MAJ, SG,
     'Un processus en dix étapes ; WSUS / Intune ; apt et needrestart ; pare-feu et hyperviseurs ; mesurer la conformité.'),
    ('gestion-vulnerabilites', 'Gestion des vulnérabilités',
     'CVE, CVSS, EPSS, KEV ; scans OpenVAS / Nessus (non authentifié, authentifié, externe) ; priorisation gravité × exploitation × exposition ; corriger, atténuer, accepter ; rescanner et mesurer.',
     VULN, SG,
     'Lire une CVE (CVSS, EPSS, KEV), scanner le parc, prioriser par exposition, traiter, prouver.'),
]

LOTS = [(PAGES, MAINT, ('supervision',))]

if __name__ == '__main__':
    for lot in LOTS:
        publier_lot(*lot)
    sys.exit(0)

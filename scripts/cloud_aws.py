# -*- coding: utf-8 -*-
"""
TP Cloud AWS 2026 → trois pages :
  1. COURS  « Le cloud AWS : services, modèles et responsabilités » (cat-cloud)
  2. PROCÉDURE « Déployer une infra web sur AWS (VPC, EC2, RDS, CloudWatch) » (sec-projet)
  3. CORRECTION « Correction du TP Cloud AWS » (sec-correction), avec les réponses.

Source : docx « TP_Cloud_AWS_2026 » (concepts cloud, IaaS/PaaS/SaaS, services AWS
essentiels, On-Prem vs Cloud, responsabilité partagée, puis TP EC2/VPC/RDS/CloudWatch).

IDEMPOTENT.
"""
import re
import sqlite3
import sys

from _cours import (BASE, Categorie, STYLE, acc, bullets, hero, note, publier,
                    publier_lot, retenir, tab)

CLOUD = Categorie('cat-cloud', '☁️', 'Cloud &amp; identité hybride',
                  'Entra ID, MFA, zero trust, PKI, premiers pas dans le cloud et dans un datacenter.', '#0284c7')

# ═══════════════════════════════════════════════ 1) LE COURS ═══════════════════

COURS = '\n'.join([
    hero('Cours · Cloud · AWS', 'Le cloud AWS : services, modèles et responsabilités',
         'Après les concepts (IaaS/PaaS/SaaS, public/privé), le concret côté Amazon Web Services : '
         'les briques essentielles (VPC, EC2, S3, RDS, élasticité, IAM), ce qui change face à l’On-Prem, '
         'et la règle d’or de la responsabilité partagée.'),
    STYLE,

    note('blue', '🎯 Le cloud en une phrase',
         'Le <strong>cloud computing</strong>, c’est louer des ressources informatiques '
         '<strong>à la demande</strong> via Internet, <strong>facturées à l’usage</strong> — au lieu '
         'd’acheter et d’exploiter ses propres serveurs. Les concepts de fond (modèles de service et de '
         'déploiement, souveraineté) sont dans <a href="/pages/cloud-premiers-pas">Le cloud : premiers '
         'pas</a> ; cette page se concentre sur <strong>AWS</strong> et sa mise en pratique.'),

    '<h2>Public, privé, hybride</h2>',
    tab(['Modèle', 'Ce que c’est', 'Pour qui'], [
        ['<strong>Cloud public</strong>', 'Ressources d’un fournisseur (AWS, Azure, GCP) mutualisées '
         'entre de nombreux clients, exécutées hors site.', 'Démarrer vite, payer à l’usage, absorber '
         'des pics — sans matériel à acheter.'],
        ['<strong>Cloud privé</strong>', 'Environnement dédié à <em>un seul</em> client, accès isolé — '
         'sur site <em>ou</em> chez un hébergeur.', 'Contrôle et conformité fortes (données sensibles).'],
        ['<strong>Cloud hybride</strong>', 'Combinaison des deux, reliés.', 'Garder le sensible en privé, '
         'externaliser le reste — voir <a href="/pages/cloud-premiers-pas">premiers pas</a>.'],
    ]),

    '<h2>Les trois modèles de service : IaaS, PaaS, SaaS</h2>',
    tab(['Modèle', 'Le fournisseur gère', 'Vous gérez', 'Exemple AWS'], [
        ['<strong>IaaS</strong> (infrastructure)', 'Matériel, réseau, virtualisation, stockage',
         'OS, mises à jour, applications, données', 'Amazon <strong>EC2</strong>'],
        ['<strong>PaaS</strong> (plateforme)', 'Matériel + plateforme (OS, moteur)',
         'L’application et ses données', 'Amazon <strong>RDS</strong>, Elastic Beanstalk'],
        ['<strong>SaaS</strong> (logiciel)', 'Tout — vous utilisez l’appli via un navigateur',
         'Vos données et vos réglages', 'Gmail, Microsoft 365, Salesforce'],
    ]),
    note('gray', '📐 La règle mnémotechnique',
         'Plus on va vers le <strong>SaaS</strong>, moins on gère — mais moins on maîtrise. Plus on '
         'reste en <strong>IaaS</strong>, plus on est libre — mais plus on est responsable (patchs, '
         'sauvegardes, sécurité de l’OS).'),

    '<h2>Les services AWS essentiels</h2>',
    acc(
        ('🌐 Amazon VPC — le réseau',
         'Un <strong>réseau privé virtuel</strong> dans le cloud : on y définit ses sous-réseaux, ses '
         'plages d’adresses, ses tables de routage, sa passerelle Internet. C’est l’équivalent du réseau '
         'd’entreprise, mais chez AWS — il <strong>isole</strong> vos ressources des autres clients.'),
        ('🖥️ Amazon EC2 — le calcul',
         'Des <strong>serveurs virtuels</strong> loués et démarrés à la demande (une <em>instance</em>). '
         'C’est de l’<strong>IaaS</strong> : AWS fournit le « fer », vous choisissez l’OS et vous en êtes '
         'responsable. On dimensionne le type d’instance selon le besoin (et le budget).'),
        ('🪣 Amazon S3 — le stockage objet',
         'Un stockage en ligne pour <strong>conserver des fichiers</strong> (objets) accessibles de '
         'partout, sans gérer de serveur : sauvegardes, sites statiques, archives, dépôts d’images.'),
        ('🗄️ Amazon RDS — la base de données managée',
         'Une <strong>base de données gérée</strong> (MySQL, PostgreSQL, MariaDB…) : AWS s’occupe de '
         'l’installation, des correctifs, des sauvegardes, de la haute dispo. C’est du <strong>PaaS</strong> '
         '— vous n’administrez que la base, pas le serveur.'),
        ('⚖️ Elastic Load Balancing &amp; Auto Scaling — l’élasticité',
         'L’<strong>ELB</strong> répartit la charge entre plusieurs instances (pas d’interruption si l’une '
         'tombe) ; l’<strong>Auto Scaling</strong> ajoute ou retire des instances <em>automatiquement</em> '
         'selon la charge. C’est le grand atout du cloud : la capacité suit la demande.'),
        ('🔐 AWS IAM — la sécurité des accès',
         'La <strong>gestion des identités et des droits</strong> : utilisateurs, groupes, rôles et '
         'politiques (qui a le droit de faire quoi, sur quelle ressource). Principe de base : le '
         '<strong>moindre privilège</strong>.'),
    ),

    '<h2>On-Premise vs Cloud</h2>',
    tab(['Critère', 'On-Premise', 'Cloud'], [
        ['Matériel', 'Achat des serveurs', 'Location de ressources à la demande'],
        ['Maintenance', 'Assurée en interne', 'Assurée par le fournisseur'],
        ['Capacité', 'Fixe, peu scalable', 'Scalable à la demande, en un clic'],
        ['Coût', '<strong>Investissement initial (CAPEX)</strong>', '<strong>Paiement à l’usage (OPEX)</strong>'],
        ['Données', 'Hébergées en interne', 'Hébergées chez un fournisseur tiers'],
    ]),
    note('gray', '⚖️ Ni l’un ni l’autre par principe',
         'Les deux ont des avantages et des limites : le choix dépend des <strong>besoins</strong> '
         '(pics de charge ? projet court ?), des <strong>contraintes</strong> (budget, conformité, '
         'souveraineté des données) et de la <strong>maîtrise</strong> voulue.'),

    '<h2>La responsabilité partagée</h2>',
    note('yellow', '🛡️ La règle d’or',
         'AWS sécurise <strong>l’infrastructure</strong> (« sécurité <em>DU</em> cloud »), mais '
         '<strong>vous</strong> sécurisez <strong>ce que vous mettez dedans</strong> (« sécurité '
         '<em>DANS</em> le cloud »). Où passe la frontière ? <strong>Ça dépend du modèle de service.</strong>'),
    tab(['Situation', 'Qui corrige ?'], [
        ['<strong>PaaS</strong> (RDS) : faille dans le Linux géré par AWS sous la base', '<strong>AWS</strong> patche'],
        ['<strong>PaaS</strong> : injection SQL dans <em>votre</em> code PHP', '<strong>Vous</strong>'],
        ['<strong>IaaS</strong> (EC2) : vous installez Linux et oubliez les mises à jour', '<strong>Vous</strong> — AWS ne fournit que le « fer »'],
        ['Panne d’un datacenter, d’un disque physique', '<strong>AWS</strong>'],
    ]),
    note('blue', '🔎 À comprendre absolument',
         'Déléguer une partie du SI à un tiers ne délègue pas la <strong>vigilance</strong> : les données '
         'manipulées, les services exposés, les droits IAM et les mises à jour de <em>vos</em> instances '
         'restent votre responsabilité. C’est le cœur de la sécurité dans le cloud.'),

    retenir(
        'Le cloud = ressources <strong>à la demande</strong>, facturées à l’usage (OPEX) ; l’On-Prem = '
        'achat et exploitation (CAPEX).',
        '<strong>IaaS</strong> (EC2) : vous gérez l’OS ; <strong>PaaS</strong> (RDS) : vous gérez l’appli/base ; '
        '<strong>SaaS</strong> : vous n’utilisez que le logiciel.',
        'Les briques AWS : <strong>VPC</strong> (réseau), <strong>EC2</strong> (calcul), <strong>S3</strong> '
        '(stockage objet), <strong>RDS</strong> (base managée), <strong>ELB/Auto Scaling</strong> (élasticité), '
        '<strong>IAM</strong> (accès).',
        '<strong>Responsabilité partagée</strong> : AWS sécurise le cloud, vous sécurisez ce que vous y mettez.',
    ),
    note('green', '➡️ Pour aller plus loin',
         '<a href="/pages/cloud-premiers-pas">Le cloud : premiers pas</a> · '
         '<a href="/pages/procedure-cloud-aws">Procédure : déployer une infra web sur AWS</a> · '
         '<a href="/pages/correction-cloud-aws">Correction du TP Cloud AWS</a>.'),
])

EXTRAIT_COURS = ('Le cloud côté AWS : public/privé/hybride, IaaS/PaaS/SaaS, les services essentiels '
                 '(VPC, EC2, S3, RDS, ELB/Auto Scaling, IAM), On-Prem vs Cloud (CAPEX/OPEX, scalabilité) '
                 'et la responsabilité partagée (sécurité DU cloud vs DANS le cloud).')
DESC_COURS = ('Modèles public/privé, IaaS/PaaS/SaaS, les briques AWS (VPC, EC2, S3, RDS, élasticité, IAM), '
              'On-Prem vs Cloud et la responsabilité partagée.')

PAGES_COURS = [('cloud-aws', 'Le cloud AWS : services, modèles et responsabilités',
                EXTRAIT_COURS, COURS, 'Cloud &amp; datacenter', DESC_COURS)]

# ═══════════════════════════════════ 2 & 3) PROCÉDURE + CORRECTION ═════════════

PSTYLE = ('<style>'
          ".proc-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);"
          "border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;"
          "white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}"
          ".step-banner{display:flex;align-items:center;gap:14px;margin:32px 0 12px;padding:13px 16px;"
          "border:1px solid var(--border);border-left-width:6px;border-radius:12px;background:var(--surface-2)}"
          ".step-banner .step-num{flex:0 0 auto;width:36px;height:36px;border-radius:10px;display:grid;"
          "place-items:center;font-weight:700;color:#fff;font-size:16px;line-height:1}"
          ".step-banner .step-tt{display:flex;flex-direction:column;gap:2px;min-width:0}"
          ".step-banner h3{margin:0;font-size:17px;line-height:1.25}"
          ".step-banner .step-sub{font-size:12.5px;color:var(--text-muted);font-weight:400}"
          ".step-rail{border-left:4px solid var(--border);padding:2px 0 2px 16px;margin:0 0 10px 4px}"
          ".step-rail>*:first-child{margin-top:6px}"
          ".rt{border-collapse:collapse;width:100%;margin:8px 0;font-size:12.5px}"
          ".rt td,.rt th{border:1px solid var(--border);padding:6px 9px;text-align:left;vertical-align:top}"
          ".rt th{background:var(--surface-2);color:var(--text-muted)}"
          ".lx-nav{font-family:ui-monospace,monospace;font-size:12px;font-weight:600;"
          "background:var(--surface-3);border:1px solid var(--border);border-radius:6px;padding:1px 7px}"
          "</style>")


def cmd(t): return f'<div class="proc-cmd">{t}</div>'
def nav(t): return f'<span class="lx-nav">{t}</span>'
def note2(c, t, *p): return (f'<aside class="pb-note pb-note-{c}"><p class="pb-note-title">{t}</p>'
                             + ''.join(f'<p>{x}</p>' for x in p) + '</aside>')
def tab2(h, l):
    th = ''.join(f'<th>{x}</th>' for x in h)
    tr = ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in r) + '</tr>' for r in l)
    return f'<table class="rt"><tr>{th}</tr>{tr}</table>'
def etape(n, c, t, s, corps):
    return (f'<div class="step-banner" style="border-left-color:{c}">'
            f'<span class="step-num" style="background:{c}">{n}</span>'
            f'<span class="step-tt"><h3>{t}</h3><span class="step-sub">{s}</span></span></div>'
            f'<div class="step-rail" style="border-left-color:{c}">{corps}</div>')
def qa(q, a):
    return (f'<aside class="pb-note pb-note-blue"><p class="pb-note-title">❓ {q}</p><p>{a}</p></aside>')


BLEU, VERT, AMBRE, VIOLET, ROUGE, TEAL = '#3b82f6', '#16a34a', '#d97706', '#7c3aed', '#dc2626', '#0d9488'

# ── la procédure ───────────────────────────────────────────────────────────────

PROC = '\n'.join([
    '<section class="hero"><span class="pill">Procédure · Cloud · AWS</span>'
    '<h1>Déployer une infra web sur AWS (VPC, EC2, RDS, CloudWatch)</h1>'
    '<p>Migrer un serveur web d’une infra On-Premise vieillissante vers un cloud public AWS : '
    'réseau (VPC), serveur (EC2 public), base (EC2/RDS privé), supervision (CloudWatch), puis image '
    'de résilience (AMI) et nettoyage. Pas à pas, en gardant un œil sur le budget du LAB.</p>'
    '</section>',
    PSTYLE,
    note2('yellow', '💸 Budget d’abord',
          'Le LAB a un <strong>budget limité</strong> : ne surdimensionne pas les instances (un type '
          '<span class="lx-nav">t3.micro</span>/<span class="lx-nav">t2.micro</span> suffit), n’allume '
          'que ce qui sert, et <strong>supprime tout à la fin</strong> (étape 7). La théorie : '
          '<a href="/pages/cloud-aws">Le cloud AWS</a>.'),

    etape(1, TEAL, 'Préparer l’On-Premise', 'La VM Debian 13 qu’on va migrer',
          '<ol style="margin:0;padding-left:18px;line-height:1.7">'
          '<li>Déployer une <strong>VM Debian 13</strong> sur Hyper-V.</li>'
          '<li>Installer <strong>Apache</strong> ou <strong>nginx</strong> et créer un '
          '<span class="lx-nav">index.html</span> personnalisé '
          '(<a href="/pages/procedure-apache-linux">rappel Apache</a>).</li>'
          '<li><strong>Valider l’accès local</strong> avant de migrer : le site répond sur le LAN.</li>'
          '</ol>'
          + note2('gray', '🎯 Pourquoi valider avant',
                  'On migre quelque chose qui <em>marche déjà</em> : si le site casse après migration, '
                  'on saura que le problème vient du cloud (réseau, droits), pas de l’application.')),

    etape(2, BLEU, 'Fondations : le VPC et ses sous-réseaux', 'VPC ▸ Create VPC',
          '<p>Connecte-toi à <strong>AWS Academy</strong>, puis crée le réseau :</p>'
          + tab2(['Élément', 'Valeur'],
                 [['VPC', '<strong>VPC_LAB_01</strong> — <span class="lx-nav">10.0.0.0/16</span>'],
                  ['Subnet public', '<span class="lx-nav">10.0.1.0/24</span> — serveur web exposé'],
                  ['Subnet privé', '<span class="lx-nav">10.0.2.0/24</span> — base de données'],
                  ['Internet Gateway', 'créer + <strong>attacher</strong> au VPC'],
                  ['Table de routage (public)', 'route <span class="lx-nav">0.0.0.0/0</span> → l’Internet Gateway']])
          + note2('amber', '🧭 La route par défaut, sinon rien ne sort',
                  'Le subnet « public » ne l’est vraiment que si sa <strong>table de routage</strong> '
                  'envoie <span class="lx-nav">0.0.0.0/0</span> vers l’<strong>Internet Gateway</strong>. '
                  'Sans cette route, l’instance a beau avoir une IP publique, elle reste injoignable.')),

    etape(3, VIOLET, 'L’instance web (EC2 public) et son Security Group',
          'EC2 ▸ Launch instance',
          '<ol style="margin:0;padding-left:18px;line-height:1.7">'
          '<li>Lancer une <strong>instance EC2 Debian 13</strong>, rattachée à '
          '<strong>VPC_LAB_01</strong> et au <strong>subnet public</strong>, avec '
          '<strong>Auto-assign Public IP = Enable</strong>.</li>'
          '<li>Créer un <strong>Security Group dédié</strong> (pas le défaut) autorisant en '
          '<strong>entrée</strong>, source = <strong>l’IP publique de l’ADRAR</strong> :'
          '<ul><li><span class="lx-nav">SSH 22</span>, <span class="lx-nav">HTTP 80</span> / '
          '<span class="lx-nav">HTTPS 443</span></li></ul></li>'
          '<li>Télécharger la <strong>clé privée</strong> (.pem) proposée par AWS.</li></ol>'
          + note2('amber', '🔑 Le bon utilisateur : admin, pas ec2-user',
                  'Sur une AMI Debian, on se connecte avec l’utilisateur <strong>admin</strong> (et non '
                  '<em>ec2-user</em> qui est celui d’Amazon Linux).')),

    etape(4, VERT, 'Se connecter et migrer le site', 'SSH + scp',
          cmd('chmod 400 cle-lab.pem\n'
              'ssh -i cle-lab.pem admin@&lt;IP_PUBLIQUE_EC2&gt;\n\n'
              '# Migrer le site depuis l’On-Prem (ou ton poste) vers l’instance :\n'
              'scp -i cle-lab.pem -r ./site/* admin@&lt;IP_PUBLIQUE_EC2&gt;:/tmp/site/\n'
              '# puis, sur l’instance : sudo cp -r /tmp/site/* /var/www/html/')
          + note2('gray', '📋 Ou copier-coller le code',
                  'Pour une page simple, recréer le <span class="lx-nav">index.html</span> à la main sur '
                  'l’instance suffit. Vérifie ensuite <span class="lx-nav">http://&lt;IP publique&gt;/</span> '
                  'depuis un navigateur.')),

    etape(5, AMBRE, 'La base de données (EC2 privé) et le flux web → base',
          'Instance sans IP publique, joignable seulement en interne',
          '<ol style="margin:0;padding-left:18px;line-height:1.7">'
          '<li>Lancer une <strong>instance EC2 MySQL</strong> (MariaDB/MySQL) rattachée à '
          '<strong>VPC_LAB_01</strong> et au <strong>subnet privé</strong>, <strong>sans IP '
          'publique</strong> — joignable uniquement sur <span class="lx-nav">10.0.2.0/24</span>.</li>'
          '<li>Créer un <strong>2ᵉ Security Group</strong> autorisant '
          '<span class="lx-nav">MySQL 3306</span> en <strong>source = le Security Group du serveur '
          'web</strong> (référencer le SG, pas une IP : plus propre et durable).</li>'
          '<li>Tester depuis le serveur web :</li></ol>'
          + cmd('mysql -h 10.0.2.&lt;x&gt; -u &lt;user&gt; -p   # depuis l’instance web')
          + note2('amber', '🌐 Instance privée = pas d’Internet par défaut',
                  'En subnet privé, l’instance n’a aucun accès Internet : '
                  '<code>apt install mariadb-server</code> échoue. Il faut une <strong>NAT Gateway</strong> '
                  '(dans le subnet public) + une route <span class="lx-nav">0.0.0.0/0 → NAT</span> dans la '
                  '<strong>table de routage du subnet privé</strong>. NAT facturée → à supprimer au nettoyage.')
          + note2('gray', '🔐 GRANT par IP : pensez à skip-name-resolve',
                  'MariaDB identifie le client par son nom DNS '
                  '(<span class="lx-nav">ip-10-0-1-x.ec2.internal</span>), pas par son IP. Pour qu’un compte '
                  'lié à <span class="lx-nav">10.0.1.x</span> corresponde, ajoute <code>skip-name-resolve</code> '
                  'à la conf MariaDB puis redémarre le service.')
          + note2('blue', '🗄️ EC2 MySQL vs RDS',
                  'Ici on héberge MySQL <em>soi-même</em> sur une EC2 (IaaS : à nous les patchs et '
                  'sauvegardes). AWS propose aussi <strong>RDS</strong>, la même base en <strong>PaaS</strong> '
                  '(AWS gère installation, correctifs, sauvegardes) — voir la correction.')),

    etape(6, BLEU, 'Superviser avec CloudWatch', 'Alarmes CPU/RAM + tableau de bord',
          '<ol style="margin:0;padding-left:18px;line-height:1.7">'
          '<li>Configurer des <strong>alarmes CloudWatch</strong> sur le <strong>CPU</strong> et la '
          '<strong>RAM</strong> des instances (la RAM nécessite l’<em>agent CloudWatch</em> installé sur la VM).</li>'
          '<li>Créer des <strong>alertes mail</strong> (via un <strong>topic SNS</strong> abonné à ton '
          'adresse) déclenchées au dépassement de seuil.</li>'
          '<li>Assembler un <strong>tableau de bord</strong> personnalisé avec les métriques collectées.</li>'
          '</ol>'
          + note2('gray', '🧩 La RAM exige l’agent CloudWatch',
                  'Nativement, CloudWatch ne voit que le <strong>CPU</strong>. Pour la <strong>RAM</strong>, '
                  'installe l’agent sur chaque VM (rôle IAM avec '
                  '<span class="lx-nav">CloudWatchAgentServerPolicy</span>) :')
          + cmd('wget https://amazoncloudwatch-agent.s3.amazonaws.com/debian/amd64/latest/amazon-cloudwatch-agent.deb\n'
                'sudo dpkg -i -E ./amazon-cloudwatch-agent.deb\n'
                '# config mem+cpu dans amazon-cloudwatch-agent.json, puis :\n'
                'sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \\\n'
                '  -a fetch-config -m ec2 -s -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json')
          + note2('gray', '🧰 Commandes complètes',
                  'Agent, NAT, migration rsync et checklist de nettoyage sont réunis dans '
                  '<a href="/pages/outil-aws-cloud">la boîte à outils AWS</a>.')),

    etape(7, ROUGE, 'Résilience puis nettoyage', 'AMI, puis tout supprimer',
          '<ol style="margin:0;padding-left:18px;line-height:1.7">'
          '<li>Créer une <strong>AMI</strong> (image) à partir de l’instance web configurée : elle '
          'permettra de <strong>recréer</strong> le serveur à l’identique (résilience, Auto Scaling).</li>'
          '<li><strong>Supprimer toutes les ressources</strong> : instances EC2, base, éventuel RDS, '
          'puis les éléments réseau — pour ne pas consommer le budget.</li></ol>'
          + note2('yellow', '🧹 L’ordre du nettoyage',
                  'Arrête/termine d’abord les <strong>instances</strong>, puis les ressources réseau '
                  '(NAT, passerelles) et enfin le VPC. Vérifie dans <span class="lx-nav">Billing</span> '
                  'qu’il ne reste rien de facturé.')),

    note2('green', '🏁 Ce qu’on a construit',
          'Un réseau isolé (VPC), un serveur web exposé proprement (subnet public + IGW + route + SG '
          'restreint), une base injoignable de l’extérieur (subnet privé + SG référencé), de la '
          'supervision (CloudWatch/SNS), et une image de reprise (AMI). Les <strong>réponses aux '
          'questions</strong> du TP : <a href="/pages/correction-cloud-aws">correction</a>.'),
])
EXTRAIT_PROC = ('Migrer un serveur web vers AWS : VPC_LAB_01 (10.0.0.0/16) avec subnets public/privé, '
                'Internet Gateway et route par défaut, EC2 Debian public + Security Group restreint, SSH '
                '(user admin) et migration scp, base MySQL en subnet privé, CloudWatch (alarmes CPU/RAM + '
                'SNS + dashboard), AMI et nettoyage — en surveillant le budget.')

# ── la correction ──────────────────────────────────────────────────────────────

CORR = '\n'.join([
    '<section class="hero"><span class="pill">Correction · TP · Cloud AWS</span>'
    '<h1>Correction du TP Cloud AWS</h1>'
    '<p>Le corrigé du déploiement AWS et, surtout, les <strong>réponses argumentées</strong> aux '
    'questions du TP — routage, responsabilité partagée, Security Groups, interconnexion, RDS, VPC, '
    'souveraineté, et le bilan avantages/inconvénients.</p>'
    '</section>',
    PSTYLE,
    note2('blue', '🧭 Le déroulé',
          'Le pas à pas complet (VPC, EC2, base, CloudWatch, AMI, nettoyage) est dans la '
          '<a href="/pages/procedure-cloud-aws">procédure dédiée</a>. On reprend ici les '
          '<strong>points qui piègent</strong> et on répond à chaque question.'),

    etape(1, VIOLET, 'Réseau &amp; accès à l’instance', 'Les questions du bloc 2',
          qa('Pourquoi le routage (et la route par défaut) est-il indispensable pour joindre l’EC2 via son IP publique ?',
             'Une IP publique ne suffit pas : pour que le trafic <em>reparte</em> vers Internet, le '
             'subnet doit avoir une <strong>table de routage</strong> avec une route '
             '<span class="lx-nav">0.0.0.0/0</span> pointant vers l’<strong>Internet Gateway</strong> '
             'attachée au VPC. Sans cette route par défaut, les paquets entrants ne trouvent pas de '
             'chemin de retour → la connexion (SSH, HTTP) échoue. C’est le rôle de la passerelle : la '
             'sortie de secours vers tout réseau inconnu.')
          + qa('À quoi servent les Security Groups ?',
               'Ce sont des <strong>pare-feu virtuels au niveau de l’instance</strong> : ils autorisent '
               'des flux en entrée/sortie (protocole, port, source/destination). <strong>Statefull</strong> '
               '(le retour d’une connexion autorisée passe automatiquement). Bonne pratique : un SG '
               '<strong>dédié</strong> par rôle, sources <strong>restreintes</strong> (ici l’IP publique '
               'de l’ADRAR pour SSH/HTTP), et on <strong>référence un SG</strong> plutôt qu’une IP quand '
               'c’est possible (web → base).')),

    etape(2, ROUGE, 'Responsabilité partagée', 'La question du bloc 2',
          qa('Si ta Debian 13 comporte une CVE importante, à qui incombe le patch ?',
             'À <strong>toi</strong>. Sur EC2, c’est de l’<strong>IaaS</strong> : AWS ne fournit que '
             'l’infrastructure (« le fer »). Le système d’exploitation, ses mises à jour de sécurité et '
             'les applications sont sous <strong>ta</strong> responsabilité (« sécurité <em>DANS</em> le '
             'cloud »). AWS ne patcherait que ce qu’il gère lui-même (l’hyperviseur, le matériel).')),

    etape(3, TEAL, 'Interconnexion SI ↔ AWS', 'La question du bloc 3',
          qa('Quels moyens d’interconnexion entre ton SI et AWS ? Avantages / inconvénients ?', '')
          + tab2(['Moyen', 'Avantages', 'Inconvénients'], [
              ['<strong>VPN site-à-site (IPsec)</strong> sur Internet', 'Rapide à mettre en place, peu '
               'coûteux, chiffré', 'Débit/latence dépendants d’Internet, moins stable'],
              ['<strong>AWS Direct Connect</strong> (lien dédié)', 'Débit garanti, latence faible et '
               'stable, privé', 'Coûteux, délai de mise en place, un lien physique à commander'],
              ['<strong>VPC Peering / Transit Gateway</strong>', 'Relie des VPC entre eux simplement', 'Entre VPC AWS surtout, pas une liaison vers l’On-Prem'],
              ['<strong>Client VPN</strong> (accès nomade)', 'Accès individuel simple depuis un poste', 'Pour des utilisateurs, pas pour relier deux sites'],
          ])
          + note2('gray', '🔗 À rapprocher',
                  'Le VPN site-à-site est exactement le '
                  '<a href="/pages/procedure-vpn-ipsec-pfsense">tunnel IPsec</a> qu’on monte entre agences '
                  '— ici, un bout est chez AWS (Virtual Private Gateway).')),

    etape(4, BLEU, 'La base managée : RDS', 'Les questions du bloc 4',
          qa('Quel type de service cloud propose RDS (IaaS, SaaS ou PaaS) ?',
             '<strong>PaaS</strong> (Platform as a Service). AWS fournit et gère la plateforme (serveur, '
             'OS, moteur de base) ; tu n’administres que <strong>la base et ses données</strong>.')
          + qa('Pourquoi AWS gère-t-il ici les patchs et les sauvegardes ?',
               'Parce qu’en PaaS, l’OS et le moteur de base <strong>font partie de ce qu’AWS opère</strong> : '
               'les correctifs de sécurité, les sauvegardes automatiques, la haute disponibilité et les '
               'montées de version sont inclus dans le service. C’est le contraste avec une base '
               'auto-hébergée sur EC2 (IaaS), où tout cela reste à ta charge.')),

    etape(5, VERT, 'VPC, souveraineté &amp; bilan', 'Les questions du bloc 6',
          qa('Quel avantage à créer un VPC dans AWS ?',
             '<strong>Isolation et contrôle</strong> : un réseau privé bien à soi, avec ses sous-réseaux '
             '(public/privé), ses tables de routage, ses passerelles et ses règles — on reproduit '
             'l’architecture d’un réseau d’entreprise, on segmente (web exposé / base isolée) et on '
             'maîtrise qui parle à qui.')
          + qa('Pourquoi préférer, pour une entreprise française, des datacenters AWS hébergés en Europe ?',
               'Pour la <strong>conformité au RGPD</strong> et la <strong>souveraineté des données</strong> '
               '(éviter le transfert hors UE et l’exposition à des lois extra-européennes comme le '
               '<em>CLOUD Act</em>), pour la <strong>latence</strong> (proximité géographique) et pour '
               'certaines exigences sectorielles (santé, secteur public → <strong>SecNumCloud</strong>).')
          + '<h2 style="margin-top:18px">Avantages &amp; inconvénients du cloud</h2>'
          + tab2(['Avantages', 'Inconvénients'], [
              ['Scalabilité à la demande (élasticité)', 'Coût qui dérape si mal maîtrisé (OPEX continu)'],
              ['Pas d’investissement matériel (OPEX)', 'Dépendance au fournisseur (réversibilité, verrouillage)'],
              ['Maintenance infra déléguée', 'Données chez un tiers (souveraineté, RGPD)'],
              ['Haute disponibilité, sauvegardes intégrées (PaaS)', 'Nécessite une connexion Internet fiable'],
              ['Déploiement rapide, mondial', 'Responsabilité partagée mal comprise = risque de sécurité'],
          ])),

    note2('green', '🏁 À retenir',
          'AWS sécurise le cloud, <strong>vous</strong> sécurisez ce que vous y mettez. Une IP publique '
          'ne sert à rien sans <strong>route par défaut vers l’Internet Gateway</strong>. Les '
          '<strong>Security Groups</strong> restreignent les flux au plus juste. <strong>RDS = PaaS</strong> '
          '(AWS gère patchs/sauvegardes), <strong>EC2 = IaaS</strong> (à vous l’OS). Un <strong>VPC</strong> '
          'isole et segmente ; l’<strong>Europe</strong> pour le RGPD et la souveraineté.'),
    note2('gray', '🔗 Liens',
          '<a href="/pages/cloud-aws">Cours : le cloud AWS</a> · '
          '<a href="/pages/procedure-cloud-aws">Procédure de déploiement</a> · '
          '<a href="/pages/cloud-premiers-pas">Le cloud : premiers pas</a>.'),
])
EXTRAIT_CORR = ('Le corrigé du TP Cloud AWS avec les réponses argumentées : rôle de la route par défaut '
                'et de l’Internet Gateway, responsabilité partagée (CVE sur EC2 = à vous), Security Groups, '
                'moyens d’interconnexion SI↔AWS, RDS = PaaS, intérêt du VPC, hébergement en Europe (RGPD/'
                'souveraineté) et bilan avantages/inconvénients.')

CARTE_PROC = ('<a class="dir-card" href="/pages/procedure-cloud-aws"><div class="dc-ico">☁️</div>'
              '<div class="dc-body"><div class="dc-title">Déployer une infra web sur AWS (VPC, EC2, RDS, CloudWatch)</div>'
              '<div class="dc-desc meta">Pas à pas : VPC + subnets public/privé + Internet Gateway, EC2 web '
              'public avec Security Group restreint, SSH + migration scp, base MySQL en subnet privé, '
              'CloudWatch (alarmes + SNS + dashboard), AMI et nettoyage.</div>'
              '<div><span style="display:inline-block;font-size:10.5px;font-weight:600;color:var(--text-muted);'
              'background:var(--surface-3);border:1px solid var(--border);border-radius:999px;padding:1px 9px;'
              'margin:4px 4px 0 0">AWS</span>'
              '<span style="display:inline-block;font-size:10.5px;font-weight:600;color:var(--text-muted);'
              'background:var(--surface-3);border:1px solid var(--border);border-radius:999px;padding:1px 9px;'
              'margin:4px 4px 0 0">Cloud</span></div></div><div class="dc-go">Voir →</div></a>')

CARTE_CORR = ('<a class="dir-card" href="/pages/correction-cloud-aws"><div class="dc-ico">📝</div>'
              '<div class="dc-body"><div class="dc-title">Correction du TP Cloud AWS</div>'
              '<div class="dc-desc meta">Les réponses argumentées : route par défaut / Internet Gateway, '
              'responsabilité partagée, Security Groups, interconnexion SI↔AWS, RDS = PaaS, intérêt du VPC, '
              'hébergement en Europe, avantages/inconvénients du cloud.</div>'
              '<div><span style="display:inline-block;font-size:10.5px;font-weight:600;color:var(--text-muted);'
              'background:var(--surface-3);border:1px solid var(--border);border-radius:999px;padding:1px 9px;'
              'margin:4px 4px 0 0">AWS</span>'
              '<span style="display:inline-block;font-size:10.5px;font-weight:600;color:var(--text-muted);'
              'background:var(--surface-3);border:1px solid var(--border);border-radius:999px;padding:1px 9px;'
              'margin:4px 4px 0 0">Correction</span></div></div><div class="dc-go">Voir →</div></a>')


def ranger(c, slug, sec_id, carte):
    h = c.execute("SELECT content FROM pages WHERE slug='procedures'").fetchone()[0]
    if slug not in h:
        m = re.search(rf'<section class="pd-sec" id="{sec_id}">.*?</section>', h, re.S)
        bloc = m.group(0)
        fin = bloc.rindex('</div></section>')
        bloc = bloc[:fin] + carte + bloc[fin:]
        h = h[:m.start()] + bloc + h[m.end():]
    comptes = {}
    for m in re.finditer(r'<section class="pd-sec" id="(sec-[^"]+)">(.*?)</section>', h, re.S):
        comptes[m.group(1)] = len(re.findall(r'<a class="dir-card"', m.group(2)))
    h = re.sub(r'<section class="pd-sec" id="(sec-[^"]+)">.*?</section>',
               lambda m: re.sub(r'(<span class="pd-count">)\d+(</span>)',
                                lambda t: t.group(1) + str(comptes[m.group(1)]) + t.group(2), m.group(0), count=1),
               h, flags=re.S)
    h = re.sub(r'<a class="pd-chip" href="#(sec-[^"]+)">.*?</a>',
               lambda m: re.sub(r'(<span class="pd-n">)\d+(</span>)',
                                lambda t: t.group(1) + str(comptes.get(m.group(1), 0)) + t.group(2), m.group(0), count=1),
               h, flags=re.S)
    total = sum(comptes.values())
    h = re.sub(r'>\d+ procédures,', f'>{total} procédures,', h, count=1)
    c.execute("UPDATE pages SET content=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug='procedures'", (h,))
    return f'{sec_id}={comptes.get(sec_id)} ; total {total}'


# ═══════════════════════════════════════════════ 4) L'OUTIL ════════════════════

OUTIL = '\n'.join([
    hero('Outil · Cloud · AWS', 'Boîte à outils AWS — migration &amp; supervision',
         'Les commandes prêtes à coller du TP Cloud : installer l’agent CloudWatch (CPU + RAM), '
         'donner un accès Internet à un subnet privé (NAT Gateway), migrer le site On-Premise vers '
         'EC2 en rsync, et nettoyer sans rien oublier.'),
    PSTYLE,
    '<h2>1. Agent CloudWatch — CPU + RAM</h2>',
    note2('gray', '🧩 Pourquoi un agent',
          'CloudWatch ne remonte nativement que le <strong>CPU</strong>. La <strong>RAM</strong> exige '
          'l’agent, sur chaque instance, avec un rôle IAM portant '
          '<span class="lx-nav">CloudWatchAgentServerPolicy</span>.'),
    cmd('wget https://amazoncloudwatch-agent.s3.amazonaws.com/debian/amd64/latest/amazon-cloudwatch-agent.deb\n'
        'sudo dpkg -i -E ./amazon-cloudwatch-agent.deb'),
    '<p>Config minimale (RAM + CPU + disque) dans '
    '<span class="lx-nav">/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json</span> :</p>',
    cmd('{\n'
        '  "metrics": {\n'
        '    "append_dimensions": { "InstanceId": "${aws:InstanceId}" },\n'
        '    "metrics_collected": {\n'
        '      "mem":  { "measurement": ["mem_used_percent"] },\n'
        '      "cpu":  { "measurement": ["cpu_usage_active"], "totalcpu": true },\n'
        '      "disk": { "measurement": ["used_percent"], "resources": ["/"] }\n'
        '    }\n'
        '  }\n'
        '}'),
    cmd('sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \\\n'
        '  -a fetch-config -m ec2 -s \\\n'
        '  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json'),

    '<h2>2. Subnet privé : accès Internet (NAT Gateway)</h2>',
    note2('amber', '🌐 Sinon « apt » échoue',
          'Une instance en subnet privé n’a aucun accès Internet. Crée une <strong>NAT Gateway</strong> '
          'dans le <strong>subnet public</strong>, puis une route '
          '<span class="lx-nav">0.0.0.0/0 → NAT</span> dans la <strong>table de routage du subnet '
          'privé</strong>. (À supprimer au nettoyage : facturée.)'),

    '<h2>3. Migrer le site On-Premise → EC2 (rsync)</h2>',
    note2('gray', '🔑 Prérequis',
          'La clé <span class="lx-nav">.pem</span> sur la machine source, et le Security Group de l’EC2 '
          'autorisant le SSH depuis l’IP publique de cette machine.'),
    cmd('rsync -avz --delete -e "ssh -i ~/cle.pem" \\\n'
        '  --rsync-path="sudo rsync" \\\n'
        '  /var/www/monsite/ admin@&lt;IP_PUBLIQUE_EC2&gt;:/var/www/html/'),
    note2('blue', '♻️ Rejouable à volonté',
          'rsync ne transfère que les différences : relance la même commande à chaque mise à jour. '
          'Ajoute <code>--exclude config.php</code> pour garder une connexion propre à chaque '
          'environnement (On-Prem → base locale, EC2 → base privée).'),

    '<h2>4. Checklist de nettoyage (budget LAB)</h2>',
    tab2(['À supprimer', 'Où'],
         [['Instances EC2 (web + base)', 'EC2 ▸ Instances ▸ Terminer l’instance'],
          ['NAT Gateway', 'VPC ▸ Passerelles NAT ▸ Supprimer'],
          ['Elastic IP (web + NAT)', 'VPC ▸ Adresses IP Elastic ▸ Libérer (les non attachées sont facturées)'],
          ['AMI + instantanés', 'EC2 ▸ AMI (désenregistrer) ; EC2 ▸ Instantanés'],
          ['Alarmes, dashboard, topic SNS', 'CloudWatch ; Amazon SNS'],
          ['VPC (subnets, SG, IGW)', 'VPC ▸ une fois tout le reste supprimé']]),
    note2('yellow', '💸 Vérifie Billing',
          'La <strong>NAT Gateway</strong> et les <strong>Elastic IP non attachées</strong> sont les '
          'pièges facturés. Vérifie qu’il ne reste rien dans <span class="lx-nav">Billing</span>.'),
    note2('gray', '🔗 À rapprocher',
          '<a href="/pages/procedure-cloud-aws">La procédure du TP</a> · '
          '<a href="/pages/cloud-aws">Le cours Cloud AWS</a> · '
          '<a href="/pages/correction-cloud-aws">La correction</a>.'),
])
EXTRAIT_OUTIL = ('Les commandes prêtes du TP Cloud AWS : installer l’agent CloudWatch (CPU + RAM), '
                 'donner Internet à un subnet privé via une NAT Gateway, migrer le site On-Premise vers '
                 'EC2 en rsync (rejouable), et la checklist de nettoyage pour ne rien laisser facturé.')

CARTE_OUTIL = ('<a class="script-card" href="/pages/outil-aws-cloud"><div class="sc-top">'
               '<span class="sc-ico">☁️</span><span class="sc-badge sc-badge-int">📋 Mémo</span></div>'
               '<div class="sc-title">Boîte à outils AWS — migration &amp; supervision</div>'
               '<div class="sc-desc meta">Commandes prêtes du TP Cloud : agent CloudWatch (CPU + RAM), '
               'NAT Gateway pour subnet privé, migration rsync On-Prem → EC2, checklist de nettoyage.</div>'
               '<div class="sc-tags"><span class="sc-pill">AWS</span><span class="sc-pill">EC2</span>'
               '<span class="sc-pill">CloudWatch</span><span class="sc-pill">rsync</span></div></a>')


def ranger_outil(c):
    ct = c.execute("SELECT content FROM pages WHERE slug='scripts'").fetchone()[0]
    if 'outil-aws-cloud' in ct:
        return 'déjà présent'
    i = ct.index('id="sec-reseau"')
    j = ct.index('</div></section>', i)
    ct = ct[:j] + CARTE_OUTIL + ct[j:]
    sec = ct[i:ct.index('</section>', i)]
    n = sec.count('<a class="script-card"')
    ct = ct[:i] + re.sub(r'<span class="sc-count">\d+</span>', f'<span class="sc-count">{n}</span>', sec, count=1) + ct[i + len(sec):]
    ct = re.sub(r'(<a class="sc-chip" href="#sec-reseau">.*?<span class="sc-n">)\d+(</span>)',
                lambda m: m.group(1) + str(n) + m.group(2), ct, count=1, flags=re.S)
    total = ct.count('<a class="script-card"') + ct.count('class="sc-feat"')
    ct = re.sub(r'<p class="meta">\d+ outils\.', f'<p class="meta">{total} outils.', ct, count=1)
    c.execute("UPDATE pages SET content=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug='scripts'", (ct,))
    return f'outil range (sec-reseau {n}, total {total})'


if __name__ == '__main__':
    publier_lot(PAGES_COURS, CLOUD)
    c = sqlite3.connect(BASE)
    print('procedure-cloud-aws :', publier(c, 'procedure-cloud-aws',
          'Déployer une infra web sur AWS (VPC, EC2, RDS, CloudWatch)', EXTRAIT_PROC, PROC))
    print(ranger(c, 'procedure-cloud-aws', 'sec-projet', CARTE_PROC).encode('ascii', 'replace').decode())
    print('correction-cloud-aws :', publier(c, 'correction-cloud-aws',
          'Correction du TP Cloud AWS', EXTRAIT_CORR, CORR))
    print(ranger(c, 'correction-cloud-aws', 'sec-correction', CARTE_CORR).encode('ascii', 'replace').decode())
    print('outil-aws-cloud :', publier(c, 'outil-aws-cloud',
          'Boîte à outils AWS — migration & supervision', EXTRAIT_OUTIL, OUTIL))
    print(ranger_outil(c).encode('ascii', 'replace').decode())
    c.commit()
    c.close()
    sys.exit(0)

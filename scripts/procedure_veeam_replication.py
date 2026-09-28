# -*- coding: utf-8 -*-
"""
Page « Réplication et politique de sauvegarde avec Veeam » — version simplifiée.
Durcir le serveur de sauvegarde (ANSSI), monter un job de réplication du serveur
Web (re-IP + remapping), fiabiliser l'IP du réplica Linux, puis BASCULER LE
TRAFIC de la façon la plus simple : un load balancer nginx en frontal (le DNS
pointe une seule fois vers le répartiteur) ou, sans LB, le script PowerShell
Switch-DnsReplica.ps1 branché en post-failover Veeam. Failover/failback + 3-2-1.
Style step-banner. Rangée dans Procédures › Virtualisation & Hyper-V.

IDEMPOTENT.
"""
import re
import sqlite3
import sys

from _cours import BASE, publier

SLUG = 'procedure-veeam-replication'
TITRE = 'Réplication et politique de sauvegarde avec Veeam'

STYLE = ('<style>'
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


def cmd(t):
    return f'<div class="proc-cmd">{t}</div>'


def nav(t):
    return f'<span class="lx-nav">{t}</span>'


def note(couleur, titre, *paras):
    return (f'<aside class="pb-note pb-note-{couleur}"><p class="pb-note-title">{titre}</p>'
            + ''.join(f'<p>{p}</p>' for p in paras) + '</aside>')


def tab(entetes, lignes):
    th = ''.join(f'<th>{h}</th>' for h in entetes)
    tr = ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in l) + '</tr>' for l in lignes)
    return f'<table class="rt"><tr>{th}</tr>{tr}</table>'


def etape(num, couleur, titre, sous, corps):
    return (f'<div class="step-banner" style="border-left-color:{couleur}">'
            f'<span class="step-num" style="background:{couleur}">{num}</span>'
            f'<span class="step-tt"><h3>{titre}</h3><span class="step-sub">{sous}</span></span></div>'
            f'<div class="step-rail" style="border-left-color:{couleur}">{corps}</div>')


BLEU, VERT, AMBRE, VIOLET, ROUGE, TEAL = '#3b82f6', '#16a34a', '#d97706', '#7c3aed', '#dc2626', '#0d9488'

# --- Scripts embarqués (pas d'angle brackets dans PS/nginx : sûrs pour le HTML) ---

SCRIPT_LINUX = (
    '#!/bin/bash\n'
    '# /usr/local/sbin/reseau-selon-site.sh\n'
    '# Le replica se regle seul au boot : rien n\'est fige, une mise a jour ne casse plus l\'IP.\n'
    'set -u\n'
    'IFACE="eth0"\n'
    '# site : passerelle-temoin  IP-a-poser  prefixe\n'
    'SITES="\n'
    'bordeaux 10.180.30.254 10.180.30.1 24\n'
    'toulouse 10.160.30.254 10.160.30.2 24\n'
    '"\n'
    'ip link set "$IFACE" up; sleep 2\n'
    'SEL=""\n'
    'while read -r nom gw ipvm cidr; do\n'
    '  [ -z "$nom" ] && continue\n'
    '  if arping -c 2 -w 3 -I "$IFACE" "$gw" >/dev/null 2>&1; then\n'
    '    SEL="$nom"; SGW="$gw"; SIP="$ipvm"; SCIDR="$cidr"; break\n'
    '  fi\n'
    'done <<< "$SITES"\n'
    '[ -z "$SEL" ] && { logger -t reseau-site "Aucun site reconnu"; exit 0; }\n'
    'ip addr flush dev "$IFACE"\n'
    'ip addr add "$SIP/$SCIDR" dev "$IFACE"\n'
    'ip route replace default via "$SGW"\n'
    'printf "nameserver %s\\n" "$SGW" > /etc/resolv.conf\n'
    'logger -t reseau-site "Site=$SEL IP=$SIP"'
)

CONF_NGINX = (
    '# /etc/nginx/conf.d/loadbalancer.conf\n'
    'upstream web_backend {\n'
    '    server 10.180.30.1:80 max_fails=3 fail_timeout=10s;   # prod locale\n'
    '    server 10.160.30.2:80 backup;                          # replica (agence distante)\n'
    '}\n'
    'server {\n'
    '    listen 80;\n'
    '    server_name _;\n'
    '    location / {\n'
    '        proxy_pass http://web_backend;\n'
    '        proxy_set_header Host $host;\n'
    '        proxy_set_header X-Real-IP $remote_addr;\n'
    '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n'
    '        proxy_connect_timeout 3s;\n'
    '        proxy_next_upstream error timeout http_502 http_503 http_504;\n'
    '    }\n'
    '    access_log /var/log/nginx/lb_access.log;\n'
    '    error_log  /var/log/nginx/lb_error.log;\n'
    '}'
)

SCRIPT_DNS = (
    '# Switch-DnsReplica.ps1 -- bascule l\'enregistrement A du site vers l\'IP active.\n'
    '# Idempotent : relancable sans risque, ne change rien si le DNS est deja a jour.\n'
    '[CmdletBinding()]\n'
    'param(\n'
    '    [ValidateSet("Auto","Failover","Failback")] [string]$Mode = "Auto",\n'
    '    [switch]$UpdatePtr\n'
    ')\n'
    '\n'
    '# ---- A ADAPTER ----\n'
    '$DnsServer = "10.180.10.1"        # DC / serveur DNS\n'
    '$ZoneName  = "bordeaux.local"     # zone directe\n'
    '$HostName  = "www"                # enregistrement a basculer\n'
    '$IpAgenceA = "10.180.30.1"        # IP d\'origine (prod locale)\n'
    '$IpAgenceB = "10.160.30.2"        # IP apres failover (replica distant)\n'
    '$TtlCourt  = New-TimeSpan -Minutes 5\n'
    '# -------------------\n'
    '\n'
    'switch ($Mode) {\n'
    '    "Failover" { $Cible = $IpAgenceB }\n'
    '    "Failback" { $Cible = $IpAgenceA }\n'
    '    "Auto" {\n'
    '        if     (Test-Connection -Quiet -Count 2 -ComputerName $IpAgenceB) { $Cible = $IpAgenceB }\n'
    '        elseif (Test-Connection -Quiet -Count 2 -ComputerName $IpAgenceA) { $Cible = $IpAgenceA }\n'
    '        else   { throw "Aucune des deux IP ne repond ($IpAgenceA / $IpAgenceB)." }\n'
    '    }\n'
    '}\n'
    'Write-Host "Mode=$Mode  ->  $HostName.$ZoneName doit pointer vers $Cible"\n'
    '\n'
    '$actuels = @(Get-DnsServerResourceRecord -ComputerName $DnsServer -ZoneName $ZoneName '
    '-Name $HostName -RRType A -ErrorAction SilentlyContinue)\n'
    '\n'
    'if ($actuels.Count -eq 1 -and $actuels[0].RecordData.IPv4Address.IPAddressToString -eq $Cible) {\n'
    '    Write-Host "DNS deja a jour, rien a faire."\n'
    '} else {\n'
    '    foreach ($rr in $actuels) {\n'
    '        Remove-DnsServerResourceRecord -ComputerName $DnsServer -ZoneName $ZoneName -InputObject $rr -Force\n'
    '    }\n'
    '    Add-DnsServerResourceRecordA -ComputerName $DnsServer -ZoneName $ZoneName '
    '-Name $HostName -IPv4Address $Cible -TimeToLive $TtlCourt\n'
    '    Write-Host "Enregistrement A bascule vers $Cible (TTL 5 min)."\n'
    '}\n'
    '\n'
    'if ($UpdatePtr) {                                  # zone inverse /24 optionnelle\n'
    '    $o = $Cible.Split(".")\n'
    '    $revZone = "$($o[2]).$($o[1]).$($o[0]).in-addr.arpa"\n'
    '    Get-DnsServerResourceRecord -ComputerName $DnsServer -ZoneName $revZone -RRType Ptr -ErrorAction SilentlyContinue |\n'
    '        Where-Object { $_.RecordData.PtrDomainName -like "$HostName.$ZoneName*" } |\n'
    '        ForEach-Object { Remove-DnsServerResourceRecord -ComputerName $DnsServer -ZoneName $revZone -InputObject $_ -Force }\n'
    '    Add-DnsServerResourceRecordPtr -ComputerName $DnsServer -ZoneName $revZone -Name $o[3] -PtrDomainName "$HostName.$ZoneName."\n'
    '}\n'
    '\n'
    'Clear-DnsServerCache -ComputerName $DnsServer -Force -ErrorAction SilentlyContinue\n'
    'Clear-DnsClientCache\n'
    'Resolve-DnsName -Name "$HostName.$ZoneName" -Server $DnsServer'
)

CORPS = '\n'.join([
    '<section class="hero"><span class="pill">Procédure · Réplication · Hyper-V</span>'
    '<h1>Réplication et politique de sauvegarde avec Veeam</h1>'
    '<p>Après la sauvegarde, la reprise : maintenir une copie <em>démarrable</em> du serveur Web sur '
    'l’autre agence, et faire suivre le trafic au moment où un site tombe — de la façon la plus '
    'simple possible.</p>'
    '</section>',
    STYLE,

    note('blue', '🎯 Ce qu’on met en place',
         'Les deux agences (Bordeaux ↔ Toulouse) communiquent déjà par le '
         '<a href="/pages/procedure-vpn-ipsec-pfsense">VPN IPsec site-à-site</a>, et la '
         '<strong>sauvegarde</strong> est en place '
         '(<a href="/pages/procedure-veeam-hyperv">sauvegarder une VM Hyper-V avec Veeam</a>). '
         'On ajoute la <strong>réplication</strong> : une VM déjà reconstituée sur l’hôte de l’autre '
         'agence, qu’on allume en quelques minutes. La sauvegarde répond à « j’ai perdu des '
         'données » ; la réplication à « j’ai perdu un site ».'),

    note('green', '🧭 L’idée qui simplifie tout',
         'Le point délicat d’une réplication, c’est <strong>faire suivre le nom du site</strong> quand '
         'l’IP change. Deux façons : soit on <strong>bascule le DNS</strong> à chaque failover (fragile, '
         'à scripter), soit on met un <strong>load balancer en frontal</strong> — le DNS pointe '
         '<strong>une seule fois</strong> vers le répartiteur, et c’est lui qui bascule vers la '
         'réplique quand la prod ne répond plus. La seconde voie est la plus simple : c’est celle '
         'qu’on privilégie (étape 5).')
    + tab(['Rôle', 'Adresse'],
          [['Serveur Web prod (Bordeaux)', '<span class="lx-nav">10.180.30.1</span>'],
           ['Réplique (Toulouse, agence distante)', '<span class="lx-nav">10.160.30.2</span>'],
           ['Load balancer nginx (frontal)', '<span class="lx-nav">10.180.30.10</span>'],
           ['DNS / DC de l’agence', '<span class="lx-nav">10.180.10.1</span>']]),

    etape(1, ROUGE, 'Durcir le serveur de sauvegarde (ANSSI)',
          'VM Windows Server · 60 Go + 300 Go backups · 4 Go RAM · 2 vCPU',
          '<p>Le serveur de sauvegarde est une cible de choix pour un rançongiciel : s’il tombe avec '
          'le domaine, on perd les données <em>et</em> leurs copies. D’où trois règles ANSSI :</p>'
          + tab(['Question', 'Réponse'],
                [['Intégré au domaine ?', '<strong>Non</strong> — hors domaine (workgroup), compte local'],
                 ['Mêmes identifiants que l’admin du domaine ?', '<strong>Non</strong> — comptes distincts et dédiés'],
                 ['Même réseau que les serveurs sauvegardés ?', '<strong>Non</strong> — segment isolé, flux Veeam filtrés']])
          + note('green', '✅ En conformité',
                 'Hors domaine, comptes dédiés, réseau d’administration séparé filtré au pare-feu, et '
                 'règle <strong>3-2-1</strong> (étape 7). Proposer le schéma cible (draw.io) et le '
                 'faire valider par l’intervenant.')),

    etape(2, BLEU, 'Installer Veeam, déclarer les hôtes et ouvrir les flux',
          'Backup & Replication + les deux hyperviseurs dans l’inventaire',
          '<p>Installer <strong>Veeam Backup &amp; Replication</strong> (édition Community), créer le '
          '<strong>référentiel</strong> sur le disque de 300 Go et ajouter les <strong>deux</strong> '
          'hôtes Hyper-V (local et distant) : '
          '<span class="lx-nav">Inventory ▸ Virtual Infrastructure ▸ Add Server ▸ Microsoft Hyper-V</span>. '
          'L’installation et le job de sauvegarde sont détaillés dans '
          '<a href="/pages/procedure-veeam-hyperv">la procédure de sauvegarde</a>.</p>'
          + note('amber', '⚠️ Si l’ajout de l’hôte distant échoue',
                 'C’est presque toujours le pare-feu. Ouvrir, <strong>entre les deux LAN Serveur à '
                 'travers le VPN</strong> et seulement entre les IP concernées : '
                 '<span class="lx-nav">RPC 135/tcp</span> + plage dynamique, '
                 '<span class="lx-nav">SMB 445/tcp</span>, <span class="lx-nav">data mover '
                 '2500–3300/tcp</span>, <span class="lx-nav">DNS 53</span>, et '
                 '<span class="lx-nav">ICMP</span>. Régler les deux pare-feu sur NTP.')),

    etape(3, TEAL, 'Créer le job de réplication du serveur Web',
          'Re-mapper le réseau (vSwitch) et ré-adresser la réplique',
          '<p><span class="lx-nav">Home ▸ Replication Job ▸ Virtual machine…</span> — l’essentiel se '
          'joue sur deux onglets, <strong>Network remapping</strong> et <strong>Replica re-IP</strong> :</p>'
          + tab(['Champ', 'Source (prod)', 'Cible (réplique distante)'],
                [['IP', '<span class="lx-nav">10.180.30.1</span>', '<span class="lx-nav">10.160.30.2</span>'],
                 ['Masque', '255.255.255.0', '255.255.255.0'],
                 ['Passerelle', '10.180.30.254', '<span class="lx-nav">10.160.30.254</span>'],
                 ['DNS', '10.180.10.1', 'DC de l’agence distante (10.160.10.1)'],
                 ['vSwitch', 'DMZ Bordeaux', 'DMZ Toulouse (<em>Network remapping</em>)']])
          + note('blue', '🌐 Pourquoi re-IP + remapping',
                 'La DMZ de Bordeaux (<span class="lx-nav">10.180.30.0/24</span>) et celle de Toulouse '
                 '(<span class="lx-nav">10.160.30.0/24</span>) sont des réseaux différents. La règle '
                 '<strong>Replica re-IP</strong> réécrit l’adresse au failover, et le <strong>Network '
                 'remapping</strong> raccorde la réplique au bon commutateur virtuel.',
                 '<strong>Choisir une IP libre</strong> pour la réplique : si '
                 '<span class="lx-nav">10.160.30.2</span> est déjà prise sur le réseau distant, il y '
                 'aurait un conflit d’adresse — prendre alors une adresse réservée à la réplique.')),

    etape(4, VIOLET, 'Fiabiliser l’IP du réplica Linux',
          'Le disque cloné garde l’IP source — la VM se règle seule au boot',
          '<p>Le réplica est une copie du disque source : à chaque cycle, il reprend l’IP figée dans '
          'la source. Le <em>Replica re-IP</em> corrige cela au failover pour <strong>Windows</strong> '
          '(registre) ; pour un invité <strong>Linux</strong> (notre serveur Web Debian), le plus '
          'fiable est de <strong>ne rien figer</strong> et de laisser la VM détecter le site et poser '
          'son IP au démarrage. Le script vit dans la source → il est répliqué tel quel → il '
          'fonctionne où que la réplique boote, même après une mise à jour.</p>'
          + cmd('sudo apt install -y iputils-arping\n'
                'sudo nano /usr/local/sbin/reseau-selon-site.sh   # coller le script ci-dessous\n'
                'sudo chmod +x /usr/local/sbin/reseau-selon-site.sh')
          + cmd(SCRIPT_LINUX)
          + '<p>Passer l’interface en <span class="lx-nav">manual</span> '
          '(<span class="lx-nav">/etc/network/interfaces</span> : '
          '<span class="lx-nav">iface eth0 inet manual</span>) puis lancer le script à chaque boot '
          'via systemd :</p>'
          + cmd('sudo tee /etc/systemd/system/reseau-selon-site.service >/dev/null <<\'EOF\'\n'
                '[Unit]\n'
                'After=network-pre.target\n'
                'Before=network-online.target\n'
                'Wants=network-pre.target\n'
                '[Service]\n'
                'Type=oneshot\n'
                'ExecStart=/usr/local/sbin/reseau-selon-site.sh\n'
                'RemainAfterExit=yes\n'
                '[Install]\n'
                'WantedBy=multi-user.target\n'
                'EOF\n'
                'sudo systemctl enable --now reseau-selon-site.service\n'
                'ip a show eth0')),

    etape(5, VERT, 'Basculer le trafic vers la réplique',
          'La voie simple (load balancer) — et l’alternative (script DNS)',
          '<p><strong>Voie A — recommandée : un load balancer nginx en frontal.</strong> Les clients '
          'visent le répartiteur (<span class="lx-nav">10.180.30.10</span>) ; le DNS y pointe '
          '<strong>une seule fois</strong> et ne bouge plus. nginx envoie tout sur la prod et bascule '
          'seul sur la réplique déclarée <span class="lx-nav">backup</span> — ce qui colle avec le '
          'failover Veeam.</p>'
          + cmd('sudo apt update && sudo apt install -y nginx\n'
                'sudo rm -f /etc/nginx/sites-enabled/default\n'
                'sudo nano /etc/nginx/conf.d/loadbalancer.conf   # config ci-dessous\n'
                'sudo nginx -t && sudo systemctl reload nginx')
          + cmd(CONF_NGINX)
          + note('green', '✅ Ce que ça simplifie',
                 'Le DNS pointe <span class="lx-nav">www</span> → '
                 '<span class="lx-nav">10.180.30.10</span> une fois pour toutes : le <strong>script de '
                 'bascule DNS n’est plus indispensable</strong>, c’est nginx qui bascule. Ouvrir le '
                 'flux <span class="lx-nav">10.180.30.10 → 10.160.30.2:80</span> sur les pare-feu '
                 'entre agences, sinon le répartiteur ne joint pas la réplique. Pour aller plus loin '
                 '(algorithmes, persistance, IP virtuelle redondante) : '
                 '<a href="/pages/procedure-loadbalancer-debian">mettre en place un load balancer nginx</a>.')
          + '<p style="margin-top:14px"><strong>Voie B — sans load balancer : basculer le DNS par '
          'script.</strong> Si les clients visent directement le serveur Web, on automatise la bascule '
          'de l’enregistrement <span class="lx-nav">A</span> avec <strong>Switch-DnsReplica.ps1</strong> '
          '(sur le DC ou le serveur Veeam) : il supprime les A existants, recrée celui vers la bonne IP '
          'avec un TTL court, vide le cache et vérifie la résolution. Idempotent — relançable sans '
          'risque.</p>'
          + cmd(SCRIPT_DNS)
          + tab(['Usage', 'Commande'],
                [['Failover', '<span class="lx-nav">.\\Switch-DnsReplica.ps1 -Mode Failover</span>'],
                 ['Failback', '<span class="lx-nav">.\\Switch-DnsReplica.ps1 -Mode Failback</span>'],
                 ['Auto (lancé par Veeam)', '<span class="lx-nav">.\\Switch-DnsReplica.ps1</span> — ping les deux IP, prend celle qui répond'],
                 ['Zone inverse (PTR)', 'ajouter <span class="lx-nav">-UpdatePtr</span> (réseau /24)']])
          + note('blue', '🔗 Brancher le script dans Veeam',
                 '<span class="lx-nav">Home ▸ Replicas ▸ Failover Plan ▸ Add VM</span> (la réplique du '
                 'serveur Web), puis renseigner le script dans <strong>Post-failover script</strong>. '
                 'Si la version de Veeam refuse un <span class="lx-nav">.ps1</span>, l’envelopper dans '
                 'un <span class="lx-nav">.bat</span> :')
          + cmd('powershell.exe -ExecutionPolicy Bypass -File "C:\\Scripts\\Switch-DnsReplica.ps1" -Mode Auto')
          + note('amber', '⚠️ À vérifier pour la voie B',
                 'RSAT DNS sur le serveur Veeam '
                 '(<span class="lx-nav">Install-WindowsFeature RSAT-DNS-Server</span>) ; le compte de '
                 'service Veeam membre de <strong>DnsAdmins</strong> sur le DC ; flux '
                 '<span class="lx-nav">ICMP</span> (mode Auto) et <span class="lx-nav">RPC/135</span> '
                 '+ ports dynamiques ouverts entre agences ; et un '
                 '<span class="lx-nav">ipconfig /flushdns</span> sur les postes pendant le test '
                 'pour ne pas tomber sur l’ancienne IP en cache.',
                 'Ne pas utiliser le mode <strong>Auto</strong> si une machine répond déjà à l’IP '
                 'cible avant la bascule : il conclurait à tort que le failover est fait. Dans ce cas, '
                 'modes explicites uniquement.')),

    etape(6, AMBRE, 'Failover, vérification, failback',
          'Basculer, valider, revenir à l’état d’origine',
          '<ol style="margin:0;padding-left:18px;line-height:1.7">'
          '<li>Vérifier qu’un <strong>point de restauration</strong> existe '
          '(<span class="lx-nav">Home ▸ Replicas</span>).</li>'
          '<li><strong>Failover</strong> : <span class="lx-nav">clic droit ▸ Failover Now</span> — la '
          'réplique démarre sur l’autre agence, avec sa nouvelle IP et son vSwitch DMZ.</li>'
          '<li><strong>Vérifier</strong> : le site répond via le load balancer '
          '(<span class="lx-nav">http://10.180.30.10</span>) — ou, en voie B, que '
          '<span class="lx-nav">www</span> résout vers la réplique.</li>'
          '<li><strong>Failback</strong> : <span class="lx-nav">Failback to production</span> puis '
          '<span class="lx-nav">Commit Failback</span> (et, en voie B, '
          '<span class="lx-nav">-Mode Failback</span>).</li></ol>'
          + note('green', '✅ Ce qu’on a prouvé',
                 'Perte d’un site → le serveur Web repart sur l’autre agence et le trafic suit, puis '
                 'retour propre à l’état initial. C’est <strong>tester sa reprise</strong> — la seule '
                 'façon de savoir qu’elle marche.')),

    etape(7, BLEU, 'Poser la politique de sauvegarde',
          'La règle 3-2-1, la rétention, le chiffrement, le test',
          tab(['Principe', 'Application'],
              [['<strong>3-2-1</strong>', '3 copies, 2 supports, 1 hors-site (la réplication vers l’autre agence assure le hors-site)'],
               ['Rétention', 'Ex. 14 points quotidiens + 4 hebdomadaires — dimensionner le disque de 300 Go'],
               ['Chiffrement', 'Mot de passe sur le job de l’AD, conservé hors du serveur'],
               ['Test de restauration', 'Restauration périodique vérifiée (fichiers + VM) — sinon ce n’est pas une sauvegarde'],
               ['Isolation', 'Serveur de sauvegarde hors domaine, comptes dédiés, segment filtré (étape 1)']])
          + note('blue', '🔗 Pour aller plus loin',
                 '<a href="/pages/procedure-sauvegarde">Sauvegarde &amp; restauration des données</a> · '
                 '<a href="/pages/procedure-sauvegarde-ad">Sauvegarde &amp; restauration d’Active Directory</a>.')),

    note('green', '🏁 À retenir',
         '<strong>Sauvegarde ≠ réplication.</strong> Et pour faire suivre le trafic au failover, le '
         'plus simple est un <strong>load balancer</strong> devant lequel le DNS ne bouge jamais — le '
         'script de bascule DNS devient un plan B. Un serveur de sauvegarde isolé (ANSSI), un '
         'réplica Linux qui pose seul son IP, et une politique 3-2-1 testée : l’infrastructure survit '
         'à la perte d’un site.'),

    note('gray', '🔗 À rapprocher',
         '<a href="/pages/procedure-veeam-hyperv">Sauvegarder une VM Hyper-V avec Veeam</a> · '
         '<a href="/pages/procedure-loadbalancer-debian">Mettre en place un load balancer</a> · '
         '<a href="/pages/procedure-vpn-ipsec-pfsense">VPN IPsec site-à-site</a>.'),
])

EXTRAIT = ('La suite du TP sauvegarde, simplifiée : durcir le serveur de sauvegarde (ANSSI), monter un '
           'job de réplication du serveur Web (re-IP + remapping), fiabiliser l’IP du réplica Linux, '
           'puis basculer le trafic — le plus simple avec un load balancer nginx (le DNS pointe une '
           'seule fois vers le répartiteur), ou sans LB avec le script PowerShell Switch-DnsReplica.ps1 '
           'branché en post-failover Veeam. Failover / failback et politique 3-2-1.')

CARTE = ('<a class="dir-card" href="/pages/procedure-veeam-replication"><div class="dc-ico">🔁</div>'
         '<div class="dc-body"><div class="dc-title">Réplication et politique de sauvegarde avec Veeam</div>'
         '<div class="dc-desc meta">Pas à pas : durcir le serveur de sauvegarde (ANSSI), répliquer le '
         'serveur Web (re-IP + remapping), fiabiliser l’IP du réplica Linux, puis basculer le trafic — '
         'load balancer nginx (le DNS ne bouge plus) ou script DNS automatisé en post-failover Veeam.</div>'
         '<div><span style="display:inline-block;font-size:10.5px;font-weight:600;color:var(--text-muted);'
         'background:var(--surface-3);border:1px solid var(--border);border-radius:999px;padding:1px 9px;'
         'margin:4px 4px 0 0">Réplication</span>'
         '<span style="display:inline-block;font-size:10.5px;font-weight:600;color:var(--text-muted);'
         'background:var(--surface-3);border:1px solid var(--border);border-radius:999px;padding:1px 9px;'
         'margin:4px 4px 0 0">Failover</span></div></div><div class="dc-go">Voir →</div></a>')


def ranger(c):
    h = c.execute("SELECT content FROM pages WHERE slug='procedures'").fetchone()[0]
    if SLUG not in h:
        m = re.search(r'<section class="pd-sec" id="sec-virtualisation">.*?</section>', h, re.S)
        bloc = m.group(0)
        fin = bloc.rindex('</div></section>')
        bloc = bloc[:fin] + CARTE + bloc[fin:]
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
    return f'index : sec-virtualisation={comptes.get("sec-virtualisation")} ; total {total}'


if __name__ == '__main__':
    c = sqlite3.connect(BASE)
    print(SLUG, ':', publier(c, SLUG, TITRE, EXTRAIT, CORPS))
    print(ranger(c).encode('ascii', 'replace').decode())
    c.commit()
    c.close()
    sys.exit(0)

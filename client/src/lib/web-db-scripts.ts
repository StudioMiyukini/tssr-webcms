/**
 * Génération des scripts du configurateur « duo web + base » (deux VM Debian
 * clonées : nginx + Node.js d'un côté, MariaDB de l'autre).
 *
 * Séparé de l'îlot React pour être testable hors navigateur : un harnais Node
 * génère les scripts et les joue dans des conteneurs Debian (systemd), ce que
 * l'interface ne permet pas.
 *
 * Ce qui a été appris en les faisant tourner, et qui explique leur forme :
 * - lancé en SSH, le changement d'IP coupe la session et tue le script à
 *   mi-chemin : il se détache donc de lui-même et journalise ;
 * - un master n'a pas toujours Internet une fois sur le commutateur du labo :
 *   on installe d'abord si le réseau courant sort, sinon on adresse d'abord ;
 * - le réseau d'un Debian est géré par ifupdown, NetworkManager ou
 *   systemd-networkd selon l'installation : on détecte, on n'impose pas ;
 * - deux clones partagent machine-id et clés SSH : on les régénère.
 */

export const MDP = 'Azerty77';

export type Hyperviseur = 'hyperv' | 'proxmox';

export type Params = {
  hv: Hyperviseur;
  master: string;
  masterId: string;
  exportPath: string;
  vhdDir: string;
  sw: string;
  copierFichiers: boolean;
  vmWeb: string;
  vmBdd: string;
  idWeb: string;
  idBdd: string;
  vcpu: string;
  ram: string;
  ipWeb: string;
  ipBdd: string;
  cidr: string;
  passerelle: string;
  dns: string;
  iface: string;
  bdd: string;
  utilisateur: string;
  nodeSource: boolean;
  mdpSysteme: boolean;
};

export type Section = { id: 'hote' | 'bdd' | 'web' | 'verif'; titre: string; code: string; fichier: string };

// Un nom de VM peut porter des majuscules et des underscores ; un nom d'hôte, non.
export const nomHote = (vm: string) => vm.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'debian';

// ---------------------------------------------------------------- bash commun --

function entete(titre: string, nomVm: string): string[] {
  return [
    '#!/usr/bin/env bash',
    `# ${titre}`,
    `# A executer DANS LA VM ${nomVm}, en root :  sudo bash ce-script.sh`,
    '# Variables acceptees :  SANS_RESEAU=1 (ne pas toucher au reseau)   IFACE=eth0 (forcer la carte)',
    '# Genere par le configurateur du site TSSR - environnement de formation : le mot de passe du labo est partout.',
    'set -euo pipefail',
    '[ "$(id -u)" -eq 0 ] || { echo "Lance-moi en root :  sudo bash $0"; exit 1; }',
    'export DEBIAN_FRONTEND=noninteractive',
    'JOURNAL=/var/log/config-vm.log',
    '',
    '# Lance depuis SSH, le changement d\'adresse couperait la session et tuerait le script a mi-chemin :',
    '# il se relance detache, journalise, et on le suit apres reconnexion sur la nouvelle adresse.',
    'if [ -n "${SSH_CONNECTION:-}" ] && [ -z "${DETACHE:-}" ] && [ -z "${SANS_RESEAU:-}" ]; then',
    '    echo "Session SSH detectee : le script continue en arriere-plan, journal dans $JOURNAL."',
    '    echo "Quand la connexion tombera, reconnecte-toi sur la nouvelle adresse puis :  tail -f $JOURNAL"',
    '    DETACHE=1 setsid nohup bash "$0" >"$JOURNAL" 2>&1 </dev/null &',
    '    sleep 1; tail -f "$JOURNAL" || true',
    '    exit 0',
    'fi',
    '',
    'etape() { echo; echo "==== $*"; }',
    'internet_ok() { timeout 5 bash -c \'exec 3<>/dev/tcp/deb.debian.org/80\' 2>/dev/null; }',
  ];
}

function identite(p: Params, nom: string): string[] {
  const r: string[] = [];
  r.push('identite() {');
  r.push(`    etape "Nom de machine : ${nom}"`);
  r.push(`    hostnamectl set-hostname ${nom} 2>/dev/null || { echo ${nom} > /etc/hostname; hostname ${nom}; }`);
  // Pas de sed -i sur /etc/hosts : sur certains systemes (conteneurs) c'est un montage a part, et le renommage echoue.
  r.push(`    if grep -q '^127\\.0\\.1\\.1' /etc/hosts; then H=$(sed "s/^127\\.0\\.1\\.1.*/127.0.1.1\\t${nom}/" /etc/hosts); printf '%s\\n' "$H" > /etc/hosts; else printf '127.0.1.1\\t%s\\n' '${nom}' >> /etc/hosts; fi`);
  r.push(`    grep -q '\\b${nomHote(p.vmWeb)}\\b' /etc/hosts || printf '%s\\t%s\\n' '${p.ipWeb}' '${nomHote(p.vmWeb)}' >> /etc/hosts`);
  r.push(`    grep -q '\\b${nomHote(p.vmBdd)}\\b' /etc/hosts || printf '%s\\t%s\\n' '${p.ipBdd}' '${nomHote(p.vmBdd)}' >> /etc/hosts`);
  r.push('    # Un clone garde l\'identite du master : on la regenere (machine-id, cles SSH).');
  r.push('    if [ -z "${DEJA_CLONE_PREPARE:-}" ] && [ ! -f /etc/.clone-prepare ]; then');
  r.push('        rm -f /etc/machine-id /var/lib/dbus/machine-id; systemd-machine-id-setup 2>/dev/null || true');
  r.push('        if [ -d /etc/ssh ] && ls /etc/ssh/ssh_host_*_key >/dev/null 2>&1; then rm -f /etc/ssh/ssh_host_*; dpkg-reconfigure -f noninteractive openssh-server 2>/dev/null || ssh-keygen -A; fi');
  r.push('        touch /etc/.clone-prepare');
  r.push('    fi');
  if (p.mdpSysteme) {
    r.push(`    # Mot de passe du labo sur root, et sur l'utilisateur 1000 s'il existe`);
    r.push(`    echo "root:${MDP}" | chpasswd`);
    r.push(`    U=$(getent passwd 1000 | cut -d: -f1 || true); [ -n "$U" ] && echo "$U:${MDP}" | chpasswd || true`);
  }
  r.push('}');
  return r;
}

function reseau(p: Params, ip: string): string[] {
  const r: string[] = [];
  r.push('reseau() {');
  // Premiere carte qui n'est pas lo ; le suffixe @ifNN (interfaces virtuelles) n'appartient pas au nom.
  r.push(`    IFACE=\${IFACE:-${p.iface || "$(ip -o link show | awk -F': ' '$2!=\"lo\"{print $2; exit}' | cut -d@ -f1)"}}`);
  r.push(`    etape "Adresse fixe ${ip}/${p.cidr} sur $IFACE (passerelle ${p.passerelle}, DNS ${p.dns})"`);
  r.push('    if systemctl is-active --quiet NetworkManager 2>/dev/null; then');
  r.push('        # --- NetworkManager (installation avec bureau) ---');
  r.push('        CON=$(nmcli -g NAME,DEVICE connection show --active 2>/dev/null | awk -F: -v d="$IFACE" \'$2==d{print $1; exit}\')');
  r.push('        [ -n "$CON" ] || { nmcli connection add type ethernet ifname "$IFACE" con-name "$IFACE" >/dev/null; CON=$IFACE; }');
  r.push(`        nmcli connection modify "$CON" ipv4.method manual ipv4.addresses "${ip}/${p.cidr}" ipv4.gateway "${p.passerelle}" ipv4.dns "${p.dns}" ipv6.method ignore`);
  r.push('        nmcli connection up "$CON" >/dev/null');
  r.push('    elif command -v ifup >/dev/null && [ -f /etc/network/interfaces ]; then');
  r.push('        # --- ifupdown (installation Debian par defaut) ---');
  r.push('        cp -n /etc/network/interfaces /etc/network/interfaces.avant-config-vm || true');
  r.push('        if grep -qs "$IFACE" /etc/network/interfaces.d/* 2>/dev/null; then mkdir -p /etc/network/interfaces.d.avant && mv /etc/network/interfaces.d/* /etc/network/interfaces.d.avant/; fi');
  r.push('        cat > /etc/network/interfaces <<EOF');
  r.push('source /etc/network/interfaces.d/*');
  r.push('');
  r.push('auto lo');
  r.push('iface lo inet loopback');
  r.push('');
  r.push('auto $IFACE');
  r.push('iface $IFACE inet static');
  r.push(`    address ${ip}/${p.cidr}`);
  r.push(`    gateway ${p.passerelle}`);
  r.push(`    dns-nameservers ${p.dns}`);
  r.push('EOF');
  r.push('        ifdown --force "$IFACE" 2>/dev/null || true');
  r.push('        pkill -f "dhclient.*$IFACE" 2>/dev/null || true');
  r.push('        ip addr flush dev "$IFACE"; ip route flush dev "$IFACE" 2>/dev/null || true');
  r.push('        ifup "$IFACE"');
  r.push(`        if systemctl is-active --quiet systemd-resolved 2>/dev/null; then resolvectl dns "$IFACE" ${p.dns}; else [ -L /etc/resolv.conf ] && rm -f /etc/resolv.conf; printf 'nameserver ${p.dns}\\n' > /etc/resolv.conf; fi`);
  r.push('    elif systemctl is-active --quiet systemd-networkd 2>/dev/null; then');
  r.push('        # --- systemd-networkd (images cloud) ---');
  r.push('        cat > "/etc/systemd/network/10-$IFACE.network" <<EOF');
  r.push('[Match]');
  r.push('Name=$IFACE');
  r.push('[Network]');
  r.push(`Address=${ip}/${p.cidr}`);
  r.push(`Gateway=${p.passerelle}`);
  r.push(`DNS=${p.dns}`);
  r.push('EOF');
  r.push('        rm -f /etc/systemd/network/*dhcp* 2>/dev/null || true');
  r.push('        networkctl reload && networkctl reconfigure "$IFACE"');
  r.push('    else');
  r.push('        echo "ERREUR: aucun gestionnaire reseau reconnu (ifupdown, NetworkManager, systemd-networkd)"; exit 1');
  r.push('    fi');
  r.push('    sleep 2');
  r.push(`    ip -4 addr show "$IFACE" | grep -q " ${ip}/" && echo "IP ${ip} appliquee sur $IFACE" || { echo "ERREUR: ${ip} n'est pas sur $IFACE"; ip -4 addr show "$IFACE"; exit 1; }`);
  r.push(`    ping -c 2 -W 2 ${p.passerelle} >/dev/null 2>&1 && echo "Passerelle ${p.passerelle} joignable" || echo "AVERTISSEMENT: passerelle ${p.passerelle} injoignable"`);
  r.push('}');
  return r;
}

// L'ordre : installer avec le reseau courant s'il sort sur Internet, sinon adresser d'abord.
function sequenceReseau(paquets: string): string[] {
  return [
    'RESEAU_FAIT=0',
    'if [ -z "${SANS_RESEAU:-}" ] && ! internet_ok; then',
    '    echo "Pas d\'acces a Internet avec la configuration actuelle : on applique d\'abord l\'adresse fixe."',
    '    reseau; RESEAU_FAIT=1',
    'fi',
    `# Sans Internet, apt ne peut rien installer - sauf si les paquets sont deja la (rejeu du script).`,
    `if ! dpkg -s ${paquets} >/dev/null 2>&1; then internet_ok || { echo "ERREUR: deb.debian.org injoignable - apt ne pourra rien installer. Verifie passerelle, DNS et commutateur (les VM ont besoin d'Internet pendant l'installation)."; exit 1; }; fi`,
  ];
}

const finReseau = () => ['[ -n "${SANS_RESEAU:-}" ] || [ "$RESEAU_FAIT" = 1 ] || reseau'];

// ---------------------------------------------------------------- les scripts --

function scriptHote(p: Params): string {
  const h: string[] = [];
  const hoteWeb = nomHote(p.vmWeb), hoteBdd = nomHote(p.vmBdd);
  if (p.hv === 'hyperv') {
    h.push('# ============================================================');
    h.push(`#  Clonage Hyper-V : ${p.master}  ->  ${p.vmWeb} (nginx + Node)  et  ${p.vmBdd} (MariaDB)`);
    h.push(`#  ${p.vcpu} vCPU - ${p.ram} Go RAM - commutateur ${p.sw}`);
    h.push("#  A executer SUR L'HOTE Hyper-V (PowerShell admin)");
    h.push('# ============================================================');
    h.push(`$Source  = '${p.master}'`);
    h.push(`$Export  = '${p.exportPath}'`);
    h.push(`$VhdDir  = '${p.vhdDir}'`);
    h.push(`$Switch  = '${p.sw}'`);
    h.push(`$Clones  = @('${p.vmWeb}', '${p.vmBdd}')`);
    h.push('$Ici     = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }   # ou se trouvent les .sh telecharges');
    h.push('');
    h.push('if (-not (Get-VM -Name $Source -ErrorAction SilentlyContinue)) { throw "VM source $Source introuvable (Get-VM pour lister)" }');
    h.push("if (-not (Get-VMSwitch -Name $Switch -ErrorAction SilentlyContinue)) { New-VMSwitch -Name $Switch -SwitchType Private | Out-Null; Write-Warning \"Commutateur $Switch cree en PRIVE : sans passerelle, les VM n'auront pas Internet\" }");
    h.push("if ((Get-VM -Name $Source).State -ne 'Off') { Stop-VM -Name $Source -Force }   # un master s'exporte eteint");
    h.push('New-Item -ItemType Directory -Force -Path $Export, $VhdDir | Out-Null');
    h.push('');
    h.push('foreach ($Clone in $Clones) {');
    h.push('    if (Get-VM -Name $Clone -ErrorAction SilentlyContinue) { Write-Warning "$Clone existe deja, ignoree"; continue }');
    h.push('    Write-Output "Clonage de $Source vers $Clone..."');
    h.push('    $ExportDir = Join-Path $Export "$Source-vers-$Clone"');
    h.push('    if (Test-Path $ExportDir) { Remove-Item -Path $ExportDir -Recurse -Force }   # reste d\'un essai precedent');
    h.push('    Export-VM -Name $Source -Path $ExportDir');
    h.push('    $Vmcx = Get-ChildItem -Path (Join-Path $ExportDir "$Source\\Virtual Machines") -Filter *.vmcx | Select-Object -First 1');
    h.push('    $ConfigDir = Join-Path $VhdDir $Clone');
    h.push("    $New = Import-VM -Path $Vmcx.FullName -Copy -GenerateNewId -VirtualMachinePath $ConfigDir -VhdDestinationPath (Join-Path $ConfigDir 'VHDX')");
    h.push('    Rename-VM -VM $New -NewName $Clone');
    h.push('    Set-VM          -Name $Clone -Notes "Clone de $Source - $(Get-Date -Format yyyy-MM-dd)"');
    h.push(`    Set-VMProcessor -VMName $Clone -Count ${p.vcpu || '2'}`);
    h.push(`    Set-VMMemory    -VMName $Clone -StartupBytes ${p.ram || '2'}GB`);
    h.push('    Get-VMNetworkAdapter -VMName $Clone | Connect-VMNetworkAdapter -SwitchName $Switch');
    h.push("    Enable-VMIntegrationService -VMName $Clone -Name 'Guest Service Interface'");
    h.push('    Remove-Item -Path $ExportDir -Recurse -Force');
    h.push('    Start-VM -Name $Clone');
    h.push('    Write-Output "Clone pret : $Clone"');
    h.push('}');
    if (p.copierFichiers) {
      h.push('');
      h.push("# --- Deposer les scripts (2) et (3) dans les VM sans reseau, par les services d'integration ---");
      h.push('#     Necessite hyperv-daemons dans le master (service hv-fcopy-daemon). Sinon : copie par scp, ou');
      h.push("#     coller le script dans la console :  cat > /root/web.sh <<'FIN'  ...  FIN");
      h.push('Write-Output "Attente du demarrage des VM (60 s)..."; Start-Sleep -Seconds 60');
      h.push(`$Fichiers = @{ '${p.vmBdd}' = @('bdd-${hoteBdd}.sh', '/root/bdd.sh'); '${p.vmWeb}' = @('web-${hoteWeb}.sh', '/root/web.sh') }`);
      h.push('foreach ($Clone in $Fichiers.Keys) {');
      h.push('    $Src = Join-Path $Ici $Fichiers[$Clone][0]');
      h.push('    if (-not (Test-Path $Src)) { Write-Warning "$Src introuvable : telecharge le .sh depuis la page, dans le dossier du script"; continue }');
      h.push('    try {');
      h.push('        Copy-VMFile -Name $Clone -SourcePath $Src -DestinationPath $Fichiers[$Clone][1] -FileSource Host -CreateFullPath -Force -ErrorAction Stop');
      h.push('        Write-Output "$($Fichiers[$Clone][0]) depose dans $Clone : $($Fichiers[$Clone][1])"');
      h.push('    } catch { Write-Warning "Copie vers $Clone impossible ($($_.Exception.Message)) : hv-fcopy-daemon absent ? Copie le script par scp ou colle-le dans la console." }');
      h.push('}');
      h.push('Write-Output "Puis, dans chaque VM :  sudo bash /root/bdd.sh   (d\'abord)   et   sudo bash /root/web.sh"');
    }
  } else {
    h.push('# ============================================================');
    h.push(`#  Clonage Proxmox VE : ${p.master} (VMID ${p.masterId})  ->  ${hoteWeb} (${p.idWeb})  et  ${hoteBdd} (${p.idBdd})`);
    h.push(`#  ${p.vcpu} vCPU - ${p.ram} Go RAM - pont ${p.sw}`);
    h.push("#  A executer SUR L'HOTE Proxmox (shell root). Les noms de VM Proxmox sont des noms DNS : pas d'underscore.");
    h.push('# ============================================================');
    h.push('set -e');
    h.push(`qm status ${p.masterId} >/dev/null 2>&1 || { echo "VMID ${p.masterId} (master) introuvable : qm list"; exit 1; }`);
    h.push(`[ "$(qm status ${p.masterId} | awk '{print $2}')" = stopped ] || qm shutdown ${p.masterId} --timeout 60   # un master se clone eteint`);
    for (const [nom, id] of [[hoteWeb, p.idWeb], [hoteBdd, p.idBdd]] as const) {
      h.push(`qm status ${id} >/dev/null 2>&1 && { echo "VMID ${id} existe deja"; exit 1; }`);
      h.push(`qm clone ${p.masterId} ${id} --name ${nom} --full`);
      h.push(`qm set ${id} --cores ${p.vcpu || '2'} --memory ${(Number(p.ram) || 2) * 1024} --net0 virtio,bridge=${p.sw}`);
      h.push(`qm start ${id}`);
    }
    h.push('echo "Clones prets. Console de chaque VM (ou scp des .sh), puis :  sudo bash /root/bdd.sh  et  sudo bash /root/web.sh"');
  }
  return h.join('\n');
}

function scriptBdd(p: Params): string {
  const hoteBdd = nomHote(p.vmBdd);
  const b: string[] = [
    ...entete(`VM base de donnees : ${p.vmBdd} (${p.ipBdd}) - MariaDB`, p.vmBdd),
    ...identite(p, hoteBdd),
    ...reseau(p, p.ipBdd),
    '',
    'identite',
    ...sequenceReseau('mariadb-server'),
    '',
    'etape "Installation de MariaDB"',
    'apt-get update -q && apt-get install -y -q mariadb-server',
    'systemctl enable --now mariadb',
    '',
    "etape \"MariaDB ecoute sur le reseau (par defaut : 127.0.0.1 seulement)\"",
    "CNF=/etc/mysql/mariadb.conf.d/50-server.cnf",
    "grep -q '^bind-address' \"$CNF\" && sed -i 's/^bind-address\\s*=.*/bind-address = 0.0.0.0/' \"$CNF\" || printf '[mysqld]\\nbind-address = 0.0.0.0\\n' >> \"$CNF\"",
    'systemctl restart mariadb',
    '',
    `etape "Compte root, base ${p.bdd}, utilisateur ${p.utilisateur} autorise depuis ${p.ipWeb} seulement"`,
    // Premier passage : root entre par le socket ; rejeu apres un ancien script : par le mot de passe.
    `if mysql -e 'SELECT 1' >/dev/null 2>&1; then MY=(mysql); else MY=(mysql -u root -p'${MDP}'); fi`,
    '"${MY[@]}" <<SQL',
    // root garde l'acces par socket (sudo mysql, et le rejeu du script) ET recoit le mot de passe du labo.
    `ALTER USER 'root'@'localhost' IDENTIFIED VIA unix_socket OR mysql_native_password USING PASSWORD('${MDP}');`,
    "DROP USER IF EXISTS ''@'localhost';",
    'DROP DATABASE IF EXISTS test;',
    `CREATE DATABASE IF NOT EXISTS \\\`${p.bdd}\\\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
    `CREATE USER IF NOT EXISTS '${p.utilisateur}'@'${p.ipWeb}' IDENTIFIED BY '${MDP}';`,
    `ALTER USER '${p.utilisateur}'@'${p.ipWeb}' IDENTIFIED BY '${MDP}';`,
    `GRANT ALL PRIVILEGES ON \\\`${p.bdd}\\\`.* TO '${p.utilisateur}'@'${p.ipWeb}';`,
    `USE \\\`${p.bdd}\\\`;`,
    'CREATE TABLE IF NOT EXISTS messages (id INT AUTO_INCREMENT PRIMARY KEY, texte VARCHAR(200) NOT NULL UNIQUE, cree_le TIMESTAMP DEFAULT CURRENT_TIMESTAMP);',
    `INSERT IGNORE INTO messages (texte) VALUES ('Bonjour depuis ${hoteBdd} (${p.ipBdd})'), ('La connexion moteur -> base fonctionne');`,
    'FLUSH PRIVILEGES;',
    'SQL',
    '',
    `etape "Pare-feu (seulement si ufw est installe) : 3306 depuis ${p.ipWeb}, SSH"`,
    `if command -v ufw >/dev/null; then ufw allow from ${p.ipWeb} to any port 3306 proto tcp; ufw allow 22/tcp; ufw --force enable; fi`,
    '',
    ...finReseau(),
    '',
    'etape "Verification"',
    `mysql -u root -p'${MDP}' -e "SELECT User, Host FROM mysql.user WHERE User='${p.utilisateur}'; SELECT COUNT(*) AS lignes FROM \\\`${p.bdd}\\\`.messages;"`,
    "ss -tlnp | grep -q '0.0.0.0:3306' && echo \"MariaDB ecoute sur 3306\" || { echo \"ERREUR: MariaDB n'ecoute pas sur le reseau\"; ss -tlnp | grep 3306 || true; exit 1; }",
    `echo "VM base prete : ${hoteBdd} (${p.ipBdd}). Joue maintenant le script web sur ${p.vmWeb}."`,
  ];
  return b.join('\n');
}

function scriptWeb(p: Params): string {
  const hoteWeb = nomHote(p.vmWeb), hoteBdd = nomHote(p.vmBdd);
  const w: string[] = [
    ...entete(`VM web : ${p.vmWeb} (${p.ipWeb}) - nginx + Node.js, reliee a ${hoteBdd} (${p.ipBdd})`, p.vmWeb),
    ...identite(p, hoteWeb),
    ...reseau(p, p.ipWeb),
    '',
    'identite',
    ...sequenceReseau('nginx nodejs npm'),
    '',
    'etape "Installation de nginx, Node.js, npm"',
    'apt-get update -q && apt-get install -y -q nginx curl ca-certificates',
  ];
  if (p.nodeSource) {
    w.push('curl -fsSL https://deb.nodesource.com/setup_22.x | bash -    # Node.js 22 LTS (NodeSource)');
    w.push('apt-get install -y -q nodejs');
  } else {
    w.push('apt-get install -y -q nodejs npm                             # Node.js des depots Debian (18 sur Debian 12)');
  }
  w.push('node -v && npm -v');
  w.push('');
  w.push('etape "Application de test dans /srv/app"');
  w.push('install -d /srv/app');
  w.push("cat > /srv/app/package.json <<'EOF'");
  w.push('{ "name": "test-web-bdd", "private": true, "type": "module", "main": "server.js",');
  w.push('  "dependencies": { "express": "^4.19.2", "mysql2": "^3.11.0" } }');
  w.push('EOF');
  w.push('cat > /srv/app/.env <<EOF');
  w.push(`DB_HOST=${p.ipBdd}`);
  w.push('DB_PORT=3306');
  w.push(`DB_NAME=${p.bdd}`);
  w.push(`DB_USER=${p.utilisateur}`);
  w.push(`DB_PASS=${MDP}`);
  w.push('PORT=3000');
  w.push('EOF');
  w.push("cat > /srv/app/server.js <<'EOF'");
  w.push(...SERVEUR_JS.split('\n'));
  w.push('EOF');
  w.push('cd /srv/app && npm install --omit=dev --no-audit --no-fund --loglevel=error');
  w.push('chown -R www-data:www-data /srv/app && chmod 640 /srv/app/.env');
  w.push('');
  w.push('etape "Service systemd (les identifiants restent dans .env, lisible par www-data seul)"');
  w.push("cat > /etc/systemd/system/app.service <<'EOF'");
  w.push('[Unit]');
  w.push('Description=Application de test web -> base');
  w.push('After=network-online.target');
  w.push('Wants=network-online.target');
  w.push('');
  w.push('[Service]');
  w.push('User=www-data');
  w.push('Group=www-data');
  w.push('WorkingDirectory=/srv/app');
  w.push('EnvironmentFile=/srv/app/.env');
  w.push('ExecStart=/usr/bin/node /srv/app/server.js');
  w.push('Restart=on-failure');
  w.push('RestartSec=3');
  w.push('');
  w.push('[Install]');
  w.push('WantedBy=multi-user.target');
  w.push('EOF');
  w.push('systemctl daemon-reload && systemctl enable --now app && systemctl restart app');
  w.push('');
  w.push('etape "nginx en mandataire inverse vers Node (127.0.0.1:3000)"');
  w.push("cat > /etc/nginx/sites-available/app <<'EOF'");
  w.push('server {');
  w.push('    listen 80 default_server;');
  w.push('    listen [::]:80 default_server;');
  w.push(`    server_name ${hoteWeb} ${p.ipWeb} _;`);
  w.push('    location / {');
  w.push('        proxy_pass http://127.0.0.1:3000;');
  w.push('        proxy_http_version 1.1;');
  w.push('        proxy_set_header Host $host;');
  w.push('        proxy_set_header X-Real-IP $remote_addr;');
  w.push('        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;');
  w.push('    }');
  w.push('}');
  w.push('EOF');
  w.push('ln -sf /etc/nginx/sites-available/app /etc/nginx/sites-enabled/app && rm -f /etc/nginx/sites-enabled/default');
  w.push('nginx -t && systemctl enable --now nginx && systemctl reload nginx');
  w.push('if command -v ufw >/dev/null; then ufw allow 80/tcp; ufw allow 22/tcp; ufw --force enable; fi');
  w.push('');
  w.push(...finReseau());
  w.push('');
  w.push('etape "Verification : l\'application, puis la base a travers elle"');
  w.push('for i in 1 2 3 4 5; do sleep 2; systemctl is-active --quiet app && break; done');
  w.push("systemctl is-active --quiet app || { echo \"ERREUR: le service app ne demarre pas :\"; journalctl -u app -n 20 --no-pager; exit 1; }");
  w.push("CODE=$(curl -s -o /tmp/sante.json -w '%{http_code}' http://127.0.0.1/api/sante || echo 000)");
  w.push('cat /tmp/sante.json 2>/dev/null; echo');
  w.push('case "$CODE" in');
  w.push(`    200) echo "OK : affichage et connexion a la base. Ouvre http://${p.ipWeb}/ depuis un poste du reseau." ;;`);
  w.push(`    503) DETAIL=$(grep -o '"detail":"[^"]*"' /tmp/sante.json | cut -d'"' -f4)`);
  w.push(`         echo "Affichage OK, mais la base ${p.ipBdd} ne repond pas ($DETAIL)."`);
  w.push('         case "$DETAIL" in');
  w.push(`             ER_HOST_NOT_PRIVILEGED|ER_ACCESS_DENIED*) echo " -> la base n'autorise pas ${p.utilisateur} depuis cette adresse : le script base a-t-il ete genere avec l'IP web ${p.ipWeb} et joue ?" ;;`);
  w.push(`             ECONNREFUSED) echo " -> MariaDB n'ecoute pas sur le reseau : sur la base, ss -tlnp | grep 3306 (bind-address)" ;;`);
  w.push(`             ETIMEDOUT|EHOSTUNREACH|ENETUNREACH) echo " -> la VM base est injoignable : ping ${p.ipBdd}, meme sous-reseau, VM allumee ?" ;;`);
  w.push(`             ER_BAD_DB_ERROR) echo " -> la base ${p.bdd} n'existe pas : le script base a-t-il ete joue ?" ;;`);
  w.push('             *) echo " -> journalctl -u app -n 20 pour le detail" ;;');
  w.push('         esac; exit 2 ;;');
  w.push('    *)   echo "ERREUR: nginx ou l\'application ne repondent pas (HTTP $CODE) : nginx -t ; systemctl status app ; journalctl -u app -n 30"; exit 1 ;;');
  w.push('esac');
  return w.join('\n');
}

function scriptVerif(p: Params): string {
  const v: string[] = [];
  v.push('# Depuis un poste du meme reseau (Windows ou Linux)');
  v.push(`ping ${p.ipWeb}`);
  v.push(`ping ${p.ipBdd}`);
  v.push(`curl http://${p.ipWeb}/api/sante        # {"affichage":"ok","base":"ok", ...}`);
  v.push(`# Navigateur : http://${p.ipWeb}/  -> la page de test, verte si la base repond`);
  v.push('');
  v.push("# Depuis la VM web, a la main (le meme chemin que l'application) :");
  v.push(`mysql -h ${p.ipBdd} -u ${p.utilisateur} -p'${MDP}' ${p.bdd} -e 'SELECT * FROM messages;'   # apt install mariadb-client si absent`);
  v.push('journalctl -u app -n 30                 # si la page dit "base : erreur"');
  v.push('tail -f /var/log/config-vm.log          # si le script a ete lance en SSH (il tourne detache)');
  v.push('');
  v.push('# Depuis la VM base : qui est connecte, et depuis ou');
  v.push(`mysql -u root -p'${MDP}' -e 'SHOW PROCESSLIST;'`);
  return v.join('\n');
}

export function genererScripts(p: Params): Section[] {
  const hoteWeb = nomHote(p.vmWeb), hoteBdd = nomHote(p.vmBdd);
  return [
    { id: 'hote', titre: p.hv === 'hyperv' ? '① Sur l’hôte Hyper-V — cloner les deux VM' : '① Sur l’hôte Proxmox — cloner les deux VM', code: scriptHote(p), fichier: p.hv === 'hyperv' ? 'clone-web-bdd.ps1' : 'clone-web-bdd.sh' },
    { id: 'bdd', titre: `② Dans ${p.vmBdd} — MariaDB`, code: scriptBdd(p), fichier: `bdd-${hoteBdd}.sh` },
    { id: 'web', titre: `③ Dans ${p.vmWeb} — nginx + Node.js + page de test`, code: scriptWeb(p), fichier: `web-${hoteWeb}.sh` },
    { id: 'verif', titre: '④ Vérifier', code: scriptVerif(p), fichier: 'verif.txt' },
  ];
}

// L'application de test, telle qu'elle est écrite dans /srv/app/server.js.
// Elle ne fait qu'une chose : dire si elle s'affiche, et si la base répond.
export const SERVEUR_JS = `import express from 'express';
import mysql from 'mysql2/promise';
import os from 'node:os';

const { DB_HOST, DB_PORT = 3306, DB_NAME, DB_USER, DB_PASS, PORT = 3000 } = process.env;
const pool = mysql.createPool({ host: DB_HOST, port: Number(DB_PORT), database: DB_NAME, user: DB_USER, password: DB_PASS, connectTimeout: 3000, waitForConnections: true, connectionLimit: 5 });
const app = express();
const html = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function etatBase() {
  const debut = Date.now();
  try {
    const [[infos]] = await pool.query('SELECT NOW() AS heure, VERSION() AS version, DATABASE() AS base, USER() AS utilisateur');
    const [lignes] = await pool.query('SELECT id, texte, cree_le FROM messages ORDER BY id');
    return { ok: true, ms: Date.now() - debut, infos, lignes };
  } catch (e) {
    return { ok: false, ms: Date.now() - debut, erreur: e.code || e.message };
  }
}

app.get('/api/sante', async (_req, res) => {
  const b = await etatBase();
  res.status(b.ok ? 200 : 503).json({ affichage: 'ok', base: b.ok ? 'ok' : 'erreur', serveur: os.hostname(), hote_base: DB_HOST, delai_ms: b.ms, detail: b.ok ? b.infos : b.erreur });
});

app.get('/', async (_req, res) => {
  const b = await etatBase();
  const couleur = b.ok ? '#16a34a' : '#dc2626';
  const lignes = b.ok ? b.lignes.map(l => '<tr><td>' + l.id + '</td><td>' + html(l.texte) + '</td><td>' + new Date(l.cree_le).toLocaleString('fr-FR') + '</td></tr>').join('') : '';
  res.type('html').send(\`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Test web -> base</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;color:#111;background:#fff}h1{font-size:1.5rem}
.etat{display:flex;gap:12px;flex-wrap:wrap}.carte{flex:1;min-width:200px;border:1px solid #ddd;border-radius:10px;padding:14px 16px}
.carte b{display:block;font-size:.8rem;text-transform:uppercase;letter-spacing:.04em;color:#666;margin-bottom:6px}.ok{color:#16a34a}
table{border-collapse:collapse;width:100%;margin-top:14px}td,th{border:1px solid #ddd;padding:6px 10px;text-align:left;font-size:.95rem}
code{background:#f3f4f6;padding:1px 5px;border-radius:4px}</style></head><body>
<h1>Page de test — moteur web → base de données</h1>
<div class="etat">
  <div class="carte"><b>Affichage</b><span class="ok">✔ nginx → Node.js répondent</span><br><small>serveur : <code>\${html(os.hostname())}</code></small></div>
  <div class="carte"><b>Connexion à la base</b><span style="color:\${couleur}">\${b.ok ? '✔ connecté à ' + html(DB_HOST) : '✘ échec : ' + html(b.erreur)}</span><br><small>\${b.ms} ms · base <code>\${html(DB_NAME)}</code> · utilisateur <code>\${html(DB_USER)}</code></small></div>
</div>
\${b.ok ? '<p>Heure de la base : <code>' + html(b.infos.heure) + '</code> — MariaDB ' + html(b.infos.version) + '</p><table><tr><th>id</th><th>texte</th><th>créé le</th></tr>' + lignes + '</table>'
      : '<p>Vérifier : la VM base est allumée, MariaDB écoute sur 0.0.0.0:3306 (<code>ss -tlnp</code>), l’utilisateur est autorisé depuis cette adresse, le pare-feu laisse passer 3306. Journal : <code>journalctl -u app -n 30</code>.</p>'}
<p><small>Données brutes : <a href="/api/sante">/api/sante</a></small></p>
</body></html>\`);
});

app.listen(Number(PORT), '127.0.0.1', () => console.log('Application de test sur http://127.0.0.1:' + PORT + ' -> base ' + DB_HOST));
`;

/**
 * Configurateur « duo web + base » — îlot React (data-block="web-db-configurator").
 *
 * Deux VM Debian clonées depuis un master : l'une avec nginx + Node.js (le
 * moteur), l'autre avec MariaDB. Chacune reçoit une IP fixe ; le moteur est
 * relié à la base sans rien saisir (les identifiants sont écrits dans le
 * fichier d'environnement du service), et une page de test affiche l'état de
 * l'affichage et de la connexion à la base.
 *
 * Trois scripts sortent de l'outil, dans l'ordre où on les joue : l'hôte
 * (clonage), la VM base, la VM web. Le mot de passe est celui du labo,
 * « Azerty77 », partout — c'est une convention de formation, pas une pratique
 * de production, et la page le dit.
 */
import { useMemo, useState } from 'react';

const MDP = 'Azerty77';

type Hyperviseur = 'hyperv' | 'proxmox';

const champ: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' };
const mono: React.CSSProperties = { fontFamily: "ui-monospace,'Space Mono',SFMono-Regular,Menlo,Consolas,monospace" };
const etiquette: React.CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 4 };
const groupe: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface-2)', marginBottom: 14 };
const legende: React.CSSProperties = { fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const rangee: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 };
const bouton: React.CSSProperties = { padding: '6px 14px', border: '1px solid var(--accent)', borderRadius: 8, background: 'transparent', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' };
const pre: React.CSSProperties = { ...mono, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', overflowX: 'auto', fontSize: 12.5, lineHeight: 1.55, margin: 0, whiteSpace: 'pre' };

const lsGet = (k: string, d: string) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* indisponible */ } };

const IP_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const ipValide = (s: string) => IP_RE.test(s);
const reseauDe = (ip: string, cidr: number) => {
  const n = ip.split('.').map(Number).reduce((a, b) => (a << 8) + b, 0) >>> 0;
  const masque = cidr === 0 ? 0 : (0xffffffff << (32 - cidr)) >>> 0;
  return (n & masque) >>> 0;
};
const passerelleDe = (ip: string) => { const m = ip.match(/^(\d+\.\d+\.\d+)\.\d+$/); return m ? `${m[1]}.254` : ''; };
const masqueDe = (cidr: number) => { const m = cidr === 0 ? 0 : (0xffffffff << (32 - cidr)) >>> 0; return [24, 16, 8, 0].map(s => (m >>> s) & 255).join('.'); };
// Un nom de VM peut porter des majuscules et des underscores ; un nom d'hôte, non.
const nomHote = (vm: string) => vm.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'debian';

/*
 * @id     tssr.atelier.webDbConfigurator
 * @do     configurer_duo_web_bdd
 * @role   ui
 * @layer  ui
 * @human  Atelier : deux VM Debian (nginx + Node / MariaDB) clonées et reliées.
 */
export function WebDbConfigurator() {
  // --- Hôte ---
  const [hv, setHv] = useState<Hyperviseur>(() => (lsGet('wdb_hv', 'hyperv') as Hyperviseur));
  const [master, setMaster] = useState(() => lsGet('wdb_master', 'master-debian'));
  const [masterId, setMasterId] = useState(() => lsGet('wdb_masterid', '9000'));
  const [exportPath, setExportPath] = useState(() => lsGet('wdb_export', 'C:\\TEMP'));
  const [vhdDir, setVhdDir] = useState(() => lsGet('wdb_vhddir', 'C:\\Hyper-V\\VHDs'));
  const [sw, setSw] = useState(() => lsGet('wdb_sw', 'COM_private'));
  const [copierFichiers, setCopierFichiers] = useState(true);
  // --- VM ---
  const [vmWeb, setVmWeb] = useState('SRV_WEB_01');
  const [vmBdd, setVmBdd] = useState('SRV_BDD_01');
  const [idWeb, setIdWeb] = useState('201');
  const [idBdd, setIdBdd] = useState('202');
  const [vcpu, setVcpu] = useState('2');
  const [ram, setRam] = useState('2');
  // --- Réseau ---
  const [ipWeb, setIpWeb] = useState('192.168.10.21');
  const [ipBdd, setIpBdd] = useState('192.168.10.22');
  const [cidr, setCidr] = useState('24');
  const [gw, setGw] = useState('');
  const [dns, setDns] = useState('192.168.10.254');
  const [iface, setIface] = useState('');
  // --- Application ---
  const [bdd, setBdd] = useState('appdb');
  const [utilisateur, setUtilisateur] = useState('appuser');
  const [nodeSource, setNodeSource] = useState(false);
  const [mdpSysteme, setMdpSysteme] = useState(true);
  const [copie, setCopie] = useState('');

  const persist = (k: string, v: string, set: (v: string) => void) => { set(v); lsSet(k, v); };

  const cidrN = Number(cidr) || 24;
  const passerelle = gw || passerelleDe(ipWeb);
  const hoteWeb = nomHote(vmWeb);
  const hoteBdd = nomHote(vmBdd);

  // Les fautes que la syntaxe ne signale pas : c'est là qu'on perd une heure.
  const soucis = useMemo(() => {
    const s: string[] = [];
    for (const [nom, ip] of [['web', ipWeb], ['base', ipBdd], ['passerelle', passerelle], ['DNS', dns]] as const) {
      if (!ipValide(ip)) s.push(`L'adresse ${nom} « ${ip} » n'est pas une adresse IPv4.`);
    }
    if (ipValide(ipWeb) && ipValide(ipBdd)) {
      if (ipWeb === ipBdd) s.push('Les deux VM ont la même adresse : la seconde à démarrer sera injoignable.');
      else if (reseauDe(ipWeb, cidrN) !== reseauDe(ipBdd, cidrN)) s.push(`Les deux VM ne sont pas dans le même sous-réseau (/${cidr}) : le moteur ne joindra la base qu'à travers un routeur.`);
    }
    if (ipValide(ipWeb) && ipValide(passerelle) && reseauDe(ipWeb, cidrN) !== reseauDe(passerelle, cidrN)) s.push('La passerelle est hors du sous-réseau des VM : pas de sortie (apt et npm échoueront).');
    if (vmWeb.trim() === vmBdd.trim()) s.push('Les deux VM portent le même nom.');
    if (hv === 'proxmox' && idWeb === idBdd) s.push('Les deux VM Proxmox ont le même identifiant.');
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(bdd)) s.push('Le nom de la base : lettres, chiffres et _ seulement.');
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(utilisateur)) s.push('Le nom d’utilisateur MariaDB : lettres, chiffres et _ (32 caractères max).');
    return s;
  }, [ipWeb, ipBdd, passerelle, dns, cidr, cidrN, vmWeb, vmBdd, hv, idWeb, idBdd, bdd, utilisateur]);

  const sections = useMemo(() => {
    // ===== ① Hôte : clonage des deux VM =====
    const h: string[] = [];
    const vms = [[vmWeb, idWeb, 'web'], [vmBdd, idBdd, 'bdd']] as const;
    if (hv === 'hyperv') {
      h.push('# ============================================================');
      h.push(`#  Clonage Hyper-V : ${master}  ->  ${vmWeb} (nginx + Node)  et  ${vmBdd} (MariaDB)`);
      h.push(`#  ${vcpu} vCPU - ${ram} Go RAM - commutateur ${sw}`);
      h.push("#  A executer SUR L'HOTE Hyper-V (PowerShell admin)");
      h.push('# ============================================================');
      h.push(`$Source    = '${master}'`);
      h.push(`$Export    = '${exportPath}'`);
      h.push(`$VhdDir    = '${vhdDir}'`);
      h.push(`$Switch    = '${sw}'`);
      h.push(`$Clones    = @('${vmWeb}', '${vmBdd}')`);
      h.push('');
      h.push('if (-not (Get-VM -Name $Source -ErrorAction SilentlyContinue)) { throw "VM source $Source introuvable" }');
      h.push("if (-not (Get-VMSwitch -Name $Switch -ErrorAction SilentlyContinue)) { New-VMSwitch -Name $Switch -SwitchType Private | Out-Null }");
      h.push('if ((Get-VM -Name $Source).State -ne \'Off\') { Stop-VM -Name $Source -Force }   # un master s\'exporte eteint');
      h.push('');
      h.push('foreach ($Clone in $Clones) {');
      h.push('    if (Get-VM -Name $Clone -ErrorAction SilentlyContinue) { Write-Warning "$Clone existe deja, ignoree"; continue }');
      h.push('    Write-Output "Clonage de $Source vers $Clone..."');
      h.push('    $ExportDir = Join-Path $Export "$Source-$Clone"');
      h.push('    Export-VM -Name $Source -Path $ExportDir');
      h.push('    $Vmcx = Get-ChildItem -Path (Join-Path $ExportDir "$Source\\Virtual Machines") -Filter *.vmcx | Select-Object -First 1');
      h.push('    $ConfigDir = Join-Path $VhdDir $Clone');
      h.push('    $New = Import-VM -Path $Vmcx.FullName -Copy -GenerateNewId -VirtualMachinePath $ConfigDir -VhdDestinationPath (Join-Path $ConfigDir \'VHDX\')');
      h.push('    Rename-VM -VM $New -NewName $Clone');
      h.push('    Set-VM          -Name $Clone -Notes "Clone de $Source - $(Get-Date -Format yyyy-MM-dd)"');
      h.push(`    Set-VMProcessor -VMName $Clone -Count ${vcpu || '2'}`);
      h.push(`    Set-VMMemory    -VMName $Clone -StartupBytes ${ram || '2'}GB`);
      h.push('    Connect-VMNetworkAdapter -VMName $Clone -SwitchName $Switch');
      h.push('    Remove-Item -Path $ExportDir -Recurse -Force');
      h.push('    Start-VM -Name $Clone');
      h.push('    Write-Output "Clone pret : $Clone"');
      h.push('}');
      if (copierFichiers) {
        h.push('');
        h.push('# --- Deposer les scripts (2) et (3) dans les VM, sans reseau, via les services d\'integration ---');
        h.push('#     Necessite le paquet hyperv-daemons dans le master (hv_fcopy). Les .sh sont a telecharger depuis cette page.');
        h.push('Start-Sleep -Seconds 40   # le temps que les VM demarrent');
        h.push("foreach ($Clone in $Clones) { Enable-VMIntegrationService -VMName $Clone -Name 'Guest Service Interface' }");
        h.push(`Copy-VMFile -Name '${vmBdd}' -SourcePath ".\\bdd-${hoteBdd}.sh" -DestinationPath /root/bdd.sh -FileSource Host -CreateFullPath -Force`);
        h.push(`Copy-VMFile -Name '${vmWeb}' -SourcePath ".\\web-${hoteWeb}.sh" -DestinationPath /root/web.sh -FileSource Host -CreateFullPath -Force`);
        h.push('# Puis, dans chaque VM (console) :  sudo bash /root/bdd.sh   et   sudo bash /root/web.sh');
      }
    } else {
      h.push('# ============================================================');
      h.push(`#  Clonage Proxmox VE : ${master} (VMID ${masterId})  ->  ${vmWeb} (${idWeb})  et  ${vmBdd} (${idBdd})`);
      h.push(`#  ${vcpu} vCPU - ${ram} Go RAM - pont ${sw}`);
      h.push("#  A executer SUR L'HOTE Proxmox (shell root)");
      h.push('# ============================================================');
      h.push('set -e');
      for (const [nom, id] of vms) {
        h.push(`qm status ${id} >/dev/null 2>&1 && { echo "VMID ${id} existe deja"; exit 1; }`);
        h.push(`qm clone ${masterId} ${id} --name ${nom} --full`);
        h.push(`qm set ${id} --cores ${vcpu || '2'} --memory ${(Number(ram) || 2) * 1024} --net0 virtio,bridge=${sw}`);
        h.push(`qm start ${id}`);
      }
      h.push('echo "Clones prets. Ouvrir la console de chaque VM et jouer les scripts (2) puis (3)."');
    }

    // ===== préambule commun aux deux VM : IP fixe, nom, mot de passe =====
    const reseau = (nom: string, ip: string) => {
      const r: string[] = [];
      r.push('# --- Nom de la machine ---');
      r.push(`hostnamectl set-hostname ${nom}`);
      r.push(`sed -i "s/^127\\.0\\.1\\.1.*/127.0.1.1\\t${nom}/" /etc/hosts; grep -q '^127\\.0\\.1\\.1' /etc/hosts || echo -e "127.0.1.1\\t${nom}" >> /etc/hosts`);
      r.push(`grep -q '${hoteWeb}' /etc/hosts || printf '%s\\t%s\\n' '${ipWeb}' '${hoteWeb}' >> /etc/hosts`);
      r.push(`grep -q '${hoteBdd}' /etc/hosts || printf '%s\\t%s\\n' '${ipBdd}' '${hoteBdd}' >> /etc/hosts`);
      if (mdpSysteme) {
        r.push(`# --- Mot de passe du labo sur root (et sur l'utilisateur 1000 s'il existe) ---`);
        r.push(`echo "root:${MDP}" | chpasswd`);
        r.push(`U=$(getent passwd 1000 | cut -d: -f1 || true); [ -n "$U" ] && echo "$U:${MDP}" | chpasswd || true`);
      }
      r.push('# --- Adresse IP fixe (/etc/network/interfaces) ---');
      r.push(iface ? `IFACE=${iface}` : "IFACE=$(ip -o link show | awk -F': ' '$2!=\"lo\"{print $2; exit}')   # premiere carte : eth0, ens33...");
      r.push('cp /etc/network/interfaces /etc/network/interfaces.bak-$(date +%F)');
      r.push('cat > /etc/network/interfaces <<EOF');
      r.push('source /etc/network/interfaces.d/*');
      r.push('');
      r.push('auto lo');
      r.push('iface lo inet loopback');
      r.push('');
      r.push('auto $IFACE');
      r.push('iface $IFACE inet static');
      r.push(`    address ${ip}/${cidr}`);
      r.push(`    gateway ${passerelle}`);
      r.push(`    dns-nameservers ${dns}`);
      r.push('EOF');
      r.push(`printf 'nameserver ${dns}\\n' > /etc/resolv.conf`);
      r.push('# Un master clone garde parfois un bail DHCP en memoire : on repart de zero sur la carte.');
      r.push('systemctl disable --now NetworkManager 2>/dev/null || true');
      r.push('ifdown "$IFACE" 2>/dev/null || true; ip addr flush dev "$IFACE"; ifup "$IFACE"');
      r.push(`ip -4 addr show "$IFACE" | grep -q '${ip}/' && echo "IP ${ip} appliquee sur $IFACE" || { echo "ERREUR: IP non appliquee"; exit 1; }`);
      r.push(`ping -c 2 -W 2 ${passerelle} >/dev/null && echo "Passerelle ${passerelle} joignable" || echo "AVERTISSEMENT: passerelle injoignable (apt aura besoin d'Internet)"`);
      return r;
    };
    const entete = (titre: string, nom: string) => [
      '#!/usr/bin/env bash',
      `# ${titre}`,
      `# A executer DANS LA VM ${nom} : sudo bash ce-script.sh`,
      '# Genere par le configurateur du site TSSR - environnement de formation (mot de passe du labo partout).',
      'set -euo pipefail',
      '[ "$(id -u)" -eq 0 ] || { echo "Lance-moi en root : sudo bash $0"; exit 1; }',
      'export DEBIAN_FRONTEND=noninteractive',
    ];

    // ===== ② VM base : MariaDB =====
    const b: string[] = [...entete(`VM base de donnees : ${vmBdd} (${ipBdd}) - MariaDB`, vmBdd), ...reseau(hoteBdd, ipBdd)];
    b.push('# --- MariaDB ---');
    b.push('apt-get update && apt-get install -y mariadb-server');
    b.push('systemctl enable --now mariadb');
    b.push(`# Ecouter sur l'adresse de la VM (par defaut MariaDB n'ecoute que 127.0.0.1)`);
    b.push(`sed -i 's/^bind-address\\s*=.*/bind-address = 0.0.0.0/' /etc/mysql/mariadb.conf.d/50-server.cnf`);
    b.push('systemctl restart mariadb');
    b.push(`# Compte root (mot de passe du labo), base et utilisateur applicatif accessible DEPUIS LA VM WEB SEULEMENT`);
    b.push('mysql <<SQL');
    b.push(`ALTER USER 'root'@'localhost' IDENTIFIED VIA mysql_native_password USING PASSWORD('${MDP}');`);
    b.push("DELETE FROM mysql.user WHERE User='';");
    b.push("DROP DATABASE IF EXISTS test;");
    b.push(`CREATE DATABASE IF NOT EXISTS \\\`${bdd}\\\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    b.push(`CREATE USER IF NOT EXISTS '${utilisateur}'@'${ipWeb}' IDENTIFIED BY '${MDP}';`);
    b.push(`GRANT ALL PRIVILEGES ON \\\`${bdd}\\\`.* TO '${utilisateur}'@'${ipWeb}';`);
    b.push(`USE \\\`${bdd}\\\`;`);
    b.push('CREATE TABLE IF NOT EXISTS messages (id INT AUTO_INCREMENT PRIMARY KEY, texte VARCHAR(200) NOT NULL UNIQUE, cree_le TIMESTAMP DEFAULT CURRENT_TIMESTAMP);');
    b.push(`INSERT IGNORE INTO messages (texte) VALUES ('Bonjour depuis ${hoteBdd} (${ipBdd})'), ('La connexion moteur -> base fonctionne');`);
    b.push('FLUSH PRIVILEGES;');
    b.push('SQL');
    b.push('# --- Pare-feu (si ufw est present) : 3306 depuis la VM web uniquement ---');
    b.push(`command -v ufw >/dev/null && { ufw allow from ${ipWeb} to any port 3306 proto tcp; ufw allow 22/tcp; ufw --force enable; } || true`);
    b.push('# --- Verification ---');
    b.push(`mysql -u root -p'${MDP}' -e "SELECT User, Host FROM mysql.user WHERE User='${utilisateur}'; SELECT COUNT(*) AS lignes FROM \\\`${bdd}\\\`.messages;"`);
    b.push(`ss -tlnp | grep -q ':3306' && echo "MariaDB ecoute sur 3306 - VM base prete : ${ipBdd}" || echo "ERREUR: MariaDB n'ecoute pas"`);

    // ===== ③ VM web : nginx + Node =====
    const w: string[] = [...entete(`VM web : ${vmWeb} (${ipWeb}) - nginx + Node.js, reliee a ${hoteBdd}`, vmWeb), ...reseau(hoteWeb, ipWeb)];
    w.push('# --- nginx + Node.js ---');
    w.push('apt-get update && apt-get install -y nginx curl ca-certificates');
    if (nodeSource) {
      w.push('curl -fsSL https://deb.nodesource.com/setup_22.x | bash -    # Node.js 22 LTS (NodeSource)');
      w.push('apt-get install -y nodejs');
    } else {
      w.push('apt-get install -y nodejs npm                                # Node.js des depots Debian (18 sur Debian 12)');
    }
    w.push('node -v && npm -v');
    w.push('# --- L\'application de test : /srv/app ---');
    w.push('install -d -o www-data -g www-data /srv/app');
    w.push('cat > /srv/app/package.json <<\'EOF\'');
    w.push('{ "name": "test-web-bdd", "private": true, "type": "module", "main": "server.js",');
    w.push('  "dependencies": { "express": "^4.19.2", "mysql2": "^3.11.0" } }');
    w.push('EOF');
    w.push('cat > /srv/app/.env <<EOF');
    w.push(`DB_HOST=${ipBdd}`);
    w.push('DB_PORT=3306');
    w.push(`DB_NAME=${bdd}`);
    w.push(`DB_USER=${utilisateur}`);
    w.push(`DB_PASS=${MDP}`);
    w.push('PORT=3000');
    w.push('EOF');
    w.push('chmod 640 /srv/app/.env && chown www-data:www-data /srv/app/.env');
    w.push("cat > /srv/app/server.js <<'EOF'");
    w.push(...SERVEUR_JS.split('\n'));
    w.push('EOF');
    w.push('cd /srv/app && npm install --omit=dev --no-audit --no-fund && chown -R www-data:www-data /srv/app');
    w.push('# --- Service systemd (les identifiants restent dans .env, lisible par www-data seulement) ---');
    w.push("cat > /etc/systemd/system/app.service <<'EOF'");
    w.push('[Unit]');
    w.push('Description=Application de test web -> base');
    w.push('After=network-online.target');
    w.push('Wants=network-online.target');
    w.push('[Service]');
    w.push('User=www-data');
    w.push('WorkingDirectory=/srv/app');
    w.push('EnvironmentFile=/srv/app/.env');
    w.push('ExecStart=/usr/bin/node /srv/app/server.js');
    w.push('Restart=on-failure');
    w.push('[Install]');
    w.push('WantedBy=multi-user.target');
    w.push('EOF');
    w.push('systemctl daemon-reload && systemctl enable --now app');
    w.push('# --- nginx : mandataire inverse vers Node sur 127.0.0.1:3000 ---');
    w.push("cat > /etc/nginx/sites-available/app <<'EOF'");
    w.push('server {');
    w.push('    listen 80 default_server;');
    w.push(`    server_name ${hoteWeb} ${ipWeb};`);
    w.push('    location / {');
    w.push('        proxy_pass http://127.0.0.1:3000;');
    w.push('        proxy_set_header Host $host;');
    w.push('        proxy_set_header X-Real-IP $remote_addr;');
    w.push('        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;');
    w.push('    }');
    w.push('}');
    w.push('EOF');
    w.push('ln -sf /etc/nginx/sites-available/app /etc/nginx/sites-enabled/app && rm -f /etc/nginx/sites-enabled/default');
    w.push('nginx -t && systemctl enable --now nginx && systemctl reload nginx');
    w.push(`command -v ufw >/dev/null && { ufw allow 80/tcp; ufw allow 22/tcp; ufw --force enable; } || true`);
    w.push('# --- Verification : la connexion a la base, puis la page ---');
    w.push('sleep 2');
    w.push(`curl -fsS http://127.0.0.1/api/sante || { echo "ERREUR: l'application ne repond pas - journalctl -u app -n 30"; exit 1; }`);
    w.push('echo');
    w.push(`echo "VM web prete : ouvre http://${ipWeb}/ depuis un poste du reseau ${ipWeb.replace(/\.\d+$/, '.0')}/${cidr}"`);

    // ===== ④ Depuis un poste : vérifications =====
    const v: string[] = [];
    v.push(`# Depuis un poste du meme reseau (Windows ou Linux)`);
    v.push(`ping ${ipWeb}`);
    v.push(`ping ${ipBdd}`);
    v.push(`curl http://${ipWeb}/api/sante          # {"affichage":"ok","base":"ok", ...}`);
    v.push(`# Navigateur : http://${ipWeb}/  -> la page de test, verte si la base repond`);
    v.push('');
    v.push(`# Depuis la VM web, a la main (le meme chemin que l'application) :`);
    v.push(`mysql -h ${ipBdd} -u ${utilisateur} -p'${MDP}' ${bdd} -e 'SELECT * FROM messages;'`);
    v.push('journalctl -u app -n 30        # si la page dit "base : erreur"');
    v.push('');
    v.push(`# Depuis la VM base : qui est connecte`);
    v.push(`mysql -u root -p'${MDP}' -e 'SHOW PROCESSLIST;'`);

    return [
      { id: 'hote', titre: hv === 'hyperv' ? '① Sur l’hôte Hyper-V — cloner les deux VM' : '① Sur l’hôte Proxmox — cloner les deux VM', code: h.join('\n'), fichier: hv === 'hyperv' ? 'clone-web-bdd.ps1' : 'clone-web-bdd.sh' },
      { id: 'bdd', titre: `② Dans ${vmBdd} — MariaDB`, code: b.join('\n'), fichier: `bdd-${hoteBdd}.sh` },
      { id: 'web', titre: `③ Dans ${vmWeb} — nginx + Node.js + page de test`, code: w.join('\n'), fichier: `web-${hoteWeb}.sh` },
      { id: 'verif', titre: '④ Vérifier', code: v.join('\n'), fichier: 'verif.txt' },
    ];
  }, [hv, master, masterId, exportPath, vhdDir, sw, copierFichiers, vmWeb, vmBdd, idWeb, idBdd, vcpu, ram, ipWeb, ipBdd, cidr, passerelle, dns, iface, bdd, utilisateur, nodeSource, mdpSysteme, hoteWeb, hoteBdd]);

  const copier = (id: string, texte: string) => {
    navigator.clipboard?.writeText(texte).then(() => { setCopie(id); setTimeout(() => setCopie(''), 1600); }).catch(() => { /* le texte reste sélectionnable */ });
  };
  const telecharger = (texte: string, nom: string) => {
    // BOM pour PowerShell (accents dans les commentaires) ; jamais de BOM ni de CRLF dans un script bash.
    const ps = nom.endsWith('.ps1');
    const blob = new Blob([ps ? '\uFEFF' + texte : texte.replace(/\r\n/g, '\n') + '\n'], { type: ps ? 'text/plain;charset=utf-8' : 'text/x-shellscript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nom; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  return (
    <div style={{ margin: '14px 0' }}>
      {/* Hôte */}
      <div style={groupe}>
        <div style={legende}>🧬 Hôte et master</div>
        <div style={rangee}>
          <div>
            <label style={etiquette}>Hyperviseur</label>
            <select style={champ} value={hv} onChange={e => persist('wdb_hv', e.target.value, v => setHv(v as Hyperviseur))}>
              <option value="hyperv">Hyper-V (Export / Import)</option>
              <option value="proxmox">Proxmox VE (qm clone)</option>
            </select>
          </div>
          <div>
            <label style={etiquette}>VM master à cloner</label>
            <input style={{ ...champ, ...mono }} value={master} onChange={e => persist('wdb_master', e.target.value, setMaster)} placeholder="master-debian" />
          </div>
          {hv === 'proxmox' && (
            <div>
              <label style={etiquette}>VMID du master</label>
              <input style={champ} value={masterId} onChange={e => persist('wdb_masterid', e.target.value.replace(/\D/g, ''), setMasterId)} />
            </div>
          )}
          <div>
            <label style={etiquette}>{hv === 'hyperv' ? 'Commutateur virtuel' : 'Pont (bridge)'}</label>
            <input style={champ} value={sw} onChange={e => persist('wdb_sw', e.target.value, setSw)} placeholder={hv === 'hyperv' ? 'COM_private' : 'vmbr0'} />
          </div>
          <div>
            <label style={etiquette}>vCPU par VM</label>
            <input type="number" min={1} style={champ} value={vcpu} onChange={e => setVcpu(e.target.value)} />
          </div>
          <div>
            <label style={etiquette}>RAM par VM (Go)</label>
            <input type="number" min={1} style={champ} value={ram} onChange={e => setRam(e.target.value)} />
          </div>
        </div>
        {hv === 'hyperv' && (
          <div style={{ ...rangee, marginTop: 10 }}>
            <div>
              <label style={etiquette}>Dossier d’export temporaire</label>
              <input style={champ} value={exportPath} onChange={e => persist('wdb_export', e.target.value, setExportPath)} />
            </div>
            <div>
              <label style={etiquette}>Dossier des VM clonées</label>
              <input style={champ} value={vhdDir} onChange={e => persist('wdb_vhddir', e.target.value, setVhdDir)} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer', alignSelf: 'end', paddingBottom: 8 }}>
              <input type="checkbox" checked={copierFichiers} onChange={e => setCopierFichiers(e.target.checked)} />
              Déposer les scripts dans les VM (Copy-VMFile)
            </label>
          </div>
        )}
        <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>💾 Hyperviseur, master, dossiers et commutateur sont mémorisés dans ce navigateur. Les VM ont besoin d’<strong>Internet pendant l’installation</strong> (apt, npm) : un commutateur externe, ou un pare-feu de labo sur le réseau privé.</div>
      </div>

      <div style={rangee}>
        {/* VM web */}
        <div style={groupe}>
          <div style={legende}>🟢 VM 1 — moteur (nginx + Node.js)</div>
          <label style={etiquette}>Nom de la VM</label>
          <input style={{ ...champ, ...mono }} value={vmWeb} onChange={e => setVmWeb(e.target.value)} />
          <div style={{ ...rangee, marginTop: 10 }}>
            <div>
              <label style={etiquette}>Adresse IP</label>
              <input style={{ ...champ, ...mono }} value={ipWeb} onChange={e => setIpWeb(e.target.value)} />
            </div>
            {hv === 'proxmox' && (
              <div>
                <label style={etiquette}>VMID</label>
                <input style={champ} value={idWeb} onChange={e => setIdWeb(e.target.value.replace(/\D/g, ''))} />
              </div>
            )}
          </div>
          <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>Nom d’hôte Linux : <code>{hoteWeb}</code></div>
        </div>
        {/* VM base */}
        <div style={groupe}>
          <div style={legende}>🟣 VM 2 — base de données (MariaDB)</div>
          <label style={etiquette}>Nom de la VM</label>
          <input style={{ ...champ, ...mono }} value={vmBdd} onChange={e => setVmBdd(e.target.value)} />
          <div style={{ ...rangee, marginTop: 10 }}>
            <div>
              <label style={etiquette}>Adresse IP</label>
              <input style={{ ...champ, ...mono }} value={ipBdd} onChange={e => setIpBdd(e.target.value)} />
            </div>
            {hv === 'proxmox' && (
              <div>
                <label style={etiquette}>VMID</label>
                <input style={champ} value={idBdd} onChange={e => setIdBdd(e.target.value.replace(/\D/g, ''))} />
              </div>
            )}
          </div>
          <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>Nom d’hôte Linux : <code>{hoteBdd}</code></div>
        </div>
      </div>

      {/* Réseau commun */}
      <div style={groupe}>
        <div style={legende}>🌐 Réseau (commun aux deux VM)</div>
        <div style={rangee}>
          <div>
            <label style={etiquette}>Masque (CIDR)</label>
            <select style={champ} value={cidr} onChange={e => setCidr(e.target.value)}>
              {[16, 22, 23, 24, 25, 26, 27, 28].map(c => <option key={c} value={String(c)}>/{c} — {masqueDe(c)}</option>)}
            </select>
          </div>
          <div>
            <label style={etiquette}>Passerelle {!gw && <span className="meta" style={{ fontWeight: 400 }}>(auto .254)</span>}</label>
            <input style={{ ...champ, ...mono }} value={passerelle} onChange={e => setGw(e.target.value)} />
          </div>
          <div>
            <label style={etiquette}>DNS</label>
            <input style={{ ...champ, ...mono }} value={dns} onChange={e => setDns(e.target.value)} />
          </div>
          <div>
            <label style={etiquette}>Carte réseau {!iface && <span className="meta" style={{ fontWeight: 400 }}>(auto-détectée)</span>}</label>
            <input style={{ ...champ, ...mono }} value={iface} onChange={e => setIface(e.target.value.trim())} placeholder="eth0" />
          </div>
        </div>
      </div>

      {/* Application */}
      <div style={groupe}>
        <div style={legende}>🗄️ Base et identifiants</div>
        <div style={rangee}>
          <div>
            <label style={etiquette}>Base de données</label>
            <input style={{ ...champ, ...mono }} value={bdd} onChange={e => setBdd(e.target.value)} />
          </div>
          <div>
            <label style={etiquette}>Utilisateur MariaDB</label>
            <input style={{ ...champ, ...mono }} value={utilisateur} onChange={e => setUtilisateur(e.target.value)} />
          </div>
          <div>
            <label style={etiquette}>Mot de passe (labo)</label>
            <input style={{ ...champ, ...mono, fontWeight: 700, color: 'var(--accent)' }} value={MDP} readOnly title="Convention du labo : le même mot de passe partout" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer' }}>
            <input type="checkbox" checked={mdpSysteme} onChange={e => setMdpSysteme(e.target.checked)} />
            Mettre aussi « {MDP} » sur root et l’utilisateur Linux des deux VM
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer' }}>
            <input type="checkbox" checked={nodeSource} onChange={e => setNodeSource(e.target.checked)} />
            Node.js 22 LTS (NodeSource) plutôt que celui de Debian
          </label>
        </div>
        <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>L’utilisateur <code>{utilisateur}</code> n’est autorisé que <strong>depuis {ipWeb}</strong> : la base n’accepte le moteur, et personne d’autre. Le mot de passe vit dans <code>/srv/app/.env</code> (lisible par www-data seulement), jamais dans le code.</div>
      </div>

      {soucis.length > 0 && (
        <aside className="pb-note pb-note-red" style={{ marginBottom: 14 }}>
          <p className="pb-note-title">🚫 À corriger avant de copier</p>
          <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>{soucis.map(s => <li key={s}>{s}</li>)}</ul>
        </aside>
      )}

      {/* Sorties */}
      {sections.map(sec => (
        <div key={sec.id} style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 6px', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>📜 {sec.titre}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {sec.id !== 'verif' && (
                <button type="button" onClick={() => telecharger(sec.code, sec.fichier)} style={{ ...bouton, borderColor: 'var(--border)', color: 'var(--text)' }} title={`Télécharger ${sec.fichier}`}>💾 {sec.fichier.replace(/^.*\./, '.')}</button>
              )}
              <button type="button" onClick={() => copier(sec.id, sec.code)} style={{ ...bouton, background: copie === sec.id ? 'var(--accent)' : 'transparent', color: copie === sec.id ? '#fff' : 'var(--accent)' }}>
                {copie === sec.id ? '✓ Copié' : 'Copier'}
              </button>
            </div>
          </div>
          <pre style={pre}><code>{sec.code}</code></pre>
        </div>
      ))}
    </div>
  );
}

// L'application de test, telle qu'elle est écrite dans /srv/app/server.js.
// Elle ne fait qu'une chose : dire si elle s'affiche, et si la base répond.
const SERVEUR_JS = `import express from 'express';
import mysql from 'mysql2/promise';
import os from 'node:os';

const { DB_HOST, DB_PORT = 3306, DB_NAME, DB_USER, DB_PASS, PORT = 3000 } = process.env;
const pool = mysql.createPool({ host: DB_HOST, port: Number(DB_PORT), database: DB_NAME, user: DB_USER, password: DB_PASS, connectTimeout: 3000, waitForConnections: true, connectionLimit: 5 });
const app = express();

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
  const lignes = b.ok ? b.lignes.map(l => '<tr><td>' + l.id + '</td><td>' + l.texte + '</td><td>' + new Date(l.cree_le).toLocaleString('fr-FR') + '</td></tr>').join('') : '';
  res.type('html').send(\`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Test web -> base</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;color:#111}h1{font-size:1.5rem}
.etat{display:flex;gap:12px;flex-wrap:wrap}.carte{flex:1;min-width:200px;border:1px solid #ddd;border-radius:10px;padding:14px 16px}
.carte b{display:block;font-size:.8rem;text-transform:uppercase;letter-spacing:.04em;color:#666;margin-bottom:6px}.ok{color:#16a34a}.ko{color:#dc2626}
table{border-collapse:collapse;width:100%;margin-top:14px}td,th{border:1px solid #ddd;padding:6px 10px;text-align:left;font-size:.95rem}
code{background:#f3f4f6;padding:1px 5px;border-radius:4px}</style></head><body>
<h1>Page de test — moteur web → base de données</h1>
<div class="etat">
  <div class="carte"><b>Affichage</b><span class="ok">✔ nginx → Node.js répondent</span><br><small>serveur : <code>\${os.hostname()}</code></small></div>
  <div class="carte"><b>Connexion à la base</b><span style="color:\${couleur}">\${b.ok ? '✔ connecté à ' + DB_HOST : '✘ échec : ' + b.erreur}</span><br><small>\${b.ms} ms · base <code>\${DB_NAME}</code> · utilisateur <code>\${DB_USER}</code></small></div>
</div>
\${b.ok ? '<p>Heure de la base : <code>' + b.infos.heure + '</code> — MariaDB ' + b.infos.version + '</p><table><tr><th>id</th><th>texte</th><th>créé le</th></tr>' + lignes + '</table>'
      : '<p>Vérifier : la VM base est allumée, MariaDB écoute sur 0.0.0.0:3306 (<code>ss -tlnp</code>), l’utilisateur est autorisé depuis cette adresse, le pare-feu laisse passer 3306. Journal : <code>journalctl -u app -n 30</code>.</p>'}
<p><small>Données brutes : <a href="/api/sante">/api/sante</a></small></p>
</body></html>\`);
});

app.listen(Number(PORT), '127.0.0.1', () => console.log('Application de test sur http://127.0.0.1:' + PORT + ' -> base ' + DB_HOST));
`;

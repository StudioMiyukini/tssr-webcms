/**
 * Génération des scripts du configurateur « bastion » : une VM Debian clonée
 * depuis le master, seule porte d'entrée SSH vers les serveurs du labo.
 *
 * Le bastion ne détient aucune clé privée : l'administrateur se connecte à un
 * serveur *à travers* lui (ProxyJump), avec sa propre clé, et le serveur
 * n'accepte SSH que depuis l'adresse du bastion. Tout passe par un point que
 * l'on journalise, et fail2ban y ferme la porte aux essais répétés.
 *
 * Réutilise les briques de web-db-scripts (identité, réseau, ordre, fichier).
 */
import {
  MDP, enFichier, entete, finReseau, identiteGenerique, nomHote, reseauGenerique, sequenceReseau,
  type Hote, type Hyperviseur, type Reseau,
} from './web-db-scripts';

export type Admin = { login: string; cle: string };
export type Cible = { nom: string; ip: string };

export type ParamsBastion = {
  hv: Hyperviseur;
  master: string;
  masterId: string;
  exportPath: string;
  vhdDir: string;
  sw: string;
  copierFichiers: boolean;
  vm: string;
  id: string;
  ip: string;
  cidr: string;
  gw: string;
  dns: string;
  iface: string;
  port: string;            // port SSH du bastion, 22 ou autre
  admins: string;          // une ligne par administrateur : « login ssh-ed25519 AAAA… commentaire » (la cle est optionnelle)
  cibles: string;          // une ligne par serveur : « nom ip »
  mdpAutorise: boolean;    // mot de passe du labo accepte en SSH (sinon cle seulement)
  mfa: boolean;            // TOTP (google-authenticator) en plus de la cle
  fail2ban: boolean;
  mdpSysteme: boolean;
};

export type SectionBastion = { id: 'hote' | 'bastion' | 'cibles' | 'poste' | 'posteNix' | 'verif'; titre: string; code: string; fichier: string };

const LOGIN_RE = /^[a-z_][a-z0-9_-]{0,31}$/;
const CLE_RE = /^(ssh-(ed25519|rsa|dss)|ecdsa-sha2-nistp(256|384|521)|sk-(ssh-ed25519|ecdsa-sha2-nistp256)@openssh\.com) [A-Za-z0-9+/]+=*( .*)?$/;

export function listeAdmins(texte: string): Admin[] {
  const out: Admin[] = [];
  for (const brute of texte.split(/\r?\n/)) {
    const l = brute.trim();
    if (!l || l.startsWith('#')) continue;
    const [login, ...reste] = l.split(/\s+/);
    if (!LOGIN_RE.test(login)) continue;
    const cle = reste.join(' ').trim();
    if (!out.some(a => a.login === login)) out.push({ login, cle: CLE_RE.test(cle) ? cle : '' });
  }
  return out;
}

export function listeCibles(texte: string): Cible[] {
  const out: Cible[] = [];
  for (const brute of texte.split(/\r?\n/)) {
    const l = brute.trim();
    if (!l || l.startsWith('#')) continue;
    const [nom, ip] = l.split(/\s+/);
    if (nom && ip && /^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) out.push({ nom: nomHote(nom), ip });
  }
  return out;
}

// ---------------------------------------------------------------- hote ------

function scriptHote(p: ParamsBastion): string {
  const h: string[] = [];
  const hote = nomHote(p.vm);
  if (p.hv === 'hyperv') {
    h.push('# ============================================================');
    h.push(`#  Clonage Hyper-V : ${p.master}  ->  ${p.vm} (bastion SSH, ${p.ip}/${p.cidr} via ${p.gw})`);
    h.push("#  A executer SUR L'HOTE Hyper-V (PowerShell admin)");
    h.push('# ============================================================');
    h.push(`$Source = '${p.master}'; $Clone = '${p.vm}'; $Export = '${p.exportPath}'; $VhdDir = '${p.vhdDir}'; $Switch = '${p.sw}'`);
    h.push('$Ici = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }');
    h.push('if (-not (Get-VM -Name $Source -ErrorAction SilentlyContinue)) { throw "VM source $Source introuvable" }');
    h.push('if (Get-VM -Name $Clone -ErrorAction SilentlyContinue) { throw "$Clone existe deja" }');
    h.push("if (-not (Get-VMSwitch -Name $Switch -ErrorAction SilentlyContinue)) { New-VMSwitch -Name $Switch -SwitchType Private | Out-Null }");
    h.push("if ((Get-VM -Name $Source).State -ne 'Off') { Stop-VM -Name $Source -Force }");
    h.push('New-Item -ItemType Directory -Force -Path $Export, $VhdDir | Out-Null');
    h.push('$ExportDir = Join-Path $Export "$Source-vers-$Clone"');
    h.push('if (Test-Path $ExportDir) { Remove-Item -Path $ExportDir -Recurse -Force }');
    h.push('Export-VM -Name $Source -Path $ExportDir');
    h.push('$Vmcx = Get-ChildItem -Path (Join-Path $ExportDir "$Source\\Virtual Machines") -Filter *.vmcx | Select-Object -First 1');
    h.push('$ConfigDir = Join-Path $VhdDir $Clone');
    h.push("$New = Import-VM -Path $Vmcx.FullName -Copy -GenerateNewId -VirtualMachinePath $ConfigDir -VhdDestinationPath (Join-Path $ConfigDir 'VHDX')");
    h.push('Rename-VM -VM $New -NewName $Clone');
    h.push('Set-VM -Name $Clone -Notes "Bastion SSH - clone de $Source - $(Get-Date -Format yyyy-MM-dd)"');
    h.push('Set-VMProcessor -VMName $Clone -Count 1; Set-VMMemory -VMName $Clone -StartupBytes 1GB   # un bastion ne fait rien de lourd');
    h.push('Get-VMNetworkAdapter -VMName $Clone | Connect-VMNetworkAdapter -SwitchName $Switch');
    h.push("Enable-VMIntegrationService -VMName $Clone -Name 'Guest Service Interface'");
    h.push('Remove-Item -Path $ExportDir -Recurse -Force');
    h.push('Start-VM -Name $Clone; Write-Output "Clone pret : $Clone"');
    if (p.copierFichiers) {
      h.push('Start-Sleep -Seconds 60');
      h.push(`$Src = Join-Path $Ici 'bastion-${hote}.sh'`);
      h.push('if (Test-Path $Src) { try { Copy-VMFile -Name $Clone -SourcePath $Src -DestinationPath /root/bastion.sh -FileSource Host -CreateFullPath -Force -ErrorAction Stop; Write-Output "Script depose : /root/bastion.sh" } catch { Write-Warning "Copie impossible ($($_.Exception.Message)) : hyperv-daemons absent ? Colle le script par la console." } } else { Write-Warning "$Src introuvable : telecharge le .sh a cote du script" }');
    }
  } else {
    h.push('# ============================================================');
    h.push(`#  Clonage Proxmox VE : ${p.master} (VMID ${p.masterId})  ->  ${hote} (${p.id}) - bastion SSH`);
    h.push("#  A executer SUR L'HOTE Proxmox (shell root)");
    h.push('# ============================================================');
    h.push('set -e');
    h.push(`qm status ${p.masterId} >/dev/null 2>&1 || { echo "VMID ${p.masterId} (master) introuvable : qm list"; exit 1; }`);
    h.push(`[ "$(qm status ${p.masterId} | awk '{print $2}')" = stopped ] || qm shutdown ${p.masterId} --timeout 60`);
    h.push(`qm status ${p.id} >/dev/null 2>&1 && { echo "VMID ${p.id} existe deja"; exit 1; }`);
    h.push(`qm clone ${p.masterId} ${p.id} --name ${hote} --full`);
    h.push(`qm set ${p.id} --cores 1 --memory 1024 --net0 virtio,bridge=${p.sw}`);
    h.push(`qm start ${p.id}`);
    h.push('echo "Clone pret. Console de la VM, puis :  sudo bash /root/bastion.sh"');
  }
  return h.join('\n');
}

// ---------------------------------------------------------------- bastion ---

function blocAdmins(admins: Admin[], sudo: boolean): string[] {
  const r: string[] = [];
  r.push('etape "Comptes des administrateurs"');
  for (const a of admins) {
    r.push(`if ! getent passwd ${a.login} >/dev/null; then useradd -m -s /bin/bash ${a.login}; fi`);
    r.push(`echo "${a.login}:${MDP}" | chpasswd`);
    if (sudo) r.push(`usermod -aG sudo ${a.login} 2>/dev/null || true`);
    r.push(`install -d -m 700 -o ${a.login} -g ${a.login} /home/${a.login}/.ssh`);
    if (a.cle) {
      r.push(`grep -qF '${a.cle.split(' ').slice(0, 2).join(' ')}' /home/${a.login}/.ssh/authorized_keys 2>/dev/null || echo '${a.cle}' >> /home/${a.login}/.ssh/authorized_keys`);
      r.push(`chmod 600 /home/${a.login}/.ssh/authorized_keys && chown ${a.login}:${a.login} /home/${a.login}/.ssh/authorized_keys`);
    }
  }
  return r;
}

function gardeFou(admins: Admin[], cleSeulement: boolean): string[] {
  const logins = admins.map(a => a.login).join(' ');
  return [
    "# Garde-fou : l'utilisateur qui lance ce script (souvent celui du master, ex. miyukini) doit pouvoir revenir.",
    "# Sans lui dans AllowUsers - et sans mot de passe s'il n'a pas de cle - la prochaine connexion serait refusee.",
    'MOI=${SUDO_USER:-$(logname 2>/dev/null || true)}',
    `ALLOW="${logins || 'root'}"`,
    `PASS=${cleSeulement ? 'no' : 'yes'}`,
    'if [ -n "$MOI" ] && [ "$MOI" != root ] && ! echo " $ALLOW " | grep -q " $MOI "; then',
    '    ALLOW="$ALLOW $MOI"',
    '    echo "AVERTISSEMENT: $MOI (ton compte actuel) n est pas dans la liste des administrateurs : ajoute a AllowUsers pour ne pas te couper la branche. Retire-le de /etc/ssh/sshd_config.d/ quand les administrateurs auront leurs cles."',
    'fi',
    'if [ -n "$MOI" ] && [ "$PASS" = no ] && [ ! -s "/home/$MOI/.ssh/authorized_keys" ]; then',
    '    PASS=yes',
    '    echo "AVERTISSEMENT: $MOI n a pas de cle publique installee : le mot de passe reste accepte en SSH, sinon tu ne pourrais plus entrer. Mets sa cle (bloc 4), puis PasswordAuthentication no."',
    'fi',
  ];
}

function scriptBastion(p: ParamsBastion): string {
  const hote = nomHote(p.vm);
  const admins = listeAdmins(p.admins);
  const cibles = listeCibles(p.cibles);
  const hotes: Hote[] = cibles.map(c => [c.ip, c.nom]);
  const n: Reseau = { ip: p.ip, cidr: p.cidr, gw: p.gw, dns: p.dns };
  const port = p.port || '22';
  const paquets = ['openssh-server', 'iproute2', p.fail2ban ? 'fail2ban python3-systemd' : '', p.mfa ? 'libpam-google-authenticator' : ''].filter(Boolean).join(' ');
  const cleSeulement = !p.mdpAutorise && admins.some(a => a.cle);
  const b: string[] = [
    ...entete(`Bastion SSH : ${p.vm} (${p.ip}) - porte d'entree unique vers ${cibles.map(c => c.nom).join(', ') || 'les serveurs'}`, p.vm),
    ...identiteGenerique(hote, hotes, p.mdpSysteme),
    ...reseauGenerique(n, p.iface),
    '',
    'identite',
    ...sequenceReseau(paquets),
    '',
    `etape "Installation : ${paquets}"`,
    `apt_essais apt-get update -q && apt_essais apt-get install -y -q ${paquets}`,
    '',
    ...blocAdmins(admins, true),
    '',
    'etape "SSH durci : pas de root, pas de X11, journal detaille, seuls les administrateurs listes"',
    'install -d /etc/ssh/sshd_config.d',
    ...gardeFou(admins, cleSeulement),
    "cat > /etc/ssh/sshd_config.d/10-bastion.conf <<EOF",
    `Port ${port}`,
    'AllowUsers $ALLOW',
    'PermitRootLogin no',
    'PasswordAuthentication $PASS',
    `KbdInteractiveAuthentication ${p.mfa ? 'yes' : 'no'}`,
    'PubkeyAuthentication yes',
    p.mfa ? 'AuthenticationMethods publickey,keyboard-interactive' : '# AuthenticationMethods (cle + code TOTP) : option MFA non cochee',
    'MaxAuthTries 3',
    'LoginGraceTime 30',
    'X11Forwarding no',
    'AllowAgentForwarding no          # on rebondit avec ProxyJump, pas avec un agent transfere',
    'AllowTcpForwarding yes           # necessaire a ProxyJump (le bastion ouvre le tunnel vers la cible)',
    'PermitTunnel no',
    'ClientAliveInterval 300',
    'ClientAliveCountMax 2',
    'LogLevel VERBOSE                 # qui, quelle cle, vers ou : dans journalctl -u ssh',
    'Banner /etc/ssh/banniere',
    'EOF',
    "cat > /etc/ssh/banniere <<'EOF'",
    '*** Bastion d\'administration - acces reserve, connexions journalisees ***',
    'EOF',
  ];
  if (p.mfa) {
    b.push('# MFA : cle SSH + code a usage unique (TOTP). Chaque administrateur lance `google-authenticator` a sa premiere connexion.');
    b.push("grep -q pam_google_authenticator /etc/pam.d/sshd || echo 'auth required pam_google_authenticator.so nullok' >> /etc/pam.d/sshd");
    b.push("sed -i 's/^@include common-auth/#@include common-auth   # desactive : la cle remplace le mot de passe, le TOTP s ajoute/' /etc/pam.d/sshd");
  }
  if (!cleSeulement) {
    b.push(`echo "AVERTISSEMENT: le mot de passe du labo (${MDP}) est accepte en SSH ${admins.some(a => a.cle) ? '(case Autoriser le mot de passe)' : '(aucune cle publique fournie)'} : un bastion de production n accepte que les cles."`);
  }
  b.push('sshd -t || { echo "ERREUR: configuration SSH invalide"; sshd -t; exit 1; }');
  b.push('systemctl enable --now ssh && systemctl restart ssh');
  if (p.fail2ban) {
    b.push('');
    b.push('etape "fail2ban : 5 echecs en 10 minutes = adresse bannie 1 heure"');
    b.push("cat > /etc/fail2ban/jail.d/bastion.local <<EOF");
    b.push('[DEFAULT]');
    b.push('backend = systemd');
    b.push('bantime = 1h');
    b.push('findtime = 10m');
    b.push('maxretry = 5');
    b.push('[sshd]');
    b.push('enabled = true');
    b.push(`port = ${port}`);
    b.push('EOF');
    b.push('systemctl enable --now fail2ban && systemctl restart fail2ban');
  }
  b.push('');
  b.push('etape "Journal des connexions : qui est entre, avec quelle cle"');
  b.push("cat > /usr/local/bin/journal-bastion <<'EOF'");
  b.push('#!/usr/bin/env bash');
  b.push('# Les connexions SSH acceptees et refusees des dernieres 24 h');
  b.push('journalctl -u ssh --since "24 hours ago" --no-pager | grep -E "Accepted|Failed|Invalid user|Disconnected from user" | tail -n "${1:-40}"');
  b.push('EOF');
  b.push('chmod 755 /usr/local/bin/journal-bastion');
  b.push('');
  b.push(`if command -v ufw >/dev/null; then ufw allow ${port}/tcp; ufw --force enable; fi`);
  b.push(...finReseau());
  b.push('');
  b.push('etape "Verification"');
  b.push(`ss -tlnp | grep -q ':${port} ' && echo "SSH ecoute sur ${port}" || { echo "ERREUR: SSH n ecoute pas sur ${port}"; exit 1; }`);
  if (p.fail2ban) b.push('fail2ban-client status sshd | head -3 || true');
  b.push(`echo "Bastion pret : ${hote} (${p.ip}:${port}). Administrateurs : ${admins.map(a => a.login).join(', ')}. Les cles d hote ont ete regenerees : ton client SSH (MobaXterm, ssh) signalera un changement d empreinte, c est attendu."`);
  b.push(`echo "Suite : jouer le script (3) sur chaque serveur (${cibles.map(c => c.nom).join(', ')}), puis configurer le poste (4)."`);
  return b.join('\n');
}

// ---------------------------------------------------------------- cibles ----

function scriptCibles(p: ParamsBastion): string {
  const admins = listeAdmins(p.admins);
  const hote = nomHote(p.vm);
  const c: string[] = [
    '#!/usr/bin/env bash',
    `# Serveur derriere le bastion : n'accepte SSH que depuis ${hote} (${p.ip}). Le meme script sur chaque serveur.`,
    '# A executer DANS LA VM cible, en root :  sudo bash ce-script.sh',
    '# Genere par le configurateur du site TSSR - environnement de formation.',
    'set -euo pipefail',
    '[ "$(id -u)" -eq 0 ] || { echo "Lance-moi en root :  sudo bash $0"; exit 1; }',
    'export DEBIAN_FRONTEND=noninteractive',
    'etape() { echo; echo "==== $*"; }',
    '',
    `# Verrou : si on est en SSH depuis une autre adresse que le bastion, on s'enfermerait dehors.`,
    'if [ -n "${SSH_CONNECTION:-}" ]; then',
    '    SRC=$(echo "$SSH_CONNECTION" | cut -d" " -f1)',
    `    if [ "$SRC" != "${p.ip}" ] && [ -z "\${JE_SAIS:-}" ]; then`,
    `        echo "Tu es connecte en SSH depuis $SRC, pas depuis le bastion ${p.ip} : a la fin de ce script, cette session sera la derniere possible depuis cette adresse."`,
    '        echo "Passe par la console de la VM, ou relance avec JE_SAIS=1 si tu as un acces console de secours."; exit 1',
    '    fi',
    'fi',
    '',
    'dpkg -s openssh-server >/dev/null 2>&1 || { apt-get update -q && apt-get install -y -q openssh-server; }',
    '',
    ...blocAdmins(admins, true),
    '',
    'etape "SSH : pas de root, administrateurs du bastion seulement"',
    'install -d /etc/ssh/sshd_config.d',
    ...gardeFou(admins, !p.mdpAutorise && admins.some(a => a.cle)),
    'cat > /etc/ssh/sshd_config.d/10-derriere-bastion.conf <<EOF',
    'PermitRootLogin no',
    'AllowUsers $ALLOW',
    'PasswordAuthentication $PASS',
    'X11Forwarding no',
    'LogLevel VERBOSE',
    'EOF',
    'sshd -t && systemctl restart ssh',
    '',
    `etape "Pare-feu : le port 22 n'est ouvert que pour ${p.ip}"`,
    'if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then',
    `    ufw allow from ${p.ip} to any port 22 proto tcp`,
    '    ufw deny 22/tcp',
    '    ufw reload',
    'else',
    '    # nftables (Debian par defaut) : une table a part, sans politique par defaut - ne touche a rien d autre',
    '    apt-get install -y -q nftables >/dev/null 2>&1 || true',
    "    cat > /etc/nftables-bastion.nft <<EOF",
    'table inet bastion {',
    '    chain input {',
    '        type filter hook input priority 0; policy accept;',
    `        tcp dport 22 ip saddr != ${p.ip} ct state new drop`,
    '    }',
    '}',
    'EOF',
    "    grep -q 'nftables-bastion.nft' /etc/nftables.conf 2>/dev/null || echo 'include \"/etc/nftables-bastion.nft\"' >> /etc/nftables.conf",
    '    nft -f /etc/nftables-bastion.nft 2>/dev/null || { nft delete table inet bastion 2>/dev/null || true; nft -f /etc/nftables-bastion.nft; }',
    '    systemctl enable --now nftables >/dev/null 2>&1 || true',
    'fi',
    '',
    'etape "Verification"',
    `nft list table inet bastion 2>/dev/null | grep -q '${p.ip}' && echo "nftables : 22 ouvert pour ${p.ip} seulement" || { ufw status 2>/dev/null | grep -q '${p.ip}' && echo "ufw : 22 ouvert pour ${p.ip} seulement" || echo "AVERTISSEMENT: verifie la regle du port 22"; }`,
    `echo "Serveur $(hostname) : SSH pour ${admins.map(a => a.login).join(', ')} depuis le bastion ${p.ip} uniquement."`,
  ];
  return c.join('\n');
}

// ---------------------------------------------------------------- poste -----

function configSsh(p: ParamsBastion): string {
  const admins = listeAdmins(p.admins);
  const cibles = listeCibles(p.cibles);
  const login = admins[0]?.login || 'admin';
  const port = p.port || '22';
  const r: string[] = [];
  r.push('# --- Bastion TSSR (genere) ---');
  r.push('Host bastion');
  r.push(`    HostName ${p.ip}`);
  r.push(`    Port ${port}`);
  r.push(`    User ${login}`);
  r.push('    IdentityFile ~/.ssh/id_ed25519');
  r.push('    IdentitiesOnly yes');
  for (const c of cibles) {
    r.push('');
    r.push(`Host ${c.nom}`);
    r.push(`    HostName ${c.ip}`);
    r.push(`    User ${login}`);
    r.push('    ProxyJump bastion');
    r.push('    IdentityFile ~/.ssh/id_ed25519');
    r.push('    IdentitiesOnly yes');
  }
  r.push('# --- fin bastion TSSR ---');
  return r.join('\n');
}

// Windows : un script PowerShell qui fait tout - client OpenSSH, cle, ~/.ssh/config (bloc remplace a chaque rejeu), test.
function scriptPoste(p: ParamsBastion): string {
  const admins = listeAdmins(p.admins);
  const cibles = listeCibles(p.cibles);
  const login = admins[0]?.login || 'admin';
  const port = p.port || '22';
  const w: string[] = [];
  w.push('# ============================================================');
  w.push(`#  Poste de l'administrateur (Windows 10/11) : cle SSH, ~/.ssh/config avec ProxyJump vers ${p.ip}, test`);
  w.push('#  A executer dans PowerShell (pas besoin d etre administrateur). Rejouable : le bloc de config est remplace.');
  w.push('# ============================================================');
  w.push("$ErrorActionPreference = 'Stop'");
  w.push(`$Login   = '${login}'`);
  w.push(`$Bastion = '${p.ip}'`);
  w.push(`$Port    = ${port}`);
  w.push('$SshDir  = Join-Path $env:USERPROFILE \'.ssh\'');
  w.push('$Cle     = Join-Path $SshDir \'id_ed25519\'');
  w.push('$Config  = Join-Path $SshDir \'config\'');
  w.push('');
  w.push('# --- 1. Le client OpenSSH de Windows ---');
  w.push('if (-not (Get-Command ssh.exe -ErrorAction SilentlyContinue)) {');
  w.push('    Write-Warning "Client OpenSSH absent. Parametres > Applications > Fonctionnalites facultatives > Client OpenSSH, ou (admin) : Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0"');
  w.push('    exit 1');
  w.push('}');
  w.push('New-Item -ItemType Directory -Force -Path $SshDir | Out-Null');
  w.push('');
  w.push('# --- 2. La cle de l administrateur (une fois ; la privee ne quitte jamais ce poste) ---');
  w.push('if (-not (Test-Path $Cle)) {');
  w.push('    Write-Host "Generation de la cle ed25519 (choisis une phrase de passe, ou Entree pour aucune)..."');
  w.push('    ssh-keygen -t ed25519 -C "$Login@$env:COMPUTERNAME" -f $Cle');
  w.push('}');
  w.push('Write-Host ""');
  w.push('Write-Host "Cle publique a coller dans le configurateur, champ Administrateurs, sur la ligne de $Login :" -ForegroundColor Cyan');
  w.push('Write-Host ("$Login " + (Get-Content "$Cle.pub")) -ForegroundColor Yellow');
  w.push('Write-Host ""');
  w.push('');
  w.push('# --- 3. ~/.ssh/config : le bloc bastion, remplace s il existe deja ---');
  w.push('$Bloc = @\'');
  w.push(configSsh(p));
  w.push('\'@');
  w.push("$Existant = if (Test-Path $Config) { Get-Content $Config -Raw } else { '' }");
  w.push("$Existant = [regex]::Replace($Existant, '(?s)# --- Bastion TSSR \\(genere\\) ---.*?# --- fin bastion TSSR ---\\r?\\n?', '')");
  w.push("$Nouveau  = ($Existant.TrimEnd() + \"`n`n\" + $Bloc + \"`n\").TrimStart()");
  w.push('# UTF-8 sans BOM et fins de ligne LF : OpenSSH ne lit pas un fichier config avec BOM');
  w.push("[IO.File]::WriteAllText($Config, ($Nouveau -replace \"`r`n\", \"`n\"), (New-Object System.Text.UTF8Encoding $false))");
  w.push('Write-Host "Config ecrite : $Config"');
  w.push('');
  w.push('# --- 4. Test (apres avoir donne la cle publique au configurateur et joue le script 2 sur le bastion) ---');
  w.push('Write-Host "Test du bastion :  ssh bastion hostname"');
  w.push("try { ssh -o ConnectTimeout=8 -o BatchMode=yes bastion hostname } catch { Write-Warning \"Pas encore : la cle est-elle sur le bastion ? le script 2 a-t-il ete joue ? (ssh -v bastion pour le detail)\" }");
  if (cibles[0]) {
    w.push(`Write-Host "Puis, a travers lui :  ssh ${cibles[0].nom} hostname   (et scp fichier ${cibles[0].nom}:/tmp/)"`);
  }
  w.push('');
  w.push('# --- MobaXterm, si tu preferes : Session > SSH > Remote host = $Bastion, Username = $Login, Port = $Port ;');
  w.push('#     Advanced SSH settings > Use private key = $Cle (ou la cle exportee en .ppk) ;');
  w.push('#     pour un serveur derriere : Network settings > SSH gateway (jump host) = $Bastion / $Login / meme cle.');
  return w.join('\n');
}

function scriptPosteNix(p: ParamsBastion): string {
  const cibles = listeCibles(p.cibles);
  const admins = listeAdmins(p.admins);
  const login = admins[0]?.login || 'admin';
  const r: string[] = [];
  r.push('# Linux / macOS : a ajouter dans ~/.ssh/config (chmod 600). La cle : ssh-keygen -t ed25519 ; donner ~/.ssh/id_ed25519.pub au configurateur.');
  r.push(configSsh(p));
  r.push('');
  r.push('# Utiliser :  ssh bastion' + (cibles[0] ? `   ;   ssh ${cibles[0].nom}   ;   scp fichier ${cibles[0].nom}:/tmp/` : ''));
  if (cibles[0]) r.push(`# Sans fichier config :  ssh -J ${login}@${p.ip}:${p.port || '22'} ${login}@${cibles[0].ip}`);
  return r.join('\n');
}

function scriptVerif(p: ParamsBastion): string {
  const admins = listeAdmins(p.admins);
  const cibles = listeCibles(p.cibles);
  const login = admins[0]?.login || 'admin';
  const v: string[] = [];
  v.push('# Depuis le poste : le bastion repond, puis un serveur a travers lui');
  v.push(`ssh -p ${p.port || '22'} ${login}@${p.ip} hostname`);
  if (cibles[0]) v.push(`ssh -J ${login}@${p.ip}:${p.port || '22'} ${login}@${cibles[0].ip} hostname`);
  v.push('');
  v.push("# Depuis le poste : la porte directe est fermee (doit echouer : timeout ou refused)");
  if (cibles[0]) v.push(`ssh -o ConnectTimeout=5 ${login}@${cibles[0].ip} hostname`);
  v.push('');
  v.push('# Sur le bastion : qui est passe');
  v.push('journal-bastion 50');
  if (p.fail2ban) v.push('fail2ban-client status sshd        # adresses bannies');
  v.push('');
  v.push('# Sur un serveur : la regle');
  v.push('nft list table inet bastion         # ou : ufw status numbered');
  v.push('');
  v.push(`# Pare-feu (OPNsense) : reseau d'administration -> ${p.ip} TCP ${p.port || '22'} ; ${p.ip} -> serveurs TCP 22 ; rien d'autre vers le port 22 des serveurs.`);
  return v.join('\n');
}

export function genererScriptsBastion(p: ParamsBastion): SectionBastion[] {
  const hote = nomHote(p.vm);
  return [
    { id: 'hote', titre: p.hv === 'hyperv' ? '① Sur l’hôte Hyper-V — cloner le bastion' : '① Sur l’hôte Proxmox — cloner le bastion', code: scriptHote(p), fichier: p.hv === 'hyperv' ? 'clone-bastion.ps1' : 'clone-bastion.sh' },
    { id: 'bastion', titre: `② Dans ${p.vm} — le bastion`, code: enFichier(scriptBastion(p), '~/bastion.sh'), fichier: `bastion-${hote}.sh` },
    { id: 'cibles', titre: '③ Sur chaque serveur — n’accepter SSH que depuis le bastion', code: enFichier(scriptCibles(p), '~/derriere-bastion.sh'), fichier: 'derriere-bastion.sh' },
    { id: 'poste', titre: '④ Sur le poste de l’administrateur (Windows) — PowerShell : clé, config, test', code: scriptPoste(p), fichier: 'poste-bastion.ps1' },
    { id: 'posteNix', titre: '④ bis — Linux / macOS : ~/.ssh/config', code: scriptPosteNix(p), fichier: 'ssh-config.txt' },
    { id: 'verif', titre: '⑤ Vérifier', code: scriptVerif(p), fichier: 'verif.txt' },
  ];
}

/** Version a coller dans un terminal : s'enregistre puis se lance. */
export function pourConsoleBastion(sec: SectionBastion): string {
  if (sec.id === 'bastion') return `cat > ~/bastion.sh <<'FIN_SCRIPT_TSSR'\n${sec.code}\nFIN_SCRIPT_TSSR\nsudo bash ~/bastion.sh`;
  if (sec.id === 'cibles') return `cat > ~/derriere-bastion.sh <<'FIN_SCRIPT_TSSR'\n${sec.code}\nFIN_SCRIPT_TSSR\nsudo bash ~/derriere-bastion.sh`;
  return sec.code;
}

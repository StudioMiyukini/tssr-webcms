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

export type Auth = 'mdp' | 'cle' | 'les-deux';

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
  auth: Auth;              // ce que SSH accepte : le mot de passe du labo, la cle, ou les deux
  genererCles: boolean;    // le script du bastion fabrique une paire de cles par administrateur (ecrase l'existante)
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

function blocAdmins(admins: Admin[], sudo: boolean, genererCles = false): string[] {
  const r: string[] = [];
  r.push('etape "Comptes des administrateurs"');
  for (const a of admins) {
    r.push(`if ! getent passwd ${a.login} >/dev/null; then useradd -m -s /bin/bash ${a.login}; fi`);
    r.push(`echo "${a.login}:${MDP}" | chpasswd`);
    if (sudo) r.push(`usermod -aG sudo ${a.login} 2>/dev/null || true`);
    r.push(`install -d -m 700 -o ${a.login} -g ${a.login} /home/${a.login}/.ssh`);
    r.push(`touch /home/${a.login}/.ssh/authorized_keys; chmod 600 /home/${a.login}/.ssh/authorized_keys; chown ${a.login}:${a.login} /home/${a.login}/.ssh/authorized_keys`);
    if (a.cle) {
      r.push(`grep -qF '${a.cle.split(' ').slice(0, 2).join(' ')}' /home/${a.login}/.ssh/authorized_keys || echo '${a.cle}' >> /home/${a.login}/.ssh/authorized_keys`);
    }
    if (genererCles) {
      // Une paire par administrateur, fabriquee ici, ecrasee a chaque passage : la privee est a emporter sur le poste, puis a effacer d'ici.
      r.push(`K=/home/${a.login}/.ssh/cle-bastion-${a.login}`);
      r.push('rm -f "$K" "$K.pub"');
      r.push(`ssh-keygen -q -t ed25519 -N '' -C '${a.login}@bastion-genere' -f "$K"`);
      r.push(`chown ${a.login}:${a.login} "$K" "$K.pub"; chmod 600 "$K"`);
      r.push(`grep -v '${a.login}@bastion-genere' /home/${a.login}/.ssh/authorized_keys > /home/${a.login}/.ssh/authorized_keys.tmp || true`);
      r.push(`cat "$K.pub" >> /home/${a.login}/.ssh/authorized_keys.tmp && mv /home/${a.login}/.ssh/authorized_keys.tmp /home/${a.login}/.ssh/authorized_keys`);
      r.push(`chmod 600 /home/${a.login}/.ssh/authorized_keys; chown ${a.login}:${a.login} /home/${a.login}/.ssh/authorized_keys`);
    }
  }
  return r;
}

// Les cles fabriquees sur le bastion : les montrer, dire ou elles sont, comment les emporter et les poser sur les serveurs.
function blocClesGenerees(p: ParamsBastion, admins: Admin[], cibles: Cible[]): string[] {
  const r: string[] = [];
  r.push('etape "Cles generees : a emporter sur le poste de chaque administrateur, puis a effacer d ici"');
  for (const a of admins) {
    r.push(`echo; echo "----- ${a.login} : cle PRIVEE (a mettre dans ~/.ssh/id_ed25519 sur le poste de ${a.login}, chmod 600) -----"`);
    r.push(`cat /home/${a.login}/.ssh/cle-bastion-${a.login}`);
    r.push(`echo "----- ${a.login} : cle publique (deja dans authorized_keys ici) -----"`);
    r.push(`cat /home/${a.login}/.ssh/cle-bastion-${a.login}.pub`);
  }
  r.push('echo');
  r.push(`echo "Depuis le poste, recuperer sa cle privee (mot de passe ${MDP}) :   scp -P ${p.port || '22'} ${admins[0]?.login || 'admin'}@${p.ip}:.ssh/cle-bastion-${admins[0]?.login || 'admin'} ~/.ssh/id_ed25519"`);
  r.push(`echo '  Windows : scp -P ${p.port || '22'} ${admins[0]?.login || 'admin'}@${p.ip}:.ssh/cle-bastion-${admins[0]?.login || 'admin'} %USERPROFILE%\\.ssh\\id_ed25519'`);
  r.push('echo "Puis, ici, effacer la privee :   rm ~/.ssh/cle-bastion-*   (la publique est deja dans authorized_keys)"');
  if (cibles.length) {
    r.push('echo');
    r.push(`echo "Poser la cle publique sur chaque serveur (depuis le bastion, en tant que ${admins[0]?.login || 'admin'}, tant que le mot de passe y est accepte) :"`);
    for (const a of admins) for (const c of cibles) r.push(`echo "  ssh-copy-id -i /home/${a.login}/.ssh/cle-bastion-${a.login}.pub ${a.login}@${c.ip}"`);
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
  const cleSeulement = p.auth === 'cle';
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
    ...blocAdmins(admins, true, p.genererCles),
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
    b.push(`echo "AVERTISSEMENT: le mot de passe du labo (${MDP}) est accepte en SSH (mode ${p.auth === 'mdp' ? 'mot de passe' : 'mot de passe + cle'}) : un bastion de production n accepte que les cles."`);
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
  if (p.genererCles) b.push(...blocClesGenerees(p, admins, cibles));
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
    ...gardeFou(admins, p.auth === 'cle'),
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
    "    # La table est recreee a chaque passage : rejouer avec une autre adresse de bastion ne doit pas EMPILER deux regles (tout serait alors bloque)",
    '    nft delete table inet bastion 2>/dev/null || true; nft -f /etc/nftables-bastion.nft',
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
  r.push('');
  r.push('# Interfaces web derriere le bastion (GLPI, webmail, page de test) : un tunnel local, puis http://localhost:<port> dans le navigateur.');
  r.push('#   ssh -N tunnels     (cette entree ouvre les tunnels ci-dessous et attend)');
  r.push('Host tunnels');
  r.push(`    HostName ${p.ip}`);
  r.push(`    Port ${port}`);
  r.push(`    User ${login}`);
  r.push('    IdentityFile ~/.ssh/id_ed25519');
  let portLocal = 18080;
  for (const c of cibles) {
    r.push(`    LocalForward ${portLocal} ${c.ip}:80        # http://localhost:${portLocal}  ->  ${c.nom}`);
    portLocal += 1;
  }
  r.push('#   Ou tout le navigateur a travers le bastion (proxy SOCKS) :  ssh -N -D 1080 bastion   puis proxy SOCKS5 localhost:1080 dans Firefox.');
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

// Linux / macOS : le meme travail que le PowerShell, en bash.
function scriptPosteNix(p: ParamsBastion): string {
  const admins = listeAdmins(p.admins);
  const cibles = listeCibles(p.cibles);
  const login = admins[0]?.login || 'admin';
  const port = p.port || '22';
  const w: string[] = [];
  w.push('#!/usr/bin/env bash');
  w.push(`# Poste de l'administrateur (Linux, macOS, WSL, Git Bash) : cle SSH, ~/.ssh/config avec ProxyJump vers ${p.ip}, test.`);
  w.push('# A lancer avec ton compte (pas root) :  bash poste-bastion.sh   - rejouable, le bloc de config est remplace.');
  w.push('set -euo pipefail');
  w.push(`LOGIN='${login}'`);
  w.push('SSH_DIR="$HOME/.ssh"; CLE="$SSH_DIR/id_ed25519"; CONFIG="$SSH_DIR/config"');
  w.push('command -v ssh >/dev/null || { echo "Client ssh absent : apt install openssh-client (Debian/Ubuntu), dnf install openssh-clients (Fedora)"; exit 1; }');
  w.push('mkdir -p "$SSH_DIR" && chmod 700 "$SSH_DIR"');
  w.push('');
  w.push("# --- 1. La cle de l'administrateur (une fois ; la privee ne quitte jamais ce poste) ---");
  w.push('if [ ! -f "$CLE" ]; then');
  w.push('    echo "Generation de la cle ed25519 (choisis une phrase de passe, ou Entree pour aucune)..."');
  w.push('    ssh-keygen -t ed25519 -C "$LOGIN@$(hostname)" -f "$CLE"');
  w.push('fi');
  w.push('echo; echo "Cle publique a coller dans le configurateur, champ Administrateurs, sur la ligne de $LOGIN :"');
  w.push('echo "$LOGIN $(cat "$CLE.pub")"; echo');
  w.push('');
  w.push("# --- 2. ~/.ssh/config : le bloc bastion, remplace s'il existe deja ---");
  w.push('touch "$CONFIG"; chmod 600 "$CONFIG"');
  w.push("# suppression de l'ancien bloc (entre les deux marqueurs), puis ajout du nouveau");
  w.push("awk '/^# --- Bastion TSSR \\(genere\\) ---$/{saut=1} !saut{print} /^# --- fin bastion TSSR ---$/{saut=0}' \"$CONFIG\" > \"$CONFIG.tmp\" && mv \"$CONFIG.tmp\" \"$CONFIG\"");
  w.push("cat >> \"$CONFIG\" <<'EOF'");
  w.push('');
  w.push(configSsh(p));
  w.push('EOF');
  w.push('chmod 600 "$CONFIG"');
  w.push('echo "Config ecrite : $CONFIG"');
  w.push('');
  w.push('# --- 3. Test (apres avoir donne la cle publique au configurateur et joue le script 2 sur le bastion) ---');
  w.push('echo "Test du bastion :  ssh bastion hostname"');
  w.push('ssh -o ConnectTimeout=8 -o BatchMode=yes bastion hostname || echo "Pas encore : la cle est-elle sur le bastion ? le script 2 a-t-il ete joue ? (ssh -v bastion pour le detail)"');
  if (cibles[0]) {
    w.push(`echo "Puis, a travers lui :  ssh ${cibles[0].nom} hostname   (et scp fichier ${cibles[0].nom}:/tmp/)"`);
    w.push(`echo "Sans fichier config :  ssh -J $LOGIN@${p.ip}:${port} $LOGIN@${cibles[0].ip}"`);
  }
  return w.join('\n');
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
  v.push('# Interfaces web (GLPI :8080, webmail, page de test) : le bastion ne les bloque pas, seul le port 22 des serveurs est reserve.');
  v.push('# Si ton reseau n atteint pas les serveurs :  ssh -N tunnels   (entree du bloc 4) puis http://localhost:18080 ; ou  ssh -N -D 1080 bastion  + proxy SOCKS5 dans Firefox.');
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
    { id: 'posteNix', titre: '④ bis — Linux / macOS / WSL : bash — clé, config, test', code: scriptPosteNix(p), fichier: 'poste-bastion.sh' },
    { id: 'verif', titre: '⑤ Vérifier', code: scriptVerif(p), fichier: 'verif.txt' },
  ];
}

/** Version a coller dans un terminal : s'enregistre puis se lance. */
export function pourConsoleBastion(sec: SectionBastion): string {
  if (sec.id === 'bastion') return `cat > ~/bastion.sh <<'FIN_SCRIPT_TSSR'\n${sec.code}\nFIN_SCRIPT_TSSR\nsudo bash ~/bastion.sh`;
  if (sec.id === 'cibles') return `cat > ~/derriere-bastion.sh <<'FIN_SCRIPT_TSSR'\n${sec.code}\nFIN_SCRIPT_TSSR\nsudo bash ~/derriere-bastion.sh`;
  return sec.code;
}

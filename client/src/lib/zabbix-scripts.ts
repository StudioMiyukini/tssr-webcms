/**
 * Générateur de configuration d'un **agent Zabbix 2** à superviser depuis un
 * serveur Zabbix, pour les VM Debian et les postes Windows du labo.
 *
 * Options couvertes :
 *   - OS cible (Debian/Ubuntu ou Windows) ;
 *   - IP du serveur Zabbix et nom d'hôte supervisé ;
 *   - mode **passif** (Server=), **actif** (ServerActive=) ou les deux ;
 *   - port d'écoute de l'agent (10050 par défaut) ;
 *   - chiffrement **PSK** optionnel (TLSConnect/TLSAccept + clé openssl).
 *
 * Produit : le fichier zabbix_agent2.conf, le script d'installation Debian (dépôt
 * + apt + conf + service + pare-feu), la procédure d'installation Windows (MSI),
 * le rappel côté serveur (ajout de l'hôte + template) et les tests zabbix_get.
 */
export type OsCible = 'debian' | 'windows';
export type ModeAgent = 'passif' | 'actif' | 'les-deux';

export type ParamsZbx = {
  os: OsCible;
  ipServeur: string;   // IP du serveur Zabbix
  hostname: string;    // nom de l'hôte supervisé (= Host name côté serveur en mode actif)
  mode: ModeAgent;
  listenPort: string;  // 10050 par défaut
  psk: boolean;
  pskIdentity: string;
  version: string;     // 7.4
};

export type SectionZbx = { id: string; titre: string; code: string; script: boolean };

const IP_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
export const ipValide = (s: string) => IP_RE.test((s || '').trim());
export const hostnameValide = (s: string) => /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test((s || '').trim());

const PSK_PATH_LINUX = '/etc/zabbix/agent.psk';
const PSK_PATH_WIN = 'C:\\Program Files\\Zabbix Agent 2\\agent.psk';
const CONF_LINUX = '/etc/zabbix/zabbix_agent2.conf';
const CONF_WIN = 'C:\\Program Files\\Zabbix Agent 2\\zabbix_agent2.conf';

const port = (p: ParamsZbx) => (p.listenPort || '10050').trim();
const srv = (p: ParamsZbx) => p.ipServeur.trim() || '<IP_SERVEUR_ZABBIX>';
const host = (p: ParamsZbx) => p.hostname.trim() || '<NOM_HOTE>';
const ident = (p: ParamsZbx) => p.pskIdentity.trim() || 'PSK-' + host(p);

/** Le contenu du fichier zabbix_agent2.conf (lignes utiles décommentées). */
export function confAgent(p: ParamsZbx): string {
  const pskFile = p.os === 'windows' ? PSK_PATH_WIN : PSK_PATH_LINUX;
  const l: string[] = [
    '# zabbix_agent2.conf — agent généré par le configurateur TSSR',
    'PidFile=/run/zabbix/zabbix_agent2.pid',
    'LogFile=/var/log/zabbix/zabbix_agent2.log',
    'LogFileSize=0',
  ];
  if (p.mode === 'passif' || p.mode === 'les-deux') {
    l.push(`Server=${srv(p)}            # mode passif : le serveur interroge l'agent sur ${port(p)}/tcp`);
  }
  if (p.mode === 'actif' || p.mode === 'les-deux') {
    l.push(`ServerActive=${srv(p)}      # mode actif : l'agent pousse vers le serveur sur 10051/tcp`);
  }
  l.push(`Hostname=${host(p)}          # doit correspondre au « Host name » déclaré côté serveur`);
  if (port(p) !== '10050') l.push(`ListenPort=${port(p)}`);
  if (p.psk) {
    l.push('');
    l.push('# Chiffrement PSK (clé pré-partagée)');
    l.push('TLSConnect=psk');
    l.push('TLSAccept=psk');
    l.push(`TLSPSKIdentity=${ident(p)}`);
    l.push(`TLSPSKFile=${pskFile}`);
  }
  l.push('');
  l.push('Include=/etc/zabbix/zabbix_agent2.d/*.conf');
  return l.join('\n');
}

/** Script d'installation complet de l'agent sous Debian (dépôt + apt + conf + service). */
export function scriptDebian(p: ParamsZbx): string {
  const v = p.version || '7.4';
  const rel = `zabbix-release_latest_${v}+debian13_all.deb`;
  const l: string[] = [
    '#!/usr/bin/env bash',
    '# Installation de l\'agent Zabbix 2 sur Debian 13 — généré par le configurateur TSSR',
    'set -e',
    '[ "$(id -u)" -eq 0 ] || { echo "Lance-moi en root (sudo bash ...)"; exit 1; }',
    'export DEBIAN_FRONTEND=noninteractive',
    '',
    'echo "== Dépôt Zabbix =="',
    `wget -q https://repo.zabbix.com/zabbix/${v}/release/debian/pool/main/z/zabbix-release/${rel}`,
    `dpkg -i ${rel}`,
    'apt-get update -qq',
    '',
    'echo "== Agent 2 =="',
    'apt-get install -y zabbix-agent2 zabbix-agent2-plugin-mongodb zabbix-agent2-plugin-postgresql || apt-get install -y zabbix-agent2',
    '',
    'echo "== Configuration =="',
    `cat > ${CONF_LINUX} <<'CONF'`,
    confAgent(p),
    'CONF',
  ];
  if (p.psk) {
    l.push('');
    l.push('echo "== Clé PSK =="');
    l.push(`openssl rand -hex 32 > ${PSK_PATH_LINUX}`);
    l.push(`chown zabbix:zabbix ${PSK_PATH_LINUX}`);
    l.push(`chmod 640 ${PSK_PATH_LINUX}`);
    l.push(`echo "PSK identity : ${ident(p)}  (à recopier côté serveur, onglet Encryption)"`);
    l.push(`echo "PSK (hex)    : $(cat ${PSK_PATH_LINUX})"`);
  }
  l.push('');
  l.push('echo "== Service =="');
  l.push('systemctl enable --now zabbix-agent2');
  l.push('systemctl restart zabbix-agent2');
  l.push('');
  l.push('echo "== Pare-feu (autoriser le serveur Zabbix sur ' + port(p) + ') =="');
  l.push(`command -v ufw >/dev/null && ufw allow from ${srv(p)} to any port ${port(p)} proto tcp || true`);
  l.push('');
  l.push(`echo "OK : agent Zabbix 2 actif sur ${host(p)} (port ${port(p)}). Déclare l'hôte côté serveur."`);
  return l.join('\n');
}

/** Procédure d'installation sous Windows (MSI + service), en PowerShell admin. */
export function scriptWindows(p: ParamsZbx): string {
  const v = p.version || '7.4';
  const l: string[] = [
    '# Agent Zabbix 2 sous Windows — PowerShell en administrateur',
    `# 1) Télécharger le MSI « Zabbix agent 2 » (${v}, Windows amd64, OpenSSL) :`,
    '#    https://www.zabbix.com/download_agents',
    '',
    '# 2) Installation silencieuse (adapte le nom exact du .msi téléchargé) :',
    `msiexec /i zabbix_agent2-${v}.0-windows-amd64-openssl.msi /qn ^`,
    `  SERVER=${srv(p)} ^`,
    `  SERVERACTIVE=${srv(p)} ^`,
    `  HOSTNAME=${host(p)} ^`,
    `  LISTENPORT=${port(p)} ENABLEPATH=1`,
    '',
    '# 3) Vérifier / démarrer le service :',
    'Get-Service "Zabbix Agent 2"',
    'Start-Service "Zabbix Agent 2"',
    '',
    `# Le fichier de conf est ici :  ${CONF_WIN}`,
    '# 4) Pare-feu Windows : autoriser le port entrant ' + port(p) + '/tcp depuis le serveur Zabbix :',
    `New-NetFirewallRule -DisplayName "Zabbix Agent" -Direction Inbound -Protocol TCP ^`,
    `  -LocalPort ${port(p)} -RemoteAddress ${srv(p)} -Action Allow`,
  ];
  if (p.psk) {
    l.push('');
    l.push('# PSK : générer une clé 32 octets puis la renseigner dans la conf (TLSPSKFile) :');
    l.push('#   PowerShell :  -join ((1..32) | % { \'{0:x2}\' -f (Get-Random -Max 256) }) > "' + PSK_PATH_WIN + '"');
    l.push(`#   TLSPSKIdentity=${ident(p)}  /  TLSConnect=psk  /  TLSAccept=psk`);
  }
  return l.join('\n');
}

/** Rappel côté serveur Zabbix : déclarer l'hôte et appliquer le bon template. */
export function planServeur(p: ParamsZbx): string {
  const tpl = p.os === 'windows' ? 'Windows by Zabbix agent' : 'Linux by Zabbix agent';
  const grp = p.os === 'windows' ? 'Windows servers' : 'Linux servers';
  const l = [
    '# Interface web du serveur Zabbix : Collecte de données ▸ Hôtes ▸ Créer un hôte',
    `#   Nom de l'hôte   : ${host(p)}     (identique au Hostname= de l'agent, surtout en mode actif)`,
    `#   Groupes d'hôtes : ${grp}`,
    '#   Interface       : Agent',
    `#       Adresse IP  : <IP de ${host(p)}>`,
    `#       Port        : ${port(p)}`,
    `#   Onglet Modèles  : « ${tpl} »`,
  ];
  if (p.psk) {
    l.push('#   Onglet Chiffrement : Connexions = PSK ; PSK identity + PSK (la clé hex générée).');
  }
  l.push('# Au bout de ~1 min, l\'hôte passe en vert (ZBX) et les items du template remontent.');
  return l.join('\n');
}

/** Tests depuis le serveur (paquet zabbix-get). */
export function planVerif(p: ParamsZbx): string {
  return [
    '# Depuis le serveur Zabbix (paquet zabbix-get) :',
    `zabbix_get -s <IP_DE_${host(p).toUpperCase().replace(/[^A-Z0-9]/g, '_')}> -k agent.ping     # -> 1`,
    `zabbix_get -s <IP_HOTE> -k system.uname`,
    '# Sur l\'hôte, l\'agent écoute bien :',
    p.os === 'windows'
      ? `#   Get-NetTCPConnection -LocalPort ${port(p)}`
      : `ss -ltnp | grep ${port(p)}`,
  ].join('\n');
}

export function genererZbx(p: ParamsZbx): SectionZbx[] {
  const s: SectionZbx[] = [];
  if (p.os === 'debian') {
    s.push({ id: 'conf', titre: `Fichier ${CONF_LINUX}`, code: confAgent(p), script: false });
    s.push({ id: 'install', titre: '① Installer l\'agent (Debian) — script complet', code: scriptDebian(p), script: true });
  } else {
    s.push({ id: 'conf', titre: `Fichier ${CONF_WIN}`, code: confAgent(p), script: false });
    s.push({ id: 'windows', titre: '① Installer l\'agent (Windows) — PowerShell admin', code: scriptWindows(p), script: false });
  }
  s.push({ id: 'serveur', titre: '② Côté serveur Zabbix : ajouter l\'hôte + template', code: planServeur(p), script: false });
  s.push({ id: 'verif', titre: 'Vérifier', code: planVerif(p), script: false });
  return s;
}

/** Version « console » : le script d'install s'enregistre dans ~/ puis se lance. */
export function pourConsoleZbx(sec: SectionZbx): string {
  if (!sec.script) return sec.code;
  return `cat > ~/install-zabbix-agent.sh <<'FIN_SCRIPT_TSSR'\n${sec.code}\nFIN_SCRIPT_TSSR\nsudo bash ~/install-zabbix-agent.sh`;
}

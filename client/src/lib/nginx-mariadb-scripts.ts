/**
 * Générateur d'installation d'un serveur web **nginx + PHP + MariaDB** (pile
 * « LEMP ») pour des VM Debian du labo.
 *
 * Options couvertes :
 *   - IP et réseaux (adresse fixe posée par le script) ;
 *   - une ou **deux machines** (nginx d'un côté, MariaDB de l'autre) ;
 *   - l'**enregistrement DNS** du site (BIND, Windows/AD, ou /etc/hosts) ;
 *   - le **port forwarding** pour publier le site (pfSense / OPNsense / Cisco) ;
 *   - la mise **derrière un load balancer** (renvoi au configurateur dédié).
 *
 * Réutilise les briques communes des autres configurateurs (entête, identité du
 * clone, adresse fixe, séquence réseau).
 */
import {
  entete, identiteGenerique, reseauGenerique, sequenceReseau, finReseau,
  enFichier, nomHote, MDP, type Reseau,
} from './web-db-scripts';

export type VarianteFw = 'pfsense' | 'opnsense' | 'cisco';
export type ModeDns = 'bind' | 'windows' | 'hosts';

export type ParamsNd = {
  separe: boolean;        // nginx et MariaDB sur deux machines
  // Web (nginx + PHP)
  vmWeb: string; ipWeb: string; cidrWeb: string; gwWeb: string; dnsWeb: string; ifaceWeb: string;
  domaine: string;        // FQDN du site (ex. www.entreprise.lan)
  mdpSysteme: boolean;
  // Base (MariaDB)
  vmBdd: string; ipBdd: string; cidrBdd: string; gwBdd: string; dnsBdd: string; ifaceBdd: string;
  bdd: string; dbUser: string;
  // DNS
  dns: boolean; dnsMode: ModeDns; dnsServeur: string;
  // Port forwarding
  pf: boolean; pfVariante: VarianteFw; pfWan: string; pfWanIf: string; pfPorts: string;
  // Load balancer
  lb: boolean; lbIp: string;
};

export type SectionNd = { id: string; titre: string; code: string; script: boolean };

const IP_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
export const ipValide = (s: string) => IP_RE.test((s || '').trim());
const fqdnValide = (s: string) => /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test((s || '').trim());

const MASQUES: Record<string, string> = {
  '8': '255.0.0.0', '16': '255.255.0.0', '22': '255.255.252.0', '23': '255.255.254.0',
  '24': '255.255.255.0', '25': '255.255.255.128', '26': '255.255.255.192', '27': '255.255.255.224',
  '28': '255.255.255.240', '29': '255.255.255.248', '30': '255.255.255.252',
};
export const masque = (cidr: string) => MASQUES[String(cidr)] || '255.255.255.0';

/** L'IP publiée (celle vers laquelle pointent DNS et port-forward) : le LB s'il existe, sinon le web. */
export const ipPubliee = (p: ParamsNd) => (p.lb && ipValide(p.lbIp) ? p.lbIp.trim() : p.ipWeb.trim());
/** Le nom d'hôte de la base vue depuis le web : IP distante si séparé, sinon localhost. */
const hoteBdd = (p: ParamsNd) => (p.separe ? p.ipBdd.trim() : '127.0.0.1');
/** L'hôte autorisé côté MariaDB pour l'utilisateur applicatif. */
const grantHost = (p: ParamsNd) => (p.separe ? p.ipWeb.trim() : 'localhost');
/** Découpe un FQDN en label + zone (www.entreprise.lan → www / entreprise.lan). */
function labelZone(fqdn: string): { label: string; zone: string } {
  const parts = (fqdn || '').trim().replace(/\.$/, '').split('.');
  if (parts.length < 2) return { label: '@', zone: fqdn || 'entreprise.lan' };
  return { label: parts[0], zone: parts.slice(1).join('.') };
}

function ecrire(chemin: string, contenu: string, marqueur = 'FIN'): string[] {
  return [`cat > ${chemin} <<'${marqueur}'`, contenu, marqueur];
}

// ── Script du serveur web (nginx + PHP + MariaDB local si mono-machine) ────────

function vhostNginx(p: ParamsNd): string {
  const { zone } = labelZone(p.domaine);
  const nom = p.domaine.trim() || 'site.lan';
  return [
    `server {`,
    `    listen 80;`,
    `    server_name ${nom} ${p.ipWeb.trim()};`,
    `    root /var/www/${nom};`,
    `    index index.php index.html;`,
    `    location / { try_files $uri $uri/ =404; }`,
    `    location ~ \\.php$ {`,
    `        include snippets/fastcgi-php.conf;`,
    `        fastcgi_pass unix:__PHPFPM__;`,
    `    }`,
    `    access_log /var/log/nginx/${zone}_access.log;`,
    `}`,
  ].join('\n');
}

function indexPhp(p: ParamsNd): string {
  return [
    '<?php',
    `$db = @new mysqli('${hoteBdd(p)}', '${p.dbUser.trim()}', '${MDP}', '${p.bdd.trim()}');`,
    "header('Content-Type: text/plain; charset=utf-8');",
    "if ($db->connect_errno) { echo \"nginx + PHP : OK\\nMariaDB : KO -> \".$db->connect_error; }",
    `else { echo "nginx + PHP + MariaDB : OK\\nBase '${p.bdd.trim()}' jointe sur ${hoteBdd(p)}"; }`,
  ].join('\n');
}

function sqlCreation(p: ParamsNd): string[] {
  const h = grantHost(p);
  return [
    `mysql <<'SQL'`,
    `CREATE DATABASE IF NOT EXISTS \`${p.bdd.trim()}\` CHARACTER SET utf8mb4;`,
    `CREATE USER IF NOT EXISTS '${p.dbUser.trim()}'@'${h}' IDENTIFIED BY '${MDP}';`,
    `GRANT ALL PRIVILEGES ON \`${p.bdd.trim()}\`.* TO '${p.dbUser.trim()}'@'${h}';`,
    `FLUSH PRIVILEGES;`,
    `SQL`,
  ];
}

function corpsWeb(p: ParamsNd): string[] {
  const nom = p.domaine.trim() || 'site.lan';
  const paquets = p.separe ? 'nginx php-fpm php-mysql mariadb-client' : 'nginx php-fpm php-mysql mariadb-server';
  const l: string[] = [];
  l.push('');
  l.push('etape "Installation de la pile web (nginx + PHP)"');
  l.push('apt_essais apt-get update');
  l.push(`apt_essais apt-get install -y ${paquets}`);
  l.push('');
  l.push('etape "Hôte virtuel nginx + page de test PHP"');
  l.push('PHPFPM=$(ls /run/php/php*-fpm.sock 2>/dev/null | head -1)');
  l.push('[ -n "$PHPFPM" ] || { echo "ERREUR: socket php-fpm introuvable"; exit 1; }');
  l.push(`mkdir -p /var/www/${nom}`);
  l.push(...ecrire(`/var/www/${nom}/index.php`, indexPhp(p), 'PHP'));
  l.push(...ecrire(`/etc/nginx/sites-available/${nom}.conf`, vhostNginx(p), 'NGINX'));
  l.push(`sed -i "s#__PHPFPM__#$PHPFPM#" /etc/nginx/sites-available/${nom}.conf`);
  l.push(`ln -sf /etc/nginx/sites-available/${nom}.conf /etc/nginx/sites-enabled/${nom}.conf`);
  l.push('rm -f /etc/nginx/sites-enabled/default');
  l.push('nginx -t');
  l.push('systemctl enable nginx >/dev/null 2>&1 || true');
  l.push('systemctl reload nginx 2>/dev/null || systemctl restart nginx');
  if (!p.separe) {
    l.push('');
    l.push('etape "Base MariaDB locale"');
    l.push('systemctl enable --now mariadb');
    l.push(...sqlCreation(p));
  } else {
    l.push('');
    l.push(`# La base est sur ${p.ipBdd.trim()} : exécute d'abord le script du serveur MariaDB (section ②).`);
  }
  l.push('');
  l.push(`echo "OK : http://${p.ipWeb.trim()}/  (et http://${nom}/ une fois le DNS en place)."`);
  return l;
}

export function scriptWeb(p: ParamsNd): string {
  const nom = nomHote(p.vmWeb);
  const hotes: [string, string][] = [[p.ipWeb.trim(), `${labelZone(p.domaine).label === '@' ? nom : p.domaine.trim()} ${nom}`]];
  if (p.separe) hotes.push([p.ipBdd.trim(), nomHote(p.vmBdd)]);
  const reseau: Reseau = { ip: p.ipWeb.trim(), cidr: p.cidrWeb, gw: p.gwWeb.trim(), dns: (p.dnsWeb || p.gwWeb).trim() };
  const corps = [
    ...entete(`Serveur web nginx + PHP${p.separe ? '' : ' + MariaDB'} — ${p.ipWeb.trim()}`, nom),
    '',
    ...identiteGenerique(nom, hotes, p.mdpSysteme),
    ...reseauGenerique(reseau, p.ifaceWeb),
    '',
    ...sequenceReseau(p.separe ? 'nginx php-fpm php-mysql mariadb-client' : 'nginx php-fpm php-mysql mariadb-server'),
    'identite',
    ...finReseau(),
    ...corpsWeb(p),
  ].join('\n');
  return enFichier(corps, '~/serveur-web.sh');
}

// ── Script du serveur de base de données (si séparé) ──────────────────────────

function corpsBdd(p: ParamsNd): string[] {
  const l: string[] = [];
  l.push('');
  l.push('etape "Installation de MariaDB"');
  l.push('apt_essais apt-get update');
  l.push('apt_essais apt-get install -y mariadb-server');
  l.push('');
  l.push('etape "Écoute sur le réseau (pour le serveur web)"');
  l.push('CNF=$(ls /etc/mysql/mariadb.conf.d/50-server.cnf /etc/mysql/my.cnf 2>/dev/null | head -1)');
  l.push(`sed -i "s/^bind-address.*/bind-address = 0.0.0.0/" "$CNF"`);
  l.push('systemctl enable --now mariadb');
  l.push('systemctl restart mariadb');
  l.push('');
  l.push('etape "Base et utilisateur applicatif"');
  l.push(...sqlCreation(p));
  l.push('');
  l.push(`# Pare-feu : n'ouvrir 3306 que depuis le serveur web (${p.ipWeb.trim()}).`);
  l.push(`command -v ufw >/dev/null && ufw allow from ${p.ipWeb.trim()} to any port 3306 proto tcp || true`);
  l.push('');
  l.push(`echo "OK : MariaDB prête sur ${p.ipBdd.trim()}:3306 (base ${p.bdd.trim()})."`);
  return l;
}

export function scriptBdd(p: ParamsNd): string {
  const nom = nomHote(p.vmBdd);
  const hotes: [string, string][] = [[p.ipBdd.trim(), nom], [p.ipWeb.trim(), nomHote(p.vmWeb)]];
  const reseau: Reseau = { ip: p.ipBdd.trim(), cidr: p.cidrBdd, gw: p.gwBdd.trim(), dns: (p.dnsBdd || p.gwBdd).trim() };
  const corps = [
    ...entete(`Serveur MariaDB — ${p.ipBdd.trim()}`, nom),
    '',
    ...identiteGenerique(nom, hotes, p.mdpSysteme),
    ...reseauGenerique(reseau, p.ifaceBdd),
    '',
    ...sequenceReseau('mariadb-server'),
    'identite',
    ...finReseau(),
    ...corpsBdd(p),
  ].join('\n');
  return enFichier(corps, '~/serveur-bdd.sh');
}

// ── DNS ───────────────────────────────────────────────────────────────────────

function planDns(p: ParamsNd): string {
  const { label, zone } = labelZone(p.domaine);
  const ip = ipPubliee(p);
  const cible = p.lb && ipValide(p.lbIp) ? `${ip}  (le load balancer)` : `${ip}  (le serveur web)`;
  if (p.dnsMode === 'windows') {
    return [
      `# Enregistrement A sur le DNS Windows / AD (serveur ${p.dnsServeur.trim() || '<DC>'})`,
      `# ${p.domaine.trim()} -> ${cible}`,
      `Add-DnsServerResourceRecordA -ComputerName ${p.dnsServeur.trim() || '<DC>'} \``,
      `    -ZoneName '${zone}' -Name '${label}' -IPv4Address '${ip}'`,
    ].join('\n');
  }
  if (p.dnsMode === 'hosts') {
    return [
      `# Sans serveur DNS : ligne à ajouter dans /etc/hosts (Linux) ou`,
      `# C:\\Windows\\System32\\drivers\\etc\\hosts (Windows) de CHAQUE client`,
      `${ip}    ${p.domaine.trim()}`,
    ].join('\n');
  }
  return [
    `# Enregistrement A dans la zone BIND « ${zone} » (serveur DNS ${p.dnsServeur.trim() || '<IP DNS>'})`,
    `# Ajouter la ligne dans /etc/bind/zones/db.${zone}, PUIS incrémenter le Serial (SOA) :`,
    `${label.padEnd(15)} IN      A       ${ip}`,
    `#   ${p.domaine.trim()} -> ${cible}`,
    `# Recharger :  named-checkzone ${zone} /etc/bind/zones/db.${zone} && rndc reload ${zone}`,
    `# (Le configurateur BIND9 du site génère la zone complète : /pages/configurateur-bind9)`,
  ].join('\n');
}

// ── Port forwarding ────────────────────────────────────────────────────────────

function planPortForward(p: ParamsNd): string {
  const ip = ipPubliee(p);
  const ports = (p.pfPorts || '80,443').split(/[\s,;]+/).filter(Boolean);
  if (p.pfVariante === 'cisco') {
    const l = [
      `! Publier le serveur web via NAT statique (Cisco IOS) — WAN ${p.pfWan.trim() || '<IP WAN>'}`,
      `interface ${p.pfWanIf.trim() || 'GigabitEthernet0/1'}`,
      ` ip nat outside`,
      `!`,
    ];
    for (const port of ports) l.push(`ip nat inside source static tcp ${ip} ${port} ${p.pfWan.trim() || '<IP_WAN>'} ${port} extendable`);
    l.push('! (l\'interface interne doit porter « ip nat inside »)');
    return l.join('\n');
  }
  const menu = p.pfVariante === 'opnsense' ? 'Firewall ▸ NAT ▸ Port Forward' : 'Firewall ▸ NAT ▸ Port Forward';
  const l = [
    `# Publier le serveur web — ${p.pfVariante === 'opnsense' ? 'OPNsense' : 'pfSense'}.  Menu : ${menu}`,
    '# Une règle par port (une association WAN -> serveur web) :',
  ];
  for (const port of ports) {
    l.push('');
    l.push(`[Port Forward ${port}]`);
    l.push(`    Interface            WAN`);
    l.push(`    Protocol             TCP`);
    l.push(`    Destination          WAN address`);
    l.push(`    Destination port     ${port}`);
    l.push(`    Redirect target IP   ${ip}`);
    l.push(`    Redirect target port ${port}`);
    l.push(`    Filter rule assoc.   « Add associated filter rule » (crée la règle WAN qui autorise)`);
  }
  l.push('');
  l.push('# Le configurateur pfSense / OPNsense du site pose ce NAT dans le plan complet.');
  return l.join('\n');
}

// ── Load balancer (renvoi au configurateur dédié) ─────────────────────────────

function planLb(p: ParamsNd): string {
  return [
    '# Mettre le site derrière un load balancer nginx',
    `# Le répartiteur (${p.lbIp.trim() || '<IP du LB>'}) reçoit le trafic ; ce serveur web est un backend.`,
    '# Bloc upstream à placer sur le load balancer (extrait) :',
    'upstream web_backend {',
    `    server ${p.ipWeb.trim()}:80 max_fails=3 fail_timeout=10s;`,
    '    # ajoute ici les autres serveurs web (réplique, montée en charge) ;',
    '    # une réplique en secours se déclare :  server <ip>:80 backup;',
    '}',
    '',
    '# Le DNS et le port-forward pointent alors vers le LB, pas vers ce serveur.',
    '# Génère le load balancer complet (health checks, HTTPS, keepalived/VIP) :',
    '#   /pages/configurateur-loadbalancer',
  ].join('\n');
}

// ── assemblage ─────────────────────────────────────────────────────────────────

export function genererNd(p: ParamsNd): SectionNd[] {
  const s: SectionNd[] = [
    { id: 'web', titre: `① Dans ${p.vmWeb} — serveur web nginx${p.separe ? ' + PHP' : ' + PHP + MariaDB'}`, code: scriptWeb(p), script: true },
  ];
  if (p.separe) s.push({ id: 'bdd', titre: `② Dans ${p.vmBdd} — serveur MariaDB`, code: scriptBdd(p), script: true });
  const n = p.separe ? '③' : '②';
  if (p.dns) s.push({ id: 'dns', titre: `${n} Enregistrement DNS`, code: planDns(p), script: false });
  if (p.pf) s.push({ id: 'pf', titre: 'Port forwarding (publier le site)', code: planPortForward(p), script: false });
  if (p.lb) s.push({ id: 'lb', titre: 'Load balancer (frontal)', code: planLb(p), script: false });
  s.push({ id: 'verif', titre: 'Vérifier', code: planVerif(p), script: false });
  return s;
}

function planVerif(p: ParamsNd): string {
  const l = [
    '# Vérifier le serveur web',
    `curl -I http://${p.ipWeb.trim()}/            # nginx repond (200)`,
    `curl -s http://${p.ipWeb.trim()}/index.php   # doit afficher "nginx + PHP + MariaDB : OK"`,
  ];
  if (p.separe) l.push(`# Depuis le web, tester la base :  mysql -h ${p.ipBdd.trim()} -u ${p.dbUser.trim()} -p ${p.bdd.trim()}`);
  if (p.dns) l.push(`# La résolution du nom :  dig +short ${p.domaine.trim()}   ->  attendu ${ipPubliee(p)}`);
  if (p.pf) l.push(`# Depuis l'extérieur :  curl -I http://${p.pfWan.trim() || '<IP WAN>'}/`);
  if (p.lb) l.push(`# Via le load balancer :  curl -I http://${p.lbIp.trim() || '<IP LB>'}/`);
  return l.join('\n');
}

/** Version « console » : le script s'enregistre dans ~/ puis se lance. */
export function pourConsoleNd(sec: SectionNd): string {
  if (!sec.script) return sec.code;
  const cible = `~/${sec.id === 'web' ? 'serveur-web' : 'serveur-bdd'}.sh`;
  return `cat > ${cible} <<'FIN_SCRIPT_TSSR'\n${sec.code}\nFIN_SCRIPT_TSSR\nsudo bash ${cible}`;
}

export { fqdnValide };

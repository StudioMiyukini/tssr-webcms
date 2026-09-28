/**
 * Générateur de configuration d'un load balancer **nginx** pour une VM Debian
 * du labo.
 *
 * À partir d'une IP de répartiteur, d'un réseau, d'une liste de backends et d'un
 * algorithme, produit : le script d'installation du load balancer (adresse fixe,
 * nginx, bloc `upstream` + serveur proxy, health checks passifs, serveur de
 * secours, persistance, page `stub_status`, terminaison TLS optionnelle), un
 * script `keepalived` pour la haute disponibilité (IP virtuelle) quand une VIP
 * est donnée, et un bloc de vérification (curl + état nginx).
 *
 * Réutilise les briques communes des autres configurateurs (entête, identité du
 * clone, adresse fixe, séquence réseau) pour rester cohérent.
 */
import {
  entete, identiteGenerique, reseauGenerique, sequenceReseau, finReseau,
  enFichier, nomHote, MDP, type Reseau,
} from './web-db-scripts';

export type Algo = 'roundrobin' | 'least_conn' | 'ip_hash';

export type ParamsLb = {
  vm: string;            // nom de la VM du load balancer
  ip: string;            // IP du load balancer
  cidr: string;          // masque (CIDR)
  gw: string;            // passerelle
  dns: string;           // DNS (souvent la passerelle ou le DC)
  iface: string;         // carte forcée (optionnel)
  mdpSysteme: boolean;   // poser le mot de passe du labo sur root
  serverName: string;    // server_name (ex. www.bordeaux.local, ou _ )
  algo: Algo;            // algorithme de répartition
  backends: string;      // textarea : "ip[:port] [weight=N] [backup]" par ligne
  maxFails: string;      // health check passif : nb d'échecs
  failTimeout: string;   // health check passif : délai (s)
  tls: boolean;          // terminaison HTTPS (cert auto-signé pour le labo)
  status: boolean;       // page stub_status
  statusAllow: string;   // réseau autorisé pour /nginx_status
  vip: string;           // IP virtuelle keepalived (vide = pas de HA)
  ifaceHa: string;       // interface VRRP (défaut = iface / eth0)
  role: 'MASTER' | 'BACKUP'; // rôle de CE nœud pour keepalived
};

export type SectionLb = { id: 'lb' | 'keepalived' | 'verif'; titre: string; code: string; fichier: string };

export type Backend = { host: string; port: number; weight?: number; backup?: boolean };

const IP_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
export const ipValide = (s: string) => IP_RE.test(s.trim());
const hoteValide = (s: string) => ipValide(s) || /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i.test(s);

/** Analyse le textarea des backends : "ip[:port] [weight=N] [backup]" par ligne. */
export function listeBackends(txt: string): Backend[] {
  const out: Backend[] = [];
  for (const ligne of txt.split('\n')) {
    const toks = ligne.trim().split(/[\s,;]+/).filter(Boolean);
    if (!toks.length) continue;
    const [hostRaw, portRaw] = toks[0].split(':');
    if (!hoteValide(hostRaw)) continue;
    const b: Backend = { host: hostRaw, port: portRaw ? Number(portRaw) || 80 : 80 };
    for (const t of toks.slice(1)) {
      if (/^backup$/i.test(t)) b.backup = true;
      else { const m = t.match(/^(?:weight=)?(\d+)$/i); if (m) b.weight = Number(m[1]); }
    }
    out.push(b);
  }
  return out;
}

const LIBELLE_ALGO: Record<Algo, string> = {
  roundrobin: 'round-robin (défaut)',
  least_conn: 'least_conn (moins de connexions)',
  ip_hash: 'ip_hash (persistance par IP)',
};
export const libelleAlgo = (a: Algo) => LIBELLE_ALGO[a];

const cnPourCert = (p: ParamsLb) => (p.serverName && p.serverName !== '_' ? p.serverName : p.ip);

/** Le contenu du fichier /etc/nginx/conf.d/loadbalancer.conf. */
export function confNginx(p: ParamsLb): string {
  const backends = listeBackends(p.backends);
  const mf = Number(p.maxFails) || 3;
  const ft = Number(p.failTimeout) || 10;
  const l: string[] = [];
  l.push('# /etc/nginx/conf.d/loadbalancer.conf');
  l.push('upstream web_backend {');
  if (p.algo !== 'roundrobin') l.push(`    ${p.algo};`);
  for (const b of backends) {
    if (b.backup) {
      l.push(`    server ${b.host}:${b.port} backup;`);
    } else {
      const poids = b.weight ? ` weight=${b.weight}` : '';
      l.push(`    server ${b.host}:${b.port}${poids} max_fails=${mf} fail_timeout=${ft}s;`);
    }
  }
  l.push('}');
  l.push('');

  const loc = [
    '    location / {',
    '        proxy_pass http://web_backend;',
    '        proxy_set_header Host              $host;',
    '        proxy_set_header X-Real-IP         $remote_addr;',
    '        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;',
    '        proxy_set_header X-Forwarded-Proto $scheme;',
    '        proxy_connect_timeout 3s;',
    '        proxy_next_upstream error timeout http_502 http_503 http_504;',
    '    }',
    '    access_log /var/log/nginx/lb_access.log;',
    '    error_log  /var/log/nginx/lb_error.log;',
  ];

  if (p.tls) {
    l.push('server {                                   # rediriger le 80 vers le 443');
    l.push('    listen 80;');
    l.push(`    server_name ${p.serverName};`);
    l.push('    return 301 https://$host$request_uri;');
    l.push('}');
    l.push('');
    l.push('server {');
    l.push('    listen 443 ssl;');
    l.push(`    server_name ${p.serverName};`);
    l.push('    ssl_certificate     /etc/nginx/certs/site.crt;');
    l.push('    ssl_certificate_key /etc/nginx/certs/site.key;');
    l.push(...loc);
    l.push('}');
  } else {
    l.push('server {');
    l.push('    listen 80;');
    l.push(`    server_name ${p.serverName};`);
    l.push(...loc);
    l.push('}');
  }

  if (p.status) {
    l.push('');
    l.push('server {                                   # etat de nginx');
    l.push('    listen 8080;');
    l.push('    location /nginx_status {');
    l.push('        stub_status;');
    l.push('        allow 127.0.0.1;');
    if (p.statusAllow.trim()) l.push(`        allow ${p.statusAllow.trim()};`);
    l.push('        deny all;');
    l.push('    }');
    l.push('}');
  }
  return l.join('\n');
}

/** Écrit un fichier via un heredoc « quoté » (aucune expansion du shell : $host reste littéral). */
function ecrire(chemin: string, contenu: string, marqueur = 'FIN_CONF'): string[] {
  return [`cat > ${chemin} <<'${marqueur}'`, contenu, marqueur];
}

function corpsLb(p: ParamsLb): string[] {
  const l: string[] = [];
  l.push('');
  l.push('etape "Installation de nginx"');
  l.push('apt_essais apt-get update');
  l.push(`apt_essais apt-get install -y nginx${p.tls ? ' openssl' : ''}`);
  if (p.vip.trim()) {
    l.push('');
    l.push('# La VIP keepalived pourra ne pas etre montee localement (noeud BACKUP) : nginx doit pouvoir la binder.');
    l.push('echo "net.ipv4.ip_nonlocal_bind = 1" > /etc/sysctl.d/90-nginx.conf');
    l.push('sysctl --system >/dev/null');
  }
  l.push('');
  l.push('etape "Retrait du site par defaut (il occupe le port 80)"');
  l.push('rm -f /etc/nginx/sites-enabled/default');
  if (p.tls) {
    l.push('');
    l.push('etape "Certificat TLS auto-signe (labo)"');
    l.push('mkdir -p /etc/nginx/certs');
    l.push('if [ ! -s /etc/nginx/certs/site.key ]; then');
    l.push(`    openssl req -x509 -nodes -newkey rsa:2048 -days 825 -keyout /etc/nginx/certs/site.key -out /etc/nginx/certs/site.crt -subj "/CN=${cnPourCert(p)}"`);
    l.push('    chmod 600 /etc/nginx/certs/site.key');
    l.push('fi');
  }
  l.push('');
  l.push('etape "Configuration du load balancer"');
  l.push(...ecrire('/etc/nginx/conf.d/loadbalancer.conf', confNginx(p)));
  l.push('');
  l.push('etape "Test de la configuration"');
  l.push('nginx -t');
  l.push('');
  l.push('etape "Demarrage"');
  l.push('systemctl enable nginx >/dev/null 2>&1 || true');
  l.push('systemctl reload nginx 2>/dev/null || systemctl restart nginx');
  l.push('sleep 1');
  l.push('systemctl is-active --quiet nginx || { echo "ERREUR: nginx n\'a pas demarre"; journalctl -u nginx -n 30 --no-pager; exit 1; }');
  l.push('');
  l.push(`echo "OK : load balancer nginx pret sur ${p.ip} (${listeBackends(p.backends).length} backends)."`);
  return l;
}

export function scriptLb(p: ParamsLb): string {
  const nom = nomHote(p.vm);
  const reseau: Reseau = { ip: p.ip, cidr: p.cidr, gw: p.gw, dns: p.dns || p.gw };
  const corps = [
    ...entete(`Load balancer nginx — ${p.ip}`, nom),
    '',
    ...identiteGenerique(nom, [[p.ip, nom]], p.mdpSysteme),
    ...reseauGenerique(reseau, p.iface),
    '',
    ...sequenceReseau(p.tls ? 'nginx openssl' : 'nginx'),
    'identite',
    ...finReseau(),
    ...corpsLb(p),
  ].join('\n');
  return enFichier(corps, '~/loadbalancer.sh');
}

/** Le contenu du fichier /etc/keepalived/keepalived.conf pour ce nœud. */
export function confKeepalived(p: ParamsLb): string {
  const prio = p.role === 'MASTER' ? 110 : 100;
  const iface = p.ifaceHa.trim() || p.iface.trim() || 'eth0';
  return [
    `# /etc/keepalived/keepalived.conf  (${p.role})`,
    'vrrp_script chk_nginx {',
    '    script "/usr/bin/killall -0 nginx"     # 0 = nginx vivant',
    '    interval 2',
    '    weight 2',
    '}',
    '',
    'vrrp_instance VI_1 {',
    `    state ${p.role}`,
    `    interface ${iface}`,
    '    virtual_router_id 51',
    `    priority ${prio}                            # l'autre noeud : ${p.role === 'MASTER' ? 'BACKUP / 100' : 'MASTER / 110'}`,
    '    advert_int 1',
    `    authentication { auth_type PASS; auth_pass ${MDP} }`,
    `    virtual_ipaddress { ${p.vip}/${p.cidr} }`,
    '    track_script { chk_nginx }',
    '}',
  ].join('\n');
}

function corpsKeepalived(p: ParamsLb): string[] {
  const l: string[] = [];
  l.push('');
  l.push('etape "Installation de keepalived"');
  l.push('apt_essais apt-get update');
  l.push('apt_essais apt-get install -y keepalived psmisc');
  l.push('');
  l.push('etape "Configuration VRRP (IP virtuelle)"');
  l.push(...ecrire('/etc/keepalived/keepalived.conf', confKeepalived(p), 'FIN_VRRP'));
  l.push('');
  l.push('etape "Demarrage"');
  l.push('systemctl enable keepalived >/dev/null 2>&1 || true');
  l.push('systemctl restart keepalived');
  l.push('sleep 2');
  l.push(`ip -4 addr show | grep -q " ${p.vip}/" && echo "VIP ${p.vip} portee par ce noeud (${p.role})." || echo "VIP ${p.vip} non portee ici (normal sur le BACKUP tant que le MASTER est vivant)."`);
  return l;
}

export function scriptKeepalived(p: ParamsLb): string {
  const nom = nomHote(p.vm);
  const corps = [
    ...entete(`Haute dispo nginx (keepalived) — VIP ${p.vip} — noeud ${p.role}`, nom),
    ...corpsKeepalived(p),
  ].join('\n');
  return enFichier(corps, '~/keepalived.sh');
}

export function scriptVerif(p: ParamsLb): string {
  const backends = listeBackends(p.backends);
  const front = p.vip.trim() || p.ip;
  const proto = p.tls ? 'https' : 'http';
  const l: string[] = [];
  l.push('# Verifier le load balancer nginx.');
  l.push('');
  l.push('# 1) Chaque backend repond bien en direct :');
  for (const b of backends) l.push(`curl -I http://${b.host}:${b.port}`);
  l.push('');
  l.push('# 2) Le load balancer repartit (repeter la requete) :');
  l.push(`for i in $(seq 1 6); do curl -sk ${proto}://${front}/ | head -1; done`);
  if (p.status) {
    l.push('');
    l.push('# 3) Etat de nginx (connexions, requetes) :');
    l.push(`curl -s http://${p.ip}:8080/nginx_status`);
  }
  l.push('');
  l.push('# 4) Eprouver la bascule : arreter un backend, puis refaire le test 2.');
  l.push(`#    Apres max_fails=${Number(p.maxFails) || 3} echecs, nginx l'ecarte pendant ${Number(p.failTimeout) || 10}s.`);
  if (p.vip.trim()) {
    l.push('');
    l.push('# 5) Haute dispo : arreter nginx (ou keepalived) sur le MASTER ->');
    l.push(`#    la VIP ${p.vip} migre sur le BACKUP, le service continue.`);
  }
  l.push('');
  l.push('# Logs utiles : /var/log/nginx/lb_access.log (backend servi) et lb_error.log.');
  return l.join('\n');
}

// ── assemblage ───────────────────────────────────────────────────────────────

export function genererScriptsLb(p: ParamsLb): SectionLb[] {
  const nom = nomHote(p.vm);
  const s: SectionLb[] = [
    { id: 'lb', titre: `① Dans ${p.vm} — load balancer nginx`, code: scriptLb(p), fichier: `loadbalancer-${nom}.sh` },
  ];
  if (p.vip.trim()) {
    s.push({ id: 'keepalived', titre: `② Sur chaque LB — haute dispo keepalived (VIP ${p.vip})`, code: scriptKeepalived(p), fichier: `keepalived-${nom}.sh` });
  }
  s.push({ id: 'verif', titre: `${p.vip.trim() ? '③' : '②'} Vérifier`, code: scriptVerif(p), fichier: 'verif-loadbalancer.txt' });
  return s;
}

/** Version « console » : le script s'enregistre dans ~/ puis se lance. */
export function pourConsoleLb(sec: SectionLb): string {
  if (sec.id === 'verif') return sec.code;
  const cible = `~/${sec.id === 'lb' ? 'loadbalancer' : 'keepalived'}.sh`;
  return `cat > ${cible} <<'FIN_SCRIPT_TSSR'\n${sec.code}\nFIN_SCRIPT_TSSR\nsudo bash ${cible}`;
}

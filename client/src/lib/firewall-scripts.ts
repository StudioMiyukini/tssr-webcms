/**
 * Générateur de configuration pour pare-feu OPNsense / pfSense.
 *
 * Ces boîtiers ne se configurent pas en ligne de commande mais par leur
 * interface web (et, pour pfSense, par restauration de config.xml zone par
 * zone). L'outil produit donc :
 *   1. un PLAN de configuration précis, section par section, avec le chemin de
 *      menu exact et les valeurs de chaque champ — dialecte OPNsense ou pfSense ;
 *   2. pour pfSense, le config.xml par zone (restaurable via « Restore area »).
 *
 * OPNsense ne permet pas la restauration partielle depuis l'interface (restore
 * complet uniquement) : on s'en tient au plan, qui est de toute façon la façon
 * dont on configure ces boîtiers en TP.
 */
export type Variante = 'opnsense' | 'pfsense';

export type ClefIface = 'wan' | 'lan' | 'opt1' | 'opt2' | 'opt3';
export type Iface = {
  clef: ClefIface;
  ifPhys: string;      // carte physique (hn0, em0, vtnet0…)
  descr: string;       // nom lisible (LAN, LAN_SRV, DMZ…)
  mode: 'dhcp' | 'static';
  ip: string;          // si static
  cidr: string;        // si static
  gw: string;          // WAN static : passerelle
  dhcpFrom: string;    // plage DHCP (interne)
  dhcpTo: string;
};

export type ParamsFw = {
  variante: Variante;
  hostname: string;
  domaine: string;
  dns: string;         // résolveurs (espace/virgule)
  fuseau: string;      // ex. Europe/Paris
  interfaces: Iface[];
  aliases: string;     // « nom type contenu… » par ligne
  nat: string;         // « iface proto portPublic ipCible portCible description » par ligne
  regles: string;      // « iface action proto source destination port description » par ligne
  routes: string;      // « réseau/cidr passerelle description » par ligne
  vpn: boolean;        // activer la section OpenVPN accès nomade
  vpnReseau: string;   // réseau du tunnel (ex. 10.0.8.0/24)
  vpnLocaux: string;   // réseaux internes atteignables (poussés)
  vpnAuth: 'cert' | 'cert-user'; // certificat seul, ou certificat + compte
};

export type SectionFw = { id: string; titre: string; code: string };

const IP_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
export const ipValide = (s: string) => IP_RE.test((s || '').trim());
/** Les adresses IPv4 valides d'une saisie (espace/virgule/point-virgule). */
const listeIp = (txt: string): string[] => (txt || '').split(/[\s,;]+/).map(s => s.trim()).filter(ipValide);

const MASQUES: Record<string, string> = {
  '8': '255.0.0.0', '16': '255.255.0.0', '22': '255.255.252.0', '23': '255.255.254.0',
  '24': '255.255.255.0', '25': '255.255.255.128', '26': '255.255.255.192', '27': '255.255.255.224',
  '28': '255.255.255.240', '29': '255.255.255.248', '30': '255.255.255.252',
};
export const masque = (cidr: string) => MASQUES[String(cidr)] || '255.255.255.0';

const LABEL: Record<ClefIface, string> = { wan: 'WAN', lan: 'LAN', opt1: 'OPT1', opt2: 'OPT2', opt3: 'OPT3' };
export const labelIface = (c: ClefIface) => LABEL[c] || c.toUpperCase();

// Chemins de menu selon le dialecte.
const MENUS = {
  opnsense: {
    assign: 'Interfaces ▸ Assignments',
    iface: (l: string) => `Interfaces ▸ [${l}]`,
    dhcp: (l: string) => `Services ▸ ISC DHCPv4 ▸ [${l}]`,
    alias: 'Firewall ▸ Aliases',
    nat: 'Firewall ▸ NAT ▸ Port Forward',
    regles: (l: string) => `Firewall ▸ Rules ▸ ${l}`,
    systeme: 'System ▸ Settings ▸ General',
    gateways: 'System ▸ Gateways ▸ Configuration',
    routes: 'System ▸ Routes ▸ Configuration',
    vpn: 'VPN ▸ OpenVPN ▸ Instances (ou l’assistant : VPN ▸ OpenVPN ▸ Servers)',
    appliquer: 'Enregistrer puis Appliquer les modifications',
  },
  pfsense: {
    assign: 'Interfaces ▸ Assignments',
    iface: (l: string) => `Interfaces ▸ ${l}`,
    dhcp: (l: string) => `Services ▸ DHCP Server ▸ ${l}`,
    alias: 'Firewall ▸ Aliases',
    nat: 'Firewall ▸ NAT ▸ Port Forward',
    regles: (l: string) => `Firewall ▸ Rules ▸ ${l}`,
    systeme: 'System ▸ General Setup',
    gateways: 'System ▸ Routing ▸ Gateways',
    routes: 'System ▸ Routing ▸ Static Routes',
    vpn: 'VPN ▸ OpenVPN ▸ Wizards (Remote Access) — ou Servers ▸ Add',
    appliquer: 'Save puis Apply Changes',
  },
} as const;

// ── parsing des zones de texte ───────────────────────────────────────────────
export type Alias = { nom: string; type: string; contenu: string; descr: string };
export function parseAliases(txt: string): Alias[] {
  const out: Alias[] = [];
  for (const l of txt.split('\n')) {
    const t = l.trim().split(/\s+/).filter(Boolean);
    if (t.length < 3) continue;
    let type = t[1].toLowerCase();
    if (type.startsWith('res') || type.startsWith('net')) type = 'network';
    else if (type.startsWith('host') || type === 'hote') type = 'host';
    else if (type.startsWith('port')) type = 'port';
    else type = 'network';
    out.push({ nom: t[0], type, contenu: t.slice(2).join(' '), descr: '' });
  }
  return out;
}

export type Nat = { iface: string; proto: string; portPublic: string; cible: string; portCible: string; descr: string };
export function parseNat(txt: string): Nat[] {
  const out: Nat[] = [];
  for (const l of txt.split('\n')) {
    const t = l.trim().split(/\s+/).filter(Boolean);
    if (t.length < 4) continue;
    const iface = t[0].toLowerCase();
    const proto = t[1].toLowerCase();
    const portPublic = t[2];
    const cible = t[3];
    if (!ipValide(cible)) continue;
    const portCible = t[4] && /^\d/.test(t[4]) ? t[4] : portPublic;
    const descrStart = t[4] && /^\d/.test(t[4]) ? 5 : 4;
    out.push({ iface, proto, portPublic, cible, portCible, descr: t.slice(descrStart).join(' ') });
  }
  return out;
}

export type Regle = { iface: string; action: string; proto: string; source: string; dest: string; port: string; descr: string };
export function parseRegles(txt: string): Regle[] {
  const out: Regle[] = [];
  for (const l of txt.split('\n')) {
    const t = l.trim().split(/\s+/).filter(Boolean);
    if (t.length < 5) continue;
    const [iface, action, proto, source, dest] = [t[0].toLowerCase(), t[1].toLowerCase(), t[2].toLowerCase(), t[3], t[4]];
    const port = t[5] && /^[\d*]/.test(t[5]) ? t[5] : '';
    const descrStart = port ? 6 : 5;
    out.push({ iface, action: action.startsWith('b') ? 'block' : 'pass', proto, source, dest, port, descr: t.slice(descrStart).join(' ') });
  }
  return out;
}

// ── le plan de configuration (texte, dialecte-aware) ─────────────────────────
function ligne(champ: string, valeur: string) { return `    ${champ.padEnd(26)} ${valeur}`; }

function planInterfaces(p: ParamsFw): string {
  const m = MENUS[p.variante];
  const l: string[] = [`# Menu : ${m.assign} — associer chaque carte, puis ${m.iface('…')} pour l'adressage`];
  for (const it of p.interfaces) {
    const nom = labelIface(it.clef);
    l.push('');
    l.push(`[${nom}]  (carte ${it.ifPhys || '?'}${it.descr ? `, à décrire « ${it.descr} »` : ''})`);
    l.push(ligne('Enable interface', 'coché'));
    if (it.clef !== 'wan' && it.descr) l.push(ligne('Description', it.descr));
    if (it.mode === 'dhcp') {
      l.push(ligne('IPv4 Configuration Type', 'DHCP'));
    } else {
      l.push(ligne('IPv4 Configuration Type', 'Static IPv4'));
      l.push(ligne('IPv4 address', `${it.ip} / ${it.cidr}   (${masque(it.cidr)})`));
      if (it.clef === 'wan' && it.gw) l.push(ligne('IPv4 Upstream Gateway', `${it.gw}  (créer si absent)`));
    }
    if (it.clef === 'wan') l.push(ligne('Block private / bogon', 'décocher en labo (WAN = réseau privé de la salle)'));
  }
  l.push('');
  l.push(`# ${m.appliquer}.`);
  return l.join('\n');
}

function planDhcp(p: ParamsFw): string {
  const m = MENUS[p.variante];
  const internes = p.interfaces.filter(i => i.clef !== 'wan' && i.mode === 'static' && ipValide(i.dhcpFrom) && ipValide(i.dhcpTo));
  const l: string[] = [];
  for (const it of internes) {
    const nom = labelIface(it.clef);
    l.push(`# Menu : ${m.dhcp(nom)}`);
    l.push(`[${nom}]`);
    l.push(ligne('Enable', 'coché'));
    l.push(ligne('Range', `${it.dhcpFrom}  →  ${it.dhcpTo}`));
    l.push(ligne('DNS servers', `${it.ip}  (le pare-feu résout pour le LAN)`));
    l.push(ligne('Gateway', it.ip));
    l.push('');
  }
  return l.join('\n').trimEnd();
}

function planAliases(p: ParamsFw): string {
  const m = MENUS[p.variante];
  const al = parseAliases(p.aliases);
  const l = [`# Menu : ${m.alias} ▸ Add`];
  for (const a of al) {
    l.push('');
    l.push(`[alias ${a.nom}]`);
    l.push(ligne('Type', a.type === 'network' ? 'Network(s)' : a.type === 'host' ? 'Host(s)' : 'Port(s)'));
    l.push(ligne('Content', a.contenu));
  }
  return l.join('\n');
}

function planNat(p: ParamsFw): string {
  const m = MENUS[p.variante];
  const nats = parseNat(p.nat);
  const l = [`# Menu : ${m.nat} ▸ Add`, '# Une redirection = où envoyer le paquet ; la règle de filtrage associée est créée automatiquement.'];
  for (const n of nats) {
    l.push('');
    l.push(`[${n.descr || `${n.proto.toUpperCase()} ${n.portPublic} → ${n.cible}`}]`);
    l.push(ligne('Interface', labelIface(n.iface as ClefIface)));
    l.push(ligne('Protocol', n.proto.toUpperCase()));
    l.push(ligne('Destination', `${labelIface(n.iface as ClefIface)} address`));
    l.push(ligne('Destination port range', n.portPublic));
    l.push(ligne('Redirect target IP', n.cible));
    l.push(ligne('Redirect target port', n.portCible));
    l.push(ligne('Filter rule association', p.variante === 'pfsense' ? 'Add associated filter rule' : 'Ajouter la règle associée'));
  }
  l.push('');
  l.push(`# ${m.appliquer}.`);
  return l.join('\n');
}

function planRegles(p: ParamsFw): string {
  const m = MENUS[p.variante];
  const regles = parseRegles(p.regles);
  const parIface = new Map<string, Regle[]>();
  for (const r of regles) { const k = r.iface; if (!parIface.has(k)) parIface.set(k, []); parIface.get(k)!.push(r); }
  const l: string[] = ['# Ordre : la première règle qui correspond gagne. Placer les blocages spécifiques AU-DESSUS.'];
  for (const [iface, rs] of parIface) {
    l.push('');
    l.push(`# Menu : ${m.regles(labelIface(iface as ClefIface))}`);
    for (const r of rs) {
      l.push(`[${r.action.toUpperCase()}] ${r.descr || `${r.proto} ${r.source}→${r.dest}${r.port ? ':' + r.port : ''}`}`);
      l.push(ligne('Action', r.action === 'block' ? 'Block' : 'Pass'));
      l.push(ligne('Interface', labelIface(iface as ClefIface)));
      l.push(ligne('Protocol', r.proto.toUpperCase()));
      l.push(ligne('Source', r.source));
      l.push(ligne('Destination', r.dest + (r.port && r.port !== '0' && r.port !== '*' ? `  port ${r.port}` : '')));
    }
  }
  l.push('');
  l.push(`# ${m.appliquer}.`);
  return l.join('\n');
}

// ── config.xml par zone (pfSense : Diagnostics ▸ Backup & Restore ▸ Restore area) ──
const esc = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const racine = (v: Variante) => (v === 'pfsense' ? 'pfsense' : 'opnsense');

function xmlAliases(p: ParamsFw): string {
  const al = parseAliases(p.aliases);
  const body = al.map(a =>
    `  <alias>\n    <name>${esc(a.nom)}</name>\n    <type>${a.type}</type>\n    <address>${esc(a.contenu)}</address>\n    <descr>${esc(a.descr || a.nom)}</descr>\n  </alias>`).join('\n');
  return `<?xml version="1.0"?>\n<${racine(p.variante)}>\n <aliases>\n${body}\n </aliases>\n</${racine(p.variante)}>`;
}

function xmlDhcpd(p: ParamsFw): string {
  const internes = p.interfaces.filter(i => i.clef !== 'wan' && i.mode === 'static' && ipValide(i.dhcpFrom) && ipValide(i.dhcpTo));
  const body = internes.map(it =>
    `  <${it.clef}>\n    <enable></enable>\n    <range>\n      <from>${it.dhcpFrom}</from>\n      <to>${it.dhcpTo}</to>\n    </range>\n    <dnsserver>${it.ip}</dnsserver>\n    <gateway>${it.ip}</gateway>\n  </${it.clef}>`).join('\n');
  return `<?xml version="1.0"?>\n<${racine(p.variante)}>\n <dhcpd>\n${body}\n </dhcpd>\n</${racine(p.variante)}>`;
}

function xmlNat(p: ParamsFw): string {
  const nats = parseNat(p.nat);
  const body = nats.map(n =>
    `  <rule>\n    <interface>${n.iface}</interface>\n    <protocol>${n.proto}</protocol>\n    <target>${n.cible}</target>\n    <local-port>${n.portCible}</local-port>\n    <source><any></any></source>\n    <destination>\n      <network>${n.iface}ip</network>\n      <port>${n.portPublic}</port>\n    </destination>\n    <descr>${esc(n.descr || 'NAT')}</descr>\n  </rule>`).join('\n');
  return `<?xml version="1.0"?>\n<${racine(p.variante)}>\n <nat>\n${body}\n </nat>\n</${racine(p.variante)}>`;
}

function xmlFilter(p: ParamsFw): string {
  const regles = parseRegles(p.regles);
  const src = (v: string) => v.toLowerCase() === 'any' ? '<any></any>' : `<address>${esc(v)}</address>`;
  const port = (v: string) => v && v !== '0' && v !== '*';   // "any port" = pas d'élément
  const body = regles.map(r =>
    `  <rule>\n    <type>${r.action}</type>\n    <interface>${r.iface}</interface>\n    <ipprotocol>inet</ipprotocol>\n${r.proto === 'any' ? '' : `    <protocol>${r.proto}</protocol>\n`}    <source>${src(r.source)}</source>\n    <destination>${r.dest.toLowerCase() === 'any' ? '<any></any>' : `<address>${esc(r.dest)}</address>${port(r.port) ? `<port>${esc(r.port)}</port>` : ''}`}</destination>\n    <descr>${esc(r.descr || 'regle')}</descr>\n  </rule>`).join('\n');
  return `<?xml version="1.0"?>\n<${racine(p.variante)}>\n <filter>\n${body}\n </filter>\n</${racine(p.variante)}>`;
}

// ── système, passerelles/routes, VPN ────────────────────────────────────────
export type Route = { reseau: string; passerelle: string; descr: string };
export function parseRoutes(txt: string): Route[] {
  const out: Route[] = [];
  for (const l of txt.split('\n')) {
    const t = l.trim().split(/\s+/).filter(Boolean);
    if (t.length < 2) continue;
    if (!/^\d+\.\d+\.\d+\.\d+\/\d+$/.test(t[0]) || !ipValide(t[1])) continue;
    out.push({ reseau: t[0], passerelle: t[1], descr: t.slice(2).join(' ') });
  }
  return out;
}

function planSysteme(p: ParamsFw): string {
  const m = MENUS[p.variante];
  const dns = listeIp(p.dns);
  const l: string[] = [`# Menu : ${m.systeme}`];
  l.push(ligne('Hostname', p.hostname || 'pfsense'));
  l.push(ligne('Domain', p.domaine || 'lan'));
  if (dns.length) l.push(ligne('DNS servers', dns.join('  ')));
  l.push(ligne('Timezone', p.fuseau || 'Europe/Paris'));
  l.push('');
  l.push('# Astuce : décocher « DNS Server Override » pour garder tes résolveurs même en WAN DHCP.');
  return l.join('\n');
}

function nomPasserelleWan(p: ParamsFw): string | null {
  const wan = p.interfaces.find(i => i.clef === 'wan');
  return wan && wan.mode === 'static' && ipValide(wan.gw) ? wan.gw : null;
}

function planRoutes(p: ParamsFw): string {
  const m = MENUS[p.variante];
  const gw = nomPasserelleWan(p);
  const routes = parseRoutes(p.routes);
  const l: string[] = [];
  if (gw) {
    l.push(`# Passerelle WAN — ${m.gateways} ▸ Add`);
    l.push(ligne('Interface', 'WAN'));
    l.push(ligne('Name', 'GW_WAN'));
    l.push(ligne('Gateway', gw));
    l.push(ligne('Default gateway', 'oui (la route par défaut sort par là)'));
    l.push('');
  }
  if (routes.length) {
    l.push(`# Routes statiques — ${m.routes} ▸ Add`);
    for (const r of routes) {
      l.push(`[${r.descr || r.reseau}]`);
      l.push(ligne('Destination network', r.reseau));
      l.push(ligne('Gateway', `${r.passerelle}  (créer la passerelle si absente)`));
    }
    l.push('');
  }
  l.push(`# ${m.appliquer}.`);
  return l.join('\n');
}

function planVpn(p: ParamsFw): string {
  const m = MENUS[p.variante];
  const locaux = p.vpnLocaux.split(/[\s,;]+/).filter(Boolean).join(', ');
  const url = p.variante === 'pfsense'
    ? 'https://tssr.miyukini.com/pages/openvpn-pfsense'
    : 'https://tssr.miyukini.com/pages/opnsense-vpn-ids';
  const l: string[] = [
    `# VPN OpenVPN — accès nomade (Remote Access).  Menu : ${m.vpn}`,
    '',
    '# 1) Certificats (avant tout) :',
    '#    - une Autorité (CA) interne, puis un certificat SERVEUR (type « Server »),',
    p.vpnAuth === 'cert-user' ? '#    - un utilisateur + son certificat client (System ▸ User Manager).' : '#    - un certificat client par poste.',
    '',
    '# 2) Le serveur OpenVPN :',
    ligne('Server mode', p.vpnAuth === 'cert-user' ? 'Remote Access (SSL/TLS + User Auth)' : 'Remote Access (SSL/TLS)'),
    ligne('Protocol / Port', 'UDP / 1194  (ou TCP 443 si les réseaux filtrent)'),
    ligne('Tunnel Network', p.vpnReseau || '10.0.8.0/24'),
    ligne('Redirect Gateway', 'décoché = split tunnel (recommandé)'),
    ligne('IPv4 Local Network(s)', locaux || '(les réseaux internes atteignables)'),
    ligne('DNS Server', 'le résolveur interne, si besoin'),
    ligne('Custom options', 'auth-nocache'),
    '',
    '# 3) Interface + règles : assigner l’interface OpenVPN (zone), régler WAN pour le port,',
    '#    puis les règles de la zone VPN (ce que le nomade a le droit d’atteindre).',
    '# 4) Export : le greffon openvpn-client-export (pfSense) fournit le .ovpn par utilisateur.',
    '',
    `# Le pas à pas complet, écran par écran : ${url}`,
  ];
  return l.join('\n');
}
// ── assemblage ───────────────────────────────────────────────────────────────
export function genererFirewall(p: ParamsFw): SectionFw[] {
  const s: SectionFw[] = [];
  s.push({ id: 'interfaces', titre: '① Interfaces (adressage)', code: planInterfaces(p) });
  const dhcp = planDhcp(p);
  if (dhcp.trim()) s.push({ id: 'dhcp', titre: '② Serveur DHCP', code: dhcp });
  if (parseAliases(p.aliases).length) s.push({ id: 'aliases', titre: '③ Alias', code: planAliases(p) });
  if (parseNat(p.nat).length) s.push({ id: 'nat', titre: '④ NAT — redirections de port', code: planNat(p) });
  if (parseRegles(p.regles).length) s.push({ id: 'regles', titre: '⑤ Règles de filtrage', code: planRegles(p) });
  s.push({ id: 'systeme', titre: '⑥ Système (hostname, DNS, fuseau)', code: planSysteme(p) });
  if (nomPasserelleWan(p) || parseRoutes(p.routes).length) s.push({ id: 'routes', titre: '⑦ Passerelles & routes statiques', code: planRoutes(p) });
  if (p.vpn) s.push({ id: 'vpn', titre: '⑧ VPN OpenVPN — accès nomade', code: planVpn(p) });
  return s;
}

/** Sections config.xml par zone (pfSense uniquement — restaurables via « Restore area »). */
export function genererXml(p: ParamsFw): SectionFw[] {
  const s: SectionFw[] = [];
  if (parseAliases(p.aliases).length) s.push({ id: 'xml-aliases', titre: 'config.xml — Aliases', code: xmlAliases(p) });
  const internes = p.interfaces.filter(i => i.clef !== 'wan' && ipValide(i.dhcpFrom) && ipValide(i.dhcpTo));
  if (internes.length) s.push({ id: 'xml-dhcpd', titre: 'config.xml — DHCP Server', code: xmlDhcpd(p) });
  if (parseNat(p.nat).length) s.push({ id: 'xml-nat', titre: 'config.xml — NAT', code: xmlNat(p) });
  if (parseRegles(p.regles).length) s.push({ id: 'xml-filter', titre: 'config.xml — Firewall Rules', code: xmlFilter(p) });
  return s;
}

export function zoneRestore(id: string): string {
  return ({ 'xml-aliases': 'Aliases', 'xml-dhcpd': 'DHCP Server', 'xml-nat': 'NAT', 'xml-filter': 'Firewall Rules' } as Record<string, string>)[id] || '';
}

export const APPLIANCE: Record<Variante, string> = { opnsense: 'OPNsense', pfsense: 'pfSense' };
export const RESTORE_MENU: Record<Variante, string> = {
  opnsense: 'System ▸ Configuration ▸ Backups (restauration complète uniquement)',
  pfsense: 'Diagnostics ▸ Backup & Restore ▸ Restore configuration ▸ Restore area',
};

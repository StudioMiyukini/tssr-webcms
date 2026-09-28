/**
 * Générateur de configuration VPN pour pare-feu OPNsense / pfSense.
 *
 * Deux familles, au choix :
 *   - IPsec **site-à-site** (relier deux agences) : Phase 1 (IKE) + Phase 2
 *     (réseaux), la clé pré-partagée, et les règles de pare-feu qui vont avec
 *     (ISAKMP sur le WAN, trafic autorisé sur l'onglet IPsec). Le plan est donné
 *     pour LES DEUX bouts, l'un étant le miroir de l'autre (local ↔ distant).
 *   - OpenVPN **accès nomade** (Remote Access) : serveur SSL/TLS, réseau du
 *     tunnel, réseaux poussés, et les règles associées.
 *
 * Ces boîtiers se configurent par leur interface web : l'outil produit un PLAN
 * précis, menu par menu, dans le dialecte OPNsense ou pfSense.
 */
export type Variante = 'opnsense' | 'pfsense';
export type TypeVpn = 'ipsec' | 'openvpn';

export type ParamsVpn = {
  variante: Variante;
  type: TypeVpn;
  // — IPsec site-à-site —
  siteLocal: string;      // nom lisible du site local (ex. Bordeaux)
  siteDistant: string;    // nom lisible du site distant (ex. Toulouse)
  wanLocal: string;       // IP WAN locale (mon endpoint)
  wanDistant: string;     // IP WAN distante (remote gateway)
  psk: string;            // clé pré-partagée
  ikev: 'ikev2' | 'ikev1';
  p1Chiffre: string;      // ex. AES256-GCM
  p1Hash: string;         // ex. SHA256
  p1Dh: string;           // groupe DH (ex. 14)
  p2Chiffre: string;      // ex. AES256-GCM
  p2Hash: string;         // ex. SHA256
  p2Pfs: string;          // groupe PFS (ex. 14, ou « off »)
  reseauxLocaux: string;  // textarea : un réseau CIDR local par ligne (Phase 2)
  reseauxDistants: string;// textarea : un réseau CIDR distant par ligne (Phase 2)
  // — OpenVPN accès nomade —
  ovpnReseau: string;     // réseau du tunnel (ex. 10.0.8.0/24)
  ovpnLocaux: string;     // réseaux internes poussés
  ovpnAuth: 'cert' | 'cert-user'; // certificat seul, ou certificat + compte
  ovpnProto: 'udp' | 'tcp';
  ovpnPort: string;       // ex. 1194
  ovpnDns: string;        // DNS poussé au client (optionnel)
};

export type SectionVpn = { id: string; titre: string; code: string };

const IP_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
export const ipValide = (s: string) => IP_RE.test((s || '').trim());
const CIDR_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}\/(3[0-2]|[12]?\d)$/;
export const cidrValide = (s: string) => CIDR_RE.test((s || '').trim());
export const listeCidr = (txt: string): string[] => (txt || '').split(/[\s,;]+/).map(s => s.trim()).filter(cidrValide);

export const APPLIANCE: Record<Variante, string> = { opnsense: 'OPNsense', pfsense: 'pfSense' };

const MENUS = {
  opnsense: {
    ipsec: 'VPN ▸ IPsec ▸ Tunnel Settings  (interface classique ; ou VPN ▸ IPsec ▸ Connections)',
    ipsecP1: 'VPN ▸ IPsec ▸ Tunnel Settings ▸ + (Phase 1)',
    ipsecP2: '↳ sous la Phase 1 : + Phase 2',
    ipsecMobile: 'VPN ▸ IPsec ▸ Mobile Clients',
    reglesIpsec: 'Firewall ▸ Rules ▸ IPsec',
    reglesWan: 'Firewall ▸ Rules ▸ WAN',
    openvpn: 'VPN ▸ OpenVPN ▸ Servers  (ou l’assistant : VPN ▸ OpenVPN ▸ Servers ▸ +)',
    reglesOvpn: 'Firewall ▸ Rules ▸ OpenVPN',
    appliquer: 'Enregistrer puis Appliquer les modifications',
  },
  pfsense: {
    ipsec: 'VPN ▸ IPsec ▸ Tunnels',
    ipsecP1: 'VPN ▸ IPsec ▸ Tunnels ▸ Add P1',
    ipsecP2: '↳ Show Phase 2 Entries ▸ Add P2',
    ipsecMobile: 'VPN ▸ IPsec ▸ Mobile Clients',
    reglesIpsec: 'Firewall ▸ Rules ▸ IPsec',
    reglesWan: 'Firewall ▸ Rules ▸ WAN',
    openvpn: 'VPN ▸ OpenVPN ▸ Wizards (Remote Access) — ou Servers ▸ Add',
    reglesOvpn: 'Firewall ▸ Rules ▸ OpenVPN',
    appliquer: 'Save puis Apply Changes',
  },
} as const;

function ligne(champ: string, valeur: string) { return `    ${champ.padEnd(28)} ${valeur}`; }

// ── IPsec site-à-site ─────────────────────────────────────────────────────────

function planIpsecP1(p: ParamsVpn): string {
  const m = MENUS[p.variante];
  const l: string[] = [
    `# Phase 1 (IKE) — établir le canal sécurisé.  Menu : ${m.ipsecP1}`,
    `# Côté ${p.siteLocal || 'site local'} — mon WAN ${p.wanLocal || '?'} vers ${p.siteDistant || 'site distant'} ${p.wanDistant || '?'}`,
    '',
    ligne('Key Exchange version', p.ikev === 'ikev2' ? 'IKEv2' : 'IKEv1'),
    ligne('Internet Protocol', 'IPv4'),
    ligne('Interface', 'WAN'),
    ligne('Remote Gateway', p.wanDistant || '<IP WAN du site distant>'),
    ligne('Authentication Method', 'Mutual PSK'),
    ligne('My identifier', `My IP address (${p.wanLocal || 'WAN local'})`),
    ligne('Peer identifier', `Peer IP address (${p.wanDistant || 'WAN distant'})`),
    ligne('Pre-Shared Key', p.psk || '<clé pré-partagée — identique des deux côtés>'),
    ligne('Encryption Algorithm', p.p1Chiffre),
    ligne('Hash / PRF', p.p1Hash),
    ligne('DH Key Group', `${p.p1Dh} (${dhBits(p.p1Dh)})`),
    ligne('Lifetime', '28800 s'),
    ligne('Dead Peer Detection', 'activé (10 s / 5 essais)'),
  ];
  return l.join('\n');
}

function dhBits(g: string): string {
  const map: Record<string, string> = { '14': '2048 bit', '15': '3072 bit', '16': '4096 bit', '19': 'ECP-256', '20': 'ECP-384', '5': '1536 bit' };
  return map[String(g)] || `groupe ${g}`;
}

function planIpsecP2(p: ParamsVpn): string {
  const m = MENUS[p.variante];
  const locaux = listeCidr(p.reseauxLocaux);
  const distants = listeCidr(p.reseauxDistants);
  const l: string[] = [
    `# Phase 2 (ESP) — quels réseaux transitent.  Menu : ${m.ipsecP2}`,
    '# Une entrée Phase 2 par couple « réseau local ↔ réseau distant ».',
  ];
  if (!locaux.length || !distants.length) {
    l.push('', '# ⚠️ Renseigne au moins un réseau local ET un réseau distant.');
    return l.join('\n');
  }
  let n = 0;
  for (const loc of locaux) {
    for (const dist of distants) {
      n++;
      l.push('', `[Phase 2 #${n}]  ${loc}  ↔  ${dist}`);
      l.push(ligne('Mode', 'Tunnel IPv4'));
      l.push(ligne('Local Network', `LAN subnet / Network : ${loc}`));
      l.push(ligne('Remote Network', `Network : ${dist}`));
      l.push(ligne('Protocol', 'ESP'));
      l.push(ligne('Encryption Algorithms', p.p2Chiffre));
      l.push(ligne('Hash Algorithms', p.p2Hash));
      l.push(ligne('PFS key group', p.p2Pfs === 'off' ? 'off' : `${p.p2Pfs} (${dhBits(p.p2Pfs)})`));
      l.push(ligne('Lifetime', '3600 s'));
    }
  }
  l.push('', `# ${m.appliquer}.`);
  return l.join('\n');
}

function planIpsecRegles(p: ParamsVpn): string {
  const m = MENUS[p.variante];
  const distants = listeCidr(p.reseauxDistants).join(', ') || 'le réseau distant';
  return [
    '# Règles de pare-feu — sans elles, le tunnel monte mais aucun paquet ne passe.',
    '',
    `# a) Laisser entrer la négociation IKE sur le WAN.  Menu : ${m.reglesWan}`,
    ligne('Action / Proto', 'Pass / UDP'),
    ligne('Source', `${p.wanDistant || 'WAN du site distant'}`),
    ligne('Destination / Port', 'WAN address / 500 et 4500 (ISAKMP / NAT-T)'),
    ligne('+ Protocole', 'ESP (créer une 2e règle Pass, proto ESP, même source)'),
    '',
    `# b) Autoriser le trafic qui sort du tunnel.  Menu : ${m.reglesIpsec}`,
    ligne('Action / Proto', 'Pass / any'),
    ligne('Source', `${distants}`),
    ligne('Destination', 'les réseaux locaux (ou LAN subnet)'),
    '',
    '# En labo on peut ouvrir large (any↔any sur IPsec) ; en production, on restreint',
    '# aux couples de réseaux réellement autorisés.',
  ].join('\n');
}

function planMiroir(p: ParamsVpn): string {
  return [
    `# Sur l'autre pare-feu (${p.siteDistant || 'site distant'}), REFAIRE la même chose EN MIROIR :`,
    `#   Remote Gateway        = ${p.wanLocal || '<WAN de ce site-ci>'}`,
    '#   Pre-Shared Key        = la même clé',
    '#   Phase 1 (chiffrement, hash, DH, IKE) = identiques, au bit près',
    '#   Phase 2 : Local Network et Remote Network INVERSÉS',
    `#     (local ${listeCidr(p.reseauxDistants).join(', ') || 'réseaux du distant'}  ↔  remote ${listeCidr(p.reseauxLocaux).join(', ') || 'réseaux d\'ici'})`,
    '#   Règles WAN + IPsec symétriques.',
    '#',
    '# Un seul paramètre qui diffère d\'un bit (chiffrement, hash, DH) = Phase 1 qui ne monte pas.',
  ].join('\n');
}

// ── OpenVPN accès nomade ──────────────────────────────────────────────────────

function planOpenvpn(p: ParamsVpn): string {
  const m = MENUS[p.variante];
  const locaux = listeCidr(p.ovpnLocaux).join(', ');
  const l: string[] = [
    `# OpenVPN — accès nomade (Remote Access).  Menu : ${m.openvpn}`,
    '',
    '# 1) Les certificats d\'abord (System ▸ Cert. Manager / Trust) :',
    '#    - une Autorité interne (CA), puis un certificat SERVEUR (type « Server »),',
    p.ovpnAuth === 'cert-user'
      ? '#    - un utilisateur + son certificat client (System ▸ User Manager).'
      : '#    - un certificat client par poste.',
    '',
    '# 2) Le serveur OpenVPN :',
    ligne('Server mode', p.ovpnAuth === 'cert-user' ? 'Remote Access (SSL/TLS + User Auth)' : 'Remote Access (SSL/TLS)'),
    ligne('Protocol', p.ovpnProto.toUpperCase()),
    ligne('Device mode', 'tun'),
    ligne('Interface', 'WAN'),
    ligne('Local port', p.ovpnPort || '1194'),
    ligne('Tunnel Network', p.ovpnReseau || '10.0.8.0/24'),
    ligne('Redirect Gateway', 'décoché = split tunnel (recommandé)'),
    ligne('IPv4 Local Network(s)', locaux || '(les réseaux internes atteignables)'),
    ligne('DNS Server', p.ovpnDns || '(le résolveur interne, si besoin)'),
    ligne('Encryption (Data)', p.p2Chiffre + ' (Data Ciphers)'),
    ligne('Auth digest', p.p1Hash),
    ligne('Custom options', 'auth-nocache'),
    '',
    `# 3) ${m.appliquer}.`,
  ];
  return l.join('\n');
}

function planOpenvpnRegles(p: ParamsVpn): string {
  const m = MENUS[p.variante];
  return [
    '# Règles de pare-feu OpenVPN',
    '',
    `# a) Ouvrir le port sur le WAN.  Menu : ${m.reglesWan}`,
    ligne('Action / Proto', `Pass / ${p.ovpnProto.toUpperCase()}`),
    ligne('Source', 'any'),
    ligne('Destination / Port', `WAN address / ${p.ovpnPort || '1194'}`),
    '',
    `# b) Ce que le nomade a le droit d'atteindre.  Menu : ${m.reglesOvpn}`,
    ligne('Action / Proto', 'Pass / any'),
    ligne('Source', p.ovpnReseau || '10.0.8.0/24'),
    ligne('Destination', 'les réseaux internes autorisés (à restreindre en production)'),
    '',
    p.variante === 'pfsense'
      ? '# c) Export : greffon « openvpn-client-export » → un .ovpn prêt par utilisateur.'
      : '# c) Export : VPN ▸ OpenVPN ▸ Client Export → le profil .ovpn par utilisateur.',
  ].join('\n');
}

// ── assemblage ────────────────────────────────────────────────────────────────

export function genererVpn(p: ParamsVpn): SectionVpn[] {
  if (p.type === 'ipsec') {
    return [
      { id: 'p1', titre: '① Phase 1 — IKE (le canal)', code: planIpsecP1(p) },
      { id: 'p2', titre: '② Phase 2 — réseaux (ESP)', code: planIpsecP2(p) },
      { id: 'regles', titre: '③ Règles de pare-feu', code: planIpsecRegles(p) },
      { id: 'miroir', titre: '④ L’autre bout (en miroir)', code: planMiroir(p) },
    ];
  }
  return [
    { id: 'serveur', titre: '① Serveur OpenVPN (Remote Access)', code: planOpenvpn(p) },
    { id: 'regles', titre: '② Règles de pare-feu', code: planOpenvpnRegles(p) },
  ];
}

/** Un récapitulatif court des choix, en tête de sortie. */
export function resumeVpn(p: ParamsVpn): string {
  if (p.type === 'ipsec') {
    return `IPsec site-à-site — ${APPLIANCE[p.variante]} · ${p.ikev.toUpperCase()} · `
      + `${p.p1Chiffre}/${p.p1Hash}/DH${p.p1Dh} · ${p.wanLocal || '?'} ↔ ${p.wanDistant || '?'}`;
  }
  return `OpenVPN accès nomade — ${APPLIANCE[p.variante]} · ${p.ovpnProto.toUpperCase()}/${p.ovpnPort || '1194'} · `
    + `tunnel ${p.ovpnReseau || '10.0.8.0/24'} · ${p.ovpnAuth === 'cert-user' ? 'cert + compte' : 'certificat'}`;
}

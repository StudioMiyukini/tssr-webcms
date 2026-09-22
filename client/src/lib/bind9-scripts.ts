/**
 * Générateur de configuration BIND9 (DNS) pour une VM Debian du labo.
 *
 * À partir d'un domaine, d'une IP de serveur, d'un réseau et d'une liste
 * d'enregistrements A, produit : le script d'installation et de configuration
 * d'un serveur **maître** (named.conf.options + named.conf.local + zone directe
 * + zone inverse, avec named-checkconf / named-checkzone et tests dig), un
 * script pour un serveur **secondaire** (esclave, transfert de zone) quand une
 * IP secondaire est donnée, et un bloc de vérification depuis un client.
 *
 * Réutilise les briques communes des configurateurs duo/bastion (entête,
 * identité du clone, adresse fixe, séquence réseau) pour rester cohérent.
 */
import {
  entete, identiteGenerique, reseauGenerique, sequenceReseau, finReseau,
  enFichier, reseauCidr, nomHote, type Reseau,
} from './web-db-scripts';

export type ParamsBind = {
  vm: string;            // nom de la VM maître
  ip: string;            // IP du serveur maître
  cidr: string;          // masque (CIDR) du réseau
  gw: string;            // passerelle
  iface: string;         // carte forcée (optionnel)
  mdpSysteme: boolean;   // poser le mot de passe du labo sur root
  domaine: string;       // ex. miyukini.lan
  forwarders: string;    // redirecteurs, ex. "1.1.1.1 8.8.8.8"
  enregistrements: string; // textarea : "nom ip" par ligne
  mx: string;            // hôte du serveur mail (label court), vide = pas de MX
  secondaire: string;    // IP du serveur secondaire, vide = aucun
  vmSec: string;         // nom de la VM secondaire
};

export type SectionBind = { id: 'primaire' | 'secondaire' | 'verif'; titre: string; code: string; fichier: string };

export type EnrA = { nom: string; ip: string };

const IP_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
export const ipValide = (s: string) => IP_RE.test(s.trim());

/** Nom d'hôte court valide (label DNS) : minuscules, chiffres, tiret. '@' accepté (l'apex). */
const labelValide = (s: string) => s === '@' || /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(s);

/** Analyse le textarea « nom ip » → enregistrements A valides. */
export function listeEnregistrements(txt: string): EnrA[] {
  const out: EnrA[] = [];
  for (const ligne of txt.split('\n')) {
    const m = ligne.trim().split(/[\s,;]+/).filter(Boolean);
    if (m.length < 2) continue;
    const nom = m[0].toLowerCase().replace(/\.$/, '');
    const ip = m[1];
    if (labelValide(nom) && ipValide(ip)) out.push({ nom, ip });
  }
  return out;
}

export const listeForwarders = (txt: string): string[] =>
  txt.split(/[\s,;]+/).map(s => s.trim()).filter(ipValide);

/** Numéro de série du jour (AAAAMMJJ01), à incrémenter à chaque modification de zone. */
export function serialDuJour(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}01`;
}

/** Zone inverse et fonction PTR selon le masque (classes /24, /16, /8 ; sinon /24 sur les 3 premiers octets). */
export function zoneInverse(ip: string, cidr: string): { zone: string; ptr: (ip: string) => string; octetsReseau: number } {
  const o = ip.split('.');
  const c = Number(cidr);
  if (c >= 16 && c < 24) {
    return { zone: `${o[1]}.${o[0]}.in-addr.arpa`, ptr: (x) => { const p = x.split('.'); return `${p[3]}.${p[2]}`; }, octetsReseau: 2 };
  }
  if (c >= 8 && c < 16) {
    return { zone: `${o[0]}.in-addr.arpa`, ptr: (x) => { const p = x.split('.'); return `${p[3]}.${p[2]}.${p[1]}`; }, octetsReseau: 1 };
  }
  // /24 (et tout le reste par défaut) : réseau sur 3 octets, PTR = dernier octet
  return { zone: `${o[2]}.${o[1]}.${o[0]}.in-addr.arpa`, ptr: (x) => x.split('.')[3], octetsReseau: 3 };
}

/** Un enregistrement est-il dans le même préfixe réseau que le serveur (pour poser un PTR) ? */
function memeReseau(ip: string, ref: string, octetsReseau: number): boolean {
  const a = ip.split('.'), b = ref.split('.');
  for (let i = 0; i < octetsReseau; i++) if (a[i] !== b[i]) return false;
  return true;
}

const fqdn = (nom: string, domaine: string) => nom === '@' ? `${domaine}.` : `${nom}.${domaine}.`;

/** La liste des A effective : ceux saisis, plus `ns` (le serveur) ajouté d'office s'il manque. */
export function enregistrementsEffectifs(p: ParamsBind): EnrA[] {
  const saisis = listeEnregistrements(p.enregistrements);
  const a = [...saisis];
  if (!a.some(r => r.nom === 'ns')) a.unshift({ nom: 'ns', ip: p.ip });
  return a;
}

// ── les fichiers de configuration ────────────────────────────────────────────

export function namedOptions(p: ParamsBind): string {
  const fwd = listeForwarders(p.forwarders);
  const reseau = `${reseauCidr(p.ip, p.cidr)}/${p.cidr}`;
  const l: string[] = [];
  l.push('// named.conf.options — genere par le configurateur TSSR');
  l.push('acl "reseaux-internes" { 127.0.0.0/8; ' + reseau + '; };');
  l.push('');
  l.push('options {');
  l.push('    directory "/var/cache/bind";');
  l.push('');
  l.push('    // Ce resolveur ne repond qu\'au LAN, jamais a Internet (pas de DNS ouvert).');
  l.push('    allow-query { reseaux-internes; };');
  l.push('    recursion yes;');
  l.push('    allow-recursion { reseaux-internes; };');
  if (fwd.length) {
    l.push('');
    l.push('    // Ce qu\'on ne sait pas resoudre localement est transmis a ces resolveurs.');
    l.push('    forwarders { ' + fwd.map(f => f + ';').join(' ') + ' };');
  }
  l.push('');
  l.push('    dnssec-validation auto;');
  l.push('    listen-on { any; };');
  l.push('    listen-on-v6 { none; };');
  l.push('};');
  return l.join('\n');
}

export function namedLocal(p: ParamsBind, role: 'maitre' | 'esclave'): string {
  const inv = zoneInverse(p.ip, p.cidr);
  const l: string[] = [];
  l.push('// named.conf.local — genere par le configurateur TSSR');
  l.push('');
  if (role === 'maitre') {
    const transfert = ipValide(p.secondaire)
      ? `\n    allow-transfer { ${p.secondaire}; };\n    also-notify { ${p.secondaire}; };\n    notify yes;`
      : '';
    l.push(`// Zone directe : ${p.domaine} -> adresses`);
    l.push(`zone "${p.domaine}" {`);
    l.push('    type master;');
    l.push(`    file "/etc/bind/zones/db.${p.domaine}";${transfert}`);
    l.push('};');
    l.push('');
    l.push(`// Zone inverse : adresses -> noms`);
    l.push(`zone "${inv.zone}" {`);
    l.push('    type master;');
    l.push(`    file "/etc/bind/zones/db.${inv.zone}";${transfert}`);
    l.push('};');
  } else {
    l.push(`// Serveur secondaire : les zones sont copiees depuis le maitre ${p.ip}`);
    l.push(`zone "${p.domaine}" {`);
    l.push('    type slave;');
    l.push(`    masters { ${p.ip}; };`);
    l.push(`    file "/var/cache/bind/db.${p.domaine}";`);
    l.push('};');
    l.push('');
    l.push(`zone "${inv.zone}" {`);
    l.push('    type slave;');
    l.push(`    masters { ${p.ip}; };`);
    l.push(`    file "/var/cache/bind/db.${inv.zone}";`);
    l.push('};');
  }
  return l.join('\n');
}

export function zoneDirecte(p: ParamsBind): string {
  const enr = enregistrementsEffectifs(p);
  const serial = serialDuJour();
  const l: string[] = [];
  l.push('$TTL    604800');
  l.push(`@       IN      SOA     ns.${p.domaine}. admin.${p.domaine}. (`);
  l.push(`                        ${serial}         ; Serial (a incrementer a chaque modif)`);
  l.push('                             604800         ; Refresh');
  l.push('                              86400         ; Retry');
  l.push('                            2419200         ; Expire');
  l.push('                             604800 )       ; Negative Cache TTL');
  l.push(';');
  l.push(`@       IN      NS      ns.${p.domaine}.`);
  if (ipValide(p.secondaire)) l.push(`@       IN      NS      ns2.${p.domaine}.`);
  if (p.mx.trim()) l.push(`@       IN      MX      10 ${p.mx.trim()}.${p.domaine}.`);
  l.push(';');
  for (const r of enr) {
    l.push(`${r.nom.padEnd(15)} IN      A       ${r.ip}`);
  }
  if (ipValide(p.secondaire) && !enr.some(r => r.nom === 'ns2')) {
    l.push(`${'ns2'.padEnd(15)} IN      A       ${p.secondaire}`);
  }
  return l.join('\n');
}

export function zoneInverseFichier(p: ParamsBind): string {
  const inv = zoneInverse(p.ip, p.cidr);
  const enr = enregistrementsEffectifs(p);
  const serial = serialDuJour();
  const l: string[] = [];
  l.push('$TTL    604800');
  l.push(`@       IN      SOA     ns.${p.domaine}. admin.${p.domaine}. (`);
  l.push(`                        ${serial}         ; Serial`);
  l.push('                             604800         ; Refresh');
  l.push('                              86400         ; Retry');
  l.push('                            2419200         ; Expire');
  l.push('                             604800 )       ; Negative Cache TTL');
  l.push(';');
  l.push(`@       IN      NS      ns.${p.domaine}.`);
  l.push(';');
  const vus = new Set<string>();
  for (const r of enr) {
    if (!memeReseau(r.ip, p.ip, inv.octetsReseau)) continue; // PTR seulement pour le bon réseau
    const idx = inv.ptr(r.ip);
    if (vus.has(idx)) continue; // une adresse = un PTR (le premier nom)
    vus.add(idx);
    l.push(`${idx.padEnd(7)} IN      PTR     ${fqdn(r.nom, p.domaine)}`);
  }
  if (ipValide(p.secondaire) && memeReseau(p.secondaire, p.ip, inv.octetsReseau)) {
    const idx = inv.ptr(p.secondaire);
    if (!vus.has(idx)) l.push(`${idx.padEnd(7)} IN      PTR     ns2.${p.domaine}.`);
  }
  return l.join('\n');
}

// ── les scripts ──────────────────────────────────────────────────────────────

function reseauServeur(ip: string, cidr: string, gw: string): Reseau {
  // Le serveur DNS se prend lui-même comme résolveur.
  return { ip, cidr, gw, dns: ip };
}

/** Écrit un fichier de config via un heredoc « quoté » (aucune expansion du shell). */
function ecrire(chemin: string, contenu: string): string[] {
  return [`cat > ${chemin} <<'FIN_CONF'`, contenu, 'FIN_CONF'];
}

function corpsInstallation(p: ParamsBind, role: 'maitre' | 'esclave'): string[] {
  const inv = zoneInverse(p.ip, p.cidr);
  const l: string[] = [];
  l.push('');
  l.push('etape "Installation de BIND9"');
  l.push('apt_essais apt-get update');
  l.push('# Debian 12/13 : bind9 + bind9-utils (named-checkconf/checkzone) + dnsutils (dig). Repli anciens noms.');
  l.push('apt_essais apt-get install -y bind9 bind9-utils dnsutils || apt_essais apt-get install -y bind9 bind9utils dnsutils');
  l.push('');
  l.push('etape "Fichiers de configuration"');
  l.push('mkdir -p /etc/bind/zones');
  l.push(...ecrire('/etc/bind/named.conf.options', namedOptions(p)));
  l.push(...ecrire('/etc/bind/named.conf.local', namedLocal(p, role)));
  if (role === 'maitre') {
    l.push(...ecrire(`/etc/bind/zones/db.${p.domaine}`, zoneDirecte(p)));
    l.push(...ecrire(`/etc/bind/zones/db.${inv.zone}`, zoneInverseFichier(p)));
    l.push('chown root:bind /etc/bind/zones/db.* 2>/dev/null || true');
    l.push('');
    l.push('etape "Verification de la configuration et des zones"');
    l.push('named-checkconf');
    l.push(`named-checkzone ${p.domaine} /etc/bind/zones/db.${p.domaine}`);
    l.push(`named-checkzone ${inv.zone} /etc/bind/zones/db.${inv.zone}`);
  } else {
    l.push('# L\'esclave n\'a pas de fichier de zone a ecrire : il les recoit du maitre par transfert.');
    l.push('named-checkconf');
  }
  l.push('');
  l.push('etape "Demarrage du service"');
  l.push('systemctl enable named 2>/dev/null || systemctl enable bind9 2>/dev/null || true');
  l.push('systemctl restart named 2>/dev/null || systemctl restart bind9');
  l.push('sleep 1');
  l.push('systemctl is-active --quiet named 2>/dev/null || systemctl is-active --quiet bind9 || { echo "ERREUR: le service DNS n\'a pas demarre"; journalctl -u named -u bind9 -n 30 --no-pager; exit 1; }');
  l.push('');
  l.push('etape "Test local"');
  l.push(`dig @127.0.0.1 ${p.domaine} SOA +short || true`);
  if (role === 'maitre') {
    const enr = enregistrementsEffectifs(p);
    const exemple = enr.find(r => r.nom !== '@') || enr[0];
    if (exemple) l.push(`dig @127.0.0.1 ${exemple.nom === '@' ? p.domaine : exemple.nom + '.' + p.domaine} +short`);
    l.push(`dig @127.0.0.1 -x ${p.ip} +short   # resolution inverse`);
  } else {
    l.push(`dig @127.0.0.1 ${p.domaine} AXFR +short 2>/dev/null | head || echo "(le transfert de zone se voit dans le journal)"`);
  }
  l.push('');
  l.push(`echo "OK : serveur DNS ${role} pret pour ${p.domaine} sur ${p.ip}."`);
  return l;
}

export function scriptPrimaire(p: ParamsBind): string {
  const nom = nomHote(p.vm);
  const hotes: [string, string][] = [[p.ip, `ns.${p.domaine} ${nom}`]];
  if (ipValide(p.secondaire)) hotes.push([p.secondaire, `ns2.${p.domaine} ${nomHote(p.vmSec)}`]);
  const corps = [
    ...entete(`Serveur DNS BIND9 (maitre) — domaine ${p.domaine}`, nom),
    '',
    ...identiteGenerique(nom, hotes, p.mdpSysteme),
    ...reseauGenerique(reseauServeur(p.ip, p.cidr, p.gw), p.iface),
    '',
    ...sequenceReseau('bind9'),
    'identite',
    ...finReseau(),
    ...corpsInstallation(p, 'maitre'),
  ].join('\n');
  return enFichier(corps, '~/dns-maitre.sh');
}

export function scriptSecondaire(p: ParamsBind): string {
  const nom = nomHote(p.vmSec);
  const hotes: [string, string][] = [[p.ip, `ns.${p.domaine} ${nomHote(p.vm)}`], [p.secondaire, `ns2.${p.domaine} ${nom}`]];
  const corps = [
    ...entete(`Serveur DNS BIND9 (esclave) — domaine ${p.domaine}`, nom),
    '',
    ...identiteGenerique(nom, hotes, p.mdpSysteme),
    ...reseauGenerique({ ip: p.secondaire, cidr: p.cidr, gw: p.gw, dns: p.secondaire }, p.iface),
    '',
    ...sequenceReseau('bind9'),
    'identite',
    ...finReseau(),
    ...corpsInstallation(p, 'esclave'),
  ].join('\n');
  return enFichier(corps, '~/dns-esclave.sh');
}

export function scriptVerif(p: ParamsBind): string {
  const inv = zoneInverse(p.ip, p.cidr);
  const enr = enregistrementsEffectifs(p);
  const l: string[] = [];
  l.push('# Verifier le DNS — depuis un client dont le DNS pointe sur le serveur, ou avec @IP.');
  l.push('');
  l.push('# 1) La zone existe et le serveur en est maitre :');
  l.push(`dig @${p.ip} ${p.domaine} SOA +short`);
  l.push(`dig @${p.ip} ${p.domaine} NS +short`);
  l.push('');
  l.push('# 2) Resolution directe (nom -> adresse) :');
  for (const r of enr.slice(0, 4)) {
    const cible = r.nom === '@' ? p.domaine : `${r.nom}.${p.domaine}`;
    l.push(`dig @${p.ip} ${cible} +short        # attendu : ${r.ip}`);
  }
  l.push('');
  l.push('# 3) Resolution inverse (adresse -> nom) :');
  l.push(`dig @${p.ip} -x ${p.ip} +short`);
  if (p.mx.trim()) {
    l.push('');
    l.push('# 4) L\'enregistrement de messagerie :');
    l.push(`dig @${p.ip} ${p.domaine} MX +short`);
  }
  if (ipValide(p.secondaire)) {
    l.push('');
    l.push('# 5) Le secondaire repond la meme chose (zone transferee) :');
    l.push(`dig @${p.secondaire} ${p.domaine} SOA +short`);
    l.push('# Sur le maitre, forcer une notification / voir le transfert :');
    l.push('#   rndc reload   puis   journalctl -u named -u bind9 -n 20 --no-pager   (cherche "transfer of")');
  }
  l.push('');
  l.push('# Si "connection timed out" : le service tourne-t-il, le pare-feu ouvre-t-il 53/udp+tcp,');
  l.push('# l\'adresse du client est-elle dans allow-query (reseaux-internes) ?');
  return l.join('\n');
}

// ── assemblage ───────────────────────────────────────────────────────────────

export function genererScriptsBind(p: ParamsBind): SectionBind[] {
  const nom = nomHote(p.vm);
  const s: SectionBind[] = [
    { id: 'primaire', titre: `① Dans ${p.vm} — serveur DNS maître (${p.domaine})`, code: scriptPrimaire(p), fichier: `dns-maitre-${nom}.sh` },
  ];
  if (ipValide(p.secondaire)) {
    s.push({ id: 'secondaire', titre: `② Dans ${p.vmSec} — serveur DNS secondaire (esclave)`, code: scriptSecondaire(p), fichier: `dns-esclave-${nomHote(p.vmSec)}.sh` });
  }
  s.push({ id: 'verif', titre: `${ipValide(p.secondaire) ? '③' : '②'} Vérifier depuis un client`, code: scriptVerif(p), fichier: 'verif-dns.txt' });
  return s;
}

/** Version « console » : le script s'enregistre dans ~/ puis se lance (pour coller dans un terminal). */
export function pourConsoleBind(sec: SectionBind): string {
  if (sec.id === 'verif') return sec.code;
  const cible = `~/${sec.id === 'primaire' ? 'dns-maitre' : 'dns-esclave'}.sh`;
  return `cat > ${cible} <<'FIN_SCRIPT_TSSR'\n${sec.code}\nFIN_SCRIPT_TSSR\nsudo bash ${cible}`;
}

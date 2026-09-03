import { useEffect, useRef, useState } from 'react';

/**
 * Émulateur d'invite de commandes Windows (bac à sable) pour s'entraîner aux configurations
 * en ligne de commande. État machine MODIFIABLE et persisté : carte réseau, hostname,
 * système de fichiers virtuel, variables d'environnement, pare-feu, serveur DHCP simulé,
 * table d'hôtes. cmd prioritaire (netsh, ipconfig, ping, nslookup, dir, set…) + équivalents
 * PowerShell (autorisé). Aucune notation — outil libre et réutilisable.
 * Îlot React hydraté via RichContent (data-block="cmd-emulator").
 */

// ═══ Helpers réseau ═══
const ipToNum = (ip: string): number | null => {
  const m = (ip || '').trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const o = [1, 2, 3, 4].map(i => Number(m[i]));
  if (o.some(n => n > 255)) return null;
  return ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0;
};
const numToIp = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
const isIp = (s: string) => ipToNum(s) !== null;
const prefixToMask = (p: number) => numToIp(p <= 0 ? 0 : (0xffffffff << (32 - p)) >>> 0);
const maskToPrefix = (mask: string) => { const n = ipToNum(mask); if (n === null) return 24; let c = 0, v = n >>> 0; for (let i = 0; i < 32; i++) { if (v & 0x80000000) c++; v = (v << 1) >>> 0; } return c; };
const sameSubnet = (a: string, b: string, mask: string) => { const na = ipToNum(a), nb = ipToNum(b), nm = ipToNum(mask); return na !== null && nb !== null && nm !== null && ((na & nm) >>> 0) === ((nb & nm) >>> 0); };

// ═══ Système de fichiers virtuel ═══
type FSNode = { dir?: Record<string, FSNode>; content?: string };
const defaultFS = (): Record<string, FSNode> => ({
  Users: { dir: { Administrateur: { dir: {
    Desktop: { dir: {} },
    Documents: { dir: { 'notes.txt': { content: 'Bloc-notes TSSR\r\nRéseau 192.168.10.0 /24\r\nPasserelle .254' } } },
    'config.txt': { content: 'exemple de fichier texte' },
  } } } },
  Windows: { dir: { System32: { dir: { 'drivers': { dir: { etc: { dir: { hosts: { content: '# hosts\r\n127.0.0.1  localhost' } } } } } } } } },
  inetpub: { dir: { wwwroot: { dir: { 'index.html': { content: '<h1>Bienvenue (IIS)</h1>' } } } } },
});
const segsOf = (path: string) => path.replace(/^[A-Za-z]:\\?/, '').split('\\').filter(Boolean);
const resolveSegs = (cwd: string, arg: string): string[] => {
  let base: string[];
  if (/^[A-Za-z]:\\?/.test(arg)) base = segsOf(arg);
  else if (arg.startsWith('\\')) base = arg.slice(1).split('\\').filter(Boolean);
  else base = [...segsOf(cwd), ...arg.split('\\').filter(Boolean)];
  const out: string[] = [];
  for (const s of base) { if (s === '.' || s === '') continue; if (s === '..') out.pop(); else out.push(s); }
  return out;
};
const getNode = (fs: Record<string, FSNode>, segs: string[]): FSNode | null => {
  let node: FSNode = { dir: fs };
  for (const s of segs) {
    const children: Record<string, FSNode> | undefined = node.dir;
    if (!children) return null;
    const key = Object.keys(children).find(k => k.toLowerCase() === s.toLowerCase());
    if (key === undefined) return null;
    node = children[key];
  }
  return node;
};

// ═══ État de la machine ═══
type Host = { name: string; ip: string };
type Iface = { name: string; mac: string; dhcp: boolean; ip: string; mask: string; gateway: string; dns: string[]; leased?: boolean };
type Scope = { on: boolean; server: string; start: string; end: string; mask: string; gw: string; dns: string };
type FW = { on: boolean; icmpIn: boolean };
type VM = {
  hostname: string; workgroup: string; cwd: string; suffix: string;
  nic: Iface; hosts: Host[]; fs: Record<string, FSNode>; env: Record<string, string>;
  fw: FW; dhcp: Scope;
};
const APIPA = '169.254.13.37';
export const defaultVM = (): VM => ({
  hostname: 'WIN-TSSR', workgroup: 'WORKGROUP', cwd: 'C:\\Users\\Administrateur', suffix: '',
  nic: { name: 'Ethernet', mac: '00-15-5D-01-0A-2B', dhcp: true, ip: '', mask: '', gateway: '', dns: [], leased: false },
  hosts: [
    { name: 'srv-dns', ip: '192.168.10.250' },
    { name: 'srv-dhcp', ip: '192.168.10.251' },
    { name: 'client-w', ip: '192.168.10.101' },
  ],
  fs: defaultFS(), env: {},
  fw: { on: true, icmpIn: false },
  dhcp: { on: false, server: '192.168.10.251', start: '192.168.10.111', end: '192.168.10.135', mask: '255.255.255.0', gw: '', dns: '192.168.10.250' },
});

const effIp = (n: Iface) => (n.ip ? n.ip : (n.dhcp ? APIPA : ''));
const effMask = (n: Iface) => (n.ip ? (n.mask || '255.255.255.0') : (n.dhcp ? '255.255.0.0' : ''));

// ═══ Analyse ═══
const tokenize = (s: string): string[] => { const re = /"([^"]*)"|(\S+)/g; const out: string[] = []; let m: RegExpExecArray | null; while ((m = re.exec(s))) out.push(m[1] !== undefined ? m[1] : m[2]); return out; };
const unq = (s: string) => s.replace(/^"|"$/g, '');
const parseArgs = (toks: string[]) => { const kv: Record<string, string> = {}; const bare: string[] = []; for (const t of toks) { const i = t.indexOf('='); if (i > 0 && !t.startsWith('-')) kv[t.slice(0, i).toLowerCase()] = unq(t.slice(i + 1)); else bare.push(unq(t)); } return { kv, bare }; };
// Style PowerShell : -Param Valeur (ou -Param:Valeur / -Param=Valeur / -Switch).
const parsePS = (toks: string[]) => { const kv: Record<string, string> = {}; const bare: string[] = []; for (let i = 0; i < toks.length; i++) { const t = toks[i]; if (t.startsWith('-')) { let key = t.slice(1); let val = ''; const c = key.search(/[:=]/); if (c >= 0) { val = key.slice(c + 1); key = key.slice(0, c); } else if (i + 1 < toks.length && !toks[i + 1].startsWith('-')) { val = toks[++i]; } else val = 'true'; kv[key.toLowerCase()] = unq(val); } else bare.push(unq(t)); } return { kv, bare }; };
const expandEnv = (s: string, vm: VM): string => s.replace(/%([^%]+)%/g, (_, name: string) => {
  const k = name.toUpperCase();
  const dyn: Record<string, string> = { COMPUTERNAME: vm.hostname, USERNAME: 'Administrateur', USERDOMAIN: vm.workgroup, USERPROFILE: 'C:\\Users\\Administrateur', HOMEPATH: '\\Users\\Administrateur', SYSTEMROOT: 'C:\\Windows', CD: vm.cwd, OS: 'Windows_NT' };
  if (k in dyn) return dyn[k];
  const ek = Object.keys(vm.env).find(x => x.toUpperCase() === k);
  return ek ? vm.env[ek] : `%${name}%`;
});

type Res = { out: string[]; vm?: VM; clear?: boolean };
const L = (out: string[]): Res => ({ out });
const clone = (vm: VM): VM => ({ ...vm, nic: { ...vm.nic, dns: [...vm.nic.dns] }, hosts: vm.hosts.map(h => ({ ...h })), env: { ...vm.env }, fw: { ...vm.fw }, dhcp: { ...vm.dhcp }, fs: JSON.parse(JSON.stringify(vm.fs)) });

// Liste des commandes (pour l'auto-complétion + aide).
export const COMMANDS = ['help', 'cls', 'ver', 'hostname', 'whoami', 'echo', 'set', 'cd', 'dir', 'md', 'mkdir', 'rd', 'rmdir', 'del', 'type', 'tree', 'ren', 'copy', 'date', 'time', 'title', 'systeminfo', 'tasklist', 'getmac', 'ipconfig', 'ping', 'nslookup', 'tracert', 'pathping', 'arp', 'route', 'netstat', 'netsh', 'net', 'netdom', 'exit', 'pause', 'new-netipaddress', 'set-dnsclientserveraddress', 'get-dnsclientserveraddress', 'rename-computer', 'restart-computer', 'test-netconnection', 'test-connection', 'resolve-dnsname', 'get-netipconfiguration', 'get-netipaddress', 'get-netadapter', 'clear-host'];

// ═══ Interpréteur ═══
export function run(rawIn: string, vmIn: VM): Res {
  const raw = expandEnv(rawIn, vmIn).trim();
  if (!raw) return L([]);
  const toks = tokenize(raw);
  const cmd = toks[0].toLowerCase();
  const rest = toks.slice(1);
  const argStr = raw.slice(toks[0].length).trim();
  const vm = vmIn;
  const nic = vm.nic;
  const findHost = (t: string): Host | null => { const q = t.toLowerCase().replace(/\.$/, ''); return vm.hosts.find(h => { const n = h.name.toLowerCase(); return n === q || q === `${n}.${vm.suffix.toLowerCase()}` || q.split('.')[0] === n; }) || null; };
  const hostByIp = (ip: string) => vm.hosts.find(h => h.ip === ip) || null;

  // ── Aide ──
  if (cmd === 'help' || cmd === 'aide' || cmd === '?') return L([
    'COMMANDES SIMULÉES (cmd prioritaire) :', '',
    ' Réseau   ipconfig [/all /release /renew /flushdns /displaydns]',
    '          netsh interface ip set address "Ethernet" static <ip> <masque> [passerelle]',
    '          netsh interface ip set address "Ethernet" dhcp',
    '          netsh interface ip set dns "Ethernet" static <ip>   |   add dns "Ethernet" <ip>',
    '          netsh interface ip show config   |   netsh interface show interface',
    '          netsh advfirewall set allprofiles state off|on',
    '          netsh advfirewall firewall add rule name="Ping" protocol=icmpv4 dir=in action=allow',
    '          ping <ip|nom> [-n N] [-a]   nslookup <nom|ip>   tracert <cible>   arp -a',
    '          route print   netstat -an   getmac   net view   netdom renamecomputer',
    ' Système  hostname  whoami  ver  systeminfo  tasklist  set  date /t  time /t  title',
    ' Fichiers dir  cd  md  rd  del  type  tree  ren  copy  echo texte > fichier',
    ' PowerShell (autorisé) : New-NetIPAddress, Set-DnsClientServerAddress, Rename-Computer,',
    '          Test-NetConnection, Test-Connection, Resolve-DnsName, Get-NetIPConfiguration',
    '', 'Tab = auto-complétion · ↑/↓ = historique · Ctrl+L = effacer · Ctrl+C = annuler la ligne.',
    'Édite la table « Hôtes » (à droite) pour que ping/nslookup soient pertinents.',
  ]);
  if (cmd === 'cls' || cmd === 'clear' || cmd === 'clear-host') return { out: [], clear: true };
  if (cmd === 'ver') return L(['', 'Microsoft Windows [version 10.0.19045.4529]', '']);
  if (cmd === 'hostname') return L([vm.hostname]);
  if (cmd === 'whoami') return L([`${vm.hostname.toLowerCase()}\\administrateur`]);
  if (cmd === 'title') return L([]);
  if (cmd === 'pause') return L(['Appuyez sur une touche pour continuer...']);
  if (cmd === 'exit') return L(['(Fenêtre d’émulateur — rien à fermer. Tape « cls » pour nettoyer.)']);
  if (cmd === 'date') return L(rest[0] === '/t' ? ['dim. 12/07/2026'] : ['La date du jour est : dim. 12/07/2026', 'Entrez la nouvelle date : (jj-mm-aa)']);
  if (cmd === 'time') return L(rest[0] === '/t' ? ['10:24'] : ['L’heure actuelle est : 10:24:15,00', 'Entrez la nouvelle heure :']);
  if (cmd === 'getmac') return L(['', 'Adresse physique    Nom de transport', '=================== ==========================================', `${nic.mac}   \\Device\\Tcpip_{8F3A2C10-4B2E-11EE-9C21}`, '']);
  if (cmd === 'tasklist') return L(['', 'Nom de l’image                 PID Nom de la session', '========================= ======== ================', 'System                           4 Services', 'svchost.exe                    812 Services', 'explorer.exe                  2140 Console', 'cmd.exe                       3312 Console', '']);
  if (cmd === 'systeminfo') return L(['', `Nom de l’hôte:                        ${vm.hostname}`, 'Nom du système d’exploitation:        Microsoft Windows Server 2019 Standard', 'Type du système:                      x64-based PC', `Domaine:                              ${vm.workgroup}`, `Carte(s) réseau:                      1 carte(s) — ${nic.name} : ${effIp(nic) || '(non configurée)'}`, '']);

  // ── set / variables ──
  if (cmd === 'set') {
    if (!argStr) { const dyn = { COMPUTERNAME: vm.hostname, USERNAME: 'Administrateur', USERDOMAIN: vm.workgroup, USERPROFILE: 'C:\\Users\\Administrateur', OS: 'Windows_NT' }; return L([...Object.entries({ ...dyn, ...vm.env }).map(([k, v]) => `${k}=${v}`)]); }
    const eq = argStr.indexOf('=');
    if (eq > 0) { const k = argStr.slice(0, eq).trim(); const v = argStr.slice(eq + 1); const nv = clone(vm); if (v === '') delete nv.env[k]; else nv.env[k] = v; return { out: [], vm: nv }; }
    const key = argStr.trim().toUpperCase(); const val = expandEnv(`%${key}%`, vm); return L(val === `%${key}%` ? [`Variable d’environnement ${argStr} non définie`] : [`${key}=${val}`]);
  }

  // ── Système de fichiers ──
  if (cmd === 'cd' || cmd === 'chdir') {
    if (!rest[0]) return L([vm.cwd]);
    const segs = resolveSegs(vm.cwd, rest[0]);
    const node = getNode(vm.fs, segs);
    if (!node || !node.dir) return L([`Le chemin d’accès spécifié est introuvable.`]);
    return { out: [], vm: { ...vm, cwd: 'C:\\' + segs.join('\\') } };
  }
  if (cmd === 'dir') {
    const target = rest.find(t => !t.startsWith('/'));
    const segs = target ? resolveSegs(vm.cwd, target) : segsOf(vm.cwd);
    const node = getNode(vm.fs, segs);
    if (!node || !node.dir) return L(['Fichier introuvable.']);
    const entries = Object.entries(node.dir);
    const rows = entries.map(([name, n]) => n.dir ? `12/07/2026  10:24    <DIR>          ${name}` : `12/07/2026  10:24         ${String((n.content || '').length).padStart(8)} ${name}`);
    const files = entries.filter(([, n]) => !n.dir).length, dirs = entries.filter(([, n]) => n.dir).length;
    return L(['', ` Répertoire de C:\\${segs.join('\\')}`, '', '12/07/2026  10:24    <DIR>          .', '12/07/2026  10:24    <DIR>          ..', ...rows, `${String(files).padStart(15)} fichier(s)`, `${String(dirs).padStart(15)} Rép(s)`, '']);
  }
  if (cmd === 'md' || cmd === 'mkdir') {
    if (!rest[0]) return L(['La syntaxe de la commande n’est pas correcte.']);
    const segs = resolveSegs(vm.cwd, rest[0]); const name = segs.pop()!;
    const parent = getNode(vm.fs, segs);
    if (!parent || !parent.dir) return L(['Le chemin d’accès spécifié est introuvable.']);
    if (parent.dir[name]) return L([`Un sous-répertoire ou un fichier ${rest[0]} existe déjà.`]);
    const nv = clone(vm); const p = getNode(nv.fs, segs)!; p.dir![name] = { dir: {} }; return { out: [], vm: nv };
  }
  if (cmd === 'rd' || cmd === 'rmdir') {
    if (!rest[0]) return L(['La syntaxe de la commande n’est pas correcte.']);
    const segs = resolveSegs(vm.cwd, rest[0]); const name = segs.pop()!;
    const parent = getNode(vm.fs, segs); const node = parent?.dir?.[Object.keys(parent.dir).find(k => k.toLowerCase() === name.toLowerCase()) || ''];
    if (!parent?.dir || !node || !node.dir) return L(['Le répertoire est introuvable.']);
    if (Object.keys(node.dir).length) return L(['Le répertoire n’est pas vide.']);
    const nv = clone(vm); const p = getNode(nv.fs, segs)!; delete p.dir![Object.keys(p.dir!).find(k => k.toLowerCase() === name.toLowerCase())!]; return { out: [], vm: nv };
  }
  if (cmd === 'del' || cmd === 'erase') {
    const segs = resolveSegs(vm.cwd, rest[0] || ''); const name = segs.pop()!;
    const parent = getNode(vm.fs, segs); const key = parent?.dir && Object.keys(parent.dir).find(k => k.toLowerCase() === name.toLowerCase());
    if (!parent?.dir || !key || parent.dir[key].dir) return L(['Fichier introuvable.']);
    const nv = clone(vm); const p = getNode(nv.fs, segs)!; delete p.dir![key]; return { out: [], vm: nv };
  }
  if (cmd === 'type') {
    const segs = resolveSegs(vm.cwd, rest[0] || ''); const node = getNode(vm.fs, segs);
    if (!node || node.dir) return L(['Fichier introuvable.']);
    return L((node.content || '').split(/\r?\n/));
  }
  if (cmd === 'ren' || cmd === 'rename') {
    const segs = resolveSegs(vm.cwd, rest[0] || ''); const name = segs.pop()!; const to = rest[1];
    const parent = getNode(vm.fs, segs); const key = parent?.dir && Object.keys(parent.dir).find(k => k.toLowerCase() === name.toLowerCase());
    if (!parent?.dir || !key || !to) return L(['Fichier introuvable.']);
    const nv = clone(vm); const p = getNode(nv.fs, segs)!; p.dir![to] = p.dir![key]; if (to !== key) delete p.dir![key]; return { out: [], vm: nv };
  }
  if (cmd === 'copy') {
    const from = resolveSegs(vm.cwd, rest[0] || ''); const src = getNode(vm.fs, from);
    if (!src || src.dir) return L(['Fichier introuvable.']);
    const to = resolveSegs(vm.cwd, rest[1] || ''); const name = to.pop()!; const parent = getNode(vm.fs, to);
    if (!parent?.dir) return L(['Le chemin d’accès spécifié est introuvable.']);
    const nv = clone(vm); const p = getNode(nv.fs, to)!; p.dir![name] = { content: src.content }; return { out: ['        1 fichier(s) copié(s).'], vm: nv };
  }
  if (cmd === 'tree') {
    const lines: string[] = ['C:.'];
    const walk = (m: Record<string, FSNode>, pre: string) => { const dirs = Object.entries(m).filter(([, n]) => n.dir); dirs.forEach(([name, n], i) => { const last = i === dirs.length - 1; lines.push(`${pre}${last ? '└───' : '├───'}${name}`); walk(n.dir!, pre + (last ? '    ' : '│   ')); }); };
    const node = getNode(vm.fs, segsOf(vm.cwd)); if (node?.dir) walk(node.dir, ''); return L([...lines, '']);
  }
  // echo (+ redirection)
  if (cmd === 'echo') {
    const redir = argStr.match(/^(.*?)\s*(>>?)\s*(\S+)\s*$/);
    if (redir) {
      const [, text, mode, file] = redir; const segs = resolveSegs(vm.cwd, file); const name = segs.pop()!; const parent = getNode(vm.fs, segs);
      if (!parent?.dir) return L(['Le chemin d’accès spécifié est introuvable.']);
      const nv = clone(vm); const p = getNode(nv.fs, segs)!; const key = Object.keys(p.dir!).find(k => k.toLowerCase() === name.toLowerCase());
      const prev = key ? (p.dir![key].content || '') : ''; p.dir![key || name] = { content: mode === '>>' ? `${prev}${prev ? '\r\n' : ''}${text}` : text };
      return { out: [], vm: nv };
    }
    return L([argStr || 'ECHO est activé.']);
  }

  // ── ipconfig ──
  if (cmd === 'ipconfig') {
    const opt = (rest[0] || '').toLowerCase();
    if (opt === '/flushdns') return L(['', 'Configuration IP de Windows', '', 'Cache de résolution DNS vidé.', '']);
    if (opt === '/displaydns') return L(['', 'Configuration IP de Windows', '', '(cache de résolution DNS vide)', '']);
    if (opt === '/release') return { out: ['', 'Configuration IP de Windows', '', `Carte Ethernet ${nic.name} :`, '', '   Adresse IPv4. . . . . . . . . . . . . :', '   Masque de sous-réseau. . . . . . . . . :', '   Passerelle par défaut. . . . . . . . . :', ''], vm: { ...vm, nic: { ...nic, ip: '', mask: '', gateway: '', dhcp: true, leased: false } } };
    if (opt === '/renew') {
      if (!nic.dhcp) return L(['L’opération a échoué : la carte n’est pas configurée en DHCP (adresse statique).']);
      if (!vm.dhcp.on) return L(['', 'Configuration IP de Windows', '', `Carte Ethernet ${nic.name} :`, '', `   Configuration automatique IPv4 . . . . : ${APIPA}(préféré)`, '   (Aucun serveur DHCP joignable — active le serveur DHCP dans le panneau.)', '']);
      // Attribue la 1re IP libre de l'étendue (hors hôtes connus).
      const s = ipToNum(vm.dhcp.start)!, e = ipToNum(vm.dhcp.end)!; let lease = '';
      for (let n = s; n <= e; n++) { const ip = numToIp(n); if (!vm.hosts.some(h => h.ip === ip)) { lease = ip; break; } }
      const gw = vm.dhcp.gw || '', dns = vm.dhcp.dns ? [vm.dhcp.dns] : [];
      return { out: ['', 'Configuration IP de Windows', '', `Carte Ethernet ${nic.name} :`, '', `   Adresse IPv4. . . . . . . . . . . . . : ${lease}(préféré)`, `   Masque de sous-réseau. . . . . . . . . : ${vm.dhcp.mask}`, `   Bail obtenu. . . . . . . . . . . . . . : du serveur ${vm.dhcp.server}`, `   Passerelle par défaut. . . . . . . . . : ${gw}`, ''], vm: { ...vm, nic: { ...nic, ip: lease, mask: vm.dhcp.mask, gateway: gw, dns, dhcp: true, leased: true } } };
    }
    const ip = effIp(nic), mask = effMask(nic);
    if (opt === '/all') return L(['', 'Configuration IP de Windows', '',
      `   Nom de l’hôte . . . . . . . . . . : ${vm.hostname}`,
      `   Suffixe DNS principal . . . . . . : ${vm.suffix}`,
      '   Type de nœud. . . . . . . . . . . : Hybride',
      '   Routage IP activé . . . . . . . . : Non', '',
      `Carte Ethernet ${nic.name} :`, '',
      `   Suffixe DNS propre à la connexion : ${vm.suffix}`,
      '   Description . . . . . . . . . . . : Carte réseau Microsoft Hyper-V',
      `   Adresse physique. . . . . . . . . : ${nic.mac}`,
      `   DHCP activé. . . . . . . . . . . . : ${nic.dhcp ? 'Oui' : 'Non'}`,
      `   Adresse IPv4. . . . . . . . . . . : ${ip}${ip ? '(préféré)' : ''}`,
      `   Masque de sous-réseau . . . . . . : ${mask}`,
      `   Passerelle par défaut . . . . . . : ${nic.gateway}`,
      `   Serveurs DNS. . . . . . . . . . . : ${nic.dns[0] || ''}`,
      ...nic.dns.slice(1).map(d => `                                       ${d}`), '']);
    return L(['', 'Configuration IP de Windows', '', `Carte Ethernet ${nic.name} :`, '',
      `   Suffixe DNS propre à la connexion : ${vm.suffix}`,
      ...(nic.dhcp && !nic.ip ? [`   Configuration automatique IPv4 . . . . : ${ip}(préféré)`] : [`   Adresse IPv4. . . . . . . . . . . . . : ${ip}`]),
      `   Masque de sous-réseau. . . . . . . . : ${mask}`,
      `   Passerelle par défaut. . . . . . . . : ${nic.gateway}`, '']);
  }

  // ── netsh ──
  if (cmd === 'netsh') {
    const low = rest.map(t => t.toLowerCase());
    // advfirewall
    if (low[0] === 'advfirewall') {
      if (low[1] === 'set' && low[3] === 'state') { const on = low[4] === 'on'; return { out: ['Ok.'], vm: { ...vm, fw: { ...vm.fw, on } } }; }
      if (low[1] === 'firewall' && low[2] === 'add' && low[3] === 'rule') { const { kv } = parseArgs(rest.slice(4)); const proto = (kv['protocol'] || '').toLowerCase(); if (proto.includes('icmp')) return { out: ['Ok.'], vm: { ...vm, fw: { ...vm.fw, icmpIn: true } } }; return { out: ['Ok.'] }; }
      if (low[1] === 'show') return L(['', 'Profil de domaine  État : ' + (vm.fw.on ? 'ACTIVÉ' : 'DÉSACTIVÉ'), 'Profil privé       État : ' + (vm.fw.on ? 'ACTIVÉ' : 'DÉSACTIVÉ'), 'Profil public      État : ' + (vm.fw.on ? 'ACTIVÉ' : 'DÉSACTIVÉ'), `Ping entrant (ICMP): ${vm.fw.icmpIn ? 'autorisé' : 'bloqué'}`, '']);
      return L(['Ok.']);
    }
    if (low[0] === 'interface' && (low[1] === 'show')) return L(['', 'État adm.     État        Type            Nom de l’interface', '-------------------------------------------------------------------', `Activé        Connecté    Dédié           ${nic.name}`, '']);
    const iIp = low.findIndex(t => t === 'ip' || t === 'ipv4');
    const act = low[iIp + 1], obj = low[iIp + 2];
    if (iIp < 0 || !act) return L(['La syntaxe de la commande n’est pas correcte.', 'Ex : netsh interface ip set address "Ethernet" static 192.168.10.250 255.255.255.0 192.168.10.254']);
    const argToks = rest.slice(iIp + 3); const { kv, bare } = parseArgs(argToks);
    const reserved = /^(static|dhcp|source|addr|address|mask|gateway|gwmetric|index|register|validate|primary)$/i;
    const wantName = kv['name'] || bare.find(b => !isIp(b) && !reserved.test(b)) || nic.name;
    if (wantName.toLowerCase() !== nic.name.toLowerCase()) return L([`L’interface « ${wantName} » est introuvable. La carte de cette machine s’appelle « ${nic.name} ».`]);
    const mode = (kv['source'] || bare.find(b => /^(static|dhcp)$/i.test(b)) || '').toLowerCase();
    const ips = bare.filter(isIp);
    if (act === 'set' && obj === 'address') {
      if (mode === 'dhcp') return { out: ['Ok.'], vm: { ...vm, nic: { ...nic, dhcp: true, ip: '', mask: '', gateway: '' } } };
      const ip = kv['addr'] || kv['address'] || ips[0], mask = kv['mask'] || ips[1], gw = kv['gateway'] || ips[2] || '';
      if (!ip || !mask) return L(['Paramètres manquants. Ex : netsh interface ip set address "Ethernet" static 192.168.10.250 255.255.255.0 192.168.10.254']);
      if (!isIp(ip) || !isIp(mask)) return L(['Adresse ou masque invalide.']);
      return { out: ['Ok.'], vm: { ...vm, nic: { ...nic, dhcp: false, ip, mask, gateway: gw } } };
    }
    if ((act === 'set' || act === 'add') && obj === 'dns') {
      if (mode === 'dhcp') return { out: ['Ok.'], vm: { ...vm, nic: { ...nic, dns: [] } } };
      const ip = kv['addr'] || kv['address'] || ips[0];
      if (!ip) return L(['Adresse DNS manquante.']);
      const dns = act === 'add' ? Array.from(new Set([...nic.dns, ip])) : [ip];
      return { out: ['Ok.'], vm: { ...vm, nic: { ...nic, dns } } };
    }
    if (act === 'show' && (obj === 'config' || obj === 'addresses' || obj === undefined)) return L(['', `Configuration pour l’interface « ${nic.name} »`,
      `    DHCP activé:                          ${nic.dhcp ? 'Oui' : 'Non'}`,
      `    Adresse IP:                           ${effIp(nic)}`,
      `    Masque de sous-réseau:                ${effMask(nic)}`,
      `    Passerelle par défaut:                ${nic.gateway}`,
      `    Serveurs DNS configurés statiquement: ${nic.dns[0] || 'Aucun'}`,
      ...nic.dns.slice(1).map(d => `                                          ${d}`), '']);
    if (act === 'show' && obj === 'dnsservers') return L(['', `Configuration pour l’interface « ${nic.name} »`, nic.dns.length ? `    Serveurs DNS: ${nic.dns.join(', ')}` : '    Serveurs DNS: configurés via DHCP', '']);
    return L(['La syntaxe de la commande n’est pas correcte.']);
  }

  // ── ping ──
  if (cmd === 'ping') {
    const flags = parseArgs(rest); const target = flags.bare.find(t => !t.startsWith('-') && !t.startsWith('/'));
    if (!target) return L(['Options : ping <cible> [-n nombre] [-a]']);
    const nIdx = rest.findIndex(t => t.toLowerCase() === '-n'); let count = 4; if (nIdx >= 0 && rest[nIdx + 1]) count = Math.min(10, Math.max(1, parseInt(rest[nIdx + 1], 10) || 4));
    let ip = target, name = '';
    if (!isIp(target)) { const h = findHost(target); if (!h) return L([`La requête Ping n’a pas pu trouver l’hôte ${target}. Vérifiez le nom et essayez à nouveau.`]); ip = h.ip; name = rest.includes('-a') ? `${h.name}${vm.suffix ? '.' + vm.suffix : ''}` : target; }
    else if (rest.includes('-a')) { const h = hostByIp(ip); if (h) name = `${h.name}${vm.suffix ? '.' + vm.suffix : ''}`; }
    const my = effIp(nic), mask = effMask(nic);
    let status: 'reply' | 'timeout' | 'netunreach' | 'transmit';
    if (/^127\./.test(ip) || ip === my) status = 'reply';
    else if (!nic.ip) status = 'transmit';
    else if (sameSubnet(my, ip, mask)) status = (hostByIp(ip) || ip === nic.gateway) ? 'reply' : 'timeout';
    else status = nic.gateway ? 'timeout' : 'netunreach';
    const head = name ? `Envoi d’une requête 'ping' sur ${name} [${ip}] avec 32 octets de données :` : `Envoi d’une requête 'ping' sur ${ip} avec 32 octets de données :`;
    const rep = (): string => status === 'reply' ? `Réponse de ${ip} : octets=32 temps<1ms TTL=128` : status === 'timeout' ? `Délai d’attente de la demande dépassé.` : `Réponse de ${my} : Impossible de joindre le réseau de destination.`;
    if (status === 'transmit') return L(['', head, '', 'PING : échec de la transmission. Erreur générale.', '']);
    const body = Array.from({ length: count }, rep);
    const recv = status === 'reply' ? count : 0;
    return L(['', head, '', ...body, '', `Statistiques Ping pour ${ip}:`, `    Paquets : envoyés = ${count}, reçus = ${recv}, perdus = ${count - recv} (perte ${Math.round((count - recv) / count * 100)}%),`, ...(recv ? ['Durée approximative des boucles en millisecondes :', '    Minimum = 0ms, Maximum = 0ms, Moyenne = 0ms'] : []), '']);
  }

  // ── nslookup (direct + inverse) ──
  if (cmd === 'nslookup') {
    const target = rest[0];
    if (!nic.dns[0]) return L(['', '*** Impossible de trouver le serveur DNS par défaut.', 'Configurez un serveur DNS (netsh interface ip set dns ...) d’abord.', '']);
    const srv = hostByIp(nic.dns[0]); const srvName = srv ? srv.name : 'UnKnown';
    const header = [`Serveur :   ${srvName}`, `Address:  ${nic.dns[0]}`, ''];
    if (!target) return L([`Serveur par défaut :  ${srvName}`, `Address:  ${nic.dns[0]}`, '']);
    if (isIp(target)) { const h = hostByIp(target); return L(h ? [...header, `Nom :    ${h.name}${vm.suffix ? '.' + vm.suffix : ''}`, `Address:  ${h.ip}`, ''] : [...header, `*** ${srvName} ne parvient pas à trouver ${target} : Non-existent domain`, '']); }
    const h = findHost(target);
    return L(h ? [...header, `Nom :    ${h.name}${vm.suffix ? '.' + vm.suffix : ''}`, `Address:  ${h.ip}`, ''] : [...header, `*** ${srvName} ne parvient pas à trouver ${target} : Non-existent domain`, '']);
  }

  // ── tracert / pathping ──
  if (cmd === 'tracert' || cmd === 'pathping') {
    const target = rest.find(t => !t.startsWith('-')); if (!target) return L(['Syntaxe : tracert <cible>']);
    let ip = target; if (!isIp(target)) { const h = findHost(target); if (!h) return L([`Impossible de résoudre le nom cible ${target}.`]); ip = h.ip; }
    const my = effIp(nic);
    if (nic.ip && sameSubnet(my, ip, effMask(nic)) && (hostByIp(ip) || ip === nic.gateway)) return L(['', `Détermination de l’itinéraire vers ${target} [${ip}]`, 'avec un maximum de 30 sauts :', '', `  1    <1 ms    <1 ms    <1 ms  ${ip}`, '', 'Itinéraire déterminé.', '']);
    return L(['', `Détermination de l’itinéraire vers ${target} [${ip}]`, '', '  1     *        *        *     Délai d’attente de la demande dépassé.', '']);
  }

  // ── arp / route / netstat / nbtstat ──
  if (cmd === 'arp' && (rest[0] || '').toLowerCase() === '-a') {
    const my = effIp(nic);
    const rows = vm.hosts.filter(h => nic.ip && sameSubnet(my, h.ip, effMask(nic))).map((h, i) => `  ${h.ip.padEnd(22)}00-15-5d-01-0a-${(10 + i).toString(16).padStart(2, '0')}     dynamique`);
    return L(['', `Interface : ${my || '(aucune)'} --- 0x5`, '  Adresse Internet      Adresse physique      Type', ...(rows.length ? rows : ['  (aucune entrée — configure une IP et pingue un hôte du sous-réseau)']), '']);
  }
  if (cmd === 'route' && (rest[0] || '').toLowerCase() === 'print') return L(['', 'Itinéraires actifs :', 'Destination réseau    Masque réseau     Adr. passerelle    Adr. interface  Métr.', `          0.0.0.0          0.0.0.0    ${(nic.gateway || 'Sur liaison').padEnd(16)}   ${effIp(nic)}     25`, `      ${(effIp(nic) || '0.0.0.0')}  255.255.255.255          Sur liaison    ${effIp(nic)}    281`, '']);
  if (cmd === 'netstat') return L(['', 'Connexions actives', '', '  Proto  Adresse locale         Adresse distante       État', `  TCP    ${(effIp(nic) || '0.0.0.0')}:139       0.0.0.0:0              LISTENING`, `  TCP    ${(effIp(nic) || '0.0.0.0')}:445       0.0.0.0:0              LISTENING`, '  TCP    0.0.0.0:3389           0.0.0.0:0              LISTENING', '']);

  // ── net / netdom ──
  if (cmd === 'net') {
    const sub = (rest[0] || '').toLowerCase();
    if (sub === 'view') return L(['', 'Nom du serveur            Commentaire', '-------------------------------------------', ...vm.hosts.map(h => `\\\\${h.name.toUpperCase().padEnd(22)}`), 'La commande s’est terminée correctement.', '']);
    if (sub === 'user') return L(['', 'Comptes d’utilisateurs pour \\\\' + vm.hostname, '-------------------------------------------', 'Administrateur           Invité', 'La commande s’est terminée correctement.', '']);
    return L(['La commande s’est terminée correctement.']);
  }
  if (cmd === 'netdom') {
    if ((rest[0] || '').toLowerCase() === 'renamecomputer') { const { kv } = parseArgs(rest.slice(1)); const nn = kv['newname'] || (rest.find(t => t.toLowerCase().startsWith('/newname:')) || '').split(':')[1]; if (!nn) return L(['Syntaxe : netdom renamecomputer <nom> /newname:<nouveau> /force']); return { out: [`L’ordinateur a été renommé « ${nn} ». Redémarrage nécessaire pour appliquer.`], vm: { ...vm, hostname: nn } }; }
    return L(['La commande s’est terminée correctement.']);
  }

  // ═══ PowerShell (autorisé) ═══
  if (cmd === 'new-netipaddress') {
    const { kv } = parsePS(rest); const ip = kv['ipaddress'], plen = kv['prefixlength'], gw = kv['defaultgateway'] || '';
    if (!ip || !plen) return L(['New-NetIPAddress : -IPAddress et -PrefixLength requis.']);
    const mask = prefixToMask(Number(plen));
    return { out: ['', `IPAddress         : ${ip}`, `PrefixLength      : ${plen}`, `AddressFamily     : IPv4`, ''], vm: { ...vm, nic: { ...nic, dhcp: false, ip, mask, gateway: gw } } };
  }
  if (cmd === 'set-dnsclientserveraddress') { const { kv } = parsePS(rest); const addr = (kv['serveraddresses'] || '').replace(/[()'"]/g, '').split(',').map(s => s.trim()).filter(Boolean); if (!addr.length) return L(['Set-DnsClientServerAddress : -ServerAddresses requis.']); return { out: [], vm: { ...vm, nic: { ...nic, dns: addr } } }; }
  if (cmd === 'get-dnsclientserveraddress') return L(['', 'InterfaceAlias  AddressFamily  ServerAddresses', '--------------  -------------  ---------------', `${nic.name}        IPv4           {${nic.dns.join(', ')}}`, '']);
  if (cmd === 'rename-computer') { const { kv } = parsePS(rest); const nn = kv['newname']; if (!nn) return L(['Rename-Computer : -NewName requis.']); return { out: [`Nom modifié en « ${nn} » (redémarrage requis).`], vm: { ...vm, hostname: nn } }; }
  if (cmd === 'restart-computer') return L(['Redémarrage simulé — (rien ne se ferme dans l’émulateur).']);
  if (cmd === 'test-netconnection') {
    const { kv, bare } = parsePS(rest); const target = kv['computername'] || bare[0]; if (!target) return L(['Test-NetConnection : -ComputerName requis.']);
    let ip = target; if (!isIp(target)) { const h = findHost(target); ip = h ? h.ip : ''; }
    const my = effIp(nic); const ok = !!ip && (/^127\./.test(ip) || ip === my || (!!nic.ip && sameSubnet(my, ip, effMask(nic)) && (!!hostByIp(ip) || ip === nic.gateway)));
    return L(['', `ComputerName           : ${target}`, `RemoteAddress          : ${ip || '(non résolu)'}`, `InterfaceAlias         : ${nic.name}`, `SourceAddress          : ${my}`, `PingSucceeded          : ${ok ? 'True' : 'False'}`, `PingReplyDetails (RTT) : ${ok ? '0 ms' : ''}`, '']);
  }
  if (cmd === 'test-connection') { const { bare } = parseArgs(rest); const target = bare[0]; return run(`ping ${target || ''}`, vm); }
  if (cmd === 'resolve-dnsname') { const t = rest[0]; return run(`nslookup ${t || ''}`, vm); }
  if (cmd === 'get-netipconfiguration') return L(['', `InterfaceAlias       : ${nic.name}`, `IPv4Address          : ${effIp(nic)}`, `IPv4DefaultGateway   : ${nic.gateway}`, `DNSServer            : ${nic.dns.join(', ')}`, '']);
  if (cmd === 'get-netipaddress') return L(['', `IPAddress         : ${effIp(nic)}`, `InterfaceAlias    : ${nic.name}`, `PrefixLength      : ${nic.ip ? maskToPrefix(effMask(nic)) : ''}`, '']);
  if (cmd === 'get-netadapter') return L(['', 'Name       InterfaceDescription             Status       MacAddress', '----       --------------------             ------       ----------', `${nic.name.padEnd(10)} Carte réseau Microsoft Hyper-V   Up           ${nic.mac}`, '']);

  return L([`'${toks[0]}' n’est pas reconnu en tant que commande interne`, 'ou externe, un programme exécutable ou un fichier de commandes.', '(Tape « help » pour la liste des commandes simulées.)']);
}

// ═══ Composant ═══
const boxS: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-2)', padding: 12 };
const inpS: React.CSSProperties = { width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' };
const btnS: React.CSSProperties = { padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 7, background: 'transparent', color: 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: 12.5 };

const LS = 'cmdemu_vm_v2';
const LS_HIST = 'cmdemu_hist_v1';
type Line = { t: string; k?: 'cmd' | 'err' };

// Terminal réutilisable (moteur partagé `run`) — utilisé tel quel dans le simulateur OS.
// `shell` : 'cmd' (invite noire, prompt C:\>) ou 'powershell' (fond bleu, prompt PS C:\>).
const LS_WS_CMD = 'ws_cmd_vm_v1';
const LS_WS_PS = 'ws_ps_vm_v1';
export function CmdConsole({ shell = 'cmd', height = 360 }: { shell?: 'cmd' | 'powershell'; height?: number }) {
  const isPs = shell === 'powershell';
  const LSk = isPs ? LS_WS_PS : LS_WS_CMD;
  const [vm, setVm] = useState<VM>(() => { try { return { ...defaultVM(), ...JSON.parse(localStorage.getItem(LSk) || '{}') }; } catch { return defaultVM(); } });
  const banner: Line[] = isPs
    ? [{ t: 'Windows PowerShell' }, { t: '(c) Microsoft Corporation. Tous droits réservés. — ÉMULATEUR (bac à sable).' }, { t: 'Cmdlets (New-NetIPAddress, Rename-Computer, Test-NetConnection…) et commandes cmd acceptées. « help » pour la liste.' }, { t: '' }]
    : [{ t: 'Microsoft Windows [version 10.0.19045.4529]' }, { t: '(c) Microsoft Corporation. Tous droits réservés. — ÉMULATEUR (bac à sable).' }, { t: 'Tape « help » pour la liste des commandes. Tab = complétion, ↑/↓ = historique.' }, { t: '' }];
  const [lines, setLines] = useState<Line[]>(banner);
  const [input, setInput] = useState('');
  const hist = useRef<string[]>([]);
  const hi = useRef(0);
  const scRef = useRef<HTMLDivElement>(null);
  const inRef = useRef<HTMLInputElement>(null);
  useEffect(() => { try { localStorage.setItem(LSk, JSON.stringify(vm)); } catch { /* */ } }, [vm, LSk]);
  useEffect(() => { const el = scRef.current; if (el) el.scrollTop = el.scrollHeight; }, [lines]);
  const prompt = isPs ? `PS ${vm.cwd}> ` : `${vm.cwd}>`;
  const exec = (cmd: string) => {
    const echo: Line[] = [{ t: `${prompt}${cmd}`, k: 'cmd' }];
    if (cmd.trim()) { hist.current.push(cmd); hist.current = hist.current.slice(-100); }
    hi.current = hist.current.length;
    const r = run(cmd, vm);
    if (r.vm) setVm(r.vm);
    if (r.clear) { setLines([]); setInput(''); return; }
    const isErr = r.out[0]?.includes('n’est pas reconnu');
    setLines(ls => [...ls, ...echo, ...r.out.map(t => ({ t, k: isErr ? 'err' as const : undefined }))]);
    setInput('');
  };
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') exec(input);
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (hist.current.length) { hi.current = Math.max(0, hi.current - 1); setInput(hist.current[hi.current] || ''); } }
    else if (e.key === 'ArrowDown') { e.preventDefault(); hi.current = Math.min(hist.current.length, hi.current + 1); setInput(hist.current[hi.current] || ''); }
    else if (e.key === 'Tab') { e.preventDefault(); const w = input.split(' '); const last = w[w.length - 1].toLowerCase(); if (w.length === 1 && last) { const hit = COMMANDS.filter(c => c.startsWith(last)); if (hit.length === 1) setInput(hit[0] + ' '); else if (hit.length > 1) setLines(ls => [...ls, { t: `${prompt}${input}`, k: 'cmd' }, { t: hit.join('   ') }]); } }
    else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); setLines([]); }
  };
  const bg = isPs ? '#012456' : '#0c0c0c';
  const fg = isPs ? '#eef1f6' : '#cfcfcf';
  return (
    <div onClick={() => inRef.current?.focus()} ref={scRef} style={{ background: bg, border: '1px solid #000', borderRadius: 6, padding: 12, height, overflow: 'auto', cursor: 'text', fontFamily: 'Consolas,"Cascadia Mono",ui-monospace,monospace', fontSize: 13, lineHeight: 1.4 }}>
      {lines.map((l, i) => <div key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: l.k === 'cmd' ? '#fff' : l.k === 'err' ? '#ff7a7a' : fg }}>{l.t || ' '}</div>)}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ color: '#fff', whiteSpace: 'pre' }}>{prompt}</span>
        <input ref={inRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey} autoComplete="off" spellCheck={false} style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontFamily: 'inherit', fontSize: 13 }} />
      </div>
    </div>
  );
}

/*
 * @id     tssr.atelier.cmdEmulator
 * @do     emuler_terminal
 * @role   ui
 * @layer  ui
 * @human  Atelier : émulateur de terminal de commandes.
 */
export function CmdEmulator() {
  const [vm, setVm] = useState<VM>(() => { try { return { ...defaultVM(), ...JSON.parse(localStorage.getItem(LS) || '{}') }; } catch { return defaultVM(); } });
  const [lines, setLines] = useState<Line[]>([
    { t: 'Microsoft Windows [version 10.0.19045.4529]' },
    { t: '(c) Microsoft Corporation. Tous droits réservés. — ÉMULATEUR (bac à sable).' },
    { t: 'Tape « help » pour la liste des commandes. Tab = complétion, ↑/↓ = historique.' },
    { t: '' },
  ]);
  const [input, setInput] = useState('');
  const hist = useRef<string[]>((() => { try { return JSON.parse(localStorage.getItem(LS_HIST) || '[]'); } catch { return []; } })());
  const hi = useRef(hist.current.length);
  const scRef = useRef<HTMLDivElement>(null);
  const inRef = useRef<HTMLInputElement>(null);
  const [showHosts, setShowHosts] = useState(true);

  useEffect(() => { try { localStorage.setItem(LS, JSON.stringify(vm)); } catch { /* */ } }, [vm]);
  useEffect(() => { const el = scRef.current; if (el) el.scrollTop = el.scrollHeight; }, [lines]);

  const prompt = `${vm.cwd}>`;

  const exec = (cmd: string) => {
    const echo: Line[] = [{ t: `${prompt}${cmd}`, k: 'cmd' }];
    if (cmd.trim()) { hist.current.push(cmd); hist.current = hist.current.slice(-100); try { localStorage.setItem(LS_HIST, JSON.stringify(hist.current)); } catch { /* */ } }
    hi.current = hist.current.length;
    const r = run(cmd, vm);
    if (r.vm) setVm(r.vm);
    if (r.clear) { setLines([]); setInput(''); return; }
    const isErr = r.out[0]?.includes('n’est pas reconnu');
    setLines(ls => [...ls, ...echo, ...r.out.map(t => ({ t, k: isErr ? 'err' as const : undefined }))]);
    setInput('');
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') exec(input);
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (hist.current.length) { hi.current = Math.max(0, hi.current - 1); setInput(hist.current[hi.current] || ''); } }
    else if (e.key === 'ArrowDown') { e.preventDefault(); hi.current = Math.min(hist.current.length, hi.current + 1); setInput(hist.current[hi.current] || ''); }
    else if (e.key === 'Tab') { e.preventDefault(); const w = input.split(' '); const last = w[w.length - 1].toLowerCase(); if (w.length === 1 && last) { const hit = COMMANDS.filter(c => c.startsWith(last)); if (hit.length === 1) setInput(hit[0] + ' '); else if (hit.length > 1) setLines(ls => [...ls, { t: `${prompt}${input}`, k: 'cmd' }, { t: hit.join('   ') }]); } }
    else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); setLines([]); }
    else if (e.key === 'c' && e.ctrlKey) { e.preventDefault(); setLines(ls => [...ls, { t: `${prompt}${input}^C`, k: 'cmd' }]); setInput(''); }
  };

  const setHost = (i: number, k: keyof Host, v: string) => setVm(s => ({ ...s, hosts: s.hosts.map((h, j) => j === i ? { ...h, [k]: v } : h) }));
  const setDhcp = (k: keyof Scope, v: string | boolean) => setVm(s => ({ ...s, dhcp: { ...s.dhcp, [k]: v } }));
  const reset = () => { setVm(defaultVM()); setLines([{ t: 'État réinitialisé.' }, { t: '' }]); hi.current = hist.current.length; };
  const quick = (c: string) => { setInput(c); inRef.current?.focus(); };

  return (
    <div className="cmdemu-grid" style={{ margin: '14px 0', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 272px', gap: 14, alignItems: 'start' }}>
      <style>{`@media(max-width:760px){.cmdemu-grid{grid-template-columns:1fr!important}}`}</style>
      <div style={{ minWidth: 0 }}>
        <div onClick={() => inRef.current?.focus()} ref={scRef} style={{ background: '#0c0c0c', border: '1px solid #000', borderRadius: 8, padding: 12, height: 400, overflow: 'auto', cursor: 'text', fontFamily: 'Consolas,"Cascadia Mono",ui-monospace,monospace', fontSize: 13, lineHeight: 1.4 }}>
          {lines.map((l, i) => <div key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: l.k === 'cmd' ? '#e8e8e8' : l.k === 'err' ? '#ff7a7a' : '#cfcfcf' }}>{l.t || ' '}</div>)}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ color: '#e8e8e8', whiteSpace: 'pre' }}>{prompt}</span>
            <input ref={inRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey} autoComplete="off" spellCheck={false} style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontFamily: 'inherit', fontSize: 13 }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <button style={btnS} onClick={() => quick('ipconfig /all')}>ipconfig /all</button>
          <button style={btnS} onClick={() => quick('netsh interface ip set address "Ethernet" static 192.168.10.101 255.255.255.0 192.168.10.254')}>ex. netsh IP</button>
          <button style={btnS} onClick={() => quick('ping srv-dns')}>ping srv-dns</button>
          <button style={btnS} onClick={() => quick('dir')}>dir</button>
          <button style={btnS} onClick={() => quick('help')}>help</button>
          <button style={{ ...btnS, borderColor: 'var(--accent)', color: 'var(--accent)' }} onClick={reset}>↺ Réinitialiser</button>
        </div>
        <details style={{ marginTop: 10, ...boxS }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 12.5 }}>📖 Aide-mémoire des commandes</summary>
          <div style={{ fontSize: 12, lineHeight: 1.7, marginTop: 8, color: 'var(--text-soft)' }}>
            <b>IP fixe :</b> <code>netsh interface ip set address "Ethernet" static 192.168.10.250 255.255.255.0 192.168.10.254</code><br />
            <b>DNS :</b> <code>netsh interface ip set dns "Ethernet" static 192.168.10.250</code><br />
            <b>Repasser en DHCP :</b> <code>netsh interface ip set address "Ethernet" dhcp</code> puis <code>ipconfig /renew</code><br />
            <b>Vérifier :</b> <code>ipconfig /all</code> · <code>ping &lt;ip|nom&gt;</code> · <code>nslookup &lt;nom&gt;</code> · <code>arp -a</code><br />
            <b>Pare-feu (ping) :</b> <code>netsh advfirewall firewall add rule name="Ping" protocol=icmpv4 dir=in action=allow</code><br />
            <b>Renommer :</b> <code>netdom renamecomputer WIN-TSSR /newname:SRV-DNS /force</code> ou PS <code>Rename-Computer -NewName SRV-DNS</code><br />
            <b>PowerShell :</b> <code>New-NetIPAddress -InterfaceAlias Ethernet -IPAddress 192.168.10.250 -PrefixLength 24</code>
          </div>
        </details>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={boxS}>
          <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>🖥️ État de la machine</div>
          <div style={{ fontSize: 12, lineHeight: 1.7, fontFamily: 'ui-monospace,monospace', color: 'var(--text-soft)' }}>
            <div>hostname : <b style={{ color: 'var(--text)' }}>{vm.hostname}</b></div>
            <div>carte : {vm.nic.name}</div>
            <div>IP : <b style={{ color: 'var(--text)' }}>{effIp(vm.nic) || '—'}</b></div>
            <div>masque : {effMask(vm.nic) || '—'}</div>
            <div>passerelle : {vm.nic.gateway || '—'}</div>
            <div>DNS : {vm.nic.dns.join(', ') || '—'}</div>
            <div>DHCP carte : {vm.nic.dhcp ? (vm.nic.leased ? 'bail obtenu' : 'oui') : 'non (statique)'}</div>
            <div>pare-feu : {vm.fw.on ? 'activé' : 'désactivé'} · ping in {vm.fw.icmpIn ? '✓' : '✗'}</div>
          </div>
        </div>

        <div style={boxS}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 12.5 }}>🛜 Serveur DHCP simulé</div>
            <label style={{ fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4 }}><input type="checkbox" checked={vm.dhcp.on} onChange={e => setDhcp('on', e.target.checked)} /> actif</label>
          </div>
          <div className="meta" style={{ fontSize: 11, margin: '4px 0 8px' }}>Si actif, <code>ipconfig /renew</code> obtient un bail.</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
            <input style={{ ...inpS, fontSize: 12 }} value={vm.dhcp.start} onChange={e => setDhcp('start', e.target.value)} placeholder="début" />
            <input style={{ ...inpS, fontSize: 12 }} value={vm.dhcp.end} onChange={e => setDhcp('end', e.target.value)} placeholder="fin" />
            <input style={{ ...inpS, fontSize: 12 }} value={vm.dhcp.mask} onChange={e => setDhcp('mask', e.target.value)} placeholder="masque" />
            <input style={{ ...inpS, fontSize: 12 }} value={vm.dhcp.dns} onChange={e => setDhcp('dns', e.target.value)} placeholder="DNS" />
          </div>
        </div>

        <div style={boxS}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowHosts(s => !s)}>
            <div style={{ fontWeight: 700, fontSize: 12.5 }}>🌐 Hôtes du réseau simulé</div>
            <span style={{ fontSize: 12 }}>{showHosts ? '▾' : '▸'}</span>
          </div>
          {showHosts && <>
            <div className="meta" style={{ fontSize: 11, margin: '4px 0 8px' }}>Répondent au ping/nslookup s’ils sont dans ton sous-réseau.</div>
            {vm.hosts.map((h, i) => (
              <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 5 }}>
                <input style={{ ...inpS, flex: '1 1 66px', fontSize: 12 }} value={h.name} onChange={e => setHost(i, 'name', e.target.value)} placeholder="nom" />
                <input style={{ ...inpS, flex: '1 1 92px', fontSize: 12, fontFamily: 'ui-monospace,monospace' }} value={h.ip} onChange={e => setHost(i, 'ip', e.target.value)} placeholder="IP" />
                <button style={{ ...btnS, padding: '4px 8px' }} onClick={() => setVm(s => ({ ...s, hosts: s.hosts.filter((_, j) => j !== i) }))} title="Supprimer">✕</button>
              </div>
            ))}
            <button style={{ ...btnS, marginTop: 4 }} onClick={() => setVm(s => ({ ...s, hosts: [...s.hosts, { name: '', ip: '' }] }))}>+ Ajouter un hôte</button>
          </>}
        </div>
      </div>
    </div>
  );
}

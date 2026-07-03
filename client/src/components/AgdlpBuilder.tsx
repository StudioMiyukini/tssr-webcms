import { useEffect, useMemo, useState } from 'react';

/**
 * Constructeur AGDLP — arborescences éditables (UO & dossiers imbriqués), groupes Globaux,
 * utilisateurs, et par dossier : droit de PARTAGE (coarse) + droits NTFS GRANULAIRES par groupe.
 * Respecte AGDLP (Account → Global → Domain Local → Permission) et la convention de nommage.
 * Sorties : arbo UO, arbo dossiers+NTFS, 2 scripts (DC + serveur de fichiers).
 * Îlot React hydraté via RichContent (data-block="agdlp-builder").
 */

type NtfsKey = 'F' | 'M' | 'MND' | 'RX' | 'R' | 'W' | 'CUSTOM';
const NTFS: Array<{ key: NtfsKey; label: string; icacls: string; suffix: string }> = [
  { key: 'F', label: 'Contrôle total', icacls: 'F', suffix: 'ControleTotal' },
  { key: 'M', label: 'Modification', icacls: 'M', suffix: 'Modification' },
  { key: 'MND', label: 'Modifier (sans suppression)', icacls: '(RX,W)', suffix: 'ModifSansSuppr' },
  { key: 'RX', label: 'Lecture et exécution', icacls: 'RX', suffix: 'LectureExecution' },
  { key: 'R', label: 'Lecture', icacls: 'R', suffix: 'Lecture' },
  { key: 'W', label: 'Écriture', icacls: 'W', suffix: 'Ecriture' },
  { key: 'CUSTOM', label: 'Personnalisé (icacls)…', icacls: '', suffix: 'Perso' },
];
const ntfs = (k: NtfsKey) => NTFS.find(x => x.key === k) || NTFS[1];
// Codes de droit courts pour tenir le nom de groupe DL sous la limite AD (sAMAccountName ≤ 20).
const RIGHT_CODE: Record<NtfsKey, string> = { F: 'CT', M: 'M', MND: 'MND', RX: 'RX', R: 'L', W: 'E', CUSTOM: 'P' };

type Ou = { id: string; name: string; parent: string };
type GGroup = { id: string; name: string; ou: string };
type User = { id: string; prenom: string; nom: string; ou: string; group: string };
type Rule = { group: string; right: NtfsKey; custom?: string };
type Folder = { id: string; name: string; code: string; parent: string; abs?: string; noInherit?: boolean; rules: Rule[] };

const clean = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '');
const login = (p: string, n: string) => `${clean(p)}.${clean(n)}`.toLowerCase();
const domainToDN = (d: string) => d.split('.').filter(Boolean).map(x => `DC=${x}`).join(',');
const netbiosOf = (d: string) => clean(d.split('.')[0] || 'DOMAINE').toUpperCase();
const uid = (p: string) => p + Math.random().toString(36).slice(2, 8);

const fieldStyle: React.CSSProperties = { width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13.5, boxSizing: 'border-box' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 4 };
const groupStyle: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface-2)', marginBottom: 14 };
const legendStyle: React.CSSProperties = { fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const btnStyle: React.CSSProperties = { padding: '6px 11px', border: '1px solid var(--accent)', borderRadius: 8, background: 'transparent', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 12.5, whiteSpace: 'nowrap' };
const smallBtn: React.CSSProperties = { ...btnStyle, padding: '3px 9px', fontSize: 12, borderColor: 'var(--border)', color: 'var(--text-soft)' };
const auto: React.CSSProperties = { width: 'auto' };

const D_OUS: Ou[] = [
  { id: 'base', name: 'Miyukini', parent: 'ROOT' },
  { id: 'users', name: 'Utilisateurs', parent: 'base' },
  { id: 'gg', name: 'GG', parent: 'base' },
  { id: 'gdl', name: 'GDL', parent: 'base' },
  { id: 'ord', name: 'Ordinateurs', parent: 'base' },
  { id: 'compta', name: 'Comptabilité', parent: 'users' },
  { id: 'direction', name: 'Direction', parent: 'users' },
];
const D_GG: GGroup[] = [{ id: 'gcompta', name: 'Comptables', ou: 'gg' }, { id: 'gdir', name: 'Direction', ou: 'gg' }];
const D_USERS: User[] = [{ id: 'u1', prenom: 'Jean', nom: 'Nguyen', ou: 'compta', group: 'gcompta' }, { id: 'u2', prenom: 'Marie', nom: 'Durand', ou: 'compta', group: 'gcompta' }];
const D_FOLDERS: Folder[] = [
  { id: 'fc', name: 'Comptabilité', code: 'Compta', parent: 'ROOT', rules: [{ group: 'gcompta', right: 'M' }, { group: 'gdir', right: 'R' }] },
  { id: 'fco', name: 'Commercial', code: 'Commercial', parent: 'ROOT', rules: [{ group: 'gdir', right: 'R' }] },
];
function load<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }

// Descendants d'un noeud (pour éviter de choisir un enfant comme parent → cycle).
function descendants<T extends { id: string; parent: string }>(items: T[], id: string): string[] {
  const out: string[] = []; const stack = items.filter(i => i.parent === id);
  while (stack.length) { const n = stack.pop()!; out.push(n.id); stack.push(...items.filter(i => i.parent === n.id)); }
  return out;
}

export function AgdlpBuilder() {
  const [domain, setDomain] = useState(() => load('agdlp2_domain', 'miyukini.lan'));
  const [basePath, setBasePath] = useState(() => load('agdlp2_base', 'E:\\Partages'));
  const [shareRoot, setShareRoot] = useState<boolean>(() => load('agdlp2_shareroot', true));
  const [shareName, setShareName] = useState(() => load('agdlp2_sharename', 'Partages'));
  const [ous, setOus] = useState<Ou[]>(() => load('agdlp2_ous', D_OUS));
  const [dlOu, setDlOu] = useState<string>(() => load('agdlp2_dlou', 'gdl'));
  const [ggroups, setGgroups] = useState<GGroup[]>(() => load('agdlp2_gg', D_GG));
  const [users, setUsers] = useState<User[]>(() => load('agdlp2_users', D_USERS));
  const [folders, setFolders] = useState<Folder[]>(() => load('agdlp2_folders', D_FOLDERS));
  const [copiedId, setCopiedId] = useState('');
  const [bulk, setBulk] = useState(''); const [bulkOu, setBulkOu] = useState(''); const [bulkGrp, setBulkGrp] = useState('');
  const [bulkGg, setBulkGg] = useState(''); const [bulkGgOu, setBulkGgOu] = useState('');
  const [bulkFold, setBulkFold] = useState('');
  const [unlocked, setUnlocked] = useState(() => { try { return sessionStorage.getItem('agdlp_ok') === '1'; } catch { return false; } });

  useEffect(() => { try {
    localStorage.setItem('agdlp2_domain', JSON.stringify(domain)); localStorage.setItem('agdlp2_base', JSON.stringify(basePath));
    localStorage.setItem('agdlp2_shareroot', JSON.stringify(shareRoot)); localStorage.setItem('agdlp2_sharename', JSON.stringify(shareName));
    localStorage.setItem('agdlp2_ous', JSON.stringify(ous)); localStorage.setItem('agdlp2_dlou', JSON.stringify(dlOu));
    localStorage.setItem('agdlp2_gg', JSON.stringify(ggroups)); localStorage.setItem('agdlp2_users', JSON.stringify(users));
    localStorage.setItem('agdlp2_folders', JSON.stringify(folders));
  } catch { /* */ } }, [domain, basePath, shareRoot, shareName, ous, dlOu, ggroups, users, folders]);

  // Auto-répare : garantit une OU pour les groupes Domaine Local (« GDL ») et y pointe dlOu.
  useEffect(() => {
    setOus(prev => {
      if (prev.some(o => o.id === dlOu)) return prev;
      const found = prev.find(o => clean(o.name).toUpperCase() === 'GDL');
      if (found) { setDlOu(found.id); return prev; }
      const base = prev.find(o => o.parent === 'ROOT') || prev[0];
      setDlOu('gdl');
      return [...prev, { id: 'gdl', name: 'GDL', parent: base ? base.id : 'ROOT' }];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const domainDN = domainToDN(domain);
  const netbios = netbiosOf(domain);
  const ggOuDefault = ous.find(o => clean(o.name).toUpperCase() === 'GG')?.id || ous.find(o => o.parent === 'ROOT')?.id || ous[0]?.id || 'ROOT';
  const ouById = (id: string) => ous.find(o => o.id === id);
  const dnOfOu = (id: string): string => { const o = ouById(id); if (!o) return domainDN; return `OU=${o.name},${o.parent === 'ROOT' ? domainDN : dnOfOu(o.parent)}`; };
  const depthOu = (o: Ou) => { let d = 0, c: Ou | undefined = o; while (c && c.parent !== 'ROOT') { c = ouById(c.parent); d++; if (d > 60) break; } return d; };
  const folderById = (id: string) => folders.find(f => f.id === id);
  const pathOf = (id: string): string => { const f = folderById(id); if (!f) return basePath; if (f.abs) return f.abs; return `${f.parent === 'ROOT' ? basePath : pathOf(f.parent)}\\${f.name}`; };
  const depthF = (f: Folder) => { let d = 0, c: Folder | undefined = f; while (c && c.parent !== 'ROOT') { c = folderById(c.parent); d++; if (d > 60) break; } return d; };
  const ggById = (id: string) => ggroups.find(g => g.id === id);
  const gName = (id: string) => ('G_' + clean(ggById(id)?.name || '')).slice(0, 20);
  const dlName = (f: Folder, rl: Rule) => `DL_${clean(f.code || f.name).slice(0, 15)}_${RIGHT_CODE[rl.right]}`.slice(0, 20);
  const rightLabel = (rl: Rule) => rl.right === 'CUSTOM' ? `icacls ${rl.custom || '?'}` : ntfs(rl.right).label;
  // Chaîne d'autorisation icacls : (OI)(CI) + le droit (lettre simple, combo, ou personnalisé).
  const igrant = (rl: Rule) => { const p = rl.right === 'CUSTOM' ? `(${(rl.custom || 'R').replace(/[^A-Za-z0-9,]/g, '')})` : ntfs(rl.right).icacls; return `(OI)(CI)${p}`; };

  const dlGroups = useMemo(() => {
    const m = new Map<string, { f: Folder; rule: Rule }>();
    for (const f of folders) for (const rl of f.rules) m.set(dlName(f, rl), { f, rule: rl });
    return Array.from(m.values());
  }, [folders]);

  // ---- Aperçu : arborescence des UO ----
  const ouTree = useMemo(() => {
    const L: string[] = [`🌐 ${domain}`];
    const walk = (o: Ou, prefix: string, last: boolean) => {
      L.push(`${prefix}${last ? '└─' : '├─'} 📁 OU=${o.name}`);
      const kids = ous.filter(c => c.parent === o.id);
      kids.forEach((c, i) => walk(c, prefix + (last ? '    ' : '│   '), i === kids.length - 1));
    };
    const roots = ous.filter(o => o.parent === 'ROOT');
    roots.forEach((o, i) => walk(o, '', i === roots.length - 1));
    return L.join('\n');
  }, [ous, domain]);

  // ---- Aperçu : arborescence des dossiers + droits NTFS ----
  const ntfsTree = useMemo(() => {
    const L: string[] = [];
    const walk = (f: Folder, prefix: string, last: boolean) => {
      L.push(`${prefix}${last ? '└─' : '├─'} 📂 ${f.name}${f.noInherit ? '   ⛔ héritage désactivé' : ''}`);
      const sub = prefix + (last ? '    ' : '│   ');
      f.rules.forEach(rl => L.push(`${sub}   🔒 ${dlName(f, rl)} → ${rightLabel(rl)}  (⟵ ${gName(rl.group)})`));
      const kids = folders.filter(c => c.parent === f.id);
      kids.forEach((c, i) => walk(c, sub, i === kids.length - 1));
    };
    L.push(`📁 ${basePath}${shareRoot ? `   📤 Partage « ${shareName} » : Utilisateurs authentifiés = Contrôle total` : ''}`);
    const roots = folders.filter(f => f.parent === 'ROOT');
    roots.forEach((f, i) => walk(f, '', i === roots.length - 1));
    return L.join('\n');
  }, [folders, basePath, shareRoot, shareName]);

  // ---- Script 1 : contrôleur de domaine ----
  const scriptDC = useMemo(() => {
    const o: string[] = [];
    o.push('#Requires -RunAsAdministrator');
    o.push('# ============================================================');
    o.push(`#  AGDLP - SUR LE CONTROLEUR DE DOMAINE (${domain})`);
    o.push('# ============================================================');
    o.push('Import-Module ActiveDirectory');
    o.push('function Ensure-OU($n,$p){ if(-not(Get-ADOrganizationalUnit -Filter "Name -eq \'$n\'" -SearchBase $p -ErrorAction SilentlyContinue)){ New-ADOrganizationalUnit -Name $n -Path $p -ProtectedFromAccidentalDeletion:$false } }');
    o.push('function Ensure-Grp($n,$s,$p){ if(-not(Get-ADGroup -Filter "Name -eq \'$n\'" -ErrorAction SilentlyContinue)){ New-ADGroup -Name $n -SamAccountName $n -GroupScope $s -GroupCategory Security -Path $p } }');
    o.push('');
    o.push('# --- 1) Unites d\'organisation (parents avant enfants) ---');
    [...ous].sort((a, b) => depthOu(a) - depthOu(b)).forEach(ou => o.push(`Ensure-OU '${ou.name}' '${ou.parent === 'ROOT' ? domainDN : dnOfOu(ou.parent)}'`));
    o.push('');
    o.push('# --- 2) Groupes GLOBAUX (par metier) ---');
    ggroups.forEach(g => o.push(`Ensure-Grp '${gName(g.id)}' Global '${dnOfOu(g.ou)}'`));
    o.push('');
    o.push('# --- 3) Groupes DOMAINE LOCAL (par dossier + droit NTFS) ---');
    dlGroups.forEach(g => o.push(`Ensure-Grp '${dlName(g.f, g.rule)}' DomainLocal '${dnOfOu(dlOu)}'`));
    o.push('');
    o.push('# --- 4) Imbrication : Global -> Domaine Local ---');
    for (const f of folders) for (const rl of f.rules) o.push(`Add-ADGroupMember '${dlName(f, rl)}' -Members '${gName(rl.group)}' -ErrorAction SilentlyContinue`);
    o.push('');
    o.push('# --- 5) Utilisateurs (OU de placement + ajout au Global) ---');
    o.push('$pwd = Read-Host "Mot de passe initial des comptes" -AsSecureString');
    for (const u of users) {
      const l = login(u.prenom, u.nom);
      o.push(`if(-not(Get-ADUser -Filter "SamAccountName -eq '${l}'" -ErrorAction SilentlyContinue)){ New-ADUser -Name '${u.prenom} ${u.nom}' -GivenName '${u.prenom}' -Surname '${u.nom}' -SamAccountName '${l}' -UserPrincipalName '${l}@${domain}' -Path '${dnOfOu(u.ou)}' -AccountPassword $pwd -Enabled $true -ChangePasswordAtLogon $true }`);
      if (u.group) o.push(`Add-ADGroupMember '${gName(u.group)}' -Members '${l}' -ErrorAction SilentlyContinue`);
    }
    o.push('Write-Host "AGDLP applique cote AD." -ForegroundColor Green');
    return o.join('\n');
  }, [domain, domainDN, ous, ggroups, dlOu, folders, dlGroups, users]);

  // ---- Script 2 : serveur de fichiers ----
  const scriptFS = useMemo(() => {
    const o: string[] = [];
    o.push('#Requires -RunAsAdministrator');
    o.push('# ============================================================');
    o.push('#  AGDLP - SUR LE SERVEUR DE FICHIERS');
    o.push('#  1 partage sur le dossier racine (Utilisateurs authentifies = Controle total)');
    o.push('#  puis controle reel par NTFS granulaire sur les groupes Domaine Local');
    o.push('#  PREREQUIS : lancer d\'abord le script (1) sur le DC pour creer les groupes DL,');
    o.push('#             sinon icacls echoue et laisse des SID orphelins.');
    o.push('# ============================================================');
    o.push("# Nom exact du groupe 'Utilisateurs authentifies' resolu via son SID (independant de la langue)");
    o.push("$AuthUsers = (New-Object System.Security.Principal.SecurityIdentifier('S-1-5-11')).Translate([System.Security.Principal.NTAccount]).Value");
    o.push('');
    o.push(`# --- Dossier racine + PARTAGE unique ---`);
    o.push(`New-Item -ItemType Directory -Path '${basePath}' -Force | Out-Null`);
    if (shareRoot) o.push(`if(-not(Get-SmbShare -Name '${shareName}' -ErrorAction SilentlyContinue)){ New-SmbShare -Name '${shareName}' -Path '${basePath}' -FullAccess $AuthUsers | Out-Null }`);
    o.push('');
    [...folders].sort((a, b) => depthF(a) - depthF(b)).forEach(f => {
      const p = pathOf(f.id);
      o.push(`# --- ${f.name}  (${p}) ---`);
      o.push(`New-Item -ItemType Directory -Path '${p}' -Force | Out-Null`);
      if (f.noInherit) {
        o.push(`icacls '${p}' /inheritance:r`);
        o.push(`icacls '${p}' /grant '*S-1-5-32-544:(OI)(CI)(F)'   # Administrateurs (garde l'acces admin)`);
        o.push(`icacls '${p}' /grant '*S-1-5-18:(OI)(CI)(F)'       # Systeme`);
      }
      for (const rl of f.rules) o.push(`icacls '${p}' /grant '${netbios}\\${dlName(f, rl)}:${igrant(rl)}'`);
      o.push('');
    });
    o.push('Write-Host "Dossier racine partage + NTFS appliques." -ForegroundColor Green');
    return o.join('\n').trimEnd();
  }, [folders, basePath, shareRoot, shareName, netbios]);

  // ---- Script 3 : vérification (lecture seule) ----
  const scriptVerify = useMemo(() => {
    const o: string[] = [];
    o.push('# ============================================================');
    o.push('#  VERIFICATION (lecture seule) - controler le resultat AGDLP');
    o.push('# ============================================================');
    if (shareRoot) { o.push('# --- Partage (sur le serveur de fichiers) ---'); o.push(`Get-SmbShareAccess -Name '${shareName}'`); o.push(''); }
    o.push('# --- Permissions NTFS par dossier (sur le serveur de fichiers) ---');
    [...folders].sort((a, b) => depthF(a) - depthF(b)).forEach(f => {
      const p = pathOf(f.id);
      o.push(`Write-Host '${p}' -ForegroundColor Cyan`);
      o.push(`(Get-Acl '${p}').Access | Format-Table IdentityReference,FileSystemRights,AccessControlType,IsInherited -AutoSize`);
    });
    o.push('');
    o.push('# --- Imbrication AGDLP : membres des groupes Domaine Local (sur le DC) ---');
    o.push('if(Get-Module -ListAvailable ActiveDirectory){ Import-Module ActiveDirectory');
    dlGroups.forEach(g => o.push(`  Write-Host '${dlName(g.f, g.rule)}' -ForegroundColor Cyan; Get-ADGroupMember '${dlName(g.f, g.rule)}' | Select-Object Name`));
    o.push('}');
    return o.join('\n');
  }, [folders, basePath, shareRoot, shareName, dlGroups]);

  const copy = (id: string, code: string) => { navigator.clipboard?.writeText(code).then(() => { setCopiedId(id); setTimeout(() => setCopiedId(''), 1600); }).catch(() => {}); };
  const download = (code: string, filename: string) => {
    const blob = new Blob(['\uFEFF' + code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  // mutations
  const patchOu = (id: string, p: Partial<Ou>) => setOus(a => a.map(x => x.id === id ? { ...x, ...p } : x));
  const addOu = () => setOus(a => [...a, { id: uid('o'), name: 'Nouvelle_OU', parent: a[0]?.id || 'ROOT' }]);
  const delOu = (id: string) => { const bad = new Set([id, ...descendants(ous, id)]); setOus(a => a.filter(x => !bad.has(x.id))); };
  const patchGg = (id: string, p: Partial<GGroup>) => setGgroups(a => a.map(x => x.id === id ? { ...x, ...p } : x));
  const addGg = () => setGgroups(a => [...a, { id: uid('g'), name: 'Groupe', ou: ggOuDefault }]);
  const delGg = (id: string) => setGgroups(a => a.filter(x => x.id !== id));
  const patchUser = (id: string, p: Partial<User>) => setUsers(a => a.map(x => x.id === id ? { ...x, ...p } : x));
  const addUser = () => setUsers(a => [...a, { id: uid('u'), prenom: 'Prénom', nom: 'Nom', ou: ous.find(o => o.id === 'users')?.id || ous[0]?.id || '', group: ggroups[0]?.id || '' }]);
  const delUser = (id: string) => setUsers(a => a.filter(x => x.id !== id));
  const patchFolder = (id: string, p: Partial<Folder>) => setFolders(a => a.map(x => x.id === id ? { ...x, ...p } : x));
  const addFolder = () => setFolders(a => [...a, { id: uid('f'), name: 'Dossier', code: 'Dossier', parent: 'ROOT', rules: [] }]);
  const addGgBulk = () => {
    const ou = bulkGgOu || ggOuDefault;
    const rows = bulkGg.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(n => ({ id: uid('g'), name: n, ou }));
    if (rows.length) { setGgroups(a => [...a, ...rows]); setBulkGg(''); }
  };
  const addFoldersBulk = () => {
    const rows = bulkFold.split(/\r?\n/).map(l => l.trim().replace(/[\\/]+$/, '')).filter(Boolean).map(p => { const seg = p.split(/[\\/]/).filter(Boolean); const name = seg[seg.length - 1] || 'Dossier'; return { id: uid('f'), name, code: clean(name).slice(0, 15), parent: 'ROOT', abs: p, rules: [] as Rule[] }; });
    if (rows.length) { setFolders(a => [...a, ...rows]); setBulkFold(''); }
  };
  const delFolder = (id: string) => { const bad = new Set([id, ...descendants(folders, id)]); setFolders(a => a.filter(x => !bad.has(x.id))); };
  const addRule = (fid: string) => setFolders(a => a.map(f => f.id === fid ? { ...f, rules: [...f.rules, { group: ggroups[0]?.id || '', right: 'M' as NtfsKey }] } : f));
  const patchRule = (fid: string, j: number, p: Partial<Rule>) => setFolders(a => a.map(f => f.id === fid ? { ...f, rules: f.rules.map((r, k) => k === j ? { ...r, ...p } : r) } : f));
  const delRule = (fid: string, j: number) => setFolders(a => a.map(f => f.id === fid ? { ...f, rules: f.rules.filter((_, k) => k !== j) } : f));
  const importBulk = () => {
    const ou = bulkOu || ous.find(o => o.id === 'users')?.id || ous[0]?.id || ''; const grp = bulkGrp || ggroups[0]?.id || '';
    const rows = bulk.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => { const p = l.split(/\s+/); return { id: uid('u'), prenom: p[0] || '', nom: p.slice(1).join(' ') || '', ou, group: grp }; }).filter(u => u.prenom && u.nom);
    if (rows.length) { setUsers(u => [...u, ...rows]); setBulk(''); }
  };

  if (!unlocked) {
    return (
      <div style={{ margin: '14px 0', maxWidth: 600, ...groupStyle }}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 10 }}>⚠️ Avant d’utiliser cet outil</div>
        <aside className="pb-note pb-note-yellow" style={{ marginBottom: 14 }}>
          <p className="pb-note-title">Outil réservé aux personnes qui maîtrisent</p>
          <p>Ce constructeur génère des scripts qui <strong>créent des OU, groupes, utilisateurs et modifient les permissions NTFS</strong> d’un domaine. À n’utiliser qu’en <strong>environnement de test</strong> et si tu maîtrises Active Directory.</p>
        </aside>
        <button type="button" onClick={() => { setUnlocked(true); try { sessionStorage.setItem('agdlp_ok', '1'); } catch { /* */ } }} style={{ padding: '10px 18px', border: 'none', borderRadius: 8, background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>Je veux utiliser l’outil</button>
      </div>
    );
  }

  const parentSel = (id: string, val: string, onCh: (v: string) => void, items: Array<{ id: string; name: string }>, all: Array<{ id: string; parent: string }>) => {
    const bad = new Set([id, ...descendants(all as any, id)]);
    return (
      <select style={{ ...fieldStyle, ...auto }} value={val} onChange={e => onCh(e.target.value)}>
        <option value="ROOT">— racine —</option>
        {items.filter(it => !bad.has(it.id)).map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
      </select>
    );
  };
  const preStyle: React.CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', overflowX: 'auto', fontSize: 12.5, lineHeight: 1.5, margin: 0, fontFamily: 'ui-monospace,monospace' };
  const outBtns = (id: string, code: string, file: string) => (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={() => download(code, file)} style={{ ...smallBtn, padding: '6px 12px' }} title="Télécharger le .ps1">💾 .ps1</button>
      <button onClick={() => copy(id, code)} style={{ padding: '6px 14px', border: '1px solid var(--accent)', borderRadius: 8, background: copiedId === id ? 'var(--accent)' : 'transparent', color: copiedId === id ? '#fff' : 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>{copiedId === id ? '✓ Copié' : 'Copier'}</button>
    </div>
  );

  return (
    <div style={{ margin: '14px 0' }}>
      {/* Domaine */}
      <div style={groupStyle}>
        <div style={legendStyle}>🌐 Domaine & bases</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
          <div><label style={labelStyle}>Domaine</label><input style={fieldStyle} value={domain} onChange={e => setDomain(e.target.value)} /></div>
          <div><label style={labelStyle}>Dossier racine des partages</label><input style={{ ...fieldStyle, fontFamily: 'ui-monospace,monospace' }} value={basePath} onChange={e => setBasePath(e.target.value)} /></div>
          <div><label style={labelStyle}>OU des groupes Domaine Local (DL)</label>
            <select style={fieldStyle} value={dlOu} onChange={e => setDlOu(e.target.value)}>{ous.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
          </div>
          <div><label style={labelStyle}>Nom du partage (dossier racine)</label><input style={fieldStyle} value={shareName} onChange={e => setShareName(e.target.value)} placeholder="Partages" /></div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginTop: 10 }}>
          <input type="checkbox" checked={shareRoot} onChange={e => setShareRoot(e.target.checked)} />
          <span>Partager le <strong>dossier racine</strong> — une seule autorisation de partage : <code>Utilisateurs authentifiés = Contrôle total</code> (le NTFS filtre réellement)</span>
        </label>
        <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>Convention : <code>G_&lt;groupe&gt;</code> (global) · <code>DL_&lt;dossier&gt;_&lt;droit NTFS&gt;</code> (domaine local) · NTFS posé sur le <strong>DL</strong>. 💾 Mémorisé dans ce navigateur.</div>
      </div>

      {/* Arborescence UO */}
      <div style={groupStyle}>
        <div style={legendStyle}>🌳 Arborescence des UO <span className="meta" style={{ fontWeight: 400, fontSize: 12 }}>— imbrique librement (choisis le parent)</span></div>
        {ous.map(o => (
          <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '2fr auto auto', gap: 8, marginBottom: 7, alignItems: 'center' }}>
            <input style={fieldStyle} value={o.name} onChange={e => patchOu(o.id, { name: e.target.value })} placeholder="Nom de l'OU" />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span className="meta" style={{ fontSize: 12 }}>sous</span>{parentSel(o.id, o.parent, v => patchOu(o.id, { parent: v }), ous, ous)}</div>
            <button style={smallBtn} onClick={() => delOu(o.id)} title="Supprimer (et ses sous-OU)">✕</button>
          </div>
        ))}
        <button style={btnStyle} onClick={addOu}>+ OU</button>
      </div>

      {/* Groupes Globaux */}
      <div style={groupStyle}>
        <div style={legendStyle}>👥 Groupes Globaux (métiers)</div>
        {ggroups.map(g => (
          <div key={g.id} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.4fr auto', gap: 8, marginBottom: 7, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><code style={{ color: 'var(--accent)', fontSize: 12 }}>G_</code><input style={fieldStyle} value={g.name} onChange={e => patchGg(g.id, { name: e.target.value })} placeholder="Comptables" /></div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span className="meta" style={{ fontSize: 12 }}>OU</span><select style={{ ...fieldStyle, ...auto }} value={g.ou} onChange={e => patchGg(g.id, { ou: e.target.value })}>{ous.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
            <button style={smallBtn} onClick={() => delGg(g.id)}>✕</button>
          </div>
        ))}
        <button style={btnStyle} onClick={addGg}>+ Groupe Global</button>
        <div style={{ marginTop: 10, borderTop: '1px dashed var(--border)', paddingTop: 10 }}>
          <label style={labelStyle}>Ajout en masse — un nom de groupe par ligne (préfixe <code>G_</code> ajouté auto)</label>
          <textarea value={bulkGg} onChange={e => setBulkGg(e.target.value)} placeholder={'Formateurs_Ref_Dev\nStagiaires_Dev'} style={{ ...fieldStyle, minHeight: 54, fontFamily: 'ui-monospace,monospace', resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="meta" style={{ fontSize: 12 }}>OU</span>
            <select style={{ ...fieldStyle, ...auto }} value={bulkGgOu} onChange={e => setBulkGgOu(e.target.value)}>{ous.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
            <button style={btnStyle} onClick={addGgBulk}>Ajouter ces groupes</button>
          </div>
        </div>
      </div>

      {/* Arborescence des dossiers + NTFS + partage */}
      <div style={groupStyle}>
        <div style={legendStyle}>📂 Arborescence des dossiers — partage & droits NTFS granulaires</div>
        {folders.map(f => (
          <div key={f.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 10, background: 'var(--surface)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.9fr auto auto auto', gap: 8, alignItems: 'center' }}>
              <input style={fieldStyle} value={f.name} onChange={e => patchFolder(f.id, { name: e.target.value })} placeholder="Nom du dossier" />
              <input style={fieldStyle} value={f.code} onChange={e => patchFolder(f.id, { code: clean(e.target.value) })} placeholder="Code (→ DL_)" title="Code court utilisé dans le nom des groupes DL (≤ 15 caractères)" />
              {f.abs
                ? <span className="meta" style={{ fontSize: 12 }}>chemin absolu</span>
                : <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span className="meta" style={{ fontSize: 12 }}>sous</span>{parentSel(f.id, f.parent, v => patchFolder(f.id, { parent: v }), folders, folders)}</div>}
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }} title="Désactiver l'héritage NTFS (le dossier n'hérite plus des droits du parent)">
                <input type="checkbox" checked={!!f.noInherit} onChange={e => patchFolder(f.id, { noInherit: e.target.checked })} /> ⛔ héritage
              </label>
              <button style={smallBtn} onClick={() => delFolder(f.id)} title="Supprimer (et sous-dossiers)">✕</button>
            </div>
            {f.abs
              ? <input style={{ ...fieldStyle, fontFamily: 'ui-monospace,monospace', marginTop: 4 }} value={f.abs} onChange={e => patchFolder(f.id, { abs: e.target.value })} title="Chemin absolu du dossier" />
              : <div className="meta" style={{ fontSize: 11, marginTop: 4, fontFamily: 'ui-monospace,monospace' }}>{pathOf(f.id)}</div>}
            <div style={{ marginTop: 8, paddingLeft: 8, borderLeft: '2px solid var(--border)' }}>
              {f.rules.map((rl, j) => (
                <div key={j} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                  <span className="meta" style={{ fontSize: 12 }}>NTFS :</span>
                  <select style={{ ...fieldStyle, ...auto }} value={rl.group} onChange={e => patchRule(f.id, j, { group: e.target.value })}>{ggroups.map(g => <option key={g.id} value={g.id}>{gName(g.id)}</option>)}</select>
                  <span className="meta" style={{ fontSize: 12 }}>→</span>
                  <select style={{ ...fieldStyle, ...auto }} value={rl.right} onChange={e => patchRule(f.id, j, { right: e.target.value as NtfsKey })}>{NTFS.map(n => <option key={n.key} value={n.key}>{n.label}</option>)}</select>
                  {rl.right === 'CUSTOM' && <input style={{ ...fieldStyle, width: 140, fontFamily: 'ui-monospace,monospace' }} value={rl.custom || ''} onChange={e => patchRule(f.id, j, { custom: e.target.value })} placeholder="ex. RX,WD,AD" title="Droits icacls séparés par des virgules (ex. RX,WD,AD,WEA)" />}
                  <code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dlName(f, rl)}</code>
                  <button style={{ ...smallBtn, marginLeft: 'auto' }} onClick={() => delRule(f.id, j)}>✕</button>
                </div>
              ))}
              <button style={smallBtn} onClick={() => addRule(f.id)}>+ Droit NTFS</button>
            </div>
          </div>
        ))}
        <button style={btnStyle} onClick={addFolder}>+ Dossier</button>
        <div style={{ marginTop: 10, borderTop: '1px dashed var(--border)', paddingTop: 10 }}>
          <label style={labelStyle}>Création en masse — un <strong>chemin absolu</strong> par ligne</label>
          <textarea value={bulkFold} onChange={e => setBulkFold(e.target.value)} placeholder={'C:\\Partage\\Developpement\\Formateurs_Ref_Dev\nC:\\Partage\\Developpement\\Stagiaires_Dev'} style={{ ...fieldStyle, minHeight: 54, fontFamily: 'ui-monospace,monospace', resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <button style={btnStyle} onClick={addFoldersBulk}>Ajouter ces dossiers</button>
            <span className="meta" style={{ fontSize: 11.5 }}>Chaque chemin devient un dossier (créé par le script ②) ; ajoute ensuite ses droits NTFS si besoin.</span>
          </div>
        </div>
      </div>

      {/* Utilisateurs */}
      <div style={groupStyle}>
        <div style={legendStyle}>🧑 Utilisateurs</div>
        {users.map(u => (
          <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.1fr 1.3fr 1.3fr 1.4fr auto', gap: 7, marginBottom: 7, alignItems: 'center' }}>
            <input style={fieldStyle} value={u.prenom} onChange={e => patchUser(u.id, { prenom: e.target.value })} placeholder="Prénom" />
            <input style={fieldStyle} value={u.nom} onChange={e => patchUser(u.id, { nom: e.target.value })} placeholder="Nom" />
            <select style={fieldStyle} value={u.ou} onChange={e => patchUser(u.id, { ou: e.target.value })} title="OU de placement">{ous.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
            <select style={fieldStyle} value={u.group} onChange={e => patchUser(u.id, { group: e.target.value })} title="Groupe Global">{ggroups.map(g => <option key={g.id} value={g.id}>{gName(g.id)}</option>)}</select>
            <code style={{ fontSize: 11.5, color: 'var(--accent)' }}>{login(u.prenom, u.nom)}</code>
            <button style={smallBtn} onClick={() => delUser(u.id)}>✕</button>
          </div>
        ))}
        <button style={btnStyle} onClick={addUser}>+ Utilisateur</button>
        <div style={{ marginTop: 10, borderTop: '1px dashed var(--border)', paddingTop: 10 }}>
          <label style={labelStyle}>Ajout en masse — « Prénom Nom » (une par ligne)</label>
          <textarea value={bulk} onChange={e => setBulk(e.target.value)} placeholder={'Paul Martin\nSophie Bernard'} style={{ ...fieldStyle, minHeight: 56, fontFamily: 'ui-monospace,monospace', resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="meta" style={{ fontSize: 12 }}>OU</span><select style={{ ...fieldStyle, ...auto }} value={bulkOu} onChange={e => setBulkOu(e.target.value)}>{ous.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
            <span className="meta" style={{ fontSize: 12 }}>Groupe</span><select style={{ ...fieldStyle, ...auto }} value={bulkGrp} onChange={e => setBulkGrp(e.target.value)}>{ggroups.map(g => <option key={g.id} value={g.id}>{gName(g.id)}</option>)}</select>
            <button style={btnStyle} onClick={importBulk}>Ajouter</button>
          </div>
        </div>
      </div>

      {/* Aperçus */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 12 }}>
        <div><div style={{ fontWeight: 700, fontSize: 14, margin: '0 0 6px' }}>🌳 Arborescence des UO</div><pre style={preStyle}><code>{ouTree}</code></pre></div>
        <div><div style={{ fontWeight: 700, fontSize: 14, margin: '0 0 6px' }}>🔐 Dossiers & droits NTFS</div><pre style={preStyle}><code>{ntfsTree}</code></pre></div>
      </div>

      {/* Scripts */}
      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 6px' }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>📜 ① Contrôleur de domaine — OU, groupes, imbrication, utilisateurs</div>
          {outBtns('dc', scriptDC, 'agdlp-ad.ps1')}
        </div>
        <pre style={preStyle}><code>{scriptDC}</code></pre>
      </div>
      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 6px' }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>📜 ② Serveur de fichiers — dossier racine partagé + NTFS granulaire</div>
          {outBtns('fs', scriptFS, 'agdlp-partages.ps1')}
        </div>
        <pre style={preStyle}><code>{scriptFS}</code></pre>
      </div>
      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 6px' }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>📜 ③ Vérification (lecture seule) — partage, NTFS, imbrication</div>
          {outBtns('vf', scriptVerify, 'agdlp-verification.ps1')}
        </div>
        <pre style={preStyle}><code>{scriptVerify}</code></pre>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';

/**
 * Constructeur AGDLP & serveur de fichiers.
 *
 * Un seul outil, parce que c'était un seul sujet : AGDLP existe précisément
 * pour poser des droits sur des partages. Les deux constructeurs faisaient
 * chacun une moitié du travail — l'un tenait la chaîne Account → Global →
 * Domain Local mais s'arrêtait au bord du partage, l'autre savait partager et
 * poser des ACL mais demandait de retaper les noms de groupes à la main, ce qui
 * est exactement la faute qu'AGDLP existe pour éviter.
 *
 * Il produit : l'arborescence des UO, celle des dossiers avec leurs droits, et
 * trois scripts PowerShell — le contrôleur de domaine, le serveur de fichiers,
 * et une vérification rejouable.
 *
 * Îlot React hydraté via RichContent (data-block="agdlp-builder", et
 * "file-server-builder" pour les pages écrites avant la fusion).
 */

type NtfsKey = 'F' | 'M' | 'MND' | 'RX' | 'R' | 'W' | 'CUSTOM';
const NTFS: Array<{ key: NtfsKey; label: string; icacls: string; suffix: string }> = [
  { key: 'F', label: 'Contrôle total', icacls: 'F', suffix: 'ControleTotal' },
  { key: 'M', label: 'Modification', icacls: 'M', suffix: 'Modification' },
  { key: 'MND', label: 'Modifier (sans suppression)', icacls: '(RD,WD,AD,REA,WEA,RA,WA,X,RC)', suffix: 'ModifSansSuppr' },
  { key: 'RX', label: 'Lecture et exécution', icacls: 'RX', suffix: 'LectureExecution' },
  { key: 'R', label: 'Lecture', icacls: 'R', suffix: 'Lecture' },
  { key: 'W', label: 'Écriture', icacls: 'W', suffix: 'Ecriture' },
  { key: 'CUSTOM', label: 'Personnalisé (icacls)…', icacls: '', suffix: 'Perso' },
];
const ntfs = (k: NtfsKey) => NTFS.find(x => x.key === k) || NTFS[1];

/**
 * Le socle d'un dossier dont on a coupé l'héritage.
 *
 * Couper l'héritage sans rien reposer laisse un dossier qui n'appartient plus à
 * personne — pas même à qui voudrait y remettre des droits. Ces comptes-là
 * restent donc toujours, en plus des groupes de domaine local.
 *
 * Ils sont désignés par leur **SID** et non par leur nom : « Administrateurs »
 * s'appelle « Administrators » sur un Windows anglais, et un script qui les
 * nomme échoue sur la moitié des postes d'une salle.
 */
const SOCLE_NTFS: { sid: string; nom: string; droit: string; pourquoi: string }[] = [
  { sid: 'S-1-5-32-544', nom: 'Administrateurs', droit: 'F', pourquoi: 'sans eux, plus personne ne peut reprendre la main sur le dossier' },
  { sid: 'S-1-5-18', nom: 'SYSTEM', droit: 'F', pourquoi: 'sauvegarde, indexation et antivirus passent par ce compte' },
  { sid: 'S-1-5-11', nom: 'Utilisateurs authentifiés', droit: 'RX', pourquoi: 'traverser le dossier pour atteindre les sous-dossiers auxquels on a droit' },
];
// Codes de droit courts pour tenir le nom de groupe DL sous la limite AD (sAMAccountName ≤ 20).
const RIGHT_CODE: Record<NtfsKey, string> = { F: 'CT', M: 'M', MND: 'MND', RX: 'RX', R: 'L', W: 'E', CUSTOM: 'P' };

type Ou = { id: string; name: string; parent: string };
type GGroup = { id: string; name: string; ou: string };
type User = { id: string; prenom: string; nom: string; ou: string; group: string };
type Rule = { group: string; right: NtfsKey; custom?: string };
type Folder = {
  id: string; name: string; code: string; parent: string; abs?: string; noInherit?: boolean; rules: Rule[];
  /** Partager ce dossier, et sous quel nom (vide = le nom du dossier). */
  share?: boolean; shareName?: string;
  /**
   * Énumération basée sur l'accès.
   *
   * Un dossier qu'on n'a pas le droit d'ouvrir cesse d'apparaître dans la
   * liste. Ce n'est pas une sécurité — les droits NTFS le sont déjà — mais
   * c'est ce qui évite la question « pourquoi je vois un dossier interdit ? ».
   */
  abe?: boolean;
};

/**
 * Droits NTFS avancés, en codes icacls.
 *
 * Les deux suppressions sont distinctes et c'est le piège classique : `DE`
 * supprime l'objet lui-même, `DC` supprime le contenu d'un dossier. « Modifier
 * sans suppression » consiste exactement à retirer ces deux-là.
 */
const SPECIAUX: { code: string; label: string; suppr?: boolean }[] = [
  { code: 'X', label: 'Parcours du dossier / exécuter le fichier' },
  { code: 'RD', label: 'Liste du dossier / lecture de données' },
  { code: 'RA', label: 'Attributs de lecture' },
  { code: 'REA', label: 'Attributs étendus de lecture' },
  { code: 'WD', label: 'Création de fichiers / écriture de données' },
  { code: 'AD', label: 'Création de dossiers / ajout de données' },
  { code: 'WA', label: 'Attributs d’écriture' },
  { code: 'WEA', label: 'Attributs étendus d’écriture' },
  { code: 'DC', label: 'Suppression de sous-dossier et fichier', suppr: true },
  { code: 'DE', label: 'Suppression', suppr: true },
  { code: 'RC', label: 'Autorisations de lecture' },
  { code: 'WDAC', label: 'Modification des autorisations' },
  { code: 'WO', label: 'Appropriation' },
];

const clean = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '');
const login = (p: string, n: string) => `${clean(p)}.${clean(n)}`.toLowerCase();
const domainToDN = (d: string) => d.split('.').filter(Boolean).map(x => `DC=${x}`).join(',');
const uid = (p: string) => p + Math.random().toString(36).slice(2, 8);

/**
 * La boîte à outils PowerShell posée en tête de chaque script.
 *
 * `Assert` vérifie après coup, `Gate` vérifie avant d'agir. La distinction
 * compte : un script lancé sur le mauvais domaine, sur une machine sans le
 * module AD ou avec un lecteur absent produisait vingt lignes rouges avant
 * qu'on voie laquelle comptait — et il avait déjà à moitié agi.
 *
 * Un `Gate` qui échoue arrête tout et dit quoi faire. Un `Verrou` fait la même
 * chose au milieu du script, quand la suite n'aurait plus de sens : créer des
 * groupes dans une UO qui n'existe pas produit une erreur par groupe, toutes
 * identiques, aucune ne nommant la vraie cause.
 */
const PS_ASSERT = [
  'function Assert($label,[scriptblock]$c){ $r=$false; try{ $r=[bool](& $c) }catch{}; if($r){ $global:T.ok++; Write-Host ("  [OK]  " + $label) -ForegroundColor Green } else { $global:T.ko++; Write-Host ("  [KO]  " + $label) -ForegroundColor Red } }',
  'function Show-Summary($t){ $c = if($global:T.ko -eq 0){"Green"}else{"Red"}; Write-Host ""; Write-Host ("== " + $t + " : " + $global:T.ok + " OK / " + $global:T.ko + " KO ==") -ForegroundColor $c }',
  '',
  '# --- Verifications AVANT d agir. Un echec arrete tout, sans rien modifier. ---',
  'function Gate($label,[scriptblock]$c,$remede){ $r=$false; try{ $r=[bool](& $c) }catch{}; if($r){ Write-Host ("  [PRET] " + $label) -ForegroundColor DarkGray; return }; Write-Host ""; Write-Host ("  [STOP] " + $label) -ForegroundColor Red; Write-Host ("         " + $remede) -ForegroundColor Yellow; Write-Host "  Rien n a ete modifie." -ForegroundColor Yellow; exit 2 }',
  'function Verrou($label,[scriptblock]$c,$remede){ $r=$false; try{ $r=[bool](& $c) }catch{}; if($r){ return }; Write-Host ""; Write-Host ("  [STOP] " + $label) -ForegroundColor Red; Write-Host ("         " + $remede) -ForegroundColor Yellow; Write-Host "  Le script s arrete ici : la suite n aurait plus de sens." -ForegroundColor Yellow; exit 3 }',
  '# Code de sortie : 0 si tout passe. Un appelant peut donc enchainer les scripts.',
  'function Fin($t){ Show-Summary $t; if($global:T.ko -gt 0){ exit 1 }; exit 0 }',
];

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
  /**
   * Qui pose les droits NTFS.
   *
   * « A la main » etait le seul mode : le TP demande de passer par l'onglet
   * Securite, et le script se contentait de rappeler ce qu'on attendait. C'est
   * pedagogiquement juste la premiere fois, et penible les suivantes -- d'ou
   * `icacls`, qui applique ce que l'arborescence decrit.
   */
  const [modeDroits, setModeDroits] = useState<'manuel' | 'icacls'>(() => load('agdlp2_mode', 'manuel'));
  const [copiedId, setCopiedId] = useState('');
  const [razArme, setRazArme] = useState(false);
  // La question posee s'oublie d'elle-meme : un bouton rouge laisse arme est un
  // piege pour le clic suivant.
  useEffect(() => {
    if (!razArme) return;
    const t = setTimeout(() => setRazArme(false), 6000);
    return () => clearTimeout(t);
  }, [razArme]);
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
    localStorage.setItem('agdlp2_mode', JSON.stringify(modeDroits));
  } catch { /* */ } }, [domain, basePath, shareRoot, shareName, ous, dlOu, ggroups, users, folders, modeDroits]);

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

  /**
   * Tout remettre a l'etat d'un projet neuf.
   *
   * On efface aussi les cles du navigateur : les laisser ferait revenir
   * l'ancien contenu au prochain chargement, et on chercherait pourquoi.
   */
  const toutRemettreAZero = () => {
    setDomain('miyukini.lan'); setBasePath('E:\\Partages');
    setShareRoot(true); setShareName('Partages');
    setOus(D_OUS); setDlOu('gdl'); setGgroups(D_GG); setUsers(D_USERS); setFolders(D_FOLDERS);
    setModeDroits('manuel');
    setBulk(''); setBulkOu(''); setBulkGrp(''); setBulkGg(''); setBulkGgOu(''); setBulkFold('');
    setRazArme(false);
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('agdlp2_')) localStorage.removeItem(k);
    } catch { /* navigation privee : l'etat en memoire suffit */ }
  };

  const domainDN = domainToDN(domain);
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
  // (OI) hérite sur les fichiers, (CI) sur les dossiers : sans les deux, le droit
  // s'arrête au dossier lui-même et le contenu reste inaccessible.
  const icaclsDe = (rl: Rule) => {
    const codes = rl.right === 'CUSTOM'
      ? (rl.custom || '').split(',').map(x => x.trim()).filter(Boolean).join(',')
      : ntfs(rl.right).icacls;
    if (!codes) return null;
    return codes.startsWith('(') ? `(OI)(CI)${codes}` : `(OI)(CI)${codes}`;
  };
  const nomPartage = (f: Folder) => (f.shareName || clean(f.name) || 'Partage').slice(0, 80);

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
      const part = f.share ? `   📤 Partage « ${nomPartage(f)} »${f.abe ? ' · ABE' : ''}` : '';
      L.push(`${prefix}${last ? '└─' : '├─'} 📂 ${f.name}${f.noInherit ? '   ⛔ héritage désactivé' : ''}${part}`);
      const sub = prefix + (last ? '    ' : '│   ');
      f.rules.forEach(rl => L.push(`${sub}   🔒 ${dlName(f, rl)} → ${rightLabel(rl)}  (⟵ ${gName(rl.group)})`));
      if (f.noInherit) SOCLE_NTFS.forEach(q => L.push(`${sub}   🛡️ ${q.nom} → ${q.droit === 'F' ? 'Contrôle total' : 'Lecture et exécution'}  (socle conservé)`));
      const kids = folders.filter(c => c.parent === f.id);
      kids.forEach((c, i) => walk(c, sub, i === kids.length - 1));
    };
    L.push(`📁 ${basePath}${shareRoot ? `   📤 Partage « ${shareName} » : Utilisateurs authentifiés = Contrôle total` : ''}`);
    const roots = folders.filter(f => f.parent === 'ROOT');
    roots.forEach((f, i) => walk(f, '', i === roots.length - 1));
    return L.join('\n');
  }, [folders, basePath, shareRoot, shareName]);

  // ---- Script 1 : contrôleur de domaine (séquencé + tests) ----
  const scriptDC = useMemo(() => {
    const o: string[] = [];
    const ouParent = (ou: Ou) => ou.parent === 'ROOT' ? domainDN : dnOfOu(ou.parent);
    const sortedOus = [...ous].sort((a, b) => depthOu(a) - depthOu(b));
    o.push('#Requires -RunAsAdministrator');
    o.push('# ============================================================');
    o.push(`#  AGDLP (1/2) - CONTROLEUR DE DOMAINE (${domain})`);
    o.push('#  Cree OU -> Globaux -> Domaine Local -> imbrication -> utilisateurs, puis TESTS.');
    o.push('# ============================================================');
    o.push('$global:T = @{ ok = 0; ko = 0 }');
    o.push(...PS_ASSERT);
    o.push('');
    o.push('Write-Host "===== PREALABLES =====" -ForegroundColor Yellow');
    o.push("Gate \"Module ActiveDirectory disponible\" { Get-Module -ListAvailable ActiveDirectory } \"Installe-le : Add-WindowsFeature RSAT-AD-PowerShell (serveur) ou Add-WindowsCapability -Online -Name Rsat.ActiveDirectory.DS-LDS.Tools~~~~0.0.1.0 (poste).\"");
    o.push('Import-Module ActiveDirectory -ErrorAction Stop');
    o.push("Gate \"Annuaire joignable\" { Get-ADDomain -ErrorAction Stop } \"Aucun controleur de domaine ne repond. Verifie le reseau, le DNS, et que cette machine est bien membre du domaine.\"");
    // Le verrou qui evite le plus gros degat : creer l'arborescence d'un TP
    // dans l'annuaire d'un autre domaine, et devoir l'y retrouver pour l'effacer.
    o.push(`Gate "Le domaine est bien ${domain}" { (Get-ADDomain).DNSRoot -eq '${domain}' } "Cette machine appartient a un autre domaine : $((Get-ADDomain).DNSRoot). Corrige le domaine dans l outil, ou lance ce script sur le bon controleur."`);
    o.push(`Gate "L emplacement racine existe" { Get-ADObject -Identity '${domainDN}' -ErrorAction Stop } "Le DN ${domainDN} est introuvable. Le nom de domaine saisi ne correspond pas a cet annuaire."`);
    // Un sAMAccountName depasse 20 caracteres : l'annuaire le refuse, mais une
    // fois seulement -- au milieu de la creation, apres les precedents.
    const tropLongs = [...ggroups.map(g => gName(g.id)), ...dlGroups.map(g => dlName(g.f, g.rule))].filter(n => n.length > 20);
    for (const n of tropLongs) {
      o.push(`Gate "Nom de groupe trop long : ${n}" { $false } "Un sAMAccountName tient en 20 caracteres. Raccourcis le code du dossier ou le nom du groupe dans l outil."`);
    }
    o.push('');
    o.push('function Ensure-OU($n,$p){ if(-not(Get-ADOrganizationalUnit -Filter "Name -eq \'$n\'" -SearchBase $p -ErrorAction SilentlyContinue)){ New-ADOrganizationalUnit -Name $n -Path $p -ProtectedFromAccidentalDeletion:$false } }');
    o.push('function Ensure-Grp($n,$s,$p){ if(-not(Get-ADGroup -Filter "Name -eq \'$n\'" -ErrorAction SilentlyContinue)){ New-ADGroup -Name $n -SamAccountName $n -GroupScope $s -GroupCategory Security -Path $p } }');
    o.push('');
    o.push('Write-Host "[1/5] Unites d organisation..." -ForegroundColor Cyan');
    sortedOus.forEach(ou => o.push(`Ensure-OU '${ou.name}' '${ouParent(ou)}'`));
    // Sans ce verrou, chaque groupe echoue separement avec la meme erreur, et
    // aucune ne nomme la cause : l'UO d'accueil n'a pas ete creee.
    sortedOus.forEach(ou => o.push(`Verrou "UO ${ou.name} creee" { Get-ADOrganizationalUnit -Filter "Name -eq '${ou.name}'" -SearchBase '${ouParent(ou)}' } "La creation de l UO a echoue. Verifie les droits du compte et que le parent existe."`));
    o.push('Write-Host "[2/5] Groupes GLOBAUX..." -ForegroundColor Cyan');
    ggroups.forEach(g => o.push(`Ensure-Grp '${gName(g.id)}' Global '${dnOfOu(g.ou)}'`));
    o.push('Write-Host "[3/5] Groupes DOMAINE LOCAL..." -ForegroundColor Cyan');
    dlGroups.forEach(g => o.push(`Ensure-Grp '${dlName(g.f, g.rule)}' DomainLocal '${dnOfOu(dlOu)}'`));
    o.push('Start-Sleep -Seconds 2   # laisser l annuaire enregistrer les groupes avant de les utiliser');
    // L'imbrication est le coeur d'AGDLP : si l'un des deux groupes manque,
    // `Add-ADGroupMember -ErrorAction SilentlyContinue` n'en dirait rien, et la
    // chaine serait rompue sans que personne le voie.
    ggroups.forEach(g => o.push(`Verrou "Groupe global ${gName(g.id)} cree" { Get-ADGroup -Identity '${gName(g.id)}' } "Sa creation a echoue : l imbrication qui suit serait silencieusement incomplete."`));
    dlGroups.forEach(g => o.push(`Verrou "Groupe DL ${dlName(g.f, g.rule)} cree" { Get-ADGroup -Identity '${dlName(g.f, g.rule)}' } "Sa creation a echoue : le droit correspondant ne sera porte par personne."`));
    o.push('Write-Host "[4/5] Imbrication Global -> Domaine Local..." -ForegroundColor Cyan');
    for (const f of folders) for (const rl of f.rules) o.push(`Add-ADGroupMember '${dlName(f, rl)}' -Members '${gName(rl.group)}' -ErrorAction SilentlyContinue`);
    o.push('Write-Host "[5/5] Utilisateurs..." -ForegroundColor Cyan');
    o.push('$pwd = Read-Host "Mot de passe initial des comptes" -AsSecureString');
    // Un mot de passe vide passe la saisie et fait echouer chaque New-ADUser
    // avec un message sur la « strategie de mot de passe » qui n'aide personne.
    o.push('Verrou "Mot de passe saisi" { $pwd -and $pwd.Length -gt 0 } "Aucun mot de passe n a ete saisi. Relance le script et entre celui de la strategie du domaine."');
    for (const u of users) {
      const l = login(u.prenom, u.nom);
      o.push(`if(-not(Get-ADUser -Filter "SamAccountName -eq '${l}'" -ErrorAction SilentlyContinue)){ New-ADUser -Name '${u.prenom} ${u.nom}' -GivenName '${u.prenom}' -Surname '${u.nom}' -SamAccountName '${l}' -UserPrincipalName '${l}@${domain}' -Path '${dnOfOu(u.ou)}' -AccountPassword $pwd -Enabled $true -ChangePasswordAtLogon $true }`);
      if (u.group) o.push(`Add-ADGroupMember '${gName(u.group)}' -Members '${l}' -ErrorAction SilentlyContinue`);
    }
    o.push('Start-Sleep -Seconds 1');
    o.push('');
    o.push('Write-Host "===== TESTS AD =====" -ForegroundColor Yellow');
    sortedOus.forEach(ou => o.push(`Assert "OU ${ou.name}" { Get-ADOrganizationalUnit -Filter "Name -eq '${ou.name}'" -SearchBase '${ouParent(ou)}' }`));
    ggroups.forEach(g => o.push(`Assert "Groupe global ${gName(g.id)}" { Get-ADGroup -Identity '${gName(g.id)}' }`));
    dlGroups.forEach(g => o.push(`Assert "Groupe DL ${dlName(g.f, g.rule)}" { Get-ADGroup -Identity '${dlName(g.f, g.rule)}' }`));
    for (const f of folders) for (const rl of f.rules) o.push(`Assert "${gName(rl.group)} membre de ${dlName(f, rl)}" { Get-ADGroupMember '${dlName(f, rl)}' | Where-Object { $_.SamAccountName -eq '${gName(rl.group)}' } }`);
    for (const u of users) {
      const l = login(u.prenom, u.nom);
      o.push(`Assert "Utilisateur ${l}" { Get-ADUser -Identity '${l}' }`);
      if (u.group) o.push(`Assert "${l} membre de ${gName(u.group)}" { Get-ADGroupMember '${gName(u.group)}' | Where-Object { $_.SamAccountName -eq '${l}' } }`);
    }
    o.push('Fin "AD (script 1)"');
    return o.join('\n');
  }, [domain, domainDN, ous, ggroups, dlOu, folders, dlGroups, users]);

  // ---- Script 2 : serveur de fichiers (dossiers + partage, droits par défaut ; NTFS manuel) ----
  const scriptFS = useMemo(() => {
    const o: string[] = [];
    // « E:\Partages » → « E:\ ». Un chemin UNC n'a pas de lettre : on verifie
    // alors le partage lui-meme plutot qu'un lecteur qui n'existe pas.
    const racineLecteur = /^[A-Za-z]:/.test(basePath) ? basePath.slice(0, 2) + '\\' : basePath;
    const sortedF = [...folders].sort((a, b) => depthF(a) - depthF(b));
    o.push('#Requires -RunAsAdministrator');
    o.push('# ============================================================');
    o.push('#  AGDLP (2/2) - SERVEUR DE FICHIERS');
    o.push('#  Cree le dossier racine + le partage, puis les sous-dossiers avec les');
    o.push('#  DROITS PAR DEFAUT (herites du parent). Les droits NTFS se font a la MAIN.');
    o.push('# ============================================================');
    o.push('$global:T = @{ ok = 0; ko = 0 }');
    o.push(...PS_ASSERT);
    // Le nom du groupe « Utilisateurs authentifies » depend de la langue de
    // Windows : on le retrouve par son SID, qui, lui, ne change pas.
    if (shareRoot || (modeDroits === 'icacls' && folders.some(f => f.share))) {
      o.push("$AuthUsers = (New-Object System.Security.Principal.SecurityIdentifier('S-1-5-11')).Translate([System.Security.Principal.NTAccount]).Value");
    }
    o.push('');
    o.push('Write-Host "===== PREALABLES =====" -ForegroundColor Yellow');
    // La panne la plus frequente d'une salle de TP, et la plus opaque : le
    // script vise E:\ sur une machine qui n'a qu'un C:. `New-Item -Force` cree
    // alors joyeusement l'arborescence... nulle part d'utile.
    o.push(`Gate "Le lecteur ${racineLecteur} existe" { Test-Path '${racineLecteur}' } "Ce script ecrit dans ${basePath}. Cree ce volume, ou change le dossier racine dans l outil."`);
    if (shareRoot || folders.some(f => f.share)) {
      o.push("Gate \"Les partages SMB sont gerables ici\" { Get-Command New-SmbShare -ErrorAction SilentlyContinue } \"Le module SmbShare manque : installe le role Serveur de fichiers (Add-WindowsFeature FS-FileServer).\"");
    }
    if (modeDroits === 'icacls') {
      o.push("Gate \"La machine est membre d un domaine\" { (Get-CimInstance Win32_ComputerSystem).PartOfDomain } \"Les groupes de domaine local ne peuvent pas etre resolus sur une machine hors domaine : icacls echouerait sur chaque dossier.\"");
      // Un groupe DL absent fait echouer `icacls /grant` avec « Aucun mappage
      // entre les noms de comptes » -- un message qui ne dit pas lequel manque.
      for (const g of dlGroups) {
        const n = dlName(g.f, g.rule);
        o.push(`Gate "Groupe ${n} resolvable" { try { ([System.Security.Principal.NTAccount]"${n}").Translate([System.Security.Principal.SecurityIdentifier]) } catch { $false } } "Ce groupe n existe pas encore. Lance d abord le script 1 sur le controleur de domaine, puis attends la replication."`);
      }
    }
    o.push('');
    o.push('Write-Host "[1/3] Dossier racine + partage..." -ForegroundColor Cyan');
    o.push(`New-Item -ItemType Directory -Path '${basePath}' -Force | Out-Null`);
    if (shareRoot) o.push(`if(-not(Get-SmbShare -Name '${shareName}' -ErrorAction SilentlyContinue)){ New-SmbShare -Name '${shareName}' -Path '${basePath}' -FullAccess $AuthUsers | Out-Null }`);
    o.push('Write-Host "[2/3] Sous-dossiers..." -ForegroundColor Cyan');
    sortedF.forEach(f => o.push(`New-Item -ItemType Directory -Path '${pathOf(f.id)}' -Force | Out-Null`));
    o.push('');

    if (modeDroits === 'icacls') {
      sortedF.forEach(f => o.push(`Verrou "Dossier cree : ${f.name}" { Test-Path '${pathOf(f.id)}' } "Sa creation a echoue (droits, ou chemin invalide) : poser des droits dessus n a pas de sens."`));
      o.push('Write-Host "[3/3] Droits NTFS et partages..." -ForegroundColor Cyan');
      for (const f of sortedF) {
        const chemin = pathOf(f.id);
        if (!f.rules.length && !f.share && !f.noInherit) continue;
        o.push(`# --- ${f.name} ---`);
        if (f.noInherit) {
          // `/inheritance:d` copie les ACE heritees avant de couper le lien ;
          // `/inheritance:r` les supprimerait, et le dossier deviendrait
          // inaccessible a tout le monde, y compris a qui doit le reparer.
          o.push(`icacls '${chemin}' /inheritance:d | Out-Null`);
          o.push('# Le socle reste, quels que soient les groupes DL poses ensuite :');
          for (const q of SOCLE_NTFS) {
            o.push(`icacls '${chemin}' /grant '*${q.sid}:(OI)(CI)${q.droit}' | Out-Null   # ${q.nom} - ${q.pourquoi}`);
          }
        }
        for (const rl of f.rules) {
          const droit = icaclsDe(rl);
          if (!droit) continue;
          o.push(`icacls '${chemin}' /grant '${dlName(f, rl)}:${droit}' | Out-Null`);
        }
        if (f.share) {
          const nom = nomPartage(f);
          // Controle total au niveau du partage, et c'est voulu : c'est NTFS qui
          // tranche. Deux jeux de droits qui se croisent donnent un resultat que
          // personne ne sait predire, et l'ecran de securite ne le montre pas.
          o.push(`if(-not(Get-SmbShare -Name '${nom}' -ErrorAction SilentlyContinue)){ New-SmbShare -Name '${nom}' -Path '${chemin}' -FullAccess $AuthUsers${f.abe ? ' -FolderEnumerationMode AccessBased' : ''} | Out-Null }`);
          if (f.abe) o.push(`Set-SmbShare -Name '${nom}' -FolderEnumerationMode AccessBased -Force | Out-Null`);
        }
      }
      o.push('');
    } else {
      o.push('# --- Droits NTFS : A APPLIQUER MANUELLEMENT sur les groupes DL (onglet Securite) ---');
      o.push('# Rappel des grants attendus (voir l apercu "Arborescence des droits NTFS") :');
      sortedF.forEach(f => { for (const rl of f.rules) o.push(`#   ${dlName(f, rl)}  ->  ${ntfs(rl.right).label}  sur  ${pathOf(f.id)}`); });
      o.push('');
    }
    o.push('Write-Host "===== TESTS Dossiers & partage =====" -ForegroundColor Yellow');
    if (shareRoot) {
      o.push(`Assert "Partage ${shareName} existe" { Get-SmbShare -Name '${shareName}' }`);
      o.push(`Assert "Partage ${shareName} : Utilisateurs authentifies = Controle total" { Get-SmbShareAccess -Name '${shareName}' | Where-Object { $_.AccessRight -eq 'Full' } }`);
    }
    sortedF.forEach(f => o.push(`Assert "Dossier existe : ${f.name}" { Test-Path '${pathOf(f.id)}' }`));
    if (modeDroits === 'icacls') {
      for (const f of sortedF) {
        if (f.share) o.push(`Assert "Partage ${nomPartage(f)} existe" { Get-SmbShare -Name '${nomPartage(f)}' }`);
        for (const rl of f.rules) {
          o.push(`Assert "${dlName(f, rl)} a un droit sur ${f.name}" { (icacls '${pathOf(f.id)}') -match '${dlName(f, rl)}' }`);
        }
        if (f.noInherit) {
          for (const q of SOCLE_NTFS) {
            o.push(`Assert "${f.name} : ${q.nom} conserve" { (Get-Acl '${pathOf(f.id)}').Access | Where-Object { $_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -eq '${q.sid}' } }`);
          }
        }
      }
    }
    o.push('Fin "Dossiers & partage (script 2)"');
    return o.join('\n');
  }, [folders, basePath, shareRoot, shareName, modeDroits, domain, dlGroups]);

  // ---- Script 3 : vérification autonome (rejouable, tests [OK]/[KO]) ----
  const scriptVerify = useMemo(() => {
    const o: string[] = [];
    const sortedF = [...folders].sort((a, b) => depthF(a) - depthF(b));
    o.push('# ============================================================');
    o.push('#  VERIFICATION AGDLP (lecture seule, rejouable) - TESTS [OK]/[KO]');
    o.push('#  Lance sur le serveur de fichiers (les tests AD sont ignores si le module manque).');
    o.push('# ============================================================');
    o.push('$global:T = @{ ok = 0; ko = 0 }');
    o.push(...PS_ASSERT);
    o.push('Write-Host "== Dossiers & partage ==" -ForegroundColor Yellow');
    if (shareRoot) {
      o.push(`Assert "Partage ${shareName} existe" { Get-SmbShare -Name '${shareName}' }`);
      o.push(`Assert "Partage ${shareName} : Utilisateurs authentifies = Controle total" { Get-SmbShareAccess -Name '${shareName}' | Where-Object { $_.AccessRight -eq 'Full' } }`);
    }
    sortedF.forEach(f => o.push(`Assert "Dossier existe : ${f.name}" { Test-Path '${pathOf(f.id)}' }`));
    // Le script ne verifiait que l'existence des dossiers. Or ce qui casse en
    // TP, ce n'est presque jamais le dossier -- c'est le droit qui manque
    // dessus, ou l'heritage coupe qui a emporte le socle avec lui.
    o.push('Write-Host "== Droits NTFS et partages ==" -ForegroundColor Yellow');
    for (const f of sortedF) {
      const chemin = pathOf(f.id);
      if (f.share) {
        o.push(`Assert "Partage ${nomPartage(f)} existe" { Get-SmbShare -Name '${nomPartage(f)}' }`);
        if (f.abe) o.push(`Assert "Partage ${nomPartage(f)} : ABE actif" { (Get-SmbShare -Name '${nomPartage(f)}').FolderEnumerationMode -eq 'AccessBased' }`);
      }
      if (f.noInherit) {
        o.push(`Assert "${f.name} : heritage coupe" { (Get-Acl '${chemin}').AreAccessRulesProtected }`);
        for (const q of SOCLE_NTFS) {
          o.push(`Assert "${f.name} : ${q.nom} conserve" { (Get-Acl '${chemin}').Access | Where-Object { $_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -eq '${q.sid}' } }`);
        }
      }
      for (const rl of f.rules) {
        o.push(`Assert "${f.name} : ${dlName(f, rl)} present" { (icacls '${chemin}') -match '${dlName(f, rl)}' }`);
      }
    }
    o.push('Write-Host "== Active Directory (si module dispo) ==" -ForegroundColor Yellow');
    o.push('if(Get-Module -ListAvailable ActiveDirectory){ Import-Module ActiveDirectory');
    ggroups.forEach(g => o.push(`  Assert "Groupe global ${gName(g.id)}" { Get-ADGroup -Identity '${gName(g.id)}' }`));
    for (const f of folders) for (const rl of f.rules) o.push(`  Assert "${gName(rl.group)} membre de ${dlName(f, rl)}" { Get-ADGroupMember '${dlName(f, rl)}' | Where-Object { $_.SamAccountName -eq '${gName(rl.group)}' } }`);
    o.push('} else { Write-Host "  (module ActiveDirectory absent : tests AD ignores)" -ForegroundColor DarkGray }');
    o.push('Fin "Verification"');
    return o.join('\n');
  }, [folders, basePath, shareRoot, shareName, ggroups, dlGroups]);

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
    <div className="outil-large">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>🔐 AGDLP &amp; serveur de fichiers</div>
        <span className="meta" style={{ fontSize: 11.5 }}>
          {folders.length} dossier(s) · {ggroups.length} groupe(s) global · {users.length} utilisateur(s) — gardés dans ce navigateur
        </span>
        {/* En deux temps : un clic maladroit effacerait une arborescence qui a
            coute une heure, et rien ici n'est recuperable ailleurs. */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          {razArme && <span style={{ fontSize: 11.5, color: '#dc2626' }}>Tout effacer et repartir de l’exemple ?</span>}
          {/* Pas de `onBlur` pour desarmer : il se declenche avant le `click`, et le
              bouton se serait desarme juste avant d'agir -- il n'aurait jamais
              rien remis a zero. Un delai s'en charge, sans toucher au clic. */}
          <button type="button" onClick={() => (razArme ? toutRemettreAZero() : setRazArme(true))}
            title="Revenir au contenu d’exemple et vider ce qui est gardé dans le navigateur"
            style={{ ...smallBtn, borderColor: razArme ? '#dc2626' : 'var(--border)', color: razArme ? '#dc2626' : 'var(--text-soft)', fontWeight: razArme ? 700 : 600 }}>
            {razArme ? 'Oui, remettre à zéro' : '↺ Remettre à zéro'}
          </button>
          {razArme && <button type="button" style={smallBtn} onClick={() => setRazArme(false)}>Annuler</button>}
        </div>
      </div>

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
            {/* Une rangee par question : ce que c'est, ou c'est, comment ca se
                comporte. La grille a colonnes fixes renvoyait la croix a la ligne
                des qu'un libelle s'allongeait. */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15 }}>📂</span>
              <input style={{ ...fieldStyle, ...auto, flex: '1 1 220px', fontWeight: 600 }} value={f.name}
                onChange={e => patchFolder(f.id, { name: e.target.value })} placeholder="Nom du dossier" />
              <label style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 12, whiteSpace: 'nowrap' }}
                title="Code court utilisé dans le nom des groupes DL (≤ 15 caractères)">
                <span className="meta">code DL</span>
                <input style={{ ...fieldStyle, ...auto, width: 130 }} value={f.code}
                  onChange={e => patchFolder(f.id, { code: clean(e.target.value) })} placeholder={clean(f.name).slice(0, 15)} />
              </label>
              {!f.abs && (
                <label style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 12, whiteSpace: 'nowrap' }}>
                  <span className="meta">sous</span>
                  {parentSel(f.id, f.parent, v => patchFolder(f.id, { parent: v }), folders, folders)}
                </label>
              )}
              <button style={{ ...smallBtn, marginLeft: 'auto' }} onClick={() => delFolder(f.id)} title="Supprimer (et sous-dossiers)">✕</button>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
              {f.abs
                ? <input style={{ ...fieldStyle, ...auto, flex: '1 1 320px', fontFamily: 'ui-monospace,monospace' }} value={f.abs}
                    onChange={e => patchFolder(f.id, { abs: e.target.value })} title="Chemin absolu du dossier" />
                : <code style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{pathOf(f.id)}</code>}
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: 'auto' }}
                title="Désactiver l'héritage NTFS (le dossier n'hérite plus des droits du parent)">
                <input type="checkbox" checked={!!f.noInherit} onChange={e => patchFolder(f.id, { noInherit: e.target.checked })} /> ⛔ héritage rompu
              </label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
                title="Publier ce dossier comme partage réseau (New-SmbShare)">
                <input type="checkbox" checked={!!f.share} onChange={e => patchFolder(f.id, { share: e.target.checked })} /> 📤 partagé
              </label>
            </div>
            {f.share && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                <span className="meta" style={{ fontSize: 12 }}>Nom du partage</span>
                <input style={{ ...fieldStyle, ...auto, width: 170 }} value={f.shareName ?? ''} placeholder={clean(f.name)}
                  onChange={e => patchFolder(f.id, { shareName: e.target.value })} />
                <code style={{ fontSize: 11, color: 'var(--text-muted)' }}>\\\\{'{serveur}'}\\{nomPartage(f)}</code>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, cursor: 'pointer' }}
                  title="Énumération basée sur l'accès : un dossier qu'on n'a pas le droit d'ouvrir cesse d'apparaître dans la liste.">
                  <input type="checkbox" checked={!!f.abe} onChange={e => patchFolder(f.id, { abe: e.target.checked })} /> ABE
                </label>
              </div>
            )}
            <div style={{ marginTop: 8, paddingLeft: 8, borderLeft: '2px solid var(--border)' }}>
              {f.rules.map((rl, j) => (
                <div key={j} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                  <select style={{ ...fieldStyle, ...auto, minWidth: 190 }} value={rl.group} onChange={e => patchRule(f.id, j, { group: e.target.value })}>{ggroups.map(g => <option key={g.id} value={g.id}>{gName(g.id)}</option>)}</select>
                  <span className="meta" style={{ fontSize: 12 }}>obtient</span>
                  <select style={{ ...fieldStyle, ...auto, minWidth: 210 }} value={rl.right} onChange={e => patchRule(f.id, j, { right: e.target.value as NtfsKey })}>{NTFS.map(n => <option key={n.key} value={n.key}>{n.label}</option>)}</select>
                  <span className="meta" style={{ fontSize: 12 }}>via</span>
                  {/* Les codes icacls se tapaient a la main : une faute de frappe
                      passait sans bruit jusqu'a l'execution du script. */}
                  {rl.right === 'CUSTOM' && (() => {
                    const coches = (rl.custom || '').split(',').map(x => x.trim()).filter(Boolean);
                    const basculer = (code: string) => patchRule(f.id, j, {
                      custom: (coches.includes(code) ? coches.filter(x => x !== code) : [...coches, code]).join(','),
                    });
                    return (
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', flexBasis: '100%', margin: '2px 0 4px 12px' }}>
                        {SPECIAUX.map(sp => {
                          const on = coches.includes(sp.code);
                          return (
                            <button key={sp.code} type="button" title={sp.label} onClick={() => basculer(sp.code)}
                              style={{ ...smallBtn, padding: '2px 7px', fontSize: 11,
                                borderColor: on ? (sp.suppr ? '#dc2626' : 'var(--accent)') : 'var(--border)',
                                color: on ? (sp.suppr ? '#dc2626' : 'var(--accent)') : 'var(--text-muted)' }}>
                              {sp.code}
                            </button>
                          );
                        })}
                        <span className="meta" style={{ fontSize: 11, width: '100%' }}>
                          <strong>DE</strong> supprime l'objet, <strong>DC</strong> son contenu — « modifier sans
                          suppression » consiste exactement à retirer ces deux-là.
                        </span>
                      </div>
                    );
                  })()}
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
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            📜 ② Serveur de fichiers — dossiers, partages{modeDroits === 'icacls' ? ' et droits NTFS' : ' (droits NTFS à la main)'}
          </div>
          {outBtns('fs', scriptFS, 'agdlp-partages.ps1')}
        </div>
        {/* Le TP demande de poser les droits par l'onglet Securite : c'est
            formateur la premiere fois, et penible les suivantes. */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '0 0 8px' }}>
          <span className="meta" style={{ fontSize: 12 }}>Les droits NTFS :</span>
          {([['manuel', 'à poser à la main (onglet Sécurité)'], ['icacls', 'appliqués par le script (icacls)']] as const).map(([v, lib]) => (
            <button key={v} type="button" onClick={() => setModeDroits(v)}
              style={{ ...smallBtn, borderColor: modeDroits === v ? 'var(--accent)' : 'var(--border)', color: modeDroits === v ? 'var(--accent)' : 'var(--text-soft)' }}>
              {lib}
            </button>
          ))}
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

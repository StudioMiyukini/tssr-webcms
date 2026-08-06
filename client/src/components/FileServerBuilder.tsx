import { useMemo, useRef, useState } from 'react';

/**
 * Constructeur de serveur de fichiers : définir une arborescence de dossiers/partages
 * et leurs droits NTFS (par groupe AGDLP), avec un mode « en masse » (un dossier par service).
 * Génère un script PowerShell (New-Item + icacls + New-SmbShare). Îlot React (data-block="file-server-builder").
 */

type Level = 'R' | 'RX' | 'W' | 'M' | 'F' | 'special';
type Ace = { id: string; principal: string; level: Level; special: string[] };
type Folder = { id: string; name: string; parent: string; share: boolean; abe: boolean; breakInherit: boolean; aces: Ace[] };

const LEVELS: { code: Level; label: string }[] = [
  { code: 'R', label: 'Lecture' },
  { code: 'RX', label: 'Lecture et exécution' },
  { code: 'W', label: 'Écriture' },
  { code: 'M', label: 'Modification' },
  { code: 'F', label: 'Contrôle total' },
  { code: 'special', label: 'Droits spéciaux…' },
];
const levelLabel = (c: Level) => LEVELS.find(l => l.code === c)?.label || c;

// Droits NTFS avancés (codes de droits spécifiques icacls) — dont les DEUX suppressions :
// DE = Suppression (de cet objet) · DC = Suppression de sous-dossier et fichier (le contenu).
const SPECIAL: { code: string; label: string; del?: boolean }[] = [
  { code: 'X', label: 'Parcours du dossier / exécuter le fichier' },
  { code: 'RD', label: 'Liste du dossier / lecture de données' },
  { code: 'RA', label: 'Attributs de lecture' },
  { code: 'REA', label: 'Attributs étendus de lecture' },
  { code: 'WD', label: 'Création de fichiers / écriture de données' },
  { code: 'AD', label: 'Création de dossiers / ajout de données' },
  { code: 'WA', label: 'Attributs d’écriture' },
  { code: 'WEA', label: 'Attributs étendus d’écriture' },
  { code: 'DC', label: 'Suppression de sous-dossier et fichier', del: true },
  { code: 'DE', label: 'Suppression', del: true },
  { code: 'RC', label: 'Autorisations de lecture' },
  { code: 'WDAC', label: 'Modification des autorisations' },
  { code: 'WO', label: 'Appropriation' },
];
const SPECIAL_WRITE = ['WD', 'AD', 'WA', 'WEA', 'DE', 'DC', 'WDAC', 'WO'];

const noAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const gName = (svc: string) => 'GLD_' + noAccents(svc).trim().replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_M';

// styles (repris du constructeur AD)
const f: React.CSSProperties = { width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text)', fontSize: 13.5, boxSizing: 'border-box' };
const lb: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 3 };
const grp: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface-2)', marginBottom: 14 };
const leg: React.CSSProperties = { fontWeight: 800, fontSize: 15, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 };
const sub: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 };
const addBtn: React.CSSProperties = { padding: '6px 12px', border: '1px dashed var(--accent)', borderRadius: 8, background: 'transparent', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', fontSize: 12.5 };
const xBtn: React.CSSProperties = { border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px' };
const mono: React.CSSProperties = { fontFamily: 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace' };
const pre: React.CSSProperties = { background: 'var(--surface-3)', border: '1px solid var(--border)', borderLeft: '3px solid var(--accent)', borderRadius: 8, padding: '12px 14px', overflowX: 'auto', fontSize: 12, lineHeight: 1.55, margin: 0, whiteSpace: 'pre', color: 'var(--text)', ...mono };
const chk: React.CSSProperties = { display: 'inline-flex', gap: 5, alignItems: 'center', fontSize: 12.5, cursor: 'pointer' };

export function FileServerBuilder() {
  const [base, setBase] = useState('D:\\Partages');
  const [domain, setDomain] = useState('miyukini');
  const [rightsMode, setRightsMode] = useState<'both' | 'share' | 'ntfs'>('both');
  const [folders, setFolders] = useState<Folder[]>([
    { id: 'f1', name: 'Comptabilite', parent: '', share: true, abe: true, breakInherit: true, aces: [{ id: 'a1', principal: 'GLD_Comptabilite_M', level: 'M', special: [] }, { id: 'a2', principal: 'GLD_Direction', level: 'RX', special: [] }] },
    { id: 'f2', name: 'Communs', parent: '', share: true, abe: true, breakInherit: true, aces: [{ id: 'a3', principal: 'GLD_Communs_M', level: 'M', special: [] }] },
  ]);
  const [bulk, setBulk] = useState('Comptabilite\nRessources Humaines\nProduction\nCommercial');
  const [optDir, setOptDir] = useState(true);
  const [dirGroup, setDirGroup] = useState('GLD_Direction');
  const [optCommuns, setOptCommuns] = useState(true);
  const [copied, setCopied] = useState('');
  const [unlocked, setUnlocked] = useState(() => { try { return sessionStorage.getItem('fsbuilder_ok') === '1'; } catch { return false; } });
  const idc = useRef(100);
  const nid = (p: string) => `${p}${idc.current++}`;

  const childrenOf = (pid: string) => folders.filter(x => x.parent === pid);
  const isDescOrSelf = (id: string, of: string): boolean => id === of || childrenOf(of).some(c => isDescOrSelf(id, c.id));
  const depth = (id: string): number => { let d = 0, cur = folders.find(x => x.id === id); const seen = new Set<string>(); while (cur && cur.parent && !seen.has(cur.id)) { seen.add(cur.id); d++; cur = folders.find(x => x.id === cur!.parent); } return d; };
  const folderPath = (id: string): string => {
    const chain: string[] = []; let cur = folders.find(x => x.id === id); const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) { seen.add(cur.id); chain.unshift(cur.name.trim() || 'Dossier'); cur = cur.parent ? folders.find(x => x.id === cur!.parent) : undefined; }
    return base.replace(/\\+$/, '') + '\\' + chain.join('\\');
  };
  const shareName = (fo: Folder) => (fo.name.trim() || 'Partage').replace(/\s+/g, '_');
  const resolvePrincipal = (p: string) => (p.includes('\\') || !domain.trim()) ? p : `${domain.trim()}\\${p}`;
  // Chaîne de permission icacls d'un ACE : niveau simple (M, RX…) ou liste de droits spéciaux (DE,DC,…).
  const permOf = (a: Ace) => a.level === 'special' ? `(${(a.special.length ? a.special : ['R']).join(',')})` : a.level;
  // Correspondance ACE → droit de PARTAGE (SMB n'a que 3 niveaux : Read / Change / Full).
  const shareRightOf = (a: Ace): 'Full' | 'Change' | 'Read' =>
    a.level === 'F' ? 'Full'
      : a.level === 'special' ? (a.special.some(c => SPECIAL_WRITE.includes(c)) ? 'Change' : 'Read')
        : (a.level === 'R' || a.level === 'RX') ? 'Read' : 'Change';

  const updFolder = (id: string, patch: Partial<Folder>) => setFolders(v => v.map(x => x.id === id ? { ...x, ...patch } : x));
  const addFolder = () => setFolders(v => [...v, { id: nid('f'), name: '', parent: '', share: true, abe: true, breakInherit: true, aces: [] }]);
  const delFolder = (id: string) => setFolders(v => v.filter(x => x.id !== id).map(x => x.parent === id ? { ...x, parent: '' } : x));
  const addAce = (fid: string) => setFolders(v => v.map(x => x.id === fid ? { ...x, aces: [...x.aces, { id: nid('a'), principal: '', level: 'M' as Level, special: [] }] } : x));
  const updAce = (fid: string, aid: string, patch: Partial<Ace>) => setFolders(v => v.map(x => x.id === fid ? { ...x, aces: x.aces.map(a => a.id === aid ? { ...a, ...patch } : a) } : x));
  const delAce = (fid: string, aid: string) => setFolders(v => v.map(x => x.id === fid ? { ...x, aces: x.aces.filter(a => a.id !== aid) } : x));

  const generateBulk = () => {
    const services = bulk.split('\n').map(s => s.trim()).filter(Boolean);
    if (!services.length) return;
    if (folders.length && !window.confirm('Remplacer l’arborescence actuelle par celle générée depuis les services ?')) return;
    const out: Folder[] = services.map(svc => ({
      id: nid('f'), name: noAccents(svc).replace(/[^A-Za-z0-9 _-]+/g, '').trim().replace(/\s+/g, '_'),
      parent: '', share: true, abe: true, breakInherit: true,
      aces: [{ id: nid('a'), principal: gName(svc), level: 'M' as Level, special: [] }, ...(optDir && dirGroup.trim() ? [{ id: nid('a'), principal: dirGroup.trim(), level: 'RX' as Level, special: [] }] : [])],
    }));
    if (optCommuns) out.push({ id: nid('f'), name: 'Communs', parent: '', share: true, abe: true, breakInherit: true, aces: [{ id: nid('a'), principal: 'GLD_Communs_M', level: 'M' as Level, special: [] }] });
    setFolders(out);
  };

  const ordered = useMemo(() => [...folders].sort((a, b) => depth(a.id) - depth(b.id)), [folders]);

  const script = useMemo(() => {
    const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
    const L: string[] = ['#Requires -RunAsAdministrator', '# Construction du serveur de fichiers (arborescence + droits de partage + droits NTFS)', `$Base = ${q(base)}`, ''];
    let step = 1;
    L.push(`# ===== ${step++}) Arborescence =====`);
    ordered.forEach(fo => L.push(`New-Item -ItemType Directory -Force -Path ${q(folderPath(fo.id))} | Out-Null`));
    L.push('');
    // 2) Droits de PARTAGE (SMB) — un partage par dossier coché « Partagé »
    if (rightsMode !== 'ntfs') {
      const shares = ordered.filter(fo => fo.share);
      if (shares.length) {
        L.push(`# ===== ${step++}) Partages SMB + droits de PARTAGE (ABE = enumeration basee sur l'acces) =====`);
        shares.forEach(fo => {
          const bucket = (r: 'Full' | 'Change' | 'Read') => fo.aces.filter(a => a.principal.trim() && shareRightOf(a) === r).map(a => q(resolvePrincipal(a.principal.trim())));
          const full = bucket('Full'), change = bucket('Change'), read = bucket('Read');
          const parts: string[] = [];
          if (full.length) parts.push(`-FullAccess ${full.join(',')}`);
          if (change.length) parts.push(`-ChangeAccess ${change.join(',')}`);
          if (read.length) parts.push(`-ReadAccess ${read.join(',')}`);
          if (!parts.length) parts.push(`-FullAccess 'Utilisateurs authentifies'`);
          L.push(`if (-not (Get-SmbShare -Name ${q(shareName(fo))} -ErrorAction SilentlyContinue)) { New-SmbShare -Name ${q(shareName(fo))} -Path ${q(folderPath(fo.id))}${fo.abe ? ' -FolderEnumerationMode AccessBased' : ''} ${parts.join(' ')} | Out-Null }`);
        });
        L.push('');
      }
    }
    // 3) Droits NTFS (icacls)
    if (rightsMode !== 'share') {
      L.push(`# ===== ${step++}) Droits NTFS (icacls) — SYSTEM (*S-1-5-18) et Administrateurs (*S-1-5-32-544) gardent le controle total =====`);
      ordered.forEach(fo => {
        const path = folderPath(fo.id);
        const aces = fo.aces.filter(a => a.principal.trim()).map(a => `"${resolvePrincipal(a.principal.trim())}:(OI)(CI)${permOf(a)}"`);
        if (fo.breakInherit) {
          L.push(`icacls ${q(path)} /inheritance:r /grant:r "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F"${aces.length ? ' ' + aces.join(' ') : ''}`);
        } else if (aces.length) {
          L.push(`icacls ${q(path)} /grant ${aces.join(' ')}`);
        }
      });
      L.push('');
    }
    L.push('Write-Host "Serveur de fichiers construit." -ForegroundColor Green');
    return L.join('\n');
  }, [ordered, base, domain, rightsMode]);

  const copy = (key: string, text: string) => { navigator.clipboard?.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(''), 1600); }).catch(() => {}); };
  const unlock = () => { setUnlocked(true); try { sessionStorage.setItem('fsbuilder_ok', '1'); } catch { /* */ } };

  if (!unlocked) {
    return (
      <div style={{ margin: '14px 0', maxWidth: 580, border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px', background: 'var(--surface-2)' }}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 10 }}>⚠️ Avant d’utiliser cet outil</div>
        <aside className="pb-note pb-note-yellow" style={{ marginBottom: 14 }}>
          <p className="pb-note-title">Outil réservé aux personnes qui maîtrisent</p>
          <p>Ce constructeur génère un script PowerShell qui <strong>crée des dossiers, pose des droits NTFS (icacls) et publie des partages</strong>. À exécuter <strong>en administrateur sur le serveur de fichiers</strong>, sur un environnement de test, en sachant ce que l’on fait. Les groupes NTFS doivent exister (modèle <strong>AGDLP</strong>).</p>
        </aside>
        <button type="button" onClick={unlock} style={{ padding: '10px 18px', border: 'none', borderRadius: 8, background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>Je veux utiliser l’outil</button>
      </div>
    );
  }

  const parentOptions = (fo: Folder) => folders.filter(o => !isDescOrSelf(o.id, fo.id));

  return (
    <div style={{ margin: '14px 0' }}>
      {/* Serveur */}
      <div style={grp}>
        <div style={leg}>🗄️ Serveur de fichiers</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
          <div><label style={lb}>Chemin racine (sur le serveur)</label><input style={{ ...f, ...mono }} value={base} onChange={e => setBase(e.target.value)} placeholder="D:\Partages" /></div>
          <div><label style={lb}>Domaine (préfixe des groupes)</label><input style={f} value={domain} onChange={e => setDomain(e.target.value)} placeholder="miyukini" /></div>
          <div><label style={lb}>Droits à générer</label>
            <select style={f} value={rightsMode} onChange={e => setRightsMode(e.target.value as 'both' | 'share' | 'ntfs')}>
              <option value="both">Partage + NTFS (recommandé)</option>
              <option value="share">Droits de partage seulement</option>
              <option value="ntfs">Droits NTFS seulement</option>
            </select>
          </div>
        </div>
        <div style={{ ...sub, marginTop: 8, marginBottom: 0 }}>Les droits NTFS s’appuient sur des <strong>groupes de domaine local (GLD_)</strong> — modèle AGDLP. Un principal contenant « \ » est utilisé tel quel ; sinon il est préfixé par le domaine.</div>
      </div>

      {/* En masse */}
      <div style={grp}>
        <div style={leg}>⚡ Générer en masse (un dossier par service)</div>
        <div style={sub}>Colle un service par ligne : l’outil crée un <strong>dossier partagé par service</strong> avec le groupe <code>GLD_&lt;Service&gt;_M</code> en <strong>Modification</strong>.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px,1fr) minmax(220px,1fr)', gap: 14, alignItems: 'start' }}>
          <textarea style={{ ...f, minHeight: 96, resize: 'vertical', ...mono, fontSize: 13 }} value={bulk} onChange={e => setBulk(e.target.value)} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <label style={chk}><input type="checkbox" checked={optDir} onChange={e => setOptDir(e.target.checked)} /> La <strong>Direction</strong> en Lecture sur chaque service</label>
            {optDir && <input style={{ ...f, ...mono, maxWidth: 240 }} value={dirGroup} onChange={e => setDirGroup(e.target.value)} placeholder="GLD_Direction" />}
            <label style={chk}><input type="checkbox" checked={optCommuns} onChange={e => setOptCommuns(e.target.checked)} /> Ajouter un dossier <strong>Communs</strong> (tous en Modification)</label>
            <button type="button" onClick={generateBulk} style={{ padding: '8px 14px', border: 'none', borderRadius: 8, background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13, marginTop: 2, alignSelf: 'start' }}>⚙️ Générer l’arborescence</button>
          </div>
        </div>
      </div>

      {/* Arborescence & droits */}
      <div style={grp}>
        <div style={leg}>🌳 Arborescence &amp; droits d’accès</div>
        <div style={sub}>Le niveau choisi par groupe alimente <strong>à la fois</strong> le <strong>droit de partage</strong> (SMB) et le <strong>droit NTFS</strong> — en accès combiné, c’est le <strong>plus restrictif</strong> des deux qui l’emporte. Le sélecteur « Droits à générer » (ci-dessus) décide ce que le script écrit.</div>
        {folders.map(fo => (
          <div key={fo.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '11px 12px', background: 'var(--surface)', marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ ...mono, color: 'var(--text-muted)', fontSize: 11.5 }}>📁</span>
              <input style={{ ...f, ...mono, maxWidth: 190 }} value={fo.name} onChange={e => updFolder(fo.id, { name: e.target.value })} placeholder="Nom du dossier" />
              <select style={{ ...f, maxWidth: 170 }} value={fo.parent} onChange={e => updFolder(fo.id, { parent: e.target.value })}>
                <option value="">— sous la racine —</option>
                {parentOptions(fo).map(o => <option key={o.id} value={o.id}>dans {o.name || 'Dossier'}</option>)}
              </select>
              <label style={chk}><input type="checkbox" checked={fo.share} onChange={e => updFolder(fo.id, { share: e.target.checked })} /> Partagé</label>
              <label style={chk} title="Énumération basée sur l’accès : masque les dossiers non autorisés"><input type="checkbox" checked={fo.abe} onChange={e => updFolder(fo.id, { abe: e.target.checked })} /> ABE</label>
              <label style={chk} title="Rompre l’héritage pour isoler ce dossier"><input type="checkbox" checked={fo.breakInherit} onChange={e => updFolder(fo.id, { breakInherit: e.target.checked })} /> Isoler (rompre l’héritage)</label>
              <button type="button" onClick={() => delFolder(fo.id)} style={{ ...xBtn, marginLeft: 'auto', color: 'var(--danger)' }} title="Supprimer">🗑</button>
            </div>
            <div style={{ ...mono, fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 2px' }}>{folderPath(fo.id)}{fo.share ? `   ·   \\\\SERVEUR\\${shareName(fo)}` : ''}</div>
            <div style={{ marginTop: 4 }}>
              {fo.aces.map(a => (
                <div key={a.id} style={{ marginBottom: a.level === 'special' ? 8 : 5 }}>
                  <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>👥</span>
                    <input style={{ ...f, ...mono, maxWidth: 240 }} value={a.principal} onChange={e => updAce(fo.id, a.id, { principal: e.target.value })} placeholder="GLD_Compta_M" />
                    <select style={{ ...f, maxWidth: 165 }} value={a.level} onChange={e => updAce(fo.id, a.id, { level: e.target.value as Level })}>
                      {LEVELS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                    </select>
                    <button type="button" onClick={() => delAce(fo.id, a.id)} style={xBtn} title="Retirer">×</button>
                  </div>
                  {a.level === 'special' && (
                    <div style={{ margin: '5px 0 0 26px', padding: '8px 11px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-2)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Coche les <strong>droits spéciaux</strong> à accorder (les <span style={{ color: 'var(--danger)', fontWeight: 700 }}>deux suppressions</span> sont en rouge) :</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(235px,1fr))', gap: '3px 12px' }}>
                        {SPECIAL.map(sp => (
                          <label key={sp.code} style={{ ...chk, fontSize: 12, color: sp.del ? 'var(--danger)' : 'var(--text)', fontWeight: sp.del ? 700 : 400 }}>
                            <input type="checkbox" checked={a.special.includes(sp.code)} onChange={e => updAce(fo.id, a.id, { special: e.target.checked ? [...a.special, sp.code] : a.special.filter(c => c !== sp.code) })} />
                            {sp.label} <span style={{ ...mono, color: 'var(--text-muted)', fontSize: 11 }}>{sp.code}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => addAce(fo.id)} style={{ ...addBtn, padding: '4px 10px', fontSize: 12 }}>+ Droit (groupe)</button>
            </div>
          </div>
        ))}
        {!folders.length && <div style={sub}>Aucun dossier — ajoute-en un ou génère en masse ci-dessus.</div>}
        <button type="button" onClick={addFolder} style={{ ...addBtn, marginTop: 4 }}>+ Ajouter un dossier</button>
      </div>

      {/* Récapitulatif */}
      <div style={grp}>
        <div style={leg}>📋 Récapitulatif des droits</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 520 }}>
            <thead><tr style={{ background: 'var(--surface)' }}>
              {['Dossier', 'Partagé', 'Isolé', 'Droits (partage + NTFS)'].map(h => <th key={h} style={{ textAlign: 'left', padding: '6px 9px', borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {ordered.map(fo => (
                <tr key={fo.id}>
                  <td style={{ padding: '5px 9px', borderBottom: '1px solid var(--border)', ...mono }}>{'\u00A0'.repeat(depth(fo.id) * 3)}{fo.name || '—'}</td>
                  <td style={{ padding: '5px 9px', borderBottom: '1px solid var(--border)' }}>{fo.share ? `✅ ${shareName(fo)}` : '—'}</td>
                  <td style={{ padding: '5px 9px', borderBottom: '1px solid var(--border)' }}>{fo.breakInherit ? '🔒' : '↳ hérite'}</td>
                  <td style={{ padding: '5px 9px', borderBottom: '1px solid var(--border)', fontSize: 12 }}>{fo.aces.filter(a => a.principal.trim()).map(a => `${a.principal} : ${a.level === 'special' ? 'spécial (' + (a.special.join(',') || '∅') + ')' : levelLabel(a.level)}`).join(' · ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Script */}
      <div style={grp}>
        <div style={{ ...leg, justifyContent: 'space-between' }}>
          <span>📟 Script PowerShell</span>
          <button type="button" onClick={() => copy('ps', script)} style={{ padding: '5px 12px', border: '1px solid var(--accent)', borderRadius: 8, background: 'transparent', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', fontSize: 12.5 }}>{copied === 'ps' ? '✓ Copié' : 'Copier'}</button>
        </div>
        <div style={sub}>À exécuter <strong>en administrateur</strong>. Il pose les <strong>droits de partage</strong> (New-SmbShare — Lecture &amp; Lecture/exécution→<em>Read</em>, Écriture/Modification→<em>Change</em>, Contrôle total→<em>Full</em>) et/ou les <strong>droits NTFS</strong> (icacls, <code>(OI)(CI)</code> = fichiers + sous-dossiers), selon le mode choisi.</div>
        <pre style={pre}><code>{script}</code></pre>
      </div>
    </div>
  );
}

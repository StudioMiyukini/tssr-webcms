import { useMemo, useRef, useState } from 'react';

/**
 * Constructeur AD de masse : définir UO / Groupes / Utilisateurs graphiquement,
 * imbriquer les groupes (multi-sélection à chips) et générer un script PowerShell
 * (module ActiveDirectory) qui crée tout en une fois. Îlot React (data-block="ad-bulk-configurator").
 */

type OU = { id: string; name: string; parent: string };
type Grp = { id: string; name: string; ou: string; scope: 'Global' | 'DomainLocal' | 'Universal'; cat: 'Security' | 'Distribution'; memberOf: string[] };
type Usr = { id: string; prenom: string; nom: string; login: string; ou: string; groups: string[] };

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/(^\.|\.$)/g, '');
const domainToDN = (d: string) => d.split('.').filter(Boolean).map(p => `DC=${p}`).join(',');

// styles
const f: React.CSSProperties = { width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text)', fontSize: 13.5, boxSizing: 'border-box' };
const lb: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 3 };
const grp: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface-2)', marginBottom: 14 };
const leg: React.CSSProperties = { fontWeight: 800, fontSize: 15, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 };
const sub: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 };
const addBtn: React.CSSProperties = { padding: '6px 12px', border: '1px dashed var(--accent)', borderRadius: 8, background: 'transparent', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', fontSize: 12.5 };
const xBtn: React.CSSProperties = { border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px' };

// Multi-sélection à chips (menu déroulant pour ajouter, × pour retirer)
function MultiSelect({ options, value, onChange, placeholder }: { options: { id: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const byId = Object.fromEntries(options.map(o => [o.id, o.label]));
  const avail = options.filter(o => !value.includes(o.id));
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', border: '1px solid var(--border)', borderRadius: 7, padding: '4px 6px', background: 'var(--surface)', minHeight: 34 }}>
      {value.map(id => (
        <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--accent-light)', color: 'var(--accent)', borderRadius: 999, padding: '2px 6px 2px 9px', fontSize: 12, fontWeight: 600 }}>
          {byId[id] || id}
          <button type="button" onClick={() => onChange(value.filter(v => v !== id))} style={{ ...xBtn, color: 'var(--accent)', fontSize: 14 }}>×</button>
        </span>
      ))}
      {avail.length > 0 && (
        <select value="" onChange={e => { if (e.target.value) onChange([...value, e.target.value]); }} style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: 12.5, outline: 'none', cursor: 'pointer', flex: 1, minWidth: 110 }}>
          <option value="">{value.length ? '+ ajouter…' : placeholder}</option>
          {avail.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      )}
    </div>
  );
}

export function AdBulkConfigurator() {
  const [domain, setDomain] = useState('miyukini.lan');
  const [ous, setOus] = useState<OU[]>([{ id: 'o1', name: 'Formations', parent: '' }]);
  const [groups, setGroups] = useState<Grp[]>([{ id: 'g1', name: 'G_Toutes_Formations', ou: 'o1', scope: 'Global', cat: 'Security', memberOf: [] }]);
  const [users, setUsers] = useState<Usr[]>([]);
  const [bulk, setBulk] = useState('Jean NGUYEN\nMarie DURAND');
  const [bulkOu, setBulkOu] = useState('o1');
  const [bulkGroups, setBulkGroups] = useState<string[]>(['g1']);
  const [copied, setCopied] = useState(false);
  const [csvMsg, setCsvMsg] = useState('');
  const [unlocked, setUnlocked] = useState(() => { try { return sessionStorage.getItem('vmcfg_ok') === '1'; } catch { return false; } });
  const idc = useRef(100);
  const csvRef = useRef<HTMLInputElement>(null);
  const nid = (p: string) => `${p}${idc.current++}`;

  const domainDN = domainToDN(domain);
  const grpOpts = groups.map(g => ({ id: g.id, label: g.name }));

  // Modèle CSV (reprend les noms d'UO/groupes déjà définis pour être conforme)
  const tplOu = ous.find(o => o.name)?.name || 'Formations';
  const tplGrp = groups.filter(g => g.name);
  const tG1 = tplGrp[0]?.name || 'G_Toutes_Formations';
  const tG2 = tplGrp[1]?.name;
  const templateText = `prenom;nom;login;ou;groupes\nJean;NGUYEN;;${tplOu};${tG1}${tG2 ? ',' + tG2 : ''}\nMarie;DURAND;m.durand;${tplOu};${tG1}`;

  const ouDN = (id: string): string => {
    const o = ous.find(x => x.id === id);
    if (!o) return domainDN;
    return `OU=${o.name},${o.parent ? ouDN(o.parent) : domainDN}`;
  };
  const depth = (id: string): number => { const o = ous.find(x => x.id === id); return o && o.parent ? 1 + depth(o.parent) : 0; };

  const addOu = () => setOus(v => [...v, { id: nid('o'), name: '', parent: '' }]);
  const addGrp = () => setGroups(v => [...v, { id: nid('g'), name: '', ou: ous[0]?.id || '', scope: 'Global', cat: 'Security', memberOf: [] }]);
  const addUsr = () => setUsers(v => [...v, { id: nid('u'), prenom: '', nom: '', login: '', ou: ous[0]?.id || '', groups: [] }]);
  const genBulk = () => {
    const rows = bulk.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const parts = l.split(/\s+/); const prenom = parts[0] || ''; const nom = parts.slice(1).join(' ');
      return { id: nid('u'), prenom, nom, login: `${slug(prenom)}.${slug(nom)}`.replace(/^\.|\.$/g, ''), ou: bulkOu, groups: [...bulkGroups] } as Usr;
    });
    setUsers(v => [...v, ...rows]);
  };
  const upd = <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>, id: string, patch: Partial<T>) =>
    setter(v => v.map((it: any) => it.id === id ? { ...it, ...patch } : it));

  // Import CSV : colonnes séparées par ; (ou ,) ; groupes séparés par le second délimiteur.
  const importCsv = (text: string) => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) { setCsvMsg('CSV vide ou sans données.'); return; }
    const delim = lines[0].includes(';') ? ';' : ',';
    const gsep = delim === ';' ? ',' : ';';
    const header = lines[0].split(delim).map(h => h.trim().toLowerCase());
    const col = (names: string[]) => { for (const n of names) { const i = header.indexOf(n); if (i >= 0) return i; } return -1; };
    const iP = col(['prenom', 'prénom', 'firstname', 'givenname']);
    const iN = col(['nom', 'lastname', 'surname']);
    const iL = col(['login', 'samaccountname', 'identifiant']);
    const iO = col(['ou', 'unite', 'unité']);
    const iG = col(['groupes', 'groups', 'groupe', 'group']);
    const findOu = (name: string) => ous.find(o => o.name.toLowerCase() === name.trim().toLowerCase())?.id || '';
    const findGrp = (name: string) => groups.find(g => g.name.toLowerCase() === name.trim().toLowerCase())?.id;
    const rows: Usr[] = []; let skO = 0, skG = 0;
    for (const line of lines.slice(1)) {
      const c = line.split(delim);
      const prenom = (iP >= 0 ? c[iP] : '')?.trim() || '';
      const nom = (iN >= 0 ? c[iN] : '')?.trim() || '';
      if (!prenom && !nom) continue;
      const login = ((iL >= 0 ? c[iL] : '')?.trim() || '') || `${slug(prenom)}.${slug(nom)}`.replace(/^\.|\.$/g, '');
      const ouName = (iO >= 0 ? c[iO] : '')?.trim() || '';
      const ou = ouName ? findOu(ouName) : ''; if (ouName && !ou) skO++;
      const gids: string[] = [];
      ((iG >= 0 ? c[iG] : '') || '').split(gsep).map(x => x.trim()).filter(Boolean).forEach(gn => { const id = findGrp(gn); if (id) gids.push(id); else skG++; });
      rows.push({ id: nid('u'), prenom, nom, login, ou, groups: gids });
    }
    setUsers(v => [...v, ...rows]);
    setCsvMsg(`✓ ${rows.length} utilisateur(s) importé(s)` + (skO ? ` · ${skO} UO non trouvée(s)` : '') + (skG ? ` · ${skG} groupe(s) non trouvé(s)` : ''));
  };
  const onCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const r = new FileReader(); r.onload = () => importCsv(String(r.result || '')); r.readAsText(file, 'utf-8');
    e.target.value = '';
  };
  const downloadTemplate = () => {
    const blob = new Blob(['﻿' + templateText + '\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = 'utilisateurs-modele.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  // ---- Garde-fous anti-doublons ----
  const norm = (s: string) => s.trim().toLowerCase();
  const userLogin = (u: Usr) => (u.login || `${slug(u.prenom)}.${slug(u.nom)}`.replace(/^\.|\.$/g, ''));
  const dupKeys = (arr: string[]) => { const seen = new Set<string>(), dup = new Set<string>(); arr.forEach(k => { if (!k) return; if (seen.has(k)) dup.add(k); else seen.add(k); }); return dup; };
  const ouDup = dupKeys(ous.map(o => o.name.trim() ? `${norm(o.name)}|${o.parent}` : ''));
  const grpDup = dupKeys(groups.map(g => norm(g.name)));
  const usrDup = dupKeys(users.map(u => norm(userLogin(u))));
  const isOuDup = (o: OU) => o.name.trim() !== '' && ouDup.has(`${norm(o.name)}|${o.parent}`);
  const isGrpDup = (g: Grp) => g.name.trim() !== '' && grpDup.has(norm(g.name));
  const isUsrDup = (u: Usr) => usrDup.has(norm(userLogin(u)));
  const dupOuN = ous.filter(isOuDup).length, dupGrpN = groups.filter(isGrpDup).length, dupUsrN = users.filter(isUsrDup).length;
  const hasDup = dupOuN + dupGrpN + dupUsrN > 0;
  const errF = (bad: boolean): React.CSSProperties => bad ? { ...f, borderColor: 'var(--danger)', background: 'rgba(220,38,38,0.06)' } : f;
  const fixLogins = () => {
    const seen: Record<string, number> = {};
    setUsers(v => v.map(u => { const base = userLogin(u); const k = base.toLowerCase(); seen[k] = (seen[k] || 0) + 1; return { ...u, login: seen[k] > 1 ? `${base}${seen[k]}` : base }; }));
  };

  const script = useMemo(() => {
    const L: string[] = [];
    L.push('#Requires -RunAsAdministrator');
    L.push('Import-Module ActiveDirectory');
    L.push(`$Domain = '${domain}'`);
    L.push(`$DomainDN = '${domainDN}'`);
    L.push('$Password = Read-Host -AsSecureString "Mot de passe initial des utilisateurs"');
    L.push('');
    // 1) UO (parents d'abord)
    if (ous.length) {
      L.push('# ===== 1) Unites d\'organisation =====');
      const ouSeen = new Set<string>();
      [...ous].filter(o => o.name).sort((a, b) => depth(a.id) - depth(b.id)).forEach(o => {
        const key = `${o.name.toLowerCase()}|${o.parent}`; if (ouSeen.has(key)) return; ouSeen.add(key);
        const pdn = o.parent ? `'${ouDN(o.parent)}'` : '$DomainDN';
        L.push(`if (-not (Get-ADOrganizationalUnit -Filter "Name -eq '${o.name}'" -SearchBase ${pdn} -ErrorAction SilentlyContinue)) { New-ADOrganizationalUnit -Name '${o.name}' -Path ${pdn} -ProtectedFromAccidentalDeletion $false }`);
      });
      L.push('');
    }
    // 2) Groupes
    const gById = Object.fromEntries(groups.map(g => [g.id, g]));
    if (groups.some(g => g.name)) {
      L.push('# ===== 2) Groupes =====');
      const gSeen = new Set<string>();
      groups.filter(g => g.name).forEach(g => {
        if (gSeen.has(g.name.toLowerCase())) return; gSeen.add(g.name.toLowerCase());
        const path = g.ou ? `'${ouDN(g.ou)}'` : '$DomainDN';
        L.push(`if (-not (Get-ADGroup -Filter "Name -eq '${g.name}'" -ErrorAction SilentlyContinue)) { New-ADGroup -Name '${g.name}' -GroupScope ${g.scope} -GroupCategory ${g.cat} -Path ${path} }`);
      });
      L.push('');
      // 3) Imbrication (ce groupe est membre de X)
      const nest = groups.filter(g => g.name && g.memberOf.length);
      if (nest.length) {
        L.push('# ===== 3) Imbrication des groupes (membre de) =====');
        nest.forEach(g => g.memberOf.forEach(pid => { const p = gById[pid]; if (p?.name) L.push(`Add-ADGroupMember -Identity '${p.name}' -Members '${g.name}'`); }));
        L.push('');
      }
    }
    // 4) Utilisateurs
    const valid = users.filter(u => u.prenom || u.nom);
    if (valid.length) {
      L.push('# ===== 4) Utilisateurs =====');
      const uSeen = new Set<string>();
      valid.forEach(u => {
        const login = u.login || `${slug(u.prenom)}.${slug(u.nom)}`.replace(/^\.|\.$/g, '');
        if (uSeen.has(login.toLowerCase())) return; uSeen.add(login.toLowerCase());
        const name = `${u.prenom} ${u.nom}`.trim();
        const path = u.ou ? `'${ouDN(u.ou)}'` : '$DomainDN';
        L.push(`if (-not (Get-ADUser -Filter "SamAccountName -eq '${login}'" -ErrorAction SilentlyContinue)) { New-ADUser -Name "${name}" -GivenName "${u.prenom}" -Surname "${u.nom}" -DisplayName "${name}" -SamAccountName '${login}' -UserPrincipalName "${login}@$Domain" -Path ${path} -AccountPassword $Password -Enabled $true -ChangePasswordAtLogon $true }`);
      });
      L.push('');
      // 5) Adhesions (dedupe login+groupe)
      const aSeen = new Set<string>();
      const withG = valid.filter(u => u.groups.length);
      if (withG.length) {
        L.push('# ===== 5) Adhesions des utilisateurs aux groupes =====');
        withG.forEach(u => {
          const login = u.login || `${slug(u.prenom)}.${slug(u.nom)}`.replace(/^\.|\.$/g, '');
          u.groups.forEach(gid => { const g = gById[gid]; if (!g?.name) return; const k = `${login.toLowerCase()}|${g.name.toLowerCase()}`; if (aSeen.has(k)) return; aSeen.add(k); L.push(`Add-ADGroupMember -Identity '${g.name}' -Members '${login}'`); });
        });
      }
    }
    L.push('Write-Host "Construction AD terminee." -ForegroundColor Green');
    return L.join('\n');
  }, [domain, domainDN, ous, groups, users]);

  const copy = () => { navigator.clipboard?.writeText(script).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => {}); };
  const unlock = () => { setUnlocked(true); try { sessionStorage.setItem('vmcfg_ok', '1'); } catch { /* */ } };

  if (!unlocked) {
    return (
      <div style={{ margin: '14px 0', maxWidth: 580, border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px', background: 'var(--surface-2)' }}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 10 }}>⚠️ Avant d’utiliser cet outil</div>
        <aside className="pb-note pb-note-yellow" style={{ marginBottom: 14 }}>
          <p className="pb-note-title">Outil réservé aux personnes qui maîtrisent</p>
          <p>Ce constructeur génère un script qui <strong>crée en masse des UO, groupes et utilisateurs</strong> dans Active Directory. À exécuter <strong>sur un contrôleur de domaine</strong>, sur un environnement de test, en sachant ce que l’on fait.</p>
        </aside>
        <button type="button" onClick={unlock} style={{ padding: '10px 18px', border: 'none', borderRadius: 8, background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>Je veux utiliser l’outil</button>
      </div>
    );
  }

  return (
    <div style={{ margin: '14px 0' }}>
      {/* Domaine */}
      <div style={grp}>
        <div style={leg}>🏢 Domaine</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
          <div style={{ maxWidth: 260, flex: 1 }}><label style={lb}>Nom de domaine</label><input style={f} value={domain} onChange={e => setDomain(e.target.value)} /></div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace', paddingBottom: 8 }}>{domainDN}</div>
        </div>
      </div>

      {/* UO */}
      <div style={grp}>
        <div style={leg}>📁 Unités d’organisation <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>({ous.length})</span></div>
        <div style={sub}>Crée l’arborescence d’UO. Une UO peut être placée sous une autre (imbrication).</div>
        {ous.map(o => (
          <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 7, alignItems: 'center' }}>
            <input style={errF(isOuDup(o))} placeholder="Nom de l’UO" value={o.name} onChange={e => upd(setOus, o.id, { name: e.target.value })} />
            <select style={f} value={o.parent} onChange={e => upd(setOus, o.id, { parent: e.target.value })}>
              <option value="">(racine du domaine)</option>
              {ous.filter(x => x.id !== o.id).map(x => <option key={x.id} value={x.id}>sous : {x.name || '—'}</option>)}
            </select>
            <button type="button" style={xBtn} onClick={() => setOus(v => v.filter(x => x.id !== o.id))} title="Supprimer">🗑️</button>
          </div>
        ))}
        <button type="button" style={addBtn} onClick={addOu}>+ Ajouter une UO</button>
      </div>

      {/* Groupes */}
      <div style={grp}>
        <div style={leg}>👥 Groupes <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>({groups.length})</span></div>
        <div style={sub}>Chaque groupe peut être <strong>membre d’autres groupes</strong> (colonne « membre de » : menu déroulant + chips).</div>
        {groups.map(g => (
          <div key={g.id} style={{ border: '1px solid var(--border)', borderRadius: 9, padding: 10, marginBottom: 8, background: 'var(--surface)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr .9fr .9fr auto', gap: 8, alignItems: 'center' }}>
              <input style={errF(isGrpDup(g))} placeholder="Nom du groupe" value={g.name} onChange={e => upd(setGroups, g.id, { name: e.target.value })} />
              <select style={f} value={g.ou} onChange={e => upd(setGroups, g.id, { ou: e.target.value })}>
                <option value="">(racine)</option>
                {ous.map(o => <option key={o.id} value={o.id}>{o.name || '—'}</option>)}
              </select>
              <select style={f} value={g.scope} onChange={e => upd(setGroups, g.id, { scope: e.target.value as Grp['scope'] })}>
                <option value="Global">Global</option><option value="DomainLocal">Dom. local</option><option value="Universal">Universel</option>
              </select>
              <select style={f} value={g.cat} onChange={e => upd(setGroups, g.id, { cat: e.target.value as Grp['cat'] })}>
                <option value="Security">Sécurité</option><option value="Distribution">Distribution</option>
              </select>
              <button type="button" style={xBtn} onClick={() => setGroups(v => v.filter(x => x.id !== g.id))} title="Supprimer">🗑️</button>
            </div>
            <div style={{ marginTop: 7 }}>
              <label style={lb}>Membre de</label>
              <MultiSelect options={groups.filter(x => x.id !== g.id && x.name).map(x => ({ id: x.id, label: x.name }))} value={g.memberOf} onChange={mo => upd(setGroups, g.id, { memberOf: mo })} placeholder="rattacher à un groupe parent…" />
            </div>
          </div>
        ))}
        <button type="button" style={addBtn} onClick={addGrp}>+ Ajouter un groupe</button>
      </div>

      {/* Création de masse */}
      <div style={grp}>
        <div style={leg}>⚡ Utilisateurs en masse</div>
        <div style={sub}>Colle une liste « Prénom Nom » (une par ligne), choisis l’UO et les groupes par défaut, puis génère.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 10 }}>
          <textarea style={{ ...f, minHeight: 92, fontFamily: 'ui-monospace,monospace' }} value={bulk} onChange={e => setBulk(e.target.value)} placeholder={'Jean NGUYEN\nMarie DURAND'} />
          <div>
            <label style={lb}>UO par défaut</label>
            <select style={f} value={bulkOu} onChange={e => setBulkOu(e.target.value)}>
              <option value="">(racine)</option>{ous.map(o => <option key={o.id} value={o.id}>{o.name || '—'}</option>)}
            </select>
            <div style={{ marginTop: 8 }}><label style={lb}>Groupes par défaut</label>
              <MultiSelect options={grpOpts.filter(o => groups.find(g => g.id === o.id)?.name)} value={bulkGroups} onChange={setBulkGroups} placeholder="choisir des groupes…" />
            </div>
            <button type="button" style={{ ...addBtn, marginTop: 10, width: '100%' }} onClick={genBulk}>➕ Générer les utilisateurs</button>
          </div>
        </div>
        <div style={{ borderTop: '1px dashed var(--border)', margin: '13px 0 10px' }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>📄 ou par fichier CSV :</span>
          <input ref={csvRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={onCsvFile} />
          <button type="button" style={{ ...addBtn, borderStyle: 'solid' }} onClick={() => csvRef.current?.click()}>Importer un CSV</button>
          <button type="button" style={addBtn} onClick={downloadTemplate}>📥 Télécharger le modèle</button>
          {csvMsg && <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{csvMsg}</span>}
        </div>
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12.5, color: 'var(--text-muted)' }}>Format attendu du CSV</summary>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
            En-tête : <code>prenom;nom;login;ou;groupes</code>. Colonnes séparées par <code>;</code> (le point-virgule d’Excel FR), <strong>groupes</strong> séparés par <code>,</code> dans la cellule. <code>login</code> peut être vide (généré automatiquement). Les <code>ou</code> et <code>groupes</code> doivent correspondre aux <strong>noms définis ci-dessus</strong> ; ceux qui n’existent pas sont ignorés (signalés à l’import). Enregistre le fichier en <strong>UTF-8</strong>.
          </div>
          <pre style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 12, marginTop: 6, overflowX: 'auto' }}><code>{templateText}</code></pre>
        </details>
      </div>

      {/* Table utilisateurs */}
      <div style={grp}>
        <div style={leg}>🧑‍💼 Utilisateurs <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>({users.length})</span></div>
        {users.length === 0 && <div style={sub}>Aucun utilisateur. Utilise « Générer » ci-dessus ou « Ajouter » ci-dessous.</div>}
        {users.map(u => (
          <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '.9fr .9fr 1fr 1fr 1.3fr auto', gap: 7, marginBottom: 7, alignItems: 'center' }}>
            <input style={f} placeholder="Prénom" value={u.prenom} onChange={e => upd(setUsers, u.id, { prenom: e.target.value })} />
            <input style={f} placeholder="Nom" value={u.nom} onChange={e => upd(setUsers, u.id, { nom: e.target.value })} />
            <input style={{ ...errF(isUsrDup(u)), fontFamily: 'ui-monospace,monospace' }} placeholder="login" value={u.login || `${slug(u.prenom)}.${slug(u.nom)}`.replace(/^\.|\.$/g, '')} onChange={e => upd(setUsers, u.id, { login: e.target.value })} />
            <select style={f} value={u.ou} onChange={e => upd(setUsers, u.id, { ou: e.target.value })}>
              <option value="">(racine)</option>{ous.map(o => <option key={o.id} value={o.id}>{o.name || '—'}</option>)}
            </select>
            <MultiSelect options={grpOpts.filter(o => groups.find(g => g.id === o.id)?.name)} value={u.groups} onChange={gs => upd(setUsers, u.id, { groups: gs })} placeholder="groupes…" />
            <button type="button" style={xBtn} onClick={() => setUsers(v => v.filter(x => x.id !== u.id))} title="Supprimer">🗑️</button>
          </div>
        ))}
        <button type="button" style={addBtn} onClick={addUsr}>+ Ajouter un utilisateur</button>
      </div>

      {/* Garde-fou doublons */}
      {hasDup && (
        <aside className="pb-note pb-note-yellow" style={{ marginBottom: 12 }}>
          <p className="pb-note-title">⚠️ Doublons détectés</p>
          <p>{[dupOuN && `${dupOuN} UO`, dupGrpN && `${dupGrpN} groupe(s)`, dupUsrN && `${dupUsrN} utilisateur(s)`].filter(Boolean).join(' · ')} en double (surlignés en rouge). Ils sont <strong>ignorés</strong> dans le script généré, mais mieux vaut les corriger (un même nom d’UO/groupe ou un même login ne peut exister qu’une fois).
            {dupUsrN > 0 && <> <button type="button" onClick={fixLogins} style={{ marginLeft: 4, padding: '3px 10px', border: '1px solid var(--danger)', borderRadius: 7, background: 'transparent', color: 'var(--danger)', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>Corriger les logins en double</button></>}
          </p>
        </aside>
      )}

      {/* Sortie */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 6px' }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>📜 Script généré — {ous.filter(o => o.name).length} UO · {groups.filter(g => g.name).length} groupes · {users.filter(u => u.prenom || u.nom).length} utilisateurs</div>
        <button onClick={copy} style={{ padding: '6px 14px', border: '1px solid var(--accent)', borderRadius: 8, background: copied ? 'var(--accent)' : 'transparent', color: copied ? '#fff' : 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>{copied ? '✓ Copié' : 'Copier'}</button>
      </div>
      <pre style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', overflowX: 'auto', fontSize: 12.5, lineHeight: 1.5, margin: 0, maxHeight: 420 }}><code>{script}</code></pre>
    </div>
  );
}

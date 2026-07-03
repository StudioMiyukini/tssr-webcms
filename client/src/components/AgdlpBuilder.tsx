import { useEffect, useMemo, useState } from 'react';

/**
 * Constructeur AGDLP : à partir des services (métiers), des ressources (dossiers) avec
 * leurs besoins d'accès, et des utilisateurs, génère la structure complète en respectant
 * AGDLP (Account → Global → Domain Local → Permission), avec la convention de nommage.
 * Sorties : arborescence des UO, arborescence des droits NTFS, et 2 scripts (DC + serveur
 * de fichiers). Îlot React hydraté via RichContent (data-block="agdlp-builder").
 */

type Right = 'Lecture' | 'Modification' | 'ControleTotal';
const RIGHT_LABEL: Record<Right, string> = { Lecture: 'Lecture', Modification: 'Modification', ControleTotal: 'Contrôle total' };
const RIGHT_ICACLS: Record<Right, string> = { Lecture: 'RX', Modification: 'M', ControleTotal: 'F' };
type Service = { name: string; code: string };
type Rule = { service: string; right: Right };
type Resource = { name: string; code: string; path: string; rules: Rule[] };
type User = { prenom: string; nom: string; service: string };

const clean = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '');
const login = (p: string, n: string) => `${clean(p)}.${clean(n)}`.toLowerCase();
const domainToDN = (d: string) => d.split('.').filter(Boolean).map(x => `DC=${x}`).join(',');
const netbiosOf = (d: string) => clean(d.split('.')[0] || 'DOMAINE').toUpperCase();

const fieldStyle: React.CSSProperties = { width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13.5, boxSizing: 'border-box' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 4 };
const groupStyle: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface-2)', marginBottom: 14 };
const legendStyle: React.CSSProperties = { fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 };
const btnStyle: React.CSSProperties = { padding: '6px 11px', border: '1px solid var(--accent)', borderRadius: 8, background: 'transparent', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 12.5, whiteSpace: 'nowrap' };
const smallBtn: React.CSSProperties = { ...btnStyle, padding: '3px 9px', fontSize: 12, borderColor: 'var(--border)', color: 'var(--text-soft)' };

const DEFAULT = {
  domain: 'miyukini.lan', ouBase: 'Miyukini',
  services: [{ name: 'Comptabilité', code: 'Compta' }, { name: 'Direction', code: 'Direction' }, { name: 'Commercial', code: 'Commercial' }] as Service[],
  resources: [
    { name: 'Comptabilité', code: 'Compta', path: 'E:\\Partages\\Comptabilité', rules: [{ service: 'Compta', right: 'Modification' }, { service: 'Direction', right: 'Lecture' }] },
    { name: 'Commercial', code: 'Commercial', path: 'E:\\Partages\\Commercial', rules: [{ service: 'Commercial', right: 'Modification' }, { service: 'Direction', right: 'Lecture' }] },
  ] as Resource[],
  users: [{ prenom: 'Jean', nom: 'Nguyen', service: 'Compta' }, { prenom: 'Marie', nom: 'Durand', service: 'Compta' }] as User[],
};
function load<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }

export function AgdlpBuilder() {
  const [domain, setDomain] = useState(() => load('agdlp_domain', DEFAULT.domain));
  const [ouBase, setOuBase] = useState(() => load('agdlp_oubase', DEFAULT.ouBase));
  const [services, setServices] = useState<Service[]>(() => load('agdlp_services', DEFAULT.services));
  const [resources, setResources] = useState<Resource[]>(() => load('agdlp_resources', DEFAULT.resources));
  const [users, setUsers] = useState<User[]>(() => load('agdlp_users', DEFAULT.users));
  const [copiedId, setCopiedId] = useState('');
  const [bulk, setBulk] = useState('');
  const [unlocked, setUnlocked] = useState(() => { try { return sessionStorage.getItem('agdlp_ok') === '1'; } catch { return false; } });

  useEffect(() => { try {
    localStorage.setItem('agdlp_domain', JSON.stringify(domain)); localStorage.setItem('agdlp_oubase', JSON.stringify(ouBase));
    localStorage.setItem('agdlp_services', JSON.stringify(services)); localStorage.setItem('agdlp_resources', JSON.stringify(resources));
    localStorage.setItem('agdlp_users', JSON.stringify(users));
  } catch { /* */ } }, [domain, ouBase, services, resources, users]);

  const domainDN = domainToDN(domain);
  const baseDN = `OU=${ouBase},${domainDN}`;
  const usersDN = `OU=Utilisateurs,${baseDN}`;
  const groupsDN = `OU=Groupes,${baseDN}`;
  const netbios = netbiosOf(domain);
  const svcName = (code: string) => services.find(s => s.code === code)?.name || code;
  const gName = (code: string) => `G_${code}`;
  const dlName = (resCode: string, r: Right) => `DL_${resCode}_${r}`;

  // Groupes DL distincts (ressource + droit réellement utilisés)
  const dlGroups = useMemo(() => {
    const set = new Map<string, { res: Resource; right: Right }>();
    for (const res of resources) for (const rule of res.rules) set.set(`${res.code}|${rule.right}`, { res, right: rule.right });
    return Array.from(set.values());
  }, [resources]);

  // ---- Arborescence des UO ----
  const ouTree = useMemo(() => {
    const L: string[] = [];
    L.push(`🌐 ${domain}`);
    L.push(`└─ 📁 OU=${ouBase}`);
    L.push(`    ├─ 📁 OU=Utilisateurs`);
    services.forEach((s, i) => L.push(`    │   ${i === services.length - 1 ? '└─' : '├─'} 📁 OU=${s.name}`));
    L.push(`    ├─ 📁 OU=Groupes`);
    L.push(`    └─ 📁 OU=Ordinateurs`);
    return L.join('\n');
  }, [domain, ouBase, services]);

  // ---- Arborescence des droits NTFS ----
  const ntfsTree = useMemo(() => {
    const L: string[] = [];
    for (const res of resources) {
      L.push(`📂 ${res.path}   (partage : ${res.code})`);
      res.rules.forEach((rule, i) => {
        const last = i === res.rules.length - 1;
        L.push(`    ${last ? '└─' : '├─'} 🔒 ${dlName(res.code, rule.right)}  →  ${RIGHT_LABEL[rule.right]}   (⟵ ${gName(rule.service)})`);
      });
      if (!res.rules.length) L.push('    └─ (aucun droit défini)');
      L.push('');
    }
    return L.join('\n').trimEnd();
  }, [resources]);

  // ---- Script 1 : sur le contrôleur de domaine ----
  const scriptDC = useMemo(() => {
    const o: string[] = [];
    o.push('#Requires -RunAsAdministrator');
    o.push('# ============================================================');
    o.push(`#  AGDLP - a executer SUR LE CONTROLEUR DE DOMAINE (${domain})`);
    o.push('#  OU -> Groupes Globaux -> Groupes Domaine Local -> imbrication -> Utilisateurs');
    o.push('# ============================================================');
    o.push('Import-Module ActiveDirectory');
    o.push('function Ensure-OU($n,$p){ if(-not(Get-ADOrganizationalUnit -Filter "Name -eq \'$n\'" -SearchBase $p -ErrorAction SilentlyContinue)){ New-ADOrganizationalUnit -Name $n -Path $p -ProtectedFromAccidentalDeletion:$false } }');
    o.push('function Ensure-Grp($n,$s,$p){ if(-not(Get-ADGroup -Filter "Name -eq \'$n\'" -ErrorAction SilentlyContinue)){ New-ADGroup -Name $n -GroupScope $s -GroupCategory Security -Path $p } }');
    o.push('');
    o.push('# --- 1) Unites d\'organisation ---');
    o.push(`Ensure-OU '${ouBase}' '${domainDN}'`);
    o.push(`Ensure-OU 'Utilisateurs' '${baseDN}'`);
    o.push(`Ensure-OU 'Groupes' '${baseDN}'`);
    o.push(`Ensure-OU 'Ordinateurs' '${baseDN}'`);
    services.forEach(s => o.push(`Ensure-OU '${s.name}' '${usersDN}'`));
    o.push('');
    o.push('# --- 2) Groupes GLOBAUX (par metier) ---');
    services.forEach(s => o.push(`Ensure-Grp '${gName(s.code)}' Global '${groupsDN}'`));
    o.push('');
    o.push('# --- 3) Groupes DOMAINE LOCAL (par ressource + droit) ---');
    dlGroups.forEach(g => o.push(`Ensure-Grp '${dlName(g.res.code, g.right)}' DomainLocal '${groupsDN}'`));
    o.push('');
    o.push('# --- 4) Imbrication : le Global entre dans le Domaine Local ---');
    for (const res of resources) for (const rule of res.rules) o.push(`Add-ADGroupMember '${dlName(res.code, rule.right)}' -Members '${gName(rule.service)}' -ErrorAction SilentlyContinue`);
    o.push('');
    o.push('# --- 5) Utilisateurs (place dans l\'OU du service + ajout au Global) ---');
    o.push('$pwd = Read-Host "Mot de passe initial des comptes" -AsSecureString');
    for (const u of users) {
      const l = login(u.prenom, u.nom);
      const ou = `OU=${svcName(u.service)},${usersDN}`;
      o.push(`if(-not(Get-ADUser -Filter "SamAccountName -eq '${l}'" -ErrorAction SilentlyContinue)){ New-ADUser -Name '${u.prenom} ${u.nom}' -GivenName '${u.prenom}' -Surname '${u.nom}' -SamAccountName '${l}' -UserPrincipalName '${l}@${domain}' -Path '${ou}' -AccountPassword $pwd -Enabled $true -ChangePasswordAtLogon $true }`);
      o.push(`Add-ADGroupMember '${gName(u.service)}' -Members '${l}' -ErrorAction SilentlyContinue`);
    }
    o.push('Write-Host "AGDLP applique cote AD." -ForegroundColor Green');
    return o.join('\n');
  }, [domain, domainDN, baseDN, usersDN, groupsDN, ouBase, services, resources, dlGroups, users]);

  // ---- Script 2 : sur le serveur de fichiers ----
  const scriptFS = useMemo(() => {
    const o: string[] = [];
    o.push('#Requires -RunAsAdministrator');
    o.push('# ============================================================');
    o.push('#  AGDLP - a executer SUR LE SERVEUR DE FICHIERS');
    o.push('#  Dossiers + partages (larges) + permissions NTFS sur les groupes DOMAINE LOCAL');
    o.push('# ============================================================');
    for (const res of resources) {
      o.push(`# --- ${res.name} ---`);
      o.push(`New-Item -ItemType Directory -Path '${res.path}' -Force | Out-Null`);
      o.push(`if(-not(Get-SmbShare -Name '${res.code}' -ErrorAction SilentlyContinue)){ New-SmbShare -Name '${res.code}' -Path '${res.path}' -FullAccess 'Utilisateurs authentifies' | Out-Null }`);
      o.push('# NTFS : le partage reste large, le NTFS filtre reellement (le plus restrictif l\'emporte)');
      for (const rule of res.rules) o.push(`icacls '${res.path}' /grant '${netbios}\\${dlName(res.code, rule.right)}:(OI)(CI)${RIGHT_ICACLS[rule.right]}'`);
      o.push('');
    }
    o.push('Write-Host "Partages et NTFS appliques." -ForegroundColor Green');
    return o.join('\n').trimEnd();
  }, [resources, netbios]);

  // ---- Actions ----
  const copy = (id: string, code: string) => { navigator.clipboard?.writeText(code).then(() => { setCopiedId(id); setTimeout(() => setCopiedId(''), 1600); }).catch(() => {}); };
  const download = (code: string, filename: string) => {
    const blob = new Blob(['\uFEFF' + code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  // services
  const addService = () => setServices(s => [...s, { name: 'Service', code: 'Service' }]);
  const setService = (i: number, patch: Partial<Service>) => setServices(s => s.map((x, k) => k === i ? { ...x, ...patch } : x));
  const delService = (i: number) => setServices(s => s.filter((_, k) => k !== i));
  // resources
  const addResource = () => setResources(r => [...r, { name: 'Dossier', code: 'Dossier', path: 'E:\\Partages\\Dossier', rules: [] }]);
  const setResource = (i: number, patch: Partial<Resource>) => setResources(r => r.map((x, k) => k === i ? { ...x, ...patch } : x));
  const delResource = (i: number) => setResources(r => r.filter((_, k) => k !== i));
  const addRule = (i: number) => setResources(r => r.map((x, k) => k === i ? { ...x, rules: [...x.rules, { service: services[0]?.code || '', right: 'Modification' }] } : x));
  const setRule = (i: number, j: number, patch: Partial<Rule>) => setResources(r => r.map((x, k) => k === i ? { ...x, rules: x.rules.map((y, m) => m === j ? { ...y, ...patch } : y) } : x));
  const delRule = (i: number, j: number) => setResources(r => r.map((x, k) => k === i ? { ...x, rules: x.rules.filter((_, m) => m !== j) } : x));
  // users
  const addUser = () => setUsers(u => [...u, { prenom: 'Prénom', nom: 'Nom', service: services[0]?.code || '' }]);
  const setUser = (i: number, patch: Partial<User>) => setUsers(u => u.map((x, k) => k === i ? { ...x, ...patch } : x));
  const delUser = (i: number) => setUsers(u => u.filter((_, k) => k !== i));
  const [bulkSvc, setBulkSvc] = useState('');
  const importBulk = () => {
    const svc = bulkSvc || services[0]?.code || '';
    const rows = bulk.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => { const p = l.split(/\s+/); return { prenom: p[0] || '', nom: p.slice(1).join(' ') || '', service: svc }; }).filter(u => u.prenom && u.nom);
    if (rows.length) { setUsers(u => [...u, ...rows]); setBulk(''); }
  };

  if (!unlocked) {
    return (
      <div style={{ margin: '14px 0', maxWidth: 600, ...groupStyle }}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 10 }}>⚠️ Avant d’utiliser cet outil</div>
        <aside className="pb-note pb-note-yellow" style={{ marginBottom: 14 }}>
          <p className="pb-note-title">Outil réservé aux personnes qui maîtrisent</p>
          <p>Ce constructeur génère des scripts qui <strong>créent des OU, groupes, utilisateurs et modifient les permissions NTFS</strong> d’un domaine. Une mauvaise utilisation peut désorganiser un annuaire ou ouvrir des accès. À n’utiliser qu’en <strong>environnement de test</strong> et si tu maîtrises Active Directory.</p>
        </aside>
        <button type="button" onClick={() => { setUnlocked(true); try { sessionStorage.setItem('agdlp_ok', '1'); } catch { /* */ } }} style={{ padding: '10px 18px', border: 'none', borderRadius: 8, background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>Je veux utiliser l’outil</button>
      </div>
    );
  }

  const outBtns = (id: string, code: string, file: string) => (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={() => download(code, file)} style={{ ...smallBtn, padding: '6px 12px' }} title="Télécharger le .ps1">💾 .ps1</button>
      <button onClick={() => copy(id, code)} style={{ padding: '6px 14px', border: '1px solid var(--accent)', borderRadius: 8, background: copiedId === id ? 'var(--accent)' : 'transparent', color: copiedId === id ? '#fff' : 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>{copiedId === id ? '✓ Copié' : 'Copier'}</button>
    </div>
  );
  const preStyle: React.CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', overflowX: 'auto', fontSize: 12.5, lineHeight: 1.5, margin: 0, fontFamily: 'ui-monospace,monospace' };

  return (
    <div style={{ margin: '14px 0' }}>
      {/* Domaine & convention */}
      <div style={groupStyle}>
        <div style={legendStyle}>🌐 Domaine & convention</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
          <div><label style={labelStyle}>Domaine</label><input style={fieldStyle} value={domain} onChange={e => setDomain(e.target.value)} /></div>
          <div><label style={labelStyle}>OU racine</label><input style={fieldStyle} value={ouBase} onChange={e => setOuBase(e.target.value)} /></div>
          <div><label style={labelStyle}>DN de base</label><input style={{ ...fieldStyle, fontFamily: 'ui-monospace,monospace', color: 'var(--accent)' }} value={baseDN} readOnly /></div>
        </div>
        <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>Convention : <code>G_&lt;service&gt;</code> (global, par métier) · <code>DL_&lt;ressource&gt;_&lt;droit&gt;</code> (domaine local, par dossier + droit) · permission NTFS sur le groupe <strong>DL</strong>. 💾 Tout est mémorisé dans ce navigateur.</div>
      </div>

      {/* Services */}
      <div style={groupStyle}>
        <div style={legendStyle}>👥 Services / métiers <span className="meta" style={{ fontWeight: 400, fontSize: 12 }}>→ un groupe Global + une OU utilisateurs chacun</span></div>
        {services.map((s, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <input style={fieldStyle} value={s.name} onChange={e => setService(i, { name: e.target.value })} placeholder="Nom du service (OU)" />
            <input style={fieldStyle} value={s.code} onChange={e => setService(i, { code: clean(e.target.value) })} placeholder="Code (→ G_Code)" />
            <button style={smallBtn} onClick={() => delService(i)} title="Supprimer">✕</button>
          </div>
        ))}
        <button style={btnStyle} onClick={addService}>+ Service</button>
      </div>

      {/* Ressources */}
      <div style={groupStyle}>
        <div style={legendStyle}>📂 Ressources (dossiers) & besoins d’accès</div>
        {resources.map((res, i) => (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 10, background: 'var(--surface)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 2fr auto', gap: 8, alignItems: 'center' }}>
              <input style={fieldStyle} value={res.name} onChange={e => setResource(i, { name: e.target.value })} placeholder="Nom" />
              <input style={fieldStyle} value={res.code} onChange={e => setResource(i, { code: clean(e.target.value) })} placeholder="Code" />
              <input style={{ ...fieldStyle, fontFamily: 'ui-monospace,monospace' }} value={res.path} onChange={e => setResource(i, { path: e.target.value })} placeholder="E:\\Partages\\..." />
              <button style={smallBtn} onClick={() => delResource(i)} title="Supprimer la ressource">✕</button>
            </div>
            <div style={{ marginTop: 8, paddingLeft: 8, borderLeft: '2px solid var(--border)' }}>
              {res.rules.map((rule, j) => (
                <div key={j} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <span className="meta" style={{ fontSize: 12 }}>Le service</span>
                  <select style={{ ...fieldStyle, width: 'auto' }} value={rule.service} onChange={e => setRule(i, j, { service: e.target.value })}>
                    {services.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
                  </select>
                  <span className="meta" style={{ fontSize: 12 }}>a le droit</span>
                  <select style={{ ...fieldStyle, width: 'auto' }} value={rule.right} onChange={e => setRule(i, j, { right: e.target.value as Right })}>
                    {(Object.keys(RIGHT_LABEL) as Right[]).map(r => <option key={r} value={r}>{RIGHT_LABEL[r]}</option>)}
                  </select>
                  <code style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>→ {dlName(res.code, rule.right)}</code>
                  <button style={{ ...smallBtn, marginLeft: 'auto' }} onClick={() => delRule(i, j)}>✕</button>
                </div>
              ))}
              <button style={smallBtn} onClick={() => addRule(i)}>+ Règle d’accès</button>
            </div>
          </div>
        ))}
        <button style={btnStyle} onClick={addResource}>+ Ressource</button>
      </div>

      {/* Utilisateurs */}
      <div style={groupStyle}>
        <div style={legendStyle}>🧑 Utilisateurs <span className="meta" style={{ fontWeight: 400, fontSize: 12 }}>→ login prénom.nom, placé dans l’OU du service + ajouté au Global</span></div>
        {users.map((u, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.4fr 1.6fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <input style={fieldStyle} value={u.prenom} onChange={e => setUser(i, { prenom: e.target.value })} placeholder="Prénom" />
            <input style={fieldStyle} value={u.nom} onChange={e => setUser(i, { nom: e.target.value })} placeholder="Nom" />
            <select style={fieldStyle} value={u.service} onChange={e => setUser(i, { service: e.target.value })}>
              {services.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
            <code style={{ fontSize: 12, color: 'var(--accent)' }}>{login(u.prenom, u.nom)}@{domain}</code>
            <button style={smallBtn} onClick={() => delUser(i)}>✕</button>
          </div>
        ))}
        <button style={btnStyle} onClick={addUser}>+ Utilisateur</button>
        <div style={{ marginTop: 10, borderTop: '1px dashed var(--border)', paddingTop: 10 }}>
          <label style={labelStyle}>Ajout en masse — coller « Prénom Nom » (une par ligne)</label>
          <textarea value={bulk} onChange={e => setBulk(e.target.value)} placeholder={'Paul Martin\nSophie Bernard'} style={{ ...fieldStyle, minHeight: 60, fontFamily: 'ui-monospace,monospace', resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="meta" style={{ fontSize: 12 }}>Service :</span>
            <select style={{ ...fieldStyle, width: 'auto' }} value={bulkSvc || services[0]?.code || ''} onChange={e => setBulkSvc(e.target.value)}>
              {services.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
            <button style={btnStyle} onClick={importBulk}>Ajouter ces utilisateurs</button>
          </div>
        </div>
      </div>

      {/* Aperçus */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, margin: '0 0 6px' }}>🌳 Arborescence des UO</div>
          <pre style={preStyle}><code>{ouTree}</code></pre>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, margin: '0 0 6px' }}>🔐 Arborescence des droits NTFS</div>
          <pre style={preStyle}><code>{ntfsTree}</code></pre>
        </div>
      </div>

      {/* Scripts */}
      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 6px' }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>📜 ① Sur le contrôleur de domaine — OU, groupes, imbrication, utilisateurs</div>
          {outBtns('dc', scriptDC, 'agdlp-ad.ps1')}
        </div>
        <pre style={preStyle}><code>{scriptDC}</code></pre>
      </div>
      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 6px' }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>📜 ② Sur le serveur de fichiers — dossiers, partages, NTFS</div>
          {outBtns('fs', scriptFS, 'agdlp-partages.ps1')}
        </div>
        <pre style={preStyle}><code>{scriptFS}</code></pre>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';

/**
 * Configurateur de script de mise en service d'une VM serveur (Hyper-V).
 * Partie hôte : CLONE une VM source (Export-VM / Import-VM) + personnalisations
 * (vCPU/RAM, commutateur privé, démarrage). Base : New-VMClone.ps1 (Florian Burnel, it-connect.fr).
 * Partie VM : IP/DNS, règles pare-feu personnalisées (ping), rôles, renommage, appartenance.
 * Îlot React hydraté via RichContent (data-block="vm-configurator").
 */

type Role = { key: string; label: string; feature: string };
const ROLES: Role[] = [
  { key: 'AD', label: 'Active Directory (AD DS)', feature: 'AD-Domain-Services' },
  { key: 'DNS', label: 'DNS', feature: 'DNS' },
  { key: 'DHCP', label: 'DHCP', feature: 'DHCP' },
  { key: 'IIS', label: 'Serveur Web (IIS)', feature: 'Web-Server' },
  { key: 'FILE', label: 'Serveur de fichiers', feature: 'FS-FileServer' },
  { key: 'HYPV', label: 'Hyper-V', feature: 'Hyper-V' },
];

const CIDR_TO_MASK: Record<number, string> = {
  8: '255.0.0.0', 16: '255.255.0.0', 23: '255.255.254.0', 24: '255.255.255.0',
  25: '255.255.255.128', 26: '255.255.255.192', 27: '255.255.255.224', 28: '255.255.255.240',
  29: '255.255.255.248', 30: '255.255.255.252',
};

const lsGet = (k: string, d: string) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const gatewayFromIp = (ip: string) => { const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/); return m ? `${m[1]}.${m[2]}.${m[3]}.254` : ''; };

const fieldStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 4 };
const groupStyle: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface-2)', marginBottom: 14 };
const legendStyle: React.CSSProperties = { fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 };
const rowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 };
const btnStyle: React.CSSProperties = { padding: '8px 12px', border: '1px solid var(--accent)', borderRadius: 8, background: 'transparent', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' };

export function VmConfigurator() {
  const [type, setType] = useState<'Client' | 'SRV'>('SRV');
  const [num, setNum] = useState('01');
  const [vcpu, setVcpu] = useState('2');
  const [ramGo, setRamGo] = useState('4');
  const [roles, setRoles] = useState<string[]>(['AD', 'DNS']);
  const [primary, setPrimary] = useState('AD');
  const [ip, setIp] = useState('192.168.10.11');
  const [cidr, setCidr] = useState('24');
  const [gw, setGw] = useState('192.168.10.254');
  const [gwAuto, setGwAuto] = useState(true);
  const [dns, setDns] = useState('127.0.0.1');
  const [iface, setIface] = useState('Ethernet');
  const [sw, setSw] = useState('COM_private');
  // Clonage (persisté dans le navigateur)
  const [sourceVM, setSourceVM] = useState(() => lsGet('vmcfg_source', 'Master-WS2022'));
  const [exportPath, setExportPath] = useState(() => lsGet('vmcfg_export', 'C:\\TEMP'));
  const [vhdDir, setVhdDir] = useState(() => lsGet('vmcfg_vhddir', 'C:\\Hyper-V\\VHDs'));
  // Appartenance
  const [membership, setMembership] = useState<'workgroup' | 'domain'>('domain');
  const [domain, setDomain] = useState('miyukini.lan');
  const [workgroup, setWorkgroup] = useState('WORKGROUP');
  const [copiedId, setCopiedId] = useState('');
  // Masters scannés dans un dossier (persistés) + mode saisie manuelle + message de scan
  const [masters, setMasters] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('vmcfg_masters') || '[]'); } catch { return []; } });
  const [manualSource, setManualSource] = useState(false);
  const [scanMsg, setScanMsg] = useState('');
  // Avertissement à accepter avant d'utiliser l'outil (mémorisé pour la session)
  const [unlocked, setUnlocked] = useState(() => { try { return sessionStorage.getItem('vmcfg_ok') === '1'; } catch { return false; } });
  const unlock = () => { setUnlocked(true); try { sessionStorage.setItem('vmcfg_ok', '1'); } catch { /* */ } };

  useEffect(() => { try { localStorage.setItem('vmcfg_source', sourceVM); localStorage.setItem('vmcfg_export', exportPath); localStorage.setItem('vmcfg_vhddir', vhdDir); localStorage.setItem('vmcfg_masters', JSON.stringify(masters)); } catch { /* indisponible */ } }, [sourceVM, exportPath, vhdDir, masters]);

  const num2 = (num || '01').padStart(2, '0');
  const primaryKey = type === 'SRV' ? (roles.includes(primary) ? primary : (roles[0] || 'SRV')) : '';
  const vmName = type === 'Client' ? `Client_${num2}` : `SRV_${primaryKey || 'ROLE'}_${num2}`;
  const effectiveGw = gwAuto ? (gatewayFromIp(ip) || gw) : gw;
  const toggleRole = (k: string) => setRoles(rs => rs.includes(k) ? rs.filter(x => x !== k) : [...rs, k]);

  // ---- Génération du script en 2 parties ----
  const sections = useMemo(() => {
    // ===== PARTIE 1 : sur l'hôte — clonage (Export/Import) + personnalisations =====
    const host: string[] = [];
    host.push('# ============================================================');
    host.push(`#  Clonage Hyper-V : ${sourceVM}  ->  ${vmName}`);
    host.push(`#  ${vcpu} vCPU - ${ramGo} Go RAM - commutateur ${sw}`);
    host.push('#  A executer SUR L\'HOTE Hyper-V (PowerShell admin)');
    host.push('#  Base : New-VMClone.ps1 (Florian Burnel - it-connect.fr)');
    host.push('# ============================================================');
    host.push(`$VMSourceName            = '${sourceVM}'`);
    host.push(`$VMCloneName             = '${vmName}'`);
    host.push(`$VMCloneExportPath       = '${exportPath}'`);
    host.push(`$VMCloneImportConfigPath = Join-Path '${vhdDir}' '${vmName}'`);
    host.push('$VMCloneImportVhdxPath   = Join-Path $VMCloneImportConfigPath \'VHDX\'');
    host.push('');
    host.push('if ((-not (Get-VM -Name $VMCloneName -ErrorAction SilentlyContinue)) -and ($VMSourceName -ne $VMCloneName)) {');
    host.push('    Write-Output "Clonage de $VMSourceName vers $VMCloneName..."');
    host.push('    if (Test-Path $VMCloneExportPath) {');
    host.push('        Export-VM -Name $VMSourceName -Path $VMCloneExportPath -CaptureLiveState CaptureSavedState');
    host.push('        $ExportVMPath  = Join-Path $VMCloneExportPath $VMSourceName');
    host.push('        $ExportVmcxDir = Join-Path $ExportVMPath "Virtual Machines"');
    host.push('        if (Test-Path $ExportVmcxDir) {');
    host.push('            $FileVMCX = (Get-ChildItem -Path $ExportVmcxDir | Where-Object { $_.Name -match \'.vmcx$\' }).Name');
    host.push('            Import-VM -Path (Join-Path $ExportVmcxDir $FileVMCX) -Copy -GenerateNewId -VirtualMachinePath $VMCloneImportConfigPath -VhdDestinationPath $VMCloneImportVhdxPath');
    host.push('            if ((Get-VM -Name $VMSourceName).Count -eq 2) {');
    host.push('                $SearchVM = Get-VM | Where-Object { $_.Path.StartsWith($VMCloneImportConfigPath) }');
    host.push('                Rename-VM -VM $SearchVM -NewName $VMCloneName');
    host.push('                Set-VM   -Name $VMCloneName -Notes "Clone de $VMSourceName"');
    host.push('                # ----- Personnalisations -----');
    host.push(`                Set-VMProcessor -VMName $VMCloneName -Count ${vcpu || '2'}`);
    host.push(`                Set-VMMemory    -VMName $VMCloneName -StartupBytes ${ramGo || '4'}GB`);
    host.push(`                if (-not (Get-VMSwitch -Name '${sw}' -ErrorAction SilentlyContinue)) { New-VMSwitch -Name '${sw}' -SwitchType Private }`);
    host.push(`                Connect-VMNetworkAdapter -VMName $VMCloneName -SwitchName '${sw}'`);
    host.push('                Start-VM -Name $VMCloneName');
    host.push('                Remove-Item -Path $ExportVMPath -Recurse -Force');
    host.push(`                Write-Output "Clone pret : ${vmName}"`);
    host.push('            }');
    host.push('        } else { Write-Warning "Dossier d\'export de la VM source introuvable" }');
    host.push('    } else { Write-Warning "Dossier d\'export de destination introuvable" }');
    host.push('} else { Write-Warning "Annule : une VM nommee $VMCloneName existe deja (ou nom identique a la source)" }');

    // ===== PARTIE 2 : dans la VM — réseau, pare-feu (ping), rôles, nom, appartenance =====
    const vm: string[] = [];
    vm.push('#Requires -RunAsAdministrator');
    vm.push('# ============================================================');
    vm.push(`#  A executer DANS LA VM ${vmName} (PowerShell admin)`);
    vm.push('# ============================================================');
    vm.push(`$InterfaceAlias = '${iface}'`);
    vm.push('# --- Adresse IP fixe ---');
    vm.push('Remove-NetIPAddress -InterfaceAlias $InterfaceAlias -AddressFamily IPv4 -Confirm:$false -ErrorAction SilentlyContinue');
    vm.push('Remove-NetRoute     -InterfaceAlias $InterfaceAlias -AddressFamily IPv4 -Confirm:$false -ErrorAction SilentlyContinue');
    vm.push(`New-NetIPAddress -InterfaceAlias $InterfaceAlias -IPAddress '${ip}' -PrefixLength ${cidr} -DefaultGateway '${effectiveGw}' | Out-Null`);
    vm.push(`Set-DnsClientServerAddress -InterfaceAlias $InterfaceAlias -ServerAddresses '${dns}'`);
    vm.push('# --- Pare-feu : regles personnalisees pour autoriser le ping (ICMP echo entrant) ---');
    vm.push("New-NetFirewallRule -DisplayName 'Autoriser Ping (ICMPv4 entrant)' -Protocol ICMPv4 -IcmpType 8 -Direction Inbound -Action Allow -Profile Any | Out-Null");
    vm.push("New-NetFirewallRule -DisplayName 'Autoriser Ping (ICMPv6 entrant)' -Protocol ICMPv6 -IcmpType 128 -Direction Inbound -Action Allow -Profile Any | Out-Null");
    if (type === 'SRV' && roles.length) {
      const feats = roles.map(k => ROLES.find(r => r.key === k)?.feature).filter(Boolean).join(',');
      vm.push('# --- Installation des roles ---');
      vm.push(`Install-WindowsFeature ${feats} -IncludeManagementTools`);
    }
    vm.push('# --- Renommage ---');
    vm.push(`Rename-Computer -NewName '${vmName}' -Force`);
    if (type === 'SRV' && roles.includes('AD')) {
      vm.push(`# --- Promotion en controleur de domaine (cree la foret '${domain}') ---`);
      vm.push(`Install-ADDSForest -DomainName '${domain}' -InstallDns -Force`);
    } else if (membership === 'domain') {
      vm.push(`# --- Jonction au domaine '${domain}' (demande des identifiants) ---`);
      vm.push(`Add-Computer -DomainName '${domain}' -Credential (Get-Credential) -Force`);
    } else {
      vm.push(`# --- Groupe de travail : ${workgroup} ---`);
      if (workgroup && workgroup.toUpperCase() !== 'WORKGROUP') vm.push(`Add-Computer -WorkGroupName '${workgroup}'`);
    }
    vm.push('Write-Host "Configuration appliquee. Redemarre la VM." -ForegroundColor Green');
    vm.push('Restart-Computer -Force');

    return [
      { id: 'host', title: '① Sur l’hôte Hyper-V — cloner la VM', code: host.join('\n') },
      { id: 'vm', title: '② Dans la VM — configuration', code: vm.join('\n') },
    ];
  }, [vmName, vcpu, ramGo, sw, type, roles, iface, ip, cidr, effectiveGw, dns, sourceVM, exportPath, vhdDir, membership, domain, workgroup]);

  const copy = (id: string, code: string) => {
    navigator.clipboard?.writeText(code).then(() => { setCopiedId(id); setTimeout(() => setCopiedId(''), 1800); }).catch(() => {});
  };

  // Scanne un dossier (API File System Access, Edge/Chrome) et liste les masters :
  // sous-dossiers (= noms de VM) et fichiers .vhdx (nom sans extension).
  const scanMasters = async () => {
    const picker = (window as any).showDirectoryPicker;
    if (typeof picker !== 'function') { setScanMsg('Sélection de dossier non supportée par ce navigateur (utilise Edge ou Chrome).'); return; }
    try {
      const dir = await picker.call(window, { id: 'vm-masters' });
      const found: string[] = [];
      const it = dir.values();
      for (let r = await it.next(); !r.done; r = await it.next()) {
        const h = r.value;
        if (h.kind === 'directory') found.push(h.name);
        else if (/\.vhdx$/i.test(h.name)) found.push(h.name.replace(/\.vhdx$/i, ''));
      }
      const uniq = Array.from(new Set(found)).sort((a, b) => a.localeCompare(b));
      if (!uniq.length) { setScanMsg('Aucun master trouvé (sous-dossier ou .vhdx) dans ce dossier.'); return; }
      setMasters(uniq); setManualSource(false);
      setScanMsg(`${uniq.length} master(s) trouvé(s) dans « ${dir.name} ».`);
      if (!uniq.includes(sourceVM)) setSourceVM(uniq[0]);
    } catch { setScanMsg('Scan annulé.'); }
  };

  // Télécharge une section comme script .ps1 prêt à exécuter (BOM UTF-8 pour PowerShell).
  const download = (code: string, filename: string) => {
    const blob = new Blob(['\uFEFF' + code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  if (!unlocked) {
    return (
      <div style={{ margin: '14px 0', maxWidth: 580, border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px', background: 'var(--surface-2)' }}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>⚠️ Avant d’utiliser cet outil</div>
        <aside className="pb-note pb-note-yellow" style={{ marginBottom: 14 }}>
          <p className="pb-note-title">Outil réservé aux personnes qui maîtrisent</p>
          <p>Ce configurateur génère des scripts PowerShell qui <strong>modifient la configuration système</strong> (clonage de VM, réseau, pare-feu, rôles, domaine). Une mauvaise utilisation peut <strong>casser une VM, un réseau ou un domaine</strong>. À n’utiliser que si tu maîtrises l’administration <strong>Windows Server / Hyper-V</strong>, et toujours sur un environnement de test.</p>
        </aside>
        <button type="button" onClick={unlock} style={{ padding: '10px 18px', border: 'none', borderRadius: 8, background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>Je veux utiliser l’outil</button>
      </div>
    );
  }

  return (
    <div style={{ margin: '14px 0' }}>
      <div style={rowStyle}>
        {/* Machine */}
        <div style={{ ...groupStyle, gridColumn: '1 / -1' }}>
          <div style={legendStyle}>🏷️ Machine</div>
          <div style={rowStyle}>
            <div>
              <label style={labelStyle}>Type</label>
              <select style={fieldStyle} value={type} onChange={e => setType(e.target.value as 'Client' | 'SRV')}>
                <option value="SRV">Serveur</option>
                <option value="Client">Client</option>
              </select>
            </div>
            {type === 'SRV' && (
              <div>
                <label style={labelStyle}>Rôle principal (nom)</label>
                <select style={fieldStyle} value={primaryKey} onChange={e => setPrimary(e.target.value)}>
                  {(roles.length ? roles : ['AD']).map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
            )}
            <div>
              <label style={labelStyle}>Numéro [xx]</label>
              <input style={fieldStyle} value={num} onChange={e => setNum(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="01" />
            </div>
            <div>
              <label style={labelStyle}>Nom obtenu</label>
              <input style={{ ...fieldStyle, fontFamily: 'ui-monospace,monospace', fontWeight: 700, color: 'var(--accent)' }} value={vmName} readOnly />
            </div>
          </div>
        </div>

        {/* Ressources */}
        <div style={groupStyle}>
          <div style={legendStyle}>⚙️ Ressources (hôte)</div>
          <div style={rowStyle}>
            <div>
              <label style={labelStyle}>vCPU (cœurs)</label>
              <input type="number" min={1} style={fieldStyle} value={vcpu} onChange={e => setVcpu(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>RAM (Go)</label>
              <input type="number" min={1} style={fieldStyle} value={ramGo} onChange={e => setRamGo(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Commutateur</label>
              <input style={fieldStyle} value={sw} onChange={e => setSw(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Clonage */}
        <div style={groupStyle}>
          <div style={legendStyle}>🧬 Clonage (hôte)</div>
          <div>
            <label style={labelStyle}>VM source à cloner</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {masters.length > 0 && !manualSource ? (
                <select style={fieldStyle} value={masters.includes(sourceVM) ? sourceVM : ''} onChange={e => { if (e.target.value === '__manual') { setManualSource(true); } else { setSourceVM(e.target.value); } }}>
                  {!masters.includes(sourceVM) && <option value="">— choisir un master —</option>}
                  {masters.map(m => <option key={m} value={m}>{m}</option>)}
                  <option value="__manual">✎ Saisir manuellement…</option>
                </select>
              ) : (
                <input style={fieldStyle} value={sourceVM} onChange={e => setSourceVM(e.target.value)} placeholder="Master-WS2022" />
              )}
              <button type="button" onClick={scanMasters} style={btnStyle} title="Scanner un dossier pour lister les masters (Edge / Chrome)">📁 Parcourir…</button>
            </div>
            {scanMsg && <div className="meta" style={{ fontSize: 11.5, marginTop: 4 }}>{scanMsg}</div>}
            {masters.length > 0 && manualSource && (
              <button type="button" onClick={() => setManualSource(false)} style={{ ...btnStyle, marginTop: 6, padding: '4px 10px', fontSize: 12 }}>↩ Revenir à la liste</button>
            )}
          </div>
          <div style={{ marginTop: 10 }}>
            <label style={labelStyle}>Dossier d’export temporaire</label>
            <input style={fieldStyle} value={exportPath} onChange={e => setExportPath(e.target.value)} placeholder="C:\\TEMP" />
          </div>
          <div style={{ marginTop: 10 }}>
            <label style={labelStyle}>Dossier des VM clonées</label>
            <input style={fieldStyle} value={vhdDir} onChange={e => setVhdDir(e.target.value)} placeholder="C:\\Hyper-V\\VHDs" />
          </div>
          <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>💾 Ces valeurs sont enregistrées automatiquement dans ce navigateur. Le clone est créé par Export/Import de la VM source.</div>
        </div>

        {/* Réseau */}
        <div style={groupStyle}>
          <div style={legendStyle}>🌐 Réseau</div>
          <div style={rowStyle}>
            <div>
              <label style={labelStyle}>Adresse IP</label>
              <input style={fieldStyle} value={ip} onChange={e => { setIp(e.target.value); if (gwAuto) setGw(gatewayFromIp(e.target.value) || gw); }} />
            </div>
            <div>
              <label style={labelStyle}>Masque (CIDR)</label>
              <select style={fieldStyle} value={cidr} onChange={e => setCidr(e.target.value)}>
                {Object.keys(CIDR_TO_MASK).map(c => <option key={c} value={c}>/{c} — {CIDR_TO_MASK[Number(c)]}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Passerelle {gwAuto && <span className="meta" style={{ fontWeight: 400 }}>(auto .254)</span>}</label>
              <input style={fieldStyle} value={effectiveGw} onChange={e => { setGwAuto(false); setGw(e.target.value); }} />
            </div>
            <div>
              <label style={labelStyle}>DNS préféré</label>
              <input style={fieldStyle} value={dns} onChange={e => setDns(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Carte réseau</label>
              <input style={fieldStyle} value={iface} onChange={e => setIface(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* Appartenance */}
      <div style={groupStyle}>
        <div style={legendStyle}>🔗 Appartenance</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, cursor: 'pointer' }}>
            <input type="radio" name="mem" checked={membership === 'domain'} onChange={() => setMembership('domain')} /> Domaine
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, cursor: 'pointer' }}>
            <input type="radio" name="mem" checked={membership === 'workgroup'} onChange={() => setMembership('workgroup')} /> Groupe de travail
          </label>
          {membership === 'domain'
            ? <input style={{ ...fieldStyle, maxWidth: 260 }} value={domain} onChange={e => setDomain(e.target.value)} placeholder="miyukini.lan" />
            : <input style={{ ...fieldStyle, maxWidth: 220 }} value={workgroup} onChange={e => setWorkgroup(e.target.value)} placeholder="WORKGROUP" />}
        </div>
        {type === 'SRV' && roles.includes('AD') && (
          <div className="meta" style={{ fontSize: 12, marginTop: 8 }}>ℹ️ Rôle AD coché : ce serveur <strong>créera le domaine</strong> « {domain} » (Install-ADDSForest).</div>
        )}
      </div>

      {/* Rôles */}
      {type === 'SRV' && (
        <div style={groupStyle}>
          <div style={legendStyle}>🧩 Rôles à installer</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {ROLES.map(r => (
              <label key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 999, background: roles.includes(r.key) ? 'var(--accent-light)' : 'var(--surface)', cursor: 'pointer', fontSize: 13.5 }}>
                <input type="checkbox" checked={roles.includes(r.key)} onChange={() => toggleRole(r.key)} />
                {r.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Sortie : une fenêtre de code par partie */}
      {sections.map(sec => (
        <div key={sec.id} style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 6px' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>📜 {sec.title}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => download(sec.code, `${sec.id === 'host' ? 'clone' : 'config'}-${vmName}.ps1`)} style={{ padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'transparent', color: 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }} title="Télécharger le script .ps1 prêt à exécuter (à lancer en PowerShell admin)">💾 .ps1</button>
              <button onClick={() => copy(sec.id, sec.code)} style={{ padding: '6px 14px', border: '1px solid var(--accent)', borderRadius: 8, background: copiedId === sec.id ? 'var(--accent)' : 'transparent', color: copiedId === sec.id ? '#fff' : 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                {copiedId === sec.id ? '✓ Copié' : 'Copier'}
              </button>
            </div>
          </div>
          <pre style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', overflowX: 'auto', fontSize: 12.5, lineHeight: 1.55, margin: 0 }}><code>{sec.code}</code></pre>
        </div>
      ))}
    </div>
  );
}

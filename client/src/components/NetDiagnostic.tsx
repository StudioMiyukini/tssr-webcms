import { useMemo, useState } from 'react';

/**
 * Diagnostic réseau interactif suivant le modèle OSI.
 * Saisie du contexte (IP, passerelle, DNS, cible, FQDN, port, partage) → génère un script
 * PowerShell qui teste couche par couche (bottom-up), réduit le périmètre de la panne et
 * propose des pistes. Îlot React (data-block="net-diagnostic").
 */

const f: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' };
const lb: React.CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 4 };
const grp: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface-2)', marginBottom: 14 };
const leg: React.CSSProperties = { fontWeight: 800, fontSize: 15, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 };
const row: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 };
const chip = (on: boolean): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 999, background: on ? 'var(--accent-light)' : 'var(--surface)', cursor: 'pointer', fontSize: 13 });

// Protocoles standards et leur port (test TCP via Test-NetConnection)
const PROTOCOLS: { k: string; label: string; port: number }[] = [
  { k: 'dns', label: 'DNS', port: 53 },
  { k: 'kerberos', label: 'Kerberos', port: 88 },
  { k: 'rpc', label: 'RPC', port: 135 },
  { k: 'ldap', label: 'LDAP', port: 389 },
  { k: 'smb', label: 'SMB', port: 445 },
  { k: 'ldaps', label: 'LDAPS', port: 636 },
  { k: 'gc', label: 'Catalogue global', port: 3268 },
  { k: 'rdp', label: 'RDP', port: 3389 },
  { k: 'http', label: 'HTTP', port: 80 },
  { k: 'https', label: 'HTTPS', port: 443 },
  { k: 'ftp', label: 'FTP', port: 21 },
  { k: 'ssh', label: 'SSH', port: 22 },
  { k: 'smtp', label: 'SMTP', port: 25 },
  { k: 'winrm', label: 'WinRM', port: 5985 },
];

export function NetDiagnostic() {
  const [iface, setIface] = useState('Ethernet');
  const [ip, setIp] = useState('192.168.10.101');
  const [gw, setGw] = useState('192.168.10.254');
  const [dns, setDns] = useState('192.168.10.11');
  const [target, setTarget] = useState('192.168.10.11');
  const [fqdn, setFqdn] = useState('srv-ad.miyukini.lan');
  const [protos, setProtos] = useState<string[]>(['smb', 'rdp', 'dns', 'ldap', 'kerberos']);
  const [port, setPort] = useState('');
  const [portLbl, setPortLbl] = useState('');
  const [share, setShare] = useState('\\\\SRV-AD\\Partage');
  const [hvSwitch, setHvSwitch] = useState('COM_private');
  const [t, setT] = useState({ phys: true, sw: true, ipcfg: true, fw: true, ping: true, dns: true, port: true, acc: true });
  const [copied, setCopied] = useState(false);
  const [unlocked, setUnlocked] = useState(() => { try { return sessionStorage.getItem('vmcfg_ok') === '1'; } catch { return false; } });
  const unlock = () => { setUnlocked(true); try { sessionStorage.setItem('vmcfg_ok', '1'); } catch { /* */ } };
  const tog = (k: keyof typeof t) => setT(v => ({ ...v, [k]: !v[k] }));

  const script = useMemo(() => {
    const L: string[] = [];
    L.push('# ============================================================');
    L.push('#  Diagnostic reseau (modele OSI) - genere');
    L.push('#  A executer sur la machine a diagnostiquer (PowerShell)');
    L.push('# ============================================================');
    L.push("$ErrorActionPreference = 'SilentlyContinue'");
    L.push(`$Iface  = '${iface}'`);
    L.push(`$ExpIP  = '${ip}'`);
    L.push(`$Gw     = '${gw}'`);
    L.push(`$Dns    = '${dns}'`);
    L.push(`$Target = '${target}'`);
    L.push(`$Fqdn   = '${fqdn}'`);
    L.push(`$Share  = '${share}'`);
    L.push(`$HvSwitch = '${hvSwitch}'`);
    L.push('$ok = 0; $ko = 0');
    L.push('function Step($lbl,$res,$hint){ if($res){ Write-Host ("  [OK]  {0}" -f $lbl) -ForegroundColor Green; $script:ok++ } else { Write-Host ("  [KO]  {0}" -f $lbl) -ForegroundColor Red; Write-Host ("        piste: {0}" -f $hint) -ForegroundColor DarkYellow; $script:ko++ } }');
    L.push('');
    if (t.phys) {
      L.push('Write-Host "== Couche 1 - Physique / liaison ==" -ForegroundColor Cyan');
      L.push('$ad = Get-NetAdapter -Name $Iface -ErrorAction SilentlyContinue');
      L.push('Step "Carte \'$Iface\' presente et UP" ($ad -and $ad.Status -eq \'Up\') "Cable debranche, carte desactivee, ou mauvais nom d\'interface (Get-NetAdapter)"');
      L.push('if($ad){ Write-Host ("        lien: {0}" -f $ad.LinkSpeed) -ForegroundColor DarkGray }');
      L.push('');
    }
    if (t.sw) {
      L.push('Write-Host "== Hyper-V - commutateurs des VM (a executer sur l\'HOTE) ==" -ForegroundColor Cyan');
      L.push('if(Get-Command Get-VM -ErrorAction SilentlyContinue){');
      L.push('  Step "Commutateur \'$HvSwitch\' present" ([bool](Get-VMSwitch -Name $HvSwitch -ErrorAction SilentlyContinue)) "Commutateur absent -> New-VMSwitch -Name \'$HvSwitch\' -SwitchType Private"');
      L.push('  $sw = Get-VMSwitch -Name $HvSwitch -ErrorAction SilentlyContinue');
      L.push('  if($sw){ Step "\'$HvSwitch\' est de type Prive/Interne" ($sw.SwitchType -in \'Private\',\'Internal\') ("Type actuel: {0} -> pour un labo isole, utiliser Private" -f $sw.SwitchType) }');
      L.push('  foreach($a in (Get-VM | Get-VMNetworkAdapter)){ Step ("VM \'{0}\' -> commutateur \'{1}\'" -f $a.VMName,$a.SwitchName) ($a.SwitchName -eq $HvSwitch) ("VM \'{0}\' connectee a \'{1}\' au lieu de \'{2}\' (ou deconnectee) -> Connect-VMNetworkAdapter -VMName \'{0}\' -SwitchName \'{2}\'" -f $a.VMName,$a.SwitchName,$HvSwitch) }');
      L.push('} else { Write-Host "  (module Hyper-V absent : cette partie se lance sur l\'HOTE Hyper-V, pas dans la VM)" -ForegroundColor DarkGray }');
      L.push('');
    }
    if (t.ipcfg) {
      L.push('Write-Host "== Couche 3 - Configuration IP ==" -ForegroundColor Cyan');
      L.push('$cfg = Get-NetIPConfiguration -InterfaceAlias $Iface -ErrorAction SilentlyContinue');
      L.push('$curIP = $cfg.IPv4Address.IPAddress');
      L.push('Step "Adresse IP presente (pas d\'APIPA 169.254.x)" ($curIP -and $curIP -notlike \'169.254.*\') "Pas de bail DHCP / IP auto-attribuee -> verifier le DHCP ou poser une IP fixe"');
      L.push('if($ExpIP){ Step "IP = $ExpIP" ($curIP -eq $ExpIP) "IP obtenue = $curIP (differente de l\'attendu)" }');
      L.push('Step "Passerelle configuree" ([bool]$cfg.IPv4DefaultGateway) "Aucune passerelle -> pas de sortie du reseau local"');
      L.push('Step "Serveur DNS configure" ([bool]$cfg.DNSServer.ServerAddresses) "Aucun DNS -> resolution de noms impossible (pointer sur $Dns)"');
      L.push('');
    }
    if (t.fw) {
      L.push('Write-Host "== Pare-feu - ping (ICMP entrant) ==" -ForegroundColor Cyan');
      L.push('$fw = Get-NetFirewallRule -Name FPS-ICMP4-ERQ-In -ErrorAction SilentlyContinue');
      L.push('Step "Regle de ping ICMPv4 entrant activee (cette machine)" ($fw -and $fw.Enabled -eq \'True\') "Le pare-feu bloque le ping entrant -> activer la regle (voir astuce pare-feu/ping)"');
      L.push('');
    }
    if (t.ping) {
      L.push('Write-Host "== Couche 3 - Connectivite (ping) ==" -ForegroundColor Cyan');
      L.push('Step "Loopback 127.0.0.1" (Test-Connection 127.0.0.1 -Count 1 -Quiet) "Pile TCP/IP en echec (rare) -> redemarrer / reinstaller la carte"');
      L.push('if($curIP){ Step "Soi-meme ($curIP)" (Test-Connection $curIP -Count 1 -Quiet) "Config IP locale incoherente" }');
      L.push('if($Gw){ Step "Passerelle ($Gw)" (Test-Connection $Gw -Count 1 -Quiet) "Passerelle injoignable -> cable/switch/VLAN ou mauvaise IP/masque" }');
      L.push('if($Dns){ Step "Serveur DNS ($Dns)" (Test-Connection $Dns -Count 1 -Quiet) "Serveur DNS injoignable sur le reseau" }');
      L.push('if($Target){ Step "Cible ($Target)" (Test-Connection $Target -Count 1 -Quiet) "Cible injoignable -> reseau OU pare-feu (ping) de la cible" }');
      L.push('');
    }
    if (t.dns) {
      L.push('Write-Host "== Couche 7 - Resolution DNS ==" -ForegroundColor Cyan');
      L.push('if($Fqdn){ $r = Resolve-DnsName $Fqdn -ErrorAction SilentlyContinue; Step "Resolution de $Fqdn" ([bool]$r) "DNS ne resout pas -> mauvais serveur DNS ou enregistrement A manquant"; if($r){ Write-Host ("        -> " + (($r | Where-Object IPAddress | Select-Object -First 1).IPAddress)) -ForegroundColor DarkGray } }');
      L.push('');
    }
    const selP = PROTOCOLS.filter(p => protos.includes(p.k));
    if (t.port && (selP.length || Number(port) > 0)) {
      L.push('Write-Host "== Couche 4 - Services / protocoles (ports TCP) ==" -ForegroundColor Cyan');
      L.push('if($Target){');
      L.push('  $ports = @(');
      selP.forEach(p => L.push(`    @{ n = '${p.label}'; p = ${p.port} },`));
      if (Number(port) > 0) L.push(`    @{ n = '${(portLbl || 'Personnalise').replace(/'/g, ' ')}'; p = ${Number(port)} },`);
      L.push('  )');
      L.push('  foreach($s in $ports){ $tc = Test-NetConnection $Target -Port $s.p -WarningAction SilentlyContinue; Step ("{0} (port {1}) sur $Target" -f $s.n,$s.p) ($tc.TcpTestSucceeded) ("{0} injoignable : service arrete OU pare-feu de la cible bloque le port {1} (test TCP)" -f $s.n,$s.p) }');
      L.push('} else { Write-Host "  (cible non renseignee, tests de ports ignores)" -ForegroundColor DarkGray }');
      L.push('');
    }
    if (t.acc) {
      L.push('Write-Host "== Couche 7 - Acces / autorisations ==" -ForegroundColor Cyan');
      L.push('if($Share){ Step "Acces au partage $Share" (Test-Path $Share) "Partage inexistant, droits de Partage/NTFS insuffisants, ou session non authentifiee -> voir cours Permissions" }');
      L.push('Step "Identite courante recuperable" ([bool](whoami)) "Contexte utilisateur indisponible"');
      L.push('Write-Host ("        connecte en: " + (whoami)) -ForegroundColor DarkGray');
      L.push('');
    }
    L.push('Write-Host ""');
    L.push('if($ko -eq 0){ Write-Host ("RESULTAT : tout est OK ({0} verifications passees)." -f $ok) -ForegroundColor Green }');
    L.push('else { Write-Host ("RESULTAT : {0} probleme(s), {1} OK. Corrige la 1ere couche en echec EN PREMIER (de bas en haut)." -f $ko,$ok) -ForegroundColor Yellow }');
    return L.join('\n');
  }, [iface, ip, gw, dns, target, fqdn, protos, port, portLbl, share, hvSwitch, t]);

  const copy = () => { navigator.clipboard?.writeText(script).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => {}); };

  if (!unlocked) {
    return (
      <div style={{ margin: '14px 0', maxWidth: 580, border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px', background: 'var(--surface-2)' }}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 10 }}>⚠️ Avant d’utiliser cet outil</div>
        <aside className="pb-note pb-note-yellow" style={{ marginBottom: 14 }}>
          <p className="pb-note-title">Outil de diagnostic</p>
          <p>Ce script ne fait que <strong>tester et lire</strong> l’état réseau (il ne modifie rien). À exécuter sur la machine à dépanner, avec les <strong>données de ton contexte</strong>.</p>
        </aside>
        <button type="button" onClick={unlock} style={{ padding: '10px 18px', border: 'none', borderRadius: 8, background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>Je veux utiliser l’outil</button>
      </div>
    );
  }

  return (
    <div style={{ margin: '14px 0' }}>
      <div style={grp}>
        <div style={leg}>🧩 Contexte réseau</div>
        <div style={row}>
          <div><label style={lb}>Carte réseau</label><input style={f} value={iface} onChange={e => setIface(e.target.value)} /></div>
          <div><label style={lb}>IP locale attendue</label><input style={f} value={ip} onChange={e => setIp(e.target.value)} /></div>
          <div><label style={lb}>Passerelle</label><input style={f} value={gw} onChange={e => setGw(e.target.value)} /></div>
          <div><label style={lb}>Serveur DNS</label><input style={f} value={dns} onChange={e => setDns(e.target.value)} /></div>
          <div><label style={lb}>Cible à joindre (IP/nom)</label><input style={f} value={target} onChange={e => setTarget(e.target.value)} /></div>
          <div><label style={lb}>Nom à résoudre (FQDN)</label><input style={f} value={fqdn} onChange={e => setFqdn(e.target.value)} /></div>
          <div><label style={lb}>Commutateur Hyper-V attendu</label><input style={f} value={hvSwitch} onChange={e => setHvSwitch(e.target.value)} placeholder="COM_private" /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={lb}>Chemin de partage à tester</label><input style={{ ...f, fontFamily: 'ui-monospace,monospace' }} value={share} onChange={e => setShare(e.target.value)} /></div>
        </div>
      </div>

      <div style={grp}>
        <div style={leg}>🔌 Protocoles / ports à tester <span className="meta" style={{ fontWeight: 400, fontSize: 12 }}>(sur la cible · test TCP)</span></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PROTOCOLS.map(p => (
            <label key={p.k} style={chip(protos.includes(p.k))}>
              <input type="checkbox" checked={protos.includes(p.k)} onChange={() => setProtos(v => v.includes(p.k) ? v.filter(x => x !== p.k) : [...v, p.k])} />
              {p.label} <span className="meta" style={{ fontSize: 11 }}>:{p.port}</span>
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap', alignItems: 'end' }}>
          <div style={{ maxWidth: 140 }}><label style={lb}>Port perso.</label><input style={f} value={port} onChange={e => setPort(e.target.value.replace(/\D/g, ''))} placeholder="ex. 8080" /></div>
          <div style={{ maxWidth: 220 }}><label style={lb}>Libellé du port perso.</label><input style={f} value={portLbl} onChange={e => setPortLbl(e.target.value)} placeholder="ex. Application interne" /></div>
        </div>
      </div>

      <div style={grp}>
        <div style={leg}>🧪 Vérifications à inclure <span className="meta" style={{ fontWeight: 400, fontSize: 12 }}>(du bas vers le haut du modèle OSI)</span></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
          {([['phys', '① Physique'], ['sw', '🔀 Commutateurs VM'], ['ipcfg', '③ Config IP'], ['fw', '🧱 Pare-feu (ping)'], ['ping', '③ Pings'], ['dns', '⑦ DNS'], ['port', '④ Protocoles/ports'], ['acc', '⑦ Accès / partage']] as [keyof typeof t, string][]).map(([k, label]) => (
            <label key={k} style={chip(t[k])}><input type="checkbox" checked={t[k]} onChange={() => tog(k)} />{label}</label>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 6px' }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>📜 Script de diagnostic</div>
        <button onClick={copy} style={{ padding: '6px 14px', border: '1px solid var(--accent)', borderRadius: 8, background: copied ? 'var(--accent)' : 'transparent', color: copied ? '#fff' : 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>{copied ? '✓ Copié' : 'Copier'}</button>
      </div>
      <pre style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', overflowX: 'auto', fontSize: 12.5, lineHeight: 1.5, margin: 0, maxHeight: 460 }}><code>{script}</code></pre>
    </div>
  );
}

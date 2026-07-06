import { useEffect, useMemo, useState } from 'react';

/**
 * Générateur de configuration SSH pour équipement Cisco (routeur ou switch) dans Packet Tracer.
 * Îlot React hydraté via RichContent (data-block="ssh-configurator").
 */

const CIDR_TO_MASK: Record<number, string> = {
  8: '255.0.0.0', 16: '255.255.0.0', 24: '255.255.255.0', 25: '255.255.255.128', 26: '255.255.255.192',
  27: '255.255.255.224', 28: '255.255.255.240', 29: '255.255.255.248', 30: '255.255.255.252',
};
const CIDRS = Object.keys(CIDR_TO_MASK).map(Number);
const load = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };

const fieldStyle: React.CSSProperties = { width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13.5, boxSizing: 'border-box' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 4 };
const groupStyle: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface-2)', marginBottom: 14 };
const legendStyle: React.CSSProperties = { fontWeight: 700, fontSize: 14, marginBottom: 10 };
const mono: React.CSSProperties = { fontFamily: 'ui-monospace,monospace' };

export function SshConfigurator() {
  const [type, setType] = useState<'router' | 'switch'>(() => load('ssh_type', 'router'));
  const [hostname, setHostname] = useState(() => load('ssh_host', 'R1'));
  const [domain, setDomain] = useState(() => load('ssh_domain', 'miyukini.lan'));
  const [user, setUser] = useState(() => load('ssh_user', 'admin'));
  const [secret, setSecret] = useState(() => load('ssh_secret', 'Azerty77'));
  const [ena, setEna] = useState(() => load('ssh_ena', ''));
  const [bits, setBits] = useState(() => load('ssh_bits', '1024'));
  const [ver, setVer] = useState(() => load('ssh_ver', '2'));
  const [ip, setIp] = useState(() => load('ssh_ip', '192.168.10.2'));
  const [cidr, setCidr] = useState(() => load('ssh_cidr', 24));
  const [vlan, setVlan] = useState(() => load('ssh_vlan', '1'));
  const [gw, setGw] = useState(() => load('ssh_gw', '192.168.10.254'));
  const [copied, setCopied] = useState(false);

  useEffect(() => { try {
    const s = { ssh_type: type, ssh_host: hostname, ssh_domain: domain, ssh_user: user, ssh_secret: secret, ssh_ena: ena, ssh_bits: bits, ssh_ver: ver, ssh_ip: ip, ssh_cidr: cidr, ssh_vlan: vlan, ssh_gw: gw };
    Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
  } catch { /* */ } }, [type, hostname, domain, user, secret, ena, bits, ver, ip, cidr, vlan, gw]);

  const cli = useMemo(() => {
    const o: string[] = ['enable', 'configure terminal'];
    o.push(`hostname ${hostname || 'R1'}`);
    o.push(`ip domain-name ${domain || 'domaine.local'}`);
    if (type === 'switch') {
      o.push(`interface vlan ${vlan || '1'}`);
      o.push(`ip address ${ip || '192.168.1.2'} ${CIDR_TO_MASK[cidr] || '255.255.255.0'}`);
      o.push('no shutdown');
      o.push('exit');
      o.push(`ip default-gateway ${gw || '192.168.1.254'}`);
    }
    o.push(`username ${user || 'admin'} privilege 15 secret ${secret || 'MotDePasse'}`);
    if (ena.trim()) o.push(`enable secret ${ena.trim()}`);
    o.push('crypto key generate rsa');
    o.push(bits || '1024');
    o.push(`ip ssh version ${ver}`);
    o.push('line vty 0 4');
    o.push('transport input ssh');
    o.push('login local');
    o.push('end');
    o.push('write memory');
    return o.join('\n');
  }, [type, hostname, domain, user, secret, ena, bits, ver, ip, cidr, vlan, gw]);

  const copy = () => { navigator.clipboard?.writeText(cli).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }).catch(() => {}); };
  const download = () => {
    const blob = new Blob([cli], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `ssh-${(hostname || 'device').replace(/[^A-Za-z0-9_-]/g, '')}.txt`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  return (
    <div style={{ margin: '14px 0' }}>
      <div style={groupStyle}>
        <div style={legendStyle}>🔑 Générateur SSH</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {(['router', 'switch'] as const).map(t => (
            <button key={t} type="button" onClick={() => setType(t)} style={{ padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 8, background: type === t ? 'var(--accent)' : 'var(--surface)', color: type === t ? '#fff' : 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: 13.5 }}>{t === 'router' ? '🧭 Routeur' : '🔀 Switch'}</button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
          <div><label style={labelStyle}>Hostname</label><input style={fieldStyle} value={hostname} onChange={e => setHostname(e.target.value.replace(/\s+/g, ''))} placeholder="R1" /></div>
          <div><label style={labelStyle}>Nom de domaine</label><input style={fieldStyle} value={domain} onChange={e => setDomain(e.target.value)} placeholder="miyukini.lan" /></div>
          <div><label style={labelStyle}>Utilisateur</label><input style={fieldStyle} value={user} onChange={e => setUser(e.target.value)} placeholder="admin" /></div>
          <div><label style={labelStyle}>Mot de passe (secret)</label><input style={fieldStyle} value={secret} onChange={e => setSecret(e.target.value)} placeholder="Azerty77" /></div>
          <div><label style={labelStyle}>Enable secret (optionnel)</label><input style={fieldStyle} value={ena} onChange={e => setEna(e.target.value)} placeholder="(vide = aucun)" /></div>
          <div><label style={labelStyle}>Longueur clé RSA</label><select style={fieldStyle} value={bits} onChange={e => setBits(e.target.value)}><option value="1024">1024</option><option value="2048">2048</option></select></div>
          <div><label style={labelStyle}>Version SSH</label><select style={fieldStyle} value={ver} onChange={e => setVer(e.target.value)}><option value="2">2</option><option value="1">1</option></select></div>
        </div>
        {type === 'switch' && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--border)' }}>
            <div className="meta" style={{ fontSize: 12, marginBottom: 8 }}>IP de gestion du switch (niveau 2 → sur une interface VLAN) :</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12 }}>
              <div><label style={labelStyle}>VLAN de gestion</label><input style={fieldStyle} value={vlan} onChange={e => setVlan(e.target.value.replace(/\D/g, '') || '1')} placeholder="1" /></div>
              <div><label style={labelStyle}>IP de gestion</label><input style={{ ...fieldStyle, ...mono }} value={ip} onChange={e => setIp(e.target.value)} placeholder="192.168.10.2" /></div>
              <div><label style={labelStyle}>Masque (CIDR)</label><select style={fieldStyle} value={cidr} onChange={e => setCidr(Number(e.target.value))}>{CIDRS.map(c => <option key={c} value={c}>/{c} — {CIDR_TO_MASK[c]}</option>)}</select></div>
              <div><label style={labelStyle}>Passerelle (default-gateway)</label><input style={{ ...fieldStyle, ...mono }} value={gw} onChange={e => setGw(e.target.value)} placeholder="192.168.10.254" /></div>
            </div>
          </div>
        )}
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 6px' }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>📟 Configuration CLI (à coller)</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={download} style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'transparent', color: 'var(--text-soft)', fontWeight: 600, cursor: 'pointer', fontSize: 12.5 }} title="Télécharger .txt">💾 .txt</button>
            <button onClick={copy} style={{ padding: '6px 14px', border: '1px solid var(--accent)', borderRadius: 8, background: copied ? 'var(--accent)' : 'transparent', color: copied ? '#fff' : 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>{copied ? '✓ Copié' : 'Copier'}</button>
          </div>
        </div>
        <pre style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', overflowX: 'auto', fontSize: 12.5, lineHeight: 1.5, margin: 0, ...mono }}><code>{cli}</code></pre>
        <div className="meta" style={{ fontSize: 11.5, marginTop: 6 }}>Le <code>1024</code> seul est la réponse à la question de longueur de clé posée par <code>crypto key generate rsa</code> (à coller tel quel).</div>
      </div>
    </div>
  );
}

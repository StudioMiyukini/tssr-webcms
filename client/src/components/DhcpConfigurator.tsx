import { useEffect, useMemo, useState } from 'react';

/**
 * Générateur de configuration DHCP pour routeur Cisco (Packet Tracer) : pools (étendues) avec
 * réseau, passerelle, DNS, domaine, bail, et adresses exclues → config CLI IOS prête à coller.
 * Îlot React hydraté via RichContent (data-block="dhcp-configurator").
 */

const CIDR_TO_MASK: Record<number, string> = {
  8: '255.0.0.0', 16: '255.255.0.0', 22: '255.255.252.0', 23: '255.255.254.0', 24: '255.255.255.0',
  25: '255.255.255.128', 26: '255.255.255.192', 27: '255.255.255.224', 28: '255.255.255.240', 29: '255.255.255.248', 30: '255.255.255.252',
};
const CIDRS = Object.keys(CIDR_TO_MASK).map(Number);
const load = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };

type Pool = { name: string; net: string; cidr: number; gw: string; dns: string; domain: string; lease: string };
type Excl = { from: string; to: string };

const fieldStyle: React.CSSProperties = { width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13.5, boxSizing: 'border-box' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 4 };
const groupStyle: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface-2)', marginBottom: 14 };
const legendStyle: React.CSSProperties = { fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const btnStyle: React.CSSProperties = { padding: '6px 11px', border: '1px solid var(--accent)', borderRadius: 8, background: 'transparent', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 12.5, whiteSpace: 'nowrap' };
const smallBtn: React.CSSProperties = { ...btnStyle, padding: '3px 9px', fontSize: 12, borderColor: 'var(--border)', color: 'var(--text-soft)' };
const mono: React.CSSProperties = { fontFamily: 'ui-monospace,monospace' };

const D_POOLS: Pool[] = [{ name: 'LAN', net: '192.168.10.0', cidr: 24, gw: '192.168.10.254', dns: '192.168.10.1', domain: 'miyukini.lan', lease: '8' }];
const D_EXCL: Excl[] = [{ from: '192.168.10.1', to: '192.168.10.10' }];

export function DhcpConfigurator() {
  const [pools, setPools] = useState<Pool[]>(() => load('dhcp_pools', D_POOLS));
  const [excl, setExcl] = useState<Excl[]>(() => load('dhcp_excl', D_EXCL));
  const [copied, setCopied] = useState(false);

  useEffect(() => { try { localStorage.setItem('dhcp_pools', JSON.stringify(pools)); localStorage.setItem('dhcp_excl', JSON.stringify(excl)); } catch { /* */ } }, [pools, excl]);

  const mask = (c: number) => CIDR_TO_MASK[c] || '255.255.255.0';

  const cli = useMemo(() => {
    const o: string[] = [];
    o.push('enable');
    o.push('configure terminal');
    const ex = excl.filter(e => e.from.trim());
    if (ex.length) {
      o.push('! Adresses reservees (exclues du DHCP : passerelle, serveurs, imprimantes...)');
      for (const e of ex) o.push(`ip dhcp excluded-address ${e.from.trim()}${e.to.trim() ? ' ' + e.to.trim() : ''}`);
      o.push('!');
    }
    for (const p of pools) {
      o.push(`ip dhcp pool ${p.name || 'POOL'}`);
      if (p.net.trim()) o.push(` network ${p.net.trim()} ${mask(p.cidr)}`);
      if (p.gw.trim()) o.push(` default-router ${p.gw.trim()}`);
      if (p.dns.trim()) o.push(` dns-server ${p.dns.trim()}`);
      if (p.domain.trim()) o.push(` domain-name ${p.domain.trim()}`);
      if (p.lease.trim() && p.lease.trim() !== '0') o.push(` lease ${p.lease.trim()}`);
      o.push(' exit');
      o.push('!');
    }
    o.push('end');
    o.push('write memory');
    return o.join('\n');
  }, [pools, excl]);

  const copy = () => { navigator.clipboard?.writeText(cli).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }).catch(() => {}); };
  const download = () => {
    const blob = new Blob([cli], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = 'dhcp-config.txt'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const setP = (i: number, p: Partial<Pool>) => setPools(a => a.map((x, k) => k === i ? { ...x, ...p } : x));
  const addP = () => setPools(a => [...a, { name: `POOL${a.length + 1}`, net: '', cidr: 24, gw: '', dns: '', domain: '', lease: '8' }]);
  const delP = (i: number) => setPools(a => a.filter((_, k) => k !== i));
  const setE = (i: number, p: Partial<Excl>) => setExcl(a => a.map((x, k) => k === i ? { ...x, ...p } : x));
  const addE = () => setExcl(a => [...a, { from: '', to: '' }]);
  const delE = (i: number) => setExcl(a => a.filter((_, k) => k !== i));

  return (
    <div style={{ margin: '14px 0' }}>
      <div style={groupStyle}>
        <div style={legendStyle}>📶 Étendues DHCP (pools)</div>
        {pools.map((p, i) => (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 8, background: 'var(--surface)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <div><label style={labelStyle}>Nom du pool</label><input style={fieldStyle} value={p.name} onChange={e => setP(i, { name: e.target.value.replace(/\s+/g, '') })} placeholder="LAN" /></div>
              <button style={{ ...smallBtn, alignSelf: 'end' }} onClick={() => delP(i)}>✕ pool</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8 }}>
              <div><label style={labelStyle}>Réseau</label><input style={{ ...fieldStyle, ...mono }} value={p.net} onChange={e => setP(i, { net: e.target.value })} placeholder="192.168.10.0" /></div>
              <div><label style={labelStyle}>Masque (CIDR)</label><select style={fieldStyle} value={p.cidr} onChange={e => setP(i, { cidr: Number(e.target.value) })}>{CIDRS.map(c => <option key={c} value={c}>/{c} — {CIDR_TO_MASK[c]}</option>)}</select></div>
              <div><label style={labelStyle}>Passerelle (default-router)</label><input style={{ ...fieldStyle, ...mono }} value={p.gw} onChange={e => setP(i, { gw: e.target.value })} placeholder="192.168.10.254" /></div>
              <div><label style={labelStyle}>DNS (dns-server)</label><input style={{ ...fieldStyle, ...mono }} value={p.dns} onChange={e => setP(i, { dns: e.target.value })} placeholder="192.168.10.1" /></div>
              <div><label style={labelStyle}>Domaine (optionnel)</label><input style={fieldStyle} value={p.domain} onChange={e => setP(i, { domain: e.target.value })} placeholder="miyukini.lan" /></div>
              <div><label style={labelStyle}>Bail (jours)</label><input style={fieldStyle} type="number" min={0} value={p.lease} onChange={e => setP(i, { lease: e.target.value })} placeholder="8" /></div>
            </div>
          </div>
        ))}
        <button style={btnStyle} onClick={addP}>+ Pool</button>
      </div>

      <div style={groupStyle}>
        <div style={legendStyle}>🚫 Adresses exclues <span className="meta" style={{ fontWeight: 400, fontSize: 12 }}>— passerelle, serveurs, imprimantes… (non distribuées)</span></div>
        {excl.map((e, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 7, alignItems: 'center' }}>
            <input style={{ ...fieldStyle, ...mono }} value={e.from} onChange={ev => setE(i, { from: ev.target.value })} placeholder="Début (192.168.10.1)" />
            <input style={{ ...fieldStyle, ...mono }} value={e.to} onChange={ev => setE(i, { to: ev.target.value })} placeholder="Fin (192.168.10.10)" />
            <button style={smallBtn} onClick={() => delE(i)}>✕</button>
          </div>
        ))}
        <button style={btnStyle} onClick={addE}>+ Plage exclue</button>
      </div>

      <div style={{ marginTop: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 6px' }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>📟 Configuration CLI (routeur DHCP)</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={download} style={{ ...smallBtn, padding: '6px 12px' }} title="Télécharger .txt">💾 .txt</button>
            <button onClick={copy} style={{ padding: '6px 14px', border: '1px solid var(--accent)', borderRadius: 8, background: copied ? 'var(--accent)' : 'transparent', color: copied ? '#fff' : 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>{copied ? '✓ Copié' : 'Copier'}</button>
          </div>
        </div>
        <pre style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', overflowX: 'auto', fontSize: 12.5, lineHeight: 1.5, margin: 0, ...mono }}><code>{cli}</code></pre>
        <div className="meta" style={{ fontSize: 11.5, marginTop: 6 }}>À coller dans la <strong>CLI du routeur</strong>. Si le routeur n’est pas dans le même réseau que les clients, ajouter <code>ip helper-address &lt;IP du DHCP&gt;</code> sur l’interface côté clients (relais DHCP).</div>
      </div>
    </div>
  );
}

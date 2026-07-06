import { useEffect, useMemo, useState } from 'react';

/**
 * Configurateur de routeur Cisco (Packet Tracer) : hostname, interfaces (IP fixe + activation,
 * clock rate côté DCE pour les liaisons série) et routes statiques → génère la config CLI IOS
 * prête à coller. Îlot React hydraté via RichContent (data-block="router-configurator").
 */

const CIDR_TO_MASK: Record<number, string> = {
  8: '255.0.0.0', 16: '255.255.0.0', 22: '255.255.252.0', 23: '255.255.254.0', 24: '255.255.255.0',
  25: '255.255.255.128', 26: '255.255.255.192', 27: '255.255.255.224', 28: '255.255.255.240',
  29: '255.255.255.248', 30: '255.255.255.252', 32: '255.255.255.255',
};
const CIDRS = Object.keys(CIDR_TO_MASK).map(Number);
const IFACES = ['GigabitEthernet0/0', 'GigabitEthernet0/1', 'GigabitEthernet0/2', 'FastEthernet0/0', 'FastEthernet0/1', 'Serial0/0/0', 'Serial0/0/1', 'Serial0/1/0', 'Serial0/1/1'];

type Iface = { name: string; ip: string; cidr: number; desc: string; up: boolean; dce: boolean };
type Route = { net: string; cidr: number; hop: string };

const uid = (p: string) => p + Math.random().toString(36).slice(2, 7);
const load = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };

const fieldStyle: React.CSSProperties = { width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13.5, boxSizing: 'border-box' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 4 };
const groupStyle: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface-2)', marginBottom: 14 };
const legendStyle: React.CSSProperties = { fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const btnStyle: React.CSSProperties = { padding: '6px 11px', border: '1px solid var(--accent)', borderRadius: 8, background: 'transparent', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 12.5, whiteSpace: 'nowrap' };
const smallBtn: React.CSSProperties = { ...btnStyle, padding: '3px 9px', fontSize: 12, borderColor: 'var(--border)', color: 'var(--text-soft)' };

const D_IFACES: Iface[] = [
  { name: 'GigabitEthernet0/0', ip: '192.168.10.254', cidr: 24, desc: 'LAN', up: true, dce: false },
  { name: 'Serial0/0/0', ip: '10.0.0.1', cidr: 30, desc: 'WAN vers R2', up: true, dce: true },
];
const D_ROUTES: Route[] = [{ net: '192.168.20.0', cidr: 24, hop: '10.0.0.2' }];

export function RouterConfigurator() {
  const [hostname, setHostname] = useState(() => load('router_host', 'R1'));
  const [ifaces, setIfaces] = useState<Iface[]>(() => load('router_ifaces', D_IFACES));
  const [routes, setRoutes] = useState<Route[]>(() => load('router_routes', D_ROUTES));
  const [defRoute, setDefRoute] = useState(() => load('router_defroute', ''));
  const [copied, setCopied] = useState(false);

  useEffect(() => { try {
    localStorage.setItem('router_host', JSON.stringify(hostname)); localStorage.setItem('router_ifaces', JSON.stringify(ifaces));
    localStorage.setItem('router_routes', JSON.stringify(routes)); localStorage.setItem('router_defroute', JSON.stringify(defRoute));
  } catch { /* */ } }, [hostname, ifaces, routes, defRoute]);

  const mask = (c: number) => CIDR_TO_MASK[c] || '255.255.255.0';
  const isSerial = (n: string) => /^Serial/i.test(n);

  const cli = useMemo(() => {
    const o: string[] = [];
    o.push('enable');
    o.push('configure terminal');
    o.push(`hostname ${hostname || 'R1'}`);
    o.push('no ip domain-lookup');
    o.push('!');
    for (const i of ifaces) {
      o.push(`interface ${i.name}`);
      if (i.desc.trim()) o.push(` description ${i.desc.trim()}`);
      if (i.ip.trim()) o.push(` ip address ${i.ip.trim()} ${mask(i.cidr)}`);
      if (isSerial(i.name) && i.dce) o.push(' clock rate 64000');
      o.push(i.up ? ' no shutdown' : ' shutdown');
      o.push(' exit');
      o.push('!');
    }
    for (const r of routes) if (r.net.trim() && r.hop.trim()) o.push(`ip route ${r.net.trim()} ${mask(r.cidr)} ${r.hop.trim()}`);
    if (defRoute.trim()) o.push(`ip route 0.0.0.0 0.0.0.0 ${defRoute.trim()}`);
    if (routes.length || defRoute.trim()) o.push('!');
    o.push('end');
    o.push('write memory');
    return o.join('\n');
  }, [hostname, ifaces, routes, defRoute]);

  const copy = () => { navigator.clipboard?.writeText(cli).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }).catch(() => {}); };
  const download = () => {
    const blob = new Blob([cli], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `config-${(hostname || 'R1').replace(/[^A-Za-z0-9_-]/g, '')}.txt`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const setIf = (idx: number, p: Partial<Iface>) => setIfaces(a => a.map((x, i) => i === idx ? { ...x, ...p } : x));
  const addIf = () => setIfaces(a => [...a, { name: IFACES.find(n => !a.some(x => x.name === n)) || 'GigabitEthernet0/0', ip: '', cidr: 24, desc: '', up: true, dce: false }]);
  const delIf = (idx: number) => setIfaces(a => a.filter((_, i) => i !== idx));
  const setRt = (idx: number, p: Partial<Route>) => setRoutes(a => a.map((x, i) => i === idx ? { ...x, ...p } : x));
  const addRt = () => setRoutes(a => [...a, { net: '', cidr: 24, hop: '' }]);
  const delRt = (idx: number) => setRoutes(a => a.filter((_, i) => i !== idx));

  return (
    <div style={{ margin: '14px 0' }}>
      <div style={groupStyle}>
        <div style={legendStyle}>🧭 Routeur</div>
        <div style={{ maxWidth: 260 }}>
          <label style={labelStyle}>Nom (hostname)</label>
          <input style={fieldStyle} value={hostname} onChange={e => setHostname(e.target.value.replace(/\s+/g, ''))} placeholder="R1" />
        </div>
      </div>

      <div style={groupStyle}>
        <div style={legendStyle}>🔌 Interfaces <span className="meta" style={{ fontWeight: 400, fontSize: 12 }}>— IP fixe + activation ; clock rate côté DCE (série)</span></div>
        {ifaces.map((i, idx) => (
          <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 8, background: 'var(--surface)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.2fr 1fr auto', gap: 8, alignItems: 'center' }}>
              <select style={fieldStyle} value={i.name} onChange={e => setIf(idx, { name: e.target.value })}>
                {IFACES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <input style={{ ...fieldStyle, fontFamily: 'ui-monospace,monospace' }} value={i.ip} onChange={e => setIf(idx, { ip: e.target.value })} placeholder="192.168.10.254" />
              <select style={fieldStyle} value={i.cidr} onChange={e => setIf(idx, { cidr: Number(e.target.value) })}>
                {CIDRS.map(c => <option key={c} value={c}>/{c} — {CIDR_TO_MASK[c]}</option>)}
              </select>
              <button style={smallBtn} onClick={() => delIf(idx)}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
              <input style={{ ...fieldStyle, maxWidth: 260 }} value={i.desc} onChange={e => setIf(idx, { desc: e.target.value })} placeholder="Description (ex. LAN Compta)" />
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}><input type="checkbox" checked={i.up} onChange={e => setIf(idx, { up: e.target.checked })} /> activée (no shutdown)</label>
              {isSerial(i.name) && <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, cursor: 'pointer' }} title="Côté DCE d'une liaison série : impose l'horloge (clock rate)"><input type="checkbox" checked={i.dce} onChange={e => setIf(idx, { dce: e.target.checked })} /> DCE (clock rate)</label>}
            </div>
          </div>
        ))}
        <button style={btnStyle} onClick={addIf}>+ Interface</button>
      </div>

      <div style={groupStyle}>
        <div style={legendStyle}>🛣️ Routes statiques</div>
        {routes.map((r, idx) => (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1.3fr auto', gap: 8, marginBottom: 7, alignItems: 'center' }}>
            <input style={{ ...fieldStyle, fontFamily: 'ui-monospace,monospace' }} value={r.net} onChange={e => setRt(idx, { net: e.target.value })} placeholder="Réseau (192.168.20.0)" />
            <select style={fieldStyle} value={r.cidr} onChange={e => setRt(idx, { cidr: Number(e.target.value) })}>
              {CIDRS.map(c => <option key={c} value={c}>/{c}</option>)}
            </select>
            <input style={{ ...fieldStyle, fontFamily: 'ui-monospace,monospace' }} value={r.hop} onChange={e => setRt(idx, { hop: e.target.value })} placeholder="Prochain saut (10.0.0.2)" />
            <button style={smallBtn} onClick={() => delRt(idx)}>✕</button>
          </div>
        ))}
        <button style={btnStyle} onClick={addRt}>+ Route statique</button>
        <div style={{ marginTop: 10, borderTop: '1px dashed var(--border)', paddingTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={labelStyle} htmlFor="defr">Route par défaut (0.0.0.0/0) — prochain saut :</label>
          <input id="defr" style={{ ...fieldStyle, maxWidth: 220, fontFamily: 'ui-monospace,monospace' }} value={defRoute} onChange={e => setDefRoute(e.target.value)} placeholder="ex. 10.0.0.2 (laisser vide si aucune)" />
        </div>
      </div>

      <div style={{ marginTop: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 6px' }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>📟 Configuration CLI (à coller dans le routeur)</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={download} style={{ ...smallBtn, padding: '6px 12px' }} title="Télécharger .txt">💾 .txt</button>
            <button onClick={copy} style={{ padding: '6px 14px', border: '1px solid var(--accent)', borderRadius: 8, background: copied ? 'var(--accent)' : 'transparent', color: copied ? '#fff' : 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>{copied ? '✓ Copié' : 'Copier'}</button>
          </div>
        </div>
        <pre style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', overflowX: 'auto', fontSize: 12.5, lineHeight: 1.5, margin: 0, fontFamily: 'ui-monospace,monospace' }}><code>{cli}</code></pre>
      </div>
    </div>
  );
}

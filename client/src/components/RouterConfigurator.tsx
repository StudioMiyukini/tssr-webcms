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

type NatRule = { type: 'pf' | 'static'; proto: 'tcp' | 'udp'; ip: string; port: string; pub: string; extPort: string };
type Nat = { on: boolean; inside: string; outside: string; overload: boolean; nets: { net: string; cidr: number }[]; rules: NatRule[] };
const D_NAT: Nat = {
  on: false, inside: 'GigabitEthernet0/0', outside: 'Serial0/0/0', overload: true,
  nets: [{ net: '192.168.10.0', cidr: 24 }], rules: [],
};

/*
 * @id     tssr.atelier.routerConfigurator
 * @do     configurer_routeur
 * @role   ui
 * @layer  ui
 * @human  Atelier : configurateur de routeur.
 */
export function RouterConfigurator() {
  const [hostname, setHostname] = useState(() => load('router_host', 'R1'));
  const [ifaces, setIfaces] = useState<Iface[]>(() => load('router_ifaces', D_IFACES));
  const [routes, setRoutes] = useState<Route[]>(() => load('router_routes', D_ROUTES));
  const [defRoute, setDefRoute] = useState(() => load('router_defroute', ''));
  const [nat, setNat] = useState<Nat>(() => load('router_nat', D_NAT));
  const [copied, setCopied] = useState(false);

  useEffect(() => { try {
    localStorage.setItem('router_host', JSON.stringify(hostname)); localStorage.setItem('router_ifaces', JSON.stringify(ifaces));
    localStorage.setItem('router_routes', JSON.stringify(routes)); localStorage.setItem('router_defroute', JSON.stringify(defRoute));
    localStorage.setItem('router_nat', JSON.stringify(nat));
  } catch { /* */ } }, [hostname, ifaces, routes, defRoute, nat]);

  const mask = (c: number) => CIDR_TO_MASK[c] || '255.255.255.0';
  const wildcard = (c: number) => mask(c).split('.').map(o => 255 - Number(o)).join('.');
  const isSerial = (n: string) => /^Serial/i.test(n);

  const cli = useMemo(() => {
    const o: string[] = [];
    o.push('enable');
    o.push('configure terminal');
    o.push(`hostname ${hostname || 'R1'}`);
    o.push('no ip domain-lookup');
    for (const i of ifaces) {
      o.push(`interface ${i.name}`);
      if (i.desc.trim()) o.push(` description ${i.desc.trim()}`);
      if (i.ip.trim()) o.push(` ip address ${i.ip.trim()} ${mask(i.cidr)}`);
      if (nat.on && i.name === nat.inside) o.push(' ip nat inside');
      if (nat.on && i.name === nat.outside) o.push(' ip nat outside');
      if (isSerial(i.name) && i.dce) o.push(' clock rate 64000');
      o.push(i.up ? ' no shutdown' : ' shutdown');
      o.push(' exit');
    }
    for (const r of routes) if (r.net.trim() && r.hop.trim()) o.push(`ip route ${r.net.trim()} ${mask(r.cidr)} ${r.hop.trim()}`);
    if (defRoute.trim()) o.push(`ip route 0.0.0.0 0.0.0.0 ${defRoute.trim()}`);
    if (nat.on) {
      if (nat.overload) {
        const nets = nat.nets.filter(n => n.net.trim());
        nets.forEach(n => o.push(`access-list 1 permit ${n.net.trim()} ${wildcard(n.cidr)}`));
        if (nat.outside) o.push(`ip nat inside source list 1 interface ${nat.outside} overload`);
      }
      for (const r of nat.rules) {
        if (!r.ip.trim()) continue;
        if (r.type === 'static') { if (r.pub.trim()) o.push(`ip nat inside source static ${r.ip.trim()} ${r.pub.trim()}`); }
        else if (r.port.trim() && nat.outside) o.push(`ip nat inside source static ${r.proto} ${r.ip.trim()} ${r.port.trim()} interface ${nat.outside} ${(r.extPort.trim() || r.port.trim())}`);
      }
    }
    o.push('end');
    o.push('write memory');
    return o.join('\n');
  }, [hostname, ifaces, routes, defRoute, nat]);

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
  const setNatNet = (idx: number, p: Partial<{ net: string; cidr: number }>) => setNat(n => ({ ...n, nets: n.nets.map((x, i) => i === idx ? { ...x, ...p } : x) }));
  const addNatNet = () => setNat(n => ({ ...n, nets: [...n.nets, { net: '', cidr: 24 }] }));
  const delNatNet = (idx: number) => setNat(n => ({ ...n, nets: n.nets.filter((_, i) => i !== idx) }));
  const setRule = (idx: number, p: Partial<NatRule>) => setNat(n => ({ ...n, rules: n.rules.map((x, i) => i === idx ? { ...x, ...p } : x) }));
  const addRule = () => setNat(n => ({ ...n, rules: [...n.rules, { type: 'pf', proto: 'tcp', ip: '', port: '', pub: '', extPort: '' }] }));
  const delRule = (idx: number) => setNat(n => ({ ...n, rules: n.rules.filter((_, i) => i !== idx) }));

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

      <div style={groupStyle}>
        <div style={legendStyle}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={nat.on} onChange={e => setNat(n => ({ ...n, on: e.target.checked }))} /> 🌐 NAT / PAT
          </label>
          <span className="meta" style={{ fontWeight: 400, fontSize: 12 }}>— sortie Internet + publication de services</span>
        </div>
        {nat.on && <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div><label style={labelStyle}>Interface interne (inside)</label>
              <select style={fieldStyle} value={nat.inside} onChange={e => setNat(n => ({ ...n, inside: e.target.value }))}>{ifaces.map(i => <option key={i.name} value={i.name}>{i.name}</option>)}</select></div>
            <div><label style={labelStyle}>Interface externe (outside)</label>
              <select style={fieldStyle} value={nat.outside} onChange={e => setNat(n => ({ ...n, outside: e.target.value }))}>{ifaces.map(i => <option key={i.name} value={i.name}>{i.name}</option>)}</select></div>
          </div>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13.5, cursor: 'pointer', marginBottom: 8 }}>
            <input type="checkbox" checked={nat.overload} onChange={e => setNat(n => ({ ...n, overload: e.target.checked }))} /> <b>PAT (overload)</b> — tout le LAN sort derrière l’IP de l’interface externe
          </label>
          {nat.overload && <div style={{ marginLeft: 6, marginBottom: 10 }}>
            <label style={labelStyle}>Réseaux internes à traduire (ACL 1)</label>
            {nat.nets.map((n, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr auto', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                <input style={{ ...fieldStyle, fontFamily: 'ui-monospace,monospace' }} value={n.net} onChange={e => setNatNet(idx, { net: e.target.value })} placeholder="192.168.10.0" />
                <select style={fieldStyle} value={n.cidr} onChange={e => setNatNet(idx, { cidr: Number(e.target.value) })}>{CIDRS.map(c => <option key={c} value={c}>/{c}</option>)}</select>
                <button style={smallBtn} onClick={() => delNatNet(idx)}>✕</button>
              </div>
            ))}
            <button style={smallBtn} onClick={addNatNet}>+ Réseau</button>
          </div>}
          <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 10 }}>
            <label style={labelStyle}>Publications — NAT statique (1:1) / redirection de port</label>
            {nat.rules.map((r, idx) => (
              <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 8, background: 'var(--surface)' }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <select style={{ ...fieldStyle, maxWidth: 200 }} value={r.type} onChange={e => setRule(idx, { type: e.target.value as NatRule['type'] })}>
                    <option value="pf">Redirection de port</option>
                    <option value="static">NAT statique 1:1</option>
                  </select>
                  {r.type === 'pf' && <select style={{ ...fieldStyle, maxWidth: 90 }} value={r.proto} onChange={e => setRule(idx, { proto: e.target.value as NatRule['proto'] })}><option value="tcp">TCP</option><option value="udp">UDP</option></select>}
                  <button style={{ ...smallBtn, marginLeft: 'auto' }} onClick={() => delRule(idx)}>✕</button>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
                  <input style={{ ...fieldStyle, maxWidth: 180, fontFamily: 'ui-monospace,monospace' }} value={r.ip} onChange={e => setRule(idx, { ip: e.target.value })} placeholder="IP interne (192.168.10.51)" />
                  {r.type === 'pf' ? <>
                    <input style={{ ...fieldStyle, maxWidth: 130, fontFamily: 'ui-monospace,monospace' }} value={r.port} onChange={e => setRule(idx, { port: e.target.value })} placeholder="port interne (8080)" />
                    <input style={{ ...fieldStyle, maxWidth: 150, fontFamily: 'ui-monospace,monospace' }} value={r.extPort} onChange={e => setRule(idx, { extPort: e.target.value })} placeholder="port externe (= interne)" />
                  </> : <input style={{ ...fieldStyle, maxWidth: 180, fontFamily: 'ui-monospace,monospace' }} value={r.pub} onChange={e => setRule(idx, { pub: e.target.value })} placeholder="IP publique (203.0.113.10)" />}
                </div>
              </div>
            ))}
            <button style={btnStyle} onClick={addRule}>+ Publication</button>
            <p className="meta" style={{ fontSize: 11.5, marginTop: 6 }}>Redirection de port = publier un <b>service</b> (un port) ; NAT statique 1:1 = mapper toute une <b>IP publique</b>. La redirection utilise l’<b>IP de l’interface externe</b>.</p>
          </div>
        </>}
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

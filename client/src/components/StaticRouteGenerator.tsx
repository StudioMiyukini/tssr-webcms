import { useEffect, useMemo, useState } from 'react';

/**
 * Générateur de routes statiques multi-routeurs (Cisco CLI). On décrit la topologie
 * (routeurs, liaisons entre routeurs, LAN) et l'outil calcule, pour CHAQUE routeur, les
 * routes statiques vers tous les réseaux non directement connectés (prochain saut correct
 * par plus court chemin). Îlot React hydraté via RichContent (data-block="static-route-generator").
 */

const CIDR_TO_MASK: Record<number, string> = {
  8: '255.0.0.0', 16: '255.255.0.0', 24: '255.255.255.0', 25: '255.255.255.128', 26: '255.255.255.192',
  27: '255.255.255.224', 28: '255.255.255.240', 29: '255.255.255.248', 30: '255.255.255.252',
};
const CIDRS = Object.keys(CIDR_TO_MASK).map(Number);
const mask = (c: number) => CIDR_TO_MASK[c] || '255.255.255.0';
const uid = (p: string) => p + Math.random().toString(36).slice(2, 7);
const load = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };

type Router = { id: string; name: string; def: string };
type Link = { id: string; a: string; b: string; ipA: string; ipB: string; net: string; cidr: number };
type Lan = { id: string; router: string; net: string; cidr: number };

const fieldStyle: React.CSSProperties = { width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 3 };
const groupStyle: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface-2)', marginBottom: 14 };
const legendStyle: React.CSSProperties = { fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const btnStyle: React.CSSProperties = { padding: '6px 11px', border: '1px solid var(--accent)', borderRadius: 8, background: 'transparent', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 12.5, whiteSpace: 'nowrap' };
const smallBtn: React.CSSProperties = { ...btnStyle, padding: '3px 9px', fontSize: 12, borderColor: 'var(--border)', color: 'var(--text-soft)' };
const mono: React.CSSProperties = { fontFamily: 'ui-monospace,monospace' };

const D_ROUTERS: Router[] = [{ id: 'r1', name: 'R1', def: '' }, { id: 'r2', name: 'R2', def: '' }, { id: 'r3', name: 'R3', def: '' }];
const D_LINKS: Link[] = [
  { id: 'l1', a: 'r1', b: 'r2', ipA: '10.0.0.1', ipB: '10.0.0.2', net: '10.0.0.0', cidr: 30 },
  { id: 'l2', a: 'r2', b: 'r3', ipA: '10.0.0.5', ipB: '10.0.0.6', net: '10.0.0.4', cidr: 30 },
];
const D_LANS: Lan[] = [
  { id: 'n1', router: 'r1', net: '192.168.1.0', cidr: 24 },
  { id: 'n2', router: 'r2', net: '192.168.2.0', cidr: 24 },
  { id: 'n3', router: 'r3', net: '192.168.3.0', cidr: 24 },
];

export function StaticRouteGenerator() {
  const [routers, setRouters] = useState<Router[]>(() => load('sr_routers', D_ROUTERS));
  const [links, setLinks] = useState<Link[]>(() => load('sr_links', D_LINKS));
  const [lans, setLans] = useState<Lan[]>(() => load('sr_lans', D_LANS));
  const [copied, setCopied] = useState(false);

  useEffect(() => { try { localStorage.setItem('sr_routers', JSON.stringify(routers)); localStorage.setItem('sr_links', JSON.stringify(links)); localStorage.setItem('sr_lans', JSON.stringify(lans)); } catch { /* */ } }, [routers, links, lans]);

  const rName = (id: string) => routers.find(r => r.id === id)?.name || '?';

  const output = useMemo(() => {
    // Adjacence : routeur -> [{ voisin, ipDuVoisin sur la liaison }]
    const adj = new Map<string, Array<{ n: string; ip: string }>>();
    routers.forEach(r => adj.set(r.id, []));
    for (const l of links) {
      if (!l.a || !l.b || l.a === l.b) continue;
      adj.get(l.a)?.push({ n: l.b, ip: l.ipB });
      adj.get(l.b)?.push({ n: l.a, ip: l.ipA });
    }
    // Tous les réseaux de la topologie + leurs routeurs propriétaires
    const nets: Array<{ key: string; net: string; cidr: number; owners: string[] }> = [];
    for (const l of links) if (l.net) nets.push({ key: `${l.net}/${l.cidr}`, net: l.net, cidr: l.cidr, owners: [l.a, l.b] });
    for (const n of lans) if (n.net) nets.push({ key: `${n.net}/${n.cidr}`, net: n.net, cidr: n.cidr, owners: [n.router] });

    const bfs = (start: string) => {
      const dist = new Map<string, number>([[start, 0]]);
      const hop = new Map<string, string>(); // routeur cible -> IP du prochain saut depuis start
      const q = [start];
      while (q.length) {
        const cur = q.shift()!;
        for (const { n, ip } of adj.get(cur) || []) {
          if (!dist.has(n)) { dist.set(n, dist.get(cur)! + 1); hop.set(n, cur === start ? ip : hop.get(cur)!); q.push(n); }
        }
      }
      return { dist, hop };
    };

    const blocks = routers.map(r => {
      const { dist, hop } = bfs(r.id);
      const connected = new Set<string>();
      for (const nn of nets) if (nn.owners.includes(r.id)) connected.add(nn.key);
      const lines: string[] = [];
      for (const nn of nets) {
        if (connected.has(nn.key)) continue;
        // propriétaire joignable le plus proche
        const reach = nn.owners.filter(o => o !== r.id && hop.has(o)).sort((a, b) => (dist.get(a)! - dist.get(b)!));
        if (!reach.length) { lines.push(`! ${nn.net}/${nn.cidr} injoignable (topologie incomplete)`); continue; }
        lines.push(`ip route ${nn.net} ${mask(nn.cidr)} ${hop.get(reach[0])}`);
      }
      if (r.def.trim()) lines.push(`ip route 0.0.0.0 0.0.0.0 ${r.def.trim()}`);
      return { name: r.name, lines };
    });

    const text = blocks.map(b => [`! ===== ${b.name} =====`, 'enable', 'configure terminal', ...(b.lines.length ? b.lines : ['! (aucune route statique necessaire)']), 'end', 'write memory', ''].join('\n')).join('\n');
    return { blocks, text };
  }, [routers, links, lans]);

  const copy = () => { navigator.clipboard?.writeText(output.text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }).catch(() => {}); };
  const download = () => {
    const blob = new Blob([output.text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = 'routes-statiques.txt'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const setR = (i: number, p: Partial<Router>) => setRouters(a => a.map((x, k) => k === i ? { ...x, ...p } : x));
  const addR = () => setRouters(a => [...a, { id: uid('r'), name: `R${a.length + 1}`, def: '' }]);
  const delR = (id: string) => { setRouters(a => a.filter(x => x.id !== id)); setLinks(a => a.filter(l => l.a !== id && l.b !== id)); setLans(a => a.filter(n => n.router !== id)); };
  const setL = (i: number, p: Partial<Link>) => setLinks(a => a.map((x, k) => k === i ? { ...x, ...p } : x));
  const addL = () => setLinks(a => [...a, { id: uid('l'), a: routers[0]?.id || '', b: routers[1]?.id || routers[0]?.id || '', ipA: '', ipB: '', net: '', cidr: 30 }]);
  const delL = (id: string) => setLinks(a => a.filter(x => x.id !== id));
  const setN = (i: number, p: Partial<Lan>) => setLans(a => a.map((x, k) => k === i ? { ...x, ...p } : x));
  const addN = () => setLans(a => [...a, { id: uid('n'), router: routers[0]?.id || '', net: '', cidr: 24 }]);
  const delN = (id: string) => setLans(a => a.filter(x => x.id !== id));

  const rSelect = (val: string, on: (v: string) => void) => <select style={{ ...fieldStyle, width: 'auto' }} value={val} onChange={e => on(e.target.value)}>{routers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>;
  const cSelect = (val: number, on: (v: number) => void) => <select style={{ ...fieldStyle, width: 'auto' }} value={val} onChange={e => on(Number(e.target.value))}>{CIDRS.map(c => <option key={c} value={c}>/{c}</option>)}</select>;

  return (
    <div style={{ margin: '14px 0' }}>
      <div style={groupStyle}>
        <div style={legendStyle}>🧭 Routeurs</div>
        {routers.map((r, i) => (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr auto', gap: 8, marginBottom: 7, alignItems: 'center' }}>
            <input style={fieldStyle} value={r.name} onChange={e => setR(i, { name: e.target.value.replace(/\s+/g, '') })} placeholder="R1" />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span className="meta" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>route par défaut via</span><input style={{ ...fieldStyle, ...mono }} value={r.def} onChange={e => setR(i, { def: e.target.value })} placeholder="(optionnel) 10.0.0.2" /></div>
            <button style={smallBtn} onClick={() => delR(r.id)}>✕</button>
          </div>
        ))}
        <button style={btnStyle} onClick={addR}>+ Routeur</button>
      </div>

      <div style={groupStyle}>
        <div style={legendStyle}>🔗 Liaisons entre routeurs <span className="meta" style={{ fontWeight: 400, fontSize: 12 }}>— le réseau qui relie deux routeurs, avec l’IP de chaque extrémité</span></div>
        {links.map((l, i) => (
          <div key={l.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 8, marginBottom: 8, background: 'var(--surface)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
            <div><label style={labelStyle}>Routeur A</label>{rSelect(l.a, v => setL(i, { a: v }))}</div>
            <div><label style={labelStyle}>IP A</label><input style={{ ...fieldStyle, ...mono, width: 130 }} value={l.ipA} onChange={e => setL(i, { ipA: e.target.value })} placeholder="10.0.0.1" /></div>
            <div><label style={labelStyle}>Routeur B</label>{rSelect(l.b, v => setL(i, { b: v }))}</div>
            <div><label style={labelStyle}>IP B</label><input style={{ ...fieldStyle, ...mono, width: 130 }} value={l.ipB} onChange={e => setL(i, { ipB: e.target.value })} placeholder="10.0.0.2" /></div>
            <div><label style={labelStyle}>Réseau</label><input style={{ ...fieldStyle, ...mono, width: 130 }} value={l.net} onChange={e => setL(i, { net: e.target.value })} placeholder="10.0.0.0" /></div>
            <div><label style={labelStyle}>Masque</label>{cSelect(l.cidr, v => setL(i, { cidr: v }))}</div>
            <button style={{ ...smallBtn, marginLeft: 'auto' }} onClick={() => delL(l.id)}>✕</button>
          </div>
        ))}
        <button style={btnStyle} onClick={addL}>+ Liaison</button>
      </div>

      <div style={groupStyle}>
        <div style={legendStyle}>🖧 Réseaux LAN (derrière un routeur)</div>
        {lans.map((n, i) => (
          <div key={n.id} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end', marginBottom: 7 }}>
            <div><label style={labelStyle}>Routeur</label>{rSelect(n.router, v => setN(i, { router: v }))}</div>
            <div><label style={labelStyle}>Réseau</label><input style={{ ...fieldStyle, ...mono, width: 150 }} value={n.net} onChange={e => setN(i, { net: e.target.value })} placeholder="192.168.1.0" /></div>
            <div><label style={labelStyle}>Masque</label>{cSelect(n.cidr, v => setN(i, { cidr: v }))}</div>
            <button style={{ ...smallBtn, marginLeft: 'auto' }} onClick={() => delN(n.id)}>✕</button>
          </div>
        ))}
        <button style={btnStyle} onClick={addN}>+ LAN</button>
      </div>

      <div style={{ marginTop: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 6px' }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>📟 Routes statiques par routeur (CLI)</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={download} style={{ ...smallBtn, padding: '6px 12px' }} title="Télécharger .txt">💾 .txt</button>
            <button onClick={copy} style={{ padding: '6px 14px', border: '1px solid var(--accent)', borderRadius: 8, background: copied ? 'var(--accent)' : 'transparent', color: copied ? '#fff' : 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>{copied ? '✓ Copié' : 'Tout copier'}</button>
          </div>
        </div>
        <pre style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', overflowX: 'auto', fontSize: 12.5, lineHeight: 1.5, margin: 0, ...mono }}><code>{output.text.trimEnd()}</code></pre>
        <div className="meta" style={{ fontSize: 11.5, marginTop: 6 }}>Le <strong>prochain saut</strong> de chaque route est calculé automatiquement (IP du voisin sur le plus court chemin). Configure d’abord les <strong>interfaces</strong> (IP + <code>no shutdown</code>) avec le <a href="/configurateur-routeur-cisco">configurateur routeur</a>.</div>
      </div>
    </div>
  );
}

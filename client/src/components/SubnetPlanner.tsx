import { useMemo, useState, type ReactNode } from 'react';

/**
 * Outil de segmentation réseau : à partir d'un réseau de base, calcule le découpage en
 * sous-réseaux — VLSM (par besoin en hôtes) ou FLSM (sous-réseaux égaux). Donne pour chacun
 * l'adresse réseau, la plage utilisable, le broadcast, le masque, la passerelle et le nb d'hôtes.
 * Îlot React hydraté via RichContent (data-block="subnet-planner").
 */

const ipToStr = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
function strToIp(s: string): number | null {
  const m = s.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const o = m.slice(1, 5).map(Number);
  if (o.some(x => x > 255)) return null;
  return (((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0);
}
const maskFromCidr = (c: number) => (c === 0 ? 0 : (0xFFFFFFFF << (32 - c)) >>> 0);
const hostBitsFor = (need: number) => { let n = 1; while (Math.pow(2, n) - 2 < Math.max(1, need)) n++; return n; };

type DKey = 'router' | 'switch' | 'pc' | 'laptop' | 'server';
const DTYPES: Array<{ key: DKey; label: string; icon: string; ip: boolean }> = [
  { key: 'router', label: 'Routeur', icon: '🧭', ip: true },
  { key: 'switch', label: 'Switch', icon: '🔀', ip: false },
  { key: 'pc', label: 'PC', icon: '🖥️', ip: true },
  { key: 'laptop', label: 'Laptop', icon: '💻', ip: true },
  { key: 'server', label: 'Serveur', icon: '🗄️', ip: true },
];
const dinfo = (k: string) => DTYPES.find(d => d.key === k) || DTYPES[2];
const NAMEPFX: Record<DKey, string> = { router: 'R', switch: 'SW', pc: 'PC', laptop: 'LT', server: 'SRV' };
type Device = { type: DKey; name: string };
type Alloc = { name: string; type: DKey; ip: number | null };
type Sub = { name: string; hosts: string; devices: Device[] };
type Row = { name: string; need: number; cidr: number; net: number; first: number; last: number; bc: number; usable: number; mask: number; gw: number; devices: Alloc[] };

const fieldStyle: React.CSSProperties = { width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13.5, boxSizing: 'border-box' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 4 };
const groupStyle: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface-2)', marginBottom: 14 };
const legendStyle: React.CSSProperties = { fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const btnStyle: React.CSSProperties = { padding: '6px 11px', border: '1px solid var(--accent)', borderRadius: 8, background: 'transparent', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 12.5, whiteSpace: 'nowrap' };
const smallBtn: React.CSSProperties = { ...btnStyle, padding: '3px 9px', fontSize: 12, borderColor: 'var(--border)', color: 'var(--text-soft)' };
const mono: React.CSSProperties = { fontFamily: 'ui-monospace,monospace' };

export function SubnetPlanner() {
  const [baseIp, setBaseIp] = useState('192.168.10.0');
  const [baseCidr, setBaseCidr] = useState('24');
  const [mode, setMode] = useState<'vlsm' | 'flsm'>('vlsm');
  const [subs, setSubs] = useState<Sub[]>([
    { name: 'Production', hosts: '100', devices: [{ type: 'router', name: 'R1' }, { type: 'switch', name: 'SW1' }, { type: 'server', name: 'SRV1' }, { type: 'pc', name: 'PC1' }] },
    { name: 'Bureaux', hosts: '50', devices: [] },
    { name: 'Wi-Fi', hosts: '20', devices: [] },
    { name: 'Liaison', hosts: '2', devices: [] },
  ]);
  const [openDev, setOpenDev] = useState<Record<number, boolean>>({});
  const [flsmCount, setFlsmCount] = useState('4');
  const [gwLast, setGwLast] = useState(true);
  const [bulk, setBulk] = useState('');
  const [copied, setCopied] = useState(false);

  const baseNum = strToIp(baseIp);
  const cidr = Math.max(1, Math.min(30, Number(baseCidr) || 24));
  const baseNet = baseNum === null ? null : (baseNum & maskFromCidr(cidr)) >>> 0;
  const baseBc = baseNet === null ? null : (baseNet | ((~maskFromCidr(cidr)) >>> 0)) >>> 0;
  const totalAddr = baseNet === null ? 0 : (baseBc! - baseNet + 1);

  const result = useMemo(() => {
    if (baseNet === null) return { rows: [] as Row[], error: 'Adresse réseau invalide.', used: 0 };
    const rows: Row[] = [];
    let error = '';
    let ptr = baseNet;
    const mk = (name: string, need: number, cidrN: number): boolean => {
      const size = Math.pow(2, 32 - cidrN);
      const net = ptr >>> 0;
      const bc = (net + size - 1) >>> 0;
      if (bc > baseBc!) { error = `Plus de place pour « ${name} »${need ? ` (${need} hôtes)` : ''}.`; return false; }
      const first = (net + 1) >>> 0, last = (bc - 1) >>> 0;
      rows.push({ name, need, cidr: cidrN, net, first, last, bc, usable: size - 2, mask: maskFromCidr(cidrN), gw: gwLast ? last : first, devices: [] });
      ptr = (bc + 1) >>> 0;
      return true;
    };
    if (mode === 'vlsm') {
      const list = subs.map(s => ({ name: s.name || 'Sous-réseau', need: Math.max(1, Number(s.hosts) || 0), devices: s.devices || [] })).filter(s => s.need > 0);
      list.sort((a, b) => b.need - a.need);
      for (const s of list) {
        if (!mk(s.name, s.need, 32 - hostBitsFor(s.need))) break;
        const row = rows[rows.length - 1];
        // Attribution automatique des IP : routeur = passerelle, hôtes en séquence, switch = niveau 2.
        const used = new Set<number>();
        let hostPtr = row.first, rc = 0;
        row.devices = (s.devices || []).map(d => {
          if (!dinfo(d.type).ip) return { name: d.name, type: d.type, ip: null };
          let ip: number;
          if (d.type === 'router') { ip = (gwLast ? row.last - rc : row.first + rc) >>> 0; rc++; }
          else { while (hostPtr <= row.last && (used.has(hostPtr) || hostPtr === row.gw)) hostPtr++; ip = hostPtr; hostPtr = (hostPtr + 1) >>> 0; }
          if (ip < row.first || ip > row.last) return { name: d.name, type: d.type, ip: null };
          used.add(ip);
          return { name: d.name, type: d.type, ip };
        });
      }
    } else {
      const count = Math.max(1, Number(flsmCount) || 1);
      const bits = Math.ceil(Math.log2(count));
      const newCidr = Math.min(30, cidr + bits);
      const n = Math.min(Math.pow(2, newCidr - cidr), 256);
      for (let k = 0; k < n; k++) { if (!mk(`Sous-réseau ${k + 1}`, 0, newCidr)) break; }
    }
    return { rows, error, used: (ptr - baseNet) >>> 0 };
  }, [baseNet, baseBc, mode, subs, flsmCount, gwLast, cidr]);

  const planText = useMemo(() => {
    if (!result.rows.length) return '';
    const head = `Reseau de base : ${ipToStr(baseNet || 0)}/${cidr}  (${totalAddr} adresses)`;
    const lines = result.rows.map(r => `${r.name}\t${ipToStr(r.net)}/${r.cidr}\t${ipToStr(r.mask)}\t${ipToStr(r.first)} - ${ipToStr(r.last)}\tbc ${ipToStr(r.bc)}\tgw ${ipToStr(r.gw)}\t${r.usable} hotes`);
    const devs = result.rows.flatMap(r => r.devices.map(d => ({ ...d, sub: r.name, mask: r.mask, gw: r.gw })));
    const devLines = devs.length ? ['', 'Table d adressage :', 'Equipement\tType\tSous-reseau\tIP\tMasque\tPasserelle', ...devs.map(d => `${d.name}\t${dinfo(d.type).label}\t${d.sub}\t${d.ip === null ? '(L2)' : ipToStr(d.ip)}\t${d.ip === null ? '-' : ipToStr(d.mask)}\t${d.ip === null ? '-' : ipToStr(d.gw)}`)] : [];
    return [head, 'Nom\tReseau/CIDR\tMasque\tPlage utilisable\tBroadcast\tPasserelle\tHotes', ...lines, ...devLines].join('\n');
  }, [result, baseNet, cidr, totalAddr]);

  const copy = () => { navigator.clipboard?.writeText(planText).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }).catch(() => {}); };

  const setSub = (i: number, p: Partial<Sub>) => setSubs(a => a.map((x, k) => k === i ? { ...x, ...p } : x));
  const addSub = () => setSubs(a => [...a, { name: 'Sous-réseau', hosts: '10', devices: [] }]);
  const delSub = (i: number) => setSubs(a => a.filter((_, k) => k !== i));
  const importBulk = () => {
    const rows = bulk.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => { const p = l.split(/\s+/); const hosts = p[p.length - 1]; const name = p.slice(0, -1).join(' ') || 'Sous-réseau'; return { name, hosts: /^\d+$/.test(hosts) ? hosts : '10', devices: [] as Device[] }; });
    if (rows.length) { setSubs(a => [...a, ...rows]); setBulk(''); }
  };
  const toggleDev = (i: number) => setOpenDev(o => ({ ...o, [i]: !o[i] }));
  const addDevice = (i: number, type: DKey) => setSubs(a => a.map((x, k) => k === i ? { ...x, devices: [...x.devices, { type, name: NAMEPFX[type] + (x.devices.filter(d => d.type === type).length + 1) }] } : x));
  const setDevice = (i: number, j: number, p: Partial<Device>) => setSubs(a => a.map((x, k) => k === i ? { ...x, devices: x.devices.map((d, m) => m === j ? { ...d, ...p } : d) } : x));
  const delDevice = (i: number, j: number) => setSubs(a => a.map((x, k) => k === i ? { ...x, devices: x.devices.filter((_, m) => m !== j) } : x));

  const cols = [mode === 'vlsm' ? 'Service' : 'Sous-réseau', 'Besoin', 'CIDR', 'Adresse réseau', 'Plage utilisable', 'Broadcast', 'Masque', 'Passerelle', 'Hôtes'];
  const td = (c: ReactNode, extra?: React.CSSProperties) => <td style={{ padding: '6px 9px', borderBottom: '1px solid var(--border)', fontSize: 13, whiteSpace: 'nowrap', ...extra }}>{c}</td>;

  return (
    <div style={{ margin: '14px 0' }}>
      <div style={groupStyle}>
        <div style={legendStyle}>🌐 Réseau de base & mode</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, alignItems: 'end' }}>
          <div><label style={labelStyle}>Adresse réseau</label><input style={{ ...fieldStyle, ...mono }} value={baseIp} onChange={e => setBaseIp(e.target.value)} placeholder="192.168.10.0" /></div>
          <div><label style={labelStyle}>Masque (CIDR)</label>
            <select style={fieldStyle} value={cidr} onChange={e => setBaseCidr(e.target.value)}>
              {Array.from({ length: 22 }, (_, i) => i + 8).map(c => <option key={c} value={c}>/{c} — {ipToStr(maskFromCidr(c))}</option>)}
            </select>
          </div>
          <div><label style={labelStyle}>Découpage</label>
            <select style={fieldStyle} value={mode} onChange={e => setMode(e.target.value as 'vlsm' | 'flsm')}>
              <option value="vlsm">VLSM — par besoin en hôtes</option>
              <option value="flsm">FLSM — sous-réseaux égaux</option>
            </select>
          </div>
          <div><label style={labelStyle}>Passerelle</label>
            <select style={fieldStyle} value={gwLast ? 'last' : 'first'} onChange={e => setGwLast(e.target.value === 'last')}>
              <option value="last">dernière IP utilisable</option>
              <option value="first">1re IP utilisable</option>
            </select>
          </div>
        </div>
        {baseNet !== null && <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>Base : <b style={mono}>{ipToStr(baseNet)}/{cidr}</b> · broadcast <span style={mono}>{ipToStr(baseBc!)}</span> · <b>{totalAddr}</b> adresses au total.</div>}
      </div>

      {mode === 'vlsm' ? (
        <div style={groupStyle}>
          <div style={legendStyle}>📋 Besoins en hôtes (par service)</div>
          {subs.map((s, i) => (
            <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 8, marginBottom: 8, background: 'var(--surface)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto auto', gap: 8, alignItems: 'center' }}>
                <input style={fieldStyle} value={s.name} onChange={e => setSub(i, { name: e.target.value })} placeholder="Nom du service" />
                <input style={fieldStyle} type="number" min={1} value={s.hosts} onChange={e => setSub(i, { hosts: e.target.value })} placeholder="hôtes" />
                <button style={{ ...smallBtn, color: openDev[i] ? 'var(--accent)' : 'var(--text-soft)', borderColor: openDev[i] ? 'var(--accent)' : 'var(--border)' }} onClick={() => toggleDev(i)} title="Équipements du sous-réseau">🖥️ {s.devices.length}</button>
                <button style={smallBtn} onClick={() => delSub(i)}>✕</button>
              </div>
              {openDev[i] && (
                <div style={{ marginTop: 8, paddingLeft: 8, borderLeft: '2px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {DTYPES.map(dt => <button key={dt.key} style={smallBtn} onClick={() => addDevice(i, dt.key)}>+ {dt.icon} {dt.label}</button>)}
                  </div>
                  {s.devices.map((d, j) => (
                    <div key={j} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 5 }}>
                      <span style={{ fontSize: 15 }}>{dinfo(d.type).icon}</span>
                      <select style={{ ...fieldStyle, width: 'auto' }} value={d.type} onChange={e => setDevice(i, j, { type: e.target.value as DKey })}>{DTYPES.map(dt => <option key={dt.key} value={dt.key}>{dt.label}</option>)}</select>
                      <input style={{ ...fieldStyle, maxWidth: 180, ...mono }} value={d.name} onChange={e => setDevice(i, j, { name: e.target.value })} placeholder="Nom" />
                      <button style={{ ...smallBtn, marginLeft: 'auto' }} onClick={() => delDevice(i, j)}>✕</button>
                    </div>
                  ))}
                  {!s.devices.length && <div className="meta" style={{ fontSize: 11.5 }}>Aucun équipement. Ajoute-en pour l’attribution automatique des IP.</div>}
                </div>
              )}
            </div>
          ))}
          <button style={btnStyle} onClick={addSub}>+ Service</button>
          <div style={{ marginTop: 10, borderTop: '1px dashed var(--border)', paddingTop: 10 }}>
            <label style={labelStyle}>Ajout en masse — « Nom besoin » (une ligne par service)</label>
            <textarea value={bulk} onChange={e => setBulk(e.target.value)} placeholder={'Production 100\nBureaux 50\nWi-Fi 20'} style={{ ...fieldStyle, minHeight: 54, ...mono, resize: 'vertical' }} />
            <button style={{ ...btnStyle, marginTop: 6 }} onClick={importBulk}>Ajouter ces services</button>
          </div>
        </div>
      ) : (
        <div style={groupStyle}>
          <div style={legendStyle}>📐 Sous-réseaux égaux (FLSM)</div>
          <div style={{ maxWidth: 260 }}>
            <label style={labelStyle}>Nombre de sous-réseaux souhaités</label>
            <input style={fieldStyle} type="number" min={1} value={flsmCount} onChange={e => setFlsmCount(e.target.value)} />
          </div>
          <div className="meta" style={{ fontSize: 11.5, marginTop: 6 }}>On emprunte des bits jusqu’à obtenir au moins ce nombre de sous-réseaux de taille égale.</div>
        </div>
      )}

      <div style={{ marginTop: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 6px', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>🗺️ Plan d’adressage</div>
          <button onClick={copy} disabled={!result.rows.length} style={{ padding: '6px 14px', border: '1px solid var(--accent)', borderRadius: 8, background: copied ? 'var(--accent)' : 'transparent', color: copied ? '#fff' : 'var(--accent)', fontWeight: 600, cursor: result.rows.length ? 'pointer' : 'default', fontSize: 13, opacity: result.rows.length ? 1 : 0.5 }}>{copied ? '✓ Copié' : 'Copier le plan'}</button>
        </div>
        {result.error && <div className="pb-note pb-note-yellow" style={{ marginBottom: 8 }}><p style={{ margin: 0 }}>⚠️ {result.error}</p></div>}
        {result.rows.length > 0 && (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 720 }}>
              <thead><tr style={{ background: 'var(--surface-2)' }}>{cols.map(h => <th key={h} style={{ textAlign: 'left', padding: '7px 9px', borderBottom: '2px solid var(--border)', fontSize: 12.5, whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
              <tbody>
                {result.rows.map((r, i) => (
                  <tr key={i}>
                    {td(<b>{r.name}</b>)}
                    {td(mode === 'vlsm' ? r.need : '—', { color: 'var(--text-muted)' })}
                    {td(<b style={{ color: 'var(--accent)' }}>/{r.cidr}</b>)}
                    {td(<span style={mono}>{ipToStr(r.net)}</span>)}
                    {td(<span style={mono}>{ipToStr(r.first)} → {ipToStr(r.last)}</span>)}
                    {td(<span style={mono}>{ipToStr(r.bc)}</span>)}
                    {td(<span style={mono}>{ipToStr(r.mask)}</span>)}
                    {td(<span style={mono}>{ipToStr(r.gw)}</span>)}
                    {td(r.usable.toLocaleString('fr-FR'))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {baseNet !== null && result.rows.length > 0 && (
          <div className="meta" style={{ fontSize: 12, marginTop: 8 }}>Utilisé : <b>{result.used}</b> / {totalAddr} adresses · restant : <b>{totalAddr - result.used}</b>.</div>
        )}
        {(() => {
          const devs = result.rows.flatMap(r => r.devices.map(d => ({ ...d, sub: r.name, mask: r.mask, gw: r.gw })));
          if (!devs.length) return null;
          return (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, margin: '0 0 6px' }}>🖥️ Table d’adressage des équipements</div>
              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 640 }}>
                  <thead><tr style={{ background: 'var(--surface-2)' }}>{['Équipement', 'Type', 'Sous-réseau', 'Adresse IP', 'Masque', 'Passerelle'].map(h => <th key={h} style={{ textAlign: 'left', padding: '7px 9px', borderBottom: '2px solid var(--border)', fontSize: 12.5, whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {devs.map((d, i) => (
                      <tr key={i}>
                        {td(<b>{d.name}</b>)}
                        {td(<span>{dinfo(d.type).icon} {dinfo(d.type).label}</span>)}
                        {td(d.sub, { color: 'var(--text-muted)' })}
                        {td(d.ip === null ? <span className="meta">— (niveau 2)</span> : <b style={{ ...mono, color: 'var(--accent)' }}>{ipToStr(d.ip)}</b>)}
                        {td(d.ip === null ? '—' : <span style={mono}>{ipToStr(d.mask)}</span>)}
                        {td(d.ip === null ? '—' : <span style={mono}>{ipToStr(d.gw)}</span>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

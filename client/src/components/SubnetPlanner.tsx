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

type Sub = { name: string; hosts: string };
type Row = { name: string; need: number; cidr: number; net: number; first: number; last: number; bc: number; usable: number; mask: number; gw: number };

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
  const [subs, setSubs] = useState<Sub[]>([{ name: 'Production', hosts: '100' }, { name: 'Bureaux', hosts: '50' }, { name: 'Wi-Fi', hosts: '20' }, { name: 'Liaison', hosts: '2' }]);
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
      rows.push({ name, need, cidr: cidrN, net, first, last, bc, usable: size - 2, mask: maskFromCidr(cidrN), gw: gwLast ? last : first });
      ptr = (bc + 1) >>> 0;
      return true;
    };
    if (mode === 'vlsm') {
      const list = subs.map(s => ({ name: s.name || 'Sous-réseau', need: Math.max(1, Number(s.hosts) || 0) })).filter(s => s.need > 0);
      list.sort((a, b) => b.need - a.need);
      for (const s of list) { if (!mk(s.name, s.need, 32 - hostBitsFor(s.need))) break; }
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
    return [head, 'Nom\tReseau/CIDR\tMasque\tPlage utilisable\tBroadcast\tPasserelle\tHotes', ...lines].join('\n');
  }, [result, baseNet, cidr, totalAddr]);

  const copy = () => { navigator.clipboard?.writeText(planText).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }).catch(() => {}); };

  const setSub = (i: number, p: Partial<Sub>) => setSubs(a => a.map((x, k) => k === i ? { ...x, ...p } : x));
  const addSub = () => setSubs(a => [...a, { name: 'Sous-réseau', hosts: '10' }]);
  const delSub = (i: number) => setSubs(a => a.filter((_, k) => k !== i));
  const importBulk = () => {
    const rows = bulk.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => { const p = l.split(/\s+/); const hosts = p[p.length - 1]; const name = p.slice(0, -1).join(' ') || 'Sous-réseau'; return { name, hosts: /^\d+$/.test(hosts) ? hosts : '10' }; });
    if (rows.length) { setSubs(a => [...a, ...rows]); setBulk(''); }
  };

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
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8, marginBottom: 7, alignItems: 'center' }}>
              <input style={fieldStyle} value={s.name} onChange={e => setSub(i, { name: e.target.value })} placeholder="Nom du service" />
              <input style={fieldStyle} type="number" min={1} value={s.hosts} onChange={e => setSub(i, { hosts: e.target.value })} placeholder="hôtes" />
              <button style={smallBtn} onClick={() => delSub(i)}>✕</button>
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
      </div>
    </div>
  );
}

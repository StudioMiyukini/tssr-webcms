import { useMemo, useState, type CSSProperties } from 'react';

/**
 * Convertisseur hexadécimal ↔ texte (UTF-8) / décimal / binaire, + décodage Base64.
 * Pensé pour l'analyse de trames : coller un dump hexa et lire le contenu ASCII.
 * Îlot React hydraté via RichContent (data-block="hex-converter").
 */

const field: CSSProperties = { width: '100%', padding: '9px 11px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box', fontFamily: 'ui-monospace,monospace' };
const group: CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface-2)', marginBottom: 14 };
const legend: CSSProperties = { fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const btn: CSSProperties = { padding: '6px 12px', border: '1px solid var(--accent)', borderRadius: 8, background: 'transparent', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 12.5 };
const smallBtn: CSSProperties = { ...btn, padding: '3px 10px', fontSize: 12 };
const pre: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'ui-monospace,monospace', fontSize: 12.5, lineHeight: 1.5, color: 'var(--text)', maxHeight: 260, overflow: 'auto' };
const label: CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-soft)' };

type Mode = 'hex2txt' | 'txt2hex' | 'b64';
const MODES: { id: Mode; label: string }[] = [
  { id: 'hex2txt', label: 'Hexa → texte' },
  { id: 'txt2hex', label: 'Texte → hexa' },
  { id: 'b64', label: 'Base64 → texte' },
];

function parseHex(s: string): { bytes: number[]; odd: boolean } {
  const clean = s.replace(/0x/gi, '').replace(/[^0-9a-fA-F]/g, '');
  const bytes: number[] = [];
  for (let i = 0; i + 2 <= clean.length; i += 2) bytes.push(parseInt(clean.slice(i, i + 2), 16));
  return { bytes, odd: clean.length % 2 === 1 };
}
const toHex = (n: number) => n.toString(16).padStart(2, '0');
const printable = (s: string) => [...s].map(c => { const n = c.charCodeAt(0); return (n === 10 || n === 9) ? c : (n < 32 || n === 127) ? '·' : c; }).join('');
// Extrait les suites d'au moins 3 caractères imprimables (comme la commande `strings`).
const readableStrings = (bytes: number[]) => { const out: string[] = []; let cur = ''; for (const b of bytes) { if (b >= 32 && b < 127) cur += String.fromCharCode(b); else { if (cur.length >= 3) out.push(cur); cur = ''; } } if (cur.length >= 3) out.push(cur); return out; };
// Vue hexdump : offset · 16 octets en hexa · colonne ASCII.
const hexdump = (bytes: number[]) => { const lines: string[] = []; for (let i = 0; i < bytes.length; i += 16) { const c = bytes.slice(i, i + 16); const off = i.toString(16).padStart(8, '0'); const hx = c.map(toHex).join(' ').padEnd(47, ' '); const asc = c.map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join(''); lines.push(`${off}  ${hx}  ${asc}`); } return lines.join('\n'); };
const DEFAULT_HEX = '47 45 54 20 2f 69 6e 64 65 78 2e 68 74 6d 6c 20 48 54 54 50 2f 31 2e 31';

export function HexConverter() {
  const [mode, setMode] = useState<Mode>('hex2txt');
  const [input, setInput] = useState(DEFAULT_HEX);
  const [copied, setCopied] = useState('');
  const copy = (k: string, t: string) => { navigator.clipboard?.writeText(t).then(() => { setCopied(k); setTimeout(() => setCopied(''), 1400); }).catch(() => {}); };

  const res = useMemo(() => {
    if (mode === 'hex2txt') {
      const { bytes, odd } = parseHex(input);
      const arr = Uint8Array.from(bytes);
      const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(arr);
      return {
        count: bytes.length, odd,
        rows: [
          { key: 'texte', label: 'Texte (UTF-8 / ASCII)', value: printable(utf8) || '—' },
          { key: 'strings', label: 'Chaînes lisibles (≥ 3 car. — comme « strings »)', value: readableStrings(bytes).join('\n') || '—' },
          { key: 'dump', label: 'Vue hexdump (offset · hexa · ASCII)', value: hexdump(bytes) || '—' },
          { key: 'decimal', label: 'Décimal (par octet)', value: bytes.join(' ') },
          { key: 'binaire', label: 'Binaire (par octet)', value: bytes.map(b => b.toString(2).padStart(8, '0')).join(' ') },
        ],
      };
    }
    if (mode === 'txt2hex') {
      const bytes = Array.from(new TextEncoder().encode(input));
      return {
        count: bytes.length, odd: false,
        rows: [
          { key: 'hex', label: 'Hexadécimal', value: bytes.map(toHex).join(' ') },
          { key: 'decimal', label: 'Décimal', value: bytes.join(' ') },
          { key: 'binaire', label: 'Binaire', value: bytes.map(b => b.toString(2).padStart(8, '0')).join(' ') },
        ],
      };
    }
    // Base64 → texte
    try {
      const clean = input.replace(/\s+/g, '');
      if (!clean) return { count: 0, odd: false, rows: [{ key: 'texte', label: 'Texte décodé', value: '—' }] };
      const arr = Uint8Array.from(atob(clean), c => c.charCodeAt(0));
      const txt = new TextDecoder('utf-8', { fatal: false }).decode(arr);
      return {
        count: arr.length, odd: false,
        rows: [
          { key: 'texte', label: 'Texte décodé', value: printable(txt) || '—' },
          { key: 'hex', label: 'Hexadécimal', value: Array.from(arr).map(toHex).join(' ') },
        ],
      };
    } catch {
      return { count: 0, odd: false, error: 'Chaîne Base64 invalide.', rows: [] as { key: string; label: string; value: string }[] };
    }
  }, [mode, input]);

  const placeholder = mode === 'hex2txt' ? '48 65 6c 6c 6f  (ou 0x48, 48:65…, retours à la ligne acceptés)'
    : mode === 'txt2hex' ? 'Tape un texte à convertir en hexadécimal…'
      : 'Y29uZmlkZW50aWVs';

  return (
    <div style={{ margin: '14px 0' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {MODES.map(m => (
          <button key={m.id} type="button" onClick={() => setMode(m.id)} style={{ padding: '7px 14px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600, border: `1px solid ${mode === m.id ? 'var(--accent)' : 'var(--border)'}`, background: mode === m.id ? 'var(--accent)' : 'var(--surface)', color: mode === m.id ? '#fff' : 'var(--text)' }}>{m.label}</button>
        ))}
      </div>

      <div style={group}>
        <div style={legend}>
          {mode === 'b64' ? '🔓 Base64 à décoder' : mode === 'txt2hex' ? '✏️ Texte à convertir' : '🔢 Hexadécimal à convertir'}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button type="button" onClick={() => setInput('')} style={smallBtn}>Effacer</button>
            {mode === 'hex2txt' && <button type="button" onClick={() => setInput(DEFAULT_HEX)} style={smallBtn}>Exemple</button>}
          </span>
        </div>
        <textarea value={input} onChange={e => setInput(e.target.value)} placeholder={placeholder} rows={5} style={{ ...field, resize: 'vertical', lineHeight: 1.5 }} spellCheck={false} />
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
          {mode === 'hex2txt' && <>Tout ce qui n’est pas un chiffre hexa (espaces, <code>0x</code>, <code>:</code>, retours à la ligne) est ignoré. <strong>{res.count}</strong> octet(s).{res.odd ? ' ⚠️ nombre de caractères impair — le dernier demi-octet est ignoré.' : ''}</>}
          {mode === 'txt2hex' && <><strong>{res.count}</strong> octet(s) (encodage UTF-8).</>}
          {mode === 'b64' && <>Décodé en UTF-8. <strong>{res.count}</strong> octet(s).</>}
        </div>
      </div>

      <div style={group}>
        <div style={legend}>➡️ Résultat</div>
        {'error' in res && res.error && <div style={{ color: '#dc2626', fontSize: 13 }}>⚠ {res.error}</div>}
        {res.rows.map(r => (
          <div key={r.key} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
              <span style={label}>{r.label}</span>
              <button type="button" onClick={() => copy(r.key, r.value)} style={{ ...smallBtn, marginLeft: 'auto' }}>{copied === r.key ? '✓ Copié' : 'Copier'}</button>
            </div>
            <pre style={pre}>{r.value}</pre>
          </div>
        ))}
      </div>

      {mode === 'b64' && (
        <div style={{ ...group, borderColor: '#ca8a04', background: 'color-mix(in srgb,#ca8a04 8%,transparent)' }}>
          <div style={{ fontSize: 12.5, lineHeight: 1.6 }}>💡 Le <strong>Base64</strong> n’est <strong>pas</strong> du chiffrement : il est trivialement réversible. Dans une trame HTTP, <code>Authorization: Basic &lt;base64&gt;</code> encode simplement <code>identifiant:mot_de_passe</code> — d’où l’intérêt du HTTPS. Colle la valeur après « Basic » pour révéler les identifiants.</div>
        </div>
      )}
    </div>
  );
}

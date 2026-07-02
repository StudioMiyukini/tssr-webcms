import { useMemo, useRef, useState } from 'react';

/** Exerciseur de subnetting : génère une IP + /CIDR aléatoire et fait retrouver
 *  adresse réseau, plage utilisable, broadcast, nombre d'hôtes et masque.
 *  Tout est calculé en bits (IPv4 = entier 32 bits non signé). */

type Diff = 'facile' | 'moyen' | 'difficile';
type FieldKey = 'network' | 'first' | 'last' | 'broadcast' | 'hosts' | 'mask';

const FIELDS: Array<{ key: FieldKey; label: string; kind: 'ip' | 'num'; ph: string }> = [
  { key: 'network', label: 'Adresse réseau (idSR)', kind: 'ip', ph: 'ex. 192.168.1.0' },
  { key: 'first', label: '1re IP utilisable', kind: 'ip', ph: 'ex. 192.168.1.1' },
  { key: 'last', label: 'Dernière IP utilisable', kind: 'ip', ph: 'ex. 192.168.1.254' },
  { key: 'broadcast', label: 'Adresse de broadcast', kind: 'ip', ph: 'ex. 192.168.1.255' },
  { key: 'hosts', label: "Nombre d'hôtes utilisables", kind: 'num', ph: 'ex. 254' },
  { key: 'mask', label: 'Masque (décimal)', kind: 'ip', ph: 'ex. 255.255.255.0' },
];

const DIFFS: Array<{ key: Diff; label: string; hint: string }> = [
  { key: 'facile', label: 'Facile', hint: '/24 à /30' },
  { key: 'moyen', label: 'Moyen', hint: '/16 à /30' },
  { key: 'difficile', label: 'Difficile', hint: '/8 à /30' },
];

const randInt = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const ipToStr = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
function strToIp(s: string): number | null {
  const m = s.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const o = m.slice(1, 5).map(Number);
  if (o.some(x => x > 255)) return null;
  return (((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0);
}
const maskFromCidr = (c: number) => (c === 0 ? 0 : (0xFFFFFFFF << (32 - c)) >>> 0);

function makeExercise(diff: Diff): { ip: number; cidr: number } {
  const [lo, hi] = diff === 'facile' ? [24, 30] : diff === 'difficile' ? [8, 30] : [16, 30];
  const cidr = randInt(lo, hi);
  let o1 = randInt(1, 223); if (o1 === 127) o1 = 126;
  const ip = (((o1 << 24) | (randInt(0, 255) << 16) | (randInt(0, 255) << 8) | randInt(0, 255)) >>> 0);
  return { ip, cidr };
}
function solve(ip: number, cidr: number) {
  const mask = maskFromCidr(cidr);
  const network = (ip & mask) >>> 0;
  const broadcast = (network | ((~mask) >>> 0)) >>> 0;
  const hosts = Math.pow(2, 32 - cidr) - 2;
  const first = (network + 1) >>> 0;
  const last = (broadcast - 1) >>> 0;
  return { mask, network, broadcast, first, last, hosts };
}

export function SubnetTrainer() {
  const [diff, setDiff] = useState<Diff>('moyen');
  const [ex, setEx] = useState(() => makeExercise('moyen'));
  const [ans, setAns] = useState<Record<FieldKey, string>>({ network: '', first: '', last: '', broadcast: '', hosts: '', mask: '' });
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState({ good: 0, total: 0 });
  const [showMethod, setShowMethod] = useState(false);
  const firstInput = useRef<HTMLInputElement>(null);

  const sol = useMemo(() => solve(ex.ip, ex.cidr), [ex]);
  const expected = useMemo<Record<FieldKey, string>>(() => ({
    network: ipToStr(sol.network), first: ipToStr(sol.first), last: ipToStr(sol.last),
    broadcast: ipToStr(sol.broadcast), hosts: String(sol.hosts), mask: ipToStr(sol.mask),
  }), [sol]);

  const isCorrect = (k: FieldKey): boolean => {
    const a = ans[k];
    if (k === 'hosts') return a.trim() !== '' && Number(a.trim().replace(/\s/g, '')) === sol.hosts;
    const v = strToIp(a);
    return v !== null && ipToStr(v) === expected[k];
  };

  const allGood = FIELDS.every(f => isCorrect(f.key));

  const check = () => {
    if (checked) return;
    setChecked(true);
    setScore(s => ({ good: s.good + (FIELDS.every(f => isCorrect(f.key)) ? 1 : 0), total: s.total + 1 }));
  };
  const next = () => {
    setEx(makeExercise(diff));
    setAns({ network: '', first: '', last: '', broadcast: '', hosts: '', mask: '' });
    setChecked(false);
    setTimeout(() => firstInput.current?.focus(), 20);
  };
  const changeDiff = (d: Diff) => { setDiff(d); setEx(makeExercise(d)); setAns({ network: '', first: '', last: '', broadcast: '', hosts: '', mask: '' }); setChecked(false); };

  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); checked ? next() : check(); } };

  // Éléments de correction (méthode du nombre magique).
  const octetIndex = ex.cidr === 0 ? 0 : Math.floor((ex.cidr - 1) / 8);
  const maskOctets = [(sol.mask >>> 24) & 255, (sol.mask >>> 16) & 255, (sol.mask >>> 8) & 255, sol.mask & 255];
  const magic = 256 - maskOctets[octetIndex];

  return (
    <div className="snet" onKeyDown={onKey}>
      <div className="snet-bar">
        <div className="snet-diffs">
          {DIFFS.map(d => (
            <button key={d.key} type="button" className={`snet-diff ${diff === d.key ? 'active' : ''}`} onClick={() => changeDiff(d.key)} title={d.hint}>{d.label}</button>
          ))}
        </div>
        <div className="snet-score">Score : <b>{score.good}</b>/{score.total}{score.total > 0 && <span className="snet-pct"> ({Math.round((score.good / score.total) * 100)}%)</span>}</div>
      </div>

      <div className="snet-q">
        <span className="snet-q-label">Trouve les informations du réseau :</span>
        <span className="snet-q-ip">{ipToStr(ex.ip)} <b>/{ex.cidr}</b></span>
      </div>

      <div className="snet-grid">
        {FIELDS.map((f, i) => {
          const ok = checked && isCorrect(f.key);
          const ko = checked && !isCorrect(f.key);
          return (
            <div key={f.key} className={`snet-row ${ok ? 'ok' : ''} ${ko ? 'ko' : ''}`}>
              <label className="snet-label" htmlFor={`snet-${f.key}`}>{f.label}</label>
              <div className="snet-inwrap">
                <input
                  id={`snet-${f.key}`} ref={i === 0 ? firstInput : undefined}
                  className="snet-input" value={ans[f.key]} disabled={checked}
                  onChange={e => setAns(a => ({ ...a, [f.key]: e.target.value }))}
                  placeholder={f.ph} autoComplete="off" spellCheck={false}
                  inputMode={f.kind === 'num' ? 'numeric' : 'text'}
                />
                {checked && <span className={`snet-mark ${ok ? 'ok' : 'ko'}`}>{ok ? '✓' : '✕'}</span>}
              </div>
              {ko && <div className="snet-correct">Réponse : <b>{expected[f.key]}</b></div>}
            </div>
          );
        })}
      </div>

      <div className="snet-actions">
        {!checked
          ? <button type="button" className="snet-btn primary" onClick={check}>Vérifier</button>
          : <button type="button" className="snet-btn primary" onClick={next}>Nouvel exercice →</button>}
        <button type="button" className="snet-btn ghost" onClick={next}>Passer</button>
        <button type="button" className="snet-btn ghost" onClick={() => setShowMethod(m => !m)}>{showMethod ? 'Cacher la méthode' : 'Voir la méthode'}</button>
      </div>

      {checked && (
        <div className={`snet-verdict ${allGood ? 'ok' : 'ko'}`}>
          {allGood ? '✅ Parfait, tout est juste !' : '❌ Quelques erreurs — regarde les réponses et la correction ci-dessous.'}
        </div>
      )}

      {(checked || showMethod) && (
        <div className="snet-method">
          <div className="snet-method-title">🧮 Méthode du nombre magique</div>
          <ol className="snet-steps">
            <li>Masque du <code>/{ex.cidr}</code> = <b>{ipToStr(sol.mask)}</b> (les {ex.cidr} premiers bits à 1).</li>
            <li>Octet « intéressant » : le <b>{octetIndex + 1}ᵉ</b> octet du masque = <b>{maskOctets[octetIndex]}</b>.</li>
            <li>Nombre magique (taille de bloc) = 256 − {maskOctets[octetIndex]} = <b>{magic}</b>.</li>
            <li>Adresse réseau : on descend au multiple de {magic} sur cet octet → <b>{ipToStr(sol.network)}</b>.</li>
            <li>Broadcast = réseau + taille du bloc − 1 → <b>{ipToStr(sol.broadcast)}</b>.</li>
            <li>Plage utilisable : <b>{ipToStr(sol.first)}</b> → <b>{ipToStr(sol.last)}</b>.</li>
            <li>Nombre d'hôtes = 2^(32−{ex.cidr}) − 2 = <b>{sol.hosts}</b>.</li>
          </ol>
        </div>
      )}
    </div>
  );
}

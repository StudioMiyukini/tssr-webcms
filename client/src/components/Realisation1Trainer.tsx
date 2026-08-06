import { Fragment, useEffect, useMemo, useState } from 'react';

/**
 * Entraînement auto-corrigé de la « Réalisation 1 Windows » (contexte Engineer Aero),
 * joué DANS des répliques des vraies fenêtres Windows (Propriétés TCP/IPv4, Gestionnaire
 * de commutateur virtuel Hyper-V, Gestionnaire DNS / Nouvel hôte, Ajouter un site Web IIS,
 * Assistant Nouvelle étendue DHCP). L'élève refait la réalisation en aveugle ; chaque étape
 * est validée (valeur attendue + astuce) et cumulée en score.
 * Îlot React hydraté via RichContent (data-block="realisation1-trainer").
 *
 * Solution de référence (cf. page correction-realisation-1-windows) :
 *   réseau 192.168.10.0/24, PAS de passerelle (réseau interne isolé), PAS d'AD.
 *   Serveur DNS+Web .250 · Serveur DHCP .251 · Client .101 · DNS de toutes = .250.
 *   Domaine engineer<prénom>.lan (le prénom = celui du technicien, saisi par l'élève).
 */

// ─── Constantes de la solution ───
const IP_SRV = '192.168.10.250';
const IP_DHCP = '192.168.10.251';
const IP_CLIENT = '192.168.10.101';
const MASK24 = '255.255.255.0';
const DHCP_COUNT = 25;

// ─── Helpers réseau ───
const ipToNum = (ip: string): number | null => {
  const m = ip.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const o = [1, 2, 3, 4].map(i => Number(m[i]));
  if (o.some(n => n > 255)) return null;
  return ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0;
};
const normIp = (ip: string): string => { const n = ipToNum(ip); return n === null ? '' : [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.'); };
const sameIp = (a: string, b: string) => normIp(a) !== '' && normIp(a) === normIp(b);
const isEmptyIp = (v: string) => !v || !v.replace(/[.\s]/g, '');
const inNet10 = (ip: string) => { const n = ipToNum(ip); const base = ipToNum('192.168.10.0')!; return n !== null && (n & ~255) === (base & ~255); };
const host10 = (ip: string) => { const n = ipToNum(ip); return n === null ? -1 : n & 255; };

const slugPrenom = (p: string) => p.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const domainFor = (p: string) => `engineer${slugPrenom(p) || '<prénom>'}.lan`;
const normName = (s: string) => s.trim().toLowerCase();

// ─── Validation ───
type Check = { label: string; ok: boolean; want?: string; hint?: string };
type Result = { checks: Check[]; score: number; total: number };
const scoreOf = (checks: Check[]): Result => ({ checks, score: checks.filter(c => c.ok).length, total: checks.length });

// ─── Style « fenêtre Windows » (couleurs figées : un dialogue Windows reste clair) ───
const WIN_CSS = `
.r1w{color:#000}
.r1w-win{background:#f0f0f0;border:1px solid #6f6f6f;border-radius:6px;box-shadow:0 8px 26px rgba(0,0,0,.30);margin:14px 0;max-width:540px;font-family:"Segoe UI",Tahoma,Geneva,sans-serif;font-size:12.5px;line-height:1.5;overflow:hidden}
.r1w-tb{display:flex;align-items:center;gap:9px;background:#fff;border-bottom:1px solid #dcdcdc;padding:8px 10px}
.r1w-tb .ic{font-size:15px;line-height:1}
.r1w-tb .tt{font-weight:600;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#1a1a1a}
.r1w-tb .win-btns{display:flex;gap:2px;color:#666}
.r1w-tb .win-btns span{width:30px;height:20px;display:grid;place-items:center;font-size:12px}
.r1w-body{padding:14px 16px;background:#f0f0f0}
.r1w-foot{display:flex;justify-content:flex-end;gap:8px;padding:10px 14px 12px;background:#f0f0f0}
.r1w-btn{min-width:76px;padding:5px 12px;border:1px solid #adadad;border-radius:3px;background:linear-gradient(#fdfdfd,#e7e7e7);font-size:12.5px;font-family:inherit;color:#000;cursor:default}
.r1w-btn.def{border-color:#2b7de0;box-shadow:0 0 0 1px #cfe4ff inset}
.r1w-radio{display:flex;align-items:flex-start;gap:7px;margin:6px 0}
.r1w-radio input{margin-top:2px}
.r1w-row{display:flex;align-items:center;gap:10px;margin:6px 0}
.r1w-row.ind{margin-left:26px}
.r1w-row>label.lb{flex:0 0 158px;text-align:left}
.r1w-in{border:1px solid #7a7a7a;background:#fff;padding:3px 6px;font-size:12.5px;font-family:inherit;color:#000;min-width:0}
.r1w-in:focus{outline:1px solid #2b7de0}
.r1w-ipc{display:inline-flex;align-items:center;border:1px solid #7a7a7a;background:#fff;height:25px;padding:0 3px}
.r1w-ipc input{width:34px;border:0;text-align:center;font-size:12.5px;font-family:inherit;outline:none;background:transparent;color:#000}
.r1w-ipc input:disabled{background:#eef1f4;color:#888}
.r1w-ipc .dot{width:6px;text-align:center;color:#333;font-weight:700}
.r1w-fs{border:1px solid #b6b6b6;border-radius:3px;padding:8px 12px 12px;margin:10px 0}
.r1w-fs>.lg{font-size:11.5px;color:#333;padding:0 4px;margin:-16px 0 4px -4px;display:inline-block;background:#f0f0f0}
.r1w-list{border:1px solid #7a7a7a;background:#fff;margin:6px 0}
.r1w-list .hdr,.r1w-list .rw{display:grid;grid-template-columns:1.2fr 1fr;gap:0}
.r1w-list .hdr>div{background:#eef1f4;border-bottom:1px solid #cfcfcf;padding:4px 8px;font-weight:600;font-size:11.5px}
.r1w-list .rw>div{border-bottom:1px solid #ececec;padding:5px 8px;display:flex;align-items:center;gap:6px}
.r1w-tabs{display:flex;gap:5px;flex-wrap:wrap;margin:6px 0 2px}
.r1w-tab{padding:6px 13px;border:1px solid var(--border);border-radius:9px 9px 0 0;background:var(--surface-2);color:var(--text);cursor:pointer;font-size:13px;font-weight:600}
.r1w-tab.on{background:var(--accent);color:#fff;border-color:var(--accent)}
.r1w-cap{font-size:12px;color:#444;margin:0 0 8px}
`;

// Contrôle « adresse IP » à 4 octets (comme le contrôle Win32).
function IpBox({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const parts = (value || '').split('.');
  const oct = [0, 1, 2, 3].map(i => parts[i] ?? '');
  const setOct = (i: number, raw: string) => {
    const nv = raw.replace(/\D/g, '').slice(0, 3);
    const o = [0, 1, 2, 3].map(k => (parts[k] ?? ''));
    o[i] = nv;
    onChange(o.every(x => x === '') ? '' : o.join('.'));
  };
  return (
    <span className="r1w-ipc" aria-disabled={disabled}>
      {[0, 1, 2, 3].map(i => (
        <Fragment key={i}>
          {i > 0 && <span className="dot">.</span>}
          <input inputMode="numeric" value={oct[i]} disabled={disabled} onChange={e => setOct(i, e.target.value)} />
        </Fragment>
      ))}
    </span>
  );
}

// Châssis de fenêtre : barre de titre + corps + pied (boutons).
function Win({ title, icon = '🪟', children, ok = 'OK' }: { title: string; icon?: string; children: React.ReactNode; ok?: string }) {
  return (
    <div className="r1w-win">
      <div className="r1w-tb"><span className="ic">{icon}</span><span className="tt">{title}</span><span className="win-btns"><span>—</span><span>▢</span><span>✕</span></span></div>
      <div className="r1w-body">{children}</div>
      <div className="r1w-foot"><span className="r1w-btn def">{ok}</span><span className="r1w-btn">Annuler</span></div>
    </div>
  );
}

const LS_KEY = 'r1trainer_v2';
type Ans = Record<string, string>;
const DEFAULTS: Ans = {
  prenom: '',
  sw: '',
  m1name: '', m1ram: '', m1c: '', m1d: '', m1ip: '', m1mask: '', m1gw: '', m1dns: '',
  m2name: '', m2ram: '', m2c: '', m2d: '', m2ip: '', m2mask: '', m2gw: '', m2dns: '',
  m3name: '', m3ram: '', m3c: '', m3d: '', m3ip: '', m3mask: '', m3gw: '', m3dns: '',
  zone: '', aSrv: '', aDhcp: '', aClient: '',
  s1name: '', s1host: '', s1port: '', s2name: '', s2host: '', s2port: '',
  dStart: '', dEnd: '', dMask: '', dLen: '24', dDns: '', dDomain: '', dRes: '',
  hvIp: '', hvMask: '',
};

const STEPS = [
  { id: 'base', icon: '①', color: '#64748b', title: 'Configuration de base', sub: 'Commutateur interne, IP fixes (TCP/IPv4), noms' },
  { id: 'dns', icon: '②', color: '#3b82f6', title: 'Rôle DNS', sub: 'Zone directe + enregistrements A (Nouvel hôte)' },
  { id: 'iis', icon: '③', color: '#22c55e', title: 'Service Web (IIS)', sub: 'Deux sites (Ajouter un site Web)' },
  { id: 'dhcp', icon: '④', color: '#f97316', title: 'Service DHCP', sub: 'Assistant Nouvelle étendue + réservation' },
  { id: 'hv', icon: '⑤', color: '#8b5cf6', title: 'Hyper-V — machine physique', sub: 'IP de la carte vEthernet (interne)' },
] as const;
type StepId = typeof STEPS[number]['id'];

const MACHINES = [
  { key: 'm1', role: '🌐 Serveur DNS / Web', suggest: 'SRV-DNS-WEB', ip: IP_SRV, ram: 4096, c: 50, d: 10 },
  { key: 'm2', role: '📶 Serveur DHCP', suggest: 'SRV-DHCP', ip: IP_DHCP, ram: 4096, c: 50, d: 0 },
  { key: 'm3', role: '💻 Client Windows', suggest: 'CLIENT-W', ip: IP_CLIENT, ram: 4096, c: 40, d: 15 },
] as const;

// Égalité numérique (tolère espaces/unités parasites) & champ « vide ».
const numEq = (v: string, n: number) => v.trim() !== '' && parseInt(v.replace(/[^\d]/g, ''), 10) === n;
const numEmpty = (v: string) => v.trim() === '';

// Styles thème (hors fenêtres) pour le contexte / résultats.
const field: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 4 };
const group: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface-2)', marginBottom: 14 };
const legend: React.CSSProperties = { fontWeight: 700, fontSize: 14.5, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 };
const btn = (primary: boolean): React.CSSProperties => ({ padding: '9px 16px', border: primary ? 'none' : '1px solid var(--border)', borderRadius: 8, background: primary ? 'var(--accent)' : 'transparent', color: primary ? '#fff' : 'var(--text)', fontWeight: 700, cursor: 'pointer', fontSize: 13.5 });
const mono: React.CSSProperties = { fontFamily: 'ui-monospace,"Space Mono",monospace' };

export function Realisation1Trainer() {
  const [ans, setAns] = useState<Ans>(() => {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(LS_KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
  });
  const [results, setResults] = useState<Partial<Record<StepId, Result>>>({});
  const [reveal, setReveal] = useState<Partial<Record<StepId, boolean>>>({});
  const [mTab, setMTab] = useState(0); // machine sélectionnée (étape 1)
  const [sTab, setSTab] = useState(0); // site IIS sélectionné (étape 3)

  useEffect(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(ans)); } catch { /* indispo */ } }, [ans]);

  const put = (k: string, v: string) => setAns(a => ({ ...a, [k]: v }));
  const setTxt = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => put(k, e.target.value);
  const domain = domainFor(ans.prenom);
  const presHost = `presentation.${domain}`;
  const intraHost = `intranet.${domain}`;
  const hasPrenom = slugPrenom(ans.prenom) !== '';

  // ─── Validateurs ───
  const validators: Record<StepId, () => Result> = {
    base: () => scoreOf([
      { label: 'Noms des 3 machines renseignés et distincts', ok: [ans.m1name, ans.m2name, ans.m3name].every(n => n.trim()) && new Set([normName(ans.m1name), normName(ans.m2name), normName(ans.m3name)]).size === 3, hint: 'Convention conseillée : SRV-DNS-WEB, SRV-DHCP, CLIENT-W' },
      { label: 'Mémoire (RAM) des 3 VM = 4096 Mo', ok: ['m1', 'm2', 'm3'].every(k => numEq(ans[`${k}ram`], 4096)), want: '4096 Mo (4 Go)' },
      { label: 'Disques Serveur DNS/Web : C 50 Go + D 10 Go', ok: numEq(ans.m1c, 50) && numEq(ans.m1d, 10), want: 'C : 50 Go · D : 10 Go' },
      { label: 'Disques Serveur DHCP : C 50 Go (un seul disque)', ok: numEq(ans.m2c, 50) && numEmpty(ans.m2d), want: 'C : 50 Go (pas de disque D:)' },
      { label: 'Disques Client : C 40 Go + D 15 Go', ok: numEq(ans.m3c, 40) && numEq(ans.m3d, 15), want: 'C : 40 Go · D : 15 Go' },
      { label: 'Serveur DNS/Web — adresse IP', ok: sameIp(ans.m1ip, IP_SRV), want: IP_SRV },
      { label: 'Serveur DHCP — adresse IP', ok: sameIp(ans.m2ip, IP_DHCP), want: IP_DHCP },
      { label: 'Client Windows — adresse IP', ok: sameIp(ans.m3ip, IP_CLIENT), want: IP_CLIENT },
      { label: 'Masque de sous-réseau des 3 = 255.255.255.0', ok: [ans.m1mask, ans.m2mask, ans.m3mask].every(m => sameIp(m, MASK24)), want: MASK24 },
      { label: 'Passerelle par défaut laissée VIDE (réseau isolé)', ok: [ans.m1gw, ans.m2gw, ans.m3gw].every(isEmptyIp), want: '(champ vide — aucune passerelle)', hint: 'Réseau interne isolé : pas de routeur, donc pas de passerelle' },
      { label: 'Serveur DNS préféré des 3 = 192.168.10.250', ok: [ans.m1dns, ans.m2dns, ans.m3dns].every(d => sameIp(d, IP_SRV)), want: IP_SRV, hint: 'Toutes les machines pointent vers le serveur DNS' },
      { label: 'Commutateur virtuel = Interne', ok: ans.sw === 'Interne', want: 'Interne', hint: 'Interne = VM ↔ VM ET VM ↔ hôte (Privé exclut l’hôte)' },
    ]),
    dns: () => scoreOf([
      { label: 'Nom de la zone de recherche directe', ok: normName(ans.zone) === domain && hasPrenom, want: domain, hint: 'engineer + votre prénom + .lan' },
      { label: 'Hôte (A) — serveur (racine / www)', ok: sameIp(ans.aSrv, IP_SRV), want: IP_SRV },
      { label: 'Hôte (A) — dhcp', ok: sameIp(ans.aDhcp, IP_DHCP), want: IP_DHCP },
      { label: 'Hôte (A) — client-w', ok: sameIp(ans.aClient, IP_CLIENT), want: IP_CLIENT },
    ]),
    iis: () => scoreOf([
      { label: 'Site Présentation — nom d’hôte', ok: normName(ans.s1host) === presHost && hasPrenom, want: presHost },
      { label: 'Site Présentation — port', ok: ans.s1port.trim() === '80', want: '80' },
      { label: 'Site intranet — nom d’hôte', ok: normName(ans.s2host) === intraHost && hasPrenom, want: intraHost },
      { label: 'Site intranet — port', ok: ans.s2port.trim() === '8080', want: '8080', hint: 'Deux sites sur la même IP .250 → distingués par le nom d’hôte' },
    ]),
    dhcp: () => {
      const s = host10(ans.dStart), e = host10(ans.dEnd), r = host10(ans.dRes);
      const rangeOk = inNet10(ans.dStart) && inNet10(ans.dEnd) && s >= 1 && e <= 254 && s <= e;
      const countOk = rangeOk && (e - s + 1) === DHCP_COUNT;
      const resOk = inNet10(ans.dRes) && rangeOk && r >= s && r <= e;
      return scoreOf([
        { label: `Plage de distribution = exactement ${DHCP_COUNT} adresses`, ok: countOk, want: `ex. 192.168.10.111 → 192.168.10.135 (${DHCP_COUNT})`, hint: 'IP de fin − IP de début + 1 = 25' },
        { label: 'Masque de sous-réseau de l’étendue', ok: sameIp(ans.dMask, MASK24), want: MASK24 },
        { label: 'Option 006 (Serveurs DNS) = 192.168.10.250', ok: sameIp(ans.dDns, IP_SRV), want: IP_SRV },
        { label: 'Option 015 (Nom de domaine)', ok: normName(ans.dDomain) === domain && hasPrenom, want: domain },
        { label: 'Réservation du client (dans la plage)', ok: resOk, want: 'une IP comprise dans la plage', hint: 'Réservée par l’adresse MAC du client' },
      ]);
    },
    hv: () => {
      const h = host10(ans.hvIp);
      const free = ![250, 251, 101].includes(h);
      return scoreOf([
        { label: 'IP de la carte vEthernet dans 192.168.10.0/24', ok: inNet10(ans.hvIp) && h >= 1 && h <= 254 && free, want: 'ex. 192.168.10.1 (libre, ≠ .250/.251/.101)', hint: 'Même sous-réseau que les VM → communication hôte ↔ VM' },
        { label: 'Masque de sous-réseau = 255.255.255.0', ok: sameIp(ans.hvMask, MASK24), want: MASK24 },
      ]);
    },
  };
  const check = (id: StepId) => setResults(r => ({ ...r, [id]: validators[id]() }));

  const totals = useMemo(() => {
    let score = 0, total = 0, done = 0;
    for (const st of STEPS) { const r = results[st.id]; if (r) { score += r.score; total += r.total; if (r.score === r.total) done++; } }
    return { score, total, done, allDone: done === STEPS.length };
  }, [results]);

  const resetAll = () => { setAns({ ...DEFAULTS, prenom: ans.prenom }); setResults({}); setReveal({}); setMTab(0); setSTab(0); };

  // ─── Rendus partagés ───
  const ResultBox = ({ id }: { id: StepId }) => {
    const r = results[id]; if (!r) return null;
    const perfect = r.score === r.total;
    return (
      <div style={{ marginTop: 12, border: `1px solid ${perfect ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, padding: '12px 14px', background: 'var(--surface)' }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: perfect ? '#16a34a' : 'var(--text)' }}>{perfect ? '✅' : '📝'} {r.score} / {r.total} correct{r.score > 1 ? 's' : ''}</div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {r.checks.map((c, i) => (
            <li key={i} style={{ fontSize: 13, lineHeight: 1.45 }}>
              <span style={{ color: c.ok ? '#16a34a' : '#dc2626', fontWeight: 700 }}>{c.ok ? '✓' : '✗'}</span> {c.label}
              {!c.ok && c.want && <div className="meta" style={{ fontSize: 12, marginLeft: 18 }}>Attendu : <span style={mono}>{c.want}</span></div>}
              {!c.ok && c.hint && <div className="meta" style={{ fontSize: 11.5, marginLeft: 18, opacity: 0.85 }}>💡 {c.hint}</div>}
            </li>
          ))}
        </ul>
      </div>
    );
  };
  const Banner = ({ i }: { i: number }) => {
    const st = STEPS[i];
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '26px 0 10px', padding: '12px 16px', border: '1px solid var(--border)', borderLeft: `6px solid ${st.color}`, borderRadius: 12, background: 'var(--surface-2)' }}>
        <span style={{ flex: '0 0 auto', width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', fontWeight: 700, color: '#fff', background: st.color, fontSize: 16 }}>{st.icon}</span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 800 }}>{st.title}</span>
          <span className="meta" style={{ fontSize: 12.5 }}>{st.sub}</span>
        </span>
      </div>
    );
  };
  const RevealBtn = ({ id, expected }: { id: StepId; expected: React.ReactNode }) => (
    <div style={{ marginTop: 8 }}>
      <button type="button" onClick={() => setReveal(v => ({ ...v, [id]: !v[id] }))} style={{ ...btn(false), padding: '5px 11px', fontSize: 12.5, color: 'var(--text-soft)' }}>{reveal[id] ? '🙈 Cacher le corrigé' : '👁️ Voir le corrigé'}</button>
      {reveal[id] && <div style={{ marginTop: 8, border: '1px dashed var(--border)', borderRadius: 8, padding: '10px 12px', background: 'var(--surface)', fontSize: 13, lineHeight: 1.6 }}>{expected}</div>}
    </div>
  );
  const CheckBtn = ({ id, n }: { id: StepId; n: number }) => <button type="button" style={btn(true)} onClick={() => check(id)}>Vérifier l’étape {n}</button>;

  const m = MACHINES[mTab];
  const mk = m.key;

  return (
    <div className="r1w" style={{ margin: '14px 0' }}>
      <style>{WIN_CSS}</style>

      {/* Contexte + prénom (hors fenêtres) */}
      <aside className="pb-note pb-note-blue" style={{ marginBottom: 14 }}>
        <p className="pb-note-title">🎯 Le contexte (Engineer Aero)</p>
        <p>Vous êtes embauché·e comme <strong>technicien réseau</strong>. Montez l’infrastructure : <strong>3 VM</strong> sur un réseau <strong>interne isolé</strong> <span style={mono}>192.168.10.0/24</span> (⚠️ <strong>pas de passerelle</strong>, <strong>pas d’Active Directory</strong>), rôles <strong>DNS</strong>, <strong>Web (IIS, 2 sites)</strong>, <strong>DHCP</strong>, puis communication avec la <strong>machine physique</strong>. Remplissez chaque <strong>vraie fenêtre Windows</strong> ci-dessous, puis « Vérifier ».</p>
      </aside>
      <div style={group}>
        <div style={legend}>👤 Votre prénom (pour le domaine et les sites)</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 200px', minWidth: 160 }}><label style={lbl}>Prénom du technicien (vous)</label><input style={field} value={ans.prenom} onChange={setTxt('prenom')} placeholder="Jean" /></div>
          <div style={{ flex: '1 1 240px', minWidth: 200 }}><label style={lbl}>Domaine attendu</label><input style={{ ...field, ...mono, fontWeight: 700, color: 'var(--accent)' }} value={domain} readOnly /></div>
        </div>
      </div>

      {/* ── Étape 1 ── */}
      <Banner i={0} />

      <Win title="Gestionnaire de commutateur virtuel — Nouveau commutateur" icon="🖧">
        <p className="r1w-cap">Quel type de commutateur virtuel créer pour relier les 3 VM ?</p>
        {[['Externe', 'Réseau externe (accès à la carte physique / Internet)'], ['Interne', 'Réseau interne (VM entre elles ET avec l’hôte)'], ['Privé', 'Réseau privé (VM entre elles uniquement)']].map(([v, d]) => (
          <label key={v} className="r1w-radio"><input type="radio" name="r1sw" checked={ans.sw === v} onChange={() => put('sw', v)} /><span><strong>{v}</strong> — {d}</span></label>
        ))}
      </Win>

      <div className="r1w-tabs">
        {MACHINES.map((mm, i) => <button key={mm.key} className={`r1w-tab${i === mTab ? ' on' : ''}`} onClick={() => setMTab(i)}>{mm.role}</button>)}
      </div>

      <Win title={`Paramètres de « ${ans[`${mk}name`] || m.suggest} » — Hyper-V`} icon="🖥️">
        <p className="r1w-cap">Matériel de la VM : mémoire vive et disque(s) dur(s) virtuel(s) (VHDX).</p>
        <div className="r1w-fs">
          <span className="lg">Mémoire</span>
          <div className="r1w-row"><label className="lb">Mémoire de démarrage :</label><input className="r1w-in" style={{ width: 84 }} inputMode="numeric" value={ans[`${mk}ram`]} onChange={setTxt(`${mk}ram`)} placeholder="4096" /><span>Mo</span></div>
        </div>
        <div className="r1w-fs">
          <span className="lg">Disques durs (VHDX)</span>
          <div className="r1w-row"><label className="lb">Disque 1 — système (C:) :</label><input className="r1w-in" style={{ width: 64 }} inputMode="numeric" value={ans[`${mk}c`]} onChange={setTxt(`${mk}c`)} placeholder="50" /><span>Go</span></div>
          <div className="r1w-row"><label className="lb">Disque 2 (D:) :</label><input className="r1w-in" style={{ width: 64 }} inputMode="numeric" value={ans[`${mk}d`]} onChange={setTxt(`${mk}d`)} placeholder="10" /><span>Go — laisser vide si aucun</span></div>
        </div>
      </Win>

      <Win title="Propriétés système — Nom de l’ordinateur" icon="💻">
        <p className="r1w-cap">Machine : <strong>{m.role}</strong> — cliquez sur « Modifier… » puis saisissez le nom.</p>
        <div className="r1w-row"><label className="lb">Nom de l’ordinateur :</label><input className="r1w-in" style={{ width: 200 }} value={ans[`${mk}name`]} onChange={setTxt(`${mk}name`)} placeholder={m.suggest} /></div>
        <p className="r1w-cap" style={{ marginTop: 6 }}>Aucun domaine à joindre (pas d’Active Directory) — laisser en groupe de travail.</p>
      </Win>

      <Win title="Propriétés de : Protocole Internet version 4 (TCP/IPv4)" icon="🌐">
        <label className="r1w-radio"><input type="radio" checked={false} readOnly /><span>Obtenir une adresse IP automatiquement</span></label>
        <label className="r1w-radio"><input type="radio" checked readOnly /><span>Utiliser l’adresse IP suivante :</span></label>
        <div className="r1w-row ind"><label className="lb">Adresse IP :</label><IpBox value={ans[`${mk}ip`]} onChange={v => put(`${mk}ip`, v)} /></div>
        <div className="r1w-row ind"><label className="lb">Masque de sous-réseau :</label><IpBox value={ans[`${mk}mask`]} onChange={v => put(`${mk}mask`, v)} /></div>
        <div className="r1w-row ind"><label className="lb">Passerelle par défaut :</label><IpBox value={ans[`${mk}gw`]} onChange={v => put(`${mk}gw`, v)} /></div>
        <label className="r1w-radio" style={{ marginTop: 8 }}><input type="radio" checked={false} readOnly /><span>Obtenir les adresses des serveurs DNS automatiquement</span></label>
        <label className="r1w-radio"><input type="radio" checked readOnly /><span>Utiliser l’adresse de serveur DNS suivante :</span></label>
        <div className="r1w-row ind"><label className="lb">Serveur DNS préféré :</label><IpBox value={ans[`${mk}dns`]} onChange={v => put(`${mk}dns`, v)} /></div>
        <div className="r1w-row ind"><label className="lb">Serveur DNS auxiliaire :</label><IpBox value={''} onChange={() => {}} disabled /></div>
      </Win>

      <CheckBtn id="base" n={1} />
      <ResultBox id="base" />
      <RevealBtn id="base" expected={<ul style={{ margin: 0, paddingLeft: 18 }}>
        <li><strong>RAM</strong> : 4096 Mo pour les 3. <strong>Disques</strong> : SRV-DNS-WEB C 50 + D 10 · SRV-DHCP C 50 (seul) · CLIENT-W C 40 + D 15.</li>
        <li>SRV-DNS-WEB → <span style={mono}>{IP_SRV}</span> · masque <span style={mono}>{MASK24}</span> · DNS <span style={mono}>{IP_SRV}</span></li>
        <li>SRV-DHCP → <span style={mono}>{IP_DHCP}</span> · CLIENT-W → <span style={mono}>{IP_CLIENT}</span> (même masque, même DNS)</li>
        <li><strong>Passerelle vide</strong> partout · commutateur <strong>Interne</strong> · domaine <span style={mono}>{domain}</span> · pas d’AD</li>
      </ul>} />

      {/* ── Étape 2 ── */}
      <Banner i={1} />
      <Win title="Nouvelle zone — Nom de la zone" icon="🌐">
        <p className="r1w-cap">Assistant Nouvelle zone → zone de <strong>recherche directe</strong>, principale.</p>
        <div className="r1w-row"><label className="lb">Nom de la zone :</label><input className="r1w-in" style={{ width: 220 }} value={ans.zone} onChange={setTxt('zone')} placeholder="engineer___.lan" /></div>
      </Win>
      <Win title="Gestionnaire DNS — Nouvel hôte (A)" icon="🌐">
        <p className="r1w-cap">Créez un enregistrement <strong>A</strong> (hôte) pour chaque machine dans la zone.</p>
        <div className="r1w-list">
          <div className="hdr"><div>Nom (utilise le domaine parent)</div><div>Adresse IP</div></div>
          {[['serveur (racine / www)', 'aSrv'], ['dhcp', 'aDhcp'], ['client-w', 'aClient']].map(([name, k]) => (
            <div className="rw" key={k}><div>{name}</div><div><IpBox value={ans[k]} onChange={v => put(k, v)} /></div></div>
          ))}
        </div>
      </Win>
      <CheckBtn id="dns" n={2} />
      <ResultBox id="dns" />
      <RevealBtn id="dns" expected={<span>Zone <span style={mono}>{domain}</span> — A : serveur <span style={mono}>{IP_SRV}</span>, dhcp <span style={mono}>{IP_DHCP}</span>, client-w <span style={mono}>{IP_CLIENT}</span> (+ un alias CNAME par machine).</span>} />

      {/* ── Étape 3 ── */}
      <Banner i={2} />
      <div className="r1w-tabs">
        {['🖥️ Site Présentation', '🔒 Site intranet'].map((t, i) => <button key={t} className={`r1w-tab${i === sTab ? ' on' : ''}`} onClick={() => setSTab(i)}>{t}</button>)}
      </div>
      {(() => {
        const p = sTab === 0 ? '1' : '2';
        const eg = sTab === 0 ? { name: 'Présentation', host: 'presentation.engineer___.lan', port: '80' } : { name: 'intranet', host: 'intranet.engineer___.lan', port: '8080' };
        return (
          <Win title="Ajouter un site Web" icon="🕸️">
            <div className="r1w-row"><label className="lb">Nom du site :</label><input className="r1w-in" style={{ width: 200 }} value={ans[`s${p}name`]} onChange={setTxt(`s${p}name`)} placeholder={eg.name} /></div>
            <div className="r1w-row"><label className="lb">Chemin d’accès physique :</label><input className="r1w-in" style={{ width: 200 }} placeholder={`C:\\inetpub\\${eg.name.toLowerCase()}`} defaultValue="" /></div>
            <div className="r1w-fs">
              <span className="lg">Liaison</span>
              <div className="r1w-row"><label className="lb">Type :</label><input className="r1w-in" value="http" readOnly style={{ width: 70, background: '#eef1f4', color: '#666' }} /></div>
              <div className="r1w-row"><label className="lb">Adresse IP :</label><input className="r1w-in" value="192.168.10.250" readOnly style={{ width: 130, background: '#eef1f4', color: '#666' }} /></div>
              <div className="r1w-row"><label className="lb">Port :</label><input className="r1w-in" style={{ width: 70 }} value={ans[`s${p}port`]} onChange={setTxt(`s${p}port`)} placeholder={eg.port} /></div>
              <div className="r1w-row"><label className="lb">Nom d’hôte :</label><input className="r1w-in" style={{ width: 220 }} value={ans[`s${p}host`]} onChange={setTxt(`s${p}host`)} placeholder={eg.host} /></div>
            </div>
          </Win>
        );
      })()}
      <CheckBtn id="iis" n={3} />
      <ResultBox id="iis" />
      <RevealBtn id="iis" expected={<span>Présentation : <span style={mono}>{presHost}</span> port <strong>80</strong> — intranet : <span style={mono}>{intraHost}</span> port <strong>8080</strong>. Même IP <span style={mono}>{IP_SRV}</span>, distingués par le nom d’hôte.</span>} />

      {/* ── Étape 4 ── */}
      <Banner i={3} />
      <Win title="Assistant Nouvelle étendue — Plage d’adresses IP" icon="📶">
        <p className="r1w-cap">Saisissez la plage d’adresses que ce serveur DHCP distribue.</p>
        <div className="r1w-row"><label className="lb">Adresse IP de début :</label><IpBox value={ans.dStart} onChange={v => put('dStart', v)} /></div>
        <div className="r1w-row"><label className="lb">Adresse IP de fin :</label><IpBox value={ans.dEnd} onChange={v => put('dEnd', v)} /></div>
        <div className="r1w-row"><label className="lb">Longueur :</label><input className="r1w-in" style={{ width: 54 }} value={ans.dLen} onChange={setTxt('dLen')} /><label className="lb" style={{ flex: '0 0 auto' }}>Masque de sous-réseau :</label><IpBox value={ans.dMask} onChange={v => put('dMask', v)} /></div>
        {(() => { const s = host10(ans.dStart), e = host10(ans.dEnd); const n = (inNet10(ans.dStart) && inNet10(ans.dEnd) && s <= e) ? e - s + 1 : null; return n !== null && <p className="r1w-cap" style={{ marginTop: 6 }}>Plage saisie : <strong style={{ color: n === DHCP_COUNT ? '#0a7d28' : '#c1121f' }}>{n}</strong> adresse{n > 1 ? 's' : ''} (objectif : {DHCP_COUNT}).</p>; })()}
      </Win>
      <Win title="Configurer les options DHCP" icon="⚙️">
        <div className="r1w-row"><label className="lb">006 — Serveurs DNS :</label><IpBox value={ans.dDns} onChange={v => put('dDns', v)} /></div>
        <div className="r1w-row"><label className="lb">015 — Nom de domaine :</label><input className="r1w-in" style={{ width: 220 }} value={ans.dDomain} onChange={setTxt('dDomain')} placeholder="engineer___.lan" /></div>
      </Win>
      <Win title="Nouvelle réservation" icon="📌">
        <div className="r1w-row"><label className="lb">Nom de la réservation :</label><input className="r1w-in" style={{ width: 180 }} placeholder="CLIENT-W" defaultValue="" /></div>
        <div className="r1w-row"><label className="lb">Adresse IP :</label><IpBox value={ans.dRes} onChange={v => put('dRes', v)} /></div>
        <div className="r1w-row"><label className="lb">Adresse MAC :</label><input className="r1w-in" style={{ width: 180 }} placeholder="00-15-5D-.." defaultValue="" /></div>
      </Win>
      <CheckBtn id="dhcp" n={4} />
      <ResultBox id="dhcp" />
      <RevealBtn id="dhcp" expected={<span>Plage de <strong>25</strong> (ex. <span style={mono}>.111 → .135</span>), masque <span style={mono}>{MASK24}</span>, option 006 = <span style={mono}>{IP_SRV}</span>, option 015 = <span style={mono}>{domain}</span>, réservation du client dans la plage (ex. <span style={mono}>.111</span>).</span>} />

      {/* ── Étape 5 ── */}
      <Banner i={4} />
      <Win title="Propriétés de : Protocole Internet version 4 (TCP/IPv4) — carte vEthernet (COM_Int)" icon="🖥️">
        <p className="r1w-cap">Sur la <strong>machine physique</strong> : donnez une IP libre du même sous-réseau à la carte vEthernet du commutateur interne.</p>
        <label className="r1w-radio"><input type="radio" checked readOnly /><span>Utiliser l’adresse IP suivante :</span></label>
        <div className="r1w-row ind"><label className="lb">Adresse IP :</label><IpBox value={ans.hvIp} onChange={v => put('hvIp', v)} /></div>
        <div className="r1w-row ind"><label className="lb">Masque de sous-réseau :</label><IpBox value={ans.hvMask} onChange={v => put('hvMask', v)} /></div>
        <div className="r1w-row ind"><label className="lb">Passerelle par défaut :</label><IpBox value={''} onChange={() => {}} disabled /></div>
      </Win>
      <CheckBtn id="hv" n={5} />
      <ResultBox id="hv" />
      <RevealBtn id="hv" expected={<span>Carte vEthernet (COM_Int) en <span style={mono}>192.168.10.1</span>, masque <span style={mono}>{MASK24}</span> (ou toute IP libre <span style={mono}>.1 → .254</span> hors <span style={mono}>.250/.251/.101</span>).</span>} />

      {/* ── Bilan ── */}
      {totals.total > 0 && (
        <div style={{ marginTop: 24, border: `2px solid ${totals.allDone ? '#16a34a' : 'var(--accent)'}`, borderRadius: 12, padding: '16px 18px', background: 'var(--surface-2)' }}>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>{totals.allDone ? '🏆 Réalisation validée !' : '📊 Bilan provisoire'} — {totals.score} / {totals.total}</div>
          <div className="meta" style={{ fontSize: 13 }}>{totals.done} / {STEPS.length} étape{totals.done > 1 ? 's' : ''} parfaite{totals.done > 1 ? 's' : ''}. {!totals.allDone && 'Corrige les ✗ puis revérifie.'}</div>
          <div style={{ height: 8, borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--border)', marginTop: 10, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.round((totals.score / totals.total) * 100)}%`, background: totals.allDone ? '#16a34a' : 'var(--accent)', transition: 'width .3s' }} />
          </div>
          <div style={{ marginTop: 12 }}><button type="button" style={{ ...btn(false), padding: '7px 14px', fontSize: 13 }} onClick={resetAll}>↺ Recommencer (garde le prénom)</button></div>
        </div>
      )}
    </div>
  );
}

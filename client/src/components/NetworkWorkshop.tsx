import { useEffect, useMemo, useState, type CSSProperties } from 'react';

/**
 * Atelier Réseau & Packet Tracer — assistant multi-étapes à contexte partagé.
 * Îlot React hydraté via RichContent (data-block="network-workshop").
 *
 * Étapes : 1) Contexte  2) Préférences  3) Segmentation (multi-routeurs + attribution
 * automatique des interfaces)  4) Schéma  5) Pools DHCP  6) DNS.
 * Le contexte est persisté dans le navigateur (localStorage) et partagé entre les étapes.
 *
 * NB : les étapes 4-6 sont en cours de construction (placeholders) — le moteur de calcul
 * (computePlan) est déjà central pour les alimenter ensuite.
 */

// ─────────────────────────────────────────── Helpers IP ───────────────────────────────────────────
const ipToStr = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
function strToIp(s: string): number | null {
  const m = s.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const o = m.slice(1, 5).map(Number);
  if (o.some(x => x > 255)) return null;
  return (((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0);
}
const maskFromCidr = (c: number) => (c === 0 ? 0 : (0xFFFFFFFF << (32 - c)) >>> 0);
const wildcardFromCidr = (c: number) => (~maskFromCidr(c)) >>> 0;
const hostBitsFor = (need: number) => { let n = 1; while (Math.pow(2, n) - 2 < Math.max(1, need)) n++; return n; };
const clampNum = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ─────────────────────────────────────────── Modèle (contexte) ───────────────────────────────────────────
export type RouterModel = '2811' | '2911';
export type LinkMedia = 'serial' | 'gig';

export type Service = { id: string; name: string; hosts: string; routerId: string; hasSwitch: boolean; dhcp: boolean };
export type RouterDef = { id: string; name: string; model: RouterModel };
export type LinkDef = { id: string; aId: string; bId: string; media: LinkMedia };

export type Ctx = {
  // 1. Contexte
  entreprise: string; domaine: string; mode: 'neuf' | 'extension';
  baseIp: string; baseCidr: string;
  services: Service[];
  // 3. Topologie
  routers: RouterDef[];
  links: LinkDef[];
  // 2. Préférences
  login: string; mdp: string; secret: string;
  gwPos: 'last' | 'first';                 // position IP passerelle (routeur) dans le sous-réseau
  switchPos: 'beforeRouter' | 'firstHost'; // position IP de gestion du switch
  linkCidr: string;                        // masque des liaisons inter-routeurs (/30 par défaut)
  dnsServer: string;
};

let _uid = 0;
const uid = (p: string) => `${p}${++_uid}`;

export const DEFAULT_CTX: Ctx = {
  entreprise: 'Miyukini', domaine: 'miyukini.lan', mode: 'neuf',
  baseIp: '192.168.10.0', baseCidr: '24',
  services: [
    { id: 'sA', name: 'Production', hosts: '100', routerId: 'rA', hasSwitch: true, dhcp: true },
    { id: 'sB', name: 'Bureaux', hosts: '50', routerId: 'rA', hasSwitch: true, dhcp: true },
    { id: 'sC', name: 'Wi-Fi', hosts: '20', routerId: 'rB', hasSwitch: true, dhcp: true },
  ],
  routers: [
    { id: 'rA', name: 'R1', model: '2911' },
    { id: 'rB', name: 'R2', model: '2811' },
  ],
  links: [{ id: 'lA', aId: 'rA', bId: 'rB', media: 'serial' }],
  login: 'admin', mdp: 'Azerty77', secret: 'MonSecretEnable',
  gwPos: 'last', switchPos: 'beforeRouter', linkCidr: '30', dnsServer: '',
};

// ─────────────────────────────────────────── Interfaces Cisco ───────────────────────────────────────────
const ethName = (m: RouterModel, i: number) => (m === '2811' ? `FastEthernet0/${i}` : `GigabitEthernet0/${i}`);
const ethMax = (m: RouterModel) => (m === '2811' ? 2 : 3);
const ethLabel = (m: RouterModel) => (m === '2811' ? 'FastEthernet' : 'GigabitEthernet');
const SER_SLOTS = ['Serial0/0/0', 'Serial0/0/1', 'Serial0/1/0', 'Serial0/1/1'];

// ─────────────────────────────────────────── Moteur (fonction pure) ───────────────────────────────────────────
export type Sub = {
  kind: 'lan' | 'link'; id: string; name: string;
  net: number; first: number; last: number; bc: number; usable: number; mask: number; cidr: number;
  gw: number | null; switchIp: number | null; routerId?: string; dhcp?: boolean; media?: LinkMedia;
};
export type Iface = {
  routerId: string; routerName: string; iface: string; target: string;
  ip: number; mask: number; cidr: number; role: string; clock: boolean;
};
export type Plan = {
  ok: boolean; error: string; warnings: string[];
  baseNet: number; baseBc: number; cidr: number; totalAddr: number; used: number;
  subs: Sub[]; ifaces: Iface[];
};

export function computePlan(ctx: Ctx): Plan {
  const warnings: string[] = [];
  const baseNum = strToIp(ctx.baseIp);
  const cidr = clampNum(Number(ctx.baseCidr) || 24, 1, 30);
  if (baseNum === null) return { ok: false, error: 'Adresse réseau de base invalide.', warnings, baseNet: 0, baseBc: 0, cidr, totalAddr: 0, used: 0, subs: [], ifaces: [] };
  const baseNet = (baseNum & maskFromCidr(cidr)) >>> 0;
  const baseBc = (baseNet | wildcardFromCidr(cidr)) >>> 0;
  const linkCidr = clampNum(Number(ctx.linkCidr) || 30, 8, 30);

  type Item = { id: string; kind: 'lan' | 'link'; need: number; cidr: number };
  const items: Item[] = [];
  for (const s of ctx.services) { const need = Math.max(1, Number(s.hosts) || 0); items.push({ id: 'svc:' + s.id, kind: 'lan', need, cidr: 32 - hostBitsFor(need) }); }
  for (const l of ctx.links) items.push({ id: 'lnk:' + l.id, kind: 'link', need: 2, cidr: linkCidr });

  // Allocation VLSM : les plus gros blocs d'abord.
  const alloc = new Map<string, { net: number; first: number; last: number; bc: number; usable: number; mask: number; cidr: number }>();
  const order = [...items].sort((x, y) => Math.pow(2, 32 - y.cidr) - Math.pow(2, 32 - x.cidr));
  let ptr = baseNet; let error = '';
  for (const it of order) {
    const size = Math.pow(2, 32 - it.cidr);
    const net = ptr >>> 0; const bc = (net + size - 1) >>> 0;
    if (bc > baseBc) { error = `Plus de place dans ${ipToStr(baseNet)}/${cidr} pour allouer un bloc /${it.cidr}. Réduis les besoins ou élargis le réseau de base.`; break; }
    alloc.set(it.id, { net, first: (net + 1) >>> 0, last: (bc - 1) >>> 0, bc, usable: size - 2, mask: maskFromCidr(it.cidr), cidr: it.cidr });
    ptr = (bc + 1) >>> 0;
  }

  const subs: Sub[] = [];
  const ifaces: Iface[] = [];
  const cap = new Map<string, { eth: number; ser: number }>();
  ctx.routers.forEach(r => cap.set(r.id, { eth: 0, ser: 0 }));
  const nextEth = (r: RouterDef): string | null => {
    const c = cap.get(r.id)!; if (c.eth >= ethMax(r.model)) { warnings.push(`${r.name} (${r.model}) : plus d'interface ${ethLabel(r.model)} libre (${ethMax(r.model)} max).`); return null; }
    const name = ethName(r.model, c.eth); c.eth++; return name;
  };
  const nextSer = (r: RouterDef): string | null => {
    const c = cap.get(r.id)!; if (c.ser >= SER_SLOTS.length) { warnings.push(`${r.name} : plus d'interface série libre.`); return null; }
    const name = SER_SLOTS[c.ser]; c.ser++; return name;
  };

  // LAN (dans l'ordre des services)
  for (const s of ctx.services) {
    const a = alloc.get('svc:' + s.id); if (!a) continue;
    const gw = ctx.gwPos === 'last' ? a.last : a.first;
    const switchIp = s.hasSwitch ? (ctx.gwPos === 'last' ? (a.last - 1) >>> 0 : (a.first + 1) >>> 0) : null;
    subs.push({ kind: 'lan', id: 'svc:' + s.id, name: s.name || 'LAN', net: a.net, first: a.first, last: a.last, bc: a.bc, usable: a.usable, mask: a.mask, cidr: a.cidr, gw, switchIp, routerId: s.routerId, dhcp: s.dhcp });
    const r = ctx.routers.find(x => x.id === s.routerId);
    if (!r) { warnings.push(`« ${s.name || 'LAN'} » n'a pas de routeur passerelle assigné.`); continue; }
    const ifc = nextEth(r);
    if (ifc) ifaces.push({ routerId: r.id, routerName: r.name, iface: ifc, target: `LAN ${s.name || ''}`.trim(), ip: gw, mask: a.mask, cidr: a.cidr, role: 'Passerelle LAN', clock: false });
  }
  // Liaisons inter-routeurs (dans l'ordre des liens)
  for (const l of ctx.links) {
    const a = alloc.get('lnk:' + l.id); if (!a) continue;
    const ra = ctx.routers.find(x => x.id === l.aId); const rb = ctx.routers.find(x => x.id === l.bId);
    subs.push({ kind: 'link', id: 'lnk:' + l.id, name: `Lien ${ra?.name || '?'}–${rb?.name || '?'}`, net: a.net, first: a.first, last: a.last, bc: a.bc, usable: a.usable, mask: a.mask, cidr: a.cidr, gw: null, switchIp: null, media: l.media });
    const ipA = a.first; const ipB = (a.first + 1) >>> 0;
    if (ra) { const ifc = l.media === 'serial' ? nextSer(ra) : nextEth(ra); if (ifc) ifaces.push({ routerId: ra.id, routerName: ra.name, iface: ifc, target: `Lien → ${rb?.name || '?'}`, ip: ipA, mask: a.mask, cidr: a.cidr, role: l.media === 'serial' ? 'Liaison série (DCE)' : 'Liaison', clock: l.media === 'serial' }); }
    if (rb) { const ifc = l.media === 'serial' ? nextSer(rb) : nextEth(rb); if (ifc) ifaces.push({ routerId: rb.id, routerName: rb.name, iface: ifc, target: `Lien → ${ra?.name || '?'}`, ip: ipB, mask: a.mask, cidr: a.cidr, role: l.media === 'serial' ? 'Liaison série (DTE)' : 'Liaison', clock: false }); }
  }

  return { ok: !error, error, warnings, baseNet, baseBc, cidr, totalAddr: (baseBc - baseNet + 1) >>> 0, used: (ptr - baseNet) >>> 0, subs, ifaces };
}

// ─────────────────────────────────────────── Styles ───────────────────────────────────────────
const field: CSSProperties = { width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13.5, boxSizing: 'border-box' };
const label: CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 4 };
const group: CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface-2)', marginBottom: 14 };
const legend: CSSProperties = { fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const btn: CSSProperties = { padding: '6px 11px', border: '1px solid var(--accent)', borderRadius: 8, background: 'transparent', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 12.5, whiteSpace: 'nowrap' };
const smallBtn: CSSProperties = { ...btn, padding: '3px 9px', fontSize: 12, borderColor: 'var(--border)', color: 'var(--text-soft)' };
const mono: CSSProperties = { fontFamily: 'ui-monospace,monospace' };
const th: CSSProperties = { textAlign: 'left', padding: '7px 9px', borderBottom: '2px solid var(--border)', fontSize: 12, color: 'var(--text-soft)', whiteSpace: 'nowrap' };
const td: CSSProperties = { padding: '6px 9px', borderBottom: '1px solid var(--border)', fontSize: 12.5, whiteSpace: 'nowrap' };

const STEPS = [
  { n: 1, icon: '🧾', title: 'Contexte' },
  { n: 2, icon: '⚙️', title: 'Préférences' },
  { n: 3, icon: '🧮', title: 'Segmentation' },
  { n: 4, icon: '🗺️', title: 'Schéma' },
  { n: 5, icon: '📶', title: 'Pools DHCP' },
  { n: 6, icon: '🌐', title: 'DNS' },
];
const STORAGE_KEY = 'net_workshop_v1';

// ─────────────────────────────────────────── Composant principal ───────────────────────────────────────────
export function NetworkWorkshop() {
  const [ctx, setCtx] = useState<Ctx>(() => {
    try { const v = localStorage.getItem(STORAGE_KEY); if (v) return { ...DEFAULT_CTX, ...JSON.parse(v) } as Ctx; } catch { /* */ }
    return DEFAULT_CTX;
  });
  const [step, setStep] = useState(1);
  const [copied, setCopied] = useState('');

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ctx)); } catch { /* */ } }, [ctx]);

  const set = (p: Partial<Ctx>) => setCtx(c => ({ ...c, ...p }));
  const plan = useMemo(() => computePlan(ctx), [ctx]);

  const copy = (key: string, text: string) => { navigator.clipboard?.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(''), 1600); }).catch(() => {}); };

  // — services —
  const setSvc = (id: string, p: Partial<Service>) => set({ services: ctx.services.map(s => s.id === id ? { ...s, ...p } : s) });
  const addSvc = () => set({ services: [...ctx.services, { id: uid('s'), name: 'Nouveau LAN', hosts: '10', routerId: ctx.routers[0]?.id || '', hasSwitch: true, dhcp: true }] });
  const delSvc = (id: string) => set({ services: ctx.services.filter(s => s.id !== id) });
  // — routers —
  const setRtr = (id: string, p: Partial<RouterDef>) => set({ routers: ctx.routers.map(r => r.id === id ? { ...r, ...p } : r) });
  const addRtr = () => set({ routers: [...ctx.routers, { id: uid('r'), name: 'R' + (ctx.routers.length + 1), model: '2911' }] });
  const delRtr = (id: string) => set({ routers: ctx.routers.filter(r => r.id !== id), links: ctx.links.filter(l => l.aId !== id && l.bId !== id), services: ctx.services.map(s => s.routerId === id ? { ...s, routerId: '' } : s) });
  // — links —
  const setLink = (id: string, p: Partial<LinkDef>) => set({ links: ctx.links.map(l => l.id === id ? { ...l, ...p } : l) });
  const addLink = () => set({ links: [...ctx.links, { id: uid('l'), aId: ctx.routers[0]?.id || '', bId: ctx.routers[1]?.id || ctx.routers[0]?.id || '', media: 'serial' }] });
  const delLink = (id: string) => set({ links: ctx.links.filter(l => l.id !== id) });

  const rname = (id: string) => ctx.routers.find(r => r.id === id)?.name || '—';

  // Texte exportable du plan (étapes 3/4).
  const planText = useMemo(() => {
    if (!plan.subs.length) return '';
    const head = `Reseau de base : ${ipToStr(plan.baseNet)}/${plan.cidr}  (${plan.totalAddr} adresses, ${plan.used} utilisees)`;
    const subLines = plan.subs.map(s => `${s.name}\t${ipToStr(s.net)}/${s.cidr}\t${ipToStr(s.mask)}\t${ipToStr(s.first)} - ${ipToStr(s.last)}\tbc ${ipToStr(s.bc)}\t${s.gw !== null ? 'gw ' + ipToStr(s.gw) : '(lien)'}\t${s.usable} hotes`);
    const ifLines = plan.ifaces.map(i => `${i.routerName}\t${i.iface}\t${i.target}\t${ipToStr(i.ip)}\t${ipToStr(i.mask)}\t${i.role}${i.clock ? '  [clock rate 64000]' : ''}`);
    return [head, '', 'Sous-reseaux :', 'Nom\tReseau/CIDR\tMasque\tPlage utilisable\tBroadcast\tPasserelle\tHotes', ...subLines,
      '', 'Table d adressage des interfaces :', 'Routeur\tInterface\tCible\tIP\tMasque\tRole', ...ifLines].join('\n');
  }, [plan]);

  return (
    <div style={{ margin: '14px 0' }}>
      {/* Stepper */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {STEPS.map(s => {
          const active = step === s.n;
          const done = s.n > 3;
          return (
            <button key={s.n} type="button" onClick={() => setStep(s.n)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent)' : 'var(--surface)', color: active ? '#fff' : (done ? 'var(--text-muted)' : 'var(--text)') }}>
              <span style={{ opacity: active ? 1 : .85 }}>{s.icon}</span>
              <span>{s.n}. {s.title}</span>
            </button>
          );
        })}
      </div>

      {/* ── Étape 1 : Contexte ── */}
      {step === 1 && (
        <div>
          <div style={group}>
            <div style={legend}>🧾 Contexte de l’exercice</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
              <div><label style={label}>Nom de l’entreprise</label><input style={field} value={ctx.entreprise} onChange={e => set({ entreprise: e.target.value })} placeholder="Miyukini" /></div>
              <div><label style={label}>Nom de domaine</label><input style={field} value={ctx.domaine} onChange={e => set({ domaine: e.target.value })} placeholder="miyukini.lan" /></div>
              <div>
                <label style={label}>Infrastructure</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['neuf', 'extension'] as const).map(m => (
                    <button key={m} type="button" onClick={() => set({ mode: m })} style={{ flex: 1, padding: '7px 8px', border: `1px solid ${ctx.mode === m ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, background: ctx.mode === m ? 'var(--accent)' : 'var(--surface)', color: ctx.mode === m ? '#fff' : 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: 12.5 }}>{m === 'neuf' ? '🌱 Neuve' : '🧩 Extension'}</button>
                  ))}
                </div>
              </div>
              <div><label style={label}>Réseau de base (IP)</label><input style={{ ...field, ...mono }} value={ctx.baseIp} onChange={e => set({ baseIp: e.target.value })} placeholder="192.168.10.0" /></div>
              <div><label style={label}>Masque (CIDR)</label><input style={{ ...field, ...mono }} value={ctx.baseCidr} onChange={e => set({ baseCidr: e.target.value.replace(/\D/g, '') })} placeholder="24" /></div>
            </div>
          </div>

          <div style={group}>
            <div style={legend}>🧩 Sous-réseaux / services (besoin en hôtes)</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 380 }}>
                <thead><tr><th style={th}>Service / sous-réseau</th><th style={th}>Hôtes</th><th style={th}></th></tr></thead>
                <tbody>
                  {ctx.services.map(s => (
                    <tr key={s.id}>
                      <td style={td}><input style={field} value={s.name} onChange={e => setSvc(s.id, { name: e.target.value })} /></td>
                      <td style={{ ...td, width: 90 }}><input style={{ ...field, ...mono }} value={s.hosts} onChange={e => setSvc(s.id, { hosts: e.target.value.replace(/\D/g, '') })} /></td>
                      <td style={{ ...td, width: 40 }}><button type="button" onClick={() => delSvc(s.id)} style={{ ...smallBtn, color: '#dc2626', borderColor: 'transparent' }} title="Supprimer">✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addSvc} style={{ ...btn, marginTop: 10 }}>+ Ajouter un sous-réseau</button>
            <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>Le nombre d’hôtes pilote le découpage VLSM à l’étape 3. La topologie (routeurs, liaisons) et l’attribution se règlent aussi à l’étape 3.</div>
          </div>
          <StepNav step={step} setStep={setStep} />
        </div>
      )}

      {/* ── Étape 2 : Préférences ── */}
      {step === 2 && (
        <div>
          <div style={group}>
            <div style={legend}>🔐 Identifiants standards (Cisco)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }}>
              <div><label style={label}>Login admin</label><input style={field} value={ctx.login} onChange={e => set({ login: e.target.value })} placeholder="admin" /></div>
              <div><label style={label}>Mot de passe</label><input style={field} value={ctx.mdp} onChange={e => set({ mdp: e.target.value })} placeholder="Azerty77" /></div>
              <div><label style={label}>Enable secret</label><input style={field} value={ctx.secret} onChange={e => set({ secret: e.target.value })} placeholder="MonSecretEnable" /></div>
              <div><label style={label}>Serveur DNS (optionnel)</label><input style={{ ...field, ...mono }} value={ctx.dnsServer} onChange={e => set({ dnsServer: e.target.value })} placeholder="192.168.10.11" /></div>
            </div>
          </div>
          <div style={group}>
            <div style={legend}>📐 Convention d’adressage (pattern IP fixe)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 14 }}>
              <div>
                <label style={label}>Passerelle (routeur)</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {([['last', 'Fin de plage'], ['first', 'Début de plage']] as const).map(([v, t]) => (
                    <button key={v} type="button" onClick={() => set({ gwPos: v })} style={{ flex: 1, padding: '7px 8px', border: `1px solid ${ctx.gwPos === v ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, background: ctx.gwPos === v ? 'var(--accent)' : 'var(--surface)', color: ctx.gwPos === v ? '#fff' : 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={label}>IP de gestion du switch</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {([['beforeRouter', 'Juste avant le routeur'], ['firstHost', 'Début de plage']] as const).map(([v, t]) => (
                    <button key={v} type="button" onClick={() => set({ switchPos: v })} style={{ flex: 1, padding: '7px 8px', border: `1px solid ${ctx.switchPos === v ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, background: ctx.switchPos === v ? 'var(--accent)' : 'var(--surface)', color: ctx.switchPos === v ? '#fff' : 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>{t}</button>
                  ))}
                </div>
              </div>
              <div><label style={label}>Masque des liaisons inter-routeurs (CIDR)</label><input style={{ ...field, ...mono }} value={ctx.linkCidr} onChange={e => set({ linkCidr: e.target.value.replace(/\D/g, '') })} placeholder="30" /></div>
            </div>
            <div className="meta" style={{ fontSize: 11.5, marginTop: 10 }}>Convention appliquée : <strong>clients</strong> en début de plage (DHCP), <strong>switch</strong> puis <strong>routeur</strong> en fin de plage. Les liaisons entre routeurs utilisent un /{clampNum(Number(ctx.linkCidr) || 30, 8, 30)} (2 hôtes).</div>
          </div>
          <StepNav step={step} setStep={setStep} />
        </div>
      )}

      {/* ── Étape 3 : Segmentation ── */}
      {step === 3 && (
        <div>
          <div style={group}>
            <div style={legend}>🧭 Routeurs</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 340 }}>
                <thead><tr><th style={th}>Nom</th><th style={th}>Modèle</th><th style={th}>Interfaces</th><th style={th}></th></tr></thead>
                <tbody>
                  {ctx.routers.map(r => (
                    <tr key={r.id}>
                      <td style={td}><input style={{ ...field, width: 90 }} value={r.name} onChange={e => setRtr(r.id, { name: e.target.value.replace(/\s+/g, '') })} /></td>
                      <td style={td}>
                        <select style={{ ...field, width: 110 }} value={r.model} onChange={e => setRtr(r.id, { model: e.target.value as RouterModel })}>
                          <option value="2911">2911 (Gig)</option>
                          <option value="2811">2811 (Fa)</option>
                        </select>
                      </td>
                      <td style={{ ...td, color: 'var(--text-muted)' }}>{ethMax(r.model)}× {ethLabel(r.model)} + série</td>
                      <td style={{ ...td, width: 40 }}><button type="button" onClick={() => delRtr(r.id)} style={{ ...smallBtn, color: '#dc2626', borderColor: 'transparent' }} title="Supprimer">✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addRtr} style={{ ...btn, marginTop: 10 }}>+ Ajouter un routeur</button>
          </div>

          <div style={group}>
            <div style={legend}>🔀 Assignation des sous-réseaux</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 460 }}>
                <thead><tr><th style={th}>Sous-réseau</th><th style={th}>Hôtes</th><th style={th}>Routeur (passerelle)</th><th style={th}>Switch</th><th style={th}>DHCP</th></tr></thead>
                <tbody>
                  {ctx.services.map(s => (
                    <tr key={s.id}>
                      <td style={td}>{s.name}</td>
                      <td style={{ ...td, ...mono }}>{s.hosts}</td>
                      <td style={td}>
                        <select style={{ ...field, width: 100 }} value={s.routerId} onChange={e => setSvc(s.id, { routerId: e.target.value })}>
                          <option value="">— aucun —</option>
                          {ctx.routers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      </td>
                      <td style={{ ...td, textAlign: 'center' }}><input type="checkbox" checked={s.hasSwitch} onChange={e => setSvc(s.id, { hasSwitch: e.target.checked })} /></td>
                      <td style={{ ...td, textAlign: 'center' }}><input type="checkbox" checked={s.dhcp} onChange={e => setSvc(s.id, { dhcp: e.target.checked })} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={group}>
            <div style={legend}>🔗 Liaisons inter-routeurs</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 360 }}>
                <thead><tr><th style={th}>Routeur A (DCE)</th><th style={th}>Routeur B (DTE)</th><th style={th}>Média</th><th style={th}></th></tr></thead>
                <tbody>
                  {ctx.links.map(l => (
                    <tr key={l.id}>
                      <td style={td}><select style={{ ...field, width: 90 }} value={l.aId} onChange={e => setLink(l.id, { aId: e.target.value })}>{ctx.routers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></td>
                      <td style={td}><select style={{ ...field, width: 90 }} value={l.bId} onChange={e => setLink(l.id, { bId: e.target.value })}>{ctx.routers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></td>
                      <td style={td}><select style={{ ...field, width: 110 }} value={l.media} onChange={e => setLink(l.id, { media: e.target.value as LinkMedia })}><option value="serial">Série</option><option value="gig">Ethernet/Gig</option></select></td>
                      <td style={{ ...td, width: 40 }}><button type="button" onClick={() => delLink(l.id)} style={{ ...smallBtn, color: '#dc2626', borderColor: 'transparent' }} title="Supprimer">✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addLink} style={{ ...btn, marginTop: 10 }} disabled={ctx.routers.length < 2}>+ Ajouter une liaison</button>
          </div>

          {/* Résultats */}
          {plan.error && <div style={{ ...group, borderColor: '#dc2626', background: 'color-mix(in srgb,#dc2626 8%,transparent)' }}><strong style={{ color: '#dc2626' }}>⚠ {plan.error}</strong></div>}
          {!!plan.warnings.length && (
            <div style={{ ...group, borderColor: '#ca8a04', background: 'color-mix(in srgb,#ca8a04 8%,transparent)' }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>⚠ À vérifier</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>{plan.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          )}

          <div style={group}>
            <div style={legend}>
              📋 Plan d’adressage — {plan.subs.length} sous-réseaux
              <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>{ipToStr(plan.baseNet)}/{plan.cidr} · {plan.used}/{plan.totalAddr} adr.</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 640 }}>
                <thead><tr><th style={th}>Sous-réseau</th><th style={th}>Réseau/CIDR</th><th style={th}>Masque</th><th style={th}>Plage utilisable</th><th style={th}>Broadcast</th><th style={th}>Passerelle</th><th style={th}>Hôtes</th></tr></thead>
                <tbody>
                  {plan.subs.map(s => (
                    <tr key={s.id}>
                      <td style={{ ...td, fontWeight: 600 }}>{s.kind === 'link' ? '🔗 ' : ''}{s.name}</td>
                      <td style={{ ...td, ...mono }}>{ipToStr(s.net)}/{s.cidr}</td>
                      <td style={{ ...td, ...mono }}>{ipToStr(s.mask)}</td>
                      <td style={{ ...td, ...mono }}>{ipToStr(s.first)} – {ipToStr(s.last)}</td>
                      <td style={{ ...td, ...mono }}>{ipToStr(s.bc)}</td>
                      <td style={{ ...td, ...mono }}>{s.gw !== null ? ipToStr(s.gw) : '—'}</td>
                      <td style={{ ...td, ...mono }}>{s.usable}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={group}>
            <div style={legend}>
              🔌 Table d’adressage des interfaces
              <button type="button" onClick={() => copy('plan', planText)} style={{ ...btn, marginLeft: 'auto' }}>{copied === 'plan' ? '✓ Copié' : 'Copier le plan'}</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 620 }}>
                <thead><tr><th style={th}>Routeur</th><th style={th}>Interface</th><th style={th}>Cible</th><th style={th}>IP</th><th style={th}>Masque</th><th style={th}>Rôle</th></tr></thead>
                <tbody>
                  {plan.ifaces.map((i, k) => (
                    <tr key={k}>
                      <td style={{ ...td, fontWeight: 600 }}>{i.routerName}</td>
                      <td style={{ ...td, ...mono }}>{i.iface}</td>
                      <td style={td}>{i.target}</td>
                      <td style={{ ...td, ...mono }}>{ipToStr(i.ip)}</td>
                      <td style={{ ...td, ...mono }}>{ipToStr(i.mask)}</td>
                      <td style={{ ...td, color: 'var(--text-muted)' }}>{i.role}{i.clock ? ' · clock 64000' : ''}</td>
                    </tr>
                  ))}
                  {!plan.ifaces.length && <tr><td style={td} colSpan={6}>Ajoute des routeurs et assigne-les aux sous-réseaux.</td></tr>}
                </tbody>
              </table>
            </div>
            {ctx.mode === 'extension' && <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>ℹ️ Mode <strong>extension</strong> : vérifie que ces plages ne recouvrent pas l’existant avant de les intégrer.</div>}
          </div>
          <StepNav step={step} setStep={setStep} />
        </div>
      )}

      {/* ── Étapes 4-6 : à venir ── */}
      {step >= 4 && (
        <div style={{ ...group, textAlign: 'center', padding: '30px 16px' }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>{STEPS[step - 1].icon}</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{STEPS[step - 1].title} — en construction</div>
          <p className="meta" style={{ fontSize: 12.5, maxWidth: 460, margin: '8px auto 0' }}>
            {step === 4 && 'Le schéma (vue en blocs par sous-réseau + table des interfaces, puis diagramme SVG) sera généré à partir du plan de l’étape 3.'}
            {step === 5 && 'Les pools DHCP (ip dhcp pool, réseau/masque, default-router, dns-server, domaine, bail + adresses exclues) seront générés automatiquement pour chaque sous-réseau marqué « DHCP », avec les ip helper-address.'}
            {step === 6 && 'La configuration DNS (zones directe/inversée, enregistrements A/PTR) et les tests (nslookup/ping) seront proposés à partir du domaine et du plan.'}
          </p>
          <p className="meta" style={{ fontSize: 11.5, marginTop: 10 }}>Les données saisies aux étapes 1-3 sont déjà mémorisées et alimenteront ces étapes.</p>
        </div>
      )}
    </div>
  );
}

function StepNav({ step, setStep }: { step: number; setStep: (n: number) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 4 }}>
      <button type="button" onClick={() => setStep(Math.max(1, step - 1))} disabled={step <= 1} style={{ ...smallBtn, opacity: step <= 1 ? .4 : 1 }}>← Précédent</button>
      <button type="button" onClick={() => setStep(Math.min(6, step + 1))} disabled={step >= 6} style={{ ...btn, opacity: step >= 6 ? .4 : 1 }}>Suivant →</button>
    </div>
  );
}

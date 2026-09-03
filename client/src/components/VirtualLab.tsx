import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type PointerEvent as RPointerEvent } from 'react';
import { CmdEmulator } from './CmdEmulator';
import { WindowsSim } from './WindowsSim';
import { RouterConfigurator } from './RouterConfigurator';
import { Realisation1Trainer } from './Realisation1Trainer';

/**
 * Poste de travail virtuel — « simulateur complet » réunissant les outils déjà
 * créés dans un vrai gestionnaire de fenêtres : fenêtres déplaçables,
 * redimensionnables et empilables (plusieurs à l'écran), barre des tâches,
 * menu Démarrer et plein écran. Chaque app reste montée (état conservé).
 * Apps : Windows Server (Hyper-V, AD, DNS/DHCP/IIS, GPO), invite de commandes
 * (cmd & PowerShell), console routeur Cisco, Réalisation 1.
 * Îlot hydraté via RichContent (data-block="virtual-lab").
 */

type AppId = 'windows' | 'cmd' | 'router' | 'real1';
type AppDef = { id: AppId; name: string; short: string; icon: string; desc: string; accent: string; render: () => ReactNode };

const APPS: AppDef[] = [
  { id: 'windows', name: 'Windows Server', short: 'Windows', icon: '🪟', desc: 'OS · Hyper-V · AD · DNS/DHCP/IIS · GPO', accent: '#38bdf8', render: () => <WindowsSim /> },
  { id: 'cmd', name: 'Invite de commandes', short: 'cmd', icon: '⌨️', desc: 'cmd & PowerShell — bac à sable réseau', accent: '#22c55e', render: () => <CmdEmulator /> },
  { id: 'router', name: 'Console routeur Cisco', short: 'Cisco', icon: '🧭', desc: 'IOS — interfaces, routes, NAT, SSH', accent: '#f59e0b', render: () => <RouterConfigurator /> },
  { id: 'real1', name: 'Réalisation 1 (Hyper-V)', short: 'Réa 1', icon: '🧪', desc: 'VMs, disques/RAM, fenêtres Windows', accent: '#a855f7', render: () => <Realisation1Trainer /> },
];
const appOf = (id: AppId) => APPS.find(a => a.id === id)!;

type Win = { id: AppId; x: number; y: number; w: number; h: number; z: number; min: boolean; max: boolean };
type Drag = { id: AppId; mode: 'move' | 'resize'; px: number; py: number; ox: number; oy: number; ow: number; oh: number };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const mono: CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' };

// Boutons de légende façon Windows : survol gris, rouge sur « fermer ».
const CAP_CSS = `
.vl-cap{width:46px;display:inline-flex;align-items:center;justify-content:center;border:0;background:transparent;color:var(--text);cursor:pointer;padding:0;transition:background .12s;-webkit-app-region:no-drag}
.vl-cap:hover{background:rgba(127,127,127,.22)}
.vl-cap:active{background:rgba(127,127,127,.34)}
.vl-cap-close:hover{background:#c42b1c;color:#fff}
.vl-cap-close:active{background:#e04434;color:#fff}
`;
// Glyphes vectoriels des boutons de légende (identiques à Windows 10/11).
function capIcon(kind: 'min' | 'max' | 'restore' | 'close') {
  const common = { width: 10, height: 10, viewBox: '0 0 10 10', fill: 'none', stroke: 'currentColor', strokeWidth: 1, shapeRendering: 'crispEdges' as const, style: { pointerEvents: 'none' as const } };
  if (kind === 'min') return <svg {...common}><line x1="0" y1="5.5" x2="10" y2="5.5" /></svg>;
  if (kind === 'max') return <svg {...common}><rect x="0.5" y="0.5" width="9" height="9" /></svg>;
  if (kind === 'restore') return <svg {...common}><rect x="0.5" y="2.5" width="7" height="7" /><path d="M2.5 2.5 V0.5 H9.5 V7.5 H7.5" /></svg>;
  return <svg {...common} strokeLinecap="round"><path d="M0.6 0.6 L9.4 9.4 M9.4 0.6 L0.6 9.4" /></svg>;
}

/*
 * @id     tssr.atelier.virtualLab
 * @do     simuler_laboratoire
 * @role   ui
 * @layer  ui
 * @human  Atelier : laboratoire virtuel de mise en pratique.
 */
export function VirtualLab() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const zRef = useRef(1);
  const [wins, setWins] = useState<Win[]>([]);
  const [desk, setDesk] = useState({ w: 960, h: 620 });
  const [start, setStart] = useState(false);
  const [fs, setFs] = useState(false);
  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    tick(); const id = setInterval(tick, 20000); return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const h = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h); return () => document.removeEventListener('fullscreenchange', h);
  }, []);
  useEffect(() => {
    const el = screenRef.current; if (!el) return;
    const measure = () => setDesk({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toggleFs = () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else wrapRef.current?.requestFullscreen?.().catch(() => {}); };
  const small = desk.w < 680;
  const topZ = wins.filter(w => !w.min).reduce((m, w) => Math.max(m, w.z), 0);

  const open = (id: AppId) => {
    setStart(false);
    setWins(ws => {
      const z = ++zRef.current;
      const ex = ws.find(w => w.id === id);
      if (ex) return ws.map(w => (w.id === id ? { ...w, min: false, z } : w));
      const w = small ? desk.w : Math.min(desk.w - 40, 780);
      const h = small ? desk.h : Math.min(desk.h - 40, 540);
      const n = ws.length;
      const x = small ? 0 : Math.min(18 + n * 30, Math.max(0, desk.w - w - 8));
      const y = small ? 0 : Math.min(14 + n * 30, Math.max(0, desk.h - h - 8));
      return [...ws, { id, x, y, w, h, z, min: false, max: small }];
    });
  };
  const focus = (id: AppId) => setWins(ws => ws.map(w => (w.id === id ? { ...w, z: ++zRef.current } : w)));
  const close = (id: AppId) => setWins(ws => ws.filter(w => w.id !== id));
  const setMin = (id: AppId, min: boolean) => setWins(ws => ws.map(w => (w.id === id ? { ...w, min, z: min ? w.z : ++zRef.current } : w)));
  const toggleMax = (id: AppId) => setWins(ws => ws.map(w => (w.id === id ? { ...w, max: !w.max, z: ++zRef.current } : w)));
  const taskClick = (id: AppId) => setWins(ws => {
    const w = ws.find(x => x.id === id); if (!w) return ws;
    if (w.min) return ws.map(x => (x.id === id ? { ...x, min: false, z: ++zRef.current } : x));
    if (w.z === topZ) return ws.map(x => (x.id === id ? { ...x, min: true } : x));
    return ws.map(x => (x.id === id ? { ...x, z: ++zRef.current } : x));
  });

  const onDown = (e: RPointerEvent<HTMLDivElement>, id: AppId, mode: Drag['mode']) => {
    if (mode === 'move' && (e.target as HTMLElement).closest('[data-nodrag]')) return;
    const w = wins.find(x => x.id === id); if (!w || w.max) { focus(id); return; }
    focus(id);
    dragRef.current = { id, mode, px: e.clientX, py: e.clientY, ox: w.x, oy: w.y, ow: w.w, oh: w.h };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current; if (!d) return;
    const dx = e.clientX - d.px, dy = e.clientY - d.py;
    setWins(ws => ws.map(w => {
      if (w.id !== d.id) return w;
      if (d.mode === 'move') return { ...w, x: clamp(d.ox + dx, 0, Math.max(0, desk.w - 64)), y: clamp(d.oy + dy, 0, Math.max(0, desk.h - 34)) };
      return { ...w, w: clamp(d.ow + dx, 300, desk.w), h: clamp(d.oh + dy, 200, desk.h) };
    }));
  };
  const onUp = (e: RPointerEvent<HTMLDivElement>) => { dragRef.current = null; try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* */ } };

  return (
    <div ref={wrapRef} style={{ ...deskWrap, height: fs ? '100vh' : 'min(88vh, 900px)' }}>
      <style>{CAP_CSS}</style>
      {/* ── Écran (bureau + fenêtres) ── */}
      <div ref={screenRef} style={screen}>
        {/* Bureau : icônes (couche de fond) */}
        <div style={desktop}>
          <div style={{ textAlign: 'center', marginBottom: 2 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: .3 }}>🖥️ Poste de travail virtuel — TSSR</div>
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.75)', marginTop: 2 }}>Ouvre plusieurs outils, déplace et redimensionne les fenêtres, empile-les.</div>
          </div>
          <div style={iconGrid}>
            {APPS.map(a => (
              <button key={a.id} type="button" onClick={() => open(a.id)} style={iconBtn} title={a.desc}>
                <span style={{ fontSize: 36, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.4))' }}>{a.icon}</span>
                <span style={iconLabel}>{a.name}</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,.7)', lineHeight: 1.25 }}>{a.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Fenêtres */}
        {wins.map(w => {
          const app = appOf(w.id);
          const gx = w.max ? 0 : w.x, gy = w.max ? 0 : w.y, gw = w.max ? desk.w : w.w, gh = w.max ? desk.h : w.h;
          const focused = w.z === topZ && !w.min;
          return (
            <div key={w.id} onPointerDown={() => focus(w.id)}
              style={{ ...winFrame, left: gx, top: gy, width: gw, height: gh, zIndex: w.z, display: w.min ? 'none' : 'flex', borderRadius: w.max ? 0 : 9, boxShadow: focused ? '0 18px 50px rgba(0,0,0,.55)' : '0 6px 20px rgba(0,0,0,.3)', borderColor: focused ? 'color-mix(in srgb, var(--accent) 55%, var(--border))' : 'var(--border)' }}>
              <div onPointerDown={e => onDown(e, w.id, 'move')} onPointerMove={onMove} onPointerUp={onUp} onDoubleClick={() => toggleMax(w.id)}
                style={{ ...titleBar, cursor: w.max ? 'default' : 'move', touchAction: 'none', opacity: focused ? 1 : .68 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, padding: '0 8px 0 11px' }}>
                  <span style={{ fontSize: 14 }}>{app.icon}</span>
                  <b style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>{app.name}</b>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>— {app.desc}</span>
                </div>
                <div data-nodrag style={{ display: 'flex', alignItems: 'stretch', alignSelf: 'stretch' }}>
                  <button type="button" data-nodrag className="vl-cap" onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setMin(w.id, true); }} title="Réduire">{capIcon('min')}</button>
                  <button type="button" data-nodrag className="vl-cap" onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); toggleMax(w.id); }} title={w.max ? 'Restaurer' : 'Agrandir'}>{capIcon(w.max ? 'restore' : 'max')}</button>
                  <button type="button" data-nodrag className="vl-cap vl-cap-close" onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); close(w.id); }} title="Fermer" style={{ borderTopRightRadius: w.max ? 0 : 8 }}>{capIcon('close')}</button>
                </div>
              </div>
              <div style={winBody}>{app.render()}</div>
              {!w.max && (
                <div onPointerDown={e => onDown(e, w.id, 'resize')} onPointerMove={onMove} onPointerUp={onUp} title="Redimensionner"
                  style={resizeHandle}>
                  <span style={{ position: 'absolute', right: 3, bottom: 1, fontSize: 12, color: 'var(--text-muted)', transform: 'rotate(45deg)' }}>⌟</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Barre des tâches ── */}
      <div style={taskbar}>
        <button type="button" onClick={() => setStart(s => !s)} style={{ ...startBtn, background: start ? 'var(--accent)' : 'transparent', color: start ? '#fff' : 'var(--text)' }}>⊞ <span style={hideXs}>Démarrer</span></button>
        <div style={{ display: 'flex', gap: 5, marginLeft: 6, overflowX: 'auto', flex: 1 }}>
          {wins.map(w => {
            const app = appOf(w.id); const on = w.z === topZ && !w.min;
            return (
              <button key={w.id} type="button" onClick={() => taskClick(w.id)} title={app.name}
                style={{ ...taskChip, opacity: w.min ? .6 : 1, borderBottomColor: on ? app.accent : 'transparent', background: on ? 'color-mix(in srgb, var(--accent) 16%, transparent)' : 'transparent' }}>
                <span style={{ fontSize: 14 }}>{app.icon}</span><span style={hideXs}>{app.short}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingLeft: 6 }}>
          <button type="button" onClick={toggleFs} title={fs ? 'Quitter le plein écran' : 'Plein écran'} style={taskIcon}>{fs ? '🗗' : '⛶'}</button>
          <span style={{ fontSize: 12, ...mono, color: 'var(--text-soft)' }}>{clock}</span>
        </div>
      </div>

      {/* ── Menu Démarrer ── */}
      {start && (
        <>
          <div onClick={() => setStart(false)} style={backdrop} />
          <div style={startMenu}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, margin: '2px 8px 8px', textTransform: 'uppercase', letterSpacing: .5 }}>Applications</div>
            {APPS.map(a => (
              <button key={a.id} type="button" onClick={() => open(a.id)} style={startItem}>
                <span style={{ fontSize: 24, width: 30, textAlign: 'center' }}>{a.icon}</span>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                  <b style={{ fontSize: 13 }}>{a.name}</b>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.desc}</span>
                </span>
              </button>
            ))}
            <div style={{ borderTop: '1px solid var(--border)', margin: '8px 4px' }} />
            <button type="button" onClick={() => { setWins([]); setStart(false); }} style={startItem}>
              <span style={{ fontSize: 24, width: 30, textAlign: 'center' }}>🧹</span>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <b style={{ fontSize: 13 }}>Tout fermer</b>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Fermer toutes les fenêtres</span>
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────── Styles ───────────────────────────────────────────
const deskWrap: CSSProperties = { position: 'relative', display: 'flex', flexDirection: 'column', width: '100%', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface-2)', boxShadow: '0 8px 30px rgba(0,0,0,.18)' };
const screen: CSSProperties = { position: 'relative', flex: 1, overflow: 'hidden', background: 'radial-gradient(120% 120% at 30% 10%, #1e3a5f 0%, #0f2036 45%, #0a1626 100%)' };
const desktop: CSSProperties = { position: 'absolute', inset: 0, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto', zIndex: 0 };
const iconGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12, maxWidth: 620, margin: '0 auto', width: '100%' };
const iconBtn: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, textAlign: 'center', cursor: 'pointer', padding: '14px 8px', borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.06)', color: '#fff' };
const iconLabel: CSSProperties = { fontSize: 12.5, fontWeight: 700, color: '#fff' };
const winFrame: CSSProperties = { position: 'absolute', flexDirection: 'column', background: 'var(--bg, var(--surface))', border: '1px solid var(--border)', overflow: 'hidden' };
const titleBar: CSSProperties = { display: 'flex', alignItems: 'stretch', height: 34, background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', flexShrink: 0, userSelect: 'none' };
const winBody: CSSProperties = { flex: 1, overflow: 'auto', padding: 12, background: 'var(--bg, var(--surface))', WebkitOverflowScrolling: 'touch' };
const resizeHandle: CSSProperties = { position: 'absolute', right: 0, bottom: 0, width: 20, height: 20, cursor: 'nwse-resize', touchAction: 'none', zIndex: 2 };
const taskbar: CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', background: 'color-mix(in srgb, var(--surface-2) 92%, #000)', borderTop: '1px solid var(--border)', flexShrink: 0, minHeight: 42 };
const startBtn: CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' };
const taskChip: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', borderBottomWidth: 2, background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' };
const taskIcon: CSSProperties = { width: 30, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontSize: 13 };
const backdrop: CSSProperties = { position: 'absolute', inset: 0, zIndex: 40 };
const startMenu: CSSProperties = { position: 'absolute', left: 8, bottom: 48, zIndex: 41, width: 'min(340px, calc(100% - 16px))', maxHeight: 'calc(100% - 60px)', overflow: 'auto', padding: 8, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', boxShadow: '0 12px 40px rgba(0,0,0,.35)' };
const startItem: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '9px 8px', borderRadius: 9, border: '1px solid transparent', background: 'transparent', color: 'var(--text)', cursor: 'pointer' };
const hideXs: CSSProperties = { whiteSpace: 'nowrap' };

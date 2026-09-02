import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from '@tanstack/react-router';
import { useTheme } from '@/lib/theme';
import { NetworkWorkshop, DEFAULT_CTX, migrateCtx, computePlan, routeursDe, type Ctx, type Plan } from '@/components/NetworkWorkshop';
import { apiPut } from '@/api/client';
import {
  useAtelierMe, useAtelierProjects, useAtelierProject,
  useCreateProject, useUpdateProject, useDeleteProject,
} from '@/api/atelier';

const LAST_KEY = 'atelier_last_project';
const DRAFT_KEY = 'net_workshop_v1'; // brouillon local partagé avec l'îlot CMS

type Section4 = 'schema' | 'routeurs' | 'nat';
interface NavItem { key: string; icon: string; label: string; step: number; s4?: Section4; }

// Sidebar réorganisée selon l'audit : Réseau (conception + schéma) · Configurations (tous les
// configs générés) · Validation. L'étape 4 surchargée est éclatée en Schéma / Routeurs / NAT.
const NAV: { title: string; items: NavItem[] }[] = [
  // La vue « Par matériel » est la porte d'entrée : le schéma unique, puis toutes
  // les commandes de chaque équipement, prêtes à coller. Le reste du menu reste
  // là pour régler l'amont (adressage, DHCP, DNS…) et vérifier.
  { title: 'Atelier', items: [
    { key: 'materiel-cmd', icon: '🧰', label: 'Par matériel', step: 12 },
  ] },
  // Regroupement par couches OSI : c'est l'ordre du montage reel — on pose le
  // materiel, on cable, on decoupe en VLAN, on adresse, puis on sert.
  { title: 'Couche 1 — Physique', items: [
    { key: 'contexte', icon: '🧾', label: 'Contexte', step: 1 },
    { key: 'materiel', icon: '🔌', label: 'Matériel & câblage', step: 11 },
  ] },
  { title: 'Couche 2 — Liaison', items: [
    { key: 'vlan', icon: '🔀', label: 'VLAN & switches', step: 9 },
  ] },
  { title: 'Couche 3 — Réseau', items: [
    { key: 'preferences', icon: '⚙️', label: 'Préférences', step: 2 },
    { key: 'segmentation', icon: '🧮', label: 'Adressage', step: 3 },
    { key: 'routeurs', icon: '📟', label: 'Routeurs & reset', step: 4, s4: 'routeurs' },
    { key: 'mls', icon: '🗼', label: 'Switch multicouche (SVI)', step: 10 },
    { key: 'nat', icon: '🌍', label: 'Internet / NAT', step: 4, s4: 'nat' },
  ] },
  { title: 'Couches 4-7 — Services', items: [
    { key: 'dhcp', icon: '📶', label: 'DHCP', step: 5 },
    { key: 'dns', icon: '🌐', label: 'DNS', step: 6 },
    { key: 'dns-dhcp-linux', icon: '🐧', label: 'DNS & DHCP Linux', step: 13 },
    { key: 'ssh', icon: '🔑', label: 'SSH', step: 7 },
  ] },
  { title: 'Validation', items: [
    { key: 'tests', icon: '🔎', label: 'Tests', step: 8 },
  ] },
];


const navBtn: CSSProperties = { width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', font: 'inherit', display: 'flex', alignItems: 'center' };

type SaveState = 'idle' | 'saving' | 'saved';
type Status = 'ok' | 'warn' | 'error' | 'empty';

function loadDraft(): Ctx {
  try { const v = localStorage.getItem(DRAFT_KEY); if (v) return migrateCtx(JSON.parse(v)); } catch { /* */ }
  return DEFAULT_CTX;
}

// État par section (dérivé du plan) → alimente les pastilles de la sidebar.
function statusesOf(ctx: Ctx, plan: Plan): Record<string, Status> {
  const dhcpAny = plan.subs.some(s => s.kind === 'lan' && s.dhcp);
  return {
    'materiel-cmd': ctx.materiels.length ? 'ok' : 'empty',
    contexte: (plan.bases.length && ctx.services.length) ? 'ok' : 'empty',
    preferences: 'ok',
    segmentation: plan.error ? 'error' : plan.warnings.length ? 'warn' : plan.subs.length ? 'ok' : 'empty',
    schema: plan.subs.length ? 'ok' : 'empty',
    routeurs: plan.ifaces.length ? 'ok' : 'empty',
    dhcp: dhcpAny ? 'ok' : 'empty',
    dns: ctx.domaine.trim() ? 'ok' : 'empty',
    'dns-dhcp-linux': (ctx.domaine.trim() || dhcpAny) ? 'ok' : 'empty',
    ssh: routeursDe(ctx).length ? 'ok' : 'empty',
    nat: ctx.internetRouterId ? 'ok' : 'empty',
    tests: plan.subs.length ? 'ok' : 'empty',
  };
}

/*
 * @id     tssr.atelier.app
 * @do     afficher_atelier
 * @role   ui
 * @layer  ui
 * @human  Atelier : application principale regroupant les exercices et outils de formation.
 */
export function AtelierApp() {
  const { toggleTheme } = useTheme();
  const me = useAtelierMe();
  const canSave = !!me.data?.canSave;

  const projects = useAtelierProjects(canSave);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const project = useAtelierProject(canSave ? currentId : null);

  const [ctx, setCtx] = useState<Ctx>(loadDraft);
  const [step, setStep] = useState(12);
  const [section4, setSection4] = useState<Section4>('schema');
  const [navOpen, setNavOpen] = useState(false);
  const loadedRef = useRef<number | null>(null);
  const bootRef = useRef(false);
  const importRef = useRef<HTMLInputElement>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const plan = useMemo(() => computePlan(ctx), [ctx]);
  const statuses = useMemo(() => statusesOf(ctx, plan), [ctx, plan]);

  const createProject = useCreateProject();
  const renameProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  useEffect(() => { document.body.classList.toggle('mobile-nav-open', navOpen); return () => document.body.classList.remove('mobile-nav-open'); }, [navOpen]);

  // Choisir (ou créer) un projet une fois la liste connue — une seule fois.
  useEffect(() => {
    if (!canSave || bootRef.current || !projects.data) return;
    bootRef.current = true;
    const list = projects.data;
    if (!list.length) {
      createProject.mutate({ name: 'Mon réseau', data: DEFAULT_CTX as unknown as Record<string, unknown> }, {
        onSuccess: (p) => { setCurrentId(p.id); try { localStorage.setItem(LAST_KEY, String(p.id)); } catch { /* */ } },
      });
      return;
    }
    let pick = list[0].id;
    try { const last = Number(localStorage.getItem(LAST_KEY)); if (last && list.some(p => p.id === last)) pick = last; } catch { /* */ }
    setCurrentId(pick);
  }, [canSave, projects.data, createProject]);

  // Hydrater le contexte depuis le projet chargé (sans écraser des éditions en cours).
  useEffect(() => {
    if (project.data && loadedRef.current !== project.data.id) {
      setCtx(migrateCtx(project.data.data));
      loadedRef.current = project.data.id;
      setSaveState('saved');
    }
  }, [project.data]);

  // Persistance : autosave serveur (connecté) ou brouillon localStorage (anonyme).
  useEffect(() => {
    if (canSave) {
      if (currentId == null || loadedRef.current !== currentId) return;
      setSaveState('saving');
      const t = setTimeout(() => {
        apiPut(`/api/atelier/projects/${currentId}`, { data: ctx })
          .then(() => setSaveState('saved'))
          .catch(() => setSaveState('idle'));
      }, 800);
      return () => clearTimeout(t);
    }
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(ctx)); } catch { /* */ }
  }, [ctx, currentId, canSave]);

  function go(item: NavItem) {
    setStep(item.step);
    if (item.s4) setSection4(item.s4);
    setNavOpen(false);
  }
  function isActive(item: NavItem) {
    return step === item.step && (item.step !== 4 || section4 === item.s4);
  }

  function switchProject(id: number) {
    if (id === currentId) return;
    setCurrentId(id);
    setNavOpen(false);
    try { localStorage.setItem(LAST_KEY, String(id)); } catch { /* */ }
  }
  function newProject() {
    const name = window.prompt('Nom du nouveau projet ?', 'Nouveau réseau');
    if (name == null) return;
    createProject.mutate({ name: name.trim() || 'Nouveau réseau', data: DEFAULT_CTX as unknown as Record<string, unknown> }, {
      onSuccess: (p) => { loadedRef.current = null; setStep(1); switchProject(p.id); },
    });
  }
  function renameCurrent() {
    if (currentId == null) return;
    const cur = projects.data?.find(p => p.id === currentId);
    const name = window.prompt('Renommer le projet', cur?.name || '');
    if (name == null || !name.trim()) return;
    renameProject.mutate({ id: currentId, name: name.trim() });
  }
  function deleteCurrent() {
    if (currentId == null) return;
    const cur = projects.data?.find(p => p.id === currentId);
    if (!window.confirm(`Supprimer le projet « ${cur?.name || ''} » ? Cette action est définitive.`)) return;
    deleteProject.mutate(currentId, {
      onSuccess: () => { loadedRef.current = null; bootRef.current = false; setCurrentId(null); },
    });
  }

  const currentName = projects.data?.find(p => p.id === currentId)?.name;

  function exportProject() {
    const payload = JSON.stringify({ name: currentName || 'Atelier réseau', data: ctx }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(currentName || 'reseau').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-')}.atelier.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        setCtx(migrateCtx(parsed && typeof parsed === 'object' && 'data' in parsed ? parsed.data : parsed));
      } catch { window.alert('Fichier de projet invalide.'); }
    };
    reader.readAsText(file);
  }

  return (
    <>
      <header className="topbar">
        <button className="icon-btn hide-desktop" onClick={() => setNavOpen(o => !o)} title="Menu" aria-label="Menu">≡</button>
        <Link to="/" className="brand"><span className="brand-dot">A</span> <span className="brand-text">Atelier réseau</span></Link>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 6 }}>
          {canSave && currentId != null && (
            <>
              <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentName || '…'}</span>
              <SaveBadge state={saveState} />
            </>
          )}
        </div>
        <div className="actions topbar-actions">
          <button className="icon-btn" onClick={exportProject} title="Exporter le projet (.json)" aria-label="Exporter">⭳</button>
          <button className="icon-btn" onClick={() => importRef.current?.click()} title="Importer un projet (.json)" aria-label="Importer">⭱</button>
          <button className="icon-btn" onClick={toggleTheme} title="Basculer thème" aria-label="Thème">◐</button>
          <a className="icon-btn hide-mobile" href="/" title="Retour au site" aria-label="Retour au site">↗</a>
        </div>
        <input ref={importRef} type="file" accept="application/json,.json" onChange={onImportFile} style={{ display: 'none' }} />
      </header>

      <aside className="sidebar">
        <button type="button" className="sidebar-close" aria-label="Fermer le menu" onClick={() => setNavOpen(false)}>✕</button>

        {canSave && (
          <ul className="nav-group">
            <li className="nav-group-title">Projets</li>
            {(projects.data || []).map(p => (
              <li key={p.id}>
                <button type="button" onClick={() => switchProject(p.id)} className={`nav-link ${p.id === currentId ? 'active' : ''}`} style={navBtn} aria-current={p.id === currentId ? 'true' : undefined}>
                  <span className="nav-icon">🗂️</span>
                  <span className="nav-label">{p.name}</span>
                </button>
              </li>
            ))}
            <li>
              <button type="button" onClick={newProject} className="nav-link" style={{ ...navBtn, color: 'var(--accent)' }}>
                <span className="nav-icon">＋</span><span className="nav-label">Nouveau projet</span>
              </button>
            </li>
          </ul>
        )}

        {NAV.map((g, gi) => (
          <ul className="nav-group" key={gi}>
            <li className="nav-group-title">{g.title}</li>
            {g.items.map(it => {
              const active = isActive(it);
              return (
                <li key={it.key}>
                  <button type="button" onClick={() => go(it)} className={`nav-link ${active ? 'active' : ''}`} style={navBtn} aria-current={active ? 'page' : undefined}>
                    <span className="nav-icon">{it.icon}</span>
                    <span className="nav-label">{it.label}</span>
                    <StatusDot s={statuses[it.key]} />
                  </button>
                </li>
              );
            })}
          </ul>
        ))}

        {canSave && currentId != null && (
          <ul className="nav-group">
            <li className="nav-group-title">Projet courant</li>
            <li><button type="button" onClick={renameCurrent} className="nav-link" style={navBtn}><span className="nav-icon">✏️</span><span className="nav-label">Renommer</span></button></li>
            <li><button type="button" onClick={exportProject} className="nav-link" style={navBtn}><span className="nav-icon">⭳</span><span className="nav-label">Exporter (.json)</span></button></li>
            <li><button type="button" onClick={() => importRef.current?.click()} className="nav-link" style={navBtn}><span className="nav-icon">⭱</span><span className="nav-label">Importer (.json)</span></button></li>
            <li><button type="button" onClick={deleteCurrent} className="nav-link" style={{ ...navBtn, color: 'var(--danger)' }}><span className="nav-icon">🗑️</span><span className="nav-label">Supprimer</span></button></li>
          </ul>
        )}
      </aside>

      {navOpen && <div className="mobile-backdrop" onClick={() => setNavOpen(false)} aria-hidden="true" />}

      <main className="content">
        <div className="wrap" style={{ maxWidth: 1100 }}>
          {me.isLoading ? (
            <div className="loading">Chargement…</div>
          ) : (
            <>
              {!canSave && (
                <div style={draftBanner}>
                  <strong>Mode brouillon.</strong> Ton travail est gardé dans ce navigateur.{' '}
                  <a href="/account/login" style={linkStyle}>Connecte-toi</a> (ou en <a href="/admin/login" style={linkStyle}>admin</a>) pour créer des projets enregistrés et synchronisés entre appareils.
                </div>
              )}
              <StatusBanner plan={plan} onGoto={() => { setStep(3); setNavOpen(false); }} />
              <NetworkWorkshop value={ctx} onChange={setCtx} step={step} onStep={setStep} section4={step === 4 ? section4 : undefined} showStepper={false} />
            </>
          )}
        </div>
      </main>
    </>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  if (state === 'saving') return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· Enregistrement…</span>;
  if (state === 'saved') return <span style={{ fontSize: 12, color: 'var(--success)' }}>· Enregistré ✓</span>;
  return null;
}

const DOT: Record<Status, { c: string; ch: string; t: string }> = {
  ok: { c: 'var(--success)', ch: '✓', t: 'complète' },
  warn: { c: 'var(--warning)', ch: '●', t: 'à vérifier' },
  error: { c: 'var(--danger)', ch: '●', t: 'erreur' },
  empty: { c: 'var(--text-muted)', ch: '○', t: 'vide' },
};
function StatusDot({ s }: { s: Status }) {
  const d = DOT[s || 'empty'];
  return <span title={d.t} aria-hidden style={{ marginLeft: 'auto', fontSize: 11, color: d.c, flexShrink: 0 }}>{d.ch}</span>;
}

// Bandeau d'état global : le plan est-il cohérent ? Visible sur toutes les vues (correctif audit C2).
function StatusBanner({ plan, onGoto }: { plan: Plan; onGoto: () => void }) {
  let tone: Status = 'ok';
  let text = `Plan cohérent — ${plan.subs.length} sous-réseau(x), ${plan.ifaces.length} interface(s).`;
  let action = '';
  if (plan.error) { tone = 'error'; text = plan.error; action = 'Corriger'; }
  else if (plan.warnings.length) { tone = 'warn'; text = `${plan.warnings.length} point(s) à vérifier dans la segmentation.`; action = 'Voir'; }
  const col = tone === 'error' ? 'var(--danger)' : tone === 'warn' ? 'var(--warning)' : 'var(--success)';
  const bg = tone === 'error' ? 'var(--danger-light)' : tone === 'warn' ? 'var(--warning-light)' : 'var(--success-light)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${col}`, background: bg, borderRadius: 10, padding: '9px 13px', marginBottom: 14, fontSize: 13 }}>
      <span style={{ color: col, fontWeight: 700 }}>{tone === 'ok' ? '✓' : '⚠'}</span>
      <span style={{ flex: 1, minWidth: 0 }}>{text}</span>
      {action && <button type="button" onClick={onGoto} style={{ border: `1px solid ${col}`, color: col, background: 'transparent', borderRadius: 7, padding: '3px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>{action} →</button>}
    </div>
  );
}

const draftBanner: CSSProperties = {
  border: '1px solid var(--border)', borderLeft: '3px solid var(--accent)', background: 'var(--surface-2)',
  borderRadius: 10, padding: '11px 14px', marginBottom: 14, fontSize: 13.5, color: 'var(--text-soft)',
};
const linkStyle: CSSProperties = { color: 'var(--accent)', fontWeight: 600 };

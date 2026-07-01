import { useEffect, useState, Suspense } from 'react';
import { Outlet, Link, useNavigate, useLocation } from '@tanstack/react-router';
import { useMe, useLogout } from '@/api/hooks';
import { useTheme } from '@/lib/theme';
import { useToast } from '@/lib/toast';
import { Sidebar } from '@/components/Sidebar';
import { CommandPalette } from '@/components/CommandPalette';
import { Breadcrumbs } from '@/components/Breadcrumbs';

const SHORTCUTS: Record<string, string> = {
  'g d': '/admin', 'g p': '/admin/pages', 'g r': '/admin/products', 'g o': '/admin/orders',
  'g c': '/admin/coupons', 'g l': '/admin/shipping', 'g f': '/admin/quote-forms',
  'g s': '/admin/quote-submissions', 'g m': '/admin/menus',
};

export function AdminLayout() {
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const { toggleTheme } = useTheme();
  const { push } = useToast();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('cms-sidebar') === 'collapsed'; } catch { return false; } });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    try { localStorage.setItem('cms-sidebar', collapsed ? 'collapsed' : 'expanded'); } catch {}
  }, [collapsed]);

  useEffect(() => {
    document.body.classList.toggle('mobile-nav-open', mobileNavOpen);
    return () => document.body.classList.remove('mobile-nav-open');
  }, [mobileNavOpen]);

  // Ferme le drawer mobile quand on change de route
  const routerLocation = useLocation();
  useEffect(() => { setMobileNavOpen(false); }, [routerLocation.pathname]);

  function toggleSidebar() {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches) {
      setMobileNavOpen(o => !o);
    } else {
      setCollapsed(c => !c);
    }
  }

  useEffect(() => {
    const onUnauthorized = () => { navigate({ to: "/admin/login" }); };
    window.addEventListener('cms:unauthorized', onUnauthorized);
    return () => window.removeEventListener('cms:unauthorized', onUnauthorized);
  }, [navigate]);

  useEffect(() => {
    if (me.isError) navigate({ to: "/admin/login" });
  }, [me.isError, navigate]);

  useEffect(() => {
    let chordKey: string | null = null;
    let chordTimer: ReturnType<typeof setTimeout> | null = null;

    function handleKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const inField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(true); return; }
      if (inField) return;
      if (e.key === '?') { e.preventDefault(); setShortcutsOpen(true); return; }
      if (e.key === 't' || e.key === 'T') { e.preventDefault(); toggleTheme(); return; }
      if (e.key === '[' || e.key === ']') { e.preventDefault(); toggleSidebar(); return; }
      if (chordKey) {
        const combo = `${chordKey} ${e.key.toLowerCase()}`;
        if (chordTimer) clearTimeout(chordTimer);
        chordKey = null;
        if (SHORTCUTS[combo]) { e.preventDefault(); navigate({ to: SHORTCUTS[combo] }); }
        return;
      }
      if (e.key === 'g' || e.key === 'G') {
        chordKey = 'g';
        if (chordTimer) clearTimeout(chordTimer);
        chordTimer = setTimeout(() => { chordKey = null; }, 900);
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [navigate, toggleTheme]);

  if (me.isLoading) return <div className="loading">Chargement…</div>;
  if (!me.data) return null;

  return (
    <>
      <header className="topbar">
        <button className="icon-btn" onClick={toggleSidebar} title="Plier / déplier la sidebar (touche [)" aria-label="Sidebar">≡</button>
        <Link to="/admin" className="brand"><span className="brand-dot">C</span> <span className="brand-text">CMS</span></Link>
        <div className="topbar-search" role="button" tabIndex={0} onClick={() => setPaletteOpen(true)}>
          <span className="cmdk-icon">⌕</span>
          <span className="ts-text">Recherche rapide…</span>
          <kbd className="ts-kbd">⌘K</kbd>
        </div>
        <div className="actions topbar-actions">
          <button className="icon-btn hide-mobile" onClick={() => setShortcutsOpen(true)} title="Raccourcis (?)" aria-label="Raccourcis">?</button>
          <button className="icon-btn" onClick={toggleTheme} title="Basculer thème (t)" aria-label="Thème">◐</button>
          <a className="icon-btn hide-mobile" href="/" target="_blank" rel="noreferrer" title="Voir le site public">↗</a>
          <div className="user-chip" onClick={() => { logout.mutate(undefined, { onSuccess: () => { push('Déconnecté.'); navigate({ to: "/admin/login" }); } }); }}>
            <span className="avatar">{me.data.username.slice(0, 1).toUpperCase()}</span>
            <span className="user-name">{me.data.username}</span>
            <span className="user-arrow" style={{ color: 'var(--text-muted)', fontSize: 11 }}>↪</span>
          </div>
        </div>
      </header>

      <Sidebar onClose={() => setMobileNavOpen(false)} />

      {mobileNavOpen && <div className="mobile-backdrop" onClick={() => setMobileNavOpen(false)} aria-hidden="true" />}

      <main className="content">
        <div className="page-header"><Breadcrumbs /></div>
        <div className="wrap"><Suspense fallback={<div className="loading">Chargement…</div>}><Outlet /></Suspense></div>
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {shortcutsOpen && (
        <div className="cmdk-overlay" role="dialog" aria-modal="true" onClick={() => setShortcutsOpen(false)}>
          <div className="cmdk-shell" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="cmdk-search" style={{ padding: '18px 20px' }}><strong style={{ flex: 1 }}>Raccourcis clavier</strong><kbd>Esc</kbd></div>
            <div style={{ padding: '8px 20px 20px', display: 'grid', gap: 6, fontSize: 13 }}>
              <Row k={<><kbd>⌘</kbd>+<kbd>K</kbd> / <kbd>Ctrl</kbd>+<kbd>K</kbd></>} v="Recherche rapide" />
              <Row k={<kbd>?</kbd>} v="Cet écran" />
              <Row k={<><kbd>g</kbd> puis <kbd>d</kbd></>} v="Tableau de bord" />
              <Row k={<><kbd>g</kbd> puis <kbd>p</kbd></>} v="Pages" />
              <Row k={<><kbd>g</kbd> puis <kbd>r</kbd></>} v="Produits" />
              <Row k={<><kbd>g</kbd> puis <kbd>o</kbd></>} v="Commandes" />
              <Row k={<><kbd>g</kbd> puis <kbd>c</kbd></>} v="Coupons" />
              <Row k={<><kbd>g</kbd> puis <kbd>l</kbd></>} v="Livraison" />
              <Row k={<><kbd>g</kbd> puis <kbd>f</kbd></>} v="Modèles devis" />
              <Row k={<><kbd>g</kbd> puis <kbd>s</kbd></>} v="Demandes devis" />
              <Row k={<><kbd>g</kbd> puis <kbd>m</kbd></>} v="Menus" />
              <Row k={<kbd>t</kbd>} v="Thème clair / sombre" />
              <Row k={<kbd>[</kbd>} v="Plier / déplier sidebar" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ k, v }: { k: React.ReactNode; v: string }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}><span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>{k}</span><span>{v}</span></div>;
}

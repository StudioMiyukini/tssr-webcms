import { Suspense, useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from '@tanstack/react-router';
import { useTheme } from '@/lib/theme';
import { usePublicMenus, useCart, useCustomerMe, usePublicFeatures, usePublicThemeSettings, useSiteAccess } from '@/api/public';
import { SiteGate } from '@/components/SiteGate';
import { MemberGate } from '@/components/MemberGate';
import { SearchPalette } from '@/components/SearchPalette';

export function PublicLayout() {
  const access = useSiteAccess();
  const menus = usePublicMenus();
  const features = usePublicFeatures();
  const theme = usePublicThemeSettings();
  const cart = useCart();
  const me = useCustomerMe();
  const { toggleTheme } = useTheme();
  const loc = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);

  // Ouvre la palette de recherche via ⌘K / Ctrl-K (en plus du bouton loupe).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); setSearchOpen(o => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Site privé (mot de passe partagé) : écran d'accès, SAUF le forum et l'espace compte (login/profil/cloud),
  // qui restent accessibles même en mode privé (le compte a sa propre authentification).
  const bypassGate = loc.pathname === '/forum' || loc.pathname.startsWith('/forum/') || loc.pathname === '/account' || loc.pathname.startsWith('/account/');
  if (access.data?.private && !access.data.unlocked && !bypassGate) return <SiteGate />;

  // Espace membres : seul l'accueil et l'espace compte (connexion/inscription) restent publics ;
  // tout le reste exige un compte connecté → on affiche l'invitation à se connecter.
  const isHome = loc.pathname === '/';
  const memberBypass = isHome || loc.pathname === '/account' || loc.pathname.startsWith('/account/');
  if (access.data?.membersOnly && !access.data.isMember && !memberBypass) return <MemberGate />;

  const shopOn = features.data?.shop ?? false;
  const quotesOn = features.data?.quotes ?? false;
  const accountsOn = features.data?.accounts ?? false;
  const planningOn = features.data?.planning ?? false;
  const forumOn = features.data?.forum ?? false;
  // Masque les entrées de menu pointant vers un module désactivé.
  const visibleMenus = (menus.data ?? []).filter(m => {
    if (!shopOn && (m.url === '/shop' || m.url.startsWith('/shop/') || m.url.startsWith('/products'))) return false;
    if (!quotesOn && m.url.startsWith('/devis')) return false;
    if (!accountsOn && m.url.startsWith('/account')) return false;
    return true;
  });

  return (
    <>
      <header className="public-header">
        <div className="public-wrap">
          <Link to="/" className="public-brand">
            {theme.data?.logoUrl
              ? <img src={theme.data.logoUrl} alt={theme.data.brandName || 'Accueil'} className="public-logo" />
              : <><span className="brand-dot">{(theme.data?.brandName || 'Mon Site').charAt(0)}</span> {theme.data?.brandName || 'Mon Site'}</>}
          </Link>
          <nav className="public-menu">
            {visibleMenus.map(m => (
              <a key={m.id} href={m.url} className={loc.pathname === m.url ? 'active' : ''}>{m.label}</a>
            ))}
            {planningOn && <Link to="/planning" className={`public-link ${loc.pathname === '/planning' ? 'active' : ''}`}>Planning</Link>}
            {forumOn && <Link to="/forum" className={`public-link ${loc.pathname.startsWith('/forum') ? 'active' : ''}`}>Forum</Link>}
            {shopOn && (
              <Link to="/cart" className={`public-link cart-link ${loc.pathname === '/cart' ? 'active' : ''}`}>
                <span>Panier</span>
                {cart.data && cart.data.count > 0 && <span className="cart-count">{cart.data.count}</span>}
              </Link>
            )}
            {accountsOn && (
              <Link to="/account" className={`public-link ${loc.pathname.startsWith('/account') ? 'active' : ''}`}>
                {me.data ? me.data.name.split(' ')[0] : 'Compte'}
              </Link>
            )}
            <button type="button" className="public-link search-btn" onClick={() => setSearchOpen(true)} aria-label="Rechercher" title="Rechercher (Ctrl/⌘ + K)">🔍</button>
            <button className="icon-btn" onClick={toggleTheme} title="Thème" aria-label="Thème">◐</button>
          </nav>
        </div>
      </header>

      <main className="public-content">
        <div className="public-wrap"><Suspense fallback={<div className="loading">Chargement…</div>}><Outlet /></Suspense></div>
      </main>

      <footer className="public-footer">
        <div className="public-wrap">
          <span>© {new Date().getFullYear()} {theme.data?.brandName || 'Mon Site'}</span>
          <span>Construit et maintenu par <strong>Van Jean NGUYEN</strong></span>
          <span>Back-office sur <Link to="/admin">/admin</Link></span>
        </div>
      </footer>

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

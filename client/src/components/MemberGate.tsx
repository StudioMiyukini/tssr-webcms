import { Link } from '@tanstack/react-router';
import { usePublicThemeSettings } from '@/api/public';

/** Écran plein-page affiché quand le site est réservé aux membres et que le visiteur n'est pas connecté.
 *  Seul l'accueil reste public ; tout le reste invite à se connecter ou à créer un compte. */
export function MemberGate() {
  const theme = usePublicThemeSettings();
  const brand = theme.data?.brandName || 'Mon Site';

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="brand-block">
          {theme.data?.logoUrl
            ? <img src={theme.data.logoUrl} alt={brand} style={{ height: 40 }} />
            : <span className="brand-dot">{brand.charAt(0)}</span>}
          <strong>{brand}</strong>
        </div>
        <h1>🔒 Réservé aux membres</h1>
        <p>Cette page est accessible uniquement aux personnes inscrites. Connecte-toi ou crée ton compte pour accéder au contenu.</p>
        <div className="actions" style={{ marginTop: 16, gap: 10 }}>
          <Link className="btn" to="/account/login">Connexion</Link>
          <Link className="btn secondary" to="/account/register">Créer un compte</Link>
        </div>
        <p className="meta" style={{ marginTop: 18 }}>
          <Link to="/">← Retour à l’accueil</Link>
        </p>
      </div>
    </div>
  );
}

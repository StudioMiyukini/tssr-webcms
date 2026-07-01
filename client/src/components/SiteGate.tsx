import { useState, type FormEvent } from 'react';
import { useUnlockSite, usePublicThemeSettings } from '@/api/public';
import { ApiError } from '@/api/client';

/** Écran plein-page de saisie du mot de passe quand le site est en mode privé. */
export function SiteGate() {
  const theme = usePublicThemeSettings();
  const unlock = useUnlockSite();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const brand = theme.data?.brandName || 'Mon Site';

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    unlock.mutate(password, {
      onError: (err) => setError(err instanceof ApiError ? err.message : 'Échec de la connexion.'),
    });
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="brand-block">
          {theme.data?.logoUrl
            ? <img src={theme.data.logoUrl} alt={brand} style={{ height: 40 }} />
            : <span className="brand-dot">{brand.charAt(0)}</span>}
          <strong>{brand}</strong>
        </div>
        <h1>🔒 Site privé</h1>
        <p>Ce site est protégé. Saisis le mot de passe d’accès pour continuer.</p>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="site-password">Mot de passe</label>
            <input
              id="site-password"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn" type="submit" disabled={unlock.isPending || !password}>
            {unlock.isPending ? 'Vérification…' : 'Accéder au site'}
          </button>
        </form>
      </div>
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useLogin } from '@/api/hooks';

export function LoginPage() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const login = useLogin();
  const navigate = useNavigate();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    login.mutate({ username, password }, {
      onSuccess: () => navigate({ to: "/admin" }),
      onError: (err: any) => setError(err?.message || 'Connexion refusée'),
    });
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="brand-block"><span className="brand-dot">C</span><strong>CMS</strong></div>
        <h1>Connexion admin</h1>
        <p>Accédez au back-office.</p>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="username">Utilisateur</label>
            <input id="username" value={username} onChange={e => setUsername(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label htmlFor="password">Mot de passe</label>
            <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          {error && <p style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 12 }}>{error}</p>}
          <button className="btn" type="submit" disabled={login.isPending} style={{ width: '100%' }}>
            {login.isPending ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}

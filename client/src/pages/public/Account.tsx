import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  useCustomerMe, useCustomerLogin, useCustomerRegister, useCustomerLogout, useCustomerOrders,
  useUpdateProfile, useChangePassword, useMyFiles, useUploadFile, useDeleteFile, type CloudFile,
} from '@/api/public';
import { formatPriceEUR, formatDate, formatOrderStatus } from '@/lib/format';
import { useToast } from '@/lib/toast';

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  return `${(n / 1024 / 1024).toFixed(1)} Mo`;
}

export function AccountPage() {
  const me = useCustomerMe();
  const logout = useCustomerLogout();
  const orders = useCustomerOrders();
  const navigate = useNavigate();

  if (me.isLoading) return <div className="loading">Chargement…</div>;
  if (!me.data) {
    return (
      <div className="card" style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center', padding: 32 }}>
        <h1>Mon compte</h1>
        <p>Connectez-vous ou créez votre compte.</p>
        <div className="actions" style={{ justifyContent: 'center', marginTop: 16 }}>
          <Link className="btn" to="/account/login">Connexion</Link>
          <Link className="btn secondary" to="/account/register">Créer un compte</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="topbar-row">
        <div><h1>Mon compte</h1><p>{me.data.email}</p></div>
        <div className="actions">
          <Link className="btn" to="/account/cloud">☁️ Mon cloud</Link>
          <button className="btn secondary" onClick={() => logout.mutate(undefined, { onSuccess: () => navigate({ to: '/account' }) })}>Déconnexion</button>
        </div>
      </div>

      <div className="row">
        <ProfileCard />
        <PasswordCard />
      </div>

      {orders.data && orders.data.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>Mes commandes</h2>
          <table className="wp-list">
            <thead><tr><th>Commande</th><th>Date</th><th>Statut</th><th>Total</th><th></th></tr></thead>
            <tbody>
              {orders.data.map(o => (
                <tr key={o.id}>
                  <td><strong>{o.order_number}</strong></td>
                  <td className="meta">{formatDate(o.created_at)}</td>
                  <td><span className={`status-badge ${o.status}`}>{formatOrderStatus(o.status)}</span></td>
                  <td>{formatPriceEUR(o.total_cents)}</td>
                  <td><a className="btn small" href={`/api/customer/orders/${o.id}/invoice.pdf`} target="_blank" rel="noreferrer">Facture</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function ProfileCard() {
  const me = useCustomerMe();
  const update = useUpdateProfile();
  const { push } = useToast();
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', company: '', address: '' });

  useEffect(() => { if (me.data) setForm({ name: me.data.name, phone: me.data.phone, company: me.data.company, address: me.data.address }); }, [me.data]);
  if (!me.data) return null;

  const save = (e: FormEvent) => {
    e.preventDefault();
    update.mutate(form, { onSuccess: () => { push('Profil mis à jour.', 'success'); setEdit(false); }, onError: () => push('Échec.', 'error') });
  };

  return (
    <div className="card">
      <div className="topbar-row"><h2 style={{ margin: 0 }}>Mon profil</h2>{!edit && <button className="btn secondary small" onClick={() => setEdit(true)}>Modifier</button>}</div>
      {!edit ? (
        <>
          <p><strong>{me.data.name}</strong></p>
          <p className="meta">{me.data.company}{me.data.company && me.data.phone ? ' · ' : ''}{me.data.phone}</p>
          {me.data.address && <p className="meta" style={{ whiteSpace: 'pre-line', marginTop: 8 }}>{me.data.address}</p>}
        </>
      ) : (
        <form onSubmit={save}>
          <div className="field"><label>Nom complet *</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div className="row">
            <div className="field"><label>Téléphone</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="field"><label>Société</label><input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} /></div>
          </div>
          <div className="field"><label>Adresse</label><textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
          <div className="actions">
            <button className="btn" type="submit" disabled={update.isPending}>{update.isPending ? 'Enregistrement…' : 'Enregistrer'}</button>
            <button className="btn secondary" type="button" onClick={() => setEdit(false)}>Annuler</button>
          </div>
        </form>
      )}
    </div>
  );
}

function PasswordCard() {
  const change = useChangePassword();
  const { push } = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState('');

  const save = (e: FormEvent) => {
    e.preventDefault(); setError('');
    change.mutate({ current, next }, {
      onSuccess: () => { push('Mot de passe modifié.', 'success'); setCurrent(''); setNext(''); },
      onError: (err: any) => setError(err?.message || 'Échec.'),
    });
  };

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Mot de passe</h2>
      <form onSubmit={save}>
        <div className="field"><label>Mot de passe actuel</label><input type="password" required value={current} onChange={e => setCurrent(e.target.value)} /></div>
        <div className="field"><label>Nouveau mot de passe (8+ caractères)</label><input type="password" required minLength={8} value={next} onChange={e => setNext(e.target.value)} /></div>
        {error && <p className="form-error">{error}</p>}
        <button className="btn" type="submit" disabled={change.isPending}>{change.isPending ? 'Modification…' : 'Changer le mot de passe'}</button>
      </form>
    </div>
  );
}

// ===== Cloud privé =====
export function CloudPage() {
  const me = useCustomerMe();
  const files = useMyFiles();
  const upload = useUploadFile();
  const del = useDeleteFile();
  const { push } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  if (me.isLoading) return <div className="loading">Chargement…</div>;
  if (!me.data) return <div className="empty">Connecte-toi pour accéder à ton cloud. <Link to="/account/login">Connexion</Link></div>;

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 24 * 1024 * 1024) { push('Fichier trop volumineux (max 24 Mo).', 'error'); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => {
      upload.mutate({ filename: file.name, dataUrl: String(reader.result) }, {
        onSuccess: () => push('Fichier ajouté.', 'success'),
        onError: (err: any) => push(err?.message || 'Échec de l’envoi.', 'error'),
      });
      if (inputRef.current) inputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const list = files.data ?? [];
  const used = list.reduce((s, f) => s + f.size, 0);

  return (
    <>
      <div className="topbar-row">
        <div><h1>☁️ Mon cloud</h1><p className="meta">{me.data.email} · {list.length} fichier{list.length > 1 ? 's' : ''} · {fmtBytes(used)} utilisés</p></div>
        <div className="actions">
          <Link className="btn secondary" to="/account">← Mon compte</Link>
          <button className="btn" onClick={() => inputRef.current?.click()} disabled={upload.isPending}>{upload.isPending ? 'Envoi…' : '＋ Téléverser'}</button>
          <input ref={inputRef} type="file" style={{ display: 'none' }} onChange={onPick} />
        </div>
      </div>
      <div className="card">
        {files.isLoading && <div className="loading">Chargement…</div>}
        {list.length === 0 && !files.isLoading && <div className="empty">Aucun fichier. Téléverse ton premier document (max 24 Mo).</div>}
        {list.length > 0 && (
          <table className="wp-list">
            <thead><tr><th className="column-primary">Fichier</th><th>Taille</th><th>Ajouté</th><th>Actions</th></tr></thead>
            <tbody>
              {list.map((f: CloudFile) => (
                <tr key={f.id}>
                  <td className="column-primary">{f.original_name}<div className="meta">{f.mime}</div></td>
                  <td data-label="Taille">{fmtBytes(f.size)}</td>
                  <td data-label="Ajouté" className="meta">{formatDate(f.created_at)}</td>
                  <td className="actions" data-label="Actions">
                    <a className="btn small" href={`/api/customer/cloud/${f.id}/download`}>Télécharger</a>{' '}
                    <button className="btn danger small" onClick={() => { if (confirm(`Supprimer « ${f.original_name} » ?`)) del.mutate(f.id, { onSuccess: () => push('Fichier supprimé.', 'success') }); }}>Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export function AccountLoginPage() {
  const login = useCustomerLogin();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    login.mutate({ email, password }, {
      onSuccess: () => navigate({ to: '/account' }),
      onError: (err: any) => setError(err?.message || 'Identifiants invalides'),
    });
  };

  return (
    <div className="card" style={{ maxWidth: 420, margin: '40px auto', padding: 28 }}>
      <h1>Connexion client</h1>
      <p>Pas encore de compte ? <Link to="/account/register">Créer un compte</Link></p>
      <form onSubmit={submit}>
        <div className="field"><label>Email</label><input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoFocus /></div>
        <div className="field"><label>Mot de passe</label><input type="password" required value={password} onChange={e => setPassword(e.target.value)} /></div>
        {error && <p style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</p>}
        <button className="btn" type="submit" disabled={login.isPending} style={{ width: '100%' }}>{login.isPending ? 'Connexion…' : 'Se connecter'}</button>
      </form>
    </div>
  );
}

export function AccountRegisterPage() {
  const register = useCustomerRegister();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', company: '', address: '' });
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    register.mutate(form, {
      onSuccess: () => navigate({ to: '/account' }),
      onError: (err: any) => setError(err?.message || 'Erreur lors de la création'),
    });
  };

  return (
    <div className="card" style={{ maxWidth: 520, margin: '40px auto', padding: 28 }}>
      <h1>Créer un compte</h1>
      <p>Déjà un compte ? <Link to="/account/login">Connexion</Link></p>
      <form onSubmit={submit}>
        <div className="field"><label>Nom complet *</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
        <div className="field"><label>Email *</label><input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
        <div className="field"><label>Mot de passe *</label><input type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
        <div className="row">
          <div className="field"><label>Téléphone</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="field"><label>Société</label><input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} /></div>
        </div>
        <div className="field"><label>Adresse</label><textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
        {error && <p style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</p>}
        <button className="btn" type="submit" disabled={register.isPending} style={{ width: '100%' }}>{register.isPending ? 'Création…' : 'Créer mon compte'}</button>
      </form>
    </div>
  );
}

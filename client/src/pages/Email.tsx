import { useEffect, useState } from 'react';
import { useEmailSettings, useUpdateEmailSettings, useEmailLogs, useSendTestEmail } from '@/api/hooks';
import { useToast } from '@/lib/toast';
import type { EmailSettings } from '@shared/types';

const EMPTY: EmailSettings = { host: '', port: 587, user: '', pass: '', from: '', notifyTo: '', notifyOnForm: true, notifyOnQuote: true, notifyOnOrder: true, ackToSubmitter: false };

export function EmailPage() {
  const q = useEmailSettings();
  const update = useUpdateEmailSettings();
  const logs = useEmailLogs();
  const test = useSendTestEmail();
  const { push } = useToast();
  const [s, setS] = useState<EmailSettings>(EMPTY);
  const [testTo, setTestTo] = useState('');

  useEffect(() => { if (q.data) setS(q.data); }, [q.data]);
  const set = (patch: Partial<EmailSettings>) => setS(p => ({ ...p, ...patch }));
  const onSave = () => update.mutate(s, { onSuccess: () => push('Réglages email enregistrés.', 'success'), onError: () => push('Échec de l’enregistrement.', 'error') });
  const onTest = () => test.mutate(testTo, {
    onSuccess: (r) => push(r.ok ? 'Email de test envoyé ✅' : (r.skipped ? 'Ignoré : SMTP non configuré.' : 'Échec de l’envoi.'), r.ok ? 'success' : 'error'),
    onError: () => push('Échec de l’envoi.', 'error'),
  });

  if (q.isLoading) return <div className="loading">Chargement…</div>;

  return (
    <>
      <div className="topbar-row">
        <div><h1>Emails</h1><p>Configuration SMTP et notifications automatiques.</p></div>
        <button className="btn" type="button" onClick={onSave} disabled={update.isPending}>{update.isPending ? 'Enregistrement…' : 'Enregistrer'}</button>
      </div>

      <div className="card">
        <h2>Serveur SMTP</h2>
        <div className="row">
          <div className="field"><label>Hôte</label><input value={s.host} onChange={e => set({ host: e.target.value })} placeholder="smtp.exemple.com" /></div>
          <div className="field"><label>Port</label><input type="number" value={s.port} onChange={e => set({ port: Number(e.target.value) })} /></div>
        </div>
        <div className="row">
          <div className="field"><label>Utilisateur</label><input value={s.user} onChange={e => set({ user: e.target.value })} autoComplete="off" /></div>
          <div className="field"><label>Mot de passe</label><input type="password" value={s.pass} onChange={e => set({ pass: e.target.value })} autoComplete="new-password" /></div>
        </div>
        <div className="row">
          <div className="field"><label>Expéditeur (From)</label><input value={s.from} onChange={e => set({ from: e.target.value })} placeholder="Mon Site <no-reply@example.com>" /></div>
          <div className="field"><label>Destinataire des notifications</label><input value={s.notifyTo} onChange={e => set({ notifyTo: e.target.value })} placeholder="admin@example.com" /></div>
        </div>
        <p className="hint">Port 465 = SSL implicite ; 587 = STARTTLS. Repli automatique sur les variables d'environnement si laissé vide.</p>
      </div>

      <div className="card">
        <h2>Notifications automatiques</h2>
        <ul className="feature-list">
          <ToggleRow label="Nouvelle réponse de formulaire" desc="Email à l'admin à chaque soumission de formulaire." on={s.notifyOnForm} onChange={v => set({ notifyOnForm: v })} />
          <ToggleRow label="Nouvelle demande de devis" desc="Email à l'admin sur nouvelle demande de devis." on={s.notifyOnQuote} onChange={v => set({ notifyOnQuote: v })} />
          <ToggleRow label="Nouvelle commande" desc="Email à l'admin sur nouvelle commande boutique." on={s.notifyOnOrder} onChange={v => set({ notifyOnOrder: v })} />
          <ToggleRow label="Accusé de réception au répondant" desc="Confirmation automatique si le formulaire contient un champ email." on={s.ackToSubmitter} onChange={v => set({ ackToSubmitter: v })} />
        </ul>
      </div>

      <div className="card">
        <h2>Envoyer un email de test</h2>
        <div className="media-field">
          <input value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="ton@email.com" type="email" />
          <button className="btn secondary" type="button" onClick={onTest} disabled={!testTo || test.isPending}>{test.isPending ? 'Envoi…' : 'Envoyer le test'}</button>
        </div>
        <p className="hint">Enregistre d'abord ta config SMTP, puis envoie un test.</p>
      </div>

      <div className="card">
        <h2>Journal des emails</h2>
        {logs.isLoading && <div className="loading">Chargement…</div>}
        {logs.isError && <div className="empty">Erreur de chargement.</div>}
        {logs.data && logs.data.length === 0 && <div className="empty">Aucun email pour le moment.</div>}
        {logs.data && logs.data.length > 0 && (
          <table className="wp-list">
            <thead><tr><th>Date</th><th>Destinataire</th><th>Sujet</th><th>Type</th><th>Statut</th></tr></thead>
            <tbody>
              {logs.data.map(l => (
                <tr key={l.id}>
                  <td className="meta">{l.created_at}</td>
                  <td>{l.recipient}</td>
                  <td>{l.subject}</td>
                  <td><code>{l.event_type}</code></td>
                  <td><span className={`status-badge ${l.status === 'sent' ? 'active' : l.status === 'error' ? 'cancelled' : 'draft'}`}>{l.status}</span>{l.error_message && <div className="meta">{l.error_message}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function ToggleRow({ label, desc, on, onChange }: { label: string; desc: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <li className="feature-row">
      <div className="feature-text"><div className="feature-name">{label}</div>{desc && <p className="meta">{desc}</p>}</div>
      <label className="switch"><input type="checkbox" checked={on} onChange={e => onChange(e.target.checked)} /><span className="switch-slider" aria-hidden /></label>
    </li>
  );
}

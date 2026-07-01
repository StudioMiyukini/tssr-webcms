import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { EmailTemplates, type EmailTemplateInput } from '@/api/hooks';
import { useToast } from '@/lib/toast';

export function TemplatesListPage() {
  const list = EmailTemplates.useList();
  const del = EmailTemplates.useDelete();
  const { push } = useToast();
  return (
    <>
      <div className="topbar-row">
        <div><h1>Modèles d'email</h1><p>Objet + corps réutilisables. Variables : <code>{'{{name}}'}</code>, <code>{'{{email}}'}</code>.</p></div>
        <Link className="btn" to="/admin/email-templates/new">＋ Nouveau modèle</Link>
      </div>
      <div className="card">
        {list.isLoading && <div className="loading">Chargement…</div>}
        {list.isError && <div className="empty">Erreur de chargement.</div>}
        {list.data && list.data.length === 0 && <div className="empty">Aucun modèle. <Link to="/admin/email-templates/new">Créer le premier</Link></div>}
        {list.data && list.data.length > 0 && (
          <table className="wp-list">
            <thead><tr><th className="column-primary">Nom</th><th>Objet</th><th>Actions</th></tr></thead>
            <tbody>
              {list.data.map(t => (
                <tr key={t.id}>
                  <td className="column-primary">{t.name}</td>
                  <td data-label="Objet">{t.subject || <span className="meta">(vide)</span>}</td>
                  <td className="actions" data-label="Actions">
                    <Link className="btn small" to="/admin/email-templates/$id/edit" params={{ id: String(t.id) }}>Modifier</Link>{' '}
                    <button className="btn danger small" onClick={() => { if (confirm('Supprimer ce modèle ?')) del.mutate(t.id, { onSuccess: () => push('Modèle supprimé.', 'success') }); }}>Supprimer</button>
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

const EMPTY: EmailTemplateInput = { name: '', subject: '', body_html: '' };

export function TemplateEditPage() {
  const params = useParams({ strict: false }) as { id?: string };
  const navigate = useNavigate();
  const { push } = useToast();
  const id = params.id ? Number(params.id) : null;
  const existing = EmailTemplates.useOne(id);
  const create = EmailTemplates.useCreate();
  const update = EmailTemplates.useUpdate();
  const [form, setForm] = useState<EmailTemplateInput>(EMPTY);

  useEffect(() => {
    if (existing.data) setForm({ name: existing.data.name, subject: existing.data.subject, body_html: existing.data.body_html });
  }, [existing.data]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (id) update.mutate({ id, data: form }, { onSuccess: () => { push('Modèle mis à jour.', 'success'); navigate({ to: '/admin/email-templates' }); } });
    else create.mutate(form, { onSuccess: () => { push('Modèle créé.', 'success'); navigate({ to: '/admin/email-templates' }); } });
  };

  if (id && existing.isLoading) return <div className="loading">Chargement…</div>;

  return (
    <form onSubmit={onSubmit}>
      <div className="topbar-row">
        <div><h1>{id ? 'Modifier le modèle' : 'Nouveau modèle'}</h1></div>
        <div className="actions">
          <Link className="btn secondary" to="/admin/email-templates">← Retour</Link>
          <button className="btn" type="submit" disabled={create.isPending || update.isPending}>{(create.isPending || update.isPending) ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </div>
      <div className="card">
        <div className="field"><label>Nom du modèle *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="ex: Newsletter mensuelle" /></div>
        <div className="field"><label>Objet</label><input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Objet de l'email" /></div>
        <div className="field"><label>Corps (HTML)</label>
          <textarea value={form.body_html} onChange={e => setForm({ ...form, body_html: e.target.value })} style={{ minHeight: 240, fontFamily: 'SF Mono, Menlo, Consolas, monospace', fontSize: 12 }} placeholder="<h1>Bonjour {{name}}</h1><p>…</p>" />
          <span className="hint">HTML autorisé. Variables remplacées à l'envoi : <code>{'{{name}}'}</code>, <code>{'{{email}}'}</code>.</span>
        </div>
      </div>
    </form>
  );
}

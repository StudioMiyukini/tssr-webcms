import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { Forms, useFormSubmissions, useFormMetrics, useDeleteFormSubmission, type FormInput } from '@/api/hooks';
import { useToast } from '@/lib/toast';
import { FormBuilder, normalizeFormFields } from '@/components/FormBuilder';
import type { FormField, FormFieldMetric } from '@shared/types';

// ===== Liste =====
export function FormsListPage() {
  const list = Forms.useList();
  const del = Forms.useDelete();
  const { push } = useToast();
  return (
    <>
      <div className="topbar-row">
        <div><h1>Formulaires</h1><p>Formulaires personnalisés type Google Forms, avec réponses et métriques.</p></div>
        <Link className="btn" to="/admin/forms/new">＋ Créer un formulaire</Link>
      </div>
      <div className="card">
        {list.isLoading && <div className="loading">Chargement…</div>}
        {list.isError && <div className="empty">Erreur de chargement.</div>}
        {list.data && list.data.length === 0 && <div className="empty">Aucun formulaire. <Link to="/admin/forms/new">Créer le premier</Link></div>}
        {list.data && list.data.length > 0 && (
          <table className="wp-list">
            <thead><tr><th className="column-primary">Titre</th><th>Réponses</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>
              {list.data.map(f => (
                <tr key={f.id}>
                  <td className="column-primary">{f.title}<div className="meta"><code>/f/{f.slug}</code></div></td>
                  <td data-label="Réponses">{f.submissions_count}</td>
                  <td data-label="Statut"><span className={`status-badge ${f.published ? 'published' : 'draft'}`}>{f.published ? 'Publié' : 'Brouillon'}</span></td>
                  <td className="actions" data-label="Actions">
                    <Link className="btn small" to="/admin/forms/$id/results" params={{ id: String(f.id) }}>Résultats</Link>{' '}
                    <Link className="btn secondary small" to="/admin/forms/$id/edit" params={{ id: String(f.id) }}>Modifier</Link>{' '}
                    <a className="btn secondary small" href={`/f/${f.slug}`} target="_blank" rel="noreferrer">Voir</a>{' '}
                    <button className="btn danger small" onClick={() => { if (confirm('Supprimer ce formulaire et ses réponses ?')) del.mutate(f.id, { onSuccess: () => push('Formulaire supprimé.', 'success') }); }}>Supprimer</button>
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

// ===== Édition =====
const EMPTY: FormInput = { title: '', slug: '', description: '', fields_json: '[]', success_message: 'Merci, votre réponse a bien été enregistrée.', published: 1 };

export function FormEditPage() {
  const params = useParams({ strict: false }) as { id?: string };
  const navigate = useNavigate();
  const { push } = useToast();
  const id = params.id ? Number(params.id) : null;
  const existing = Forms.useOne(id);
  const create = Forms.useCreate();
  const update = Forms.useUpdate();
  const [form, setForm] = useState<FormInput>(EMPTY);
  const [fields, setFields] = useState<FormField[]>([]);

  useEffect(() => {
    if (existing.data) {
      setForm({ title: existing.data.title, slug: existing.data.slug, description: existing.data.description, success_message: existing.data.success_message, published: existing.data.published });
      setFields(normalizeFormFields(existing.data.fields_json));
    }
  }, [existing.data]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: FormInput = { ...form, fields_json: JSON.stringify(fields) };
    if (id) update.mutate({ id, data: payload }, { onSuccess: () => { push('Formulaire mis à jour.', 'success'); navigate({ to: '/admin/forms' }); } });
    else create.mutate(payload, { onSuccess: () => { push('Formulaire créé.', 'success'); navigate({ to: '/admin/forms' }); } });
  };

  if (id && existing.isLoading) return <div className="loading">Chargement…</div>;

  return (
    <form onSubmit={onSubmit}>
      <div className="topbar-row">
        <div><h1>{id ? 'Modifier le formulaire' : 'Nouveau formulaire'}</h1><p>Paramètres et champs.</p></div>
        <div className="actions">
          <Link className="btn secondary" to="/admin/forms">← Retour</Link>
          <button className="btn" type="submit" disabled={create.isPending || update.isPending}>{(create.isPending || update.isPending) ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </div>

      <div className="card">
        <div className="row">
          <div className="field"><label>Titre *</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
          <div className="field"><label>Slug</label><input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="auto si vide → /f/slug" /></div>
        </div>
        <div className="field"><label>Description</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        <div className="row">
          <div className="field"><label>Message de confirmation</label><input value={form.success_message} onChange={e => setForm({ ...form, success_message: e.target.value })} /></div>
          <div className="field"><label>Statut</label>
            <select value={form.published} onChange={e => setForm({ ...form, published: Number(e.target.value) })}><option value={1}>Publié</option><option value={0}>Brouillon</option></select>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Champs du formulaire</h2>
        <FormBuilder fields={fields} onChange={setFields} />
      </div>
    </form>
  );
}

// ===== Résultats (métriques + réponses) =====
export function FormResultsPage() {
  const params = useParams({ strict: false }) as { id?: string };
  const id = params.id ? Number(params.id) : null;
  const form = Forms.useOne(id);
  const metrics = useFormMetrics(id);
  const subs = useFormSubmissions(id);
  const del = useDeleteFormSubmission(id || 0);
  const { push } = useToast();
  const [tab, setTab] = useState<'metrics' | 'responses'>('metrics');

  const cols = metrics.data?.fields ?? [];
  const cell = (v: unknown) => Array.isArray(v) ? v.join(', ') : (v == null ? '' : String(v));

  return (
    <>
      <div className="topbar-row">
        <div><h1>Résultats — {form.data?.title ?? '…'}</h1><p>{metrics.data?.total ?? 0} réponse(s).</p></div>
        <Link className="btn secondary" to="/admin/forms">← Retour</Link>
      </div>

      <div className="card">
        <div className="tabs-bar">
          <button type="button" className={`tab-btn ${tab === 'metrics' ? 'active' : ''}`} onClick={() => setTab('metrics')}>Métriques</button>
          <button type="button" className={`tab-btn ${tab === 'responses' ? 'active' : ''}`} onClick={() => setTab('responses')}>Réponses ({subs.data?.length ?? 0})</button>
        </div>

        {tab === 'metrics' && (
          <div>
            {metrics.isLoading && <div className="loading">Chargement…</div>}
            {metrics.data && metrics.data.total === 0 && <div className="empty">Aucune réponse pour le moment.</div>}
            {metrics.data && metrics.data.fields.map(f => <FieldMetricCard key={f.name} f={f} total={metrics.data!.total} />)}
          </div>
        )}

        {tab === 'responses' && (
          <div style={{ overflowX: 'auto' }}>
            {subs.isLoading && <div className="loading">Chargement…</div>}
            {subs.data && subs.data.length === 0 && <div className="empty">Aucune réponse.</div>}
            {subs.data && subs.data.length > 0 && (
              <table className="wp-list">
                <thead><tr><th>Date</th>{cols.map(c => <th key={c.name}>{c.label}</th>)}<th></th></tr></thead>
                <tbody>
                  {subs.data.map(s => (
                    <tr key={s.id}>
                      <td className="meta">{s.created_at}</td>
                      {cols.map(c => <td key={c.name}>{cell(s.payload[c.name])}</td>)}
                      <td><button className="btn danger small" onClick={() => { if (confirm('Supprimer cette réponse ?')) del.mutate(s.id, { onSuccess: () => push('Réponse supprimée.', 'success') }); }}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function FieldMetricCard({ f, total }: { f: FormFieldMetric; total: number }) {
  return (
    <div className="metric-card">
      <div className="metric-head"><strong>{f.label}</strong><span className="meta">{f.answered}/{total} répondu(s)</span></div>
      {f.options && (
        <div className="metric-bars">
          {f.options.map(o => {
            const pct = f.answered ? Math.round((o.count / f.answered) * 100) : 0;
            return (
              <div key={o.label} className="metric-bar-row">
                <span className="metric-bar-label" title={o.label}>{o.label}</span>
                <span className="metric-bar"><span className="metric-bar-fill" style={{ width: `${pct}%` }} /></span>
                <span className="metric-bar-val">{o.count} · {pct}%</span>
              </div>
            );
          })}
        </div>
      )}
      {f.number && <p className="meta">Moyenne <strong>{f.number.avg}</strong> · min {f.number.min} · max {f.number.max} · {f.number.count} valeur(s)</p>}
      {f.samples && (
        <ul className="metric-samples">
          {f.samples.length === 0 && <li className="meta">—</li>}
          {f.samples.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      )}
    </div>
  );
}

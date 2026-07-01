import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { Events, type EventInput } from '@/api/hooks';
import { useToast } from '@/lib/toast';
import { formatEventDate } from '@/lib/format';
import { MediaField } from '@/components/MediaPicker';

export function EventsListPage() {
  const list = Events.useList();
  const del = Events.useDelete();
  const { push } = useToast();
  const now = new Date().toISOString().slice(0, 16);
  return (
    <>
      <div className="topbar-row">
        <div><h1>Agenda</h1><p>Programme tes événements ; ils s'affichent sur <code>/agenda</code>.</p></div>
        <Link className="btn" to="/admin/events/new">＋ Nouvel événement</Link>
      </div>
      <div className="card">
        {list.isLoading && <div className="loading">Chargement…</div>}
        {list.isError && <div className="empty">Erreur de chargement.</div>}
        {list.data && list.data.length === 0 && <div className="empty">Aucun événement. <Link to="/admin/events/new">Créer le premier</Link></div>}
        {list.data && list.data.length > 0 && (
          <table className="wp-list">
            <thead><tr><th className="column-primary">Événement</th><th>Date</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>
              {list.data.map(ev => (
                <tr key={ev.id}>
                  <td className="column-primary">{ev.title}<div className="meta">{ev.location || <code>/agenda/{ev.slug}</code>}</div></td>
                  <td data-label="Date">
                    {formatEventDate(ev.start_at, ev.end_at, !!ev.all_day)}
                    {ev.start_at && ev.start_at < now && <span className="status-badge draft" style={{ marginLeft: 6 }}>Passé</span>}
                  </td>
                  <td data-label="Statut"><span className={`status-badge ${ev.published ? 'published' : 'draft'}`}>{ev.published ? 'Publié' : 'Brouillon'}</span></td>
                  <td className="actions" data-label="Actions">
                    <Link className="btn small" to="/admin/events/$id/edit" params={{ id: String(ev.id) }}>Modifier</Link>{' '}
                    <a className="btn secondary small" href={`/agenda/${ev.slug}`} target="_blank" rel="noreferrer">Voir</a>{' '}
                    <button className="btn danger small" onClick={() => { if (confirm('Supprimer cet événement ?')) del.mutate(ev.id, { onSuccess: () => push('Événement supprimé.', 'success') }); }}>Supprimer</button>
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

const EMPTY: EventInput = { title: '', slug: '', description: '', location: '', start_at: '', end_at: '', all_day: 0, url: '', image_url: '', published: 1 };

export function EventEditPage() {
  const params = useParams({ strict: false }) as { id?: string };
  const navigate = useNavigate();
  const { push } = useToast();
  const id = params.id ? Number(params.id) : null;
  const existing = Events.useOne(id);
  const create = Events.useCreate();
  const update = Events.useUpdate();
  const [form, setForm] = useState<EventInput>(EMPTY);

  useEffect(() => {
    if (existing.data) {
      const d = existing.data;
      setForm({ title: d.title, slug: d.slug, description: d.description, location: d.location, start_at: d.start_at, end_at: d.end_at, all_day: d.all_day, url: d.url, image_url: d.image_url, published: d.published });
    }
  }, [existing.data]);

  const set = (patch: Partial<EventInput>) => setForm(f => ({ ...f, ...patch }));
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.start_at) { push('La date de début est requise.', 'error'); return; }
    if (id) update.mutate({ id, data: form }, { onSuccess: () => { push('Événement mis à jour.', 'success'); navigate({ to: '/admin/events' }); } });
    else create.mutate(form, { onSuccess: () => { push('Événement créé.', 'success'); navigate({ to: '/admin/events' }); } });
  };

  if (id && existing.isLoading) return <div className="loading">Chargement…</div>;

  return (
    <form onSubmit={onSubmit}>
      <div className="topbar-row">
        <div><h1>{id ? 'Modifier l\'événement' : 'Nouvel événement'}</h1></div>
        <div className="actions">
          <Link className="btn secondary" to="/admin/events">← Retour</Link>
          <button className="btn" type="submit" disabled={create.isPending || update.isPending}>{(create.isPending || update.isPending) ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </div>

      <div className="card">
        <div className="row">
          <div className="field"><label>Titre *</label><input value={form.title} onChange={e => set({ title: e.target.value })} required /></div>
          <div className="field"><label>Slug</label><input value={form.slug} onChange={e => set({ slug: e.target.value })} placeholder="auto si vide → /agenda/slug" /></div>
        </div>
        <div className="row">
          <div className="field"><label>Début *</label><input type="datetime-local" value={form.start_at} onChange={e => set({ start_at: e.target.value })} required /></div>
          <div className="field"><label>Fin (optionnel)</label><input type="datetime-local" value={form.end_at} onChange={e => set({ end_at: e.target.value })} /></div>
        </div>
        <div className="row">
          <label className="block-checkbox"><input type="checkbox" checked={!!form.all_day} onChange={e => set({ all_day: e.target.checked ? 1 : 0 })} /> Journée entière (ignore l'heure)</label>
          <div className="field"><label>Statut</label>
            <select value={form.published} onChange={e => set({ published: Number(e.target.value) })}><option value={1}>Publié</option><option value={0}>Brouillon</option></select>
          </div>
        </div>
        <div className="row">
          <div className="field"><label>Lieu</label><input value={form.location} onChange={e => set({ location: e.target.value })} placeholder="ex: Château Catala, Saint-Orens" /></div>
          <div className="field"><label>Lien (billetterie, infos…)</label><input value={form.url} onChange={e => set({ url: e.target.value })} placeholder="https://…" /></div>
        </div>
        <MediaField label="Image (optionnel)" value={form.image_url || ''} onChange={image_url => set({ image_url })} />
        <div className="field"><label>Description</label><textarea value={form.description} onChange={e => set({ description: e.target.value })} style={{ minHeight: 140 }} /></div>
      </div>
    </form>
  );
}

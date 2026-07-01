import { useState } from 'react';
import { ForumCategories, useForumTopicsAdmin, useModerateForumTopic, useDeleteForumTopic } from '@/api/hooks';
import { useToast } from '@/lib/toast';
import type { ForumCategory } from '@shared/types';

export function ForumAdminPage() {
  const cats = ForumCategories.useList();
  const createCat = ForumCategories.useCreate();
  const updateCat = ForumCategories.useUpdate();
  const deleteCat = ForumCategories.useDelete();
  const topics = useForumTopicsAdmin();
  const moderate = useModerateForumTopic();
  const delTopic = useDeleteForumTopic();
  const { push } = useToast();

  const [name, setName] = useState('');
  const [editing, setEditing] = useState<ForumCategory | null>(null);

  const catById = new Map((cats.data ?? []).map(c => [c.id, c]));

  const addCat = () => {
    if (!name.trim()) return;
    createCat.mutate({ name: name.trim(), description: '', sort_order: (cats.data?.length ?? 0) } as any, {
      onSuccess: () => { push('Catégorie créée.', 'success'); setName(''); },
      onError: () => push('Échec (slug déjà pris ?).', 'error'),
    });
  };
  const saveCat = () => {
    if (!editing) return;
    updateCat.mutate({ id: editing.id, data: { name: editing.name, description: editing.description, sort_order: editing.sort_order } as any }, {
      onSuccess: () => { push('Catégorie mise à jour.', 'success'); setEditing(null); },
    });
  };

  return (
    <>
      <div className="topbar-row"><div><h1>Forum</h1><p>Catégories et modération des discussions (<code>/forum</code>).</p></div></div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Catégories</h2>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 1 }}><label>Nouvelle catégorie</label><input value={name} onChange={e => setName(e.target.value)} placeholder="ex: Questions générales" onKeyDown={e => { if (e.key === 'Enter') addCat(); }} /></div>
          <button type="button" className="btn" onClick={addCat} disabled={createCat.isPending}>Ajouter</button>
        </div>
        {cats.data && cats.data.length > 0 && (
          <table className="wp-list" style={{ marginTop: 12 }}>
            <thead><tr><th className="column-primary">Nom</th><th>Slug</th><th>Actions</th></tr></thead>
            <tbody>
              {cats.data.map(c => (
                <tr key={c.id}>
                  <td className="column-primary">
                    {editing?.id === c.id
                      ? <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
                      : <>{c.name}{c.description && <div className="meta">{c.description}</div>}</>}
                  </td>
                  <td data-label="Slug"><code>{c.slug}</code></td>
                  <td className="actions" data-label="Actions">
                    {editing?.id === c.id
                      ? <><button className="btn small" onClick={saveCat}>Enregistrer</button>{' '}<button className="btn secondary small" onClick={() => setEditing(null)}>Annuler</button></>
                      : <><button className="btn secondary small" onClick={() => setEditing(c)}>Modifier</button>{' '}
                        <button className="btn danger small" onClick={() => { if (confirm('Supprimer la catégorie et tous ses sujets ?')) deleteCat.mutate(c.id, { onSuccess: () => push('Catégorie supprimée.', 'success') }); }}>Supprimer</button></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Sujets</h2>
        {topics.isLoading && <div className="loading">Chargement…</div>}
        {topics.data && topics.data.length === 0 && <div className="empty">Aucun sujet pour le moment.</div>}
        {topics.data && topics.data.length > 0 && (
          <table className="wp-list">
            <thead><tr><th className="column-primary">Sujet</th><th>Catégorie</th><th>Réponses</th><th>Actions</th></tr></thead>
            <tbody>
              {topics.data.map(t => (
                <tr key={t.id}>
                  <td className="column-primary">
                    {t.pinned ? '📌 ' : ''}{t.locked ? '🔒 ' : ''}{t.title}
                    <div className="meta">par {t.author || 'Anonyme'} · <a href={`/forum/sujet/${t.slug}`} target="_blank" rel="noreferrer">voir</a></div>
                  </td>
                  <td data-label="Catégorie">{catById.get(t.category_id)?.name ?? '—'}</td>
                  <td data-label="Réponses">{t.reply_count}</td>
                  <td className="actions" data-label="Actions">
                    <button className="btn secondary small" onClick={() => moderate.mutate({ id: t.id, data: { pinned: t.pinned ? 0 : 1 } })}>{t.pinned ? 'Désépingler' : 'Épingler'}</button>{' '}
                    <button className="btn secondary small" onClick={() => moderate.mutate({ id: t.id, data: { locked: t.locked ? 0 : 1 } })}>{t.locked ? 'Déverrouiller' : 'Verrouiller'}</button>{' '}
                    <button className="btn danger small" onClick={() => { if (confirm('Supprimer ce sujet et ses réponses ?')) delTopic.mutate(t.id, { onSuccess: () => push('Sujet supprimé.', 'success') }); }}>Supprimer</button>
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

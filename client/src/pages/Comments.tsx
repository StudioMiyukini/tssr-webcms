import { useState } from 'react';
import { useComments, useApproveComment, useDeleteComment } from '@/api/hooks';
import { useToast } from '@/lib/toast';

export function CommentsPage() {
  const [status, setStatus] = useState('pending');
  const list = useComments(status || undefined);
  const approve = useApproveComment();
  const del = useDeleteComment();
  const { push } = useToast();

  const tabs: Array<{ k: string; label: string }> = [
    { k: 'pending', label: 'En attente' }, { k: 'approved', label: 'Approuvés' }, { k: '', label: 'Tous' },
  ];

  return (
    <>
      <div className="topbar-row"><div><h1>Commentaires</h1><p>Modération des commentaires d'articles.</p></div></div>
      <div className="card">
        <div className="tabs-bar">
          {tabs.map(t => <button key={t.k || 'all'} type="button" className={`tab-btn ${status === t.k ? 'active' : ''}`} onClick={() => setStatus(t.k)}>{t.label}</button>)}
        </div>
        {list.isLoading && <div className="loading">Chargement…</div>}
        {list.isError && <div className="empty">Erreur de chargement.</div>}
        {list.data && list.data.length === 0 && <div className="empty">Aucun commentaire.</div>}
        {list.data && list.data.length > 0 && (
          <table className="wp-list">
            <thead><tr><th>Date</th><th>Article</th><th>Auteur</th><th>Message</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>
              {list.data.map(c => (
                <tr key={c.id}>
                  <td className="meta">{c.created_at}</td>
                  <td>{c.post_title}</td>
                  <td>{c.author}{c.email && <div className="meta">{c.email}</div>}</td>
                  <td style={{ maxWidth: 360, whiteSpace: 'pre-line' }}>{c.body}</td>
                  <td><span className={`status-badge ${c.status === 'approved' ? 'active' : 'pending'}`}>{c.status === 'approved' ? 'Approuvé' : 'En attente'}</span></td>
                  <td className="actions">
                    {c.status !== 'approved' && <button className="btn small" onClick={() => approve.mutate(c.id, { onSuccess: () => push('Commentaire approuvé.', 'success') })}>Approuver</button>}{' '}
                    <button className="btn danger small" onClick={() => { if (confirm('Supprimer ce commentaire ?')) del.mutate(c.id, { onSuccess: () => push('Commentaire supprimé.', 'success') }); }}>Supprimer</button>
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

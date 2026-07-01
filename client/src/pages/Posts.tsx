import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { Posts, type PostInput } from '@/api/hooks';
import { useToast } from '@/lib/toast';
import { MediaField } from '@/components/MediaPicker';
import { PageBuilder } from '@/components/PageBuilder';
import { normalizePageBlocks, serializePageBlocks, renderPageBlocksToHtml, makePageBlock, type PageBlock } from '@/lib/page-blocks';

export function PostsListPage() {
  const list = Posts.useList();
  const del = Posts.useDelete();
  const { push } = useToast();
  return (
    <>
      <div className="topbar-row">
        <div><h1>Blog / Actualités</h1><p>Articles publiés sur <code>/blog</code>, rédigés avec le page builder.</p></div>
        <Link className="btn" to="/admin/posts/new">＋ Nouvel article</Link>
      </div>
      <div className="card">
        {list.isLoading && <div className="loading">Chargement…</div>}
        {list.isError && <div className="empty">Erreur de chargement.</div>}
        {list.data && list.data.length === 0 && <div className="empty">Aucun article. <Link to="/admin/posts/new">Écrire le premier</Link></div>}
        {list.data && list.data.length > 0 && (
          <table className="wp-list">
            <thead><tr><th className="column-primary">Titre</th><th>Catégorie</th><th>Date</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>
              {list.data.map(p => (
                <tr key={p.id}>
                  <td className="column-primary">{p.title}<div className="meta"><code>/blog/{p.slug}</code></div></td>
                  <td data-label="Catégorie">{p.category || <span className="meta">—</span>}</td>
                  <td data-label="Date" className="meta">{p.published_at}</td>
                  <td data-label="Statut"><span className={`status-badge ${p.published ? 'published' : 'draft'}`}>{p.published ? 'Publié' : 'Brouillon'}</span></td>
                  <td className="actions" data-label="Actions">
                    <Link className="btn small" to="/admin/posts/$id/edit" params={{ id: String(p.id) }}>Modifier</Link>{' '}
                    <a className="btn secondary small" href={`/blog/${p.slug}`} target="_blank" rel="noreferrer">Voir</a>{' '}
                    <button className="btn danger small" onClick={() => { if (confirm('Supprimer cet article ?')) del.mutate(p.id, { onSuccess: () => push('Article supprimé.', 'success') }); }}>Supprimer</button>
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

const EMPTY: PostInput = { title: '', slug: '', excerpt: '', content: '', builder_json: '', cover_url: '', category: '', author: '', published: 1, featured: 0, published_at: '' };

export function PostEditPage() {
  const params = useParams({ strict: false }) as { id?: string };
  const navigate = useNavigate();
  const { push } = useToast();
  const id = params.id ? Number(params.id) : null;
  const existing = Posts.useOne(id);
  const create = Posts.useCreate();
  const update = Posts.useUpdate();
  const [form, setForm] = useState<PostInput>(EMPTY);
  const [blocks, setBlocks] = useState<PageBlock[]>([]);

  useEffect(() => {
    if (existing.data) {
      const d = existing.data;
      setForm({ title: d.title, slug: d.slug, excerpt: d.excerpt, cover_url: d.cover_url, category: d.category, author: d.author, published: d.published, featured: d.featured, published_at: d.published_at });
      const parsed = normalizePageBlocks(d.builder_json);
      if (parsed.length) setBlocks(parsed);
      else if (d.content?.trim()) { const b = makePageBlock('html'); b.html = d.content; setBlocks([b]); }
      else setBlocks([]);
    }
  }, [existing.data]);

  const set = (patch: Partial<PostInput>) => setForm(f => ({ ...f, ...patch }));
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: PostInput = { ...form, builder_json: serializePageBlocks(blocks), content: renderPageBlocksToHtml(blocks) };
    if (id) update.mutate({ id, data: payload }, { onSuccess: () => { push('Article mis à jour.', 'success'); navigate({ to: '/admin/posts' }); } });
    else create.mutate(payload, { onSuccess: () => { push('Article créé.', 'success'); navigate({ to: '/admin/posts' }); } });
  };

  if (id && existing.isLoading) return <div className="loading">Chargement…</div>;

  return (
    <form onSubmit={onSubmit}>
      <div className="topbar-row">
        <div><h1>{id ? 'Modifier l\'article' : 'Nouvel article'}</h1></div>
        <div className="actions">
          <Link className="btn secondary" to="/admin/posts">← Retour</Link>
          <button className="btn" type="submit" disabled={create.isPending || update.isPending}>{(create.isPending || update.isPending) ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </div>

      <div className="card">
        <div className="row">
          <div className="field"><label>Titre *</label><input value={form.title} onChange={e => set({ title: e.target.value })} required /></div>
          <div className="field"><label>Slug</label><input value={form.slug} onChange={e => set({ slug: e.target.value })} placeholder="auto si vide → /blog/slug" /></div>
        </div>
        <div className="row">
          <div className="field"><label>Catégorie</label><input value={form.category} onChange={e => set({ category: e.target.value })} placeholder="ex: Actualités" /></div>
          <div className="field"><label>Auteur</label><input value={form.author} onChange={e => set({ author: e.target.value })} placeholder="ex: Van Jean" /></div>
        </div>
        <div className="row">
          <div className="field"><label>Date de publication</label><input type="date" value={form.published_at} onChange={e => set({ published_at: e.target.value })} /></div>
          <div className="field"><label>Statut</label>
            <select value={form.published} onChange={e => set({ published: Number(e.target.value) })}><option value={1}>Publié</option><option value={0}>Brouillon</option></select>
          </div>
        </div>
        <label className="block-checkbox"><input type="checkbox" checked={!!form.featured} onChange={e => set({ featured: e.target.checked ? 1 : 0 })} /> ★ Mettre à la une</label>
        <MediaField label="Image de couverture (optionnel)" value={form.cover_url || ''} onChange={cover_url => set({ cover_url })} />
        <div className="field"><label>Extrait (résumé pour la liste)</label><textarea value={form.excerpt} onChange={e => set({ excerpt: e.target.value })} /></div>
      </div>

      <div className="card">
        <h2>Contenu de l'article</h2>
        <p className="hint">Compose avec des blocs (mêmes blocs que les pages). Le HTML est généré à l'enregistrement.</p>
        <PageBuilder blocks={blocks} onChange={setBlocks} />
      </div>
    </form>
  );
}

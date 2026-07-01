import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { Pages, type PageInput } from '@/api/hooks';
import { useToast } from '@/lib/toast';
import { PageBuilder } from '@/components/PageBuilder';
import { normalizePageBlocks, serializePageBlocks, renderPageBlocksToHtml, makePageBlock, type PageBlock } from '@/lib/page-blocks';

export function PagesListPage() {
  const list = Pages.useList();
  const del = Pages.useDelete();
  const { push } = useToast();

  return (
    <>
      <div className="topbar-row">
        <div><h1>Pages</h1><p>Templates, landing pages et pages publiques.</p></div>
        <Link className="btn" to="/admin/pages/new">＋ Créer une page</Link>
      </div>
      <div className="card">
        {list.isLoading && <div className="loading">Chargement…</div>}
        {list.isError && <div className="empty">Erreur de chargement. Réessaie.</div>}
        {list.data && list.data.length === 0 && <div className="empty">Aucune page pour le moment. <Link to="/admin/pages/new">Créer la première</Link></div>}
        {list.data && list.data.length > 0 && (
          <table className="wp-list">
            <thead><tr><th className="column-primary">Titre</th><th>Slug</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>
              {list.data.map(p => (
                <tr key={p.id}>
                  <td className="column-primary">{p.title}<div className="meta">{p.excerpt || 'Sans résumé'}</div></td>
                  <td data-label="Slug"><code>{p.slug}</code></td>
                  <td data-label="Statut"><span className={`status-badge ${p.published ? 'published' : 'draft'}`}>{p.published ? 'Publié' : 'Brouillon'}</span></td>
                  <td className="actions" data-label="Actions">
                    <Link className="btn small" to="/admin/pages/$id/edit" params={{ id: String(p.id) }}>Modifier</Link>{' '}
                    <a className="btn secondary small" href={`/pages/${p.slug}`} target="_blank" rel="noreferrer">Voir</a>{' '}
                    <button className="btn danger small" onClick={() => { if (confirm('Supprimer cette page ?')) del.mutate(p.id, { onSuccess: () => push('Page supprimée.', 'success') }); }}>Supprimer</button>
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

const EMPTY: PageInput = { title: '', slug: '', excerpt: '', content: '', builder_json: '', published: 1 };

export function PageEditPage() {
  const params = useParams({ strict: false }) as { id?: string };
  const navigate = useNavigate();
  const { push } = useToast();
  const id = params.id ? Number(params.id) : null;
  const existing = Pages.useOne(id);
  const create = Pages.useCreate();
  const update = Pages.useUpdate();
  const [form, setForm] = useState<PageInput>(EMPTY);
  const [blocks, setBlocks] = useState<PageBlock[]>([]);

  useEffect(() => {
    if (existing.data) {
      setForm({
        title: existing.data.title,
        slug: existing.data.slug,
        excerpt: existing.data.excerpt,
        content: existing.data.content,
        builder_json: existing.data.builder_json,
        published: existing.data.published,
      });
      // Charge les blocs depuis builder_json ; à défaut, importe le HTML existant dans un bloc « HTML brut ».
      const parsed = normalizePageBlocks(existing.data.builder_json);
      if (parsed.length) {
        setBlocks(parsed);
      } else if (existing.data.content?.trim()) {
        const b = makePageBlock('html'); b.html = existing.data.content; setBlocks([b]);
      } else {
        setBlocks([]);
      }
    }
  }, [existing.data]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: PageInput = {
      ...form,
      builder_json: serializePageBlocks(blocks),
      content: renderPageBlocksToHtml(blocks),
    };
    if (id) {
      update.mutate({ id, data: payload }, { onSuccess: () => { push('Page mise à jour.', 'success'); navigate({ to: "/admin/pages" }); } });
    } else {
      create.mutate(payload, { onSuccess: () => { push('Page créée.', 'success'); navigate({ to: "/admin/pages" }); } });
    }
  };

  if (id && existing.isLoading) return <div className="loading">Chargement…</div>;

  return (
    <form onSubmit={onSubmit}>
      <div className="topbar-row">
        <div><h1>{id ? 'Modifier la page' : 'Nouvelle page'}</h1><p>Paramètres principaux et contenu.</p></div>
        <div className="actions">
          <Link className="btn secondary" to="/admin/pages">← Retour</Link>
          <button className="btn" type="submit" disabled={create.isPending || update.isPending}>{(create.isPending || update.isPending) ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </div>

      <div className="card">
        <div className="row">
          <div className="field"><label htmlFor="title">Titre *</label><input id="title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
          <div className="field"><label htmlFor="slug">Slug</label><input id="slug" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="laisse vide pour auto-génération" /></div>
        </div>
        <div className="field"><label htmlFor="excerpt">Résumé</label><textarea id="excerpt" value={form.excerpt} onChange={e => setForm({ ...form, excerpt: e.target.value })} /></div>
        <div className="field"><label htmlFor="published">Statut</label>
          <select id="published" value={form.published} onChange={e => setForm({ ...form, published: Number(e.target.value) })}>
            <option value={1}>Publié</option><option value={0}>Brouillon</option>
          </select>
        </div>
      </div>

      <div className="card">
        <h2>Contenu de la page</h2>
        <p className="hint">Compose la page en ajoutant des blocs. Le HTML est généré automatiquement à l'enregistrement.</p>
        <PageBuilder blocks={blocks} onChange={setBlocks} />
      </div>
    </form>
  );
}

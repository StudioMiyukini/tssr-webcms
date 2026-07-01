import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { Products, type ProductInput } from '@/api/hooks';
import { formatPriceEUR } from '@/lib/format';
import { useToast } from '@/lib/toast';

export function ProductsListPage() {
  const list = Products.useList();
  const del = Products.useDelete();
  const { push } = useToast();
  return (
    <>
      <div className="topbar-row">
        <div><h1>Produits</h1><p>Catalogue type WooCommerce.</p></div>
        <Link className="btn" to="/admin/products/new">＋ Ajouter un produit</Link>
      </div>
      <div className="card">
        {list.isLoading && <div className="loading">Chargement…</div>}
        {list.isError && <div className="empty">Erreur de chargement. Réessaie.</div>}
        {list.data && list.data.length === 0 && <div className="empty">Aucun produit.</div>}
        {list.data && list.data.length > 0 && (
          <table className="wp-list">
            <thead><tr><th className="column-primary">Produit</th><th>Catégorie</th><th>Prix</th><th>Stock</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>
              {list.data.map(p => (
                <tr key={p.id}>
                  <td className="column-primary">{p.name}<div className="meta">{p.sku || 'Sans SKU'}</div></td>
                  <td data-label="Catégorie">{p.category || '—'}</td>
                  <td data-label="Prix">{formatPriceEUR(p.sale_price_cents > 0 && p.sale_price_cents < p.price_cents ? p.sale_price_cents : p.price_cents)}</td>
                  <td data-label="Stock">{p.manage_stock ? p.stock : <span className="muted">non suivi</span>}</td>
                  <td data-label="Statut">{p.published ? <span className="status-badge published">Publié</span> : <span className="status-badge draft">Brouillon</span>}{p.featured ? <> <span className="badge">★ vedette</span></> : null}</td>
                  <td className="actions" data-label="Actions">
                    <Link className="btn small" to="/admin/products/$id/edit" params={{ id: String(p.id) }}>Modifier</Link>{' '}
                    <button className="btn danger small" onClick={() => { if (confirm('Supprimer ce produit ?')) del.mutate(p.id, { onSuccess: () => push('Produit supprimé.', 'success') }); }}>Supprimer</button>
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

const EMPTY: ProductInput = { name: '', slug: '', description: '', short_description: '', price_cents: 0, sale_price_cents: 0, compare_at_price_cents: 0, stock: 0, image_url: '', sku: '', category: '', featured: 0, manage_stock: 1, published: 1, variants_json: '[]' };

export function ProductEditPage() {
  const params = useParams({ strict: false }) as { id?: string };
  const navigate = useNavigate();
  const { push } = useToast();
  const id = params.id ? Number(params.id) : null;
  const existing = Products.useOne(id);
  const create = Products.useCreate();
  const update = Products.useUpdate();
  const [form, setForm] = useState<ProductInput>(EMPTY);

  useEffect(() => {
    if (existing.data) {
      const e = existing.data;
      setForm({ name: e.name, slug: e.slug, description: e.description, short_description: e.short_description, price_cents: e.price_cents, sale_price_cents: e.sale_price_cents, compare_at_price_cents: e.compare_at_price_cents, stock: e.stock, image_url: e.image_url, sku: e.sku, category: e.category, featured: e.featured, manage_stock: e.manage_stock, published: e.published, variants_json: e.variants_json });
    }
  }, [existing.data]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (id) update.mutate({ id, data: form }, { onSuccess: () => { push('Produit mis à jour.', 'success'); navigate({ to: "/admin/products" }); } });
    else create.mutate(form, { onSuccess: () => { push('Produit créé.', 'success'); navigate({ to: "/admin/products" }); } });
  };

  if (id && existing.isLoading) return <div className="loading">Chargement…</div>;

  return (
    <form onSubmit={onSubmit}>
      <div className="topbar-row">
        <div><h1>{id ? 'Modifier le produit' : 'Nouveau produit'}</h1><p>SKU, prix, stock, variantes.</p></div>
        <div className="actions"><Link className="btn secondary" to="/admin/products">← Retour</Link><button className="btn" type="submit">Enregistrer</button></div>
      </div>

      <div className="card">
        <div className="row">
          <div className="field"><label>Nom *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="field"><label>Slug</label><input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="laisse vide pour auto" /></div>
        </div>
        <div className="row">
          <div className="field"><label>SKU</label><input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} /></div>
          <div className="field"><label>Catégorie</label><input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
        </div>
        <div className="row">
          <div className="field"><label>Prix normal (centimes)</label><input type="number" value={form.price_cents} onChange={e => setForm({ ...form, price_cents: Number(e.target.value) })} /></div>
          <div className="field"><label>Prix promo (centimes)</label><input type="number" value={form.sale_price_cents} onChange={e => setForm({ ...form, sale_price_cents: Number(e.target.value) })} /></div>
        </div>
        <div className="row">
          <div className="field"><label>Prix barré (centimes)</label><input type="number" value={form.compare_at_price_cents} onChange={e => setForm({ ...form, compare_at_price_cents: Number(e.target.value) })} /></div>
          <div className="field"><label>Stock</label><input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: Number(e.target.value) })} /></div>
        </div>
        <div className="row">
          <div className="field"><label>Image URL</label><input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} /></div>
          <div className="field"><label>Mise en avant / stock géré / publié</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={form.featured} onChange={e => setForm({ ...form, featured: Number(e.target.value) })}><option value={0}>Non vedette</option><option value={1}>★ Vedette</option></select>
              <select value={form.manage_stock} onChange={e => setForm({ ...form, manage_stock: Number(e.target.value) })}><option value={1}>Stock suivi</option><option value={0}>Stock non suivi</option></select>
              <select value={form.published} onChange={e => setForm({ ...form, published: Number(e.target.value) })}><option value={1}>Publié</option><option value={0}>Brouillon</option></select>
            </div>
          </div>
        </div>
        <div className="field"><label>Résumé court</label><textarea value={form.short_description} onChange={e => setForm({ ...form, short_description: e.target.value })} style={{ minHeight: 70 }} /></div>
        <div className="field"><label>Description</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        <div className="field"><label>Variantes (JSON)</label><textarea value={form.variants_json} onChange={e => setForm({ ...form, variants_json: e.target.value })} style={{ minHeight: 100, fontFamily: 'monospace', fontSize: 12 }} placeholder='[{"label":"Rouge","key":"rouge","price_cents":2990,"stock":5}]' /></div>
      </div>
    </form>
  );
}

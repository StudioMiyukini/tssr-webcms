import { Link, useSearch } from '@tanstack/react-router';
import { usePublicProducts, usePublicCategories, useAddToCart } from '@/api/public';
import { formatPriceEUR } from '@/lib/format';
import { useToast } from '@/lib/toast';

export function ShopPage() {
  const search = useSearch({ strict: false }) as { category?: string };
  const category = search.category;
  const products = usePublicProducts(category);
  const categories = usePublicCategories();
  const add = useAddToCart();
  const { push } = useToast();

  return (
    <>
      <div className="topbar-row">
        <div>
          <h1>Boutique</h1>
          <p>Catalogue produits et variantes — moteur e-commerce minimal.</p>
        </div>
      </div>

      {(categories.data ?? []).length > 0 && (
        <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Link className={`btn small ${!category ? '' : 'secondary'}`} to="/shop">Toutes</Link>
          {(categories.data ?? []).map(c => (
            <Link key={c} className={`btn small ${category === c ? '' : 'secondary'}`} to="/shop" search={{ category: c }}>{c}</Link>
          ))}
        </div>
      )}

      {products.isLoading && <div className="loading">Chargement…</div>}
      <div className="grid">
        {(products.data ?? []).map(p => {
          const current = p.sale_price_cents > 0 && p.sale_price_cents < p.price_cents ? p.sale_price_cents : p.price_cents;
          return (
            <article key={p.id} className="card product">
              <Link to="/products/$slug" params={{ slug: p.slug }}>
                <img src={p.image_url || `https://placehold.co/600x400?text=${encodeURIComponent(p.name)}`} alt={p.name} />
                <div className="meta">{p.category || 'Catalogue'}</div>
                <h3>{p.name}</h3>
              </Link>
              <div className="price">{formatPriceEUR(current)}{p.sale_price_cents > 0 && p.sale_price_cents < p.price_cents && <span className="meta" style={{ marginLeft: 8, textDecoration: 'line-through' }}>{formatPriceEUR(p.price_cents)}</span>}</div>
              <p className="meta">{p.sku || 'SKU à définir'} · Stock : {p.manage_stock ? p.stock : '∞'}</p>
              <p>{p.short_description || p.description}</p>
              <div className="actions">
                <Link className="btn secondary small" to="/products/$slug" params={{ slug: p.slug }}>Détails</Link>
                <button className="btn small" disabled={add.isPending} onClick={() => add.mutate({ product_id: p.id }, { onSuccess: () => push('Ajouté au panier.', 'success') })}>Ajouter</button>
              </div>
            </article>
          );
        })}
        {(products.data ?? []).length === 0 && !products.isLoading && (
          <article className="card"><h3>Aucun produit</h3><p>Ajoutez des produits depuis le back-office.</p></article>
        )}
      </div>
    </>
  );
}

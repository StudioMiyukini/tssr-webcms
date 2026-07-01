import { useState } from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { usePublicProduct, useAddToCart } from '@/api/public';
import { formatPriceEUR } from '@/lib/format';
import { useToast } from '@/lib/toast';

interface Variant { key: string; label: string; price_cents: number; stock: number; sku: string; }

export function ProductView() {
  const { slug } = useParams({ strict: false }) as { slug: string };
  const q = usePublicProduct(slug);
  const add = useAddToCart();
  const navigate = useNavigate();
  const { push } = useToast();
  const [variantKey, setVariantKey] = useState('');
  const [quantity, setQuantity] = useState(1);

  if (q.isLoading) return <div className="loading">Chargement…</div>;
  if (!q.data) return <div className="empty">Produit introuvable.</div>;
  const { product, related } = q.data;
  let variants: Variant[] = [];
  try { variants = JSON.parse(product.variants_json || '[]'); } catch {}
  const current = product.sale_price_cents > 0 && product.sale_price_cents < product.price_cents ? product.sale_price_cents : product.price_cents;
  const maxQty = product.manage_stock ? Math.max(1, product.stock) : 99;

  return (
    <>
      <div className="row" style={{ gridTemplateColumns: '1.1fr .9fr' }}>
        <div className="card product">
          <img src={product.image_url || `https://placehold.co/800x600?text=${encodeURIComponent(product.name)}`} alt={product.name} />
        </div>
        <div className="card">
          <span className="pill">{product.category || 'Produit'}</span>
          <h1 style={{ marginTop: 10 }}>{product.name}</h1>
          <div className="price" style={{ fontSize: 22 }}>{formatPriceEUR(current)}{product.sale_price_cents > 0 && product.sale_price_cents < product.price_cents && <span className="meta" style={{ marginLeft: 8, textDecoration: 'line-through' }}>{formatPriceEUR(product.price_cents)}</span>}</div>
          <p className="meta">{product.sku || 'SKU à définir'} · {product.manage_stock ? `Stock : ${product.stock}` : 'Stock non suivi'}</p>
          <p>{product.short_description}</p>
          <div className="rich" style={{ marginTop: 14 }} dangerouslySetInnerHTML={{ __html: product.description }} />

          <form onSubmit={(e) => { e.preventDefault(); add.mutate({ product_id: product.id, quantity, variant_key: variantKey }, { onSuccess: () => { push('Ajouté.', 'success'); navigate({ to: '/cart' }); } }); }} style={{ marginTop: 18 }}>
            {variants.length > 0 && (
              <div className="field">
                <label>Variante</label>
                <select value={variantKey} onChange={e => setVariantKey(e.target.value)}>
                  <option value="">Choisir une variante</option>
                  {variants.map(v => (
                    <option key={v.key} value={v.key}>{v.label}{v.price_cents ? ` · ${formatPriceEUR(v.price_cents)}` : ''}{v.sku ? ` · ${v.sku}` : ''}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="field" style={{ maxWidth: 160 }}>
              <label>Quantité</label>
              <input type="number" min={1} max={maxQty} value={quantity} onChange={e => setQuantity(Math.max(1, Math.min(maxQty, Number(e.target.value))))} />
            </div>
            <div className="actions">
              <button className="btn" type="submit" disabled={add.isPending}>{add.isPending ? 'Ajout…' : 'Ajouter au panier'}</button>
              <Link className="btn secondary" to="/shop">Retour boutique</Link>
            </div>
          </form>
        </div>
      </div>

      {related.length > 0 && (
        <section style={{ marginTop: 28 }}>
          <h2>Produits liés</h2>
          <div className="grid">
            {related.map(r => (
              <Link key={r.id} className="card product" to="/products/$slug" params={{ slug: r.slug }}>
                <img src={r.image_url || `https://placehold.co/600x400?text=${encodeURIComponent(r.name)}`} alt={r.name} />
                <h3>{r.name}</h3>
                <div className="price">{formatPriceEUR(r.sale_price_cents > 0 && r.sale_price_cents < r.price_cents ? r.sale_price_cents : r.price_cents)}</div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

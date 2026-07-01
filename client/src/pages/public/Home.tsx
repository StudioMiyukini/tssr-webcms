import { Link } from '@tanstack/react-router';
import { usePublicPage, usePublicProducts, usePublicFeatures } from '@/api/public';
import { formatPriceEUR } from '@/lib/format';
import { RichContent } from '@/components/RichContent';

export function HomePage() {
  const home = usePublicPage('accueil');
  const features = usePublicFeatures();
  const shopOn = features.data?.shop ?? false;
  const featured = usePublicProducts();
  const products = shopOn ? (featured.data ?? []) : [];

  return (
    <>
      {home.isLoading && <div className="loading">Chargement…</div>}
      {home.isError && (
        <section className="hero">
          <h1>Bienvenue<span style={{ color: 'var(--accent)' }}>.</span></h1>
          <p>La page d'accueil n'est pas encore configurée. Crée une page avec le slug <code>accueil</code> dans le <Link to="/admin">back-office</Link>.</p>
        </section>
      )}
      {home.data && <RichContent html={home.data.content} className="rich" />}

      {products.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <div className="topbar-row">
            <h2>Boutique</h2>
            <Link className="btn secondary" to="/shop">Voir tous les produits</Link>
          </div>
          <div className="grid">
            {products.slice(0, 6).map(p => (
              <Link key={p.id} className="card product" to="/products/$slug" params={{ slug: p.slug }}>
                <img src={p.image_url || `https://placehold.co/600x400?text=${encodeURIComponent(p.name)}`} alt={p.name} />
                <h3>{p.name}</h3>
                <div className="price">{formatPriceEUR(p.sale_price_cents > 0 && p.sale_price_cents < p.price_cents ? p.sale_price_cents : p.price_cents)}</div>
                <p className="meta">{p.short_description || p.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

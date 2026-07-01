import { Link } from '@tanstack/react-router';
import { useDashboardStats, useDashboardActivity } from '@/api/hooks';
import { formatPriceEUR, formatOrderStatus } from '@/lib/format';

export function DashboardPage() {
  const stats = useDashboardStats();
  const activity = useDashboardActivity();

  if (stats.isLoading || activity.isLoading) return <div className="loading">Chargement…</div>;
  if (!stats.data || !activity.data) return <div className="loading">Erreur de chargement</div>;
  const s = stats.data;
  const a = activity.data;

  return (
    <>
      <div className="topbar-row">
        <div>
          <h1>Tableau de bord</h1>
          <p>Vue d'ensemble de votre activité.</p>
        </div>
        <div className="actions">
          <Link className="btn secondary" to="/admin/quote-submissions">{s.newQuotes} demande{s.newQuotes > 1 ? 's' : ''} nouvelle{s.newQuotes > 1 ? 's' : ''}</Link>
          <Link className="page-title-action" to="/admin/pages/new">＋ Nouvelle page</Link>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard icon="€" tone="green" value={formatPriceEUR(s.totalRevenueCents)} label="Revenu encaissé" sub={`${s.orders} commande${s.orders > 1 ? 's' : ''} au total`} />
        <StatCard icon="📄" tone="blue" value={String(s.pages)} label="Pages" sub={`${s.draftPages} brouillon${s.draftPages > 1 ? 's' : ''}`} />
        <StatCard icon="🛍️" tone="green" value={String(s.publishedProducts)} label="Produits publiés" sub={`${s.products} au catalogue`} />
        <StatCard icon="📦" tone="orange" value={String(s.orders)} label="Commandes" sub={`${s.pendingOrders} en attente`} />
        <StatCard icon="📨" tone="purple" value={String(s.newQuotes)} label="Demandes nouvelles" sub={`${s.quoteSubmissions} au total`} />
        <StatCard icon="👥" tone="blue" value={String(s.customers)} label="Clients" sub="comptes enregistrés" />
      </div>

      <div className="dash-cols">
        <div>
          <div className="card">
            <h2>📄 Dernières pages mises à jour</h2>
            <table className="wp-list">
              <thead><tr><th className="column-primary">Titre</th><th>Slug</th><th>Statut</th><th></th></tr></thead>
              <tbody>
                {a.latestPages.length === 0 && <tr><td colSpan={4} className="muted">Aucune page.</td></tr>}
                {a.latestPages.map(p => (
                  <tr key={p.id}>
                    <td className="column-primary">{p.title}</td>
                    <td data-label="Slug"><code>{p.slug}</code></td>
                    <td data-label="Statut"><span className={`status-badge ${p.published ? 'published' : 'draft'}`}>{p.published ? 'Publiée' : 'Brouillon'}</span></td>
                    <td className="actions" data-label="Actions"><Link className="btn small" to="/admin/pages/$id/edit" params={{ id: String(p.id) }}>Modifier</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2>📦 Dernières commandes</h2>
            <table className="wp-list">
              <thead><tr><th className="column-primary">N° commande</th><th>Client</th><th>Total</th><th>Statut</th><th></th></tr></thead>
              <tbody>
                {a.latestOrders.length === 0 && <tr><td colSpan={5} className="muted">Aucune commande.</td></tr>}
                {a.latestOrders.map(o => (
                  <tr key={o.id}>
                    <td className="column-primary">{o.order_number}</td>
                    <td data-label="Client">{o.customer_name}<div className="meta">{o.customer_email}</div></td>
                    <td data-label="Total">{formatPriceEUR(o.total_cents)}</td>
                    <td data-label="Statut"><span className={`status-badge ${o.status}`}>{formatOrderStatus(o.status)}</span></td>
                    <td className="actions" data-label="Actions"><Link className="btn small" to="/admin/orders/$id" params={{ id: String(o.id) }}>Voir</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="card">
            <h2>⚡ Actions rapides</h2>
            <div className="quick-actions">
              <Link className="quick-action-card" to="/admin/pages/new"><span className="qa-icon">📝</span><div><div className="qa-title">Nouvelle page</div><div className="qa-desc">Builder + HTML</div></div></Link>
              <Link className="quick-action-card" to="/admin/products/new"><span className="qa-icon">🛍️</span><div><div className="qa-title">Nouveau produit</div><div className="qa-desc">Catalogue</div></div></Link>
              <Link className="quick-action-card" to="/admin/quote-forms/new"><span className="qa-icon">📋</span><div><div className="qa-title">Formulaire devis</div><div className="qa-desc">Builder de champs</div></div></Link>
              <Link className="quick-action-card" to="/admin/coupons/new"><span className="qa-icon">🏷️</span><div><div className="qa-title">Coupon</div><div className="qa-desc">Promo / réduction</div></div></Link>
            </div>
          </div>

          <div className="card">
            <h2>📨 Demandes récentes</h2>
            {a.latestQuotes.length === 0 && <p className="muted">Aucune demande pour le moment.</p>}
            {a.latestQuotes.length > 0 && (
              <table className="wp-list">
                <thead><tr><th>Nom</th><th>Email</th><th>Statut</th></tr></thead>
                <tbody>
                  {a.latestQuotes.map(q => (
                    <tr key={q.id}>
                      <td>{q.customer_name}</td>
                      <td className="meta">{q.customer_email}</td>
                      <td><span className={`status-badge ${q.status}`}>{q.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <h2>ℹ️ Stack</h2>
            <table className="form-table">
              <tbody>
                <tr><th>Runtime</th><td>Node + Express + tsx</td></tr>
                <tr><th>Front</th><td>Vite + React 18 + TS</td></tr>
                <tr><th>Router</th><td>TanStack Router</td></tr>
                <tr><th>Data</th><td>TanStack Query</td></tr>
                <tr><th>DB</th><td>SQLite + Drizzle ORM</td></tr>
                <tr><th>Raccourci</th><td>Tape <kbd>?</kbd> pour la liste</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({ icon, tone, value, label, sub }: { icon: string; tone: string; value: string; label: string; sub: string }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}>{icon}</div>
      <div className="stat-info">
        <div className="stat-number">{value}</div>
        <div className="stat-label">{label}</div>
        <div className="stat-sub">{sub}</div>
      </div>
    </div>
  );
}

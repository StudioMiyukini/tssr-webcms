import { Link, useParams } from '@tanstack/react-router';
import { useOrders, useOrder, useUpdateOrderStatus } from '@/api/hooks';
import { formatPriceEUR, formatOrderStatus, formatDate } from '@/lib/format';
import { useToast } from '@/lib/toast';

export function OrdersListPage() {
  const list = useOrders();
  return (
    <>
      <div className="topbar-row">
        <div><h1>Commandes</h1><p>Vue WooCommerce-like des commandes.</p></div>
      </div>
      <div className="card">
        {list.isLoading && <div className="loading">Chargement…</div>}
        {list.isError && <div className="empty">Erreur de chargement. Réessaie.</div>}
        {list.data && list.data.length === 0 && <div className="empty">Aucune commande pour le moment.</div>}
        {list.data && list.data.length > 0 && (
          <table className="wp-list">
            <thead><tr><th className="column-primary">Commande</th><th>Client</th><th>Articles</th><th>Total</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              {list.data.map(o => (
                <tr key={o.id}>
                  <td className="column-primary">{o.order_number}<div className="meta">{formatDate(o.created_at)}</div></td>
                  <td data-label="Client">{o.customer_name}<div className="meta">{o.customer_email}</div></td>
                  <td data-label="Articles">{o.items_count}</td>
                  <td data-label="Total">{formatPriceEUR(o.total_cents)}<div className="meta">TVA {formatPriceEUR(o.tax_cents)} · Livr. {formatPriceEUR(o.shipping_price_cents)}</div></td>
                  <td data-label="Statut"><span className={`status-badge ${o.status}`}>{formatOrderStatus(o.status)}</span></td>
                  <td className="actions" data-label="Actions"><Link className="btn small" to="/admin/orders/$id" params={{ id: String(o.id) }}>Ouvrir</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export function OrderDetailPage() {
  const params = useParams({ strict: false }) as { id?: string };
  const id = params.id ? Number(params.id) : null;
  const detail = useOrder(id);
  const updateStatus = useUpdateOrderStatus();
  const { push } = useToast();

  if (detail.isLoading) return <div className="loading">Chargement…</div>;
  if (!detail.data) return <div className="empty">Commande introuvable.</div>;
  const { order, items } = detail.data;

  return (
    <>
      <div className="topbar-row">
        <div><h1>Commande {order.order_number}</h1><p>{order.customer_name} · {order.customer_email}</p></div>
        <Link className="btn secondary" to="/admin/orders">← Retour</Link>
      </div>

      <div className="row">
        <div className="card">
          <h2>Articles</h2>
          <table className="wp-list">
            <thead><tr><th>Produit</th><th>Qté</th><th>PU</th><th>Total</th></tr></thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id}>
                  <td>{it.product_name}{it.variant_label && <div className="meta">{it.variant_label}</div>}<div className="meta">{it.sku}</div></td>
                  <td>{it.quantity}</td>
                  <td>{formatPriceEUR(it.unit_price_cents)}</td>
                  <td>{formatPriceEUR(it.line_total_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop: 14, fontSize: 22, fontWeight: 700 }}>{formatPriceEUR(order.total_cents)}</p>
          <p className="meta">Sous-total : {formatPriceEUR(order.subtotal_cents)} · Remise : -{formatPriceEUR(order.discount_cents)} · TVA : {formatPriceEUR(order.tax_cents)} · Livraison : {formatPriceEUR(order.shipping_price_cents)}</p>
        </div>
        <div className="card">
          <h2>Client</h2>
          <p><strong>{order.customer_name}</strong></p>
          <p className="meta">{order.customer_email}<br/>{order.customer_phone}<br/>{order.customer_company}</p>
          <p className="meta" style={{ whiteSpace: 'pre-line', marginTop: 8 }}>{order.shipping_address || 'Adresse non renseignée'}</p>
          <p className="meta" style={{ whiteSpace: 'pre-line', marginTop: 8 }}>{order.notes || 'Aucune note'}</p>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '14px 0' }} />
          <p>Coupon : <strong>{order.coupon_code || 'Aucun'}</strong></p>
          <p>Livraison : {order.shipping_method_name || 'Aucune'}</p>
          <div className="field" style={{ marginTop: 14 }}>
            <label>Statut</label>
            <select value={order.status} onChange={e => updateStatus.mutate({ id: order.id, status: e.target.value }, { onSuccess: () => push('Statut mis à jour.', 'success') })}>
              <option value="pending">En attente</option>
              <option value="processing">En préparation</option>
              <option value="completed">Terminée</option>
              <option value="cancelled">Annulée</option>
              <option value="refunded">Remboursée</option>
            </select>
          </div>
        </div>
      </div>
    </>
  );
}

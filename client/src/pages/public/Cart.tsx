import { Link } from '@tanstack/react-router';
import { useCart, useUpdateCart, useRemoveCartLine, useApplyCoupon, useRemoveCoupon, useChooseShipping } from '@/api/public';
import { formatPriceEUR } from '@/lib/format';
import { useState } from 'react';
import { useToast } from '@/lib/toast';

export function CartPage() {
  const cart = useCart();
  const update = useUpdateCart();
  const remove = useRemoveCartLine();
  const applyCoupon = useApplyCoupon();
  const removeCoupon = useRemoveCoupon();
  const chooseShipping = useChooseShipping();
  const { push } = useToast();
  const [couponInput, setCouponInput] = useState('');

  if (cart.isLoading) return <div className="loading">Chargement…</div>;
  if (!cart.data) return <div className="empty">Erreur.</div>;
  const d = cart.data;

  if (d.items.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <h1>Votre panier est vide</h1>
        <p>Ajoutez un produit depuis la boutique pour commencer.</p>
        <Link className="btn" to="/shop">Voir la boutique</Link>
      </div>
    );
  }

  return (
    <>
      <div className="topbar-row">
        <h1>Panier</h1>
        <div className="actions">
          <Link className="btn secondary" to="/shop">Continuer mes achats</Link>
          <Link className="btn" to="/checkout">Passer au checkout</Link>
        </div>
      </div>

      <div className="card">
        <table className="wp-list">
          <thead><tr><th>Produit</th><th>Prix</th><th>Quantité</th><th>Total</th><th></th></tr></thead>
          <tbody>
            {d.items.map(item => (
              <tr key={item.lineKey}>
                <td className="column-primary"><strong>{item.product.name}</strong><div className="meta">{item.effectiveSku}{item.variantLabel && ` · ${item.variantLabel}`}</div></td>
                <td data-label="Prix">{formatPriceEUR(item.unitPriceCents)}</td>
                <td data-label="Quantité"><input type="number" min={0} max={item.effectiveStock} defaultValue={item.quantity} style={{ width: 80 }} onBlur={(e) => update.mutate([{ lineKey: item.lineKey, quantity: Number(e.target.value) }])} /></td>
                <td data-label="Total">{formatPriceEUR(item.lineTotalCents)}</td>
                <td className="actions" data-label="Actions"><button className="btn danger small" onClick={() => remove.mutate(item.lineKey)}>Retirer</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="row">
        <div className="card">
          <h2>Coupon</h2>
          <div className="actions">
            <input placeholder="Ex. BIENVENUE10" value={couponInput} onChange={e => setCouponInput(e.target.value.toUpperCase())} style={{ flex: 1, padding: 8 }} />
            <button className="btn secondary" onClick={() => { if (!couponInput) return; applyCoupon.mutate(couponInput, { onSuccess: () => push('Coupon appliqué.', 'success'), onError: (err: any) => push(err?.message || 'Code invalide', 'error') }); }}>Appliquer</button>
          </div>
          {d.coupon && (
            <p className="meta" style={{ marginTop: 8 }}>Appliqué : <strong>{d.coupon.code}</strong> <button className="btn danger small" onClick={() => removeCoupon.mutate()}>Retirer</button></p>
          )}
          <p className="meta" style={{ marginTop: 8 }}>Exemples seedés : BIENVENUE10, LIVRAISON50</p>
        </div>

        <div className="card">
          <h2>Livraison</h2>
          {(d.availableShippingMethods ?? []).map(m => (
            <label key={m.id} style={{ display: 'block', padding: 6 }}>
              <input type="radio" name="shipping" checked={d.shippingMethod?.id === m.id} onChange={() => chooseShipping.mutate(m.id)} />
              {' '}<strong>{m.name}</strong> · {m.description} ({m.free_from_cents > 0 ? `gratuit dès ${formatPriceEUR(m.free_from_cents)}` : 'sans seuil'}) — {formatPriceEUR(m.price_cents)}
            </label>
          ))}
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: 6, maxWidth: 480, marginLeft: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Sous-total</span><strong>{formatPriceEUR(d.subtotalCents)}</strong></div>
        {d.coupon && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Coupon {d.coupon.code}</span><strong>-{formatPriceEUR(d.discountCents)}</strong></div>}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Livraison {d.shippingMethod && `· ${d.shippingMethod.name}`}</span><strong>{formatPriceEUR(d.shippingCents)}</strong></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>TVA ({(d.taxRateBps / 100).toFixed(0)}%)</span><strong>{formatPriceEUR(d.taxCents)}</strong></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--border)', fontSize: 16 }}><span>Total</span><strong>{formatPriceEUR(d.totalCents)}</strong></div>
        <Link className="btn" to="/checkout" style={{ marginTop: 8, justifyContent: 'center' }}>Passer au checkout</Link>
      </div>
    </>
  );
}

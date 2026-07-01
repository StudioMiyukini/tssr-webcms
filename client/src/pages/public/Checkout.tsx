import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useCart, useCheckoutManual, useCheckoutStripe, useCustomerMe } from '@/api/public';
import { formatPriceEUR } from '@/lib/format';
import { useToast } from '@/lib/toast';

interface FormState {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_company: string;
  shipping_address: string;
  notes: string;
}

export function CheckoutPage() {
  const cart = useCart();
  const manual = useCheckoutManual();
  const stripe = useCheckoutStripe();
  const me = useCustomerMe();
  const navigate = useNavigate();
  const { push } = useToast();

  const [form, setForm] = useState<FormState>({
    customer_name: me.data?.name || '',
    customer_email: me.data?.email || '',
    customer_phone: me.data?.phone || '',
    customer_company: me.data?.company || '',
    shipping_address: me.data?.address || '',
    notes: '',
  });
  const [error, setError] = useState<string | null>(null);

  if (cart.isLoading) return <div className="loading">Chargement…</div>;
  if (!cart.data || !cart.data.items.length) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <h1>Panier vide</h1>
        <Link className="btn" to="/shop">Voir la boutique</Link>
      </div>
    );
  }
  const d = cart.data;

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    manual.mutate(form, {
      onSuccess: (r) => navigate({ to: '/checkout/success', search: { order: r.order_number } }),
      onError: (err: any) => setError(err?.message || 'Erreur'),
    });
  };

  const submitStripe = () => {
    if (!form.customer_name || !form.customer_email) { setError('Nom et email requis pour Stripe.'); return; }
    setError(null);
    stripe.mutate(form, {
      onSuccess: (r) => { window.location.href = r.url; },
      onError: (err: any) => setError(err?.message || 'Stripe indisponible'),
    });
  };

  return (
    <div className="row" style={{ gridTemplateColumns: '1.1fr .9fr' }}>
      <form className="card" onSubmit={submitManual}>
        <h2>Coordonnées client</h2>
        <div className="row">
          <div className="field"><label>Nom complet *</label><input required value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} /></div>
          <div className="field"><label>Société</label><input value={form.customer_company} onChange={e => setForm({ ...form, customer_company: e.target.value })} /></div>
        </div>
        <div className="row">
          <div className="field"><label>Email *</label><input type="email" required value={form.customer_email} onChange={e => setForm({ ...form, customer_email: e.target.value })} /></div>
          <div className="field"><label>Téléphone</label><input value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} /></div>
        </div>
        <div className="field"><label>Adresse de livraison</label><textarea value={form.shipping_address} onChange={e => setForm({ ...form, shipping_address: e.target.value })} /></div>
        <div className="field"><label>Notes</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>

        {error && <p style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</p>}

        <div className="actions">
          <button className="btn" type="submit" disabled={manual.isPending}>{manual.isPending ? 'Création…' : 'Créer la commande (manuelle)'}</button>
          <button className="btn secondary" type="button" onClick={submitStripe} disabled={stripe.isPending}>{stripe.isPending ? 'Redirection…' : 'Payer avec Stripe'}</button>
        </div>
      </form>

      <aside className="card">
        <h2>Récapitulatif</h2>
        <ul style={{ paddingLeft: 18, color: 'var(--text-soft)' }}>
          {d.items.map(i => (
            <li key={i.lineKey}><strong>{i.product.name}</strong> × {i.quantity}<br /><span className="meta">{formatPriceEUR(i.lineTotalCents)}</span></li>
          ))}
        </ul>
        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '12px 0' }} />
        <div style={{ display: 'grid', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Sous-total</span><strong>{formatPriceEUR(d.subtotalCents)}</strong></div>
          {d.coupon && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Coupon {d.coupon.code}</span><strong>-{formatPriceEUR(d.discountCents)}</strong></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Livraison</span><strong>{formatPriceEUR(d.shippingCents)}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>TVA</span><strong>{formatPriceEUR(d.taxCents)}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, marginTop: 4, paddingTop: 6, borderTop: '1px solid var(--border)' }}><span>Total</span><strong>{formatPriceEUR(d.totalCents)}</strong></div>
        </div>
      </aside>
    </div>
  );
}

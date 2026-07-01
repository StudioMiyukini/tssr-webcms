import { useEffect, useState } from 'react';
import { Link, useSearch } from '@tanstack/react-router';
import { useFinalizeStripe } from '@/api/public';

export function CheckoutSuccessPage() {
  const search = useSearch({ strict: false }) as { order?: string; session_id?: string; stripe?: string };
  const finalize = useFinalizeStripe();
  const [orderNumber, setOrderNumber] = useState<string | null>(search.order || null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (search.session_id && !orderNumber) {
      finalize.mutate(search.session_id, {
        onSuccess: (r) => setOrderNumber(r.order_number),
        onError: (err: any) => setError(err?.message || 'Erreur lors de la finalisation Stripe.'),
      });
    }
  }, [search.session_id, orderNumber]);

  if (finalize.isPending) return <div className="loading">Finalisation du paiement Stripe…</div>;
  if (error) return (
    <div className="card" style={{ maxWidth: 560, margin: '40px auto' }}>
      <h1>Erreur Stripe</h1>
      <p style={{ color: 'var(--danger)' }}>{error}</p>
      <div className="actions"><Link className="btn" to="/cart">Retour panier</Link></div>
    </div>
  );

  return (
    <div className="card" style={{ maxWidth: 640, margin: '40px auto', textAlign: 'center', padding: 40 }}>
      <span className="pill" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>✓ Commande enregistrée</span>
      <h1 style={{ marginTop: 16 }}>Merci pour votre commande</h1>
      {orderNumber && <p>Votre commande <strong>{orderNumber}</strong> a bien été créée.</p>}
      <div className="actions" style={{ justifyContent: 'center', marginTop: 20 }}>
        <Link className="btn" to="/shop">Retour boutique</Link>
        <Link className="btn secondary" to="/account">Mon compte</Link>
      </div>
    </div>
  );
}

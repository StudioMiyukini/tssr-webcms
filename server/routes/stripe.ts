import { Router } from 'express';
import { z } from 'zod';
import Stripe from 'stripe';
import { STRIPE_SECRET_KEY, PUBLIC_BASE_URL } from '../env';
import { getCart, setCart, getCartDetails } from '../lib/cart';
import { getOrCreateCustomerByEmail } from '../lib/customers';
import { createOrderFromCart, findOrderByStripeSession } from '../lib/orders';
import { sendTransactionalEmail, buildOrderEmailHtml, readEmailSettings } from '../lib/email';

const router = Router();
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

const startSchema = z.object({
  customer_name: z.string().min(1),
  customer_email: z.string().email(),
  customer_phone: z.string().optional().default(''),
  customer_company: z.string().optional().default(''),
  shipping_address: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

router.post('/api/checkout/stripe', async (req, res) => {
  if (!stripe) { res.status(503).json({ error: 'Stripe non configuré' }); return; }
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const cart = getCartDetails(req);
  if (!cart.items.length) { res.status(400).json({ error: 'Panier vide' }); return; }
  req.session.pendingStripeCheckout = {
    cart: getCart(req),
    ...parsed.data,
    couponCode: String(req.session.couponCode || ''),
    shippingMethodId: Number(req.session.shippingMethodId || 0),
  };
  const successUrl = `${PUBLIC_BASE_URL.replace(/\/+$/, '')}/checkout/success?session_id={CHECKOUT_SESSION_ID}&stripe=1`;
  const cancelUrl = `${PUBLIC_BASE_URL.replace(/\/+$/, '')}/cart?stripe_cancel=1`;
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: cart.items.map((item) => ({
      quantity: item.quantity,
      price_data: {
        currency: 'eur',
        unit_amount: item.unitPriceCents,
        product_data: { name: `${item.product.name}${item.variantLabel ? ` — ${item.variantLabel}` : ''}` },
      },
    })),
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
  req.session.pendingStripeSessionId = session.id;
  res.json({ url: session.url, session_id: session.id });
});

router.post('/api/checkout/stripe/finalize', async (req, res) => {
  if (!stripe) { res.status(503).json({ error: 'Stripe non configuré' }); return; }
  const sessionId = String(req.body.session_id || req.session.pendingStripeSessionId || '');
  if (!sessionId) { res.status(400).json({ error: 'session_id manquant' }); return; }
  const pending = req.session.pendingStripeCheckout;
  if (!pending) { res.status(400).json({ error: 'Pas de checkout Stripe en attente' }); return; }
  const stripeSession = await stripe.checkout.sessions.retrieve(sessionId);
  if (!stripeSession || stripeSession.payment_status !== 'paid') {
    res.status(402).json({ error: 'Paiement non confirmé' });
    return;
  }

  const clearPending = () => {
    setCart(req, []);
    req.session.couponCode = '';
    req.session.pendingStripeCheckout = null;
    req.session.pendingStripeSessionId = '';
  };

  // Idempotence : si une commande existe déjà pour cette session Stripe, on la renvoie sans recréer.
  const existing = findOrderByStripeSession(sessionId);
  if (existing) {
    clearPending();
    res.json({ ok: true, order_number: existing.order_number, total_cents: existing.total_cents });
    return;
  }

  // Reconstituer le panier depuis la session pending
  req.session.couponCode = pending.couponCode || '';
  req.session.shippingMethodId = pending.shippingMethodId || 0;
  setCart(req, pending.cart || []);
  const cart = getCartDetails(req);
  const customer = getOrCreateCustomerByEmail({ name: pending.customer_name, email: pending.customer_email, phone: pending.customer_phone, company: pending.customer_company, address: pending.shipping_address });

  const { order, items } = createOrderFromCart(cart, {
    customer_id: customer?.id ?? null,
    customer_name: pending.customer_name,
    customer_email: pending.customer_email,
    customer_phone: pending.customer_phone,
    customer_company: pending.customer_company,
    shipping_address: pending.shipping_address,
    notes: pending.notes,
  }, { status: 'processing', payment_provider: 'stripe', payment_status: 'paid', stripe_session_id: sessionId });

  const emailCfg = readEmailSettings();
  await sendTransactionalEmail({ to: order.customer_email, subject: `Confirmation commande ${order.order_number}`, html: buildOrderEmailHtml(order, items), eventType: 'stripe_customer_confirmation' });
  if (emailCfg.notifyOnOrder && emailCfg.notifyTo) await sendTransactionalEmail({ to: emailCfg.notifyTo, subject: `Nouvelle commande Stripe ${order.order_number}`, html: buildOrderEmailHtml(order, items), eventType: 'stripe_admin_notification' });

  if (customer) req.session.customer = { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, company: customer.company, address: customer.address };
  clearPending();
  res.json({ ok: true, order_number: order.order_number, total_cents: cart.totalCents });
});

export default router;

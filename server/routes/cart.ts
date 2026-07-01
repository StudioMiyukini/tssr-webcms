import { Router } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client';
import { products, coupons, shipping_methods } from '../db/schema';
import { getCart, setCart, getCartDetails, getShippingMethods } from '../lib/cart';
import { resolveVariant } from '../lib/products';
import { normalizeQuantity } from '../lib/utils';
import { getOrCreateCustomerByEmail } from '../lib/customers';
import { createOrderFromCart } from '../lib/orders';
import { sendTransactionalEmail, buildOrderEmailHtml, readEmailSettings } from '../lib/email';

const router = Router();

// ===== GET cart =====
router.get('/api/cart', (req, res) => {
  const cart = getCartDetails(req);
  const shippingMethods = getShippingMethods();
  res.json({ ...cart, availableShippingMethods: shippingMethods });
});

// ===== Add =====
const addSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive().default(1),
  variant_key: z.string().optional().default(''),
});

router.post('/api/cart/add', (req, res) => {
  const parsed = addSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const { product_id, quantity, variant_key } = parsed.data;
  const product = db.select().from(products).where(and(eq(products.id, product_id), eq(products.published, 1))).get();
  if (!product) { res.status(404).json({ error: 'Produit introuvable' }); return; }
  const variant = resolveVariant(product, variant_key);
  const storedVariantKey = variant_key || variant.variantKey || '';
  const effective = resolveVariant(product, storedVariantKey);
  const stockBase = effective.variantKey ? effective.variantStock : Number(product.stock || 0);
  const cart = getCart(req);
  const existing = cart.find((i) => Number(i.productId) === product.id && String(i.variantKey || '') === storedVariantKey);
  const desired = existing ? existing.quantity + quantity : quantity;
  const capped = product.manage_stock ? Math.min(desired, Math.max(0, stockBase)) : desired;
  if (existing) existing.quantity = capped;
  else if (capped > 0) cart.push({ productId: product.id, quantity: capped, variantKey: storedVariantKey });
  setCart(req, cart);
  res.json(getCartDetails(req));
});

// ===== Update quantities by lineKey =====
const updateSchema = z.object({
  items: z.array(z.object({ lineKey: z.string(), quantity: z.coerce.number().int().min(0) })),
});

router.post('/api/cart/update', (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const detailed = getCartDetails(req);
  const byKey = new Map(parsed.data.items.map(i => [i.lineKey, i.quantity]));
  const next = detailed.items.map(item => ({
    productId: item.product.id,
    variantKey: item.variantKey,
    quantity: normalizeQuantity(byKey.get(item.lineKey) ?? item.quantity, 1),
  }));
  setCart(req, next);
  res.json(getCartDetails(req));
});

// ===== Remove by lineKey =====
router.post('/api/cart/remove', (req, res) => {
  const lineKey = String(req.body.lineKey || '').trim();
  if (!lineKey) { res.status(400).json({ error: 'lineKey requis' }); return; }
  const [pidStr, vKey] = lineKey.split(':');
  const pid = Number(pidStr);
  setCart(req, getCart(req).filter(i => !(i.productId === pid && String(i.variantKey || '') === String(vKey || ''))));
  res.json(getCartDetails(req));
});

// ===== Coupon =====
router.post('/api/cart/coupon', (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  if (!code) { res.status(400).json({ error: 'Code requis' }); return; }
  const coupon = db.select().from(coupons).where(and(eq(coupons.code, code), eq(coupons.active, 1))).get();
  if (!coupon) { res.status(404).json({ error: 'Coupon introuvable ou inactif' }); return; }
  req.session.couponCode = coupon.code;
  res.json(getCartDetails(req));
});

router.delete('/api/cart/coupon', (req, res) => {
  req.session.couponCode = '';
  res.json(getCartDetails(req));
});

// ===== Shipping =====
router.post('/api/cart/shipping', (req, res) => {
  const id = Number(req.body.shipping_method_id || 0);
  const method = db.select().from(shipping_methods).where(and(eq(shipping_methods.id, id), eq(shipping_methods.active, 1))).get();
  if (!method) { res.status(404).json({ error: 'Mode introuvable' }); return; }
  req.session.shippingMethodId = method.id;
  res.json(getCartDetails(req));
});

// ===== Checkout manuel =====
const checkoutSchema = z.object({
  customer_name: z.string().min(1),
  customer_email: z.string().email(),
  customer_phone: z.string().optional().default(''),
  customer_company: z.string().optional().default(''),
  shipping_address: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

router.post('/api/checkout', async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const cart = getCartDetails(req);
  if (!cart.items.length) { res.status(400).json({ error: 'Panier vide' }); return; }
  const stockIssue = cart.items.find(i => i.product.manage_stock && i.quantity > Number(i.product.stock || 0));
  if (stockIssue) { res.status(400).json({ error: `Stock insuffisant pour ${stockIssue.product.name}` }); return; }
  const data = parsed.data;
  const customer = getOrCreateCustomerByEmail({ name: data.customer_name, email: data.customer_email, phone: data.customer_phone, company: data.customer_company, address: data.shipping_address });
  if (customer) req.session.customer = { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, company: customer.company, address: customer.address };

  const { order, items } = createOrderFromCart(cart, {
    customer_id: customer?.id ?? null,
    customer_name: data.customer_name,
    customer_email: data.customer_email,
    customer_phone: data.customer_phone,
    customer_company: data.customer_company,
    shipping_address: data.shipping_address,
    notes: data.notes,
  }, { status: 'pending', payment_provider: 'manual', payment_status: 'manual' });
  const orderNumber = order.order_number;

  const emailCfg = readEmailSettings();
  await sendTransactionalEmail({ to: data.customer_email, subject: `Confirmation commande ${orderNumber}`, html: buildOrderEmailHtml(order, items), eventType: 'order_customer_confirmation' });
  if (emailCfg.notifyOnOrder && emailCfg.notifyTo) await sendTransactionalEmail({ to: emailCfg.notifyTo, subject: `Nouvelle commande ${orderNumber}`, html: buildOrderEmailHtml(order, items), eventType: 'order_admin_notification' });

  setCart(req, []);
  req.session.couponCode = '';
  res.status(201).json({ ok: true, order_number: orderNumber, total_cents: cart.totalCents });
});

export default router;

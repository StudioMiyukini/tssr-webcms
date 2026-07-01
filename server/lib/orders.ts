import { asc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { products, orders, order_items } from '../db/schema';
import type { Order, OrderItem } from '../db/schema';
import type { CartDetails } from './cart';
import { generateOrderNumber, generateInvoiceNumber } from './utils';

export interface OrderCustomerInfo {
  customer_id: number | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_company: string;
  shipping_address: string;
  notes: string;
}

export interface OrderPaymentMeta {
  status: string;
  payment_provider: string;
  payment_status: string;
  stripe_session_id?: string;
}

/**
 * Crée une commande + ses lignes à partir d'un panier détaillé, dans une transaction,
 * et décrémente le stock. Centralise la logique partagée entre checkout manuel et Stripe.
 */
export function createOrderFromCart(cart: CartDetails, info: OrderCustomerInfo, meta: OrderPaymentMeta): { order: Order; items: OrderItem[] } {
  const orderNumber = generateOrderNumber();
  const invoiceNumber = generateInvoiceNumber(orderNumber);
  const order = db.transaction(() => {
    const inserted = db.insert(orders).values({
      order_number: orderNumber,
      customer_id: info.customer_id,
      customer_name: info.customer_name,
      customer_email: info.customer_email,
      customer_phone: info.customer_phone,
      customer_company: info.customer_company,
      shipping_address: info.shipping_address,
      notes: info.notes,
      status: meta.status,
      subtotal_cents: cart.subtotalCents,
      discount_cents: cart.discountCents,
      total_cents: cart.totalCents,
      coupon_code: cart.coupon?.code || '',
      coupon_label: cart.coupon?.label || '',
      shipping_method_name: cart.shippingMethod?.name || '',
      shipping_price_cents: cart.shippingCents,
      tax_rate_bps: cart.taxRateBps,
      tax_cents: cart.taxCents,
      payment_provider: meta.payment_provider,
      payment_status: meta.payment_status,
      stripe_session_id: meta.stripe_session_id || '',
      invoice_number: invoiceNumber,
    }).returning().get();
    for (const item of cart.items) {
      db.insert(order_items).values({
        order_id: inserted.id,
        product_id: item.product.id,
        product_name: item.product.name,
        product_slug: item.product.slug,
        sku: item.effectiveSku || item.product.sku || '',
        quantity: item.quantity,
        unit_price_cents: item.unitPriceCents,
        line_total_cents: item.lineTotalCents,
        variant_key: item.variantKey || '',
        variant_label: item.variantLabel || '',
      }).run();
      if (item.product.manage_stock) {
        db.update(products).set({ stock: Math.max(0, Number(item.product.stock || 0) - item.quantity) }).where(eq(products.id, item.product.id)).run();
      }
    }
    return inserted;
  });
  const items = db.select().from(order_items).where(eq(order_items.order_id, order.id)).orderBy(asc(order_items.id)).all();
  return { order, items };
}

/** Cherche une commande déjà créée pour une session Stripe (idempotence de la finalisation). */
export function findOrderByStripeSession(sessionId: string): Order | null {
  if (!sessionId) return null;
  return db.select().from(orders).where(eq(orders.stripe_session_id, sessionId)).get() ?? null;
}

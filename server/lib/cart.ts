/*
 * @id     tssr.libCart
 * @do     gerer_panier
 * @role   rule
 * @layer  domaine
 * @human  Logique du panier : lignes, coupons, livraison et totaux.
 */
import type { Request } from 'express';
import { inArray, eq, asc } from 'drizzle-orm';
import { db } from '../db/client';
import { products, coupons, shipping_methods } from '../db/schema';
import type { Product } from '../db/schema';
import { normalizeQuantity } from './utils';
import { currentPriceCents, resolveVariant } from './products';

export interface CartLineInput {
  productId: number;
  quantity: number;
  variantKey: string;
}

export interface CartLineDetail {
  lineKey: string;
  product: Product;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  variantKey: string;
  variantLabel: string;
  effectiveSku: string;
  effectiveStock: number;
}

export interface CartDetails {
  items: CartLineDetail[];
  subtotalCents: number;
  count: number;
  coupon: { id: number; code: string; label: string; discount_type: string; discount_value: number; min_subtotal_cents: number } | null;
  discountCents: number;
  shippingMethod: { id: number; name: string; description: string; computed_price_cents: number } | null;
  shippingCents: number;
  taxRateBps: number;
  taxCents: number;
  totalCents: number;
}

/*
 * @id     tssr.libCart.getCart
 * @do     lire_panier_session
 * @role   donnee
 * @layer  domaine
 * @human  Lit les lignes du panier depuis la session.
 */
export function getCart(req: Request): CartLineInput[] {
  if (!req.session.cart || !Array.isArray(req.session.cart)) req.session.cart = [];
  return req.session.cart;
}

/*
 * @id     tssr.libCart.setCart
 * @do     ecrire_panier_session
 * @role   donnee
 * @layer  domaine
 * @human  Écrit les lignes du panier dans la session.
 */
export function setCart(req: Request, items: Array<{ productId: number; quantity: number; variantKey?: string }>): CartLineInput[] {
  req.session.cart = (items || [])
    .map((item) => ({ productId: Number(item.productId), quantity: normalizeQuantity(item.quantity, 1), variantKey: String(item.variantKey || '').trim() }))
    .filter((item) => item.productId > 0 && item.quantity > 0);
  return req.session.cart;
}

/*
 * @id     tssr.libCart.getCouponFromSession
 * @do     lire_coupon_session
 * @role   donnee
 * @layer  domaine
 * @human  Lit le coupon appliqué depuis la session.
 */
export function getCouponFromSession(req: Request) {
  const code = String(req.session?.couponCode || '').trim().toUpperCase();
  if (!code) return null;
  return db.select().from(coupons).where(eq(coupons.code, code)).get() || null;
}

/*
 * @id     tssr.libCart.getShippingMethods
 * @do     lister_methodes_livraison
 * @role   donnee
 * @layer  domaine
 * @human  Retourne les méthodes de livraison actives.
 */
export function getShippingMethods() {
  return db.select().from(shipping_methods).where(eq(shipping_methods.active, 1)).orderBy(asc(shipping_methods.sort_order), asc(shipping_methods.id)).all();
}

/*
 * @id     tssr.libCart.getSelectedShippingMethod
 * @do     lire_livraison_choisie
 * @role   rule
 * @layer  domaine
 * @human  Retourne la méthode de livraison choisie, selon le sous-total.
 */
export function getSelectedShippingMethod(req: Request, subtotalCents = 0) {
  const methods = getShippingMethods();
  if (!methods.length) return null;
  const preferredId = Number(req.session?.shippingMethodId || 0);
  const selected = methods.find((m) => Number(m.id) === preferredId) || methods[0];
  const freeFrom = Number(selected.free_from_cents || 0);
  const computedPrice = freeFrom > 0 && subtotalCents >= freeFrom ? 0 : Number(selected.price_cents || 0);
  return { ...selected, computed_price_cents: computedPrice };
}

/*
 * @id     tssr.libCart.computeDiscount
 * @do     calculer_remise
 * @role   rule
 * @layer  domaine
 * @human  Calcule la remise d'un coupon sur un sous-total.
 */
export function computeDiscount(subtotalCents: number, coupon: { discount_type: string; discount_value: number; min_subtotal_cents: number; active?: number } | null): number {
  if (!coupon || !subtotalCents) return 0;
  if (coupon.active === 0) return 0;
  const minimum = Number(coupon.min_subtotal_cents || 0);
  if (subtotalCents < minimum) return 0;
  if (coupon.discount_type === 'fixed') return Math.min(subtotalCents, Number(coupon.discount_value || 0));
  if (coupon.discount_type === 'percent') return Math.min(subtotalCents, Math.round(subtotalCents * (Number(coupon.discount_value || 0) / 100)));
  return 0;
}

/*
 * @id     tssr.libCart.getCartDetails
 * @do     detailler_panier
 * @role   rule
 * @layer  domaine
 * @human  Assemble le détail complet du panier : lignes, remise, livraison et total.
 */
export function getCartDetails(req: Request): CartDetails {
  const cart = getCart(req);
  const ids = [...new Set(cart.map((item) => Number(item.productId)).filter(Boolean))];
  const productList = ids.length ? db.select().from(products).where(inArray(products.id, ids)).all() : [];
  const byId = new Map(productList.map((p) => [Number(p.id), p]));

  const items: CartLineDetail[] = cart.flatMap((item, index) => {
    const product = byId.get(Number(item.productId));
    if (!product || !product.published) return [];
    const variant = resolveVariant(product, item.variantKey || '');
    const maxStock = product.manage_stock ? Math.max(0, Number(variant.variantKey ? variant.variantStock : product.stock || 0)) : 999;
    const quantity = product.manage_stock ? Math.min(normalizeQuantity(item.quantity, 1), maxStock) : normalizeQuantity(item.quantity, 1);
    if (!quantity) return [];
    const unitPriceCents = Number(variant.variantPriceCents || currentPriceCents(product));
    const lineKey = `${product.id}:${variant.variantKey || 'default'}:${index}`;
    return [{
      lineKey,
      product,
      quantity,
      unitPriceCents,
      lineTotalCents: unitPriceCents * quantity,
      variantKey: variant.variantKey,
      variantLabel: variant.variantLabel,
      effectiveSku: variant.variantSku || product.sku || '',
      effectiveStock: maxStock,
    }];
  });

  const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const coupon = getCouponFromSession(req);
  const discountCents = computeDiscount(subtotalCents, coupon);
  const shippingMethod = getSelectedShippingMethod(req, subtotalCents);
  const shippingCents = shippingMethod ? Number(shippingMethod.computed_price_cents || 0) : 0;
  const taxableBaseCents = Math.max(0, subtotalCents - discountCents) + shippingCents;
  const taxRateBps = 2000;
  const taxCents = Math.round(taxableBaseCents * (taxRateBps / 10000));
  const totalCents = taxableBaseCents + taxCents;

  return { items, subtotalCents, count, coupon, discountCents, shippingMethod, shippingCents, taxRateBps, taxCents, totalCents };
}

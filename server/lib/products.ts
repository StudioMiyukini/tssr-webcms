/*
 * @id     tssr.libProducts
 * @do     gerer_produits
 * @role   rule
 * @layer  domaine
 * @human  Logique produits : prix, variantes et résolution.
 */
import { slugify } from './utils';
import type { Product } from '../db/schema';

export interface ParsedVariant {
  key: string;
  label: string;
  price_cents: number;
  stock: number;
  sku: string;
}

/*
 * @id     tssr.libProducts.currentPriceCents
 * @do     lire_prix_courant
 * @role   rule
 * @layer  domaine
 * @human  Retourne le prix courant d'un produit en centimes.
 */
export function currentPriceCents(product: Partial<Product>): number {
  const regular = Number(product.price_cents || 0);
  const sale = Number(product.sale_price_cents || 0);
  return sale > 0 && sale < regular ? sale : regular;
}

/*
 * @id     tssr.libProducts.comparePriceCents
 * @do     lire_prix_barre
 * @role   rule
 * @layer  domaine
 * @human  Retourne le prix barré (avant remise) d'un produit.
 */
export function comparePriceCents(product: Partial<Product>): number {
  const regular = Number(product.price_cents || 0);
  const compareAt = Number(product.compare_at_price_cents || 0);
  const current = currentPriceCents(product);
  return Math.max(compareAt, regular, current);
}

/*
 * @id     tssr.libProducts.parseProductVariants
 * @do     analyser_variantes
 * @role   donnee
 * @layer  domaine
 * @human  Analyse le JSON des variantes d'un produit.
 */
export function parseProductVariants(json: string | null | undefined): ParsedVariant[] {
  try {
    const parsed = JSON.parse(json || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map((variant: any, index: number) => ({
      key: slugify(variant.key || variant.label || `variant-${index + 1}`),
      label: String(variant.label || `Variante ${index + 1}`).trim(),
      price_cents: Number(variant.price_cents ?? 0),
      stock: Number(variant.stock ?? 0),
      sku: String(variant.sku || '').trim(),
    }));
  } catch {
    return [];
  }
}

export interface ResolvedVariant {
  variants: ParsedVariant[];
  selected: ParsedVariant | null;
  variantKey: string;
  variantLabel: string;
  variantSku: string;
  variantPriceCents: number;
  variantStock: number;
}

/*
 * @id     tssr.libProducts.resolveVariant
 * @do     resoudre_variante
 * @role   rule
 * @layer  domaine
 * @human  Résout la variante choisie d'un produit (prix, stock, libellé).
 */
export function resolveVariant(product: Partial<Product>, variantKey = ''): ResolvedVariant {
  const variants = parseProductVariants(product?.variants_json || '[]');
  const selected = variants.find((v) => v.key === String(variantKey || '').trim()) || null;
  return {
    variants,
    selected,
    variantKey: selected?.key || '',
    variantLabel: selected?.label || '',
    variantSku: selected?.sku || '',
    variantPriceCents: selected && Number.isFinite(selected.price_cents) && selected.price_cents > 0 ? selected.price_cents : currentPriceCents(product),
    variantStock: selected ? Number(selected.stock || 0) : Number(product?.stock || 0),
  };
}

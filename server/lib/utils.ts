/*
 * @id     tssr.libUtils
 * @do     outiller_divers
 * @role   donnee
 * @layer  outil
 * @human  Utilitaires transverses : slugs, prix, numéros de commande et de facture.
 */
/*
 * @id     tssr.libUtils.slugify
 * @do     creer_slug
 * @role   donnee
 * @layer  outil
 * @human  Transforme un texte en slug d'URL.
 */
export function slugify(input: string | undefined | null): string {
  return String(input || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'page';
}

/*
 * @id     tssr.libUtils.formatPriceEUR
 * @do     formater_prix_euros
 * @role   ui
 * @layer  outil
 * @human  Met en forme un montant en centimes en prix en euros.
 */
export function formatPriceEUR(cents: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format((cents || 0) / 100);
}

/*
 * @id     tssr.libUtils.generateOrderNumber
 * @do     generer_numero_commande
 * @role   donnee
 * @layer  outil
 * @human  Génère un numéro de commande unique.
 */
export function generateOrderNumber(): string {
  return `MK-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
}

/*
 * @id     tssr.libUtils.generateInvoiceNumber
 * @do     generer_numero_facture
 * @role   donnee
 * @layer  outil
 * @human  Génère un numéro de facture dérivé du numéro de commande.
 */
export function generateInvoiceNumber(orderNumber = ''): string {
  return `FAC-${String(orderNumber || '').replace(/[^A-Z0-9-]/gi, '').toUpperCase()}`;
}

/*
 * @id     tssr.libUtils.normalizeQuantity
 * @do     normaliser_quantite
 * @role   rule
 * @layer  outil
 * @human  Normalise une quantité saisie en entier positif borné.
 */
export function normalizeQuantity(value: unknown, fallback = 1): number {
  const n = Number(value ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(999, Math.round(n)));
}

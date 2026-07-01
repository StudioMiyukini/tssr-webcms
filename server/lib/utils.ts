export function slugify(input: string | undefined | null): string {
  return String(input || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'page';
}

export function formatPriceEUR(cents: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format((cents || 0) / 100);
}

export function generateOrderNumber(): string {
  return `MK-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
}

export function generateInvoiceNumber(orderNumber = ''): string {
  return `FAC-${String(orderNumber || '').replace(/[^A-Z0-9-]/gi, '').toUpperCase()}`;
}

export function normalizeQuantity(value: unknown, fallback = 1): number {
  const n = Number(value ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(999, Math.round(n)));
}

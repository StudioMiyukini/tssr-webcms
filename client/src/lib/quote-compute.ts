import { formatPriceEUR } from './format';

export interface RenderableBlock {
  id: string;
  type: string;
  name: string;
  label: string;
  required: boolean;
  placeholder: string;
  options: string[];
  help_text?: string;
  width?: string;
  css_class?: string;
  price_cents?: number;
  option_prices?: number[];
  percent_value?: number;
  option_percents?: number[];
}

export interface QuoteLineDetail {
  label: string;
  detail?: string;       // sous-texte (ex: "5 pages × 80,00 €")
  amountCents?: number;  // pour les lignes additives
  percent?: number;      // pour les lignes en pourcentage
}

export interface QuoteBreakdown {
  /** Lignes additives (prix fixes, options payantes, quantités, choix tarifés) */
  baseLines: QuoteLineDetail[];
  /** Lignes en % (options bonus/remise, sélections %) */
  percentLines: QuoteLineDetail[];
  baseCents: number;
  sumPercents: number;
  totalCents: number;
}

export function computeQuoteBreakdown(blocks: RenderableBlock[], payload: Record<string, string>): QuoteBreakdown {
  const baseLines: QuoteLineDetail[] = [];
  const percentLines: QuoteLineDetail[] = [];
  let base = 0;
  let sumPercents = 0;

  for (const b of blocks) {
    if (b.type === 'price_fixed') {
      const amt = Number(b.price_cents || 0);
      base += amt;
      baseLines.push({ label: b.label, amountCents: amt });
    } else if (b.type === 'price_option') {
      const v = String(payload[b.name] ?? '').trim();
      if (v && v !== '0' && v !== 'false') {
        const amt = Number(b.price_cents || 0);
        base += amt;
        baseLines.push({ label: b.label, amountCents: amt });
      }
    } else if (b.type === 'price_select') {
      const chosen = String(payload[b.name] ?? '').trim();
      const idx = (b.options || []).findIndex(o => o === chosen);
      if (idx >= 0) {
        const amt = Number((b.option_prices || [])[idx] || 0);
        base += amt;
        baseLines.push({ label: b.label, detail: chosen, amountCents: amt });
      }
    } else if (b.type === 'quantity') {
      const n = Number(payload[b.name] ?? 0);
      if (Number.isFinite(n) && n > 0) {
        const unitCents = Number(b.price_cents || 0);
        const amt = Math.round(unitCents * n);
        base += amt;
        const unitLabel = b.placeholder || 'u';
        baseLines.push({ label: b.label, detail: `${n} ${unitLabel} × ${formatPriceEUR(unitCents)}`, amountCents: amt });
      }
    } else if (b.type === 'price_percent_option') {
      const v = String(payload[b.name] ?? '').trim();
      if (v && v !== '0' && v !== 'false') {
        const pct = Number(b.percent_value || 0);
        sumPercents += pct;
        percentLines.push({ label: b.label, percent: pct });
      }
    } else if (b.type === 'price_percent_select') {
      const chosen = String(payload[b.name] ?? '').trim();
      const idx = (b.options || []).findIndex(o => o === chosen);
      if (idx >= 0) {
        const pct = Number((b.option_percents || [])[idx] || 0);
        sumPercents += pct;
        percentLines.push({ label: b.label, detail: chosen, percent: pct });
      }
    }
  }

  const totalCents = Math.max(0, Math.round(base * (1 + sumPercents / 100)));
  return { baseLines, percentLines, baseCents: base, sumPercents, totalCents };
}


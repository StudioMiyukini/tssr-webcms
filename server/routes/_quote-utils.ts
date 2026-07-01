import { slugify } from '../lib/utils';

export interface QuoteField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  placeholder: string;
  options: string[];
}

export interface QuoteBlock extends QuoteField {
  id: string;
  help_text: string;
  validation: Record<string, unknown>;
  conditional: unknown;
  width: string;
  css_class: string;
  // Pricing - additifs
  price_cents: number;
  option_prices: number[];
  // Pricing - multiplicateurs (en pourcentage signé, ex: 20 = +20%, -10 = remise 10%)
  percent_value: number;
  option_percents: number[];
}

export const FIELD_TYPES = ['text', 'email', 'tel', 'textarea', 'select', 'radio', 'checkbox', 'number', 'date'] as const;
export const LAYOUT_TYPES = ['heading', 'separator', 'section'] as const;
export const PRICING_TYPES = ['price_fixed', 'price_option', 'price_select', 'quantity', 'price_percent_option', 'price_percent_select', 'total'] as const;
export const ALL_TYPES = [...FIELD_TYPES, ...LAYOUT_TYPES, ...PRICING_TYPES] as const;

export function parseFields(json: string | null | undefined): QuoteField[] {
  try {
    const parsed = JSON.parse(json || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map((field: any, index: number) => ({
      name: slugify(field.name || `field-${index + 1}`),
      label: field.label || `Champ ${index + 1}`,
      type: (FIELD_TYPES as readonly string[]).includes(field.type) ? field.type : 'text',
      required: Boolean(field.required),
      placeholder: field.placeholder || '',
      options: Array.isArray(field.options) ? field.options : [],
    }));
  } catch {
    return [];
  }
}

export function parseBlocks(json: string | null | undefined): QuoteBlock[] {
  try {
    const parsed = JSON.parse(json || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map((block: any, index: number) => ({
      id: block.id || `block-${Date.now()}-${index}`,
      type: (ALL_TYPES as readonly string[]).includes(block.type) ? block.type : 'text',
      name: block.name || slugify(block.label || `champ-${index + 1}`),
      label: block.label || `Champ ${index + 1}`,
      required: Boolean(block.required),
      placeholder: block.placeholder || '',
      options: Array.isArray(block.options) ? block.options : [],
      help_text: block.help_text || '',
      validation: block.validation || {},
      conditional: block.conditional || null,
      width: block.width || 'full',
      css_class: block.css_class || '',
      price_cents: Number(block.price_cents || 0),
      option_prices: Array.isArray(block.option_prices) ? block.option_prices.map((n: any) => Number(n) || 0) : [],
      percent_value: Number(block.percent_value || 0),
      option_percents: Array.isArray(block.option_percents) ? block.option_percents.map((n: any) => Number(n) || 0) : [],
    }));
  } catch {
    return [];
  }
}

export function blocksToFields(blocks: QuoteBlock[]): QuoteField[] {
  return blocks
    .filter(b => !(LAYOUT_TYPES as readonly string[]).includes(b.type) && b.type !== 'price_fixed' && b.type !== 'total')
    .map(b => {
      // Mapper les types pricing vers le type de champ HTML approprié
      let formType: string = b.type;
      if (b.type === 'price_option' || b.type === 'price_percent_option') formType = 'checkbox';
      else if (b.type === 'price_select' || b.type === 'price_percent_select') formType = 'select';
      else if (b.type === 'quantity') formType = 'number';
      else if (!(FIELD_TYPES as readonly string[]).includes(b.type)) formType = 'text';
      return {
        name: b.name,
        label: b.label,
        type: formType,
        required: b.required,
        placeholder: b.placeholder,
        options: b.options,
      };
    });
}

/**
 * Recalcule le total devis depuis les blocs + payload soumis.
 *
 * Passe 1 — base additive (en centimes) :
 *   - price_fixed     : +price_cents systématiquement
 *   - price_option    : si payload[name] truthy → +price_cents
 *   - price_select    : +option_prices[index de l'option choisie]
 *   - quantity        : +price_cents * Number(payload[name])
 *
 * Passe 2 — multiplicateurs en pourcentage signé (cumulés puis appliqués) :
 *   - price_percent_option  : si payload[name] truthy → +percent_value (en %)
 *   - price_percent_select  : +option_percents[index] (en %)
 *
 * Total final = base × (1 + sumPercents / 100). Toujours ≥ 0.
 */
export function computeQuoteTotal(blocks: QuoteBlock[], payload: Record<string, unknown>): number {
  let base = 0;
  let sumPercents = 0;
  for (const b of blocks) {
    if (b.type === 'price_fixed') {
      base += Number(b.price_cents || 0);
    } else if (b.type === 'price_option') {
      const v = String(payload[b.name] ?? '').trim();
      if (v && v !== '0' && v !== 'false') base += Number(b.price_cents || 0);
    } else if (b.type === 'price_select') {
      const chosen = String(payload[b.name] ?? '').trim();
      const idx = b.options.findIndex(o => o === chosen);
      if (idx >= 0) base += Number(b.option_prices[idx] || 0);
    } else if (b.type === 'quantity') {
      const n = Number(payload[b.name] ?? 0);
      if (Number.isFinite(n) && n > 0) base += Math.round(Number(b.price_cents || 0) * n);
    } else if (b.type === 'price_percent_option') {
      const v = String(payload[b.name] ?? '').trim();
      if (v && v !== '0' && v !== 'false') sumPercents += Number(b.percent_value || 0);
    } else if (b.type === 'price_percent_select') {
      const chosen = String(payload[b.name] ?? '').trim();
      const idx = b.options.findIndex(o => o === chosen);
      if (idx >= 0) sumPercents += Number(b.option_percents[idx] || 0);
    }
  }
  const multiplier = 1 + sumPercents / 100;
  return Math.max(0, Math.round(base * multiplier));
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatPriceEUR as formatCents } from '@/lib/format';

export interface Block {
  id: string;
  type: string;
  name: string;
  label: string;
  required: boolean;
  placeholder: string;
  options: string[];
  help_text: string;
  validation: Record<string, unknown>;
  conditional: unknown;
  width: 'full' | 'half' | 'third';
  css_class: string;
  // Pricing additif
  price_cents: number;
  option_prices: number[];
  // Pricing multiplicateur (% signé)
  percent_value: number;
  option_percents: number[];
}

export const FIELD_TYPES = ['text', 'email', 'tel', 'number', 'textarea', 'select', 'radio', 'checkbox', 'date'] as const;
export const LAYOUT_TYPES = ['heading', 'separator', 'section'] as const;
export const PRICING_TYPES = ['price_fixed', 'price_option', 'price_select', 'quantity', 'price_percent_option', 'price_percent_select', 'total'] as const;
export const OPTION_TYPES = ['select', 'radio', 'checkbox', 'price_select', 'price_percent_select'] as const;

const PALETTE: Array<{ type: string; label: string; icon: string; group: 'field' | 'layout' | 'pricing' }> = [
  { type: 'text', label: 'Texte', icon: 'Aa', group: 'field' },
  { type: 'email', label: 'Email', icon: '✉', group: 'field' },
  { type: 'tel', label: 'Téléphone', icon: '📞', group: 'field' },
  { type: 'number', label: 'Nombre', icon: '#', group: 'field' },
  { type: 'textarea', label: 'Zone de texte', icon: '¶', group: 'field' },
  { type: 'select', label: 'Liste déroulante', icon: '▾', group: 'field' },
  { type: 'radio', label: 'Choix unique', icon: '◉', group: 'field' },
  { type: 'checkbox', label: 'Case à cocher', icon: '☑', group: 'field' },
  { type: 'date', label: 'Date', icon: '📅', group: 'field' },
  { type: 'heading', label: 'Titre', icon: 'H', group: 'layout' },
  { type: 'separator', label: 'Séparateur', icon: '—', group: 'layout' },
  { type: 'section', label: 'Section', icon: '☐', group: 'layout' },
  { type: 'price_fixed', label: 'Prix fixe', icon: '€', group: 'pricing' },
  { type: 'price_option', label: 'Option payante', icon: '+€', group: 'pricing' },
  { type: 'price_select', label: 'Choix tarifé', icon: '€▾', group: 'pricing' },
  { type: 'quantity', label: 'Quantité × prix', icon: '×€', group: 'pricing' },
  { type: 'price_percent_option', label: 'Option % (+/−)', icon: '%☑', group: 'pricing' },
  { type: 'price_percent_select', label: 'Choix % (+/−)', icon: '%▾', group: 'pricing' },
  { type: 'total', label: 'Total live', icon: '∑', group: 'pricing' },
];

const TYPE_LABELS: Record<string, string> = {
  text: 'Champ texte', email: 'Adresse email', tel: 'Téléphone', number: 'Nombre',
  textarea: 'Message', select: 'Sélection', radio: 'Choix unique', checkbox: 'Case à cocher', date: 'Date',
  heading: 'Titre de section', separator: 'Séparateur', section: 'Section',
  price_fixed: 'Prix de base', price_option: 'Option supplémentaire', price_select: 'Choix tarifé',
  quantity: 'Quantité', price_percent_option: 'Option en %', price_percent_select: 'Choix en %',
  total: 'Total estimé',
};

function makeBlock(type: string, counter: number): Block {
  const layout = (LAYOUT_TYPES as readonly string[]).includes(type);
  const needsOptions = (OPTION_TYPES as readonly string[]).includes(type);
  return {
    id: `block-${Date.now()}-${counter}`,
    type,
    name: `${type}-${counter}`,
    label: TYPE_LABELS[type] || type,
    required: !layout && type !== 'price_fixed' && type !== 'total',
    placeholder: '',
    options: needsOptions ? ['Option 1', 'Option 2'] : [],
    help_text: '',
    validation: {},
    conditional: null,
    width: 'full',
    css_class: '',
    price_cents: type === 'price_fixed' ? 10000 : (type === 'price_option' || type === 'quantity') ? 5000 : (type === 'price_select') ? 0 : 0,
    option_prices: type === 'price_select' ? [0, 0] : [],
    percent_value: type === 'price_percent_option' ? 20 : 0,
    option_percents: type === 'price_percent_select' ? [0, 0] : [],
  };
}

function normalizeBlocks(json: string | undefined | null): Block[] {
  try {
    const parsed = JSON.parse(json || '[]');
    if (!Array.isArray(parsed)) return [];
    const all: readonly string[] = [...FIELD_TYPES, ...LAYOUT_TYPES, ...PRICING_TYPES];
    return parsed.map((b: any, i: number) => ({
      id: b.id || `block-${Date.now()}-${i}`,
      type: all.includes(b.type) ? b.type : 'text',
      name: b.name || `champ-${i + 1}`,
      label: b.label || `Champ ${i + 1}`,
      required: Boolean(b.required),
      placeholder: b.placeholder || '',
      options: Array.isArray(b.options) ? b.options : [],
      help_text: b.help_text || '',
      validation: b.validation || {},
      conditional: b.conditional || null,
      width: b.width || 'full',
      css_class: b.css_class || '',
      price_cents: Number(b.price_cents || 0),
      option_prices: Array.isArray(b.option_prices) ? b.option_prices.map((n: any) => Number(n) || 0) : [],
      percent_value: Number(b.percent_value || 0),
      option_percents: Array.isArray(b.option_percents) ? b.option_percents.map((n: any) => Number(n) || 0) : [],
    }));
  } catch {
    return [];
  }
}

interface Props {
  value: string;
  onChange: (json: string) => void;
}

export function BlockEditor({ value, onChange }: Props) {
  const [blocks, setBlocks] = useState<Block[]>(() => normalizeBlocks(value));
  const [openId, setOpenId] = useState<string | null>(null);
  const counterRef = useRef(blocks.length);
  const dragId = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Garde une ref vers onChange pour éviter que des re-renders du parent
  // ne déclenchent un emit avec un blocks obsolète.
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // Sync downstream : émet le JSON courant uniquement quand `blocks` change vraiment.
  useEffect(() => {
    onChangeRef.current(JSON.stringify(blocks, null, 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  // Sync upstream : si `value` change de l'extérieur (par ex. chargement TanStack Query),
  // on resynchronise l'état interne sans déclencher de boucle (compare le contenu sémantique).
  useEffect(() => {
    const incoming = normalizeBlocks(value);
    setBlocks(prev => {
      if (JSON.stringify(prev) === JSON.stringify(incoming)) return prev;
      counterRef.current = Math.max(counterRef.current, incoming.length);
      return incoming;
    });
  }, [value]);

  const update = (id: string, patch: Partial<Block>) => setBlocks(bs => bs.map(b => b.id === id ? { ...b, ...patch } : b));
  const remove = (id: string) => { if (confirm('Supprimer ce bloc ?')) setBlocks(bs => bs.filter(b => b.id !== id)); };
  const duplicate = (id: string) => setBlocks(bs => {
    const i = bs.findIndex(b => b.id === id);
    if (i < 0) return bs;
    counterRef.current += 1;
    const copy: Block = { ...bs[i], id: `block-${Date.now()}-${counterRef.current}`, name: `${bs[i].name}-copy` };
    const next = [...bs];
    next.splice(i + 1, 0, copy);
    return next;
  });
  const move = (id: string, dir: -1 | 1) => setBlocks(bs => {
    const i = bs.findIndex(b => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= bs.length) return bs;
    const next = [...bs];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const addBlock = (type: string) => {
    counterRef.current += 1;
    const b = makeBlock(type, counterRef.current);
    setBlocks(bs => [...bs, b]);
    setOpenId(b.id);
  };

  const onDragStart = (id: string) => (e: React.DragEvent) => { dragId.current = id; e.dataTransfer.effectAllowed = 'move'; };
  const onDragOver = (id: string) => (e: React.DragEvent) => { e.preventDefault(); if (id !== dragOverId) setDragOverId(id); };
  const onDrop = (id: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const src = dragId.current;
    dragId.current = null; setDragOverId(null);
    if (!src || src === id) return;
    setBlocks(bs => {
      const from = bs.findIndex(b => b.id === src);
      const to = bs.findIndex(b => b.id === id);
      if (from < 0 || to < 0) return bs;
      const next = [...bs];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const fieldGroup = useMemo(() => PALETTE.filter(p => p.group === 'field'), []);
  const layoutGroup = useMemo(() => PALETTE.filter(p => p.group === 'layout'), []);
  const pricingGroup = useMemo(() => PALETTE.filter(p => p.group === 'pricing'), []);

  return (
    <div className="block-editor">
      <aside className="block-palette">
        <div className="palette-title">Champs</div>
        {fieldGroup.map(p => (
          <button key={p.type} type="button" className="palette-btn" onClick={() => addBlock(p.type)}>
            <span className="palette-icon">{p.icon}</span> {p.label}
          </button>
        ))}
        <div className="palette-title" style={{ marginTop: 12 }}>Mise en forme</div>
        {layoutGroup.map(p => (
          <button key={p.type} type="button" className="palette-btn" onClick={() => addBlock(p.type)}>
            <span className="palette-icon">{p.icon}</span> {p.label}
          </button>
        ))}
        <div className="palette-title" style={{ marginTop: 12 }}>Devis calculé</div>
        {pricingGroup.map(p => (
          <button key={p.type} type="button" className="palette-btn pricing" onClick={() => addBlock(p.type)}>
            <span className="palette-icon">{p.icon}</span> {p.label}
          </button>
        ))}
        <div className="palette-help">Astuce : glisse-dépose les blocs pour les réordonner. Les blocs « Devis calculé » s'additionnent (ou se multiplient pour les %).</div>
      </aside>

      <div className="block-canvas">
        {blocks.length === 0 ? (
          <div className="block-empty">
            <p>Aucun bloc pour le moment.</p>
            <p className="meta">Ajoute un champ depuis la palette à gauche.</p>
          </div>
        ) : blocks.map((b, idx) => {
          const isOpen = openId === b.id;
          const isField = (FIELD_TYPES as readonly string[]).includes(b.type);
          const isPricing = (PRICING_TYPES as readonly string[]).includes(b.type);
          const isLayout = (LAYOUT_TYPES as readonly string[]).includes(b.type);
          const hasTextOptions = (OPTION_TYPES as readonly string[]).includes(b.type);
          const isPriceSelect = b.type === 'price_select';
          const isPercentSelect = b.type === 'price_percent_select';
          const acceptsRequired = isField || b.type === 'price_option' || b.type === 'price_select' || b.type === 'quantity' || b.type === 'price_percent_option' || b.type === 'price_percent_select';
          const acceptsPlaceholder = isField || b.type === 'quantity';

          let badgeSuffix = '';
          if (b.type === 'price_fixed') badgeSuffix = ` · ${formatCents(b.price_cents)}`;
          else if (b.type === 'price_option') badgeSuffix = ` · +${formatCents(b.price_cents)}`;
          else if (b.type === 'quantity') badgeSuffix = ` · ${formatCents(b.price_cents)}/u`;
          else if (b.type === 'price_percent_option') badgeSuffix = ` · ${b.percent_value > 0 ? '+' : ''}${b.percent_value}%`;

          return (
            <div
              key={b.id}
              className={`block-item block-${b.type} ${isOpen ? 'open' : ''} ${dragOverId === b.id ? 'drag-over' : ''} ${isPricing ? 'block-pricing' : ''}`}
              draggable
              onDragStart={onDragStart(b.id)}
              onDragOver={onDragOver(b.id)}
              onDrop={onDrop(b.id)}
              onDragLeave={() => setDragOverId(null)}
              onDragEnd={() => { dragId.current = null; setDragOverId(null); }}
            >
              <header className="block-header" onClick={() => setOpenId(isOpen ? null : b.id)}>
                <span className="block-drag" title="Glisser pour réordonner">⋮⋮</span>
                <span className={`block-type-badge ${b.type}`}>{b.type.replace('price_', '').replace('_', ' ')}</span>
                <span className="block-label">{b.label}{b.required && !isLayout && b.type !== 'price_fixed' && b.type !== 'total' ? ' *' : ''}{badgeSuffix}</span>
                <div className="block-actions">
                  <button type="button" title="Monter" onClick={(e) => { e.stopPropagation(); move(b.id, -1); }} disabled={idx === 0}>↑</button>
                  <button type="button" title="Descendre" onClick={(e) => { e.stopPropagation(); move(b.id, 1); }} disabled={idx === blocks.length - 1}>↓</button>
                  <button type="button" title="Dupliquer" onClick={(e) => { e.stopPropagation(); duplicate(b.id); }}>⧉</button>
                  <button type="button" className="danger" title="Supprimer" onClick={(e) => { e.stopPropagation(); remove(b.id); }}>✕</button>
                </div>
              </header>
              {isOpen && (
                <div className="block-body">
                  <div className="block-row">
                    <div className="field"><label>Libellé</label><input value={b.label} onChange={e => update(b.id, { label: e.target.value })} /></div>
                    {b.type !== 'price_fixed' && b.type !== 'total' && b.type !== 'separator' && (
                      <div className="field"><label>Nom technique</label><input value={b.name} onChange={e => update(b.id, { name: e.target.value })} placeholder="ex: budget" /></div>
                    )}
                  </div>
                  <div className="block-row">
                    <div className="field"><label>Type</label>
                      <select value={b.type} onChange={e => update(b.id, { type: e.target.value })}>
                        <optgroup label="Champs">{PALETTE.filter(p => p.group === 'field').map(p => <option key={p.type} value={p.type}>{p.label}</option>)}</optgroup>
                        <optgroup label="Mise en forme">{PALETTE.filter(p => p.group === 'layout').map(p => <option key={p.type} value={p.type}>{p.label}</option>)}</optgroup>
                        <optgroup label="Devis calculé">{PALETTE.filter(p => p.group === 'pricing').map(p => <option key={p.type} value={p.type}>{p.label}</option>)}</optgroup>
                      </select>
                    </div>
                    <div className="field"><label>Largeur</label>
                      <select value={b.width} onChange={e => update(b.id, { width: e.target.value as Block['width'] })}>
                        <option value="full">100%</option>
                        <option value="half">50%</option>
                        <option value="third">33%</option>
                      </select>
                    </div>
                  </div>

                  {acceptsRequired && (
                    <div className="block-row">
                      <label className="block-checkbox"><input type="checkbox" checked={b.required} onChange={e => update(b.id, { required: e.target.checked })} /> Obligatoire</label>
                      {acceptsPlaceholder && <div className="field"><label>Placeholder</label><input value={b.placeholder} onChange={e => update(b.id, { placeholder: e.target.value })} /></div>}
                    </div>
                  )}

                  {(b.type === 'price_fixed' || b.type === 'price_option') && (
                    <div className="field"><label>{b.type === 'price_fixed' ? 'Montant (centimes) — ajouté toujours' : 'Montant ajouté si coché (centimes)'}</label>
                      <input type="number" step={1} min={0} value={b.price_cents} onChange={e => update(b.id, { price_cents: Number(e.target.value) })} />
                      <span className="hint">= {formatCents(b.price_cents)}</span>
                    </div>
                  )}

                  {b.type === 'quantity' && (
                    <div className="block-row">
                      <div className="field"><label>Prix unitaire (centimes)</label>
                        <input type="number" step={1} min={0} value={b.price_cents} onChange={e => update(b.id, { price_cents: Number(e.target.value) })} />
                        <span className="hint">= {formatCents(b.price_cents)} × quantité saisie</span>
                      </div>
                      <div className="field"><label>Unité affichée</label>
                        <input value={b.placeholder} onChange={e => update(b.id, { placeholder: e.target.value })} placeholder="ex: pages, jours" />
                      </div>
                    </div>
                  )}

                  {b.type === 'price_percent_option' && (
                    <div className="field"><label>Pourcentage ajouté si coché (signé)</label>
                      <input type="number" step={1} value={b.percent_value} onChange={e => update(b.id, { percent_value: Number(e.target.value) })} />
                      <span className="hint">{b.percent_value > 0 ? `+${b.percent_value}%` : `${b.percent_value}%`} sur le sous-total. Mets une valeur négative pour une remise (ex: -10).</span>
                    </div>
                  )}

                  {hasTextOptions && !isPriceSelect && !isPercentSelect && (
                    <OptionsEditor block={b} onChange={(opts) => update(b.id, { options: opts })} />
                  )}

                  {isPriceSelect && (
                    <OptionsWithPriceEditor block={b} onChange={(opts, prices) => update(b.id, { options: opts, option_prices: prices })} />
                  )}

                  {isPercentSelect && (
                    <OptionsWithPercentEditor block={b} onChange={(opts, percents) => update(b.id, { options: opts, option_percents: percents })} />
                  )}

                  {(isField || b.type === 'quantity') && (
                    <div className="field"><label>Texte d'aide</label><input value={b.help_text} onChange={e => update(b.id, { help_text: e.target.value })} /></div>
                  )}

                  <div className="field"><label>Classe CSS</label><input value={b.css_class} onChange={e => update(b.id, { css_class: e.target.value })} placeholder="ex: highlight" /></div>

                  <details className="block-preview">
                    <summary>Aperçu</summary>
                    <BlockPreview block={b} />
                  </details>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OptionsEditor({ block: b, onChange }: { block: Block; onChange: (opts: string[]) => void }) {
  return (
    <div className="field">
      <label>Options</label>
      <div className="options-editor">
        {b.options.map((opt, oi) => (
          <div key={oi} className="option-row">
            <input value={opt} onChange={e => onChange(b.options.map((o, i) => i === oi ? e.target.value : o))} />
            <button type="button" className="btn danger small" onClick={() => onChange(b.options.filter((_, i) => i !== oi))}>✕</button>
          </div>
        ))}
        <button type="button" className="btn secondary small" onClick={() => onChange([...b.options, `Option ${b.options.length + 1}`])}>+ Ajouter une option</button>
      </div>
    </div>
  );
}

function OptionsWithPriceEditor({ block: b, onChange }: { block: Block; onChange: (opts: string[], prices: number[]) => void }) {
  const prices = b.option_prices.length === b.options.length ? b.option_prices : b.options.map((_, i) => b.option_prices[i] || 0);
  return (
    <div className="field">
      <label>Options et prix (en centimes)</label>
      <div className="options-editor">
        {b.options.map((opt, oi) => (
          <div key={oi} className="option-row option-row-priced">
            <input value={opt} placeholder="Libellé" onChange={e => onChange(b.options.map((o, i) => i === oi ? e.target.value : o), prices)} />
            <input type="number" step={1} min={0} value={prices[oi] || 0} placeholder="Prix (centimes)" onChange={e => onChange(b.options, prices.map((p, i) => i === oi ? Number(e.target.value) : p))} style={{ maxWidth: 120 }} />
            <span className="meta" style={{ minWidth: 70, textAlign: 'right' }}>{formatCents(prices[oi] || 0)}</span>
            <button type="button" className="btn danger small" onClick={() => onChange(b.options.filter((_, i) => i !== oi), prices.filter((_, i) => i !== oi))}>✕</button>
          </div>
        ))}
        <button type="button" className="btn secondary small" onClick={() => onChange([...b.options, `Option ${b.options.length + 1}`], [...prices, 0])}>+ Ajouter une option</button>
      </div>
    </div>
  );
}

function OptionsWithPercentEditor({ block: b, onChange }: { block: Block; onChange: (opts: string[], percents: number[]) => void }) {
  const percents = b.option_percents.length === b.options.length ? b.option_percents : b.options.map((_, i) => b.option_percents[i] || 0);
  return (
    <div className="field">
      <label>Options et pourcentages (signés — négatif = remise)</label>
      <div className="options-editor">
        {b.options.map((opt, oi) => (
          <div key={oi} className="option-row option-row-priced">
            <input value={opt} placeholder="Libellé" onChange={e => onChange(b.options.map((o, i) => i === oi ? e.target.value : o), percents)} />
            <input type="number" step={1} value={percents[oi] || 0} placeholder="%" onChange={e => onChange(b.options, percents.map((p, i) => i === oi ? Number(e.target.value) : p))} style={{ maxWidth: 90 }} />
            <span className="meta" style={{ minWidth: 50, textAlign: 'right' }}>{(percents[oi] || 0) > 0 ? '+' : ''}{percents[oi] || 0}%</span>
            <button type="button" className="btn danger small" onClick={() => onChange(b.options.filter((_, i) => i !== oi), percents.filter((_, i) => i !== oi))}>✕</button>
          </div>
        ))}
        <button type="button" className="btn secondary small" onClick={() => onChange([...b.options, `Option ${b.options.length + 1}`], [...percents, 0])}>+ Ajouter une option</button>
      </div>
    </div>
  );
}

function BlockPreview({ block: b }: { block: Block }) {
  if (b.type === 'heading') return <h3 style={{ marginTop: 12 }}>{b.label}</h3>;
  if (b.type === 'separator') return <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '12px 0' }} />;
  if (b.type === 'section') return <div style={{ background: 'var(--surface-2)', padding: 10, borderRadius: 6, marginTop: 8 }}>{b.label}</div>;

  if (b.type === 'price_fixed') return <div className="quote-line"><span>{b.label}</span><strong>{formatCents(b.price_cents)}</strong></div>;
  if (b.type === 'price_option') return <label className="quote-line"><span><input type="checkbox" disabled /> {b.label}</span><strong>+{formatCents(b.price_cents)}</strong></label>;
  if (b.type === 'price_select') return (
    <div className="field" style={{ marginTop: 8 }}>
      <label>{b.label}</label>
      <select disabled>{b.options.map((o, i) => <option key={o}>{o} — {formatCents(b.option_prices[i] || 0)}</option>)}</select>
    </div>
  );
  if (b.type === 'quantity') return (
    <div className="field" style={{ marginTop: 8 }}>
      <label>{b.label}</label>
      <input type="number" placeholder={b.placeholder || 'quantité'} disabled />
      <span className="hint">{formatCents(b.price_cents)} × n</span>
    </div>
  );
  if (b.type === 'price_percent_option') return <label className="quote-line"><span><input type="checkbox" disabled /> {b.label}</span><strong>{b.percent_value > 0 ? '+' : ''}{b.percent_value}%</strong></label>;
  if (b.type === 'price_percent_select') return (
    <div className="field" style={{ marginTop: 8 }}>
      <label>{b.label}</label>
      <select disabled>{b.options.map((o, i) => <option key={o}>{o} ({(b.option_percents[i] || 0) > 0 ? '+' : ''}{b.option_percents[i] || 0}%)</option>)}</select>
    </div>
  );
  if (b.type === 'total') return <div className="quote-total"><span>{b.label || 'Total estimé'}</span><strong>—</strong></div>;

  if (b.type === 'textarea') return (
    <div className="field" style={{ marginTop: 8 }}>
      <label>{b.label}{b.required && ' *'}</label>
      <textarea placeholder={b.placeholder} disabled />
    </div>
  );
  if (b.type === 'select') return (
    <div className="field" style={{ marginTop: 8 }}>
      <label>{b.label}{b.required && ' *'}</label>
      <select disabled><option>Sélectionner…</option>{b.options.map(o => <option key={o}>{o}</option>)}</select>
    </div>
  );
  if (b.type === 'radio') return (
    <div className="field" style={{ marginTop: 8 }}>
      <label>{b.label}{b.required && ' *'}</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{b.options.map(o => <label key={o}><input type="radio" disabled /> {o}</label>)}</div>
    </div>
  );
  if (b.type === 'checkbox') return (
    <div className="field" style={{ marginTop: 8 }}>
      <label><input type="checkbox" disabled /> {b.label}{b.required && ' *'}</label>
    </div>
  );
  const inputType = ({ email: 'email', tel: 'tel', number: 'number', date: 'date' } as Record<string, string>)[b.type] || 'text';
  return (
    <div className="field" style={{ marginTop: 8 }}>
      <label>{b.label}{b.required && ' *'}</label>
      <input type={inputType} placeholder={b.placeholder} disabled />
    </div>
  );
}

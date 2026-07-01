import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { usePublicQuoteForm, useSubmitQuote } from '@/api/public';
import { useToast } from '@/lib/toast';
import { computeQuoteBreakdown, type RenderableBlock, type QuoteBreakdown } from '@/lib/quote-compute';
import { formatPriceEUR } from '@/lib/format';

const LAYOUT_TYPES = ['heading', 'separator', 'section'];
const FIELD_TYPES = ['text', 'email', 'tel', 'number', 'textarea', 'select', 'radio', 'checkbox', 'date'];
const PRICING_TYPES = ['price_fixed', 'price_option', 'price_select', 'quantity', 'price_percent_option', 'price_percent_select', 'total'];

export function QuoteFormView() {
  const { slug } = useParams({ strict: false }) as { slug: string };
  const q = usePublicQuoteForm(slug);
  const submit = useSubmitQuote(slug);
  const navigate = useNavigate();
  const { push } = useToast();
  const [customer, setCustomer] = useState({ customer_name: '', customer_email: '', customer_phone: '', customer_company: '', notes: '' });
  const [payload, setPayload] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const blocks: RenderableBlock[] = useMemo(() => {
    if (!q.data) return [];
    if (q.data.blocks.length > 0) return q.data.blocks as RenderableBlock[];
    return q.data.fields.map(f => ({ ...f, id: f.name }));
  }, [q.data]);

  const breakdown = useMemo(() => computeQuoteBreakdown(blocks, payload), [blocks, payload]);
  const { baseCents, sumPercents, totalCents } = breakdown;
  const hasPricing = blocks.some(b => PRICING_TYPES.includes(b.type));

  if (q.isLoading) return <div className="loading">Chargement…</div>;
  if (!q.data) return <div className="empty">Formulaire introuvable ou non publié.</div>;
  const form = q.data.form;

  const set = (name: string, value: string) => setPayload(p => ({ ...p, [name]: value }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    submit.mutate({ ...customer, payload }, {
      onSuccess: () => { push('Demande envoyée.', 'success'); navigate({ to: '/devis/$slug/merci', params: { slug } }); },
      onError: (err: any) => setError(err?.message || "Erreur lors de l'envoi."),
    });
  };

  return (
    <div className="row" style={{ gridTemplateColumns: '1.1fr .9fr' }}>
      <div>
        <h1>{form.title}</h1>
        <p>{form.description}</p>
        {form.intro_html && <div className="card rich" dangerouslySetInnerHTML={{ __html: form.intro_html }} />}

        <form onSubmit={onSubmit} className="card">
          <h2>Votre brief</h2>
          <div className="row">
            <div className="field"><label>Nom complet *</label><input required value={customer.customer_name} onChange={e => setCustomer({ ...customer, customer_name: e.target.value })} /></div>
            <div className="field"><label>Société</label><input value={customer.customer_company} onChange={e => setCustomer({ ...customer, customer_company: e.target.value })} /></div>
          </div>
          <div className="row">
            <div className="field"><label>Email *</label><input type="email" required value={customer.customer_email} onChange={e => setCustomer({ ...customer, customer_email: e.target.value })} /></div>
            <div className="field"><label>Téléphone</label><input type="tel" value={customer.customer_phone} onChange={e => setCustomer({ ...customer, customer_phone: e.target.value })} /></div>
          </div>

          {blocks.map(b => (
            <BlockRenderer
              key={b.id}
              block={b}
              value={payload[b.name] || ''}
              onChange={(v) => set(b.name, v)}
              breakdown={breakdown}
            />
          ))}

          <div className="field"><label>Informations complémentaires</label><textarea value={customer.notes} onChange={e => setCustomer({ ...customer, notes: e.target.value })} /></div>

          {hasPricing && (
            <QuoteSummary breakdown={breakdown} title="Récapitulatif détaillé" />
          )}

          {error && <p style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</p>}

          <button className="btn" type="submit" disabled={submit.isPending}>{submit.isPending ? 'Envoi…' : form.cta_label}</button>
        </form>
      </div>

      <aside>
        <div className="card">
          <h3>Pourquoi ce formulaire ?</h3>
          <p className="meta">Pour structurer la demande avant prise de contact. Plus c'est précis, plus la réponse l'est aussi.</p>
        </div>
        {hasPricing && (
          <div className="card sticky-summary" style={{ position: 'sticky', top: 80 }}>
            <h3>Récapitulatif en direct</h3>
            <QuoteSummary breakdown={breakdown} compact />
          </div>
        )}
      </aside>
    </div>
  );
}

function QuoteSummary({ breakdown, title, compact }: { breakdown: QuoteBreakdown; title?: string; compact?: boolean }) {
  const { baseLines, percentLines, baseCents, sumPercents, totalCents } = breakdown;
  const hasItems = baseLines.length > 0 || percentLines.length > 0;
  return (
    <div className={`quote-summary ${compact ? 'quote-summary-compact' : ''}`}>
      {title && !compact && <div className="quote-summary-title">{title}</div>}
      {!hasItems && <div className="quote-line muted"><span>Aucune ligne pour le moment.</span></div>}
      {baseLines.map((line, i) => (
        <div key={`b-${i}`} className="quote-line">
          <span>{line.label}{line.detail && <span className="meta"> · {line.detail}</span>}</span>
          <strong>{formatPriceEUR(line.amountCents || 0)}</strong>
        </div>
      ))}
      {baseLines.length > 0 && (
        <div className="quote-line quote-line-subtotal"><span>Sous-total</span><strong>{formatPriceEUR(baseCents)}</strong></div>
      )}
      {percentLines.map((line, i) => (
        <div key={`p-${i}`} className="quote-line quote-line-percent">
          <span>{line.label}{line.detail && <span className="meta"> · {line.detail}</span>}</span>
          <strong>{(line.percent || 0) > 0 ? '+' : ''}{line.percent || 0}%</strong>
        </div>
      ))}
      {percentLines.length > 0 && (
        <div className="quote-line quote-line-subtotal"><span>Ajustement total</span><strong>{sumPercents > 0 ? '+' : ''}{sumPercents}%</strong></div>
      )}
      <div className="quote-total"><span>{compact ? 'Estimation' : 'Total estimé'}</span><strong>{formatPriceEUR(totalCents)}</strong></div>
      {!compact && (
        <p className="meta" style={{ fontSize: 11.5, marginTop: 6, padding: '0 12px 8px' }}>
          Cette estimation est indicative — votre devis final pourra être ajusté après prise de contact.
        </p>
      )}
    </div>
  );
}

function BlockRenderer({ block: b, value, onChange, breakdown }: {
  block: RenderableBlock;
  value: string;
  onChange: (v: string) => void;
  breakdown: QuoteBreakdown;
}) {
  const cls = `field ${b.css_class || ''}`.trim();
  if (b.type === 'heading') return <h3 style={{ marginTop: 18 }}>{b.label}</h3>;
  if (b.type === 'separator') return <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '14px 0' }} />;
  if (b.type === 'section') return <p style={{ fontWeight: 600, marginTop: 16 }}>{b.label}</p>;

  // Pricing blocks
  if (b.type === 'price_fixed') {
    return (
      <div className="quote-line">
        <span>{b.label}</span>
        <strong>{formatPriceEUR(b.price_cents || 0)}</strong>
      </div>
    );
  }
  if (b.type === 'price_option') {
    const checked = value === '1';
    return (
      <label className="quote-line quote-option">
        <span><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked ? '1' : '')} /> {b.label}</span>
        <strong>+{formatPriceEUR(b.price_cents || 0)}</strong>
      </label>
    );
  }
  if (b.type === 'price_select') {
    return (
      <div className={cls}>
        <label>{b.label}{b.required && ' *'}</label>
        <select required={b.required} value={value} onChange={e => onChange(e.target.value)}>
          <option value="">Choisir…</option>
          {(b.options || []).map((o, i) => (
            <option key={o} value={o}>{o} — {formatPriceEUR((b.option_prices || [])[i] || 0)}</option>
          ))}
        </select>
      </div>
    );
  }
  if (b.type === 'quantity') {
    const n = Number(value || 0);
    const subtotal = Math.round((b.price_cents || 0) * n);
    return (
      <div className={cls}>
        <label>{b.label}{b.required && ' *'}</label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input type="number" min={0} placeholder={b.placeholder || 'Quantité'} value={value} onChange={e => onChange(e.target.value)} required={b.required} style={{ maxWidth: 140 }} />
          <span className="meta">{b.placeholder || 'u'} × {formatPriceEUR(b.price_cents || 0)} = <strong style={{ color: 'var(--text)' }}>{formatPriceEUR(subtotal)}</strong></span>
        </div>
        {b.help_text && <span className="hint">{b.help_text}</span>}
      </div>
    );
  }
  if (b.type === 'price_percent_option') {
    const checked = value === '1';
    return (
      <label className="quote-line quote-option">
        <span><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked ? '1' : '')} /> {b.label}</span>
        <strong>{(b.percent_value || 0) > 0 ? '+' : ''}{b.percent_value || 0}%</strong>
      </label>
    );
  }
  if (b.type === 'price_percent_select') {
    return (
      <div className={cls}>
        <label>{b.label}{b.required && ' *'}</label>
        <select required={b.required} value={value} onChange={e => onChange(e.target.value)}>
          <option value="">Choisir…</option>
          {(b.options || []).map((o, i) => {
            const pct = (b.option_percents || [])[i] || 0;
            return <option key={o} value={o}>{o} ({pct > 0 ? '+' : ''}{pct}%)</option>;
          })}
        </select>
      </div>
    );
  }
  if (b.type === 'total') {
    return (
      <div style={{ marginTop: 18 }}>
        <QuoteSummary breakdown={breakdown} title={b.label || 'Total estimé'} />
      </div>
    );
  }

  // Standard fields
  if (b.type === 'textarea') return (
    <div className={cls}>
      <label>{b.label}{b.required && ' *'}</label>
      <textarea required={b.required} placeholder={b.placeholder} value={value} onChange={e => onChange(e.target.value)} />
      {b.help_text && <span className="hint">{b.help_text}</span>}
    </div>
  );
  if (b.type === 'select') return (
    <div className={cls}>
      <label>{b.label}{b.required && ' *'}</label>
      <select required={b.required} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">Sélectionner</option>
        {(b.options || []).map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
  if (b.type === 'radio') return (
    <div className={cls}>
      <label>{b.label}{b.required && ' *'}</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(b.options || []).map(o => (
          <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="radio" name={b.name} value={o} checked={value === o} onChange={e => onChange(e.target.value)} required={b.required} /> {o}
          </label>
        ))}
      </div>
    </div>
  );
  if (b.type === 'checkbox') return (
    <div className={cls}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={value === '1'} onChange={e => onChange(e.target.checked ? '1' : '')} /> {b.label}{b.required && ' *'}
      </label>
    </div>
  );
  const inputType = ({ email: 'email', tel: 'tel', number: 'number', date: 'date' } as Record<string, string>)[b.type] || 'text';
  return (
    <div className={cls}>
      <label>{b.label}{b.required && ' *'}</label>
      <input type={inputType} required={b.required} placeholder={b.placeholder} value={value} onChange={e => onChange(e.target.value)} />
      {b.help_text && <span className="hint">{b.help_text}</span>}
    </div>
  );
}

export function QuoteThanksPage() {
  const { slug } = useParams({ strict: false }) as { slug: string };
  return (
    <div className="card" style={{ maxWidth: 640, margin: '40px auto', textAlign: 'center' }}>
      <span className="pill">✓ Demande envoyée</span>
      <h1 style={{ marginTop: 14 }}>Merci pour votre demande</h1>
      <p>Nous reviendrons vers vous rapidement avec une proposition adaptée.</p>
      <div className="actions" style={{ justifyContent: 'center', marginTop: 18 }}>
        <Link className="btn" to="/">Retour accueil</Link>
        <Link className="btn secondary" to="/devis/$slug" params={{ slug }}>Renvoyer une demande</Link>
      </div>
    </div>
  );
}

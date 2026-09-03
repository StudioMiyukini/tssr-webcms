import { useEffect, useRef, useState } from 'react';
import { sanitizeHtml } from '@/lib/sanitize';

/**
 * Lecteur « pages » : affiche une page (section) à la fois, avec ◀ Précédent / Suivant ▶,
 * un menu déroulant des sections (ou des pastilles si peu de pages) et le compteur « i / n ».
 * TOUTES les pages sont rendues dans le DOM (masquées via display) → l'impression PDF les
 * garde toutes. Le HTML des pages est capturé par RichContent avant l'hydratation.
 * Îlots : data-block="doc-pager" (sections, avec labels) et data-block="wizard-pager".
 */
/*
 * @id     tssr.compWizardPager
 * @do     paginer_assistant
 * @role   ui
 * @layer  ui
 * @human  Pagination d'un assistant multi-étapes.
 */
export function WizardPager({ slides = [], labels = [], title = '' }: { slides?: string[]; labels?: string[]; title?: string }) {
  const [i, setI] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);
  const n = slides.length;
  const hasLabels = labels.length === n && n > 0;
  const clamp = (x: number) => Math.min(n - 1, Math.max(0, x));
  const go = (d: number) => setI(x => clamp(x + d));

  useEffect(() => { topRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }); }, [i]);
  if (!n) return null;

  const nav = (bottom = false) => (
    <div className="wzp-nav" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '10px 14px', borderTop: bottom ? '1px solid var(--border)' : 'none', borderBottom: bottom ? 'none' : '1px solid var(--border)', background: 'var(--surface-2)' }}>
      <button type="button" disabled={i === 0} onClick={() => go(-1)} style={pBtn(i > 0)}>◀ Précédent</button>
      {hasLabels
        ? <select value={i} onChange={e => setI(Number(e.target.value))} style={{ flex: 1, minWidth: 140, maxWidth: 340, padding: '7px 9px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>
            {labels.map((l, k) => <option key={k} value={k}>{k + 1}. {l}</option>)}
          </select>
        : <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1, justifyContent: 'center' }}>
            {slides.map((_, k) => <button key={k} type="button" aria-label={`Page ${k + 1}`} onClick={() => setI(k)} style={{ width: 12, height: 12, borderRadius: '50%', padding: 0, cursor: 'pointer', border: '1px solid var(--accent)', background: k === i ? 'var(--accent)' : 'transparent' }} />)}
          </div>}
      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap' }}>{i + 1} / {n}</span>
      <button type="button" disabled={i === n - 1} onClick={() => go(1)} style={pBtn(i < n - 1)}>Suivant ▶</button>
    </div>
  );

  return (
    <div ref={topRef} className="wzp" tabIndex={0} onKeyDown={e => { if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); }}
      style={{ margin: '14px 0 18px', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)', scrollMarginTop: 70 }}>
      {(title || hasLabels) && (
        <div className="wzp-head" style={{ padding: '10px 14px', fontWeight: 800, fontSize: 15, borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          {title && <span>{title} · </span>}{hasLabels && <span style={{ color: 'var(--accent)' }}>{labels[i]}</span>}
        </div>
      )}
      {nav(false)}
      {slides.map((h, k) => <div key={k} className="dp-page" style={{ display: k === i ? 'block' : 'none', padding: '8px 14px 16px' }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(h) }} />)}
      {nav(true)}
    </div>
  );
}

const pBtn = (on: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 15px', borderRadius: 9,
  border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent)' : 'var(--surface-2)',
  color: on ? '#fff' : 'var(--text-muted)', fontWeight: 700, fontSize: 13.5, cursor: on ? 'pointer' : 'default', whiteSpace: 'nowrap',
});

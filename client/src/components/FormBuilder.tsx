import { useState } from 'react';
import { FORM_FIELD_TYPES, FORM_OPTION_TYPES, type FormField, type FormFieldType } from '@shared/types';

let counter = 0;
const uid = () => { counter += 1; return `f-${Date.now()}-${counter}`; };
const LABELS = Object.fromEntries(FORM_FIELD_TYPES.map(t => [t.type, t.label])) as Record<FormFieldType, string>;

export function makeFormField(type: FormFieldType): FormField {
  counter += 1;
  return {
    id: uid(), type,
    name: type === 'heading' ? '' : `champ_${counter}`,
    label: type === 'heading' ? 'Titre de section' : 'Question',
    required: type !== 'heading',
    placeholder: '', help: '',
    options: FORM_OPTION_TYPES.includes(type) ? ['Option 1', 'Option 2'] : [],
  };
}

export function normalizeFormFields(json: string): FormField[] {
  try {
    const a = JSON.parse(json || '[]');
    if (!Array.isArray(a)) return [];
    const types = FORM_FIELD_TYPES.map(t => t.type);
    return a.map((f: any): FormField => ({
      id: f?.id || uid(),
      type: types.includes(f?.type) ? f.type : 'text',
      name: f?.name || '',
      label: f?.label || '',
      required: !!f?.required,
      placeholder: f?.placeholder || '',
      help: f?.help || '',
      options: Array.isArray(f?.options) ? f.options.map(String) : [],
    }));
  } catch { return []; }
}

export function FormBuilder({ fields, onChange }: { fields: FormField[]; onChange: (f: FormField[]) => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const update = (id: string, patch: Partial<FormField>) => onChange(fields.map(f => f.id === id ? { ...f, ...patch } : f));
  const remove = (id: string) => { if (confirm('Supprimer ce champ ?')) onChange(fields.filter(f => f.id !== id)); };
  const move = (id: string, dir: -1 | 1) => {
    const i = fields.findIndex(f => f.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= fields.length) return;
    const next = [...fields]; [next[i], next[j]] = [next[j], next[i]]; onChange(next);
  };
  const add = (type: FormFieldType) => { const f = makeFormField(type); onChange([...fields, f]); setOpenId(f.id); };

  return (
    <div className="block-editor">
      <aside className="block-palette">
        <div className="palette-title">Ajouter un champ</div>
        {FORM_FIELD_TYPES.map(t => (
          <button key={t.type} type="button" className="palette-btn" onClick={() => add(t.type)}>
            <span className="palette-icon">{t.icon}</span> {t.label}
          </button>
        ))}
        <div className="palette-help">Le « nom technique » sert de clé dans les réponses — garde-le unique et stable.</div>
      </aside>

      <div className="block-canvas">
        {fields.length === 0 ? (
          <div className="block-empty"><p>Aucun champ.</p><p className="meta">Ajoute un champ depuis la palette.</p></div>
        ) : fields.map((f, idx) => {
          const isOpen = openId === f.id;
          const hasOptions = FORM_OPTION_TYPES.includes(f.type);
          return (
            <div key={f.id} className={`block-item ${isOpen ? 'open' : ''}`}>
              <header className="block-header" onClick={() => setOpenId(isOpen ? null : f.id)}>
                <span className="block-type-badge">{LABELS[f.type]}</span>
                <span className="block-label">{f.label || '(sans libellé)'}{f.required && f.type !== 'heading' ? ' *' : ''}</span>
                <div className="block-actions">
                  <button type="button" title="Monter" onClick={(e) => { e.stopPropagation(); move(f.id, -1); }} disabled={idx === 0}>↑</button>
                  <button type="button" title="Descendre" onClick={(e) => { e.stopPropagation(); move(f.id, 1); }} disabled={idx === fields.length - 1}>↓</button>
                  <button type="button" className="danger" title="Supprimer" onClick={(e) => { e.stopPropagation(); remove(f.id); }}>✕</button>
                </div>
              </header>
              {isOpen && (
                <div className="block-body">
                  <div className="block-row">
                    <div className="field"><label>Libellé</label><input value={f.label} onChange={e => update(f.id, { label: e.target.value })} /></div>
                    {f.type !== 'heading' && <div className="field"><label>Nom technique</label><input value={f.name} onChange={e => update(f.id, { name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '_') })} placeholder="ex: email" /></div>}
                  </div>
                  {f.type !== 'heading' && (
                    <div className="block-row">
                      <label className="block-checkbox"><input type="checkbox" checked={f.required} onChange={e => update(f.id, { required: e.target.checked })} /> Obligatoire</label>
                      {(f.type === 'text' || f.type === 'textarea' || f.type === 'email' || f.type === 'tel' || f.type === 'number') &&
                        <div className="field"><label>Placeholder</label><input value={f.placeholder} onChange={e => update(f.id, { placeholder: e.target.value })} /></div>}
                    </div>
                  )}
                  {hasOptions && <OptionsEditor options={f.options} onChange={options => update(f.id, { options })} />}
                  {f.type !== 'heading' && <div className="field"><label>Texte d'aide (optionnel)</label><input value={f.help} onChange={e => update(f.id, { help: e.target.value })} /></div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OptionsEditor({ options, onChange }: { options: string[]; onChange: (o: string[]) => void }) {
  return (
    <div className="field">
      <label>Options</label>
      <div className="options-editor">
        {options.map((opt, i) => (
          <div key={i} className="option-row">
            <input value={opt} onChange={e => onChange(options.map((o, j) => j === i ? e.target.value : o))} />
            <button type="button" className="btn danger small" onClick={() => onChange(options.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button type="button" className="btn secondary small" onClick={() => onChange([...options, `Option ${options.length + 1}`])}>+ Ajouter une option</button>
      </div>
    </div>
  );
}

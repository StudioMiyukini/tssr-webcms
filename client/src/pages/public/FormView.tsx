import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { usePublicForm, useSubmitForm } from '@/api/public';
import type { FormField } from '@shared/types';
import { ApiError } from '@/api/client';

export function FormPage() {
  const { slug } = useParams({ strict: false }) as { slug: string };
  const q = usePublicForm(slug);
  const submit = useSubmitForm(slug);
  const [payload, setPayload] = useState<Record<string, unknown>>({});
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (q.isLoading) return <div className="loading">Chargement…</div>;
  if (q.isError || !q.data) return <div className="empty">Formulaire introuvable ou indisponible.</div>;
  const form = q.data;

  if (done) return (
    <article className="card rich" style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1>{form.title}</h1>
      <p>{done}</p>
    </article>
  );

  const set = (name: string, value: unknown) => setPayload(p => ({ ...p, [name]: value }));
  const toggle = (name: string, opt: string) => setPayload(p => {
    const cur = Array.isArray(p[name]) ? (p[name] as string[]) : [];
    return { ...p, [name]: cur.includes(opt) ? cur.filter(x => x !== opt) : [...cur, opt] };
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    submit.mutate(payload, {
      onSuccess: (r) => setDone(r.success_message),
      onError: (err) => setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.'),
    });
  };

  return (
    <article className="card rich" style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1>{form.title}</h1>
      {form.description && <p className="meta" style={{ marginBottom: 16 }}>{form.description}</p>}
      <form onSubmit={onSubmit}>
        {form.fields.map(f => <FieldInput key={f.id} f={f} value={payload[f.name]} onChange={set} onToggle={toggle} />)}
        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
        <button className="btn" type="submit" disabled={submit.isPending}>{submit.isPending ? 'Envoi…' : 'Envoyer'}</button>
      </form>
    </article>
  );
}

function FieldInput({ f, value, onChange, onToggle }: {
  f: FormField; value: unknown;
  onChange: (name: string, value: unknown) => void;
  onToggle: (name: string, opt: string) => void;
}) {
  if (f.type === 'heading') return <h2 style={{ marginTop: 18 }}>{f.label}</h2>;
  const v = value == null ? '' : value;
  const lab = <label>{f.label}{f.required ? ' *' : ''}</label>;
  const help = f.help ? <span className="hint">{f.help}</span> : null;

  if (f.type === 'textarea') return <div className="field">{lab}<textarea value={String(v)} required={f.required} placeholder={f.placeholder} onChange={e => onChange(f.name, e.target.value)} />{help}</div>;
  if (f.type === 'select') return (
    <div className="field">{lab}
      <select value={String(v)} required={f.required} onChange={e => onChange(f.name, e.target.value)}>
        <option value="">— Choisir —</option>
        {f.options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>{help}
    </div>
  );
  if (f.type === 'radio') return (
    <div className="field">{lab}
      <div className="form-choices">
        {f.options.map(o => <label key={o} className="form-choice"><input type="radio" name={f.name} checked={v === o} required={f.required} onChange={() => onChange(f.name, o)} /> {o}</label>)}
      </div>{help}
    </div>
  );
  if (f.type === 'checkbox') {
    const arr = Array.isArray(value) ? value as string[] : [];
    return (
      <div className="field">{lab}
        <div className="form-choices">
          {f.options.map(o => <label key={o} className="form-choice"><input type="checkbox" checked={arr.includes(o)} onChange={() => onToggle(f.name, o)} /> {o}</label>)}
        </div>{help}
      </div>
    );
  }
  const inputType = ({ email: 'email', tel: 'tel', number: 'number', date: 'date' } as Record<string, string>)[f.type] || 'text';
  return <div className="field">{lab}<input type={inputType} value={String(v)} required={f.required} placeholder={f.placeholder} onChange={e => onChange(f.name, e.target.value)} />{help}</div>;
}

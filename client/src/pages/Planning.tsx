import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { Plannings } from '@/api/hooks';
import { useToast } from '@/lib/toast';
import { PLANNING_COLORS, type PlanningInput, type PlanningRow, type PlanningLegendItem } from '@shared/types';
import { PlanningTable } from '@/components/PlanningTable';

export function PlanningListPage() {
  const list = Plannings.useList();
  const del = Plannings.useDelete();
  const { push } = useToast();
  return (
    <>
      <div className="topbar-row">
        <div><h1>Planning</h1><p>Grilles type emploi du temps, affichées sur <code>/planning</code>.</p></div>
        <Link className="btn" to="/admin/plannings/new">＋ Nouveau planning</Link>
      </div>
      <div className="card">
        {list.isLoading && <div className="loading">Chargement…</div>}
        {list.data && list.data.length === 0 && <div className="empty">Aucun planning. <Link to="/admin/plannings/new">Créer le premier</Link></div>}
        {list.data && list.data.length > 0 && (
          <table className="wp-list">
            <thead><tr><th className="column-primary">Planning</th><th>Lignes</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>
              {list.data.map(p => (
                <tr key={p.id}>
                  <td className="column-primary">{p.title}<div className="meta">{[p.section, p.period].filter(Boolean).join(' · ') || <code>/planning</code>}</div></td>
                  <td data-label="Lignes">{p.rows.length}</td>
                  <td data-label="Statut"><span className={`status-badge ${p.published ? 'published' : 'draft'}`}>{p.published ? 'Publié' : 'Brouillon'}</span></td>
                  <td className="actions" data-label="Actions">
                    <Link className="btn small" to="/admin/plannings/$id/edit" params={{ id: String(p.id) }}>Modifier</Link>{' '}
                    <button className="btn danger small" onClick={() => { if (confirm('Supprimer ce planning ?')) del.mutate(p.id, { onSuccess: () => push('Planning supprimé.', 'success') }); }}>Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

const EMPTY: PlanningInput = { title: '', slug: '', section: '', period: '', columns: 4, legend: [], rows: [], published: 1, sort_order: 0 };
const emptyRow = (cols: number): PlanningRow => ({ weekday: '', day: '', weekend: false, cells: Array.from({ length: cols }, () => ({ text: '', color: '' })) });

export function PlanningEditPage() {
  const params = useParams({ strict: false }) as { id?: string };
  const navigate = useNavigate();
  const { push } = useToast();
  const id = params.id ? Number(params.id) : null;
  const existing = Plannings.useOne(id);
  const create = Plannings.useCreate();
  const update = Plannings.useUpdate();
  const [form, setForm] = useState<PlanningInput>(EMPTY);

  useEffect(() => {
    if (existing.data) {
      const d = existing.data;
      setForm({ title: d.title, slug: d.slug, section: d.section, period: d.period, columns: d.columns, legend: d.legend, rows: d.rows, published: d.published, sort_order: d.sort_order });
    }
  }, [existing.data]);

  const set = (patch: Partial<PlanningInput>) => setForm(f => ({ ...f, ...patch }));
  const setColumns = (n: number) => setForm(f => ({
    ...f, columns: n,
    rows: f.rows.map(r => ({ ...r, cells: Array.from({ length: n }, (_, i) => r.cells[i] ?? { text: '', color: '' }) })),
  }));
  const setRow = (i: number, patch: Partial<PlanningRow>) => setForm(f => ({ ...f, rows: f.rows.map((r, j) => j === i ? { ...r, ...patch } : r) }));
  const setCell = (ri: number, ci: number, patch: Partial<{ text: string; color: string }>) =>
    setForm(f => ({ ...f, rows: f.rows.map((r, j) => j === ri ? { ...r, cells: r.cells.map((c, k) => k === ci ? { ...c, ...patch } : c) } : r) }));
  const moveRow = (i: number, dir: -1 | 1) => setForm(f => { const j = i + dir; if (j < 0 || j >= f.rows.length) return f; const rows = [...f.rows]; [rows[i], rows[j]] = [rows[j], rows[i]]; return { ...f, rows }; });

  const setLegend = (legend: PlanningLegendItem[]) => set({ legend });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { push('Le titre est requis.', 'error'); return; }
    if (id) update.mutate({ id, data: form }, { onSuccess: () => { push('Planning mis à jour.', 'success'); navigate({ to: '/admin/plannings' }); } });
    else create.mutate(form, { onSuccess: () => { push('Planning créé.', 'success'); navigate({ to: '/admin/plannings' }); } });
  };

  if (id && existing.isLoading) return <div className="loading">Chargement…</div>;

  return (
    <form onSubmit={onSubmit}>
      <div className="topbar-row">
        <div><h1>{id ? 'Modifier le planning' : 'Nouveau planning'}</h1></div>
        <div className="actions">
          <Link className="btn secondary" to="/admin/plannings">← Retour</Link>
          <button className="btn" type="submit" disabled={create.isPending || update.isPending}>{(create.isPending || update.isPending) ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </div>

      <div className="card">
        <div className="row">
          <div className="field"><label>Titre *</label><input value={form.title} onChange={e => set({ title: e.target.value })} placeholder="ex: TSSR ERN 26-02 LIM" required /></div>
          <div className="field"><label>Slug</label><input value={form.slug} onChange={e => set({ slug: e.target.value })} placeholder="auto si vide" /></div>
        </div>
        <div className="row">
          <div className="field"><label>Section (en-tête)</label><input value={form.section} onChange={e => set({ section: e.target.value })} placeholder="ex: INFRA" /></div>
          <div className="field"><label>Période</label><input value={form.period} onChange={e => set({ period: e.target.value })} placeholder="ex: JUIN" /></div>
        </div>
        <div className="row">
          <div className="field"><label>Colonnes (créneaux par jour)</label>
            <select value={form.columns} onChange={e => setColumns(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="field"><label>Ordre</label><input type="number" value={form.sort_order} onChange={e => set({ sort_order: Number(e.target.value) })} /></div>
          <div className="field"><label>Statut</label>
            <select value={form.published} onChange={e => set({ published: Number(e.target.value) })}><option value={1}>Publié</option><option value={0}>Brouillon</option></select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="topbar-row"><h2 style={{ margin: 0 }}>Lignes (jours)</h2>
          <button type="button" className="btn secondary small" onClick={() => set({ rows: [...form.rows, emptyRow(form.columns)] })}>＋ Ajouter une ligne</button>
        </div>
        {form.rows.length === 0 && <p className="meta">Aucune ligne. Ajoute des jours et remplis les cellules.</p>}
        <div className="planning-editor">
          {form.rows.map((row, ri) => (
            <div key={ri} className="planning-edit-row">
              <div className="planning-edit-day">
                <input className="planning-edit-wd" value={row.weekday} onChange={e => setRow(ri, { weekday: e.target.value })} placeholder="J" title="Jour (lettre)" />
                <input className="planning-edit-dn" value={row.day} onChange={e => setRow(ri, { day: e.target.value })} placeholder="4" title="Date" />
                <label className="planning-edit-we" title="Week-end / grisé"><input type="checkbox" checked={row.weekend} onChange={e => setRow(ri, { weekend: e.target.checked })} /> WE</label>
              </div>
              <div className="planning-edit-cells">
                {row.cells.map((cell, ci) => (
                  <div key={ci} className="planning-edit-cell">
                    <input value={cell.text} onChange={e => setCell(ri, ci, { text: e.target.value })} placeholder="—" />
                    <select value={cell.color} onChange={e => setCell(ri, ci, { color: e.target.value })} title="Couleur">
                      {PLANNING_COLORS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div className="planning-edit-actions">
                <button type="button" className="btn secondary small" onClick={() => moveRow(ri, -1)} disabled={ri === 0}>↑</button>
                <button type="button" className="btn secondary small" onClick={() => moveRow(ri, 1)} disabled={ri === form.rows.length - 1}>↓</button>
                <button type="button" className="btn danger small" onClick={() => set({ rows: form.rows.filter((_, j) => j !== ri) })}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="topbar-row"><h2 style={{ margin: 0 }}>Légende</h2>
          <button type="button" className="btn secondary small" onClick={() => setLegend([...form.legend, { label: '', color: 'blue' }])}>＋ Ajouter</button>
        </div>
        <div className="options-editor">
          {form.legend.map((l, i) => (
            <div key={i} className="option-row option-row-priced">
              <input value={l.label} placeholder="Libellé (ex: LIM = formateur)" onChange={e => setLegend(form.legend.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
              <select value={l.color} onChange={e => setLegend(form.legend.map((x, j) => j === i ? { ...x, color: e.target.value } : x))}>
                {PLANNING_COLORS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <button type="button" className="btn danger small" onClick={() => setLegend(form.legend.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Aperçu</h2>
        <PlanningTable planning={{ id: 0, slug: '', columns: form.columns, title: form.title || 'Sans titre', section: form.section, period: form.period, legend: form.legend, rows: form.rows, published: form.published, sort_order: form.sort_order }} />
      </div>
    </form>
  );
}

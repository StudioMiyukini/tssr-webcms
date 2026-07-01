import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import {
  Menus, Coupons, Shipping, QuoteForms,
  useQuoteSubmissions, useQuoteSubmission, useDeleteQuoteSubmission,
  type MenuInput, type CouponInput, type ShippingInput, type QuoteFormInput,
} from '@/api/hooks';
import { formatPriceEUR, formatDate } from '@/lib/format';
import { useToast } from '@/lib/toast';
import { BlockEditor } from '@/components/BlockEditor';

// ============== MENUS ==============
export function MenusListPage() {
  const list = Menus.useList();
  const del = Menus.useDelete();
  const { push } = useToast();
  return (
    <>
      <div className="topbar-row"><div><h1>Menus</h1><p>Liens de navigation publique.</p></div><Link className="btn" to="/admin/menus/new">＋ Ajouter un lien</Link></div>
      <div className="card">
        {list.isLoading && <div className="loading">Chargement…</div>}
        {list.isError && <div className="empty">Erreur de chargement. Réessaie.</div>}
        {list.data && list.data.length === 0 && <div className="empty">Aucun lien.</div>}
        {list.data && list.data.length > 0 && (
          <table className="wp-list">
            <thead><tr><th className="column-primary">Libellé</th><th>URL</th><th>Ordre</th><th>Actions</th></tr></thead>
            <tbody>{list.data.map(m => (
              <tr key={m.id}><td className="column-primary">{m.label}</td><td data-label="URL"><code>{m.url}</code></td><td data-label="Ordre">{m.sort_order}</td>
                <td className="actions" data-label="Actions"><Link className="btn small" to="/admin/menus/$id/edit" params={{ id: String(m.id) }}>Modifier</Link>{' '}
                  <button className="btn danger small" onClick={() => { if (confirm('Supprimer ?')) del.mutate(m.id, { onSuccess: () => push('Lien supprimé.', 'success') }); }}>Supprimer</button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </>
  );
}

export function MenuEditPage() {
  const params = useParams({ strict: false }) as { id?: string };
  const navigate = useNavigate();
  const { push } = useToast();
  const id = params.id ? Number(params.id) : null;
  const existing = Menus.useOne(id);
  const create = Menus.useCreate();
  const update = Menus.useUpdate();
  const [form, setForm] = useState<MenuInput>({ label: '', url: '', sort_order: 0 });
  useEffect(() => { if (existing.data) setForm(existing.data); }, [existing.data]);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cb = { onSuccess: () => { push('Enregistré.', 'success'); navigate({ to: "/admin/menus" }); } };
    if (id) update.mutate({ id, data: form }, cb); else create.mutate(form, cb);
  };
  if (id && existing.isLoading) return <div className="loading">Chargement…</div>;
  return (
    <form onSubmit={submit}>
      <div className="topbar-row"><div><h1>{id ? 'Modifier' : 'Nouveau'} lien menu</h1></div><div className="actions"><Link className="btn secondary" to="/admin/menus">← Retour</Link><button className="btn" type="submit">Enregistrer</button></div></div>
      <div className="card">
        <div className="field"><label>Libellé *</label><input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} required /></div>
        <div className="field"><label>URL *</label><input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="/pages/ma-page" required /></div>
        <div className="field"><label>Ordre</label><input type="number" value={form.sort_order ?? 0} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
      </div>
    </form>
  );
}

// ============== COUPONS ==============
export function CouponsListPage() {
  const list = Coupons.useList();
  const del = Coupons.useDelete();
  const { push } = useToast();
  return (
    <>
      <div className="topbar-row"><div><h1>Coupons</h1><p>Réductions fixes ou en pourcentage.</p></div><Link className="btn" to="/admin/coupons/new">＋ Créer un coupon</Link></div>
      <div className="card">
        {list.isLoading && <div className="loading">Chargement…</div>}
        {list.isError && <div className="empty">Erreur de chargement. Réessaie.</div>}
        {list.data && list.data.length === 0 && <div className="empty">Aucun coupon.</div>}
        {list.data && list.data.length > 0 && (
          <table className="wp-list">
            <thead><tr><th className="column-primary">Code</th><th>Type</th><th>Valeur</th><th>Min</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>{list.data.map(c => (
              <tr key={c.id}><td className="column-primary">{c.code}<div className="meta">{c.label}</div></td><td data-label="Type">{c.discount_type}</td>
                <td data-label="Valeur">{c.discount_type === 'percent' ? `${c.discount_value}%` : formatPriceEUR(c.discount_value)}</td>
                <td data-label="Min">{formatPriceEUR(c.min_subtotal_cents)}</td><td data-label="Statut">{c.active ? <span className="status-badge active">Actif</span> : <span className="status-badge inactif">Inactif</span>}</td>
                <td className="actions" data-label="Actions"><Link className="btn small" to="/admin/coupons/$id/edit" params={{ id: String(c.id) }}>Modifier</Link>{' '}
                  <button className="btn danger small" onClick={() => { if (confirm('Supprimer ?')) del.mutate(c.id, { onSuccess: () => push('Supprimé.', 'success') }); }}>Supprimer</button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </>
  );
}

export function CouponEditPage() {
  const params = useParams({ strict: false }) as { id?: string };
  const navigate = useNavigate();
  const { push } = useToast();
  const id = params.id ? Number(params.id) : null;
  const existing = Coupons.useOne(id);
  const create = Coupons.useCreate();
  const update = Coupons.useUpdate();
  const [form, setForm] = useState<CouponInput>({ code: '', label: '', discount_type: 'percent', discount_value: 0, min_subtotal_cents: 0, active: 1 });
  useEffect(() => { if (existing.data) setForm(existing.data); }, [existing.data]);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cb = { onSuccess: () => { push('Enregistré.', 'success'); navigate({ to: "/admin/coupons" }); } };
    if (id) update.mutate({ id, data: form }, cb); else create.mutate(form, cb);
  };
  if (id && existing.isLoading) return <div className="loading">Chargement…</div>;
  return (
    <form onSubmit={submit}>
      <div className="topbar-row"><div><h1>{id ? 'Modifier' : 'Nouveau'} coupon</h1></div><div className="actions"><Link className="btn secondary" to="/admin/coupons">← Retour</Link><button className="btn" type="submit">Enregistrer</button></div></div>
      <div className="card">
        <div className="row">
          <div className="field"><label>Code *</label><input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} required /></div>
          <div className="field"><label>Label</label><input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} /></div>
        </div>
        <div className="row">
          <div className="field"><label>Type</label><select value={form.discount_type} onChange={e => setForm({ ...form, discount_type: e.target.value as 'percent' | 'fixed' })}><option value="percent">Pourcentage</option><option value="fixed">Montant fixe (centimes)</option></select></div>
          <div className="field"><label>Valeur</label><input type="number" value={form.discount_value ?? 0} onChange={e => setForm({ ...form, discount_value: Number(e.target.value) })} /></div>
        </div>
        <div className="row">
          <div className="field"><label>Minimum panier (centimes)</label><input type="number" value={form.min_subtotal_cents ?? 0} onChange={e => setForm({ ...form, min_subtotal_cents: Number(e.target.value) })} /></div>
          <div className="field"><label>Actif</label><select value={form.active} onChange={e => setForm({ ...form, active: Number(e.target.value) })}><option value={1}>Oui</option><option value={0}>Non</option></select></div>
        </div>
      </div>
    </form>
  );
}

// ============== SHIPPING ==============
export function ShippingListPage() {
  const list = Shipping.useList();
  const del = Shipping.useDelete();
  const { push } = useToast();
  return (
    <>
      <div className="topbar-row"><div><h1>Livraison</h1><p>Modes de livraison et seuils de gratuité.</p></div><Link className="btn" to="/admin/shipping/new">＋ Ajouter</Link></div>
      <div className="card">
        {list.isLoading && <div className="loading">Chargement…</div>}
        {list.isError && <div className="empty">Erreur de chargement. Réessaie.</div>}
        {list.data && list.data.length === 0 && <div className="empty">Aucun mode.</div>}
        {list.data && list.data.length > 0 && (
          <table className="wp-list">
            <thead><tr><th className="column-primary">Nom</th><th>Prix</th><th>Franco</th><th>Ordre</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>{list.data.map(m => (
              <tr key={m.id}><td className="column-primary">{m.name}<div className="meta">{m.description}</div></td><td data-label="Prix">{formatPriceEUR(m.price_cents)}</td>
                <td data-label="Franco">{m.free_from_cents ? formatPriceEUR(m.free_from_cents) : '—'}</td><td data-label="Ordre">{m.sort_order}</td>
                <td data-label="Statut">{m.active ? <span className="status-badge active">Actif</span> : <span className="status-badge inactif">Inactif</span>}</td>
                <td className="actions" data-label="Actions"><Link className="btn small" to="/admin/shipping/$id/edit" params={{ id: String(m.id) }}>Modifier</Link>{' '}
                  <button className="btn danger small" onClick={() => { if (confirm('Supprimer ?')) del.mutate(m.id, { onSuccess: () => push('Supprimé.', 'success') }); }}>Supprimer</button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </>
  );
}

export function ShippingEditPage() {
  const params = useParams({ strict: false }) as { id?: string };
  const navigate = useNavigate();
  const { push } = useToast();
  const id = params.id ? Number(params.id) : null;
  const existing = Shipping.useOne(id);
  const create = Shipping.useCreate();
  const update = Shipping.useUpdate();
  const [form, setForm] = useState<ShippingInput>({ name: '', description: '', price_cents: 0, free_from_cents: 0, active: 1, sort_order: 0 });
  useEffect(() => { if (existing.data) setForm(existing.data); }, [existing.data]);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cb = { onSuccess: () => { push('Enregistré.', 'success'); navigate({ to: "/admin/shipping" }); } };
    if (id) update.mutate({ id, data: form }, cb); else create.mutate(form, cb);
  };
  if (id && existing.isLoading) return <div className="loading">Chargement…</div>;
  return (
    <form onSubmit={submit}>
      <div className="topbar-row"><div><h1>{id ? 'Modifier' : 'Nouveau'} mode de livraison</h1></div><div className="actions"><Link className="btn secondary" to="/admin/shipping">← Retour</Link><button className="btn" type="submit">Enregistrer</button></div></div>
      <div className="card">
        <div className="field"><label>Nom *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
        <div className="field"><label>Description</label><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        <div className="row">
          <div className="field"><label>Prix (centimes)</label><input type="number" value={form.price_cents ?? 0} onChange={e => setForm({ ...form, price_cents: Number(e.target.value) })} /></div>
          <div className="field"><label>Gratuit dès (centimes)</label><input type="number" value={form.free_from_cents ?? 0} onChange={e => setForm({ ...form, free_from_cents: Number(e.target.value) })} /></div>
        </div>
        <div className="row">
          <div className="field"><label>Ordre</label><input type="number" value={form.sort_order ?? 0} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
          <div className="field"><label>Actif</label><select value={form.active} onChange={e => setForm({ ...form, active: Number(e.target.value) })}><option value={1}>Oui</option><option value={0}>Non</option></select></div>
        </div>
      </div>
    </form>
  );
}

// ============== QUOTE FORMS ==============
export function QuoteFormsListPage() {
  const list = QuoteForms.useList();
  const del = QuoteForms.useDelete();
  const { push } = useToast();
  return (
    <>
      <div className="topbar-row"><div><h1>Formulaires de devis</h1><p>Builder Google Forms-like.</p></div><Link className="btn" to="/admin/quote-forms/new">＋ Créer</Link></div>
      <div className="card">
        {list.isLoading && <div className="loading">Chargement…</div>}
        {list.isError && <div className="empty">Erreur de chargement. Réessaie.</div>}
        {list.data && list.data.length === 0 && <div className="empty">Aucun formulaire.</div>}
        {list.data && list.data.length > 0 && (
          <table className="wp-list">
            <thead><tr><th className="column-primary">Titre</th><th>Slug</th><th>Statut</th><th>Demandes</th><th>Actions</th></tr></thead>
            <tbody>{list.data.map(f => (
              <tr key={f.id}><td className="column-primary">{f.title}</td><td data-label="Slug"><code>{f.slug}</code></td>
                <td data-label="Statut">{f.published ? <span className="status-badge published">Publié</span> : <span className="status-badge draft">Brouillon</span>}</td>
                <td data-label="Demandes">{f.submissions_count}</td>
                <td className="actions" data-label="Actions"><Link className="btn small" to="/admin/quote-forms/$id/edit" params={{ id: String(f.id) }}>Modifier</Link>{' '}
                  <a className="btn secondary small" href={`/devis/${f.slug}`} target="_blank" rel="noreferrer">Voir</a>{' '}
                  <button className="btn danger small" onClick={() => { if (confirm('Supprimer ?')) del.mutate(f.id, { onSuccess: () => push('Supprimé.', 'success') }); }}>Supprimer</button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </>
  );
}

const EMPTY_QF: QuoteFormInput = { title: '', slug: '', description: '', intro_html: '', cta_label: 'Envoyer ma demande', success_message: 'Votre demande a bien été envoyée.', recipient_email: '', fields_json: '[]', blocks_json: '[]', published: 1 };

export function QuoteFormEditPage() {
  const params = useParams({ strict: false }) as { id?: string };
  const navigate = useNavigate();
  const { push } = useToast();
  const id = params.id ? Number(params.id) : null;
  const existing = QuoteForms.useOne(id);
  const create = QuoteForms.useCreate();
  const update = QuoteForms.useUpdate();
  const [form, setForm] = useState<QuoteFormInput>(EMPTY_QF);
  useEffect(() => { if (existing.data) setForm(existing.data); }, [existing.data]);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cb = { onSuccess: () => { push('Enregistré.', 'success'); navigate({ to: "/admin/quote-forms" }); } };
    if (id) update.mutate({ id, data: form }, cb); else create.mutate(form, cb);
  };
  if (id && existing.isLoading) return <div className="loading">Chargement…</div>;
  return (
    <form onSubmit={submit}>
      <div className="topbar-row"><div><h1>{id ? 'Modifier' : 'Nouveau'} formulaire devis</h1></div><div className="actions"><Link className="btn secondary" to="/admin/quote-forms">← Retour</Link><button className="btn" type="submit">Enregistrer</button></div></div>
      <div className="card">
        <div className="row">
          <div className="field"><label>Titre *</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
          <div className="field"><label>Slug</label><input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} /></div>
        </div>
        <div className="field"><label>Email destinataire</label><input type="email" value={form.recipient_email} onChange={e => setForm({ ...form, recipient_email: e.target.value })} /></div>
        <div className="field"><label>Description</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ minHeight: 70 }} /></div>
        <div className="field"><label>Intro HTML</label><textarea value={form.intro_html} onChange={e => setForm({ ...form, intro_html: e.target.value })} style={{ minHeight: 70 }} /></div>
        <div className="row">
          <div className="field"><label>Label CTA</label><input value={form.cta_label} onChange={e => setForm({ ...form, cta_label: e.target.value })} /></div>
          <div className="field"><label>Message succès</label><input value={form.success_message} onChange={e => setForm({ ...form, success_message: e.target.value })} /></div>
        </div>
        <div className="field"><label>Statut</label><select value={form.published} onChange={e => setForm({ ...form, published: Number(e.target.value) })}><option value={1}>Publié</option><option value={0}>Brouillon</option></select></div>
      </div>

      <div className="card">
        <div className="section-head" style={{ marginBottom: 14 }}>
          <div>
            <h2 style={{ borderBottom: 'none', padding: 0, marginBottom: 4 }}>Blocs du formulaire</h2>
            <p className="meta" style={{ margin: 0 }}>Construis ton formulaire bloc par bloc. Les visiteurs verront exactement ce que tu composes ici, dans l'ordre affiché.</p>
          </div>
          <details style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            <summary style={{ cursor: 'pointer' }}>Voir le JSON</summary>
            <pre style={{ marginTop: 8, padding: 10, background: 'var(--surface-3)', borderRadius: 4, maxHeight: 200, overflow: 'auto', fontSize: 11 }}>{form.blocks_json}</pre>
          </details>
        </div>
        <BlockEditor value={form.blocks_json || '[]'} onChange={(json) => setForm(f => f.blocks_json === json ? f : { ...f, blocks_json: json })} />
      </div>
    </form>
  );
}

// ============== QUOTE SUBMISSIONS ==============
export function QuoteSubmissionsListPage() {
  const list = useQuoteSubmissions();
  const del = useDeleteQuoteSubmission();
  const { push } = useToast();
  return (
    <>
      <div className="topbar-row"><div><h1>Demandes de devis</h1><p>Toutes les soumissions reçues.</p></div><Link className="btn secondary" to="/admin/quote-forms">Gérer les formulaires</Link></div>
      <div className="card">
        {list.isLoading && <div className="loading">Chargement…</div>}
        {list.isError && <div className="empty">Erreur de chargement. Réessaie.</div>}
        {list.data && list.data.length === 0 && <div className="empty">Aucune demande.</div>}
        {list.data && list.data.length > 0 && (
          <table className="wp-list">
            <thead><tr><th>Date</th><th className="column-primary">Contact</th><th>Formulaire</th><th>Société</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>{list.data.map(s => (
              <tr key={s.id}><td className="meta" data-label="Date">{formatDate(s.created_at)}</td>
                <td className="column-primary">{s.customer_name}<div className="meta">{s.customer_email}</div></td>
                <td data-label="Formulaire">{s.form_title}</td><td data-label="Société">{s.customer_company || '—'}</td>
                <td data-label="Statut"><span className={`status-badge ${s.status}`}>{s.status}</span></td>
                <td className="actions" data-label="Actions"><Link className="btn small" to="/admin/quote-submissions/$id" params={{ id: String(s.id) }}>Voir</Link>{' '}
                  <button className="btn danger small" onClick={() => { if (confirm('Supprimer ?')) del.mutate(s.id, { onSuccess: () => push('Supprimé.', 'success') }); }}>Supprimer</button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </>
  );
}

export function QuoteSubmissionDetailPage() {
  const params = useParams({ strict: false }) as { id?: string };
  const id = params.id ? Number(params.id) : null;
  const detail = useQuoteSubmission(id);
  if (detail.isLoading) return <div className="loading">Chargement…</div>;
  if (!detail.data) return <div className="empty">Introuvable.</div>;
  const s = detail.data;
  let payload: Record<string, any> = {};
  try { payload = JSON.parse(s.payload_json || '{}'); } catch {}
  return (
    <>
      <div className="topbar-row"><div><h1>Détail demande</h1><p>{s.form_title} · {formatDate(s.created_at)}</p></div><Link className="btn secondary" to="/admin/quote-submissions">← Retour</Link></div>
      <div className="row">
        <div className="card"><h2>Contact</h2><p><strong>{s.customer_name}</strong></p><p className="meta">{s.customer_email}<br/>{s.customer_company}</p></div>
        <div className="card"><h2>Statut</h2><p>Formulaire : <strong>{s.form_title}</strong></p><p>Date : {formatDate(s.created_at)}</p><p>Statut : <span className={`status-badge ${s.status}`}>{s.status}</span></p></div>
      </div>
      <div className="card"><h2>Réponses structurées</h2>
        {Object.keys(payload).length === 0 ? <p className="muted">Aucune donnée.</p> : (
          <table className="wp-list"><tbody>{Object.entries(payload).map(([k, v]) => (
            <tr key={k}><th style={{ width: '30%' }}>{k}</th><td style={{ whiteSpace: 'pre-line' }}>{String(v)}</td></tr>
          ))}</tbody></table>
        )}
      </div>
      <div className="card"><h2>Notes</h2><p style={{ whiteSpace: 'pre-line' }}>{s.notes || <span className="muted">Aucune note</span>}</p></div>
    </>
  );
}

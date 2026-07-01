import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { EmailTemplates, Forms, useNewsletterAudience, useSendNewsletter, useCampaigns } from '@/api/hooks';
import { useToast } from '@/lib/toast';

type Source = 'customers' | 'form' | 'manual';

export function NewsletterPage() {
  const templates = EmailTemplates.useList();
  const formsList = Forms.useList();
  const send = useSendNewsletter();
  const campaigns = useCampaigns();
  const { push } = useToast();

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [source, setSource] = useState<Source>('customers');
  const [formId, setFormId] = useState<number | undefined>(undefined);
  const [manual, setManual] = useState('');

  const audience = useNewsletterAudience(source, formId);
  const manualEmails = manual.split(/[\n,;]+/).map(s => s.trim()).filter(e => e.includes('@'));
  const count = source === 'manual' ? manualEmails.length : (audience.data?.count ?? 0);

  const loadTemplate = (id: string) => {
    const t = templates.data?.find(x => x.id === Number(id));
    if (t) { setSubject(t.subject); setBody(t.body_html); push('Modèle chargé.', 'info'); }
  };

  const onSend = () => {
    if (!subject || !body) { push('Objet et corps requis.', 'error'); return; }
    if (count === 0) { push('Aucun destinataire pour cette audience.', 'error'); return; }
    if (!confirm(`Envoyer cet email à ${count} destinataire(s) ?`)) return;
    send.mutate(
      { subject, body_html: body, source, formId: source === 'form' ? formId : undefined, emails: source === 'manual' ? manualEmails : undefined },
      {
        onSuccess: (r) => push(`Terminé : ${r.sent} envoyé(s) · ${r.skipped} ignoré(s) · ${r.failed} échec(s)${r.capped ? ` (plafonné à ${r.recipients})` : ''}.`, r.failed ? 'error' : 'success'),
        onError: () => push('Échec de l’envoi.', 'error'),
      },
    );
  };

  return (
    <>
      <div className="topbar-row">
        <div><h1>Newsletter</h1><p>Envoi groupé aux clients, aux répondants d'un formulaire, ou à une liste.</p></div>
        <Link className="btn secondary" to="/admin/email-templates">Modèles</Link>
      </div>

      <div className="card">
        <h2>Message</h2>
        <div className="field"><label>Charger un modèle</label>
          <select defaultValue="" onChange={e => { loadTemplate(e.target.value); e.target.value = ''; }}>
            <option value="" disabled>— Choisir un modèle —</option>
            {(templates.data ?? []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="field"><label>Objet *</label><input value={subject} onChange={e => setSubject(e.target.value)} /></div>
        <div className="field"><label>Corps (HTML)</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} style={{ minHeight: 200, fontFamily: 'SF Mono, Menlo, Consolas, monospace', fontSize: 12 }} placeholder="<h1>Bonjour {{name}}</h1><p>…</p>" />
          <span className="hint">HTML autorisé. Variables : <code>{'{{name}}'}</code>, <code>{'{{email}}'}</code>.</span>
        </div>
      </div>

      <div className="card">
        <h2>Destinataires</h2>
        <div className="form-choices">
          <label className="form-choice"><input type="radio" name="src" checked={source === 'customers'} onChange={() => setSource('customers')} /> Clients</label>
          <label className="form-choice"><input type="radio" name="src" checked={source === 'form'} onChange={() => setSource('form')} /> Répondants d'un formulaire</label>
          <label className="form-choice"><input type="radio" name="src" checked={source === 'manual'} onChange={() => setSource('manual')} /> Liste manuelle</label>
        </div>
        {source === 'form' && (
          <div className="field" style={{ marginTop: 10 }}><label>Formulaire</label>
            <select value={formId ?? ''} onChange={e => setFormId(e.target.value ? Number(e.target.value) : undefined)}>
              <option value="">— Choisir —</option>
              {(formsList.data ?? []).map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
            </select>
            <span className="hint">Les emails sont extraits du champ « email » des réponses.</span>
          </div>
        )}
        {source === 'manual' && (
          <div className="field" style={{ marginTop: 10 }}><label>Emails (un par ligne, ou séparés par virgule)</label>
            <textarea value={manual} onChange={e => setManual(e.target.value)} style={{ minHeight: 100 }} placeholder="alice@exemple.com&#10;bob@exemple.com" />
          </div>
        )}
        <p className="meta" style={{ marginTop: 8 }}>
          <strong>{count}</strong> destinataire(s){source !== 'manual' && audience.isFetching ? ' (calcul…)' : ''}
          {source !== 'manual' && audience.data?.sample?.length ? ` — ex. ${audience.data.sample.slice(0, 3).join(', ')}` : ''}
        </p>
        <button className="btn" type="button" onClick={onSend} disabled={send.isPending}>{send.isPending ? 'Envoi en cours…' : `Envoyer à ${count} destinataire(s)`}</button>
        <p className="hint">L'envoi est séquentiel ; pour de longues listes cela peut prendre un moment. Configure le SMTP dans Réglages › Emails au préalable.</p>
      </div>

      <div className="card">
        <h2>Campagnes envoyées</h2>
        {campaigns.isLoading && <div className="loading">Chargement…</div>}
        {campaigns.data && campaigns.data.length === 0 && <div className="empty">Aucune campagne pour le moment.</div>}
        {campaigns.data && campaigns.data.length > 0 && (
          <table className="wp-list">
            <thead><tr><th>Date</th><th>Objet</th><th>Audience</th><th>Destinataires</th><th>Envoyés</th><th>Ignorés</th><th>Échecs</th></tr></thead>
            <tbody>
              {campaigns.data.map(c => (
                <tr key={c.id}>
                  <td className="meta">{c.created_at}</td><td>{c.subject}</td><td><code>{c.audience}</code></td>
                  <td>{c.recipients}</td><td>{c.sent}</td><td>{c.skipped}</td><td>{c.failed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

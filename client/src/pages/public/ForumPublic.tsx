import { useState, type FormEvent } from 'react';
import { Link, useParams, useNavigate } from '@tanstack/react-router';
import { usePublicForum, usePublicForumCategory, usePublicForumTopic, useCreateForumTopic, useCreateForumReply } from '@/api/public';
import { ApiError } from '@/api/client';

const fmt = (s: string) => { try { return new Date(s).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return s; } };
function Body({ text }: { text: string }) {
  return <>{text.split(/\n{2,}/).map((p, i) => <p key={i}>{p.split('\n').map((l, j) => <span key={j}>{j > 0 && <br />}{l}</span>)}</p>)}</>;
}

// ===== Liste des catégories =====
export function ForumPage() {
  const forum = usePublicForum();
  if (forum.isLoading) return <div className="loading">Chargement…</div>;
  if (forum.isError) return <div className="empty">Forum indisponible.</div>;
  const cats = forum.data ?? [];
  return (
    <>
      <div className="topbar-row"><h1>Forum</h1></div>
      {cats.length === 0
        ? <div className="empty">Aucune catégorie pour le moment.</div>
        : <div className="forum-cats">
          {cats.map(c => (
            <Link key={c.id} to="/forum/c/$cat" params={{ cat: c.slug }} className="forum-cat card">
              <div className="forum-cat-main"><h3>{c.name}</h3>{c.description && <p className="meta">{c.description}</p>}</div>
              <div className="forum-cat-stats">
                <span><b>{c.topic_count}</b> sujet{c.topic_count > 1 ? 's' : ''}</span>
                <span><b>{c.reply_count}</b> réponse{c.reply_count > 1 ? 's' : ''}</span>
              </div>
            </Link>
          ))}
        </div>}
    </>
  );
}

// ===== Sujets d'une catégorie + nouveau sujet =====
export function ForumCategoryPage() {
  const { cat } = useParams({ strict: false }) as { cat: string };
  const navigate = useNavigate();
  const q = usePublicForumCategory(cat);
  const create = useCreateForumTopic(cat);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  if (q.isLoading) return <div className="loading">Chargement…</div>;
  if (q.isError || !q.data) return <div className="empty">Catégorie introuvable. <Link to="/forum">← Forum</Link></div>;

  const submit = (e: FormEvent) => {
    e.preventDefault(); setError('');
    create.mutate({ title, author, body }, {
      onSuccess: (t) => navigate({ to: '/forum/sujet/$slug', params: { slug: t.slug } }),
      onError: (err) => setError(err instanceof ApiError ? err.message : 'Échec de l’envoi.'),
    });
  };

  return (
    <>
      <p className="meta"><Link to="/forum">← Forum</Link></p>
      <div className="topbar-row">
        <div><h1>{q.data.category.name}</h1>{q.data.category.description && <p>{q.data.category.description}</p>}</div>
        <button className="btn" onClick={() => setOpen(o => !o)}>{open ? 'Fermer' : '＋ Nouveau sujet'}</button>
      </div>

      {open && (
        <form className="card" onSubmit={submit} style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>Nouveau sujet</h2>
          <div className="row">
            <div className="field" style={{ flex: 2 }}><label>Titre *</label><input value={title} onChange={e => setTitle(e.target.value)} required minLength={3} /></div>
            <div className="field"><label>Votre nom *</label><input value={author} onChange={e => setAuthor(e.target.value)} required /></div>
          </div>
          <div className="field"><label>Message *</label><textarea value={body} onChange={e => setBody(e.target.value)} required style={{ minHeight: 120 }} /></div>
          {error && <p className="form-error">{error}</p>}
          <button className="btn" type="submit" disabled={create.isPending}>{create.isPending ? 'Envoi…' : 'Publier le sujet'}</button>
        </form>
      )}

      {q.data.topics.length === 0
        ? <div className="empty">Aucun sujet. Lance la discussion !</div>
        : <div className="card"><table className="wp-list">
          <thead><tr><th className="column-primary">Sujet</th><th>Réponses</th><th>Dernière activité</th></tr></thead>
          <tbody>
            {q.data.topics.map(t => (
              <tr key={t.id}>
                <td className="column-primary">
                  <Link to="/forum/sujet/$slug" params={{ slug: t.slug }}>{t.pinned ? '📌 ' : ''}{t.locked ? '🔒 ' : ''}{t.title}</Link>
                  <div className="meta">par {t.author || 'Anonyme'}</div>
                </td>
                <td data-label="Réponses">{t.reply_count}</td>
                <td data-label="Dernière activité">{fmt(t.last_activity_at)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>}
    </>
  );
}

// ===== Sujet + réponses =====
export function ForumTopicPage() {
  const { slug } = useParams({ strict: false }) as { slug: string };
  const q = usePublicForumTopic(slug);
  const reply = useCreateForumReply(slug);
  const [author, setAuthor] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');

  if (q.isLoading) return <div className="loading">Chargement…</div>;
  if (q.isError || !q.data) return <div className="empty">Sujet introuvable. <Link to="/forum">← Forum</Link></div>;
  const { topic, category, replies } = q.data;

  const submit = (e: FormEvent) => {
    e.preventDefault(); setError('');
    reply.mutate({ author, body }, {
      onSuccess: () => { setBody(''); },
      onError: (err) => setError(err instanceof ApiError ? err.message : 'Échec de l’envoi.'),
    });
  };

  return (
    <>
      <p className="meta"><Link to="/forum">Forum</Link>{category && <> · <Link to="/forum/c/$cat" params={{ cat: category.slug }}>{category.name}</Link></>}</p>
      <h1>{topic.pinned ? '📌 ' : ''}{topic.locked ? '🔒 ' : ''}{topic.title}</h1>

      <article className="card forum-post">
        <div className="forum-post-head"><b>{topic.author || 'Anonyme'}</b><span className="meta">{fmt(topic.created_at)}</span></div>
        <div className="rich"><Body text={topic.body} /></div>
      </article>

      <h2 style={{ marginTop: 20 }}>{replies.length} réponse{replies.length > 1 ? 's' : ''}</h2>
      {replies.map(r => (
        <article key={r.id} className="card forum-post forum-reply">
          <div className="forum-post-head"><b>{r.author || 'Anonyme'}</b><span className="meta">{fmt(r.created_at)}</span></div>
          <div className="rich"><Body text={r.body} /></div>
        </article>
      ))}

      {topic.locked
        ? <div className="empty" style={{ marginTop: 16 }}>🔒 Ce sujet est verrouillé, les réponses sont closes.</div>
        : <form className="card" onSubmit={submit} style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Répondre</h3>
          <div className="field"><label>Votre nom *</label><input value={author} onChange={e => setAuthor(e.target.value)} required /></div>
          <div className="field"><label>Message *</label><textarea value={body} onChange={e => setBody(e.target.value)} required style={{ minHeight: 110 }} /></div>
          {error && <p className="form-error">{error}</p>}
          <button className="btn" type="submit" disabled={reply.isPending}>{reply.isPending ? 'Envoi…' : 'Envoyer'}</button>
        </form>}
    </>
  );
}

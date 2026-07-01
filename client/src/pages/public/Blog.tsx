import { useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { usePublicPosts, usePublicPostCategories, usePublicPost, usePublicRelated, usePostComments, useSubmitComment, type PublicPostListItem } from '@/api/public';
import { RichContent } from '@/components/RichContent';
import { ShareButtons } from '@/components/ShareButtons';

function frDate(s: string): string {
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function PostCard({ p }: { p: PublicPostListItem }) {
  return (
    <article className="blog-card">
      {p.cover_url && <Link to="/blog/$slug" params={{ slug: p.slug }} className="blog-cover"><img src={p.cover_url} alt={p.title} loading="lazy" /></Link>}
      <div className="blog-card-body">
        <p className="blog-meta">{p.featured ? <span className="blog-tag">★ À la une</span> : null}{p.category && <Link to="/blog/categorie/$cat" params={{ cat: p.category }} className="blog-tag">{p.category}</Link>}{p.published_at && <span>{frDate(p.published_at)}</span>}</p>
        <h2 className="blog-card-title"><Link to="/blog/$slug" params={{ slug: p.slug }}>{p.title}</Link></h2>
        {p.excerpt && <p className="meta">{p.excerpt}</p>}
      </div>
    </article>
  );
}

const PAGE_SIZE = 9;

export function BlogPage() {
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const posts = usePublicPosts({ category: category || undefined, page, limit: PAGE_SIZE });
  const featured = usePublicPosts({ featured: true, limit: 3 });
  const cats = usePublicPostCategories();
  const total = posts.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const setCat = (c: string) => { setCategory(c); setPage(1); };
  const showFeatured = !category && page === 1 && (featured.data?.items.length ?? 0) > 0;

  return (
    <section>
      <div className="topbar-row"><h1>Blog</h1></div>
      {(cats.data?.length ?? 0) > 0 && (
        <div className="blog-cats">
          <button type="button" className={`blog-cat ${!category ? 'active' : ''}`} onClick={() => setCat('')}>Tous</button>
          {(cats.data ?? []).map(c => (
            <button key={c} type="button" className={`blog-cat ${category === c ? 'active' : ''}`} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
      )}

      {showFeatured && (
        <>
          <h2 style={{ marginTop: 4 }}>À la une</h2>
          <div className="blog-grid">{featured.data!.items.map(p => <PostCard key={p.id} p={p} />)}</div>
          <h2 style={{ marginTop: 20 }}>Tous les articles</h2>
        </>
      )}

      {posts.isLoading && <div className="loading">Chargement…</div>}
      {posts.isError && <div className="empty">Blog indisponible.</div>}
      {posts.data && posts.data.items.length === 0 && <div className="empty">Aucun article{category ? ' dans cette catégorie' : ''}.</div>}
      <div className="blog-grid">{(posts.data?.items ?? []).map(p => <PostCard key={p.id} p={p} />)}</div>

      {pages > 1 && (
        <div className="pagination">
          <button className="btn secondary small" type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Précédent</button>
          <span className="meta">Page {page} / {pages}</span>
          <button className="btn secondary small" type="button" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Suivant →</button>
        </div>
      )}
    </section>
  );
}

export function PostViewPage() {
  const { slug } = useParams({ strict: false }) as { slug: string };
  const q = usePublicPost(slug);

  if (q.isLoading) return <div className="loading">Chargement…</div>;
  if (q.isError || !q.data) return <div className="empty">Cet article n'existe pas ou n'est plus disponible.</div>;
  const p = q.data;

  return (
    <>
      <article className="card rich" style={{ maxWidth: 820, margin: '0 auto' }}>
        <p className="meta"><Link to="/blog">← Blog</Link></p>
        {p.cover_url && <p><img src={p.cover_url} alt={p.title} style={{ width: '100%', borderRadius: 10 }} /></p>}
        <h1>{p.title}</h1>
        <p className="blog-meta">{p.featured ? <span className="blog-tag">★ À la une</span> : null}{p.category && <Link to="/blog/categorie/$cat" params={{ cat: p.category }} className="blog-tag">{p.category}</Link>}{p.author && <span>par {p.author}</span>}{p.published_at && <span>{frDate(p.published_at)}</span>}</p>
        <RichContent html={p.content} className="" />
        <ShareButtons title={p.title} />
      </article>
      <Related slug={p.slug} />
      <Comments slug={p.slug} />
    </>
  );
}

export function CategoryPage() {
  const { cat } = useParams({ strict: false }) as { cat: string };
  const category = decodeURIComponent(cat || '');
  const [page, setPage] = useState(1);
  const posts = usePublicPosts({ category, page, limit: PAGE_SIZE });
  const total = posts.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section>
      <div className="topbar-row"><h1>Catégorie : {category}</h1></div>
      <p className="meta"><Link to="/blog">← Tous les articles</Link></p>
      {posts.isLoading && <div className="loading">Chargement…</div>}
      {posts.isError && <div className="empty">Indisponible.</div>}
      {posts.data && posts.data.items.length === 0 && <div className="empty">Aucun article dans « {category} ».</div>}
      <div className="blog-grid">{(posts.data?.items ?? []).map(p => <PostCard key={p.id} p={p} />)}</div>
      {pages > 1 && (
        <div className="pagination">
          <button className="btn secondary small" type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Précédent</button>
          <span className="meta">Page {page} / {pages}</span>
          <button className="btn secondary small" type="button" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Suivant →</button>
        </div>
      )}
    </section>
  );
}

function Related({ slug }: { slug: string }) {
  const q = usePublicRelated(slug);
  if (!q.data || q.data.length === 0) return null;
  return (
    <section className="card" style={{ maxWidth: 820, margin: '16px auto 0' }}>
      <h2>Articles liés</h2>
      <div className="blog-grid">{q.data.map(p => <PostCard key={p.id} p={p} />)}</div>
    </section>
  );
}

function Comments({ slug }: { slug: string }) {
  const list = usePostComments(slug);
  const submit = useSubmitComment(slug);
  const [author, setAuthor] = useState('');
  const [email, setEmail] = useState('');
  const [body, setBody] = useState('');
  const [website, setWebsite] = useState(''); // honeypot anti-spam
  const [done, setDone] = useState('');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!author.trim() || !body.trim()) return;
    submit.mutate({ author, email, body, website }, { onSuccess: (r) => { setDone(r.message); setBody(''); } });
  };

  return (
    <section className="card" style={{ maxWidth: 820, margin: '16px auto 0' }}>
      <h2>Commentaires</h2>
      {list.data && list.data.length === 0 && <p className="meta">Aucun commentaire pour le moment. Sois le premier !</p>}
      <div className="comment-list">
        {(list.data ?? []).map(c => (
          <div key={c.id} className="comment">
            <div className="comment-head"><strong>{c.author}</strong><span className="meta">{c.created_at}</span></div>
            <p style={{ whiteSpace: 'pre-line', margin: '4px 0 0' }}>{c.body}</p>
          </div>
        ))}
      </div>
      <h3 style={{ marginTop: 16 }}>Laisser un commentaire</h3>
      {done ? <p className="meta">{done}</p> : (
        <form onSubmit={onSubmit}>
          <div className="row">
            <div className="field"><label>Nom *</label><input value={author} onChange={e => setAuthor(e.target.value)} required /></div>
            <div className="field"><label>Email (non publié)</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
          </div>
          <div className="field"><label>Message *</label><textarea value={body} onChange={e => setBody(e.target.value)} required /></div>
          <input className="hp" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={e => setWebsite(e.target.value)} placeholder="Laisser vide" />
          <button className="btn" type="submit" disabled={submit.isPending}>{submit.isPending ? 'Envoi…' : 'Publier'}</button>
        </form>
      )}
    </section>
  );
}

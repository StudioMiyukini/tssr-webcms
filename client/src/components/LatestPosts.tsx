import { usePublicPosts } from '@/api/public';
import type { PostsMode } from '@/lib/page-blocks';

/** Îlot dynamique : articles publiés (liens en <a> car hors contexte router).
 *  mode = 'latest' (derniers, filtrables par catégorie) · 'featured' (mis en avant) · 'selected' (slugs choisis). */
export function LatestPosts({ count, category, title, mode = 'latest', slugs = [] }: {
  count: number; category: string; title: string; mode?: PostsMode; slugs?: string[];
}) {
  // En mode 'selected' on récupère un large lot puis on filtre/ordonne selon les slugs choisis.
  const posts = usePublicPosts(
    mode === 'featured' ? { featured: true, limit: count }
      : mode === 'selected' ? { limit: 100 }
        : { category: category || undefined, limit: count },
  );
  const all = posts.data?.items ?? [];
  const items = mode === 'selected'
    ? slugs.map(s => all.find(p => p.slug === s)).filter((p): p is NonNullable<typeof p> => !!p)
    : all.slice(0, count);
  if (!items.length) return null;
  return (
    <div className="pb-latest">
      {title && <h2>{title}</h2>}
      <div className="blog-grid">
        {items.map(p => (
          <article key={p.id} className="blog-card">
            {p.cover_url && <a className="blog-cover" href={`/blog/${p.slug}`}><img src={p.cover_url} alt={p.title} loading="lazy" /></a>}
            <div className="blog-card-body">
              <p className="blog-meta">{p.category && <span className="blog-tag">{p.category}</span>}</p>
              <h3 className="blog-card-title"><a href={`/blog/${p.slug}`}>{p.title}</a></h3>
              {p.excerpt && <p className="meta">{p.excerpt}</p>}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

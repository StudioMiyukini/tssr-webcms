import { useParams } from '@tanstack/react-router';
import { usePublicPage } from '@/api/public';
import { RichContent } from '@/components/RichContent';
import { ShareButtons } from '@/components/ShareButtons';

export function PageView() {
  const { slug } = useParams({ strict: false }) as { slug: string };
  const q = usePublicPage(slug);

  if (q.isLoading) return <div className="loading">Chargement…</div>;
  if (q.isError || !q.data) return <div className="empty">Cette page n'existe pas ou n'est pas publiée.</div>;
  const page = q.data;
  return (
    <article className="card rich" style={{ maxWidth: 820, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 8 }}>{page.title}</h1>
      {page.excerpt && <p className="meta" style={{ marginBottom: 16 }}>{page.excerpt}</p>}
      <RichContent html={page.content} className="" />
      <ShareButtons title={page.title} />
    </article>
  );
}

import { useState } from 'react';
import { usePublicSearch } from '@/api/public';

const PAGE_SIZE = 10;

export function SearchPage() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const res = usePublicSearch(q, page);
  const short = q.trim().length > 0 && q.trim().length < 2;
  const total = res.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const onChange = (v: string) => { setQ(v); setPage(1); };

  return (
    <section style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1>Recherche</h1>
      <input className="search-input" value={q} onChange={e => onChange(e.target.value)} placeholder="Rechercher une page ou un article…" autoFocus />
      {short && <p className="meta">Tape au moins 2 caractères.</p>}
      {q.trim().length >= 2 && (
        <>
          {res.isLoading && <div className="loading">Recherche…</div>}
          {res.data && res.data.items.length === 0 && <div className="empty">Aucun résultat pour « {q} ».</div>}
          {res.data && res.data.items.length > 0 && <p className="meta">{total} résultat(s)</p>}
          <div className="search-results">
            {(res.data?.items ?? []).map((r, i) => (
              <a key={i} className="search-result" href={r.url}>
                <span className="search-type">{r.type}</span>
                <span className="search-title">{r.title}</span>
                {r.excerpt && <span className="meta">{r.excerpt}</span>}
              </a>
            ))}
          </div>
          {pages > 1 && (
            <div className="pagination">
              <button className="btn secondary small" type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Précédent</button>
              <span className="meta">Page {page} / {pages}</span>
              <button className="btn secondary small" type="button" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Suivant →</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

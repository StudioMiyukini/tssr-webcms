import { useEffect, useMemo, useRef, useState } from 'react';
import { GLOSSARY, GLOSSARY_CATEGORIES, GLOSSARY_ALIASES, GLOSSARY_LINKS, glossarySlug } from '@/lib/glossary-data';

const FILTERS = [{ key: 'all', label: 'Tout' }, ...GLOSSARY_CATEGORIES.map(c => ({ key: c.key, label: c.label.replace(/^[^ ]+ /, '') }))];

/** Minuscule + sans accents, pour une recherche tolérante. */
function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
/** Surligne la requête (insensible aux accents) dans un texte échappé. */
function highlight(text: string, q: string): string {
  const safe = escHtml(text);
  if (!q) return safe;
  const nq = norm(q);
  const nText = norm(safe);
  const out: string[] = [];
  let i = 0;
  while (i < safe.length) {
    const at = nText.indexOf(nq, i);
    if (at < 0) { out.push(safe.slice(i)); break; }
    out.push(safe.slice(i, at), '<mark class="gloss-mark">', safe.slice(at, at + nq.length), '</mark>');
    i = at + nq.length;
  }
  return out.join('');
}

// Enrichit chaque terme avec ses alias et ses liens de cours (tables curatées).
const TERMS = GLOSSARY.map(t => ({ ...t, slug: glossarySlug(t.acronym), aliases: GLOSSARY_ALIASES[t.acronym] || [], links: GLOSSARY_LINKS[t.acronym] || [] }));

/** Glossaire TSSR interactif (îlot React) — index de recherche des notions.
 *  Recherche (acronyme, terme, définition, synonymes, tags), filtres, cartes dépliables,
 *  renvois vers les cours et liens partageables (ancres). */
export function Glossary() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const q = search.trim();

  const filtered = useMemo(() => {
    const nq = norm(q);
    return TERMS.filter(item => {
      const matchFilter = filter === 'all' || item.category === filter;
      if (!nq) return matchFilter;
      const hay = norm([item.acronym, item.name, item.definition.replace(/<[^>]*>/g, ''), item.aliases.join(' '), item.tags.join(' ')].join(' '));
      return matchFilter && hay.includes(nq);
    });
  }, [filter, q]);

  const groups = GLOSSARY_CATEGORIES
    .map(cat => ({ ...cat, items: filtered.filter(i => i.category === cat.key) }))
    .filter(g => g.items.length > 0);

  const toggle = (slug: string) => setExpanded(prev => {
    const n = new Set(prev);
    if (n.has(slug)) { n.delete(slug); } else { n.add(slug); if (typeof history !== 'undefined') history.replaceState(null, '', `#gt-${slug}`); }
    return n;
  });

  const copyLink = (slug: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${location.origin}${location.pathname}#gt-${slug}`;
    navigator.clipboard?.writeText(url).then(() => { setCopied(slug); setTimeout(() => setCopied(''), 1400); }).catch(() => {});
  };

  // Raccourcis clavier : « / » ou « s » place le focus sur la recherche, « Échap » l'efface.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if ((e.key === '/' || e.key === 's') && !typing) { e.preventDefault(); inputRef.current?.focus(); }
      else if (e.key === 'Escape' && el === inputRef.current) { setSearch(''); inputRef.current?.blur(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Deep-linking : #gt-<slug> déplie et fait défiler jusqu'au terme au chargement.
  useEffect(() => {
    const h = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (!h.startsWith('gt-')) return;
    const slug = h.slice(3);
    if (!TERMS.some(t => t.slug === slug)) return;
    setExpanded(prev => new Set(prev).add(slug));
    const t = setTimeout(() => document.getElementById(`gt-${slug}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="gloss">
      <header className="gloss-head">
        <span className="gloss-badge">RNCP 37682</span>
        <h1 className="gloss-h1">Glossaire TSSR</h1>
        <p className="gloss-sub">Index de recherche des notions — Technicien Supérieur Systèmes &amp; Réseaux</p>
        <div className="gloss-stats">
          <span className="gloss-stat">Termes : <b>{TERMS.length}</b></span>
          <span className="gloss-stat">Catégories : <b>{GLOSSARY_CATEGORIES.length}</b></span>
          <span className="gloss-stat">Version : <b>2026</b></span>
        </div>
      </header>

      <div className="gloss-search-wrap">
        <span className="gloss-search-icon">⌕</span>
        <input ref={inputRef} className="gloss-search" type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une notion, un acronyme, un synonyme…  ( / )" aria-label="Rechercher dans le glossaire" />
        {search && <button type="button" className="gloss-clear" onClick={() => setSearch('')} aria-label="Effacer">×</button>}
      </div>

      <div className="gloss-filters">
        {FILTERS.map(f => (
          <button key={f.key} type="button" className={`gloss-fbtn ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
      </div>

      {filtered.length === 0
        ? <div className="gloss-none">Aucun résultat pour « {q} ». Essayez un synonyme ou une autre catégorie.</div>
        : (
          <>
            <div className="gloss-bar">
              <div className="gloss-count"><b>{filtered.length}</b> notion{filtered.length > 1 ? 's' : ''}{q && ' trouvée' + (filtered.length > 1 ? 's' : '')}</div>
              {expanded.size > 0 && <button type="button" className="gloss-collapse" onClick={() => setExpanded(new Set())}>Tout replier</button>}
            </div>
            {groups.map(g => (
              <section key={g.key} className="gloss-section">
                {filter === 'all' && <div className="gloss-cat-title">{g.label}</div>}
                <div className="gloss-grid">
                  {g.items.map(item => {
                    const open = expanded.has(item.slug);
                    return (
                      <div key={item.slug} id={`gt-${item.slug}`} className={`gloss-card ${open ? 'expanded' : ''}`} onClick={() => toggle(item.slug)}>
                        <div className="gloss-card-head">
                          <div>
                            <div className="gloss-acr" dangerouslySetInnerHTML={{ __html: highlight(item.acronym, q) }} />
                            <div className="gloss-term" dangerouslySetInnerHTML={{ __html: highlight(item.name, q) }} />
                          </div>
                          <div className="gloss-actions">
                            <button type="button" className="gloss-link-btn" title="Copier le lien vers cette notion" onClick={e => copyLink(item.slug, e)}>{copied === item.slug ? '✓' : '🔗'}</button>
                            <div className="gloss-expand">+</div>
                          </div>
                        </div>
                        {open && (
                          <div className="gloss-body">
                            <div dangerouslySetInnerHTML={{ __html: item.definition }} />
                            {item.links.length > 0 && (
                              <div className="gloss-links">
                                <span className="gloss-links-label">📖 En savoir plus :</span>
                                {item.links.map(l => <a key={l.href} className="gloss-link" href={l.href} onClick={e => e.stopPropagation()}>{l.label} →</a>)}
                              </div>
                            )}
                            <div style={{ marginTop: 10 }}>{item.tags.map(t => <span key={t} className={`gloss-tag gloss-tag-${t}`}>{t}</span>)}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </>
        )}
    </div>
  );
}

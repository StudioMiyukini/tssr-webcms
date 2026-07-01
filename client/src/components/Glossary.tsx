import { useMemo, useState } from 'react';
import { GLOSSARY, GLOSSARY_CATEGORIES } from '@/lib/glossary-data';

const FILTERS = [{ key: 'all', label: 'Tout' }, ...GLOSSARY_CATEGORIES.map(c => ({ key: c.key, label: c.label.replace(/^[^ ]+ /, '') }))];

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function highlight(text: string, q: string): string {
  const safe = escHtml(text);
  if (!q) return safe;
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return safe.replace(re, '<mark class="gloss-mark">$1</mark>');
}

/** Glossaire TSSR interactif (îlot React). Recherche, filtres par catégorie, cartes dépliables. */
export function Glossary() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const q = search.toLowerCase().trim();

  const filtered = useMemo(() => GLOSSARY.filter(item => {
    const matchFilter = filter === 'all' || item.category === filter;
    const matchSearch = !q
      || item.acronym.toLowerCase().includes(q)
      || item.name.toLowerCase().includes(q)
      || item.definition.toLowerCase().replace(/<[^>]*>/g, '').includes(q);
    return matchFilter && matchSearch;
  }), [filter, q]);

  const groups = GLOSSARY_CATEGORIES
    .map(cat => ({ ...cat, items: filtered.filter(i => i.category === cat.key) }))
    .filter(g => g.items.length > 0);

  const toggle = (id: string) => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="gloss">
      <header className="gloss-head">
        <span className="gloss-badge">RNCP 37682</span>
        <h1 className="gloss-h1">Glossaire TSSR</h1>
        <p className="gloss-sub">Technicien Supérieur Systèmes &amp; Réseaux</p>
        <div className="gloss-stats">
          <span className="gloss-stat">Termes : <b>{GLOSSARY.length}</b></span>
          <span className="gloss-stat">Catégories : <b>{GLOSSARY_CATEGORIES.length}</b></span>
          <span className="gloss-stat">Version : <b>2026</b></span>
        </div>
      </header>

      <div className="gloss-search-wrap">
        <span className="gloss-search-icon">⌕</span>
        <input className="gloss-search" type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un acronyme ou un terme..." />
      </div>

      <div className="gloss-filters">
        {FILTERS.map(f => (
          <button key={f.key} type="button" className={`gloss-fbtn ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
      </div>

      {filtered.length === 0
        ? <div className="gloss-none">Aucun résultat pour cette recherche.</div>
        : (
          <>
            <div className="gloss-count"><b>{filtered.length}</b> terme{filtered.length > 1 ? 's' : ''} trouvé{filtered.length > 1 ? 's' : ''}</div>
            {groups.map(g => (
              <section key={g.key} className="gloss-section">
                {filter === 'all' && <div className="gloss-cat-title">{g.label}</div>}
                <div className="gloss-grid">
                  {g.items.map((item, idx) => {
                    const id = `${g.key}-${idx}`;
                    const open = expanded.has(id);
                    return (
                      <div key={id} className={`gloss-card ${open ? 'expanded' : ''}`} onClick={() => toggle(id)}>
                        <div className="gloss-card-head">
                          <div>
                            <div className="gloss-acr" dangerouslySetInnerHTML={{ __html: highlight(item.acronym, q) }} />
                            <div className="gloss-term" dangerouslySetInnerHTML={{ __html: highlight(item.name, q) }} />
                          </div>
                          <div className="gloss-expand">+</div>
                        </div>
                        {open && (
                          <div className="gloss-body">
                            <div dangerouslySetInnerHTML={{ __html: item.definition }} />
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

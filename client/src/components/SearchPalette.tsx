import { useEffect, useMemo, useRef, useState } from 'react';
import { usePublicSearchTop, type SearchResult } from '@/api/public';
import { GLOSSARY, GLOSSARY_ALIASES, glossarySlug } from '@/lib/glossary-data';

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
  const nq = norm(q), nText = norm(safe);
  const out: string[] = [];
  let i = 0;
  while (i < safe.length) {
    const at = nText.indexOf(nq, i);
    if (at < 0) { out.push(safe.slice(i)); break; }
    out.push(safe.slice(i, at), '<mark>', safe.slice(at, at + nq.length), '</mark>');
    i = at + nq.length;
  }
  return out.join('');
}

// Recherche glossaire (statique, côté client) : acronyme, nom, définition, alias.
function glossaryMatches(q: string, limit = 6): SearchResult[] {
  const nq = norm(q.trim());
  if (nq.length < 2) return [];
  const scored: Array<{ r: SearchResult; score: number }> = [];
  for (const t of GLOSSARY) {
    const aliases = GLOSSARY_ALIASES[t.acronym] || [];
    const nAcr = norm(t.acronym), nName = norm(t.name);
    const inAcr = nAcr.includes(nq), inName = nName.includes(nq);
    const inAlias = aliases.some(a => norm(a).includes(nq));
    const def = t.definition.replace(/<[^>]*>/g, '');
    const inDef = norm(def).includes(nq);
    if (!inAcr && !inName && !inAlias && !inDef) continue;
    const score = (nAcr === nq ? 0 : inAcr ? 1 : inName ? 2 : inAlias ? 3 : 4);
    const idx = norm(def).indexOf(nq);
    const start = Math.max(0, idx - 30);
    const raw = (start > 0 ? '…' : '') + def.slice(start, start + 130);
    scored.push({ r: { type: 'Glossaire', title: `${t.acronym} — ${t.name}`, url: `/glossaire#gt-${glossarySlug(t.acronym)}`, excerpt: def.slice(0, 160), snippet: highlight(raw, q) }, score });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map(s => s.r);
}

const GROUP_ORDER = ['Cours', 'Procédure', 'Astuce', 'Index', 'Article', 'Glossaire'];
const GROUP_LABEL: Record<string, string> = { Cours: 'Cours', 'Procédure': 'Procédures', Astuce: 'Astuces', Index: 'Index & sommaires', Article: 'Articles', Glossaire: 'Glossaire' };
const GROUP_ICON: Record<string, string> = { Cours: '📘', 'Procédure': '🧭', Astuce: '💡', Index: '🗂️', Article: '📰', Glossaire: '📖' };

export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounce de la frappe (180 ms) avant d'interroger le serveur.
  useEffect(() => { const t = setTimeout(() => setDq(q), 180); return () => clearTimeout(t); }, [q]);
  // Focus + reset à l'ouverture.
  useEffect(() => { if (open) { setActive(0); const t = setTimeout(() => inputRef.current?.focus(), 30); return () => clearTimeout(t); } else { setQ(''); setDq(''); } }, [open]);

  const server = usePublicSearchTop(dq, 8);
  const serverItems = server.data?.items ?? [];
  const glossItems = useMemo(() => glossaryMatches(dq), [dq]);

  // Regroupe par catégorie dans l'ordre défini ; construit la liste plate pour la navigation clavier.
  const { groups, flat } = useMemo(() => {
    const all = [...serverItems, ...glossItems];
    const byType: Record<string, SearchResult[]> = {};
    for (const it of all) (byType[it.type] ||= []).push(it);
    const groups = GROUP_ORDER.filter(k => byType[k]?.length).map(k => ({ key: k, items: byType[k] }));
    const flat = groups.flatMap(g => g.items);
    return { groups, flat };
  }, [serverItems, glossItems]);

  useEffect(() => { setActive(0); }, [dq, flat.length]);

  const go = (r?: SearchResult) => { if (r) { onClose(); window.location.href = r.url; } };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, Math.max(0, flat.length - 1))); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(flat[active]); }
  };

  // Fait défiler l'élément actif dans la vue.
  useEffect(() => { listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' }); }, [active]);

  if (!open) return null;
  const showEmpty = dq.trim().length >= 2 && !server.isFetching && flat.length === 0;
  let idx = -1;

  return (
    <div className="spal-overlay" onMouseDown={onClose} role="dialog" aria-modal="true" aria-label="Recherche">
      <div className="spal-panel" onMouseDown={e => e.stopPropagation()}>
        <div className="spal-inputwrap">
          <span className="spal-icon">⌕</span>
          <input
            ref={inputRef} className="spal-input" value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Rechercher une notion, une action, un acronyme…" aria-label="Rechercher sur le site"
          />
          <kbd className="spal-esc" onClick={onClose}>Échap</kbd>
        </div>

        <div className="spal-results" ref={listRef}>
          {dq.trim().length < 2 && (
            <div className="spal-hint">Tapez au moins 2 lettres. Astuce : la recherche ignore les accents et cherche dans les cours, procédures, astuces et le glossaire.</div>
          )}
          {showEmpty && <div className="spal-hint">Aucun résultat pour « {dq} ». Essayez un synonyme.</div>}
          {groups.map(g => (
            <div key={g.key} className="spal-group">
              <div className="spal-group-head">{GROUP_ICON[g.key]} {GROUP_LABEL[g.key] || g.key}</div>
              {g.items.map(it => {
                idx++;
                const i = idx;
                return (
                  <a
                    key={`${it.url}-${i}`} data-idx={i} href={it.url}
                    className={`spal-item ${i === active ? 'active' : ''}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={e => { e.preventDefault(); go(it); }}
                  >
                    <div className="spal-item-title" dangerouslySetInnerHTML={{ __html: highlight(it.title, dq) }} />
                    {it.snippet && <div className="spal-item-snip" dangerouslySetInnerHTML={{ __html: it.snippet }} />}
                  </a>
                );
              })}
            </div>
          ))}
        </div>

        <div className="spal-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> naviguer</span>
          <span><kbd>↵</kbd> ouvrir</span>
          <span><kbd>Échap</kbd> fermer</span>
          {flat.length > 0 && <span className="spal-foot-count">{flat.length} résultat{flat.length > 1 ? 's' : ''}</span>}
        </div>
      </div>
    </div>
  );
}

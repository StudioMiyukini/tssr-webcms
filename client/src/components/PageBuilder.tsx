import { useState } from 'react';
import {
  PAGE_BLOCK_PALETTE, BLOCK_LABELS, SOCIAL_NETWORKS, BUTTON_EFFECTS, makePageBlock, renderPageBlocksToHtml,
  type PageBlock, type PageBlockType, type PostsMode, type CardItem, type LinkItem, type MediaItem,
} from '@/lib/page-blocks';
import { Posts, Plannings } from '@/api/hooks';
import { MediaField } from './MediaPicker';
import { NotesWorkspace } from '@/pages/Notes';
import { RichTextEditor } from './RichTextEditor';

interface Props { blocks: PageBlock[]; onChange: (blocks: PageBlock[]) => void; }

/** Éditeur de page = éditeur de liste de blocs au niveau racine (avec bloc Colonnes autorisé). */
export function PageBuilder({ blocks, onChange }: Props) {
  return <BlockListEditor blocks={blocks} onChange={onChange} allowColumns compact={false} />;
}

interface ListProps { blocks: PageBlock[]; onChange: (blocks: PageBlock[]) => void; allowColumns: boolean; compact: boolean; }

/** Éditeur récursif d'une liste de blocs. Réutilisé pour la page et pour chaque colonne. */
function BlockListEditor({ blocks, onChange, allowColumns, compact }: ListProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const palette = allowColumns ? PAGE_BLOCK_PALETTE : PAGE_BLOCK_PALETTE.filter(p => p.type !== 'columns');

  const update = (id: string, patch: Partial<PageBlock>) => onChange(blocks.map(b => b.id === id ? { ...b, ...patch } : b));
  const remove = (id: string) => { if (confirm('Supprimer ce bloc ?')) onChange(blocks.filter(b => b.id !== id)); };
  const move = (id: string, dir: -1 | 1) => {
    const i = blocks.findIndex(b => b.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    const next = [...blocks]; [next[i], next[j]] = [next[j], next[i]]; onChange(next);
  };
  const duplicate = (id: string) => {
    const i = blocks.findIndex(b => b.id === id); if (i < 0) return;
    const copy = makePageBlock(blocks[i].type); const next = [...blocks];
    next.splice(i + 1, 0, { ...blocks[i], id: copy.id }); onChange(next);
  };
  const add = (type: PageBlockType) => { const b = makePageBlock(type); onChange([...blocks, b]); setOpenId(b.id); };

  const canvas = (
    <div className="block-canvas">
      {blocks.length === 0 ? (
        <div className="block-empty"><p>Aucun bloc.</p>{!compact && <p className="meta">Ajoute un bloc depuis la palette.</p>}</div>
      ) : blocks.map((b, idx) => {
        const isOpen = openId === b.id;
        return (
          <div key={b.id} className={`block-item block-${b.type} ${isOpen ? 'open' : ''}`}>
            <header className="block-header" onClick={() => setOpenId(isOpen ? null : b.id)}>
              <span className={`block-type-badge ${b.type}`}>{BLOCK_LABELS[b.type]}</span>
              <span className="block-label">{summary(b)}</span>
              <div className="block-actions">
                <button type="button" title="Monter" onClick={(e) => { e.stopPropagation(); move(b.id, -1); }} disabled={idx === 0}>↑</button>
                <button type="button" title="Descendre" onClick={(e) => { e.stopPropagation(); move(b.id, 1); }} disabled={idx === blocks.length - 1}>↓</button>
                <button type="button" title="Dupliquer" onClick={(e) => { e.stopPropagation(); duplicate(b.id); }}>⧉</button>
                <button type="button" className="danger" title="Supprimer" onClick={(e) => { e.stopPropagation(); remove(b.id); }}>✕</button>
              </div>
            </header>
            {isOpen && (
              <div className="block-body">
                <BlockFields b={b} update={(patch) => update(b.id, patch)} />
                {b.type !== 'columns' && (
                  <details className="block-preview">
                    <summary>Aperçu</summary>
                    <div className="rich" dangerouslySetInnerHTML={{ __html: renderPageBlocksToHtml([b]) || '<p class="meta">(vide)</p>' }} />
                  </details>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  if (compact) {
    return (
      <div className="pb-list-compact">
        <div className="pb-add-bar">
          {palette.map(p => (
            <button key={p.type} type="button" className="palette-btn" onClick={() => add(p.type)} title={p.label}>
              <span className="palette-icon">{p.icon}</span> {p.label}
            </button>
          ))}
        </div>
        {canvas}
      </div>
    );
  }

  return (
    <div className="block-editor">
      <aside className="block-palette">
        <div className="palette-title">Ajouter un bloc</div>
        {palette.map(p => (
          <button key={p.type} type="button" className="palette-btn" onClick={() => add(p.type)}>
            <span className="palette-icon">{p.icon}</span> {p.label}
          </button>
        ))}
        <div className="palette-help">Édite chaque bloc, réordonne avec ↑/↓. Le HTML de la page est généré automatiquement — aucun code à écrire.</div>
      </aside>
      {canvas}
    </div>
  );
}

function summary(b: PageBlock): string {
  if (b.type === 'columns') return `${b.columns.length} colonne(s)`;
  if (b.type === 'cards') return `${b.items.length} carte(s)`;
  if (b.type === 'list') return `${b.listItems.length} élément(s)`;
  if (b.type === 'links') return `${b.links.length} lien(s)`;
  if (b.type === 'social') return `${b.links.length} réseau(x)`;
  if (b.type === 'gallery' || b.type === 'carousel' || b.type === 'reader') return `${b.images.length} image(s)`;
  if (b.type === 'video') return b.videoUrl || 'Vidéo';
  if (b.type === 'accordion' || b.type === 'tabs') return `${b.items.length} élément(s)`;
  if (b.type === 'stats') return `${b.items.length} stat(s)`;
  if (b.type === 'spacer') return `${b.size} px`;
  if (b.type === 'latestposts') {
    const mode = b.mode === 'featured' ? 'mis en avant' : b.mode === 'selected' ? `${b.listItems.filter(Boolean).length} sélectionné(s)` : `${b.size} dernier(s)${b.text ? ` · ${b.text}` : ''}`;
    return mode;
  }
  if (b.type === 'agenda') return `${b.size} événement(s) à venir`;
  if (b.type === 'planning') return b.text ? `Planning : ${b.text}` : 'Tous les plannings';
  if (b.type === 'glossaire') return 'Glossaire TSSR interactif';
  if (b.type === 'quote') return b.text || 'Citation';
  if (b.type === 'note') return b.size ? (b.title || `Note #${b.size}`) : 'Aucune note choisie';
  if (b.type === 'cta') return b.title || 'Bandeau CTA';
  if (b.type === 'divider') return '—';
  return b.title || b.text || b.label || b.alt || BLOCK_LABELS[b.type];
}

function BlockFields({ b, update }: { b: PageBlock; update: (patch: Partial<PageBlock>) => void }) {
  switch (b.type) {
    case 'hero':
      return (
        <>
          <div className="field"><label>Pastille (optionnel)</label><input value={b.eyebrow} onChange={e => update({ eyebrow: e.target.value })} placeholder="ex: Mon Site" /></div>
          <div className="field"><label>Titre</label><input value={b.title} onChange={e => update({ title: e.target.value })} /></div>
          <div className="field"><label>Sous-titre</label><textarea value={b.subtitle} onChange={e => update({ subtitle: e.target.value })} /></div>
        </>
      );
    case 'heading':
      return (
        <div className="block-row">
          <div className="field"><label>Niveau</label>
            <select value={b.level} onChange={e => update({ level: Number(e.target.value) === 3 ? 3 : 2 })}>
              <option value={2}>Titre (H2)</option>
              <option value={3}>Sous-titre (H3)</option>
            </select>
          </div>
          <div className="field"><label>Texte</label><input value={b.text} onChange={e => update({ text: e.target.value })} /></div>
        </div>
      );
    case 'text':
      return (
        <div className="field">
          <label>Texte</label>
          <textarea value={b.text} onChange={e => update({ text: e.target.value })} style={{ minHeight: 140 }} />
          <span className="hint">Une ligne vide sépare deux paragraphes ; un simple retour à la ligne devient un saut de ligne.</span>
        </div>
      );
    case 'image':
      return (
        <>
          <MediaField label="Image" value={b.url} onChange={url => update({ url })} />
          <div className="field"><label>Texte alternatif</label><input value={b.alt} onChange={e => update({ alt: e.target.value })} placeholder="Description de l'image" /></div>
          <div className="field"><label>Largeur d'affichage : {b.size || 100}%</label>
            <input type="range" min={20} max={100} step={5} value={b.size || 100} onChange={e => update({ size: Number(e.target.value) })} />
            <span className="hint">100 % = pleine largeur. En dessous, l'image est centrée.</span>
          </div>
        </>
      );
    case 'button':
      return (
        <>
          <div className="block-row">
            <div className="field"><label>Libellé</label><input value={b.label} onChange={e => update({ label: e.target.value })} /></div>
            <div className="field"><label>Lien</label><input value={b.href} onChange={e => update({ href: e.target.value })} placeholder="/cv ou https://…" /></div>
          </div>
          <div className="block-row">
            <div className="field"><label>Style</label>
              <select value={b.variant} onChange={e => update({ variant: e.target.value === 'secondary' ? 'secondary' : 'primary' })}>
                <option value="primary">Principal (plein)</option>
                <option value="secondary">Secondaire (contour)</option>
              </select>
            </div>
            <div className="field"><label>Effet</label>
              <select value={b.effect || 'none'} onChange={e => update({ effect: e.target.value })}>
                {BUTTON_EFFECTS.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
              </select>
            </div>
          </div>
          <div className="block-row">
            <div className="field"><label>Couleur de fond</label><input type="color" value={b.bgColor || '#2271b1'} onChange={e => update({ bgColor: e.target.value })} /></div>
            <div className="field"><label>Couleur du texte</label><input type="color" value={b.fgColor || '#ffffff'} onChange={e => update({ fgColor: e.target.value })} /></div>
            {(b.bgColor || b.fgColor) && <div className="field"><label>&nbsp;</label><button type="button" className="btn secondary small" onClick={() => update({ bgColor: '', fgColor: '' })}>↺ Couleurs du thème</button></div>}
          </div>
          <span className="hint">Couleurs vides = couleurs du thème. En style « contour », la couleur de fond sert au texte et à la bordure.</span>
        </>
      );
    case 'cards':
      return <CardsEditor items={b.items} onChange={items => update({ items })} />;
    case 'list':
      return <ListEditor items={b.listItems} onChange={listItems => update({ listItems })} />;
    case 'links':
      return <LinksEditor links={b.links} onChange={links => update({ links })} />;
    case 'social':
      return <SocialEditor links={b.links} onChange={links => update({ links })} />;
    case 'gallery':
    case 'carousel':
    case 'reader':
      return <MediaListEditor images={b.images} onChange={images => update({ images })} />;
    case 'video':
      return (
        <div className="field">
          <label>URL ou ID YouTube</label>
          <input value={b.videoUrl} onChange={e => update({ videoUrl: e.target.value })} placeholder="https://youtu.be/… ou https://www.youtube.com/watch?v=…" />
          <span className="hint">Colle un lien YouTube (watch, youtu.be, shorts) ou un ID. L'aperçu apparaît ci-dessous.</span>
        </div>
      );
    case 'accordion':
      return <PairListEditor items={b.items} onChange={items => update({ items })} titleLabel="Titre" textLabel="Contenu" rich />;
    case 'tabs':
      return <PairListEditor items={b.items} onChange={items => update({ items })} titleLabel="Onglet" textLabel="Contenu" rich />;
    case 'stats':
      return <PairListEditor items={b.items} onChange={items => update({ items })} titleLabel="Valeur" textLabel="Libellé" />;
    case 'quote':
      return (
        <>
          <div className="field"><label>Citation</label><textarea value={b.text} onChange={e => update({ text: e.target.value })} /></div>
          <div className="field"><label>Auteur (optionnel)</label><input value={b.label} onChange={e => update({ label: e.target.value })} /></div>
        </>
      );
    case 'note':
      return <NoteBlockEditor b={b} update={update} />;
    case 'cta':
      return (
        <>
          <div className="field"><label>Pastille (optionnel)</label><input value={b.eyebrow} onChange={e => update({ eyebrow: e.target.value })} /></div>
          <div className="field"><label>Titre</label><input value={b.title} onChange={e => update({ title: e.target.value })} /></div>
          <div className="field"><label>Sous-titre</label><textarea value={b.subtitle} onChange={e => update({ subtitle: e.target.value })} /></div>
          <div className="block-row">
            <div className="field"><label>Bouton</label><input value={b.label} onChange={e => update({ label: e.target.value })} /></div>
            <div className="field"><label>Lien du bouton</label><input value={b.href} onChange={e => update({ href: e.target.value })} placeholder="/contact ou https://…" /></div>
          </div>
          <div className="field"><label>Style du bouton</label>
            <select value={b.variant} onChange={e => update({ variant: e.target.value === 'secondary' ? 'secondary' : 'primary' })}>
              <option value="primary">Principal (plein)</option>
              <option value="secondary">Secondaire (contour)</option>
            </select>
          </div>
        </>
      );
    case 'spacer':
      return <div className="field"><label>Hauteur : {b.size} px</label><input type="range" min={0} max={160} value={b.size} onChange={e => update({ size: Number(e.target.value) })} /></div>;
    case 'latestposts':
      return <PostsBlockEditor b={b} update={update} />;
    case 'agenda':
      return (
        <>
          <div className="field"><label>Titre de la section</label><input value={b.title} onChange={e => update({ title: e.target.value })} /></div>
          <div className="field"><label>Nombre d'événements : {b.size}</label><input type="range" min={1} max={12} value={b.size} onChange={e => update({ size: Number(e.target.value) })} /></div>
          <p className="hint">Affiche les prochains événements publiés (triés par date). Nécessite le module Agenda activé.</p>
        </>
      );
    case 'planning':
      return <PlanningBlockEditor b={b} update={update} />;
    case 'glossaire':
      return <p className="hint">Affiche le glossaire TSSR interactif (recherche, filtres, ~120 termes). Aucune configuration.</p>;
    case 'columns':
      return <ColumnsEditor columns={b.columns} onChange={columns => update({ columns })} />;
    case 'divider':
      return <p className="hint">Une ligne de séparation horizontale.</p>;
    case 'html':
      return (
        <div className="field">
          <label>HTML</label>
          <textarea value={b.html} onChange={e => update({ html: e.target.value })} style={{ minHeight: 160, fontFamily: 'SF Mono, Menlo, Consolas, monospace', fontSize: 12 }} placeholder="<p>HTML libre…</p>" />
          <span className="hint">Pour un besoin avancé. Le HTML est inséré tel quel.</span>
        </div>
      );
    default:
      return null;
  }
}

function PostsBlockEditor({ b, update }: { b: PageBlock; update: (patch: Partial<PageBlock>) => void }) {
  const mode = (['latest', 'featured', 'selected'].includes(b.mode) ? b.mode : 'latest') as PostsMode;
  const list = Posts.useList();
  const toggleSlug = (slug: string) => {
    const next = b.listItems.includes(slug) ? b.listItems.filter(s => s !== slug) : [...b.listItems, slug];
    update({ listItems: next });
  };
  return (
    <>
      <div className="field"><label>Titre de la section</label><input value={b.title} onChange={e => update({ title: e.target.value })} /></div>
      <div className="field"><label>Source des articles</label>
        <select value={mode} onChange={e => update({ mode: e.target.value })}>
          <option value="latest">Derniers publiés</option>
          <option value="featured">Mis en avant</option>
          <option value="selected">Sélection manuelle</option>
        </select>
      </div>
      {mode === 'latest' && (
        <div className="block-row">
          <div className="field"><label>Catégorie (vide = toutes)</label><input value={b.text} onChange={e => update({ text: e.target.value })} placeholder="ex: Actualités" /></div>
          <div className="field"><label>Nombre d'articles : {b.size}</label><input type="range" min={1} max={12} value={b.size} onChange={e => update({ size: Number(e.target.value) })} /></div>
        </div>
      )}
      {mode === 'featured' && (
        <div className="field"><label>Nombre d'articles : {b.size}</label><input type="range" min={1} max={12} value={b.size} onChange={e => update({ size: Number(e.target.value) })} /></div>
      )}
      {mode === 'selected' && (
        <div className="field">
          <label>Articles à afficher ({b.listItems.filter(Boolean).length} sélectionné·s)</label>
          {list.isLoading ? <p className="meta">Chargement…</p>
            : !list.data?.length ? <p className="meta">Aucun article disponible. Crée des articles dans le module Blog.</p>
              : <div className="options-editor pb-post-picker">
                {list.data.map(p => (
                  <label key={p.id} className="pb-post-pick">
                    <input type="checkbox" checked={b.listItems.includes(p.slug)} onChange={() => toggleSlug(p.slug)} />
                    <span>{p.title}{p.published ? '' : ' (brouillon)'}{p.category ? ` · ${p.category}` : ''}</span>
                  </label>
                ))}
              </div>}
          <span className="hint">Les articles s'affichent dans l'ordre de sélection.</span>
        </div>
      )}
      <p className="hint">Affiché dynamiquement sur le site. Nécessite le module Blog activé.</p>
    </>
  );
}

function PlanningBlockEditor({ b, update }: { b: PageBlock; update: (patch: Partial<PageBlock>) => void }) {
  const list = Plannings.useList();
  return (
    <div className="field"><label>Planning à afficher</label>
      {list.isLoading ? <p className="meta">Chargement…</p>
        : !list.data?.length ? <p className="meta">Aucun planning. Crée-en un dans <b>Planning</b> (menu admin).</p>
          : <select value={b.text} onChange={e => update({ text: e.target.value })}>
              <option value="">Tous les plannings publiés</option>
              {list.data.map(p => <option key={p.id} value={p.slug}>{p.title}</option>)}
            </select>}
      <span className="hint">Affiche la grille colorée du planning. Nécessite le module Planning activé.</span>
    </div>
  );
}

function NoteBlockEditor({ b, update }: { b: PageBlock; update: (patch: Partial<PageBlock>) => void }) {
  return (
    <>
      <div className="field"><label>Notes</label>
        <span className="hint">Crée et édite tes notes ci-dessous, puis clique <b>« Afficher cette note sur la page »</b> pour choisir celle que ce bloc affiche.</span>
        <NotesWorkspace embedded embeddedId={b.size || null} onEmbed={id => update({ size: id })} />
      </div>
      <div className="field"><label>Titre affiché sur la page (optionnel, vide = titre de la note)</label><input value={b.title} onChange={e => update({ title: e.target.value })} /></div>
    </>
  );
}

function ColumnsEditor({ columns, onChange }: { columns: PageBlock[][]; onChange: (columns: PageBlock[][]) => void }) {
  const count = Math.min(Math.max(columns.length, 1), 4);
  const setCount = (n: number) => {
    const next: PageBlock[][] = [];
    for (let i = 0; i < n; i++) next.push(columns[i] ?? []);
    onChange(next);
  };
  const setColumn = (i: number, col: PageBlock[]) => onChange(columns.map((c, j) => j === i ? col : c));

  return (
    <div>
      <div className="field" style={{ maxWidth: 260 }}>
        <label>Nombre de colonnes</label>
        <select value={count} onChange={e => setCount(Number(e.target.value))}>
          <option value={2}>2 colonnes</option>
          <option value={3}>3 colonnes</option>
          <option value={4}>4 colonnes</option>
        </select>
        <span className="hint">Côte à côte sur ordinateur, empilées sur mobile.</span>
      </div>
      {columns.map((col, i) => (
        <div key={i} className="pb-col-edit">
          <div className="pb-col-head">Colonne {i + 1}</div>
          <BlockListEditor blocks={col} onChange={c => setColumn(i, c)} allowColumns={false} compact />
        </div>
      ))}
    </div>
  );
}

function CardsEditor({ items, onChange }: { items: CardItem[]; onChange: (items: CardItem[]) => void }) {
  const set = (i: number, patch: Partial<CardItem>) => onChange(items.map((it, j) => j === i ? { ...it, ...patch } : it));
  return (
    <div className="field">
      <label>Cartes</label>
      <div className="options-editor">
        {items.map((it, i) => (
          <div key={i} className="card" style={{ marginBottom: 8 }}>
            <div className="block-row">
              <div className="field"><label>Titre</label><input value={it.title} onChange={e => set(i, { title: e.target.value })} /></div>
              <div className="field"><label>Lien (optionnel)</label><input value={it.href} onChange={e => set(i, { href: e.target.value })} placeholder="/cv, https://…" /></div>
            </div>
            <div className="field"><label>Texte</label><input value={it.text} onChange={e => set(i, { text: e.target.value })} /></div>
            <button type="button" className="btn danger small" onClick={() => onChange(items.filter((_, j) => j !== i))}>✕ Retirer la carte</button>
          </div>
        ))}
        <button type="button" className="btn secondary small" onClick={() => onChange([...items, { title: `Carte ${items.length + 1}`, text: '', href: '' }])}>+ Ajouter une carte</button>
      </div>
    </div>
  );
}

function PairListEditor({ items, onChange, titleLabel, textLabel, multiline, rich }: { items: CardItem[]; onChange: (items: CardItem[]) => void; titleLabel: string; textLabel: string; multiline?: boolean; rich?: boolean }) {
  const set = (i: number, patch: Partial<CardItem>) => onChange(items.map((it, j) => j === i ? { ...it, ...patch } : it));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items]; [next[i], next[j]] = [next[j], next[i]]; onChange(next);
  };
  return (
    <div className="field">
      <label>Éléments</label>
      <div className="options-editor">
        {items.map((it, i) => (
          <div key={i} className="card" style={{ marginBottom: 8 }}>
            <div className="field"><label>{titleLabel}</label><input value={it.title} onChange={e => set(i, { title: e.target.value })} /></div>
            <div className="field"><label>{textLabel}</label>
              {rich
                ? <RichTextEditor value={it.text} onChange={v => set(i, { text: v })} />
                : multiline
                  ? <textarea value={it.text} onChange={e => set(i, { text: e.target.value })} />
                  : <input value={it.text} onChange={e => set(i, { text: e.target.value })} />}
            </div>
            <div className="actions">
              <button type="button" className="btn secondary small" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
              <button type="button" className="btn secondary small" onClick={() => move(i, 1)} disabled={i === items.length - 1}>↓</button>
              <button type="button" className="btn danger small" onClick={() => onChange(items.filter((_, j) => j !== i))}>✕ Retirer</button>
            </div>
          </div>
        ))}
        <button type="button" className="btn secondary small" onClick={() => onChange([...items, { title: `${titleLabel} ${items.length + 1}`, text: '', href: '' }])}>+ Ajouter</button>
      </div>
    </div>
  );
}

function MediaListEditor({ images, onChange }: { images: MediaItem[]; onChange: (images: MediaItem[]) => void }) {
  const set = (i: number, patch: Partial<MediaItem>) => onChange(images.map((m, j) => j === i ? { ...m, ...patch } : m));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    const next = [...images]; [next[i], next[j]] = [next[j], next[i]]; onChange(next);
  };
  return (
    <div className="field">
      <label>Images (l'ordre = ordre d'affichage)</label>
      <div className="options-editor">
        {images.map((m, i) => (
          <div key={i} className="card" style={{ marginBottom: 8 }}>
            <MediaField label="Image" value={m.url} onChange={url => set(i, { url })} />
            <div className="field"><label>Texte alternatif / légende</label><input value={m.alt} onChange={e => set(i, { alt: e.target.value })} /></div>
            <div className="actions">
              <button type="button" className="btn secondary small" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
              <button type="button" className="btn secondary small" onClick={() => move(i, 1)} disabled={i === images.length - 1}>↓</button>
              <button type="button" className="btn danger small" onClick={() => onChange(images.filter((_, j) => j !== i))}>✕ Retirer</button>
            </div>
          </div>
        ))}
        <button type="button" className="btn secondary small" onClick={() => onChange([...images, { url: '', alt: '' }])}>+ Ajouter une image</button>
      </div>
    </div>
  );
}

function LinksEditor({ links, onChange }: { links: LinkItem[]; onChange: (links: LinkItem[]) => void }) {
  const set = (i: number, patch: Partial<LinkItem>) => onChange(links.map((l, j) => j === i ? { ...l, ...patch } : l));
  return (
    <div className="field">
      <label>Liens (affichés en ligne, séparés par « · »)</label>
      <div className="options-editor">
        {links.map((l, i) => (
          <div key={i} className="option-row option-row-priced">
            <input value={l.label} placeholder="Libellé" onChange={e => set(i, { label: e.target.value })} />
            <input value={l.href} placeholder="https://… ou /page" onChange={e => set(i, { href: e.target.value })} />
            <button type="button" className="btn danger small" onClick={() => onChange(links.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button type="button" className="btn secondary small" onClick={() => onChange([...links, { label: `Lien ${links.length + 1}`, href: 'https://' }])}>+ Ajouter un lien</button>
      </div>
    </div>
  );
}

function SocialEditor({ links, onChange }: { links: LinkItem[]; onChange: (links: LinkItem[]) => void }) {
  const set = (i: number, patch: Partial<LinkItem>) => onChange(links.map((l, j) => j === i ? { ...l, ...patch } : l));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= links.length) return;
    const next = [...links]; [next[i], next[j]] = [next[j], next[i]]; onChange(next);
  };
  const placeholder = (key: string) => key === 'email' ? 'adresse@exemple.com' : 'https://…';
  return (
    <div className="field">
      <label>Réseaux (affichés en boutons)</label>
      <div className="options-editor">
        {links.map((l, i) => (
          <div key={i} className="option-row option-row-priced">
            <select value={l.label} onChange={e => set(i, { label: e.target.value })}>
              {SOCIAL_NETWORKS.map(n => <option key={n.key} value={n.key}>{n.glyph}  {n.label}</option>)}
            </select>
            <input value={l.href} placeholder={placeholder(l.label)} onChange={e => set(i, { href: e.target.value })} />
            <button type="button" className="btn secondary small" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
            <button type="button" className="btn secondary small" onClick={() => move(i, 1)} disabled={i === links.length - 1}>↓</button>
            <button type="button" className="btn danger small" onClick={() => onChange(links.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button type="button" className="btn secondary small" onClick={() => onChange([...links, { label: 'website', href: 'https://' }])}>+ Ajouter un réseau</button>
      </div>
      <span className="hint">Les réseaux sans lien rempli ne sont pas affichés. Pour l'email, saisis simplement l'adresse.</span>
    </div>
  );
}

function ListEditor({ items, onChange }: { items: string[]; onChange: (items: string[]) => void }) {
  return (
    <div className="field">
      <label>Éléments</label>
      <div className="options-editor">
        {items.map((it, i) => (
          <div key={i} className="option-row">
            <input value={it} onChange={e => onChange(items.map((o, j) => j === i ? e.target.value : o))} />
            <button type="button" className="btn danger small" onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button type="button" className="btn secondary small" onClick={() => onChange([...items, `Élément ${items.length + 1}`])}>+ Ajouter un élément</button>
      </div>
    </div>
  );
}

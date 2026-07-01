// Modèle de blocs du page builder + rendu HTML (réutilise les classes publiques .hero/.card/.grid/.rich).
// Le builder_json stocke { version, blocks }. L'utilisateur n'édite jamais ce JSON : tout passe par l'UI.

export type PageBlockType = 'hero' | 'heading' | 'text' | 'image' | 'button' | 'cards' | 'list' | 'links' | 'social' | 'gallery' | 'carousel' | 'reader' | 'video' | 'accordion' | 'tabs' | 'quote' | 'note' | 'cta' | 'stats' | 'latestposts' | 'agenda' | 'planning' | 'glossaire' | 'spacer' | 'columns' | 'divider' | 'html';

/** Mode de sélection du bloc « articles ». */
export type PostsMode = 'latest' | 'featured' | 'selected';

/** Réseaux sociaux connus du bloc « social » : clé (= valeur stockée dans link.label), nom affiché et glyphe. */
export const SOCIAL_NETWORKS: Array<{ key: string; label: string; glyph: string }> = [
  { key: 'x', label: 'X', glyph: '𝕏' },
  { key: 'facebook', label: 'Facebook', glyph: 'f' },
  { key: 'instagram', label: 'Instagram', glyph: '📷' },
  { key: 'linkedin', label: 'LinkedIn', glyph: 'in' },
  { key: 'youtube', label: 'YouTube', glyph: '▶' },
  { key: 'tiktok', label: 'TikTok', glyph: '♪' },
  { key: 'github', label: 'GitHub', glyph: '⌥' },
  { key: 'whatsapp', label: 'WhatsApp', glyph: '✆' },
  { key: 'deviantart', label: 'DeviantArt', glyph: 'Ⓓ' },
  { key: 'pinterest', label: 'Pinterest', glyph: 'P' },
  { key: 'discord', label: 'Discord', glyph: '🎮' },
  { key: 'twitch', label: 'Twitch', glyph: '🎬' },
  { key: 'email', label: 'Email', glyph: '✉' },
  { key: 'website', label: 'Site web', glyph: '🌐' },
];
const SOCIAL_BY_KEY: Record<string, { label: string; glyph: string }> = Object.fromEntries(
  SOCIAL_NETWORKS.map(n => [n.key, { label: n.label, glyph: n.glyph }]),
);

export interface CardItem { title: string; text: string; href: string }
export interface LinkItem { label: string; href: string }
export interface MediaItem { url: string; alt: string }

export interface PageBlock {
  id: string;
  type: PageBlockType;
  eyebrow: string;     // hero
  title: string;       // hero
  subtitle: string;    // hero
  level: 2 | 3;        // heading
  text: string;        // heading / text
  url: string;         // image
  alt: string;         // image
  label: string;       // button
  href: string;        // button
  variant: 'primary' | 'secondary'; // button
  items: CardItem[];   // cards
  listItems: string[]; // list
  links: LinkItem[];   // links
  images: MediaItem[]; // gallery / carousel / reader
  videoUrl: string;    // video (URL ou ID YouTube)
  size: number;        // spacer (hauteur en px) / latestposts / agenda (nombre d'éléments) / image (largeur en %)
  mode: string;        // latestposts : 'latest' | 'featured' | 'selected' ; les slugs choisis vivent dans listItems
  columns: PageBlock[][]; // columns : tableau de colonnes, chaque colonne = liste de blocs enfants
  html: string;        // html
  bgColor: string;     // bouton : couleur de fond personnalisée (hex), vide = thème
  fgColor: string;     // bouton : couleur du texte personnalisée (hex)
  effect: string;      // bouton : effet ('none' | 'lift' | 'glow' | 'shadow' | 'pulse')
}

/** Effets disponibles sur le bloc bouton. */
export const BUTTON_EFFECTS: Array<{ key: string; label: string }> = [
  { key: 'none', label: 'Aucun' },
  { key: 'lift', label: 'Élévation au survol' },
  { key: 'glow', label: 'Lueur au survol' },
  { key: 'shadow', label: 'Ombre portée' },
  { key: 'pulse', label: 'Pulsation' },
];

export const PAGE_BLOCK_PALETTE: Array<{ type: PageBlockType; label: string; icon: string }> = [
  { type: 'hero', label: 'En-tête (hero)', icon: '🏷️' },
  { type: 'heading', label: 'Titre', icon: 'H' },
  { type: 'text', label: 'Texte', icon: '¶' },
  { type: 'image', label: 'Image', icon: '🖼️' },
  { type: 'button', label: 'Bouton', icon: '🔘' },
  { type: 'cards', label: 'Cartes (grille)', icon: '▦' },
  { type: 'list', label: 'Liste à puces', icon: '•' },
  { type: 'links', label: 'Liens (ligne)', icon: '🔗' },
  { type: 'social', label: 'Réseaux sociaux', icon: '📱' },
  { type: 'gallery', label: 'Galerie', icon: '🖼' },
  { type: 'carousel', label: 'Carrousel', icon: '🎠' },
  { type: 'reader', label: 'Liseuse BD', icon: '📖' },
  { type: 'video', label: 'Vidéo YouTube', icon: '▶' },
  { type: 'accordion', label: 'Accordéon / FAQ', icon: '🔽' },
  { type: 'tabs', label: 'Onglets', icon: '🗂' },
  { type: 'quote', label: 'Citation', icon: '❝' },
  { type: 'note', label: 'Note (module Notes)', icon: '🗒️' },
  { type: 'cta', label: 'Bandeau CTA', icon: '📣' },
  { type: 'stats', label: 'Statistiques', icon: '📊' },
  { type: 'latestposts', label: 'Articles', icon: '🗞' },
  { type: 'agenda', label: 'Agenda (événements)', icon: '📅' },
  { type: 'planning', label: 'Planning (grille)', icon: '🗓️' },
  { type: 'glossaire', label: 'Glossaire TSSR', icon: '📖' },
  { type: 'spacer', label: 'Espaceur', icon: '↕' },
  { type: 'columns', label: 'Colonnes', icon: '▥' },
  { type: 'divider', label: 'Séparateur', icon: '—' },
  { type: 'html', label: 'HTML brut', icon: '</>' },
];

export const BLOCK_LABELS: Record<PageBlockType, string> = Object.fromEntries(
  PAGE_BLOCK_PALETTE.map(p => [p.type, p.label]),
) as Record<PageBlockType, string>;

let counter = 0;
function uid() { counter += 1; return `pb-${Date.now()}-${counter}`; }

export function makePageBlock(type: PageBlockType): PageBlock {
  const titleDefaults: Partial<Record<PageBlockType, string>> = { hero: 'Titre principal', cta: 'Titre de la bannière', latestposts: 'Derniers articles', agenda: 'Agenda' };
  const subtitleDefaults: Partial<Record<PageBlockType, string>> = { hero: 'Sous-titre descriptif.', cta: 'Un sous-titre incitatif pour pousser à l’action.' };
  const textDefaults: Partial<Record<PageBlockType, string>> = { heading: 'Nouveau titre', text: 'Votre texte ici…', quote: 'Une citation qui inspire confiance.' };
  const labelDefaults: Partial<Record<PageBlockType, string>> = { button: 'En savoir plus', cta: 'Agir maintenant', quote: 'Auteur' };
  const hrefDefaults: Partial<Record<PageBlockType, string>> = { button: '/', cta: '/' };

  const pairItems = (a: string, b: string): CardItem[] => [{ title: `${a} 1`, text: b, href: '' }, { title: `${a} 2`, text: b, href: '' }];
  let items: CardItem[] = [];
  if (type === 'cards') items = [{ title: 'Carte 1', text: 'Description', href: '' }, { title: 'Carte 2', text: 'Description', href: '' }];
  else if (type === 'accordion') items = pairItems('Question', 'Réponse…');
  else if (type === 'tabs') items = pairItems('Onglet', 'Contenu de l’onglet…');
  else if (type === 'stats') items = [{ title: '100+', text: 'Clients', href: '' }, { title: '24/7', text: 'Support', href: '' }, { title: '5★', text: 'Satisfaction', href: '' }];

  return {
    id: uid(), type,
    eyebrow: type === 'hero' ? 'Mon Site' : type === 'cta' ? 'Appel à l’action' : '',
    title: titleDefaults[type] || '',
    subtitle: subtitleDefaults[type] || '',
    level: 2,
    text: textDefaults[type] || '',
    url: '', alt: '',
    label: labelDefaults[type] || '',
    href: hrefDefaults[type] || '',
    variant: 'primary',
    mode: type === 'latestposts' ? 'latest' : '',
    items,
    listItems: type === 'list' ? ['Premier élément', 'Deuxième élément'] : [],
    links: type === 'links' ? [{ label: 'Lien 1', href: 'https://' }, { label: 'Lien 2', href: 'https://' }]
      : type === 'social' ? [{ label: 'x', href: '' }, { label: 'instagram', href: '' }] : [],
    images: (type === 'gallery' || type === 'carousel' || type === 'reader') ? [{ url: '', alt: '' }, { url: '', alt: '' }] : [],
    videoUrl: '',
    size: type === 'spacer' ? 32 : type === 'latestposts' ? 3 : type === 'image' ? 100 : 0,
    columns: type === 'columns' ? [[Object.assign(makePageBlock('text'), { text: 'Colonne 1' })], [Object.assign(makePageBlock('text'), { text: 'Colonne 2' })]] : [],
    html: '',
    bgColor: '', fgColor: '', effect: 'none',
  };
}

const TYPES = PAGE_BLOCK_PALETTE.map(p => p.type);
function normalizeOne(b: any): PageBlock {
  return {
    id: b?.id || uid(),
    type: TYPES.includes(b?.type) ? b.type : 'text',
    eyebrow: b?.eyebrow || '',
    title: b?.title || '',
    subtitle: b?.subtitle || '',
    level: b?.level === 3 ? 3 : 2,
    text: b?.text || '',
    url: b?.url || '',
    alt: b?.alt || '',
    label: b?.label || '',
    href: b?.href || '',
    variant: b?.variant === 'secondary' ? 'secondary' : 'primary',
    items: Array.isArray(b?.items) ? b.items.map((it: any) => ({ title: it?.title || '', text: it?.text || '', href: it?.href || '' })) : [],
    listItems: Array.isArray(b?.listItems) ? b.listItems.map((s: any) => String(s)) : [],
    links: Array.isArray(b?.links) ? b.links.map((l: any) => ({ label: l?.label || '', href: l?.href || '' })) : [],
    images: Array.isArray(b?.images) ? b.images.map((m: any) => ({ url: m?.url || '', alt: m?.alt || '' })) : [],
    videoUrl: b?.videoUrl || '',
    size: Number.isFinite(b?.size) ? b.size : 0,
    mode: typeof b?.mode === 'string' ? b.mode : '',
    columns: Array.isArray(b?.columns) ? b.columns.map((col: any) => Array.isArray(col) ? col.map(normalizeOne) : []) : [],
    html: b?.html || '',
    bgColor: b?.bgColor || '',
    fgColor: b?.fgColor || '',
    effect: b?.effect || 'none',
  };
}

export function normalizePageBlocks(builderJson: string | undefined | null): PageBlock[] {
  try {
    const parsed = JSON.parse(builderJson || '');
    const arr = Array.isArray(parsed) ? parsed : parsed?.blocks;
    if (!Array.isArray(arr)) return [];
    return arr.map(normalizeOne);
  } catch {
    return [];
  }
}

export function serializePageBlocks(blocks: PageBlock[]): string {
  return JSON.stringify({ version: 1, blocks });
}

// ===== Rendu HTML =====
const esc = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const paragraphs = (t = '') =>
  t.split(/\n{2,}/).map(p => p.trim()).filter(Boolean).map(p => `<p>${esc(p).replace(/\n/g, '<br/>')}</p>`).join('');
// Contenu d'onglet/accordéon : si déjà du HTML (éditeur riche), on le rend tel quel ; sinon texte → paragraphes.
const richOrPara = (t = '') => /</.test(t) ? t : paragraphs(t);

/** Extrait l'identifiant d'une vidéo YouTube depuis une URL (watch, youtu.be, embed, shorts) ou un ID brut. */
export function youTubeId(url: string): string {
  const u = (url || '').trim();
  const m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([\w-]{11})/);
  if (m) return m[1];
  if (/^[\w-]{11}$/.test(u)) return u;
  return '';
}
const validImages = (imgs: MediaItem[]) => imgs.filter(i => i.url.trim());

function renderBlock(b: PageBlock): string {
  switch (b.type) {
    case 'hero':
      return `<section class="hero">${b.eyebrow ? `<span class="pill">${esc(b.eyebrow)}</span>` : ''}`
        + `${b.title ? `<h1>${esc(b.title)}</h1>` : ''}${b.subtitle ? `<p>${esc(b.subtitle)}</p>` : ''}</section>`;
    case 'heading':
      return `<h${b.level}>${esc(b.text)}</h${b.level}>`;
    case 'text':
      return paragraphs(b.text);
    case 'image': {
      if (!b.url) return '';
      const w = b.size > 0 && b.size <= 100 ? b.size : 100; // largeur d'affichage en %
      return `<p style="text-align:center"><img src="${esc(b.url)}" alt="${esc(b.alt)}" style="width:${w}%;border-radius:8px"/></p>`;
    }
    case 'button': {
      if (!b.label) return '';
      const fx = b.effect && b.effect !== 'none' ? ` pb-fx-${esc(b.effect)}` : '';
      const custom = (b.bgColor || b.fgColor) ? ' pb-btn-custom' : '';
      const style = custom ? ` style="${b.bgColor ? `--pb-btn-bg:${esc(b.bgColor)};` : ''}${b.fgColor ? `--pb-btn-fg:${esc(b.fgColor)};` : ''}"` : '';
      return `<p><a class="btn${b.variant === 'secondary' ? ' secondary' : ''}${custom}${fx}"${style} href="${esc(b.href || '#')}">${esc(b.label)}</a></p>`;
    }
    case 'cards': {
      const cards = b.items.map(it => {
        const inner = `${it.title ? `<h3>${esc(it.title)}</h3>` : ''}${it.text ? `<p class="meta">${esc(it.text)}</p>` : ''}`;
        return it.href
          ? `<a class="card" href="${esc(it.href)}" style="text-decoration:none">${inner}</a>`
          : `<div class="card">${inner}</div>`;
      }).join('');
      return `<div class="grid">${cards}</div>`;
    }
    case 'list':
      return `<ul>${b.listItems.filter(Boolean).map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;
    case 'links': {
      const items = b.links.filter(l => l.label).map(l => {
        const ext = /^https?:/i.test(l.href);
        return `<a href="${esc(l.href || '#')}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(l.label)}</a>`;
      });
      return items.length ? `<p class="meta">${items.join(' · ')}</p>` : '';
    }
    case 'social': {
      const items = b.links.filter(l => l.href.trim()).map(l => {
        const key = (l.label || 'website').toLowerCase();
        const net = SOCIAL_BY_KEY[key] || { label: l.label || 'Lien', glyph: '🌐' };
        let href = l.href.trim();
        if (key === 'email' && !/^(mailto:|https?:)/i.test(href)) href = `mailto:${href}`;
        const ext = /^https?:/i.test(href);
        return `<a class="pb-social-link pb-social-${esc(key)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''} href="${esc(href)}" aria-label="${esc(net.label)}">`
          + `<span class="pb-social-glyph" aria-hidden="true">${esc(net.glyph)}</span><span class="pb-social-name">${esc(net.label)}</span></a>`;
      });
      return items.length ? `<div class="pb-social">${items.join('')}</div>` : '';
    }
    case 'gallery': {
      const imgs = validImages(b.images);
      if (!imgs.length) return '';
      const gid = `${b.id}-g`;
      const thumbs = imgs.map((i, idx) =>
        `<figure class="pb-gallery-item"><a href="#${b.id}-lb-${idx}"><img src="${esc(i.url)}" alt="${esc(i.alt)}" loading="lazy"/></a></figure>`).join('');
      // Lightbox CSS pur via :target (clic = plein écran, fond/✕ = fermer).
      const boxes = imgs.map((i, idx) =>
        `<div id="${b.id}-lb-${idx}" class="pb-lightbox"><a class="pb-lightbox-bg" href="#${gid}" aria-label="Fermer"></a><img src="${esc(i.url)}" alt="${esc(i.alt)}"/><a class="pb-lightbox-close" href="#${gid}" aria-label="Fermer">✕</a></div>`).join('');
      return `<div id="${gid}" class="pb-gallery">${thumbs}</div>${boxes}`;
    }
    case 'carousel': {
      const imgs = validImages(b.images);
      if (!imgs.length) return '';
      // Flèches de navigation par ancres (scroll-snap amène la diapo voisine).
      const slides = imgs.map((i, idx) => {
        const prev = idx > 0 ? `<a class="pb-nav pb-nav-prev" href="#${b.id}-s-${idx - 1}" aria-label="Diapo précédente">‹</a>` : '';
        const next = idx < imgs.length - 1 ? `<a class="pb-nav pb-nav-next" href="#${b.id}-s-${idx + 1}" aria-label="Diapo suivante">›</a>` : '';
        return `<figure class="pb-slide" id="${b.id}-s-${idx}"><img src="${esc(i.url)}" alt="${esc(i.alt)}" loading="lazy"/>${i.alt ? `<figcaption>${esc(i.alt)}</figcaption>` : ''}${prev}${next}</figure>`;
      }).join('');
      return `<div class="pb-carousel">${slides}</div>`;
    }
    case 'reader': {
      const imgs = validImages(b.images);
      if (!imgs.length) return '';
      const pages = imgs.map((i, idx) => `<div class="pb-page"><img src="${esc(i.url)}" alt="${esc(i.alt) || `Page ${idx + 1}`}" loading="lazy"/></div>`).join('');
      return `<div class="pb-reader"><div class="pb-reader-track">${pages}</div><p class="pb-reader-hint meta">Fais défiler / glisse pour tourner les pages (${imgs.length})</p></div>`;
    }
    case 'video': {
      const id = youTubeId(b.videoUrl);
      if (!id) return '';
      return `<div class="pb-video"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="Vidéo YouTube" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`;
    }
    case 'accordion': {
      if (!b.items.length) return '';
      return `<div class="pb-accordion">${b.items.map(it => `<details class="pb-acc"><summary>${esc(it.title)}</summary><div class="pb-acc-body">${richOrPara(it.text)}</div></details>`).join('')}</div>`;
    }
    case 'tabs': {
      const tabs = b.items.slice(0, 6); // CSS :checked plafonné à 6 onglets
      if (!tabs.length) return '';
      const name = `tabs-${b.id}`;
      const radios = tabs.map((_, i) => `<input type="radio" name="${name}" id="${b.id}-tab-${i}" class="pb-tab-radio"${i === 0 ? ' checked' : ''}/>`).join('');
      const labels = tabs.map((it, i) => `<label class="pb-tab-label" for="${b.id}-tab-${i}">${esc(it.title)}</label>`).join('');
      const panels = tabs.map(it => `<div class="pb-tab-panel">${richOrPara(it.text)}</div>`).join('');
      return `<div class="pb-tabs">${radios}<div class="pb-tab-labels">${labels}</div><div class="pb-tab-panels">${panels}</div></div>`;
    }
    case 'quote':
      return `<blockquote class="pb-quote"><p>${esc(b.text)}</p>${b.label ? `<cite>— ${esc(b.label)}</cite>` : ''}</blockquote>`;
    case 'note': {
      // Embarque une note du module Notes (contenu vivant, hydraté côté public).
      if (!b.size) return '';
      return `<div class="pb-dynamic" data-block="note" data-note-id="${b.size}" data-title="${esc(b.title)}"></div>`;
    }
    case 'cta':
      return `<section class="pb-cta">${b.eyebrow ? `<span class="pill">${esc(b.eyebrow)}</span>` : ''}`
        + `${b.title ? `<h2>${esc(b.title)}</h2>` : ''}${b.subtitle ? `<p>${esc(b.subtitle)}</p>` : ''}`
        + `${b.label ? `<p><a class="btn${b.variant === 'secondary' ? ' secondary' : ''}" href="${esc(b.href || '#')}">${esc(b.label)}</a></p>` : ''}</section>`;
    case 'stats': {
      if (!b.items.length) return '';
      return `<div class="pb-stats">${b.items.map(it => `<div class="pb-stat"><span class="pb-stat-value">${esc(it.title)}</span><span class="pb-stat-label">${esc(it.text)}</span></div>`).join('')}</div>`;
    }
    case 'spacer':
      return `<div class="pb-spacer" style="height:${Math.max(0, Math.min(240, b.size))}px" aria-hidden="true"></div>`;
    case 'latestposts': {
      const n = Math.max(1, Math.min(12, b.size || 3));
      const mode = (['latest', 'featured', 'selected'].includes(b.mode) ? b.mode : 'latest');
      const slugs = mode === 'selected' ? b.listItems.filter(Boolean).join(',') : '';
      return `<div class="pb-dynamic" data-block="latest-posts" data-mode="${esc(mode)}" data-count="${n}" data-category="${esc(b.text)}" data-slugs="${esc(slugs)}" data-title="${esc(b.title)}"></div>`;
    }
    case 'agenda': {
      const n = Math.max(1, Math.min(12, b.size || 3));
      return `<div class="pb-dynamic" data-block="events" data-count="${n}" data-title="${esc(b.title)}"></div>`;
    }
    case 'planning':
      return `<div class="pb-dynamic" data-block="planning" data-slug="${esc(b.text)}"></div>`;
    case 'glossaire':
      return `<div class="pb-dynamic" data-block="glossaire"></div>`;
    case 'columns': {
      const n = Math.min(Math.max(b.columns.length, 1), 4);
      const inner = b.columns.map(col => `<div class="pb-col">${renderPageBlocksToHtml(col)}</div>`).join('');
      return `<div class="pb-columns" style="--cols:${n}">${inner}</div>`;
    }
    case 'divider':
      return `<hr/>`;
    case 'html':
      return b.html || '';
    default:
      return '';
  }
}

export function renderPageBlocksToHtml(blocks: PageBlock[]): string {
  return blocks.map(renderBlock).join('\n');
}

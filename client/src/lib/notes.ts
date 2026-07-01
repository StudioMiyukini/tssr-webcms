// Utilitaires purs pour le module Notes (réutilisés par la liste + l'éditeur, testables sans DOM).

/** Retire les balises HTML et décode les entités courantes → texte brut. */
export function stripHtml(html: string): string {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Aperçu tronqué pour la liste des notes. */
export function noteSnippet(html: string, len = 140): string {
  const t = stripHtml(html);
  return t.length > len ? `${t.slice(0, len).trimEnd()}…` : t;
}

/** Nombre de mots (0 si vide). */
export function wordCount(html: string): number {
  const t = stripHtml(html);
  return t ? t.split(/\s+/).length : 0;
}

/** Titre affiché, avec repli si vide. */
export function noteTitleOr(title: string, fallback = 'Sans titre'): string {
  return (title || '').trim() || fallback;
}

/** Date relative en français (« à l'instant », « il y a 5 min », « hier », sinon date courte). */
export function relativeTime(iso: string, nowMs: number): string {
  if (!iso) return '';
  // SQLite renvoie « YYYY-MM-DD HH:MM:SS » en UTC → on normalise en ISO UTC.
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  const t = d.getTime();
  if (isNaN(t)) return iso;
  const diff = Math.max(0, nowMs - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} j`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const NOTE_COLORS: Array<{ key: string; label: string }> = [
  { key: '', label: 'Aucune' },
  { key: 'yellow', label: 'Jaune' },
  { key: 'green', label: 'Vert' },
  { key: 'blue', label: 'Bleu' },
  { key: 'pink', label: 'Rose' },
  { key: 'purple', label: 'Violet' },
  { key: 'orange', label: 'Orange' },
  { key: 'gray', label: 'Gris' },
];

import { usePublicNote } from '@/api/public';
import { sanitizeHtml } from '@/lib/sanitize';

/** Îlot dynamique : affiche une note du module Notes (contenu HTML riche), choisie dans le page builder. */
/*
 * @id     tssr.compNoteEmbed
 * @do     integrer_note
 * @role   ui
 * @layer  ui
 * @human  Encart intégrant une note dans une page.
 */
export function NoteEmbed({ noteId, title }: { noteId: number; title: string }) {
  const note = usePublicNote(noteId);
  if (note.isLoading || note.isError || !note.data) return null;
  const heading = title || note.data.title;
  const color = note.data.color ? ` pb-note-${note.data.color}` : '';
  return (
    <aside className={`pb-note${color}`}>
      {heading && <h3 className="pb-note-title">{heading}</h3>}
      <div className="rich" dangerouslySetInnerHTML={{ __html: sanitizeHtml(note.data.content) }} />
    </aside>
  );
}

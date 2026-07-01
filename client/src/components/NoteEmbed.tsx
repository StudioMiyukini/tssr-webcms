import { usePublicNote } from '@/api/public';

/** Îlot dynamique : affiche une note du module Notes (contenu HTML riche), choisie dans le page builder. */
export function NoteEmbed({ noteId, title }: { noteId: number; title: string }) {
  const note = usePublicNote(noteId);
  if (note.isLoading || note.isError || !note.data) return null;
  const heading = title || note.data.title;
  const color = note.data.color ? ` pb-note-${note.data.color}` : '';
  return (
    <aside className={`pb-note${color}`}>
      {heading && <h3 className="pb-note-title">{heading}</h3>}
      <div className="rich" dangerouslySetInnerHTML={{ __html: note.data.content }} />
    </aside>
  );
}

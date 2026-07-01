import { useSiteAccess } from '@/api/public';
import { NoteEmbed } from './NoteEmbed';
import { NotesWorkspace } from '@/pages/Notes';

/** Bloc note public : interface Notes complète (CRUD) pour un visiteur débloqué d'un site privé,
 *  sinon affichage en lecture seule de la note choisie. */
export function PublicNoteBlock({ noteId, title }: { noteId: number; title: string }) {
  const access = useSiteAccess();
  if (access.data?.private && access.data.unlocked) return <NotesWorkspace embedded />;
  return <NoteEmbed noteId={noteId} title={title} />;
}

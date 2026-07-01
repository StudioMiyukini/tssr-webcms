import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiPut } from '@/api/client';
import {
  useNotes, useNote, useCreateNote, useDeleteNote,
  useNoteFolders, useCreateNoteFolder, useRenameNoteFolder, useDeleteNoteFolder,
  type NoteRow, type NoteRecord, type NoteFolderRow,
} from '@/api/hooks';
import { useToast } from '@/lib/toast';
import { noteSnippet, noteTitleOr, relativeTime, wordCount, NOTE_COLORS } from '@/lib/notes';

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved';

interface WorkspaceProps {
  /** Mode embarqué (hauteur contrainte + cadre) — ex. dans le bloc note du page builder. */
  embedded?: boolean;
  /** Id de la note actuellement affichée sur la page (mode embarqué). */
  embeddedId?: number | null;
  /** Callback pour désigner la note à afficher sur la page (active la barre « Afficher sur la page »). */
  onEmbed?: (id: number) => void;
}

/** Wrapper pour la route /admin/notes. */
export function NotesPage() { return <NotesWorkspace />; }

/** Espace de travail Notes complet (liste + dossiers + recherche + éditeur riche), réutilisable. */
export function NotesWorkspace({ embedded = false, embeddedId = null, onEmbed }: WorkspaceProps = {}) {
  const qc = useQueryClient();
  const { push } = useToast();
  const [archived, setArchived] = useState(false);
  const [folder, setFolder] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => { const t = setTimeout(() => setSearchQ(search.trim()), 250); return () => clearTimeout(t); }, [search]);

  const params = { archived, folder: archived ? null : folder, q: searchQ };
  const list = useNotes(params);
  const folders = useNoteFolders();
  const note = useNote(selectedId);
  const createNote = useCreateNote();
  const deleteNote = useDeleteNote();
  const createFolder = useCreateNoteFolder();
  const renameFolder = useRenameNoteFolder();
  const deleteFolder = useDeleteNoteFolder();

  // Met à jour une ligne de toutes les listes en cache, sans refetch (frappe fluide).
  const patchRow = useCallback((id: number, fields: Partial<NoteRow>) => {
    qc.setQueriesData<NoteRow[]>({ queryKey: ['notes'] }, (old) => old ? old.map(r => r.id === id ? { ...r, ...fields } : r) : old);
  }, [qc]);
  const afterContentSave = useCallback((id: number, title: string, html: string, updated_at: string) => {
    patchRow(id, { title, snippet: noteSnippet(html), updated_at });
  }, [patchRow]);
  const afterMetaSave = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['notes'] });
    qc.invalidateQueries({ queryKey: ['note-folders'] });
  }, [qc]);

  const onNew = () => createNote.mutate({ folder_id: archived ? 0 : (folder ?? 0) }, {
    onSuccess: (rec) => { setSelectedId(rec.id); setTimeout(() => document.getElementById('note-title-input')?.focus(), 60); },
    onError: () => push('Impossible de créer la note.', 'error'),
  });
  const onDelete = (id: number) => {
    if (!confirm('Supprimer définitivement cette note ?')) return;
    deleteNote.mutate(id, { onSuccess: () => { if (selectedId === id) setSelectedId(null); }, onError: () => push('Échec de la suppression.', 'error') });
  };

  const onAddFolder = () => { const name = prompt('Nom du dossier'); if (name?.trim()) createFolder.mutate(name.trim()); };
  const onRenameFolder = (f: NoteFolderRow) => { const name = prompt('Renommer le dossier', f.name); if (name?.trim() && name.trim() !== f.name) renameFolder.mutate({ id: f.id, name: name.trim() }); };
  const onDeleteFolder = (f: NoteFolderRow) => { if (confirm(`Supprimer le dossier « ${f.name} » ? Les notes seront conservées (sans dossier).`)) { deleteFolder.mutate(f.id); if (folder === f.id) setFolder(null); } };

  const rows = list.data ?? [];
  const now = Date.now();

  return (
    <div className={`notes-layout ${selectedId != null ? 'show-editor' : ''} ${embedded ? 'embedded' : ''}`}>
      {/* ===== Panneau gauche : dossiers + recherche + liste ===== */}
      <aside className="notes-side">
        <div className="notes-side-top">
          <button className="btn" onClick={onNew} disabled={createNote.isPending}>＋ Nouvelle note</button>
          <input className="notes-search" type="search" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <nav className="notes-folders">
          <button className={`notes-folder ${!archived && folder === null ? 'active' : ''}`} onClick={() => { setArchived(false); setFolder(null); }}>
            <span>🗒️ Toutes les notes</span>
          </button>
          {(folders.data ?? []).map(f => (
            <div key={f.id} className={`notes-folder ${!archived && folder === f.id ? 'active' : ''}`}>
              <button className="notes-folder-main" onClick={() => { setArchived(false); setFolder(f.id); }}>
                <span>📁 {f.name}</span><span className="notes-folder-count">{f.count}</span>
              </button>
              <button className="notes-folder-act" title="Renommer" onClick={() => onRenameFolder(f)}>✏️</button>
              <button className="notes-folder-act" title="Supprimer le dossier" onClick={() => onDeleteFolder(f)}>🗑️</button>
            </div>
          ))}
          <button className="notes-folder add" onClick={onAddFolder}>＋ Nouveau dossier</button>
          <button className={`notes-folder ${archived ? 'active' : ''}`} onClick={() => { setArchived(true); setFolder(null); }}>
            <span>🗄️ Archivées</span>
          </button>
        </nav>

        <div className="notes-list">
          {list.isLoading && <div className="loading">Chargement…</div>}
          {!list.isLoading && rows.length === 0 && <div className="empty small">{searchQ ? 'Aucun résultat.' : archived ? 'Aucune note archivée.' : 'Aucune note. Créez-en une !'}</div>}
          {rows.map(r => (
            <button key={r.id} className={`note-card ${r.color ? `note-color-${r.color}` : ''} ${selectedId === r.id ? 'active' : ''}`} onClick={() => setSelectedId(r.id)}>
              <div className="note-card-head">
                <span className="note-card-title">{r.pinned ? '📌 ' : ''}{noteTitleOr(r.title)}</span>
                {onEmbed && embeddedId === r.id && <span className="note-embed-badge" title="Affichée sur la page">● page</span>}
              </div>
              {r.snippet && <span className="note-card-snippet">{r.snippet}</span>}
              <span className="note-card-date">{relativeTime(r.updated_at, now)}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* ===== Panneau droit : éditeur ===== */}
      <section className="notes-main">
        {onEmbed && (
          <div className="notes-embed-bar">
            {selectedId == null
              ? <span className="meta">Sélectionne une note, puis « Afficher sur la page ».</span>
              : embeddedId === selectedId
                ? <span className="meta on">✓ Cette note est affichée dans le bloc.</span>
                : <button type="button" className="btn small" onClick={() => onEmbed(selectedId)}>📌 Afficher cette note sur la page</button>}
          </div>
        )}
        {selectedId == null ? (
          <div className="notes-empty">
            <div>
              <p style={{ fontSize: 40, margin: 0 }}>🗒️</p>
              <h2>Prise de notes</h2>
              <p className="meta">Sélectionnez une note ou créez-en une. Tout est enregistré automatiquement pendant que vous écrivez.</p>
              <button className="btn" onClick={onNew} disabled={createNote.isPending}>＋ Nouvelle note</button>
            </div>
          </div>
        ) : note.isLoading || !note.data ? (
          <div className="loading">Chargement…</div>
        ) : (
          <NoteEditor
            key={note.data.id}
            note={note.data}
            folders={folders.data ?? []}
            onAfterContentSave={afterContentSave}
            onAfterMetaSave={afterMetaSave}
            onClose={() => setSelectedId(null)}
            onDelete={() => onDelete(note.data!.id)}
          />
        )}
      </section>
    </div>
  );
}

interface EditorProps {
  note: NoteRecord;
  folders: NoteFolderRow[];
  onAfterContentSave: (id: number, title: string, html: string, updated_at: string) => void;
  onAfterMetaSave: () => void;
  onClose: () => void;
  onDelete: () => void;
}

function NoteEditor({ note, folders, onAfterContentSave, onAfterMetaSave, onClose, onDelete }: EditorProps) {
  const { push } = useToast();
  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef(note.title);
  const dirtyRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [title, setTitle] = useState(note.title);
  const [color, setColor] = useState(note.color);
  const [folderId, setFolderId] = useState(note.folder_id);
  const [pinned, setPinned] = useState(!!note.pinned);
  const [archived, setArchived] = useState(!!note.archived);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [words, setWords] = useState(() => wordCount(note.content));
  const [showColors, setShowColors] = useState(false);

  // Le composant est remonté à chaque note (key) → on initialise le corps une fois.
  useEffect(() => { if (editorRef.current) editorRef.current.innerHTML = note.content || ''; }, []);

  const persist = useCallback(async (extra: Record<string, unknown>, meta = false) => {
    const html = editorRef.current?.innerHTML ?? '';
    setStatus('saving');
    try {
      const r = await apiPut<{ ok: boolean; updated_at: string }>(`/api/admin/notes/${note.id}`, { title: titleRef.current, content: html, ...extra });
      dirtyRef.current = false;
      setStatus('saved');
      if (meta) onAfterMetaSave(); else onAfterContentSave(note.id, titleRef.current, html, r.updated_at);
    } catch {
      setStatus('idle');
      push('Échec de la sauvegarde automatique.', 'error');
    }
  }, [note.id, onAfterContentSave, onAfterMetaSave, push]);

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    setStatus('pending');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => persist({}), 800);
  }, [persist]);

  // Flush à la fermeture / changement de note (sauvegarde immédiate si modifications en attente).
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (dirtyRef.current) {
      const html = editorRef.current?.innerHTML ?? '';
      apiPut(`/api/admin/notes/${note.id}`, { title: titleRef.current, content: html }).catch(() => {});
    }
  }, [note.id]);

  const onInput = () => {
    if (editorRef.current) setWords(wordCount(editorRef.current.innerText));
    scheduleSave();
  };
  const onTitle = (v: string) => { setTitle(v); titleRef.current = v; scheduleSave(); };

  // Boutons de mise en forme (execCommand : sans dépendance, supporté partout).
  const exec = (cmd: string, val?: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    onInput();
  };

  const setColorNow = (c: string) => { setColor(c); setShowColors(false); persist({ color: c }, true); };
  const changeFolder = (f: number) => { setFolderId(f); persist({ folder_id: f }, true); };
  const togglePin = () => { const p = pinned ? 0 : 1; setPinned(!!p); persist({ pinned: p }, true); };
  const toggleArchive = async () => { const a = archived ? 0 : 1; setArchived(!!a); await persist({ archived: a }, true); onClose(); };

  const statusLabel = status === 'saving' ? 'Enregistrement…' : status === 'pending' ? 'Modifié…' : status === 'saved' ? '✓ Enregistré' : 'Enregistré';

  return (
    <div className={`note-editor ${color ? `note-color-${color}` : ''}`}>
      <header className="note-editor-bar">
        <button className="btn secondary small note-back" onClick={onClose} title="Retour">←</button>
        <input id="note-title-input" className="note-title-input" value={title} onChange={e => onTitle(e.target.value)} placeholder="Titre de la note" />
        <span className={`note-status ${status}`}>{statusLabel}</span>
      </header>

      <div className="note-toolbar">
        <button type="button" title="Gras" onMouseDown={exec('bold')}><b>B</b></button>
        <button type="button" title="Italique" onMouseDown={exec('italic')}><i>I</i></button>
        <button type="button" title="Souligné" onMouseDown={exec('underline')}><u>U</u></button>
        <button type="button" title="Barré" onMouseDown={exec('strikeThrough')}><s>S</s></button>
        <span className="note-sep" />
        <button type="button" title="Titre" onMouseDown={exec('formatBlock', '<h2>')}>H₂</button>
        <button type="button" title="Sous-titre" onMouseDown={exec('formatBlock', '<h3>')}>H₃</button>
        <button type="button" title="Paragraphe" onMouseDown={exec('formatBlock', '<p>')}>¶</button>
        <button type="button" title="Citation" onMouseDown={exec('formatBlock', '<blockquote>')}>❝</button>
        <span className="note-sep" />
        <button type="button" title="Liste à puces" onMouseDown={exec('insertUnorderedList')}>• ☰</button>
        <button type="button" title="Liste numérotée" onMouseDown={exec('insertOrderedList')}>1. ☰</button>
        <button type="button" title="Lien" onMouseDown={(e) => { e.preventDefault(); const url = prompt('URL du lien'); if (url) { editorRef.current?.focus(); document.execCommand('createLink', false, url); onInput(); } }}>🔗</button>
        <button type="button" title="Effacer la mise en forme" onMouseDown={exec('removeFormat')}>✦</button>
        <span className="note-sep" />
        <div className="note-color-pick">
          <button type="button" title="Couleur" onMouseDown={(e) => { e.preventDefault(); setShowColors(s => !s); }}>🎨</button>
          {showColors && (
            <div className="note-swatches">
              {NOTE_COLORS.map(c => (
                <button key={c.key} type="button" title={c.label} className={`note-swatch ${c.key ? `note-color-${c.key}` : 'none'} ${color === c.key ? 'sel' : ''}`} onMouseDown={(e) => { e.preventDefault(); setColorNow(c.key); }} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        ref={editorRef}
        className="note-body rich"
        contentEditable
        suppressContentEditableWarning
        spellCheck
        onInput={onInput}
        data-placeholder="Commencez à écrire… tout est sauvegardé automatiquement."
      />

      <footer className="note-editor-foot">
        <div className="note-foot-left">
          <label className="note-foot-folder">
            Dossier&nbsp;
            <select value={folderId} onChange={e => changeFolder(Number(e.target.value))}>
              <option value={0}>Aucun</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>
          <span className="meta">{words} mot{words > 1 ? 's' : ''}</span>
        </div>
        <div className="note-foot-actions">
          <button type="button" className={`btn secondary small ${pinned ? 'on' : ''}`} onClick={togglePin} title="Épingler">{pinned ? '📌 Épinglée' : '📍 Épingler'}</button>
          <button type="button" className="btn secondary small" onClick={toggleArchive}>{archived ? '↩️ Restaurer' : '🗄️ Archiver'}</button>
          <button type="button" className="btn danger small" onClick={onDelete}>🗑️ Supprimer</button>
        </div>
      </footer>
    </div>
  );
}

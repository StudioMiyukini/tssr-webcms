import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { MediaPicker } from './MediaPicker';

/** Éditeur de texte riche réutilisable (contentEditable + execCommand), sans dépendance.
 *  Contrôlé : `value` (HTML) réécrit le DOM seulement s'il diffère (pas de saut de curseur en frappe). */
export function RichTextEditor({ value, onChange, minHeight = 120 }: { value: string; onChange: (html: string) => void; minHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || '')) ref.current.innerHTML = value || '';
  }, [value]);

  const emit = () => onChange(ref.current?.innerHTML ?? '');
  const exec = (cmd: string, val?: string) => (e: MouseEvent) => {
    e.preventDefault();
    ref.current?.focus();
    document.execCommand(cmd, false, val);
    emit();
  };
  const addLink = (e: MouseEvent) => {
    e.preventDefault();
    const url = prompt('URL du lien (https://…)');
    if (!url) return;
    ref.current?.focus();
    document.execCommand('createLink', false, url);
    emit();
  };
  // Mémorise la sélection courante avant d'ouvrir la bibliothèque (la modale fait perdre le focus).
  const openPicker = (e: MouseEvent) => {
    e.preventDefault();
    const sel = window.getSelection();
    savedRange.current = (sel && sel.rangeCount && ref.current?.contains(sel.anchorNode)) ? sel.getRangeAt(0).cloneRange() : null;
    setPickerOpen(true);
  };
  const insertImage = (url: string) => {
    const el = ref.current; if (!el) { setPickerOpen(false); return; }
    el.focus();
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      if (savedRange.current) sel.addRange(savedRange.current);
      else { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); sel.addRange(r); }
    }
    document.execCommand('insertHTML', false, `<img src="${url}" alt="" style="max-width:100%;height:auto;border-radius:6px"/>`);
    emit();
    setPickerOpen(false);
  };

  return (
    <div className="rte">
      <div className="note-toolbar">
        <button type="button" title="Gras" onMouseDown={exec('bold')}><b>B</b></button>
        <button type="button" title="Italique" onMouseDown={exec('italic')}><i>I</i></button>
        <button type="button" title="Souligné" onMouseDown={exec('underline')}><u>U</u></button>
        <span className="note-sep" />
        <button type="button" title="Sous-titre" onMouseDown={exec('formatBlock', '<h3>')}>H₃</button>
        <button type="button" title="Paragraphe" onMouseDown={exec('formatBlock', '<p>')}>¶</button>
        <button type="button" title="Liste à puces" onMouseDown={exec('insertUnorderedList')}>• ☰</button>
        <button type="button" title="Liste numérotée" onMouseDown={exec('insertOrderedList')}>1. ☰</button>
        <span className="note-sep" />
        <button type="button" title="Lien hypertexte" onMouseDown={addLink}>🔗</button>
        <button type="button" title="Insérer une image" onMouseDown={openPicker}>🖼️</button>
        <button type="button" title="Retirer le lien" onMouseDown={exec('unlink')}>⛓️‍💥</button>
        <button type="button" title="Effacer la mise en forme" onMouseDown={exec('removeFormat')}>✦</button>
      </div>
      <div
        ref={ref}
        className="note-body rich"
        style={{ minHeight }}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        onInput={emit}
        data-placeholder="Saisissez le contenu… (gras, listes, liens, images)"
      />
      <MediaPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={insertImage} />
    </div>
  );
}

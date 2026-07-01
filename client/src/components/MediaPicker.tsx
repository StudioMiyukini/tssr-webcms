import { useRef, useState } from 'react';
import { useMediaList, useUploadMedia, useDeleteMedia, type MediaRecord } from '@/api/hooks';
import { useToast } from '@/lib/toast';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/** Grille de médias avec import (drag/clic), sélection et suppression optionnelles. */
export function MediaGrid({ onPick, allowDelete }: { onPick?: (m: MediaRecord) => void; allowDelete?: boolean }) {
  const list = useMediaList();
  const upload = useUploadMedia();
  const del = useDeleteMedia();
  const { push } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) { push(`${file.name} : ce n'est pas une image.`, 'error'); continue; }
      try {
        const dataUrl = await fileToDataUrl(file);
        await upload.mutateAsync({ filename: file.name, dataUrl });
      } catch (e) {
        push(`Échec de l'import de ${file.name} : ${(e as Error)?.message || ''}`, 'error');
      }
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <div className="media-toolbar">
        <button type="button" className="btn" onClick={() => inputRef.current?.click()} disabled={upload.isPending}>
          {upload.isPending ? 'Envoi…' : '⬆ Importer des images'}
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={e => onFiles(e.target.files)} />
        <span className="meta">{list.data?.length ?? 0} fichier(s)</span>
      </div>
      {list.isLoading && <div className="loading">Chargement…</div>}
      {list.isError && <div className="empty">Erreur de chargement.</div>}
      {list.data && list.data.length === 0 && <div className="empty">Aucun média. Importe ta première image.</div>}
      <div className="media-grid">
        {(list.data ?? []).map(m => (
          <figure key={m.id} className="media-item">
            <button type="button" className="media-thumb" onClick={() => onPick?.(m)} title={onPick ? 'Sélectionner' : m.original_name}>
              <img src={m.url} alt={m.original_name} loading="lazy" />
            </button>
            <figcaption className="media-meta">
              <span className="media-name" title={m.original_name}>{m.original_name}</span>
              <span className="media-item-actions">
                <button type="button" title="Copier l'URL" onClick={() => { navigator.clipboard?.writeText(m.url); push('URL copiée.', 'success'); }}>⧉</button>
                {allowDelete && <button type="button" className="danger" title="Supprimer" onClick={() => { if (confirm('Supprimer ce média ? Il restera affiché là où son URL est déjà collée.')) del.mutate(m.id, { onSuccess: () => push('Média supprimé.', 'success') }); }}>✕</button>}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

/** Modale de sélection : importe/choisis une image, renvoie son URL. */
export function MediaPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (url: string) => void }) {
  if (!open) return null;
  return (
    <div className="cmdk-overlay" role="dialog" aria-modal="true" aria-label="Bibliothèque de médias" onClick={onClose}>
      <div className="media-picker" onClick={e => e.stopPropagation()}>
        <div className="topbar-row" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Bibliothèque de médias</h2>
          <button type="button" className="btn secondary small" onClick={onClose}>Fermer</button>
        </div>
        <MediaGrid onPick={m => { onPick(m.url); onClose(); }} allowDelete />
      </div>
    </div>
  );
}

/** Champ image : URL éditable + miniature + bouton vers la bibliothèque. */
export function MediaField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="field">
      <label>{label}</label>
      <div className="media-field">
        {value && <img className="media-field-thumb" src={value} alt="" />}
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || '/uploads/… ou https://…'} />
        <button type="button" className="btn secondary small" onClick={() => setOpen(true)}>📁 Bibliothèque</button>
      </div>
      <MediaPicker open={open} onClose={() => setOpen(false)} onPick={onChange} />
    </div>
  );
}

import { MediaGrid } from '@/components/MediaPicker';

/*
 * @id     tssr.pageMedia
 * @do     gerer_medias
 * @role   ui
 * @layer  ui
 * @human  Page admin « Médiathèque » : téléversement et gestion des fichiers.
 */
export function MediaPage() {
  return (
    <>
      <div className="topbar-row">
        <div><h1>Médias</h1><p>Importe et gère les images réutilisables (galeries, carrousels, logo, contenu…).</p></div>
      </div>
      <div className="card">
        <MediaGrid allowDelete />
      </div>
      <p className="hint">Astuce : depuis n'importe quel champ image du builder ou du thème, clique « 📁 Bibliothèque » pour choisir un fichier importé ici.</p>
    </>
  );
}

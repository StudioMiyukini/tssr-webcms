import { MediaGrid } from '@/components/MediaPicker';

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

import { useState } from 'react';
import { useHorsLigne } from '@/api/public';
import { useToast } from '@/lib/toast';

/** Bouton du menu public : télécharge le site entier en .zip, exécutable hors connexion.
    L'archive embarque son propre metteur à jour. Le bouton disparaît si le serveur
    ne sait pas la fabriquer (c'est le cas d'une copie hors-ligne : elle ne se recopie pas). */
/*
 * @id     tssr.compTelechargerHorsLigne
 * @do     telecharger_site_hors_ligne
 * @role   ui
 * @layer  ui
 * @human  Bouton « Hors-ligne » du menu : télécharge le site complet en archive.
 */
export function TelechargerHorsLigne() {
  const etat = useHorsLigne();
  const { push } = useToast();
  const [etape, setEtape] = useState<'' | 'prep' | 'dl'>('');
  const [pct, setPct] = useState(0);

  if (!etat.data?.disponible) return null;

  const telecharger = async () => {
    setEtape('prep');
    setPct(0);
    try {
      // La première demande fait construire l'archive : la réponse peut tarder ~1 min.
      const res = await fetch('/api/public/hors-ligne/site');
      if (!res.ok) throw new Error((await res.json().catch(() => ({} as { error?: string }))).error || `Échec (${res.status})`);

      const total = Number(res.headers.get('Content-Length') || 0);
      let blob: Blob;
      if (res.body && total > 0) {
        const lecteur = res.body.getReader();
        const morceaux: BlobPart[] = [];
        let recu = 0;
        setEtape('dl');
        for (;;) {
          const { done, value } = await lecteur.read();
          if (done) break;
          morceaux.push(value as BlobPart);
          recu += value.length;
          setPct(Math.min(99, Math.round((recu * 100) / total)));
        }
        blob = new Blob(morceaux, { type: 'application/zip' });
      } else {
        setEtape('dl');
        blob = await res.blob();
      }

      const entete = res.headers.get('Content-Disposition') || '';
      const nom = /filename="([^"]+)"/.exec(entete)?.[1] || `tssr-site-hors-ligne-${new Date().toISOString().slice(0, 10)}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nom;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      push('Archive téléchargée. Dézippe-la, puis lance « Lancer-le-site » (Node.js 20+ requis). Voir LISEZ-MOI.txt.', 'success');
    } catch (e) {
      push(e instanceof Error ? e.message : 'Téléchargement impossible.', 'error');
    } finally {
      setEtape('');
      setPct(0);
    }
  };

  const libelle = etape === '' ? '💾 Hors-ligne' : etape === 'prep' ? 'Préparation…' : `${pct} %`;
  const mo = etat.data.pret && etat.data.taille ? ` (~${Math.round(etat.data.taille / 1048576)} Mo)` : '';

  return (
    <button
      type="button"
      className="public-link"
      onClick={telecharger}
      disabled={etape !== ''}
      title={`Télécharger tout le site${mo} pour le consulter sans Internet, avec son metteur à jour. Node.js 20+ requis sur le poste.`}
    >
      {libelle}
    </button>
  );
}

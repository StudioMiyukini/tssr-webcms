import { useHorsLigne } from '@/api/public';

/** Bouton du menu public : télécharge le site entier en .zip, exécutable hors connexion.
    L'archive embarque son propre metteur à jour.

    Un simple lien : l'archive est déposée chaque matin sur une release GitHub, dont le
    CDN sert bien plus vite que le tunnel. Le navigateur montre sa propre progression —
    inutile de faire transiter 31 Mo par le JavaScript de la page. Le bouton disparaît si
    le serveur ne sait pas fabriquer l'archive (c'est le cas d'une copie hors-ligne :
    elle ne se recopie pas). */
/*
 * @id     tssr.compTelechargerHorsLigne
 * @do     telecharger_site_hors_ligne
 * @role   ui
 * @layer  ui
 * @human  Bouton « Hors-ligne » du menu : lien vers l'archive du site complet.
 */
export function TelechargerHorsLigne() {
  const etat = useHorsLigne();
  if (!etat.data?.disponible) return null;

  // À défaut de publication, la route du site fabrique et sert l'archive elle-même.
  const href = etat.data.url || '/api/public/hors-ligne/site';
  const mo = etat.data.taille ? `${Math.round(etat.data.taille / 1048576)} Mo` : '';
  const jour = etat.data.genereLe ? new Date(etat.data.genereLe).toLocaleDateString('fr-FR') : '';
  const detail = [mo, jour && `mise à jour du ${jour}`].filter(Boolean).join(', ');

  return (
    <a
      className="public-link"
      href={href}
      title={`Télécharger tout le site${detail ? ` (${detail})` : ''} pour le consulter sans Internet, avec son metteur à jour. Node.js 22+ requis sur le poste.`}
    >
      💾 Hors-ligne
    </a>
  );
}

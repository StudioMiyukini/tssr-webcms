import { useHorsLigne } from '@/api/public';

/** Bouton du menu public : emporte le site pour le consulter sans Internet.

    Deux formes, selon ce qui est publié : l'exécutable Windows (un seul fichier,
    moteur Node compris, rien à installer) sinon l'archive .zip, qui marche
    partout mais demande Node. Un simple lien : les paquets sont déposés chaque
    matin sur une release GitHub, dont le CDN sert bien plus vite que le tunnel,
    et le navigateur montre sa propre progression. Le bouton disparaît si le
    serveur ne sait pas les fabriquer — c'est le cas d'une copie hors-ligne,
    qui ne se recopie donc pas. */
/*
 * @id     tssr.compTelechargerHorsLigne
 * @do     telecharger_site_hors_ligne
 * @role   ui
 * @layer  ui
 * @human  Bouton « Hors-ligne » du menu : lien vers l'exécutable ou l'archive du site.
 */
export function TelechargerHorsLigne() {
  const etat = useHorsLigne();
  if (!etat.data?.disponible) return null;

  const exe = etat.data.exe;
  const href = exe?.url || etat.data.url || '/api/public/hors-ligne/site';
  const taille = exe?.taille || etat.data.taille;

  const mo = taille ? `${Math.round(taille / 1048576)} Mo` : '';
  const jour = etat.data.genereLe ? new Date(etat.data.genereLe).toLocaleDateString('fr-FR') : '';
  const detail = [mo, jour && `mise à jour du ${jour}`].filter(Boolean).join(', ');
  const quoi = exe
    ? 'Télécharger le site pour Windows : un seul fichier, rien à installer'
    : 'Télécharger tout le site pour le consulter sans Internet (Node.js 22+ requis)';

  return (
    <a className="public-link" href={href} title={`${quoi}${detail ? ` — ${detail}` : ''}.`}>
      💾 Hors-ligne
    </a>
  );
}

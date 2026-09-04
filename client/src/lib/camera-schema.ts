/*
 * @id      tssr.atelier.cameraSchema
 * @do      naviguer_dans_le_schema
 * @role    rule
 * @layer   outil
 * @human   Le zoom, le déplacement et le cadrage du schéma : où l'on regarde,
 *          et comment un point de l'écran se traduit sur la toile.
 *
 * UNE SEULE SOURCE DE VÉRITÉ POUR LA TRANSFORMATION — la règle de Plan.
 * Tout ce qui se dessine et tout ce qui se clique passe par ici. Dupliquer ce
 * calcul ailleurs — dans le rendu d'un côté, dans la détection de clic de
 * l'autre — c'est se garantir qu'un jour les deux divergeront d'un pixel, puis
 * de dix, et qu'on posera un câble à côté de l'équipement visé.
 *
 * IMMUABLE, LÀ OÙ PLAN A UNE CLASSE.
 * Plan mute sa caméra et redessine sur un canevas ; ici la vue est un état
 * React, et une valeur qui change en place ne déclenche aucun rendu. Chaque
 * geste renvoie donc une nouvelle vue.
 */

export interface Point { x: number; y: number }
export interface Boite { x: number; y: number; w: number; h: number }

/** Ce qu'on regarde : le coin haut-gauche en unités toile, et l'échelle. */
export interface Vue { x: number; y: number; zoom: number }

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4;

export const VUE_INITIALE: Vue = { x: 0, y: 0, zoom: 1 };

const borner = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

/** La fenêtre visible, en unités toile — c'est le `viewBox` du SVG. */
export function fenetre(v: Vue, largeur: number, hauteur: number): Boite {
  return { x: v.x, y: v.y, w: largeur / v.zoom, h: hauteur / v.zoom };
}

/**
 * Écran → toile.
 *
 * `p` est relatif au coin haut-gauche de la zone de dessin, en pixels affichés.
 * `largeur` est la largeur de référence de la vue, pas celle du SVG à l'écran :
 * l'élément s'étire, la toile non.
 */
export function versToile(v: Vue, p: Point): Point {
  return { x: v.x + p.x / v.zoom, y: v.y + p.y / v.zoom };
}

/** Toile → écran. */
export function versEcran(v: Vue, p: Point): Point {
  return { x: (p.x - v.x) * v.zoom, y: (p.y - v.y) * v.zoom };
}

/** Fait glisser la vue, d'un déplacement exprimé en pixels d'écran. */
export function deplacer(v: Vue, dxEcran: number, dyEcran: number): Vue {
  return { ...v, x: v.x - dxEcran / v.zoom, y: v.y - dyEcran / v.zoom };
}

/**
 * Zoome en gardant fixe le point sous le curseur.
 *
 * Sans ce point d'ancrage, zoomer déplace la vue et oblige à se repositionner
 * en permanence. C'est la différence entre un zoom agréable et un zoom qu'on
 * subit.
 */
export function zoomerVers(v: Vue, pEcran: Point, facteur: number): Vue {
  const avant = versToile(v, pEcran);
  const zoom = borner(v.zoom * facteur);
  const apres = versToile({ ...v, zoom }, pEcran);
  return { x: v.x + avant.x - apres.x, y: v.y + avant.y - apres.y, zoom };
}

/** Zoome au centre de la vue — ce que font les boutons + et −. */
export function zoomerAuCentre(v: Vue, facteur: number, largeur: number, hauteur: number): Vue {
  return zoomerVers(v, { x: largeur / 2, y: hauteur / 2 }, facteur);
}

/**
 * L'étendue occupée par des boîtes.
 *
 * `null` quand il n'y a rien : un schéma vide n'a pas de centre, et renvoyer
 * une boîte de taille nulle ferait diviser par zéro au cadrage.
 */
export function etendue(boites: Boite[]): Boite | null {
  if (!boites.length) return null;
  const g = Math.min(...boites.map(b => b.x));
  const d = Math.max(...boites.map(b => b.x + b.w));
  const h = Math.min(...boites.map(b => b.y));
  const b = Math.max(...boites.map(b2 => b2.y + b2.h));
  return { x: g, y: h, w: Math.max(1, d - g), h: Math.max(1, b - h) };
}

/**
 * La vue qui montre tout le contenu.
 *
 * UNE SEULE ÉCHELLE POUR LES DEUX AXES : en étirer une par axe remplirait mieux
 * la fenêtre, mais un schéma large deviendrait carré et l'on ne reconnaîtrait
 * plus sa propre disposition.
 */
export function cadrer(contenu: Boite | null, largeur: number, hauteur: number, marge = 40, zoomMax = ZOOM_MAX): Vue {
  if (!contenu) return VUE_INITIALE;
  const utile = { w: Math.max(1, largeur - marge * 2), h: Math.max(1, hauteur - marge * 2) };
  // `zoomMax` sert au cadrage automatique : sur un schéma d'un seul équipement,
  // remplir l'écran d'une boîte n'aide personne — on se contente de la taille
  // réelle et l'on garde le zoom pour les gestes voulus.
  const zoom = Math.min(zoomMax, borner(Math.min(utile.w / contenu.w, utile.h / contenu.h)));
  // Centré : ce qui reste de place se répartit également des deux côtés.
  return {
    zoom,
    x: contenu.x + contenu.w / 2 - largeur / (2 * zoom),
    y: contenu.y + contenu.h / 2 - hauteur / (2 * zoom),
  };
}

/** Amène un point au centre de la vue, sans changer l'échelle. */
export function centrerSur(v: Vue, p: Point, largeur: number, hauteur: number): Vue {
  return { ...v, x: p.x - largeur / (2 * v.zoom), y: p.y - hauteur / (2 * v.zoom) };
}

/**
 * L'accroche à la grille.
 *
 * Un schéma dont les équipements sont alignés au pixel près se lit ; un schéma
 * posé à main levée ne se lit pas, et l'aligner après coup est un travail que
 * personne ne fait. La grille le fait pendant.
 */
export function accrocher(p: Point, pas: number): Point {
  if (pas <= 0) return p;
  return { x: Math.round(p.x / pas) * pas, y: Math.round(p.y / pas) * pas };
}

/** Le pas de grille du schéma. Assez fin pour ne pas contraindre, assez gros pour aligner. */
export const PAS_GRILLE = 20;

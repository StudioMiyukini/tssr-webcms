/*
 * @id      tssr.atelier.pictosReseau
 * @do      dessiner_les_pictogrammes_reseau
 * @role    donnee
 * @layer   outil
 * @human   Les pictogrammes du schéma — routeur, commutateur, nuage, serveur,
 *          poste… — dessinés au trait, repris de plan.miyukini.org.
 *
 * PORTÉS DE PLAN, ET REDESSINÉS EN SVG.
 * Plan dessine ses pictogrammes sur une toile 2D ; le schéma de l'atelier est
 * en SVG. Recopier le canevas aurait voulu dire embarquer un moteur de rendu
 * entier pour six icônes. On garde donc les tracés — les mêmes proportions, les
 * mêmes gestes — et on les exprime en chemins SVG.
 *
 * DESSINÉS, PAS IMPORTÉS. Trois raisons, celles de Plan, qui valent ici aussi.
 * La politique de sécurité du site ne charge rien de l'extérieur. L'export PNG
 * passe par le même rendu que l'écran : un tracé sort par le même chemin, une
 * image chargée devrait être attendue puis ré-embarquée. Et une quinzaine de
 * pictogrammes en fichiers pèse plus que ce module, sans se colorer selon
 * l'état de l'équipement.
 *
 * TOUS DESSINENT DANS LE CARRÉ UNITÉ, de 0 à 1 : c'est à l'appelant de mettre
 * à l'échelle. Sans cette convention, chaque pictogramme aurait sa taille
 * propre et la palette serait un patchwork.
 */
import type { TypeMateriel } from './physique.ts';

/**
 * Ce que devient un tracé une fois posé.
 *
 * Le canevas de Plan distingue `fill()`, `stroke()` et les deux ; SVG demande
 * la même distinction, faute de quoi les diodes d'un serveur deviendraient des
 * anneaux et le mur du pare-feu un aplat.
 */
export type ModeFigure = 'plein' | 'trait' | 'rempli';

export interface Figure {
  /** Chemin SVG, en coordonnées du carré unité. */
  d: string;
  mode: ModeFigure;
}

export type CategoriePicto = 'Réseau' | 'Machines' | 'Formes';

export interface Picto {
  id: string;
  nom: string;
  categorie: CategoriePicto;
  figures: Figure[];
}

/* ------------------------------------------------------------- géométrie */

const TAU = Math.PI * 2;

/** Trois décimales : au-delà, le chemin s'allonge sans que l'œil y gagne. */
const n = (v: number) => String(Math.round(v * 1000) / 1000);

const pointSurArc = (cx: number, cy: number, rx: number, ry: number, a: number) =>
  ({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });

/**
 * Un arc de canevas, écrit en commande SVG.
 *
 * Le canevas parcourt les angles CROISSANTS par défaut ; en coordonnées écran,
 * où l'axe des ordonnées descend, cela tourne dans le sens des aiguilles —
 * c'est-à-dire le drapeau « sweep = 1 » de SVG. Confondre les deux retourne
 * l'arc et donne un nuage à l'envers, sans erreur ni avertissement.
 */
function commandeArc(
  cx: number, cy: number, rx: number, ry: number,
  a0: number, a1: number, antihoraire = false,
): { debut: { x: number; y: number }; commande: string } {
  let delta = antihoraire ? a0 - a1 : a1 - a0;
  delta = ((delta % TAU) + TAU) % TAU;
  if (delta === 0) delta = TAU;
  const fin = pointSurArc(cx, cy, rx, ry, antihoraire ? a0 - delta : a0 + delta);
  const grand = delta > Math.PI ? 1 : 0;
  const sens = antihoraire ? 0 : 1;
  return {
    debut: pointSurArc(cx, cy, rx, ry, a0),
    commande: `A ${n(rx)} ${n(ry)} 0 ${grand} ${sens} ${n(fin.x)} ${n(fin.y)}`,
  };
}

/** Un arc ouvert, seul dans son chemin — le signal d'une borne Wi-Fi, les épaules d'une personne. */
export function cheminArc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, antihoraire = false): string {
  const a = commandeArc(cx, cy, rx, ry, a0, a1, antihoraire);
  return `M ${n(a.debut.x)} ${n(a.debut.y)} ${a.commande}`;
}

/**
 * Une suite d'arcs reliés par des droites — le nuage, la base de données.
 *
 * C'est exactement ce que fait le canevas : un `arc()` qui suit un tracé en
 * cours joint d'abord son point de départ. Reproduire ce joint est ce qui
 * évite les trois lobes détachés qu'on obtient en enchaînant naïvement.
 */
export function cheminArcs(
  arcs: { cx: number; cy: number; rx: number; ry: number; a0: number; a1: number; antihoraire?: boolean }[],
  fermer = false,
): string {
  const morceaux: string[] = [];
  arcs.forEach((a, i) => {
    const c = commandeArc(a.cx, a.cy, a.rx, a.ry, a.a0, a.a1, a.antihoraire);
    morceaux.push(`${i === 0 ? 'M' : 'L'} ${n(c.debut.x)} ${n(c.debut.y)}`, c.commande);
  });
  if (fermer) morceaux.push('Z');
  return morceaux.join(' ');
}

/** Une ellipse entière, en deux demi-arcs — un seul arc de 360° serait dégénéré. */
export function cheminEllipse(cx: number, cy: number, rx: number, ry: number): string {
  return `M ${n(cx - rx)} ${n(cy)} A ${n(rx)} ${n(ry)} 0 0 1 ${n(cx + rx)} ${n(cy)}`
    + ` A ${n(rx)} ${n(ry)} 0 0 1 ${n(cx - rx)} ${n(cy)} Z`;
}

/** Un rectangle aux coins arrondis. Le rayon se borne à la moitié du plus petit côté. */
export function cheminRect(x: number, y: number, w: number, h: number, r = 0.06): string {
  const k = Math.min(r, w / 2, h / 2);
  return [
    `M ${n(x + k)} ${n(y)}`,
    `H ${n(x + w - k)}`, `A ${n(k)} ${n(k)} 0 0 1 ${n(x + w)} ${n(y + k)}`,
    `V ${n(y + h - k)}`, `A ${n(k)} ${n(k)} 0 0 1 ${n(x + w - k)} ${n(y + h)}`,
    `H ${n(x + k)}`, `A ${n(k)} ${n(k)} 0 0 1 ${n(x)} ${n(y + h - k)}`,
    `V ${n(y + k)}`, `A ${n(k)} ${n(k)} 0 0 1 ${n(x + k)} ${n(y)}`,
    'Z',
  ].join(' ');
}

/** Une polyligne, fermée ou non. */
export function cheminLigne(points: [number, number][], fermer = false): string {
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${n(p[0])} ${n(p[1])}`).join(' ');
  return fermer ? `${d} Z` : d;
}

/** Plusieurs segments indépendants dans un même chemin — les rainures d'une baie. */
export function cheminSegments(segments: [number, number, number, number][]): string {
  return segments.map(([x0, y0, x1, y1]) => `M ${n(x0)} ${n(y0)} L ${n(x1)} ${n(y1)}`).join(' ');
}

/**
 * La flèche à deux têtes : le motif qui distingue un routeur d'une boîte.
 *
 * Reprise trait pour trait de Plan — c'est elle qu'on reconnaît, plus que
 * l'ellipse qui la porte.
 */
function flecheDouble(y: number, gauche: boolean): string {
  const x0 = gauche ? 0.68 : 0.32;
  const x1 = gauche ? 0.30 : 0.70;
  const s = gauche ? -1 : 1;
  return cheminSegments([
    [x0, y, x1, y],
    [x1, y, x1 - 0.07 * s, y - 0.05],
    [x1, y, x1 - 0.07 * s, y + 0.05],
  ]);
}

/** Une flèche à deux pointes — le motif du multicouche, qui commute ET route. */
function flecheBidir(x0: number, y0: number, x1: number, y1: number, aile = 0.05): string {
  const dx = x1 - x0, dy = y1 - y0;
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l, uy = dy / l;
  const t = 0.07;
  return cheminSegments([
    [x0, y0, x1, y1],
    [x1, y1, x1 - ux * t - uy * aile, y1 - uy * t + ux * aile],
    [x1, y1, x1 - ux * t + uy * aile, y1 - uy * t - ux * aile],
    [x0, y0, x0 + ux * t - uy * aile, y0 + uy * t + ux * aile],
    [x0, y0, x0 + ux * t + uy * aile, y0 + uy * t - ux * aile],
  ]);
}

const plein = (d: string): Figure => ({ d, mode: 'plein' });
const trait = (d: string): Figure => ({ d, mode: 'trait' });
const rempli = (d: string): Figure => ({ d, mode: 'rempli' });

/* -------------------------------------------------------- le catalogue */

export const PICTOS: Picto[] = [
  {
    id: 'routeur', nom: 'Routeur', categorie: 'Réseau',
    figures: [
      plein(cheminEllipse(0.5, 0.5, 0.42, 0.26)),
      trait(flecheDouble(0.42, false)),
      trait(flecheDouble(0.58, true)),
    ],
  },
  {
    id: 'commutateur', nom: 'Commutateur', categorie: 'Réseau',
    figures: [
      // Le parallélogramme du commutateur, universel depuis les planches Cisco.
      plein(cheminLigne([[0.16, 0.66], [0.84, 0.66], [0.96, 0.34], [0.28, 0.34]], true)),
      trait(flecheDouble(0.46, false)),
      trait(flecheDouble(0.57, true)),
    ],
  },
  {
    id: 'commutateur-l3', nom: 'Commutateur multicouche', categorie: 'Réseau',
    figures: [
      plein(cheminLigne([[0.16, 0.66], [0.84, 0.66], [0.96, 0.34], [0.28, 0.34]], true)),
      // Quatre pointes au lieu de deux : le commutateur qui route aussi. C'est
      // la marque du multicouche sur les planches Cisco, et la seule qui le
      // sépare d'un commutateur d'accès au premier coup d'œil.
      trait(flecheBidir(0.34, 0.50, 0.74, 0.50, 0.045)),
      trait(flecheBidir(0.54, 0.38, 0.54, 0.62, 0.045)),
    ],
  },
  {
    id: 'pare-feu', nom: 'Pare-feu', categorie: 'Réseau',
    figures: [
      plein(cheminRect(0.12, 0.26, 0.76, 0.48, 0.04)),
      // L'appareil de briques : trois rangées décalées, comme un mur.
      trait(cheminSegments([
        [0.12, 0.42, 0.88, 0.42],
        [0.12, 0.58, 0.88, 0.58],
        [0.50, 0.26, 0.50, 0.42],
        [0.31, 0.42, 0.31, 0.58],
        [0.69, 0.42, 0.69, 0.58],
        [0.50, 0.58, 0.50, 0.74],
      ])),
    ],
  },
  {
    id: 'nuage', nom: 'Internet', categorie: 'Réseau',
    figures: [
      plein(cheminArcs([
        { cx: 0.32, cy: 0.56, rx: 0.18, ry: 0.18, a0: Math.PI * 0.5, a1: Math.PI * 1.5 },
        { cx: 0.46, cy: 0.40, rx: 0.20, ry: 0.20, a0: Math.PI, a1: Math.PI * 1.85 },
        { cx: 0.70, cy: 0.48, rx: 0.16, ry: 0.16, a0: Math.PI * 1.4, a1: Math.PI * 0.5 },
      ], true)),
    ],
  },
  {
    id: 'borne-wifi', nom: 'Borne Wi-Fi', categorie: 'Réseau',
    figures: [
      plein(cheminRect(0.30, 0.62, 0.40, 0.16, 0.04)),
      // Trois arcs : le signal, lu d'un coup d'œil.
      ...[0.14, 0.24, 0.34].map(r => trait(cheminArc(0.5, 0.62, r, r, Math.PI * 1.18, Math.PI * 1.82))),
    ],
  },
  {
    id: 'baie', nom: 'Baie', categorie: 'Réseau',
    figures: [
      plein(cheminRect(0.22, 0.10, 0.56, 0.80, 0.04)),
      trait(cheminSegments(([1, 2, 3, 4] as const).map(
        i => [0.22, 0.10 + 0.16 * i, 0.78, 0.10 + 0.16 * i] as [number, number, number, number],
      ))),
    ],
  },
  {
    id: 'serveur', nom: 'Serveur', categorie: 'Machines',
    figures: [
      plein(cheminRect(0.26, 0.12, 0.48, 0.76, 0.05)),
      trait(cheminSegments(([0.30, 0.46, 0.62] as const).map(
        y => [0.26, y, 0.74, y] as [number, number, number, number],
      ))),
      // Les diodes : ce qui distingue un serveur d'une simple boîte.
      rempli([0.21, 0.38, 0.54].map(y => cheminEllipse(0.34, y, 0.025, 0.025)).join(' ')),
    ],
  },
  {
    id: 'poste', nom: 'Poste', categorie: 'Machines',
    figures: [
      plein(cheminRect(0.12, 0.20, 0.76, 0.46, 0.04)),
      trait(cheminLigne([[0.38, 0.66], [0.34, 0.80], [0.66, 0.80], [0.62, 0.66]])
        + ' ' + cheminSegments([[0.26, 0.80, 0.74, 0.80]])),
    ],
  },
  {
    id: 'portable', nom: 'Portable', categorie: 'Machines',
    figures: [
      plein(cheminRect(0.18, 0.22, 0.64, 0.42, 0.04)),
      plein(cheminLigne([[0.08, 0.72], [0.92, 0.72], [0.84, 0.64], [0.16, 0.64]], true)),
    ],
  },
  {
    id: 'base', nom: 'Base de données', categorie: 'Machines',
    figures: [
      plein(cheminEllipse(0.5, 0.24, 0.30, 0.11)),
      trait(`M 0.2 0.24 L 0.2 0.76 `
        + commandeArc(0.5, 0.76, 0.30, 0.11, Math.PI, Math.PI * 2, true).commande
        + ` L 0.8 0.24`),
      trait(cheminArc(0.5, 0.48, 0.30, 0.11, 0, Math.PI)),
    ],
  },
  {
    id: 'imprimante', nom: 'Imprimante', categorie: 'Machines',
    figures: [
      plein(cheminRect(0.16, 0.38, 0.68, 0.34, 0.04)),
      trait(cheminLigne([[0.30, 0.38], [0.30, 0.18], [0.70, 0.18], [0.70, 0.38]])
        + ' ' + cheminLigne([[0.30, 0.72], [0.30, 0.86], [0.70, 0.86], [0.70, 0.72]])),
    ],
  },
  {
    id: 'utilisateur', nom: 'Personne', categorie: 'Machines',
    figures: [
      plein(cheminEllipse(0.5, 0.30, 0.15, 0.15)),
      trait(cheminArc(0.5, 0.92, 0.30, 0.30, Math.PI * 1.15, Math.PI * 1.85)),
    ],
  },
  {
    id: 'rectangle', nom: 'Rectangle', categorie: 'Formes',
    figures: [plein(cheminRect(0.08, 0.22, 0.84, 0.56, 0.05))],
  },
  {
    id: 'cercle', nom: 'Cercle', categorie: 'Formes',
    figures: [plein(cheminEllipse(0.5, 0.5, 0.42, 0.42))],
  },
  {
    id: 'losange', nom: 'Décision', categorie: 'Formes',
    figures: [plein(cheminLigne([[0.5, 0.06], [0.96, 0.5], [0.5, 0.94], [0.04, 0.5]], true))],
  },
  {
    id: 'note', nom: 'Note', categorie: 'Formes',
    figures: [
      // Le coin corné : le seul détail qui dit « annotation » sans un mot.
      plein(cheminLigne([[0.14, 0.14], [0.68, 0.14], [0.86, 0.32], [0.86, 0.86], [0.14, 0.86]], true)),
      trait(cheminLigne([[0.68, 0.14], [0.68, 0.32], [0.86, 0.32]])),
    ],
  },
];

const PAR_ID = new Map(PICTOS.map(p => [p.id, p]));

export function picto(id: string | undefined): Picto | undefined {
  return id ? PAR_ID.get(id) : undefined;
}

export const CATEGORIES_PICTO = [...new Set(PICTOS.map(p => p.categorie))];

/**
 * Le pictogramme de chaque nature d'équipement de l'atelier.
 *
 * L'atelier ne connaît que six natures ; le catalogue en compte plus, parce
 * qu'il vient de Plan et qu'on ne l'ampute pas d'un pare-feu ou d'une baie sous
 * prétexte que l'inventaire ne les propose pas encore.
 */
export const PICTO_DE: Record<TypeMateriel, string> = {
  nuage: 'nuage',
  routeur: 'routeur',
  multicouche: 'commutateur-l3',
  switch: 'commutateur',
  serveur: 'serveur',
  poste: 'poste',
};

/** La teinte d'un équipement, reprise du transfert vers Plan pour que les deux schémas se ressemblent. */
export const TEINTE_DE: Record<TypeMateriel, string> = {
  nuage: '#94a3b8',
  routeur: '#2271b1',
  multicouche: '#7c3aed',
  switch: '#0f9d58',
  serveur: '#d97706',
  poste: '#64748b',
};

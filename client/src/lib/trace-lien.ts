/*
 * @id      tssr.atelier.traceLien
 * @do      tracer_les_cables_a_angles_droits
 * @role    rule
 * @layer   outil
 * @human   Décide par quel bord un câble quitte un équipement et par où il
 *          passe, en n'utilisant que des angles droits.
 *
 * PORTÉ DE plan.miyukini.org, ET RÉDUIT À CE QUE L'ATELIER DEMANDE.
 * Plan sait embrancher un lien sur un autre lien et suivre des points posés à
 * la main ; l'atelier ne câble qu'un équipement à un autre. On garde donc le
 * cœur — l'énumération de tracés candidats et le choix du meilleur — et on
 * laisse le reste chez Plan plutôt que de recopier un moteur entier.
 *
 * ON ÉNUMÈRE PUIS ON CHOISIT, PLUTÔT QUE DE DEVINER LE COUDE.
 * Une règle locale — « la cible est-elle devant ou derrière ? » — produit des
 * tracés qui traversent la boîte d'arrivée de part en part, parce qu'aucune
 * règle locale ne peut la voir. On construit donc une poignée de tracés
 * candidats — L, Z, contournements — et l'on garde le meilleur : d'abord celui
 * qui ne traverse rien, puis le moins coudé, puis le plus court.
 *
 * UN CÂBLE NE CONNAÎT PAS DE COORDONNÉES, il connaît un BORD et une FRACTION de
 * ce bord. La position se déduit de la boîte au moment du tracé : déplacer un
 * équipement suffit à déplacer ses câbles, il n'y a rien à resynchroniser —
 * donc rien à désynchroniser.
 */

export interface Point { x: number; y: number }
export interface Boite { x: number; y: number; w: number; h: number }

export type Cote = 'haut' | 'bas' | 'gauche' | 'droite';

/** Un bout de câble : la boîte, le bord, et où sur ce bord. */
export interface Bout { boite: Boite; cote: Cote; position: number }

/** Distance dont un câble s'écarte de l'équipement avant de tourner. */
export const MARGE = 22;

/** Vecteur de sortie selon le bord — la contrainte qui empêche le trait de rentrer dans sa boîte. */
const SORTIE: Record<Cote, Point> = {
  haut: { x: 0, y: -1 },
  bas: { x: 0, y: 1 },
  gauche: { x: -1, y: 0 },
  droite: { x: 1, y: 0 },
};

export const COTE_OPPOSE: Record<Cote, Cote> = {
  haut: 'bas', bas: 'haut', gauche: 'droite', droite: 'gauche',
};

const centre = (b: Boite): Point => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/** Où tombe un point du contour, désigné par son bord et sa fraction. */
export function pointSurContour(boite: Boite, cote: Cote, position: number): Point {
  const t = Math.min(1, Math.max(0, position));
  switch (cote) {
    case 'haut': return { x: boite.x + boite.w * t, y: boite.y };
    case 'bas': return { x: boite.x + boite.w * t, y: boite.y + boite.h };
    case 'gauche': return { x: boite.x, y: boite.y + boite.h * t };
    case 'droite': return { x: boite.x + boite.w, y: boite.y + boite.h * t };
  }
}

/**
 * Le bord par lequel un câble quitte `a` pour aller vers `b`.
 *
 * On mesure l'écart EN LARGEURS DE BOÎTE, pas en pixels : deux équipements
 * distants de 200 px ne se voient pas pareil selon qu'ils font 60 ou 600 px de
 * large. Sans cette normalisation, une baie haute et étroite verrait tous ses
 * voisins « en dessous » et sortirait ses câbles par le bas, en travers.
 */
export function coteVers(a: Boite, b: Boite): Cote {
  const ca = centre(a), cb = centre(b);
  const dx = cb.x - ca.x, dy = cb.y - ca.y;
  const ecartX = Math.abs(dx) / Math.max(1, (a.w + b.w) / 2);
  const ecartY = Math.abs(dy) / Math.max(1, (a.h + b.h) / 2);
  if (ecartX >= ecartY) return dx >= 0 ? 'droite' : 'gauche';
  return dy >= 0 ? 'bas' : 'haut';
}

/* --------------------------------------------------------------- géométrie */

function longueur(chemin: Point[]): number {
  let l = 0;
  for (let i = 1; i < chemin.length; i++) {
    l += Math.abs(chemin[i].x - chemin[i - 1].x) + Math.abs(chemin[i].y - chemin[i - 1].y);
  }
  return l;
}

/** Un tracé n'a-t-il que des segments horizontaux ou verticaux ? */
export function estOrthogonal(chemin: Point[]): boolean {
  for (let i = 1; i < chemin.length; i++) {
    if (chemin[i].x !== chemin[i - 1].x && chemin[i].y !== chemin[i - 1].y) return false;
  }
  return true;
}

/*
 * Un segment entre-t-il DANS une boîte ?
 *
 * Les comparaisons sont strictes : un trait qui longe exactement un bord ne
 * traverse rien, il rase. Sans cette nuance, l'amorce elle-même — qui part du
 * bord — compterait comme une traversée, et aucun tracé ne serait jamais jugé
 * acceptable.
 */
function segmentEntreDans(p: Point, q: Point, b: Boite): boolean {
  const g = b.x, d = b.x + b.w, h = b.y, bas = b.y + b.h;
  if (p.y === q.y) {
    if (p.y <= h || p.y >= bas) return false;
    return Math.max(p.x, q.x) > g && Math.min(p.x, q.x) < d;
  }
  if (p.x === q.x) {
    if (p.x <= g || p.x >= d) return false;
    return Math.max(p.y, q.y) > h && Math.min(p.y, q.y) < bas;
  }
  return false;
}

/** Combien de fois un tracé entre dans l'une ou l'autre des boîtes reliées. */
export function traversees(chemin: Point[], ...boites: Boite[]): number {
  let n = 0;
  for (let i = 1; i < chemin.length; i++) {
    for (const b of boites) if (segmentEntreDans(chemin[i - 1], chemin[i], b)) n++;
  }
  return n;
}

/** Nombre de changements de direction — un tracé lisible en a peu. */
export function coudes(chemin: Point[]): number {
  let n = 0;
  for (let i = 2; i < chemin.length; i++) {
    const avant = chemin[i - 2].y === chemin[i - 1].y;
    const apres = chemin[i - 1].y === chemin[i].y;
    if (avant !== apres) n++;
  }
  return n;
}

/** Retire les points strictement répétés, sans toucher aux points alignés. */
function deduper(chemin: Point[]): Point[] {
  return chemin.filter((p, i) => i === 0 || p.x !== chemin[i - 1].x || p.y !== chemin[i - 1].y);
}

/*
 * Retire les points intermédiaires ALIGNÉS du tracé fini.
 *
 * À ne faire qu'ici, sur le résultat : appliqué aux points guides, cela
 * effacerait les amorces — alignées avec leur port, donc d'apparence
 * redondante, alors qu'elles portent la contrainte de bord de sortie.
 */
function aplatir(chemin: Point[]): Point[] {
  if (chemin.length < 3) return chemin;
  const out = [chemin[0]];
  for (let i = 1; i < chemin.length - 1; i++) {
    const a = out[out.length - 1], b = chemin[i], c = chemin[i + 1];
    const alignes = (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y);
    if (!alignes) out.push(b);
  }
  out.push(chemin[chemin.length - 1]);
  return out;
}

/** Insère un coude là où deux points ne sont alignés ni horizontalement ni verticalement. */
function orthogonaliser(points: Point[]): Point[] {
  if (points.length < 2) return points.slice();
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = out[out.length - 1], b = points[i];
    if (a.x === b.x || a.y === b.y) { out.push(b); continue; }

    const precedent = out.length >= 2 ? out[out.length - 2] : null;
    let horizontalDabord: boolean;
    if (!precedent) {
      horizontalDabord = true;                       // aucun élan : choix arbitraire mais stable
    } else if (precedent.y === a.y) {                // on arrivait horizontalement
      const versLaDroite = a.x - precedent.x > 0;
      horizontalDabord = versLaDroite ? b.x > a.x : b.x < a.x;
    } else {                                         // on arrivait verticalement
      const versLeBas = a.y - precedent.y > 0;
      horizontalDabord = !(versLeBas ? b.y > a.y : b.y < a.y);
    }
    out.push(horizontalDabord ? { x: b.x, y: a.y } : { x: a.x, y: b.y }, b);
  }
  return out;
}

/*
 * Les tracés candidats entre les deux amorces.
 *
 * Aucun n'est privilégié a priori : le choix se fait plus bas, sur ce que le
 * tracé complet donne réellement. Un L élégant qui transperce la boîte
 * d'arrivée vaut moins qu'un contournement à trois coudes.
 */
function candidats(A: Point, B: Point, obstacles: Boite[]): Point[][] {
  const xs = obstacles.flatMap(b => [b.x, b.x + b.w]).concat(A.x, B.x);
  const ys = obstacles.flatMap(b => [b.y, b.y + b.h]).concat(A.y, B.y);
  const hautD = Math.min(...ys) - MARGE;
  const basD = Math.max(...ys) + MARGE;
  const gaucheD = Math.min(...xs) - MARGE;
  const droiteD = Math.max(...xs) + MARGE;
  const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;

  return [
    [],                                                     // droit, si les amorces sont alignées
    [{ x: B.x, y: A.y }],                                   // L, horizontal d'abord
    [{ x: A.x, y: B.y }],                                   // L, vertical d'abord
    [{ x: mx, y: A.y }, { x: mx, y: B.y }],                 // Z horizontal
    [{ x: A.x, y: my }, { x: B.x, y: my }],                 // Z vertical
    [{ x: A.x, y: hautD }, { x: B.x, y: hautD }],           // contournement par le haut
    [{ x: A.x, y: basD }, { x: B.x, y: basD }],             // contournement par le bas
    [{ x: gaucheD, y: A.y }, { x: gaucheD, y: B.y }],       // contournement par la gauche
    [{ x: droiteD, y: A.y }, { x: droiteD, y: B.y }],       // contournement par la droite
  ];
}

/**
 * Le tracé complet d'un câble, d'un bout à l'autre.
 *
 * `trace` vaut « droit » pour la ligne directe — celle qu'on garde quand on ne
 * veut pas des angles droits, et celle que l'aperçu utilise pendant qu'on tire.
 */
export function tracer(a: Bout, b: Bout, trace: 'orthogonal' | 'droit' = 'orthogonal'): Point[] {
  const pa = pointSurContour(a.boite, a.cote, a.position);
  const pb = pointSurContour(b.boite, b.cote, b.position);
  if (trace === 'droit') return [pa, pb];

  // Les amorces imposent le bord de sortie : sans elles, le trait rentrerait
  // dans la boîte quand la cible est du mauvais côté.
  const A = { x: pa.x + SORTIE[a.cote].x * MARGE, y: pa.y + SORTIE[a.cote].y * MARGE };
  const B = { x: pb.x + SORTIE[b.cote].x * MARGE, y: pb.y + SORTIE[b.cote].y * MARGE };
  const obstacles = [a.boite, b.boite];

  let meilleur: Point[] | null = null;
  let score: [number, number, number] = [Infinity, Infinity, Infinity];

  for (const milieu of candidats(A, B, obstacles)) {
    const chemin = aplatir(deduper(orthogonaliser([pa, A, ...milieu, B, pb])));
    const s: [number, number, number] = [
      traversees(chemin, ...obstacles),      // d'abord : ne rien transpercer
      coudes(chemin),                        // ensuite : rester lisible
      longueur(chemin),                      // enfin : rester court
    ];
    if (s[0] < score[0]
      || (s[0] === score[0] && s[1] < score[1])
      || (s[0] === score[0] && s[1] === score[1] && s[2] < score[2])) {
      meilleur = chemin;
      score = s;
    }
  }
  return meilleur ?? aplatir(deduper(orthogonaliser([pa, A, B, pb])));
}

/** Le tracé, écrit en attribut `d` de SVG. */
export function cheminSvg(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${Math.round(p.x * 100) / 100} ${Math.round(p.y * 100) / 100}`).join(' ');
}

/**
 * Le point à mi-parcours, et la direction du segment qui le porte.
 *
 * On mesure une DISTANCE PARCOURUE, pas un rang de sommet : sur un tracé en L
 * dont un bras est dix fois plus long que l'autre, le sommet du milieu n'est
 * pas le milieu, et l'étiquette se collerait à un coude.
 *
 * LA DIRECTION SERT À NE PAS ÉCRIRE SUR LA LIGNE. Une étiquette centrée sur un
 * câble vertical tombe pile là où les noms de port des deux équipements se
 * rejoignent ; posée À CÔTÉ du trait, elle se lit et les laisse tranquilles.
 */
export function milieuOriente(chemin: Point[]): { x: number; y: number; horizontal: boolean } {
  if (!chemin.length) return { x: 0, y: 0, horizontal: true };
  if (chemin.length === 1) return { ...chemin[0], horizontal: true };
  const totale = longueur(chemin);
  if (totale === 0) return { ...chemin[0], horizontal: true };
  let parcourue = 0;
  for (let i = 1; i < chemin.length; i++) {
    const l = Math.abs(chemin[i].x - chemin[i - 1].x) + Math.abs(chemin[i].y - chemin[i - 1].y);
    if (parcourue + l >= totale / 2) {
      const t = l === 0 ? 0 : (totale / 2 - parcourue) / l;
      return {
        x: chemin[i - 1].x + (chemin[i].x - chemin[i - 1].x) * t,
        y: chemin[i - 1].y + (chemin[i].y - chemin[i - 1].y) * t,
        horizontal: chemin[i - 1].y === chemin[i].y,
      };
    }
    parcourue += l;
  }
  const fin = chemin[chemin.length - 1];
  return { ...fin, horizontal: true };
}

/** Le point à mi-parcours, sans sa direction. */
export function milieuDe(chemin: Point[]): Point {
  const m = milieuOriente(chemin);
  return { x: m.x, y: m.y };
}

/* ------------------------------------------------------- répartition des ports */

/** Un câble, réduit à ce qu'il faut pour l'ancrer. */
export interface CableAncrable { id: string; deId: string; versId: string }

/**
 * Ancre tous les câbles : quel bord, et où sur ce bord.
 *
 * DEUX CÂBLES D'UN MÊME BORD NE PARTENT PAS DU MÊME POINT. Sans répartition ils
 * se superposent à mi-hauteur, et l'on ne voit plus qu'un trait là où il y en a
 * trois.
 *
 * L'ORDRE SUR LE BORD SUIT CELUI DES VOISINS. Répartir dans l'ordre de
 * déclaration croiserait les câbles pour rien : le voisin le plus à gauche
 * mérite le point le plus à gauche, et le tracé s'en trouve droit sans qu'on
 * ait rien à éviter.
 */
export function ancrerCables(
  boites: Map<string, Boite>,
  cables: CableAncrable[],
): Map<string, { a: Bout; b: Bout }> {
  type Attente = { cableId: string; bout: 'a' | 'b'; cote: Cote; rang: number };
  const parBord = new Map<string, Attente[]>();
  const cotes = new Map<string, { a: Cote; b: Cote }>();

  for (const c of cables) {
    const ba = boites.get(c.deId), bb = boites.get(c.versId);
    if (!ba || !bb) continue;
    const coteA = coteVers(ba, bb);
    const coteB = coteVers(bb, ba);
    cotes.set(c.id, { a: coteA, b: coteB });

    // Le rang classe les voisins le long du bord : abscisse pour un bord
    // horizontal, ordonnée pour un bord vertical.
    const rangA = coteA === 'haut' || coteA === 'bas' ? bb.x + bb.w / 2 : bb.y + bb.h / 2;
    const rangB = coteB === 'haut' || coteB === 'bas' ? ba.x + ba.w / 2 : ba.y + ba.h / 2;

    for (const [id, cote, rang, bout] of [
      [c.deId, coteA, rangA, 'a'] as const,
      [c.versId, coteB, rangB, 'b'] as const,
    ]) {
      const cle = `${id}|${cote}`;
      const liste = parBord.get(cle) ?? [];
      liste.push({ cableId: c.id, bout, cote, rang });
      parBord.set(cle, liste);
    }
  }

  const positions = new Map<string, number>();
  for (const [, liste] of parBord) {
    liste.sort((x, y) => x.rang - y.rang || x.cableId.localeCompare(y.cableId));
    liste.forEach((e, i) => positions.set(`${e.cableId}|${e.bout}`, (i + 1) / (liste.length + 1)));
  }

  const sortie = new Map<string, { a: Bout; b: Bout }>();
  for (const c of cables) {
    const ba = boites.get(c.deId), bb = boites.get(c.versId);
    const cote = cotes.get(c.id);
    if (!ba || !bb || !cote) continue;
    sortie.set(c.id, {
      a: { boite: ba, cote: cote.a, position: positions.get(`${c.id}|a`) ?? 0.5 },
      b: { boite: bb, cote: cote.b, position: positions.get(`${c.id}|b`) ?? 0.5 },
    });
  }
  return sortie;
}

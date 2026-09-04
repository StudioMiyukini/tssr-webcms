/*
 * @id      tssr.atelier.histoireSchema
 * @do      tenir_la_pile_des_annulations
 * @role    rule
 * @layer   outil
 * @human   Se souvient de ce qu'on vient de faire sur le schéma, pour pouvoir
 *          le défaire et le refaire.
 *
 * ON REGROUPE LES GESTES CONTINUS — la règle de Plan, et la seule qui rende
 * l'annulation utilisable. Glisser un équipement produit des dizaines d'états
 * par seconde ; sans regroupement il faudrait autant de Ctrl+Z que d'images
 * affichées pour revenir en arrière d'un seul déplacement. Deux états se
 * fondent quand ils portent la MÊME clé — le même geste, sur le même objet — à
 * moins d'une demi-seconde d'écart.
 *
 * REFAIRE S'EFFACE DÈS QU'ON REPART DANS UNE AUTRE DIRECTION : c'est la règle
 * universelle, et la seule qui évite un futur incohérent.
 *
 * DES INSTANTANÉS, LÀ OÙ PLAN GARDE DES OPÉRATIONS INVERSES.
 * Plan co-édite à plusieurs : il lui faut savoir défaire SON geste sans toucher
 * à celui du voisin, ce qu'un instantané ne sait pas faire. Le schéma de
 * l'atelier n'a qu'un auteur et tient dans quelques kilo-octets : l'instantané
 * est exact, trivial à relire, et ne peut pas diverger de l'état réel.
 */

export interface Histoire<T> {
  passe: T[];
  present: T;
  futur: T[];
  /** Quand le présent a été posé — sert à fondre les gestes continus. */
  quand: number;
  /** Ce qui identifie le geste en cours. Vide = ne se fond avec rien. */
  cle: string;
}

/** Au-delà, les gestes ne se fondent plus : c'est un nouveau geste. */
export const FUSION_MS = 500;

/** Assez pour une séance de travail, assez peu pour ne pas peser en mémoire. */
export const PROFONDEUR = 80;

export function nouvelle<T>(present: T): Histoire<T> {
  return { passe: [], present, futur: [], quand: 0, cle: '' };
}

/**
 * Retient un nouvel état.
 *
 * @param cle        ce qui identifie le geste ; deux états de même clé et
 *                   rapprochés dans le temps ne comptent que pour un
 * @param maintenant l'horloge, injectée pour que les tests n'en dépendent pas
 */
export function poser<T>(h: Histoire<T>, present: T, cle = '', maintenant = Date.now()): Histoire<T> {
  if (present === h.present) return h;

  if (cle && cle === h.cle && maintenant - h.quand < FUSION_MS) {
    // Le geste continue : on remplace le présent sans empiler, de sorte qu'un
    // seul Ctrl+Z ramène à l'état d'avant que le geste ne commence.
    return { ...h, present, futur: [], quand: maintenant };
  }

  const passe = [...h.passe, h.present];
  return {
    passe: passe.length > PROFONDEUR ? passe.slice(passe.length - PROFONDEUR) : passe,
    present,
    futur: [],
    quand: maintenant,
    cle,
  };
}

export const peutAnnuler = <T>(h: Histoire<T>) => h.passe.length > 0;
export const peutRetablir = <T>(h: Histoire<T>) => h.futur.length > 0;

export function annuler<T>(h: Histoire<T>): Histoire<T> {
  if (!h.passe.length) return h;
  const present = h.passe[h.passe.length - 1];
  return {
    passe: h.passe.slice(0, -1),
    present,
    futur: [h.present, ...h.futur],
    quand: 0,
    // La clé se vide : le geste suivant ne doit pas se fondre dans celui qu'on
    // vient d'annuler, sans quoi il l'écraserait au lieu de s'y ajouter.
    cle: '',
  };
}

export function retablir<T>(h: Histoire<T>): Histoire<T> {
  if (!h.futur.length) return h;
  return {
    passe: [...h.passe, h.present],
    present: h.futur[0],
    futur: h.futur.slice(1),
    quand: 0,
    cle: '',
  };
}

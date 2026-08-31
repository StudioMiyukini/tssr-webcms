/*
 * @id      tssr.atelier.versPlan
 * @do      convertir_topologie_en_schema_plan
 * @role    donnee
 * @layer   domain
 * @human   Traduit la topologie de l'atelier réseau en document Miyukini-plan,
 *          pour continuer le schéma sur une toile infinie.
 *
 * POURQUOI UNE TRADUCTION, ET NON UN FORMAT COMMUN.
 * L'atelier décrit un réseau à construire : des matériels, des câbles, un plan
 * d'adressage calculé. Plan décrit un dessin : des nœuds placés, des ports
 * nommés, des liens tracés. Les deux modèles ne se recouvrent pas — l'atelier
 * ignore les coordonnées, Plan ignore les masques. On traduit donc, en assumant
 * ce qui se perd : le calcul d'adressage reste dans l'atelier, le schéma part
 * dans Plan avec les adresses déjà résolues, écrites en clair sur les ports.
 *
 * CE QUE LA TRADUCTION GARANTIT.
 * Un lien de Plan référence un `portId`, jamais des coordonnées : quand on
 * déplace un équipement sur la toile, le câble suit. Chaque câble de l'atelier
 * produit donc deux ports et un lien, jamais un trait libre.
 */
import type { Cable, Materiel, TypeMateriel } from './physique';
import { nomDuMedia } from './physique';

/* ------------------------------------------------------------------ le format */

/** Un port de Plan : point d'accroche nommé sur un bord de nœud. */
export interface PortPlan {
  id: string;
  nom: string;
  cote: 'haut' | 'bas' | 'gauche' | 'droite';
  /** Fraction du bord, de 0 à 1. */
  position: number;
  nature?: 'physique' | 'virtuelle';
  ip?: string;
  vlan?: string;
  affichage?: 'masque' | 'simple' | 'complet';
}

export interface NoeudPlan {
  id: string;
  x: number; y: number; w: number; h: number;
  objet: string;
  description?: string;
  ports?: PortPlan[];
  forme?: 'fiche' | 'texte' | 'clipart';
  style?: Record<string, string | number>;
}

export interface LienPlan {
  id: string;
  de: { noeudId: string; portId: string };
  vers: { noeudId: string; portId: string };
  trace: 'orthogonal' | 'arrondi' | 'droit';
  points: never[];
  fleches: { debut: boolean; fin: boolean };
  etiquette?: string;
  style?: { couleur?: string; epaisseur?: number; motif?: 'plein' | 'tirets' | 'points' | 'mixte' };
}

/** L'enveloppe attendue par l'import de Plan. */
export interface EnveloppePlan {
  format: 'miyukini-plan';
  version: number;
  exporteLe: string;
  document: { id: string; titre: string; version: number; noeuds: NoeudPlan[]; liens: LienPlan[] };
}

/* ------------------------------------------------------- ce que l'atelier fournit */

/** Une interface résolue par le moteur d'adressage — sous-ensemble de `Iface`. */
export interface InterfaceResolue {
  routerId: string;
  iface: string;
  ip: string;
  cidr: number;
  vlan?: number;
  role?: string;
}

export interface EntreeTopologie {
  materiels: Materiel[];
  cables: Cable[];
  /** Positions posées à la main dans le schéma physique. Absent = placement auto. */
  positions?: Record<string, { x: number; y: number } | undefined>;
  /** Interfaces avec leur adresse, telles que le moteur les a calculées. */
  interfaces?: InterfaceResolue[];
  titre?: string;
}

/* ----------------------------------------------------------------- placement */

/**
 * L'étage d'un équipement sur la toile.
 *
 * On reprend la lecture d'un schéma réseau : ce qui sort en haut, ce qui
 * dessert en bas. Un placement automatique qui contredirait cette convention
 * obligerait à tout redéplacer avant de pouvoir lire quoi que ce soit.
 */
const ETAGE: Record<TypeMateriel, number> = {
  nuage: 0,
  routeur: 1,
  multicouche: 2,
  switch: 3,
  serveur: 4,
  poste: 4,
};

const TAILLE: Record<TypeMateriel, { w: number; h: number }> = {
  nuage: { w: 150, h: 90 },
  routeur: { w: 190, h: 110 },
  multicouche: { w: 200, h: 110 },
  switch: { w: 190, h: 100 },
  serveur: { w: 160, h: 90 },
  poste: { w: 140, h: 80 },
};

/** Teinte de la fiche, par nature d'équipement. */
const TEINTE: Record<TypeMateriel, string> = {
  nuage: '#94a3b8',
  routeur: '#2271b1',
  multicouche: '#7c3aed',
  switch: '#0f9d58',
  serveur: '#d97706',
  poste: '#64748b',
};

const PAS_X = 260;
const PAS_Y = 200;

/*
 * Plan ouvre sa toile à l'origine, avec la palette d'objets posée par-dessus le
 * bord gauche. Une interface virtuelle accroche son étiquette À GAUCHE de son
 * nœud — adresse et VLAN compris — et une colonne partant de x=120 la faisait
 * disparaître sous la palette dès l'arrivée. On démarre donc au-delà.
 */
const MARGE_GAUCHE = 420;

/**
 * Place les équipements que l'utilisateur n'a pas placés lui-même.
 *
 * Les positions manuelles sont reprises telles quelles : elles portent une
 * intention, et la recalculer effacerait le travail déjà fait dans l'atelier.
 * Le reste se range par étage, dans l'ordre de déclaration.
 */
function placer(materiels: Materiel[], positions: Record<string, { x: number; y: number } | undefined>) {
  const parEtage = new Map<number, number>();
  const sortie = new Map<string, { x: number; y: number }>();

  for (const m of materiels) {
    const posee = positions[m.id];
    if (posee && Number.isFinite(posee.x) && Number.isFinite(posee.y)) {
      sortie.set(m.id, { x: Math.round(posee.x), y: Math.round(posee.y) });
      continue;
    }
    const etage = ETAGE[m.type] ?? 3;
    const rang = parEtage.get(etage) ?? 0;
    parEtage.set(etage, rang + 1);
    sortie.set(m.id, { x: MARGE_GAUCHE + rang * PAS_X, y: 80 + etage * PAS_Y });
  }
  return sortie;
}

/* -------------------------------------------------------------------- ports */

/**
 * Le nom d'un port physique, tel que l'atelier le nomme.
 *
 * Un switch d'accès numérote ses ports en FastEthernet puis passe en Gigabit
 * pour les liens montants — c'est la disposition d'un 2960-24TT. Un routeur,
 * lui, reçoit son nom d'interface du moteur d'adressage quand il en a un : on
 * ne le devine que faute de mieux.
 */
function nommerPort(m: Materiel, numero: number): string {
  if (m.type === 'switch') {
    const acces = Math.max(0, m.ports - 2);
    return numero <= acces ? `Fa0/${numero}` : `Gig0/${numero - acces}`;
  }
  if (m.type === 'multicouche') return `Gig0/${numero}`;
  if (m.type === 'routeur') return `Gig0/${numero - 1}`;
  return `Port ${numero}`;
}

/** Le bord par lequel un câble quitte l'équipement, selon l'étage d'en face. */
function coteVers(monEtage: number, sonEtage: number): PortPlan['cote'] {
  if (sonEtage < monEtage) return 'haut';
  if (sonEtage > monEtage) return 'bas';
  return 'droite';
}

/* ------------------------------------------------------------------ traduction */

/**
 * Construit le document Plan à partir de la topologie de l'atelier.
 *
 * `maintenant` et `identifiant` sont injectables : sans cela la fonction ne
 * serait pas testable, puisque deux appels identiques produiraient des
 * documents différents.
 */
export function versDocumentPlan(
  entree: EntreeTopologie,
  maintenant: Date = new Date(),
  identifiant: () => string = () => Math.random().toString(36).slice(2, 10),
): EnveloppePlan {
  const materiels = entree.materiels ?? [];
  const cables = entree.cables ?? [];
  const positions = entree.positions ?? {};
  const interfaces = entree.interfaces ?? [];

  const parId = new Map(materiels.map((m) => [m.id, m]));
  const place = placer(materiels, positions);

  // Les interfaces adressées, groupées par équipement. Un même équipement peut
  // en porter plusieurs — sous-interfaces 802.1Q comprises.
  const ifacesDe = new Map<string, InterfaceResolue[]>();
  for (const i of interfaces) {
    const liste = ifacesDe.get(i.routerId) ?? [];
    liste.push(i);
    ifacesDe.set(i.routerId, liste);
  }

  const ports = new Map<string, PortPlan[]>();
  const ajouterPort = (materielId: string, port: PortPlan) => {
    const liste = ports.get(materielId) ?? [];
    liste.push(port);
    ports.set(materielId, liste);
  };

  /* --- un port par bout de câble ------------------------------------------ */

  const liens: LienPlan[] = [];
  for (const c of cables) {
    const a = parId.get(c.deId);
    const b = parId.get(c.versId);
    // Un câble qui pointe vers un équipement absent est ignoré : le dessiner
    // produirait un lien accroché dans le vide.
    if (!a || !b) continue;

    const etageA = ETAGE[a.type] ?? 3;
    const etageB = ETAGE[b.type] ?? 3;

    const nomA = nommerPort(a, c.dePort);
    const nomB = nommerPort(b, c.versPort);

    // L'adresse de ce port, si le moteur en a calculé une pour cette interface.
    const adresseDe = (materielId: string, nom: string) => {
      const trouvee = (ifacesDe.get(materielId) ?? []).find(
        (i) => i.iface === nom || i.iface.startsWith(nom + '.'),
      );
      return trouvee ? { ip: `${trouvee.ip}/${trouvee.cidr}`, vlan: trouvee.vlan ? String(trouvee.vlan) : undefined } : {};
    };

    const idA = `p:${c.id}:a`;
    const idB = `p:${c.id}:b`;

    ajouterPort(a.id, {
      id: idA, nom: nomA, cote: coteVers(etageA, etageB), position: 0.5,
      nature: 'physique', affichage: 'complet', ...adresseDe(a.id, nomA),
    });
    ajouterPort(b.id, {
      id: idB, nom: nomB, cote: coteVers(etageB, etageA), position: 0.5,
      nature: 'physique', affichage: 'complet', ...adresseDe(b.id, nomB),
    });

    liens.push({
      id: `l:${c.id}`,
      de: { noeudId: `n:${a.id}`, portId: idA },
      vers: { noeudId: `n:${b.id}`, portId: idB },
      trace: 'orthogonal',
      points: [],
      // Un câble n'a pas de sens de circulation : aucune flèche.
      fleches: { debut: false, fin: false },
      // Sans la parenthèse anglaise : sur la toile, « cuivre croisé (Copper
      // Cross-Over) » chevauche l'étiquette du lien voisin. Le nom complet reste
      // dans l'atelier, où il sert à retrouver le câble dans Packet Tracer.
      etiquette: nomDuMedia(c.media).replace(/\s*\(.*\)$/, ''),
      // Le pointillé distingue la liaison série du cuivre — c'est du sens, pas
      // de la décoration.
      style: c.media === 'serie' ? { motif: 'tirets' } : undefined,
    });
  }

  /* --- les interfaces virtuelles, sans câble ------------------------------- */

  // Une SVI ou une sous-interface 802.1Q n'a pas de câble à elle : elle vit sur
  // une interface physique. Sans elle, un schéma de routage inter-VLAN perdrait
  // justement ce qu'il doit montrer.
  for (const m of materiels) {
    const dejaVus = new Set((ports.get(m.id) ?? []).map((p) => p.nom));
    const virtuelles = (ifacesDe.get(m.id) ?? []).filter(
      (i) => (i.vlan != null && i.iface.includes('.')) || i.iface.startsWith('Vlan'),
    );
    virtuelles.forEach((i, n) => {
      if (dejaVus.has(i.iface)) return;
      ajouterPort(m.id, {
        id: `p:${m.id}:v${n}`,
        nom: i.iface,
        cote: 'gauche',
        position: virtuelles.length > 1 ? (n + 1) / (virtuelles.length + 1) : 0.5,
        nature: 'virtuelle',
        affichage: 'complet',
        ip: `${i.ip}/${i.cidr}`,
        vlan: i.vlan != null ? String(i.vlan) : undefined,
      });
    });
  }

  /* --- répartition des ports sur leur bord --------------------------------- */

  // Sans cela tous les ports d'un même bord se superposent à mi-hauteur, et les
  // câbles partent du même point.
  for (const [, liste] of ports) {
    const parCote = new Map<string, PortPlan[]>();
    for (const p of liste) {
      const g = parCote.get(p.cote) ?? [];
      g.push(p);
      parCote.set(p.cote, g);
    }
    for (const [, groupe] of parCote) {
      groupe.forEach((p, i) => { p.position = (i + 1) / (groupe.length + 1); });
    }
  }

  /* --- les nœuds ----------------------------------------------------------- */

  const noeuds: NoeudPlan[] = materiels.map((m) => {
    const p = place.get(m.id) ?? { x: 0, y: 0 };
    const taille = TAILLE[m.type] ?? { w: 180, h: 100 };
    return {
      id: `n:${m.id}`,
      x: p.x, y: p.y, w: taille.w, h: taille.h,
      objet: m.nom || m.id,
      description: [m.modele, `${m.ports} ports`].filter(Boolean).join(' · '),
      ports: ports.get(m.id) ?? [],
      forme: 'fiche',
      style: { couleur: TEINTE[m.type] ?? '#64748b' },
    };
  });

  return {
    format: 'miyukini-plan',
    version: 1,
    exporteLe: maintenant.toISOString(),
    document: {
      id: identifiant(),
      titre: entree.titre?.trim() || 'Schéma réseau',
      version: 1,
      noeuds,
      liens,
    },
  };
}

/* ------------------------------------------------------------------ transport */

/**
 * Encode l'enveloppe pour un fragment d'URL.
 *
 * Base64 en variante URL : les caractères `+`, `/` et `=` d'un base64 ordinaire
 * sont soit réservés dans une URL, soit tronqués par les outils qui devinent la
 * fin d'un lien. Et le passage par `encodeURIComponent` avant encodage évite de
 * perdre les accents — le titre d'un schéma en contient presque toujours.
 */
export function encoderPourUrl(enveloppe: EnveloppePlan): string {
  const texte = JSON.stringify(enveloppe);
  const octets = new TextEncoder().encode(texte);
  let binaire = '';
  for (const o of octets) binaire += String.fromCharCode(o);
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * La limite au-delà de laquelle on n'essaie plus l'URL.
 *
 * Les navigateurs acceptent des fragments bien plus longs, mais les serveurs
 * intermédiaires et les journaux tronquent — et un schéma tronqué s'ouvre sur
 * une erreur incompréhensible. Au-delà, on propose le fichier, qui n'a pas de
 * limite.
 */
export const LIMITE_URL = 30_000;

export function urlDeTransfert(base: string, enveloppe: EnveloppePlan): string | null {
  const charge = encoderPourUrl(enveloppe);
  if (charge.length > LIMITE_URL) return null;
  // Le fragment ne part JAMAIS au serveur : c'est la bonne place pour une
  // charge utile qui n'a rien à faire dans un journal d'accès.
  return `${base.replace(/\/+$/, '')}/#schema=${charge}`;
}

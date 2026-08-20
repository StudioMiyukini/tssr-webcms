/* Couche 1 — le matériel et le câblage.
 *
 * L'atelier a toujours travaillé à l'envers du montage réel : on déclarait des
 * sous-réseaux et le matériel s'en déduisait. C'est efficace pour produire un
 * plan d'adressage, et c'est l'inverse de ce qu'on fait devant une baie — où
 * l'on pose les équipements, on tire les câbles, et l'adressage vient après.
 *
 * Ce module tient l'inventaire et le câblage. Il ne connaît **aucune adresse
 * IP** : c'est la couche 3 qui s'en occupe, et les mélanger est précisément ce
 * que le modèle OSI apprend à ne pas faire.
 *
 * Ce qu'il sait dire, en revanche, c'est si un câblage tient debout : deux
 * câbles sur le même port, un lien vers un port qui n'existe pas, un équipement
 * relié à rien — et le bon type de câble entre deux appareils, qui est la
 * première question de tout TP.
 */

export type TypeMateriel = 'routeur' | 'switch' | 'multicouche' | 'serveur' | 'poste' | 'nuage';

export interface Materiel {
  id: string;
  nom: string;
  type: TypeMateriel;
  /** Modèle affiché : 2911, 2960, 3560… Sert au libellé, pas au calcul. */
  modele: string;
  /** Nombre de ports. Un poste en a un, un switch d'accès vingt-quatre. */
  ports: number;
}

export type Media = 'droit' | 'croise' | 'serie' | 'fibre' | 'console';

export interface Cable {
  id: string;
  deId: string;
  dePort: number;
  versId: string;
  versPort: number;
  media: Media;
}

/** Ce qu'un défaut de câblage provoque, et non seulement qu'il existe. */
export interface DefautPhysique {
  quoi: string;
  effet: string;
  /** L'équipement concerné, pour surligner la bonne carte. */
  materielId?: string;
}

/** Les ports d'un modèle, quand on n'en dit rien. */
export const PORTS_TYPIQUES: Record<TypeMateriel, number> = {
  routeur: 4,
  switch: 24,
  multicouche: 24,
  serveur: 1,
  poste: 1,
  nuage: 2,
};

/**
 * La couche à laquelle un équipement travaille.
 *
 * Sert à expliquer, pas à contraindre : un switch d'accès s'arrête à la
 * couche 2, et c'est la raison pour laquelle il ne peut pas router entre VLAN.
 * Le dire ici évite de le réexpliquer à chaque écran.
 */
export const COUCHE_DE: Record<TypeMateriel, number> = {
  poste: 7,
  serveur: 7,
  switch: 2,
  multicouche: 3,
  routeur: 3,
  nuage: 1,
};

/**
 * Le câble attendu entre deux appareils.
 *
 * La règle historique : **même couche OSI → croisé, couches différentes →
 * droit**. Deux switches se parlent en croisé, un poste et un switch en droit.
 *
 * Elle vaut encore d'être sue, même si l'auto-MDIX la rend invisible sur le
 * matériel moderne : Packet Tracer, lui, l'applique strictement, et c'est
 * exactement là que se perd la première heure d'un TP.
 */
export function cableAttendu(a: TypeMateriel, b: TypeMateriel): Media {
  // Le nuage represente un lien operateur : on ne discute pas son cablage.
  if (a === 'nuage' || b === 'nuage') return 'droit';

  const memeNiveau = (x: TypeMateriel, y: TypeMateriel) => {
    const groupe = (t: TypeMateriel) => (t === 'poste' || t === 'serveur' || t === 'routeur' ? 'terminal' : 'commutation');
    return groupe(x) === groupe(y);
  };
  return memeNiveau(a, b) ? 'croise' : 'droit';
}

/** Le nom du câble, tel qu'on le lit dans Packet Tracer. */
export function nomDuMedia(m: Media): string {
  return {
    droit: 'cuivre droit (Copper Straight-Through)',
    croise: 'cuivre croisé (Copper Cross-Over)',
    serie: 'série (Serial DCE/DTE)',
    fibre: 'fibre optique',
    console: 'console (bleu)',
  }[m];
}

/** L'autre bout d'un câble, vu depuis un équipement. */
export function voisinsDe(cables: Cable[], id: string): { cable: Cable; autreId: string; monPort: number; sonPort: number }[] {
  const out: { cable: Cable; autreId: string; monPort: number; sonPort: number }[] = [];
  for (const c of cables) {
    if (c.deId === id) out.push({ cable: c, autreId: c.versId, monPort: c.dePort, sonPort: c.versPort });
    else if (c.versId === id) out.push({ cable: c, autreId: c.deId, monPort: c.versPort, sonPort: c.dePort });
  }
  return out;
}

/**
 * Vérifie le câblage.
 *
 * Chaque défaut dit ce qu'il provoque : « deux câbles sur le port 3 » n'aide
 * personne, « le second n'aura aucun effet » désigne la panne qu'on cherchera.
 */
export function verifierCablage(materiels: Materiel[], cables: Cable[]): DefautPhysique[] {
  const out: DefautPhysique[] = [];
  const parId = new Map(materiels.map(m => [m.id, m]));
  const occupe = new Map<string, string>();

  for (const c of cables) {
    const a = parId.get(c.deId);
    const b = parId.get(c.versId);

    if (!a || !b) {
      out.push({
        quoi: 'Un câble part vers un équipement qui n’existe plus',
        effet: 'Il ne sera pas dessiné et ne produira aucune configuration. Supprime-le.',
      });
      continue;
    }
    if (c.deId === c.versId) {
      out.push({
        quoi: `${a.nom} est relié à lui-même`,
        effet: 'Sur un switch, c’est une boucle : sans spanning-tree, le réseau sature en quelques secondes.',
        materielId: a.id,
      });
      continue;
    }

    for (const [m, port] of [[a, c.dePort], [b, c.versPort]] as [Materiel, number][]) {
      if (port < 1 || port > m.ports) {
        out.push({
          quoi: `${m.nom} n’a pas de port ${port}`,
          effet: `Il en compte ${m.ports}. L’IOS refusera l’interface sans dire laquelle il attendait.`,
          materielId: m.id,
        });
        continue;
      }
      const cle = `${m.id}|${port}`;
      const deja = occupe.get(cle);
      if (deja) {
        out.push({
          quoi: `${m.nom} : deux câbles sur le port ${port}`,
          effet: `Le premier va vers ${deja}. Un port ne reçoit qu’un lien — le second n’aura aucun effet.`,
          materielId: m.id,
        });
      } else {
        occupe.set(cle, m.id === a.id ? b.nom : a.nom);
      }
    }

    const attendu = cableAttendu(a.type, b.type);
    if (c.media !== attendu && c.media !== 'fibre' && c.media !== 'serie') {
      out.push({
        quoi: `${a.nom} ↔ ${b.nom} : câble ${nomDuMedia(c.media)}`,
        effet: `Entre ces deux-là, il faut du ${nomDuMedia(attendu)}. Dans Packet Tracer le lien reste rouge et rien ne passe.`,
        materielId: a.id,
      });
    }
  }

  for (const m of materiels) {
    if (!voisinsDe(cables, m.id).length) {
      out.push({
        quoi: `${m.nom} n’est relié à rien`,
        effet: 'Il apparaîtra dans l’inventaire mais dans aucun chemin : ses configurations resteront sans effet.',
        materielId: m.id,
      });
    }
  }

  return out;
}

/** Les ports libres d'un équipement — ce qu'on propose au moment de câbler. */
export function portsLibres(m: Materiel, cables: Cable[]): number[] {
  const pris = new Set(voisinsDe(cables, m.id).map(v => v.monPort));
  const out: number[] = [];
  for (let p = 1; p <= m.ports; p++) if (!pris.has(p)) out.push(p);
  return out;
}

/**
 * Ce par quoi un équipement remonte vers le cœur du réseau.
 *
 * Un switch d'accès déclarait jusqu'ici vers quoi il remonte, par quel port, et
 * sur quel port d'en face. Ce sont trois façons de décrire un câble ; depuis
 * que la couche 1 tient le câblage, ils s'en déduisent — et la cascade avec
 * eux, sans qu'on ait à la déclarer.
 *
 * Le parent est le voisin **le plus proche d'une racine**, en largeur d'abord :
 * dans un montage en cascade, un switch de bâtiment remonte par le switch de
 * distribution, pas par le poste qu'il alimente.
 */
export interface Remontee {
  id: string;
  /** Ce vers quoi il remonte : un multicouche, ou un autre switch. */
  parentId: string;
  /** Le port de CET équipement. */
  monPort: number;
  /** Le port en face — distinct, et c'est ce que la configuration vise. */
  sonPort: number;
}

export function remontees(cables: Cable[], racines: string[], membres: string[]): Remontee[] {
  const dans = new Set(membres);
  const vus = new Set(racines);
  const out: Remontee[] = [];
  let front = [...racines];
  while (front.length) {
    const suivant: string[] = [];
    for (const p of front) {
      for (const v of voisinsDe(cables, p)) {
        // On ne descend que dans les équipements de commutation : un poste
        // relié à deux switches ne doit pas servir de chemin entre eux.
        if (!dans.has(v.autreId) || vus.has(v.autreId)) continue;
        vus.add(v.autreId);
        out.push({ id: v.autreId, parentId: p, monPort: v.sonPort, sonPort: v.monPort });
        suivant.push(v.autreId);
      }
    }
    front = suivant;
  }
  return out;
}

/**
 * Le chemin physique entre deux équipements, s'il existe.
 *
 * Sert à répondre à « pourquoi ces deux postes ne se voient-ils pas ? » par la
 * seule couche 1 : s'il n'y a pas de chemin de câbles, aucune configuration
 * n'y changera rien, et c'est la première chose à éliminer.
 */
export function cheminPhysique(cables: Cable[], deId: string, versId: string): string[] | null {
  if (deId === versId) return [deId];
  const vus = new Set([deId]);
  const file: string[][] = [[deId]];
  while (file.length) {
    const chemin = file.shift()!;
    for (const v of voisinsDe(cables, chemin[chemin.length - 1]!)) {
      if (vus.has(v.autreId)) continue;
      const suite = [...chemin, v.autreId];
      if (v.autreId === versId) return suite;
      vus.add(v.autreId);
      file.push(suite);
    }
  }
  return null;
}

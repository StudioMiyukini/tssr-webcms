/* La recherche de l'aide-mémoire Linux, en langage naturel.
 *
 * La première version comparait la requête entière au texte de chaque fiche :
 * « disque plein » fonctionnait, « comment voir la place qui reste sur le
 * disque » ne trouvait rien. C'est précisément la façon dont on cherche quand
 * on ne connaît pas le nom de la commande — donc le cas que l'outil existe pour
 * traiter.
 *
 * On découpe donc la requête en mots, on jette ceux qui n'apprennent rien
 * (« comment », « je », « sur »), on ramène chaque mot à un radical grossier
 * pour que le pluriel et le féminin se rejoignent, et on étend par synonymes —
 * « place », « espace » et « stockage » désignent la même chose, et l'élève
 * emploiera celui qui lui vient.
 *
 * La logique vit ici plutôt que dans le composant : c'est du texte qui entre et
 * un classement qui sort, donc quelque chose qui se teste.
 */
import type { LinuxEntry } from './linux-data';

/** Minuscules sans accents : « répertoire » se trouve en tapant « repertoire ». */
/*
 * @id     tssr.atelier.linuxRecherche
 * @do     rechercher_commandes_linux
 * @role   donnee
 * @layer  outil
 * @human  Recherche dans les commandes Linux de l'atelier (normalisation et filtrage).
 */
export const normaliser = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Les mots qui n'apprennent rien sur ce qu'on cherche.
 *
 * Les garder ferait remonter n'importe quelle fiche contenant « le » ou
 * « pour » — c'est-à-dire toutes.
 */
const MOTS_VIDES = new Set([
  'a', 'au', 'aux', 'avec', 'ce', 'ces', 'cet', 'cette', 'comment', 'dans', 'de',
  'des', 'du', 'en', 'est', 'et', 'faire', 'fait', 'il', 'je', 'la', 'le', 'les',
  'leur', 'ma', 'mais', 'me', 'mes', 'mon', 'ne', 'nos', 'notre', 'nous', 'on',
  'ou', 'par', 'pas', 'peut', 'plus', 'pour', 'qu', 'que', 'quel', 'quelle',
  'qui', 'quoi', 'sa', 'sans', 'se', 'ses', 'son', 'sont', 'sur', 'ta', 'te',
  'tes', 'ton', 'tu', 'un', 'une', 'veux', 'voir', 'vos', 'votre', 'vous', 'y',
]);

/**
 * Un radical grossier : on retire le pluriel et quelques terminaisons.
 *
 * Ce n'est pas de la lemmatisation — juste de quoi rapprocher « fichiers » de
 * « fichier », « commandes » de « commande », « supprimer » de « suppression ».
 * Les mots de trois lettres ou moins sont laissés tels quels : les tronquer
 * ferait se rejoindre des choses qui n'ont rien à voir.
 */
export function radical(mot: string): string {
  if (mot.length <= 3) return mot;
  let m = mot;
  for (const fin of ['ement', 'ation', 'sions', 'tions', 'eurs', 'ance', 'ence']) {
    if (m.length > fin.length + 2 && m.endsWith(fin)) { m = m.slice(0, -fin.length); break; }
  }
  // Le pluriel d'abord : « fichiers » doit devenir « fichier » avant que la
  // regle sur -er ne s'applique, sinon les deux formes ne se rejoignent pas.
  if (m.length > 3 && (m.endsWith('s') || m.endsWith('x'))) m = m.slice(0, -1);
  if (m.length > 4 && (m.endsWith('er') || m.endsWith('ez'))) m = m.slice(0, -2);
  return m;
}

/**
 * Les familles de mots qui désignent la même chose.
 *
 * Chaque ligne est un groupe : taper n'importe lequel de ses mots fait chercher
 * tous les autres. C'est ce qui permet à « place » de trouver une fiche qui
 * parle d'« espace disque », et à « tuer » de trouver « arrêter un processus ».
 */
const FAMILLES: string[][] = [
  ['place', 'espace', 'stockage', 'disque', 'plein', 'sature', 'volumetrie', 'reste', 'restant', 'libre', 'disponible', 'dispo'],
  ['supprimer', 'effacer', 'enlever', 'retirer', 'detruire'],
  ['tuer', 'arreter', 'stopper', 'terminer', 'kill'],
  ['demarrer', 'lancer', 'executer', 'start', 'demarrage'],
  ['redemarrer', 'restart', 'relancer', 'reboot'],
  ['copier', 'copie', 'dupliquer', 'transferer', 'envoyer'],
  ['deplacer', 'renommer', 'bouger'],
  ['chercher', 'trouver', 'rechercher', 'localiser', 'retrouver'],
  ['droit', 'permission', 'acces', 'autorisation', 'chmod'],
  ['proprietaire', 'appartenance', 'owner', 'chown'],
  ['utilisateur', 'compte', 'user', 'login'],
  ['groupe', 'group'],
  ['reseau', 'network', 'connexion', 'internet'],
  ['adresse', 'ip', 'ipconfig', 'ifconfig'],
  ['port', 'ecoute', 'listen', 'socket'],
  ['service', 'daemon', 'demon', 'systemd', 'systemctl'],
  ['journal', 'log', 'trace', 'historique'],
  ['paquet', 'logiciel', 'programme', 'application', 'apt', 'installer'],
  ['processus', 'process', 'tache', 'programme'],
  ['memoire', 'ram'],
  ['processeur', 'cpu', 'charge', 'lent', 'rame'],
  ['fichier', 'document'],
  ['dossier', 'repertoire', 'directory'],
  ['archive', 'compresser', 'zip', 'tar', 'sauvegarde', 'backup'],
  ['montage', 'monter', 'partage', 'mount'],
  ['texte', 'contenu', 'ligne', 'motif'],
  ['editer', 'modifier', 'changer', 'ecrire'],
  ['afficher', 'lire', 'consulter', 'montrer'],
  ['taille', 'poids', 'volume'],
  ['refuse', 'interdit', 'denied', 'bloque', 'echoue'],
  ['distant', 'remote', 'ssh', 'distance'],
  ['pare-feu', 'firewall', 'ufw', 'filtrage'],
  ['nom', 'dns', 'resolution', 'hostname'],
];

/** mot → tous les mots de sa famille, radicaux compris. */
const INDEX_SYNONYMES: Map<string, string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const famille of FAMILLES) {
    const rads = [...new Set(famille.map(x => radical(normaliser(x))))];
    for (const mot of famille) m.set(radical(normaliser(mot)), rads);
  }
  return m;
})();

/** Un mot de la requête, avec les mots qu'il faut aussi chercher. */
export interface Terme {
  mot: string;
  variantes: string[];
}

/** Découpe une requête en termes utiles, étendus par synonymes. */
export function termes(requete: string): Terme[] {
  const bruts = normaliser(requete)
    .split(/[^a-z0-9_.-]+/)
    .filter(Boolean)
    .filter(m => !MOTS_VIDES.has(m));
  const out: Terme[] = [];
  const vus = new Set<string>();
  for (const b of bruts) {
    const r = radical(b);
    if (!r || vus.has(r)) continue;
    vus.add(r);
    out.push({ mot: r, variantes: INDEX_SYNONYMES.get(r) ?? [r] });
  }
  return out;
}

/** Les champs d'une fiche, du plus révélateur au moins. */
function champs(e: LinuxEntry): [string, number][] {
  return [
    [e.tache, 10],
    [(e.alias ?? []).join(' '), 8],
    [e.commande, 6],
    [e.windows ?? '', 5],
    [e.quoi, 3],
    [(e.aussi ?? []).join(' '), 2],
    [(e.options ?? []).map(o => o[1]).join(' '), 2],
    [e.piege ?? '', 1],
  ];
}

/**
 * Le score d'une fiche pour une requête.
 *
 * Un terme compte s'il apparaît dans au moins un champ ; le poids retenu est
 * celui du champ le plus révélateur où il se trouve. Une fiche qui ne couvre
 * pas assez de termes est écartée : sans ce seuil, « place disque » ferait
 * remonter toutes les fiches contenant « disque », y compris celles qui n'ont
 * rien à voir avec la place.
 */
export function score(e: LinuxEntry, ts: Terme[]): number {
  if (!ts.length) return 1;
  const zones = champs(e).map(([t, p]) => [normaliser(t), p] as [string, number]);
  let total = 0;
  let couverts = 0;
  for (const t of ts) {
    let meilleur = 0;
    for (const [texte, poids] of zones) {
      for (const v of t.variantes) {
        if (!texte.includes(v)) continue;
        // Le mot exact vaut mieux qu'un mot dont il n'est qu'un morceau.
        const exact = new RegExp(`(^|[^a-z0-9])${v}`).test(texte);
        const p = poids * (exact ? 1 : 0.55) * (v === t.mot ? 1 : 0.7);
        if (p > meilleur) meilleur = p;
      }
    }
    if (meilleur > 0) { total += meilleur; couverts++; }
  }
  // Il faut la moitié des termes, et au moins un.
  if (couverts === 0 || couverts * 2 < ts.length) return 0;
  // Couvrir tous les termes vaut mieux que d'en couvrir la moitié très fort.
  return total * (couverts / ts.length);
}

/** Les fiches qui répondent, de la plus pertinente à la moins. */
export function rechercher(entries: LinuxEntry[], requete: string, categorie = 'all'): LinuxEntry[] {
  const ts = termes(requete);
  return entries
    .map(e => ({ e, s: categorie !== 'all' && e.categorie !== categorie ? 0 : score(e, ts) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s || a.e.tache.localeCompare(b.e.tache))
    .map(x => x.e);
}

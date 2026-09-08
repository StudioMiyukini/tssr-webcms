/* Listes de contrôle d'accès (ACL) Cisco : le modèle, les textes, les contrôles.
 *
 * Une ACL est une liste d'ACE — des règles lues DANS L'ORDRE, du haut vers le
 * bas, jusqu'à la première qui correspond. Ce détail commande tout le reste :
 * une règle large placée trop haut rend muettes celles du dessous, et c'est la
 * panne la plus fréquente en TP. Le module sait donc écrire une ACL, mais aussi
 * dire quand elle ne fera pas ce qu'on croit.
 *
 * Il ne connaît ni React ni le DOM : il transforme une description en textes de
 * configuration et en avertissements. C'est ce qui le rend éprouvable.
 *
 * @id     tssr.atelier.acl
 * @do     modeliser_et_ecrire_les_acl
 * @role   donnee
 * @layer  outil
 * @human  Le filtrage du routeur : ACE, wildcard, sens, placement, contrôles.
 */

// ───────────────────────────────────────────────── services et protocoles ───

export type Transport = 'ip' | 'tcp' | 'udp' | 'icmp';

/** Un service applicatif : ce qu'on met derrière `eq` dans une ACE. */
export interface Service {
  port: number;
  proto: 'tcp' | 'udp';
  /** Le mot-clé accepté par IOS à la place du numéro (`eq www`). */
  motCle: string;
  nom: string;
}

/*
 * LES SERVICES DE L'EXERCICE, ET RIEN DE PLUS.
 *
 * La liste reprend exactement celle du classeur d'exercice : ce sont les ports
 * qu'on filtre en TP et qu'on doit savoir citer de mémoire. En ajouter trente
 * autres ferait un menu où l'on ne trouve plus les cinq qui servent.
 */
export const SERVICES: readonly Service[] = [
  { port: 20, proto: 'tcp', motCle: 'ftp-data', nom: 'FTP — données' },
  { port: 21, proto: 'tcp', motCle: 'ftp', nom: 'FTP — commandes' },
  { port: 22, proto: 'tcp', motCle: 'ssh', nom: 'SSH' },
  { port: 23, proto: 'tcp', motCle: 'telnet', nom: 'Telnet' },
  { port: 25, proto: 'tcp', motCle: 'smtp', nom: 'SMTP — envoi de courriel' },
  { port: 53, proto: 'udp', motCle: 'domain', nom: 'DNS — résolution de noms' },
  { port: 67, proto: 'udp', motCle: 'bootps', nom: 'DHCP — côté serveur' },
  { port: 68, proto: 'udp', motCle: 'bootpc', nom: 'DHCP — côté client' },
  { port: 80, proto: 'tcp', motCle: 'www', nom: 'HTTP' },
  { port: 110, proto: 'tcp', motCle: 'pop3', nom: 'POP3 — relève de courriel' },
  { port: 143, proto: 'tcp', motCle: '143', nom: 'IMAP4 — relève de courriel' },
  { port: 161, proto: 'udp', motCle: 'snmp', nom: 'SNMP — supervision' },
  { port: 162, proto: 'udp', motCle: 'snmptrap', nom: 'SNMP — alertes (trap)' },
  { port: 389, proto: 'tcp', motCle: '389', nom: 'LDAP — annuaire' },
  { port: 443, proto: 'tcp', motCle: '443', nom: 'HTTPS' },
  { port: 993, proto: 'tcp', motCle: '993', nom: 'IMAPS — IMAP chiffré' },
  { port: 995, proto: 'tcp', motCle: '995', nom: 'POP3S — POP3 chiffré' },
] as const;

/** Les messages ICMP qu'on filtre couramment. Un ping, c'est les deux. */
export const MESSAGES_ICMP: ReadonlyArray<{ cle: string; nom: string }> = [
  { cle: '', nom: 'tous les messages' },
  { cle: 'echo', nom: 'echo — la demande de ping' },
  { cle: 'echo-reply', nom: 'echo-reply — la réponse au ping' },
] as const;

// ────────────────────────────────────────────────────────────── les cibles ───

/**
 * Ce que désigne la source ou la destination d'une ACE.
 *
 * Trois formes, et c'est tout ce que la syntaxe IOS accepte : n'importe qui,
 * une machine, un réseau. Le wildcard n'apparaît que dans la troisième — c'est
 * pour cela qu'il déroute : on ne l'écrit que quand on filtre un réseau.
 */
export type Cible =
  | { genre: 'any' }
  | { genre: 'host'; ip: string }
  | { genre: 'reseau'; ip: string; cidr: number };

const enNombre = (ip: string): number | null => {
  const m = ip.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const o = m.slice(1, 5).map(Number);
  if (o.some(x => x > 255)) return null;
  return (((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0);
};

const enTexte = (n: number): string =>
  [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');

/**
 * Le masque générique d'un préfixe : l'inverse du masque réseau.
 *
 * Un bit à 0 veut dire « doit correspondre », un bit à 1 « peu importe ».
 * D'où la règle de calcul mental : wildcard = 255.255.255.255 − masque.
 */
export function wildcard(cidr: number): string {
  const c = Math.max(0, Math.min(32, Math.trunc(cidr)));
  return enTexte((c === 0 ? 0xFFFFFFFF : (~((0xFFFFFFFF << (32 - c)) >>> 0)) >>> 0) >>> 0);
}

/** La cible, telle qu'elle s'écrit dans une ACE. */
export function ecrireCible(c: Cible): string {
  if (c.genre === 'any') return 'any';
  if (c.genre === 'host') return `host ${c.ip.trim()}`;
  return `${c.ip.trim()} ${wildcard(c.cidr)}`;
}

/**
 * L'étendue d'adresses couverte par une cible, en nombres.
 *
 * Sert au contrôle d'ombrage : savoir si une règle en couvre une autre demande
 * de comparer des plages, pas des chaînes.
 */
export function plage(c: Cible): [number, number] | null {
  if (c.genre === 'any') return [0, 0xFFFFFFFF];
  const n = enNombre(c.ip);
  if (n === null) return null;
  if (c.genre === 'host') return [n, n];
  const cidr = Math.max(0, Math.min(32, Math.trunc(c.cidr)));
  const masque = cidr === 0 ? 0 : (0xFFFFFFFF << (32 - cidr)) >>> 0;
  const debut = (n & masque) >>> 0;
  return [debut, (debut | (~masque >>> 0)) >>> 0];
}

// ─────────────────────────────────────────────────────────── les conditions ───

export type Operateur = '' | 'eq' | 'neq' | 'gt' | 'lt' | 'range';

/** Une condition de port. `operateur` vide = tous les ports. */
export interface Port {
  operateur: Operateur;
  valeur?: number;
  /** Borne haute, pour `range` seulement. */
  fin?: number;
}

export const PORT_TOUS: Port = { operateur: '' };

export function ecrirePort(p?: Port): string {
  if (!p || !p.operateur) return '';
  if (p.operateur === 'range') return `range ${p.valeur ?? 0} ${p.fin ?? 65535}`;
  return `${p.operateur} ${p.valeur ?? 0}`;
}

// ───────────────────────────────────────────────────────────────── les ACE ───

export interface Ace {
  id: string;
  autorisation: 'permit' | 'deny';
  protocole: Transport;
  source: Cible;
  portSource?: Port;
  destination: Cible;
  portDestination?: Port;
  /** Message ICMP (`echo`, `echo-reply`), quand le protocole est ICMP. */
  messageIcmp?: string;
  /** Commentaire, écrit en `remark` juste avant la règle. */
  remarque?: string;
}

export type TypeAcl = 'standard' | 'etendue';

export interface Acl {
  id: string;
  /** Un numéro (« 110 ») ou un nom (« WEB-SEULEMENT »). */
  nom: string;
  type: TypeAcl;
  aces: Ace[];
  /**
   * Ajouter un `permit ip any any` final.
   *
   * Toute ACL se termine par un `deny any` invisible : sans cette ligne, ce qui
   * n'est pas explicitement autorisé tombe. C'est le comportement voulu quand on
   * ferme une interface, et le piège classique quand on voulait seulement
   * bloquer une chose précise.
   */
  permitFinal: boolean;
  /** Où l'ACL est appliquée : une interface, un sens. */
  applications: Array<{ interface: string; sens: 'in' | 'out' }>;
}

/** Le numéro est-il dans la plage réservée à ce type ? */
export function numeroValide(nom: string, type: TypeAcl): boolean {
  const n = Number(nom);
  if (!Number.isInteger(n)) return true; // une ACL nommée n'a pas de plage
  return type === 'standard'
    ? (n >= 1 && n <= 99) || (n >= 1300 && n <= 1999)
    : (n >= 100 && n <= 199) || (n >= 2000 && n <= 2699);
}

/** Le premier numéro libre de la plage du type demandé. */
export function numeroLibre(type: TypeAcl, pris: readonly string[]): string {
  const debut = type === 'standard' ? 1 : 100;
  const fin = type === 'standard' ? 99 : 199;
  const occupes = new Set(pris.map(p => Number(p)).filter(Number.isInteger));
  for (let n = debut; n <= fin; n += 1) if (!occupes.has(n)) return String(n);
  return type === 'standard' ? '1300' : '2000';
}

/**
 * Une ACE, telle qu'elle s'écrit après `permit` / `deny`.
 *
 * UNE ACL STANDARD NE DIT QUE LA SOURCE.
 * Pas de protocole, pas de destination, pas de port : la syntaxe ne les accepte
 * pas. On les ignore donc à l'écriture plutôt que de produire une ligne que le
 * routeur refusera — l'avertissement, lui, est rendu par `verifier`.
 */
export function ecrireAce(a: Ace, type: TypeAcl): string {
  if (type === 'standard') return `${a.autorisation} ${ecrireCible(a.source)}`;

  const morceaux = [a.autorisation, a.protocole, ecrireCible(a.source)];
  const ps = ecrirePort(a.portSource);
  if (ps && (a.protocole === 'tcp' || a.protocole === 'udp')) morceaux.push(ps);
  morceaux.push(ecrireCible(a.destination));
  const pd = ecrirePort(a.portDestination);
  if (pd && (a.protocole === 'tcp' || a.protocole === 'udp')) morceaux.push(pd);
  if (a.protocole === 'icmp' && a.messageIcmp) morceaux.push(a.messageIcmp);
  return morceaux.join(' ');
}

/**
 * L'ACL entière, en configuration à coller.
 *
 * Forme numérotée pour un numéro, forme nommée sinon. Les deux existent sur
 * IOS ; la nommée se relit, la numérotée est celle des exercices.
 */
export function ecrireAcl(acl: Acl): string {
  const numerotee = Number.isInteger(Number(acl.nom));
  const lignes: string[] = [];

  if (numerotee) {
    for (const a of acl.aces) {
      if (a.remarque) lignes.push(`access-list ${acl.nom} remark ${a.remarque}`);
      lignes.push(`access-list ${acl.nom} ${ecrireAce(a, acl.type)}`);
    }
    if (acl.permitFinal) {
      lignes.push(`access-list ${acl.nom} ${acl.type === 'standard' ? 'permit any' : 'permit ip any any'}`);
    }
  } else {
    lignes.push(`ip access-list ${acl.type === 'standard' ? 'standard' : 'extended'} ${acl.nom}`);
    for (const a of acl.aces) {
      if (a.remarque) lignes.push(` remark ${a.remarque}`);
      lignes.push(` ${ecrireAce(a, acl.type)}`);
    }
    if (acl.permitFinal) lignes.push(` ${acl.type === 'standard' ? 'permit any' : 'permit ip any any'}`);
    lignes.push(' exit');
  }

  lignes.push('!');
  for (const ap of acl.applications) {
    lignes.push(`interface ${ap.interface}`);
    lignes.push(` ip access-group ${acl.nom} ${ap.sens}`);
    lignes.push(' exit');
  }
  return lignes.join('\n');
}

// ────────────────────────────────────────────────────────── les contrôles ───

export interface Avertissement {
  /** `erreur` : la config sera refusée ou ne filtrera rien de ce qu'on croit. */
  gravite: 'erreur' | 'attention';
  texte: string;
  /** L'ACE concernée, quand l'avertissement en vise une. */
  ace?: string;
}

const couvre = (a: Cible, b: Cible): boolean => {
  const pa = plage(a); const pb = plage(b);
  return !!pa && !!pb && pa[0] <= pb[0] && pa[1] >= pb[1];
};

const protoCouvre = (a: Transport, b: Transport): boolean => a === 'ip' || a === b;

const portCouvre = (a?: Port, b?: Port): boolean => {
  if (!a || !a.operateur) return true;            // « tous les ports » couvre tout
  if (!b || !b.operateur) return false;           // le précédent est plus étroit
  if (a.operateur !== b.operateur) return false;
  return a.valeur === b.valeur && a.fin === b.fin;
};

/**
 * Les règles rendues inatteignables par une règle précédente.
 *
 * C'est LA panne des ACL, et elle ne se voit pas : la configuration est
 * acceptée, le compteur de la règle masquée reste à zéro, et personne ne
 * comprend pourquoi le filtrage « ne marche pas ». On la détecte en comparant
 * des plages d'adresses, pas des chaînes de caractères.
 */
export function ombres(acl: Acl): number[] {
  const masquees: number[] = [];
  for (let i = 0; i < acl.aces.length; i += 1) {
    for (let j = 0; j < i; j += 1) {
      const av = acl.aces[j]; const ap = acl.aces[i];
      const memeSource = couvre(av.source, ap.source);
      if (!memeSource) continue;
      if (acl.type === 'standard') { masquees.push(i); break; }
      if (protoCouvre(av.protocole, ap.protocole)
        && couvre(av.destination, ap.destination)
        && portCouvre(av.portSource, ap.portSource)
        && portCouvre(av.portDestination, ap.portDestination)) {
        masquees.push(i);
        break;
      }
    }
  }
  return masquees;
}

/**
 * Ce qui cloche dans l'ACL, dit avant de la coller.
 *
 * Rien ne bloque : une ACL en cours d'écriture est incomplète par nature. Les
 * messages disent ce qui se passera réellement — « cette règle ne sera jamais
 * lue », « cette ACL bloque tout » — parce que le routeur, lui, ne dira rien.
 */
export function verifier(acl: Acl): Avertissement[] {
  const av: Avertissement[] = [];

  if (!numeroValide(acl.nom, acl.type)) {
    av.push({
      gravite: 'erreur',
      texte: acl.type === 'standard'
        ? `Le numéro ${acl.nom} n'est pas une ACL standard : il faut 1–99 ou 1300–1999.`
        : `Le numéro ${acl.nom} n'est pas une ACL étendue : il faut 100–199 ou 2000–2699.`,
    });
  }

  if (!acl.aces.length) {
    av.push({ gravite: 'attention', texte: 'Aucune règle : l’ACL ne fait rien tant qu’elle est vide.' });
  }

  if (acl.type === 'standard') {
    for (const a of acl.aces) {
      if (a.protocole !== 'ip' || a.destination.genre !== 'any'
        || (a.portDestination?.operateur ?? '') !== '' || (a.portSource?.operateur ?? '') !== '') {
        av.push({
          gravite: 'erreur', ace: a.id,
          texte: 'Une ACL standard ne filtre que la source. Protocole, destination et ports sont ignorés — passe en étendue.',
        });
      }
    }
  }

  for (const a of acl.aces) {
    const portsDits = (a.portSource?.operateur || a.portDestination?.operateur);
    if (portsDits && a.protocole !== 'tcp' && a.protocole !== 'udp') {
      av.push({
        gravite: 'erreur', ace: a.id,
        texte: `Les ports n’existent qu’en TCP et UDP. Le protocole ${a.protocole.toUpperCase()} n’en a pas.`,
      });
    }
    if (a.messageIcmp && a.protocole !== 'icmp') {
      av.push({ gravite: 'erreur', ace: a.id, texte: 'Un message echo / echo-reply ne se met que sur ICMP.' });
    }
    for (const [role, c] of [['source', a.source], ['destination', a.destination]] as const) {
      if (c.genre !== 'any' && plage(c) === null) {
        av.push({ gravite: 'erreur', ace: a.id, texte: `Adresse ${role} illisible : « ${c.ip} ».` });
      }
    }
  }

  const aucunPermit = acl.aces.length > 0
    && !acl.aces.some(a => a.autorisation === 'permit') && !acl.permitFinal;
  if (aucunPermit) {
    av.push({
      gravite: 'attention',
      texte: 'Aucun permit : avec le deny any implicite, cette ACL bloque tout le trafic de l’interface.',
    });
  }

  for (const i of ombres(acl)) {
    const a = acl.aces[i];
    av.push({
      gravite: 'attention', ace: a.id,
      texte: `Règle ${i + 1} jamais lue : une règle au-dessus couvre déjà ce cas. Remonte-la, ou restreins celle du dessus.`,
    });
  }

  if (!acl.applications.length) {
    av.push({
      gravite: 'attention',
      texte: 'L’ACL n’est appliquée à aucune interface : écrite mais sans effet.',
    });
  }

  const doublons = acl.applications.filter(
    (x, i, t) => t.findIndex(y => y.interface === x.interface && y.sens === x.sens) !== i,
  );
  if (doublons.length) {
    av.push({
      gravite: 'erreur',
      texte: 'Une seule ACL par interface, par sens et par protocole : la même interface est visée deux fois dans le même sens.',
    });
  }

  return av;
}

// ──────────────────────────────────────────────── import en masse d'ACE ───

/*
 * COLLER PLUTÔT QUE RETAPER.
 *
 * L'exercice se prépare dans un tableur : une ligne par ACE, les colonnes
 * Autorisation / Protocole / Source / Port / Destination / Port / Commentaire.
 * Retaper vingt règles dans un formulaire, c'est vingt occasions de se tromper
 * sur un wildcard — et l'élève passe son temps à saisir au lieu de réfléchir au
 * filtrage.
 *
 * L'analyseur accepte donc trois formes, parce que ce sont les trois qui
 * arrivent réellement :
 *   • un collage de tableur (colonnes séparées par des tabulations) ;
 *   • un CSV (point-virgule ou virgule) ;
 *   • des lignes de configuration Cisco, telles qu'on les lit dans un cours ou
 *     dans `show access-lists`.
 *
 * RIEN N'EST DEVINÉ EN SILENCE.
 * Chaque ligne rend soit une ACE, soit une erreur qui dit ce qui n'a pas été
 * compris. L'interface les montre avant d'ajouter quoi que ce soit : un import
 * qui avale vingt lignes et en abîme trois sans le dire est pire qu'un refus.
 */

/** Une ligne du texte collé, et ce qu'on en a tiré. */
export interface LigneImportee {
  /** Le numéro de la ligne dans le texte collé, pour la retrouver. */
  numero: number;
  brut: string;
  ace?: Ace;
  erreur?: string;
}

export interface Import {
  lignes: LigneImportee[];
  /** Ce qui a servi à découper : `\t`, `;`, `,` ou `cli` pour du texte Cisco. */
  separateur: string;
  /** Une ligne d'en-tête a été reconnue et sautée. */
  entete: boolean;
}

/** Enlève accents, casse et ponctuation : pour comparer des noms de colonnes. */
const aplatir = (s: string): string => s
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '');

/*
 * Le séparateur se déduit, il ne se demande pas.
 *
 * Un collage depuis Excel arrive en tabulations ; un fichier exporté depuis le
 * même Excel français arrive en points-virgules. La virgule vient en dernier :
 * elle apparaît aussi dans des adresses mal saisies (« 192,168,1,1 »), et la
 * choisir trop tôt découperait une adresse en quatre colonnes.
 */
function separateurDe(lignes: string[]): string {
  for (const sep of ['\t', ';']) {
    if (lignes.some(l => l.includes(sep))) return sep;
  }
  // La virgule ne compte que si elle sépare au moins trois champs sur une ligne
  // — sinon c'est probablement une adresse écrite avec des virgules.
  if (lignes.some(l => l.split(',').length >= 4 && !/^\s*\d{1,3}(,\d{1,3}){3}\s*$/.test(l))) return ',';
  return 'cli';
}

/** Les colonnes reconnues, dans l'ordre où le classeur d'exercice les pose. */
type Colonne = 'ace' | 'autorisation' | 'protocole' | 'source' | 'portSource'
  | 'destination' | 'portDestination' | 'commentaire' | 'ignore';

/*
 * Sans en-tête, la disposition se déduit du NOMBRE de colonnes.
 *
 * C'est moins fragile qu'il n'y paraît : une ACE a un ordre canonique — action,
 * protocole, source, port, destination, port — et les variantes courantes ne
 * font qu'en retirer des morceaux par la fin ou par le début.
 */
const DISPOSITIONS: Record<number, Colonne[]> = {
  8: ['ace', 'autorisation', 'protocole', 'source', 'portSource', 'destination', 'portDestination', 'commentaire'],
  7: ['autorisation', 'protocole', 'source', 'portSource', 'destination', 'portDestination', 'commentaire'],
  6: ['autorisation', 'protocole', 'source', 'portSource', 'destination', 'portDestination'],
  5: ['autorisation', 'protocole', 'source', 'destination', 'portDestination'],
  4: ['autorisation', 'protocole', 'source', 'destination'],
  3: ['autorisation', 'source', 'destination'],
  2: ['autorisation', 'source'],
};

/** La colonne que désigne un intitulé d'en-tête. */
function colonneDe(titre: string, dejaVuPort: boolean): Colonne {
  const t = aplatir(titre);
  if (!t) return 'ignore';
  if (t.startsWith('ace') || t === 'n' || t === 'numero' || t === 'ordre') return 'ace';
  if (t.includes('autoris') || t.includes('action') || t.includes('permitdeny')) return 'autorisation';
  if (t.includes('protocole') || t === 'proto' || t.includes('transport')) return 'protocole';
  if (t.includes('destination') || t.startsWith('dest')) {
    return t.includes('port') ? 'portDestination' : 'destination';
  }
  if (t.includes('source') || t.startsWith('src')) {
    return t.includes('port') ? 'portSource' : 'source';
  }
  // Deux colonnes « Port » sans autre mot : la première est celle de la source.
  if (t.includes('port')) return dejaVuPort ? 'portDestination' : 'portSource';
  if (t.includes('comment') || t.includes('remarq') || t.includes('note')) return 'commentaire';
  return 'ignore';
}

/** Une ligne ressemble-t-elle à un en-tête plutôt qu'à une règle ? */
function estEntete(cellules: string[]): boolean {
  const mots = cellules.map(aplatir);
  const reperes = ['autorisation', 'source', 'destination', 'protocole', 'ace', 'action', 'port'];
  const trouves = reperes.filter(r => mots.some(m => m.includes(r))).length;
  // Un en-tête ne contient jamais permit ni deny : c'est le test qui tranche
  // quand un tableau nomme ses colonnes « Source » et « Destination » ET qu'une
  // règle les remplit avec les mêmes mots.
  const contientAction = mots.some(m => m === 'permit' || m === 'deny');
  return trouves >= 2 && !contientAction;
}

// ── la lecture de chaque champ ────────────────────────────────────────────

const AUTORISATIONS: Record<string, 'permit' | 'deny'> = {
  permit: 'permit', permis: 'permit', autorise: 'permit', autoriser: 'permit',
  autorisation: 'permit', allow: 'permit', oui: 'permit', p: 'permit',
  deny: 'deny', refuse: 'deny', refuser: 'deny', interdit: 'deny',
  bloque: 'deny', bloquer: 'deny', non: 'deny', d: 'deny',
};

function lireAutorisation(v: string): 'permit' | 'deny' | null {
  return AUTORISATIONS[aplatir(v)] ?? null;
}

function lireProtocole(v: string): Transport | null {
  const t = aplatir(v);
  if (!t) return 'ip';
  if (t === 'ip' || t === 'tout' || t === 'any') return 'ip';
  if (t === 'tcp') return 'tcp';
  if (t === 'udp') return 'udp';
  if (t === 'icmp' || t === 'ping') return 'icmp';
  return null;
}

/*
 * Une adresse peut arriver sous six formes, et toutes ont été vues.
 *
 * `any` · `host 1.2.3.4` · `1.2.3.4` seule · `192.168.1.0 0.0.0.255` (wildcard)
 * · `192.168.1.0/24` · et la notation du classeur d'exercice,
 * `Idsr:192.168.1.0 Wldc:0.0.0.255`. Les refuser aurait voulu dire renvoyer
 * l'élève à la saisie manuelle pour un détail de mise en forme.
 */
export function lireCible(v: string): Cible | null {
  let t = v.trim();
  if (!t) return { genre: 'any' };
  if (/^(any|tous?|n[' ]?importe|toutes?)$/i.test(t)) return { genre: 'any' };

  // Les étiquettes du classeur, et les virgules mises pour des points.
  t = t.replace(/\b(idsr|id|reseau|network)\s*:\s*/gi, '')
    .replace(/\b(wldc|wildcard|masque|mask)\s*:\s*/gi, ' ')
    .replace(/(\d{1,3}),(\d{1,3}),(\d{1,3}),(\d{1,3})/g, '$1.$2.$3.$4')
    .trim();

  const hote = t.match(/^host\s+(\S+)$/i);
  if (hote) return estIp(hote[1]) ? { genre: 'host', ip: hote[1] } : null;

  const prefixe = t.match(/^(\S+)\s*\/\s*(\d{1,2})$/);
  if (prefixe && estIp(prefixe[1])) {
    const c = Number(prefixe[2]);
    return c === 32 ? { genre: 'host', ip: prefixe[1] } : { genre: 'reseau', ip: prefixe[1], cidr: c };
  }

  const paire = t.match(/^(\S+)\s+(\S+)$/);
  if (paire && estIp(paire[1]) && estIp(paire[2])) {
    const c = cidrDeWildcard(paire[2]);
    if (c === null) return null;
    return c === 32 ? { genre: 'host', ip: paire[1] } : { genre: 'reseau', ip: paire[1], cidr: c };
  }

  if (estIp(t)) return { genre: 'host', ip: t };
  return null;
}

const estIp = (s: string): boolean => /^(\d{1,3}\.){3}\d{1,3}$/.test(s)
  && s.split('.').every(o => Number(o) <= 255);

/**
 * Le préfixe correspondant à un masque générique.
 *
 * On n'accepte que les wildcards contigus (0.0.0.255, 0.0.0.7…). Les masques
 * discontinus existent sur IOS mais ne se rencontrent pas en formation, et les
 * accepter reviendrait à valider une frappe fautive.
 */
export function cidrDeWildcard(w: string): number | null {
  const o = w.split('.').map(Number);
  if (o.length !== 4 || o.some(x => !Number.isInteger(x) || x < 0 || x > 255)) return null;
  const n = ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0;
  // Un wildcard contigu vaut 2^k − 1 : ses bits à 1 sont tous à droite.
  if (((n + 1) & n) !== 0) return null;
  let bits = 0;
  for (let x = n; x; x >>>= 1) bits += 1;
  return 32 - bits;
}

/*
 * Une condition de port, sous les formes qu'on écrit vraiment.
 *
 * `eq 80` · `80` · `eq www` · `>1023` · `gt 1023` · `range 1024 65535` ·
 * `eq 67 =Bootps` (le classeur annote ses ports). Un champ vide, `any` ou un
 * tiret veulent dire « tous les ports ».
 */
export function lirePort(v: string): Port | null {
  const t = v.trim().toLowerCase();
  if (!t || t === '-' || t === 'any' || t === 'tous' || t === 'rien') return { operateur: '' };

  const intervalle = t.match(/^range\s+(\d+)\s+(\d+)/);
  if (intervalle) return { operateur: 'range', valeur: Number(intervalle[1]), fin: Number(intervalle[2]) };

  const compare = t.match(/^(eq|neq|gt|lt|>=?|<=?|=)\s*([a-z0-9-]+)/);
  if (compare) {
    const ops: Record<string, Operateur> = { eq: 'eq', '=': 'eq', neq: 'neq', gt: 'gt', '>': 'gt', '>=': 'gt', lt: 'lt', '<': 'lt', '<=': 'lt' };
    const op = ops[compare[1]];
    const n = numeroDePort(compare[2]);
    return op && n !== null ? { operateur: op, valeur: n } : null;
  }

  const seul = numeroDePort(t);
  return seul === null ? null : { operateur: 'eq', valeur: seul };
}

/** Un numéro de port, ou le mot-clé IOS correspondant (`www` → 80). */
function numeroDePort(t: string): number | null {
  const n = Number(t);
  if (Number.isInteger(n) && n >= 0 && n <= 65535) return n;
  const s = SERVICES.find(x => x.motCle === t || aplatir(x.nom).startsWith(aplatir(t)));
  return s ? s.port : null;
}

// ── une ligne de configuration Cisco ──────────────────────────────────────

/*
 * Lire une ACE écrite en configuration.
 *
 * C'est le cas du copier-coller depuis un cours, un corrigé ou un
 * `show access-lists`. On enlève ce qui n'appartient pas à la règle — le
 * préfixe `access-list 110`, le numéro de séquence de la forme nommée — puis on
 * lit les morceaux dans l'ordre canonique.
 */
export function lireLigneCli(ligne: string): { ace?: Ace; erreur?: string } {
  let t = ligne.trim().replace(/^access-list\s+\S+\s+/i, '').replace(/^\d+\s+/, '');
  if (!t || t.startsWith('!')) return {};
  if (/^remark\b/i.test(t)) return {};

  const mots = t.split(/\s+/);
  const autorisation = lireAutorisation(mots.shift() ?? '');
  if (!autorisation) return { erreur: 'ni permit ni deny en tête de ligne' };

  let protocole: Transport = 'ip';
  const proto = lireProtocole(mots[0] ?? '');
  if (proto && /^(ip|tcp|udp|icmp)$/i.test(mots[0] ?? '')) { protocole = proto; mots.shift(); }

  const prendreCible = (): Cible | null => {
    const m = mots.shift();
    if (m === undefined) return null;
    if (/^any$/i.test(m)) return { genre: 'any' };
    if (/^host$/i.test(m)) { const ip = mots.shift(); return ip && estIp(ip) ? { genre: 'host', ip } : null; }
    if (!estIp(m)) return null;
    // Une adresse suivie d'un wildcard : le second mot n'est pris que s'il en
    // est un. Sinon il appartient déjà à la suite de la règle.
    if (mots[0] && estIp(mots[0]) && cidrDeWildcard(mots[0]) !== null) {
      const c = cidrDeWildcard(mots.shift()!)!;
      return c === 32 ? { genre: 'host', ip: m } : { genre: 'reseau', ip: m, cidr: c };
    }
    return { genre: 'host', ip: m };
  };

  const prendrePort = (): Port | undefined => {
    if (!mots.length) return undefined;
    if (!/^(eq|neq|gt|lt|range)$/i.test(mots[0])) return undefined;
    const op = mots.shift()!.toLowerCase() as Operateur;
    if (op === 'range') {
      const a = numeroDePort(mots.shift() ?? ''); const b = numeroDePort(mots.shift() ?? '');
      return a === null || b === null ? undefined : { operateur: 'range', valeur: a, fin: b };
    }
    const n = numeroDePort(mots.shift() ?? '');
    return n === null ? undefined : { operateur: op, valeur: n };
  };

  const source = prendreCible();
  if (!source) return { erreur: 'source illisible' };
  const portSource = prendrePort();
  const destination = protocole === 'ip' && !mots.length ? { genre: 'any' as const } : prendreCible();
  if (!destination) return { erreur: 'destination illisible' };
  const portDestination = prendrePort();
  const messageIcmp = protocole === 'icmp' && mots.length ? mots.shift() : undefined;

  return { ace: { id: '', autorisation, protocole, source, portSource, destination, portDestination, messageIcmp } };
}

// ── l'analyse complète ────────────────────────────────────────────────────

/**
 * Lit un collage de tableur, un CSV ou des lignes de configuration.
 *
 * Rend une ligne de résultat par ligne d'entrée, dans l'ordre : c'est ce qui
 * permet à l'interface de montrer ce qui a été compris avant d'ajouter quoi que
 * ce soit.
 */
export function analyserColler(texte: string): Import {
  const brutes = texte.split(/\r?\n/).map(l => l.trimEnd()).filter(l => l.trim().length > 0);
  if (!brutes.length) return { lignes: [], separateur: 'cli', entete: false };

  const separateur = separateurDe(brutes);
  const lignes: LigneImportee[] = [];

  if (separateur === 'cli') {
    brutes.forEach((brut, i) => {
      const { ace, erreur } = lireLigneCli(brut);
      if (!ace && !erreur) return;                    // commentaire, remark, ligne vide
      lignes.push({ numero: i + 1, brut, ace, erreur });
    });
    return { lignes, separateur, entete: false };
  }

  const cellulesDe = (l: string) => l.split(separateur).map(c => c.trim().replace(/^"(.*)"$/, '$1'));
  const premieres = cellulesDe(brutes[0]);
  const entete = estEntete(premieres);

  let plan: Colonne[];
  if (entete) {
    let vuPort = false;
    plan = premieres.map(t => {
      const c = colonneDe(t, vuPort);
      if (c === 'portSource') vuPort = true;
      return c;
    });
  } else {
    plan = DISPOSITIONS[premieres.length] ?? [];
  }

  brutes.slice(entete ? 1 : 0).forEach((brut, i) => {
    const numero = i + (entete ? 2 : 1);
    const cellules = cellulesDe(brut);
    if (!plan.length) {
      lignes.push({ numero, brut, erreur: `${cellules.length} colonnes : disposition inconnue, ajoute une ligne d’en-tête` });
      return;
    }

    const champ = (c: Colonne): string => {
      const k = plan.indexOf(c);
      return k >= 0 ? (cellules[k] ?? '') : '';
    };

    const autorisation = lireAutorisation(champ('autorisation'));
    if (!autorisation) {
      lignes.push({ numero, brut, erreur: `autorisation illisible : « ${champ('autorisation')} »` });
      return;
    }
    const protocole = lireProtocole(champ('protocole'));
    if (!protocole) {
      lignes.push({ numero, brut, erreur: `protocole inconnu : « ${champ('protocole')} »` });
      return;
    }
    const source = lireCible(champ('source'));
    if (!source) {
      lignes.push({ numero, brut, erreur: `source illisible : « ${champ('source')} »` });
      return;
    }
    const destination = lireCible(champ('destination'));
    if (!destination) {
      lignes.push({ numero, brut, erreur: `destination illisible : « ${champ('destination')} »` });
      return;
    }

    // Sur ICMP, la colonne de port porte le message (echo, echo-reply).
    const brutPortDest = champ('portDestination');
    const messageIcmp = protocole === 'icmp' && /echo/i.test(brutPortDest)
      ? brutPortDest.trim().toLowerCase() : undefined;

    const portSource = protocole === 'tcp' || protocole === 'udp' ? lirePort(champ('portSource')) : { operateur: '' as const };
    const portDestination = messageIcmp ? { operateur: '' as const }
      : (protocole === 'tcp' || protocole === 'udp' ? lirePort(brutPortDest) : { operateur: '' as const });
    if (!portSource) { lignes.push({ numero, brut, erreur: `port source illisible : « ${champ('portSource')} »` }); return; }
    if (!portDestination) { lignes.push({ numero, brut, erreur: `port destination illisible : « ${brutPortDest} »` }); return; }

    lignes.push({
      numero, brut,
      ace: {
        id: '', autorisation, protocole, source, destination,
        portSource, portDestination, messageIcmp,
        remarque: champ('commentaire') || undefined,
      },
    });
  });

  return { lignes, separateur, entete };
}

/** Le modèle de tableau à remplir, prêt à coller dans un tableur. */
export const MODELE_COLLER = [
  'Autorisation\tProtocole\tSource\tPort source\tDestination\tPort destination\tCommentaire',
  'permit\ttcp\t192.168.1.0 0.0.0.255\tgt 1023\thost 172.16.10.20\teq 443\tle site du siege',
  'permit\tudp\t192.168.1.0/24\t\thost 192.168.2.200\teq 53\tresolution de noms',
  'permit\ticmp\t192.168.1.0 0.0.0.255\t\tany\techo\tping sortant',
  'deny\tip\tany\t\thost 172.16.0.1\t\tle reste vers le serveur',
].join('\n');

/**
 * Où placer l'ACL, et pourquoi.
 *
 * La règle tient en une phrase et se demande à l'oral : une standard ne connaît
 * que la source, la placer tôt couperait des flux légitimes vers d'autres
 * destinations ; une étendue sait exactement ce qu'elle bloque, autant le faire
 * avant de traverser le réseau.
 */
export function placement(type: TypeAcl): string {
  return type === 'standard'
    ? 'ACL standard : au plus près de la DESTINATION. Elle ne connaît que la source — posée trop tôt, elle couperait aussi les flux légitimes de cette source vers ailleurs.'
    : 'ACL étendue : au plus près de la SOURCE. Elle sait exactement quoi bloquer, autant le faire avant que le paquet ne traverse le réseau.';
}

// ────────────────────────────────────────── politique de flux → ACL ───

/*
 * DÉCLARER LES FLUX, PAS LES RÈGLES.
 *
 * Écrire une ACL à la main demande de tenir six choses en tête à la fois : le
 * wildcard, le sens, l'interface, l'ordre, le deny implicite et le placement.
 * Une politique de flux n'en demande qu'une : « qui a le droit de joindre quel
 * service ». C'est la forme d'une matrice de flux — celle qu'on remet au client
 * — et c'est aussi celle qu'on sait défendre à l'oral.
 *
 * Le générateur fait le reste, et il le fait toujours de la même façon :
 *   • une ACL étendue par zone source, appliquée EN ENTRÉE sur l'interface qui
 *     fait face à cette zone — au plus près de la source, comme le veut la
 *     règle de placement ;
 *   • les refus avant les autorisations, parce qu'un refus est une exception
 *     découpée dans une autorisation plus large ;
 *   • le deny implicite laissé faire en liste blanche, neutralisé par un
 *     `permit ip any any` en liste noire.
 *
 * CE QU'IL NE FAIT PAS, ET C'EST VOLONTAIRE.
 * Il ne filtre pas le retour. Une ACL est sans état : la réponse revient par
 * une autre interface, dans l'autre sens, et n'est pas vue par l'ACL d'entrée.
 * Poser une seconde ACL en sortie « pour faire propre » casse la moitié des
 * échanges — c'est le piège classique, et le générateur s'en garde.
 */

/** Une zone d'où part du trafic : un réseau, et la porte par laquelle il entre. */
export interface ZoneSource {
  id: string;
  nom: string;
  cible: Cible;
  routeurId: string;
  routeurNom: string;
  /** L'interface du routeur qui fait face à cette zone. */
  interfaceNom: string;
  /** Les postes y reçoivent leur adresse par DHCP. */
  dhcp?: boolean;
}

/** Une destination joignable : un réseau, une machine, ou l'extérieur. */
export interface ZoneCible {
  id: string;
  nom: string;
  cible: Cible;
}

/** Un service autorisé ou refusé, désigné par une clef stable. */
export interface ServiceFlux {
  /** `tcp:443`, `udp:53`, `icmp:echo`, `ip:` pour tout. */
  cle: string;
  nom: string;
}

/** Les services proposables dans une politique, dans l'ordre où on les cherche. */
export const SERVICES_FLUX: readonly ServiceFlux[] = [
  { cle: 'ip:', nom: 'Tout le trafic IP' },
  ...SERVICES.map(s => ({ cle: `${s.proto}:${s.port}`, nom: `${s.nom} (${s.proto} ${s.port})` })),
  { cle: 'icmp:echo', nom: 'Ping — demande (echo)' },
  { cle: 'icmp:echo-reply', nom: 'Ping — réponse (echo-reply)' },
  { cle: 'icmp:', nom: 'ICMP — tous les messages' },
] as const;

/** Une ligne de la matrice : d'où, vers où, pour quoi, autorisé ou non. */
export interface Flux {
  id: string;
  sourceId: string;
  destinationId: string;
  /** Les clefs de `SERVICES_FLUX`. */
  services: string[];
  decision: 'permit' | 'deny';
  commentaire?: string;
}

export interface OptionsPolitique {
  /**
   * `liste-blanche` : seul ce qui est déclaré passe, le reste tombe sur le deny
   * implicite. C'est la politique de refus par défaut, celle qu'on écrit dans
   * une matrice de flux.
   * `liste-noire` : tout passe sauf ce qui est refusé.
   */
  mode: 'liste-blanche' | 'liste-noire';
  /** Laisser passer le DHCP depuis les zones qui en dépendent. */
  dhcp: boolean;
  /** Laisser passer les requêtes DNS vers ce serveur. Vide = pas de règle. */
  dns: string;
  /** Laisser passer le ping sortant — pratique pour les tests de recette. */
  ping: boolean;
  /** Nommer les ACL au lieu de les numéroter. */
  nommer: boolean;
}

export const OPTIONS_PAR_DEFAUT: OptionsPolitique = {
  mode: 'liste-blanche', dhcp: true, dns: '', ping: true, nommer: false,
};

/** Une ACL produite par le générateur, avec la raison de sa place. */
export interface AclGeneree extends Acl {
  routeurId: string;
  /** Pourquoi elle est là, à dire à l'oral. */
  pourquoi: string;
  /** Marque la production automatique : la régénération ne touche que celles-ci. */
  genere: true;
}

/** L'ACE correspondant à un service, entre deux cibles. */
function aceDeService(
  cle: string, source: Cible, destination: Cible,
  decision: 'permit' | 'deny', remarque: string | undefined, n: number,
): Ace {
  const [proto, valeur] = cle.split(':');
  const base = {
    id: `gen${n}`, autorisation: decision, source, destination, remarque,
  };
  if (proto === 'ip' || !proto) return { ...base, protocole: 'ip' };
  if (proto === 'icmp') {
    return { ...base, protocole: 'icmp', messageIcmp: valeur || undefined };
  }
  return {
    ...base,
    protocole: proto === 'udp' ? 'udp' : 'tcp',
    portDestination: valeur ? { operateur: 'eq', valeur: Number(valeur) } : { operateur: '' },
  };
}

/**
 * Traduit une politique de flux en ACL posées sur les bonnes interfaces.
 *
 * Une ACL par zone source qui porte au moins un flux. Les zones sans flux n'en
 * reçoivent aucune : en liste blanche, leur poser une ACL vide couperait tout
 * leur trafic — le genre de zèle qui fait perdre une recette.
 */
export function genererAcls(
  sources: readonly ZoneSource[],
  cibles: readonly ZoneCible[],
  flux: readonly Flux[],
  options: OptionsPolitique,
  numerosPris: readonly string[] = [],
): { acls: AclGeneree[]; avertissements: Avertissement[] } {
  const acls: AclGeneree[] = [];
  const avertissements: Avertissement[] = [];
  const pris = [...numerosPris];
  let compteur = 0;

  const cibleDe = (id: string): Cible | null => {
    if (id === 'any' || !id) return { genre: 'any' };
    return cibles.find(c => c.id === id)?.cible ?? null;
  };

  for (const zone of sources) {
    const siens = flux.filter(f => f.sourceId === zone.id);
    if (!siens.length) continue;

    const aces: Ace[] = [];

    /*
     * Les services d'infrastructure passent en premier, et sans qu'on les
     * déclare.
     *
     * Une liste blanche posée en entrée d'un LAN coupe le DHCP et le DNS avant
     * toute autre chose : les postes ne s'adressent plus, plus rien ne résout,
     * et le TP s'arrête sur un symptôme qui n'a rien à voir avec la politique
     * écrite. Ces règles sont donc ajoutées d'office — et commentées, pour
     * qu'on sache qu'elles ne viennent pas de la matrice.
     */
    if (options.mode === 'liste-blanche') {
      if (options.dhcp && zone.dhcp) {
        aces.push(aceDeService('udp:67', zone.cible, { genre: 'any' }, 'permit',
          'infrastructure : DHCP, sans quoi les postes ne s’adressent plus', compteur += 1));
      }
      if (options.dns.trim()) {
        for (const p of ['udp:53', 'tcp:53']) {
          aces.push(aceDeService(p, zone.cible, { genre: 'host', ip: options.dns.trim() }, 'permit',
            p === 'udp:53' ? 'infrastructure : résolution de noms' : undefined, compteur += 1));
        }
      }
      if (options.ping) {
        aces.push(aceDeService('icmp:echo', zone.cible, { genre: 'any' }, 'permit',
          'tests de recette : ping sortant', compteur += 1));
      }
    }

    /*
     * Les refus avant les autorisations.
     *
     * Un refus est presque toujours une exception découpée dans une
     * autorisation plus large — « tout le web, sauf ce serveur ». Placé après,
     * il ne serait jamais lu : la lecture s'arrête à la première règle qui
     * correspond.
     */
    const ordonnes = [...siens].sort((a, b) => (a.decision === b.decision ? 0 : a.decision === 'deny' ? -1 : 1));

    for (const f of ordonnes) {
      const dest = cibleDe(f.destinationId);
      if (!dest) {
        avertissements.push({ gravite: 'erreur', texte: `Flux « ${zone.nom} » : destination inconnue.` });
        continue;
      }
      if (!f.services.length) {
        avertissements.push({ gravite: 'attention', texte: `Flux « ${zone.nom} » : aucun service coché, la ligne est ignorée.` });
        continue;
      }
      const nomDest = cibles.find(c => c.id === f.destinationId)?.nom ?? 'tout';
      for (const [k, cle] of f.services.entries()) {
        aces.push(aceDeService(cle, zone.cible, dest, f.decision,
          k === 0 ? (f.commentaire || `${zone.nom} → ${nomDest}`) : undefined, compteur += 1));
      }
    }

    const nom = options.nommer
      ? `FILTRE-${zone.nom.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '')}`
      : numeroLibre('etendue', pris);
    pris.push(nom);

    acls.push({
      id: `gen-${zone.id}`,
      nom, type: 'etendue', aces,
      permitFinal: options.mode === 'liste-noire',
      applications: [{ interface: zone.interfaceNom, sens: 'in' }],
      routeurId: zone.routeurId,
      pourquoi: `Étendue, donc au plus près de la source : posée en entrée sur ${zone.interfaceNom} de ${zone.routeurNom}, l’interface qui fait face à ${zone.nom}.`,
      genere: true,
    });
  }

  /*
   * Une zone qui n'apparaît nulle part dans la matrice n'est pas un oubli
   * bénin : en liste blanche, tout son trafic passera sans contrôle. On le dit,
   * sans rien générer — poser une ACL vide la couperait entièrement.
   */
  if (options.mode === 'liste-blanche') {
    for (const z of sources) {
      if (!flux.some(f => f.sourceId === z.id)) {
        avertissements.push({
          gravite: 'attention',
          texte: `${z.nom} n’a aucun flux déclaré : aucune ACL n’y est posée, son trafic n’est donc pas filtré.`,
        });
      }
    }
  }

  if (options.mode === 'liste-blanche' && !options.dns.trim()) {
    avertissements.push({
      gravite: 'attention',
      texte: 'Aucun serveur DNS indiqué : en liste blanche, la résolution de noms tombera sauf si un flux la déclare.',
    });
  }

  return { acls, avertissements };
}

/** Les commandes de vérification, celles qu'on tape après avoir collé. */
export const VERIFICATIONS = [
  'show access-lists            ! les règles, et le compteur de correspondances',
  'show ip interface Gig0/0     ! quelle ACL est appliquée, dans quel sens',
  'show running-config | section access-list',
].join('\n');

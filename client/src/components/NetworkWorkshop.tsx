import { Fragment, useEffect, useMemo, useState, type CSSProperties, useRef} from 'react';
import { PictoMateriel, SchemaAtelier, type EtatSchema, type InterfaceSchema } from './SchemaAtelier';

/**
 * Atelier Réseau & Packet Tracer — assistant multi-étapes à contexte partagé.
 * Îlot React hydraté via RichContent (data-block="network-workshop").
 *
 * Étapes : 1) Contexte  2) Préférences  3) Segmentation (multi-routeurs + attribution
 * automatique des interfaces)  4) Schéma  5) Pools DHCP  6) DNS.
 * Le contexte est persisté dans le navigateur (localStorage) et partagé entre les étapes.
 *
 * NB : les étapes 4-6 sont en cours de construction (placeholders) — le moteur de calcul
 * (computePlan) est déjà central pour les alimenter ensuite.
 */

// ─────────────────────────────────────────── Helpers IP ───────────────────────────────────────────
const ipToStr = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
import {
  configAcces, configMls, dossier as dossierMls, verifications as verifsMls,
  PANNES as PANNES_MLS, NATIF_PAR_DEFAUT, PORTS_PAR_DEFAUT,
  configSortieMls, configPareFeu, tableNat, PANNES_INTERNET,
  etendues, configDhcpSurMls, configResolution, verificationsClient, PANNES_CLIENT,
  type AccesClients,
  PREFIXE_3560, PREFIXE_EMPILE, chevauchements, configRouteurExterne, ficheSite,
  vlansDe, accesDe, enfantsDe, verifierMulticouches, type Multicouche,
  affectations, verifierPorts, PORTS_ACCES, PORTS_PAR_DEFAUT as PORTS_DEF, type AffectationPort,
  analyserPlage, ecrirePlage,
  type AccessSwitch, type MlsPlan, type SortieInternet, type ReseauExterne,
  sortieEffective, verifierSortie, type SegmentSortie,
} from '@/lib/mls';
import {
  cableAttendu, portsLibres, verifierCablage, cheminPhysique, voisinsDe, remontees,
  COUCHE_DE, PORTS_TYPIQUES, type Cable, type Materiel, type Media, type TypeMateriel,
} from '@/lib/physique';
import {
  SERVICES, MESSAGES_ICMP, VERIFICATIONS as VERIFICATIONS_ACL,
  ecrireAcl, verifier as verifierAcl, ombres as ombresAcl, placement as placementAcl,
  numeroLibre, wildcard as wildcardTexte, analyserColler, ecrireAce, MODELE_COLLER,
  genererAcls, SERVICES_FLUX, OPTIONS_PAR_DEFAUT as OPTIONS_ACL,
  type ZoneSource, type ZoneCible, type Flux as FluxAcl, type OptionsPolitique,
  type Acl, type Ace, type Cible, type Port, type TypeAcl, type Transport,
} from '@/lib/acl';
import { OuvrirDansPlan } from './OuvrirDansPlan';

function strToIp(s: string): number | null {
  if (typeof s !== 'string') return null;
  const m = s.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const o = m.slice(1, 5).map(Number);
  if (o.some(x => x > 255)) return null;
  return (((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0);
}
const maskFromCidr = (c: number) => (c === 0 ? 0 : (0xFFFFFFFF << (32 - c)) >>> 0);
const wildcardFromCidr = (c: number) => (~maskFromCidr(c)) >>> 0;
const hostBitsFor = (need: number) => { let n = 1; while (Math.pow(2, n) - 2 < Math.max(1, need)) n++; return n; };
const clampNum = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ─────────────────────────────────────────── Modèle (contexte) ───────────────────────────────────────────
export type RouterModel = '2811' | '2911';
export type LinkMedia = 'serial' | 'gig';

// Un réseau de base à découper (on peut en avoir plusieurs, distincts).
export type BaseNet = { id: string; name: string; ip: string; cidr: string };
// Un sous-réseau : 1 routeur = LAN (passerelle), 2+ routeurs = segment d'interconnexion. baseId = bloc d'adresses.
// `vlan` : identifiant 802.1Q (1-4094). Vide = pas de VLAN, le sous-reseau prend
// une interface physique a lui, comme avant.
export type Service = {
  id: string; name: string; hosts: string; routerIds: string[]; hasSwitch: boolean; dhcp: boolean;
  media?: LinkMedia; baseId?: string; vlan?: string;
  /**
   * Le multicouche qui porte la SVI de ce sous-reseau. Vide = c'est un routeur.
   *
   * Une passerelle et une seule : declarer les deux serait declarer deux
   * passerelles pour un meme reseau. La selection est donc exclusive.
   */
  svi?: string;
};

/** VLAN ID valide d'un service, ou null. Hors de 1-4094 = pas de VLAN. */
export function vlanOf(s: { vlan?: string }): number | null {
  const n = Number(String(s.vlan ?? '').trim());
  return Number.isInteger(n) && n >= 1 && n <= 4094 ? n : null;
}
export type RouterDef = { id: string; name: string; model: RouterModel; mod?: boolean };

/**
 * Ce qu'une couche haute sait d'un equipement, et que la couche 1 ignore.
 *
 * L'identite — nom, type, modele, nombre de ports — vit dans l'inventaire, et
 * les liens dans le cablage. Ne restent ici que les attributs propres a la
 * couche : le module d'un routeur, les VLAN d'un switch.
 */
export type OptRouteur = { mod?: boolean };
export type OptMls = { prefixe: string; vlans: number[] };
export type OptSwitch = { vlans: number[]; ports_?: AffectationPort[] };

export type Ctx = {
  // 1. Contexte
  entreprise: string; domaine: string; mode: 'neuf' | 'extension';
  baseIp: string; baseCidr: string;             // rétro-compat (migré vers bases[0])
  bases: BaseNet[];                              // un ou plusieurs réseaux de base distincts
  services: Service[];
  // 3. Topologie
  // (les routeurs, multicouches et switches vivent dans `materiels` — cf. optRouteurs)
  // 2. Préférences
  login: string; mdp: string; secret: string;
  gwPos: 'last' | 'first';                 // position IP passerelle (routeur) dans le sous-réseau
  switchPos: 'beforeRouter' | 'firstHost'; // position IP de gestion du switch
  linkCidr: string;                        // masque des liaisons inter-routeurs (/30 par défaut)
  dnsServer: string;
  dhcpServer: string;                      // IP du serveur DHCP (relais ip helper-address)
  leaseDays: string;                       // durée du bail DHCP (jours)
  // Sortie Internet (NAT/PAT) — optionnel
  internetRouterId: string;                // routeur de bordure ('' = pas de NAT)
  wanIf: string;                           // interface WAN (vers le FAI)
  wanIp: string; wanCidr: string;          // adresse WAN
  faiGw: string;                           // passerelle du FAI / de la salle
  webIp: string; webPort: string;          // serveur web à publier (facultatif)
  natOverload: boolean;                     // générer le PAT (overload) — décocher pour du NAT statique seul
  natStatics: { inside: string; pub: string }[]; // NAT statique 1:1 : IP interne -> IP publique
  // Adressage manuel (facultatif — sinon calcul automatique)
  // Switch multicouche (SVI) : le routage inter-VLAN porte par un switch L3
  // plutot que par un routeur. Optionnel — sans lui, rien ne change.
  mlsActif: boolean;
  /** Ce que les couches hautes ajoutent a l'inventaire, par id de materiel. */
  optRouteurs: Record<string, OptRouteur>;
  optMls: Record<string, OptMls>;
  optSwitches: Record<string, OptSwitch>;
  /** La sortie Internet du multicouche : pare-feu, NAT surcharge. '' = aucune. */
  mlsSortie: SortieInternet | null;
  /** Le site que les postes doivent joindre (celui de l'exemple du TP). */
  mlsSite: { nom: string; ip: string } | null;
  /** Le reseau externe simule : le routeur d'en face et le site. */
  mlsExterne: ReseauExterne | null;
  /** Positions choisies a la main dans le schema. Absent = place tout seul. */
  mlsPos: Record<string, { x: number; y: number }>;
  /** Couche 1 : l'inventaire et le cablage, poses avant toute adresse. */
  materiels: Materiel[];
  cables: Cable[];
  /** Positions choisies a la main dans le schema physique. Absent = par etage. */
  physPos: Record<string, { x: number; y: number }>;
  ifaceIps: Record<string, string>;         // IP forcée d'une interface routeur, clé `${routerId}|${iface}`
  /**
   * Interfaces routeur en client DHCP (`ip address dhcp`), clé `${routerId}|${iface}`.
   * L'adresse vient d'un serveur DHCP **hors routeur** (le FAI, un serveur de la
   * salle) — le port ne fixe rien lui-même.
   */
  ifaceDhcp: Record<string, boolean>;
  hosts: StaticHost[];                       // end-points à IP fixe (serveurs, postes)
  /**
   * Le mode d'adressage de chaque poste, par id de materiel : fixe (adresse
   * choisie dans un sous-reseau) ou DHCP (adresse recue d'un serveur).
   */
  postesIp: Record<string, { mode: 'fixe' | 'dhcp'; ip?: string; subId?: string }>;
  /**
   * Le filtrage : les ACL, rattachees chacune a un routeur.
   *
   * Elles vivent dans le contexte comme le reste, donc dans le navigateur : une
   * ACL ecrite avant la pause de midi est encore la apres. `routeurId` dit sur
   * quel materiel la coller — sans lui, la configuration generee ne saurait pas
   * quelles interfaces proposer.
   */
  acls: AclAtelier[];
  /**
   * La matrice de flux : qui joint quel service, et l'allure de la politique.
   *
   * C'est la source dont les ACL se deduisent. On la garde a cote d'elles
   * plutot que de ne conserver que le resultat : regenerer apres avoir ajoute
   * un sous-reseau doit rester possible sans tout ressaisir.
   */
  politique: { flux: FluxAcl[]; options: OptionsPolitique };
};

/**
 * Une ACL de l'atelier : la liste de regles, plus le routeur qui la porte.
 *
 * `genere` distingue ce qui vient de la matrice de ce qui a ete ecrit a la
 * main. Sans lui, relancer la generation ferait perdre les corrections — ou en
 * produirait deux exemplaires.
 */
export type AclAtelier = Acl & { routeurId: string; genere?: boolean; pourquoi?: string };
// Un hôte terminal à adresse fixe rattaché à un sous-réseau.
export type StaticHost = { id: string; name: string; subId: string; ip: string };

let _uid = 0;
// Identifiant unique : compteur + suffixe aléatoire → jamais de collision avec un id par défaut
// (ex. la base 'b1') ni entre sessions (le compteur repart de 0 à chaque chargement de page).
const uid = (p: string) => `${p}${++_uid}_${Math.random().toString(36).slice(2, 6)}`;
// Force des id UNIQUES dans une liste (répare les états sauvegardés avec des id en double).
const dedupeIds = <T extends { id: string }>(arr: T[], p: string): T[] => { const seen = new Set<string>(); return arr.map(x => { let id = x.id; if (!id || seen.has(id)) id = uid(p); seen.add(id); return { ...x, id }; }); };

export const DEFAULT_CTX: Ctx = {
  entreprise: 'Miyukini', domaine: 'miyukini.lan', mode: 'neuf',
  baseIp: '192.168.10.0', baseCidr: '24',
  bases: [{ id: 'b1', name: 'Réseau principal', ip: '192.168.10.0', cidr: '24' }],
  services: [
    { id: 'sA', name: 'Production', hosts: '100', routerIds: ['rA'], hasSwitch: true, dhcp: true, baseId: 'b1', vlan: '10' },
    { id: 'sB', name: 'Bureaux', hosts: '50', routerIds: ['rA'], hasSwitch: true, dhcp: true, baseId: 'b1', vlan: '20' },
    { id: 'sC', name: 'Wi-Fi', hosts: '20', routerIds: ['rB'], hasSwitch: true, dhcp: true, baseId: 'b1', vlan: '30' },
    { id: 'sD', name: 'Dorsale R1-R2', hosts: '2', routerIds: ['rA', 'rB'], hasSwitch: true, dhcp: false, media: 'gig', baseId: 'b1' },
  ],
  // (les routeurs vivent dans `materiels` : cf. DEFAULT_CTX_ROUTEURS)
  login: 'admin', mdp: 'Azerty77', secret: 'MonSecretEnable',
  gwPos: 'last', switchPos: 'beforeRouter', linkCidr: '30', dnsServer: '192.168.10.11', dhcpServer: '192.168.10.11', leaseDays: '7',
  internetRouterId: '', wanIf: 'GigabitEthernet0/1', wanIp: '', wanCidr: '30', faiGw: '', webIp: '', webPort: '80',
  natOverload: true, natStatics: [],
  mlsActif: false, mlsSortie: null, mlsSite: null, mlsExterne: null, mlsPos: {},
  materiels: [
    { id: 'm1', nom: 'MLS-Core', type: 'multicouche', modele: '3560', ports: 24 },
    { id: 'rA', nom: 'R1', type: 'routeur', modele: '2911', ports: 4 },
    { id: 'rB', nom: 'R2', type: 'routeur', modele: '2811', ports: 4 },
  ],
  cables: [], physPos: {}, acls: [], politique: { flux: [], options: OPTIONS_ACL },
  optRouteurs: {}, optMls: { m1: { prefixe: 'FastEthernet0/', vlans: [] } }, optSwitches: {},
  ifaceIps: {}, ifaceDhcp: {}, hosts: [], postesIp: {},
};

/* ── Les projections : une couche haute lit l'inventaire ───────────────────
   Elles remplacent `routeursDe(ctx)`, `multicouchesDe(ctx)` et `switchesDe(ctx)`, qui
   tenaient une seconde liste des memes equipements. Un ajout en couche 1 se
   voit donc partout, et un cable tire remplace trois champs a saisir. */

const MODELES_ROUTEUR: RouterModel[] = ['2911', '2811'];

/**
 * La couleur d'un VLAN, la meme dans tout l'outil.
 *
 * Le schema du multicouche avait la sienne dans son coin : un VLAN change de
 * couleur en changeant d'ecran, et on ne peut plus suivre le meme du regard.
 */
export const COULEURS_VLAN = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#10b981', '#0ea5e9'];
export function couleurVlan(id: number, tous: number[]): string {
  const i = tous.indexOf(id);
  return COULEURS_VLAN[(i < 0 ? id : i) % COULEURS_VLAN.length]!;
}

export function routeursDe(ctx: Ctx): RouterDef[] {
  return ctx.materiels.filter(m => m.type === 'routeur').map(m => ({
    id: m.id, name: m.nom,
    model: (MODELES_ROUTEUR as string[]).includes(m.modele) ? (m.modele as RouterModel) : '2911',
    mod: ctx.optRouteurs[m.id]?.mod,
  }));
}

export function multicouchesDe(ctx: Ctx): Multicouche[] {
  return ctx.materiels.filter(m => m.type === 'multicouche').map(m => ({
    id: m.id, nom: m.nom,
    prefixe: ctx.optMls[m.id]?.prefixe ?? PREFIXE_3560,
    vlans: ctx.optMls[m.id]?.vlans ?? [],
  }));
}

/**
 * Les switches d'acces, avec leur remontee lue dans le cablage.
 *
 * Un switch qu'aucun cable ne relie au coeur garde `mlsId` vide : c'est la
 * situation que `verifierMulticouches` signale deja — un switch rattache a
 * rien — plutot qu'une remontee inventee qui masquerait le debranchement.
 */
export function switchesDe(ctx: Ctx): AccessSwitch[] {
  const commutation = ctx.materiels.filter(m => m.type === 'switch' || m.type === 'multicouche');
  const racines = commutation.filter(m => m.type === 'multicouche').map(m => m.id);
  const arbre = new Map(remontees(ctx.cables, racines, commutation.map(m => m.id)).map(x => [x.id, x]));
  return ctx.materiels.filter(m => m.type === 'switch').map(m => {
    const haut = arbre.get(m.id);
    return {
      id: m.id, name: m.nom, ports: m.ports,
      vlans: ctx.optSwitches[m.id]?.vlans ?? [],
      ports_: ctx.optSwitches[m.id]?.ports_,
      uplink: haut?.monPort ?? 0,
      portMls: haut?.sonPort ?? 0,
      mlsId: haut?.parentId ?? '',
    };
  });
}

// Normalise un contexte issu du localStorage (tolère les anciens formats :
// services {routerId} → {routerIds}, et anciens links → sous-réseaux d'interconnexion).
/** Les routeurs d'un projet neuf — les memes que ceux de DEFAULT_CTX. */
const DEFAULT_CTX_ROUTEURS = [{ id: 'rA', name: 'R1', model: '2911' }, { id: 'rB', name: 'R2', model: '2811' }];

export function migrateCtx(raw: unknown): Ctx {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const c = { ...DEFAULT_CTX, ...r } as Ctx;
  delete (c as any).links;
  /* L'inventaire absorbe les trois anciennes listes.
     Elles decrivaient les memes equipements que `materiels`, chacune de son
     cote ; on les y verse une fois, avec leurs cables d'uplink, puis elles
     disparaissent. Un projet enregistre avant ce changement s'ouvre donc avec
     son materiel deja pose et deja cable. */
  // On repart de ce qui est enregistre, jamais des objets de DEFAULT_CTX :
  // `{ ...DEFAULT_CTX, ...r }` en copie les references, et tout `push` ici
  // allongerait le contexte par defaut pour tous les projets suivants.
  // Un contexte déjà migré porte un tableau `materiels` (même vide) et n'a plus
  // ses anciennes listes `routers`/`mlsMulticouches`. Ne semer les défauts que
  // pour un contexte hérité : sinon, un R1/R2 (ou MLS-Core) supprimé revient à
  // chaque rechargement, l'absence de la clé étant prise pour « projet neuf ».
  const herite = !Array.isArray(r.materiels);
  c.materiels = Array.isArray(r.materiels) ? [...r.materiels] : [];
  c.cables = Array.isArray(r.cables) ? [...r.cables] : [];
  // Comme `materiels` : on repart du tableau enregistre, jamais de celui de
  // DEFAULT_CTX, dont la reference serait partagee par tous les projets.
  c.acls = Array.isArray(r.acls) ? [...r.acls] : [];
  c.politique = {
    flux: Array.isArray(r.politique?.flux) ? [...r.politique.flux] : [],
    options: { ...OPTIONS_ACL, ...(r.politique?.options ?? {}) },
  };
  c.optRouteurs = (r.optRouteurs && typeof r.optRouteurs === 'object') ? { ...r.optRouteurs } : {};
  c.optMls = (r.optMls && typeof r.optMls === 'object') ? { ...r.optMls } : {};
  c.optSwitches = (r.optSwitches && typeof r.optSwitches === 'object') ? { ...r.optSwitches } : {};
  const connus = new Set(c.materiels.map((m: Materiel) => m?.id));
  const poser = (m: Materiel) => { if (m.id && !connus.has(m.id)) { connus.add(m.id); c.materiels.push(m); } };

  for (const rt of (Array.isArray(r.routers) ? r.routers : (herite ? DEFAULT_CTX_ROUTEURS : []))) {
    if (typeof rt?.id !== 'string') continue;
    const modele = rt?.model === '2811' ? '2811' : '2911';
    poser({ id: rt.id, nom: String(rt?.name ?? 'R'), type: 'routeur', modele, ports: 4 });
    if (rt?.mod) c.optRouteurs[rt.id] = { mod: true };
  }
  const anciensMls = (Array.isArray(r.mlsMulticouches) && r.mlsMulticouches.length)
    ? r.mlsMulticouches
    : (herite ? [{ id: 'm1', nom: typeof (r as { mlsNom?: string }).mlsNom === 'string' ? (r as { mlsNom?: string }).mlsNom : 'MLS-Core', prefixe: 'FastEthernet0/', vlans: [] }] : []);
  for (const m of anciensMls) {
    if (typeof m?.id !== 'string') continue;
    poser({ id: m.id, nom: String(m?.nom ?? 'MLS'), type: 'multicouche', modele: '3560', ports: 24 });
    c.optMls[m.id] = { prefixe: String(m?.prefixe ?? PREFIXE_3560), vlans: Array.isArray(m?.vlans) ? m.vlans : [] };
  }
  // Un contexte hérité qui portait des switches d'accès a besoin d'une racine :
  // sans multicouche, ils se rattacheraient à rien. On n'en fabrique une que
  // dans ce cas — un projet migré dont on a sciemment supprimé le multicouche
  // doit le rester.
  const mlsAcces = Array.isArray(r.mlsAcces) ? r.mlsAcces : [];
  if (herite && mlsAcces.length && !c.materiels.some((m: Materiel) => m.type === 'multicouche')) {
    poser({ id: 'm1', nom: 'MLS-Core', type: 'multicouche', modele: '3560', ports: 24 });
    c.optMls.m1 = { prefixe: PREFIXE_3560, vlans: [] };
  }
  const premierMls = c.materiels.find((m: Materiel) => m.type === 'multicouche')?.id;
  for (const sw of mlsAcces) {
    if (typeof sw?.id !== 'string') continue;
    // Un projet enregistre declarait 24 ports : c'etait le compte des ports
    // d'acces. Le materiel en a deux de plus, les Gigabit du haut.
    const declares = Number(sw?.ports) > 0 ? Number(sw.ports) : PORTS_ACCES;
    const ports = declares <= PORTS_ACCES ? PORTS_PAR_DEFAUT : declares;
    poser({ id: sw.id, nom: String(sw?.name ?? 'Sw'), type: 'switch', modele: '2960', ports });
    c.optSwitches[sw.id] = { vlans: Array.isArray(sw?.vlans) ? sw.vlans : [], ports_: Array.isArray(sw?.ports_) ? sw.ports_ : undefined };
    // La remontee devient un cable : c'est le meme lien, dit en couche 1.
    const vers = typeof sw?.mlsId === 'string' && sw.mlsId ? sw.mlsId : premierMls;
    if (!vers) continue;
    const mien = Number(sw?.uplink) > 0 ? Number(sw.uplink) : ports;
    const sien = Number(sw?.portMls) > 0 ? Number(sw.portMls) : 1;
    if (!c.cables.some((x: Cable) => x?.deId === vers && x?.versId === sw.id)) {
      c.cables.push({ id: 'up' + sw.id, deId: vers, dePort: sien, versId: sw.id, versPort: mien, media: 'croise' });
    }
  }
  delete (c as any).routers;
  delete (c as any).mlsMulticouches;
  delete (c as any).mlsAcces;
  c.natStatics = Array.isArray((c as any).natStatics) ? (c as any).natStatics.filter((s: any) => s && typeof s === 'object').map((s: any) => ({ inside: String(s.inside ?? ''), pub: String(s.pub ?? '') })) : [];
  c.natOverload = typeof (c as any).natOverload === 'boolean' ? (c as any).natOverload : true;
  c.ifaceIps = (r.ifaceIps && typeof r.ifaceIps === 'object' && !Array.isArray(r.ifaceIps))
    ? Object.fromEntries(Object.entries(r.ifaceIps).filter(([k, v]) => typeof k === 'string' && typeof v === 'string')) as Record<string, string>
    : {};
  c.hosts = dedupeIds((Array.isArray(r.hosts) ? r.hosts : []).filter((h: any) => h && typeof h === 'object').map((h: any) => ({ id: typeof h.id === 'string' ? h.id : uid('h'), name: String(h.name ?? ''), subId: String(h.subId ?? ''), ip: String(h.ip ?? '') })), 'h');
  c.ifaceDhcp = (r.ifaceDhcp && typeof r.ifaceDhcp === 'object' && !Array.isArray(r.ifaceDhcp))
    ? Object.fromEntries(Object.entries(r.ifaceDhcp).filter(([k, v]) => typeof k === 'string' && v === true)) as Record<string, boolean>
    : {};
  c.postesIp = (r.postesIp && typeof r.postesIp === 'object' && !Array.isArray(r.postesIp))
    ? Object.fromEntries(Object.entries(r.postesIp as Record<string, any>)
        .filter(([k, v]) => typeof k === 'string' && v && typeof v === 'object')
        .map(([k, v]) => [k, { mode: v.mode === 'fixe' ? 'fixe' : 'dhcp', ip: typeof v.ip === 'string' ? v.ip : undefined, subId: typeof v.subId === 'string' ? v.subId : undefined }]))
    : {};
  // Réseaux de base : depuis bases[] si présent, sinon depuis l'ancien baseIp/baseCidr.
  c.bases = (Array.isArray(r.bases) && r.bases.length ? r.bases : [{ id: 'b1', name: 'Réseau principal', ip: (typeof r.baseIp === 'string' && r.baseIp) || DEFAULT_CTX.baseIp, cidr: String(r.baseCidr ?? DEFAULT_CTX.baseCidr) }])
    .map((b: any, i: number) => ({ id: typeof b?.id === 'string' ? b.id : 'b' + (i + 1), name: typeof b?.name === 'string' ? b.name : `Réseau ${i + 1}`, ip: typeof b?.ip === 'string' ? b.ip : '192.168.10.0', cidr: String(b?.cidr ?? '24') }));
  c.bases = dedupeIds(c.bases, 'b');
  const baseIds = new Set(c.bases.map(b => b.id));
  const firstBase = c.bases[0].id;
  c.services = (Array.isArray(r.services) ? r.services : []).map((s: any) => ({
    id: typeof s?.id === 'string' ? s.id : uid('s'),
    name: typeof s?.name === 'string' ? s.name : 'Sous-réseau',
    hosts: String(s?.hosts ?? '10'),
    routerIds: Array.isArray(s?.routerIds) ? s.routerIds.filter((x: any) => typeof x === 'string') : (typeof s?.routerId === 'string' && s.routerId ? [s.routerId] : []),
    hasSwitch: typeof s?.hasSwitch === 'boolean' ? s.hasSwitch : true,
    dhcp: typeof s?.dhcp === 'boolean' ? s.dhcp : true,
    media: s?.media === 'serial' ? ('serial' as LinkMedia) : undefined,
    baseId: (typeof s?.baseId === 'string' && baseIds.has(s.baseId)) ? s.baseId : firstBase,
    // Absent des projets enregistres avant les VLAN : on laisse vide, le
    // sous-reseau garde alors son interface physique dediee.
    vlan: typeof s?.vlan === 'string' || typeof s?.vlan === 'number' ? String(s.vlan) : '',
    // Le multicouche porteur de la SVI : sans lui, une interconnexion
    // routeur <-> multicouche redevenait un simple LAN a chaque rechargement.
    svi: typeof s?.svi === 'string' && s.svi ? s.svi : undefined,
  }));
  // Anciens liens inter-routeurs → sous-réseaux d'interconnexion (2+ routeurs).
  for (const l of (Array.isArray(r.links) ? r.links : [])) {
    const rids = (Array.isArray(l?.routerIds) ? l.routerIds : [l?.aId, l?.bId]).filter((x: any) => typeof x === 'string');
    if (rids.length >= 2) c.services.push({ id: typeof l?.id === 'string' ? 'seg' + l.id : uid('s'), name: 'Interconnexion', hosts: '2', routerIds: rids, hasSwitch: typeof l?.hasSwitch === 'boolean' ? l.hasSwitch : true, dhcp: false, media: l?.media === 'serial' ? 'serial' : undefined, baseId: firstBase });
  }
  if (!c.services.length) c.services = DEFAULT_CTX.services;
  c.services = dedupeIds(c.services, 's');
  // Brouillons d'avant le switch multicouche : on pose les defauts plutot que
  // de laisser des champs absents faire tomber le rendu.
  if (typeof c.mlsActif !== 'boolean') c.mlsActif = false;
  if (c.mlsSortie === undefined) c.mlsSortie = null;
  if (c.mlsSite === undefined) c.mlsSite = null;
  if (c.mlsExterne === undefined) c.mlsExterne = null;
  c.mlsPos = (r.mlsPos && typeof r.mlsPos === 'object') ? { ...r.mlsPos } : {};
  c.physPos = (r.physPos && typeof r.physPos === 'object') ? { ...r.physPos } : {};
  c.materiels = dedupeIds(c.materiels as Materiel[], 'mat');
  c.cables = dedupeIds(c.cables as Cable[], 'cab');
  return c;
}

// ─────────────────────────────────────────── Interfaces Cisco ───────────────────────────────────────────
// Interfaces Ethernet intégrées + module d'extension optionnel (slot 1).
// 2811 : Fa0/0, Fa0/1 intégrées → module = Fa1/0, Fa1/1.
// 2911 : Gig0/0..0/2 intégrées → module = Gig0/3/0, Gig0/3/1.
const ethBuiltin = (m: RouterModel): string[] => (m === '2811' ? ['FastEthernet0/0', 'FastEthernet0/1'] : ['GigabitEthernet0/0', 'GigabitEthernet0/1', 'GigabitEthernet0/2']);
const ethModule = (m: RouterModel): string[] => (m === '2811' ? ['FastEthernet1/0', 'FastEthernet1/1'] : ['GigabitEthernet0/3/0', 'GigabitEthernet0/3/1']);
const ethSlots = (m: RouterModel, mod?: boolean): string[] => (mod ? [...ethBuiltin(m), ...ethModule(m)] : ethBuiltin(m));
const ethLabel = (m: RouterModel) => (m === '2811' ? 'FastEthernet' : 'GigabitEthernet');
const SER_SLOTS = ['Serial0/0/0', 'Serial0/0/1', 'Serial0/1/0', 'Serial0/1/1'];
// Abréviation courte pour le schéma : GigabitEthernet0/1 → Gig0/1, FastEthernet0/0 → Fa0/0, Serial0/0/0 → Se0/0/0.
const ifAbbr = (s: string) => s.replace('GigabitEthernet', 'Gig').replace('FastEthernet', 'Fa').replace('Serial', 'Se');
// Le nom d'interface d'un port, façon Cisco — pour l'étiqueter au branchement,
// comme Packet Tracer nomme ses interfaces au moment de relier deux équipements.
function nomPortDe(ctx: Ctx, m: Materiel, p: number): string {
  if (m.type === 'switch' || m.type === 'multicouche') return p > PORTS_ACCES ? `Gig0/${p - PORTS_ACCES}` : `Fa0/${p}`;
  if (m.type === 'routeur') {
    const model = (m.modele === '2811' ? '2811' : '2911') as RouterModel;
    const noms = [...ethSlots(model, ctx.optRouteurs[m.id]?.mod), ...SER_SLOTS];
    return ifAbbr(noms[p - 1] ?? `Port ${p}`);
  }
  if (m.type === 'poste' || m.type === 'serveur') return m.ports > 1 ? `NIC ${p}` : 'NIC';
  return `Port ${p}`;
}

// ─────────────────────────────────────────── Moteur (fonction pure) ───────────────────────────────────────────
export type Sub = {
  kind: 'lan' | 'link'; id: string; name: string;
  net: number; first: number; last: number; bc: number; usable: number; mask: number; cidr: number;
  gw: number | null; switchIp: number | null; routerId?: string; dhcp?: boolean; media?: LinkMedia; routerIds?: string[];
  /**
   * Le multicouche membre du segment, et son adresse.
   *
   * Un lien MLS <-> routeur est un segment d'interconnexion comme un autre : il
   * a une adresse a chaque bout. Le bloc etait deja dimensionne pour elle, mais
   * personne ne la calculait — le bout du cable restait vide.
   */
  sviId?: string; sviIp?: number | null;
  /** VLAN 802.1Q du sous-reseau, si le service en declare un. */
  vlan?: number;
};
export type Iface = {
  routerId: string; routerName: string; iface: string; target: string;
  ip: number; mask: number; cidr: number; role: string; clock: boolean;
  /** Sous-interface 802.1Q : le VLAN encapsule, et l'interface physique porteuse. */
  vlan?: number; parent?: string;
};
export type BaseSummary = { id: string; name: string; net: number; cidr: number; used: number; total: number };
// Un hôte fixe résolu par le moteur : IP validée + rattachement + éventuel problème.
export type PlacedHost = { id: string; name: string; subId: string; subName: string; ip: number | null; raw: string; ok: boolean; note: string };
export type Plan = {
  ok: boolean; error: string; warnings: string[];
  baseNet: number; baseBc: number; cidr: number; totalAddr: number; used: number;
  bases: BaseSummary[];
  subs: Sub[]; ifaces: Iface[]; hosts: PlacedHost[];
};

export function computePlan(ctx: Ctx): Plan {
  ctx = { ...ctx, services: Array.isArray(ctx.services) ? ctx.services : [], bases: Array.isArray(ctx.bases) && ctx.bases.length ? ctx.bases : [{ id: 'b1', name: 'Réseau', ip: ctx.baseIp || '192.168.10.0', cidr: ctx.baseCidr || '24' }] };
  const warnings: string[] = [];
  const linkCidr = clampNum(Number(ctx.linkCidr) || 30, 8, 30);

  // Réseaux de base valides (un ou plusieurs blocs distincts).
  type BInfo = { id: string; name: string; net: number; bc: number; cidr: number; ptr: number };
  const binfo: BInfo[] = [];
  for (const b of ctx.bases) {
    const n = strToIp(b.ip); if (n === null) { warnings.push(`Réseau de base « ${b.name || b.ip} » invalide.`); continue; }
    const c = clampNum(Number(b.cidr) || 24, 1, 30);
    const net = (n & maskFromCidr(c)) >>> 0; const bc = (net | wildcardFromCidr(c)) >>> 0;
    binfo.push({ id: b.id, name: b.name || b.ip, net, bc, cidr: c, ptr: net });
  }
  if (!binfo.length) return { ok: false, error: 'Aucun réseau de base valide.', warnings, baseNet: 0, baseBc: 0, cidr: 24, totalAddr: 0, used: 0, bases: [], subs: [], ifaces: [], hosts: [] };
  const binfoById = new Map(binfo.map(b => [b.id, b] as const));
  const firstBaseId = binfo[0].id;

  // Métadonnées par sous-réseau : LAN (1 routeur) ou interconnexion (2+ routeurs).
  type Meta = { s: Service; rs: RouterDef[]; transit: boolean; serial: boolean };
  const meta = new Map<string, Meta>();
  type Item = { id: string; need: number; cidr: number; baseId: string };
  const items: Item[] = [];
  for (const s of ctx.services) {
    const rs = (Array.isArray(s.routerIds) ? s.routerIds : []).map(id => routeursDe(ctx).find(r => r.id === id)).filter((r): r is RouterDef => !!r);
    // Un multicouche compte comme membre : le lien MLS <-> routeur est un vrai
    // segment d'interconnexion, avec une adresse de chaque cote.
    const sviMembre = !!s.svi && rs.length >= 1;
    const membres = rs.length + (sviMembre ? 1 : 0);
    const transit = membres >= 2;
    const serial = transit && s.media === 'serial';
    const hostsNeed = Math.max(1, Number(s.hosts) || 0);
    const need = serial ? 2 : transit ? Math.max(hostsNeed, membres + (s.hasSwitch ? 1 : 0)) : hostsNeed;
    const c = serial ? linkCidr : 32 - hostBitsFor(need);
    const baseId = binfoById.has(s.baseId || '') ? (s.baseId as string) : firstBaseId;
    meta.set('svc:' + s.id, { s, rs, transit, serial });
    items.push({ id: 'svc:' + s.id, need, cidr: c, baseId });
  }

  // Allocation VLSM par réseau de base (les plus gros blocs d'abord dans chaque bloc).
  const alloc = new Map<string, { net: number; first: number; last: number; bc: number; usable: number; mask: number; cidr: number }>();
  let error = '';
  for (const b of binfo) {
    const list = items.filter(it => it.baseId === b.id).sort((x, y) => Math.pow(2, 32 - y.cidr) - Math.pow(2, 32 - x.cidr));
    for (const it of list) {
      const size = Math.pow(2, 32 - it.cidr);
      const net = b.ptr >>> 0; const bc = (net + size - 1) >>> 0;
      if (bc > b.bc) { if (!error) error = `Plus de place dans ${ipToStr(b.net)}/${b.cidr} (${b.name}) pour un bloc /${it.cidr}. Réduis les besoins ou élargis ce réseau.`; continue; }
      alloc.set(it.id, { net, first: (net + 1) >>> 0, last: (bc - 1) >>> 0, bc, usable: size - 2, mask: maskFromCidr(it.cidr), cidr: it.cidr });
      b.ptr = (bc + 1) >>> 0;
    }
  }

  const subs: Sub[] = [];
  const ifaces: Iface[] = [];
  // Les interfaces déjà prises d'un routeur, par nom. On y réserve d'abord les
  // interfaces imposées par le câblage (ci-dessous), puis nextEth/nextSer
  // distribuent les slots restants — jamais ceux déjà réservés.
  const usedIf = new Map<string, Set<string>>();
  routeursDe(ctx).forEach(r => usedIf.set(r.id, new Set<string>()));
  const nextEth = (r: RouterDef): string | null => {
    const slots = ethSlots(r.model, r.mod); const u = usedIf.get(r.id)!;
    const name = slots.find(x => !u.has(x));
    if (!name) {
      const hint = r.mod ? '' : ` — active le module (slot 1) pour ajouter ${ifAbbr(ethModule(r.model)[0])}`;
      warnings.push(`${r.name} (${r.model}) : plus d'interface ${ethLabel(r.model)} libre (${slots.length} max)${hint}.`); return null;
    }
    u.add(name); return name;
  };
  const nextSer = (r: RouterDef): string | null => {
    const u = usedIf.get(r.id)!; const name = SER_SLOTS.find(x => !u.has(x));
    if (!name) { warnings.push(`${r.name} : plus d'interface série libre.`); return null; }
    u.add(name); return name;
  };

  // Le câblage impose l'interface : le port physique où l'on a branché chaque
  // segment décide de quelle interface porte son adresse — sinon la config ne
  // correspond pas au schéma. Déterminable quand on connaît le voisin : l'autre
  // routeur ou le multicouche d'une interconnexion, le switch d'un trunk,
  // l'unique équipement terminal d'un LAN. À défaut, distribution séquentielle.
  const ifaceForcee = new Map<string, string>();   // `${routerId}|${subId}` -> interface
  const trunkForce = new Map<string, string>();     // routerId -> interface du trunk (routeur sur un bâton)
  {
    const typeDe = (id: string) => ctx.materiels.find(mm => mm.id === id)?.type;
    const portEth = (r: RouterDef, port: number): string | null => {
      const n = ethSlots(r.model, r.mod); return port >= 1 && port <= n.length ? n[port - 1] : null;
    };
    const cableVers = (r: RouterDef, ok: (id: string) => boolean): string | null => {
      for (const v of voisinsDe(ctx.cables, r.id).sort((a, b) => a.monPort - b.monPort)) {
        if (!ok(v.autreId)) continue;
        const nm = portEth(r, v.monPort);
        if (nm && !usedIf.get(r.id)!.has(nm)) return nm;
      }
      return null;
    };
    const reserver = (r: RouterDef, nm: string | null) => { if (nm) usedIf.get(r.id)!.add(nm); return nm; };
    // 1) Interconnexions ethernet : vers l'autre routeur ou le multicouche.
    for (const sv of ctx.services) {
      const mm = meta.get('svc:' + sv.id); if (!mm || !mm.transit || mm.serial) continue;
      const cibles = new Set<string>([...sv.routerIds, ...(sv.svi ? [sv.svi] : [])]);
      for (const r of mm.rs) {
        const nm = reserver(r, cableVers(r, id => id !== r.id && cibles.has(id)));
        if (nm) ifaceForcee.set(r.id + '|' + sv.id, nm);
      }
    }
    // 2) Trunk « routeur sur un bâton » : une interface vers le switch, partagée.
    for (const sv of ctx.services) {
      const mm = meta.get('svc:' + sv.id); if (!mm || mm.transit || vlanOf(sv) === null) continue;
      const r = mm.rs[0]; if (!r || trunkForce.has(r.id)) continue;
      const nm = reserver(r, cableVers(r, id => { const t = typeDe(id); return t === 'switch' || t === 'multicouche'; }));
      if (nm) trunkForce.set(r.id, nm);
    }
    // 3) LAN sans VLAN : vers son switch, son nuage, son poste ou son serveur.
    const finaux = new Set(['switch', 'nuage', 'poste', 'serveur']);
    for (const sv of ctx.services) {
      const mm = meta.get('svc:' + sv.id); if (!mm || mm.transit || vlanOf(sv) !== null) continue;
      const r = mm.rs[0]; if (!r) continue;
      const nm = reserver(r, cableVers(r, id => finaux.has(typeDe(id) ?? '')));
      if (nm) ifaceForcee.set(r.id + '|' + sv.id, nm);
    }
  }
  // IP manuelle d'une interface (si valide et dans le sous-réseau), sinon la valeur calculée.
  const ovIps = ctx.ifaceIps || {};
  const applyOv = (rid: string, iface: string, fallback: number, net: number, bc: number): number => {
    const raw = (ovIps[`${rid}|${iface}`] || '').trim();
    if (!raw) return fallback;
    const n = strToIp(raw);
    if (n === null) { warnings.push(`IP manuelle « ${raw} » sur ${iface} invalide — adresse auto conservée.`); return fallback; }
    if (n <= net || n >= bc) { warnings.push(`IP manuelle ${raw} sur ${iface} hors de ${ipToStr(net)} – ${ipToStr(bc)} — ignorée.`); return fallback; }
    return n >>> 0;
  };

  // Routeur sur un baton : tous les VLAN d'un meme routeur partagent UNE interface
  // physique, chacun sur sa sous-interface. C'est ce qui distingue un plan avec
  // VLAN d'un plan sans : sans eux, il faut une interface par sous-reseau, et un
  // 2811 en a deux.
  const trunkIf = new Map<string, string>();

  for (const s of ctx.services) {
    const a = alloc.get('svc:' + s.id); if (!a) continue;
    const m = meta.get('svc:' + s.id)!;
    if (!m.transit) {
      // LAN : 1 routeur passerelle + clients (DHCP)
      const r = m.rs[0];
      let gw = ctx.gwPos === 'last' ? a.last : a.first;
      const switchIp = s.hasSwitch ? (ctx.gwPos === 'last' ? (a.last - 1) >>> 0 : (a.first + 1) >>> 0) : null;
      // Interface (et donc IP de passerelle, éventuellement forcée manuellement)
      let ifc: string | null = null;
      let parent: string | null = null;
      const vlanId = vlanOf(s);
      if (r) {
        if (vlanId !== null) {
          parent = trunkIf.get(r.id) ?? null;
          if (!parent) { parent = trunkForce.get(r.id) ?? nextEth(r); if (parent) trunkIf.set(r.id, parent); }
          ifc = parent ? `${parent}.${vlanId}` : null;
        } else {
          ifc = ifaceForcee.get(r.id + '|' + s.id) ?? nextEth(r);
        }
        if (ifc) gw = applyOv(r.id, ifc, gw, a.net, a.bc);
      }
      subs.push({ kind: 'lan', id: 'svc:' + s.id, name: s.name || 'LAN', net: a.net, first: a.first, last: a.last, bc: a.bc, usable: a.usable, mask: a.mask, cidr: a.cidr, gw, switchIp, routerId: r?.id, routerIds: r ? [r.id] : [], dhcp: s.dhcp, vlan: vlanId ?? undefined, sviId: s.svi });
      if (!r) {
        // Porte par une SVI : ce n'est pas un oubli, c'est l'autre methode.
        if (!s.svi) warnings.push(`« ${s.name || 'LAN'} » n'a ni routeur ni SVI comme passerelle.`);
        continue;
      }
      if (ifc) ifaces.push({ routerId: r.id, routerName: r.name, iface: ifc, target: `LAN ${s.name || ''}`.trim(), ip: gw, mask: a.mask, cidr: a.cidr, role: vlanId !== null ? `Passerelle VLAN ${vlanId}` : 'Passerelle LAN', clock: false, vlan: vlanId ?? undefined, parent: parent ?? undefined });
    } else {
      // Interconnexion : 2+ routeurs, une IP par routeur (pas de DHCP)
      const parts = m.serial ? m.rs.slice(0, 2) : m.rs;
      // Le multicouche prend l'adresse qui suit celle des routeurs ; la gestion
      // du switch se decale d'autant, sinon les deux tomberaient sur la meme.
      let sviIp = s.svi ? (a.first + parts.length) >>> 0 : null;
      // Le port routé du multicouche accepte une IP imposée, comme une interface
      // de routeur — même carte d'overrides, clé `${mlsId}|${interface}`.
      if (s.svi && sviIp !== null) {
        const pref = ctx.optMls[s.svi]?.prefixe ?? PREFIXE_3560;
        const portMls = voisinsDe(ctx.cables, s.svi).find(v => (s.routerIds || []).includes(v.autreId))?.monPort;
        if (portMls) sviIp = applyOv(s.svi, `${pref}${portMls}`, sviIp, a.net, a.bc);
      }
      const swIp = s.hasSwitch ? (a.first + parts.length + (s.svi ? 1 : 0)) >>> 0 : null;
      subs.push({ kind: 'link', id: 'svc:' + s.id, name: s.name || 'Interconnexion', net: a.net, first: a.first, last: a.last, bc: a.bc, usable: a.usable, mask: a.mask, cidr: a.cidr, gw: null, switchIp: (swIp !== null && swIp <= a.last) ? swIp : null, media: m.serial ? 'serial' : 'gig', routerIds: parts.map(r => r.id), sviId: s.svi, sviIp: (sviIp !== null && sviIp <= a.last) ? sviIp : null });
      if (s.svi && sviIp !== null && sviIp > a.last) warnings.push(`« ${s.name} » : plus de place pour l'adresse du multicouche. Augmente le nombre d'hotes de ce segment.`);
      if (m.serial && m.rs.length > 2) warnings.push(`« ${s.name} » : une liaison série relie exactement 2 routeurs — passe en Ethernet pour en relier davantage.`);
      parts.forEach((r, k) => {
        const ifc = m.serial ? nextSer(r) : (ifaceForcee.get(r.id + '|' + s.id) ?? nextEth(r));
        if (!ifc) return;
        const ip = applyOv(r.id, ifc, (a.first + k) >>> 0, a.net, a.bc);
        const role = m.serial ? (k === 0 ? 'Liaison série (DCE)' : 'Liaison série (DTE)') : 'Interconnexion';
        ifaces.push({ routerId: r.id, routerName: r.name, iface: ifc, target: s.name || 'Interconnexion', ip, mask: a.mask, cidr: a.cidr, role, clock: m.serial && k === 0 });
      });
    }
  }

  // Hôtes fixes (end-points) : validation + rattachement à leur sous-réseau.
  const subById = new Map(subs.map(s => [s.id, s] as const));
  const hosts: PlacedHost[] = (ctx.hosts || []).map(h => {
    const sub = subById.get(h.subId);
    const raw = (h.ip || '').trim();
    const n = strToIp(raw);
    let ok = true, note = '';
    if (!sub) { ok = false; note = 'sous-réseau introuvable'; }
    else if (!raw) { ok = false; note = 'IP à renseigner'; }
    else if (n === null) { ok = false; note = 'IP invalide'; }
    else if (n <= sub.net || n >= sub.bc) { ok = false; note = `hors de ${ipToStr(sub.net)}/${sub.cidr}`; }
    else if (n === sub.gw) { ok = false; note = 'déjà prise par la passerelle'; }
    else if (sub.switchIp !== null && n === sub.switchIp) { ok = false; note = 'déjà prise par le switch'; }
    return { id: h.id, name: h.name, subId: h.subId, subName: sub?.name || '—', ip: ok ? n : (n ?? null), raw, ok, note };
  });
  // Doublons d'IP entre hôtes du même sous-réseau + collision avec la plage DHCP.
  for (let i = 0; i < hosts.length; i++) {
    const h = hosts[i]; if (!h.ok || h.ip === null) continue;
    if (hosts.some((o, j) => j < i && o.ok && o.subId === h.subId && o.ip === h.ip)) { h.ok = false; h.note = 'IP en doublon'; continue; }
    const sub = subById.get(h.subId);
    if (sub && sub.dhcp) { const cr = clientRange(ctx, sub); if (cr && h.ip >= cr[0] && h.ip <= cr[1]) h.note = 'dans la plage DHCP — à exclure du pool'; }
  }

  const basesSum: BaseSummary[] = binfo.map(b => ({ id: b.id, name: b.name, net: b.net, cidr: b.cidr, used: (b.ptr - b.net) >>> 0, total: (b.bc - b.net + 1) >>> 0 }));
  return { ok: !error, error, warnings, baseNet: binfo[0].net, baseBc: binfo[0].bc, cidr: binfo[0].cidr, totalAddr: basesSum.reduce((a, s) => a + s.total, 0), used: basesSum.reduce((a, s) => a + s.used, 0), bases: basesSum, subs, ifaces, hosts };
}

// Nom de pool DHCP Cisco (majuscules, sans accents ni espaces).
const poolName = (s: string) => (s || 'POOL').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'POOL';

export type DhcpRelay = { routerId: string; routerName: string; text: string; count: number };
export type DhcpPool = { name: string; net: string; mask: string; gw: string; dns: string; domain: string; start: string; end: string; lease: number };
export function buildDhcp(ctx: Ctx, plan: Plan): { relays: DhcpRelay[]; pools: DhcpPool[]; relaysFull: string; server: string } {
  const server = (ctx.dhcpServer || '').trim() || (ctx.dnsServer || '').trim();
  // Relais : ip helper-address sur chaque interface LAN dont les clients sont en DHCP.
  const relays: DhcpRelay[] = [];
  for (const r of routeursDe(ctx)) {
    const lans = plan.subs.filter(s => s.kind === 'lan' && s.dhcp && s.routerId === r.id && s.gw !== null)
      .map(s => ({ s, ifc: plan.ifaces.find(i => i.routerId === r.id && i.ip === s.gw) }))
      .filter(x => !!x.ifc);
    if (!lans.length) continue;
    const lines = ['configure terminal'];
    for (const { ifc } of lans) lines.push(`interface ${ifc!.iface}`, ` ip helper-address ${server || '<IP_serveur_DHCP>'}`, ' exit');
    lines.push('end', 'write memory');
    relays.push({ routerId: r.id, routerName: r.name, text: lines.join('\n'), count: lans.length });
  }
  // Pools : à configurer sur le serveur DHCP (une étendue par LAN client).
  const lease = clampNum(Number(ctx.leaseDays) || 7, 0, 365);
  const pools: DhcpPool[] = plan.subs.filter(s => s.kind === 'lan' && s.dhcp && s.gw !== null).map(s => {
    const cr = clientRange(ctx, s);
    return { name: poolName(s.name), net: ipToStr(s.net), mask: ipToStr(s.mask), gw: ipToStr(s.gw!), dns: (ctx.dnsServer || '').trim() || ipToStr(s.gw!), domain: (ctx.domaine || '').trim(), start: cr ? ipToStr(cr[0]) : '-', end: cr ? ipToStr(cr[1]) : '-', lease };
  });
  return { relays, pools, relaysFull: relays.map(b => b.text).join('\n\n'), server };
}

export type DnsRec = { host: string; fqdn: string; ip: number };
export function buildDns(ctx: Ctx, plan: Plan): { recs: DnsRec[]; domain: string; hostLines: string; zone: string; tests: string[] } {
  const domain = ctx.domaine.trim() || 'lan';
  const recs: DnsRec[] = [];
  const seen = new Set<string>();
  for (const r of routeursDe(ctx)) {
    const ifc = plan.ifaces.find(i => i.routerId === r.id);
    if (ifc) { const host = (r.name || 'r').toLowerCase(); recs.push({ host, fqdn: `${host}.${domain}`, ip: ifc.ip }); seen.add(host); }
  }
  const dnsIp = strToIp(ctx.dnsServer.trim());
  if (dnsIp !== null && !seen.has('dns')) recs.push({ host: 'dns', fqdn: `dns.${domain}`, ip: dnsIp });
  // Hôtes fixes (serveurs/postes à IP statique) → enregistrements DNS.
  for (const h of plan.hosts) {
    if (!h.ok || h.ip === null) continue;
    const host = (h.name || 'host').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9-]+/g, '-').replace(/(^-|-$)/g, '') || 'host';
    if (seen.has(host)) continue;
    recs.push({ host, fqdn: `${host}.${domain}`, ip: h.ip }); seen.add(host);
  }

  const hostLines = [
    ctx.domaine.trim() ? `ip domain-name ${domain}` : '',
    ctx.dnsServer.trim() ? `ip name-server ${ctx.dnsServer.trim()}` : '',
    ...recs.map(r => `ip host ${r.host} ${ipToStr(r.ip)}`),
  ].filter(Boolean).join('\n');

  const zone = [
    `; Zone directe — ${domain}`,
    `@            NS    ${recs.find(r => r.host === 'dns')?.fqdn || 'dns.' + domain}`,
    ...recs.map(r => `${r.host.padEnd(12)} A     ${ipToStr(r.ip)}`),
    '',
    '; Zone inverse (PTR)',
    ...recs.map(r => `${ipToStr(r.ip).split('.').reverse().join('.')}.in-addr.arpa   PTR   ${r.fqdn}`),
  ].join('\n');

  const tests = [
    ...recs.slice(0, 3).map(r => `ping ${r.fqdn}`),
    ...(recs.length ? [`nslookup ${recs[0].fqdn}`] : []),
  ];
  return { recs, domain, hostLines, zone, tests };
}

// ─────────────────────── Scripts Linux : DHCP (isc-dhcp-server) et DNS (BIND9) ───────────────────────
// Le même plan d'adressage qui alimente les configs Cisco produit ici les
// fichiers Linux, prêts à coller sur un serveur Debian. Les options laissées à
// l'utilisateur (bail, redirecteurs, zone inverse…) arrivent par `opts`.

export type DhcpLinuxOpts = { iface: string; authoritative: boolean; leaseDays: number };
export function buildDhcpLinux(ctx: Ctx, plan: Plan, opts: DhcpLinuxOpts): { install: string; conf: string; defauts: string; verifs: string } {
  const domaine = (ctx.domaine || '').trim() || 'lan';
  const dns = (ctx.dnsServer || '').trim();
  const bail = clampNum(opts.leaseDays || Number(ctx.leaseDays) || 7, 0, 365) * 86400;
  const lans = plan.subs.filter(s => s.kind === 'lan' && s.dhcp && s.gw !== null);

  const install = ['# Debian/Ubuntu — installation du serveur DHCP', 'sudo apt update', 'sudo apt install isc-dhcp-server'].join('\n');

  const l: string[] = [
    '# /etc/dhcp/dhcpd.conf',
    `option domain-name "${domaine}";`,
    dns ? `option domain-name-servers ${dns};` : '# option domain-name-servers <IP_DNS>;',
    `default-lease-time ${bail};`,
    `max-lease-time ${bail};`,
    opts.authoritative ? 'authoritative;' : '# authoritative;   # à activer sur le DHCP officiel du réseau',
    '',
  ];
  if (!lans.length) l.push('# Aucun LAN « DHCP » : coche « DHCP » sur un sous-réseau (Segmentation).');
  for (const s of lans) {
    const cr = clientRange(ctx, s);
    l.push(
      `# ${s.name || 'LAN'}${s.vlan ? ` (VLAN ${s.vlan})` : ''}`,
      `subnet ${ipToStr(s.net)} netmask ${ipToStr(s.mask)} {`,
      cr ? `    range ${ipToStr(cr[0])} ${ipToStr(cr[1])};` : '    # range <debut> <fin>;',
      `    option routers ${ipToStr(s.gw!)};`,
      dns ? `    option domain-name-servers ${dns};` : '',
      `    option broadcast-address ${ipToStr(s.bc)};`,
      '}',
      '',
    );
  }
  const conf = l.filter(x => x !== '').join('\n').replace(/\n}/g, '\n}').replace(/}\n(?!$)/g, '}\n\n');

  const defauts = ['# /etc/default/isc-dhcp-server', `INTERFACESv4="${opts.iface || 'ens18'}"`].join('\n');
  const verifs = [
    'sudo dhcpd -t -cf /etc/dhcp/dhcpd.conf     # valider la syntaxe AVANT',
    'sudo systemctl restart isc-dhcp-server',
    'sudo systemctl status isc-dhcp-server',
    'sudo journalctl -u isc-dhcp-server -f      # voir les baux distribués',
  ].join('\n');
  return { install, conf, defauts, verifs };
}

export type DnsLinuxOpts = { forwarders: string; allowQuery: string; reverse: boolean };
export function buildDnsLinux(ctx: Ctx, plan: Plan, opts: DnsLinuxOpts): { install: string; options: string; local: string; zoneDirecte: string; zoneInverse: string; verifs: string; reverseName: string } {
  const dnsAll = buildDns(ctx, plan);
  const domaine = dnsAll.domain;
  const recs = dnsAll.recs;
  const dnsIp = strToIp((ctx.dnsServer || '').trim());
  const nsHost = recs.find(r => r.host === 'dns') ?? recs[0];
  const nsFqdn = nsHost ? nsHost.fqdn + '.' : `dns.${domaine}.`;
  const serial = '2026090201';

  const install = ['# Debian/Ubuntu — installation du serveur DNS', 'sudo apt update', 'sudo apt install bind9 bind9utils bind9-dnsutils'].join('\n');

  const fwd = (opts.forwarders || '').split(/[\s,;]+/).map(x => x.trim()).filter(Boolean);
  const options = [
    '// /etc/bind/named.conf.options',
    'options {',
    '    directory "/var/cache/bind";',
    fwd.length ? `    forwarders { ${fwd.join('; ')}; };` : '    // forwarders { 1.1.1.1; 8.8.8.8; };',
    `    allow-query { ${(opts.allowQuery || '').trim() || 'localhost'}; };`,
    '    recursion yes;',
    '    dnssec-validation auto;',
    '    listen-on-v6 { any; };',
    '};',
  ].join('\n');

  // Zone inverse : le /24 du serveur DNS (les 3 premiers octets, à l'envers).
  const base24 = dnsIp !== null ? (dnsIp & 0xFFFFFF00) >>> 0 : null;
  const reverseName = base24 !== null ? `${(base24 >>> 8) & 255}.${(base24 >>> 16) & 255}.${(base24 >>> 24) & 255}.in-addr.arpa` : '';
  const dansBase = (ip: number) => base24 !== null && ((ip & 0xFFFFFF00) >>> 0) === base24;

  const local = [
    '// /etc/bind/named.conf.local',
    `zone "${domaine}" {`,
    '    type master;',
    `    file "/etc/bind/db.${domaine}";`,
    '};',
    ...(opts.reverse && reverseName ? [
      '',
      `zone "${reverseName}" {`,
      '    type master;',
      `    file "/etc/bind/db.${reverseName}";`,
      '};',
    ] : []),
  ].join('\n');

  const enTete = (titre: string) => [
    `; ${titre}`,
    '$TTL    604800',
    `@       IN      SOA     ${nsFqdn} admin.${domaine}. (`,
    `                        ${serial}      ; Serial (a incrementer)`,
    '                         604800         ; Refresh',
    '                          86400         ; Retry',
    '                        2419200         ; Expire',
    '                         604800 )       ; TTL negatif',
    ';',
    `@       IN      NS      ${nsFqdn}`,
    ';',
  ];
  const zoneDirecte = [
    ...enTete(`Zone directe — ${domaine}`),
    ...recs.map(r => `${r.host.padEnd(12)}IN      A       ${ipToStr(r.ip)}`),
  ].join('\n');

  const zoneInverse = (opts.reverse && reverseName)
    ? [
        ...enTete(`Zone inverse — ${reverseName}`),
        ...recs.filter(r => dansBase(r.ip)).map(r => `${String(r.ip & 255).padEnd(8)}IN      PTR     ${r.fqdn}.`),
      ].join('\n')
    : '';

  const verifs = [
    'sudo named-checkconf',
    `sudo named-checkzone ${domaine} /etc/bind/db.${domaine}`,
    ...(opts.reverse && reverseName ? [`sudo named-checkzone ${reverseName} /etc/bind/db.${reverseName}`] : []),
    'sudo systemctl restart named        # ou bind9',
    `dig @127.0.0.1 ${recs[0]?.fqdn || domaine}`,
    ...(opts.reverse && dnsIp !== null ? [`dig @127.0.0.1 -x ${ipToStr(dnsIp)}`] : []),
  ].join('\n');

  return { install, options, local, zoneDirecte, zoneInverse, verifs, reverseName };
}

// Configuration CLI COMPLÈTE de chaque routeur : sécurité, interfaces (NAT inside + relais DHCP + horloge DCE),
// routage statique (plus court chemin) + route par défaut, NAT/PAT de bordure, et SSH (console/vty).
export type RouterCfg = { routerId: string; routerName: string; text: string; routes: number };
export function buildRouterConfigs(ctx: Ctx, plan: Plan): { byRouter: RouterCfg[]; full: string } {
  // Graphe des routeurs via les sous-réseaux d'interconnexion.
  const edges = new Map<string, { to: string; viaIp: number }[]>();
  routeursDe(ctx).forEach(r => edges.set(r.id, []));
  for (const s of plan.subs) {
    if (s.kind !== 'link' || !s.routerIds) continue;
    // Prochain saut = IP réelle de l'interface du voisin sur cette liaison (respecte les IP manuelles).
    const ipOf = (rid: string) => { const f = plan.ifaces.find(i => i.routerId === rid && i.ip > s.net && i.ip < s.bc); return f ? f.ip : null; };
    s.routerIds.forEach((a) => s.routerIds!.forEach((b) => { if (a !== b) { const via = ipOf(b); if (via !== null) edges.get(a)?.push({ to: b, viaIp: via }); } }));
  }
  // Le multicouche est un nœud du graphe : chaque routeur du lien l'atteint par
  // l'adresse que le MLS porte sur ce lien — et, derrière lui, ses VLAN.
  for (const s of plan.subs) {
    if (s.kind !== 'link' || !s.sviId || s.sviIp == null) continue;
    for (const rid of (s.routerIds || [])) edges.get(rid)?.push({ to: s.sviId, viaIp: s.sviIp });
  }
  const nextHopFrom = (from: string) => {
    const res = new Map<string, number>();
    const seen = new Set<string>([from]);
    const q: { node: string; via: number }[] = [];
    for (const e of edges.get(from) || []) if (!seen.has(e.to)) { seen.add(e.to); res.set(e.to, e.viaIp); q.push({ node: e.to, via: e.viaIp }); }
    while (q.length) { const c = q.shift()!; for (const e of edges.get(c.node) || []) if (!seen.has(e.to)) { seen.add(e.to); res.set(e.to, c.via); q.push({ node: e.to, via: c.via }); } }
    return res;
  };
  const relayServer = (ctx.dhcpServer || '').trim() || (ctx.dnsServer || '').trim();
  const dom = (ctx.domaine || '').trim() || 'lan';
  const byRouter: RouterCfg[] = routeursDe(ctx).map(r => {
    const myIf = plan.ifaces.filter(i => i.routerId === r.id);
    const nh = nextHopFrom(r.id);
    const isBorder = !!ctx.internetRouterId && ctx.internetRouterId === r.id;
    const wanIf = (ctx.wanIf || '').trim() || 'GigabitEthernet0/1';
    // IP de passerelle des LAN en DHCP portés par ce routeur → ip helper-address sur l'interface.
    const dhcpGwIps = new Set(plan.subs.filter(s => s.kind === 'lan' && s.dhcp && s.routerId === r.id && s.gw !== null).map(s => s.gw as number));

    const lines: string[] = ['enable', 'configure terminal', `hostname ${r.name}`];

    // -- Sécurité & accès --
    lines.push('! --- Securite & acces ---', 'service password-encryption');
    if ((ctx.secret || '').trim()) lines.push(`enable secret ${ctx.secret.trim()}`);
    lines.push(`username ${ctx.login || 'admin'} privilege 15 secret ${ctx.mdp || 'MotDePasse'}`);
    lines.push(`ip domain-name ${dom}`);
    if ((ctx.dnsServer || '').trim()) lines.push(`ip name-server ${ctx.dnsServer.trim()}`);

    // -- Interfaces (IP, NAT inside, relais DHCP, horloge DCE) --
    lines.push('! --- Interfaces ---');
    // L'interface physique qui porte les VLAN n'a pas d'adresse : elle est activee
    // une fois, puis chaque VLAN prend la sienne sur une sous-interface. L'oublier
    // est l'erreur classique du routeur sur un baton — les sous-interfaces restent
    // muettes sans que rien ne le signale.
    const porteuses = new Set<string>();
    for (const i of myIf) {
      if (i.vlan && i.parent && !porteuses.has(i.parent)) {
        porteuses.add(i.parent);
        lines.push(`interface ${i.parent}`, ' description Trunk 802.1Q vers le switch', ' no ip address', ' no shutdown', ' exit');
      }
      lines.push(`interface ${i.iface}`, ` description ${i.target}`);
      if (i.vlan) lines.push(` encapsulation dot1Q ${i.vlan}`);
      // Port en client DHCP : l'adresse vient d'un serveur hors routeur, on ne
      // la fixe pas. `ip address dhcp` remplace l'adresse statique.
      const enDhcp = ctx.ifaceDhcp?.[`${r.id}|${i.iface}`] === true;
      lines.push(enDhcp ? ' ip address dhcp' : ` ip address ${ipToStr(i.ip)} ${ipToStr(i.mask)}`);
      if (isBorder && i.iface !== wanIf) lines.push(' ip nat inside');
      if (dhcpGwIps.has(i.ip)) lines.push(` ip helper-address ${relayServer || '<IP_serveur_DHCP>'}`);
      if (i.clock) lines.push(' clock rate 64000');
      // Une sous-interface suit l'etat de sa porteuse : pas de `no shutdown`.
      if (!i.vlan) lines.push(' no shutdown');
      lines.push(' exit');
    }

    // -- Sortie Internet (NAT/PAT) — routeur de bordure uniquement --
    if (isBorder) {
      const wanCidr = clampNum(Number(ctx.wanCidr) || 30, 1, 32);
      lines.push('! --- Sortie Internet (NAT/PAT) ---');
      lines.push(`interface ${wanIf}`, ` ip address ${(ctx.wanIp || '').trim() || '<IP_WAN>'} ${ipToStr(maskFromCidr(wanCidr))}`, ' ip nat outside', ' no shutdown', ' exit');
      for (const st of (ctx.natStatics || []).filter(s => (s.inside || '').trim() && (s.pub || '').trim()))
        lines.push(`ip nat inside source static ${st.inside.trim()} ${st.pub.trim()}`);
      if (ctx.natOverload) {
        lines.push('ip access-list standard NAT-LAN');
        for (const b of plan.bases) lines.push(` permit ${ipToStr(b.net)} ${ipToStr(wildcardFromCidr(b.cidr))}`);
        lines.push(' exit', `ip nat inside source list NAT-LAN interface ${wanIf} overload`);
      }
      if ((ctx.webIp || '').trim()) {
        const port = (ctx.webPort || '80').trim();
        lines.push(`ip nat inside source static tcp ${ctx.webIp.trim()} ${port} interface ${wanIf} ${port}`);
      }
    }

    // -- Routage statique (+ route par défaut sur la bordure) --
    const routes: string[] = [];
    const seen = new Set<string>();
    for (const s of plan.subs) {
      if ((s.routerIds || []).includes(r.id)) continue;         // directement connecté
      const targets = [...(s.routerIds || []), ...(s.routerId ? [s.routerId] : []), ...(s.sviId ? [s.sviId] : [])];
      let via: number | undefined;
      for (const t of targets) { const v = nh.get(t); if (v !== undefined) { via = v; break; } }
      if (via === undefined) continue;                           // pas de chemin
      const key = `${s.net}/${s.cidr}`;
      if (seen.has(key)) continue; seen.add(key);
      routes.push(`ip route ${ipToStr(s.net)} ${ipToStr(s.mask)} ${ipToStr(via)}`);
    }
    if (routes.length || isBorder) lines.push('! --- Routage ---');
    if (routes.length) lines.push(...routes);
    if (isBorder) lines.push(`ip route 0.0.0.0 0.0.0.0 ${(ctx.faiGw || '').trim() || '<passerelle_FAI>'}`);

    // -- SSH + lignes d'accès (console/vty) --
    lines.push('! --- SSH & lignes ---', 'crypto key generate rsa', '1024', 'ip ssh version 2');
    lines.push('line console 0', ' logging synchronous', ' login local', ' exit');
    lines.push('line vty 0 4', ' transport input ssh', ' login local', ' exit');

    lines.push('end', 'write memory');
    return { routerId: r.id, routerName: r.name, text: lines.join('\n'), routes: routes.length };
  });
  return { byRouter, full: byRouter.map(b => b.text).join('\n\n') };
}

// Configuration SSH pour chaque routeur et chaque switch (avec SVI de gestion).
// ---------------------------------------------------------------------------
// Configurations des switches d'acces (VLAN 802.1Q).
//
// Sans VLAN, chaque sous-reseau a son switch et son interface de routeur : la
// configuration du switch se resume a une IP de gestion. Avec des VLAN, un seul
// switch porte plusieurs sous-reseaux, et il faut alors dire trois choses :
// quels VLAN existent, quels ports appartiennent a quel VLAN, et par ou sortir.
//
// Les plages de ports sont reparties au prorata des hotes declares, avec un
// minimum d'un port, sur les 24 ports d'acces d'un 2960. Le dernier port
// gigabit sert de trunk vers le routeur — c'est le lien qui porte tous les
// VLAN, donc le seul par ou passe le routage inter-VLAN.
// ---------------------------------------------------------------------------

/** Nom de VLAN Cisco : majuscules, sans accents ni espaces. */
const vlanName = (s: string) => (s || 'VLAN').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'VLAN';

export type SwitchVlanRow = { vlan: number; name: string; net: string; gw: string; ports: string; hosts: number };
export type SwitchCfg = {
  routerId: string; routerName: string; name: string;
  mgmtIp: string; mgmtVlan: number; gw: string;
  rows: SwitchVlanRow[]; uplink: string; nativeVlan: number; text: string;
};

/** Nombre de ports d'acces d'un switch d'atelier (2960 24 ports). */
const SW_PORTS = 24;
/** VLAN natif dedie : jamais le 1, jamais un VLAN de donnees. */
export const NATIVE_VLAN = 999;

export function buildSwitchConfigs(ctx: Ctx, plan: Plan): SwitchCfg[] {
  // Un switch par routeur portant au moins un VLAN : c'est tout l'interet des
  // VLAN — mutualiser le materiel au lieu d'un switch par sous-reseau.
  const parRouteur = new Map<string, Sub[]>();
  for (const sub of plan.subs) {
    if (sub.kind !== 'lan' || !sub.vlan || !sub.routerId) continue;
    const l = parRouteur.get(sub.routerId) ?? [];
    l.push(sub);
    parRouteur.set(sub.routerId, l);
  }

  const out: SwitchCfg[] = [];
  for (const [routerId, subs] of parRouteur) {
    const r = routeursDe(ctx).find(x => x.id === routerId);
    const routerName = r?.name || 'R';
    subs.sort((a, b) => (a.vlan || 0) - (b.vlan || 0));

    // Repartition des ports au prorata des hotes, un port minimum chacun.
    const besoins = subs.map(sub => Math.max(1, (sub.usable || 1)));
    const total = besoins.reduce((a, b) => a + b, 0);
    let libre = SW_PORTS;
    const parts = besoins.map((b, i) => {
      if (i === besoins.length - 1) return libre;
      const n = Math.max(1, Math.min(libre - (besoins.length - 1 - i), Math.round((b / total) * SW_PORTS)));
      libre -= n;
      return n;
    });

    const uplink = 'GigabitEthernet0/1';
    const mgmt = subs[0];
    const mgmtIp = mgmt.switchIp !== null ? ipToStr(mgmt.switchIp) : '';
    const gw = mgmt.gw !== null ? ipToStr(mgmt.gw) : '';
    const nom = `SW-${vlanName(routerName)}`;

    const lines: string[] = ['enable', 'configure terminal', `hostname ${nom}`];
    lines.push('! --- Les VLAN ---');
    for (const sub of subs) lines.push(`vlan ${sub.vlan}`, ` name ${vlanName(sub.name)}`, ' exit');
    lines.push(`vlan ${NATIVE_VLAN}`, ' name NATIF-INUTILISE', ' exit');

    lines.push('! --- Ports d\'acces ---');
    const rows: SwitchVlanRow[] = [];
    let debut = 1;
    subs.forEach((sub, i) => {
      const n = parts[i]!;
      const fin = debut + n - 1;
      const ports = n === 1 ? `FastEthernet0/${debut}` : `FastEthernet0/${debut} - ${fin}`;
      lines.push(
        n === 1 ? `interface FastEthernet0/${debut}` : `interface range FastEthernet0/${debut} - ${fin}`,
        ` description ${sub.name}`,
        ' switchport mode access',
        ` switchport access vlan ${sub.vlan}`,
        ' exit',
      );
      rows.push({
        vlan: sub.vlan!, name: vlanName(sub.name),
        net: `${ipToStr(sub.net)}/${sub.cidr}`,
        gw: sub.gw !== null ? ipToStr(sub.gw) : '—',
        ports: n === 1 ? `fa0/${debut}` : `fa0/${debut}-${fin}`,
        hosts: sub.usable,
      });
      debut = fin + 1;
    });

    lines.push('! --- Trunk vers le routeur ---');
    lines.push(
      `interface ${uplink}`,
      ' description Trunk 802.1Q vers ' + routerName,
      ' switchport mode trunk',
      ` switchport trunk allowed vlan ${subs.map(x => x.vlan).join(',')}`,
      ` switchport trunk native vlan ${NATIVE_VLAN}`,
      ' exit',
    );

    if (mgmtIp) {
      lines.push('! --- Gestion ---');
      lines.push(`interface vlan ${mgmt.vlan}`, ` ip address ${mgmtIp} ${ipToStr(mgmt.mask)}`, ' no shutdown', ' exit');
      if (gw) lines.push(`ip default-gateway ${gw}`);
    }
    lines.push('end', 'write memory');

    out.push({
      routerId, routerName, name: nom,
      mgmtIp, mgmtVlan: mgmt.vlan!, gw,
      rows, uplink, nativeVlan: NATIVE_VLAN,
      text: lines.join('\n'),
    });
  }
  return out;
}

/**
 * Traduit le plan de l'atelier en plan de switch multicouche.
 *
 * Les VLAN ne sont pas ressaisis : ce sont ceux de la Segmentation. C'est ce qui
 * garantit que les deux ecrans racontent la meme maquette — un second endroit ou
 * declarer les reseaux finirait par diverger du premier.
 */
export function buildMlsPlan(ctx: Ctx, plan: Plan): MlsPlan {
  // Quels VLAN reviennent au multicouche ? Ceux dont le sous-reseau le designe.
  // Tant que personne ne le fait, on garde tous les VLAN : c'est le mode « tout
  // au multicouche », celui du TP, et il ne demande alors rien a cocher.
  const parSvi = new Map<string, number[]>();
  let quelquUnChoisit = false;
  for (const svc of ctx.services) {
    const n = Number(svc.vlan);
    if (!svc.svi || !Number.isInteger(n)) continue;
    quelquUnChoisit = true;
    parSvi.set(svc.svi, [...(parSvi.get(svc.svi) ?? []), n]);
  }
  const portesParSvi = new Set([...parSvi.values()].flat());

  const vlans = plan.subs
    .filter(s => s.kind === 'lan' && s.vlan && (!quelquUnChoisit || portesParSvi.has(s.vlan)))
    .sort((a, b) => (a.vlan || 0) - (b.vlan || 0))
    .map(s => ({
      id: s.vlan!,
      name: vlanName(s.name),
      reseau: ipToStr(s.net),
      cidr: s.cidr,
      // La passerelle du sous-reseau devient l'adresse de la SVI : le plan
      // d'adressage ne bouge pas, seul l'equipement qui la porte change.
      passerelle: s.gw !== null ? ipToStr(s.gw) : '',
      dhcp: !!s.dhcp,
    }));
  return {
    // La repartition vient de la Segmentation quand elle y est declaree : un
    // second endroit ou dire quel switch porte quel VLAN finirait par diverger.
    multicouches: quelquUnChoisit
      ? multicouchesDe(ctx).map(m => ({ ...m, vlans: [...new Set(parSvi.get(m.id) ?? [])].sort((a, b) => a - b) }))
      : multicouchesDe(ctx),
    vlans,
    acces: switchesDe(ctx),
    dhcpServer: ctx.dhcpServer || '',
    natif: NATIVE_VLAN,
  };
}

export type SshCfg = { name: string; ip: string; text: string };
export function buildSsh(ctx: Ctx, plan: Plan): { routers: SshCfg[]; switches: SshCfg[] } {
  const dom = (ctx.domaine || '').trim() || 'lan';
  const base = (host: string, extra: string[]): string => [
    'enable', 'configure terminal',
    `hostname ${host}`,
    `ip domain-name ${dom}`,
    ...extra,
    (ctx.secret || '').trim() ? `enable secret ${ctx.secret.trim()}` : '',
    `username ${ctx.login || 'admin'} privilege 15 secret ${ctx.mdp || 'MotDePasse'}`,
    'crypto key generate rsa',
    '1024',
    'ip ssh version 2',
    'line vty 0 4',
    ' transport input ssh',
    ' login local',
    ' exit',
    'end', 'write memory',
  ].filter(Boolean).join('\n');
  const routers: SshCfg[] = routeursDe(ctx).map(r => ({ name: r.name, ip: '', text: base(r.name, []) }));
  // Les sous-reseaux en VLAN partagent un switch par routeur : on ne garde que
  // le premier de chaque routeur, sinon on configurerait quatre switches la ou
  // il n'y en a que deux, avec quatre IP de gestion pour deux equipements.
  const dejaVu = new Set<string>();
  const switches: SshCfg[] = plan.subs.filter(s => {
    if (s.switchIp === null) return false;
    if (!s.vlan || !s.routerId) return true;
    if (dejaVu.has(s.routerId)) return false;
    dejaVu.add(s.routerId);
    return true;
  }).map(s => {
    const rName = s.routerId ? (routeursDe(ctx).find(r => r.id === s.routerId)?.name || '') : '';
    const host = s.vlan && rName ? 'SW-' + rName.replace(/\s+/g, '-')
      : /sw|switch/i.test(s.name) ? s.name.replace(/\s+/g, '-')
        : 'SW-' + s.name.replace(/\s+/g, '-');
    const gw = s.gw !== null ? s.gw : s.first;                  // switch de dorsale → 1re IP routeur
    // L'IP de gestion vit dans le VLAN du sous-reseau, pas dans le VLAN 1 : sur
    // un switch decoupe, le VLAN 1 ne porte aucune adresse et le switch serait
    // injoignable.
    const extra = [`interface vlan ${s.vlan ?? 1}`, ` ip address ${ipToStr(s.switchIp!)} ${ipToStr(s.mask)}`, ' no shutdown', ' exit', `ip default-gateway ${ipToStr(gw)}`];
    return { name: host, ip: ipToStr(s.switchIp!), text: base(host, extra) };
  });
  // Le multicouche route lui-même : pas d'`ip default-gateway`, et sa
  // joignabilité vient de ses SVI. Il lui faut tout de même son SSH — sans quoi
  // l'équipement de cœur resterait le seul sans accès distant.
  const multicouches: SshCfg[] = multicouchesDe(ctx).map(mc => ({ name: mc.nom, ip: '', text: base(mc.nom, []) }));
  return { routers, switches: [...switches, ...multicouches] };
}

// Étape 0 : réinitialiser un équipement réutilisé (config parasite qui bloque tout).
export function buildReset(): string {
  return [
    'enable',
    'write erase',
    'reload',
  ].join('\n');
}

// Sortie Internet : NAT/PAT (overload) sur le routeur de bordure + route par défaut + publication de port.
export type NatCfg = { text: string; router: string };
export function buildNat(ctx: Ctx, plan: Plan): NatCfg | null {
  const r = routeursDe(ctx).find(x => x.id === ctx.internetRouterId);
  if (!r) return null;
  const wanCidr = clampNum(Number(ctx.wanCidr) || 30, 1, 32);
  const wanMask = ipToStr(maskFromCidr(wanCidr));
  const wanIf = (ctx.wanIf || '').trim() || 'GigabitEthernet0/1';
  const myIf = plan.ifaces.filter(i => i.routerId === r.id);
  const lines: string[] = ['configure terminal'];
  lines.push(`interface ${wanIf}`, ` ip address ${(ctx.wanIp || '').trim() || '<IP_WAN>'} ${wanMask}`, ' ip nat outside', ' no shutdown', ' exit');
  if (myIf.length) for (const i of myIf) lines.push(`interface ${i.iface}`, ' ip nat inside', ' exit');
  const statics = (ctx.natStatics || []).filter(s => (s.inside || '').trim() && (s.pub || '').trim());
  if (statics.length) {
    for (const s of statics) lines.push(`ip nat inside source static ${s.inside.trim()} ${s.pub.trim()}`);
  }
  if (ctx.natOverload) {
    lines.push('ip access-list standard NAT-LAN');
    for (const b of plan.bases) lines.push(` permit ${ipToStr(b.net)} ${ipToStr(wildcardFromCidr(b.cidr))}`);
    lines.push(' exit', `ip nat inside source list NAT-LAN interface ${wanIf} overload`);
  }
  lines.push(`ip route 0.0.0.0 0.0.0.0 ${(ctx.faiGw || '').trim() || '<passerelle_FAI>'}`);
  if ((ctx.webIp || '').trim()) {
    const port = (ctx.webPort || '80').trim();
    lines.push(`ip nat inside source static tcp ${ctx.webIp.trim()} ${port} interface ${wanIf} ${port}`);
  }
  lines.push('end', 'write memory');
  return { text: lines.join('\n'), router: r.name };
}

// Table de NAT PRÉVISIONNELLE (ce que « show ip nat translation » affichera) — pour pré-remplir le dossier du TP.
export type NatRow = { proto: string; localInside: string; localPort: string; globalInside: string; globalPort: string; note: string };
export function buildNatTable(ctx: Ctx, plan: Plan, nat: NatCfg | null): NatRow[] {
  if (!nat) return [];
  const wan = (ctx.wanIp || '').trim() || '<IP_WAN>';
  const rows: NatRow[] = [];
  for (const s of (ctx.natStatics || []).filter(s => (s.inside || '').trim() && (s.pub || '').trim()))
    rows.push({ proto: '---', localInside: s.inside.trim(), localPort: '---', globalInside: s.pub.trim(), globalPort: '---', note: 'NAT statique 1:1 (tous ports)' });
  if ((ctx.webIp || '').trim()) {
    const p = (ctx.webPort || '80').trim();
    rows.push({ proto: 'tcp', localInside: ctx.webIp.trim(), localPort: p, globalInside: wan, globalPort: p, note: 'redirection de port (entrant)' });
  }
  if (ctx.natOverload) {
    const lans = plan.subs.filter(s => s.kind === 'lan').slice(0, 2);
    lans.forEach((s, i) => rows.push({ proto: 'tcp', localInside: ipToStr(s.first), localPort: String(1025 + i), globalInside: wan, globalPort: String(1025 + i), note: 'PAT — exemple (port attribué dynamiquement)' }));
    if (!lans.length) rows.push({ proto: 'tcp', localInside: '192.168.x.y', localPort: '1025', globalInside: wan, globalPort: '1025', note: 'PAT — exemple' });
  }
  return rows;
}

// Plan de tests ping (anneaux) : local → inter-réseaux → Internet.
export type TestSection = { title: string; lines: string[] };
export function buildTests(ctx: Ctx, plan: Plan, nat: NatCfg | null): { sections: TestSection[]; full: string } {
  const lan = plan.subs.filter(s => s.kind === 'lan' && s.gw !== null);
  const sections: TestSection[] = [];
  const a: string[] = [];
  for (const s of lan) {
    a.push(`ping ${ipToStr(s.gw!)}`);
    if (s.switchIp !== null) a.push(`ping ${ipToStr(s.switchIp)}`);
  }
  if (a.length) sections.push({ title: 'A. Dans chaque réseau (liaison locale) — passerelle puis switch de gestion', lines: a });
  const gws = Array.from(new Set(lan.map(s => ipToStr(s.gw!))));
  if (gws.length > 1) sections.push({ title: 'B. Entre les réseaux (routage) — depuis un poste, pinguer les passerelles des autres réseaux (interfaces routeur, répondent toujours)', lines: gws.map(g => `ping ${g}`) });
  if (nat && (ctx.faiGw || '').trim()) {
    sections.push({ title: 'C. Vers le FAI & Internet (via NAT/PAT) — passerelle FAI puis Internet', lines: [`ping ${ctx.faiGw.trim()}`, 'ping 8.8.8.8'] });
  }
  const full = sections.map(s => s.lines.join('\n')).join('\n\n');
  return { sections, full };
}

/**
 * Toutes les commandes, rangées par matériel.
 *
 * Le parcours dispersait la configuration d'un même équipement sur six écrans :
 * le routeur ici, son NAT là, son relais DHCP ailleurs, son SSH plus loin. Pour
 * poser une maquette, on veut l'inverse — tout ce qui va dans UN terminal, au
 * même endroit, prêt à coller.
 *
 * **Rien n'est recalculé.** Cette fonction n'invente aucune ligne : elle appelle
 * exactement les générateurs que chaque étape utilisait déjà, et les regroupe
 * par équipement. Une commande juste dans l'ancien parcours l'est ici aussi ;
 * une correction sur un générateur profite aux deux d'un coup.
 */
export type BlocCmd = { titre: string; texte: string };
export type MaterielCmd = {
  id: string; nom: string; type: TypeMateriel; modele: string; ports: number;
  blocs: BlocCmd[]; full: string;
};

/**
 * Une bannière de section, en commentaire Cisco.
 *
 * Le but : qu'un bloc collé « d'un trait » reste lisible dans le terminal. Les
 * lignes commençant par `!` sont des commentaires — l'IOS les ignore, donc on
 * peut baliser sans rien casser. Une bannière large se repère d'un coup d'œil
 * là où un `! ---` discret se noie dans la configuration.
 */
function banniere(titre: string): string {
  const t = titre.toUpperCase();
  const barre = '!' + '═'.repeat(Math.max(t.length + 4, 30));
  return `${barre}\n!  ${t}\n${barre}`;
}

/**
 * Promeut les sous-sections `! --- X ---` que les générateurs posent déjà en
 * bannières lisibles. Robuste : on ne suppose aucun libellé précis, on relève
 * le format que tout le code de génération utilise.
 */
function promouvoirSections(texte: string): string {
  return texte.replace(/^! --- (.+?) ---\s*$/gm, (_, t: string) => `!\n! ══ ${t.trim().toUpperCase()} ══`);
}

/**
 * La config d'un switch à partir de ses ports réglés à la main.
 *
 * Pour un switch d'accès sous multicouche, `configAcces` lit déjà `ports_` — rien
 * à faire. Ce générateur couvre l'autre cas : un switch cablé à un **routeur**
 * dont on a fixé les ports depuis la boîte de dialogue. Sans lui, ces réglages
 * ne partaient dans aucune commande.
 */
function configSwitchPorts(m: Materiel, ctx: Ctx, mlsPlan: MlsPlan, plan: Plan): string {
  const etat = etatDesPorts(ctx, m, mlsPlan);
  const nomVlan = (v: number) => {
    const s = plan.subs.find(x => x.vlan === v);
    return s ? vlanName(s.name) : 'VLAN' + v;
  };
  const iface = (seg: string) => seg.includes('-')
    ? `interface range FastEthernet0/${seg.replace('-', ' - ')}`
    : `interface FastEthernet0/${seg}`;
  const emet = (l: string[], ports: number[], corps: string[]) => {
    for (const seg of ecrirePlage([...ports].sort((a, b) => a - b)).split(',')) {
      l.push(iface(seg), ...corps, ' exit');
    }
  };

  // On regroupe les ports d'acces par VLAN et on rassemble les ports trunk.
  const accesParVlan = new Map<number, number[]>();
  const trunk: number[] = [];
  for (const e of etat) {
    if (e.role === 'access') { const v = e.vlan ?? 1; (accesParVlan.get(v) ?? accesParVlan.set(v, []).get(v)!).push(e.port); }
    else if (e.role === 'trunk') trunk.push(e.port);
  }
  const vlans = [...accesParVlan.keys()].sort((a, b) => a - b);

  const l: string[] = ['enable', 'configure terminal', `hostname ${m.nom}`];
  if (vlans.length) {
    l.push('! --- Les VLAN ---');
    for (const v of vlans) l.push(`vlan ${v}`, ` name ${nomVlan(v)}`, ' exit');
  }
  if (accesParVlan.size) {
    l.push('! --- Ports d\x27acces ---');
    for (const v of vlans) emet(l, accesParVlan.get(v)!, [` description ${nomVlan(v)}`, ' switchport mode access', ` switchport access vlan ${v}`, ' spanning-tree portfast']);
  }
  if (trunk.length) {
    l.push('! --- Trunk 802.1Q ---');
    emet(l, trunk, [' switchport mode trunk',
      ...(vlans.length ? [` switchport trunk allowed vlan ${vlans.join(',')}`] : []),
      ` switchport trunk native vlan ${NATIVE_VLAN}`]);
  }
  l.push('end', 'write memory');
  return l.join('\n');
}

/**
 * Le lien routé entre le multicouche et un routeur — un **réseau distinct**.
 *
 * Le multicouche fait le routage inter-VLAN (SVI + `ip routing`) ; sa liaison
 * vers le routeur n'est donc pas un trunk qui prolongerait les VLAN, mais un
 * **port routé** (`no switchport`) portant l'adresse du /30 d'interconnexion.
 * On y ajoute la route par défaut : tout ce qui n'est pas un VLAN local part
 * vers le routeur. Sans cette interface ni cette route, le MLS ne joint rien
 * hors de ses VLAN, et le routeur ne sait pas revenir vers eux.
 */
function configLienRouteurMls(m: Materiel, ctx: Ctx, plan: Plan): string {
  const liens = plan.subs.filter(z => z.kind === 'link' && z.sviId === m.id && z.sviIp != null);
  if (!liens.length) return '';
  const prefixe = ctx.optMls[m.id]?.prefixe ?? PREFIXE_3560;
  const ipRouteur = (z: Sub, rid: string) => plan.ifaces.find(i => i.routerId === rid && i.ip > z.net && i.ip < z.bc)?.ip ?? null;
  const l: string[] = ['enable', 'configure terminal', `hostname ${m.nom}`, '!'];
  let defGw: number | null = null;
  for (const z of liens) {
    const rid = (z.routerIds || [])[0];
    const port = (() => { const v = voisinsDe(ctx.cables, m.id).find(x => x.autreId === rid); return v ? `${prefixe}${v.monPort}` : `${prefixe}?`; })();
    const nomR = ctx.materiels.find(x => x.id === rid)?.nom ?? 'routeur';
    l.push(
      `! --- Lien route vers ${nomR} (reseau distinct ${ipToStr(z.net)}/${z.cidr}) ---`,
      `interface ${port}`,
      ` description Lien L3 vers ${nomR}`,
      // Sur un 3560, un port devient route par `no switchport` : il quitte la
      // commutation et porte une adresse, comme un port de routeur.
      ' no switchport',
      ` ip address ${ipToStr(z.sviIp!)} ${ipToStr(z.mask)}`,
      ' no shutdown',
      ' exit',
      '!',
    );
    // La route par defaut vise en priorite le routeur de bordure (sortie Internet).
    const ipR = rid ? ipRouteur(z, rid) : null;
    if (ipR !== null && (defGw === null || rid === ctx.internetRouterId)) defGw = ipR;
  }
  if (defGw !== null) l.push("! --- La route par defaut : hors VLAN local, tout part vers le routeur ---", `ip route 0.0.0.0 0.0.0.0 ${ipToStr(defGw)}`, '!');
  l.push('end', 'write memory');
  return l.join('\n');
}

/**
 * Les ports d'accès et trunk **du multicouche lui-même**.
 *
 * `configMls` déclare les VLAN, les SVI, le routage et les trunks vers les
 * switches d'accès enfants — mais pas les ports que l'on règle à la main sur le
 * 3560 : des postes branchés directement en accès, ou un trunk vers un routeur.
 * On les rend ici depuis l'état réel des ports, sans redéclarer les VLAN (déjà
 * faits) ni redire les trunks enfants (déjà émis par `configMls`). Règle 3560 :
 * un trunk exige `switchport trunk encapsulation dot1q`, que le 2960 refuse.
 */
function configPortsMls(m: Materiel, ctx: Ctx, mlsPlan: MlsPlan, plan: Plan): string {
  const etat = etatDesPorts(ctx, m, mlsPlan);
  const prefixe = ctx.optMls[m.id]?.prefixe ?? PREFIXE_3560;
  const nomVlan = (v: number) => {
    const s = plan.subs.find(x => x.vlan === v);
    return s ? vlanName(s.name) : 'VLAN' + v;
  };
  // Les ports déjà couverts autrement : les trunks vers les switches enfants
  // (configMls) et les ports routés vers un routeur (configLienRouteurMls) — un
  // lien MLS <-> routeur est un port routé, pas un trunk.
  const dejaTrunk = new Set<number>(enfantsDe(mlsPlan, m.id).map(e => e.portMls));
  for (const v of voisinsDe(ctx.cables, m.id)) {
    if (ctx.materiels.find(x => x.id === v.autreId)?.type === 'routeur') dejaTrunk.add(v.monPort);
  }
  const tousVlans = mlsPlan.vlans.map(v => v.id).sort((a, b) => a - b);
  const iface = (seg: string) => seg.includes('-')
    ? `interface range ${prefixe}${seg.replace('-', ' - ')}`
    : `interface ${prefixe}${seg}`;
  const emet = (l: string[], ports: number[], corps: string[]) => {
    for (const seg of ecrirePlage([...ports].sort((a, b) => a - b)).split(',')) l.push(iface(seg), ...corps, ' exit');
  };

  const accesParVlan = new Map<number, number[]>();
  const trunk: number[] = [];
  for (const e of etat) {
    if (e.role === 'access') { const v = e.vlan ?? 1; (accesParVlan.get(v) ?? accesParVlan.set(v, []).get(v)!).push(e.port); }
    else if (e.role === 'trunk' && !dejaTrunk.has(e.port)) trunk.push(e.port);
  }
  const vlans = [...accesParVlan.keys()].sort((a, b) => a - b);

  const corps: string[] = [];
  if (accesParVlan.size) {
    corps.push("! --- Ports d'acces (postes relies au multicouche) ---");
    for (const v of vlans) emet(corps, accesParVlan.get(v)!, [` description ${nomVlan(v)}`, ' switchport mode access', ` switchport access vlan ${v}`, ' spanning-tree portfast']);
  }
  if (trunk.length) {
    corps.push('! --- Trunk 802.1Q ---');
    emet(corps, trunk, [' switchport trunk encapsulation dot1q', ' switchport mode trunk',
      ...(tousVlans.length ? [` switchport trunk allowed vlan ${tousVlans.join(',')}`] : []),
      ...(mlsPlan.natif ? [` switchport trunk native vlan ${mlsPlan.natif}`] : [])]);
  }
  if (!corps.length) return '';
  return ['enable', 'configure terminal', `hostname ${m.nom}`, '!', ...corps, 'end', 'write memory'].join('\n');
}

export function buildTout(ctx: Ctx, plan: Plan): MaterielCmd[] {
  const rcfg = buildRouterConfigs(ctx, plan);
  const swcfg = buildSwitchConfigs(ctx, plan);
  const mlsPlan = buildMlsPlan(ctx, plan);
  const dhcp = buildDhcp(ctx, plan);
  const ssh = buildSsh(ctx, plan);
  const nat = buildNat(ctx, plan);
  const reset = buildReset();
  const segs = segmentsDeSortie(ctx, plan);
  const sortie = ctx.mlsSortie ? sortieEffective(ctx.mlsSortie, segs) : null;

  return ctx.materiels.map(m => {
    const blocs: BlocCmd[] = [];
    const ssh1 = (nom: string) =>
      [...ssh.routers, ...ssh.switches].find(s => s.name === nom);

    if (m.type === 'routeur') {
      // Ordre demandé : config (interfaces, VLAN, branchement, route), puis les
      // services — DHCP, SSH — et enfin le NAT de sortie.
      const rc = rcfg.byRouter.find(b => b.routerId === m.id);
      if (rc) blocs.push({ titre: 'Réinitialiser (si réemploi)', texte: reset });
      if (rc) blocs.push({ titre: 'Configuration — interfaces, VLAN, routage', texte: rc.text });
      const relay = dhcp.relays.find(r => r.routerId === m.id);
      if (relay) blocs.push({ titre: 'Relais DHCP', texte: relay.text });
      const s = ssh1(m.nom);
      if (s) blocs.push({ titre: 'Accès SSH', texte: s.text });
      if (nat && ctx.internetRouterId === m.id) blocs.push({ titre: 'NAT — sortie Internet', texte: nat.text });
    } else if (m.type === 'multicouche') {
      const mc = mlsPlan.multicouches.find(x => x.id === m.id || x.nom === m.nom);
      if (mc) {
        blocs.push({ titre: 'Réinitialiser (si réemploi)', texte: reset });
        blocs.push({ titre: 'VLAN, SVI et routage inter-VLAN', texte: configMls(mlsPlan, mc) });
        // Le lien routé vers le routeur : un réseau distinct (/30), avec sa route
        // par défaut — sans quoi le multicouche ne joint rien hors de ses VLAN.
        const lienR = configLienRouteurMls(m, ctx, plan);
        if (lienR) blocs.push({ titre: 'Lien routé vers le routeur (réseau distinct)', texte: lienR });
        // Les ports réglés à la main sur le multicouche : postes en accès et
        // trunk vers un routeur — que configMls, tourné vers les switches
        // enfants, n'émettait pas.
        const portsMls = configPortsMls(m, ctx, mlsPlan, plan);
        if (portsMls) blocs.push({ titre: 'Ports d’accès et trunk du multicouche', texte: portsMls });
        // La sortie Internet portée en L3 : une seule, sur le multicouche de
        // bordure — le premier, comme l'écran SVI qui l'affiche une fois.
        if (sortie && mlsPlan.multicouches[0]?.id === mc.id) {
          blocs.push({ titre: 'Sortie Internet (couche 3)', texte: configSortieMls(mlsPlan, sortie) });
        }
      }
      const s = ssh1(m.nom);
      if (s) blocs.push({ titre: 'Accès SSH', texte: s.text });
    } else if (m.type === 'switch') {
      // Trois sources, dans l'ordre : switch d'accès sous multicouche
      // (configAcces lit déjà ports_) ; sinon, ports réglés à la main sur un
      // switch cablé à un routeur ; sinon, le switch synthétique « routeur sur
      // un bâton » que le générateur fabrique par routeur. Le uplink se trouve
      // par le câblage — un switch relié à un routeur adopte sa config de switch.
      const acc = mlsPlan.acces.find(a => a.id === m.id || a.name === m.nom);
      const uplink = voisinsDe(ctx.cables, m.id)
        .map(v => ctx.materiels.find(x => x.id === v.autreId))
        .find(x => x?.type === 'routeur');
      const soar = swcfg.find(sc => sc.name === m.nom)
        ?? (uplink ? swcfg.find(sc => sc.routerId === uplink.id) : undefined);
      // Dès qu'on a réglé les ports au dialogue, ce réglage **fait foi** : la
      // config part de l'état littéral du schéma (accès ET trunk, VLAN déclarés,
      // trunk autorisant ces VLAN) plutôt que de la répartition automatique du
      // multicouche, qui ignorait les trunks posés à la main. Sans réglage, on
      // garde le comportement du TP (configAcces) ; à défaut de multicouche mais
      // avec du câblage, on rend l'état réel des ports.
      const aReglage = !!ctx.optSwitches[m.id]?.ports_?.length;
      const etatSw = etatDesPorts(ctx, m, mlsPlan);
      const perso = (aReglage || (!acc && !soar && etatSw.some(e => e.role !== 'libre')))
        ? configSwitchPorts(m, ctx, mlsPlan, plan) : null;
      if (acc || perso || soar) blocs.push({ titre: 'Réinitialiser (si réemploi)', texte: reset });
      if (aReglage && perso) blocs.push({ titre: 'VLAN, ports d’accès et trunk (réglés à la main)', texte: perso });
      else if (acc) blocs.push({ titre: 'VLAN, ports d’accès et trunk', texte: configAcces(acc, mlsPlan) });
      else if (perso) blocs.push({ titre: 'VLAN, ports d’accès et trunk (d’après le câblage)', texte: perso });
      else if (soar) blocs.push({ titre: 'VLAN et trunk (routeur sur un bâton)', texte: soar.text });
      const s = ssh1(m.nom);
      if (s) blocs.push({ titre: 'Accès SSH', texte: s.text });
    } else if (m.type === 'poste') {
      // Un poste n'est pas un équipement Cisco : sa « config » est l'adressage
      // à saisir sur le PC — fixe ou DHCP. Les commandes données sont celles
      // d'un vrai terminal (Windows / Linux), collables telles quelles.
      const conf = ctx.postesIp?.[m.id];
      if (!conf || conf.mode === 'dhcp') {
        blocs.push({
          titre: 'Adressage du poste — DHCP',
          texte: [
            `! ${m.nom} reçoit son adresse d'un serveur DHCP (hors poste).`,
            '! Sur le PC : Configuration IP → DHCP (obtenir une adresse automatiquement).',
            '! Vérifier / renouveler le bail :',
            'ipconfig /renew          ! Windows',
            'sudo dhclient -v eth0    ! Linux',
          ].join('\n'),
        });
      } else {
        const sub = plan.subs.find(x => x.id === conf.subId);
        const masque = sub ? ipToStr(maskFromCidr(sub.cidr)) : '255.255.255.0';
        const gw = sub && sub.gw !== null ? ipToStr(sub.gw) : '<passerelle>';
        const dns = (ctx.dnsServer || '').trim() || '<serveur_DNS>';
        const ip = (conf.ip || '').trim() || '<adresse>';
        blocs.push({
          titre: 'Adressage du poste — IP fixe',
          texte: [
            `! ${m.nom} — adresse fixe${sub ? ` dans « ${sub.name} »` : ''}`,
            `! IP         : ${ip}`,
            `! Masque     : ${masque}`,
            `! Passerelle : ${gw}`,
            `! DNS        : ${dns}`,
            '! Appliquer (Windows, adapter le nom de la carte) :',
            `netsh interface ip set address "Ethernet" static ${ip} ${masque} ${gw}`,
            `netsh interface ip set dns "Ethernet" static ${dns}`,
            '! Appliquer (Linux) :',
            `sudo ip address add ${ip}/${sub ? sub.cidr : 24} dev eth0`,
            `sudo ip route add default via ${gw}`,
          ].join('\n'),
        });
      }
    }

    // Le bloc « d'un trait » : chaque section sous sa bannière, et les
    // sous-sections des générateurs (interfaces, VLAN, routage, accès, trunk…)
    // promues en repères visibles. Tout se colle en une fois dans le terminal.
    const full = blocs
      .map(b => `${banniere(b.titre)}\n${promouvoirSections(b.texte)}`)
      .join('\n!\n!\n');
    return { id: m.id, nom: m.nom, type: m.type, modele: m.modele, ports: m.ports, blocs, full };
  });
}

// ─────────────────────────────────────────── Styles ───────────────────────────────────────────
const field: CSSProperties = { width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13.5, boxSizing: 'border-box' };
const label: CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 4 };
const group: CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface-2)', marginBottom: 14 };
const legend: CSSProperties = { fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const btn: CSSProperties = { padding: '6px 11px', border: '1px solid var(--accent)', borderRadius: 8, background: 'transparent', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 12.5, whiteSpace: 'nowrap' };
const smallBtn: CSSProperties = { ...btn, padding: '3px 9px', fontSize: 12, borderColor: 'var(--border)', color: 'var(--text-soft)' };
const mono: CSSProperties = { fontFamily: 'ui-monospace,monospace' };
const th: CSSProperties = { textAlign: 'left', padding: '7px 9px', borderBottom: '2px solid var(--border)', fontSize: 12, color: 'var(--text-soft)', whiteSpace: 'nowrap' };
const td: CSSProperties = { padding: '6px 9px', borderBottom: '1px solid var(--border)', fontSize: 12.5, whiteSpace: 'nowrap' };
// Bloc de SORTIE générée (config CLI à coller) : look « terminal » + liseré accent à gauche
// pour le distinguer nettement des champs de saisie (correctif audit B1 : saisie ≠ sortie).
const preStyle: CSSProperties = { background: 'var(--surface-3)', border: '1px solid var(--border)', borderLeft: '3px solid var(--accent)', borderRadius: 8, padding: '11px 13px', overflowX: 'auto', fontSize: 12, lineHeight: 1.55, margin: 0, whiteSpace: 'pre', color: 'var(--text)', ...mono };

const STEPS = [
  { n: 12, icon: '🧰', title: 'Par matériel' },
  { n: 1, icon: '🧾', title: 'Contexte' },
  { n: 2, icon: '⚙️', title: 'Préférences' },
  { n: 3, icon: '🧮', title: 'Segmentation' },
  { n: 4, icon: '🗺️', title: 'Schéma & routeurs' },
  { n: 5, icon: '📶', title: 'DHCP' },
  { n: 6, icon: '🌐', title: 'DNS' },
  { n: 7, icon: '🔑', title: 'SSH' },
  { n: 14, icon: '🚦', title: 'ACL (filtrage)' },
  { n: 9, icon: '🔀', title: 'VLAN & switches' },
  { n: 10, icon: '🗼', title: 'Switch multicouche (SVI)' },
  { n: 11, icon: '🔌', title: 'Materiel & cablage' },
  { n: 8, icon: '🔌', title: 'Tests' },
  { n: 13, icon: '🐧', title: 'DNS & DHCP Linux' },
];
const STORAGE_KEY = 'net_workshop_v1';

/**
 * Les segments qui relient un multicouche a un routeur.
 *
 * Ce sont les candidats a porter la sortie Internet : plutot que de lui laisser
 * inventer ses propres adresses, elle en adopte un et lit les siennes.
 */
function segmentsDeSortie(ctx: Ctx, plan: Plan): SegmentSortie[] {
  return plan.subs
    .filter(z => z.kind === 'link' && z.sviId && z.sviIp != null && (z.routerIds?.length ?? 0) >= 1)
    .map(z => {
      const r = routeursDe(ctx).find(x => x.id === z.routerIds![0]);
      return {
        id: z.id, nom: z.name, cidr: z.cidr,
        ipMls: ipToStr(z.sviIp!), ipFirewall: ipToStr(z.first), nomRouteur: r?.name ?? 'Firewall',
      };
    });
}

/** Une sortie Internet plausible : adresses de documentation (RFC 5737) cote
 *  WAN, pour qu'on ne recopie pas par megarde une adresse publique reelle. */
const SORTIE_DEFAUT: SortieInternet = {
  firewall: 'Firewall',
  ipMls: '10.0.0.1', ipFirewall: '10.0.0.2', lienCidr: 30,
  portMls: 'GigabitEthernet1/0/24',
  ifInside: 'GigabitEthernet0/0', ifWan: 'GigabitEthernet0/1',
  ipWan: '203.0.113.2', cidrWan: 30, passerelleFai: '203.0.113.1',
};
/** Un reseau externe qui ne recoupe aucun reseau interne courant. */
const EXTERNE_DEFAUT: ReseauExterne = {
  routeur: 'Router1',
  ifVersPareFeu: 'FastEthernet0/0', ifVersSite: 'FastEthernet0/1',
  ipVersPareFeu: '85.85.85.2',
  reseauSite: '200.200.200.0', cidrSite: 24,
  ipRouteurSite: '200.200.200.254', ipSite: '200.200.200.1',
  nomSite: 'www.exemple.lan',
};
const tdMls: CSSProperties = { padding: '4px 7px', borderBottom: '1px solid var(--border)', verticalAlign: 'top' };

// ── Configuration fine des ports d'un switch ───────────────────────────────

export type EtatPort = {
  // 'route' : port routé (no switchport) — un port de multicouche câblé à un
  // routeur porte l'adresse du lien L3, il ne commute pas.
  port: number; role: 'access' | 'trunk' | 'libre' | 'route'; vlan?: number;
  /** Le voisin, s'il y a un câble : nom, id, type, et l'id du câble pour le retirer. */
  cableVers?: string; cableVersId?: string; cableVersType?: TypeMateriel; cableId?: string;
};

/** Le type d'équipement d'en face oriente le rôle par défaut d'un port câblé. */
const roleParDefaut = (typeVoisin: TypeMateriel | undefined): 'access' | 'trunk' =>
  typeVoisin === 'switch' || typeVoisin === 'multicouche' || typeVoisin === 'routeur' ? 'trunk' : 'access';

const nomDeMat = (ctx: Ctx, id: string) => ctx.materiels.find(m => m.id === id)?.nom ?? '?';

/**
 * L'état de chaque port d'un switch, port par port.
 *
 * Trois sources, dans cet ordre : le câble (un port relié à un voisin ne
 * s'édite pas ici, c'est le câblage qui le décide), l'override manuel
 * (`optSwitches[id].ports_`), puis le calcul automatique. Un port sans rien est
 * libre.
 */
export function etatDesPorts(ctx: Ctx, m: Materiel, mlsPlan: MlsPlan): EtatPort[] {
  const n = Math.max(1, m.ports);
  // Le voisin de chaque port câblé : nom, id, id du câble, et son type — qui
  // oriente le rôle par défaut (trunk vers une infra, accès vers un poste).
  const cable = new Map<number, { nom: string; id: string; cableId: string; type?: TypeMateriel }>();
  for (const c of ctx.cables) {
    if (c.deId === m.id) { const v = ctx.materiels.find(x => x.id === c.versId); cable.set(c.dePort, { nom: v?.nom ?? '?', id: c.versId, cableId: c.id, type: v?.type }); }
    if (c.versId === m.id) { const v = ctx.materiels.find(x => x.id === c.deId); cable.set(c.versPort, { nom: v?.nom ?? '?', id: c.deId, cableId: c.id, type: v?.type }); }
  }
  const sw = mlsPlan.acces.find(a => a.id === m.id) ?? null;
  const parts: AffectationPort[] = ctx.optSwitches[m.id]?.ports_ ?? (sw ? affectations(mlsPlan, sw) : []);
  const role = new Map<number, { role: 'access' | 'trunk'; vlan?: number }>();
  for (const p of parts) for (const num of analyserPlage(p.plage)) role.set(num, { role: p.role, vlan: p.vlan });

  const out: EtatPort[] = [];
  for (let p = 1; p <= n; p++) {
    const c = cable.get(p);
    const r = role.get(p);
    // Un multicouche relié à un routeur : port routé (no switchport), pas un
    // trunk — la commutation s'arrête là, il porte l'adresse du lien L3.
    const routeL3 = !!c && m.type === 'multicouche' && c.type === 'routeur';
    if (c) out.push({ port: p, role: routeL3 ? 'route' : (r?.role ?? roleParDefaut(c.type)), vlan: r?.vlan, cableVers: c.nom, cableVersId: c.id, cableVersType: c.type, cableId: c.cableId });
    else if (r) out.push({ port: p, role: r.role, vlan: r.vlan });
    else out.push({ port: p, role: 'libre' });
  }
  return out;
}

/**
 * Réécrit les affectations après un changement sur UN port.
 *
 * On repart de l'état courant — sans les câbles, qui ne s'écrivent pas ici — on
 * change le port visé, puis on regroupe en plages contiguës par (rôle, VLAN).
 * Résultat : la config des autres ports ne bouge pas d'un iota.
 */
export function definirPort(
  ctx: Ctx, m: Materiel, mlsPlan: MlsPlan, port: number,
  val: { role: 'access' | 'trunk' | 'libre'; vlan?: number },
): AffectationPort[] {
  // On repart de l'état courant — câbles compris désormais : un port branché à
  // un poste est un port d'accès qu'on doit pouvoir régler. Le rôle par défaut
  // d'un port câblé (trunk vers une infra, accès vers un poste) est ainsi
  // matérialisé et conservé quand on touche un autre port.
  const map = new Map<number, { role: 'access' | 'trunk'; vlan?: number } | null>();
  for (const e of etatDesPorts(ctx, m, mlsPlan)) {
    // Un port routé (multicouche <-> routeur) n'est ni accès ni trunk : il se
    // déduit du câblage, on ne l'écrit pas dans ports_.
    if (e.role === 'route') continue;
    map.set(e.port, e.role === 'libre' ? null : { role: e.role, vlan: e.vlan });
  }
  map.set(port, val.role === 'libre' ? null : { role: val.role, vlan: val.vlan });

  const groupes = new Map<string, { role: 'access' | 'trunk'; vlan?: number; ports: number[] }>();
  for (const [p, r] of map) {
    if (!r) continue;
    const key = r.role + ':' + (r.vlan ?? '');
    (groupes.get(key) ?? groupes.set(key, { role: r.role, vlan: r.vlan, ports: [] }).get(key)!).ports.push(p);
  }
  return [...groupes.values()]
    .filter(g => g.ports.length)
    .map(g => ({ plage: ecrirePlage(g.ports), role: g.role, vlan: g.vlan }));
}

const sansCle = <T,>(rec: Record<string, T>, k: string): Record<string, T> =>
  Object.fromEntries(Object.entries(rec).filter(([x]) => x !== k));

/** Les interfaces d'un routeur : chacune en IP fixe ou en client DHCP. */
function RouteurInterfaces({ ctx, m, plan, onCtx }: { ctx: Ctx; m: Materiel; plan: Plan; onCtx: (p: Partial<Ctx>) => void }) {
  const ifs = plan.ifaces.filter(i => i.routerId === m.id);
  if (!ifs.length) return (
    <div className="meta" style={{ fontSize: 12.5 }}>
      Ce routeur n'a pas encore d'interface active : câble-le et donne-lui un sous-réseau (Adressage), ses ports apparaîtront ici.
    </div>
  );
  return (
    <>
      <div style={legend}>🔌 Les ports — IP fixe ou DHCP</div>
      <div className="meta" style={{ fontSize: 11.5, marginBottom: 8 }}>
        Un port en <strong>DHCP</strong> reçoit son adresse d'un serveur <strong>hors routeur</strong>
        (le FAI, un serveur de la salle) : la config passe en <code>ip address dhcp</code>. En fixe, on
        garde l'adresse calculée — ou on en impose une.
      </div>
      <div style={{ display: 'grid', gap: 7 }}>
        {ifs.map(i => {
          const cle = `${m.id}|${i.iface}`;
          const dhcp = ctx.ifaceDhcp?.[cle] === true;
          const forcee = ctx.ifaceIps?.[cle] ?? '';
          return (
            <div key={i.iface} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', background: 'var(--surface-2)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ ...mono, fontSize: 12, fontWeight: 600 }}>{i.iface}</span>
                <span className="meta" style={{ fontSize: 11 }}>{i.target}</span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  <button type="button"
                    onClick={() => onCtx({ ifaceDhcp: sansCle(ctx.ifaceDhcp || {}, cle) })}
                    style={{ ...smallBtn, ...(!dhcp ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}) }}>IP fixe</button>
                  <button type="button"
                    onClick={() => onCtx({ ifaceDhcp: { ...(ctx.ifaceDhcp || {}), [cle]: true }, ifaceIps: sansCle(ctx.ifaceIps || {}, cle) })}
                    style={{ ...smallBtn, ...(dhcp ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}) }}>DHCP</button>
                </span>
              </div>
              {dhcp ? (
                <div className="meta" style={{ ...mono, fontSize: 11, marginTop: 6 }}>ip address dhcp</div>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                  <span className="meta" style={{ fontSize: 11.5 }}>Adresse</span>
                  <input value={forcee} placeholder={ipToStr(i.ip)} style={{ ...field, width: 160 }}
                    onChange={e => {
                      const v = e.target.value.trim();
                      onCtx({ ifaceIps: v ? { ...(ctx.ifaceIps || {}), [cle]: v } : sansCle(ctx.ifaceIps || {}, cle) });
                    }} />
                  <span className="meta" style={{ fontSize: 11 }}>vide = adresse calculée</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

/** L'adressage d'un poste : fixe (adresse dans un sous-réseau) ou DHCP. */
function PosteAdressage({ ctx, m, plan, onCtx }: { ctx: Ctx; m: Materiel; plan: Plan; onCtx: (p: Partial<Ctx>) => void }) {
  const conf = ctx.postesIp?.[m.id] ?? { mode: 'dhcp' as const };
  const lans = plan.subs.filter(s => s.kind === 'lan');
  const set = (next: { mode: 'fixe' | 'dhcp'; ip?: string; subId?: string }) =>
    onCtx({ postesIp: { ...(ctx.postesIp || {}), [m.id]: next } });
  const sub = plan.subs.find(x => x.id === conf.subId) ?? lans[0];
  return (
    <>
      <div style={legend}>🖥️ Adressage du poste</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button type="button" onClick={() => set({ mode: 'dhcp' })}
          style={{ ...smallBtn, ...(conf.mode === 'dhcp' ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}) }}>DHCP</button>
        <button type="button" onClick={() => set({ mode: 'fixe', ip: conf.ip, subId: conf.subId ?? lans[0]?.id })}
          style={{ ...smallBtn, ...(conf.mode === 'fixe' ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}) }}>IP fixe</button>
      </div>
      {conf.mode === 'dhcp' ? (
        <div className="meta" style={{ fontSize: 12 }}>
          Le poste obtiendra son adresse d'un serveur DHCP — rien à saisir dessus. Ses commandes le rappellent
          (renouvellement du bail).
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          <label style={{ fontSize: 12 }}>Sous-réseau
            <select value={conf.subId ?? sub?.id ?? ''} style={{ ...field, marginTop: 3 }}
              onChange={e => set({ mode: 'fixe', ip: conf.ip, subId: e.target.value })}>
              {!lans.length && <option value="">aucun sous-réseau — à définir dans Adressage</option>}
              {lans.map(s => <option key={s.id} value={s.id}>{s.name} · {ipToStr(s.net)}/{s.cidr}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12 }}>Adresse IP
            <input value={conf.ip ?? ''} placeholder={sub ? ipToStr(sub.first) : '192.168.0.10'} style={{ ...field, marginTop: 3 }}
              onChange={e => set({ mode: 'fixe', ip: e.target.value, subId: conf.subId ?? sub?.id })} />
          </label>
          {sub && (
            <div className="meta" style={{ fontSize: 11.5 }}>
              Masque {ipToStr(maskFromCidr(sub.cidr))} · passerelle {sub.gw !== null ? ipToStr(sub.gw) : '—'} · DNS {(ctx.dnsServer || '—')}.
              À prendre <strong>hors de la plage DHCP</strong> pour éviter un conflit.
            </div>
          )}
        </div>
      )}
    </>
  );
}

/** La boîte de dialogue de configuration fine d'un équipement. */
function DialogueMateriel({ ctx, m, mlsPlan, plan, onPatch, onPorts, onCtx, onRetirerCable, onClose }: {
  ctx: Ctx; m: Materiel; mlsPlan: MlsPlan; plan: Plan;
  onPatch: (patch: Partial<Materiel>) => void;
  onPorts: (ports: AffectationPort[]) => void;
  onCtx: (patch: Partial<Ctx>) => void;
  onRetirerCable: (cableId: string) => void;
  onClose: () => void;
}) {
  const [selPort, setSelPort] = useState<number | null>(null);
  const commutable = m.type === 'switch' || m.type === 'multicouche';
  const etat = commutable ? etatDesPorts(ctx, m, mlsPlan) : [];
  // Les VLAN proposés : ceux du plan, plus ceux déjà posés sur des ports.
  const vlansPlan = mlsPlan.vlans.map(v => v.id);
  const vlansPort = etat.filter(e => e.vlan).map(e => e.vlan!);
  const vlans = [...new Set([...vlansPlan, ...vlansPort])].sort((a, b) => a - b);
  const modeles = m.type === 'routeur' ? ['2911', '2811'] : m.type === 'switch' ? ['2960'] : m.type === 'multicouche' ? ['3560', '3750'] : [];

  const majPort = (port: number, val: { role: 'access' | 'trunk' | 'libre'; vlan?: number }) => {
    onPorts(definirPort(ctx, m, mlsPlan, port, val));
  };

  const couleur = (e: EtatPort) =>
    e.role === 'route' ? '#38bdf8'
      : e.cableVers ? 'var(--text-muted)'
        : e.role === 'trunk' ? 'var(--accent)'
          : e.role === 'access' && e.vlan ? couleurVlan(e.vlan, vlans)
            : 'var(--border)';

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 14px', zIndex: 60, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label={`Configurer ${m.nom}`}
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px', maxWidth: 560, width: '100%', boxShadow: '0 18px 50px -20px rgba(0,0,0,.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <PictoMateriel type={m.type} taille={22} />
          <strong style={{ fontSize: 16 }}>{m.nom}</strong>
          <span className="meta" style={{ fontSize: 12 }}>couche {COUCHE_DE[m.type]}</span>
          <button type="button" onClick={onClose} style={{ ...smallBtn, marginLeft: 'auto' }}>Fermer</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <label style={{ fontSize: 12 }}>Nom
            <input value={m.nom} style={{ ...field, marginTop: 3 }} onChange={e => onPatch({ nom: e.target.value })} />
          </label>
          <label style={{ fontSize: 12 }}>Ports
            <input type="number" min={1} max={48} value={m.ports} style={{ ...field, marginTop: 3 }}
              onChange={e => onPatch({ ports: Math.max(1, Number(e.target.value) || 1) })} />
          </label>
          {!!modeles.length && (
            <label style={{ fontSize: 12 }}>Modèle
              <select value={m.modele} style={{ ...field, marginTop: 3 }} onChange={e => onPatch({ modele: e.target.value })}>
                {modeles.map(x => <option key={x} value={x}>{x}</option>)}
              </select>
            </label>
          )}
        </div>

        {commutable ? (
          <>
            <div style={legend}>🔌 Les ports — clique un port pour le configurer</div>
            <div className="meta" style={{ fontSize: 11.5, marginBottom: 8 }}>
              Accès (une couleur par VLAN) · trunk (accent) · <strong style={{ color: '#38bdf8' }}>L3</strong> routé vers un routeur · <strong>●</strong> relié · libre (contour).
              Un port branché à un poste reste configurable — clique-le pour choisir son VLAN.
              Le résultat part directement dans les commandes du switch.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))', gap: 6, marginBottom: 10 }}>
              {etat.map(e => (
                <button key={e.port} type="button"
                  onClick={() => setSelPort(selPort === e.port ? null : e.port)}
                  title={`${e.cableVers ? `Relié à ${e.cableVers} · ` : ''}${e.role === 'route' ? 'Port routé (no switchport)' : e.role === 'access' ? `Accès VLAN ${e.vlan ?? '?'}` : e.role === 'trunk' ? 'Trunk' : 'Libre'}`}
                  style={{
                    position: 'relative',
                    border: `2px solid ${couleur(e)}`, borderRadius: 8, padding: '6px 2px', cursor: 'pointer',
                    background: selPort === e.port ? 'color-mix(in srgb, var(--accent) 14%, var(--surface-2))' : 'var(--surface-2)',
                    fontSize: 11, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2,
                  }}>
                  {/* Une pastille pleine marque un port câblé, sans le griser :
                      il reste cliquable et configurable. */}
                  {e.cableVers && <span style={{ position: 'absolute', top: 3, right: 4, fontSize: 8, color: 'var(--accent)' }}>●</span>}
                  <div style={{ ...mono }}>{e.port}</div>
                  <div style={{ fontSize: 8.5, color: 'var(--text-muted)' }}>
                    {e.role === 'route' ? 'L3' : e.role === 'access' ? (e.vlan ?? '—') : e.role === 'trunk' ? 'trunk' : '·'}
                  </div>
                </button>
              ))}
            </div>

            {selPort != null && (() => {
              const e = etat.find(x => x.port === selPort)!;
              return (
                <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', background: 'var(--surface-2)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Port {selPort}</div>
                  {e.role === 'route' ? (() => {
                    // Port routé (no switchport) vers un routeur : il porte l'adresse
                    // du lien L3, réglable comme une interface de routeur.
                    const pref = ctx.optMls[m.id]?.prefixe ?? 'FastEthernet0/';
                    const cle = `${m.id}|${pref}${selPort}`;
                    const lien = plan.subs.find(z => z.kind === 'link' && z.sviId === m.id && (z.routerIds || []).includes(e.cableVersId || ''));
                    const auto = lien && lien.sviIp != null ? ipToStr(lien.sviIp) : '';
                    const forcee = ctx.ifaceIps?.[cle] ?? '';
                    return (
                      <div>
                        <div style={{ fontSize: 12.5, color: '#38bdf8', fontWeight: 600, marginBottom: 6 }}>🔗 Port routé (L3) — no switchport</div>
                        <div className="meta" style={{ fontSize: 11.5, marginBottom: 8 }}>
                          Le multicouche route lui-même : ce port vers <strong>{e.cableVers}</strong> n'est pas un trunk, il porte l'adresse du lien{lien ? <> (<span style={mono}>{ipToStr(lien.net)}/{lien.cidr}</span>)</> : null}.
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span className="meta" style={{ fontSize: 12 }}>Adresse</span>
                          <input value={forcee} placeholder={auto || 'ip du lien'} style={{ ...field, width: 170 }}
                            onChange={ev => { const v = ev.target.value.trim(); onCtx({ ifaceIps: v ? { ...(ctx.ifaceIps || {}), [cle]: v } : sansCle(ctx.ifaceIps || {}, cle) }); }} />
                          <span className="meta" style={{ fontSize: 11 }}>vide = adresse calculée</span>
                        </div>
                      </div>
                    );
                  })() : (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className="meta" style={{ fontSize: 12 }}>Mode</span>
                    <button type="button" onClick={() => majPort(selPort, { role: 'access', vlan: e.vlan ?? vlans[0] })}
                      style={{ ...smallBtn, ...(e.role === 'access' ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}) }}>Accès</button>
                    <button type="button" onClick={() => majPort(selPort, { role: 'trunk' })}
                      style={{ ...smallBtn, ...(e.role === 'trunk' ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}) }}>Trunk</button>
                    <button type="button" onClick={() => majPort(selPort, { role: 'libre' })}
                      style={{ ...smallBtn, ...(e.role === 'libre' ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}) }}>Libre</button>
                    {e.role === 'access' && (
                      <>
                        <span className="meta" style={{ fontSize: 12, marginLeft: 6 }}>VLAN</span>
                        <select value={e.vlan ?? ''} style={{ ...field, width: 130 }}
                          onChange={ev => majPort(selPort, { role: 'access', vlan: Number(ev.target.value) || undefined })}>
                          {!vlans.length && <option value="">aucun VLAN au plan</option>}
                          {vlans.map(v => <option key={v} value={v}>{v} — {mlsPlan.vlans.find(x => x.id === v)?.name ?? 'VLAN' + v}</option>)}
                        </select>
                      </>
                    )}
                  </div>
                  )}
                  {e.cableVers && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                      <span className="meta" style={{ fontSize: 11.5 }}>🔗 Relié à <strong>{e.cableVers}</strong></span>
                      <button type="button" onClick={() => { if (e.cableId) onRetirerCable(e.cableId); }}
                        style={{ ...smallBtn, borderColor: 'var(--danger)', color: 'var(--danger)' }}>Retirer le lien</button>
                    </div>
                  )}
                </div>
              );
            })()}

            {!!ctx.optSwitches[m.id]?.ports_?.length && (
              <button type="button" onClick={() => onPorts([])} style={{ ...smallBtn, marginTop: 10 }}>
                ↺ Revenir à la répartition automatique
              </button>
            )}
          </>
        ) : m.type === 'routeur' ? (
          <RouteurInterfaces ctx={ctx} m={m} plan={plan} onCtx={onCtx} />
        ) : m.type === 'poste' ? (
          <PosteAdressage ctx={ctx} m={m} plan={plan} onCtx={onCtx} />
        ) : (
          <div className="meta" style={{ fontSize: 12.5 }}>
            Un {m.type} n'a pas de ports à configurer ici : son rôle se lit dans le schéma et l'adressage.
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────── Composant principal ───────────────────────────────────────────
export interface NetworkWorkshopProps {
  /** Contexte contrôlé (mode application/projet). Absent → l'îlot gère son état via localStorage. */
  value?: Ctx;
  onChange?: (next: Ctx) => void;
  /** Étape contrôlée (pilotée par une navigation externe, ex. la sidebar de l'Atelier). */
  step?: number;
  onStep?: (n: number) => void;
  /** Barre d'étapes intégrée (true pour l'îlot ; false quand une sidebar navigue). */
  showStepper?: boolean;
  /** Sous-vue de l'étape 4 (mode app) : 'schema' | 'routeurs' | 'nat'. Absent → tout s'affiche (îlot). */
  section4?: 'schema' | 'routeurs' | 'nat';
}

/*
 * @id     tssr.atelier.networkWorkshop
 * @do     composer_reseau
 * @role   ui
 * @layer  ui
 * @human  Atelier : atelier de composition et configuration d'un réseau.
 */
export function NetworkWorkshop({ value, onChange, step: stepProp, onStep, showStepper = true, section4 }: NetworkWorkshopProps = {}) {
  const ctxControlled = value !== undefined && onChange !== undefined;
  const [internalCtx, setInternalCtx] = useState<Ctx>(() => {
    try { const v = localStorage.getItem(STORAGE_KEY); if (v) return migrateCtx(JSON.parse(v)); } catch { /* */ }
    return DEFAULT_CTX;
  });
  const ctx = ctxControlled ? value! : internalCtx;
  const setCtx = (action: Ctx | ((c: Ctx) => Ctx)) => {
    if (ctxControlled) onChange!(typeof action === 'function' ? (action as (c: Ctx) => Ctx)(value!) : action);
    else setInternalCtx(action);
  };

  const stepControlled = stepProp !== undefined && onStep !== undefined;
  const [internalStep, setInternalStep] = useState(1);
  const step = stepControlled ? stepProp! : internalStep;
  const setStep = (n: number) => { if (stepControlled) onStep!(n); else setInternalStep(n); };

  const [copied, setCopied] = useState('');
  const [dialMat, setDialMat] = useState<string | null>(null);
  // Les cartes pour comprendre, le tableau pour recopier : les deux servent, a
  // des moments differents.
  const [vuePlan, setVuePlan] = useState<'cartes' | 'tableau'>('cartes');

  // Persistance locale uniquement en mode autonome (îlot CMS) ; en mode contrôlé,
  // l'état est porté par le projet (serveur).
  useEffect(() => { if (ctxControlled) return; try { localStorage.setItem(STORAGE_KEY, JSON.stringify(internalCtx)); } catch { /* */ } }, [internalCtx, ctxControlled]);

  const set = (p: Partial<Ctx>) => setCtx(c => ({ ...c, ...p }));
  const plan = useMemo(() => computePlan(ctx), [ctx]);
  /*
   * Les interfaces telles que le moteur les a resolues, dans la forme que le
   * schema attend. C'est ce qui separe un schema de cablage d'un schema
   * d'adressage : sans elles, l'affichage « nom + adresse » n'aurait rien a
   * ecrire.
   */
  const ifacesSchema = useMemo<InterfaceSchema[]>(
    () => plan.ifaces.map(i => ({
      materielId: i.routerId, nom: i.iface, ip: `${ipToStr(i.ip)}/${i.cidr}`, vlan: i.vlan,
    })),
    [plan.ifaces],
  );
  /** Ce qu'une annulation remet en place : les positions ET le cablage. */
  const restaurerSchema = (e: EtatSchema) => set({ physPos: e.positions, cables: e.cables });

  const copy = (key: string, text: string) => { navigator.clipboard?.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(''), 1600); }).catch(() => {}); };

  // — réseaux de base —
  const bases = Array.isArray(ctx.bases) && ctx.bases.length ? ctx.bases : [{ id: 'b1', name: 'Réseau principal', ip: ctx.baseIp || '192.168.10.0', cidr: ctx.baseCidr || '24' }];
  const setBase = (id: string, p: Partial<BaseNet>) => set({ bases: bases.map(b => b.id === id ? { ...b, ...p } : b) });
  const addBase = () => set({ bases: [...bases, { id: uid('b'), name: 'Réseau ' + (bases.length + 1), ip: '10.0.0.0', cidr: '24' }] });
  const delBase = (id: string) => { if (bases.length <= 1) return; const rest = bases.filter(b => b.id !== id); const fb = rest[0].id; set({ bases: rest, services: ctx.services.map(s => (s.baseId === id ? { ...s, baseId: fb } : s)) }); };
  // — sous-réseaux —
  const setSvc = (id: string, p: Partial<Service>) => set({ services: ctx.services.map(s => s.id === id ? { ...s, ...p } : s) });
  const addSvc = () => set({ services: [...ctx.services, { id: uid('s'), name: 'Nouveau sous-réseau', hosts: '10', routerIds: routeursDe(ctx)[0] ? [routeursDe(ctx)[0].id] : [], hasSwitch: true, dhcp: true, baseId: bases[0].id }] });
  const delSvc = (id: string) => set({ services: ctx.services.filter(s => s.id !== id) });
  // Cocher un routeur retire la SVI, et inversement : une passerelle et une seule.
  const toggleSvcRouter = (id: string, rid: string) => set({ services: ctx.services.map(s => s.id === id ? { ...s, ...(s.routerIds.length >= 1 ? {} : { svi: undefined }), routerIds: s.routerIds.includes(rid) ? s.routerIds.filter(x => x !== rid) : [...s.routerIds, rid] } : s) });
  // — routers —
  // Un routeur est un materiel : son nom et son modele vivent dans l'inventaire,
  // et seul le module — que la couche 1 ignore — se range a cote.
  const setRtr = (id: string, p: Partial<RouterDef>) => set({
    ...(p.name !== undefined || p.model !== undefined
      ? { materiels: ctx.materiels.map(m => m.id === id ? { ...m, ...(p.name !== undefined ? { nom: p.name } : {}), ...(p.model !== undefined ? { modele: p.model } : {}) } : m) }
      : {}),
    ...(p.mod !== undefined ? { optRouteurs: { ...ctx.optRouteurs, [id]: { ...ctx.optRouteurs[id], mod: p.mod } } } : {}),
  });
  const addRtr = () => set({ materiels: [...ctx.materiels, { id: uid('r'), nom: 'R' + (routeursDe(ctx).length + 1), type: 'routeur' as TypeMateriel, modele: '2911', ports: PORTS_TYPIQUES.routeur }] });
  const delRtr = (id: string) => set({
    materiels: ctx.materiels.filter(m => m.id !== id),
    cables: ctx.cables.filter(c => c.deId !== id && c.versId !== id),
    services: ctx.services.map(s => ({ ...s, routerIds: s.routerIds.filter(x => x !== id) })),
  });
  // Repartir d'un atelier vierge (efface le contexte enregistré dans le navigateur).
  const resetCtx = () => { if (typeof window !== 'undefined' && !window.confirm('Réinitialiser l’atelier ? (réseaux, routeurs et sous-réseaux reviennent aux valeurs par défaut)')) return; if (!ctxControlled) { try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ } } setCtx(DEFAULT_CTX); setStep(1); };
  // — NAT statique (1:1) —
  const setStat = (idx: number, p: Partial<{ inside: string; pub: string }>) => set({ natStatics: (ctx.natStatics || []).map((s, i) => i === idx ? { ...s, ...p } : s) });
  const addStat = () => set({ natStatics: [...(ctx.natStatics || []), { inside: '', pub: '' }] });
  const delStat = (idx: number) => set({ natStatics: (ctx.natStatics || []).filter((_, i) => i !== idx) });
  // Adressage manuel : IP d'interface routeur + hôtes fixes (end-points)
  const setIfaceIp = (key: string, v: string) => { const next = { ...(ctx.ifaceIps || {}) }; if (v.trim()) next[key] = v; else delete next[key]; set({ ifaceIps: next }); };
  const setHost = (idx: number, p: Partial<StaticHost>) => set({ hosts: (ctx.hosts || []).map((h, i) => i === idx ? { ...h, ...p } : h) });
  const addHost = () => set({ hosts: [...(ctx.hosts || []), { id: uid('h'), name: '', subId: (plan.subs.find(s => s.kind === 'lan')?.id) || plan.subs[0]?.id || '', ip: '' }] });
  const delHost = (idx: number) => set({ hosts: (ctx.hosts || []).filter((_, i) => i !== idx) });

  // Texte exportable du plan (étapes 3/4).
  const planText = useMemo(() => {
    if (!plan.subs.length) return '';
    const head = plan.bases.length > 1
      ? 'Reseaux de base :\n' + plan.bases.map(b => `  ${b.name} : ${ipToStr(b.net)}/${b.cidr}  (${b.total} adr., ${b.used} utilisees)`).join('\n')
      : `Reseau de base : ${ipToStr(plan.baseNet)}/${plan.cidr}  (${plan.totalAddr} adresses, ${plan.used} utilisees)`;
    const subLines = plan.subs.map(s => `${s.name}\t${ipToStr(s.net)}/${s.cidr}\t${ipToStr(s.mask)}\t${ipToStr(s.first)} - ${ipToStr(s.last)}\tbc ${ipToStr(s.bc)}\t${s.gw !== null ? 'gw ' + ipToStr(s.gw) : '(lien)'}\t${s.usable} hotes`);
    const ifLines = plan.ifaces.map(i => `${i.routerName}\t${i.iface}\t${i.target}\t${ipToStr(i.ip)}\t${ipToStr(i.mask)}\t${i.role}${i.clock ? '  [clock rate 64000]' : ''}`);
    return [head, '', 'Sous-reseaux :', 'Nom\tReseau/CIDR\tMasque\tPlage utilisable\tBroadcast\tPasserelle\tHotes', ...subLines,
      '', 'Table d adressage des interfaces :', 'Routeur\tInterface\tCible\tIP\tMasque\tRole', ...ifLines].join('\n');
  }, [plan]);

  const dhcp = useMemo(() => buildDhcp(ctx, plan), [ctx, plan]);

  /*
   * L'import en masse : le texte collé, par ACL.
   *
   * Gardé hors du contexte enregistré — c'est un brouillon de saisie, pas une
   * donnée du projet. Ce qui compte finit dans `aces` ; le reste n'a aucune
   * raison de survivre à un rechargement.
   */
  const [collage, setCollage] = useState<Record<string, string>>({});
  const [remplacer, setRemplacer] = useState<Record<string, boolean>>({});

  const importDe = (aclId: string) => analyserColler(collage[aclId] ?? '');

  const appliquerImport = (aclId: string) => {
    const lu = importDe(aclId);
    const nouvelles = lu.lignes.filter(l => l.ace).map(l => ({ ...l.ace!, id: uid('ace') }));
    if (!nouvelles.length) return;
    majAcls(l => l.map(a => (a.id === aclId
      ? { ...a, aces: remplacer[aclId] ? nouvelles : [...a.aces, ...nouvelles] } : a)));
    setCollage(c => ({ ...c, [aclId]: '' }));
  };

  /** Lit un fichier déposé et le verse dans la zone de collage. */
  const lireFichier = (aclId: string, f: File | null | undefined) => {
    if (!f) return;
    const lecteur = new FileReader();
    lecteur.onload = () => setCollage(c => ({ ...c, [aclId]: String(lecteur.result ?? '') }));
    // Les tableurs français exportent souvent en Windows-1252 ; on lit en UTF-8
    // et les accents perdus n'affectent que les commentaires, jamais une règle.
    lecteur.readAsText(f, 'utf-8');
  };

  // ── Étape 14 : la politique de flux ───────────────────────────────────
  const politique = ctx.politique ?? { flux: [], options: OPTIONS_ACL };
  const majPolitique = (patch: Partial<{ flux: FluxAcl[]; options: OptionsPolitique }>) =>
    setCtx(c => ({ ...c, politique: { ...(c.politique ?? { flux: [], options: OPTIONS_ACL }), ...patch } }));

  /*
   * Les zones d'où part du trafic : les LAN, et la porte par laquelle ils
   * entrent dans le routeur.
   *
   * Un segment d'interconnexion n'en est pas une — personne n'y branche de
   * poste. Une ACL posée dessus filtrerait le transit, ce qui n'est pas ce que
   * décrit une matrice de flux.
   */
  const zonesSource = useMemo<ZoneSource[]>(() => plan.subs
    .filter(s => s.kind === 'lan' && s.gw !== null)
    .map((s): ZoneSource | null => {
      const porte = plan.ifaces.find(i => i.ip === s.gw);
      return porte ? {
        id: s.id, nom: s.name,
        cible: { genre: 'reseau', ip: ipToStr(s.net), cidr: s.cidr },
        routeurId: porte.routerId, routeurNom: porte.routerName,
        interfaceNom: porte.iface, dhcp: s.dhcp,
      } : null;
    })
    .filter((z): z is ZoneSource => z !== null), [plan]);

  /** Tout ce qu'un flux peut viser : un réseau, une machine, ou l'extérieur. */
  const zonesCible = useMemo<ZoneCible[]>(() => [
    { id: 'any', nom: 'N’importe où (any)', cible: { genre: 'any' } },
    ...plan.subs.map(s => ({
      id: s.id, nom: `${s.name} — ${ipToStr(s.net)}/${s.cidr}`,
      cible: { genre: 'reseau' as const, ip: ipToStr(s.net), cidr: s.cidr },
    })),
    ...plan.hosts.filter(h => h.ip !== null).map(h => ({
      id: `h:${h.id}`, nom: `${h.name} — ${ipToStr(h.ip!)}`,
      cible: { genre: 'host' as const, ip: ipToStr(h.ip!) },
    })),
  ], [plan]);

  const apercuPolitique = useMemo(
    () => genererAcls(zonesSource, zonesCible, politique.flux, politique.options,
      (ctx.acls ?? []).filter(a => !a.genere).map(a => a.nom)),
    [zonesSource, zonesCible, politique, ctx.acls],
  );

  const ajouterFlux = () => majPolitique({
    flux: [...politique.flux, {
      id: uid('flux'), sourceId: zonesSource[0]?.id ?? '', destinationId: 'any',
      services: ['tcp:443'], decision: 'permit',
    }],
  });
  const majFlux = (id: string, patch: Partial<FluxAcl>) =>
    majPolitique({ flux: politique.flux.map(f => (f.id === id ? { ...f, ...patch } : f)) });
  const retirerFlux = (id: string) => majPolitique({ flux: politique.flux.filter(f => f.id !== id) });

  /*
   * Générer remplace les ACL générées, jamais celles écrites à la main.
   *
   * On corrige souvent une règle produite avant de relancer la génération ;
   * tout écraser ferait perdre le travail, ne rien écraser en produirait deux
   * exemplaires. Le drapeau `genere` tranche.
   */
  const appliquerPolitique = () => setCtx(c => ({
    ...c,
    acls: [...(c.acls ?? []).filter(a => !a.genere), ...apercuPolitique.acls],
  }));

  // ── Étape 14 : les ACL ────────────────────────────────────────────────
  const aclsCtx = ctx.acls ?? [];
  const majAcls = (f: (l: AclAtelier[]) => AclAtelier[]) => setCtx(c => ({ ...c, acls: f(c.acls ?? []) }));

  const ajouterAcl = () => {
    const routeur = routeursDe(ctx)[0];
    majAcls(l => [...l, {
      id: uid('acl'), nom: numeroLibre('etendue', l.map(x => x.nom)), type: 'etendue',
      routeurId: routeur?.id ?? '', aces: [], permitFinal: false, applications: [],
    }]);
  };
  const retirerAcl = (id: string) => majAcls(l => l.filter(a => a.id !== id));
  const majAcl = (id: string, patch: Partial<AclAtelier>) =>
    majAcls(l => l.map(a => (a.id === id ? { ...a, ...patch } : a)));

  /*
   * Changer de type renumérote.
   *
   * Une ACL étendue passée en standard garderait un numéro que le routeur
   * refuse — 110 n'existe pas en standard. On lui donne le premier numéro libre
   * de la nouvelle plage, sauf si elle porte un nom, qui lui n'a pas de plage.
   */
  const changerType = (id: string, type: TypeAcl) => majAcls(l => l.map(a => {
    if (a.id !== id) return a;
    const nomme = !Number.isInteger(Number(a.nom));
    return { ...a, type, nom: nomme ? a.nom : numeroLibre(type, l.filter(x => x.id !== id).map(x => x.nom)) };
  }));

  const ajouterAce = (aclId: string) => majAcls(l => l.map(a => (a.id === aclId ? {
    ...a,
    aces: [...a.aces, {
      id: uid('ace'), autorisation: 'permit' as const, protocole: a.type === 'standard' ? 'ip' as const : 'tcp' as const,
      source: { genre: 'any' } as Cible, destination: { genre: 'any' } as Cible,
    }],
  } : a)));
  const majAce = (aclId: string, aceId: string, patch: Partial<Ace>) => majAcls(l => l.map(a => (a.id === aclId
    ? { ...a, aces: a.aces.map(x => (x.id === aceId ? { ...x, ...patch } : x)) } : a)));
  const retirerAce = (aclId: string, aceId: string) => majAcls(l => l.map(a => (a.id === aclId
    ? { ...a, aces: a.aces.filter(x => x.id !== aceId) } : a)));
  const deplacerAce = (aclId: string, i: number, pas: -1 | 1) => majAcls(l => l.map(a => {
    if (a.id !== aclId) return a;
    const cible = i + pas;
    if (cible < 0 || cible >= a.aces.length) return a;
    const aces = [...a.aces];
    [aces[i], aces[cible]] = [aces[cible], aces[i]];
    return { ...a, aces };
  }));

  const ajouterApplication = (aclId: string, iface: string) => majAcls(l => l.map(a => (a.id === aclId
    ? { ...a, applications: [...a.applications, { interface: iface, sens: 'in' as const }] } : a)));
  const majApplication = (aclId: string, i: number, patch: Partial<{ interface: string; sens: 'in' | 'out' }>) =>
    majAcls(l => l.map(a => (a.id === aclId
      ? { ...a, applications: a.applications.map((x, k) => (k === i ? { ...x, ...patch } : x)) } : a)));
  const retirerApplication = (aclId: string, i: number) => majAcls(l => l.map(a => (a.id === aclId
    ? { ...a, applications: a.applications.filter((_, k) => k !== i) } : a)));

  /*
   * Les cibles proposées viennent du plan, pas d'une saisie libre.
   *
   * Choisir « Production » plutôt que retaper 192.168.10.0 /26 supprime la
   * faute la plus fréquente de l'exercice : le masque générique calculé à
   * l'envers. La saisie libre reste possible pour ce qui n'est pas dans le plan.
   */
  const ciblesDuPlan = useMemo(() => [
    ...plan.subs.map(s => ({
      cle: `net:${s.id}`, libelle: `${s.name} — ${ipToStr(s.net)}/${s.cidr}`,
      cible: { genre: 'reseau' as const, ip: ipToStr(s.net), cidr: s.cidr },
    })),
    ...plan.ifaces.map(i => ({
      cle: `if:${i.routerId}:${i.iface}`, libelle: `${i.routerName} ${ifAbbr(i.iface)} — ${ipToStr(i.ip)}`,
      cible: { genre: 'host' as const, ip: ipToStr(i.ip) },
    })),
    ...plan.hosts.filter(h => h.ip !== null).map(h => ({
      cle: `host:${h.id}`, libelle: `${h.name} — ${ipToStr(h.ip!)}`,
      cible: { genre: 'host' as const, ip: ipToStr(h.ip!) },
    })),
  ], [plan]);

  /** Un sélecteur de cible : le plan, « n'importe qui », ou une adresse à la main. */
  const ChoixCible = ({ valeur, onChange }: { valeur: Cible; onChange: (c: Cible) => void }) => {
    const courant = valeur.genre === 'any' ? 'any'
      : ciblesDuPlan.find(c => c.cible.genre === valeur.genre
        && c.cible.ip === (valeur as { ip: string }).ip
        && (c.cible as { cidr?: number }).cidr === (valeur as { cidr?: number }).cidr)?.cle ?? 'libre';
    return (
      <div style={{ display: 'grid', gap: 3, minWidth: 190 }}>
        <select
          value={courant}
          onChange={e => {
            const v = e.target.value;
            if (v === 'any') return onChange({ genre: 'any' });
            if (v === 'libre') return onChange({ genre: 'host', ip: '' });
            const t = ciblesDuPlan.find(c => c.cle === v);
            if (t) onChange(t.cible);
          }}
          style={{ ...field, fontSize: 12 }}
        >
          <option value="any">any — n’importe qui</option>
          {ciblesDuPlan.map(c => <option key={c.cle} value={c.cle}>{c.libelle}</option>)}
          <option value="libre">adresse à la main…</option>
        </select>
        {valeur.genre !== 'any' && courant === 'libre' && (
          <div style={{ display: 'flex', gap: 4 }}>
            <input value={(valeur as { ip: string }).ip} placeholder="192.168.1.10"
                   onChange={e => onChange(valeur.genre === 'reseau'
                     ? { ...valeur, ip: e.target.value }
                     : { genre: 'host', ip: e.target.value })}
                   style={{ ...field, ...mono, fontSize: 12 }} />
            <select
              value={valeur.genre === 'reseau' ? String(valeur.cidr) : 'host'}
              onChange={e => onChange(e.target.value === 'host'
                ? { genre: 'host', ip: (valeur as { ip: string }).ip }
                : { genre: 'reseau', ip: (valeur as { ip: string }).ip, cidr: Number(e.target.value) })}
              style={{ ...field, width: 86, fontSize: 12 }}
            >
              <option value="host">host</option>
              {[8, 16, 24, 25, 26, 27, 28, 29, 30].map(c => <option key={c} value={c}>/{c}</option>)}
            </select>
          </div>
        )}
        {valeur.genre === 'reseau' && (
          <span className="meta" style={{ fontSize: 10.5, ...mono }}>wildcard {wildcardTexte(valeur.cidr)}</span>
        )}
      </div>
    );
  };

  /** Un sélecteur de port : les services de l'exercice, ou une condition libre. */
  const ChoixPort = ({ valeur, proto, onChange }: { valeur?: Port; proto: 'tcp' | 'udp'; onChange: (p: Port) => void }) => {
    const services = SERVICES.filter(s => s.proto === proto);
    const courant = !valeur?.operateur ? ''
      : (valeur.operateur === 'eq' && services.some(s => s.port === valeur.valeur)) ? `svc:${valeur.valeur}` : 'libre';
    return (
      <div style={{ display: 'grid', gap: 3, minWidth: 150 }}>
        <select
          value={courant}
          onChange={e => {
            const v = e.target.value;
            if (!v) return onChange({ operateur: '' });
            if (v === 'libre') return onChange({ operateur: 'gt', valeur: 1023 });
            onChange({ operateur: 'eq', valeur: Number(v.slice(4)) });
          }}
          style={{ ...field, fontSize: 12 }}
        >
          <option value="">tous les ports</option>
          {services.map(s => <option key={s.port} value={`svc:${s.port}`}>{s.port} — {s.nom}</option>)}
          <option value="libre">condition à la main…</option>
        </select>
        {courant === 'libre' && (
          <div style={{ display: 'flex', gap: 4 }}>
            <select value={valeur?.operateur || 'eq'} onChange={e => onChange({ ...valeur, operateur: e.target.value as Port['operateur'] })}
                    style={{ ...field, width: 74, fontSize: 12 }}>
              <option value="eq">eq</option><option value="neq">neq</option>
              <option value="gt">gt</option><option value="lt">lt</option><option value="range">range</option>
            </select>
            <input value={valeur?.valeur ?? ''} inputMode="numeric" placeholder="1023"
                   onChange={e => onChange({ ...valeur, operateur: valeur?.operateur || 'eq', valeur: Number(e.target.value) || 0 })}
                   style={{ ...field, ...mono, width: 70, fontSize: 12 }} />
            {valeur?.operateur === 'range' && (
              <input value={valeur?.fin ?? ''} inputMode="numeric" placeholder="65535"
                     onChange={e => onChange({ ...valeur, operateur: 'range', fin: Number(e.target.value) || 0 })}
                     style={{ ...field, ...mono, width: 76, fontSize: 12 }} />
            )}
          </div>
        )}
      </div>
    );
  };

  const dns = useMemo(() => buildDns(ctx, plan), [ctx, plan]);
  // Options des scripts Linux (locales à l'atelier — dérivées du plan).
  const [lxIface, setLxIface] = useState('ens18');
  const [lxAuthoritative, setLxAuthoritative] = useState(true);
  const [lxForwarders, setLxForwarders] = useState('1.1.1.1, 8.8.8.8');
  const [lxReverse, setLxReverse] = useState(true);
  const lxAllowQuery = useMemo(() => {
    const b = plan.bases?.[0]; return b ? `localhost; ${ipToStr(b.net)}/${b.cidr}` : 'localhost';
  }, [plan]);
  const dhcpLx = useMemo(() => buildDhcpLinux(ctx, plan, { iface: lxIface, authoritative: lxAuthoritative, leaseDays: Number(ctx.leaseDays) || 7 }), [ctx, plan, lxIface, lxAuthoritative]);
  const dnsLx = useMemo(() => buildDnsLinux(ctx, plan, { forwarders: lxForwarders, allowQuery: lxAllowQuery, reverse: lxReverse }), [ctx, plan, lxForwarders, lxAllowQuery, lxReverse]);
  const routerCfg = useMemo(() => buildRouterConfigs(ctx, plan), [ctx, plan]);
  const ssh = useMemo(() => buildSsh(ctx, plan), [ctx, plan]);
  const majMls = (i: number, patch: Partial<Multicouche>) => {
    const m = multicouchesDe(ctx)[i];
    if (!m) return;
    set({
      ...(patch.nom !== undefined ? { materiels: ctx.materiels.map(x => x.id === m.id ? { ...x, nom: patch.nom! } : x) } : {}),
      optMls: { ...ctx.optMls, [m.id]: { prefixe: patch.prefixe ?? m.prefixe, vlans: patch.vlans ?? m.vlans } },
    });
  };
  /**
   * Modifier un switch d'acces.
   *
   * Le nom et le nombre de ports vont a l'inventaire, les VLAN et les
   * affectations a la surcouche, et la remontee au cablage : `mlsId`, `uplink`
   * et `portMls` sont trois facons de decrire un cable, et c'est desormais le
   * cable qui les porte.
   */
  const majAcces = (i: number, patch: Partial<AccessSwitch>) => {
    const sw = switchesDe(ctx)[i];
    if (!sw) return;
    const p: Partial<Ctx> = {};
    if (patch.name !== undefined || patch.ports !== undefined) {
      p.materiels = ctx.materiels.map(x => x.id === sw.id
        ? { ...x, ...(patch.name !== undefined ? { nom: patch.name } : {}), ...(patch.ports !== undefined ? { ports: patch.ports } : {}) } : x);
    }
    if (patch.vlans !== undefined || patch.ports_ !== undefined) {
      p.optSwitches = { ...ctx.optSwitches, [sw.id]: { vlans: patch.vlans ?? sw.vlans, ports_: patch.ports_ ?? sw.ports_ } };
    }
    if (patch.mlsId !== undefined || patch.uplink !== undefined || patch.portMls !== undefined) {
      const vers = patch.mlsId ?? sw.mlsId;
      // Un switch sans remontee a `uplink` et `portMls` a zero : les reprendre
      // tels quels fabriquerait un cable sur le port 0, qui n'existe nulle part.
      // On prend alors le premier port libre de chaque cote.
      const libre = (id: string, defaut: number) => {
        const m = ctx.materiels.find(x => x.id === id);
        return m ? (portsLibres(m, ctx.cables)[0] ?? defaut) : defaut;
      };
      const mien = patch.uplink ?? (sw.uplink || libre(sw.id, 1));
      const sien = patch.portMls ?? (sw.portMls || libre(vers, 1));
      const autres = ctx.cables.filter(c => !((c.deId === sw.id && c.versId === sw.mlsId) || (c.versId === sw.id && c.deId === sw.mlsId)));
      p.cables = vers ? [...autres, { id: uid('cab'), deId: vers, dePort: sien, versId: sw.id, versPort: mien, media: 'croise' as Media }] : autres;
    }
    set(p);
  };
  const switches = useMemo(() => buildSwitchConfigs(ctx, plan), [ctx, plan]);
  const mlsPlan = useMemo(() => buildMlsPlan(ctx, plan), [ctx, plan]);
  /**
   * Le multicouche est-il en jeu ?
   *
   * La question se decidait a une case a cocher, qui pouvait contredire les
   * donnees : cinq sous-reseaux designaient une SVI comme passerelle pendant
   * que la case disait le contraire, et trois ecrans les ignoraient.
   * Un sous-reseau qui designe un multicouche suffit desormais a le mettre en jeu.
   */
  const mlsEnJeu = ctx.mlsActif || ctx.services.some(x => !!x.svi);
  const mlsTables = useMemo(() => dossierMls(mlsPlan), [mlsPlan]);
  // Rien n'est redemande ici : le DNS, le domaine et le bail viennent des ecrans
  // DNS et DHCP. Deux endroits pour la meme valeur finiraient par diverger.
  const mlsClients: AccesClients = useMemo(() => ({
    dns: (ctx.dnsServer || '').trim(),
    domaine: (ctx.domaine || '').trim(),
    bailJours: Number(ctx.leaseDays) || 7,
    site: ctx.mlsSite && ctx.mlsSite.nom && ctx.mlsSite.ip ? ctx.mlsSite : undefined,
  }), [ctx.dnsServer, ctx.domaine, ctx.leaseDays, ctx.mlsSite]);
  const nat = useMemo(() => buildNat(ctx, plan), [ctx, plan]);
  const natTable = useMemo(() => buildNatTable(ctx, plan, nat), [ctx, plan, nat]);
  const tests = useMemo(() => buildTests(ctx, plan, nat), [ctx, plan, nat]);
  const resetText = buildReset();
  const tout = useMemo(() => buildTout(ctx, plan), [ctx, plan]);
  const segmentsSortie = segmentsDeSortie(ctx, plan);
  // La sortie telle qu'elle part en configuration : adresses du segment adopte,
  // ou saisie a la main. Tout ce qui suit doit lire celle-ci, pas ctx.mlsSortie.
  const sortie = ctx.mlsSortie ? sortieEffective(ctx.mlsSortie, segmentsSortie) : null;
  const sortieAdoptee = !!ctx.mlsSortie?.segmentId && segmentsSortie.some(z => z.id === ctx.mlsSortie!.segmentId);

  const lanSubs = plan.subs.filter(s => s.kind === 'lan');
  const linkSubs = plan.subs.filter(s => s.kind === 'link');
  const ifaceFor = (routerId: string, ip: number) => plan.ifaces.find(i => i.routerId === routerId && i.ip === ip);
  // Étape 4 scindée en sous-vues (mode app) ; sans section4 (îlot CMS) tout s'affiche.
  const s4 = (v: 'schema' | 'routeurs' | 'nat') => !section4 || section4 === v;

  return (
    <div style={{ margin: '14px 0' }}>
      {/* Stepper (masqué quand une navigation externe pilote les étapes, ex. sidebar Atelier) */}
      {showStepper && (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {STEPS.map((s, i) => {
          const active = step === s.n;
          return (
            <button key={s.n} type="button" onClick={() => setStep(s.n)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent)' : 'var(--surface)', color: active ? '#fff' : 'var(--text)' }}>
              <span style={{ opacity: active ? 1 : .85 }}>{s.icon}</span>
              <span>{i + 1}. {s.title}</span>
            </button>
          );
        })}
        <button type="button" onClick={resetCtx} title="Repartir d’un atelier vierge (efface le contexte enregistré)"
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-soft)' }}>↺ Réinitialiser</button>
      </div>
      )}

      {/* ── Étape 1 : Contexte ── */}
      {/* ── Étape « Par matériel » : le schéma unique, puis toutes les commandes de chaque équipement ── */}
      {step === 12 && (
        <div>
          <div style={group}>
            <div style={legend}>
              🧰 Par matériel
              <button type="button" onClick={() => copy('toutMat', tout.filter(t => t.full).map(t => `! ═══ ${t.nom} (${t.type}${t.modele ? ' ' + t.modele : ''}) ═══\n${t.full}`).join('\n\n\n'))}
                style={{ ...btn, marginLeft: 'auto' }}>{copied === 'toutMat' ? '✓ Copié' : 'Tout copier'}</button>
            </div>
            <div className="meta" style={{ fontSize: 11.5 }}>
              Un seul schéma — l'inventaire physique et le câblage — puis, sous chaque équipement, <strong>toutes ses
              commandes</strong>, prêtes à coller dans son terminal. Clique la <strong>⚙</strong> d'un équipement pour
              configurer finement ses ports (VLAN d'accès ou trunk, port par port).
            </div>
          </div>

          <div style={group}>
            <div style={legend}>
              🗺️ Schéma & câblage
              <span className="meta" style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 400 }}>
                {ctx.materiels.length} équipement(s) · {ctx.cables.length} lien(s)
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {(['routeur', 'multicouche', 'switch', 'serveur', 'poste', 'nuage'] as TypeMateriel[]).map(t => (
                <button key={t} type="button" style={smallBtn}
                  onClick={() => set({ materiels: [...ctx.materiels, {
                    id: 'mat' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
                    nom: t.charAt(0).toUpperCase() + t.slice(1) + '-' + (ctx.materiels.filter(m => m.type === t).length + 1),
                    type: t, modele: '', ports: PORTS_TYPIQUES[t],
                  }] })}>+ {t}</button>
              ))}
            </div>
            <SchemaAtelier
              materiels={ctx.materiels} cables={ctx.cables} positions={ctx.physPos}
              interfaces={ifacesSchema} nomPort={(m, p) => nomPortDe(ctx, m, p)}
              onPos={(id, q) => set({ physPos: q ? { ...ctx.physPos, [id]: q } : Object.fromEntries(Object.entries(ctx.physPos).filter(([k]) => k !== id)) })}
              onCable={c => set({ cables: [...ctx.cables, c] })}
              onRetirer={id => set({ cables: ctx.cables.filter(x => x.id !== id) })}
              onOuvrir={setDialMat}
              onReplacerTout={() => set({ physPos: {} })}
              onRestaurer={restaurerSchema} />
            <div className="meta" style={{ fontSize: 11, marginTop: 5 }}>
              Un clic sur un équipement, un clic sur un autre : le câble se tire. <strong>Double-clic</strong> pour le
              replacer. La <strong>⚙</strong> ouvre sa configuration fine.
            </div>
          </div>

          {tout.map(t => {
            const m = ctx.materiels.find(x => x.id === t.id)!;
            return (
              <div key={t.id} style={group}>
                <div style={legend}>
                  <PictoMateriel type={m.type} /> {t.nom}
                  <span className="meta" style={{ fontSize: 11.5, fontWeight: 400 }}>
                    {m.type}{t.modele ? ' · ' + t.modele : ''} · {m.ports} ports
                  </span>
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <button type="button" onClick={() => setDialMat(t.id)} style={smallBtn}>⚙ Configurer</button>
                    {!!t.full && <button type="button" onClick={() => copy('mat:' + t.id, t.full)} style={btn}>{copied === 'mat:' + t.id ? '✓ Copié' : 'Copier'}</button>}
                  </span>
                </div>
                {t.blocs.length ? (
                  <>
                    {/* Un seul bloc, à coller d'un trait. Les bannières en
                        commentaire découpent les sections ; le sommaire les
                        annonce sans qu'on ait à lire tout le terminal. */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                      {t.blocs.map((b, bi) => (
                        <span key={bi} className="meta" style={{ fontSize: 11, padding: '1px 8px', borderRadius: 999, border: '1px solid var(--border)' }}>{b.titre}</span>
                      ))}
                    </div>
                    <pre style={preStyle}><code>{t.full}</code></pre>
                  </>
                ) : (
                  <div className="meta" style={{ fontSize: 12 }}>
                    Équipement d'extrémité — aucune commande Cisco à générer. Son adressage se lit dans le plan.
                  </div>
                )}
              </div>
            );
          })}

          {!ctx.materiels.length && (
            <div style={group}>
              <div className="meta" style={{ fontSize: 12.5 }}>
                Aucun équipement. Ajoute un routeur, un multicouche, des switches ci-dessus — leurs commandes
                apparaîtront ici, prêtes à coller.
              </div>
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div>
          <div style={group}>
            <div style={legend}>🧾 Contexte de l’exercice</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
              <div><label style={label}>Nom de l’entreprise</label><input style={field} value={ctx.entreprise} onChange={e => set({ entreprise: e.target.value })} placeholder="Miyukini" /></div>
              <div><label style={label}>Nom de domaine</label><input style={field} value={ctx.domaine} onChange={e => set({ domaine: e.target.value })} placeholder="miyukini.lan" /></div>
              <div>
                <label style={label}>Infrastructure</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['neuf', 'extension'] as const).map(m => (
                    <button key={m} type="button" onClick={() => set({ mode: m })} style={{ flex: 1, padding: '7px 8px', border: `1px solid ${ctx.mode === m ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, background: ctx.mode === m ? 'var(--accent)' : 'var(--surface)', color: ctx.mode === m ? '#fff' : 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: 12.5 }}>{m === 'neuf' ? '🌱 Neuve' : '🧩 Extension'}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={group}>
            <div style={legend}>🌐 Réseaux de base (blocs d’adresses à découper)</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 420 }}>
                <thead><tr><th style={th}>Nom</th><th style={th}>Réseau (IP)</th><th style={th}>CIDR</th><th style={th}></th></tr></thead>
                <tbody>
                  {bases.map(b => (
                    <tr key={b.id}>
                      <td style={td}><input style={field} value={b.name} onChange={e => setBase(b.id, { name: e.target.value })} placeholder="Site A" /></td>
                      <td style={td}><input style={{ ...field, ...mono, width: 150 }} value={b.ip} onChange={e => setBase(b.id, { ip: e.target.value })} placeholder="192.168.10.0" /></td>
                      <td style={{ ...td, width: 80 }}><input style={{ ...field, ...mono }} value={b.cidr} onChange={e => setBase(b.id, { cidr: e.target.value.replace(/\D/g, '') })} placeholder="24" /></td>
                      <td style={{ ...td, width: 40 }}><button type="button" onClick={() => delBase(b.id)} disabled={bases.length <= 1} style={{ ...smallBtn, color: bases.length <= 1 ? 'var(--text-muted)' : '#dc2626', borderColor: 'transparent', opacity: bases.length <= 1 ? .4 : 1 }} title="Supprimer">✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addBase} style={{ ...btn, marginTop: 10 }}>+ Ajouter un réseau de base</button>
            <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>Ajoute plusieurs blocs distincts (ex. un par site : <code>192.168.10.0/24</code>, <code>10.0.0.0/24</code>…). Chaque sous-réseau est ensuite découpé (VLSM) <strong>dans le bloc que tu lui assignes</strong> ci-dessous.</div>
          </div>

          <div style={group}>
            <div style={legend}>🧩 Sous-réseaux / services (besoin en hôtes)</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 380 }}>
                <thead><tr><th style={th}>Service / sous-réseau</th><th style={th}>Hôtes</th>{bases.length > 1 && <th style={th}>Réseau de base</th>}<th style={th}></th></tr></thead>
                <tbody>
                  {ctx.services.map(s => (
                    <tr key={s.id}>
                      <td style={td}><input style={field} value={s.name} onChange={e => setSvc(s.id, { name: e.target.value })} /></td>
                      <td style={{ ...td, width: 90 }}><input style={{ ...field, ...mono }} value={s.hosts} onChange={e => setSvc(s.id, { hosts: e.target.value.replace(/\D/g, '') })} /></td>
                      {bases.length > 1 && <td style={{ ...td, width: 150 }}><select style={field} value={s.baseId || bases[0].id} onChange={e => setSvc(s.id, { baseId: e.target.value })}>{bases.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></td>}
                      <td style={{ ...td, width: 40 }}><button type="button" onClick={() => delSvc(s.id)} style={{ ...smallBtn, color: '#dc2626', borderColor: 'transparent' }} title="Supprimer">✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addSvc} style={{ ...btn, marginTop: 10 }}>+ Ajouter un sous-réseau</button>
            <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>Le nombre d’hôtes pilote le découpage VLSM à l’étape 3. La topologie (routeurs, liaisons) et l’attribution se règlent aussi à l’étape 3.</div>
          </div>
          <StepNav step={step} setStep={setStep} />
        </div>
      )}

      {/* ── Étape 2 : Préférences ── */}
      {step === 2 && (
        <div>
          <div style={group}>
            <div style={legend}>🔐 Identifiants standards (Cisco)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }}>
              <div><label style={label}>Login admin</label><input style={field} value={ctx.login} onChange={e => set({ login: e.target.value })} placeholder="admin" /></div>
              <div><label style={label}>Mot de passe</label><input style={field} value={ctx.mdp} onChange={e => set({ mdp: e.target.value })} placeholder="Azerty77" /></div>
              <div><label style={label}>Enable secret</label><input style={field} value={ctx.secret} onChange={e => set({ secret: e.target.value })} placeholder="MonSecretEnable" /></div>
              <div><label style={label}>Serveur DNS</label><input style={{ ...field, ...mono }} value={ctx.dnsServer} onChange={e => set({ dnsServer: e.target.value })} placeholder="192.168.10.11" /></div>
              <div><label style={label}>Serveur DHCP (relais)</label><input style={{ ...field, ...mono }} value={ctx.dhcpServer} onChange={e => set({ dhcpServer: e.target.value })} placeholder="192.168.10.11" /></div>
            </div>
            <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>Le <strong>serveur DHCP</strong> héberge les étendues ; les routeurs relaieront les requêtes vers cette IP via <code>ip helper-address</code>.</div>
          </div>
          <div style={group}>
            <div style={legend}>📐 Convention d’adressage (pattern IP fixe)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 14 }}>
              <div>
                <label style={label}>Passerelle (routeur)</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {([['last', 'Fin de plage'], ['first', 'Début de plage']] as const).map(([v, t]) => (
                    <button key={v} type="button" onClick={() => set({ gwPos: v })} style={{ flex: 1, padding: '7px 8px', border: `1px solid ${ctx.gwPos === v ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, background: ctx.gwPos === v ? 'var(--accent)' : 'var(--surface)', color: ctx.gwPos === v ? '#fff' : 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={label}>IP de gestion du switch</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {([['beforeRouter', 'Juste avant le routeur'], ['firstHost', 'Début de plage']] as const).map(([v, t]) => (
                    <button key={v} type="button" onClick={() => set({ switchPos: v })} style={{ flex: 1, padding: '7px 8px', border: `1px solid ${ctx.switchPos === v ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, background: ctx.switchPos === v ? 'var(--accent)' : 'var(--surface)', color: ctx.switchPos === v ? '#fff' : 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>{t}</button>
                  ))}
                </div>
              </div>
              <div><label style={label}>Masque des liaisons inter-routeurs (CIDR)</label><input style={{ ...field, ...mono }} value={ctx.linkCidr} onChange={e => set({ linkCidr: e.target.value.replace(/\D/g, '') })} placeholder="30" /></div>
              <div><label style={label}>Bail DHCP (jours)</label><input style={{ ...field, ...mono }} value={ctx.leaseDays} onChange={e => set({ leaseDays: e.target.value.replace(/\D/g, '') })} placeholder="7" /></div>
            </div>
            <div className="meta" style={{ fontSize: 11.5, marginTop: 10 }}>Convention appliquée : <strong>clients</strong> en début de plage (DHCP), <strong>switch</strong> puis <strong>routeur</strong> en fin de plage. Les <strong>liaisons série</strong> utilisent un /{clampNum(Number(ctx.linkCidr) || 30, 8, 30)} (2 hôtes) ; les <strong>segments Ethernet</strong> sont dimensionnés au nombre de routeurs qu’ils relient.</div>
          </div>
          <StepNav step={step} setStep={setStep} />
        </div>
      )}

      {/* ── Étape 3 : Segmentation ── */}
      {step === 3 && (
        <div>
          <div style={group}>
            <div style={legend}>🧭 Routeurs</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 340 }}>
                <thead><tr><th style={th}>Nom</th><th style={th}>Modèle</th><th style={th}>Interfaces</th><th style={th}></th></tr></thead>
                <tbody>
                  {routeursDe(ctx).map(r => (
                    <tr key={r.id}>
                      <td style={td}><input style={{ ...field, width: 90 }} value={r.name} onChange={e => setRtr(r.id, { name: e.target.value.replace(/\s+/g, '') })} /></td>
                      <td style={td}>
                        <select style={{ ...field, width: 110 }} value={r.model} onChange={e => setRtr(r.id, { model: e.target.value as RouterModel })}>
                          <option value="2911">2911 (Gig)</option>
                          <option value="2811">2811 (Fa)</option>
                        </select>
                      </td>
                      <td style={{ ...td, color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, cursor: 'pointer', color: 'var(--text)' }} title={`Ajoute une carte réseau en slot 1 : ${ethModule(r.model).map(ifAbbr).join(', ')}`}>
                            <input type="checkbox" checked={!!r.mod} onChange={e => setRtr(r.id, { mod: e.target.checked })} /> module slot 1 <span style={{ color: 'var(--accent)', fontWeight: 600 }}>(+{ethModule(r.model).map(ifAbbr).join(', ')})</span>
                          </label>
                          <span style={{ fontSize: 11, ...mono }}>{ethSlots(r.model, r.mod).map(ifAbbr).join(' · ')} + série</span>
                        </div>
                      </td>
                      <td style={{ ...td, width: 40 }}><button type="button" onClick={() => delRtr(r.id)} style={{ ...smallBtn, color: '#dc2626', borderColor: 'transparent' }} title="Supprimer">✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addRtr} style={{ ...btn, marginTop: 10 }}>+ Ajouter un routeur</button>
          </div>

          <div style={group}>
            <div style={legend}>🔀 Assignation des sous-réseaux</div>
            <div className="meta" style={{ fontSize: 11.5, margin: '0 0 12px' }}>
              Qui porte la passerelle de chaque sous-réseau ? <strong>1 routeur</strong> = LAN classique ;
              <strong> 1 multicouche</strong> 🗼 = la passerelle est une <strong>interface Vlan</strong> (SVI) et non une
              sous-interface de routeur ; <strong>2 équipements ou plus</strong> = segment d’interconnexion, une IP de
              chaque côté. Le <strong>numéro de VLAN</strong> à droite décide de la suite : rempli, le sous-réseau
              partage un lien physique avec les autres ; vide, il garde une interface à lui.
            </div>
            {ctx.services.map(s => {
              const transit = s.routerIds.length + (s.svi && s.routerIds.length >= 1 ? 1 : 0) >= 2;
              const badge = transit ? { t: `🔗 interconnexion · ${s.routerIds.length + (s.svi ? 1 : 0)} equipements`, c: 'var(--accent)', bg: 'color-mix(in srgb,var(--accent) 15%,transparent)' }
                : s.routerIds.length === 1 ? { t: '🖥️ LAN', c: 'var(--text-muted)', bg: 'var(--surface-3)' }
                : s.svi ? { t: `🗼 SVI ${multicouchesDe(ctx).find(m => m.id === s.svi)?.nom ?? ''}`.trim(), c: '#14b8a6', bg: 'color-mix(in srgb,#14b8a6 15%,transparent)' }
                : { t: '⚠ aucune passerelle', c: '#dc2626', bg: 'color-mix(in srgb,#dc2626 12%,transparent)' };
              return (
                <div key={s.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', marginBottom: 10, background: 'var(--surface)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                    <strong style={{ fontSize: 13.5 }}>{s.name}</strong>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)', ...mono }}>{s.hosts} hôtes</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 9px', borderRadius: 999, color: badge.c, background: badge.bg }}>{badge.t}</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, alignItems: 'center' }}>
                      <label style={{ fontSize: 12, display: 'flex', gap: 5, alignItems: 'center', cursor: transit ? 'not-allowed' : 'pointer', opacity: transit ? .4 : 1 }} title={transit ? 'Pas de VLAN sur un segment d’interconnexion' : 'Identifiant 802.1Q (1-4094) — vide = interface physique dédiée'}>
                        VLAN
                        <input type="text" inputMode="numeric" disabled={transit} value={transit ? '' : (s.vlan ?? '')} onChange={e => setSvc(s.id, { vlan: e.target.value.replace(/[^0-9]/g, '').slice(0, 4) })} placeholder="—" style={{ width: 52, padding: '2px 6px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 5, background: 'var(--surface)', color: 'inherit', ...mono }} />
                      </label>
                      <label style={{ fontSize: 12, display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={s.hasSwitch} onChange={e => setSvc(s.id, { hasSwitch: e.target.checked })} /> switch</label>
                      <label style={{ fontSize: 12, display: 'flex', gap: 5, alignItems: 'center', cursor: transit ? 'not-allowed' : 'pointer', opacity: transit ? .4 : 1 }} title={transit ? 'Pas de DHCP sur un segment d’interconnexion' : ''}><input type="checkbox" disabled={transit} checked={s.dhcp && !transit} onChange={e => setSvc(s.id, { dhcp: e.target.checked })} /> DHCP</label>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {routeursDe(ctx).map(r => {
                      const on = s.routerIds.includes(r.id);
                      const ord = s.routerIds.indexOf(r.id);
                      const tag = on && transit && s.media === 'serial' ? (ord === 0 ? 'DCE · ' : 'DTE · ') : '';
                      return <button key={r.id} type="button" onClick={() => toggleSvcRouter(s.id, r.id)} style={{ padding: '4px 11px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 600, border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent)' : 'var(--surface)', color: on ? '#fff' : 'var(--text)' }}>{tag}{r.name}</button>;
                    })}
                    {/* Les multicouches : l'autre facon de porter la passerelle. Le choix est
                        exclusif — un reseau n'a qu'une passerelle, et en declarer deux, c'est
                        en declarer deux. */}
                    {multicouchesDe(ctx).map(m => {
                      const on = s.svi === m.id;
                      return (
                        <button key={m.id} type="button"
                          title={`La SVI de ${m.nom} porte la passerelle de ce sous-reseau`}
                          onClick={() => setSvc(s.id, on
        ? { svi: undefined }
        // Sur un LAN, la SVI remplace le routeur : une seule passerelle.
        // Sur un segment d'interconnexion, elle s'y ajoute : le lien a deux bouts.
        : { svi: m.id, ...(s.routerIds.length >= 1 ? {} : { routerIds: [] }) })}
                          style={{ padding: '4px 11px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                            border: `1px solid ${on ? '#14b8a6' : 'var(--border)'}`,
                            background: on ? '#14b8a6' : 'var(--surface)', color: on ? '#fff' : 'var(--text)' }}>
                          🗼 {m.nom}
                        </button>
                      );
                    })}
                    {routeursDe(ctx).length === 0 && <span className="meta" style={{ fontSize: 11.5 }}>Ajoute d’abord des routeurs ci-dessus.</span>}
                    {transit && <select style={{ ...field, width: 165, marginLeft: 6 }} value={s.media || 'gig'} onChange={e => setSvc(s.id, { media: e.target.value as LinkMedia })}>
                      <option value="gig">Ethernet (switch)</option>
                      <option value="serial" disabled={s.routerIds.length !== 2}>Série (2 routeurs)</option>
                    </select>}
                  </div>
                </div>
              );
            })}
            {!ctx.services.length && <div className="meta">Ajoute des sous-réseaux à l’étape 1.</div>}
          </div>

          {/* Résultats */}
          {plan.error && <div style={{ ...group, borderColor: '#dc2626', background: 'color-mix(in srgb,#dc2626 8%,transparent)' }}><strong style={{ color: '#dc2626' }}>⚠ {plan.error}</strong></div>}
          {!!plan.warnings.length && (
            <div style={{ ...group, borderColor: '#ca8a04', background: 'color-mix(in srgb,#ca8a04 8%,transparent)' }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>⚠ À vérifier</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>{plan.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          )}

          <div style={group}>
            <div style={legend}>
              📋 Plan d’adressage — {plan.subs.length} sous-réseaux
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>{plan.bases.length > 1 ? `${plan.bases.length} réseaux · ${plan.used}/${plan.totalAddr} adr.` : `${ipToStr(plan.baseNet)}/${plan.cidr} · ${plan.used}/${plan.totalAddr} adr.`}</span>
                {(['cartes', 'tableau'] as const).map(v => (
                  <button key={v} type="button" onClick={() => setVuePlan(v)}
                    style={{ ...smallBtn, borderColor: vuePlan === v ? 'var(--accent)' : 'var(--border)', color: vuePlan === v ? 'var(--accent)' : 'var(--text-soft)' }}>{v}</button>
                ))}
              </div>
            </div>

            {vuePlan === 'cartes' ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {plan.subs.map(sub => {
                  const svc = ctx.services.find(x => 'svc:' + x.id === sub.id);
                  const vlan = sub.vlan ?? null;
                  const couleur = vlan !== null ? couleurVlan(vlan, mlsPlan.vlans.map(v => v.id)) : 'var(--border)';
                  const routeur = sub.routerId ? routeursDe(ctx).find(r => r.id === sub.routerId) : undefined;
                  const iface = routeur && sub.gw !== null ? ifaceFor(routeur.id, sub.gw) : undefined;
                  const mls = svc?.svi ? multicouchesDe(ctx).find(m => m.id === svc.svi) : undefined;
                  // Ou vit ce VLAN, d'apres le cablage : c'est la question qu'on se
                  // pose devant un poste qui ne pingue pas, et elle n'etait nulle part.
                  const sur = vlan === null ? [] : switchesDe(ctx).filter(w => w.vlans.includes(vlan));
                  const demande = Math.max(0, Number(svc?.hosts) || 0);
                  const trop = demande > sub.usable;
                  const remplissage = sub.usable ? Math.min(100, (demande / sub.usable) * 100) : 0;
                  const ligne = (k: string, v: React.ReactNode) => (
                    <div style={{ display: 'flex', gap: 6, fontSize: 12 }}>
                      <span style={{ color: 'var(--text-muted)', minWidth: 74 }}>{k}</span>
                      <span style={{ ...mono }}>{v}</span>
                    </div>
                  );
                  return (
                    <div key={sub.id} style={{ border: '1px solid var(--border)', borderLeft: `4px solid ${couleur}`, borderRadius: 10, padding: '10px 13px', background: 'var(--surface)' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                        {vlan !== null && (
                          <span style={{ fontSize: 11.5, fontWeight: 700, padding: '1px 9px', borderRadius: 999, color: '#fff', background: couleur }}>VLAN {vlan}</span>
                        )}
                        <strong style={{ fontSize: 14 }}>{sub.kind === 'link' ? '🔗 ' : ''}{sub.name}</strong>
                        <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 700, ...mono }}>{ipToStr(sub.net)}/{sub.cidr}</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))', gap: '3px 18px' }}>
                        {ligne('Masque', ipToStr(sub.mask))}
                        {ligne('Passerelle', sub.gw !== null
                          ? <>{ipToStr(sub.gw)} <span style={{ color: 'var(--text-muted)' }}>{routeur ? `· ${routeur.name}${iface ? ' ' + ifAbbr(iface.iface) : ''}` : ''}</span></>
                          : mls ? <span style={{ color: '#14b8a6' }}>SVI {mls.nom} · interface Vlan{vlan ?? '?'}</span>
                          : <span style={{ color: '#dc2626' }}>aucune</span>)}
                        {ligne('Plage', `${ipToStr(sub.first)} – ${ipToStr(sub.last)}`)}
                        {ligne('Switch', sub.switchIp !== null ? ipToStr(sub.switchIp) : '—')}
                        {ligne('Broadcast', ipToStr(sub.bc))}
                        {ligne('DHCP', sub.dhcp ? 'oui' : 'statique')}
                      </div>

                      {/* On ne parle des switches que s'il y en a : sans switch
                          d'accès déclaré, un montage router-on-a-stick est normal,
                          et annoncer un manque serait accuser à tort. */}
                      {vlan !== null && switchesDe(ctx).length > 0 && (
                        <div style={{ fontSize: 11.5, marginTop: 7, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Présent sur</span>
                          {sur.length ? sur.map(w => (
                            <span key={w.id} style={{ padding: '1px 8px', borderRadius: 999, border: `1px solid ${couleur}`, color: 'var(--text)' }}>
                              🗄️ {w.name}{w.mlsId ? '' : ' ⚠ non câblé'}
                            </span>
                          )) : <span style={{ color: '#ca8a04' }}>aucun switch ne porte ce VLAN — ses postes n’auront aucun port où se brancher</span>}
                        </div>
                      )}

                      {sub.kind === 'lan' && (
                        <div style={{ marginTop: 7 }}>
                          <div style={{ height: 5, borderRadius: 3, background: 'var(--surface-3)', overflow: 'hidden' }}>
                            <div style={{ width: `${remplissage}%`, height: '100%', background: trop ? '#dc2626' : couleur }} />
                          </div>
                          <div style={{ fontSize: 11, marginTop: 3, color: trop ? '#dc2626' : 'var(--text-muted)' }}>
                            {trop
                              ? `⚠ ${demande} hôtes demandés pour ${sub.usable} adresses disponibles — le bloc est trop petit.`
                              : `${demande} hôtes demandés · ${sub.usable} adresses disponibles`}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {!plan.subs.length && <div className="meta">Ajoute des sous-réseaux à l’étape 1.</div>}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 720 }}>
                  <thead><tr><th style={th}>VLAN</th><th style={th}>Sous-réseau</th><th style={th}>Réseau/CIDR</th><th style={th}>Masque</th><th style={th}>Plage utilisable</th><th style={th}>Broadcast</th><th style={th}>Passerelle</th><th style={th}>Switch</th><th style={th}>Hôtes</th></tr></thead>
                  <tbody>
                    {plan.subs.map(sub => (
                      <tr key={sub.id}>
                        <td style={{ ...td, ...mono }}>{sub.vlan ?? '—'}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{sub.kind === 'link' ? '🔗 ' : ''}{sub.name}</td>
                        <td style={{ ...td, ...mono }}>{ipToStr(sub.net)}/{sub.cidr}</td>
                        <td style={{ ...td, ...mono }}>{ipToStr(sub.mask)}</td>
                        <td style={{ ...td, ...mono }}>{ipToStr(sub.first)} – {ipToStr(sub.last)}</td>
                        <td style={{ ...td, ...mono }}>{ipToStr(sub.bc)}</td>
                        <td style={{ ...td, ...mono }}>{sub.gw !== null ? ipToStr(sub.gw) : '—'}</td>
                        <td style={{ ...td, ...mono }}>{sub.switchIp !== null ? ipToStr(sub.switchIp) : '—'}</td>
                        <td style={{ ...td, ...mono }}>{sub.usable}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={group}>
            <div style={legend}>
              🔌 Table d’adressage des interfaces
              <button type="button" onClick={() => copy('plan', planText)} style={{ ...btn, marginLeft: 'auto' }}>{copied === 'plan' ? '✓ Copié' : 'Copier le plan'}</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 620 }}>
                <thead><tr><th style={th}>Routeur</th><th style={th}>Interface</th><th style={th}>Cible</th><th style={th}>IP</th><th style={th}>Masque</th><th style={th}>Rôle</th></tr></thead>
                <tbody>
                  {plan.ifaces.map((i, k) => {
                    const key = `${i.routerId}|${i.iface}`;
                    const forced = !!(ctx.ifaceIps || {})[key];
                    return (
                    <tr key={k}>
                      <td style={{ ...td, fontWeight: 600 }}>{i.routerName}</td>
                      <td style={{ ...td, ...mono }}>{i.iface}</td>
                      <td style={td}>{i.target}</td>
                      <td style={td}>
                        <input value={(ctx.ifaceIps || {})[key] ?? ''} onChange={e => setIfaceIp(key, e.target.value)} placeholder={ipToStr(i.ip)}
                          title={forced ? 'IP forcée manuellement' : 'IP automatique — saisis une valeur pour la forcer'}
                          style={{ ...field, ...mono, width: 132, padding: '3px 7px', borderColor: forced ? 'var(--accent)' : 'var(--border)' }} />
                      </td>
                      <td style={{ ...td, ...mono }}>{ipToStr(i.mask)}</td>
                      <td style={{ ...td, color: 'var(--text-muted)' }}>{i.role}{i.clock ? ' · clock 64000' : ''}{forced ? ' · ✏️ manuel' : ''}</td>
                    </tr>
                  ); })}
                  {!plan.ifaces.length && <tr><td style={td} colSpan={6}>Ajoute des routeurs et assigne-les aux sous-réseaux.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>✏️ <strong>IP manuelle</strong> : saisis une adresse dans la colonne <em>IP</em> pour la <strong>forcer</strong> (vide = calcul automatique). La <strong>passerelle du LAN</strong>, les <strong>routes statiques</strong>, le <strong>relais DHCP</strong> et le <strong>DNS</strong> suivent automatiquement. Une IP hors du sous-réseau est ignorée (avertissement).</div>
            {ctx.mode === 'extension' && <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>ℹ️ Mode <strong>extension</strong> : vérifie que ces plages ne recouvrent pas l’existant avant de les intégrer.</div>}
          </div>

          <div style={group}>
            <div style={legend}>🖥️ Hôtes fixes (end-points : serveurs, postes)</div>
            <div className="meta" style={{ fontSize: 11.5, margin: '0 0 10px' }}>Attribue une <strong>IP statique</strong> à une machine terminale (ex. <em>admin</em> en <code>192.168.1.1</code>, serveur web…). L’outil <strong>valide</strong> l’adresse (dans le bon sous-réseau, pas déjà prise) et l’ajoute aux <strong>enregistrements DNS</strong>.</div>
            {(ctx.hosts || []).map((h, idx) => {
              const ph = plan.hosts.find(p => p.id === h.id);
              const bad = ph && !ph.ok;
              return (
                <div key={h.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,1.2fr) minmax(140px,1.4fr) minmax(120px,1fr) auto', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                  <input style={field} value={h.name} onChange={e => setHost(idx, { name: e.target.value })} placeholder="Nom (ex. srv-web)" />
                  <select style={field} value={h.subId} onChange={e => setHost(idx, { subId: e.target.value })}>
                    <option value="">— sous-réseau —</option>
                    {plan.subs.map(s => <option key={s.id} value={s.id}>{s.kind === 'link' ? '🔗 ' : ''}{s.name} ({ipToStr(s.net)}/{s.cidr})</option>)}
                  </select>
                  <input style={{ ...field, ...mono, borderColor: bad ? '#dc2626' : 'var(--border)' }} value={h.ip} onChange={e => setHost(idx, { ip: e.target.value })} placeholder="192.168.1.1" />
                  <button type="button" onClick={() => delHost(idx)} style={smallBtn}>✕</button>
                  {ph && ph.note && <div style={{ gridColumn: '1 / -1', fontSize: 11, marginTop: -2, color: bad ? '#dc2626' : 'var(--text-muted)' }}>{bad ? '⚠ ' : 'ℹ️ '}{ph.name || 'hôte'} : {ph.note}</div>}
                </div>
              );
            })}
            <button type="button" onClick={addHost} style={btn}>+ Hôte fixe</button>
            {!!plan.hosts.filter(h => h.ok).length && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                {plan.hosts.filter(h => h.ok).length} hôte(s) valide(s) — ajoutés au DNS ({ctx.domaine.trim() || 'lan'}).
              </div>
            )}
          </div>
          <StepNav step={step} setStep={setStep} />
        </div>
      )}

      {/* ── Étape 4 : Schéma ── */}
      {step === 4 && (
        <div>
          {s4('schema') && (<>
          {plan.error && <div style={{ ...group, borderColor: '#dc2626' }}><strong style={{ color: '#dc2626' }}>⚠ {plan.error}</strong></div>}
          <div style={group}>
            <div style={legend}>🗺️ Schéma du réseau</div>
            {mlsEnJeu ? (
              <>
                <SchemaMls ctx={ctx} plan={plan}
                  onPos={(id, q) => {
                    const suite = { ...ctx.mlsPos };
                    if (q) suite[id] = q; else delete suite[id];
                    set({ mlsPos: suite });
                  }} />
                <div className="meta" style={{ fontSize: 11.5, marginTop: 4 }}>
                  Glisse un equipement pour le placer · double-clic pour le remettre ou il etait
                  {Object.keys(ctx.mlsPos).length > 0 && (
                    <button type="button" style={{ ...smallBtn, marginLeft: 8 }}
                      onClick={() => set({ mlsPos: {} })}>Tout replacer</button>
                  )}
                </div>
              </>
            ) : <SchemaSvg ctx={ctx} plan={plan} />}
            <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>Vue topologie : une <strong>dorsale</strong> de routeurs reliés par leurs <strong>segments/switches</strong> ; chaque sous-réseau est un <strong>nuage</strong> (switch + machines) rattaché à son routeur-passerelle, avec l’interface, l’idSR/CIDR, la passerelle et l’IP du switch.</div>
          </div>

          <div style={group}>
            <div style={legend}>🧱 Détail par sous-réseau ({lanSubs.length})</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
              {lanSubs.map(s => {
                const cr = clientRange(ctx, s);
                const ifc = s.gw !== null ? ifaceFor(s.routerId || '', s.gw) : undefined;
                return (
                  <div key={s.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '11px 13px', background: 'var(--surface)' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{s.name}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 8px', fontSize: 12.5, ...mono }}>
                      <span style={{ color: 'var(--text-muted)' }}>idSR</span><span>{ipToStr(s.net)}/{s.cidr}</span>
                      <span style={{ color: 'var(--text-muted)' }}>masque</span><span>{ipToStr(s.mask)}</span>
                      <span style={{ color: 'var(--text-muted)' }}>broadcast</span><span>{ipToStr(s.bc)}</span>
                      <span style={{ color: 'var(--text-muted)' }}>passerelle</span><span>{s.gw !== null ? ipToStr(s.gw) : '—'}{ifc ? ` (${ifc.iface})` : ''}</span>
                      {s.switchIp !== null && (<><span style={{ color: 'var(--text-muted)' }}>switch</span><span>{ipToStr(s.switchIp)}</span></>)}
                      <span style={{ color: 'var(--text-muted)' }}>clients</span><span>{cr ? `${ipToStr(cr[0])} – ${ipToStr(cr[1])}` : '—'}</span>
                    </div>
                    {(() => { const hs = plan.hosts.filter(h => h.subId === s.id && h.ip !== null); return hs.length ? (
                      <div style={{ marginTop: 6, borderTop: '1px dashed var(--border)', paddingTop: 5, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 8px', fontSize: 12, ...mono }}>
                        {hs.map(h => (<Fragment key={h.id}><span style={{ color: h.ok ? 'var(--text-muted)' : '#dc2626' }}>{h.ok ? '📌' : '⚠'} {h.name || 'hôte'}</span><span style={{ color: h.ok ? 'var(--text)' : '#dc2626' }}>{ipToStr(h.ip!)}</span></Fragment>))}
                      </div>
                    ) : null; })()}
                    <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>{s.dhcp ? '📶 DHCP' : '📌 statique'} · {routeursDe(ctx).find(r => r.id === s.routerId)?.name || 'sans routeur'}</div>
                  </div>
                );
              })}
              {!lanSubs.length && <div className="meta">Définis des sous-réseaux à l’étape 1 et une topologie à l’étape 3.</div>}
            </div>
          </div>
          </>)}

          {s4('routeurs') && (<>
          <div style={group}>
            <div style={legend}>
              🧨 Étape 0 — Réinitialiser (matériel réutilisé)
              <button type="button" onClick={() => copy('reset', resetText)} style={{ ...smallBtn, marginLeft: 'auto' }}>{copied === 'reset' ? '✓ Copié' : 'Copier'}</button>
            </div>
            <div className="meta" style={{ fontSize: 11.5, margin: '0 0 8px' }}>Sur un routeur/switch déjà utilisé, une config parasite (routes, ACL, VLAN) peut tout bloquer. À passer <strong>avant</strong> toute configuration. Aux invites : <em>« Save? [yes/no] »</em> → <code>no</code>, <em>« Proceed with reload? [confirm] »</em> → <kbd>Entrée</kbd>. Sur un switch, faire aussi <code>delete flash:vlan.dat</code> avant le <code>reload</code>.</div>
            <pre style={preStyle}><code>{resetText}</code></pre>
          </div>

          <div style={group}>
            <div style={legend}>
              📟 Configuration complète des routeurs (à coller telle quelle)
              <button type="button" onClick={() => copy('rcfgAll', routerCfg.full)} style={{ ...btn, marginLeft: 'auto' }}>{copied === 'rcfgAll' ? '✓ Copié' : 'Tout copier'}</button>
            </div>
            {routerCfg.byRouter.map(b => (
              <div key={b.routerId} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                  <strong style={{ fontSize: 13 }}>🧭 {b.routerName}</strong>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginLeft: 8 }}>{b.routes} route(s) statique(s)</span>
                  <button type="button" onClick={() => copy('rcfg:' + b.routerId, b.text)} style={{ ...smallBtn, marginLeft: 'auto' }}>{copied === 'rcfg:' + b.routerId ? '✓ Copié' : 'Copier'}</button>
                </div>
                <pre style={preStyle}><code>{b.text}</code></pre>
              </div>
            ))}
            {!routerCfg.byRouter.length && <div className="meta">Ajoute des routeurs à l’étape 3.</div>}
            <div className="meta" style={{ fontSize: 11.5, marginTop: 4 }}><strong>Config complète</strong>, à coller telle quelle dans la CLI de chaque routeur : <strong>sécurité</strong> (<code>enable secret</code>, compte privilège 15, <code>service password-encryption</code>), <strong>interfaces</strong> (IP, <code>no shutdown</code>, <code>clock rate</code> DCE, <code>ip nat inside</code>, relais <code>ip helper-address</code>), <strong>routes statiques</strong> (plus court chemin) + route par défaut, <strong>NAT/PAT</strong> sur le routeur de bordure, et <strong>SSH</strong> (clé RSA, lignes vty/console). Le routeur de sortie NAT se choisit à l’onglet <strong>Internet / NAT</strong>.</div>
          </div>
          </>)}

          {s4('nat') && (<>
          <div style={group}>
            <div style={legend}>🌍 Sortie Internet / Firewall — NAT (statique · PAT · redirection de port)</div>
            <div className="meta" style={{ fontSize: 11.5, margin: '0 0 10px' }}>Choisis le routeur relié à l’extérieur (le « Firewall ») : l’outil génère le <strong>NAT statique (1:1)</strong>, le <strong>PAT (overload)</strong>, la <strong>route par défaut</strong> et la <strong>redirection de port</strong> d’un serveur web — de quoi réaliser un <strong>TP NAT complet</strong> (statique → surchargé → port forward).</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10, marginBottom: 10 }}>
              <div><label style={label}>Routeur de sortie</label>
                <select value={ctx.internetRouterId} onChange={e => set({ internetRouterId: e.target.value })} style={field}>
                  <option value="">— aucun (pas de NAT) —</option>
                  {routeursDe(ctx).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div><label style={label}>Interface WAN</label><input value={ctx.wanIf} onChange={e => set({ wanIf: e.target.value })} style={field} placeholder="GigabitEthernet0/1" /></div>
              <div><label style={label}>IP WAN</label><input value={ctx.wanIp} onChange={e => set({ wanIp: e.target.value })} style={field} placeholder="172.16.3.250" /></div>
              <div><label style={label}>CIDR WAN</label><input value={ctx.wanCidr} onChange={e => set({ wanCidr: e.target.value })} style={field} placeholder="24" /></div>
              <div><label style={label}>Passerelle FAI</label><input value={ctx.faiGw} onChange={e => set({ faiGw: e.target.value })} style={field} placeholder="172.16.3.254" /></div>
              <div><label style={label}>Serveur web (option)</label><input value={ctx.webIp} onChange={e => set({ webIp: e.target.value })} style={field} placeholder="192.5.10.12" /></div>
              <div><label style={label}>Port web</label><input value={ctx.webPort} onChange={e => set({ webPort: e.target.value })} style={field} placeholder="8080" /></div>
            </div>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, cursor: 'pointer', margin: '2px 0 10px' }}>
              <input type="checkbox" checked={ctx.natOverload} onChange={e => set({ natOverload: e.target.checked })} /> <b>PAT (overload)</b> — traduire tout le LAN derrière l’IP WAN <span className="meta" style={{ fontSize: 11 }}>(décoche pour du NAT statique seul, Partie 1 du TP)</span>
            </label>
            <div style={{ marginBottom: 10 }}>
              <label style={label}>NAT statique (1:1) — IP interne → IP publique</label>
              {(ctx.natStatics || []).map((s, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                  <input style={{ ...field, ...mono }} value={s.inside} onChange={e => setStat(idx, { inside: e.target.value })} placeholder="192.168.1.1 (interne)" />
                  <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>→</span>
                  <input style={{ ...field, ...mono }} value={s.pub} onChange={e => setStat(idx, { pub: e.target.value })} placeholder="45.25.23.101 (publique)" />
                  <button type="button" onClick={() => delStat(idx)} style={smallBtn}>✕</button>
                </div>
              ))}
              <button type="button" onClick={addStat} style={btn}>+ NAT statique</button>
            </div>
            {nat ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                  <strong style={{ fontSize: 13 }}>🧭 {nat.router}</strong>
                  <button type="button" onClick={() => copy('nat', nat.text)} style={{ ...smallBtn, marginLeft: 'auto' }}>{copied === 'nat' ? '✓ Copié' : 'Copier'}</button>
                </div>
                <pre style={preStyle}><code>{nat.text}</code></pre>
                <div className="meta" style={{ fontSize: 11.5, marginTop: 6 }}>⚠️ L’<strong>interface WAN</strong> doit être une interface <strong>libre</strong> de ce routeur (non utilisée par un sous-réseau). Le <strong>serveur web</strong> est publié en <code>ip nat inside source static tcp</code> ; le DNS ne portant pas de port, l’accès externe se fait par <code>http://&lt;IP WAN&gt;:{ctx.webPort || '80'}</code>.</div>
              </div>
            ) : <div className="meta">Sélectionne un <strong>routeur de sortie</strong> pour générer la configuration NAT/PAT.</div>}

            {!!natTable.length && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                  <strong style={{ fontSize: 13 }}>📋 Table de NAT prévisionnelle</strong>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginLeft: 8 }}>— pré-remplit le tableau 3 du dossier (<code>show ip nat translation</code>)</span>
                </div>
                <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2)' }}>
                        {['Pro', 'IP local inside', 'Port', 'IP global inside', 'Port', 'Commentaire'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '6px 9px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', fontWeight: 700 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {natTable.map((r, i) => (
                        <tr key={i} style={{ borderBottom: i < natTable.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <td style={{ padding: '5px 9px', ...mono, color: 'var(--text-muted)' }}>{r.proto}</td>
                          <td style={{ padding: '5px 9px', ...mono }}>{r.localInside}</td>
                          <td style={{ padding: '5px 9px', ...mono }}>{r.localPort}</td>
                          <td style={{ padding: '5px 9px', ...mono }}>{r.globalInside}</td>
                          <td style={{ padding: '5px 9px', ...mono }}>{r.globalPort}</td>
                          <td style={{ padding: '5px 9px', color: 'var(--text-muted)' }}>{r.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="meta" style={{ fontSize: 11.5, marginTop: 6 }}>Le NAT statique n’affiche <strong>pas de port</strong> (<code>---</code>) : toute connexion de l’IP est traduite. Les lignes <strong>PAT</strong> sont des <strong>exemples</strong> — les ports réels sont attribués dynamiquement à chaque flux et n’apparaissent qu’après du trafic (ping/HTTP).</div>
              </div>
            )}

            <details style={{ marginTop: 14, border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', background: 'var(--surface-2)' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>📝 Rappel — les tableaux du dossier technique</summary>
              <div style={{ fontSize: 12.5, marginTop: 8, lineHeight: 1.55 }}>
                <p style={{ margin: '0 0 8px' }}>Pour chaque partie du TP, renseigne ces tableaux à partir des valeurs générées ci-dessus :</p>
                <ol style={{ margin: 0, paddingLeft: 20 }}>
                  <li style={{ marginBottom: 6 }}><strong>Interfaces du Firewall</strong> — <em>Interface · IP · inside/outside · commentaire</em>. Les interfaces LAN sont <code>ip nat inside</code>, l’interface WAN (<code>{ctx.wanIf || 'Gig0/1'}</code>) est <code>ip nat outside</code>.</li>
                  <li style={{ marginBottom: 6 }}><strong>Route(s) statique(s)</strong> — <em>IDSR · MSR · passerelle · commentaire</em>. Ici la route par défaut : IDSR <code>0.0.0.0</code>, MSR <code>0.0.0.0</code>, passerelle = <code>{ctx.faiGw || 'passerelle FAI'}</code>.</li>
                  <li style={{ marginBottom: 6 }}><strong>ACL (réseaux à NAT)</strong> — <em>ACE · autorisation · IDSR · wildcard · commentaire</em>. Uniquement pour le PAT : <code>access-list 1 permit &lt;réseau&gt; &lt;wildcard&gt;</code> (wildcard = masque inversé, ex. <code>/24 → 0.0.0.255</code>).</li>
                  <li><strong>Table de NAT</strong> — <em>IP local inside · port · IP global inside · port · commentaire</em>. → voir la <strong>table prévisionnelle</strong> ci-dessus (relevée réellement avec <code>show ip nat translation</code>).</li>
                </ol>
              </div>
            </details>
          </div>
          </>)}
          <StepNav step={step} setStep={setStep} />
        </div>
      )}

      {/* ── Étape 5 : DHCP ── */}
      {step === 5 && (
        <div>
          <div style={group}>
            <div style={legend}>
              📡 Relais DHCP — scripts à coller sur les routeurs
              {!!dhcp.relays.length && <button type="button" onClick={() => copy('relayAll', dhcp.relaysFull)} style={{ ...btn, marginLeft: 'auto' }}>{copied === 'relayAll' ? '✓ Copié' : 'Tout copier'}</button>}
            </div>
            <div className="meta" style={{ fontSize: 11.5, margin: '0 0 10px' }}>Chaque interface LAN dont les clients sont en DHCP relaie les requêtes vers le serveur <code>{dhcp.server || '(non défini — étape 2)'}</code> via <code>ip helper-address</code>.</div>
            {!dhcp.relays.length && <div className="meta">Aucun LAN « DHCP » assigné à un routeur. Coche « DHCP » sur un sous-réseau LAN à l’étape 3.</div>}
            {dhcp.relays.map(b => (
              <div key={b.routerId} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                  <strong style={{ fontSize: 13 }}>🧭 {b.routerName}</strong>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginLeft: 8 }}>{b.count} interface(s)</span>
                  <button type="button" onClick={() => copy('relay:' + b.routerId, b.text)} style={{ ...smallBtn, marginLeft: 'auto' }}>{copied === 'relay:' + b.routerId ? '✓ Copié' : 'Copier'}</button>
                </div>
                <pre style={preStyle}><code>{b.text}</code></pre>
              </div>
            ))}
          </div>

          <div style={group}>
            <div style={legend}>🗄️ Étendues à configurer sur le serveur DHCP ({dhcp.pools.length})</div>
            <div className="meta" style={{ fontSize: 11.5, margin: '0 0 10px' }}>À saisir dans le service <strong>DHCP</strong> du serveur (Packet Tracer : onglet Services → DHCP ; ou rôle DHCP Windows). Une étendue par LAN client.</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 720 }}>
                <thead><tr><th style={th}>Pool</th><th style={th}>Réseau</th><th style={th}>Masque</th><th style={th}>Passerelle</th><th style={th}>DNS</th><th style={th}>Domaine</th><th style={th}>Plage (début – fin)</th><th style={th}>Bail (j)</th></tr></thead>
                <tbody>
                  {dhcp.pools.map((p, k) => (
                    <tr key={k}>
                      <td style={{ ...td, fontWeight: 600 }}>{p.name}</td>
                      <td style={{ ...td, ...mono }}>{p.net}</td>
                      <td style={{ ...td, ...mono }}>{p.mask}</td>
                      <td style={{ ...td, ...mono }}>{p.gw}</td>
                      <td style={{ ...td, ...mono }}>{p.dns}</td>
                      <td style={td}>{p.domain || '—'}</td>
                      <td style={{ ...td, ...mono }}>{p.start} – {p.end}</td>
                      <td style={{ ...td, ...mono }}>{p.lease}</td>
                    </tr>
                  ))}
                  {!dhcp.pools.length && <tr><td style={td} colSpan={8}>Aucune étendue : coche « DHCP » sur un LAN à l’étape 3.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>💡 Les équipements à <strong>IP fixe</strong> (serveur, WAP, imprimante) : soit une adresse <strong>hors de la plage</strong> distribuée, soit une <strong>réservation DHCP</strong> (association MAC → IP) — jamais une adresse déjà dans le pool, sous peine de conflit.</div>
          </div>
          <StepNav step={step} setStep={setStep} />
        </div>
      )}

      {/* ── Étape 6 : DNS ── */}
      {step === 6 && (
        <div>
          <div style={group}>
            <div style={legend}>🌐 Enregistrements DNS — {dns.domain}</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 380 }}>
                <thead><tr><th style={th}>Hôte</th><th style={th}>FQDN</th><th style={th}>Type</th><th style={th}>Valeur</th></tr></thead>
                <tbody>
                  {dns.recs.map((r, k) => (
                    <tr key={k}><td style={{ ...td, fontWeight: 600 }}>{r.host}</td><td style={{ ...td, ...mono }}>{r.fqdn}</td><td style={td}>A</td><td style={{ ...td, ...mono }}>{ipToStr(r.ip)}</td></tr>
                  ))}
                  {!dns.recs.length && <tr><td style={td} colSpan={4}>Renseigne un domaine (étape 1) et une topologie (étape 3).</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>Les postes clients sont en DHCP (adresses dynamiques) → pas d’enregistrement A statique. Les routeurs (première interface) et le serveur DNS sont proposés ci-dessus.</div>
          </div>

          <div style={group}>
            <div style={legend}>🖥️ Résolution locale sur les routeurs (CLI)<button type="button" onClick={() => copy('dnsHost', dns.hostLines)} style={{ ...smallBtn, marginLeft: 'auto' }}>{copied === 'dnsHost' ? '✓ Copié' : 'Copier'}</button></div>
            <pre style={preStyle}><code>{dns.hostLines || '(rien à générer)'}</code></pre>
            <div className="meta" style={{ fontSize: 11.5, marginTop: 6 }}>Permet <code>ping R2</code> par nom depuis la CLI. <code>ip name-server</code> n’apparaît que si un serveur DNS est défini (étape 2).</div>
          </div>

          <div style={group}>
            <div style={legend}>🗂️ Zones (serveur DNS)<button type="button" onClick={() => copy('dnsZone', dns.zone)} style={{ ...smallBtn, marginLeft: 'auto' }}>{copied === 'dnsZone' ? '✓ Copié' : 'Copier'}</button></div>
            <pre style={preStyle}><code>{dns.zone}</code></pre>
            <div className="meta" style={{ fontSize: 11.5, marginTop: 6 }}>Sous Packet Tracer, saisis ces enregistrements dans le service <strong>DNS</strong> du serveur (onglet Services → DNS) ; sous Windows Server, crée la zone directe et la zone inversée correspondantes.</div>
          </div>

          <div style={group}>
            <div style={legend}>✅ Tests</div>
            <pre style={preStyle}><code>{dns.tests.join('\n') || '(rien à tester)'}</code></pre>
            <div className="meta" style={{ fontSize: 11.5, marginTop: 6 }}>Depuis un client : <code>nslookup</code> pour vérifier la résolution, <code>ping &lt;fqdn&gt;</code> pour la connectivité. Vérifie que les clients ont bien reçu le <strong>serveur DNS</strong> par DHCP (étape 5).</div>
          </div>
          <StepNav step={step} setStep={setStep} />
        </div>
      )}

      {/* ── Étape 14 : ACL (filtrage) ── */}
      {step === 14 && (
        <div>
          {/*
            La matrice de flux.
            On déclare qui joint quel service ; les ACL s'en déduisent. C'est la
            forme qu'on remet au client, et celle qu'on sait défendre à l'oral —
            bien plus qu'une liste de lignes `access-list`.
          */}
          <div style={group}>
            <div style={legend}>
              🧭 Politique de flux — calculer les ACL
              <button type="button" onClick={ajouterFlux} disabled={!zonesSource.length}
                      style={{ ...btn, marginLeft: 'auto', opacity: zonesSource.length ? 1 : .4 }}>+ Ajouter un flux</button>
            </div>
            <div className="meta" style={{ fontSize: 11.5, margin: '0 0 10px' }}>
              Déclare <strong>qui</strong> a le droit de joindre <strong>quel service</strong>. L’outil en déduit
              une ACL étendue par zone, posée <strong>en entrée</strong> sur l’interface qui fait face à cette
              zone — au plus près de la source, comme le veut la règle de placement.
            </div>

            {!zonesSource.length && (
              <div className="meta">Aucun LAN avec passerelle : renseigne l’étape <strong>Adressage</strong> d’abord.</div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
              <label style={{ fontSize: 12 }}>Politique<br />
                <select value={politique.options.mode}
                        onChange={e => majPolitique({ options: { ...politique.options, mode: e.target.value as 'liste-blanche' | 'liste-noire' } })}
                        style={{ ...field, width: 260 }}>
                  <option value="liste-blanche">Liste blanche — refus par défaut</option>
                  <option value="liste-noire">Liste noire — tout passe sauf les refus</option>
                </select>
              </label>
              <label style={{ fontSize: 12 }}>Serveur DNS à joindre<br />
                <input value={politique.options.dns} placeholder={ctx.dnsServer || '192.168.10.11'} style={{ ...field, ...mono, width: 170 }}
                       onChange={e => majPolitique({ options: { ...politique.options, dns: e.target.value } })} />
              </label>
              <label style={{ fontSize: 12, alignSelf: 'end' }}>
                <input type="checkbox" checked={politique.options.dhcp}
                       onChange={e => majPolitique({ options: { ...politique.options, dhcp: e.target.checked } })} /> laisser passer le DHCP
              </label>
              <label style={{ fontSize: 12, alignSelf: 'end' }}>
                <input type="checkbox" checked={politique.options.ping}
                       onChange={e => majPolitique({ options: { ...politique.options, ping: e.target.checked } })} /> laisser passer le ping
              </label>
              <label style={{ fontSize: 12, alignSelf: 'end' }}>
                <input type="checkbox" checked={politique.options.nommer}
                       onChange={e => majPolitique({ options: { ...politique.options, nommer: e.target.checked } })} /> ACL nommées
              </label>
            </div>

            {politique.options.mode === 'liste-blanche' && (
              <div className="meta" style={{ fontSize: 11.5, marginBottom: 10 }}>
                ℹ️ En liste blanche, le <code>deny any</code> implicite coupe tout le reste — y compris le DHCP et
                le DNS. Les deux cases ci-dessus ajoutent d’office les règles qui les épargnent ; sans elles, les
                postes ne s’adressent plus et plus rien ne résout.
              </div>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900 }}>
                <thead>
                  <tr>
                    <th style={th}>Depuis</th><th style={th}>Vers</th><th style={th}>Services</th>
                    <th style={th}>Décision</th><th style={th}>Motif</th><th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {politique.flux.map(f => (
                    <tr key={f.id}>
                      <td style={td}>
                        <select value={f.sourceId} onChange={e => majFlux(f.id, { sourceId: e.target.value })} style={{ ...field, minWidth: 150 }}>
                          {zonesSource.map(z => <option key={z.id} value={z.id}>{z.nom}</option>)}
                        </select>
                      </td>
                      <td style={td}>
                        <select value={f.destinationId} onChange={e => majFlux(f.id, { destinationId: e.target.value })} style={{ ...field, minWidth: 180 }}>
                          {zonesCible.map(z => <option key={z.id} value={z.id}>{z.nom}</option>)}
                        </select>
                      </td>
                      <td style={td}>
                        {/* Des pastilles plutôt qu'une liste à sélection multiple :
                            on voit ce qui est choisi sans ouvrir, et on retire d'un clic. */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                          {f.services.map(c => (
                            <button key={c} type="button" title="Retirer"
                                    onClick={() => majFlux(f.id, { services: f.services.filter(x => x !== c) })}
                                    style={{ ...smallBtn, padding: '2px 7px', fontSize: 11 }}>
                              {SERVICES_FLUX.find(s => s.cle === c)?.nom.replace(/ \(.*\)$/, '') ?? c} ✕
                            </button>
                          ))}
                          {!f.services.length && <span className="meta" style={{ fontSize: 11 }}>aucun service</span>}
                        </div>
                        <select value="" style={{ ...field, minWidth: 190, fontSize: 12 }}
                                onChange={e => { if (e.target.value) majFlux(f.id, { services: [...f.services, e.target.value] }); }}>
                          <option value="">+ ajouter un service…</option>
                          {SERVICES_FLUX.filter(s => !f.services.includes(s.cle))
                            .map(s => <option key={s.cle} value={s.cle}>{s.nom}</option>)}
                        </select>
                      </td>
                      <td style={td}>
                        <select value={f.decision} onChange={e => majFlux(f.id, { decision: e.target.value as 'permit' | 'deny' })} style={{ ...field, width: 100 }}>
                          <option value="permit">autoriser</option>
                          <option value="deny">refuser</option>
                        </select>
                      </td>
                      <td style={td}>
                        <input value={f.commentaire || ''} placeholder="pourquoi ce flux existe"
                               onChange={e => majFlux(f.id, { commentaire: e.target.value })}
                               style={{ ...field, minWidth: 160 }} />
                      </td>
                      <td style={td}><button type="button" onClick={() => retirerFlux(f.id)} style={smallBtn}>✕</button></td>
                    </tr>
                  ))}
                  {!politique.flux.length && (
                    <tr><td style={td} colSpan={6}>
                      <span className="meta">Aucun flux déclaré. En liste blanche, aucune ACL n’est générée : une zone sans flux resterait entièrement coupée.</span>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {!!apercuPolitique.avertissements.length && (
              <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 12, lineHeight: 1.6 }}>
                {apercuPolitique.avertissements.map((w, i) => (
                  <li key={i} style={{ color: w.gravite === 'erreur' ? 'var(--danger, #d33)' : 'var(--text-soft)' }}>
                    {w.gravite === 'erreur' ? '⛔ ' : '⚠️ '}{w.texte}
                  </li>
                ))}
              </ul>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 12 }}>
              <button type="button" onClick={appliquerPolitique} disabled={!apercuPolitique.acls.length}
                      style={{ ...btn, opacity: apercuPolitique.acls.length ? 1 : .4 }}>
                Générer {apercuPolitique.acls.length} ACL ({apercuPolitique.acls.reduce((n, a) => n + a.aces.length, 0)} règles)
              </button>
              <span className="meta" style={{ fontSize: 11.5, flex: '1 1 24ch' }}>
                Les ACL écrites à la main ne sont pas touchées : seules les précédentes générations sont remplacées.
              </span>
            </div>
          </div>

          <div style={group}>
            <div style={legend}>
              🚦 Listes de contrôle d’accès
              <button type="button" onClick={ajouterAcl} style={{ ...btn, marginLeft: 'auto' }}>+ Nouvelle ACL</button>
            </div>
            <div className="meta" style={{ fontSize: 11.5, margin: '0 0 10px' }}>
              Le routeur lit les règles <strong>de haut en bas</strong> et s’arrête à la <strong>première qui correspond</strong>.
              Une ACL par interface, par sens, par protocole. Sources et destinations se piochent dans ton plan d’adressage —
              le masque générique est calculé pour toi.
            </div>
            {!aclsCtx.length && (
              <div className="meta">Aucune ACL. Ajoutes-en une : elle sera rattachée à un routeur de l’étape 3.</div>
            )}
          </div>

          {aclsCtx.map((a, ia) => {
            const routeur = routeursDe(ctx).find(r => r.id === a.routeurId);
            const interfaces = plan.ifaces.filter(i => i.routerId === a.routeurId);
            const avertissements = verifierAcl(a);
            const masquees = new Set(ombresAcl(a));
            return (
              <div key={a.id} style={group}>
                <div style={legend}>
                  <span style={mono}>{a.type === 'standard' ? 'ACL standard' : 'ACL étendue'} {a.nom}</span>
                  <button type="button" onClick={() => retirerAcl(a.id)} style={{ ...smallBtn, marginLeft: 'auto' }}>Supprimer</button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                  <label style={{ fontSize: 12 }}>Numéro ou nom<br />
                    <input value={a.nom} onChange={e => majAcl(a.id, { nom: e.target.value })}
                           style={{ ...field, width: 150, ...mono }} />
                  </label>
                  <label style={{ fontSize: 12 }}>Type<br />
                    <select value={a.type} onChange={e => changerType(a.id, e.target.value as TypeAcl)} style={{ ...field, width: 190 }}>
                      <option value="standard">standard — source seule</option>
                      <option value="etendue">étendue — source, destination, port</option>
                    </select>
                  </label>
                  <label style={{ fontSize: 12 }}>Routeur<br />
                    <select value={a.routeurId} onChange={e => majAcl(a.id, { routeurId: e.target.value, applications: [] })} style={{ ...field, width: 150 }}>
                      {routeursDe(ctx).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </label>
                  <label style={{ fontSize: 12, alignSelf: 'end' }}>
                    <input type="checkbox" checked={a.permitFinal} onChange={e => majAcl(a.id, { permitFinal: e.target.checked })} />
                    {' '}<code>permit {a.type === 'standard' ? 'any' : 'ip any any'}</code> final
                  </label>
                </div>

                {/* Les règles. L'ordre est la moitié du sens : on peut les déplacer. */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: a.type === 'standard' ? 560 : 980 }}>
                    <thead>
                      <tr>
                        <th style={th}>#</th>
                        <th style={th}>Action</th>
                        {a.type === 'etendue' && <th style={th}>Protocole</th>}
                        <th style={th}>Source</th>
                        {a.type === 'etendue' && <th style={th}>Port src.</th>}
                        {a.type === 'etendue' && <th style={th}>Destination</th>}
                        {a.type === 'etendue' && <th style={th}>Port dest.</th>}
                        <th style={th}>Commentaire</th>
                        <th style={th}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.aces.map((ace, i) => (
                        <tr key={ace.id} style={masquees.has(i) ? { opacity: .55 } : undefined}>
                          <td style={{ ...td, ...mono }}>{(i + 1) * 10}</td>
                          <td style={td}>
                            <select value={ace.autorisation} onChange={e => majAce(a.id, ace.id, { autorisation: e.target.value as 'permit' | 'deny' })} style={{ ...field, width: 90 }}>
                              <option value="permit">permit</option>
                              <option value="deny">deny</option>
                            </select>
                          </td>
                          {a.type === 'etendue' && (
                            <td style={td}>
                              <select value={ace.protocole} onChange={e => majAce(a.id, ace.id, { protocole: e.target.value as Transport })} style={{ ...field, width: 84 }}>
                                <option value="ip">ip</option><option value="tcp">tcp</option>
                                <option value="udp">udp</option><option value="icmp">icmp</option>
                              </select>
                            </td>
                          )}
                          <td style={td}><ChoixCible valeur={ace.source} onChange={c => majAce(a.id, ace.id, { source: c })} /></td>
                          {a.type === 'etendue' && (
                            <td style={td}>{ace.protocole === 'tcp' || ace.protocole === 'udp'
                              ? <ChoixPort valeur={ace.portSource} proto={ace.protocole} onChange={p => majAce(a.id, ace.id, { portSource: p })} />
                              : <span className="meta" style={{ fontSize: 11 }}>—</span>}
                            </td>
                          )}
                          {a.type === 'etendue' && (
                            <td style={td}><ChoixCible valeur={ace.destination} onChange={c => majAce(a.id, ace.id, { destination: c })} /></td>
                          )}
                          {a.type === 'etendue' && (
                            <td style={td}>
                              {ace.protocole === 'tcp' || ace.protocole === 'udp'
                                ? <ChoixPort valeur={ace.portDestination} proto={ace.protocole} onChange={p => majAce(a.id, ace.id, { portDestination: p })} />
                                : ace.protocole === 'icmp'
                                  ? (
                                    <select value={ace.messageIcmp || ''} onChange={e => majAce(a.id, ace.id, { messageIcmp: e.target.value })} style={{ ...field, width: 120 }}>
                                      {MESSAGES_ICMP.map(m => <option key={m.cle} value={m.cle}>{m.cle || 'tous'}</option>)}
                                    </select>
                                  )
                                  : <span className="meta" style={{ fontSize: 11 }}>—</span>}
                            </td>
                          )}
                          <td style={td}>
                            <input value={ace.remarque || ''} placeholder="pourquoi cette règle"
                                   onChange={e => majAce(a.id, ace.id, { remarque: e.target.value })}
                                   style={{ ...field, width: 150 }} />
                          </td>
                          <td style={{ ...td, whiteSpace: 'nowrap' }}>
                            <button type="button" onClick={() => deplacerAce(a.id, i, -1)} disabled={i === 0} style={{ ...smallBtn, opacity: i === 0 ? .4 : 1 }}>↑</button>
                            <button type="button" onClick={() => deplacerAce(a.id, i, 1)} disabled={i === a.aces.length - 1} style={{ ...smallBtn, marginLeft: 4, opacity: i === a.aces.length - 1 ? .4 : 1 }}>↓</button>
                            <button type="button" onClick={() => retirerAce(a.id, ace.id)} style={{ ...smallBtn, marginLeft: 4 }}>✕</button>
                          </td>
                        </tr>
                      ))}
                      {!a.aces.length && (
                        <tr><td style={td} colSpan={a.type === 'standard' ? 5 : 9}>
                          <span className="meta">Aucune règle. Sans règle, l’ACL ne fait rien — avec des règles mais sans <code>permit</code>, elle bloque tout.</span>
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <button type="button" onClick={() => ajouterAce(a.id)} style={{ ...smallBtn, marginTop: 8 }}>+ Ajouter une règle</button>

                {/* Où l'ACL est posée. Sans application, elle est écrite et sans effet. */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Appliquée sur</div>
                  {a.applications.map((ap, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 5, alignItems: 'center' }}>
                      <select value={ap.interface} onChange={e => majApplication(a.id, i, { interface: e.target.value })} style={{ ...field, width: 240 }}>
                        {interfaces.map(f => <option key={f.iface} value={f.iface}>{ifAbbr(f.iface)} — {f.target}</option>)}
                        {!interfaces.length && <option value="">(aucune interface sur ce routeur)</option>}
                      </select>
                      <select value={ap.sens} onChange={e => majApplication(a.id, i, { sens: e.target.value as 'in' | 'out' })} style={{ ...field, width: 190 }}>
                        <option value="in">in — trafic qui entre</option>
                        <option value="out">out — trafic qui sort</option>
                      </select>
                      <button type="button" onClick={() => retirerApplication(a.id, i)} style={smallBtn}>✕</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => ajouterApplication(a.id, interfaces[0]?.iface || '')} style={smallBtn}>+ Appliquer à une interface</button>
                </div>

                {!!avertissements.length && (
                  <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 12, lineHeight: 1.6 }}>
                    {avertissements.map((w, i) => (
                      <li key={i} style={{ color: w.gravite === 'erreur' ? 'var(--danger, #d33)' : 'var(--text-soft)' }}>
                        {w.gravite === 'erreur' ? '⛔ ' : '⚠️ '}{w.texte}
                      </li>
                    ))}
                  </ul>
                )}

                {/*
                  L'import en masse.
                  L'exercice se prépare dans un tableur ; retaper vingt règles
                  ici, c'est vingt occasions de se tromper sur un wildcard. On
                  colle, on regarde ce qui a été compris, puis on ajoute.
                */}
                <details style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px' }}>
                  <summary style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
                    📋 Coller un tableau ou importer un CSV
                  </summary>

                  <div className="meta" style={{ fontSize: 11.5, margin: '8px 0' }}>
                    Colle directement depuis le tableur de l’exercice (colonnes <em>Autorisation, Protocole,
                    Source, Port, Destination, Port, Commentaire</em>), un CSV, ou des lignes de configuration
                    Cisco déjà écrites. Les notations <code>Idsr: / Wldc:</code>, <code>192.168.1.0/24</code>,
                    <code>&gt;1023</code> et <code>eq www</code> sont comprises.
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain"
                           onChange={e => { lireFichier(a.id, e.target.files?.[0]); e.target.value = ''; }}
                           style={{ fontSize: 12 }} />
                    <button type="button" onClick={() => copy('modele:' + a.id, MODELE_COLLER)} style={smallBtn}>
                      {copied === 'modele:' + a.id ? '✓ Modèle copié' : 'Copier un modèle de tableau'}
                    </button>
                  </div>

                  <textarea
                    value={collage[a.id] ?? ''}
                    onChange={e => setCollage(c => ({ ...c, [a.id]: e.target.value }))}
                    placeholder={'permit\ttcp\t192.168.1.0 0.0.0.255\tgt 1023\thost 172.16.10.20\teq 443'}
                    rows={6}
                    style={{ ...field, ...mono, fontSize: 12, whiteSpace: 'pre', overflowX: 'auto' }}
                  />

                  {(() => {
                    const lu = importDe(a.id);
                    if (!lu.lignes.length) return null;
                    const bonnes = lu.lignes.filter(l => l.ace);
                    const mauvaises = lu.lignes.filter(l => l.erreur);
                    return (
                      <div style={{ marginTop: 10 }}>
                        <div className="meta" style={{ fontSize: 11.5, marginBottom: 6 }}>
                          {bonnes.length} règle(s) comprise(s){mauvaises.length ? `, ${mauvaises.length} ligne(s) en erreur` : ''}
                          {' · '}séparateur : {lu.separateur === 'cli' ? 'configuration Cisco' : lu.separateur === '\t' ? 'tabulation' : lu.separateur}
                          {lu.entete ? ' · en-tête reconnu' : ''}
                        </div>
                        <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                            <tbody>
                              {lu.lignes.map(l => (
                                <tr key={l.numero}>
                                  <td style={{ ...td, ...mono, width: 34, color: 'var(--text-muted)' }}>{l.numero}</td>
                                  <td style={{ ...td, ...mono, fontSize: 11.5 }}>
                                    {l.ace
                                      ? ecrireAce(l.ace, a.type)
                                      : <span style={{ color: 'var(--danger, #d33)' }}>⛔ {l.erreur}</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 8 }}>
                          <button type="button" onClick={() => appliquerImport(a.id)} disabled={!bonnes.length} style={{ ...btn, opacity: bonnes.length ? 1 : .4 }}>
                            {remplacer[a.id] ? 'Remplacer par' : 'Ajouter'} {bonnes.length} règle(s)
                          </button>
                          <label style={{ fontSize: 12 }}>
                            <input type="checkbox" checked={!!remplacer[a.id]}
                                   onChange={e => setRemplacer(r => ({ ...r, [a.id]: e.target.checked }))} />
                            {' '}remplacer les règles existantes
                          </label>
                          {!!mauvaises.length && (
                            <span className="meta" style={{ fontSize: 11.5 }}>
                              Les lignes en erreur ne seront pas ajoutées — corrige-les dans le tableau d’origine.
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </details>

                <div style={{ display: 'flex', alignItems: 'center', margin: '12px 0 5px' }}>
                  <strong style={{ fontSize: 13 }}>🧭 {routeur?.name || 'Routeur'} — à coller</strong>
                  <button type="button" onClick={() => copy('acl:' + a.id, ecrireAcl(a))} style={{ ...smallBtn, marginLeft: 'auto' }}>{copied === 'acl:' + a.id ? '✓ Copié' : 'Copier'}</button>
                </div>
                <pre style={preStyle}><code>{ecrireAcl(a)}</code></pre>
                <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>{placementAcl(a.type)}</div>
              </div>
            );
          })}

          <div style={group}>
            <div style={legend}>🔎 Vérifier après avoir collé</div>
            <pre style={preStyle}><code>{VERIFICATIONS_ACL}</code></pre>
            <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>
              Le compteur de correspondances est le seul juge : si la règle que tu crois active reste à zéro,
              c’est qu’une règle au-dessus l’a déjà attrapée, ou que l’ACL est posée sur la mauvaise interface
              ou dans le mauvais sens. Cours lié : <a href="/pages/cisco-acl">Les ACL</a>.
            </div>
          </div>
          <StepNav step={step} setStep={setStep} />
        </div>
      )}

      {/* ── Étape 9 : VLAN & switches ── */}
      {step === 9 && (
        <div>
          <div style={group}>
            <div style={legend}>🔀 VLAN — ce que ça change</div>
            <div className="meta" style={{ fontSize: 11.5, margin: '0 0 6px' }}>
              Donne un <strong>numéro de VLAN</strong> à un sous-réseau (étape 3) et il cesse de consommer une interface
              de routeur à lui seul : tous les VLAN d’un même routeur partagent <strong>un seul lien physique</strong>,
              chacun sur sa <strong>sous-interface</strong> <code>.{'{'}vlan{'}'}</code> en <code>encapsulation dot1Q</code>.
              C’est le <strong>routeur sur un bâton</strong> — et c’est ce qui permet de tenir dix réseaux sur un 2811 qui
              n’a que deux interfaces.
            </div>
            <div className="meta" style={{ fontSize: 11.5 }}>
              Laisse le champ vide et rien ne change : le sous-réseau garde son interface physique dédiée.
            </div>
          </div>

          {/* Un VLAN porte par une SVI n'apparait pas ici : sa configuration de
              switch est celle des switches d'acces, produite par l'ecran SVI.
              L'annoncer comme « aucun VLAN declare » etait faux et renvoyait
              corriger une saisie qui etait deja bonne. */}
          {(() => {
            const parSvi = plan.subs.filter(z => z.kind === 'lan' && z.vlan && !z.routerId
              && ctx.services.some(x => 'svc:' + x.id === z.id && x.svi));
            if (!parSvi.length) return null;
            return (
              <div style={group}>
                <div style={legend}>🗼 {parSvi.length} VLAN porté(s) par une SVI</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 7 }}>
                  {parSvi.map(z => (
                    <span key={z.id} style={{ fontSize: 11.5, fontWeight: 700, padding: '1px 9px', borderRadius: 999, color: '#fff', background: couleurVlan(z.vlan!, mlsPlan.vlans.map(v => v.id)) }}>
                      {z.vlan} {z.name}
                    </span>
                  ))}
                </div>
                <div className="meta" style={{ fontSize: 12 }}>
                  Leur passerelle est une <strong>interface Vlan</strong> sur le multicouche, pas une sous-interface de
                  routeur : il n'y a donc pas de configuration « routeur sur un bâton » à produire ici. Les
                  configurations de switch correspondantes sont à l'étape <strong>Switch multicouche (SVI)</strong>.
                </div>
              </div>
            );
          })()}

          {switches.length === 0 && !ctx.services.some(x => x.svi && vlanOf(x) !== null) ? (
            <div style={group}>
              <div style={legend}>Aucun VLAN déclaré</div>
              <div className="meta" style={{ fontSize: 12 }}>
                Reviens à l’étape <strong>Adressage</strong> et saisis un numéro dans la case <strong>VLAN</strong>
                d’au moins un sous-réseau (10, 20, 30…). Les configurations de switch apparaîtront ici.
              </div>
            </div>
          ) : switches.map(sw => (
            <div key={sw.name} style={group}>
              <div style={legend}>
                🔀 {sw.name} — {sw.rows.length} VLAN, trunk vers {sw.routerName}
                <button type="button" onClick={() => copy('sw' + sw.name, sw.text)} style={{ ...smallBtn, marginLeft: 'auto' }}>{copied === 'sw' + sw.name ? '✓ Copié' : 'Copier'}</button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, margin: '4px 0 10px' }}>
                <thead>
                  <tr>
                    {['VLAN', 'Nom', 'Réseau', 'Passerelle', 'Ports d’accès', 'Hôtes'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '5px 8px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sw.rows.map(r => (
                    <tr key={r.vlan}>
                      <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', ...mono }}>{r.vlan}</td>
                      <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)' }}>{r.name}</td>
                      <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', ...mono }}>{r.net}</td>
                      <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', ...mono }}>{r.gw}</td>
                      <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', ...mono }}>{r.ports}</td>
                      <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', ...mono }}>{r.hosts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <pre style={preStyle}><code>{sw.text}</code></pre>
              <div className="meta" style={{ fontSize: 11.5, marginTop: 6 }}>
                Le trunk <code>{sw.uplink}</code> ne laisse passer que les VLAN de la liste : tout le reste est bloqué sur
                ce lien. Le <strong>VLAN natif {sw.nativeVlan}</strong> est volontairement un VLAN vide — le laisser à 1
                est la porte ouverte au double marquage.
              </div>
            </div>
          ))}

          {switches.length > 0 && (
            <div style={group}>
              <div style={legend}>📟 Côté routeur</div>
              <div className="meta" style={{ fontSize: 11.5 }}>
                Les sous-interfaces correspondantes sont déjà dans <strong>Routeurs &amp; reset</strong>. Vérifie que
                l’interface physique porteuse est bien montée (<code>no shutdown</code>) et <strong>sans adresse</strong> :
                c’est l’oubli classique, et les sous-interfaces restent muettes sans que rien ne le signale.
              </div>
            </div>
          )}
          <StepNav step={step} setStep={setStep} />
        </div>
      )}

      {/* ── Étape 7 : SSH ── */}
      {step === 7 && (
        <div>
          <div style={group}>
            <div style={legend}>🔑 SSH — routeurs ({ssh.routers.length})</div>
            <div className="meta" style={{ fontSize: 11.5, margin: '0 0 10px' }}>Accès distant chiffré : domaine, clé RSA, compte <code>{ctx.login || 'admin'}</code> en privilège 15, VTY en <code>transport input ssh</code>. À coller dans la CLI de chaque routeur.</div>
            {ssh.routers.map(r => (
              <div key={r.name} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                  <strong style={{ fontSize: 13 }}>🧭 {r.name}</strong>
                  <button type="button" onClick={() => copy('sshr:' + r.name, r.text)} style={{ ...smallBtn, marginLeft: 'auto' }}>{copied === 'sshr:' + r.name ? '✓ Copié' : 'Copier'}</button>
                </div>
                <pre style={preStyle}><code>{r.text}</code></pre>
              </div>
            ))}
            {!ssh.routers.length && <div className="meta">Ajoute des routeurs à l’étape 3.</div>}
          </div>

          <div style={group}>
            <div style={legend}>🔑 SSH — switches ({ssh.switches.length})</div>
            <div className="meta" style={{ fontSize: 11.5, margin: '0 0 10px' }}>Chaque switch reçoit une <strong>IP de gestion (SVI VLAN 1)</strong>, une passerelle par défaut, puis la config SSH. À coller dans la CLI de chaque switch.</div>
            {ssh.switches.map(s => (
              <div key={s.name} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                  <strong style={{ fontSize: 13 }}>🔀 {s.name}</strong>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginLeft: 8, ...mono }}>{s.ip}</span>
                  <button type="button" onClick={() => copy('sshs:' + s.name, s.text)} style={{ ...smallBtn, marginLeft: 'auto' }}>{copied === 'sshs:' + s.name ? '✓ Copié' : 'Copier'}</button>
                </div>
                <pre style={preStyle}><code>{s.text}</code></pre>
              </div>
            ))}
            {!ssh.switches.length && <div className="meta">Coche « switch » sur des sous-réseaux à l’étape 3.</div>}
          </div>

          <div style={group}>
            <div style={legend}>🖥️ Se connecter en SSH depuis Windows</div>
            <div className="meta" style={{ fontSize: 12 }}>Le client <code>ssh</code> natif de Windows refuse souvent les algorithmes des vieux IOS (« <em>no matching key exchange method</em> »). Utilise <strong>PuTTY</strong> ou <strong>MobaXterm</strong> (IP de l’équipement, port 22, type SSH). Si la clé est invalide (équipement renommé après sa génération), régénère-la : <code>crypto key zeroize rsa</code> puis <code>crypto key generate rsa</code>.</div>
          </div>
          <StepNav step={step} setStep={setStep} />
        </div>
      )}

      {/* ── Étape 8 : Tests ── */}
      {step === 10 && (
        <div>
          <div style={group}>
            <div style={legend}>
              🗼 Le routage porte par le switch, pas par un routeur
              <label style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 400 }}>
                <input type="checkbox" checked={mlsEnJeu} disabled={!ctx.mlsActif && mlsEnJeu} style={{ marginRight: 5 }}
                  title={!ctx.mlsActif && mlsEnJeu ? 'Des sous-reseaux designent deja une SVI comme passerelle : le multicouche est en jeu, cochee ou non.' : undefined}
                  onChange={e => set({ mlsActif: e.target.checked })} />
                c'est la methode de cette maquette
              </label>
            </div>
            {mlsEnJeu && (
              <div className="meta" style={{ fontSize: 11.5, margin: '0 0 6px' }}>
                Le <strong>Schema</strong> montre desormais cette topologie — multicouche, switches d'acces et VLAN —
                au lieu des routeurs et de leurs sous-interfaces.
              </div>
            )}
            <div className="meta" style={{ fontSize: 11.5, margin: '0 0 6px' }}>
              Meme resultat que le <strong>routeur sur un baton</strong> de l'etape precedente, autre equipement : un
              <strong> switch multicouche</strong> route lui-meme. Chaque VLAN recoit une <strong>SVI</strong>
              (<em>Switched Virtual Interface</em>) qui porte sa passerelle, et les switches d'acces se contentent de
              commuter.
            </div>
            <div className="meta" style={{ fontSize: 11.5 }}>
              Les VLAN viennent de la <strong>Segmentation</strong> : rien a ressaisir ici. On declare seulement
              <strong> quels switches d'acces</strong> existent et <strong>quels VLAN</strong> chacun porte.
            </div>
          </div>

          {mlsPlan.vlans.length === 0 ? (
            <div style={group}>
              <div style={legend}>Aucun VLAN declare</div>
              <div className="meta" style={{ fontSize: 12 }}>
                Reviens a l'etape <strong>Segmentation</strong> et donne un numero de VLAN a au moins un sous-reseau.
              </div>
            </div>
          ) : (
            <>
              <div style={group}>
                <div style={legend}>
                  ⚙️ Les switches multicouches
                  <button type="button" style={{ ...smallBtn, marginLeft: 'auto' }}
                    onClick={() => { const id = uid('m'); set({
                      materiels: [...ctx.materiels, { id, nom: 'MLS-' + (multicouchesDe(ctx).length + 1), type: 'multicouche' as TypeMateriel, modele: '3560', ports: PORTS_TYPIQUES.multicouche }],
                      optMls: { ...ctx.optMls, [id]: { prefixe: PREFIXE_3560, vlans: [] } },
                    }); }}>+ Ajouter</button>
                </div>
                <div className="meta" style={{ fontSize: 11.5, margin: '0 0 6px' }}>
                  {mlsPlan.vlans.length} VLAN · relais DHCP&nbsp;
                  {ctx.dhcpServer ? <code>{ctx.dhcpServer}</code> : <em>aucun (etape DHCP)</em>}
                  {multicouchesDe(ctx).length > 1 && <> · <strong>chaque VLAN n'a qu'une passerelle</strong> : sa SVI vit sur un seul switch.</>}
                </div>

                {multicouchesDe(ctx).map((m, i) => (
                  <div key={m.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', margin: '6px 0' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input value={m.nom} style={{ ...field, width: 140 }}
                        onChange={e => majMls(i, { nom: e.target.value })} />
                      <select value={m.prefixe} style={{ ...field, width: 200 }}
                        onChange={e => majMls(i, { prefixe: e.target.value })}>
                        <option value={PREFIXE_3560}>3560 — FastEthernet0/x</option>
                        <option value={PREFIXE_EMPILE}>empilable — GigabitEthernet1/0/x</option>
                      </select>
                      <span className="meta" style={{ fontSize: 11.5 }}>
                        {vlansDe(mlsPlan, m).length} SVI · {accesDe(mlsPlan, m).length} switch(es)
                      </span>
                      {multicouchesDe(ctx).length > 1 && (
                        <button type="button" style={{ ...smallBtn, marginLeft: 'auto' }}
                          onClick={() => set({
                            materiels: ctx.materiels.filter(x => x.id !== m.id),
                            cables: ctx.cables.filter(c => c.deId !== m.id && c.versId !== m.id),
                            services: ctx.services.map(x => (x.svi === m.id ? { ...x, svi: undefined } : x)),
                          })}>Retirer</button>
                      )}
                    </div>
                    {multicouchesDe(ctx).length > 1 && (
                      <>
                        <div className="meta" style={{ fontSize: 11, marginTop: 5 }}>
                          Les VLAN dont il porte la SVI. Rien de coche = tous ceux que les autres ne prennent pas.
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 3 }}>
                          {mlsPlan.vlans.map(v => (
                            <label key={v.id} style={{ fontSize: 11.5, border: '1px solid var(--border)', borderRadius: 6, padding: '2px 7px', cursor: 'pointer' }}>
                              <input type="checkbox" checked={m.vlans.includes(v.id)} style={{ marginRight: 4 }}
                                onChange={e => majMls(i, { vlans: e.target.checked ? [...m.vlans, v.id].sort((a, b) => a - b) : m.vlans.filter(x => x !== v.id) })} />
                              {v.id} {v.name}
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ))}

                {(() => {
                  const pb = verifierMulticouches(mlsPlan);
                  if (!pb.length) return null;
                  return (
                    <div style={{ marginTop: 6, border: '1px solid var(--danger, #c4462f)', borderRadius: 8, padding: '8px 11px' }}>
                      <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--danger, #c4462f)' }}>⚠ Repartition incoherente</div>
                      {pb.map((x, k) => (
                        <div key={k} style={{ marginTop: 5, fontSize: 12 }}>
                          <div style={{ fontWeight: 600 }}>{x.quoi}</div>
                          <div style={{ fontSize: 11.5 }}>{x.effet}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              <div style={group}>
                <div style={legend}>
                  🗄️ Les switches d'acces
                  <button type="button" style={{ ...smallBtn, marginLeft: 'auto' }}
                    onClick={() => { const id = uid('sw'); const cible = multicouchesDe(ctx)[0]; set({
                      materiels: [...ctx.materiels, { id, nom: 'Sw-' + (switchesDe(ctx).length + 1), type: 'switch' as TypeMateriel, modele: '2960', ports: PORTS_PAR_DEFAUT }],
                      optSwitches: { ...ctx.optSwitches, [id]: { vlans: mlsPlan.vlans.slice(0, 2).map(v => v.id) } },
                      // Un switch neuf arrive cable au premier multicouche : c'est
                      // ce que faisait l'ancien `mlsId` par defaut, dit en couche 1.
                      ...(cible ? { cables: [...ctx.cables, { id: uid('cab'), deId: cible.id, dePort: switchesDe(ctx).length + 1, versId: id, versPort: PORTS_ACCES + 1, media: 'croise' as Media }] } : {}),
                    }); }}>+ Ajouter</button>
                </div>
                {switchesDe(ctx).length === 0 && (
                  <div className="meta" style={{ fontSize: 12 }}>
                    Aucun switch d'acces. Ajoutes-en un par local ou par batiment — c'est ce decoupage que le
                    dossier technique demande de justifier.
                  </div>
                )}
                {switchesDe(ctx).map((sw, i) => (
                  <div key={sw.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', margin: '6px 0' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input value={sw.name} onChange={e => majAcces(i, { name: e.target.value })} style={{ ...field, width: 130 }} />
                      <label style={{ fontSize: 11.5 }}>ports&nbsp;
                        <input type="number" min={2} max={48} value={sw.ports}
                          onChange={e => majAcces(i, { ports: Math.max(2, Number(e.target.value) || PORTS_PAR_DEFAUT) })}
                          style={{ ...field, width: 62 }} />
                      </label>
                      <label style={{ fontSize: 11.5 }} title="le port de l equipement du dessus ou ce lien arrive">port amont&nbsp;
                        <input type="number" min={1} value={sw.portMls}
                          onChange={e => majAcces(i, { portMls: Math.max(1, Number(e.target.value) || 1) })}
                          style={{ ...field, width: 62 }} />
                      </label>
                      <label style={{ fontSize: 11.5 }}>uplink&nbsp;
                        <input type="number" min={1} max={sw.ports} value={sw.uplink}
                          onChange={e => majAcces(i, { uplink: Math.max(1, Number(e.target.value) || sw.ports) })}
                          style={{ ...field, width: 62 }} />
                      </label>
                      <label style={{ fontSize: 11.5 }} title="un multicouche, ou un autre switch en cascade">remonte vers&nbsp;
                        {/* Sans option vide, un switch qu'aucun cable ne relie
                            affichait le premier multicouche de la liste : la
                            valeur montree n'etait pas la sienne. */}
                        <select value={sw.mlsId} style={{ ...field, width: 150, borderColor: sw.mlsId ? 'var(--border)' : '#ca8a04' }}
                          onChange={e => majAcces(i, { mlsId: e.target.value })}>
                          <option value="">— non câblé —</option>
                          {multicouchesDe(ctx).map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                          {switchesDe(ctx).filter(x => x.id !== sw.id).map(x => <option key={x.id} value={x.id}>{x.name} (cascade)</option>)}
                        </select>
                      </label>
                      <button type="button" style={{ ...smallBtn, marginLeft: 'auto' }}
                        onClick={() => set({
                          materiels: ctx.materiels.filter(x => x.id !== sw.id),
                          cables: ctx.cables.filter(c => c.deId !== sw.id && c.versId !== sw.id),
                        })}>Retirer</button>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                      {mlsPlan.vlans.map(v => (
                        <label key={v.id} style={{ fontSize: 11.5, border: '1px solid var(--border)', borderRadius: 6, padding: '2px 7px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={sw.vlans.includes(v.id)}
                            onChange={e => majAcces(i, { vlans: e.target.checked ? [...sw.vlans, v.id].sort((a, b) => a - b) : sw.vlans.filter(x => x !== v.id) })}
                            style={{ marginRight: 4 }} />
                          {v.id} {v.name}
                        </label>
                      ))}
                    </div>

                    <details style={{ marginTop: 7 }}>
                      <summary style={{ fontSize: 11.5, cursor: 'pointer', color: 'var(--text-muted)' }}>
                        Ports — {sw.ports_?.length ? 'affectes a la main' : 'repartis automatiquement'}
                      </summary>
                      <div className="meta" style={{ fontSize: 11, margin: '5px 0' }}>
                        Tant que rien n'est declare, les ports se repartissent tout seuls. Des qu'une ligne existe,
                        elle fait foi — c'est ce que le dossier technique demande de decider.
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                        <thead>
                          <tr>{['Ports', 'Role', 'VLAN / vers', ''].map(h => (
                            <th key={h} style={{ textAlign: 'left', padding: '3px 6px', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody>
                          {affectations(mlsPlan, sw).map((a, k) => {
                            const declare = !!sw.ports_?.length;
                            const majPort = (patch: Partial<AffectationPort>) => {
                              const base = sw.ports_ ?? affectations(mlsPlan, sw);
                              majAcces(i, { ports_: base.map((x, n) => (n === k ? { ...x, ...patch } : x)) });
                            };
                            return (
                              <tr key={k} style={{ opacity: declare ? 1 : 0.75 }}>
                                <td style={{ padding: '2px 6px' }}>
                                  <input value={a.plage} style={{ ...field, width: 80, padding: '4px 6px' }}
                                    placeholder="1-10" onChange={e => majPort({ plage: e.target.value })} />
                                </td>
                                <td style={{ padding: '2px 6px' }}>
                                  <select value={a.role} style={{ ...field, width: 80, padding: '4px 6px' }}
                                    onChange={e => majPort({ role: e.target.value as 'access' | 'trunk' })}>
                                    <option value="access">access</option>
                                    <option value="trunk">trunk</option>
                                  </select>
                                </td>
                                <td style={{ padding: '2px 6px' }}>
                                  {a.role === 'access' ? (
                                    <select value={a.vlan ?? ''} style={{ ...field, width: 130, padding: '4px 6px' }}
                                      onChange={e => majPort({ vlan: Number(e.target.value) })}>
                                      <option value="">—</option>
                                      {mlsPlan.vlans.map(v => <option key={v.id} value={v.id}>{v.id} {v.name}</option>)}
                                    </select>
                                  ) : (
                                    <select value={a.vers ?? ''} style={{ ...field, width: 130, padding: '4px 6px' }}
                                      onChange={e => majPort({ vers: e.target.value })}>
                                      <option value="">—</option>
                                      {multicouchesDe(ctx).map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                                      {switchesDe(ctx).filter(x => x.id !== sw.id).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                                    </select>
                                  )}
                                </td>
                                <td style={{ padding: '2px 6px' }}>
                                  <button type="button" style={{ ...smallBtn, padding: '2px 7px' }}
                                    onClick={() => majAcces(i, { ports_: (sw.ports_ ?? affectations(mlsPlan, sw)).filter((_, n) => n !== k) })}>✕</button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
                        <button type="button" style={smallBtn}
                          onClick={() => majAcces(i, { ports_: [...(sw.ports_ ?? affectations(mlsPlan, sw)), { plage: '', role: 'access', vlan: sw.vlans[0] }] })}>+ Ligne</button>
                        {sw.ports_?.length ? (
                          <button type="button" style={smallBtn}
                            onClick={() => majAcces(i, { ports_: undefined })}>Revenir au calcul automatique</button>
                        ) : null}
                      </div>
                      {verifierPorts(mlsPlan, sw).map((x, k) => (
                        <div key={k} style={{ marginTop: 5, fontSize: 11.5, color: 'var(--danger, #c4462f)' }}>
                          ⚠ <strong>{x.quoi}</strong> — {x.effet}
                        </div>
                      ))}
                    </details>
                  </div>
                ))}
              </div>

              <div style={group}>
                <div style={legend}>
                  📋 Dossier technique — un tableau par switch
                  <button type="button" style={{ ...smallBtn, marginLeft: 'auto' }}
                    onClick={() => copy('mlsdoc', mlsTables.map(t => t.switchName + '\n' + t.rows.map(r => [r.vlan, r.nom, r.idsr, r.msr, r.untag || '—', r.tag].join('\t')).join('\n')).join('\n\n'))}>
                    {copied === 'mlsdoc' ? '✓ Copie' : 'Copier'}
                  </button>
                </div>
                {mlsTables.map(t => (
                  <div key={t.switchName} style={{ margin: '8px 0' }}>
                    <div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 3 }}>{t.switchName}</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr>{['VLAN', 'Nom', 'IDSR', 'MSR', 'Ports untag (access)', 'Ports tag (trunk)'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '4px 7px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {t.rows.map(r => (
                          <tr key={r.vlan}>
                            <td style={tdMls}><strong>{r.vlan}</strong></td>
                            <td style={tdMls}>{r.nom}</td>
                            <td style={tdMls}>{r.idsr}</td>
                            <td style={tdMls}>/{r.msr}</td>
                            <td style={tdMls}>{r.untag || '—'}</td>
                            <td style={tdMls}>{r.tag}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>

              {multicouchesDe(ctx).map(m => (
                <div key={m.id} style={group}>
                  <div style={legend}>
                    📟 {m.nom} — la configuration
                    <button type="button" style={{ ...smallBtn, marginLeft: 'auto' }}
                      onClick={() => copy('mlscfg' + m.id, configMls(mlsPlan, m))}>{copied === 'mlscfg' + m.id ? '✓ Copie' : 'Copier'}</button>
                  </div>
                  <pre style={preStyle}><code>{configMls(mlsPlan, m)}</code></pre>
                </div>
              ))}

              {switchesDe(ctx).map(sw => (
                <div key={sw.id} style={group}>
                  <div style={legend}>
                    🗄️ {sw.name} — la configuration
                    <button type="button" style={{ ...smallBtn, marginLeft: 'auto' }}
                      onClick={() => copy('acc' + sw.id, configAcces(sw, mlsPlan))}>{copied === 'acc' + sw.id ? '✓ Copie' : 'Copier'}</button>
                  </div>
                  <pre style={preStyle}><code>{configAcces(sw, mlsPlan)}</code></pre>
                </div>
              ))}

              <div style={group}>
                <div style={legend}>🔍 Verifier, dans l'ordre qui elimine une cause</div>
                {verifsMls(mlsPlan).map(sec => (
                  <div key={sec.titre} style={{ margin: '6px 0' }}>
                    <div style={{ fontWeight: 600, fontSize: 12.5 }}>{sec.titre}</div>
                    <pre style={preStyle}><code>{sec.lignes.join('\n')}</code></pre>
                  </div>
                ))}
              </div>

              <div style={group}>
                <div style={legend}>
                  🌍 Sortie Internet — pare-feu et NAT surcharge
                  <label style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 400 }}>
                    <input type="checkbox" checked={!!ctx.mlsSortie} style={{ marginRight: 5 }}
                      onChange={e => set({ mlsSortie: e.target.checked ? SORTIE_DEFAUT : null })} />
                    activer
                  </label>
                </div>
                {!ctx.mlsSortie ? (
                  <div className="meta" style={{ fontSize: 11.5 }}>
                    Le « pour aller plus loin » du TP : un <strong>pare-feu</strong> entre le multicouche et le FAI,
                    qui traduit les adresses privees. Coche pour le configurer.
                  </div>
                ) : (
                  <>
                    <div className="meta" style={{ fontSize: 11.5, margin: '0 0 8px' }}>
                      Trois equipements, trois roles : les postes passent par le <strong>multicouche</strong> (qui route
                      entre VLAN), puis par le <strong>pare-feu</strong> (qui traduit), puis par le <strong>FAI</strong>.
                      Le lien multicouche‑pare-feu est un <strong>port route</strong>, pas un VLAN.
                    </div>

                    {/* Le meme cable pouvait se decrire ici et en Segmentation, avec
                        deux plans d'adressage. Il se decrit desormais une fois. */}
                    {segmentsSortie.length > 0 && (
                      <div style={{ border: '1px solid var(--accent)', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Le lien vers le pare-feu</div>
                        <select value={ctx.mlsSortie.segmentId ?? ''} style={{ ...field, width: 340 }}
                          onChange={e => set({ mlsSortie: { ...ctx.mlsSortie!, segmentId: e.target.value || undefined } })}>
                          <option value="">— saisi ici (indépendant du plan d’adressage)</option>
                          {segmentsSortie.map(z => (
                            <option key={z.id} value={z.id}>{z.nom} · {z.ipMls} ↔ {z.ipFirewall}/{z.cidr}</option>
                          ))}
                        </select>
                        <div className="meta" style={{ fontSize: 11.5, marginTop: 4 }}>
                          {sortieAdoptee
                            ? 'Les adresses du lien viennent du plan d’adressage : elles suivront toute modification du segment, et les deux bouts resteront dans le meme sous-reseau.'
                            : 'Un segment multicouche ↔ routeur est declare en Segmentation. Tant qu’il n’est pas choisi ici, le meme cable porte deux plans d’adressage.'}
                        </div>
                      </div>
                    )}

                    {verifierSortie(ctx.mlsSortie, segmentsSortie).map((x, k) => (
                      <div key={k} style={{ border: '1px solid var(--danger, #c4462f)', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger, #c4462f)' }}>⚠ {x.quoi}</div>
                        <div style={{ fontSize: 11.5 }}>{x.effet}</div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {([
                        ['firewall', 'Nom du pare-feu', 130],
                        ['portMls', 'Port routé du MLS', 170],
                        ['ipMls', 'IP côté MLS', 110],
                        ['ipFirewall', 'IP côté pare-feu', 110],
                        ['ifInside', 'If. interne (pare-feu)', 170],
                        ['ifWan', 'If. WAN (pare-feu)', 170],
                        ['ipWan', 'IP WAN', 110],
                        ['passerelleFai', 'Passerelle FAI', 110],
                      ] as [keyof SortieInternet, string, number][]).map(([k, lib, w]) => {
                        // Adopter un segment, c'est lui laisser ces trois-la : les
                        // reouvrir a la saisie rendrait la divergence possible a nouveau.
                        const derive = sortieAdoptee && (k === 'ipMls' || k === 'ipFirewall' || k === 'firewall');
                        return (
                        <label key={k} style={{ fontSize: 11.5, opacity: derive ? .65 : 1 }}>{lib}{derive ? ' · du segment' : ''}<br />
                          <input value={String(sortie?.[k] ?? '')} style={{ ...field, width: w }} readOnly={derive}
                            title={derive ? 'Vient du segment d\u2019interconnexion choisi ci-dessus.' : undefined}
                            onChange={e => { if (!derive) set({ mlsSortie: { ...ctx.mlsSortie!, [k]: e.target.value } }); }} />
                        </label>
                        );
                      })}
                      <label style={{ fontSize: 11.5 }}>Serveur publie (IP)<br />
                        <input value={ctx.mlsSortie.publie?.ip ?? ''} style={{ ...field, width: 120 }}
                          placeholder="aucun"
                          onChange={e => set({ mlsSortie: { ...ctx.mlsSortie!, publie: e.target.value ? { ip: e.target.value, port: ctx.mlsSortie?.publie?.port || '80' } : undefined } })} />
                      </label>
                      <label style={{ fontSize: 11.5 }}>Port<br />
                        <input value={ctx.mlsSortie.publie?.port ?? ''} style={{ ...field, width: 70 }}
                          placeholder="80"
                          onChange={e => set({ mlsSortie: { ...ctx.mlsSortie!, publie: ctx.mlsSortie?.publie?.ip ? { ip: ctx.mlsSortie.publie.ip, port: e.target.value } : undefined } })} />
                      </label>
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <div className="meta" style={{ fontSize: 11.5, marginBottom: 4 }}>
                        <strong>Qui a le droit de sortir ?</strong> Tous les VLAN n ont pas vocation a joindre Internet.
                        Un VLAN decoche joint toujours les autres VLAN, mais s arrete au pare-feu.
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {mlsPlan.vlans.map(v => {
                          const sortants = ctx.mlsSortie?.sortants ?? mlsPlan.vlans.map(x => x.id);
                          const coche = sortants.includes(v.id);
                          return (
                            <label key={v.id} style={{ fontSize: 11.5, border: '1px solid var(--border)', borderRadius: 6, padding: '2px 7px', cursor: 'pointer' }}>
                              <input type="checkbox" checked={coche} style={{ marginRight: 4 }}
                                onChange={e => set({ mlsSortie: { ...ctx.mlsSortie!, sortants: e.target.checked ? [...sortants, v.id].sort((a, b) => a - b) : sortants.filter(x => x !== v.id) } })} />
                              {v.id} {v.name}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <div style={legend}>
                        🗼 Sur {mlsPlan.multicouches[0]?.nom} — le port route et la route par defaut
                        <button type="button" style={{ ...smallBtn, marginLeft: 'auto' }}
                          onClick={() => copy('mlsout', configSortieMls(mlsPlan, sortie!))}>{copied === 'mlsout' ? '✓ Copie' : 'Copier'}</button>
                      </div>
                      <pre style={preStyle}><code>{configSortieMls(mlsPlan, sortie!)}</code></pre>
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <div style={legend}>
                        🔒 Sur {sortie!.firewall} — traduction et routes de retour
                        <button type="button" style={{ ...smallBtn, marginLeft: 'auto' }}
                          onClick={() => copy('fw', configPareFeu(mlsPlan, sortie!))}>{copied === 'fw' ? '✓ Copie' : 'Copier'}</button>
                      </div>
                      <pre style={preStyle}><code>{configPareFeu(mlsPlan, sortie!)}</code></pre>
                      <div className="meta" style={{ fontSize: 11.5 }}>
                        Les <strong>routes de retour</strong> en bas de configuration sont l'oubli classique : sans elles,
                        le pare-feu traduit le trafic sortant sans savoir par ou renvoyer les reponses. Depuis le pare-feu,
                        Internet repond ; depuis un poste, rien.
                      </div>
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <div style={legend}>📑 Ce que « show ip nat translations » montrera</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr>{['Proto', 'Interne', 'Traduit en', 'Note'].map(h => (
                            <th key={h} style={{ textAlign: 'left', padding: '4px 7px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody>
                          {tableNat(mlsPlan, sortie!).map((r, i) => (
                            <tr key={i}>
                              <td style={tdMls}>{r.proto}</td>
                              <td style={tdMls}><code style={{ fontSize: 11 }}>{r.interne}</code></td>
                              <td style={tdMls}><code style={{ fontSize: 11 }}>{r.traduit}</code></td>
                              <td style={tdMls}>{r.note}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <div style={legend}>🛠️ Les pannes de la sortie Internet</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <tbody>
                          {PANNES_INTERNET.map(x => (
                            <tr key={x.symptome}>
                              <td style={tdMls}>{x.symptome}</td>
                              <td style={tdMls}>{x.cause}</td>
                              <td style={tdMls}><code style={{ fontSize: 11 }}>{x.verif}</code></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>

              {ctx.mlsSortie && (
                <div style={group}>
                  <div style={legend}>
                    🌐 Le reseau externe — le routeur d'en face et le site
                    <label style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 400 }}>
                      <input type="checkbox" checked={!!ctx.mlsExterne} style={{ marginRight: 5 }}
                        onChange={e => set({ mlsExterne: e.target.checked ? EXTERNE_DEFAUT : null })} />
                      le simuler
                    </label>
                  </div>
                  {!ctx.mlsExterne ? (
                    <div className="meta" style={{ fontSize: 11.5 }}>
                      En maquette, « Internet » est un routeur et un serveur qu'on pose soi-meme. Coche pour les
                      configurer — et pour verifier que leur adressage ne recoupe pas celui de l'entreprise.
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {([
                          ['routeur', 'Routeur externe', 120],
                          ['ipVersPareFeu', 'Son IP vers le pare-feu', 120],
                          ['reseauSite', 'Reseau du site', 130],
                          ['ipRouteurSite', 'Sa passerelle', 130],
                          ['ipSite', 'IP du site', 130],
                          ['nomSite', 'Nom du site', 150],
                        ] as [keyof ReseauExterne, string, number][]).map(([k, lib, w]) => (
                          <label key={k} style={{ fontSize: 11.5 }}>{lib}<br />
                            <input value={String(ctx.mlsExterne?.[k] ?? '')} style={{ ...field, width: w }}
                              onChange={e => set({ mlsExterne: { ...ctx.mlsExterne!, [k]: e.target.value } })} />
                          </label>
                        ))}
                      </div>

                      {(() => {
                        const conflits = chevauchements(mlsPlan, ctx.mlsExterne!, sortie!);
                        if (!conflits.length) {
                          return (
                            <div className="meta" style={{ fontSize: 11.5, marginTop: 8, color: 'var(--ok, #059669)' }}>
                              ✓ Aucun reseau n'est employe des deux cotes du pare-feu.
                            </div>
                          );
                        }
                        return (
                          <div style={{ marginTop: 8, border: '1px solid var(--danger, #c4462f)', borderRadius: 8, padding: '8px 11px' }}>
                            <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--danger, #c4462f)' }}>
                              ⚠ Le meme reseau est employe des deux cotes du pare-feu
                            </div>
                            {conflits.map((c, i) => (
                              <div key={i} style={{ marginTop: 6, fontSize: 12 }}>
                                <div style={{ fontWeight: 600 }}>{c.quoi}</div>
                                <div className="meta" style={{ fontSize: 11.5 }}>
                                  interne <code>{c.interne}</code> · externe <code>{c.externe}</code>
                                </div>
                                <div style={{ fontSize: 11.5, marginTop: 2 }}>{c.effet}</div>
                              </div>
                            ))}
                            <div className="meta" style={{ fontSize: 11.5, marginTop: 6 }}>
                              La correction est de <strong>renumeroter le cote externe</strong>. Aucune regle de NAT ne
                              rattrape ceci : la decision est prise par une table de routage qui a raison.
                            </div>
                          </div>
                        );
                      })()}

                      <div style={{ marginTop: 10 }}>
                        <div style={legend}>
                          📟 {ctx.mlsExterne.routeur} — la configuration
                          <button type="button" style={{ ...smallBtn, marginLeft: 'auto' }}
                            onClick={() => copy('ext', configRouteurExterne(ctx.mlsExterne!, sortie!))}>{copied === 'ext' ? '✓ Copie' : 'Copier'}</button>
                        </div>
                        <pre style={preStyle}><code>{configRouteurExterne(ctx.mlsExterne, sortie!)}</code></pre>
                        <div className="meta" style={{ fontSize: 11.5 }}>
                          Ni NAT ni route par defaut : la traduction a lieu une seule fois, au pare-feu, et deux routes
                          par defaut qui se designent mutuellement font tourner les paquets inconnus entre les deux.
                        </div>
                      </div>

                      <div style={{ marginTop: 10 }}>
                        <div style={legend}>🖥️ Le serveur qui joue le site</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <tbody>
                            {ficheSite(ctx.mlsExterne).map(f => (
                              <tr key={f.champ}>
                                <td style={{ ...tdMls, width: 140, fontWeight: 600 }}>{f.champ}</td>
                                <td style={tdMls}><code style={{ fontSize: 11 }}>{f.valeur}</code></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="meta" style={{ fontSize: 11.5 }}>
                          La <strong>passerelle</strong> est aussi indispensable que l'adresse : sans elle, le serveur
                          repond a ses voisins et a personne d'autre — la demande arrive, la reponse ne repart pas.
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div style={group}>
                <div style={legend}>💻 Ce qu'il faut aux postes pour arriver jusqu'au site</div>
                <div className="meta" style={{ fontSize: 11.5, margin: '0 0 8px' }}>
                  Le routage, la traduction et les routes de retour ne suffisent pas : un poste sans
                  <strong> passerelle</strong> ni <strong>DNS</strong> ne va nulle part. Et l'on cherche alors la panne
                  dans le pare-feu alors qu'elle est dans l'etendue DHCP.
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div className="meta" style={{ fontSize: 11.5 }}>
                    DNS distribue : {mlsClients.dns ? <code>{mlsClients.dns}</code> : <em>aucun (ecran DNS)</em>}
                    {' · '}domaine : {mlsClients.domaine ? <code>{mlsClients.domaine}</code> : <em>aucun</em>}
                    {' · '}bail : {mlsClients.bailJours} j
                  </div>
                  <label style={{ fontSize: 11.5 }}>Site a joindre (nom)<br />
                    <input value={ctx.mlsSite?.nom ?? ''} placeholder="www.exemple.lan" style={{ ...field, width: 150 }}
                      onChange={e => set({ mlsSite: { nom: e.target.value, ip: ctx.mlsSite?.ip || '' } })} />
                  </label>
                  <label style={{ fontSize: 11.5 }}>son IP<br />
                    <input value={ctx.mlsSite?.ip ?? ''} placeholder="198.51.100.10" style={{ ...field, width: 130 }}
                      onChange={e => set({ mlsSite: { nom: ctx.mlsSite?.nom || '', ip: e.target.value } })} />
                  </label>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={legend}>📋 Les etendues DHCP — une par VLAN qui en demande</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>{['VLAN', 'Etendue', 'Reseau', 'Passerelle', 'Plage distribuee', 'DNS'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '4px 7px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {etendues(mlsPlan, mlsClients).map(e => (
                        <tr key={e.vlan}>
                          <td style={tdMls}><strong>{e.vlan}</strong></td>
                          <td style={tdMls}>{e.nom}</td>
                          <td style={tdMls}>{e.reseau} {e.masque}</td>
                          <td style={tdMls}><code style={{ fontSize: 11 }}>{e.passerelle}</code></td>
                          <td style={tdMls}>{e.debut} → {e.fin}</td>
                          <td style={tdMls}>{e.dns || <em>aucun</em>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="meta" style={{ fontSize: 11.5, marginTop: 4 }}>
                    A saisir sur le serveur DHCP. La passerelle de chaque etendue est la <strong>SVI</strong> du VLAN —
                    c'est elle qui manque quand un poste a une adresse mais ne sort pas.
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={legend}>
                    📶 Variante — les etendues portees par {mlsPlan.multicouches[0]?.nom} lui-meme
                    <button type="button" style={{ ...smallBtn, marginLeft: 'auto' }}
                      onClick={() => copy('mlsdhcp', configDhcpSurMls(mlsPlan, mlsClients))}>{copied === 'mlsdhcp' ? '✓ Copie' : 'Copier'}</button>
                  </div>
                  <pre style={preStyle}><code>{configDhcpSurMls(mlsPlan, mlsClients)}</code></pre>
                  <div className="meta" style={{ fontSize: 11.5 }}>
                    Un equipement de moins que le couple serveur + relais — pratique pour savoir si le reste
                    fonctionne quand le serveur, lui, ne repond pas.
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={legend}>
                    🌐 La resolution de noms, sur les equipements
                    <button type="button" style={{ ...smallBtn, marginLeft: 'auto' }}
                      onClick={() => copy('mlsdns', configResolution(mlsClients))}>{copied === 'mlsdns' ? '✓ Copie' : 'Copier'}</button>
                  </div>
                  <pre style={preStyle}><code>{configResolution(mlsClients)}</code></pre>
                  <div className="meta" style={{ fontSize: 11.5 }}>
                    A ne pas confondre avec le DNS des postes : un <code>ping</code> par nom depuis la console echoue
                    tant que l'equipement lui-meme ne connait pas de serveur DNS, meme quand les postes resolvent.
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={legend}>🧭 Tester depuis un poste, dans l'ordre</div>
                  {verificationsClient(mlsPlan, mlsClients, sortie ?? undefined).map(sec => (
                    <div key={sec.titre} style={{ margin: '6px 0' }}>
                      <div style={{ fontWeight: 600, fontSize: 12.5 }}>{sec.titre}</div>
                      <pre style={preStyle}><code>{sec.lignes.join('\n')}</code></pre>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={legend}>🛠️ Les pannes vues du poste</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <tbody>
                      {PANNES_CLIENT.map(x => (
                        <tr key={x.symptome}>
                          <td style={tdMls}>{x.symptome}</td>
                          <td style={tdMls}>{x.cause}</td>
                          <td style={tdMls}><code style={{ fontSize: 11 }}>{x.verif}</code></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={group}>
                <div style={legend}>🛠️ Les pannes ou tout semble juste</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>{['Symptome', 'Cause la plus probable', 'Verification'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '4px 7px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {PANNES_MLS.map(x => (
                      <tr key={x.symptome}>
                        <td style={tdMls}>{x.symptome}</td>
                        <td style={tdMls}>{x.cause}</td>
                        <td style={tdMls}><code style={{ fontSize: 11 }}>{x.verif}</code></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {step === 11 && (
        <div>
          <div style={group}>
            <div style={legend}>🔌 Couche 1 — le materiel, avant toute adresse</div>
            <div className="meta" style={{ fontSize: 11.5, margin: '0 0 6px' }}>
              L'atelier travaillait a l'envers du montage reel : on declarait des sous-reseaux et le materiel s'en
              deduisait. Ici on pose les equipements et on tire les cables — l'adressage vient apres, en couche 3.
            </div>
            <div className="meta" style={{ fontSize: 11.5 }}>
              Cet inventaire ne connait <strong>aucune adresse IP</strong>. C'est voulu : melanger les couches est
              exactement ce que le modele OSI apprend a ne pas faire.
            </div>
          </div>

          <div style={group}>
            <div style={legend}>
              🗄️ L'inventaire
              <span className="meta" style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 400 }}>
                {ctx.materiels.length} equipement(s) · {ctx.cables.length} lien(s)
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {(['routeur', 'multicouche', 'switch', 'serveur', 'poste', 'nuage'] as TypeMateriel[]).map(t => (
                <button key={t} type="button" style={smallBtn}
                  onClick={() => set({ materiels: [...ctx.materiels, {
                    id: 'mat' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
                    nom: t.charAt(0).toUpperCase() + t.slice(1) + '-' + (ctx.materiels.filter(m => m.type === t).length + 1),
                    type: t, modele: '', ports: PORTS_TYPIQUES[t],
                  }] })}>+ {t}</button>
              ))}
            </div>

            {ctx.materiels.length === 0 && (
              <div className="meta" style={{ fontSize: 12 }}>
                Aucun equipement. Commence par ce que tu as devant toi — un multicouche, des switches, des postes.
              </div>
            )}

            {ctx.materiels.map((m, i) => {
              const majMat = (patch: Partial<Materiel>) =>
                set({ materiels: ctx.materiels.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
              const liens = voisinsDe(ctx.cables, m.id);
              return (
                <div key={m.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', margin: '6px 0' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input value={m.nom} style={{ ...field, width: 140 }} onChange={e => majMat({ nom: e.target.value })} />
                    <select value={m.type} style={{ ...field, width: 130 }}
                      onChange={e => majMat({ type: e.target.value as TypeMateriel, ports: PORTS_TYPIQUES[e.target.value as TypeMateriel] })}>
                      {(['routeur', 'multicouche', 'switch', 'serveur', 'poste', 'nuage'] as TypeMateriel[]).map(t =>
                        <option key={t} value={t}>{t}</option>)}
                    </select>
                    {/* Le modele d'un routeur decide de ses interfaces : le laisser
                        en texte libre laissait retomber toute faute de frappe sur
                        le 2911, sans le dire. */}
                    {m.type === 'routeur' || m.type === 'switch' || m.type === 'multicouche' ? (
                      <select value={m.modele} style={{ ...field, width: 90 }}
                        onChange={e => majMat({ modele: e.target.value })}>
                        {(m.type === 'routeur' ? ['2911', '2811'] : m.type === 'switch' ? ['2960'] : ['3560', '3750']).map(x => <option key={x} value={x}>{x}</option>)}
                      </select>
                    ) : (
                      <input value={m.modele} placeholder="modele" style={{ ...field, width: 90 }}
                        onChange={e => majMat({ modele: e.target.value })} />
                    )}
                    <label style={{ fontSize: 11.5 }}>ports&nbsp;
                      <input type="number" min={1} max={48} value={m.ports} style={{ ...field, width: 62 }}
                        onChange={e => majMat({ ports: Math.max(1, Number(e.target.value) || 1) })} />
                    </label>
                    <span className="meta" style={{ fontSize: 11 }}>couche {COUCHE_DE[m.type]} · {liens.length} lien(s)</span>
                    <button type="button" style={{ ...smallBtn, marginLeft: 'auto' }}
                      onClick={() => set({
                        materiels: ctx.materiels.filter(x => x.id !== m.id),
                        // Un cable vers un equipement supprime n'a plus de sens :
                        // le laisser produirait un lien fantome dans le schema.
                        cables: ctx.cables.filter(c => c.deId !== m.id && c.versId !== m.id),
                        physPos: Object.fromEntries(Object.entries(ctx.physPos).filter(([k]) => k !== m.id)),
                        // Et les couches hautes le lachent aussi : un sous-reseau
                        // qui pointe vers un routeur absent n'a plus de passerelle,
                        // et une SVI vers un multicouche disparu non plus.
                        services: ctx.services.map(x => ({
                          ...x,
                          routerIds: x.routerIds.filter(r => r !== m.id),
                          svi: x.svi === m.id ? undefined : x.svi,
                        })),
                        ...(ctx.internetRouterId === m.id ? { internetRouterId: '' } : {}),
                      })}>Retirer</button>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={group}>
            <div style={legend}>🧵 Le cablage</div>
            <SchemaAtelier
              materiels={ctx.materiels} cables={ctx.cables} positions={ctx.physPos}
              interfaces={ifacesSchema} nomPort={(m, p) => nomPortDe(ctx, m, p)}
              onPos={(id, q) => set({ physPos: q ? { ...ctx.physPos, [id]: q } : Object.fromEntries(Object.entries(ctx.physPos).filter(([k]) => k !== id)) })}
              onCable={c => set({ cables: [...ctx.cables, c] })}
              onRetirer={id => set({ cables: ctx.cables.filter(x => x.id !== id) })}
              onReplacerTout={() => set({ physPos: {} })}
              onRestaurer={restaurerSchema} />
            <div className="meta" style={{ fontSize: 11, marginTop: 5 }}>
              Le media suit la regle des couches : <strong>meme couche → croise</strong>, couches differentes → droit.
              Un cable en rouge ne la respecte pas. Double-clic sur un equipement pour le remettre a sa place.
            </div>
          </div>

          {/* Le schema physique est complet ici : materiels, cables, et le plan
              d'adressage deja calcule. C'est le seul endroit ou l'exporter a du
              sens — plus tot il serait vide, plus tard il ne dirait rien de plus. */}
          <OuvrirDansPlan ctx={ctx} plan={plan} />

          {/* La liste reste, pour imposer un port precis — celui du TP, ou celui
              qu'on a devant soi. Repliee : ce n'est plus le chemin normal. */}
          <details style={group}>
            <summary style={{ ...legend, marginBottom: 0, cursor: 'pointer' }}>
              🔧 Ajuster les ports a la main
              <span className="meta" style={{ fontSize: 11.5, fontWeight: 400 }}>({ctx.cables.length} lien(s))</span>
            </summary>
            <div style={{ marginTop: 10 }} />
            {ctx.cables.map((c, i) => {
              const majCab = (patch: Partial<Cable>) =>
                set({ cables: ctx.cables.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
              const a = ctx.materiels.find(m => m.id === c.deId);
              const b = ctx.materiels.find(m => m.id === c.versId);
              const attendu = a && b ? cableAttendu(a.type, b.type) : null;
              return (
                <div key={c.id} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', margin: '5px 0' }}>
                  <select value={c.deId} style={{ ...field, width: 140 }}
                    onChange={e => majCab({ deId: e.target.value })}>
                    {ctx.materiels.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                  </select>
                  <input type="number" min={1} value={c.dePort} style={{ ...field, width: 58 }}
                    onChange={e => majCab({ dePort: Math.max(1, Number(e.target.value) || 1) })} />
                  <span style={{ fontSize: 12 }}>↔</span>
                  <select value={c.versId} style={{ ...field, width: 140 }}
                    onChange={e => majCab({ versId: e.target.value })}>
                    {ctx.materiels.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                  </select>
                  <input type="number" min={1} value={c.versPort} style={{ ...field, width: 58 }}
                    onChange={e => majCab({ versPort: Math.max(1, Number(e.target.value) || 1) })} />
                  <select value={c.media} style={{ ...field, width: 150 }}
                    onChange={e => majCab({ media: e.target.value as Media })}>
                    {(['droit', 'croise', 'serie', 'fibre'] as Media[]).map(x =>
                      <option key={x} value={x}>{x}{attendu === x ? ' ✓' : ''}</option>)}
                  </select>
                  <button type="button" style={smallBtn}
                    onClick={() => set({ cables: ctx.cables.filter(x => x.id !== c.id) })}>✕</button>
                </div>
              );
            })}
          </details>

          {(() => {
            const pb = verifierCablage(ctx.materiels, ctx.cables);
            if (!ctx.materiels.length) return null;
            if (!pb.length) {
              return (
                <div style={group}>
                  <div className="meta" style={{ fontSize: 12, color: 'var(--ok, #059669)' }}>
                    ✓ Cablage coherent — aucun port double, aucun cable manquant, aucun mauvais type.
                  </div>
                </div>
              );
            }
            return (
              <div style={{ ...group, border: '1px solid var(--danger, #c4462f)' }}>
                <div style={{ ...legend, color: 'var(--danger, #c4462f)' }}>⚠ Ce que le cablage va provoquer</div>
                {pb.map((x, k) => (
                  <div key={k} style={{ marginTop: 5, fontSize: 12 }}>
                    <div style={{ fontWeight: 600 }}>{x.quoi}</div>
                    <div style={{ fontSize: 11.5 }}>{x.effet}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {ctx.materiels.length >= 2 && (
            <div style={group}>
              <div style={legend}>🧭 Y a-t-il un chemin ?</div>
              <div className="meta" style={{ fontSize: 11.5, marginBottom: 5 }}>
                La premiere chose a eliminer devant « ces deux-la ne se voient pas » : sans chemin de cables,
                aucune configuration n'y changera rien.
              </div>
              {(() => {
                const a = ctx.materiels[0]!, b = ctx.materiels[ctx.materiels.length - 1]!;
                const chemin = cheminPhysique(ctx.cables, a.id, b.id);
                const nom = (id: string) => ctx.materiels.find(m => m.id === id)?.nom ?? id;
                return (
                  <div style={{ fontSize: 12 }}>
                    <strong>{a.nom}</strong> → <strong>{b.nom}</strong> :{' '}
                    {chemin
                      ? <code style={{ fontSize: 11 }}>{chemin.map(nom).join(' → ')}</code>
                      : <span style={{ color: 'var(--danger, #c4462f)' }}>aucun chemin physique</span>}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {step === 8 && (
        <div>
          <div style={group}>
            <div style={legend}>
              🔌 Plan de tests ping (communication réseau)
              {!!tests.full && <button type="button" onClick={() => copy('testsAll', tests.full)} style={{ ...btn, marginLeft: 'auto' }}>{copied === 'testsAll' ? '✓ Copié' : 'Tout copier'}</button>}
            </div>
            <div className="meta" style={{ fontSize: 11.5, margin: '0 0 10px' }}>On valide du plus proche au plus lointain : la <strong>première</strong> commande qui échoue localise la panne. Les <strong>interfaces de routeur</strong> répondent toujours → idéales pour juger le routage sans le pare-feu Windows.</div>
            {tests.sections.map((sec, k) => (
              <div key={k} style={{ marginBottom: 12 }}>
                <strong style={{ fontSize: 13 }}>{sec.title}</strong>
                <pre style={{ ...preStyle, marginTop: 5 }}><code>{sec.lines.join('\n')}</code></pre>
              </div>
            ))}
            {!tests.sections.length && <div className="meta">Définis des sous-réseaux et une topologie (étapes 1 &amp; 3) pour générer les tests.</div>}
            <div className="meta" style={{ fontSize: 11.5, marginTop: 4 }}>Un ping vers un <strong>poste/serveur Windows</strong> peut échouer à cause du <strong>pare-feu</strong> même si le routage est bon → autorise l’ICMP entrant, ou fie-toi aux interfaces de routeur. Pinguer sa <em>propre</em> passerelle réussit même sans passerelle par défaut : ça ne prouve pas le routage.</div>
          </div>
          <StepNav step={step} setStep={setStep} />
        </div>
      )}

      {/* ── Étape 13 : DNS & DHCP pour Linux ── */}
      {step === 13 && (
        <div>
          <div style={group}>
            <div style={legend}>🐧 Options des scripts Linux</div>
            <div className="meta" style={{ fontSize: 11.5, margin: '0 0 10px' }}>
              Le plan d'adressage produit ici les fichiers d'un serveur <strong>Debian</strong> : le <strong>DHCP</strong> (isc-dhcp-server) et le <strong>DNS</strong> (BIND9), prêts à coller. Domaine <code>{dns.domain}</code>, serveur DNS <code>{(ctx.dnsServer || '').trim() || '(non défini — Préférences)'}</code>.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
              <label style={{ fontSize: 12 }}>Interface d'écoute (DHCP)<br />
                <input style={{ ...field, ...mono }} value={lxIface} onChange={e => setLxIface(e.target.value)} placeholder="ens18" />
              </label>
              <label style={{ fontSize: 12 }}>Redirecteurs DNS (forwarders)<br />
                <input style={{ ...field, ...mono }} value={lxForwarders} onChange={e => setLxForwarders(e.target.value)} placeholder="1.1.1.1, 8.8.8.8" />
              </label>
              <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', marginTop: 20 }}>
                <input type="checkbox" checked={lxAuthoritative} onChange={e => setLxAuthoritative(e.target.checked)} /> DHCP <code>authoritative</code>
              </label>
              <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', marginTop: 20 }}>
                <input type="checkbox" checked={lxReverse} onChange={e => setLxReverse(e.target.checked)} /> Générer la zone <strong>inverse</strong>
              </label>
            </div>
            <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>Requêtes DNS autorisées : <code>{lxAllowQuery}</code> · bail DHCP : <code>{clampNum(Number(ctx.leaseDays) || 7, 0, 365)} j</code> (Préférences).</div>
          </div>

          <div style={group}>
            <div style={legend}>📡 DHCP — isc-dhcp-server</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}><strong style={{ fontSize: 13 }}>1. Installation</strong>
                <button type="button" onClick={() => copy('lxDhcpI', dhcpLx.install)} style={{ ...smallBtn, marginLeft: 'auto' }}>{copied === 'lxDhcpI' ? '✓ Copié' : 'Copier'}</button></div>
              <pre style={preStyle}><code>{dhcpLx.install}</code></pre>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}><strong style={{ fontSize: 13, ...mono }}>2. /etc/dhcp/dhcpd.conf</strong>
                <button type="button" onClick={() => copy('lxDhcpC', dhcpLx.conf)} style={{ ...smallBtn, marginLeft: 'auto' }}>{copied === 'lxDhcpC' ? '✓ Copié' : 'Copier'}</button></div>
              <pre style={preStyle}><code>{dhcpLx.conf}</code></pre>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}><strong style={{ fontSize: 13, ...mono }}>3. /etc/default/isc-dhcp-server</strong>
                <button type="button" onClick={() => copy('lxDhcpD', dhcpLx.defauts)} style={{ ...smallBtn, marginLeft: 'auto' }}>{copied === 'lxDhcpD' ? '✓ Copié' : 'Copier'}</button></div>
              <pre style={preStyle}><code>{dhcpLx.defauts}</code></pre>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}><strong style={{ fontSize: 13 }}>4. Vérifier &amp; démarrer</strong>
                <button type="button" onClick={() => copy('lxDhcpV', dhcpLx.verifs)} style={{ ...smallBtn, marginLeft: 'auto' }}>{copied === 'lxDhcpV' ? '✓ Copié' : 'Copier'}</button></div>
              <pre style={preStyle}><code>{dhcpLx.verifs}</code></pre>
            </div>
          </div>

          <div style={group}>
            <div style={legend}>🌐 DNS — BIND9</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}><strong style={{ fontSize: 13 }}>1. Installation</strong>
                <button type="button" onClick={() => copy('lxDnsI', dnsLx.install)} style={{ ...smallBtn, marginLeft: 'auto' }}>{copied === 'lxDnsI' ? '✓ Copié' : 'Copier'}</button></div>
              <pre style={preStyle}><code>{dnsLx.install}</code></pre>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}><strong style={{ fontSize: 13, ...mono }}>2. named.conf.options</strong>
                <button type="button" onClick={() => copy('lxDnsO', dnsLx.options)} style={{ ...smallBtn, marginLeft: 'auto' }}>{copied === 'lxDnsO' ? '✓ Copié' : 'Copier'}</button></div>
              <pre style={preStyle}><code>{dnsLx.options}</code></pre>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}><strong style={{ fontSize: 13, ...mono }}>3. named.conf.local</strong>
                <button type="button" onClick={() => copy('lxDnsL', dnsLx.local)} style={{ ...smallBtn, marginLeft: 'auto' }}>{copied === 'lxDnsL' ? '✓ Copié' : 'Copier'}</button></div>
              <pre style={preStyle}><code>{dnsLx.local}</code></pre>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}><strong style={{ fontSize: 13, ...mono }}>4. db.{dns.domain} (zone directe)</strong>
                <button type="button" onClick={() => copy('lxDnsZ', dnsLx.zoneDirecte)} style={{ ...smallBtn, marginLeft: 'auto' }}>{copied === 'lxDnsZ' ? '✓ Copié' : 'Copier'}</button></div>
              <pre style={preStyle}><code>{dnsLx.zoneDirecte}</code></pre>
            </div>
            {lxReverse && dnsLx.zoneInverse && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}><strong style={{ fontSize: 13, ...mono }}>5. db.{dnsLx.reverseName} (zone inverse)</strong>
                  <button type="button" onClick={() => copy('lxDnsR', dnsLx.zoneInverse)} style={{ ...smallBtn, marginLeft: 'auto' }}>{copied === 'lxDnsR' ? '✓ Copié' : 'Copier'}</button></div>
                <pre style={preStyle}><code>{dnsLx.zoneInverse}</code></pre>
              </div>
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}><strong style={{ fontSize: 13 }}>{lxReverse && dnsLx.zoneInverse ? '6.' : '5.'} Vérifier &amp; tester</strong>
                <button type="button" onClick={() => copy('lxDnsV', dnsLx.verifs)} style={{ ...smallBtn, marginLeft: 'auto' }}>{copied === 'lxDnsV' ? '✓ Copié' : 'Copier'}</button></div>
              <pre style={preStyle}><code>{dnsLx.verifs}</code></pre>
            </div>
            <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>💡 Sur le client, mettre ce serveur en <code>nameserver</code> (<code>/etc/resolv.conf</code> ou reçu par DHCP). Toujours <code>named-checkconf</code> / <code>named-checkzone</code> <strong>avant</strong> de recharger.</div>
          </div>
          <StepNav step={step} setStep={setStep} />
        </div>
      )}

      {dialMat && (() => {
        const m = ctx.materiels.find(x => x.id === dialMat);
        if (!m) return null;
        return (
          <DialogueMateriel ctx={ctx} m={m} mlsPlan={mlsPlan} plan={plan}
            onPatch={patch => set({ materiels: ctx.materiels.map(x => x.id === m.id ? { ...x, ...patch } : x) })}
            onPorts={ports => set({ optSwitches: { ...ctx.optSwitches, [m.id]: { vlans: ctx.optSwitches[m.id]?.vlans ?? [], ports_: ports.length ? ports : undefined } } })}
            onCtx={patch => set(patch)}
            onRetirerCable={id => set({ cables: ctx.cables.filter(c => c.id !== id) })}
            onClose={() => setDialMat(null)} />
        );
      })()}
    </div>
  );
}

function clientRange(ctx: Ctx, s: Sub): [number, number] | null {
  if (s.gw === null) return null;
  if (ctx.gwPos === 'last') {
    const hi = s.switchIp !== null ? (s.switchIp - 1) >>> 0 : (s.gw - 1) >>> 0;
    return hi >= s.first ? [s.first, hi] : null;
  }
  const lo = s.switchIp !== null ? (s.switchIp + 1) >>> 0 : (s.gw + 1) >>> 0;
  return lo <= s.last ? [lo, s.last] : null;
}

const CLOUD_COLORS = ['#ec4899', '#22c55e', '#eab308', '#38bdf8', '#a855f7', '#f97316', '#14b8a6', '#f43f5e'];

/**
 * Le schéma de la topologie à switch multicouche.
 *
 * Distinct de `SchemaSvg`, qui place des routeurs par un algorithme radial :
 * ici la forme est connue d'avance — un **arbre**. Le multicouche à la racine,
 * ses switches en dessous, ceux en cascade encore en dessous, et les VLAN sous
 * chaque switch.
 *
 * La première version ne dessinait qu'un niveau : un switch en cascade
 * disparaissait purement et simplement du schéma, et ses étiquettes de VLAN se
 * superposaient à celles du voisin. Un schéma faux est pire qu'une absence de
 * schéma — on le recopie.
 *
 * Les hauteurs de niveau sont **calculées**, pas choisies : chaque étage est
 * assez haut pour ses pastilles de VLAN les plus nombreuses. C'est ce qui
 * garantit qu'aucune ne chevauche l'étage suivant, quel que soit le montage.
 */
function SchemaMls({ ctx, plan, onPos }: { ctx: Ctx; plan: Plan; onPos?: (id: string, p: { x: number; y: number } | null) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [attrape, setAttrape] = useState<string | null>(null);
  const mlsPlan = buildMlsPlan(ctx, plan);

  if (!mlsPlan.vlans.length) {
    return <div className="meta">Donne un numéro de VLAN à au moins un sous-réseau (Segmentation) pour afficher le schéma.</div>;
  }

  const COULEURS = COULEURS_VLAN;
  const couleur = (id: number) => couleurVlan(id, mlsPlan.vlans.map(v => v.id));

  // ── L'arbre : racines = multicouches, enfants = switches qui y remontent ──
  type Noeud = { id: string; nom: string; profondeur: number; vlans: number[]; parent: string | null; sousTitre: string };
  const noeuds: Noeud[] = [];
  const colonnes = new Map<string, number>();
  let colonne = 0;

  const descendre = (parent: string, profondeur: number) => {
    const enfants = enfantsDe(mlsPlan, parent);
    for (const e of enfants) {
      noeuds.push({ id: e.id, nom: e.name, profondeur, vlans: e.vlans, parent, sousTitre: `${e.ports} ports · uplink ${e.uplink}` });
      const avant = colonne;
      descendre(e.id, profondeur + 1);
      // Une feuille prend une colonne ; un nœud avec enfants se centre sur eux.
      if (colonne === avant) { colonnes.set(e.id, colonne); colonne += 1; }
      else colonnes.set(e.id, (avant + colonne - 1) / 2);
    }
  };

  for (const m of mlsPlan.multicouches) {
    const avant = colonne;
    noeuds.push({ id: m.id, nom: m.nom, profondeur: 0, vlans: vlansDe(mlsPlan, m).map(v => v.id), parent: null, sousTitre: `ip routing · ${vlansDe(mlsPlan, m).length} SVI` });
    descendre(m.id, 1);
    if (colonne === avant) { colonnes.set(m.id, colonne); colonne += 1; }
    else colonnes.set(m.id, (avant + colonne - 1) / 2);
  }

  // ── Les hauteurs : chaque étage réserve la place de ses pastilles ─────────
  const HAUT_BOITE = 40, HAUT_PASTILLE = 20, MARGE = 34;
  const profondeurMax = Math.max(0, ...noeuds.map(n => n.profondeur));
  const pastillesMax: number[] = [];
  for (let d = 0; d <= profondeurMax; d++) {
    // Le multicouche n'affiche pas ses VLAN en pastilles : ils sont sur ses SVI,
    // pas sur des ports — les montrer là ferait croire à des postes branchés.
    pastillesMax[d] = d === 0 ? 0 : Math.max(0, ...noeuds.filter(n => n.profondeur === d).map(n => n.vlans.length));
  }
  const yDe = (d: number) => {
    let y = 210;
    for (let k = 0; k < d; k++) y += HAUT_BOITE + pastillesMax[k]! * HAUT_PASTILLE + MARGE;
    return y;
  };

  // Les routeurs occupent une bande au-dessus du multicouche : sans ce
  // decalage, leurs LAN se superposeraient a la chaine vers l'exterieur.
  const LARGEUR_COL = 230;
  const W = Math.max(760, colonne * LARGEUR_COL);
  const hauteur = yDe(profondeurMax) + HAUT_BOITE + pastillesMax[profondeurMax]! * HAUT_PASTILLE + 40;
  const xAuto = (id: string) => (colonnes.get(id)! + 0.5) * (W / Math.max(1, colonne));

  const versDessin = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r || !r.width) return null;
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * hauteur };
  };
  const pos = (n: Noeud) => ctx.mlsPos[n.id] ?? { x: xAuto(n.id), y: yDe(n.profondeur) };
  const parId = new Map(noeuds.map(n => [n.id, n]));

  // ── Les routeurs et leurs segments ───────────────────────────────────────
  // Un segment d'interconnexion relie des routeurs entre eux, et depuis peu un
  // routeur a un multicouche. Ses membres se lisent a deux endroits : les
  // routeurs sur le sous-reseau, le multicouche sur le service qui l'a produit.
  const svcDuSub = (sub: Sub) => ctx.services.find(x => 'svc:' + x.id === sub.id);
  const segments = plan.subs.filter(z => z.kind === 'link').map(z => ({
    sub: z,
    membres: [...(z.routerIds ?? []), ...(svcDuSub(z)?.svi ? [svcDuSub(z)!.svi!] : [])],
  }));
  const routeurs = routeursDe(ctx).filter(r => segments.some(g => g.membres.includes(r.id))
    || plan.subs.some(z => z.kind === 'lan' && z.routerId === r.id));
  // Assez haut pour qu'une etiquette de segment tienne entre les deux : a
  // quarante pixels du sommet de l'arbre, elle se posait sur le multicouche.
  const yRouteurs = 110;
  const xRouteur = (i: number) => ((i + 0.5) * W) / Math.max(1, routeurs.length);
  const posR = (r: RouterDef, i: number) => ctx.mlsPos[r.id] ?? { x: xRouteur(i), y: yRouteurs };
  const rangR = new Map(routeurs.map((r, i) => [r.id, i]));
  // Ou se trouve un membre de segment : un routeur, ou un multicouche.
  const ancre = (id: string) => {
    const i = rangR.get(id);
    if (i !== undefined) return posR(routeurs[i]!, i);
    const n = noeuds.find(x => x.id === id);
    return n ? pos(n) : null;
  };

  // La meme sortie effective que l'ecran : un schema qui dessinerait les
  // adresses saisies alors que la configuration en emet d'autres serait faux.
  const sortie = ctx.mlsSortie ? sortieEffective(ctx.mlsSortie, segmentsDeSortie(ctx, plan)) : null;
  const externe = ctx.mlsExterne;
  const racine = noeuds.find(n => n.profondeur === 0);
  const xSortie = racine ? pos(racine).x : W / 2;

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${hauteur}`}
      style={{ width: '100%', height: 'auto', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', userSelect: 'none' }}
      onMouseMove={e => { if (!attrape) return; const q = versDessin(e); if (q) onPos?.(attrape, q); }}
      onMouseUp={() => setAttrape(null)}
      onMouseLeave={() => setAttrape(null)}>

      {/* La chaîne vers l'extérieur, au-dessus de la racine. */}
      {sortie && racine && (
        <g>
          <line x1={xSortie} y1={pos(racine).y - 22} x2={xSortie} y2={126} stroke="var(--border)" strokeWidth={2} />
          <text x={xSortie + 8} y={(pos(racine).y + 110) / 2} fontSize={9.5} fill="var(--text-muted)">
            port routé · {sortie.ipMls} ↔ {sortie.ipFirewall}
          </text>
          <rect x={xSortie - 80} y={94} width={160} height={34} rx={7} fill="var(--surface-2)" stroke="#ef4444" strokeWidth={1.5} />
          <text x={xSortie} y={110} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="var(--text)">🔒 {sortie.firewall}</text>
          <text x={xSortie} y={123} textAnchor="middle" fontSize={9} fill="var(--text-muted)">NAT surchargé · {sortie.ipWan}</text>
          {externe && (
            <g>
              <line x1={xSortie} y1={94} x2={xSortie} y2={56} stroke="var(--border)" strokeWidth={2} strokeDasharray="4 3" />
              <rect x={xSortie - 120} y={22} width={240} height={34} rx={7} fill="var(--surface-2)" stroke="var(--border)" strokeWidth={1.5} />
              <text x={xSortie} y={38} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--text)">🌐 {externe.routeur} → {externe.nomSite || 'le site'}</text>
              <text x={xSortie} y={51} textAnchor="middle" fontSize={9} fill="var(--text-muted)">{externe.ipSite} · réseau externe</text>
            </g>
          )}
        </g>
      )}

      {/* Les liens, tracés avant les boîtes pour passer dessous. */}
      {noeuds.filter(n => n.parent).map(n => {
        const p = parId.get(n.parent!);
        if (!p) return null;
        const a = pos(p), b = pos(n);
        const sw = mlsPlan.acces.find(x => x.id === n.id);
        return (
          <g key={'l' + n.id}>
            <line x1={a.x} y1={a.y + HAUT_BOITE / 2} x2={b.x} y2={b.y - HAUT_BOITE / 2} stroke="var(--border)" strokeWidth={2} />
            {sw && (
              <text x={(a.x + b.x) / 2 + 5} y={(a.y + b.y) / 2} fontSize={9}
                fill={sw.uplink && sw.portMls ? 'var(--text-muted)' : '#ca8a04'}>
                {sw.uplink && sw.portMls ? `trunk ${sw.portMls} ↔ ${sw.uplink}` : 'ports à définir'}
              </text>
            )}
          </g>
        );
      })}

      {/* Les segments d'interconnexion, routeur <-> routeur ou routeur <-> SVI. */}
      {segments.map(g => {
        const pts = g.membres.map(ancre).filter((q): q is { x: number; y: number } => !!q);
        if (pts.length < 2) return null;
        const texte = `${g.sub.name} · ${ipToStr(g.sub.net)}/${g.sub.cidr}`;
        const l = Math.max(120, texte.length * 4.9 + 16);
        // A deux, un segment est un cable : une ligne d'un bout a l'autre, et
        // l'etiquette au milieu. Au-dela, c'est un domaine de diffusion partage,
        // et l'etoile depuis son centre dit mieux ce qu'il est.
        const duo = pts.length === 2;
        const cx = duo ? (pts[0]!.x + pts[1]!.x) / 2 : pts.reduce((t, q) => t + q.x, 0) / pts.length;
        const cy = duo ? (pts[0]!.y + pts[1]!.y) / 2 : pts.reduce((t, q) => t + q.y, 0) / pts.length;
        // Une etiquette qui deborde du dessin est illisible a droite comme a gauche.
        const lx = Math.min(Math.max(cx, l / 2 + 2), W - l / 2 - 2);
        return (
          <g key={'seg' + g.sub.id}>
            {duo
              ? <line x1={pts[0]!.x} y1={pts[0]!.y} x2={pts[1]!.x} y2={pts[1]!.y} stroke="var(--accent)" strokeWidth={1.6} strokeDasharray="5 3" />
              : pts.map((q, k) => (
                <line key={k} x1={cx} y1={cy} x2={q.x} y2={q.y} stroke="var(--accent)" strokeWidth={1.6} strokeDasharray="5 3" />
              ))}
            <rect x={lx - l / 2} y={cy - 9} width={l} height={18} rx={9} fill="var(--surface)" stroke="var(--accent)" strokeWidth={1} />
            <text x={lx} y={cy + 4} textAnchor="middle" fontSize={8.5} fill="var(--text)">{texte}</text>
          </g>
        );
      })}

      {/* Les routeurs, et les LAN qu'ils routent eux-memes. */}
      {routeurs.map((r, i) => {
        const q = posR(r, i);
        const siens = plan.subs.filter(z => z.kind === 'lan' && z.routerId === r.id);
        return (
          <g key={r.id}>
            <g style={{ cursor: attrape === r.id ? 'grabbing' : 'grab' }}
              onMouseDown={e => { e.preventDefault(); setAttrape(r.id); }}
              onDoubleClick={() => onPos?.(r.id, null)}>
              <rect x={q.x - 62} y={q.y - 17} width={124} height={34} rx={7}
                fill="var(--surface-2)" stroke="var(--accent)" strokeWidth={1.5} />
              <text x={q.x} y={q.y - 1} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="var(--text)">📟 {r.name}</text>
              <text x={q.x} y={q.y + 11} textAnchor="middle" fontSize={9} fill="var(--text-muted)">{r.model}</text>
            </g>
            {/* Les LAN du routeur se posent a DROITE de sa boite, pas au-dessus :
                au-dessus, ils entraient dans la chaine vers l'exterieur. */}
            {siens.map((z, k) => {
              // A droite du routeur, sauf quand l'etiquette sortirait du dessin :
              // elle passe alors a gauche, plutot que d'etre coupee au bord.
              const large = 186;
              const rx = q.x + 68 + large <= W ? q.x + 68 : Math.max(2, q.x - 68 - large);
              return (
                <g key={z.id}>
                  <rect x={rx} y={q.y - 9 + k * 20} width={large} height={17} rx={8.5}
                    fill="color-mix(in srgb, var(--accent) 10%, transparent)" stroke="var(--accent)" strokeWidth={0.8} />
                  <text x={rx + large / 2} y={q.y + 3 + k * 20} textAnchor="middle" fontSize={8.5} fill="var(--text)">
                    {z.vlan ? `VLAN ${z.vlan} · ` : ''}{z.name} · {ipToStr(z.net)}/{z.cidr}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}

      {noeuds.map((n, i) => {
        const { x, y } = pos(n);
        const racineIci = n.profondeur === 0;
        const largeur = racineIci ? 200 : 150;
        return (
          <g key={n.id}>
            <g style={{ cursor: attrape === n.id ? 'grabbing' : 'grab' }}
              onMouseDown={e => { e.preventDefault(); setAttrape(n.id); }}
              onDoubleClick={() => onPos?.(n.id, null)}>
              <rect x={x - largeur / 2} y={y - HAUT_BOITE / 2} width={largeur} height={HAUT_BOITE} rx={7}
                fill="var(--surface-2)" stroke={racineIci ? COULEURS[i % COULEURS.length] : 'var(--border)'} strokeWidth={1.5} />
              <text x={x} y={y - 3} textAnchor="middle" fontSize={racineIci ? 12.5 : 11.5} fontWeight={600} fill="var(--text)">
                {racineIci ? '🗼' : '🗄️'} {n.nom}
              </text>
              <text x={x} y={y + 12} textAnchor="middle" fontSize={9} fill="var(--text-muted)">{n.sousTitre}</text>
            </g>

            {/* Les VLAN portés par ce switch, empilés sous sa boîte. */}
            {!racineIci && n.vlans.map((id, k) => {
              const v = mlsPlan.vlans.find(z => z.id === id);
              const yv = y + HAUT_BOITE / 2 + 8 + k * HAUT_PASTILLE;
              const c = couleur(id);
              return (
                <g key={id}>
                  <rect x={x - 95} y={yv} width={190} height={17} rx={8.5}
                    fill={`color-mix(in srgb, ${c} 14%, transparent)`} stroke={c} strokeWidth={1} />
                  <text x={x} y={yv + 12} textAnchor="middle" fontSize={9} fill="var(--text)">
                    {id} {v?.name ?? ''} · {v?.reseau}/{v?.cidr}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

function SchemaSvg({ ctx, plan }: { ctx: Ctx; plan: Plan }) {
  const routers = routeursDe(ctx);
  if (!routers.length) return <div className="meta">Ajoute des routeurs (étape 3) pour afficher le schéma.</div>;
  const lanSubs = plan.subs.filter(s => s.kind === 'lan');
  const linkSubs = plan.subs.filter(s => s.kind === 'link');

  // ── Graphe de placement : nœuds = routeurs + UN switch par interconnexion
  //    Ethernet. Le switch d'une liaison à N routeurs devient un vrai nœud
  //    (au centre de l'étoile) au lieu d'un barycentre qui tomberait sur un
  //    routeur. Les liaisons série (point-à-point) relient 2 routeurs directement.
  const rKey = (id: string) => `r:${id}`;
  const sKey = (s: Sub) => `s:${s.id}`;
  const memberIds = (s: Sub) => (s.routerIds || []).filter(id => routers.some(r => r.id === id));
  const nodeKeys: string[] = routers.map(r => rKey(r.id));
  const adjN = new Map<string, string[]>(nodeKeys.map(k => [k, [] as string[]]));
  const link = (a: string, b: string) => { if (!adjN.get(a)!.includes(b)) adjN.get(a)!.push(b); if (!adjN.get(b)!.includes(a)) adjN.get(b)!.push(a); };
  for (const s of linkSubs) {
    const ids = memberIds(s); if (ids.length < 2) continue;
    if (s.media === 'serial') { link(rKey(ids[0]), rKey(ids[1])); }
    else { const k = sKey(s); adjN.set(k, []); nodeKeys.push(k); for (const id of ids) link(k, rKey(id)); }
  }
  const degN = (k: string) => (adjN.get(k) || []).length;

  // ── Placement RADIAL (arbre BFS depuis le nœud le plus connecté de chaque
  //    composante). Un switch relié à N routeurs se retrouve au centre, ses
  //    routeurs tout autour → gère l'étoile (N connexions), la chaîne et l'arbre.
  const childrenN = new Map<string, string[]>(nodeKeys.map(k => [k, [] as string[]]));
  const seen = new Set<string>();
  const rootsN: string[] = [];
  for (const k0 of [...nodeKeys].sort((a, b) => degN(b) - degN(a))) {
    if (seen.has(k0)) continue;
    rootsN.push(k0); seen.add(k0);
    const q = [k0];
    while (q.length) { const cur = q.shift()!; for (const nb of (adjN.get(cur) || [])) if (!seen.has(nb)) { seen.add(nb); childrenN.get(cur)!.push(nb); q.push(nb); } }
  }
  const leavesN = new Map<string, number>();
  const countLeaves = (k: string): number => { const ch = childrenN.get(k)!; if (!ch.length) { leavesN.set(k, 1); return 1; } let s = 0; for (const c of ch) s += countLeaves(c); leavesN.set(k, s); return s; };
  rootsN.forEach(countLeaves);
  const ANG = new Map<string, number>(), DEP = new Map<string, number>();
  const assign = (k: string, a0: number, a1: number, d: number) => {
    DEP.set(k, d); ANG.set(k, (a0 + a1) / 2);
    const ch = childrenN.get(k)!; if (!ch.length) return;
    const tot = ch.reduce((s, c) => s + leavesN.get(c)!, 0) || 1; let a = a0;
    for (const c of ch) { const span = (a1 - a0) * (leavesN.get(c)! / tot); assign(c, a, a + span, d + 1); a += span; }
  };
  let acc = 0; const totL = rootsN.reduce((s, k) => s + leavesN.get(k)!, 0) || 1;
  for (const root of rootsN) { const span = 2 * Math.PI * (leavesN.get(root)! / totL); assign(root, acc, acc + span, 0); acc += span; }

  const ringGap = 235, cloudDist = 200;
  const rW = 84, rH = 46, cloudRx = 104, cloudRy = 70, segRx = 88, segRy = 50;
  const PXk = (k: string) => Math.cos(ANG.get(k) ?? 0) * (DEP.get(k) ?? 0) * ringGap;
  const PYk = (k: string) => Math.sin(ANG.get(k) ?? 0) * (DEP.get(k) ?? 0) * ringGap;
  const RX = (id: string) => PXk(rKey(id)), RY = (id: string) => PYk(rKey(id));
  // Direction « vers l'extérieur » d'un routeur = plus grand secteur libre entre
  // ses voisins de graphe (switches / routeurs) → on y accroche ses LAN.
  const outAngleR = (id: string): number => {
    const k = rKey(id); const nbs = adjN.get(k) || [];
    if (!nbs.length) return Math.PI / 2;
    const dirs = nbs.map(nb => Math.atan2(PYk(nb) - PYk(k), PXk(nb) - PXk(k))).sort((a, b) => a - b);
    let best = -1, mid = Math.PI / 2;
    for (let i = 0; i < dirs.length; i++) { const a = dirs[i], b = i + 1 < dirs.length ? dirs[i + 1] : dirs[0] + 2 * Math.PI; if (b - a > best) { best = b - a; mid = (a + b) / 2; } }
    return mid;
  };

  // ── Positions calculées ──
  const routerNodes = routers.map(r => ({ r, x: RX(r.id), y: RY(r.id) }));
  const lanNodes = routers.flatMap(r => {
    const list = lanSubs.filter(s => s.routerId === r.id);
    const base = outAngleR(r.id), spread = list.length <= 1 ? 0 : Math.min(Math.PI * 0.82, 0.6 * list.length);
    return list.map((s, k) => {
      const a = base - spread / 2 + (list.length <= 1 ? 0 : spread * (k / (list.length - 1)));
      return { s, rid: r.id, rx: RX(r.id), ry: RY(r.id), x: RX(r.id) + Math.cos(a) * cloudDist, y: RY(r.id) + Math.sin(a) * cloudDist, color: CLOUD_COLORS[Math.max(0, lanSubs.indexOf(s)) % CLOUD_COLORS.length] };
    });
  });
  type LinkNode = { s: Sub; serial: boolean; parts: { rid: string; ip: number; x: number; y: number }[]; cx: number; cy: number };
  const linkNodes = linkSubs.map((s): LinkNode | null => {
    const ids = memberIds(s); if (ids.length < 2) return null;
    const parts = ids.map((rid, k) => { const ip = plan.ifaces.find(f => f.routerId === rid && f.ip > s.net && f.ip < s.bc)?.ip ?? ((s.first + k) >>> 0); return { rid, ip, x: RX(rid), y: RY(rid) }; });
    const serial = s.media === 'serial';
    return { s, serial, parts, cx: serial ? (parts[0].x + parts[1].x) / 2 : PXk(sKey(s)), cy: serial ? (parts[0].y + parts[1].y) / 2 : PYk(sKey(s)) };
  }).filter((n): n is LinkNode => !!n);

  // ── Cadre : boîte englobante de tout ce qui est dessiné ──
  const xs: number[] = [], ys: number[] = [];
  routerNodes.forEach(n => { xs.push(n.x - rW / 2, n.x + rW / 2); ys.push(n.y - rH / 2, n.y + rH / 2); });
  lanNodes.forEach(n => { xs.push(n.x - cloudRx, n.x + cloudRx); ys.push(n.y - cloudRy, n.y + cloudRy); });
  linkNodes.forEach(n => { xs.push(n.cx - segRx, n.cx + segRx); ys.push(n.cy - segRy, n.cy + segRy); });
  if (!xs.length) { xs.push(-rW, rW); ys.push(-rH, rH); }
  const pad = 42;
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad, minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
  const width = Math.max(360, maxX - minX), height = Math.max(240, maxY - minY);

  // Un « nuage » de sous-réseau : ellipse colorée + switch central + 3 machines + libellés.
  const cloud = (cx: number, cy: number, color: string, title: string, subtitle: string, info: string) => (
    <g>
      <ellipse cx={cx} cy={cy} rx={cloudRx} ry={cloudRy} fill={color} fillOpacity={0.15} stroke={color} strokeWidth={1.4} />
      <text x={cx} y={cy - cloudRy + 16} textAnchor="middle" fontSize={12} fontWeight={800} fill="var(--text)">{title}</text>
      <text x={cx} y={cy - cloudRy + 30} textAnchor="middle" fontSize={9.5} fill="var(--text-muted)">{subtitle}</text>
      <rect x={cx - 22} y={cy - 12} width={44} height={22} rx={5} fill="var(--surface)" stroke={color} strokeWidth={1.3} />
      <text x={cx} y={cy + 3} textAnchor="middle" fontSize={11}>🔀</text>
      {[-44, 0, 44].map((dx, k) => (
        <g key={k}>
          <line x1={cx} y1={cy + 10} x2={cx + dx} y2={cy + 34} stroke={color} strokeWidth={1} />
          <rect x={cx + dx - 9} y={cy + 34} width={18} height={13} rx={2} fill="var(--surface)" stroke={color} strokeWidth={1} />
        </g>
      ))}
      <text x={cx} y={cy + cloudRy - 8} textAnchor="middle" fontSize={9} fill="var(--text-muted)">{info}</text>
    </g>
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={width} height={height} viewBox={`${minX} ${minY} ${width} ${height}`} style={{ maxWidth: 'none', display: 'block' }}>
        {/* Segments inter-routeurs : chaque routeur relié au switch central de la liaison */}
        {linkNodes.map(({ s, parts, cx, cy }) => {
          if (s.media === 'serial') {
            const mx = (parts[0].x + parts[1].x) / 2, my = (parts[0].y + parts[1].y) / 2;
            return (
              <g key={s.id}>
                <line x1={parts[0].x} y1={parts[0].y} x2={parts[1].x} y2={parts[1].y} stroke="var(--accent)" strokeWidth={2.4} strokeDasharray="7 4" />
                <text x={mx} y={my - 8} textAnchor="middle" fontSize={9.5} fontWeight={600} fill="var(--text-muted)">série · {ipToStr(s.net)}/{s.cidr}</text>
                {parts.map((p, k) => <text key={k} x={p.x + (cx - p.x) * 0.3} y={p.y + (cy - p.y) * 0.3 - 4} textAnchor="middle" fontSize={8.5} fill="var(--text-muted)">{ipToStr(p.ip)}</text>)}
              </g>
            );
          }
          return (
            <g key={s.id}>
              {parts.map((p, j) => (
                <g key={j}>
                  <line x1={p.x} y1={p.y} x2={cx} y2={cy} stroke="var(--accent)" strokeWidth={1.8} />
                  <text x={p.x + (cx - p.x) * 0.33} y={p.y + (cy - p.y) * 0.33 - 4} textAnchor="middle" fontSize={8.5} fill="var(--text-muted)">{ipToStr(p.ip)}</text>
                </g>
              ))}
              <ellipse cx={cx} cy={cy} rx={segRx} ry={segRy} fill="var(--accent)" fillOpacity={0.08} stroke="var(--accent)" strokeWidth={1.3} strokeDasharray="4 4" />
              <text x={cx} y={cy - segRy + 14} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--text)">{s.name}</text>
              <rect x={cx - 20} y={cy - 11} width={40} height={22} rx={5} fill="var(--surface)" stroke="var(--accent)" strokeWidth={1.3} />
              <text x={cx} y={cy + 4} textAnchor="middle" fontSize={11}>🔀</text>
              <text x={cx} y={cy + segRy - 6} textAnchor="middle" fontSize={9.5} fill="var(--text-muted)">{ipToStr(s.net)}/{s.cidr}</text>
            </g>
          );
        })}

        {/* LAN : liaison routeur → nuage + nuage */}
        {lanNodes.map(({ s, rid, rx, ry, x, y, color }) => {
          const ifc = s.gw !== null ? plan.ifaces.find(f => f.routerId === rid && f.ip === s.gw) : undefined;
          const info = `gw ${s.gw !== null ? ipToStr(s.gw) : '-'}${s.switchIp !== null ? ' · sw ' + ipToStr(s.switchIp) : ''}${s.dhcp ? ' · DHCP' : ''}`;
          return (
            <g key={s.id}>
              <line x1={rx} y1={ry} x2={x} y2={y} stroke={color} strokeWidth={1.8} />
              {ifc && <text x={rx + (x - rx) * 0.42} y={ry + (y - ry) * 0.42 - 4} textAnchor="middle" fontSize={8.5} fontWeight={600} fill={color}>{ifAbbr(ifc.iface)} · {ipToStr(ifc.ip)}</text>}
              {cloud(x, y, color, s.name, `${ipToStr(s.net)}/${s.cidr} · ${s.usable} h`, info)}
            </g>
          );
        })}

        {/* Routeurs (au-dessus) */}
        {routerNodes.map(({ r, x, y }) => (
          <g key={r.id}>
            <rect x={x - rW / 2} y={y - rH / 2} width={rW} height={rH} rx={9} fill="var(--accent)" />
            <text x={x} y={y - 2} textAnchor="middle" fontSize={13} fontWeight={700} fill="#fff">🧭 {r.name}</text>
            <text x={x} y={y + 13} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,.85)">{r.model}{r.mod ? ' +mod' : ''}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// Navigue selon l'ORDRE de STEPS et non par `step ± 1` : les identifiants
// d'etape ne sont plus contigus depuis l'ajout des VLAN, et l'arithmetique
// sautait l'etape ajoutee tout en desactivant « Suivant » une etape trop tot.
function StepNav({ step, setStep }: { step: number; setStep: (n: number) => void }) {
  const i = STEPS.findIndex(s => s.n === step);
  const prev = i > 0 ? STEPS[i - 1]!.n : null;
  const next = i >= 0 && i < STEPS.length - 1 ? STEPS[i + 1]!.n : null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 4 }}>
      <button type="button" onClick={() => prev !== null && setStep(prev)} disabled={prev === null} style={{ ...smallBtn, opacity: prev === null ? .4 : 1 }}>← Précédent</button>
      <button type="button" onClick={() => next !== null && setStep(next)} disabled={next === null} style={{ ...btn, opacity: next === null ? .4 : 1 }}>Suivant →</button>
    </div>
  );
}

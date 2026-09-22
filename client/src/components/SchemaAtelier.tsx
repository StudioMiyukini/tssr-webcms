import { useCallback, useEffect, useId, useMemo, useReducer, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  cableAttendu, nomDuMedia, portsLibres,
  type Cable, type Materiel, type Media, type TypeMateriel,
} from '@/lib/physique';
import { PICTO_DE, TEINTE_DE, picto, type Picto } from '@/lib/pictos-reseau';
import {
  PAS_GRILLE, VUE_INITIALE, accrocher, cadrer, deplacer, etendue, fenetre, versToile, zoomerAuCentre, zoomerVers,
  type Boite, type Point, type Vue,
} from '@/lib/camera-schema';
import {
  ancrerCables, cheminSvg, milieuOriente, pointSurContour, tracer,
  type Bout, type Cote,
} from '@/lib/trace-lien';
import {
  annuler, nouvelle, peutAnnuler, peutRetablir, poser, retablir, type Histoire,
} from '@/lib/histoire-schema';

/*
 * @id      tssr.atelier.schemaAtelier
 * @do      dessiner_et_editer_le_schema_physique
 * @role    ui
 * @layer   ui
 * @human   Le schéma de l'atelier : les équipements en pictogrammes, les câbles
 *          à angles droits, le zoom, l'annulation et l'export — comme sur
 *          plan.miyukini.org.
 *
 * CE QUE CE SCHÉMA DOIT À PLAN.
 * L'atelier et Plan dessinent le même objet — un réseau — et les élèves passent
 * de l'un à l'autre par le bouton « Continuer dans Plan ». Deux gestuelles
 * différentes pour le même dessin, c'est deux apprentissages au lieu d'un. On
 * reprend donc de Plan ce qui se transporte : ses pictogrammes au trait, sa
 * caméra, ses câbles ancrés à des bords plutôt qu'à des coordonnées, son
 * annulation qui fond les gestes continus, son export.
 *
 * CE QU'ON N'EN REPREND PAS, ET POURQUOI.
 * Plan pose n'importe quel objet n'importe où sur une toile infinie ; l'atelier
 * n'a que six natures d'équipement et un câblage qui doit rester vérifiable —
 * on ne peut pas y tracer un trait libre entre deux boîtes, parce qu'un trait
 * libre ne produit aucune configuration. Le schéma reste donc un ÉDITEUR DE
 * CÂBLAGE, pas un dessin.
 *
 * LES COULEURS SONT RÉSOLUES, PAS HÉRITÉES.
 * L'export PNG passe par une image détachée du document : une couleur écrite
 * `var(--border)` n'y vaut rien, et le schéma sortirait en noir sur noir. On lit
 * donc la palette une fois, et on écrit des couleurs concrètes.
 */

export interface EtatSchema {
  positions: Record<string, { x: number; y: number }>;
  cables: Cable[];
}

/** Une interface adressée, telle que le moteur de la couche 3 la calcule. */
export interface InterfaceSchema {
  materielId: string;
  /** Le nom d'interface : `Gig0/0`, `Fa0/1`, `Vlan10`, `Gig0/0.20`… */
  nom: string;
  ip?: string;
  vlan?: number;
}

/** Ce qu'on écrit à côté d'un port. */
export type Affichage = 'aucun' | 'nom' | 'complet';

type Palette = {
  fond: string; surface: string; bord: string; texte: string; discret: string;
  accent: string; danger: string; grille: string;
};

/* ------------------------------------------------------------------ palette */

const PALETTE_SECOURS: Palette = {
  fond: '#ffffff', surface: '#f9fafb', bord: '#e5e7eb', texte: '#111827',
  discret: '#6b7280', accent: '#2271b1', danger: '#d63638', grille: '#eef1f4',
};

function lirePalette(): Palette {
  if (typeof window === 'undefined' || typeof getComputedStyle !== 'function') return PALETTE_SECOURS;
  const s = getComputedStyle(document.documentElement);
  const v = (cle: string, defaut: string) => s.getPropertyValue(cle).trim() || defaut;
  return {
    fond: v('--surface', PALETTE_SECOURS.fond),
    surface: v('--surface-2', PALETTE_SECOURS.surface),
    bord: v('--border', PALETTE_SECOURS.bord),
    texte: v('--text', PALETTE_SECOURS.texte),
    discret: v('--text-muted', PALETTE_SECOURS.discret),
    accent: v('--accent', PALETTE_SECOURS.accent),
    danger: v('--danger', PALETTE_SECOURS.danger),
    grille: v('--surface-3', PALETTE_SECOURS.grille),
  };
}

/**
 * La palette du thème, relue quand le thème bascule.
 *
 * Un observateur plutôt qu'une dépendance au hook de thème : le schéma s'affiche
 * aussi dans l'îlot public, où ce hook n'est pas monté, et une couleur figée au
 * premier rendu resterait claire sur fond sombre.
 */
function usePalette(): Palette {
  const [pal, setPal] = useState<Palette>(lirePalette);
  useEffect(() => {
    const obs = new MutationObserver(() => setPal(lirePalette()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => obs.disconnect();
  }, []);
  return pal;
}

/* ------------------------------------------------------------- disposition */

const VUE_L = 880;
/** Sous cette hauteur, la fenêtre est plus petite que la boîte qu'elle montre. */
const HAUTEUR_MIN = 340;

/**
 * L'étage d'un équipement.
 *
 * Les étages suivent l'OSI, de haut en bas : l'opérateur, les routeurs, le
 * multicouche, les commutateurs, les postes. Un schéma qui rangerait un poste
 * au-dessus d'un routeur enseignerait le contraire de ce qu'on veut montrer.
 */
const ETAGE_DE: Record<TypeMateriel, number> = { nuage: 0, routeur: 1, multicouche: 2, switch: 3, serveur: 4, poste: 4 };
const NOM_ETAGE = ['opérateur', 'couche 3 · routeurs', 'couche 3 · multicouche', 'couche 2 · commutation', 'couches 4-7 · terminaux'];

const TAILLE_DE: Record<TypeMateriel, { w: number; h: number }> = {
  nuage: { w: 116, h: 84 },
  routeur: { w: 128, h: 88 },
  multicouche: { w: 140, h: 88 },
  switch: { w: 132, h: 84 },
  serveur: { w: 112, h: 88 },
  poste: { w: 108, h: 84 },
};

/*
 * L'écart entre deux étages laisse la place à DEUX étiquettes de port sur deux
 * lignes — celle qui descend de l'équipement du dessus, celle qui monte de
 * celui du dessous. Trop serré, les adresses se recouvrent et le schéma ment.
 */
const PAS_Y = 152;
const MARGE_Y = 72;
/** Le côté du pictogramme dans la boîte. */
const COTE_PICTO = 40;

/* ----------------------------------------------------------------- rendu */

/** Un pictogramme, posé dans un carré de la toile. */
function Pictogramme({ p, x, y, cote, teinte }: { p: Picto; x: number; y: number; cote: number; teinte: string }) {
  // Le trait est donné en unités toile puis divisé par l'échelle : sans cela il
  // s'épaissirait avec le pictogramme et l'icône deviendrait une tache.
  const trait = 1.7 / cote;
  return (
    <g transform={`translate(${x} ${y}) scale(${cote})`} strokeLinejoin="round" strokeLinecap="round">
      {p.figures.map((f, i) => (
        <path
          key={i}
          d={f.d}
          fill={f.mode === 'trait' ? 'none' : teinte}
          fillOpacity={f.mode === 'plein' ? 0.16 : 1}
          stroke={f.mode === 'rempli' ? 'none' : teinte}
          strokeWidth={trait}
        />
      ))}
    </g>
  );
}

/**
 * Le pictogramme d'une nature d'équipement, hors du schéma.
 *
 * Les cartes d'inventaire et les listes de commandes portaient un émoji ; le
 * schéma, lui, porte désormais le pictogramme de Plan. Deux jeux d'icônes pour
 * les mêmes six équipements, sur la même page, se lisent comme deux
 * nomenclatures différentes.
 */
export function PictoMateriel({ type, taille = 20, pareFeu }: { type: TypeMateriel; taille?: number; pareFeu?: boolean }) {
  const p = picto(pareFeu ? 'pare-feu' : PICTO_DE[type]);
  if (!p) return null;
  return (
    <svg width={taille} height={taille} viewBox={`0 0 ${taille} ${taille}`} aria-hidden
      style={{ flexShrink: 0, verticalAlign: '-0.15em' }}>
      <Pictogramme p={p} x={0} y={0} cote={taille} teinte={pareFeu ? '#c0392b' : TEINTE_DE[type]} />
    </svg>
  );
}

/* --------------------------------------------------------------- composant */

export function SchemaAtelier({
  materiels, cables, positions, interfaces = [], nomPort = (_m, p) => `Port ${p}`,
  onPos, onCable, onRetirer, onOuvrir, onReplacerTout, onRestaurer,
}: {
  materiels: Materiel[];
  cables: Cable[];
  positions: Record<string, { x: number; y: number }>;
  interfaces?: InterfaceSchema[];
  nomPort?: (m: Materiel, port: number) => string;
  onPos: (id: string, p: Point | null) => void;
  onCable: (c: Cable) => void;
  onRetirer: (id: string) => void;
  /** Ouvre la configuration fine d'un équipement (le clic sur la roue). */
  onOuvrir?: (id: string) => void;
  /** Rend leur place automatique à tous les équipements. */
  onReplacerTout?: () => void;
  /** Applique un état repris de l'histoire — sans quoi annuler ne ferait rien. */
  onRestaurer?: (e: EtatSchema) => void;
}) {
  const pal = usePalette();
  const svgRef = useRef<SVGSVGElement>(null);
  const motif = useId().replace(/:/g, '');

  const [vue, setVue] = useState<Vue>(VUE_INITIALE);
  const [affichage, setAffichage] = useState<Affichage>('nom');
  const [grille, setGrille] = useState(true);
  const [depart, setDepart] = useState<string | null>(null);
  const [souci, setSouci] = useState('');
  const [aBrancher, setABrancher] = useState<{ a: Materiel; b: Materiel } | null>(null);
  const [presse, setPresse] = useState<{ id: string; dx: number; dy: number; bouge: boolean } | null>(null);
  const [fond, setFond] = useState<{ x: number; y: number } | null>(null);

  /* --- placement ---------------------------------------------------------- */

  const etages = useMemo(
    () => [0, 1, 2, 3, 4].map(e => materiels.filter(m => ETAGE_DE[m.type] === e)),
    [materiels],
  );
  const rangs = useMemo(() => {
    const occupes = etages.map((l, i) => ({ i, n: l.length })).filter(x => x.n > 0);
    return new Map(occupes.map((x, k) => [x.i, k]));
  }, [etages]);

  /*
   * La hauteur de la fenêtre suit le nombre d'étages occupés.
   *
   * À hauteur fixe, il faudrait dézoomer pour voir cinq étages — et les noms de
   * port, qui sont précisément ce qu'on vient lire, deviendraient illisibles. On
   * agrandit donc la fenêtre plutôt que de rapetisser le contenu.
   */
  const vueH = useMemo(
    () => Math.max(HAUTEUR_MIN, MARGE_Y + Math.max(0, rangs.size - 1) * PAS_Y + 120),
    [rangs.size],
  );

  const auto = useCallback((m: Materiel): Point => {
    const etage = ETAGE_DE[m.type];
    const l = etages[etage];
    const k = Math.max(0, l.findIndex(x => x.id === m.id));
    return { x: ((k + 0.5) * VUE_L) / l.length, y: MARGE_Y + (rangs.get(etage) ?? 0) * PAS_Y };
  }, [etages, rangs]);

  /** La position d'un équipement — son CENTRE, comme le reste de l'atelier l'enregistre. */
  const centre = useCallback((m: Materiel): Point => positions[m.id] ?? auto(m), [positions, auto]);

  const boites = useMemo(() => {
    const out = new Map<string, Boite>();
    for (const m of materiels) {
      const c = centre(m);
      const t = TAILLE_DE[m.type] ?? { w: 120, h: 84 };
      out.set(m.id, { x: c.x - t.w / 2, y: c.y - t.h / 2, w: t.w, h: t.h });
    }
    return out;
  }, [materiels, centre]);

  const parId = useMemo(() => new Map(materiels.map(m => [m.id, m])), [materiels]);
  const ancres = useMemo(() => ancrerCables(boites, cables), [boites, cables]);

  /* --- histoire ----------------------------------------------------------- */

  const histoire = useRef<Histoire<EtatSchema>>(nouvelle({ positions, cables }));
  const premier = useRef(true);
  const restaure = useRef(false);
  const geste = useRef('');
  const [, rafraichir] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (premier.current) { premier.current = false; return; }
    const etat: EtatSchema = { positions, cables };
    if (restaure.current) {
      // Ce changement vient de l'histoire elle-même : le réenregistrer
      // empilerait l'annulation par-dessus ce qu'elle vient de défaire.
      restaure.current = false;
      histoire.current = { ...histoire.current, present: etat };
      return;
    }
    histoire.current = poser(histoire.current, etat, geste.current);
    rafraichir();
  }, [positions, cables]);

  const remonter = useCallback((sens: 'annuler' | 'retablir') => {
    const suite = sens === 'annuler' ? annuler(histoire.current) : retablir(histoire.current);
    if (suite === histoire.current) return;
    histoire.current = suite;
    restaure.current = true;
    rafraichir();
    onRestaurer?.(suite.present);
  }, [onRestaurer]);

  /* --- caméra ------------------------------------------------------------- */

  const versDessin = useCallback((e: { clientX: number; clientY: number }): Point | null => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r || !r.width || !r.height) return null;
    return versToile(vue, {
      x: ((e.clientX - r.left) / r.width) * VUE_L,
      y: ((e.clientY - r.top) / r.height) * vueH,
    });
  }, [vue, vueH]);

  const contenu = useCallback(() => etendue([...boites.values()]), [boites]);
  const cadrerTout = useCallback(() => {
    // Le cadrage automatique ne grossit pas au-delà de la taille réelle : sur
    // un schéma d'un seul équipement, remplir l'écran d'une boîte n'aide pas.
    setVue(cadrer(contenu(), VUE_L, vueH, 34, 1));
  }, [contenu, vueH]);

  // Au premier contenu, on cadre : arriver sur une vue vide alors que le schéma
  // existe est la façon la plus sûre de croire qu'il ne s'est rien passé.
  const cadre = useRef(false);
  useEffect(() => {
    if (cadre.current || !materiels.length) return;
    cadre.current = true;
    cadrerTout();
  }, [materiels.length, cadrerTout]);

  // La molette zoome sous le curseur. L'écouteur est posé à la main : React
  // attache `onWheel` en mode passif, où `preventDefault` n'a aucun effet et la
  // page défile sous le schéma.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const surMolette = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const p = { x: ((e.clientX - r.left) / r.width) * VUE_L, y: ((e.clientY - r.top) / r.height) * vueH };
      setVue(v => zoomerVers(v, p, e.deltaY < 0 ? 1.12 : 1 / 1.12));
    };
    el.addEventListener('wheel', surMolette, { passive: false });
    return () => el.removeEventListener('wheel', surMolette);
  }, [vueH]);

  // Ctrl+Z / Ctrl+Y, à condition qu'on ne soit pas en train d'écrire ailleurs :
  // annuler une frappe de texte par un raccourci de schéma serait une surprise.
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const actif = document.activeElement as HTMLElement | null;
      if (actif && (/^(INPUT|TEXTAREA|SELECT)$/.test(actif.tagName) || actif.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); remonter('annuler'); }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); remonter('retablir'); }
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [remonter]);

  /* --- câblage ------------------------------------------------------------ */

  const choisir = (id: string) => {
    setSouci('');
    if (!depart) { setDepart(id); return; }
    if (depart === id) { setDepart(null); return; }
    const a = parId.get(depart), b = parId.get(id);
    setDepart(null);
    if (!a || !b) return;
    if (cables.some(c => (c.deId === a.id && c.versId === b.id) || (c.deId === b.id && c.versId === a.id))) {
      setSouci(`${a.nom} et ${b.nom} sont déjà reliés. Un second lien entre les mêmes équipements ferait une boucle.`);
      return;
    }
    const pa = portsLibres(a, cables)[0], pb = portsLibres(b, cables)[0];
    if (pa === undefined || pb === undefined) {
      const plein = pa === undefined ? a : b;
      setSouci(`${plein.nom} n'a plus de port libre : ses ${plein.ports} ports sont tous pris. Augmente son nombre de ports dans l'inventaire.`);
      return;
    }
    setABrancher({ a, b });
  };

  /* --- ce qu'on écrit à côté d'un port ------------------------------------ */

  const ifacesDe = useMemo(() => {
    const out = new Map<string, InterfaceSchema[]>();
    for (const i of interfaces) {
      const l = out.get(i.materielId) ?? [];
      l.push(i);
      out.set(i.materielId, l);
    }
    return out;
  }, [interfaces]);

  const etiquettePort = useCallback((m: Materiel, port: number): string[] => {
    if (affichage === 'aucun') return [];
    const nom = nomPort(m, port);
    if (affichage === 'nom') return [nom];
    // Une sous-interface 802.1Q porte l'adresse du port physique : `Gig0/0.20`
    // répond pour `Gig0/0`, sans quoi le port le plus intéressant du schéma
    // s'afficherait sans adresse.
    const i = (ifacesDe.get(m.id) ?? []).find(x => x.nom === nom || x.nom.startsWith(nom + '.'));
    return i?.ip ? [nom, i.ip] : [nom];
  }, [affichage, nomPort, ifacesDe]);

  /**
   * Les interfaces virtuelles — SVI, sous-interfaces — qui n'ont pas de câble.
   *
   * Elles vivent sur une interface physique et n'apparaîtraient donc nulle part.
   * Or c'est exactement ce qu'un schéma de routage inter-VLAN doit montrer.
   */
  const virtuellesDe = useCallback((m: Materiel): InterfaceSchema[] => {
    if (affichage !== 'complet') return [];
    return (ifacesDe.get(m.id) ?? []).filter(i => i.nom.startsWith('Vlan') || i.nom.includes('.'));
  }, [affichage, ifacesDe]);

  /* --- export ------------------------------------------------------------- */

  const [dit, setDit] = useState('');
  const exporterPng = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const NS = 'http://www.w3.org/2000/svg';
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', NS);
    clone.setAttribute('width', String(VUE_L));
    clone.setAttribute('height', String(vueH));
    // Le fond est un rectangle explicite : une image détachée n'hérite d'aucune
    // feuille de style, et un PNG transparent collé dans un rapport sombre est
    // illisible.
    const f = fenetre(vue, VUE_L, vueH);
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', String(f.x));
    rect.setAttribute('y', String(f.y));
    rect.setAttribute('width', String(f.w));
    rect.setAttribute('height', String(f.h));
    rect.setAttribute('fill', pal.fond);
    clone.insertBefore(rect, clone.firstChild);

    const source = new XMLSerializer().serializeToString(clone);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = VUE_L * 2;
      c.height = vueH * 2;
      const ctx2d = c.getContext('2d');
      if (!ctx2d) return;
      ctx2d.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(blob => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'schema-reseau.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 0);
        setDit('Image enregistrée.');
      }, 'image/png');
    };
    img.onerror = () => setDit("L'image n'a pas pu être produite.");
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
  };

  /* --- rendu -------------------------------------------------------------- */

  if (!materiels.length) {
    return (
      <div className="meta" style={{ fontSize: 12, padding: '18px 0' }}>
        Ajoute des équipements ci-dessous, puis relie-les ici : un clic sur le premier, un clic sur le second.
      </div>
    );
  }

  const f = fenetre(vue, VUE_L, vueH);
  const occupes = [...rangs.keys()].sort((a, b) => a - b);

  const bouton = (actif: boolean): CSSProperties => ({
    padding: '3px 8px', border: `1px solid ${actif ? 'var(--accent)' : 'var(--border)'}`,
    borderRadius: 7, background: actif ? 'var(--accent-light)' : 'transparent',
    color: actif ? 'var(--accent)' : 'var(--text-soft)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
    lineHeight: 1.6,
  });

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <button type="button" style={bouton(false)} title="Dézoomer"
          onClick={() => setVue(v => zoomerAuCentre(v, 1 / 1.25, VUE_L, vueH))}>−</button>
        <span className="meta" style={{ fontSize: 11.5, minWidth: 38, textAlign: 'center' }}>{Math.round(vue.zoom * 100)}%</span>
        <button type="button" style={bouton(false)} title="Zoomer"
          onClick={() => setVue(v => zoomerAuCentre(v, 1.25, VUE_L, vueH))}>+</button>
        <button type="button" style={bouton(false)} title="Cadrer tout le schéma" onClick={cadrerTout}>⛶ Cadrer</button>

        <span style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 3px' }} />

        {([['aucun', 'Ports masqués'], ['nom', 'Nom du port'], ['complet', 'Nom + adresse']] as const).map(([v, t]) => (
          <button key={v} type="button" style={bouton(affichage === v)} title={t}
            onClick={() => setAffichage(v)}>{v === 'aucun' ? '◻' : v === 'nom' ? '◱' : '▦'}</button>
        ))}

        <span style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 3px' }} />

        <button type="button" style={bouton(grille)} title="Accrocher à la grille"
          onClick={() => setGrille(g => !g)}>#</button>
        <button type="button" style={{ ...bouton(false), opacity: peutAnnuler(histoire.current) ? 1 : 0.4 }}
          title="Annuler (Ctrl+Z)" onClick={() => remonter('annuler')}>↶</button>
        <button type="button" style={{ ...bouton(false), opacity: peutRetablir(histoire.current) ? 1 : 0.4 }}
          title="Rétablir (Ctrl+Y)" onClick={() => remonter('retablir')}>↷</button>

        <span style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 3px' }} />

        <button type="button" style={bouton(false)} title="Exporter le schéma en PNG" onClick={exporterPng}>⭳ PNG</button>
        {onReplacerTout && (
          <button type="button" style={bouton(false)} title="Rendre à chaque équipement sa place automatique"
            onClick={onReplacerTout}>↺ Replacer</button>
        )}
      </div>

      <div className="meta" style={{ fontSize: 11.5, marginBottom: 6 }}>
        {depart
          ? <strong>Clique l'équipement d'arrivée — ou le même pour annuler.</strong>
          : 'Un clic sur un équipement, un clic sur un autre : tu choisis alors le port de chaque côté (comme Packet Tracer) avant de tirer le câble. Molette pour zoomer, glisser le fond pour se déplacer.'}
      </div>
      {souci && <div style={{ fontSize: 11.5, color: 'var(--danger, #c4462f)', marginBottom: 6 }}>⚠ {souci}</div>}

      <svg
        ref={svgRef}
        viewBox={`${f.x} ${f.y} ${f.w} ${f.h}`}
        style={{
          width: '100%', height: 'auto', display: 'block',
          background: pal.fond, borderRadius: 10, border: `1px solid ${pal.bord}`,
          userSelect: 'none',
          cursor: fond ? 'grabbing' : presse?.bouge ? 'grabbing' : 'default',
        }}
        onMouseDown={e => {
          // Un appui sur le fond déplace la vue : c'est le geste de Plan, et
          // c'est le seul qui reste disponible une fois la molette prise par le
          // zoom.
          if (e.target === e.currentTarget || (e.target as Element).getAttribute?.('data-fond') === '1') {
            setFond({ x: e.clientX, y: e.clientY });
            setDepart(null);
          }
        }}
        onMouseMove={e => {
          if (fond) {
            setVue(v => deplacer(v, e.clientX - fond.x, e.clientY - fond.y));
            setFond({ x: e.clientX, y: e.clientY });
            return;
          }
          if (!presse) return;
          const q = versDessin(e);
          if (!q) return;
          const cible = { x: q.x + presse.dx, y: q.y + presse.dy };
          if (!presse.bouge) {
            const depart0 = boites.get(presse.id);
            const c0 = depart0 ? { x: depart0.x + depart0.w / 2, y: depart0.y + depart0.h / 2 } : cible;
            if (Math.abs(cible.x - c0.x) + Math.abs(cible.y - c0.y) < 4) return;
            setPresse({ ...presse, bouge: true });
          }
          geste.current = `pos:${presse.id}`;
          onPos(presse.id, grille ? accrocher(cible, PAS_GRILLE) : { x: Math.round(cible.x), y: Math.round(cible.y) });
        }}
        onMouseUp={() => {
          if (presse && !presse.bouge) choisir(presse.id);
          setPresse(null);
          setFond(null);
          geste.current = '';
        }}
        onMouseLeave={() => { setPresse(null); setFond(null); geste.current = ''; }}
      >
        <defs>
          <pattern id={`grille-${motif}`} width={PAS_GRILLE} height={PAS_GRILLE} patternUnits="userSpaceOnUse">
            <path d={`M ${PAS_GRILLE} 0 L 0 0 0 ${PAS_GRILLE}`} fill="none" stroke={pal.grille} strokeWidth={1} />
          </pattern>
        </defs>

        {/* Le fond porte la grille ET reçoit le glisser de la vue. */}
        <rect data-fond="1" x={f.x} y={f.y} width={f.w} height={f.h}
          fill={grille ? `url(#grille-${motif})` : pal.fond} />

        {/* Les étages, nommés par leur couche : c'est la leçon du schéma. */}
        {occupes.map(e => {
          const y = MARGE_Y + (rangs.get(e) ?? 0) * PAS_Y;
          return (
            <g key={e} pointerEvents="none">
              <line x1={f.x} y1={y - 52} x2={f.x + f.w} y2={y - 52} stroke={pal.bord} strokeWidth={0.8} strokeDasharray="4 5" />
              <text x={f.x + 8} y={y - 56} fontSize={9} fill={pal.discret}>{NOM_ETAGE[e]}</text>
            </g>
          );
        })}

        {/* Les câbles, sous les boîtes. Double-clic pour retirer. */}
        {cables.map(c => {
          const a = parId.get(c.deId), b = parId.get(c.versId);
          const ancre = ancres.get(c.id);
          if (!a || !b || !ancre) return null;
          const chemin = tracer(ancre.a, ancre.b);
          const attendu = cableAttendu(a.type, b.type);
          const faux = c.media !== attendu && c.media !== 'fibre' && c.media !== 'serie';
          const mi = milieuOriente(chemin);
          const couleur = faux ? pal.danger : pal.bord;
          return (
            <g key={c.id} style={{ cursor: 'pointer' }} onDoubleClick={() => onRetirer(c.id)}>
              <title>{`${a.nom} ${nomPort(a, c.dePort)} ↔ ${b.nom} ${nomPort(b, c.versPort)} · ${nomDuMedia(c.media)} — double-clic pour retirer`}</title>
              {/* Un trait de 2 px ne se vise pas ; celui-ci, transparent et large, oui. */}
              <path d={cheminSvg(chemin)} fill="none" stroke="transparent" strokeWidth={12} />
              <path d={cheminSvg(chemin)} fill="none" stroke={couleur} strokeWidth={faux ? 2.6 : 2}
                strokeLinejoin="round" strokeLinecap="round"
                strokeDasharray={c.media === 'serie' ? '7 5' : undefined} />
              <text
                x={mi.horizontal ? mi.x : mi.x + 6}
                y={mi.horizontal ? mi.y - 5 : mi.y + 3}
                textAnchor={mi.horizontal ? 'middle' : 'start'}
                fontSize={8.5} fill={faux ? pal.danger : pal.discret}
                pointerEvents="none" style={{ paintOrder: 'stroke' }} stroke={pal.fond} strokeWidth={3}>
                {c.media}
              </text>
              {affichage !== 'aucun' && [
                { bout: ancre.a, m: a, port: c.dePort },
                { bout: ancre.b, m: b, port: c.versPort },
              ].map(({ bout, m, port }, i) => (
                <EtiquettePort key={i} bout={bout} lignes={etiquettePort(m, port)} pal={pal} />
              ))}
            </g>
          );
        })}

        {/* Les équipements. */}
        {materiels.map(m => {
          const b = boites.get(m.id);
          if (!b) return null;
          const choisi = depart === m.id;
          const teinte = m.pareFeu ? '#c0392b' : (TEINTE_DE[m.type] ?? pal.accent);
          const p = picto(m.pareFeu ? 'pare-feu' : PICTO_DE[m.type]);
          const virtuelles = virtuellesDe(m);
          return (
            <g key={m.id} style={{ cursor: presse?.id === m.id && presse.bouge ? 'grabbing' : 'pointer' }}
              onMouseDown={e => {
                e.preventDefault();
                const q = versDessin(e);
                if (!q) return;
                setPresse({ id: m.id, dx: b.x + b.w / 2 - q.x, dy: b.y + b.h / 2 - q.y, bouge: false });
              }}
              onDoubleClick={() => onPos(m.id, null)}>
              <title>{`${m.nom} — ${m.type}${m.modele ? ' ' + m.modele : ''} · ${portsLibres(m, cables).length}/${m.ports} ports libres`}</title>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={11}
                fill={pal.surface} stroke={choisi ? pal.accent : teinte}
                strokeWidth={choisi ? 2.6 : 1.5} strokeOpacity={choisi ? 1 : 0.75} />
              {p && (
                <Pictogramme p={p} x={b.x + (b.w - COTE_PICTO) / 2} y={b.y + 7} cote={COTE_PICTO} teinte={teinte} />
              )}
              <text x={b.x + b.w / 2} y={b.y + b.h - 20} textAnchor="middle" fontSize={11} fontWeight={600} fill={pal.texte}>
                {m.nom}
              </text>
              <text x={b.x + b.w / 2} y={b.y + b.h - 8} textAnchor="middle" fontSize={8} fill={pal.discret}>
                {portsLibres(m, cables).length}/{m.ports} libres
              </text>

              {/* Les interfaces virtuelles : à gauche, sans câble, comme dans Plan. */}
              {virtuelles.map((i, k) => (
                <g key={i.nom} pointerEvents="none">
                  <circle cx={b.x} cy={b.y + (b.h * (k + 1)) / (virtuelles.length + 1)} r={3}
                    fill={pal.fond} stroke={teinte} strokeWidth={1.4} strokeDasharray="2 1.6" />
                  <text x={b.x - 7} y={b.y + (b.h * (k + 1)) / (virtuelles.length + 1) + 3} textAnchor="end"
                    fontSize={8} fill={pal.discret} style={{ paintOrder: 'stroke' }} stroke={pal.fond} strokeWidth={3}>
                    {i.ip ? `${i.nom} · ${i.ip}` : i.nom}
                  </text>
                </g>
              ))}

              {onOuvrir && (
                // La roue ouvre la configuration fine. `stopPropagation` sur
                // l'appui : sans elle, le clic démarrerait un câble au lieu
                // d'ouvrir le dialogue.
                <g style={{ cursor: 'pointer' }}
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); onOuvrir(m.id); }}>
                  <title>Configurer {m.nom}</title>
                  <circle cx={b.x + b.w - 11} cy={b.y + 11} r={9} fill={pal.fond} stroke={pal.bord} strokeWidth={1} />
                  <text x={b.x + b.w - 11} y={b.y + 14.5} textAnchor="middle" fontSize={10} fill={pal.discret}>⚙</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {dit && <p className="meta" style={{ fontSize: 11.5, marginTop: 6 }}>{dit}</p>}

      {aBrancher && (
        <DialogueBranchement
          a={aBrancher.a} b={aBrancher.b} cables={cables} nomPort={nomPort}
          onValider={c => { geste.current = ''; onCable(c); setABrancher(null); }}
          onAnnuler={() => setABrancher(null)} />
      )}
    </div>
  );
}

/** Le nom (et l'adresse) d'un port, écrit juste dehors, du bon côté. */
function EtiquettePort({ bout, lignes, pal }: { bout: Bout; lignes: string[]; pal: Palette }) {
  if (!lignes.length) return null;
  const p = pointSurContour(bout.boite, bout.cote, bout.position);
  const decalage: Record<Cote, { x: number; y: number; ancre: 'start' | 'middle' | 'end' }> = {
    droite: { x: 6, y: 3, ancre: 'start' },
    gauche: { x: -6, y: 3, ancre: 'end' },
    haut: { x: 0, y: -6, ancre: 'middle' },
    bas: { x: 0, y: 11, ancre: 'middle' },
  };
  const d = decalage[bout.cote];
  const HAUTEUR_LIGNE = 9;
  // Vers le haut, les lignes s'empilent VERS LE HAUT : écrites vers le bas,
  // elles passeraient sous le bord de la boîte.
  const rang = (i: number) => (bout.cote === 'haut' ? -(lignes.length - 1 - i) : i) * HAUTEUR_LIGNE;
  return (
    <g pointerEvents="none">
      {lignes.map((t, i) => (
        <text key={i}
          x={p.x + d.x}
          y={p.y + d.y + rang(i)}
          textAnchor={d.ancre} fontSize={8} fill={i === 0 ? pal.texte : pal.discret}
          style={{ paintOrder: 'stroke' }} stroke={pal.fond} strokeWidth={3}>
          {t}
        </text>
      ))}
    </g>
  );
}

/**
 * Le choix des ports au branchement — à la Packet Tracer.
 *
 * Deux clics ont désigné les équipements ; ici on choisit l'interface précise
 * de chaque côté (le premier port libre est proposé) et le média, avant de
 * tirer le câble. Rien n'est imposé : on garde la main sur où l'on branche.
 */
function DialogueBranchement({ a, b, cables, nomPort, onValider, onAnnuler }: {
  a: Materiel; b: Materiel; cables: Cable[];
  nomPort: (m: Materiel, port: number) => string;
  onValider: (c: Cable) => void;
  onAnnuler: () => void;
}) {
  const libA = portsLibres(a, cables);
  const libB = portsLibres(b, cables);
  const [pa, setPa] = useState<number>(libA[0]);
  const [pb, setPb] = useState<number>(libB[0]);
  const attendu = cableAttendu(a.type, b.type);
  const [media, setMedia] = useState<Media>(attendu);
  const MEDIAS: Media[] = ['droit', 'croise', 'serie', 'fibre', 'console'];

  const bloc = (m: Materiel, libres: number[], val: number, set: (n: number) => void): ReactNode => {
    const p = picto(m.pareFeu ? 'pare-feu' : PICTO_DE[m.type]);
    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
          {p && (
            <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden>
              <Pictogramme p={p} x={0} y={0} cote={18} teinte={m.pareFeu ? '#c0392b' : TEINTE_DE[m.type]} />
            </svg>
          )}
          {m.nom}
        </div>
        <select style={{ ...champ, width: '100%' }} value={val} onChange={e => set(Number(e.target.value))}>
          {libres.map(n => <option key={n} value={n}>{nomPort(m, n)} (port {n})</option>)}
        </select>
      </div>
    );
  };

  return (
    <div onClick={onAnnuler} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5vh 14px', zIndex: 60 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label={`Brancher ${a.nom} et ${b.nom}`}
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px', maxWidth: 460, width: '100%', boxShadow: '0 18px 50px -20px rgba(0,0,0,.5)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>🔌 Choisis les ports à relier</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 12 }}>
          {bloc(a, libA, pa, setPa)}
          <div style={{ fontSize: 18, paddingBottom: 6, color: 'var(--text-muted)' }}>↔</div>
          {bloc(b, libB, pb, setPb)}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
          <span className="meta" style={{ fontSize: 12 }}>Média</span>
          <select style={{ ...champ, width: 200 }} value={media} onChange={e => setMedia(e.target.value as Media)}>
            {MEDIAS.map(md => <option key={md} value={md}>{nomDuMedia(md)}{md === attendu ? ' — conseillé' : ''}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onAnnuler} style={petitBtn}>Annuler</button>
          <button type="button"
            onClick={() => onValider({ id: `cab${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, deId: a.id, dePort: pa, versId: b.id, versPort: pb, media })}
            style={{ ...petitBtn, borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 700 }}>Brancher</button>
        </div>
      </div>
    </div>
  );
}

const champ: CSSProperties = { width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13.5, boxSizing: 'border-box' };
const petitBtn: CSSProperties = { padding: '3px 9px', border: '1px solid var(--border)', borderRadius: 8, background: 'transparent', color: 'var(--text-soft)', fontWeight: 600, cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' };

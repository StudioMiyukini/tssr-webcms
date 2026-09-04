import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COTE_OPPOSE, ancrerCables, cheminSvg, coteVers, coudes, estOrthogonal, milieuDe, milieuOriente,
  pointSurContour, tracer, traversees, type Boite,
} from './trace-lien.ts';

/* Deux équipements posés comme dans un TP : le routeur au-dessus, le
   commutateur en dessous. C'est la disposition la plus fréquente, donc celle
   sur laquelle un tracé faux se remarque le plus. */
const HAUT: Boite = { x: 300, y: 60, w: 120, h: 80 };
const BAS: Boite = { x: 300, y: 300, w: 120, h: 80 };
const DROITE: Boite = { x: 700, y: 60, w: 120, h: 80 };

test('un point du contour tombe sur le bon bord', () => {
  assert.deepEqual(pointSurContour(HAUT, 'haut', 0.5), { x: 360, y: 60 });
  assert.deepEqual(pointSurContour(HAUT, 'bas', 0.5), { x: 360, y: 140 });
  assert.deepEqual(pointSurContour(HAUT, 'gauche', 0), { x: 300, y: 60 });
  assert.deepEqual(pointSurContour(HAUT, 'droite', 1), { x: 420, y: 140 });
  // Une fraction hors bornes se borne plutôt que de sortir de la boîte.
  assert.deepEqual(pointSurContour(HAUT, 'haut', 2), { x: 420, y: 60 });
});

test('le bord de sortie suit la position du voisin', () => {
  assert.equal(coteVers(HAUT, BAS), 'bas');
  assert.equal(coteVers(BAS, HAUT), 'haut');
  assert.equal(coteVers(HAUT, DROITE), 'droite');
  assert.equal(coteVers(DROITE, HAUT), 'gauche');
});

test('le bord se décide sur des écarts mesurés en largeurs de boîte', () => {
  // Une baie haute et étroite a tous ses voisins « plus bas qu’elle » en
  // pixels ; rapporté à sa hauteur, ils sont sur le côté — et c’est par là que
  // les câbles doivent sortir, sinon ils traversent la baie en travers.
  const baie: Boite = { x: 0, y: 0, w: 60, h: 400 };
  const voisin: Boite = { x: 100, y: 320, w: 80, h: 60 };
  assert.equal(coteVers(baie, voisin), 'droite');
  // Et l’inverse tient : un bandeau large, un équipement juste en dessous.
  const bandeau: Boite = { x: 0, y: 0, w: 600, h: 40 };
  const dessous: Boite = { x: 200, y: 120, w: 60, h: 40 };
  assert.equal(coteVers(bandeau, dessous), 'bas');
});

test('les bords opposés se répondent', () => {
  assert.equal(COTE_OPPOSE.haut, 'bas');
  assert.equal(COTE_OPPOSE.gauche, 'droite');
});

test('le tracé n’a que des angles droits et ne traverse aucune des deux boîtes', () => {
  // C’est la faute la plus visible d’un schéma : un trait qui transperce la
  // boîte qu’il désigne.
  const cas: [Boite, Boite][] = [
    [HAUT, BAS], [BAS, HAUT], [HAUT, DROITE],
    [{ x: 0, y: 0, w: 100, h: 60 }, { x: 40, y: 200, w: 100, h: 60 }],
    [{ x: 0, y: 0, w: 100, h: 60 }, { x: 20, y: 90, w: 100, h: 60 }],
    [{ x: 500, y: 400, w: 140, h: 90 }, { x: 60, y: 40, w: 140, h: 90 }],
  ];
  for (const [a, b] of cas) {
    const chemin = tracer(
      { boite: a, cote: coteVers(a, b), position: 0.5 },
      { boite: b, cote: coteVers(b, a), position: 0.5 },
    );
    assert.ok(estOrthogonal(chemin), 'tracé oblique');
    assert.equal(traversees(chemin, a, b), 0, 'le tracé transperce une boîte');
  }
});

test('le tracé part et arrive exactement sur le contour', () => {
  // Un lien qui connaît un bord et non des coordonnées suit son équipement
  // quand on le déplace : c’est tout l’intérêt de l’ancrage.
  const a = { boite: HAUT, cote: 'bas' as const, position: 0.25 };
  const b = { boite: BAS, cote: 'haut' as const, position: 0.75 };
  const chemin = tracer(a, b);
  assert.deepEqual(chemin[0], pointSurContour(HAUT, 'bas', 0.25));
  assert.deepEqual(chemin[chemin.length - 1], pointSurContour(BAS, 'haut', 0.75));
});

test('deux équipements face à face donnent un tracé simple', () => {
  const chemin = tracer(
    { boite: HAUT, cote: 'bas', position: 0.5 },
    { boite: BAS, cote: 'haut', position: 0.5 },
  );
  assert.deepEqual(chemin, [{ x: 360, y: 140 }, { x: 360, y: 300 }]);
  assert.equal(coudes(chemin), 0);
});

test('le tracé droit garde ses deux points', () => {
  const chemin = tracer(
    { boite: HAUT, cote: 'droite', position: 0.5 },
    { boite: BAS, cote: 'gauche', position: 0.5 },
    'droit',
  );
  assert.equal(chemin.length, 2);
});

test('le chemin SVG reprend le tracé point par point', () => {
  assert.equal(cheminSvg([{ x: 1, y: 2 }, { x: 3.456, y: 4 }]), 'M 1 2 L 3.46 4');
});

test('l’étiquette se pose à mi-parcours, pas au sommet du milieu', () => {
  // Sur un L dont un bras est dix fois plus long que l’autre, le sommet du
  // milieu est un coude : l’étiquette s’y collerait.
  assert.deepEqual(milieuDe([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 20 }]), { x: 60, y: 0 });
  assert.deepEqual(milieuDe([]), { x: 0, y: 0 });
});

test('l’étiquette connaît la direction du trait qui la porte', () => {
  // Centrée sur un câble vertical, elle tomberait pile où les noms de port des
  // deux équipements se rejoignent ; à côté du trait, elle les laisse tranquilles.
  assert.equal(milieuOriente([{ x: 0, y: 0 }, { x: 0, y: 100 }]).horizontal, false);
  assert.equal(milieuOriente([{ x: 0, y: 0 }, { x: 100, y: 0 }]).horizontal, true);
  assert.deepEqual(milieuOriente([]), { x: 0, y: 0, horizontal: true });
});

/* --------------------------------------------------- répartition des ports */

const boites = new Map<string, Boite>([
  ['sw', { x: 300, y: 300, w: 200, h: 80 }],
  ['pc1', { x: 100, y: 500, w: 80, h: 60 }],
  ['pc2', { x: 300, y: 500, w: 80, h: 60 }],
  ['pc3', { x: 500, y: 500, w: 80, h: 60 }],
]);

test('trois câbles sur un même bord se répartissent au lieu de se superposer', () => {
  const cables = [
    { id: 'c3', deId: 'sw', versId: 'pc3' },
    { id: 'c1', deId: 'sw', versId: 'pc1' },
    { id: 'c2', deId: 'sw', versId: 'pc2' },
  ];
  const ancres = ancrerCables(boites, cables);
  // L’ordre sur le bord suit celui des voisins, pas celui de la déclaration :
  // sinon les câbles se croiseraient sans raison.
  assert.equal(ancres.get('c1')!.a.position, 0.25);
  assert.equal(ancres.get('c2')!.a.position, 0.5);
  assert.equal(ancres.get('c3')!.a.position, 0.75);
  assert.equal(ancres.get('c1')!.a.cote, 'bas');
  assert.equal(ancres.get('c1')!.b.cote, 'haut');
});

test('un câble seul reste au milieu de son bord', () => {
  const ancres = ancrerCables(boites, [{ id: 'c', deId: 'sw', versId: 'pc2' }]);
  assert.equal(ancres.get('c')!.a.position, 0.5);
  assert.equal(ancres.get('c')!.b.position, 0.5);
});

test('un câble vers un équipement absent est ignoré, pas dessiné dans le vide', () => {
  const ancres = ancrerCables(boites, [{ id: 'c', deId: 'sw', versId: 'fantome' }]);
  assert.equal(ancres.size, 0);
});

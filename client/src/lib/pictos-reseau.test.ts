import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PICTOS, PICTO_DE, TEINTE_DE, picto, CATEGORIES_PICTO,
  cheminArc, cheminArcs, cheminEllipse, cheminLigne, cheminRect, cheminSegments,
} from './pictos-reseau.ts';
import { COUCHE_DE, type TypeMateriel } from './physique.ts';

/* Les pictogrammes viennent du canevas de Plan ; ce qui se vérifie ici, c'est
   la traduction en chemins SVG — les arcs, surtout, qui se retournent sans
   prévenir quand on se trompe de sens. */

test('un arc de canevas devient un arc SVG dans le même sens', () => {
  // Angles croissants : sens des aiguilles à l'écran, donc sweep = 1.
  assert.equal(cheminArc(0, 0, 1, 1, 0, Math.PI), 'M 1 0 A 1 1 0 0 1 -1 0');
  // Antihoraire : sweep = 0, et le tracé va de gauche à droite par le bas.
  assert.equal(cheminArc(0, 0, 1, 1, Math.PI, 0, true), 'M -1 0 A 1 1 0 0 0 1 0');
});

test('un arc de plus d’un demi-tour lève le drapeau du grand arc', () => {
  // Sans ce drapeau, SVG prend le petit arc et l’image est fausse à l’envers.
  assert.equal(cheminArc(0, 0, 1, 1, 0, Math.PI * 1.5), 'M 1 0 A 1 1 0 1 1 0 -1');
  assert.equal(cheminArc(0, 0, 1, 1, 0, Math.PI * 0.5), 'M 1 0 A 1 1 0 0 1 0 1');
});

test('une suite d’arcs est jointe par des droites, comme sur le canevas', () => {
  // C’est ce joint qui fait un nuage plutôt que trois lobes détachés.
  const d = cheminArcs([
    { cx: 0, cy: 0, rx: 1, ry: 1, a0: 0, a1: Math.PI },
    { cx: 3, cy: 0, rx: 1, ry: 1, a0: 0, a1: Math.PI },
  ], true);
  assert.equal(d, 'M 1 0 A 1 1 0 0 1 -1 0 L 4 0 A 1 1 0 0 1 2 0 Z');
});

test('l’ellipse entière se dessine en deux demi-arcs', () => {
  // Un seul arc de 360° serait dégénéré : SVG ne dessinerait rien.
  const d = cheminEllipse(0.5, 0.5, 0.5, 0.25);
  assert.equal(d, 'M 0 0.5 A 0.5 0.25 0 0 1 1 0.5 A 0.5 0.25 0 0 1 0 0.5 Z');
});

test('le rectangle arrondi borne son rayon à la moitié du plus petit côté', () => {
  assert.ok(cheminRect(0, 0, 1, 1, 0.1).startsWith('M 0.1 0 '));
  // Un rayon plus grand que la boîte produirait des arcs qui se croisent.
  assert.ok(cheminRect(0, 0, 0.2, 1, 0.5).startsWith('M 0.1 0 '));
  assert.ok(cheminRect(0, 0, 1, 1).endsWith('Z'));
});

test('polylignes et segments s’écrivent comme on les lit', () => {
  assert.equal(cheminLigne([[0, 0], [1, 0], [1, 1]]), 'M 0 0 L 1 0 L 1 1');
  assert.equal(cheminLigne([[0, 0], [1, 0]], true), 'M 0 0 L 1 0 Z');
  assert.equal(cheminSegments([[0, 0, 1, 0], [0, 1, 1, 1]]), 'M 0 0 L 1 0 M 0 1 L 1 1');
});

test('le catalogue n’a ni doublon ni chemin vide', () => {
  const ids = PICTOS.map(p => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const p of PICTOS) {
    assert.ok(p.figures.length > 0, `${p.id} n’a aucune figure`);
    for (const f of p.figures) {
      assert.ok(f.d.trim().length > 0, `${p.id} a une figure vide`);
      assert.ok(f.d.startsWith('M '), `${p.id} : un chemin doit commencer par un déplacement`);
    }
  }
});

test('chaque nature d’équipement de l’atelier a son pictogramme et sa teinte', () => {
  // Un type sans pictogramme s’afficherait en boîte nue, sans erreur : c’est
  // exactement le genre d’oubli qu’un test attrape et pas une revue.
  for (const t of Object.keys(COUCHE_DE) as TypeMateriel[]) {
    assert.ok(picto(PICTO_DE[t]), `aucun pictogramme pour « ${t} »`);
    assert.match(TEINTE_DE[t], /^#[0-9a-f]{6}$/i, `aucune teinte pour « ${t} »`);
  }
});

test('le multicouche ne se confond pas avec un commutateur d’accès', () => {
  // Même parallélogramme, mais quatre pointes au lieu de deux : c’est la seule
  // chose qui les sépare à l’écran, et elle doit rester.
  const sw = picto('commutateur');
  const l3 = picto('commutateur-l3');
  assert.ok(sw && l3);
  assert.equal(sw.figures[0].d, l3.figures[0].d);
  assert.notEqual(sw.figures[1].d, l3.figures[1].d);
});

test('les diodes du serveur sont remplies, pas cerclées', () => {
  const s = picto('serveur');
  assert.ok(s);
  assert.ok(s.figures.some(f => f.mode === 'rempli'));
});

test('les catégories reprennent celles de Plan', () => {
  assert.deepEqual(CATEGORIES_PICTO, ['Réseau', 'Machines', 'Formes']);
});

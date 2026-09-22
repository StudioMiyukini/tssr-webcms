import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VUE_INITIALE, ZOOM_MAX, ZOOM_MIN,
  accrocher, cadrer, centrerSur, deplacer, etendue, fenetre, versEcran, versToile, zoomerVers,
  type Vue,
} from './camera-schema.ts';

const proche = (a: number, b: number, tol = 1e-9) =>
  assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b}`);

test('écran et toile se traduisent l’un dans l’autre sans dérive', () => {
  // Si les deux sens divergent, on pose un câble à côté de l’équipement visé.
  const v: Vue = { x: 120, y: -40, zoom: 1.75 };
  const p = { x: 331, y: 207 };
  const retour = versEcran(v, versToile(v, p));
  proche(retour.x, p.x);
  proche(retour.y, p.y);
});

test('la fenêtre visible rétrécit quand on grossit', () => {
  assert.deepEqual(fenetre({ x: 10, y: 20, zoom: 2 }, 880, 480), { x: 10, y: 20, w: 440, h: 240 });
});

test('le zoom garde fixe le point sous le curseur', () => {
  // Sans ce point d’ancrage, chaque coup de molette déplace la vue et oblige à
  // se repositionner — c’est ce qui rend un zoom pénible.
  const v: Vue = { x: 50, y: 30, zoom: 1 };
  const curseur = { x: 300, y: 200 };
  const avant = versToile(v, curseur);
  const apres = versToile(zoomerVers(v, curseur, 1.3), curseur);
  proche(apres.x, avant.x);
  proche(apres.y, avant.y);
});

test('le zoom reste entre ses bornes', () => {
  let v = VUE_INITIALE;
  for (let i = 0; i < 40; i++) v = zoomerVers(v, { x: 0, y: 0 }, 1.5);
  assert.equal(v.zoom, ZOOM_MAX);
  for (let i = 0; i < 80; i++) v = zoomerVers(v, { x: 0, y: 0 }, 0.7);
  assert.equal(v.zoom, ZOOM_MIN);
});

test('déplacer la vue suit le doigt', () => {
  // Tirer vers la droite amène le contenu vers la droite : la vue recule.
  const v = deplacer({ x: 100, y: 100, zoom: 2 }, 40, 20);
  assert.deepEqual(v, { x: 80, y: 90, zoom: 2 });
});

test('l’étendue d’un schéma vide n’existe pas', () => {
  // Renvoyer une boîte de taille nulle ferait diviser par zéro au cadrage.
  assert.equal(etendue([]), null);
});

test('l’étendue enveloppe toutes les boîtes', () => {
  assert.deepEqual(
    etendue([{ x: 10, y: 20, w: 100, h: 40 }, { x: -30, y: 90, w: 50, h: 10 }]),
    { x: -30, y: 20, w: 140, h: 80 },
  );
});

test('cadrer montre tout le contenu, centré', () => {
  const contenu = { x: 0, y: 0, w: 1600, h: 400 };
  const v = cadrer(contenu, 880, 480, 40);
  const vue = fenetre(v, 880, 480);
  assert.ok(vue.x <= contenu.x && vue.y <= contenu.y, 'le coin haut-gauche doit être visible');
  assert.ok(vue.x + vue.w >= contenu.x + contenu.w, 'le bord droit doit être visible');
  assert.ok(vue.y + vue.h >= contenu.y + contenu.h, 'le bord bas doit être visible');
  // Centré : autant de marge d’un côté que de l’autre.
  proche(vue.x - contenu.x, contenu.x + contenu.w - (vue.x + vue.w), 1e-6);
});

test('cadrer un schéma vide ramène à la vue de départ', () => {
  assert.deepEqual(cadrer(null, 880, 480), VUE_INITIALE);
});

test('cadrer ne grossit pas au-delà de la limite', () => {
  // Un schéma minuscule ne doit pas remplir l’écran d’un seul équipement.
  assert.equal(cadrer({ x: 0, y: 0, w: 10, h: 10 }, 880, 480).zoom, ZOOM_MAX);
});

test('centrer amène le point au milieu de la vue', () => {
  const v = centrerSur({ x: 0, y: 0, zoom: 2 }, { x: 500, y: 300 }, 880, 480);
  const centre = versToile(v, { x: 440, y: 240 });
  proche(centre.x, 500);
  proche(centre.y, 300);
});

test('la grille arrondit au pas le plus proche', () => {
  assert.deepEqual(accrocher({ x: 108, y: -13 }, 20), { x: 100, y: -20 });
  // Pas nul : on ne divise pas, on laisse le point où il est.
  assert.deepEqual(accrocher({ x: 108, y: -13 }, 0), { x: 108, y: -13 });
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FUSION_MS, PROFONDEUR,
  annuler, nouvelle, peutAnnuler, peutRetablir, poser, retablir,
} from './histoire-schema.ts';

test('on ne peut ni annuler ni rétablir une histoire neuve', () => {
  const h = nouvelle('a');
  assert.equal(peutAnnuler(h), false);
  assert.equal(peutRetablir(h), false);
  assert.equal(annuler(h), h);
  assert.equal(retablir(h), h);
});

test('annuler puis rétablir revient au même état', () => {
  let h = nouvelle('a');
  h = poser(h, 'b', '', 1000);
  h = poser(h, 'c', '', 2000);
  h = annuler(h);
  assert.equal(h.present, 'b');
  h = annuler(h);
  assert.equal(h.present, 'a');
  h = retablir(h);
  assert.equal(h.present, 'b');
  h = retablir(h);
  assert.equal(h.present, 'c');
  assert.equal(peutRetablir(h), false);
});

test('un geste continu ne compte que pour une annulation', () => {
  // Glisser un équipement produit des dizaines d’états ; sans fusion, il
  // faudrait autant de Ctrl+Z que d’images affichées.
  let h = nouvelle({ x: 0 });
  for (let i = 1; i <= 30; i++) h = poser(h, { x: i }, 'pos:sw1', 1000 + i * 10);
  assert.equal(h.passe.length, 1);
  assert.deepEqual(annuler(h).present, { x: 0 });
});

test('la fusion s’arrête quand le geste marque une pause', () => {
  let h = nouvelle('a');
  h = poser(h, 'b', 'pos:sw1', 1000);
  h = poser(h, 'c', 'pos:sw1', 1000 + FUSION_MS);
  assert.equal(h.passe.length, 2, 'au-delà du délai, c’est un nouveau geste');
});

test('deux gestes différents ne se fondent pas, même rapprochés', () => {
  let h = nouvelle('a');
  h = poser(h, 'b', 'pos:sw1', 1000);
  h = poser(h, 'c', 'pos:sw2', 1010);
  assert.equal(h.passe.length, 2);
});

test('un geste sans clé ne se fond jamais', () => {
  // Ajouter deux câbles coup sur coup reste deux actions distinctes.
  let h = nouvelle('a');
  h = poser(h, 'b', '', 1000);
  h = poser(h, 'c', '', 1001);
  assert.equal(h.passe.length, 2);
});

test('repartir dans une autre direction efface le futur', () => {
  // La règle universelle, et la seule qui évite un futur incohérent.
  let h = nouvelle('a');
  h = poser(h, 'b', '', 1000);
  h = annuler(h);
  assert.equal(peutRetablir(h), true);
  h = poser(h, 'z', '', 2000);
  assert.equal(peutRetablir(h), false);
  assert.equal(h.present, 'z');
});

test('un geste qui suit une annulation ne s’y fond pas', () => {
  // Sinon il écraserait l’état qu’on vient de retrouver au lieu de s’y ajouter.
  let h = nouvelle('a');
  h = poser(h, 'b', 'pos:sw1', 1000);
  h = annuler(h);
  h = poser(h, 'c', 'pos:sw1', 1010);
  assert.equal(h.passe.length, 1);
  assert.equal(annuler(h).present, 'a');
});

test('poser le même état ne bouge rien', () => {
  const h = poser(nouvelle('a'), 'a', '', 1000);
  assert.equal(peutAnnuler(h), false);
});

test('la pile ne grandit pas indéfiniment', () => {
  let h = nouvelle(0);
  for (let i = 1; i <= PROFONDEUR + 30; i++) h = poser(h, i, '', i * 10_000);
  assert.equal(h.passe.length, PROFONDEUR);
  // Ce qui reste, ce sont les gestes les plus récents.
  assert.equal(h.passe[h.passe.length - 1], PROFONDEUR + 29);
});

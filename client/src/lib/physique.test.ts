import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cableAttendu, cheminPhysique, nomDuMedia, portsLibres, verifierCablage, voisinsDe,
  COUCHE_DE, PORTS_TYPIQUES, type Cable, type Materiel,
} from './physique.ts';

/* La maquette du TP, vue de la couche 1 : le multicouche, deux switches, un
   poste, et le routeur de bordure. */
const MAT: Materiel[] = [
  { id: 'mls', nom: 'MLS-Core', type: 'multicouche', modele: '3560', ports: 24 },
  { id: 'sw1', nom: 'Sw-bat1', type: 'switch', modele: '2960', ports: 24 },
  { id: 'sw2', nom: 'Sw-bat2', type: 'switch', modele: '2960', ports: 24 },
  { id: 'pc1', nom: 'Atelier 1-1', type: 'poste', modele: 'PC', ports: 1 },
  { id: 'fw', nom: 'Firewall', type: 'routeur', modele: '2911', ports: 4 },
];
const CAB: Cable[] = [
  { id: 'c1', deId: 'mls', dePort: 1, versId: 'sw1', versPort: 24, media: 'croise' },
  { id: 'c2', deId: 'mls', dePort: 2, versId: 'sw2', versPort: 24, media: 'croise' },
  { id: 'c3', deId: 'sw1', dePort: 1, versId: 'pc1', versPort: 1, media: 'droit' },
  { id: 'c4', deId: 'mls', dePort: 24, versId: 'fw', versPort: 1, media: 'droit' },
];

test('le câble attendu suit la règle des couches', () => {
  // Même niveau → croisé ; niveaux différents → droit. C'est la première
  // question de tout TP, et Packet Tracer l'applique strictement.
  assert.equal(cableAttendu('switch', 'switch'), 'croise');
  assert.equal(cableAttendu('switch', 'multicouche'), 'croise');
  assert.equal(cableAttendu('poste', 'switch'), 'droit');
  assert.equal(cableAttendu('serveur', 'switch'), 'droit');
  assert.equal(cableAttendu('routeur', 'switch'), 'droit');
  assert.equal(cableAttendu('poste', 'routeur'), 'croise', 'deux terminaux face à face');
});

test('le nuage ne discute pas son câblage', () => {
  assert.equal(cableAttendu('nuage', 'routeur'), 'droit');
  assert.equal(cableAttendu('routeur', 'nuage'), 'droit');
});

test('chaque média porte le nom qu’on lit dans Packet Tracer', () => {
  assert.ok(nomDuMedia('droit').includes('Straight-Through'));
  assert.ok(nomDuMedia('croise').includes('Cross-Over'));
  assert.ok(nomDuMedia('serie').includes('DCE'));
});

test('la couche de chaque type est déclarée', () => {
  // Un switch d'accès s'arrête à la couche 2 : c'est la raison pour laquelle il
  // ne route pas entre VLAN, et il vaut mieux le dire une fois qu'à chaque écran.
  assert.equal(COUCHE_DE.switch, 2);
  assert.equal(COUCHE_DE.multicouche, 3);
  assert.equal(COUCHE_DE.routeur, 3);
  assert.ok(COUCHE_DE.poste > 3);
});

test('les ports typiques correspondent au matériel courant', () => {
  // Un 2960-24TT en compte 26 : 24 FastEthernet d'accès, 2 Gigabit pour monter.
  // Ne lui en donner que 24 rendait impossible de câbler l'uplink sur un Gi.
  assert.equal(PORTS_TYPIQUES.switch, 26);
  assert.equal(PORTS_TYPIQUES.poste, 1);
});

test('un câblage correct ne signale rien', () => {
  assert.deepEqual(verifierCablage(MAT, CAB), []);
});

test('DEUX CÂBLES SUR UN PORT sont signalés, avec ce que ça provoque', () => {
  const doublon = [...CAB, { id: 'c5', deId: 'sw1', dePort: 1, versId: 'sw2', versPort: 2, media: 'croise' as const }];
  const pb = verifierCablage(MAT, doublon);
  const m = pb.find(x => x.quoi.includes('deux câbles sur le port 1'));
  assert.ok(m, JSON.stringify(pb.map(x => x.quoi)));
  assert.ok(m!.effet.includes('n’aura aucun effet'));
});

test('un port qui n’existe pas est signalé', () => {
  const trop = [...CAB, { id: 'c6', deId: 'pc1', dePort: 3, versId: 'sw2', versPort: 5, media: 'droit' as const }];
  const pb = verifierCablage(MAT, trop);
  assert.ok(pb.some(x => x.quoi.includes('Atelier 1-1 n’a pas de port 3')), JSON.stringify(pb.map(x => x.quoi)));
});

test('LE MAUVAIS CÂBLE est signalé — c’est la première heure perdue d’un TP', () => {
  const faux = CAB.map(c => (c.id === 'c1' ? { ...c, media: 'droit' as const } : c));
  const pb = verifierCablage(MAT, faux);
  const m = pb.find(x => x.quoi.includes('MLS-Core ↔ Sw-bat1'));
  assert.ok(m, JSON.stringify(pb.map(x => x.quoi)));
  assert.ok(m!.effet.includes('Cross-Over'), m!.effet);
  assert.ok(m!.effet.includes('reste rouge'), 'il faut dire ce qu’on verra à l’écran');
});

test('la fibre et le série ne sont pas jugés sur la règle du croisement', () => {
  const fibre = CAB.map(c => (c.id === 'c1' ? { ...c, media: 'fibre' as const } : c));
  assert.ok(!verifierCablage(MAT, fibre).some(x => x.quoi.includes('câble')));
});

test('un équipement relié à rien est signalé', () => {
  const seul = [...MAT, { id: 'x', nom: 'Sw-orphelin', type: 'switch' as const, modele: '2960', ports: 24 }];
  const pb = verifierCablage(seul, CAB);
  const m = pb.find(x => x.quoi.includes('Sw-orphelin'));
  assert.ok(m);
  assert.ok(m!.effet.includes('sans effet'), 'ses configurations ne serviront à rien');
});

test('un équipement relié à lui-même est une boucle', () => {
  const boucle = [...CAB, { id: 'c7', deId: 'sw2', dePort: 3, versId: 'sw2', versPort: 4, media: 'croise' as const }];
  const pb = verifierCablage(MAT, boucle);
  assert.ok(pb.some(x => x.effet.includes('spanning-tree')), JSON.stringify(pb.map(x => x.quoi)));
});

test('un câble vers un équipement supprimé est signalé sans faire tomber le reste', () => {
  const fantome = [...CAB, { id: 'c8', deId: 'sw1', dePort: 5, versId: 'disparu', versPort: 1, media: 'droit' as const }];
  const pb = verifierCablage(MAT, fantome);
  assert.equal(pb.length, 1);
  assert.ok(pb[0]!.quoi.includes('n’existe plus'));
});

test('les voisins se lisent dans les deux sens du câble', () => {
  // Un câble est symétrique : le lire dans un seul sens ferait croire qu'un
  // switch n'a aucun voisin selon la façon dont on l'a tiré.
  assert.equal(voisinsDe(CAB, 'pc1').length, 1);
  assert.equal(voisinsDe(CAB, 'pc1')[0]!.autreId, 'sw1');
  assert.equal(voisinsDe(CAB, 'mls').length, 3);
});

test('les ports libres excluent ceux déjà câblés', () => {
  const libres = portsLibres(MAT[1]!, CAB);
  assert.ok(!libres.includes(1), 'le port 1 va vers le poste');
  assert.ok(!libres.includes(24), 'le port 24 remonte au multicouche');
  assert.ok(libres.includes(2));
  assert.equal(portsLibres(MAT[3]!, CAB).length, 0, 'le poste n’a qu’un port, et il est pris');
});

test('le chemin physique existe, ou n’existe pas', () => {
  // La première chose à éliminer devant « ces deux postes ne se voient pas » :
  // s'il n'y a pas de chemin de câbles, aucune configuration n'y changera rien.
  assert.deepEqual(cheminPhysique(CAB, 'pc1', 'fw'), ['pc1', 'sw1', 'mls', 'fw']);
  assert.equal(cheminPhysique(CAB, 'pc1', 'inconnu'), null);
  assert.deepEqual(cheminPhysique(CAB, 'pc1', 'pc1'), ['pc1']);
});

test('un équipement débranché n’a aucun chemin vers les autres', () => {
  const sansLien = CAB.filter(c => c.id !== 'c3');
  assert.equal(cheminPhysique(sansLien, 'pc1', 'fw'), null);
});

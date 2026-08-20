import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CTX, migrateCtx, computePlan, routeursDe, multicouchesDe, switchesDe,
} from '../components/NetworkWorkshop.tsx';
import { remontees, type Cable } from './physique.ts';

/* La couche 1 prévaut : les couches hautes ne tiennent plus leur propre liste
   d'équipements, elles projettent l'inventaire et lisent le câblage. Ces tests
   vérifient les deux choses qui coûteraient cher si elles cassaient — qu'un
   projet enregistré avant la bascule s'ouvre sans rien perdre, et que le
   contexte par défaut ne soit jamais modifié au passage. */

/** Un projet tel qu'il était enregistré : trois listes séparées. */
const ANCIEN = {
  entreprise: 'TP', domaine: 'tp.lan',
  services: [{ id: 's1', name: 'Atelier', hosts: '20', routerIds: ['r7'], hasSwitch: true, dhcp: true, vlan: '10' }],
  routers: [{ id: 'r7', name: 'Routeur1', model: '2811', mod: true }],
  mlsMulticouches: [{ id: 'mA', nom: 'SVI', prefixe: 'FastEthernet0/', vlans: [10, 20] }],
  mlsAcces: [
    { id: 'sw1', name: 'Sw-bat1', vlans: [10], ports: 24, uplink: 24, portMls: 1, mlsId: 'mA' },
    { id: 'sw2', name: 'Sw-bat2', vlans: [20], ports: 48, uplink: 48, portMls: 24, mlsId: 'sw1' },
  ],
};

test('UN PROJET ENREGISTRÉ AVANT LA BASCULE garde tout son matériel', () => {
  const c = migrateCtx(ANCIEN);
  const noms = c.materiels.map(m => `${m.type}:${m.nom}`).sort();
  assert.deepEqual(noms, ['multicouche:SVI', 'routeur:Routeur1', 'switch:Sw-bat1', 'switch:Sw-bat2']);
  // Le modèle et le module d'un routeur ne se perdent pas en route.
  const r = routeursDe(c)[0]!;
  assert.equal(r.model, '2811');
  assert.equal(r.mod, true);
  assert.equal(r.id, 'r7', 'l’id doit survivre : les sous-réseaux le référencent');
  assert.deepEqual(c.services[0]!.routerIds, ['r7']);
});

test('les remontées déclarées deviennent des câbles', () => {
  const c = migrateCtx(ANCIEN);
  assert.equal(c.cables.length, 2);
  const vers1 = c.cables.find(x => x.versId === 'sw1')!;
  assert.equal(vers1.deId, 'mA');
  assert.equal(vers1.dePort, 1, 'le port du multicouche');
  assert.equal(vers1.versPort, 24, 'le port du switch');
});

test('LA CASCADE SE RELIT DANS LE CÂBLAGE, à l’identique', () => {
  // Le vrai test de la bascule : ce que les trois champs disaient, le câble
  // doit le redire. Un uplink inversé enverrait la configuration sur les
  // mauvaises interfaces des deux côtés.
  const c = migrateCtx(ANCIEN);
  const sws = switchesDe(c);
  const sw1 = sws.find(x => x.id === 'sw1')!, sw2 = sws.find(x => x.id === 'sw2')!;
  assert.equal(sw1.mlsId, 'mA');
  assert.equal(sw1.uplink, 24);
  assert.equal(sw1.portMls, 1);
  assert.equal(sw2.mlsId, 'sw1', 'sw2 est en cascade derrière sw1');
  assert.equal(sw2.uplink, 48);
  assert.equal(sw2.portMls, 24);
  assert.equal(sw2.ports, 48, 'le nombre de ports vient de l’inventaire');
  assert.deepEqual(sw2.vlans, [20]);
});

test('le multicouche garde son préfixe et ses VLAN', () => {
  const m = multicouchesDe(migrateCtx(ANCIEN))[0]!;
  assert.equal(m.prefixe, 'FastEthernet0/');
  assert.deepEqual(m.vlans, [10, 20]);
});

test('LE CONTEXTE PAR DÉFAUT N’EST JAMAIS MODIFIÉ par une migration', () => {
  // `{ ...DEFAULT_CTX, ...raw }` copie les références, pas les contenus : sans
  // précaution, la migration allongeait le défaut et le projet suivant
  // s'ouvrait avec le matériel du précédent.
  const avant = JSON.stringify(DEFAULT_CTX);
  migrateCtx(ANCIEN);
  migrateCtx({ routers: [{ id: 'zz', name: 'Z', model: '2911' }] });
  migrateCtx({});
  assert.equal(JSON.stringify(DEFAULT_CTX), avant);
});

test('un projet neuf a ses deux routeurs et son multicouche', () => {
  const c = migrateCtx({});
  assert.equal(routeursDe(c).length, 2);
  assert.equal(multicouchesDe(c).length, 1);
  // Les sous-réseaux d'exemple pointent vers des routeurs qui existent.
  const ids = new Set(routeursDe(c).map(r => r.id));
  for (const s of c.services) for (const rid of s.routerIds) assert.ok(ids.has(rid), rid);
});

test('le plan d’adressage se calcule encore sur l’inventaire', () => {
  const plan = computePlan(migrateCtx({}));
  assert.equal(plan.ok, true, plan.error);
  assert.ok(plan.subs.length >= 4);
  assert.ok(plan.ifaces.length > 0, 'les interfaces des routeurs sont attribuées');
});

test('un switch qu’aucun câble ne relie n’invente pas de remontée', () => {
  // Mieux vaut un rattachement vide, que `verifierMulticouches` signale, qu'une
  // remontée inventée qui masquerait le débranchement.
  const c = migrateCtx({ ...ANCIEN, mlsAcces: [{ id: 'sw9', name: 'Orphelin', vlans: [], ports: 24, uplink: 24, portMls: 1, mlsId: '' }] });
  const seul = { ...c, cables: [] };
  const sw = switchesDe(seul)[0]!;
  assert.equal(sw.mlsId, '');
  assert.equal(sw.uplink, 0);
});

test('un poste ne sert pas de chemin entre deux switches', () => {
  // La remontée ne traverse que la commutation : sinon deux switches reliés au
  // même poste se croiraient en cascade l'un derrière l'autre.
  const cables: Cable[] = [
    { id: 'c1', deId: 'mls', dePort: 1, versId: 'swA', versPort: 24, media: 'croise' },
    { id: 'c2', deId: 'swA', dePort: 1, versId: 'pc', versPort: 1, media: 'droit' },
    { id: 'c3', deId: 'pc', dePort: 2, versId: 'swB', versPort: 1, media: 'droit' },
  ];
  const r = remontees(cables, ['mls'], ['mls', 'swA', 'swB']);
  assert.deepEqual(r.map(x => x.id), ['swA']);
});

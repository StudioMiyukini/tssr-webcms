import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  versDocumentPlan, encoderPourUrl, urlDeTransfert, LIMITE_URL,
  type EntreeTopologie,
} from './vers-plan.ts';
import type { Cable, Materiel } from './physique.ts';

/* Une maquette minimale mais representative : un routeur, un multicouche, deux
   switches d'acces, et le routage inter-VLAN porte par une sous-interface. */

const MATERIELS: Materiel[] = [
  { id: 'r1', nom: 'R-Coeur', type: 'routeur', modele: '2911', ports: 4 },
  { id: 'm1', nom: 'MLS-1', type: 'multicouche', modele: '3560', ports: 24 },
  { id: 's1', nom: 'SW-Etage1', type: 'switch', modele: '2960', ports: 26 },
  { id: 's2', nom: 'SW-Etage2', type: 'switch', modele: '2960', ports: 26 },
];

const CABLES: Cable[] = [
  { id: 'c1', deId: 'r1', dePort: 1, versId: 'm1', versPort: 1, media: 'droit' },
  { id: 'c2', deId: 'm1', dePort: 2, versId: 's1', versPort: 25, media: 'croise' },
  { id: 'c3', deId: 'm1', dePort: 3, versId: 's2', versPort: 25, media: 'croise' },
];

const ENTREE: EntreeTopologie = {
  materiels: MATERIELS,
  cables: CABLES,
  interfaces: [
    { routerId: 'r1', iface: 'Gig0/0', ip: '10.0.0.1', cidr: 30, role: 'liaison' },
    { routerId: 'r1', iface: 'Gig0/0.20', ip: '192.168.20.254', cidr: 24, vlan: 20, role: 'lan' },
    { routerId: 'm1', iface: 'Vlan10', ip: '192.168.10.254', cidr: 24, vlan: 10, role: 'svi' },
  ],
  titre: 'Réseau Miyukini',
};

const FIGE = new Date('2026-01-01T00:00:00.000Z');
const ID = () => 'doc-test';

test('chaque cable produit deux ports et un lien', () => {
  const e = versDocumentPlan(ENTREE, FIGE, ID);
  assert.equal(e.document.liens.length, CABLES.length);
  const tousPorts = e.document.noeuds.flatMap((n) => n.ports ?? []);
  // Deux ports par cable, plus les interfaces virtuelles sans cable.
  assert.ok(tousPorts.length >= CABLES.length * 2);
});

test('un lien reference des ports qui existent vraiment', () => {
  const e = versDocumentPlan(ENTREE, FIGE, ID);
  const parNoeud = new Map(e.document.noeuds.map((n) => [n.id, new Set((n.ports ?? []).map((p) => p.id))]));
  for (const l of e.document.liens) {
    // C'est la garantie du modele de Plan : un lien s'accroche a un port, jamais
    // a des coordonnees. Un port manquant donnerait un trait dans le vide.
    assert.ok(parNoeud.get(l.de.noeudId)?.has(l.de.portId), `port de depart absent : ${l.id}`);
    assert.ok(parNoeud.get(l.vers.noeudId)?.has(l.vers.portId), `port d'arrivee absent : ${l.id}`);
  }
});

test('les adresses calculees se retrouvent sur les ports', () => {
  const e = versDocumentPlan(ENTREE, FIGE, ID);
  const r1 = e.document.noeuds.find((n) => n.id === 'n:r1')!;
  const physique = (r1.ports ?? []).find((p) => p.nom === 'Gig0/0');
  assert.equal(physique?.ip, '10.0.0.1/30');
});

test('une sous-interface 802.1Q devient un port virtuel', () => {
  const e = versDocumentPlan(ENTREE, FIGE, ID);
  const r1 = e.document.noeuds.find((n) => n.id === 'n:r1')!;
  const virtuel = (r1.ports ?? []).find((p) => p.nom === 'Gig0/0.20');
  assert.equal(virtuel?.nature, 'virtuelle');
  assert.equal(virtuel?.vlan, '20');
  assert.equal(virtuel?.ip, '192.168.20.254/24');
});

test('une SVI de multicouche devient un port virtuel', () => {
  const e = versDocumentPlan(ENTREE, FIGE, ID);
  const m1 = e.document.noeuds.find((n) => n.id === 'n:m1')!;
  const svi = (m1.ports ?? []).find((p) => p.nom === 'Vlan10');
  assert.equal(svi?.nature, 'virtuelle');
  assert.equal(svi?.ip, '192.168.10.254/24');
});

test('les ports d un meme bord ne se superposent pas', () => {
  const e = versDocumentPlan(ENTREE, FIGE, ID);
  const m1 = e.document.noeuds.find((n) => n.id === 'n:m1')!;
  const bas = (m1.ports ?? []).filter((p) => p.cote === 'bas');
  assert.equal(bas.length, 2, 'le multicouche descend vers deux switches');
  assert.notEqual(bas[0]!.position, bas[1]!.position);
});

test('une position posee a la main est reprise telle quelle', () => {
  const e = versDocumentPlan({ ...ENTREE, positions: { r1: { x: 777, y: 42 } } }, FIGE, ID);
  const r1 = e.document.noeuds.find((n) => n.id === 'n:r1')!;
  assert.equal(r1.x, 777);
  assert.equal(r1.y, 42);
});

test('un cable vers un equipement absent est ignore, pas dessine', () => {
  const e = versDocumentPlan({
    ...ENTREE,
    cables: [...CABLES, { id: 'cX', deId: 'r1', dePort: 2, versId: 'fantome', versPort: 1, media: 'droit' }],
  }, FIGE, ID);
  assert.equal(e.document.liens.length, CABLES.length);
});

test('l etiquette d un lien tient sur la toile', () => {
  const e = versDocumentPlan(ENTREE, FIGE, ID);
  const etiquettes = e.document.liens.map((l) => l.etiquette ?? '');
  assert.ok(etiquettes.includes('cuivre droit'));
  // La parenthese anglaise chevauchait le lien voisin : elle reste dans l'atelier.
  assert.ok(!etiquettes.some((x) => x.includes('(')), `parenthese restee : ${etiquettes.join(' / ')}`);
});

test('la colonne demarre a droite de la palette de Plan', () => {
  const e = versDocumentPlan(ENTREE, FIGE, ID);
  // Une interface virtuelle accroche son etiquette a gauche du noeud : trop pres
  // du bord, elle disparait sous la palette des l'ouverture.
  const auto = e.document.noeuds.filter((n) => n.id !== 'n:manuel');
  assert.ok(Math.min(...auto.map((n) => n.x)) >= 400);
});

test('la liaison serie se distingue du cuivre par son motif', () => {
  const e = versDocumentPlan({
    ...ENTREE,
    cables: [{ id: 'cs', deId: 'r1', dePort: 1, versId: 'm1', versPort: 1, media: 'serie' }],
  }, FIGE, ID);
  assert.equal(e.document.liens[0]!.style?.motif, 'tirets');
});

test('l enveloppe porte le format et la version attendus par Plan', () => {
  const e = versDocumentPlan(ENTREE, FIGE, ID);
  assert.equal(e.format, 'miyukini-plan');
  assert.equal(e.version, 1);
  assert.equal(e.exporteLe, FIGE.toISOString());
  assert.equal(e.document.titre, 'Réseau Miyukini');
});

test('l encodage d URL ne produit aucun caractere reserve', () => {
  const e = versDocumentPlan(ENTREE, FIGE, ID);
  const charge = encoderPourUrl(e);
  // `+`, `/` et `=` cassent une URL ou se font tronquer par les outils qui
  // devinent la fin d'un lien.
  assert.ok(!/[+/=]/.test(charge), 'la charge contient un caractere reserve');
});

test('l encodage survit aux accents', () => {
  const e = versDocumentPlan({ ...ENTREE, titre: 'Réseau — Étage 1 « côté cour »' }, FIGE, ID);
  const charge = encoderPourUrl(e);
  const base64 = charge.replace(/-/g, '+').replace(/_/g, '/');
  const complet = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binaire = Buffer.from(complet, 'base64');
  const relu = JSON.parse(new TextDecoder().decode(binaire));
  assert.equal(relu.document.titre, 'Réseau — Étage 1 « côté cour »');
});

test('une topologie trop lourde renonce a l URL plutot que de la tronquer', () => {
  // Cent equipements : au-dela de ce qu'un fragment transporte sans risque.
  const gros: Materiel[] = Array.from({ length: 100 }, (_, i) => ({
    id: `sw${i}`, nom: `SW-${i}`, type: 'switch', modele: '2960', ports: 26,
  }));
  const grosCables: Cable[] = gros.slice(1).map((m, i) => ({
    id: `c${i}`, deId: gros[0]!.id, dePort: i + 1, versId: m.id, versPort: 25, media: 'croise',
  }));
  const e = versDocumentPlan({ materiels: gros, cables: grosCables }, FIGE, ID);
  assert.ok(encoderPourUrl(e).length > LIMITE_URL);
  assert.equal(urlDeTransfert('https://plan.miyukini.org', e), null);
});

test('une topologie normale tient dans une URL', () => {
  const e = versDocumentPlan(ENTREE, FIGE, ID);
  const url = urlDeTransfert('https://plan.miyukini.org', e);
  assert.ok(url);
  assert.ok(url!.startsWith('https://plan.miyukini.org/#schema='));
});

test('un inventaire vide ne produit ni noeud ni lien', () => {
  const e = versDocumentPlan({ materiels: [], cables: [] }, FIGE, ID);
  assert.equal(e.document.noeuds.length, 0);
  assert.equal(e.document.liens.length, 0);
});

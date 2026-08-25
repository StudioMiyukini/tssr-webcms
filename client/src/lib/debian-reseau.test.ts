import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONFIG_VIDE, commandes, fichierHosts, fichierInterfaces, fichierResolv,
  masqueDe, plan, verifier, versEntier, versTexte, type Config,
} from './debian-reseau.ts';

const conf = (p: Partial<Config> = {}): Config => ({ ...CONFIG_VIDE, ...p });
const erreurs = (c: Config) => verifier(c).filter(s => s.gravite === 'erreur').map(s => s.quoi);
const tout = (c: Config) => verifier(c).map(s => s.quoi);

/* ── L'arithmétique ──────────────────────────────────────────────────────── */

test('conversion aller-retour', () => {
  assert.equal(versEntier('192.168.10.20'), 3232238100);
  assert.equal(versTexte(3232238100), '192.168.10.20');
  assert.equal(versTexte(masqueDe(24)), '255.255.255.0');
  assert.equal(versTexte(masqueDe(30)), '255.255.255.252');
});

test('une adresse mal écrite est refusée, pas devinée', () => {
  assert.equal(versEntier('192.168.10'), null, 'trois octets');
  assert.equal(versEntier('192.168.10.256'), null, 'octet hors plage');
  assert.equal(versEntier('192.168.10.a'), null, 'pas un nombre');
  assert.equal(versEntier(''), null);
});

test('le plan donne réseau, diffusion et plage', () => {
  const p = plan('192.168.10.20', 24)!;
  assert.equal(p.reseau, '192.168.10.0');
  assert.equal(p.diffusion, '192.168.10.255');
  assert.equal(p.premiere, '192.168.10.1');
  assert.equal(p.derniere, '192.168.10.254');
  assert.equal(p.hotes, 254);
});

test('un /30 ne laisse que deux adresses', () => {
  const p = plan('192.168.10.1', 30)!;
  assert.equal(p.hotes, 2);
  assert.equal(p.premiere, '192.168.10.1');
  assert.equal(p.derniere, '192.168.10.2');
});

/* ── Les vérifications, qui sont l'intérêt de l'outil ────────────────────── */

test('une configuration correcte ne signale aucune erreur', () => {
  assert.deepEqual(erreurs(conf({ resolvconf: true })), []);
});

test('LA PASSERELLE HORS SOUS-RÉSEAU est signalée, avec son symptôme', () => {
  // La faute la plus frequente, et la plus deroutante : le fichier est valide,
  // l'interface monte, le reseau local marche, et rien ne sort.
  const s = verifier(conf({ passerelle: '192.168.99.254' }));
  const e = s.find(x => x.quoi.includes('pas dans le même sous-réseau'));
  assert.ok(e, JSON.stringify(tout(conf({ passerelle: '192.168.99.254' }))));
  assert.equal(e!.gravite, 'erreur');
  assert.ok(e!.effet.includes('rien ne sortira'), e!.effet);
});

test('l’adresse du réseau et celle de diffusion sont refusées', () => {
  assert.ok(erreurs(conf({ adresse: '192.168.10.0' })).some(x => x.includes('réseau lui-même')));
  assert.ok(erreurs(conf({ adresse: '192.168.10.255' })).some(x => x.includes('diffusion')));
});

test('une machine ne peut pas être sa propre passerelle', () => {
  assert.ok(erreurs(conf({ passerelle: '192.168.10.20' })).some(x => x.includes('adresse de la machine')));
});

test('UN « auto » OUBLIÉ est signalé comme ce qu’il est', () => {
  // Le pendant reseau de `start` sans `enable`.
  const s = verifier(conf({ montage: 'manuel' }));
  const a = s.find(x => x.quoi.includes('auto'));
  assert.ok(a);
  assert.ok(a!.effet.includes('après un redémarrage'), a!.effet);
});

test('l’absence de resolvconf est signalée, et change le fichier produit', () => {
  const sans = conf({ resolvconf: false });
  assert.ok(tout(sans).some(x => x.includes('resolvconf')));
  // La ligne dns-nameservers serait ignoree en silence : on ne l'ecrit pas
  // comme DIRECTIVE. Le mot reste, dans le commentaire qui explique pourquoi.
  const active = /^\s*dns-nameservers /m;
  assert.ok(!active.test(fichierInterfaces(sans)), fichierInterfaces(sans));
  assert.ok(fichierInterfaces(sans).includes('# dns-nameservers demande le paquet resolvconf'), 'un commentaire explique pourquoi');
  // Avec le paquet, la ligne a un sens.
  assert.ok(fichierInterfaces(conf({ resolvconf: true })).includes('dns-nameservers 192.168.10.11'));
});

test('au-delà de trois serveurs DNS, on prévient', () => {
  const c = conf({ dns: '1.1.1.1 8.8.8.8 9.9.9.9 8.8.4.4', resolvconf: true });
  assert.ok(tout(c).some(x => x.includes('4 serveurs')));
  // Et on n'en ecrit que trois, puisque les suivants seraient ignores.
  assert.equal((fichierInterfaces(c).match(/\d+\.\d+\.\d+\.\d+/g) ?? []).filter(x => x.startsWith('8.8.4.4')).length, 0);
});

test('eth0 déclenche un conseil, pas une erreur', () => {
  const s = verifier(conf({ iface: 'eth0' }));
  const c = s.find(x => x.quoi.includes('eth0'));
  assert.ok(c);
  assert.equal(c!.gravite, 'conseil');
});

test('en DHCP, on ne verifie plus l’adressage', () => {
  // Rien a valider : c'est le serveur qui fournit tout.
  assert.deepEqual(erreurs(conf({ methode: 'dhcp', adresse: 'nimporte quoi' })), []);
});

test('les routes et adresses supplémentaires sont contrôlées', () => {
  assert.ok(erreurs(conf({ routes: '10.0.0.0 via 192.168.10.253' })).some(x => x.includes('mal écrite')));
  assert.ok(erreurs(conf({ adressesSup: 'pas une adresse' })).some(x => x.includes('supplémentaire invalide')));
  assert.ok(tout(conf({ adressesSup: '192.168.10.21' })).some(x => x.includes('Masque manquant')));
});

/* ── Ce qui est produit ──────────────────────────────────────────────────── */

test('le fichier contient le loopback et la strophe de l’interface', () => {
  const f = fichierInterfaces(conf({ resolvconf: true }));
  assert.ok(f.includes('iface lo inet loopback'), 'le loopback ne se retire jamais');
  assert.ok(f.includes('auto ens18'));
  assert.ok(f.includes('iface ens18 inet static'));
  assert.ok(f.includes('address 192.168.10.20/24'));
  assert.ok(f.includes('gateway 192.168.10.254'));
});

test('CHAQUE « up » A SON « down »', () => {
  // Sinon l'adresse ou la route survit a un ifdown, et la configuration reelle
  // diverge de ce que decrit le fichier.
  const f = fichierInterfaces(conf({ adressesSup: '192.168.10.21/24', routes: '10.0.0.0/8 via 192.168.10.253' }));
  const up = (f.match(/^\s+up /gm) ?? []).length;
  const down = (f.match(/^\s+down /gm) ?? []).length;
  assert.equal(up, 2);
  assert.equal(down, up, 'autant de down que de up');
});

test('en DHCP, le fichier ne contient ni adresse ni passerelle', () => {
  const f = fichierInterfaces(conf({ methode: 'dhcp' }));
  assert.ok(f.includes('iface ens18 inet dhcp'));
  assert.ok(!f.includes('address '));
  assert.ok(!f.includes('gateway '));
});

test('/etc/hosts porte la ligne 127.0.1.1 que Debian attend', () => {
  // Sans elle, chaque sudo attend puis affiche « unable to resolve host ».
  const h = fichierHosts(conf({ hostname: 'srv-debian', domaine: 'miyukini.lan' }));
  assert.ok(h.includes('127.0.1.1       srv-debian.miyukini.lan   srv-debian'), h);
  assert.ok(h.includes('127.0.0.1       localhost'));
});

test('/etc/resolv.conf reprend le domaine et trois serveurs au plus', () => {
  const r = fichierResolv(conf({ dns: '1.1.1.1 8.8.8.8 9.9.9.9 8.8.4.4' }));
  assert.equal((r.match(/^nameserver /gm) ?? []).length, 3);
  assert.ok(r.includes('search miyukini.lan'));
});

test('les commandes sauvegardent, vérifient, puis appliquent — dans cet ordre', () => {
  const c = commandes(conf());
  const iSauve = c.indexOf('cp -a /etc/network/interfaces');
  const iVerif = c.indexOf('ifquery');
  const iAppli = c.indexOf('ifup');
  assert.ok(iSauve >= 0 && iVerif > iSauve && iAppli > iVerif, c);
  assert.ok(c.includes('ip a show'), 'et l’on vérifie après');
});

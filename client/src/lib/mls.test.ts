import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  configAcces, configMls, dossier, masqueLong, plagePorts, repartirPorts, verifications,
  texteDesPlages, configSortieMls, configPareFeu, tableNat, wildcard,
  etendues, configDhcpSurMls, configResolution, verificationsClient, type AccesClients,
  chevauchements, configRouteurExterne, ficheSite, type ReseauExterne,
  NATIF_PAR_DEFAUT, PORTS_PAR_DEFAUT, PREFIXE_3560, vlansDe, accesDe, verifierMulticouches, type Multicouche,
  mlsDe, enfantsDe, vlansTransportes,
  analyserPlage, ecrirePlage, affectations, verifierPorts, portsAccesDe, portsTrunkDe, type MlsPlan, type AccessSwitch, type SortieInternet,
  sortieEffective, verifierSortie, type SegmentSortie,
} from './mls.ts';

/* La maquette du TP VLAN 3 (Donatien&co) sert de cas de référence : cinq VLAN,
   quatre switches d'accès, un switch multicouche, un serveur DHCP central. Si le
   module sait produire celle-là, il sait produire les autres. */
const TP: MlsPlan = {
  multicouches: [{ id: 'm1', nom: 'MLS-Core', prefixe: PREFIXE_3560, vlans: [] }],
  dhcpServer: '192.168.80.1',
  natif: NATIF_PAR_DEFAUT,
  vlans: [
    { id: 10, name: 'ATELIER', reseau: '192.168.10.0', cidr: 24, passerelle: '192.168.10.254', dhcp: true },
    { id: 20, name: 'DESIGN', reseau: '192.168.20.0', cidr: 24, passerelle: '192.168.20.254', dhcp: true },
    { id: 30, name: 'ACCUEIL', reseau: '192.168.30.0', cidr: 24, passerelle: '192.168.30.254', dhcp: true },
    { id: 80, name: 'SERVEUR', reseau: '192.168.80.0', cidr: 29, passerelle: '192.168.80.254', dhcp: false },
    { id: 90, name: 'ADMIN', reseau: '192.168.90.0', cidr: 28, passerelle: '192.168.90.254', dhcp: false },
  ],
  acces: [
    { id: 'a1', name: 'Sw-bat1', vlans: [10, 20, 90], ports: 24, uplink: 24, portMls: 1, mlsId: 'm1' },
    { id: 'a2', name: 'Sw-bat2', vlans: [10, 20, 90], ports: 24, uplink: 24, portMls: 2, mlsId: 'm1' },
    { id: 'a3', name: 'Sw-accueil', vlans: [30, 80, 90], ports: 24, uplink: 23, portMls: 3, mlsId: 'm1' },
    { id: 'a4', name: 'Sw-IT', vlans: [80, 90], ports: 24, uplink: 24, portMls: 4, mlsId: 'm1' },
  ],
};

test('masqueLong convertit le préfixe en masque décimal', () => {
  assert.equal(masqueLong(24), '255.255.255.0');
  assert.equal(masqueLong(29), '255.255.255.248');
  assert.equal(masqueLong(28), '255.255.255.240');
  assert.equal(masqueLong(30), '255.255.255.252');
});

test('masqueLong borne les valeurs hors plage plutôt que de rendre n’importe quoi', () => {
  assert.equal(masqueLong(0), '0.0.0.0');
  assert.equal(masqueLong(32), '255.255.255.255');
  assert.equal(masqueLong(-5), '0.0.0.0');
  assert.equal(masqueLong(99), '255.255.255.255');
});

test('plagePorts écrit un port seul sans tiret', () => {
  assert.equal(plagePorts(3, 3), '3');
  assert.equal(plagePorts(1, 10), '1-10');
});

test('la répartition des ports n’empiète jamais sur l’uplink', () => {
  // Le piège : un trunk qui écrase un port d'accès. Tout le reste marche, et un
  // poste ne voit rien sans qu'on comprenne pourquoi. Trouvé par ce test sur
  // Sw-accueil, dont l'uplink (23) tombe au milieu du switch.
  for (const sw of TP.acces) {
    for (const p of repartirPorts(sw)) {
      for (const r of p.ranges) {
        assert.ok(sw.uplink < r.debut || sw.uplink > r.fin,
          `${sw.name} : l'uplink ${sw.uplink} tombe dans ${r.debut}-${r.fin}`);
      }
    }
  }
});

test('un uplink au milieu coupe le VLAN en deux plages, sans l’avaler', () => {
  // Le cas exact du TP : Sw-accueil remonte par le port 23, pas par le 24.
  const accueil = TP.acces.find(s => s.name === 'Sw-accueil')!;
  const parts = repartirPorts(accueil);
  const coupe = parts.find(p => p.ranges.length > 1);
  assert.ok(coupe, 'un VLAN devrait être coupé par l’uplink 23');
  assert.ok(texteDesPlages(coupe!.ranges).includes(','), texteDesPlages(coupe!.ranges));
});

test('la répartition ne dépasse pas le nombre de ports du switch', () => {
  for (const sw of TP.acces) {
    for (const p of repartirPorts(sw)) {
      for (const r of p.ranges) {
        assert.ok(r.debut >= 1 && r.fin <= sw.ports, `${sw.name} : ${r.debut}-${r.fin} hors de 1-${sw.ports}`);
      }
    }
  }
});

test('les plages de ports ne se chevauchent pas', () => {
  // Deux VLAN sur le même port, c'est le dernier configuré qui gagne — en
  // silence.
  for (const sw of TP.acces) {
    const pris = new Set<number>();
    for (const p of repartirPorts(sw)) {
      for (const r of p.ranges) {
        for (let i = r.debut; i <= r.fin; i++) {
          assert.ok(!pris.has(i), `${sw.name} : le port ${i} est attribué deux fois`);
          pris.add(i);
        }
      }
    }
  }
});

test('tous les ports disponibles sont attribués, l’uplink excepté', () => {
  for (const sw of TP.acces) {
    const pris = new Set<number>();
    for (const p of repartirPorts(sw)) for (const r of p.ranges) for (let i = r.debut; i <= r.fin; i++) pris.add(i);
    assert.equal(pris.size, sw.ports - 1, `${sw.name} : ${pris.size} ports attribués`);
    assert.ok(!pris.has(sw.uplink), `${sw.name} : l'uplink ne doit pas être attribué`);
  }
});

test('chaque VLAN déclaré sur un switch reçoit au moins un port', () => {
  for (const sw of TP.acces) {
    const parts = repartirPorts(sw);
    for (const v of sw.vlans) {
      assert.ok(parts.some(p => p.vlan === v), `${sw.name} : le VLAN ${v} n'a aucun port`);
    }
  }
});

test('un switch sans VLAN ne produit aucune plage', () => {
  const vide: AccessSwitch = { id: 'x', name: 'Sw-vide', vlans: [], ports: 24, uplink: 24, portMls: 9, mlsId: 'm1' };
  assert.deepEqual(repartirPorts(vide), []);
});

test('la config du multicouche active le routage avant tout', () => {
  const txt = configMls(TP);
  const iRouting = txt.indexOf('ip routing');
  const iSvi = txt.indexOf('interface vlan 10');
  assert.ok(iRouting > 0, 'ip routing absent');
  assert.ok(iRouting < iSvi, 'ip routing doit précéder les SVI');
});

test('les VLAN existent avant les SVI qui s’y appuient', () => {
  const txt = configMls(TP);
  assert.ok(txt.indexOf('vlan 10\n name ATELIER') < txt.indexOf('interface vlan 10'));
});

test('chaque SVI porte sa passerelle et son masque long', () => {
  const txt = configMls(TP);
  assert.ok(txt.includes('interface vlan 80\n ip address 192.168.80.254 255.255.255.248'));
  assert.ok(txt.includes('interface vlan 90\n ip address 192.168.90.254 255.255.255.240'));
});

test('le relais DHCP ne se pose que sur les VLAN qui en ont besoin', () => {
  const txt = configMls(TP);
  const bloc = (v: number) => txt.slice(txt.indexOf(`interface vlan ${v}`), txt.indexOf(`interface vlan ${v}`) + 200);
  assert.ok(bloc(10).includes('ip helper-address 192.168.80.1'), 'le VLAN 10 doit relayer');
  assert.ok(!bloc(80).includes('ip helper-address'), 'le VLAN des serveurs n’a pas à relayer vers lui-même');
});

test('sans serveur DHCP déclaré, aucun relais n’est écrit', () => {
  const txt = configMls({ ...TP, dhcpServer: '' });
  assert.ok(!txt.includes('ip helper-address'));
});

test('le multicouche déclare l’encapsulation avant de passer en trunk', () => {
  // Sur un 3560 la commande est obligatoire, et le refus est incompréhensible
  // quand on recopie une config de 2960.
  const txt = configMls(TP);
  const iEnc = txt.indexOf('switchport trunk encapsulation dot1q');
  const iMode = txt.indexOf('switchport mode trunk');
  assert.ok(iEnc > 0 && iEnc < iMode, 'l’encapsulation doit précéder le mode trunk');
});

test('chaque switch d’accès a son lien déclaré sur le multicouche', () => {
  const txt = configMls(TP);
  for (const sw of TP.acces) {
    assert.ok(txt.includes(`description Trunk 802.1Q vers ${sw.name}`), `lien vers ${sw.name} absent`);
  }
});

test('le trunk n’autorise que les VLAN réellement présents sur le switch', () => {
  // Laisser passer tous les VLAN partout marche aussi, et c'est exactement ce
  // que le TP demande de ne pas faire : le tableau du dossier perd son sens.
  const txt = configMls(TP);
  const bloc = txt.slice(txt.indexOf('vers Sw-IT'), txt.indexOf('vers Sw-IT') + 300);
  assert.ok(bloc.includes('switchport trunk allowed vlan 80,90'), bloc);
});

test('la config d’un switch d’accès crée ses VLAN, ses ports et son trunk', () => {
  const txt = configAcces(TP.acces[0]!, TP);
  assert.ok(txt.includes('hostname Sw-bat1'));
  assert.ok(txt.includes('vlan 10\n name ATELIER'));
  assert.ok(txt.includes('switchport mode access'));
  assert.ok(txt.includes('switchport access vlan 10'));
  assert.ok(txt.includes('switchport trunk allowed vlan 10,20,90'));
  assert.ok(txt.includes('spanning-tree portfast'), 'sans portfast le DHCP expire avant l’ouverture du port');
});

test('un switch d’accès ne reçoit jamais ip routing', () => {
  // Ce serait le confondre avec le multicouche : un 2960 ne route pas.
  const txt = configAcces(TP.acces[0]!, TP);
  assert.ok(!txt.includes('ip routing'));
  assert.ok(!txt.includes('interface vlan 10\n ip address'));
});

test('le VLAN natif est déclaré des deux côtés du trunk', () => {
  // Un natif divergent fait passer un VLAN et pas l'autre, sans message.
  const mls = configMls(TP);
  const acc = configAcces(TP.acces[0]!, TP);
  assert.ok(mls.includes(`switchport trunk native vlan ${NATIF_PAR_DEFAUT}`));
  assert.ok(acc.includes(`switchport trunk native vlan ${NATIF_PAR_DEFAUT}`));
});

test('le dossier technique rend un tableau par switch, multicouche compris', () => {
  const t = dossier(TP);
  assert.equal(t.length, TP.acces.length + 1);
  assert.equal(t[t.length - 1]!.switchName, 'MLS-Core');
});

test('le dossier reprend le réseau et le masque de chaque VLAN', () => {
  const t = dossier(TP);
  const bat1 = t.find(x => x.switchName === 'Sw-bat1')!;
  const v10 = bat1.rows.find(r => r.vlan === 10)!;
  assert.equal(v10.nom, 'ATELIER');
  assert.equal(v10.idsr, '192.168.10.0');
  assert.equal(v10.msr, 24);
  assert.equal(v10.tag, '24', 'le port trunk doit être celui de l’uplink');
  assert.ok(v10.untag.length > 0, 'un VLAN de postes doit avoir des ports d’accès');
});

test('le multicouche n’a aucun port d’accès : tout est en trunk', () => {
  const mls = dossier(TP).find(x => x.switchName === 'MLS-Core')!;
  for (const r of mls.rows) {
    assert.equal(r.untag, '', `le VLAN ${r.vlan} ne doit pas avoir de port d’accès sur le multicouche`);
    assert.ok(r.tag.includes(','), 'le multicouche agrège les liens vers les switches');
  }
});

test('les vérifications commencent par le multicouche et finissent par le poste', () => {
  // L'ordre est le message : on descend les couches, on ne teste pas au hasard.
  const v = verifications(TP);
  assert.ok(v[0]!.titre.includes('MLS-Core'));
  assert.ok(v[v.length - 1]!.titre.toLowerCase().includes('poste'));
  assert.ok(v.some(s => s.lignes.some(l => l.includes('show ip route'))));
});

test('un plan minimal ne casse rien', () => {
  const mini: MlsPlan = {
    multicouches: [{ id: 'm1', nom: 'SW-L3', prefixe: PREFIXE_3560, vlans: [] }], dhcpServer: '', natif: 0,
    vlans: [{ id: 10, name: 'ADMIN', reseau: '10.0.0.0', cidr: 24, passerelle: '10.0.0.1', dhcp: false }],
    acces: [],
  };
  const txt = configMls(mini);
  assert.ok(txt.includes('ip routing'));
  assert.ok(txt.includes('interface vlan 10'));
  assert.ok(!txt.includes('native vlan'), 'sans VLAN natif choisi, on n’en invente pas');
  assert.equal(dossier(mini).length, 1);
});

test('les ports par défaut correspondent à un 2960 courant', () => {
  assert.equal(PORTS_PAR_DEFAUT, 24);
});

/* ─────────────────────────── Sortie Internet ─────────────────────────── */

const SORTIE: SortieInternet = {
  firewall: 'Firewall',
  ipMls: '10.0.0.1', ipFirewall: '10.0.0.2', lienCidr: 30,
  portMls: 'FastEthernet0/24',
  ifInside: 'GigabitEthernet0/0',
  ifWan: 'GigabitEthernet0/1',
  ipWan: '203.0.113.2', cidrWan: 30,
  passerelleFai: '203.0.113.1',
  publie: { ip: '192.168.80.1', port: '80' },
};

test('wildcard convertit le préfixe en masque générique', () => {
  assert.equal(wildcard(24), '0.0.0.255');
  assert.equal(wildcard(29), '0.0.0.7');
  assert.equal(wildcard(28), '0.0.0.15');
  assert.equal(wildcard(32), '0.0.0.0');
});

test('le multicouche sort par un port routé, pas par un port de commutation', () => {
  const txt = configSortieMls(TP, SORTIE);
  const iNo = txt.indexOf('no switchport');
  const iIp = txt.indexOf('ip address 10.0.0.1');
  assert.ok(iNo > 0 && iNo < iIp, 'no switchport doit précéder l’adressage');
  assert.ok(txt.includes('ip route 0.0.0.0 0.0.0.0 10.0.0.2'), 'route par défaut vers le pare-feu');
});

test('le pare-feu déclare inside et outside sur les bonnes interfaces', () => {
  // Les inverser produit un NAT qui ne traduit rien, sans le moindre message.
  const txt = configPareFeu(TP, SORTIE);
  const inside = txt.slice(txt.indexOf('interface GigabitEthernet0/0'), txt.indexOf('interface GigabitEthernet0/1'));
  const outside = txt.slice(txt.indexOf('interface GigabitEthernet0/1'));
  assert.ok(inside.includes('ip nat inside'), 'le côté LAN doit être inside');
  assert.ok(!inside.includes('ip nat outside'));
  assert.ok(outside.includes('ip nat outside'), 'le côté FAI doit être outside');
});

test('la liste d’accès NAT couvre tous les VLAN internes', () => {
  const txt = configPareFeu(TP, SORTIE);
  for (const v of TP.vlans) {
    assert.ok(txt.includes(`permit ${v.reseau} ${wildcard(v.cidr)}`), `VLAN ${v.id} absent de NAT-LAN`);
  }
});

test('la surcharge sort par l’interface WAN', () => {
  const txt = configPareFeu(TP, SORTIE);
  assert.ok(txt.includes('ip nat inside source list NAT-LAN interface GigabitEthernet0/1 overload'));
});

test('LE PIÈGE : le pare-feu a une route de retour vers chaque VLAN', () => {
  // Sans elles, il traduit le trafic sortant sans savoir par où renvoyer les
  // réponses. Depuis le pare-feu, Internet répond ; depuis un poste, rien — et
  // la cause est deux équipements plus loin que là où on cherche.
  const txt = configPareFeu(TP, SORTIE);
  for (const v of TP.vlans) {
    assert.ok(
      txt.includes(`ip route ${v.reseau} ${masqueLong(v.cidr)} ${SORTIE.ipMls}`),
      `route de retour manquante pour le VLAN ${v.id}`,
    );
  }
});

test('les routes de retour pointent vers le multicouche, pas vers le FAI', () => {
  const txt = configPareFeu(TP, SORTIE);
  const retours = txt.split('\n').filter(l => l.startsWith('ip route 192.168.'));
  assert.equal(retours.length, TP.vlans.length);
  for (const r of retours) assert.ok(r.endsWith(SORTIE.ipMls), r);
});

test('la route par défaut du pare-feu vise le FAI', () => {
  assert.ok(configPareFeu(TP, SORTIE).includes('ip route 0.0.0.0 0.0.0.0 203.0.113.1'));
});

test('la publication d’un serveur est facultative', () => {
  const avec = configPareFeu(TP, SORTIE);
  assert.ok(avec.includes('ip nat inside source static tcp 192.168.80.1 80'));
  const sans = configPareFeu(TP, { ...SORTIE, publie: undefined });
  assert.ok(!sans.includes('source static'));
});

test('la table NAT annonce ce que show ip nat translations montrera', () => {
  const rows = tableNat(TP, SORTIE);
  assert.equal(rows.filter(r => r.proto === 'any').length, TP.vlans.length);
  assert.ok(rows.every(r => r.traduit.startsWith('203.0.113.2')));
  assert.ok(rows.some(r => r.proto === 'tcp'), 'la publication doit apparaître');
});

/* ─────────────────────── L'accès des clients ─────────────────────── */

const CLIENTS: AccesClients = {
  dns: '192.168.80.1',
  domaine: 'donatien.lan',
  bailJours: 7,
  site: { nom: 'www.exemple.lan', ip: '198.51.100.10' },
};

test('une étendue est produite par VLAN qui demande le DHCP', () => {
  const e = etendues(TP, CLIENTS);
  // 10, 20, 30 sont en DHCP ; 80 (serveurs) et 90 (admin) non.
  assert.deepEqual(e.map(x => x.vlan), [10, 20, 30]);
});

test('chaque étendue distribue la passerelle — sinon le poste ne sort pas', () => {
  for (const e of etendues(TP, CLIENTS)) {
    const v = TP.vlans.find(x => x.id === e.vlan)!;
    assert.equal(e.passerelle, v.passerelle, `VLAN ${e.vlan}`);
  }
});

test('la plage distribuée n’empiète jamais sur la passerelle', () => {
  // Distribuer l'adresse de la SVI donne un conflit que le poste signale mal.
  for (const e of etendues(TP, CLIENTS)) {
    assert.notEqual(e.fin, e.passerelle, `VLAN ${e.vlan} : la plage va jusqu'à la passerelle`);
    assert.ok(e.debut < e.fin, `VLAN ${e.vlan} : plage vide (${e.debut} → ${e.fin})`);
  }
});

test('le bas du réseau reste libre pour les adresses fixes', () => {
  const e = etendues(TP, CLIENTS).find(x => x.vlan === 10)!;
  assert.equal(e.debut, '192.168.10.10');
  assert.equal(e.fin, '192.168.10.253', 'la passerelle est en .254');
});

test('un réseau étroit ne réserve pas dix adresses qu’il n’a pas', () => {
  const petit: MlsPlan = {
    ...TP,
    vlans: [{ id: 51, name: 'SERVEURS', reseau: '192.168.51.0', cidr: 29, passerelle: '192.168.51.6', dhcp: true }],
  };
  const e = etendues(petit, CLIENTS)[0]!;
  assert.equal(e.debut, '192.168.51.1');
  assert.equal(e.fin, '192.168.51.5');
});

test('les étendues sur le multicouche posent la passerelle et le DNS', () => {
  const txt = configDhcpSurMls(TP, CLIENTS);
  assert.ok(txt.includes('default-router 192.168.10.254'), 'passerelle absente');
  assert.ok(txt.includes('dns-server 192.168.80.1'), 'DNS absent');
  assert.ok(txt.includes('domain-name donatien.lan'));
  assert.ok(txt.includes('ip dhcp excluded-address 192.168.10.254'), 'la passerelle doit être exclue');
});

test('sans DNS déclaré, aucune ligne dns-server n’est écrite', () => {
  const txt = configDhcpSurMls(TP, { ...CLIENTS, dns: '' });
  assert.ok(!txt.includes('dns-server'));
  assert.ok(txt.includes('default-router'), 'la passerelle reste indispensable');
});

test('sans VLAN en DHCP, on le dit au lieu de rendre une config vide', () => {
  const sans: MlsPlan = { ...TP, vlans: TP.vlans.map(v => ({ ...v, dhcp: false })) };
  assert.ok(configDhcpSurMls(sans, CLIENTS).startsWith('!'));
});

test('la résolution des équipements est distincte de celle des postes', () => {
  // Un ping par nom depuis la console échoue tant que l'équipement lui-même
  // n'a pas de serveur DNS — même quand les postes résolvent parfaitement.
  const txt = configResolution(CLIENTS);
  assert.ok(txt.includes('ip domain-lookup'));
  assert.ok(txt.includes('ip name-server 192.168.80.1'));
  assert.ok(txt.includes('ip host www.exemple.lan 198.51.100.10'));
});

test('les vérifications client vont du poste vers le site, jamais l’inverse', () => {
  const v = verificationsClient(TP, CLIENTS, SORTIE);
  assert.equal(v.length, 4);
  assert.ok(v[0]!.lignes.some(l => l.includes('ipconfig')), 'on commence par ce que le poste a reçu');
  assert.ok(v[1]!.lignes.some(l => l.includes('192.168.10.254')), 'puis sa passerelle');
  assert.ok(v[2]!.lignes.some(l => l.includes('198.51.100.10')), 'puis l’IP du site');
  assert.ok(v[3]!.lignes.some(l => l.includes('nslookup')), 'et le nom en dernier');
});

test('le test qui isole le DNS est explicite', () => {
  // C'est le diagnostic le plus rentable : si l'IP passe et pas le nom, il n'y
  // a qu'une cause possible.
  const v = verificationsClient(TP, CLIENTS, SORTIE);
  assert.ok(v.some(s => s.lignes.some(l => l.includes("c'est le DNS"))));
});

test('sans site déclaré, les vérifications restent utilisables', () => {
  const v = verificationsClient(TP, { ...CLIENTS, site: undefined });
  assert.equal(v.length, 4);
  assert.ok(v[3]!.lignes.some(l => l.includes('<nom du site>')));
});

/* Les VLAN autorisés à sortir — d'après la maquette réelle du TP, où le VLAN
   des serveurs est délibérément exclu de la traduction. */

test('sans liste, tous les VLAN sortent', () => {
  const txt = configPareFeu(TP, SORTIE);
  for (const v of TP.vlans) assert.ok(txt.includes(`permit ${v.reseau}`), `VLAN ${v.id}`);
});

test('avec une liste, seuls les VLAN choisis sont traduits', () => {
  // Le choix du TP : atelier, design, accueil et admin sortent ; pas les serveurs.
  const txt = configPareFeu(TP, { ...SORTIE, sortants: [10, 20, 30, 90] });
  for (const id of [10, 20, 30, 90]) {
    const v = TP.vlans.find(x => x.id === id)!;
    assert.ok(txt.includes(`permit ${v.reseau} ${wildcard(v.cidr)}`), `VLAN ${id} devrait sortir`);
  }
  assert.ok(!txt.includes('permit 192.168.80.0'), 'le VLAN des serveurs ne doit pas sortir');
});

test('un VLAN retenu est signalé, pas seulement absent', () => {
  // Une absence ressemble à un oubli, et quelqu'un finira par « corriger » le
  // choix de sécurité en croyant réparer une erreur.
  const txt = configPareFeu(TP, { ...SORTIE, sortants: [10, 20, 30, 90] });
  assert.ok(txt.includes('Volontairement absents'), txt.slice(txt.indexOf('NAT-LAN'), txt.indexOf('NAT-LAN') + 400));
  assert.ok(txt.includes('VLAN 80 SERVEUR'));
});

test('les routes de retour couvrent AUSSI les VLAN qui ne sortent pas', () => {
  // Ne pas sortir ne veut pas dire ne pas être joignable : le pare-feu doit
  // savoir où est le VLAN des serveurs, ne serait-ce que pour le publier.
  const txt = configPareFeu(TP, { ...SORTIE, sortants: [10, 20, 30, 90] });
  const v80 = TP.vlans.find(x => x.id === 80)!;
  assert.ok(txt.includes(`ip route ${v80.reseau} ${masqueLong(v80.cidr)} ${SORTIE.ipMls}`));
});

test('la table NAT n’annonce que ce qui sort vraiment', () => {
  const rows = tableNat(TP, { ...SORTIE, sortants: [10, 20, 30, 90] });
  assert.ok(!rows.some(r => r.proto === 'any' && r.interne.startsWith('192.168.80.')));
  assert.equal(rows.filter(r => r.proto === 'any').length, 4);
});

test('les trunks du multicouche visent ses propres ports', () => {
  // Le defaut trouve sur la config reelle : les switches d'acces remontent par
  // leur port 23 ou 24, le multicouche les recoit sur ses ports 1 a 4.
  const txt = configMls(TP);
  for (const sw of TP.acces) {
    assert.ok(txt.includes(`interface ${TP.multicouches[0]!.prefixe}${sw.portMls}`), `port ${sw.portMls} attendu pour ${sw.name}`);
  }
  assert.ok(!txt.includes('GigabitEthernet1/0/'), 'un 3560 de Packet Tracer n’a pas ces interfaces');
});

test('le dossier du multicouche liste ses ports à lui', () => {
  const mls = dossier(TP).find(x => x.switchName === 'MLS-Core')!;
  assert.equal(mls.rows[0]!.tag, '1,2,3,4');
});

/* ─────────────────────── Le réseau externe ─────────────────────── */

const EXTERNE: ReseauExterne = {
  routeur: 'Router1',
  ifVersPareFeu: 'FastEthernet0/0',
  ifVersSite: 'FastEthernet0/1',
  ipVersPareFeu: '85.85.85.2',
  reseauSite: '200.200.200.0',
  cidrSite: 24,
  ipRouteurSite: '200.200.200.254',
  ipSite: '200.200.200.1',
  nomSite: 'www.exemple.lan',
};

/* La maquette telle qu'elle a été montée : le réseau externe réutilise le
   réseau de transit interne, et le serveur porte l'adresse du port routé. */
const EXTERNE_EN_CONFLIT: ReseauExterne = {
  ...EXTERNE,
  reseauSite: '192.168.70.0',
  ipRouteurSite: '192.168.70.254',
  ipSite: '192.168.70.1',
};
const SORTIE_REELLE: SortieInternet = {
  ...SORTIE,
  ipMls: '192.168.70.1', ipFirewall: '192.168.70.2', lienCidr: 24,
  portMls: 'FastEthernet0/24',
  ifInside: 'FastEthernet0/0', ifWan: 'FastEthernet0/1',
  ipWan: '85.85.85.1', cidrWan: 24, passerelleFai: '85.85.85.2',
};

test('un adressage propre ne signale aucun chevauchement', () => {
  assert.deepEqual(chevauchements(TP, EXTERNE, SORTIE), []);
});

test('le chevauchement de la maquette réelle est détecté', () => {
  const c = chevauchements(TP, EXTERNE_EN_CONFLIT, SORTIE_REELLE);
  assert.ok(c.length >= 1, 'le conflit 192.168.70.0/24 doit être vu');
  assert.ok(c.some(x => x.interne.includes('lien multicouche')), JSON.stringify(c));
});

test('l’adresse du site identique au port routé est signalée à part', () => {
  // C'est le cas le plus vicieux : même en corrigeant le réseau, cette
  // adresse-là resterait captée par le multicouche.
  const c = chevauchements(TP, EXTERNE_EN_CONFLIT, SORTIE_REELLE);
  const exact = c.find(x => x.quoi.includes('exactement l’adresse'));
  assert.ok(exact, JSON.stringify(c.map(x => x.quoi)));
  assert.ok(exact!.effet.includes('Aucune règle de NAT'));
});

test('un site dans le réseau d’un VLAN est détecté aussi', () => {
  const c = chevauchements(TP, { ...EXTERNE, reseauSite: '192.168.20.0', ipSite: '192.168.20.50' }, SORTIE);
  assert.ok(c.some(x => x.quoi.includes('VLAN 20')), JSON.stringify(c.map(x => x.quoi)));
});

test('chaque chevauchement dit ce qui se passera, pas seulement qu’il existe', () => {
  // « Deux réseaux identiques » n'aide personne ; « le paquet n'atteindra
  // jamais le site » désigne la panne.
  for (const c of chevauchements(TP, EXTERNE_EN_CONFLIT, SORTIE_REELLE)) {
    assert.ok(c.effet.length > 40, c.effet);
  }
});

test('le routeur externe ne traduit rien', () => {
  // Deux NAT en série cassent les publications sans rien apporter.
  const txt = configRouteurExterne(EXTERNE, SORTIE);
  assert.ok(!txt.includes('ip nat inside'));
  assert.ok(!txt.includes('ip nat outside'));
  assert.ok(txt.includes('Aucun NAT ici'));
});

test('le routeur externe n’a pas de route par défaut', () => {
  // Elle pointerait vers le pare-feu, qui pointe ici : les paquets inconnus
  // rebondiraient entre les deux jusqu'à expiration du TTL.
  const txt = configRouteurExterne(EXTERNE, SORTIE);
  assert.ok(!txt.includes('ip route 0.0.0.0'));
  assert.ok(txt.includes('tourneraient entre les deux'));
});

test('le routeur externe adresse ses deux interfaces', () => {
  const txt = configRouteurExterne(EXTERNE, SORTIE);
  // Les masques se derivent du contexte : les figer ferait passer le test pour
  // une verite alors qu il ne verifie qu une coincidence de fixture.
  assert.ok(txt.includes(`ip address 85.85.85.2 ${masqueLong(SORTIE.cidrWan)}`), txt);
  assert.ok(txt.includes(`ip address 200.200.200.254 ${masqueLong(EXTERNE.cidrSite)}`), txt);
});

test('la fiche du serveur donne sa passerelle, pas seulement son IP', () => {
  // Un serveur sans passerelle repond aux voisins et a personne d'autre : la
  // demande arrive, la reponse ne repart pas.
  const f = ficheSite(EXTERNE);
  assert.ok(f.some(x => x.champ === 'Passerelle' && x.valeur === '200.200.200.254'));
  assert.ok(f.some(x => x.valeur.includes('www.exemple.lan')));
});

/* ─────────────────── Plusieurs switches multicouches ─────────────────── */

/** Deux multicouches qui se partagent les VLAN : un par bâtiment. */
const DEUX: MlsPlan = {
  ...TP,
  multicouches: [
    { id: 'm1', nom: 'MLS-Bat1', prefixe: PREFIXE_3560, vlans: [10, 20] },
    { id: 'm2', nom: 'MLS-Bat2', prefixe: PREFIXE_3560, vlans: [30, 80, 90] },
  ],
  acces: [
    { id: 'a1', name: 'Sw-bat1', vlans: [10, 20], ports: 24, uplink: 24, portMls: 1, mlsId: 'm1' },
    { id: 'a3', name: 'Sw-accueil', vlans: [30, 90], ports: 24, uplink: 23, portMls: 1, mlsId: 'm2' },
  ],
};

test('un multicouche sans liste porte les VLAN que personne ne prend', () => {
  // Le cas courant à un seul switch : tout cocher n'apporterait rien.
  assert.deepEqual(vlansDe(TP, TP.multicouches[0]!).map(v => v.id), [10, 20, 30, 80, 90]);
});

test('avec plusieurs, chacun ne porte que ses VLAN', () => {
  assert.deepEqual(vlansDe(DEUX, DEUX.multicouches[0]!).map(v => v.id), [10, 20]);
  assert.deepEqual(vlansDe(DEUX, DEUX.multicouches[1]!).map(v => v.id), [30, 80, 90]);
});

test('chaque multicouche ne configure que ses propres SVI', () => {
  const bat1 = configMls(DEUX, DEUX.multicouches[0]!);
  assert.ok(bat1.includes('interface vlan 10'));
  assert.ok(!bat1.includes('interface vlan 30'), 'le VLAN 30 est porté par l’autre switch');
  assert.ok(bat1.includes('hostname MLS-Bat1'));
});

test('chaque multicouche ne voit que les switches qui lui sont rattachés', () => {
  assert.deepEqual(accesDe(DEUX, DEUX.multicouches[0]!).map(a => a.name), ['Sw-bat1']);
  const bat2 = configMls(DEUX, DEUX.multicouches[1]!);
  assert.ok(bat2.includes('vers Sw-accueil'));
  assert.ok(!bat2.includes('vers Sw-bat1'));
});

test('le switch d’accès nomme le multicouche auquel il remonte', () => {
  const txt = configAcces(DEUX.acces[1]!, DEUX);
  assert.ok(txt.includes('vers MLS-Bat2'), txt.slice(txt.indexOf('Trunk'), txt.indexOf('Trunk') + 60));
});

test('une répartition saine ne signale rien', () => {
  assert.deepEqual(verifierMulticouches(DEUX), []);
  assert.deepEqual(verifierMulticouches(TP), []);
});

test('DEUX PASSERELLES pour un même VLAN sont refusées', () => {
  // L'erreur que la fonctionnalité rend possible : les postes joindraient l'une
  // ou l'autre au hasard, et le dépannage serait interminable.
  const double: MlsPlan = {
    ...DEUX,
    multicouches: [
      { id: 'm1', nom: 'MLS-Bat1', prefixe: PREFIXE_3560, vlans: [10, 20] },
      // m2 reprend tout le reste : seul le VLAN 20 est en double, pour que le
      // test porte sur le doublon et non sur des VLAN orphelins par accident.
      { id: 'm2', nom: 'MLS-Bat2', prefixe: PREFIXE_3560, vlans: [20, 30, 80, 90] },
    ],
  };
  const pb = verifierMulticouches(double);
  assert.equal(pb.length, 1, JSON.stringify(pb.map(x => x.quoi)));
  assert.ok(pb[0]!.quoi.includes('VLAN 20'));
  assert.ok(pb[0]!.quoi.includes('MLS-Bat1 et MLS-Bat2'));
  assert.ok(pb[0]!.effet.includes('HSRP'), 'la vraie solution doit être nommée');
});

test('un VLAN sans SVI nulle part est signalé', () => {
  const orphelin: MlsPlan = {
    ...DEUX,
    multicouches: [{ id: 'm1', nom: 'MLS-Bat1', prefixe: PREFIXE_3560, vlans: [10] }],
  };
  const pb = verifierMulticouches(orphelin);
  assert.ok(pb.some(x => x.quoi.includes('VLAN 20')), JSON.stringify(pb.map(x => x.quoi)));
  assert.ok(pb.some(x => x.effet.includes('aucune passerelle ne repond')));
});

test('un switch d’accès rattaché à rien est signalé', () => {
  const perdu: MlsPlan = {
    ...TP,
    acces: [{ ...TP.acces[0]!, mlsId: 'inexistant' }],
  };
  const pb = verifierMulticouches(perdu);
  assert.ok(pb.some(x => x.quoi.includes('Sw-bat1') && x.quoi.includes("n'est raccorde a rien")));
});

test('le dossier technique rend un tableau par multicouche', () => {
  const t = dossier(DEUX);
  assert.ok(t.some(x => x.switchName === 'MLS-Bat1'));
  assert.ok(t.some(x => x.switchName === 'MLS-Bat2'));
  const bat1 = t.find(x => x.switchName === 'MLS-Bat1')!;
  assert.deepEqual(bat1.rows.map(r => r.vlan), [10, 20], 'un tableau qui montrerait tous les VLAN effacerait la répartition');
});

/* ─────────────────── Les switches en cascade ─────────────────── */

/** Sw-etage2 pend sous Sw-bat1, qui pend sous le multicouche. */
const CASCADE: MlsPlan = {
  ...TP,
  acces: [
    { id: 'a1', name: 'Sw-bat1', vlans: [10, 20], ports: 24, uplink: 24, portMls: 1, mlsId: 'm1' },
    { id: 'a5', name: 'Sw-etage2', vlans: [30, 90], ports: 24, uplink: 24, portMls: 23, mlsId: 'a1' },
  ],
};

test('un switch en cascade remonte quand même vers le multicouche', () => {
  const etage2 = CASCADE.acces[1]!;
  assert.equal(mlsDe(CASCADE, etage2)?.nom, 'MLS-Core');
});

test('LE PIÈGE : le trunk intermédiaire transporte aussi les VLAN du dessous', () => {
  // On configure le trunk de l'étage 2 avec ses VLAN, on oublie que celui du
  // dessous doit les laisser passer, et l'étage 2 se retrouve isolé. La panne
  // ressemble à un problème de câblage.
  assert.deepEqual(vlansTransportes(CASCADE, CASCADE.acces[0]!), [10, 20, 30, 90]);
  assert.deepEqual(vlansTransportes(CASCADE, CASCADE.acces[1]!), [30, 90]);
});

test('la config du switch intermédiaire autorise la descendance sur son lien montant', () => {
  const txt = configAcces(CASCADE.acces[0]!, CASCADE);
  const montant = txt.slice(txt.indexOf('Le lien montant'));
  assert.ok(montant.includes('switchport trunk allowed vlan 10,20,30,90'), montant.slice(0, 400));
});

test('le switch intermédiaire câble le switch qui pend sous lui', () => {
  const txt = configAcces(CASCADE.acces[0]!, CASCADE);
  assert.ok(txt.includes('Les switches raccordes en dessous'));
  assert.ok(txt.includes('description Trunk 802.1Q vers Sw-etage2'));
  assert.ok(txt.includes('interface GigabitEthernet0/23'), 'sur le port declare');
});

test('le switch du bout ne câble rien en dessous de lui', () => {
  const txt = configAcces(CASCADE.acces[1]!, CASCADE);
  assert.ok(!txt.includes('raccordes en dessous'));
  assert.ok(txt.includes('vers Sw-bat1'), 'il nomme son parent, pas le multicouche');
});

test('le multicouche ne câble que ses enfants directs', () => {
  const txt = configMls(CASCADE);
  assert.ok(txt.includes('vers Sw-bat1'));
  assert.ok(!txt.includes('vers Sw-etage2'), 'l’étage 2 passe par Sw-bat1, pas par un port du multicouche');
});

test('une cascade saine ne signale rien', () => {
  assert.deepEqual(verifierMulticouches(CASCADE), []);
});

test('une cascade qui tourne en rond est refusée', () => {
  // Sans spanning-tree, une boucle sature le reseau en quelques secondes.
  const boucle: MlsPlan = {
    ...CASCADE,
    acces: [
      { ...CASCADE.acces[0]!, mlsId: 'a5' },
      { ...CASCADE.acces[1]!, mlsId: 'a1' },
    ],
  };
  const pb = verifierMulticouches(boucle);
  assert.ok(pb.some(x => x.quoi.includes('tourne en rond')), JSON.stringify(pb.map(x => x.quoi)));
  assert.ok(pb.some(x => x.effet.includes('spanning-tree')));
});

test('une cascade qui n’atteint aucun multicouche est signalée', () => {
  const perdue: MlsPlan = {
    ...CASCADE,
    acces: [
      { ...CASCADE.acces[0]!, mlsId: 'inexistant' },
      CASCADE.acces[1]!,
    ],
  };
  const pb = verifierMulticouches(perdue);
  assert.ok(pb.some(x => x.quoi.includes("n'est raccorde a rien")), JSON.stringify(pb.map(x => x.quoi)));
});

test('le multicouche compte tous les switches qu’il route, cascade comprise', () => {
  assert.deepEqual(accesDe(CASCADE, CASCADE.multicouches[0]!).map(a => a.name), ['Sw-bat1', 'Sw-etage2']);
});

test('un même VLAN vit sur plusieurs switches à la fois', () => {
  // La maquette réelle : le VLAN 10 (atelier) est présent dans les deux
  // bâtiments. Rien ne doit contraindre un VLAN à un seul switch.
  const porteurs = TP.acces.filter(a => a.vlans.includes(10)).map(a => a.name);
  assert.deepEqual(porteurs, ['Sw-bat1', 'Sw-bat2']);
  for (const nom of porteurs) {
    const sw = TP.acces.find(a => a.name === nom)!;
    const txt = configAcces(sw, TP);
    assert.ok(txt.includes('vlan 10\n name ATELIER'), `${nom} doit declarer le VLAN 10`);
    assert.ok(txt.includes('switchport access vlan 10'), `${nom} doit avoir des ports dedans`);
  }
  // Et une seule SVI, sur le multicouche : la passerelle reste unique.
  assert.equal(configMls(TP).split('interface vlan 10').length - 1, 1);
});

/* ─────────────── L'affectation manuelle des ports ─────────────── */

test('analyserPlage lit les formes qu’on écrit vraiment', () => {
  assert.deepEqual(analyserPlage('1-10'), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(analyserPlage('24'), [24]);
  assert.deepEqual(analyserPlage('1,3-5'), [1, 3, 4, 5]);
  assert.deepEqual(analyserPlage(' 2 - 4 '), [2, 3, 4]);
  assert.deepEqual(analyserPlage('5,5,5'), [5], 'les doublons se fondent');
});

test('analyserPlage écarte ce qui n’a pas de sens plutôt que de rendre un faux port', () => {
  // Un NaN glissé dans la liste produirait « interface FastEthernet0/NaN », que
  // l'IOS refuse sans expliquer.
  assert.deepEqual(analyserPlage('abc'), []);
  assert.deepEqual(analyserPlage('10-2'), [], 'une plage à l’envers ne désigne rien');
  assert.deepEqual(analyserPlage('0'), [], 'il n’y a pas de port 0');
  assert.deepEqual(analyserPlage(''), []);
  assert.deepEqual(analyserPlage('1,,3'), [1, 3]);
});

test('ecrirePlage regroupe les ports contigus', () => {
  assert.equal(ecrirePlage([1, 2, 3, 7]), '1-3,7');
  assert.equal(ecrirePlage([5]), '5');
  assert.equal(ecrirePlage([]), '');
});

test('sans affectation déclarée, la répartition automatique s’applique', () => {
  const a = affectations(TP, TP.acces[0]!);
  assert.ok(a.some(x => x.role === 'access' && x.vlan === 10));
  assert.ok(a.some(x => x.role === 'trunk'), 'le lien montant en fait partie');
});

/** Le câblage tel qu'il est décrit dans le dossier du TP pour Sw-bat1. */
const MANUEL: MlsPlan = {
  ...TP,
  acces: [
    {
      ...TP.acces[0]!,
      ports_: [
        { plage: '1-10', role: 'access', vlan: 10 },
        { plage: '11-20', role: 'access', vlan: 20 },
        { plage: '21-22', role: 'access', vlan: 90 },
        { plage: '24', role: 'trunk', vers: 'm1' },
      ],
    },
    ...TP.acces.slice(1),
  ],
};

test('une affectation déclarée remplace le calcul', () => {
  const sw = MANUEL.acces[0]!;
  assert.equal(portsAccesDe(MANUEL, sw, 10), '1-10');
  assert.equal(portsAccesDe(MANUEL, sw, 20), '11-20');
  assert.equal(portsTrunkDe(MANUEL, sw), '24');
});

test('la configuration suit les ports déclarés', () => {
  const txt = configAcces(MANUEL.acces[0]!, MANUEL);
  assert.ok(txt.includes('interface range FastEthernet0/1 - 10'));
  assert.ok(txt.includes('interface range FastEthernet0/11 - 20'));
  assert.ok(txt.includes('switchport access vlan 90'));
});

test('le dossier technique reprend les ports déclarés', () => {
  const t = dossier(MANUEL).find(x => x.switchName === 'Sw-bat1')!;
  assert.equal(t.rows.find(r => r.vlan === 10)!.untag, '1-10');
  assert.equal(t.rows.find(r => r.vlan === 10)!.tag, '24');
});

test('UN PORT AFFECTÉ DEUX FOIS est signalé', () => {
  // La dernière commande gagne, en silence : un poste se retrouve dans un VLAN
  // qu'on ne lui a pas donné.
  const doublon: MlsPlan = {
    ...MANUEL,
    acces: [{ ...MANUEL.acces[0]!, ports_: [
      { plage: '1-10', role: 'access', vlan: 10 },
      { plage: '8-12', role: 'access', vlan: 20 },
      { plage: '24', role: 'trunk', vers: 'm1' },
    ] }, ...MANUEL.acces.slice(1)],
  };
  const pb = verifierPorts(doublon, doublon.acces[0]!);
  assert.ok(pb.some(x => x.quoi.includes('port 8 est affecte deux fois')), JSON.stringify(pb.map(x => x.quoi)));
  assert.ok(pb.some(x => x.effet.includes('en silence')));
});

test('un port au-delà de la capacité du switch est signalé', () => {
  const trop: MlsPlan = {
    ...MANUEL,
    acces: [{ ...MANUEL.acces[0]!, ports: 24, ports_: [
      { plage: '23-28', role: 'access', vlan: 10 },
      { plage: '1', role: 'trunk', vers: 'm1' },
    ] }, ...MANUEL.acces.slice(1)],
  };
  const pb = verifierPorts(trop, trop.acces[0]!);
  assert.ok(pb.some(x => x.quoi.includes("le port 25 n'existe pas")), JSON.stringify(pb.map(x => x.quoi)));
});

test('un VLAN sans port d’accès est signalé, sans être traité comme une faute', () => {
  // C'est legitime pour un VLAN de transit, et une erreur sinon : le message
  // doit dire les deux.
  const sansPorts: MlsPlan = {
    ...MANUEL,
    acces: [{ ...MANUEL.acces[0]!, ports_: [
      { plage: '1-10', role: 'access', vlan: 10 },
      { plage: '24', role: 'trunk', vers: 'm1' },
    ] }, ...MANUEL.acces.slice(1)],
  };
  const pb = verifierPorts(sansPorts, sansPorts.acces[0]!);
  const m = pb.find(x => x.quoi.includes('VLAN 20'));
  assert.ok(m, JSON.stringify(pb.map(x => x.quoi)));
  assert.ok(m!.effet.includes('legitime'), m!.effet);
});

test('un switch sans aucun trunk est signalé', () => {
  const isole: MlsPlan = {
    ...MANUEL,
    acces: [{ ...MANUEL.acces[0]!, ports_: [{ plage: '1-24', role: 'access', vlan: 10 }] }, ...MANUEL.acces.slice(1)],
  };
  const pb = verifierPorts(isole, isole.acces[0]!);
  assert.ok(pb.some(x => x.quoi.includes('aucun trunk')));
});

test('une affectation saine ne signale rien', () => {
  assert.deepEqual(verifierPorts(MANUEL, MANUEL.acces[0]!), []);
});

/* ── Le lien multicouche ↔ pare-feu, décrit une seule fois ─────────────────
   Il se déclarait à deux endroits — comme segment d'interconnexion en
   Segmentation, et ici — chacun avec ses propres adresses. La sortie adopte
   désormais le segment plutôt que de le redécrire. */

const SEGMENT: SegmentSortie = {
  id: 'svc:s9', nom: 'Lien MLS-Routeur', ipMls: '192.168.99.2', ipFirewall: '192.168.99.1',
  cidr: 30, nomRouteur: 'Routeur1',
};

test('sans segment déclaré, la sortie garde ce qu’on a saisi', () => {
  assert.deepEqual(sortieEffective(SORTIE, []), SORTIE);
  assert.deepEqual(verifierSortie(SORTIE, []), []);
});

test('LA SORTIE ADOPTE LE SEGMENT : les adresses viennent du plan d’adressage', () => {
  const eff = sortieEffective({ ...SORTIE, segmentId: 'svc:s9' }, [SEGMENT]);
  assert.equal(eff.ipMls, '192.168.99.2');
  assert.equal(eff.ipFirewall, '192.168.99.1');
  assert.equal(eff.lienCidr, 30);
  assert.equal(eff.firewall, 'Routeur1', 'c’est le même équipement, il porte un seul nom');
  // Le WAN et le NAT restent à la sortie : un segment n'en sait rien.
  assert.equal(eff.ipWan, '203.0.113.2');
  assert.equal(eff.passerelleFai, '203.0.113.1');
  assert.deepEqual(verifierSortie(eff, [SEGMENT]), []);
});

test('LE MÊME CÂBLE DÉCRIT DEUX FOIS est signalé, avec ce que ça provoque', () => {
  // Le défaut qu'on répare : deux plans d'adressage pour un seul lien, et
  // deux extrémités qui ne sont pas dans le même sous-réseau.
  const pb = verifierSortie(SORTIE, [SEGMENT]);
  assert.equal(pb.length, 1);
  assert.ok(pb[0]!.quoi.includes('deux fois'), pb[0]!.quoi);
  assert.ok(pb[0]!.quoi.includes('Lien MLS-Routeur'), 'il faut nommer le segment concerné');
  assert.ok(pb[0]!.effet.includes('rien ne passera'), pb[0]!.effet);
});

test('un segment supprimé ne laisse pas la sortie pointer dans le vide', () => {
  const orpheline = { ...SORTIE, segmentId: 'svc:disparu' };
  // Les adresses retombent sur la saisie plutôt que de devenir vides.
  assert.equal(sortieEffective(orpheline, [SEGMENT]).ipMls, '10.0.0.1');
  const pb = verifierSortie(orpheline, [SEGMENT]);
  assert.equal(pb.length, 1);
  assert.ok(pb[0]!.quoi.includes('n’existe plus'), pb[0]!.quoi);
});

test('la configuration émise suit le segment adopté', () => {
  // La vérification qui compte : ce n'est pas la structure qui doit changer,
  // c'est le texte que l'élève va coller dans l'IOS.
  const eff = sortieEffective({ ...SORTIE, segmentId: 'svc:s9' }, [SEGMENT]);
  const cfg = configSortieMls({ multicouches: [], vlans: [], acces: [], dhcpServer: '', natif: 999 }, eff);
  assert.ok(cfg.includes('ip address 192.168.99.2 255.255.255.252'), cfg);
  assert.ok(cfg.includes('ip route 0.0.0.0 0.0.0.0 192.168.99.1'), cfg);
  assert.ok(!cfg.includes('10.0.0.'), 'l’adresse saisie ne doit plus apparaître nulle part');
});

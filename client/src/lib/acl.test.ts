import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  wildcard, ecrireCible, plage, ecrirePort, ecrireAce, ecrireAcl,
  numeroValide, numeroLibre, ombres, verifier, placement,
  SERVICES, MESSAGES_ICMP,
  analyserColler, lireCible, lirePort, lireLigneCli, cidrDeWildcard, MODELE_COLLER,
  genererAcls, SERVICES_FLUX, OPTIONS_PAR_DEFAUT,
  type Acl, type Ace, type ZoneSource, type ZoneCible, type Flux, type OptionsPolitique,
} from './acl';

const ace = (p: Partial<Ace>): Ace => ({
  id: p.id ?? 'a1',
  autorisation: p.autorisation ?? 'permit',
  protocole: p.protocole ?? 'ip',
  source: p.source ?? { genre: 'any' },
  destination: p.destination ?? { genre: 'any' },
  portSource: p.portSource,
  portDestination: p.portDestination,
  messageIcmp: p.messageIcmp,
  remarque: p.remarque,
});

const acl = (p: Partial<Acl>): Acl => ({
  id: 'l1', nom: p.nom ?? '110', type: p.type ?? 'etendue',
  aces: p.aces ?? [], permitFinal: p.permitFinal ?? false,
  applications: p.applications ?? [{ interface: 'GigabitEthernet0/0', sens: 'in' }],
});

// ===== Le wildcard =====

/*
 * Le masque generique est l'inverse du masque reseau. C'est la premiere chose
 * qu'on rate en TP, et la seule qu'un routeur n'expliquera jamais : une ACE
 * avec un masque a l'endroit est acceptee, elle ne filtre simplement pas ce
 * qu'on croit.
 */
test('le wildcard est l\'inverse du masque', () => {
  assert.equal(wildcard(24), '0.0.0.255');
  assert.equal(wildcard(29), '0.0.0.7');
  assert.equal(wildcard(32), '0.0.0.0');
  assert.equal(wildcard(16), '0.0.255.255');
  assert.equal(wildcard(0), '255.255.255.255');
  assert.equal(wildcard(27), '0.0.0.31');
});

test('un cidr hors bornes est ramene dans les bornes', () => {
  assert.equal(wildcard(-4), '255.255.255.255');
  assert.equal(wildcard(48), '0.0.0.0');
});

// ===== Les cibles =====

test('chaque forme de cible s\'ecrit comme IOS l\'attend', () => {
  assert.equal(ecrireCible({ genre: 'any' }), 'any');
  assert.equal(ecrireCible({ genre: 'host', ip: '172.16.10.20' }), 'host 172.16.10.20');
  assert.equal(ecrireCible({ genre: 'reseau', ip: '192.168.1.0', cidr: 24 }), '192.168.1.0 0.0.0.255');
});

test('la plage d\'une cible couvre le reseau entier, pas la seule adresse saisie', () => {
  // Une adresse d'hote donnee pour un reseau doit quand meme rendre le bloc :
  // sinon le controle d'ombrage raterait « 192.168.1.10 0.0.0.255 ».
  const p = plage({ genre: 'reseau', ip: '192.168.1.10', cidr: 24 });
  assert.deepEqual(p, [plage({ genre: 'host', ip: '192.168.1.0' })![0],
    plage({ genre: 'host', ip: '192.168.1.255' })![0]]);
});

test('une adresse illisible ne rend pas de plage', () => {
  assert.equal(plage({ genre: 'host', ip: '999.1.1.1' }), null);
  assert.equal(plage({ genre: 'host', ip: 'la machine de Paul' }), null);
});

test('any couvre tout l\'espace d\'adressage', () => {
  assert.deepEqual(plage({ genre: 'any' }), [0, 0xFFFFFFFF]);
});

// ===== Les ports =====

test('les conditions de port s\'ecrivent selon leur operateur', () => {
  assert.equal(ecrirePort({ operateur: 'eq', valeur: 443 }), 'eq 443');
  assert.equal(ecrirePort({ operateur: 'gt', valeur: 1023 }), 'gt 1023');
  assert.equal(ecrirePort({ operateur: 'range', valeur: 1024, fin: 65535 }), 'range 1024 65535');
  assert.equal(ecrirePort({ operateur: '' }), '');
  assert.equal(ecrirePort(undefined), '');
});

// ===== L'ecriture d'une ACE =====

/*
 * Cette ligne est celle de la diapositive : permit tcp 192.168.1.0 0.0.0.255
 * gt 1023 host 172.16.10.20 eq 443. Elle sert de reference — si l'ordre des
 * morceaux change, le test tombe.
 */
test('une ACE etendue reprend l\'ordre source, port, destination, port', () => {
  const a = ace({
    protocole: 'tcp',
    source: { genre: 'reseau', ip: '192.168.1.0', cidr: 24 },
    portSource: { operateur: 'gt', valeur: 1023 },
    destination: { genre: 'host', ip: '172.16.10.20' },
    portDestination: { operateur: 'eq', valeur: 443 },
  });
  assert.equal(ecrireAce(a, 'etendue'),
    'permit tcp 192.168.1.0 0.0.0.255 gt 1023 host 172.16.10.20 eq 443');
});

/*
 * Une ACL standard ne dit que la source : la syntaxe n'accepte ni protocole ni
 * destination. On les laisse tomber a l'ecriture plutot que de produire une
 * ligne que le routeur refusera — l'avertissement, lui, est rendu par verifier.
 */
test('une ACL standard ne garde que la source', () => {
  const a = ace({
    protocole: 'tcp',
    source: { genre: 'reseau', ip: '192.168.10.72', cidr: 29 },
    destination: { genre: 'host', ip: '10.0.0.1' },
    portDestination: { operateur: 'eq', valeur: 80 },
  });
  assert.equal(ecrireAce(a, 'standard'), 'permit 192.168.10.72 0.0.0.7');
});

test('un port pose sur ICMP n\'est pas ecrit', () => {
  const a = ace({ protocole: 'icmp', portDestination: { operateur: 'eq', valeur: 80 } });
  assert.equal(ecrireAce(a, 'etendue'), 'permit icmp any any');
});

test('le message ICMP suit les deux cibles', () => {
  const a = ace({ protocole: 'icmp', messageIcmp: 'echo-reply' });
  assert.equal(ecrireAce(a, 'etendue'), 'permit icmp any any echo-reply');
});

// ===== L'ecriture d'une ACL =====

test('une ACL numerotee prefixe chaque ligne, une ACL nommee ouvre un bloc', () => {
  const regles = [ace({ protocole: 'tcp', portDestination: { operateur: 'eq', valeur: 80 } })];
  const num = ecrireAcl(acl({ nom: '110', aces: regles }));
  assert.ok(num.includes('access-list 110 permit tcp any any eq 80'));
  assert.ok(num.includes('ip access-group 110 in'));

  const nom = ecrireAcl(acl({ nom: 'WEB-SEULEMENT', aces: regles }));
  assert.ok(nom.includes('ip access-list extended WEB-SEULEMENT'));
  assert.ok(nom.includes(' permit tcp any any eq 80'));
  assert.ok(nom.includes(' exit'));
});

test('la remarque precede la regle qu\'elle explique', () => {
  const t = ecrireAcl(acl({ aces: [ace({ remarque: 'le web du siege' })] }));
  const l = t.split('\n');
  assert.ok(l[0].includes('remark le web du siege'));
  assert.ok(l[1].includes('permit ip any any'));
});

test('le permit final s\'ecrit selon le type d\'ACL', () => {
  assert.ok(ecrireAcl(acl({ permitFinal: true })).includes('access-list 110 permit ip any any'));
  assert.ok(ecrireAcl(acl({ nom: '10', type: 'standard', permitFinal: true }))
    .includes('access-list 10 permit any'));
});

test('chaque application produit son bloc interface', () => {
  const t = ecrireAcl(acl({
    aces: [ace({})],
    applications: [
      { interface: 'GigabitEthernet0/0', sens: 'in' },
      { interface: 'GigabitEthernet0/1', sens: 'out' },
    ],
  }));
  assert.ok(t.includes('interface GigabitEthernet0/0\n ip access-group 110 in'));
  assert.ok(t.includes('interface GigabitEthernet0/1\n ip access-group 110 out'));
});

// ===== Les numeros =====

test('chaque type a ses plages de numeros', () => {
  assert.equal(numeroValide('10', 'standard'), true);
  assert.equal(numeroValide('1500', 'standard'), true);
  assert.equal(numeroValide('110', 'standard'), false);
  assert.equal(numeroValide('110', 'etendue'), true);
  assert.equal(numeroValide('2600', 'etendue'), true);
  assert.equal(numeroValide('10', 'etendue'), false);
});

test('une ACL nommee n\'a pas de plage a respecter', () => {
  assert.equal(numeroValide('WEB-SEULEMENT', 'standard'), true);
  assert.equal(numeroValide('WEB-SEULEMENT', 'etendue'), true);
});

test('numeroLibre rend le premier numero disponible du type', () => {
  assert.equal(numeroLibre('etendue', []), '100');
  assert.equal(numeroLibre('etendue', ['100', '101']), '102');
  assert.equal(numeroLibre('standard', ['1']), '2');
  assert.equal(numeroLibre('standard', ['WEB']), '1');
});

// ===== L'ombrage =====

/*
 * La panne la plus frequente, et la plus silencieuse : la configuration est
 * acceptee, le compteur de la regle masquee reste a zero, et personne ne
 * comprend pourquoi le filtrage « ne marche pas ».
 */
test('une regle large au-dessus rend muette celle du dessous', () => {
  const l = acl({ aces: [
    ace({ id: 'large', protocole: 'ip' }),
    ace({ id: 'precise', protocole: 'tcp', destination: { genre: 'host', ip: '10.0.0.1' }, portDestination: { operateur: 'eq', valeur: 80 } }),
  ] });
  assert.deepEqual(ombres(l), [1]);
});

test('l\'ordre inverse ne masque rien', () => {
  const l = acl({ aces: [
    ace({ id: 'precise', protocole: 'tcp', destination: { genre: 'host', ip: '10.0.0.1' }, portDestination: { operateur: 'eq', valeur: 80 } }),
    ace({ id: 'large', protocole: 'ip' }),
  ] });
  assert.deepEqual(ombres(l), []);
});

test('un reseau couvre les hotes qu\'il contient', () => {
  const l = acl({ aces: [
    ace({ id: 'reseau', source: { genre: 'reseau', ip: '192.168.1.0', cidr: 24 } }),
    ace({ id: 'hote', source: { genre: 'host', ip: '192.168.1.50' } }),
  ] });
  assert.deepEqual(ombres(l), [1]);
});

test('deux reseaux disjoints ne se masquent pas', () => {
  const l = acl({ aces: [
    ace({ id: 'a', source: { genre: 'reseau', ip: '192.168.1.0', cidr: 24 } }),
    ace({ id: 'b', source: { genre: 'reseau', ip: '192.168.2.0', cidr: 24 } }),
  ] });
  assert.deepEqual(ombres(l), []);
});

/*
 * En standard, seule la source compte : deux regles de meme source se masquent
 * meme si tout le reste differe, parce que tout le reste n'est pas lu.
 */
test('en standard, la source suffit a masquer', () => {
  const l = acl({ type: 'standard', nom: '10', aces: [
    ace({ id: 'a', source: { genre: 'any' } }),
    ace({ id: 'b', source: { genre: 'host', ip: '10.0.0.1' } }),
  ] });
  assert.deepEqual(ombres(l), [1]);
});

// ===== Les controles =====

test('un numero hors plage est une erreur', () => {
  const av = verifier(acl({ nom: '10', type: 'etendue', aces: [ace({})] }));
  assert.ok(av.some(x => x.gravite === 'erreur' && x.texte.includes('100–199')));
});

test('une ACL standard qui filtre une destination est signalee', () => {
  const av = verifier(acl({ nom: '10', type: 'standard', aces: [
    ace({ protocole: 'tcp', destination: { genre: 'host', ip: '10.0.0.1' } }),
  ] }));
  assert.ok(av.some(x => x.gravite === 'erreur' && x.texte.includes('que la source')));
});

test('un port sur ICMP est une erreur', () => {
  const av = verifier(acl({ aces: [ace({ protocole: 'icmp', portDestination: { operateur: 'eq', valeur: 80 } })] }));
  assert.ok(av.some(x => x.texte.includes('n’existent qu’en TCP et UDP')));
});

test('une ACL sans permit est annoncee comme bloquant tout', () => {
  const av = verifier(acl({ aces: [ace({ autorisation: 'deny' })] }));
  assert.ok(av.some(x => x.texte.includes('bloque tout')));
});

test('le permit final leve l\'avertissement de blocage', () => {
  const av = verifier(acl({ aces: [ace({ autorisation: 'deny' })], permitFinal: true }));
  assert.ok(!av.some(x => x.texte.includes('bloque tout')));
});

test('une ACL non appliquee est signalee', () => {
  const av = verifier(acl({ aces: [ace({})], applications: [] }));
  assert.ok(av.some(x => x.texte.includes('aucune interface')));
});

/*
 * Une ACL par interface, par sens, par protocole : c'est la restriction du
 * cours, et le routeur remplacera silencieusement la premiere par la seconde.
 */
test('deux ACL sur la meme interface dans le meme sens sont refusees', () => {
  const av = verifier(acl({ aces: [ace({})], applications: [
    { interface: 'Gig0/0', sens: 'in' }, { interface: 'Gig0/0', sens: 'in' },
  ] }));
  assert.ok(av.some(x => x.gravite === 'erreur' && x.texte.includes('Une seule ACL par interface')));
});

test('une adresse illisible est signalee', () => {
  const av = verifier(acl({ aces: [ace({ source: { genre: 'host', ip: '300.1.1.1' } })] }));
  assert.ok(av.some(x => x.texte.includes('illisible')));
});

test('une ACL vide n\'est pas une erreur, seulement un rappel', () => {
  const av = verifier(acl({ aces: [] }));
  assert.ok(av.some(x => x.gravite === 'attention' && x.texte.includes('Aucune règle')));
  assert.ok(!av.some(x => x.gravite === 'erreur'));
});

// ===== Les donnees =====

test('chaque service a un port unique dans son protocole', () => {
  const vus = new Set(SERVICES.map(s => `${s.proto}:${s.port}`));
  assert.equal(vus.size, SERVICES.length);
});

test('les services de l\'exercice sont tous la', () => {
  for (const p of [20, 21, 22, 23, 25, 53, 67, 68, 80, 110, 143, 161, 162, 389, 443, 993, 995]) {
    assert.ok(SERVICES.some(s => s.port === p), `port ${p} absent`);
  }
});

test('les deux moities d\'un ping sont proposees', () => {
  assert.ok(MESSAGES_ICMP.some(m => m.cle === 'echo'));
  assert.ok(MESSAGES_ICMP.some(m => m.cle === 'echo-reply'));
});

test('le placement differe selon le type, et dit pourquoi', () => {
  assert.ok(placement('standard').includes('DESTINATION'));
  assert.ok(placement('etendue').includes('SOURCE'));
  assert.notEqual(placement('standard'), placement('etendue'));
});

// ===== L'import en masse =====

const CLASSEUR = [
  'ACE\tAutorisation\tProtocole de transport\tSource\tPort\tDestination\tPort\tCommentaire',
  '10\tPermit\tTCP\tIdsr:192.168.1.0 Wldc:0.0.0.255\tgt 1023\thost 172.16.10.20\teq 443\tle site du siege',
  '20\tDeny\tUDP\thost 192.168.1.254\t\tany\teq 53\tpas de DNS sortant',
  '30\tPermit\tICMP\t192.168.1.0 0.0.0.255\t\tany\techo\tping sortant',
].join('\n');

/*
 * Le classeur d'exercice est la forme qui arrive vraiment : huit colonnes, un
 * numero d'ACE en tete, la notation « Idsr: / Wldc: » et des ports annotes.
 * S'il ne passe pas, la fonctionnalite ne sert a rien.
 */
test('le classeur d\'exercice se lit tel quel', () => {
  const r = analyserColler(CLASSEUR);
  assert.equal(r.separateur, '\t');
  assert.equal(r.entete, true);
  assert.equal(r.lignes.length, 3);
  assert.ok(r.lignes.every(l => l.ace && !l.erreur), JSON.stringify(r.lignes.map(l => l.erreur)));

  assert.equal(ecrireAce(r.lignes[0].ace!, 'etendue'),
    'permit tcp 192.168.1.0 0.0.0.255 gt 1023 host 172.16.10.20 eq 443');
  assert.equal(r.lignes[0].ace!.remarque, 'le site du siege');
  assert.equal(ecrireAce(r.lignes[1].ace!, 'etendue'), 'deny udp host 192.168.1.254 any eq 53');
  assert.equal(ecrireAce(r.lignes[2].ace!, 'etendue'), 'permit icmp 192.168.1.0 0.0.0.255 any echo');
});

test('le point-virgule et la virgule sont reconnus comme separateurs', () => {
  const pv = analyserColler('Autorisation;Protocole;Source;Destination\npermit;tcp;any;host 10.0.0.1');
  assert.equal(pv.separateur, ';');
  assert.equal(pv.lignes[0].ace?.protocole, 'tcp');

  const vg = analyserColler('Autorisation,Protocole,Source,Destination\ndeny,udp,any,host 10.0.0.1');
  assert.equal(vg.separateur, ',');
  assert.equal(vg.lignes[0].ace?.autorisation, 'deny');
});

/*
 * Une adresse ecrite avec des virgules — « 192,168,2,200 », faute presente dans
 * le classeur d'origine — ne doit pas etre prise pour quatre colonnes.
 */
test('une adresse a virgules ne fait pas basculer sur le separateur virgule', () => {
  const r = analyserColler('permit\ttcp\thost 192,168,2,200\t\tany\teq 80');
  assert.equal(r.separateur, '\t');
  assert.equal(r.lignes[0].ace?.source.genre, 'host');
  assert.equal((r.lignes[0].ace?.source as { ip: string }).ip, '192.168.2.200');
});

test('sans en-tete, la disposition se deduit du nombre de colonnes', () => {
  const six = analyserColler('permit\ttcp\t192.168.1.0/24\tgt 1023\thost 10.0.0.1\teq 80');
  assert.equal(six.entete, false);
  assert.equal(ecrireAce(six.lignes[0].ace!, 'etendue'),
    'permit tcp 192.168.1.0 0.0.0.255 gt 1023 host 10.0.0.1 eq 80');

  const trois = analyserColler('deny\t10.0.0.5\tany');
  assert.equal(trois.lignes[0].ace?.protocole, 'ip');
  assert.equal(ecrireAce(trois.lignes[0].ace!, 'etendue'), 'deny ip host 10.0.0.5 any');
});

test('les colonnes sont retrouvees par leur intitule, dans n\'importe quel ordre', () => {
  const r = analyserColler([
    'Commentaire\tDestination\tSource\tAction\tProtocole',
    'le web\thost 10.0.0.1\tany\tpermit\ttcp',
  ].join('\n'));
  assert.equal(r.lignes[0].ace?.remarque, 'le web');
  assert.equal(ecrireAce(r.lignes[0].ace!, 'etendue'), 'permit tcp any host 10.0.0.1');
});

/*
 * Deux colonnes nommees « Port » : la premiere est celle de la source. C'est la
 * convention du classeur, et l'ordre d'une ACE.
 */
test('deux colonnes « Port » se distinguent par leur position', () => {
  const r = analyserColler([
    'Autorisation\tProtocole\tSource\tPort\tDestination\tPort',
    'permit\ttcp\tany\tgt 1023\tany\teq 22',
  ].join('\n'));
  assert.equal(ecrireAce(r.lignes[0].ace!, 'etendue'), 'permit tcp any gt 1023 any eq 22');
});

// ===== Les champs =====

test('lireCible accepte les six ecritures d\'adresse', () => {
  assert.deepEqual(lireCible('any'), { genre: 'any' });
  assert.deepEqual(lireCible(''), { genre: 'any' });
  assert.deepEqual(lireCible('host 10.0.0.1'), { genre: 'host', ip: '10.0.0.1' });
  assert.deepEqual(lireCible('10.0.0.1'), { genre: 'host', ip: '10.0.0.1' });
  assert.deepEqual(lireCible('192.168.1.0 0.0.0.255'), { genre: 'reseau', ip: '192.168.1.0', cidr: 24 });
  assert.deepEqual(lireCible('192.168.1.0/24'), { genre: 'reseau', ip: '192.168.1.0', cidr: 24 });
  assert.deepEqual(lireCible('Idsr:192.168.1.0 Wldc:0.0.0.255'), { genre: 'reseau', ip: '192.168.1.0', cidr: 24 });
});

test('un wildcard nul ou un /32 donnent un hote, pas un reseau', () => {
  assert.deepEqual(lireCible('10.0.0.1 0.0.0.0'), { genre: 'host', ip: '10.0.0.1' });
  assert.deepEqual(lireCible('10.0.0.1/32'), { genre: 'host', ip: '10.0.0.1' });
});

test('une adresse fautive est refusee, pas devinee', () => {
  assert.equal(lireCible('300.1.1.1'), null);
  assert.equal(lireCible('le serveur de Paul'), null);
});

/*
 * Un wildcard discontinu existe sur IOS mais ne se rencontre pas en formation :
 * l'accepter reviendrait a valider une frappe fautive.
 */
test('cidrDeWildcard n\'accepte que les masques contigus', () => {
  assert.equal(cidrDeWildcard('0.0.0.255'), 24);
  assert.equal(cidrDeWildcard('0.0.0.7'), 29);
  assert.equal(cidrDeWildcard('0.0.0.0'), 32);
  assert.equal(cidrDeWildcard('255.255.255.255'), 0);
  assert.equal(cidrDeWildcard('0.0.255.0'), null);
  assert.equal(cidrDeWildcard('0.0.0.5'), null);
});

test('lirePort accepte les ecritures courantes', () => {
  assert.deepEqual(lirePort('eq 443'), { operateur: 'eq', valeur: 443 });
  assert.deepEqual(lirePort('443'), { operateur: 'eq', valeur: 443 });
  assert.deepEqual(lirePort('eq www'), { operateur: 'eq', valeur: 80 });
  assert.deepEqual(lirePort('>1023'), { operateur: 'gt', valeur: 1023 });
  assert.deepEqual(lirePort('gt 1023'), { operateur: 'gt', valeur: 1023 });
  assert.deepEqual(lirePort('range 1024 65535'), { operateur: 'range', valeur: 1024, fin: 65535 });
  assert.deepEqual(lirePort(''), { operateur: '' });
  assert.deepEqual(lirePort('any'), { operateur: '' });
});

/** Le classeur annote ses ports : « eq 67 =Bootps ». On lit le port, pas l'annotation. */
test('un port annote se lit quand meme', () => {
  assert.deepEqual(lirePort('eq 67 =Bootps'), { operateur: 'eq', valeur: 67 });
});

test('un port hors bornes ou illisible est refuse', () => {
  assert.equal(lirePort('eq 99999'), null);
  assert.equal(lirePort('eq bidule'), null);
});

// ===== Les lignes de configuration =====

/*
 * Le second usage : coller un corrige, un extrait de cours ou la sortie de
 * `show access-lists` pour le reprendre en tableau.
 */
test('une ligne de configuration Cisco se relit', () => {
  const r = lireLigneCli('access-list 110 permit tcp 192.168.10.0 0.0.0.31 host 192.168.10.51 eq 80');
  assert.equal(ecrireAce(r.ace!, 'etendue'),
    'permit tcp 192.168.10.0 0.0.0.31 host 192.168.10.51 eq 80');
});

test('le numero de sequence de la forme nommee est ignore', () => {
  const r = lireLigneCli(' 20 deny ip any host 10.0.0.1');
  assert.equal(ecrireAce(r.ace!, 'etendue'), 'deny ip any host 10.0.0.1');
});

test('les remarques et les commentaires ne produisent pas de regle', () => {
  assert.deepEqual(lireLigneCli('access-list 110 remark le web du siege'), {});
  assert.deepEqual(lireLigneCli('! rien ici'), {});
});

test('une ACL standard collee en configuration se lit aussi', () => {
  const r = lireLigneCli('access-list 10 permit 192.168.10.72 0.0.0.7');
  assert.equal(r.ace?.source.genre, 'reseau');
  assert.equal(ecrireAce(r.ace!, 'standard'), 'permit 192.168.10.72 0.0.0.7');
});

test('un bloc de configuration passe par analyserColler', () => {
  const r = analyserColler([
    'access-list 110 remark le serveur web',
    'access-list 110 permit tcp 192.168.10.0 0.0.0.31 host 192.168.10.51 eq 80',
    'access-list 110 deny ip any host 192.168.10.51',
    '!',
  ].join('\n'));
  assert.equal(r.separateur, 'cli');
  assert.equal(r.lignes.length, 2);           // la remarque et le « ! » ne comptent pas
  assert.ok(r.lignes.every(l => l.ace));
});

test('le message ICMP est repris depuis la configuration', () => {
  const r = lireLigneCli('permit icmp 192.168.1.0 0.0.0.255 any echo-reply');
  assert.equal(r.ace?.messageIcmp, 'echo-reply');
  assert.equal(ecrireAce(r.ace!, 'etendue'), 'permit icmp 192.168.1.0 0.0.0.255 any echo-reply');
});

// ===== Les refus =====

/*
 * Un import qui avale vingt lignes et en abime trois sans le dire est pire
 * qu'un refus. Chaque ligne rend donc soit une ACE, soit une erreur qui dit ce
 * qui n'a pas ete compris.
 */
test('une ligne fautive porte son erreur, les autres passent', () => {
  const r = analyserColler([
    'Autorisation\tProtocole\tSource\tDestination',
    'permit\ttcp\tany\thost 10.0.0.1',
    'peutetre\ttcp\tany\tany',
    'deny\tbidule\tany\tany',
    'permit\ttcp\t999.1.1.1\tany',
  ].join('\n'));
  assert.equal(r.lignes.length, 4);
  assert.ok(r.lignes[0].ace);
  assert.match(r.lignes[1].erreur ?? '', /autorisation/);
  assert.match(r.lignes[2].erreur ?? '', /protocole/);
  assert.match(r.lignes[3].erreur ?? '', /source/);
});

test('l\'erreur cite le numero de la ligne d\'origine', () => {
  const r = analyserColler([
    'Autorisation\tProtocole\tSource\tDestination',
    'permit\ttcp\tany\tany',
    'nawak\ttcp\tany\tany',
  ].join('\n'));
  assert.equal(r.lignes[1].numero, 3);        // en-tete = 1, premiere regle = 2
});

test('un texte vide ne rend rien et ne plante pas', () => {
  const r = analyserColler('   \n\n  ');
  assert.deepEqual(r.lignes, []);
});

test('le modele a coller se relit lui-meme', () => {
  const r = analyserColler(MODELE_COLLER);
  assert.equal(r.entete, true);
  assert.equal(r.lignes.length, 4);
  assert.ok(r.lignes.every(l => l.ace && !l.erreur),
    JSON.stringify(r.lignes.filter(l => l.erreur).map(l => l.erreur)));
});

// ===== La politique de flux =====

const ZONE = (p: Partial<ZoneSource>): ZoneSource => ({
  id: p.id ?? 'z1', nom: p.nom ?? 'Production',
  cible: p.cible ?? { genre: 'reseau', ip: '192.168.10.0', cidr: 26 },
  routeurId: p.routeurId ?? 'rA', routeurNom: p.routeurNom ?? 'R1',
  interfaceNom: p.interfaceNom ?? 'GigabitEthernet0/0', dhcp: p.dhcp,
});

const SERVEURS: ZoneCible[] = [
  { id: 'srv', nom: 'Serveurs', cible: { genre: 'reseau', ip: '192.168.20.0', cidr: 27 } },
  { id: 'web', nom: 'Serveur web', cible: { genre: 'host', ip: '192.168.20.5' } },
];

const flux = (p: Partial<Flux>): Flux => ({
  id: p.id ?? 'f1', sourceId: p.sourceId ?? 'z1', destinationId: p.destinationId ?? 'web',
  services: p.services ?? ['tcp:443'], decision: p.decision ?? 'permit', commentaire: p.commentaire,
});

const SANS_INFRA: OptionsPolitique = { ...OPTIONS_PAR_DEFAUT, dhcp: false, dns: '', ping: false };

test('un flux devient une ACE, posee en entree sur l\'interface de la source', () => {
  const { acls } = genererAcls([ZONE({})], SERVEURS, [flux({})], SANS_INFRA);
  assert.equal(acls.length, 1);
  assert.equal(acls[0].type, 'etendue');
  assert.deepEqual(acls[0].applications, [{ interface: 'GigabitEthernet0/0', sens: 'in' }]);
  assert.equal(acls[0].routeurId, 'rA');
  assert.equal(ecrireAce(acls[0].aces[0], 'etendue'),
    'permit tcp 192.168.10.0 0.0.0.63 host 192.168.20.5 eq 443');
});

/*
 * Le placement n'est pas un detail d'implementation : c'est la question posee a
 * l'oral. L'ACL doit dire pourquoi elle est la.
 */
test('chaque ACL generee explique sa place', () => {
  const { acls } = genererAcls([ZONE({})], SERVEURS, [flux({})], SANS_INFRA);
  assert.match(acls[0].pourquoi, /au plus pr(è|e)s de la source/i);
  assert.match(acls[0].pourquoi, /GigabitEthernet0\/0/);
  assert.equal(acls[0].genere, true);
});

test('un service par ACE, dans l\'ordre coche', () => {
  const { acls } = genererAcls([ZONE({})], SERVEURS,
    [flux({ services: ['tcp:80', 'tcp:443'] })], SANS_INFRA);
  assert.equal(acls[0].aces.length, 2);
  assert.ok(ecrireAce(acls[0].aces[0], 'etendue').endsWith('eq 80'));
  assert.ok(ecrireAce(acls[0].aces[1], 'etendue').endsWith('eq 443'));
});

/*
 * Un refus est presque toujours une exception decoupee dans une autorisation
 * plus large. Place apres, il ne serait jamais lu.
 */
test('les refus passent avant les autorisations', () => {
  const { acls } = genererAcls([ZONE({})], SERVEURS, [
    flux({ id: 'a', destinationId: 'srv', services: ['ip:'], decision: 'permit' }),
    flux({ id: 'b', destinationId: 'web', services: ['ip:'], decision: 'deny' }),
  ], SANS_INFRA);
  assert.equal(acls[0].aces[0].autorisation, 'deny');
  assert.equal(acls[0].aces[1].autorisation, 'permit');
  assert.deepEqual(ombres({ ...acls[0], aces: acls[0].aces }), []);
});

test('la liste blanche laisse agir le deny implicite, la liste noire le neutralise', () => {
  const blanche = genererAcls([ZONE({})], SERVEURS, [flux({})], SANS_INFRA);
  assert.equal(blanche.acls[0].permitFinal, false);
  const noire = genererAcls([ZONE({})], SERVEURS, [flux({})], { ...SANS_INFRA, mode: 'liste-noire' });
  assert.equal(noire.acls[0].permitFinal, true);
});

// ===== Les services d'infrastructure =====

/*
 * Une liste blanche posee en entree d'un LAN coupe le DHCP et le DNS avant
 * toute autre chose : les postes ne s'adressent plus, plus rien ne resout, et
 * le TP s'arrete sur un symptome qui n'a rien a voir avec la politique ecrite.
 */
test('le DHCP est laisse passer sur les zones qui en dependent', () => {
  const { acls } = genererAcls([ZONE({ dhcp: true })], SERVEURS, [flux({})],
    { ...OPTIONS_PAR_DEFAUT, dns: '', ping: false });
  const lignes = acls[0].aces.map(a => ecrireAce(a, 'etendue'));
  assert.ok(lignes.some(l => l.includes('udp') && l.includes('eq 67')), lignes.join(' | '));
});

test('une zone sans DHCP n\'en recoit pas la regle', () => {
  const { acls } = genererAcls([ZONE({ dhcp: false })], SERVEURS, [flux({})],
    { ...OPTIONS_PAR_DEFAUT, dns: '', ping: false });
  assert.ok(!acls[0].aces.some(a => ecrireAce(a, 'etendue').includes('eq 67')));
});

test('le DNS declare ouvre les deux transports vers le serveur', () => {
  const { acls } = genererAcls([ZONE({})], SERVEURS, [flux({})],
    { ...OPTIONS_PAR_DEFAUT, dhcp: false, ping: false, dns: '192.168.20.10' });
  const lignes = acls[0].aces.map(a => ecrireAce(a, 'etendue'));
  assert.ok(lignes.some(l => l === 'permit udp 192.168.10.0 0.0.0.63 host 192.168.20.10 eq 53'));
  assert.ok(lignes.some(l => l === 'permit tcp 192.168.10.0 0.0.0.63 host 192.168.20.10 eq 53'));
});

test('le ping de recette s\'ajoute en une regle sortante', () => {
  const { acls } = genererAcls([ZONE({})], SERVEURS, [flux({})],
    { ...OPTIONS_PAR_DEFAUT, dhcp: false, dns: '', ping: true });
  assert.ok(acls[0].aces.some(a => ecrireAce(a, 'etendue') === 'permit icmp 192.168.10.0 0.0.0.63 any echo'));
});

/*
 * En liste noire, tout passe deja : ajouter des regles d'infrastructure serait
 * du bruit dans une configuration qu'on doit pouvoir relire.
 */
test('la liste noire n\'ajoute aucune regle d\'infrastructure', () => {
  const { acls } = genererAcls([ZONE({ dhcp: true })], SERVEURS, [flux({})],
    { ...OPTIONS_PAR_DEFAUT, mode: 'liste-noire', dns: '10.0.0.1', ping: true });
  assert.equal(acls[0].aces.length, 1);
});

// ===== Ce que le generateur refuse de faire =====

/*
 * Poser une ACL vide sur une zone sans flux la couperait entierement. On
 * prefere ne rien generer et le dire.
 */
test('une zone sans flux ne recoit pas d\'ACL, mais un avertissement', () => {
  const { acls, avertissements } = genererAcls(
    [ZONE({ id: 'z1' }), ZONE({ id: 'z2', nom: 'Invites' })], SERVEURS,
    [flux({ sourceId: 'z1' })], SANS_INFRA,
  );
  assert.equal(acls.length, 1);
  assert.ok(avertissements.some(a => a.texte.includes('Invites') && a.texte.includes('aucun flux')));
});

test('un flux sans service coche est ignore et signale', () => {
  const { acls, avertissements } = genererAcls([ZONE({})], SERVEURS,
    [flux({ services: [] })], SANS_INFRA);
  assert.equal(acls.length, 1);
  assert.equal(acls[0].aces.length, 0);
  assert.ok(avertissements.some(a => a.texte.includes('aucun service')));
});

test('une destination inconnue est une erreur, pas un silence', () => {
  const { avertissements } = genererAcls([ZONE({})], SERVEURS,
    [flux({ destinationId: 'fantome' })], SANS_INFRA);
  assert.ok(avertissements.some(a => a.gravite === 'erreur' && a.texte.includes('destination inconnue')));
});

test('l\'absence de serveur DNS est signalee en liste blanche', () => {
  const { avertissements } = genererAcls([ZONE({})], SERVEURS, [flux({})], SANS_INFRA);
  assert.ok(avertissements.some(a => a.texte.includes('DNS')));
});

// ===== Numerotation et nommage =====

test('les ACL generees prennent des numeros libres', () => {
  const { acls } = genererAcls(
    [ZONE({ id: 'z1' }), ZONE({ id: 'z2', nom: 'Bureaux', interfaceNom: 'GigabitEthernet0/1' })],
    SERVEURS,
    [flux({ sourceId: 'z1' }), flux({ id: 'f2', sourceId: 'z2' })],
    SANS_INFRA, ['100'],
  );
  assert.deepEqual(acls.map(a => a.nom), ['101', '102']);
});

test('l\'option « nommer » produit un nom lisible et sans accent', () => {
  const { acls } = genererAcls([ZONE({ nom: 'Bureau d’études' })], SERVEURS, [flux({})],
    { ...SANS_INFRA, nommer: true });
  assert.equal(acls[0].nom, 'FILTRE-BUREAU-D-ETUDES');
  assert.ok(ecrireAcl(acls[0]).includes('ip access-list extended FILTRE-BUREAU-D-ETUDES'));
});

// ===== Le resultat tient debout =====

/*
 * Le generateur ne doit pas produire ce que le verificateur reproche : ce test
 * ferme la boucle entre les deux moities du module.
 */
test('une politique complete ne produit aucune erreur de verification', () => {
  const { acls } = genererAcls(
    [ZONE({ dhcp: true })], SERVEURS,
    [
      flux({ id: 'a', destinationId: 'web', services: ['tcp:80', 'tcp:443'] }),
      flux({ id: 'b', destinationId: 'srv', services: ['tcp:445'], decision: 'deny' }),
    ],
    { ...OPTIONS_PAR_DEFAUT, dns: '192.168.20.10' },
  );
  const avis = verifier(acls[0]);
  assert.deepEqual(avis.filter(a => a.gravite === 'erreur'), []);
});

test('la configuration generee se relit par l\'analyseur', () => {
  const { acls } = genererAcls([ZONE({})], SERVEURS,
    [flux({ services: ['tcp:80', 'tcp:443'] })], SANS_INFRA);
  const relu = analyserColler(ecrireAcl(acls[0]).split('\n').filter(l => l.startsWith('access-list')).join('\n'));
  assert.equal(relu.lignes.length, 2);
  assert.ok(relu.lignes.every(l => l.ace));
  assert.equal(ecrireAce(relu.lignes[0].ace!, 'etendue'), ecrireAce(acls[0].aces[0], 'etendue'));
});

test('chaque service proposable porte une clef unique', () => {
  const cles = SERVICES_FLUX.map(s => s.cle);
  assert.equal(new Set(cles).size, cles.length);
});

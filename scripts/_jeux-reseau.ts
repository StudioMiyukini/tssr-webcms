/* Les jeux « image + 4 choix » du domaine Réseau : schémas, VLAN, OPNsense, DMZ, Wireshark.
   Chaque diapositive dessine son image avec les générateurs de _jeu-image.ts. */
import { svgTopo, svgTable, svgPackets, type Game, type Node, type Link } from './_jeu-image';

const O = (t: string, ok = false) => ({ t, ok });

// ── Schéma type : Internet — pare-feu — LAN / DMZ ────────────────────────
const baseNodes = (extra: Node[] = []): Node[] => [
  { id: 'inet', x: 70, y: 150, label: 'Internet', kind: 'cloud' },
  { id: 'fw', x: 250, y: 150, label: 'Pare-feu', sub: 'WAN · LAN · DMZ', kind: 'fw' },
  { id: 'lan', x: 480, y: 80, label: 'LAN', sub: '192.168.10.0/24', kind: 'zone', w: 200, h: 90, color: '#059669' },
  { id: 'pc', x: 440, y: 95, label: 'Poste', sub: '.50', kind: 'pc', w: 70, h: 36 },
  { id: 'ad', x: 525, y: 95, label: 'AD / BDD', sub: '.1 · .50', kind: 'server', w: 80, h: 36 },
  { id: 'dmz', x: 480, y: 225, label: 'DMZ', sub: '192.168.20.0/24', kind: 'zone', w: 200, h: 90 },
  { id: 'web', x: 440, y: 240, label: 'Web', sub: '.10', kind: 'server', w: 70, h: 36 },
  { id: 'proxy', x: 525, y: 240, label: 'Proxy', sub: '.20', kind: 'server', w: 80, h: 36 },
  ...extra,
];
const baseLinks = (extra: Link[] = []): Link[] => [
  { a: 'inet', b: 'fw', label: 'WAN' }, { a: 'fw', b: 'lan', label: 'LAN', color: '#16a34a' }, { a: 'fw', b: 'dmz', label: 'DMZ', color: '#d97706' }, ...extra,
];

export const JEU_SCHEMA: Game = {
  slug: 'jeu-lire-schema-reseau', icon: '🗺️', title: 'Lis le schéma réseau', eyebrow: 'Jeu · Réseau',
  intro: 'Un schéma, une question : où est la zone, quel équipement, quel flux ? 10 situations tirées des cours Réseau, OPNsense et DMZ.',
  desc: '10 schémas : zones, équipements et flux à reconnaître (pare-feu, DMZ, VLAN, routeur).',
  courses: [['/pages/dmz', 'La DMZ'], ['/pages/le-pare-feu', 'Le pare-feu'], ['/pages/les-vlan', 'Les VLAN'], ['/pages/schemas-infrastructure', 'Les schémas d’infrastructure']],
  slides: [
    { svg: svgTopo('Un serveur web public arrive : où le placer ?', baseNodes([{ id: 'new', x: 250, y: 260, label: 'Serveur web public', sub: '?', kind: 'server', dashed: true }]), baseLinks()),
      q: 'Dans quelle zone place-t-on le serveur web exposé à Internet ?',
      opts: [O('Dans le LAN, à côté de l’AD'), O('Dans la DMZ', true), O('Directement sur le WAN'), O('Sur le pare-feu lui-même')],
      ok: 'Ce qu’on expose va dans le sas : s’il est compromis, il ne mène pas au LAN.', no: 'Un serveur exposé posé dans le LAN est une porte ouverte sur l’annuaire et les données.', href: '/pages/dmz', course: 'La DMZ' },
    { svg: svgTopo('Deux flux, un seul est légitime', baseNodes(), baseLinks([{ a: 'web', b: 'ad', label: '① web → AD', color: '#dc2626', arrow: true, dashed: true, t: 0.72 }, { a: 'pc', b: 'web', label: '② poste → web :443', color: '#16a34a', arrow: true, t: 0.28 }])),
      q: 'Quel flux doit être bloqué par défaut ?',
      opts: [O('② : le poste vers le serveur web'), O('① : la DMZ vers le LAN', true), O('Les deux'), O('Aucun, tout est interne')],
      ok: 'DMZ → LAN bloqué : c’est la règle qui fait la DMZ. Le LAN consulte la DMZ, pas l’inverse.', no: 'Le flux ① part de la DMZ vers le LAN : jamais à l’initiative de la DMZ, sauf exception nominative.', href: '/pages/dmz', course: 'La DMZ' },
    { svg: svgTopo('Quel équipement fait quoi ?', [
        { id: 'inet', x: 60, y: 120, label: 'Internet', kind: 'cloud' }, { id: 'A', x: 200, y: 120, label: 'A', sub: 'WAN / LAN', kind: 'router' },
        { id: 'B', x: 360, y: 120, label: 'B', sub: '24 ports', kind: 'switch' }, { id: 'p1', x: 500, y: 60, label: 'PC 1', kind: 'pc', w: 70, h: 34 }, { id: 'p2', x: 500, y: 120, label: 'PC 2', kind: 'pc', w: 70, h: 34 }, { id: 'p3', x: 500, y: 180, label: 'Imprimante', kind: 'pc', w: 80, h: 34 },
      ], [{ a: 'inet', b: 'A' }, { a: 'A', b: 'B' }, { a: 'B', b: 'p1' }, { a: 'B', b: 'p2' }, { a: 'B', b: 'p3' }], 600, 240),
      q: 'Quel équipement décide sur quel port livrer une trame destinée à PC 2 ?',
      opts: [O('A — il lit l’adresse IP'), O('B — il lit l’adresse MAC de destination', true), O('Internet'), O('PC 1')],
      ok: 'Le switch commute en couche 2 grâce à sa table MAC.', no: 'Le routeur (A) route entre réseaux par l’IP ; c’est le switch (B) qui livre au bon port par la MAC.', href: '/pages/adresses-mac', course: 'Les adresses MAC' },
    { svg: svgTopo('Deux VLAN sur un switch, un routeur au bout', [
        { id: 'r', x: 100, y: 120, label: 'Routeur', sub: 'Gi0/0', kind: 'router' }, { id: 's', x: 300, y: 120, label: 'Switch', kind: 'switch' },
        { id: 'a', x: 480, y: 60, label: 'PC VLAN 10', sub: '192.168.10.x', kind: 'pc', w: 100 }, { id: 'b', x: 480, y: 180, label: 'PC VLAN 20', sub: '192.168.20.x', kind: 'pc', w: 100 },
      ], [{ a: 'r', b: 's', label: '?', color: '#7c3aed' }, { a: 's', b: 'a', label: 'access 10', color: '#16a34a' }, { a: 's', b: 'b', label: 'access 20', color: '#16a34a' }], 600, 240),
      q: 'Le lien « ? » entre le switch et le routeur doit être en mode :',
      opts: [O('Access VLAN 10'), O('Access VLAN 20'), O('Trunk 802.1Q : il porte les deux VLAN', true), O('Désactivé : les VLAN ne communiquent jamais')],
      ok: 'Router-on-a-stick : un seul trunk, une sous-interface par VLAN côté routeur.', no: 'Pour router entre VLAN, le lien doit transporter les deux VLAN étiquetés : un trunk.', href: '/pages/les-vlan', course: 'Les VLAN & le routage inter-VLAN' },
    { svg: svgTopo('Un poste ne sort plus sur Internet', [
        { id: 'pc', x: 90, y: 120, label: 'Poste', sub: '192.168.10.50/24', kind: 'pc', w: 120 }, { id: 's', x: 270, y: 120, label: 'Switch', kind: 'switch' },
        { id: 'fw', x: 440, y: 120, label: 'Pare-feu', sub: 'LAN .254', kind: 'fw' }, { id: 'inet', x: 560, y: 120, label: 'Internet', kind: 'cloud', w: 80 },
      ], [{ a: 'pc', b: 's' }, { a: 's', b: 'fw' }, { a: 'fw', b: 'inet' }], 620, 220),
      q: 'ping 192.168.10.254 répond, ping 8.8.8.8 échoue, ping google.fr échoue. Qu’est-ce qui manque le plus probablement sur le poste ?',
      opts: [O('L’adresse IP'), O('La passerelle par défaut', true), O('Le DNS seulement'), O('Le câble')],
      ok: 'Le réseau local marche (la passerelle répond) mais rien ne sort : la route par défaut manque. Le DNS ne peut pas être testé tant que l’IP 8.8.8.8 échoue.', no: 'Si 8.8.8.8 échoue alors que la passerelle répond, c’est la passerelle par défaut qui manque sur le poste.', href: '/pages/bases-du-reseau', course: 'Les bases du réseau' },
    { svg: svgTopo('Deux pare-feu en série', [
        { id: 'inet', x: 60, y: 110, label: 'Internet', kind: 'cloud', w: 80 }, { id: 'f1', x: 180, y: 110, label: 'Pare-feu 1', kind: 'fw', w: 90 },
        { id: 'z', x: 310, y: 110, label: '?', sub: 'serveurs exposés', kind: 'zone', w: 110, h: 60 }, { id: 'f2', x: 440, y: 110, label: 'Pare-feu 2', kind: 'fw', w: 90 }, { id: 'lan', x: 560, y: 110, label: 'LAN', kind: 'zone', w: 80, h: 60, color: '#059669' },
      ], [{ a: 'inet', b: 'f1' }, { a: 'f1', b: 'z' }, { a: 'z', b: 'f2' }, { a: 'f2', b: 'lan' }], 620, 200),
      q: 'Comment s’appelle la zone « ? » entre les deux pare-feu ?',
      opts: [O('Le WAN'), O('La DMZ « en sandwich »', true), O('Le VLAN natif'), O('Le tunnel VPN')],
      ok: 'Architecture à deux pare-feu : pour atteindre le LAN, il faut franchir deux équipements.', no: 'Entre un pare-feu externe et un pare-feu interne se trouve la DMZ, hébergeant les serveurs exposés.', href: '/pages/dmz', course: 'La DMZ' },
    { svg: svgTopo('Un téléphone IP et un PC sur une seule prise', [
        { id: 's', x: 100, y: 120, label: 'Switch', sub: 'Fa0/5', kind: 'switch' }, { id: 'ph', x: 300, y: 120, label: 'Téléphone IP', sub: 'switch 2 ports', kind: 'phone', w: 110 }, { id: 'pc', x: 500, y: 120, label: 'PC', kind: 'pc' },
      ], [{ a: 's', b: 'ph', label: 'un seul câble' }, { a: 'ph', b: 'pc' }], 600, 200),
      q: 'Comment le port Fa0/5 transporte-t-il deux VLAN (voix et données) ?',
      opts: [O('En mode trunk classique'), O('En access + voice vlan : le téléphone étiquette sa voix, le PC reste non étiqueté', true), O('Impossible : il faut deux câbles'), O('Par DHCP')],
      ok: 'switchport access vlan 20 + switchport voice vlan 30 : un « mini-trunk » qui reste en access.', no: 'Le port reste en mode access et accepte en plus les trames étiquetées du seul VLAN voix.', href: '/pages/vlan-voix', course: 'Le VLAN voix' },
    { svg: svgTopo('Un serveur de la DMZ est compromis', baseNodes(), baseLinks([{ a: 'web', b: 'proxy', label: 'tentative', color: '#dc2626', dashed: true, arrow: true }, { a: 'web', b: 'pc', label: 'tentative', color: '#dc2626', dashed: true, arrow: true }])),
      q: 'Les tentatives partant du serveur web vers le proxy et vers le poste apparaissent en rouge dans le journal du pare-feu. Que signifient-elles ?',
      opts: [O('Une panne du pare-feu'), O('Que la zone a tenu : le mouvement latéral est bloqué', true), O('Que le LAN est compromis'), O('Rien, c’est du bruit normal')],
      ok: 'Les blocks DMZ → LAN (et DMZ → DMZ) sont le signal le plus fort : la segmentation fait son travail.', no: 'Des blocages depuis la DMZ vers le LAN prouvent que la zone contient l’attaque — et qu’il faut traiter le serveur.', href: '/pages/dmz-surveillance-entretien', course: 'Surveiller et entretenir une DMZ' },
    { svg: svgTopo('Un nomade se connecte en VPN', [
        { id: 'lap', x: 70, y: 120, label: 'Portable', sub: 'hôtel', kind: 'pc' }, { id: 'inet', x: 210, y: 120, label: 'Internet', kind: 'cloud' }, { id: 'fw', x: 350, y: 120, label: 'OPNsense', sub: 'WireGuard', kind: 'fw' },
        { id: 'z', x: 520, y: 120, label: '?', sub: 'où débouche-t-il', kind: 'zone', w: 120, h: 60 },
      ], [{ a: 'lap', b: 'inet', label: 'tunnel', color: '#7c3aed', dashed: true }, { a: 'inet', b: 'fw', color: '#7c3aed', dashed: true }, { a: 'fw', b: 'z' }], 620, 200),
      q: 'Dans quelle zone le nomade doit-il déboucher ?',
      opts: [O('Dans le LAN, comme un poste du bureau'), O('Dans une zone à part, avec sa propre matrice de flux', true), O('Dans la DMZ'), O('Sur le WAN')],
      ok: 'Un portable revenu d’un hôtel n’a pas le niveau de confiance d’un poste du bureau : interface du tunnel + règles dédiées.', no: 'Donner au nomade un accès équivalent au LAN revient à défaire la segmentation par un tunnel chiffré.', href: '/pages/opnsense-vpn-ids', course: 'OPNsense : accès distants' },
    { svg: svgTopo('Combien de domaines de broadcast ?', [
        { id: 'r', x: 90, y: 120, label: 'Routeur', kind: 'router' }, { id: 's1', x: 270, y: 70, label: 'Switch A', sub: 'VLAN 10 et 20', kind: 'switch' }, { id: 's2', x: 270, y: 170, label: 'Switch B', sub: 'VLAN 10 et 20', kind: 'switch' },
        { id: 'p1', x: 460, y: 40, label: 'PC VLAN 10', kind: 'pc', w: 96 }, { id: 'p2', x: 460, y: 100, label: 'PC VLAN 20', kind: 'pc', w: 96 }, { id: 'p3', x: 460, y: 150, label: 'PC VLAN 10', kind: 'pc', w: 96 }, { id: 'p4', x: 460, y: 205, label: 'PC VLAN 20', kind: 'pc', w: 96 },
      ], [{ a: 'r', b: 's1', label: 'trunk' }, { a: 's1', b: 's2', label: 'trunk' }, { a: 's1', b: 'p1' }, { a: 's1', b: 'p2' }, { a: 's2', b: 'p3' }, { a: 's2', b: 'p4' }], 600, 240),
      q: 'Deux switches, deux VLAN partout : combien de domaines de broadcast pour les postes ?',
      opts: [O('1'), O('2 : un par VLAN, quel que soit le nombre de switches', true), O('4 : un par switch et par VLAN'), O('6')],
      ok: 'Le VLAN définit le domaine de broadcast ; le trunk le prolonge d’un switch à l’autre.', no: 'Chaque VLAN est un domaine de broadcast distinct, étendu sur les deux switches par le trunk : deux domaines.', href: '/pages/les-vlan', course: 'Les VLAN & le routage inter-VLAN' },
  ],
};

// ── VLAN : ports, modes, VTP ───────────────────────────────────────────
export const JEU_VLAN: Game = {
  slug: 'jeu-vlan-ports', icon: '🔀', title: 'VLAN : quel port, quel mode ?', eyebrow: 'Jeu · Réseau / Cisco',
  intro: 'Configurations, sorties de show et schémas : trouve le bon mode, la bonne commande, ou la faute qui casse tout.',
  desc: '10 cas VLAN : access/trunk, natif, allowed, VTP, port-security, VLAN voix.',
  courses: [['/pages/les-vlan', 'Les VLAN'], ['/pages/vlan-securite', 'Sécuriser les VLAN'], ['/pages/vlan-vtp', 'VTP'], ['/pages/vlan-voix', 'Le VLAN voix']],
  slides: [
    { svg: svgTable('show interfaces trunk', ['Port', 'Mode', 'Encapsulation', 'Status', 'Native vlan'], [['Gi0/1', 'on', '802.1q', 'trunking', '1'], ['Gi0/2', 'on', '802.1q', 'trunking', '99']], { widths: [80, 80, 120, 110, 100], w: 560 }),
      q: 'Gi0/1 va vers le switch S2, dont le trunk a le natif 99. Que se passe-t-il ?',
      opts: [O('Rien, le natif ne compte pas'), O('Native VLAN mismatch : les trames non étiquetées changent de VLAN d’un côté à l’autre', true), O('Le trunk passe en access'), O('Le switch redémarre')],
      ok: 'Le VLAN natif circule sans tag : il doit être identique des deux côtés.', no: 'Un natif différent des deux côtés mélange les VLAN : c’est la cause classique d’un « trunk KO ».', href: '/pages/les-vlan', course: 'Les VLAN & le routage inter-VLAN' },
    { svg: svgTable('Configuration de Fa0/5 (poste utilisateur)', ['Ligne', 'Commande'], [['1', 'interface FastEthernet0/5'], ['2', ' switchport mode dynamic auto'], ['3', ' switchport access vlan 20']], { widths: [60, 480], mono: true, w: 560, highlight: [1] }),
      q: 'Un attaquant branché sur Fa0/5 parle DTP. Que risque-t-il d’obtenir ?',
      opts: [O('Rien : il est en VLAN 20'), O('Un trunk, donc l’accès à tous les VLAN (switch spoofing)', true), O('Une adresse IP'), O('Le mot de passe enable')],
      ok: 'Parade : switchport mode access + switchport nonegotiate.', no: 'La ligne 2 laisse la négociation DTP active : le port peut devenir trunk.', href: '/pages/vlan-securite', course: 'Sécuriser les VLAN' },
    { svg: svgTable('show vtp status — switch sorti du labo', ['Champ', 'Valeur'], [['VTP Domain Name', 'ENTREPRISE'], ['VTP Operating Mode', 'Client'], ['Configuration Revision', '87'], ['Number of existing VLANs', '3']], { widths: [240, 300], mono: true, w: 560, highlight: [2] }),
      q: 'Le réseau de production (même domaine) est en révision 12 avec 8 VLAN. On branche ce switch sur un trunk. Résultat ?',
      opts: [O('Il reçoit les 8 VLAN de la production'), O('Sa base (3 VLAN) écrase celle de tout le réseau : révision 87 > 12', true), O('Rien, il est en mode client'), O('Le trunk refuse la connexion')],
      ok: 'Le numéro de révision le plus élevé gagne, peu importe le mode. Remettre la révision à 0 avant de brancher.', no: 'Même en client, un switch annonce sa base : la révision la plus haute gagne et efface les VLAN de production.', href: '/pages/vlan-vtp', course: 'VTP' },
    { svg: svgTable('show interfaces Fa0/7 switchport', ['Champ', 'Valeur'], [['Administrative Mode', 'static access'], ['Access Mode VLAN', '20 (DONNEES)'], ['Voice VLAN', '30 (VOIX)'], ['Trunking Native Mode VLAN', '1 (default)']], { widths: [260, 280], mono: true, w: 560 }),
      q: 'Ce port apparaît-il dans show interfaces trunk ?',
      opts: [O('Oui, il transporte deux VLAN'), O('Non : il reste en mode access, le VLAN voix est une exception', true), O('Oui, à cause du natif'), O('Seulement si le téléphone est Cisco')],
      ok: 'Le multi-VLAN access port n’est pas un trunk : point important au dépannage.', no: 'Un port access + voice vlan reste en access ; show interfaces trunk ne l’affiche pas.', href: '/pages/vlan-voix', course: 'Le VLAN voix' },
    { svg: svgTable('show interfaces status', ['Port', 'Name', 'Status', 'Vlan'], [['Fa0/5', 'Bureau 12', 'err-disabled', '20'], ['Fa0/6', 'Bureau 13', 'connected', '20']], { widths: [80, 160, 150, 100], w: 560, highlight: [0] }),
      q: 'Fa0/5 est en err-disabled après qu’un utilisateur a branché un petit switch. Pourquoi, et que faire ?',
      opts: [O('Câble défectueux : le changer'), O('Violation port-security en mode shutdown : shutdown puis no shutdown sur l’interface', true), O('VLAN 20 supprimé : le recréer'), O('Rien, il se rouvre seul dans 5 s')],
      ok: 'Le mode de violation par défaut est shutdown ; errdisable recovery peut automatiser la reprise.', no: 'Trop de MAC sur le port → violation → err-disabled. Le port ne se rouvre pas tout seul.', href: '/pages/vlan-securite', course: 'Sécuriser les VLAN' },
    { svg: svgTable('Trunk vers S2', ['Ligne', 'Commande'], [['1', 'interface GigabitEthernet0/1'], ['2', ' switchport mode trunk'], ['3', ' switchport trunk native vlan 999'], ['4', ' switchport trunk allowed vlan 10,20'], ['5', ' switchport nonegotiate']], { widths: [60, 480], mono: true, w: 560, highlight: [3] }),
      q: 'On crée le VLAN 30 sur les deux switches et on met des postes dedans. Ils ne se voient pas d’un switch à l’autre. Pourquoi ?',
      opts: [O('Le natif 999 bloque'), O('Le VLAN 30 n’est pas dans allowed vlan : il ne franchit pas le trunk', true), O('nonegotiate coupe le trunk'), O('Il faut VTP')],
      ok: 'switchport trunk allowed vlan add 30, ou récrire la liste.', no: 'Un VLAN absent de la liste allowed ne traverse pas le trunk, quoi qu’il arrive.', href: '/pages/les-vlan', course: 'Les VLAN & le routage inter-VLAN' },
    { svg: svgTable('Routeur — sous-interfaces', ['Ligne', 'Commande'], [['1', 'interface GigabitEthernet0/0'], ['2', ' no ip address'], ['3', 'interface GigabitEthernet0/0.10'], ['4', ' encapsulation dot1Q 10'], ['5', ' ip address 192.168.10.1 255.255.255.0'], ['6', 'interface GigabitEthernet0/0.20'], ['7', ' encapsulation dot1Q 20'], ['8', ' ip address 192.168.20.1 255.255.255.0']], { widths: [60, 480], mono: true, w: 560 }),
      q: 'Tout est en place, mais aucun VLAN ne pingue sa passerelle. Quelle ligne manque ?',
      opts: [O('ip routing'), O('no shutdown sur l’interface physique Gi0/0', true), O('switchport mode trunk sur le routeur'), O('vlan 10 et vlan 20 sur le routeur')],
      ok: 'En router-on-a-stick, l’interface physique doit être montée : les sous-interfaces en dépendent.', no: 'Les sous-interfaces sont justes ; l’interface physique Gi0/0 reste éteinte sans no shutdown.', href: '/pages/les-vlan', course: 'Les VLAN & le routage inter-VLAN' },
    { svg: svgTable('Switch L3 — show ip interface brief', ['Interface', 'IP-Address', 'Status', 'Protocol'], [['Vlan10', '192.168.10.1', 'up', 'up'], ['Vlan20', '192.168.20.1', 'down', 'down'], ['Gi0/1', 'unassigned', 'up', 'up']], { widths: [120, 150, 120, 120], w: 560, highlight: [1] }),
      q: 'La SVI du VLAN 20 est down/down alors que sa configuration est identique à celle du VLAN 10. Cause la plus probable ?',
      opts: [O('Mauvaise adresse IP'), O('Aucun port actif n’appartient au VLAN 20 (ou le VLAN n’existe pas dans la base)', true), O('ip routing manquant'), O('Le trunk est en natif 20')],
      ok: 'Une SVI monte si le VLAN existe, qu’un port actif y appartient, et qu’elle n’est pas shutdown.', no: 'Sans port actif dans le VLAN 20, la SVI reste down/down même avec une configuration juste.', href: '/pages/les-vlan', course: 'Les VLAN & le routage inter-VLAN' },
    { svg: svgTable('Ports du couloir (inutilisés)', ['Ligne', 'Commande'], [['1', 'interface range FastEthernet0/21 - 24'], ['2', ' switchport mode access'], ['3', ' switchport access vlan 666'], ['4', ' shutdown']], { widths: [60, 480], mono: true, w: 560 }),
      q: 'Pourquoi mettre le VLAN 666 (PARKING) en plus du shutdown ?',
      opts: [O('Pour le débit'), O('Si un collègue fait no shutdown pour dépanner, le port ne donne toujours accès à rien', true), O('C’est obligatoire sur Cisco'), O('Pour que VTP le propage')],
      ok: 'Le VLAN parking est le filet de sécurité : isolé, sans passerelle.', no: 'Le shutdown suffirait — jusqu’au no shutdown pressé d’un collègue. Le VLAN parking reste.', href: '/pages/vlan-securite', course: 'Sécuriser les VLAN' },
    { svg: svgTable('Trame forgée par un attaquant sur un port access (natif 1)', ['Champ', 'Valeur'], [['Tag 1', 'VLAN 1 (natif)'], ['Tag 2', 'VLAN 30 (serveurs)'], ['Données', '…']], { widths: [160, 380], mono: true, w: 560 }),
      q: 'Comment s’appelle cette attaque, et quelle parade ?',
      opts: [O('MAC flooding — port-security'), O('Double tagging — un VLAN natif dédié sans aucun port access, identique des deux côtés', true), O('ARP spoofing — DHCP snooping'), O('Switch spoofing — nonegotiate')],
      ok: 'Le premier switch retire le tag natif et transmet la trame taguée 30 sur le trunk.', no: 'Deux étiquettes dont la première est le natif : double tagging. La parade est un natif dédié (999) sans poste.', href: '/pages/vlan-securite', course: 'Sécuriser les VLAN' },
  ],
};

// ── OPNsense : règles, NAT, pièges ────────────────────────────────────
const RULE_H = ['#', 'Action', 'Proto', 'Source', 'Destination', 'Port', 'Description'];
const RW = [30, 70, 60, 120, 130, 70, 140];

export const JEU_OPNSENSE: Game = {
  slug: 'jeu-opnsense-regles', icon: '🧱', title: 'OPNsense : la règle qui manque', eyebrow: 'Jeu · Réseau / Pare-feu',
  intro: 'Des listes de règles telles qu’on les voit dans Firewall › Rules. Trouve l’onglet, l’ordre, ou le réglage qui explique le symptôme.',
  desc: '10 écrans OPNsense : ordre des règles, bon onglet, NAT et règle associée, pièges classiques.',
  courses: [['/pages/opnsense', 'OPNsense volet 1'], ['/pages/opnsense-nat', 'Volet 2 — NAT'], ['/pages/opnsense-segmentation', 'Volet 4 — Segmentation'], ['/pages/tp-opnsense-filtrage', 'TP 1.2']],
  slides: [
    { svg: svgTable('Firewall › Rules › LAN', RULE_H, [['1', 'Pass', 'TCP', 'LAN net', 'any', '80, 443', 'Navigation'], ['2', 'Block', 'TCP', 'LAN net', 'any', '80, 443', 'Interdire le web'], ['3', 'Pass', 'ICMP', 'LAN net', 'LAN_SRV net', '*', 'Ping']], { widths: RW, w: 640, highlight: [1] }),
      q: 'On voulait interdire la navigation. Les postes naviguent toujours. Pourquoi ?',
      opts: [O('Il manque Apply changes'), O('La règle Block est en position 2 : la Pass en 1 correspond d’abord et décide', true), O('Block ne marche pas sur TCP'), O('Il faut la mettre sur l’onglet WAN')],
      ok: 'Première correspondance gagne : la règle de blocage doit être au-dessus.', no: 'Les règles sont lues de haut en bas ; la Pass n°1 s’applique avant la Block n°2.', href: '/pages/opnsense', course: 'OPNsense : le pare-feu open source' },
    { svg: svgTable('Firewall › Rules › WAN', RULE_H, [['1', 'Pass', 'TCP', 'any', 'LAN net', '80', 'Autoriser le web du LAN']], { widths: RW, w: 640, highlight: [0] }),
      q: 'On voulait autoriser les postes du LAN à naviguer. Ça ne marche pas. Quelle est l’erreur ?',
      opts: [O('Le port devrait être 443'), O('Mauvais onglet : le paquet des postes ENTRE par LAN, la règle se pose sur LAN', true), O('La source devrait être LAN address'), O('Il manque le NAT')],
      ok: 'Une règle s’applique au trafic qui entre par l’interface. Posée sur le mauvais onglet, elle ne fait strictement rien.', no: 'Les paquets des postes entrent dans le pare-feu par l’interface LAN : la règle doit être sur l’onglet LAN.', href: '/pages/opnsense', course: 'OPNsense : le pare-feu open source' },
    { svg: svgTable('Firewall › NAT › Port Forward', ['If', 'Proto', 'Dest.', 'Port', 'Cible', 'Port cible', 'Filter rule'], [['WAN', 'TCP', 'WAN address', '443', '192.168.20.10', '443', 'None']], { widths: [50, 60, 110, 60, 130, 80, 100], w: 640 }),
      q: 'La redirection est en place, rien ne répond depuis Internet. Pourquoi ?',
      opts: [O('Le port cible devrait être 80'), O('Filter rule association = None : aucune règle WAN n’autorise le paquet, refus implicite', true), O('La destination doit être l’IP interne'), O('Il faut le NAT 1:1')],
      ok: 'La redirection traduit ; une règle de filtrage doit autoriser. Choisir « Add associated filter rule ».', no: 'Sans règle associée, la traduction a lieu puis le paquet est jeté par le refus implicite du WAN.', href: '/pages/opnsense-nat', course: 'OPNsense : le NAT' },
    { svg: svgTable('Firewall › Rules › WAN (règle écrite à la main)', RULE_H, [['1', 'Pass', 'TCP', 'any', 'WAN address', '443', 'Web publié']], { widths: RW, w: 640, highlight: [0] }),
      q: 'La redirection WAN:443 → 192.168.20.10 existe, cette règle aussi. Rien ne passe. Pourquoi ?',
      opts: [O('any n’est pas accepté en source'), O('Le NAT passe AVANT le filtrage : la règle doit viser 192.168.20.10, pas WAN address', true), O('Il faut UDP'), O('Le port 443 est réservé à l’interface web')],
      ok: 'Quand la règle examine le paquet, la destination a déjà été réécrite.', no: 'La destination vue par la règle est l’adresse interne : une règle sur WAN address ne correspond jamais.', href: '/pages/opnsense-nat', course: 'OPNsense : le NAT' },
    { svg: svgTable('Interfaces › WAN — options', ['Option', 'État'], [['IPv4 Configuration Type', 'Static IPv4 · 172.16.0.50/24'], ['Block private networks', '☑ coché'], ['Block bogon networks', '☑ coché']], { widths: [260, 360], w: 640, highlight: [1] }),
      q: 'Maquette de TP : le WAN est sur le réseau de la salle (172.16.0.0/24). La publication du site ne répond pas depuis l’hôte. Première chose à vérifier ?',
      opts: [O('Le bogon'), O('Décocher « Block private networks » : la source (l’hôte) est une adresse privée', true), O('Changer le port'), O('Passer le WAN en DHCP')],
      ok: 'Sur un vrai WAN Internet on la laisse cochée ; sur un WAN de maquette privé, elle bloque tout test.', no: 'La règle d’usine jette tout paquet arrivant du WAN avec une source privée — dont votre hôte de test.', href: '/pages/tp-opnsense-nat', course: 'TP OPNsense 1.3 — NAT' },
    { svg: svgTable('Firewall › Rules › DMZ', RULE_H, [['1', 'Pass', 'TCP', 'DMZ net', 'any', '80, 443', 'Mises à jour'], ['2', 'Block', '*', 'DMZ net', 'RESEAUX_INTERNES', '*', 'Rien vers le LAN']], { widths: RW, w: 640 }),
      q: 'Depuis un serveur de la DMZ, curl http://192.168.10.50 (dans le LAN) réussit. Pourquoi ?',
      opts: [O('L’alias est vide'), O('« any » englobe les réseaux internes : la Pass n°1 correspond avant la Block n°2', true), O('Le port 80 est toujours autorisé'), O('Block ne s’applique pas aux serveurs')],
      ok: 'Bloquer RESEAUX_INTERNES d’abord, autoriser any ensuite.', no: 'any veut dire tout, y compris le LAN : la règle de sortie doit venir après le blocage des réseaux internes.', href: '/pages/opnsense-segmentation', course: 'OPNsense : segmenter' },
    { svg: svgTable('Firewall › Rules › LAN_SRV (OPT1)', RULE_H, [['—', '', '', '', '', '', 'Aucune règle']], { widths: RW, w: 640 }),
      q: 'Depuis le serveur (LAN_SRV), ping 192.168.20.254 échoue. Est-ce une panne ?',
      opts: [O('Oui, l’interface est morte'), O('Non : une interface OPT n’a aucune règle par défaut, c’est le refus implicite', true), O('Oui, le câble'), O('Non, c’est le pare-feu Windows du serveur')],
      ok: 'Contrairement au LAN, OPT1 ne reçoit ni anti-lockout ni default allow.', no: 'Aucune règle ne correspond → refus implicite. Le paquet est jeté par OPNsense, visible en rouge dans Live View.', href: '/pages/tp-opnsense-filtrage', course: 'TP OPNsense 1.2' },
    { svg: svgTable('Firewall › Log Files › Live View', ['Interface', 'Action', 'Source', 'Destination', 'Proto', 'Règle'], [['LAN', 'pass', '192.168.10.50:51002', '192.168.20.100:80', 'TCP', 'Web LAN → serveur'], ['LAN', 'pass', '192.168.10.50:51003', '192.168.20.100:80', 'TCP', 'Web LAN → serveur']], { widths: [70, 60, 150, 150, 60, 150], w: 640 }),
      q: 'Le journal montre le trafic autorisé. Quelle case a permis ces lignes ?',
      opts: [O('Aucune : tout est journalisé par défaut'), O('« Log packets that are handled by this rule » sur la règle Pass', true), O('Le mode debug'), O('Suricata')],
      ok: 'Une règle Pass ne journalise rien par défaut : sans la case cochée, la capture demandée serait vide.', no: 'Les passages ne sont visibles que si la règle a la journalisation activée.', href: '/pages/tp-opnsense-filtrage', course: 'TP OPNsense 1.2' },
    { svg: svgTable('Firewall › Rules › LAN', RULE_H, [['1', 'Block', 'TCP', 'LAN net', 'any', '80, 443', 'Test'], ['2', 'Pass', '*', 'LAN net', 'any', '*', 'Default allow LAN']], { widths: RW, w: 640 }),
      q: 'Apply changes vient d’être cliqué, mais un poste continue de charger le site ouvert avant. Pourquoi ?',
      opts: [O('La règle est ignorée'), O('La connexion déjà établie continue sur son état : vider les états ou fermer le navigateur', true), O('Le cache DNS'), O('Il faut redémarrer le pare-feu')],
      ok: 'Un changement de règle ne concerne que les nouvelles connexions ; Firewall › Diagnostics › States pour vider.', no: 'Le pare-feu est à états : la session existante n’est pas réévaluée tant que son état vit.', href: '/pages/opnsense', course: 'OPNsense : le pare-feu open source' },
    { svg: svgTable('Firewall › Rules › LAN — règle en cours d’écriture', ['Champ', 'Valeur'], [['Action', 'Pass'], ['Protocol', 'TCP'], ['Source', 'LAN net'], ['Destination', 'This Firewall'], ['Port', '22443'], ['Description', 'Admin web depuis le LAN']], { widths: [160, 460], w: 640 }),
      q: 'On a supprimé les règles par défaut du LAN. Pourquoi écrire explicitement cette règle ?',
      opts: [O('Parce que l’anti-lockout n’existe pas'), O('Pour garder l’accès à l’administration même si l’anti-lockout est un jour désactivée', true), O('Pour ouvrir SSH'), O('Elle ne sert à rien')],
      ok: 'L’anti-lockout suit le port 22443, mais une règle nominative documente et sécurise l’accès admin.', no: 'Cette règle garantit l’accès à l’interface web depuis le LAN, indépendamment de l’anti-lockout.', href: '/pages/tp-opnsense-installation', course: 'TP OPNsense 1.1' },
  ],
};

// ── DMZ : autorisé ou bloqué ? ────────────────────────────────────────
function flux(from: string, to: string, port: string, color: string): string {
  const nodes = baseNodes(); const map: Record<string, string> = { inet: 'inet', pc: 'pc', ad: 'ad', web: 'web', proxy: 'proxy', fw: 'fw' };
  return svgTopo(`Flux : ${from} → ${to} ${port}`, nodes, baseLinks([{ a: map[from], b: map[to], label: port, color, arrow: true, dashed: true }]));
}
export const JEU_DMZ: Game = {
  slug: 'jeu-dmz-flux', icon: '🚦', title: 'DMZ : autorisé ou bloqué ?', eyebrow: 'Jeu · Réseau / Sécurité',
  intro: 'Le schéma montre un flux en pointillé. Décide ce que la matrice de flux de la DMZ doit en faire — et pourquoi.',
  desc: '10 flux à trancher avec la matrice DMZ : publié, nominatif, bloqué, ou question piège.',
  courses: [['/pages/dmz', 'La DMZ'], ['/pages/dmz-mise-en-place', 'Mettre en place une DMZ'], ['/pages/dmz-surveillance-entretien', 'Surveiller et entretenir']],
  slides: [
    { svg: flux('inet', 'proxy', ':443', '#16a34a'), q: 'Internet → reverse proxy, port 443.', opts: [O('Bloqué : rien n’entre'), O('Autorisé : c’est le service publié, via une redirection de port + règle associée', true), O('Autorisé sur tous les ports du proxy'), O('Autorisé seulement depuis le LAN')], ok: 'Un service publié = un port, vers une adresse, avec sa règle.', no: 'Le proxy est ce qu’on expose : 443 (et 80) depuis Internet sont les seuls ports ouverts.', href: '/pages/dmz-mise-en-place', course: 'Mettre en place une DMZ' },
    { svg: flux('inet', 'web', ':80', '#dc2626'), q: 'Internet → serveur web .10 directement, port 80.', opts: [O('Autorisé, c’est un serveur web'), O('Bloqué : le serveur web n’est pas publié, Internet ne connaît que le proxy', true), O('Autorisé en HTTPS seulement'), O('Dépend du DNS')], ok: 'Seul le proxy reçoit Internet ; le web ne parle qu’au proxy.', no: 'Dans l’exemple, aucune redirection ne vise .10 : le refus implicite du WAN s’applique.', href: '/pages/dmz-mise-en-place', course: 'Mettre en place une DMZ' },
    { svg: flux('web', 'ad', ':445', '#dc2626'), q: 'Serveur web → serveur du LAN, port 445 (SMB).', opts: [O('Autorisé : le web a besoin de fichiers'), O('Bloqué : DMZ → LAN est interdit, aucune exception pour SMB', true), O('Autorisé en lecture'), O('Autorisé si le proxy le demande')], ok: 'La règle qui fait la DMZ.', no: 'Un serveur exposé ne monte jamais un partage du LAN : bloqué, et journalisé — c’est un signal fort.', href: '/pages/dmz', course: 'La DMZ' },
    { svg: flux('web', 'ad', ':1433', '#16a34a'), q: 'Serveur web .10 → base de données 192.168.10.50, port 1433.', opts: [O('Bloqué : DMZ → LAN'), O('Autorisé, mais nominatif : de .10 vers .50, sur 1433, journalisé', true), O('Autorisé pour toute la DMZ'), O('On déplace la base en DMZ')], ok: 'L’exception étroite au-dessus de la règle de blocage.', no: 'Le web a besoin de la base : on ouvre UN flux nominatif, pas la zone.', href: '/pages/dmz-mise-en-place', course: 'Mettre en place une DMZ' },
    { svg: flux('pc', 'web', ':22', '#16a34a'), q: 'Poste d’administration (LAN) → serveur web, SSH.', opts: [O('Bloqué : le LAN ne touche pas la DMZ'), O('Autorisé depuis les seuls postes d’administration (alias POSTES_ADMIN)', true), O('Autorisé depuis tout le LAN'), O('Autorisé depuis Internet aussi')], ok: 'L’administration vient du LAN, du VPN ou d’un bastion — jamais d’Internet.', no: 'LAN → DMZ est permis pour administrer, mais restreint aux postes d’admin, pas à « LAN net ».', href: '/pages/dmz-mise-en-place', course: 'Mettre en place une DMZ' },
    { svg: flux('web', 'inet', 'any', '#dc2626'), q: 'Serveur web → Internet, tous ports (any).', opts: [O('Autorisé : il doit se mettre à jour'), O('Bloqué en any ; on ouvre le strict nécessaire (DNS, 80/443 pour les mises à jour)', true), O('Bloqué totalement, même les mises à jour'), O('Autorisé la nuit')], ok: 'Un serveur compromis ne doit pas pouvoir appeler chez lui sur n’importe quel port.', no: 'DMZ → Internet = le strict nécessaire, pas any.', href: '/pages/dmz', course: 'La DMZ' },
    { svg: flux('proxy', 'fw', ':443', '#dc2626'), q: 'Serveur de la DMZ → interface d’administration du pare-feu.', opts: [O('Autorisé, c’est interne'), O('Bloqué : jamais d’administration du pare-feu depuis la DMZ (règle « Block This Firewall »)', true), O('Autorisé en lecture seule'), O('Autorisé pour le proxy seulement')], ok: 'Règle 5 du volet 2.', no: 'Un serveur exposé qui peut atteindre l’admin du pare-feu, c’est la clé du bâtiment dans le sas.', href: '/pages/dmz-mise-en-place', course: 'Mettre en place une DMZ' },
    { svg: flux('ad', 'web', ':22 (sauvegarde)', '#16a34a'), q: 'Le serveur de sauvegarde du LAN vient copier les données du serveur web.', opts: [O('Bloqué : LAN → DMZ'), O('Autorisé : la sauvegarde est tirée depuis le LAN, la DMZ ne pousse pas', true), O('On fait pousser la DMZ vers le LAN'), O('On sauvegarde sur Internet')], ok: 'Le serveur de sauvegarde vient chercher : le flux est initié par le LAN.', no: 'Les sauvegardes des serveurs DMZ sont tirées depuis le LAN, jamais poussées par la DMZ.', href: '/pages/dmz-surveillance-entretien', course: 'Surveiller et entretenir une DMZ' },
    { svg: flux('web', 'proxy', ':8080', '#dc2626'), q: 'Serveur web .10 → reverse proxy .20, port 8080 (à l’initiative du web).', opts: [O('Autorisé : ils sont dans la même DMZ'), O('Bloqué : c’est le proxy qui parle au web, pas l’inverse — chaque machine est seule dans sa case', true), O('Autorisé sur 443'), O('Dépend du DNS')], ok: 'DMZ → DMZ au cas par cas : proxy → web oui, web → proxy non.', no: 'Même dans la DMZ, on ne laisse pas les serveurs se parler librement.', href: '/pages/dmz-mise-en-place', course: 'Mettre en place une DMZ' },
    { svg: flux('proxy', 'ad', 'syslog :514', '#16a34a'), q: 'Serveurs de la DMZ → serveur syslog du LAN, port 514.', opts: [O('Bloqué : DMZ → LAN'), O('Autorisé, nominatif : les journaux doivent partir hors de la DMZ pour ne pas être effacés', true), O('On garde les journaux sur place'), O('Autorisé sur tous les ports')], ok: 'Un flux sortant nominatif de plus, vers une adresse et un port.', no: 'Un attaquant efface d’abord les traces locales : les journaux partent vers le LAN, par un flux étroit.', href: '/pages/dmz-surveillance-entretien', course: 'Surveiller et entretenir une DMZ' },
  ],
};

// ── Wireshark & services : lis la capture ─────────────────────────────
export const JEU_WIRESHARK: Game = {
  slug: 'jeu-lire-capture', icon: '🦈', title: 'Lis la capture', eyebrow: 'Jeu · Réseau / Protocoles',
  intro: 'Des listes de paquets façon Wireshark. Reconnais le protocole, le port, le sens — et ce que la trame raconte.',
  desc: '10 captures : ARP, DNS, ICMP, TCP/TLS, SMTP, SSH, DHCP, RADIUS, FTP.',
  courses: [['/pages/le-wireshark', 'Wireshark'], ['/pages/tcp-et-udp', 'TCP & UDP'], ['/pages/la-messagerie', 'La messagerie'], ['/pages/le-ssh', 'SSH']],
  slides: [
    { svg: svgPackets([['1', '192.168.50.10', 'Broadcast', 'ARP', 'Who has 192.168.50.254? Tell 192.168.50.10'], ['2', 'aa:bb:cc:11:22:33', '192.168.50.10', 'ARP', '192.168.50.254 is at aa:bb:cc:11:22:33'], ['3', '192.168.50.10', '192.168.50.254', 'ICMP', 'Echo (ping) request'], ['4', '192.168.50.254', '192.168.50.10', 'ICMP', 'Echo (ping) reply']]),
      q: 'Pourquoi les deux trames ARP précèdent-elles le ping ?', opts: [O('Pour vérifier le DNS'), O('Le poste ne connaît pas la MAC de la passerelle : ARP fait IP → MAC avant d’envoyer', true), O('Pour ouvrir le port ICMP'), O('C’est le pare-feu')], ok: 'Sur le réseau local, une trame doit porter la MAC du destinataire.', no: 'Avant de parler à une IP locale, il faut sa MAC : c’est le rôle d’ARP (cache vidé par arp -d *).', href: '/pages/le-wireshark', course: 'Wireshark' },
    { svg: svgPackets([['12', '192.168.50.10', '192.168.50.11', 'DNS', 'Standard query A www.adrar-formation.com  (src port 55231 → dst 53)'], ['13', '192.168.50.11', '192.168.50.10', 'DNS', 'Standard response A 91.216.107.203  (src port 53 → dst 55231)']]),
      q: 'Quel port identifie le service DNS, et de quel côté ?', opts: [O('55231, côté serveur'), O('53, côté serveur ; le client utilise un port éphémère (55231) et les ports sont permutés dans la réponse', true), O('80, côté client'), O('Les deux ports sont 53')], ok: 'Port bien connu côté serveur, éphémère (> 1023) côté client.', no: 'Le 53 est le port du service DNS sur le serveur ; la réponse revient sur le port éphémère du client.', href: '/pages/le-wireshark', course: 'Wireshark' },
    { svg: svgPackets([['20', '192.168.50.10', '91.216.107.203', 'ICMP', 'Echo (ping) request   [Ethernet dst: aa:bb:cc:11:22:33]']]),
      q: 'Le site est hors du réseau local. À qui appartient la MAC de destination aa:bb:cc:11:22:33 ?', opts: [O('Au site web'), O('À la passerelle : IP = destination finale, MAC = prochain saut', true), O('Au serveur DNS'), O('Au switch')], ok: 'La grande leçon : la MAC change à chaque saut, l’IP de bout en bout non.', no: 'Vers un réseau distant, la trame est adressée à la MAC de la passerelle ; l’IP reste celle du site.', href: '/pages/le-wireshark', course: 'Wireshark' },
    { svg: svgPackets([['30', '192.168.10.50', '203.0.113.10', 'TCP', '51820 → 443 [SYN]'], ['31', '203.0.113.10', '192.168.10.50', 'TCP', '443 → 51820 [SYN, ACK]'], ['32', '192.168.10.50', '203.0.113.10', 'TCP', '51820 → 443 [ACK]'], ['33', '192.168.10.50', '203.0.113.10', 'TLSv1.3', 'Client Hello (SNI: www.entreprise.fr)']]),
      q: 'Que voit un IDS de ce flux HTTPS après la trame 33 ?', opts: [O('Tout le contenu des pages'), O('Le nom du site (SNI) et les métadonnées, mais pas le contenu chiffré', true), O('Rien du tout'), O('Les mots de passe')], ok: 'La quasi-totalité du web est chiffrée : Suricata travaille sur ce qui reste en clair.', no: 'Le SNI du Client Hello, les adresses et les tailles sont visibles ; le contenu TLS ne l’est pas.', href: '/pages/opnsense-vpn-ids', course: 'OPNsense : détection d’intrusion' },
    { svg: svgPackets([['40', '0.0.0.0', '255.255.255.255', 'DHCP', 'DHCP Discover  (src 68 → dst 67)'], ['41', '192.168.10.254', '255.255.255.255', 'DHCP', 'DHCP Offer  192.168.10.100'], ['42', '0.0.0.0', '255.255.255.255', 'DHCP', 'DHCP Request'], ['43', '192.168.10.254', '192.168.10.100', 'DHCP', 'DHCP ACK']]),
      q: 'Pourquoi la source de la trame 40 est-elle 0.0.0.0 ?', opts: [O('Erreur de capture'), O('Le poste n’a pas encore d’adresse : il diffuse en broadcast pour trouver un serveur DHCP', true), O('C’est l’adresse du serveur'), O('APIPA')], ok: 'Discover → Offer → Request → ACK, ports UDP 67/68.', no: 'Sans adresse, le client émet depuis 0.0.0.0 vers 255.255.255.255 : le DHCP Discover.', href: '/pages/opnsense-services', course: 'OPNsense : DHCP et DNS' },
    { svg: svgPackets([['50', '192.168.20.30', '192.168.10.25', 'TCP', '48210 → 25 [SYN]'], ['51', '192.168.10.25', '192.168.20.30', 'TCP', '25 → 48210 [SYN, ACK]']]),
      q: 'Quel service est contacté sur le port 25, et que représente ce flux dans une DMZ ?', opts: [O('IMAP : lecture des mails'), O('SMTP : le relais mail de la DMZ remet le courrier au serveur de messagerie du LAN — un flux nominatif', true), O('POP3'), O('DNS')], ok: 'SMTP = 25 (transfert entre serveurs). Ce DMZ → LAN est une des deux exceptions nominatives.', no: 'Port 25 = SMTP. Le relais .30 remet le courrier au serveur interne .25 : autorisé, nominatif, journalisé.', href: '/pages/la-messagerie', course: 'La messagerie' },
    { svg: svgPackets([['60', '192.168.10.50', '192.168.20.10', 'TCP', '52000 → 22320 [SYN]'], ['61', '192.168.20.10', '192.168.10.50', 'TCP', '22320 → 52000 [SYN, ACK]'], ['62', '192.168.10.50', '192.168.20.10', 'SSHv2', 'Client: Protocol (SSH-2.0-OpenSSH_9.2)']]),
      q: 'SSH sur le port 22320 au lieu de 22 : qu’est-ce que ça change ?', opts: [O('Le serveur devient inviolable'), O('Moins de bruit des balayages automatiques ; la sécurité reste les clés et la restriction de source', true), O('Le chiffrement est plus fort'), O('Rien, SSH n’accepte que 22')], ok: 'Un port haut réduit le bruit ; ce n’est pas de la sécurité.', no: 'Changer de port n’est pas une protection : c’est la clé, PermitRootLogin no et la source restreinte qui protègent.', href: '/pages/linux-ssh', course: 'SSH serveur sous Linux' },
    { svg: svgPackets([['70', '192.168.10.50', '192.168.20.100', 'FTP', 'Request: USER jean'], ['71', '192.168.20.100', '192.168.10.50', 'FTP', 'Response: 331 Password required'], ['72', '192.168.10.50', '192.168.20.100', 'FTP', 'Request: PASS Secret123!']]),
      q: 'Que révèle cette capture sur FTP ?', opts: [O('Que FTP est chiffré'), O('Que FTP circule en clair : identifiant et mot de passe lisibles sur le port 21', true), O('Que le mot de passe est haché'), O('Que le mode passif est actif')], ok: 'D’où FTPS (TLS) ou, mieux, SFTP dans SSH.', no: 'Le mot de passe apparaît en toutes lettres : FTP = usage interne ou dépôt public seulement.', href: '/pages/linux-proftpd', course: 'FTP : ProFTPd' },
    { svg: svgPackets([['80', '192.168.10.2', '192.168.10.5', 'RADIUS', 'Access-Request id=12  (src switch → dst 1812)'], ['81', '192.168.10.5', '192.168.10.2', 'RADIUS', 'Access-Accept id=12  Tunnel-Private-Group-Id=20']]),
      q: 'Que se passe-t-il sur le switch après la trame 81 ?', opts: [O('Il redémarre'), O('Il ouvre le port du poste authentifié et le place dans le VLAN 20 (VLAN dynamique)', true), O('Il bloque le poste'), O('Il envoie une adresse IP')], ok: '802.1X : Access-Accept, et l’authorization peut imposer le VLAN.', no: 'Access-Accept = port ouvert ; l’attribut Tunnel-Private-Group-Id donne le VLAN à appliquer.', href: '/pages/radius-8021x', course: 'RADIUS & 802.1X' },
    { svg: svgPackets([['90', '192.168.10.50', '192.168.10.11', 'DNS', 'Standard query A srv-ad01.miyukini.lan'], ['91', '192.168.10.11', '192.168.10.50', 'DNS', 'Standard response, No such name']]),
      q: 'Le poste interroge 192.168.10.11 (OPNsense) pour un nom du domaine AD et n’obtient rien. Conséquence probable ?', opts: [O('Aucune'), O('Jonction au domaine et ouverture de session échouent : les postes du domaine doivent utiliser le DNS du contrôleur', true), O('Internet ne marche plus'), O('Le DHCP tombe')], ok: 'Le DC publie les enregistrements SRV (_ldap, _kerberos…) ; le DHCP doit distribuer son adresse comme DNS.', no: 'Les postes membres du domaine doivent avoir le contrôleur de domaine comme DNS, pas le pare-feu.', href: '/pages/opnsense-services', course: 'OPNsense : DHCP et DNS' },
  ],
};

/* Switch multicouche (SVI) : routage inter-VLAN sans routeur.
 *
 * L'atelier suppose partout qu'un ROUTEUR fait le routage inter-VLAN — un lien
 * trunk, une sous-interface par VLAN. C'est le « routeur sur un bâton ».
 *
 * Ce module ajoute l'autre méthode, celle des maquettes d'entreprise et du TP
 * VLAN 3 : un switch multicouche route lui-même, chaque VLAN reçoit une SVI
 * (Switched Virtual Interface), et plusieurs switches d'accès se répartissent
 * les postes. Rien de commun avec le reste du moteur — d'où ce fichier à part.
 *
 * Il ne connaît ni React ni le DOM : il transforme une description en textes de
 * configuration et en tableaux. C'est ce qui le rend éprouvable.
 */

/** Un switch d'accès : un nom, les VLAN qu'il porte, et combien de ports il a. */
export interface AccessSwitch {
  id: string;
  name: string;
  /** Les VLAN présents sur ce switch, dans l'ordre où on veut les ports. */
  vlans: number[];
  /** Nombre de ports d'accès du modèle (24 sur un 2960 courant). */
  ports: number;
  /** Le port de CE switch qui remonte vers le multicouche. */
  uplink: number;
  /**
   * Le port du MULTICOUCHE ou ce lien arrive.
   *
   * Distinct de `uplink`, et c'est une correction : la premiere version
   * reutilisait le meme numero des deux cotes. Dans la vraie maquette du TP, les
   * switches d'acces remontent par leur port 23 ou 24 tandis que le multicouche
   * les recoit sur ses ports 1, 2 et 3 — la configuration generee visait donc
   * des interfaces inexistantes.
   */
  portMls: number;
  /**
   * Ce vers quoi ce switch remonte : l'id d'un **multicouche** ou d'un **autre
   * switch d'acces**.
   *
   * La cascade est le cas courant des le deuxieme etage d'un batiment : on ne
   * tire pas un cable jusqu'au local technique pour chaque switch. Elle impose
   * une regle que personne n'applique spontanement — voir `vlansTransportes`.
   */
  mlsId: string;
  /**
   * Affectation explicite des ports. Vide = repartition automatique.
   *
   * Sur une maquette reelle le cablage est deja fait : les ports ne se
   * choisissent pas, ils se constatent. Et le dossier technique du TP demande
   * une decision, pas un calcul.
   */
  ports_?: AffectationPort[];
}

/** Un VLAN du plan : ce que le dossier technique appelle une ligne de tableau. */
export interface VlanDef {
  id: number;
  /** Nom court, en majuscules — celui qui part dans `name` sur l'équipement. */
  name: string;
  /** Identifiant de sous-réseau, ex. `192.168.10.0`. */
  reseau: string;
  /** Masque en notation courte, ex. `24`. */
  cidr: number;
  /** Dernière adresse utilisable, portée par la SVI. Vide = pas de passerelle. */
  passerelle: string;
  /** Un relais DHCP est-il posé sur la SVI de ce VLAN ? */
  dhcp: boolean;
}

/**
 * Un switch multicouche.
 *
 * Chaque VLAN a **une** passerelle : sa SVI vit donc sur un seul de ces
 * switches. Deux multicouches portant la SVI du même VLAN avec la même adresse
 * produiraient deux passerelles pour un réseau — les postes en joindraient une
 * au hasard, et le dépannage serait interminable. C'est ce que
 * `verifierMulticouches` refuse de laisser passer.
 *
 * Faire porter le même VLAN par deux switches se fait, mais avec un protocole
 * de redondance (HSRP, VRRP) qui leur donne une adresse virtuelle commune —
 * hors sujet ici, et surtout hors du TP.
 */
export interface Multicouche {
  id: string;
  nom: string;
  /** Prefixe de ses interfaces : depend du modele. */
  prefixe: string;
  /** Les VLAN dont il porte la SVI. Vide = tous ceux qui restent. */
  vlans: number[];
}

export interface MlsPlan {
  /** Les switches multicouches. Au moins un. */
  multicouches: Multicouche[];
  vlans: VlanDef[];
  acces: AccessSwitch[];
  /** Serveur DHCP joint par `ip helper-address`. Vide = pas de relais. */
  dhcpServer: string;
  /** VLAN natif des trunks. Jamais 1, jamais un VLAN de données. `0` = aucun. */
  natif: number;
}

/** Ce qu'expose un 3560 de Packet Tracer : le cas courant en salle. */
export const PREFIXE_3560 = 'FastEthernet0/';
/** Ce qu'expose un modele empilable (3650, 9200...). */
export const PREFIXE_EMPILE = 'GigabitEthernet1/0/';

/** Une ligne du dossier technique, telle que le TP la demande. */
export interface DossierRow {
  vlan: number;
  nom: string;
  idsr: string;
  msr: number;
  /** Ports d'accès (untag), ex. `1-10`. Vide si le VLAN ne fait que transiter. */
  untag: string;
  /** Ports trunk (tag), ex. `24`. */
  tag: string;
}

export interface DossierTable {
  switchName: string;
  rows: DossierRow[];
}

/** Les ports d'accès attribués à un VLAN sur un switch.
 *
 * Une **liste de plages**, et non une seule : quand l'uplink tombe au milieu du
 * switch, les ports d'un VLAN se retrouvent de part et d'autre. Prétendre le
 * contraire produirait une plage qui englobe le trunk.
 */
export interface PortAlloc {
  vlan: number;
  ranges: { debut: number; fin: number }[];
}

/** Le VLAN natif par défaut. Choisi hors des plages usuelles de données. */
export const NATIF_PAR_DEFAUT = 999;

/** Ports d'un 2960 courant. */
export const PORTS_PAR_DEFAUT = 24;

/** Écrit une plage de ports : `1` seul, `1-10` sinon. */
export function plagePorts(debut: number, fin: number): string {
  return debut === fin ? String(debut) : `${debut}-${fin}`;
}

/**
 * Répartit les ports d'accès d'un switch entre ses VLAN.
 *
 * À parts égales, le reste allant aux premiers : c'est ce que fait un formateur
 * au tableau, et ça donne les plages rondes du TP (1-10, 11-20) plutôt que des
 * bornes calculées au prorata que personne ne saurait justifier.
 *
 * L'uplink est **exclu** : un port qui monte vers le switch multicouche ne peut
 * pas être en même temps un port d'accès. L'oublier donnait un trunk qui écrase
 * le dernier port d'accès, panne longue à trouver parce que tout le reste marche.
 */
export function repartirPorts(sw: AccessSwitch): PortAlloc[] {
  // On part de la liste des ports **réellement disponibles**, l'uplink retiré.
  // La première version calculait des bornes et tentait de contourner l'uplink
  // en étendant la plage : sur un uplink au milieu (port 23 d'un 24 ports), la
  // plage l'englobait au lieu de l'éviter. Un trunk qui écrase un port d'accès
  // ne se voit pas — tout le reste marche.
  const dispo: number[] = [];
  for (let p = 1; p <= sw.ports; p++) if (p !== sw.uplink) dispo.push(p);
  if (!sw.vlans.length || !dispo.length) return [];

  const base = Math.floor(dispo.length / sw.vlans.length);
  const reste = dispo.length % sw.vlans.length;

  const out: PortAlloc[] = [];
  let i = 0;
  sw.vlans.forEach((vlan, k) => {
    const n = base + (k < reste ? 1 : 0);
    if (n <= 0) return;
    out.push({ vlan, ranges: enPlages(dispo.slice(i, i + n)) });
    i += n;
  });
  return out;
}

/** Regroupe des numéros de ports en plages contiguës : `[17,18,19,21]` → `17-19`, `21`. */
function enPlages(ports: number[]): { debut: number; fin: number }[] {
  const out: { debut: number; fin: number }[] = [];
  for (const p of ports) {
    const dernier = out[out.length - 1];
    if (dernier && p === dernier.fin + 1) dernier.fin = p;
    else out.push({ debut: p, fin: p });
  }
  return out;
}

/** Les plages d'un VLAN, telles qu'on les écrit dans le dossier : `17-22,24`. */
export function texteDesPlages(ranges: { debut: number; fin: number }[]): string {
  return ranges.map(r => plagePorts(r.debut, r.fin)).join(',');
}

const ligne = (...l: (string | false | null | undefined)[]) => l.filter(Boolean).join('\n');

/** Les VLAN dont ce multicouche porte la SVI. */
export function vlansDe(plan: MlsPlan, mls: Multicouche): VlanDef[] {
  // Une liste vide veut dire « tous ceux que personne d'autre ne prend » : c'est
  // le cas courant a un seul multicouche, et ca evite de tout cocher pour rien.
  if (mls.vlans.length) return plan.vlans.filter(v => mls.vlans.includes(v.id));
  const pris = new Set(plan.multicouches.filter(m => m.id !== mls.id).flatMap(m => m.vlans));
  return plan.vlans.filter(v => !pris.has(v.id));
}

/** Les switches qui remontent directement vers cet equipement. */
export function enfantsDe(plan: MlsPlan, id: string): AccessSwitch[] {
  return plan.acces.filter(a => a.mlsId === id);
}

/**
 * Tous les VLAN qui doivent traverser le lien montant de ce switch.
 *
 * Les siens, **plus ceux de tout ce qui est en dessous**. C'est la regle que la
 * cascade impose et que personne n'applique spontanement : on configure le
 * trunk du switch du deuxieme etage avec ses propres VLAN, on oublie que le
 * switch du premier doit les laisser passer, et le deuxieme etage se retrouve
 * isole. La panne ressemble a un probleme de cablage.
 */
export function vlansTransportes(plan: MlsPlan, sw: AccessSwitch, vus = new Set<string>()): number[] {
  if (vus.has(sw.id)) return [];        // boucle : on s'arrete plutot que de tourner
  vus.add(sw.id);
  const tout = new Set<number>(sw.vlans);
  for (const enfant of enfantsDe(plan, sw.id)) {
    for (const v of vlansTransportes(plan, enfant, vus)) tout.add(v);
  }
  return [...tout].sort((a, b) => a - b);
}

/** Le multicouche qui route ce switch, en remontant la cascade. */
export function mlsDe(plan: MlsPlan, sw: AccessSwitch): Multicouche | null {
  const vus = new Set<string>();
  let courant: AccessSwitch | undefined = sw;
  while (courant && !vus.has(courant.id)) {
    vus.add(courant.id);
    const m = plan.multicouches.find(x => x.id === courant!.mlsId);
    if (m) return m;
    courant = plan.acces.find(a => a.id === courant!.mlsId);
  }
  return null;
}

/** Les switches d'acces rattaches a ce multicouche, cascade comprise. */
export function accesDe(plan: MlsPlan, mls: Multicouche): AccessSwitch[] {
  return plan.acces.filter(a => mlsDe(plan, a)?.id === mls.id);
}

/** Ce qui rend une maquette a plusieurs multicouches incoherente. */
export interface Incoherence { quoi: string; effet: string }

/**
 * Verifie la repartition des VLAN et des switches.
 *
 * Trois defauts possibles, et aucun ne se signale a l'usage autrement que par
 * une panne difficile : un VLAN sans passerelle, un VLAN a deux passerelles, et
 * un switch d'acces rattache a rien.
 */
export function verifierMulticouches(plan: MlsPlan): Incoherence[] {
  const out: Incoherence[] = [];
  const porteurs = new Map<number, string[]>();
  for (const m of plan.multicouches) {
    for (const v of vlansDe(plan, m)) {
      porteurs.set(v.id, [...(porteurs.get(v.id) ?? []), m.nom]);
    }
  }
  for (const v of plan.vlans) {
    const qui = porteurs.get(v.id) ?? [];
    if (qui.length === 0) {
      out.push({
        quoi: `Le VLAN ${v.id} ${v.name} n'a de SVI nulle part`,
        effet: 'Ses postes communiqueront entre eux et avec personne d\'autre : aucune passerelle ne repond.',
      });
    } else if (qui.length > 1) {
      out.push({
        quoi: `Le VLAN ${v.id} ${v.name} a une SVI sur ${qui.join(' et ')}`,
        effet: `Deux passerelles pour ${v.reseau} : les postes en joindront une au hasard. Il faut soit n'en garder qu'une, soit un protocole de redondance (HSRP, VRRP).`,
      });
    }
  }
  for (const a of plan.acces) {
    const cible = plan.multicouches.some(m => m.id === a.mlsId) || plan.acces.some(x => x.id === a.mlsId);
    if (!cible) {
      out.push({
        quoi: `${a.name} n'est raccorde a rien`,
        effet: 'Son lien montant ne mene nulle part : ses VLAN resteront isoles.',
      });
      continue;
    }
    if (!mlsDe(plan, a)) {
      // Soit la chaine tourne en rond, soit elle n'atteint aucun multicouche.
      const boucle = new Set<string>();
      let cur: AccessSwitch | undefined = a;
      let cycle = false;
      while (cur) {
        if (boucle.has(cur.id)) { cycle = true; break; }
        boucle.add(cur.id);
        cur = plan.acces.find(x => x.id === cur!.mlsId);
      }
      out.push({
        quoi: cycle
          ? `La cascade qui part de ${a.name} tourne en rond`
          : `${a.name} ne remonte vers aucun multicouche`,
        effet: cycle
          ? 'Deux switches se designent mutuellement : sans spanning-tree, une boucle sature le reseau en quelques secondes.'
          : 'Sa chaine de trunks n\'aboutit a aucune passerelle : ses VLAN communiqueront entre eux et nulle part ailleurs.',
      });
    }
  }
  return out;
}

/**
 * La configuration du switch multicouche.
 *
 * L'ordre n'est pas cosmétique : les VLAN doivent exister avant les SVI, et
 * `ip routing` avant que quoi que ce soit ne route. Un switch multicouche sort
 * d'usine en commutation seule.
 */
export function configMls(plan: MlsPlan, mls: Multicouche = plan.multicouches[0]!): string {
  const vlans = [...vlansDe(plan, mls)].sort((a, b) => a.id - b.id);
  const tous = vlans.map(v => v.id).join(',');
  const acces = enfantsDe(plan, mls.id);

  const l: string[] = ['enable', 'configure terminal', `hostname ${mls.nom}`, '!'];

  l.push('! --- Le routage : sans cette ligne, rien ne passe entre VLAN ---', 'ip routing', '!');

  l.push('! --- Les VLAN ---');
  for (const v of vlans) l.push(`vlan ${v.id}`, ` name ${v.name}`);
  if (plan.natif && !vlans.some(v => v.id === plan.natif)) {
    l.push(`vlan ${plan.natif}`, ' name NATIF-INUTILISE');
  }
  l.push('exit', '!');

  l.push('! --- Une SVI par VLAN : elle porte la passerelle ---');
  for (const v of vlans) {
    if (!v.passerelle) continue;
    l.push(`interface vlan ${v.id}`, ` ip address ${v.passerelle} ${masqueLong(v.cidr)}`);
    // Le relais DHCP se pose sur la SVI, pas sur le serveur : c'est elle qui
    // voit passer la diffusion du client et sait vers qui la relayer.
    if (v.dhcp && plan.dhcpServer) l.push(` ip helper-address ${plan.dhcpServer}`);
    l.push(' no shutdown', ' exit');
  }
  l.push('!');

  const liens = acces.map(s => s.portMls).filter(n => n >= 1);
  if (liens.length) {
    l.push('! --- Les liens vers les switches d\'acces ---');
    for (const sw of acces) {
      l.push(
        `interface ${mls.prefixe}${sw.portMls}`,
        ` description Trunk 802.1Q vers ${sw.name}`,
        ' switchport trunk encapsulation dot1q',
        ' switchport mode trunk',
        ` switchport trunk allowed vlan ${sw.vlans.length ? [...sw.vlans].sort((a, b) => a - b).join(',') : tous}`,
        plan.natif ? ` switchport trunk native vlan ${plan.natif}` : '',
        ' no shutdown',
        ' exit',
      );
    }
    l.push('!');
  }

  l.push('end', 'write memory');
  return ligne(...l);
}

/** La configuration d'un switch d'accès. */
export function configAcces(sw: AccessSwitch, plan: MlsPlan): string {
  const nomDe = (id: number) => plan.vlans.find(v => v.id === id)?.name || `VLAN${id}`;
  const parts = affectations(plan, sw);
  const l: string[] = ['enable', 'configure terminal', `hostname ${sw.name}`, '!'];

  l.push('! --- Les VLAN doivent exister ici aussi ---');
  for (const v of [...sw.vlans].sort((a, b) => a - b)) l.push(`vlan ${v}`, ` name ${nomDe(v)}`);
  if (plan.natif && !sw.vlans.includes(plan.natif)) l.push(`vlan ${plan.natif}`, ' name NATIF-INUTILISE');
  l.push('exit', '!');

  const acces = parts.filter(a => a.role === 'access');
  if (acces.length) {
    l.push("! --- Les ports des postes ---");
    for (const a of acces) {
      // Une entrée par plage contiguë : un VLAN coupé par un trunk en a deux, et
      // les fondre en une seule ferait passer le trunk en port d'accès.
      for (const r of enPlages(analyserPlage(a.plage))) {
        l.push(
          r.debut === r.fin
            ? `interface FastEthernet0/${r.debut}`
            : `interface range FastEthernet0/${r.debut} - ${r.fin}`,
          ` description ${nomDe(a.vlan ?? 0)}`,
          ' switchport mode access',
          ` switchport access vlan ${a.vlan ?? 1}`,
          // Sans portfast, chaque poste attend une trentaine de secondes que le
          // spanning-tree se décide : le DHCP expire avant, et l'on croit à une
          // panne de serveur.
          ' spanning-tree portfast',
          ' exit',
        );
      }
    }
    l.push('!');
  }

  l.push(
    '! --- Le lien montant ---',
    `interface GigabitEthernet0/${sw.uplink}`,
    ' description Trunk 802.1Q vers ' + (plan.multicouches.find(m => m.id === sw.mlsId)?.nom
      ?? plan.acces.find(a => a.id === sw.mlsId)?.name ?? '<inconnu>'),
    ' switchport mode trunk',
    // Les VLAN de tout ce qui est en dessous, pas seulement les siens : un
    // switch intermediaire qui ne laisse passer que ses propres VLAN isole
    // silencieusement tout l'etage au-dessus de lui.
    ` switchport trunk allowed vlan ${vlansTransportes(plan, sw).join(',')}`,
    plan.natif ? ` switchport trunk native vlan ${plan.natif}` : '',
    ' no shutdown',
    ' exit',
    '!',
  );

  // Les switches raccordés en dessous de celui-ci. Leur trunk transporte, lui
  // aussi, tout ce qui pend plus bas — la règle se propage jusqu'au bout.
  const enfants = enfantsDe(plan, sw.id);
  if (enfants.length) {
    l.push('! --- Les switches raccordes en dessous ---');
    for (const e of enfants) {
      l.push(
        `interface GigabitEthernet0/${e.portMls}`,
        ` description Trunk 802.1Q vers ${e.name}`,
        ' switchport mode trunk',
        ` switchport trunk allowed vlan ${vlansTransportes(plan, e).join(',')}`,
        plan.natif ? ` switchport trunk native vlan ${plan.natif}` : '',
        ' no shutdown',
        ' exit',
      );
    }
    l.push('!');
  }

  l.push('end', 'write memory');
  return ligne(...l);
}

/**
 * Les tableaux du dossier technique, un par switch.
 *
 * C'est la trace écrite que le TP demande avant les commandes : pour chaque
 * switch, quels VLAN, sur quels ports en accès, sur quels ports en trunk.
 * Le remplir oblige à décider avant de taper — c'est là tout son intérêt.
 */
export function dossier(plan: MlsPlan): DossierTable[] {
  const parId = new Map(plan.vlans.map(v => [v.id, v]));

  const tables: DossierTable[] = plan.acces.map(sw => {
    const trunk = portsTrunkDe(plan, sw);
    return {
      switchName: sw.name,
      rows: [...sw.vlans].sort((a, b) => a - b).map(id => {
        const v = parId.get(id);
        return {
          vlan: id,
          nom: v?.name || `VLAN${id}`,
          idsr: v?.reseau || '—',
          msr: v?.cidr ?? 0,
          untag: portsAccesDe(plan, sw, id),
          tag: trunk,
        };
      }),
    };
  });

  // Les switches multicouches : aucun port d'accès, tout est en trunk. Chacun
  // ne liste que les VLAN dont il porte la SVI — un tableau qui montrerait tous
  // les VLAN sur chaque switch effacerait justement la répartition qu'on décrit.
  for (const mls of plan.multicouches) {
    const liens = accesDe(plan, mls).map(s => s.portMls).sort((a, b) => a - b).join(',');
    tables.push({
      switchName: mls.nom,
      rows: [...vlansDe(plan, mls)].sort((a, b) => a.id - b.id).map(v => ({
        vlan: v.id,
        nom: v.name,
        idsr: v.reseau,
        msr: v.cidr,
        untag: '',
        tag: liens,
      })),
    });
  }

  return tables;
}

/** Masque long à partir du préfixe : `24` → `255.255.255.0`. */
export function masqueLong(cidr: number): string {
  const n = Math.max(0, Math.min(32, Math.floor(cidr)));
  const m = n === 0 ? 0 : (0xffffffff << (32 - n)) >>> 0;
  return [(m >>> 24) & 255, (m >>> 16) & 255, (m >>> 8) & 255, m & 255].join('.');
}

/**
 * Les vérifications à taper après coup, dans l'ordre où elles éliminent une cause.
 *
 * L'ordre compte plus que la liste : chaque commande répond à une question, et
 * tester au hasard fait perdre plus de temps que de descendre les couches.
 */
export function verifications(plan: MlsPlan): { titre: string; lignes: string[] }[] {
  const premier = [...plan.vlans].sort((a, b) => a.id - b.id)[0];
  return [
    {
      titre: plan.multicouches.length > 1
        ? `Sur chaque multicouche (${plan.multicouches.map(m => m.nom).join(", ")})`
        : `Sur ${plan.multicouches[0]?.nom ?? "le multicouche"}`,
      lignes: [
        'show vlan brief                  ! les VLAN existent',
        'show ip interface brief          ! les SVI sont up/up',
        'show ip route                    ! une ligne C par reseau : le routage est actif',
        'show running-config | include ip routing',
        'show interfaces trunk            ! les VLAN passent bien vers chaque switch',
      ],
    },
    {
      titre: 'Sur chaque switch d\'acces',
      lignes: [
        'show vlan brief                  ! le port du poste est dans le bon VLAN',
        'show interfaces trunk            ! le VLAN natif est identique des deux cotes',
      ],
    },
    {
      titre: 'Depuis un poste',
      lignes: [
        `ipconfig /all                    ! une adresse dans le bon reseau${plan.dhcpServer ? ' (via le relais DHCP)' : ''}`,
        premier?.passerelle ? `ping ${premier.passerelle}             ! d'abord sa propre passerelle` : 'ping <sa passerelle>',
        'ping <un poste d\'un autre VLAN>  ! ensuite le routage inter-VLAN',
      ],
    },
  ];
}

/**
 * Les pannes qu'on rencontre vraiment sur cette maquette, dans l'ordre.
 *
 * Chacune vient d'une erreur réelle et non d'une liste théorique : ce sont
 * celles où la configuration *semble* juste et où rien ne passe.
 */
export const PANNES: { symptome: string; cause: string; verif: string }[] = [
  { symptome: 'Tout semble configuré, aucun VLAN ne communique', cause: '`ip routing` oublié sur le switch multicouche', verif: 'show running-config | include ip routing' },
  { symptome: 'Une SVI reste down/down', cause: 'aucun port actif dans ce VLAN, ou VLAN absent de la base', verif: 'show vlan brief' },
  { symptome: 'Le passage en trunk est refusé', cause: '`switchport trunk encapsulation dot1q` non posé avant', verif: 'show interfaces <port> switchport' },
  { symptome: 'Les postes n’obtiennent pas d’adresse', cause: '`ip helper-address` absent de la SVI, ou serveur DHCP injoignable', verif: 'show running-config interface vlan <id>' },
  { symptome: 'Un VLAN passe, un autre non', cause: 'VLAN absent de `allowed vlan` sur un des deux bouts du trunk', verif: 'show interfaces trunk' },
  { symptome: 'Le poste attend puis renonce', cause: '`spanning-tree portfast` absent : le DHCP expire avant l’ouverture du port', verif: 'show spanning-tree interface <port> portfast' },
];

/* ─────────────────────────── Sortie Internet ───────────────────────────
 *
 * Le « pour aller plus loin » du TP : un pare-feu entre le switch multicouche
 * et le FAI, qui traduit les adresses privées (NAT surchargé / PAT).
 *
 * Trois équipements, trois rôles, et une erreur qui revient à chaque fois :
 *
 *   postes ──▶ MLS (route entre VLAN) ──▶ pare-feu (traduit) ──▶ FAI
 *
 * Le pare-feu ne connaît **que** le réseau qui le relie au multicouche. Les
 * VLAN internes lui sont inconnus : sans route de retour, il traduit le trafic
 * sortant sans jamais savoir par où renvoyer les réponses. On ping Internet
 * depuis le pare-feu, ça marche ; depuis un poste, rien — et la cause est deux
 * équipements plus loin que là où on cherche.
 */

export interface SortieInternet {
  /** Nom du pare-feu (un routeur, dans Packet Tracer). */
  firewall: string;
  /** Le lien entre le multicouche et le pare-feu. */
  ipMls: string;
  ipFirewall: string;
  lienCidr: number;
  /** Le port du multicouche, passé en **port routé**. */
  portMls: string;
  /** L'interface du pare-feu côté interne, puis côté FAI. */
  ifInside: string;
  ifWan: string;
  ipWan: string;
  cidrWan: number;
  passerelleFai: string;
  /** Publication d'un serveur interne (facultatif) : NAT statique de port. */
  publie?: { ip: string; port: string };
  /**
   * Les VLAN autorisés à sortir. Absent = tous.
   *
   * Tous les VLAN n'ont pas vocation à joindre Internet : dans la maquette du
   * TP, celui des serveurs est délibérément exclu. Un VLAN qui n'est pas dans
   * la liste n'est pas traduit — il continue de joindre les autres VLAN, mais
   * s'arrête au pare-feu. C'est un choix de sécurité, pas un oubli.
   */
  sortants?: number[];
}

/** Masque générique (wildcard) d'un préfixe : `24` → `0.0.0.255`. */
export function wildcard(cidr: number): string {
  const n = Math.max(0, Math.min(32, Math.floor(cidr)));
  const m = n === 0 ? 0xffffffff : (~((0xffffffff << (32 - n)) >>> 0)) >>> 0;
  return [(m >>> 24) & 255, (m >>> 16) & 255, (m >>> 8) & 255, m & 255].join('.');
}

/**
 * Côté multicouche : un port routé vers le pare-feu, et la route par défaut.
 *
 * Un **port routé** (`no switchport`) plutôt qu'un VLAN de transit : c'est un
 * vrai lien point à point, sans VLAN à déclarer des deux côtés ni natif à faire
 * concorder. Un trunk ferait le travail, mais ajouterait un VLAN qui n'existe
 * que pour trois adresses.
 */
export function configSortieMls(plan: MlsPlan, s: SortieInternet): string {
  const l: string[] = ['enable', 'configure terminal', '!'];
  l.push(
    `! --- Le lien vers ${s.firewall} : un port routé, pas un port de commutation ---`,
    `interface ${s.portMls}`,
    ' no switchport',
    ` ip address ${s.ipMls} ${masqueLong(s.lienCidr)}`,
    ' no shutdown',
    ' exit',
    '!',
    '! --- Tout ce qui n\'est pas local part vers le pare-feu ---',
    `ip route 0.0.0.0 0.0.0.0 ${s.ipFirewall}`,
    '!',
    'end',
    'write memory',
  );
  void plan;
  return l.join('\n');
}

/**
 * Côté pare-feu : les deux interfaces, la traduction, et les routes de retour.
 *
 * L'ordre `inside` / `outside` n'est pas décoratif : c'est lui qui dit au
 * routeur quel sens traduire. Les inverser produit un NAT qui ne traduit rien,
 * sans le moindre message.
 */
export function configPareFeu(plan: MlsPlan, s: SortieInternet): string {
  const vlans = [...plan.vlans].sort((a, b) => a.id - b.id);
  const l: string[] = ['enable', 'configure terminal', `hostname ${s.firewall}`, '!'];

  l.push(
    '! --- Côté interne : vers le switch multicouche ---',
    `interface ${s.ifInside}`,
    ` ip address ${s.ipFirewall} ${masqueLong(s.lienCidr)}`,
    ' ip nat inside',
    ' no shutdown',
    ' exit',
    '!',
    '! --- Côté FAI ---',
    `interface ${s.ifWan}`,
    ` ip address ${s.ipWan} ${masqueLong(s.cidrWan)}`,
    ' ip nat outside',
    ' no shutdown',
    ' exit',
    '!',
  );

  const sortants = s.sortants ? vlans.filter(v => s.sortants!.includes(v.id)) : vlans;
  const retenus = vlans.filter(v => !sortants.includes(v));
  l.push('! --- Les réseaux autorisés à sortir ---', 'ip access-list standard NAT-LAN');
  for (const v of sortants) l.push(` permit ${v.reseau} ${wildcard(v.cidr)}`);
  l.push(' exit');
  if (retenus.length) {
    // Le dire plutôt que de laisser l'absence parler : un VLAN manquant de la
    // liste ressemble à un oubli, et quelqu'un finira par « corriger » le choix.
    l.push(`! Volontairement absents : ${retenus.map(v => `VLAN ${v.id} ${v.name}`).join(', ')}`);
    l.push('! Ils joignent les autres VLAN, mais ne sortent pas.');
  }
  l.push('!');

  l.push(
    '! --- NAT surchargé (PAT) : tout le monde sort par l\'adresse du WAN ---',
    `ip nat inside source list NAT-LAN interface ${s.ifWan} overload`,
    '!',
  );

  if (s.publie?.ip && s.publie.port) {
    l.push(
      '! --- Publication d\'un serveur interne ---',
      `ip nat inside source static tcp ${s.publie.ip} ${s.publie.port} interface ${s.ifWan} ${s.publie.port}`,
      '!',
    );
  }

  l.push('! --- La sortie vers le FAI ---', `ip route 0.0.0.0 0.0.0.0 ${s.passerelleFai}`, '!');

  l.push(
    '! --- LES ROUTES DE RETOUR : sans elles, rien ne revient aux postes ---',
    `! Le pare-feu ne connaît que le lien ${s.ipMls}/${s.lienCidr}. Les VLAN`,
    `! internes sont derrière ${plan.multicouches.map(m => m.nom).join(" / ")}, il faut le lui dire.`,
  );
  for (const v of vlans) l.push(`ip route ${v.reseau} ${masqueLong(v.cidr)} ${s.ipMls}`);
  l.push('!', 'end', 'write memory');

  return l.join('\n');
}

/** Ce que `show ip nat translations` montrera — de quoi remplir le dossier. */
export function tableNat(plan: MlsPlan, s: SortieInternet): { proto: string; interne: string; traduit: string; note: string }[] {
  const rows = plan.vlans
    .filter(v => v.passerelle && (!s.sortants || s.sortants.includes(v.id)))
    .map(v => ({
      proto: 'any',
      interne: `${v.reseau}/${v.cidr}`,
      traduit: s.ipWan,
      note: `VLAN ${v.id} ${v.name} — sortie par surcharge de port`,
    }));
  if (s.publie?.ip && s.publie.port) {
    rows.push({
      proto: 'tcp',
      interne: `${s.publie.ip}:${s.publie.port}`,
      traduit: `${s.ipWan}:${s.publie.port}`,
      note: 'publication entrante (NAT statique de port)',
    });
  }
  return rows;
}

/** Les pannes propres à la sortie Internet, dans l'ordre où on les rencontre. */
export const PANNES_INTERNET: { symptome: string; cause: string; verif: string }[] = [
  { symptome: 'Le pare-feu ping Internet, pas les postes', cause: 'routes de retour absentes : il ignore où sont les VLAN', verif: 'show ip route' },
  { symptome: 'Rien ne sort d’aucun VLAN', cause: 'route par défaut absente sur le multicouche', verif: 'show ip route (sur le multicouche)' },
  { symptome: 'La traduction ne se déclenche jamais', cause: '`ip nat inside` / `outside` posés sur les mauvaises interfaces', verif: 'show ip nat statistics' },
  { symptome: 'Un VLAN sort, un autre non', cause: 'réseau absent de la liste d’accès NAT-LAN', verif: 'show access-lists' },
  { symptome: 'Le nom du site ne résout pas, l’IP répond', cause: 'DNS non distribué par le DHCP', verif: 'ipconfig /all sur le poste' },
];

/* ─────────────────────── L'accès des clients au dehors ───────────────────────
 *
 * Le routage, la traduction et les routes de retour ne suffisent pas : un poste
 * qui n'a ni passerelle ni DNS ne va nulle part, et l'on cherche la panne dans
 * le pare-feu alors qu'elle est dans l'étendue DHCP.
 *
 * La chaîne complète, du poste au site :
 *
 *   adresse + masque ─▶ passerelle (la SVI) ─▶ route par défaut du MLS
 *     ─▶ traduction du pare-feu ─▶ route du FAI ─▶ le site
 *                    et, en parallèle : la résolution du nom
 *
 * Chaque maillon a son test, et c'est l'ordre qui dit lequel manque.
 */

export interface AccesClients {
  /** Serveur DNS distribué aux postes. Sans lui, seule l'IP répond. */
  dns: string;
  /** Suffixe DNS distribué. */
  domaine: string;
  /** Durée du bail, en jours. */
  bailJours: number;
  /** Le site que les postes doivent joindre — celui de l'exemple du TP. */
  site?: { nom: string; ip: string };
}

/** Une étendue DHCP, telle qu'on la saisit sur le serveur ou sur l'IOS. */
export interface Etendue {
  vlan: number;
  nom: string;
  reseau: string;
  masque: string;
  passerelle: string;
  dns: string;
  domaine: string;
  debut: string;
  fin: string;
  bailJours: number;
}

const enNombre = (ip: string): number | null => {
  const p = ip.trim().split('.');
  if (p.length !== 4) return null;
  let n = 0;
  for (const x of p) {
    const v = Number(x);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = (n << 8) | v;
  }
  return n >>> 0;
};
const enTexte = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');

/**
 * Les étendues DHCP, une par VLAN qui en demande.
 *
 * La plage laisse le bas du réseau aux adresses fixes (serveurs, imprimantes)
 * et s'arrête avant la passerelle, qui occupe le haut. Distribuer une adresse
 * déjà prise donne un conflit que le poste signale mal.
 */
export function etendues(plan: MlsPlan, a: AccesClients): Etendue[] {
  return plan.vlans.filter(v => v.dhcp && v.passerelle).map(v => {
    const net = enNombre(v.reseau);
    const gw = enNombre(v.passerelle);
    const taille = 2 ** (32 - v.cidr);
    const premier = net === null ? null : net + 1;
    const dernier = net === null ? null : net + taille - 2;
    const fin = gw !== null && dernier !== null && gw <= dernier ? Math.min(dernier, gw - 1) : dernier;
    // Dix adresses réservées en bas, sauf si le réseau est trop petit pour ça.
    const reserve = taille > 16 ? 9 : 0;
    const debut = premier !== null ? premier + reserve : null;
    return {
      vlan: v.id,
      nom: `POOL-${v.name}`,
      reseau: v.reseau,
      masque: masqueLong(v.cidr),
      passerelle: v.passerelle,
      dns: a.dns,
      domaine: a.domaine,
      debut: debut !== null && fin !== null && debut <= fin ? enTexte(debut) : '—',
      fin: fin !== null && fin > 0 ? enTexte(fin) : '—',
      bailJours: a.bailJours,
    };
  });
}

/**
 * Variante : les étendues portées par le switch multicouche lui-même.
 *
 * Le TP passe par un serveur et un relais, ce qui est la bonne pratique en
 * entreprise. Mais un multicouche sait distribuer les adresses tout seul, et
 * c'est un équipement de moins — utile pour savoir si le reste fonctionne
 * quand le serveur, lui, ne répond pas.
 */
export function configDhcpSurMls(plan: MlsPlan, a: AccesClients): string {
  const list = etendues(plan, a);
  if (!list.length) return '! Aucun VLAN ne demande le DHCP.';

  const l: string[] = ['enable', 'configure terminal', '!'];
  l.push('! --- Ce qui ne doit jamais etre distribue ---');
  for (const e of list) {
    if (e.debut !== '—') l.push(`ip dhcp excluded-address ${e.reseau} ${e.debut}`);
    l.push(`ip dhcp excluded-address ${e.passerelle}`);
  }
  l.push('!');

  for (const e of list) {
    l.push(
      `ip dhcp pool ${e.nom}`,
      ` network ${e.reseau} ${e.masque}`,
      // Sans cette ligne, le poste obtient une adresse et ne sort pas de son VLAN.
      ` default-router ${e.passerelle}`,
    );
    if (a.dns) l.push(` dns-server ${a.dns}`);
    if (a.domaine) l.push(` domain-name ${a.domaine}`);
    l.push(` lease ${a.bailJours} 0 0`, ' exit');
  }
  l.push('!', 'end', 'write memory');
  return l.join('\n');
}

/**
 * La résolution de noms, sur les équipements eux-mêmes.
 *
 * Distincte de celle des postes : un `ping www…` depuis le multicouche échoue
 * tant que l'équipement ne connaît pas de serveur DNS, même quand les postes,
 * eux, résolvent parfaitement. C'est un faux symptôme convaincant quand on
 * teste depuis la console, et une question d'examen classique.
 */
export function configResolution(a: AccesClients): string {
  const l: string[] = ['enable', 'configure terminal', '!', 'ip domain-lookup'];
  if (a.dns) l.push(`ip name-server ${a.dns}`);
  if (a.domaine) l.push(`ip domain-name ${a.domaine}`);
  if (a.site?.nom && a.site.ip) {
    l.push('!', "! Raccourci local, tant que le DNS n'est pas en place :", `ip host ${a.site.nom} ${a.site.ip}`);
  }
  l.push('!', 'end', 'write memory');
  return l.join('\n');
}

/**
 * Les tests depuis un poste, dans l'ordre où chacun élimine un maillon.
 *
 * L'ordre est tout : chaque ligne qui passe innocente une partie de la chaîne.
 * Tester le nom du site en premier ne dit rien — l'échec peut venir de six
 * endroits différents.
 */
export function verificationsClient(
  plan: MlsPlan,
  a: AccesClients,
  s?: SortieInternet,
): { titre: string; lignes: string[] }[] {
  const premier = plan.vlans.find(v => v.dhcp && v.passerelle) ?? plan.vlans[0];
  const site = a.site;
  const passerelle = premier?.passerelle || '<la SVI du VLAN>';
  return [
    {
      titre: '1. Le poste a-t-il de quoi partir ?',
      lignes: [
        'ipconfig /all',
        '  -> une adresse dans le bon reseau',
        `  -> une passerelle : ${passerelle}`,
        `  -> un serveur DNS : ${a.dns || "<manquant : seule l'IP repondra>"}`,
      ],
    },
    {
      titre: '2. Sort-il de son VLAN ?',
      lignes: [
        `ping ${passerelle}`,
        '  -> echec : la SVI est down, ou la passerelle distribuee est fausse',
        'ping <un poste d\'un autre VLAN>',
        '  -> echec : "ip routing" manque sur le multicouche',
      ],
    },
    {
      titre: "3. Sort-il de l'entreprise ?",
      lignes: [
        s ? `ping ${s.passerelleFai}` : 'ping <passerelle du FAI>',
        '  -> echec : route par defaut du multicouche, ou NAT du pare-feu',
        site ? `ping ${site.ip}` : 'ping <IP du site>',
        "  -> si ca passe ICI mais pas par le nom : c'est le DNS, rien d'autre",
      ],
    },
    {
      titre: '4. Le nom se resout-il ?',
      lignes: [
        site ? `nslookup ${site.nom}` : 'nslookup <nom du site>',
        site ? `ping ${site.nom}` : 'ping <nom du site>',
        '  -> echec ici seul : enregistrement absent du serveur DNS',
      ],
    },
  ];
}

/** Les pannes vues du poste, celles qui font chercher au mauvais endroit. */
export const PANNES_CLIENT: { symptome: string; cause: string; verif: string }[] = [
  { symptome: 'Aucune adresse, ou une adresse en 169.254.x.x', cause: 'relais `ip helper-address` absent de la SVI, ou serveur DHCP injoignable', verif: 'ipconfig /all' },
  { symptome: 'Une adresse, mais rien ne sort du VLAN', cause: '`default-router` absent de l’étendue : le poste n’a pas de passerelle', verif: 'ipconfig /all' },
  { symptome: 'L’IP du site répond, le nom non', cause: 'DNS non distribué, ou enregistrement absent du serveur', verif: 'nslookup <nom>' },
  { symptome: 'Un poste sort, un autre non', cause: 'plage DHCP épuisée, ou conflit avec une adresse fixe non exclue', verif: 'show ip dhcp binding' },
  { symptome: 'Tout marche sauf depuis la console de l’équipement', cause: '`ip name-server` absent : l’équipement ne résout pas, les postes si', verif: 'ping <nom> depuis le multicouche' },
];

/* ─────────────────────── Le réseau externe simulé ───────────────────────
 *
 * En maquette, « Internet » est un routeur et un serveur qu'on pose soi-même.
 * C'est commode, et c'est là que se produit l'erreur la plus coûteuse du TP :
 * réutiliser de l'autre côté du pare-feu un réseau déjà employé à l'intérieur.
 *
 * Le symptôme est déroutant. Le poste demande l'adresse du site ; le switch
 * multicouche voit ce réseau parmi ses réseaux **connectés**, livre localement,
 * et le paquet ne sort jamais. Aucune règle de NAT n'y changera rien — la
 * décision est prise deux équipements avant, sur une table de routage qui a
 * raison.
 *
 * D'où `chevauchements()` : la vérification qui aurait fait gagner la soirée.
 */

export interface ReseauExterne {
  /** Le routeur du réseau externe (« Router1 » dans la maquette du TP). */
  routeur: string;
  /** Son interface côté pare-feu, et celle côté serveur. */
  ifVersPareFeu: string;
  ifVersSite: string;
  /** Son adresse sur le lien avec le pare-feu. */
  ipVersPareFeu: string;
  /** Le réseau où vit le site, et les adresses. */
  reseauSite: string;
  cidrSite: number;
  ipRouteurSite: string;
  ipSite: string;
  nomSite: string;
}

/** Un chevauchement d'adressage, avec ce qu'il provoque. */
export interface Chevauchement {
  quoi: string;
  interne: string;
  externe: string;
  effet: string;
}

const versNombre = (ip: string): number | null => {
  const p = ip.trim().split('.');
  if (p.length !== 4) return null;
  let n = 0;
  for (const x of p) {
    const v = Number(x);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = ((n << 8) | v) >>> 0;
  }
  return n;
};

const memeReseau = (a: string, cidrA: number, b: string, cidrB: number): boolean => {
  const na = versNombre(a);
  const nb = versNombre(b);
  if (na === null || nb === null) return false;
  const large = Math.min(cidrA, cidrB);
  const m = large === 0 ? 0 : (0xffffffff << (32 - large)) >>> 0;
  return (na & m) === (nb & m);
};

/**
 * Cherche les réseaux employés des deux côtés du pare-feu.
 *
 * Rend une liste vide quand tout va bien. Chaque entrée dit **ce qui se
 * passera**, pas seulement qu'un doublon existe : « deux réseaux identiques »
 * n'aide personne, « le paquet n'atteindra jamais le site » désigne la panne.
 */
export function chevauchements(
  plan: MlsPlan,
  externe: ReseauExterne,
  sortie?: SortieInternet,
): Chevauchement[] {
  const out: Chevauchement[] = [];

  for (const v of plan.vlans) {
    if (memeReseau(v.reseau, v.cidr, externe.reseauSite, externe.cidrSite)) {
      out.push({
        quoi: `Le réseau du site est aussi celui du VLAN ${v.id}`,
        interne: `${v.reseau}/${v.cidr} (VLAN ${v.id} ${v.name})`,
        externe: `${externe.reseauSite}/${externe.cidrSite}`,
        effet: `Un poste qui demande ${externe.ipSite} restera dans son propre VLAN : le multicouche livre localement, le paquet ne sort jamais.`,
      });
    }
  }

  if (sortie) {
    // Le lien multicouche ↔ pare-feu, déduit de l'adresse du port routé.
    if (memeReseau(sortie.ipMls, sortie.lienCidr, externe.reseauSite, externe.cidrSite)) {
      out.push({
        quoi: 'Le réseau du site est aussi celui du lien interne',
        interne: `${sortie.ipMls}/${sortie.lienCidr} (lien multicouche ↔ pare-feu)`,
        externe: `${externe.reseauSite}/${externe.cidrSite}`,
        effet: `Ce réseau est connecté sur le port routé du multicouche : il ne sortira jamais vers ${externe.routeur}.`,
      });
    }
    if (externe.ipSite.trim() === sortie.ipMls.trim()) {
      out.push({
        quoi: 'Le site a exactement l’adresse du port routé du multicouche',
        interne: `${sortie.ipMls} (port routé)`,
        externe: `${externe.ipSite} (le site)`,
        effet: 'Toute demande vers cette adresse atteint le multicouche lui-même. Aucune règle de NAT ne peut le corriger.',
      });
    }
  }

  return out;
}

/**
 * La configuration du routeur externe.
 *
 * Il n'a **rien à traduire** : la traduction se fait au pare-feu, une fois, et
 * une seule. Deux NAT en série cassent les publications entrantes sans rien
 * apporter — c'est l'erreur que la maquette invite à commettre parce que le
 * routeur externe ressemble à un routeur de bordure.
 *
 * Il n'a **pas non plus de route par défaut** vers le pare-feu : les deux
 * routeurs se désigneraient mutuellement, et tout paquet vers une destination
 * qu'aucun ne connaît rebondirait entre eux jusqu'à expiration du TTL.
 */
export function configRouteurExterne(externe: ReseauExterne, sortie: SortieInternet): string {
  const l: string[] = ['enable', 'configure terminal', `hostname ${externe.routeur}`, '!'];
  l.push(
    `! --- Vers ${sortie.firewall} ---`,
    `interface ${externe.ifVersPareFeu}`,
    ` ip address ${externe.ipVersPareFeu} ${masqueLong(sortie.cidrWan)}`,
    ' no shutdown',
    ' exit',
    '!',
    '! --- Vers le site ---',
    `interface ${externe.ifVersSite}`,
    ` ip address ${externe.ipRouteurSite} ${masqueLong(externe.cidrSite)}`,
    ' no shutdown',
    ' exit',
    '!',
    '! Aucun NAT ici : la traduction a lieu une fois, au pare-feu.',
    '! Aucune route par defaut non plus : elle renverrait vers le pare-feu,',
    '! qui renvoie ici — les paquets inconnus tourneraient entre les deux.',
    '! Les deux reseaux sont connectes, il n\'y a rien de plus a router.',
    '!',
    'end',
    'write memory',
  );
  return l.join('\n');
}

/** Ce qu'il faut poser sur le serveur qui joue le site. */
export function ficheSite(externe: ReseauExterne): { champ: string; valeur: string }[] {
  return [
    { champ: 'Adresse IP', valeur: externe.ipSite },
    { champ: 'Masque', valeur: masqueLong(externe.cidrSite) },
    { champ: 'Passerelle', valeur: externe.ipRouteurSite },
    { champ: 'Service HTTP', valeur: 'active' },
    { champ: 'Service DNS', valeur: `${externe.nomSite} → ${externe.ipSite}` },
  ];
}

/* ─────────────────── L'affectation manuelle des ports ───────────────────
 *
 * La répartition automatique donne des plages rondes et sert de point de
 * départ. Mais le dossier technique du TP demande une décision, pas un calcul :
 * « sur quel(s) port(s) avez-vous configuré son access ? son trunk ? ». Et sur
 * une maquette réelle, le câblage est déjà fait — les ports ne se choisissent
 * pas, ils se constatent.
 *
 * Dès qu'un switch déclare des affectations, elles remplacent le calcul. Rien
 * de déclaré = on garde la répartition automatique, qui reste le cas courant.
 */

export interface AffectationPort {
  /** Une plage telle qu'on l'écrit : `1-10`, `24`, ou `1,3-5`. */
  plage: string;
  role: 'access' | 'trunk';
  /** Le VLAN, pour un port d'accès. */
  vlan?: number;
  /** L'équipement d'en face, pour un trunk : id d'un multicouche ou d'un switch. */
  vers?: string;
}

/**
 * Lit une plage de ports.
 *
 * Tolère les formes qu'on écrit vraiment — `1-10`, `1,3-5`, `2 - 4`, avec des
 * espaces — et **ignore ce qui n'a pas de sens** plutôt que de rendre un
 * nombre faux. Un `NaN` glissé dans une liste de ports produirait une commande
 * `interface FastEthernet0/NaN` que l'IOS refuse sans expliquer.
 */
export function analyserPlage(texte: string): number[] {
  const out = new Set<number>();
  for (const morceau of (texte || '').split(',')) {
    const m = morceau.trim();
    if (!m) continue;
    const tiret = m.match(/^(\d+)\s*-\s*(\d+)$/);
    if (tiret) {
      const a = Number(tiret[1]);
      const b = Number(tiret[2]);
      if (a >= 1 && b >= a) for (let p = a; p <= b; p++) out.add(p);
      continue;
    }
    const seul = Number(m);
    if (Number.isInteger(seul) && seul >= 1) out.add(seul);
  }
  return [...out].sort((a, b) => a - b);
}

/** Regroupe des ports en plages lisibles : `[1,2,3,7]` → `1-3,7`. */
export function ecrirePlage(ports: number[]): string {
  return texteDesPlages(enPlages([...new Set(ports)].sort((a, b) => a - b)));
}

/** Les affectations d'un switch, calculées si rien n'est déclaré. */
export function affectations(plan: MlsPlan, sw: AccessSwitch): AffectationPort[] {
  if (sw.ports_?.length) return sw.ports_;

  // Sinon : la répartition automatique, plus le lien montant et les descendants.
  const auto: AffectationPort[] = repartirPorts(sw).map(p => ({
    plage: texteDesPlages(p.ranges),
    role: 'access' as const,
    vlan: p.vlan,
  }));
  auto.push({ plage: String(sw.uplink), role: 'trunk', vers: sw.mlsId });
  for (const e of enfantsDe(plan, sw.id)) {
    auto.push({ plage: String(e.portMls), role: 'trunk', vers: e.id });
  }
  return auto;
}

/** Ce qui rend une affectation de ports incohérente. */
export function verifierPorts(plan: MlsPlan, sw: AccessSwitch): Incoherence[] {
  const out: Incoherence[] = [];
  const liste = affectations(plan, sw);
  const vu = new Map<number, string>();

  for (const a of liste) {
    const ports = analyserPlage(a.plage);
    if (!ports.length) {
      out.push({ quoi: `${sw.name} : « ${a.plage} » ne designe aucun port`, effet: 'Cette ligne ne produira aucune commande.' });
      continue;
    }
    const quoi = a.role === 'access' ? `access VLAN ${a.vlan}` : 'trunk';
    for (const p of ports) {
      if (p > sw.ports) {
        out.push({
          quoi: `${sw.name} : le port ${p} n'existe pas`,
          effet: `Ce switch en declare ${sw.ports}. L'IOS refusera l'interface sans dire laquelle il attendait.`,
        });
        continue;
      }
      const deja = vu.get(p);
      if (deja) {
        out.push({
          quoi: `${sw.name} : le port ${p} est affecte deux fois (${deja}, puis ${quoi})`,
          effet: 'La derniere commande gagne, en silence. Un poste se retrouve dans un VLAN qu\'on ne lui a pas donne.',
        });
      } else {
        vu.set(p, quoi);
      }
    }
    if (a.role === 'access' && !a.vlan) {
      out.push({ quoi: `${sw.name} : des ports d'acces sans VLAN`, effet: 'Ils resteront dans le VLAN 1 par defaut.' });
    }
  }

  for (const v of sw.vlans) {
    const aDesPorts = liste.some(a => a.role === 'access' && a.vlan === v && analyserPlage(a.plage).length);
    if (!aDesPorts) {
      out.push({
        quoi: `${sw.name} : le VLAN ${v} n'a aucun port d'acces`,
        effet: 'Il traversera le switch sans qu\'aucun poste ne puisse s\'y brancher — ce qui est legitime pour un VLAN de transit, et une erreur sinon.',
      });
    }
  }

  if (!liste.some(a => a.role === 'trunk')) {
    out.push({ quoi: `${sw.name} : aucun trunk`, effet: 'Ses VLAN ne sortiront pas du switch.' });
  }
  return out;
}

/** Les ports d'accès d'un VLAN, tels qu'ils seront écrits dans le dossier. */
export function portsAccesDe(plan: MlsPlan, sw: AccessSwitch, vlan: number): string {
  const ports = affectations(plan, sw)
    .filter(a => a.role === 'access' && a.vlan === vlan)
    .flatMap(a => analyserPlage(a.plage));
  return ecrirePlage(ports);
}

/** Les ports trunk d'un switch. */
export function portsTrunkDe(plan: MlsPlan, sw: AccessSwitch): string {
  const ports = affectations(plan, sw)
    .filter(a => a.role === 'trunk')
    .flatMap(a => analyserPlage(a.plage));
  return ecrirePlage(ports);
}

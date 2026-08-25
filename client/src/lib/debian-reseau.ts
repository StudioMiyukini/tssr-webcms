/* Configurateur d'adressage IP pour Debian.
 *
 * Le cours explique la grammaire de `/etc/network/interfaces` ; cet outil
 * l'écrit, et surtout **vérifie ce que le cours signale** — car les fautes qui
 * coûtent une heure ne sont pas des fautes de syntaxe. Une passerelle hors du
 * sous-réseau, une adresse qui est celle du réseau lui-même, un `auto` oublié :
 * le fichier est parfaitement valide, et le réseau ne marche pas.
 *
 * La génération vit ici plutôt que dans le composant : c'est un formulaire qui
 * entre et du texte qui sort, donc quelque chose qui se teste.
 */

export type Methode = 'static' | 'dhcp';
export type Montage = 'auto' | 'allow-hotplug' | 'manuel';

export interface Config {
  /** Nom de l'interface, tel que `ip -br a` l'affiche. */
  iface: string;
  montage: Montage;
  methode: Methode;
  adresse: string;
  cidr: number;
  passerelle: string;
  dns: string;
  domaine: string;
  /** Nom de machine : sert à produire /etc/hostname et /etc/hosts. */
  hostname: string;
  /** Adresses supplémentaires sur la même carte, une par ligne. */
  adressesSup: string;
  /** Routes statiques « réseau/cidr via passerelle », une par ligne. */
  routes: string;
  mtu: string;
  /** Le paquet resolvconf est-il installé ? Décide de la façon de poser le DNS. */
  resolvconf: boolean;
}

export const CONFIG_VIDE: Config = {
  iface: 'ens18', montage: 'auto', methode: 'static',
  adresse: '192.168.10.20', cidr: 24, passerelle: '192.168.10.254',
  dns: '192.168.10.11 1.1.1.1', domaine: 'miyukini.lan', hostname: 'srv-debian',
  adressesSup: '', routes: '', mtu: '', resolvconf: false,
};

/* ── Arithmétique ────────────────────────────────────────────────────────── */

export function versEntier(ip: string): number | null {
  const p = ip.trim().split('.');
  if (p.length !== 4) return null;
  let n = 0;
  for (const x of p) {
    if (!/^\d{1,3}$/.test(x)) return null;
    const v = Number(x);
    if (v > 255) return null;
    n = (n * 256) + v;
  }
  return n >>> 0;
}

export const versTexte = (n: number) =>
  [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');

export const masqueDe = (cidr: number) =>
  cidr === 0 ? 0 : ((0xffffffff << (32 - cidr)) >>> 0);

/** Ce que le plan d'adressage donne, une fois l'adresse et le masque connus. */
export interface Plan {
  reseau: string;
  diffusion: string;
  premiere: string;
  derniere: string;
  masque: string;
  hotes: number;
}

export function plan(adresse: string, cidr: number): Plan | null {
  const a = versEntier(adresse);
  if (a === null || cidr < 0 || cidr > 32) return null;
  const m = masqueDe(cidr);
  const reseau = (a & m) >>> 0;
  const diffusion = (reseau | (~m >>> 0)) >>> 0;
  // Un /31 ou un /32 n'a pas de plage utilisable au sens habituel.
  const utilisables = cidr >= 31 ? 0 : Math.pow(2, 32 - cidr) - 2;
  return {
    reseau: versTexte(reseau),
    diffusion: versTexte(diffusion),
    premiere: versTexte(cidr >= 31 ? reseau : (reseau + 1) >>> 0),
    derniere: versTexte(cidr >= 31 ? diffusion : (diffusion - 1) >>> 0),
    masque: versTexte(m),
    hotes: utilisables,
  };
}

/* ── Vérifications ───────────────────────────────────────────────────────── */

export type Gravite = 'erreur' | 'alerte' | 'conseil';

export interface Souci {
  gravite: Gravite;
  quoi: string;
  /** Ce que ça provoque, pas seulement ce qui est faux. */
  effet: string;
}

export function verifier(c: Config): Souci[] {
  const out: Souci[] = [];
  const dit = (gravite: Gravite, quoi: string, effet: string) => out.push({ gravite, quoi, effet });

  if (!c.iface.trim()) {
    dit('erreur', 'Aucune interface nommée', 'Le fichier ne s’appliquera à rien. `ip -br a` donne le nom réel.');
  } else if (/^eth\d+$/.test(c.iface.trim())) {
    dit('conseil', `« ${c.iface} » est un nom historique`,
      'Les noms modernes décrivent l’emplacement matériel (ens18, enp0s3). Vérifie avec `ip -br a` : configurer eth0 sur une machine qui a ens18 est la faute la plus fréquente.');
  }

  if (c.montage === 'manuel') {
    dit('alerte', 'Ni « auto » ni « allow-hotplug »',
      'L’interface ne sera pas montée au démarrage. `ifup` marchera à la main, et la machine n’aura plus d’adresse après un redémarrage.');
  }

  if (c.methode === 'dhcp') {
    if (c.adresse.trim() || c.passerelle.trim()) {
      dit('conseil', 'Adresse et passerelle ignorées en DHCP',
        'En méthode `dhcp`, c’est le serveur qui fournit tout. Ces champs ne sont pas écrits dans le fichier.');
    }
    return out;
  }

  const a = versEntier(c.adresse);
  if (a === null) {
    dit('erreur', `Adresse invalide : « ${c.adresse} »`, 'Quatre nombres de 0 à 255, séparés par des points.');
    return out;
  }
  if (c.cidr < 1 || c.cidr > 32) {
    dit('erreur', `Masque /${c.cidr} hors plage`, 'Un préfixe va de /1 à /32. Le plus courant en réseau local : /24.');
    return out;
  }

  const p = plan(c.adresse, c.cidr)!;
  const m = masqueDe(c.cidr);
  const reseau = (a & m) >>> 0;
  const diffusion = (reseau | (~m >>> 0)) >>> 0;

  if (c.cidr <= 30 && a === reseau) {
    dit('erreur', 'L’adresse est celle du réseau lui-même',
      `${p.reseau} désigne le réseau, pas une machine. Aucun hôte ne peut la porter — prends une adresse entre ${p.premiere} et ${p.derniere}.`);
  }
  if (c.cidr <= 30 && a === diffusion) {
    dit('erreur', 'L’adresse est celle de diffusion',
      `${p.diffusion} sert à joindre tout le monde à la fois. Prends une adresse entre ${p.premiere} et ${p.derniere}.`);
  }

  if (c.passerelle.trim()) {
    const g = versEntier(c.passerelle);
    if (g === null) {
      dit('erreur', `Passerelle invalide : « ${c.passerelle} »`, 'Même format qu’une adresse.');
    } else if (g === a) {
      dit('erreur', 'La passerelle est l’adresse de la machine',
        'Une machine ne peut pas être sa propre passerelle : les paquets ne sortiraient jamais.');
    } else if (((g & m) >>> 0) !== reseau) {
      // La faute la plus fréquente, et la plus déroutante.
      dit('erreur', 'La passerelle n’est pas dans le même sous-réseau',
        `${c.passerelle} est hors de ${p.reseau}/${c.cidr}. Le fichier sera accepté, l’interface montera, le réseau local marchera — et rien ne sortira. C’est le symptôme « je ping mon voisin mais pas Internet ».`);
    } else if (g === reseau || g === diffusion) {
      dit('erreur', 'La passerelle est une adresse réservée',
        'C’est l’adresse du réseau ou celle de diffusion : aucun routeur ne peut la porter.');
    }
  } else {
    dit('alerte', 'Aucune passerelle',
      'La machine joindra son propre réseau et rien d’autre. Volontaire pour une machine isolée ; sinon, c’est l’oubli classique.');
  }

  const serveurs = c.dns.trim().split(/[\s,;]+/).filter(Boolean);
  if (!serveurs.length) {
    dit('alerte', 'Aucun serveur DNS', 'Les adresses fonctionneront, les noms non. `ping 1.1.1.1` marchera, `ping debian.org` non.');
  } else {
    for (const d of serveurs) {
      if (versEntier(d) === null) dit('erreur', `Serveur DNS invalide : « ${d} »`, 'Une adresse IP est attendue, pas un nom.');
    }
    if (serveurs.length > 3) {
      dit('alerte', `${serveurs.length} serveurs DNS déclarés`,
        'La bibliothèque C n’en lit que trois : les suivants sont ignorés, silencieusement.');
    }
    if (!c.resolvconf) {
      dit('alerte', 'Le paquet resolvconf n’est pas installé',
        '`dns-nameservers` n’est pas lu par le noyau : c’est resolvconf qui écrit /etc/resolv.conf. Sans lui, la ligne est ignorée sans message. Le script ci-dessous écrit donc /etc/resolv.conf directement.');
    }
  }

  for (const ligne of c.adressesSup.split('\n').map(x => x.trim()).filter(Boolean)) {
    const [ip, pref] = ligne.split('/');
    if (versEntier(ip ?? '') === null) {
      dit('erreur', `Adresse supplémentaire invalide : « ${ligne} »`, 'Format attendu : 192.168.10.21/24');
    } else if (!pref) {
      dit('alerte', `Masque manquant sur « ${ligne} »`, 'Sans préfixe, `ip addr add` suppose /32 — l’adresse ne parlera à personne.');
    }
  }

  for (const ligne of c.routes.split('\n').map(x => x.trim()).filter(Boolean)) {
    const m2 = /^(\S+)\/(\d+)\s+via\s+(\S+)$/.exec(ligne);
    if (!m2) {
      dit('erreur', `Route mal écrite : « ${ligne} »`, 'Format attendu : 10.0.0.0/8 via 192.168.10.253');
    } else if (versEntier(m2[1]!) === null || versEntier(m2[3]!) === null) {
      dit('erreur', `Route invalide : « ${ligne} »`, 'Le réseau ou le routeur n’est pas une adresse valide.');
    }
  }

  if (c.mtu.trim() && !/^\d+$/.test(c.mtu.trim())) {
    dit('erreur', `MTU invalide : « ${c.mtu} »`, 'Un nombre, 1500 par défaut en Ethernet.');
  }

  if (c.hostname.trim() && /[A-Z_.]/.test(c.hostname.trim())) {
    dit('conseil', 'Le nom de machine contient une majuscule, un point ou un tiret bas',
      'Minuscules, chiffres et tirets uniquement : le nom circule sur le réseau et entre dans le DNS.');
  }

  return out;
}

/* ── Génération ──────────────────────────────────────────────────────────── */

/** Le contenu de /etc/network/interfaces. */
export function fichierInterfaces(c: Config): string {
  const l: string[] = [];
  l.push('# /etc/network/interfaces');
  l.push('# Genere par le configurateur — relire avant d\'appliquer.');
  l.push('');
  l.push('source /etc/network/interfaces.d/*');
  l.push('');
  l.push('# Le loopback : jamais retire, beaucoup de services en dependent.');
  l.push('auto lo');
  l.push('iface lo inet loopback');
  l.push('');

  const nom = c.iface.trim() || 'ens18';
  if (c.montage !== 'manuel') l.push(`${c.montage} ${nom}`);

  if (c.methode === 'dhcp') {
    l.push(`iface ${nom} inet dhcp`);
    if (c.mtu.trim()) l.push(`    mtu ${c.mtu.trim()}`);
    return l.join('\n');
  }

  l.push(`iface ${nom} inet static`);
  l.push(`    address ${c.adresse.trim()}/${c.cidr}`);
  if (c.passerelle.trim()) l.push(`    gateway ${c.passerelle.trim()}`);

  const serveurs = c.dns.trim().split(/[\s,;]+/).filter(Boolean);
  if (serveurs.length && c.resolvconf) {
    l.push(`    dns-nameservers ${serveurs.slice(0, 3).join(' ')}`);
    if (c.domaine.trim()) l.push(`    dns-search ${c.domaine.trim()}`);
  } else if (serveurs.length) {
    l.push('    # dns-nameservers demande le paquet resolvconf : voir /etc/resolv.conf');
  }
  if (c.mtu.trim()) l.push(`    mtu ${c.mtu.trim()}`);

  for (const ligne of c.adressesSup.split('\n').map(x => x.trim()).filter(Boolean)) {
    l.push(`    up   ip addr add ${ligne} dev ${nom}`);
    l.push(`    down ip addr del ${ligne} dev ${nom}`);
  }
  for (const ligne of c.routes.split('\n').map(x => x.trim()).filter(Boolean)) {
    l.push(`    up   ip route add ${ligne} dev ${nom}`);
    l.push(`    down ip route del ${ligne} dev ${nom}`);
  }
  return l.join('\n');
}

/** /etc/resolv.conf, quand resolvconf n'est pas là pour l'écrire. */
export function fichierResolv(c: Config): string {
  const serveurs = c.dns.trim().split(/[\s,;]+/).filter(Boolean).slice(0, 3);
  const l = ['# /etc/resolv.conf'];
  if (c.domaine.trim()) l.push(`search ${c.domaine.trim()}`);
  for (const d of serveurs) l.push(`nameserver ${d}`);
  return l.join('\n');
}

/** /etc/hosts, avec la ligne 127.0.1.1 que Debian attend. */
export function fichierHosts(c: Config): string {
  const h = c.hostname.trim() || 'debian';
  const fqdn = c.domaine.trim() ? `${h}.${c.domaine.trim()}` : h;
  return [
    '127.0.0.1       localhost',
    // Sans cette ligne, chaque sudo attend puis affiche « unable to resolve host ».
    `127.0.1.1       ${fqdn}   ${h}`,
    '',
    '::1     localhost ip6-localhost ip6-loopback',
    'ff02::1 ip6-allnodes',
    'ff02::2 ip6-allrouters',
  ].join('\n');
}

/** Les commandes d'application et de vérification. */
export function commandes(c: Config): string {
  const nom = c.iface.trim() || 'ens18';
  const l: string[] = [];
  l.push('# 1. Sauvegarder avant de toucher');
  l.push('sudo cp -a /etc/network/interfaces /etc/network/interfaces.avant');
  l.push('');
  l.push('# 2. Editer, puis verifier la syntaxe SANS appliquer');
  l.push('sudo nano /etc/network/interfaces');
  l.push(`ifquery ${nom}`);
  l.push('');
  l.push('# 3. Appliquer sur CETTE interface seulement');
  l.push(`sudo ifdown ${nom} ; sudo ifup ${nom}`);
  l.push('');
  l.push('# 4. Verifier AVANT de fermer la session');
  l.push(`ip a show ${nom}`);
  l.push('ip r');
  if (c.passerelle.trim()) l.push(`ping -c2 ${c.passerelle.trim()}   # la passerelle repond ?`);
  l.push('ping -c2 1.1.1.1                # ca sort ?');
  l.push('getent hosts debian.org         # les noms se resolvent ?');
  return l.join('\n');
}

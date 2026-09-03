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

/*
 * @id     tssr.atelier.debianReseau
 * @do     definir_donnees_debian
 * @role   donnee
 * @layer  outil
 * @human  Données de l'atelier : configuration réseau Debian (méthodes, exemples).
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

/* ── Le script d'application ─────────────────────────────────────────────── */

/**
 * Un script qui applique la configuration, et se rétracte tout seul.
 *
 * Debian n'a pas d'équivalent à `netplan try` : une erreur d'adressage appliquée
 * par SSH coupe la session, et il faut la console de l'hyperviseur pour rentrer.
 * Ce script fabrique ce filet — une tâche de fond restaure l'ancienne
 * configuration après quelques minutes, **sauf** si la vérification a réussi et
 * l'a désamorcée.
 *
 * Le mécanisme n'utilise que coreutils : ni `at` ni `systemd-run`, qui ne sont
 * pas toujours installés sur une Debian minimale.
 */
export function script(c: Config, delai = 120): string {
  const nom = c.iface.trim() || 'ens18';
  const serveurs = c.dns.trim().split(/[\s,;]+/).filter(Boolean).slice(0, 3);
  const l: string[] = [];

  l.push('#!/usr/bin/env bash');
  l.push('#');
  l.push(`# configurer-reseau.sh — applique l'adressage de ${nom}, avec retour arriere automatique.`);
  l.push('#');
  l.push('# Le filet : si la verification echoue, ou si le script est interrompu,');
  l.push(`# l'ancienne configuration est restauree au bout de ${delai} secondes.`);
  l.push('#');
  l.push('set -euo pipefail');
  l.push('');
  l.push(`IFACE="${nom}"`);
  l.push(`DELAI=${delai}`);
  l.push('HORODATAGE="$(date +%Y%m%d-%H%M%S)"');
  l.push('SAUVE="/etc/network/interfaces.avant-$HORODATAGE"');
  l.push('TEMOIN="/run/reseau-confirme-$HORODATAGE"');
  l.push('');
  l.push("log()    { printf '%s  %s\n' \"$(date '+%F %T')\" \"$*\" >&2; }");
  l.push('mourir() { log "ERREUR: $*"; exit 1; }');
  l.push('');
  l.push('# --- Verifications AVANT d\'agir -------------------------------------');
  l.push('[ "$(id -u)" -eq 0 ] || mourir "a lancer en root : sudo $0"');
  l.push('ip link show "$IFACE" >/dev/null 2>&1 || mourir "interface introuvable : $IFACE (voir : ip -br a)"');
  l.push('command -v ifup >/dev/null || mourir "ifupdown n\'est pas installe"');
  l.push('');
  l.push('# --- Sauvegarde -----------------------------------------------------');
  l.push('cp -a /etc/network/interfaces "$SAUVE"');
  l.push('log "configuration sauvegardee : $SAUVE"');
  if (!c.resolvconf && serveurs.length) l.push('[ -f /etc/resolv.conf ] && cp -a /etc/resolv.conf "/etc/resolv.conf.avant-$HORODATAGE" || true');
  if (c.hostname.trim()) l.push('cp -a /etc/hosts "/etc/hosts.avant-$HORODATAGE"');
  l.push('');
  l.push('# --- Le filet, arme AVANT toute modification -------------------------');
  l.push('# Une tache de fond restaure l\'ancienne conf, sauf si le temoin apparait.');
  l.push('# C\'est ce qui rend l\'erreur survivable quand on travaille par SSH.');
  l.push('(');
  l.push('  sleep "$DELAI"');
  l.push('  if [ -f "$TEMOIN" ]; then exit 0; fi');
  l.push('  logger -t configurer-reseau "verification non confirmee : retour arriere"');
  l.push('  cp -a "$SAUVE" /etc/network/interfaces');
  l.push('  ifdown "$IFACE" >/dev/null 2>&1 || true');
  l.push('  ifup "$IFACE"   >/dev/null 2>&1 || true');
  l.push(') &');
  l.push('CHIEN=$!');
  l.push('log "filet arme : retour arriere dans $DELAI s sans confirmation"');
  l.push('');
  l.push('# --- Ecriture --------------------------------------------------------');
  l.push("cat > /etc/network/interfaces <<'FIN'");
  l.push(fichierInterfaces(c));
  l.push('FIN');
  if (!c.resolvconf && serveurs.length) {
    l.push('');
    l.push('# resolvconf n\'est pas installe : dns-nameservers ne serait lu par personne.');
    l.push("cat > /etc/resolv.conf <<'FIN'");
    l.push(fichierResolv(c));
    l.push('FIN');
  }
  if (c.hostname.trim()) {
    l.push('');
    l.push(`echo '${c.hostname.trim()}' > /etc/hostname`);
    l.push('hostnamectl set-hostname ' + `'${c.hostname.trim()}'` + ' 2>/dev/null || true');
    l.push("cat > /etc/hosts <<'FIN'");
    l.push(fichierHosts(c));
    l.push('FIN');
  }
  l.push('log "fichiers ecrits"');
  l.push('');
  l.push('# --- Validation AVANT application ------------------------------------');
  l.push('ifquery "$IFACE" >/dev/null || { cp -a "$SAUVE" /etc/network/interfaces; mourir "syntaxe refusee — configuration restauree"; }');
  l.push('');
  l.push('# --- Application, sur CETTE interface seulement -----------------------');
  l.push('log "application"');
  l.push('ifdown "$IFACE" >/dev/null 2>&1 || true');
  l.push('ifup "$IFACE"');
  l.push('sleep 2');
  l.push('');
  l.push('# --- Verification ----------------------------------------------------');
  l.push('ok=1');
  if (c.methode === 'static') {
    l.push(`ip -4 addr show "$IFACE" | grep -q '${c.adresse.trim()}/' || { log "l'adresse n'est pas posee"; ok=0; }`);
    if (c.passerelle.trim()) {
      l.push(`ping -c2 -W2 ${c.passerelle.trim()} >/dev/null 2>&1 || { log "la passerelle ne repond pas"; ok=0; }`);
    }
  } else {
    l.push('ip -4 addr show "$IFACE" | grep -q "inet " || { log "aucune adresse obtenue en DHCP"; ok=0; }');
  }
  l.push('');
  l.push('if [ "$ok" -eq 1 ]; then');
  l.push('  touch "$TEMOIN"          # desamorce le filet');
  l.push('  kill "$CHIEN" 2>/dev/null || true');
  l.push('  log "verification reussie — configuration conservee"');
  l.push('  ip -br a show "$IFACE"');
  l.push('  ip r | head -3');
  l.push('  log "retour arriere manuel : cp $SAUVE /etc/network/interfaces && ifdown $IFACE && ifup $IFACE"');
  l.push('else');
  l.push('  log "verification ECHOUEE — le filet restaurera dans quelques secondes"');
  l.push('  log "ne ferme pas la console : attends le retour arriere"');
  l.push('  exit 1');
  l.push('fi');
  return l.join('\n');
}

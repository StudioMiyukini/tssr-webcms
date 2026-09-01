// Notions : le DNS sous Linux (Debian + BIND9) — données.
//
// La fiche de recherche pose huit questions ; on n'y répond pas par un paragraphe
// mais par ce qu'il faut retenir pour monter, vérifier et tester un serveur de
// noms. Le fil est celui d'un vrai déploiement : le paquet, les fichiers déjà
// là, les deux qu'on écrit, les enregistrements d'une zone, la vérification,
// puis le test — côté serveur et côté client (Windows et Linux).
//
// Tout tourne autour d'un exemple unique et cohérent : le domaine
// `miyukini.lan`, servi par `srv-dns` en 192.168.10.11 — la même adresse que le
// reste de l'atelier, pour qu'un fichier copié d'ici tombe juste ailleurs.

/*
 * @id     tssr.atelier.dnsLinuxData
 * @do     definir_donnees_dns_linux
 * @role   donnee
 * @layer  outil
 * @human  Données de l'atelier : notions DNS sous Linux (BIND9 sur Debian).
 */

/** L'exemple servant de fil rouge — repris tel quel dans les fichiers. */
export const DNS_EXEMPLE = {
  domaine: 'miyukini.lan',
  serveurNom: 'srv-dns',
  serveurIp: '192.168.10.11',
  reseau: '192.168.10.0',
  cidr: 24,
  /** La zone inverse d'un /24 : les trois premiers octets, à l'envers. */
  zoneInverse: '10.168.192.in-addr.arpa',
};

export interface Notion {
  /** La question de la fiche, telle qu'elle est posée. */
  question: string;
  /** La réponse courte — celle qu'on doit savoir réciter. */
  reponse: string;
  /** Le détail : pourquoi, comment, et l'erreur qui coûte une heure. */
  details: string[];
  /** Les commandes ou chemins cités, prêts à retenir. */
  code?: string;
}

/**
 * Les huit notions, dans l'ordre de la fiche de recherche.
 *
 * Chaque `reponse` est le noyau à connaître ; `details` porte le reste, y compris
 * le piège classique qui ne se voit qu'à l'usage.
 */
export const DNS_NOTIONS: Notion[] = [
  {
    question: 'Dans quel fichier configure-t-on le serveur DNS que la machine cliente va utiliser ?',
    reponse: 'Le résolveur du client se règle dans /etc/resolv.conf, ligne « nameserver ».',
    details: [
      'C’est le fichier que consulte toute résolution de noms sur la machine : il dit vers quel(s) serveur(s) DNS envoyer les questions.',
      'Sur une Debian moderne, ce fichier est souvent **généré** (par resolvconf ou systemd-resolved) : l’éditer à la main ne tient pas au redémarrage. On pose alors le DNS à la source — dans /etc/network/interfaces (dns-nameservers) ou via la configuration de systemd-resolved.',
      'Un « domain » ou « search » dans ce même fichier complète les noms courts : `ping srv` devient `srv.miyukini.lan`.',
    ],
    code: [
      '# /etc/resolv.conf (côté client)',
      'nameserver 192.168.10.11',
      'search miyukini.lan',
    ].join('\n'),
  },
  {
    question: 'Quel est le nom du paquet pour installer le DNS ?',
    reponse: 'Le serveur DNS de Debian est BIND9, dans le paquet bind9.',
    details: [
      'On y ajoute les outils clients pour tester : `dnsutils` (ou `bind9-dnsutils` sur les versions récentes) apporte dig, nslookup et host.',
      '`bind9-utils` (ex-`bind9utils`) fournit les vérificateurs named-checkconf et named-checkzone.',
      'Le service se nomme `named` (le démon), piloté par `systemctl` sous le nom `bind9` ou `named` selon la version.',
    ],
    code: [
      'apt update',
      'apt install bind9 bind9-utils bind9-dnsutils',
      'systemctl status named   # ou bind9',
    ].join('\n'),
  },
  {
    question: 'Quels sont les 4 fichiers existants du serveur DNS qui sont importants ? À quoi servent-ils ?',
    reponse: 'Dans /etc/bind : named.conf, named.conf.options, named.conf.local et named.conf.default-zones.',
    details: [
      'named.conf — le chef d’orchestre : il ne fait qu’**inclure** les trois autres. On ne l’édite quasiment jamais.',
      'named.conf.options — les réglages globaux du serveur : redirecteurs (forwarders), écoute, récursivité, DNSSEC.',
      'named.conf.local — c’est **ici** qu’on déclare ses propres zones (directe et inverse) en pointant vers leurs fichiers.',
      'named.conf.default-zones — les zones fournies d’origine (localhost, la boucle inverse 127, la zone racine). On n’y touche pas.',
    ],
    code: [
      '/etc/bind/',
      '├── named.conf                 # inclut les trois suivants',
      '├── named.conf.options         # forwarders, écoute, récursivité',
      '├── named.conf.local           # VOS zones (directe + inverse)',
      '└── named.conf.default-zones   # localhost, 127.in-addr.arpa, racine',
    ].join('\n'),
  },
  {
    question: 'Quels sont les 2 fichiers de configuration du serveur DNS que vous devez créer ? À quoi servent-ils ?',
    reponse: 'Les deux fichiers de zone : la zone directe (db.miyukini.lan) et la zone inverse (db.192.168.10).',
    details: [
      'La **zone directe** traduit un nom en adresse (miyukini.lan → 192.168.10.x). Elle contient les enregistrements A/AAAA, MX, CNAME…',
      'La **zone inverse** fait l’inverse : d’une adresse au nom (192.168.10.11 → srv-dns.miyukini.lan), avec des enregistrements PTR. Elle est indispensable au reverse DNS (courriel, journaux lisibles).',
      'On les range dans /etc/bind (ou /var/lib/bind pour les zones inscriptibles). Le plus simple : copier db.local comme modèle, puis l’adapter.',
      'Piège : chaque fichier de zone est **déclaré** dans named.conf.local. Créer le fichier sans le déclarer (ou l’inverse) et le serveur ignore la zone en silence.',
    ],
    code: [
      '/etc/bind/db.miyukini.lan   # zone directe  : nom → adresse (A)',
      '/etc/bind/db.192.168.10     # zone inverse  : adresse → nom (PTR)',
    ].join('\n'),
  },
  {
    question: 'Quels sont les enregistrements importants dans la déclaration d’une zone DNS ? Donnez leurs noms et leurs fonctions.',
    reponse: 'SOA, NS, A/AAAA, PTR, CNAME et MX — chacun porte un rôle précis.',
    details: [
      'Ils sont détaillés dans le tableau des enregistrements ci-dessous.',
      'Deux sont obligatoires en tête de zone : un SOA (l’autorité et les compteurs) et au moins un NS (le serveur de noms de la zone).',
      'Le **serial** du SOA doit être incrémenté à **chaque** modification, sinon les serveurs secondaires ne rechargent pas la zone. La convention est AAAAMMJJnn.',
    ],
  },
  {
    question: 'Quelles sont les commandes de vérification de vos fichiers ?',
    reponse: 'named-checkconf pour la configuration, named-checkzone pour chaque fichier de zone.',
    details: [
      'named-checkconf, sans argument, valide la syntaxe de named.conf et de ses inclusions. Aucune sortie = tout va bien.',
      'named-checkzone <zone> <fichier> valide un fichier de zone et affiche « OK » avec le serial retenu. Il attrape les fautes que BIND refuse silencieusement.',
      'Ces vérifications se font **avant** de recharger : un fichier fautif empêche named de démarrer, et on se retrouve sans DNS du tout.',
    ],
    code: [
      'named-checkconf',
      'named-checkzone miyukini.lan /etc/bind/db.miyukini.lan',
      'named-checkzone 10.168.192.in-addr.arpa /etc/bind/db.192.168.10',
      'systemctl reload named   # ou rndc reload, une fois les vérifs passées',
    ].join('\n'),
  },
  {
    question: 'Quelle est la commande pour tester le bon fonctionnement de la résolution de noms ?',
    reponse: 'dig (ou host, ou nslookup) — dig est le plus précis.',
    details: [
      'dig montre la réponse complète : la section ANSWER, le serveur qui a répondu, le temps. C’est l’outil de diagnostic de référence.',
      '`dig -x <ip>` teste la zone inverse (le PTR). `dig @192.168.10.11 …` force l’interrogation d’un serveur précis, utile pour tester le serveur avant de toucher au résolveur du client.',
      'Piège : une entrée dans /etc/hosts court-circuite le DNS sans rien dire. `dig` l’ignore (il parle au serveur), `ping` la suit : les deux peuvent donc se contredire.',
    ],
    code: [
      'dig srv-dns.miyukini.lan            # nom → adresse (A)',
      'dig -x 192.168.10.11                # adresse → nom (PTR)',
      'dig @192.168.10.11 miyukini.lan MX  # interroger le serveur en direct',
      'host srv-dns.miyukini.lan           # équivalent, sortie courte',
    ].join('\n'),
  },
  {
    question: 'Comment tester le fonctionnement du DNS depuis une machine cliente Windows ? Et depuis une machine cliente Linux ?',
    reponse: 'Windows : nslookup. Linux : dig / host / nslookup, après avoir vérifié /etc/resolv.conf.',
    details: [
      'Windows — `nslookup nom` interroge le DNS configuré ; `nslookup nom 192.168.10.11` force le serveur. `ipconfig /all` montre le DNS reçu, `ipconfig /flushdns` vide le cache si une vieille réponse colle.',
      'Linux — `dig`/`host`/`nslookup` de la même façon ; `resolvectl status` (ou le contenu de /etc/resolv.conf) montre le serveur réellement utilisé.',
      'Des deux côtés, on teste d’abord le nom (résolution directe), puis l’adresse (`nslookup 192.168.10.11` / `dig -x`) pour l’inverse. Si l’adresse répond et pas le nom, c’est le DNS ; si rien ne répond, c’est la route ou la passerelle.',
    ],
    code: [
      ':: Windows',
      'nslookup srv-dns.miyukini.lan',
      'nslookup srv-dns.miyukini.lan 192.168.10.11',
      'ipconfig /all & ipconfig /flushdns',
      '',
      '# Linux',
      'dig srv-dns.miyukini.lan',
      'resolvectl status | grep -i dns',
    ].join('\n'),
  },
];

export interface Enregistrement {
  type: string;
  nom: string;
  role: string;
  exemple: string;
}

/** Les enregistrements d'une zone, du plus structurant au plus courant. */
export const DNS_ENREGISTREMENTS: Enregistrement[] = [
  { type: 'SOA', nom: 'Start Of Authority', role: 'En-tête de zone : serveur maître, courriel de l’admin, et les compteurs (serial, refresh, retry, expire, TTL négatif). Un seul par zone.', exemple: '@ IN SOA srv-dns.miyukini.lan. admin.miyukini.lan. ( 2026090101 … )' },
  { type: 'NS', nom: 'Name Server', role: 'Désigne un serveur de noms faisant autorité sur la zone. Au moins un, obligatoire.', exemple: '@   IN NS   srv-dns.miyukini.lan.' },
  { type: 'A', nom: 'Address', role: 'Traduit un nom en adresse IPv4. Le cœur de la zone directe.', exemple: 'srv-dns  IN A   192.168.10.11' },
  { type: 'AAAA', nom: 'Address IPv6', role: 'Comme A, mais pour une adresse IPv6.', exemple: 'srv-dns  IN AAAA 2001:db8::11' },
  { type: 'PTR', nom: 'Pointer', role: 'Traduit une adresse en nom : c’est l’enregistrement de la zone inverse.', exemple: '11  IN PTR srv-dns.miyukini.lan.' },
  { type: 'CNAME', nom: 'Canonical Name', role: 'Alias : un nom qui renvoie vers un autre nom (jamais vers une IP).', exemple: 'www  IN CNAME srv-dns.miyukini.lan.' },
  { type: 'MX', nom: 'Mail eXchanger', role: 'Le serveur de courriel du domaine, précédé d’une priorité (le plus petit gagne).', exemple: '@  IN MX 10 srv-dns.miyukini.lan.' },
];

/**
 * Les fichiers d'exemple, cohérents avec DNS_EXEMPLE.
 *
 * Ce sont des fichiers valides : copiés, adaptés à ses propres adresses, ils
 * passent named-checkzone. Le serial est daté du jour de rédaction — à
 * incrémenter dès la première modification.
 */
export const DNS_FICHIERS_EXEMPLE: { nom: string; chemin: string; role: string; contenu: string }[] = [
  {
    nom: 'named.conf.local',
    chemin: '/etc/bind/named.conf.local',
    role: 'On y déclare les deux zones (directe et inverse) en les pointant vers leurs fichiers.',
    contenu: [
      '// Zone directe : nom → adresse',
      'zone "miyukini.lan" {',
      '    type master;',
      '    file "/etc/bind/db.miyukini.lan";',
      '};',
      '',
      '// Zone inverse : adresse → nom (réseau 192.168.10.0/24)',
      'zone "10.168.192.in-addr.arpa" {',
      '    type master;',
      '    file "/etc/bind/db.192.168.10";',
      '};',
    ].join('\n'),
  },
  {
    nom: 'named.conf.options',
    chemin: '/etc/bind/named.conf.options',
    role: 'Les réglages globaux : ici, les redirecteurs vers un DNS public pour tout ce qui sort du domaine local.',
    contenu: [
      'options {',
      '    directory "/var/cache/bind";',
      '',
      '    // Ce que le serveur ne sait pas résoudre localement, il le demande ici :',
      '    forwarders {',
      '        1.1.1.1;',
      '        8.8.8.8;',
      '    };',
      '',
      '    // Répond aux clients du LAN uniquement.',
      '    allow-query { localhost; 192.168.10.0/24; };',
      '    recursion yes;',
      '',
      '    dnssec-validation auto;',
      '    listen-on-v6 { any; };',
      '};',
    ].join('\n'),
  },
  {
    nom: 'db.miyukini.lan',
    chemin: '/etc/bind/db.miyukini.lan',
    role: 'La zone directe : le SOA, les NS, puis un enregistrement A par machine.',
    contenu: [
      '$TTL    604800',
      '@       IN      SOA     srv-dns.miyukini.lan. admin.miyukini.lan. (',
      '                        2026090101      ; Serial (AAAAMMJJnn — à incrémenter)',
      '                         604800         ; Refresh',
      '                          86400         ; Retry',
      '                        2419200         ; Expire',
      '                         604800 )       ; TTL négatif',
      ';',
      '@       IN      NS      srv-dns.miyukini.lan.',
      ';',
      'srv-dns IN      A       192.168.10.11',
      'passerelle IN   A       192.168.10.254',
      'www     IN      CNAME   srv-dns.miyukini.lan.',
      '@       IN      MX 10   srv-dns.miyukini.lan.',
    ].join('\n'),
  },
  {
    nom: 'db.192.168.10',
    chemin: '/etc/bind/db.192.168.10',
    role: 'La zone inverse : le même SOA/NS, puis un PTR par machine (le dernier octet suffit).',
    contenu: [
      '$TTL    604800',
      '@       IN      SOA     srv-dns.miyukini.lan. admin.miyukini.lan. (',
      '                        2026090101      ; Serial',
      '                         604800         ; Refresh',
      '                          86400         ; Retry',
      '                        2419200         ; Expire',
      '                         604800 )       ; TTL négatif',
      ';',
      '@       IN      NS      srv-dns.miyukini.lan.',
      ';',
      '11      IN      PTR     srv-dns.miyukini.lan.',
      '254     IN      PTR     passerelle.miyukini.lan.',
    ].join('\n'),
  },
];

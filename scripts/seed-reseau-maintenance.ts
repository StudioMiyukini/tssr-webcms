/* Crée les cours Réseau (routeur, switch, pare-feu) + Maintenance (7 couches OSI, ticketing)
   et réorganise la page "Cours" en 4 colonnes : Hardware | Software / Réseau | Maintenance.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-reseau-maintenance.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock, type CardItem } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);

// ===== Palette commune des schémas SVG =====
const C = { net: '#2563eb', dev: '#059669', warn: '#d97706', danger: '#dc2626', grey: '#64748b', slate: '#475569', purple: '#7c3aed', ok: '#16a34a' };
const accordion = (it: Array<[string, string]>) => block('accordion', { items: it.map(([title, text]) => ({ title, text, href: '' })) });
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });

// ===================================================================================
// SCHÉMAS SVG (inline → compatibles CSP, nets sur tout écran)
// ===================================================================================
function box(x: number, y: number, w: number, h: number, fill: string, label: string, sub = ''): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}"/>`
    + `<text x="${x + w / 2}" y="${y + (sub ? h / 2 - 2 : h / 2 + 4)}" text-anchor="middle" font-size="13" fill="#fff" font-weight="bold">${label}</text>`
    + (sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 14}" text-anchor="middle" font-size="10" fill="#e5e7eb">${sub}</text>` : '');
}
const line = (x1: number, y1: number, x2: number, y2: number, col = '#94a3b8') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="2.5"/>`;
const wrap = (w: number, h: number, inner: string) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="max-width:${w}px;width:100%;height:auto;margin:6px 0 12px;font-family:system-ui,sans-serif">${inner}</svg>`;

// Routeur : Internet (nuage) ─ Routeur ─ {PC, Téléphone, TV}
const svgRouter = wrap(420, 230,
  `<ellipse cx="70" cy="60" rx="52" ry="30" fill="${C.grey}"/><text x="70" y="65" text-anchor="middle" font-size="13" fill="#fff" font-weight="bold">Internet</text>`
  + line(122, 60, 175, 60, C.net)
  + box(175, 35, 90, 50, C.net, 'Routeur', 'NAT · DHCP')
  + line(220, 85, 220, 120)
  + line(220, 120, 80, 120) + line(220, 120, 360, 120)
  + line(80, 120, 80, 150) + line(220, 120, 220, 150) + line(360, 120, 360, 150)
  + box(35, 150, 90, 45, C.dev, 'PC')
  + box(175, 150, 90, 45, C.dev, 'Téléphone')
  + box(315, 150, 90, 45, C.dev, 'TV')
  + `<text x="210" y="222" text-anchor="middle" font-size="11" fill="#64748b">Le routeur relie le réseau local (LAN) à Internet (WAN)</text>`);

// Switch : un switch central relié à 4 PC (topologie étoile)
const svgSwitch = wrap(420, 220,
  box(155, 25, 110, 45, C.net, 'Switch', '@ MAC → port')
  + line(180, 70, 70, 130) + line(200, 70, 160, 130) + line(220, 70, 260, 130) + line(245, 70, 355, 130)
  + box(30, 130, 80, 45, C.dev, 'PC 1')
  + box(120, 130, 80, 45, C.dev, 'PC 2')
  + box(220, 130, 80, 45, C.dev, 'PC 3')
  + box(315, 130, 80, 45, C.dev, 'PC 4')
  + `<text x="210" y="205" text-anchor="middle" font-size="11" fill="#64748b">Le switch envoie chaque trame UNIQUEMENT au bon port (pas à tous)</text>`);

// Pare-feu : trafic entrant filtré par des règles (autorisé/bloqué)
const svgFirewall = wrap(440, 220,
  `<ellipse cx="60" cy="95" rx="50" ry="30" fill="${C.grey}"/><text x="60" y="100" text-anchor="middle" font-size="13" fill="#fff" font-weight="bold">Internet</text>`
  + line(110, 95, 175, 95)
  + `<rect x="175" y="35" width="90" height="120" rx="8" fill="${C.danger}"/><text x="220" y="90" text-anchor="middle" font-size="13" fill="#fff" font-weight="bold">Pare-feu</text><text x="220" y="108" text-anchor="middle" font-size="10" fill="#fee2e2">règles</text>`
  + `<line x1="265" y1="70" x2="350" y2="70" stroke="${C.ok}" stroke-width="2.5"/><text x="358" y="74" font-size="12" fill="${C.ok}">✔ autorisé</text>`
  + `<line x1="265" y1="120" x2="330" y2="120" stroke="${C.danger}" stroke-width="2.5" stroke-dasharray="5 4"/><text x="338" y="124" font-size="12" fill="${C.danger}">✘ bloqué</text>`
  + box(350, 150, 80, 40, C.dev, 'LAN')
  + `<text x="220" y="208" text-anchor="middle" font-size="11" fill="#64748b">Chaque paquet est comparé aux règles : on laisse passer ou on jette</text>`);

// OSI : pile de 7 couches
function svgOsi(): string {
  const rows = [
    ['7 · Application', 'HTTP, DNS, SMTP', C.purple],
    ['6 · Présentation', 'TLS, JPEG, chiffrement', C.purple],
    ['5 · Session', 'ouverture/fermeture dialogue', C.purple],
    ['4 · Transport', 'TCP / UDP — ports', C.net],
    ['3 · Réseau', 'IP, routeur', C.net],
    ['2 · Liaison', 'Ethernet, MAC, switch', C.dev],
    ['1 · Physique', 'câble, fibre, signal', C.dev],
  ];
  const W = 430, rh = 34, gap = 4, top = 6;
  let s = '';
  rows.forEach((r, i) => {
    const y = top + i * (rh + gap);
    s += `<rect x="6" y="${y}" width="${W - 12}" height="${rh}" rx="6" fill="${r[2]}"/>`
      + `<text x="20" y="${y + 22}" font-size="13" fill="#fff" font-weight="bold">${r[0]}</text>`
      + `<text x="${W - 20}" y="${y + 22}" text-anchor="end" font-size="11" fill="#e5e7eb">${r[1]}</text>`;
  });
  return wrap(W, top + rows.length * (rh + gap) + 2, s);
}

// Ticketing : cycle de vie d'un ticket
const svgTicket = wrap(460, 130,
  box(10, 40, 90, 45, C.grey, 'Nouveau')
  + line(100, 62, 130, 62) + box(130, 40, 90, 45, C.net, 'En cours')
  + line(220, 62, 250, 62) + box(250, 40, 95, 45, C.warn, 'En attente')
  + line(345, 62, 375, 62) + box(375, 40, 80, 45, C.ok, 'Résolu')
  + `<text x="230" y="115" text-anchor="middle" font-size="11" fill="#64748b">Cycle de vie d'un ticket — puis « Fermé » après validation de l'utilisateur</text>`);

// ===================================================================================
// PAGES
// ===================================================================================
type Page = { slug: string; title: string; excerpt: string; eyebrow: string; blocks: PageBlock[] };

// Tableau récapitulatif des 7 couches OSI (couleurs alignées sur le schéma svgOsi)
const osiRows: Array<[number, string, string, string, string]> = [
  [7, 'Application', 'Fournit les services réseau directement aux logiciels de l’utilisateur', 'HTTP, HTTPS, DNS, SMTP', C.purple],
  [6, 'Présentation', 'Met en forme, chiffre et compresse les données', 'TLS/SSL, JPEG, chiffrement', C.purple],
  [5, 'Session', 'Ouvre, maintient et ferme le dialogue, et gère l’authentification de la session', 'NetBIOS, RPC, authentification', C.purple],
  [4, 'Transport', 'Découpe en segments et gère la fiabilité de bout en bout via les ports', 'TCP, UDP', C.net],
  [3, 'Réseau', 'Attribue les adresses IP et choisit la route entre les réseaux', 'IP, ICMP — le routeur', C.net],
  [2, 'Liaison', 'Échange les trames entre appareils voisins via les adresses MAC', 'Ethernet, MAC — le switch', C.dev],
  [1, 'Physique', 'Transmet les bits sous forme de signal sur le support', 'Câble RJ45, fibre, Wi-Fi — le hub', C.dev],
];
const osiTable = `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:600px;font-size:14px">
<thead><tr style="background:var(--surface-2)">
${['N°', 'Couche', 'Rôle principal', 'Exemple (protocoles / matériel)'].map(c => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${c}</th>`).join('')}
</tr></thead><tbody>
${osiRows.map(([n, nom, role, ex, col]) => `<tr>`
  + `<td style="padding:8px 10px;border:1px solid var(--border);text-align:center;font-weight:700;color:#fff;background:${col}">${n}</td>`
  + `<td style="padding:8px 10px;border:1px solid var(--border);font-weight:600">${nom}</td>`
  + `<td style="padding:8px 10px;border:1px solid var(--border)">${role}</td>`
  + `<td style="padding:8px 10px;border:1px solid var(--border)">${ex}</td></tr>`).join('')}
</tbody></table></div>`;

const PAGES: Page[] = [
  // ---------- ROUTEUR ----------
  {
    slug: 'le-routeur', title: 'Le routeur', eyebrow: 'Cours · Réseau',
    excerpt: 'Comprendre le routeur : rôle, fonctionnement, NAT, DHCP — vulgarisé avec schémas et analogies.',
    blocks: [
      block('hero', { eyebrow: 'Cours · Réseau', title: 'Le routeur', subtitle: 'L’appareil qui relie ton réseau local à Internet et choisit le chemin des données.' }),
      block('html', { html: '<p>Un <strong>routeur</strong> est l’appareil qui fait communiquer <strong>deux réseaux différents</strong> — typiquement ton <strong>réseau local</strong> (la maison/le bureau, le « LAN ») et <strong>Internet</strong> (le « WAN »). Il décide par quel chemin envoyer chaque paquet de données pour qu’il arrive à destination.</p>' }),
      note('blue', '🔎 Analogie', '<p>Imagine un <strong>centre de tri postal</strong> à un carrefour de villes. Chaque lettre (paquet de données) arrive avec une adresse ; le routeur lit l’adresse et choisit la <strong>meilleure route</strong> pour l’y faire parvenir. Sans lui, ta box ne saurait pas comment atteindre un site à l’autre bout du monde.</p>'),
      block('heading', { level: 2, text: 'Comment ça marche' }),
      block('html', { html: svgRouter }),
      block('html', { html: '<p>Le routeur possède au moins <strong>deux « pieds »</strong> : un côté Internet (la fibre/ADSL) et un côté réseau local (tes appareils). Quand ton PC demande une page web, le paquet part vers le routeur, qui le <strong>traduit</strong> et l’<strong>aiguille</strong> vers Internet, puis fait revenir la réponse au bon appareil.</p>' }),
      block('heading', { level: 2, text: 'Ses fonctions clés' }),
      accordion([
        ['🧭 Le routage (choisir le chemin)', '<p>Le routeur tient une <strong>table de routage</strong> : une liste de « pour aller vers tel réseau, passe par là ». Il lit l’<strong>adresse IP</strong> de destination et transfère le paquet vers le prochain équipement (le « saut » suivant), jusqu’à destination.</p>'],
        ['🔀 Le NAT (partager une seule IP publique)', '<p>Ton fournisseur ne te donne qu’<strong>une seule adresse IP publique</strong>, mais tu as 10 appareils. Le <strong>NAT</strong> (<em>Network Address Translation</em>) joue le rôle de <strong>standardiste</strong> : il remplace l’adresse privée de chaque appareil par l’IP publique en sortie, et se souvient à qui renvoyer la réponse au retour.</p>'],
        ['🏷️ Le DHCP (distribuer les adresses)', '<p>Pour que chaque appareil ait une adresse sur le réseau local, le routeur fait souvent office de serveur <strong>DHCP</strong> : il <strong>attribue automatiquement</strong> une IP à chaque appareil qui se connecte (comme un hôtel qui donne un numéro de chambre à l’arrivée).</p>'],
        ['🛡️ Le pare-feu & le WiFi', '<p>La plupart des routeurs domestiques intègrent un <strong>pare-feu</strong> de base (bloque les connexions entrantes non sollicitées) et un <strong>point d’accès WiFi</strong>. C’est pour ça qu’on appelle souvent « box » cet appareil tout-en-un : routeur + switch + WiFi + modem.</p>'],
      ]),
      block('heading', { level: 2, text: 'Exemples concrets' }),
      block('html', { html: '<ul><li>📶 <strong>La box Internet</strong> de la maison : c’est un routeur (+ modem + switch + WiFi).</li><li>🏢 En <strong>entreprise</strong>, un routeur dédié relie les différents sites et Internet, avec des règles de sécurité avancées.</li><li>🌍 Internet lui-même n’est qu’une <strong>immense chaîne de routeurs</strong> qui se passent les paquets de proche en proche.</li></ul>' }),
      note('green', '💡 À retenir', '<p>Routeur = il relie des <strong>réseaux différents</strong> et choisit le <strong>chemin</strong> (couche 3 / IP). À ne pas confondre avec le <strong>switch</strong>, qui relie les appareils <strong>d’un même réseau</strong>. Sigles (NAT, DHCP, LAN, WAN…) dans le <a href="/glossaire">Glossaire</a>.</p>'),
    ],
  },
  // ---------- SWITCH ----------
  {
    slug: 'le-switch', title: 'Le switch', eyebrow: 'Cours · Réseau',
    excerpt: 'Le switch (commutateur) : relier les appareils d’un même réseau, table MAC, différence avec le hub.',
    blocks: [
      block('hero', { eyebrow: 'Cours · Réseau', title: 'Le switch', subtitle: 'Le « commutateur » qui relie intelligemment les appareils d’un même réseau local.' }),
      block('html', { html: '<p>Un <strong>switch</strong> (commutateur) est l’appareil qui <strong>relie entre eux les appareils d’un même réseau local</strong> (PC, imprimantes, serveurs…). Il reçoit les données d’un appareil et les transmet <strong>uniquement</strong> au bon destinataire, sans déranger les autres.</p>' }),
      note('blue', '🔎 Analogie', '<p>Pense à une <strong>standardiste d’entreprise</strong> qui connaît le numéro de poste de chaque employé. Quand un appel arrive pour « Marie », elle le transfère <strong>directement</strong> au poste de Marie — pas à tout l’open-space. Le switch fait pareil : il connaît la « place » de chaque appareil et livre la donnée au bon endroit.</p>'),
      block('heading', { level: 2, text: 'Comment ça marche' }),
      block('html', { html: svgSwitch }),
      block('html', { html: '<p>Chaque appareil possède une <strong>adresse MAC</strong> unique (sa « carte d’identité » matérielle). Le switch construit une <strong>table MAC</strong> : « l’appareil avec telle adresse est branché sur tel port ». Ensuite, il envoie chaque <strong>trame</strong> directement au port concerné — c’est ça, la <em>commutation</em>.</p>' }),
      block('heading', { level: 2, text: 'Switch vs Hub vs Routeur' }),
      accordion([
        ['🆚 Switch vs Hub (l’ancêtre)', '<p>Un <strong>hub</strong> recopiait bêtement tout ce qu’il recevait vers <strong>tous</strong> les ports (comme crier dans un mégaphone). Résultat : collisions, lenteur, indiscrétion. Le <strong>switch</strong> envoie au <strong>seul</strong> bon port → plus rapide, plus sûr. Le hub a quasiment disparu.</p>'],
        ['🆚 Switch vs Routeur', '<p>Le <strong>switch</strong> relie les appareils <strong>à l’intérieur</strong> d’un réseau (couche 2, adresses MAC). Le <strong>routeur</strong> relie des <strong>réseaux différents</strong> entre eux (couche 3, adresses IP). En clair : le switch organise la pièce, le routeur ouvre la porte vers l’extérieur.</p>'],
        ['🔌 Manageable ou non', '<p>Un switch <strong>non manageable</strong> se branche et fonctionne. Un switch <strong>manageable</strong> permet de configurer des <strong>VLAN</strong> (réseaux virtuels séparés), des priorités, de la sécurité par port… indispensable en entreprise.</p>'],
        ['🧩 Les VLAN', '<p>Un <strong>VLAN</strong> permet de <strong>séparer logiquement</strong> plusieurs réseaux sur le même switch physique (ex. : « administration » et « invités » isolés l’un de l’autre), sans tirer de nouveaux câbles.</p>'],
      ]),
      block('heading', { level: 2, text: 'Exemples concrets' }),
      block('html', { html: '<ul><li>🏢 Dans un bureau, le <strong>switch</strong> au mur relie tous les PC entre eux et au réseau.</li><li>🖥️ Un <strong>serveur</strong> et les postes d’une salle informatique communiquent via un switch.</li><li>🏠 À la maison, les ports Ethernet jaunes/gris de ta box sont en réalité un <strong>petit switch intégré</strong>.</li></ul>' }),
      note('green', '💡 À retenir', '<p>Switch = relie les appareils d’un <strong>même réseau</strong> et livre chaque trame au <strong>bon port</strong> grâce aux <strong>adresses MAC</strong> (couche 2). Termes (MAC, VLAN, trame…) dans le <a href="/glossaire">Glossaire</a>.</p>'),
    ],
  },
  // ---------- PARE-FEU ----------
  {
    slug: 'le-pare-feu', title: 'Le pare-feu', eyebrow: 'Cours · Réseau',
    excerpt: 'Le pare-feu (firewall) : filtrer le trafic réseau selon des règles, protéger le réseau.',
    blocks: [
      block('hero', { eyebrow: 'Cours · Réseau', title: 'Le pare-feu', subtitle: 'Le « vigile » du réseau : il filtre ce qui entre et ce qui sort selon des règles.' }),
      block('html', { html: '<p>Un <strong>pare-feu</strong> (<em>firewall</em>) est un dispositif — matériel ou logiciel — qui <strong>contrôle le trafic réseau</strong>. Il examine chaque paquet qui veut entrer ou sortir et décide, selon des <strong>règles</strong>, de le <strong>laisser passer</strong> ou de le <strong>bloquer</strong>.</p>' }),
      note('blue', '🔎 Analogie', '<p>C’est le <strong>videur à l’entrée d’une boîte de nuit</strong> avec une liste. Il regarde chaque personne (paquet) : « Tu es sur la liste ? Entre. Sinon, refusé. » Le pare-feu applique cette même logique au trafic réseau, en continu et à grande vitesse.</p>'),
      block('heading', { level: 2, text: 'Comment ça marche' }),
      block('html', { html: svgFirewall }),
      block('html', { html: '<p>Le pare-feu compare chaque paquet à une <strong>liste de règles</strong> évaluées dans l’ordre : <em>source, destination, port, protocole…</em> La première règle qui correspond décide du sort du paquet (autorisé/bloqué). Par défaut, le bon réflexe est « <strong>tout interdire sauf ce qui est explicitement autorisé</strong> ».</p>' }),
      block('heading', { level: 2, text: 'Notions clés' }),
      accordion([
        ['📋 Les règles (ACL)', '<p>Une règle dit par exemple : « autoriser le <strong>port 443</strong> (HTTPS) sortant », « bloquer tout le trafic entrant non sollicité ». L’ensemble forme une <strong>politique de filtrage</strong> (ACL = <em>Access Control List</em>).</p>'],
        ['🔌 Les ports', '<p>Chaque service utilise un <strong>port</strong> : 80 = web (HTTP), 443 = web sécurisé (HTTPS), 22 = SSH, 25 = mail… Le pare-feu autorise ou bloque le trafic <strong>port par port</strong>, comme on ouvre ou ferme des guichets.</p>'],
        ['🧠 Stateful (à états)', '<p>Un pare-feu moderne est <strong>« stateful »</strong> : il se souvient des connexions déjà ouvertes. Si <strong>toi</strong> as demandé une page, il laisse revenir la réponse ; mais une connexion entrante <strong>non sollicitée</strong> est bloquée. Il distingue « réponse attendue » de « intrus ».</p>'],
        ['🛡️ Où le trouve-t-on ?', '<p>Sur ta <strong>box</strong> (basique), dans <strong>Windows</strong> (« Pare-feu Windows Defender »), sur des <strong>boîtiers dédiés</strong> en entreprise (Stormshield, Fortinet, pfSense…). On parle de <strong>NGFW</strong> (<em>Next-Gen Firewall</em>) quand il inspecte aussi le contenu (antivirus, filtrage web).</p>'],
      ]),
      block('heading', { level: 2, text: 'Exemples concrets' }),
      block('html', { html: '<ul><li>🚫 Bloquer l’accès à certains sites depuis le réseau d’une entreprise.</li><li>🔒 Empêcher Internet d’atteindre directement un serveur interne (seul le port utile est ouvert).</li><li>🧱 Isoler le réseau « invités » du réseau « administration ».</li></ul>' }),
      note('green', '💡 À retenir', '<p>Pare-feu = il <strong>filtre le trafic</strong> selon des <strong>règles</strong> (source/destination/port/protocole) et protège le réseau. Principe d’or : <strong>tout bloquer par défaut</strong>, n’ouvrir que le nécessaire. Vocabulaire (port, ACL, HTTPS…) dans le <a href="/glossaire">Glossaire</a>.</p>'),
    ],
  },
  // ---------- 7 COUCHES OSI ----------
  {
    slug: 'les-7-couches-osi', title: 'Les 7 couches OSI', eyebrow: 'Cours · Maintenance',
    excerpt: 'Le modèle OSI : les 7 couches du réseau expliquées simplement, avec exemples et moyen mnémotechnique.',
    blocks: [
      block('hero', { eyebrow: 'Cours · Maintenance', title: 'Les 7 couches OSI', subtitle: 'La « carte » qui découpe la communication réseau en 7 étages — pour comprendre et dépanner.' }),
      block('html', { html: '<p>Le <strong>modèle OSI</strong> (<em>Open Systems Interconnection</em>) est une <strong>carte de référence</strong> qui découpe la communication entre deux machines en <strong>7 couches</strong>, de la plus concrète (le câble) à la plus proche de l’utilisateur (l’application). Chaque couche a un rôle précis et « parle » à la couche équivalente de la machine d’en face.</p>' }),
      note('blue', '🔎 Analogie', '<p>Envoyer un courrier : tu écris la lettre (application), tu la mets dans une enveloppe avec l’adresse (réseau), le facteur la transporte (physique)… À l’arrivée, on ouvre l’enveloppe dans l’<strong>ordre inverse</strong>. Chaque étape ne s’occupe que de SON travail, sans connaître le contenu des autres. OSI, c’est ce <strong>découpage en étapes</strong>.</p>'),
      block('heading', { level: 2, text: 'Les 7 couches en un coup d’œil' }),
      block('html', { html: svgOsi() }),
      block('heading', { level: 2, text: '📋 Récapitulatif des 7 couches' }),
      block('html', { html: osiTable }),
      block('heading', { level: 2, text: 'Chaque couche en détail' }),
      accordion([
        ['7 · Application — ce que voit l’utilisateur', '<p>Les <strong>logiciels et protocoles</strong> que tu utilises directement : navigateur web (<strong>HTTP</strong>), mail (<strong>SMTP</strong>), résolution de noms (<strong>DNS</strong>). C’est l’étage le plus « humain ».</p>'],
        ['6 · Présentation — la mise en forme', '<p>Elle <strong>traduit, compresse et chiffre</strong> les données pour qu’elles soient compréhensibles : <strong>TLS</strong> (le « cadenas » HTTPS), formats <strong>JPEG</strong>, encodage des caractères.</p>'],
        ['5 · Session — le dialogue', '<p>Elle <strong>ouvre, maintient et ferme</strong> la conversation entre deux applications et gère l’<strong>authentification</strong> de la session. C’est elle qui gère le fait de « rester connecté » le temps de l’échange.</p>'],
        ['4 · Transport — la livraison fiable', '<p>Elle découpe les données en segments et garantit (ou non) leur arrivée. <strong>TCP</strong> = fiable, avec accusé de réception (web, mail). <strong>UDP</strong> = rapide sans garantie (visio, jeu). C’est ici qu’interviennent les <strong>ports</strong>.</p>'],
        ['3 · Réseau — l’adressage et le chemin', '<p>Elle attribue les <strong>adresses IP</strong> et choisit la <strong>route</strong> entre les réseaux. C’est la couche du <strong>routeur</strong>.</p>'],
        ['2 · Liaison — le voisin direct', '<p>Elle gère la communication entre deux appareils <strong>directement reliés</strong>, via les <strong>adresses MAC</strong>. C’est la couche du <strong>switch</strong> et d’<strong>Ethernet</strong> ; les données y sont des <em>trames</em>.</p>'],
        ['1 · Physique — le signal', '<p>Le plus concret : <strong>câbles, fibre, ondes WiFi, signaux électriques</strong>. Elle transporte les <strong>bits</strong> (0 et 1) sous forme de signal. Un câble débranché = problème de couche 1.</p>'],
      ]),
      note('yellow','🧠 Moyen mnémotechnique', '<p>De la couche <strong>1 à 7</strong> : « <strong>Pour</strong> <strong>Les</strong> <strong>Rendre</strong> <strong>Terriblement</strong> <strong>Séduisant</strong>, <strong>Pourrissez</strong> les d’<strong>Argent</strong> » → <strong>P</strong>hysique, <strong>L</strong>iaison, <strong>R</strong>éseau, <strong>T</strong>ransport, <strong>S</strong>ession, <strong>P</strong>résentation, <strong>A</strong>pplication.</p>'),
      block('heading', { level: 2, text: 'OSI vs TCP/IP : le modèle en 4 couches' }),
      block('html', { html: '<p>OSI est un modèle <strong>théorique</strong> à 7 couches. En pratique, Internet repose sur le modèle <strong>TCP/IP</strong>, plus simple, qui <strong>regroupe les 7 couches OSI en 4</strong> :</p>'
        + `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:480px;font-size:14px"><thead><tr style="background:var(--surface-2)"><th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">Modèle TCP/IP (4 couches)</th><th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">Couches OSI correspondantes</th></tr></thead><tbody>`
        + `${[['Application', '7 Application · 6 Présentation · 5 Session'], ['Transport', '4 Transport'], ['Internet', '3 Réseau'], ['Accès réseau', '2 Liaison · 1 Physique']].map(r => `<tr><td style="padding:8px 10px;border:1px solid var(--border);font-weight:600">${r[0]}</td><td style="padding:8px 10px;border:1px solid var(--border)">${r[1]}</td></tr>`).join('')}`
        + `</tbody></table></div>` }),
      note('blue', '🔌 Et le « port applicatif » ?', '<p>Le <strong>port</strong> qui identifie une application ou un service (ex. <strong>80</strong> = web, <strong>443</strong> = HTTPS, <strong>25</strong> = mail) appartient à la <strong>couche 4 (Transport)</strong> : c’est lui qui aiguille les données vers la <strong>bonne application</strong>. À ne pas confondre avec le port <strong>physique</strong> RJ45 (couche 1).</p>'),
      block('heading', { level: 2, text: 'Pourquoi c’est utile en maintenance' }),
      block('html', { html: '<p>Le modèle OSI est l’outil n°1 du <strong>dépannage méthodique</strong> : on diagnostique <strong>couche par couche</strong>, de bas en haut. Le câble est-il branché (1) ? La carte réseau a-t-elle un lien (2) ? L’adresse IP est-elle correcte (3) ? Le service répond-il sur son port (4) ? Le site s’affiche-t-il (7) ? On isole ainsi la panne au bon étage.</p>' }),
      note('green', '💡 À retenir', '<p>OSI = <strong>7 couches</strong>, du <strong>câble</strong> (1) à l’<strong>application</strong> (7). Switch ≈ couche 2, routeur ≈ couche 3, ports/TCP ≈ couche 4. C’est une <strong>grille de lecture</strong> pour comprendre et dépanner. Sigles dans le <a href="/glossaire">Glossaire</a>.</p>'),
    ],
  },
  // ---------- TICKETING ----------
  {
    slug: 'le-ticketing', title: 'Le ticketing', eyebrow: 'Cours · Maintenance',
    excerpt: 'Le ticketing : gérer les demandes et incidents en support informatique — cycle de vie, priorités, outils.',
    blocks: [
      block('hero', { eyebrow: 'Cours · Maintenance', title: 'Le ticketing', subtitle: 'La méthode pour tracer, prioriser et résoudre les demandes et incidents informatiques.' }),
      block('html', { html: '<p>Le <strong>ticketing</strong> est la manière d’<strong>organiser le support informatique</strong> : chaque demande ou incident d’un utilisateur devient un <strong>ticket</strong> — une fiche numérotée qu’on suit du début à la fin. Fini les demandes perdues dans les mails ou les couloirs : tout est <strong>tracé, attribué et priorisé</strong>.</p>' }),
      note('blue', '🔎 Analogie', '<p>C’est le <strong>ticket de caisse du SAV</strong>. À l’atelier de réparation, on te remet un numéro ; ton appareil suit un parcours (reçu → en réparation → prêt) et tu peux demander « où en est mon dossier ? ». Le ticketing fait pareil pour chaque problème informatique.</p>'),
      block('heading', { level: 2, text: 'Le cycle de vie d’un ticket' }),
      block('html', { html: svgTicket }),
      block('html', { html: '<p>Un ticket passe par des <strong>états</strong> : <strong>Nouveau</strong> (créé, pas encore pris), <strong>En cours</strong> (un technicien travaille dessus), <strong>En attente</strong> (besoin d’une info ou d’un tiers), <strong>Résolu</strong> (solution appliquée), puis <strong>Fermé</strong> (l’utilisateur a confirmé que c’est réglé).</p>' }),
      block('heading', { level: 2, text: 'Les notions importantes' }),
      accordion([
        ['🎫 Demande vs Incident', '<p>Un <strong>incident</strong> = quelque chose est <strong>cassé</strong> (« je n’ai plus d’imprimante »). Une <strong>demande</strong> = un <strong>besoin</strong> normal (« créez-moi un accès »). On les traite différemment.</p>'],
        ['🚦 La priorité (urgence × impact)', '<p>La priorité se calcule en croisant l’<strong>urgence</strong> et l’<strong>impact</strong>. Un serveur de paie HS la veille du virement (impact fort + urgent) passe avant une souris à remplacer. Cela évite de traiter « premier arrivé, premier servi » bêtement.</p>'],
        ['⏱️ Le SLA (engagement de délai)', '<p>Le <strong>SLA</strong> (<em>Service Level Agreement</em>) fixe les <strong>délais promis</strong> : ex. « prise en charge sous 1 h, résolution sous 8 h » pour une priorité haute. Le ticket affiche un <strong>compte à rebours</strong> pour respecter l’engagement.</p>'],
        ['🪜 L’escalade (niveaux 1, 2, 3)', '<p>Le <strong>niveau 1</strong> traite les cas courants ; s’il ne sait pas, il <strong>escalade</strong> au <strong>niveau 2</strong> (plus spécialisé), puis au <strong>niveau 3</strong> (experts/éditeur). On ne bloque pas un ticket : on le fait monter.</p>'],
        ['📚 La base de connaissances', '<p>Les solutions trouvées sont <strong>documentées</strong> (KB). Le prochain technicien — ou l’utilisateur en self-service — retrouve la procédure et gagne du temps. Un bon ticketing <strong>capitalise</strong> le savoir.</p>'],
      ]),
      block('heading', { level: 2, text: 'Outils courants' }),
      block('html', { html: '<ul><li>🟢 <strong>GLPI</strong> — très répandu en France, gratuit, gère aussi l’inventaire du parc.</li><li>🔵 <strong>osTicket</strong>, <strong>Zammad</strong> — solutions libres de helpdesk.</li><li>🟣 <strong>Jira Service Management</strong>, <strong>ServiceNow</strong>, <strong>Zendesk</strong> — solutions d’entreprise.</li></ul>' }),
      note('yellow','🧩 Et ITIL ?', '<p>Le ticketing applique des bonnes pratiques formalisées par <strong>ITIL</strong>, le référentiel de gestion des services informatiques (gestion des incidents, des demandes, des problèmes…). Pas besoin de tout connaître : retiens le <strong>vocabulaire</strong> (incident, priorité, SLA, escalade).</p>'),
      note('green', '💡 À retenir', '<p>Ticketing = <strong>tracer</strong> chaque demande/incident, la <strong>prioriser</strong> (urgence × impact), respecter un <strong>SLA</strong> et <strong>escalader</strong> si besoin. Outil emblématique : <strong>GLPI</strong>. Vocabulaire (SLA, ITIL, KB…) dans le <a href="/glossaire">Glossaire</a>.</p>'),
    ],
  },
];

// ===================================================================================
// HUB « Cours » — 4 colonnes (Hardware | Software puis Réseau | Maintenance)
// ===================================================================================
const HARDWARE: Array<[string, string]> = [
  ['/pages/hardware', 'Le hardware'],
  ['/pages/les-form-factor', 'Les form factors'],
  ['/pages/ports-arriere-carte-mere', 'Les ports arrière de la carte-mère'],
  ['/pages/carte-mere', 'La carte-mère — connectique interne'],
  ['/pages/le-chipset', 'Le chipset'],
  ['/pages/le-processeur', 'Le processeur (CPU)'],
  ['/pages/le-raid', 'Les niveaux de RAID'],
];
const SOFTWARE: Array<[string, string]> = [
  ['/pages/le-systeme-exploitation', 'Le système d’exploitation'],
  ['/pages/demarrage-bios-uefi', 'Le démarrage : BIOS & UEFI'],
  ['/pages/systemes-de-fichiers', 'Les systèmes de fichiers'],
  ['/pages/gestion-ordinateur-windows', 'La gestion de l’ordinateur'],
  ['/pages/base-de-registre', 'La base de registre'],
  ['/pages/windows-server', 'Windows Server'],
  ['/pages/gestionnaire-de-serveurs', 'Le gestionnaire de serveurs'],
];
const RESEAU: Array<[string, string]> = [
  ['/pages/le-routeur', 'Le routeur'],
  ['/pages/le-switch', 'Le switch'],
  ['/pages/le-pare-feu', 'Le pare-feu'],
];
const MAINTENANCE: Array<[string, string]> = [
  ['/pages/les-7-couches-osi', 'Les 7 couches OSI'],
  ['/pages/le-ticketing', 'Le ticketing'],
];

const col = (icon: string, name: string, sub: string, links: Array<[string, string]>, emptyMsg?: string): PageBlock[] => [
  block('heading', { level: 2, text: `${icon} ${name}` }),
  block('html', { html: `<p class="meta">${sub}</p>` }),
  ...(links.length
    ? links.map(([href, label], i) => block('button', { label, href, variant: i < 4 ? 'primary' : 'secondary' }))
    : [note('blue', '🚧 Bientôt', `<p>${emptyMsg || 'Aucun cours pour le moment.'}</p>`)]),
];

const hubBlocks: PageBlock[] = buildHubBlocks();

// ===================================================================================
// EXÉCUTION
// ===================================================================================
function cookieFrom(res: Response): string {
  const sc = (res.headers as any).getSetCookie?.() as string[] | undefined;
  return (sc && sc.length ? sc : [res.headers.get('set-cookie') || '']).map(c => c.split(';')[0]).filter(Boolean).join('; ');
}
async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: PW }) });
  if (!login.ok) throw new Error(`login ${login.status}`);
  const cookie = cookieFrom(login);
  const h = { 'Content-Type': 'application/json', Cookie: cookie };
  const existing = await (await fetch(`${BASE}/api/admin/pages`, { headers: { Cookie: cookie } })).json() as Array<{ id: number; slug: string }>;

  for (const p of PAGES) {
    const cur = existing.find(e => e.slug === p.slug);
    const bodyJson = JSON.stringify({ title: p.title, slug: p.slug, excerpt: p.excerpt, content: renderPageBlocksToHtml(p.blocks), builder_json: serializePageBlocks(p.blocks), published: 1 });
    const res = cur
      ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body: bodyJson })
      : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body: bodyJson });
    console.log(`PAGE ${p.slug}`, res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());
  }

  const cours = existing.find(e => e.slug === 'cours');
  if (cours) {
    const res = await fetch(`${BASE}/api/admin/pages/${cours.id}`, { method: 'PUT', headers: h, body: JSON.stringify({ title: 'Cours', slug: 'cours', content: renderPageBlocksToHtml(hubBlocks), builder_json: serializePageBlocks(hubBlocks), published: 1 }) });
    console.log('HUB Cours', res.status, res.ok ? '(4 colonnes)' : await res.text());
  } else console.log('HUB Cours introuvable');

  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

/* Crée deux pages de cours : « Les adresses IP » et « Les adresses MAC ».
   Vulgarisé, avec analogies et schémas. Complète « Les bases du réseau ».
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-adresses-ip-mac.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);

const C = { net: '#2563eb', dev: '#059669', warn: '#d97706', danger: '#dc2626', grey: '#64748b', slate: '#475569', purple: '#7c3aed' };
const accordion = (it: Array<[string, string]>) => block('accordion', { items: it.map(([title, text]) => ({ title, text, href: '' })) });
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const esc = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const code = (lines: string[]) => `<pre style="background:var(--surface-2);border:1px solid var(--border);padding:10px 12px;border-radius:8px;overflow-x:auto;font-size:13px;line-height:1.55;margin:8px 0"><code>${lines.map(esc).join('\n')}</code></pre>`;

// ===== Helpers schémas =====
function box(x: number, y: number, w: number, h: number, fill: string, label: string, sub = ''): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}"/>`
    + `<text x="${x + w / 2}" y="${y + (sub ? h / 2 - 2 : h / 2 + 4)}" text-anchor="middle" font-size="14" fill="#fff" font-weight="bold">${label}</text>`
    + (sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 14}" text-anchor="middle" font-size="10" fill="#e5e7eb">${sub}</text>` : '');
}
const line = (x1: number, y1: number, x2: number, y2: number, col = '#94a3b8') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="2.5"/>`;
const wrap = (w: number, h: number, inner: string) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="max-width:${w}px;width:100%;height:auto;margin:6px 0 12px;font-family:system-ui,sans-serif">${inner}</svg>`;
const cap = (x: number, y: number, t: string, col = '#64748b', s = 11) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${s}" fill="${col}">${t}</text>`;
const dot = (x: number, y: number) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="20" fill="${C.slate}" font-weight="bold">.</text>`;
const colon = (x: number, y: number) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="18" fill="${C.slate}" font-weight="bold">:</text>`;
function arr(x1: number, x2: number, y: number, col: string, label: string): string {
  const head = x2 > x1 ? `<polygon points="${x2},${y} ${x2 - 9},${y - 5} ${x2 - 9},${y + 5}" fill="${col}"/>` : `<polygon points="${x2},${y} ${x2 + 9},${y - 5} ${x2 + 9},${y + 5}" fill="${col}"/>`;
  return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${col}" stroke-width="2.5"/>${head}<text x="${(x1 + x2) / 2}" y="${y - 8}" text-anchor="middle" font-size="11" fill="#475569" font-weight="bold">${label}</text>`;
}

// ===================================================================================
// SCHÉMAS — IP
// ===================================================================================
const svgIpStruct = wrap(470, 152,
  cap(183, 26, 'Partie RÉSEAU (le quartier)', C.net, 11) + cap(383, 26, 'Partie MACHINE', C.dev, 11)
  + line(40, 34, 326, 34, C.net) + line(340, 34, 426, 34, C.dev)
  + box(40, 46, 86, 40, C.net, '192') + dot(133, 72) + box(140, 46, 86, 40, C.net, '168') + dot(233, 72) + box(240, 46, 86, 40, C.net, '1') + dot(333, 72) + box(340, 46, 86, 40, C.dev, '10')
  + cap(235, 108, 'Masque 255.255.255.0  (noté /24) : il sépare le réseau de la machine.', C.slate, 11)
  + cap(235, 138, 'Une adresse IPv4 = 4 nombres de 0 à 255, séparés par des points.', C.grey, 11));

const ipTable = `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:520px;font-size:14px">
<thead><tr style="background:var(--surface-2)">${['Adresse', 'Type', 'Rôle'].map(c => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${c}</th>`).join('')}</tr></thead><tbody>
${[
  ['127.0.0.1', 'Boucle locale', 'La machine elle-même (test en local)'],
  ['10.x · 172.16–31.x · 192.168.x.y', 'Privées (LAN)', 'Réseaux locaux, invisibles depuis Internet'],
  ['169.254.x.y', 'APIPA (auto)', 'Auto-attribuée si le DHCP ne répond pas — signe d’un souci'],
  ['ex. 88.12.34.56', 'Publique (WAN)', 'Unique sur Internet, fournie par le FAI'],
].map(r => `<tr>${r.map((c, i) => `<td style="padding:8px 10px;border:1px solid var(--border)${i === 0 ? ';font-weight:600;font-family:ui-monospace,monospace' : ''}">${c}</td>`).join('')}</tr>`).join('')}
</tbody></table></div>`;

// Tableau des classes d'adresses IP (historique / classful)
const C2 = { net: '#2563eb', dev: '#059669', warn: '#d97706', danger: '#dc2626', grey: '#64748b', purple: '#7c3aed' };
const ipClassRows: Array<[string, string, string, string, string, string]> = [
  ['A', '1 – 126', '/8 (255.0.0.0)', '≈ 16 millions d’hôtes / réseau', 'Très grandes organisations', C2.danger],
  ['B', '128 – 191', '/16 (255.255.0.0)', '≈ 65 000 hôtes / réseau', 'Réseaux moyens à grands', C2.warn],
  ['C', '192 – 223', '/24 (255.255.255.0)', '254 hôtes / réseau', 'Petits réseaux (le plus courant)', C2.dev],
  ['D', '224 – 239', '—', '—', 'Multicast (diffusion à un groupe)', C2.purple],
  ['E', '240 – 255', '—', '—', 'Réservée / expérimentale', C2.grey],
];
const ipClasses = `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:640px;font-size:14px">
<thead><tr style="background:var(--surface-2)">
${['Classe', '1ᵉʳ octet', 'Masque par défaut', 'Taille', 'Usage'].map(c => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${c}</th>`).join('')}
</tr></thead><tbody>
${ipClassRows.map(([cl, oct, mask, size, usage, col]) => `<tr>`
  + `<td style="padding:8px 10px;border:1px solid var(--border);text-align:center;font-weight:700;color:#fff;background:${col}">${cl}</td>`
  + `<td style="padding:8px 10px;border:1px solid var(--border);font-family:ui-monospace,monospace">${oct}</td>`
  + `<td style="padding:8px 10px;border:1px solid var(--border);font-family:ui-monospace,monospace">${mask}</td>`
  + `<td style="padding:8px 10px;border:1px solid var(--border)">${size}</td>`
  + `<td style="padding:8px 10px;border:1px solid var(--border)">${usage}</td></tr>`).join('')}
</tbody></table></div>`;

// ===================================================================================
// SCHÉMAS — MAC
// ===================================================================================
const svgMacStruct = wrap(540, 150,
  cap(150, 26, 'Fabricant (OUI)', C.purple, 11) + cap(384, 26, 'Numéro de série', C.dev, 11)
  + line(30, 34, 270, 34, C.purple) + line(282, 34, 522, 34, C.dev)
  + box(30, 46, 66, 40, C.purple, 'A1') + colon(102, 73) + box(108, 46, 66, 40, C.purple, 'B2') + colon(180, 73) + box(186, 46, 66, 40, C.purple, 'C3') + colon(258, 73)
  + box(282, 46, 66, 40, C.dev, 'D4') + colon(354, 73) + box(360, 46, 66, 40, C.dev, 'E5') + colon(432, 73) + box(438, 46, 66, 40, C.dev, 'F6')
  + cap(270, 110, '48 bits = 6 octets en hexadécimal (00 à FF).', C.slate, 11)
  + cap(270, 134, '3 premiers octets = fabricant · 3 derniers = numéro unique de la carte.', C.grey, 11));

const macVsIp = `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:520px;font-size:14px">
<thead><tr style="background:var(--surface-2)"><th style="text-align:left;padding:8px 10px;border:1px solid var(--border)"></th><th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">🆔 Adresse MAC</th><th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">🏷️ Adresse IP</th></tr></thead><tbody>
${[
  ['Couche', '2 — Liaison', '3 — Réseau'],
  ['Nature', 'Gravée, fixe', 'Logique, peut changer'],
  ['Portée', 'Locale (le réseau local)', 'Mondiale (jusqu’à Internet)'],
  ['Utilisée par', 'Le switch', 'Le routeur'],
  ['Exemple', 'A1:B2:C3:D4:E5:F6', '192.168.1.10'],
].map(r => `<tr><td style="padding:8px 10px;border:1px solid var(--border);font-weight:600">${r[0]}</td><td style="padding:8px 10px;border:1px solid var(--border)">${r[1]}</td><td style="padding:8px 10px;border:1px solid var(--border)">${r[2]}</td></tr>`).join('')}
</tbody></table></div>`;

const svgArp = wrap(560, 168,
  box(20, 12, 110, 36, C.net, 'PC A') + box(430, 12, 110, 36, C.slate, 'PC B')
  + `<line x1="75" y1="48" x2="75" y2="148" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="4 4"/>`
  + `<line x1="485" y1="48" x2="485" y2="148" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="4 4"/>`
  + arr(75, 485, 86, C.net, 'ARP : qui a l’IP 192.168.1.20 ?')
  + arr(485, 75, 126, C.dev, 'C’est moi ! Ma MAC = B4:7E:...')
  + cap(280, 160, 'ARP traduit une adresse IP en adresse MAC sur le réseau local.', C.grey, 11));

// ===================================================================================
// PAGE 1 — LES ADRESSES IP
// ===================================================================================
const ipBlocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Réseau', title: 'Les adresses IP', subtitle: 'L’adresse d’un appareil sur le réseau, pour que les données arrivent au bon endroit.' }),
  block('html', { html: '<p>Une <strong>adresse IP</strong> (<em>Internet Protocol</em>) identifie un appareil <strong>sur un réseau</strong>. C’est grâce à elle que les données savent <strong>où aller</strong>. Sans adresse IP, impossible de communiquer : c’est la base de tout échange réseau.</p>' }),
  note('blue', '🔎 Analogie', '<p>L’adresse IP, c’est l’<strong>adresse postale</strong> d’une maison : <strong>rue + numéro</strong>. Pour qu’une lettre arrive, il faut l’adresse complète. Si tu déménages, ton adresse change — l’IP aussi peut <strong>changer</strong> selon le réseau où tu te connectes.</p>'),

  block('heading', { level: 2, text: '🔢 C’est quoi, concrètement ?' }),
  block('html', { html: '<p>Une adresse <strong>IPv4</strong> s’écrit avec <strong>4 nombres de 0 à 255</strong>, séparés par des points : par exemple <code>192.168.1.10</code>. Chaque nombre tient sur 8 bits, soit <strong>32 bits</strong> en tout.</p>' }),
  block('html', { html: svgIpStruct }),

  block('heading', { level: 2, text: '🧭 Réseau + machine : le masque' }),
  accordion([
    ['🏘️ Partie réseau & partie machine', '<p>Une IP se découpe en deux : la <strong>partie réseau</strong> (le « quartier ») et la <strong>partie machine</strong> (le « numéro de maison »). Deux appareils du <strong>même réseau</strong> partagent la même partie réseau et peuvent se parler <strong>directement</strong>.</p>'],
    ['🧮 Le masque de sous-réseau', '<p>Le <strong>masque</strong> (ex. <code>255.255.255.0</code>) indique <strong>où couper</strong> entre réseau et machine. Ici les 3 premiers nombres = réseau, le dernier = machine. On le note souvent en <strong>CIDR</strong> : <code>/24</code> (24 bits pour le réseau).</p>'],
    ['🚪 La passerelle', '<p>Pour sortir du réseau local, les appareils passent par la <strong>passerelle</strong> (souvent l’IP de la box, ex. <code>192.168.1.254</code>) — la « porte du quartier ». Voir <a href="/pages/le-routeur">le routeur</a>.</p>'],
  ]),

  block('heading', { level: 2, text: '🗂️ Les classes d’adresses IP' }),
  block('html', { html: '<p>Historiquement, l’espace IPv4 a été découpé en <strong>classes</strong> (A à E). La <strong>classe</strong> se reconnaît au <strong>premier nombre</strong> de l’adresse, et elle imposait un <strong>masque par défaut</strong> — donc une taille de réseau. <strong>Analogie :</strong> des <strong>tailles de quartiers</strong> prédéfinies — un immense quartier (A), un moyen (B), un petit (C).</p>' }),
  block('html', { html: ipClasses }),
  accordion([
    ['🟥 Classe A (1 – 126)', '<p>Masque <code>/8</code> : <strong>1 nombre pour le réseau, 3 pour les machines</strong> → très <strong>peu de réseaux</strong> mais <strong>énormément d’hôtes</strong> (≈ 16 millions). Réservée aux <strong>très grandes organisations</strong>. ⚠️ <code>127.x.x.x</code> est mis de côté pour la <strong>boucle locale</strong> (d’où l’arrêt à 126).</p>'],
    ['🟧 Classe B (128 – 191)', '<p>Masque <code>/16</code> : <strong>2 nombres réseau, 2 machines</strong> → ≈ <strong>65 000 hôtes</strong> par réseau. Pour les réseaux <strong>moyens à grands</strong> (universités, grandes entreprises).</p>'],
    ['🟩 Classe C (192 – 223)', '<p>Masque <code>/24</code> : <strong>3 nombres réseau, 1 machine</strong> → <strong>254 hôtes</strong> utilisables par réseau. La plus <strong>courante</strong> pour les <strong>petits réseaux</strong> (la fameuse plage <code>192.168.x.y</code> en fait partie).</p>'],
    ['🟪 Classe D (224 – 239)', '<p>Pas de notion d’hôtes : réservée au <strong>multicast</strong>, c’est-à-dire l’envoi d’un même flux à <strong>un groupe</strong> d’appareils à la fois (ex. streaming, visioconférence).</p>'],
    ['⬛ Classe E (240 – 255)', '<p>Réservée à des usages <strong>expérimentaux</strong> et à la recherche : on ne l’utilise pas dans les réseaux courants.</p>'],
  ]),
  note('yellow', '⚠️ Les classes, c’est surtout historique', '<p>Aujourd’hui on n’est <strong>plus limité</strong> par les classes : avec le <strong>CIDR</strong> (masque de longueur variable, ex. <code>/26</code>), on découpe les réseaux <strong>sur mesure</strong>. Les classes restent utiles pour <strong>reconnaître une plage d’un coup d’œil</strong> et comprendre les masques par défaut — mais en pratique, c’est le <strong>masque</strong> qui fait foi, pas la classe.</p>'),

  block('heading', { level: 2, text: '🏠 Privées, publiques & spéciales' }),
  block('html', { html: '<p>Toutes les IP ne se valent pas : certaines sont réservées aux réseaux locaux, d’autres à Internet.</p>' }),
  block('html', { html: ipTable }),
  accordion([
    ['🏠 Les adresses privées', '<p><code>192.168.x.y</code>, <code>10.x.x.x</code>, <code>172.16–31.x.x</code> sont <strong>privées</strong> : utilisées dans les réseaux locaux, <strong>invisibles depuis Internet</strong>. C’est pour ça que plein de box utilisent <code>192.168.1.x</code> sans conflit.</p>'],
    ['🌍 L’adresse publique (WAN)', '<p>L’<strong>IP publique</strong> est <strong>unique au monde</strong>, attribuée par ton <strong>fournisseur d’accès</strong>. Tous tes appareils privés sortent <strong>derrière elle</strong> grâce au <strong>NAT</strong>.</p>'],
    ['🔁 127.0.0.1 & 169.254.x.y', '<p><code>127.0.0.1</code> = la <strong>machine elle-même</strong> (test local). <code>169.254.x.y</code> = adresse <strong>APIPA</strong> auto-attribuée quand le <strong>DHCP ne répond pas</strong> — souvent le signe d’un câble débranché ou d’un serveur DHCP en panne.</p>'],
  ]),

  note('blue', '🏛️ Qui attribue les adresses IP ? — l’IANA', '<p>L’<strong>IANA</strong> (<em>Internet Assigned Numbers Authority</em>) est une composante de l’<strong>ICANN</strong>, chargée de l’<strong>enregistrement et de l’attribution</strong> des <strong>noms de domaine</strong>, des <strong>adresses IP</strong> et des autres <strong>noms et numéros</strong> utilisés par les protocoles Internet (numéros de ports, de protocoles…). Elle <strong>délègue</strong> ensuite par région à des registres comme le <strong>RIPE NCC</strong> (Europe), qui répartissent les adresses aux fournisseurs d’accès.</p>'),

  block('heading', { level: 2, text: '⚙️ Statique ou dynamique (DHCP)' }),
  block('html', { html: '<p>Une IP peut être <strong>fixe</strong> (configurée à la main, pour un serveur ou une imprimante) ou <strong>dynamique</strong> : attribuée automatiquement par le <strong>DHCP</strong> à chaque connexion. <strong>Analogie :</strong> l’hôtel qui te donne un numéro de chambre à l’arrivée. La plupart des PC sont en <strong>DHCP</strong>.</p>' }),

  note('yellow', '🔮 IPv4 & IPv6', '<p>L’<strong>IPv4</strong> (32 bits) offre ~4 milliards d’adresses… presque <strong>épuisées</strong>. D’où l’<strong>IPv6</strong> (128 bits), écrite en hexadécimal (ex. <code>2001:0db8::1</code>), qui offre un nombre <strong>colossal</strong> d’adresses. Les deux coexistent aujourd’hui.</p>'),

  block('heading', { level: 2, text: '🔎 Voir son adresse IP' }),
  block('html', { html: code(['# Windows', 'ipconfig', '', '# Linux / macOS', 'ip a        (ou : ifconfig)']) }),

  note('green', '💡 À retenir', '<p>Une <strong>IP</strong> = l’adresse d’un appareil sur le réseau (4 nombres de 0 à 255). Le <strong>masque</strong> sépare <strong>réseau</strong> et <strong>machine</strong>. Il y a des IP <strong>privées</strong> (LAN) et une IP <strong>publique</strong> (Internet). Elle est souvent attribuée par <strong>DHCP</strong>. À ne pas confondre avec l’<a href="/pages/adresses-mac">adresse MAC</a> (l’identité matérielle). Voir aussi <a href="/pages/bases-du-reseau">les bases du réseau</a>. Sigles dans le <a href="/glossaire">Glossaire</a>.</p>'),
];

// ===================================================================================
// PAGE 2 — LES ADRESSES MAC
// ===================================================================================
const macBlocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Réseau', title: 'Les adresses MAC', subtitle: 'L’identité matérielle, gravée dans chaque carte réseau.' }),
  block('html', { html: '<p>Une <strong>adresse MAC</strong> (<em>Media Access Control</em>) est l’<strong>identifiant unique</strong> d’une carte réseau, <strong>gravé à la fabrication</strong>. Chaque appareil connecté (PC, téléphone, imprimante…) en possède une, et en principe <strong>aucune n’est identique</strong> au monde.</p>' }),
  note('blue', '🔎 Analogie', '<p>L’adresse MAC, c’est le <strong>numéro de série</strong> ou la <strong>plaque d’immatriculation</strong> de l’appareil : il est <strong>fixe</strong> et le suit partout. L’<strong>IP</strong>, elle, est l’adresse <strong>du moment</strong> (où il se trouve) ; la <strong>MAC</strong> est son <strong>identité permanente</strong> (qui il est).</p>'),

  block('heading', { level: 2, text: '🔢 C’est quoi, concrètement ?' }),
  block('html', { html: '<p>Une adresse MAC fait <strong>48 bits</strong>, écrite en <strong>6 octets hexadécimaux</strong> séparés par des « : » — par exemple <code>A1:B2:C3:D4:E5:F6</code>. Chaque octet va de <strong>00 à FF</strong>.</p>' }),
  block('html', { html: svgMacStruct }),

  block('heading', { level: 2, text: '🏭 Sa structure : fabricant + numéro' }),
  accordion([
    ['🏭 Les 3 premiers octets — le fabricant (OUI)', '<p>Les <strong>3 premiers octets</strong> forment l’<strong>OUI</strong> (<em>Organizationally Unique Identifier</em>) : ils identifient le <strong>fabricant</strong> de la carte (Intel, Realtek, Apple…). On peut retrouver la marque d’un appareil rien qu’avec ça.</p>'],
    ['🔢 Les 3 derniers octets — le numéro de série', '<p>Les <strong>3 derniers octets</strong> sont un <strong>numéro unique</strong> attribué par le fabricant à chaque carte. Fabricant + numéro = une adresse <strong>unique au monde</strong>.</p>'],
  ]),

  block('heading', { level: 2, text: '🆚 MAC vs IP' }),
  block('html', { html: '<p>On confond souvent les deux. La règle : la <strong>MAC</strong> dit <strong>qui</strong> tu es (identité fixe), l’<strong>IP</strong> dit <strong>où</strong> tu es (adresse logique).</p>' }),
  block('html', { html: macVsIp }),

  block('heading', { level: 2, text: '🛠️ À quoi ça sert ?' }),
  accordion([
    ['🔀 Le switch (table MAC)', '<p>Le <strong>switch</strong> apprend la MAC de chaque appareil et la mémorise dans sa <strong>table MAC</strong> : « telle MAC est sur tel port ». Il livre ainsi chaque trame <strong>directement</strong> au bon port. Voir <a href="/pages/le-switch">le switch</a>.</p>'],
    ['🔗 ARP (IP → MAC)', '<p>Pour parler à un appareil, on connaît son <strong>IP</strong>, mais sur le réseau local il faut sa <strong>MAC</strong>. Le protocole <strong>ARP</strong> fait la traduction : il demande « <em>qui a cette IP ?</em> » et reçoit la MAC en réponse.</p>'],
    ['🚫 Le filtrage MAC', '<p>On peut <strong>autoriser ou bloquer</strong> des appareils selon leur MAC (ex. sur un Wi-Fi). Pratique, mais pas une vraie sécurité : la MAC peut être <strong>usurpée</strong> (<em>MAC spoofing</em>).</p>'],
  ]),
  block('html', { html: svgArp }),

  block('heading', { level: 2, text: '🔎 Voir son adresse MAC' }),
  block('html', { html: code(['# Windows', 'ipconfig /all        (ligne « Adresse physique »)', 'getmac', '', '# Linux / macOS', 'ip link        (ou : ifconfig)']) }),

  note('green', '💡 À retenir', '<p>Une <strong>MAC</strong> = l’<strong>identité matérielle</strong> d’une carte réseau (48 bits, 6 octets hex), <strong>gravée et fixe</strong>. Les 3 premiers octets = <strong>fabricant</strong>, les 3 derniers = <strong>numéro unique</strong>. Elle sert au <strong>switch</strong> (couche 2) et à <strong>ARP</strong>. À ne pas confondre avec l’<a href="/pages/adresses-ip">adresse IP</a> (logique, qui change). Voir aussi <a href="/pages/les-7-couches-osi">les 7 couches OSI</a>. Sigles dans le <a href="/glossaire">Glossaire</a>.</p>'),
];

const PAGES = [
  { slug: 'adresses-ip', title: 'Les adresses IP', excerpt: 'L’adresse IP expliquée simplement : format IPv4, réseau/machine et masque, adresses privées/publiques, DHCP, IPv4/IPv6 — avec analogies et schémas.', blocks: ipBlocks },
  { slug: 'adresses-mac', title: 'Les adresses MAC', excerpt: 'L’adresse MAC expliquée simplement : identité matérielle gravée, structure fabricant/série, MAC vs IP, switch et ARP — avec analogies et schémas.', blocks: macBlocks },
];

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
    const body = JSON.stringify({ title: p.title, slug: p.slug, excerpt: p.excerpt, content: renderPageBlocksToHtml(p.blocks), builder_json: serializePageBlocks(p.blocks), published: 1 });
    const res = cur
      ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body })
      : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
    console.log(`PAGE ${p.slug}`, res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());
  }

  const cours = existing.find(e => e.slug === 'cours');
  if (cours) {
    const hubBlocks = buildHubBlocks();
    const r = await fetch(`${BASE}/api/admin/pages/${cours.id}`, { method: 'PUT', headers: h, body: JSON.stringify({ title: 'Cours', slug: 'cours', content: renderPageBlocksToHtml(hubBlocks), builder_json: serializePageBlocks(hubBlocks), published: 1 }) });
    console.log('HUB Cours', r.status, r.ok ? '(maj)' : await r.text());
  } else console.log('HUB Cours introuvable');

  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

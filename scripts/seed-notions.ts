/* Crée la page « Notions clés (lexique illustré) » : regroupe les concepts cités dans les cours
   mais sans page dédiée (NAT, VPN, DMZ, VLAN, PoE, DNS, DHCP, ARP, proxy, QoS). Vulgarisé,
   schémas inline + listes à boutons vers les cours liés.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-notions.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });

const C = { net: '#2563eb', dev: '#059669', warn: '#d97706', danger: '#dc2626', grey: '#64748b', slate: '#475569', purple: '#7c3aed' };
function box(x: number, y: number, w: number, h: number, fill: string, label: string, sub = ''): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}"/>`
    + `<text x="${x + w / 2}" y="${y + (sub ? h / 2 - 2 : h / 2 + 4)}" text-anchor="middle" font-size="12" fill="#fff" font-weight="bold">${label}</text>`
    + (sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 14}" text-anchor="middle" font-size="9" fill="#e5e7eb">${sub}</text>` : '');
}
const line = (x1: number, y1: number, x2: number, y2: number, col = '#94a3b8') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="2.5"/>`;
const wrap = (w: number, h: number, inner: string) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="max-width:${w}px;width:100%;height:auto;margin:6px 0 12px;font-family:system-ui,sans-serif">${inner}</svg>`;
const cap = (x: number, y: number, t: string, col = '#64748b', s = 11) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${s}" fill="${col}">${t}</text>`;
function icCloud(cx: number, cy: number) {
  return `<g fill="${C.grey}"><ellipse cx="${cx}" cy="${cy + 8}" rx="34" ry="12" /><circle cx="${cx - 18}" cy="${cy + 2}" r="13"/><circle cx="${cx + 16}" cy="${cy}" r="14"/><circle cx="${cx - 1}" cy="${cy - 9}" r="14"/></g>`
    + `<text x="${cx}" y="${cy + 6}" text-anchor="middle" font-size="11" fill="#fff" font-weight="bold">Internet</text>`;
}
function arr(x1: number, x2: number, y: number, col: string, label: string): string {
  const head = x2 > x1 ? `<polygon points="${x2},${y} ${x2 - 9},${y - 5} ${x2 - 9},${y + 5}" fill="${col}"/>` : `<polygon points="${x2},${y} ${x2 + 9},${y - 5} ${x2 + 9},${y + 5}" fill="${col}"/>`;
  return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${col}" stroke-width="2.5"/>${head}<text x="${(x1 + x2) / 2}" y="${y - 7}" text-anchor="middle" font-size="11" fill="#475569" font-weight="bold">${label}</text>`;
}

// ===== Schémas =====
const svgNat = wrap(520, 176,
  `<rect x="14" y="22" width="150" height="132" rx="10" fill="${C.net}" fill-opacity="0.06" stroke="${C.net}" stroke-width="1.5" stroke-dasharray="6 4"/><text x="24" y="40" font-size="10" fill="${C.net}" font-weight="bold">LAN (privé)</text>`
  + box(24, 48, 130, 26, C.dev, '192.168.1.10') + box(24, 82, 130, 26, C.dev, '192.168.1.11') + box(24, 116, 130, 26, C.dev, '192.168.1.12')
  + line(164, 88, 210, 88, C.slate) + box(210, 66, 120, 44, C.grey, 'Routeur (NAT)', 'priv .1 / pub 88.x')
  + line(330, 88, 384, 88, C.net) + icCloud(440, 88)
  + cap(255, 170, 'Plusieurs IP privées partagent UNE seule IP publique (NAT).'));

const svgVpn = wrap(520, 150,
  box(20, 60, 100, 40, C.net, 'Site A')
  + `<line x1="120" y1="80" x2="240" y2="72" stroke="${C.purple}" stroke-width="2.5" stroke-dasharray="6 4"/>`
  + icCloud(280, 72)
  + `<line x1="320" y1="72" x2="400" y2="80" stroke="${C.purple}" stroke-width="2.5" stroke-dasharray="6 4"/>`
  + box(400, 60, 100, 40, C.dev, 'Site B')
  + `<text x="280" y="116" text-anchor="middle" font-size="11" fill="${C.purple}" font-weight="bold">tunnel VPN chiffré</text>`
  + cap(260, 138, 'Relie deux sites à travers Internet, de façon privée.'));

const svgDmz = wrap(520, 190,
  icCloud(260, 30)
  + line(260, 44, 260, 72, C.slate) + box(218, 72, 84, 32, C.danger, 'Pare-feu')
  + line(260, 104, 150, 128, C.slate) + line(260, 104, 405, 128, C.slate)
  + box(60, 128, 170, 40, C.net, 'LAN interne', 'privé')
  + box(320, 128, 170, 40, C.warn, 'DMZ', 'serveurs exposés')
  + cap(260, 184, 'La DMZ accueille les serveurs publics, à l’écart du réseau interne.'));

const svgVlan = wrap(520, 180,
  box(205, 18, 110, 30, C.net, 'Switch')
  + line(260, 48, 120, 86, C.slate) + line(260, 48, 400, 86, C.slate)
  + `<rect x="30" y="86" width="180" height="74" rx="10" fill="${C.dev}" fill-opacity="0.07" stroke="${C.dev}" stroke-width="1.5" stroke-dasharray="6 4"/><text x="40" y="104" font-size="10" fill="${C.dev}" font-weight="bold">VLAN 10 — Compta</text>`
  + box(46, 112, 70, 26, C.dev, 'PC') + box(128, 112, 70, 26, C.dev, 'PC')
  + `<rect x="310" y="86" width="180" height="74" rx="10" fill="${C.warn}" fill-opacity="0.07" stroke="${C.warn}" stroke-width="1.5" stroke-dasharray="6 4"/><text x="320" y="104" font-size="10" fill="${C.warn}" font-weight="bold">VLAN 20 — Prod</text>`
  + box(326, 112, 70, 26, C.warn, 'PC') + box(408, 112, 70, 26, C.warn, 'PC')
  + cap(260, 174, 'Un même switch, deux réseaux logiques isolés (VLAN).'));

const svgDns = wrap(520, 140,
  box(20, 50, 120, 40, C.net, 'PC')
  + arr(140, 360, 66, C.net, 'www.exemple.fr ?') + arr(360, 140, 102, C.dev, '93.184.x.x')
  + box(360, 50, 140, 40, C.slate, 'Serveur DNS')
  + cap(260, 128, 'Le DNS traduit un nom en adresse IP — c’est l’annuaire.'));

const svgDhcp = wrap(520, 140,
  box(20, 50, 150, 40, C.net, 'Nouvel appareil')
  + arr(170, 350, 66, C.net, 'une adresse IP, svp ?') + arr(350, 170, 102, C.dev, 'voici 192.168.1.50')
  + box(350, 50, 150, 40, C.slate, 'Serveur DHCP')
  + cap(260, 128, 'Le DHCP attribue automatiquement une IP à l’arrivée.'));

// Bouton « cours lié »
const linkBtn = (label: string, href: string) => block('button', { label: `📘 Voir : ${label}`, href, variant: 'secondary' });

// ===================================================================================
const SLUG = 'notions-complementaires';
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Réseau', title: 'Notions clés (lexique illustré)', subtitle: 'Les concepts souvent cités, expliqués simplement — avec un schéma et un cours pour aller plus loin.' }),
  block('html', { html: '<p>Tu croises souvent ces sigles dans les autres cours sans qu’ils aient leur propre page : les voici réunis et <strong>vulgarisés</strong>. Chaque notion a une <strong>analogie</strong>, parfois un <strong>schéma</strong>, et un <strong>bouton</strong> vers le cours qui l’approfondit.</p>' }),
  note('blue', '🧭 D’abord les bases', '<p>Si ces notions te semblent floues, commence par les fondamentaux :</p>'),
  block('button', { label: '🌐 Les bases du réseau', href: '/pages/bases-du-reseau', variant: 'primary' }),
  block('button', { label: '🏷️ Les adresses IP', href: '/pages/adresses-ip', variant: 'primary' }),
  block('button', { label: '🧱 Les 7 couches OSI', href: '/pages/les-7-couches-osi', variant: 'primary' }),

  block('heading', { level: 2, text: '🌐 Connexion & cloisonnement' }),

  block('heading', { level: 3, text: 'NAT — partager une IP publique' }),
  block('html', { html: '<p>Le <strong>NAT</strong> (<em>Network Address Translation</em>) permet à <strong>plusieurs appareils privés</strong> (192.168.x.y) de sortir sur Internet derrière <strong>une seule adresse IP publique</strong>. Le routeur note qui a demandé quoi et renvoie chaque réponse au bon appareil. <strong>Analogie :</strong> le <strong>standard téléphonique</strong> d’une entreprise — un seul numéro public, plein de postes internes.</p>' }),
  block('html', { html: svgNat }),
  linkBtn('Le routeur', '/pages/le-routeur'),

  block('heading', { level: 3, text: 'VPN — un tunnel privé sur Internet' }),
  block('html', { html: '<p>Un <strong>VPN</strong> (<em>Virtual Private Network</em>) crée un <strong>tunnel chiffré</strong> à travers Internet pour relier deux sites (ou un télétravailleur au bureau) comme s’ils étaient sur le <strong>même réseau local</strong>, en toute confidentialité. <strong>Analogie :</strong> un <strong>tunnel opaque et privé</strong> creusé sous une autoroute publique.</p>' }),
  block('html', { html: svgVpn }),
  linkBtn('Réseau d’entreprise', '/pages/reseau-entreprise'),

  block('heading', { level: 3, text: 'DMZ — la zone tampon' }),
  block('html', { html: '<p>La <strong>DMZ</strong> (zone démilitarisée) est une <strong>zone tampon</strong> entre Internet et le réseau interne, où l’on place les <strong>serveurs exposés</strong> (web, mail). Si un pirate compromet la DMZ, il <strong>n’atteint pas</strong> le réseau interne. <strong>Analogie :</strong> le <strong>sas d’accueil</strong> d’un bâtiment, séparé des bureaux.</p>' }),
  block('html', { html: svgDmz }),
  linkBtn('Les schémas d’infrastructure', '/pages/schemas-infrastructure'),

  block('heading', { level: 3, text: 'VLAN — découper un switch' }),
  block('html', { html: '<p>Un <strong>VLAN</strong> (réseau local <strong>virtuel</strong>) découpe un même switch en <strong>plusieurs réseaux logiques isolés</strong>, sans tirer de nouveaux câbles (ex. séparer la Compta de la Production). <strong>Analogie :</strong> des <strong>cloisons amovibles</strong> dans un open-space.</p>' }),
  block('html', { html: svgVlan }),
  linkBtn('Le switch', '/pages/le-switch'),

  block('heading', { level: 3, text: 'PoE — l’électricité par le câble réseau' }),
  block('html', { html: '<p>Le <strong>PoE</strong> (<em>Power over Ethernet</em>) fait passer <strong>l’électricité ET les données</strong> dans le même câble RJ45, pour alimenter une <strong>borne Wi-Fi</strong> ou une <strong>caméra</strong> sans prise électrique à côté. <strong>Analogie :</strong> un seul tuyau qui apporte <strong>l’eau et le courant</strong>.</p>' }),
  linkBtn('Le switch', '/pages/le-switch'),

  block('heading', { level: 2, text: '🧠 Services & adressage' }),

  block('heading', { level: 3, text: 'DNS — l’annuaire des noms' }),
  block('html', { html: '<p>Le <strong>DNS</strong> (<em>Domain Name System</em>) traduit les <strong>noms</strong> (ex. <code>www.exemple.fr</code>) en <strong>adresses IP</strong>, car les machines ne se parlent qu’en chiffres. <strong>Analogie :</strong> l’<strong>annuaire</strong> téléphonique (un nom → un numéro).</p>' }),
  block('html', { html: svgDns }),
  linkBtn('Les rôles de Windows Server', '/pages/roles-windows-server'),

  block('heading', { level: 3, text: 'DHCP — l’attribution automatique d’IP' }),
  block('html', { html: '<p>Le <strong>DHCP</strong> attribue <strong>automatiquement</strong> une adresse IP (plus le masque, la passerelle et le DNS) à chaque appareil qui se connecte, évitant toute config manuelle. <strong>Analogie :</strong> l’<strong>hôtel</strong> qui donne un numéro de chambre à l’arrivée.</p>' }),
  block('html', { html: svgDhcp }),
  linkBtn('Le gestionnaire de serveurs', '/pages/gestionnaire-de-serveurs'),

  block('heading', { level: 3, text: 'ARP — du nom IP à l’adresse MAC' }),
  block('html', { html: '<p>L’<strong>ARP</strong> (<em>Address Resolution Protocol</em>) fait le lien entre une <strong>adresse IP</strong> et une <strong>adresse MAC</strong> sur le réseau local : « <em>qui a l’IP 192.168.1.20 ? → c’est moi, voici ma MAC</em> ». <strong>Analogie :</strong> demander « <strong>qui est M. Dupont ?</strong> » dans une salle pour repérer la bonne personne.</p>' }),
  linkBtn('Les adresses MAC', '/pages/adresses-mac'),

  block('heading', { level: 3, text: 'Proxy — l’intermédiaire web' }),
  block('html', { html: '<p>Un <strong>proxy</strong> est un <strong>intermédiaire</strong> entre les postes et Internet : il relaie les requêtes web, peut <strong>filtrer / bloquer</strong> des sites et mettre des pages <strong>en cache</strong>. <strong>Analogie :</strong> un <strong>majordome</strong> qui va chercher les choses à ta place et filtre les visiteurs.</p>' }),
  linkBtn('Le pare-feu', '/pages/le-pare-feu'),

  block('heading', { level: 3, text: 'QoS — prioriser le trafic' }),
  block('html', { html: '<p>La <strong>QoS</strong> (<em>Quality of Service</em>) <strong>priorise</strong> certains trafics (visio, voix) sur d’autres (téléchargements) pour garantir une bonne expérience quand le réseau est <strong>chargé</strong>. <strong>Analogie :</strong> une <strong>voie réservée aux ambulances</strong> dans les embouteillages.</p>' }),
  linkBtn('TCP & UDP', '/pages/tcp-et-udp'),

  note('green', '💡 À retenir', '<p>Ces notions reviennent partout : <strong>NAT</strong> (partager l’IP publique), <strong>VPN</strong> (tunnel privé), <strong>DMZ</strong> (zone tampon), <strong>VLAN</strong> (cloisonner), <strong>PoE</strong> (alimenter par le câble), <strong>DNS</strong> (noms→IP), <strong>DHCP</strong> (IP automatique), <strong>ARP</strong> (IP→MAC), <strong>proxy</strong> (intermédiaire web), <strong>QoS</strong> (priorités). Tous les sigles sont aussi dans le <a href="/glossaire">Glossaire</a>.</p>'),
  block('button', { label: '📖 Tous les cours', href: '/pages/cours', variant: 'primary' }),
  block('button', { label: '📘 Le glossaire', href: '/glossaire', variant: 'secondary' }),
];

const PAGE = { slug: SLUG, title: 'Notions clés (lexique illustré)', excerpt: 'Les notions réseau souvent citées sans cours dédié — NAT, VPN, DMZ, VLAN, PoE, DNS, DHCP, ARP, proxy, QoS — expliquées simplement, avec schémas et liens vers les cours.' };

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
  const cur = existing.find(e => e.slug === PAGE.slug);
  const body = JSON.stringify({ title: PAGE.title, slug: PAGE.slug, excerpt: PAGE.excerpt, content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1 });
  const res = cur
    ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body })
    : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log(`PAGE ${PAGE.slug}`, res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());

  const cours = existing.find(e => e.slug === 'cours');
  if (cours) {
    const hub = buildHubBlocks();
    const r = await fetch(`${BASE}/api/admin/pages/${cours.id}`, { method: 'PUT', headers: h, body: JSON.stringify({ title: 'Cours', slug: 'cours', content: renderPageBlocksToHtml(hub), builder_json: serializePageBlocks(hub), published: 1 }) });
    console.log('HUB Cours', r.status, r.ok ? '(maj)' : await r.text());
  } else console.log('HUB Cours introuvable');

  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

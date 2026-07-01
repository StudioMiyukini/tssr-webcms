/* Crée la page « Les routes statiques en CLI » (Cisco Packet Tracer) : configurer manuellement
   le chemin vers un réseau distant avec « ip route ». Vulgarisé + schéma + commandes.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cisco-route-statique.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const esc = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const code = (lines: string[]) => `<pre style="background:var(--surface-2);border:1px solid var(--border);padding:10px 12px;border-radius:8px;overflow-x:auto;font-size:13.5px;line-height:1.6;margin:8px 0"><code>${lines.map(esc).join('\n')}</code></pre>`;

const C = { net: '#2563eb', dev: '#059669', warn: '#d97706', danger: '#dc2626', grey: '#64748b', slate: '#475569' };
function box(x: number, y: number, w: number, h: number, fill: string, label: string): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}"/><text x="${x + w / 2}" y="${y + h / 2 + 5}" text-anchor="middle" font-size="13" fill="#fff" font-weight="bold">${label}</text>`;
}
const line = (x1: number, y1: number, x2: number, y2: number, col = '#94a3b8') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="2.5"/>`;
const wrap = (w: number, h: number, inner: string) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="max-width:${w}px;width:100%;height:auto;margin:8px 0 12px;font-family:system-ui,sans-serif">${inner}</svg>`;
const cap = (x: number, y: number, t: string, col = '#64748b', s = 11) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${s}" fill="${col}">${t}</text>`;
const zone = (x: number, y: number, w: number, h: number, col: string, label: string) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${col}" fill-opacity="0.07" stroke="${col}" stroke-width="1.5" stroke-dasharray="6 4"/><text x="${x + 10}" y="${y + 16}" font-size="11" fill="${col}" font-weight="bold">${label}</text>`;

// Schéma : 2 routeurs reliés, chacun son LAN
const svgTopo = wrap(640, 280,
  box(95, 60, 120, 44, C.slate, 'Routeur R1') + box(425, 60, 120, 44, C.slate, 'Routeur R2')
  + line(215, 82, 425, 82, C.net)
  + cap(320, 74, '10.0.0.0/30', C.net, 11)
  + `<text x="222" y="98" font-size="10" fill="#64748b" font-family="ui-monospace,monospace">.1</text><text x="406" y="98" font-size="10" fill="#64748b" font-family="ui-monospace,monospace">.2</text>`
  + zone(40, 150, 235, 116, C.dev, 'LAN 192.168.1.0/24')
  + line(150, 104, 150, 150, C.slate) + `<text x="156" y="138" font-size="9" fill="#64748b" font-family="ui-monospace,monospace">Fa0/0 .254</text>`
  + box(70, 196, 70, 28, C.dev, 'PC') + box(180, 196, 70, 28, C.dev, 'PC')
  + zone(365, 150, 235, 116, C.warn, 'LAN 192.168.2.0/24')
  + line(490, 104, 490, 150, C.slate) + `<text x="496" y="138" font-size="9" fill="#64748b" font-family="ui-monospace,monospace">Fa0/0 .254</text>`
  + box(395, 196, 70, 28, C.warn, 'PC') + box(505, 196, 70, 28, C.warn, 'PC')
  + cap(320, 276, 'R1 ignore le LAN de R2 (et inversement) : il faut une route statique de chaque côté.'));

// ===================================================================================
const SLUG = 'cisco-route-statique';
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cisco Packet Tracer · Routeurs', title: 'Les routes statiques en CLI', subtitle: 'Indiquer manuellement à un routeur le chemin vers un réseau distant.' }),
  block('html', { html: '<p>Un routeur ne connaît au départ que les <strong>réseaux directement connectés</strong> à ses interfaces. Pour joindre un <strong>réseau distant</strong> (derrière un autre routeur), il faut lui <strong>indiquer le chemin</strong>. Une <strong>route statique</strong>, c’est une route écrite <strong>à la main</strong> par l’administrateur.</p>' }),
  note('blue', '🔎 Analogie', '<p>Une route statique, c’est un <strong>panneau de direction posé à la main</strong> : « pour aller au réseau X, prends cette sortie ». À l’inverse, le <strong>routage dynamique</strong> (OSPF, RIP…) est un <strong>GPS</strong> qui calcule et met à jour les chemins tout seul. Le statique est simple et fiable sur les petits réseaux.</p>'),

  block('heading', { level: 2, text: '🗺️ Le besoin (exemple fil rouge)' }),
  block('html', { html: svgTopo }),
  block('html', { html: '<p>R1 et R2 sont reliés par le réseau <code>10.0.0.0/30</code> (R1 = <code>.1</code>, R2 = <code>.2</code>). Chacun a son LAN. Problème : R1 ne sait pas atteindre <code>192.168.2.0/24</code>, et R2 ne sait pas atteindre <code>192.168.1.0/24</code>. On va ajouter <strong>une route statique de chaque côté</strong>.</p>' }),

  block('heading', { level: 2, text: '🧩 La syntaxe' }),
  block('html', { html: '<p>La commande se tape en <strong>mode configuration globale</strong> :</p>' + code(['Router(config)# ip route <reseau_destination> <masque> <prochain_saut>']) }),
  block('html', { html: '<ul><li><strong>réseau destination</strong> + <strong>masque</strong> : le réseau distant à joindre (ex. <code>192.168.2.0 255.255.255.0</code>).</li><li><strong>prochain saut</strong> (<em>next hop</em>) : l’IP de l’interface du <strong>routeur voisin</strong> par laquelle passer (ex. <code>10.0.0.2</code>). On peut aussi mettre l’<strong>interface de sortie</strong> à la place.</li></ul>' }),

  block('heading', { level: 2, text: '⌨️ La procédure' }),
  block('html', { html: '<p><strong>Sur R1</strong> — pour joindre le LAN de R2, on passe par <code>10.0.0.2</code> :</p>' + code([
    'R1> enable',
    'R1# configure terminal',
    'R1(config)# ip route 192.168.2.0 255.255.255.0 10.0.0.2',
    'R1(config)# end',
    'R1# copy running-config startup-config',
  ]) }),
  block('html', { html: '<p><strong>Sur R2</strong> — pour joindre le LAN de R1, on passe par <code>10.0.0.1</code> :</p>' + code([
    'R2> enable',
    'R2# configure terminal',
    'R2(config)# ip route 192.168.1.0 255.255.255.0 10.0.0.1',
    'R2(config)# end',
    'R2# copy running-config startup-config',
  ]) }),
  note('yellow', '⚠️ Toujours dans les deux sens', '<p>Une route ne sert qu’à l’<strong>aller</strong>. Si tu n’as configuré la route que sur R1, les paquets <strong>partiront</strong> mais la <strong>réponse de R2 sera perdue</strong> : il faut une route <strong>de chaque côté</strong>. Symptôme classique : le ping ne passe pas alors qu’une seule route est posée.</p>'),

  block('heading', { level: 2, text: '🌍 La route par défaut' }),
  block('html', { html: '<p>Plutôt que d’écrire une route pour <strong>chaque</strong> réseau, on peut dire « <strong>tout ce que je ne connais pas, envoie-le par là</strong> » avec la <strong>route par défaut</strong> <code>0.0.0.0 0.0.0.0</code> (la <strong>passerelle de dernier recours</strong>) — très utile vers Internet :</p>' + code(['R1(config)# ip route 0.0.0.0 0.0.0.0 10.0.0.2']) }),

  block('heading', { level: 2, text: '🔍 Vérifier la table de routage' }),
  block('html', { html: '<p>Depuis le mode privilégié :</p>' + code([
    'R1# show ip route',
    '',
    'C    192.168.1.0/24 is directly connected, FastEthernet0/0',
    'C    10.0.0.0/30 is directly connected, FastEthernet0/1',
    'S    192.168.2.0/24 [1/0] via 10.0.0.2',
    'S*   0.0.0.0/0 [1/0] via 10.0.0.2',
  ]) }),
  block('html', { html: '<ul><li><strong>C</strong> = réseau <strong>directement connecté</strong>.</li><li><strong>S</strong> = route <strong>statique</strong> (celle qu’on a ajoutée).</li><li><strong>S*</strong> = route <strong>par défaut</strong>.</li><li><code>[1/0]</code> : <strong>distance administrative</strong> 1 (les statiques sont très prioritaires) / métrique 0.</li></ul>' }),
  note('blue', '🧪 Tester', '<p>Depuis un PC du LAN 1, fais un <code>ping 192.168.2.x</code> vers un PC du LAN 2. S’il passe, le routage statique fonctionne. Sinon, vérifie : les <strong>deux</strong> routes, les <strong>passerelles</strong> des PC, et que les interfaces sont <strong>up</strong> (<code>show ip interface brief</code>).</p>'),

  block('heading', { level: 2, text: '🔁 Variante : interface de sortie' }),
  block('html', { html: '<p>Sur une <strong>liaison point-à-point</strong> (série), on peut indiquer l’<strong>interface de sortie</strong> au lieu de l’IP du voisin :</p>' + code(['R1(config)# ip route 192.168.2.0 255.255.255.0 Serial0/0/0']) }),

  block('html', { html: '<p class="meta">📋 Résumé des commandes essentielles :</p>' + code([
    'ip route 192.168.2.0 255.255.255.0 10.0.0.2     ! route vers un reseau distant',
    'ip route 0.0.0.0 0.0.0.0 10.0.0.2               ! route par defaut',
    'no ip route 192.168.2.0 255.255.255.0 10.0.0.2  ! supprimer une route',
    'show ip route                                   ! voir la table de routage',
  ]) }),

  note('green', '💡 À retenir', '<p><strong>Route statique</strong> = chemin écrit à la main : <code>ip route &lt;réseau&gt; &lt;masque&gt; &lt;voisin&gt;</code>, en <strong>mode config</strong>. Il en faut une <strong>dans chaque sens</strong>. La <strong>route par défaut</strong> (<code>0.0.0.0 0.0.0.0</code>) gère « tout le reste ». On vérifie avec <code>show ip route</code> (C = connecté, S = statique). Voir aussi <a href="/pages/cisco-routeur-cli">Configurer un routeur en CLI</a>, <a href="/pages/le-routeur">Le routeur</a> et <a href="/pages/calcul-ip-masque">Calcul d’IP &amp; masque</a>.</p>'),
];

const PAGE = { slug: SLUG, title: 'Les routes statiques en CLI (Cisco Packet Tracer)', excerpt: 'Procédure CLI pour configurer des routes statiques sur des routeurs Cisco dans Packet Tracer : commande ip route, prochain saut, route par défaut et vérification (show ip route).' };

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

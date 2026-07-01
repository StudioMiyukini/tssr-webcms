/* Crée la page « Configurer un routeur en CLI » (Cisco Packet Tracer) : les modes Cisco
   et la configuration d'une interface (IP, masque, no shutdown). Vulgarisé + schéma + commandes.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cisco-routeur-cli.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const esc = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const code = (lines: string[]) => `<pre style="background:var(--surface-2);border:1px solid var(--border);padding:10px 12px;border-radius:8px;overflow-x:auto;font-size:13.5px;line-height:1.6;margin:8px 0"><code>${lines.map(esc).join('\n')}</code></pre>`;

const C = { net: '#2563eb', dev: '#059669', warn: '#d97706', danger: '#dc2626', grey: '#64748b', slate: '#475569' };
function box(x: number, y: number, w: number, h: number, fill: string, label: string, sub = ''): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}"/>`
    + `<text x="${x + 16}" y="${y + (sub ? h / 2 - 1 : h / 2 + 4)}" font-size="14" fill="#fff" font-weight="bold" font-family="ui-monospace,monospace">${label}</text>`
    + (sub ? `<text x="${x + 16}" y="${y + h / 2 + 15}" font-size="10" fill="#e5e7eb">${sub}</text>` : '');
}
const line = (x1: number, y1: number, x2: number, y2: number, col = '#94a3b8') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="2.5"/>`;
const wrap = (w: number, h: number, inner: string) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="max-width:${w}px;width:100%;height:auto;margin:8px 0 12px;font-family:system-ui,sans-serif">${inner}</svg>`;

// Schéma : les modes CLI Cisco (échelle)
const arrowDown = (x: number, y1: number, y2: number, label: string) =>
  `${line(x, y1, x, y2 - 8, C.slate)}<polygon points="${x},${y2} ${x - 5},${y2 - 9} ${x + 5},${y2 - 9}" fill="${C.slate}"/>`
  + `<text x="${x + 12}" y="${(y1 + y2) / 2 + 4}" font-size="11" fill="#475569" font-family="ui-monospace,monospace" font-weight="bold">${label}</text>`;
const svgModes = wrap(620, 364,
  box(60, 16, 380, 46, C.grey, 'Router>', 'mode utilisateur — consultation seule')
  + arrowDown(120, 62, 102, 'enable')
  + box(60, 102, 380, 46, C.net, 'Router#', 'mode privilégié — commandes d’admin')
  + arrowDown(120, 148, 188, 'configure terminal')
  + box(60, 188, 380, 46, C.warn, 'Router(config)#', 'configuration globale du routeur')
  + arrowDown(120, 234, 274, 'interface Fa0/0')
  + box(60, 274, 380, 46, C.dev, 'Router(config-if)#', 'configuration d’une interface précise')
  + `<text x="470" y="120" font-size="11" fill="${C.slate}" font-weight="bold">↑ exit</text><text x="470" y="136" font-size="10" fill="#64748b">remonter d’un</text><text x="470" y="150" font-size="10" fill="#64748b">cran de mode</text>`
  + `<text x="470" y="250" font-size="11" fill="${C.slate}" font-weight="bold">Ctrl+Z / end</text><text x="470" y="266" font-size="10" fill="#64748b">retour direct</text><text x="470" y="280" font-size="10" fill="#64748b">à Router#</text>`
  + `<text x="250" y="352" text-anchor="middle" font-size="11" fill="#64748b">Le prompt (>, #, (config)#, (config-if)#) indique toujours où tu te trouves.</text>`);

// ===================================================================================
const SLUG = 'cisco-routeur-cli';
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cisco Packet Tracer · Routeurs', title: 'Configurer un routeur en CLI', subtitle: 'Les modes Cisco et la configuration d’une interface (IP, masque, activation).' }),
  block('html', { html: '<p>Dans <strong>Cisco Packet Tracer</strong>, on configure un routeur en <strong>ligne de commande (CLI)</strong> : on clique sur le routeur → onglet <strong>CLI</strong>, et on tape les commandes. Le secret, c’est de comprendre les <strong>modes</strong> : on descend de niveau en niveau, et le <strong>prompt</strong> (le texte avant le curseur) indique toujours où on est.</p>' }),
  note('blue', '🔎 Analogie', '<p>Les modes, c’est comme des <strong>pièces de plus en plus privées</strong> : <code>Router&gt;</code> = l’<strong>accueil</strong> (on regarde), <code>Router#</code> = le <strong>bureau de l’admin</strong> (on agit), <code>Router(config)#</code> = la <strong>salle des machines</strong> (on configure), <code>Router(config-if)#</code> = <strong>devant une carte réseau</strong> précise.</p>'),

  block('heading', { level: 2, text: '🪜 Les modes du CLI Cisco' }),
  block('html', { html: svgModes }),

  block('heading', { level: 2, text: '⌨️ La procédure pas à pas' }),
  block('html', { html: '<p><strong>1.</strong> On passe en <strong>mode superviseur</strong> (privilégié) :</p>' + code(['Router> enable', 'Router#']) }),
  block('html', { html: '<p><strong>2.</strong> On passe en <strong>mode configuration</strong> :</p>' + code(['Router# configure terminal', 'Router(config)#']) }),
  block('html', { html: '<p><strong>3.</strong> On entre dans la configuration de l’interface <strong>FastEthernet 0/0</strong> :</p>' + code(['Router(config)# interface FastEthernet 0/0', 'Router(config-if)#']) }),
  block('html', { html: '<p><strong>4.</strong> On indique l’<strong>IP</strong> de l’interface et son <strong>masque de sous-réseau</strong>. Exemple : IP <code>192.168.1.254</code>, masque <code>255.255.255.0</code> :</p>' + code(['Router(config-if)# ip address 192.168.1.254 255.255.255.0']) }),
  block('html', { html: '<p><strong>5.</strong> On <strong>active</strong> l’interface (par défaut elle est éteinte) :</p>' + code(['Router(config-if)# no shutdown']) }),
  note('green', '✅ Résultat', '<p>Le routeur indique que la carte réseau <strong>0/0</strong> est devenue active :</p>' + code(['%LINK-5-CHANGED: Interface FastEthernet0/0, changed state to up', '%LINEPROTO-5-UPDOWN: Line protocol on Interface FastEthernet0/0, changed state to up'])),

  block('heading', { level: 2, text: '💾 Ne pas oublier : enregistrer la config !' }),
  block('html', { html: '<p>La configuration en cours (<strong>running-config</strong>) vit en mémoire vive : elle est <strong>perdue au redémarrage</strong>. Pour la conserver, on la copie dans la <strong>startup-config</strong> :</p>' + code(['Router(config-if)# end', 'Router# copy running-config startup-config', 'Destination filename [startup-config]?  (Entrée)', 'Building configuration...', '[OK]']) }),
  note('yellow', '💡 Raccourcis utiles', '<p><strong>end</strong> ou <strong>Ctrl+Z</strong> → revenir directement au mode privilégié (<code>Router#</code>). <strong>exit</strong> → remonter d’un seul cran. <strong>Tab</strong> → compléter une commande. <strong>?</strong> → afficher l’aide. <code>copy run start</code> et <code>wr</code> sont des abréviations de la sauvegarde.</p>'),

  block('heading', { level: 2, text: '🔍 Vérifier sa configuration' }),
  block('html', { html: '<p>Depuis le mode privilégié, deux commandes utiles :</p>' + code(['Router# show ip interface brief     ! état et IP de chaque interface', 'Router# show running-config         ! toute la configuration en cours']) }),

  block('html', { html: '<p class="meta">📋 La séquence complète, à copier :</p>' + code([
    'Router> enable',
    'Router# configure terminal',
    'Router(config)# interface FastEthernet 0/0',
    'Router(config-if)# ip address 192.168.1.254 255.255.255.0',
    'Router(config-if)# no shutdown',
    'Router(config-if)# end',
    'Router# copy running-config startup-config',
  ]) }),

  note('green', '💡 À retenir', '<p>On descend les <strong>modes</strong> : <code>enable</code> → <code>configure terminal</code> → <code>interface …</code>. On configure l’interface avec <strong>ip address &lt;ip&gt; &lt;masque&gt;</strong>, puis <strong>no shutdown</strong> pour l’activer, et on <strong>sauvegarde</strong> (<code>copy run start</code>). Le <strong>prompt</strong> te dit toujours où tu es. Voir aussi <a href="/pages/le-routeur">Le routeur</a>, <a href="/pages/adresses-ip">Les adresses IP</a> et <a href="/pages/calcul-ip-masque">Calcul d’IP &amp; masque</a>.</p>'),
];

const PAGE = { slug: SLUG, title: 'Configurer un routeur en CLI (Cisco Packet Tracer)', excerpt: 'Procédure CLI pour configurer un routeur Cisco dans Packet Tracer : les modes (enable, configure terminal, interface), l’attribution d’IP/masque, no shutdown et la sauvegarde de la configuration.' };

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

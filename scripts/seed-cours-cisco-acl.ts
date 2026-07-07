/* Cours « Les ACL : listes de contrôle d'accès » (Cisco Packet Tracer).
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-cisco-acl.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'cisco-acl', title: 'Les ACL : filtrer le trafic (listes de contrôle d’accès)', excerpt: 'Autoriser ou bloquer du trafic sur un routeur Cisco : ACL standard (source) vs étendue (source + destination + protocole + port), masque générique (wildcard), deny implicite, sens in/out et placement. Config CLI et vérifications.' };
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const styleBlock = block('html', { html: `<style>.ax-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}.ax-t{border-collapse:collapse;width:100%;font-size:13px;margin:6px 0}.ax-t th,.ax-t td{border:1px solid var(--border);padding:7px 10px;text-align:left}.ax-t th{background:var(--surface-2)}.ax-t td:first-child{font-family:ui-monospace,monospace;white-space:nowrap}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="ax-cmd">${esc(t)}</div>` });

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Cisco / Packet Tracer', title: PAGE.title, subtitle: 'Le pare-feu du routeur : décider, ligne par ligne, ce qui passe et ce qui est bloqué.' }),
  styleBlock,
  block('html', { html: '<p>Une <strong>ACL</strong> (<em>Access Control List</em>) est une <strong>liste de règles</strong> qui <strong>autorisent</strong> (<code>permit</code>) ou <strong>interdisent</strong> (<code>deny</code>) du trafic sur un routeur. On l’applique à une <strong>interface</strong>, dans un <strong>sens</strong> (entrant ou sortant). Le routeur lit les règles <strong>de haut en bas</strong> et s’arrête à la <strong>première qui correspond</strong>.</p>' }),
  note('yellow', '⚠️ Le « deny any » implicite', '<p>À la fin de toute ACL se cache une règle invisible : <strong><code>deny any</code></strong>. Tout ce qui n’est pas <strong>explicitement autorisé</strong> est donc <strong>rejeté</strong>. Il faut au moins un <code>permit</code>, sinon l’ACL bloque tout.</p>'),

  block('heading', { level: 2, text: '1) Standard vs étendue' }),
  block('html', { html: `<table class="ax-t"><thead><tr><th>Type</th><th>Numéros</th><th>Filtre sur</th><th>Où la placer</th></tr></thead><tbody>
    <tr><td><strong>Standard</strong></td><td>1–99 (1300–1999)</td><td>l’<strong>IP source</strong> uniquement</td><td>au plus <strong>près de la destination</strong></td></tr>
    <tr><td><strong>Étendue</strong></td><td>100–199 (2000–2699)</td><td>source + <strong>destination</strong> + <strong>protocole</strong> + <strong>port</strong></td><td>au plus <strong>près de la source</strong></td></tr>
  </tbody></table>` }),
  block('html', { html: '<p>On peut aussi les <strong>nommer</strong> (plus lisible) au lieu d’un numéro.</p>' }),

  block('heading', { level: 2, text: '2) Le masque générique (wildcard)' }),
  block('html', { html: '<p>Les ACL n’utilisent pas le masque réseau, mais son <strong>inverse</strong> : le <strong>wildcard</strong>. Un bit à <strong>0</strong> = « doit correspondre », un bit à <strong>1</strong> = « peu importe ». Astuce : <strong>wildcard = 255.255.255.255 − masque</strong>.</p>' }),
  block('html', { html: `<table class="ax-t"><thead><tr><th>Cible</th><th>Wildcard</th></tr></thead><tbody>
    <tr><td>un réseau /24 (192.168.10.0)</td><td>0.0.0.255</td></tr>
    <tr><td>un réseau /29</td><td>0.0.0.7</td></tr>
    <tr><td>un seul hôte</td><td>0.0.0.0 (ou mot-clé <code>host</code>)</td></tr>
    <tr><td>tout le monde</td><td>255.255.255.255 (ou mot-clé <code>any</code>)</td></tr>
  </tbody></table>` }),

  block('heading', { level: 2, text: '3) ACL standard — exemple' }),
  block('html', { html: '<p>Autoriser le réseau Admin (<code>192.168.10.72/29</code>) à joindre les serveurs, bloquer le reste. On place l’ACL <strong>en sortie</strong>, près de la destination :</p>' }),
  cmd(`access-list 10 permit 192.168.10.72 0.0.0.7
! (deny any implicite en dessous)
!
interface GigabitEthernet0/0
 ip access-group 10 out
 exit`),

  block('heading', { level: 2, text: '4) ACL étendue — exemple' }),
  block('html', { html: '<p>Autoriser uniquement le <strong>web (HTTP/HTTPS)</strong> depuis le LAN Atelier vers le serveur web, refuser le reste vers ce serveur. On la place <strong>près de la source</strong>, en entrée :</p>' }),
  cmd(`access-list 110 permit tcp 192.168.10.0 0.0.0.31 host 192.168.10.51 eq 80
access-list 110 permit tcp 192.168.10.0 0.0.0.31 host 192.168.10.51 eq 443
access-list 110 deny ip any host 192.168.10.51
access-list 110 permit ip any any
!
interface GigabitEthernet0/0
 ip access-group 110 in
 exit`),
  note('gray', '📝 Version nommée (équivalent)', '<div class="ax-cmd">ip access-list extended WEB-ONLY\n permit tcp 192.168.10.0 0.0.0.31 host 192.168.10.51 eq 80\n permit tcp 192.168.10.0 0.0.0.31 host 192.168.10.51 eq 443\n deny ip any host 192.168.10.51\n permit ip any any\n exit\ninterface Gig0/0\n ip access-group WEB-ONLY in</div>'),

  block('heading', { level: 2, text: '5) Bonnes pratiques' }),
  block('html', { html: `<ul>
    <li><strong>Ordre</strong> : les règles les plus <strong>spécifiques d’abord</strong> (une règle trop large en haut masque celles du dessous).</li>
    <li>Toujours prévoir un <strong><code>permit</code></strong> final si tu ne veux pas tout bloquer (à cause du <code>deny any</code> implicite).</li>
    <li><strong>Une seule ACL par interface, par sens, par protocole.</strong></li>
    <li><strong>Standard</strong> → près de la <strong>destination</strong> ; <strong>étendue</strong> → près de la <strong>source</strong> (on bloque tôt).</li>
  </ul>` }),

  block('heading', { level: 2, text: '6) Vérifier' }),
  cmd(`show access-lists            ! règles + compteur de correspondances
show ip interface Gig0/0     ! quelle ACL appliquée, dans quel sens`),
  note('yellow', '🛠️ Piège classique', '<p>Une ACL qui « bloque tout » : tu as oublié le <code>permit</code> et le <code>deny any</code> implicite rejette le trafic légitime. Vérifie avec <code>show access-lists</code> que le bon compteur augmente.</p>'),

  note('green', '🔗 Pour aller plus loin', '<p>Cours liés : <a href="/pages/le-pare-feu">Le pare-feu</a> (le concept), <a href="/pages/cisco-nat">NAT / PAT</a> (utilise une ACL), <a href="/pages/cisco-routeur-cli">Configurer un routeur en CLI</a>, <a href="/pages/tcp-et-udp">TCP & UDP</a> (les ports filtrés).</p>'),
];

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
  const res = cur ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body }) : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log(`PAGE ${PAGE.slug}`, res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());
  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

/* Cours « NAT / PAT : la translation d'adresses » (Cisco Packet Tracer).
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-cisco-nat.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'cisco-nat', title: 'NAT / PAT : la translation d’adresses', excerpt: 'Faire sortir un réseau privé vers Internet avec une (ou peu d’) adresse(s) publique(s) : NAT statique (1:1), NAT dynamique (pool) et surtout PAT/overload (plusieurs machines derrière une IP, via les ports). Notions inside/outside, config CLI Cisco et vérifications.' };
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const styleBlock = block('html', { html: `<style>.nx-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}.nx-t{border-collapse:collapse;width:100%;font-size:13px;margin:6px 0}.nx-t th,.nx-t td{border:1px solid var(--border);padding:7px 10px;text-align:left}.nx-t th{background:var(--surface-2)}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="nx-cmd">${esc(t)}</div>` });

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Cisco / Packet Tracer', title: PAGE.title, subtitle: 'Comment tout un réseau privé sort sur Internet derrière une seule adresse publique.' }),
  styleBlock,
  block('html', { html: '<p>Le <strong>NAT</strong> (<em>Network Address Translation</em>) <strong>remplace</strong> l’adresse IP <strong>privée</strong> d’un paquet par une adresse <strong>publique</strong> quand il sort vers Internet (et fait l’inverse au retour). Sans lui, les adresses privées (192.168.x, 10.x, 172.16-31.x) — non routables sur Internet — ne pourraient pas communiquer avec l’extérieur.</p>' }),
  note('blue', '🎯 Pourquoi', '<ul><li>La <strong>pénurie d’IPv4</strong> : on ne peut pas donner une IP publique à chaque machine.</li><li><strong>Économie</strong> : tout un LAN partage <strong>une seule</strong> IP publique (celle du routeur/box).</li><li><strong>Masquage</strong> : l’adressage interne n’est pas visible depuis l’extérieur.</li></ul>'),

  block('heading', { level: 2, text: '1) Inside / Outside' }),
  block('html', { html: '<p>Sur le routeur, on désigne l’interface <strong>interne</strong> (côté LAN privé) et l’interface <strong>externe</strong> (côté Internet) :</p>' }),
  cmd(`interface GigabitEthernet0/0
 ip nat inside
 exit
interface GigabitEthernet0/1
 ip nat outside
 exit`),

  block('heading', { level: 2, text: '2) Les trois formes de NAT' }),
  block('html', { html: `<table class="nx-t"><thead><tr><th>Type</th><th>Principe</th><th>Usage</th></tr></thead><tbody>
    <tr><td><strong>NAT statique</strong></td><td>correspondance <strong>fixe 1:1</strong> (une privée ↔ une publique)</td><td>publier un <strong>serveur</strong> interne accessible de l’extérieur</td></tr>
    <tr><td><strong>NAT dynamique</strong></td><td>un <strong>pool</strong> d’IP publiques attribuées au fur et à mesure</td><td>rare (il faut plusieurs IP publiques)</td></tr>
    <tr><td><strong>PAT (overload)</strong></td><td><strong>plusieurs</strong> privées → <strong>une seule</strong> publique, différenciées par le <strong>numéro de port</strong></td><td><strong>le cas courant</strong> : tout le LAN derrière l’IP du routeur/box</td></tr>
  </tbody></table>` }),
  note('gray', '🔌 Pourquoi « PAT »', '<p>PAT = <em>Port Address Translation</em>. Le routeur note, pour chaque connexion, le port source ; au retour, il sait à quelle machine interne renvoyer la réponse. C’est ce qui permet à des dizaines de PC de partager une IP publique — aussi appelé <strong>overload</strong> chez Cisco, ou <em>masquerade</em> côté Linux.</p>'),

  block('heading', { level: 2, text: '3) Configurer le PAT (overload) — le cas courant' }),
  block('html', { html: '<p>On désigne <strong>qui</strong> a le droit d’être traduit (une ACL), puis on le traduit vers l’<strong>interface externe</strong>, en mode <code>overload</code> :</p>' }),
  cmd(`! 1) définir les réseaux internes autorisés (ACL)
access-list 1 permit 192.168.10.0 0.0.0.255
!
! 2) traduire vers l'interface externe, en surcharge
ip nat inside source list 1 interface GigabitEthernet0/1 overload`),
  block('html', { html: '<p>(Les interfaces doivent déjà être marquées <code>ip nat inside</code> / <code>ip nat outside</code>, étape 1.) Tout le <code>192.168.10.0/24</code> sortira désormais avec l’IP de <code>Gig0/1</code>.</p>' }),

  block('heading', { level: 2, text: '4) NAT statique (publier un serveur)' }),
  block('html', { html: '<p>Pour rendre un serveur interne (ex. web <code>192.168.10.51</code>) joignable depuis Internet sur une IP publique <code>203.0.113.10</code> :</p>' }),
  cmd(`! 1:1 complet
ip nat inside source static 192.168.10.51 203.0.113.10
!
! ou uniquement un port (redirection de port / PAT statique)
ip nat inside source static tcp 192.168.10.51 80 203.0.113.10 80`),

  block('heading', { level: 2, text: '5) Vérifier' }),
  cmd(`show ip nat translations      ! table des traductions actives
show ip nat statistics        ! compteurs, interfaces inside/outside
clear ip nat translation *    ! purger la table (test)`),
  note('yellow', '🛠️ Dépannage courant', '<ul><li>Pas de sortie Internet → interfaces <code>inside</code>/<code>outside</code> inversées ou manquantes.</li><li>L’ACL ne couvre pas le bon réseau → aucune traduction (table vide).</li><li>Il faut aussi une <strong>route</strong> vers l’extérieur (souvent une <a href="/pages/cisco-route-statique">route par défaut</a> <code>ip route 0.0.0.0 0.0.0.0 …</code>).</li></ul>'),

  note('green', '🔗 Pour aller plus loin', '<p>Cours liés : <a href="/pages/cisco-routeur-cli">Configurer un routeur en CLI</a>, <a href="/pages/cisco-route-statique">Les routes statiques</a>, <a href="/pages/cisco-acl">Les ACL</a> (le NAT s’appuie sur une ACL), <a href="/pages/adresses-ip">Les adresses IP</a> (privées/publiques).</p>'),
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

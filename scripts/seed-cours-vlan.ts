/* Cours « Les VLAN & le routage inter-VLAN » (Réseau / Cisco Packet Tracer).
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-vlan.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'les-vlan', title: 'Les VLAN & le routage inter-VLAN', excerpt: 'Segmenter un réseau logiquement : VLAN, ports access/trunk, marquage 802.1Q et VLAN natif, puis faire communiquer les VLAN (router-on-a-stick avec sous-interfaces ou switch niveau 3). Config CLI Cisco et vérifications.' };
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const styleBlock = block('html', { html: `<style>.vl-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}.vl-t{border-collapse:collapse;width:100%;font-size:13px;margin:6px 0}.vl-t th,.vl-t td{border:1px solid var(--border);padding:7px 10px;text-align:left}.vl-t th{background:var(--surface-2)}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="vl-cmd">${esc(t)}</div>` });

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Réseau / Cisco', title: PAGE.title, subtitle: 'Découper un commutateur en plusieurs réseaux logiques, puis les faire dialoguer.' }),
  styleBlock,
  block('html', { html: '<p>Un <strong>VLAN</strong> (<em>Virtual LAN</em>) découpe un switch physique en <strong>plusieurs réseaux logiques indépendants</strong>. Deux machines sur des VLAN différents, même branchées sur le même switch, <strong>ne se voient pas</strong> directement (comme si elles étaient sur deux switches séparés).</p>' }),
  note('blue', '🎯 Pourquoi segmenter en VLAN', '<ul><li><strong>Sécurité / isolation</strong> : séparer les services (Admin, Production, Serveurs, Wi-Fi invité) sans multiplier le matériel.</li><li><strong>Réduction du broadcast</strong> : chaque VLAN est un domaine de broadcast distinct → moins de trafic parasite.</li><li><strong>Souplesse</strong> : un utilisateur change de VLAN par configuration, pas par recâblage.</li></ul>'),

  block('heading', { level: 2, text: '1) Ports access vs trunk' }),
  block('html', { html: `<table class="vl-t"><thead><tr><th>Type de port</th><th>Rôle</th></tr></thead><tbody>
    <tr><td><strong>Access</strong></td><td>relie <strong>un équipement final</strong> (PC, imprimante). Le port appartient à <strong>un seul VLAN</strong>. Les trames y circulent <strong>sans étiquette</strong>.</td></tr>
    <tr><td><strong>Trunk</strong></td><td>relie <strong>deux switches</strong> (ou un switch et un routeur). Il transporte <strong>plusieurs VLAN</strong> sur un seul câble, en <strong>étiquetant</strong> chaque trame (802.1Q).</td></tr>
  </tbody></table>` }),
  note('gray', '🏷️ Le marquage 802.1Q', '<p>Sur un trunk, le switch insère une <strong>étiquette</strong> (tag) dans la trame Ethernet contenant le <strong>numéro de VLAN</strong>. Le switch d’en face lit le tag pour savoir à quel VLAN appartient la trame. Le <strong>VLAN natif</strong> (natif = 1 par défaut) est le seul à circuler <strong>sans</strong> tag sur le trunk — c’est pour ça qu’il doit être <strong>identique des deux côtés</strong>.</p>'),

  block('heading', { level: 2, text: '2) Créer les VLAN et affecter les ports (access)' }),
  block('html', { html: '<p>Sur le switch : on crée les VLAN, puis on place chaque port d’accès dans son VLAN.</p>' }),
  cmd(`enable
configure terminal
vlan 10
 name Admin
 exit
vlan 20
 name Production
 exit
!
interface FastEthernet0/1
 switchport mode access
 switchport access vlan 10
 exit
interface range FastEthernet0/2 - 12
 switchport mode access
 switchport access vlan 20
 exit
end
write memory`),

  block('heading', { level: 2, text: '3) Configurer le trunk (entre switches)' }),
  cmd(`interface GigabitEthernet0/1
 switchport mode trunk
 switchport trunk native vlan 99
 switchport trunk allowed vlan 10,20,99
 exit`),
  block('html', { html: '<p>On n’autorise que les VLAN nécessaires (<code>allowed vlan</code>) et on aligne le <strong>VLAN natif</strong> des deux côtés.</p>' }),

  block('heading', { level: 2, text: '4) Faire communiquer les VLAN (routage inter-VLAN)' }),
  block('html', { html: '<p>Par défaut, les VLAN sont <strong>cloisonnés</strong> : il faut un <strong>routeur</strong> (couche 3) pour passer de l’un à l’autre. Deux méthodes.</p>' }),

  block('heading', { level: 3, text: '① Router-on-a-stick (routeur + sous-interfaces)' }),
  block('html', { html: '<p>Un <strong>seul lien trunk</strong> entre le switch et le routeur ; sur le routeur, une <strong>sous-interface par VLAN</strong>, chacune avec l’<strong>encapsulation 802.1Q</strong> et l’IP qui sert de <strong>passerelle</strong> du VLAN.</p>' }),
  cmd(`! Côté switch : le port vers le routeur en trunk
interface GigabitEthernet0/1
 switchport mode trunk
 switchport trunk allowed vlan 10,20
 exit
!
! Côté routeur : une sous-interface par VLAN
interface GigabitEthernet0/0
 no ip address
 no shutdown
 exit
interface GigabitEthernet0/0.10
 encapsulation dot1Q 10
 ip address 192.168.10.1 255.255.255.0
 exit
interface GigabitEthernet0/0.20
 encapsulation dot1Q 20
 ip address 192.168.20.1 255.255.255.0
 exit`),
  note('yellow', '💡 Les clients pointent vers leur sous-interface', '<p>Un PC du VLAN 10 prend comme <strong>passerelle</strong> <code>192.168.10.1</code> (la sous-interface <code>.10</code>) ; un PC du VLAN 20 → <code>192.168.20.1</code>. C’est le routeur qui achemine d’un VLAN à l’autre.</p>'),

  block('heading', { level: 3, text: '② Switch multicouche (SVI, niveau 3)' }),
  block('html', { html: '<p>Sur un <strong>switch L3</strong>, on active le routage et on crée une <strong>interface virtuelle (SVI)</strong> par VLAN — plus rapide (pas de goulot sur un seul lien).</p>' }),
  cmd(`ip routing
!
interface vlan 10
 ip address 192.168.10.1 255.255.255.0
 no shutdown
 exit
interface vlan 20
 ip address 192.168.20.1 255.255.255.0
 no shutdown
 exit`),

  block('heading', { level: 2, text: '5) DHCP à travers les VLAN' }),
  block('html', { html: '<p>Si un <strong>serveur DHCP unique</strong> sert plusieurs VLAN, ajoute un <strong>relais</strong> sur chaque interface/sous-interface de passerelle : <code>ip helper-address &lt;IP_serveur_DHCP&gt;</code> (voir <a href="/pages/procedure-dhcp-relais">DHCP par relais</a>).</p>' }),

  block('heading', { level: 2, text: '6) Vérifier' }),
  cmd(`show vlan brief
show interfaces trunk
show ip interface brief
! test : un PC du VLAN 10 doit pinguer un PC du VLAN 20 (via la passerelle)`),
  note('yellow', '🛠️ Dépannage courant', '<ul><li>Deux PC du même VLAN ne se voient pas → mauvais <code>access vlan</code> ou VLAN non créé.</li><li>Pas de communication inter-VLAN → passerelle du PC absente/erronée, ou sous-interface/SVI mal configurée.</li><li>Trunk KO → <strong>VLAN natif</strong> différent des deux côtés, ou VLAN absent de la liste <code>allowed</code>.</li></ul>'),

  note('green', '🔗 Pour aller plus loin', '<p>Cours liés : <a href="/pages/le-switch">Le switch</a>, <a href="/pages/bases-du-reseau">Les bases du réseau</a>, <a href="/pages/adresses-ip">Les adresses IP</a>. Procédures : <a href="/pages/procedure-cisco-routeur-cli">Configurer un routeur en CLI</a>, <a href="/pages/procedure-dhcp-relais">DHCP par relais</a>. Outil : <a href="/pages/atelier-reseau">Atelier Réseau</a>.</p>'),
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

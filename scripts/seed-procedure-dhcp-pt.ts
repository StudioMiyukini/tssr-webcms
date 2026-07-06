/* Procédure « Configurer un serveur DHCP sur Packet Tracer » : méthode A (device Serveur,
   service DHCP en GUI) et méthode B (routeur en CLI, via le générateur), + tests clients.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-procedure-dhcp-pt.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const SLUG = 'procedure-dhcp-packet-tracer';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const stepsStyle = block('html', { html: `<style>.proc-steps{padding-left:22px;line-height:1.75}.proc-steps>li{margin:8px 0}.proc-steps code,.proc-steps kbd{font-family:ui-monospace,'Space Mono',monospace}.proc-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="proc-cmd">${t}</div>` });

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Procédure · Réseau', title: 'Configurer un serveur DHCP sur Packet Tracer', subtitle: 'Deux méthodes : sur un device Serveur (interface graphique) ou sur un routeur (CLI).' }),
  note('blue', '🎯 Le principe', '<p>Le <strong>DHCP</strong> distribue automatiquement aux postes leur <strong>adresse IP</strong>, <strong>masque</strong>, <strong>passerelle</strong> et <strong>DNS</strong>. Dans Packet Tracer, on peut l’héberger sur un <strong>Serveur</strong> (méthode A) ou directement sur un <strong>routeur</strong> (méthode B). <strong>Toujours exclure/réserver</strong> la passerelle et les adresses fixes (serveurs, imprimantes).</p>'),

  block('heading', { level: 2, text: 'A — Sur un device « Serveur » (interface graphique)' }),
  block('html', { html: `<ol class="proc-steps">
    <li>Place un <strong>Server</strong>, relie-le au switch. Donne-lui une <strong>IP fixe</strong> : onglet <em>Desktop</em> → <strong>IP Configuration</strong> → <em>Static</em> (ex. <code>192.168.10.1</code>, masque <code>255.255.255.0</code>, passerelle <code>192.168.10.254</code>).</li>
    <li>Onglet <strong>Services</strong> → <strong>DHCP</strong> → passer le service sur <strong>On</strong>.</li>
    <li>Créer/éditer un <strong>pool</strong> :
      <ul>
        <li><strong>Default Gateway</strong> : <code>192.168.10.254</code></li>
        <li><strong>DNS Server</strong> : <code>192.168.10.1</code></li>
        <li><strong>Start IP Address</strong> : <code>192.168.10.11</code> (après les IP réservées)</li>
        <li><strong>Subnet Mask</strong> : <code>255.255.255.0</code></li>
        <li><strong>Maximum Number of Users</strong> : ex. <code>50</code></li>
      </ul>
      → <strong>Save / Add</strong>.</li>
    <li>Sur chaque <strong>PC client</strong> : <em>Desktop</em> → <strong>IP Configuration</strong> → cocher <strong>DHCP</strong> → il reçoit « DHCP request successful ».</li>
  </ol>` }),
  note('yellow', '💡 Réservations', '<p>Fais commencer le <strong>Start IP</strong> après tes adresses fixes (la passerelle <code>.254</code> et le serveur <code>.1</code> ne sont pas dans la plage distribuée), pour éviter les <strong>conflits d’IP</strong>.</p>'),

  block('heading', { level: 2, text: 'B — Sur un routeur (CLI)' }),
  block('html', { html: '<p>Le routeur joue le rôle de serveur DHCP. Le plus simple : <strong>générer la config</strong> avec le <a href="/pages/configurateur-dhcp-cisco">générateur DHCP routeur</a>, puis la coller dans la CLI. À la main :</p>' }),
  cmd(`enable
configure terminal
! Adresses exclues (passerelle + serveurs)
ip dhcp excluded-address 192.168.10.1 192.168.10.10
!
ip dhcp pool LAN
 network 192.168.10.0 255.255.255.0
 default-router 192.168.10.254
 dns-server 192.168.10.1
 domain-name miyukini.lan
 lease 8
 exit
!
end
write memory`),
  note('gray', '🔀 Relais DHCP (ip helper-address)', '<p>Si le serveur DHCP est sur un <strong>autre réseau</strong> que les clients (le routeur ne fait pas serveur mais relais), configure sur l’interface <strong>côté clients</strong> : <code>ip helper-address &lt;IP du serveur DHCP&gt;</code>. Les requêtes DHCP (broadcast) sont alors relayées vers le serveur.</p>'),

  block('heading', { level: 2, text: '✅ Vérifier' }),
  block('html', { html: '<p>Côté <strong>client</strong> (invite de commandes du PC dans Packet Tracer) :</p>' }),
  cmd(`ipconfig /all
ipconfig /release
ipconfig /renew`),
  block('html', { html: '<p>Côté <strong>routeur</strong> (méthode B), pour voir les baux attribués :</p>' }),
  cmd(`show ip dhcp binding
show ip dhcp pool`),
  note('yellow', '🛠️ Si un client ne reçoit rien', '<ul><li>Client en <strong>APIPA</strong> (<code>169.254.x.x</code>) = aucune réponse DHCP → service <strong>On</strong> ? pool créé ? câblage/VLAN ?</li><li>Serveur/routeur et clients sur des réseaux différents sans <strong>ip helper-address</strong>.</li><li>Plage épuisée ou mauvais masque.</li></ul><p>Voir aussi : <a href="/procedure-dhcp">DHCP (Windows Server)</a> et le <a href="/depannage">Dépannage</a>.</p>'),

  note('green', '🎯 À retenir', '<p><strong>DHCP</strong> = IP + masque + passerelle + DNS automatiques. Sur <strong>Serveur</strong> : Services → DHCP → pool (gateway, DNS, start IP, mask). Sur <strong>routeur</strong> : <code>ip dhcp excluded-address</code> puis <code>ip dhcp pool</code> (network / default-router / dns-server / lease). <strong>Exclure la passerelle et les IP fixes.</strong> Outil : <a href="/configurateur-dhcp-cisco">générateur DHCP routeur</a>.</p>'),
];

const PAGE = {
  slug: SLUG,
  title: 'Configurer un serveur DHCP sur Packet Tracer',
  excerpt: 'Procédure DHCP sous Packet Tracer : méthode Serveur (service DHCP en GUI : pool, gateway, DNS, start IP, masque) et méthode routeur en CLI (ip dhcp pool, exclusions, relais ip helper-address), avec tests clients.',
};

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
  const bodyJson = JSON.stringify({ title: PAGE.title, slug: PAGE.slug, excerpt: PAGE.excerpt, content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1 });
  const res = cur
    ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body: bodyJson })
    : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body: bodyJson });
  console.log(`PAGE ${PAGE.slug}`, res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());

  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

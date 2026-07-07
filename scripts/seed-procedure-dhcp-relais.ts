/* Procédure « DHCP centralisé : serveur + relais (ip helper-address) » : configurer les étendues
   sur un serveur DHCP, activer le relais sur chaque routeur, tester côté client, dépanner.
   Justifie manuellement l'étape DHCP (relais) de l'Atelier Réseau.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-procedure-dhcp-relais.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'procedure-dhcp-relais', title: 'DHCP centralisé : serveur + relais (ip helper-address)', excerpt: 'Un serveur DHCP unique dessert plusieurs sous-réseaux à travers les routeurs : étendues sur le serveur, relais ip helper-address sur chaque interface LAN, tests et dépannage. Procédure manuelle de l’étape DHCP de l’Atelier.' };
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stepsStyle = block('html', { html: `<style>.proc-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="proc-cmd">${esc(t)}</div>` });

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Procédure · Cisco / Packet Tracer', title: PAGE.title, subtitle: 'Un seul serveur DHCP pour tous les sous-réseaux, grâce au relais sur les routeurs.' }),
  stepsStyle,
  note('blue', '🎯 Pourquoi un relais', '<p>Une requête DHCP d’un client est un <strong>broadcast</strong> — et un routeur <strong>ne transmet pas les broadcasts</strong>. Un client situé derrière un routeur ne « voit » donc pas un serveur DHCP distant. Le <strong>relais</strong> (<code>ip helper-address</code>) transforme ce broadcast en message dirigé vers le serveur. Cette procédure <strong>justifie</strong> l’étape DHCP de l’<a href="/pages/atelier-reseau">Atelier Réseau</a>. (Pour un DHCP hébergé directement sur le routeur, voir <a href="/pages/procedure-dhcp-packet-tracer">DHCP sur Packet Tracer</a>.)</p>'),

  block('heading', { level: 2, text: '1) Configurer les étendues sur le serveur DHCP' }),
  block('html', { html: '<p>Sur le <strong>serveur</strong> (Packet Tracer : cliquer le serveur → onglet <strong>Services</strong> → <strong>DHCP</strong>). Le serveur a lui-même une <strong>IP fixe</strong>. Crée <strong>une étendue par sous-réseau client</strong> :</p>' }),
  block('html', { html: `<table style="border-collapse:collapse;width:100%;font-size:13px"><thead><tr style="background:var(--surface-2)">${['Champ (PT)', 'Signification', 'Exemple'].map(c => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${c}</th>`).join('')}</tr></thead><tbody>
${[['Pool Name', 'nom de l’étendue', 'PROD'], ['Default Gateway', 'passerelle du sous-réseau (IP du routeur)', '192.168.10.126'], ['DNS Server', 'serveur DNS distribué aux clients', '192.168.10.11'], ['Start IP Address', 'première IP attribuée aux clients', '192.168.10.1'], ['Subnet Mask', 'masque du sous-réseau', '255.255.255.128'], ['Maximum Number of Users', 'taille de la plage', '120']].map(r => `<tr>${r.map((c, i) => `<td style="padding:7px 10px;border:1px solid var(--border)${i === 2 ? ';font-family:ui-monospace,monospace' : ''}">${c}</td>`).join('')}</tr>`).join('')}
</tbody></table>` }),
  block('html', { html: '<p>Clique <strong>Add / Save</strong> pour chaque étendue, et vérifie que le service DHCP est sur <strong>On</strong>.</p>' }),
  note('yellow', '⚠️ Passerelle et serveurs = hors plage', '<p>Fais commencer <em>Start IP</em> <strong>après</strong> les adresses fixes (passerelle, switch, serveurs) ou réserve-les, pour que le serveur ne les distribue jamais aux clients.</p>'),

  block('heading', { level: 2, text: '2) Activer le relais sur chaque routeur' }),
  block('html', { html: '<p>Sur <strong>chaque interface LAN</strong> qui accueille des clients DHCP, pointe le relais vers l’IP du <strong>serveur DHCP</strong> :</p>' }),
  cmd(`enable
configure terminal
interface GigabitEthernet0/0
 ip helper-address 192.168.10.11
 exit
end
write memory`),
  block('html', { html: '<p>Répète pour chaque interface LAN concernée (sur tous les routeurs). Le routeur relaiera alors les requêtes DHCP de ce sous-réseau vers <code>192.168.10.11</code>, en indiquant au serveur de quel sous-réseau vient la demande (il choisit la bonne étendue).</p>' }),
  note('gray', '💡 Si le serveur est derrière un autre routeur', '<p>Le <code>ip helper-address</code> se met sur l’interface <strong>côté clients</strong>. Le routeur relaie vers l’IP du serveur : il faut donc que la route vers ce serveur existe (voir <a href="/pages/procedure-routes-statiques">routes statiques</a>).</p>'),

  block('heading', { level: 2, text: '3) Tester côté client' }),
  block('html', { html: '<p>Sur un PC client, passe la carte en <strong>DHCP</strong> (Desktop → IP Configuration → DHCP). Il doit recevoir une IP de la bonne plage, la passerelle et le DNS. En invite de commande :</p>' }),
  cmd(`ipconfig /release
ipconfig /renew
ipconfig /all`),

  block('heading', { level: 2, text: '4) Dépannage' }),
  block('list', { listItems: [
    'Client en 169.254.x.x (APIPA) → aucune réponse DHCP : helper-address manquant/mauvais, ou service DHCP off.',
    'Mauvaise plage → l’étendue du serveur ne correspond pas au sous-réseau (masque/passerelle) ou Default Gateway erroné.',
    'Le serveur ne répond que pour son propre réseau → il manque un ip helper-address sur le routeur du sous-réseau distant.',
    'Pas de route vers le serveur → le relais n’aboutit pas (vérifier show ip route et le ping routeur → serveur).',
  ] }),

  note('green', '✅ Justification', '<p>Étendues côté serveur + <code>ip helper-address</code> côté routeurs : tu as reproduit à la main ce que l’Atelier génère (tableau des étendues + scripts de relais). Vérifie ensuite le <a href="/pages/procedure-dns">DNS</a> distribué aux clients.</p>'),
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

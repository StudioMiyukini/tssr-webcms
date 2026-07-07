/* Procédure « Redondance DNS » : zone intégrée AD (réplication auto via 2e DC), zone secondaire +
   transfert de zone, redirecteurs, DNS secondaire côté clients, vérification.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-procedure-dns-redondance.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'procedure-dns-redondance', title: 'Redondance DNS (haute disponibilité de la résolution)', excerpt: 'Assurer la continuité du DNS : zone intégrée à Active Directory répliquée sur un 2e DC, ou zone secondaire avec transfert de zone ; redirecteurs, DNS secondaire distribué aux clients et vérification.' };
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stepsStyle = block('html', { html: `<style>.proc-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="proc-cmd">${esc(t)}</div>` });

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Procédure · Hébergement / Réseau', title: PAGE.title, subtitle: 'Si le DNS tombe, tout tombe : voici comment le rendre redondant.' }),
  stepsStyle,
  note('blue', '🎯 Pourquoi', '<p>Le <strong>DNS</strong> est vital : sans lui, plus de résolution de noms ni d’<strong>ouverture de session AD</strong> (les clients localisent les DC via DNS). Il faut donc <strong>au moins deux serveurs DNS</strong>. Prérequis : un DNS déjà en place (voir <a href="/pages/procedure-dns">DNS : zones & enregistrements</a>).</p>'),
  note('gray', '🧩 Deux approches', '<p><strong>A. Zone intégrée à Active Directory</strong> — la zone est stockée dans AD et <strong>répliquée automatiquement</strong> sur tous les DC (recommandé en domaine, multi-maître, sécurisé). <strong>B. Zone secondaire</strong> — copie en <strong>lecture seule</strong> alimentée par <strong>transfert de zone</strong> depuis un maître (utile hors domaine ou vers un serveur non-DC).</p>'),

  block('heading', { level: 2, text: 'A) Zone intégrée AD : ajouter un second contrôleur de domaine' }),
  block('html', { html: '<p>La méthode la plus simple en domaine : promouvoir un <strong>2e DC</strong> avec le rôle DNS. La zone (intégrée AD) se réplique toute seule.</p>' }),
  block('list', { listItems: [
    'Sur le 2e serveur : IP fixe, DNS pointant vers le 1er DC, puis jonction au domaine.',
    'Installer le rôle AD DS (+ DNS proposé automatiquement).',
    'Promouvoir en contrôleur de domaine d’un domaine existant.',
  ] }),
  cmd(`Install-WindowsFeature AD-Domain-Services,DNS -IncludeManagementTools
Install-ADDSDomainController -DomainName "miyukini.lan" -InstallDns -Credential (Get-Credential)`),
  block('html', { html: '<p>Vérifie que la zone est bien en <em>« Intégrée à Active Directory »</em> (propriétés de la zone → onglet Général → Type). Forcer la réplication AD :</p>' }),
  cmd(`repadmin /syncall /AdeP`),

  block('heading', { level: 2, text: 'B) Zone secondaire + transfert de zone' }),
  block('html', { html: '<p><strong>Sur le serveur maître</strong> (qui héberge la zone principale) : autorise le transfert vers le serveur secondaire.</p>' }),
  block('list', { listItems: [
    'Console DNS → clic droit sur la zone → Propriétés → onglet « Transferts de zone ».',
    'Cocher « Autoriser les transferts » → « Uniquement vers les serveurs suivants » → ajouter l’IP du serveur secondaire.',
    'Onglet « Serveurs de noms » (NS) → ajouter le serveur secondaire.',
  ] }),
  block('html', { html: '<p><strong>Sur le serveur secondaire</strong> : créer une <strong>zone secondaire</strong> du même nom, pointant vers le maître.</p>' }),
  cmd(`Add-DnsServerSecondaryZone -Name "miyukini.lan" -MasterServers 192.168.10.11 -ZoneFile "miyukini.lan.dns"`),
  block('html', { html: '<p>La zone secondaire se remplit par transfert. Pour forcer : clic droit → « Transférer depuis le maître » (ou <code>Start-DnsServerZoneTransfer</code>).</p>' }),

  block('heading', { level: 2, text: 'Redirecteurs (résolution externe redondante)' }),
  block('html', { html: '<p>Pour résoudre Internet de façon fiable, configure des <strong>redirecteurs</strong> (deux résolveurs publics) sur chaque serveur DNS :</p>' }),
  cmd(`Set-DnsServerForwarder -IPAddress 8.8.8.8,1.1.1.1`),

  block('heading', { level: 2, text: 'Côté clients : deux serveurs DNS' }),
  block('html', { html: '<p>Les clients doivent connaître le <strong>DNS primaire ET secondaire</strong>. En DHCP, renseigne les deux dans l’<strong>option 006</strong> (voir <a href="/pages/procedure-dhcp">rôle DHCP</a>). En IP fixe : DNS préféré + DNS auxiliaire.</p>' }),

  block('heading', { level: 2, text: 'Vérifier' }),
  cmd(`nslookup dc1.miyukini.lan 192.168.10.11
nslookup dc1.miyukini.lan 192.168.10.12
Get-DnsServerZone
dcdiag /test:DNS`),
  block('html', { html: '<p><strong>Test de bascule</strong> : arrête le DNS primaire, un client doit continuer à résoudre via le secondaire (après expiration du cache/essai). Vérifie qu’un enregistrement créé sur le maître apparaît bien sur le secondaire (réplication AD immédiate, ou transfert de zone selon l’intervalle du SOA).</p>' }),

  note('green', '✅ Justification', '<p>Deux serveurs DNS, zone répliquée (AD) ou transférée (secondaire), redirecteurs et DNS secondaire côté clients : la résolution survit à la perte d’un serveur. Voir aussi la redondance DHCP : <a href="/pages/procedure-dhcp-basculement">Basculement DHCP</a>.</p>'),
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

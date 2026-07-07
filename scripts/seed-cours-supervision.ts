/* Cours « La supervision (monitoring) ». Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-supervision.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'supervision', title: 'La supervision (monitoring)', excerpt: 'Surveiller en continu l’état de l’infrastructure : hôtes et services, seuils et états (OK / WARNING / CRITICAL), sondes actives/passives (SNMP, agents), alertes et tableaux de bord. Panorama des outils (Nagios, Centreon, Zabbix, PRTG).' };
const block = (t: Parameters<typeof makePageBlock>[0], p: Partial<PageBlock>) => Object.assign(makePageBlock(t), p);
const note = (c: string, t: string, h: string) => block('html', { html: `<aside class="pb-note pb-note-${c}"><p class="pb-note-title">${t}</p>${h}</aside>` });
const styleBlock = block('html', { html: `<style>.sv-t{border-collapse:collapse;width:100%;font-size:13px;margin:6px 0}.sv-t th,.sv-t td{border:1px solid var(--border);padding:7px 10px;text-align:left}.sv-t th{background:var(--surface-2)}</style>` });
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Exploitation', title: PAGE.title, subtitle: 'Savoir qu’un service est tombé avant que l’utilisateur n’appelle.' }),
  styleBlock,
  block('html', { html: '<p>La <strong>supervision</strong> surveille en permanence l’<strong>état</strong> des équipements et des services, et <strong>alerte</strong> en cas de problème (panne, seuil dépassé). Objectif : <strong>anticiper</strong> et réduire le temps d’indisponibilité — une compétence clé de l’exploitation (CCP2 TSSR).</p>' }),
  note('blue', '🎯 Ce qu’on surveille', '<ul><li><strong>Disponibilité</strong> : l’hôte répond-il (ping) ? le service tourne-t-il (HTTP, DNS, SMTP…) ?</li><li><strong>Ressources</strong> : CPU, RAM, espace disque, charge.</li><li><strong>Réseau</strong> : bande passante, état des ports (via SNMP).</li></ul>'),
  block('heading', { level: 2, text: '1) États et seuils' }),
  block('html', { html: '<p>Chaque contrôle (« service » ou « sonde ») renvoie un <strong>état</strong> selon des <strong>seuils</strong> :</p>' }),
  block('html', { html: `<table class="sv-t"><thead><tr><th>État</th><th>Signification</th></tr></thead><tbody>
    <tr><td><strong>OK</strong> (vert)</td><td>tout va bien</td></tr>
    <tr><td><strong>WARNING</strong> (orange)</td><td>seuil d’alerte atteint (ex. disque &gt; 80 %)</td></tr>
    <tr><td><strong>CRITICAL</strong> (rouge)</td><td>seuil critique / service tombé (ex. disque &gt; 95 %)</td></tr>
    <tr><td><strong>UNKNOWN</strong></td><td>la sonde n’a pas pu mesurer</td></tr>
  </tbody></table>` }),
  block('heading', { level: 2, text: '2) Sondes actives vs passives' }),
  block('html', { html: '<ul><li><strong>Active</strong> : le serveur de supervision <strong>interroge</strong> régulièrement la cible (ping, requête HTTP, SNMP).</li><li><strong>Passive</strong> : c’est la cible (via un <strong>agent</strong>, ex. NRPE, ou un trap SNMP) qui <strong>envoie</strong> son état.</li></ul>' }),
  note('gray', '📡 SNMP', '<p><strong>SNMP</strong> (Simple Network Management Protocol) est le standard pour interroger l’état des équipements réseau (switches, routeurs, imprimantes) : compteurs, état des ports, température… Le superviseur lit ces valeurs (OID) via une communauté (ex. <code>public</code> en lecture).</p>'),
  block('heading', { level: 2, text: '3) Les outils' }),
  block('html', { html: `<table class="sv-t"><thead><tr><th>Outil</th><th>Profil</th></tr></thead><tbody>
    <tr><td><strong>Nagios</strong></td><td>la référence historique (open source), très configurable via fichiers.</td></tr>
    <tr><td><strong>Centreon</strong></td><td>basé sur Nagios, interface web complète, très utilisé en entreprise (FR).</td></tr>
    <tr><td><strong>Zabbix</strong></td><td>open source tout-en-un (agents, graphes, alertes).</td></tr>
    <tr><td><strong>PRTG</strong></td><td>Windows, simple, basé sur des « capteurs » (freemium).</td></tr>
  </tbody></table>` }),
  block('heading', { level: 2, text: '4) Alertes & tableaux de bord' }),
  block('html', { html: '<p>Quand un état passe en WARNING/CRITICAL, le superviseur <strong>notifie</strong> (e-mail, SMS, ticket) selon des <strong>règles d’escalade</strong> (qui, après combien de temps). Les <strong>tableaux de bord</strong> et <strong>graphes</strong> (historique CPU/disque) aident à voir les tendances et anticiper.</p>' }),
  note('green', '🔗 Liens', '<p>Pour l’inventaire et les tickets : <a href="/pages/procedure-glpi">GLPI</a>. Méthode incident : <a href="/pages/le-ticketing">Le ticketing</a>. Diagnostic : <a href="/pages/procedure-test-connectivite">Test de connectivité</a>.</p>'),
];
function cookieFrom(res: Response): string { const sc = (res.headers as any).getSetCookie?.() as string[] | undefined; return (sc && sc.length ? sc : [res.headers.get('set-cookie') || '']).map(c => c.split(';')[0]).filter(Boolean).join('; '); }
async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: PW }) });
  if (!login.ok) throw new Error(`login ${login.status}`);
  const cookie = cookieFrom(login); const h = { 'Content-Type': 'application/json', Cookie: cookie };
  const existing = await (await fetch(`${BASE}/api/admin/pages`, { headers: { Cookie: cookie } })).json() as Array<{ id: number; slug: string }>;
  const cur = existing.find(e => e.slug === PAGE.slug);
  const body = JSON.stringify({ title: PAGE.title, slug: PAGE.slug, excerpt: PAGE.excerpt, content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1 });
  const res = cur ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body }) : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log(`PAGE ${PAGE.slug}`, res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());
  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } }); console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

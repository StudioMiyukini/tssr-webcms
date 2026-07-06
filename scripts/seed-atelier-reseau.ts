/* Page « Atelier Réseau & Packet Tracer » : assistant multi-étapes (îlot data-block="network-workshop").
   Étapes 1-3 opérationnelles (contexte, préférences, segmentation multi-routeurs + interfaces auto) ;
   4-6 (schéma, DHCP, DNS) en construction.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-atelier-reseau.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Outil · Réseau / Packet Tracer', title: 'Atelier Réseau & Packet Tracer', subtitle: 'Un assistant guidé : du contexte de l’exercice au plan d’adressage, aux configs Cisco, DHCP et DNS — un seul fil, un seul contexte.' }),
  block('html', { html: '<p>Cet <strong>assistant tout-en-un</strong> relie toutes les étapes d’un TP réseau autour d’un <strong>contexte partagé</strong> (mémorisé dans ton navigateur). Tu renseignes une fois le contexte et tes conventions, puis chaque étape réutilise ces données :</p>' }),
  block('list', { listItems: [
    '① Contexte — entreprise, domaine, réseau de base et besoins en hôtes (par service/sous-réseau), infra neuve ou extension.',
    '② Préférences — tes pratiques standards : login/mot de passe/enable secret, et la convention d’adressage (clients en début de plage, switch puis routeur en fin, masque des liaisons inter-routeurs).',
    '③ Segmentation — découpage VLSM automatique, topologie multi-routeurs (2811/2911), et attribution automatique des IP d’interfaces (LAN + liaisons série/Gig, avec côté DCE et clock rate).',
    '④ Schéma — vue en blocs par sous-réseau + table des interfaces + diagramme SVG (routeurs, liaisons, LAN).',
    '⑤ Pools DHCP — configuration IOS prête à coller, par routeur (réseau/masque, default-router, dns-server, domaine, bail + adresses exclues).',
    '⑥ DNS — enregistrements A/PTR, résolution locale (ip host) et tests (nslookup/ping).',
  ] }),
  block('html', { html: '<div class="pb-dynamic" data-block="network-workshop"></div>' }),
  note('blue', 'ℹ️ Comment ça marche', '<p>Renseigne les <strong>étapes 1 et 2</strong>, puis déroule les étapes 3 à 6 : le plan d’adressage, le schéma, les pools DHCP et le DNS se calculent en direct à partir du <strong>même contexte</strong> et sont <strong>copiables</strong>. Les avertissements signalent un manque de place dans le réseau de base ou un routeur à court d’interfaces. Outils liés : <a href="/pages/segmentation-reseau">segmentation VLSM/FLSM</a>, <a href="/pages/configurateur-routeur-cisco">configurateur routeur</a>, <a href="/pages/generateur-routes-statiques">routes statiques</a>, <a href="/pages/configurateur-dhcp-cisco">DHCP routeur</a>. Procédures : <a href="/pages/procedure-plan-adressage">plan d’adressage</a>, <a href="/pages/procedure-ssh-packet-tracer">SSH sur Packet Tracer</a>.</p>'),
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
  const cur = existing.find(e => e.slug === 'atelier-reseau');
  const body = JSON.stringify({ title: 'Atelier Réseau & Packet Tracer', slug: 'atelier-reseau', excerpt: 'Assistant guidé multi-étapes : contexte, préférences, segmentation VLSM multi-routeurs (2811/2911) avec attribution automatique des interfaces, schéma (blocs + SVG), pools DHCP par routeur et enregistrements DNS + tests.', content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1 });
  const res = cur
    ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body })
    : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log('PAGE atelier-reseau', res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());
  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

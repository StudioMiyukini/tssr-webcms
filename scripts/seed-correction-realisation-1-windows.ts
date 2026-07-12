/* Correction de la « Réalisation 1 Windows » (contexte Engineer Aero) — destinée à ceux qui n'ont pas réussi.
   Illustrée par les captures extraites du rendu (uploads/rw1-*.png).
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-correction-realisation-1-windows.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'correction-realisation-1-windows', title: 'Réalisation 1 Windows — Correction', excerpt: 'Correction pas-à-pas illustrée de la Réalisation 1 Windows (contexte Engineer Aero) : 3 VM sur réseau interne Hyper-V, rôles DNS, Web (IIS, 2 sites), DHCP (étendue + réservation) et communication avec la machine physique. Pour reprendre les points ratés.' };

const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const th = (t: string) => `<th style="border:1px solid var(--border);padding:7px 10px;text-align:left;background:var(--surface-2)">${t}</th>`;
const td = (t: string) => `<td style="border:1px solid var(--border);padding:7px 10px">${t}</td>`;
const tbl = (head: string[], rows: string[][]) => `<div style="overflow-x:auto;margin:6px 0"><table style="border-collapse:collapse;width:100%;min-width:440px;font-size:13px"><thead><tr>${head.map(th).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(td).join('')}</tr>`).join('')}</tbody></table></div>`;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cmd = (t: string) => block('html', { html: `<div class="proc-cmd">${esc(t)}</div>` });
const ul = (items: string[]) => block('html', { html: `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>` });
const figure = (url: string, cap: string) => block('html', { html: `<figure style="margin:12px 0 16px;text-align:center"><img src="${url}" alt="${cap}" loading="lazy" style="max-width:100%;border:1px solid var(--border);border-radius:8px"/><figcaption class="meta" style="margin-top:6px;font-size:12.5px">${cap}</figcaption></figure>` });

const C = { base: '#64748b', dns: '#3b82f6', web: '#22c55e', dhcp: '#f97316', hyperv: '#8b5cf6' };
const sec = (n: string, title: string, sub: string, color: string) => block('html', { html: `<div class="step-banner" style="border-left-color:${color}"><span class="step-num" style="background:${color}">${n}</span><span class="step-tt"><h3>${title}</h3><span class="step-sub">${sub}</span></span></div>` });
const railOpen = (color: string) => block('html', { html: `<div class="step-rail" style="border-left-color:${color}">` });
const railClose = block('html', { html: '</div>' });

const styleBlock = block('html', { html: `<style>
.proc-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}
.step-banner{display:flex;align-items:center;gap:14px;margin:32px 0 12px;padding:13px 16px;border:1px solid var(--border);border-left-width:6px;border-radius:12px;background:var(--surface-2)}
.step-banner .step-num{flex:0 0 auto;width:36px;height:36px;border-radius:10px;display:grid;place-items:center;font-weight:700;color:#fff;font-size:16px;line-height:1}
.step-banner .step-tt{display:flex;flex-direction:column;gap:2px;min-width:0}
.step-banner h3{margin:0;font-size:17px;line-height:1.25}
.step-banner .step-sub{font-size:12.5px;color:var(--muted,#7a8699);font-weight:400}
.step-rail{border-left:4px solid var(--border);padding:2px 0 2px 16px;margin:0 0 10px 4px}
.step-rail>*:first-child{margin-top:6px}
</style>` });

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Correction · Réalisation Windows', title: 'Réalisation 1 Windows — Correction', subtitle: 'Solution pas-à-pas illustrée (contexte Engineer Aero) — pour reprendre les points ratés.' }),
  styleBlock,

  note('blue', '🎯 À qui s’adresse cette correction', '<p>Elle reprend, section par section, la <strong>solution attendue</strong> de la Réalisation 1 Windows, avec les captures d’un rendu correct. Objectif : comprendre <strong>où ça a coincé</strong> et refaire proprement. Il n’y a <strong>pas d’Active Directory</strong> dans ce TP (services autonomes).</p>'),
  note('red', '⚠️ Coquille de l’énoncé : l’adressage', '<p>L’énoncé écrit <code>198.162.10.0/24</code> — mais <strong>198.162.x.x n’est pas une plage privée</strong>. C’est une coquille pour <code>192.168.10.0/24</code>, la vraie plage privée. <strong>Utilisez <code>192.168.10.0/24</code></strong> (comme dans toutes les captures ci-dessous). Correspondance : serveur DNS/Web <code>.250</code>, serveur DHCP <code>.251</code>, client <code>.101</code>.</p>'),
  note('gray', 'ℹ️ Nom de domaine', '<p>Le domaine est <code>engineer&lt;prénom&gt;.lan</code> — ici <code>engineerjean.lan</code>. Remplacez <em>prénom</em> par le vôtre partout (zone DNS, noms de sites).</p>'),

  // ── 1. Configuration de base ──
  sec('1', 'Configuration de base', 'Trois VM sur réseau interne Hyper-V, IP fixes, tests ping', C.base),
  railOpen(C.base),
  block('html', { html: '<p>Créer les <strong>3 machines virtuelles</strong> (génération 2), toutes sur le <strong>même commutateur virtuel INTERNE</strong>, installer les OS, puis appliquer une <strong>IP fixe</strong> et pointer le <strong>DNS vers <code>192.168.10.250</code></strong>. <strong>Aucun Active Directory.</strong></p>' }),
  block('html', { html: tbl(['Caractéristique', 'SRV-DNS-WEB', 'SRV-DHCP', 'CLIENT-W'], [
    ['Système', 'Windows Server 2019', 'Windows Server 2019', 'Windows 10'],
    ['Mémoire (RAM)', '4096 Mo', '4096 Mo', '4096 Mo'],
    ['Stockage', 'C : 50 Go · D : 10 Go', 'C : 50 Go · D : 15 Go', 'C : 40 Go'],
    ['Commutateur', '<strong>Interne</strong>', '<strong>Interne</strong>', '<strong>Interne</strong>'],
    ['Adresse IP', '<strong>192.168.10.250</strong>', '<strong>192.168.10.251</strong>', '192.168.10.101'],
    ['Masque', '255.255.255.0', '255.255.255.0', '255.255.255.0'],
    ['Serveur DNS', '192.168.10.250', '192.168.10.250', '192.168.10.250'],
    ['Nom de domaine', 'engineerjean.lan', '—', '—'],
  ]) }),
  note('yellow', '⚠️ Erreurs fréquentes ici', '<ul><li>Commutateur en <strong>Externe/Privé</strong> au lieu d’<strong>Interne</strong> → pas de communication (ou pas de host plus tard).</li><li>Oublier de mettre le <strong>DNS = 192.168.10.250</strong> sur les 3 machines → la résolution de noms échouera à l’étape DNS.</li><li>Installer un <strong>contrôleur de domaine (AD)</strong> alors que c’est explicitement interdit.</li></ul>'),
  figure('/uploads/rw1-image1.png', 'Gestionnaire de commutateur virtuel Hyper-V : le commutateur « COM_Int » est en <strong>Réseau interne</strong>. Les 3 VM y sont rattachées.'),
  block('html', { html: '<p><strong>Vérification :</strong> depuis chaque machine, pinguer les deux autres (et fournir <code>ipconfig /all</code>, infos système, gestion des disques comme demandé).</p>' }),
  cmd(`REM depuis SRV-DNS-WEB
ping 192.168.10.251      REM SRV-DHCP
ping 192.168.10.101      REM CLIENT-W`),
  figure('/uploads/rw1-image14.png', 'Pings réussis depuis SRV-DNS-WEB vers 192.168.10.251 et 192.168.10.101 (0 % de perte).'),
  railClose,

  // ── 2. DNS ──
  sec('2', 'Rôle DNS', 'Zone directe + enregistrements A et alias (CNAME) des 3 machines', C.dns),
  railOpen(C.dns),
  block('html', { html: '<p>Sur <strong>SRV-DNS-WEB</strong> : installer le rôle <strong>DNS</strong>, créer une <strong>zone de recherche directe</strong> <code>engineerjean.lan</code>, y enregistrer le <strong>nom (A) de chaque machine</strong> et un <strong>alias (CNAME) pour chacune</strong>.</p>' }),
  block('html', { html: tbl(['Nom', 'Type', 'Valeur'], [
    ['(racine) / www', 'A / CNAME', '192.168.10.250 (serveur)'],
    ['dhcp', 'A', '192.168.10.251'],
    ['client-w', 'A', '192.168.10.101'],
    ['dns', 'CNAME', '→ engineerjean.lan'],
    ['c', 'CNAME', '→ client-w.engineerjean.lan'],
    ['d', 'CNAME', '→ dhcp.engineerjean.lan'],
  ]) }),
  figure('/uploads/rw1-image17.png', 'Gestionnaire DNS — zone engineerjean.lan : un enregistrement A par machine (.250 / .251 / .101) et un alias CNAME pour chacune.'),
  block('html', { html: '<p><strong>Test :</strong> pinguer les noms enregistrés <strong>depuis le serveur</strong> puis <strong>depuis CLIENT-W</strong>.</p>' }),
  cmd(`ping engineerjean.lan       REM -> 192.168.10.250
ping dhcp.engineerjean.lan
ping client-w.engineerjean.lan`),
  figure('/uploads/rw1-image25.png', 'Depuis CLIENT-W : résolution du nom (ping engineerJean.lan → 192.168.10.250) et accès au site dans le navigateur.'),
  note('yellow', '⚠️ Piège', '<p>Si le ping par <strong>nom</strong> échoue mais par <strong>IP</strong> fonctionne → le client n’a pas le bon <strong>serveur DNS</strong> (doit être <code>192.168.10.250</code>), ou l’enregistrement manque dans la zone.</p>'),
  railClose,

  // ── 3. Web (IIS) ──
  sec('3', 'Service Web (IIS)', 'Deux sites : Présentation (port 80) et intranet (port 8080)', C.web),
  railOpen(C.web),
  block('html', { html: '<p>Sur <strong>SRV-DNS-WEB</strong> : installer le rôle <strong>Serveur Web (IIS)</strong>, créer <strong>deux sites</strong> distingués par leur <strong>nom d’hôte</strong> (ils partagent la même IP <code>192.168.10.250</code>) :</p>' }),
  ul([
    'Site <strong>Présentation</strong> — liaison HTTP, nom d’hôte <code>presentation.engineerjean.lan</code>, <strong>port 80</strong>.',
    'Site <strong>intranet</strong> — liaison HTTP, nom d’hôte <code>intranet.engineerjean.lan</code>, <strong>port 8080</strong>.',
    'Chaque site a son <strong>dossier physique</strong> et son <code>index.html</code>.',
    'Ajouter dans le DNS un enregistrement (A ou CNAME → serveur) pour <code>presentation</code> et <code>intranet</code>.',
  ]),
  figure('/uploads/rw1-image37.png', 'IIS — site « presentation » : liaison http, nom d’hôte presentation.engineerJean.lan, port 80, IP 192.168.10.250.'),
  figure('/uploads/rw1-image39.png', 'IIS — site « intranet » : liaison http, nom d’hôte intranet.engineerJean.lan, port 8080, IP 192.168.10.250.'),
  note('blue', '💡 Nom d’hôte = plusieurs sites sur une IP', '<p>Deux sites sur la <strong>même IP</strong> se distinguent par le <strong>nom d’hôte</strong> (host header) de la liaison. Le port <strong>8080</strong> de l’intranet est une alternative au 80 (séparation des accès). Testez en local (sur le serveur) <strong>et</strong> depuis CLIENT-W : <code>http://presentation.engineerjean.lan</code> et <code>http://intranet.engineerjean.lan:8080</code>.</p>'),
  railClose,

  // ── 4. DHCP ──
  sec('4', 'Service DHCP', 'Étendue de 25 adresses + réservation du client', C.dhcp),
  railOpen(C.dhcp),
  block('html', { html: '<p>Sur <strong>SRV-DHCP</strong> : installer le rôle <strong>DHCP</strong>, <strong>l’autoriser</strong>, puis créer une <strong>étendue</strong> sur <code>192.168.10.0/24</code> qui distribue <strong>25 adresses</strong>, et une <strong>réservation</strong> pour le client.</p>' }),
  ul([
    'Étendue <code>192.168.10.0/24</code>, plage de distribution de <strong>25 adresses</strong> (ex. <code>192.168.10.111 → .135</code>).',
    'Options : <strong>006 (DNS) = 192.168.10.250</strong>, <strong>015 (domaine) = engineerjean.lan</strong> (et 003 routeur s’il y en a un).',
    '<strong>Réservation</strong> de <code>192.168.10.111</code> pour <strong>CLIENT-W</strong> (par son adresse MAC).',
    'Passer CLIENT-W en <strong>adresse automatique (DHCP)</strong>, puis <code>ipconfig /release</code> + <code>/renew</code> pour tester.',
  ]),
  figure('/uploads/rw1-image41.png', 'Pool de l’étendue sur SRV-DHCP : 192.168.10.111 → 192.168.10.135 (25 adresses).'),
  figure('/uploads/rw1-image45.png', 'Réservation 192.168.10.111 → « client-w » dans l’étendue.'),
  note('yellow', '⚠️ « 25 adresses en partant du début de la plage »', '<p>Il faut distribuer <strong>exactement 25</strong> adresses. Le début de <em>votre</em> plage de distribution est libre : ici <code>.111 → .135</code> (ce qui permet de placer la <strong>réservation .111</strong> au début du pool). Vérifiez que <strong>CLIENT-W reçoit bien <code>.111</code></strong> après renouvellement (baux d’adresses + <code>ipconfig /all</code>).</p>'),
  railClose,

  // ── 5. Hyper-V ──
  sec('5', 'Hyper-V — communication avec la machine physique', 'Donner une IP à la carte vEthernet du commutateur interne', C.hyperv),
  railOpen(C.hyperv),
  block('html', { html: '<p>Un commutateur <strong>Interne</strong> crée, côté hôte, une <strong>carte vEthernet</strong>. Pour que la <strong>machine physique</strong> communique avec les VM, il suffit de lui donner une <strong>IP fixe dans le même sous-réseau</strong> <code>192.168.10.0/24</code> (ex. <code>192.168.10.1</code>), puis de tester au ping.</p>' }),
  cmd(`REM sur la machine PHYSIQUE : Panneau de configuration -> Carte vEthernet (COM_Int)
REM IPv4 fixe : 192.168.10.1 / 255.255.255.0
ipconfig /all
ping 192.168.10.250
ping 192.168.10.251
ping 192.168.10.101`),
  figure('/uploads/rw1-image48.png', 'ipconfig /all sur la machine physique : la carte vEthernet (COM_Int) est en 192.168.10.1 /24 → même sous-réseau que les VM.'),
  note('gray', 'ℹ️ Interne vs Privé', '<p>Commutateur <strong>Interne</strong> = VM ↔ VM <strong>et</strong> VM ↔ hôte. Commutateur <strong>Privé</strong> = VM ↔ VM uniquement (l’hôte ne peut pas communiquer). Ici il faut donc bien de l’<strong>Interne</strong>.</p>'),
  railClose,

  note('green', '✅ Avant d’envoyer', '<p>Relire les <strong>consignes</strong> : une capture <strong>par demande numérotée</strong>, nommer le fichier « <em>Réalisation 1 Windows - Nom Prénom</em> », objet du mail « <em>Prénom Nom - Réalisation 1 Windows</em> ». La <strong>rigueur</strong> (nommage, complétude) est notée.</p>'),
  note('gray', '🔗 Cours associés', '<p><a href="/pages/procedure-dns">DNS : zones & enregistrements</a> · <a href="/pages/procedure-iis">IIS : héberger un site</a> · <a href="/pages/procedure-dhcp">rôle DHCP</a> · <a href="/pages/procedure-vm-hyperv">Créer une VM Hyper-V</a> · <a href="/pages/procedure-ip-fixe-windows">Configurer une IP fixe</a>.</p>'),
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

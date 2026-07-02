/* Page « Trouver une plage d'IP (IP + CIDR) » : procédure à suivre (méthode du nombre
   magique) + exemple résolu + tableau de référence des masques + exerciseur interactif.
   Pensée pour être suivie pendant l'examen (accès au site autorisé).
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-exerciseur-subnetting.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const SLUG = 'trouver-plage-ip-cidr';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });

// Tableau de référence des masques /8 → /30 (calculé).
const ipToStr = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
function maskRow(c: number): string {
  const mask = (0xFFFFFFFF << (32 - c)) >>> 0;
  const octets = [(mask >>> 24) & 255, (mask >>> 16) & 255, (mask >>> 8) & 255, mask & 255];
  const idx = Math.floor((c - 1) / 8);
  const magic = 256 - octets[idx];
  const hosts = Math.pow(2, 32 - c) - 2;
  return `<tr><td>/${c}</td><td>${ipToStr(mask)}</td><td>${octets[idx]} <span class="meta">(${idx + 1}ᵉ octet)</span></td><td>${magic}</td><td>${hosts.toLocaleString('fr-FR')}</td></tr>`;
}
const maskTable = `<div style="overflow-x:auto;margin:8px 0 14px"><table style="border-collapse:collapse;width:100%;min-width:620px;font-size:13.5px" class="ref-table"><thead><tr style="background:var(--surface-2)">`
  + ['CIDR', 'Masque décimal', 'Octet intéressant', 'Nombre magique (bloc)', "Hôtes utilisables"].map(h => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${h}</th>`).join('')
  + `</tr></thead><tbody>`
  + [8, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30].map(maskRow).join('')
  + `</tbody></table></div>`;
const styleTable = `<style>.ref-table td{padding:7px 10px;border:1px solid var(--border);font-family:ui-monospace,'Space Mono',monospace}.ref-table td:first-child{font-weight:700;color:var(--accent)}</style>`;

const blocks: PageBlock[] = [
  block('hero', {
    eyebrow: 'Réseau · Méthode',
    title: 'Trouver une plage d’IP (IP + CIDR)',
    subtitle: 'La procédure pas-à-pas pour déduire adresse réseau, plage utilisable, broadcast et nombre d’hôtes — puis un exerciseur pour t’entraîner.',
  }),
  note('blue', '🎯 À quoi ça sert', '<p>Le jour de l’examen, on te donne souvent une adresse comme <code>172.16.20.130/26</code> et on te demande l’<strong>adresse réseau</strong>, la <strong>plage d’adresses utilisables</strong>, le <strong>broadcast</strong> et le <strong>nombre d’hôtes</strong>. Suis la procédure ci-dessous dans l’ordre, à chaque fois : elle marche pour n’importe quel <code>/CIDR</code>.</p>'),

  block('heading', { level: 2, text: '📋 La procédure à suivre' }),
  block('html', { html: '<p>Munis-toi du <strong>tableau de référence des masques</strong> (plus bas) : il te donne directement le masque, l’octet intéressant et le nombre magique. Ensuite :</p>' }),
  block('html', { html: `<ol class="proc-steps">
    <li><strong>Écris le masque</strong> du <code>/CIDR</code> (colonne du tableau). Repère l’<strong>octet « intéressant »</strong> : le seul qui n’est ni <code>255</code> ni <code>0</code>. (Pour un <code>/24</code> pile, c’est le 4ᵉ octet = 0 → bloc de 256.)</li>
    <li><strong>Nombre magique</strong> = <code>256 − (valeur de l’octet intéressant du masque)</code>. C’est la <strong>taille d’un bloc</strong> de sous-réseau.</li>
    <li><strong>Adresse réseau (idSR)</strong> : sur l’octet intéressant, <strong>descends au multiple du nombre magique</strong> inférieur ou égal à la valeur de l’IP. Mets les octets suivants à <code>0</code>.</li>
    <li><strong>Broadcast</strong> : sur l’octet intéressant, <code>réseau + nombre magique − 1</code>. Mets les octets suivants à <code>255</code>.</li>
    <li><strong>Plage utilisable</strong> : <code>1re = réseau + 1</code> et <code>dernière = broadcast − 1</code>.</li>
    <li><strong>Nombre d’hôtes</strong> = <code>2^(32 − CIDR) − 2</code> (les 2 retirés = réseau + broadcast).</li>
  </ol>` }),
  block('html', { html: `<style>.proc-steps{padding-left:22px;line-height:1.75}.proc-steps>li{margin:7px 0}.proc-steps code{font-family:ui-monospace,'Space Mono',monospace}</style>` }),

  block('heading', { level: 2, text: '✍️ Exemple résolu — 172.16.20.130 /26' }),
  block('html', { html: `<ol class="proc-steps">
    <li>Masque du <code>/26</code> = <code>255.255.255.192</code>. Octet intéressant = le 4ᵉ = <code>192</code>.</li>
    <li>Nombre magique = <code>256 − 192 = 64</code> → blocs de 64 : 0, 64, 128, 192.</li>
    <li>L’IP finit par <code>130</code> → multiple de 64 ≤ 130 = <code>128</code> → <strong>réseau = 172.16.20.128</strong>.</li>
    <li>Broadcast = <code>128 + 64 − 1 = 191</code> → <strong>172.16.20.191</strong>.</li>
    <li>Plage utilisable : <strong>172.16.20.129 → 172.16.20.190</strong>.</li>
    <li>Hôtes = <code>2^(32−26) − 2 = 2^6 − 2 = 62</code>.</li>
  </ol>` }),
  note('yellow', '⚠️ Pièges classiques', '<ul><li>Ne confonds pas <strong>nombre d’hôtes</strong> (−2) et <strong>nombre d’adresses</strong> du bloc (taille brute, sans −2).</li><li>L’adresse réseau et le broadcast <strong>ne sont pas attribuables</strong> à une machine.</li><li>Le nombre magique s’applique <strong>uniquement sur l’octet intéressant</strong> ; à gauche on recopie l’IP, à droite on met 0 (réseau) ou 255 (broadcast).</li></ul>'),

  block('heading', { level: 2, text: '📑 Tableau de référence des masques' }),
  block('html', { html: styleTable + maskTable }),

  block('heading', { level: 2, text: '🎯 Entraîne-toi (exerciseur)' }),
  block('html', { html: '<p>Génère des exercices à volonté et vérifie tes réponses. Choisis la difficulté (plage de <code>/CIDR</code>). Appuie sur <kbd>Entrée</kbd> pour valider puis passer au suivant.</p>' }),
  block('html', { html: '<div data-block="subnet-trainer"></div>' }),

  note('green', '🔗 Pour aller plus loin', '<p>Cours liés : <a href="/calcul-ip-masque">Calcul d’IP & masque</a>, <a href="/segmentation-sous-reseaux">La segmentation (subnetting)</a>, <a href="/ip-et-binaire">IP et binaire</a>.</p>'),
];

const PAGE = {
  slug: SLUG,
  title: 'Trouver une plage d’IP (IP + CIDR)',
  excerpt: 'Procédure pas-à-pas (méthode du nombre magique) pour trouver adresse réseau, plage utilisable, broadcast et nombre d’hôtes depuis une IP + /CIDR, avec exemple résolu, tableau des masques et exerciseur interactif.',
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

  const cours = existing.find(e => e.slug === 'cours');
  if (cours) {
    const hubBlocks = buildHubBlocks();
    const r = await fetch(`${BASE}/api/admin/pages/${cours.id}`, { method: 'PUT', headers: h, body: JSON.stringify({ title: 'Cours', slug: 'cours', content: renderPageBlocksToHtml(hubBlocks), builder_json: serializePageBlocks(hubBlocks), published: 1 }) });
    console.log('HUB Cours', r.status, r.ok ? '(maj)' : await r.text());
  } else console.log('HUB Cours introuvable');

  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

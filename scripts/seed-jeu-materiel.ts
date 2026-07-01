/* Diaporama-quiz « Reconnais le matériel » : 8 photos de composants PC / matériel réseau.
   Pour chaque photo, identifier le composant. Résultat immédiat + lien cours si erreur + récap.
   Téléverse les images (idempotent) puis crée la page. CSS pur (:has), sans JS.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-jeu-materiel.ts */
import fs from 'node:fs';
import path from 'node:path';
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const UPLOADS = 'C:/Users/Van Jean/.claude/uploads/f1a7696c-6fc2-4c34-a781-ef05c67a2789';

type Opt = { t: string; ok?: boolean };
type Item = { file: string; media: string; opts: Opt[]; href: string; course: string; ok: string; no: string };

const DATA: Item[] = [
  { file: '88482f54-1000081106.jpg', media: 'quiz-mat-carte-graphique.jpg', opts: [{ t: 'Une carte graphique', ok: true }, { t: 'Une carte mère' }, { t: 'Une alimentation' }, { t: 'Une barrette de RAM' }], href: '/pages/hardware', course: 'Le hardware', ok: 'Trois ventilateurs et un grand radiateur : c’est une carte graphique (GPU).', no: 'C’est une carte graphique (GPU) — reconnaissable à ses ventilateurs et son radiateur.' },
  { file: '6a61c4eb-1000081107.jpg', media: 'quiz-mat-processeur.jpg', opts: [{ t: 'Une barrette de RAM' }, { t: 'Un processeur (CPU)', ok: true }, { t: 'Une carte mère' }, { t: 'Un switch' }], href: '/pages/le-processeur', course: 'Le processeur (CPU)', ok: 'Petit carré avec un capot métallique (Intel Core i5) : c’est un processeur.', no: 'C’est un processeur (CPU) — le petit carré au capot métallique.' },
  { file: '4298be26-1000081108.jpg', media: 'quiz-mat-carte-mere.jpg', opts: [{ t: 'Une carte mère', ok: true }, { t: 'Une carte graphique' }, { t: 'Un routeur' }, { t: 'Une alimentation' }], href: '/pages/carte-mere', course: 'La carte mère', ok: 'Le grand circuit imprimé avec socket, slots RAM et ports : la carte mère.', no: 'C’est la carte mère — le grand circuit qui relie tous les composants.' },
  { file: '2526d7ce-1000081109.jpg', media: 'quiz-mat-cable-rj45.jpg', opts: [{ t: 'Une alimentation' }, { t: 'Un câble RJ45 (Ethernet)', ok: true }, { t: 'Une barrette de RAM' }, { t: 'Un switch' }], href: '/pages/bases-du-reseau', course: 'Les bases du réseau', ok: 'Un câble avec deux connecteurs RJ45 : le câble réseau Ethernet.', no: 'C’est un câble RJ45 (Ethernet) — repère les connecteurs RJ45.' },
  { file: '39c9dd23-1000081110.jpg', media: 'quiz-mat-alimentation.jpg', opts: [{ t: 'Un switch' }, { t: 'Une carte graphique' }, { t: 'Une alimentation (PSU)', ok: true }, { t: 'Un processeur' }], href: '/pages/hardware', course: 'Le hardware', ok: 'Boîtier avec ventilateur et connecteurs d’alimentation modulaires : le bloc d’alimentation.', no: 'C’est une alimentation (PSU) — le bloc qui alimente le PC en électricité.' },
  { file: 'e35f053a-1000081111.jpg', media: 'quiz-mat-ram.jpg', opts: [{ t: 'Une barrette de RAM', ok: true }, { t: 'Une carte mère' }, { t: 'Un câble RJ45' }, { t: 'Un routeur' }], href: '/pages/hardware', course: 'Le hardware', ok: 'Longue barrette avec puces et connecteur doré : la mémoire vive (RAM).', no: 'C’est une barrette de RAM (mémoire vive) — fine et longue, avec des puces.' },
  { file: 'ba61fdf7-1000081112.jpg', media: 'quiz-mat-switch.jpg', opts: [{ t: 'Un routeur' }, { t: 'Un switch', ok: true }, { t: 'Une alimentation' }, { t: 'Une carte mère' }], href: '/pages/le-switch', course: 'Le switch', ok: 'Boîtier avec une rangée de nombreux ports RJ45 identiques, sans antenne : un switch.', no: 'C’est un switch — beaucoup de ports RJ45 identiques (et pas d’antenne, contrairement au routeur).' },
  { file: '12133735-1000081113.jpg', media: 'quiz-mat-routeur.jpg', opts: [{ t: 'Un switch' }, { t: 'Une carte graphique' }, { t: 'Un routeur', ok: true }, { t: 'Une barrette de RAM' }], href: '/pages/le-routeur', course: 'Le routeur', ok: 'Boîtier avec antennes Wi-Fi, un port WAN et quelques ports LAN : un routeur.', no: 'C’est un routeur — antennes Wi-Fi + port WAN/Internet en plus des ports LAN.' },
];

// ===== CSS (scopé .qdia, sans JS, révélation via :has) =====
const recapCss = DATA.map((_, i) => { const n = i + 1; return `.qdia:has(.q${n}.ok input:checked) .rc-${n}{background:#16a34a;color:#fff;border-color:#16a34a}.qdia:has(.q${n}:not(.ok) input:checked) .rc-${n}{background:#dc2626;color:#fff;border-color:#dc2626}`; }).join('');
const STYLE = `<style>
.qdia{margin:6px 0}
.qd-slide{margin:14px 0;padding:14px;border:1px solid var(--border);border-radius:12px;background:var(--surface-2)}
.qd-q{margin:0 0 10px}
.qd-num{display:inline-block;background:#2563eb;color:#fff;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:700;margin-right:8px}
.qd-photo{margin:8px 0;text-align:center}
.qd-photo img{max-width:300px;width:100%;height:auto;border:1px solid var(--border);border-radius:10px;background:#fff;padding:8px}
.qd-opts{display:flex;flex-wrap:wrap;gap:10px}
.qd-opt{flex:1 1 45%;min-width:150px;border:2px solid var(--border);border-radius:10px;padding:12px;cursor:pointer;background:var(--surface);font-weight:600;display:flex;align-items:center;gap:8px}
.qd-fb{display:none;margin-top:10px;padding:8px 12px;border-radius:8px;font-size:14px}
.qd-ok{background:rgba(22,163,74,.12);border-left:3px solid #16a34a}
.qd-no{background:rgba(220,38,38,.10);border-left:3px solid #dc2626}
.qd-slide:has(.ok input:checked) .qd-ok{display:block}
.qd-slide:has(.qd-opt:not(.ok) input:checked) .qd-no{display:block}
.qd-slide:has(input:checked) .qd-opt.ok{border-color:#16a34a;box-shadow:0 0 0 1px #16a34a}
.qd-slide:has(.qd-opt:not(.ok) input:checked) .qd-opt:not(.ok):has(input:checked){border-color:#dc2626;box-shadow:0 0 0 1px #dc2626}
.qd-resume{margin:18px 0;padding:14px;border:1px solid var(--border);border-radius:12px;background:var(--surface-2)}
.qd-grid{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
.rc{width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:700;background:var(--surface);color:#64748b;border:1px solid var(--border)}
${recapCss}
</style>`;

function renderSlide(it: Item, idx: number, url: string): string {
  const n = idx + 1;
  const correctLabel = (it.opts.find(o => o.ok) || { t: '?' }).t;
  const opts = it.opts.map(o => `<label class="qd-opt q${n}${o.ok ? ' ok' : ''}"><input type="radio" name="qm${n}"> ${o.t}</label>`).join('');
  return `<div class="qd-slide"><p class="qd-q"><span class="qd-num">Photo ${n}/${DATA.length}</span><strong>Quel est ce composant ?</strong></p>`
    + `<div class="qd-photo"><img src="${url}" alt="Composant à identifier" loading="lazy"></div>`
    + `<div class="qd-opts">${opts}</div>`
    + `<div class="qd-fb qd-ok">✅ <strong>Bonne réponse !</strong> ${it.ok}</div>`
    + `<div class="qd-fb qd-no">❌ <strong>Raté</strong> — la bonne réponse : <strong>${correctLabel}</strong>. ${it.no} 👉 <a href="${it.href}">Revoir le cours : ${it.course}</a></div>`
    + `</div>`;
}

const recap = `<div class="qd-resume"><strong>📊 Résumé — tes réussites et tes échecs</strong>`
  + `<div class="qd-grid">${DATA.map((_, i) => `<span class="rc rc-${i + 1}">${i + 1}</span>`).join('')}</div>`
  + `<p class="meta">🟩 réussi · 🟥 échec · ⬜ pas encore répondu. Réponds à chaque photo : le bilan se remplit tout seul.</p></div>`;

const SLUG = 'jeu-reconnaitre-materiel';

// ===================================================================================
function cookieFrom(res: Response): string {
  const sc = (res.headers as any).getSetCookie?.() as string[] | undefined;
  return (sc && sc.length ? sc : [res.headers.get('set-cookie') || '']).map(c => c.split(';')[0]).filter(Boolean).join('; ');
}
async function ensureMedia(it: Item, list: Array<{ original_name: string; url: string }>, h: Record<string, string>, cookie: string): Promise<string> {
  const found = list.find(m => m.original_name === it.media);
  if (found) { console.log('MEDIA', it.media, '(déjà)'); return found.url; }
  const buf = fs.readFileSync(path.join(UPLOADS, it.file));
  const dataUrl = 'data:image/jpeg;base64,' + buf.toString('base64');
  const up = await fetch(`${BASE}/api/admin/media`, { method: 'POST', headers: h, body: JSON.stringify({ filename: it.media, dataUrl }) });
  if (!up.ok) throw new Error(`media ${it.media} ${up.status} ${await up.text()}`);
  const rec = await up.json() as { url: string };
  console.log('MEDIA', it.media, '(créé)', rec.url);
  return rec.url;
}
async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: PW }) });
  if (!login.ok) throw new Error(`login ${login.status}`);
  const cookie = cookieFrom(login);
  const h = { 'Content-Type': 'application/json', Cookie: cookie };
  const mediaList = await (await fetch(`${BASE}/api/admin/media`, { headers: { Cookie: cookie } })).json() as Array<{ original_name: string; url: string }>;

  const urls: string[] = [];
  for (const it of DATA) urls.push(await ensureMedia(it, mediaList, h, cookie));

  const slides = DATA.map((it, i) => renderSlide(it, i, urls[i])).join('');
  const blocks: PageBlock[] = [
    block('hero', { eyebrow: 'Exercices · Jeu', title: 'Reconnais le matériel', subtitle: '8 photos de composants PC et de matériel réseau : sauras-tu les identifier ?' }),
    block('html', { html: '<p class="meta">Pour chaque photo, choisis le bon composant. Le résultat s’affiche aussitôt ; en cas d’erreur, un lien renvoie au cours. ↩️ <a href="/pages/exercices">Retour aux exercices</a></p>' }),
    block('html', { html: STYLE + `<div class="qdia">${slides}${recap}</div>` }),
    block('html', { html: '<p class="meta">↩️ <a href="/pages/exercices">Retour aux exercices</a> · 📘 <a href="/pages/cours">Tous les cours</a></p>' }),
  ];

  const pages = await (await fetch(`${BASE}/api/admin/pages`, { headers: { Cookie: cookie } })).json() as Array<{ id: number; slug: string }>;
  const cur = pages.find(p => p.slug === SLUG);
  const body = JSON.stringify({ title: 'Reconnais le matériel', slug: SLUG, excerpt: 'Jeu en 8 photos : identifie le composant PC ou le matériel réseau, résultat immédiat et lien vers le cours en cas d’erreur.', content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1 });
  const res = cur
    ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body })
    : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log(`PAGE ${SLUG}`, res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());

  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

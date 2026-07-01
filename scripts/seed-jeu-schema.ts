/* Diaporama-quiz « Trouve le bon schéma réseau » : 10 diapos, 3 schémas chacune (1 correct).
   Résultat après chaque diapo (lien vers le cours si erreur) + récap final. CSS pur (:has), sans JS.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-jeu-schema.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);

const C = { net: '#2563eb', dev: '#059669', warn: '#d97706', danger: '#dc2626', grey: '#64748b', slate: '#475569', purple: '#7c3aed' };
// Petits éléments de schéma (mini-diagrammes 220x140)
const sn = (x: number, y: number, w: number, t: string, col: string) => `<rect x="${x}" y="${y}" width="${w}" height="22" rx="5" fill="${col}"/><text x="${x + w / 2}" y="${y + 15}" text-anchor="middle" font-size="9" fill="#fff" font-weight="bold">${t}</text>`;
const ln = (x1: number, y1: number, x2: number, y2: number, col = '#94a3b8', dash = false) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="2"${dash ? ' stroke-dasharray="5 3"' : ''}/>`;
const cloud = (cx: number, cy: number) => `<ellipse cx="${cx}" cy="${cy}" rx="28" ry="14" fill="${C.grey}"/><text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="9" fill="#fff" font-weight="bold">Internet</text>`;
const opt = (inner: string, capt: string) => `<svg viewBox="0 0 220 140" role="img" style="width:100%;height:auto;font-family:system-ui,sans-serif">${inner}<text x="110" y="133" text-anchor="middle" font-size="9" fill="#64748b">${capt}</text></svg>`;

type Diapo = { q: string; A: string; B: string; C: string; correct: 'A' | 'B' | 'C'; ok: string; no: string; href: string; course: string };

const DIAPOS: Diapo[] = [
  { // 1 — relier 3 PC d'un même réseau (correct B : étoile/switch)
    q: 'Comment relier proprement 3 PC d’un même réseau local ?',
    A: opt(sn(15, 58, 46, 'PC', C.dev) + sn(87, 58, 46, 'PC', C.dev) + sn(159, 58, 46, 'PC', C.dev) + ln(61, 69, 87, 69) + ln(133, 69, 159, 69), 'PC reliés en chaîne'),
    B: opt(sn(87, 28, 46, 'SW', C.net) + sn(15, 92, 46, 'PC', C.dev) + sn(87, 92, 46, 'PC', C.dev) + sn(159, 92, 46, 'PC', C.dev) + ln(110, 50, 38, 92) + ln(110, 50, 110, 92) + ln(110, 50, 182, 92), 'étoile via un switch'),
    C: opt(sn(15, 58, 46, 'PC', C.dev) + sn(87, 58, 46, 'PC', C.dev) + ln(61, 69, 87, 69) + sn(159, 58, 46, 'PC', C.dev), '1 poste non relié'),
    correct: 'B', ok: 'Un switch en étoile relie tous les postes du même réseau.', no: 'Les postes d’un même LAN se relient à un switch (topologie en étoile), pas en chaîne.', href: '/pages/le-switch', course: 'Le switch',
  },
  { // 2 — accès Internet (correct A : PC-Box-Internet)
    q: 'Quel schéma donne correctement l’accès à Internet ?',
    A: opt(cloud(110, 22) + sn(87, 52, 46, 'Box', C.grey) + sn(87, 92, 46, 'PC', C.dev) + ln(110, 36, 110, 52) + ln(110, 74, 110, 92), 'PC → Box → Internet'),
    B: opt(cloud(110, 22) + sn(87, 84, 46, 'PC', C.dev) + ln(110, 36, 110, 84), 'PC branché direct sur Internet'),
    C: opt(cloud(110, 22) + sn(87, 52, 46, 'SW', C.net) + sn(87, 92, 46, 'PC', C.dev) + ln(110, 36, 110, 52) + ln(110, 74, 110, 92), 'switch sans routeur/box'),
    correct: 'A', ok: 'La box (routeur) fait le lien entre le réseau local et Internet.', no: 'Il faut une box/routeur entre le réseau local et Internet ; un switch seul ne route pas.', href: '/pages/le-routeur', course: 'Le routeur',
  },
  { // 3 — isoler deux services (correct C : 2 VLAN séparés)
    q: 'Comment isoler deux services (ex. compta / production) ?',
    A: opt(sn(87, 28, 46, 'SW', C.net) + sn(15, 86, 46, 'PC', C.dev) + sn(87, 86, 46, 'PC', C.dev) + sn(159, 86, 46, 'PC', C.dev) + ln(110, 50, 38, 86) + ln(110, 50, 110, 86) + ln(110, 50, 182, 86), 'tout sur un seul réseau'),
    B: opt(sn(40, 28, 50, 'VLAN A', C.purple) + sn(130, 28, 50, 'VLAN B', C.warn) + ln(90, 39, 130, 39) + sn(40, 86, 46, 'PC', C.dev) + sn(134, 86, 46, 'PC', C.dev) + ln(65, 50, 63, 86) + ln(155, 50, 157, 86), 'VLAN reliés entre eux'),
    C: opt(sn(40, 28, 50, 'VLAN A', C.purple) + sn(130, 28, 50, 'VLAN B', C.warn) + sn(40, 86, 46, 'PC', C.dev) + sn(134, 86, 46, 'PC', C.dev) + ln(65, 50, 63, 86) + ln(155, 50, 157, 86), '2 VLAN isolés'),
    correct: 'C', ok: 'Deux VLAN séparés cloisonnent les services entre eux.', no: 'On isole les services dans des VLAN séparés (sans liaison directe entre eux).', href: '/pages/reseau-entreprise', course: 'Réseau d’entreprise',
  },
  { // 4 — sécuriser l'accès Internet (correct B : pare-feu avant LAN)
    q: 'Où placer le pare-feu pour protéger le réseau ?',
    A: opt(cloud(110, 20) + sn(87, 48, 46, 'Box', C.grey) + sn(87, 92, 46, 'LAN', C.net) + ln(110, 34, 110, 48) + ln(110, 70, 110, 92), 'aucun pare-feu'),
    B: opt(cloud(110, 16) + sn(87, 40, 40, 'Box', C.grey) + sn(87, 72, 40, 'FW', C.danger) + sn(87, 104, 40, 'LAN', C.net) + ln(107, 30, 107, 40) + ln(107, 62, 107, 72) + ln(107, 94, 107, 104), 'pare-feu avant le LAN'),
    C: opt(cloud(110, 16) + sn(87, 40, 40, 'Box', C.grey) + sn(87, 72, 40, 'LAN', C.net) + sn(87, 104, 40, 'FW', C.danger) + ln(107, 30, 107, 40) + ln(107, 62, 107, 72) + ln(107, 94, 107, 104), 'pare-feu après le LAN'),
    correct: 'B', ok: 'Le pare-feu se place entre Internet et le réseau local.', no: 'Le pare-feu doit filtrer AVANT le LAN, entre la box et le réseau interne.', href: '/pages/le-pare-feu', course: 'Le pare-feu',
  },
  { // 5 — serveur web exposé (correct A : DMZ)
    q: 'Où héberger un serveur web accessible depuis Internet ?',
    A: opt(cloud(110, 16) + sn(87, 42, 46, 'FW', C.danger) + sn(140, 84, 52, 'DMZ Srv', C.warn) + sn(30, 84, 46, 'LAN', C.net) + ln(110, 53, 166, 84) + ln(110, 53, 53, 84), 'serveur en DMZ'),
    B: opt(cloud(110, 16) + sn(87, 40, 46, 'FW', C.danger) + sn(87, 72, 46, 'LAN', C.net) + sn(80, 104, 60, 'Srv web', C.slate) + ln(110, 30, 110, 40) + ln(110, 62, 110, 72) + ln(110, 94, 110, 104), 'serveur dans le LAN'),
    C: opt(cloud(110, 18) + sn(80, 76, 60, 'Srv web', C.slate) + ln(110, 32, 110, 76), 'serveur exposé sans pare-feu'),
    correct: 'A', ok: 'Un serveur exposé se met en DMZ, isolé du réseau interne.', no: 'Un serveur public se place en DMZ, jamais directement dans le LAN ni sans pare-feu.', href: '/pages/schemas-infrastructure', course: 'Les schémas d’infrastructure',
  },
  { // 6 — relier deux sites (correct C : VPN)
    q: 'Comment relier deux sites distants en toute sécurité ?',
    A: opt(sn(84, 26, 46, 'SW', C.net) + sn(28, 86, 52, 'Site A', C.net) + sn(132, 86, 52, 'Site B', C.dev) + ln(107, 48, 54, 86) + ln(107, 48, 158, 86), 'même switch (impossible à distance)'),
    B: opt(cloud(110, 22) + sn(24, 86, 52, 'Site A', C.net) + sn(136, 86, 52, 'Site B', C.dev) + ln(86, 33, 50, 86) + ln(134, 33, 162, 86), 'via Internet, non chiffré'),
    C: opt(cloud(110, 22) + sn(24, 86, 52, 'Site A', C.net) + sn(136, 86, 52, 'Site B', C.dev) + ln(86, 33, 50, 86, C.purple, true) + ln(134, 33, 162, 86, C.purple, true) + `<text x="110" y="64" text-anchor="middle" font-size="9" fill="${C.purple}" font-weight="bold">VPN</text>`, 'tunnel VPN chiffré'),
    correct: 'C', ok: 'Un VPN crée un tunnel chiffré entre les sites via Internet.', no: 'On relie deux sites distants par un VPN (tunnel chiffré sur Internet).', href: '/pages/reseau-entreprise', course: 'Réseau d’entreprise',
  },
  { // 7 — Wi-Fi invités (correct B : VLAN invités isolé)
    q: 'Comment offrir un Wi-Fi aux clients sans risque ?',
    A: opt(sn(87, 26, 46, 'SW', C.net) + sn(40, 86, 46, 'AP', C.dev) + sn(134, 86, 46, 'Srv', C.slate) + ln(110, 48, 63, 86) + ln(110, 48, 157, 86), 'invités sur le réseau interne'),
    B: opt(sn(34, 26, 54, 'VLAN int', C.net) + sn(132, 26, 56, 'VLAN inv', C.warn) + sn(40, 86, 46, 'PC', C.dev) + sn(137, 86, 46, 'AP', C.dev) + ln(61, 48, 63, 86) + ln(160, 48, 160, 86), 'Wi-Fi invités isolé (VLAN)'),
    C: opt(sn(87, 26, 46, 'Srv', C.slate) + sn(87, 84, 46, 'AP', C.dev) + ln(110, 48, 110, 84), 'invités reliés aux serveurs'),
    correct: 'B', ok: 'Le Wi-Fi invités va dans un VLAN isolé du réseau interne.', no: 'Le Wi-Fi clients doit être isolé (VLAN/SSID séparé), jamais sur le réseau interne.', href: '/pages/reseau-entreprise', course: 'Réseau d’entreprise',
  },
  { // 8 — plan d'adressage (correct A : sous-réseaux distincts)
    q: 'Quel plan d’adressage IP est correct pour deux réseaux ?',
    A: opt(sn(34, 40, 70, '10.0/24', C.net) + sn(118, 40, 70, '20.0/24', C.warn) + sn(46, 90, 46, 'PC', C.dev) + sn(132, 90, 46, 'PC', C.dev) + ln(69, 62, 69, 90) + ln(153, 62, 155, 90), 'sous-réseaux distincts'),
    B: opt(sn(34, 40, 70, '1.0/24', C.net) + sn(118, 40, 70, '1.0/24', C.net) + sn(46, 90, 46, 'PC', C.dev) + sn(132, 90, 46, 'PC', C.dev) + ln(69, 62, 69, 90) + ln(153, 62, 155, 90), 'même sous-réseau des 2 côtés'),
    C: opt(sn(34, 60, 70, '.1.10', C.net) + sn(118, 60, 70, '.1.10', C.danger) + `<text x="110" y="44" text-anchor="middle" font-size="9" fill="${C.danger}" font-weight="bold">IP identiques</text>`, 'adresses IP en double'),
    correct: 'A', ok: 'Chaque réseau doit avoir son propre sous-réseau, sans doublon d’IP.', no: 'Deux réseaux = deux sous-réseaux distincts ; jamais d’adresses ou de plages en double.', href: '/pages/bases-du-reseau', course: 'Les bases du réseau',
  },
  { // 9 — switch vs hub (correct C : switch)
    q: 'Quel équipement relier les postes sans collisions ?',
    A: opt(sn(87, 28, 46, 'HUB', C.danger) + sn(15, 88, 46, 'PC', C.dev) + sn(87, 88, 46, 'PC', C.dev) + sn(159, 88, 46, 'PC', C.dev) + ln(110, 50, 38, 88) + ln(110, 50, 110, 88) + ln(110, 50, 182, 88), 'un hub (collisions)'),
    B: opt(sn(15, 60, 46, 'PC', C.dev) + sn(87, 60, 46, 'PC', C.dev) + sn(159, 60, 46, 'PC', C.dev) + ln(61, 71, 87, 71) + ln(133, 71, 159, 71), 'sans équipement (en chaîne)'),
    C: opt(sn(87, 28, 46, 'SW', C.net) + sn(15, 88, 46, 'PC', C.dev) + sn(87, 88, 46, 'PC', C.dev) + sn(159, 88, 46, 'PC', C.dev) + ln(110, 50, 38, 88) + ln(110, 50, 110, 88) + ln(110, 50, 182, 88), 'un switch (commute)'),
    correct: 'C', ok: 'Le switch envoie chaque trame au bon port (pas de collision, contrairement au hub).', no: 'On utilise un switch : il commute vers le bon port, là où le hub crée des collisions.', href: '/pages/le-switch', course: 'Le switch',
  },
  { // 10 — cœur de réseau (correct B : switch cœur)
    q: 'Comment structurer plusieurs switchs d’accès ?',
    A: opt(sn(20, 30, 46, 'SW', C.net) + sn(87, 58, 46, 'SW', C.net) + sn(154, 86, 46, 'SW', C.net) + ln(66, 41, 87, 58) + ln(133, 69, 154, 86), 'switchs en cascade'),
    B: opt(sn(84, 26, 52, 'Cœur', C.net) + sn(20, 88, 46, 'SW', C.net) + sn(87, 88, 46, 'SW', C.net) + sn(154, 88, 46, 'SW', C.net) + ln(110, 48, 43, 88) + ln(110, 48, 110, 88) + ln(110, 48, 177, 88), 'switch cœur (étoile)'),
    C: opt(sn(40, 30, 46, 'SW', C.net) + sn(134, 30, 46, 'SW', C.net) + sn(87, 86, 46, 'SW', C.net) + ln(86, 41, 134, 41) + ln(63, 52, 100, 86) + ln(157, 52, 120, 86), 'en boucle (tempête réseau)'),
    correct: 'B', ok: 'Les switchs d’accès se relient à un switch cœur (topologie en étoile).', no: 'On relie les switchs d’accès à un switch cœur, pas en cascade ni en boucle.', href: '/pages/schemas-infrastructure', course: 'Les schémas d’infrastructure',
  },
];

// ===== CSS (scopé .qdia, sans JS, révélation via :has) =====
const recapCss = DIAPOS.map((_, i) => { const n = i + 1; return `.qdia:has(.q${n}.ok input:checked) .rc-${n}{background:#16a34a;color:#fff;border-color:#16a34a}.qdia:has(.q${n}:not(.ok) input:checked) .rc-${n}{background:#dc2626;color:#fff;border-color:#dc2626}`; }).join('');
const STYLE = `<style>
.qdia{margin:6px 0}
.qd-slide{margin:14px 0;padding:14px;border:1px solid var(--border);border-radius:12px;background:var(--surface-2)}
.qd-q{margin:0 0 10px}
.qd-num{display:inline-block;background:#2563eb;color:#fff;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:700;margin-right:8px}
.qd-opts{display:flex;flex-wrap:wrap;gap:10px}
.qd-opt{flex:1 1 200px;min-width:170px;border:2px solid var(--border);border-radius:10px;padding:8px;cursor:pointer;background:var(--surface)}
.qd-ohead{display:flex;align-items:center;gap:6px;font-weight:700;color:#64748b;margin-bottom:4px}
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

function renderDiapo(d: Diapo, idx: number): string {
  const n = idx + 1;
  const o = (L: 'A' | 'B' | 'C', svg: string) =>
    `<label class="qd-opt q${n}${d.correct === L ? ' ok' : ''}"><span class="qd-ohead"><input type="radio" name="qd${n}"> Schéma ${L}</span>${svg}</label>`;
  return `<div class="qd-slide"><p class="qd-q"><span class="qd-num">Diapo ${n}/10</span><strong>${d.q}</strong></p>`
    + `<div class="qd-opts">${o('A', d.A)}${o('B', d.B)}${o('C', d.C)}</div>`
    + `<div class="qd-fb qd-ok">✅ <strong>Bonne réponse !</strong> ${d.ok}</div>`
    + `<div class="qd-fb qd-no">❌ <strong>Raté</strong> — la bonne réponse est le <strong>Schéma ${d.correct}</strong>. ${d.no} 👉 <a href="${d.href}">Revoir le cours : ${d.course}</a></div>`
    + `</div>`;
}

const recap = `<div class="qd-resume"><strong>📊 Résumé — tes réussites et tes échecs</strong>`
  + `<div class="qd-grid">${DIAPOS.map((_, i) => `<span class="rc rc-${i + 1}">${i + 1}</span>`).join('')}</div>`
  + `<p class="meta">🟩 réussi · 🟥 échec · ⬜ pas encore répondu. Réponds à chaque diapo : le bilan se remplit tout seul.</p></div>`;

const SLUG = 'jeu-schema-reseau';
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Exercices · Jeu', title: 'Trouve le bon schéma réseau', subtitle: '10 diapos, 3 schémas à chaque fois : à toi de repérer le bon !' }),
  block('html', { html: '<p class="meta">Pour chaque diapo, choisis le <strong>schéma correct</strong> parmi les trois. Le résultat s’affiche aussitôt ; en cas d’erreur, un lien te renvoie au cours. ↩️ <a href="/pages/exercices">Retour aux exercices</a></p>' }),
  block('html', { html: STYLE + `<div class="qdia">${DIAPOS.map(renderDiapo).join('')}${recap}</div>` }),
  block('html', { html: '<p class="meta">↩️ <a href="/pages/exercices">Retour aux exercices</a> · 📘 <a href="/pages/cours">Tous les cours</a></p>' }),
];

const PAGE = { slug: SLUG, title: 'Trouve le bon schéma réseau', excerpt: 'Jeu en 10 diapos : repère le bon schéma réseau parmi trois, résultat immédiat et lien vers le cours en cas d’erreur.' };

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
  const cur = existing.find(e => e.slug === SLUG);
  const body = JSON.stringify({ title: PAGE.title, slug: SLUG, excerpt: PAGE.excerpt, content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1 });
  const res = cur
    ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body })
    : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log(`PAGE ${SLUG}`, res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());
  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

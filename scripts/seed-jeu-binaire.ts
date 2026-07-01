/* Page exercice « Le jeu du binaire » (façon Cisco) : on active les 8 bits (128..1) pour
   atteindre un nombre cible. Total affiché en direct via compteurs CSS, validation par :has().
   100% CSS, sans JS. Usage : BASE=... ADMIN_PW=... tsx scripts/seed-jeu-binaire.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const SLUG = 'jeu-binaire';

const WEIGHTS = [128, 64, 32, 16, 8, 4, 2, 1];
const bitsHtml = WEIGHTS.map(w => `<label class="bit"><input type="checkbox" class="w${w}"><span class="face"><span class="wt">${w}</span></span></label>`).join('');

const TARGETS = [5, 18, 42, 100, 167, 218, 255];

function defi(target: number, n: number): string {
  return `<div class="bx bx-${target}"><p class="bxh"><span class="bxn">Défi ${n}</span> 🎯 Objectif : <b class="bxt">${target}</b></p>`
    + `<div class="bits">${bitsHtml}</div>`
    + `<p class="tot">Total : <span class="totv"></span></p>`
    + `<p class="ok">✅ Bravo, tu as composé ${target} !</p></div>`;
}
function successRule(target: number): string {
  const sel = WEIGHTS.map(w => ((target & w) === w ? `:has(.w${w}:checked)` : `:not(:has(.w${w}:checked))`)).join('');
  return `.bx-${target}${sel} .ok{display:block}`;
}

const incRules = WEIGHTS.map(w => `.bx input.w${w}:checked{counter-increment:tot ${w}}`).join('');
const STYLE = `<style>
.bx{counter-reset:tot;border:1px solid var(--border);border-radius:12px;padding:14px;margin:12px 0;background:var(--surface-2)}
.bxh{margin:0 0 4px}
.bxn{display:inline-block;background:#2563eb;color:#fff;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:700;margin-right:8px}
.bxt{color:#2563eb;font-size:18px}
.bits{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}
.bit{position:relative}
.bit input{position:absolute;opacity:0;width:0;height:0}
.face{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;width:54px;height:58px;border:2px solid var(--border);border-radius:8px;background:var(--surface);cursor:pointer;user-select:none}
.face .wt{font-size:11px;color:#64748b}
.face::after{content:"0";font-size:20px;font-weight:800;color:#94a3b8}
.bit input:checked + .face{background:#2563eb;border-color:#2563eb}
.bit input:checked + .face .wt{color:#dbeafe}
.bit input:checked + .face::after{content:"1";color:#fff}
${incRules}
.tot{font-weight:700;font-size:16px;margin:6px 0 0}
.totv::after{content:counter(tot)}
.ok{display:none;margin-top:8px;padding:8px 12px;border-radius:8px;background:rgba(22,163,74,.15);border-left:3px solid #16a34a;font-weight:700;color:#16a34a}
${TARGETS.map(successRule).join('')}
</style>`;

const sandbox = `<div class="bx"><p class="bxh">🎛️ <b>Bac à sable</b> — active les bits et regarde la valeur :</p><div class="bits">${bitsHtml}</div><p class="tot">Valeur décimale : <span class="totv"></span></p></div>`;

const blocks: PageBlock[] = [
  block('html', { html: STYLE }),
  block('hero', { eyebrow: 'Exercices · Binaire', title: 'Le jeu du binaire', subtitle: 'Active les bits (128 → 1) pour atteindre le nombre cible — le total s’affiche en direct.' }),
  block('html', { html: '<p>Chaque <strong>bit</strong> vaut un poids (128, 64, 32, 16, 8, 4, 2, 1). Clique pour l’<strong>allumer (1)</strong> ou l’<strong>éteindre (0)</strong> : le <strong>total</strong> se met à jour automatiquement. Atteins le nombre demandé pour valider le défi ! ↩️ <a href="/pages/exercices">Retour aux exercices</a></p>' }),
  note('blue', '💡 Comment jouer', '<p>Additionne les poids des bits allumés. Exemple : pour faire <strong>192</strong>, allume <strong>128</strong> et <strong>64</strong> (128 + 64 = 192). Besoin d’un rappel ? Vois le cours <a href="/pages/ip-et-binaire">IP et initiation au binaire</a>.</p>'),

  block('heading', { level: 2, text: '🎛️ Bac à sable' }),
  block('html', { html: sandbox }),

  block('heading', { level: 2, text: '🎯 Les défis' }),
  block('html', { html: '<p class="meta">Compose chaque nombre cible. Quand c’est bon, un message vert apparaît.</p>' }),
  block('html', { html: TARGETS.map((t, i) => defi(t, i + 1)).join('') }),

  note('green', '💡 À retenir', '<p>Un octet = <strong>8 bits</strong>, poids <strong>128 → 1</strong>, soit des valeurs de <strong>0 à 255</strong>. La valeur = la <strong>somme des poids des bits à 1</strong>. Pour comprendre la théorie : <a href="/pages/ip-et-binaire">IP et initiation au binaire</a>. ↩️ <a href="/pages/exercices">Retour aux exercices</a></p>'),
];

const PAGE = { slug: SLUG, title: 'Le jeu du binaire', excerpt: 'Exercice interactif : active les bits (128 à 1) pour atteindre le nombre cible, avec total en direct et validation — pour s’entraîner à la conversion binaire/décimal.' };

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

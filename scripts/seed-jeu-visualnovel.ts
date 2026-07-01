/* Visual novel « Incidents TSSR » — moteur de GRAPHE de scènes (embranchements).
   Lit scripts/vn-data/lvl*.json (un graphe par niveau, 1 par couche OSI, 6 à 20 étapes,
   avec branches/détours/impasses). Rendu 100% CSS via :target (sans JS).
   Schéma JSON par niveau :
   { n, layer, diff, title, setup, start, nodes: {
       "<key>": { kind:"step", text, question?, choices:[ {t, to} ] }
       "<key>": { kind:"fail", text, course?, courseLabel?, retryTo }
       "<key>": { kind:"win",  text }
   } }
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-jeu-visualnovel.ts */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const SLUG = 'jeu-incidents-tssr';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'vn-data');

type Choice = { t: string; to: string };
type Node = { kind?: string; text: string; question?: string; choices?: Choice[]; course?: string; courseLabel?: string; retryTo?: string };
type Level = { n: number; layer: string; diff: number; title: string; setup: string; start: string; nodes: Record<string, Node> };

const stars = (n: number) => '★'.repeat(Math.max(0, Math.min(7, n))) + '☆'.repeat(7 - Math.max(0, Math.min(7, n)));
const sid = (n: number, k: string) => `vn-l${n}-${String(k).replace(/[^a-zA-Z0-9]/g, '_')}`;

function loadLevels(): Level[] {
  if (!fs.existsSync(DATA_DIR)) throw new Error(`Dossier introuvable : ${DATA_DIR}`);
  const out: Level[] = [];
  for (const f of fs.readdirSync(DATA_DIR).filter(f => /^lvl\d+\.json$/i.test(f))) {
    let d: any;
    try { d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')); } catch (e) { console.error(`✗ ${f}: JSON invalide — ${(e as Error).message}`); continue; }
    if (!d || !d.nodes || !d.start || !d.nodes[d.start]) { console.error(`✗ ${f}: start/nodes manquants`); continue; }
    out.push(d as Level);
  }
  return out.sort((a, b) => a.n - b.n);
}

function validate(l: Level): { steps: number; fixed: number } {
  const keys = new Set(Object.keys(l.nodes));
  let fixed = 0, steps = 0;
  for (const [k, node] of Object.entries(l.nodes)) {
    const kind = node.kind || 'step';
    if (kind === 'step') {
      steps++;
      for (const c of node.choices || []) { if (!keys.has(c.to)) { console.warn(`  ⚠ lvl${l.n}/${k}: cible « ${c.to} » absente → redirigée vers start`); c.to = l.start; fixed++; } }
    } else if (kind === 'fail') {
      if (!node.retryTo || !keys.has(node.retryTo)) { node.retryTo = l.start; fixed++; }
    }
  }
  return { steps, fixed };
}

function renderLevel(l: Level, nextStart: string | null): string {
  const parts: string[] = [];
  const head = `<span class="vn-eyebrow">Couche ${l.layer}</span><span class="vn-diff">${stars(l.diff || l.n)}</span>`;
  for (const [k, node] of Object.entries(l.nodes)) {
    const id = sid(l.n, k);
    const kind = node.kind || 'step';
    const isStart = k === l.start;
    if (kind === 'win') {
      const nextHref = nextStart ? `#${nextStart}` : '#victoire';
      const nextLabel = nextStart ? `Incident suivant →` : 'Voir le résultat final 🏆';
      parts.push(`<section id="${id}" class="vn-scene"><div class="vn-card ok"><p class="vn-tok">✅ Panne résolue !</p><p>${node.text}</p><a class="vn-next" href="${nextHref}">${nextLabel}</a></div></section>`);
    } else if (kind === 'fail') {
      parts.push(`<section id="${id}" class="vn-scene"><div class="vn-card bad"><p class="vn-tbad">❌ Pas le bon réflexe</p><p>${node.text}</p>`
        + (node.course ? `<p class="meta">👉 <a href="/pages/${node.course}">Revoir le cours : ${node.courseLabel || node.course}</a></p>` : '')
        + `<a class="vn-retry" href="#${sid(l.n, node.retryTo || l.start)}">↻ Revenir à cette étape</a></div></section>`);
    } else {
      const choices = (node.choices || []).map(c => `<a class="vn-choice" href="#${sid(l.n, c.to)}">${c.t}</a>`).join('');
      parts.push(`<section id="${id}" class="vn-scene"><div class="vn-card">${head}`
        + `<p class="vn-h">Niveau ${l.n} — ${l.title}</p>`
        + (isStart ? `<p>${l.setup}</p>` : '')
        + `<p>${node.text}</p>`
        + (node.question ? `<p><strong>${node.question}</strong></p>` : '')
        + choices
        + `<p class="vn-back meta">↩️ <a href="#vn-top">Menu / recommencer</a></p></div></section>`);
    }
  }
  return parts.join('');
}

const STYLE = `<style>
.vn{margin:6px 0}
.vn-scene{display:none}
.vn-scene:target{display:block}
.vn-start{display:block}
.vn:has(.vn-scene:target) .vn-start{display:none}
.vn-card{border:1px solid var(--border);border-radius:14px;padding:16px;background:var(--surface-2);margin:8px 0}
.vn-eyebrow{display:inline-block;background:#2563eb;color:#fff;border-radius:999px;padding:2px 11px;font-size:12px;font-weight:700}
.vn-diff{color:#d97706;font-weight:700;margin-left:8px;letter-spacing:1px}
.vn-h{font-size:18px;font-weight:700;margin:10px 0 8px}
.vn-choice{display:block;margin:8px 0;padding:13px 15px;border:1px solid var(--border);border-radius:10px;background:var(--surface);text-decoration:none;color:var(--text);font-weight:600}
.vn-choice:hover,.vn-choice:active{border-color:#2563eb}
.vn-card.ok{border-left:4px solid #16a34a}
.vn-card.bad{border-left:4px solid #dc2626}
.vn-tok{color:#16a34a;font-weight:700;margin:0 0 6px}
.vn-tbad{color:#dc2626;font-weight:700;margin:0 0 6px}
.vn-next{display:inline-block;margin-top:10px;padding:11px 18px;border-radius:10px;background:#16a34a;color:#fff;text-decoration:none;font-weight:700}
.vn-retry{display:inline-block;margin-top:10px;padding:11px 18px;border-radius:10px;background:#64748b;color:#fff;text-decoration:none;font-weight:700}
.vn-menu{margin-top:10px;display:flex;flex-wrap:wrap;gap:6px}
.vn-menu a{padding:7px 11px;border:1px solid var(--border);border-radius:8px;text-decoration:none;font-size:13px;background:var(--surface)}
.vn-back{font-size:13px}
</style>`;

function buildVN(levels: Level[]): string {
  const parts: string[] = [STYLE, '<div class="vn">'];
  parts.push(`<div class="vn-start" id="vn-top"><div class="vn-card">`
    + `<span class="vn-eyebrow">Visual novel</span>`
    + `<p class="vn-h">Incidents TSSR — diagnostique avant de réparer</p>`
    + `<p>Tu es <strong>technicien TSSR</strong>. Sept incidents, un par <strong>couche OSI</strong>. La règle d’or : <strong>chercher la panne d’abord</strong> (observer, tester), en remontant les couches <strong>du bas vers le haut</strong>, puis corriger. Chaque cas est une <strong>enquête à embranchements</strong> : tes choix ouvrent des pistes, des détours… ou des impasses.</p>`
    + `<p class="meta">Difficulté : Couche 1 ${stars(1)} → Couche 7 ${stars(7)}. Contexte Windows Server, Hyper-V, Gestionnaire de serveurs.</p>`
    + `<a class="vn-next" href="#${sid(levels[0].n, levels[0].start)}">▶️ Commencer (Couche ${levels[0].n})</a>`
    + `<div class="vn-menu">${levels.map(l => `<a href="#${sid(l.n, l.start)}">${l.n} · ${l.layer.split('· ')[1] || l.layer}</a>`).join('')}</div>`
    + `</div></div>`);

  levels.forEach((l, i) => {
    const next = i < levels.length - 1 ? sid(levels[i + 1].n, levels[i + 1].start) : null;
    parts.push(renderLevel(l, next));
  });

  parts.push(`<section id="victoire" class="vn-scene"><div class="vn-card ok"><p class="vn-tok">🏆 Bravo, les ${levels.length} incidents sont résolus !</p>`
    + `<p>De la couche <strong>Physique</strong> à la couche <strong>Application</strong>, tu as appliqué la vraie méthode TSSR : <strong>observer et tester d’abord, corriger ensuite</strong>, en remontant les couches une par une.</p>`
    + `<a class="vn-next" href="#vn-top">Rejouer</a> <a class="vn-retry" href="/pages/exercices">Retour aux exercices</a></div></section>`);
  parts.push('</div>');
  return parts.join('');
}

// ===================================================================================
function cookieFrom(res: Response): string {
  const sc = (res.headers as any).getSetCookie?.() as string[] | undefined;
  return (sc && sc.length ? sc : [res.headers.get('set-cookie') || '']).map(c => c.split(';')[0]).filter(Boolean).join('; ');
}
async function main() {
  const levels = loadLevels();
  if (!levels.length) throw new Error('Aucun niveau valide dans vn-data/.');
  levels.forEach(l => { const { steps, fixed } = validate(l); console.log(`Niveau ${l.n} (${l.layer}) : ${Object.keys(l.nodes).length} scènes, ${steps} étapes${fixed ? `, ${fixed} liens corrigés` : ''}`); });

  const blocks: PageBlock[] = [
    block('hero', { eyebrow: 'Exercices · Visual novel', title: 'Incidents TSSR', subtitle: '7 enquêtes de dépannage à embranchements, une par couche OSI.' }),
    block('html', { html: '<p class="meta">Jeu d’aventure : mène le diagnostic dans le bon ordre, suis les pistes, évite les impasses. ↩️ <a href="/pages/exercices">Retour aux exercices</a></p>' }),
    block('html', { html: buildVN(levels) }),
  ];

  const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: PW }) });
  if (!login.ok) throw new Error(`login ${login.status}`);
  const cookie = cookieFrom(login);
  const h = { 'Content-Type': 'application/json', Cookie: cookie };
  const pages = await (await fetch(`${BASE}/api/admin/pages`, { headers: { Cookie: cookie } })).json() as Array<{ id: number; slug: string }>;
  const cur = pages.find(p => p.slug === SLUG);
  const body = JSON.stringify({ title: 'Incidents TSSR (visual novel)', slug: SLUG, excerpt: 'Jeu d’aventure TSSR : 7 enquêtes de dépannage à embranchements (une par couche OSI), en contexte Windows Server / Hyper-V.', content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1 });
  const res = cur
    ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body })
    : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log(`PAGE ${SLUG}`, res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());
  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

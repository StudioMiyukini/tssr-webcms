/* Page d’accueil « Portail TSSR » : héro + accès rapide (cartes) + domaines couverts + agenda + planning.
   Refonte lisible et organisée. Usage : BASE=... ADMIN_PW=... tsx scripts/seed-accueil.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const html = (h: string) => Object.assign(makePageBlock('html'), { html: h }) as PageBlock;

const STYLE = `<style>
.pt-hero{position:relative;text-align:center;padding:36px 20px 28px;border:1px solid var(--border);border-radius:18px;background:radial-gradient(130% 140% at 50% 0%,color-mix(in srgb,var(--accent) 18%,transparent),transparent 62%),var(--surface-2);margin-bottom:8px;overflow:hidden}
.pt-eyebrow{display:inline-block;font-size:11.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,transparent);border:1px solid color-mix(in srgb,var(--accent) 32%,transparent);padding:4px 13px;border-radius:999px;margin-bottom:14px}
.pt-hero h1{font-size:clamp(27px,4.6vw,42px);margin:0 0 12px;line-height:1.08}
.pt-hero h1 .dot{color:var(--accent)}
.pt-hero p.lead{font-size:clamp(14px,2vw,17px);color:var(--text-soft);max-width:640px;margin:0 auto 20px;line-height:1.6}
.pt-cta{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.pt-btn{display:inline-flex;align-items:center;gap:7px;padding:11px 20px;border-radius:11px;font-weight:700;font-size:14px;text-decoration:none;border:1px solid var(--accent);background:var(--accent);color:#fff;transition:transform .1s}
.pt-btn:hover{transform:translateY(-2px)}
.pt-btn.alt{background:transparent;color:var(--accent)}
.pt-sec{margin:34px 0 16px}
.pt-sec h2{display:flex;align-items:center;gap:9px;font-size:20px;margin:0 0 3px}
.pt-sec p.sub{color:var(--text-muted);font-size:13px;margin:0}
.pt-grid{display:grid;gap:15px;grid-template-columns:repeat(auto-fill,minmax(215px,1fr))}
.pt-card{position:relative;display:flex;flex-direction:column;gap:7px;padding:17px 16px 15px;border:1px solid var(--border);border-radius:15px;background:var(--surface);text-decoration:none;color:var(--text);transition:transform .12s,border-color .12s,box-shadow .12s}
.pt-card:hover{transform:translateY(-3px);border-color:color-mix(in srgb,var(--accent) 55%,var(--border));box-shadow:0 12px 28px rgba(0,0,0,.13)}
.pt-card .ic{font-size:27px;line-height:1}
.pt-card .ti{font-weight:700;font-size:15.5px;display:flex;align-items:center;gap:7px}
.pt-card .de{font-size:12.5px;color:var(--text-muted);line-height:1.5}
.pt-card .go{margin-top:auto;padding-top:4px;font-size:12px;font-weight:700;color:var(--accent)}
.pt-badge{font-size:9.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#fff;background:var(--accent);border-radius:999px;padding:2px 7px}
.pt-doms{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}
.pt-dom{display:flex;align-items:center;gap:10px;padding:11px 13px;border:1px solid var(--border);border-radius:12px;background:var(--surface);text-decoration:none;color:var(--text);font-weight:600;font-size:13.5px;transition:border-color .12s,background .12s}
.pt-dom:hover{border-color:var(--accent);background:var(--surface-2)}
.pt-dom .ic{font-size:20px}
.pt-note{margin:30px 0 6px;text-align:center;font-size:12.5px;color:var(--text-muted);line-height:1.6}
@media(max-width:560px){.pt-hero{padding:26px 14px 20px}.pt-grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}}
</style>`;

const card = (icon: string, title: string, desc: string, href: string, badge = '') => `<a class="pt-card" href="${href}">
  <span class="ic">${icon}</span>
  <span class="ti">${title}${badge ? ` <span class="pt-badge">${badge}</span>` : ''}</span>
  <span class="de">${desc}</span>
  <span class="go">Ouvrir →</span>
</a>`;
const dom = (icon: string, name: string, href: string) => `<a class="pt-dom" href="${href}"><span class="ic">${icon}</span>${name}</a>`;

const HERO = `<div class="pt-hero">
  <span class="pt-eyebrow">Mémo de formation</span>
  <h1>Portail de révision <span class="dot">TSSR</span></h1>
  <p class="lead">Cours, procédures, exercices et outils interactifs pour préparer le titre <strong>Technicien Supérieur Systèmes et Réseaux</strong> — hardware, Windows &amp; Active Directory, réseau, Cisco, Linux.</p>
  <div class="pt-cta">
    <a class="pt-btn" href="/pages/cours">📚 Explorer les cours</a>
    <a class="pt-btn alt" href="/pages/simulateur-complet">🖥️ Ouvrir le simulateur</a>
  </div>
</div>`;

const ACCES = `<div class="pt-sec"><h2>🚀 Accès rapide</h2><p class="sub">Les grandes sections du site.</p></div>
<div class="pt-grid">
${card('📚', 'Cours', 'Le programme complet, classé par domaine : notions, schémas et fiches.', '/pages/cours')}
${card('🧭', 'Procédures', 'Pas-à-pas concrets : AD, DNS, DHCP, GPO, IIS, Cisco, Hyper-V…', '/pages/procedures')}
${card('✍️', 'Exercices', 'S’entraîner : subnetting, quiz, TP corrigés et jeux.', '/pages/exercices')}
${card('⚙️', 'Outils', 'Configurateurs &amp; générateurs : routeur Cisco, AD, IP/VLSM, DHCP…', '/pages/scripts')}
${card('🖥️', 'Simulateur complet', 'Bureau virtuel : Windows/AD/Hyper-V, cmd &amp; PowerShell, console routeur.', '/pages/simulateur-complet', 'Nouveau')}
${card('🩺', 'Dépannage', 'Méthode couche par couche (OSI), diagnostics et corrections.', '/pages/depannage')}
${card('📖', 'Glossaire', 'Tous les acronymes et définitions du métier, en un coup d’œil.', '/glossaire')}
${card('🗓️', 'Planning', 'Le calendrier de la formation et les séances.', '/planning')}
</div>`;

const DOMAINES = `<div class="pt-sec"><h2>🧭 Domaines couverts</h2><p class="sub">Ce que tu trouveras dans les cours.</p></div>
<div class="pt-doms">
${dom('🔧', 'Hardware', '/pages/cours')}
${dom('💾', 'Windows &amp; AD', '/pages/cours')}
${dom('🌐', 'Réseau', '/pages/cours')}
${dom('📟', 'Cisco / Packet Tracer', '/pages/cours')}
${dom('🐧', 'Linux', '/pages/cours')}
${dom('🛠️', 'Maintenance &amp; support', '/pages/cours')}
${dom('🇬🇧', 'Anglais pro', '/pages/cours')}
${dom('💡', 'Astuces', '/pages/cours')}
</div>`;

const AGENDA = `<div class="pt-sec"><h2>📅 Agenda de la formation</h2><p class="sub">Échéances, rendus et séances à venir.</p></div>
<div class="pb-dynamic" data-block="events" data-count="8" data-title=""></div>`;

const PLANNING = `<div class="pt-sec"><h2>🗂️ Planning</h2></div>
<div class="pb-dynamic" data-block="planning" data-slug=""></div>`;

const NOTE = `<p class="pt-note">Ce site reprend la <strong>prise de notes de Van Jean NGUYEN</strong> pendant la formation<br>Technicien Supérieur Systèmes et Réseaux (TSSR).</p>`;

const blocks: PageBlock[] = [
  html(STYLE + HERO),
  html(ACCES),
  html(DOMAINES),
  html(AGENDA),
  html(PLANNING),
  html(NOTE),
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
  const cur = existing.find(e => e.slug === 'accueil');
  const body = JSON.stringify({ title: 'Accueil', slug: 'accueil', excerpt: 'Portail de révision TSSR : cours, procédures, exercices, outils interactifs et simulateur.', content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1 });
  const res = cur
    ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body })
    : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log('PAGE accueil', res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());
  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

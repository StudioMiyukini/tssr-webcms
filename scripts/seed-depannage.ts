/* Section « Dépannage » : base de connaissances des problèmes rencontrés en TP / Réalisation,
   au format symptôme → contexte → cause → solution. Data-driven : pour ajouter un cas,
   ajoute une entrée dans TIPS et relance le script.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-depannage.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const SLUG = 'depannage';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);

// ===================================================================================
// LES CAS DE DÉPANNAGE — ajoute une entrée ici puis relance le script.
// ===================================================================================
type Tip = { id: string; icon: string; title: string; tags: string[]; contexte: string; symptome: string; cause: string; solution: string };
const TIPS: Tip[] = [
  {
    id: 'dhcp-basculement-partenaire',
    icon: '📶',
    title: 'DHCP — Erreur lors de la validation du serveur partenaire (basculement)',
    tags: ['DHCP', 'Active Directory', 'Basculement'],
    contexte: 'Configuration d’un <strong>basculement DHCP</strong> (failover) : on indique le serveur partenaire (ex. <code>srv-ad</code>) puis <em>Suivant</em>.',
    symptome: 'Une croix rouge apparaît avec le message « <strong>Erreur rencontrée lors de la validation du serveur partenaire</strong> ». Impossible de continuer l’assistant.',
    cause: 'Le serveur DHCP <strong>n’est pas membre du domaine Active Directory cible</strong>. Le basculement — comme l’autorisation DHCP — exige que le serveur soit <strong>joint au bon domaine AD</strong>.',
    solution: 'Joindre le serveur DHCP au domaine AD cible : <code>sysdm.cpl</code> → <em>Modifier…</em> → <strong>Membre d’un domaine</strong> → saisir <code>domaine.local</code> → redémarrer. Se reconnecter avec un <strong>compte du domaine</strong>, vérifier que le DHCP est <strong>autorisé dans l’AD</strong> (console DHCP → clic droit sur le serveur → <em>Autoriser</em>), puis relancer l’assistant de basculement.',
  },
];

// ===================================================================================
// RENDU
// ===================================================================================
const style = `<style>
.dep-card{border:1px solid var(--border);border-left:4px solid #dc2626;border-radius:12px;background:var(--surface);padding:14px 16px;margin:12px 0;scroll-margin-top:80px}
.dep-head{display:flex;align-items:center;gap:10px}
.dep-ico{font-size:22px}
.dep-title{font-weight:800;font-size:16px}
.dep-tags{margin:6px 0 10px}
.dep-tag{display:inline-block;font-size:11px;font-weight:700;color:var(--text-muted);background:var(--surface-2);border:1px solid var(--border);border-radius:999px;padding:2px 10px;margin:3px 5px 0 0}
.dep-row{margin:8px 0;line-height:1.6;font-size:14px}
.dep-row .dep-k{display:inline-block;font-weight:800;font-size:11.5px;letter-spacing:.5px;text-transform:uppercase;padding:1px 8px;border-radius:6px;margin-right:6px}
.dep-symp .dep-k{background:rgba(220,38,38,.12);color:#dc2626}
.dep-ctx .dep-k{background:var(--surface-2);color:var(--text-muted)}
.dep-cause .dep-k{background:rgba(217,119,6,.12);color:#b45309}
.dep-sol .dep-k{background:rgba(22,163,74,.12);color:#15803d}
.dep-sol{background:rgba(22,163,74,.05);border-radius:8px;padding:8px 10px}
.dep-code{font-family:ui-monospace,'Space Mono',monospace}
</style>`;

function card(t: Tip): string {
  return `<div class="dep-card" id="dep-${t.id}">`
    + `<div class="dep-head"><span class="dep-ico">${t.icon}</span><span class="dep-title">${t.title}</span></div>`
    + `<div class="dep-tags">${t.tags.map(x => `<span class="dep-tag">${x}</span>`).join('')}</div>`
    + `<div class="dep-row dep-ctx"><span class="dep-k">Contexte</span>${t.contexte}</div>`
    + `<div class="dep-row dep-symp"><span class="dep-k">❌ Symptôme</span>${t.symptome}</div>`
    + `<div class="dep-row dep-cause"><span class="dep-k">🔍 Cause</span>${t.cause}</div>`
    + `<div class="dep-row dep-sol"><span class="dep-k">✅ Solution</span>${t.solution}</div>`
    + `</div>`;
}

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'TSSR · Base de connaissances', title: 'Dépannage', subtitle: 'Les problèmes rencontrés en TP et leur résolution — pour ne pas rester bloqué deux fois sur la même erreur.' }),
  block('html', { html: `<p class="meta">${TIPS.length} cas documenté(s). Format : contexte → symptôme → cause → solution. Utilise la recherche du site (🔍) pour retrouver un message d’erreur.</p>` }),
  block('html', { html: style + TIPS.map(card).join('') }),
];

const PAGE = {
  slug: SLUG,
  title: 'Dépannage',
  excerpt: 'Base de connaissances des problèmes rencontrés en TP/Réalisation et leur résolution (symptôme, cause, solution).',
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

  // Entrée de menu « Dépannage »
  const menus = await (await fetch(`${BASE}/api/admin/menus`, { headers: { Cookie: cookie } })).json() as Array<{ id: number; label: string; url: string }>;
  if (!menus.some(m => m.url === '/pages/depannage' || m.label === 'Dépannage')) {
    const r = await fetch(`${BASE}/api/admin/menus`, { method: 'POST', headers: h, body: JSON.stringify({ label: 'Dépannage', url: '/pages/depannage', sort_order: 4 }) });
    console.log('MENU Dépannage', r.status, r.ok ? '(ajouté)' : await r.text());
  } else console.log('MENU Dépannage déjà présent');

  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

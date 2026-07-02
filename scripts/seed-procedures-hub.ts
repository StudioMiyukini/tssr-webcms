/* Section « Procédures » : entrée de menu + page annuaire (cartes horizontales, pagination 20/page)
   listant les procédures pas-à-pas. Les procédures ne sont plus dans le hub « Cours ».
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-procedures-hub.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);

type Proc = { slug: string; icon: string; title: string; desc: string; tags: string[] };
const PROCEDURES: Proc[] = [
  { slug: 'procedure-vm-hyperv', icon: '🖥️', title: 'Créer & configurer une VM (ISO) sur Hyper-V', desc: 'De la création de la VM au début du TP : OS, nom, IP fixe, pare-feu.', tags: ['Hyper-V', 'Réseau'] },
  { slug: 'procedure-installation-active-directory', icon: '🏢', title: 'Installer & configurer Active Directory', desc: 'De la VM vierge au client intégré au domaine : procédure complète.', tags: ['Active Directory'] },
  { slug: 'procedure-agdlp', icon: '🔐', title: 'Mettre en place AGDLP', desc: 'Attribuer les droits proprement : Account → Global → Domain Local → Permission.', tags: ['Active Directory', 'Droits'] },
];

const PER_PAGE = 20;
function chunk<T>(arr: T[], n: number): T[][] { const out: T[][] = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; }
function pill(t: string) { return `<span style="display:inline-block;font-size:10.5px;font-weight:600;color:var(--text-muted);background:var(--surface-3);border:1px solid var(--border);border-radius:999px;padding:1px 9px;margin:4px 4px 0 0">${t}</span>`; }
function card(p: Proc) {
  return `<a class="dir-card" href="/pages/${p.slug}"><div class="dc-ico">${p.icon}</div>`
    + `<div class="dc-body"><div class="dc-title">${p.title}</div><div class="dc-desc meta">${p.desc}</div><div>${p.tags.map(pill).join('')}</div></div>`
    + `<div class="dc-go">Voir →</div></a>`;
}
function buildDirectory(items: Proc[]): string {
  const pages = chunk(items, PER_PAGE);
  const radios = pages.map((_, i) => `<input class="dp-radio" type="radio" name="dp" id="dp-${i + 1}"${i === 0 ? ' checked' : ''}>`).join('');
  let css = '.dir{position:relative}'
    + '.dir input.dp-radio{position:absolute;width:0;height:0;opacity:0;pointer-events:none}'
    + '.dir .dp-page{display:none}'
    + '.dir-card{display:flex;gap:14px;align-items:center;padding:14px 16px;border:1px solid var(--border);border-radius:12px;background:var(--surface);text-decoration:none;margin:10px 0;transition:border-color .15s,transform .15s}'
    + '.dir-card:hover{border-color:var(--accent);transform:translateY(-1px)}'
    + '.dir-card .dc-ico{font-size:30px;line-height:1}'
    + '.dir-card .dc-body{flex:1;min-width:0}'
    + '.dir-card .dc-title{font-weight:700;font-size:15px;color:var(--text)}'
    + '.dir-card .dc-desc{font-size:13px;margin-top:2px}'
    + '.dir-card .dc-go{color:var(--accent);font-weight:700;white-space:nowrap}'
    + '.dir .dp-pager{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:14px}'
    + '.dir .dp-pager label{cursor:pointer;border:1px solid var(--border);border-radius:8px;padding:4px 11px;font-size:13px;font-weight:600;color:var(--text-soft)}';
  pages.forEach((_, i) => { css += `#dp-${i + 1}:checked~.dp-pages .dp-page-${i + 1}{display:block}`; });
  pages.forEach((_, i) => { css += `#dp-${i + 1}:checked~.dp-pager label[for="dp-${i + 1}"]{background:var(--accent);color:#fff;border-color:var(--accent)}`; });
  const body = `<div class="dp-pages">${pages.map((pg, i) => `<div class="dp-page dp-page-${i + 1}">${pg.map(card).join('')}</div>`).join('')}</div>`;
  const pager = pages.length > 1 ? `<div class="dp-pager">${pages.map((_, i) => `<label for="dp-${i + 1}">${i + 1}</label>`).join('')}</div>` : '';
  return `<div class="dir"><style>${css}</style>${radios}${body}${pager}</div>`;
}

const dirBlocks: PageBlock[] = [
  block('hero', { eyebrow: 'TSSR', title: 'Procédures', subtitle: 'Modes opératoires pas-à-pas, prêts à suivre en TP ou en production.' }),
  block('html', { html: `<p class="meta">${PROCEDURES.length} procédure(s) · affichées par pages de ${PER_PAGE}. Clique sur une carte pour ouvrir la procédure.</p>` }),
  block('html', { html: buildDirectory(PROCEDURES) }),
];

// ===================================================================================
// EXÉCUTION
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

  const cur = existing.find(e => e.slug === 'procedures');
  const body = JSON.stringify({ title: 'Procédures', slug: 'procedures', excerpt: 'Annuaire des procédures pas-à-pas (Hyper-V, Active Directory…).', content: renderPageBlocksToHtml(dirBlocks), builder_json: serializePageBlocks(dirBlocks), published: 1 });
  const res = cur
    ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body })
    : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log('PAGE procedures', res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());

  // Entrée de menu « Procédures »
  const menus = await (await fetch(`${BASE}/api/admin/menus`, { headers: { Cookie: cookie } })).json() as Array<{ id: number; label: string; url: string }>;
  if (!menus.some(m => m.url === '/pages/procedures' || m.label === 'Procédures')) {
    const r = await fetch(`${BASE}/api/admin/menus`, { method: 'POST', headers: h, body: JSON.stringify({ label: 'Procédures', url: '/pages/procedures', sort_order: 3 }) });
    console.log('MENU Procédures', r.status, r.ok ? '(ajouté)' : await r.text());
  } else console.log('MENU Procédures déjà présent');

  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

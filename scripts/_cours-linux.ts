/* Fabrique commune aux cours Linux.
   Les scripts de contenu inlinent d'ordinaire ces quelques aides. À cinq pages
   écrites d'un bloc, la même feuille de style recopiée cinq fois aurait dérivé
   dès la première retouche — c'est la duplication qu'on passe le reste du dépôt
   à supprimer. */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

export const BASE = process.env.BASE || 'https://tssr.miyukini.com';
export const PW = process.env.ADMIN_PW || 'changeme';

export const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) =>
  Object.assign(makePageBlock(type), patch);

export const note = (cls: string, title: string, html: string) =>
  block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Un bloc de commandes shell. */
export const sh = (t: string) => block('html', { html: `<div class="lx-cmd">${esc(t)}</div>` });
/** Un schéma en caractères, dont les alignements comptent. */
export const flow = (t: string) => block('html', { html: `<div class="lx-flow">${esc(t)}</div>` });
/** Un tableau simple : en-têtes, puis lignes. */
export const table = (head: string[], rows: string[][]) => block('html', {
  html: `<table class="lx-t"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead>`
    + `<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`,
});

export const styleLinux = block('html', {
  html: '<style>'
    + ".lx-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.6}"
    + '.lx-t{border-collapse:collapse;width:100%;font-size:13px;margin:8px 0}'
    + '.lx-t th,.lx-t td{border:1px solid var(--border);padding:7px 10px;text-align:left;vertical-align:top}'
    + '.lx-t th{background:var(--surface-2)}'
    + '.lx-t code{font-size:12px}'
    + ".lx-flow{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:12px;margin:8px 0;white-space:pre;overflow-x:auto;font-size:12px;line-height:1.5}"
    + '</style>',
});

/** Le pied de page commun : les cours Linux se citent entre eux. */
export const liens = (sauf: string) => {
  const tous: [string, string][] = [
    ['/pages/linux-bases', 'Linux : les bases'],
    ['/pages/linux-redhat', 'Rocky Linux et la famille Red Hat'],
    ['/pages/linux-commandes-base', 'Commandes de base'],
    ['/pages/linux-paquets-essentiels', 'Les paquets essentiels'],
    ['/pages/linux-droits', 'Utilisateurs, droits et sudo'],
    ['/pages/linux-acl', 'Les ACL'],
    ['/pages/linux-reseau', 'Le réseau sous Linux'],
    ['/pages/linux-disques', 'Disques, partitions et espace'],
    ['/pages/linux-archivage', 'Archivage et compression'],
    ['/pages/linux-systemd', 'systemd : services et journaux'],
    ['/pages/linux-bash', 'Scripts Bash'],
    ['/pages/linux-ssh', 'SSH serveur'],
    ['/pages/linux-apache', 'Apache'],
    ['/pages/linux-samba', 'Samba'],
    ['/pages/repertoire-commandes', 'Répertoire des commandes'],
  ];
  const l = tous.filter(([h]) => h !== sauf).map(([h, t]) => `<a href="${h}">${t}</a>`).join(' · ');
  return note('green', '🔗 Les autres cours Linux', `<p>${l}</p>`);
};

function cookieFrom(res: Response): string {
  const sc = (res.headers as { getSetCookie?: () => string[] }).getSetCookie?.();
  return (sc && sc.length ? sc : [res.headers.get('set-cookie') || '']).map(c => c.split(';')[0]).filter(Boolean).join('; ');
}

/** Publie une page : crée si elle manque, met à jour sinon. */
export async function publier(page: { slug: string; title: string; excerpt: string }, blocks: PageBlock[]) {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: PW }),
  });
  if (!login.ok) throw new Error(`login ${login.status}`);
  const cookie = cookieFrom(login);
  const h = { 'Content-Type': 'application/json', Cookie: cookie };
  const existing = await (await fetch(`${BASE}/api/admin/pages`, { headers: { Cookie: cookie } })).json() as Array<{ id: number; slug: string }>;
  const cur = existing.find(e => e.slug === page.slug);
  const body = JSON.stringify({
    title: page.title, slug: page.slug, excerpt: page.excerpt,
    content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1,
  });
  const res = cur
    ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body })
    : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log(`PAGE ${page.slug}`, res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());
  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}

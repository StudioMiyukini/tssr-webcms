/* Procédure « Mettre en place AGDLP » : la stratégie Microsoft d'attribution des droits
   (Account → Global → Domain Local → Permission). Principe, schéma, convention de nommage,
   étapes, exemple concret (dossier Compta) + PowerShell. Catégorie Procédures › Active Directory.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-procedure-agdlp.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pre = (code: string) => `<div style="margin:6px 0 12px"><div class="meta" style="font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">PowerShell (sur le contrôleur de domaine)</div><pre style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;overflow-x:auto;font-size:12.5px;line-height:1.55;margin:0"><code>${esc(code)}</code></pre></div>`;

// ===================================================================================
// Schéma AGDLP
// ===================================================================================
const C = { obj: '#16a34a', net: '#2563eb', ou: '#d97706', purple: '#7c3aed', grey: '#64748b', slate: '#475569' };
const wrap = (w: number, h: number, inner: string) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="max-width:${w}px;width:100%;height:auto;margin:8px 0 14px;font-family:system-ui,sans-serif">${inner}</svg>`;
const svgAgdlp = wrap(660, 150, (() => {
  const cells: Array<[string, string, string, string]> = [
    ['A', 'Comptes', 'utilisateurs / ordinateurs', C.obj],
    ['G', 'Groupe Global', 'regroupe par métier / rôle', C.net],
    ['DL', 'Groupe Domaine Local', 'un par ressource + niveau de droit', C.ou],
    ['P', 'Permission', 'accordée sur la ressource (NTFS)', C.purple],
  ];
  const W = 148, gap = 16, y = 34, h = 66; let x = 8, s = '';
  s += `<text x="330" y="20" text-anchor="middle" font-size="12" fill="${C.slate}" font-weight="bold">La chaine AGDLP</text>`;
  cells.forEach(([big, t1, t2, col], i) => {
    s += `<rect x="${x}" y="${y}" width="${W}" height="${h}" rx="9" fill="${col}" fill-opacity="0.12" stroke="${col}" stroke-width="1.7"/>`;
    s += `<text x="${x + 16}" y="${y + 30}" font-size="20" fill="${col}" font-weight="bold">${big}</text>`;
    s += `<text x="${x + 40}" y="${y + 26}" font-size="12.5" fill="${col}" font-weight="bold">${t1}</text>`;
    s += `<text x="${x + W / 2}" y="${y + 50}" text-anchor="middle" font-size="10" fill="${C.slate}">${t2}</text>`;
    if (i < cells.length - 1) { const ax = x + W; s += `<path d="M${ax + 2} ${y + h / 2} l${gap - 5} 0 m-6 -4 l6 4 l-6 4" stroke="${C.grey}" stroke-width="2" fill="none"/>`; }
    x += W + gap;
  });
  s += `<text x="330" y="138" text-anchor="middle" font-size="10.5" fill="${C.grey}">On place les comptes dans un groupe Global, ce Global dans un Domaine Local, et la permission sur le Domaine Local.</text>`;
  return s;
})());

const th = (c: string[]) => `<tr style="background:var(--surface-2)">${c.map(x => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${x}</th>`).join('')}</tr>`;

// ===================================================================================
// PAGE
// ===================================================================================
const SLUG = 'procedure-agdlp';
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Procédure · Active Directory', title: 'Mettre en place AGDLP', subtitle: 'La stratégie Microsoft pour attribuer les droits proprement et à grande échelle.' }),
  block('html', { html: '<p><strong>AGDLP</strong> est la <strong>bonne pratique Microsoft</strong> pour organiser les permissions dans un domaine. Elle évite le piège classique — donner des droits directement aux utilisateurs — en passant par des <strong>groupes imbriqués</strong>. On retient la chaîne : <strong>A</strong>ccount → <strong>G</strong>lobal → <strong>D</strong>omain <strong>L</strong>ocal → <strong>P</strong>ermission.</p>' }),
  block('html', { html: svgAgdlp }),
  note('blue', '🧰 Prérequis & cours liés', '<p>Un domaine en place (<a href="/pages/procedure-installation-active-directory">procédure AD</a>), les notions de groupes (<a href="/pages/vocabulaire-active-directory">vocabulaire AD</a> — portées Global / Domaine local / Universel) et les <a href="/pages/permissions-partage-ntfs">permissions Partage & NTFS</a>. Pour créer les groupes en masse : <a href="/pages/constructeur-ad">constructeur AD</a>.</p>'),

  block('heading', { level: 2, text: '❓ Pourquoi AGDLP ?' }),
  block('html', { html: '<p>Attribuer un droit <strong>directement à un utilisateur</strong> (ou à un groupe global sur chaque dossier) devient vite ingérable : à chaque arrivée/départ ou nouveau dossier, il faut tout reprendre. AGDLP <strong>sépare deux logiques</strong> :</p><ul><li>le <strong>« qui »</strong> (les rôles métier) → <strong>groupes Globaux</strong> ;</li><li>le <strong>« sur quoi + quel droit »</strong> (les ressources) → <strong>groupes Domaine Local</strong>.</li></ul><p>Résultat : ajouter une personne = la mettre dans le bon groupe Global ; ouvrir un accès = mettre un Global dans le bon Domaine Local. <strong>Les permissions ne bougent plus.</strong></p>' }),

  block('heading', { level: 2, text: '🏷️ Convention de nommage' }),
  block('html', { html: `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:560px;font-size:13.5px"><thead>${th(['Type', 'Rôle', 'Exemple de nom'])}</thead><tbody>` +
    [
      ['Groupe <b>Global</b> (G)', 'Regroupe des comptes par <b>métier / service</b>', '<code>G_Comptables</code>, <code>G_Direction</code>'],
      ['Groupe <b>Domaine Local</b> (DL)', 'Un par <b>ressource + niveau de droit</b>', '<code>DL_Compta_Lecture</code>, <code>DL_Compta_Modification</code>'],
    ].map(r => `<tr><td style="padding:8px 10px;border:1px solid var(--border)">${r[0]}</td><td style="padding:8px 10px;border:1px solid var(--border)">${r[1]}</td><td style="padding:8px 10px;border:1px solid var(--border);font-family:ui-monospace,monospace">${r[2]}</td></tr>`).join('') +
    `</tbody></table></div>` }),
  note('yellow', '💡 Un DL par droit', '<p>Crée un groupe Domaine Local <strong>par niveau d’accès</strong> sur une ressource : typiquement un <code>_Lecture</code> et un <code>_Modification</code>. Ainsi, donner « lecture seule » ou « modification » à un service = simple appartenance de groupe.</p>'),

  block('heading', { level: 2, text: '🪜 Les étapes' }),
  block('html', { html: '<p>On suit la chaîne dans l’ordre <strong>A → G → DL → P</strong> :</p>' }),
  block('list', { listItems: [
    'A — Les comptes utilisateurs existent (dans leurs UO).',
    'G — Créer les groupes GLOBAUX par métier et y placer les comptes (ex. G_Comptables ← comptes des comptables).',
    'DL — Créer les groupes DOMAINE LOCAL par ressource et niveau de droit (ex. DL_Compta_Lecture, DL_Compta_Modification).',
    'Imbrication — Mettre chaque groupe Global dans le groupe Domaine Local adéquat (le Global devient MEMBRE du DL).',
    'P — Attribuer la permission (NTFS) au groupe DOMAINE LOCAL sur la ressource — jamais au Global ni au compte.',
  ] }),

  block('heading', { level: 2, text: '🧪 Exemple concret : le dossier « Compta »' }),
  block('html', { html: '<p>Objectif : les <strong>comptables modifient</strong> le dossier <code>\\\\SRV\\Compta</code>, la <strong>direction le lit</strong> seulement.</p>' }),
  block('html', { html: `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:620px;font-size:13.5px"><thead>${th(['Groupe Domaine Local', 'Permission NTFS sur \\\\SRV\\Compta', 'Membres (groupes Globaux)'])}</thead><tbody>` +
    [
      ['<code>DL_Compta_Modification</code>', 'Modification', '<code>G_Comptables</code>'],
      ['<code>DL_Compta_Lecture</code>', 'Lecture', '<code>G_Direction</code>'],
    ].map(r => `<tr><td style="padding:8px 10px;border:1px solid var(--border);font-family:ui-monospace,monospace">${r[0]}</td><td style="padding:8px 10px;border:1px solid var(--border);font-weight:600">${r[1]}</td><td style="padding:8px 10px;border:1px solid var(--border);font-family:ui-monospace,monospace">${r[2]}</td></tr>`).join('') +
    `</tbody></table></div>` }),

  block('html', { html: '<p>On applique exactement cette logique dans le <strong>TP serveur de fichiers</strong> : le serveur <code>SRV-FILE</code> héberge <code>E:\\Partages\\</code> avec un dossier par service, sur le domaine <code>miyukini.lan</code>. Les besoins d’accès :</p>' }),
  block('html', { html: `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:520px;font-size:13.5px"><thead>${th(['Service', 'Peut modifier', 'Lecture seule'])}</thead><tbody>` +
    [
      ['Comptabilité', 'Comptables', 'Direction'],
      ['Commercial', 'Commerciaux', 'Direction'],
      ['Direction', 'Direction', '—'],
    ].map(r => `<tr>${r.map((c, i) => `<td style="padding:8px 10px;border:1px solid var(--border)${i === 0 ? ';font-weight:600' : ''}">${c}</td>`).join('')}</tr>`).join('') +
    `</tbody></table></div>` }),
  block('html', { html: '<p>Traduit en <strong>AGDLP</strong> (un groupe Domaine Local par dossier <strong>et par niveau de droit</strong>) :</p>' }),
  block('html', { html: `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:680px;font-size:13px"><thead>${th(['Dossier (permission NTFS)', 'Groupe Domaine Local', 'Droit', 'Membre (Global)'])}</thead><tbody>` +
    [
      ['E:\\Partages\\Comptabilité', 'DL_Compta_Modification', 'Modifier', 'G_Comptables'],
      ['', 'DL_Compta_Lecture', 'Lecture', 'G_Direction'],
      ['E:\\Partages\\Commercial', 'DL_Commercial_Modification', 'Modifier', 'G_Commerciaux'],
      ['', 'DL_Commercial_Lecture', 'Lecture', 'G_Direction'],
      ['E:\\Partages\\Direction', 'DL_Direction_Modification', 'Modifier', 'G_Direction'],
    ].map(r => `<tr><td style="padding:8px 10px;border:1px solid var(--border);font-family:ui-monospace,monospace">${r[0]}</td><td style="padding:8px 10px;border:1px solid var(--border);font-family:ui-monospace,monospace">${r[1]}</td><td style="padding:8px 10px;border:1px solid var(--border);font-weight:600">${r[2]}</td><td style="padding:8px 10px;border:1px solid var(--border);font-family:ui-monospace,monospace">${r[3]}</td></tr>`).join('') +
    `</tbody></table></div>` }),

  block('heading', { level: 2, text: '🖱️ Pas-à-pas graphique (ADUC + Sécurité) — cas « Comptabilité »' }),
  block('html', { html: '<p>La méthode <strong>graphique</strong> (celle attendue en TP), pour le dossier <code>Comptabilité</code>. On répète ensuite la même logique pour <em>Commercial</em> et <em>Direction</em>.</p>' }),
  block('html', { html: `<style>.agdlp-steps{padding-left:22px;line-height:1.7}.agdlp-steps>li{margin:8px 0}.agdlp-steps code{font-family:ui-monospace,'Space Mono',monospace}</style>
<ol class="agdlp-steps">
  <li><strong>A — Les comptes existent.</strong> Dans <strong>ADUC</strong>, vérifie que <code>jean.nguyen</code>, <code>marie.durand</code> (comptables) et les comptes de la direction sont dans leur UO.</li>
  <li><strong>G — Créer les groupes Globaux.</strong> Clic droit sur l’<strong>OU Groupes</strong> → <em>Nouveau</em> → <em>Groupe</em> → nom <code>G_Comptables</code>, <strong>Étendue : Globale</strong>, Type <strong>Sécurité</strong> → OK. Recommence pour <code>G_Direction</code>.</li>
  <li><strong>G — Y placer les comptes.</strong> Double-clic <code>G_Comptables</code> → onglet <strong>Membres</strong> → <em>Ajouter</em> → <code>jean.nguyen; marie.durand</code> → <em>Vérifier les noms</em> → OK.</li>
  <li><strong>DL — Créer les groupes Domaine Local.</strong> Clic droit OU Groupes → <em>Nouveau</em> → <em>Groupe</em> → <code>DL_Compta_Modification</code>, <strong>Étendue : Domaine local</strong> → OK. Recommence pour <code>DL_Compta_Lecture</code>.</li>
  <li><strong>Imbrication — Global dans Domaine Local.</strong> Double-clic <code>DL_Compta_Modification</code> → <strong>Membres</strong> → <em>Ajouter</em> → <code>G_Comptables</code> → OK. Puis <code>DL_Compta_Lecture</code> → Membres → <code>G_Direction</code>.</li>
  <li><strong>P — Permission NTFS.</strong> Sur <code>SRV-FILE</code> : clic droit <code>E:\\Partages\\Comptabilité</code> → <em>Propriétés</em> → onglet <strong>Sécurité</strong> → <em>Modifier…</em> → <em>Ajouter…</em> → <code>DL_Compta_Modification</code> → <em>Vérifier les noms</em> → OK → cocher <strong>Modifier</strong> → Appliquer.</li>
  <li><strong>P — Ajouter la lecture.</strong> Toujours dans Sécurité → <em>Ajouter…</em> → <code>DL_Compta_Lecture</code> → cocher <strong>Lecture et exécution</strong> → OK.</li>
  <li><strong>Vérifier.</strong> Connecte-toi en tant que <code>jean.nguyen</code> : il crée/modifie dans <code>Comptabilité</code>. En tant qu’un membre de la <strong>Direction</strong> : lecture seule (modification refusée).</li>
</ol>` }),
  note('yellow', '🔗 Côté partage', '<p>Au niveau du <strong>partage réseau</strong> (onglet <em>Partage</em> → <em>Partage avancé</em> → <em>Autorisations</em>), on laisse <code>Utilisateurs authentifiés</code> en <strong>Contrôle total</strong> : c’est le <strong>NTFS qui filtre réellement</strong> (le plus restrictif l’emporte). Voir <a href="/pages/permissions-partage-ntfs">Permissions Partage &amp; NTFS</a>.</p>'),
  note('purple', '📝 En TP', '<p>C’est la <strong>méthode graphique ci-dessus</strong> qui est attendue (ADUC + onglet Sécurité). Le PowerShell ci-dessous est un <strong>bonus</strong> pour aller plus vite, si l’usage en est autorisé.</p>'),

  block('heading', { level: 2, text: '💻 Bonus — le faire en PowerShell (plus rapide)' }),
  block('html', { html: pre(`# G — groupes globaux (par metier) + adhesion des comptes
New-ADGroup -Name 'G_Comptables' -GroupScope Global -GroupCategory Security -Path 'OU=Groupes,DC=miyukini,DC=lan'
New-ADGroup -Name 'G_Direction'  -GroupScope Global -GroupCategory Security -Path 'OU=Groupes,DC=miyukini,DC=lan'
Add-ADGroupMember -Identity 'G_Comptables' -Members 'jean.nguyen','marie.durand'

# DL — groupes domaine local (par ressource + droit)
New-ADGroup -Name 'DL_Compta_Modification' -GroupScope DomainLocal -GroupCategory Security -Path 'OU=Groupes,DC=miyukini,DC=lan'
New-ADGroup -Name 'DL_Compta_Lecture'      -GroupScope DomainLocal -GroupCategory Security -Path 'OU=Groupes,DC=miyukini,DC=lan'

# Imbrication : le Global devient membre du Domaine Local
Add-ADGroupMember -Identity 'DL_Compta_Modification' -Members 'G_Comptables'
Add-ADGroupMember -Identity 'DL_Compta_Lecture'      -Members 'G_Direction'

# P — permission NTFS attribuee AU GROUPE DOMAINE LOCAL sur la ressource
$acl = Get-Acl 'C:\\Partage\\Compta'
$r1 = New-Object System.Security.AccessControl.FileSystemAccessRule('DL_Compta_Modification','Modify','ContainerInherit,ObjectInherit','None','Allow')
$r2 = New-Object System.Security.AccessControl.FileSystemAccessRule('DL_Compta_Lecture','ReadAndExecute','ContainerInherit,ObjectInherit','None','Allow')
$acl.AddAccessRule($r1); $acl.AddAccessRule($r2)
Set-Acl 'C:\\Partage\\Compta' $acl`) }),
  note('blue', '🧱 Ou en graphique', '<p>La permission peut aussi se poser via l’onglet <strong>Sécurité</strong> du dossier (ajouter le groupe <code>DL_…</code> avec le droit voulu). L’essentiel : la permission est <strong>sur le Domaine Local</strong>. L’imbrication de groupes se fait très vite avec le <a href="/pages/constructeur-ad">constructeur AD</a> (champ « membre de »).</p>'),

  block('heading', { level: 2, text: '🌐 Variante AGUDLP (multi-domaines)' }),
  block('html', { html: '<p>Dans une <strong>forêt à plusieurs domaines</strong>, on intercale un groupe <strong>Universel</strong> : <strong>A → G → U → DL → P</strong>. Le groupe Universel regroupe des Globaux de différents domaines, puis entre dans le Domaine Local. Pour un domaine unique, <strong>AGDLP suffit</strong>.</p>' }),

  note('green', '🎯 À retenir', '<p><strong>A</strong>ccounts dans un <strong>G</strong>lobal (par métier), Global dans un <strong>D</strong>omaine <strong>L</strong>ocal (par ressource+droit), <strong>P</strong>ermission sur le Domaine Local. On ne met <strong>jamais</strong> de droit sur un compte ni sur un groupe Global directement. Voir aussi : <a href="/pages/permissions-partage-ntfs">permissions Partage/NTFS</a>, <a href="/pages/vocabulaire-active-directory">vocabulaire AD</a>.</p>'),
];

const PAGE = {
  slug: SLUG,
  title: 'Mettre en place AGDLP',
  excerpt: 'Procédure AGDLP (Account → Global → Domain Local → Permission) : principe, convention de nommage, étapes, exemple concret (dossier Compta) et script PowerShell. La bonne pratique d’attribution des droits en Active Directory.',
};

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

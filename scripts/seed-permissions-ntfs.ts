/* Page de cours « Les permissions : Partage & NTFS » (à partir des TP AD 2/3/4/5).
   Différence Partage vs NTFS, niveaux de droits, cumul (le plus restrictif), héritage,
   bonne pratique (partage unique + sécurité NTFS), mise en place pas-à-pas et Q/R.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-permissions-ntfs.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const accordion = (it: Array<[string, string]>) => block('accordion', { items: it.map(([title, text]) => ({ title, text, href: '' })) });

const C = { net: '#2563eb', dev: '#059669', warn: '#d97706', danger: '#dc2626', grey: '#64748b', slate: '#475569', purple: '#7c3aed', ok: '#16a34a' };
const wrap = (w: number, h: number, inner: string) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="max-width:${w}px;width:100%;height:auto;margin:8px 0 14px;font-family:system-ui,sans-serif">${inner}</svg>`;
const box = (x: number, y: number, w: number, h: number, col: string, t1: string, t2 = '') => {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${col}" fill-opacity="0.12" stroke="${col}" stroke-width="1.7"/>`;
  s += `<text x="${x + w / 2}" y="${y + (t2 ? 22 : h / 2 + 4)}" text-anchor="middle" font-size="12" fill="${col}" font-weight="bold">${t1}</text>`;
  if (t2) s += `<text x="${x + w / 2}" y="${y + 38}" text-anchor="middle" font-size="10" fill="${C.slate}">${t2}</text>`;
  return s;
};
const arrow = (x1: number, y: number, x2: number, col = C.grey) => `<line x1="${x1}" y1="${y}" x2="${x2 - 7}" y2="${y}" stroke="${col}" stroke-width="2"/><path d="M${x2} ${y} l-8 -4 l0 8 z" fill="${col}"/>`;

// Schéma : les deux « filtres » (partage puis NTFS) sur le réseau ; NTFS seul en local
const svgGates = wrap(640, 230,
  box(12, 26, 120, 50, C.purple, '👤 Accès', 'réseau (\\\\serveur)')
  + arrow(132, 51, 190)
  + box(190, 26, 120, 50, C.warn, '🔓 PARTAGE', 'L / M / CT')
  + arrow(310, 51, 366)
  + box(366, 26, 120, 50, C.net, '🔐 NTFS', 'L / LX / LE / M / CT')
  + arrow(486, 51, 542)
  + box(542, 26, 88, 50, C.dev, '📁 Fichiers')
  + box(12, 130, 120, 50, C.slate, '🖥️ Accès', 'local / RDP')
  + `<path d="M132 155 L340 155 L340 82" stroke="#94a3b8" stroke-width="2" fill="none"/><path d="M340 78 l-4 8 l8 0 z" fill="#94a3b8"/>`
  + `<text x="235" y="148" font-size="10" fill="${C.slate}">contourne le partage →</text>`
  + `<text x="320" y="205" text-anchor="middle" font-size="11.5" fill="${C.danger}" font-weight="bold">Sur le réseau : les DEUX filtres s'appliquent → le résultat = le PLUS RESTRICTIF des deux.</text>`
  + `<text x="320" y="222" text-anchor="middle" font-size="11" fill="${C.slate}">En local (ou RDP) : le partage ne s'applique pas, seul le NTFS compte.</text>`);

const th = (cols: string[]) => `<tr style="background:var(--surface-2)">${cols.map(c => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${c}</th>`).join('')}</tr>`;
const tbl = (min: number, head: string[], rows: string) => `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:${min}px;font-size:13.5px"><thead>${th(head)}</thead><tbody>${rows}</tbody></table></div>`;

// ===================================================================================
// PAGE
// ===================================================================================
const SLUG = 'permissions-partage-ntfs';
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Windows Server', title: 'Les permissions : Partage & NTFS', subtitle: 'Deux systèmes de droits qui se combinent pour sécuriser un serveur de fichiers.' }),
  block('html', { html: '<p>Sur un <strong>serveur de fichiers</strong>, l’accès aux dossiers est contrôlé par <strong>deux systèmes de permissions différents</strong> qui se cumulent : les <strong>droits de partage</strong> (côté réseau) et les <strong>droits NTFS</strong> (côté sécurité du système de fichiers). Bien les distinguer — et savoir comment ils se combinent — est essentiel pour donner « le bon accès, à la bonne personne, sur le bon dossier ».</p>' }),
  note('blue', '🧰 Prérequis & contexte', '<p>Ce cours suppose un domaine en place (voir la procédure <a href="/pages/procedure-installation-active-directory">Installer & configurer Active Directory</a>) avec une structure <strong>UO / groupes / utilisateurs</strong> (voir le <a href="/pages/vocabulaire-active-directory">vocabulaire AD</a>). On applique les droits à des <strong>groupes</strong>, jamais à des utilisateurs isolés.</p>'),

  block('heading', { level: 2, text: '🆚 Partage vs NTFS : la différence' }),
  block('html', { html: tbl(640, ['', '🔓 Droits de Partage', '🔐 Droits NTFS'], [
    `<tr><td style="padding:8px 10px;border:1px solid var(--border);font-weight:700">Quand ils s’appliquent</td><td style="padding:8px 10px;border:1px solid var(--border)">Uniquement en <b>accès réseau</b> (\\\\serveur\\partage)</td><td style="padding:8px 10px;border:1px solid var(--border)"><b>Toujours</b> : en local ET en réseau</td></tr>`,
    `<tr><td style="padding:8px 10px;border:1px solid var(--border);font-weight:700">Où on les règle</td><td style="padding:8px 10px;border:1px solid var(--border)">Sur le <b>dossier partagé</b> (onglet Partage)</td><td style="padding:8px 10px;border:1px solid var(--border)">Sur <b>chaque dossier/fichier</b> (onglet Sécurité)</td></tr>`,
    `<tr><td style="padding:8px 10px;border:1px solid var(--border);font-weight:700">Granularité</td><td style="padding:8px 10px;border:1px solid var(--border)"><b>Grossière</b> : Lecture / Modification / Contrôle total</td><td style="padding:8px 10px;border:1px solid var(--border)"><b>Fine</b> : L, Lecture+exécution, +écriture, Modification, Contrôle total (+ droits avancés)</td></tr>`,
    `<tr><td style="padding:8px 10px;border:1px solid var(--border);font-weight:700">Héritage</td><td style="padding:8px 10px;border:1px solid var(--border)">Non (par point de partage)</td><td style="padding:8px 10px;border:1px solid var(--border)"><b>Oui</b> : un dossier hérite des droits du parent</td></tr>`,
    `<tr><td style="padding:8px 10px;border:1px solid var(--border);font-weight:700">Refuser</td><td style="padding:8px 10px;border:1px solid var(--border)">Possible</td><td style="padding:8px 10px;border:1px solid var(--border)">Possible — et <b>« Refuser » l’emporte</b> sur « Autoriser »</td></tr>`,
  ].join('')) }),

  block('heading', { level: 2, text: '⚖️ Comment ils se combinent' }),
  block('html', { html: '<p>C’est <strong>le point clé</strong>. Quand un utilisateur accède à un dossier <strong>par le réseau</strong>, Windows applique <strong>les deux filtres</strong> — le partage <em>puis</em> le NTFS — et retient <strong>le plus restrictif des deux</strong>.</p>' }),
  block('html', { html: svgGates }),
  block('html', { html: '<p>Exemple : partage en <strong>Modification</strong> mais NTFS en <strong>Lecture</strong> → l’utilisateur ne pourra que <strong>lire</strong> (le plus restrictif gagne). À l’inverse, en <strong>local</strong> (ou via bureau à distance), le partage ne compte pas : seul le <strong>NTFS</strong> décide.</p>' }),
  note('yellow', '📌 Les 2 règles à retenir', '<p>1. <strong>Accès réseau</strong> = <em>min(</em>droit de partage, droit NTFS<em>)</em> → le <strong>plus restrictif</strong>.<br>2. Au sein d’un même type, un <strong>« Refuser »</strong> l’emporte toujours sur un « Autoriser ».</p>'),

  block('heading', { level: 2, text: '📊 Les niveaux de droits' }),
  block('html', { html: '<p><strong>Droits de partage</strong> — seulement 3 niveaux :</p>' }),
  block('html', { html: tbl(420, ['Abrév.', 'Niveau', 'Permet'], [
    ['L', 'Lecture', 'Voir et ouvrir les fichiers'],
    ['M', 'Modification', 'Lecture + créer/modifier/supprimer'],
    ['CT', 'Contrôle total', 'Modification + gérer les permissions'],
  ].map(r => `<tr><td style="padding:7px 10px;border:1px solid var(--border);font-weight:700;font-family:ui-monospace,monospace">${r[0]}</td><td style="padding:7px 10px;border:1px solid var(--border);font-weight:600">${r[1]}</td><td style="padding:7px 10px;border:1px solid var(--border)">${r[2]}</td></tr>`).join('')) }),
  block('html', { html: '<p><strong>Droits NTFS</strong> — plus fins (abréviations du TP) :</p>' }),
  block('html', { html: tbl(460, ['Abrév.', 'Niveau', 'Permet'], [
    ['L', 'Lecture', 'Lire le contenu d’un fichier/dossier'],
    ['LX', 'Lecture et exécution', 'Lire + <b>traverser</b> les dossiers (indispensable sur les dossiers parents)'],
    ['LE', 'Lecture et écriture', 'Lire + créer/écrire'],
    ['M', 'Modification', 'Lecture/écriture/exécution + <b>supprimer</b>'],
    ['CT', 'Contrôle total', 'Tout + gérer permissions et propriété'],
  ].map(r => `<tr><td style="padding:7px 10px;border:1px solid var(--border);font-weight:700;font-family:ui-monospace,monospace">${r[0]}</td><td style="padding:7px 10px;border:1px solid var(--border);font-weight:600">${r[1]}</td><td style="padding:7px 10px;border:1px solid var(--border)">${r[2]}</td></tr>`).join('')) }),
  note('green', '💡 Le rôle de « LX » (traverser)', '<p>Pour qu’un utilisateur atteigne un dossier profond, il doit pouvoir <strong>traverser</strong> tous les dossiers parents. On met donc souvent <strong>LX (Lecture et exécution)</strong> sur les dossiers du chemin, et le vrai droit (LE, M…) <strong>seulement sur le dossier cible</strong>. Sans LX sur un parent, l’accès au sous-dossier échoue.</p>'),

  block('heading', { level: 2, text: '⭐ La bonne pratique : un seul partage + sécurité NTFS' }),
  block('html', { html: '<p>Plutôt que de dupliquer les droits sur le partage <em>et</em> sur le NTFS, la méthode <strong>simple et efficace</strong> est :</p>' }),
  block('list', { listItems: [
    'Créer UN SEUL partage sur le dossier racine (ex. « Partage »), largement ouvert : le groupe de tous les utilisateurs (ex. G_Toutes_Formations) en Modification, et on retire « Tout le monde ».',
    'Toute l’arborescence sous ce dossier devient alors accessible par le réseau — simple, fonctionnel, rapide.',
    'Gérer ensuite TOUTE la sécurité (qui accède à quoi et avec quels droits) uniquement via les droits NTFS, dossier par dossier, sur des groupes.',
  ] }),
  note('blue', '🎯 Pourquoi c’est mieux', '<p>Le partage « large » ne fait qu’<strong>ouvrir la porte réseau</strong> ; ce sont les <strong>droits NTFS</strong> qui font le vrai contrôle. On ne maintient donc <strong>qu’un seul jeu de droits</strong> (le NTFS) au lieu de deux quasi identiques. Sur des <strong>groupes</strong> (stratégie AGDLP — voir <a href="/pages/vocabulaire-active-directory">vocabulaire AD</a>), c’est encore plus maintenable.</p>'),

  block('heading', { level: 2, text: '🧬 L’héritage NTFS' }),
  block('html', { html: '<p>Par défaut, un dossier <strong>hérite</strong> des droits de son parent. Pour poser des droits précis sur une branche, on <strong>désactive l’héritage</strong> :</p>' }),
  block('list', { listItems: [
    'Propriétés du dossier → Sécurité → Avancé → « Désactiver l’héritage ».',
    'Choisir « Convertir les autorisations héritées en autorisations explicites » (on garde les droits actuels, mais on peut maintenant les modifier).',
    'Retirer les groupes génériques « Utilisateurs » et « Utilisateurs authentifiés » pour ne laisser QUE les groupes voulus.',
  ] }),

  block('heading', { level: 2, text: '🛠️ Mise en place pas-à-pas' }),
  accordion([
    ['1 · Créer le partage', '<p>Sur le dossier <code>Partage</code> : clic droit → <strong>Propriétés → Partage → Partage avancé</strong> → cocher « Partager ce dossier ». Dans <strong>Autorisations</strong> : <strong>supprimer « Tout le monde »</strong>, ajouter le groupe <strong>G_Toutes_Formations</strong> en <strong>Modification</strong>. Un seul partage suffit pour toute l’arborescence.</p>'],
    ['2 · Poser les droits NTFS', '<p>Onglet <strong>Sécurité</strong> de chaque dossier. <strong>Désactivez l’héritage</strong> (convertir en explicite), retirez « Utilisateurs » / « Utilisateurs authentifiés », puis attribuez à chaque <strong>groupe</strong> le droit voulu selon votre tableau de réflexion : <strong>LX</strong> pour traverser les parents, <strong>LE / M</strong> sur les dossiers cibles.</p>'],
    ['3 · Tester depuis le client', '<p>Sur le PC client (compte du domaine), ouvrez l’Explorateur et tapez <code>\\\\NomDuServeur</code> dans la barre d’adresse : le poste étant dans le domaine, il se connecte avec votre session. Ouvrez le partage et <strong>testez chaque droit</strong> avec <strong>plusieurs utilisateurs</strong> : qui peut lire, écrire/modifier, ou n’a pas accès. Vérifiez que ça correspond aux droits décidés.</p>'],
    ['4 · Simplifier l’accès (lecteur réseau)', '<p>Pour ne pas retaper <code>\\\\serveur</code> à chaque fois : <strong>connecter un lecteur réseau</strong> (Ce PC → Connecter un lecteur réseau → <code>\\\\serveur\\Partage</code>), ou le déployer automatiquement par <strong>GPO / script d’ouverture de session</strong>.</p>'],
  ]),

  block('heading', { level: 2, text: '❓ Questions / réponses' }),
  accordion([
    ['Quelle différence entre droits NTFS et droits de partage ?', '<p>Le <strong>partage</strong> ne s’applique qu’en <strong>accès réseau</strong>, il est <strong>grossier</strong> (3 niveaux) et se pose sur le point de partage. Le <strong>NTFS</strong> s’applique <strong>toujours</strong> (local + réseau), il est <strong>fin</strong> (nombreux niveaux + droits avancés), se pose par dossier/fichier, gère l’<strong>héritage</strong> et le <strong>Refuser</strong>.</p>'],
    ['Dans quel cas utilise-t-on les droits de partage ?', '<p>Uniquement pour <strong>rendre un dossier accessible via le réseau</strong> (protocole SMB). Sans partage, aucun accès distant possible, quels que soient les droits NTFS. Le partage « ouvre la porte » ; le NTFS décide ensuite.</p>'],
    ['Est-il nécessaire de partager chaque dossier ?', '<p><strong>Non.</strong> Un <strong>seul partage sur le dossier racine</strong> rend toute l’arborescence en dessous accessible par le réseau. On affine ensuite par le NTFS. Multiplier les partages complique la gestion sans bénéfice.</p>'],
    ['Comment gérer les deux plus simplement, sans tout dupliquer ?', '<p><strong>Un partage unique large</strong> (Modification à tous, ou Contrôle total) à la racine + <strong>toute la sécurité en NTFS</strong>, sur des <strong>groupes</strong>. On ne maintient qu’un seul jeu de droits (NTFS) au lieu de reproduire quasi les mêmes deux fois.</p>'],
    ['Quel droit est prioritaire ?', '<p>En accès réseau, c’est <strong>le plus restrictif</strong> entre le partage et le NTFS qui s’applique. Et dans tous les cas, un <strong>« Refuser » l’emporte sur un « Autoriser »</strong>. En local, seul le NTFS compte.</p>'],
  ]),

  note('green', '🎯 À retenir', '<p><strong>Partage</strong> = accès réseau, grossier, sur le point de partage. <strong>NTFS</strong> = toujours, fin, par dossier, avec héritage. En réseau, <strong>le plus restrictif gagne</strong> ; <strong>Refuser &gt; Autoriser</strong>. En pratique : <strong>un seul partage large</strong> + <strong>sécurité NTFS sur des groupes</strong>. Pour aller plus loin : <a href="/pages/vocabulaire-active-directory">vocabulaire AD</a>, <a href="/pages/hebergement-web">hébergement web</a>.</p>'),
];

const PAGE = {
  slug: SLUG,
  title: 'Les permissions : Partage & NTFS',
  excerpt: 'Droits de partage vs droits NTFS sur un serveur de fichiers : différences, niveaux, cumul (le plus restrictif l’emporte), héritage, bonne pratique (partage unique + sécurité NTFS) et mise en place pas-à-pas.',
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

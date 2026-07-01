/* Procédure « Installer & configurer Active Directory » (à partir du TP AD 0.0).
   Mode opératoire pas-à-pas : prérequis serveur (IP fixe + renommage) → rôle AD DS →
   promotion en contrôleur de domaine → vérifications → prérequis client → intégration au domaine.
   Schémas SVG (pipeline d'installation, topologie) + étapes numérotées + checks.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-procedure-ad.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });

// ===================================================================================
// Schémas SVG (texte ASCII)
// ===================================================================================
const C = { net: '#2563eb', dev: '#059669', warn: '#d97706', danger: '#dc2626', grey: '#64748b', slate: '#475569', purple: '#7c3aed', ok: '#16a34a' };
const wrap = (w: number, h: number, inner: string) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="max-width:${w}px;width:100%;height:auto;margin:8px 0 14px;font-family:system-ui,sans-serif">${inner}</svg>`;

// Pipeline d'installation : VM vierge → IP+nom → rôle AD DS → promotion DC → domaine
const svgFlow = wrap(640, 140, (() => {
  const steps: Array<[string, string, string]> = [
    ['VM Server', 'vierge', C.grey],
    ['1. IP fixe', '+ renommage', C.slate],
    ['2. Role', 'AD DS', C.net],
    ['3. Promotion', 'en DC', C.purple],
    ['Domaine', 'monentreprise.lan', C.ok],
  ];
  const W = 112, gap = 16, y = 44, h = 54; let x = 8, s = '';
  s += `<text x="320" y="24" text-anchor="middle" font-size="12" fill="${C.slate}" font-weight="bold">Le parcours : d une VM vierge a un contoleur de domaine</text>`;
  steps.forEach(([t, sub, col], i) => {
    s += `<rect x="${x}" y="${y}" width="${W}" height="${h}" rx="8" fill="${col}" fill-opacity="0.12" stroke="${col}" stroke-width="1.7"/>`;
    s += `<text x="${x + W / 2}" y="${y + 23}" text-anchor="middle" font-size="12" fill="${col}" font-weight="bold">${t}</text>`;
    s += `<text x="${x + W / 2}" y="${y + 40}" text-anchor="middle" font-size="10" fill="${C.slate}">${sub}</text>`;
    if (i < steps.length - 1) { const ax = x + W; s += `<path d="M${ax + 1} ${y + h / 2} l${gap - 4} 0 m-5 -4 l5 4 l-5 4" stroke="${C.grey}" stroke-width="2" fill="none"/>`; }
    x += W + gap;
  });
  s += `<text x="320" y="126" text-anchor="middle" font-size="10.5" fill="${C.grey}">Installer le role AD DS transforme le serveur en futur controleur de domaine ; la promotion cree le domaine.</text>`;
  return s;
})());

// Topologie : serveur AD/DNS + client intégré au domaine
const node = (x: number, y: number, w: number, col: string, title: string, lines: string[]) => {
  const h = 30 + lines.length * 15;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${col}" fill-opacity="0.1" stroke="${col}" stroke-width="1.6"/>`;
  s += `<text x="${x + w / 2}" y="${y + 21}" text-anchor="middle" font-size="12.5" fill="${col}" font-weight="bold">${title}</text>`;
  lines.forEach((l, i) => { s += `<text x="${x + w / 2}" y="${y + 39 + i * 15}" text-anchor="middle" font-size="10.5" fill="${C.slate}">${l}</text>`; });
  return s;
};
const svgTopo = wrap(640, 220,
  node(40, 36, 250, C.net, 'SRV-AD (controleur de domaine)', ['Roles : AD DS + DNS', 'IP fixe : 192.168.x.200', 'Domaine : monentreprise.lan'])
  + node(360, 36, 240, C.purple, 'CLIENT (Windows 10/11)', ['DNS prefere = IP du serveur', 'meme reseau / masque / passerelle', 'integre au domaine .lan'])
  + `<line x1="290" y1="70" x2="360" y2="70" stroke="#94a3b8" stroke-width="2"/>`
  + `<text x="325" y="62" text-anchor="middle" font-size="10" fill="${C.grey}">ping OK</text>`
  + `<text x="320" y="150" text-anchor="middle" font-size="11" fill="${C.slate}">Le client utilise le serveur comme DNS, le joint, puis s authentifie avec le compte administrateur du domaine.</text>`
  + `<text x="320" y="186" text-anchor="middle" font-size="10.5" fill="${C.grey}">Apres integration, le client apparait dans « Utilisateurs et ordinateurs Active Directory ».</text>`);

const th = (cols: string[]) => `<tr style="background:var(--surface-2)">${cols.map(c => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${c}</th>`).join('')}</tr>`;

// ===================================================================================
// PAGE
// ===================================================================================
const SLUG = 'procedure-installation-active-directory';
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Procédure · Windows Server', title: 'Installer & configurer Active Directory', subtitle: 'Mode opératoire pas-à-pas : d’une VM Windows Server vierge jusqu’à un poste client intégré au domaine.' }),
  block('html', { html: '<p>Cette <strong>procédure</strong> décrit, étape par étape, la mise en place d’un <strong>domaine Active Directory</strong> : préparation du serveur, installation du rôle <strong>AD DS</strong>, promotion en <strong>contrôleur de domaine</strong>, puis <strong>intégration d’un client</strong>. Suivez-la dans l’ordre — chaque étape conditionne la suivante.</p>' }),
  note('blue', '🧰 Avant de commencer', '<p><strong>Matériel :</strong> une VM <strong>Windows Server</strong> vierge + une VM <strong>cliente</strong> (Windows 10/11) vierge, sur le <strong>même réseau</strong>. <strong>Les notions</strong> (forêt, OU, LDAP, Kerberos, catalogue global…) sont définies dans le cours <a href="/pages/vocabulaire-active-directory">Vocabulaire Active Directory</a>. Voir aussi <a href="/pages/roles-windows-server">les rôles Windows Server</a> et <a href="/pages/gestionnaire-de-serveurs">le gestionnaire de serveurs</a>.</p>'),
  block('html', { html: svgFlow }),

  block('heading', { level: 2, text: '🧱 Étape 1 — Préparer le serveur' }),
  block('html', { html: '<p>Deux actions <strong>obligatoires</strong> avant d’installer le rôle AD, car un contrôleur de domaine doit être <strong>stable et identifiable</strong> sur le réseau.</p>' }),
  block('heading', { level: 3, text: '1.1 Passer le serveur en IP fixe' }),
  block('list', { listItems: [
    'Relever la configuration actuelle de la carte réseau : adresse IP, masque de sous-réseau, passerelle, serveur DNS.',
    'Passer la carte réseau en statique et ressaisir ces informations.',
    'Choisir une IP libre en fin de plage (entre .200 et .253) — vérifier qu’elle n’est pas déjà utilisée.',
    'Vérifier la bonne prise en compte dans le Gestionnaire de serveur.',
  ] }),
  note('yellow', '💡 Pourquoi une IP fixe ?', '<p>Les clients vont <strong>pointer leur DNS sur cette adresse</strong> : elle ne doit <strong>jamais changer</strong>. Une IP en DHCP rendrait le domaine instable.</p>'),
  block('heading', { level: 3, text: '1.2 Renommer le serveur' }),
  block('html', { html: '<p>Donnez un nom <strong>clair et identifiable</strong> (ex. <code>SRVAD</code> = SRV pour serveur + AD pour Active Directory), puis redémarrez si demandé. Le serveur est alors prêt à accueillir un rôle.</p>' }),

  block('heading', { level: 2, text: '📦 Étape 2 — Installer le rôle AD DS' }),
  block('html', { html: '<p>Dans le <strong>Gestionnaire de serveur</strong> : <em>Gérer → Ajouter des rôles et des fonctionnalités</em>. Sélectionnez le rôle <strong>Services AD DS</strong> (<em>Active Directory Domain Services</em>). L’assistant ajoute automatiquement les <strong>fonctionnalités requises</strong>, puis lancez l’installation jusqu’à <em>Confirmation</em>.</p>' }),
  note('blue', '🔎 Ce que demande / signale l’assistant', '<p><strong>Prérequis réseau</strong> rappelés : <strong>adresse IP (fixe)</strong>, <strong>masque</strong>, <strong>DNS</strong>. À la fin, un bandeau signale : <em>« Des étapes supplémentaires sont requises pour faire de cet ordinateur un contrôleur de domaine »</em> → c’est l’étape 3. <strong>Installer le rôle ne crée pas encore le domaine.</strong></p>'),

  block('heading', { level: 2, text: '🏢 Étape 3 — Promouvoir en contrôleur de domaine' }),
  block('html', { html: '<p>Cliquez sur <strong>« Promouvoir ce serveur en contrôleur de domaine »</strong> (bandeau de notification du Gestionnaire de serveur), puis :</p>' }),
  block('list', { listItems: [
    'Choisir « Ajouter une nouvelle forêt » (premier DC) et saisir le nom de domaine racine.',
    'Définir le mot de passe DSRM (restauration des services d’annuaire) — à conserver précieusement.',
    'Laisser l’assistant installer le DNS et le catalogue global ; vérifier les contrôles de prérequis.',
    'Lancer l’installation : le serveur redémarre automatiquement à la fin.',
  ] }),
  note('yellow', '⚠️ Nom de domaine', '<p>En local, nommez-le librement mais respectez les règles : <strong>minuscules</strong>, <strong>sans espace</strong>, <strong>sans caractère spécial</strong>, et terminez par <strong><code>.lan</code></strong> (ex. <code>monentreprise.lan</code>). Évitez un vrai TLD public (<code>.com</code>, <code>.fr</code>).</p>'),
  note('danger', '🔑 Après le redémarrage', '<p>Le <strong>compte administrateur local est désactivé</strong> au profit du <strong>compte administrateur du domaine</strong> (même mot de passe). Connectez-vous donc en <code>monentreprise\\administrateur</code>.</p>'),

  block('heading', { level: 2, text: '✅ Étape 4 — Vérifier le serveur' }),
  block('html', { html: '<p>Une fois reconnecté en administrateur du domaine, contrôlez que tout est en place :</p>' }),
  block('list', { listItems: [
    'Gestionnaire de serveur : les rôles AD DS et DNS sont présents.',
    'Le serveur porte bien le nom de domaine configuré (Propriétés système).',
    'Outils → Utilisateurs et ordinateurs Active Directory : le serveur apparaît dans l’unité d’organisation « Domain Controllers ».',
  ] }),
  note('green', '🧭 Familiarisez-vous', '<p>La console <strong>« Utilisateurs et ordinateurs Active Directory »</strong> sera votre outil de gestion quotidien (comptes, groupes, <a href="/pages/vocabulaire-active-directory">unités d’organisation</a>). Explorez ses menus.</p>'),

  block('heading', { level: 2, text: '🖥️ Étape 5 — Préparer le client' }),
  block('html', { html: '<p>Sur la VM cliente (Windows 10/11), réglez les prérequis réseau pour qu’elle « voie » le domaine :</p>' }),
  block('html', { html: `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:520px;font-size:13.5px"><thead>${th(['Paramètre', 'Valeur à mettre'])}</thead><tbody>` +
    [
      ['Nom de la machine', 'un nom clair (ex. CLIENT-W10-01)'],
      ['Adresse IP', 'même réseau, même masque, même passerelle que le serveur'],
      ['DNS préféré', '<b>l’adresse IP du serveur AD</b> (ex. 192.168.x.200)'],
      ['DNS secondaire (option)', 'l’adresse de la passerelle'],
    ].map(r => `<tr><td style="padding:8px 10px;border:1px solid var(--border);font-weight:600">${r[0]}</td><td style="padding:8px 10px;border:1px solid var(--border)">${r[1]}</td></tr>`).join('') +
    `</tbody></table></div>` }),
  note('yellow', '🧪 Vérifier la communication', '<p>Depuis le client, un <strong><code>ping</code> vers l’IP du serveur doit répondre</strong>. Sinon, vérifiez l’IP/masque/passerelle et le pare-feu (ICMP) avant d’aller plus loin.</p>'),

  block('heading', { level: 2, text: '🔗 Étape 6 — Intégrer le client au domaine' }),
  block('html', { html: '<p>Quand les prérequis sont remplis :</p>' }),
  block('list', { listItems: [
    'Sur le client : Propriétés système (même endroit que pour renommer la machine) → Modifier → cocher « Domaine ».',
    'Saisir le nom du domaine (ex. monentreprise.lan).',
    'S’authentifier avec un compte autorisé à joindre le domaine : le compte « administrateur » du domaine et son mot de passe.',
    'Au message de bienvenue, redémarrer la machine pour appliquer.',
  ] }),
  block('html', { html: svgTopo }),
  block('html', { html: '<p><strong>Vérification finale :</strong> sur le serveur, dans <em>Outils → Utilisateurs et ordinateurs Active Directory</em>, retrouvez la machine cliente nouvellement intégrée (généralement dans le conteneur <code>Computers</code>).</p>' }),

  note('green', '🎯 Résultat', '<p>Vous disposez d’un <strong>contrôleur de domaine</strong> (AD DS + DNS) et d’un <strong>poste client intégré</strong> : l’authentification et la gestion sont désormais <strong>centralisées</strong>. Suite logique : créer des <strong>comptes utilisateurs</strong>, des <strong>groupes</strong> et des <strong>unités d’organisation</strong> (voir <a href="/pages/vocabulaire-active-directory">Vocabulaire AD</a>), et publier des services (voir <a href="/pages/hebergement-web">Hébergement web</a>).</p>'),
];

const PAGE = {
  slug: SLUG,
  title: 'Installer & configurer Active Directory',
  excerpt: 'Procédure pas-à-pas : préparer le serveur (IP fixe, nom), installer le rôle AD DS, promouvoir en contrôleur de domaine (domaine .lan), vérifier, préparer le client et l’intégrer au domaine.',
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

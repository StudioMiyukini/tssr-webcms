/* Page « Administration d'un domaine AD » : approfondit les dernières notions vues —
   rôles FSMO, SYSVOL, relations d'approbation (trusts) et délégation de contrôle.
   Complète la page « Vocabulaire Active Directory » avec schémas et cas d'usage.
   Source : slides Adrar (FSMO, Approbation, Délégation, SYSVOL).
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-administration-domaine-ad.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const SLUG = 'administration-domaine-ad';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });

// ===================================================================================
// Schémas SVG (responsive, palette du thème)
// ===================================================================================
const C = { forest: '#7c3aed', dom: '#2563eb', ok: '#16a34a', warn: '#d97706', grey: '#64748b', slate: '#475569', danger: '#dc2626' };
const wrap = (w: number, h: number, inner: string) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="max-width:${w}px;width:100%;height:auto;margin:8px 0 14px;font-family:system-ui,sans-serif">${inner}</svg>`;
const chip = (x: number, y: number, w: number, col: string, label: string, sub: string) =>
  `<rect x="${x}" y="${y}" width="${w}" height="46" rx="9" fill="${col}" fill-opacity="0.08" stroke="${col}" stroke-width="1.5"/>`
  + `<text x="${x + 13}" y="${y + 20}" font-size="12.5" fill="${col}" font-weight="bold">${label}</text>`
  + `<text x="${x + 13}" y="${y + 37}" font-size="10.5" fill="${C.slate}">${sub}</text>`;

// 1) Répartition des 5 rôles FSMO : 2 au niveau forêt, 3 au niveau domaine
const svgFsmo = wrap(660, 300,
  `<rect x="8" y="8" width="644" height="120" rx="11" fill="${C.forest}" fill-opacity="0.05" stroke="${C.forest}" stroke-width="1.6"/>`
  + `<text x="22" y="30" font-size="13" fill="${C.forest}" font-weight="bold">🌲 Niveau FORÊT — 1 seul détenteur pour toute la forêt</text>`
  + chip(22, 46, 300, C.forest, '🗂️ Maître de schéma', 'modifie le schéma AD')
  + chip(338, 46, 300, C.forest, '🏷️ Maître d’attribution de noms', 'ajout / suppression de domaines')
  + `<rect x="8" y="140" width="644" height="152" rx="11" fill="${C.dom}" fill-opacity="0.05" stroke="${C.dom}" stroke-width="1.6"/>`
  + `<text x="22" y="162" font-size="13" fill="${C.dom}" font-weight="bold">🏢 Niveau DOMAINE — 1 détenteur par domaine</text>`
  + chip(22, 178, 300, C.dom, '🔢 Maître RID', 'distribue les blocs de RID / SID')
  + chip(338, 178, 300, C.dom, '🕰️ Émulateur PDC', 'auth, mots de passe, heure')
  + chip(22, 234, 616, C.dom, '🔗 Maître d’infrastructure', 'références entre objets de domaines différents'));

// 2) SYSVOL répliqué entre contrôleurs de domaine
const dc = (x: number, label: string) =>
  `<rect x="${x}" y="70" width="150" height="92" rx="10" fill="${C.dom}" fill-opacity="0.08" stroke="${C.dom}" stroke-width="1.6"/>`
  + `<text x="${x + 75}" y="92" text-anchor="middle" font-size="12.5" fill="${C.dom}" font-weight="bold">${label}</text>`
  + `<rect x="${x + 20}" y="104" width="110" height="42" rx="7" fill="${C.warn}" fill-opacity="0.12" stroke="${C.warn}" stroke-width="1.3"/>`
  + `<text x="${x + 75}" y="121" text-anchor="middle" font-size="11" fill="${C.warn}" font-weight="bold">📂 SYSVOL</text>`
  + `<text x="${x + 75}" y="137" text-anchor="middle" font-size="9.5" fill="${C.slate}">GPO + scripts</text>`;
const svgSysvol = wrap(560, 210,
  `<text x="280" y="28" text-anchor="middle" font-size="13" fill="${C.slate}" font-weight="bold">Réplication automatique du dossier SYSVOL</text>`
  + dc(40, 'DC1')
  + dc(370, 'DC2')
  + `<line x1="190" y1="116" x2="370" y2="116" stroke="${C.ok}" stroke-width="2.4" marker-end="url(#ar)" marker-start="url(#ar)"/>`
  + `<text x="280" y="108" text-anchor="middle" font-size="10.5" fill="${C.ok}" font-weight="bold">réplication ↔</text>`
  + `<defs><marker id="ar" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0 0 L9 4.5 L0 9 z" fill="${C.ok}"/></marker></defs>`
  + `<text x="280" y="188" text-anchor="middle" font-size="10.5" fill="${C.slate}">Toute modification (nouvelle GPO, script) est propagée à tous les DC</text>`);

// 3) Sens des approbations
const svgTrust = wrap(600, 220,
  `<rect x="30" y="40" width="150" height="60" rx="10" fill="${C.dom}" fill-opacity="0.09" stroke="${C.dom}" stroke-width="1.6"/><text x="105" y="76" text-anchor="middle" font-size="13" fill="${C.dom}" font-weight="bold">Domaine A</text>`
  + `<rect x="420" y="40" width="150" height="60" rx="10" fill="${C.forest}" fill-opacity="0.09" stroke="${C.forest}" stroke-width="1.6"/><text x="495" y="76" text-anchor="middle" font-size="13" fill="${C.forest}" font-weight="bold">Domaine B</text>`
  + `<line x1="180" y1="60" x2="420" y2="60" stroke="${C.grey}" stroke-width="2.2" marker-end="url(#a2)"/>`
  + `<text x="300" y="52" text-anchor="middle" font-size="10.5" fill="${C.slate}">unidirectionnelle : A fait confiance à B</text>`
  + `<line x1="180" y1="88" x2="420" y2="88" stroke="${C.ok}" stroke-width="2.2" marker-end="url(#a2)" marker-start="url(#a2)"/>`
  + `<text x="300" y="112" text-anchor="middle" font-size="10.5" fill="${C.ok}" font-weight="bold">bidirectionnelle : A ↔ B</text>`
  + `<text x="300" y="168" text-anchor="middle" font-size="11.5" fill="${C.slate}" font-weight="bold">Transitivité : si A → B et B → C, alors A → C</text>`
  + `<text x="300" y="190" text-anchor="middle" font-size="10.5" fill="${C.slate}">(automatique entre domaines d’une même forêt)</text>`
  + `<defs><marker id="a2" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0 0 L9 4.5 L0 9 z" fill="${C.slate}"/></marker></defs>`);

// ===================================================================================
// BLOCS DE LA PAGE
// ===================================================================================
const blocks: PageBlock[] = [
  block('hero', {
    eyebrow: 'Software · Windows Server',
    title: 'Administration d’un domaine AD',
    subtitle: 'Rôles FSMO, SYSVOL, relations d’approbation et délégation de contrôle : les rouages qui font tourner un domaine Active Directory.',
  }),
  block('html', { html: '<p>Une fois le domaine installé et les objets créés, il reste à comprendre <strong>comment l’annuaire fonctionne réellement</strong> : quels serveurs assurent les opérations sensibles, comment les stratégies se propagent, comment relier plusieurs domaines et comment déléguer l’administration sans donner tous les pouvoirs. Ce cours approfondit ces quatre notions. Pour le vocabulaire de base, voir <a href="/pages/vocabulaire-active-directory">Vocabulaire Active Directory</a>.</p>' }),

  // --- FSMO ---
  block('heading', { level: 2, text: '🎖️ Les rôles FSMO' }),
  block('html', { html: '<p>Par défaut, Active Directory est <strong>multi-maître</strong> : chaque contrôleur de domaine (DC) peut écrire dans l’annuaire. Mais certaines opérations sont trop sensibles pour être faites partout en même temps — elles créeraient des <strong>conflits</strong>. Ces opérations sont confiées à des <strong>rôles FSMO</strong> (<em>Flexible Single Master Operations</em>) : des fonctions <strong>uniques</strong>, tenues par <strong>un seul serveur</strong>. Il en existe <strong>5</strong> : <strong>2 au niveau de la forêt</strong> et <strong>3 au niveau de chaque domaine</strong>.</p>' }),
  block('html', { html: svgFsmo }),
  block('html', { html: `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:660px;font-size:13.5px"><thead><tr style="background:var(--surface-2)">${['Rôle FSMO', 'Niveau', 'Rôle précis'].map(c => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${c}</th>`).join('')}</tr></thead><tbody>` +
    ([
      ['🗂️ Maître de schéma <span class="meta">(Schema Master)</span>', 'Forêt', 'Seul autorisé à modifier le schéma (classes et attributs) de l’annuaire.'],
      ['🏷️ Maître d’attribution de noms <span class="meta">(Domain Naming Master)</span>', 'Forêt', 'Contrôle l’ajout et la suppression de domaines dans la forêt.'],
      ['🔢 Maître RID <span class="meta">(RID Master)</span>', 'Domaine', 'Distribue aux DC des blocs de RID pour fabriquer des SID uniques.'],
      ['🕰️ Émulateur PDC <span class="meta">(PDC Emulator)</span>', 'Domaine', 'Référence pour l’authentification, les changements de mot de passe, les verrouillages de compte et la synchronisation de l’heure.'],
      ['🔗 Maître d’infrastructure <span class="meta">(Infrastructure Master)</span>', 'Domaine', 'Met à jour les références vers des objets situés dans d’autres domaines.'],
    ] as Array<[string, string, string]>).map(r => `<tr><td style="padding:8px 10px;border:1px solid var(--border);font-weight:600">${r[0]}</td><td style="padding:8px 10px;border:1px solid var(--border)">${r[1]}</td><td style="padding:8px 10px;border:1px solid var(--border)">${r[2]}</td></tr>`).join('') +
    `</tbody></table></div>` }),
  note('yellow', '🔧 Transférer ou saisir un rôle', '<p>Comme chaque rôle est <strong>unique</strong>, la panne du DC qui le détient peut gêner l’annuaire. Deux cas :</p><ul><li><strong>Transfert</strong> (<em>transfer</em>) — le DC source est disponible : on déplace proprement le rôle vers un autre DC.</li><li><strong>Saisie</strong> (<em>seize</em>) — le DC source est définitivement perdu : on force la prise du rôle (à ne faire que si l’ancien DC ne reviendra jamais).</li></ul><p>Commande pour voir qui détient quoi : <code>netdom query fsmo</code>.</p>'),

  // --- SYSVOL ---
  block('heading', { level: 2, text: '📂 SYSVOL' }),
  block('html', { html: '<p><strong>SYSVOL</strong> (<em>System Volume</em>) est un <strong>dossier partagé présent sur chaque contrôleur de domaine</strong> (<code>C:\\Windows\\SYSVOL</code>). Il contient les données qui doivent être <strong>identiques sur tous les DC</strong> et <strong>accessibles par les clients</strong> du domaine, principalement :</p>' }),
  block('list', { listItems: [
    'les stratégies de groupe (GPO) — leurs fichiers de configuration ;',
    'les scripts de connexion (logon scripts) exécutés au démarrage de session.',
  ] }),
  block('html', { html: svgSysvol }),
  block('html', { html: '<p>SYSVOL est <strong>répliqué automatiquement</strong> entre tous les contrôleurs de domaine : quand on crée ou modifie une GPO sur un DC, le changement est <strong>propagé aux autres</strong>. C’est ce qui garantit qu’un utilisateur reçoit les <strong>mêmes stratégies</strong> quel que soit le DC qui l’authentifie. Sans un SYSVOL sain et répliqué, <strong>les GPO ne s’appliquent plus correctement</strong>.</p>' }),

  // --- Approbations ---
  block('heading', { level: 2, text: '🤝 Les relations d’approbation (trusts)' }),
  block('html', { html: '<p>Une <strong>relation d’approbation</strong> établit un <strong>lien de confiance</strong> entre <strong>domaines ou forêts différents</strong>, afin que les utilisateurs de l’un puissent accéder aux ressources de l’autre. On la décrit par son <strong>sens</strong> et sa <strong>portée</strong> :</p>' }),
  block('html', { html: svgTrust }),
  block('list', { listItems: [
    'Unidirectionnelle : la confiance ne va que dans un sens (A fait confiance à B).',
    'Bidirectionnelle : la confiance va dans les deux sens (A ↔ B).',
    'Transitive : si A approuve B et que B approuve C, alors A approuve aussi C.',
  ] }),
  block('html', { html: '<p>Deux grands cas selon le contexte :</p>' }),
  block('cards', { cards: [
    { title: '🌲 Approbations automatiques (parent / enfant)', body: 'Dans une même forêt, l’ajout d’un domaine enfant (ex. toulouse.adrar.local sous adrar.local) crée automatiquement une approbation transitive et bidirectionnelle.', href: '' },
    { title: '🔗 Approbations externes', body: 'Entre domaines de forêts différentes : la relation est unidirectionnelle et non transitive. Pour un accès dans les deux sens, chaque domaine doit créer sa propre approbation.', href: '' },
  ] }),

  // --- Délégation ---
  block('heading', { level: 2, text: '🎫 La délégation de contrôle' }),
  block('html', { html: '<p>La <strong>délégation de contrôle</strong> consiste à <strong>accorder des droits d’administration précis</strong> à un utilisateur ou un groupe sur une <strong>portion de l’annuaire</strong> (généralement une <strong>OU</strong>), <strong>sans en faire un administrateur du domaine</strong>. C’est l’application du <strong>principe du moindre privilège</strong> : on donne juste ce qu’il faut.</p>' }),
  note('blue', '💡 Exemple concret', '<p>On veut que le <strong>support de niveau 1</strong> puisse <strong>réinitialiser les mots de passe</strong> des utilisateurs de l’OU <em>Toulouse</em> — mais rien d’autre. On lance l’assistant <strong>Déléguer le contrôle…</strong> (clic droit sur l’OU dans <em>Utilisateurs et ordinateurs AD</em>), on choisit le groupe <em>Support-N1</em> et on coche uniquement « <strong>Réinitialiser les mots de passe utilisateur</strong> ». Le support gère les mots de passe de cette OU sans jamais pouvoir toucher au reste du domaine.</p>'),
  block('list', { listItems: [
    'On délègue de préférence à un groupe (pas à une personne) : plus simple à maintenir.',
    'On délègue au niveau d’une OU : la portée reste limitée et lisible.',
    'On accorde des tâches précises (réinitialiser un mot de passe, créer des comptes, gérer les membres d’un groupe…), pas « tout ».',
  ] }),

  note('green', '🎯 À retenir', '<p><strong>FSMO</strong> = 5 rôles uniques (2 forêt, 3 domaine) pour les opérations sensibles, transférables ou saisissables. <strong>SYSVOL</strong> = dossier répliqué sur chaque DC qui porte les <strong>GPO et scripts</strong>. <strong>Approbations</strong> = liens de confiance entre domaines/forêts, définis par leur <strong>sens</strong> et leur <strong>transitivité</strong>. <strong>Délégation</strong> = donner des droits <strong>précis</strong> sur une <strong>OU</strong> sans être admin du domaine. Mise en pratique : <a href="/pages/procedure-installation-active-directory">installer AD</a> et <a href="/pages/procedure-agdlp">mettre en place AGDLP</a>.</p>'),
];

const PAGE = {
  slug: SLUG,
  title: 'Administration d’un domaine AD (FSMO, SYSVOL, approbations, délégation)',
  excerpt: 'Rôles FSMO (schéma, attribution de noms, RID, PDC, infrastructure), SYSVOL et réplication, relations d’approbation (sens & transitivité) et délégation de contrôle — avec schémas.',
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

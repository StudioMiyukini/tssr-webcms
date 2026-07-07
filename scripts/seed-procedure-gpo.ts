/* Procédure « GPO : stratégies de groupe (créer, lier, filtrer, appliquer) » Windows Server / AD.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-procedure-gpo.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'procedure-gpo', title: 'GPO : stratégies de groupe (créer, lier, filtrer, appliquer)', excerpt: 'Créer une stratégie de groupe, la lier à une UO, régler des paramètres (mot de passe, lecteur réseau, restrictions), filtrer par groupe de sécurité, forcer et vérifier l’application (gpupdate / gpresult). Ordre LSDOU, héritage et priorité.' };
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stepsStyle = block('html', { html: `<style>.proc-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}.proc-steps{padding-left:22px;line-height:1.75}.proc-steps>li{margin:8px 0}.proc-steps code{font-family:ui-monospace,monospace}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="proc-cmd">${esc(t)}</div>` });

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Procédure · Active Directory', title: PAGE.title, subtitle: 'Configurer et sécuriser en masse tous les postes et utilisateurs du domaine, centralement.' }),
  stepsStyle,
  note('blue', '🎯 Ce qu’est une GPO', '<p>Une <strong>stratégie de groupe</strong> (GPO) applique automatiquement des <strong>réglages</strong> à des <strong>ordinateurs</strong> et/ou des <strong>utilisateurs</strong> du domaine : mot de passe, fond d’écran, lecteurs réseau, restrictions, pare-feu, installation de logiciels… au lieu de configurer chaque poste à la main. Prérequis : un domaine AD (voir <a href="/pages/procedure-installation-active-directory">Installer AD</a>). Console : <strong>Gestion des stratégies de groupe</strong> (<code>gpmc.msc</code>).</p>'),

  block('heading', { level: 2, text: '1) Créer une GPO et la lier à une UO' }),
  block('html', { html: `<ol class="proc-steps">
    <li>Ouvre <code>gpmc.msc</code> → déplie <strong>Forêt → Domaines → miyukini.lan</strong>.</li>
    <li><strong>Clic droit sur l’UO</strong> ciblée (ex. <code>Bureaux</code>) → <strong>« Créer un objet GPO dans ce domaine, et le lier ici… »</strong> → nomme-la (ex. <code>GPO-Bureaux-Verrouillage</code>).</li>
    <li>La GPO apparaît <strong>liée</strong> sous l’UO. (Créer + lier en une fois ; on peut aussi créer dans « Objets de stratégie de groupe » puis lier ensuite.)</li>
  </ol>` }),
  note('gray', '🎯 Où lier ?', '<p>Une GPO se lie à un <strong>site</strong>, au <strong>domaine</strong> ou à une <strong>UO</strong> — jamais à un groupe directement. Elle s’applique aux objets <strong>situés dans</strong> ce conteneur. Range donc tes utilisateurs/ordinateurs dans les bonnes <a href="/pages/procedure-ad-objets">UO</a>.</p>'),

  block('heading', { level: 2, text: '2) Modifier les paramètres' }),
  block('html', { html: '<p>Clic droit sur la GPO → <strong>Modifier</strong> → l’<strong>Éditeur de gestion</strong> s’ouvre. Deux branches : <strong>Configuration ordinateur</strong> (s’applique à la machine, au démarrage) et <strong>Configuration utilisateur</strong> (à l’ouverture de session). Exemples courants :</p>' }),
  block('html', { html: `<ul>
    <li><strong>Stratégie de mot de passe</strong> : Configuration ordinateur → Stratégies → Paramètres Windows → Paramètres de sécurité → <em>Stratégies de comptes → Stratégie de mot de passe</em> (longueur, complexité, expiration). <em>(À définir au niveau du domaine.)</em></li>
    <li><strong>Lecteur réseau mappé</strong> : Configuration utilisateur → Préférences → Paramètres Windows → <em>Mappages de lecteurs</em> → nouveau (ex. <code>P:</code> → <code>\\\\SRV-FICHIERS\\Partage</code>).</li>
    <li><strong>Restriction</strong> : Configuration utilisateur → Stratégies → Modèles d’administration → ex. <em>masquer le Panneau de configuration</em>, interdire l’accès au registre, etc.</li>
    <li><strong>Fond d’écran imposé</strong>, <strong>page de démarrage</strong>, <strong>règles de pare-feu</strong>, <strong>déploiement de logiciel</strong> (.msi)…</li>
  </ul>` }),

  block('heading', { level: 2, text: '3) Cibler plus finement (filtrage de sécurité)' }),
  block('html', { html: '<p>Par défaut, une GPO s’applique à <strong>« Utilisateurs authentifiés »</strong> (tout le monde dans l’UO). Pour ne viser <strong>qu’un groupe</strong> :</p>' }),
  block('html', { html: `<ol class="proc-steps">
    <li>Sélectionne la GPO → onglet <strong>Étendue</strong> → zone <strong>Filtrage de sécurité</strong>.</li>
    <li><strong>Retire</strong> « Utilisateurs authentifiés » et <strong>ajoute</strong> le groupe voulu (ex. <code>G_Comptables</code>).</li>
    <li>(Depuis Windows récent : garde « Utilisateurs authentifiés » en <em>lecture</em> dans l’onglet Délégation, sinon la GPO ne s’applique plus — sécurité KB.)</li>
  </ol>` }),

  block('heading', { level: 2, text: '4) Forcer et vérifier l’application' }),
  block('html', { html: '<p>Les GPO se rafraîchissent périodiquement (~90 min) ou au démarrage/ouverture de session. Pour <strong>forcer</strong> immédiatement sur un poste :</p>' }),
  cmd(`gpupdate /force`),
  block('html', { html: '<p>Pour <strong>vérifier</strong> quelles GPO s’appliquent réellement à un utilisateur/poste :</p>' }),
  cmd(`gpresult /r
REM rapport HTML détaillé :
gpresult /h C:\\rapport-gpo.html`),
  note('gray', '🖥️ Côté serveur', '<p>Sur le DC : <code>Get-GPO -All</code> (liste), <code>Get-GPResultantSetOfPolicy</code> / la console <strong>Modélisation</strong> et <strong>Résultats de stratégie de groupe</strong> dans <code>gpmc.msc</code> simulent/affichent l’application.</p>'),

  block('heading', { level: 2, text: '5) Ordre d’application, héritage et priorité' }),
  block('html', { html: '<p>Les GPO s’appliquent dans l’ordre <strong>LSDOU</strong> : <strong>L</strong>ocale → <strong>S</strong>ite → <strong>D</strong>omaine → <strong>U</strong>O (et sous-UO). <strong>La dernière appliquée gagne</strong> en cas de conflit (donc l’UO la plus proche l’emporte).</p>' }),
  block('html', { html: `<ul>
    <li><strong>Bloquer l’héritage</strong> (sur une UO) : ignore les GPO venant d’au-dessus.</li>
    <li><strong>Appliqué / « Enforced »</strong> (sur un lien de GPO) : force la GPO malgré un blocage d’héritage et remporte les conflits.</li>
    <li>L’ordre des liens sur une même UO définit la priorité (1 = plus fort).</li>
  </ul>` }),

  block('heading', { level: 2, text: '6) En PowerShell (rappel)' }),
  cmd(`New-GPO -Name "GPO-Bureaux-Verrouillage"
New-GPLink -Name "GPO-Bureaux-Verrouillage" -Target "OU=Bureaux,DC=miyukini,DC=lan"
Get-GPO -All | Select DisplayName, GpoStatus`),

  note('green', '✅ À retenir', '<p><strong>Créer + lier</strong> à une UO → <strong>modifier</strong> (ordinateur/utilisateur) → <strong>filtrer</strong> par groupe si besoin → <code>gpupdate /force</code> + <code>gpresult /r</code> pour vérifier. Ordre <strong>LSDOU</strong>, la plus proche gagne. Prérequis objets AD : <a href="/pages/procedure-ad-objets">UO, groupes & utilisateurs</a>.</p>'),
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
  const cur = existing.find(e => e.slug === PAGE.slug);
  const body = JSON.stringify({ title: PAGE.title, slug: PAGE.slug, excerpt: PAGE.excerpt, content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1 });
  const res = cur ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body }) : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log(`PAGE ${PAGE.slug}`, res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());
  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

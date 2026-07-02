/* Page de cours « Gestion avancée des utilisateurs & serveur de fichiers » (TP AD 6).
   Plages horaires, profils itinérants, dossier de base, scripts d'ouverture de session,
   expiration de compte, énumération basée sur l'accès (ABE), quotas (FSRM) + Q/R.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-gestion-avancee-ad.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const accordion = (it: Array<[string, string]>) => block('accordion', { items: it.map(([title, text]) => ({ title, text, href: '' })) });

const C = { net: '#2563eb', dev: '#059669', warn: '#d97706', grey: '#64748b', slate: '#475569' };
const wrap = (w: number, h: number, inner: string) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="max-width:${w}px;width:100%;height:auto;margin:8px 0 14px;font-family:system-ui,sans-serif">${inner}</svg>`;
const svgRoam = wrap(640, 160,
  `<rect x="24" y="40" width="180" height="70" rx="8" fill="${C.net}" fill-opacity="0.1" stroke="${C.net}" stroke-width="1.7"/><text x="114" y="66" text-anchor="middle" font-size="12.5" fill="${C.net}" font-weight="bold">Poste client</text><text x="114" y="86" text-anchor="middle" font-size="10.5" fill="${C.slate}">n importe lequel du domaine</text>`
  + `<rect x="436" y="40" width="180" height="70" rx="8" fill="${C.dev}" fill-opacity="0.1" stroke="${C.dev}" stroke-width="1.7"/><text x="526" y="62" text-anchor="middle" font-size="12.5" fill="${C.dev}" font-weight="bold">Serveur de fichiers</text><text x="526" y="82" text-anchor="middle" font-size="9.5" fill="${C.slate}" font-family="ui-monospace,monospace">\\\\srvad\\profils$\\%username%</text>`
  + `<line x1="204" y1="66" x2="428" y2="66" stroke="${C.slate}" stroke-width="2"/><path d="M436 66 l-9 -5 l0 10 z" fill="${C.slate}"/><text x="320" y="58" text-anchor="middle" font-size="10.5" fill="${C.slate}">ouverture de session : charge le profil</text>`
  + `<line x1="436" y1="90" x2="212" y2="90" stroke="${C.dev}" stroke-width="2" stroke-dasharray="5 4"/><path d="M204 90 l9 -5 l0 10 z" fill="${C.dev}"/><text x="320" y="104" text-anchor="middle" font-size="10.5" fill="${C.dev}">fermeture : sauvegarde le profil</text>`
  + `<text x="320" y="140" text-anchor="middle" font-size="11" fill="${C.grey}">Le profil (Documents, Bureau...) suit l utilisateur sur toutes les machines.</text>`);

// ===================================================================================
// PAGE
// ===================================================================================
const SLUG = 'gestion-avancee-utilisateurs';
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Windows Server', title: 'Gestion avancée des utilisateurs & serveur de fichiers', subtitle: 'Plages horaires, profils itinérants, dossiers de base, scripts de session, ABE et quotas.' }),
  block('html', { html: '<p>Une fois la structure AD et les droits en place, Windows Server offre de nombreuses <strong>fonctionnalités avancées</strong> pour gérer finement les comptes et le serveur de fichiers : restreindre les <strong>horaires</strong>, faire suivre les <strong>profils</strong> et <strong>dossiers</strong> des utilisateurs, automatiser des <strong>lecteurs réseau</strong>, <strong>expirer</strong> des comptes temporaires, <strong>masquer</strong> les dossiers inaccessibles et limiter l’espace disque avec des <strong>quotas</strong>.</p>' }),
  note('blue', '🧰 Prérequis', '<p>Un domaine fonctionnel avec des <strong>UO / groupes / utilisateurs</strong> et un <strong>serveur de fichiers</strong> partagé (TP précédents). À connaître : <a href="/pages/permissions-partage-ntfs">permissions Partage & NTFS</a> et <a href="/pages/vocabulaire-active-directory">vocabulaire AD</a>. La plupart des réglages se font dans <strong>Utilisateurs et ordinateurs Active Directory</strong> → propriétés d’un compte.</p>'),

  block('heading', { level: 2, text: '⏰ Plages horaires de connexion' }),
  block('html', { html: '<p>On peut <strong>autoriser l’ouverture de session uniquement sur certaines plages horaires</strong> (sécurité). Dans les propriétés du compte → onglet <strong>Compte</strong> → <strong>Horaires d’accès…</strong> : sélectionner les créneaux <strong>autorisés</strong> ou <strong>refusés</strong>.</p>' }),
  block('list', { listItems: [
    'Exemple : autoriser Lundi→Vendredi de 6h à 21h (le reste refusé).',
    'Test du refus : sur un utilisateur, refuser 9h–17h tous les jours, puis tenter une connexion depuis le client → l’ouverture de session doit être refusée.',
  ] }),
  note('yellow', '⚠️ Session déjà ouverte', '<p>La plage horaire bloque l’<strong>ouverture</strong> de session. Une session <strong>déjà ouverte</strong> quand la plage se termine n’est pas fermée automatiquement (sauf stratégie dédiée).</p>'),

  block('heading', { level: 2, text: '👤 Profils itinérants' }),
  block('html', { html: '<p>Un <strong>profil itinérant</strong> stocke les dossiers personnels (Documents, Bureau…) <strong>sur le serveur</strong> : l’utilisateur retrouve ses fichiers <strong>sur n’importe quel poste</strong> du domaine. Idéal pour du personnel mobile (formateurs, techniciens).</p>' }),
  block('html', { html: svgRoam }),
  accordion([
    ['Mettre en place', '<p>Sur le serveur, créer un dossier <code>profils</code> à la racine de <code>C:</code>, le partager en le <strong>cachant</strong> (ajouter <code>$</code> à la fin : <code>profils$</code>), avec le groupe des formateurs en <strong>Modification</strong> (droit de partage). Puis, dans les propriétés d’un utilisateur → onglet <strong>Profil</strong> → <strong>Chemin du profil</strong>, saisir le chemin réseau + la variable <code>%username%</code> :</p><pre style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;overflow-x:auto"><code>\\\\srvad\\profils$\\%username%</code></pre><p>Windows crée automatiquement un dossier au nom de l’utilisateur.</p>'],
    ['Vérifier', '<p>Se connecter sur le client avec cet utilisateur : <strong>aucune notification de « profil temporaire »</strong> ne doit apparaître (sinon le profil itinérant ne fonctionne pas). Côté serveur, un dossier au nom de l’utilisateur doit apparaître dans <code>profils</code>.</p>'],
    ['Appliquer à tout un groupe', '<p>Sélectionner <strong>plusieurs utilisateurs</strong> à la fois puis refaire la manip : le chemin s’applique à tous (avec <code>%username%</code>, chacun a son sous-dossier).</p>'],
    ['💡 Windows 7 vs Windows 10', '<p>La <strong>version du profil</strong> diffère selon l’OS : le dossier serveur porte un <strong>suffixe</strong> (ex. <code>.V2</code> pour Windows 7, <code>.V6</code> pour Windows 10). Deux OS différents ne partagent donc pas le même dossier de profil.</p>'],
  ]),
  note('blue', '🔑 Toujours un chemin réseau', '<p>On indique <strong>l’adresse réseau du partage</strong> (<code>\\\\serveur\\partage$</code>), car c’est l’adresse que le <strong>client</strong> va contacter pour charger le profil — pas le chemin local <code>C:\\profils</code>.</p>'),

  block('heading', { level: 2, text: '🏠 Dossier de base (home)' }),
  block('html', { html: '<p>Le <strong>dossier de base</strong> donne à chaque utilisateur un <strong>lecteur réseau personnel</strong> (avec une lettre) visible dans « Ce PC ». Pratique pour un espace de stockage individuel sur le serveur.</p>' }),
  block('list', { listItems: [
    'Sur le serveur : créer un dossier home à la racine de C:, le partager en home$ avec le groupe des stagiaires en Modification.',
    'Propriétés du compte → onglet Profil → Dossier de base → cocher « Connecter », choisir une lettre, saisir : \\\\srvad\\home$\\%username%',
    'Se connecter sur le client → Ce PC : le lecteur réseau doit apparaître. Tester l’écriture. Côté serveur, un dossier au nom de l’utilisateur est créé.',
  ] }),

  block('heading', { level: 2, text: '📜 Script d’ouverture de session' }),
  block('html', { html: '<p>Pour <strong>monter automatiquement un lecteur réseau</strong> à l’ouverture de session, on utilise un petit <strong>script <code>.bat</code></strong> avec la commande <strong><code>net use</code></strong> :</p>' }),
  block('html', { html: '<pre style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;overflow-x:auto"><code>net use X: \\\\srvad\\Partage\\Administration</code></pre>' }),
  accordion([
    ['1 · Tester la commande', '<p>Dans l’invite de commandes du client, taper la commande adaptée à ton cas. Le lecteur doit se monter en <code>X:</code> (vérifier dans « Ce PC »). Puis le déconnecter (clic droit → Déconnecter) : on a juste validé que la commande marche.</p>'],
    ['2 · Créer le script au bon endroit', '<p>Placer le script dans le dossier spécial des scripts de session : <code>C:\\Windows\\SYSVOL\\sysvol\\votre.domaine\\scripts</code>. Créer un fichier texte, y mettre la commande, puis renommer l’extension <code>.txt</code> → <strong><code>.bat</code></strong> (afficher les extensions de fichier au besoin).</p><p><em>Pourquoi ici ?</em> Le dossier <strong>SYSVOL</strong> est partagé par défaut et accessible en lecture sur le réseau — parfait pour les scripts d’ouverture de session.</p>'],
    ['3 · Affecter le script à l’utilisateur', '<p>Propriétés du compte → onglet <strong>Profil</strong> → <strong>Script d’ouverture de session</strong> : saisir <strong>uniquement le nom</strong> du script (pas le chemin, puisque le dossier est réservé aux scripts). Ouvrir une session formateur sur le client : le lecteur doit remonter avec la bonne lettre. Tester l’écriture.</p>'],
  ]),
  note('green', '💡 Et aujourd’hui ?', '<p>Le script d’ouverture de session reste valable, mais en production on préfère souvent déployer les lecteurs réseau par <strong>stratégie de groupe (GPO)</strong> — plus souple et centralisé.</p>'),

  block('heading', { level: 2, text: '⏳ Expiration de compte' }),
  block('html', { html: '<p>Pour un compte temporaire (stagiaire, prestataire), on définit une <strong>date d’expiration</strong> : propriétés du compte → onglet <strong>Compte</strong> → <strong>Le compte expire</strong> → « Fin de ». Passée cette date, le compte est <strong>inutilisable</strong> (réactivable en repoussant la date).</p>' }),
  note('yellow', '🧪 Test rapide', '<p>Créer un compte <code>stagiaire_test</code>, régler l’expiration à <strong>hier</strong>, puis tenter de se connecter → l’ouverture de session doit être <strong>refusée</strong>.</p>'),

  block('heading', { level: 2, text: '🖥️ Administration à distance du serveur' }),
  block('html', { html: '<p>Un technicien accède rarement à la machine physique : on active le <strong>Bureau à distance</strong> sur le serveur pour l’administrer via le réseau avec le compte administrateur. Pas-à-pas détaillé dans l’astuce dédiée : <a href="/pages/astuce-bureau-a-distance">Activer le Bureau à distance (RDP)</a>.</p>' }),

  block('heading', { level: 2, text: '🙈 Énumération basée sur l’accès (ABE)' }),
  block('html', { html: '<p>Par défaut, toute l’arborescence d’un partage est <strong>visible</strong>, même les dossiers auxquels l’utilisateur n’a pas accès (tentation de « fouiner »). L’<strong>Énumération Basée sur l’Accès (ABE)</strong> <strong>masque automatiquement</strong> les dossiers sur lesquels l’utilisateur n’a <strong>aucun droit</strong>.</p>' }),
  block('list', { listItems: [
    'Elle ne se trouve PAS dans l’onglet Partage : aller dans le Gestionnaire de serveur → rôle Services de fichiers → clic droit sur le partage (ex. « Partage ») → Propriétés → menu « Paramètres » → cocher « Activer l’énumération basée sur l’accès » → Appliquer.',
    'Tester depuis plusieurs utilisateurs : les dossiers interdits doivent disparaître de l’arborescence.',
  ] }),
  note('blue', 'ℹ️ Repose sur le NTFS', '<p>ABE masque en fonction des <strong>droits NTFS</strong>. Si un dossier reste visible alors qu’il ne devrait pas, c’est que les droits NTFS sont <strong>trop permissifs</strong> — à revoir (voir <a href="/pages/permissions-partage-ntfs">permissions NTFS</a>).</p>'),

  block('heading', { level: 2, text: '📊 Quotas (Gestionnaire de ressources du serveur de fichiers)' }),
  block('html', { html: '<p>Les <strong>quotas</strong> limitent l’espace disque d’un dossier/partage. Ils nécessitent le rôle <strong>« Gestionnaire de ressources du serveur de fichiers » (FSRM)</strong> (sous <em>Services de fichiers et de stockage</em>). Une fois installé, on gère les quotas depuis le Gestionnaire de serveur ou l’outil <strong>FSRM</strong>.</p>' }),
  block('list', { listItems: [
    'Attention à sélectionner le bon dossier avant de créer un quota (par défaut c’est le partage sélectionné).',
    'Exemple : quota de 100 Mo sur « Partage », puis quota personnalisé de 10 Mo sur « home$ ». Tester depuis un client.',
    'FSRM propose aussi des seuils de notification et des filtres de fichiers.',
  ] }),
  accordion([
    ['Quota inconditionnel (hard) vs conditionnel (soft) ?', '<p><strong>Inconditionnel</strong> : la limite est <strong>stricte</strong> — impossible d’écrire au-delà (blocage). <strong>Conditionnel</strong> : la limite peut être <strong>dépassée</strong> — elle sert au <strong>suivi et aux alertes</strong> (rapport, e-mail), sans bloquer.</p>'],
    ['Peut-on mettre deux quotas sur un même partage ?', '<p>Pas <strong>deux quotas sur le même dossier</strong>. En revanche, on peut avoir un quota sur un dossier <strong>et</strong> des quotas sur ses <strong>sous-dossiers</strong> (ex. quota automatique appliqué à chaque sous-dossier), qui se cumulent hiérarchiquement.</p>'],
    ['Les seuils de notification', '<p>Un quota déclenche des <strong>seuils</strong> (ex. à 85 %, 95 %, 100 %). À chaque seuil on peut : envoyer un <strong>e-mail</strong>, écrire dans le <strong>journal d’événements</strong>, exécuter une <strong>commande</strong> ou générer un <strong>rapport</strong>.</p>'],
    ['Filtre de fichiers — que peut-on filtrer ?', '<p>Un <strong>filtre de fichiers</strong> autorise/bloque certains <strong>types de fichiers</strong> par extension (ex. exécutables <code>.exe</code>, audio/vidéo <code>.mp3</code>/<code>.avi</code>, archives…). On empêche ainsi de stocker des fichiers non désirés sur le partage.</p>'],
    ['Filtrage actif vs passif ?', '<p><strong>Actif</strong> : <strong>empêche</strong> réellement l’enregistrement des fichiers filtrés (blocage). <strong>Passif</strong> : n’empêche pas, mais <strong>surveille et notifie</strong> (rapport/alerte) — utile pour observer avant de bloquer.</p>'],
  ]),

  note('green', '🎯 À retenir', '<p>Windows Server permet de <strong>suivre l’utilisateur</strong> (profils itinérants, dossier de base), d’<strong>automatiser</strong> (scripts de session / <code>net use</code>), de <strong>restreindre</strong> (horaires, expiration), de <strong>masquer</strong> (ABE) et de <strong>limiter</strong> (quotas FSRM). Toujours penser <strong>chemin réseau</strong> et variable <code>%username%</code>. Pour aller plus loin : <a href="/pages/permissions-partage-ntfs">permissions Partage/NTFS</a>, <a href="/pages/procedure-agdlp">AGDLP</a>, <a href="/pages/astuce-bureau-a-distance">Bureau à distance</a>.</p>'),
];

const PAGE = {
  slug: SLUG,
  title: 'Gestion avancée des utilisateurs & serveur de fichiers',
  excerpt: 'Fonctionnalités avancées Windows Server (TP AD 6) : plages horaires de connexion, profils itinérants, dossier de base, scripts d’ouverture de session (net use), expiration de compte, énumération basée sur l’accès (ABE) et quotas (FSRM).',
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

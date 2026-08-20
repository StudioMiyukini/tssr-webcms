/* Cours « Les lecteurs réseau » (Software / Serveur de fichiers).
   Monter un partage en lettre de lecteur : net use, New-PSDrive, et surtout les
   préférences de stratégie de groupe (Drive Maps) avec ciblage par groupe — la
   méthode qu'on attend en entreprise. Dépannage des cas qui reviennent.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-lecteurs-reseau.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = {
  slug: 'lecteurs-reseau',
  title: 'Les lecteurs réseau',
  excerpt: 'Monter un dossier partagé en lettre de lecteur : le chemin UNC, net use et New-PSDrive, puis la méthode d’entreprise — les préférences de stratégie de groupe (Drive Maps) avec ciblage par groupe. Pourquoi un lecteur n’apparaît pas, pourquoi il apparaît barré, et pourquoi un espace de noms DFS finit par devenir indispensable.',
};

const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const styleBlock = block('html', { html: `<style>.lr-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}.lr-t{border-collapse:collapse;width:100%;font-size:13px;margin:6px 0}.lr-t th,.lr-t td{border:1px solid var(--border);padding:7px 10px;text-align:left;vertical-align:top}.lr-t th{background:var(--surface-2)}.lr-flow{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:12px;margin:8px 0;white-space:pre;overflow-x:auto;font-size:12px;line-height:1.5}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="lr-cmd">${esc(t)}</div>` });
const flow = (t: string) => block('html', { html: `<div class="lr-flow">${esc(t)}</div>` });

const blocks: PageBlock[] = [
  block('hero', {
    eyebrow: 'Cours · Windows / Serveur de fichiers',
    title: PAGE.title,
    subtitle: 'Donner une lettre à un dossier qui n’est pas sur la machine — et faire en sorte qu’elle soit là au bon moment, pour les bonnes personnes.',
  }),
  styleBlock,

  block('html', { html: '<p>Un <strong>lecteur réseau</strong> n’est pas un disque. C’est un <strong>raccourci</strong> : une lettre (<code>S:</code>, <code>P:</code>…) qui pointe vers un dossier partagé hébergé ailleurs. Rien n’est copié sur le poste ; chaque ouverture de fichier passe par le réseau.</p><p>On pourrait s’en passer et taper le chemin complet à chaque fois. On ne le fait pas, pour trois raisons : les utilisateurs retiennent <code>S:</code> et pas <code>\\\\SRV-FICHIERS\\Comptabilite$</code>, les documents et les modèles enregistrent des chemins qui doivent rester valables, et surtout le lecteur permet de <strong>donner à chacun ce qui le concerne</strong> sans lui montrer le reste.</p>' }),

  block('heading', { level: 2, text: '1) Le chemin UNC : ce que la lettre cache' }),
  block('html', { html: '<p>Avant la lettre, il y a le chemin. La convention <strong>UNC</strong> (<em>Universal Naming Convention</em>) désigne une ressource sur le réseau :</p>' }),
  flow(`\\\\SRV-FICHIERS\\Comptabilite\\Budgets\\2026.xlsx
  │            │            └─ chemin DANS le partage
  │            └─ nom du PARTAGE (pas forcément celui du dossier)
  └─ nom du serveur (ou son IP, ou un espace de noms DFS)`),
  note('blue', '💡 Le nom du partage n’est pas le nom du dossier', '<p><code>E:\\Donnees\\Compta</code> peut être publié sous le nom <code>Comptabilite</code>. Côté réseau, seul le nom du partage existe : personne ne sait, ni n’a besoin de savoir, où le dossier se trouve réellement sur le serveur. C’est ce qui permet de déplacer les données d’un volume à l’autre sans rien changer chez les utilisateurs.</p>'),
  note('gray', '🔒 Le partage caché, terminé par <code>$</code>', '<p>Un partage dont le nom finit par <code>$</code> (<code>Profils$</code>, <code>Compta$</code>) n’apparaît pas dans la liste quand on parcourt <code>\\\\SRV-FICHIERS</code>. Il reste parfaitement accessible si on tape son chemin. <strong>Ce n’est pas une sécurité</strong> — c’est du rangement. Ce qui protège, ce sont les droits NTFS.</p>'),

  block('heading', { level: 2, text: '2) À la main : net use et New-PSDrive' }),
  block('html', { html: '<p>Deux commandes font le même travail. La première est historique et se rencontre partout ; la seconde est celle de PowerShell.</p>' }),
  cmd(`REM --- Monter, pour cette session seulement ---
net use S: \\\\SRV-FICHIERS\\Comptabilite

REM --- Monter, et le retrouver aux prochaines ouvertures de session ---
net use S: \\\\SRV-FICHIERS\\Comptabilite /persistent:yes

REM --- Voir ce qui est monté, et démonter ---
net use
net use S: /delete`),
  cmd(`# PowerShell
New-PSDrive -Name S -PSProvider FileSystem -Root '\\\\SRV-FICHIERS\\Comptabilite' -Persist
Get-PSDrive -PSProvider FileSystem
Remove-PSDrive -Name S`),
  note('yellow', '⚠️ Sans <code>-Persist</code>, le lecteur ne survit pas à la session PowerShell', '<p><code>New-PSDrive</code> crée par défaut un lecteur <strong>visible de PowerShell uniquement</strong>, qui disparaît avec la console. L’Explorateur ne le voit pas. C’est le premier étonnement du débutant : « je l’ai monté, il n’est pas là ». Avec <code>-Persist</code>, c’est un vrai lecteur réseau Windows, et la lettre est réservée pour l’utilisateur.</p>'),

  note('red', '🚫 Pourquoi on ne fait pas ça en entreprise', '<p>À la main, il faut passer sur chaque poste. Dans un script d’ouverture de session, il faut écrire la logique « qui a droit à quoi » en code, la maintenir, et la déboguer sans la voir. Les deux méthodes existent encore, et on les rencontre — mais la méthode attendue aujourd’hui, c’est la <strong>préférence de stratégie de groupe</strong>.</p>'),

  block('heading', { level: 2, text: '3) La méthode d’entreprise : les préférences de GPO' }),
  block('html', { html: '<p>Dans une GPO, sous <strong>Configuration utilisateur → Préférences → Paramètres Windows → Mappages de lecteurs</strong>, on décrit le lecteur au lieu de le programmer. Deux choses distinguent cette méthode de toutes les autres : le <strong>ciblage au niveau de l’élément</strong>, et le fait que la préférence se <strong>réapplique</strong> à chaque actualisation.</p>' }),
  flow(`GPO « Lecteurs metiers »
  ├─ S:  \\\\SRV-FICHIERS\\Comptabilite     ciblage : membre de G_Comptables
  ├─ S:  \\\\SRV-FICHIERS\\Commercial       ciblage : membre de G_Commerciaux
  └─ P:  \\\\SRV-FICHIERS\\Perso\\%username%  pour tout le monde

  La MEME lettre sert plusieurs services : chacun voit la sienne,
  et personne n'apprend l'existence des autres.`),

  block('heading', { level: 3, text: 'Les quatre actions, et celle qu’il faut choisir' }),
  block('html', { html: '<table class="lr-t"><thead><tr><th>Action</th><th>Ce qu’elle fait</th><th>Quand</th></tr></thead><tbody><tr><td><strong>Créer</strong></td><td>Crée le lecteur s’il n’existe pas. Ne corrige jamais un lecteur existant.</td><td>Rarement : une cible modifiée ne sera pas prise en compte.</td></tr><tr><td><strong>Mettre à jour</strong></td><td>Crée s’il manque, corrige s’il diffère.</td><td><strong>Le choix par défaut.</strong> C’est celui qu’on veut presque toujours.</td></tr><tr><td><strong>Remplacer</strong></td><td>Supprime puis recrée à chaque application.</td><td>Quand un lecteur a été bricolé à la main sur les postes.</td></tr><tr><td><strong>Supprimer</strong></td><td>Retire la lettre.</td><td>Pour reprendre une lettre distribuée par erreur.</td></tr></tbody></table>' }),
  note('yellow', '⚠️ « Créer » est le piège classique', '<p>Le lecteur est mappé une première fois, tout fonctionne. Six mois plus tard on change le serveur cible dans la GPO… et rien ne bouge sur les postes où le lecteur existe déjà. <strong>Mettre à jour</strong> aurait corrigé. Devant un lecteur qui pointe encore vers l’ancien serveur, c’est la première chose à vérifier.</p>'),

  block('heading', { level: 3, text: 'Le ciblage au niveau de l’élément' }),
  block('html', { html: '<p>Onglet <strong>Commun</strong> → <em>Ciblage au niveau de l’élément</em>. On y écrit une condition : appartenance à un groupe de sécurité, site AD, système d’exploitation, plage d’adresses IP… Le lecteur n’est appliqué qu’aux utilisateurs qui la remplissent.</p><p>L’intérêt est double : une seule GPO liée à toute l’unité d’organisation suffit, et surtout la règle est <strong>lisible</strong>. « Ce lecteur est pour les comptables » se lit dans l’interface, au lieu de se déduire d’un <code>if</code> dans un script de 200 lignes.</p>' }),

  note('blue', '🧩 Le lien avec AGDLP', '<p>Le ciblage se fait sur un groupe <strong>global</strong> (<code>G_Comptables</code>) : c’est le groupe qui décrit <em>qui sont les gens</em>. Les droits sur le dossier, eux, passent par un groupe de <strong>domaine local</strong> (<code>DL_Compta_M</code>). Voir <a href="/pages/procedure-agdlp">la procédure AGDLP</a> et le <a href="/pages/constructeur-agdlp">constructeur AGDLP</a>, qui génère les deux.</p>'),

  block('heading', { level: 2, text: '4) Le lecteur personnel, avec %username%' }),
  block('html', { html: '<p>Un lecteur par utilisateur se décrit une seule fois, grâce aux variables d’environnement :</p>' }),
  flow(`Emplacement : \\\\SRV-FICHIERS\\Perso$\\%username%
Lettre      : P:
Action      : Mettre a jour
Reconnecter : coche`),
  note('gray', '💡 Dossier de base ou mappage de lecteur ?', '<p>L’onglet <strong>Profil</strong> d’un compte AD propose un « dossier de base » (<em>home</em>) qui monte lui aussi une lettre. Il fait le même travail, en moins souple : pas de ciblage, pas de mise à jour, et il crée le dossier automatiquement — ce qui est pratique, jusqu’au jour où les droits posés par ce mécanisme ne conviennent plus. Une préférence de GPO reste préférable, à condition de créer les dossiers soi-même.</p>'),

  block('heading', { level: 2, text: '5) Quand le nom du serveur devient un problème' }),
  block('html', { html: '<p>Tant qu’on écrit <code>\\\\SRV-FICHIERS\\Comptabilite</code> partout, le nom du serveur est gravé dans la GPO, dans les raccourcis, dans les liens de documents Office et dans les habitudes. Le jour où le serveur est remplacé, tout est à reprendre.</p><p>Un <strong>espace de noms DFS</strong> résout cela : on publie <code>\\\\miyukini.lan\\Partages\\Comptabilite</code>, un chemin logique qui pointe vers le serveur réel. Changer de serveur devient une modification à un seul endroit.</p>' }),
  flow(`Sans DFS                        Avec DFS
\\\\SRV-FICHIERS\\Compta            \\\\miyukini.lan\\Partages\\Compta
        │                                    │
        v                                    v
   le serveur                        la CIBLE, modifiable
   (a changer partout)               (un seul endroit)`),
  note('green', '🔗 Aller plus loin', '<p><a href="/pages/procedure-dfs">Mettre en place un espace de noms DFS</a>.</p>'),

  block('heading', { level: 2, text: '6) Dépannage : ce qui revient tout le temps' }),
  block('html', { html: '<table class="lr-t"><thead><tr><th>Symptôme</th><th>Cause la plus fréquente</th><th>Ce qu’on fait</th></tr></thead><tbody><tr><td>Le lecteur n’apparaît pas</td><td>L’utilisateur vient d’être ajouté au groupe ciblé. Son <strong>jeton</strong> date de son ouverture de session et ne contient pas encore le groupe.</td><td><strong>Fermer la session et la rouvrir.</strong> Un <code>gpupdate /force</code> ne suffit pas : il ne recalcule pas le jeton.</td></tr><tr><td>Le lecteur n’apparaît toujours pas</td><td>La GPO est liée à une UO qui ne contient pas <em>l’objet utilisateur</em>. Les mappages sont en <strong>Configuration utilisateur</strong> : la GPO doit viser l’UO des utilisateurs, pas celle des ordinateurs.</td><td>Vérifier avec <code>gpresult /h rapport.html</code> que la GPO est bien appliquée.</td></tr><tr><td>Une croix rouge sur le lecteur</td><td>Affichage. Windows marque « déconnecté » un lecteur dont la session SMB est en veille, alors qu’un double-clic le réveille.</td><td>Ouvrir le lecteur. S’il s’ouvre, il n’y a rien à réparer.</td></tr><tr><td>« Accès refusé » à l’ouverture</td><td>Le mappage a réussi — c’est le <strong>NTFS</strong> qui refuse. Monter un lecteur ne donne aucun droit.</td><td>Vérifier l’appartenance au groupe de domaine local, et les droits sur le dossier.</td></tr><tr><td>Le lecteur pointe vers l’ancien serveur</td><td>Action <strong>Créer</strong> au lieu de <strong>Mettre à jour</strong>.</td><td>Passer en Mettre à jour ; le lecteur se corrige à la prochaine ouverture de session.</td></tr><tr><td>La lettre est déjà prise</td><td>Une clé USB, ou un lecteur monté à la main, occupe la lettre.</td><td>Choisir des lettres hautes (<code>P:</code> à <code>Z:</code>) et éviter <code>D:</code> et <code>E:</code>.</td></tr></tbody></table>' }),

  cmd(`REM --- Ce qu'on regarde en premier ---
whoami /groups                REM le jeton contient-il le groupe cible ?
gpresult /r                   REM quelles GPO sont appliquees a cet utilisateur ?
net use                       REM que voit reellement la session ?`),

  note('yellow', '🛠️ Le jeton, encore lui', '<p>La moitié des « ça ne marche pas » de cette page se résolvent par une fermeture de session. L’appartenance à un groupe est inscrite dans le jeton d’accès <strong>au moment de l’ouverture</strong> ; ni <code>gpupdate</code>, ni un redémarrage du serveur, ni une modification dans l’annuaire ne le changent. Il faut rouvrir la session — et l’expliquer à l’utilisateur, sinon il rappellera.</p>'),

  block('heading', { level: 2, text: '7) Hors connexion : pratique et redoutable' }),
  block('html', { html: '<p>Un dossier réseau peut être marqué <em>Toujours disponible hors connexion</em> : Windows en garde une copie locale et la synchronise. C’est très utile sur des portables — et c’est aussi la source de conflits de version quand deux personnes modifient le même fichier chacune de son côté, hors ligne. À réserver aux dossiers personnels, rarement aux dossiers partagés d’équipe.</p>' }),

  note('green', '🔗 Cours et outils liés', '<p>Cours : <a href="/pages/permissions-partage-ntfs">Permissions : Partage &amp; NTFS</a>, <a href="/pages/cours-gpo">Les GPO</a>, <a href="/pages/profils-itinerants">Les profils itinérants</a>. Procédures : <a href="/pages/procedure-agdlp">AGDLP de A à Z</a>, <a href="/pages/procedure-dfs">Espace de noms DFS</a>. Outil : <a href="/pages/constructeur-agdlp">Constructeur AGDLP &amp; serveur de fichiers</a>.</p>'),
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

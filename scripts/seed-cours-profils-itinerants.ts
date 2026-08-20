/* Cours « Les profils itinérants Active Directory » (Software / Windows Server).
   Ce qu'est un profil, ce qui le rend itinérant, les droits exacts du partage
   Profils$, le suffixe .V6, la redirection de dossiers, le profil obligatoire,
   et le « profil temporaire » — la panne qui revient toujours.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-profils-itinerants.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = {
  slug: 'profils-itinerants',
  title: 'Les profils itinérants (Active Directory)',
  excerpt: 'Retrouver son bureau, ses raccourcis et ses préférences sur n’importe quel poste du domaine. Ce qu’un profil contient vraiment, les droits exacts du partage Profils$, pourquoi il ne faut jamais créer le dossier à l’avance, le suffixe .V6, et pourquoi la redirection de dossiers accompagne presque toujours un profil itinérant. Avec la panne « profil temporaire » et son traitement.',
};

const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const styleBlock = block('html', { html: `<style>.pi-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}.pi-t{border-collapse:collapse;width:100%;font-size:13px;margin:6px 0}.pi-t th,.pi-t td{border:1px solid var(--border);padding:7px 10px;text-align:left;vertical-align:top}.pi-t th{background:var(--surface-2)}.pi-flow{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:12px;margin:8px 0;white-space:pre;overflow-x:auto;font-size:12px;line-height:1.5}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="pi-cmd">${esc(t)}</div>` });
const flow = (t: string) => block('html', { html: `<div class="pi-flow">${esc(t)}</div>` });

const blocks: PageBlock[] = [
  block('hero', {
    eyebrow: 'Cours · Windows Server / Active Directory',
    title: PAGE.title,
    subtitle: 'Retrouver son environnement sur n’importe quel poste — et comprendre ce que ça coûte à chaque ouverture de session.',
  }),
  styleBlock,

  block('html', { html: '<p>Sur un poste isolé, un profil utilisateur vit dans <code>C:\\Users\\jean.nguyen</code> et n’en sort jamais. Changer de machine, c’est repartir d’un bureau vide. Le <strong>profil itinérant</strong> répond à ça : le profil est stocké sur un serveur, <strong>descendu</strong> sur le poste à l’ouverture de session, et <strong>remonté</strong> à la fermeture.</p>' }),

  flow(`Ouverture de session            Fermeture de session
\\\\SRV\\Profils$\\jean.V6            C:\\Users\\jean
        │  copie vers le poste              │  recopie vers le serveur
        v                                   v
   C:\\Users\\jean                  \\\\SRV\\Profils$\\jean.V6

Tout transite. DEUX FOIS. A chaque session.`),

  note('yellow', '⚠️ La conséquence à retenir avant tout le reste', '<p>Un profil de 4 Go, c’est 4 Go qui traversent le réseau à l’ouverture <strong>et</strong> à la fermeture. Sur vingt postes qui démarrent à 8 h, c’est une salle entière qui attend. Tout le paramétrage sérieux d’un profil itinérant consiste à le <strong>garder petit</strong> — c’est l’objet des sections 5 et 6.</p>'),

  block('heading', { level: 2, text: '1) Ce qu’un profil contient' }),
  block('html', { html: '<table class="pi-t"><thead><tr><th>Élément</th><th>Rôle</th><th>Suit l’utilisateur ?</th></tr></thead><tbody><tr><td><code>NTUSER.DAT</code></td><td>La ruche <code>HKEY_CURRENT_USER</code> : toutes les préférences applicatives.</td><td>Oui — c’est le cœur du profil.</td></tr><tr><td>Bureau, Documents, Images…</td><td>Les fichiers de l’utilisateur.</td><td>Oui, et c’est ce qui pèse. À rediriger.</td></tr><tr><td><code>AppData\\Roaming</code></td><td>Configuration applicative destinée à suivre.</td><td>Oui.</td></tr><tr><td><code>AppData\\Local</code> et <code>LocalLow</code></td><td>Caches, données propres à la machine.</td><td><strong>Non</strong> — exclus par défaut, et c’est voulu.</td></tr><tr><td><code>AppData\\Local\\Temp</code></td><td>Fichiers temporaires.</td><td>Non.</td></tr></tbody></table>' }),
  note('blue', '💡 Pourquoi <code>AppData\\Local</code> ne suit pas', '<p>Il contient des caches liés à <em>cette</em> machine : miniatures, index, données de navigateur. Les faire voyager n’apporterait rien et multiplierait la taille du profil par cinq. Une application qui range mal ses données dans <code>Local</code> alors qu’elles devraient suivre est un défaut de l’application, pas du profil.</p>'),

  block('heading', { level: 2, text: '2) Le partage qui héberge les profils' }),
  block('html', { html: '<p>Les profils vivent dans un dossier partagé dédié. Ses droits sont <strong>particuliers</strong> : ce ne sont pas ceux d’un partage de service ordinaire, et s’en écarter produit exactement la panne de la section 7.</p>' }),

  cmd(`# Sur le serveur de fichiers
New-Item -ItemType Directory -Path 'E:\\Profils' -Force

# Partage cache, controle total au niveau du partage : c'est NTFS qui filtre.
New-SmbShare -Name 'Profils$' -Path 'E:\\Profils' -FullAccess 'Utilisateurs authentifies'`),

  block('html', { html: '<p>Côté <strong>NTFS</strong>, sur <code>E:\\Profils</code> :</p><table class="pi-t"><thead><tr><th>Compte</th><th>Droit</th><th>S’applique à</th></tr></thead><tbody><tr><td>Administrateurs</td><td>Contrôle total</td><td>Ce dossier, sous-dossiers et fichiers</td></tr><tr><td>SYSTEM</td><td>Contrôle total</td><td>Ce dossier, sous-dossiers et fichiers</td></tr><tr><td><strong>Utilisateurs authentifiés</strong></td><td>Lister le dossier · Créer des dossiers · Lecture</td><td><strong>Ce dossier seulement</strong></td></tr></tbody></table>' }),

  note('red', '🚫 Ne crée pas le dossier de l’utilisateur à l’avance', '<p>C’est la faute la plus courante, et elle est contre-intuitive. Quand Windows crée lui-même <code>jean.V6</code>, il en fait l’utilisateur <strong>propriétaire</strong> et lui donne un contrôle total <em>exclusif</em> — personne d’autre n’entre, pas même un autre utilisateur du domaine. Si tu crées le dossier à la main, le propriétaire est <em>toi</em>, et Windows refuse de charger un profil dont l’utilisateur n’est pas propriétaire : il bascule en profil temporaire.</p><p>D’où le droit ci-dessus : <strong>Créer des dossiers, sur ce dossier seulement</strong>. L’utilisateur peut fabriquer le sien, et rien d’autre.</p>'),

  block('heading', { level: 2, text: '3) Déclarer le profil sur le compte' }),
  block('html', { html: '<p>Dans <em>Utilisateurs et ordinateurs Active Directory</em>, onglet <strong>Profil</strong> du compte, champ <em>Chemin du profil</em> :</p>' }),
  flow(`\\\\SRV-FICHIERS\\Profils$\\%username%

  On ecrit %username%, PAS le nom en clair : selectionne plusieurs
  comptes a la fois, la variable se resout pour chacun.
  On n'ecrit PAS le suffixe .V6 : Windows l'ajoute seul.`),
  cmd(`# Le meme reglage, en PowerShell, pour toute une UO
Get-ADUser -SearchBase 'OU=Comptabilite,OU=Utilisateurs,DC=miyukini,DC=lan' -Filter * |
  ForEach-Object { Set-ADUser $_ -ProfilePath "\\\\SRV-FICHIERS\\Profils$\\$($_.SamAccountName)" }

# Verifier
Get-ADUser jean.nguyen -Properties ProfilePath | Select-Object Name, ProfilePath`),

  block('heading', { level: 2, text: '4) Le suffixe .V6, et pourquoi il existe' }),
  block('html', { html: '<p>Le dossier créé sur le serveur s’appelle <code>jean.nguyen.V6</code>. Le suffixe est une <strong>version de format de profil</strong>, et il évite un dégât : un profil écrit par Windows 11 n’est pas lisible par un Windows 7, et le partager entre les deux corromprait les deux.</p><table class="pi-t"><thead><tr><th>Système</th><th>Suffixe</th></tr></thead><tbody><tr><td>Windows XP / 2003</td><td><em>aucun</em></td></tr><tr><td>Windows Vista / 7 / 2008</td><td><code>.V2</code></td></tr><tr><td>Windows 8 / 8.1 / 2012</td><td><code>.V3</code>, <code>.V4</code></td></tr><tr><td>Windows 10 / 11 / 2016+</td><td><code>.V6</code></td></tr></tbody></table><p>Conséquence pratique : un utilisateur qui passe d’un poste Windows 10 à un poste Windows 11 conserve son profil (même V6), mais une migration depuis Windows 7 en crée un nouveau, vide. Ce n’est pas un bug.</p>' }),

  block('heading', { level: 2, text: '5) La redirection de dossiers : le vrai remède' }),
  block('html', { html: '<p>Le profil itinérant copie tout, deux fois par session. La <strong>redirection de dossiers</strong> fait l’inverse : les dossiers lourds ne sont pas copiés, ils <em>vivent</em> sur le serveur et le poste y accède directement.</p>' }),
  flow(`Profil itinerant seul          Profil itinerant + redirection
  Bureau    -> copie                Bureau    -> reste sur le serveur
  Documents -> copie                Documents -> reste sur le serveur
  NTUSER.DAT-> copie                NTUSER.DAT-> copie  (quelques Mo)
  ______________________            ______________________
  4 Go a chaque session             15 Mo a chaque session`),
  block('html', { html: '<p>GPO : <strong>Configuration utilisateur → Stratégies → Paramètres Windows → Redirection de dossiers</strong>. On redirige typiquement Bureau, Documents, Images, Favoris vers <code>\\\\SRV-FICHIERS\\Perso$\\%username%</code>.</p>' }),
  note('blue', '💡 Les deux se complètent, ils ne s’opposent pas', '<p>La redirection s’occupe des <strong>fichiers</strong>, le profil itinérant des <strong>préférences</strong>. Ensemble, on garde l’intérêt du profil sans son coût. Presque toute installation sérieuse fait les deux — et beaucoup n’utilisent plus <em>que</em> la redirection.</p>'),
  note('yellow', '⚠️ Coche « Déplacer le contenu vers le nouvel emplacement »', '<p>Sans elle, la redirection change le chemin mais laisse les fichiers existants sur l’ancien. L’utilisateur voit son Bureau se vider et appelle dans la minute.</p>'),

  block('heading', { level: 2, text: '6) Le profil obligatoire' }),
  block('html', { html: '<p>Un <strong>profil obligatoire</strong> (<em>mandatory</em>) est un profil itinérant en lecture seule : l’utilisateur peut tout modifier pendant sa session, mais rien n’est remonté. À la session suivante, il retrouve exactement le même environnement.</p><p>On l’obtient en renommant <code>NTUSER.DAT</code> en <code>NTUSER.MAN</code> dans le dossier du profil. Usage typique : postes en libre-service, salles de formation, bornes.</p>' }),
  note('gray', '💡 Utile en salle de TP', '<p>Chaque stagiaire repart d’un environnement identique, quoi qu’il ait cassé la veille. En contrepartie, il perd ses réglages : à réserver aux postes qui ne sont à personne.</p>'),

  block('heading', { level: 2, text: '7) « Vous avez été connecté avec un profil temporaire »' }),
  block('html', { html: '<p>La panne emblématique. Windows n’a pas réussi à charger le profil, en a fabriqué un jetable, et <strong>tout ce que l’utilisateur fera pendant cette session sera perdu à la fermeture</strong>. Il faut donc traiter tout de suite — et prévenir l’utilisateur avant qu’il ne travaille.</p><table class="pi-t"><thead><tr><th>Cause</th><th>Comment la reconnaître</th><th>Traitement</th></tr></thead><tbody><tr><td>Le dossier du profil a été créé à la main</td><td>Le propriétaire n’est pas l’utilisateur.</td><td>Rendre la propriété à l’utilisateur, ou supprimer le dossier et le laisser se recréer.</td></tr><tr><td>Droits insuffisants sur le partage</td><td>Le dossier <code>.V6</code> ne se crée pas.</td><td>Reprendre les droits de la section 2.</td></tr><tr><td>Profil local corrompu</td><td>Une clé <code>...bak</code> dans <code>ProfileList</code>.</td><td>Voir la commande ci-dessous.</td></tr><tr><td>Serveur injoignable à l’ouverture</td><td>Réseau lent au démarrage, DNS.</td><td>GPO « Toujours attendre le réseau au démarrage et à l’ouverture de session ».</td></tr><tr><td>Disque plein sur le poste</td><td>Le profil ne peut pas être descendu.</td><td>Libérer de l’espace.</td></tr></tbody></table>' }),
  cmd(`# Le SID de l'utilisateur concerne
whoami /user

# Les profils connus de CE poste : une entree en .bak signale la corruption
Get-ChildItem 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\ProfileList' |
  Select-Object PSChildName, @{n='Chemin';e={ $_.GetValue('ProfileImagePath') }}

# Qui possede le dossier du profil sur le serveur ?
(Get-Acl '\\\\SRV-FICHIERS\\Profils$\\jean.nguyen.V6').Owner`),
  note('red', '🚫 Avant de supprimer un profil', '<p>Passe par <strong>Système → Paramètres système avancés → Profils des utilisateurs → Supprimer</strong>, jamais par une suppression manuelle du dossier <code>C:\\Users\\…</code>. La suppression manuelle laisse les entrées de registre en place, et la panne revient à l’identique — souvent en pire, avec un dossier <code>jean.nguyen.MIYUKINI</code> à côté.</p>'),

  block('heading', { level: 2, text: '8) Les GPO qui accompagnent' }),
  block('html', { html: '<p><em>Configuration ordinateur → Stratégies → Modèles d’administration → Système → Profils utilisateur</em> :</p><table class="pi-t"><thead><tr><th>Paramètre</th><th>Ce qu’il évite</th></tr></thead><tbody><tr><td>Supprimer les copies mises en cache des profils itinérants</td><td>Des dizaines de profils qui s’accumulent sur chaque poste et remplissent le disque.</td></tr><tr><td>Exclure des répertoires du profil itinérant</td><td>Un dossier lourd qui fait traîner chaque session (caches applicatifs, corbeille d’un logiciel métier).</td></tr><tr><td>Ne pas vérifier l’appartenance au groupe Administrateurs local</td><td>Le refus de charger un profil sur un poste où l’utilisateur n’est pas administrateur.</td></tr><tr><td>Attendre le réseau distant à l’ouverture de session</td><td>Le profil temporaire des postes dont la carte réseau démarre après la session.</td></tr></tbody></table>' }),

  note('green', '🎓 Ce qu’on attend de toi', '<p>Savoir <strong>poser les droits du partage sans les copier d’un autre partage</strong> (ils sont particuliers), expliquer <strong>pourquoi on ne crée pas le dossier à l’avance</strong>, et reconnaître un profil temporaire avant que l’utilisateur n’ait travaillé une demi-journée dessus.</p>'),

  note('green', '🔗 Cours et outils liés', '<p>Cours : <a href="/pages/permissions-partage-ntfs">Permissions : Partage &amp; NTFS</a>, <a href="/pages/lecteurs-reseau">Les lecteurs réseau</a>, <a href="/pages/cours-gpo">Les GPO</a>, <a href="/pages/gestion-avancee-utilisateurs">Gestion avancée des utilisateurs</a>. Outil : <a href="/pages/constructeur-agdlp">Constructeur AGDLP &amp; serveur de fichiers</a>.</p>'),
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

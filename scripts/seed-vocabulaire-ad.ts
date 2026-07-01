/* Page « Vocabulaire Active Directory (AD) » : glossaire commenté des termes vus pendant
   l'installation d'AD DS et la promotion en contrôleur de domaine, en 3 sections (serveur /
   contrôleur de domaine / domaine), en accordéons « question → réponse » (révision + corrigé).
   Source : document à trou « Vocabulaire Domaine » (Adrar) — les définitions y étaient vides.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-vocabulaire-ad.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const srcLabel = (url: string) => /rfc-editor/.test(url) ? `RFC ${(url.match(/rfc(\d+)/) || [])[1]} · IETF` : 'Microsoft Learn';
const srcFooter = (url: string) => url ? `<p class="meta" style="margin:10px 0 0;font-size:13px">🔗 Source&nbsp;: <a href="${url}" target="_blank" rel="noopener noreferrer">${srcLabel(url)}</a></p>` : '';
const accordion = (it: Array<[string, string, string?]>) => block('accordion', { items: it.map(([title, text, src]) => ({ title, text: text + srcFooter(src || ''), href: '' })) });

// ===================================================================================
// Schémas SVG (responsive, palette du thème)
// ===================================================================================
const C = { forest: '#7c3aed', tree: '#0d9488', dom: '#2563eb', ou: '#d97706', obj: '#16a34a', grey: '#64748b', slate: '#475569', danger: '#dc2626' };
const wrap = (w: number, h: number, inner: string) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="max-width:${w}px;width:100%;height:auto;margin:8px 0 14px;font-family:system-ui,sans-serif">${inner}</svg>`;
const box = (x: number, y: number, w: number, h: number, col: string, label: string, sub = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="${col}" fill-opacity="0.07" stroke="${col}" stroke-width="1.6"/>`
  + `<text x="${x + 12}" y="${y + 20}" font-size="12.5" fill="${col}" font-weight="bold">${label}</text>`
  + (sub ? `<text x="${x + 12}" y="${y + 36}" font-size="10.5" fill="${C.slate}">${sub}</text>` : '');

// Icônes objets AD
const icUser = (cx: number, cy: number) => `<g fill="${C.obj}"><circle cx="${cx}" cy="${cy - 6}" r="6"/><path d="M${cx - 9} ${cy + 9} a9 9 0 0 1 18 0 z"/></g>`;
const icPC = (cx: number, cy: number) => `<g fill="${C.dom}"><rect x="${cx - 10}" y="${cy - 8}" width="20" height="14" rx="2"/><rect x="${cx - 4}" y="${cy + 6}" width="8" height="3"/></g>`;
const icGroup = (cx: number, cy: number) => `<g fill="${C.forest}"><circle cx="${cx - 5}" cy="${cy - 5}" r="5"/><circle cx="${cx + 5}" cy="${cy - 5}" r="5"/><path d="M${cx - 13} ${cy + 7} a8 8 0 0 1 16 0 z" opacity="0.55"/><path d="M${cx - 3} ${cy + 7} a8 8 0 0 1 16 0 z"/></g>`;

// 1) Hiérarchie logique : Forêt ⊃ Arbre ⊃ Domaine ⊃ OU ⊃ Objets
const svgHierarchy = wrap(640, 300,
  box(8, 8, 624, 284, C.forest, '🌲 Forêt', 'schéma + configuration + catalogue global communs')
  + box(26, 48, 588, 232, C.tree, '🌳 Arbre de domaines', 'espace de noms contigu + approbations automatiques')
  + box(42, 86, 286, 184, C.dom, '🏢 Domaine — entreprise.local')
  + box(344, 86, 254, 184, C.dom, '🏢 Domaine enfant', 'paris.entreprise.local')
  + box(56, 124, 258, 134, C.ou, '📁 UO — Comptabilité')
  + icUser(96, 196) + `<text x="96" y="222" text-anchor="middle" font-size="9.5" fill="${C.slate}">user</text>`
  + icPC(185, 196) + `<text x="185" y="222" text-anchor="middle" font-size="9.5" fill="${C.slate}">computer</text>`
  + icGroup(274, 196) + `<text x="274" y="222" text-anchor="middle" font-size="9.5" fill="${C.slate}">group</text>`
  + `<text x="160" y="248" text-anchor="middle" font-size="10" fill="${C.ou}" font-weight="bold">objets de l’annuaire</text>`
  + `<text x="471" y="180" text-anchor="middle" font-size="10.5" fill="${C.slate}">+ ses propres UO,</text>`
  + `<text x="471" y="196" text-anchor="middle" font-size="10.5" fill="${C.slate}">comptes et groupes</text>`);

// 2) Flux Kerberos : Client ↔ KDC (AS+TGS) puis Client ↔ Serveur
const arrow = (x1: number, y: number, x2: number, txt: string, col: string, dash = false) => {
  const dir = x2 > x1 ? 1 : -1;
  return `<line x1="${x1}" y1="${y}" x2="${x2 - dir * 7}" y2="${y}" stroke="${col}" stroke-width="2"${dash ? ' stroke-dasharray="5 4"' : ''}/>`
    + `<path d="M${x2} ${y} l${-dir * 8} -4 l0 8 z" fill="${col}"/>`
    + `<text x="${(x1 + x2) / 2}" y="${y - 6}" text-anchor="middle" font-size="10.5" fill="${C.slate}">${txt}</text>`;
};
const svgKerberos = wrap(640, 300,
  // têtes d'acteurs
  `<rect x="40" y="12" width="120" height="30" rx="6" fill="${C.obj}"/><text x="100" y="32" text-anchor="middle" font-size="12" fill="#fff" font-weight="bold">👤 Client</text>`
  + `<rect x="262" y="12" width="160" height="30" rx="6" fill="${C.forest}"/><text x="342" y="26" text-anchor="middle" font-size="11.5" fill="#fff" font-weight="bold">🗝️ KDC (sur le DC)</text><text x="342" y="38" text-anchor="middle" font-size="9.5" fill="#fff">AS + TGS</text>`
  + `<rect x="500" y="12" width="120" height="30" rx="6" fill="${C.dom}"/><text x="560" y="32" text-anchor="middle" font-size="12" fill="#fff" font-weight="bold">🖥️ Serveur</text>`
  // lignes de vie
  + [100, 342, 560].map(x => `<line x1="${x}" y1="42" x2="${x}" y2="288" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="3 4"/>`).join('')
  + arrow(100, 78, 342, '① Connexion (preuve du mot de passe)', C.slate)
  + arrow(342, 110, 100, 'TGT (laissez-passer ~10 h)', C.forest, true)
  + arrow(100, 152, 342, '② « je veux le serveur » + TGT', C.slate)
  + arrow(342, 184, 100, 'Ticket de service', C.forest, true)
  + arrow(100, 226, 560, '③ Accès + Ticket de service', C.slate)
  + arrow(560, 258, 100, 'OK ✓ (sans mot de passe)', C.dom, true));

// 3) Stratégie AGDLP : Comptes → Global → Domaine Local → Permissions
const agdlpBox = (x: number, w: number, col: string, big: string, small: string) =>
  `<rect x="${x}" y="34" width="${w}" height="58" rx="9" fill="${col}"/><text x="${x + w / 2}" y="60" text-anchor="middle" font-size="15" fill="#fff" font-weight="bold">${big}</text><text x="${x + w / 2}" y="80" text-anchor="middle" font-size="10" fill="#fff">${small}</text>`;
const agdlpArrow = (x: number) => `<path d="M${x} 63 l16 0 m-6 -5 l6 5 l-6 5" stroke="${C.slate}" stroke-width="2" fill="none"/>`;
const svgAgdlp = wrap(640, 120,
  agdlpBox(8, 150, C.obj, 'A — Comptes', 'utilisateurs / ordinateurs')
  + agdlpArrow(160)
  + agdlpBox(184, 140, C.dom, 'G — Global', 'groupe par métier')
  + agdlpArrow(326)
  + agdlpBox(350, 150, C.ou, 'DL — Domaine local', 'groupe par ressource')
  + agdlpArrow(502)
  + agdlpBox(524, 108, C.forest, 'P — Permission', 'sur la ressource')
  + `<text x="320" y="112" text-anchor="middle" font-size="10.5" fill="${C.slate}">On place les comptes (A) dans un groupe Global (G), qu’on met dans un groupe Domaine Local (DL), auquel on accorde la Permission (P).</text>`);

// ===================================================================================
// PAGE
// ===================================================================================
const SLUG = 'vocabulaire-active-directory';
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Windows Server', title: 'Vocabulaire Active Directory (AD)', subtitle: 'Tous les termes clés rencontrés à l’installation d’AD DS et à la promotion en contrôleur de domaine.' }),
  block('html', { html: '<p>Installer <strong>Active Directory</strong> impose de maîtriser un vocabulaire précis : rôle, forêt, domaine, contrôleur de domaine, schéma, objet, OU… Cette page <strong>définit chaque terme</strong>, regroupé selon le moment où on le rencontre. Chaque entrée est <strong>repliée</strong> : lis la question, essaie de répondre, puis <strong>clique pour vérifier</strong>.</p>' }),
  note('blue', '🧰 Prérequis & cours liés', '<p>À lire avant ou en parallèle : <a href="/pages/windows-server">Windows Server (rôles vs fonctionnalités)</a>, <a href="/pages/roles-windows-server">les rôles de Windows Server</a> et <a href="/pages/gestionnaire-de-serveurs">le gestionnaire de serveurs</a>. Les sigles réseau sont dans le <a href="/glossaire">Glossaire</a>.</p>'),

  block('heading', { level: 2, text: '🗺️ Vue d’ensemble : la structure logique d’AD' }),
  block('html', { html: '<p>Avant les définitions, une image mentale. Active Directory s’emboîte comme des <strong>poupées russes</strong>, du plus grand au plus petit : la <strong>forêt</strong> contient des <strong>arbres</strong> de <strong>domaines</strong>, chaque domaine contient des <strong>unités d’organisation (UO)</strong>, qui contiennent les <strong>objets</strong> (utilisateurs, ordinateurs, groupes).</p>' }),
  block('html', { html: svgHierarchy }),

  block('heading', { level: 2, text: '🖥️ 1. Vocabulaire serveur (installation d’AD)' }),
  block('html', { html: '<p>Les notions de base de Windows Server, vues au moment d’ajouter le rôle Active Directory :</p>' }),
  accordion([
    ['Qu’est-ce que le rôle « AD DS » ?', '<p><strong>AD DS</strong> = <em>Active Directory Domain Services</em> (Services de domaine Active Directory). C’est le <strong>rôle Windows Server qui fournit l’annuaire Active Directory</strong> : il transforme un serveur en <strong>contrôleur de domaine</strong>, stocke les objets (utilisateurs, ordinateurs, groupes) et assure l’<strong>authentification</strong> et les <strong>autorisations</strong> de façon centralisée.</p>', 'https://learn.microsoft.com/fr-fr/windows-server/identity/ad-ds/get-started/virtual-dc/active-directory-domain-services-overview'],
    ['Qu’est-ce qu’un « rôle » ?', '<p>Un <strong>rôle</strong> est la <strong>fonction principale</strong> qu’un serveur assure pour le réseau (AD DS, DNS, DHCP, serveur web IIS, Hyper-V…). On installe un rôle pour que le serveur <strong>rende un service précis</strong>. <em>Analogie : le métier principal du serveur.</em> Détails : <a href="/pages/roles-windows-server">les rôles de Windows Server</a>.</p>', 'https://learn.microsoft.com/fr-fr/windows-server/administration/server-core/server-core-roles-and-services'],
    ['Qu’est-ce qu’une « fonctionnalité » ?', '<p>Une <strong>fonctionnalité</strong> est un <strong>composant complémentaire</strong> qui ajoute ou soutient des capacités, <strong>sans être le but principal</strong> du serveur (ex. .NET Framework, Sauvegarde Windows Server, BitLocker, clustering de basculement). <em>Le rôle = la mission ; la fonctionnalité = l’outil de support.</em></p>', 'https://learn.microsoft.com/fr-fr/windows-server/administration/server-core/server-core-roles-and-services'],
    ['Qu’est-ce qu’un « service de rôle » ?', '<p>Un <strong>service de rôle</strong> est une <strong>sous-partie d’un rôle</strong>, qu’on peut activer séparément. Exemple : le rôle « Services de fichiers et de stockage » contient les services de rôle « Espaces de noms DFS », « Déduplication des données »… On n’installe que ce dont on a besoin.</p>', 'https://learn.microsoft.com/fr-fr/windows-server/administration/server-core/server-core-roles-and-services'],
    ['Qu’est-ce qu’un « AD » ?', '<p>L’<strong>Active Directory</strong> est l’<strong>annuaire centralisé</strong> de Microsoft : une <strong>base de données</strong> + des <strong>services</strong> qui répertorient toutes les ressources du réseau (utilisateurs, ordinateurs, groupes, imprimantes…) et <strong>centralisent</strong> l’authentification, les droits et l’administration. <em>Analogie : l’annuaire + le service RH d’une entreprise.</em></p>', 'https://learn.microsoft.com/fr-fr/windows/win32/ad/about-active-directory-domain-services'],
    ['Pourquoi faut-il le « DNS » ?', '<p>Active Directory <strong>repose sur le DNS</strong>. Les clients (et les contrôleurs de domaine) <strong>localisent les DC (<em>Domain Controllers</em>, contrôleurs de domaine) grâce à des enregistrements DNS</strong> (enregistrements SRV). Sans DNS qui fonctionne : pas d’ouverture de session sur le domaine, pas de réplication. Le DNS traduit aussi les <strong>noms en adresses IP</strong> (voir <a href="/pages/notions-complementaires">notions réseau</a>).</p>', 'https://learn.microsoft.com/fr-fr/windows-server/identity/ad-ds/plan/dns-and-ad-ds'],
  ]),

  block('heading', { level: 2, text: '🏢 2. Promotion en contrôleur de domaine' }),
  block('html', { html: '<p>Le vocabulaire de la <strong>structure du domaine</strong> et de l’annuaire, rencontré en promouvant le serveur en contrôleur de domaine :</p>' }),
  accordion([
    ['Pour comparaison : qu’est-ce qu’un groupe de travail (workgroup) ?', '<p>Un <strong>groupe de travail</strong> est un modèle <strong>décentralisé</strong> : chaque PC gère ses <strong>propres comptes locaux</strong>, sans autorité centrale. Simple mais ingérable au-delà de quelques postes. C’est <strong>l’opposé du domaine</strong> (qui, lui, est centralisé).</p>', 'https://learn.microsoft.com/fr-fr/windows-server/identity/ad-fs/deployment/join-a-computer-to-a-domain'],
    ['Qu’est-ce qu’un « domaine » ?', '<p>Un <strong>domaine</strong> est un <strong>regroupement logique d’objets</strong> (utilisateurs, ordinateurs, groupes) qui partagent une <strong>même base d’annuaire</strong>, une <strong>politique de sécurité</strong> et une <strong>authentification centralisée</strong>. Il est identifié par un <strong>nom DNS</strong> (ex. <code>entreprise.local</code>).</p>', 'https://learn.microsoft.com/fr-fr/windows-server/identity/ad-ds/get-started/virtual-dc/active-directory-domain-services-overview'],
    ['À quoi sert un domaine ?', '<p>À <strong>centraliser</strong> : comptes et sécurité au même endroit, <strong>authentification unique</strong> (un compte pour tous les postes), application de <strong>stratégies de groupe (GPO)</strong>, <strong>administration depuis un point unique</strong> et partage de ressources avec des droits cohérents.</p>', 'https://learn.microsoft.com/fr-fr/windows-server/identity/ad-ds/get-started/virtual-dc/active-directory-domain-services-overview'],
    ['Qu’est-ce qu’un « contrôleur de domaine » (DC) ?', '<p>Un <strong>contrôleur de domaine</strong> est un <strong>serveur qui héberge AD DS</strong> : il stocke une copie de la base d’annuaire, <strong>authentifie</strong> utilisateurs et ordinateurs et applique les stratégies. On en déploie souvent <strong>plusieurs</strong> (tolérance de panne).</p>', 'https://learn.microsoft.com/fr-fr/windows-server/identity/ad-ds/manage/dc-locator'],
    ['Qu’est-ce qu’un « domaine parent / enfant » ?', '<p>Une <strong>hiérarchie de domaines</strong> partageant un espace de noms <strong>contigu</strong>. Ex. parent <code>entreprise.local</code>, enfant <code>paris.entreprise.local</code>. Ensemble, ils forment un <strong>arbre</strong>, avec des <strong>relations d’approbation automatiques</strong>.</p>', 'https://learn.microsoft.com/fr-fr/windows/win32/ad/domain-trees'],
    ['Qu’est-ce qu’une « forêt » ?', '<p>La <strong>forêt</strong> est le <strong>conteneur de plus haut niveau</strong> d’AD : un ou plusieurs <strong>arbres de domaines</strong> partageant un <strong>schéma</strong>, une <strong>configuration</strong> et un <strong>catalogue global</strong> communs. C’est la <strong>limite de sécurité ultime</strong> de l’Active Directory.</p>', 'https://learn.microsoft.com/fr-fr/windows-server/identity/ad-ds/plan/understanding-the-active-directory-logical-model'],
    ['Qu’est-ce que le « niveau fonctionnel » (forêt / domaine) ?', '<p>Le <strong>niveau fonctionnel</strong> est en quelque sorte la <strong>« version » de fonctionnement</strong> de l’Active Directory. Il <strong>fixe la version de Windows Server la plus ancienne autorisée</strong> sur les contrôleurs de domaine, et c’est lui qui <strong>active (ou non) certaines fonctionnalités</strong> d’AD.</p>'
      + '<p><strong>Pourquoi ça existe ?</strong> Dans un même domaine, on peut avoir des DC de versions différentes (ex. un sous Windows Server 2016, un autre sous 2022). Pour que tous se comprennent, AD s’aligne sur un <strong>socle commun</strong>. Tant que ce socle est bas, les fonctions modernes restent <strong>désactivées</strong> — même si certains DC sont récents — car un vieux DC ne saurait pas les gérer.</p>'
      + '<p><strong>Deux niveaux distincts :</strong></p><ul>'
      + '<li><strong>Niveau fonctionnel du domaine</strong> : s’applique à <em>un</em> domaine. Il dépend de la version des DC <strong>de ce domaine</strong>.</li>'
      + '<li><strong>Niveau fonctionnel de la forêt</strong> : s’applique à <strong>toute la forêt</strong>. Il ne peut pas être plus élevé que le plus bas des niveaux de domaine qu’elle contient.</li></ul>'
      + '<p><strong>Exemple concret :</strong> pour passer la forêt au niveau « Windows Server 2016 », <strong>tous</strong> les DC de tous les domaines doivent être au minimum sous Windows Server 2016. Une fois fait, on débloque les fonctions propres à ce niveau.</p>'
      + '<p><strong>À retenir :</strong> on <strong>élève</strong> le niveau au fur et à mesure qu’on remplace les vieux DC ; c’est une opération <strong>généralement irréversible</strong> (on ne redescend pas), donc on attend d’avoir <strong>retiré tous les DC trop anciens</strong> avant de monter.</p>', 'https://learn.microsoft.com/fr-fr/windows-server/identity/ad-ds/active-directory-functional-levels'],
    ['Qu’est-ce qu’un « catalogue global » (GC) ?', '<p>Un rôle porté par un DC : il contient une <strong>copie partielle</strong> (les attributs les plus utilisés) de <strong>tous les objets de tous les domaines</strong> de la forêt. Il <strong>accélère les recherches inter-domaines</strong> et participe aux ouvertures de session.</p>', 'https://learn.microsoft.com/fr-fr/windows/win32/ad/global-catalog'],
    ['Qu’est-ce que le protocole « LDAP » ?', '<p><strong>LDAP</strong> = <em>Lightweight Directory Access Protocol</em>. C’est le <strong>protocole standard pour interroger et modifier l’annuaire</strong> (port <strong>389</strong>, ou <strong>636</strong> en LDAPS chiffré). <em>C’est « la langue » utilisée pour lire et écrire dans Active Directory.</em></p>', 'https://www.rfc-editor.org/rfc/rfc4511'],
    ['Qu’est-ce que « Kerberos » ?', '<p><strong>Kerberos</strong> est le <strong>protocole d’authentification par défaut</strong> d’un domaine Active Directory. Son principe : prouver son identité <strong>une seule fois</strong> à l’ouverture de session, puis présenter des <strong>tickets</strong> pour accéder aux ressources — ainsi le <strong>mot de passe ne circule jamais</strong> sur le réseau à chaque accès.</p>'
      + '<p><strong>Le KDC.</strong> <strong>KDC = <em>Key Distribution Center</em></strong> (« centre de distribution de clés »). <em>C’est le service qui vérifie l’identité des utilisateurs et leur délivre les tickets Kerberos.</em> Sur Windows, il est <strong>hébergé par chaque contrôleur de domaine</strong> et comprend deux parties : l’<strong>AS</strong> (service d’authentification) et le <strong>TGS</strong> (service d’émission de tickets).</p>'
      + '<p><strong>Le TGT (le cœur du système).</strong> <strong>TGT = <em>Ticket-Granting Ticket</em></strong>, le « ticket pour obtenir des tickets ». À la connexion, l’utilisateur s’authentifie auprès du KDC, qui lui remet un <strong>TGT</strong> : une sorte de <strong>laissez-passer temporaire</strong> (valable ~10 h par défaut) prouvant « cet utilisateur est bien authentifié ». Le TGT est <strong>chiffré par le KDC</strong> et l’utilisateur ne peut pas le falsifier.</p>'
      + '<p><strong>Le déroulé, étape par étape :</strong></p><ol>'
      + '<li>L’utilisateur ouvre sa session → le <strong>KDC lui délivre un TGT</strong>.</li>'
      + '<li>Pour accéder à une ressource (un partage de fichiers, par ex.), il <strong>présente son TGT</strong> au TGS et demande un <strong>ticket de service</strong> (<em>Service Ticket</em>) propre à cette ressource.</li>'
      + '<li>Il présente ce <strong>ticket de service</strong> au serveur visé, qui l’accepte <strong>sans jamais revoir le mot de passe</strong>.</li></ol>'
      + '<p><em>Analogie :</em> le TGT est le <strong>bracelet d’entrée d’un festival</strong> (obtenu une fois, à l’accueil, sur présentation de la pièce d’identité). Ensuite, à chaque stand, on montre le bracelet pour récupérer un <strong>ticket</strong> spécifique (boisson, concert…) sans remontrer sa carte d’identité.</p>'
      + '<p>⚠️ <strong>Sensible à l’heure :</strong> les tickets sont horodatés ; si l’horloge d’une machine <strong>diffère de plus de 5 minutes</strong> de celle du DC, l’authentification <strong>échoue</strong> — d’où l’importance de la <strong>synchronisation du temps</strong> dans le domaine. Port utilisé : <strong>88</strong>.</p>'
      + svgKerberos
      + '<p><strong>Protocole, service ou ticket ? Ne pas confondre :</strong></p>'
      + '<div style="overflow-x:auto;margin:6px 0 4px"><table style="border-collapse:collapse;width:100%;min-width:480px;font-size:13.5px"><thead><tr style="background:var(--surface-2)"><th style="text-align:left;padding:7px 10px;border:1px solid var(--border)">Terme</th><th style="text-align:left;padding:7px 10px;border:1px solid var(--border)">Nature</th><th style="text-align:left;padding:7px 10px;border:1px solid var(--border)">C’est quoi</th></tr></thead><tbody>'
      + '<tr><td style="padding:7px 10px;border:1px solid var(--border);font-weight:700">Kerberos</td><td style="padding:7px 10px;border:1px solid var(--border)">Protocole</td><td style="padding:7px 10px;border:1px solid var(--border)">L’ensemble des règles d’authentification par tickets.</td></tr>'
      + '<tr><td style="padding:7px 10px;border:1px solid var(--border);font-weight:700">KDC</td><td style="padding:7px 10px;border:1px solid var(--border)">Service</td><td style="padding:7px 10px;border:1px solid var(--border)">Le programme (sur le DC) qui délivre les tickets. <em>Pas</em> une fonctionnalité Windows à cocher : il est intégré au rôle AD DS.</td></tr>'
      + '<tr><td style="padding:7px 10px;border:1px solid var(--border);font-weight:700">TGT</td><td style="padding:7px 10px;border:1px solid var(--border)">Ticket (donnée)</td><td style="padding:7px 10px;border:1px solid var(--border)">Un jeton chiffré (un laissez-passer), pas un programme.</td></tr>'
      + '</tbody></table></div>', 'https://www.rfc-editor.org/rfc/rfc4120'],
    ['Qu’est-ce qu’un « schéma AD » ?', '<p>Le <strong>schéma</strong> est la <strong>définition de la structure</strong> de l’annuaire : la liste de <strong>toutes les classes d’objets</strong> et de <strong>tous les attributs</strong> possibles. Il est <strong>commun à toute la forêt</strong>. <em>Analogie : le plan / le modèle de la base de données.</em></p>', 'https://learn.microsoft.com/fr-fr/windows/win32/ad/active-directory-schema'],
    ['Qu’est-ce qu’une « classe AD » ?', '<p>Une <strong>classe</strong> est un <strong>type d’objet</strong> défini dans le schéma (ex. <code>user</code>, <code>computer</code>, <code>group</code>). Elle décrit <strong>quels attributs</strong> possède un objet de ce type. <em>Analogie : le moule.</em></p>', 'https://learn.microsoft.com/fr-fr/windows/win32/ad/object-class-and-object-category'],
    ['Qu’est-ce qu’un « objet AD » ?', '<p>Un <strong>objet</strong> est une <strong>instance concrète d’une classe</strong> — une entité réelle de l’annuaire : <em>un</em> utilisateur précis, <em>un</em> ordinateur, <em>un</em> groupe. <em>Analogie : la pièce sortie du moule.</em></p>', 'https://learn.microsoft.com/fr-fr/windows/win32/ad/object-names-and-identities'],
    ['Qu’est-ce qu’un « attribut » ?', '<p>Un <strong>attribut</strong> est une <strong>propriété d’un objet</strong> (ex. pour un utilisateur : nom, identifiant de connexion, e-mail, téléphone). Les attributs disponibles pour un objet sont fixés par sa <strong>classe</strong>, via le <strong>schéma</strong>.</p>', 'https://learn.microsoft.com/fr-fr/windows/win32/ad/characteristics-of-attributes'],
    ['Que sont des « sites AD » ?', '<p>Les <strong>sites</strong> représentent la <strong>topologie physique</strong> du réseau (par emplacement géographique / sous-réseaux IP). Ils servent à <strong>optimiser la réplication</strong> entre DC et à <strong>diriger chaque client vers le DC le plus proche</strong>.</p>', 'https://learn.microsoft.com/fr-fr/windows-server/identity/ad-ds/plan/understanding-active-directory-site-topology'],
  ]),

  block('heading', { level: 2, text: '📁 3. Vocabulaire général lié au domaine' }),
  block('html', { html: '<p>Les objets et notions manipulés au quotidien pour <strong>administrer</strong> le domaine :</p>' }),
  accordion([
    ['Qu’est-ce qu’un « compte utilisateur du domaine » ?', '<p>L’<strong>identité d’une personne</strong> dans l’AD. Il permet de <strong>s’authentifier sur n’importe quel poste</strong> du domaine et d’accéder aux ressources <strong>selon ses droits</strong>. Géré au niveau du domaine (≠ compte local d’une seule machine).</p>', 'https://learn.microsoft.com/fr-fr/windows-server/identity/ad-ds/manage-user-accounts-in-windows-server'],
    ['Qu’est-ce qu’un « compte ordinateur du domaine » ?', '<p>Chaque <strong>machine jointe au domaine</strong> possède son <strong>propre compte (identité)</strong> dans l’AD. Cela lui permet d’être <strong>authentifiée</strong>, <strong>gérée</strong> et de recevoir les <strong>stratégies de groupe</strong> (GPO).</p>', 'https://learn.microsoft.com/fr-fr/entra/architecture/service-accounts-computer'],
    ['Qu’est-ce qu’un « groupe » ?', '<p>Un <strong>conteneur d’objets</strong> (utilisateurs, ordinateurs, autres groupes) servant à <strong>attribuer des droits collectivement</strong> plutôt qu’un par un. Deux types : <strong>sécurité</strong> (pour les permissions) et <strong>distribution</strong> (listes de diffusion e-mail).</p>', 'https://learn.microsoft.com/fr-fr/windows-server/identity/ad-ds/manage/understand-security-groups'],
    ['Qu’est-ce qu’un groupe « Domaine local / Global / Universel » ?', '<p>Ce sont les <strong>trois portées (étendues)</strong> d’un groupe : elles déterminent <strong>d’où peuvent venir les membres</strong> et <strong>où le groupe est utilisable</strong>.</p><ul><li><strong>Global</strong> : membres du <strong>même domaine</strong>, utilisable dans <strong>toute la forêt</strong> → on y range les comptes.</li><li><strong>Domaine local</strong> : membres de <strong>toute la forêt</strong>, utilisable dans le <strong>domaine local</strong> → on y attribue les permissions sur les ressources.</li><li><strong>Universel</strong> : membres de toute la forêt, utilisable partout (stocké dans le <strong>catalogue global</strong>).</li></ul><p><em>Bonne pratique : stratégie AGDLP (comptes → Global → Domaine Local → Permissions).</em></p>' + svgAgdlp, 'https://learn.microsoft.com/fr-fr/windows/win32/ad/changing-a-groupampaposs-scope-or-type'],
    ['Qu’est-ce qu’une « unité d’organisation » (OU / UO) ?', '<p>Un <strong>conteneur pour organiser les objets À L’INTÉRIEUR d’un domaine</strong> (par service, par site…). Elle sert à <strong>structurer l’annuaire</strong>, à <strong>déléguer l’administration</strong> et à <strong>appliquer des GPO ciblées</strong>. <em>Analogie : les dossiers d’un classeur.</em></p>', 'https://learn.microsoft.com/fr-fr/windows-server/identity/ad-ds/plan/reviewing-ou-design-concepts'],
    ['Qu’est-ce que la « réplication de contrôleur de domaine » ?', '<p>Le <strong>mécanisme par lequel les DC d’un domaine synchronisent automatiquement</strong> leurs copies de la base AD, pour que tous aient les <strong>mêmes données</strong>. AD est <strong>multi-maître</strong> : une modification sur un DC se propage aux autres.</p>', 'https://learn.microsoft.com/fr-fr/windows-server/identity/ad-ds/get-started/replication/active-directory-replication-concepts'],
    ['Qu’est-ce qu’une « délégation de contrôle » ?', '<p>Accorder à un utilisateur ou un groupe des <strong>droits d’administration limités</strong> sur une partie de l’AD (souvent une <strong>OU</strong>), <strong>sans en faire un administrateur complet</strong>. Ex. autoriser le helpdesk à réinitialiser les mots de passe d’un service. <em>Principe du moindre privilège.</em></p>', 'https://learn.microsoft.com/fr-fr/windows-server/identity/ad-ds/manage/delegation-control-wizard'],
  ]),

  note('green', '🎯 À retenir', '<p><strong>Forêt</strong> ⊃ <strong>arbre</strong> ⊃ <strong>domaine</strong> ⊃ <strong>OU</strong> ⊃ <strong>objets</strong>. Le <strong>contrôleur de domaine</strong> héberge l’annuaire ; le <strong>DNS</strong> et <strong>Kerberos</strong> le font fonctionner ; le <strong>schéma</strong> définit classes et attributs ; les <strong>groupes</strong> et la <strong>délégation</strong> simplifient l’attribution des droits. Pour la mise en pratique : <a href="/pages/roles-windows-server">rôles Windows Server</a> et <a href="/pages/gestionnaire-de-serveurs">gestionnaire de serveurs</a>.</p>'),
];

const PAGE = {
  slug: SLUG,
  title: 'Vocabulaire Active Directory (AD)',
  excerpt: 'Glossaire commenté d’Active Directory : rôle AD DS, forêt, domaine, contrôleur de domaine, schéma, classe, objet, OU, groupes, réplication, délégation… en questions-réponses.',
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

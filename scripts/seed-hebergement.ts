/* Page « L'hébergement web (DNS + IIS) » : à partir du TP « Hébergement 2026 ».
   Concept d'hébergement, plateforme isolée (DNS + IIS + client), rôle DNS (zone directe,
   enregistrement A, FQDN/SLD/TLD), rôle IIS (sites par nom/port/IP, bindings, doc par défaut),
   bonus FTP, tests & dépannage. Schémas SVG + tableaux + lab guidé en accordéons.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-hebergement.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const accordion = (it: Array<[string, string]>) => block('accordion', { items: it.map(([title, text]) => ({ title, text, href: '' })) });

// ===================================================================================
// Schémas SVG (texte en ASCII pour éviter les soucis d'encodage)
// ===================================================================================
const C = { net: '#2563eb', dev: '#059669', warn: '#d97706', danger: '#dc2626', grey: '#64748b', slate: '#475569', purple: '#7c3aed', ok: '#16a34a' };
const wrap = (w: number, h: number, inner: string) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="max-width:${w}px;width:100%;height:auto;margin:8px 0 14px;font-family:system-ui,sans-serif">${inner}</svg>`;
const node = (x: number, y: number, w: number, col: string, title: string, sub1 = '', sub2 = '') => {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="62" rx="8" fill="${col}" fill-opacity="0.1" stroke="${col}" stroke-width="1.6"/>`;
  s += `<text x="${x + w / 2}" y="${y + 22}" text-anchor="middle" font-size="12.5" fill="${col}" font-weight="bold">${title}</text>`;
  if (sub1) s += `<text x="${x + w / 2}" y="${y + 39}" text-anchor="middle" font-size="11" fill="${C.slate}">${sub1}</text>`;
  if (sub2) s += `<text x="${x + w / 2}" y="${y + 54}" text-anchor="middle" font-size="10" fill="${C.grey}">${sub2}</text>`;
  return s;
};

// 1) Topologie du TP : 3 VM reliées par un commutateur prive/interne
const svgTopo = wrap(640, 250,
  node(30, 24, 170, C.dev, 'SRV-DNS', '192.168.10.11', 'Windows Server 2019')
  + node(235, 24, 170, C.net, 'SRV-IIS', '192.168.10.12', 'Windows Server 2019')
  + node(440, 24, 170, C.purple, 'CLIENT-W', '192.168.10.101', 'Windows 11')
  + [115, 320, 525].map(x => `<line x1="${x}" y1="86" x2="320" y2="170" stroke="#94a3b8" stroke-width="2"/>`).join('')
  + `<rect x="180" y="170" width="280" height="40" rx="7" fill="${C.slate}"/>`
  + `<text x="320" y="188" text-anchor="middle" font-size="12" fill="#fff" font-weight="bold">Commutateur prive / interne</text>`
  + `<text x="320" y="202" text-anchor="middle" font-size="10" fill="#e2e8f0">reseau 192.168.10.0 /24</text>`
  + `<text x="320" y="236" text-anchor="middle" font-size="11" fill="${C.grey}">Plateforme isolee : aucun acces Internet — tout se resout en interne via le DNS.</text>`);

// 2) Flux : le client résout le nom puis joint le serveur web
const life = (x: number, label: string, col: string) =>
  `<rect x="${x - 60}" y="14" width="120" height="28" rx="6" fill="${col}"/><text x="${x}" y="33" text-anchor="middle" font-size="12" fill="#fff" font-weight="bold">${label}</text>`
  + `<line x1="${x}" y1="42" x2="${x}" y2="232" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="3 4"/>`;
const arr = (x1: number, y: number, x2: number, txt: string, col: string, dash = false) => {
  const d = x2 > x1 ? 1 : -1;
  return `<line x1="${x1}" y1="${y}" x2="${x2 - d * 7}" y2="${y}" stroke="${col}" stroke-width="2"${dash ? ' stroke-dasharray="5 4"' : ''}/>`
    + `<path d="M${x2} ${y} l${-d * 8} -4 l0 8 z" fill="${col}"/>`
    + `<text x="${(x1 + x2) / 2}" y="${y - 6}" text-anchor="middle" font-size="10.5" fill="${C.slate}">${txt}</text>`;
};
const svgDnsFlow = wrap(640, 250,
  life(90, 'Client', C.purple) + life(320, 'SRV-DNS', C.dev) + life(560, 'SRV-IIS', C.net)
  + arr(90, 74, 320, '1. ou est numerique.adrar ?', C.slate)
  + arr(320, 104, 90, 'reponse : 192.168.10.12', C.dev, true)
  + arr(90, 150, 560, '2. GET http:// (port 80)', C.slate)
  + arr(560, 180, 90, 'la page HTML du site', C.net, true)
  + `<text x="320" y="232" text-anchor="middle" font-size="11" fill="${C.grey}">Le nom est d abord traduit en IP par le DNS, puis le navigateur contacte le serveur IIS.</text>`);

// 3) Anatomie d'un FQDN
const svgFqdn = wrap(640, 150, (() => {
  const segs: Array<[string, string, string]> = [
    ['www', 'Hostname', C.net],
    ['numerique', 'SLD', C.dev],
    ['adrar', 'TLD', C.warn],
    ['.', 'racine', C.grey],
  ];
  let x = 60, s = `<text x="320" y="26" text-anchor="middle" font-size="12" fill="${C.slate}" font-weight="bold">FQDN — Fully Qualified Domain Name</text>`;
  const widths = [120, 170, 120, 50];
  segs.forEach(([t, lab, col], i) => {
    const w = widths[i];
    s += `<rect x="${x}" y="46" width="${w}" height="40" rx="6" fill="${col}" fill-opacity="0.12" stroke="${col}" stroke-width="1.6"/>`;
    s += `<text x="${x + w / 2}" y="${72}" text-anchor="middle" font-size="15" fill="${col}" font-weight="bold" font-family="ui-monospace,monospace">${t}</text>`;
    s += `<text x="${x + w / 2}" y="108" text-anchor="middle" font-size="11" fill="${C.slate}">${lab}</text>`;
    if (i < segs.length - 1) s += `<text x="${x + w + 2}" y="72" font-size="16" fill="${C.grey}" font-weight="bold">.</text>`;
    x += w + 14;
  });
  s += `<text x="320" y="138" text-anchor="middle" font-size="10.5" fill="${C.grey}">Le point final (racine) est toujours present, mais invisible dans les URL du quotidien.</text>`;
  return s;
})());

// ===================================================================================
// Tableaux HTML
// ===================================================================================
const th = (cols: string[]) => `<tr style="background:var(--surface-2)">${cols.map(c => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${c}</th>`).join('')}</tr>`;
const td = (cells: string[], mono = -1) => `<tr>${cells.map((c, i) => `<td style="padding:8px 10px;border:1px solid var(--border)${i === mono ? ';font-family:ui-monospace,monospace' : ''}">${c}</td>`).join('')}</tr>`;
const table = (min: number, head: string[], rows: string) => `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:${min}px;font-size:13.5px"><thead>${th(head)}</thead><tbody>${rows}</tbody></table></div>`;

const prereqTable = table(640, ['Rôle', 'Nom', 'Adresse IP', 'OS', 'Mémoire / Disque'], [
  td(['🟢 Serveur DNS', 'SRV-DNS', '192.168.10.11', 'Windows Server 2019', '4 Go / 30 Go'], 2),
  td(['🔵 Serveur Web', 'SRV-IIS', '192.168.10.12', 'Windows Server 2019', '4 Go / 30 Go'], 2),
  td(['🟣 Client de test', 'CLIENT-W', '192.168.10.101', 'Windows 11', '4 Go / 30 Go'], 2),
].join('') + `<tr><td colspan="5" style="padding:8px 10px;border:1px solid var(--border)"><b>Masque</b> : 255.255.255.0 (/24) · <b>DNS</b> de chaque machine : 192.168.10.11 · <b>Commutateur</b> : privé/interne</td></tr>`);

const bindingTable = table(620, ['Distinguer par…', 'Exemple du TP', 'Quand l’utiliser'], [
  td(['🏷️ Nom d’hôte (host header)', '<code>intranet.numerique.adrar</code> sur le port 80', 'Plusieurs sites sur <b>une même IP et un même port</b> — le plus courant.']),
  td(['🔢 Port', '<code>intranetport.web.lan:8080</code>', 'Exposer un site sur un <b>port différent</b> (8080) de la même IP.']),
  td(['🌐 Adresse IP', '<code>www.intranetip.lan</code> → 192.168.10.200 (2ᵉ carte)', 'Dédier une <b>IP par site</b> (nécessite une carte/adresse en plus).']),
].join(''));

const troubleTable = table(620, ['Problème', 'Symptôme', 'Piste'], [
  td(['Le <code>ping</code> échoue', 'Délai dépassé', 'Pare-feu Windows bloque l’<b>ICMP</b> → l’autoriser.']),
  td(['Le nom ne résout pas', '<code>nslookup</code> échoue', 'DNS du client ≠ 192.168.10.11, ou enregistrement A manquant.']),
  td(['Page inaccessible', 'Erreur navigateur', 'Site IIS éteint, mauvais binding (nom/port/IP) ou document par défaut absent.']),
].join(''));

// ===================================================================================
// PAGE
// ===================================================================================
const SLUG = 'hebergement-web';
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Windows Server', title: 'L’hébergement web (DNS + IIS)', subtitle: 'Publier un site et le joindre par son nom : le serveur web (IIS), la résolution de noms (DNS) et le réseau qui les relie.' }),
  block('html', { html: '<p><strong>Héberger un site</strong>, c’est le <strong>stocker sur un serveur</strong> et le rendre <strong>joignable</strong> par d’autres machines. Il faut trois briques : un <strong>serveur web</strong> qui sert les pages (ici <strong>IIS</strong>), un <strong>service de noms</strong> qui traduit un nom en adresse IP (le <strong>DNS</strong>), et un <strong>réseau</strong> qui relie le tout. Ce cours suit une plateforme de TP <strong>isolée</strong> : un serveur DNS, un serveur IIS et un client de test.</p>' }),
  note('blue', '🧰 Prérequis & cours liés', '<p>À connaître : <a href="/pages/roles-windows-server">les rôles de Windows Server</a>, <a href="/pages/gestionnaire-de-serveurs">le gestionnaire de serveurs</a>, <a href="/pages/bases-du-reseau">les bases du réseau</a> et <a href="/pages/adresses-ip">les adresses IP</a>. Sigles dans le <a href="/glossaire">Glossaire</a>.</p>'),

  block('heading', { level: 2, text: '🗺️ L’architecture de la plateforme' }),
  block('html', { html: '<p>Trois machines virtuelles reliées par un <strong>commutateur privé/interne</strong> (réseau coupé d’Internet) : on maîtrise tout et la résolution de noms se fait <strong>en local</strong>.</p>' }),
  block('html', { html: svgTopo }),
  block('html', { html: prereqTable }),
  note('green', '💡 Pourquoi un réseau isolé ?', '<p>Un <strong>commutateur privé/interne</strong> (notion vue en <a href="/pages/virtualisation">virtualisation Hyper-V</a>) isole le labo : pas de risque pour le réseau réel, et on joue soi-même le rôle du DNS « d’Internet ». <strong>Tous les tests se font depuis le client.</strong></p>'),

  block('heading', { level: 2, text: '🧭 Comment un site est joint (vue d’ensemble)' }),
  block('html', { html: '<p>Quand le client tape un nom dans son navigateur, deux étapes s’enchaînent : <strong>résoudre le nom en IP</strong> (DNS), puis <strong>demander la page</strong> au serveur web (IIS).</p>' }),
  block('html', { html: svgDnsFlow }),

  block('heading', { level: 2, text: '🌍 L’écosystème de l’hébergement web' }),
  block('html', { html: '<p>Avant la technique, le vocabulaire du métier. Un <strong>hébergement web</strong> permet de <strong>stocker un site</strong> et de le rendre <strong>accessible 24 h/24</strong> sur Internet ; les fichiers sont posés sur un <strong>serveur connecté au réseau</strong>. L’<strong>hébergeur</strong> est l’entité qui met ces serveurs à disposition et assure généralement : disponibilité, connectivité, sécurité, sauvegardes, alimentation/climatisation et maintenance.</p>' }),
  block('html', { html: `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:520px;font-size:13.5px"><thead><tr style="background:var(--surface-2)">${['Type d’hébergement', 'Principe'].map(h => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${h}</th>`).join('')}</tr></thead><tbody>`
    + [
      ['Mutualisé', 'Un serveur partagé entre de nombreux sites — économique, peu de contrôle.'],
      ['VPS', 'Serveur virtuel dédié (ressources garanties) — bon compromis coût/contrôle.'],
      ['Dédié', 'Un serveur physique entier pour un seul client — performance et contrôle maximum.'],
      ['Cloud', 'Ressources élastiques à la demande, facturées à l’usage.'],
    ].map(r => `<tr><td style="padding:8px 10px;border:1px solid var(--border);font-weight:600">${r[0]}</td><td style="padding:8px 10px;border:1px solid var(--border)">${r[1]}</td></tr>`).join('')
    + `</tbody></table></div>` }),
  block('html', { html: '<p>Le <strong>nom de domaine</strong>, lui, se loue chez un <strong>registrar</strong> (bureau d’enregistrement accrédité par l’<strong>ICANN</strong> à l’international, l’<strong>AFNIC</strong> pour le <code>.fr</code>) — ex. OVHcloud, Gandi, Namecheap. On le loue de <strong>1 à 10 ans</strong>, avec <strong>renouvellement</strong> obligatoire pour le conserver.</p>' }),
  note('gray', '🌐 Les serveurs racine', '<p>Au sommet du DNS mondial, <strong>13 serveurs racine</strong> historiques (nommés de <strong>A à M</strong>, aujourd’hui répartis sur des centaines d’instances) font autorité sur les <strong>TLD</strong> (<code>.com</code>, <code>.fr</code>…). Ils orientent les requêtes vers les bons serveurs DNS de zone.</p>'),

  block('heading', { level: 2, text: '🟢 Le DNS : traduire un nom en adresse IP' }),
  block('html', { html: '<p>Le <strong>DNS</strong> (<em>Domain Name System</em>) est l’<strong>annuaire</strong> du réseau : il associe un <strong>nom</strong> (lisible) à une <strong>adresse IP</strong> (la machine). Sans lui, il faudrait retenir des IP. On installe le <strong>rôle DNS</strong> sur le premier serveur, puis on crée une <strong>zone</strong> et des <strong>enregistrements</strong>.</p>' }),
  block('heading', { level: 3, text: '🔤 Anatomie d’un nom de domaine (FQDN)' }),
  block('html', { html: svgFqdn }),
  block('html', { html: '<p>Un <strong>nom de domaine</strong> s’écrit <code>SLD.TLD</code> — ex. <code>numerique.adrar</code> a pour <strong>SLD</strong> (<em>Second Level Domain</em>) « numerique » et <strong>TLD</strong> (<em>Top Level Domain</em>) « adrar ». En ajoutant un <strong>nom d’hôte</strong> on obtient le <strong>FQDN</strong> : <code>www.numerique.adrar</code>. Sans nom d’hôte, le FQDN est simplement <code>numerique.adrar</code>.</p>' }),
  accordion([
    ['Installer le rôle DNS', '<p>Via le <strong>Gestionnaire de serveur</strong> → <em>Gérer → Ajouter des rôles et des fonctionnalités</em> → cocher <strong>Serveur DNS</strong> → continuer jusqu’à <em>Confirmation</em> → installer. À la fin, l’outil <strong>DNS</strong> apparaît dans le menu <em>Outils</em>.</p>'],
    ['Créer une zone de recherche directe', '<p>Dans la console <strong>DNS</strong>, créer une <strong>zone directe</strong> portant le <strong>nom de votre domaine</strong> (ex. <code>numerique.adrar</code>). C’est par ce nom que le site sera joignable. <em>(Une zone « directe » fait nom → IP ; une zone « inversée » fait IP → nom.)</em></p>'],
    ['Ajouter un enregistrement A', '<p>Dans la zone, créer un <strong>enregistrement hôte (A)</strong> :<br>• <strong>A</strong> = hôte lié à une <strong>IPv4</strong> · <strong>AAAA</strong> = hôte lié à une <strong>IPv6</strong>.<br>• <strong>Nom d’hôte</strong> (ex. <code>www</code>) → optionnel ; vide = le domaine seul.<br>• <strong>Adresse IP</strong> = celle du <strong>serveur web</strong> (ici <code>192.168.10.12</code>), là où sont stockées les ressources du site.</p>'],
    ['💡 Le point final du FQDN', '<p>Un FQDN se termine <strong>toujours par un point</strong> (la <strong>racine</strong>) : <code>www.numerique.adrar.</code>. Il est présent dans toutes les URL (ex. <code>www.google.fr.</code>) mais reste <strong>invisible</strong> au quotidien.</p>'],
  ]),
  note('yellow', '✅ Vérifier (depuis le client)', '<p><code>nslookup www.numerique.adrar</code> doit renvoyer l’IP du serveur web. Pense à régler le <strong>DNS du client sur 192.168.10.11</strong>. <strong>Astuce :</strong> fais un <strong>instantané (snapshot)</strong> de la VM avant d’aller plus loin.</p>'),

  block('heading', { level: 2, text: '🔵 IIS : le serveur web' }),
  block('html', { html: '<p><strong>IIS</strong> (<em>Internet Information Services</em>) est le <strong>serveur web de Windows</strong> : il <strong>écoute les requêtes</strong> et renvoie les pages stockées dans un dossier (par défaut <code>C:\\inetpub</code>). On installe le <strong>rôle IIS</strong> sur le second serveur, puis on crée un ou plusieurs <strong>sites</strong>.</p>' }),
  accordion([
    ['Installer le rôle IIS', '<p><em>Gérer → Ajouter des rôles et des fonctionnalités</em> → cocher <strong>Serveur Web (IIS)</strong> → installer. Le <strong>Gestionnaire des services Internet (IIS)</strong> apparaît dans les <em>Outils</em>. Un <strong>site par défaut</strong> est déjà présent (on l’éteint avant de créer le sien).</p>'],
    ['Créer un site', '<p>Clic droit sur <strong>Sites → Ajouter un site web</strong>. Champs clés :<br>• <strong>Nom du site</strong> : le nom affiché dans IIS (ex. <code>Intranet</code>).<br>• <strong>Chemin physique</strong> : le dossier des ressources (ex. <code>C:\\inetpub\\intranet</code>).<br>• <strong>Type / IP / Port</strong> : http ou https, l’IP et le port d’écoute.<br>• <strong>Nom d’hôte</strong> : le FQDN qui pointe vers ce site.</p>'],
    ['Page d’accueil & document par défaut', '<p>Place une page <code>index.html</code> dans le dossier du site, ex. :</p><pre style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;overflow-x:auto"><code>&lt;h1&gt;Bonjour&lt;/h1&gt;\n&lt;p&gt;Bienvenue sur mon intranet&lt;/p&gt;</code></pre><p>IIS sert automatiquement un <strong>document par défaut</strong> quand l’URL ne cite pas de fichier : <code>index.html</code>, <code>index.htm</code>, <code>default.htm</code>… (liste configurable dans IIS).</p>'],
  ]),
  block('heading', { level: 3, text: '🔀 Héberger plusieurs sites sur un serveur' }),
  block('html', { html: '<p>Un même serveur IIS peut héberger <strong>plusieurs sites</strong>. Pour les distinguer, on joue sur le <strong>binding</strong> (la combinaison <strong>IP + port + nom d’hôte</strong>) — trois approches :</p>' }),
  block('html', { html: bindingTable }),
  note('blue', '🔌 Rappel : le port', '<p>Par défaut, le web écoute sur le <strong>port 80</strong> (HTTP) ou <strong>443</strong> (HTTPS). Changer de port (ex. <strong>8080</strong>) permet d’exposer un autre site sur la même IP — il faut alors préciser le port dans l’URL : <code>http://intranetport.web.lan:8080</code>. Voir <a href="/pages/tcp-et-udp">TCP & UDP</a>.</p>'),

  block('heading', { level: 2, text: '📁 Bonus — FTP : transférer des fichiers' }),
  block('html', { html: '<p>Le <strong>FTP</strong> (<em>File Transfer Protocol</em>) sert à <strong>déposer/récupérer des fichiers</strong> sur le serveur. Sous Windows, le FTP est un <strong>sous-rôle d’IIS</strong> : on l’ajoute via le rôle IIS, puis on crée un <strong>site FTP</strong> (distinguable lui aussi par nom, port ou IP).</p>' }),
  accordion([
    ['Mettre en place un site FTP', '<p>Créer un dossier (ex. <code>C:\\inetpub\\monpremierFTP</code>) avec un contenu, ajuster les <strong>droits NTFS</strong> (lecture seule pour tous), puis dans IIS : clic droit <strong>Sites → Ajouter un site FTP</strong>. Pour le TP : <strong>sans SSL</strong>, <strong>authentification anonyme</strong> autorisée.</p>'],
    ['Tester le FTP', '<p>Depuis le client : via <strong>FileZilla</strong> (téléverser/télécharger) ou un navigateur compatible. <em>Astuce Hyper-V</em> pour copier un installateur vers la VM : <code>Copy-VMFile "NOM_VM" -SourcePath "C:\\...\\fichier" -DestinationPath "C:\\...\\" -CreateFullPath -FileSource Host</code>.</p>'],
  ]),

  block('heading', { level: 2, text: '🧪 Tests & dépannage' }),
  block('html', { html: '<p>Toujours tester <strong>depuis le client</strong>, dans l’ordre : le réseau, puis le nom, puis le web.</p>' }),
  block('list', { listItems: [
    'Réseau : ping 192.168.10.12 (le serveur web répond ?).',
    'Nom : nslookup www.numerique.adrar (le DNS renvoie la bonne IP ?).',
    'Web : ouvrir http://www.numerique.adrar dans le navigateur.',
  ] }),
  block('html', { html: troubleTable }),
  note('blue', '🛠️ Outils de diagnostic', '<p><code>ping</code>, <code>nslookup</code>, <code>netstat</code> (voir <a href="/pages/cmd-et-powershell">invite & PowerShell</a>), l’<strong>Observateur d’événements</strong> (logs) et un analyseur de flux (<strong>Wireshark</strong>). Si le <code>ping</code> échoue alors que tout semble bon : pense au <strong>pare-feu (ICMP)</strong>.</p>'),

  note('green', '🎯 À retenir', '<p><strong>Héberger</strong> = serveur web (<strong>IIS</strong>) + résolution de noms (<strong>DNS</strong>) + réseau. Le <strong>DNS</strong> traduit le <strong>FQDN</strong> en <strong>IP</strong> (enregistrement <strong>A</strong>) ; <strong>IIS</strong> sert les pages depuis <code>C:\\inetpub</code> et distingue les sites par <strong>nom d’hôte, port ou IP</strong> (le <strong>binding</strong>). Le <strong>FTP</strong> (sous-rôle d’IIS) sert à publier les fichiers. On teste avec <code>ping</code>, <code>nslookup</code> et le navigateur. Pour aller plus loin : <a href="/pages/vocabulaire-active-directory">Vocabulaire AD</a>, <a href="/pages/roles-windows-server">rôles Windows Server</a>.</p>'),
];

const PAGE = {
  slug: SLUG,
  title: 'L’hébergement web (DNS + IIS)',
  excerpt: 'Héberger un site sur un réseau Windows : le serveur web IIS, la résolution de noms DNS (zone directe, enregistrement A, FQDN), héberger plusieurs sites (nom/port/IP), bonus FTP, tests & dépannage.',
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

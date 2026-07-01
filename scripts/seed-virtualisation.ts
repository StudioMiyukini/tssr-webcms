/* Crée la page de cours « La virtualisation avec Hyper-V (Windows Server) » :
   l'hyperviseur Hyper-V, son installation via le Gestionnaire de serveurs, ses briques
   (VM, VHDX, commutateur virtuel, génération, points de contrôle) et la création d'une VM.
   Vulgarisé, avec analogies et schémas. Reste dans le contexte Windows Server.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-virtualisation.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);

const C = { net: '#2563eb', dev: '#059669', warn: '#d97706', danger: '#dc2626', grey: '#64748b', slate: '#475569', purple: '#7c3aed', ok: '#16a34a' };
const accordion = (it: Array<[string, string]>) => block('accordion', { items: it.map(([title, text]) => ({ title, text, href: '' })) });
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const code = (lines: string[]) => `<pre style="background:var(--surface-2);border:1px solid var(--border);padding:10px 12px;border-radius:8px;overflow-x:auto;font-size:13px;line-height:1.55;margin:8px 0"><code>${lines.map(l => l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')).join('\n')}</code></pre>`;

// ===================================================================================
// SCHÉMAS SVG (couches empilées)
// ===================================================================================
function box(x: number, y: number, w: number, h: number, fill: string, label: string, sub = ''): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}"/>`
    + `<text x="${x + w / 2}" y="${y + (sub ? h / 2 - 2 : h / 2 + 4)}" text-anchor="middle" font-size="13" fill="#fff" font-weight="bold">${label}</text>`
    + (sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 14}" text-anchor="middle" font-size="10" fill="#e5e7eb">${sub}</text>` : '');
}
const line = (x1: number, y1: number, x2: number, y2: number, col = '#94a3b8') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="2.5"/>`;
const wrap = (w: number, h: number, inner: string) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="max-width:${w}px;width:100%;height:auto;margin:6px 0 12px;font-family:system-ui,sans-serif">${inner}</svg>`;
const cap = (x: number, y: number, t: string, col = '#64748b', s = 11) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${s}" fill="${col}">${t}</text>`;
const lbl = (x: number, y: number, t: string, col = '#475569', s = 11) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${s}" fill="${col}" font-weight="bold">${t}</text>`;

// Architecture : 1 serveur physique → Hyper-V → plusieurs VM
const vmCol = (x: number, n: string) =>
  `<rect x="${x}" y="16" width="160" height="100" rx="10" fill="${C.dev}" fill-opacity="0.08" stroke="${C.dev}" stroke-width="1.5"/>`
  + lbl(x + 80, 32, n, C.slate, 12)
  + box(x + 12, 40, 136, 28, C.purple, 'Applications')
  + box(x + 12, 74, 136, 32, C.dev, 'OS invite');
const svgStack = wrap(560, 224,
  vmCol(20, 'VM — AD/DNS') + vmCol(200, 'VM — Fichiers') + vmCol(380, 'VM — Test')
  + box(20, 124, 520, 38, C.net, 'Hyper-V (hyperviseur)', 'repartit CPU / RAM / disque entre les VM')
  + box(20, 168, 520, 40, C.slate, 'Serveur physique', 'CPU - RAM - Disque - Carte reseau')
  + cap(280, 220, 'Un seul serveur physique fait tourner plusieurs serveurs virtuels.'));

// Type 1 (Hyper-V) vs Type 2
const svgType = wrap(560, 226,
  lbl(140, 26, 'Type 1 — bare-metal', C.net, 13) + cap(140, 42, 'Hyper-V, ESXi, Proxmox', C.grey, 10)
  + box(30, 90, 108, 38, C.dev, 'VM', 'OS + appli') + box(152, 90, 108, 38, C.dev, 'VM', 'OS + appli')
  + box(20, 138, 240, 30, C.net, 'Hyper-V')
  + box(20, 170, 240, 30, C.slate, 'Materiel')
  + lbl(420, 26, 'Type 2 — heberge', C.net, 13) + cap(420, 42, 'VirtualBox, VMware WS', C.grey, 10)
  + box(310, 60, 108, 38, C.dev, 'VM', 'OS + appli') + box(432, 60, 108, 38, C.dev, 'VM', 'OS + appli')
  + box(300, 106, 240, 30, C.net, 'Hyperviseur')
  + box(300, 138, 240, 30, C.warn, 'OS hote')
  + box(300, 170, 240, 30, C.slate, 'Materiel')
  + cap(280, 220, "Hyper-V est de Type 1 : pose directement sur le materiel, pour les serveurs."));

// Commutateur virtuel (vSwitch) : relie les VM au réseau physique
const svgVSwitch = wrap(540, 214,
  box(40, 20, 110, 40, C.dev, 'VM 1') + box(170, 20, 110, 40, C.dev, 'VM 2') + box(300, 20, 110, 40, C.dev, 'VM 3')
  + line(95, 60, 270, 90, C.slate) + line(225, 60, 270, 90, C.slate) + line(355, 60, 270, 90, C.slate)
  + box(120, 90, 300, 40, C.net, 'Commutateur virtuel (vSwitch)', 'aiguille le trafic des VM')
  + line(270, 130, 270, 150, C.slate)
  + box(185, 150, 170, 36, C.slate, 'Carte reseau physique')
  + line(355, 168, 410, 168, C.net) + `<text x="418" y="172" font-size="11" fill="${C.net}" font-weight="bold">Reseau</text>`
  + cap(250, 206, 'Le vSwitch est un switch logiciel : il relie les VM entre elles et au reseau reel.'));

// Points de contrôle (ex-snapshots)
const svgSnap = wrap(520, 140,
  `<line x1="60" y1="66" x2="470" y2="66" stroke="#cbd5e1" stroke-width="3"/>`
  + `<circle cx="110" cy="66" r="8" fill="${C.dev}"/>` + cap(110, 94, 'VM saine', C.slate, 11)
  + `<circle cx="250" cy="66" r="9" fill="${C.net}"/>` + lbl(250, 46, 'Point de controle', C.net, 11) + cap(250, 94, '(photo de la VM)', C.grey, 10)
  + `<circle cx="400" cy="66" r="8" fill="${C.danger}"/>` + cap(400, 94, 'Mise a jour qui casse', C.danger, 11)
  + `<line x1="398" y1="52" x2="262" y2="52" stroke="${C.ok}" stroke-width="2.5" stroke-dasharray="6 4"/><polygon points="262,52 272,47 272,57" fill="${C.ok}"/>`
  + cap(330, 40, 'restauration en 1 clic', C.ok, 10)
  + cap(260, 124, "Le point de controle = un retour arriere : on revient a l'etat d'avant en cas de probleme.", C.grey, 11));

// ===================================================================================
// PAGE
// ===================================================================================
const SLUG = 'virtualisation';
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Windows Server', title: 'La virtualisation avec Hyper-V', subtitle: 'Faire tourner plusieurs serveurs virtuels sur un seul serveur physique, avec Hyper-V.' }),
  block('html', { html: '<p>La <strong>virtualisation</strong>, c’est faire tourner <strong>plusieurs ordinateurs « virtuels »</strong> (des <strong>machines virtuelles</strong>, ou VM) <strong>à l’intérieur d’une seule machine physique</strong>. Sous Windows, l’outil pour ça s’appelle <strong>Hyper-V</strong> : c’est l’<strong>hyperviseur de Microsoft</strong>, livré comme un <strong>rôle de <a href="/pages/windows-server">Windows Server</a></strong> et installé via le <strong><a href="/pages/gestionnaire-de-serveurs">Gestionnaire de serveurs</a></strong>.</p>' }),
  note('blue', '🔎 Analogie', '<p>Pense à un <strong>immeuble d’appartements</strong>. Le <strong>bâtiment</strong>, c’est le serveur physique. Chaque <strong>appartement</strong> est une <strong>VM</strong> : indépendant, isolé de ses voisins. Le <strong>syndic</strong> qui répartit l’eau et l’électricité, c’est <strong>Hyper-V</strong>. Un seul immeuble, plein de logements séparés.</p>'),

  block('heading', { level: 2, text: '🧱 C’est quoi, concrètement ?' }),
  block('html', { html: svgStack }),
  block('html', { html: '<p>Sur le serveur, on active <strong>Hyper-V</strong>. C’est lui qui <strong>découpe et partage</strong> le matériel réel (processeur, mémoire, disque) entre les VM. Chaque VM <strong>croit</strong> avoir son propre serveur : elle a son <strong>système</strong> (Windows Server, Linux…), ses applications, son disque — totalement séparée des autres. Un même serveur peut ainsi héberger un contrôleur de domaine, un serveur de fichiers et une VM de test.</p>' }),

  block('heading', { level: 2, text: '🎛️ Hyper-V : l’hyperviseur de Windows Server' }),
  block('html', { html: '<p>Hyper-V est un hyperviseur de <strong>Type 1</strong> (« bare-metal ») : une fois le rôle activé, il se place <strong>sous</strong> Windows et pilote directement le matériel. C’est le plus <strong>performant</strong>, fait pour les <strong>serveurs</strong>.</p>' }),
  block('html', { html: svgType }),
  note('green', '💡 Où trouve-t-on Hyper-V ?', '<p>Hyper-V existe comme <strong>rôle de Windows Server</strong> (voir <a href="/pages/roles-windows-server">les rôles</a>) et aussi comme <strong>fonctionnalité de Windows 10/11 Pro</strong>. À ne pas confondre avec <strong>VirtualBox</strong> ou <strong>VMware Workstation</strong>, qui sont de <strong>Type 2</strong> (un logiciel posé sur ton OS, pour s’entraîner).</p>'),

  block('heading', { level: 2, text: '🛠️ Installer Hyper-V via le Gestionnaire de serveurs' }),
  block('html', { html: '<p>L’installation se fait comme n’importe quel rôle, depuis le <a href="/pages/gestionnaire-de-serveurs">Gestionnaire de serveurs</a> :</p><ol><li><strong>Gérer → Ajouter des rôles et fonctionnalités.</strong></li><li>Type d’installation : <strong>« Installation basée sur un rôle ou une fonctionnalité ».</strong></li><li>Coche le rôle <strong>Hyper-V</strong> (il propose d’ajouter les outils de gestion).</li><li>Choisis la/les <strong>cartes réseau</strong> pour créer un <strong>commutateur virtuel</strong>.</li><li>Valide, puis <strong>redémarre</strong> le serveur (obligatoire).</li></ol>' }),
  block('html', { html: '<p class="meta">En PowerShell, c’est une seule ligne :</p>' }),
  block('html', { html: code(['# Installe le rôle Hyper-V + ses outils, puis redémarre', 'Install-WindowsFeature -Name Hyper-V -IncludeManagementTools -Restart']) }),
  note('yellow', '⚠️ Prérequis', '<p>Le processeur doit supporter la <strong>virtualisation matérielle</strong> (Intel VT-x / AMD-V), <strong>activée dans le BIOS/UEFI</strong>. Sans elle, le rôle Hyper-V ne démarre pas.</p>'),

  block('heading', { level: 2, text: '🧩 Les briques d’Hyper-V' }),
  accordion([
    ['🖥️ La machine virtuelle (VM)', '<p>Le « PC virtuel » : on lui attribue des <strong>vCPU</strong> (cœurs virtuels), de la <strong>RAM</strong>, un <strong>disque</strong> et une <strong>carte réseau</strong>. On y installe ensuite un OS comme sur une vraie machine.</p>'],
    ['💽 Le disque dur virtuel (VHDX)', '<p>Le disque d’une VM est en réalité un <strong>fichier</strong> <code>.vhdx</code> sur le serveur. Il peut être <strong>dynamique</strong> (grossit au fur et à mesure, économe) ou <strong>fixe</strong> (taille réservée d’emblée, plus performant).</p>'],
    ['🔀 Le commutateur virtuel (vSwitch)', '<p>C’est un <strong>switch logiciel</strong> qui relie les VM entre elles et au réseau. Trois types : <strong>externe</strong> (les VM accèdent au réseau physique), <strong>interne</strong> (VM + serveur hôte seulement), <strong>privé</strong> (les VM entre elles, isolées du reste).</p>'],
    ['🔢 Génération 1 ou 2', '<p>À la création, on choisit la <strong>génération</strong>. <strong>Gen 2</strong> = firmware <strong>UEFI</strong>, démarrage sécurisé, pour les OS récents (Windows Server 2016+, Linux récents). <strong>Gen 1</strong> = <strong>BIOS</strong> classique, pour les vieux systèmes.</p>'],
    ['📸 Les points de contrôle', '<p>Anciennement « snapshots » : une <strong>photo</strong> de la VM à un instant T. Tu fais une manip risquée ? Tu prends un point de contrôle avant, et tu <strong>reviens en arrière en un clic</strong> si ça casse. C’est le <strong>point de sauvegarde d’un jeu vidéo</strong>.</p>'],
  ]),
  block('html', { html: svgVSwitch }),

  block('heading', { level: 2, text: '🚀 Créer & gérer une VM (Gestionnaire Hyper-V)' }),
  block('html', { html: '<p>Une fois le rôle installé, on gère tout depuis la console <strong>Gestionnaire Hyper-V</strong> (ou Windows Admin Center). Pour créer une VM :</p><ol><li><strong>Action → Nouveau → Ordinateur virtuel.</strong></li><li><strong>Nom</strong> et emplacement de stockage.</li><li><strong>Génération</strong> 1 ou 2.</li><li><strong>Mémoire</strong> de démarrage (ex. 4096 Mo).</li><li><strong>Réseau</strong> : choisir le <strong>commutateur virtuel</strong>.</li><li><strong>Disque dur virtuel</strong> (VHDX) : taille (ex. 60 Go).</li><li><strong>Image ISO</strong> du système à installer.</li></ol>' }),
  block('html', { html: '<p class="meta">L’équivalent en PowerShell :</p>' }),
  block('html', { html: code(['New-VM -Name "SRV-TEST" -Generation 2 -MemoryStartupBytes 4GB `', '  -NewVHDPath "D:\\VM\\srv-test.vhdx" -NewVHDSizeBytes 60GB `', '  -SwitchName "vSwitch-Externe"', 'Start-VM -Name "SRV-TEST"']) }),

  block('heading', { level: 2, text: '✨ Les points de contrôle en action' }),
  block('html', { html: svgSnap }),

  block('heading', { level: 2, text: '🎯 Pourquoi virtualiser sous Windows Server ?' }),
  block('html', { html: '<ul><li>💰 <strong>Consolidation</strong> : plusieurs serveurs (AD, DNS, fichiers…) sur une seule machine → moins de matériel, d’électricité et de place.</li><li>🧪 <strong>Tests & labs</strong> : monter et casser des serveurs sans risque (idéal en <strong>TSSR</strong>).</li><li>♻️ <strong>Retour arrière</strong> immédiat grâce aux <strong>points de contrôle</strong>.</li><li>🧱 <strong>Isolation</strong> : un service qui plante n’affecte pas les autres.</li><li>⚙️ <strong>Flexibilité</strong> : ajouter RAM ou vCPU en quelques clics, sans tournevis.</li></ul>' }),

  note('green', '💡 À retenir', '<p><strong>Hyper-V</strong> = l’hyperviseur de Microsoft, un <strong>rôle de <a href="/pages/windows-server">Windows Server</a></strong> (Type 1) installé via le <strong><a href="/pages/gestionnaire-de-serveurs">Gestionnaire de serveurs</a></strong>. Une VM combine <strong>VHDX</strong> (disque), <strong>vSwitch</strong> (réseau) et <strong>points de contrôle</strong> (retour arrière). Atouts : consolidation, isolation, labs et flexibilité. Voir aussi <a href="/pages/roles-windows-server">les rôles de Windows Server</a>. Sigles dans le <a href="/glossaire">Glossaire</a>.</p>'),
];

const PAGE = {
  slug: SLUG,
  title: 'La virtualisation avec Hyper-V (Windows Server)',
  excerpt: 'La virtualisation expliquée simplement sous Windows Server : Hyper-V, son installation via le Gestionnaire de serveurs, VM, VHDX, commutateur virtuel, points de contrôle et création d’une VM.',
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

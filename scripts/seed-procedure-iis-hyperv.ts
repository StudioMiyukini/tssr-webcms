/* Procédure « Installer un serveur IIS sur une VM Hyper-V » : de la création de la VM
   (Hyper-V) à la publication d'un site web (rôle IIS), en passant par l'installation de
   Windows Server et la config réseau. Combine VM + IIS de bout en bout.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-procedure-iis-hyperv.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const SLUG = 'procedure-iis-hyperv';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const stepsStyle = block('html', { html: `<style>.proc-steps{padding-left:22px;line-height:1.75}.proc-steps>li{margin:8px 0}.proc-steps code,.proc-steps kbd{font-family:ui-monospace,'Space Mono',monospace}.proc-steps kbd{border:1px solid var(--border);border-radius:5px;padding:1px 6px;background:var(--surface-2)}.proc-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="proc-cmd">${t}</div>` });

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Procédure · Hébergement', title: 'Installer un serveur IIS sur une VM Hyper-V', subtitle: 'De la création de la machine virtuelle à la publication d’un site web, étape par étape.' }),
  note('blue', '🎯 Objectif & vue d’ensemble', '<p>On part de zéro : on <strong>crée une VM</strong> sur Hyper-V, on y <strong>installe Windows Server</strong>, on la <strong>configure</strong> (nom + IP fixe), on installe le <strong>rôle IIS</strong>, puis on <strong>publie un site</strong> et on le teste depuis un client. Chaque étape renvoie vers la procédure détaillée correspondante.</p>'),

  block('heading', { level: 2, text: '✅ Prérequis' }),
  block('html', { html: `<ul>
    <li>Le rôle <strong>Hyper-V</strong> est installé sur l’hôte.</li>
    <li>Une <strong>image ISO de Windows Server</strong> (ex. 2019/2022) est disponible.</li>
    <li>Un <strong>commutateur virtuel</strong> existe (ex. <code>COM_private</code> ou externe) — voir <a href="/procedure-hyperv-ressources">Hyper-V : ressources</a>.</li>
    <li>Un plan d’adressage : IP fixe du serveur, passerelle en <code>.254</code>, DNS (l’<strong>IP du DC</strong> si domaine).</li>
  </ul>` }),

  block('heading', { level: 2, text: '① Créer la VM (Hyper-V)' }),
  block('html', { html: `<ol class="proc-steps">
    <li><strong>Gestionnaire Hyper-V</strong> → <em>Action</em> → <strong>Nouvel ordinateur virtuel</strong>.</li>
    <li>Nom : <code>SRV-WEB01</code> (respecte la <strong>convention de nommage</strong>). Génération <strong>2</strong> (UEFI).</li>
    <li><strong>Mémoire</strong> : ex. 4096 Mo. <strong>Réseau</strong> : connecter au commutateur virtuel.</li>
    <li><strong>Disque dur</strong> : créer un <strong>VHDX</strong> (ex. 60 Go, dynamique).</li>
    <li><strong>Options d’installation</strong> : « Installer un système d’exploitation à partir d’un fichier image (.iso) » → sélectionner l’<strong>ISO Windows Server</strong> → Terminer.</li>
  </ol>` }),
  note('gray', 'ℹ️ Détail', '<p>Pas-à-pas complet de création/configuration d’une VM : <a href="/procedure-vm-hyperv">Créer & configurer une VM (ISO) sur Hyper-V</a>.</p>'),

  block('heading', { level: 2, text: '② Installer Windows Server dans la VM' }),
  block('html', { html: `<ol class="proc-steps">
    <li><strong>Démarrer</strong> la VM et <strong>se connecter</strong> à sa console (double-clic).</li>
    <li>Choisir l’édition <strong>« Expérience de bureau »</strong> (Desktop Experience) pour avoir l’interface graphique.</li>
    <li>Installation <strong>personnalisée</strong> → sélectionner le disque → laisser l’installation se dérouler (la VM redémarre).</li>
    <li>Définir le <strong>mot de passe administrateur</strong>, puis se connecter.</li>
  </ol>` }),

  block('heading', { level: 2, text: '③ Configuration de base (nom + réseau)' }),
  block('html', { html: `<ol class="proc-steps">
    <li><strong>Renommer</strong> le serveur : <code>sysdm.cpl</code> → <em>Modifier…</em> → <code>SRV-WEB01</code> → redémarrer. Voir <a href="/procedure-renommer-poste">Renommer un poste</a>.</li>
    <li><strong>IP fixe</strong> : <code>ncpa.cpl</code> → carte → Propriétés → TCP/IPv4 → IP, masque, <strong>passerelle <code>.254</code></strong>, DNS (IP du DC). Voir <a href="/procedure-ip-fixe-windows">Configurer une IP fixe</a>.</li>
    <li>Optionnel : <strong>joindre le domaine</strong> (si le site doit être résolu via le DNS du domaine).</li>
  </ol>` }),
  cmd('REM Verification\nhostname\nipconfig /all'),

  block('heading', { level: 2, text: '④ Installer le rôle IIS' }),
  block('html', { html: `<ol class="proc-steps">
    <li><strong>Gestionnaire de serveur</strong> → <em>Gérer</em> → <strong>Ajouter des rôles et fonctionnalités</strong>.</li>
    <li>Type : <em>Installation basée sur un rôle</em> → sélectionner ce serveur.</li>
    <li>Cocher <strong>« Serveur Web (IIS) »</strong> → accepter les fonctionnalités proposées → <strong>Installer</strong> (garder les composants par défaut).</li>
    <li>Vérifier : ouvrir un navigateur sur <code>http://localhost</code> → la <strong>page d’accueil IIS</strong> doit s’afficher.</li>
  </ol>` }),
  note('gray', 'ℹ️ Détail', '<p>Pas-à-pas complet d’IIS (site, liaison, NTFS, pare-feu) : <a href="/procedure-iis">IIS : héberger un site web</a>.</p>'),

  block('heading', { level: 2, text: '⑤ Publier un site web' }),
  block('html', { html: `<ol class="proc-steps">
    <li>Déposer les fichiers du site dans un dossier, ex. <code>C:\\inetpub\\wwwroot\\monsite</code>.</li>
    <li><strong>Gestionnaire IIS</strong> (<code>inetmgr</code>) → clic droit <strong>Sites</strong> → <strong>Ajouter un site Web</strong> : nom, <strong>chemin physique</strong>, <strong>liaison</strong> (type <code>http</code>, port <code>80</code>, nom d’hôte <code>www.domaine.local</code>).</li>
    <li><strong>DNS</strong> : créer un enregistrement <strong>A</strong> (ou CNAME) <code>www</code> → IP du serveur (voir <a href="/procedure-dns">DNS</a>).</li>
    <li><strong>NTFS</strong> : autoriser le groupe <code>IIS_IUSRS</code> en <strong>lecture</strong> sur le dossier du site (onglet Sécurité).</li>
    <li><strong>Pare-feu</strong> : autoriser le <strong>port 80</strong> (HTTP) entrant.</li>
  </ol>` }),

  block('heading', { level: 2, text: '⑥ Tester' }),
  block('html', { html: '<p>Depuis un <strong>poste client</strong> du réseau, ouvrir <code>http://www.domaine.local</code>. En cas d’échec, dérouler dans l’ordre :</p>' }),
  cmd('ping SRV-WEB01\nnslookup www.domaine.local\nREM puis tester http:// dans le navigateur'),
  note('yellow', '🛠️ Si ça ne s’affiche pas', '<ul><li>Nom non résolu → <strong>enregistrement DNS A</strong> manquant, ou mauvais DNS sur le client.</li><li>« 403/401 » → <strong>permissions NTFS</strong> (<code>IIS_IUSRS</code>) ou document par défaut.</li><li>Page injoignable → <strong>port 80</strong> bloqué par le pare-feu, ou site arrêté dans IIS.</li></ul><p>Détails : <a href="/depannage">Dépannage</a>.</p>'),

  note('green', '🎯 À retenir', '<p><strong>VM Hyper-V</strong> (gén. 2, VHDX, commutateur, ISO) → <strong>Windows Server</strong> (Desktop Experience) → <strong>nom + IP fixe (.254)</strong> → rôle <strong>IIS</strong> → <strong>site + liaison</strong> + DNS + NTFS + pare-feu → test depuis un client. Procédures liées : <a href="/procedure-vm-hyperv">VM Hyper-V</a>, <a href="/procedure-iis">IIS</a>, <a href="/procedure-dns">DNS</a>, <a href="/hebergement-web">cours DNS + IIS</a>.</p>'),
];

const PAGE = {
  slug: SLUG,
  title: 'Installer un serveur IIS sur une VM Hyper-V',
  excerpt: 'Procédure de bout en bout : créer une VM Hyper-V, installer Windows Server, configurer nom & IP fixe, installer le rôle IIS, publier un site (liaison, DNS, NTFS, pare-feu) et tester.',
};

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

  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

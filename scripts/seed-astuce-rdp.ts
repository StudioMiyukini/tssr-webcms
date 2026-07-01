/* Astuce « Activer le Bureau à distance (RDP) » : Windows 10 / 11 et Windows Server.
   Méthodes GUI (Paramètres / Gestionnaire de serveur / sysdm.cpl), autoriser des utilisateurs,
   pare-feu, connexion depuis un client (mstsc), raccourci PowerShell, sécurité.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-astuce-rdp.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const accordion = (it: Array<[string, string]>) => block('accordion', { items: it.map(([title, text]) => ({ title, text, href: '' })) });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pre = (code: string) => `<div style="margin:6px 0 12px"><div class="meta" style="font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">PowerShell (admin)</div><pre style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;overflow-x:auto;font-size:12.5px;line-height:1.55;margin:0"><code>${esc(code)}</code></pre></div>`;
const shot = (cap: string) => block('html', { html: `<figure style="margin:10px 0 14px"><div style="border:2px dashed var(--border);border-radius:10px;background:var(--surface-2);padding:26px 16px;text-align:center;color:var(--text-muted)"><div style="font-size:24px">📷</div><div style="font-size:12.5px;margin-top:2px;font-weight:600">Capture à insérer</div></div><figcaption class="meta" style="margin-top:6px;font-size:12.5px">${cap}</figcaption></figure>` });

const C = { net: '#2563eb', dev: '#059669', warn: '#d97706', grey: '#64748b', slate: '#475569' };
const wrap = (w: number, h: number, inner: string) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="max-width:${w}px;width:100%;height:auto;margin:8px 0 14px;font-family:system-ui,sans-serif">${inner}</svg>`;
const svgRdp = wrap(640, 150,
  `<rect x="30" y="40" width="180" height="66" rx="8" fill="${C.net}" fill-opacity="0.1" stroke="${C.net}" stroke-width="1.7"/><text x="120" y="68" text-anchor="middle" font-size="13" fill="${C.net}" font-weight="bold">💻 Client (mstsc)</text><text x="120" y="88" text-anchor="middle" font-size="10.5" fill="${C.slate}">prend la main a distance</text>`
  + `<rect x="430" y="40" width="180" height="66" rx="8" fill="${C.dev}" fill-opacity="0.1" stroke="${C.dev}" stroke-width="1.7"/><text x="520" y="64" text-anchor="middle" font-size="13" fill="${C.dev}" font-weight="bold">🖥️ Machine cible</text><text x="520" y="84" text-anchor="middle" font-size="10.5" fill="${C.slate}">Bureau a distance ACTIVE</text>`
  + `<line x1="210" y1="73" x2="422" y2="73" stroke="${C.slate}" stroke-width="2"/><path d="M430 73 l-9 -5 l0 10 z" fill="${C.slate}"/>`
  + `<text x="320" y="64" text-anchor="middle" font-size="11" fill="${C.warn}" font-weight="bold">RDP — port TCP 3389</text>`
  + `<text x="320" y="130" text-anchor="middle" font-size="11" fill="${C.grey}">Il faut : activer le Bureau a distance sur la cible + autoriser l'utilisateur + ouvrir le pare-feu.</text>`);

// ===================================================================================
// PAGE
// ===================================================================================
const SLUG = 'astuce-bureau-a-distance';
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Astuce · Windows', title: 'Activer le Bureau à distance (RDP)', subtitle: 'Prendre la main sur une machine à distance — Windows 10, 11 et Windows Server.' }),
  block('html', { html: '<p>Le <strong>Bureau à distance</strong> (RDP — <em>Remote Desktop Protocol</em>) permet de <strong>prendre le contrôle graphique d’une machine à distance</strong>, comme si on était devant. Très pratique pour administrer un serveur sans écran. Il faut l’<strong>activer sur la machine cible</strong>, <strong>autoriser les utilisateurs</strong> concernés et <strong>ouvrir le pare-feu</strong>. Le RDP écoute sur le <strong>port TCP 3389</strong>.</p>' }),
  block('html', { html: svgRdp }),
  note('yellow', '🔒 Sécurité', '<p>Le Bureau à distance <strong>ouvre une porte d’accès</strong> : ne l’active que sur un <strong>réseau de confiance</strong> (labo, LAN d’entreprise), avec des <strong>mots de passe forts</strong>. Laisse coché « <strong>authentification au niveau du réseau (NLA)</strong> » : le client doit s’authentifier <em>avant</em> d’ouvrir la session. À ne pas exposer directement sur Internet.</p>'),

  block('heading', { level: 2, text: '🪟 Windows 10 / 11' }),
  block('list', { listItems: [
    'Paramètres → Système → Bureau à distance.',
    'Activer « Bureau à distance » → Confirmer.',
    'Garder « Exiger que les appareils utilisent l’authentification NLA » activé.',
    'Noter le nom du PC affiché (il servira à se connecter).',
  ] }),
  shot('Paramètres → Système → Bureau à distance : l’interrupteur sur « Activé ».'),
  note('blue', '💡 Astuce édition', '<p>Le Bureau à distance <strong>entrant</strong> n’est disponible que sur les éditions <strong>Pro / Entreprise / Éducation</strong> (pas sur Windows Famille). Toutes les éditions peuvent en revanche <strong>se connecter</strong> à une autre machine.</p>'),

  block('heading', { level: 2, text: '🖥️ Windows Server' }),
  block('list', { listItems: [
    'Gestionnaire de serveur → Serveur local.',
    'Ligne « Bureau à distance » : cliquer sur « Désactivé ».',
    'Dans Propriétés système → onglet « Utilisation à distance » : cocher « Autoriser les connexions à distance à cet ordinateur ».',
    'Laisser cochée l’option NLA (« N’autoriser que … authentification au niveau du réseau »).',
  ] }),
  shot('Gestionnaire de serveur → Serveur local → « Bureau à distance : Désactivé » (à cliquer).'),

  block('heading', { level: 2, text: '⚙️ Méthode commune : sysdm.cpl' }),
  block('html', { html: '<p>Sur toutes les versions, on peut passer directement par les Propriétés système :</p>' }),
  block('list', { listItems: [
    'Win+R → sysdm.cpl → onglet « Utilisation à distance ».',
    'Cocher « Autoriser les connexions à distance à cet ordinateur » (+ NLA).',
    'Cliquer sur « Sélectionner des utilisateurs… » pour autoriser les comptes voulus.',
  ] }),
  shot('sysdm.cpl → onglet « Utilisation à distance » avec l’option activée.'),

  block('heading', { level: 2, text: '👤 Autoriser des utilisateurs' }),
  block('html', { html: '<p>Par défaut, seuls les <strong>administrateurs</strong> peuvent se connecter. Pour autoriser d’autres comptes : bouton <strong>« Sélectionner des utilisateurs… »</strong> (ou groupe local <strong>« Utilisateurs du Bureau à distance »</strong>) → ajouter les utilisateurs/groupes du domaine concernés.</p>' }),

  block('heading', { level: 2, text: '🧱 Pare-feu' }),
  block('html', { html: '<p>Activer le Bureau à distance par l’interface <strong>ouvre automatiquement</strong> la règle de pare-feu correspondante. Si l’accès échoue quand même, vérifie dans <code>wf.msc</code> que le <strong>groupe de règles « Bureau à distance »</strong> (Remote Desktop, TCP <strong>3389</strong>) est <strong>activé</strong> pour le bon profil réseau (voir l’astuce <a href="/pages/astuce-pare-feu-ping">pare-feu / ping</a> pour la manip).</p>' }),

  block('heading', { level: 2, text: '🔗 Se connecter depuis un client' }),
  block('list', { listItems: [
    'Win+R → mstsc (Connexion Bureau à distance).',
    'Saisir le nom ou l’adresse IP de la machine cible → Connexion.',
    'S’authentifier avec un compte autorisé (domaine\\utilisateur ou compte local).',
  ] }),
  shot('Fenêtre « Connexion Bureau à distance » (mstsc) avec le nom/IP de la machine.'),

  block('heading', { level: 2, text: '⚡ Raccourci (PowerShell)' }),
  block('html', { html: '<p>Pour tout activer en une fois, en <strong>administrateur</strong> :</p>' }),
  block('html', { html: pre('# Activer les connexions Bureau à distance\nSet-ItemProperty -Path \'HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server\' -Name fDenyTSConnections -Value 0\n\n# Exiger l\'authentification NLA (recommande)\nSet-ItemProperty -Path \'HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server\\WinStations\\RDP-Tcp\' -Name UserAuthentication -Value 1\n\n# Ouvrir le pare-feu pour le Bureau a distance\nEnable-NetFirewallRule -DisplayGroup \'Bureau a distance\'') }),
  note('blue', 'ℹ️ Nom du groupe de pare-feu', '<p>Le libellé du groupe dépend de la langue : <code>"Bureau à distance"</code> (français) ou <code>"Remote Desktop"</code> (anglais). Adapte la dernière commande en conséquence.</p>'),

  note('green', '🎯 À retenir', '<p><strong>Activer</strong> le Bureau à distance sur la cible (Paramètres / Gestionnaire de serveur / <code>sysdm.cpl</code>), <strong>autoriser</strong> les utilisateurs, <strong>ouvrir le pare-feu</strong> (port <strong>3389</strong>), puis se connecter avec <code>mstsc</code>. Garde le <strong>NLA</strong> activé. Même principe sur Windows 10, 11 et Server. Voir aussi : <a href="/pages/astuce-pare-feu-ping">autoriser le ping</a>, <a href="/pages/procedure-installation-active-directory">procédure Active Directory</a>.</p>'),
];

const PAGE = {
  slug: SLUG,
  title: 'Activer le Bureau à distance (RDP)',
  excerpt: 'Activer le Bureau à distance (RDP) sur Windows 10, 11 et Windows Server : méthodes GUI (Paramètres / Gestionnaire de serveur / sysdm.cpl), autoriser des utilisateurs, pare-feu (port 3389), connexion via mstsc et raccourci PowerShell.',
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

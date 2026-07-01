/* Astuce « Autoriser le ping (ICMP) dans le pare-feu Windows » : Windows Server, Windows 10 & 11.
   Pourquoi le ping échoue par défaut, et la méthode par interface graphique (wf.msc)
   + IPv4/IPv6, profils réseau, annulation, test (ping en cmd). Catégorie « Astuces ».
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-astuce-ping-firewall.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pre = (code: string) => `<pre style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;overflow-x:auto;font-size:13px;line-height:1.6;margin:6px 0 12px"><code>${esc(code)}</code></pre>`;
const figure = (url: string, cap: string) => `<figure style="margin:10px 0 14px;text-align:center"><img src="${url}" alt="${cap}" loading="lazy" style="max-width:100%;border:1px solid var(--border);border-radius:8px"/><figcaption class="meta" style="margin-top:6px;font-size:12.5px">${cap}</figcaption></figure>`;

// ===================================================================================
// Schéma SVG (ASCII)
// ===================================================================================
const C = { net: '#2563eb', dev: '#059669', warn: '#d97706', danger: '#dc2626', grey: '#64748b', slate: '#475569', ok: '#16a34a' };
const wrap = (w: number, h: number, inner: string) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="max-width:${w}px;width:100%;height:auto;margin:8px 0 14px;font-family:system-ui,sans-serif">${inner}</svg>`;
const svgPing = wrap(640, 210,
  `<text x="320" y="20" text-anchor="middle" font-size="12" fill="${C.slate}" font-weight="bold">Le ping = ICMP Echo Request / Reply — bloque par defaut en entree</text>`
  + `<rect x="24" y="60" width="150" height="58" rx="8" fill="${C.net}" fill-opacity="0.1" stroke="${C.net}" stroke-width="1.6"/><text x="99" y="86" text-anchor="middle" font-size="12" fill="${C.net}" font-weight="bold">PC source</text><text x="99" y="103" text-anchor="middle" font-size="10.5" fill="${C.slate}">envoie le ping</text>`
  + `<rect x="280" y="46" width="80" height="120" rx="8" fill="${C.warn}" fill-opacity="0.12" stroke="${C.warn}" stroke-width="1.7"/><text x="320" y="100" text-anchor="middle" font-size="22">🛡️</text><text x="320" y="128" text-anchor="middle" font-size="10.5" fill="${C.warn}" font-weight="bold">Pare-feu</text>`
  + `<rect x="466" y="60" width="150" height="58" rx="8" fill="${C.dev}" fill-opacity="0.1" stroke="${C.dev}" stroke-width="1.6"/><text x="541" y="86" text-anchor="middle" font-size="12" fill="${C.dev}" font-weight="bold">Cible (Windows)</text><text x="541" y="103" text-anchor="middle" font-size="10.5" fill="${C.slate}">doit repondre</text>`
  + `<line x1="174" y1="78" x2="278" y2="78" stroke="${C.slate}" stroke-width="2"/><path d="M280 78 l-8 -4 l0 8 z" fill="${C.slate}"/><text x="227" y="72" text-anchor="middle" font-size="9.5" fill="${C.slate}">Echo Request (type 8)</text>`
  + `<line x1="362" y1="78" x2="464" y2="78" stroke="${C.slate}" stroke-width="2" stroke-dasharray="5 4"/><path d="M466 78 l-8 -4 l0 8 z" fill="${C.slate}"/>`
  + `<line x1="466" y1="100" x2="362" y2="100" stroke="${C.dev}" stroke-width="2"/><path d="M360 100 l8 -4 l0 8 z" fill="${C.dev}"/><text x="414" y="116" text-anchor="middle" font-size="9.5" fill="${C.dev}">Echo Reply (type 0)</text>`
  + `<text x="320" y="190" text-anchor="middle" font-size="11" fill="${C.danger}" font-weight="bold">Par defaut : la cible bloque la demande -> "Delai d'attente depasse"</text>`
  + `<text x="320" y="205" text-anchor="middle" font-size="11" fill="${C.ok}" font-weight="bold">Apres avoir autorise l'ICMP entrant : le ping repond</text>`);

// ===================================================================================
// PAGE
// ===================================================================================
const SLUG = 'astuce-pare-feu-ping';
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Astuce · Windows', title: 'Autoriser le ping (ICMP) dans le pare-feu', subtitle: 'Rendre une machine « pingable » — Windows Server, Windows 10 et Windows 11.' }),
  block('html', { html: '<p>Tu fais un <code>ping</code> vers une machine Windows et tu obtiens <em>« Délai d’attente de la demande dépassé »</em> alors que le réseau est bon ? C’est <strong>normal</strong> : par défaut, le <strong>Pare-feu Windows Defender bloque les demandes d’écho ICMP entrantes</strong>. Voici comment l’autoriser proprement.</p>' }),
  block('html', { html: svgPing }),
  note('blue', 'ℹ️ Rappel', '<p>Le <code>ping</code> repose sur le protocole <strong>ICMP</strong> : une <strong>demande d’écho</strong> (<em>Echo Request</em>, ICMPv4 <strong>type 8</strong>) et une <strong>réponse d’écho</strong> (<em>Echo Reply</em>, type 0). Il faut autoriser la <strong>demande entrante</strong> sur la machine qui doit répondre. À ouvrir <strong>sur la cible</strong>, pas sur la source.</p>'),

  block('heading', { level: 2, text: '🖱️ La méthode : interface graphique (wf.msc)' }),
  block('html', { html: '<p>On passe par le <strong>Pare-feu Windows Defender avec fonctions avancées de sécurité</strong>. <strong>Ouvre une session administrateur</strong>, puis :</p>' }),
  block('html', { html: figure('/uploads/mr0g4oj9-g9mccy-pare-feu-ouvrir.png', 'Ouvrir l’outil : menu Démarrer → rechercher « pare-feu » → « Pare-feu Windows Defender avec fonctions avancées de sécurité ».') }),
  block('list', { listItems: [
    'Ouvre wf.msc (menu Démarrer → tape « wf.msc », ou Panneau de configuration → Système et sécurité → Pare-feu Windows Defender → Paramètres avancés).',
    'Dans le volet de gauche, clique sur « Règles de trafic entrant ».',
    'Repère la règle « Partage de fichiers et d’imprimantes (Demande d’écho - Trafic entrant ICMPv4) » — le libellé peut varier (« ICMPv4 entrant » / « ICMPv4-In »).',
    'Clic droit dessus → « Activer la règle » : la pastille passe au vert dans la colonne Activée.',
    'Fais de même pour la version ICMPv6 (« Demande d’écho - ICMPv6 entrant ») si tu utilises IPv6.',
  ] }),
  block('html', { html: figure('/uploads/mr0dfne1-vgqtbc-pare-feu-regle-echo-icmpv4.png', 'Règles de trafic entrant : la règle « Partage de fichiers et d’imprimantes (Demande d’écho - Trafic entrant ICMPv4) » sélectionnée — clic droit → Activer la règle (pastille verte = activée).') }),
  note('yellow', '🎯 Bien choisir la règle', '<p>Active la règle pour le <strong>profil</strong> correspondant à ton réseau (colonne <strong>Profil</strong> : Domaine / Privé / Public / Tout). Il existe aussi une variante <strong>« (restrictif) »</strong> de la demande d’écho : version plus limitée (souvent réservée au sous-réseau local), à n’activer que si tu sais pourquoi.</p>'),
  block('html', { html: figure('/uploads/mr0dfnt5-f8vuyq-pare-feu-liste-restrictif.png', 'Plus bas dans la liste : la variante « Partage de fichiers et d’imprimantes (restrictif) (Demande d’écho - ICMPv4 entrant) ».') }),
  note('blue', '↩️ Annuler', '<p>Pour refermer : reviens dans <strong>Règles de trafic entrant</strong>, clic droit sur la règle → <strong>Désactiver la règle</strong>.</p>'),
  block('heading', { level: 2, text: '🧩 Selon le contexte : d’autres groupes de règles' }),
  block('html', { html: '<p>La <strong>demande d’écho</strong> existe dans <strong>plusieurs groupes</strong> de règles. Il suffit qu’<strong>une</strong> règle d’écho entrant soit <strong>activée pour le bon profil</strong> pour que le ping réponde. Exemples vus sur une VM :</p>' }),
  block('html', { html: figure('/uploads/mr0dfo0k-8sq33g-pare-feu-analyse-vm.png', 'Groupe « Analyse de l’ordinateur virtuel » : règles « Demande d’écho - Trafic entrant ICMPv4 / ICMPv6 » (utile sur une VM Hyper-V).') }),
  block('html', { html: figure('/uploads/mr0dfo1u-kdix2b-pare-feu-diagnostics-sortant.png', 'Groupe « Diagnostics de réseau de base » : la règle de demande d’écho ICMPv4 sortant (côté machine qui émet le ping).') }),

  block('heading', { level: 2, text: '🪟 Windows Server, Windows 10, Windows 11 : quelle différence ?' }),
  block('html', { html: '<p><strong>Aucune sur le principe.</strong> Les trois utilisent le <strong>même Pare-feu Windows Defender</strong> et la <strong>même console <code>wf.msc</code></strong>. Les étapes ci-dessus sont <strong>identiques</strong> partout — seul le <strong>profil réseau</strong> actif change un peu :</p>' }),
  block('html', { html: `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:600px;font-size:13.5px"><thead><tr style="background:var(--surface-2)">${['Système', 'Mêmes étapes ?', 'À surveiller'].map(c => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${c}</th>`).join('')}</tr></thead><tbody>` +
    [
      ['Windows Server 2016 / 2019 / 2022', '✅ oui', 'Une fois le serveur joint au domaine, le profil <b>Domaine</b> est actif → autorise sur ce profil. Souvent géré par <b>GPO</b> en entreprise.'],
      ['Windows 10', '✅ oui', 'Profil <b>Privé</b> ou <b>Public</b> selon le réseau ; en réseau « public » le ping reste bloqué tant que la règle ne couvre pas ce profil.'],
      ['Windows 11', '✅ oui', 'Identique à Windows 10 (même pare-feu).'],
    ].map(r => `<tr><td style="padding:8px 10px;border:1px solid var(--border);font-weight:600">${r[0]}</td><td style="padding:8px 10px;border:1px solid var(--border);text-align:center">${r[1]}</td><td style="padding:8px 10px;border:1px solid var(--border)">${r[2]}</td></tr>`).join('') +
    `</tbody></table></div>` }),
  note('yellow', '🌐 Profils réseau (le piège classique)', '<p>Une règle ne s’applique qu’aux <strong>profils</strong> qu’elle couvre : <strong>Domaine</strong>, <strong>Privé</strong>, <strong>Public</strong>. Si le ping échoue toujours, vérifie le <strong>profil actif</strong> de ta connexion (Paramètres → Réseau) et que la règle activée couvre ce profil (colonne <strong>Profil</strong> dans <code>wf.msc</code>). En entreprise, ces règles sont fréquemment imposées par <strong>stratégie de groupe (GPO)</strong>.</p>'),

  block('heading', { level: 2, text: '✅ Tester' }),
  block('html', { html: '<p>Depuis une <strong>autre machine</strong> du réseau, dans l’<strong>invite de commandes (cmd)</strong> — <code>ping</code> en IPv4 puis, si besoin, en IPv6 :</p>' }),
  block('html', { html: pre('ping 192.168.10.11\nping -6 nom-de-la-machine') }),
  block('html', { html: '<p>Tu dois voir des <em>« Réponse de … »</em>. Côté cible, tu peux aussi vérifier dans <code>wf.msc</code> que la règle de demande d’écho est bien <strong>Activée</strong> (pastille verte, colonne <em>Activée</em>).</p>' }),
  note('green', '🎯 À retenir', '<p>Le ping est bloqué par défaut car l’<strong>ICMP entrant</strong> est fermé. On l’autorise <strong>sur la cible</strong>, dans <code>wf.msc</code> → <strong>Règles de trafic entrant</strong>, en <strong>activant</strong> la règle « Partage de fichiers et d’imprimantes (Demande d’écho - ICMPv4 / ICMPv6 entrant) ». <strong>Même méthode sur Server, Windows 10 et 11.</strong> Utile pour les TP : <a href="/pages/procedure-installation-active-directory">procédure Active Directory</a> et <a href="/pages/hebergement-web">hébergement web</a>.</p>'),
];

const PAGE = {
  slug: SLUG,
  title: 'Autoriser le ping (ICMP) dans le pare-feu',
  excerpt: 'Rendre une machine Windows « pingable » : autoriser l’ICMP entrant dans le pare-feu via l’interface graphique (wf.msc). Identique sur Windows Server, Windows 10 et 11.',
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

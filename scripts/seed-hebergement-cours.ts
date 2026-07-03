/* Page de cours « Hébergement web » (concepts) — d'après la présentation Adrar « Hébergement WEB ».
   Qu'est-ce qu'un hébergement, l'hébergeur, les types d'hébergement, le DNS et ses enregistrements,
   les registrars, la structure d'un FQDN, la résolution DNS et les 13 serveurs racine. Schémas SVG.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-hebergement-cours.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const SLUG = 'hebergement';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const th = (c: string[]) => `<tr style="background:var(--surface-2)">${c.map(x => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${x}</th>`).join('')}</tr>`;

// ===================================================================================
// Schémas SVG
// ===================================================================================
const C = { net: '#2563eb', ok: '#16a34a', warn: '#d97706', purple: '#7c3aed', cyan: '#0891b2', slate: '#475569', grey: '#64748b' };
const wrap = (w: number, h: number, inner: string) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="max-width:${w}px;width:100%;height:auto;margin:8px 0 14px;font-family:system-ui,sans-serif">${inner}</svg>`;

// 1) Types d'hébergement (du plus partagé au plus dédié)
const svgTypes = wrap(680, 190, (() => {
  const cards: Array<[string, string, string, string]> = [
    ['🏘️', 'Mutualisé', 'serveur partagé entre de nombreux sites — économique', C.ok],
    ['🧱', 'VPS', 'serveur virtuel dédié, ressources garanties', C.net],
    ['🖥️', 'Dédié', 'un serveur physique entier pour un seul client', C.purple],
    ['☁️', 'Cloud', 'ressources élastiques, facturées à l’usage', C.cyan],
  ];
  const w = 158, gap = 12, y = 42, h = 118; let x = 10, s = '';
  s += `<text x="340" y="22" text-anchor="middle" font-size="12" fill="${C.slate}">← plus partagé / économique          plus dédié / puissant →</text>`;
  s += `<line x1="10" y1="32" x2="670" y2="32" stroke="${C.grey}" stroke-width="1.4" marker-end="url(#a)"/>`;
  cards.forEach(([ic, t, d]) => {
    const col = cards.find(c => c[1] === t)![3];
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${col}" fill-opacity="0.08" stroke="${col}" stroke-width="1.6"/>`;
    s += `<text x="${x + w / 2}" y="${y + 34}" text-anchor="middle" font-size="26">${ic}</text>`;
    s += `<text x="${x + w / 2}" y="${y + 58}" text-anchor="middle" font-size="14" font-weight="bold" fill="${col}">${t}</text>`;
    // description sur 2 lignes
    const words = d.split(' '); let line = '', ly = y + 78;
    words.forEach(wd => { if ((line + wd).length > 22) { s += `<text x="${x + w / 2}" y="${ly}" text-anchor="middle" font-size="10.5" fill="${C.slate}">${line.trim()}</text>`; line = wd + ' '; ly += 14; } else line += wd + ' '; });
    s += `<text x="${x + w / 2}" y="${ly}" text-anchor="middle" font-size="10.5" fill="${C.slate}">${line.trim()}</text>`;
    x += w + gap;
  });
  s += `<defs><marker id="a" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0 0 L9 4.5 L0 9 z" fill="${C.grey}"/></marker></defs>`;
  return s;
})());

// 2) Structure d'un FQDN : www.example.com.
const svgFqdn = wrap(660, 170, (() => {
  const segs: Array<[string, string, string]> = [
    ['www', 'Hôte (sous-domaine)', C.net],
    ['example', 'Domaine (SLD)', C.ok],
    ['com', 'Extension (TLD)', C.warn],
    ['.', 'Racine', C.purple],
  ];
  const w = 150, gap = 10, y = 54, h = 46; let x = 14, s = '';
  s += `<text x="330" y="30" text-anchor="middle" font-size="13" fill="${C.slate}" font-weight="bold">FQDN — Fully Qualified Domain Name</text>`;
  segs.forEach(([t, lab], i) => {
    const col = segs[i][2];
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${col}" fill-opacity="0.1" stroke="${col}" stroke-width="1.6"/>`;
    s += `<text x="${x + w / 2}" y="${y + 30}" text-anchor="middle" font-size="18" font-weight="bold" fill="${col}" font-family="ui-monospace,monospace">${t}</text>`;
    s += `<text x="${x + w / 2}" y="${y + h + 20}" text-anchor="middle" font-size="11" fill="${C.slate}">${lab}</text>`;
    if (i < segs.length - 1) s += `<text x="${x + w + gap / 2 - 2}" y="${y + 32}" text-anchor="middle" font-size="20" fill="${C.grey}" font-weight="bold">.</text>`;
    x += w + gap;
  });
  s += `<text x="330" y="150" text-anchor="middle" font-size="11" fill="${C.grey}">On lit de droite (le plus général) à gauche (le plus précis). Le point final = la racine.</text>`;
  return s;
})());

// 3) Résolution de nom DNS (étapes)
const svgDnsFlow = wrap(660, 250, (() => {
  const nodes: Array<[number, string, string, string]> = [
    [70, 'Client', 'navigateur', C.purple],
    [230, 'Résolveur DNS', '(FAI / serveur)', C.net],
    [400, 'Racine → TLD', '.com', C.warn],
    [560, 'Serveur autoritaire', 'zone example.com', C.ok],
  ];
  let s = '';
  nodes.forEach(([x, t, sub, col]) => {
    s += `<rect x="${x - 60}" y="14" width="120" height="46" rx="8" fill="${col}" fill-opacity="0.1" stroke="${col}" stroke-width="1.5"/>`;
    s += `<text x="${x}" y="34" text-anchor="middle" font-size="11.5" font-weight="bold" fill="${col}">${t}</text>`;
    s += `<text x="${x}" y="49" text-anchor="middle" font-size="9.5" fill="${C.slate}">${sub}</text>`;
    s += `<line x1="${x}" y1="60" x2="${x}" y2="236" stroke="#cbd5e1" stroke-width="1.3" stroke-dasharray="3 4"/>`;
  });
  const arr = (x1: number, y: number, x2: number, txt: string, col: string, dash = false) => {
    const d = x2 > x1 ? 1 : -1;
    return `<line x1="${x1}" y1="${y}" x2="${x2 - d * 7}" y2="${y}" stroke="${col}" stroke-width="1.8"${dash ? ' stroke-dasharray="5 4"' : ''}/><path d="M${x2} ${y} l${-d * 8} -4 l0 8 z" fill="${col}"/><text x="${(x1 + x2) / 2}" y="${y - 5}" text-anchor="middle" font-size="9.5" fill="${C.slate}">${txt}</text>`;
  };
  s += arr(70, 84, 230, '1. quelle IP pour www.example.com ?', C.slate);
  s += arr(230, 116, 400, '2. demande à la racine puis au .com', C.slate);
  s += arr(400, 148, 560, '3. qui fait autorité sur example.com ?', C.slate);
  s += arr(560, 180, 230, '4. reponse : 93.184.216.34', C.ok, true);
  s += arr(230, 210, 70, '5. IP renvoyee (mise en cache)', C.ok, true);
  s += `<text x="330" y="242" text-anchor="middle" font-size="10.5" fill="${C.grey}">Le navigateur contacte ensuite le serveur web à cette IP. Les réponses sont mises en cache.</text>`;
  return s;
})());

// 4) Les 13 serveurs racine
const svgRoot = wrap(660, 190, (() => {
  let s = '';
  s += `<rect x="180" y="14" width="300" height="44" rx="10" fill="${C.purple}" fill-opacity="0.1" stroke="${C.purple}" stroke-width="1.7"/>`;
  s += `<text x="330" y="33" text-anchor="middle" font-size="12.5" font-weight="bold" fill="${C.purple}">Racine ( . ) — 13 serveurs racine A → M</text>`;
  s += `<text x="330" y="49" text-anchor="middle" font-size="10" fill="${C.slate}">répartis mondialement sur des centaines d’instances</text>`;
  const tlds = ['.com', '.org', '.fr', '.net'];
  const w = 120, gap = 24; let x = 90;
  tlds.forEach(t => {
    s += `<line x1="330" y1="58" x2="${x + w / 2}" y2="96" stroke="${C.grey}" stroke-width="1.2"/>`;
    s += `<rect x="${x}" y="96" width="${w}" height="38" rx="8" fill="${C.warn}" fill-opacity="0.1" stroke="${C.warn}" stroke-width="1.4"/>`;
    s += `<text x="${x + w / 2}" y="${96 + 24}" text-anchor="middle" font-size="12" font-weight="bold" fill="${C.warn}" font-family="ui-monospace,monospace">${t}</text>`;
    x += w + gap;
  });
  s += `<text x="330" y="172" text-anchor="middle" font-size="11" fill="${C.slate}">Les serveurs racine orientent vers les serveurs des <tspan font-weight="bold">TLD</tspan>, qui pointent vers les zones des domaines.</text>`;
  return s;
})());

// ===================================================================================
// PAGE
// ===================================================================================
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Réseau / Web', title: 'L’hébergement web', subtitle: 'Publier un site sur Internet : l’hébergeur, les types d’hébergement, le DNS, les registrars et le nom de domaine.' }),

  block('heading', { level: 2, text: '🌐 Qu’est-ce qu’un hébergement web ?' }),
  block('html', { html: '<p>Un <strong>hébergement web</strong> permet de <strong>stocker un site Internet</strong>, de le rendre <strong>accessible 24h/24</strong> et de <strong>publier des pages web</strong> sur Internet. Les fichiers du site sont <strong>stockés sur un serveur connecté au réseau</strong>, mis à disposition par des <strong>hébergeurs web</strong>.</p>' }),

  block('heading', { level: 2, text: '🏢 L’hébergeur web' }),
  block('html', { html: '<p>Un <strong>hébergeur web</strong> est une entité qui met à disposition des sites web sur Internet. Il fournit du <strong>stockage</strong>, une <strong>connexion Internet</strong>, des <strong>ressources réseau</strong> et des <strong>services d’hébergement</strong>. Il assure généralement :</p>' }),
  block('list', { listItems: [
    'la disponibilité des serveurs et la connectivité Internet ;',
    'la sécurité de l’infrastructure ;',
    'les sauvegardes (selon l’offre) ;',
    'l’alimentation électrique et la climatisation ;',
    'la maintenance matérielle et système.',
  ] }),

  block('heading', { level: 2, text: '🗂️ Les types d’hébergement' }),
  block('html', { html: svgTypes }),
  block('html', { html: `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:560px;font-size:13.5px"><thead>${th(['Type', 'Principe', 'Pour qui'])}</thead><tbody>`
    + [
      ['<strong>Mutualisé</strong>', 'Un serveur partagé entre de nombreux sites.', 'Petits sites, budget serré.'],
      ['<strong>VPS</strong>', 'Serveur virtuel dédié, ressources garanties.', 'Bon compromis coût / contrôle.'],
      ['<strong>Dédié</strong>', 'Un serveur physique entier pour un seul client.', 'Performance et contrôle maximum.'],
      ['<strong>Cloud</strong>', 'Ressources élastiques à la demande, facturées à l’usage.', 'Charge variable, montée en charge.'],
    ].map(r => `<tr>${r.map((c, i) => `<td style="padding:8px 10px;border:1px solid var(--border)${i === 0 ? '' : ';color:var(--text-muted)'}">${c}</td>`).join('')}</tr>`).join('')
    + `</tbody></table></div>` }),

  block('heading', { level: 2, text: '🟢 Le DNS : la résolution des noms' }),
  block('html', { html: '<p>Le <strong>DNS</strong> (<em>Domain Name System</em>) <strong>traduit un nom de domaine en adresse IP</strong> : c’est l’<strong>annuaire d’Internet</strong>. L’utilisateur saisit un nom (<code>www.example.com</code>), le DNS recherche l’IP correspondante (<code>93.184.216.34</code>), puis le navigateur contacte le serveur web grâce à cette IP. Sans DNS, il faudrait retenir les adresses IP de chaque site.</p>' }),
  block('html', { html: svgDnsFlow }),

  block('heading', { level: 2, text: '📇 Les principaux enregistrements DNS' }),
  block('html', { html: `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:520px;font-size:13.5px"><thead>${th(['Type', 'Rôle'])}</thead><tbody>`
    + [
      ['A', 'Nom → adresse IPv4'],
      ['AAAA', 'Nom → adresse IPv6'],
      ['CNAME', 'Alias vers un autre nom'],
      ['MX', 'Serveur de messagerie (mail)'],
      ['NS', 'Serveur DNS faisant autorité sur la zone'],
      ['SOA', 'Informations de la zone (mail de l’admin, serveur DNS primaire, n° de série…)'],
    ].map(r => `<tr><td style="padding:8px 10px;border:1px solid var(--border);font-weight:700;font-family:ui-monospace,monospace">${r[0]}</td><td style="padding:8px 10px;border:1px solid var(--border)">${r[1]}</td></tr>`).join('')
    + `</tbody></table></div>` }),
  note('gray', '➕ Aussi utiles', '<p><strong>PTR</strong> (IP → nom, zone inversée) et <strong>SRV</strong> (localise un service : hôte + port — essentiel dans Active Directory pour LDAP et Kerberos).</p>'),

  block('heading', { level: 2, text: '🏷️ Les registrars (noms de domaine)' }),
  block('html', { html: '<p>Un <strong>nom de domaine</strong> remplace une adresse IP difficile à mémoriser. On le réserve chez un <strong>registrar</strong> (bureau d’enregistrement), qui vérifie sa <strong>disponibilité</strong> et le gère. Les registrars sont <strong>accrédités par l’ICANN</strong> (au niveau mondial) ou l’<strong>AFNIC</strong> (pour le <code>.fr</code>). Un domaine se <strong>loue de 6 mois à 10 ans</strong> et doit être <strong>renouvelé</strong> pour être conservé. Exemples : <strong>OVHcloud</strong>, <strong>GoDaddy</strong>, <strong>Namecheap</strong>.</p>' }),

  block('heading', { level: 2, text: '🔤 La structure d’une adresse web (FQDN)' }),
  block('html', { html: svgFqdn }),
  block('html', { html: '<p>Un <strong>FQDN</strong> (<em>Fully Qualified Domain Name</em>) est le nom <strong>complet</strong> d’une machine : <code>www.example.com.</code> On le lit de droite à gauche — de la <strong>racine</strong> (le point final) au <strong>TLD</strong> (<code>com</code>), au <strong>domaine</strong> (<code>example</code>), jusqu’à l’<strong>hôte</strong> (<code>www</code>).</p>' }),

  block('heading', { level: 2, text: '🌍 Les 13 serveurs racine' }),
  block('html', { html: svgRoot }),
  block('html', { html: '<p>Au sommet du système DNS mondial se trouvent <strong>13 serveurs racine d’origine</strong>, nommés de <strong>A à M</strong> (aujourd’hui répartis sur des centaines d’instances physiques). Ils font autorité sur les <strong>TLD</strong> (<code>.com</code>, <code>.fr</code>…) et orientent les requêtes vers les bons serveurs DNS de zone.</p>' }),

  note('green', '🎯 À retenir', '<p><strong>Héberger un site</strong> = le stocker sur un serveur connecté à Internet, via un <strong>hébergeur</strong> (mutualisé / VPS / dédié / cloud). Le <strong>DNS</strong> traduit le <strong>nom</strong> (réservé chez un <strong>registrar</strong>) en <strong>IP</strong> grâce à ses <strong>enregistrements</strong> (A, CNAME, MX…). Le nom complet est un <strong>FQDN</strong>, résolu de la <strong>racine</strong> (13 serveurs A→M) jusqu’à l’hôte.</p>'),
  note('blue', '🔗 Pour la pratique', '<p>Mettre en place l’hébergement en TP : <a href="/hebergement-web">L’hébergement web (DNS + IIS)</a> · procédures <a href="/procedure-dns">DNS</a> et <a href="/procedure-iis">IIS</a>.</p>'),
];

const PAGE = {
  slug: SLUG,
  title: 'L’hébergement web',
  excerpt: 'Cours d’hébergement web : hébergeur et types d’hébergement (mutualisé, VPS, dédié, cloud), DNS et résolution des noms, enregistrements (A, AAAA, CNAME, MX, NS, SOA), registrars (ICANN/AFNIC), structure d’un FQDN et 13 serveurs racine. Avec schémas.',
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

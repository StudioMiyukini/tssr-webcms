/* Crée la page de cours « IP et initiation au binaire » : le binaire (bit, octet, poids),
   conversions décimal/binaire, une IP en 32 bits, le masque & le CIDR en binaire. Vulgarisé + schémas.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-ip-binaire.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const accordion = (it: Array<[string, string]>) => block('accordion', { items: it.map(([title, text]) => ({ title, text, href: '' })) });
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });

const C = { net: '#2563eb', dev: '#059669', warn: '#d97706', danger: '#dc2626', grey: '#64748b', slate: '#475569', purple: '#7c3aed' };
function box(x: number, y: number, w: number, h: number, fill: string, label: string): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}"/><text x="${x + w / 2}" y="${y + h / 2 + 5}" text-anchor="middle" font-size="15" fill="#fff" font-weight="bold">${label}</text>`;
}
const wrap = (w: number, h: number, inner: string) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="max-width:${w}px;width:100%;height:auto;margin:6px 0 12px;font-family:system-ui,sans-serif">${inner}</svg>`;
const cap = (x: number, y: number, t: string, col = '#64748b', s = 11) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${s}" fill="${col}">${t}</text>`;

// Schéma : les poids d'un octet (exemple 11000000 = 192)
const POIDS = [128, 64, 32, 16, 8, 4, 2, 1];
const BITS = [1, 1, 0, 0, 0, 0, 0, 0];
const svgOctet = wrap(520, 158,
  POIDS.map((w, i) => {
    const x = 20 + i * 60, on = BITS[i] === 1;
    return `<text x="${x + 26}" y="32" text-anchor="middle" font-size="11" fill="#64748b" font-weight="bold">${w}</text>`
      + `<rect x="${x}" y="40" width="52" height="44" rx="6" fill="${on ? C.net : '#e2e8f0'}"/>`
      + `<text x="${x + 26}" y="70" text-anchor="middle" font-size="20" fill="${on ? '#fff' : '#94a3b8'}" font-weight="bold">${BITS[i]}</text>`;
  }).join('')
  + `<text x="256" y="116" text-anchor="middle" font-size="15" fill="#334155" font-weight="bold">128 + 64 = 192</text>`
  + cap(256, 142, 'Chaque bit à 1 vaut son poids ; on additionne les poids des bits à 1.'));

// Schéma : une IP en binaire
const IPB: Array<[string, string]> = [['192', '11000000'], ['168', '10101000'], ['1', '00000001'], ['10', '00001010']];
const svgIpBin = wrap(560, 138,
  IPB.map(([d, b], i) => {
    const x = 20 + i * 135;
    return box(x, 26, 120, 40, C.net, d)
      + `<text x="${x + 60}" y="92" text-anchor="middle" font-size="13" fill="#334155" font-family="ui-monospace,monospace" font-weight="bold">${b}</text>`
      + (i < 3 ? `<text x="${x + 128}" y="52" text-anchor="middle" font-size="18" fill="${C.slate}" font-weight="bold">.</text>` : '');
  }).join('')
  + cap(280, 120, 'Une adresse IP = 4 octets de 8 bits = 32 bits au total.'));

// Schéma : le masque en binaire (réseau = 1, machine = 0)
const MSK: Array<[string, string, boolean]> = [['255', '11111111', true], ['255', '11111111', true], ['255', '11111111', true], ['0', '00000000', false]];
const svgMask = wrap(560, 150,
  MSK.map(([d, b, net], i) => {
    const x = 20 + i * 135;
    return box(x, 24, 120, 34, net ? C.dev : C.grey, d)
      + `<text x="${x + 60}" y="80" text-anchor="middle" font-size="12" fill="${net ? C.dev : '#94a3b8'}" font-family="ui-monospace,monospace" font-weight="bold">${b}</text>`
      + (i < 3 ? `<text x="${x + 128}" y="46" text-anchor="middle" font-size="18" fill="${C.slate}" font-weight="bold">.</text>` : '');
  }).join('')
  + `<text x="227" y="106" text-anchor="middle" font-size="11" fill="${C.dev}" font-weight="bold">24 bits à 1 → partie RÉSEAU</text>`
  + `<text x="485" y="106" text-anchor="middle" font-size="11" fill="#64748b" font-weight="bold">8 bits à 0 → MACHINE</text>`
  + cap(280, 134, 'Masque 255.255.255.0 = /24 : le nombre de 1 donne la taille du réseau.'));

// ===== Tableaux de conversion (croisé binaire/décimal) =====
const td = 'padding:8px 10px;border:1px solid var(--border)';
const th = `${td};text-align:center;font-weight:700`;
const poidsTable = `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:560px;font-size:14px;text-align:center"><tbody>`
  + `<tr style="background:var(--surface-2)"><th style="${td};text-align:left">Bit n°</th>${[8, 7, 6, 5, 4, 3, 2, 1].map(n => `<td style="${th}">${n}</td>`).join('')}</tr>`
  + `<tr><th style="${td};text-align:left">Puissance de 2</th>${[7, 6, 5, 4, 3, 2, 1, 0].map(p => `<td style="${td};font-family:ui-monospace,monospace">2<sup>${p}</sup></td>`).join('')}</tr>`
  + `<tr><th style="${td};text-align:left">Poids (décimal)</th>${[128, 64, 32, 16, 8, 4, 2, 1].map(w => `<td style="${td};font-weight:700;color:#2563eb">${w}</td>`).join('')}</tr>`
  + `</tbody></table></div>`;
const maskTable = `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:560px;font-size:14px"><thead><tr style="background:var(--surface-2)">${['Bits à 1', 'Octet en binaire', 'Décimal', 'Nombre magique (256 − déc.)'].map(c => `<th style="${td};text-align:left">${c}</th>`).join('')}</tr></thead><tbody>`
  + [0, 1, 2, 3, 4, 5, 6, 7, 8].map(b => {
    const bin = '1'.repeat(b) + '0'.repeat(8 - b);
    const dec = b === 0 ? 0 : 256 - Math.pow(2, 8 - b);
    const magic = dec === 0 ? 256 : 256 - dec;
    return `<tr><td style="${td};text-align:center;font-weight:700">${b}</td><td style="${td};font-family:ui-monospace,monospace"><span style="color:#16a34a">${'1'.repeat(b)}</span><span style="color:#94a3b8">${'0'.repeat(8 - b)}</span></td><td style="${td};font-weight:700;color:#16a34a">${dec}</td><td style="${td};color:#d97706;font-weight:600">${magic}</td></tr>`;
  }).join('')
  + `</tbody></table></div>`;

// ===== Traducteur binaire ⇄ décimal (CSS pur) =====
const WB = [128, 64, 32, 16, 8, 4, 2, 1];
const binColor = (n: number) => [...n.toString(2).padStart(8, '0')].map(ch => ch === '1' ? '<span style="color:#16a34a;font-weight:700">1</span>' : '<span style="color:#94a3b8">0</span>').join('');
const breakdown = (n: number) => n === 0 ? '0' : WB.filter(w => (n & w) === w).join(' + ');
const bitsLabels = WB.map(w => `<label class="bit"><input type="checkbox" class="w${w}"><span class="face"><span class="wt">${w}</span></span></label>`).join('');
const digitRow = (name: string, label: string, vals: number[], def: number) => `<div class="drow"><span class="dlab">${label}</span>${vals.map(v => `<label><input type="radio" name="${name}" id="${name}${v}"${v === def ? ' checked' : ''}><span class="dchip">${v}</span></label>`).join('')}</div>`;
let numinReveal = '';
for (let hh = 0; hh <= 2; hh++) for (let tt = 0; tt <= 9; tt++) for (let uu = 0; uu <= 9; uu++) { const N = 100 * hh + 10 * tt + uu; const sel = `.numin:has(#dh${hh}:checked):has(#dt${tt}:checked):has(#du${uu}:checked)`; numinReveal += N <= 255 ? `${sel} .r${N}{display:block}` : `${sel} .inv{display:block}`; }
const numinOuts = Array.from({ length: 256 }, (_, N) => `<div class="dnum r${N}"><b>${N}</b> = <span style="color:#16a34a;font-weight:700">${N.toString(2).padStart(8, '0')}</span> <span style="color:#64748b">(= ${breakdown(N)})</span></div>`).join('') + `<div class="dnum inv">⚠️ Un octet d’IP va de 0 à 255 — ce nombre dépasse le maximum.</div>`;
const convStyle = `<style>
.conv{counter-reset:tot;border:1px solid var(--border);border-radius:12px;padding:14px;background:var(--surface-2)}
.conv .bits{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.conv .bit{position:relative}
.conv .bit input{position:absolute;opacity:0;width:0;height:0}
.conv .face{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;width:50px;height:56px;border:2px solid var(--border);border-radius:8px;background:var(--surface);cursor:pointer;user-select:none}
.conv .face .wt{font-size:11px;color:#64748b}
.conv .face::after{content:"0";font-size:19px;font-weight:800;color:#94a3b8}
.conv .bit input:checked + .face{background:#2563eb;border-color:#2563eb}
.conv .bit input:checked + .face .wt{color:#dbeafe}
.conv .bit input:checked + .face::after{content:"1";color:#fff}
${WB.map(w => `.conv input.w${w}:checked{counter-increment:tot ${w}}`).join('')}
.conv .res{font-weight:700;margin:8px 0 0;font-size:16px}
.conv .totv::after{content:counter(tot)}
.numin{margin:14px 0 0}
.numin .drow{display:flex;flex-wrap:wrap;align-items:center;gap:5px;margin:7px 0}
.numin .dlab{font-family:ui-monospace,monospace;color:#64748b;width:84px;font-size:13px}
.numin input{position:absolute;opacity:0;width:0;height:0}
.numin .dchip{display:inline-block;min-width:30px;text-align:center;padding:5px 9px;border:1px solid var(--border);border-radius:7px;cursor:pointer;font-family:ui-monospace,monospace;font-weight:600}
.numin input:checked + .dchip{background:#16a34a;color:#fff;border-color:#16a34a}
.numin .dnum{display:none;margin-top:12px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);font-family:ui-monospace,monospace;font-size:15px}
.numin .dnum.inv{border-left:3px solid #d97706}
${numinReveal}
</style>`;
const convHtml = `<div class="conv"><p class="meta">Active les bits pour composer un octet : le <b>binaire</b> = les cases (1 = allumé), la <b>valeur décimale</b> s’affiche dessous.</p><div class="bits">${bitsLabels}</div><p class="res">→ Décimal : <span class="totv" style="color:#2563eb"></span></p></div>`;
const numinHtml = `<div class="numin"><p class="meta">Ou entre un nombre décimal (0 à 255) chiffre par chiffre — son binaire s’affiche aussitôt :</p>${digitRow('dh', 'Centaines', [0, 1, 2], 0)}${digitRow('dt', 'Dizaines', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 4)}${digitRow('du', 'Unités', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 2)}${numinOuts}</div>`;
const ipCtx = `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:520px;font-size:14px"><thead><tr style="background:var(--surface-2)"><th style="${td};text-align:left">Adresse</th><th style="${td};text-align:left">Décimal</th><th style="${td};text-align:left">4ᵉ octet (binaire) — <span style="color:#7c3aed">réseau</span> · <span style="color:#16a34a">machine</span></th></tr></thead><tbody>`
  + ([['IP', '192.168.10.42', 42, '#334155'], ['idSR (réseau)', '192.168.10.0', 0, '#16a34a'], ['Broadcast', '192.168.10.63', 63, '#dc2626']] as Array<[string, string, number, string]>).map(([lab, addr, oct, col]) => {
    const b = oct.toString(2).padStart(8, '0');
    return `<tr><td style="${td};font-weight:600;color:${col}">${lab}</td><td style="${td};font-family:ui-monospace,monospace">${addr}</td><td style="${td};font-family:ui-monospace,monospace"><span style="color:#7c3aed;font-weight:700">${b.slice(0, 2)}</span> <span style="color:#16a34a">${b.slice(2)}</span></td></tr>`;
  }).join('') + `</tbody></table></div>`;

// ===================================================================================
const SLUG = 'ip-et-binaire';
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Réseau', title: 'IP et initiation au binaire', subtitle: 'Derrière chaque adresse IP se cachent des 0 et des 1 : comprends enfin le binaire et le masque.' }),
  block('html', { html: '<p>Les ordinateurs ne comprennent que <strong>deux états</strong> : <strong>0</strong> et <strong>1</strong>. Une <strong>adresse IP</strong>, qu’on écrit en décimal (ex. <code>192.168.1.10</code>) pour nous, est en réalité une suite de <strong>32 bits</strong> (des 0 et des 1). Comprendre le binaire, c’est comprendre les masques, le CIDR et les sous-réseaux.</p>' }),
  note('blue', '🔎 Analogie', '<p>Un bit, c’est un <strong>interrupteur</strong> : <strong>éteint = 0</strong>, <strong>allumé = 1</strong>. Avec une rangée d’interrupteurs, on code n’importe quel nombre. Le réseau ne « voit » que ces interrupteurs.</p>'),

  block('heading', { level: 2, text: '🔢 C’est quoi le binaire ?' }),
  block('html', { html: '<p>Le <strong>binaire</strong> est un système de numération en <strong>base 2</strong> : il n’utilise que <strong>0 et 1</strong> (au lieu de 0 à 9 en base 10). L’unité de base est le <strong>bit</strong>. Huit bits forment un <strong>octet</strong> (<em>byte</em>). Une adresse IPv4 est faite de <strong>4 octets</strong>.</p>' }),

  block('heading', { level: 2, text: '⚖️ Les poids d’un octet (les puissances de 2)' }),
  block('html', { html: '<p>Dans un octet, chaque position a un <strong>poids</strong> : de gauche à droite <strong>128, 64, 32, 16, 8, 4, 2, 1</strong> (les puissances de 2). La valeur de l’octet = la <strong>somme des poids des bits à 1</strong>.</p>' }),
  block('html', { html: svgOctet }),

  block('heading', { level: 2, text: '🔄 Convertir décimal ↔ binaire' }),
  accordion([
    ['➡️ Binaire → décimal (additionner)', '<p>On <strong>additionne les poids</strong> des bits à 1. Exemple <code>10101000</code> : 128 + 32 + 8 = <strong>168</strong>.</p>'],
    ['⬅️ Décimal → binaire (soustraire)', '<p>On <strong>retire les puissances de 2</strong>, de la plus grande à la plus petite. Exemple <strong>192</strong> : 128 ? oui (reste 64) → 64 ? oui (reste 0) → tout le reste à 0 → <code>11000000</code>.</p>'],
    ['🔢 Pourquoi des nombres de 0 à 255 ?', '<p>Un octet a <strong>8 bits</strong>, soit <strong>2⁸ = 256</strong> combinaisons possibles : de <code>00000000</code> (= 0) à <code>11111111</code> (= 255). Voilà pourquoi chaque nombre d’une IP va de <strong>0 à 255</strong>.</p>'],
  ]),

  block('heading', { level: 2, text: '🌐 Une adresse IP en binaire' }),
  block('html', { html: '<p>Une IPv4 = <strong>4 octets</strong> séparés par des points, soit <strong>4 × 8 = 32 bits</strong>. Exemple avec <code>192.168.1.10</code> :</p>' }),
  block('html', { html: svgIpBin }),

  block('heading', { level: 2, text: '🧮 Le masque en binaire (et le /CIDR)' }),
  block('html', { html: '<p>Le <strong>masque</strong> indique, en binaire, quelle partie de l’IP est le <strong>réseau</strong> et quelle partie est la <strong>machine</strong> : les <strong>1</strong> = réseau, les <strong>0</strong> = machine. Le <strong>/CIDR</strong> n’est rien d’autre que le <strong>nombre de 1</strong>.</p>' }),
  block('html', { html: svgMask }),

  block('heading', { level: 2, text: '📐 Tableaux de conversion (pour calculer les IP)' }),
  block('html', { html: '<p>Garde ces deux tableaux sous les yeux : ils suffisent pour <strong>convertir</strong>, <strong>écrire un masque</strong> et appliquer la <a href="/pages/calcul-ip-masque">méthode du nombre magique</a>.</p>' }),
  block('html', { html: '<p class="meta"><strong>1.</strong> Le <strong>poids de chaque bit</strong> dans un octet (de gauche à droite) :</p>' }),
  block('html', { html: poidsTable }),
  block('html', { html: '<p class="meta"><strong>2.</strong> Les <strong>valeurs d’un masque</strong> (bits à 1 consécutifs), leur décimal et leur <strong>nombre magique</strong> :</p>' }),
  block('html', { html: maskTable }),
  note('blue', '🧭 Comment s’en servir', '<p><strong>Convertir un nombre</strong> → additionne les poids des bits à 1 (tableau 1). Exemple : <code>11000000</code> = 128 + 64 = <strong>192</strong>.<br><strong>Écrire un masque</strong> / trouver le <strong>magic</strong> → lis la ligne du tableau 2. Exemple : <code>/26</code> = 2 bits dans le 4ᵉ octet → <code>11000000</code> = <strong>192</strong>, magic = <strong>64</strong>. Les seules valeurs possibles d’un octet de masque sont donc : <strong>0, 128, 192, 224, 240, 248, 252, 254, 255</strong>.</p>'),

  block('heading', { level: 2, text: '🔁 Traducteur binaire ⇄ décimal (un octet d’IP)' }),
  block('html', { html: '<p>Un octet d’IP va de <strong>0 à 255</strong> = <strong>8 bits</strong>. Convertis dans les deux sens : compose un octet (les bits), ou entre un nombre décimal.</p>' }),
  block('html', { html: convStyle + convHtml + numinHtml }),
  block('heading', { level: 3, text: 'Application : idSR & broadcast (192.168.10.42 /26)' }),
  block('html', { html: '<p>Avec un <code>/26</code>, seul le <strong>4ᵉ octet</strong> change. Les <strong>2 premiers bits</strong> sont la partie <span style="color:#7c3aed">réseau</span> (figés pour ce bloc), les <strong>6 derniers</strong> la partie <span style="color:#16a34a">machine</span> :</p>' }),
  block('html', { html: ipCtx }),
  note('green', '🔑 La règle', '<p>L’<strong>idSR</strong> met tous les bits <strong>machine à 0</strong> (→ <code>.0</code>) ; le <strong>broadcast</strong> met tous les bits <strong>machine à 1</strong> (→ <code>.63</code>). C’est exactement ce que fait la <a href="/pages/calcul-ip-masque">méthode du nombre magique</a>.</p>'),

  block('heading', { level: 2, text: '🎯 À quoi ça sert ?' }),
  block('html', { html: '<ul><li>Comprendre le <strong>masque</strong> et le <strong>CIDR</strong> (<code>/24</code> = 24 bits à 1).</li><li>Savoir <strong>découper des sous-réseaux</strong>.</li><li>Calculer le <strong>nombre de machines</strong> d’un réseau : <strong>2^(bits machine) − 2</strong> (on retire l’adresse du réseau et le broadcast). Ex. en <code>/24</code> : 2⁸ − 2 = <strong>254</strong> machines.</li></ul>' }),

  note('green', '💡 À retenir', '<p>Le <strong>binaire</strong> n’utilise que <strong>0 et 1</strong>. Un <strong>octet</strong> = 8 bits (poids 128…1) = un nombre de <strong>0 à 255</strong>. Une <strong>IP</strong> = 4 octets = <strong>32 bits</strong>. Le <strong>masque</strong> en binaire sépare <strong>réseau (1)</strong> et <strong>machine (0)</strong>, et le <strong>/CIDR</strong> compte les 1. Pour la suite : <a href="/pages/adresses-ip">Les adresses IP</a> et <a href="/pages/bases-du-reseau">Les bases du réseau</a>. Sigles dans le <a href="/glossaire">Glossaire</a>.</p>'),
];

const PAGE = { slug: SLUG, title: 'IP et initiation au binaire', excerpt: 'Comprendre le binaire derrière les adresses IP : bit et octet, poids (puissances de 2), conversions décimal/binaire, l’IP en 32 bits et le masque/CIDR en binaire. Vulgarisé avec schémas.' };

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
  const body = JSON.stringify({ title: PAGE.title, slug: PAGE.slug, excerpt: PAGE.excerpt, content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1 });
  const res = cur
    ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body })
    : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log(`PAGE ${PAGE.slug}`, res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());

  const cours = existing.find(e => e.slug === 'cours');
  if (cours) {
    const hub = buildHubBlocks();
    const r = await fetch(`${BASE}/api/admin/pages/${cours.id}`, { method: 'PUT', headers: h, body: JSON.stringify({ title: 'Cours', slug: 'cours', content: renderPageBlocksToHtml(hub), builder_json: serializePageBlocks(hub), published: 1 }) });
    console.log('HUB Cours', r.status, r.ok ? '(maj)' : await r.text());
  } else console.log('HUB Cours introuvable');

  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

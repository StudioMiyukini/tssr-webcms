/* Page « Calcul d'IP & masque de sous-réseau (le nombre magique) ».
   Méthode pas-à-pas + un calculateur CSS interactif /CIDR → masque/magic/hôtes/blocs (sans JS)
   + table de référence. Inspiré de la fiche « nombre magique ».
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-calcul-ip.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const calc = (html: string) => `<div style="font-family:ui-monospace,monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:6px 0;overflow-x:auto;font-size:14px">${html}</div>`;
const grp = (x: number) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

// ===== Calculs subnet =====
function maskOctets(n: number): number[] {
  const m = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) { const b = Math.min(Math.max(n - 8 * i, 0), 8); m[i] = b === 0 ? 0 : 256 - Math.pow(2, 8 - b); }
  return m;
}
function magicData(n: number) {
  const mask = maskOctets(n);
  const idx = Math.min(Math.floor(n / 8), 3);
  const magic = mask[idx] === 0 ? 256 : 256 - mask[idx];
  const oct = ['1ᵉʳ', '2ᵉ', '3ᵉ', '4ᵉ'][idx];
  const hosts = n >= 31 ? (n === 32 ? 1 : 2) : Math.pow(2, 32 - n) - 2;
  return { mask, idx, magic, oct, hosts };
}
function blocsStr(magic: number): string {
  if (magic === 256) return 'tout l’octet (0–255)';
  const arr: number[] = []; for (let v = 0; v < 256; v += magic) arr.push(v);
  return arr.length <= 8 ? arr.join(' · ') : `0 · ${magic} · ${2 * magic} · … (par pas de ${magic})`;
}

// ===== Calculateur CSS : /CIDR → masque, magic, blocs, hôtes =====
const CIDRS: number[] = []; for (let n = 8; n <= 30; n++) CIDRS.push(n);
const chips = CIDRS.map(n => `<label><input type="radio" name="cc" id="cc${n}"${n === 26 ? ' checked' : ''}><span class="chip">/${n}</span></label>`).join('');
const outs = CIDRS.map(n => {
  const { mask, magic, oct, hosts } = magicData(n);
  return `<div class="cout o${n}"><div>📐 <b>/${n}</b> → masque <b style="font-family:ui-monospace,monospace">${mask.join('.')}</b></div>`
    + `<div>Octet intéressant : le <b>${oct}</b> · nombre magique (taille de bloc) : <b style="color:#d97706">${magic}</b></div>`
    + `<div>Blocs dans cet octet : <span style="font-family:ui-monospace,monospace">${blocsStr(magic)}</span></div>`
    + `<div>Hôtes par sous-réseau : <b style="color:#2563eb">${grp(hosts)}</b></div></div>`;
}).join('');
const ccStyle = `<style>
.cc{margin:6px 0}
.cc input{position:absolute;opacity:0;width:0;height:0;pointer-events:none}
.cc .chip{display:inline-block;padding:7px 11px;border:1px solid var(--border);border-radius:8px;margin:3px;cursor:pointer;font-family:ui-monospace,monospace;font-weight:600}
.cc input:checked + .chip{background:#2563eb;color:#fff;border-color:#2563eb}
.cc .cout{display:none;margin-top:12px;padding:12px 14px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);line-height:1.9}
${CIDRS.map(n => `.cc:has(#cc${n}:checked) .o${n}{display:block}`).join('')}
</style>`;
const ccHtml = ccStyle + `<div class="cc"><p class="meta">Choisis le préfixe (/CIDR) — le masque, le nombre magique, les blocs et le nombre d’hôtes s’affichent :</p><div>${chips}</div>${outs}</div>`;

// ===== Schéma « règle graduée » (192.168.10.42 /26) =====
const wrap = (w: number, h: number, inner: string) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="max-width:${w}px;width:100%;height:auto;margin:8px 0 12px;font-family:system-ui,sans-serif">${inner}</svg>`;
const svgRuler = wrap(560, 130,
  ([['0–63', true], ['64–127', false], ['128–191', false], ['192–255', false]] as Array<[string, boolean]>).map(([lab, act], i) => {
    const x = 20 + i * 130;
    return `<rect x="${x}" y="40" width="126" height="42" rx="6" fill="${act ? 'rgba(217,119,6,0.16)' : '#ffffff'}" stroke="${act ? '#d97706' : '#cbd5e1'}" stroke-width="${act ? 2 : 1}"/>`
      + `<text x="${x + 63}" y="66" text-anchor="middle" font-size="12" fill="#334155" font-family="ui-monospace,monospace">${lab}</text>`;
  }).join('')
  + `<line x1="105" y1="32" x2="105" y2="88" stroke="#d97706" stroke-width="2"/><text x="105" y="26" text-anchor="middle" font-size="11" fill="#d97706" font-weight="bold">IP .42</text>`
  + `<text x="24" y="104" font-size="11" fill="#16a34a" font-weight="bold">▲ idSR .0</text>`
  + `<text x="146" y="104" text-anchor="end" font-size="11" fill="#dc2626" font-weight="bold">broadcast .63 ▲</text>`
  + `<text x="290" y="122" text-anchor="middle" font-size="11" fill="#64748b">42 tombe dans le bloc [0–63] : son début = idSR, sa fin = broadcast.</text>`);

const maskBin = `<div style="font-family:ui-monospace,monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;overflow-x:auto;font-size:15px"><span style="color:#16a34a">11111111</span>.<span style="color:#16a34a">11111111</span>.<span style="color:#16a34a">11111111</span>.<b style="color:#d97706">11</b><span style="color:#94a3b8">000000</span>  <span style="color:#64748b">= 255.255.255.192 (/26)</span></div>`;

const examples = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin:6px 0 12px">
<div style="border:1px solid var(--border);border-radius:12px;padding:14px;background:var(--surface)"><p style="font-family:ui-monospace,monospace;font-weight:700;margin:0 0 4px">10.0.5.137 <span style="color:#7c3aed">/27</span></p><p class="meta" style="font-family:ui-monospace,monospace;margin:0 0 8px">masque 255.255.255.224 · magic = 256−224 = 32</p><ul style="margin:0;font-size:14px"><li>blocs : 0·32·64·96·128…</li><li>137 ∈ [128–159]</li><li>idSR : <b style="color:#16a34a">10.0.5.128</b></li><li>broadcast : <b style="color:#dc2626">10.0.5.159</b></li><li>hôtes : <span style="color:#2563eb">.129 → .158</span></li></ul></div>
<div style="border:1px solid var(--border);border-radius:12px;padding:14px;background:var(--surface)"><p style="font-family:ui-monospace,monospace;font-weight:700;margin:0 0 4px">172.16.70.5 <span style="color:#7c3aed">/19</span></p><p class="meta" style="font-family:ui-monospace,monospace;margin:0 0 8px">masque 255.255.224.0 · magic sur le 3ᵉ octet = 32</p><ul style="margin:0;font-size:14px"><li>blocs (3ᵉ oct.) : 0·32·64·96…</li><li>70 ∈ [64–95]</li><li>idSR : <b style="color:#16a34a">172.16.64.0</b></li><li>broadcast : <b style="color:#dc2626">172.16.95.255</b></li><li>hôtes : <span style="color:#2563eb">.64.1 → .95.254</span></li></ul></div>
</div>`;

const refTable = `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:520px;font-size:14px"><thead><tr style="background:var(--surface-2)">${['CIDR', 'Masque', 'Nombre magique', 'Hôtes / sous-réseau'].map(c => `<th style="text-align:left;padding:7px 10px;border:1px solid var(--border)">${c}</th>`).join('')}</tr></thead><tbody>${CIDRS.map(n => { const { mask, magic, hosts } = magicData(n); return `<tr><td style="padding:7px 10px;border:1px solid var(--border);font-weight:700;font-family:ui-monospace,monospace">/${n}</td><td style="padding:7px 10px;border:1px solid var(--border);font-family:ui-monospace,monospace">${mask.join('.')}</td><td style="padding:7px 10px;border:1px solid var(--border);color:#d97706;font-weight:600">${magic}</td><td style="padding:7px 10px;border:1px solid var(--border)">${grp(hosts)}</td></tr>`; }).join('')}</tbody></table></div>`;

// ===================================================================================
const SLUG = 'calcul-ip-masque';
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Réseau · Calcul', title: 'Calcul d’IP & masque de sous-réseau', subtitle: 'Retrouver le masque, l’adresse réseau (idSR), le broadcast et les hôtes — avec la méthode du nombre magique.' }),
  block('html', { html: '<p>À partir d’une <strong>IP + un /CIDR</strong>, on doit souvent retrouver le <strong>masque</strong>, l’<strong>adresse réseau (idSR)</strong>, le <strong>broadcast</strong> et le nombre d’<strong>hôtes</strong>. Une seule technique à maîtriser : le <strong>nombre magique</strong> — pas de conversion binaire pénible, on raisonne sur <strong>un seul octet</strong> et tout tombe.</p>' }),
  block('html', { html: `<div style="border:1px solid var(--border);border-radius:12px;padding:14px 16px;background:var(--surface-2);font-family:ui-monospace,monospace;line-height:2"><div>🔑 <b>Nombre magique</b> = 256 − octet du masque</div><div>🟢 <b>idSR</b> (réseau) = multiple du magic juste en dessous de l’octet de l’IP</div><div>🔴 <b>Broadcast</b> = idSR + magic − 1</div><div>🔵 <b>Hôtes</b> = 2^(bits machine) − 2</div></div>` }),
  note('blue', '🤔 Le pourquoi (30 secondes)', '<p>Le masque dit jusqu’où va la partie réseau. Quand la coupure ne tombe pas pile sur une frontière d’octet, <strong>un seul octet est « à cheval »</strong> : c’est l’octet intéressant. Le nombre magique donne la <strong>taille des blocs</strong> de sous-réseaux dans cet octet. Ton IP tombe forcément dans un bloc : son <strong>début = idSR</strong>, sa <strong>fin = broadcast</strong>.</p>'),

  block('heading', { level: 2, text: '🪜 La méthode, étape par étape' }),
  block('html', { html: '<p class="meta">On déroule sur <code>192.168.10.42 /26</code>.</p>' }),
  block('html', { html: '<p><strong>1. Écrire le masque.</strong> Le <strong>/26</strong> = 26 bits à 1 en partant de la gauche → <code>255.255.255.192</code>. L’octet <strong>intéressant</strong> est le 4ᵉ (le seul ni 0 ni 255).</p>' }),
  block('html', { html: maskBin }),
  block('html', { html: '<p><strong>2. Le nombre magique</strong> = l’écart entre deux sous-réseaux.</p>' + calc('magic = 256 − <b style="color:#d97706">192</b> = <b style="color:#d97706">64</b>') + calc('blocs : <b style="color:#16a34a">0</b> · 64 · 128 · 192') }),
  block('html', { html: '<p><strong>3. L’idSR (adresse réseau).</strong> Dans quel bloc tombe 42 ? Le multiple de 64 juste en dessous, c’est 0.</p>' + calc('42 ∈ [ <b style="color:#16a34a">0</b> … 63 ] → idSR = 192.168.10.<b style="color:#16a34a">0</b>') }),
  block('html', { html: '<p><strong>4. Le broadcast</strong> = juste avant le bloc suivant : idSR + magic − 1.</p>' + calc('0 + 64 − 1 = <b style="color:#dc2626">63</b> → broadcast = 192.168.10.<b style="color:#dc2626">63</b>') + '<p>Les hôtes utilisables vont de <span style="color:#2563eb">.1</span> à <span style="color:#2563eb">.62</span> (<strong>62 machines</strong>).</p>' }),
  block('html', { html: svgRuler }),

  block('heading', { level: 2, text: '🧮 Calculateur : /CIDR → masque & nombre magique' }),
  block('html', { html: '<p>Choisis ton préfixe : tu obtiens le <strong>masque</strong>, le <strong>nombre magique</strong> (taille de bloc), les <strong>blocs</strong> et le nombre d’<strong>hôtes</strong>. Applique ensuite la méthode pour l’idSR et le broadcast de ton IP.</p>' }),
  note('yellow', 'ℹ️ Pourquoi pas un calcul 100 % automatique ?', '<p>Calculer automatiquement l’idSR et le broadcast d’une <strong>IP précise</strong> nécessite du <strong>JavaScript</strong>, que ce site n’exécute pas (sécurité). Ce calculateur te donne le <strong>masque et le nombre magique</strong> selon le /CIDR ; le reste se fait <strong>de tête</strong> avec la méthode ci-dessus — c’est tout l’intérêt du « nombre magique » !</p>'),
  block('html', { html: ccHtml }),

  block('heading', { level: 2, text: '🧩 Deux autres cas pour ancrer' }),
  block('html', { html: '<p class="meta">Le piège classique : quand la coupure quitte le 4ᵉ octet, le magic s’applique sur le 3ᵉ et le 4ᵉ repart de 0.</p>' }),
  block('html', { html: examples }),

  block('heading', { level: 2, text: '⚡ Le réflexe à graver' }),
  block('html', { html: '<p>Quatre gestes, dans l’ordre, à chaque fois :</p><ol><li>Repère l’<strong>octet intéressant</strong> = le premier octet du masque qui n’est pas 255.</li><li><code>magic = 256 − valeur de cet octet</code></li><li><strong style="color:#16a34a">idSR</strong> = le multiple du magic <strong>juste en dessous</strong> (ou égal) à l’octet de l’IP. Les octets à gauche se recopient, ceux à droite passent à <strong>0</strong>.</li><li><strong style="color:#dc2626">broadcast</strong> = <code>idSR + magic − 1</code> sur l’octet intéressant. Les octets à droite passent à <strong>255</strong>.</li></ol><p>🔎 Astuce de contrôle : <strong>broadcast − idSR + 1 = magic</strong>. Si ça ne tombe pas juste, tu t’es trompé de bloc.</p>' }),

  block('heading', { level: 2, text: '📋 Table de référence' }),
  block('html', { html: refTable }),

  note('green', '💡 À retenir', '<p>La <strong>méthode du nombre magique</strong> : <strong>256 − octet du masque</strong> donne la taille des blocs ; l’IP tombe dans un bloc dont le <strong>début = idSR</strong> et la <strong>fin = broadcast</strong>. Besoin des bases ? <a href="/pages/ip-et-binaire">IP et initiation au binaire</a> et <a href="/pages/adresses-ip">Les adresses IP</a>. Entraîne-toi avec <a href="/pages/jeu-binaire">le jeu du binaire</a>.</p>'),
];

const PAGE = { slug: SLUG, title: 'Calcul d’IP & masque de sous-réseau', excerpt: 'Calculer masque, adresse réseau (idSR), broadcast et hôtes avec la méthode du nombre magique : méthode pas-à-pas, calculateur /CIDR → masque interactif et table de référence.' };

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

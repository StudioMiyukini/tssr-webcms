/* Moteur des jeux « image + 4 choix » (CSS pur, sans JS → compatible CSP).

   Un jeu est une suite de diapositives : une image (un SVG généré ici — schéma, terminal,
   table de règles, boîte de dialogue, capture Wireshark), une question, quatre réponses.
   Le retour est immédiat par :has() sur le bouton radio coché, avec le lien vers le cours
   en cas d'erreur, et une grille récapitulative en bas de page — le même dessin que
   « Reconnais le matériel », repris tel quel pour que les jeux se ressemblent.

   Les SVG dessinent leur propre fond clair : lisibles en thème clair comme sombre. */
import { makePageBlock, type PageBlock } from '../client/src/lib/page-blocks';

const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);

export type Opt = { t: string; ok?: boolean };
export type Slide = { svg: string; q: string; opts: Opt[]; ok: string; no: string; href: string; course: string };
export type Game = { slug: string; title: string; eyebrow: string; intro: string; icon: string; desc: string; slides: Slide[]; courses: Array<[string, string]> };

export const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ══════════════════════════════════════════════════ les générateurs de SVG ══

const FONT = 'font-family:system-ui,-apple-system,Segoe UI,sans-serif';
const MONO = 'font-family:ui-monospace,Consolas,Menlo,monospace';

function wrap(w: number, h: number, inner: string, label: string): string {
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}" style="max-width:${w}px;width:100%;height:auto;display:block;margin:0 auto;${FONT}">`
    + `<rect x="0" y="0" width="${w}" height="${h}" rx="12" fill="#f8fafc" stroke="#cbd5e1"/>` + inner + '</svg>';
}

/** Un terminal : lignes en chasse fixe, invite en vert, sortie en gris clair, `#` commentaires en bleu. */
export function svgTerminal(lines: string[], title = 'Terminal', w = 560): string {
  const lh = 20; const h = 44 + lines.length * lh + 16;
  let y = 44;
  const body = lines.map(l => {
    const isPrompt = /^[\w.-]+@[\w.-]+:.*[$#] /.test(l) || /^(R\d|Switch|Router|S\d)[\w()-]*[#>] /.test(l) || /^(C:\\|PS )/.test(l);
    const isComment = /^\s*[#!]/.test(l) && !isPrompt;
    const fill = isPrompt ? '#a7f3d0' : isComment ? '#93c5fd' : '#e2e8f0';
    const row = `<text x="16" y="${y}" font-size="13" fill="${fill}" style="${MONO};white-space:pre" xml:space="preserve">${esc(l)}</text>`;
    y += lh; return row;
  }).join('');
  const inner = `<rect x="8" y="8" width="${w - 16}" height="${h - 16}" rx="8" fill="#0f172a"/>`
    + `<circle cx="24" cy="22" r="5" fill="#ef4444"/><circle cx="40" cy="22" r="5" fill="#f59e0b"/><circle cx="56" cy="22" r="5" fill="#22c55e"/>`
    + `<text x="${w / 2}" y="26" text-anchor="middle" font-size="11" fill="#94a3b8">${esc(title)}</text>` + body;
  return wrap(w, h, inner, title);
}

/** Une table à en-têtes (règles de pare-feu, ACL, droits…), avec des lignes surlignées en option. */
export function svgTable(title: string, headers: string[], rows: string[][], opts: { widths?: number[]; highlight?: number[]; w?: number; mono?: boolean } = {}): string {
  const w = opts.w ?? 620; const n = headers.length;
  const widths = opts.widths ?? headers.map(() => (w - 24) / n);
  const rh = 26; const top = 40; const h = top + rh * (rows.length + 1) + 16;
  let x = 12; const xs: number[] = []; widths.forEach(cw => { xs.push(x); x += cw; });
  const font = opts.mono ? MONO : FONT;
  let out = `<text x="12" y="26" font-size="13" font-weight="700" fill="#0f172a">${esc(title)}</text>`;
  out += `<rect x="12" y="${top}" width="${w - 24}" height="${rh}" fill="#e2e8f0"/>`;
  headers.forEach((hd, i) => { out += `<text x="${xs[i] + 8}" y="${top + 17}" font-size="11.5" font-weight="700" fill="#334155">${esc(hd)}</text>`; });
  rows.forEach((r, ri) => {
    const y = top + rh * (ri + 1);
    const hl = opts.highlight?.includes(ri);
    out += `<rect x="12" y="${y}" width="${w - 24}" height="${rh}" fill="${hl ? '#fef3c7' : ri % 2 ? '#f1f5f9' : '#ffffff'}" stroke="#e2e8f0"/>`;
    r.forEach((c, i) => {
      const color = /^(Pass|permit|✔|Autoriser|Allow)/.test(c) ? '#15803d' : /^(Block|Reject|deny|✘|Bloquer|Deny)/.test(c) ? '#b91c1c' : '#0f172a';
      out += `<text x="${xs[i] + 8}" y="${y + 17}" font-size="11.5" fill="${color}" style="${font}">${esc(c)}</text>`;
    });
  });
  return wrap(w, h, out, title);
}

export type Node = { id: string; x: number; y: number; label: string; sub?: string; kind: 'cloud' | 'fw' | 'router' | 'switch' | 'pc' | 'server' | 'zone' | 'phone' | 'ap'; w?: number; h?: number; color?: string; dashed?: boolean };
export type Link = { a: string; b: string; label?: string; color?: string; dashed?: boolean; arrow?: boolean; t?: number };

const KIND_COLOR: Record<Node['kind'], string> = { cloud: '#64748b', fw: '#dc2626', router: '#2563eb', switch: '#0891b2', pc: '#0f766e', server: '#b45309', zone: '#d97706', phone: '#7c3aed', ap: '#0d9488' };
const KIND_SIZE: Record<Node['kind'], [number, number]> = { cloud: [96, 44], fw: [104, 56], router: [96, 48], switch: [104, 40], pc: [96, 44], server: [110, 48], zone: [140, 60], phone: [96, 44], ap: [96, 44] };

/** Une topologie : des boîtes reliées par des liens étiquetés. Les zones sont des cadres pointillés. */
export function svgTopo(title: string, nodes: Node[], links: Link[], w = 620, h = 300): string {
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const size = (n: Node): [number, number] => [n.w ?? KIND_SIZE[n.kind][0], n.h ?? KIND_SIZE[n.kind][1]];
  let out = title ? `<text x="12" y="24" font-size="13" font-weight="700" fill="#0f172a">${esc(title)}</text>` : '';
  // zones d'abord (dessous)
  for (const n of nodes.filter(n => n.kind === 'zone')) {
    const [nw, nh] = size(n);
    out += `<rect x="${n.x - nw / 2}" y="${n.y - nh / 2}" width="${nw}" height="${nh}" rx="10" fill="${n.color ?? KIND_COLOR.zone}" fill-opacity=".08" stroke="${n.color ?? KIND_COLOR.zone}" stroke-width="2" stroke-dasharray="6 4"/>`
      + `<text x="${n.x - nw / 2 + 8}" y="${n.y - nh / 2 + 16}" font-size="11.5" font-weight="700" fill="${n.color ?? KIND_COLOR.zone}">${esc(n.label)}</text>`
      + (n.sub ? `<text x="${n.x - nw / 2 + 8}" y="${n.y - nh / 2 + 30}" font-size="10" fill="${n.color ?? KIND_COLOR.zone}">${esc(n.sub)}</text>` : '');
  }
  for (const l of links) {
    const a = byId[l.a], b = byId[l.b]; if (!a || !b) continue;
    const color = l.color ?? '#94a3b8';
    out += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${color}" stroke-width="2.5"${l.dashed ? ' stroke-dasharray="6 4"' : ''}${l.arrow ? ' marker-end="url(#arr)"' : ''}/>`;
    if (l.label) {
      const t = l.t ?? 0.5; const mx = a.x + (b.x - a.x) * t, my = a.y + (b.y - a.y) * t; // t : position de l'étiquette le long du lien
      out += `<rect x="${mx - 4 - l.label.length * 3.2}" y="${my - 16}" width="${l.label.length * 6.4 + 8}" height="15" rx="4" fill="#f8fafc"/>`
        + `<text x="${mx}" y="${my - 5}" text-anchor="middle" font-size="10.5" fill="${color === '#94a3b8' ? '#475569' : color}" font-weight="600">${esc(l.label)}</text>`;
    }
  }
  for (const n of nodes.filter(n => n.kind !== 'zone')) {
    const [nw, nh] = size(n); const c = n.color ?? KIND_COLOR[n.kind];
    if (n.kind === 'cloud') out += `<ellipse cx="${n.x}" cy="${n.y}" rx="${nw / 2}" ry="${nh / 2}" fill="${c}"/>`;
    else out += `<rect x="${n.x - nw / 2}" y="${n.y - nh / 2}" width="${nw}" height="${nh}" rx="8" fill="${c}"${n.dashed ? ' stroke="#0f172a" stroke-width="2" stroke-dasharray="5 3"' : ''}/>`;
    out += `<text x="${n.x}" y="${n.y + (n.sub ? -2 : 4)}" text-anchor="middle" font-size="11.5" font-weight="700" fill="#fff">${esc(n.label)}</text>`;
    if (n.sub) out += `<text x="${n.x}" y="${n.y + 13}" text-anchor="middle" font-size="9.5" fill="#fff" fill-opacity=".9">${esc(n.sub)}</text>`;
  }
  const defs = '<defs><marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#94a3b8"/></marker></defs>';
  return wrap(w, h, defs + out, title || 'Schéma réseau');
}

/** Une boîte de dialogue façon Windows : titre, lignes libellé/valeur, cases à cocher. */
export function svgDialog(title: string, rows: Array<[string, string]>, opts: { checks?: Array<[string, boolean]>; w?: number; buttons?: string[] } = {}): string {
  const w = opts.w ?? 520; const rh = 26; const checks = opts.checks ?? [];
  const h = 48 + rows.length * rh + checks.length * 24 + 56;
  let out = `<rect x="8" y="8" width="${w - 16}" height="30" rx="6" fill="#1e3a8a"/><text x="20" y="28" font-size="12.5" font-weight="700" fill="#fff">${esc(title)}</text>`
    + `<text x="${w - 24}" y="28" text-anchor="end" font-size="14" fill="#fff">✕</text>`;
  let y = 60;
  rows.forEach(([k, v]) => {
    out += `<text x="24" y="${y}" font-size="11.5" fill="#334155">${esc(k)}</text>`
      + `<rect x="${w / 2 - 20}" y="${y - 15}" width="${w / 2 - 4}" height="22" rx="3" fill="#fff" stroke="#94a3b8"/>`
      + `<text x="${w / 2 - 12}" y="${y}" font-size="11.5" fill="#0f172a" style="${MONO}">${esc(v)}</text>`;
    y += rh;
  });
  checks.forEach(([label, on]) => {
    out += `<rect x="24" y="${y - 12}" width="14" height="14" rx="2" fill="${on ? '#2563eb' : '#fff'}" stroke="#475569"/>`
      + (on ? `<path d="M27 ${y - 5} l3 3 l6 -7" stroke="#fff" stroke-width="2" fill="none"/>` : '')
      + `<text x="46" y="${y}" font-size="11.5" fill="#0f172a">${esc(label)}</text>`;
    y += 24;
  });
  const btns = opts.buttons ?? ['OK', 'Annuler'];
  let bx = w - 24;
  for (const b of [...btns].reverse()) { bx -= 84; out += `<rect x="${bx}" y="${h - 44}" width="76" height="26" rx="4" fill="#e2e8f0" stroke="#94a3b8"/><text x="${bx + 38}" y="${h - 27}" text-anchor="middle" font-size="11.5" fill="#0f172a">${esc(b)}</text>`; }
  return wrap(w, h, out, title);
}

/** Une liste de paquets façon Wireshark. */
export function svgPackets(rows: Array<[string, string, string, string, string]>, w = 640): string {
  const headers = ['No.', 'Source', 'Destination', 'Protocol', 'Info'];
  const widths = [40, 130, 130, 70, w - 24 - 370];
  const colored = rows.map(r => r);
  const proto = (p: string) => p === 'ARP' ? '#fde68a' : p === 'ICMP' ? '#fbcfe8' : p === 'DNS' ? '#bfdbfe' : p === 'TCP' ? '#e9d5ff' : p === 'HTTP' ? '#bbf7d0' : p === 'DHCP' ? '#fed7aa' : p === 'TLSv1.3' ? '#c7d2fe' : '#e2e8f0';
  const rh = 24; const top = 12; const h = top + rh * (rows.length + 1) + 12;
  let x = 12; const xs: number[] = []; widths.forEach(cw => { xs.push(x); x += cw; });
  let out = `<rect x="12" y="${top}" width="${w - 24}" height="${rh}" fill="#e2e8f0"/>`;
  headers.forEach((hd, i) => { out += `<text x="${xs[i] + 6}" y="${top + 16}" font-size="11" font-weight="700" fill="#334155">${esc(hd)}</text>`; });
  colored.forEach((r, ri) => {
    const y = top + rh * (ri + 1);
    out += `<rect x="12" y="${y}" width="${w - 24}" height="${rh}" fill="${proto(r[3])}" stroke="#e2e8f0"/>`;
    r.forEach((c, i) => { out += `<text x="${xs[i] + 6}" y="${y + 16}" font-size="11" fill="#0f172a" style="${MONO}">${esc(c)}</text>`; });
  });
  return wrap(w, h, out, 'Capture Wireshark');
}

// ══════════════════════════════════════════════════════ le rendu du jeu ══

function style(n: number): string {
  const recap = Array.from({ length: n }, (_, i) => { const k = i + 1; return `.qdia:has(.q${k}.ok input:checked) .rc-${k}{background:#16a34a;color:#fff;border-color:#16a34a}.qdia:has(.q${k}:not(.ok) input:checked) .rc-${k}{background:#dc2626;color:#fff;border-color:#dc2626}`; }).join('');
  return `<style>
.qdia{margin:6px 0}
.qd-slide{margin:14px 0;padding:14px;border:1px solid var(--border);border-radius:12px;background:var(--surface-2)}
.qd-q{margin:0 0 10px}
.qd-num{display:inline-block;background:#2563eb;color:#fff;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:700;margin-right:8px}
.qd-photo{margin:8px 0 12px}
.qd-opts{display:flex;flex-wrap:wrap;gap:10px}
.qd-opt{flex:1 1 45%;min-width:150px;border:2px solid var(--border);border-radius:10px;padding:12px;cursor:pointer;background:var(--surface);font-weight:600;display:flex;align-items:flex-start;gap:8px}
.qd-opt input{margin-top:3px;flex:none}
.qd-fb{display:none;margin-top:10px;padding:8px 12px;border-radius:8px;font-size:14px}
.qd-ok{background:rgba(22,163,74,.12);border-left:3px solid #16a34a}
.qd-no{background:rgba(220,38,38,.10);border-left:3px solid #dc2626}
.qd-slide:has(.ok input:checked) .qd-ok{display:block}
.qd-slide:has(.qd-opt:not(.ok) input:checked) .qd-no{display:block}
.qd-slide:has(input:checked) .qd-opt.ok{border-color:#16a34a;box-shadow:0 0 0 1px #16a34a}
.qd-slide:has(.qd-opt:not(.ok) input:checked) .qd-opt:not(.ok):has(input:checked){border-color:#dc2626;box-shadow:0 0 0 1px #dc2626}
.qd-resume{margin:18px 0;padding:14px;border:1px solid var(--border);border-radius:12px;background:var(--surface-2)}
.qd-grid{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
.rc{width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:700;background:var(--surface);color:#64748b;border:1px solid var(--border)}
${recap}
</style>`;
}

function renderSlide(s: Slide, idx: number, total: number, slug: string): string {
  const n = idx + 1;
  const okLabel = (s.opts.find(o => o.ok) || { t: '?' }).t;
  const opts = s.opts.map(o => `<label class="qd-opt q${n}${o.ok ? ' ok' : ''}"><input type="radio" name="${slug}-${n}"><span>${esc(o.t)}</span></label>`).join('');
  return `<div class="qd-slide"><p class="qd-q"><span class="qd-num">${n}/${total}</span><strong>${esc(s.q)}</strong></p>`
    + `<div class="qd-photo">${s.svg}</div>`
    + `<div class="qd-opts">${opts}</div>`
    + `<div class="qd-fb qd-ok">✅ <strong>Bonne réponse !</strong> ${esc(s.ok)}</div>`
    + `<div class="qd-fb qd-no">❌ <strong>Raté</strong> — la bonne réponse : <strong>${esc(okLabel)}</strong>. ${esc(s.no)} 👉 <a href="${esc(s.href)}">Revoir le cours : ${esc(s.course)}</a></div></div>`;
}

/** Construit la page complète d'un jeu. */
export function buildGamePage(g: Game): PageBlock[] {
  const n = g.slides.length;
  const slides = g.slides.map((s, i) => renderSlide(s, i, n, g.slug)).join('');
  const recap = `<div class="qd-resume"><strong>📊 Récapitulatif</strong> — une case par question : vert = juste, rouge = raté, gris = pas encore répondu.<div class="qd-grid">`
    + g.slides.map((_, i) => `<div class="rc rc-${i + 1}">${i + 1}</div>`).join('') + '</div>'
    + `<p class="meta">Cours associés : ${g.courses.map(([href, t]) => `<a href="${esc(href)}">${esc(t)}</a>`).join(' · ')}</p></div>`;
  const cours = g.courses.map(([href, t]) => `<a href="${esc(href)}">${esc(t)}</a>`).join(' · ');
  // Hero d'abord, style ensuite : un <style> en tête de contenu est perdu par DOMPurify (→ <head>).
  return [
    block('hero', { eyebrow: g.eyebrow, title: g.title, subtitle: g.intro }),
    block('html', { html: style(n) }),
    block('html', { html: `<p class="meta">🎯 ${n} questions. Regarde l'image, choisis une réponse : la correction apparaît aussitôt. 📘 ${cours} · ↩️ <a href="/pages/exercices">Retour aux exercices</a></p>` }),
    block('html', { html: `<div class="qdia">${slides}${recap}</div>` }),
    block('html', { html: '<p class="meta">↩️ <a href="/pages/exercices">Retour aux exercices</a> · 📘 <a href="/pages/cours">Tous les cours</a></p>' }),
  ];
}

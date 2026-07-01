/* Crée le cours "Les niveaux de RAID" (avantages/défauts/cas d'emploi + schémas SVG + analogies).
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-raid.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, normalizePageBlocks, type PageBlock, type CardItem } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const SLUG = 'le-raid';
const TITLE = 'Les niveaux de RAID';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);

// Couleurs (texte blanc partout) : données A/B/C/D, parité P/Q.
const K = { A: '#2563eb', B: '#059669', C: '#d97706', D: '#db2777', P: '#64748b', Q: '#475569' };
type Cell = { t: string; c: string };
/** Schéma SVG : une colonne par disque, une case par bloc. */
function svg(disks: Cell[][]): string {
  const cols = disks.length, rows = Math.max(...disks.map(d => d.length));
  const cw = 50, ch = 26, vg = 6, cg = 18, px = 8, top = 24, bot = 6;
  const W = px * 2 + cols * cw + (cols - 1) * cg, H = top + rows * (ch + vg) - vg + bot;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" style="max-width:${Math.min(W, 380)}px;width:100%;height:auto;margin:4px 0 10px;font-family:monospace">`;
  disks.forEach((d, i) => {
    const x = px + i * (cw + cg);
    s += `<text x="${x + cw / 2}" y="14" text-anchor="middle" font-size="11" fill="#64748b">D${i + 1}</text>`;
    d.forEach((cell, r) => {
      const y = top + r * (ch + vg);
      s += `<rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="4" fill="${cell.c}"/><text x="${x + cw / 2}" y="${y + 17}" text-anchor="middle" font-size="11" fill="#fff" font-weight="bold">${cell.t}</text>`;
    });
  });
  return s + '</svg>';
}
const cell = (t: string, c: string): Cell => ({ t, c });

const body = (schema: string, principe: string, analogie: string, pros: string[], cons: string[], cas: string, fiche: string) =>
  schema
  + `<p><strong>Principe :</strong> ${principe}</p>`
  + `<p>🔎 <em>Analogie :</em> ${analogie}</p>`
  + `<p><strong>✅ Avantages :</strong></p><ul>${pros.map(x => `<li>${x}</li>`).join('')}</ul>`
  + `<p><strong>❌ Inconvénients :</strong></p><ul>${cons.map(x => `<li>${x}</li>`).join('')}</ul>`
  + `<p><strong>🎯 Cas d'emploi :</strong> ${cas}</p>`
  + `<p class="meta">${fiche}</p>`;

const items = [
  { title: 'RAID 0 — Striping (performance)', text: body(
    svg([[cell('A1', K.A), cell('B1', K.B), cell('C1', K.C)], [cell('A2', K.A), cell('B2', K.B), cell('C2', K.C)]]),
    'les données sont découpées en bandes et réparties sur 2 disques ou plus ; on lit et écrit sur tous en parallèle.',
    'deux secrétaires se partagent les pages d\'un même document → deux fois plus vite. Mais si l\'une perd ses pages, le document entier devient illisible.',
    ['Vitesse maximale en lecture <strong>et</strong> écriture.', '<strong>100 %</strong> de la capacité utilisable.'],
    ['<strong>Aucune redondance</strong> : la panne d\'un seul disque = toutes les données perdues.', 'Le risque <strong>augmente</strong> avec le nombre de disques.'],
    'cache, montage vidéo temporaire, données non critiques où seule la vitesse compte (et déjà sauvegardées ailleurs).',
    'Min : 2 disques · Tolérance de panne : 0 · Capacité utile : 100 %') },
  { title: 'RAID 1 — Mirroring (sécurité)', text: body(
    svg([[cell('A', K.A), cell('B', K.B), cell('C', K.C)], [cell('A', K.A), cell('B', K.B), cell('C', K.C)]]),
    'chaque disque contient une <strong>copie identique</strong> des données (miroir).',
    'tu photocopies chaque document en double et tu ranges les copies dans deux armoires. Si une armoire brûle, l\'autre a tout.',
    ['Tolère la panne d\'un disque sans interruption.', 'Lecture rapide ; reconstruction simple (recopie).'],
    ['On paie 2 disques pour la capacité d\'1 → <strong>50 %</strong> utile.', 'L\'écriture n\'est pas accélérée.'],
    'disque système, petits serveurs, NAS perso, données critiques sur 2 disques.',
    'Min : 2 disques · Tolérance : 1 disque · Capacité utile : 50 %') },
  { title: 'RAID 5 — Parité distribuée (compromis)', text: body(
    svg([[cell('A1', K.A), cell('B1', K.B), cell('Pc', K.P)], [cell('A2', K.A), cell('Pb', K.P), cell('C1', K.C)], [cell('Pa', K.P), cell('B2', K.B), cell('C2', K.C)]]),
    'striping + une <strong>parité</strong> répartie sur tous les disques. L\'équivalent d\'un disque sert à la parité ; un disque manquant est recalculé à partir des autres.',
    'dans l\'addition 4 + 5 + 7 = 16, si tu perds le « 5 », tu le retrouves grâce au total (16) et aux autres chiffres. La parité, c\'est ce « total ».',
    ['Bon compromis <strong>capacité / sécurité</strong>.', 'Tolère 1 panne ; lecture rapide.', 'Capacité utile = (N−1)/N (ex. 3 disques → 67 %).'],
    ['Écriture pénalisée (calcul de parité).', 'Reconstruction <strong>longue et risquée</strong> : une 2ᵉ panne pendant la reconstruction = tout perdu.', 'Minimum 3 disques.'],
    'serveurs de fichiers, NAS d\'entreprise, stockage général cherchant sécurité + bonne capacité.',
    'Min : 3 disques · Tolérance : 1 disque · Capacité utile : (N−1)/N') },
  { title: 'RAID 6 — Double parité (sécurité ++)', text: body(
    svg([[cell('A1', K.A), cell('B1', K.B), cell('Pc', K.P)], [cell('A2', K.A), cell('Pb', K.P), cell('Qc', K.Q)], [cell('Pa', K.P), cell('Qb', K.Q), cell('C1', K.C)], [cell('Qa', K.Q), cell('B2', K.B), cell('C2', K.C)]]),
    'comme le RAID 5, mais avec <strong>deux parités</strong> (P et Q) → tolère <strong>2 pannes simultanées</strong>.',
    'tu gardes deux « totaux » différents de ton addition : tu peux retrouver deux chiffres manquants à la fois.',
    ['Tolère <strong>2 disques</strong> en panne — précieux pendant les longues reconstructions.', 'Bonne capacité utile = (N−2)/N.'],
    ['Écriture encore plus pénalisée (double parité).', 'Minimum 4 disques.'],
    'grandes baies, gros disques (reconstruction très longue), archivage critique.',
    'Min : 4 disques · Tolérance : 2 disques · Capacité utile : (N−2)/N') },
  { title: 'RAID 10 — Miroir + agrégat (perf + sécurité)', text: body(
    svg([[cell('A1', K.A), cell('B1', K.B)], [cell('A1', K.A), cell('B1', K.B)], [cell('A2', K.C), cell('B2', K.D)], [cell('A2', K.C), cell('B2', K.D)]]),
    'on crée des <strong>paires en miroir</strong> (RAID 1), puis on <strong>répartit</strong> les données entre ces paires (RAID 0). D1=D2 et D3=D4 sont des miroirs.',
    'chaque secrétaire a un binôme qui copie tout (miroir), et le travail est partagé entre les binômes (striping) : rapide ET protégé.',
    ['Très rapide en lecture <strong>et</strong> écriture.', 'Tolère une panne par miroir ; reconstruction rapide (simple recopie).'],
    ['Coûteux : <strong>50 %</strong> de capacité utile.', 'Minimum 4 disques.'],
    'bases de données, applications exigeantes, serveurs critiques (performance + sécurité).',
    'Min : 4 disques · Tolérance : 1 par miroir · Capacité utile : 50 %') },
];

const overview: CardItem[] = [
  { title: 'RAID 0', text: 'Striping : vitesse max, 0 sécurité.', href: '' },
  { title: 'RAID 1', text: 'Miroir : sécurité simple, 50 % utile.', href: '' },
  { title: 'RAID 5', text: 'Parité : 1 panne tolérée, bon compromis.', href: '' },
  { title: 'RAID 6', text: 'Double parité : 2 pannes tolérées.', href: '' },
  { title: 'RAID 10', text: 'Miroir + agrégat : perf + sécurité.', href: '' },
];

const recap = '<table class="wp-list"><thead><tr><th>Niveau</th><th>Min</th><th>Tolérance</th><th>Capacité utile</th><th>Point fort</th></tr></thead><tbody>'
  + '<tr><td><strong>RAID 0</strong></td><td>2</td><td>0</td><td>100 %</td><td>Vitesse</td></tr>'
  + '<tr><td><strong>RAID 1</strong></td><td>2</td><td>1</td><td>50 %</td><td>Simplicité + sécurité</td></tr>'
  + '<tr><td><strong>RAID 5</strong></td><td>3</td><td>1</td><td>(N−1)/N</td><td>Compromis</td></tr>'
  + '<tr><td><strong>RAID 6</strong></td><td>4</td><td>2</td><td>(N−2)/N</td><td>Sécurité ++</td></tr>'
  + '<tr><td><strong>RAID 10</strong></td><td>4</td><td>1/miroir</td><td>50 %</td><td>Perf + sécurité</td></tr>'
  + '</tbody></table>';

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Hardware', title: TITLE, subtitle: 'Combiner plusieurs disques pour la performance et/ou la sécurité — niveaux, avantages, défauts et cas d\'emploi.' }),
  block('html', { html: '<p>Le <strong>RAID</strong> (<em>Redundant Array of Independent Disks</em>) combine plusieurs disques en un seul volume logique, pour gagner en <strong>performance</strong> et/ou en <strong>sécurité</strong> (redondance).</p>' }),
  block('html', { html: '<aside class="pb-note pb-note-blue"><p class="pb-note-title">🧷 À comprendre d\'abord</p><p>Trois leviers : <strong>striping</strong> (répartir = vitesse), <strong>mirroring</strong> (copier = sécurité), <strong>parité</strong> (reconstruire = sécurité économe). ⚠️ <strong>Un RAID n\'est PAS une sauvegarde</strong> : il protège du crash d\'un disque, pas d\'une suppression, d\'un ransomware ou d\'un incendie.</p></aside>' }),
  block('heading', { level: 2, text: 'Les niveaux en un coup d\'œil' }),
  block('cards', { items: overview }),
  block('heading', { level: 2, text: 'Chaque niveau en détail' }),
  block('html', { html: '<p class="meta">Clique sur un niveau : schéma, principe, analogie, avantages/défauts et cas d\'emploi.</p>' }),
  block('accordion', { items: items.map(i => ({ title: i.title, text: i.text, href: '' })) }),
  block('heading', { level: 2, text: 'Tableau récapitulatif' }),
  block('html', { html: recap }),
  block('html', { html: '<aside class="pb-note pb-note-green"><p class="pb-note-title">🧭 Comment choisir</p><p><strong>RAID 1</strong> pour 2 disques (OS/perso), <strong>RAID 5/6</strong> pour un NAS de fichiers, <strong>RAID 10</strong> pour la performance critique. Et <strong>toujours une vraie sauvegarde</strong> à côté (règle 3-2-1). Sigles (RAID, NAS, SAN…) dans le <a href="/glossaire">Glossaire</a>.</p></aside>' }),
];

function cookieFrom(res: Response): string {
  const sc = (res.headers as any).getSetCookie?.() as string[] | undefined;
  return (sc && sc.length ? sc : [res.headers.get('set-cookie') || '']).map(c => c.split(';')[0]).filter(Boolean).join('; ');
}
async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: PW }) });
  if (!login.ok) throw new Error(`login ${login.status}`);
  const cookie = cookieFrom(login);
  const h = { 'Content-Type': 'application/json', Cookie: cookie };
  const pages = await (await fetch(`${BASE}/api/admin/pages`, { headers: { Cookie: cookie } })).json() as Array<{ id: number; slug: string }>;
  const cur = pages.find(p => p.slug === SLUG);
  const bodyJson = JSON.stringify({ title: TITLE, slug: SLUG, excerpt: 'Cours débutant : les niveaux de RAID (0,1,5,6,10) avec schémas et analogies.', content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1 });
  const res = cur
    ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body: bodyJson })
    : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body: bodyJson });
  console.log('PAGE', res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());

  const cours = pages.find(p => p.slug === 'cours');
  if (cours) {
    const full = await (await fetch(`${BASE}/api/admin/pages/${cours.id}`, { headers: { Cookie: cookie } })).json() as { builder_json: string };
    const hub = normalizePageBlocks(full.builder_json);
    const hrefs = new Set(hub.filter(b => b.type === 'button').map(b => b.href.replace(/^https?:\/\/[^/]+/, '')));
    if (!hrefs.has(`/pages/${SLUG}`)) {
      hub.push(block('button', { label: TITLE, href: `/pages/${SLUG}`, variant: 'secondary' }));
      const r2 = await fetch(`${BASE}/api/admin/pages/${cours.id}`, { method: 'PUT', headers: h, body: JSON.stringify({ title: 'Cours', slug: 'cours', content: renderPageBlocksToHtml(hub), builder_json: serializePageBlocks(hub), published: 1 }) });
      console.log('HUB Cours : bouton ajouté', r2.status);
    } else console.log('HUB Cours : déjà présent');
  }
  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

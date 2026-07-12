/* Synchronisation hors-ligne : récupère le contenu public du site en ligne
   (thème, menus, pages, images) et le met en cache local. Aucune dépendance,
   utilise fetch (Node 18+/Electron). Crawl BFS à partir des menus + racines connues. */
'use strict';
const fs = require('fs');
const path = require('path');

const LIVE = (process.env.TSSR_LIVE || 'https://tssr.miyukini.com').replace(/\/$/, '');
const cacheDir = process.env.TSSR_CACHE || path.join(__dirname, 'cache');
const MAX_PAGES = 800;

const ensure = (d) => fs.mkdirSync(d, { recursive: true });
async function getJson(u) { const r = await fetch(u); if (!r.ok) throw new Error(`${u} ${r.status}`); return r.json(); }
async function download(u, dest) { const r = await fetch(u); if (!r.ok) return false; fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer())); return true; }

async function sync(log = console.log) {
  ensure(path.join(cacheDir, 'api'));
  ensure(path.join(cacheDir, 'pages'));
  ensure(path.join(cacheDir, 'uploads'));

  // 1. Singletons (thème, features, menus) — best effort.
  for (const ep of ['theme', 'features', 'menus']) {
    try { fs.writeFileSync(path.join(cacheDir, 'api', ep + '.json'), JSON.stringify(await getJson(`${LIVE}/api/public/${ep}`))); }
    catch (e) { log('… ' + ep + ' ignoré (' + e.message + ')'); }
  }

  // 2. Graine de slugs : racines connues + liens trouvés dans les menus.
  const seeds = new Set(['home', 'accueil', 'index', 'procedures', 'cours', 'scripts', 'outils', 'depannage', 'atelier-reseau']);
  try {
    const menus = fs.readFileSync(path.join(cacheDir, 'api', 'menus.json'), 'utf8');
    for (const m of menus.matchAll(/\/pages\/([a-z0-9-]+)/g)) seeds.add(m[1]);
  } catch { /* pas de menus */ }

  // 3. Crawl BFS des pages, extraction des liens internes et des images.
  const seen = new Set();
  const queue = [...seeds];
  const uploads = new Set();
  let n = 0;
  while (queue.length && n < MAX_PAGES) {
    const slug = queue.shift();
    if (seen.has(slug)) continue;
    seen.add(slug);
    let page;
    try { page = await getJson(`${LIVE}/api/public/pages/${slug}`); } catch { continue; }
    fs.writeFileSync(path.join(cacheDir, 'pages', slug + '.json'), JSON.stringify(page));
    n++; log('✓ ' + slug);
    const html = String(page.content || '') + String(page.builder_json || '');
    for (const m of html.matchAll(/\/pages\/([a-z0-9-]+)/g)) if (!seen.has(m[1])) queue.push(m[1]);
    for (const m of html.matchAll(/\/uploads\/([A-Za-z0-9._-]+\.(?:png|jpe?g|webp|gif|svg|ico))/gi)) uploads.add(m[1]);
  }

  // 4. Téléchargement des images non déjà en cache.
  let imgs = 0;
  for (const u of uploads) {
    const dest = path.join(cacheDir, 'uploads', u);
    if (fs.existsSync(dest)) { imgs++; continue; }
    try { if (await download(`${LIVE}/uploads/${u}`, dest)) imgs++; } catch { /* ignore */ }
  }

  // 5. Index de recherche (titre + extrait).
  const idx = [...seen]
    .map(s => { try { return JSON.parse(fs.readFileSync(path.join(cacheDir, 'pages', s + '.json'), 'utf8')); } catch { return null; } })
    .filter(Boolean)
    .map(p => ({ slug: p.slug, title: p.title, excerpt: p.excerpt || '' }));
  fs.writeFileSync(path.join(cacheDir, 'index.json'), JSON.stringify({ pages: idx, live: LIVE, updated: new Date().toISOString() }));

  const res = { pages: n, images: imgs, updated: new Date().toISOString() };
  log(`— synchro terminée : ${n} pages, ${imgs} images —`);
  return res;
}

module.exports = { sync, cacheDir, LIVE };
if (require.main === module) sync().then(r => console.log(r)).catch(e => { console.error('ÉCHEC:', e.message); process.exit(1); });

/* Mini-serveur miroir hors-ligne : sert le SPA (dist/client) et le contenu mis
   en cache par sync.js (pages, images) en imitant l'API publique du site.
   Pur Node (http) — aucune dépendance, aucun module natif. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const cacheDir = process.env.TSSR_CACHE || path.join(__dirname, 'cache');
const clientDir = process.env.TSSR_CLIENT || path.join(__dirname, '..', 'dist', 'client');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.map': 'application/json',
};
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(typeof obj === 'string' ? obj : JSON.stringify(obj)); };
const sendFile = (res, fp) => { res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(fp).pipe(res); };
const readCache = (rel, fallback) => { try { return fs.readFileSync(path.join(cacheDir, rel), 'utf8'); } catch { return fallback; } };

function handle(req, res) {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { p = req.url; }

  // ── API publique (miroir du cache) ──
  if (p.startsWith('/api/public/')) {
    const rest = p.slice('/api/public/'.length);
    if (rest === 'theme') return json(res, 200, readCache('api/theme.json', '{}'));
    if (rest === 'features') return json(res, 200, readCache('api/features.json', '{}'));
    if (rest === 'menus') return json(res, 200, readCache('api/menus.json', '[]'));
    if (rest.startsWith('pages/')) {
      const fp = path.join(cacheDir, 'pages', rest.slice('pages/'.length) + '.json');
      return fs.existsSync(fp) ? sendFile(res, fp) : json(res, 404, { error: 'page non disponible hors-ligne' });
    }
    if (rest === 'search') {
      const q = (new URL(req.url, 'http://x').searchParams.get('q') || '').toLowerCase().trim();
      let idx = { pages: [] };
      try { idx = JSON.parse(readCache('index.json', '{"pages":[]}')); } catch { /* */ }
      const hits = !q ? [] : idx.pages.filter(pg => (pg.title || '').toLowerCase().includes(q) || (pg.excerpt || '').toLowerCase().includes(q))
        .slice(0, 30).map(pg => ({ type: 'page', title: pg.title, slug: pg.slug, excerpt: pg.excerpt, url: `/pages/${pg.slug}` }));
      return json(res, 200, hits);
    }
    // Fonctionnalités non mises en cache hors-ligne → liste vide (évite les erreurs du SPA).
    return json(res, 200, '[]');
  }

  // ── Images mises en cache ──
  if (p.startsWith('/uploads/')) {
    const fp = path.join(cacheDir, 'uploads', path.basename(p));
    return fs.existsSync(fp) ? sendFile(res, fp) : json(res, 404, { error: 'image non disponible hors-ligne' });
  }

  // ── SPA statique (dist/client) avec repli sur index.html ──
  if (p === '/' || p === '') p = '/index.html';
  const safe = path.normalize(p).replace(/^(\.\.[/\\])+/, '');
  const fp = path.join(clientDir, safe);
  if (fp.startsWith(clientDir) && fs.existsSync(fp) && fs.statSync(fp).isFile()) return sendFile(res, fp);
  const indexFp = path.join(clientDir, 'index.html');
  if (fs.existsSync(indexFp)) return sendFile(res, indexFp);
  return json(res, 500, { error: 'SPA introuvable — construire le client (npm run build) puis relancer.' });
}

function createServer() { return http.createServer(handle); }
module.exports = { createServer, cacheDir, clientDir };
if (require.main === module) {
  const port = Number(process.env.PORT || 4599);
  createServer().listen(port, '127.0.0.1', () => console.log(`miroir TSSR : http://127.0.0.1:${port}  (client: ${clientDir})`));
}

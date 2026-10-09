// toolbox-dl.cjs — mini serveur de téléchargement des paquets miyukini-toolbox.
// Sert le dernier .deb sur toolbox-deb.miyukini.org et le dernier .rpm sur
// toolbox-rpm.miyukini.org (routage par en-tête Host). Zéro dépendance.
// Les paquets sont lus dans le dossier persistant repo/ (le même que le dépôt).
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3491;
const REPO = process.env.REPO_DIR || path.resolve(__dirname, '..', 'repo');

// Dernier fichier (par date de modif) d'une extension sous un dossier (récursif).
function dernier(dir, ext) {
  let best = null;
  (function walk(d) {
    let entries; try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(ext)) {
        const t = fs.statSync(p).mtimeMs;
        if (!best || t > best.t) best = { p, t, nom: e.name };
      }
    }
  })(dir);
  return best;
}

function servir(res, fichier, type) {
  if (!fichier) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('Aucun paquet disponible (dépôt pas encore publié).'); }
  res.writeHead(200, {
    'content-type': type,
    'content-disposition': `attachment; filename="${fichier.nom}"`,
    'cache-control': 'no-cache',
  });
  fs.createReadStream(fichier.p).pipe(res);
}

http.createServer((req, res) => {
  const host = (req.headers.host || '').toLowerCase();
  const url = (req.url || '/').toLowerCase();
  // Routage : par sous-domaine, avec repli sur l'extension demandée dans l'URL.
  const veutRpm = host.startsWith('toolbox-rpm') || url.endsWith('.rpm');
  if (veutRpm) servir(res, dernier(path.join(REPO, 'rpm'), '.rpm'), 'application/x-rpm');
  else servir(res, dernier(path.join(REPO, 'apt', 'pool'), '.deb'), 'application/vnd.debian.binary-package');
}).listen(PORT, '127.0.0.1', () => console.log('toolbox-dl sur http://127.0.0.1:' + PORT + ' (repo: ' + REPO + ')'));

/* Point d'entrée de l'exécutable autonome « TSSR — Site hors-ligne ».

   Tout est dans le fichier : le moteur Node, le serveur, le front, le contenu et
   le module SQLite natif. L'élève n'installe rien, il double-clique.

   Un paquet est en lecture seule, et le CMS écrit (base, médias). Au premier
   lancement, l'exe dépose donc ce qui doit vivre à côté de lui, dans un dossier
   « TSSR-donnees » voisin, et fait pointer le serveur dessus.

   Options : --maj  met à jour le contenu depuis le site en ligne
             --port <n>, --aide */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');

// Ressources embarquées (déposées par scripts/build-exe.mjs à côté de ce fichier).
const EMBARQUE = path.join(__dirname, 'contenu');
const SOURCE = process.env.SITE_SOURCE || '__SOURCE__';
const VERSION = '__VERSION__';

const arg = (nom) => { const i = process.argv.indexOf(nom); return i === -1 ? null : process.argv[i + 1]; };
const drapeau = (nom) => process.argv.includes(nom);

if (drapeau('--aide') || drapeau('--help')) {
  console.log(`\n  TSSR — Site hors-ligne (${VERSION})\n`);
  console.log('  Sans option    : démarre le site et ouvre le navigateur.');
  console.log('  --maj          : met à jour le contenu depuis ' + SOURCE);
  console.log('  --port <n>     : écoute sur un autre port (défaut 3460)');
  console.log('  --donnees <d>  : dossier de données (défaut « TSSR-donnees » à côté de l\'exe)\n');
  process.exit(0);
}

// process.execPath = l'exe lui-même : les données vivent à côté, pas dans %TEMP%,
// pour qu'une clé USB emporte le site ET son contenu.
const DOSSIER_EXE = path.dirname(process.execPath);
const DONNEES = path.resolve(arg('--donnees') || process.env.TSSR_DONNEES || path.join(DOSSIER_EXE, 'TSSR-donnees'));
const PORT = Number(arg('--port') || process.env.PORT || 3460);

const log = (m) => console.log(`  ${m}`);

/* Copie depuis le paquet vers le disque, à la main.

   fs.cpSync et fs.copyFileSync ne savent pas lire le système de fichiers virtuel
   de l'exécutable (« ENOENT: lstat C:\snapshot\... ») : seules les lectures
   simples y fonctionnent. On descend donc l'arborescence nous-mêmes, avec
   readdirSync + readFileSync, les deux que le paquet sait servir. */
function copierDuPaquet(depuis, vers) {
  const infos = fs.statSync(depuis);
  if (!infos.isDirectory()) { fs.writeFileSync(vers, fs.readFileSync(depuis)); return; }
  fs.mkdirSync(vers, { recursive: true });
  for (const nom of fs.readdirSync(depuis)) copierDuPaquet(path.join(depuis, nom), path.join(vers, nom));
}

function copierSiAbsent(depuis, vers) {
  if (fs.existsSync(vers)) return false;
  fs.mkdirSync(path.dirname(vers), { recursive: true });
  copierDuPaquet(depuis, vers);
  return true;
}

function deposerRessources() {
  fs.mkdirSync(DONNEES, { recursive: true });

  // Le module natif doit être un VRAI fichier : on ne charge pas du code
  // machine depuis le système de fichiers virtuel du paquet.
  const natif = path.join(DONNEES, 'better_sqlite3.node');
  const marque = path.join(DONNEES, '.version');
  const versionPosee = fs.existsSync(marque) ? fs.readFileSync(marque, 'utf8').trim() : '';
  if (!fs.existsSync(natif) || versionPosee !== VERSION) {
    fs.writeFileSync(natif, fs.readFileSync(path.join(EMBARQUE, 'better_sqlite3.node')));
  }

  // Le front suit l'exe : on le repose à chaque changement de version.
  const dist = path.join(DONNEES, 'dist', 'client');
  if (versionPosee !== VERSION) fs.rmSync(dist, { recursive: true, force: true });
  copierSiAbsent(path.join(EMBARQUE, 'dist', 'client'), dist);

  // Le contenu, lui, appartient à l'élève une fois déposé : on ne l'écrase jamais
  // (il a pu le mettre à jour, ou modifier le site en local).
  const neuf = copierSiAbsent(path.join(EMBARQUE, 'cms.sqlite'), path.join(DONNEES, 'cms.sqlite'));
  copierSiAbsent(path.join(EMBARQUE, 'uploads'), path.join(DONNEES, 'uploads'));

  fs.writeFileSync(marque, VERSION);
  return { natif, dist, neuf };
}

// ---- Mise à jour du contenu depuis le site en ligne ----
async function majContenu() {
  console.log(`\n  Mise à jour du contenu depuis ${SOURCE}\n`);
  if (!/^https?:\/\//i.test(SOURCE)) { console.error('  ✗ Adresse du site source invalide.'); process.exit(2); }
  let res;
  try { res = await fetch(`${SOURCE}/api/public/hors-ligne/contenu`); }
  catch (e) { console.error(`  ✗ Site injoignable : ${SOURCE}`); console.error(`    ${e && e.message}`); process.exit(3); }
  if (!res.ok) { console.error(`  ✗ Téléchargement refusé : HTTP ${res.status}.`); process.exit(3); }
  const buf = Buffer.from(await res.arrayBuffer());
  log(`Reçu : ${(buf.length / 1048576).toFixed(1)} Mo`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tssr-maj-'));
  const zip = path.join(tmp, 'contenu.zip');
  fs.writeFileSync(zip, buf);
  try {
    execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command',
      `Expand-Archive -Path '${zip}' -DestinationPath '${tmp}' -Force`], { stdio: 'pipe' });
  } catch (e) {
    fs.rmSync(tmp, { recursive: true, force: true });
    console.error('  ✗ Extraction impossible.'); console.error(`    ${e && e.message}`); process.exit(4);
  }

  const base = path.join(tmp, 'cms.sqlite');
  if (!fs.existsSync(base)) { fs.rmSync(tmp, { recursive: true, force: true }); console.error('  ✗ Archive inattendue.'); process.exit(4); }
  const cible = path.join(DONNEES, 'cms.sqlite');
  if (fs.existsSync(cible)) {
    const estampille = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    fs.copyFileSync(cible, path.join(DONNEES, `cms.sqlite.bak-${estampille}`));
    log(`Ancienne base sauvegardée : cms.sqlite.bak-${estampille}`);
  }
  for (const ext of ['-wal', '-shm']) fs.rmSync(cible + ext, { force: true });
  fs.copyFileSync(base, cible);
  const medias = path.join(tmp, 'uploads');
  if (fs.existsSync(medias)) fs.cpSync(medias, path.join(DONNEES, 'uploads'), { recursive: true });
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('\n  ✓ Contenu à jour. Relance l\'application.\n');
}

// ---- Démarrage ----
async function main() {
  console.log(`\n  TSSR — Site hors-ligne  (${VERSION})`);
  const { natif, dist, neuf } = deposerRessources();
  log(`Données : ${DONNEES}`);
  if (neuf) log('Premier lancement : contenu déposé.');

  if (drapeau('--maj')) { await majContenu(); return; }

  // Le serveur lit ces variables : il travaille donc hors du paquet, là où il
  // peut écrire, sans rien savoir du fait qu'il est empaqueté.
  process.env.TSSR_SQLITE_NODE = natif;
  process.env.DB_PATH = path.join(DONNEES, 'cms.sqlite');
  process.env.UPLOADS_DIR = path.join(DONNEES, 'uploads');
  process.env.CLOUD_DIR = path.join(DONNEES, 'cloud');
  process.env.DIST_DIR = dist;
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';
  process.env.SERVE_STATIC = '1';
  process.env.COOKIE_SECURE = '0';
  process.env.PORT = String(PORT);
  process.env.PUBLIC_BASE_URL = `http://localhost:${PORT}`;
  process.env.CMS_ADMIN_USER = process.env.CMS_ADMIN_USER || 'admin';
  process.env.CMS_ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD || 'admin';
  // Un secret propre à cette copie, tiré une fois puis gardé. Le serveur sait le
  // faire lui-même, mais il l'écrirait dans le paquet, qui est en lecture seule.
  if (!process.env.SESSION_SECRET) {
    const fichier = path.join(DONNEES, '.session-secret');
    if (!fs.existsSync(fichier)) fs.writeFileSync(fichier, require('node:crypto').randomBytes(48).toString('base64url'), { mode: 0o600 });
    process.env.SESSION_SECRET = fs.readFileSync(fichier, 'utf8').trim();
  }

  log(`Le site s'ouvre sur http://localhost:${PORT}`);
  log('Pour arrêter : ferme cette fenêtre.\n');
  try { spawn('cmd', ['/c', 'start', '', `http://localhost:${PORT}`], { detached: true, stdio: 'ignore' }).unref(); } catch { /* pas grave */ }

  require('./serveur.cjs');
}

main().catch((e) => { console.error('\n  ✗ Échec : ' + (e && e.stack || e) + '\n'); process.exit(1); });

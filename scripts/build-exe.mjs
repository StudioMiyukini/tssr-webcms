/* Construit l'EXÉCUTABLE autonome du site hors-ligne : un seul fichier .exe,
   moteur Node compris. Rien à installer sur le poste de l'élève.

   Ce qui entre dedans : le runtime Node, le serveur bundlé, le front, le
   contenu (base assainie + médias) et le module SQLite natif.
   Ce qui en sort : TSSR-Site-hors-ligne.exe

   Au premier lancement, l'exe dépose ce qui doit être modifiable dans un dossier
   « TSSR-donnees » à côté de lui — un paquet est en lecture seule, or le CMS
   écrit. Voir scripts/portable/exe.cjs.

   Réglages :
     EXE_OUT          fichier de sortie     (défaut ./export/TSSR-Site-hors-ligne.exe)
     EXE_DB           base à embarquer      (défaut ./cms.sqlite)
     EXE_SOURCE_URL   site visé par --maj   (défaut PUBLIC_BASE_URL)
     EXE_CIBLE        cible pkg             (défaut node22-win-x64)

   Usage : npm run build:exe */
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SORTIE = path.resolve(process.env.EXE_OUT || path.join(ROOT, 'export', 'TSSR-Site-hors-ligne.exe'));
const DB = path.resolve(process.env.EXE_DB || path.join(ROOT, 'cms.sqlite'));
const SOURCE_URL = (process.env.EXE_SOURCE_URL || process.env.PUBLIC_BASE_URL || 'https://tssr.miyukini.com').replace(/\/+$/, '');
const CIBLE = process.env.EXE_CIBLE || 'node22-win-x64';
// La cible pkg fixe la version de Node embarquée, donc l'ABI du module natif :
// un binaire d'un autre ABI ne se chargerait pas. Les deux doivent rester d'accord.
const ABI_PAR_CIBLE = { node20: '115', node22: '127', node24: '137' };

const STAGE = path.join(ROOT, 'export', 'exe-build');
const rm = (p) => fs.rmSync(p, { recursive: true, force: true });
const cp = (s, d) => fs.cpSync(s, d, { recursive: true });
const mo = (o) => (o / 1048576).toFixed(1);

const [majeur, systeme, arch] = CIBLE.split('-');
const ABI = ABI_PAR_CIBLE[majeur];
if (!ABI) { console.error(`✗ Cible inconnue : ${CIBLE} (attendu node20/node22/node24-<systeme>-<arch>)`); process.exit(1); }

const DIST = path.join(ROOT, 'dist', 'client');
if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('✗ dist/client introuvable — lance « npm run build » d\'abord.');
  process.exit(1);
}

// 0. Repartir propre
rm(STAGE);
fs.mkdirSync(path.join(STAGE, 'contenu'), { recursive: true });

// 1. Le lanceur + le serveur, bundlés en un seul fichier CommonJS (ce que pkg sait lire).
//    better-sqlite3 passe par l'enveloppe qui lui donne le chemin du binaire natif.
const lanceur = path.join(STAGE, 'entree-src.cjs');
fs.writeFileSync(lanceur, fs.readFileSync(path.join(ROOT, 'scripts', 'portable', 'exe.cjs'), 'utf8')
  .replace('__SOURCE__', SOURCE_URL)
  .replace(/__VERSION__/g, new Date().toISOString().slice(0, 10))
  .replace("require('./serveur.cjs')", `require(${JSON.stringify(path.join(ROOT, 'server', 'index.ts'))})`));

// L'enveloppe SQLite, avec le chemin absolu du vrai module gravé dedans.
const enveloppe = path.join(STAGE, 'sqlite-enveloppe.cjs');
fs.writeFileSync(enveloppe, fs.readFileSync(path.join(ROOT, 'scripts', 'portable', 'sqlite-enveloppe.cjs'), 'utf8')
  .replace("'__REEL__'", JSON.stringify(path.join(ROOT, 'node_modules', 'better-sqlite3', 'lib', 'index.js'))));

await build({
  entryPoints: [lanceur],
  outfile: path.join(STAGE, 'entree.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: `node${majeur.replace('node', '')}`,
  legalComments: 'none',
  logLevel: 'warning',
  alias: { 'better-sqlite3': enveloppe },
  // En sortie CommonJS, « import.meta.url » n'existe pas : on le remplace par un
  // équivalent calculé depuis __filename, sinon env.ts casse au chargement.
  define: { 'import.meta.url': '__URL_MODULE__' },
  banner: { js: 'const __URL_MODULE__ = require("url").pathToFileURL(__filename).href;' },
});
rm(lanceur);
rm(enveloppe);
console.log(`✓ lanceur + serveur bundlés (${mo(fs.statSync(path.join(STAGE, 'entree.cjs')).size)} Mo)`);

// 2. Le module natif, dans l'ABI de la cible. Les binaires officiels sont déjà
//    en cache depuis la construction de l'archive portable.
const cacheNatif = path.join(ROOT, 'export', 'prebuilds');
const nomTar = (v) => `better-sqlite3-v${v}-node-v${ABI}-${systeme === 'win' ? 'win32' : systeme}-${arch}.tar.gz`;
const versionBs = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/better-sqlite3/package.json'), 'utf8')).version;
const tar = path.join(cacheNatif, nomTar(versionBs));
if (fs.existsSync(tar)) {
  execFileSync('tar', ['-xzf', path.basename(tar), '-C', path.join(STAGE, 'contenu')], { cwd: path.dirname(tar), stdio: 'pipe' });
  fs.renameSync(path.join(STAGE, 'contenu', 'build', 'Release', 'better_sqlite3.node'), path.join(STAGE, 'contenu', 'better_sqlite3.node'));
  rm(path.join(STAGE, 'contenu', 'build'));
} else if (String(process.versions.modules) === ABI && process.platform === 'win32' && systeme === 'win') {
  cp(path.join(ROOT, 'node_modules/better-sqlite3/build/Release/better_sqlite3.node'), path.join(STAGE, 'contenu', 'better_sqlite3.node'));
} else {
  console.error(`✗ Binaire natif introuvable pour ${CIBLE} (ABI ${ABI}).`);
  console.error(`  Lance « node scripts/build-portable.mjs » une fois : il remplit export/prebuilds/.`);
  process.exit(1);
}
console.log(`✓ module natif SQLite (ABI ${ABI}) embarqué`);

// 3. Le front et le contenu
cp(DIST, path.join(STAGE, 'contenu', 'dist', 'client'));
if (!fs.existsSync(DB)) { console.error(`✗ Base introuvable : ${DB}`); process.exit(1); }
cp(DB, path.join(STAGE, 'contenu', 'cms.sqlite'));
const up = path.join(ROOT, 'uploads');
if (fs.existsSync(up)) cp(up, path.join(STAGE, 'contenu', 'uploads'));
console.log('✓ front, base et médias embarqués');

// 4. pkg a besoin d'un package.json qui déclare le point d'entrée et les ressources.
fs.writeFileSync(path.join(STAGE, 'package.json'), JSON.stringify({
  name: 'tssr-site-hors-ligne',
  version: '1.0.0',
  bin: 'entree.cjs',
  pkg: { assets: ['contenu/**/*'], targets: [CIBLE] },
}, null, 2));

fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
rm(SORTIE);
console.log(`→ Empaquetage (${CIBLE})… la première fois, pkg télécharge le moteur Node.`);
execFileSync(process.execPath, [
  path.join(ROOT, 'node_modules', '@yao-pkg', 'pkg', 'lib-es5', 'bin.js'),
  '.', '--target', CIBLE, '--output', SORTIE, '--compress', 'Brotli',
], { cwd: STAGE, stdio: 'inherit' });

if (!fs.existsSync(SORTIE)) { console.error('✗ pkg n\'a rien produit.'); process.exit(1); }
rm(STAGE);
console.log(`\n✓ Exécutable prêt : ${SORTIE}  (${mo(fs.statSync(SORTIE).size)} Mo)`);
console.log('  Double-clic → le site s\'ouvre sur http://localhost:3460');
console.log(`  Mise à jour du contenu : TSSR-Site-hors-ligne.exe --maj  (depuis ${SOURCE_URL})`);

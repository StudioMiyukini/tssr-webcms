/* Construit une version PORTABLE et légère du site, exécutable hors-ligne avec Node.
   - Bundle tout le serveur en un seul fichier (esbuild) → plus besoin de l'énorme node_modules.
   - N'embarque que le module natif better-sqlite3 (+ ses 2 deps runtime).
   - Copie le front buildé (dist), la base de contenu et les polices auto-hébergées.
   Sortie : ./portable/   (à copier sur clé USB / autre poste)
   Usage : npm run build:portable */
import { build } from 'esbuild';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'portable');
const rm = (p) => fs.rmSync(p, { recursive: true, force: true });
const cp = (s, d) => fs.cpSync(s, d, { recursive: true });
const size = (p) => { let t = 0; for (const e of fs.readdirSync(p, { withFileTypes: true })) { const f = path.join(p, e.name); t += e.isDirectory() ? size(f) : fs.statSync(f).size; } return t; };

// 0. Repartir d'un dossier propre
rm(OUT);
fs.mkdirSync(path.join(OUT, 'server'), { recursive: true });

// 1. Vérifier que le front est buildé
const DIST = path.join(ROOT, 'dist', 'client');
if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('✗ dist/client introuvable — lance "npm run build" d\'abord.');
  process.exit(1);
}

// 2. Bundler le serveur en un seul fichier ESM. better-sqlite3 reste externe (binaire natif).
await build({
  entryPoints: [path.join(ROOT, 'server', 'index.ts')],
  outfile: path.join(OUT, 'server', 'index.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  external: ['better-sqlite3'],
  legalComments: 'none',
  logLevel: 'warning',
  // Shim ESM : fournit `require` aux paquets CJS bundlés (le code source gère déjà __dirname).
  banner: { js: "import{createRequire as ___cr}from'module';const require=___cr(import.meta.url);" },
});
console.log('✓ serveur bundlé → portable/server/index.mjs');

// 3. Embarquer better-sqlite3 (trimmé) + ses 2 deps runtime
const NM = path.join(OUT, 'node_modules');
const bs = path.join(NM, 'better-sqlite3');
fs.mkdirSync(path.join(bs, 'build', 'Release'), { recursive: true });
cp(path.join(ROOT, 'node_modules/better-sqlite3/lib'), path.join(bs, 'lib'));
cp(path.join(ROOT, 'node_modules/better-sqlite3/package.json'), path.join(bs, 'package.json'));
cp(path.join(ROOT, 'node_modules/better-sqlite3/build/Release/better_sqlite3.node'), path.join(bs, 'build/Release/better_sqlite3.node'));
for (const dep of ['bindings', 'file-uri-to-path']) cp(path.join(ROOT, 'node_modules', dep), path.join(NM, dep));
console.log('✓ better-sqlite3 (natif) + bindings embarqués');

// 4. Front buildé (inclut les polices auto-hébergées dans /fonts)
cp(DIST, path.join(OUT, 'dist', 'client'));
console.log('✓ front (dist/client) copié');

// 5. Contenu : copie CONSISTANTE de la base via l'API backup de better-sqlite3
//    (replie le WAL → embarque bien les écritures récentes, sans perturber le serveur live).
const db = path.join(ROOT, 'cms.sqlite');
if (fs.existsSync(db)) {
  const src = new Database(db, { readonly: true });
  await src.backup(path.join(OUT, 'cms.sqlite'));
  src.close();
  console.log('✓ contenu cms.sqlite copié (backup consistant, WAL inclus)');
} else console.log('· cms.sqlite absent — la base sera créée au 1er lancement (pense à seed)');
const up = path.join(ROOT, 'uploads');
if (fs.existsSync(up)) cp(up, path.join(OUT, 'uploads'));

// 6. Config portable (mode local HTTP hors-ligne)
fs.writeFileSync(path.join(OUT, '.env.local'),
  '# Config de la version portable (hébergement local HTTP, hors-ligne).\n'
  + 'NODE_ENV=development\nSERVE_STATIC=1\nCOOKIE_SECURE=0\nPORT=3460\nPUBLIC_BASE_URL=http://localhost:3460\n');

// 7. Lanceur Windows + notice
fs.writeFileSync(path.join(OUT, 'Lancer-le-site.bat'),
  '@echo off\r\nchcp 65001 >nul\r\ncd /d "%~dp0"\r\necho Demarrage du site sur http://localhost:3460 ...\r\n'
  + 'start "" http://localhost:3460\r\nnode server\\index.mjs\r\npause\r\n');
fs.writeFileSync(path.join(OUT, 'LISEZ-MOI.txt'),
  'SITE PORTABLE — consultation hors-ligne\r\n'
  + '=======================================\r\n\r\n'
  + 'Prerequis : Node.js 20+ installe sur le poste (https://nodejs.org).\r\n\r\n'
  + 'Demarrer : double-cliquer sur "Lancer-le-site.bat".\r\n'
  + 'Le navigateur s\'ouvre sur http://localhost:3460\r\n'
  + 'Back-office : http://localhost:3460/admin\r\n\r\n'
  + 'Tout fonctionne sans Internet. Pour arreter : fermer la fenetre noire.\r\n');

// 8. Bilan
const mo = (size(OUT) / (1024 * 1024)).toFixed(1);
console.log(`\n✓ Version portable prête : ${OUT}`);
console.log(`  Poids total : ${mo} Mo (hors Node.js, à installer sur le poste).`);

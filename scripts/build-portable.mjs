/* Construit une version PORTABLE et légère du site, exécutable hors-ligne avec Node.
   - Bundle tout le serveur en un seul fichier (esbuild) → plus besoin de l'énorme node_modules.
   - N'embarque que le module natif better-sqlite3 (+ ses 2 deps runtime).
   - Copie le front buildé (dist), la base de contenu et les polices auto-hébergées.
   - Y ajoute un metteur à jour : « Mettre-a-jour » recharge le contenu depuis le site en ligne.
   Sortie : ./portable/   (à copier sur clé USB / autre poste)
   Usage : npm run build:portable

   Réglages (variables d'environnement — le serveur s'en sert pour bâtir l'archive
   « site hors-ligne » proposée aux visiteurs, avec une base assainie) :
     PORTABLE_OUT          dossier de sortie            (défaut ./portable)
     PORTABLE_DB           base à embarquer             (défaut ./cms.sqlite)
     PORTABLE_SOURCE_URL   site visé par le metteur à jour (défaut PUBLIC_BASE_URL)
     PORTABLE_ABIS         ABI Node embarquées          (défaut 127,131,137,141,147)
     PORTABLE_CIBLES       systèmes embarqués           (défaut win32-x64,linux-x64,darwin-x64,darwin-arm64) */
import { build } from 'esbuild';
import Database from 'better-sqlite3';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(process.env.PORTABLE_OUT || path.join(ROOT, 'portable'));
const SOURCE_URL = (process.env.PORTABLE_SOURCE_URL || process.env.PUBLIC_BASE_URL || 'https://tssr.miyukini.com').replace(/\/+$/, '');
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

// 3 bis. Le binaire natif ne vaut que pour UNE version d'ABI Node et UN système.
// Le poste d'en face a rarement le même Node que le serveur : on embarque donc
// les binaires officiels des ABI et plateformes courantes, et demarrer.mjs pose
// le bon avant le démarrage. Sans cela : « was compiled against a different
// Node.js version », et le site refuse de s'ouvrir.
const VERSION_BS = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/better-sqlite3/package.json'), 'utf8')).version;
const ABIS = (process.env.PORTABLE_ABIS || '127,131,137,141,147').split(',').map(s => s.trim()).filter(Boolean);
const CIBLES = (process.env.PORTABLE_CIBLES || 'win32-x64,linux-x64,darwin-x64,darwin-arm64').split(',').map(s => s.trim()).filter(Boolean);
const CACHE = path.join(ROOT, 'export', 'prebuilds'); // export/ est ignoré par git
const PB = path.join(bs, 'prebuilds');

// Le binaire local d'abord : il couvre au moins le système qui construit.
fs.mkdirSync(path.join(PB, `${process.platform}-${process.arch}`), { recursive: true });
cp(path.join(ROOT, 'node_modules/better-sqlite3/build/Release/better_sqlite3.node'),
   path.join(PB, `${process.platform}-${process.arch}`, `abi-${process.versions.modules}.node`));

async function recupererPrebuild(cible, abi) {
  const nom = `better-sqlite3-v${VERSION_BS}-node-v${abi}-${cible}.tar.gz`;
  const arch = path.join(CACHE, nom);
  if (!fs.existsSync(arch)) {
    const url = `https://github.com/WiseLibs/better-sqlite3/releases/download/v${VERSION_BS}/${nom}`;
    const res = await fetch(url);
    if (!res.ok) return false; // combinaison non publiée : on passe, sans bruit
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(arch, Buffer.from(await res.arrayBuffer()));
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-'));
  try {
    // Nom RELATIF + cwd : le tar de Git for Windows lit « D:\… » comme un hôte
    // distant (« Cannot connect to D »), là où le tar de Windows s'en accommode.
    execFileSync('tar', ['-xzf', path.basename(arch), '-C', tmp], { cwd: path.dirname(arch), stdio: 'pipe' });
    const bin = path.join(tmp, 'build', 'Release', 'better_sqlite3.node');
    if (!fs.existsSync(bin)) return false;
    fs.mkdirSync(path.join(PB, cible), { recursive: true });
    fs.copyFileSync(bin, path.join(PB, cible, `abi-${abi}.node`));
    return true;
  } catch { return false; } finally { rm(tmp); }
}

let poses = 0;
for (const cible of CIBLES) {
  for (const abi of ABIS) {
    if (fs.existsSync(path.join(PB, cible, `abi-${abi}.node`))) continue;
    if (await recupererPrebuild(cible, abi)) poses += 1;
  }
}
const couverture = fs.readdirSync(PB).map(c => `${c} (${fs.readdirSync(path.join(PB, c)).length})`).join(', ');
console.log(`✓ better-sqlite3 : ${poses} binaire(s) récupéré(s) — couverture : ${couverture}`);
if (!poses && CIBLES.length) console.log('  ⚠  aucun binaire téléchargé (pas de réseau ?) : l\'archive ne tournera que sur un Node de même ABI.');

// 4. Front buildé (inclut les polices auto-hébergées dans /fonts)
cp(DIST, path.join(OUT, 'dist', 'client'));
console.log('✓ front (dist/client) copié');

// 5. Contenu : copie CONSISTANTE de la base via l'API backup de better-sqlite3
//    (replie le WAL → embarque bien les écritures récentes, sans perturber le serveur live).
const db = path.resolve(process.env.PORTABLE_DB || path.join(ROOT, 'cms.sqlite'));
if (fs.existsSync(db)) {
  const src = new Database(db, { readonly: true });
  await src.backup(path.join(OUT, 'cms.sqlite'));
  src.close();
  console.log('✓ contenu cms.sqlite copié (backup consistant, WAL inclus)');
} else console.log('· cms.sqlite absent — la base sera créée au 1er lancement (pense à seed)');
const up = path.join(ROOT, 'uploads');
if (fs.existsSync(up)) cp(up, path.join(OUT, 'uploads'));

// 6. Config portable (mode local HTTP hors-ligne)
//    CMS_ADMIN_* ne sert QUE si la base embarquée n'a aucun compte (cas de l'archive
//    publique, dont les comptes sont retirés) : le serveur en crée un au 1er lancement.
fs.writeFileSync(path.join(OUT, '.env.local'),
  '# Config de la version portable (hébergement local HTTP, hors-ligne).\n'
  + 'NODE_ENV=development\nSERVE_STATIC=1\nCOOKIE_SECURE=0\nPORT=3460\nPUBLIC_BASE_URL=http://localhost:3460\n'
  + 'CMS_ADMIN_USER=admin\nCMS_ADMIN_PASSWORD=admin\n');

// 7. Lanceurs + metteur à jour + notice
// Le lanceur passe par demarrer.mjs, qui met en place le binaire SQLite de l'ABI du poste.
cp(path.join(ROOT, 'scripts', 'portable', 'demarrer.mjs'), path.join(OUT, 'demarrer.mjs'));
fs.writeFileSync(path.join(OUT, 'Lancer-le-site.bat'),
  '@echo off\r\nchcp 65001 >nul\r\ncd /d "%~dp0"\r\necho Demarrage du site sur http://localhost:3460 ...\r\n'
  + 'start "" http://localhost:3460\r\nnode demarrer.mjs\r\npause\r\n');
fs.writeFileSync(path.join(OUT, 'lancer-le-site.sh'),
  '#!/bin/sh\ncd "$(dirname "$0")" && exec node demarrer.mjs\n', { mode: 0o755 });

// Le metteur à jour : recharge le CONTENU depuis le site en ligne, sans toucher au programme.
// L'adresse du site source est fixée ici, à la construction de l'archive.
const maj = fs.readFileSync(path.join(ROOT, 'scripts', 'portable', 'mettre-a-jour.mjs'), 'utf8').replace('__SOURCE__', SOURCE_URL);
fs.writeFileSync(path.join(OUT, 'mettre-a-jour.mjs'), maj);
fs.writeFileSync(path.join(OUT, 'Mettre-a-jour.bat'),
  '@echo off\r\nchcp 65001 >nul\r\ncd /d "%~dp0"\r\n'
  + 'echo Fermez d\'abord la fenetre du site s\'il tourne encore.\r\n'
  + 'node mettre-a-jour.mjs\r\npause\r\n');
fs.writeFileSync(path.join(OUT, 'mettre-a-jour.sh'),
  '#!/bin/sh\n# Ferme d\'abord le site s\'il tourne encore.\ncd "$(dirname "$0")" && exec node mettre-a-jour.mjs\n', { mode: 0o755 });

fs.writeFileSync(path.join(OUT, 'LISEZ-MOI.txt'),
  'SITE HORS-LIGNE — le site complet sur ton poste\r\n'
  + '==============================================\r\n\r\n'
  + 'Prerequis : Node.js 22 LTS ou plus recent (https://nodejs.org).\r\n'
  + '  Node 20 ne convient pas : le moteur de base de donnees n\'est plus\r\n'
  + '  publie pour cette version.\r\n\r\n'
  + 'DEMARRER\r\n'
  + '  Double-clic sur "Lancer-le-site.bat"  (Linux/Mac : ./lancer-le-site.sh)\r\n'
  + '  Le navigateur s\'ouvre sur http://localhost:3460\r\n'
  + '  Tout fonctionne sans Internet. Pour arreter : fermer la fenetre noire.\r\n\r\n'
  + 'METTRE A JOUR LE CONTENU\r\n'
  + '  Double-clic sur "Mettre-a-jour.bat"   (Linux/Mac : ./mettre-a-jour.sh)\r\n'
  + `  Recupere les cours et medias a jour depuis ${SOURCE_URL}.\r\n`
  + '  Ferme d\'abord le site. L\'ancienne base est sauvegardee (cms.sqlite.bak-...).\r\n'
  + '  Une connexion Internet est necessaire pour cette etape seulement.\r\n\r\n'
  + 'BACK-OFFICE\r\n'
  + '  http://localhost:3460/admin\r\n'
  + '  Identifiants de CETTE copie : admin / admin (a changer dans .env.local\r\n'
  + '  AVANT le tout premier lancement). Les comptes du site en ligne ne sont\r\n'
  + '  pas dans cette archive : ce que tu modifies ici ne part nulle part.\r\n');

// 8. Bilan
const mo = (size(OUT) / (1024 * 1024)).toFixed(1);
console.log(`\n✓ Version portable prête : ${OUT}`);
console.log(`  Poids total : ${mo} Mo (hors Node.js, à installer sur le poste).`);

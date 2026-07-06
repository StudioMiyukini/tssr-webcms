/* Importe le contenu d'un export du site (base cms.sqlite + uploads) dans CETTE instance locale.
   Accepte un .zip / .tgz d'export OU un dossier "portable".
   Sauvegarde l'ancienne base avant d'écraser. À faire SERVEUR ARRÊTÉ.
   Usage : node scripts/import-site.mjs <chemin-du-zip-ou-dossier>
   Puis : npm run start:local   (http://localhost:3460) */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = process.argv[2];
if (!arg) { console.error('Usage : node scripts/import-site.mjs <chemin-du-zip-ou-dossier-portable>'); process.exit(1); }
const src = path.resolve(arg);
if (!fs.existsSync(src)) { console.error('✗ Introuvable : ' + src); process.exit(1); }

// 1. Obtenir un dossier source (extraire si archive)
let dir = src, tmp = null;
if (fs.statSync(src).isFile()) {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'import-site-'));
  console.log('→ Extraction de l\'archive…');
  if (/\.zip$/i.test(src)) {
    if (process.platform === 'win32') execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${src}' -DestinationPath '${tmp}' -Force"`, { stdio: 'inherit' });
    else execSync(`unzip -q -o "${src}" -d "${tmp}"`, { stdio: 'inherit' });
  } else if (/\.tgz$|\.tar\.gz$/i.test(src)) {
    execSync(`tar -xzf "${src}" -C "${tmp}"`, { stdio: 'inherit' });
  } else { console.error('✗ Format non reconnu (.zip / .tgz ou dossier).'); process.exit(1); }
  dir = tmp;
}

// 2. Localiser cms.sqlite et uploads (à la racine ou dans un sous-dossier)
const find = (base, name, isDir) => {
  const stack = [base];
  while (stack.length) {
    const d = stack.shift();
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (isDir && e.name === name) return p; if (e.name !== 'node_modules') stack.push(p); }
      else if (!isDir && e.name === name) return p;
    }
  }
  return null;
};
const db = find(dir, 'cms.sqlite', false);
const uploads = find(dir, 'uploads', true);
if (!db) { console.error('✗ cms.sqlite introuvable dans la source.'); process.exit(1); }

// 3. Sauvegarder la base actuelle puis importer
const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
const target = path.join(ROOT, 'cms.sqlite');
if (fs.existsSync(target)) {
  const bak = path.join(ROOT, `cms.sqlite.bak-${stamp}`);
  fs.copyFileSync(target, bak);
  console.log('→ Ancienne base sauvegardée : ' + path.basename(bak));
}
// Retirer un éventuel WAL/SHM périmé (sinon incohérence avec la nouvelle base)
for (const ext of ['-wal', '-shm']) fs.rmSync(target + ext, { force: true });
fs.copyFileSync(db, target);
console.log('✓ Base importée : cms.sqlite');

if (uploads) {
  fs.cpSync(uploads, path.join(ROOT, 'uploads'), { recursive: true });
  console.log('✓ Médias importés : uploads/');
}
if (tmp) fs.rmSync(tmp, { recursive: true, force: true });

console.log('\n✓ Import terminé. Démarre le site : npm run start:local  →  http://localhost:3460');
console.log('  (assure-toi que le serveur était ARRÊTÉ pendant l\'import).');

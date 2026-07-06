/* Exporte TOUT le site en un seul fichier .zip, prêt pour un usage local hors-ligne.
   Enchaîne : build du front → packaging portable (serveur bundlé + front + base + uploads)
   → compression en export/tssr-site-<date>.zip.
   Le .zip est auto-suffisant : le dézipper et lancer "Lancer-le-site.bat" (Node.js 20+ requis).
   Pour réinjecter le contenu dans une instance locale : node scripts/import-site.mjs <zip>
   Usage : npm run export */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (cmd, opts = {}) => execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts });
const stamp = new Date().toISOString().slice(0, 10);
const PORTABLE = path.join(ROOT, 'portable');
const OUT_DIR = path.join(ROOT, 'export');
const ZIP = path.join(OUT_DIR, `tssr-site-${stamp}.zip`);

console.log('→ 1/3  Build du front (vite)…');
run('npm run build');
console.log('→ 2/3  Packaging portable (serveur + base + uploads)…');
run('node scripts/build-portable.mjs');

console.log('→ 3/3  Compression…');
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.rmSync(ZIP, { force: true });

let made = ZIP;
try {
  if (process.platform === 'win32') {
    run(`powershell -NoProfile -Command "Compress-Archive -Path '${PORTABLE}\\*' -DestinationPath '${ZIP}' -Force"`);
  } else {
    try { run(`zip -r -q "${ZIP}" .`, { cwd: PORTABLE }); }
    catch { made = ZIP.replace(/\.zip$/, '.tgz'); run(`tar -czf "${made}" -C "${PORTABLE}" .`); }
  }
} catch (e) {
  console.log('\n⚠  Compression impossible sur ce poste.');
  console.log(`   Le dossier "${PORTABLE}" est prêt : copie-le tel quel sur l'autre machine.`);
  process.exit(0);
}

const mo = (fs.statSync(made).size / (1024 * 1024)).toFixed(1);
console.log(`\n✓ Export terminé : ${made}  (${mo} Mo)`);
console.log('  • Usage direct  : dézipper puis lancer "Lancer-le-site.bat" (Node.js 20+).');
console.log('  • Réimporter le contenu dans un clone local : node scripts/import-site.mjs "' + made + '"');

/* Met à jour le CONTENU de ce site hors-ligne depuis le site en ligne.
   Télécharge l'archive publique de contenu (cours, pages, médias), sauvegarde
   la base locale, puis la remplace. Ne touche NI au programme, NI aux comptes.

   À lancer SITE ARRÊTÉ (fermer la fenêtre noire de « Lancer-le-site »).

   Usage :  node mettre-a-jour.mjs          (ou double-clic sur Mettre-a-jour.bat)
   Source : SITE_SOURCE=https://… node mettre-a-jour.mjs   pour viser un autre site.

   Codes de sortie : 0 = OK, 2 = configuration, 3 = réseau/HTTP, 4 = remplacement. */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = (process.env.SITE_SOURCE || '__SOURCE__').replace(/\/+$/, '');

const log = (m) => console.log(`  ${m}`);
const die = (code, m, hint) => { console.error(`\n  ✗ ${m}`); if (hint) console.error(`    ${hint}`); process.exit(code); };

if (!/^https?:\/\//i.test(SOURCE)) die(2, `Adresse du site source invalide : « ${SOURCE} »`, 'Relance avec : SITE_SOURCE=https://mon-site node mettre-a-jour.mjs');

// Extraction d'un .zip sans dépendance : PowerShell sous Windows, unzip ailleurs.
function unzip(zip, dest) {
  if (process.platform === 'win32') {
    execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -Path '${zip}' -DestinationPath '${dest}' -Force`], { stdio: 'pipe' });
  } else {
    execFileSync('unzip', ['-q', '-o', zip, '-d', dest], { stdio: 'pipe' });
  }
}

// Cherche un fichier ou un dossier dans l'arborescence extraite (la profondeur varie).
function find(base, name, isDir) {
  const stack = [base];
  while (stack.length) {
    const d = stack.shift();
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (isDir && e.name === name) return p; stack.push(p); }
      else if (!isDir && e.name === name) return p;
    }
  }
  return null;
}

async function main() {
  console.log(`\n  Mise à jour du contenu depuis ${SOURCE}\n`);

  // 1. Téléchargement de l'archive de contenu (publique : aucun mot de passe).
  log('Téléchargement…');
  let res;
  try {
    res = await fetch(`${SOURCE}/api/public/hors-ligne/contenu`);
  } catch (e) {
    die(3, `Site injoignable : ${SOURCE}`, `Vérifie ta connexion Internet. (${e && e.message ? e.message : e})`);
  }
  if (res.status === 404) die(3, 'Ce site ne propose pas de mise à jour hors-ligne.', 'Il tourne peut-être dans une version trop ancienne.');
  if (res.status === 503) die(3, 'Le site ne peut pas préparer l’archive pour l’instant.', 'Réessaie dans quelques minutes.');
  if (!res.ok) die(3, `Téléchargement refusé : HTTP ${res.status}.`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) die(3, 'Archive vide.');
  log(`Reçu : ${(buf.length / 1048576).toFixed(1)} Mo`);

  // 2. Extraction dans un dossier temporaire.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'maj-site-'));
  const zip = path.join(tmp, 'contenu.zip');
  fs.writeFileSync(zip, buf);
  try { unzip(zip, tmp); }
  catch (e) {
    fs.rmSync(tmp, { recursive: true, force: true });
    die(4, 'Extraction impossible.', process.platform === 'win32' ? String(e && e.message || e) : 'La commande « unzip » est-elle installée ?');
  }

  const src = find(tmp, 'cms.sqlite', false);
  const srcUploads = find(tmp, 'uploads', true);
  if (!src) { fs.rmSync(tmp, { recursive: true, force: true }); die(4, 'Archive inattendue : cms.sqlite introuvable.'); }

  // 3. Sauvegarde de la base locale, puis remplacement.
  const target = path.join(ROOT, 'cms.sqlite');
  try {
    if (fs.existsSync(target)) {
      const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
      const bak = path.join(ROOT, `cms.sqlite.bak-${stamp}`);
      fs.copyFileSync(target, bak);
      log(`Ancienne base sauvegardée : ${path.basename(bak)}`);
    }
    // Un WAL/SHM resté d'une exécution précédente contredirait la nouvelle base.
    for (const ext of ['-wal', '-shm']) fs.rmSync(target + ext, { force: true });
    fs.copyFileSync(src, target);
    log('Contenu remplacé : cms.sqlite');
    if (srcUploads) { fs.cpSync(srcUploads, path.join(ROOT, 'uploads'), { recursive: true }); log('Médias remplacés : uploads/'); }
  } catch (e) {
    die(4, 'Remplacement impossible.', `Le site tourne-t-il encore ? Ferme-le puis relance. (${e && e.message ? e.message : e})`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  console.log('\n  ✓ À jour. Relance « Lancer-le-site » pour voir le nouveau contenu.\n');
}

main().catch((e) => die(3, 'Échec inattendu.', String(e && e.stack || e)));

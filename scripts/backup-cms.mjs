#!/usr/bin/env node
// backup-cms.mjs — sauvegarde COHÉRENTE de cms.sqlite (tout le contenu du site).
//
// Fait un instantané via l'API backup de better-sqlite3 (sûr même si le CMS
// écrit en parallèle), le compresse en .gz horodaté, et garde les N plus récents.
//
//   node scripts/backup-cms.mjs
//
// Variables (optionnelles) :
//   DB_PATH      chemin de la base      (défaut : <racine>/cms.sqlite)
//   BACKUP_DIR   dossier des copies     (défaut : <racine>/backups)
//   BACKUP_KEEP  nombre de copies gardées (défaut : 14)
//
// Planification Windows (tous les jours à 02:00) :
//   schtasks /Create /SC DAILY /ST 02:00 /TN "TSSR-backup-cms" ^
//     /TR "node D:\APP\TSSR\miyukini-cms\scripts\backup-cms.mjs"
import Database from 'better-sqlite3';
import { createGzip } from 'node:zlib';
import { createReadStream, createWriteStream, mkdirSync, readdirSync, unlinkSync, statSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.env.DB_PATH || path.join(ROOT, 'cms.sqlite');
const DIR = process.env.BACKUP_DIR || path.join(ROOT, 'backups');
const KEEP = Number(process.env.BACKUP_KEEP || 14);

mkdirSync(DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
const snap = path.join(DIR, `cms-${stamp}.sqlite`);
const gz = `${snap}.gz`;

// 1) Instantané cohérent de la base.
const db = new Database(SRC, { readonly: true });
await db.backup(snap);
db.close();

// 2) Compression puis suppression de l'instantané brut.
await pipeline(createReadStream(snap), createGzip(), createWriteStream(gz));
unlinkSync(snap);

// 3) Rotation : on ne garde que les KEEP plus récents.
const copies = readdirSync(DIR)
  .filter((f) => /^cms-.*\.sqlite\.gz$/.test(f))
  .map((f) => ({ f, t: statSync(path.join(DIR, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t);
for (const { f } of copies.slice(KEEP)) unlinkSync(path.join(DIR, f));

console.log(`Sauvegarde OK : ${gz}  (${Math.min(copies.length, KEEP)} copie(s) conservée(s) dans ${DIR})`);

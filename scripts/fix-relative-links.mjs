/* Remplace les liens absolus vers tssr.miyukini.com par des liens relatifs à la racine,
   dans toutes les tables (pages, menus, réglages…). Usage : node scripts/fix-relative-links.mjs */
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new Database(path.join(ROOT, 'cms.sqlite'));
const RE = /https?:\/\/tssr\.miyukini\.com|\/\/tssr\.miyukini\.com/g;
const fix = (s) => s.replace(RE, '').replace(/(href|url|src)=""/g, '$1="/"'); // origine seule -> "/"
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
let changed = 0;
const tx = db.transaction(() => {
  for (const t of tables) {
    const cols = db.prepare(`PRAGMA table_info("${t}")`).all();
    if (!cols.some(c => c.name === 'id')) continue;
    const textCols = cols.filter(c => /TEXT|CLOB/i.test(c.type) || c.type === '').map(c => c.name).filter(c => c !== 'id');
    if (!textCols.length) continue;
    const rows = db.prepare(`SELECT id, ${textCols.map(c => `"${c}"`).join(', ')} FROM "${t}"`).all();
    for (const row of rows) {
      const upd = {};
      for (const c of textCols) {
        const v = row[c];
        if (typeof v === 'string' && /tssr\.miyukini\.com/.test(v)) { const nv = fix(v); if (nv !== v) upd[c] = nv; }
      }
      const keys = Object.keys(upd);
      if (keys.length) {
        db.prepare(`UPDATE "${t}" SET ${keys.map(k => `"${k}" = @${k}`).join(', ')} WHERE id = @id`).run({ ...upd, id: row.id });
        changed += keys.length;
        console.log(`  ${t}#${row.id}: ${keys.join(', ')}`);
      }
    }
  }
});
tx();
console.log(`\n✓ ${changed} champ(s) corrigé(s).`);
const left = db.prepare("SELECT count(*) c FROM menu_items WHERE url LIKE '%tssr.miyukini.com%'").get();
console.log('Liens absolus restants dans les menus :', left.c);
db.close();

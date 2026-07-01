/* Crée (ou met à jour) un compte admin du CMS dans la table `admins`.
   L'admin se connecte par son `username` (un e-mail convient) + mot de passe (hash bcrypt).
   Usage : USERNAME=... PASSWORD=... tsx scripts/create-admin.ts
   (ou)   tsx scripts/create-admin.ts <username> <password>
   Cible la base DB_PATH ou, par défaut, ./cms.sqlite à la racine du projet. */
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'cms.sqlite');

const username = process.env.USERNAME || process.argv[2];
const password = process.env.PASSWORD || process.argv[3];
if (!username || !password) {
  console.error('✗ Fournis un identifiant et un mot de passe : USERNAME=... PASSWORD=... tsx scripts/create-admin.ts');
  process.exit(1);
}

const db = new Database(DB_PATH);
db.prepare(`CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)`).run();

const hash = bcrypt.hashSync(password, 10);
const existing = db.prepare('SELECT id FROM admins WHERE username = ?').get(username) as { id: number } | undefined;
if (existing) {
  db.prepare('UPDATE admins SET password_hash = ? WHERE username = ?').run(hash, username);
  console.log(`✓ Admin « ${username} » mis à jour (mot de passe changé).`);
} else {
  db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run(username, hash);
  console.log(`✓ Admin « ${username} » créé.`);
}
const all = db.prepare('SELECT username FROM admins ORDER BY id').all() as Array<{ username: string }>;
console.log('Admins existants :', all.map(a => a.username).join(', '));
db.close();

import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(__dirname, '..');

// Chargement optionnel d'un fichier .env (sans dépendance) : .env.local d'abord, puis .env.
// Les variables DÉJÀ définies dans l'environnement (ex. via PM2/ecosystem) restent prioritaires.
// → en prod (aucun .env présent, ou variables fournies par PM2) le comportement est inchangé.
for (const file of ['.env.local', '.env']) {
  const p = path.join(ROOT_DIR, file);
  if (!fs.existsSync(p)) continue;
  for (const raw of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (key && !(key in process.env)) process.env[key] = val;
  }
}
export const DB_PATH = process.env.DB_PATH || path.join(ROOT_DIR, 'cms.sqlite');
export const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
export const CLOUD_DIR = process.env.CLOUD_DIR || path.join(ROOT_DIR, 'cloud'); // fichiers privés par profil (non servis statiquement)
export const PORT = Number(process.env.PORT || 3460);
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const IS_PROD = NODE_ENV === 'production';
// Servir le front buildé (dist) depuis Express. Par défaut = en prod. Mettre SERVE_STATIC=1
// pour servir le site en local sans NODE_ENV=production (utile pour un hébergement HTTP hors-ligne).
export const SERVE_STATIC = process.env.SERVE_STATIC ? process.env.SERVE_STATIC === '1' : IS_PROD;
// Cookie de session « Secure » (exige HTTPS). Par défaut = en prod. Mettre COOKIE_SECURE=0
// pour un accès en HTTP local (sinon la connexion admin échoue, le cookie n'étant pas posé).
export const COOKIE_SECURE = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === '1' : IS_PROD;
// SESSION_SECRET : fourni par l'environnement, sinon GÉNÉRÉ aléatoirement et persisté
// (jamais de constante prévisible — sinon forge de cookie de session possible).
const WEAK_SECRETS = new Set(['dev-session-secret', 'change-me-7f3a9c2e8b14d6f0', 'changeme', 'secret', 'change-me']);
export const SESSION_SECRET = (() => {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv) {
    if (WEAK_SECRETS.has(fromEnv) || fromEnv.length < 24) {
      console.warn('[webcms] ⚠️ SESSION_SECRET faible ou par défaut — remplace-le par une valeur aléatoire forte (≥ 32 caractères).');
    }
    return fromEnv;
  }
  const file = path.join(ROOT_DIR, '.session-secret');
  try {
    if (fs.existsSync(file)) { const s = fs.readFileSync(file, 'utf8').trim(); if (s.length >= 32) return s; }
    const s = crypto.randomBytes(48).toString('base64url');
    fs.writeFileSync(file, s, { mode: 0o600 });
    console.warn(`[webcms] SESSION_SECRET non défini : secret aléatoire généré et persisté dans ${file}.`);
    return s;
  } catch {
    return crypto.randomBytes(48).toString('base64url'); // dernier recours : fort mais éphémère (jamais la constante)
  }
})();
export const ADMIN_USER = process.env.CMS_ADMIN_USER || 'admin';
export const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD || 'changeme';
export const SMTP_HOST = process.env.SMTP_HOST || '';
export const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
export const SMTP_USER = process.env.SMTP_USER || '';
export const SMTP_PASS = process.env.SMTP_PASS || '';
export const SMTP_FROM = process.env.SMTP_FROM || '';
export const ORDER_NOTIFY_TO = process.env.ORDER_NOTIFY_TO || '';
export const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://example.com';
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
export const STRIPE_PUBLIC_KEY = process.env.STRIPE_PUBLIC_KEY || '';

// Fail-fast : quand le site est servi publiquement (prod OU SERVE_STATIC), on refuse de démarrer
// sans mot de passe admin, et on alerte sur un mot de passe par défaut. (Le SESSION_SECRET est
// désormais toujours fort : fourni, ou généré/persisté ci-dessus — plus de constante prévisible.)
if (IS_PROD || SERVE_STATIC) {
  if (IS_PROD && !process.env.CMS_ADMIN_PASSWORD) {
    throw new Error(`[webcms] CMS_ADMIN_PASSWORD manquant en production. Définis-le (ex. dans ecosystem.config.cjs) avant de démarrer.`);
  }
  if ((process.env.CMS_ADMIN_PASSWORD || '') === 'changeme') {
    console.warn('[webcms] ⚠️ CMS_ADMIN_PASSWORD = « changeme » (défaut) — à changer (sans effet si le compte admin existe déjà).');
  }
}

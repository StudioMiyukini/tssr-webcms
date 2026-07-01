import path from 'node:path';
import fs from 'node:fs';
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
export const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-session-secret';
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

// Fail-fast : en production, on refuse de démarrer avec des secrets par défaut.
if (IS_PROD) {
  const missing: string[] = [];
  if (!process.env.SESSION_SECRET) missing.push('SESSION_SECRET');
  if (!process.env.CMS_ADMIN_PASSWORD) missing.push('CMS_ADMIN_PASSWORD');
  if (missing.length) {
    throw new Error(
      `[webcms] Variables d'environnement requises manquantes en production : ${missing.join(', ')}. ` +
      `Définis-les (ex. dans ecosystem.config.cjs) avant de démarrer.`,
    );
  }
}

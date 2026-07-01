import { Router } from 'express';
import type { Request, RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { sql, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { settings } from '../db/schema';
import { requireAuth, isAuthed, isCustomerAuthed } from '../lib/auth';
import { parseBody } from '../lib/http';
import { rateLimit } from '../lib/rate-limit';
import { clearPublicCache, cacheStats } from '../lib/cache';
import { IS_PROD } from '../env';
import { FEATURES, DEFAULT_THEME, DEFAULT_SITE_SETTINGS, type FeatureFlags, type FeatureKey, type ThemeSettings, type ThemePalette, type SiteSettings, type SecurityStatus, type SiteAccessState } from '../../shared/types';

const router = Router();
const THEME_KEY = 'theme';
const SITE_KEY = 'site';
const GATE_HASH_KEY = 'site_gate_hash'; // hash bcrypt du mot de passe du site privé (jamais exposé)

// Cache mémoire : la table settings est minuscule et ne change que via l'admin.
let featureCache: FeatureFlags | null = null;
let themeCache: ThemeSettings | null = null;
let siteCache: SiteSettings | null = null;
function invalidateSettingsCache() { featureCache = null; themeCache = null; siteCache = null; }

function readSetting(key: string): string | null {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  return row ? row.value : null;
}
function writeSetting(key: string, value: string) {
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updated_at: sql`CURRENT_TIMESTAMP` } })
    .run();
  invalidateSettingsCache();
}

function mergePalette(base: ThemePalette, p: any): ThemePalette {
  if (!p || typeof p !== 'object') return { ...base };
  const out = { ...base };
  for (const k of Object.keys(base) as (keyof ThemePalette)[]) {
    if (typeof p[k] === 'string') out[k] = p[k];
  }
  return out;
}

export function readThemeSettings(): ThemeSettings {
  if (themeCache) return themeCache;
  const raw = readSetting(THEME_KEY);
  if (!raw) { themeCache = structuredClone(DEFAULT_THEME); return themeCache; }
  let parsed: any;
  try { parsed = JSON.parse(raw); } catch { return structuredClone(DEFAULT_THEME); }
  const d = DEFAULT_THEME;
  const t: ThemeSettings = {
    light: mergePalette(d.light, parsed.light),
    dark: mergePalette(d.dark, parsed.dark),
    success: parsed.success || d.success,
    warning: parsed.warning || d.warning,
    danger: parsed.danger || d.danger,
    purple: parsed.purple || d.purple,
    fontBody: parsed.fontBody || d.fontBody,
    fontHeading: typeof parsed.fontHeading === 'string' ? parsed.fontHeading : d.fontHeading,
    baseFontSize: Number.isFinite(parsed.baseFontSize) ? parsed.baseFontSize : d.baseFontSize,
    headingWeight: Number.isFinite(parsed.headingWeight) ? parsed.headingWeight : d.headingWeight,
    radius: Number.isFinite(parsed.radius) ? Math.min(28, Math.max(0, parsed.radius)) : d.radius,
    brandName: typeof parsed.brandName === 'string' ? parsed.brandName : d.brandName,
    logoUrl: typeof parsed.logoUrl === 'string' ? parsed.logoUrl : d.logoUrl,
    faviconUrl: typeof parsed.faviconUrl === 'string' ? parsed.faviconUrl : d.faviconUrl,
    customCss: typeof parsed.customCss === 'string' ? parsed.customCss : d.customCss,
  };
  // Rétro-compatibilité : ancien format plat { accent, accentHover, font, radius }.
  if (typeof parsed.accent === 'string' && !parsed.light) { t.light.accent = parsed.accent; t.dark.accent = parsed.accent; }
  if (typeof parsed.accentHover === 'string' && !parsed.light) { t.light.accentHover = parsed.accentHover; t.dark.accentHover = parsed.accentHover; }
  if (typeof parsed.font === 'string' && !parsed.fontBody) t.fontBody = parsed.font;
  themeCache = t;
  return t;
}

/** Lit les réglages performance/sécurité (valeurs stockées fusionnées avec les défauts). */
export function readSiteSettings(): SiteSettings {
  if (siteCache) return siteCache;
  const raw = readSetting(SITE_KEY);
  const d = DEFAULT_SITE_SETTINGS;
  if (!raw) { siteCache = { ...d }; return siteCache; }
  let p: any;
  try { p = JSON.parse(raw); } catch { return { ...d }; }
  siteCache = {
    cacheEnabled: typeof p.cacheEnabled === 'boolean' ? p.cacheEnabled : d.cacheEnabled,
    cacheTtl: Number.isFinite(p.cacheTtl) ? Math.min(3600, Math.max(5, p.cacheTtl)) : d.cacheTtl,
    cspEnabled: typeof p.cspEnabled === 'boolean' ? p.cspEnabled : d.cspEnabled,
    hstsEnabled: typeof p.hstsEnabled === 'boolean' ? p.hstsEnabled : d.hstsEnabled,
    frameDeny: typeof p.frameDeny === 'boolean' ? p.frameDeny : d.frameDeny,
    sitePrivate: typeof p.sitePrivate === 'boolean' ? p.sitePrivate : d.sitePrivate,
    membersOnly: typeof p.membersOnly === 'boolean' ? p.membersOnly : d.membersOnly,
  };
  return siteCache;
}

// ===== Confidentialité : verrou « site privé » (mot de passe unique partagé) =====
export function hasGatePassword(): boolean { return !!readSetting(GATE_HASH_KEY); }
function setGatePassword(plain: string) { writeSetting(GATE_HASH_KEY, bcrypt.hashSync(plain, 10)); }
function verifyGatePassword(plain: string): boolean {
  const hash = readSetting(GATE_HASH_KEY);
  return !!hash && bcrypt.compareSync(plain, hash);
}
/** Le site est-il en mode privé ET un mot de passe est-il défini ? */
export function isSitePrivate(): boolean { return readSiteSettings().sitePrivate && hasGatePassword(); }
/** Le porteur de la requête a-t-il accès (admin connecté ou visiteur ayant saisi le mot de passe) ? */
export function isSiteUnlocked(req: Request): boolean { return isAuthed(req) || req.session?.siteUnlocked === true; }

// ===== Espace membres : seul l'accueil est public, le reste exige un compte connecté =====
export function isMembersOnly(): boolean { return readSiteSettings().membersOnly; }
/** Accès « membre » : admin connecté OU client connecté (compte). */
export function hasMemberAccess(req: Request): boolean { return isAuthed(req) || isCustomerAuthed(req); }
// Routes /api/public visibles de tous même en mode membres : strict nécessaire pour afficher l'accueil + l'habillage.
const MEMBERS_PUBLIC_PATHS = new Set(['/theme', '/features', '/menus', '/pages/accueil', '/events', '/plannings']);

/** Middleware monté sur /api/public : applique les deux verrous (mot de passe partagé puis espace membres). */
export const siteGate: RequestHandler = (req, res, next) => {
  // 1) Verrou « site privé » (mot de passe unique partagé) : tout est bloqué sauf thème, features et forum.
  if (isSitePrivate() && !isSiteUnlocked(req)) {
    if (req.path === '/theme' || req.path === '/features' || req.path === '/forum' || req.path.startsWith('/forum/')) { next(); return; }
    res.status(403).json({ error: 'site_locked' });
    return;
  }
  // 2) Espace membres : seul l'accueil (et le strict nécessaire à son affichage) reste public.
  if (isMembersOnly() && !hasMemberAccess(req) && !MEMBERS_PUBLIC_PATHS.has(req.path)) {
    res.status(403).json({ error: 'members_only' });
    return;
  }
  next();
};

/** Config consommée par le middleware de cache (relue à chaud). */
export const getCacheConfig = () => { const s = readSiteSettings(); return { enabled: s.cacheEnabled, ttlMs: s.cacheTtl * 1000 }; };
/** Config consommée par le middleware d'en-têtes de sécurité (relue à chaud). */
export const getSecurityConfig = () => { const s = readSiteSettings(); return { cspEnabled: s.cspEnabled, hstsEnabled: s.hstsEnabled, frameDeny: s.frameDeny, isProd: IS_PROD }; };

const FEATURE_KEYS = FEATURES.map(f => f.key);
const featureSettingKey = (k: FeatureKey) => `feature.${k}`;

/** Lit l'état effectif des fonctionnalités (valeur stockée ou défaut du catalogue). */
export function readFeatureFlags(): FeatureFlags {
  if (featureCache) return featureCache;
  const rows = db.select().from(settings).all();
  const stored = new Map(rows.map(r => [r.key, r.value]));
  const flags = {} as FeatureFlags;
  for (const f of FEATURES) {
    const v = stored.get(featureSettingKey(f.key));
    flags[f.key] = v == null ? f.default : v === '1';
  }
  featureCache = flags;
  return flags;
}

/** Middleware : bloque (404) l'accès si le module n'est pas activé. */
export function requireFeature(key: FeatureKey): RequestHandler {
  return (_req, res, next) => {
    if (readFeatureFlags()[key]) { next(); return; }
    res.status(404).json({ error: 'Module désactivé' });
  };
}

function setFeatureFlag(key: FeatureKey, enabled: boolean) {
  db.insert(settings)
    .values({ key: featureSettingKey(key), value: enabled ? '1' : '0' })
    .onConflictDoUpdate({ target: settings.key, set: { value: enabled ? '1' : '0', updated_at: sql`CURRENT_TIMESTAMP` } })
    .run();
  invalidateSettingsCache();
}

function featureList() {
  const flags = readFeatureFlags();
  return FEATURES.map(f => ({ ...f, enabled: flags[f.key] }));
}

// ===== Admin =====
router.get('/api/admin/features', requireAuth, (_req, res) => {
  res.json(featureList());
});

const updateSchema = z.object({
  flags: z.record(z.string(), z.boolean()),
});

router.put('/api/admin/features', requireAuth, (req, res) => {
  const data = parseBody(updateSchema, req.body);
  for (const [key, enabled] of Object.entries(data.flags)) {
    if (FEATURE_KEYS.includes(key as FeatureKey)) setFeatureFlag(key as FeatureKey, enabled);
  }
  res.json(featureList());
});

// ===== Thème (admin) =====
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const paletteSchema = z.object({
  bg: hex, surface: hex, surface2: hex, surface3: hex,
  border: hex, borderStrong: hex,
  text: hex, textSoft: hex, textMuted: hex,
  accent: hex, accentHover: hex,
});
const themeSchema = z.object({
  light: paletteSchema,
  dark: paletteSchema,
  success: hex, warning: hex, danger: hex, purple: hex,
  fontBody: z.string().min(1).max(200),
  fontHeading: z.string().max(200),
  baseFontSize: z.coerce.number().min(10).max(22),
  headingWeight: z.coerce.number().min(100).max(900),
  radius: z.coerce.number().min(0).max(28),
  brandName: z.string().max(120),
  logoUrl: z.string().max(500),
  faviconUrl: z.string().max(500),
  customCss: z.string().max(20000),
});

router.get('/api/admin/theme', requireAuth, (_req, res) => {
  res.json(readThemeSettings());
});

router.put('/api/admin/theme', requireAuth, (req, res) => {
  const data = parseBody(themeSchema, req.body);
  writeSetting(THEME_KEY, JSON.stringify(data));
  res.json(readThemeSettings());
});

// ===== Performance & sécurité (admin) =====
const siteSchema = z.object({
  cacheEnabled: z.boolean(),
  cacheTtl: z.coerce.number().min(5).max(3600),
  cspEnabled: z.boolean(),
  hstsEnabled: z.boolean(),
  frameDeny: z.boolean(),
  sitePrivate: z.boolean(),
  membersOnly: z.boolean(),
  sitePassword: z.string().max(200).optional(), // nouveau mot de passe (clair), facultatif
});

router.get('/api/admin/site', requireAuth, (_req, res) => {
  res.json({ ...readSiteSettings(), hasGatePassword: hasGatePassword() });
});

router.put('/api/admin/site', requireAuth, (req, res) => {
  const { sitePassword, ...site } = parseBody(siteSchema, req.body);
  const newPassword = (sitePassword || '').trim();
  if (newPassword) setGatePassword(newPassword);
  // Refuse d'activer le mode privé sans qu'un mot de passe existe (sinon site inaccessible).
  if (site.sitePrivate && !hasGatePassword()) {
    res.status(400).json({ error: 'Définis un mot de passe avant d’activer le mode privé.' });
    return;
  }
  writeSetting(SITE_KEY, JSON.stringify(site)); // invalide aussi le cache settings
  clearPublicCache(); // le TTL/activation a pu changer → on repart propre
  res.json({ ...readSiteSettings(), hasGatePassword: hasGatePassword() });
});

// ===== Accès au site privé (public) =====
const gateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Trop de tentatives. Réessaie dans quelques minutes.' });
const gateState = (req: Request): SiteAccessState => ({ private: isSitePrivate(), unlocked: isSiteUnlocked(req), membersOnly: isMembersOnly(), isMember: hasMemberAccess(req) });

router.get('/api/site-access', (req, res) => { res.json(gateState(req)); });

router.post('/api/site-access', gateLimiter, (req, res) => {
  if (!isSitePrivate()) { res.json(gateState(req)); return; } // rien à déverrouiller
  const password = String(req.body?.password ?? '');
  if (!verifyGatePassword(password)) {
    res.status(403).json({ error: 'Mot de passe incorrect' });
    return;
  }
  req.session.siteUnlocked = true;
  req.session.save(() => res.json(gateState(req)));
});

router.post('/api/site-access/logout', (req, res) => {
  req.session.siteUnlocked = false;
  req.session.save(() => res.json(gateState(req)));
});

router.get('/api/admin/cache', requireAuth, (_req, res) => {
  res.json(cacheStats(getCacheConfig()));
});

router.post('/api/admin/cache/clear', requireAuth, (_req, res) => {
  clearPublicCache();
  res.json(cacheStats(getCacheConfig()));
});

router.get('/api/admin/security', requireAuth, (req, res) => {
  const s = readSiteSettings();
  const status: SecurityStatus = {
    csp: s.cspEnabled,
    hsts: s.hstsEnabled && IS_PROD,
    frameDeny: s.frameDeny,
    https: req.secure || String(req.headers['x-forwarded-proto'] || '').includes('https'),
    rateLimit: true,
    sessionStore: 'SQLite (persistant)',
  };
  res.json(status);
});

// ===== Public =====
router.get('/api/public/features', (_req, res) => {
  res.json(readFeatureFlags());
});

router.get('/api/public/theme', (_req, res) => {
  res.json(readThemeSettings());
});

export default router;

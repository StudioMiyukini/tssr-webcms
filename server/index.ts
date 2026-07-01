import express from 'express';
import session from 'express-session';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PORT, SESSION_SECRET, IS_PROD, SERVE_STATIC, COOKIE_SECURE, ADMIN_USER, UPLOADS_DIR } from './env';
import './db/client';
import authRouter from './routes/auth';
import dashboardRouter from './routes/dashboard';
import pagesRouter from './routes/pages';
import menusRouter from './routes/menus';
import productsRouter from './routes/products';
import ordersRouter from './routes/orders';
import couponsRouter from './routes/coupons';
import shippingRouter from './routes/shipping';
import quoteFormsRouter from './routes/quote-forms';
import publicRouter from './routes/public';
import cartRouter from './routes/cart';
import customerRouter from './routes/customer';
import stripeRouter from './routes/stripe';
import settingsRouter from './routes/settings';
import mediaRouter from './routes/media';
import formsRouter from './routes/forms';
import eventsRouter from './routes/events';
import emailRouter from './routes/email';
import newsletterRouter from './routes/newsletter';
import postsRouter from './routes/posts';
import commentsRouter from './routes/comments';
import searchRouter from './routes/search';
import notesRouter from './routes/notes';
import planningsRouter from './routes/plannings';
import forumRouter from './routes/forum';
import { SqliteSessionStore } from './lib/session-store';
import { errorHandler } from './lib/http';
import { resolveMeta, metaTags } from './lib/seo';
import { securityHeaders } from './lib/security';
import { publicCache, cacheBustOnWrite } from './lib/cache';
import { getCacheConfig, getSecurityConfig, siteGate, isSitePrivate, isSiteUnlocked, isMembersOnly, hasMemberAccess, readThemeSettings, readFeatureFlags } from './routes/settings';
import { db } from './db/client';
import { menu_items, pages } from './db/schema';
import { eq, and, asc } from 'drizzle-orm';

// Données de page exposées au public (sans builder_json) — doit refléter PAGE_PUBLIC_COLS de routes/public.ts.
const PAGE_BOOT_COLS = { id: pages.id, title: pages.title, slug: pages.slug, content: pages.content, excerpt: pages.excerpt, published: pages.published, updated_at: pages.updated_at };
const RESERVED_SLUGS = new Set(['shop', 'cart', 'checkout', 'account', 'devis', 'blog', 'agenda', 'forum', 'recherche', 'admin', 'products', 'f', 'planning', 'uploads', 'assets', 'api']);
/** Slug de page CMS correspondant à un chemin (/, /pages/x, /x), ou null si route réservée. */
function pageSlugForPath(p: string): string | null {
  if (p === '/') return 'accueil';
  let m = p.match(/^\/pages\/([^/]+)$/);
  if (m) return decodeURIComponent(m[1]);
  m = p.match(/^\/([^/]+)\/?$/);
  if (m && !RESERVED_SLUGS.has(m[1])) return decodeURIComponent(m[1]);
  return null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const CLIENT_DIR = path.resolve(ROOT_DIR, 'client');
const DIST_DIR = path.resolve(ROOT_DIR, 'dist/client');

async function createServer() {
  const app = express();
  app.set('trust proxy', 1); // derrière le tunnel Cloudflare : nécessaire pour cookie Secure + req.ip

  // En-têtes de sécurité (CSP/HSTS configurables depuis l'admin, relus à chaud).
  app.use(securityHeaders(getSecurityConfig));

  app.use('/api/admin/media', express.json({ limit: '16mb' })); // uploads base64 (avant le parser global 4mb)
  app.use('/api/customer/cloud', express.json({ limit: '32mb' })); // fichiers cloud base64 (≈ 24 Mo de fichier)
  app.use(express.json({ limit: '4mb' }));
  app.use(express.urlencoded({ extended: true, limit: '4mb' }));

  const sessionStore = new SqliteSessionStore();
  setInterval(() => sessionStore.prune(), 60 * 60 * 1000).unref(); // purge horaire des sessions expirées
  app.use(session({
    store: sessionStore,
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: COOKIE_SECURE, maxAge: 1000 * 60 * 60 * 8 },
  }));

  // Cache : vide le cache public après toute écriture admin réussie ; sert les GET publics depuis la RAM.
  app.use('/api', cacheBustOnWrite());
  // Confidentialité : si le site est privé, bloque le contenu public avant le cache (réponses verrouillées non mises en cache).
  app.use('/api/public', siteGate);
  app.use('/api/public', publicCache(getCacheConfig));

  // ===== API routes =====
  app.use(authRouter);
  app.use(settingsRouter);
  app.use(dashboardRouter);
  app.use(pagesRouter);
  app.use(menusRouter);
  app.use(productsRouter);
  app.use(ordersRouter);
  app.use(couponsRouter);
  app.use(shippingRouter);
  app.use(quoteFormsRouter);
  app.use(publicRouter);
  app.use(cartRouter);
  app.use(customerRouter);
  app.use(stripeRouter);
  app.use(mediaRouter);
  app.use(formsRouter);
  app.use(eventsRouter);
  app.use(emailRouter);
  app.use(newsletterRouter);
  app.use(postsRouter);
  app.use(commentsRouter);
  app.use(searchRouter);
  app.use(notesRouter);
  app.use(planningsRouter);
  app.use(forumRouter);

  // Fichiers uploadés (servis en dev et prod).
  app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d', fallthrough: true }));

  // 404 JSON pour les routes API inconnues (avant le fallback SPA qui renvoie du HTML).
  app.use('/api', (_req, res) => { res.status(404).json({ error: 'Endpoint introuvable' }); });

  // ===== Static / SPA =====
  // Servi en prod, ou en local dès que SERVE_STATIC=1 (hébergement HTTP hors-ligne).
  // En dev pur (SERVE_STATIC non activé), Vite tourne sur 5173 et proxy les /api/* vers Express.
  if (SERVE_STATIC) {
    if (!fs.existsSync(DIST_DIR)) {
      console.warn(`[webcms] dist/client manquant — lance "npm run build" pour générer le front.`);
    } else {
      // Assets hashés (immutables) : cache long. index:false → '/' passe au fallback (injection OG).
      app.use(express.static(DIST_DIR, { index: false, maxAge: '30d', immutable: true }));
      // Fallback SPA : on injecte les balises OG/SEO selon la route (pour les crawlers sociaux).
      // Lu à chaque requête (fichier minuscule) : après un rebuild front, le nouvel index.html
      // — qui référence les nouveaux chunks hashés — est servi sans redémarrer le serveur.
      const indexHtml = () => fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf8');
      app.use((req, res) => {
        // Le forum reste public même en mode (mot de passe) privé → ni verrou ni noindex pour ses pages.
        const onForum = req.path === '/forum' || req.path.startsWith('/forum/');
        const slug = pageSlugForPath(req.path);
        // Verrou mot de passe partagé : tout est verrouillé sauf le forum.
        const passwordLocked = isSitePrivate() && !isSiteUnlocked(req) && !onForum;
        // Espace membres : tout est verrouillé sauf l'accueil (le visiteur non connecté ne voit que la home).
        const membersLocked = isMembersOnly() && !hasMemberAccess(req) && slug !== 'accueil';
        // Verrouillé = on ne divulgue aucun extrait de contenu (OG/SEO) et on interdit l'indexation.
        const locked = passwordLocked || membersLocked;
        const meta = resolveMeta(req.path, locked);
        const robots = locked ? '\n    <meta name="robots" content="noindex,nofollow"/>' : '';
        // Données initiales injectées dans le HTML → le 1er rendu ne fait aucun aller-retour API
        // (thème/features/accès toujours ; menus + contenu de page seulement si non verrouillé).
        const boot: Record<string, unknown> = {
          theme: readThemeSettings(),
          features: readFeatureFlags(),
          site: { private: isSitePrivate(), unlocked: isSiteUnlocked(req), membersOnly: isMembersOnly(), isMember: hasMemberAccess(req) },
        };
        if (!locked) {
          boot.menus = db.select().from(menu_items).orderBy(asc(menu_items.sort_order), asc(menu_items.id)).all();
          if (slug) {
            const pg = db.select(PAGE_BOOT_COLS).from(pages).where(and(eq(pages.slug, slug), eq(pages.published, 1))).get();
            if (pg) boot.page = { slug, data: pg };
          }
        }
        const bootJson = JSON.stringify(boot).replace(/</g, '\\u003c');
        const bootTag = `\n    <script type="application/json" id="__boot">${bootJson}</script>`;
        const html = indexHtml().replace(/<title>.*?<\/title>/i, '').replace('</head>', `    ${metaTags(meta)}${robots}${bootTag}\n  </head>`);
        res.setHeader('Cache-Control', 'no-cache'); // l'HTML doit toujours être revalidé (déploiements)
        res.type('html').send(html);
      });
    }
  } else {
    app.get('/', (_req, res) => {
      res.type('html').send(`<!doctype html><meta charset="utf-8"><title>CMS dev</title><body style="font-family:system-ui;padding:40px;max-width:560px;margin:0 auto"><h1>CMS — dev mode</h1><p>L'API tourne ici (port ${PORT}). Le front Vite est sur <a href="http://localhost:5173">http://localhost:5173</a>.</p><p>Lance <code>npm run dev</code> pour démarrer les deux ensemble, ou <code>npm run build</code> + <code>npm start</code> pour servir tout depuis Express.</p></body>`);
    });
  }

  // Middleware d'erreur terminal (réponses JSON homogènes).
  app.use(errorHandler);

  app.listen(PORT, () => {
    console.log(`[webcms] listening on http://localhost:${PORT}`);
    console.log(`[webcms] mode: ${IS_PROD ? 'production' : 'development'}`);
    console.log(`[webcms] admin user: ${ADMIN_USER}`);
  });
}

createServer().catch((err) => {
  console.error('[webcms] fatal:', err);
  process.exit(1);
});

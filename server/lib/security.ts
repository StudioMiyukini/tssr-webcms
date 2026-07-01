import type { Request, Response, NextFunction, RequestHandler } from 'express';

// En-têtes de sécurité HTTP. Centralisés ici ; CSP et HSTS sont configurables
// depuis l'admin (page Performance & sécurité) car ils peuvent, mal réglés, casser le site.

export interface SecurityConfig {
  cspEnabled: boolean;
  hstsEnabled: boolean;
  frameDeny: boolean;
  isProd: boolean;
}

/**
 * Content-Security-Policy adaptée au site :
 * - scripts servis localement (bundle Vite, aucun inline) → 'self'
 * - styles inline + variables de thème + Google Fonts → 'unsafe-inline' + fonts.googleapis
 * - images : locales, data: (base64), et toute source https (galeries, logos externes)
 * - iframes : YouTube nocookie (bloc vidéo) uniquement
 * Le paiement Stripe se fait par redirection complète (pas de Stripe.js), rien à autoriser ici.
 */
export function buildCsp(frameDeny: boolean): string {
  return [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors ${frameDeny ? `'none'` : `'self'`}`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data: https://fonts.gstatic.com`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `script-src 'self'`,
    `connect-src 'self'`,
    `frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com`,
    `media-src 'self' https: data:`,
    `form-action 'self'`,
  ].join('; ');
}

/** Middleware d'en-têtes de sécurité. `getConfig` est relu à chaque requête (bascule à chaud). */
export function securityHeaders(getConfig: () => SecurityConfig): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const cfg = getConfig();
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', cfg.frameDeny ? 'DENY' : 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), interest-cohort=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    if (cfg.cspEnabled) res.setHeader('Content-Security-Policy', buildCsp(cfg.frameDeny));
    // HSTS : uniquement en prod (HTTPS via le tunnel Cloudflare) pour ne pas piéger le dev en http.
    if (cfg.hstsEnabled && cfg.isProd) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    next();
  };
}

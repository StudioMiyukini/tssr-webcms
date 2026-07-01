import { useEffect, useState } from 'react';
import type { ThemeSettings, ThemePalette } from '@shared/types';

export type Theme = 'light' | 'dark';

/** Convertit un hex #rrggbb en rgba() avec l'alpha donné. */
export function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function paletteVars(p: ThemePalette, accentLightAlpha: number): string {
  return [
    `--bg:${p.bg}`, `--surface:${p.surface}`, `--surface-2:${p.surface2}`, `--surface-3:${p.surface3}`,
    `--border:${p.border}`, `--border-strong:${p.borderStrong}`,
    `--text:${p.text}`, `--text-soft:${p.textSoft}`, `--text-muted:${p.textMuted}`,
    `--accent:${p.accent}`, `--accent-hover:${p.accentHover}`, `--accent-light:${hexToRgba(p.accent, accentLightAlpha)}`,
  ].join(';');
}

/** Construit la feuille de style du thème personnalisé (clair + sombre + typo + CSS perso). */
export function buildThemeCss(t: ThemeSettings): string {
  const semantic = (a: number) => [
    `--success:${t.success}`, `--success-light:${hexToRgba(t.success, a)}`,
    `--warning:${t.warning}`, `--warning-light:${hexToRgba(t.warning, a)}`,
    `--danger:${t.danger}`, `--danger-light:${hexToRgba(t.danger, a)}`,
    `--purple:${t.purple}`, `--purple-light:${hexToRgba(t.purple, a)}`,
  ].join(';');
  const shared = `--radius:${t.radius}px;--radius-lg:${t.radius + 4}px;--font:${t.fontBody};--font-heading:${t.fontHeading || t.fontBody}`;
  return [
    `:root{${paletteVars(t.light, 0.12)};${semantic(0.10)};${shared}}`,
    `:root[data-theme="dark"]{${paletteVars(t.dark, 0.16)};${semantic(0.16)}}`,
    `body{font-size:${t.baseFontSize}px}`,
    `h1,h2,h3,h4,h5,h6,.hero h1{font-family:var(--font-heading);font-weight:${t.headingWeight}}`,
    t.customCss || '',
  ].join('\n');
}

/** Applique le thème personnalisé via une feuille <style> injectée + favicon. */
export function applyThemeSettings(t: ThemeSettings) {
  let el = document.getElementById('mk-theme') as HTMLStyleElement | null;
  if (!el) { el = document.createElement('style'); el.id = 'mk-theme'; document.head.appendChild(el); }
  el.textContent = buildThemeCss(t);
  if (t.faviconUrl) {
    let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.href = t.faviconUrl;
  }
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem('cms-theme') as Theme | null;
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('cms-theme', theme); } catch {}
  }, [theme]);

  return {
    theme,
    setTheme: setThemeState,
    toggleTheme: () => setThemeState(t => t === 'dark' ? 'light' : 'dark'),
  };
}

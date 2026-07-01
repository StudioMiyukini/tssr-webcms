import { useEffect, useState } from 'react';
import { useSiteSettings, useUpdateSiteSettings, useCacheStats, useClearCache, useSecurityStatus } from '@/api/hooks';
import { useToast } from '@/lib/toast';
import type { AdminSiteSettings } from '@shared/types';

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / 1024 / 1024).toFixed(1)} Mo`;
}

function Toggle({ on, onChange, title }: { on: boolean; onChange: () => void; title?: string }) {
  return (
    <label className="switch" title={title}>
      <input type="checkbox" checked={on} onChange={onChange} />
      <span className="switch-slider" aria-hidden />
    </label>
  );
}

export function PerformancePage() {
  const settings = useSiteSettings();
  const update = useUpdateSiteSettings();
  const cache = useCacheStats();
  const clear = useClearCache();
  const security = useSecurityStatus();
  const { push } = useToast();
  const [form, setForm] = useState<AdminSiteSettings | null>(null);
  const [password, setPassword] = useState(''); // nouveau mot de passe du site privé (non persisté tant que pas enregistré)

  useEffect(() => { if (settings.data) setForm(settings.data); }, [settings.data]);

  if (!form) return <div className="loading">Chargement…</div>;

  const patch = (p: Partial<AdminSiteSettings>) => setForm(f => f ? { ...f, ...p } : f);
  const dirty = (!!settings.data && JSON.stringify(form) !== JSON.stringify(settings.data)) || password.length > 0;
  // Mode privé impossible sans mot de passe (existant ou en cours de saisie).
  const privateNeedsPassword = form.sitePrivate && !form.hasGatePassword && password.trim().length === 0;

  const onSave = () => {
    if (privateNeedsPassword) { push('Définis un mot de passe avant d’activer le mode privé.', 'error'); return; }
    update.mutate({ ...form, sitePassword: password.trim() || undefined }, {
      onSuccess: () => { push('Réglages enregistrés.', 'success'); setPassword(''); },
      onError: (e) => push(e instanceof Error ? e.message : 'Échec de l’enregistrement.', 'error'),
    });
  };
  const onClear = () => clear.mutate(undefined, {
    onSuccess: () => push('Cache vidé.', 'success'),
    onError: () => push('Échec.', 'error'),
  });

  const c = cache.data;
  const s = security.data;

  return (
    <>
      <div className="topbar-row">
        <div><h1>Performance &amp; sécurité</h1><p>Cache des pages publiques et en-têtes de protection du site.</p></div>
        <button className="btn" onClick={onSave} disabled={!dirty || update.isPending}>
          {update.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>

      {/* ===== Performance / cache ===== */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>⚡ Cache</h2>
        <ul className="feature-list">
          <li className="feature-row">
            <span className="feature-icon" aria-hidden>🚀</span>
            <div className="feature-text">
              <div className="feature-name">Cache des réponses publiques
                <span className={`status-badge ${form.cacheEnabled ? 'active' : 'inactif'}`}>{form.cacheEnabled ? 'Activé' : 'Désactivé'}</span>
              </div>
              <p className="meta">Sert les pages, articles et menus depuis la mémoire (+ ETag / 304). Vidé automatiquement à chaque modification dans l’admin.</p>
            </div>
            <Toggle on={form.cacheEnabled} onChange={() => patch({ cacheEnabled: !form.cacheEnabled })} />
          </li>
          <li className="feature-row">
            <span className="feature-icon" aria-hidden>⏱️</span>
            <div className="feature-text">
              <div className="feature-name">Durée de vie : {form.cacheTtl}s</div>
              <p className="meta">Temps avant rafraîchissement d’une entrée (5s – 1h). Une valeur basse = contenu plus frais, une valeur haute = plus rapide.</p>
              <input type="range" min={5} max={600} step={5} value={form.cacheTtl} onChange={e => patch({ cacheTtl: Number(e.target.value) })} style={{ maxWidth: 360 }} disabled={!form.cacheEnabled} />
            </div>
          </li>
        </ul>

        <div className="stat-grid" style={{ marginTop: 12 }}>
          <div className="stat-card"><span className="stat-value">{c ? c.entries : '—'}</span><span className="stat-label">Entrées en cache</span></div>
          <div className="stat-card"><span className="stat-value">{c ? `${c.hitRate}%` : '—'}</span><span className="stat-label">Taux de hit</span></div>
          <div className="stat-card"><span className="stat-value">{c ? c.hits : '—'}</span><span className="stat-label">Hits</span></div>
          <div className="stat-card"><span className="stat-value">{c ? c.misses : '—'}</span><span className="stat-label">Misses</span></div>
          <div className="stat-card"><span className="stat-value">{c ? fmtBytes(c.approxBytes) : '—'}</span><span className="stat-label">Taille mémoire</span></div>
        </div>
        <div className="actions" style={{ marginTop: 12 }}>
          <button className="btn secondary" onClick={onClear} disabled={clear.isPending}>{clear.isPending ? 'Vidage…' : '🗑️ Vider le cache'}</button>
          <button className="btn secondary" onClick={() => cache.refetch()}>↻ Rafraîchir les stats</button>
        </div>
      </div>

      {/* ===== Confidentialité (site privé) ===== */}
      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>🔒 Confidentialité</h2>
        <ul className="feature-list">
          <li className="feature-row">
            <span className="feature-icon" aria-hidden>👤</span>
            <div className="feature-text">
              <div className="feature-name">Espace membres (compte obligatoire)
                <span className={`status-badge ${form.membersOnly ? 'active' : 'inactif'}`}>{form.membersOnly ? 'Membres' : 'Ouvert'}</span>
              </div>
              <p className="meta">Quand c’est activé, seule la page d’accueil reste publique : tout le reste exige de créer un compte et de se connecter. Indépendant du mot de passe ci-dessous (qui, lui, est un mot de passe unique partagé).</p>
            </div>
            <Toggle on={form.membersOnly} onChange={() => patch({ membersOnly: !form.membersOnly })} title="Activer / désactiver l’espace membres" />
          </li>
          <li className="feature-row">
            <span className="feature-icon" aria-hidden>🔐</span>
            <div className="feature-text">
              <div className="feature-name">Site privé (mot de passe d’accès)
                <span className={`status-badge ${form.sitePrivate ? 'active' : 'inactif'}`}>{form.sitePrivate ? 'Privé' : 'Public'}</span>
              </div>
              <p className="meta">Quand c’est activé, les visiteurs doivent saisir un mot de passe unique pour voir le site. L’admin connecté garde l’accès, et le contenu n’est ni indexé ni divulgué dans les aperçus de lien.</p>
            </div>
            <Toggle on={form.sitePrivate} onChange={() => patch({ sitePrivate: !form.sitePrivate })} title="Activer / désactiver le mode privé" />
          </li>
          <li className="feature-row">
            <span className="feature-icon" aria-hidden>🔑</span>
            <div className="feature-text">
              <div className="feature-name">Mot de passe du site
                <span className={`status-badge ${form.hasGatePassword ? 'active' : 'inactif'}`}>{form.hasGatePassword ? 'Défini' : 'Aucun'}</span>
              </div>
              <p className="meta">{form.hasGatePassword ? 'Laisse vide pour conserver le mot de passe actuel, ou saisis-en un nouveau pour le remplacer.' : 'Définis un mot de passe pour pouvoir activer le mode privé.'}</p>
              <input
                type="password"
                autoComplete="new-password"
                placeholder={form.hasGatePassword ? '•••••••• (inchangé)' : 'Nouveau mot de passe'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ maxWidth: 360 }}
              />
            </div>
          </li>
        </ul>
        {privateNeedsPassword && <p className="form-error">⚠ Définis d’abord un mot de passe pour activer le mode privé.</p>}
      </div>

      {/* ===== Sécurité ===== */}
      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>🛡️ Sécurité</h2>
        <ul className="feature-list">
          <li className="feature-row">
            <span className="feature-icon" aria-hidden>📜</span>
            <div className="feature-text">
              <div className="feature-name">Content-Security-Policy (CSP)
                <span className={`status-badge ${form.cspEnabled ? 'active' : 'inactif'}`}>{form.cspEnabled ? 'Activé' : 'Désactivé'}</span>
              </div>
              <p className="meta">Restreint l’origine des scripts, styles et images chargés → protège contre l’injection de code (XSS). Autorise déjà Google Fonts et les vidéos YouTube.</p>
            </div>
            <Toggle on={form.cspEnabled} onChange={() => patch({ cspEnabled: !form.cspEnabled })} />
          </li>
          <li className="feature-row">
            <span className="feature-icon" aria-hidden>🔒</span>
            <div className="feature-text">
              <div className="feature-name">HSTS (forcer HTTPS)
                <span className={`status-badge ${form.hstsEnabled ? 'active' : 'inactif'}`}>{form.hstsEnabled ? 'Activé' : 'Désactivé'}</span>
              </div>
              <p className="meta">Oblige les navigateurs à n’utiliser que HTTPS. Actif uniquement en production (jamais en local http).</p>
            </div>
            <Toggle on={form.hstsEnabled} onChange={() => patch({ hstsEnabled: !form.hstsEnabled })} />
          </li>
          <li className="feature-row">
            <span className="feature-icon" aria-hidden>🖼️</span>
            <div className="feature-text">
              <div className="feature-name">Anti-clickjacking strict (X-Frame-Options: DENY)
                <span className={`status-badge ${form.frameDeny ? 'active' : 'inactif'}`}>{form.frameDeny ? 'DENY' : 'SAMEORIGIN'}</span>
              </div>
              <p className="meta">Interdit totalement l’intégration du site dans une iframe externe. Laisse sur SAMEORIGIN si tu intègres tes propres pages.</p>
            </div>
            <Toggle on={form.frameDeny} onChange={() => patch({ frameDeny: !form.frameDeny })} />
          </li>
        </ul>

        <h3>État de la protection</h3>
        <ul className="sec-check">
          <li className={s?.https ? 'ok' : 'warn'}><span>{s?.https ? '✓' : '⚠'}</span> Connexion HTTPS {s?.https ? 'active' : '(non détectée — normal en local)'}</li>
          <li className={s?.csp ? 'ok' : 'warn'}><span>{s?.csp ? '✓' : '⚠'}</span> En-tête CSP {s?.csp ? 'appliqué' : 'désactivé'}</li>
          <li className={s?.hsts ? 'ok' : 'warn'}><span>{s?.hsts ? '✓' : '⚠'}</span> HSTS {s?.hsts ? 'appliqué' : 'inactif (dev ou désactivé)'}</li>
          <li className="ok"><span>✓</span> Limitation de débit (login, formulaires, commentaires)</li>
          <li className="ok"><span>✓</span> Sessions : {s?.sessionStore ?? 'SQLite'}</li>
          <li className="ok"><span>✓</span> Mots de passe hachés (bcrypt) · cookies httpOnly/SameSite</li>
        </ul>
      </div>

      <p className="hint" style={{ marginTop: 8 }}>
        Si une fonctionnalité externe ne se charge plus après activation de la CSP (police, widget…), désactive-la le temps d’ajuster les règles.
      </p>
    </>
  );
}

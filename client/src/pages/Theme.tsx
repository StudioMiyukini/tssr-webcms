import { useEffect, useState } from 'react';
import { useThemeSettings, useUpdateThemeSettings } from '@/api/hooks';
import { useToast } from '@/lib/toast';
import { applyThemeSettings } from '@/lib/theme';
import { DEFAULT_THEME, FONT_OPTIONS, FONT_WEIGHTS, THEME_PRESETS, type ThemeSettings, type ThemePalette, type ThemePreset } from '@shared/types';
import { MediaField } from '@/components/MediaPicker';

const PALETTE_FIELDS: Array<{ key: keyof ThemePalette; label: string }> = [
  { key: 'bg', label: 'Fond' },
  { key: 'surface', label: 'Surface' },
  { key: 'surface2', label: 'Surface 2' },
  { key: 'surface3', label: 'Surface 3' },
  { key: 'border', label: 'Bordure' },
  { key: 'borderStrong', label: 'Bordure forte' },
  { key: 'text', label: 'Texte' },
  { key: 'textSoft', label: 'Texte doux' },
  { key: 'textMuted', label: 'Texte atténué' },
  { key: 'accent', label: 'Accent' },
  { key: 'accentHover', label: 'Accent (survol)' },
];

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="color-field">
        <input type="color" value={value} onChange={e => onChange(e.target.value)} />
        <input value={value} onChange={e => onChange(e.target.value)} maxLength={7} />
      </div>
    </div>
  );
}

function PaletteEditor({ palette, onChange }: { palette: ThemePalette; onChange: (p: ThemePalette) => void }) {
  return (
    <div className="palette-grid">
      {PALETTE_FIELDS.map(f => (
        <ColorInput key={f.key} label={f.label} value={palette[f.key]} onChange={v => onChange({ ...palette, [f.key]: v })} />
      ))}
    </div>
  );
}

export function ThemePage() {
  const q = useThemeSettings();
  const update = useUpdateThemeSettings();
  const { push } = useToast();
  const [t, setT] = useState<ThemeSettings>(DEFAULT_THEME);

  useEffect(() => { if (q.data) setT(q.data); }, [q.data]);
  useEffect(() => { applyThemeSettings(t); }, [t]);
  useEffect(() => () => { if (q.data) applyThemeSettings(q.data); }, [q.data]);

  const set = (patch: Partial<ThemeSettings>) => setT(prev => ({ ...prev, ...patch }));
  const applyPreset = (p: ThemePreset) => setT(prev => ({
    ...prev,
    light: { ...prev.light, accent: p.accent, accentHover: p.accentHover },
    dark: { ...prev.dark, accent: p.accentDark, accentHover: p.accentHoverDark },
  }));

  const dirty = !!q.data && JSON.stringify(q.data) !== JSON.stringify(t);
  const onSave = () => update.mutate(t, {
    onSuccess: () => push('Thème enregistré.', 'success'),
    onError: () => push('Échec de l’enregistrement.', 'error'),
  });

  if (q.isLoading) return <div className="loading">Chargement…</div>;

  return (
    <>
      <div className="topbar-row">
        <div><h1>Thème visuel</h1><p>Personnalisation complète : couleurs, typographie, forme, marque.</p></div>
        <div className="actions">
          <button className="btn secondary" type="button" onClick={() => setT(structuredClone(DEFAULT_THEME))}>Réinitialiser</button>
          <button className="btn" type="button" onClick={onSave} disabled={!dirty || update.isPending}>
            {update.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Presets de couleur</h2>
        <div className="preset-row">
          {THEME_PRESETS.map(p => (
            <button key={p.name} type="button" className="preset-btn" onClick={() => applyPreset(p)} title={`Appliquer « ${p.name} »`}>
              <span className="preset-swatch" style={{ background: p.accent }} />
              <span className="preset-swatch" style={{ background: p.accentDark }} />
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Marque</h2>
        <div className="field"><label>Nom de marque</label><input value={t.brandName} onChange={e => set({ brandName: e.target.value })} placeholder="Mon Site" /></div>
        <MediaField label="Logo (optionnel)" value={t.logoUrl} onChange={logoUrl => set({ logoUrl })} />
        <MediaField label="Favicon (optionnel)" value={t.faviconUrl} onChange={faviconUrl => set({ faviconUrl })} />
      </div>

      <div className="card">
        <h2>Couleurs — mode clair</h2>
        <PaletteEditor palette={t.light} onChange={light => set({ light })} />
      </div>

      <div className="card">
        <h2>Couleurs — mode sombre</h2>
        <PaletteEditor palette={t.dark} onChange={dark => set({ dark })} />
      </div>

      <div className="card">
        <h2>Couleurs sémantiques</h2>
        <div className="palette-grid">
          <ColorInput label="Succès" value={t.success} onChange={v => set({ success: v })} />
          <ColorInput label="Avertissement" value={t.warning} onChange={v => set({ warning: v })} />
          <ColorInput label="Danger" value={t.danger} onChange={v => set({ danger: v })} />
          <ColorInput label="Violet" value={t.purple} onChange={v => set({ purple: v })} />
        </div>
      </div>

      <div className="card">
        <h2>Typographie</h2>
        <div className="row">
          <div className="field"><label>Police du corps</label>
            <select value={t.fontBody} onChange={e => set({ fontBody: e.target.value })}>
              {FONT_OPTIONS.map(f => <option key={f.label} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div className="field"><label>Police des titres</label>
            <select value={t.fontHeading} onChange={e => set({ fontHeading: e.target.value })}>
              <option value="">Identique au corps</option>
              {FONT_OPTIONS.map(f => <option key={f.label} value={f.value}>{f.label}</option>)}
            </select>
          </div>
        </div>
        <div className="row">
          <div className="field"><label>Taille de base : {t.baseFontSize} px</label>
            <input type="range" min={10} max={20} value={t.baseFontSize} onChange={e => set({ baseFontSize: Number(e.target.value) })} />
          </div>
          <div className="field"><label>Graisse des titres</label>
            <select value={t.headingWeight} onChange={e => set({ headingWeight: Number(e.target.value) })}>
              {FONT_WEIGHTS.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Forme</h2>
        <div className="field" style={{ maxWidth: 320 }}>
          <label>Arrondi des coins : {t.radius} px</label>
          <input type="range" min={0} max={24} value={t.radius} onChange={e => set({ radius: Number(e.target.value) })} />
        </div>
      </div>

      <div className="card">
        <h2>CSS personnalisé (avancé)</h2>
        <p className="hint">Injecté en fin de feuille de style — pour les ajustements fins. Utilise les variables <code>--accent</code>, <code>--surface</code>, etc.</p>
        <div className="field">
          <textarea value={t.customCss} onChange={e => set({ customCss: e.target.value })} style={{ minHeight: 140, fontFamily: 'SF Mono, Menlo, Consolas, monospace', fontSize: 12 }} placeholder=".public-header { backdrop-filter: blur(12px); }" />
        </div>
      </div>

      <div className="card">
        <h2>Aperçu en direct</h2>
        <p>Texte courant avec un <a href="#" onClick={e => e.preventDefault()}>lien d'exemple</a> pour visualiser couleur et police.</p>
        <div className="actions" style={{ marginBottom: 12 }}>
          <button className="btn" type="button">Bouton principal</button>
          <button className="btn secondary" type="button">Secondaire</button>
          <span className="status-badge active">Succès</span>
          <span className="status-badge pending">Attention</span>
          <span className="status-badge cancelled">Danger</span>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <h3>Carte d'exemple</h3>
          <p className="meta">Couleurs, arrondis, police et graisses s'appliquent partout — site public et back-office, clair et sombre.</p>
        </div>
      </div>

      <p className="hint">Toutes les modifications sont visibles en direct ci-dessus avant enregistrement. « Réinitialiser » restaure le thème par défaut.</p>
    </>
  );
}

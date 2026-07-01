import { useEffect } from 'react';
import { usePublicThemeSettings } from '@/api/public';
import { applyThemeSettings } from '@/lib/theme';

/** Charge le thème personnalisé public et l'applique aux variables CSS (admin + site). Ne rend rien. */
export function ThemeVars() {
  const t = usePublicThemeSettings();
  useEffect(() => { if (t.data) applyThemeSettings(t.data); }, [t.data]);
  return null;
}

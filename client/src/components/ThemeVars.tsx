import { useEffect } from 'react';
import { usePublicThemeSettings } from '@/api/public';
import { applyThemeSettings } from '@/lib/theme';

/** Charge le thème personnalisé public et l'applique aux variables CSS (admin + site). Ne rend rien. */
/*
 * @id     tssr.compThemeVars
 * @do     injecter_variables_theme
 * @role   ui
 * @layer  ui
 * @human  Injecte les variables CSS de thème du site dans la page.
 */
export function ThemeVars() {
  const t = usePublicThemeSettings();
  useEffect(() => { if (t.data) applyThemeSettings(t.data); }, [t.data]);
  return null;
}

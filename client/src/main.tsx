import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { queryClient } from './lib/query';
import { ToastProvider } from './lib/toast';
import { ThemeVars } from './components/ThemeVars';
import './styles.css';

// Amorçage : données injectées par le serveur dans le HTML (#__boot) → le 1er rendu
// dispose déjà du thème, des menus, des fonctionnalités et du contenu de la page,
// sans aucun aller-retour API. React Query revalide ensuite en arrière-plan.
try {
  const bootEl = document.getElementById('__boot');
  if (bootEl?.textContent) {
    const b = JSON.parse(bootEl.textContent);
    if (b.theme) queryClient.setQueryData(['public-theme'], b.theme);
    if (b.features) queryClient.setQueryData(['public-features'], b.features);
    if (b.menus) queryClient.setQueryData(['public-menus'], b.menus);
    if (b.site) queryClient.setQueryData(['site-access'], b.site);
    if (b.page?.slug) queryClient.setQueryData(['public-page', b.page.slug], b.page.data);
  }
} catch { /* amorçage optionnel : on ignore toute erreur */ }

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeVars />
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);

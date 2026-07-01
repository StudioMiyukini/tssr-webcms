import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { usePublicFeatures } from '@/api/public';
import type { FeatureKey } from '@shared/types';

const LABELS: Record<FeatureKey, string> = {
  shop: 'La boutique',
  quotes: 'Les demandes de devis',
  accounts: 'Les comptes clients',
  forms: 'Les formulaires',
  events: 'L’agenda',
  blog: 'Le blog',
  planning: 'Le planning',
  forum: 'Le forum',
};

/** Affiche le contenu seulement si le module est activé, sinon un message + retour accueil. */
export function FeatureGuard({ feature, children }: { feature: FeatureKey; children: ReactNode }) {
  const f = usePublicFeatures();
  if (f.isLoading) return <div className="loading">Chargement…</div>;
  if (!f.data?.[feature]) {
    return (
      <div className="empty">
        {LABELS[feature]} n'est pas disponible actuellement. <Link to="/">Retour à l'accueil</Link>
      </div>
    );
  }
  return <>{children}</>;
}

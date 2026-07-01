import { useEffect, useState } from 'react';
import { useFeatures, useUpdateFeatures } from '@/api/hooks';
import { useToast } from '@/lib/toast';
import type { FeatureKey } from '@shared/types';

export function FeaturesPage() {
  const list = useFeatures();
  const update = useUpdateFeatures();
  const { push } = useToast();
  const [flags, setFlags] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (list.data) setFlags(Object.fromEntries(list.data.map(f => [f.key, f.enabled])));
  }, [list.data]);

  const toggle = (key: FeatureKey) => setFlags(f => ({ ...f, [key]: !f[key] }));
  const dirty = (list.data ?? []).some(f => !!flags[f.key] !== f.enabled);

  const onSave = () => {
    update.mutate(flags as Partial<Record<FeatureKey, boolean>>, {
      onSuccess: () => push('Fonctionnalités mises à jour.', 'success'),
      onError: () => push('Échec de l’enregistrement.', 'error'),
    });
  };

  if (list.isLoading) return <div className="loading">Chargement…</div>;

  return (
    <>
      <div className="topbar-row">
        <div><h1>Fonctionnalités</h1><p>Activez ou désactivez les modules du site et du back-office.</p></div>
        <button className="btn" onClick={onSave} disabled={!dirty || update.isPending}>
          {update.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>

      <div className="card">
        <ul className="feature-list">
          {(list.data ?? []).map(f => {
            const on = !!flags[f.key];
            return (
              <li key={f.key} className="feature-row">
                <span className="feature-icon" aria-hidden>{f.icon}</span>
                <div className="feature-text">
                  <div className="feature-name">
                    {f.label}
                    <span className={`status-badge ${on ? 'active' : 'inactif'}`}>{on ? 'Activé' : 'Désactivé'}</span>
                  </div>
                  <p className="meta">{f.description}</p>
                </div>
                <label className="switch" title={on ? 'Désactiver' : 'Activer'}>
                  <input type="checkbox" checked={on} onChange={() => toggle(f.key)} />
                  <span className="switch-slider" aria-hidden />
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="hint" style={{ marginTop: 4 }}>
        Désactiver un module masque ses pages et liens sur le site public ; le contenu et les données restent conservés.
      </p>
    </>
  );
}

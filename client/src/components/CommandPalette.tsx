import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { usePublicFeatures } from '@/api/public';
import type { FeatureKey } from '@shared/types';

interface PaletteItem { label: string; section: string; to?: string; href?: string; feature?: FeatureKey; }

const ITEMS: PaletteItem[] = [
  { label: 'Tableau de bord', section: 'Aller à', to: '/admin' },
  { label: 'Pages', section: 'Aller à', to: '/admin/pages' },
  { label: 'Menus', section: 'Aller à', to: '/admin/menus' },
  { label: 'Produits', section: 'Aller à', to: '/admin/products', feature: 'shop' },
  { label: 'Commandes', section: 'Aller à', to: '/admin/orders', feature: 'shop' },
  { label: 'Coupons', section: 'Aller à', to: '/admin/coupons', feature: 'shop' },
  { label: 'Livraison', section: 'Aller à', to: '/admin/shipping', feature: 'shop' },
  { label: 'Modèles devis', section: 'Aller à', to: '/admin/quote-forms', feature: 'quotes' },
  { label: 'Demandes devis', section: 'Aller à', to: '/admin/quote-submissions', feature: 'quotes' },
  { label: 'Formulaires', section: 'Aller à', to: '/admin/forms', feature: 'forms' },
  { label: 'Articles (blog)', section: 'Aller à', to: '/admin/posts', feature: 'blog' },
  { label: 'Commentaires', section: 'Aller à', to: '/admin/comments', feature: 'blog' },
  { label: 'Événements', section: 'Aller à', to: '/admin/events', feature: 'events' },
  { label: 'Médias', section: 'Aller à', to: '/admin/media' },
  { label: 'Notes', section: 'Aller à', to: '/admin/notes' },
  { label: 'Fonctionnalités', section: 'Aller à', to: '/admin/features' },
  { label: 'Thème visuel', section: 'Aller à', to: '/admin/theme' },
  { label: 'Performance & sécurité', section: 'Aller à', to: '/admin/performance' },
  { label: 'Emails', section: 'Aller à', to: '/admin/email' },
  { label: 'Newsletter', section: 'Aller à', to: '/admin/newsletter' },
  { label: 'Modèles d\'email', section: 'Aller à', to: '/admin/email-templates' },
  { label: 'Nouvelle page', section: 'Créer', to: '/admin/pages/new' },
  { label: 'Nouvelle note', section: 'Créer', to: '/admin/notes' },
  { label: 'Nouveau produit', section: 'Créer', to: '/admin/products/new', feature: 'shop' },
  { label: 'Nouveau coupon', section: 'Créer', to: '/admin/coupons/new', feature: 'shop' },
  { label: 'Nouveau mode livraison', section: 'Créer', to: '/admin/shipping/new', feature: 'shop' },
  { label: 'Nouveau lien menu', section: 'Créer', to: '/admin/menus/new' },
  { label: 'Nouveau formulaire devis', section: 'Créer', to: '/admin/quote-forms/new', feature: 'quotes' },
  { label: 'Nouveau formulaire', section: 'Créer', to: '/admin/forms/new', feature: 'forms' },
  { label: 'Nouvel article', section: 'Créer', to: '/admin/posts/new', feature: 'blog' },
  { label: 'Nouvel événement', section: 'Créer', to: '/admin/events/new', feature: 'events' },
  { label: 'Visiter le site public', section: 'Externe', href: '/' },
  { label: 'Voir la boutique', section: 'Externe', href: '/shop', feature: 'shop' },
];

interface Props { open: boolean; onClose: () => void; }

export function CommandPalette({ open, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const features = usePublicFeatures();

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Retire les entrées dont le module est désactivé.
  const available = useMemo(() => ITEMS.filter(it => !it.feature || !!features.data?.[it.feature]), [features.data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter(it => it.label.toLowerCase().includes(q) || it.section.toLowerCase().includes(q));
  }, [query, available]);

  const sections = useMemo(() => {
    const groups: Record<string, PaletteItem[]> = {};
    filtered.forEach(it => { (groups[it.section] = groups[it.section] || []).push(it); });
    return groups;
  }, [filtered]);

  const navigateTo = (item: PaletteItem) => {
    if (item.href) {
      window.open(item.href, '_blank');
    } else if (item.to) {
      navigate({ to: item.to });
    }
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => (i + 1) % filtered.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => (i - 1 + filtered.length) % filtered.length); return; }
      if (e.key === 'Enter') { e.preventDefault(); if (filtered[activeIndex]) navigateTo(filtered[activeIndex]); return; }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, filtered, activeIndex]);

  if (!open) return null;

  let runningIndex = 0;
  return (
    <div className="cmdk-overlay" role="dialog" aria-modal="true" aria-label="Recherche rapide" onClick={onClose}>
      <div className="cmdk-shell" onClick={e => e.stopPropagation()}>
        <div className="cmdk-search">
          <span className="cmdk-icon">⌕</span>
          <input ref={inputRef} className="cmdk-input" type="text" value={query} onChange={e => { setQuery(e.target.value); setActiveIndex(0); }} placeholder="Rechercher une action ou une page…" spellCheck={false} autoComplete="off" />
          <kbd>Esc</kbd>
        </div>
        <div className="cmdk-results">
          {Object.keys(sections).length === 0 && <div className="cmdk-section">Aucun résultat</div>}
          {Object.entries(sections).map(([section, items]) => (
            <div key={section}>
              <div className="cmdk-section">{section}</div>
              {items.map(item => {
                const myIndex = runningIndex++;
                return (
                  <div key={item.label} className={`cmdk-item ${myIndex === activeIndex ? 'active' : ''}`} onClick={() => navigateTo(item)} onMouseEnter={() => setActiveIndex(myIndex)}>
                    <span>{item.label}</span>
                    <span className="cmdk-arrow">↵</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="cmdk-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> naviguer</span>
          <span><kbd>↵</kbd> ouvrir</span>
          <span><kbd>Esc</kbd> fermer</span>
        </div>
      </div>
    </div>
  );
}

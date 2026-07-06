import { Link, useLocation } from '@tanstack/react-router';
import { usePublicFeatures } from '@/api/public';
import type { FeatureKey } from '@shared/types';

interface SidebarProps { onClose?: () => void; }

interface NavItem {
  to?: string;
  label: string;
  icon: string;
  shortcut?: string;
  disabled?: boolean;
  badge?: string;
}
interface NavGroup { title?: string; items: NavItem[]; feature?: FeatureKey; }

const NAV_GROUPS: NavGroup[] = [
  { items: [{ to: '/admin', label: 'Tableau de bord', icon: '🏠', shortcut: 'g d' }] },
  {
    title: 'Contenu',
    items: [
      { to: '/admin/pages', label: 'Pages', icon: '📄', shortcut: 'g p' },
      { to: '/admin/menus', label: 'Menus', icon: '🧭', shortcut: 'g m' },
      { to: '/admin/media', label: 'Médias', icon: '🖼️' },
      { to: '/admin/notes', label: 'Notes', icon: '🗒️' },
    ],
  },
  {
    title: 'Commerce',
    feature: 'shop',
    items: [
      { to: '/admin/products', label: 'Produits', icon: '🛍️', shortcut: 'g r' },
      { to: '/admin/orders', label: 'Commandes', icon: '📦', shortcut: 'g o' },
      { to: '/admin/coupons', label: 'Coupons', icon: '🏷️', shortcut: 'g c' },
      { to: '/admin/shipping', label: 'Livraison', icon: '🚚', shortcut: 'g l' },
      { label: 'POS / Caisse', icon: '🧾', disabled: true, badge: 'Bientôt' },
      { label: 'Comptabilité', icon: '💼', disabled: true, badge: 'Bientôt' },
    ],
  },
  {
    title: 'Devis',
    feature: 'quotes',
    items: [
      { to: '/admin/quote-forms', label: 'Modèles devis', icon: '📝', shortcut: 'g f' },
      { to: '/admin/quote-submissions', label: 'Demandes', icon: '📨', shortcut: 'g s' },
    ],
  },
  {
    title: 'Formulaires',
    feature: 'forms',
    items: [
      { to: '/admin/forms', label: 'Formulaires', icon: '🧾' },
    ],
  },
  {
    title: 'Blog',
    feature: 'blog',
    items: [
      { to: '/admin/posts', label: 'Articles', icon: '📰' },
      { to: '/admin/comments', label: 'Commentaires', icon: '💬' },
    ],
  },
  {
    title: 'Agenda',
    feature: 'events',
    items: [
      { to: '/admin/events', label: 'Événements', icon: '📅' },
    ],
  },
  {
    title: 'Planning',
    feature: 'planning',
    items: [
      { to: '/admin/plannings', label: 'Plannings', icon: '🗓️' },
    ],
  },
  {
    title: 'Forum',
    feature: 'forum',
    items: [
      { to: '/admin/forum', label: 'Forum', icon: '💬' },
    ],
  },
  {
    title: 'CRM',
    items: [
      { label: 'Clients', icon: '👥', disabled: true, badge: 'Bientôt' },
      { label: 'Emails', icon: '✉️', disabled: true, badge: 'Bientôt' },
    ],
  },
  {
    title: 'Réglages',
    items: [
      { to: '/admin/features', label: 'Fonctionnalités', icon: '⚙️' },
      { to: '/admin/theme', label: 'Thème visuel', icon: '🎨' },
      { to: '/admin/performance', label: 'Performance & sécurité', icon: '🛡️' },
      { to: '/admin/backup', label: 'Sauvegarde & export', icon: '💾' },
      { to: '/admin/email', label: 'Emails', icon: '✉️' },
      { to: '/admin/newsletter', label: 'Newsletter', icon: '📣' },
      { to: '/admin/email-templates', label: 'Modèles d\'email', icon: '🗒️' },
    ],
  },
];

export function Sidebar({ onClose }: SidebarProps = {}) {
  const location = useLocation();
  const path = location.pathname;
  const isActive = (to: string) => to === '/admin' ? path === '/admin' : (path === to || path.startsWith(to + '/'));

  // Masque les groupes liés à un module désactivé (la boutique/les devis off → groupe caché).
  const features = usePublicFeatures();
  const groups = NAV_GROUPS.filter(g => !g.feature || !!features.data?.[g.feature]);

  return (
    <aside className="sidebar">
      <button type="button" className="sidebar-close" aria-label="Fermer le menu" onClick={onClose}>✕</button>
      {groups.map((group, gi) => (
        <ul key={gi} className="nav-group">
          {group.title && <li className="nav-group-title">{group.title}</li>}
          {group.items.map((item, i) => {
            if (item.disabled) {
              return (
                <li key={i}>
                  <span className="nav-link nav-disabled" title="Module à venir">
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                    {item.badge && <span className="nav-badge">{item.badge}</span>}
                  </span>
                </li>
              );
            }
            return (
              <li key={i}>
                <Link to={item.to!} className={`nav-link ${item.to && isActive(item.to) ? 'active' : ''}`}>
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                  {item.shortcut && <span className="nav-shortcut">{item.shortcut}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      ))}
    </aside>
  );
}

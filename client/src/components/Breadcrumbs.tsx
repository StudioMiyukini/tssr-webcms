import { Link, useLocation } from '@tanstack/react-router';

const RULES: Array<{ test: RegExp; crumbs: Array<[string, string | null]>; }> = [
  { test: /^\/admin\/?$/, crumbs: [['Admin', null]] },
  { test: /^\/admin\/pages$/, crumbs: [['Admin', '/admin'], ['Pages', null]] },
  { test: /^\/admin\/pages\/new$/, crumbs: [['Admin', '/admin'], ['Pages', '/admin/pages'], ['Nouvelle', null]] },
  { test: /^\/admin\/pages\/\d+\/edit$/, crumbs: [['Admin', '/admin'], ['Pages', '/admin/pages'], ['Édition', null]] },
  { test: /^\/admin\/menus$/, crumbs: [['Admin', '/admin'], ['Menus', null]] },
  { test: /^\/admin\/menus\/new$/, crumbs: [['Admin', '/admin'], ['Menus', '/admin/menus'], ['Nouveau', null]] },
  { test: /^\/admin\/menus\/\d+\/edit$/, crumbs: [['Admin', '/admin'], ['Menus', '/admin/menus'], ['Édition', null]] },
  { test: /^\/admin\/products$/, crumbs: [['Admin', '/admin'], ['Produits', null]] },
  { test: /^\/admin\/products\/new$/, crumbs: [['Admin', '/admin'], ['Produits', '/admin/products'], ['Nouveau', null]] },
  { test: /^\/admin\/products\/\d+\/edit$/, crumbs: [['Admin', '/admin'], ['Produits', '/admin/products'], ['Édition', null]] },
  { test: /^\/admin\/orders$/, crumbs: [['Admin', '/admin'], ['Commandes', null]] },
  { test: /^\/admin\/orders\/\d+$/, crumbs: [['Admin', '/admin'], ['Commandes', '/admin/orders'], ['Détail', null]] },
  { test: /^\/admin\/coupons$/, crumbs: [['Admin', '/admin'], ['Coupons', null]] },
  { test: /^\/admin\/coupons\/new$/, crumbs: [['Admin', '/admin'], ['Coupons', '/admin/coupons'], ['Nouveau', null]] },
  { test: /^\/admin\/coupons\/\d+\/edit$/, crumbs: [['Admin', '/admin'], ['Coupons', '/admin/coupons'], ['Édition', null]] },
  { test: /^\/admin\/shipping$/, crumbs: [['Admin', '/admin'], ['Livraison', null]] },
  { test: /^\/admin\/shipping\/new$/, crumbs: [['Admin', '/admin'], ['Livraison', '/admin/shipping'], ['Nouveau', null]] },
  { test: /^\/admin\/shipping\/\d+\/edit$/, crumbs: [['Admin', '/admin'], ['Livraison', '/admin/shipping'], ['Édition', null]] },
  { test: /^\/admin\/quote-forms$/, crumbs: [['Admin', '/admin'], ['Modèles devis', null]] },
  { test: /^\/admin\/quote-forms\/new$/, crumbs: [['Admin', '/admin'], ['Modèles devis', '/admin/quote-forms'], ['Nouveau', null]] },
  { test: /^\/admin\/quote-forms\/\d+\/edit$/, crumbs: [['Admin', '/admin'], ['Modèles devis', '/admin/quote-forms'], ['Édition', null]] },
  { test: /^\/admin\/quote-submissions$/, crumbs: [['Admin', '/admin'], ['Demandes devis', null]] },
  { test: /^\/admin\/quote-submissions\/\d+$/, crumbs: [['Admin', '/admin'], ['Demandes devis', '/admin/quote-submissions'], ['Détail', null]] },
];

export function Breadcrumbs() {
  const loc = useLocation();
  const crumbs = RULES.find(r => r.test.test(loc.pathname))?.crumbs ?? [['Admin', '/admin']];
  return (
    <div className="breadcrumbs">
      {crumbs.map(([label, href], i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {isLast || !href ? <span className="crumb crumb-current">{label}</span> : <Link className="crumb" to={href}>{label}</Link>}
            {!isLast && <span className="crumb-sep">/</span>}
          </span>
        );
      })}
    </div>
  );
}

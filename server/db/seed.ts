import { db, rawDb } from './client';
import { pages, menu_items, products, coupons, shipping_methods, quote_forms } from './schema';

const pageCount = (rawDb.prepare('SELECT COUNT(*) AS count FROM pages').get() as { count: number }).count;
if (!pageCount) {
  db.insert(pages).values([
    { title: 'Accueil', slug: 'accueil', excerpt: 'Bienvenue sur votre nouveau CMS.', content: '<h2>Bienvenue</h2><p>Cette webapp CMS vous permet de gérer pages, menu, catalogue produits et formulaires de devis depuis le back-office.</p>', published: 1 },
    { title: 'À propos', slug: 'a-propos', excerpt: 'Présentez votre activité.', content: '<h2>À propos</h2><p>Décrivez ici votre entreprise.</p>', published: 1 },
  ]).run();
}

const menuCount = (rawDb.prepare('SELECT COUNT(*) AS count FROM menu_items').get() as { count: number }).count;
if (!menuCount) {
  db.insert(menu_items).values([
    { label: 'Accueil', url: '/', sort_order: 1 },
    { label: 'Boutique', url: '/shop', sort_order: 2 },
    { label: 'Devis', url: '/devis/formulaire-principal', sort_order: 3 },
    { label: 'À propos', url: '/pages/a-propos', sort_order: 4 },
  ]).run();
}

const productCount = (rawDb.prepare('SELECT COUNT(*) AS count FROM products').get() as { count: number }).count;
if (!productCount) {
  db.insert(products).values({
    name: 'Produit de démonstration',
    slug: 'produit-demo',
    description: 'Exemple de fiche produit pour démarrer votre boutique en ligne.',
    price_cents: 2990,
    stock: 15,
    image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80',
    published: 1,
  }).run();
}

const couponCount = (rawDb.prepare('SELECT COUNT(*) AS count FROM coupons').get() as { count: number }).count;
if (!couponCount) {
  db.insert(coupons).values([
    { code: 'BIENVENUE10', label: 'Bienvenue 10%', discount_type: 'percent', discount_value: 10, min_subtotal_cents: 0, active: 1 },
    { code: 'LIVRAISON50', label: 'Remise fixe 5€', discount_type: 'fixed', discount_value: 500, min_subtotal_cents: 2500, active: 1 },
  ]).run();
}

const shippingCount = (rawDb.prepare('SELECT COUNT(*) AS count FROM shipping_methods').get() as { count: number }).count;
if (!shippingCount) {
  db.insert(shipping_methods).values([
    { name: 'Standard', description: 'Livraison classique 3 à 5 jours', price_cents: 590, free_from_cents: 8000, active: 1, sort_order: 1 },
    { name: 'Express', description: 'Livraison prioritaire 24 à 48h', price_cents: 1290, free_from_cents: 15000, active: 1, sort_order: 2 },
  ]).run();
}

const quoteCount = (rawDb.prepare('SELECT COUNT(*) AS count FROM quote_forms').get() as { count: number }).count;
if (!quoteCount) {
  const defaultFields = JSON.stringify([
    { name: 'project_type', label: 'Type de projet', type: 'select', required: true, options: ['Site vitrine', 'Boutique en ligne', 'Refonte CMS', 'Marketplace', 'Autre'] },
    { name: 'budget', label: 'Budget estimatif', type: 'select', required: true, options: ['< 2 000 €', '2 000 - 5 000 €', '5 000 - 10 000 €', '10 000 € et +'] },
    { name: 'features', label: 'Fonctionnalités attendues', type: 'textarea', required: true, placeholder: 'Décrivez vos besoins...' },
  ]);
  db.insert(quote_forms).values({
    title: 'Formulaire principal de devis',
    slug: 'formulaire-principal',
    description: 'Formulaire de demande de devis qualifié.',
    intro_html: '<p>Présentez votre besoin web en quelques minutes.</p>',
    cta_label: 'Envoyer ma demande de devis',
    success_message: 'Merci, votre demande a bien été envoyée.',
    fields_json: defaultFields,
    published: 1,
  }).run();
}

console.log('[seed] OK');

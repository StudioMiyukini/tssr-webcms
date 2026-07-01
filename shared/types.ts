export interface AdminSession {
  id: number;
  username: string;
}

export interface CustomerSession {
  id: number;
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
}

export interface DashboardStats {
  totalRevenueCents: number;
  pages: number;
  draftPages: number;
  products: number;
  publishedProducts: number;
  orders: number;
  pendingOrders: number;
  customers: number;
  quoteForms: number;
  quoteSubmissions: number;
  newQuotes: number;
}

export interface RecentActivity {
  latestPages: Array<{ id: number; title: string; slug: string; published: number; updated_at: string }>;
  latestOrders: Array<{ id: number; order_number: string; customer_name: string; customer_email: string; total_cents: number; status: string }>;
  latestQuotes: Array<{ id: number; customer_name: string; customer_email: string; status: string; form_title: string }>;
}

// ===== Emailing =====
export interface EmailSettings {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  notifyTo: string;          // destinataire des notifications admin
  notifyOnForm: boolean;     // email à l'admin quand un formulaire est soumis
  notifyOnQuote: boolean;    // email à l'admin sur nouvelle demande de devis
  notifyOnOrder: boolean;    // email à l'admin sur nouvelle commande
  ackToSubmitter: boolean;   // accusé de réception automatique au répondant (si email présent)
}
export interface EmailLogRow { id: number; recipient: string; subject: string; event_type: string; status: string; error_message: string; created_at: string | null; }

// ===== Performance & sécurité =====
export interface SiteSettings {
  cacheEnabled: boolean;   // cache mémoire des réponses publiques (GET) + en-têtes Cache-Control/ETag
  cacheTtl: number;        // durée de vie du cache, en secondes
  cspEnabled: boolean;     // en-tête Content-Security-Policy
  hstsEnabled: boolean;    // en-tête Strict-Transport-Security (HTTPS forcé, prod uniquement)
  frameDeny: boolean;      // X-Frame-Options: DENY (sinon SAMEORIGIN) — anti-clickjacking
  sitePrivate: boolean;    // site vitrine protégé par un mot de passe unique partagé
  membersOnly: boolean;    // espace membres : seul l'accueil est public, le reste exige un compte connecté
}
export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  cacheEnabled: true,
  cacheTtl: 60,
  cspEnabled: true,
  hstsEnabled: true,
  frameDeny: false,
  sitePrivate: false,
  membersOnly: false,
};
/** Réponse admin de /api/admin/site : réglages + indicateur de mot de passe défini (jamais le hash). */
export interface AdminSiteSettings extends SiteSettings { hasGatePassword: boolean; }
/** Payload admin pour modifier les réglages site (mot de passe optionnel, transmis en clair une seule fois). */
export interface SiteSettingsUpdate extends SiteSettings { sitePassword?: string; }
/** État public du verrou de confidentialité (exposé sans authentification).
 *  `private/unlocked` = verrou mot de passe partagé ; `membersOnly/isMember` = espace réservé aux comptes. */
export interface SiteAccessState { private: boolean; unlocked: boolean; membersOnly: boolean; isMember: boolean; }
export interface CacheStats { enabled: boolean; entries: number; hits: number; misses: number; hitRate: number; approxBytes: number; ttl: number; }
export interface SecurityStatus { csp: boolean; hsts: boolean; frameDeny: boolean; https: boolean; rateLimit: boolean; sessionStore: string; }

export type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded';
export type QuoteStatus = 'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'won' | 'lost';

// ===== Fonctionnalités (modules activables) =====
export type FeatureKey = 'shop' | 'quotes' | 'accounts' | 'forms' | 'events' | 'blog' | 'planning' | 'forum';

export interface FeatureDef {
  key: FeatureKey;
  label: string;
  description: string;
  icon: string;
  default: boolean;
}

/** Catalogue partagé client/serveur des modules activables depuis l'admin. */
export const FEATURES: FeatureDef[] = [
  { key: 'shop', label: 'Boutique en ligne', icon: '🛍️', default: false, description: 'Catalogue produits, panier, commandes et paiement. Affiche /shop, les fiches produits et le bloc boutique de l’accueil.' },
  { key: 'quotes', label: 'Devis', icon: '📝', default: false, description: 'Formulaires de demande de devis publics (/devis/...).' },
  { key: 'accounts', label: 'Comptes clients', icon: '👤', default: false, description: 'Inscription, connexion et espace client (/account).' },
  { key: 'forms', label: 'Formulaires', icon: '🧾', default: false, description: 'Formulaires personnalisés type Google Forms (/f/...), avec réponses et métriques.' },
  { key: 'events', label: 'Agenda', icon: '📅', default: false, description: 'Agenda d’événements public (/agenda) + programmation depuis l’admin.' },
  { key: 'blog', label: 'Blog / Actualités', icon: '📰', default: false, description: 'Articles publics (/blog) rédigés avec le page builder, par catégorie.' },
  { key: 'planning', label: 'Planning', icon: '🗓️', default: false, description: 'Plannings type emploi du temps (grille jours × créneaux colorés), affichés sur /planning.' },
  { key: 'forum', label: 'Forum', icon: '💬', default: false, description: 'Forum de discussion public (/forum) : catégories, sujets et réponses, modéré depuis l’admin.' },
];

// ===== Planning (emploi du temps en grille colorée) =====
/** Palette de couleurs des cellules de planning (clé stockée, libellé, fond, texte). */
export const PLANNING_COLORS: Array<{ key: string; label: string; bg: string; fg: string }> = [
  { key: '', label: 'Aucune', bg: 'transparent', fg: 'inherit' },
  { key: 'blue', label: 'Bleu', bg: '#3b82f6', fg: '#ffffff' },
  { key: 'lightblue', label: 'Bleu clair', bg: '#93c5fd', fg: '#0b1424' },
  { key: 'orange', label: 'Orange', bg: '#f59e0b', fg: '#1a1a1a' },
  { key: 'green', label: 'Vert', bg: '#34d399', fg: '#063' },
  { key: 'red', label: 'Rouge', bg: '#f87171', fg: '#3b0a0a' },
  { key: 'yellow', label: 'Jaune', bg: '#fde047', fg: '#3a2f00' },
  { key: 'purple', label: 'Violet', bg: '#c4b5fd', fg: '#2e1065' },
  { key: 'gray', label: 'Gris', bg: '#d1d5db', fg: '#1f2937' },
];
export interface PlanningCell { text: string; color: string; }
export interface PlanningRow { weekday: string; day: string; weekend: boolean; cells: PlanningCell[]; }
export interface PlanningLegendItem { label: string; color: string; }
/** Planning tel qu'exposé par l'API (JSON déjà parsé). */
export interface PlanningRecord {
  id: number; title: string; slug: string; section: string; period: string;
  columns: number; legend: PlanningLegendItem[]; rows: PlanningRow[];
  published: number; sort_order: number; created_at?: string; updated_at?: string;
}
export interface PlanningInput {
  title: string; slug?: string; section: string; period: string;
  columns: number; legend: PlanningLegendItem[]; rows: PlanningRow[];
  published: number; sort_order: number;
}

// ===== Forum =====
export interface ForumCategory { id: number; name: string; slug: string; description: string; sort_order: number; }
export interface ForumCategoryInput { name: string; slug?: string; description: string; sort_order: number; }
export interface ForumCategoryPublic extends ForumCategory { topic_count: number; reply_count: number; last_activity_at: string; }
export interface ForumTopic {
  id: number; category_id: number; title: string; slug: string; author: string; body: string;
  pinned: number; locked: number; reply_count: number; created_at: string; last_activity_at: string;
}
export interface ForumReply { id: number; topic_id: number; author: string; body: string; created_at: string; }
export interface ForumTopicView { topic: ForumTopic; category: ForumCategory; replies: ForumReply[]; }

// ===== Formulaires (type Google Forms) =====
export type FormFieldType = 'text' | 'textarea' | 'email' | 'tel' | 'number' | 'date' | 'select' | 'radio' | 'checkbox' | 'heading';

export interface FormField {
  id: string;
  type: FormFieldType;
  name: string;        // clé technique dans le payload
  label: string;
  required: boolean;
  placeholder: string;
  help: string;
  options: string[];   // select / radio / checkbox
}

export const FORM_FIELD_TYPES: Array<{ type: FormFieldType; label: string; icon: string; options?: boolean }> = [
  { type: 'text', label: 'Texte court', icon: 'Aa' },
  { type: 'textarea', label: 'Texte long', icon: '¶' },
  { type: 'email', label: 'Email', icon: '✉' },
  { type: 'tel', label: 'Téléphone', icon: '📞' },
  { type: 'number', label: 'Nombre', icon: '#' },
  { type: 'date', label: 'Date', icon: '📅' },
  { type: 'select', label: 'Liste déroulante', icon: '▾', options: true },
  { type: 'radio', label: 'Choix unique', icon: '◉', options: true },
  { type: 'checkbox', label: 'Cases à cocher', icon: '☑', options: true },
  { type: 'heading', label: 'Titre de section', icon: 'H' },
];

export const FORM_OPTION_TYPES: FormFieldType[] = ['select', 'radio', 'checkbox'];

/** Métriques agrégées d'un champ pour la vue admin. */
export interface FormFieldMetric {
  name: string;
  label: string;
  type: FormFieldType;
  answered: number;
  options?: Array<{ label: string; count: number }>; // select/radio/checkbox
  number?: { count: number; avg: number; min: number; max: number }; // number
  samples?: string[]; // texte : derniers échantillons
}
export interface FormMetrics { total: number; fields: FormFieldMetric[]; }

export type FeatureFlags = Record<FeatureKey, boolean>;
export interface FeatureItem extends FeatureDef { enabled: boolean; }

// ===== Thème visuel personnalisable =====
/** Palette d'un mode (clair ou sombre). */
export interface ThemePalette {
  bg: string; surface: string; surface2: string; surface3: string;
  border: string; borderStrong: string;
  text: string; textSoft: string; textMuted: string;
  accent: string; accentHover: string;
}

export interface ThemeSettings {
  light: ThemePalette;
  dark: ThemePalette;
  // Couleurs sémantiques (partagées clair/sombre)
  success: string; warning: string; danger: string; purple: string;
  // Typographie
  fontBody: string; fontHeading: string; baseFontSize: number; headingWeight: number;
  // Forme
  radius: number;
  // Branding
  brandName: string; logoUrl: string; faviconUrl: string;
  // Avancé
  customCss: string;
}

export const FONT_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Inter', value: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  { label: 'Système', value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" },
  { label: 'Serif (Georgia)', value: "Georgia, 'Times New Roman', serif" },
  { label: 'Monospace', value: "'SF Mono', Menlo, Consolas, 'Courier New', monospace" },
  { label: 'Trebuchet', value: "'Trebuchet MS', Verdana, sans-serif" },
  { label: 'Palatino', value: "'Palatino Linotype', 'Book Antiqua', Palatino, serif" },
];

export const FONT_WEIGHTS = [400, 500, 600, 700, 800];

const LIGHT: ThemePalette = {
  bg: '#f3f4f6', surface: '#ffffff', surface2: '#f9fafb', surface3: '#f3f4f6',
  border: '#e5e7eb', borderStrong: '#d1d5db',
  text: '#111827', textSoft: '#374151', textMuted: '#6b7280',
  accent: '#2271b1', accentHover: '#135e96',
};
const DARK: ThemePalette = {
  bg: '#0f172a', surface: '#1e293b', surface2: '#1a2436', surface3: '#0b1424',
  border: '#334155', borderStrong: '#475569',
  text: '#f1f5f9', textSoft: '#cbd5e1', textMuted: '#94a3b8',
  accent: '#60a5fa', accentHover: '#93c5fd',
};

export const DEFAULT_THEME: ThemeSettings = {
  light: { ...LIGHT }, dark: { ...DARK },
  success: '#00a32a', warning: '#dba617', danger: '#d63638', purple: '#7c3aed',
  fontBody: FONT_OPTIONS[0].value, fontHeading: '', baseFontSize: 13, headingWeight: 600,
  radius: 6,
  brandName: 'Mon Site', logoUrl: '', faviconUrl: '',
  customCss: '',
};

/** Presets de couleurs de marque (appliquent les accents clair + sombre en un clic). */
export interface ThemePreset { name: string; accent: string; accentHover: string; accentDark: string; accentHoverDark: string; }
export const THEME_PRESETS: ThemePreset[] = [
  { name: 'Océan', accent: '#2271b1', accentHover: '#135e96', accentDark: '#60a5fa', accentHoverDark: '#93c5fd' },
  { name: 'Sakura', accent: '#db2777', accentHover: '#9d174d', accentDark: '#f472b6', accentHoverDark: '#f9a8d4' },
  { name: 'Émeraude', accent: '#059669', accentHover: '#047857', accentDark: '#34d399', accentHoverDark: '#6ee7b7' },
  { name: 'Violet', accent: '#7c3aed', accentHover: '#6d28d9', accentDark: '#a78bfa', accentHoverDark: '#c4b5fd' },
  { name: 'Ambre', accent: '#d97706', accentHover: '#b45309', accentDark: '#fbbf24', accentHoverDark: '#fcd34d' },
  { name: 'Rubis', accent: '#dc2626', accentHover: '#b91c1c', accentDark: '#f87171', accentHoverDark: '#fca5a5' },
  { name: 'Ardoise', accent: '#475569', accentHover: '#334155', accentDark: '#94a3b8', accentHoverDark: '#cbd5e1' },
  { name: 'Cyber', accent: '#0891b2', accentHover: '#0e7490', accentDark: '#22d3ee', accentHoverDark: '#67e8f9' },
];

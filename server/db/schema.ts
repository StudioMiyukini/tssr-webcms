import { sql } from 'drizzle-orm';
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

export const admins = sqliteTable('admins', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const pages = sqliteTable('pages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  content: text('content').notNull().default(''),
  excerpt: text('excerpt').notNull().default(''),
  builder_json: text('builder_json').notNull().default(''),
  published: integer('published').notNull().default(1),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull().default(''),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const media = sqliteTable('media', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  filename: text('filename').notNull(),
  original_name: text('original_name').notNull().default(''),
  url: text('url').notNull(),
  mime: text('mime').notNull().default(''),
  size: integer('size').notNull().default(0),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const menu_items = sqliteTable('menu_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  label: text('label').notNull(),
  url: text('url').notNull(),
  sort_order: integer('sort_order').notNull().default(0),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull().default(''),
  short_description: text('short_description').notNull().default(''),
  price_cents: integer('price_cents').notNull().default(0),
  sale_price_cents: integer('sale_price_cents').notNull().default(0),
  compare_at_price_cents: integer('compare_at_price_cents').notNull().default(0),
  stock: integer('stock').notNull().default(0),
  image_url: text('image_url').notNull().default(''),
  sku: text('sku').notNull().default(''),
  category: text('category').notNull().default(''),
  featured: integer('featured').notNull().default(0),
  manage_stock: integer('manage_stock').notNull().default(1),
  published: integer('published').notNull().default(1),
  variants_json: text('variants_json').notNull().default('[]'),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  order_number: text('order_number').notNull().unique(),
  customer_id: integer('customer_id'),
  customer_name: text('customer_name').notNull().default(''),
  customer_email: text('customer_email').notNull().default(''),
  customer_phone: text('customer_phone').notNull().default(''),
  customer_company: text('customer_company').notNull().default(''),
  shipping_address: text('shipping_address').notNull().default(''),
  notes: text('notes').notNull().default(''),
  status: text('status').notNull().default('pending'),
  subtotal_cents: integer('subtotal_cents').notNull().default(0),
  discount_cents: integer('discount_cents').notNull().default(0),
  total_cents: integer('total_cents').notNull().default(0),
  coupon_code: text('coupon_code').notNull().default(''),
  coupon_label: text('coupon_label').notNull().default(''),
  shipping_method_name: text('shipping_method_name').notNull().default(''),
  shipping_price_cents: integer('shipping_price_cents').notNull().default(0),
  tax_rate_bps: integer('tax_rate_bps').notNull().default(2000),
  tax_cents: integer('tax_cents').notNull().default(0),
  payment_provider: text('payment_provider').notNull().default(''),
  payment_status: text('payment_status').notNull().default('manual'),
  stripe_session_id: text('stripe_session_id').notNull().default(''),
  stripe_payment_intent_id: text('stripe_payment_intent_id').notNull().default(''),
  invoice_number: text('invoice_number').notNull().default(''),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const order_items = sqliteTable('order_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  order_id: integer('order_id').notNull(),
  product_id: integer('product_id'),
  product_name: text('product_name').notNull().default(''),
  product_slug: text('product_slug').notNull().default(''),
  sku: text('sku').notNull().default(''),
  quantity: integer('quantity').notNull().default(1),
  unit_price_cents: integer('unit_price_cents').notNull().default(0),
  line_total_cents: integer('line_total_cents').notNull().default(0),
  variant_key: text('variant_key').notNull().default(''),
  variant_label: text('variant_label').notNull().default(''),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const coupons = sqliteTable('coupons', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  label: text('label').notNull().default(''),
  discount_type: text('discount_type').notNull().default('percent'),
  discount_value: integer('discount_value').notNull().default(0),
  min_subtotal_cents: integer('min_subtotal_cents').notNull().default(0),
  active: integer('active').notNull().default(1),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const shipping_methods = sqliteTable('shipping_methods', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  price_cents: integer('price_cents').notNull().default(0),
  free_from_cents: integer('free_from_cents').notNull().default(0),
  active: integer('active').notNull().default(1),
  sort_order: integer('sort_order').notNull().default(0),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const customers = sqliteTable('customers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().default(''),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  phone: text('phone').notNull().default(''),
  company: text('company').notNull().default(''),
  address: text('address').notNull().default(''),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const email_logs = sqliteTable('email_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  recipient: text('recipient').notNull().default(''),
  subject: text('subject').notNull().default(''),
  event_type: text('event_type').notNull().default(''),
  status: text('status').notNull().default('queued'),
  error_message: text('error_message').notNull().default(''),
  payload_json: text('payload_json').notNull().default('{}'),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const quote_forms = sqliteTable('quote_forms', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull().default(''),
  intro_html: text('intro_html').notNull().default(''),
  cta_label: text('cta_label').notNull().default('Envoyer ma demande'),
  success_message: text('success_message').notNull().default('Votre demande de devis a bien été envoyée.'),
  recipient_email: text('recipient_email').notNull().default(''),
  fields_json: text('fields_json').notNull().default('[]'),
  blocks_json: text('blocks_json').notNull().default('[]'),
  published: integer('published').notNull().default(1),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const quote_submissions = sqliteTable('quote_submissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  quote_form_id: integer('quote_form_id').notNull(),
  customer_name: text('customer_name').notNull().default(''),
  customer_email: text('customer_email').notNull().default(''),
  customer_company: text('customer_company').notNull().default(''),
  payload_json: text('payload_json').notNull(),
  notes: text('notes').notNull().default(''),
  status: text('status').notNull().default('new'),
  computed_total_cents: integer('computed_total_cents').notNull().default(0),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const forms = sqliteTable('forms', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull().default(''),
  fields_json: text('fields_json').notNull().default('[]'),
  success_message: text('success_message').notNull().default('Merci, votre réponse a bien été enregistrée.'),
  published: integer('published').notNull().default(1),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const form_submissions = sqliteTable('form_submissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  form_id: integer('form_id').notNull(),
  payload_json: text('payload_json').notNull().default('{}'),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  excerpt: text('excerpt').notNull().default(''),
  content: text('content').notNull().default(''),
  builder_json: text('builder_json').notNull().default(''),
  cover_url: text('cover_url').notNull().default(''),
  category: text('category').notNull().default(''),
  author: text('author').notNull().default(''),
  published: integer('published').notNull().default(1),
  featured: integer('featured').notNull().default(0),
  published_at: text('published_at').notNull().default(''),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const comments = sqliteTable('comments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  post_id: integer('post_id').notNull(),
  author: text('author').notNull().default(''),
  email: text('email').notNull().default(''),
  body: text('body').notNull().default(''),
  status: text('status').notNull().default('pending'),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const email_templates = sqliteTable('email_templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  subject: text('subject').notNull().default(''),
  body_html: text('body_html').notNull().default(''),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const campaigns = sqliteTable('campaigns', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  subject: text('subject').notNull().default(''),
  audience: text('audience').notNull().default(''),
  recipients: integer('recipients').notNull().default(0),
  sent: integer('sent').notNull().default(0),
  skipped: integer('skipped').notNull().default(0),
  failed: integer('failed').notNull().default(0),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const events = sqliteTable('events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull().default(''),
  location: text('location').notNull().default(''),
  start_at: text('start_at').notNull().default(''),
  end_at: text('end_at').notNull().default(''),
  all_day: integer('all_day').notNull().default(0),
  url: text('url').notNull().default(''),
  image_url: text('image_url').notNull().default(''),
  published: integer('published').notNull().default(1),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const note_folders = sqliteTable('note_folders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  sort_order: integer('sort_order').notNull().default(0),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const notes = sqliteTable('notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  folder_id: integer('folder_id').notNull().default(0), // 0 = aucun dossier
  title: text('title').notNull().default(''),
  content: text('content').notNull().default(''),       // HTML riche
  color: text('color').notNull().default(''),
  pinned: integer('pinned').notNull().default(0),
  archived: integer('archived').notNull().default(0),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const plannings = sqliteTable('plannings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  section: text('section').notNull().default(''),
  period: text('period').notNull().default(''),
  columns: integer('columns').notNull().default(4),
  legend_json: text('legend_json').notNull().default('[]'),
  rows_json: text('rows_json').notNull().default('[]'),
  published: integer('published').notNull().default(1),
  sort_order: integer('sort_order').notNull().default(0),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const forum_categories = sqliteTable('forum_categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull().default(''),
  sort_order: integer('sort_order').notNull().default(0),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const forum_topics = sqliteTable('forum_topics', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  category_id: integer('category_id').notNull(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  author: text('author').notNull().default(''),
  body: text('body').notNull().default(''),
  pinned: integer('pinned').notNull().default(0),
  locked: integer('locked').notNull().default(0),
  reply_count: integer('reply_count').notNull().default(0),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  last_activity_at: text('last_activity_at').default(sql`CURRENT_TIMESTAMP`),
});

export const forum_replies = sqliteTable('forum_replies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  topic_id: integer('topic_id').notNull(),
  author: text('author').notNull().default(''),
  body: text('body').notNull().default(''),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const user_files = sqliteTable('user_files', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  customer_id: integer('customer_id').notNull(),
  original_name: text('original_name').notNull().default(''),
  stored_name: text('stored_name').notNull(),
  mime: text('mime').notNull().default(''),
  size: integer('size').notNull().default(0),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export type Planning = typeof plannings.$inferSelect;
export type UserFile = typeof user_files.$inferSelect;
export type ForumCategoryRow = typeof forum_categories.$inferSelect;
export type ForumTopicRow = typeof forum_topics.$inferSelect;
export type ForumReplyRow = typeof forum_replies.$inferSelect;
export type Form = typeof forms.$inferSelect;
export type FormSubmission = typeof form_submissions.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type EmailTemplate = typeof email_templates.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type Page = typeof pages.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof order_items.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type ShippingMethod = typeof shipping_methods.$inferSelect;
export type MenuItem = typeof menu_items.$inferSelect;
export type QuoteForm = typeof quote_forms.$inferSelect;
export type QuoteSubmission = typeof quote_submissions.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Admin = typeof admins.$inferSelect;
export type Setting = typeof settings.$inferSelect;
export type Media = typeof media.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type NoteFolder = typeof note_folders.$inferSelect;

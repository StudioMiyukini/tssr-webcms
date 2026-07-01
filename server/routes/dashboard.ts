import { Router } from 'express';
import { sql, eq, desc, inArray } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { db } from '../db/client';
import { pages, products, orders, customers, quote_forms, quote_submissions } from '../db/schema';
import { requireAuth } from '../lib/auth';
import type { DashboardStats, RecentActivity } from '../../shared/types';

const router = Router();

router.get('/api/admin/dashboard/stats', requireAuth, (_req, res) => {
  const count = (table: SQLiteTable) => Number(db.select({ c: sql<number>`COUNT(*)` }).from(table).get()?.c ?? 0);
  const stats: DashboardStats = {
    totalRevenueCents: Number(db.select({ rev: sql<number>`COALESCE(SUM(total_cents), 0)` }).from(orders).where(inArray(orders.status, ['completed', 'processing'])).get()?.rev ?? 0),
    pages: count(pages),
    draftPages: Number(db.select({ c: sql<number>`COUNT(*)` }).from(pages).where(eq(pages.published, 0)).get()?.c ?? 0),
    products: count(products),
    publishedProducts: Number(db.select({ c: sql<number>`COUNT(*)` }).from(products).where(eq(products.published, 1)).get()?.c ?? 0),
    orders: count(orders),
    pendingOrders: Number(db.select({ c: sql<number>`COUNT(*)` }).from(orders).where(eq(orders.status, 'pending')).get()?.c ?? 0),
    customers: count(customers),
    quoteForms: count(quote_forms),
    quoteSubmissions: count(quote_submissions),
    newQuotes: Number(db.select({ c: sql<number>`COUNT(*)` }).from(quote_submissions).where(eq(quote_submissions.status, 'new')).get()?.c ?? 0),
  };
  res.json(stats);
});

router.get('/api/admin/dashboard/activity', requireAuth, (_req, res) => {
  const latestPages = db.select({ id: pages.id, title: pages.title, slug: pages.slug, published: pages.published, updated_at: pages.updated_at }).from(pages).orderBy(desc(pages.updated_at), desc(pages.id)).limit(5).all();
  const latestOrders = db.select({ id: orders.id, order_number: orders.order_number, customer_name: orders.customer_name, customer_email: orders.customer_email, total_cents: orders.total_cents, status: orders.status }).from(orders).orderBy(desc(orders.id)).limit(5).all();
  const latestQuotes = db
    .select({ id: quote_submissions.id, customer_name: quote_submissions.customer_name, customer_email: quote_submissions.customer_email, status: quote_submissions.status, form_title: quote_forms.title })
    .from(quote_submissions)
    .innerJoin(quote_forms, eq(quote_forms.id, quote_submissions.quote_form_id))
    .orderBy(desc(quote_submissions.id))
    .limit(5)
    .all();
  const activity: RecentActivity = {
    latestPages: latestPages.map(p => ({ ...p, updated_at: p.updated_at ?? '' })),
    latestOrders,
    latestQuotes,
  };
  res.json(activity);
});

export default router;

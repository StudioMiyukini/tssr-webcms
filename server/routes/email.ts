import { Router } from 'express';
import { z } from 'zod';
import { sql, desc } from 'drizzle-orm';
import { db } from '../db/client';
import { settings, email_logs } from '../db/schema';
import { requireAuth } from '../lib/auth';
import { parseBody, asyncHandler } from '../lib/http';
import { readEmailSettings, resetEmailCache, sendTransactionalEmail } from '../lib/email';

const router = Router();

const emailSchema = z.object({
  host: z.string().max(200).default(''),
  port: z.coerce.number().int().min(0).max(65535).default(587),
  user: z.string().max(200).default(''),
  pass: z.string().max(400).default(''),
  from: z.string().max(200).default(''),
  notifyTo: z.string().max(200).default(''),
  notifyOnForm: z.boolean().default(true),
  notifyOnQuote: z.boolean().default(true),
  notifyOnOrder: z.boolean().default(true),
  ackToSubmitter: z.boolean().default(false),
});

router.get('/api/admin/email', requireAuth, (_req, res) => { res.json(readEmailSettings()); });

router.put('/api/admin/email', requireAuth, (req, res) => {
  const data = parseBody(emailSchema, req.body);
  const value = JSON.stringify(data);
  db.insert(settings).values({ key: 'email', value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updated_at: sql`CURRENT_TIMESTAMP` } }).run();
  resetEmailCache();
  res.json(readEmailSettings());
});

router.get('/api/admin/email/logs', requireAuth, (_req, res) => {
  res.json(db.select({
    id: email_logs.id, recipient: email_logs.recipient, subject: email_logs.subject,
    event_type: email_logs.event_type, status: email_logs.status, error_message: email_logs.error_message, created_at: email_logs.created_at,
  }).from(email_logs).orderBy(desc(email_logs.id)).limit(100).all());
});

const testSchema = z.object({ to: z.string().email() });
router.post('/api/admin/email/test', requireAuth, asyncHandler(async (req, res) => {
  const { to } = parseBody(testSchema, req.body);
  const r = await sendTransactionalEmail({ to, subject: 'Test — CMS', html: '<h1>Email de test</h1><p>Si tu lis ceci, ta configuration SMTP fonctionne ✅.</p>', eventType: 'test' });
  res.json(r);
}));

export default router;

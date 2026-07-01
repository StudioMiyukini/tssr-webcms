import nodemailer from 'nodemailer';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { email_logs, settings } from '../db/schema';
import { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, ORDER_NOTIFY_TO } from '../env';
import { formatPriceEUR } from './utils';
import type { EmailSettings } from '../../shared/types';

const safe = (v: unknown): string => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const EMAIL_KEY = 'email';
let cache: EmailSettings | null = null;
let transport: nodemailer.Transporter | null = null;

/** Config email effective : réglages admin (table settings) par-dessus les variables d'env. */
export function readEmailSettings(): EmailSettings {
  if (cache) return cache;
  let stored: Partial<EmailSettings> = {};
  try {
    const row = db.select().from(settings).where(eq(settings.key, EMAIL_KEY)).get();
    if (row) stored = JSON.parse(row.value) as Partial<EmailSettings>;
  } catch { /* défauts env */ }
  cache = {
    host: typeof stored.host === 'string' ? stored.host : SMTP_HOST,
    port: Number.isFinite(stored.port) ? Number(stored.port) : SMTP_PORT,
    user: typeof stored.user === 'string' ? stored.user : SMTP_USER,
    pass: typeof stored.pass === 'string' ? stored.pass : SMTP_PASS,
    from: typeof stored.from === 'string' ? stored.from : SMTP_FROM,
    notifyTo: typeof stored.notifyTo === 'string' ? stored.notifyTo : ORDER_NOTIFY_TO,
    notifyOnForm: stored.notifyOnForm ?? true,
    notifyOnQuote: stored.notifyOnQuote ?? true,
    notifyOnOrder: stored.notifyOnOrder ?? true,
    ackToSubmitter: stored.ackToSubmitter ?? false,
  };
  return cache;
}

/** Invalide le cache et le transport (à appeler après modification des réglages). */
export function resetEmailCache(): void { cache = null; transport = null; }

function getTransport(cfg: EmailSettings): nodemailer.Transporter {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
    });
  }
  return transport;
}

export interface SendEmailArgs { to: string; subject: string; html: string; eventType?: string; }
export interface SendEmailResult { ok: boolean; skipped?: boolean; error?: unknown; }

export async function sendTransactionalEmail({ to, subject, html, eventType = 'generic' }: SendEmailArgs): Promise<SendEmailResult> {
  const cfg = readEmailSettings();
  const recipient = String(to || '').trim();
  const payload = JSON.stringify({ to: recipient, subject, htmlLength: html.length });
  if (!recipient) {
    db.insert(email_logs).values({ recipient: '', subject, event_type: eventType, status: 'skipped', error_message: 'destinataire manquant', payload_json: payload }).run();
    return { ok: false, skipped: true };
  }
  if (!(cfg.host && cfg.from)) {
    db.insert(email_logs).values({ recipient, subject, event_type: eventType, status: 'skipped', error_message: 'SMTP non configuré', payload_json: payload }).run();
    return { ok: false, skipped: true };
  }
  try {
    await getTransport(cfg).sendMail({ from: cfg.from, to: recipient, subject, html });
    db.insert(email_logs).values({ recipient, subject, event_type: eventType, status: 'sent', error_message: '', payload_json: payload }).run();
    return { ok: true };
  } catch (error) {
    db.insert(email_logs).values({ recipient, subject, event_type: eventType, status: 'error', error_message: String((error as Error)?.message || error), payload_json: payload }).run();
    return { ok: false, error };
  }
}

export function buildOrderEmailHtml(order: { order_number: string; total_cents: number }, items: Array<{ product_name: string; variant_label: string; quantity: number; line_total_cents: number }>): string {
  return `<h1>Commande ${safe(order.order_number)}</h1><p>Merci pour votre commande.</p><ul>${items.map((i) => `<li>${safe(i.product_name)}${i.variant_label ? ` — ${safe(i.variant_label)}` : ''} × ${safe(i.quantity)} : ${formatPriceEUR(i.line_total_cents)}</li>`).join('')}</ul><p>Total : <strong>${formatPriceEUR(order.total_cents)}</strong></p>`;
}

/** Tableau HTML clé/valeur générique (réutilisé pour les notifications de formulaire). */
export function buildKeyValuesEmailHtml(title: string, intro: string, rows: Array<{ label: string; value: string }>): string {
  return `<h1>${safe(title)}</h1>${intro ? `<p>${safe(intro)}</p>` : ''}<table style="border-collapse:collapse">${rows.map(r => `<tr><td style="padding:4px 10px 4px 0;color:#666;vertical-align:top"><strong>${safe(r.label)}</strong></td><td style="padding:4px 0">${safe(r.value)}</td></tr>`).join('')}</table>`;
}

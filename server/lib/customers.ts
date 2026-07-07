import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { customers } from '../db/schema';
import type { Customer } from '../db/schema';

export function getOrCreateCustomerByEmail({ name = '', email = '', phone = '', company = '', address = '' }: { name?: string; email?: string; phone?: string; company?: string; address?: string; } = {}): Customer | null {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;
  const existing = db.select().from(customers).where(eq(customers.email, normalizedEmail)).get();
  if (existing) {
    const updated = db.update(customers).set({
      name: name || existing.name || '',
      phone: phone || existing.phone || '',
      company: company || existing.company || '',
      address: address || existing.address || '',
      updated_at: sql`CURRENT_TIMESTAMP`,
    }).where(eq(customers.id, existing.id)).returning().get();
    return updated ?? existing;
  }
  const passwordHash = bcrypt.hashSync(Math.random().toString(36).slice(2) + Date.now().toString(36), 10);
  const inserted = db.insert(customers).values({
    name: name || normalizedEmail,
    email: normalizedEmail,
    password_hash: passwordHash,
    phone: phone || '',
    company: company || '',
    address: address || '',
  }).returning().get();
  return inserted ?? null;
}

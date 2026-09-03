/*
 * @id     tssr.libCustomers
 * @do     gerer_clients
 * @role   donnee
 * @layer  domaine
 * @human  Gestion des clients : recherche et création par e-mail.
 */
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { customers } from '../db/schema';
import type { Customer } from '../db/schema';

// Résout un client par email pour rattacher une commande. Renvoie aussi `created` :
// SÉCURITÉ — un checkout invité ne doit JAMAIS ouvrir de session sur un compte EXISTANT
// (l'email ne prouve pas l'identité → sinon prise de contrôle de compte). Les appelants
// n'ouvrent une session que si `created` est vrai (compte invité neuf, sans données).
/*
 * @id     tssr.libCustomers.getOrCreateCustomerByEmail
 * @do     trouver_ou_creer_client
 * @role   donnee
 * @layer  domaine
 * @human  Retrouve un client par e-mail ou le crée s'il n'existe pas.
 */
export function getOrCreateCustomerByEmail({ name = '', email = '', phone = '', company = '', address = '' }: { name?: string; email?: string; phone?: string; company?: string; address?: string; } = {}): { customer: Customer | null; created: boolean } {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return { customer: null, created: false };
  const existing = db.select().from(customers).where(eq(customers.email, normalizedEmail)).get();
  if (existing) {
    const updated = db.update(customers).set({
      name: name || existing.name || '',
      phone: phone || existing.phone || '',
      company: company || existing.company || '',
      address: address || existing.address || '',
      updated_at: sql`CURRENT_TIMESTAMP`,
    }).where(eq(customers.id, existing.id)).returning().get();
    return { customer: updated ?? existing, created: false };
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
  return { customer: inserted ?? null, created: !!inserted };
}

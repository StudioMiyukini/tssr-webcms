import type { Request, Response, NextFunction } from 'express';
import type { AdminSession, CustomerSession } from '../../shared/types';

declare module 'express-session' {
  interface SessionData {
    admin?: AdminSession;
    customer?: CustomerSession | null;
    siteUnlocked?: boolean; // visiteur ayant saisi le mot de passe du site privé
    cart?: Array<{ productId: number; quantity: number; variantKey: string }>;
    couponCode?: string;
    shippingMethodId?: number;
    pendingStripeCheckout?: {
      cart: Array<{ productId: number; quantity: number; variantKey: string }>;
      customer_name: string;
      customer_email: string;
      customer_phone: string;
      customer_company: string;
      shipping_address: string;
      notes: string;
      couponCode: string;
      shippingMethodId: number;
    } | null;
    pendingStripeSessionId?: string;
  }
}

export function isAuthed(req: Request): boolean {
  return Boolean(req.session?.admin);
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!isAuthed(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

export function isCustomerAuthed(req: Request): boolean {
  return Boolean(req.session?.customer);
}

export function requireCustomerAuth(req: Request, res: Response, next: NextFunction): void {
  if (!isCustomerAuthed(req)) {
    res.status(401).json({ error: 'Customer auth required' });
    return;
  }
  next();
}

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodError } from 'zod';

/** Erreur HTTP avec statut, à lever depuis n'importe quel handler (capturée par errorHandler). */
export class HttpError extends Error {
  status: number;
  fields?: Record<string, unknown>;
  constructor(status: number, message: string, fields?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export const badRequest = (message: string, fields?: Record<string, unknown>) => new HttpError(400, message, fields);
export const notFound = (message = 'Introuvable') => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);

/** Enrobe un handler async pour router toute exception vers le middleware d'erreur. */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => { Promise.resolve(fn(req, res, next)).catch(next); };
}

/** Valide le corps avec un schéma Zod, lève une 400 normalisée sinon. Retourne la donnée typée. */
export function parseBody<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: ZodError } }, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success) throw badRequest('Données invalides', r.error.flatten().fieldErrors);
  return r.data;
}

/** Parse un identifiant numérique de route, lève une 400 si invalide. */
export function parseId(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw badRequest('Identifiant invalide');
  return n;
}

/** Middleware d'erreur terminal : réponse JSON homogène `{ error, fields? }`. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) return;
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, ...(err.fields ? { fields: err.fields } : {}) });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Données invalides', fields: err.flatten().fieldErrors });
    return;
  }
  console.error('[webcms] erreur non gérée :', err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
}

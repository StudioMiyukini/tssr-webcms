/*
 * @id     tssr.libHttp
 * @do     outiller_http
 * @role   orchestration
 * @layer  outil
 * @human  Utilitaires HTTP : erreurs typées, validation et gestion des erreurs Express.
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodError } from 'zod';

/** Erreur HTTP avec statut, à lever depuis n'importe quel handler (capturée par errorHandler). */
/*
 * @id     tssr.libHttp.HttpError
 * @do     definir_erreur_http
 * @role   orchestration
 * @layer  outil
 * @human  Erreur HTTP typée avec code de statut et champs d'erreur.
 */
export class HttpError extends Error {
  status: number;
  fields?: Record<string, unknown>;
  constructor(status: number, message: string, fields?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

/*
 * @id     tssr.libHttp.badRequest
 * @do     creer_erreur_400
 * @role   orchestration
 * @layer  outil
 * @human  Fabrique une erreur HTTP 400 (requête invalide).
 */
export const badRequest = (message: string, fields?: Record<string, unknown>) => new HttpError(400, message, fields);
export const notFound = (message = 'Introuvable') => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);

/** Enrobe un handler async pour router toute exception vers le middleware d'erreur. */
/*
 * @id     tssr.libHttp.asyncHandler
 * @do     encapsuler_async
 * @role   orchestration
 * @layer  outil
 * @human  Encapsule un gestionnaire asynchrone pour propager les erreurs à Express.
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => { Promise.resolve(fn(req, res, next)).catch(next); };
}

/** Valide le corps avec un schéma Zod, lève une 400 normalisée sinon. Retourne la donnée typée. */
/*
 * @id     tssr.libHttp.parseBody
 * @do     valider_corps
 * @role   rule
 * @layer  outil
 * @human  Valide le corps d'une requête via un schéma et renvoie les données typées.
 */
export function parseBody<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: ZodError } }, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success) throw badRequest('Données invalides', r.error.flatten().fieldErrors);
  return r.data;
}

/** Parse un identifiant numérique de route, lève une 400 si invalide. */
/*
 * @id     tssr.libHttp.parseId
 * @do     valider_identifiant
 * @role   rule
 * @layer  outil
 * @human  Valide et convertit un identifiant d'URL en entier.
 */
export function parseId(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw badRequest('Identifiant invalide');
  return n;
}

/** Middleware d'erreur terminal : réponse JSON homogène `{ error, fields? }`. */
/*
 * @id     tssr.libHttp.errorHandler
 * @do     traiter_erreurs
 * @role   orchestration
 * @layer  outil
 * @human  Middleware final : transforme une erreur en réponse HTTP JSON.
 */
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

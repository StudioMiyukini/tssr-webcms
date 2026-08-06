import { Router, type RequestHandler, type Request } from 'express';
import { z } from 'zod';
import { and, eq, desc, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { atelier_projects } from '../db/schema';
import { isAuthed, isCustomerAuthed } from '../lib/auth';
import { parseBody, parseId, notFound } from '../lib/http';

const router = Router();

// Propriété « les deux » : un projet appartient soit à l'admin, soit à un compte client.
// L'identité courante est déduite de la session ; chacun ne voit et ne modifie que ses projets.
type Owner = { kind: 'admin' | 'customer'; id: number };
function ownerOf(req: Request): Owner | null {
  if (isCustomerAuthed(req)) return { kind: 'customer', id: req.session!.customer!.id };
  if (isAuthed(req)) return { kind: 'admin', id: req.session!.admin!.id };
  return null;
}
const requireOwner: RequestHandler = (req, res, next) => {
  const o = ownerOf(req);
  if (!o) { res.status(401).json({ error: 'Connecte-toi pour enregistrer un projet.' }); return; }
  (req as Request & { owner?: Owner }).owner = o;
  next();
};
const own = (req: Request): Owner => (req as Request & { owner?: Owner }).owner!;
const scope = (o: Owner) => and(eq(atelier_projects.owner_kind, o.kind), eq(atelier_projects.owner_id, o.id));
const safeParse = (s: string): unknown => { try { return JSON.parse(s || '{}'); } catch { return {}; } };

// Qui suis-je : le client sait s'il peut enregistrer (et sous quelle identité).
router.get('/api/atelier/me', (req, res) => {
  const o = ownerOf(req);
  if (!o) { res.json({ canSave: false }); return; }
  const name = o.kind === 'customer' ? req.session!.customer!.name : req.session!.admin!.username;
  res.json({ canSave: true, kind: o.kind, name });
});

// Liste (léger : sans le blob `data`).
router.get('/api/atelier/projects', requireOwner, (req, res) => {
  const rows = db.select({
    id: atelier_projects.id, name: atelier_projects.name,
    created_at: atelier_projects.created_at, updated_at: atelier_projects.updated_at,
  }).from(atelier_projects).where(scope(own(req))).orderBy(desc(atelier_projects.updated_at)).all();
  res.json(rows);
});

// Détail (avec `data` parsé).
router.get('/api/atelier/projects/:id', requireOwner, (req, res) => {
  const id = parseId(String(req.params.id));
  const rec = db.select().from(atelier_projects).where(and(eq(atelier_projects.id, id), scope(own(req)))).get();
  if (!rec) throw notFound('Projet introuvable');
  res.json({ id: rec.id, name: rec.name, data: safeParse(rec.data), created_at: rec.created_at, updated_at: rec.updated_at });
});

const dataSchema = z.record(z.any());
const createSchema = z.object({ name: z.string().min(1).max(120).optional().default('Projet réseau'), data: dataSchema.optional() });
const updateSchema = z.object({ name: z.string().min(1).max(120).optional(), data: dataSchema.optional() });

router.post('/api/atelier/projects', requireOwner, (req, res) => {
  const o = own(req);
  const body = parseBody(createSchema, req.body);
  const rec = db.insert(atelier_projects).values({
    owner_kind: o.kind, owner_id: o.id,
    name: body.name.trim() || 'Projet réseau', data: JSON.stringify(body.data ?? {}),
  }).returning().get();
  res.status(201).json({ id: rec.id, name: rec.name, data: safeParse(rec.data), created_at: rec.created_at, updated_at: rec.updated_at });
});

router.put('/api/atelier/projects/:id', requireOwner, (req, res) => {
  const id = parseId(String(req.params.id));
  const body = parseBody(updateSchema, req.body);
  const patch: Record<string, unknown> = { updated_at: sql`CURRENT_TIMESTAMP` };
  if (body.name !== undefined) patch.name = body.name.trim() || 'Projet réseau';
  if (body.data !== undefined) patch.data = JSON.stringify(body.data);
  const rec = db.update(atelier_projects).set(patch).where(and(eq(atelier_projects.id, id), scope(own(req)))).returning().get();
  if (!rec) throw notFound('Projet introuvable');
  res.json({ ok: true, id: rec.id, name: rec.name, updated_at: rec.updated_at });
});

router.delete('/api/atelier/projects/:id', requireOwner, (req, res) => {
  const id = parseId(String(req.params.id));
  const rec = db.delete(atelier_projects).where(and(eq(atelier_projects.id, id), scope(own(req)))).returning().get();
  if (!rec) throw notFound('Projet introuvable');
  res.json({ ok: true });
});

export default router;

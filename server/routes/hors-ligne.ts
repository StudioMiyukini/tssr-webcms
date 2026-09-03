import { Router, type Request, type Response } from 'express';
import fs from 'node:fs';
import { rateLimit } from '../lib/rate-limit';
import { archive, etat, type Genre } from '../lib/hors-ligne';

/* Le site à emporter, pour les visiteurs :
     GET /api/public/hors-ligne/infos   : l'archive est-elle proposée, et de quand date-t-elle ;
     GET /api/public/hors-ligne/site    : le site entier, exécutable sans Internet ;
     GET /api/public/hors-ligne/contenu : la base + les médias, ce que recharge le metteur à jour.
   Contenu public assaini (voir lib/hors-ligne) : aucun compte, aucune donnée personnelle.
   La première demande construit l'archive (une à la fois), les suivantes la relisent du cache. */

const router = Router();
// Une construction coûte ~30 s de CPU : on borne la casse sans gêner une classe entière.
const limiteur = rateLimit({ windowMs: 10 * 60 * 1000, max: 20, message: 'Trop de téléchargements. Réessaie dans quelques minutes.' });

/** L'adresse par laquelle le visiteur nous joint : filet de sécurité quand PUBLIC_BASE_URL
    n'a pas été renseigné, pour que le metteur à jour de l'archive sache où revenir. */
const origine = (req: Request): string => `${req.protocol}://${req.get('host') || ''}`;

router.get('/api/public/hors-ligne/infos', (req, res) => {
  res.json(etat(origine(req)));
});

function servir(genre: Genre) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const a = await archive(genre, origine(req));
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${a.nom}"`);
      res.setHeader('Content-Length', String(a.taille));
      res.setHeader('Cache-Control', 'no-store'); // l'archive suit le contenu du site
      const flux = fs.createReadStream(a.fichier);
      flux.on('error', () => { if (!res.headersSent) res.status(500).json({ error: 'Lecture de l’archive impossible.' }); else res.destroy(); });
      flux.pipe(res);
    } catch (e) {
      console.error('[hors-ligne] échec de la construction :', e);
      if (!res.headersSent) res.status(503).json({ error: 'Archive indisponible pour l’instant. Réessaie dans quelques minutes.' });
    }
  };
}

router.get('/api/public/hors-ligne/site', limiteur, servir('site'));
router.get('/api/public/hors-ligne/contenu', limiteur, servir('contenu'));

/*
 * @id     tssr.routeHorsLigne
 * @do     exposer_routes_hors_ligne
 * @role   orchestration
 * @layer  infra
 * @human  Routes publiques de téléchargement du site hors-ligne et de son contenu.
 */
export default router;

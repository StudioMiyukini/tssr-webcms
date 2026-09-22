import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { rawDb } from '../db/client';
import { rateLimit } from '../lib/rate-limit';

/* Les scripts des configurateurs, récupérables en ligne de commande.
     POST /api/public/scripts-partages  { nom, contenu }  ->  { id, url }
     GET  /s/:id                        le script, en texte brut

   Pourquoi : les VM du labo n'ont pas de navigateur, et coller trois cents
   lignes dans une console passe mal. Le configurateur dépose le script ici et
   affiche une ligne à taper :  curl -fsSL https://…/s/ABCDEFGH -o bdd.sh
   Un identifiant de 8 caractères (40 bits, imprononçable), une durée de vie
   de 7 jours, texte brut seulement : c'est un presse-papiers, pas un stockage. */

const router = Router();
const DUREE_MS = 7 * 24 * 3600 * 1000;
const TAILLE_MAX = 200 * 1024;
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // sans l, i, o, 0, 1 : se dicte au téléphone sans erreur

rawDb.exec(`CREATE TABLE IF NOT EXISTS scripts_partages (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  contenu TEXT NOT NULL,
  cree_le INTEGER NOT NULL,
  expire_le INTEGER NOT NULL
)`);

const limiteur = rateLimit({ windowMs: 10 * 60 * 1000, max: 40, message: 'Trop de scripts déposés. Réessaie dans quelques minutes.' });

function identifiant(): string {
  const octets = randomBytes(8);
  let s = '';
  for (let i = 0; i < 8; i++) s += ALPHABET[octets[i] % ALPHABET.length];
  return s;
}

router.post('/api/public/scripts-partages', limiteur, (req, res) => {
  const nom = String(req.body?.nom || '').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 80) || 'script.sh';
  const contenu = typeof req.body?.contenu === 'string' ? req.body.contenu : '';
  if (!contenu.trim()) { res.status(400).json({ error: 'Script vide.' }); return; }
  if (Buffer.byteLength(contenu, 'utf8') > TAILLE_MAX) { res.status(413).json({ error: 'Script trop long (200 Ko max).' }); return; }
  const maintenant = Date.now();
  rawDb.prepare('DELETE FROM scripts_partages WHERE expire_le < ?').run(maintenant);
  let id = identifiant();
  const insere = rawDb.prepare('INSERT INTO scripts_partages (id, nom, contenu, cree_le, expire_le) VALUES (?, ?, ?, ?, ?)');
  for (let essai = 0; essai < 5; essai++) {
    try { insere.run(id, nom, contenu, maintenant, maintenant + DUREE_MS); break; } catch { id = identifiant(); }
  }
  // L'adresse complete est composee par la page (window.location.origin) : elle sait par ou le visiteur est venu.
  res.json({ id, chemin: `/s/${id}`, expire_le: maintenant + DUREE_MS });
});

router.get('/s/:id', (req, res) => {
  const id = String(req.params.id || '').toLowerCase();
  if (!/^[a-z2-9]{8}$/.test(id)) { res.status(404).type('text/plain').send('Identifiant invalide.\n'); return; }
  const ligne = rawDb.prepare('SELECT nom, contenu, expire_le FROM scripts_partages WHERE id = ?').get(id) as { nom: string; contenu: string; expire_le: number } | undefined;
  if (!ligne || ligne.expire_le < Date.now()) { res.status(404).type('text/plain').send('Script inconnu ou expiré : regénère-le depuis le configurateur.\n'); return; }
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="${ligne.nom}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(ligne.contenu.replace(/\r\n/g, '\n'));
});

/*
 * @id     tssr.routeScriptsPartages
 * @do     partager_scripts_configurateurs
 * @role   orchestration
 * @layer  infra
 * @human  Dépôt éphémère des scripts générés, servis en texte brut pour curl/wget.
 */
export default router;

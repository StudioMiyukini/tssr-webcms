import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { ROOT_DIR, DB_PATH, UPLOADS_DIR, PUBLIC_BASE_URL } from '../env';

/* Prépare les archives « site hors-ligne » proposées aux visiteurs :
     - contenu : la base + les médias, ce que recharge le metteur à jour de l'archive ;
     - site    : le site entier, exécutable sans Internet (serveur bundlé + front + contenu).
   La base embarquée est ASSAINIE — le contenu pédagogique seul, sans les comptes,
   sessions, commandes ni écrits des membres : ces archives sont publiques.
   Construction paresseuse, mise en cache dans export/hors-ligne/, refaite quand
   la base ou le front ont bougé. */
/*
 * @id     tssr.libHorsLigne
 * @do     preparer_archives_hors_ligne
 * @role   service
 * @layer  domaine
 * @human  Fabrique les archives du site hors-ligne (base assainie, cache, compression).
 */

const pexec = promisify(execFile);
const PS = ['-NoProfile', '-NonInteractive', '-Command'];

const CACHE_DIR = path.join(ROOT_DIR, 'export', 'hors-ligne');
const DIST_INDEX = path.join(ROOT_DIR, 'dist', 'client', 'index.html');
const BUILD_PORTABLE = path.join(ROOT_DIR, 'scripts', 'build-portable.mjs');
// Change de valeur quand la composition des archives change → invalide les caches en place.
const FORMAT = 2;

export type Genre = 'contenu' | 'site';
export type Archive = { fichier: string; taille: number; genereLe: string; nom: string };

/** Tables vidées de la copie publique : comptes, sessions, écrits et données personnelles. */
const TABLES_VIDEES = [
  'admins', 'sessions', 'customers', 'orders', 'order_items',
  'quote_submissions', 'form_submissions', 'comments', 'email_logs', 'campaigns',
  'forum_topics', 'forum_replies', 'atelier_projects', 'user_files',
];
/** Réglages retirés : mot de passe du site privé, identifiants SMTP/Stripe, jetons. */
const REGLAGE_SENSIBLE = /secret|token|password|hash|smtp|stripe|^email$/i;

/** Le poste qui sert le site sait-il fabriquer ces archives ? (une copie portable, non.) */
export function disponible(): boolean {
  return fs.existsSync(BUILD_PORTABLE)
    && fs.existsSync(path.join(ROOT_DIR, 'node_modules', 'esbuild'))
    && fs.existsSync(DIST_INDEX);
}

/** Adresse que le metteur à jour de l'archive ira interroger.
    PUBLIC_BASE_URL fait foi ; s'il n'a pas été renseigné (il vaut alors example.com),
    on retient l'adresse par laquelle le visiteur nous parle — sans quoi l'archive
    partirait avec un metteur à jour pointant dans le vide. */
function source(origine?: string): string {
  const base = PUBLIC_BASE_URL.replace(/\/+$/, '');
  if (base && !/(^|\/\/)(www\.)?example\.com/i.test(base)) return base;
  return (origine || base).replace(/\/+$/, '');
}

/** Empreinte de l'état du site : si elle change, les archives en cache sont périmées.
    Le journal WAL en fait partie : en mode WAL les écritures y vont d'abord, et la
    date du fichier principal ne bouge qu'au point de reprise — s'y fier seul,
    c'est servir une archive d'hier en croyant qu'elle est fraîche. */
function empreinte(origine?: string): string {
  const db = fs.statSync(DB_PATH);
  let wal = '0';
  try { const w = fs.statSync(`${DB_PATH}-wal`); wal = `${w.mtimeMs}:${w.size}`; } catch { /* pas de WAL */ }
  const dist = fs.existsSync(DIST_INDEX) ? fs.statSync(DIST_INDEX).mtimeMs : 0;
  return `${FORMAT}:${db.mtimeMs}:${db.size}:${wal}:${dist}:${source(origine)}`;
}

/** Copie consistante de la base (WAL replié), puis purge de tout ce qui n'est pas du contenu. */
async function assainir(vers: string): Promise<void> {
  const src = new Database(DB_PATH, { readonly: true });
  try { await src.backup(vers); } finally { src.close(); }

  const db = new Database(vers);
  try {
    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name as string));
    db.pragma('foreign_keys = OFF');
    for (const t of TABLES_VIDEES) if (tables.has(t)) db.exec(`DELETE FROM "${t}"`);
    if (tables.has('settings')) {
      const cles = db.prepare('SELECT key FROM settings').all().map((r: any) => r.key as string);
      const del = db.prepare('DELETE FROM settings WHERE key = ?');
      for (const k of cles) if (REGLAGE_SENSIBLE.test(k)) del.run(k);
    }
    db.exec('VACUUM'); // récupère la place et, surtout, ne laisse pas les pages effacées dans le fichier
  } finally { db.close(); }
}

/** Compression d'un dossier en .zip, sans dépendance : PowerShell sous Windows, zip ailleurs. */
async function compresser(dossier: string, zip: string): Promise<void> {
  fs.rmSync(zip, { force: true });
  if (process.platform === 'win32') {
    await pexec('powershell', [...PS, `Compress-Archive -Path '${dossier}\\*' -DestinationPath '${zip}' -Force`], { maxBuffer: 1 << 24 });
  } else {
    await pexec('zip', ['-r', '-q', zip, '.'], { cwd: dossier, maxBuffer: 1 << 24 });
  }
  if (!fs.existsSync(zip)) throw new Error('archive non produite');
}

async function batir(genre: Genre, zip: string, origine?: string): Promise<void> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hors-ligne-'));
  try {
    const base = path.join(tmp, 'cms.sqlite');
    await assainir(base);

    if (genre === 'contenu') {
      const stage = path.join(tmp, 'contenu');
      fs.mkdirSync(stage, { recursive: true });
      fs.renameSync(base, path.join(stage, 'cms.sqlite'));
      if (fs.existsSync(UPLOADS_DIR)) fs.cpSync(UPLOADS_DIR, path.join(stage, 'uploads'), { recursive: true });
      await compresser(stage, zip);
    } else {
      const stage = path.join(tmp, 'site');
      await pexec(process.execPath, [BUILD_PORTABLE], {
        cwd: ROOT_DIR,
        maxBuffer: 1 << 24,
        env: { ...process.env, PORTABLE_OUT: stage, PORTABLE_DB: base, PORTABLE_SOURCE_URL: source(origine) },
      });
      await compresser(stage, zip);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const enCours = new Map<Genre, Promise<Archive>>();

function nomFichier(genre: Genre): string {
  const jour = new Date().toISOString().slice(0, 10);
  return genre === 'site' ? `tssr-site-hors-ligne-${jour}.zip` : `tssr-contenu-${jour}.zip`;
}

function lireCache(genre: Genre, origine?: string): Archive | null {
  const zip = path.join(CACHE_DIR, `${genre}.zip`);
  const meta = path.join(CACHE_DIR, `${genre}.json`);
  if (!fs.existsSync(zip) || !fs.existsSync(meta)) return null;
  try {
    const m = JSON.parse(fs.readFileSync(meta, 'utf8')) as { empreinte: string; genereLe: string };
    if (m.empreinte !== empreinte(origine)) return null;
    return { fichier: zip, taille: fs.statSync(zip).size, genereLe: m.genereLe, nom: nomFichier(genre) };
  } catch { return null; }
}

/** L'archive demandée, du cache si elle est à jour, construite sinon. Une seule construction à la fois. */
export function archive(genre: Genre, origine?: string): Promise<Archive> {
  const prete = lireCache(genre, origine);
  if (prete) return Promise.resolve(prete);

  const dejaLancee = enCours.get(genre);
  if (dejaLancee) return dejaLancee;

  const travail = (async () => {
    if (!disponible()) throw new Error('Ce serveur ne peut pas fabriquer l’archive hors-ligne.');
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const marque = empreinte(origine); // relevée AVANT le travail : une écriture pendant la construction refera l'archive
    const zip = path.join(CACHE_DIR, `${genre}.zip`);
    // L'extension doit rester .zip : Compress-Archive refuse toute autre.
    const provisoire = path.join(CACHE_DIR, `${genre}.${process.pid}.tmp.zip`);
    await batir(genre, provisoire, origine);
    fs.rmSync(zip, { force: true });
    fs.renameSync(provisoire, zip);
    const genereLe = new Date().toISOString();
    fs.writeFileSync(path.join(CACHE_DIR, `${genre}.json`), JSON.stringify({ empreinte: marque, genereLe }, null, 2));
    return { fichier: zip, taille: fs.statSync(zip).size, genereLe, nom: nomFichier(genre) };
  })().finally(() => enCours.delete(genre));

  enCours.set(genre, travail);
  return travail;
}

/* ---- Publication sur GitHub ----
   Servir 31 Mo par le tunnel Cloudflare prend deux bonnes minutes, et faire
   fabriquer l'archive a chaque demande n'a pas de sens : le contenu ne change
   pas d'une visite a l'autre. Une tache quotidienne (voir
   scripts/publier-hors-ligne.mts) construit les archives et les depose sur une
   release GitHub, dont le CDN sert les eleves. Le serveur ne fait plus que
   rediriger — et ne construit qu'a defaut de publication. */

export type Publication = {
  empreinte: string;
  genereLe: string;
  site: { url: string; taille: number };
  contenu: { url: string; taille: number };
};

const MANIFESTE = path.join(CACHE_DIR, 'publication.json');

/** La derniere publication connue, ou null si rien n'a encore ete depose. */
export function publication(): Publication | null {
  try {
    const p = JSON.parse(fs.readFileSync(MANIFESTE, 'utf8')) as Publication;
    return p?.site?.url && p?.contenu?.url ? p : null;
  } catch { return null; }
}

export function ecrirePublication(p: Publication): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(MANIFESTE, JSON.stringify(p, null, 2));
}

/** État affiché par le site public (sans rien construire). */
export function etat(origine?: string): { disponible: boolean; pret: boolean; taille: number; genereLe: string | null; url: string | null } {
  const pub = publication();
  if (pub) return { disponible: true, pret: true, taille: pub.site.taille, genereLe: pub.genereLe, url: pub.site.url };
  // Rien de publie : on retombe sur la fabrication a la demande.
  const cache = disponible() ? lireCache('site', origine) : null;
  return {
    disponible: disponible(),
    pret: cache !== null,
    taille: cache?.taille ?? 0,
    genereLe: cache?.genereLe ?? null,
    url: null,
  };
}

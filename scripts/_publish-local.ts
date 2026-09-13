/* Publication DIRECTE dans cms.sqlite, sans passer par l'API.

   POURQUOI PAS L'API
   Les seeders historiques se connectent en `admin` / ADMIN_PW. En production, le compte
   admin ne porte pas le mot de passe de l'environnement (« sans effet si le compte existe
   déjà ») : login 401 systématique. Les scripts Python du dépôt écrivent déjà directement
   dans la base ; ce module fait pareil depuis TypeScript, pour réutiliser page-blocks et
   les gabarits de rendu (quiz, hub Exercices) sans les réécrire.

   Le cache public du serveur a un TTL court : pas besoin de le vider, les pages
   apparaissent d'elles-mêmes.

   Usage : import { upsertPage, appendNote, closeDb } from './_publish-local'; */
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizePageBlocks, serializePageBlocks, renderPageBlocksToHtml, makePageBlock, type PageBlock } from '../client/src/lib/page-blocks';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DB_PATH = process.env.CMS_DB || path.join(__dirname, '..', 'cms.sqlite');

let db: Database.Database | null = null;
function open(): Database.Database {
  if (!db) { db = new Database(DB_PATH); db.pragma('journal_mode = WAL'); }
  return db;
}
export function closeDb(): void { if (db) { db.close(); db = null; } }

const now = () => new Date().toISOString();

export type PageUpsert = { slug: string; title: string; excerpt: string; blocks: PageBlock[] };

/** Crée ou met à jour une page à partir de ses blocs (content + builder_json cohérents). */
export function upsertPage(p: PageUpsert): 'creation' | 'maj' {
  const d = open();
  const content = renderPageBlocksToHtml(p.blocks);
  const builder_json = serializePageBlocks(p.blocks);
  const cur = d.prepare('SELECT id FROM pages WHERE slug = ?').get(p.slug) as { id: number } | undefined;
  if (cur) {
    d.prepare('UPDATE pages SET title=?, excerpt=?, content=?, builder_json=?, published=1, updated_at=? WHERE id=?')
      .run(p.title, p.excerpt, content, builder_json, now(), cur.id);
    return 'maj';
  }
  d.prepare('INSERT INTO pages (title, slug, content, excerpt, builder_json, published, created_at, updated_at) VALUES (?,?,?,?,?,1,?,?)')
    .run(p.title, p.slug, content, p.excerpt, builder_json, now(), now());
  return 'creation';
}

export function readPage(slug: string): { id: number; title: string; content: string; builder_json: string } | undefined {
  return open().prepare('SELECT id, title, content, builder_json FROM pages WHERE slug = ?').get(slug) as any;
}

export function pageExists(slug: string): boolean { return !!readPage(slug); }

/** Ajoute un encadré en fin de page si un marqueur (un href, typiquement) n'y figure pas déjà.
    Le HTML est ajouté au `content` ET, si la page a un builder_json, comme bloc « HTML brut »,
    pour que l'éditeur ne perde pas l'encadré à la prochaine sauvegarde. Idempotent. */
export function appendNote(slug: string, marker: string, html: string): 'ajoute' | 'deja' | 'absent' {
  const d = open();
  const p = readPage(slug);
  if (!p) return 'absent';
  if (p.content.includes(marker)) return 'deja';
  const content = p.content + '\n' + html;
  let builder_json = p.builder_json;
  if (builder_json && builder_json.trim()) {
    const blocks = normalizePageBlocks(builder_json);
    blocks.push(Object.assign(makePageBlock('html'), { html }));
    builder_json = serializePageBlocks(blocks);
  }
  d.prepare('UPDATE pages SET content=?, builder_json=?, updated_at=? WHERE id=?').run(content, builder_json, now(), p.id);
  return 'ajoute';
}

export function listSlugs(): string[] {
  return (open().prepare('SELECT slug FROM pages WHERE published = 1').all() as Array<{ slug: string }>).map(r => r.slug);
}

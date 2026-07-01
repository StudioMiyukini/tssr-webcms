/* Lit tous les JSON de scripts/quiz-data/, crée une page quiz par cours (slug 'quiz-<slug>')
   et alimente la catégorie « Quiz » du hub Exercices. Idempotent.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-quiz.ts */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPageBlocksToHtml, serializePageBlocks } from '../client/src/lib/page-blocks';
import { buildQuizPage, validateQuizData, type QuizData } from './_quiz';
import { EX_CATEGORIES, buildExercicesHub } from './_exercices-hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'quiz-data');

// Ordre d'affichage dans le hub (domaines)
const ORDER = [
  'hardware', 'les-form-factor', 'carte-mere', 'ports-arriere-carte-mere', 'le-chipset', 'le-processeur', 'le-raid',
  'histoire-de-windows', 'le-systeme-exploitation', 'demarrage-bios-uefi', 'systemes-de-fichiers', 'msconfig-configuration-systeme',
  'gestion-ordinateur-windows', 'base-de-registre', 'cmd-et-powershell', 'windows-server', 'roles-windows-server', 'gestionnaire-de-serveurs', 'virtualisation',
  'le-routeur', 'le-switch', 'le-pare-feu', 'tcp-et-udp', 'schemas-infrastructure', 'reseau-entreprise', 'tp1-presentation-cybercafe',
  'les-7-couches-osi', 'le-ticketing',
];
const ord = (s: string) => { const i = ORDER.indexOf(s); return i < 0 ? 999 : i; };

function cookieFrom(res: Response): string {
  const sc = (res.headers as any).getSetCookie?.() as string[] | undefined;
  return (sc && sc.length ? sc : [res.headers.get('set-cookie') || '']).map(c => c.split(';')[0]).filter(Boolean).join('; ');
}

function loadData(): QuizData[] {
  if (!fs.existsSync(DATA_DIR)) throw new Error(`Dossier introuvable : ${DATA_DIR}`);
  const out: QuizData[] = [];
  for (const f of fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'))) {
    const raw = fs.readFileSync(path.join(DATA_DIR, f), 'utf8').replace(/^﻿/, '').replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
    let d: any;
    try { d = JSON.parse(raw); } catch (e) { console.error(`✗ ${f}: JSON invalide —`, (e as Error).message); continue; }
    const errs = validateQuizData(d);
    if (errs.length) { console.error(`✗ ${f}: ${errs.slice(0, 3).join(' ; ')}${errs.length > 3 ? ` (+${errs.length - 3})` : ''}`); continue; }
    out.push(d as QuizData);
  }
  return out.sort((a, b) => ord(a.slug) - ord(b.slug));
}

async function main() {
  const data = loadData();
  const totalQ = data.reduce((n, d) => n + d.quizzes.reduce((m, q) => m + q.questions.length, 0), 0);
  console.log(`Données : ${data.length} cours, ${totalQ} questions.`);
  if (!data.length) throw new Error('Aucune donnée de quiz valide.');

  const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: PW }) });
  if (!login.ok) throw new Error(`login ${login.status}`);
  const cookie = cookieFrom(login);
  const h = { 'Content-Type': 'application/json', Cookie: cookie };
  const pages = await (await fetch(`${BASE}/api/admin/pages`, { headers: { Cookie: cookie } })).json() as Array<{ id: number; slug: string }>;

  const quizCat = EX_CATEGORIES.find(c => c.name === 'Quiz')!;
  quizCat.items = [];

  for (const d of data) {
    const slug = `quiz-${d.slug}`;
    const qCount = d.quizzes.reduce((m, q) => m + q.questions.length, 0);
    const blocks = buildQuizPage(d);
    const body = JSON.stringify({ title: `Quiz — ${d.title}`, slug, excerpt: `${d.quizzes.length} quiz (${qCount} questions) pour réviser « ${d.title} ».`, content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1 });
    const cur = pages.find(p => p.slug === slug);
    const r = cur
      ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body })
      : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
    console.log(`PAGE ${slug}`, r.status, cur ? '(maj)' : '(créée)', r.ok ? '' : await r.text());
    quizCat.items.push({ href: `/pages/${slug}`, title: d.title, desc: `${d.quizzes.length} quiz · ${qCount} questions` });
  }

  // Reconstruit le hub Exercices avec la catégorie Quiz remplie
  const cours = pages.find(p => p.slug === 'exercices');
  const hub = buildExercicesHub();
  if (cours) {
    const r = await fetch(`${BASE}/api/admin/pages/${cours.id}`, { method: 'PUT', headers: h, body: JSON.stringify({ title: 'Exercices', slug: 'exercices', excerpt: 'Teste et consolide tes connaissances : quiz, exercices et jeux.', content: renderPageBlocksToHtml(hub), builder_json: serializePageBlocks(hub), published: 1 }) });
    console.log('HUB Exercices', r.status, r.ok ? '(maj)' : await r.text());
  } else console.log('HUB Exercices introuvable');

  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

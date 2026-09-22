/* Publie, DIRECTEMENT dans cms.sqlite, toutes les activités du site :
     1. un quiz par cours (scripts/quiz-data/<slug>.json → page quiz-<slug>) ;
     2. les jeux « image + 4 choix » par domaine (_jeux-reseau.ts, _jeux-systemes.ts) ;
     3. le hub Exercices, reconstruit depuis _exercices-hub.ts ;
     4. un encadré « Teste-toi » en fin de chaque cours, vers son quiz et le jeu de son domaine.

   Remplace seed-quiz.ts (qui passe par l'API et échoue au login en production).
   Idempotent : relancer met à jour les pages, ne duplique ni cartes ni encadrés.

   Usage : npx tsx scripts/seed-activites-local.ts            (base : ../cms.sqlite)
           CMS_DB=/chemin/cms.sqlite npx tsx scripts/seed-activites-local.ts */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildQuizPage, validateQuizData, type QuizData } from './_quiz';
import { EX_CATEGORIES, QUIZ_DOMAINS, buildExercicesHub } from './_exercices-hub';
import { buildGamePage, type Game } from './_jeu-image';
import { JEU_SCHEMA, JEU_VLAN, JEU_OPNSENSE, JEU_DMZ, JEU_WIRESHARK } from './_jeux-reseau';
import { JEU_LINUX_CMD, JEU_LINUX_DROITS, JEU_IP, JEU_CISCO, JEU_WINDOWS } from './_jeux-systemes';
import { upsertPage, appendNote, pageExists, closeDb, DB_PATH } from './_publish-local';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'quiz-data');

const GAMES: Game[] = [JEU_SCHEMA, JEU_VLAN, JEU_OPNSENSE, JEU_DMZ, JEU_WIRESHARK, JEU_LINUX_CMD, JEU_LINUX_DROITS, JEU_IP, JEU_CISCO, JEU_WINDOWS];

// Le jeu qui va avec chaque cours, pour l'encadré de fin de page.
const JEU_DU_COURS: Array<[RegExp, string, string]> = [
  [/^(dmz|dmz-mise-en-place|dmz-surveillance-entretien)$/, 'jeu-dmz-flux', 'DMZ : autorisé ou bloqué ?'],
  [/^(le-pare-feu|schemas-infrastructure|bases-du-reseau|notions-complementaires|reseau-entreprise|le-routeur|le-switch)$/, 'jeu-lire-schema-reseau', 'Lis le schéma réseau'],
  [/^(les-vlan|vlan-securite|vlan-vtp|vlan-voix)$/, 'jeu-vlan-ports', 'VLAN : quel port, quel mode ?'],
  [/^opnsense/, 'jeu-opnsense-regles', 'OPNsense : la règle qui manque'],
  [/^(le-wireshark|tcp-et-udp|la-messagerie|le-ssh|radius-8021x|le-vpn|les-7-couches-osi)$/, 'jeu-lire-capture', 'Lis la capture'],
  [/^(linux-droits|linux-acl)$/, 'jeu-linux-droits', 'Lis les droits'],
  [/^linux-/, 'jeu-linux-commande', 'Linux : la bonne commande'],
  [/^(adresses-ip|ip-et-binaire|calcul-ip-masque|segmentation-sous-reseaux|trouver-plage-ip-cidr|adresses-mac)$/, 'jeu-adressage-ip', 'Adressage IP : même réseau ?'],
  [/^cisco-/, 'jeu-cisco-erreur', 'Cisco : où est l’erreur ?'],
  [/^(vocabulaire-active-directory|administration-domaine-ad|cours-gpo|permissions-partage-ntfs|gestion-avancee-utilisateurs|lecteurs-reseau|profils-itinerants|astuce-pare-feu-ping|astuce-bureau-a-distance|hebergement-web|windows-server|roles-windows-server|gestionnaire-de-serveurs)$/, 'jeu-windows-ad', 'Windows & AD : quel outil, quelle étape ?'],
];

const order = new Map<string, number>();
QUIZ_DOMAINS.forEach(([, slugs]) => slugs.forEach(s => order.set(s, order.size)));
const ord = (s: string) => order.get(s) ?? 999;

function loadData(): QuizData[] {
  const out: QuizData[] = [];
  for (const f of fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'))) {
    const raw = fs.readFileSync(path.join(DATA_DIR, f), 'utf8').replace(/^﻿/, '');
    let d: any;
    try { d = JSON.parse(raw); } catch (e) { console.error(`✗ ${f}: JSON invalide —`, (e as Error).message); continue; }
    const errs = validateQuizData(d);
    if (errs.length) { console.error(`✗ ${f}: ${errs.slice(0, 3).join(' ; ')}`); continue; }
    out.push(d as QuizData);
  }
  return out.sort((a, b) => ord(a.slug) - ord(b.slug) || a.slug.localeCompare(b.slug));
}

const esc = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function main() {
  console.log('Base :', DB_PATH);
  const data = loadData();
  const totalQ = data.reduce((n, d) => n + d.quizzes.reduce((m, q) => m + q.questions.length, 0), 0);
  console.log(`Quiz : ${data.length} cours, ${totalQ} questions.`);

  // 1. Les pages quiz
  const quizCat = EX_CATEGORIES.find(c => c.name === 'Quiz')!;
  quizCat.items = [];
  const stats = { creation: 0, maj: 0 };
  for (const d of data) {
    if (!pageExists(d.slug)) console.warn(`  ! cours introuvable pour ${d.slug} (quiz publié quand même)`);
    const qCount = d.quizzes.reduce((m, q) => m + q.questions.length, 0);
    const etat = upsertPage({ slug: `quiz-${d.slug}`, title: `Quiz — ${d.title}`, excerpt: `${d.quizzes.length} quiz (${qCount} questions) pour réviser « ${d.title} ».`, blocks: buildQuizPage(d) });
    stats[etat]++;
    quizCat.items.push({ href: `/pages/quiz-${d.slug}`, title: d.title, desc: `${d.quizzes.length} quiz · ${qCount} questions` });
  }
  console.log(`  pages quiz : ${stats.creation} créées, ${stats.maj} mises à jour`);

  // 2. Les jeux
  for (const g of GAMES) {
    const etat = upsertPage({ slug: g.slug, title: g.title, excerpt: g.desc, blocks: buildGamePage(g) });
    console.log(`  jeu ${g.slug} : ${etat} (${g.slides.length} questions)`);
  }

  // 3. Le hub
  const hub = buildExercicesHub();
  const total = EX_CATEGORIES.reduce((n, c) => n + c.items.length, 0);
  upsertPage({ slug: 'exercices', title: 'Exercices', excerpt: `Teste et consolide tes connaissances : ${total} activités — quiz, exercices et jeux.`, blocks: hub });
  console.log(`  hub Exercices : ${total} activités`);

  // 4. Les encadrés « Teste-toi » en fin de cours
  const notes = { ajoute: 0, deja: 0, absent: 0 };
  for (const d of data) {
    const jeu = JEU_DU_COURS.find(([re]) => re.test(d.slug));
    const lienJeu = jeu ? ` Et pour s’entraîner autrement : <a href="/pages/${jeu[1]}"><strong>${esc(jeu[2])}</strong></a>.` : '';
    const html = `<aside class="pb-note pb-note-green"><p class="pb-note-title">🎯 Teste-toi</p><p>Trois quiz corrigés sur ce cours : <a href="/pages/quiz-${d.slug}"><strong>Quiz — ${esc(d.title)}</strong></a>.${lienJeu} Toutes les activités : <a href="/pages/exercices">Exercices</a>.</p></aside>`;
    const r = appendNote(d.slug, `href="/pages/quiz-${d.slug}"`, html);
    notes[r]++;
  }
  console.log(`  encadrés « Teste-toi » : ${notes.ajoute} ajoutés, ${notes.deja} déjà présents, ${notes.absent} cours absents`);
  closeDb();
}

main();

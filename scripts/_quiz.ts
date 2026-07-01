/* Moteur de rendu des quiz INTERACTIFS (CSS pur, sans JS → compatible CSP).
   L'élève coche ses réponses (cases à cocher), puis clique « Afficher les réponses » en bas
   du quiz : la correction apparaît sous chaque question (bonne réponse en vert, erreurs en rouge).
   Repose sur le sélecteur CSS :has() (support universel des navigateurs en 2026).
   Données : un fichier JSON par cours dans scripts/quiz-data/<slug>.json
   { slug, title, quizzes: [ { title, questions: [ { q, options:[..], answer:<index> (ou answers:[..]), explain } x15 ] } x3 ] } */
import { makePageBlock, type PageBlock } from '../client/src/lib/page-blocks';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);

export type QQ = { q: string; options: string[]; answer?: number; answers?: number[]; explain: string };
export type Quiz = { title: string; questions: QQ[] };
export type QuizData = { slug: string; title: string; quizzes: Quiz[] };

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const letter = (i: number) => String.fromCharCode(65 + i); // 0->A
const correctOf = (qq: QQ): number[] => Array.isArray(qq.answers) && qq.answers.length ? qq.answers : [qq.answer ?? 0];

// Feuille de style (émise une fois par page). Tout est préfixé .qz- pour ne rien casser ailleurs.
export const QUIZ_STYLE = `<style>
.qz-quiz{margin:6px 0 18px}
.qz-q{margin:10px 0;padding:12px 14px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2)}
.qz-stem{font-weight:600;margin:0 0 8px}
.qz-opt{display:flex;align-items:flex-start;gap:8px;padding:7px 10px;border:1px solid var(--border);border-radius:8px;margin:5px 0;cursor:pointer;background:var(--surface)}
.qz-opt input{margin-top:3px;flex:none}
.qz-opt span{flex:1}
.qz-correction{display:none;margin-top:8px;padding:8px 10px;border-left:3px solid #16a34a;background:rgba(22,163,74,.08);border-radius:6px;font-size:14px}
.qz-reveal-input{position:absolute;opacity:0;width:0;height:0;pointer-events:none}
.qz-reveal-btn{display:inline-flex;align-items:center;margin:8px 0 2px;padding:9px 16px;background:#2563eb;color:#fff;border-radius:8px;cursor:pointer;font-weight:600;user-select:none}
.qz-reveal-btn::before{content:"Afficher les réponses ↓"}
.qz-quiz:has(.qz-reveal-input:checked) .qz-reveal-btn::before{content:"Masquer les réponses ↑"}
.qz-quiz:has(.qz-reveal-input:checked) .qz-correction{display:block}
.qz-quiz:has(.qz-reveal-input:checked) .qz-opt.qz-ok{background:rgba(22,163,74,.14);border-color:#16a34a}
.qz-quiz:has(.qz-reveal-input:checked) .qz-opt.qz-ok::after{content:"✓ bonne réponse";margin-left:auto;color:#16a34a;font-weight:700;white-space:nowrap}
.qz-quiz:has(.qz-reveal-input:checked) .qz-opt:has(input:checked):not(.qz-ok){background:rgba(220,38,38,.10);border-color:#dc2626}
.qz-quiz:has(.qz-reveal-input:checked) .qz-opt:has(input:checked):not(.qz-ok)::after{content:"✗";margin-left:auto;color:#dc2626;font-weight:700}
</style>`;

function renderQuestion(n: number, qq: QQ): string {
  const correct = new Set(correctOf(qq));
  const opts = qq.options.map((o, i) =>
    `<label class="qz-opt${correct.has(i) ? ' qz-ok' : ''}"><input type="checkbox"><span>${letter(i)}) ${esc(o)}</span></label>`).join('');
  const letters = [...correct].sort((a, b) => a - b).map(letter).join(', ');
  return `<div class="qz-q"><p class="qz-stem">${n}. ${esc(qq.q)}</p>${opts}`
    + `<div class="qz-correction"><strong>✅ Réponse : ${letters}</strong> — ${esc(qq.explain)}</div></div>`;
}

/** Rend un quiz interactif (titre + questions + bouton « Afficher les réponses »). */
export function renderQuiz(quiz: Quiz): PageBlock[] {
  const body = quiz.questions.map((q, i) => renderQuestion(i + 1, q)).join('')
    + `<label class="qz-reveal-btn"><input type="checkbox" class="qz-reveal-input"></label>`;
  return [
    block('heading', { level: 2, text: quiz.title }),
    block('html', { html: `<div class="qz-quiz">${body}</div>` }),
  ];
}

/** Construit la page quiz complète d'un cours (style + hero + lien cours + les 3 quiz). */
export function buildQuizPage(data: QuizData): PageBlock[] {
  const totalQ = data.quizzes.reduce((n, q) => n + q.questions.length, 0);
  const blocks: PageBlock[] = [
    block('html', { html: QUIZ_STYLE }),
    block('hero', { eyebrow: 'Exercices · Quiz', title: `Quiz — ${data.title}`, subtitle: `${data.quizzes.length} quiz, ${totalQ} questions. Coche tes réponses, puis clique « Afficher les réponses » en bas du quiz.` }),
    block('html', { html: `<p class="meta">📘 Cours associé : <a href="/pages/${data.slug}">${esc(data.title)}</a> · ↩️ <a href="/pages/exercices">Retour aux exercices</a></p>` }),
  ];
  for (const q of data.quizzes) blocks.push(...renderQuiz(q));
  blocks.push(block('html', { html: '<p class="meta">↩️ <a href="/pages/exercices">Retour aux exercices</a> · 📘 <a href="/pages/cours">Tous les cours</a></p>' }));
  return blocks;
}

/** Validation légère d'un objet QuizData lu depuis le JSON. */
export function validateQuizData(d: any): string[] {
  const errs: string[] = [];
  if (!d || typeof d.slug !== 'string') errs.push('slug manquant');
  if (typeof d.title !== 'string') errs.push('title manquant');
  if (!Array.isArray(d.quizzes)) { errs.push('quizzes absent'); return errs; }
  d.quizzes.forEach((q: any, qi: number) => {
    if (!Array.isArray(q.questions)) { errs.push(`quiz ${qi}: questions absentes`); return; }
    q.questions.forEach((qq: any, i: number) => {
      if (typeof qq.q !== 'string' || !qq.q) errs.push(`q${qi}.${i}: énoncé vide`);
      if (!Array.isArray(qq.options) || qq.options.length < 2) errs.push(`q${qi}.${i}: options invalides`);
      const idxs = Array.isArray(qq.answers) && qq.answers.length ? qq.answers : [qq.answer];
      if (idxs.some((a: any) => typeof a !== 'number' || a < 0 || a >= (qq.options?.length || 0))) errs.push(`q${qi}.${i}: answer hors limites`);
      if (typeof qq.explain !== 'string') errs.push(`q${qi}.${i}: explain manquant`);
    });
  });
  return errs;
}

/* Crée la page de cours « L'anglais professionnel en informatique » : la compétence REAC
   (utiliser l'anglais dans son activité pro), les niveaux CECRL visés (B1 écrit / A2 oral),
   le programme, les épreuves TSSR (écrit & oral) et les ressources utiles.
   Source : support « Me, Myself & I » (Adrar Numérique).
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-anglais-pro.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);

const accordion = (it: Array<[string, string]>) => block('accordion', { items: it.map(([title, text]) => ({ title, text, href: '' })) });
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const links = (it: Array<[string, string]>) => block('links', { links: it.map(([label, href]) => ({ label, href })) });

// ===================================================================================
// Schémas SVG
// ===================================================================================
const C = { net: '#2563eb', dev: '#059669', warn: '#d97706', grey: '#64748b', slate: '#475569', purple: '#7c3aed', ok: '#16a34a' };
const wrap = (w: number, h: number, inner: string) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="max-width:${w}px;width:100%;height:auto;margin:8px 0 14px;font-family:system-ui,sans-serif">${inner}</svg>`;
const cap = (x: number, y: number, t: string, col = C.grey, s = 11) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${s}" fill="${col}">${t}</text>`;
const lbl = (x: number, y: number, t: string, col = C.slate, s = 11) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${s}" fill="${col}" font-weight="bold">${t}</text>`;

// Échelle / escalier des niveaux CECRL (A1 -> C1), avec mise en évidence des cibles TSSR.
const stepLevels: Array<[string, string, string]> = [
  // [niveau, couleur, cible TSSR (vide si aucune)]
  ['A1', '#94a3b8', ''],
  ['A2', C.ok, 'Oral + Ecrit'],
  ['B1', C.net, 'Lecture'],
  ['B2', C.purple, ''],
  ['C1', '#6d28d9', ''],
];
const svgCecrl = (() => {
  const W = 640, H = 300;
  const baseY = 250, x0 = 60, stepW = 104, riseH = 38, blockH = 26;
  let s = '';
  // marche du bas (sol) + axe
  s += `<line x1="${x0 - 14}" y1="${baseY}" x2="${W - 16}" y2="${baseY}" stroke="#cbd5e1" stroke-width="2"/>`;
  s += `<text x="${x0 - 14}" y="${baseY + 18}" font-size="11" fill="${C.grey}">debutant</text>`;
  s += `<text x="${W - 16}" y="${baseY + 18}" text-anchor="end" font-size="11" fill="${C.grey}">autonome</text>`;
  stepLevels.forEach(([lvl, col, cible], i) => {
    const x = x0 + i * stepW;
    const topY = baseY - (i + 1) * riseH;       // sommet de la marche
    const h = baseY - topY;                       // hauteur de la colonne jusqu'au sol
    const isTarget = cible !== '';
    // colonne / marche
    s += `<rect x="${x}" y="${topY}" width="${stepW - 8}" height="${h}" rx="6" fill="${col}" fill-opacity="${isTarget ? 1 : 0.45}"`
      + `${isTarget ? ` stroke="#0f172a" stroke-width="2"` : ''}/>`;
    // bandeau de niveau en haut de la marche
    s += `<rect x="${x}" y="${topY}" width="${stepW - 8}" height="${blockH}" rx="6" fill="${col}"/>`;
    s += `<text x="${x + (stepW - 8) / 2}" y="${topY + 18}" text-anchor="middle" font-size="14" fill="#fff" font-weight="bold">${lvl}</text>`;
    // pastille + libellé de cible TSSR
    if (isTarget) {
      const cy = topY - 34, cx = x + (stepW - 8) / 2;
      s += `<rect x="${cx - 46}" y="${cy - 14}" width="92" height="40" rx="8" fill="#fff" stroke="${col}" stroke-width="2"/>`;
      s += `<text x="${cx}" y="${cy + 1}" text-anchor="middle" font-size="11" fill="${col}" font-weight="bold">CIBLE TSSR</text>`;
      s += `<text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="11" fill="${C.slate}">${cible}</text>`;
      s += `<line x1="${cx}" y1="${cy + 26}" x2="${cx}" y2="${topY - 2}" stroke="${col}" stroke-width="2"/>`;
      s += `<polygon points="${cx - 5},${topY - 8} ${cx + 5},${topY - 8} ${cx},${topY - 1}" fill="${col}"/>`;
    }
  });
  // flèche de progression
  s += `<text x="${x0}" y="34" font-size="13" fill="${C.slate}" font-weight="bold">Niveaux CECRL : du plus simple (A1) au plus expert (C1)</text>`;
  s += cap(W / 2, H - 6, 'Le TSSR vise B1 en comprehension ecrite (lecture) et A2 a l\'oral comme en expression ecrite.', C.grey, 11);
  return wrap(W, H, s);
})();

// ===================================================================================
// Tableaux HTML
// ===================================================================================
// Correspondance CECRL ↔ TOEIC ↔ niveau d'usage
const cefrTable = `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:620px;font-size:14px">
<thead><tr style="background:var(--surface-2)">${['Niveau CECRL', 'Score TOEIC', 'Description', 'Profil'].map(c => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${c}</th>`).join('')}</tr></thead><tbody>
${([
  ['A1', '120 – 224', 'Découverte', 'Mots et phrases très simples', '#94a3b8'],
  ['A2', '225 – 549', 'Élémentaire', 'Échanges simples et courants', '#16a34a'],
  ['B1', '550 – 784', 'Seuil — autonome', 'Se débrouiller, comprendre l’essentiel', '#2563eb'],
  ['B2', '785 – 944', 'Avancé', 'Communication aisée et nuancée', '#7c3aed'],
  ['C1', '945 – 990', 'Autonome', 'Maîtrise opérationnelle', '#6d28d9'],
] as Array<[string, string, string, string, string]>).map(([n, s, d, p, col]) => `<tr><td style="padding:8px 10px;border:1px solid var(--border);font-weight:700;color:#fff;text-align:center;background:${col}">${n}</td><td style="padding:8px 10px;border:1px solid var(--border);font-family:ui-monospace,monospace">${s}</td><td style="padding:8px 10px;border:1px solid var(--border);font-weight:600">${d}</td><td style="padding:8px 10px;border:1px solid var(--border)">${p}</td></tr>`).join('')}
</tbody></table></div>`;

// Niveaux visés par le TSSR, par compétence
const objTable = `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:480px;font-size:14px">
<thead><tr style="background:var(--surface-2)">${['Compétence', 'Niveau visé'].map(c => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${c}</th>`).join('')}</tr></thead><tbody>
${[
  ['📖 Compréhension de l’écrit', 'B1'],
  ['👂 Compréhension de l’oral', 'A2'],
  ['✍️ Expression écrite', 'A2'],
  ['🗣️ Expression orale', 'A2'],
].map(([k, v]) => `<tr><td style="padding:8px 10px;border:1px solid var(--border);font-weight:600">${k}</td><td style="padding:8px 10px;border:1px solid var(--border);font-weight:700;color:#2563eb;text-align:center">${v}</td></tr>`).join('')}
</tbody></table></div>`;

// ===================================================================================
// PAGE
// ===================================================================================
const SLUG = 'anglais-professionnel';
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Anglais', title: 'L’anglais professionnel en informatique', subtitle: 'Lire la doc, échanger avec le support, communiquer avec les fournisseurs et faire sa veille — en anglais.' }),
  block('html', { html: '<p>En informatique, l’<strong>anglais est partout</strong> : messages d’erreur, documentation, forums, interfaces de logiciels, communautés open source, échanges avec les fournisseurs. Ce module ne vise pas un anglais « parfait », mais un anglais <strong>opérationnel dans l’emploi</strong> : comprendre l’essentiel sans contresens et se faire comprendre clairement.</p>' }),
  note('blue', '🎯 La compétence visée (REAC)', '<p><strong>« Utiliser l’anglais dans son activité professionnelle en informatique »</strong> — une compétence à part entière du titre TSSR, évaluée à l’écrit et à l’oral.</p>'),

  block('heading', { level: 2, text: '🎯 Objectifs & niveaux visés' }),
  block('html', { html: '<p>Le référentiel s’appuie sur le <strong>CECRL</strong> (Cadre Européen Commun de Référence pour les Langues). Pour être opérationnel dans l’emploi, le TSSR vise des niveaux <strong>différents selon la compétence</strong> — on est plus exigeant en lecture qu’à l’oral :</p>' }),
  block('html', { html: objTable }),
  block('html', { html: svgCecrl }),
  note('green', '💡 À retenir', '<p>L’objectif prioritaire est de <strong>comprendre un document technique en anglais (B1 en lecture)</strong>. À l’oral comme à l’écrit, le niveau attendu est <strong>A2</strong> : des échanges simples mais corrects. <em>« Fill up the stars & place your CV at the top of the list ! »</em></p>'),
  block('html', { html: '<p>Pour situer ces niveaux par rapport au <strong>TOEIC</strong>, la certification la plus connue en entreprise :</p>' }),
  block('html', { html: cefrTable }),

  block('heading', { level: 2, text: '📋 La fiche compétence (REAC)' }),
  block('html', { html: '<p>Concrètement, la compétence « utiliser l’anglais dans son activité professionnelle » se décline en situations de travail réelles :</p>' }),
  block('list', { listItems: [
    'Exploiter une documentation technique, une interface de logiciel ou des sources d’information en anglais, de façon fiable et sans erreur de compréhension ou d’interprétation.',
    'Réaliser des interventions pertinentes auprès du support technique, en français ou en anglais, à l’oral comme à l’écrit (par messagerie).',
    'Rédiger correctement, en français ou en anglais, les messages et questions déposés sur les forums.',
    'Lire et écrire en anglais pour consulter les communautés internationales d’utilisateurs des solutions open source.',
    'Communiquer efficacement avec les fournisseurs, en français et en anglais.',
  ] }),

  block('heading', { level: 2, text: '🧰 Les savoir-faire attendus' }),
  block('html', { html: '<p>Au-delà des situations, voici les <strong>savoir-faire techniques, organisationnels et relationnels</strong> travaillés pendant le module :</p>' }),
  accordion([
    ['🔤 Épeler & transmettre des chiffres', '<p>Savoir <strong>épeler</strong> à l’oral (nom, adresse, e-mails, mots de passe) et <strong>transmettre des chiffres</strong> sans ambiguïté en anglais. Essentiel au téléphone avec un support ou un fournisseur.</p>'],
    ['🙋 Poser des questions & politesse', '<p>Savoir <strong>poser des questions simples</strong> et utiliser les <strong>formules de politesse</strong> les plus courantes (saluer, remercier, demander, s’excuser).</p>'],
    ['🗣️ Adapter sa communication', '<p>Adapter sa <strong>communication orale</strong> à son interlocuteur (un collègue, un client, un support technique) — ton, vocabulaire, niveau de détail.</p>'],
    ['💻 Vocabulaire technique', '<p>Connaître le <strong>vocabulaire professionnel et technique</strong> du métier (hardware, software, réseau, sécurité) et les <strong>formes verbales</strong> les plus courantes.</p>'],
    ['✉️ Rédiger & reformuler à l’écrit', '<p>Savoir <strong>rédiger des e-mails</strong> et <strong>reformuler</strong> une information à l’écrit, clairement et correctement.</p>'],
    ['🌐 Outils de traduction', '<p>S’approprier et utiliser différents <strong>outils de traduction</strong> (dictionnaires, DeepL…) tout en <strong>reconnaissant leurs limites</strong> — un outil aide, il ne remplace pas la compréhension.</p>'],
    ['🔭 Veille technologique', '<p>Dans le cadre de la <strong>veille technologique</strong>, savoir <strong>rechercher des informations en anglais</strong> et en extraire l’essentiel.</p>'],
  ]),

  block('heading', { level: 2, text: '🗂️ Le programme du module' }),
  block('html', { html: '<p>Les grands thèmes abordés, du plus simple au plus appliqué :</p>' }),
  block('cards', { items: [
    { title: '🔤 Alphabet, symboles & nombres', text: 'Épeler, lire les symboles (@, #, /…) et les chiffres.', href: '' },
    { title: '🖥️ Hardware & Software', text: 'Le vocabulaire des composants et des logiciels.', href: '' },
    { title: '✉️ E-mails', text: 'Comprendre et rédiger un courriel professionnel.', href: '' },
    { title: '🛠️ Troubleshooting & support', text: 'Dépanner et dialoguer avec le support technique.', href: '' },
    { title: '🌐 Network', text: 'Le vocabulaire du réseau en anglais.', href: '' },
    { title: '🔒 Security', text: 'Le vocabulaire de la sécurité informatique.', href: '' },
    { title: '🎤 Présentation', text: 'Se présenter, présenter son entreprise / stage.', href: '' },
    { title: '🔭 Tech Watch', text: 'La veille technologique, en groupes.', href: '' },
  ] }),

  block('heading', { level: 2, text: '📝 Les épreuves TSSR' }),
  block('html', { html: '<p>L’anglais est évalué de deux manières : une <strong>épreuve écrite</strong> intégrée à la mise en situation informatique, et une <strong>épreuve orale</strong> de présentation.</p>' }),

  block('heading', { level: 3, text: '✍️ Épreuve écrite' }),
  block('html', { html: '<p>Intégrée au <strong>cas pratique d’utilisation de l’informatique</strong>. Elle peut prendre une ou plusieurs des formes suivantes :</p>' }),
  accordion([
    ['A · Traduire', '<p><strong>Traduire un document de l’anglais vers le français.</strong></p>'],
    ['B · Lire & répondre en français', '<p><strong>Lire un document en anglais</strong> et <strong>répondre à des questions en français</strong>.</p>'],
    ['C · Lire & QCM', '<p><strong>Lire un document en anglais</strong> et répondre à des <strong>questions à choix multiples (QCM)</strong>, en anglais ou en français.</p>'],
    ['D · Rédiger / reformuler', '<p><strong>Rédiger et/ou reformuler</strong> à propos d’un problème : une réponse, un conseil / une recommandation, ou une procédure d’installation.</p>'],
    ['F · Écrire un e-mail', '<p><strong>Écrire un e-mail en anglais</strong> à partir d’informations fournies en français.</p>'],
  ]),
  note('yellow', '💡 Astuce', '<p>Les formes sont combinables (« <em>AND / OR</em> ») : prépare-toi à <strong>toutes</strong>. Le plus rentable : maîtriser la <strong>lecture</strong> (A, B, C) et le <strong>format e-mail</strong> (F), qui reviennent le plus souvent.</p>'),

  block('heading', { level: 3, text: '🗣️ Épreuve orale' }),
  block('html', { html: '<p>Une présentation de <strong>3 à 5 minutes</strong>, appuyée sur un <strong>support PowerPoint</strong> :</p>' }),
  block('list', { listItems: [
    'Te présenter brièvement (parcours, motivations).',
    'Présenter ton entreprise et/ou tes stages.',
  ] }),
  note('blue', '🎤 Conseils pour l’oral', '<p>Prépare un <strong>diaporama simple et lisible</strong> (peu de texte, des visuels). Entraîne-toi à <strong>parler sans lire</strong>, soigne la <strong>prononciation</strong> des mots techniques, et garde le <strong>timing</strong> (3–5 min). Anticipe quelques questions simples du jury.</p>'),

  block('heading', { level: 2, text: '🔗 Ressources utiles' }),
  block('html', { html: '<p><strong>Traduction & dictionnaires</strong> — pour lever un doute (sans copier-coller à l’aveugle) :</p>' }),
  links([
    ['WordReference', 'https://www.wordreference.com'],
    ['DeepL Traducteur', 'https://www.deepl.com/translator'],
  ]),
  block('html', { html: '<p><strong>Exercices & compréhension orale</strong> :</p>' }),
  links([
    ['Agendaweb', 'https://agendaweb.org/'],
    ['Daily Dictation', 'https://dailydictation.com/exercises'],
    ['TalkEnglish (listening)', 'https://www.talkenglish.com/listening/listenintermediate.aspx'],
    ['Breaking News English', 'https://breakingnewsenglish.com/'],
    ['Oxford Headway', 'https://elt.oup.com/student/headway/'],
    ['AnglaisFacile (débutants)', 'https://www.anglaisfacile.com/beginners/'],
    ['iSpeakSpokeSpoken', 'https://www.ispeakspokespoken.com/cours-anglais/'],
  ]),
  block('html', { html: '<p><strong>Tests de niveau & quiz</strong> :</p>' }),
  links([
    ['ProProfs — Quiz informatique', 'https://www.proprofs.com/quiz-school/topic/computer'],
    ['Cambridge — Test your English', 'https://www.cambridgeenglish.org/fr/test-your-english/general-english/'],
  ]),

  block('heading', { level: 3, text: '▶️ Vidéos (YouTube)' }),
  block('html', { html: '<p>Une chaîne de référence pour le vocabulaire et la grammaire :</p>' }),
  links([
    ['Technique pour retenir le vocabulaire', 'https://www.youtube.com/watch?v=Asmt1ws1ogw'],
    ['E-mail professionnel en anglais — partie 1', 'https://www.youtube.com/watch?v=xn1st-yv2kI'],
    ['E-mail professionnel en anglais — partie 2', 'https://www.youtube.com/watch?v=t5I_c5w9rUM'],
    ['Vocabulaire de l’informatique — partie 1', 'https://www.youtube.com/watch?v=-ReQcfZgm9w'],
    ['Vocabulaire de l’informatique — partie 2', 'https://www.youtube.com/watch?v=z3nrxcffbfI'],
    ['Vocabulaire intermédiaire & avancé (playlist)', 'https://www.youtube.com/playlist?list=PLpXDfP--B5esxM6zbiNUj_Tws-uGbEVPb'],
    ['Grammaire anglaise intermédiaire & avancé (playlist)', 'https://www.youtube.com/playlist?list=PLpXDfP--B5evNTAKT6qxxELb3QSP2Nz_d'],
    ['Dictées', 'https://www.youtube.com/watch?v=AQ6yEINNZMs'],
  ]),

  note('green', '🚀 Pour commencer', '<p>Avant tout, un <strong>test de positionnement</strong> (placement test) permet de situer ton niveau de départ. Puis on apprend à <strong>se connaître</strong> (« Get to know each other ! ») pour démarrer les premières conversations. L’essentiel : <strong>oser pratiquer</strong>, sans peur de l’erreur.</p>'),
];

const PAGE = {
  slug: SLUG,
  title: 'L’anglais professionnel en informatique',
  excerpt: 'L’anglais dans le métier TSSR : la compétence REAC, les niveaux CECRL visés (B1 écrit, A2 oral), le programme, les épreuves (écrit & oral) et les ressources utiles.',
};

// ===================================================================================
// EXÉCUTION
// ===================================================================================
function cookieFrom(res: Response): string {
  const sc = (res.headers as any).getSetCookie?.() as string[] | undefined;
  return (sc && sc.length ? sc : [res.headers.get('set-cookie') || '']).map(c => c.split(';')[0]).filter(Boolean).join('; ');
}
async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: PW }) });
  if (!login.ok) throw new Error(`login ${login.status}`);
  const cookie = cookieFrom(login);
  const h = { 'Content-Type': 'application/json', Cookie: cookie };
  const existing = await (await fetch(`${BASE}/api/admin/pages`, { headers: { Cookie: cookie } })).json() as Array<{ id: number; slug: string }>;

  const cur = existing.find(e => e.slug === PAGE.slug);
  const bodyJson = JSON.stringify({ title: PAGE.title, slug: PAGE.slug, excerpt: PAGE.excerpt, content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1 });
  const res = cur
    ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body: bodyJson })
    : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body: bodyJson });
  console.log(`PAGE ${PAGE.slug}`, res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());

  const cours = existing.find(e => e.slug === 'cours');
  if (cours) {
    const hubBlocks = buildHubBlocks();
    const r = await fetch(`${BASE}/api/admin/pages/${cours.id}`, { method: 'PUT', headers: h, body: JSON.stringify({ title: 'Cours', slug: 'cours', content: renderPageBlocksToHtml(hubBlocks), builder_json: serializePageBlocks(hubBlocks), published: 1 }) });
    console.log('HUB Cours', r.status, r.ok ? '(maj)' : await r.text());
  } else console.log('HUB Cours introuvable');

  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

/* Crée/met à jour la page "Stages" (hero + avertissement + onglets riches avec liens) et l'ajoute au menu.
   Usage : BASE=https://tssr.miyukini.com ADMIN_PW=... tsx scripts/seed-stages.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';

const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);

interface Co { name: string; desc: string; url?: string }
const li = (c: Co) => `<li><strong>${c.name}</strong>${c.desc ? ` — ${c.desc}` : ''}${c.url ? ` — <a href="${c.url}" target="_blank" rel="noopener noreferrer">${c.url.replace(/^https?:\/\/(www\.)?/, '')}</a>` : ''}</li>`;
const tab = (title: string, intro: string, cos: Co[]) => ({ title, href: '', text: `<p>${intro}</p><ul>${cos.map(li).join('')}</ul>` });

const disclaimer = `Liste indicative pour orienter ta recherche de stage ou d'alternance en TSSR Cybersécurité autour de Toulouse et Labège (Innopole). Toulouse est un grand pôle aéronautique, spatial et numérique : beaucoup de structures recrutent des stagiaires/alternants en administration systèmes & réseaux, support N1/N2, infogérance et cybersécurité (SOC, audit).

⚠️ Vérifie toujours les offres en cours et les coordonnées à jour (sites des entreprises, LinkedIn, La Mêlée, Pôle emploi, et le réseau de l'ADRAR).`;

const tabs = [
  tab('Grandes ESN', 'Sociétés de services du numérique généralistes, agences à Toulouse / Colomiers, fortes activités infrastructure & cybersécurité.', [
    { name: 'Sopra Steria', desc: 'Colomiers/Toulouse — infogérance, infra, cyber', url: 'https://www.soprasteria.com' },
    { name: 'Capgemini / Sogeti', desc: 'Toulouse — infra, cybersécurité', url: 'https://www.capgemini.com' },
    { name: 'Atos / Eviden', desc: 'Toulouse — cybersécurité, infogérance', url: 'https://eviden.com' },
    { name: 'CGI', desc: 'Toulouse/Labège — services IT & sécurité', url: 'https://www.cgi.com' },
    { name: 'Inetum', desc: 'Toulouse — infra & support', url: 'https://www.inetum.com' },
    { name: 'Akkodis', desc: 'Toulouse — ingénierie IT', url: 'https://www.akkodis.com' },
    { name: 'Devoteam', desc: 'Toulouse — cloud & cybersécurité', url: 'https://www.devoteam.com' },
  ]),
  tab('Cybersécurité', 'Spécialistes et entités dédiées cybersécurité (SOC, audit, conseil).', [
    { name: 'Orange Cyberdefense', desc: 'Toulouse — SOC, MSSP, audit', url: 'https://www.orangecyberdefense.com' },
    { name: 'ITrust', desc: 'Labège (Innopole) — SOC/Reveelium & services cyber', url: 'https://www.itrust.fr' },
    { name: 'Airbus Protect', desc: 'Toulouse/Blagnac — conseil cyber & gestion des risques', url: 'https://www.airbus-protect.com' },
    { name: 'Serma Safety & Security', desc: 'Toulouse — évaluation/certification (CESTI)', url: 'https://www.serma-safety-security.com' },
    { name: 'Synetis', desc: 'Toulouse — conseil IAM & cybersécurité', url: 'https://www.synetis.com' },
    { name: 'Neverhack', desc: 'Toulouse — services cybersécurité', url: 'https://www.neverhack.com' },
  ]),
  tab('Aéro, spatial & industrie', 'Grands comptes avec DSI et équipes cyber internes (stages infra/SOC, souvent via leurs ESN partenaires).', [
    { name: 'Airbus', desc: 'Toulouse/Blagnac — SI & cybersécurité industrielle', url: 'https://www.airbus.com' },
    { name: 'Thales / Thales Alenia Space', desc: 'Toulouse — cyber, défense, spatial', url: 'https://www.thalesgroup.com' },
    { name: 'Continental', desc: 'Toulouse — électronique automobile, SI', url: 'https://www.continental.com' },
    { name: 'Liebherr Aerospace', desc: 'Toulouse — industrie aéronautique', url: 'https://www.liebherr.com' },
    { name: 'Safran', desc: 'Toulouse — aéronautique', url: 'https://www.safran-group.com' },
    { name: 'Pierre Fabre', desc: 'Castres/Toulouse — laboratoire, grand SI', url: 'https://www.pierre-fabre.com' },
  ]),
  tab('Public, santé & recherche', 'Établissements publics et grands SI, fréquemment ouverts aux stages infra/sécurité.', [
    { name: 'CNES', desc: 'Toulouse — agence spatiale, cybersécurité', url: 'https://www.cnes.fr' },
    { name: 'CHU de Toulouse', desc: 'cybersécurité hospitalière', url: 'https://www.chu-toulouse.fr' },
    { name: 'Toulouse Métropole', desc: 'DSI collectivité', url: 'https://www.toulouse-metropole.fr' },
    { name: 'Université de Toulouse / CNRS', desc: 'recherche & SI', url: 'https://www.univ-toulouse.fr' },
    { name: 'Météo-France', desc: 'Toulouse — calcul & infrastructure', url: 'https://meteofrance.fr' },
    { name: 'Région Occitanie', desc: '', url: 'https://www.laregion.fr' },
  ]),
  tab('Éditeurs & PME (Labège)', 'Tissu local d\'éditeurs, IoT, hébergeurs et infogérants — souvent les plus accessibles pour un premier stage.', [
    { name: 'Berger-Levrault', desc: 'Labège/Toulouse — éditeur logiciel secteur public', url: 'https://www.berger-levrault.com' },
    { name: 'UnaBiz (ex-Sigfox)', desc: 'Labège — IoT', url: 'https://www.unabiz.com' },
    { name: 'Infogérants & MSP de l\'Innopole de Labège', desc: 'support N1/N2, infra PME' },
    { name: 'La Mêlée', desc: 'réseau numérique régional (mise en relation)', url: 'https://www.lamelee.com' },
    { name: 'Aerospace Valley', desc: 'pôle de compétitivité (contacts)', url: 'https://www.aerospace-valley.com' },
  ]),
];

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'TSSR Cybersécurité', title: 'Stages & alternances', subtitle: 'ESN et entreprises autour de Toulouse / Labège susceptibles d’accueillir un stagiaire en systèmes, réseaux & cybersécurité.' }),
  block('text', { text: disclaimer }),
  block('tabs', { items: tabs }),
];

const content = renderPageBlocksToHtml(blocks);
const builder_json = serializePageBlocks(blocks);

function cookieFrom(res: Response): string {
  const sc = (res.headers as any).getSetCookie?.() as string[] | undefined;
  return (sc && sc.length ? sc : [res.headers.get('set-cookie') || '']).map(c => c.split(';')[0]).filter(Boolean).join('; ');
}

async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: PW }) });
  if (!login.ok) throw new Error(`login failed: ${login.status}`);
  const cookie = cookieFrom(login);
  const h = { 'Content-Type': 'application/json', Cookie: cookie };
  const body = JSON.stringify({ title: 'Stages', slug: 'stages', excerpt: 'Stages & alternances TSSR Cybersécurité autour de Toulouse/Labège.', content, builder_json, published: 1 });

  const pages = await (await fetch(`${BASE}/api/admin/pages`, { headers: { Cookie: cookie } })).json() as Array<{ id: number; slug: string }>;
  const existing = pages.find(p => p.slug === 'stages');
  const res = existing
    ? await fetch(`${BASE}/api/admin/pages/${existing.id}`, { method: 'PUT', headers: h, body })
    : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log('PAGE', res.status, existing ? '(mise à jour)' : '(créée)', res.ok ? '' : await res.text());

  const menus = await (await fetch(`${BASE}/api/admin/menus`, { headers: { Cookie: cookie } })).json() as Array<{ url: string; sort_order: number }>;
  if (menus.some(m => m.url === '/stages')) { console.log('MENU déjà présent'); return; }
  const sort = Math.max(0, ...menus.map(m => m.sort_order)) + 1;
  const m = await fetch(`${BASE}/api/admin/menus`, { method: 'POST', headers: h, body: JSON.stringify({ label: 'Stages', url: '/stages', sort_order: sort }) });
  console.log('MENU', m.status);
}
main().catch(e => { console.error(e); process.exit(1); });

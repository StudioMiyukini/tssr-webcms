/* Publie les archives « site hors-ligne » sur une release GitHub.

   Pourquoi : servir 31 Mo a travers le tunnel Cloudflare prend deux minutes, et
   refabriquer l'archive a chaque clic n'a aucun sens — le contenu ne bouge pas
   d'une visite a l'autre. Une fois par jour suffit ; le CDN de GitHub fait le
   reste. Le serveur se contente ensuite de rediriger vers ces fichiers.

   Ce script : construit les deux archives (site + contenu), les depose sur la
   release au tag « hors-ligne » (creee au besoin, assets remplaces), puis ecrit
   le manifeste que le serveur lit — export/hors-ligne/publication.json.

   Si rien n'a change depuis la derniere publication, il ne renvoie rien.

   Usage : npx tsx scripts/publier-hors-ligne.mts [--force]
   Lance chaque jour a 8h par la tache « TSSR-WebCMS-PublicationHorsLigne ».
   Codes de sortie : 0 = OK (publie ou deja a jour), 1 = echec. */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* L'adresse publique du site est GRAVÉE dans le metteur à jour de l'archive.
   Ce script tourne hors PM2 (tâche planifiée), donc sans l'environnement du
   serveur : sans ce rattrapage, PUBLIC_BASE_URL vaut son défaut « example.com »
   et l'archive part avec un metteur à jour qui ne trouvera jamais son site.
   On la reprend donc de l'environnement, sinon de l'ecosystem PM2. */
function adressePublique(): string {
  const env = (process.env.PUBLIC_BASE_URL || '').trim();
  if (env && !/example\.com/i.test(env)) return env.replace(/\/+$/, '');
  const eco = path.join(RACINE, 'ecosystem.config.cjs');
  if (fs.existsSync(eco)) {
    try {
      const conf = createRequire(import.meta.url)(eco) as { apps?: Array<{ name?: string; env?: Record<string, string> }> };
      const app = conf.apps?.find((a) => a.env?.PUBLIC_BASE_URL);
      const url = app?.env?.PUBLIC_BASE_URL?.trim();
      if (url && !/example\.com/i.test(url)) return url.replace(/\/+$/, '');
    } catch { /* ecosystem illisible : on tombera sur l'arrêt ci-dessous */ }
  }
  return '';
}

const BASE = adressePublique();
if (!BASE) {
  console.error('[publication] ✗ Adresse publique du site inconnue.');
  console.error('             Renseigne PUBLIC_BASE_URL (ou son entrée dans ecosystem.config.cjs) :');
  console.error('             sans elle, le metteur à jour de l’archive ne saurait pas où revenir.');
  process.exit(1);
}
// Doit être posée AVANT le chargement de server/env.ts, qui la lit à l'import.
process.env.PUBLIC_BASE_URL = BASE;

const { archive, publication, ecrirePublication, disponible } = await import('../server/lib/hors-ligne');
type Genre = 'exe' | 'site' | 'contenu';

const TAG = process.env.HORS_LIGNE_TAG || 'hors-ligne';
const DEPOT = process.env.HORS_LIGNE_DEPOT || 'StudioMiyukini/tssr-webcms';
const FORCE = process.argv.includes('--force');
// Noms FIXES : l'adresse de telechargement doit rester la meme d'un jour a l'autre,
// sans quoi les archives deja distribuees ne sauraient plus ou revenir.
const NOMS: Record<Genre, string> = {
  exe: 'TSSR-Site-hors-ligne.exe',
  site: 'tssr-site-hors-ligne.zip',
  contenu: 'tssr-contenu.zip',
};
// L'exécutable d'abord : c'est ce que le bouton du site propose.
const GENRES: Genre[] = ['exe', 'site', 'contenu'];

const log = (m: string) => console.log(`[publication] ${new Date().toISOString().slice(0, 19).replace('T', ' ')}  ${m}`);
const echec = (m: string, e?: unknown): never => {
  console.error(`[publication] ✗ ${m}`);
  if (e) console.error(String((e as any)?.stderr || (e as any)?.message || e));
  process.exit(1);
};

const gh = (args: string[]): string =>
  execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 1 << 24, env: { ...process.env, GH_PAGER: 'cat' } });

function urlAsset(nom: string): string {
  return `https://github.com/${DEPOT}/releases/download/${TAG}/${nom}`;
}

async function main() {
  log(`Site source gravé dans l’archive : ${BASE}`);
  if (!disponible()) echec('Ce serveur ne peut pas fabriquer les archives (dist/ ou esbuild manquant).');

  try { gh(['auth', 'status']); } catch (e) { echec('gh n’est pas authentifié (gh auth login).', e); }

  log('Construction des paquets…');
  const paquets = {} as Record<Genre, Awaited<ReturnType<typeof archive>>>;
  for (const g of GENRES) {
    paquets[g] = await archive(g);
    log(`  ${g.padEnd(8)} ${(paquets[g].taille / 1048576).toFixed(1)} Mo`);
  }
  const site = paquets.site;

  // L'empreinte du cache dit si le contenu a bouge depuis la derniere publication.
  const marque = JSON.parse(fs.readFileSync(path.join(path.dirname(site.fichier), 'site.json'), 'utf8')).empreinte as string;
  const precedente = publication();
  if (!FORCE && precedente && precedente.empreinte === marque) {
    log('Rien n’a changé depuis la dernière publication — rien à déposer.');
    return;
  }

  // La release est un point de depot permanent : on la cree une fois, puis on
  // remplace ses fichiers (--clobber). Le tag ne bouge pas.
  try { gh(['release', 'view', TAG, '--repo', DEPOT]); }
  catch {
    log(`Création de la release « ${TAG} »…`);
    try {
      gh(['release', 'create', TAG, '--repo', DEPOT, '--title', 'Site hors-ligne',
        '--notes', 'Archives du site TSSR pour un usage hors connexion, refaites chaque jour à 8h.\n\n'
        + `- **${NOMS.exe}** — Windows : un seul fichier, moteur Node compris, rien à installer\n`
        + `- **${NOMS.site}** — tous systèmes : à dézipper et lancer (Node.js 22+ requis)\n`
        + `- **${NOMS.contenu}** — le contenu seul, ce que recharge « Mettre-a-jour »\n\n`
        + 'Contenu public uniquement : ni comptes, ni données personnelles.']);
    } catch (e) { echec('Création de la release impossible.', e); }
  }

  for (const genre of GENRES) {
    const a = paquets[genre];
    const cible = path.join(path.dirname(a.fichier), NOMS[genre]);
    fs.copyFileSync(a.fichier, cible); // le nom deposé doit être stable, pas « site.zip »
    log(`Dépôt de ${NOMS[genre]}…`);
    try { gh(['release', 'upload', TAG, cible, '--repo', DEPOT, '--clobber']); }
    catch (e) { echec(`Dépôt de ${NOMS[genre]} impossible.`, e); }
    fs.rmSync(cible, { force: true });
  }

  ecrirePublication({
    empreinte: marque,
    genereLe: new Date().toISOString(),
    site: { url: urlAsset(NOMS.site), taille: paquets.site.taille },
    contenu: { url: urlAsset(NOMS.contenu), taille: paquets.contenu.taille },
    exe: { url: urlAsset(NOMS.exe), taille: paquets.exe.taille },
  });
  log(`✓ Publié : ${urlAsset(NOMS.exe)}`);
}

main().catch((e) => echec('Échec inattendu.', e));

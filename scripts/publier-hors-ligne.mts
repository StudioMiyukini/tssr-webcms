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
import { archive, publication, ecrirePublication, disponible, type Genre } from '../server/lib/hors-ligne';

const TAG = process.env.HORS_LIGNE_TAG || 'hors-ligne';
const DEPOT = process.env.HORS_LIGNE_DEPOT || 'StudioMiyukini/tssr-webcms';
const FORCE = process.argv.includes('--force');
// Noms FIXES : l'adresse de telechargement doit rester la meme d'un jour a l'autre,
// sans quoi les archives deja distribuees ne sauraient plus ou revenir.
const NOMS: Record<Genre, string> = { site: 'tssr-site-hors-ligne.zip', contenu: 'tssr-contenu.zip' };

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
  if (!disponible()) echec('Ce serveur ne peut pas fabriquer les archives (dist/ ou esbuild manquant).');

  try { gh(['auth', 'status']); } catch (e) { echec('gh n’est pas authentifié (gh auth login).', e); }

  log('Construction des archives…');
  const site = await archive('site');
  const contenu = await archive('contenu');
  log(`site : ${(site.taille / 1048576).toFixed(1)} Mo — contenu : ${(contenu.taille / 1048576).toFixed(1)} Mo`);

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
        + `- **${NOMS.site}** — le site complet, à dézipper et lancer (voir LISEZ-MOI.txt)\n`
        + `- **${NOMS.contenu}** — le contenu seul, ce que recharge « Mettre-a-jour »\n\n`
        + 'Contenu public uniquement : ni comptes, ni données personnelles.']);
    } catch (e) { echec('Création de la release impossible.', e); }
  }

  for (const [genre, a] of [['site', site], ['contenu', contenu]] as const) {
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
    site: { url: urlAsset(NOMS.site), taille: site.taille },
    contenu: { url: urlAsset(NOMS.contenu), taille: contenu.taille },
  });
  log(`✓ Publié : ${urlAsset(NOMS.site)}`);
}

main().catch((e) => echec('Échec inattendu.', e));

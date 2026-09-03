/* Lanceur du site hors-ligne.

   Le module SQLite est du code natif : un binaire ne vaut que pour UNE version
   d'ABI Node (« NODE_MODULE_VERSION »). L'archive en embarque donc plusieurs,
   dans node_modules/better-sqlite3/prebuilds/<plateforme>-<arch>/abi-<n>.node,
   et ce lanceur met en place celui qui correspond au Node du poste avant de
   démarrer le serveur. Sans quoi : « was compiled against a different Node.js
   version », et le site ne s'ouvre pas.

   Usage : node demarrer.mjs   (c'est ce que fait Lancer-le-site.bat) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const abi = process.versions.modules;
const cible = `${process.platform}-${process.arch}`;
const RELEASE = path.join(ROOT, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
const PREBUILDS = path.join(ROOT, 'node_modules', 'better-sqlite3', 'prebuilds');
const voulu = path.join(PREBUILDS, cible, `abi-${abi}.node`);

// Les ABI ne parlent à personne : on les rend en versions de Node.
const NODE_PAR_ABI = { 108: '18', 115: '20', 127: '22', 131: '23', 137: '24', 141: '25', 147: '26' };

function disponibles() {
  try {
    return fs.readdirSync(path.join(PREBUILDS, cible))
      .map((f) => /^abi-(\d+)\.node$/.exec(f)?.[1]).filter(Boolean).sort((a, b) => a - b);
  } catch { return []; }
}

if (fs.existsSync(voulu)) {
  // Copie à chaque lancement : peu coûteux, et rattrape un dossier laissé
  // dans l'état d'un autre Node (clé USB passée d'un poste à l'autre).
  fs.mkdirSync(path.dirname(RELEASE), { recursive: true });
  fs.copyFileSync(voulu, RELEASE);
} else if (!fs.existsSync(RELEASE)) {
  const liste = disponibles();
  const versions = liste.map((a) => NODE_PAR_ABI[a] || `ABI ${a}`);
  console.error('\n  Ce site ne peut pas démarrer avec ce Node.js.\n');
  console.error(`  Node installé : ${process.version} (ABI ${abi}, ${cible})`);
  console.error(versions.length
    ? `  Ce site est fourni pour Node ${versions.join(', ')} sur ${cible}.`
    : `  Aucun moteur de base de données embarqué pour « ${cible} ».`);
  if (versions.length) console.error(`\n  Installe l'une de ces versions : https://nodejs.org`);
  else console.error('\n  Installe Node.js 22 LTS ou plus récent : https://nodejs.org');
  console.error('  Ou, avec une connexion, dans ce dossier : npm install better-sqlite3\n');
  process.exit(1);
}
// Le binaire en place n'est pas celui de cet ABI mais on n'a rien de mieux :
// on tente quand même — l'erreur de chargement dira la vérité.

await import('./server/index.mjs');

/* Publie d'un coup les trois nouveaux cours VLAN + le hub des cours.
   Les seeds sont idempotents : relancer met simplement les pages a jour.

   Usage :
     cd D:\APP\TSSR\miyukini-cms
     ADMIN_PW='<mot de passe admin>' npx tsx scripts/seed-vlan-all.ts

   Variables :
     ADMIN_PW  mot de passe du compte « admin » du CMS (obligatoire)
     BASE      URL du site (defaut : https://tssr.miyukini.com)
*/
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || '';

if (!PW) {
  console.error('ADMIN_PW manquant.\n  Exemple : ADMIN_PW=\'...\' npx tsx scripts/seed-vlan-all.ts');
  process.exit(1);
}

// L'ordre compte : les pages d'abord, les annuaires ensuite (ils les référencent).
const STEPS = [
  'seed-cours-vlan-securite.ts',
  'seed-cours-vlan-vtp.ts',
  'seed-cours-vlan-voix.ts',
  'seed-procedure-vlan.ts',
  'seed-cours-hub.ts',
  'seed-procedures-hub.ts',
];

let failed = 0;
for (const step of STEPS) {
  process.stdout.write(`\n── ${step}\n`);
  const r = spawnSync('npx', ['tsx', path.join(__dirname, step)], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, BASE, ADMIN_PW: PW },
  });
  if (r.status !== 0) { failed++; console.error(`   ✗ ${step} a echoue (code ${r.status})`); }
}

console.log(failed === 0
  ? `\n✓ Termine. Les cours sont en ligne sur ${BASE}/pages/cours`
  : `\n✗ ${failed} etape(s) en echec — rien n'est casse, les seeds sont rejouables.`);
process.exit(failed === 0 ? 0 : 1);

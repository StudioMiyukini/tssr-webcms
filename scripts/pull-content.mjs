/* Rafraîchit le CONTENU local depuis une instance en ligne (prod).
   Se connecte (session admin), télécharge l'export `/api/admin/export`
   (base cms.sqlite + médias), puis l'importe dans CETTE instance locale.

   Multiplateforme (Node ≥ 18) — remplace le téléchargement PowerShell/curl du
   wrapper de mise à jour. À lancer SERVEUR ARRÊTÉ (l'import écrase cms.sqlite).

   Configuration (variables d'environnement, ou arguments) :
     WEBCMS_CONTENU_URL        adresse du site source   (défaut https://tssr.miyukini.com)
     WEBCMS_CONTENU_USER       identifiant admin source (défaut admin)
     WEBCMS_CONTENU_PASSWORD   mot de passe admin source (obligatoire)

   Usage :
     node scripts/pull-content.mjs [url] [user]
     # le mot de passe vient de WEBCMS_CONTENU_PASSWORD (jamais en argument)

   Codes de sortie : 0 = OK, 2 = configuration, 3 = réseau/HTTP, 4 = import. */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = (process.argv[2] || process.env.WEBCMS_CONTENU_URL || 'https://tssr.miyukini.com').replace(/\/+$/, '');
const user = process.argv[3] || process.env.WEBCMS_CONTENU_USER || 'admin';
const password = process.env.WEBCMS_CONTENU_PASSWORD || '';

const log = (m) => console.log(`[pull-content] ${m}`);
const die = (code, m, hint) => { console.error(`[pull-content] ✗ ${m}`); if (hint) console.error(`             ${hint}`); process.exit(code); };

if (!/^https?:\/\//i.test(url)) die(2, `URL invalide : ${url}`, 'Attendu : https://mon-site …');
if (!password) die(2, 'Mot de passe admin absent.', 'Définis WEBCMS_CONTENU_PASSWORD (le site SOURCE).');

// Récupère le cookie de session d'une réponse (une ou plusieurs en-têtes Set-Cookie).
function cookieFrom(res) {
  const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
  return raw.map((c) => c.split(';')[0]).filter(Boolean).join('; ');
}

async function main() {
  log(`Source : ${url} (admin : ${user})`);

  // 1. Connexion → cookie de session admin.
  let login;
  try {
    login = await fetch(`${url}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, password }),
      redirect: 'manual',
    });
  } catch (e) {
    die(3, `Site source injoignable : ${url}`, String(e && e.message || e));
  }
  if (login.status === 401) die(3, 'Identifiants refusés par le site source.', 'Vérifie WEBCMS_CONTENU_USER / WEBCMS_CONTENU_PASSWORD (le site SOURCE).');
  if (login.status === 429) die(3, 'Trop de tentatives (limiteur de débit).', 'Attends une quinzaine de minutes.');
  if (!login.ok) die(3, `Connexion refusée : HTTP ${login.status}.`);
  const cookie = cookieFrom(login);
  if (!cookie) die(3, 'Aucun cookie de session renvoyé par la connexion.', 'Le site source expose-t-il bien /api/auth/login ?');
  log('Authentifié sur le site source.');

  // 2. Téléchargement de l'export (base + médias).
  log('Téléchargement de l\'export (base + médias)…');
  let exp;
  try {
    exp = await fetch(`${url}/api/admin/export`, { headers: { Cookie: cookie } });
  } catch (e) {
    die(3, 'Téléchargement de l\'export impossible.', String(e && e.message || e));
  }
  if (exp.status === 401) die(3, 'Export refusé (session non acceptée).', `Ouvre ${url}/admin et vérifie que l'export fonctionne.`);
  if (!exp.ok) die(3, `Export refusé : HTTP ${exp.status}.`);
  const buf = Buffer.from(await exp.arrayBuffer());
  if (!buf.length) die(3, 'Export vide.');

  const tmp = path.join(os.tmpdir(), `tssr-content-${Date.now()}.zip`);
  fs.writeFileSync(tmp, buf);
  log(`Export reçu : ${(buf.length / 1048576).toFixed(1)} Mo → ${path.basename(tmp)}`);

  // 3. Import dans l'instance locale (sauvegarde l'ancienne base, remplace).
  log('Import dans l\'instance locale…');
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'import-site.mjs'), tmp], { stdio: 'inherit', cwd: ROOT });
  } catch {
    die(4, 'L\'import a échoué (voir ci-dessus).');
  } finally {
    fs.rmSync(tmp, { force: true });
  }
  log('✓ Contenu rafraîchi.');
}

main().catch((e) => die(3, 'Échec inattendu.', String(e && e.stack || e)));

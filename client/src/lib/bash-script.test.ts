import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BRIQUES, fabriquer, type Cle } from './bash-script.ts';

const CLES = BRIQUES.map(b => b.cle);
const rien = () => Object.fromEntries(CLES.map(k => [k, false])) as Record<Cle, boolean>;
const tout = () => Object.fromEntries(CLES.map(k => [k, true])) as Record<Cle, boolean>;
const defauts = () => Object.fromEntries(BRIQUES.map(b => [b.cle, b.defaut])) as Record<Cle, boolean>;

const CMDS = 'rsync -aAX --delete "$SOURCE" "$DESTINATION"';

/* ── Ce que le script contient ─────────────────────────────────────────── */

test('le script commence par un shebang portable', () => {
  const s = fabriquer('x.sh', 'desc', CMDS, defauts());
  assert.ok(s.startsWith('#!/usr/bin/env bash\n'), s.slice(0, 40));
});

test('LE MODE STRICT POSE LES TROIS OPTIONS, pas une seule', () => {
  // `set -e` seul ne suffit pas : une variable vide dans un `rm -rf "$DEST/"`
  // passe sans bruit, et un échec au milieu d'un pipe ne compte pas.
  const s = fabriquer('x.sh', '', CMDS, { ...rien(), strict: true });
  assert.ok(s.includes('set -euo pipefail'), 'les trois d’un coup');
  assert.ok(!fabriquer('x.sh', '', CMDS, rien()).includes('set -euo'), 'et rien quand on ne le demande pas');
});

test('le nettoyage passe par un trap, pas par une ligne de fin', () => {
  // Une suppression écrite en dernière ligne ne s'exécute pas si le script
  // meurt avant — c'est-à-dire exactement quand il y a quelque chose à nettoyer.
  const s = fabriquer('x.sh', '', CMDS, { ...rien(), nettoyage: true });
  assert.ok(s.includes('trap nettoyer EXIT INT TERM'));
  assert.ok(s.includes('rm -rf "$TEMPO"'));
});

test('le verrou utilise flock et non un fichier témoin', () => {
  // Un fichier témoin survit à un script tué et bloque toutes les exécutions
  // suivantes jusqu'à une intervention manuelle. Le descripteur, lui, se libère.
  const s = fabriquer('x.sh', '', CMDS, { ...rien(), verrou: true });
  assert.ok(s.includes('flock -n 9'));
});

test('la boucle sur fichiers survit aux noms avec espaces', () => {
  const s = fabriquer('x.sh', '', CMDS, { ...rien(), boucle: true });
  assert.ok(s.includes('-print0'), 'find doit séparer par octet nul');
  assert.ok(s.includes("read -r -d ''"), 'et read doit lire de la même façon');
  assert.ok(!s.includes('for f in $(ls'), 'jamais la forme naïve');
});

test('la confirmation est sautée hors terminal', () => {
  // Sinon une tâche cron attend une réponse qui ne viendra jamais.
  const s = fabriquer('x.sh', '', CMDS, { ...rien(), confirme: true });
  assert.ok(s.includes('if [ -t 0 ]; then'));
});

test('le mode simulation passe toutes les actions par une seule porte', () => {
  const s = fabriquer('x.sh', '', CMDS, { ...rien(), dryrun: true });
  assert.ok(s.includes('faire() {'));
  assert.ok(s.includes(`faire ${CMDS}`), 'le traitement passe par faire()');
});

test('le traitement saisi se retrouve dans le script', () => {
  const s = fabriquer('x.sh', '', 'echo un\necho deux', defauts());
  assert.ok(s.includes('echo un'));
  assert.ok(s.includes('echo deux'));
});

test('un nom de fichier hostile ne sort pas du script', () => {
  // Le nom sert de commentaire d'en-tête : il ne doit pas pouvoir y injecter
  // une commande ni casser la syntaxe.
  const s = fabriquer('a b; rm -rf /.sh', 'desc', CMDS, defauts());
  assert.ok(!s.includes('rm -rf /'), s.split('\n')[1]);
});

/* ── Ce qui compte vraiment : est-ce du Bash valide ? ───────────────────── */

/** `bash -n` analyse la syntaxe sans rien exécuter. */
function bashAccepte(script: string, nom: string): { ok: boolean; err: string } {
  const dir = mkdtempSync(join(tmpdir(), 'bashgen-'));
  const f = join(dir, nom);
  writeFileSync(f, script, 'utf8');
  try {
    execFileSync('bash', ['-n', f], { stdio: 'pipe' });
    return { ok: true, err: '' };
  } catch (e) {
    return { ok: false, err: String((e as { stderr?: Buffer }).stderr ?? e) };
  }
}

test('BASH ACCEPTE LE SCRIPT DANS LES 1024 COMBINAISONS DE GARDE-FOUS', () => {
  // C'est le test qui justifie d'avoir sorti la génération du composant. Les
  // briques s'assemblent : une accolade ouverte par l'une et fermée par une
  // autre ne se voit qu'en essayant, et pas seulement sur les cases par défaut.
  const total = 1 << CLES.length;
  const echecs: string[] = [];
  for (let masque = 0; masque < total; masque++) {
    const on = Object.fromEntries(CLES.map((k, i) => [k, !!(masque & (1 << i))])) as Record<Cle, boolean>;
    const r = bashAccepte(fabriquer('essai.sh', 'un essai', CMDS, on), 'essai.sh');
    if (!r.ok) {
      const actifs = CLES.filter(k => on[k]).join(',') || '(aucun)';
      echecs.push(`${actifs} :: ${r.err.trim().split('\n')[0]}`);
      if (echecs.length >= 5) break;
    }
  }
  assert.deepEqual(echecs, [], `combinaisons refusées par bash -n :\n${echecs.join('\n')}`);
});

test('le script sans aucun traitement reste valide', () => {
  // L'utilisateur vide la zone de texte : il doit rester un squelette exécutable.
  const r = bashAccepte(fabriquer('vide.sh', '', '', tout()), 'vide.sh');
  assert.ok(r.ok, r.err);
});

test('un traitement multi-ligne dans une boucle reste valide', () => {
  const s = fabriquer('b.sh', '', 'cp "$fichier" "$TEMPO/"\ngzip "$TEMPO/$(basename "$fichier")"', { ...defauts(), boucle: true });
  const r = bashAccepte(s, 'b.sh');
  assert.ok(r.ok, r.err);
  assert.ok(s.includes('  cp "$fichier"'), 'le corps est indenté dans la boucle');
});

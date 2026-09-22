/**
 * Générateur de script « comptes, groupes, arborescence et droits » pour Linux.
 *
 * À partir d'une liste de groupes, d'utilisateurs (avec leurs groupes
 * secondaires) et d'une arborescence de dossiers/fichiers annotée de droits
 * (propriétaire, groupe, mode), produit un script bash idempotent qui crée les
 * groupes, les utilisateurs et leur /home, pose l'arborescence puis applique
 * les droits (chown/chmod, récursif au besoin) — plus un bloc de vérification.
 *
 * Réutilise `enFichier` des autres configurateurs (wrapper principal() sûr en
 * collage terminal). Injection-safe : logins, groupes et modes sont validés.
 */
import { enFichier } from './web-db-scripts';

export const MDP = 'Azerty77';

export type Utilisateur = { login: string; groupes: string[] };
export type Noeud = { path: string; dir: boolean; owner: string; group: string; mode: string; recursif: boolean };
export type SectionUsers = { id: 'comptes' | 'arbo' | 'verif'; titre: string; code: string; fichier: string };

export type ParamsUsers = {
  groupes: string;         // textarea, un groupe par ligne
  utilisateurs: string;    // textarea, « login [groupe1 groupe2 …] » par ligne
  arbo: string;            // textarea, « chemin [owner:group] [mode] [R] » par ligne
  motDePasse: boolean;     // poser le mot de passe du labo sur chaque compte
  shell: string;           // shell de connexion (ex. /bin/bash)
};

const NOM_RE = /^[a-z_][a-z0-9_-]*\$?$/;  // login/groupe POSIX
const MODE_RE = /^[0-7]{3,4}$/;
export const nomValide = (s: string) => NOM_RE.test(s);

/** Groupes déclarés (un par ligne), dédupliqués et validés. */
export function listeGroupes(txt: string): string[] {
  const vus = new Set<string>();
  for (const l of txt.split('\n')) {
    const g = l.trim().split(/[\s,;]+/)[0]?.toLowerCase();
    if (g && nomValide(g)) vus.add(g);
  }
  return [...vus];
}

/** Utilisateurs : premier mot = login, le reste = groupes secondaires. */
export function listeUtilisateurs(txt: string): Utilisateur[] {
  const out: Utilisateur[] = [];
  const vus = new Set<string>();
  for (const l of txt.split('\n')) {
    const t = l.trim().split(/[\s,;]+/).filter(Boolean);
    if (!t.length) continue;
    const login = t[0].toLowerCase();
    if (!nomValide(login) || vus.has(login)) continue;
    vus.add(login);
    const groupes = t.slice(1).map(g => g.toLowerCase()).filter(nomValide);
    out.push({ login, groupes });
  }
  return out;
}

/** Tous les groupes à créer : ceux déclarés, plus ceux référencés par un utilisateur. */
export function tousLesGroupes(p: ParamsUsers): string[] {
  const s = new Set(listeGroupes(p.groupes));
  for (const u of listeUtilisateurs(p.utilisateurs)) for (const g of u.groupes) s.add(g);
  return [...s];
}

/** Une ligne d'arborescence : « chemin [owner:group] [mode] [R] ». */
export function listeArbo(txt: string): Noeud[] {
  const out: Noeud[] = [];
  for (const brut of txt.split('\n')) {
    const l = brut.trim();
    if (!l || l.startsWith('#')) continue;
    const t = l.split(/\s+/);
    const chemin = t[0];
    if (!chemin.startsWith('/')) continue;   // chemins absolus seulement
    const dir = chemin.endsWith('/');
    let owner = '', group = '', mode = '', recursif = false;
    for (const tok of t.slice(1)) {
      if (tok === 'R' || tok === '-R') recursif = true;
      else if (MODE_RE.test(tok)) mode = tok;
      else if (/^[a-z_][a-z0-9_-]*:[a-z_][a-z0-9_-]*$/.test(tok)) { const [o, g] = tok.split(':'); owner = o; group = g; }
      else if (/^[a-z_][a-z0-9_-]*:$/.test(tok)) owner = tok.slice(0, -1);   // owner seul « alice: »
    }
    out.push({ path: chemin.replace(/\/+$/, dir ? '/' : ''), dir, owner, group, mode, recursif });
  }
  return out;
}

const q = (s: string) => `"${s.replace(/"/g, '\\"')}"`;   // chemins entre guillemets

// ── en-tête commun ───────────────────────────────────────────────────────────
function entete(titre: string): string[] {
  return [
    '#!/usr/bin/env bash',
    `# ${titre}`,
    '# A executer en root :  sudo bash ce-script.sh',
    '# Genere par le configurateur du site TSSR - environnement de formation.',
    'set -euo pipefail',
    '[ "$(id -u)" -eq 0 ] || { echo "Lance-moi en root :  sudo bash $0"; exit 1; }',
    'etape() { echo; echo "==== $*"; }',
  ];
}

// ── ① groupes + utilisateurs ─────────────────────────────────────────────────
export function scriptComptes(p: ParamsUsers): string {
  const groupes = tousLesGroupes(p);
  const users = listeUtilisateurs(p.utilisateurs);
  const l = [...entete('Groupes et utilisateurs'), ''];
  l.push('etape "Groupes"');
  for (const g of groupes) l.push(`groupadd -f ${g} && echo "  groupe ${g}"`);
  l.push('');
  l.push('etape "Utilisateurs (creation, mot de passe, groupes secondaires)"');
  for (const u of users) {
    l.push(`# --- ${u.login} ---`);
    l.push(`id -u ${u.login} >/dev/null 2>&1 || useradd -m -s ${p.shell || '/bin/bash'} ${u.login}`);
    if (p.motDePasse) l.push(`echo "${u.login}:${MDP}" | chpasswd`);
    if (u.groupes.length) l.push(`usermod -aG ${u.groupes.join(',')} ${u.login}`);
    l.push(`echo "  ${u.login} : $(id -nG ${u.login})"`);
  }
  l.push('');
  l.push('echo "OK : groupes et utilisateurs en place."');
  return enFichier(l.join('\n'), '~/comptes.sh');
}

// ── ② arborescence + droits ──────────────────────────────────────────────────
export function scriptArbo(p: ParamsUsers): string {
  const noeuds = listeArbo(p.arbo);
  const dirs = noeuds.filter(n => n.dir);
  const files = noeuds.filter(n => !n.dir);
  const l = [...entete('Arborescence et droits'), ''];

  if (dirs.length) {
    l.push('etape "Dossiers"');
    l.push('mkdir -p \\');
    dirs.forEach((n, i) => l.push(`    ${q(n.path.replace(/\/$/, ''))}${i < dirs.length - 1 ? ' \\' : ''}`));
    l.push('');
  }
  if (files.length) {
    l.push('etape "Fichiers"');
    for (const n of files) {
      l.push(`mkdir -p "$(dirname ${q(n.path)})" && touch ${q(n.path)}`);
    }
    l.push('');
  }

  // Les droits en dernier : un chmod/chown recursif s'applique alors au contenu deja cree.
  const avecDroits = noeuds.filter(n => n.owner || n.group || n.mode);
  if (avecDroits.length) {
    l.push('etape "Droits (proprietaire, groupe, mode)"');
    for (const n of avecDroits) {
      const r = n.recursif ? '-R ' : '';
      if (n.owner || n.group) {
        const spec = n.group ? `${n.owner}:${n.group}` : n.owner;   // propriétaire seul → pas de « : » (on ne touche pas au groupe)
        l.push(`chown ${r}${spec} ${q(n.path)}`);
      }
      if (n.mode) l.push(`chmod ${r}${n.mode} ${q(n.path)}`);
    }
    l.push('');
  }
  l.push('echo "OK : arborescence et droits en place."');
  return enFichier(l.join('\n'), '~/arbo.sh');
}

// ── ③ vérifier ───────────────────────────────────────────────────────────────
export function scriptVerif(p: ParamsUsers): string {
  const groupes = tousLesGroupes(p);
  const users = listeUtilisateurs(p.utilisateurs);
  const racines = racinesArbo(p);
  const l: string[] = [];
  l.push('# Verifier comptes, groupes et droits.');
  l.push('');
  l.push('# 1) Les groupes et leurs membres (fin du fichier /etc/group) :');
  l.push(`getent group ${groupes.join(' ')}`);
  l.push('');
  l.push('# 2) Les utilisateurs (fin de /etc/passwd) :');
  l.push(`tail -n ${Math.max(users.length, 1)} /etc/passwd`);
  if (users.length) {
    l.push('# groupes d\'un utilisateur :');
    l.push(`id ${users[0].login}`);
  }
  l.push('');
  l.push('# 3) L\'arborescence et les droits (recursif) :');
  for (const r of racines) {
    l.push(`ls -lR ${q(r)}`);
  }
  l.push('command -v tree >/dev/null 2>&1 && tree ' + (racines[0] ? q(racines[0]) : '/home') + ' || echo "(installe l\'affichage arbre :  apt install tree)"');
  l.push('');
  l.push('# Astuce : pour livrer le fichier des droits (comme dans une eval) :');
  l.push(`#   cd ${racines[0] ? racines[0].replace(/\/[^/]*\/?$/, '') || '/home' : '/home'} && sudo ls -lR > droits.txt`);
  return l.join('\n');
}

/** Les dossiers racines de l'arborescence (les plus courts, pour lister/afficher). */
function racinesArbo(p: ParamsUsers): string[] {
  const chemins = listeArbo(p.arbo).map(n => n.path.replace(/\/$/, '')).filter(Boolean).sort();
  const racines: string[] = [];
  for (const c of chemins) {
    if (!racines.some(r => c === r || c.startsWith(r + '/'))) racines.push(c);
  }
  return racines;
}

export function genererScriptsUsers(p: ParamsUsers): SectionUsers[] {
  return [
    { id: 'comptes', titre: '① Groupes et utilisateurs', code: scriptComptes(p), fichier: 'comptes.sh' },
    { id: 'arbo', titre: '② Arborescence et droits', code: scriptArbo(p), fichier: 'arbo.sh' },
    { id: 'verif', titre: '③ Vérifier', code: scriptVerif(p), fichier: 'verif-comptes.txt' },
  ];
}

/** Version « console » : le script s'enregistre dans ~/ puis se lance. */
export function pourConsoleUsers(sec: SectionUsers): string {
  if (sec.id === 'verif') return sec.code;
  const cible = `~/${sec.id}.sh`;
  return `cat > ${cible} <<'FIN_SCRIPT_TSSR'\n${sec.code}\nFIN_SCRIPT_TSSR\nsudo bash ${cible}`;
}

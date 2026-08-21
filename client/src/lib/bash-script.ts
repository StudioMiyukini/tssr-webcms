/* Le squelette d'un script d'administration Bash.
 *
 * Un script n'est pas difficile a ecrire : il est difficile a ecrire *surement*.
 * Les fautes qui coutent cher sont toujours les memes -- une variable vide dans
 * un `rm -rf`, une erreur au milieu qui n'arrete rien, un fichier temporaire
 * laisse derriere, deux executions simultanees.
 *
 * La generation vit ici plutot que dans le composant : c'est du texte produit a
 * partir de reglages, donc quelque chose qui se teste. Et ce qui se teste ici,
 * c'est que le resultat soit du Bash valide dans toutes les combinaisons.
 */

export type Cle = 'strict' | 'usage' | 'journal' | 'root' | 'depend' | 'verrou' | 'nettoyage' | 'confirme' | 'boucle' | 'dryrun';

export interface Brique {
  cle: Cle;
  titre: string;
  /** Ce que la brique évite. Pas ce qu'elle fait — ce qu'elle évite. */
  pourquoi: string;
  defaut: boolean;
}

export const BRIQUES: Brique[] = [
  { cle: 'strict', titre: 'Arrêt à la première erreur', defaut: true, pourquoi: 'Sans `set -e`, un script continue après un échec : la sauvegarde rate, et l’effacement qui suit s’exécute quand même. `set -u` refuse les variables non définies — c’est ce qui transforme `rm -rf "$DEST/"` en `rm -rf /` quand DEST est vide.' },
  { cle: 'usage', titre: 'Arguments et aide', defaut: true, pourquoi: 'Un script sans message d’usage est relancé au hasard six mois plus tard. Les arguments sont vérifiés avant d’agir, pas au milieu.' },
  { cle: 'journal', titre: 'Journalisation horodatée', defaut: true, pourquoi: 'Un script lancé par cron n’a pas de terminal : sans journal, un échec nocturne ne laisse aucune trace. La sortie va à la fois à l’écran et dans un fichier.' },
  { cle: 'root', titre: 'Vérifier les droits root', defaut: false, pourquoi: 'Sans cette vérification, le script s’exécute à moitié puis échoue sur la première opération privilégiée — en laissant l’état entre deux.' },
  { cle: 'depend', titre: 'Vérifier les commandes requises', defaut: true, pourquoi: '`rsync: command not found` au milieu d’une sauvegarde est un échec silencieux si l’on n’a pas `set -e`. On vérifie tout au départ.' },
  { cle: 'verrou', titre: 'Empêcher deux exécutions simultanées', defaut: false, pourquoi: 'Une tâche cron qui dure plus longtemps que son intervalle finit par se chevaucher. Deux sauvegardes concurrentes sur la même destination corrompent le résultat.' },
  { cle: 'nettoyage', titre: 'Nettoyage garanti (trap)', defaut: true, pourquoi: 'Un fichier temporaire laissé derrière remplit `/tmp` à la longue. Le `trap` s’exécute même en cas d’erreur ou d’interruption au clavier.' },
  { cle: 'confirme', titre: 'Demander confirmation', defaut: false, pourquoi: 'Pour les scripts destructeurs lancés à la main. Ignoré automatiquement hors terminal, pour ne pas bloquer cron indéfiniment.' },
  { cle: 'boucle', titre: 'Boucle sur des fichiers', defaut: false, pourquoi: 'La bonne forme, avec `find -print0` : un nom de fichier contenant une espace casse la version naïve `for f in $(ls)`, et personne ne s’en aperçoit avant le jour où ça compte.' },
  { cle: 'dryrun', titre: 'Mode simulation (--dry-run)', defaut: false, pourquoi: 'Pouvoir montrer ce que le script ferait sans le faire. C’est ce qui permet de le relire une dernière fois avant de le lâcher sur des données réelles.' },
];


/** Le script, assemblé. Chaque brique n'ajoute que ce qui la concerne. */
export function fabriquer(nom: string, desc: string, cmds: string, on: Record<Cle, boolean>): string {
  const l: string[] = [];
  const binaire = nom.replace(/[^A-Za-z0-9._-]/g, '') || 'script';

  l.push('#!/usr/bin/env bash');
  l.push(`# ${binaire} — ${desc || 'script d’administration'}`);
  l.push('');

  if (on.strict) {
    l.push('# -e : on s’arrête à la première erreur. -u : une variable non définie');
    l.push('# est une erreur, et non une chaîne vide. -o pipefail : un échec au');
    l.push('# milieu d’un pipe compte, alors que seul le dernier code comptait.');
    l.push('set -euo pipefail');
    l.push('IFS=$\'\\n\\t\'   # le découpage par défaut inclut l’espace : les noms de fichiers en souffrent');
    l.push('');
  }

  l.push('SCRIPT="$(basename "$0")"');
  if (on.journal) l.push('JOURNAL="/var/log/${SCRIPT%.sh}.log"');
  if (on.verrou) l.push('VERROU="/var/lock/${SCRIPT%.sh}.lock"');
  if (on.dryrun) l.push('SIMULATION=0');
  l.push('');

  if (on.journal) {
    l.push('# Écrit à l’écran ET dans le journal : un script lancé par cron n’a pas');
    l.push('# de terminal, et un échec nocturne doit laisser une trace.');
    l.push('log() { printf \'%s  %s\\n\' "$(date \'+%F %T\')" "$*" | tee -a "$JOURNAL" >&2; }');
    l.push('mourir() { log "ERREUR: $*"; exit 1; }');
    l.push('');
  } else {
    l.push('log() { printf \'%s  %s\\n\' "$(date \'+%F %T\')" "$*" >&2; }');
    l.push('mourir() { log "ERREUR: $*"; exit 1; }');
    l.push('');
  }

  if (on.usage) {
    l.push('usage() {');
    l.push('  cat <<FIN');
    l.push(`Usage : \${SCRIPT} [options] <source> <destination>`);
    l.push('');
    l.push(`  ${desc || 'Décrire ici ce que fait le script.'}`);
    l.push('');
    l.push('Options :');
    l.push('  -h, --help      afficher cette aide');
    if (on.dryrun) l.push('  -n, --dry-run   montrer ce qui serait fait, sans le faire');
    l.push('FIN');
    l.push('}');
    l.push('');
  }

  if (on.nettoyage) {
    l.push('# Le trap s’exécute quoi qu’il arrive : fin normale, erreur, ou Ctrl-C.');
    l.push('# Sans lui, un script interrompu laisse ses fichiers temporaires derrière.');
    l.push('TEMPO="$(mktemp -d)"');
    l.push('nettoyer() {');
    l.push('  local code=$?');
    l.push('  rm -rf "$TEMPO"');
    if (on.verrou) l.push('  [ -n "${VERROU:-}" ] && rm -f "$VERROU"');
    l.push('  exit "$code"');
    l.push('}');
    l.push('trap nettoyer EXIT INT TERM');
    l.push('');
  }

  if (on.usage) {
    l.push('# Les options d’abord, les arguments positionnels ensuite.');
    l.push('while [ $# -gt 0 ]; do');
    l.push('  case "$1" in');
    l.push('    -h|--help) usage; exit 0 ;;');
    if (on.dryrun) l.push('    -n|--dry-run) SIMULATION=1; shift ;;');
    l.push('    --) shift; break ;;');
    l.push('    -*) usage; mourir "option inconnue : $1" ;;');
    l.push('    *) break ;;');
    l.push('  esac');
    l.push('done');
    l.push('');
    l.push('[ $# -ge 2 ] || { usage; mourir "il faut une source et une destination"; }');
    l.push('SOURCE="$1"');
    l.push('DESTINATION="$2"');
    l.push('');
  }

  if (on.root) {
    l.push('# Vérifié AVANT d’agir : à mi-chemin, l’état serait entre deux.');
    l.push('[ "$(id -u)" -eq 0 ] || mourir "ce script doit être lancé en root (sudo $SCRIPT)"');
    l.push('');
  }

  if (on.depend) {
    l.push('# Tout ce dont on a besoin, vérifié d’un coup au départ.');
    l.push('for outil in rsync tar; do');
    l.push('  command -v "$outil" >/dev/null 2>&1 || mourir "commande absente : $outil"');
    l.push('done');
    l.push('');
  }

  if (on.verrou) {
    l.push('# Un verrou par descripteur : il disparaît tout seul si le script est tué,');
    l.push('# alors qu’un simple fichier témoin resterait et bloquerait les exécutions');
    l.push('# suivantes jusqu’à ce qu’on le supprime à la main.');
    l.push('exec 9>"$VERROU" || mourir "impossible d’ouvrir le verrou $VERROU"');
    l.push('flock -n 9 || mourir "une autre exécution est déjà en cours"');
    l.push('');
  }

  if (on.confirme) {
    l.push('# Sauté hors terminal : sinon cron attendrait une réponse indéfiniment.');
    l.push('if [ -t 0 ]; then');
    l.push('  read -rp "Confirmer l’opération sur ${DESTINATION:-la cible} ? [o/N] " reponse');
    l.push('  case "$reponse" in o|O|oui|Oui) ;; *) log "annulé par l’opérateur"; exit 0 ;; esac');
    l.push('fi');
    l.push('');
  }

  if (on.dryrun) {
    l.push('# Une seule porte pour toutes les actions : en simulation, on affiche.');
    l.push('faire() {');
    l.push('  if [ "$SIMULATION" -eq 1 ]; then log "[simulation] $*"; else log "$*"; "$@"; fi');
    l.push('}');
    l.push('');
  }

  l.push('log "=== début ==="');
  l.push('');

  const corps = cmds.split('\n').map(x => x.trimEnd()).filter(x => x.length);
  if (on.boucle) {
    l.push('# -print0 et read -d \'\' : la seule forme qui survit aux noms de fichiers');
    l.push('# contenant une espace, un saut de ligne ou une apostrophe.');
    l.push('while IFS= read -r -d \'\' fichier; do');
    l.push('  log "traitement : $fichier"');
    for (const c of (corps.length ? corps : ['# ton traitement ici'])) l.push(`  ${on.dryrun ? 'faire ' : ''}${c}`);
    l.push('done < <(find "$SOURCE" -type f -name \'*.log\' -print0)');
  } else if (corps.length) {
    for (const c of corps) l.push(`${on.dryrun ? 'faire ' : ''}${c}`);
  } else {
    l.push(`${on.dryrun ? 'faire ' : ''}# ── ton traitement ici ──`);
  }

  l.push('');
  l.push('log "=== fin, sans erreur ==="');
  if (!on.nettoyage) l.push('exit 0');

  return l.join('\n');
}


/* Cours « Linux : scripts Bash ».
   Reprend le plan de la fiche existante (squelette, variables, conditions,
   boucles, exemple complet) et le porte au niveau des autres cours : ce que
   chaque construction évite, les guillemets qui décident de tout, et les
   fautes qui ne se voient qu'en production.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-linux-bash.ts */
import { block, note, sh, flow, table, styleLinux, liens, publier } from './_cours-linux';
import type { PageBlock } from '../client/src/lib/page-blocks';

const PAGE = {
  slug: 'linux-bash',
  title: 'Linux : scripts Bash',
  excerpt: 'Automatiser ce qu’on fait dix fois à la main. Le squelette d’un script qui s’arrête quand ça rate, les variables et pourquoi elles se mettent entre guillemets, les conditions et les boucles, les codes de retour — et les quatre fautes qui ne se voient qu’au premier nom de fichier contenant une espace.',
};

const blocks: PageBlock[] = [
  block('hero', {
    eyebrow: 'Cours · Linux',
    title: PAGE.title,
    subtitle: 'Ce qui est fait dix fois à la main sera fait onze fois différemment.',
  }),
  styleLinux,

  block('html', { html: '<p>Un script Bash n’est rien d’autre que les commandes qu’on tape, écrites dans un fichier. C’est ce qui le rend facile à commencer — et trompeur : une suite de commandes justes peut produire un script dangereux, parce qu’un script continue après une erreur alors qu’un humain, lui, s’arrête pour regarder.</p>' }),

  block('heading', { level: 2, text: '1) Le squelette' }),
  flow(`#!/usr/bin/env bash          <- le shebang : QUI doit executer ce fichier
set -euo pipefail            <- le mode strict, explique juste en dessous

# Ce que fait le script, en une ligne.
# Auteur, date — on saura a qui demander dans deux ans.

... les commandes ...`),
  sh(`nano sauvegarde.sh
chmod +x sauvegarde.sh       # sans ca : « Permission denied »
./sauvegarde.sh              # le ./ est obligatoire : le dossier courant
                             # n'est pas dans le PATH, et c'est voulu`),
  note('blue', '💡 Le shebang, et pourquoi <code>/usr/bin/env</code>', '<p><code>#!/bin/bash</code> désigne un chemin fixe. <code>#!/usr/bin/env bash</code> demande au système où se trouve bash — le script fonctionne alors aussi sur les systèmes où il est ailleurs (BSD, macOS). C’est la forme à prendre par défaut.</p>'),

  block('heading', { level: 2, text: '2) Le mode strict : les trois lignes qui changent tout' }),
  table(['Option', 'Sans elle', 'Ce qu’elle évite'], [
    ['<code>set -e</code>', 'Le script continue après une erreur.', 'La sauvegarde échoue, et l’effacement qui suit s’exécute quand même.'],
    ['<code>set -u</code>', 'Une variable non définie vaut une chaîne vide.', '<code>rm -rf "$DEST/"</code> avec <code>DEST</code> vide devient <code>rm -rf /</code>.'],
    ['<code>set -o pipefail</code>', 'Seul le dernier maillon d’un tube compte.', '<code>cmd_qui_rate | tee log</code> est considéré comme réussi.'],
  ]),
  sh(`#!/usr/bin/env bash
set -euo pipefail

# Bonus : le decoupage par defaut inclut l'ESPACE, ce qui casse les
# noms de fichiers. On le restreint a la tabulation et au saut de ligne.
IFS=$'\\n\\t'`),
  note('red', '🚫 La démonstration en deux lignes', '<div class="lx-cmd">DEST=""            # une variable mal remplie, ca arrive\nrm -rf "$DEST/"    # sans set -u : devient  rm -rf /</div><p>Ce n’est pas une histoire qu’on raconte en cours : c’est un incident classique, qui a effacé des serveurs réels. <code>set -u</code> aurait arrêté le script sur « DEST: unbound variable ».</p>'),

  block('heading', { level: 2, text: '3) Variables et guillemets' }),
  sh(`nom="Debian"                 # PAS d'espace autour du =
chemin="/srv/site"
aujourdhui=$(date +%F)       # $(...) : le resultat d'une commande
nb=$(( 3 * 7 ))              # $(( )) : un calcul

echo "$nom installe le $aujourdhui"
echo "Il reste $nb jours"`),
  note('red', '🚫 La faute la plus fréquente : oublier les guillemets', '<div class="lx-cmd">fichier="mon rapport.txt"\n\nrm $fichier      # devient : rm mon rapport.txt  -> DEUX fichiers\nrm "$fichier"    # devient : rm "mon rapport.txt" -> le bon</div><p>Sans guillemets, le shell découpe la valeur sur les espaces avant d’exécuter. Tout marche pendant des mois — jusqu’au premier fichier dont le nom en contient une. <strong>Règle : toute variable s’écrit <code>"$variable"</code>.</strong></p>'),
  table(['Écriture', 'Ce qu’elle fait'], [
    ['<code>"$var"</code>', 'La valeur, protégée. <strong>C’est ce qu’on veut presque toujours.</strong>'],
    ['<code>\'$var\'</code>', 'Le texte littéral <code>$var</code> — les simples quotes n’interprètent rien.'],
    ['<code>${var}</code>', 'Utile pour coller : <code>"${nom}_sauvegarde"</code>.'],
    ['<code>"${var:-defaut}"</code>', 'La valeur, ou <code>defaut</code> si elle est vide ou absente.'],
    ['<code>"$@"</code>', '<strong>Tous les arguments</strong>, chacun protégé. À préférer à <code>$*</code>.'],
  ]),

  block('heading', { level: 2, text: '4) Les arguments' }),
  sh(`#!/usr/bin/env bash
set -euo pipefail

# $0 = le nom du script, $1 le premier argument, $# leur nombre
if [ $# -lt 2 ]; then
  echo "Usage : $(basename "$0") <source> <destination>" >&2
  exit 1                     # un code de sortie NON NUL = echec
fi

source="$1"
destination="$2"

[ -d "$source" ] || { echo "Dossier introuvable : $source" >&2; exit 1; }`),
  note('blue', '💡 Les messages d’erreur vont sur la sortie d’erreur', '<p>Le <code>&gt;&amp;2</code> envoie le message sur <em>stderr</em> plutôt que sur la sortie normale. Cela permet à l’appelant de séparer les deux : <code>./script.sh > resultat.txt</code> garde le résultat propre, les erreurs restant à l’écran.</p>'),

  block('heading', { level: 2, text: '5) Les tests et les conditions' }),
  table(['Test', 'Vrai si'], [
    ['<code>-f fichier</code>', 'C’est un fichier ordinaire, et il existe.'],
    ['<code>-d dossier</code>', 'C’est un dossier.'],
    ['<code>-r</code> / <code>-w</code> / <code>-x</code>', 'On peut le lire / écrire / exécuter.'],
    ['<code>-z "$v"</code>', 'La variable est vide.'],
    ['<code>-n "$v"</code>', 'Elle n’est pas vide.'],
    ['<code>"$a" = "$b"</code>', 'Deux <strong>chaînes</strong> identiques.'],
    ['<code>$a -eq $b</code>', 'Deux <strong>nombres</strong> égaux (<code>-lt</code>, <code>-gt</code>, <code>-ne</code>…).'],
  ]),
  sh(`if [ -f "/etc/debian_version" ]; then
  echo "Une Debian"
elif [ -f "/etc/redhat-release" ]; then
  echo "Une Red Hat"
else
  echo "Autre chose"
fi

# Raccourcis, tres lisibles pour un cas simple
[ -d /srv/site ] || mkdir -p /srv/site      # || = si la commande a ECHOUE
systemctl is-active --quiet ssh && echo "SSH tourne"   # && = si REUSSI

# Plusieurs cas : case est plus clair qu'une pile de elif
case "\${1:-}" in
  start)   demarrer ;;
  stop)    arreter ;;
  status)  etat ;;
  *)       echo "Usage : $0 {start|stop|status}" >&2 ; exit 1 ;;
esac`),
  note('yellow', '⚠️ Chaînes et nombres n’utilisent pas les mêmes opérateurs', '<p><code>=</code> compare des chaînes, <code>-eq</code> compare des nombres. <code>[ "10" = "10.0" ]</code> est faux, <code>[ 10 -eq 10 ]</code> est vrai. Utiliser <code>=</code> sur des nombres marche souvent par hasard — jusqu’au jour où l’un est écrit <code>07</code>.</p>'),

  block('heading', { level: 2, text: '6) Les boucles' }),
  sh(`# Sur une liste ecrite
for service in ssh apache2 mariadb; do
  echo "--- $service"
  systemctl is-active "$service" || echo "  arrete !"
done

# Sur des fichiers : le motif direct, sans passer par ls
for f in /var/log/*.log; do
  echo "$f : $(wc -l < "$f") lignes"
done

# Lire un fichier ligne par ligne
while IFS= read -r ligne; do
  echo "-> $ligne"
done < liste.txt

# Compter
for i in {1..5}; do echo "essai $i"; done`),
  note('red', '🚫 <code>for f in $(ls)</code> — la forme à ne pas apprendre', '<p>Elle casse au premier nom contenant une espace, et se comporte de façon imprévisible s’il contient un <code>*</code>. Le motif <code>for f in /chemin/*</code> fait le même travail correctement. Pour une recherche récursive, la seule forme qui résiste à tout :</p><div class="lx-cmd">while IFS= read -r -d \'\' f; do\n  echo "$f"\ndone &lt; &lt;(find /var/log -name \'*.log\' -print0)</div><p><code>-print0</code> et <code>-d \'\'</code> séparent par un octet nul — le seul caractère qu’un nom de fichier ne peut pas contenir.</p>'),

  block('heading', { level: 2, text: '7) Les fonctions et les codes de retour' }),
  sh(`log()    { printf '%s  %s\\n' "$(date '+%F %T')" "$*" >&2; }
mourir() { log "ERREUR: $*"; exit 1; }

verifier_service() {
  local nom="$1"                      # local : la variable ne fuit pas dehors
  systemctl is-active --quiet "$nom"  # le code de retour de la fonction
}                                     # est celui de sa derniere commande

if verifier_service ssh; then
  log "ssh est actif"
else
  mourir "ssh est arrete"
fi`),
  table(['Code de sortie', 'Sens'], [
    ['<code>0</code>', '<strong>Succès.</strong> C’est la convention Unix : zéro veut dire « tout va bien ».'],
    ['<code>1</code> à <code>125</code>', 'Échec. À toi de leur donner un sens et de le documenter.'],
    ['<code>127</code>', 'Commande introuvable.'],
    ['<code>130</code>', 'Interrompu au clavier (Ctrl-C).'],
  ]),
  note('blue', '💡 <code>$?</code> contient le code de la dernière commande', '<div class="lx-cmd">grep -q "motif" fichier\necho $?        # 0 si trouve, 1 sinon</div><p>C’est ce que testent <code>if</code>, <code>&amp;&amp;</code> et <code>||</code>. Un script appelé par cron ou par un autre script doit donc <strong>sortir avec le bon code</strong> : c’est sa seule façon de dire qu’il a échoué.</p>'),

  block('heading', { level: 2, text: '8) Un script complet : sauvegarde' }),
  sh(`#!/usr/bin/env bash
#
# sauvegarde.sh — archive un dossier, et fait le menage des anciennes.
# Usage : ./sauvegarde.sh /srv/site /mnt/backup
#
set -euo pipefail
IFS=$'\\n\\t'

SCRIPT="$(basename "$0")"
GARDER=7                                  # jours de retention

log()    { printf '%s  %s\\n' "$(date '+%F %T')" "$*" >&2; }
mourir() { log "ERREUR: $*"; exit 1; }

# --- Verifications AVANT d'agir -------------------------------------
[ $# -eq 2 ] || { echo "Usage : $SCRIPT <source> <destination>" >&2; exit 1; }
source="$1"
destination="$2"

[ -d "$source" ]      || mourir "source introuvable : $source"
[ -d "$destination" ] || mourir "destination introuvable : $destination"
command -v tar >/dev/null || mourir "tar n'est pas installe"

# --- Le travail -----------------------------------------------------
horodatage="$(date +%Y%m%d-%H%M)"
archive="$destination/$(basename "$source")-$horodatage.tar.gz"

log "sauvegarde de $source vers $archive"
tar -czf "$archive" -C "$(dirname "$source")" "$(basename "$source")"

taille="$(du -h "$archive" | cut -f1)"
log "archive creee : $taille"

# --- Menage ---------------------------------------------------------
log "suppression des archives de plus de $GARDER jours"
find "$destination" -name '*.tar.gz' -mtime "+$GARDER" -print -delete

log "termine sans erreur"`),
  note('green', '🎯 Lire ce script à l’envers', '<p>Les vingt premières lignes ne sauvegardent rien : elles <strong>refusent de travailler</strong> si quelque chose ne va pas. C’est la proportion normale d’un script d’administration — l’essentiel du code sert à ne pas faire de bêtise, et c’est ce qui le distingue d’une suite de commandes.</p>'),

  block('heading', { level: 2, text: '9) Mettre au point' }),
  sh(`bash -n script.sh        # la SYNTAXE seule, sans rien executer
bash -x script.sh        # trace chaque ligne avec ses variables remplacees
shellcheck script.sh     # l'analyseur : sudo apt install shellcheck

# Tracer une partie seulement du script
set -x
... la zone qui pose probleme ...
set +x`),
  note('green', '🎯 <code>shellcheck</code> attrape ce qu’aucune relecture ne voit', '<p>Variables non protégées, comparaisons douteuses, <code>cd</code> dont on ne teste pas l’échec, redirections inutiles. Il explique chaque avertissement avec un lien. Une demi-heure d’installation, et il trouve dans le premier script des fautes qu’on aurait découvertes en production.</p>'),

  block('heading', { level: 2, text: '10) Faire tourner le script tout seul' }),
  sh(`# Le rendre executable et le placer ou il sera trouve
sudo install -m 755 sauvegarde.sh /usr/local/bin/sauvegarde

# En cron : ATTENTION, le PATH de cron est minimal
sudo crontab -e
# 30 2 * * *  /usr/local/bin/sauvegarde /srv/site /mnt/backup >> /var/log/sauvegarde.log 2>&1`),
  note('yellow', '⚠️ Le script marche à la main et échoue en cron', '<p>C’est le grand classique, et il a presque toujours la même cause : <strong>l’environnement</strong>. Cron ne charge ni ton <code>.bashrc</code>, ni ton <code>PATH</code> complet, et ne connaît pas ton dossier courant. On écrit donc les <strong>chemins absolus</strong>, on redirige la sortie vers un fichier — sinon elle part dans un courriel local que personne ne lit — et on teste avec <code>env -i /usr/local/bin/sauvegarde …</code> pour reproduire un environnement vide.</p>'),
  note('blue', '💡 Les timers systemd font mieux', '<p>Journaux intégrés, état consultable, rattrapage si la machine était éteinte. Voir <a href="/pages/linux-systemd">le cours systemd</a>. Cron reste partout, il faut donc savoir le lire.</p>'),

  note('green', '🔧 L’outil qui écrit le squelette pour toi', '<p>Le <a href="/pages/outils-linux">constructeur de script Bash</a> assemble tout ce qui précède — mode strict, arguments, journal, vérifications, verrou, nettoyage par <code>trap</code> — et explique ce que chaque garde-fou évite. Le résultat est vérifié : <code>bash -n</code> l’accepte dans les 1024 combinaisons d’options.</p>'),

  liens('/pages/linux-bash'),
];

publier(PAGE, blocks).catch(e => { console.error(e); process.exit(1); });

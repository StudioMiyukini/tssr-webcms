#!/usr/bin/env bash
# Verifie le mecanisme des questions, isole du reste de l'installeur.
# On extrait les fonctions du script reel plutot que de les recopier : un test
# qui teste une copie ne teste rien.
set -uo pipefail

SRC="${1:-$(dirname "$0")/install-webcms.sh}"
TMP="$(mktemp)"

# Sortie neutre + les trois fonctions de question, telles qu'elles sont ecrites.
{
  echo 'detail() { printf "   [detail] %s\n" "$*"; }'
  echo 'avert()  { printf "   [!] %s\n" "$*"; }'
  echo 'info()   { printf "   %s\n" "$*"; }'
  sed -n '/^demander() {/,/^}/p'          "$SRC"
  sed -n '/^demander_oui_non() {/,/^}/p'  "$SRC"
} > "$TMP"
# shellcheck disable=SC1090
. "$TMP"
rm -f "$TMP"

echecs=0
verifie() { # verifie "libelle" "attendu" "obtenu"
  if [ "$2" = "$3" ]; then printf '  [ok]    %-46s = %s\n' "$1" "$3"
  else printf '  [ECHEC] %-46s attendu [%s], obtenu [%s]\n' "$1" "$2" "$3"; echecs=$((echecs+1)); fi
}

echo "== A. Mode interactif : la question DOIT etre posee =="
INTERACTIF=1
PORT=""; unset WEBCMS_PORT
printf '9999\n' | { demander PORT "Port interne" "3470" >/dev/null; }
# La valeur lue dans un sous-shell ne remonte pas : on refait sans le tube.
PORT=""
demander PORT "Port interne" "3470" <<< "9999" >/dev/null
verifie "reponse saisie prise en compte" "9999" "$PORT"

PORT=""
demander PORT "Port interne" "3470" <<< "" >/dev/null
verifie "Entree vide -> valeur par defaut" "3470" "$PORT"

echo
echo "== B. Variable d'environnement : elle prime, sans question =="
INTERACTIF=1
PORT=""; export WEBCMS_PORT=8080
demander PORT "Port interne" "3470" <<< "9999" >/dev/null
verifie "WEBCMS_PORT prime sur la saisie" "8080" "$PORT"
unset WEBCMS_PORT

echo
echo "== C. Mode non interactif : defaut sans rien demander =="
INTERACTIF=0
PORT=""
demander PORT "Port interne" "3470" >/dev/null
verifie "defaut applique" "3470" "$PORT"

DOSSIER=""; export WEBCMS_DOSSIER=/srv/site
demander DOSSIER "Dossier" "/opt/webcms" >/dev/null
verifie "environnement respecte en non interactif" "/srv/site" "$DOSSIER"
unset WEBCMS_DOSSIER

echo
echo "== D. Questions oui/non =="
INTERACTIF=1
AVEC_NGINX=""
demander_oui_non AVEC_NGINX "nginx ?" "o" <<< "n" >/dev/null
verifie "reponse n" "n" "$AVEC_NGINX"
AVEC_NGINX=""
demander_oui_non AVEC_NGINX "nginx ?" "o" <<< "" >/dev/null
verifie "Entree vide -> defaut o" "o" "$AVEC_NGINX"
AVEC_NGINX=""; export WEBCMS_AVEC_NGINX=n
demander_oui_non AVEC_NGINX "nginx ?" "o" <<< "o" >/dev/null
verifie "environnement prime" "n" "$AVEC_NGINX"
unset WEBCMS_AVEC_NGINX

echo
echo "== E. Le defaut du depot est bien propose =="
INTERACTIF=1
DEF_SOURCE_GIT="https://github.com/StudioMiyukini/tssr-webcms.git"
SOURCE_GIT=""
demander SOURCE_GIT "Depot" "$DEF_SOURCE_GIT" <<< "" >/dev/null
verifie "Entree vide -> depot du projet" "$DEF_SOURCE_GIT" "$SOURCE_GIT"

echo
echo "== F. Non-regression : les variables ne doivent PAS etre pre-remplies =="
# C'est le defaut d'origine : « PORT="${WEBCMS_PORT:-3470}" » en tete du script
# rendait la variable non vide, et demander() la croyait fournie par
# l'utilisateur — la question n'etait jamais posee.
for v in PORT DOSSIER UTILISATEUR ADMIN_USER; do
  if grep -qE "^${v}=\"\$\{WEBCMS_${v}:-[^}]+\}\"" "$SRC"; then
    printf '  [ECHEC] %-46s pre-remplie en tete du script
' "$v"; echecs=$((echecs+1))
  else
    printf '  [ok]    %-46s part vide
' "$v"
  fi
done

echo
if [ "$echecs" -eq 0 ]; then echo "TOUS LES TESTS PASSENT"; exit 0
else echo "$echecs test(s) en echec"; exit 1; fi

#!/usr/bin/env bash
# smoke-test-toolbox.sh — vérifie la boîte à outils SANS tout exécuter.
#
# À lancer sur un Debian de test (idéalement en root pour l'audit) :
#     bash scripts/smoke-test-toolbox.sh [chemin/vers/tssr-toolbox.sh]
#
# Contrôle : syntaxe (bash -n), shellcheck si présent, chargement des fonctions
# en « mode librairie » (TSSR_TOOLBOX_LIB=1, sans lancer le menu), présence des
# séquences, et exécution de la séquence LECTURE SEULE « statut ».
set -uo pipefail

S="${1:-client/public/tssr-toolbox.sh}"
[ -f "$S" ] || { echo "Script introuvable : $S"; exit 1; }
ret=0

echo "== 1) Syntaxe (bash -n) =="
bash -n "$S" && echo "  OK" || { echo "  ÉCHEC"; ret=1; }

echo "== 2) shellcheck =="
if command -v shellcheck >/dev/null 2>&1; then
    shellcheck -S warning "$S" && echo "  (aucun avertissement)" || echo "  (voir avertissements ci-dessus)"
else
    echo "  shellcheck absent — installe-le :  sudo apt install shellcheck"
fi

echo "== 3) Chargement en mode librairie (sans menu) =="
# shellcheck disable=SC1090
if TSSR_TOOLBOX_LIB=1 source "$S"; then echo "  OK"; else echo "  ÉCHEC du chargement"; ret=1; fi

echo "== 4) Présence des séquences =="
for f in seq_statut seq_paquets seq_config_ip seq_ssh __ssh_hardening __ssh_spa \
         seq_user seq_apache seq_nginx seq_bastion seq_glpi seq_backup \
         seq_zabbix seq_sceller seq_parefeu seq_audit seq_provision; do
    if declare -F "$f" >/dev/null; then echo "  $f ✓"; else echo "  $f MANQUE"; ret=1; fi
done

echo "== 5) Séquence lecture seule : statut =="
# log_init n'est pas appelé en mode lib : on l'initialise pour le test.
LOG="/tmp/smoke-toolbox.log"; : > "$LOG"
if declare -F seq_statut >/dev/null; then seq_statut || true; fi

echo
[ "$ret" -eq 0 ] && echo "SMOKE-TEST OK." || echo "SMOKE-TEST : des points à corriger (voir ci-dessus)."
exit "$ret"

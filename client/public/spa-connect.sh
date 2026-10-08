#!/usr/bin/env bash
# spa-connect — « knock » SPA (fwknop) puis SSH, en une commande, multi-hôtes.
#
# Lit tes hôtes dans ~/.fwknoprc (les stanzas [nom]) et, pour celui demandé,
# envoie le paquet SPA avec fwknop, puis ouvre la session SSH.
#
# Usage :
#   spa-connect <stanza> [utilisateur] [-- args ssh...]
#   spa-connect --list
#
# Exemples :
#   spa-connect prod                 # knock "prod" puis ssh $USER@<SPA_SERVER de prod>
#   spa-connect prod admin           # ssh admin@...
#   spa-connect prod admin -- -v     # passe -v à ssh
#   SPA_RESOLVE=1 spa-connect prod    # ajoute -R à fwknop (derrière un NAT)
#
# Prérequis : fwknop-client installé, et ~/.fwknoprc renseigné (voir la fiche
# générée par spa-install.sh).
set -uo pipefail

RC="${FWKNOPRC:-$HOME/.fwknoprc}"
[ -f "$RC" ] || { echo "Fichier introuvable : $RC (installe fwknop-client et crée tes stanzas)"; exit 1; }

# Liste des stanzas déclarées.
if [ "${1:-}" = "--list" ] || [ "${1:-}" = "-l" ]; then
    echo "Hôtes définis dans $RC :"
    grep -oE '^\[[^]]+\]' "$RC" | tr -d '[]' | sed 's/^/  - /'
    exit 0
fi

STANZA="${1:-}"
[ -n "$STANZA" ] || { echo "Usage : spa-connect <stanza> [utilisateur] [-- args ssh...]  (ou --list)"; exit 1; }
shift

# Utilisateur SSH : 2e argument s'il ne commence pas par '-', sinon $USER.
SSH_USER="$USER"
if [ "${1:-}" != "" ] && [[ "${1:-}" != -* ]]; then SSH_USER="$1"; shift; fi
# On retire un éventuel séparateur -- avant les arguments ssh.
[ "${1:-}" = "--" ] && shift

# Lit une valeur (clé) à l'intérieur d'une stanza du .fwknoprc.
valeur() {
    awk -v s="[$1]" -v k="$2" '
        $0==s {dedans=1; next}
        /^\[/  {dedans=0}
        dedans && $1==k {print $2; exit}' "$RC"
}

SRV="$(valeur "$STANZA" SPA_SERVER)"
ACC="$(valeur "$STANZA" ACCESS)"       # ex: tcp/22
[ -n "$SRV" ] || { echo "Stanza inconnue ou sans SPA_SERVER : [$STANZA] (essaie : spa-connect --list)"; exit 1; }
PORT="${ACC##*/}"; [[ "$PORT" =~ ^[0-9]+$ ]] || PORT=22

command -v fwknop >/dev/null 2>&1 || { echo "fwknop (client) introuvable : sudo apt install fwknop-client"; exit 1; }

echo "➤ Knock SPA vers [$STANZA] ($SRV)…"
fwknop -n "$STANZA" ${SPA_RESOLVE:+-R} || { echo "Échec du knock SPA (clé ? horloge ? réseau ?)."; exit 1; }

echo "➤ Connexion : ssh -p $PORT $SSH_USER@$SRV $*"
exec ssh -p "$PORT" "$@" "$SSH_USER@$SRV"

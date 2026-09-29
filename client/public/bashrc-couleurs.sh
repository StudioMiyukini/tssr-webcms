#!/usr/bin/env bash
# ============================================================================
#  bashrc-couleurs.sh — TSSR / miyukini
#  Invite de commande colorée : VERT pour l'utilisateur, ROUGE pour root.
#  Installe aussi « tree ». Idempotent : relançable sans risque.
#
#  Récupérer depuis la VM Debian, en root :
#     curl -fsSL https://tssr.miyukini.com/bashrc-couleurs.sh | sudo bash
#  ou :
#     wget -qO- https://tssr.miyukini.com/bashrc-couleurs.sh | sudo bash
# ============================================================================
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Lance-moi en root :  curl -fsSL https://tssr.miyukini.com/bashrc-couleurs.sh | sudo bash"; exit 1; }
export DEBIAN_FRONTEND=noninteractive

echo "== Installation de tree =="
apt-get update -qq
apt-get install -y tree

# Bloc ajouté à la fin des .bashrc. $EUID est évalué à l'ouverture du shell :
# root -> rouge, tout autre utilisateur -> vert. Écrit tel quel (littéral).
read -r -d '' BLOC <<'BASHRC' || true
# >>> TSSR prompt couleurs >>>
# Invite : vert pour l'utilisateur, rouge pour root, chemin en bleu.
if [ "$EUID" -eq 0 ]; then
    PS1='\[\e[1;31m\]\u@\h\[\e[0m\]:\[\e[1;34m\]\w\[\e[0m\]# '
else
    PS1='\[\e[1;32m\]\u@\h\[\e[0m\]:\[\e[1;34m\]\w\[\e[0m\]\$ '
fi
# Couleurs pour ls / grep + raccourcis utiles
export LS_OPTIONS='--color=auto'
alias ls='ls --color=auto'
alias ll='ls -alF --color=auto'
alias la='ls -A --color=auto'
alias grep='grep --color=auto'
# <<< TSSR prompt couleurs <<<
BASHRC

appliquer() {
    local f="$1"
    [ -e "$f" ] || return 0
    # Retire un éventuel ancien bloc, puis rajoute (idempotence).
    sed -i '/# >>> TSSR prompt couleurs >>>/,/# <<< TSSR prompt couleurs <<</d' "$f"
    printf '\n%s\n' "$BLOC" >> "$f"
}

echo "== Prompt coloré (vert user / rouge root) =="
# root
touch /root/.bashrc
appliquer /root/.bashrc

# l'utilisateur qui a lancé sudo (pour qu'il ait le prompt vert)
if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != root ]; then
    H=$(getent passwd "$SUDO_USER" | cut -d: -f6)
    if [ -n "$H" ]; then
        touch "$H/.bashrc"
        appliquer "$H/.bashrc"
        chown "$SUDO_USER": "$H/.bashrc" 2>/dev/null || true
    fi
fi

# les futurs comptes créés hériteront du prompt
[ -e /etc/skel/.bashrc ] && appliquer /etc/skel/.bashrc

echo
echo "OK : tree installé, prompt vert (utilisateur) / rouge (root)."
echo "Applique tout de suite dans ce terminal :  source ~/.bashrc"
echo "(ou ouvre simplement un nouveau terminal)"

#!/usr/bin/env bash
# ============================================================================
#  tssr-lib.sh — Socle commun de la suite d'outils TSSR.
#  -----------------------------------------------------------------------------
#  Bibliothèque à SOURCER (pas à exécuter). Fournit : affichage coloré, journal,
#  gates/étapes, détection de distribution (Debian/RHEL) et commandes abstraites
#  (apt/dnf, sudo/wheel, nftables/firewalld, service ssh/sshd).
#
#  Utilisation dans un script :
#     source /chemin/tssr-lib.sh      # ou : source <(curl -fsSL https://tssr.miyukini.com/tssr-lib.sh)
#     log_init monscript
#     detect_distro
# ============================================================================

# ── Affichage ────────────────────────────────────────────────────────────────
if [ -t 1 ]; then
    RAZ=$'\e[0m'; G=$'\e[1m'; VERT=$'\e[32m'; ROUGE=$'\e[31m'; JAUNE=$'\e[33m'; BLEU=$'\e[34m'; CYAN=$'\e[36m'
else RAZ=""; G=""; VERT=""; ROUGE=""; JAUNE=""; BLEU=""; CYAN=""; fi

LOG="${LOG:-/dev/null}"
journal() { printf '%s  %s\n' "$(date '+%F %T')" "$1" >> "$LOG" 2>/dev/null; }
log_init() {
    local nom="${1:-tssr}" d="/var/log/tssr"
    mkdir -p "$d" 2>/dev/null || d="/tmp"
    LOG="$d/${nom}-$(date +%Y%m%d-%H%M%S).log"
    : > "$LOG" 2>/dev/null || LOG="/tmp/${nom}.log"
    journal "=== $nom ==="
}
titre() { echo; echo "${G}${BLEU}── $* ──${RAZ}"; }
info()  { echo "  ${CYAN}•${RAZ} $*"; }
ok()    { echo "  ${VERT}[ OK ]${RAZ} $*"; }
avert() { echo "  ${JAUNE}[AVERT]${RAZ} $*"; }
err()   { echo "  ${ROUGE}[ERREUR]${RAZ} $*"; journal "ERREUR: $*"; }

besoin_root() { [ "$(id -u)" -eq 0 ] || { err "à lancer en root (sudo)."; return 1; }; }

# ── Saisies interactives (pour les outils interactifs) ───────────────────────
demander() {
    local p="$1" __var="$2" def="${3:-}" ans
    if [ -n "$def" ]; then read -rp "  $p [${def}] : " ans; ans="${ans:-$def}"; else read -rp "  $p : " ans; fi
    printf -v "$__var" '%s' "$ans"
}
confirmer() {
    local q="$1" def="${2:-o}" ans
    if [ "$def" = "o" ]; then read -rp "  $q [O/n] : " ans; else read -rp "  $q [o/N] : " ans; fi
    ans="${ans,,}"; ans="${ans:-$def}"
    [ "$ans" = "o" ] || [ "$ans" = "oui" ] || [ "$ans" = "y" ]
}

# ── Étapes & gates ───────────────────────────────────────────────────────────
TSSR_FAILS=0
# etape "desc" cmd...  : échoue bruyamment (pour un flux interactif).
etape() { local d="$1"; shift; info "… $d"; if "$@" >> "$LOG" 2>&1; then ok "$d"; else err "$d (voir $LOG)"; return 1; fi; }
# faire "desc" cmd...  : continue-on-error, compte les échecs (pour un flux AUTOMATIQUE).
faire() { local d="$1"; shift; if "$@" >> "$LOG" 2>&1; then ok "$d"; else avert "$d — échec (voir $LOG)"; TSSR_FAILS=$((TSSR_FAILS+1)); return 1; fi; }
gate()  { local d="$1"; shift; if "$@" >> "$LOG" 2>&1; then ok "GATE OK — $d"; return 0; else err "GATE ÉCHEC — $d"; return 1; fi; }

# ── Détection de distribution & commandes abstraites ─────────────────────────
PKG="inconnu"; FAMILLE="inconnu"; GRP_ADMIN="sudo"; FW="aucun"; MAC="aucun"; SSHD_SVC="ssh"; NTP_SVC="chrony"
detect_distro() {
    . /etc/os-release 2>/dev/null
    if   command -v apt-get >/dev/null 2>&1; then PKG=apt; FAMILLE=debian; GRP_ADMIN=sudo;  MAC=apparmor; SSHD_SVC=ssh;  NTP_SVC=chrony
    elif command -v dnf     >/dev/null 2>&1; then PKG=dnf; FAMILLE=rhel;   GRP_ADMIN=wheel; MAC=selinux;  SSHD_SVC=sshd; NTP_SVC=chronyd
    elif command -v yum     >/dev/null 2>&1; then PKG=yum; FAMILLE=rhel;   GRP_ADMIN=wheel; MAC=selinux;  SSHD_SVC=sshd; NTP_SVC=chronyd
    fi
    if   command -v firewall-cmd >/dev/null 2>&1; then FW=firewalld
    elif command -v nft          >/dev/null 2>&1; then FW=nftables
    elif command -v ufw          >/dev/null 2>&1; then FW=ufw
    fi
}
pkg_update_index() { case "$PKG" in apt) apt-get update ;; dnf) dnf -y makecache ;; yum) yum -y makecache ;; esac; }
pkg_upgrade()      { case "$PKG" in apt) DEBIAN_FRONTEND=noninteractive apt-get -y upgrade ;; dnf) dnf -y upgrade ;; yum) yum -y update ;; esac; }
pkg_install()      { case "$PKG" in apt) DEBIAN_FRONTEND=noninteractive apt-get install -y "$@" ;; dnf) dnf install -y "$@" ;; yum) yum install -y "$@" ;; esac; }
pkg_upgradable()   { case "$PKG" in apt) apt-get -s upgrade 2>/dev/null | grep -c '^Inst ' ;; dnf|yum) dnf -q check-update 2>/dev/null | grep -cE '^[a-zA-Z0-9]' ;; *) echo 0 ;; esac; }
reboot_needed() {
    if [ "$PKG" = apt ]; then [ -f /var/run/reboot-required ]; return; fi
    if command -v needs-restarting >/dev/null 2>&1; then needs-restarting -r >/dev/null 2>&1 && return 1 || return 0; fi
    return 1
}
svc_enable() { systemctl enable --now "$1" >> "$LOG" 2>&1; }
fw_ouvrir_port() {
    case "$FW" in
        firewalld) firewall-cmd --permanent --add-port="$1"/tcp >/dev/null 2>&1; firewall-cmd --reload >/dev/null 2>&1 ;;
        ufw)       ufw allow "$1"/tcp >/dev/null 2>&1 ;;
    esac
}

# ── Garde-fou : ne pas exécuter directement ──────────────────────────────────
if ! (return 0 2>/dev/null); then
    echo "tssr-lib.sh est une BIBLIOTHÈQUE : source-la depuis un autre script, ne l'exécute pas."
    exit 0
fi

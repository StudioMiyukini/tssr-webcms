#!/usr/bin/env bash
# =============================================================================
#  install-webcms.sh — installation du CMS sur un serveur Linux
#
#  Familles prises en charge : Debian/Ubuntu (apt) et RHEL/Rocky/Alma (dnf).
#  Le script est interactif par defaut ; toutes les reponses peuvent aussi
#  etre fournies par variables d'environnement pour un deploiement automatise.
#
#  Principe : chaque etape se termine par un VERROU (gate) qui verifie le
#  resultat avant de passer a la suivante. Un echec s'arrete la, avec le motif
#  et la commande de diagnostic — plutot que de continuer sur une base fausse.
#
#  Usage :
#     sudo ./install-webcms.sh                  # interactif
#     sudo ./install-webcms.sh --dry-run        # montre sans rien faire
#     sudo ./install-webcms.sh --non-interactif # utilise les variables d'env
#     sudo ./install-webcms.sh --verifier       # controle une installation
# =============================================================================

set -euo pipefail
IFS=$'\n\t'

VERSION="1.0.0"
NODE_MIN_MAJEUR=20          # better-sqlite3 12.x exige Node 20 ou plus
NODE_CIBLE="22"             # version installee si celle de la distribution est trop ancienne

# ── Reponses (surchargeables par l'environnement) ────────────────────────────
DOMAINE="${WEBCMS_DOMAINE:-}"
PORT="${WEBCMS_PORT:-3470}"
DOSSIER="${WEBCMS_DOSSIER:-/opt/webcms}"
UTILISATEUR="${WEBCMS_UTILISATEUR:-webcms}"
ADMIN_USER="${WEBCMS_ADMIN_USER:-admin}"
ADMIN_PASSWORD="${WEBCMS_ADMIN_PASSWORD:-}"
SOURCE_GIT="${WEBCMS_SOURCE_GIT:-}"
SOURCE_ARCHIVE="${WEBCMS_SOURCE_ARCHIVE:-}"
AVEC_NGINX="${WEBCMS_AVEC_NGINX:-}"
AVEC_TLS="${WEBCMS_AVEC_TLS:-}"
COURRIEL_TLS="${WEBCMS_COURRIEL_TLS:-}"
OUVRIR_PAREFEU="${WEBCMS_OUVRIR_PAREFEU:-}"

DRY_RUN=0
INTERACTIF=1
MODE_VERIF=0

# ── Sortie ──────────────────────────────────────────────────────────────────
if [ -t 1 ] && [ "${TERM:-dumb}" != "dumb" ]; then
  C_T=$'\e[1;36m'; C_OK=$'\e[1;32m'; C_W=$'\e[1;33m'; C_E=$'\e[1;31m'; C_D=$'\e[2m'; C_0=$'\e[0m'
else
  C_T=''; C_OK=''; C_W=''; C_E=''; C_D=''; C_0=''
fi

etape()  { printf '\n%s== %s ==%s\n' "$C_T" "$*" "$C_0"; }
info()   { printf '   %s\n' "$*"; }
ok()     { printf '   %s[ok]%s %s\n' "$C_OK" "$C_0" "$*"; }
avert()  { printf '   %s[!]%s  %s\n' "$C_W" "$C_0" "$*"; }
detail() { printf '   %s%s%s\n' "$C_D" "$*" "$C_0"; }

echoue() {
  printf '\n%s[ECHEC]%s %s\n' "$C_E" "$C_0" "$1"
  [ $# -ge 2 ] && printf '   Pour diagnostiquer : %s\n' "$2"
  printf "   Rien n'a ete demarre. L'installation s'arrete ici.\n"
  exit 1
}

# VERROU : la condition doit etre vraie, sinon on s'arrete.
gate() {
  local libelle="$1" diag="${2:-}"; shift 2 || shift 1
  if [ "$DRY_RUN" = 1 ]; then detail "verrou (simule) : $libelle"; return 0; fi
  if "$@"; then ok "$libelle"; else echoue "$libelle" "$diag"; fi
}

lancer() {
  if [ "$DRY_RUN" = 1 ]; then detail "\$ $*"; return 0; fi
  "$@"
}

# ── Questions ───────────────────────────────────────────────────────────────
demander() {                      # demander VARIABLE "question" "defaut"
  local var="$1" question="$2" defaut="${3:-}" reponse
  local actuelle="${!var:-}"
  if [ -n "$actuelle" ] || [ "$INTERACTIF" = 0 ]; then
    [ -z "$actuelle" ] && printf -v "$var" '%s' "$defaut"
    detail "$question -> ${!var:-(vide)}"
    return 0
  fi
  if [ -n "$defaut" ]; then
    read -r -p "   $question [$defaut] : " reponse || true
    printf -v "$var" '%s' "${reponse:-$defaut}"
  else
    read -r -p "   $question : " reponse || true
    printf -v "$var" '%s' "$reponse"
  fi
}

demander_oui_non() {              # demander_oui_non VARIABLE "question" "o|n"
  local var="$1" question="$2" defaut="${3:-o}" reponse
  local actuelle="${!var:-}"
  if [ -n "$actuelle" ] || [ "$INTERACTIF" = 0 ]; then
    [ -z "$actuelle" ] && printf -v "$var" '%s' "$defaut"
    detail "$question -> ${!var}"
    return 0
  fi
  while true; do
    read -r -p "   $question [o/n] ($defaut) : " reponse || true
    reponse="${reponse:-$defaut}"
    case "${reponse,,}" in
      o|oui|y|yes) printf -v "$var" 'o'; return 0 ;;
      n|non|no)    printf -v "$var" 'n'; return 0 ;;
      *) avert "Repondre o ou n." ;;
    esac
  done
}

demander_secret() {               # demander_secret VARIABLE "question"
  local var="$1" question="$2" a b
  [ -n "${!var:-}" ] && { detail "$question -> (fourni par l'environnement)"; return 0; }
  if [ "$INTERACTIF" = 0 ]; then
    printf -v "$var" '%s' "$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)"
    avert "Mot de passe genere automatiquement — il sera affiche a la fin."
    return 0
  fi
  while true; do
    read -r -s -p "   $question (vide = genere) : " a; echo
    if [ -z "$a" ]; then
      printf -v "$var" '%s' "$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)"
      info "Mot de passe genere — il sera affiche a la fin."
      return 0
    fi
    if [ "${#a}" -lt 12 ]; then avert "12 caracteres minimum."; continue; fi
    read -r -s -p "   Confirmer : " b; echo
    [ "$a" = "$b" ] && { printf -v "$var" '%s' "$a"; return 0; }
    avert "Les deux saisies different."
  done
}

# ─────────────────────────────────────────────────────────────────────────────
#  0. Arguments
# ─────────────────────────────────────────────────────────────────────────────
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run|--simulation) DRY_RUN=1 ;;
    --non-interactif|--yes|-y) INTERACTIF=0 ;;
    --verifier|--check) MODE_VERIF=1 ;;
    --version) echo "install-webcms.sh $VERSION"; exit 0 ;;
    -h|--help)
      sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echoue "Option inconnue : $1" "$0 --help" ;;
  esac
  shift
done

printf '%s\n' "==============================================================="
printf '  Installation du CMS — version %s\n' "$VERSION"
[ "$DRY_RUN" = 1 ] && printf '  %sMODE SIMULATION : aucune modification ne sera faite.%s\n' "$C_W" "$C_0"
printf '%s\n' "==============================================================="

# ── Entree standard ─────────────────────────────────────────────────────────
# Si le script est canalise (« curl ... | bash »), stdin porte LE TEXTE DU
# SCRIPT et non le clavier : le premier « read » y consommerait le reste, et
# le script s'arreterait en plein milieu, sans message. On reprend donc le
# clavier sur /dev/tty ; a defaut, on bascule en non-interactif plutot que de
# poser des questions auxquelles personne ne peut repondre.
if [ "$INTERACTIF" = 1 ] && [ ! -t 0 ]; then
  if [ -c /dev/tty ] && { : </dev/tty; } 2>/dev/null; then
    exec </dev/tty
    avert "Entree standard canalisee — clavier repris sur /dev/tty."
  else
    INTERACTIF=0
    avert "Entree standard non interactive et /dev/tty indisponible."
    avert "Bascule en mode --non-interactif : les valeurs par defaut et les"
    avert "variables WEBCMS_* seront utilisees, et le mot de passe genere."
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
#  1. Controles prealables
# ─────────────────────────────────────────────────────────────────────────────
etape "1. Controles prealables"

[ "$(id -u)" -eq 0 ] || echoue "Ce script doit etre lance en root." "sudo $0"
ok "Execute en root"

[ -r /etc/os-release ] || echoue "/etc/os-release illisible : systeme non identifiable."
# shellcheck disable=SC1091
. /etc/os-release
DISTRO_ID="${ID:-inconnu}"
DISTRO_LIKE="${ID_LIKE:-}"
DISTRO_NOM="${PRETTY_NAME:-$DISTRO_ID}"

case "$DISTRO_ID $DISTRO_LIKE" in
  *debian*|*ubuntu*) FAMILLE="debian"; PKG="apt-get" ;;
  *rhel*|*fedora*|*centos*|*rocky*|*almalinux*) FAMILLE="redhat"; PKG="dnf" ;;
  *) echoue "Distribution non prise en charge : $DISTRO_NOM" "Familles supportees : Debian/Ubuntu, RHEL/Rocky/AlmaLinux" ;;
esac
ok "$DISTRO_NOM — famille $FAMILLE, gestionnaire $PKG"

command -v "$PKG" >/dev/null 2>&1 || echoue "$PKG introuvable alors que la famille est $FAMILLE."
command -v systemctl >/dev/null 2>&1 || echoue "systemd absent : ce script installe un service systemd."
ok "systemd present"

# Espace disque : node_modules + build depassent facilement 1 Go.
ESPACE_KO=$(df -Pk /opt 2>/dev/null | awk 'NR==2 {print $4}')
if [ -n "${ESPACE_KO:-}" ] && [ "$ESPACE_KO" -lt 2097152 ]; then
  avert "Moins de 2 Go libres sur /opt ($((ESPACE_KO / 1024)) Mo). L'installation peut echouer."
else
  ok "Espace disque suffisant"
fi

if [ "$DRY_RUN" = 0 ]; then
  if getent hosts deb.debian.org >/dev/null 2>&1 || getent hosts registry.npmjs.org >/dev/null 2>&1; then
    ok "Resolution DNS fonctionnelle"
  else
    echoue "Aucune resolution DNS." "cat /etc/resolv.conf ; ping -c1 1.1.1.1"
  fi
fi

# SELinux : on note l'etat, il servira aux etapes 7 et 8.
SELINUX_ACTIF=0
if command -v getenforce >/dev/null 2>&1 && [ "$(getenforce 2>/dev/null || echo Disabled)" = "Enforcing" ]; then
  SELINUX_ACTIF=1
  avert "SELinux est en mode Enforcing — le script posera les autorisations necessaires."
fi

# ─────────────────────────────────────────────────────────────────────────────
#  Mode verification seule
# ─────────────────────────────────────────────────────────────────────────────
if [ "$MODE_VERIF" = 1 ]; then
  etape "Verification d'une installation existante"
  systemctl is-active --quiet webcms && ok "service webcms actif" || avert "service webcms inactif"
  systemctl is-enabled --quiet webcms && ok "demarrage automatique actif" || avert "demarrage automatique inactif"
  PORT_TROUVE=$(ss -tlnp 2>/dev/null | grep -c "127.0.0.1:${PORT}" || true)
  [ "${PORT_TROUVE:-0}" -ge 1 ] && ok "ecoute sur 127.0.0.1:$PORT" || avert "rien n'ecoute sur 127.0.0.1:$PORT"
  CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/" || echo 000)
  [ "$CODE" = "200" ] && ok "HTTP 200 en local" || avert "HTTP $CODE en local"
  [ -f /etc/webcms/webcms.env ] && ok "fichier d'environnement present" || avert "/etc/webcms/webcms.env absent"
  if [ -f /etc/webcms/webcms.env ] && grep -q '^PUBLIC_BASE_URL=https\?://.' /etc/webcms/webcms.env; then
    ok "PUBLIC_BASE_URL renseigne"
  else
    avert "PUBLIC_BASE_URL absent ou vide — les liens de partage pointeront vers example.com"
  fi
  echo; info "Journal : journalctl -u webcms -n 50 --no-pager"
  exit 0
fi

# ─────────────────────────────────────────────────────────────────────────────
#  2. Questions
# ─────────────────────────────────────────────────────────────────────────────
etape "2. Configuration"
[ "$INTERACTIF" = 1 ] && info "Entree pour accepter la valeur entre crochets."

demander DOMAINE       "Nom de domaine public (ex. tssr.exemple.fr)" ""
demander PORT          "Port interne d'ecoute" "3470"
demander DOSSIER       "Dossier d'installation" "/opt/webcms"
demander UTILISATEUR   "Compte systeme du service" "webcms"
demander ADMIN_USER    "Identifiant administrateur du CMS" "admin"
demander_secret ADMIN_PASSWORD "Mot de passe administrateur"

if [ -z "$SOURCE_GIT" ] && [ -z "$SOURCE_ARCHIVE" ]; then
  demander SOURCE_GIT "Depot Git du site (vide si archive locale)" ""
  [ -z "$SOURCE_GIT" ] && demander SOURCE_ARCHIVE "Chemin de l'archive .tar.gz" ""
fi
[ -n "$SOURCE_GIT" ] || [ -n "$SOURCE_ARCHIVE" ] || echoue "Aucune source indiquee : ni depot Git, ni archive."
[ -n "$SOURCE_ARCHIVE" ] && [ ! -f "$SOURCE_ARCHIVE" ] && echoue "Archive introuvable : $SOURCE_ARCHIVE"

demander_oui_non AVEC_NGINX "Installer nginx en proxy inverse (port 80/443)" "o"
if [ "$AVEC_NGINX" = "o" ] && [ -n "$DOMAINE" ]; then
  demander_oui_non AVEC_TLS "Obtenir un certificat HTTPS avec Let's Encrypt" "o"
  [ "$AVEC_TLS" = "o" ] && demander COURRIEL_TLS "Courriel pour Let's Encrypt" ""
else
  AVEC_TLS="${AVEC_TLS:-n}"
fi
demander_oui_non OUVRIR_PAREFEU "Ouvrir le pare-feu" "o"

# Controles de coherence, avant toute action.
case "$PORT" in ''|*[!0-9]*) echoue "Port invalide : $PORT" ;; esac
[ "$PORT" -ge 1024 ] && [ "$PORT" -le 65535 ] || echoue "Port hors plage : $PORT (attendu 1024-65535)"
case "$DOSSIER" in /*) : ;; *) echoue "Le dossier d'installation doit etre un chemin absolu : $DOSSIER" ;; esac
if [ -n "$DOMAINE" ]; then
  case "$DOMAINE" in
    http*|*/*) echoue "Indiquer le domaine seul, sans http:// ni chemin : $DOMAINE" ;;
    *.*) : ;;
    *) avert "« $DOMAINE » ne ressemble pas a un domaine. Les liens de partage en dependent." ;;
  esac
fi
if [ "$AVEC_TLS" = "o" ] && [ -z "$COURRIEL_TLS" ]; then
  echoue "Let's Encrypt exige un courriel de contact."
fi

if [ -n "$DOMAINE" ]; then
  BASE_URL="https://$DOMAINE"
  [ "$AVEC_TLS" = "o" ] || BASE_URL="http://$DOMAINE"
else
  BASE_URL=""
  avert "Sans domaine, PUBLIC_BASE_URL restera vide : les balises de partage"
  avert "(og:url, og:image) pointeront vers example.com. A renseigner plus tard"
  avert "dans /etc/webcms/webcms.env, puis « systemctl restart webcms »."
fi

echo
info "Recapitulatif :"
detail "  domaine ........ ${DOMAINE:-(aucun)}"
detail "  URL publique ... ${BASE_URL:-(non definie)}"
detail "  port interne ... $PORT"
detail "  dossier ........ $DOSSIER"
detail "  compte ......... $UTILISATEUR"
detail "  source ......... ${SOURCE_GIT:-$SOURCE_ARCHIVE}"
detail "  nginx .......... $AVEC_NGINX     HTTPS : ${AVEC_TLS:-n}"
detail "  pare-feu ....... $OUVRIR_PAREFEU"
if [ "$INTERACTIF" = 1 ] && [ "$DRY_RUN" = 0 ]; then
  read -r -p "   Lancer l'installation ? [o/N] : " confirmation || true
  case "${confirmation,,}" in o|oui|y|yes) : ;; *) info "Abandon."; exit 0 ;; esac
fi

# ─────────────────────────────────────────────────────────────────────────────
#  3. Dependances systeme
# ─────────────────────────────────────────────────────────────────────────────
etape "3. Dependances systeme"

if [ "$FAMILLE" = "debian" ]; then
  export DEBIAN_FRONTEND=noninteractive
  lancer apt-get update -qq
  lancer apt-get install -y -qq ca-certificates curl gnupg git build-essential python3 openssl
else
  lancer dnf install -y -q ca-certificates curl gnupg2 git gcc gcc-c++ make python3 openssl
fi
gate "Outils de base installes" "which git curl python3" bash -c 'command -v git && command -v curl && command -v python3' >/dev/null

# ─────────────────────────────────────────────────────────────────────────────
#  4. Node.js
# ─────────────────────────────────────────────────────────────────────────────
etape "4. Node.js (>= $NODE_MIN_MAJEUR)"

version_node_majeure() {
  command -v node >/dev/null 2>&1 || { echo 0; return; }
  node -v 2>/dev/null | sed 's/^v//' | cut -d. -f1
}

NODE_ACTUEL="$(version_node_majeure)"
if [ "${NODE_ACTUEL:-0}" -ge "$NODE_MIN_MAJEUR" ]; then
  ok "Node $(node -v) deja present"
else
  info "Node absent ou trop ancien (majeure : ${NODE_ACTUEL:-aucune})."
  INSTALL_OK=0

  # 1er choix : le paquet de la distribution, s'il est assez recent.
  if [ "$FAMILLE" = "redhat" ]; then
    if dnf -q module list "nodejs:$NODE_CIBLE" >/dev/null 2>&1; then
      info "Activation du module nodejs:$NODE_CIBLE de la distribution."
      lancer dnf module reset -y -q nodejs || true
      lancer dnf module enable -y -q "nodejs:$NODE_CIBLE"
      lancer dnf install -y -q nodejs npm
      [ "$DRY_RUN" = 1 ] && INSTALL_OK=1 || { [ "$(version_node_majeure)" -ge "$NODE_MIN_MAJEUR" ] && INSTALL_OK=1; }
    fi
  else
    CANDIDAT=$(apt-cache policy nodejs 2>/dev/null | awk '/Candidat|Candidate/ {print $2}' | cut -d. -f1 | tr -d 'a-zA-Z:' || echo 0)
    if [ -n "${CANDIDAT:-}" ] && [ "${CANDIDAT:-0}" -ge "$NODE_MIN_MAJEUR" ] 2>/dev/null; then
      info "Le depot de la distribution propose Node $CANDIDAT."
      lancer apt-get install -y -qq nodejs npm
      [ "$DRY_RUN" = 1 ] && INSTALL_OK=1 || { [ "$(version_node_majeure)" -ge "$NODE_MIN_MAJEUR" ] && INSTALL_OK=1; }
    fi
  fi

  # 2e choix : NodeSource. Le script est TELECHARGE, montre, puis execute —
  # on ne canalise pas un curl dans un bash sans regarder ce qu'il contient.
  if [ "$INSTALL_OK" = 0 ]; then
    if [ "$FAMILLE" = "debian" ]; then
      URL_NS="https://deb.nodesource.com/setup_${NODE_CIBLE}.x"
    else
      URL_NS="https://rpm.nodesource.com/setup_${NODE_CIBLE}.x"
    fi
    avert "Le depot de la distribution ne fournit pas Node $NODE_MIN_MAJEUR ou plus."
    info  "Recours au depot NodeSource : $URL_NS"
    if [ "$DRY_RUN" = 0 ]; then
      TMP_NS="$(mktemp)"
      curl -fsSL "$URL_NS" -o "$TMP_NS" || echoue "Telechargement du script NodeSource impossible." "curl -v $URL_NS"
      detail "  taille : $(wc -c < "$TMP_NS") octets"
      detail "  sha256 : $(sha256sum "$TMP_NS" | cut -d' ' -f1)"
      if [ "$INTERACTIF" = 1 ]; then
        read -r -p "   Executer ce script d'ajout de depot ? [o/N] (v pour le voir) : " rep || true
        if [ "${rep,,}" = "v" ]; then less "$TMP_NS" || cat "$TMP_NS"; read -r -p "   Executer ? [o/N] : " rep || true; fi
        case "${rep,,}" in o|oui|y|yes) : ;; *) rm -f "$TMP_NS"; echoue "Installation de Node refusee. Installe Node >= $NODE_MIN_MAJEUR manuellement puis relance." ;; esac
      fi
      bash "$TMP_NS" >/dev/null
      rm -f "$TMP_NS"
      if [ "$FAMILLE" = "debian" ]; then apt-get install -y -qq nodejs; else dnf install -y -q nodejs; fi
    fi
  fi
fi
gate "Node >= $NODE_MIN_MAJEUR" "node -v" bash -c "[ \"\$(node -v 2>/dev/null | sed 's/^v//' | cut -d. -f1)\" -ge $NODE_MIN_MAJEUR ]"
gate "npm disponible" "npm -v" command -v npm >/dev/null

# ─────────────────────────────────────────────────────────────────────────────
#  5. Compte systeme et fichiers
# ─────────────────────────────────────────────────────────────────────────────
etape "5. Compte systeme et depot des fichiers"

if id "$UTILISATEUR" >/dev/null 2>&1; then
  ok "Compte $UTILISATEUR deja present"
else
  lancer useradd --system --home-dir "$DOSSIER" --shell /usr/sbin/nologin "$UTILISATEUR" 2>/dev/null \
    || lancer useradd --system --home-dir "$DOSSIER" --shell /sbin/nologin "$UTILISATEUR"
  ok "Compte systeme $UTILISATEUR cree"
fi

if [ -d "$DOSSIER/.git" ] && [ -n "$SOURCE_GIT" ]; then
  info "Depot deja present — mise a jour."
  lancer git -C "$DOSSIER" fetch --quiet --depth 1 origin
  lancer git -C "$DOSSIER" reset --quiet --hard origin/HEAD
elif [ -n "$SOURCE_GIT" ]; then
  [ -e "$DOSSIER" ] && [ -n "$(ls -A "$DOSSIER" 2>/dev/null || true)" ] \
    && echoue "$DOSSIER existe et n'est pas vide." "Vide-le, ou choisis un autre dossier."
  lancer mkdir -p "$DOSSIER"
  lancer git clone --quiet --depth 1 "$SOURCE_GIT" "$DOSSIER"
else
  lancer mkdir -p "$DOSSIER"
  lancer tar -xzf "$SOURCE_ARCHIVE" -C "$DOSSIER" --strip-components=1
fi
gate "Fichiers du site en place" "ls -al $DOSSIER" test -f "$DOSSIER/package.json"

lancer mkdir -p "$DOSSIER/logs" "$DOSSIER/uploads" "$DOSSIER/cloud" /etc/webcms
lancer chown -R "$UTILISATEUR:$UTILISATEUR" "$DOSSIER"

# ─────────────────────────────────────────────────────────────────────────────
#  6. Environnement et secrets
# ─────────────────────────────────────────────────────────────────────────────
etape "6. Environnement et secrets"

ENV_FICHIER="/etc/webcms/webcms.env"
if [ -f "$ENV_FICHIER" ]; then
  SAUVEGARDE="$ENV_FICHIER.$(date +%Y%m%d-%H%M%S).old"
  lancer cp -a "$ENV_FICHIER" "$SAUVEGARDE"
  avert "Fichier d'environnement existant sauvegarde en $SAUVEGARDE"
fi

SESSION_SECRET="$( [ "$DRY_RUN" = 1 ] && echo "(genere)" || openssl rand -base64 48 | tr -d '\n' )"

if [ "$DRY_RUN" = 0 ]; then
  umask 077
  cat > "$ENV_FICHIER" <<EOF
# Genere par install-webcms.sh le $(date -Iseconds)
# Toute modification demande : systemctl restart webcms
NODE_ENV=production
PORT=$PORT
DB_PATH=$DOSSIER/cms.sqlite
CLOUD_DIR=$DOSSIER/cloud

# URL publique — sert aux balises de partage (og:url, og:image) et aux liens
# des courriels. Laissee vide, le site s'annonce comme « example.com ».
PUBLIC_BASE_URL=$BASE_URL

SESSION_SECRET=$SESSION_SECRET
CMS_ADMIN_USER=$ADMIN_USER
CMS_ADMIN_PASSWORD=$ADMIN_PASSWORD

# Cookie « Secure » : exige HTTPS. Mettre 0 si le site reste en HTTP simple.
COOKIE_SECURE=$( [ "$AVEC_TLS" = "o" ] && echo 1 || echo 0 )

# --- Optionnel : envoi de courriels ---
#SMTP_HOST=
#SMTP_PORT=587
#SMTP_USER=
#SMTP_PASS=
#SMTP_FROM=
#ORDER_NOTIFY_TO=

# --- Optionnel : paiement Stripe ---
#STRIPE_SECRET_KEY=
#STRIPE_PUBLIC_KEY=
EOF
  chown root:"$UTILISATEUR" "$ENV_FICHIER"
  chmod 640 "$ENV_FICHIER"
fi
gate "Fichier d'environnement ecrit" "ls -l $ENV_FICHIER" test -f "$ENV_FICHIER"
gate "Secrets non lisibles par tous" "stat -c %a $ENV_FICHIER" bash -c "[ \"\$(stat -c %a '$ENV_FICHIER')\" = 640 ]"

# ─────────────────────────────────────────────────────────────────────────────
#  7. Dependances applicatives et construction
# ─────────────────────────────────────────────────────────────────────────────
etape "7. Dependances applicatives et construction"
info "Cette etape est la plus longue (plusieurs minutes)."

# npm ci complet : « tsx » et « vite » sont des dependances de developpement,
# et pourtant necessaires — l'un pour executer le serveur, l'autre pour batir
# le front. Un « --omit=dev » casserait le demarrage.
if [ -f "$DOSSIER/package-lock.json" ]; then
  lancer runuser -u "$UTILISATEUR" -- npm ci --prefix "$DOSSIER" --no-audit --no-fund
else
  avert "package-lock.json absent — npm install (versions non figees)."
  lancer runuser -u "$UTILISATEUR" -- npm install --prefix "$DOSSIER" --no-audit --no-fund
fi
gate "Dependances installees" "ls $DOSSIER/node_modules | head" test -d "$DOSSIER/node_modules/tsx"
gate "Module natif better-sqlite3 compile" "cd $DOSSIER && node -e \"require('better-sqlite3')\"" \
  bash -c "[ -d '$DOSSIER/node_modules/better-sqlite3' ]"

lancer runuser -u "$UTILISATEUR" -- bash -c "cd '$DOSSIER' && npm run build"
gate "Front construit" "ls $DOSSIER/dist" test -d "$DOSSIER/dist"

# ─────────────────────────────────────────────────────────────────────────────
#  8. Service systemd
# ─────────────────────────────────────────────────────────────────────────────
etape "8. Service systemd"

if [ "$DRY_RUN" = 0 ]; then
  cat > /etc/systemd/system/webcms.service <<EOF
[Unit]
Description=CMS TSSR (webcms)
Documentation=file://$DOSSIER/README.md
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$UTILISATEUR
Group=$UTILISATEUR
WorkingDirectory=$DOSSIER
EnvironmentFile=$ENV_FICHIER
ExecStart=/usr/bin/env node node_modules/tsx/dist/cli.mjs server/index.ts
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=webcms

# Confinement : le service n'a besoin d'ecrire que dans son propre dossier.
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
ReadWritePaths=$DOSSIER

[Install]
WantedBy=multi-user.target
EOF
fi
gate "Unite systemd ecrite" "cat /etc/systemd/system/webcms.service" test -f /etc/systemd/system/webcms.service

lancer systemctl daemon-reload
lancer systemctl enable --quiet webcms
lancer systemctl restart webcms

if [ "$DRY_RUN" = 0 ]; then
  info "Attente du demarrage..."
  for _ in $(seq 1 30); do
    systemctl is-active --quiet webcms && break
    sleep 1
  done
fi
gate "Service actif" "systemctl status webcms ; journalctl -u webcms -n 50 --no-pager" \
  systemctl is-active --quiet webcms
gate "Demarrage automatique arme" "systemctl is-enabled webcms" \
  systemctl is-enabled --quiet webcms

if [ "$DRY_RUN" = 0 ]; then
  CODE=""
  for _ in $(seq 1 20); do
    CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/" || echo 000)
    [ "$CODE" = "200" ] && break
    sleep 1
  done
fi
gate "Le site repond en HTTP 200 sur 127.0.0.1:$PORT" \
  "curl -v http://127.0.0.1:$PORT/ ; journalctl -u webcms -n 50 --no-pager" \
  bash -c "[ \"\$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$PORT/)\" = 200 ]"

# ─────────────────────────────────────────────────────────────────────────────
#  9. Proxy inverse
# ─────────────────────────────────────────────────────────────────────────────
if [ "$AVEC_NGINX" = "o" ]; then
  etape "9. nginx en proxy inverse"

  if [ "$FAMILLE" = "debian" ]; then lancer apt-get install -y -qq nginx; else lancer dnf install -y -q nginx; fi
  gate "nginx installe" "nginx -v" command -v nginx >/dev/null

  SERVER_NAME="${DOMAINE:-_}"
  if [ "$FAMILLE" = "debian" ]; then CONF_NGINX="/etc/nginx/sites-available/webcms.conf"; else CONF_NGINX="/etc/nginx/conf.d/webcms.conf"; fi

  if [ "$DRY_RUN" = 0 ]; then
    cat > "$CONF_NGINX" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $SERVER_NAME;

    # Le CMS gere lui-meme ses en-tetes de securite (CSP, HSTS...) :
    # on ne les duplique pas ici, on se contente de relayer.
    client_max_body_size 128M;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade           \$http_upgrade;
        proxy_set_header Connection        "upgrade";
        proxy_read_timeout 120s;
    }
}
EOF
    # Debian separe « disponible » et « active » ; Red Hat non.
    if [ "$FAMILLE" = "debian" ]; then
      ln -sf "$CONF_NGINX" /etc/nginx/sites-enabled/webcms.conf
      rm -f /etc/nginx/sites-enabled/default
    fi
  fi
  gate "Configuration nginx valide" "nginx -t" nginx -t

  # SELinux : sans cela, nginx recoit un « Permission denied » en se connectant
  # au port local — et le journal d'nginx n'en dit pas la cause.
  if [ "$SELINUX_ACTIF" = 1 ]; then
    lancer setsebool -P httpd_can_network_connect on
    ok "SELinux : httpd_can_network_connect active"
  fi

  lancer systemctl enable --quiet nginx
  lancer systemctl restart nginx
  gate "nginx actif" "systemctl status nginx" systemctl is-active --quiet nginx

  if [ "$AVEC_TLS" = "o" ]; then
    etape "9 bis. Certificat HTTPS"
    if [ "$FAMILLE" = "debian" ]; then
      lancer apt-get install -y -qq certbot python3-certbot-nginx
    else
      lancer dnf install -y -q certbot python3-certbot-nginx || lancer dnf install -y -q epel-release certbot python3-certbot-nginx
    fi
    gate "certbot installe" "certbot --version" command -v certbot >/dev/null
    avert "Le domaine $DOMAINE doit deja pointer vers cette machine, et les ports"
    avert "80 et 443 doivent etre joignables depuis internet."
    if lancer certbot --nginx -n --agree-tos -m "$COURRIEL_TLS" -d "$DOMAINE" --redirect; then
      ok "Certificat obtenu et renouvellement automatique arme"
    else
      avert "certbot a echoue — le site reste accessible en HTTP."
      avert "Reessayer plus tard : certbot --nginx -d $DOMAINE"
    fi
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# 10. Pare-feu
# ─────────────────────────────────────────────────────────────────────────────
if [ "$OUVRIR_PAREFEU" = "o" ]; then
  etape "10. Pare-feu"
  if command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld; then
    if [ "$AVEC_NGINX" = "o" ]; then
      lancer firewall-cmd --add-service=http --permanent
      [ "$AVEC_TLS" = "o" ] && lancer firewall-cmd --add-service=https --permanent
    else
      lancer firewall-cmd --add-port="$PORT/tcp" --permanent
    fi
    lancer firewall-cmd --reload
    ok "firewalld mis a jour"
  elif command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -qi '^Status: active'; then
    if [ "$AVEC_NGINX" = "o" ]; then
      lancer ufw allow 80/tcp
      [ "$AVEC_TLS" = "o" ] && lancer ufw allow 443/tcp
    else
      lancer ufw allow "$PORT/tcp"
    fi
    ok "ufw mis a jour"
  else
    avert "Aucun pare-feu actif detecte — rien a ouvrir."
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# 11. Verification finale
# ─────────────────────────────────────────────────────────────────────────────
etape "11. Verification finale"

gate "Service actif" "systemctl status webcms" systemctl is-active --quiet webcms
gate "Reponse locale HTTP 200" "curl -v http://127.0.0.1:$PORT/" \
  bash -c "[ \"\$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$PORT/)\" = 200 ]"

if [ "$AVEC_NGINX" = "o" ] && [ "$DRY_RUN" = 0 ]; then
  CODE_PROXY=$(curl -s -o /dev/null -w '%{http_code}' -H "Host: ${DOMAINE:-localhost}" http://127.0.0.1/ || echo 000)
  case "$CODE_PROXY" in
    200|301|302) ok "nginx relaie correctement (HTTP $CODE_PROXY)" ;;
    *) avert "nginx repond HTTP $CODE_PROXY — a verifier : journalctl -u nginx -n 30" ;;
  esac
fi

if [ -z "$BASE_URL" ]; then
  avert "PUBLIC_BASE_URL n'est pas renseigne. Les balises de partage annonceront"
  avert "« example.com ». A corriger dans $ENV_FICHIER des que le domaine est connu."
fi

# ─────────────────────────────────────────────────────────────────────────────
#  Fin
# ─────────────────────────────────────────────────────────────────────────────
cat <<FIN

${C_OK}===============================================================${C_0}
  Installation terminee
${C_OK}===============================================================${C_0}

  Site local ......... http://127.0.0.1:$PORT
$( [ -n "$DOMAINE" ] && printf '  Site public ........ %s\n' "${BASE_URL:-http://$DOMAINE}" )
  Administration ..... ${BASE_URL:-http://127.0.0.1:$PORT}/admin
  Identifiant ........ $ADMIN_USER
  Mot de passe ....... $ADMIN_PASSWORD

  ${C_W}Note-le maintenant : il n'est stocke qu'en clair dans
  $ENV_FICHIER (lisible par root seulement).${C_0}

  Commandes utiles
    systemctl status webcms          etat du service
    journalctl -u webcms -f          journal en direct
    systemctl restart webcms         apres modification de l'environnement
    $0 --verifier                    controler l'installation

  Sauvegarde — la totalite du contenu tient dans un fichier :
    $DOSSIER/cms.sqlite   (et $DOSSIER/uploads pour les medias)

FIN

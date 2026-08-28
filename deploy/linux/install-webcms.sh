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

# ── Reponses ────────────────────────────────────────────────────────────────
# Elles partent VIDES. Chaque fonction de question consulte elle-meme la
# variable d'environnement WEBCMS_<NOM> ; les valeurs par defaut ci-dessous ne
# servent qu'a la saisie interactive.
#
# Pre-remplir ici serait un piege : « demander() » verrait une variable non
# vide, croirait qu'elle vient de l'utilisateur, et ne poserait pas la question.
DOMAINE=""; PORT=""; DOSSIER=""; UTILISATEUR=""; ADMIN_USER=""
ADMIN_PASSWORD=""; SOURCE_GIT=""; SOURCE_ARCHIVE=""
AVEC_NGINX=""; AVEC_TLS=""; COURRIEL_TLS=""; OUVRIR_PAREFEU=""
CONTENU=""; CONTENU_URL=""; CONTENU_USER=""; CONTENU_PASSWORD=""

# Valeurs par defaut proposees a la saisie.
DEF_PORT="3470"
DEF_DOSSIER="/opt/webcms"
DEF_UTILISATEUR="webcms"
DEF_ADMIN_USER="admin"
DEF_SOURCE_GIT="https://github.com/StudioMiyukini/tssr-webcms.git"
DEF_CONTENU_URL="https://tssr.miyukini.com"
DEF_CONTENU_USER="admin"

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
  local env_var="WEBCMS_${var}" fournie
  fournie="${!env_var:-}"
  # Fournie par l'environnement : on la prend sans rien demander.
  if [ -n "$fournie" ]; then
    printf -v "$var" '%s' "$fournie"
    detail "$question -> ${!var} (environnement)"
    return 0
  fi
  if [ "$INTERACTIF" = 0 ]; then
    printf -v "$var" '%s' "$defaut"
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
  local env_var="WEBCMS_${var}" fournie
  fournie="${!env_var:-}"
  if [ -n "$fournie" ]; then
    printf -v "$var" '%s' "$fournie"
    detail "$question -> ${!var} (environnement)"
    return 0
  fi
  if [ "$INTERACTIF" = 0 ]; then
    printf -v "$var" '%s' "$defaut"
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
  local env_var="WEBCMS_${var}" fournie
  fournie="${!env_var:-}"
  [ -n "$fournie" ] && { printf -v "$var" '%s' "$fournie"; detail "$question -> (environnement)"; return 0; }
  if [ "$INTERACTIF" = 0 ]; then
    printf -v "$var" '%s' "$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)"
    avert "Mot de passe genere automatiquement — il sera affiche a la fin."
    return 0
  fi
  while true; do
    read -r -s -p "   $question (12 caracteres min., vide = genere) : " a; echo
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
  # app.listen(PORT) sans hote ecoute sur TOUTES les interfaces :
  # ss affiche « *:PORT » ou « [::]:PORT », jamais « 127.0.0.1:PORT ».
  PORT_TROUVE=$(ss -tln 2>/dev/null | grep -cE "[:.]${PORT}[[:space:]]" || true)
  [ "${PORT_TROUVE:-0}" -ge 1 ] && ok "ecoute sur le port $PORT" || avert "rien n'ecoute sur le port $PORT"
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
demander PORT          "Port interne d'ecoute" "$DEF_PORT"
demander DOSSIER       "Dossier d'installation" "$DEF_DOSSIER"
demander UTILISATEUR   "Compte systeme du service" "$DEF_UTILISATEUR"
demander ADMIN_USER    "Identifiant administrateur du CMS" "$DEF_ADMIN_USER"
demander_secret ADMIN_PASSWORD "Mot de passe administrateur"

# La source : le depot du projet est propose par defaut — c'est ce site que
# l'on installe. Repondre « archive » bascule sur un fichier .tar.gz local.
if [ -z "$SOURCE_ARCHIVE" ]; then
  demander SOURCE_GIT "Depot Git du site (ou « archive » pour un .tar.gz local)" "$DEF_SOURCE_GIT"
  if [ "${SOURCE_GIT,,}" = "archive" ]; then
    SOURCE_GIT=""
    demander SOURCE_ARCHIVE "Chemin de l'archive .tar.gz" ""
  fi
fi
[ -n "$SOURCE_GIT" ] || [ -n "$SOURCE_ARCHIVE" ] || echoue "Aucune source indiquee : ni depot Git, ni archive." "Relance et accepte le depot propose par defaut, ou indique un chemin d'archive."
[ -n "$SOURCE_ARCHIVE" ] && [ ! -f "$SOURCE_ARCHIVE" ] && echoue "Archive introuvable : $SOURCE_ARCHIVE"

# Le depot Git porte l'application, PAS le contenu : cms.sqlite est exclu du
# versionnement. Sans cette etape, on obtient un CMS vide.
echo
info "Contenu du site :"
detail "  site     recuperer depuis un site existant (base + medias)"
detail "  archive  depuis un export .zip (chemin local ou URL)"
detail "  vide     installer un site vierge"
demander CONTENU "  Source du contenu [site|archive|vide]" "site"
case "${CONTENU,,}" in
  site)
    CONTENU="site"
    demander CONTENU_URL "Adresse du site a copier" "$DEF_CONTENU_URL"
    demander CONTENU_USER "Identifiant admin de CE site" "$DEF_CONTENU_USER"
    demander_secret CONTENU_PASSWORD "Mot de passe admin de CE site" ;;
  archive)
    CONTENU="archive"
    demander CONTENU_URL "Chemin ou URL de l'archive d'export (.zip)" "" ;;
  vide|"") CONTENU="vide" ;;
  *) echoue "Source de contenu inconnue : $CONTENU" "Valeurs acceptees : site, archive, vide" ;;
esac
[ "$CONTENU" = "archive" ] && [ -z "$CONTENU_URL" ] && echoue "Aucune archive indiquee."

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
# Un dossier sous /home se heurte a « ProtectHome=true » de l'unite systemd,
# qui rend /home inaccessible au service. L'unite s'adapte plus bas, mais
# /opt ou /srv restent les bons emplacements pour une application de service.
case "$DOSSIER" in
  /home/*)
    avert "Dossier situe sous /home."
    avert "Le service est confine avec ProtectHome ; l'unite sera adaptee, mais"
    avert "/opt/webcms ou /srv/webcms restent preferables pour un service."
    if [ "$INTERACTIF" = 1 ]; then
      read -r -p "   Continuer quand meme ? [o/N] : " rep_home || true
      case "${rep_home,,}" in o|oui|y|yes) : ;; *) echoue "Installation abandonnee." "Relance et accepte /opt/webcms." ;; esac
    fi ;;
esac
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
detail "  contenu ........ $CONTENU${CONTENU_URL:+ <- $CONTENU_URL}"
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

  # Quelle version majeure le depot de la distribution propose-t-il ?
  # On evite « apt-cache policy » et « dnf module », dont la sortie depend de
  # la langue — et la modularite n'existe plus sur RHEL 10.
  version_disponible() {
    local v=""
    if [ "$FAMILLE" = "debian" ]; then
      v=$(apt-cache show nodejs 2>/dev/null | awk '/^Version:/ {print $2; exit}')
    else
      v=$(dnf -q repoquery --latest-limit=1 --qf '%{version}' nodejs 2>/dev/null | tail -1)
    fi
    v="${v#*:}"                      # retirer une eventuelle epoque « 1: »
    printf '%s' "${v%%.*}" | tr -cd '0-9'
  }

  # 1er choix : le paquet de la distribution, s'il est assez recent.
  CANDIDAT="$(version_disponible)"
  if [ -n "${CANDIDAT:-}" ] && [ "${CANDIDAT:-0}" -ge "$NODE_MIN_MAJEUR" ] 2>/dev/null; then
    info "Le depot de la distribution propose Node $CANDIDAT."
    if [ "$FAMILLE" = "debian" ]; then lancer apt-get install -y -qq nodejs npm
    else lancer dnf install -y -q nodejs npm; fi
    [ "$DRY_RUN" = 1 ] && INSTALL_OK=1 || { [ "$(version_node_majeure)" -ge "$NODE_MIN_MAJEUR" ] && INSTALL_OK=1; }
  fi

  # 2e choix, Red Hat seulement : un module, quand la distribution en a encore.
  if [ "$INSTALL_OK" = 0 ] && [ "$FAMILLE" = "redhat" ] \
     && dnf -q module list "nodejs:$NODE_CIBLE" >/dev/null 2>&1; then
    info "Activation du module nodejs:$NODE_CIBLE."
    lancer dnf module reset -y -q nodejs || true
    lancer dnf module enable -y -q "nodejs:$NODE_CIBLE"
    lancer dnf install -y -q nodejs npm
    [ "$DRY_RUN" = 1 ] && INSTALL_OK=1 || { [ "$(version_node_majeure)" -ge "$NODE_MIN_MAJEUR" ] && INSTALL_OK=1; }
  fi

  # 3e choix : NodeSource. Le script est TELECHARGE, montre, puis execute —
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
  # Une installation precedente a pu le creer avec une autre maison. npm et le
  # service ecrivent dans HOME : si elle pointe ailleurs, ils echouent avec des
  # messages qui ne designent pas la cause.
  MAISON_ACTUELLE="$(getent passwd "$UTILISATEUR" | cut -d: -f6)"
  if [ "$MAISON_ACTUELLE" != "$DOSSIER" ]; then
    avert "Sa maison est $MAISON_ACTUELLE, l'installation va dans $DOSSIER."
    lancer usermod -d "$DOSSIER" "$UTILISATEUR"
    ok "Maison du compte realignee sur $DOSSIER"
  fi
else
  lancer useradd --system --home-dir "$DOSSIER" --shell /usr/sbin/nologin "$UTILISATEUR" 2>/dev/null \
    || lancer useradd --system --home-dir "$DOSSIER" --shell /sbin/nologin "$UTILISATEUR"
  ok "Compte systeme $UTILISATEUR cree"
fi

# Les operations git se font SOUS LE COMPTE PROPRIETAIRE, pas en root.
# Depuis git 2.35.2, git refuse d'operer sur un depot appartenant a quelqu'un
# d'autre — « proprietaire douteux detecte ». Cloner en root puis chown
# produisait exactement ce cas a la relance. Et la commande que git propose
# alors (« git config --global --add safe.directory ») n'a d'effet que pour le
# compte qui la tape : ici c'est root qui agit, pas l'utilisateur.
#
# « -c safe.directory » reste en filet, par commande, sans toucher la moindre
# configuration globale — la propriete peut etre mixte apres une installation
# interrompue.
git_proprio() {
  runuser -u "$UTILISATEUR" -- git -c safe.directory="$DOSSIER" -C "$DOSSIER" "$@"
}

if [ -d "$DOSSIER/.git" ] && [ -n "$SOURCE_GIT" ]; then
  info "Depot deja present — mise a jour."
  # Remettre la propriete d'aplomb avant d'agir : une installation precedente
  # interrompue a pu laisser des fichiers appartenant a root.
  lancer chown -R "$UTILISATEUR:$UTILISATEUR" "$DOSSIER"
  lancer git_proprio remote set-url origin "$SOURCE_GIT"
  lancer git_proprio fetch --quiet --depth 1 origin
  # FETCH_HEAD est toujours pose par le fetch ; origin/HEAD peut manquer.
  lancer git_proprio reset --quiet --hard FETCH_HEAD
elif [ -n "$SOURCE_GIT" ]; then
  [ -e "$DOSSIER" ] && [ -n "$(ls -A "$DOSSIER" 2>/dev/null || true)" ] \
    && echoue "$DOSSIER existe et n'est pas vide." "Vide-le (rm -rf $DOSSIER), ou choisis un autre dossier."
  lancer install -d -o "$UTILISATEUR" -g "$UTILISATEUR" "$DOSSIER"
  lancer runuser -u "$UTILISATEUR" -- git clone --quiet --depth 1 "$SOURCE_GIT" "$DOSSIER"
else
  lancer install -d -o "$UTILISATEUR" -g "$UTILISATEUR" "$DOSSIER"
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
# « --prefix » ne convient pas ici : npm cherche le fichier de verrouillage
# dans le repertoire COURANT, pas dans le prefixe. On entre donc dans le
# dossier — comme le fait deja la construction, juste en dessous.
#
# HOME et le cache sont poses explicitement : la maison du compte de service
# peut pointer ailleurs (installation precedente), et npm y ecrirait ses
# journaux sans y avoir droit.
lancer mkdir -p "$DOSSIER/.npm"
lancer chown "$UTILISATEUR:$UTILISATEUR" "$DOSSIER/.npm"
NPM_ENV="HOME=$DOSSIER npm_config_cache=$DOSSIER/.npm"

if [ -f "$DOSSIER/package-lock.json" ]; then
  lancer runuser -u "$UTILISATEUR" -- bash -c "cd '$DOSSIER' && $NPM_ENV npm ci --no-audit --no-fund"
else
  avert "package-lock.json absent — npm install (versions non figees)."
  lancer runuser -u "$UTILISATEUR" -- bash -c "cd '$DOSSIER' && $NPM_ENV npm install --no-audit --no-fund"
fi
gate "Dependances installees" "ls $DOSSIER/node_modules | head" test -d "$DOSSIER/node_modules/tsx"
gate "Module natif better-sqlite3 compile" "cd $DOSSIER && node -e \"require('better-sqlite3')\"" \
  bash -c "[ -d '$DOSSIER/node_modules/better-sqlite3' ]"

lancer runuser -u "$UTILISATEUR" -- bash -c "cd '$DOSSIER' && $NPM_ENV npm run build"
gate "Front construit" "ls $DOSSIER/dist" test -d "$DOSSIER/dist"

# ─────────────────────────────────────────────────────────────────────────────
#  7 bis. Contenu du site
# ─────────────────────────────────────────────────────────────────────────────
if [ "$CONTENU" != "vide" ]; then
  etape "7 bis. Contenu du site"

  ARCHIVE_TMP=""
  if [ "$CONTENU" = "site" ]; then
    BASE_SRC="${CONTENU_URL%/}"
    info "Recuperation depuis $BASE_SRC"
    if [ "$DRY_RUN" = 0 ]; then
      COOKIES="$(mktemp)"; ARCHIVE_TMP="$(mktemp -u).zip"
      CODE=$(curl -s -o /dev/null -w '%{http_code}' -c "$COOKIES" \
             -H 'Content-Type: application/json' \
             -d "{\"username\":\"$CONTENU_USER\",\"password\":\"$CONTENU_PASSWORD\"}" \
             "$BASE_SRC/api/auth/login" || echo 000)
      case "$CODE" in
        200) ok "Authentifie sur le site source" ;;
        401) rm -f "$COOKIES"; echoue "Identifiants refuses par $BASE_SRC." "Verifie l'identifiant et le mot de passe du site SOURCE." ;;
        429) rm -f "$COOKIES"; echoue "Trop de tentatives sur $BASE_SRC (limiteur de debit)." "Attends une quinzaine de minutes." ;;
        000) rm -f "$COOKIES"; echoue "Site source injoignable : $BASE_SRC" "curl -v $BASE_SRC/api/auth/login" ;;
        *)   rm -f "$COOKIES"; echoue "Reponse inattendue du site source : HTTP $CODE" ;;
      esac
      info "Telechargement de l'export (base + medias)..."
      curl -fsSL -b "$COOKIES" "$BASE_SRC/api/admin/export" -o "$ARCHIVE_TMP" \
        || { rm -f "$COOKIES"; echoue "Export refuse par le site source." "Ouvre $BASE_SRC/admin et verifie que l'export fonctionne."; }
      rm -f "$COOKIES"
    fi
  else
    case "$CONTENU_URL" in
      http://*|https://*)
        info "Telechargement de $CONTENU_URL"
        if [ "$DRY_RUN" = 0 ]; then
          ARCHIVE_TMP="$(mktemp -u).zip"
          curl -fsSL "$CONTENU_URL" -o "$ARCHIVE_TMP" || echoue "Archive introuvable : $CONTENU_URL"
        fi ;;
      *)
        [ -f "$CONTENU_URL" ] || echoue "Archive introuvable : $CONTENU_URL"
        ARCHIVE_TMP="$CONTENU_URL" ;;
    esac
  fi

  if [ "$DRY_RUN" = 0 ]; then
    gate "Archive de contenu recuperee" "ls -l $ARCHIVE_TMP" test -s "$ARCHIVE_TMP"

    # Extraction : python3 est deja une dependance, inutile d'exiger unzip.
    EXTRAIT="$(mktemp -d)"
    if command -v unzip >/dev/null 2>&1; then
      unzip -q -o "$ARCHIVE_TMP" -d "$EXTRAIT"
    else
      python3 -m zipfile -e "$ARCHIVE_TMP" "$EXTRAIT"
    fi

    # La base peut etre a la racine de l'archive ou dans un sous-dossier.
    BASE_TROUVEE="$(find "$EXTRAIT" -maxdepth 3 -name cms.sqlite -type f | head -1)"
    [ -n "$BASE_TROUVEE" ] || echoue "Aucun cms.sqlite dans l'archive." "unzip -l $ARCHIVE_TMP"
    SRC_DIR="$(dirname "$BASE_TROUVEE")"

    # Sauvegarder ce qui existe deja avant d'ecraser.
    if [ -f "$DOSSIER/cms.sqlite" ]; then
      cp -a "$DOSSIER/cms.sqlite" "$DOSSIER/cms.sqlite.$(date +%Y%m%d-%H%M%S).old"
      avert "Base existante sauvegardee a cote."
    fi
    # Les fichiers -wal et -shm d'une base precedente rendraient l'ensemble
    # incoherent : la nouvelle base arrive avec son WAL deja replie.
    rm -f "$DOSSIER/cms.sqlite-wal" "$DOSSIER/cms.sqlite-shm"
    cp -f "$BASE_TROUVEE" "$DOSSIER/cms.sqlite"
    [ -d "$SRC_DIR/uploads" ] && cp -a "$SRC_DIR/uploads/." "$DOSSIER/uploads/" || true
    chown -R "$UTILISATEUR:$UTILISATEUR" "$DOSSIER/cms.sqlite" "$DOSSIER/uploads"
    rm -rf "$EXTRAIT"
    [ "$CONTENU" = "site" ] && rm -f "$ARCHIVE_TMP"
  fi

  # Le compte administrateur vient de la base importee : celui du site SOURCE.
  # server/db/client.ts ne cree un admin que si la table est VIDE — le mot de
  # passe demande plus haut serait donc sans effet. On le pose explicitement.
  if [ "$DRY_RUN" = 0 ]; then
    cat > "$DOSSIER/.reprise-admin.cjs" <<'REPRISE'
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const [chemin, utilisateur] = process.argv.slice(2);
const motdepasse = process.env.WEBCMS_NOUVEAU_MDP;
const d = new Database(chemin);
d.exec(`CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
const empreinte = bcrypt.hashSync(motdepasse, 10);
const r = d.prepare('UPDATE admins SET password_hash=? WHERE username=?').run(empreinte, utilisateur);
if (r.changes === 0) d.prepare('INSERT INTO admins (username,password_hash) VALUES (?,?)').run(utilisateur, empreinte);
let pages = 0;
try { pages = d.prepare('SELECT COUNT(*) c FROM pages').get().c; } catch { /* base sans pages */ }
d.close();
console.log(pages);
REPRISE
    chown "$UTILISATEUR:$UTILISATEUR" "$DOSSIER/.reprise-admin.cjs"
    NB_PAGES=$(cd "$DOSSIER" && WEBCMS_NOUVEAU_MDP="$ADMIN_PASSWORD" \
      runuser -u "$UTILISATEUR" --preserve-environment -- \
      node .reprise-admin.cjs "$DOSSIER/cms.sqlite" "$ADMIN_USER" 2>/dev/null || echo "")
    rm -f "$DOSSIER/.reprise-admin.cjs"
    [ -n "${NB_PAGES:-}" ] || echoue "Reprise du compte administrateur impossible." "Verifie que node et better-sqlite3 fonctionnent dans $DOSSIER"
    ok "Compte administrateur repris sur le mot de passe choisi"
    # Copier une base, c'est copier TOUS ses comptes. Ceux qui ne sont pas
    # celui repris ci-dessus gardent le mot de passe du site source.
    AUTRES=$(cd "$DOSSIER" && runuser -u "$UTILISATEUR" -- node -e "
      const D=require('better-sqlite3');
      const d=new D(process.argv[1],{readonly:true});
      console.log(d.prepare('SELECT username FROM admins WHERE username<>?').all(process.argv[2]).map(x=>x.username).join(', '));
    " "$DOSSIER/cms.sqlite" "$ADMIN_USER" 2>/dev/null || echo "")
    if [ -n "${AUTRES:-}" ]; then
      avert "La base importee contient d'autres comptes administrateurs :"
      avert "  $AUTRES"
      avert "Ils gardent le mot de passe du site source. A revoir depuis /admin."
    fi
    gate "Contenu en place ($NB_PAGES pages)" "sqlite3 $DOSSIER/cms.sqlite 'select count(*) from pages'" \
      bash -c "[ \"${NB_PAGES:-0}\" -gt 0 ]"
  fi
fi

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
Environment=HOME=$DOSSIER
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
ProtectHome=$( case "$DOSSIER" in /home/*) echo "false   # desactive : l'application est installee sous /home" ;; *) echo "true" ;; esac )
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
    # « default_server » : sans lui, une requete portant une ADRESSE IP en
    # en-tete Host ne correspond a aucun nom et tombe sur le bloc par defaut
    # d'nginx — sa page d'accueil, pas le site. C'est ce qui rend l'acces
    # par « http://192.168.x.x/ » possible.
    listen 80 default_server;
    listen [::]:80 default_server;
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
    else
      # Red Hat livre son propre serveur par defaut dans nginx.conf. Deux
      # « default_server » sur le meme port empechent nginx de demarrer, et
      # c'est le sien qui repondrait aux acces par adresse IP. On le desarme,
      # en gardant une copie.
      if grep -q 'default_server' /etc/nginx/nginx.conf; then
        cp -a /etc/nginx/nginx.conf /etc/nginx/nginx.conf.avant-webcms
        sed -i '/listen/ s/ default_server//g' /etc/nginx/nginx.conf
        info "Serveur par defaut d'nginx desarme (copie : nginx.conf.avant-webcms)."
      fi
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
  # Acces par ADRESSE IP : c'est le cas du reseau local. Il emprunte un chemin
  # different — aucun nom ne correspond, c'est le serveur par defaut qui repond.
  IP_LOCALE=$(ip -4 -o addr show scope global 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | head -1)
  if [ -n "${IP_LOCALE:-}" ]; then
    CODE_IP=$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $IP_LOCALE" http://127.0.0.1/ || echo 000)
    case "$CODE_IP" in
      200|301|302) ok "Acces par adresse IP fonctionnel (HTTP $CODE_IP)" ;;
      *) avert "Acces par adresse IP : HTTP $CODE_IP — le reseau local ne verrait pas le site." ;;
    esac
  fi
fi

if [ "$AVEC_TLS" = "o" ]; then
  avert "COOKIE_SECURE=1 : le cookie de session exige HTTPS."
  avert "Un acces en HTTP simple — par adresse IP sur le reseau local, par"
  avert "exemple — laissera la connexion a /admin echouer SANS message clair."
  avert "Dans ce cas : COOKIE_SECURE=0 dans $ENV_FICHIER, puis redemarrer."
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
  Reseau local ....... $(
      ip -4 -o addr show scope global 2>/dev/null | awk '{print $4}' | cut -d/ -f1 \
      | while read -r a; do
          [ "$AVEC_NGINX" = "o" ] && printf 'http://%s/  ' "$a" || printf 'http://%s:%s/  ' "$a" "$PORT"
        done )
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

$( [ "$CONTENU" = "vide" ] && printf "  %s Site VIDE : aucun contenu importe.%s\n" "$C_W" "$C_0" )
  Sauvegarde — la totalite du contenu tient dans un fichier :
    $DOSSIER/cms.sqlite   (et $DOSSIER/uploads pour les medias)

FIN

#!/usr/bin/env bash
# ============================================================================
#  opnsense-harden.sh — Audit + durcissement guidé d'OPNsense via l'API REST.
#  -----------------------------------------------------------------------------
#  Se lance DEPUIS une machine d'administration. Utilise une clé/secret API
#  OPNsense (System ▸ Access ▸ Users ▸ [ton compte] ▸ API keys).
#
#  Posture SÛRE : par défaut il AUDITE (lectures seules via l'API) et imprime
#  une checklist de durcissement guidée. Il n'écrit RIEN sans action explicite.
#  La seule écriture proposée (--creer-alias) est RÉVERSIBLE et inoffensive
#  (créer un alias réseau ne change aucun flux tant qu'une règle ne l'utilise pas)
#  — on évite ainsi tout verrouillage de l'accès admin (anti-lockout).
#
#  Variables requises :
#     OPN_URL     ex: https://10.22.10.254
#     OPN_KEY     clé API
#     OPN_SECRET  secret API
#
#  Usage :
#     OPN_URL=https://10.22.10.254 OPN_KEY=... OPN_SECRET=... ./opnsense-harden.sh
#     ... ./opnsense-harden.sh --creer-alias admin_nets 10.22.10.0/24,10.0.9.0/24
# ============================================================================
set -uo pipefail

OPN_URL="${OPN_URL:-}"; OPN_KEY="${OPN_KEY:-}"; OPN_SECRET="${OPN_SECRET:-}"
ACTION="audit"; ALIAS_NOM=""; ALIAS_NETS=""
case "${1:-}" in
    --creer-alias) ACTION="alias"; ALIAS_NOM="${2:-}"; ALIAS_NETS="${3:-}" ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
esac
[ -n "$OPN_URL" ] && [ -n "$OPN_KEY" ] && [ -n "$OPN_SECRET" ] || {
    echo "Renseigne OPN_URL, OPN_KEY et OPN_SECRET (voir l'en-tête du script)."; exit 1; }

if [ -t 1 ]; then R=$'\e[0m'; G=$'\e[1m'; VERT=$'\e[32m'; JAUNE=$'\e[33m'; CYAN=$'\e[36m'; else R=""; G=""; VERT=""; JAUNE=""; CYAN=""; fi
info(){ echo "  ${CYAN}•${R} $*"; }
bon(){  echo "  ${VERT}[ OK ]${R} $*"; }
reco(){ echo "  ${JAUNE}▸${R} $*"; }
titre(){ echo; echo "${G}${CYAN}── $* ──${R}"; }

# Appel API : api <METHODE> <chemin> [donnée-json]
api(){
    local m="$1" chemin="$2" data="${3:-}"
    if [ -n "$data" ]; then
        curl -sk -u "$OPN_KEY:$OPN_SECRET" -H 'Content-Type: application/json' -X "$m" --max-time 15 -d "$data" "$OPN_URL$chemin"
    else
        curl -sk -u "$OPN_KEY:$OPN_SECRET" -X "$m" --max-time 15 "$OPN_URL$chemin"
    fi
}
jq_ok(){ command -v jq >/dev/null 2>&1; }

# ── Action : créer un alias réseau (écriture réversible) ──────────────────────
if [ "$ACTION" = "alias" ]; then
    [ -n "$ALIAS_NOM" ] && [ -n "$ALIAS_NETS" ] || { echo "Usage : --creer-alias <nom> <net1,net2,...>"; exit 1; }
    CONTENT="${ALIAS_NETS//,/\\n}"
    JSON="{\"alias\":{\"enabled\":\"1\",\"name\":\"$ALIAS_NOM\",\"type\":\"network\",\"content\":\"$CONTENT\",\"description\":\"reseaux d'administration (opnsense-harden.sh)\"}}"
    titre "Création de l'alias « $ALIAS_NOM »"
    info "Réseaux : $ALIAS_NETS"
    REP="$(api POST /api/firewall/alias/addItem "$JSON")"; echo "  Réponse addItem : $REP"
    REP2="$(api POST /api/firewall/alias/reconfigure)"; echo "  Réponse reconfigure : $REP2"
    reco "Utilise maintenant l'alias « $ALIAS_NOM » comme SOURCE d'une règle autorisant l'accès admin,"
    reco "et restreins/retire l'accès admin pour le reste. (Garde l'anti-lockout et la console !)"
    exit 0
fi

# ── Audit (lectures seules) ──────────────────────────────────────────────────
titre "Connexion à l'API OPNsense"
FW="$(api GET /api/core/firmware/status)"
if [ -z "$FW" ] || echo "$FW" | grep -qi "authentication\|failed\|<html"; then
    echo "  Échec de l'appel API (URL/clé/secret ? API activée ?). Réponse : ${FW:0:120}"; exit 1
fi
bon "API joignable et authentifiée."
if jq_ok; then
    VER="$(echo "$FW" | jq -r '.product_version // .product.product_version // "?"' 2>/dev/null)"
    MAJ="$(echo "$FW" | jq -r '.status // .needs_reboot // "?"' 2>/dev/null)"
    info "Version : ${VER:-?}   ·   statut mises à jour : ${MAJ:-?}"
    echo "$FW" | grep -qi '"status":"update"' && reco "Des mises à jour sont disponibles — applique-les." || true
else
    info "(installe jq pour un affichage détaillé) — extrait : ${FW:0:160}"
fi

titre "Pare-feu (inventaire)"
AL="$(api GET /api/firewall/alias/searchItem)"
if jq_ok && echo "$AL" | jq . >/dev/null 2>&1; then
    info "Alias définis : $(echo "$AL" | jq '.rowCount // (.rows|length) // 0' 2>/dev/null)"
else
    info "Alias : réponse reçue (installe jq pour le détail)."
fi

# ── Checklist de durcissement guidée ─────────────────────────────────────────
titre "Checklist de durcissement OPNsense"
reco "Administration : GUI en HTTPS, certificat propre, TLS 1.2+ (System ▸ Settings ▸ Administration)."
reco "GUI JAMAIS exposée au WAN : restreindre l'accès admin à un réseau de management / VPN."
reco "Activer la 2FA (TOTP) pour les comptes admin (System ▸ Access ▸ Servers + Users)."
reco "SSH : désactivé sur le WAN, par clés uniquement, restreint au management."
reco "Journalisation vers un syslog distant (System ▸ Settings ▸ Logging / Targets)."
reco "Protection anti DNS-rebinding et référents HTTP activées (ne PAS les désactiver)."
reco "Désactiver les services inutiles ; appliquer les mises à jour régulièrement."
reco "Anti-lockout : garde une règle d'accès management + l'accès CONSOLE. Ne te coupe jamais."
echo
info "Astuce : crée un alias de tes réseaux d'admin pour t'en servir dans les règles :"
info "   OPN_URL=$OPN_URL OPN_KEY=... OPN_SECRET=... $0 --creer-alias admin_nets 10.22.10.0/24"
echo
info "Références : https://docs.opnsense.org/development/api/core/firewall.html"

#!/usr/bin/env bash
# ============================================================================
#  fw-audit.sh — Audit EXTERNE d'un pare-feu pfSense / OPNsense (lecture seule).
#  -----------------------------------------------------------------------------
#  Se lance DEPUIS une machine du réseau (ta boîte à outils, un poste admin),
#  PAS sur l'appliance. Il ne modifie RIEN : il scanne et rapporte.
#
#  Il vérifie les mauvaises pratiques les plus courantes :
#    - interface d'administration (GUI web) et SSH exposés ;
#    - redirection HTTP -> HTTPS de la GUI ;
#    - qualité TLS du portail d'admin (version, certificat, expiration) ;
#    - ports ouverts inattendus ;
#    - détection pfSense vs OPNsense ;
#    - rappel des identifiants par défaut à changer (sans tenter de login).
#
#  Usage :
#     ./fw-audit.sh <ip_du_parefeu> [--cote wan|lan]
#     ./fw-audit.sh 10.22.10.254 --cote lan
#     ./fw-audit.sh 203.0.113.1  --cote wan
#
#  --cote wan : on audite depuis l'EXTÉRIEUR -> GUI/SSH ouverts = CRITIQUE.
#  --cote lan : on audite depuis l'INTÉRIEUR -> GUI attendue, mais durcie.
# ============================================================================
set -uo pipefail

CIBLE=""; COTE="inconnu"
while [ $# -gt 0 ]; do
    case "$1" in
        --cote) COTE="${2:-inconnu}"; shift 2 ;;
        -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
        *) CIBLE="$1"; shift ;;
    esac
done
[ -n "$CIBLE" ] || { echo "Usage : $0 <ip_du_parefeu> [--cote wan|lan]"; exit 1; }

# ── Habillage ────────────────────────────────────────────────────────────────
if [ -t 1 ]; then R=$'\e[0m'; G=$'\e[1m'; VERT=$'\e[32m'; ROUGE=$'\e[31m'; JAUNE=$'\e[33m'; CYAN=$'\e[36m'
else R=""; G=""; VERT=""; ROUGE=""; JAUNE=""; CYAN=""; fi
RAPPORT="/tmp/fw-audit-${CIBLE//[.:]/_}-$(date +%Y%m%d-%H%M%S).md"
NB_CRIT=0; NB_ALERTE=0

ligne(){ echo "$1"; echo "$1" | sed 's/\x1b\[[0-9;]*m//g' >> "$RAPPORT"; }
titre(){ echo; echo "${G}${CYAN}── $* ──${R}"; { echo; echo "## $*"; } >> "$RAPPORT"; }
crit(){  ligne "  ${ROUGE}[CRITIQUE]${R} $*"; NB_CRIT=$((NB_CRIT+1)); }
alerte(){ ligne "  ${JAUNE}[ALERTE]${R} $*"; NB_ALERTE=$((NB_ALERTE+1)); }
bon(){   ligne "  ${VERT}[ OK ]${R} $*"; }
info(){  ligne "  ${CYAN}•${R} $*"; }

# test TCP d'un port (nmap si présent, sinon /dev/tcp)
port_ouvert(){
    local h="$1" p="$2"
    if command -v nmap >/dev/null 2>&1; then
        nmap -Pn -p "$p" --host-timeout 8s "$h" 2>/dev/null | grep -qE "^$p/tcp\s+open"
    else
        timeout 3 bash -c "cat < /dev/null > /dev/tcp/$h/$p" 2>/dev/null
    fi
}

echo "${G}=== Audit pare-feu : $CIBLE (côté : $COTE) ===${R}"
{ echo "# Audit pare-feu — $CIBLE"; echo; echo "- Côté réseau : $COTE"; echo "- Date : $(date '+%F %T')"; } > "$RAPPORT"

# ── 1) Joignabilité + détection produit ──────────────────────────────────────
titre "Joignabilité & produit"
ping -c1 -W1 "$CIBLE" >/dev/null 2>&1 && info "Répond au ping." || info "Ne répond pas au ping (ICMP filtré ? normal sur un WAN durci)."

PRODUIT="inconnu"
HTML="$(curl -sk --max-time 6 "https://$CIBLE/" 2>/dev/null)"
if   echo "$HTML" | grep -qi "opnsense"; then PRODUIT="OPNsense"
elif echo "$HTML" | grep -qi "pfsense"; then PRODUIT="pfSense"; fi
info "Produit détecté : ${G}$PRODUIT${R}"

# ── 2) Interface d'administration (GUI web) ──────────────────────────────────
titre "Interface d'administration (GUI)"
GUI_HTTPS=0; GUI_HTTP=0
port_ouvert "$CIBLE" 443 && GUI_HTTPS=1
port_ouvert "$CIBLE" 80  && GUI_HTTP=1
if [ "$GUI_HTTPS" = 1 ] || [ "$GUI_HTTP" = 1 ]; then
    if [ "$COTE" = "wan" ]; then
        crit "La GUI d'admin répond côté WAN (443:$GUI_HTTPS 80:$GUI_HTTP) — à NE JAMAIS exposer sur Internet."
    else
        bon "GUI accessible côté LAN (attendu)."
    fi
    # HTTP doit rediriger vers HTTPS
    if [ "$GUI_HTTP" = 1 ]; then
        CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://$CIBLE/" 2>/dev/null)"
        LOC="$(curl -sI --max-time 5 "http://$CIBLE/" 2>/dev/null | awk 'tolower($1)=="location:"{print $2}')"
        if echo "$LOC" | grep -qi "^https"; then bon "HTTP redirige vers HTTPS ($CODE)."
        else alerte "La GUI répond en HTTP clair sans redirection HTTPS (code $CODE) — active le HTTPS forcé."; fi
    fi
else
    [ "$COTE" = "wan" ] && bon "Aucune GUI exposée côté WAN." || alerte "Aucune GUI détectée côté LAN (port non standard ?)."
fi

# ── 3) TLS du portail d'admin ────────────────────────────────────────────────
if [ "$GUI_HTTPS" = 1 ] && command -v openssl >/dev/null 2>&1; then
    titre "TLS du portail d'admin"
    CERT="$(echo | timeout 8 openssl s_client -connect "$CIBLE:443" 2>/dev/null)"
    PROTO="$(echo "$CERT" | awk -F': ' '/Protocol/{print $2; exit}')"
    SUJ="$(echo "$CERT" | openssl x509 -noout -subject 2>/dev/null | sed 's/subject=//')"
    ISS="$(echo "$CERT" | openssl x509 -noout -issuer  2>/dev/null | sed 's/issuer=//')"
    FIN="$(echo "$CERT" | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)"
    info "Protocole négocié : ${PROTO:-?}"
    echo "$PROTO" | grep -qE "TLSv1\.(0|1)$" && alerte "TLS obsolète ($PROTO) — n'autoriser que TLS 1.2+." || [ -n "$PROTO" ] && bon "Version TLS correcte."
    [ -n "$SUJ" ] && info "Certificat : $SUJ"
    if [ -n "$SUJ" ] && [ "$SUJ" = "$ISS" ]; then info "Certificat auto-signé (acceptable en interne, à épingler)."; fi
    [ -n "$FIN" ] && info "Expire le : $FIN"
fi

# ── 4) SSH ────────────────────────────────────────────────────────────────────
titre "Accès SSH"
if port_ouvert "$CIBLE" 22; then
    if [ "$COTE" = "wan" ]; then crit "SSH (22) ouvert côté WAN — à fermer ou restreindre à un VPN/management."
    else alerte "SSH (22) ouvert côté LAN — à restreindre au réseau de management + clés uniquement."; fi
else
    bon "SSH (22) fermé."
fi

# ── 5) Autres ports courants ─────────────────────────────────────────────────
titre "Autres ports à vérifier"
declare -A SVC=( [53]="DNS" [123]="NTP" [161]="SNMP" [500]="IPsec IKE" [4500]="IPsec NAT-T" [1194]="OpenVPN" [3128]="Proxy" [8080]="HTTP alt" [8443]="GUI alt" )
for p in 53 123 161 500 4500 1194 3128 8080 8443; do
    if port_ouvert "$CIBLE" "$p"; then
        case "$p" in
            161) [ "$COTE" = wan ] && crit "SNMP (161) exposé côté WAN." || alerte "SNMP (161) ouvert — communautés par défaut à bannir." ;;
            8080|8443|3128) [ "$COTE" = wan ] && crit "${SVC[$p]} ($p) exposé côté WAN." || info "${SVC[$p]} ($p) ouvert (côté LAN)." ;;
            *) info "${SVC[$p]} ($p) ouvert." ;;
        esac
    fi
done

# ── 6) Identifiants par défaut (rappel, sans tentative de login) ─────────────
titre "Identifiants par défaut"
if [ "$PRODUIT" = "pfSense" ]; then info "pfSense : vérifie que le compte par défaut (admin / pfsense) a été CHANGÉ."
elif [ "$PRODUIT" = "OPNsense" ]; then info "OPNsense : vérifie que le compte par défaut (root / opnsense) a été CHANGÉ."
else info "Vérifie que les identifiants par défaut ont été changés (admin/pfsense ou root/opnsense)."; fi
info "On ne tente AUCUN login (éviter tout verrouillage de compte) — contrôle manuel."

# ── Bilan ─────────────────────────────────────────────────────────────────────
titre "Bilan"
ligne "  Problèmes CRITIQUES : ${ROUGE}$NB_CRIT${R}   ·   ALERTES : ${JAUNE}$NB_ALERTE${R}"
{ echo; echo "## Rappels de durcissement"
  echo "- GUI d'admin JAMAIS exposée sur le WAN ; HTTPS forcé + certificat propre ; TLS 1.2+."
  echo "- Admin restreint au réseau de management ; 2FA activée."
  echo "- SSH fermé sur le WAN, par clés uniquement, restreint au management."
  echo "- Anti-lockout : garder une règle LAN/management + l'accès console (jamais se couper)."
  echo "- Journalisation vers un syslog distant ; protection anti DNS rebind ; services inutiles coupés."
  echo "- Mises à jour appliquées régulièrement."
} >> "$RAPPORT"
echo
info "Rapport complet : ${G}$RAPPORT${R}"
[ "$NB_CRIT" -gt 0 ] && exit 2 || exit 0

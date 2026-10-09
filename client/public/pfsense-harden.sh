#!/usr/bin/env bash
# ============================================================================
#  pfsense-harden.sh — Profil de durcissement pfSense (checklist + config.xml).
#  -----------------------------------------------------------------------------
#  pfSense (Community Edition) n'a pas d'API officielle : toute la config vit
#  dans /conf/config.xml. Ce script NE MODIFIE RIEN sur le pare-feu : il produit
#  un RAPPORT de durcissement (checklist + éléments config.xml cibles + chemins
#  GUI) à appliquer à la main, et un garde-fou anti-lockout.
#
#  ⚠️ Ne restaure PAS un config.xml partiel « à l'aveugle » : dans pfSense, la
#  restauration d'une section REMPLACE toute la section. Applique les réglages
#  via la GUI (ou compare ton config.xml aux valeurs cibles ci-dessous).
#
#  Usage :
#     ./pfsense-harden.sh            # affiche + écrit le rapport
#     ./pfsense-harden.sh -o mon-rapport.md
# ============================================================================
set -uo pipefail

OUT="/tmp/pfsense-harden-$(date +%Y%m%d-%H%M%S).md"
[ "${1:-}" = "-o" ] && OUT="${2:?chemin manquant}"

if [ -t 1 ]; then R=$'\e[0m'; G=$'\e[1m'; CYAN=$'\e[36m'; JAUNE=$'\e[33m'; else R=""; G=""; CYAN=""; JAUNE=""; fi

cat > "$OUT" <<'MD'
# Profil de durcissement pfSense

> pfSense CE se configure via `/conf/config.xml` (régénéré par la GUI). Applique
> les points ci-dessous via la GUI ; les chemins XML servent à vérifier l'état.

## 1. Interface d'administration (GUI)
- **HTTPS forcé** — GUI : *System ▸ Advanced ▸ Admin Access ▸ Protocol = HTTPS*,
  décocher « WebGUI redirect » pour n'autoriser que HTTPS.
  XML : `<system><webgui><protocol>https</protocol></webgui></system>`
- **Certificat propre** (pas le défaut) — `<webgui><ssl-certref>…</ssl-certref></webgui>`
- **TLS 1.2+ uniquement** — `<webgui><sslprotocols>TLSv1.2,TLSv1.3</sslprotocols></webgui>`
- **GUI JAMAIS sur le WAN** : restreindre l'accès admin au LAN/management ou à un VPN.
- **Timeout de session** (Admin Access) + **anti-DNS-rebind** et **HTTP Referer** ACTIFS
  (ne PAS cocher « Disable… »).

## 2. SSH
- **Clés uniquement** — *System ▸ Advanced ▸ Admin Access ▸ SSHd Key Only = Public Key Only*.
  XML : `<system><ssh><sshdkeyonly>enabled</sshdkeyonly></ssh></system>`
- **SSH fermé sur le WAN**, restreint au réseau de management.
- Changer le port SSH par défaut est optionnel (obscurité, pas une protection).

## 3. Comptes
- **Changer le compte par défaut** (admin / pfsense) : mot de passe fort + compte nommé.
- **2FA** (OTP/TOTP via le package approprié) pour les comptes admin.
- Supprimer les comptes inutiles ; principe du moindre privilège.

## 4. Règles de pare-feu
- **Default deny** + **journalisation** des refus (c'est déjà le défaut : ne pas ajouter de « allow any »).
- **Anti-lockout** : garder la règle anti-lockout sur l'interface de management
  (ou une règle explicite d'accès admin) — NE JAMAIS se couper l'accès.
- Nettoyer les règles trop larges ; commenter chaque règle.

## 5. Services & journalisation
- Désactiver les services inutiles (UPnP, etc.).
- **Syslog distant** — *Status ▸ System Logs ▸ Settings ▸ Remote Logging*.
- Activer les protections anti-bruteforce de la GUI (sshguard est présent par défaut).

## 6. Maintenance
- Appliquer les **mises à jour** régulièrement.
- **Sauvegarder** `config.xml` (Diagnostics ▸ Backup & Restore) et le stocker hors de l'appliance.

## Rappel anti-lockout
Avant tout durcissement : garde un accès **console** (série/VM) et une **règle
d'accès management**. Teste chaque changement depuis une 2ᵉ session avant de fermer.
MD

echo "${G}${CYAN}Profil de durcissement pfSense${R}"
echo "  Rapport écrit : ${G}$OUT${R}"
echo
sed 's/^/    /' "$OUT"
echo
echo "  ${JAUNE}Rappel : applique via la GUI, ne restaure pas un config.xml partiel à l'aveugle.${R}"

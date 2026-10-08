#!/usr/bin/env bash
# ============================================================================
#  spa-install.sh — Installe la pile SPA (fwknop) sur UN hôte Debian 12/13.
#  -----------------------------------------------------------------------------
#  Objectif : SSH invisible au scan (port 22 fermé par défaut), ouvert quelques
#  secondes seulement pour l'IP qui envoie un « paquet SPA » valide (fwknop).
#  Pas de bastion : tout est local à l'hôte.
#
#  Pile posée : chrony (NTP) + fwknop-server (SPA) + durcissement SSH (clés) +
#  pare-feu « SSH fermé sauf management » + watchdog anti-lockout.
#  Secret SPA : clé symétrique + HMAC, générée PAR HÔTE.
#
#  ⚠️ SÉCURITÉ ANTI-LOCKOUT (lis-moi) :
#    - garde TOUJOURS une session SSH ouverte pendant l'installation ;
#    - l'IP de management (par défaut : celle de ta session SSH actuelle) reste
#      autorisée en permanence vers le 22 → tu ne peux pas t'enfermer dehors ;
#    - le durcissement « clés seules » est REFUSÉ s'il n'existe aucune clé
#      publique installée (sinon = lockout garanti).
#
#  Idempotent : relançable sans dégât. Pensé « Ansible-ready » : tous les
#  réglages sont des variables surchargeables par l'environnement, et
#  ASSUME_YES=1 supprime les questions (pour l'automatisation).
#
#  Usage :
#     sudo ./spa-install.sh
#     sudo MGMT_IP=203.0.113.10 FW_TIMEOUT=20 ASSUME_YES=1 ./spa-install.sh
# ============================================================================

# ── Réglages (surchargeables par l'environnement) ───────────────────────────
: "${SPA_PORT:=62201}"          # port UDP du paquet SPA (sniffé passivement)
: "${SSH_PORT:=22}"             # port SSH protégé
: "${FW_TIMEOUT:=30}"           # durée (s) d'ouverture du 22 après un knock valide
: "${PCAP_INTF:=}"             # interface d'écoute (vide = auto-détection)
: "${MGMT_IP:=}"               # IP toujours autorisée (vide = IP de la session SSH)
: "${KEEP_MGMT:=yes}"           # garder MGMT_IP autorisée en permanence (filet)
: "${HARDEN_SSH:=yes}"          # désactiver mot de passe + root (clés seules)
: "${ASSUME_YES:=0}"            # 1 = ne pose aucune question (automatisation)

LOG="/var/log/spa-install-$(date +%Y%m%d-%H%M%S).log"
ACCESS="/etc/fwknop/access.conf"
FWD="/etc/fwknop/fwknopd.conf"
CLIENT_OUT="/root/spa-client-$(hostname -s).txt"

# ── Habillage + journal ─────────────────────────────────────────────────────
if [ -t 1 ]; then R=$'\e[0m'; G=$'\e[1m'; VERT=$'\e[32m'; ROUGE=$'\e[31m'; JAUNE=$'\e[33m'; CYAN=$'\e[36m'
else R=""; G=""; VERT=""; ROUGE=""; JAUNE=""; CYAN=""; fi
jrn(){ printf '%s  %s\n' "$(date '+%F %T')" "$1" >> "$LOG" 2>/dev/null; }
info(){ echo "  ${CYAN}•${R} $*"; }
ok(){   echo "  ${VERT}[ OK ]${R} $*"; }
avert(){ echo "  ${JAUNE}[AVERT]${R} $*"; }
ko(){   echo "  ${ROUGE}[ERREUR]${R} $*"; jrn "ERREUR: $*"; }
mort(){ ko "$*"; echo "  Journal : $LOG"; exit 1; }
etape(){ local d="$1"; shift; info "… $d"; if "$@" >> "$LOG" 2>&1; then ok "$d"; else mort "$d (voir le journal)"; fi; }
oui(){ # oui "question"  -> 0 si oui ; respecte ASSUME_YES
  [ "$ASSUME_YES" = "1" ] && return 0
  local a; read -rp "  $1 [o/N] : " a; a="${a,,}"; [ "$a" = o ] || [ "$a" = oui ] || [ "$a" = y ]; }

echo "${G}${CYAN}=== Installation de la pile SPA (fwknop) ===${R}"
echo "  Journal : $LOG"; jrn "=== début ==="

# ── 0) Pré-requis ────────────────────────────────────────────────────────────
[ "$(id -u)" -eq 0 ] || mort "à lancer en root (sudo)."
command -v apt-get >/dev/null 2>&1 || mort "distribution non-Debian (apt introuvable)."

# IP de management : par défaut, l'IP de la session SSH courante (filet anti-lockout).
if [ -z "$MGMT_IP" ] && [ -n "${SSH_CONNECTION:-}" ]; then
  MGMT_IP="$(echo "$SSH_CONNECTION" | awk '{print $1}')"
  info "IP de management déduite de ta session SSH : ${G}$MGMT_IP${R}"
fi
if [ -z "$MGMT_IP" ]; then
  avert "Aucune IP de management définie (tu es en console locale ?)."
  avert "Sans filet management, seul le watchdog te protège. Tu peux en fixer une : MGMT_IP=x.x.x.x"
  oui "Continuer SANS IP de management permanente ?" || mort "Annulé. Relance avec MGMT_IP=<ton IP>."
fi

# Interface d'écoute (route par défaut).
[ -z "$PCAP_INTF" ] && PCAP_INTF="$(ip -o -4 route show to default 2>/dev/null | awk '{print $5; exit}')"
[ -z "$PCAP_INTF" ] && PCAP_INTF="$(ip -o link | awk -F': ' '$2!="lo"{print $2; exit}')"
info "Interface d'écoute SPA : ${G}$PCAP_INTF${R}"

echo; info "Récapitulatif :"
echo "     SPA_PORT=$SPA_PORT  SSH_PORT=$SSH_PORT  FW_TIMEOUT=${FW_TIMEOUT}s"
echo "     PCAP_INTF=$PCAP_INTF  MGMT_IP=${MGMT_IP:-<aucune>}  KEEP_MGMT=$KEEP_MGMT  HARDEN_SSH=$HARDEN_SSH"
oui "Lancer l'installation avec ces réglages ?" || mort "Annulé."

# ── 1) Paquets ────────────────────────────────────────────────────────────────
etape "Mise à jour APT" apt-get update
etape "Installation (chrony, fwknop, openssh, iptables)" \
      apt-get install -y chrony fwknop-server fwknop-client openssh-server iptables
etape "Activation de NTP (chrony)" systemctl enable --now chrony

# ── 2) Durcissement SSH : clés seules (avec garde-fou anti-lockout) ───────────
if [ "$HARDEN_SSH" = "yes" ]; then
  # On REFUSE de couper le mot de passe s'il n'existe aucune clé publique installée.
  if ! ls /root/.ssh/authorized_keys /home/*/.ssh/authorized_keys >/dev/null 2>&1 \
     || ! grep -rqsE 'ssh-(ed25519|rsa|ecdsa)' /root/.ssh/authorized_keys /home/*/.ssh/authorized_keys 2>/dev/null; then
    avert "Aucune clé publique SSH trouvée (/root/.ssh/authorized_keys ou /home/*/.ssh/authorized_keys)."
    avert "Désactiver le mot de passe maintenant = enfermement garanti. On SAUTE le durcissement SSH."
    avert "Ajoute ta clé (ssh-copy-id), puis relance le script, ou HARDEN_SSH=no pour ignorer."
    HARDEN_SSH="skip"
  fi
fi
if [ "$HARDEN_SSH" = "yes" ]; then
  mkdir -p /etc/ssh/sshd_config.d
  cat > /etc/ssh/sshd_config.d/99-spa-hardening.conf <<EOF
# Durcissement SSH (posé par spa-install.sh) — clés uniquement.
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
EOF
  if sshd -t >> "$LOG" 2>&1; then
    etape "Rechargement de SSH (clés seules)" systemctl reload ssh
    ok "SSH durci : mot de passe désactivé, root interdit"
  else
    rm -f /etc/ssh/sshd_config.d/99-spa-hardening.conf
    mort "sshd -t a refusé le durcissement (rien appliqué)"
  fi
else
  avert "Durcissement SSH non appliqué (HARDEN_SSH=$HARDEN_SSH)."
fi

# ── 3) Clés SPA (symétrique + HMAC) générées pour CET hôte ────────────────────
if grep -qs '^KEY_BASE64:' "$ACCESS" 2>/dev/null; then
  info "Clés SPA déjà présentes dans $ACCESS (on les conserve)."
  KEY_B64="$(awk -F': *' '/^KEY_BASE64:/{print $2}' "$ACCESS" | tr -d ' ;')"
  HMAC_B64="$(awk -F': *' '/^HMAC_KEY_BASE64:/{print $2}' "$ACCESS" | tr -d ' ;')"
else
  info "Génération des clés SPA (AES + HMAC-SHA256)…"
  GEN="$(fwknop --key-gen 2>>"$LOG")"
  KEY_B64="$(echo "$GEN"  | awk -F': *' '/^KEY_BASE64:/{print $2}')"
  HMAC_B64="$(echo "$GEN" | awk -F': *' '/^HMAC_KEY_BASE64:/{print $2}')"
  [ -n "$KEY_B64" ] && [ -n "$HMAC_B64" ] || mort "échec de génération des clés SPA (fwknop --key-gen)."
  mkdir -p /etc/fwknop
  cat > "$ACCESS" <<EOF
# access.conf — généré par spa-install.sh pour $(hostname) le $(date '+%F %T')
SOURCE:                 ANY;
REQUIRE_SOURCE_ADDRESS: Y;
FW_ACCESS_TIMEOUT:      $FW_TIMEOUT;
KEY_BASE64:             $KEY_B64;
HMAC_KEY_BASE64:        $HMAC_B64;
EOF
  chmod 600 "$ACCESS"
  ok "Clés SPA écrites dans $ACCESS (REQUIRE_SOURCE_ADDRESS=Y, timeout ${FW_TIMEOUT}s)"
fi

# fwknopd.conf : interface d'écoute + port SPA.
touch "$FWD"
sed -i '/^PCAP_INTF /d;/^PCAP_FILTER /d' "$FWD"
{ echo "PCAP_INTF                   $PCAP_INTF;"
  echo "PCAP_FILTER                 udp port $SPA_PORT;"; } >> "$FWD"
ok "fwknopd configuré (écoute $PCAP_INTF, filtre udp/$SPA_PORT)"

# ── 4) Pare-feu de base : SSH fermé par défaut, sauf management ───────────────
cat > /usr/local/sbin/spa-firewall.sh <<EOF
#!/usr/bin/env bash
# Règles de base SPA : 22 fermé par défaut ; établies + management autorisés.
# fwknopd insère au-dessus des ACCEPT temporaires pour les IP qui "knockent".
set -u
add(){ iptables -C "\$@" 2>/dev/null || iptables -A "\$@"; }
add INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
add INPUT -i lo -j ACCEPT
EOF
if [ "$KEEP_MGMT" = "yes" ] && [ -n "$MGMT_IP" ]; then
  echo "add INPUT -p tcp --dport $SSH_PORT -s $MGMT_IP -j ACCEPT   # filet management" >> /usr/local/sbin/spa-firewall.sh
fi
echo "add INPUT -p tcp --dport $SSH_PORT -j DROP   # SSH fermé pour tout le reste" >> /usr/local/sbin/spa-firewall.sh
chmod +x /usr/local/sbin/spa-firewall.sh

cat > /etc/systemd/system/spa-firewall.service <<'EOF'
[Unit]
Description=Pare-feu SPA : SSH fermé par défaut sauf management
After=network-pre.target
Before=fwknop-server.service
[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/sbin/spa-firewall.sh
[Install]
WantedBy=multi-user.target
EOF

# ── 5) Watchdog anti-lockout ──────────────────────────────────────────────────
cat > /usr/local/sbin/spa-watchdog.sh <<'EOF'
#!/usr/bin/env bash
# Si fwknopd est mort, on réapplique au moins le filet management (anti-lockout).
if ! systemctl is-active --quiet fwknop-server; then
  logger -t spa-watchdog "fwknop-server inactif -> réapplication des règles de base"
  /usr/local/sbin/spa-firewall.sh
fi
EOF
chmod +x /usr/local/sbin/spa-watchdog.sh
cat > /etc/systemd/system/spa-watchdog.service <<'EOF'
[Unit]
Description=Watchdog SPA (anti-lockout)
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/spa-watchdog.sh
EOF
cat > /etc/systemd/system/spa-watchdog.timer <<'EOF'
[Unit]
Description=Vérifie fwknopd toutes les 2 minutes
[Timer]
OnBootSec=2min
OnUnitActiveSec=2min
[Install]
WantedBy=timers.target
EOF

# ── 6) Activation des services ────────────────────────────────────────────────
etape "Rechargement de systemd" systemctl daemon-reload
etape "Application du pare-feu de base" systemctl enable --now spa-firewall.service
etape "Démarrage de fwknopd" systemctl enable --now fwknop-server
etape "Activation du watchdog" systemctl enable --now spa-watchdog.timer

# ── 7) Fiche client (à reporter sur le poste opérateur) ───────────────────────
SRV_IP="$(ip -4 -o addr show "$PCAP_INTF" scope global 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | head -1)"
cat > "$CLIENT_OUT" <<EOF
# ~/.fwknoprc  — stanza pour $(hostname) (généré le $(date '+%F %T'))
[$(hostname -s)]
SPA_SERVER        ${SRV_IP:-<IP_PUBLIQUE_DU_SERVEUR>}
KEY_BASE64        $KEY_B64
HMAC_KEY_BASE64   $HMAC_B64
USE_HMAC          Y
ACCESS            tcp/$SSH_PORT
SPA_SERVER_PORT   $SPA_PORT

# Derrière un NAT (IP publique != IP locale), ajoute au client :  -R
# Se connecter (knock puis SSH) :
#   fwknop -n $(hostname -s) && ssh <utilisateur>@${SRV_IP:-<IP_SERVEUR>}
EOF
chmod 600 "$CLIENT_OUT"

# ── Bilan + GATE finale ───────────────────────────────────────────────────────
echo; echo "${G}${CYAN}=== Bilan ===${R}"
systemctl is-active --quiet fwknop-server && ok "fwknopd actif" || ko "fwknopd inactif (voir journalctl -u fwknop-server)"
systemctl is-active --quiet chrony        && ok "NTP (chrony) actif" || avert "NTP inactif"
if iptables -C INPUT -p tcp --dport "$SSH_PORT" -j DROP 2>/dev/null; then ok "SSH fermé par défaut (22 en DROP)"; else avert "règle DROP 22 absente"; fi
[ -n "$MGMT_IP" ] && [ "$KEEP_MGMT" = "yes" ] && ok "Filet management : $MGMT_IP garde l'accès au 22"

echo
echo "  ${G}Fiche client écrite dans : $CLIENT_OUT${R}"
echo "  ${JAUNE}▶ ÉTAPE SUIVANTE (depuis ton poste, dans un AUTRE terminal) :${R}"
echo "     1) installe le client :  sudo apt install fwknop-client"
echo "     2) copie la stanza ci-dessus dans  ~/.fwknoprc  (chmod 600)"
echo "     3) teste :  fwknop -n $(hostname -s) && ssh <user>@${SRV_IP:-<IP>}"
echo
echo "  ${JAUNE}Tant que tu n'as pas VALIDÉ un knock réussi, NE FERME PAS ta session actuelle.${R}"
if [ "$KEEP_MGMT" = "yes" ] && [ -n "$MGMT_IP" ]; then
  echo "  (Rappel : $MGMT_IP reste autorisée en permanence — pour une furtivité totale,"
  echo "   relance plus tard avec KEEP_MGMT=no une fois le knock validé.)"
fi
jrn "=== fin OK ==="

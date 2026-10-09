#!/usr/bin/env bash
# ============================================================================
#  tssr-postinstall.sh — Post-installation / post-clonage AUTOMATIQUE (Debian/RHEL).
#  -----------------------------------------------------------------------------
#  Zéro question : lit un fichier de réponses et met une VM en service, de façon
#  IDEMPOTENTE. Enchaîne : hostname unique, timezone, locale, NTP, mises à jour
#  (+ auto-updates), paquets de base, réseau, utilisateur + clé, durcissement SSH
#  (clés-only si une clé existe — anti-lockout), pare-feu de base, et en option
#  l'agent Zabbix et le SPA. Produit un bilan + un code de sortie (= nb d'échecs).
#
#  Fichier de réponses : --conf <fichier>, sinon /etc/tssr/postinstall.conf,
#  sinon des défauts sûrs. Modèle : https://tssr.miyukini.com/postinstall.conf.example
#
#  Usage :
#     sudo ./tssr-postinstall.sh --conf /etc/tssr/postinstall.conf
#     sudo NOM_HOTE=srv-web-01 NEW_USER=admin CLE_PUBLIQUE="ssh-ed25519 AAAA..." ./tssr-postinstall.sh
# ============================================================================
set -uo pipefail

# ── Charger la bibliothèque commune ──────────────────────────────────────────
# Cherche la lib à côté du script (usage autonome), puis aux emplacements du
# paquet (/usr/lib, /usr/local/lib), et en dernier recours depuis le site.
LIB_CHARGEE=""
for _cand in "$(dirname "$0")/tssr-lib.sh" /usr/lib/miyukini-toolbox/tssr-lib.sh /usr/local/lib/miyukini-toolbox/tssr-lib.sh; do
    if [ -f "$_cand" ]; then
        # shellcheck source=/dev/null
        source "$_cand"; LIB_CHARGEE=1; break
    fi
done
if [ -z "$LIB_CHARGEE" ]; then
    # shellcheck disable=SC1090
    source <(curl -fsSL https://tssr.miyukini.com/tssr-lib.sh) || { echo "Bibliothèque tssr-lib.sh introuvable."; exit 1; }
fi

# ── Valeurs par défaut (surchargées par le fichier de réponses / l'env) ──────
NOM_HOTE="${NOM_HOTE:-}"      ; DOMAINE="${DOMAINE:-}"
TIMEZONE="${TIMEZONE:-Europe/Paris}" ; LOCALE="${LOCALE:-fr_FR.UTF-8}"
RESEAU="${RESEAU:-dhcp}"     ; IP="${IP:-}" ; GW="${GW:-}" ; DNS="${DNS:-1.1.1.1 8.8.8.8}" ; IFACE="${IFACE:-}"
NEW_USER="${NEW_USER:-}"     ; CLE_PUBLIQUE="${CLE_PUBLIQUE:-}" ; ADMIN_SUDO="${ADMIN_SUDO:-oui}"
SSH_PORT="${SSH_PORT:-22}"   ; PORTS_OUVERTS="${PORTS_OUVERTS:-}"
MAJ_NOW="${MAJ_NOW:-oui}"    ; AUTO_UPDATES="${AUTO_UPDATES:-oui}"
ZABBIX_SERVER="${ZABBIX_SERVER:-}" ; SPA="${SPA:-non}"

# ── Fichier de réponses ──────────────────────────────────────────────────────
CONF=""
while [ $# -gt 0 ]; do
    case "$1" in
        --conf) CONF="${2:-}"; shift 2 ;;
        -h|--help) sed -n '2,24p' "$0"; exit 0 ;;
        *) shift ;;
    esac
done
[ -z "$CONF" ] && [ -f /etc/tssr/postinstall.conf ] && CONF="/etc/tssr/postinstall.conf"
if [ -n "$CONF" ] && [ -f "$CONF" ]; then set -a; . "$CONF"; set +a; fi

# ── A-t-on une clé publique en place ? (garde-fou anti-lockout) ──────────────
cle_presente() { grep -rqsE 'ssh-(ed25519|rsa|ecdsa)' /root/.ssh/authorized_keys /home/*/.ssh/authorized_keys 2>/dev/null; }

# ── Étapes ───────────────────────────────────────────────────────────────────
st_hostname() {
    [ -n "$NOM_HOTE" ] || { info "NOM_HOTE non défini — hostname inchangé."; return 0; }
    local fqdn="$NOM_HOTE"; [ -n "$DOMAINE" ] && fqdn="$NOM_HOTE.$DOMAINE"
    faire "hostname = $fqdn" hostnamectl set-hostname "$fqdn"
    if grep -qE '^127\.0\.1\.1' /etc/hosts 2>/dev/null; then
        sed -i "s/^127\.0\.1\.1.*/127.0.1.1 $fqdn $NOM_HOTE/" /etc/hosts
    else echo "127.0.1.1 $fqdn $NOM_HOTE" >> /etc/hosts; fi
}
st_time() {
    faire "timezone = $TIMEZONE" timedatectl set-timezone "$TIMEZONE"
    faire "installation de chrony (NTP)" pkg_install chrony
    faire "activation du NTP" bash -c "systemctl enable --now $NTP_SVC 2>/dev/null || systemctl enable --now chrony 2>/dev/null || systemctl enable --now chronyd"
}
st_locale() {
    if [ "$FAMILLE" = debian ]; then
        faire "génération de la locale $LOCALE" bash -c "grep -q '^${LOCALE}' /etc/locale.gen 2>/dev/null || echo '${LOCALE} UTF-8' >> /etc/locale.gen; sed -i 's/^# *\(${LOCALE} \)/\1/' /etc/locale.gen 2>/dev/null; locale-gen"
        faire "locale par défaut" update-locale "LANG=${LOCALE}"
    else
        faire "locale $LOCALE" localectl set-locale "LANG=${LOCALE}"
    fi
}
st_updates() {
    if [ "$MAJ_NOW" = oui ]; then faire "index des paquets" pkg_update_index; faire "mises à jour système" pkg_upgrade; fi
    [ "$AUTO_UPDATES" = oui ] || return 0
    if [ "$FAMILLE" = debian ]; then
        faire "unattended-upgrades" pkg_install unattended-upgrades
        faire "activation des MAJ auto" bash -c "printf 'APT::Periodic::Update-Package-Lists \"1\";\nAPT::Periodic::Unattended-Upgrade \"1\";\n' > /etc/apt/apt.conf.d/20auto-upgrades; systemctl enable unattended-upgrades 2>/dev/null || true"
    else
        faire "dnf-automatic" pkg_install dnf-automatic
        faire "activation des MAJ auto" systemctl enable --now dnf-automatic.timer
    fi
}
st_packages() {
    local base="curl git vim htop tree sudo net-tools"
    [ "$FAMILLE" = debian ] && base="$base ufw"
    faire "paquets de base" pkg_install $base
}
st_network() {
    [ "$RESEAU" = static ] || { info "Réseau en DHCP — rien à changer."; return 0; }
    [ -n "$IP" ] || { avert "RESEAU=static mais IP non définie — ignoré."; return 0; }
    [ -z "$IFACE" ] && IFACE="$(ip -o -4 route show to default 2>/dev/null | awk '{print $5; exit}')"
    [ -z "$IFACE" ] && IFACE="$(ip -o link 2>/dev/null | awk -F': ' '$2!="lo"{print $2; exit}')"
    if [ "$FAMILLE" = debian ]; then
        cp /etc/network/interfaces "/etc/network/interfaces.bak-$(date +%s)" 2>/dev/null
        { echo "source /etc/network/interfaces.d/*"; echo "auto lo"; echo "iface lo inet loopback";
          echo "auto $IFACE"; echo "iface $IFACE inet static"; echo "    address $IP"; echo "    gateway $GW";
          printf "    dns-nameservers"; for d in $DNS; do printf " %s" "$d"; done; echo; } > /etc/network/interfaces
        { echo "# tssr"; for d in $DNS; do echo "nameserver $d"; done; } > /etc/resolv.conf
        faire "réseau statique ($IP sur $IFACE)" bash -c "systemctl restart networking 2>/dev/null || { ifdown $IFACE; ifup $IFACE; }"
    else
        local con; con="$(nmcli -g NAME con show 2>/dev/null | head -1)"
        faire "réseau statique via nmcli ($IP)" bash -c "nmcli con mod \"$con\" ipv4.addresses $IP ipv4.gateway $GW ipv4.dns \"${DNS// /,}\" ipv4.method manual && nmcli con up \"$con\""
    fi
}
st_user() {
    [ -n "$NEW_USER" ] || { info "NEW_USER non défini — aucun compte créé."; return 0; }
    id "$NEW_USER" >/dev/null 2>&1 || faire "création de l'utilisateur $NEW_USER" useradd -m -s /bin/bash "$NEW_USER"
    [ "$ADMIN_SUDO" = oui ] && faire "ajout de $NEW_USER au groupe $GRP_ADMIN" usermod -aG "$GRP_ADMIN" "$NEW_USER"
    if [ -n "$CLE_PUBLIQUE" ]; then
        local h; h="$(getent passwd "$NEW_USER" | cut -d: -f6)"
        mkdir -p "$h/.ssh"; chmod 700 "$h/.ssh"
        grep -qF "$CLE_PUBLIQUE" "$h/.ssh/authorized_keys" 2>/dev/null || echo "$CLE_PUBLIQUE" >> "$h/.ssh/authorized_keys"
        chmod 600 "$h/.ssh/authorized_keys"; chown -R "$NEW_USER:$NEW_USER" "$h/.ssh"
        ok "clé publique installée pour $NEW_USER"
    else
        avert "aucune CLE_PUBLIQUE fournie — le durcissement SSH restera en mot de passe (anti-lockout)."
    fi
}
st_ssh() {
    command -v sshd >/dev/null 2>&1 || faire "installation d'openssh-server" pkg_install openssh-server
    mkdir -p /etc/ssh/sshd_config.d
    local drop=/etc/ssh/sshd_config.d/99-tssr.conf
    { echo "# tssr-postinstall"; echo "PermitRootLogin no"; echo "MaxAuthTries 3";
      echo "LoginGraceTime 30"; echo "ClientAliveInterval 300"; echo "ClientAliveCountMax 0";
      [ "$SSH_PORT" != 22 ] && echo "Port $SSH_PORT"; } > "$drop"
    if cle_presente; then
        { echo "PasswordAuthentication no"; echo "PubkeyAuthentication yes"; echo "KbdInteractiveAuthentication no"; } >> "$drop"
        info "SSH : authentification par clés uniquement."
    else
        avert "aucune clé publique → mot de passe CONSERVÉ."
    fi
    [ "$SSH_PORT" != 22 ] && fw_ouvrir_port "$SSH_PORT"
    if sshd -t >> "$LOG" 2>&1; then
        faire "rechargement de SSH" bash -c "systemctl reload $SSHD_SVC 2>/dev/null || systemctl restart $SSHD_SVC"
    else
        rm -f "$drop"; avert "sshd -t a refusé la conf SSH — annulée."; TSSR_FAILS=$((TSSR_FAILS+1))
    fi
}
st_firewall() {
    local p ports="$SSH_PORT $PORTS_OUVERTS"
    if [ "$FAMILLE" = rhel ] || [ "$FW" = firewalld ]; then
        faire "installation de firewalld" pkg_install firewalld
        svc_enable firewalld
        for p in $ports; do firewall-cmd --permanent --add-port="$p"/tcp >> "$LOG" 2>&1; done
        faire "application firewalld" firewall-cmd --reload
    else
        faire "installation de nftables" pkg_install nftables
        { echo '#!/usr/sbin/nft -f'; echo 'flush ruleset'; echo 'table inet filtre {'; echo '  chain entree {';
          echo '    type filter hook input priority 0; policy drop;'; echo '    ct state established,related accept';
          echo '    iif "lo" accept'; echo '    ip protocol icmp icmp type echo-request limit rate 5/second accept';
          for p in $ports; do echo "    tcp dport $p accept"; done; echo '  }'; echo '}'; } > /etc/nftables.conf
        faire "chargement des règles nftables" nft -f /etc/nftables.conf
        faire "activation de nftables" svc_enable nftables
    fi
}
st_zabbix() {
    [ -n "$ZABBIX_SERVER" ] || { info "ZABBIX_SERVER non défini — agent non installé."; return 0; }
    if [ "$FAMILLE" = debian ]; then
        local ZVER=7.4 DEB; . /etc/os-release 2>/dev/null
        case "${VERSION_ID:-12}" in 13*) DEB=debian13 ;; 12*) DEB=debian12 ;; 11*) DEB=debian11 ;; *) DEB=debian12 ;; esac
        faire "dépôt Zabbix" bash -c "wget -q 'https://repo.zabbix.com/zabbix/${ZVER}/release/debian/pool/main/z/zabbix-release/zabbix-release_latest_${ZVER}+${DEB}_all.deb' -O /tmp/zr.deb && dpkg -i /tmp/zr.deb && apt-get update"
    fi
    faire "installation de zabbix-agent2" pkg_install zabbix-agent2
    local CFG=/etc/zabbix/zabbix_agent2.conf
    [ -f "$CFG" ] && sed -i "s/^Server=.*/Server=$ZABBIX_SERVER/;s/^ServerActive=.*/ServerActive=$ZABBIX_SERVER:10051/;s/^Hostname=.*/Hostname=$(hostname)/" "$CFG"
    faire "activation de l'agent Zabbix" svc_enable zabbix-agent2
}
st_spa() {
    [ "$SPA" = oui ] || return 0
    cle_presente || { avert "SPA demandé mais aucune clé SSH → SPA SAUTÉ (anti-lockout)."; return 0; }
    faire "installation du SPA (fwknop)" bash -c "curl -fsSL https://tssr.miyukini.com/spa-install.sh -o /tmp/spa.sh && ASSUME_YES=1 MGMT_IP='${MGMT_IP:-}' bash /tmp/spa.sh"
}

# ── Déroulé ───────────────────────────────────────────────────────────────────
log_init postinstall
besoin_root || exit 1
detect_distro
titre "Post-installation automatique TSSR — $(hostname)"
info "Distribution : ${G}$FAMILLE${RAZ} ($PKG) · conf : ${CONF:-défauts} · journal : $LOG"

st_hostname
st_time
st_locale
st_updates
st_packages
st_network
st_user
st_ssh
st_firewall
st_zabbix
st_spa

titre "Bilan"
if [ "$TSSR_FAILS" -eq 0 ]; then ok "Post-installation terminée SANS échec."; else avert "$TSSR_FAILS étape(s) en échec — voir $LOG."; fi
reboot_needed && avert "Un redémarrage est recommandé (noyau / bibliothèques)."
info "Pour vérifier le durcissement : tssr-toolbox.sh → 17 (check-list de conformité)."
exit "$TSSR_FAILS"

#!/usr/bin/env bash
# @id tssr.toolbox
# @do outiller_l_administration_d_une_debian_pour_les_tp_tssr
# @role orchestration
# @layer outil
# @human Boîte à outils Debian pour les TP TSSR : un menu, des séquences avec gate de validation, un journal des erreurs
#
# ════════════════════════════════════════════════════════════════════════════
#  BOÎTE À OUTILS TSSR — Debian 13
#  -----------------------------------------------------------------------------
#  Un script PÉDAGOGIQUE : un menu principal, et des « séquences » (statut,
#  paquets, IP, SSH, utilisateur, serveurs web, bastion, GLPI, sauvegarde).
#
#  Règles du jeu (les mêmes pour chaque séquence) :
#    • chaque séquence se termine par une GATE de validation (OK / ÉCHEC) ;
#    • en cas d'échec, on écrit POURQUOI dans un journal, on l'explique à
#      l'écran, et on revient au menu principal ;
#    • après chaque séquence : Entrée = revenir au menu (défaut), Q = quitter.
#
#  Utilisation :
#    1) télécharge le script sur ta VM  (ne PAS le lancer en « curl | bash » :
#       il est interactif et a besoin du clavier) ;
#    2) rends-le exécutable :  chmod +x tssr-toolbox.sh
#    3) lance-le en root     :  sudo ./tssr-toolbox.sh
# ════════════════════════════════════════════════════════════════════════════
#
# ════════════════════════════════════════════════════════════════════════════
#  COMPRENDRE LE BALISAGE MSCM  (pour un formateur ou un relecteur)
#  -----------------------------------------------------------------------------
#  Chaque fonction est précédée d'une « étiquette » MSCM : un petit en-tête
#  normalisé qui dit, en une fois, CE QUE fait le bloc et POURQUOI. Un générateur
#  peut ensuite collecter ces étiquettes pour produire un index du code.
#
#  Cinq champs (deux obligatoires) :
#    @id      identifiant unique, en points (ex: tssr.toolbox.ssh)      [OBLIGATOIRE]
#    @do      ce que le bloc fait : verbe à l'infinitif, sans espaces   [OBLIGATOIRE]
#    @role    rôle sémantique : orchestration | securite | donnee | gate |
#             config | ui ...
#    @layer   couche d'architecture : ici « outil » (parfois « config »)
#    @human   une phrase lisible, EN FRANÇAIS, pour un humain
#
#  Exemple (celui de la séquence SSH, un peu plus bas) :
#    # @id tssr.toolbox.ssh
#    # @do durcir_la_configuration_ssh
#    # @role securite
#    # @layer outil
#    # @human Durcissement SSH : changer le port et interdire root, puis redémarrer SSH
#
#  Espace de noms de ce script :  tssr.toolbox.<unité>
#  (une racine « tssr.toolbox », puis une unité par fonction).
#
#  -----------------------------------------------------------------------------
#  INDEX MSCM — tous les blocs de ce script :
#    tssr.toolbox              la racine : la boîte à outils elle-même
#    tssr.toolbox.journal      le journal horodaté (actions + raisons d'échec)
#    tssr.toolbox.ui           couleurs, titres, questions oui/non, saisies
#    tssr.toolbox.gate         étapes, gates de validation, explication des échecs
#    tssr.toolbox.distro       détection distro + commandes (apt/dnf, sudo/wheel, firewalld/nft, SELinux/AppArmor)
#    tssr.toolbox.statut       (1)  statut & tests rapides
#    tssr.toolbox.paquets      (2)  paquets de base
#    tssr.toolbox.reseau       (3)  configuration IP statique
#    tssr.toolbox.ssh          (4)  SSH : durcissement + SPA furtif (fwknop)
#    tssr.toolbox.ssh.spa           installeur SPA fwknop (SSH furtif)
#    tssr.toolbox.utilisateur  (5)  création d'un utilisateur
#    tssr.toolbox.web          (6/7) pile web commune (PHP + MariaDB)
#    tssr.toolbox.web.apache   (6)  serveur web Apache
#    tssr.toolbox.web.nginx    (7)  serveur web nginx
#    tssr.toolbox.bastion      (8)  bastion Apache Guacamole
#    tssr.toolbox.glpi         (9)  serveur GLPI
#    tssr.toolbox.sauvegarde   (10) sauvegarde /etc + /home
#    tssr.toolbox.zabbix       (11) brancher la VM à Zabbix (agent 2)
#    tssr.toolbox.modele       (12) préparer un modèle (sceller pour clonage)
#    tssr.toolbox.parefeu      (13) pare-feu de base + fail2ban
#    tssr.toolbox.audit        (14) audit sécurité (lecture seule) + rapport
#    tssr.toolbox.hardening    (15) durcissement serveur (baseline du guide)
#    tssr.toolbox.motdepasse   (16) politique de mots de passe (pwquality + login.defs)
#    tssr.toolbox.checklist    (17) check-list de conformité (rapport)
#    tssr.toolbox.provision    (P)  provisionner une VM (mise en service guidée)
#    tssr.toolbox.flux         le menu, le retour menu/quitter, la sortie
#    tssr.toolbox.main         le point d'entrée
# ════════════════════════════════════════════════════════════════════════════


# ─────────────────────────────────────────────────────────────────────────────
# @id tssr.toolbox.journal
# @do initialiser_et_alimenter_le_journal_de_session
# @role donnee
# @layer outil
# @human Le journal : un fichier horodaté où l'on écrit chaque action et chaque échec
# ─────────────────────────────────────────────────────────────────────────────
LOG=""
log_init() {
    local d="/var/log/tssr-toolbox"
    mkdir -p "$d" 2>/dev/null || d="/tmp"
    LOG="$d/tssr-toolbox-$(date +%Y%m%d-%H%M%S).log"
    : > "$LOG" 2>/dev/null || LOG="/tmp/tssr-toolbox.log"
    journal "=== Démarrage de la boîte à outils TSSR ==="
}
# journal "message" : ajoute une ligne horodatée dans le fichier de log.
journal() { printf '%s  %s\n' "$(date '+%F %T')" "$1" >> "$LOG" 2>/dev/null; }


# ─────────────────────────────────────────────────────────────────────────────
# @id tssr.toolbox.ui
# @do afficher_des_messages_colores_et_lire_les_saisies
# @role ui
# @layer outil
# @human L'habillage : couleurs, titres, questions oui/non et saisies avec valeur par défaut
# ─────────────────────────────────────────────────────────────────────────────
# Les couleurs ne s'activent que si la sortie est un vrai terminal.
if [ -t 1 ]; then
    RAZ=$'\e[0m'; GRAS=$'\e[1m'
    VERT=$'\e[32m'; ROUGE=$'\e[31m'; JAUNE=$'\e[33m'; BLEU=$'\e[34m'; CYAN=$'\e[36m'
else
    RAZ=""; GRAS=""; VERT=""; ROUGE=""; JAUNE=""; BLEU=""; CYAN=""
fi

titre() { echo; echo "${GRAS}${BLEU}  ─── $* ───${RAZ}"; echo; }
info()  { echo "  ${CYAN}•${RAZ} $*"; }
ok()    { echo "  ${VERT}[ OK ]${RAZ} $*"; }
avert() { echo "  ${JAUNE}[AVERT]${RAZ} $*"; }
err()   { echo "  ${ROUGE}[ERREUR]${RAZ} $*"; }
pause() { read -rp "  (Appuie sur Entrée pour continuer) " _; }

# demander "question" NOM_VARIABLE "valeur_par_defaut(optionnel)"
demander() {
    local p="$1" __var="$2" def="${3:-}" ans
    if [ -n "$def" ]; then
        read -rp "  $p [${def}] : " ans; ans="${ans:-$def}"
    else
        read -rp "  $p : " ans
    fi
    printf -v "$__var" '%s' "$ans"
}

# confirmer "question" "defaut(o|n)"  → renvoie 0 si la réponse est OUI
confirmer() {
    local q="$1" def="${2:-o}" ans
    if [ "$def" = "o" ]; then read -rp "  $q [O/n] : " ans; else read -rp "  $q [o/N] : " ans; fi
    ans="${ans,,}"; ans="${ans:-$def}"
    [ "$ans" = "o" ] || [ "$ans" = "oui" ] || [ "$ans" = "y" ]
}


# ─────────────────────────────────────────────────────────────────────────────
# @id tssr.toolbox.gate
# @do valider_une_etape_et_tracer_les_echecs_avec_une_explication
# @role gate
# @layer outil
# @human Les garde-fous : chaque étape et chaque gate dit OK ou ÉCHEC, et un échec est expliqué puis journalisé
# ─────────────────────────────────────────────────────────────────────────────
SEQ_COURANTE=""   # nom de la séquence en cours (pour le journal)

# etape "description" commande...   → exécute, journalise ; sur échec : explique.
etape() {
    local desc="$1"; shift
    info "… $desc"
    if "$@" >> "$LOG" 2>&1; then
        ok "$desc"; return 0
    else
        echouer "$desc"; return 1
    fi
}

# gate "description" commande_de_test...  → la validation finale d'une séquence.
gate() {
    local desc="$1"; shift
    if "$@" >> "$LOG" 2>&1; then
        ok "GATE OK — $desc"; journal "GATE OK [$SEQ_COURANTE] : $desc"; return 0
    else
        err "GATE ÉCHEC — $desc"; journal "GATE ECHEC [$SEQ_COURANTE] : $desc"; return 1
    fi
}

# echouer "raison"  → écrit dans le journal ET explique à l'étudiant le pourquoi.
echouer() {
    local raison="$1"
    err "ÉCHEC : $raison"
    journal "ECHEC [$SEQ_COURANTE] : $raison"
    echo
    echo "  ${ROUGE}${GRAS}Pourquoi ça n'a pas marché ?${RAZ}"
    echo "    • Étape en échec : ${raison}"
    echo "    • Journal complet : ${LOG}"
    echo "    • Pistes à vérifier :"
    echo "        - es-tu bien en root (sudo) ?"
    echo "        - as-tu accès à Internet ? (séquence 1 : Statut & tests)"
    echo "        - le nom d'un paquet / service / fichier est-il correct ?"
    echo "        - relis la dernière ligne d'erreur ci-dessus."
}

# besoin_root  → refuse la séquence si on n'est pas root.
besoin_root() {
    if [ "$(id -u)" -ne 0 ]; then
        echouer "cette séquence doit être lancée en root (sudo $0)"
        return 1
    fi
}


# ─────────────────────────────────────────────────────────────────────────────
# @id tssr.toolbox.distro
# @do detecter_la_distribution_et_abstraire_les_commandes
# @role config
# @layer outil
# @human Détecte Debian/RHEL et choisit les bonnes commandes : apt/dnf, groupe sudo/wheel, pare-feu, SELinux/AppArmor
# ─────────────────────────────────────────────────────────────────────────────
PKG="inconnu"; FAMILLE="inconnu"; GRP_ADMIN="sudo"; FW="aucun"; MAC="aucun"; SSHD_SVC="ssh"
detect_distro() {
    . /etc/os-release 2>/dev/null
    if   command -v apt-get >/dev/null 2>&1; then PKG=apt; FAMILLE=debian; GRP_ADMIN=sudo;  MAC=apparmor; SSHD_SVC=ssh
    elif command -v dnf     >/dev/null 2>&1; then PKG=dnf; FAMILLE=rhel;   GRP_ADMIN=wheel; MAC=selinux;  SSHD_SVC=sshd
    elif command -v yum     >/dev/null 2>&1; then PKG=yum; FAMILLE=rhel;   GRP_ADMIN=wheel; MAC=selinux;  SSHD_SVC=sshd
    fi
    if   command -v firewall-cmd >/dev/null 2>&1; then FW=firewalld
    elif command -v nft          >/dev/null 2>&1; then FW=nftables
    elif command -v ufw          >/dev/null 2>&1; then FW=ufw
    fi
}
pkg_update_index() { case "$PKG" in apt) apt-get update ;; dnf) dnf -y makecache ;; yum) yum -y makecache ;; esac; }
pkg_upgrade()      { case "$PKG" in apt) DEBIAN_FRONTEND=noninteractive apt-get -y upgrade ;; dnf) dnf -y upgrade ;; yum) yum -y update ;; esac; }
pkg_install()      { case "$PKG" in apt) DEBIAN_FRONTEND=noninteractive apt-get install -y "$@" ;; dnf) dnf install -y "$@" ;; yum) yum install -y "$@" ;; esac; }
# Nombre de paquets pouvant être mis à jour (0 = système à jour).
pkg_upgradable()   { case "$PKG" in apt) apt-get -s upgrade 2>/dev/null | grep -c '^Inst ' ;; dnf|yum) dnf -q check-update 2>/dev/null | grep -cE '^[a-zA-Z0-9]' ;; *) echo 0 ;; esac; }
# Renvoie 0 (vrai) si un redémarrage est nécessaire.
reboot_needed() {
    if [ "$PKG" = apt ]; then [ -f /var/run/reboot-required ]; return; fi
    if command -v needs-restarting >/dev/null 2>&1; then needs-restarting -r >/dev/null 2>&1 && return 1 || return 0; fi
    return 1
}
# Ouvre un port TCP dans le pare-feu actif (idempotent, best-effort).
fw_ouvrir_port() {
    case "$FW" in
        firewalld) firewall-cmd --permanent --add-port="$1"/tcp >/dev/null 2>&1; firewall-cmd --reload >/dev/null 2>&1 ;;
        ufw)       ufw allow "$1"/tcp >/dev/null 2>&1 ;;
    esac
}


# ─────────────────────────────────────────────────────────────────────────────
# @id tssr.toolbox.statut
# @do afficher_le_statut_reseau_et_systeme
# @role orchestration
# @layer outil
# @human Statut & tests rapides : IP, DHCP/statique, passerelle, DNS, pings, disque, RAM, uptime
# ─────────────────────────────────────────────────────────────────────────────
seq_statut() {
    SEQ_COURANTE="Statut & tests rapides"
    titre "1) Statut & tests rapides"

    # Interface principale = celle de la route par défaut (sinon la 1re hors lo).
    local IFACE IP MODE GW DNS1
    IFACE="$(ip -o -4 route show to default 2>/dev/null | awk '{print $5; exit}')"
    [ -z "$IFACE" ] && IFACE="$(ip -o link 2>/dev/null | awk -F': ' '$2!="lo"{print $2; exit}')"
    IP="$(ip -4 -o addr show "${IFACE:-}" scope global 2>/dev/null | awk '{print $4}' | head -1)"
    GW="$(ip -4 route show default 2>/dev/null | awk '/default/{print $3; exit}')"
    DNS1="$(awk '/^nameserver/{print $2; exit}' /etc/resolv.conf 2>/dev/null)"

    # Statique ou DHCP ? On cherche d'abord dans /etc/network/interfaces.
    if grep -qsE "iface .* inet dhcp"   /etc/network/interfaces /etc/network/interfaces.d/* 2>/dev/null; then MODE="DHCP (fichier interfaces)"
    elif grep -qsE "iface .* inet static" /etc/network/interfaces /etc/network/interfaces.d/* 2>/dev/null; then MODE="Statique (fichier interfaces)"
    elif pgrep -x dhclient >/dev/null 2>&1; then MODE="DHCP (dhclient actif)"
    else MODE="Indéterminé (NetworkManager/systemd-networkd ?)"; fi

    echo "  Interface principale : ${CYAN}${IFACE:-?}${RAZ}"
    echo "  Adresse IP           : ${CYAN}${IP:-aucune}${RAZ}"
    echo "  Mode d'adressage     : ${CYAN}${MODE}${RAZ}"
    echo "  Passerelle           : ${CYAN}${GW:-aucune}${RAZ}"
    echo "  Serveur DNS          : ${CYAN}${DNS1:-aucun}${RAZ}"
    echo

    # Petit utilitaire local : un ping unique, 1 s de délai, et un verdict coloré.
    _p() { ping -c1 -W1 "$1" >/dev/null 2>&1 && echo "${VERT}OK${RAZ}" || echo "${ROUGE}KO${RAZ}"; }
    [ -n "$GW" ]   && echo "  Ping passerelle ($GW) : $(_p "$GW")"
    [ -n "$DNS1" ] && echo "  Ping DNS ($DNS1) : $(_p "$DNS1")"
    echo "  Ping 8.8.8.8 (Internet brut) : $(_p 8.8.8.8)"
    if ping -c1 -W1 google.fr >/dev/null 2>&1; then
        echo "  Ping google.fr (résolution DNS) : ${VERT}OK${RAZ}"
    else
        echo "  Ping google.fr (résolution DNS) : ${ROUGE}KO${RAZ}  → la résolution de noms échoue"
    fi
    echo
    echo "  ${GRAS}Espace disque (df -h) :${RAZ}"
    df -h 2>/dev/null | grep -vE 'tmpfs|udev|loop' | sed 's/^/    /'
    echo "  ${GRAS}Mémoire (free -h) :${RAZ}"
    free -h 2>/dev/null | sed 's/^/    /'
    echo "  ${GRAS}Uptime :${RAZ} $(uptime -p 2>/dev/null)"
    echo

    journal "statut IFACE=$IFACE IP=$IP MODE=$MODE GW=$GW DNS=$DNS1"
    # GATE : on considère le diagnostic réussi si on a au moins trouvé une IP.
    if [ -n "$IP" ]; then
        ok "GATE OK — diagnostic produit"
    else
        echouer "aucune adresse IP détectée (interface absente ou réseau non configuré)"
        return 1
    fi
}


# ─────────────────────────────────────────────────────────────────────────────
# @id tssr.toolbox.paquets
# @do installer_les_paquets_indispensables
# @role orchestration
# @layer outil
# @human Paquets de base : curl, git, vim, htop, tree, net-tools, ufw, sudo
# ─────────────────────────────────────────────────────────────────────────────
seq_paquets() {
    SEQ_COURANTE="Paquets de base"
    titre "2) Installation des paquets de base"
    besoin_root || return 1

    local PAQUETS=(curl git vim htop tree net-tools ufw sudo)
    info "Paquets à installer : ${PAQUETS[*]}"
    confirmer "Lancer l'installation ?" o || { info "Annulé, retour au menu."; return 0; }

    etape "Mise à jour de l'index APT (apt-get update)" apt-get update || return 1
    etape "Installation des paquets" apt-get install -y "${PAQUETS[@]}" || return 1

    # GATE : on vérifie que chaque outil répond bien (net-tools fournit « route »).
    local manque=() c
    for c in curl git vim htop tree route ufw sudo; do
        command -v "$c" >/dev/null 2>&1 || manque+=("$c")
    done
    if [ "${#manque[@]}" -eq 0 ]; then
        ok "GATE OK — tous les outils sont présents"
    else
        echouer "outils toujours manquants : ${manque[*]}"
        return 1
    fi
}


# ─────────────────────────────────────────────────────────────────────────────
# @id tssr.toolbox.reseau
# @do configurer_une_ip_statique_dans_interfaces
# @role config
# @layer outil
# @human Configuration IP : IP/masque/passerelle/DNS, réécriture de /etc/network/interfaces et redémarrage du réseau
# ─────────────────────────────────────────────────────────────────────────────
seq_config_ip() {
    SEQ_COURANTE="Configuration IP statique"
    titre "3) Configuration IP statique"
    besoin_root || return 1

    avert "Cette séquence réécrit /etc/network/interfaces et redémarre le réseau."
    avert "Si tu es connecté EN SSH, la session peut être coupée : garde un accès console."
    confirmer "Continuer ?" n || { info "Annulé, retour au menu."; return 0; }

    local IFACE IPCIDR GW DNS defif
    defif="$(ip -o link 2>/dev/null | awk -F': ' '$2!="lo"{print $2; exit}')"
    demander "Interface réseau" IFACE "${defif:-eth0}"
    demander "Adresse IP avec préfixe CIDR (ex: 10.22.10.50/24)" IPCIDR
    demander "Passerelle (ex: 10.22.10.254)" GW
    demander "DNS (séparés par un espace)" DNS "1.1.1.1 8.8.8.8"

    # Validation des saisies AVANT de toucher au système.
    echo "$IPCIDR" | grep -qE '^([0-9]{1,3}\.){3}[0-9]{1,3}/[0-9]{1,2}$' \
        || { echouer "format IP/CIDR invalide : $IPCIDR (attendu : a.b.c.d/xx)"; return 1; }
    echo "$GW" | grep -qE '^([0-9]{1,3}\.){3}[0-9]{1,3}$' \
        || { echouer "passerelle invalide : $GW"; return 1; }

    # On SAUVEGARDE l'ancien fichier (toujours, avant d'écrire).
    local SAVE="/etc/network/interfaces.bak-$(date +%Y%m%d-%H%M%S)"
    cp /etc/network/interfaces "$SAVE" 2>/dev/null && info "Sauvegarde de l'ancienne conf : $SAVE"

    # On écrit la nouvelle configuration (loopback + interface en statique).
    local dns_line=""; local d
    for d in $DNS; do dns_line="$dns_line $d"; done
    cat > /etc/network/interfaces <<EOF
# Généré par la boîte à outils TSSR le $(date '+%F %T')
source /etc/network/interfaces.d/*

auto lo
iface lo inet loopback

auto $IFACE
iface $IFACE inet static
    address $IPCIDR
    gateway $GW
    dns-nameservers$dns_line
EOF

    # Résolution DNS immédiate (au cas où resolvconf ne gère pas interfaces).
    { echo "# Généré par la boîte à outils TSSR"; for d in $DNS; do echo "nameserver $d"; done; } \
        > /etc/resolv.conf 2>/dev/null || true

    # Redémarrage du réseau (deux méthodes selon la distro).
    if ! systemctl restart networking >> "$LOG" 2>&1; then
        avert "systemctl restart networking a échoué, tentative avec ifdown/ifup…"
        ifdown "$IFACE" >> "$LOG" 2>&1; ifup "$IFACE" >> "$LOG" 2>&1
    fi
    sleep 2

    # GATE : l'adresse demandée apparaît-elle bien sur l'interface ?
    local want="${IPCIDR%/*}"
    if ip -4 addr show "$IFACE" 2>/dev/null | grep -q "$want"; then
        ok "GATE OK — $want est actif sur $IFACE"
    else
        echouer "l'adresse $want n'apparaît pas sur $IFACE (pour revenir en arrière : cp $SAVE /etc/network/interfaces)"
        return 1
    fi
}


# ─────────────────────────────────────────────────────────────────────────────
# @id tssr.toolbox.ssh
# @do durcir_la_configuration_ssh
# @role securite
# @layer outil
# @human SSH : durcissement (port + root interdit) ET option SPA furtif (fwknop), port 22 fermé par défaut
# ─────────────────────────────────────────────────────────────────────────────
# Dispatcher : petit sous-menu de la partie SSH.
seq_ssh() {
    SEQ_COURANTE="SSH"
    titre "4) SSH — durcissement & furtivité"
    echo "   ${GRAS}a${RAZ}) Durcir SSH (changer le port + interdire root)"
    echo "   ${GRAS}b${RAZ}) Installer le SPA fwknop (SSH furtif : port 22 fermé par défaut)"
    echo "   ${GRAS}m${RAZ}) Retour au menu principal"
    echo
    local c; read -rp "  Ton choix : " c
    case "${c,,}" in
        a) __ssh_hardening ;;
        b) __ssh_spa ;;
        *) return 0 ;;
    esac
}

# @id tssr.toolbox.ssh.spa
# @do installer_le_spa_fwknop_pour_un_ssh_furtif
# @role securite
# @layer outil
# @human SPA fwknop : télécharge et lance l'installeur qui ferme le 22 et ne l'ouvre qu'à un paquet signé
# Télécharge et lance l'installeur SPA (fwknop) — SSH furtif, sans bastion.
__ssh_spa() {
    SEQ_COURANTE="SSH furtif (SPA fwknop)"
    titre "SPA fwknop — SSH furtif (port 22 fermé par défaut)"
    besoin_root || return 1
    avert "Le SPA FERME le port SSH : il ne s'ouvre qu'à la volée, pour l'IP qui envoie un paquet signé."
    avert "Garde une session SSH ouverte ET une clé publique en place (anti-lockout)."
    confirmer "Télécharger et lancer l'installeur SPA (fwknop) ?" o || { info "Annulé, retour au menu."; return 0; }
    local URL="https://tssr.miyukini.com/spa-install.sh"
    if etape "Téléchargement de l'installeur SPA" curl -fsSL "$URL" -o /tmp/spa-install.sh; then
        chmod +x /tmp/spa-install.sh
        info "Lancement de l'installeur SPA (il a ses propres gates et son journal)…"
        echo
        bash /tmp/spa-install.sh
    else
        return 1
    fi
}

# Durcissement SSH classique : changer le port + interdire root.
__ssh_hardening() {
    SEQ_COURANTE="Durcissement SSH"
    titre "Durcissement SSH (port + root interdit)"
    besoin_root || return 1
    detect_distro
    command -v sshd >/dev/null 2>&1 || { echouer "openssh-server n'est pas installé"; return 1; }

    local PORT
    demander "Nouveau port SSH" PORT "2222"
    echo "$PORT" | grep -qE '^[0-9]+$' && [ "$PORT" -ge 1 ] && [ "$PORT" -le 65535 ] \
        || { echouer "port invalide : $PORT"; return 1; }

    avert "Après coup, on se connecte avec :  ssh -p $PORT utilisateur@IP"
    avert "Le port sera ouvert dans ufw si présent. GARDE une session SSH ouverte en secours."
    confirmer "Appliquer (Port $PORT + PermitRootLogin no) ?" n || { info "Annulé, retour au menu."; return 0; }

    local CFG="/etc/ssh/sshd_config"
    local SAVE="$CFG.bak-$(date +%Y%m%d-%H%M%S)"
    cp "$CFG" "$SAVE" && info "Sauvegarde : $SAVE"

    # Réglage du port (on remplace la ligne existante, commentée ou non, sinon on ajoute).
    if grep -qE '^\s*#?\s*Port\s' "$CFG"; then
        sed -i "s/^\s*#\?\s*Port\s.*/Port $PORT/" "$CFG"
    else
        echo "Port $PORT" >> "$CFG"
    fi
    # Interdiction du login root.
    if grep -qE '^\s*#?\s*PermitRootLogin' "$CFG"; then
        sed -i "s/^\s*#\?\s*PermitRootLogin.*/PermitRootLogin no/" "$CFG"
    else
        echo "PermitRootLogin no" >> "$CFG"
    fi

    # On teste la config AVANT de redémarrer (sinon on peut casser SSH).
    if ! sshd -t >> "$LOG" 2>&1; then
        avert "Configuration invalide : restauration de $SAVE"
        cp "$SAVE" "$CFG"
        echouer "sshd -t a refusé la nouvelle configuration (rien n'a été appliqué)"
        return 1
    fi

    # Ouverture du port dans le pare-feu actif (ufw/firewalld), best-effort.
    fw_ouvrir_port "$PORT"; [ "$FW" != aucun ] && info "Pare-feu ($FW) : $PORT/tcp autorisé."

    etape "Redémarrage de SSH" systemctl restart "$SSHD_SVC" || return 1
    sleep 1
    if ss -tlnp 2>/dev/null | grep -q ":$PORT "; then
        ok "SSH écoute sur le port $PORT et root est interdit"
    else
        echouer "SSH n'écoute pas sur le port $PORT (restaure avec : cp $SAVE $CFG)"
        return 1
    fi

    # ── Durcissement avancé (recommandations du guide hardening) ──────────────
    if confirmer "Appliquer le durcissement SSH avancé (tentatives, timeouts, AllowGroups) ?" o; then
        local GRP
        avert "Assure-toi que TON compte est membre du groupe choisi, sinon AllowGroups t'enferme dehors."
        demander "Groupe autorisé à se connecter en SSH" GRP "$GRP_ADMIN"
        mkdir -p /etc/ssh/sshd_config.d
        cat > /etc/ssh/sshd_config.d/99-tssr-hardening.conf <<EOF
# Durcissement SSH avancé (guide) — posé par tssr-toolbox.sh
MaxAuthTries 3
LoginGraceTime 30
ClientAliveInterval 300
ClientAliveCountMax 0
AllowGroups $GRP
EOF
        if confirmer "Passer aussi en clés uniquement (désactive le mot de passe) ?" n; then
            if grep -rqsE 'ssh-(ed25519|rsa|ecdsa)' /root/.ssh/authorized_keys /home/*/.ssh/authorized_keys 2>/dev/null; then
                printf 'PasswordAuthentication no\nPubkeyAuthentication yes\nKbdInteractiveAuthentication no\n' >> /etc/ssh/sshd_config.d/99-tssr-hardening.conf
                info "Authentification par clés uniquement activée."
            else
                avert "Aucune clé publique trouvée → mot de passe CONSERVÉ (anti-lockout)."
            fi
        fi
        if sshd -t >> "$LOG" 2>&1; then
            etape "Rechargement SSH (durcissement avancé)" systemctl reload "$SSHD_SVC" || return 1
            ok "GATE OK — durcissement SSH avancé appliqué (AllowGroups $GRP)"
        else
            rm -f /etc/ssh/sshd_config.d/99-tssr-hardening.conf
            echouer "sshd -t a refusé le durcissement avancé (annulé)"
            return 1
        fi
    fi
}


# ─────────────────────────────────────────────────────────────────────────────
# @id tssr.toolbox.utilisateur
# @do creer_un_utilisateur_avec_mot_de_passe_sudo_et_invite
# @role securite
# @layer outil
# @human Création d'un utilisateur : compte, mot de passe (lab ou aléatoire), option sudo, option invite colorée
# ─────────────────────────────────────────────────────────────────────────────
seq_user() {
    SEQ_COURANTE="Création d'un utilisateur"
    titre "5) Création d'un utilisateur"
    besoin_root || return 1

    local U
    demander "Nom du nouvel utilisateur" U
    echo "$U" | grep -qE '^[a-z_][a-z0-9_-]*$' \
        || { echouer "nom d'utilisateur invalide : $U (minuscules, chiffres, - et _)"; return 1; }

    if id "$U" >/dev/null 2>&1; then
        avert "L'utilisateur $U existe déjà, on ne le recrée pas."
    else
        etape "Création du compte $U (dossier /home + shell bash)" useradd -m -s /bin/bash "$U" || return 1
    fi

    # Mot de passe : celui du lab, ou un aléatoire.
    local MDP
    if confirmer "Utiliser le mot de passe lab « Azerty77 » ? (sinon aléatoire)" o; then
        MDP="Azerty77"
    else
        MDP="$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 12)"
    fi
    echo "$U:$MDP" | chpasswd || { echouer "impossible de définir le mot de passe de $U"; return 1; }
    info "Mot de passe de ${GRAS}$U${RAZ} : ${GRAS}$MDP${RAZ}  (à transmettre de façon sûre)"

    if confirmer "Forcer le changement du mot de passe à la 1re connexion ?" n; then
        passwd -e "$U" >> "$LOG" 2>&1 && info "Changement forcé à la première connexion activé."
    fi

    # Option sudo.
    if confirmer "Ajouter $U au groupe sudo (droits d'administration) ?" o; then
        etape "Ajout de $U au groupe sudo" usermod -aG sudo "$U" || true
    fi

    # Option invite .bashrc personnalisée.
    if confirmer "Personnaliser son invite (nom coloré + statut ✔/✘ + chemin absolu) ?" o; then
        local HOMEU; HOMEU="$(getent passwd "$U" | cut -d: -f6)"
        # On ajoute un bloc repérable (quoté : le contenu est écrit TEL QUEL).
        cat >> "$HOMEU/.bashrc" <<'BRC'

# >>> TSSR invite personnalisée >>>
# Invite : utilisateur@hôte en VERT, chemin ABSOLU en bleu,
# et un ✔ vert / ✘ rouge selon le succès de la dernière commande.
PROMPT_COMMAND='__ret=$?'
__tssr_etat() { if [ "${__ret:-0}" -eq 0 ]; then printf '\033[32m✔\033[0m'; else printf '\033[31m✘\033[0m'; fi; }
PS1='\[\e[1;32m\]\u@\h\[\e[0m\]:\[\e[1;34m\]$PWD\[\e[0m\] $(__tssr_etat)\$ '
alias ll='ls -alF --color=auto'
alias grep='grep --color=auto'
# <<< TSSR invite personnalisée <<<
BRC
        chown "$U:$U" "$HOMEU/.bashrc" 2>/dev/null || true
        info "Invite personnalisée ajoutée (visible à la prochaine connexion de $U)."
    fi

    # GATE : le compte existe-t-il bien ?
    if id "$U" >/dev/null 2>&1; then
        ok "GATE OK — utilisateur $U prêt (groupes : $(id -nG "$U" | tr ' ' ','))"
    else
        echouer "le compte $U reste introuvable"
        return 1
    fi
}


# ─────────────────────────────────────────────────────────────────────────────
# @id tssr.toolbox.web
# @do installer_une_pile_web_php_et_une_base_mariadb
# @role orchestration
# @layer outil
# @human Serveur web (Apache ou nginx) + PHP + MariaDB : base locale ou distante, et page de test de la connexion
# ─────────────────────────────────────────────────────────────────────────────
DB_LOCAL=1; DB_HOST=""; DB_USER=""; DB_PASS=""; DB_NAME=""

# __config_db : demande si la base est locale ; sinon récupère et teste la base distante.
__config_db() {
    if confirmer "La base de données est-elle sur CETTE machine ?" o; then
        DB_LOCAL=1; DB_HOST="127.0.0.1"; DB_USER="labuser"; DB_PASS="Azerty77"; DB_NAME="labdb"
        return 0
    fi
    DB_LOCAL=0
    demander "Hôte de la base distante (IP)" DB_HOST
    demander "Utilisateur de la base" DB_USER
    demander "Mot de passe de la base" DB_PASS
    demander "Nom de la base" DB_NAME
    # Test de connexion si le client mysql est présent, sinon simple test du port 3306.
    if command -v mysql >/dev/null 2>&1; then
        if mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" -e "SELECT 1" "$DB_NAME" >> "$LOG" 2>&1; then
            ok "Connexion à la base distante : OK"
        else
            avert "Connexion à la base distante impossible (vérifie infos, réseau, et le GRANT côté serveur)."
        fi
    else
        if (echo > "/dev/tcp/$DB_HOST/3306") >/dev/null 2>&1; then
            ok "Port 3306 joignable sur $DB_HOST"
        else
            avert "Port 3306 injoignable sur $DB_HOST (pare-feu ? bind-address ?)."
        fi
    fi
}

# __install_web apache|nginx : le cœur commun aux deux serveurs web.
__install_web() {
    local TYPE="$1" SRV
    besoin_root || return 1

    info "Vérification de l'existant…"
    command -v php    >/dev/null 2>&1 && info "PHP présent : $(php -v 2>/dev/null | head -1)" || info "PHP : absent."
    command -v mysql  >/dev/null 2>&1 && info "Client MariaDB/MySQL : présent." || info "MariaDB : absent."
    if [ "$TYPE" = "apache" ]; then
        command -v apache2ctl >/dev/null 2>&1 && info "Apache : présent." || info "Apache : absent."
    else
        command -v nginx >/dev/null 2>&1 && info "nginx : présent." || info "nginx : absent."
    fi

    __config_db

    etape "Mise à jour APT" apt-get update || return 1
    local pkgs
    if [ "$TYPE" = "apache" ]; then
        pkgs=(apache2 php libapache2-mod-php php-mysql)
    else
        pkgs=(nginx php-fpm php-mysql)
    fi
    [ "$DB_LOCAL" -eq 1 ] && pkgs+=(mariadb-server)
    etape "Installation des paquets (${pkgs[*]})" apt-get install -y "${pkgs[@]}" || return 1

    # Base locale : on crée la base et l'utilisateur de démonstration.
    if [ "$DB_LOCAL" -eq 1 ]; then
        systemctl enable --now mariadb >> "$LOG" 2>&1
        mysql >> "$LOG" 2>&1 <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
SQL
        info "Base locale créée : $DB_NAME (utilisateur $DB_USER)."
    fi

    # Page de test PHP : elle affiche l'état du serveur ET teste la connexion à la base.
    mkdir -p /var/www/html
    cat > /var/www/html/index.php <<PHP
<?php
header('Content-Type: text/plain; charset=utf-8');
echo "Serveur web $TYPE + PHP : OK\n";
\$lien = @mysqli_connect('$DB_HOST', '$DB_USER', '$DB_PASS', '$DB_NAME');
echo \$lien ? "Connexion MariaDB ($DB_NAME sur $DB_HOST) : OK\n"
           : "Connexion MariaDB : KO -> " . mysqli_connect_error() . "\n";
PHP

    if [ "$TYPE" = "nginx" ]; then
        # vhost nginx qui passe le PHP à php-fpm.
        local SOCK; SOCK="$(ls /run/php/*-fpm.sock 2>/dev/null | head -1)"
        cat > /etc/nginx/sites-available/lab.conf <<NG
server {
    listen 80 default_server;
    root /var/www/html;
    index index.php index.html;
    server_name _;
    location / { try_files \$uri \$uri/ =404; }
    location ~ \.php\$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:$SOCK;
    }
}
NG
        rm -f /etc/nginx/sites-enabled/default
        ln -sf /etc/nginx/sites-available/lab.conf /etc/nginx/sites-enabled/lab.conf
        etape "Test de la configuration nginx (nginx -t)" nginx -t || return 1
        etape "Redémarrage de nginx et php-fpm" bash -c 'systemctl restart nginx && systemctl restart php*-fpm' || return 1
        SRV="nginx"
    else
        etape "Redémarrage d'Apache" systemctl restart apache2 || return 1
        SRV="apache2"
    fi
    systemctl enable "$SRV" >> "$LOG" 2>&1

    # GATES : le service tourne, et la page renvoie bien le résultat PHP attendu.
    gate "le service $SRV est actif" systemctl is-active --quiet "$SRV" || return 1
    sleep 1
    local sortie; sortie="$(curl -fsS http://127.0.0.1/ 2>> "$LOG")"
    if printf '%s' "$sortie" | grep -q "PHP : OK"; then
        ok "GATE OK — PHP est exécuté par $SRV"
        echo "$sortie" | sed 's/^/    /'
        info "À tester dans un navigateur : http://<IP_DE_LA_VM>/"
    else
        echouer "la page de test ne renvoie pas le résultat PHP attendu (PHP non exécuté ?)"
        return 1
    fi
}

# @id tssr.toolbox.web.apache
# @do installer_apache_php_mariadb
# @role orchestration
# @layer outil
# @human Serveur web Apache + MariaDB + PHP, avec page de test
seq_apache() { SEQ_COURANTE="Serveur web Apache"; titre "6) Serveur web Apache + MariaDB + PHP"; __install_web apache; }

# @id tssr.toolbox.web.nginx
# @do installer_nginx_php_mariadb
# @role orchestration
# @layer outil
# @human Serveur web nginx + MariaDB + PHP, avec page de test
seq_nginx()  { SEQ_COURANTE="Serveur web nginx";  titre "7) Serveur web nginx + MariaDB + PHP";  __install_web nginx;  }


# ─────────────────────────────────────────────────────────────────────────────
# @id tssr.toolbox.bastion
# @do deployer_un_bastion_apache_guacamole
# @role securite
# @layer outil
# @human Serveur bastion : déploiement d'Apache Guacamole (guacd + base + webapp) en conteneurs Docker
# ─────────────────────────────────────────────────────────────────────────────
seq_bastion() {
    SEQ_COURANTE="Bastion (Apache Guacamole)"
    titre "8) Serveur bastion — Apache Guacamole"
    besoin_root || return 1

    avert "Guacamole est déployé en conteneurs Docker (guacd + PostgreSQL + webapp)."
    confirmer "Installer Docker (si besoin) et déployer Guacamole ?" o || { info "Annulé, retour au menu."; return 0; }

    if ! command -v docker >/dev/null 2>&1; then
        if ! etape "Installation de Docker" apt-get install -y docker.io docker-compose-v2; then
            avert "docker-compose-v2 indisponible, tentative avec docker-compose…"
            etape "Installation de Docker (variante)" apt-get install -y docker.io docker-compose || return 1
        fi
    fi
    systemctl enable --now docker >> "$LOG" 2>&1

    local DIR="/opt/guacamole"; mkdir -p "$DIR"
    local PGPASS="Azerty77_pg"

    # Guacamole fournit lui-même le script qui génère le schéma SQL de sa base.
    etape "Génération du schéma SQL (image guacamole)" \
        bash -c "docker run --rm guacamole/guacamole /opt/guacamole/bin/initdb.sh --postgresql > '$DIR/initdb.sql'" || return 1

    # On décrit la pile en docker compose (3 services).
    cat > "$DIR/docker-compose.yml" <<YML
services:
  guacd:
    image: guacamole/guacd
    restart: unless-stopped
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: guacamole_db
      POSTGRES_USER: guacamole
      POSTGRES_PASSWORD: $PGPASS
    volumes:
      - ./initdb.sql:/docker-entrypoint-initdb.d/initdb.sql:ro
      - pg:/var/lib/postgresql/data
    restart: unless-stopped
  guacamole:
    image: guacamole/guacamole
    depends_on: [guacd, postgres]
    environment:
      GUACD_HOSTNAME: guacd
      POSTGRESQL_HOSTNAME: postgres
      POSTGRESQL_DATABASE: guacamole_db
      POSTGRESQL_USER: guacamole
      POSTGRESQL_PASSWORD: $PGPASS
    ports:
      - "8080:8080"
    restart: unless-stopped
volumes:
  pg:
YML

    # « docker compose » (plugin) ou « docker-compose » (ancien binaire).
    local DC="docker compose"; docker compose version >/dev/null 2>&1 || DC="docker-compose"
    etape "Démarrage des conteneurs Guacamole" bash -c "cd '$DIR' && $DC up -d" || return 1
    info "Les conteneurs démarrent (la webapp peut mettre 30 à 60 s à répondre)…"
    sleep 10

    # GATE : la webapp répond, sinon au moins les conteneurs tournent.
    if curl -fsS -o /dev/null http://127.0.0.1:8080/guacamole/ 2>> "$LOG"; then
        ok "GATE OK — Guacamole répond sur le port 8080"
    else
        avert "La webapp n'a pas encore répondu ; on vérifie que les conteneurs tournent."
        gate "les conteneurs Guacamole sont en cours d'exécution" bash -c "cd '$DIR' && $DC ps | grep -q -i up" || return 1
    fi
    info "Accès : http://<IP_DE_LA_VM>:8080/guacamole/"
    info "Identifiants par défaut : guacadmin / guacadmin  → À CHANGER immédiatement."
}


# ─────────────────────────────────────────────────────────────────────────────
# @id tssr.toolbox.glpi
# @do installer_et_preparer_glpi_sur_lamp
# @role orchestration
# @layer outil
# @human Serveur GLPI : pile LAMP + extensions PHP, base dédiée, téléchargement et dépôt de GLPI, puis contrôle
# ─────────────────────────────────────────────────────────────────────────────
seq_glpi() {
    SEQ_COURANTE="Serveur GLPI"
    titre "9) Serveur GLPI (LAMP + GLPI)"
    besoin_root || return 1

    local VER="10.0.16"
    confirmer "Installer LAMP puis GLPI $VER ?" o || { info "Annulé, retour au menu."; return 0; }

    etape "Mise à jour APT" apt-get update || return 1
    etape "Installation LAMP + extensions PHP requises par GLPI" \
        apt-get install -y apache2 mariadb-server php libapache2-mod-php \
            php-mysql php-xml php-curl php-gd php-intl php-mbstring php-bcmath php-zip php-ldap curl || return 1
    systemctl enable --now mariadb >> "$LOG" 2>&1

    # Base dédiée GLPI.
    local DBN="glpidb" DBU="glpiuser" DBP="Azerty77"
    mysql >> "$LOG" 2>&1 <<SQL
CREATE DATABASE IF NOT EXISTS $DBN CHARACTER SET utf8mb4;
CREATE USER IF NOT EXISTS '$DBU'@'localhost' IDENTIFIED BY '$DBP';
GRANT ALL PRIVILEGES ON $DBN.* TO '$DBU'@'localhost';
FLUSH PRIVILEGES;
SQL

    # Téléchargement + dépôt dans /var/www/html/glpi.
    local TGZ="/tmp/glpi-$VER.tgz"
    etape "Téléchargement de GLPI $VER" \
        curl -fSL -o "$TGZ" "https://github.com/glpi-project/glpi/releases/download/$VER/glpi-$VER.tgz" || return 1
    etape "Extraction dans /var/www/html" tar -xzf "$TGZ" -C /var/www/html || return 1
    chown -R www-data:www-data /var/www/html/glpi
    etape "Redémarrage d'Apache" systemctl restart apache2 || return 1
    systemctl enable apache2 >> "$LOG" 2>&1

    # GATE : la page d'installation de GLPI répond-elle ?
    sleep 1
    if curl -fsS -o /dev/null http://127.0.0.1/glpi/ 2>> "$LOG"; then
        ok "GATE OK — GLPI répond sur /glpi"
        info "Termine l'installation dans le navigateur : http://<IP_DE_LA_VM>/glpi/"
        info "Base : $DBN · utilisateur $DBU · mot de passe $DBP · serveur BDD : localhost"
    else
        echouer "GLPI ne répond pas sur http://127.0.0.1/glpi/ (Apache ? droits ? extensions PHP ?)"
        return 1
    fi
}


# ─────────────────────────────────────────────────────────────────────────────
# @id tssr.toolbox.sauvegarde
# @do sauvegarder_etc_et_home_dans_une_archive_horodatee
# @role donnee
# @layer outil
# @human Sauvegarde : compresser /etc et /home dans une archive .tar.gz horodatée sous /var/backups
# ─────────────────────────────────────────────────────────────────────────────
seq_backup() {
    SEQ_COURANTE="Sauvegarde /etc et /home"
    titre "10) Sauvegarde de /etc et /home"
    besoin_root || return 1

    local DEST="/var/backups"; mkdir -p "$DEST"
    local F="$DEST/backup_$(date +%Y-%m-%d).tar.gz"
    # Si une archive du jour existe déjà, on ajoute l'heure pour ne pas l'écraser.
    [ -e "$F" ] && F="$DEST/backup_$(date +%Y-%m-%d_%H%M%S).tar.gz"

    info "Archive cible : $F"
    confirmer "Lancer la sauvegarde de /etc et /home ?" o || { info "Annulé, retour au menu."; return 0; }

    # tar prévient « removing leading / » sur stderr : c'est NORMAL (va dans le log).
    etape "Compression de /etc et /home (tar.gz)" tar -czf "$F" /etc /home || return 1

    # GATE : l'archive existe, n'est pas vide, et sa table est lisible (donc intègre).
    if [ -s "$F" ] && tar -tzf "$F" >/dev/null 2>&1; then
        ok "GATE OK — archive valide : $F ($(du -h "$F" 2>/dev/null | cut -f1))"
    else
        echouer "l'archive est absente, vide ou corrompue"
        return 1
    fi
}


# ─────────────────────────────────────────────────────────────────────────────
# @id tssr.toolbox.zabbix
# @do brancher_la_vm_a_zabbix_via_l_agent_2
# @role orchestration
# @layer outil
# @human Brancher cette VM à Zabbix : installe l'agent 2, le pointe vers le serveur, rappelle l'ajout d'hôte + template
# ─────────────────────────────────────────────────────────────────────────────
seq_zabbix() {
    SEQ_COURANTE="Brancher à Zabbix"
    titre "11) Brancher cette VM à Zabbix (agent 2)"
    besoin_root || return 1

    local SRV HNAME
    demander "IP du serveur Zabbix" SRV
    echo "$SRV" | grep -qE '^([0-9]{1,3}\.){3}[0-9]{1,3}$' || { echouer "IP du serveur invalide : $SRV"; return 1; }
    demander "Nom d'hôte vu par Zabbix" HNAME "$(hostname)"

    # Dépôt Zabbix selon la version de Debian.
    local DEB ZVER=7.4; . /etc/os-release 2>/dev/null
    case "${VERSION_ID:-12}" in 13*) DEB=debian13 ;; 12*) DEB=debian12 ;; 11*) DEB=debian11 ;; *) DEB=debian12 ;; esac
    info "Dépôt Zabbix $ZVER pour $DEB"
    etape "Téléchargement du dépôt Zabbix" bash -c \
      "wget -q 'https://repo.zabbix.com/zabbix/${ZVER}/release/debian/pool/main/z/zabbix-release/zabbix-release_latest_${ZVER}+${DEB}_all.deb' -O /tmp/zabbix-release.deb" || return 1
    etape "Installation du dépôt" dpkg -i /tmp/zabbix-release.deb || return 1
    etape "Mise à jour APT" apt-get update || return 1
    etape "Installation de zabbix-agent2" apt-get install -y zabbix-agent2 || return 1

    # Configuration : vers quel serveur, et sous quel nom.
    local CFG=/etc/zabbix/zabbix_agent2.conf
    sed -i "s/^Server=.*/Server=$SRV/;s/^ServerActive=.*/ServerActive=$SRV:10051/;s/^Hostname=.*/Hostname=$HNAME/" "$CFG"
    grep -q "^Server=$SRV" "$CFG"            || echo "Server=$SRV" >> "$CFG"
    grep -q "^ServerActive=$SRV:10051" "$CFG" || echo "ServerActive=$SRV:10051" >> "$CFG"
    grep -q "^Hostname=$HNAME" "$CFG"         || echo "Hostname=$HNAME" >> "$CFG"
    command -v ufw >/dev/null 2>&1 && ufw allow 10050/tcp >> "$LOG" 2>&1

    etape "Activation de l'agent" systemctl enable --now zabbix-agent2 || return 1
    systemctl restart zabbix-agent2 >> "$LOG" 2>&1; sleep 1
    gate "l'agent zabbix-agent2 est actif" systemctl is-active --quiet zabbix-agent2 || return 1
    info "Côté serveur Zabbix : ajoute l'hôte « $HNAME » (interface agent $(hostname -I | awk '{print $1}'):10050)"
    info "puis applique le template « Linux by Zabbix agent »."
}


# ─────────────────────────────────────────────────────────────────────────────
# @id tssr.toolbox.modele
# @do preparer_un_modele_de_vm_pour_le_clonage
# @role config
# @layer outil
# @human Préparer un modèle : pose le service qui régénère clés SSH + machine-id au 1er boot de chaque clone, puis scelle
# ─────────────────────────────────────────────────────────────────────────────
seq_sceller() {
    SEQ_COURANTE="Sceller pour clonage"
    titre "12) Préparer un modèle (sceller pour clonage)"
    besoin_root || return 1
    info "Pose le service qui régénère l'identité SSH au 1er boot de CHAQUE clone"
    info "(déclencheur robuste : l'absence de clés d'hôte, pas ConditionFirstBoot)."

    cat > /usr/local/sbin/firstboot-ssh.sh <<'EOF'
#!/usr/bin/env bash
# Régénère les clés d'hôte SSH quand elles manquent (= clone fraîchement scellé).
set -uo pipefail
if ls /etc/ssh/ssh_host_*_key >/dev/null 2>&1; then exit 0; fi
logger -t firstboot-ssh "clone détecté (pas de clé d'hôte) -> régénération"
ssh-keygen -A
systemctl enable ssh >/dev/null 2>&1
systemctl restart ssh
EOF
    chmod +x /usr/local/sbin/firstboot-ssh.sh

    cat > /etc/systemd/system/firstboot-ssh.service <<'EOF'
[Unit]
Description=Régénère l'identité SSH si les clés manquent (après clonage)
Before=ssh.service
After=local-fs.target
[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/sbin/firstboot-ssh.sh
StandardOutput=journal+console
[Install]
WantedBy=multi-user.target
EOF

    cat > /usr/local/sbin/sceller-modele.sh <<'EOF'
#!/usr/bin/env bash
# Scelle la VM : supprime l'identité propre à cette machine, puis éteint.
set -e
echo "Scellage : suppression des clés d'hôte + machine-id, puis extinction."
rm -f /etc/ssh/ssh_host_*
truncate -s 0 /etc/machine-id
rm -f /var/lib/dbus/machine-id
rm -f /root/.bash_history /home/*/.bash_history 2>/dev/null || true
poweroff
EOF
    chmod +x /usr/local/sbin/sceller-modele.sh

    command -v sshd >/dev/null 2>&1 || apt-get install -y openssh-server >> "$LOG" 2>&1
    systemctl enable ssh >> "$LOG" 2>&1
    etape "Installation du service firstboot-ssh" bash -c "systemctl daemon-reload && systemctl enable firstboot-ssh.service" || return 1
    gate "le service firstboot-ssh est activé" systemctl is-enabled --quiet firstboot-ssh.service || return 1

    echo
    avert "SCELLER MAINTENANT supprime les clés + vide machine-id PUIS ÉTEINT la VM."
    avert "À ne faire QUE si cette VM est bien ton MODÈLE à cloner."
    if confirmer "Sceller et éteindre maintenant ?" n; then
        info "Scellage… la VM va s'éteindre, clone-la ensuite."
        /usr/local/sbin/sceller-modele.sh
    else
        ok "Service posé. Quand le modèle est prêt :  sudo /usr/local/sbin/sceller-modele.sh"
    fi
}


# ─────────────────────────────────────────────────────────────────────────────
# @id tssr.toolbox.parefeu
# @do poser_un_pare_feu_de_base_et_fail2ban
# @role securite
# @layer outil
# @human Pare-feu de base (nftables : seuls les ports choisis ouverts) + fail2ban contre le brute-force SSH
# ─────────────────────────────────────────────────────────────────────────────
seq_parefeu() {
    SEQ_COURANTE="Pare-feu + fail2ban"
    titre "13) Pare-feu de base + fail2ban"
    besoin_root || return 1

    if systemctl is-active --quiet fwknop-server 2>/dev/null; then
        avert "Le SPA (fwknop) gère déjà le 22. Une politique nftables globale peut entrer en conflit."
        confirmer "Continuer quand même ?" n || { info "Annulé, retour au menu."; return 0; }
    fi

    local SSHP PORTS
    SSHP="$(sshd -T 2>/dev/null | awk '/^port /{print $2; exit}')"; SSHP="${SSHP:-22}"
    demander "Ports TCP à laisser OUVERTS (séparés par un espace)" PORTS "$SSHP 80 443"
    # On force le port SSH dans la liste (anti-lockout).
    echo " $PORTS " | grep -q " $SSHP " || PORTS="$SSHP $PORTS"
    avert "Seuls ces ports resteront accessibles : $PORTS (tout le reste sera fermé)."
    confirmer "Appliquer cette politique nftables ?" n || { info "Annulé, retour au menu."; return 0; }

    etape "Installation (nftables, fail2ban)" apt-get install -y nftables fail2ban || return 1
    local SAVE=/etc/nftables.conf.bak-$(date +%Y%m%d-%H%M%S)
    [ -f /etc/nftables.conf ] && cp /etc/nftables.conf "$SAVE" && info "Sauvegarde : $SAVE"
    {
        echo '#!/usr/sbin/nft -f'
        echo 'flush ruleset'
        echo 'table inet filtre {'
        echo '  chain entree {'
        echo '    type filter hook input priority 0; policy drop;'
        echo '    ct state established,related accept'
        echo '    iif "lo" accept'
        echo '    ip protocol icmp icmp type echo-request limit rate 5/second accept'
        local p; for p in $PORTS; do echo "    tcp dport $p accept"; done
        echo '  }'
        echo '}'
    } > /etc/nftables.conf
    etape "Chargement des règles nftables" bash -c "nft -f /etc/nftables.conf" || { [ -f "$SAVE" ] && cp "$SAVE" /etc/nftables.conf; return 1; }
    etape "Activation de nftables au boot" systemctl enable --now nftables || return 1

    cat > /etc/fail2ban/jail.local <<EOF
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port    = $SSHP
EOF
    etape "Activation de fail2ban" systemctl enable --now fail2ban || return 1
    systemctl restart fail2ban >> "$LOG" 2>&1; sleep 1
    gate "nftables chargé et fail2ban actif" bash -c "nft list ruleset >/dev/null 2>&1 && systemctl is-active --quiet fail2ban" || return 1
    info "Ports ouverts : $PORTS · fail2ban surveille le SSH (port $SSHP)."
}


# ─────────────────────────────────────────────────────────────────────────────
# @id tssr.toolbox.audit
# @do produire_un_audit_securite_en_lecture_seule
# @role securite
# @layer outil
# @human Audit sécurité (lecture seule) : ports ouverts, conf SSH, comptes sudo, pare-feu, MAJ en attente -> rapport
# ─────────────────────────────────────────────────────────────────────────────
seq_audit() {
    SEQ_COURANTE="Audit sécu / rapport"
    titre "14) Audit sécurité (lecture seule) + rapport"
    [ "$(id -u)" -eq 0 ] || avert "Sans root, la lecture de /etc/shadow (mots de passe vides) sera ignorée."

    local F="/var/log/tssr-audit-$(date +%Y%m%d-%H%M%S).md"
    {
        echo "# Audit TSSR — $(hostname) — $(date '+%F %T')"
        echo; echo "## Système"; echo '```'
        echo "OS     : $(. /etc/os-release 2>/dev/null; echo "${PRETTY_NAME:-?}")"
        echo "Noyau  : $(uname -r)"
        echo "Uptime : $(uptime -p 2>/dev/null)"
        echo '```'
        echo "## Ports en écoute"; echo '```'; ss -tulnp 2>/dev/null; echo '```'
        echo "## Configuration SSH (effective)"; echo '```'
        sshd -T 2>/dev/null | grep -Ei '^(port|permitrootlogin|passwordauthentication|pubkeyauthentication|kbdinteractiveauthentication|permitemptypasswords|x11forwarding)' || echo "(sshd -T indisponible)"
        echo '```'
        echo "## Comptes à privilèges (groupe sudo)"; echo '```'; getent group sudo | awk -F: '{print $4}'; echo '```'
        echo "## Comptes à mot de passe VIDE (à corriger si présents)"; echo '```'
        awk -F: '($2==""){print $1}' /etc/shadow 2>/dev/null || echo "(lecture impossible — relance en root)"
        echo '```'
        echo "## Pare-feu & protections"; echo '```'
        systemctl is-active --quiet fwknop-server 2>/dev/null && echo "SPA fwknop : ACTIF (SSH furtif)"
        systemctl is-active --quiet fail2ban 2>/dev/null && echo "fail2ban   : ACTIF"
        command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | head -1
        command -v nft >/dev/null 2>&1 && { echo "-- nftables (extrait) --"; nft list ruleset 2>/dev/null | head -25; }
        echo '```'
        echo "## Mises à jour en attente"; echo '```'
        apt-get -s upgrade 2>/dev/null | awk '/^Inst /{c++} END{print (c+0)" paquet(s) à mettre à jour"}'
        echo '```'
        echo "## Derniers échecs de connexion"; echo '```'; (lastb -n 5 2>/dev/null || echo "(lastb indisponible)"); echo '```'
    } > "$F" 2>&1

    info "Rapport écrit : ${G}$F${R}"
    echo; sed -n '1,40p' "$F" | sed 's/^/    /'; echo
    ok "GATE OK — audit produit ($F)"
}


# ─────────────────────────────────────────────────────────────────────────────
# @id tssr.toolbox.provision
# @do provisionner_une_vm_en_une_passe_guidee
# @role orchestration
# @layer outil
# @human Provisionner une VM : enchaîne paquets -> IP -> durcissement SSH -> utilisateur -> supervision Zabbix
# ─────────────────────────────────────────────────────────────────────────────
seq_provision() {
    SEQ_COURANTE="Provisionner une VM"
    titre "P) Provisionner une VM (mise en service guidée)"
    besoin_root || return 1
    info "Enchaînement : paquets → (IP) → durcissement SSH → utilisateur → (Zabbix)."
    confirmer "Démarrer la mise en service ?" o || { info "Annulé, retour au menu."; return 0; }

    seq_paquets || { confirmer "Étape paquets en échec — continuer malgré tout ?" n || return 1; }
    if confirmer "Configurer une IP statique maintenant ?" n; then seq_config_ip || true; fi
    __ssh_hardening || true
    if confirmer "Créer un utilisateur maintenant ?" o; then seq_user || true; fi
    if confirmer "Brancher cette VM à Zabbix maintenant ?" n; then seq_zabbix || true; fi

    echo; ok "GATE OK — mise en service terminée (relis les gates de chaque étape)"
}


# ─────────────────────────────────────────────────────────────────────────────
# @id tssr.toolbox.hardening
# @do appliquer_une_baseline_de_durcissement_serveur
# @role securite
# @layer outil
# @human Durcissement serveur : mises à jour (+reboot ?), services inutiles, statut SELinux/AppArmor, moindre privilège
# ─────────────────────────────────────────────────────────────────────────────
seq_hardening() {
    SEQ_COURANTE="Durcissement serveur"
    titre "15) Durcissement serveur (baseline du guide)"
    besoin_root || return 1
    detect_distro
    info "Distribution : ${G}$FAMILLE${R} (paquets $PKG · groupe admin $GRP_ADMIN · pare-feu $FW · MAC $MAC)"

    # 1) Mises à jour système + besoin de redémarrage.
    if confirmer "Appliquer les mises à jour système maintenant ?" o; then
        etape "Mise à jour de l'index" pkg_update_index || true
        etape "Installation des mises à jour" pkg_upgrade || true
        if reboot_needed; then avert "Un REDÉMARRAGE est nécessaire (noyau / bibliothèques critiques)."
        else ok "Pas de redémarrage requis."; fi
    fi

    # 2) Services actifs (réduire la surface d'attaque).
    info "Services actuellement en cours d'exécution :"
    systemctl list-units --type=service --state=running 2>/dev/null | awk '/\.service/{print "     "$1}' | head -40
    if confirmer "Désactiver un service inutile maintenant ?" n; then
        local SVC; demander "Nom du service à désactiver (ex: avahi-daemon, cups)" SVC
        [ -n "$SVC" ] && etape "Désactivation de $SVC" systemctl disable --now "$SVC" || true
    fi

    # 3) MAC : SELinux (RHEL) ou AppArmor (Debian).
    if [ "$MAC" = selinux ]; then
        local ETAT; ETAT="$(getenforce 2>/dev/null)"
        info "SELinux : ${ETAT:-inconnu}"
        [ "$ETAT" != "Enforcing" ] && avert "Recommandé : SELinux en Enforcing (setenforce 1 + /etc/selinux/config)."
    else
        if command -v aa-status >/dev/null 2>&1 && aa-status --enabled 2>/dev/null; then ok "AppArmor activé."
        else avert "AppArmor non actif — à installer : apt install apparmor apparmor-utils."; fi
    fi

    # 4) Moindre privilège : qui est admin ?
    info "Membres du groupe $GRP_ADMIN : ${G}$(getent group "$GRP_ADMIN" | cut -d: -f4)${R}"
    avert "Chaque membre doit être justifié (principe du moindre privilège). Verrouille les comptes inutiles : usermod -L <user>."

    ok "GATE OK — baseline de durcissement passée en revue (applique les recommandations ci-dessus)"
    info "Pour un état chiffré, lance la ${G}check-list de conformité (17)${R}."
}


# ─────────────────────────────────────────────────────────────────────────────
# @id tssr.toolbox.motdepasse
# @do definir_une_politique_de_mots_de_passe
# @role securite
# @layer outil
# @human Politique de mots de passe : complexité via pam_pwquality (minlen 14, minclass 3) et login.defs (expiration)
# ─────────────────────────────────────────────────────────────────────────────
seq_password() {
    SEQ_COURANTE="Politique de mots de passe"
    titre "16) Politique de mots de passe"
    besoin_root || return 1
    detect_distro

    local PKGPW; [ "$PKG" = apt ] && PKGPW=libpam-pwquality || PKGPW=libpwquality
    etape "Installation de $PKGPW" pkg_install "$PKGPW" || true

    # Complexité (pam_pwquality).
    local CONF=/etc/security/pwquality.conf
    if [ -f "$CONF" ]; then
        cp "$CONF" "$CONF.bak-$(date +%Y%m%d-%H%M%S)"
        local kv key
        for kv in "minlen = 14" "minclass = 3" "maxrepeat = 3"; do
            key="${kv%% *}"
            if grep -qE "^\s*#?\s*$key\b" "$CONF"; then sed -i "s/^\s*#\?\s*$key\b.*/$kv/" "$CONF"; else echo "$kv" >> "$CONF"; fi
        done
        ok "pwquality.conf : minlen 14, minclass 3, maxrepeat 3"
    else
        avert "$CONF introuvable (pam_pwquality non installé ?)."
    fi

    # Expiration (login.defs) pour les nouveaux comptes.
    local LD=/etc/login.defs
    if [ -f "$LD" ]; then
        cp "$LD" "$LD.bak-$(date +%Y%m%d-%H%M%S)"
        _defs() { local k="$1" v="$2"; if grep -qE "^\s*#?\s*$k\b" "$LD"; then sed -i "s/^\s*#\?\s*$k\b.*/$k\t$v/" "$LD"; else printf '%s\t%s\n' "$k" "$v" >> "$LD"; fi; }
        _defs PASS_MAX_DAYS 90
        _defs PASS_MIN_DAYS 1
        _defs PASS_WARN_AGE 7
        ok "login.defs : PASS_MAX_DAYS 90, PASS_MIN_DAYS 1, PASS_WARN_AGE 7 (nouveaux comptes)"
    fi

    avert "Les règles de complexité s'appliquent aux PROCHAINS changements de mot de passe."
    gate "pwquality.conf présent" bash -c "[ -f /etc/security/pwquality.conf ]" || return 1
}


# Prédicats de conformité (renvoient 0 = conforme) — utilisés par la check-list.
_p_maj()     { [ "$(pkg_upgradable)" = "0" ]; }
_p_rootno()  { sshd -T 2>/dev/null | grep -qi '^permitrootlogin no'; }
_p_pwno()    { sshd -T 2>/dev/null | grep -qi '^passwordauthentication no'; }
_p_maxauth() { local v; v="$(sshd -T 2>/dev/null | awk '/^maxauthtries/{print $2}')"; [ -n "$v" ] && [ "$v" -le 3 ]; }
_p_idle()    { sshd -T 2>/dev/null | awk '/^clientaliveinterval/{print $2}' | grep -qE '^[1-9]'; }
_p_allow()   { sshd -T 2>/dev/null | grep -qiE '^allow(users|groups) '; }
_p_fw()      { systemctl is-active --quiet firewalld || systemctl is-active --quiet nftables || ufw status 2>/dev/null | grep -qi active; }
_p_f2b()     { systemctl is-active --quiet fail2ban; }
_p_mac()     { if [ "$MAC" = selinux ]; then [ "$(getenforce 2>/dev/null)" = Enforcing ]; else aa-status --enabled 2>/dev/null; fi; }
_p_pwq()     { grep -qE '^\s*minlen\s*=\s*(1[4-9]|[2-9][0-9])' /etc/security/pwquality.conf 2>/dev/null; }
_p_noempty() { ! awk -F: '($2==""){f=1} END{exit !f}' /etc/shadow 2>/dev/null; }
_p_backup()  { ls /var/backups/*.tar.gz >/dev/null 2>&1; }

# ─────────────────────────────────────────────────────────────────────────────
# @id tssr.toolbox.checklist
# @do produire_une_check_list_de_conformite_au_durcissement
# @role gate
# @layer outil
# @human Check-list de conformité : coche les points du guide (maj, SSH, pare-feu, MAC, mots de passe…) dans un rapport
# ─────────────────────────────────────────────────────────────────────────────
seq_checklist() {
    SEQ_COURANTE="Check-list de conformité"
    titre "17) Check-list de conformité (durcissement)"
    [ "$(id -u)" -eq 0 ] || avert "Sans root, certains contrôles (/etc/shadow) seront faussés."
    detect_distro
    local F="/var/log/tssr-conformite-$(date +%Y%m%d-%H%M%S).md"
    local ok_n=0 ko_n=0
    { echo "# Check-list de conformité — $(hostname) — $(date '+%F %T')"
      echo; echo "- Distribution : $FAMILLE ($PKG)"; echo; } > "$F"
    # chk "libellé" predicat...
    chk() { if "$@" >/dev/null 2>&1; then echo "  ${VERT}✔${R} $1"; echo "- [x] $1" >> "$F"; ok_n=$((ok_n+1));
            else echo "  ${ROUGE}✘${R} $1"; echo "- [ ] $1" >> "$F"; ko_n=$((ko_n+1)); fi; }

    chk "Système à jour (0 paquet en attente)"           _p_maj
    chk "Connexion root SSH interdite"                    _p_rootno
    chk "Mot de passe SSH désactivé (clés uniquement)"    _p_pwno
    chk "SSH : MaxAuthTries ≤ 3"                          _p_maxauth
    chk "SSH : timeout d'inactivité configuré"           _p_idle
    chk "SSH : utilisateurs restreints (AllowUsers/Groups)" _p_allow
    chk "Pare-feu actif"                                  _p_fw
    chk "fail2ban actif"                                  _p_f2b
    chk "MAC actif (SELinux Enforcing / AppArmor)"        _p_mac
    chk "Politique de mots de passe (minlen ≥ 14)"       _p_pwq
    chk "Aucun compte à mot de passe vide"                _p_noempty
    chk "Sauvegarde présente (/var/backups)"              _p_backup

    { echo; echo "## Score : $ok_n / $((ok_n+ko_n)) conformes"; } >> "$F"
    echo
    ok "GATE OK — check-list produite : ${G}$ok_n/$((ok_n+ko_n))${R} conformes → $F"
    [ "$ko_n" -gt 0 ] && avert "$ko_n point(s) à corriger (détail dans le rapport)."
}


# ─────────────────────────────────────────────────────────────────────────────
# @id tssr.toolbox.flux
# @do orchestrer_le_menu_le_retour_et_la_sortie
# @role orchestration
# @layer outil
# @human Le fil conducteur : le menu principal, la question « menu ou quitter » après chaque séquence, et la sortie propre
# ─────────────────────────────────────────────────────────────────────────────

# Après chaque séquence : Entrée = menu (défaut), Q = quitter.
demander_suite() {
    echo
    local ans
    read -rp "  ${GRAS}Entrée${RAZ} = revenir au menu principal · ${GRAS}Q${RAZ} = quitter : " ans
    case "${ans,,}" in
        q|quit|quitter) quitter ;;
        *) return 0 ;;
    esac
}

quitter() {
    echo
    info "Fermeture de la boîte à outils. Journal de cette session : $LOG"
    journal "=== Fin de session ==="
    exit 0
}

menu() {
    while true; do
        clear 2>/dev/null
        echo "${GRAS}${CYAN}  ╔══════════════════════════════════════════════════╗${RAZ}"
        echo "${GRAS}${CYAN}  ║          BOÎTE À OUTILS TSSR — Debian 13           ║${RAZ}"
        echo "${GRAS}${CYAN}  ╚══════════════════════════════════════════════════╝${RAZ}"
        echo "   Journal de session : $LOG"
        echo
        echo "   ${G}Diagnostic & système${R}"
        echo "    ${GRAS}1${RAZ}) Statut & tests rapides      ${GRAS}2${RAZ}) Paquets de base      ${GRAS}3${RAZ}) Config IP (statique)"
        echo
        echo "   ${G}Sécurité${R}"
        echo "    ${GRAS}4${RAZ}) SSH — durcissement & SPA furtif    ${GRAS}13${RAZ}) Pare-feu + fail2ban    ${GRAS}14${RAZ}) Audit sécurité"
        echo "   ${GRAS}15${RAZ}) Durcissement serveur   ${GRAS}16${RAZ}) Politique mots de passe   ${GRAS}17${RAZ}) Check-list conformité"
        echo
        echo "   ${G}Comptes & services${R}"
        echo "    ${GRAS}5${RAZ}) Créer un utilisateur   ${GRAS}6${RAZ}) Web Apache   ${GRAS}7${RAZ}) Web nginx   ${GRAS}8${RAZ}) Bastion   ${GRAS}9${RAZ}) GLPI"
        echo
        echo "   ${G}Supervision & cycle de vie${R}"
        echo "   ${GRAS}11${RAZ}) Brancher à Zabbix   ${GRAS}12${RAZ}) Sceller pour clonage   ${GRAS}10${RAZ}) Sauvegarde /etc + /home"
        echo
        echo "   ${G}Spécial${R}"
        echo "    ${GRAS}P${RAZ}) Provisionner une VM (mise en service guidée)      ${GRAS}0${RAZ}) Quitter"
        echo
        local choix; read -rp "  Ton choix : " choix
        case "${choix,,}" in
            1)  seq_statut    ;;
            2)  seq_paquets   ;;
            3)  seq_config_ip ;;
            4)  seq_ssh       ;;
            5)  seq_user      ;;
            6)  seq_apache    ;;
            7)  seq_nginx     ;;
            8)  seq_bastion   ;;
            9)  seq_glpi      ;;
            10) seq_backup    ;;
            11) seq_zabbix    ;;
            12) seq_sceller   ;;
            13) seq_parefeu   ;;
            14) seq_audit     ;;
            15) seq_hardening ;;
            16) seq_password  ;;
            17) seq_checklist ;;
            p)  seq_provision ;;
            0|q|quitter) quitter ;;
            *) avert "Choix invalide : $choix"; sleep 1; continue ;;
        esac
        # Qu'il y ait eu succès OU échec, la séquence est revenue ici :
        # on propose de revenir au menu (défaut) ou de quitter.
        demander_suite
    done
}


# ─────────────────────────────────────────────────────────────────────────────
# @id tssr.toolbox.main
# @do demarrer_la_boite_a_outils
# @role orchestration
# @layer outil
# @human Point d'entrée : prépare le journal, souhaite la bienvenue, puis lance le menu
# ─────────────────────────────────────────────────────────────────────────────
# TSSR_TOOLBOX_LIB=1 permet de « sourcer » le script sans lancer le menu
# (pour les tests / smoke-test, et la réutilisation des fonctions en Ansible).
if [ "${TSSR_TOOLBOX_LIB:-0}" != "1" ]; then
    log_init
    detect_distro
    titre "Bienvenue dans la boîte à outils TSSR"
    echo "  Debian 13 • scripts pédagogiques • chaque action est journalisée."
    echo "  Journal de cette session : $LOG"
    if [ "$(id -u)" -ne 0 ]; then
        avert "Tu n'es pas root : les séquences d'installation refuseront de démarrer."
        avert "Relance en root pour tout débloquer :  sudo $0"
    fi
    pause
    menu
fi

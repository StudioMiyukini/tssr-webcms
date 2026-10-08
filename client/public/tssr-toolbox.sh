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

    # Ouverture du port dans le pare-feu si ufw est là.
    if command -v ufw >/dev/null 2>&1; then
        ufw allow "$PORT"/tcp >> "$LOG" 2>&1 && info "Pare-feu : $PORT/tcp autorisé (ufw)"
    fi

    etape "Redémarrage de SSH" systemctl restart ssh || return 1
    sleep 1

    # GATE : SSH écoute-t-il bien sur le nouveau port ?
    if ss -tlnp 2>/dev/null | grep -q ":$PORT "; then
        ok "GATE OK — SSH écoute sur le port $PORT et root est interdit"
    else
        echouer "SSH n'écoute pas sur le port $PORT (restaure avec : cp $SAVE $CFG)"
        return 1
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
        echo "   ${GRAS}1${RAZ}) Statut & tests rapides (réseau, disque, RAM)"
        echo "   ${GRAS}2${RAZ}) Installer les paquets de base"
        echo "   ${GRAS}3${RAZ}) Configurer l'IP (statique)"
        echo "   ${GRAS}4${RAZ}) SSH — durcissement (port + root) & SPA furtif"
        echo "   ${GRAS}5${RAZ}) Créer un utilisateur"
        echo "   ${GRAS}6${RAZ}) Serveur web Apache + MariaDB + PHP"
        echo "   ${GRAS}7${RAZ}) Serveur web nginx + MariaDB + PHP"
        echo "   ${GRAS}8${RAZ}) Serveur bastion (Guacamole)"
        echo "   ${GRAS}9${RAZ}) Serveur GLPI"
        echo "  ${GRAS}10${RAZ}) Sauvegarde de /etc et /home"
        echo "   ${GRAS}0${RAZ}) Quitter"
        echo
        local choix; read -rp "  Ton choix : " choix
        case "$choix" in
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
            0|q|Q) quitter    ;;
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
log_init
titre "Bienvenue dans la boîte à outils TSSR"
echo "  Debian 13 • scripts pédagogiques • chaque action est journalisée."
echo "  Journal de cette session : $LOG"
if [ "$(id -u)" -ne 0 ]; then
    avert "Tu n'es pas root : les séquences d'installation refuseront de démarrer."
    avert "Relance en root pour tout débloquer :  sudo $0"
fi
pause
menu

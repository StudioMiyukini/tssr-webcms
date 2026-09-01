// Notions : installer et sécuriser SSH sous Linux (OpenSSH sur Debian) — données.
//
// Le fil est celui d'une vraie mise en service : installer le serveur, vérifier
// qu'il écoute, se connecter une première fois par mot de passe, puis passer à
// la clé et couper le mot de passe — dans cet ordre, parce qu'on ne durcit un
// accès qu'une fois sûr d'y entrer autrement.
//
// L'exemple est cohérent avec le reste de l'atelier : un serveur `srv-debian`
// en 192.168.10.20, un administrateur `tssr`, un poste client sous Windows ou
// Linux. Un piège revient à chaque étape sensible — celui qui coupe la session
// et fait perdre une heure.

/*
 * @id     tssr.atelier.sshLinuxData
 * @do     definir_donnees_ssh_linux
 * @role   donnee
 * @layer  outil
 * @human  Données de l'atelier : installer et sécuriser SSH sous Linux (OpenSSH sur Debian).
 */

/** L'exemple servant de fil rouge — repris tel quel dans les commandes. */
export const SSH_EXEMPLE = {
  serveurNom: 'srv-debian',
  serveurIp: '192.168.10.20',
  admin: 'tssr',
  port: 22,
};

export interface Etape {
  /** Le titre de l'étape, à l'impératif. */
  titre: string;
  /** Ce qu'elle accomplit, en une phrase. */
  but: string;
  /** Les commandes, prêtes à copier. */
  commandes: string;
  /** Le détail : pourquoi, et ce qu'on observe. */
  details: string[];
  /** L'erreur qui coûte une heure, quand il y en a une. */
  piege?: string;
  /** Cette étape demande-t-elle les droits root ? */
  root?: boolean;
}

/**
 * Les étapes de la mise en service, dans l'ordre où on les fait.
 *
 * L'ordre est le message : on installe, on vérifie l'écoute, on se connecte,
 * puis seulement on durcit. Ouvrir le pare-feu et couper le mot de passe passent
 * après avoir prouvé qu'on entre — jamais avant.
 */
export const SSH_ETAPES: Etape[] = [
  {
    titre: '1 — Installer le serveur OpenSSH',
    but: 'Poser le démon qui écoutera les connexions entrantes.',
    root: true,
    commandes: [
      'apt update',
      'apt install openssh-server',
    ].join('\n'),
    details: [
      'Le paquet **openssh-server** apporte le démon `sshd`. Le client `ssh` (paquet openssh-client) est déjà là sur presque toutes les distributions.',
      'À la fin de l’installation, le service est **démarré et activé** au boot tout seul : sur un serveur fraîchement installé, SSH marche souvent déjà.',
    ],
  },
  {
    titre: '2 — Vérifier que le service tourne et écoute',
    but: 'S’assurer que sshd est actif et à l’écoute sur le port 22.',
    root: true,
    commandes: [
      'systemctl status ssh',
      'systemctl enable --now ssh   # activer + démarrer si besoin',
      'ss -tlnp | grep :22           # il écoute bien sur le 22 ?',
    ].join('\n'),
    details: [
      'Sur Debian/Ubuntu, le service se nomme **ssh** ; sur Red Hat/Fedora, **sshd**. La commande diffère selon la famille.',
      '`ss -tlnp` (successeur de netstat) montre qui écoute : une ligne `LISTEN … :22` confirme que sshd attend les connexions.',
    ],
    piege: 'Si `status` dit « inactive », c’est le service, pas le réseau : `systemctl enable --now ssh` le lance et le rend permanent.',
  },
  {
    titre: '3 — Se connecter depuis un client',
    but: 'Prouver l’accès par mot de passe avant de toucher à quoi que ce soit.',
    commandes: [
      '# Depuis Linux ou Windows (PowerShell) :',
      'ssh tssr@192.168.10.20',
      '',
      '# Sur un port non standard :',
      'ssh -p 2222 tssr@192.168.10.20',
    ].join('\n'),
    details: [
      'Le client SSH est natif sous Windows 10/11 (PowerShell) comme sous Linux : la même commande des deux côtés.',
      'À la première connexion, l’empreinte du serveur est présentée : on tape « yes », elle est mémorisée dans ~/.ssh/known_hosts. Un avertissement plus tard = l’empreinte a changé, à ne pas ignorer.',
    ],
    piege: 'Un refus « Connection refused » = personne n’écoute (service arrêté ou pare-feu). Un « timeout » = la route ou le pare-feu bloquent avant d’arriver.',
  },
  {
    titre: '4 — Passer à l’authentification par clé',
    but: 'Remplacer le mot de passe par une paire de clés — plus sûr et sans ressaisie.',
    commandes: [
      '# Sur le CLIENT : générer la paire (laisser le chemin par défaut)',
      'ssh-keygen -t ed25519 -C "tssr@poste"',
      '',
      '# Déposer la clé publique sur le serveur',
      'ssh-copy-id tssr@192.168.10.20',
      '',
      '# Se reconnecter : plus de mot de passe demandé',
      'ssh tssr@192.168.10.20',
    ].join('\n'),
    details: [
      '`ssh-keygen` crée deux fichiers dans ~/.ssh : la clé **privée** (`id_ed25519`, à ne jamais partager) et la clé **publique** (`id_ed25519.pub`, faite pour être copiée).',
      '`ssh-copy-id` ajoute la clé publique dans `~/.ssh/authorized_keys` du serveur, avec les bons droits (700 sur ~/.ssh, 600 sur le fichier) — la source d’erreur numéro un quand on le fait à la main.',
      'ed25519 est plus court et plus robuste que RSA ; à défaut, `rsa -b 4096` reste accepté partout.',
    ],
    piege: 'Des droits trop ouverts sur ~/.ssh ou authorized_keys et sshd **ignore** la clé sans le dire. Le journal (`journalctl -u ssh`) le signale, la connexion non.',
  },
  {
    titre: '5 — Durcir la configuration du serveur',
    but: 'Interdire le mot de passe et la connexion root une fois la clé en place.',
    root: true,
    commandes: [
      'nano /etc/ssh/sshd_config       # voir le fichier d’exemple ci-dessous',
      'sshd -t                          # valider la syntaxe AVANT de recharger',
      'systemctl restart ssh',
    ].join('\n'),
    details: [
      'Le fichier maître est **/etc/ssh/sshd_config** (celui du serveur ; ne pas le confondre avec ssh_config, qui règle le client).',
      '`sshd -t` teste la syntaxe : une faute empêche sshd de redémarrer, et l’on se retrouve sans accès distant.',
      'Ne couper `PasswordAuthentication` qu’**après** avoir vérifié que la connexion par clé fonctionne — sinon on se ferme dehors.',
    ],
    piege: 'Garder une session SSH ouverte pendant qu’on teste la nouvelle config dans une seconde : si l’on s’est verrouillé, la première session reste là pour corriger.',
  },
  {
    titre: '6 — Ouvrir le pare-feu',
    but: 'Autoriser SSH avant d’activer le pare-feu, jamais l’inverse.',
    root: true,
    commandes: [
      'ufw allow OpenSSH      # ou : ufw allow 22/tcp',
      'ufw enable',
      'ufw status',
    ].join('\n'),
    details: [
      'ufw connaît le profil applicatif « OpenSSH » (port 22). Sur un port personnalisé, autoriser le numéro : `ufw allow 2222/tcp`.',
      '`ufw status` liste les règles actives — la vérification qui évite de découvrir le blocage à la prochaine connexion.',
    ],
    piege: 'Activer ufw AVANT d’autoriser SSH coupe la session en cours, et la commande d’autorisation suivante n’arrive jamais. L’ordre n’est pas un détail.',
  },
];

export interface OptionSshd {
  cle: string;
  valeur: string;
  role: string;
}

/** Les directives de sshd_config qui comptent, avec la valeur durcie conseillée. */
export const SSH_OPTIONS: OptionSshd[] = [
  { cle: 'Port', valeur: '22', role: 'Le port d’écoute. Le changer (ex. 2222) réduit le bruit des scans, sans être une sécurité en soi.' },
  { cle: 'PermitRootLogin', valeur: 'no', role: 'Interdit la connexion directe en root : on entre avec son compte, puis `sudo`. On sait ainsi qui a fait quoi.' },
  { cle: 'PasswordAuthentication', valeur: 'no', role: 'Coupe le mot de passe une fois la clé en place — supprime les attaques par force brute.' },
  { cle: 'PubkeyAuthentication', valeur: 'yes', role: 'Autorise l’authentification par clé (le défaut).' },
  { cle: 'PermitEmptyPasswords', valeur: 'no', role: 'Refuse les comptes sans mot de passe — jamais d’exception.' },
  { cle: 'AllowUsers', valeur: 'tssr', role: 'Restreint qui peut se connecter : une liste blanche de comptes, plutôt que tous.' },
  { cle: 'MaxAuthTries', valeur: '3', role: 'Nombre d’essais avant de fermer la connexion. Freine les tentatives.' },
  { cle: 'ClientAliveInterval', valeur: '300', role: 'Ferme les sessions inactives (ici après 5 min sans activité).' },
];

/** Un sshd_config durci, cohérent avec l'exemple — copiable et valide. */
export const SSH_SSHD_CONFIG = [
  '# /etc/ssh/sshd_config — extrait durci',
  '# Valider avec « sshd -t » avant « systemctl restart ssh »',
  '',
  'Port 22',
  'PermitRootLogin no',
  'PubkeyAuthentication yes',
  'PasswordAuthentication no      # seulement APRÈS avoir testé la clé',
  'PermitEmptyPasswords no',
  'AllowUsers tssr',
  'MaxAuthTries 3',
  'ClientAliveInterval 300',
  'ClientAliveCountMax 2',
  'X11Forwarding no',
].join('\n');

/** Le test depuis un poste client, des deux côtés. */
export const SSH_TEST_CLIENT = [
  ':: Windows (PowerShell — client SSH natif)',
  'ssh tssr@192.168.10.20',
  'ssh -p 2222 tssr@192.168.10.20',
  '',
  '# Linux',
  'ssh tssr@192.168.10.20',
  'ssh -v tssr@192.168.10.20     # mode bavard : lire pourquoi ça échoue',
].join('\n');

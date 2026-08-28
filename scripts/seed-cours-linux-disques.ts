/* Cours « Linux : disques, partitions & LVM ».
   Reprend le plan de la fiche existante et le porte au niveau des autres cours :
   pourquoi les UUID, ce que nofail évite, et comment LVM agrandit à chaud.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-linux-disques.ts */
import { block, note, sh, flow, table, styleLinux, liens, publier } from './_cours-linux';
import type { PageBlock } from '../client/src/lib/page-blocks';

const PAGE = {
  slug: 'linux-disques',
  title: 'Linux : disques, partitions et LVM',
  excerpt: 'Lister l’espace et comprendre pourquoi df et du ne disent pas la même chose, partitionner en GPT, formater, monter, écrire un /etc/fstab qui ne bloque pas le démarrage — et LVM : agrandir un système de fichiers à chaud, sans arrêter le serveur ni tout redécouper.',
};

const blocks: PageBlock[] = [
  block('hero', {
    eyebrow: 'Cours · Linux',
    title: PAGE.title,
    subtitle: 'Ajouter de l’espace à un serveur en production, sans l’arrêter et sans se tromper de ligne dans fstab.',
  }),
  styleLinux,

  block('html', { html: '<p>Sous Windows, un disque devient <code>D:</code>. Sous Linux, il devient un <strong>dossier</strong> : on le <em>monte</em> quelque part dans l’arborescence, et son contenu apparaît à cet endroit. Toute la gestion du stockage découle de cette différence.</p>' }),

  block('heading', { level: 2, text: '0) Les quatre étages' }),
  block('html', { html: '<p>Sous Linux, un disque n’est pas un dossier. Entre le matériel et le premier fichier qu’on y écrit, il y a <strong>quatre étages</strong>, et chacun se fabrique avec une commande différente. Sauter l’un d’eux est la cause de la moitié des blocages.</p>' }),
  flow(`DISQUE              /dev/sdb        le peripherique, physique ou virtuel
   |                                 -> fdisk / parted
PARTITION           /dev/sdb1       une PART du disque
   |                                 -> mkfs.ext4
SYSTEME DE FICHIERS ext4            la structure qui range les fichiers
   |                                 -> mount
POINT DE MONTAGE    /data           l'endroit de l'arborescence ou il apparait`),
  table(['Question qui revient', 'La réponse'], [
    ['<code>/dev/sdb</code> ou <code>/dev/sdb1</code> ?', '<code>sdb</code> est <strong>le disque entier</strong>, <code>sdb1</code> sa <strong>première partition</strong>. On partitionne <code>sdb</code>, on formate et on monte <code>sdb1</code>.'],
    ['Partition ou système de fichiers ?', 'La partition est une <strong>portion d’espace réservée</strong> ; le système de fichiers est <strong>l’organisation écrite dedans</strong>. Une partition sans système de fichiers est un espace inutilisable.'],
    ['À quoi sert le point de montage ?', 'Linux n’a <strong>pas de lettres de lecteur</strong> : un volume n’existe que greffé quelque part dans l’arbre unique.'],
    ['<code>df</code> ou <code>du</code> ?', '<code>df</code> répond « <em>combien reste-t-il ?</em> » — par système de fichiers. <code>du</code> répond « <em>qui occupe la place ?</em> » — par dossier.'],
  ]),
  note('red', '🚫 Vérifier le nom du disque AVANT chaque commande', '<p><code>fdisk</code> et <code>mkfs</code> sur le mauvais disque détruisent son contenu <strong>sans confirmation utile</strong>. Les noms <code>sdX</code> dépendent de l’ordre de détection : ils changent quand on ajoute ou retire un disque.</p><p><strong>Un <code>lsblk</code> juste avant, à chaque fois.</strong> Repérer la taille et l’absence de point de montage — le disque neuf est celui qui n’a ni partition ni montage.</p>'),

  block('heading', { level: 2, text: '1) Voir ce qu’on a' }),
  sh(`lsblk                    # l'arborescence disques -> partitions -> montages
lsblk -f                 # avec le systeme de fichiers et l'UUID
df -h                    # espace libre PAR SYSTEME DE FICHIERS MONTE
df -i                    # les inodes : l'autre facon d'etre plein
du -sh /var/*            # ce qui occupe la place, dossier par dossier
sudo fdisk -l            # la table de partitions vue du disque`),
  flow(`$ lsblk
NAME        MAJ:MIN RM  SIZE RO TYPE MOUNTPOINTS
sda           8:0     0  50G  0 disk
├─sda1        8:1     0   1G  0 part /boot
└─sda2        8:2     0  49G  0 part
  └─vg0-root 254:0    0  30G  0 lvm  /
sdb           8:16    0 100G  0 disk        <- le disque neuf, vierge`),
  note('yellow', '⚠️ « Le disque est plein » alors que <code>df</code> montre de la place', '<p>Deux causes, et aucune n’est la taille. <strong>Les inodes</strong> : des millions de petits fichiers épuisent la table avant l’espace — <code>df -i</code> le montre. <strong>Un fichier supprimé mais encore ouvert</strong> par un processus : l’espace n’est rendu qu’à la fermeture. <code>sudo lsof +L1</code> le révèle, et redémarrer le service concerné libère la place.</p>'),
  note('blue', '💡 <code>df</code> et <code>du</code> divergent, c’est normal', '<p><code>df</code> interroge le système de fichiers, <code>du</code> additionne ce qu’il parcourt. Un dossier monté par-dessus un autre cache le contenu du dessous : <code>du</code> ne le voit plus, <code>df</code> compte toujours sa place. C’est la façon classique de « perdre » 20 Go.</p>'),

  block('heading', { level: 2, text: '2) Partitionner' }),
  sh(`sudo fdisk /dev/sdb        # interactif : g (GPT), n (nouvelle), w (ecrire)
# ou, non interactif :
sudo parted /dev/sdb --script mklabel gpt mkpart primaire ext4 0% 100%
lsblk /dev/sdb`),
  table(['Table', 'Limites', 'Quand'], [
    ['<strong>MBR</strong> (<code>msdos</code>)', '2 To maximum, 4 partitions primaires.', 'Vieilles machines, démarrage BIOS hérité.'],
    ['<strong>GPT</strong>', 'Pas de limite pratique, 128 partitions.', '<strong>Le choix par défaut</strong> aujourd’hui, obligatoire en UEFI.'],
  ]),
  note('red', '🚫 Vérifie le nom du disque avant d’écrire', '<p><code>fdisk /dev/sda</code> au lieu de <code>/dev/sdb</code> détruit la table de partitions du système en cours d’exécution. <code>lsblk</code> d’abord, et on repère le disque à sa <strong>taille</strong> et à l’absence de point de montage, jamais à sa lettre supposée — l’ordre d’énumération peut changer d’un démarrage à l’autre.</p>'),

  block('heading', { level: 2, text: '3) Formater et monter' }),
  sh(`sudo mkfs.ext4 -L donnees /dev/sdb1     # -L pose une etiquette
sudo mkdir -p /srv/donnees
sudo mount /dev/sdb1 /srv/donnees
df -h /srv/donnees                      # verifier avant d'aller plus loin`),
  table(['Système', 'Usage'], [
    ['<strong>ext4</strong>', 'Le défaut de Debian. Robuste, bien connu, se répare bien. C’est le bon choix par défaut.'],
    ['<strong>xfs</strong>', 'Grands volumes, gros fichiers. S’agrandit à chaud, mais <strong>ne se réduit pas</strong>.'],
    ['<strong>vfat</strong> / <strong>exfat</strong>', 'Clés USB, partition EFI. Pas de droits Unix — donc jamais pour des données serveur.'],
  ]),
  note('yellow', '⚠️ Monter sur un dossier non vide', '<p>Le contenu d’origine n’est pas effacé : il est <strong>masqué</strong> tant que le montage tient, et réapparaît au démontage. Un <code>mount</code> sur <code>/var</code> déjà rempli fait donc « disparaître » les données — elles sont là, en dessous.</p>'),

  block('heading', { level: 2, text: '4) /etc/fstab : le montage qui survit au redémarrage' }),
  block('html', { html: '<p>Un <code>mount</code> à la main ne survit pas au redémarrage. <code>/etc/fstab</code> décrit ce qui doit être monté au démarrage — et une erreur ici empêche la machine de démarrer.</p>' }),
  sh(`sudo blkid /dev/sdb1      # recuperer l'UUID
# /dev/sdb1: LABEL="donnees" UUID="3f2a...-91c4" TYPE="ext4"`),
  flow(`# /etc/fstab
# <peripherique>            <point de montage> <type> <options>        <dump> <passe>
UUID=3f2a...-91c4           /srv/donnees       ext4   defaults,nofail  0      2
LABEL=sauvegardes           /srv/backup        ext4   defaults,nofail  0      2
//srv-win/partage           /mnt/win           cifs   credentials=/etc/cifs.cred,nofail 0 0

# passe : 0 = pas de verification, 1 = la racine, 2 = les autres`),
  note('red', '🚫 Pourquoi l’UUID et pas <code>/dev/sdb1</code>', '<p>Les noms <code>sdX</code> sont attribués dans l’ordre de détection. Ajoute un disque, change un contrôleur, déplace la VM : <code>sdb</code> devient <code>sdc</code>, et <code>fstab</code> monte le mauvais volume — ou n’en monte aucun et bloque le démarrage. <strong>L’UUID appartient au système de fichiers</strong> et le suit partout.</p>'),
  note('green', '🎯 <code>nofail</code> : la ligne qui évite l’appel de nuit', '<p>Sans elle, un volume absent au démarrage (disque retiré, serveur CIFS éteint) fait <strong>échouer le boot</strong> : la machine attend, puis tombe en mode secours, sur une console à laquelle personne n’a accès à distance. <code>nofail</code> la laisse démarrer sans ce montage. On y ajoute souvent <code>x-systemd.device-timeout=10</code> pour ne pas attendre 90 secondes.</p>'),
  sh(`sudo mount -a           # TESTE fstab sans redemarrer : a faire SYSTEMATIQUEMENT
findmnt --verify        # verifie la syntaxe et signale les incoherences
systemctl daemon-reload # systemd relit fstab pour en fabriquer ses unites`),
  note('blue', '💡 <code>mount -a</code> avant de redémarrer, toujours', '<p>C’est le test qui sépare une ligne juste d’un serveur injoignable. Il monte tout ce qui manque et signale les erreurs — sans redémarrer, donc sans risque.</p>'),

  block('heading', { level: 2, text: '5) LVM : pourquoi on ne s’en passe pas' }),
  block('html', { html: '<p>Une partition classique a une taille figée à la création. Le jour où <code>/var</code> est plein, il faut arrêter, redécouper, déplacer. <strong>LVM</strong> insère une couche souple entre le disque et le système de fichiers : on ajoute un disque, on agrandit, <strong>sans arrêter le serveur</strong>.</p>' }),
  flow(`  /dev/sdb1   /dev/sdc1        <- PV : les disques physiques
       \\        /
        \\      /
        [  vg0  ]                <- VG : le reservoir commun
       /    |    \\
   lv-root lv-var lv-data        <- LV : les "partitions" souples
      |      |      |
     ext4   ext4   ext4          <- les systemes de fichiers`),
  table(['Sigle', 'Nom', 'Ce que c’est'], [
    ['<strong>PV</strong>', 'Physical Volume', 'Un disque ou une partition confié à LVM.'],
    ['<strong>VG</strong>', 'Volume Group', 'Le réservoir : un ou plusieurs PV mis en commun.'],
    ['<strong>LV</strong>', 'Logical Volume', 'La tranche qu’on découpe dedans, et qu’on formate.'],
  ]),
  sh(`# Creer, de zero
sudo pvcreate /dev/sdb1
sudo vgcreate vg0 /dev/sdb1
sudo lvcreate -L 20G -n donnees vg0
sudo mkfs.ext4 /dev/vg0/donnees
sudo mount /dev/vg0/donnees /srv/donnees

# Regarder
sudo pvs ; sudo vgs ; sudo lvs        # resume
sudo vgdisplay vg0                    # detail, dont l'espace libre`),

  block('heading', { level: 3, text: 'Agrandir, à chaud' }),
  sh(`# 1. Le nouveau disque rejoint le reservoir
sudo pvcreate /dev/sdc1
sudo vgextend vg0 /dev/sdc1

# 2. Le volume logique grandit
sudo lvextend -L +50G /dev/vg0/donnees
# ou : tout l'espace disponible
sudo lvextend -l +100%FREE /dev/vg0/donnees

# 3. LE SYSTEME DE FICHIERS AUSSI. C'est l'etape qu'on oublie.
sudo resize2fs /dev/vg0/donnees      # ext4
sudo xfs_growfs /srv/donnees         # xfs : on vise le POINT DE MONTAGE

df -h /srv/donnees                   # verifier`),
  note('yellow', '⚠️ Le volume grandit, le système de fichiers non', '<p><code>lvextend</code> agrandit le contenant ; le système de fichiers, lui, ignore l’espace supplémentaire. <code>lvs</code> affiche 70 Go, <code>df</code> en affiche toujours 20, et l’on croit à un bug. Il manque simplement <code>resize2fs</code>. Le raccourci <code>lvextend -r</code> fait les deux d’un coup — c’est celui à retenir.</p>'),
  note('red', '🚫 Réduire est une autre affaire', '<p>Agrandir se fait à chaud, sans risque. <strong>Réduire</strong> impose de démonter, de réduire le système de fichiers <em>d’abord</em>, puis le volume — et se tromper d’ordre détruit les données. <code>xfs</code> ne se réduit pas du tout. On sauvegarde avant, ou on ne réduit pas.</p>'),
  note('green', '🎯 L’instantané, pour une mise à jour risquée', '<p><code>sudo lvcreate -L 5G -s -n avant-maj /dev/vg0/donnees</code> fige un état à un instant donné. Si la mise à jour tourne mal, on revient dessus. Un instantané n’est <strong>pas une sauvegarde</strong> — il vit sur les mêmes disques — mais c’est le filet de dix secondes avant une opération délicate.</p>'),

  note('green', '🎯 L’exercice qui vaut le cours : casser <code>fstab</code> exprès', '<p>Sur une machine de test, mettre volontairement un mauvais UUID dans <code>/etc/fstab</code>, puis :</p><div class="lx-cmd">sudo mount -a\n#   mount: /data: can\'t find UUID=3f2a...-91c4\n\nsudo blkid /dev/sdb1      # le VRAI UUID\nlsblk -f                  # ou celui-ci\n# corriger, puis :\nsudo mount -a\nfindmnt /data ; df -h /data</div><p>Rencontrer ce message une fois, dans des conditions choisies, évite de le découvrir sur un serveur qui ne redémarre plus. <strong>Ne redémarre jamais après avoir modifié <code>fstab</code> sans avoir passé <code>mount -a</code>.</strong></p>'),
  sh(`du -h --max-depth=1 /var    # la place, dossier par dossier, sur UN niveau
du -sh /var/*               # equivalent, autre ecriture
du -h --max-depth=1 / | sort -h | tail   # les plus gros, tries`),

  block('heading', { level: 2, text: '6) Diagnostic' }),
  sh(`sudo dmesg | tail -30        # ce que le noyau dit du materiel : erreurs disque
lsblk -f                     # qui est monte ou, avec quel systeme de fichiers
findmnt /srv/donnees         # les options REELLEMENT appliquees
sudo smartctl -H /dev/sda    # sante du disque (paquet smartmontools)
sudo fsck -n /dev/sdb1       # verifier SANS reparer (le volume doit etre demonte)`),
  note('blue', '🪟 En regard de Windows', '<p>Partition ↔ partition · point de montage ↔ lettre de lecteur · <code>fstab</code> ↔ montages persistants · <strong>LVM ↔ disques dynamiques et espaces de stockage</strong> · instantané LVM ↔ cliché instantané VSS · <code>resize2fs</code> ↔ « Étendre le volume » de la Gestion des disques.</p>'),

  liens('/pages/linux-disques'),
];

publier(PAGE, blocks).catch(e => { console.error(e); process.exit(1); });

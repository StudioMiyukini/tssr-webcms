/* Cours « Linux : configuration réseau ».
   Reprend le plan de la fiche existante (voir, statique Debian, Netplan, DNS,
   UFW) et le porte au niveau des autres cours du site : ce que chaque commande
   montre, ce qui casse, et la méthode de diagnostic couche par couche.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-linux-reseau.ts */
import { block, note, sh, flow, table, styleLinux, liens, publier } from './_cours-linux';
import type { PageBlock } from '../client/src/lib/page-blocks';

const PAGE = {
  slug: 'linux-reseau',
  title: 'Linux : configuration réseau',
  excerpt: 'Lire une configuration avec ip et ss, poser une adresse fixe sous Debian (/etc/network/interfaces) comme sous Ubuntu (Netplan), comprendre la résolution DNS et ce que systemd-resolved change, filtrer avec UFW — et diagnostiquer une panne couche par couche au lieu de tout retenter au hasard.',
};

const blocks: PageBlock[] = [
  block('hero', {
    eyebrow: 'Cours · Linux',
    title: PAGE.title,
    subtitle: 'Poser une adresse, la garder au redémarrage, et savoir où ça coince quand ça ne passe pas.',
  }),
  styleLinux,

  block('html', { html: '<p>Un serveur Linux se configure en trois couches, et les confondre fait perdre l’essentiel du temps de dépannage : <strong>l’adresse</strong> (la machine sait-elle qui elle est ?), <strong>la route</strong> (sait-elle par où sortir ?), <strong>la résolution</strong> (sait-elle traduire un nom ?). Une panne appartient toujours à l’une des trois, et on peut les tester séparément.</p>' }),

  block('heading', { level: 2, text: '1) Voir ce qui est configuré' }),
  sh(`ip a                    # adresses par interface (remplace ifconfig)
ip r                    # table de routage : par ou on sort
ip -br a                # une ligne par interface : lisible d'un coup d'oeil
ss -tulpn               # ports en ecoute, et QUI les ecoute (remplace netstat)
ip neigh                # table ARP : qui repond sur le lien local`),
  flow(`$ ip -br a
lo               UNKNOWN  127.0.0.1/8
ens18            UP       192.168.10.20/24
                 │        └─ adresse ET masque, ensemble
                 └─ UP = le lien est actif. DOWN = cable, VM, ou interface eteinte.

$ ip r
default via 192.168.10.254 dev ens18     <- la passerelle
192.168.10.0/24 dev ens18 proto kernel scope link src 192.168.10.20`),
  note('yellow', '⚠️ Pas de ligne <code>default</code>, pas d’Internet', '<p>Une machine sans route par défaut joint parfaitement son propre réseau et rien d’autre. Le symptôme trompe : « le ping du serveur voisin marche, donc le réseau va bien ». Il ne va pas bien. <code>ip r</code> est la deuxième commande à taper, toujours.</p>'),
  note('gray', '💡 <code>ifconfig</code> et <code>netstat</code> ne sont plus installés', '<p>Ils appartiennent à <code>net-tools</code>, absent des Debian récentes. Ce n’est pas une panne : <code>ip</code> et <code>ss</code> les remplacent, et donnent davantage. Autant prendre l’habitude tout de suite — c’est ce qu’on trouvera sur les serveurs.</p>'),

  block('heading', { level: 2, text: '2) Adresse fixe — Debian, /etc/network/interfaces' }),
  sh(`sudo nano /etc/network/interfaces`),
  flow(`# Le loopback, toujours present
auto lo
iface lo inet loopback

# L'interface serveur, en statique
auto ens18                       # 'auto' = montee au demarrage
iface ens18 inet static
    address 192.168.10.20/24     # notation moderne, masque inclus
    gateway 192.168.10.254
    dns-nameservers 192.168.10.11 1.1.1.1

# La meme, en DHCP :
# iface ens18 inet dhcp`),
  sh(`sudo systemctl restart networking
# ou, sans couper les autres interfaces :
sudo ifdown ens18 && sudo ifup ens18

ip a show ens18       # verifier avant de fermer la session !`),
  note('red', '🚫 Redémarrer le réseau par SSH', '<p>Si la configuration est fausse, la session tombe et la machine est injoignable — il faut la console de l’hyperviseur. Sur un serveur distant, on prend l’habitude de lancer un filet : <code>echo "ip a add 192.168.10.20/24 dev ens18" | at now + 5 minutes</code>, ou une session <code>tmux</code> qui survit à la coupure. C’est la première leçon d’administration distante, et elle s’apprend en général une fois.</p>'),
  note('blue', '💡 <code>ens18</code>, <code>enp0s3</code>, <code>eth0</code> ?', '<p>Les noms « prévisibles » décrivent l’emplacement matériel : <code>en</code> (ethernet) + <code>p0s3</code> (bus PCI 0, slot 3). C’est stable au rebranchement, contrairement à <code>eth0</code> qui pouvait changer d’une carte à l’autre au redémarrage. <strong>Vérifie toujours le nom avec <code>ip -br a</code></strong> avant d’écrire le fichier : configurer <code>eth0</code> sur une machine qui a <code>ens18</code> est la faute la plus fréquente du TP.</p>'),

  block('heading', { level: 2, text: '3) Adresse fixe — Ubuntu, Netplan' }),
  block('html', { html: '<p>Ubuntu serveur décrit le réseau en YAML dans <code>/etc/netplan/</code>. Le YAML est <strong>sensible à l’indentation</strong>, et refuse les tabulations.</p>' }),
  flow(`# /etc/netplan/01-serveur.yaml
network:
  version: 2
  renderer: networkd
  ethernets:
    ens18:
      dhcp4: false
      addresses: [192.168.10.20/24]
      routes:
        - to: default
          via: 192.168.10.254
      nameservers:
        addresses: [192.168.10.11, 1.1.1.1]
        search: [miyukini.lan]`),
  sh(`sudo netplan try      # applique, et REVIENT EN ARRIERE au bout de 120 s
                      # si on ne confirme pas. A utiliser en SSH, toujours.
sudo netplan apply    # applique definitivement
sudo netplan get      # la configuration effective, fusionnee`),
  note('green', '🎯 <code>netplan try</code> est la réponse au piège précédent', '<p>Il applique la configuration, attend une confirmation au clavier, et restaure l’ancienne si elle ne vient pas. Une erreur ne coupe donc l’accès que deux minutes. C’est exactement le filet que Debian n’offre pas.</p>'),
  note('yellow', '⚠️ <code>gateway4</code> est obsolète', '<p>On le rencontre encore dans beaucoup de tutoriels. Netplan récent affiche un avertissement et l’ignorera à terme : la forme <code>routes: - to: default</code> est celle qu’il faut écrire.</p>'),

  block('heading', { level: 2, text: '4) La résolution DNS' }),
  block('html', { html: '<p>Historiquement, les serveurs DNS se déclarent dans <code>/etc/resolv.conf</code>. Sur les systèmes modernes, ce fichier est souvent un <strong>lien symbolique généré</strong> : l’éditer ne sert à rien, il est réécrit au redémarrage.</p>' }),
  sh(`ls -l /etc/resolv.conf          # un '->' revele un fichier genere
resolvectl status              # ce que systemd-resolved utilise VRAIMENT
resolvectl query srv.miyukini.lan

# Tester la resolution, sans dependre du cache local
dig srv.miyukini.lan
dig @192.168.10.11 srv.miyukini.lan    # interroger un serveur precis
dig -x 192.168.10.11                   # resolution inverse (PTR)
host srv.miyukini.lan`),
  table(['Fichier', 'Rôle', 'Attention'], [
    ['<code>/etc/hosts</code>', 'Correspondances locales, consultées <strong>avant</strong> le DNS.', 'Une entrée oubliée ici masque le DNS et produit une panne incompréhensible.'],
    ['<code>/etc/resolv.conf</code>', 'Les serveurs DNS à interroger.', 'Souvent généré. Vérifier <code>ls -l</code> avant d’éditer.'],
    ['<code>/etc/nsswitch.conf</code>', 'L’<strong>ordre</strong> des sources : <code>files dns</code>.', 'C’est lui qui décide que <code>/etc/hosts</code> passe en premier.'],
  ]),
  note('blue', '💡 Le domaine de recherche', '<p><code>search miyukini.lan</code> permet de taper <code>ping srv</code> au lieu de <code>ping srv.miyukini.lan</code>. Pratique — et source de confusion quand un nom court résout « tout seul » sur une machine et pas sur une autre.</p>'),

  block('heading', { level: 2, text: '5) Le pare-feu : UFW' }),
  block('html', { html: '<p>Sous le capot, Linux filtre avec <strong>nftables</strong> (successeur d’iptables). <strong>UFW</strong> en est une façade lisible, et c’est celle qu’on attend en TSSR sur Debian et Ubuntu.</p>' }),
  sh(`sudo ufw status verbose

# La posture par defaut : on refuse ce qui entre, on laisse sortir
sudo ufw default deny incoming
sudo ufw default allow outgoing

# ON OUVRE SSH AVANT D'ACTIVER. Sinon on se ferme dehors.
sudo ufw allow 22/tcp
sudo ufw enable

sudo ufw allow 80,443/tcp                       # un serveur web
sudo ufw allow from 192.168.10.0/24 to any port 3306   # MySQL, LAN seulement
sudo ufw limit 22/tcp                           # freine le bourrage de mots de passe

sudo ufw status numbered
sudo ufw delete 3`),
  note('red', '🚫 L’ordre compte : <code>allow 22</code> avant <code>enable</code>', '<p><code>ufw enable</code> applique immédiatement la politique par défaut. Activer d’abord et autoriser SSH ensuite coupe la session en cours, et la règle suivante n’arrive jamais. UFW affiche un avertissement — qu’on lit rarement à temps.</p>'),
  note('gray', '💡 Docker perce UFW', '<p>Docker écrit ses propres règles directement dans nftables, en amont de celles d’UFW : un port publié par un conteneur est joignable même si UFW l’interdit. Ce n’est pas un bug d’UFW, c’est une conséquence de l’architecture. À savoir avant de conclure que « le pare-feu ne marche pas ».</p>'),

  block('heading', { level: 2, text: '6) Diagnostiquer : couche par couche' }),
  block('html', { html: '<p>Devant « ça ne marche pas », on ne retente pas au hasard : on descend la pile, et on s’arrête au premier échec. Chaque étape écarte une cause.</p>' }),
  flow(`1. Le lien          ip -br a          ens18 est-il UP ?
2. L'adresse        ip a              en a-t-il une, dans le bon reseau ?
3. La passerelle    ping 192.168.10.254   le routeur repond-il ?
4. La route         ip r              y a-t-il un 'default via' ?
5. L'exterieur      ping 1.1.1.1      ca sort ? (adresse, pas nom)
6. Le DNS           dig cisco.com     le nom se traduit-il ?
7. Le service       ss -tulpn         le port ecoute-t-il ?
8. Le filtre        sudo ufw status   la regle existe-t-elle ?`),
  note('green', '🎯 L’étape 5 puis 6 : le test qui vaut dix minutes', '<p><code>ping 1.1.1.1</code> réussit et <code>ping cisco.com</code> échoue : le réseau fonctionne, <strong>c’est le DNS</strong>. Les deux échouent : c’est la route ou la passerelle. Cette seule paire de commandes partage le problème en deux, et évite de reconfigurer une interface qui n’avait rien.</p>'),
  sh(`# Aller plus loin quand le chemin est en cause
traceroute 1.1.1.1          # ou l'on s'arrete
mtr 1.1.1.1                 # traceroute continu : voit les pertes intermittentes
nc -zv srv.miyukini.lan 445 # ce port precis est-il joignable ?
sudo tcpdump -i ens18 port 53 -n   # ce qui part vraiment sur le fil`),
  note('blue', '🧩 Le lien avec le reste du cursus', '<p>Ces couches sont celles du <a href="/pages/modele-osi">modèle OSI</a>, et le raisonnement est le même que dans l’<a href="/pages/atelier-reseau">Atelier Réseau</a> : adresse, passerelle, route, service. Ce qui change entre un routeur Cisco et un serveur Debian, c’est la syntaxe — pas la démarche.</p>'),

  liens('/pages/linux-reseau'),
];

publier(PAGE, blocks).catch(e => { console.error(e); process.exit(1); });

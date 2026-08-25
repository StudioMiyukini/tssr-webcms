/* Page « Configurateur d'adressage IP — Debian ».
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-configurateur-debian-reseau.ts */
import { block, note, styleLinux, publier } from './_cours-linux';
import type { PageBlock } from '../client/src/lib/page-blocks';

const PAGE = {
  slug: 'configurateur-debian-reseau',
  title: 'Configurateur d’adressage IP — Debian',
  excerpt: 'Saisis ton adressage, obtiens /etc/network/interfaces, /etc/resolv.conf et /etc/hosts prêts à coller — et surtout les vérifications que la syntaxe ne fait pas : passerelle hors du sous-réseau, adresse de réseau ou de diffusion, « auto » oublié, dns-nameservers sans resolvconf.',
};

const blocks: PageBlock[] = [
  block('hero', {
    eyebrow: 'Outil · Linux',
    title: PAGE.title,
    subtitle: 'Écrire le fichier n’est pas le difficile — c’est de ne pas s’y tromper.',
  }),
  styleLinux,

  block('html', { html: '<p>Un <code>/etc/network/interfaces</code> peut être parfaitement valide et laisser la machine sans réseau. Les fautes qui coûtent une heure ne sont pas des fautes de syntaxe : <strong>une passerelle hors du sous-réseau, une adresse qui est celle du réseau lui-même, un <code>auto</code> oublié</strong>. Le fichier est accepté, l’interface monte, et rien ne marche.</p><p>Ce configurateur écrit les fichiers, et vérifie ces choses-là pendant que tu saisis.</p>' }),

  block('html', { html: '<div data-block="debian-reseau"></div>' }),

  block('heading', { level: 2, text: 'Ce qu’il vérifie, et pourquoi' }),
  block('html', { html: '<table class="lx-t"><thead><tr><th>Contrôle</th><th>Le symptôme, si on passe outre</th></tr></thead><tbody>'
    + '<tr><td><strong>Passerelle dans le sous-réseau</strong></td><td>Le réseau local marche, rien ne sort. « Je ping mon voisin mais pas Internet » — la faute la plus fréquente, et la plus déroutante.</td></tr>'
    + '<tr><td><strong>Adresse utilisable</strong></td><td>L’adresse du réseau ou celle de diffusion ne peut être portée par aucune machine.</td></tr>'
    + '<tr><td><strong>Passerelle ≠ machine</strong></td><td>Une machine ne peut pas être sa propre passerelle : les paquets ne sortent jamais.</td></tr>'
    + '<tr><td><strong><code>auto</code> présent</strong></td><td><code>ifup</code> marche à la main, et la machine n’a plus d’adresse après un redémarrage — le pendant réseau de <code>start</code> sans <code>enable</code>.</td></tr>'
    + '<tr><td><strong><code>resolvconf</code> installé</strong></td><td><code>dns-nameservers</code> n’est lu par personne : ignoré <em>en silence</em>. On croit avoir configuré le DNS.</td></tr>'
    + '<tr><td><strong>Trois serveurs DNS au plus</strong></td><td>La bibliothèque C ignore les suivants, sans le dire.</td></tr>'
    + '<tr><td><strong>Nom d’interface</strong></td><td><code>eth0</code> sur une machine qui a <code>ens18</code> : le fichier ne s’applique à rien.</td></tr>'
    + '</tbody></table>' }),
  note('blue', '💡 Il produit aussi <code>/etc/hosts</code>', '<p>Avec la ligne <code>127.0.1.1</code> que Debian attend. Sans elle, chaque <code>sudo</code> attend quelques secondes puis affiche « unable to resolve host » — la commande finit par passer, ce qui fait croire à un détail.</p>'),

  block('heading', { level: 2, text: 'Avant d’appliquer' }),
  note('red', '🚫 En SSH, garde la console de l’hyperviseur ouverte', '<p>Une erreur d’adressage coupe la session, et c’est alors le seul moyen de rentrer. Les commandes générées suivent donc l’ordre qui rend l’erreur réparable : <strong>sauvegarder, vérifier avec <code>ifquery</code>, appliquer sur une seule interface, contrôler avec <code>ip a</code> — avant de fermer quoi que ce soit.</strong></p>'),

  note('green', '🔗 Les cours qui expliquent ce qu’il génère', '<p><a href="/pages/linux-reseau">Configuration réseau</a> — la grammaire de <code>/etc/network/interfaces</code>, <code>/etc/hosts</code> et <code>/etc/resolv.conf</code> en détail · <a href="/pages/linux-commandes-base">Commandes de base</a> · <a href="/pages/repertoire-commandes">Répertoire des commandes</a></p>'),
];

publier(PAGE, blocks).catch(e => { console.error(e); process.exit(1); });

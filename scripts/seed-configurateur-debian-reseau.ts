/* Page « Configurateur d'adressage IP — Debian ».
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-configurateur-debian-reseau.ts */
import { block, flow, note, styleLinux, publier } from './_cours-linux';
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

  block('heading', { level: 2, text: 'Le script, et son filet' }),
  block('html', { html: '<p>L’outil produit aussi un <strong>script d’application</strong>. Son intérêt n’est pas d’éviter trois copier-coller : c’est de fournir le filet que Debian n’a pas.</p><p>Ubuntu a <code>netplan try</code>, qui applique, attend une confirmation au clavier et restaure l’ancienne configuration si elle ne vient pas. Debian n’offre rien de tel — une erreur d’adressage appliquée par SSH coupe la session, et il faut la console de l’hyperviseur pour rentrer.</p>' }),
  flow(`1. Le filet est arme AVANT toute modification
   Une tache de fond attend, puis restaure — sauf si un temoin apparait.
   Elle n'utilise que coreutils : ni « at » ni « systemd-run », absents
   d'une Debian minimale.

2. Les fichiers sont ecrits, puis VALIDES par ifquery
   Une syntaxe refusee restaure sans meme appliquer.

3. L'interface est rechargee, seule

4. La verification decide
   L'adresse est-elle posee ? La passerelle repond-elle ?
   Oui  -> le temoin desamorce le filet, la configuration reste.
   Non  -> on ne fait rien : le filet restaure tout seul.`),
  note('green', '🎯 Ce que le filet couvre vraiment', '<p>Pas seulement une configuration fausse : aussi un script <strong>interrompu</strong>. Si la session SSH tombe au moment de la bascule — le cas le plus probable, justement — la tâche de fond continue et restaure. C’est pour cela qu’elle est armée avant la première écriture, et pas après.</p>'),
  note('yellow', '⚠️ Le délai se choisit', '<p>Deux minutes par défaut : assez pour se reconnecter et vérifier à la main, assez court pour ne pas rester devant une console. Trop long, et l’on attend inutilement après un échec ; trop court, et le filet se déclenche alors que tout allait bien.</p>'),

  block('heading', { level: 2, text: 'Avant d’appliquer' }),
  note('red', '🚫 En SSH, garde la console de l’hyperviseur ouverte', '<p>Une erreur d’adressage coupe la session, et c’est alors le seul moyen de rentrer. Les commandes générées suivent donc l’ordre qui rend l’erreur réparable : <strong>sauvegarder, vérifier avec <code>ifquery</code>, appliquer sur une seule interface, contrôler avec <code>ip a</code> — avant de fermer quoi que ce soit.</strong></p>'),

  note('green', '🔗 Les cours qui expliquent ce qu’il génère', '<p><a href="/pages/linux-reseau">Configuration réseau</a> — la grammaire de <code>/etc/network/interfaces</code>, <code>/etc/hosts</code> et <code>/etc/resolv.conf</code> en détail · <a href="/pages/linux-commandes-base">Commandes de base</a> · <a href="/pages/repertoire-commandes">Répertoire des commandes</a></p>'),
];

publier(PAGE, blocks).catch(e => { console.error(e); process.exit(1); });

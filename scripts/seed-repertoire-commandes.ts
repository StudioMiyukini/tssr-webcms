/* Page « Répertoire des commandes » — l'aide-mémoire cherchable, seul.
   Il partageait une page avec le constructeur de script ; il mérite la sienne,
   parce que c'est celle qu'on garde ouverte pendant qu'on travaille.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-repertoire-commandes.ts */
import { block, note, styleLinux, publier } from './_cours-linux';
import type { PageBlock } from '../client/src/lib/page-blocks';

const PAGE = {
  slug: 'repertoire-commandes',
  title: 'Répertoire des commandes Linux',
  excerpt: 'Pose ta question en français — « comment voir la place qui reste sur le disque ? » — et l’outil trouve la commande. Les mots inutiles sont ignorés, les synonymes reconnus, et les anciens noms comme les équivalents Windows mènent au bon endroit. Chaque fiche donne les options utiles, le piège classique et le pendant Windows.',
};

const blocks: PageBlock[] = [
  block('hero', {
    eyebrow: 'Outil · Linux',
    title: PAGE.title,
    subtitle: 'Quand on sait ce qu’on veut faire, mais pas comment ça s’appelle.',
  }),
  styleLinux,

  block('html', { html: '<p>Un index alphabétique ne sert qu’à ceux qui connaissent déjà le nom de la commande. Celui-ci s’interroge <strong>en français</strong>, par ce qu’on cherche à faire.</p>' }),

  block('html', { html: '<div data-block="linux-commandes"></div>' }),

  block('heading', { level: 2, text: 'Comment la recherche fonctionne' }),
  block('html', { html: '<p>Elle ne cherche pas ta phrase telle quelle : elle la <strong>découpe</strong>, jette ce qui n’apprend rien, et étend le reste.</p>' }),
  block('html', { html: '<table class="lx-t"><thead><tr><th>Étape</th><th>Sur « comment voir la place qui reste sur le disque »</th></tr></thead><tbody>'
    + '<tr><td>Découpage</td><td>comment · voir · la · place · qui · reste · sur · le · disque</td></tr>'
    + '<tr><td>Mots vides jetés</td><td><s>comment</s> <s>voir</s> <s>la</s> <s>qui</s> <s>sur</s> <s>le</s> → <strong>place · reste · disque</strong></td></tr>'
    + '<tr><td>Radical</td><td>« fichiers » et « fichier » se rejoignent, « commandes » et « commande » aussi</td></tr>'
    + '<tr><td>Synonymes</td><td><em>place</em> = <em>espace</em> = <em>stockage</em> = <em>libre</em> = <em>plein</em></td></tr>'
    + '<tr><td>Classement</td><td>la fiche qui couvre le plus de mots, et dans les champs les plus révélateurs</td></tr>'
    + '</tbody></table>' }),
  note('blue', '💡 Les mots retenus sont affichés', '<p>Sous la barre de recherche, l’outil montre ce qu’il a réellement gardé de ta phrase. Un résultat surprenant devient alors explicable : on voit tout de suite si un mot a été ignoré, ou s’il a été rapproché d’un synonyme qu’on n’attendait pas.</p>'),

  block('heading', { level: 2, text: 'Ce qui marche, et qu’on n’essaie pas' }),
  block('html', { html: '<table class="lx-t"><thead><tr><th>Ce qu’on tape</th><th>Ce qu’on obtient</th></tr></thead><tbody>'
    + '<tr><td><code>plus de place</code></td><td>Voir l’espace libre, et trouver ce qui l’occupe</td></tr>'
    + '<tr><td><code>je veux connaitre mon adresse ip</code></td><td><code>ip -br a</code></td></tr>'
    + '<tr><td><code>tuer un programme</code></td><td><code>kill</code>, et la nuance TERM / KILL</td></tr>'
    + '<tr><td><code>permission denied</code></td><td><code>namei -l</code> : le refus vient d’un dossier parent</td></tr>'
    + '<tr><td><code>ifconfig</code></td><td><code>ip -br a</code>, avec la raison du changement</td></tr>'
    + '<tr><td><code>ipconfig</code> · <code>findstr</code> · <code>taskkill</code></td><td>L’équivalent Linux — un TSSR arrive souvent de ce côté-là</td></tr>'
    + '</tbody></table>' }),
  note('gray', '🔎 Si rien ne sort', '<p>Reformule avec un mot plus courant : <em>place</em>, <em>port</em>, <em>droits</em>, <em>service</em>, <em>log</em>, <em>copier</em>. Et si la commande manque vraiment au répertoire, elle est peut-être dans <code>man</code> — ou dans les cours ci-dessous.</p>'),

  note('green', '🔗 Les cours qui vont avec', '<p><a href="/pages/linux-commandes-base">Commandes de base</a> — la même matière, mais qui se lit dans l’ordre et s’imprime · <a href="/pages/linux-bash">Scripts Bash</a> · <a href="/pages/outils-linux">Constructeur de script Bash</a> · <a href="/pages/linux-paquets-essentiels">Les paquets essentiels</a></p>'),
];

publier(PAGE, blocks).catch(e => { console.error(e); process.exit(1); });

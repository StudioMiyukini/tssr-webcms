/* Page « Boîte à outils Linux » : l'aide-mémoire cherchable et le constructeur
   de script Bash, avec ce qu'il faut savoir pour s'en servir.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-outils-linux.ts */
import { block, note, sh, styleLinux, publier } from './_cours-linux';
import type { PageBlock } from '../client/src/lib/page-blocks';

const PAGE = {
  slug: 'outils-linux',
  title: 'Boîte à outils Linux',
  excerpt: 'Deux outils pour la ligne de commande : un aide-mémoire qu’on interroge avec ses mots — « gros fichiers », « qui écoute sur un port », « permission denied » — plutôt qu’avec le nom d’une commande qu’on ne connaît pas encore ; et un constructeur de script Bash qui pose les garde-fous à votre place, en expliquant ce que chacun évite.',
};

const blocks: PageBlock[] = [
  block('hero', {
    eyebrow: 'Outils · Linux',
    title: PAGE.title,
    subtitle: 'Trouver la commande quand on ne connaît que le problème, et écrire un script qui tient debout.',
  }),
  styleLinux,

  block('heading', { level: 2, text: '🐧 Aide-mémoire — cherche avec tes mots' }),
  block('html', { html: '<p>Un index alphabétique de commandes ne sert qu’à ceux qui connaissent déjà le nom. Celui-ci s’interroge par <strong>ce qu’on veut faire</strong> : tape <em>gros fichiers</em>, <em>qui écoute sur un port</em>, <em>permission denied</em>, <em>disque plein</em>. Les anciens noms qu’on tape par habitude (<code>ifconfig</code>, <code>netstat</code>) et les équivalents Windows (<code>ipconfig</code>, <code>findstr</code>, <code>taskkill</code>) mènent aussi au bon endroit.</p><p>Chaque fiche donne la commande, les options qu’on utilise vraiment, <strong>le piège classique</strong> quand il y en a un, et l’équivalent Windows.</p>' }),
  block('html', { html: '<div data-block="linux-commandes"></div>' }),

  note('blue', '💡 Ce qui n’est pas dedans', '<p>Les commandes rares et les options exotiques : elles sont dans <code>man</code>, et les lister ici rendrait la recherche inutile. Cet outil retient ce qu’un TSSR tape réellement en exploitation. Pour le détail d’une commande : <code>man ss</code>, ou <code>ss --help</code> quand on cherche juste une option.</p>'),

  block('heading', { level: 2, text: '🧱 Constructeur de script Bash' }),
  block('html', { html: '<p>Écrire un script n’est pas difficile. L’écrire <strong>sûrement</strong> l’est : les fautes qui coûtent cher sont toujours les mêmes — une variable vide dans un <code>rm -rf</code>, une erreur au milieu qui n’arrête rien, un fichier temporaire laissé derrière, deux exécutions qui se chevauchent la nuit.</p><p>L’outil assemble le squelette qui les évite, et <strong>dit ce que chaque garde-fou évite</strong> — clique le titre d’une case pour le savoir. Le script produit est complet : on remplace le traitement, le reste tient.</p>' }),
  block('html', { html: '<div data-block="bash-builder"></div>' }),

  note('yellow', '⚠️ Les trois lignes qui font la différence', '<p><code>set -e</code> arrête à la première erreur — sans elle, la sauvegarde échoue et l’effacement qui suit s’exécute quand même. <code>set -u</code> refuse les variables non définies : c’est ce qui empêche <code>rm -rf "$DEST/"</code> de devenir <code>rm -rf /</code>. <code>set -o pipefail</code> fait compter un échec au milieu d’un tube, alors que seul le dernier code comptait.</p>'),

  block('heading', { level: 2, text: 'Après la génération' }),
  sh(`chmod +x sauvegarde.sh          # sans ca, "Permission denied" a l'execution
shellcheck sauvegarde.sh        # il attrape les fautes de citation qu'aucune relecture ne voit
bash -n sauvegarde.sh           # la syntaxe seule, sans rien executer
bash -x sauvegarde.sh           # tracer l'execution ligne a ligne, en depannage`),
  note('green', '🎯 <code>shellcheck</code> vaut la demi-heure d’installation', '<p><code>sudo apt install shellcheck</code>. Il signale les variables non protégées par des guillemets, les comparaisons douteuses, les redirections inutiles — c’est-à-dire précisément les fautes qui ne se voient qu’en production, sur un nom de fichier contenant une espace.</p>'),

  note('blue', '🔗 Les cours qui vont avec', '<p><a href="/pages/linux-bases">Les bases</a> · <a href="/pages/linux-bash">Scripts Bash</a> · <a href="/pages/linux-droits">Droits et sudo</a> · <a href="/pages/linux-systemd">systemd</a> · <a href="/pages/linux-cron-logs">Planification et journaux</a> · <a href="/pages/linux-reseau">Réseau</a> · <a href="/pages/linux-disques">Disques et LVM</a></p>'),
];

publier(PAGE, blocks).catch(e => { console.error(e); process.exit(1); });

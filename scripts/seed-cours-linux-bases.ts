/* Cours « Linux : les bases (Debian) » — arborescence, commandes essentielles, utilisateurs & droits,
   paquets, services systemd, réseau. Premier cours du track Linux.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-linux-bases.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'linux-bases', title: 'Linux : les bases (Debian)', excerpt: 'Prendre en main un serveur Linux : arborescence des fichiers, commandes essentielles (navigation, fichiers, recherche), utilisateurs & groupes, permissions (rwx / chmod / chown), gestion des paquets (apt), services (systemctl) et réseau.' };
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const styleBlock = block('html', { html: `<style>.lx-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}.lx-t{border-collapse:collapse;width:100%;font-size:13px;margin:6px 0}.lx-t th,.lx-t td{border:1px solid var(--border);padding:6px 10px;text-align:left}.lx-t th{background:var(--surface-2)}.lx-t td:first-child{font-family:ui-monospace,monospace;white-space:nowrap;font-weight:600}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="lx-cmd">${esc(t)}</div>` });
const tbl = (head: string[], rows: string[][]) => block('html', { html: `<table class="lx-t"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>` });

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Linux', title: PAGE.title, subtitle: 'Le minimum vital pour administrer un serveur Linux en ligne de commande.' }),
  styleBlock,
  block('html', { html: '<p><strong>Linux</strong> équipe la majorité des serveurs (web, DNS, fichiers…). En TSSR, on l’administre surtout <strong>en ligne de commande</strong> (souvent en SSH), généralement sur une distribution <strong>Debian</strong>. Ce cours donne les fondations ; les services (SSH, Apache, Samba) font l’objet de cours dédiés.</p>' }),
  note('blue', '🧭 Repères', '<p><strong>Tout est fichier</strong> sous Linux. On distingue l’utilisateur normal (invite <code>$</code>) du <strong>super-utilisateur root</strong> (invite <code>#</code>). On élève ses droits avec <code>sudo</code> devant une commande. Linux est <strong>sensible à la casse</strong> (<code>Fichier</code> ≠ <code>fichier</code>).</p>'),

  block('heading', { level: 2, text: '1) L’arborescence des fichiers' }),
  block('html', { html: '<p>Un seul arbre partant de la racine <code>/</code> (pas de <code>C:</code>). Les répertoires clés :</p>' }),
  tbl(['Chemin', 'Contenu'], [
    ['/etc', 'fichiers de <strong>configuration</strong> (le cœur de l’admin)'],
    ['/home', 'dossiers personnels des utilisateurs'],
    ['/var', 'données variables : <strong>logs</strong> (/var/log), sites web, bases…'],
    ['/root', 'dossier personnel de <strong>root</strong>'],
    ['/bin, /usr/bin', 'programmes / commandes'],
    ['/tmp', 'fichiers temporaires'],
    ['/dev', 'périphériques (disques : /dev/sda…)'],
    ['/mnt', 'point de <strong>montage temporaire</strong> : on y accroche une clé, un partage réseau, un disque le temps d’une intervention'],
    ['/media', 'montages <strong>automatiques</strong> des supports amovibles (clés USB, CD)'],
    ['/opt', 'logiciels installés <strong>hors gestionnaire de paquets</strong> : chacun dans son sous-dossier'],
    ['/proc', '<strong>vue du noyau</strong>, pas un vrai dossier : un dossier par processus, et l’état du système'],
    ['/sys', '<strong>vue du matériel</strong> : périphériques, pilotes, réglages du noyau'],
  ]),

  note('blue', '💡 /proc et /sys ne sont pas sur le disque', '<p>Ce sont des <strong>systèmes de fichiers virtuels</strong> : le noyau les fabrique à la volée quand on les lit. Rien n’y occupe d’espace, et rien n’y survit au redémarrage. C’est ce qui explique le détail troublant : <code>ls -l /proc/cpuinfo</code> annonce <strong>0 octet</strong> alors que <code>cat</code> en affiche cinquante lignes. La taille n’existe qu’au moment de la lecture.</p>'),

  block('html', { html: '<p>Ce qu’on y lit vraiment, au quotidien :</p>' }),
  block('html', { html: '<div class="lx-cmd">'
    + 'cat /proc/cpuinfo          # processeur : modele, nombre de coeurs\n'
    + 'cat /proc/meminfo          # memoire : totale, libre, cache\n'
    + 'cat /proc/mounts           # ce qui est REELLEMENT monte\n'
    + 'cat /proc/uptime           # depuis combien de secondes la machine tourne\n'
    + 'ls /proc/1234/             # tout sur le processus 1234 (PID)\n'
    + 'cat /proc/1234/cmdline     # avec quelle ligne de commande il a demarre\n'
    + '\n'
    + 'ls /sys/class/net/         # les interfaces reseau vues par le noyau\n'
    + 'cat /sys/class/net/ens18/address    # adresse MAC\n'
    + 'cat /sys/block/sda/size    # taille du disque, en secteurs de 512 o'
    + '</div>' }),
  note('gray', '🧭 À quoi ça sert en dépannage', '<p>Les commandes usuelles ne font souvent que <strong>mettre en forme</strong> ces fichiers : <code>free</code> lit <code>/proc/meminfo</code>, <code>ps</code> parcourt les dossiers de <code>/proc</code>, <code>df</code> s’appuie sur <code>/proc/mounts</code>. Le savoir dépanne le jour où un outil manque sur une machine minimale ou dans un conteneur : la source, elle, est toujours là.</p>'),
  note('yellow', '⚠️ Écrire dans /proc et /sys agit immédiatement', '<p>Certains fichiers sont modifiables et changent le comportement du noyau à la seconde — activer le routage, par exemple : <code>echo 1 &gt; /proc/sys/net/ipv4/ip_forward</code>. Mais <strong>rien n’est conservé au redémarrage</strong> : pour que le réglage tienne, il faut l’écrire dans <code>/etc/sysctl.conf</code> ou <code>/etc/sysctl.d/</code>. C’est la cause classique du « ça marchait hier » après un redémarrage.</p>'),
  note('gray', '📦 /opt, /usr/local et les paquets', '<p><code>apt</code> installe dans <code>/usr</code> : on n’y touche pas à la main, le gestionnaire de paquets en est propriétaire. Ce qu’on ajoute soi-même va dans <code>/opt</code> (un logiciel livré en bloc, chacun dans son dossier) ou <code>/usr/local</code> (ce qu’on a compilé soi-même). La séparation a un but précis : une mise à jour du système n’écrase jamais ce qui est dans <code>/opt</code>.</p>'),
  note('yellow', '⚠️ /mnt : monter n’efface pas, ça masque', '<p>Monter un support sur un dossier <strong>non vide</strong> ne supprime rien : le contenu d’origine disparaît de la vue tant que le montage tient, et réapparaît au démontage. C’est la façon classique de croire qu’on a perdu des données. → <a href="/pages/linux-disques">Disques, partitions et LVM</a>.</p>'),

  block('heading', { level: 2, text: '2) Se déplacer et manipuler les fichiers' }),
  tbl(['Commande', 'Rôle'], [
    ['pwd', 'affiche le répertoire courant'],
    ['ls -l / ls -la', 'liste (détaillé / avec fichiers cachés)'],
    ['cd /etc, cd .., cd ~', 'se déplacer (dossier, parent, home)'],
    ['cp source dest', 'copier (<code>-r</code> pour un dossier)'],
    ['mv source dest', 'déplacer / renommer'],
    ['rm fichier', 'supprimer (<code>-r</code> dossier, <code>-f</code> forcer)'],
    ['mkdir / rmdir', 'créer / supprimer un dossier'],
    ['cat / less / tail -f', 'afficher / paginer / suivre un fichier (log)'],
    ['nano / vim', 'éditer un fichier texte'],
  ]),
  note('gray', '🔎 Chercher & enchaîner', '<p><code>find /etc -name "*.conf"</code> cherche des fichiers ; <code>grep motif fichier</code> cherche du texte. Le <strong>pipe</strong> <code>|</code> enchaîne : <code>cat /etc/passwd | grep jean</code>. La <strong>redirection</strong> <code>&gt;</code> écrit dans un fichier, <code>&gt;&gt;</code> ajoute à la fin.</p>'),

  block('heading', { level: 2, text: '3) Utilisateurs & groupes' }),
  cmd(`sudo adduser jean            # créer un utilisateur (interactif)
sudo passwd jean             # (re)définir son mot de passe
sudo usermod -aG sudo jean   # l'ajouter au groupe sudo (droits admin)
groups jean                  # voir ses groupes
sudo deluser jean            # supprimer`),
  block('html', { html: '<p>Les comptes sont dans <code>/etc/passwd</code>, les groupes dans <code>/etc/group</code>, les mots de passe (hachés) dans <code>/etc/shadow</code>.</p>' }),

  block('heading', { level: 2, text: '4) Les permissions (rwx)' }),
  block('html', { html: '<p>Chaque fichier a un <strong>propriétaire</strong>, un <strong>groupe</strong> et des droits pour trois catégories : <strong>u</strong>ser (propriétaire), <strong>g</strong>roup, <strong>o</strong>ther. Trois droits : <strong>r</strong>ead (4), <strong>w</strong>rite (2), e<strong>x</strong>ecute (1). <code>ls -l</code> les montre : <code>-rwxr-x---</code>.</p>' }),
  tbl(['Notation', 'Signification'], [
    ['rwx = 7', 'lecture + écriture + exécution'],
    ['rw- = 6', 'lecture + écriture'],
    ['r-x = 5', 'lecture + exécution'],
    ['r-- = 4', 'lecture seule'],
  ]),
  cmd(`chmod 750 script.sh          # u=rwx, g=r-x, o=--- (numérique)
chmod u+x script.sh          # ajouter exécution au propriétaire (symbolique)
chown jean:admins fichier    # changer propriétaire:groupe
chmod -R 755 /var/www        # récursif sur un dossier`),
  note('yellow', '💡 Lire un rwx', '<p><code>-rwxr-x---</code> : fichier (<code>-</code>), propriétaire = <strong>rwx</strong>, groupe = <strong>r-x</strong>, autres = <strong>---</strong>. Soit <strong>750</strong>. Pour un dossier, <code>x</code> = droit d’y <em>entrer</em>.</p>'),

  block('heading', { level: 2, text: '5) Installer des paquets (apt)' }),
  cmd(`sudo apt update              # met à jour la liste des paquets
sudo apt upgrade             # met à jour les paquets installés
sudo apt install apache2     # installer un paquet
sudo apt remove apache2      # désinstaller
apt search samba             # rechercher`),
  block('html', { html: '<p>Debian/Ubuntu utilisent <strong>apt</strong> (paquets <code>.deb</code>). D’autres familles utilisent <code>yum</code>/<code>dnf</code> (Red Hat/CentOS).</p>' }),

  block('heading', { level: 2, text: '6) Gérer les services (systemd)' }),
  cmd(`systemctl status ssh         # état d'un service
sudo systemctl start ssh     # démarrer
sudo systemctl stop ssh      # arrêter
sudo systemctl restart ssh   # redémarrer
sudo systemctl enable ssh    # démarrage automatique au boot
sudo systemctl disable ssh   # désactiver au boot
journalctl -u ssh            # journaux du service`),

  block('heading', { level: 2, text: '7) Réseau' }),
  cmd(`ip a                         # adresses IP des interfaces (ex ifconfig)
ip r                         # table de routage / passerelle
ping 8.8.8.8                 # test connectivité
cat /etc/resolv.conf         # serveurs DNS
# IP fixe : /etc/network/interfaces (Debian) ou Netplan (Ubuntu récent)`),
  note('gray', '🔧 IP fixe Debian (extrait)', '<div class="lx-cmd"># /etc/network/interfaces\nauto ens33\niface ens33 inet static\n    address 192.168.10.20/24\n    gateway 192.168.10.254\n    dns-nameservers 192.168.10.1</div><p>Puis <code>sudo systemctl restart networking</code>.</p>'),

  note('green', '🔗 Suite du track Linux', '<p>À venir : <strong>SSH serveur</strong>, <strong>Apache</strong> (serveur web), <strong>Samba</strong> (partage de fichiers vers Windows). Cours liés : <a href="/pages/le-ssh">Le SSH</a>, <a href="/pages/systemes-de-fichiers">Les systèmes de fichiers</a>, <a href="/pages/permissions-partage-ntfs">Permissions (Windows)</a> pour comparer.</p>'),
];

function cookieFrom(res: Response): string {
  const sc = (res.headers as any).getSetCookie?.() as string[] | undefined;
  return (sc && sc.length ? sc : [res.headers.get('set-cookie') || '']).map(c => c.split(';')[0]).filter(Boolean).join('; ');
}
async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: PW }) });
  if (!login.ok) throw new Error(`login ${login.status}`);
  const cookie = cookieFrom(login);
  const h = { 'Content-Type': 'application/json', Cookie: cookie };
  const existing = await (await fetch(`${BASE}/api/admin/pages`, { headers: { Cookie: cookie } })).json() as Array<{ id: number; slug: string }>;
  const cur = existing.find(e => e.slug === PAGE.slug);
  const body = JSON.stringify({ title: PAGE.title, slug: PAGE.slug, excerpt: PAGE.excerpt, content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1 });
  const res = cur ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body }) : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log(`PAGE ${PAGE.slug}`, res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());
  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

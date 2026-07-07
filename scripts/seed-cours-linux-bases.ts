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
  ]),

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

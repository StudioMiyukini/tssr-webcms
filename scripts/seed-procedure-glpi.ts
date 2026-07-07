/* Procédure « GLPI : parc informatique + helpdesk ». Usage : BASE=... ADMIN_PW=... tsx scripts/seed-procedure-glpi.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'procedure-glpi', title: 'GLPI : gestion de parc & tickets (installation)', excerpt: 'Installer GLPI sur un serveur LAMP (Linux + Apache + MariaDB + PHP), gérer l’inventaire du parc, le helpdesk (tickets) et l’inventaire automatique via l’agent. Étapes d’installation et premiers réglages.' };
const block = (t: Parameters<typeof makePageBlock>[0], p: Partial<PageBlock>) => Object.assign(makePageBlock(t), p);
const note = (c: string, t: string, h: string) => block('html', { html: `<aside class="pb-note pb-note-${c}"><p class="pb-note-title">${t}</p>${h}</aside>` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stepsStyle = block('html', { html: `<style>.proc-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}.proc-steps{padding-left:22px;line-height:1.75}.proc-steps>li{margin:8px 0}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="proc-cmd">${esc(t)}</div>` });
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Procédure · Exploitation', title: PAGE.title, subtitle: 'Inventorier le parc et gérer les demandes des utilisateurs, au même endroit.' }),
  stepsStyle,
  note('blue', '🎯 Ce qu’apporte GLPI', '<p><strong>GLPI</strong> est un logiciel libre de <strong>gestion de parc</strong> (ordinateurs, moniteurs, logiciels, licences, contrats) et de <strong>helpdesk</strong> (tickets d’incident/demande). Il se pose sur une pile <strong>LAMP</strong> : Linux + <strong>A</strong>pache + <strong>M</strong>ariaDB + <strong>P</strong>HP.</p>'),
  block('heading', { level: 2, text: '1) Installer la pile LAMP' }),
  cmd(`sudo apt update
sudo apt install apache2 mariadb-server php php-mysql php-gd php-curl php-xml php-intl php-mbstring php-zip -y
sudo systemctl enable apache2 mariadb`),
  block('heading', { level: 2, text: '2) Créer la base de données' }),
  cmd(`sudo mysql_secure_installation      # sécuriser MariaDB
sudo mysql -u root -p
  CREATE DATABASE glpidb;
  CREATE USER 'glpi'@'localhost' IDENTIFIED BY 'MotDePasse';
  GRANT ALL PRIVILEGES ON glpidb.* TO 'glpi'@'localhost';
  FLUSH PRIVILEGES;
  EXIT;`),
  block('heading', { level: 2, text: '3) Déployer GLPI' }),
  cmd(`cd /tmp
# récupérer la dernière archive depuis github.com/glpi-project/glpi/releases
sudo tar -xzf glpi-*.tgz -C /var/www/
sudo chown -R www-data:www-data /var/www/glpi
sudo systemctl restart apache2`),
  block('heading', { level: 2, text: '4) Assistant web d’installation' }),
  block('html', { html: `<ol class="proc-steps">
    <li>Ouvre <code>http://&lt;IP_serveur&gt;/glpi</code> → l’assistant démarre.</li>
    <li>Renseigne la <strong>base</strong> : hôte <code>localhost</code>, utilisateur <code>glpi</code>, mot de passe, base <code>glpidb</code>.</li>
    <li>Laisse initialiser, puis <strong>connexion</strong> avec le compte par défaut <code>glpi / glpi</code>.</li>
  </ol>` }),
  note('yellow', '⚠️ Sécurité post-installation', '<p><strong>Change immédiatement</strong> les mots de passe des comptes par défaut (<code>glpi</code>, <code>tech</code>, <code>post-only</code>) et <strong>supprime</strong> le fichier <code>install/install.php</code>, sinon l’installeur reste accessible.</p>'),
  block('heading', { level: 2, text: '5) Premiers usages' }),
  block('html', { html: `<ul>
    <li><strong>Parc</strong> : ajouter des ordinateurs, logiciels, imprimantes (manuel) ou via l’<strong>agent GLPI</strong> (inventaire automatique).</li>
    <li><strong>Assistance</strong> : ouvrir/suivre des <strong>tickets</strong>, les attribuer à des techniciens, définir des <strong>SLA</strong>.</li>
    <li><strong>Annuaire</strong> : brancher l’authentification sur <strong>Active Directory (LDAP)</strong> pour que les utilisateurs se connectent avec leur compte de domaine.</li>
  </ul>` }),
  note('green', '🔗 Liens', '<p>Méthode incident : <a href="/pages/le-ticketing">Le ticketing</a>. Surveillance : <a href="/pages/supervision">La supervision</a>. Socle : <a href="/pages/linux-apache">Apache</a>, <a href="/pages/linux-bases">Linux : les bases</a>.</p>'),
];
function cookieFrom(res: Response): string { const sc = (res.headers as any).getSetCookie?.() as string[] | undefined; return (sc && sc.length ? sc : [res.headers.get('set-cookie') || '']).map(c => c.split(';')[0]).filter(Boolean).join('; '); }
async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: PW }) });
  if (!login.ok) throw new Error(`login ${login.status}`);
  const cookie = cookieFrom(login); const h = { 'Content-Type': 'application/json', Cookie: cookie };
  const existing = await (await fetch(`${BASE}/api/admin/pages`, { headers: { Cookie: cookie } })).json() as Array<{ id: number; slug: string }>;
  const cur = existing.find(e => e.slug === PAGE.slug);
  const body = JSON.stringify({ title: PAGE.title, slug: PAGE.slug, excerpt: PAGE.excerpt, content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1 });
  const res = cur ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body }) : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log(`PAGE ${PAGE.slug}`, res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());
  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } }); console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

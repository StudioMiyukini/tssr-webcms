/* Cours « Samba : partage de fichiers Linux ↔ Windows ». Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-linux-samba.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'linux-samba', title: 'Samba : partager des fichiers vers Windows', excerpt: 'Rendre un dossier Linux accessible depuis Windows (protocole SMB/CIFS) : installer Samba, déclarer un partage dans smb.conf, gérer les utilisateurs Samba et les permissions, puis accéder au partage en \\\\serveur\\partage.' };
const block = (t: Parameters<typeof makePageBlock>[0], p: Partial<PageBlock>) => Object.assign(makePageBlock(t), p);
const note = (c: string, t: string, h: string) => block('html', { html: `<aside class="pb-note pb-note-${c}"><p class="pb-note-title">${t}</p>${h}</aside>` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const styleBlock = block('html', { html: `<style>.lx-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="lx-cmd">${esc(t)}</div>` });
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Linux', title: PAGE.title, subtitle: 'Faire dialoguer un serveur Linux avec les postes Windows (partages réseau).' }),
  styleBlock,
  block('html', { html: '<p><strong>Samba</strong> implémente le protocole <strong>SMB/CIFS</strong> de Windows sur Linux : un dossier Linux devient un <strong>partage réseau</strong> accessible en <code>\\\\serveur\\partage</code> depuis l’Explorateur Windows, exactement comme un partage Windows.</p>' }),
  block('heading', { level: 2, text: '1) Installer' }),
  cmd(`sudo apt update
sudo apt install samba
sudo systemctl enable smbd`),
  block('heading', { level: 2, text: '2) Préparer le dossier partagé' }),
  cmd(`sudo mkdir -p /srv/partage
sudo chown -R nobody:nogroup /srv/partage
sudo chmod -R 0775 /srv/partage`),
  block('heading', { level: 2, text: '3) Déclarer le partage (smb.conf)' }),
  block('html', { html: '<p>Ajoute une section à la fin de <code>/etc/samba/smb.conf</code> :</p>' }),
  cmd(`[Partage]
   path = /srv/partage
   browseable = yes
   read only = no
   valid users = jean
   create mask = 0664
   directory mask = 0775`),
  block('html', { html: '<p>Vérifie la syntaxe, puis recharge :</p>' }),
  cmd(`testparm                       # valide smb.conf
sudo systemctl restart smbd`),
  block('heading', { level: 2, text: '4) Créer l’utilisateur Samba' }),
  block('html', { html: '<p>Samba a ses <strong>propres mots de passe</strong> (distincts de ceux de Linux) ; l’utilisateur doit d’abord exister sous Linux :</p>' }),
  cmd(`sudo useradd -M -s /usr/sbin/nologin jean   # (si pas déjà un compte Linux)
sudo smbpasswd -a jean                       # crée le mot de passe Samba
sudo smbpasswd -e jean                       # active le compte`),
  note('yellow', '🔐 Double filtrage', '<p>L’accès dépend à la fois des <strong>droits Samba</strong> (<code>valid users</code>, <code>read only</code>) <strong>et</strong> des <strong>permissions Linux</strong> (rwx) du dossier — comme le cumul Partage + NTFS sous Windows. Le plus restrictif l’emporte. Voir <a href="/pages/permissions-partage-ntfs">Permissions Partage & NTFS</a>.</p>'),
  block('heading', { level: 2, text: '5) Accéder depuis Windows' }),
  block('html', { html: '<p>Dans l’Explorateur Windows : <code>\\\\192.168.10.20\\Partage</code> (ou <code>\\\\serveur\\Partage</code> si le DNS résout). Saisir l’identifiant/mot de passe Samba. Depuis Linux : <code>smbclient //192.168.10.20/Partage -U jean</code>.</p>' }),
  block('heading', { level: 2, text: '6) Dépanner' }),
  cmd(`sudo systemctl status smbd
testparm                       # erreurs de config
sudo ufw allow samba           # ouvrir le pare-feu (ports 139/445)
sudo tail -f /var/log/samba/log.smbd`),
  note('green', '🔗 Liens', '<p><a href="/pages/permissions-partage-ntfs">Permissions Partage & NTFS (Windows)</a> · <a href="/pages/procedure-dfs">DFS</a> · <a href="/pages/linux-bases">Linux : les bases</a>.</p>'),
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

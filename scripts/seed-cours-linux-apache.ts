/* Cours « Apache : serveur web Linux ». Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-linux-apache.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'linux-apache', title: 'Apache : héberger un site web sous Linux', excerpt: 'Installer Apache2, comprendre la racine web /var/www, créer un hôte virtuel (virtual host) pour publier un site, l’activer (a2ensite) et tester. L’équivalent Linux d’IIS.' };
const block = (t: Parameters<typeof makePageBlock>[0], p: Partial<PageBlock>) => Object.assign(makePageBlock(t), p);
const note = (c: string, t: string, h: string) => block('html', { html: `<aside class="pb-note pb-note-${c}"><p class="pb-note-title">${t}</p>${h}</aside>` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const styleBlock = block('html', { html: `<style>.lx-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="lx-cmd">${esc(t)}</div>` });
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Linux', title: PAGE.title, subtitle: 'Publier un site web sur Linux — le pendant d’IIS côté Microsoft.' }),
  styleBlock,
  block('html', { html: '<p><strong>Apache</strong> (paquet <code>apache2</code>) est le serveur web le plus répandu. Il sert des pages depuis une <strong>racine web</strong> et gère plusieurs sites sur une même machine grâce aux <strong>hôtes virtuels</strong>.</p>' }),
  block('heading', { level: 2, text: '1) Installer' }),
  cmd(`sudo apt update
sudo apt install apache2
sudo systemctl enable apache2
sudo systemctl status apache2`),
  block('html', { html: '<p>Teste : ouvre <code>http://&lt;IP_du_serveur&gt;</code> → la page « Apache2 Debian Default Page » s’affiche. La racine par défaut est <code>/var/www/html</code>.</p>' }),
  block('heading', { level: 2, text: '2) Déposer un site' }),
  cmd(`sudo mkdir -p /var/www/monsite
echo "<h1>Mon site</h1>" | sudo tee /var/www/monsite/index.html
sudo chown -R www-data:www-data /var/www/monsite`),
  note('gray', '👤 www-data', '<p>Apache tourne sous l’utilisateur <code>www-data</code> : les fichiers du site doivent lui être <strong>lisibles</strong> (d’où le <code>chown</code>). C’est l’équivalent du groupe <code>IIS_IUSRS</code> sous Windows.</p>'),
  block('heading', { level: 2, text: '3) Créer un hôte virtuel (virtual host)' }),
  block('html', { html: '<p>Un fichier par site dans <code>/etc/apache2/sites-available/</code> :</p>' }),
  cmd(`# /etc/apache2/sites-available/monsite.conf
<VirtualHost *:80>
    ServerName www.monsite.lan
    DocumentRoot /var/www/monsite
    ErrorLog \${APACHE_LOG_DIR}/monsite-error.log
    CustomLog \${APACHE_LOG_DIR}/monsite-access.log combined
</VirtualHost>`),
  block('html', { html: '<p>Puis on l’active et on recharge :</p>' }),
  cmd(`sudo a2ensite monsite.conf      # active le site
sudo a2dissite 000-default.conf # (optionnel) désactive le site par défaut
sudo apache2ctl configtest      # vérifie la syntaxe
sudo systemctl reload apache2`),
  note('yellow', '🌐 DNS', '<p>Pour joindre <code>www.monsite.lan</code>, il faut un <strong>enregistrement DNS</strong> (A) pointant vers l’IP du serveur — voir <a href="/pages/procedure-dns">DNS</a>. Sinon, teste par l’IP ou via le fichier <code>hosts</code> du client.</p>'),
  block('heading', { level: 2, text: '4) Vérifier & dépanner' }),
  cmd(`curl http://localhost/            # réponse du serveur
sudo ss -tlnp | grep :80          # Apache écoute sur 80 ?
sudo tail -f /var/log/apache2/monsite-error.log
sudo ufw allow 80/tcp             # ouvrir le pare-feu`),
  note('green', '🔗 Liens', '<p>Comparaison Windows : <a href="/pages/procedure-iis">IIS : héberger un site</a>. <a href="/pages/hebergement-web">L’hébergement web (concepts)</a> · <a href="/pages/linux-bases">Linux : les bases</a>.</p>'),
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

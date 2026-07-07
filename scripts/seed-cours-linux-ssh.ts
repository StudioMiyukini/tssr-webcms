/* Cours « SSH serveur (Linux) ». Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-linux-ssh.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'linux-ssh', title: 'SSH serveur sous Linux', excerpt: 'Installer et configurer OpenSSH sur un serveur Linux : service sshd, fichier sshd_config, authentification par clé (plus sûre que le mot de passe) et durcissement (désactiver root, changer le port).' };
const block = (t: Parameters<typeof makePageBlock>[0], p: Partial<PageBlock>) => Object.assign(makePageBlock(t), p);
const note = (c: string, t: string, h: string) => block('html', { html: `<aside class="pb-note pb-note-${c}"><p class="pb-note-title">${t}</p>${h}</aside>` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const styleBlock = block('html', { html: `<style>.lx-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="lx-cmd">${esc(t)}</div>` });
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Linux', title: PAGE.title, subtitle: 'Administrer un serveur Linux à distance, de façon chiffrée.' }),
  styleBlock,
  block('html', { html: '<p><strong>SSH</strong> (port <strong>22</strong>) chiffre la session d’administration à distance — c’est <strong>le</strong> moyen d’accéder à un serveur Linux (remplace Telnet, en clair). Le service côté serveur s’appelle <strong>sshd</strong> (OpenSSH). Rappel des commandes client : <a href="/pages/le-ssh">Le SSH</a>.</p>' }),
  block('heading', { level: 2, text: '1) Installer et démarrer le serveur' }),
  cmd(`sudo apt update
sudo apt install openssh-server
sudo systemctl enable ssh      # démarrage auto au boot
sudo systemctl status ssh      # vérifier qu'il tourne`),
  block('html', { html: '<p>Depuis un client : <code>ssh utilisateur@192.168.10.20</code>.</p>' }),
  block('heading', { level: 2, text: '2) Configurer (sshd_config)' }),
  block('html', { html: '<p>Le fichier de config est <code>/etc/ssh/sshd_config</code>. Après toute modification : <code>sudo systemctl restart ssh</code>. Réglages utiles :</p>' }),
  cmd(`Port 22                      # changer (ex. 2222) réduit le bruit des scans
PermitRootLogin no           # interdire la connexion directe en root
PasswordAuthentication yes   # (mettre no une fois les clés en place)
AllowUsers jean admin        # limiter aux comptes autorisés`),
  note('yellow', '⚠️ Ne te coupe pas l’accès', '<p>Avant de mettre <code>PermitRootLogin no</code> ou de désactiver le mot de passe, <strong>vérifie que ton compte normal fonctionne</strong> (et qu’il est <code>sudo</code>). Garde une session ouverte pendant les tests.</p>'),
  block('heading', { level: 2, text: '3) Authentification par clé (recommandé)' }),
  block('html', { html: '<p>Plus sûr qu’un mot de passe : une paire de <strong>clés</strong> (privée = tu la gardes, publique = sur le serveur).</p>' }),
  cmd(`# sur le CLIENT
ssh-keygen -t ed25519            # génère la paire (~/.ssh/)
ssh-copy-id jean@192.168.10.20   # copie la clé publique sur le serveur
ssh jean@192.168.10.20           # connexion sans mot de passe`),
  block('html', { html: '<p>Une fois les clés en place, on durcit : <code>PasswordAuthentication no</code> dans <code>sshd_config</code> → seules les clés sont acceptées.</p>' }),
  block('heading', { level: 2, text: '4) Vérifier & dépanner' }),
  cmd(`sudo systemctl status ssh        # actif ?
sudo ss -tlnp | grep ssh         # écoute sur le bon port ?
journalctl -u ssh                # journaux (connexions, erreurs)
sudo ufw allow 22/tcp            # ouvrir le pare-feu si ufw actif`),
  note('green', '🔗 Liens', '<p><a href="/pages/le-ssh">Le SSH (commandes client, scp, sftp)</a> · <a href="/pages/linux-bases">Linux : les bases</a> · <a href="/pages/procedure-ssh-packet-tracer">SSH sur Packet Tracer (Cisco)</a>.</p>'),
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

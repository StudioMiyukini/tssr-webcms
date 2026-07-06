/* Page de cours « SSH » : concept (accès distant chiffré, vs Telnet), fonctionnement
   (client/serveur, chiffrement, authentification mot de passe vs clés), et explication
   des commandes essentielles (ssh, scp, sftp, ssh-keygen…). Schéma + tableaux commentés.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-ssh.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const SLUG = 'le-ssh';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const th = (c: string[]) => `<tr style="background:var(--surface-2)">${c.map(x => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${x}</th>`).join('')}</tr>`;
// Tableau « commande → explication » (2 colonnes, commande en mono).
const cmdTable = (rows: Array<[string, string]>) => `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:560px;font-size:13.5px"><thead>${th(['Commande', 'Ce qu’elle fait'])}</thead><tbody>`
  + rows.map(r => `<tr><td style="padding:8px 10px;border:1px solid var(--border);font-family:ui-monospace,'Space Mono',monospace;white-space:nowrap">${r[0]}</td><td style="padding:8px 10px;border:1px solid var(--border)">${r[1]}</td></tr>`).join('')
  + `</tbody></table></div>`;

// Schéma : client → tunnel chiffré (port 22) → serveur
const C = { net: '#2563eb', ok: '#16a34a', slate: '#475569', grey: '#64748b', warn: '#d97706' };
const svg = `<svg viewBox="0 0 640 200" role="img" style="max-width:640px;width:100%;height:auto;margin:8px 0 14px;font-family:system-ui,sans-serif">`
  + `<rect x="20" y="70" width="150" height="60" rx="10" fill="${C.net}" fill-opacity="0.1" stroke="${C.net}" stroke-width="1.6"/>`
  + `<text x="95" y="95" text-anchor="middle" font-size="24">🖥️</text><text x="95" y="118" text-anchor="middle" font-size="12.5" fill="${C.net}" font-weight="bold">Client SSH</text>`
  + `<rect x="470" y="70" width="150" height="60" rx="10" fill="${C.ok}" fill-opacity="0.1" stroke="${C.ok}" stroke-width="1.6"/>`
  + `<text x="545" y="95" text-anchor="middle" font-size="24">🖧</text><text x="545" y="118" text-anchor="middle" font-size="12.5" fill="${C.ok}" font-weight="bold">Serveur (sshd)</text>`
  + `<rect x="185" y="82" width="270" height="36" rx="18" fill="${C.slate}"/>`
  + `<text x="320" y="105" text-anchor="middle" font-size="12.5" fill="#fff" font-weight="bold">🔒 Tunnel chiffré — port 22</text>`
  + `<path d="M170 100 L185 100" stroke="${C.grey}" stroke-width="2"/><path d="M455 100 L470 100" stroke="${C.grey}" stroke-width="2"/>`
  + `<text x="320" y="150" text-anchor="middle" font-size="11" fill="${C.slate}">Authentification par <tspan font-weight="bold">mot de passe</tspan> ou par <tspan font-weight="bold">clé publique/privée</tspan></text>`
  + `<text x="320" y="172" text-anchor="middle" font-size="10.5" fill="${C.grey}">Tout ce qui transite (commandes, mots de passe, fichiers) est chiffré.</text>`
  + `</svg>`;

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Réseau / Sécurité', title: 'SSH (Secure Shell)', subtitle: 'Administrer une machine à distance, de façon chiffrée — et les commandes pour le faire.' }),

  block('heading', { level: 2, text: '🔐 Qu’est-ce que SSH ?' }),
  block('html', { html: '<p><strong>SSH</strong> (<em>Secure Shell</em>) est un <strong>protocole d’accès distant sécurisé</strong>. Il permet de <strong>prendre la main sur une machine à distance</strong> (serveur Linux, routeur/switch Cisco…) en <strong>ligne de commande</strong>, en <strong>chiffrant</strong> toute la communication. Il utilise le <strong>port 22</strong> et remplace <strong>Telnet</strong> (port 23), qui faisait la même chose mais <strong>en clair</strong> (mots de passe et commandes lisibles sur le réseau).</p>' }),
  block('html', { html: svg }),

  block('heading', { level: 2, text: '⚙️ Comment ça marche' }),
  block('html', { html: '<p>SSH suit le modèle <strong>client / serveur</strong> : un <strong>serveur SSH</strong> (le service <code>sshd</code>) écoute sur la machine distante, un <strong>client SSH</strong> s’y connecte. Deux façons de prouver son identité :</p>' }),
  block('list', { listItems: [
    'Par mot de passe : simple, mais le mot de passe doit être solide.',
    'Par clé publique / privée (recommandé) : on garde une clé privée secrète sur son poste, et on dépose la clé publique sur le serveur. Plus sûr, et pas de mot de passe à retaper.',
  ] }),
  note('blue', '🔑 Les fichiers clés (côté client, dossier ~/.ssh)', '<ul><li><code>id_rsa</code> — ta <strong>clé privée</strong> (à ne JAMAIS partager).</li><li><code>id_rsa.pub</code> — ta <strong>clé publique</strong> (à déposer sur les serveurs).</li><li><code>authorized_keys</code> — sur le <strong>serveur</strong> : la liste des clés publiques autorisées.</li><li><code>known_hosts</code> — les <strong>empreintes</strong> des serveurs déjà visités (détecte l’usurpation).</li></ul>'),

  block('heading', { level: 2, text: '⌨️ Les commandes essentielles' }),
  block('html', { html: '<p><strong>Se connecter</strong> à une machine distante :</p>' }),
  block('html', { html: cmdTable([
    ['ssh utilisateur@hôte', 'Ouvre une session distante chiffrée (ex. <code>ssh admin@192.168.10.10</code>).'],
    ['ssh -l utilisateur hôte', 'Même chose, autre syntaxe (utilisée par les équipements <strong>Cisco</strong> : <code>ssh -l admin 192.168.10.254</code>).'],
    ['ssh -p 2222 utilisateur@hôte', 'Se connecter sur un <strong>port SSH personnalisé</strong> (par défaut 22).'],
    ['ssh -i ~/.ssh/ma_cle utilisateur@hôte', 'Utiliser une <strong>clé privée</strong> précise pour s’authentifier.'],
    ['ssh -v utilisateur@hôte', 'Mode <strong>verbeux</strong> : affiche le détail (utile pour <strong>déboguer</strong> une connexion).'],
    ['exit', 'Quitter la session distante et revenir sur son poste.'],
  ]) }),

  block('heading', { level: 3, text: '🔑 Authentification par clés' }),
  block('html', { html: cmdTable([
    ['ssh-keygen -t rsa -b 4096', 'Générer une <strong>paire de clés</strong> (privée + publique) sur son poste.'],
    ['ssh-copy-id utilisateur@hôte', 'Copier sa <strong>clé publique</strong> sur le serveur (l’ajoute à <code>authorized_keys</code>).'],
  ]) }),
  note('gray', '➡️ Le principe des clés', '<p>On génère la paire <strong>une fois</strong> (<code>ssh-keygen</code>), on dépose la <strong>publique</strong> sur chaque serveur (<code>ssh-copy-id</code>), et ensuite <code>ssh utilisateur@hôte</code> se connecte <strong>sans mot de passe</strong> : le serveur vérifie que tu possèdes la clé privée correspondante.</p>'),

  block('heading', { level: 3, text: '📁 Transférer des fichiers (chiffré)' }),
  block('html', { html: cmdTable([
    ['scp fichier.txt utilisateur@hôte:/chemin/', 'Copier un <strong>fichier local → serveur</strong> (SCP, via SSH).'],
    ['scp utilisateur@hôte:/chemin/fichier.txt .', 'Copier un fichier <strong>serveur → local</strong> (le <code>.</code> = dossier courant).'],
    ['scp -r dossier/ utilisateur@hôte:/chemin/', 'Copier un <strong>dossier entier</strong> (récursif).'],
    ['sftp utilisateur@hôte', 'Session de <strong>transfert interactive</strong> (commandes <code>put</code>, <code>get</code>, <code>ls</code>, <code>cd</code>).'],
  ]) }),

  block('heading', { level: 2, text: '🖧 Côté serveur' }),
  block('html', { html: '<p><strong>Sur Linux</strong>, le service est <code>sshd</code>, configuré dans <code>/etc/ssh/sshd_config</code> :</p>' }),
  block('html', { html: cmdTable([
    ['systemctl status ssh', 'Voir l’état du <strong>service SSH</strong> (démarré ? à l’écoute ?).'],
    ['systemctl restart ssh', 'Redémarrer le service après une modification de la config.'],
  ]) }),
  block('html', { html: '<p>Réglages fréquents de <code>sshd_config</code> : <code>Port 22</code>, <code>PermitRootLogin no</code> (interdire root), <code>PasswordAuthentication no</code> (forcer les clés).</p>' }),
  block('html', { html: '<p><strong>Sur un équipement Cisco</strong>, SSH s’active en CLI (nom de domaine, clés RSA, lignes VTY) :</p>' }),
  block('html', { html: cmdTable([
    ['crypto key generate rsa', 'Générer les <strong>clés RSA</strong> (après <code>hostname</code> + <code>ip domain-name</code>).'],
    ['ip ssh version 2', 'Forcer <strong>SSH v2</strong> (plus sûr que la v1).'],
    ['transport input ssh', 'Sur les lignes <code>vty</code> : n’autoriser que <strong>SSH</strong> (interdit Telnet).'],
    ['show ip ssh', 'Vérifier que <strong>SSH est actif</strong> sur l’équipement.'],
  ]) }),

  note('yellow', '🛡️ Bonnes pratiques', '<ul><li>Préférer l’<strong>authentification par clés</strong> aux mots de passe.</li><li><strong>Désactiver Telnet</strong> partout (non chiffré).</li><li>Interdire la connexion directe de <strong>root</strong> ; utiliser un compte + <code>sudo</code>.</li><li>Vérifier l’<strong>empreinte</strong> du serveur à la première connexion (protège de l’usurpation).</li></ul>'),

  note('green', '🎯 À retenir', '<p><strong>SSH</strong> = accès distant <strong>chiffré</strong> (port 22), remplace Telnet. On se connecte avec <code>ssh utilisateur@hôte</code>, on transfère avec <code>scp</code>/<code>sftp</code>, on s’authentifie par <strong>mot de passe</strong> ou (mieux) par <strong>clés</strong> (<code>ssh-keygen</code> + <code>ssh-copy-id</code>). Mise en pratique sur Cisco : <a href="/procedure-ssh-packet-tracer">Configurer le SSH sur Packet Tracer</a>. Voir aussi : <a href="/glossaire#gt-ssh">SSH au glossaire</a>, <a href="/astuce-bureau-a-distance">Bureau à distance (RDP)</a>.</p>'),
];

const PAGE = {
  slug: SLUG,
  title: 'SSH (Secure Shell)',
  excerpt: 'Cours SSH : accès distant chiffré (port 22, vs Telnet), fonctionnement client/serveur, authentification par mot de passe ou par clés, et les commandes essentielles (ssh, scp, sftp, ssh-keygen, ssh-copy-id) côté Linux et Cisco.',
};

// ===================================================================================
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
  const bodyJson = JSON.stringify({ title: PAGE.title, slug: PAGE.slug, excerpt: PAGE.excerpt, content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1 });
  const res = cur
    ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body: bodyJson })
    : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body: bodyJson });
  console.log(`PAGE ${PAGE.slug}`, res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());

  const cours = existing.find(e => e.slug === 'cours');
  if (cours) {
    const hubBlocks = buildHubBlocks();
    const r = await fetch(`${BASE}/api/admin/pages/${cours.id}`, { method: 'PUT', headers: h, body: JSON.stringify({ title: 'Cours', slug: 'cours', content: renderPageBlocksToHtml(hubBlocks), builder_json: serializePageBlocks(hubBlocks), published: 1 }) });
    console.log('HUB Cours', r.status, r.ok ? '(maj)' : await r.text());
  } else console.log('HUB Cours introuvable');

  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });
